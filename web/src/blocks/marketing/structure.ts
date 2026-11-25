import type { Bi } from '../../core/i18n';
import type { CourseModule } from '../../core/types';

export const MARKETING_MODULES: CourseModule[] = [
  {
    "title": {
      "ru": "Фундамент: категория, покупатель и данные о покупателях",
      "en": "Foundations: category, buyer and buyer research"
    },
    "lessons": [
      "marketing.fundamentals",
      "marketing.vaccine"
    ]
  },
  {
    "title": {
      "ru": "Контент и технический блог",
      "en": "Content and the technical blog"
    },
    "lessons": [
      "marketing.content",
      "marketing.blog-formats",
      "marketing.blog-distribution"
    ]
  },
  {
    "title": {
      "ru": "Площадки",
      "en": "Platforms"
    },
    "lessons": [
      "marketing.platforms",
      "marketing.platforms-map",
      "marketing.platforms-linkedin",
      "marketing.platforms-x-bluesky",
      "marketing.platforms-youtube",
      "marketing.platforms-reddit",
      "marketing.platforms-hn",
      "marketing.platforms-syndication",
      "marketing.platforms-github",
      "marketing.platforms-media",
      "marketing.platforms-ru"
    ]
  },
  {
    "title": {
      "ru": "Поиск и ответы нейросетей",
      "en": "Search and AI answers"
    },
    "lessons": [
      "marketing.search-changes",
      "marketing.search-llm",
      "marketing.search-docs"
    ]
  },
  {
    "title": {
      "ru": "Видео и собственный подкаст",
      "en": "Video and your own podcast"
    },
    "lessons": [
      "marketing.video",
      "marketing.podcast-own"
    ]
  },
  {
    "title": {
      "ru": "Рассылки",
      "en": "Email newsletters"
    },
    "lessons": [
      "marketing.email-newsletter"
    ]
  },
  {
    "title": {
      "ru": "Платное продвижение",
      "en": "Paid promotion"
    },
    "lessons": [
      "marketing.paid"
    ]
  },
  {
    "title": {
      "ru": "Сайт компании и сайт проекта",
      "en": "The company website and the project website"
    },
    "lessons": [
      "marketing.site"
    ]
  },
  {
    "title": {
      "ru": "Open source, события и аналитика",
      "en": "Open source, events and analytics"
    },
    "lessons": [
      "marketing.community",
      "marketing.events",
      "marketing.analytics"
    ]
  },
  {
    "title": {
      "ru": "Регионы и разборы компаний",
      "en": "Regions and company case studies"
    },
    "lessons": [
      "marketing.regions",
      "marketing.cases"
    ]
  },
  {
    "title": {
      "ru": "Симулятор",
      "en": "Simulator"
    },
    "lessons": [
      "marketing.sim-quarter"
    ]
  }
];

export const MARKETING_SUMMARIES: Record<string, Bi> = {
  "marketing.fundamentals": {
    "ru": "Шесть принципов, из которых собирается маркетинг инфраструктурного продукта: категория, портрет покупателя, слова клиента, три разные работы маркетинга, длинная воронка и распространение.",
    "en": "Six principles that make up infrastructure product marketing: category, buyer profile, customer language, three distinct marketing jobs, the long funnel and distribution."
  },
  "marketing.vaccine": {
    "ru": "Что исследования покупателей говорят о росте брендов и почему популярные советы о «прогреве» и лояльности работают хуже, чем обещают.",
    "en": "What buyer research says about brand growth and why popular advice about nurturing and loyalty delivers less than it promises."
  },
  "marketing.content": {
    "ru": "Шесть принципов о контенте как активе: технические материалы, ответы на вопросы, страницы сравнения, документация и мнение, которое нельзя скопировать.",
    "en": "Six principles of content as an asset: technical material, answers to questions, comparison pages, documentation and an opinion that cannot be copied."
  },
  "marketing.blog-formats": {
    "ru": "Какие форматы постов читают годами — собственные данные, разборы аварий, бенчмарки, рассказы о трудной работе — и как получать их от инженеров без потери вечеров.",
    "en": "Which post formats stay relevant for years—original data, incident analyses, benchmarks and stories of difficult work—and how to get them from engineers without sacrificing evenings."
  },
  "marketing.blog-distribution": {
    "ru": "Как распространять каждый пост, превращать читателей в подписчиков через RSS и почту и что записывать о каждом посте.",
    "en": "How to distribute every post, turn readers into subscribers through RSS and email, and what to record about each post."
  },
  "marketing.platforms": {
    "ru": "Пять принципов о площадках, где собирается профессия, как введение в модуль.",
    "en": "Five principles about platforms where the profession gathers, as an introduction to the module."
  },
  "marketing.platforms-map": {
    "ru": "Как выбрать две-три площадки под роли людей из портрета покупателя и почему одна новость, разосланная всюду, проигрывает почти везде.",
    "en": "How to choose two or three platforms for the roles in your buyer profile and why broadcasting one announcement everywhere loses almost everywhere."
  },
  "marketing.platforms-linkedin": {
    "ru": "Как устроена лента LinkedIn после перестройки в марте 2026 года, чем личная страница отличается от страницы компании и какие форматы доходят до руководителей.",
    "en": "How the LinkedIn feed works after the March 2026 overhaul, how a personal profile differs from a company page, and which formats reach executives."
  },
  "marketing.platforms-x-bluesky": {
    "ru": "Что изменилось в X, куда ушла часть инженеров и как работать сразу в X, Bluesky и Mastodon.",
    "en": "What changed on X, where some engineers moved, and how to work across X, Bluesky and Mastodon."
  },
  "marketing.platforms-youtube": {
    "ru": "Почему техническая демонстрация на YouTube набирает зрителей медленно и долго и что сделал канал Tailscale.",
    "en": "Why a technical demonstration on YouTube gains viewers slowly over a long period and what the Tailscale channel did."
  },
  "marketing.platforms-reddit": {
    "ru": "Как устроены сообщества Reddit с их правилами о самопродвижении и почему ответ на чужой вопрос работает лучше объявления.",
    "en": "How Reddit communities and their rules on self-promotion work, and why answering someone else’s question works better than an announcement."
  },
  "marketing.platforms-hn": {
    "ru": "Правила Show HN, что на самом деле приносит первая страница Hacker News и как устроен Lobsters.",
    "en": "The Show HN rules, what the Hacker News front page actually delivers, and how Lobsters works."
  },
  "marketing.platforms-syndication": {
    "ru": "Что изменилось в 2025–2026 годах на dev.to, Medium, Hashnode, Substack и daily.dev и как перепечатывать статьи с канонической ссылкой.",
    "en": "What changed on dev.to, Medium, Hashnode, Substack and daily.dev in 2025–2026 and how to republish articles with a canonical link."
  },
  "marketing.platforms-github": {
    "ru": "README и релизы как главная страница проекта, Quora и Stack Overflow сегодня и правила чатов Kubernetes и CNCF.",
    "en": "README files and releases as a project’s front page, Quora and Stack Overflow today, and the rules of Kubernetes and CNCF chats."
  },
  "marketing.platforms-media": {
    "ru": "Как попасть в отраслевые медиа и в чужие подкасты без пиар-агентства.",
    "en": "How to get into industry media and other people’s podcasts without a PR agency."
  },
  "marketing.platforms-ru": {
    "ru": "Хабр, Telegram и русскоязычные конференции: правила, цены и что известно о результатах.",
    "en": "Habr, Telegram and Russian-language conferences: rules, prices and what is known about results."
  },
  "marketing.search-changes": {
    "ru": "Как ответы нейросетей над ссылками изменили переходы из поиска и как читать исследования Pew, Ahrefs и Seer, не делая неверных выводов.",
    "en": "How AI answers above links changed search traffic and how to read Pew, Ahrefs and Seer research without drawing false conclusions."
  },
  "marketing.search-llm": {
    "ru": "Откуда нейросети берут сведения о продукте, что показывают эксперименты и как честно исправить неверное описание.",
    "en": "Where AI systems get product information, what experiments show, and how to correct an inaccurate description honestly."
  },
  "marketing.search-docs": {
    "ru": "Документация как главный поисковый актив проекта, роботы нейросетей, llms.txt, разметка и проверка сайта перед выпуском.",
    "en": "Documentation as a project’s main search asset, AI crawlers, llms.txt, structured data and pre-release website checks."
  },
  "marketing.video": {
    "ru": "Четыре принципа о демонстрациях, докладах, коротких роликах и подкастах как введение в модуль.",
    "en": "Four principles about demos, talks, short videos and podcasts, as an introduction to the module."
  },
  "marketing.podcast-own": {
    "ru": "Зачем инфраструктурной компании свой подкаст, где его публиковать в 2026 году, на чём записывать и как пережить первые семь выпусков.",
    "en": "Why an infrastructure company needs its own podcast, where to publish it in 2026, what to record it with, and how to survive the first seven episodes."
  },
  "marketing.email-newsletter": {
    "ru": "Три вида писем компании, цифры, которые ещё что-то значат, требования Gmail и Yahoo и согласие подписчиков.",
    "en": "Three types of company email, numbers that still mean something, Gmail and Yahoo requirements, and subscriber consent."
  },
  "marketing.paid": {
    "ru": "Какие платные каналы работают для инфраструктурного продукта, сколько они стоят и как проверить, что деньги принесли что-то кроме кликов.",
    "en": "Which paid channels work for an infrastructure product, what they cost, and how to check whether the money delivered anything beyond clicks."
  },
  "marketing.site": {
    "ru": "Как разделить обязанности сайта компании и нейтрального сайта открытого проекта и как вести человека от документации до разговора.",
    "en": "How to divide responsibilities between the company website and a neutral open-project website and guide people from documentation to a conversation."
  },
  "marketing.community": {
    "ru": "Семь принципов об открытом коде и сообществе; подробно эта тема разобрана в курсе «Open source: проект, сообщество и управление».",
    "en": "Seven principles about open source and community; this topic is covered in depth in the course “Open source: project, community and governance”."
  },
  "marketing.events": {
    "ru": "Пять принципов о вебинарах, воркшопах и конференциях; подробно эта тема разобрана в курсе «События и выступления».",
    "en": "Five principles about webinars, workshops and conferences; this topic is covered in depth in the course “Events and talks”."
  },
  "marketing.analytics": {
    "ru": "Опережающие метрики, кривая атрибуция и инструменты по потребности.",
    "en": "Leading metrics, flawed attribution and tools chosen to meet your needs."
  },
  "marketing.regions": {
    "ru": "Как покупают в США, Германии, Австрии и Швейцарии и в Азии, с симулятором регионов.",
    "en": "How people buy in the US, Germany, Austria, Switzerland and Asia, with a regional simulator."
  },
  "marketing.cases": {
    "ru": "Что сделали HashiCorp, GitLab, Grafana, MongoDB и Elastic, Vercel и Supabase и что из этого перенять.",
    "en": "What HashiCorp, GitLab, Grafana, MongoDB and Elastic, Vercel and Supabase did and what you can adopt."
  },
  "marketing.sim-quarter": {
    "ru": "Квартал в отделе маркетинга: вы распоряжаетесь бюджетом и людьми, а исход решений зависит от вас, конкурентов, рынка и скрытых обстоятельств.",
    "en": "A quarter in the marketing department: you manage budget and people, while outcomes depend on you, competitors, the market and hidden circumstances."
  }
};
