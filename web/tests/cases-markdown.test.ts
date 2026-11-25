import { describe, expect, it } from 'vitest';
import { registry } from '../src/core/registry';
import { PRODUCT_V2_LESSONS } from '../src/blocks/product/v2';
import { MARKETING_V2_LESSONS } from '../src/blocks/marketing/v2';

// A legacy lesson with the same id can silently shadow its Markdown replacement.
describe('Markdown company case studies', () => {
  for (const [id, source] of [
    ['product.cases', PRODUCT_V2_LESSONS],
    ['marketing.cases', MARKETING_V2_LESSONS],
  ] as const) {
    it(`publishes ${id} with its bilingual Markdown sections and quizzes`, () => {
      const lesson = registry.lessons.get(id)!;
      const markdown = source.find(l => l.id === id)!;
      expect(lesson.sections).toEqual(markdown.sections);
      expect(lesson.title).toEqual(markdown.title);
      expect(lesson.sources.en.map(s => s.url)).toEqual(lesson.sources.ru.map(s => s.url));
      const questions = [...registry.quiz.values()].filter(q => q.refs?.lesson === id);
      expect(questions).toHaveLength(3);
      expect(questions.every(q => !q.id.startsWith('product.q.case-'))).toBe(true);
      const block = registry.blocks.get(lesson.block)!;
      expect(block.lessons.filter(l => l === id)).toHaveLength(1);
      expect(block.lessons).toEqual(block.modules!.flatMap(m => m.lessons));
    });
  }
});
