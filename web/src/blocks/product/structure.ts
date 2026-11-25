import type { Bi } from '../../core/i18n';
import type { CourseModule } from '../../core/types';

export const PRODUCT_MODULES: CourseModule[] = [
  {
    "title": {
      "ru": "Рынок и категория",
      "en": "Market and category"
    },
    "lessons": [
      "product.category",
      "product.chasm"
    ]
  },
  {
    "title": {
      "ru": "Рост, граница версий и цена",
      "en": "Growth, edition boundaries and pricing"
    },
    "lessons": [
      "product.gtm",
      "product.opencore",
      "product.oss",
      "product.pricing"
    ]
  },
  {
    "title": {
      "ru": "Первые минуты и интерфейсы",
      "en": "First minutes and interfaces"
    },
    "lessons": [
      "product.first-minutes",
      "product.interfaces"
    ]
  },
  {
    "title": {
      "ru": "Открытие продукта и приоритеты",
      "en": "Product discovery and priorities"
    },
    "lessons": [
      "product.discovery",
      "product.priorities",
      "product.roadmap",
      "product.signals"
    ]
  },
  {
    "title": {
      "ru": "Разборы компаний",
      "en": "Company case studies"
    },
    "lessons": [
      "product.cases"
    ]
  }
];

export const PRODUCT_SUMMARIES: Record<string, Bi> = {
  "product.cases": {
    "ru": "Восемь компаний — HashiCorp, GitLab, Grafana Labs, Elastic, MongoDB, Supabase, Neon и Docker: решения по годам, их цена, последствия и что из этого может повторить компания на двадцать–шестьдесят человек.",
    "en": "Eight companies — HashiCorp, GitLab, Grafana Labs, Elastic, MongoDB, Supabase, Neon and Docker: decisions over the years, their costs, consequences and what a company of twenty to sixty people can repeat."
  },
  "product.roadmap": {
    "ru": "Как вести открытую дорожную карту, чтобы она помогала пользователям планировать и не превращалась в список нарушенных обещаний.",
    "en": "How to maintain an open roadmap that helps users plan without turning into a list of broken promises."
  },
  "product.signals": {
    "ru": "Как собирать сигналы из issues, чата, звонков продаж, поддержки и данных продукта в непрерывное открытие; в конце — продуктовый квартал в симуляторе.",
    "en": "How to bring signals from issues, chat, sales calls, support and product data into continuous discovery; the lesson ends with a simulated product quarter."
  }
};
