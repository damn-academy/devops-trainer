// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { lessonPage } from '../src/app/lesson';
import { MARKETING_V2_LESSONS } from '../src/blocks/marketing/v2';
import { setLang } from '../src/core/i18n';
import { store } from '../src/core/store';
import { getScenario } from '../src/engine/deptsim/registry';

// Keep the DNS lab and its tasks real; jsdom cannot render xterm's canvas.
vi.mock('../src/engine/terminal/widget', () => ({
  mountTerminal: async () => ({ dispose() {}, type() {}, run: async () => {}, reset() {}, focus() {} }),
}));

const normalize = (text: string) => text.replace(/\s+/g, ' ').replace(/[‘’]/g, "'").replace(/[«»„“”]/g, '"');

beforeEach(async () => {
  await store.reset();
  localStorage.clear();
});

afterEach(() => {
  setLang('ru');
  document.body.replaceChildren();
});

for (const lang of ['ru', 'en'] as const) {
  for (const lesson of MARKETING_V2_LESSONS) {
    it(`renders ${lesson.id} fully in ${lang}`, async () => {
      setLang(lang);
      const page = lessonPage(lesson.id);
      document.body.append(page.el);
      try {
        expect(page.el.querySelector('h1')?.textContent).toBe(lesson.title[lang]);
        for (const section of lesson.sections) {
          const rendered = page.el.querySelector(`#s-${section.id}`);
          expect(rendered).not.toBeNull();
          if (section.kind === 'widget') {
            await vi.waitFor(() => expect(rendered!.querySelector('.widget-host')?.children.length).toBeGreaterThan(0));
            expect(rendered!.querySelector('.err')).toBeNull();
            if (section.widget === 'deptsim') {
              const scenario = getScenario((section.props as { scenario: string }).scenario)!;
              expect(rendered!.querySelector('.deptsim > h3')?.textContent).toBe(scenario.title[lang]);
              expect(rendered!.textContent).toContain(scenario.premise[lang]);
            }
          }
          if (section.kind === 'text') {
            if (section.title) expect(rendered!.textContent).toContain(section.title[lang]);
            // Every paragraph reaches the DOM, with inline formatting removed.
            for (const paragraph of section.body[lang].split('\n\n')) {
              expect(normalize(rendered!.textContent ?? '')).toContain(normalize(paragraph.replace(/\[\[[^|\]]+\|([^\]]+)\]\]/g, '$1').replace(/`([^`]+)`/g, '$1')));
            }
          }
        }
        for (const source of lesson.sources[lang]) {
          expect([...page.el.querySelectorAll('a')].some((a) => a.href === new URL(source.url).href && a.textContent?.includes(source.title))).toBe(true);
        }
        expect(page.el.textContent).not.toContain('<!--');
        expect(page.el.textContent).not.toContain('[[');
        if (lang === 'en') {
          // The engine intentionally displays both language source lists.
          const prose = page.el.cloneNode(true) as HTMLElement;
          prose.querySelector('.sources-block')?.remove();
          // TODO(en-prompts): GM source prose and company configuration labels
          // are Russian-only. Keep scenario titles, premises and all other UI checked.
          prose.querySelectorAll('.deptsim .ds-prompt, .deptsim .ds-company-config').forEach(el => el.remove());
          expect(prose.textContent).not.toMatch(/[а-яё]/i);
        }
        // jsdom has no IntersectionObserver, so reading sections complete on mount.
        // Quizzes and practice still require the learner to complete them.
        const pending = lesson.sections.filter(s => !['text', 'callout'].includes(s.kind) || s.kind === 'text' && s.step === 'practice');
        expect(page.el.querySelector<HTMLElement>('.lesson-done')!.hidden).toBe(pending.length > 0);
        expect(store.state.lessons[lesson.id]?.status === 'done').toBe(pending.length === 0);
        for (const section of pending) {
          expect(store.state.lessons[lesson.id]?.sections).not.toContain(section.id);
        }
        // Answering every exit question completes a reading lesson, but must
        // not bypass an unfinished practice widget in a mixed lesson.
        for (const quiz of page.el.querySelectorAll<HTMLElement>('.quiz-item')) {
          quiz.querySelector<HTMLInputElement>('input[type="radio"]')!.click();
          quiz.querySelector<HTMLButtonElement>('.q-actions > button')!.click();
        }
        // Written tasks require explicit self-review; reading the prompt is insufficient.
        for (const document of page.el.querySelectorAll('.task-document')) {
          expect(document.querySelector('textarea')).not.toBeNull();
          const finish = [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => /Завершить самопроверку|Finish self-review/.test(b.textContent ?? ''))!;
          // An untouched form is not a result: the button waits for the learner's text.
          expect(finish.disabled).toBe(true);
          const field = document.querySelector('textarea')!;
          field.value += '\nМой результат';
          field.dispatchEvent(new Event('input'));
          expect(finish.disabled).toBe(false);
          finish.click();
          expect(document.querySelector('[role="status"]')?.textContent).toMatch(/Самопроверка завершена|Self-review complete/);
        }
        // A spreadsheet template is finished together with the lesson's task document.
        const practicePending = pending.some(s => s.kind !== 'quiz' && s.kind !== 'text' && !(s.kind === 'widget' && s.widget === 'template'));
        await vi.waitFor(() => {
          expect(page.el.querySelector<HTMLElement>('.lesson-done')!.hidden).toBe(practicePending);
          expect(store.state.lessons[lesson.id]?.status === 'done').toBe(!practicePending);
          for (const section of pending.filter(s => s.kind === 'quiz')) {
            expect(store.state.lessons[lesson.id]?.sections).toContain(section.id);
          }
        });
      } finally { page.dispose?.(); }
    });
  }
}
