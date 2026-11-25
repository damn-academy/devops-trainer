import type { Bi } from '../../core/i18n';
import type { CourseModule } from '../../core/types';

export const AICONTENT_MODULES: CourseModule[] = [
  {
    "title": {
      "ru": "Как устроена работа",
      "en": "How the work is organised"
    },
    "lessons": [
      "aicontent.team",
      "aicontent.brief"
    ]
  },
  {
    "title": {
      "ru": "Исследование до текста",
      "en": "Research before writing"
    },
    "lessons": [
      "aicontent.research"
    ]
  },
  {
    "title": {
      "ru": "Текст и проверки",
      "en": "Text and checks"
    },
    "lessons": [
      "aicontent.editing",
      "aicontent.checks"
    ]
  },
  {
    "title": {
      "ru": "Изображения, видео и звук",
      "en": "Images, video and audio"
    },
    "lessons": [
      "aicontent.visuals",
      "aicontent.video",
      "aicontent.video-to-article"
    ]
  },
  {
    "title": {
      "ru": "Боты и интерактив",
      "en": "Bots and interactive materials"
    },
    "lessons": [
      "aicontent.bots",
      "aicontent.interactive"
    ]
  },
  {
    "title": {
      "ru": "Публикация, правила и инструменты",
      "en": "Publishing, rules and tools"
    },
    "lessons": [
      "aicontent.publishing",
      "aicontent.rules",
      "aicontent.tools"
    ]
  }
];

export const AICONTENT_SUMMARIES: Record<string, Bi> = {
  "aicontent.team": {
    "ru": "Кто что делает в производстве контента с нейросетями: редактор, ведущая нейросеть, исполнители и вымышленные читатели, и как считать стоимость принятого материала.",
    "en": "Who does what in AI content production: the editor, lead AI, workers and fictional readers, and how to calculate the cost of accepted material."
  },
  "aicontent.brief": {
    "ru": "Бриф как договор с исполнителем, журнал сессии и память нейросети: как не потерять работу между сессиями, с шаблонами.",
    "en": "The brief as a contract with a worker, the session log and AI memory: how to keep work between sessions, with templates."
  },
  "aicontent.research": {
    "ru": "Как собрать базу фактов до текста: формат записи, статусы источников, правила подтверждения, архивы и технические замеры.",
    "en": "How to build a fact base before writing: record format, source statuses, confirmation rules, archives and technical measurements."
  },
  "aicontent.editing": {
    "ru": "Приметы текста нейросети и правила, которые их убирают: связность, точность, кальки, руководство по стилю и линтеры.",
    "en": "The telltale signs of AI prose and rules for removing them: coherence, precision, literal translations, a style guide and linters."
  },
  "aicontent.checks": {
    "ru": "Фактчекер, рецензенты по ролям, вымышленные читатели, критик и механические проверки, которые находят то, чего не видит автор.",
    "en": "A fact-checker, role-based reviewers, fictional readers, a critic and mechanical checks that find what the author misses."
  },
  "aicontent.visuals": {
    "ru": "Три способа делать иллюстрации: документальные снимки, графика из кода и генеративные слои, и права на них.",
    "en": "Three ways to make illustrations: documentary captures, graphics from code and generative layers, and the rights to them."
  },
  "aicontent.video": {
    "ru": "Заставки, мультфильм и ролики из кода, генераторы видео, синтез голоса, музыка, подкаст и проверка звука.",
    "en": "Intros, a cartoon and videos made from code, video generators, voice synthesis, music, a podcast and audio checks."
  },
  "aicontent.video-to-article": {
    "ru": "Конвейер из пятнадцати этапов, который превращает запись в статью, и его применение к переводу научной статьи.",
    "en": "A fifteen-stage pipeline that turns a recording into an article, and its application to translating a scientific article."
  },
  "aicontent.bots": {
    "ru": "Турнир в чате как контент: сезон, бот с состоянием, тест всего сезона и правила площадок.",
    "en": "A chat tournament as content: a season, a stateful bot, a full-season test and platform rules."
  },
  "aicontent.interactive": {
    "ru": "Лонгриды, учебные курсы и симуляторы с нейросетью-ведущим: раскадровка, правила интерактива и приёмка в браузере.",
    "en": "Longreads, learning courses and simulators hosted by AI: storyboards, interaction rules and browser acceptance review."
  },
  "aicontent.publishing": {
    "ru": "Форматы Хабра, блога и Telegram, браузерный ассистент для публикации, многоязычие и что ломается при массовой публикации.",
    "en": "Habr, blog and Telegram formats, a browser assistant for publishing, multilingual content and what breaks during bulk publication."
  },
  "aicontent.rules": {
    "ru": "Что требуют площадки и закон о текстах нейросетей, авторское право и голос, и что на самом деле измерено в исследованиях.",
    "en": "What platforms and the law require for AI texts, copyright and voice, and what research has actually measured."
  },
  "aicontent.tools": {
    "ru": "Инструменты для текста, исследований, картинок, видео, голоса и монтажа с ценами на конец 2026 года и как считать бюджет.",
    "en": "Tools for writing, research, images, video, voice and editing, with late-2026 prices and how to budget."
  }
};
