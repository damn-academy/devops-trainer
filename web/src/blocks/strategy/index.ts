import { bi } from '../../core/i18n';
import { defineModule } from '../../core/define';
import { loadMarkdownLessons, markdownQuizItems } from '../../core/md-lessons';
import { productById } from '../../core/products';
import { STRATEGY_MODULES, STRATEGY_SUMMARIES } from './structure';

const loaded = loadMarkdownLessons(import.meta.glob<string>(
  ['./*.ru.md', './*.en.md'], { query: '?raw', import: 'default', eager: true },
), 'strategy');
const lessons = STRATEGY_MODULES.flatMap(module => module.lessons).map(id => {
  const lesson = loaded.find(lesson => lesson.id === id);
  if (!lesson) throw new Error(`Missing lesson: ${id}`);
  return { ...lesson, summary: STRATEGY_SUMMARIES[id] };
});
if (lessons.length !== loaded.length) throw new Error('Every Markdown lesson must appear in the course modules');
const hours = lessons.reduce((sum, lesson) => sum + (lesson.minutes ?? 0), 0) / 60;
const product = productById('strategy')!;

export default defineModule({
  blocks: [{
    id: 'strategy', order: 992, hidden: true,
    title: product.title, summary: product.summary,
    checklistStep: null, levels: {
      beginner: bi('Знакомитесь с темой', 'New to the topic'),
      intermediate: bi('Применяете в работе', 'Applying it at work'),
      experienced: bi('Отвечаете за решения компании', 'Responsible for company decisions'),
    },
    hours: { beginner: hours, intermediate: hours, experienced: hours },
    modules: STRATEGY_MODULES, lessons: lessons.map(lesson => lesson.id),
    sources: { ru: [], en: [] }, placement: [],
  }],
  lessons,
  quiz: markdownQuizItems(lessons),
});
