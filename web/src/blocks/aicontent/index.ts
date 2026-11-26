import type { Section } from '../../core/types';
import { defineModule } from '../../core/define';
import { bi } from '../../core/i18n';
import { loadMarkdownLessons, markdownQuizItems } from '../../core/md-lessons';
import { productById } from '../../core/products';
import { AICONTENT_MODULES, AICONTENT_SUMMARIES } from './structure';

const lessons = loadMarkdownLessons(import.meta.glob<string>(
  ['./*.ru.md', './*.en.md'], { query: '?raw', import: 'default', eager: true },
), 'aicontent').map(lesson => ({ ...lesson, sections: [...lesson.sections, ...(lesson.id === 'aicontent.editing' ? [{ id: 'download-ru-intensifiers-lint', kind: 'widget', step: 'practice', widget: 'template', props: { file: 'ru-intensifiers-lint' } } satisfies Section] : [])], summary: AICONTENT_SUMMARIES[lesson.id] }));
const product = productById('aicontent')!;

export default defineModule({
  blocks: [{
    id: 'aicontent', order: 998, hidden: true,
    title: product.title, summary: product.summary,
    checklistStep: null,
    levels: {
      beginner: bi('Готовите первые материалы с нейросетями', 'Creating your first materials with AI'),
      intermediate: bi('Регулярно выпускаете контент', 'Publishing content regularly'),
      experienced: bi('Отвечаете за редакцию и производство', 'Leading editorial and production work'),
    },
    hours: { beginner: 5.1, intermediate: 4.1, experienced: 3.1 },
    modules: AICONTENT_MODULES,
    lessons: AICONTENT_MODULES.flatMap(module => module.lessons),
    sources: { ru: [], en: [] }, placement: [],
  }],
  lessons,
  quiz: markdownQuizItems(lessons),
});
