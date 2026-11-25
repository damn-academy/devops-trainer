// The platform catalog: professions and courses are the two structural units
// of the site. A profession is the big track (theory, practice, exams) that
// can lead to changing careers; a course is a smaller standalone unit that
// does not imply entering a profession. Hidden products stay reachable by
// direct link but do not appear on the catalog page.

import { bi, type Bi } from './i18n';
import type { Route } from './router';

export interface Product {
  kind: 'profession' | 'course';
  id: string;
  title: Bi;
  summary: Bi;
  hidden?: boolean;
  subtitle?: Bi;
  shelf?: 'business';
}

export const PRODUCTS: Product[] = [
  {
    kind: 'profession',
    id: 'devops',
    title: bi('DevOps-инженер', 'DevOps engineer'),
    summary: bi(
      'Профессия целиком: от первой команды в терминале до Kubernetes в облаке. Теория, практика на настоящих машинах, проверки уровня и экзамены.',
      'The whole profession: from your first command in the terminal to Kubernetes in the cloud. Theory, practice on real machines, level checks and exams.',
    ),
  },
  {
    "kind": "course",
    "id": "marketing",
    "title": {
      "ru": "Маркетинг инфраструктурного продукта",
      "en": "Infrastructure Product Marketing"
    },
    "summary": {
      "ru": "Как продвигать открытый инфраструктурный продукт среди инженеров и руководителей: позиционирование, площадки от LinkedIn и Reddit до Hacker News и Хабра, технический блог, поиск и ответы нейросетей, рассылки, свой подкаст, платная реклама и сайт. Все цифры и правила площадок — на конец 2026 года, со ссылками на источники. В конце курса вы проводите квартал в отделе маркетинга в симуляторе, где исход решений зависит и от вас, и от рынка.",
      "en": "How to promote an open infrastructure product to engineers and executives: positioning, platforms from LinkedIn and Reddit to Hacker News and Habr, a technical blog, search and AI answers, newsletters, your own podcast, paid advertising and websites. All figures and platform rules are current as of late 2026, with links to sources. The course ends with a simulated quarter in the marketing department, where outcomes depend on both you and the market."
    },
    "subtitle": {
      "ru": "Для маркетологов, основателей и инженеров DevRel компаний, которые делают Kubernetes-платформы, базы данных, сети и другую инфраструктуру.",
      "en": "For marketers, founders and DevRel engineers at companies building Kubernetes platforms, databases, networks and other infrastructure."
    },
    "shelf": "business",
    "hidden": true
  },
  {
    "kind": "course",
    "id": "sales",
    "title": {
      "ru": "Продажи",
      "en": "Sales"
    },
    "summary": {
      "ru": "Как продавать инфраструктуру крупным компаниям: сложная сделка и закупочный центр, типы компаний и регионы, тактика касаний и продажи силами основателя. Отдельный модуль Dream 100 учит вести сотню целевых компаний: учёт людей и отношений, сигналы и переходы, связку почты и личных сообщений, личные встречи на конференциях и в офисах и переезд основателя в США.",
      "en": "How to sell infrastructure to large companies: complex deals and buying centres, company types and regions, outreach tactics and founder-led sales. A separate Dream 100 module teaches you to manage a hundred target accounts: tracking people and relationships, signals and transitions, combining email and direct messages, meeting in person at conferences and offices, and a founder’s move to the US."
    },
    "subtitle": {
      "ru": "Для основателей и первых продавцов инфраструктурных компаний, которые продают сами.",
      "en": "For founders and early salespeople at infrastructure companies who sell themselves."
    },
    "shelf": "business",
    "hidden": true
  }
];

export const visibleProducts = (kind: Product['kind']): Product[] => PRODUCTS.filter((p) => p.kind === kind && !p.hidden);

export function productRoute(p: Product): Route {
  return p.kind === 'profession' ? { name: 'profession', id: p.id } : { name: 'course', id: p.id };
}

export function productById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

/** The first visible profession — pages that belong to a profession breadcrumb to it. */
export function defaultProfession(): Product | undefined {
  return visibleProducts('profession')[0];
}

export const BUSINESS_SHELF = {
  title: bi('Деловые курсы для инфраструктурных компаний', 'Business courses for infrastructure companies'),
  summary: bi('Курсы для тех, кто продвигает, продаёт и развивает открытый инфраструктурный продукт: каждый можно проходить отдельно, а вместе они складываются в работу компании от продукта до продаж', 'Courses for people who promote, sell and develop an open infrastructure product: each stands on its own, and together they cover a company’s work from product to sales'),
};
const BUSINESS_ORDER = ['marketing', 'sales', 'product', 'events', 'oss', 'strategy', 'pr', 'scithink'];
export function catalogGroups(products: Product[]): { title?: Bi; summary?: Bi; products: Product[] }[] {
  const ordinary = products.filter(p => !p.shelf);
  const business = products.filter(p => p.shelf === 'business').sort((a, b) => BUSINESS_ORDER.indexOf(a.id) - BUSINESS_ORDER.indexOf(b.id));
  return [...(ordinary.length ? [{ products: ordinary }] : []), ...(business.length ? [{ ...BUSINESS_SHELF, products: business }] : [])];
}
