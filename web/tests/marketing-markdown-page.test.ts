// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { lessonPage } from '../src/app/lesson';
import { MARKETING_V2_LESSONS } from '../src/blocks/marketing/v2';
import { setLang } from '../src/core/i18n';

const normalize = (text: string) => text.replace(/\s+/g, ' ').replace(/[‘’]/g, "'").replace(/[«»„“”]/g, '"');

afterEach(() => {
  setLang('ru');
  document.body.replaceChildren();
});

for (const lang of ['ru', 'en'] as const) {
  for (const lesson of MARKETING_V2_LESSONS) {
    it(`renders ${lesson.id} fully in ${lang}`, () => {
      setLang(lang);
      const page = lessonPage(lesson.id);
      document.body.append(page.el);
      try {
        expect(page.el.querySelector('h1')?.textContent).toBe(lesson.title[lang]);
        for (const section of lesson.sections) {
          const rendered = page.el.querySelector(`#s-${section.id}`);
          expect(rendered).not.toBeNull();
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
          expect(prose.textContent).not.toMatch(/[а-яё]/i);
        }
        expect(page.el.querySelector<HTMLElement>('.lesson-done')!.hidden).toBe(false);
      } finally { page.dispose?.(); }
    });
  }
}
