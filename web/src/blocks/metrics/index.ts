import type { Section } from '../../core/types';
import { defineModule } from '../../core/define';
import { bi } from '../../core/i18n';
import { loadMarkdownLessons, markdownQuizItems } from '../../core/md-lessons';
import { productById } from '../../core/products';
import { METRICS_MODULES, METRICS_SUMMARIES } from './structure';

// Same widget props as <!-- widget: template {"file":"metrics-cohorts"} -->.
// Keep downloads available without editing lesson prose; explicit author markers
// take precedence so the lead can move each card into the desired paragraph.
const practiceFiles: Record<string, string[]> = {
  'metrics.activation': ['metrics-cohorts'],
  'metrics.pipeline': ['metrics-pipeline'],
  'metrics.forecast': ['metrics-forecast'],
  'metrics.arr': ['metrics-arr-start', 'metrics-arr'],
  'metrics.lift': ['metrics-ab'],
};
const lessons = loadMarkdownLessons(import.meta.glob<string>(
  ['./*.ru.md', './*.en.md'], { query: '?raw', import: 'default', eager: true },
), 'metrics').map(lesson => {
  const downloads: Section[] = (practiceFiles[lesson.id] ?? [])
    .filter(file => !lesson.sections.some(section => section.kind === 'widget' && section.widget === 'template' && (section.props as { file?: string } | undefined)?.file === file))
    .map(file => ({ id: `download-${file}`, kind: 'widget', step: 'practice', widget: 'template', props: { file } }));
  const sections = [...lesson.sections];
  const practice = sections.findIndex(section => section.step === 'practice');
  sections.splice(practice < 0 ? sections.length : practice + 1, 0, ...downloads);
  return { ...lesson, sections, summary: METRICS_SUMMARIES[lesson.id] };
});
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
