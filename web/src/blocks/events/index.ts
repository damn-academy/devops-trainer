import { defineModule } from '../../core/define';
import { bi } from '../../core/i18n';
import { loadMarkdownLessons, markdownQuizItems } from '../../core/md-lessons';
import { productById } from '../../core/products';
import { EVENTS_MODULES, EVENTS_SUMMARIES } from './structure';

const lessons = loadMarkdownLessons(import.meta.glob<string>(
  ['./*.ru.md', './*.en.md'], { query: '?raw', import: 'default', eager: true },
), 'events').map(lesson => ({ ...lesson, summary: EVENTS_SUMMARIES[lesson.id] }));
const product = productById('events')!;

export default defineModule({
  blocks: [{
    id: 'events', order: 992, hidden: true,
    title: product.title, summary: product.summary,
    checklistStep: null,
    levels: {
      beginner: bi('Готовите первое событие', 'Preparing your first event'),
      intermediate: bi('Проводите события и выступаете', 'Running events and giving talks'),
      experienced: bi('Отвечаете за программу событий', 'Owning the events program'),
    },
    hours: { beginner: 2.2, intermediate: 1.8, experienced: 1.4 },
    modules: EVENTS_MODULES,
    lessons: EVENTS_MODULES.flatMap(module => module.lessons),
    sources: { ru: [], en: [] }, placement: [],
  }],
  lessons,
  quiz: markdownQuizItems(lessons),
});
