import type { Bi } from '../../core/i18n';
import type { CourseModule } from '../../core/types';
import { SALES_LESSONS } from './content';

// Preserve the six approved pilot modules, then append Dream 100 and the partner module.
export const SALES_MODULES: CourseModule[] = [
  ...SALES_LESSONS.map(l => ({ title: l.title, lessons: [l.id] })),
  { title: { ru: 'Dream 100', en: 'Dream 100' }, lessons: ["sales.d100-tracking", "sales.d100-signals", "sales.d100-sequence", "sales.d100-presence", "sales.d100-inperson", "sales.d100-us"] },
  { title: { ru: 'Партнёры и интеграторы', en: 'Partners and integrators' }, lessons: ['sales.partner-deal'] },
];

export const PARTNER_SUMMARIES: Record<string, Bi> = {
  'sales.partner-deal': {
    ru: 'Разбор сделки поставщик — интегратор — заказчик по шагам: деньги интегратора, регистрация сделки, второй партнёр, звонок заказчика напрямую и разделение поддержки; в конце — план вашей сделки через партнёра.',
    en: 'A vendor–integrator–customer deal walked through step by step: the integrator’s money, deal registration, a second partner, a direct call from the customer and the split of support; ends with the plan for your own deal through a partner.',
  },
};

export const DREAM100_SUMMARIES: Record<string, Bi> = {
  "sales.d100-tracking": {
    "ru": "Как вести сотню целевых компаний: восемь таблиц, уровни, стадии отношений и еженедельный разбор за сорок пять минут.",
    "en": "How to manage a hundred target companies: eight tables, tiers, relationship stages and a forty-five-minute weekly review."
  },
  "sales.d100-signals": {
    "ru": "Переходы людей, вакансии, деньги и активность в открытом коде как поводы для разговора, и где сигнал оказывается шумом.",
    "en": "Job changes, vacancies, funding and open-source activity as reasons to start a conversation, and where a signal turns out to be noise."
  },
  "sales.d100-sequence": {
    "ru": "Как связать почту, LinkedIn, телефон, видео и подарки в трёхнедельный ритм, который уважает время человека, и какие правила и законы за этим стоят.",
    "en": "How to combine email, LinkedIn, phone, video and gifts into a three-week rhythm that respects people’s time, and the rules and laws behind it."
  },
  "sales.d100-presence": {
    "ru": "Как оказаться там, где бывает нужный человек, и заслужить доверие, не переходя границу между настойчивостью и преследованием.",
    "en": "How to be where the right person spends time and earn trust without crossing the line between persistence and stalking."
  },
  "sales.d100-inperson": {
    "ru": "Как готовить встречи на конференциях, попадать с рабочей сессией в офис компании и находить местные сообщества в городах США.",
    "en": "How to prepare conference meetings, arrange a working session at a company’s office and find local communities in US cities."
  },
  "sales.d100-us": {
    "ru": "Что меняет переезд основателя в США, как проверить это решение до переезда и как построить первые контакты без сети знакомств; в конце — симулятор Dream 100.",
    "en": "What a founder’s move to the US changes, how to test the decision before moving and how to build initial contacts without an existing network; ends with the Dream 100 simulator."
  }
};
