import type { Bi } from '../../core/i18n';
import type { CourseModule } from '../../core/types';

export const STRATEGY_MODULES: CourseModule[] = [
  {
    "title": {
      "ru": "Категория",
      "en": "Category"
    },
    "lessons": [
      "strategy.category"
    ]
  },
  {
    "title": {
      "ru": "Рыночные события",
      "en": "Market events"
    },
    "lessons": [
      "strategy.market-events",
      "strategy.market-shifts",
      "strategy.sovereignty",
      "strategy.event-offer"
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
    "ru": "Четыре смены условий у крупных поставщиков — VMware, Terraform, Redis, Elasticsearch — и продление Oracle у конкретного клиента: какие предложения из этого выросли.",
    "en": "Four major vendors changing their terms—VMware, Terraform, Redis, Elasticsearch—and one customer’s Oracle renewal: the offers that grew out of them."
  },
  "strategy.market-shifts": {
    "ru": "События другого типа: стоимость наблюдаемости, возврат из облака, дефицит ускорителей, агенты и MCP, сбой CrowdStrike и Log4Shell.",
    "en": "Other kinds of events: observability costs, cloud repatriation, accelerator scarcity, agents and MCP, the CrowdStrike outage and Log4Shell."
  },
  "strategy.sovereignty": {
    "ru": "Четыре региональные модели суверенной инфраструктуры и досье из восьми проверяемых свойств для своего продукта.",
    "en": "Four regional models of sovereign infrastructure and an eight-property dossier to check your own product against."
  },
  "strategy.event-offer": {
    "ru": "Метод в семь шагов от новости к проверенному предложению: повод у аккаунтов, три гипотезы, карточка проверки, экономика для клиента и критерии остановки.",
    "en": "A seven-step method from news to a tested offer: account-level triggers, three hypotheses, a test card, customer economics and stop criteria."
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
