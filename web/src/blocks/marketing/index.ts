import { MARKETING_MODULES, MARKETING_SUMMARIES } from './structure';
import { budgetWidget } from './v2/budget';
import { dnsLabWidget, dnsSetup } from './v2/dns-lab';
// Hidden pilot block: the marketing school for infrastructure and open-source
// vendors on international markets, on the shared course engine. Not on the
// route map (hidden: true); reachable from the hidden course page
// #/course/marketing and by the direct block link. The Russian lesson text is
// the source material; the English slot is a faithful full translation.
// Claude owns the prose per web/STYLE-RU.md.

import { markdownQuizItems } from '../../core/md-lessons';
import { defineModule } from '../../core/define';
import { bi } from '../../core/i18n';
import type { Block } from '../../core/types';
import { fromModel } from '../../engine/explainer/render';
import { MARKETING_CONCEPTS, MARKETING_LESSONS, MARKETING_QUIZ } from './content';
import { loopModel } from './loop';
import { regionsWidget } from './regions';

// Attach the interactive pieces: a quiz set spread over the lessons it checks,
// the growth-loop scheme to the events lesson (principle 34, the one machine),
// the regions simulator to the regions lesson.
const lessons = MARKETING_MODULES.flatMap(m => m.lessons).map(id => {
  const l = MARKETING_LESSONS.find(l => l.id === id)!;
  return { ...l, summary: MARKETING_SUMMARIES[l.id], sections: [...l.sections] };
});
const QUIZ_BY_LESSON: Record<string, string[]> = {
  'marketing.fundamentals': ['marketing.q.category', 'marketing.q.icp'],
  'marketing.vaccine': ['marketing.q.sharp'],
  'marketing.content': ['marketing.q.geo', 'marketing.q.machine'],
  'marketing.platforms': ['marketing.q.platform'],
  'marketing.community': ['marketing.q.devrel'],
  'marketing.analytics': ['marketing.q.attribution'],
  'marketing.regions': ['marketing.q.regions'],
};
for (const [lessonId, items] of Object.entries(QUIZ_BY_LESSON)) {
  const lesson = lessons.find((l) => l.id === lessonId)!;
  lesson.sections.splice(lesson.sections.length - 1, 0, {
    id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items,
  });
}
const events = lessons.find((l) => l.id === 'marketing.events')!;
events.sections.splice(2, 0, {
  id: 'loop', kind: 'explainer', step: 'look', explainer: 'marketing.loop',
  howto: bi('Листайте шаги стрелками; клик по блоку открывает его карточку.', 'Step with the arrows; click a block to open its card.'),
});
const regions = lessons.find((l) => l.id === 'marketing.regions')!;
regions.sections.splice(2, 0, {
  id: 'regions', kind: 'widget', step: 'practice', widget: 'marketing.regions',
});

const block: Block = {
  id: 'marketing',
  order: 991,
  hidden: true,
  title: bi('Маркетинг', 'Marketing'),
  summary: bi(
    'Пилот скрытого раздела «Курсы»: 46 принципов маркетинга инфраструктурных и open-source продуктов на международных рынках по модулю в день, с квизами, схемой петли роста и симулятором регионов. Это один из способов работы, не закон.',
    'A pilot of the hidden "Courses" section: 46 principles of marketing for infrastructure and open-source vendors on international markets, one module a day, with quizzes, the growth-loop scheme and the regions simulator. One way of working, not a law.',
  ),
  checklistStep: null,
  levels: {
    beginner: bi('Выходите на международный рынок впервые', 'Entering international markets for the first time'),
    intermediate: bi('Ведёте каналы и мероприятия', 'Running channels and events'),
    experienced: bi('Отвечаете за стратегию и бюджет', 'Owning strategy and budget'),
  },
  hours: { beginner: 2.2, intermediate: 1.4, experienced: 1 },
  modules: MARKETING_MODULES,
  lessons: lessons.map((l) => l.id),
  sources: { en: [], ru: [] },
  placement: [],
};

export default defineModule({
  blocks: [block],
  lessons,
  concepts: MARKETING_CONCEPTS,
  quiz: [...MARKETING_QUIZ, ...markdownQuizItems(lessons)],
  explainers: [fromModel(loopModel)],
  widgets: [regionsWidget, budgetWidget, dnsLabWidget],
  setup: [dnsSetup],
});
