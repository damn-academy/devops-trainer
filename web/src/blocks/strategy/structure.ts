import type { Bi } from '../../core/i18n';
import type { CourseModule } from '../../core/types';

export const STRATEGY_MODULES: CourseModule[] = [
  {
    "title": {
      "ru": "Категория и рынок",
      "en": "Category and market"
    },
    "lessons": [
      "strategy.category",
      "strategy.market-events"
    ]
  },
  {
    "title": {
      "ru": "Экосистема",
      "en": "Ecosystem"
    },
    "lessons": [
      "strategy.ecosystem",
      "strategy.standards"
    ]
  },
  {
    "title": {
      "ru": "Нейросети и агенты",
      "en": "AI and agents"
    },
    "lessons": [
      "strategy.agents"
    ]
  }
];

export const STRATEGY_SUMMARIES: Record<string, Bi> = {
  "strategy.category": {
    "ru": "Как рынок учится называть задачу, которую решает ваш продукт, и что компания может для этого сделать.",
    "en": "How the market learns to name the problem your product solves and what the company can do to help."
  },
  "strategy.market-events": {
    "ru": "Что говорят данные об уходе с VMware и о суверенном облаке в Европе и как превратить эти события в предложение.",
    "en": "What the data says about leaving VMware and sovereign cloud in Europe, and how to turn these events into an offer."
  },
  "strategy.ecosystem": {
    "ru": "Встроенная дистрибуция, партнёры, комиссии маркетплейсов облаков и технологические альянсы.",
    "en": "Embedded distribution, partners, cloud marketplace fees and technology alliances."
  },
  "strategy.standards": {
    "ru": "Передача проекта в фонд, программы соответствия, сертификация специалистов, обучение и документация как стратегия на годы.",
    "en": "Transferring a project to a foundation, conformance programs, professional certification, training and documentation as a strategy for years to come."
  },
  "strategy.agents": {
    "ru": "Три роли нейросетей в пути покупателя инфраструктуры — советчик, исполнитель и канал — и как готовить продукт к каждой.",
    "en": "Three roles of AI in the infrastructure buyer journey—adviser, executor and channel—and how to prepare the product for each."
  }
};
