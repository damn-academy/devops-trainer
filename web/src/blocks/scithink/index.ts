// Hidden pilot block «Научное мышление»: a universal non-IT skill course for
// adults who are not specialists. Not on the route map (hidden: true);
// reachable from the hidden catalog #/courses and by the direct block link.
// Every lesson carries the honest note (one way, not a law) and the
// self-check note (this course can be wrong too — check it). Russian is the
// source text of every lesson; the English slot of every bi() is a faithful
// translation, unlike the sales pilot's TODO(ru-en) placeholders.

import { SCITHINK_MODULES } from './structure';
import { defineModule } from '../../core/define';
import { bi } from '../../core/i18n';
import type { Block } from '../../core/types';
import { fromModel } from '../../engine/explainer/render';
import { calibrationWidget } from './calibration';
import { correlationModel } from './correlation';
import { SCITHINK_CONCEPTS, SCITHINK_LESSONS, SCITHINK_QUIZ } from './content';

const block: Block = {
  id: 'scithink',
  order: 991,
  hidden: true,
  title: bi('Научное мышление: как проверять утверждения и не обманываться', 'Scientific thinking: how to check claims and not fool yourself'),
  summary: bi(
    'Пилот скрытого раздела «Курсы»: двенадцать уроков о проверке утверждений — базовая ставка, одиночный случай против распределения, корреляция и третий фактор, контроль, чтение исследований, калибровка, Байес, фейки, цифры в рекламе и прогнозы. С интерактивной схемой корреляции и тренажёром калибровки. Это один из способов смотреть на мир, не закон.',
    'A pilot of the hidden "Courses" section: twelve lessons about checking claims — the base rate, one case against the distribution, correlation and the third factor, controls, reading studies, calibration, Bayes, fakes, numbers in advertising and forecasts. With the interactive correlation scheme and the calibration trainer. One way of looking at the world, not a law.',
  ),
  checklistStep: null,
  levels: {
    beginner: bi('Первое знакомство с проверкой утверждений', 'First contact with checking claims'),
    intermediate: bi('Иногда проверяете то, что читаете', 'You sometimes check what you read'),
    experienced: bi('Регулярно разбираете данные и прогнозы', 'You regularly take apart data and forecasts'),
  },
  modules: SCITHINK_MODULES,
  lessons: SCITHINK_LESSONS.map((l) => l.id),
  sources: { en: [], ru: [] },
  placement: [],
};

export default defineModule({
  blocks: [block],
  lessons: SCITHINK_LESSONS,
  concepts: SCITHINK_CONCEPTS,
  quiz: SCITHINK_QUIZ,
  explainers: [fromModel(correlationModel)],
  widgets: [calibrationWidget],
});
