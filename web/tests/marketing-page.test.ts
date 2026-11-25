// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { coursePage } from '../src/app/course-page';
import { MARKETING_MODULES } from '../src/blocks/marketing/structure';
import { setLang } from '../src/core/i18n';
import { productById, productRoute, visibleProducts } from '../src/core/products';
import { registry } from '../src/core/registry';
import { href, parseRoute } from '../src/core/router';

afterEach(() => {
  setLang('ru');
  document.body.replaceChildren();
});

describe('marketing course page', () => {
  it('publishes the course with its direct route while keeping its block off the profession map', () => {
    const product = productById('marketing')!;
    expect(product.hidden).not.toBe(true);
    expect(visibleProducts('course')).toContain(product);
    expect(parseRoute(href(productRoute(product)))).toEqual({ name: 'course', id: 'marketing' });
    expect(registry.blocks.get('marketing')?.hidden).toBe(true);
  });

  for (const lang of ['ru', 'en'] as const) {
    it(`renders all registered lesson links and summaries in ${lang}`, () => {
      setLang(lang);
      const { el } = coursePage('marketing');
      document.body.append(el);
      expect(el.querySelector('h1')?.textContent).toBe(productById('marketing')!.title[lang]);
      const cards = [...el.querySelectorAll<HTMLAnchorElement>('.course-cards a')];
      const lessons = MARKETING_MODULES.flatMap(m => m.lessons).map(id => registry.lessons.get(id)!);
      expect(cards).toHaveLength(lessons.length);
      for (const [i, lesson] of lessons.entries()) {
        expect(parseRoute(cards[i]!.getAttribute('href')!)).toEqual({ name: 'lesson', id: lesson.id });
        expect(registry.lessons.has(lesson.id)).toBe(true);
        expect(cards[i]!.querySelector('h3')?.textContent).toBe(lesson.title[lang]);
        expect(lesson.summary!.ru.length).toBeGreaterThan(0);
        expect(lesson.summary!.en.length).toBeGreaterThan(0);
      }
      expect(el.querySelector('.lede')?.textContent).toBe(productById('marketing')!.subtitle![lang]);
      if (lang === 'en') expect(el.textContent).not.toMatch(/[а-яё]/i);
    });
  }
});
