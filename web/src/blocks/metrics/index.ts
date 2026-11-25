import { defineModule } from '../../core/define';
import { bi } from '../../core/i18n';
import { loadMarkdownLessons, markdownQuizItems } from '../../core/md-lessons';
import { productById } from '../../core/products';
import { METRICS_MODULES, METRICS_SUMMARIES } from './structure';

const lessons = loadMarkdownLessons(import.meta.glob<string>(
  ['./*.ru.md', './*.en.md'], { query: '?raw', import: 'default', eager: true },
), 'metrics').map(lesson => ({ ...lesson, summary: METRICS_SUMMARIES[lesson.id] }));
const product = productById('metrics')!;

export default defineModule({
  blocks: [{
    id: 'metrics', order: 993, hidden: true,
    title: product.title, summary: product.summary,
    checklistStep: null,
    levels: {
      beginner: bi('Определяете первые метрики', 'Defining your first metrics'),
      intermediate: bi('Измеряете воронку и удержание', 'Measuring the funnel and retention'),
      experienced: bi('Отвечаете за систему метрик', 'Owning the metrics system'),
    },
    hours: { beginner: 7, intermediate: 6, experienced: 5 },
    modules: METRICS_MODULES,
    lessons: METRICS_MODULES.flatMap(module => module.lessons),
    sources: { ru: [], en: [] }, placement: [],
  }],
  lessons,
  quiz: markdownQuizItems(lessons),
});
