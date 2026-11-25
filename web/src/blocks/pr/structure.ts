import type { Bi } from '../../core/i18n';
import type { CourseModule } from '../../core/types';

export const PR_MODULES: CourseModule[] = [
  {
    "title": {
      "ru": "Аналитики и пресса",
      "en": "Analysts and the press"
    },
    "lessons": [
      "pr.analysts",
      "pr.press"
    ]
  },
  {
    "title": {
      "ru": "Кризис и публичность",
      "en": "Crisis and public visibility"
    },
    "lessons": [
      "pr.crisis",
      "pr.founder"
    ]
  }
];

export const PR_SUMMARIES: Record<string, Bi> = {
  "pr.analysts": {
    "ru": "Как устроены брифинги и исследования Gartner и других аналитиков и чего от них ждать маленькой компании.",
    "en": "How briefings and research by Gartner and other analysts work, and what a small company can expect from them."
  },
  "pr.press": {
    "ru": "Когда пресс-релиз полезен, сколько стоит его рассылка, как устроены издания об инфраструктуре и как работают эксклюзив и эмбарго.",
    "en": "When a press release is useful, how much distribution costs, how infrastructure publications work, and how exclusives and embargoes work."
  },
  "pr.crisis": {
    "ru": "Первые сутки кризиса: порядок аудиторий, первое заявление, кто говорит от имени компании; в конце — неделя кризиса в симуляторе.",
    "en": "The first twenty-four hours of a crisis: the order of audiences, the first statement and who speaks for the company; ending with a week of crisis in the simulator."
  },
  "pr.founder": {
    "ru": "Зачем основателю инфраструктурной компании публичность и какой она бывает полезной.",
    "en": "Why an infrastructure company founder needs public visibility and what makes it useful."
  }
};
