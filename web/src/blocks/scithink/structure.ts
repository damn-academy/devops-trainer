import { bi } from '../../core/i18n';
import type { CourseModule } from '../../core/types';

// Lesson summaries remain the prose owner's existing pilot summaries.
export const SCITHINK_MODULES: CourseModule[] = [
  {
    title: bi('Уверенность и частоты', 'Confidence and frequencies'),
    lessons: ['scithink.story', 'scithink.base-rate', 'scithink.anecdote'],
  },
  {
    title: bi('Причины и проверки', 'Causes and checks'),
    lessons: ['scithink.correlation', 'scithink.control', 'scithink.studies'],
  },
  {
    title: bi('Оценки и пересчёт', 'Estimates and updating'),
    lessons: ['scithink.calibration', 'scithink.bayes'],
  },
  {
    title: bi('Цифры и манипуляции', 'Numbers and manipulation'),
    lessons: ['scithink.fakes', 'scithink.numbers'],
  },
  {
    title: bi('Прогнозы и итоговая проверка', 'Forecasts and the final check'),
    lessons: ['scithink.forecasts', 'scithink.final'],
  },
];
