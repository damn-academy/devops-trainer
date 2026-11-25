// Hidden pilot block "Продукт": how B2B and open-source products are built,
// on the shared course engine. Not on the route map (hidden: true); reachable
// from the hidden catalog #/courses and by the direct block link. Russian is
// the source text; every English slot of every bi() is a faithful
// translation. Claude owns the prose per web/STYLE-RU.md.

import { defineModule } from '../../core/define';
import { bi } from '../../core/i18n';
import type { Block } from '../../core/types';
import { PRODUCT_CONCEPTS, PRODUCT_LESSONS, PRODUCT_QUIZ } from './content';
import { opencoreWidget } from './opencore';
import { valuemetricWidget } from './valuemetric';

// Attach the interactive pieces: the boundary model to the open-core lesson,
// the value-metric model to the pricing lesson. Each gets a text section
// before it that says what the model shows and what the knobs mean.
const lessons = PRODUCT_LESSONS.map((l) => ({ ...l, sections: [...l.sections] }));

const opencore = lessons.find((l) => l.id === 'product.opencore')!;
opencore.sections.splice(3, 0,
  {
    id: 'opencore-look', kind: 'text', step: 'look',
    body: bi(
      'Модель ниже намеренно простая и показывает направление компромисса, а не обещает точные цифры. Ползунки меняют долю возможностей за платной границей, широту бесплатной версии и цену платной, а счётчики и таблица показывают, как за двенадцать месяцев меняются число установок, платящие компании, выручка и доверие сообщества. Поднимите границу до жадного уровня и посмотрите, что происходит с доверием и с ростом платящих компаний.',
      'The model below is deliberately simple: it shows the direction of the trade-off and promises no exact numbers. The sliders change the share of capabilities behind the paid boundary, the breadth of the free version and the paid price, while the counters and the table show how installs, paying companies, revenue and community trust shift over twelve months. Push the boundary to a greedy level and watch what happens to trust and to the growth of paying companies.',
    ),
  },
  { id: 'opencore-model', kind: 'widget', step: 'practice', widget: 'product.opencore' });

const pricing = lessons.find((l) => l.id === 'product.pricing')!;
pricing.sections.splice(3, 0,
  {
    id: 'valuemetric-look', kind: 'text', step: 'look',
    body: bi(
      'Модель ниже сравнивает четыре классических метрики ценности на одном абстрактном продукте. Выберите метрику кнопкой, задайте число клиентов, цену за единицу и то, во сколько раз клиент вырастет за год. Счётчики и таблица покажут текущую выручку, выручку через год и то, насколько предсказуемым остаётся счёт для клиента. Сравните строки таблицы между собой и найдите метрику, которая растёт вместе с успехом клиента, а не против него.',
      'The model below compares four classic value metrics on one abstract product. Pick a metric with a button, set the number of customers, the price per unit and how many times the customer grows within a year. The counters and the table show current revenue, revenue in a year, and how predictable the bill stays for the customer. Compare the table rows and find the metric that grows with the customer’s success rather than against it.',
    ),
  },
  { id: 'valuemetric-model', kind: 'widget', step: 'practice', widget: 'product.valuemetric' });

const block: Block = {
  id: 'product',
  order: 991,
  hidden: true,
  title: bi('Как строят продукты в B2B и open source', 'How B2B and open-source products are built'),
  summary: bi(
    'Пилот скрытого раздела «Курсы»: тридцать принципов устройства продуктов в B2B и open source — от категории и выхода на рынок до стратегии открытого кода, цены и разборов компаний, с двумя интерактивными моделями. Это один из способов работы, не закон.',
    'A pilot of the hidden "Courses" section: thirty principles of building products in B2B and open source — from category and go-to-market to open-source strategy, pricing and company case studies, with two interactive models. One way of working, not a law.',
  ),
  checklistStep: null,
  levels: {
    beginner: bi('Строите первый продукт', 'Building your first product'),
    intermediate: bi('Ведёте продукт', 'Running a product'),
    experienced: bi('Отвечаете за направление', 'Owning a direction'),
  },
  hours: { beginner: 2.5, intermediate: 1.5, experienced: 1 },
  lessons: lessons.map((l) => l.id),
  sources: {
    en: [...new Map(lessons.flatMap((l) => l.sources.en).map((s) => [s.url, s])).values()],
    ru: [...new Map(lessons.flatMap((l) => l.sources.ru).map((s) => [s.url, s])).values()],
  },
  placement: [],
};

export default defineModule({
  blocks: [block],
  lessons,
  concepts: PRODUCT_CONCEPTS,
  quiz: PRODUCT_QUIZ,
  widgets: [opencoreWidget, valuemetricWidget],
});
