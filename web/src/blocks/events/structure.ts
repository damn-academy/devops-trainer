import type { Bi } from '../../core/i18n';
import type { CourseModule } from '../../core/types';

export const EVENTS_MODULES: CourseModule[] = [
  {
    "title": {
      "ru": "Карта событий и окупаемость",
      "en": "Event landscape and return on investment"
    },
    "lessons": [
      "events.map",
      "events.portfolio"
    ]
  },
  {
    "title": {
      "ru": "Свои онлайн-события",
      "en": "Your own online events"
    },
    "lessons": [
      "events.webinars",
      "events.labs"
    ]
  },
  {
    "title": {
      "ru": "Митапы и местные сообщества",
      "en": "Meetups and local communities"
    },
    "lessons": [
      "events.local"
    ]
  },
  {
    "title": {
      "ru": "Доклады",
      "en": "Talks"
    },
    "lessons": [
      "events.cfp"
    ]
  },
  {
    "title": {
      "ru": "Своя конференция и события экосистемы",
      "en": "Your own conference and ecosystem events"
    },
    "lessons": [
      "events.own-conf",
      "events.online-conf",
      "events.cncf-events"
    ]
  },
  {
    "title": {
      "ru": "Стенд и конференция без стенда",
      "en": "Booths and conferences without a booth"
    },
    "lessons": [
      "events.booth",
      "events.no-booth"
    ]
  }
];

export const EVENTS_SUMMARIES: Record<string, Bi> = {
  "events.own-conf": {
    "ru": "Как провести первую собственную конференцию: масштаб, смета по опубликованным бюджетам, неявка и билеты, отбор докладов, которому верят, привлечение участников, интерактив и развлечения, кодекс поведения и результат.",
    "en": "How to run your first own conference: scale, a budget based on published ones, no-shows and tickets, talk selection people trust, getting attendees, interactive formats and fun, code of conduct and results."
  },
  "events.online-conf": {
    "ru": "Сколько зрителей приходит в эфир онлайн-конференции, какой выбрать формат, время и платформу, кто нужен в команде и как сделать, чтобы зрители разговаривали.",
    "en": "How many viewers join an online conference live, which format, time and platform to choose, who the team needs and how to get viewers talking."
  },
  "events.cncf-events": {
    "ru": "Что фонд даёт проекту для событий на примере CNCF — виртуальный саммит, эфиры, главная конференция, KCD, — как это устроено у PostgreSQL, Linux Foundation, OpenInfra и ASF и правила названия события.",
    "en": "What a foundation offers a project for events, using CNCF as the example—a virtual summit, livestreams, the flagship conference, KCDs—how PostgreSQL, the Linux Foundation, OpenInfra and ASF compare, and event naming rules."
  },
  "events.map": {
    "ru": "Какие бывают события, что даёт каждое, чьи правила на них действуют и как заранее посчитать, сколько возможностей сделок нужно, чтобы событие окупилось.",
    "en": "What kinds of events exist, what each offers, whose rules apply and how to calculate in advance how many sales opportunities an event needs to break even."
  },
  "events.portfolio": {
    "ru": "Четыре класса площадок за пределами одной экосистемы, взвешенная оценка события под профиль клиента, экономика участия и портфели для девяти сегментов инфраструктуры.",
    "en": "Four classes of venues beyond a single ecosystem, a weighted event score built on the customer profile, participation economics and portfolios for nine infrastructure segments."
  },
  "events.webinars": {
    "ru": "Сколько людей на самом деле приходит на вебинары, какие форматы подходят инженерам и почему запись важнее прямого эфира.",
    "en": "How many people actually attend webinars, which formats suit engineers and why the recording matters more than the live broadcast."
  },
  "events.labs": {
    "ru": "Как проводить практические воркшопы в браузерных лабораториях, чтобы участники доходили до результата, и как это проверить.",
    "en": "How to run practical workshops in browser labs so participants reach a result, and how to verify it."
  },
  "events.local": {
    "ru": "Как найти все события региона в своей отрасли — от групп пользователей PostgreSQL и глав OWASP до DevOpsDays и KCD, — стать нужным докладчиком, открыть свою группу и превратить это в ежедневную работу по сорок минут.",
    "en": "How to find every event in your industry across a region—from PostgreSQL user groups and OWASP chapters to DevOpsDays and KCDs—become a speaker people need, start your own group and turn it into forty minutes of daily work."
  },
  "events.cfp": {
    "ru": "Сколько заявок принимают конференции на примере KubeCon, какие ещё пути на сцену бывают, что отклоняют рецензенты, как писать тезис, готовить демонстрацию и продлевать жизнь доклада.",
    "en": "How many proposals conferences accept, using KubeCon as the example, other routes to the stage, what reviewers reject, how to write an abstract, prepare a demo and extend the life of a talk."
  },
  "events.booth": {
    "ru": "Сколько стоит стенд на разных конференциях, что значат сканы бейджей, кто нужен на стенде и как вести разговор за три минуты.",
    "en": "How much a booth costs at different conferences, what badge scans mean, who should staff the booth and how to have a three-minute conversation."
  },
  "events.no-booth": {
    "ru": "Как работать на конференции без стенда: встречи за несколько недель, завтраки, ужины и круглые столы, региональные конференции; в конце — симулятор подготовки к KubeCon.",
    "en": "How to work at a conference without a booth: meetings arranged weeks ahead, breakfasts, dinners and roundtables, and regional conferences; ending with a KubeCon preparation simulator."
  }
};
