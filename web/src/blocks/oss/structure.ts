import type { Bi } from '../../core/i18n';
import type { CourseModule } from '../../core/types';

export const OSS_MODULES: CourseModule[] = [
  {
    "title": {
      "ru": "Модель и лицензия",
      "en": "Model and license"
    },
    "lessons": [
      "oss.why"
    ]
  },
  {
    "title": {
      "ru": "Управление",
      "en": "Governance"
    },
    "lessons": [
      "oss.governance"
    ]
  },
  {
    "title": {
      "ru": "Участники и сообщество",
      "en": "Contributors and community"
    },
    "lessons": [
      "oss.contributors",
      "oss.community"
    ]
  },
  {
    "title": {
      "ru": "Фонды",
      "en": "Foundations"
    },
    "lessons": [
      "oss.foundations",
      "oss.donation",
      "oss.cncf-path",
      "oss.cncf-benefits"
    ]
  },
  {
    "title": {
      "ru": "Выручка и кризисы",
      "en": "Revenue and crises"
    },
    "lessons": [
      "oss.revenue",
      "oss.crises"
    ]
  }
];

export const OSS_SUMMARIES: Record<string, Bi> = {
  "oss.why": {
    "ru": "Как компании зарабатывают на открытых инфраструктурных проектах и что случилось с теми, кто менял лицензию.",
    "en": "How companies earn revenue from open infrastructure projects and what happened to those that changed their license."
  },
  "oss.governance": {
    "ru": "Файл GOVERNANCE.md, лестница ролей, принятие решений, нейтральность при одном вендоре, CLA и DCO и кодекс поведения, который применяют на деле.",
    "en": "The GOVERNANCE.md file, the role ladder, decision-making, neutrality with a single vendor, CLA and DCO, and a code of conduct enforced in practice."
  },
  "oss.contributors": {
    "ru": "Как измерять путь участника от первого issue до мейнтейнера и какие программы менторства работают в CNCF.",
    "en": "How to measure a contributor’s journey from their first issue to becoming a maintainer, and which CNCF mentorship programs work."
  },
  "oss.community": {
    "ru": "Где держать сообщество, как проводить встречи, собирать истории пользователей и строить программу амбассадоров.",
    "en": "Where to host a community, how to run meetings, collect user stories and build an ambassador program."
  },
  "oss.foundations": {
    "ru": "Четыре решения, которые смешивают под словами «отдать в фонд», варианты от вклада в чужой проект до нового фонда и как устроены ASF, Linux Foundation и её отраслевые фонды, Eclipse, NumFOCUS, Conservancy и PostgreSQL.",
    "en": "The four decisions hidden behind \"give it to a foundation\", options from contributing upstream to founding a new foundation, and how ASF, the Linux Foundation and its sub-foundations, Eclipse, NumFOCUS, Conservancy and PostgreSQL work."
  },
  "oss.donation": {
    "ru": "Таблица прав до и после передачи, взносы фондов и стоимость открытого проекта на три года, метрики CHAOSS и служебная записка для руководства.",
    "en": "A before-and-after rights matrix, foundation dues and the three-year cost of an open project, CHAOSS metrics and a decision memo for leadership."
  },
  "oss.cncf-path": {
    "ru": "На примере CNCF: что проверяет фонд при переходе проекта на уровни Incubating и Graduated и как собирать доказательства заранее; в конце — год в инкубаторе в симуляторе.",
    "en": "Using CNCF as the example: what a foundation checks when projects move to Incubating and Graduated, and how to gather evidence in advance; the lesson ends with a simulated year in incubation."
  },
  "oss.cncf-benefits": {
    "ru": "Что фонд даёт компаниям-членам и проектам на примере CNCF и как это устроено у ASF, OpenSSF, Eclipse и LF AI & Data.",
    "en": "What a foundation offers member companies and projects, using CNCF as the example, and how ASF, OpenSSF, Eclipse and LF AI & Data compare."
  },
  "oss.revenue": {
    "ru": "Как компании связывают использование открытого проекта с продажами и где эта работа превращается в риск для репутации.",
    "en": "How companies connect use of an open project to sales, and where that work becomes a reputational risk."
  },
  "oss.crises": {
    "ru": "Как вести себя при уязвимости, взломе и споре о лицензии по опыту xz, Okta, Grafana и Redis.",
    "en": "How to respond to a vulnerability, a breach or a licensing dispute, drawing on the experience of xz, Okta, Grafana and Redis."
  }
};
