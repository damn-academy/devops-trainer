// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { blockPage } from '../src/app/block';
import { coursesPage } from '../src/app/courses-page';
import { lessonPage } from '../src/app/lesson';
import { setLang, t } from '../src/core/i18n';
import { productById, visibleProducts } from '../src/core/products';
import { registry } from '../src/core/registry';
import { MemoryBackend, store } from '../src/core/store';

beforeEach(async () => {
  await store.init(new MemoryBackend());
});

afterEach(() => setLang('ru'));

describe.each(['ru', 'en'] as const)('product course renders in %s', (language) => {
  it('keeps the course hidden and links the preview to all registered lessons', () => {
    setLang(language);
    expect(productById('product')).toMatchObject({ kind: 'course', hidden: true });
    expect(visibleProducts('course').some((p) => p.id === 'product')).toBe(false);
    const preview = coursesPage();
    expect(preview.el.querySelector('a[href="#/block/product"]')).toBeTruthy();
    const block = registry.blocks.get('product')!;
    expect(block.hidden).toBe(true);
    expect(block.sources[language].length).toBeGreaterThan(0);
    const page = blockPage('product');
    expect(page.el.querySelector('h1')?.textContent).toBe(t(block.title));
    expect(page.el.querySelectorAll('.lesson-list li')).toHaveLength(11);
    for (const id of block.lessons) {
      expect(page.el.querySelector(`a[href="#/lesson/${id}"]`)).toBeTruthy();
    }
    page.dispose?.();
    preview.dispose?.();
  });

  it('renders every lesson, including both interactive models', () => {
    setLang(language);
    for (const id of registry.blocks.get('product')!.lessons) {
      const lesson = registry.lessons.get(id)!;
      const page = lessonPage(id);
      try {
        expect(page.el.querySelector('h1')?.textContent).toBe(t(lesson.title));
        expect(page.el.querySelector('.quiz-item'), id).toBeTruthy();
        if (id === 'product.opencore' || id === 'product.pricing') {
          expect(page.el.querySelector('input[type="range"]'), id).toBeTruthy();
          expect(page.el.querySelector('table'), id).toBeTruthy();
        }
      } finally {
        page.dispose?.();
      }
    }
  });
});
