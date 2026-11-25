import type { Bi } from '../../core/i18n';
import type { CourseModule } from '../../core/types';

export const METRICS_MODULES: CourseModule[] = [
  {
    "title": {
      "ru": "Как устроена метрика",
      "en": "How a metric is built"
    },
    "lessons": [
      "metrics.contract",
      "metrics.funnel"
    ]
  },
  {
    "title": {
      "ru": "Маркетинг",
      "en": "Marketing"
    },
    "lessons": [
      "metrics.attribution",
      "metrics.lift",
      "metrics.channels"
    ]
  },
  {
    "title": {
      "ru": "Продажи",
      "en": "Sales"
    },
    "lessons": [
      "metrics.pipeline",
      "metrics.forecast"
    ]
  },
  {
    "title": {
      "ru": "Повторяющаяся выручка и эффективность",
      "en": "Recurring revenue and efficiency"
    },
    "lessons": [
      "metrics.arr",
      "metrics.efficiency"
    ]
  },
  {
    "title": {
      "ru": "Продукт",
      "en": "Product"
    },
    "lessons": [
      "metrics.activation",
      "metrics.pqa",
      "metrics.usage"
    ]
  },
  {
    "title": {
      "ru": "Система метрик",
      "en": "The metrics system"
    },
    "lessons": [
      "metrics.dashboards",
      "metrics.truth",
      "metrics.stories"
    ]
  }
];

export const METRICS_SUMMARIES: Record<string, Bi> = {
  "metrics.contract": {
    "ru": "Десять полей определения метрики, единица анализа, когортная конверсия, незрелые наблюдения и осторожность с чужими бенчмарками.",
    "en": "The ten fields of a metric definition, unit of analysis, cohort conversion, immature observations and caution with external benchmarks."
  },
  "metrics.funnel": {
    "ru": "Сквозная воронка инфраструктурной компании: маршруты, события и знаменатели этапов, пример на сто тысяч посетителей и что делать с MQL.",
    "en": "An infrastructure company’s end-to-end funnel: routes, stage events and denominators, an example with a hundred thousand visitors and what to do with MQL."
  },
  "metrics.attribution": {
    "ru": "Приведённая и затронутая воронка сделок, модели распределения заслуг и самоотчёт покупателя.",
    "en": "Sourced and influenced pipeline, credit allocation models and buyer self-report."
  },
  "metrics.lift": {
    "ru": "Эксперименты с контрольной группой, инкрементальная стоимость привлечения и моделирование маркетингового микса.",
    "en": "Experiments with a control group, incremental acquisition cost and marketing mix modelling."
  },
  "metrics.channels": {
    "ru": "Доля поиска, брендовый поиск, полная стоимость привлечения по каналу и результат для каждого вида контента.",
    "en": "Share of search, branded search, fully loaded acquisition cost by channel and outcomes for each content type."
  },
  "metrics.pipeline": {
    "ru": "Стадии сделок как состояние покупателя, покрытие плана, скорость продаж, доли побед по количеству и сумме, цикл и переносы.",
    "en": "Opportunity stages as buyer states, target coverage, sales velocity, win rates by count and value, cycle duration and slippage."
  },
  "metrics.forecast": {
    "ru": "Категории прогноза, смещение и взвешенная ошибка, калибровка, выполнение планов и ёмкость отдела с учётом ввода продавцов.",
    "en": "Forecast categories, bias and weighted error, calibration, quota attainment and ramp-adjusted sales-team capacity."
  },
  "metrics.arr": {
    "ru": "ARR, подписания, счета, выручка и поступления, ACV, GRR и NRR, отток логотипов и мост повторяющейся выручки.",
    "en": "ARR, bookings, billings, revenue and cash collections, ACV, GRR and NRR, logo churn and the recurring revenue bridge."
  },
  "metrics.efficiency": {
    "ru": "Magic number, эффективность по ARR, стоимость привлечения, окупаемость по формуле и по когорте и ограничения LTV.",
    "en": "Magic number, ARR efficiency, acquisition cost, formula-based and cohort payback, and the limitations of LTV."
  },
  "metrics.activation": {
    "ru": "Три уровня активации, время до ценности вместе с долей неактивированных, когорты удержания и что считать активностью.",
    "en": "Three levels of activation, time to value alongside the nonactivation rate, retention cohorts and what counts as activity."
  },
  "metrics.pqa": {
    "ru": "Правило PQA, его точность и полнота, проверка эффекта продаж отложенной группой и телеметрия открытой версии без потери доверия.",
    "en": "The PQA rule, its precision and recall, testing sales impact with a holdout group and open-edition telemetry without losing trust."
  },
  "metrics.usage": {
    "ru": "Метрики выручки от потребления: обязательства, годовой темп, использование обязательства, разложение на объём и цену, метрики агентов.",
    "en": "Consumption revenue metrics: commitments, annualized run rate, commitment utilization, volume and price decomposition, and agent metrics."
  },
  "metrics.dashboards": {
    "ru": "Три ритма обзора, метрики для совета директоров, что стоит рядом с каждым числом и роли инструментов.",
    "en": "Three review cadences, board metrics, what belongs beside every number and the roles of tools."
  },
  "metrics.truth": {
    "ru": "Единый источник истины как договор о данных: таблицы, порядок внедрения, проверки качества, шаблон договора метрики и типовые ошибки.",
    "en": "A single source of truth as a data contract: tables, implementation order, quality checks, a metric contract template and common errors."
  },
  "metrics.stories": {
    "ru": "Шесть документированных историй компаний — Pulumi, Cognism, PostHog, Snowflake, Datadog, GitLab — и минимальный набор метрик для запуска.",
    "en": "Six documented company stories — Pulumi, Cognism, PostHog, Snowflake, Datadog, GitLab — and a minimum set of metrics to start with."
  }
};
