// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { coursePage } from '../src/app/course-page';
import { MARKETING_LESSONS, HONEST_NOTE } from '../src/blocks/marketing/content';
import { setLang } from '../src/core/i18n';
import { productById, productRoute, visibleProducts } from '../src/core/products';
import { registry } from '../src/core/registry';
import { href, parseRoute } from '../src/core/router';

afterEach(() => {
  setLang('ru');
  document.body.replaceChildren();
});

describe('marketing course page', () => {
  it('keeps the pilot hidden and reachable by its direct route', () => {
    const product = productById('marketing')!;
    expect(product.hidden).toBe(true);
    expect(visibleProducts('course')).not.toContain(product);
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
      expect(cards).toHaveLength(MARKETING_LESSONS.length + 1);
      for (const [i, lesson] of MARKETING_LESSONS.entries()) {
        expect(parseRoute(cards[i]!.getAttribute('href')!)).toEqual({ name: 'lesson', id: lesson.id });
        expect(registry.lessons.has(lesson.id)).toBe(true);
        expect(cards[i]!.querySelector('h2')?.textContent).toBe(lesson.title[lang]);
        expect(lesson.summary!.ru).toMatch(/[0-9]+ принцип/);
        expect(lesson.summary!.en).toMatch(/[0-9]+ principles? with/);
      }
      expect(cards.at(-1)!.getAttribute('href')).toBe('#/block/marketing');
      expect(el.querySelector('.sfu-note')?.textContent).toBe(HONEST_NOTE[lang]);
      if (lang === 'en') expect(el.textContent).not.toMatch(/[а-яё]/i);
    });
  }
});
