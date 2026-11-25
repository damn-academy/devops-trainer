import type { Bi } from '../../core/i18n';
import type { CourseModule } from '../../core/types';

export const EVENTS_MODULES: CourseModule[] = [
  {
    "title": {
      "ru": "Карта событий и окупаемость",
      "en": "Event landscape and return on investment"
    },
    "lessons": [
      "events.map"
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
      "ru": "Митапы и KCD",
      "en": "Meetups and KCDs"
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
      "ru": "Своя конференция и события фонда",
      "en": "Your own conference and foundation events"
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
    "ru": "Что CNCF даёт проекту для событий по уровню зрелости и членству компании: виртуальный саммит, эфиры, KubeCon, событие рядом с ним, KCD и правила названия события.",
    "en": "What CNCF offers a project for events by maturity level and company membership: a virtual summit, livestreams, KubeCon, a co-located event, KCDs and event naming rules."
  },
  "events.map": {
    "ru": "Какие бывают события, что даёт каждое, чьи правила на них действуют и как заранее посчитать, сколько возможностей сделок нужно, чтобы событие окупилось.",
    "en": "What kinds of events exist, what each offers, whose rules apply and how to calculate in advance how many sales opportunities an event needs to break even."
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
    "ru": "Как найти все события региона, стать нужным докладчиком, открыть свою группу CNCF и превратить митапы и KCD в ежедневную работу по сорок минут.",
    "en": "How to find every event in a region, become a speaker people need, start your own CNCF group and turn meetups and KCDs into forty minutes of daily work."
  },
  "events.cfp": {
    "ru": "Сколько заявок принимает KubeCon, что отклоняют рецензенты, как писать тезис, готовить демонстрацию и продлевать жизнь доклада.",
    "en": "How many proposals KubeCon accepts, what reviewers reject, how to write an abstract, prepare a demo and extend the life of a talk."
  },
  "events.booth": {
    "ru": "Сколько стоит стенд на KubeCon, что значат сканы бейджей, кто нужен на стенде и как вести разговор за три минуты.",
    "en": "How much a KubeCon booth costs, what badge scans mean, who should staff the booth and how to have a three-minute conversation."
  },
  "events.no-booth": {
    "ru": "Как работать на конференции без стенда: встречи за несколько недель, завтраки, ужины и круглые столы, региональные конференции; в конце — симулятор подготовки к KubeCon.",
    "en": "How to work at a conference without a booth: meetings arranged weeks ahead, breakfasts, dinners and roundtables, and regional conferences; ending with a KubeCon preparation simulator."
  }
};
