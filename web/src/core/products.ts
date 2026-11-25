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
  /** A short line for the catalog card; the full summary stays for page descriptions. */
  card?: Bi;
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
    "card": { "ru": "Позиционирование, площадки от LinkedIn до Хабра, блог, поиск, рассылки и реклама. В конце — квартал в отделе маркетинга.", "en": "Positioning, platforms from LinkedIn to Habr, a blog, search, newsletters and ads. Ends with a quarter in a marketing department." },
    "summary": {
      "ru": "Как продвигать открытый инфраструктурный продукт среди инженеров и руководителей: позиционирование, площадки от LinkedIn и Reddit до Hacker News и Хабра, технический блог, поиск и ответы нейросетей, рассылки, свой подкаст, платная реклама и сайт. Все цифры и правила площадок — на конец 2026 года, со ссылками на источники. В конце курса вы проводите квартал в отделе маркетинга в симуляторе, где исход решений зависит и от вас, и от рынка.",
      "en": "How to promote an open infrastructure product to engineers and executives: positioning, platforms from LinkedIn and Reddit to Hacker News and Habr, a technical blog, search and AI answers, newsletters, your own podcast, paid advertising and websites. All figures and platform rules are current as of late 2026, with links to sources. The course ends with a simulated quarter in the marketing department, where outcomes depend on both you and the market."
    },
    "subtitle": {
      "ru": "Для маркетологов, основателей и инженеров DevRel компаний, которые делают Kubernetes-платформы, базы данных, сети и другую инфраструктуру.",
      "en": "For marketers, founders and DevRel engineers at companies building Kubernetes platforms, databases, networks and other infrastructure."
    },
    "shelf": "business"
  },
  {
    "kind": "course",
    "id": "sales",
    "title": {
      "ru": "Продажи",
      "en": "Sales"
    },
    "card": { "ru": "Сложная сделка, закупочный центр, регионы и Dream 100: как основателю продавать инфраструктуру крупным компаниям.", "en": "Complex deals, the buying centre, regions and Dream 100: how a founder sells infrastructure to large companies." },
    "summary": {
      "ru": "Как продавать инфраструктуру крупным компаниям: сложная сделка и закупочный центр, типы компаний и регионы, тактика касаний и продажи силами основателя. Отдельный модуль Dream 100 учит вести сотню целевых компаний: учёт людей и отношений, сигналы и переходы, связку почты и личных сообщений, личные встречи на конференциях и в офисах и переезд основателя в США.",
      "en": "How to sell infrastructure to large companies: complex deals and buying centres, company types and regions, outreach tactics and founder-led sales. A separate Dream 100 module teaches you to manage a hundred target accounts: tracking people and relationships, signals and transitions, combining email and direct messages, meeting in person at conferences and offices, and a founder’s move to the US."
    },
    "subtitle": {
      "ru": "Для основателей и первых продавцов инфраструктурных компаний, которые продают сами.",
      "en": "For founders and early salespeople at infrastructure companies who sell themselves."
    },
    "shelf": "business"
  },
  {
    "kind": "course",
    "id": "product",
    "title": {
      "ru": "Продукт",
      "en": "Product"
    },
    "card": { "ru": "Категория, граница открытой и платной версии, цена и сигналы сообщества. В конце — продуктовый квартал.", "en": "Category, the open and paid boundary, pricing and community signals. Ends with a product quarter." },
    "summary": {
      "ru": "Как управлять продуктом, вокруг которого есть открытый проект и сообщество: категория и клин, двигатели роста, граница открытой и платной версии, путь от ранних пользователей к прагматикам, первые минуты с продуктом, документация, непрерывное открытие продукта, открытая дорожная карта и сигналы сообщества. В конце — продуктовый квартал в симуляторе.",
      "en": "How to manage a product with an open project and community around it: category and wedge, growth engines, the boundary between open and paid editions, the journey from early adopters to pragmatists, the first minutes with the product, documentation, continuous product discovery, an open roadmap and community signals. The course ends with a simulated product quarter."
    },
    "subtitle": {
      "ru": "Для продуктовых менеджеров и технических основателей инфраструктурных и open-source продуктов.",
      "en": "For product managers and technical founders of infrastructure and open-source products."
    },
    "shelf": "business"
  },
  {
    "kind": "course",
    "id": "events",
    "title": {
      "ru": "События и выступления",
      "en": "Events and talks"
    },
    "card": { "ru": "Вебинары, митапы, доклады на KubeCon, своя конференция и стенд, и как понять, окупилось ли событие.", "en": "Webinars, meetups, KubeCon talks, your own conference and booth, and how to tell whether an event paid off." },
    "summary": {
      "ru": "Как получать пользу от событий: вебинары, онлайн-воркшопы с лабораторией, митапы и Kubernetes Community Days как ежедневная работа, заявки и доклады на KubeCon, своя конференция очно и онлайн, что CNCF даёт проекту для событий, работа на стенде и конференция без стенда. Отдельно — как считать, окупилось ли событие, и почему число сканов бейджей ничего не говорит. В конце — подготовка к KubeCon за восемь недель в симуляторе.",
      "en": "How to benefit from events: webinars, online workshops with labs, meetups and Kubernetes Community Days as daily work, proposals and talks at KubeCon, running your own conference in person and online, what CNCF offers a project for events, staffing a booth and attending a conference without one. A separate focus is calculating whether an event paid off and why badge scan counts tell you nothing. The course ends with eight weeks of KubeCon preparation in a simulator."
    },
    "subtitle": {
      "ru": "Для DevRel, маркетологов, основателей и инженеров-докладчиков.",
      "en": "For DevRel professionals, marketers, founders and engineers who give talks."
    },
    "shelf": "business"
  },
  {
    "kind": "course",
    "id": "oss",
    "title": {
      "ru": "Open source: проект, сообщество и управление",
      "en": "Open source: project, community and governance"
    },
    "card": { "ru": "Управление открытым проектом, сообщество, путь в CNCF и кризисы. В конце — год проекта в инкубаторе.", "en": "Governing an open project, community, the CNCF path and crises. Ends with a year in the incubator." },
    "summary": {
      "ru": "Как развивать открытый проект, который создала или поддерживает компания: модели заработка и уроки смены лицензий, управление проектом и нейтральность, участники и менторство, сообщество, путь в CNCF от Sandbox до Graduated, что фонд даёт проектам и компаниям-членам, сигналы использования и кризисы. В конце — год проекта в инкубаторе CNCF в симуляторе.",
      "en": "How to develop an open project created or supported by a company: revenue models and lessons from license changes, project governance and neutrality, contributors and mentorship, community, the CNCF journey from Sandbox to Graduated, what the foundation offers projects and member companies, usage signals and crises. The course ends with a simulated year for a project in the CNCF incubator."
    },
    "subtitle": {
      "ru": "Для мейнтейнеров, основателей и руководителей сообщества открытых инфраструктурных проектов.",
      "en": "For maintainers, founders and community leaders of open infrastructure projects."
    },
    "shelf": "business"
  },
  {
    "kind": "course",
    "id": "strategy",
    "title": {
      "ru": "Стратегия и экосистема",
      "en": "Strategy and ecosystem"
    },
    "card": { "ru": "Категория, рыночные события от смены лицензий до суверенности, партнёры, стандарты и агенты.", "en": "Category, market events from license changes to sovereignty, partners, standards and agents." },
    "summary": {
      "ru": "Долгая стратегия инфраструктурной компании: как рынок учится называть вашу задачу, как превращать рыночные события в проверенные предложения — смены лицензий и условий у VMware, Oracle, Terraform, Redis и Elasticsearch, стоимость наблюдаемости, возврат из облака, дефицит ускорителей, агенты, инциденты доверия и суверенная инфраструктура в разных регионах, — встроенная дистрибуция и партнёры, комиссии маркетплейсов облаков, стандарты, сертификация и обучение, нейросети и агенты как советчики и исполнители.",
      "en": "The long-term strategy of an infrastructure company: how the market learns to name your problem, how to turn market events into tested offers—license and term changes at VMware, Oracle, Terraform, Redis and Elasticsearch, observability costs, cloud repatriation, accelerator scarcity, agents, trust incidents and sovereign infrastructure across regions—embedded distribution and partners, cloud marketplace fees, standards, certification and training, AI and agents as advisers and executors."
    },
    "subtitle": {
      "ru": "Для основателей и руководителей, которые отвечают за положение компании на рынке на годы вперёд.",
      "en": "For founders and executives responsible for the company’s position in the market for years to come."
    },
    "shelf": "business"
  },
  {
    "kind": "course",
    "id": "pr",
    "title": {
      "ru": "PR и коммуникации",
      "en": "PR and communications"
    },
    "card": { "ru": "Аналитики и пресса, первые сутки кризиса и публичность основателя. В конце — неделя кризиса.", "en": "Analysts and the press, the first day of a crisis and the founder in public. Ends with a crisis week." },
    "summary": {
      "ru": "Как работать с аналитиками и прессой и проходить кризисы: брифинги Gartner и правила цитирования, когда пресс-релиз полезен и сколько стоит рассылка, эксклюзивы и эмбарго, первые сутки кризиса и первое заявление, публичность основателя. В конце — неделя кризиса в симуляторе.",
      "en": "How to work with analysts and the press and navigate crises: Gartner briefings and citation rules, when a press release is useful and how much distribution costs, exclusives and embargoes, the first twenty-four hours of a crisis and the first statement, founder visibility. The course ends with a week of crisis in the simulator."
    },
    "subtitle": {
      "ru": "Для тех, кто говорит от имени компании: основателей, руководителей маркетинга и пресс-служб.",
      "en": "For people who speak on behalf of the company: founders, marketing leaders and press teams."
    },
    "shelf": "business"
  },
  {
    "kind": "course",
    "id": "scithink",
    "title": {
      "ru": "Научное мышление",
      "en": "Scientific thinking"
    },
    "card": { "ru": "Как отличить доказательство от убедительной истории: частоты, причины, исследования и цифры.", "en": "How to tell evidence from a convincing story: base rates, causes, studies and numbers." },
    "summary": {
      "ru": "Как проверять утверждения и не обманываться: уверенность и проверка, базовая ставка, совпадение и причина, исследования в новостях, калибровка собственных оценок, байесовский пересчёт, фейки, манипуляции с цифрами и почему эксперты промахиваются. Курс пригодится каждому, кто читает отчёты, бенчмарки и чужие случаи успеха.",
      "en": "How to check claims and avoid fooling yourself: confidence versus checking, base rates, coincidence and cause, studies in the news, calibrating your own estimates, Bayesian updating, fakes, number tricks and why experts miss. Useful to anyone who reads reports, benchmarks and other people's success stories."
    },
    "subtitle": {
      "ru": "Для всех, кто принимает решения по данным и хочет отличать доказательство от убедительной истории.",
      "en": "For anyone who makes decisions from data and wants to tell evidence from a persuasive story."
    },
    "shelf": "business"
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
  summary: bi('Курсы для тех, кто продвигает, продаёт и развивает открытый инфраструктурный продукт: каждый можно проходить отдельно, а вместе они складываются в работу компании от продукта до продаж.', 'Courses for people who promote, sell and develop an open infrastructure product: each stands on its own, and together they cover a company’s work from product to sales'),
};
const BUSINESS_ORDER = ['marketing', 'sales', 'product', 'events', 'oss', 'strategy', 'pr', 'scithink'];
export function catalogGroups(products: Product[]): { title?: Bi; summary?: Bi; products: Product[] }[] {
  const ordinary = products.filter(p => !p.shelf);
  const business = products.filter(p => p.shelf === 'business').sort((a, b) => BUSINESS_ORDER.indexOf(a.id) - BUSINESS_ORDER.indexOf(b.id));
  return [...(ordinary.length ? [{ products: ordinary }] : []), ...(business.length ? [{ ...BUSINESS_SHELF, products: business }] : [])];
}
