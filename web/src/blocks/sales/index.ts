// Hidden pilot block: the Dream 100 enterprise sales school on the shared
// course engine. Not on the route map (hidden: true); reachable from the
// hidden catalog #/courses and by the direct block link. The Russian lesson
// text is the source material from aenix-org/dream100; the English slot is an
// honest placeholder (TODO(ru-en)) until the owner's content pipeline passes
// it. Claude owns the prose per web/STYLE-RU.md.

import { markdownQuizItems } from '../../core/md-lessons';
import { DREAM100_LESSONS } from './dream100';
import { SALES_MODULES, DREAM100_SUMMARIES } from './structure';
import { defineModule } from '../../core/define';
import { bi } from '../../core/i18n';
import type { Block } from '../../core/types';
import { fromModel } from '../../engine/explainer/render';
import { buyingModel } from './buying';
import { SALES_CONCEPTS, SALES_LESSONS, SALES_QUIZ } from './content';
import { funnelWidget } from './funnel';

// Attach the interactive pieces: the buying-center scheme to the roles lesson,
// the funnel simulator to the touches lesson, the quiz to the last one.
const lessons = SALES_LESSONS.map((l) => ({ ...l, sections: [...l.sections] }));
const roles = lessons.find((l) => l.id === 'sales.roles')!;
roles.sections.splice(2, 0, {
  id: 'buying', kind: 'explainer', step: 'look', explainer: 'sales.buying',
  howto: bi('Листайте шаги стрелками; клик по роли открывает её карточку.', 'Step with the arrows; click a role to open its card.'),
});
const touches = lessons.find((l) => l.id === 'sales.touches')!;
touches.sections.splice(2, 0, {
  id: 'funnel', kind: 'widget', step: 'practice', widget: 'sales.funnel',
});
const last = lessons[lessons.length - 1]!;
last.sections.splice(last.sections.length - 1, 0, { id: 'quiz', kind: 'quiz', step: 'exit', title: bi('Проверьте себя', 'Check yourself'), items: SALES_QUIZ.map((q) => q.id) });

lessons.push(...DREAM100_LESSONS.map(l => ({ ...l, summary: DREAM100_SUMMARIES[l.id], sections: [...l.sections] })));

const block: Block = {
  id: 'sales',
  order: 990,
  hidden: true,
  title: bi('Школа enterprise-продаж', 'The enterprise sales school'),
  summary: bi(
    'Пилот скрытого раздела «Курсы»: 46 принципов сложных продаж по модулю в день, с интерактивной схемой закупочного центра и симулятором воронки. Это один из способов работы, не закон.',
    'A pilot of the hidden "Courses" section: 46 principles of complex sales, one module a day, with the interactive buying-center scheme and the funnel simulator. One way of working, not a law.',
  ),
  checklistStep: null,
  levels: {
    beginner: bi('Продаёте впервые', 'New to sales'),
    intermediate: bi('Ведёте аккаунты', 'Running accounts'),
    experienced: bi('Ведете сложные сделки', 'Running complex deals'),
  },
  hours: { beginner: 2, intermediate: 1.2, experienced: 0.8 },
  modules: SALES_MODULES,
  lessons: lessons.map((l) => l.id),
  sources: { en: [], ru: [] },
  placement: [],
};

export default defineModule({
  blocks: [block],
  lessons,
  concepts: SALES_CONCEPTS,
  quiz: [...SALES_QUIZ, ...markdownQuizItems(lessons)],
  explainers: [fromModel(buyingModel)],
  widgets: [funnelWidget],
});
