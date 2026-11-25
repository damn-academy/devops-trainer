import type { Bi } from '../../core/i18n';
import type { CourseModule } from '../../core/types';

export const FINANCE_MODULES: CourseModule[] = [
  {
    "title": {
      "ru": "Отчёты: прибыль, деньги и баланс",
      "en": "Statements: profit, cash and the balance sheet"
    },
    "lessons": [
      "finance.statements",
      "finance.cash-vs-profit"
    ]
  },
  {
    "title": {
      "ru": "Учёт и деньги",
      "en": "Bookkeeping and cash"
    },
    "lessons": [
      "finance.close",
      "finance.runway"
    ]
  },
  {
    "title": {
      "ru": "Метрики и модель",
      "en": "Metrics and the model"
    },
    "lessons": [
      "finance.metrics",
      "finance.model"
    ]
  },
  {
    "title": {
      "ru": "Раунды и выручка",
      "en": "Rounds and revenue"
    },
    "lessons": [
      "finance.safe",
      "finance.revenue"
    ]
  },
  {
    "title": {
      "ru": "Налоги США",
      "en": "US taxes"
    },
    "lessons": [
      "finance.taxes-federal",
      "finance.taxes-people"
    ]
  },
  {
    "title": {
      "ru": "Инструменты и ритм",
      "en": "Tools and cadence"
    },
    "lessons": [
      "finance.tools",
      "finance.automation",
      "finance.dashboard"
    ]
  }
];

export const FINANCE_SUMMARIES: Record<string, Bi> = {
  "finance.statements": {
    "ru": "Что показывают P&L, баланс и отчёт о движении денег, на сквозном примере вымышленной компании за двенадцать месяцев, с проводками и вопросами к каждой строке.",
    "en": "What the P&L, balance sheet and cash flow statement show, through a twelve-month worked example of a fictional company, with journal entries and questions for every line."
  },
  "finance.cash-vs-profit": {
    "ru": "Прямой и косвенный методы движения денег, почему прибыльная компания остаётся без денег и как разнести расходы между себестоимостью и операционными расходами.",
    "en": "Direct and indirect cash flow methods, why a profitable company runs out of cash, and how to allocate costs between cost of goods sold and operating expenses."
  },
  "finance.close": {
    "ru": "Кто что делает в учёте, закрытие месяца по дням, сверки, начисления, контроль платежей и хранение документов.",
    "en": "Who does what in bookkeeping, the day-by-day month-end close, reconciliations, accruals, payment controls and document retention."
  },
  "finance.runway": {
    "ru": "Как считать расход и запас хода, прогноз на тринадцать недель, сценарии, тест на выживание без раунда и где хранить деньги после краха SVB.",
    "en": "How to calculate burn and runway, a thirteen-week forecast, scenarios, a survival test without another round, and where to keep cash after the SVB collapse."
  },
  "finance.metrics": {
    "ru": "MRR, ARR, NRR, GRR, CAC, LTV, burn multiple и другие метрики с точными формулами, их ловушки и ориентиры 2026 года.",
    "en": "MRR, ARR, NRR, GRR, CAC, LTV, burn multiple and other metrics with precise formulas, their pitfalls and 2026 benchmarks."
  },
  "finance.model": {
    "ru": "Как устроить финансовую модель от плана найма, прогнозировать выручку от драйверов, сравнивать план с фактом и что показать инвестору.",
    "en": "How to build a financial model from a hiring plan, forecast revenue from drivers, compare budget with actuals, and decide what to show an investor."
  },
  "finance.safe": {
    "ru": "Таблица долей, конвертация post-money SAFE, пул опционов, ликвидационная привилегия, оценка 409A и отчёты инвесторам.",
    "en": "The cap table, post-money SAFE conversion, option pools, liquidation preferences, 409A valuations and investor reporting."
  },
  "finance.revenue": {
    "ru": "Пять вопросов ASC 606 на договорах инфраструктурной компании: подписки, внедрения, потребление, кредиты и растущие платежи.",
    "en": "The five ASC 606 questions applied to an infrastructure company’s contracts: subscriptions, implementation, usage, credits and escalating payments."
  },
  "finance.taxes-federal": {
    "ru": "Налоговый календарь, франшизный налог Делавэра, налог на прибыль при убытке, раздел 174 после закона 2025 года и налоговый кредит на разработку.",
    "en": "The tax calendar, Delaware franchise tax, income tax despite a loss, Section 174 after the 2025 law, and the research tax credit."
  },
  "finance.taxes-people": {
    "ru": "Обязанности перед штатами, налог с продаж на SaaS, подрядчики в США и за рубежом, налоги на зарплату, QSBS, 83(b) и аудит.",
    "en": "State obligations, sales tax on SaaS, US and foreign contractors, payroll taxes, QSBS, 83(b) and audits."
  },
  "finance.tools": {
    "ru": "Инструменты учёта, банка, счетов, модели, долей и зарплаты с ценами на конец 2026 года и минимальный набор на десять и сорок человек.",
    "en": "Tools for bookkeeping, banking, billing, modeling, equity and payroll, with late-2026 prices and a minimum stack for ten and forty people."
  },
  "finance.automation": {
    "ru": "Какие потоки автоматизировать, сверка Stripe, надёжный поток в таблицах и проверка обещаний «умной» бухгалтерии.",
    "en": "Which workflows to automate, Stripe reconciliation, a reliable spreadsheet workflow, and testing the promises of “smart” bookkeeping."
  },
  "finance.dashboard": {
    "ru": "Что смотреть каждую неделю, месяц и квартал, пороги для действий и план наведения порядка за первые 30 дней.",
    "en": "What to review weekly, monthly and quarterly, thresholds for action, and a plan to put finances in order in the first 30 days."
  }
};
