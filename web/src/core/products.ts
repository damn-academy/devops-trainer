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
      "ru": "Как продавать инфраструктуру крупным компаниям: сложная сделка и закупочный центр, типы компаний и регионы, тактика касаний и продажи силами основателя. Отдельный модуль Dream 100 учит вести сотню целевых компаний: учёт людей и отношений, сигналы и переходы, связку почты и личных сообщений, личные встречи на конференциях и в офисах и переезд основателя в США. Модуль о партнёрах разбирает по шагам сделку через интегратора: деньги партнёра, регистрацию сделки, конфликты каналов и разделение поддержки.",
      "en": "How to sell infrastructure to large companies: complex deals and buying centres, company types and regions, outreach tactics and founder-led sales. A separate Dream 100 module teaches you to manage a hundred target accounts: tracking people and relationships, signals and transitions, combining email and direct messages, meeting in person at conferences and offices, and a founder’s move to the US. The partner module walks through a deal via an integrator step by step: the partner’s money, deal registration, channel conflicts and the split of support."
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
    "id": "metrics",
    "title": {
      "ru": "Метрики маркетинга, продаж и продукта",
      "en": "Marketing, sales and product metrics"
    },
    "card": {
      "ru": "Как считать воронку, атрибуцию, прогноз, ARR, удержание и активацию так, чтобы все отделы получали одинаковые числа.",
      "en": "How to calculate the funnel, attribution, forecasts, ARR, retention and activation so that every department gets the same numbers."
    },
    "summary": {
      "ru": "Сквозной курс о метриках инфраструктурной компании с открытой версией, облачным сервисом и отделом продаж: определения и когорты, воронка от посетителя до расширения, атрибуция и эксперименты, воронка сделок и прогноз, повторяющаяся выручка и эффективность роста, активация, PQA и выручка от потребления, дашборды и единый источник истины. Все формулы показаны на сквозных учебных примерах, а публичные цифры компаний разобраны по первоисточникам.",
      "en": "An end-to-end course on metrics for an infrastructure company with an open edition, a cloud service and a sales team: definitions and cohorts, the funnel from visitor to expansion, attribution and experiments, sales pipeline and forecasting, recurring revenue and growth efficiency, activation, PQA and consumption revenue, dashboards and a single source of truth. Every formula is illustrated through connected teaching examples, and public company figures are examined using primary sources."
    },
    "subtitle": {
      "ru": "Для маркетологов, руководителей продаж, продакт-менеджеров, аналитиков и основателей.",
      "en": "For marketers, sales leaders, product managers, analysts and founders."
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
    "card": { "ru": "Портфель событий под профиль клиента, вебинары, митапы, доклады, своя конференция и стенд, и окупилось ли это.", "en": "An event portfolio built on the customer profile, webinars, meetups, talks, your own conference and booth, and whether it paid off." },
    "summary": {
      "ru": "Как получать пользу от событий в любом сегменте инфраструктуры: портфель площадок от конференций облачных провайдеров и отраслевых событий вроде PGConf, SREcon, RSAC и NANOG до пользовательских конференций вендоров и местных сообществ, вебинары, онлайн-воркшопы с лабораторией, митапы как ежедневная работа, заявки и доклады, своя конференция очно и онлайн, что фонды дают проекту для событий, работа на стенде и конференция без стенда. Отдельно — как считать, окупилось ли событие, и почему число сканов бейджей ничего не говорит. В конце — подготовка к KubeCon за восемь недель в симуляторе.",
      "en": "How to benefit from events in any infrastructure segment: a portfolio of venues from cloud provider conferences and industry events such as PGConf, SREcon, RSAC and NANOG to vendor user conferences and local communities, webinars, online workshops with labs, meetups as daily work, proposals and talks, running your own conference in person and online, what foundations offer a project for events, staffing a booth and attending a conference without one. A separate focus is calculating whether an event paid off and why badge scan counts tell you nothing. The course ends with eight weeks of KubeCon preparation in a simulator."
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
    "card": { "ru": "Управление открытым проектом, сообщество, выбор фонда и его стоимость, кризисы. В конце — год в инкубаторе.", "en": "Governing an open project, community, choosing a foundation and its cost, crises. Ends with a year in the incubator." },
    "summary": {
      "ru": "Как развивать открытый проект, который создала или поддерживает компания: модели заработка и уроки смены лицензий, управление проектом и нейтральность, участники и менторство, сообщество, выбор юридического дома проекта среди фондов — ASF, Linux Foundation и её отраслевых фондов, Eclipse, NumFOCUS, Conservancy, — права и стоимость передачи на три года, уровни зрелости и льготы на примере CNCF, сигналы использования и кризисы. В конце — год проекта в инкубаторе CNCF в симуляторе.",
      "en": "How to develop an open project created or supported by a company: revenue models and lessons from license changes, project governance and neutrality, contributors and mentorship, community, choosing a legal home for the project among foundations—ASF, the Linux Foundation and its sub-foundations, Eclipse, NumFOCUS, Conservancy—the rights and three-year cost of a transfer, maturity levels and benefits using CNCF as the example, usage signals and crises. The course ends with a simulated year for a project in the CNCF incubator."
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
    "id": "finance",
    "shelf": "business",
    "title": {
      "ru": "Финансы и учёт для основателя",
      "en": "Finance for founders"
    },
    "card": {
      "ru": "Отчёты, деньги, метрики, модель, раунды и налоги американского стартапа на одном сквозном примере с таблицами и калькуляторами.",
      "en": "Statements, cash, metrics, modeling, funding rounds and US startup taxes through one worked example with spreadsheets and calculators."
    },
    "summary": {
      "ru": "Финансы американского стартапа для основателя без финансового образования: P&L, баланс и движение денег на сквозном примере, закрытие месяца и контроль, прогноз денег на тринадцать недель, метрики подписочного бизнеса, финансовая модель от найма, SAFE и пул опционов, признание выручки, федеральные налоги, Делавэр и штаты, инструменты, автоматизация и дашборд основателя.",
      "en": "US startup finance for founders without a finance background: P&L, balance sheet and cash flow through a worked example, month-end close and controls, a thirteen-week cash forecast, subscription business metrics, a hiring-driven financial model, SAFEs and option pools, revenue recognition, federal, Delaware and state taxes, tools, automation and the founder’s dashboard."
    },
    "subtitle": {
      "ru": "Для основателей и операционных директоров американских стартапов, которые хотят понимать свои цифры без бухгалтерского образования.",
      "en": "For founders and COOs of US startups who want to understand their numbers without an accounting background."
    }
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
    "id": "aicontent",
    "title": {
      "ru": "Нейросети в производстве контента",
      "en": "AI in content production"
    },
    "card": {
      "ru": "Как делать статьи, видео, подкасты, ботов и интерактив с нейросетями: брифы, исследования, редактура, проверки и публикация на реальных проектах.",
      "en": "How to create articles, videos, podcasts, bots and interactive content with AI: briefs, research, editing, checks and publishing on real projects."
    },
    "summary": {
      "ru": "Как производить контент с нейросетями так, чтобы его не было стыдно публиковать: роли редактора и нейросетей, брифы и журналы, исследование до текста, редактура и проверки, иллюстрации, видео и звук, превращение записи в статью, боты и интерактивные материалы, публикация, правила площадок и инструменты. Курс построен на реальных проектах: учебной платформе, музыкальных лонгридах, техническом подкасте и статьях для Хабра.",
      "en": "How to produce content with AI that you can be proud to publish: the roles of editors and AI, briefs and logs, research before writing, editing and checks, illustrations, video and audio, turning recordings into articles, bots and interactive material, publishing, platform rules and tools. The course is built on real projects: a learning platform, music longreads, a technical podcast and Habr articles."
    },
    "subtitle": {
      "ru": "Для редакторов, контент-маркетологов, авторов технических блогов и продюсеров видео и подкастов.",
      "en": "For editors, content marketers, technical bloggers and video and podcast producers."
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
const BUSINESS_ORDER = ['marketing', 'sales', 'product', 'metrics', 'events', 'oss', 'strategy', 'finance', 'pr', 'aicontent', 'scithink'];
export function catalogGroups(products: Product[]): { title?: Bi; summary?: Bi; products: Product[] }[] {
  const ordinary = products.filter(p => !p.shelf);
  const business = products.filter(p => p.shelf === 'business').sort((a, b) => BUSINESS_ORDER.indexOf(a.id) - BUSINESS_ORDER.indexOf(b.id));
  return [...(ordinary.length ? [{ products: ordinary }] : []), ...(business.length ? [{ ...BUSINESS_SHELF, products: business }] : [])];
}
