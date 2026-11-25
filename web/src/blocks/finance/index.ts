import { defineModule } from '../../core/define';
import { roundWidget, franchiseWidget } from './widgets';
import { bi } from '../../core/i18n';
import { loadMarkdownLessons, markdownQuizItems } from '../../core/md-lessons';
import { productById } from '../../core/products';
import { FINANCE_MODULES, FINANCE_SUMMARIES } from './structure';

const lessons = loadMarkdownLessons(import.meta.glob<string>(
  ['./*.ru.md', './*.en.md'], { query: '?raw', import: 'default', eager: true },
), 'finance').map(lesson => ({ ...lesson, summary: FINANCE_SUMMARIES[lesson.id] }));
const product = productById('finance')!;

export default defineModule({
  blocks: [{
    id: 'finance', order: 996, hidden: true,
    title: product.title, summary: product.summary,
    checklistStep: null,
    levels: {
      beginner: bi('Читаете первые отчёты', 'Reading your first statements'),
      intermediate: bi('Управляете деньгами компании', 'Managing company cash'),
      experienced: bi('Строите финансовую функцию', 'Building the finance function'),
    },
    hours: { beginner: 6.5, intermediate: 5.5, experienced: 4.5 },
    modules: FINANCE_MODULES,
    lessons: FINANCE_MODULES.flatMap(module => module.lessons),
    sources: { ru: [], en: [] }, placement: [],
  }],
  widgets: [roundWidget, franchiseWidget],
  lessons,
  quiz: markdownQuizItems(lessons),
});
