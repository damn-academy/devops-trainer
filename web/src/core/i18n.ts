// Two languages, one text. Every learner-facing string in content is a Bi: the
// Russian and the English version side by side. Russian is the primary language
// of the course; English is written as a first-class text, not a gloss.
// Commands, terminal output and documentation pages stay English in both
// languages, as on real servers.

export type Lang = 'ru' | 'en';
export const LANGS: readonly Lang[] = ['ru', 'en'];

/** A bilingual string. Both halves are required; the linter fails on an empty one. */
export interface Bi {
  ru: string;
  en: string;
}

const KEY = 'dt.lang';
let current: Lang = 'ru';
const listeners = new Set<(l: Lang) => void>();

export function isLang(s: unknown): s is Lang {
  return s === 'ru' || s === 'en';
}

export function lang(): Lang {
  return current;
}

/** Switch language, persist the choice and notify subscribers (the app re-renders). */
export function setLang(l: Lang): void {
  if (l === current) return;
  current = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* private mode: the choice lives for this tab only */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = l;
  for (const fn of listeners) fn(l);
}

export function onLangChange(fn: (l: Lang) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Stored choice first, then the browser languages; Russian wins ties. */
export function detectLang(stored?: string | null, browser?: readonly string[]): Lang {
  if (isLang(stored)) return stored;
  const list = browser ?? [];
  if (list.length && !list.some((b) => /^ru\b/i.test(b)) && list.some((b) => /^en\b/i.test(b))) return 'en';
  return 'ru';
}

export function initLang(): Lang {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(KEY);
  } catch {
    /* ignore */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.languages : [];
  current = detectLang(stored, nav);
  if (typeof document !== 'undefined') document.documentElement.lang = current;
  return current;
}

/** Pick the current language from a Bi. Plain strings pass through (commands, identifiers). */
export function t(b: Bi | string | undefined | null, l: Lang = current): string {
  if (b === undefined || b === null) return '';
  if (typeof b === 'string') return b;
  return b[l] || b.ru || b.en || '';
}

/** Shorthand for writing a Bi inline: bi('Процесс', 'Process'). */
export function bi(ru: string, en: string): Bi {
  return { ru, en };
}

/** Fill {name} placeholders in both halves. */
export function fmt(b: Bi, vars: Record<string, string | number>): Bi {
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return { ru: fill(b.ru), en: fill(b.en) };
}

/** Russian plural form: 1 урок, 2 урока, 5 уроков, 21 урок, 11 уроков. */
export function pluralRu(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b === 1) return forms[0];
  if (b >= 2 && b <= 4) return forms[1];
  return forms[2];
}

/** "5 уроков" / "5 lessons". */
export function count(n: number, ru: [string, string, string], en: [string, string]): string {
  return current === 'ru' ? `${n} ${pluralRu(n, ru)}` : `${n} ${n === 1 ? en[0] : en[1]}`;
}

/** Interface strings of the platform itself. Content strings live in the blocks. */
export const UI = {
  course: bi('damn.academy', 'damn.academy'),
  tagline: bi(
    'Учебник и тренажёр для входа в DevOps: связная теория, процессы, которые можно двигать руками, и привычка читать документацию.',
    'A textbook and trainer for getting into DevOps: coherent theory, processes you drive with your own hands, and the habit of reading documentation.',
  ),
  map: bi('Программа', 'Syllabus'),
  review: bi('Повторение', 'Review'),
  settings: bi('Настройки', 'Settings'),
  theme: bi('Тема', 'Theme'),
  themeAuto: bi('Как в системе', 'System'),
  themeLight: bi('Светлая', 'Light'),
  themeDark: bi('Тёмная', 'Dark'),
  calm: bi('По шагам', 'Step by step'),
  calmHint: bi('Спокойный режим: без анимации, переходы мгновенные', 'Calm mode: no animation, instant transitions'),
  language: bi('Язык', 'Language'),
  levels: {
    beginner: bi('Новичок', 'Beginner'),
    intermediate: bi('Средний', 'Intermediate'),
    experienced: bi('Опытный', 'Experienced'),
  },
  tiers: { core: bi('Основной урок', 'Core lesson'), plus: bi('Необязательный урок', 'Optional lesson'), pro: bi('Углублённый урок', 'Advanced lesson') },
  checkLevel: bi('Определить уровень', 'Check your level'),
  checkLevelHint: bi('Не понимаете, какой уровень выбрать? Проверьте себя — и мы порекомендуем.', 'Not sure which level to pick? Check yourself — we will recommend one.'),
  chooseLevel: bi('Выберите уровень для этого блока', 'Choose your level for this block'),
  levelChosen: bi('Ваш уровень', 'Your level'),
  checklistStep: bi('Шаг чек-листа', 'Checklist step'),
  comingSoon: bi('Блок в работе', 'Block in progress'),
  lessons: bi('Уроки', 'Lessons'),
  start: bi('Начать', 'Start'),
  continue: bi('Продолжить', 'Continue'),
  done: bi('Пройдено', 'Done'),
  inProgress: bi('Начато', 'Started'),
  next: bi('Дальше', 'Next'),
  prev: bi('Назад', 'Back'),
  sources: bi('Источники', 'Sources'),
  sourcesEn: bi('На английском', 'In English'),
  sourcesRu: bi('На русском', 'In Russian'),
  introduces: bi('Вводит', 'Introduces'),
  uses: bi('Опирается на', 'Builds on'),
  hours: bi('ч', 'h'),
  notFound: bi('Такой страницы нет', 'No such page'),
  backHome: bi('К программе', 'Back to the syllabus'),
  exportProgress: bi('Выгрузить прогресс', 'Export progress'),
  check: bi('Проверить', 'Check'),
  retry: bi('Ещё раз', 'Try again'),
  correct: bi('Верно', 'Correct'),
  wrong: bi('Не совсем', 'Not quite'),
  confidence: bi('Насколько вы уверены?', 'How sure are you?'),
  conf1: bi('Угадываю', 'Guessing'),
  conf2: bi('Думаю, что так', 'I think so'),
  conf3: bi('Знаю', 'I know'),
  hint: bi('Подсказка', 'Hint'),
  whereToLook: bi('Где искать?', 'Where to look?'),
  whereDidYouLook: bi('Где вы уже смотрели? Какие команды справки запускали?', 'Where have you looked already? Which help commands did you run?'),
  reset: bi('Сбросить машину', 'Reset machine'),
  goals: bi('Задания', 'Tasks'),
  export: bi('Выгрузить прогресс', 'Export progress'),
  import: bi('Загрузить прогресс', 'Import progress'),
  progress: bi('Прогресс', 'Progress'),
  reminder: bi(
    'Прогресс хранится только в этом браузере. Выгрузите файл прогресса, чтобы его не потерять.',
    'Your progress lives only in this browser. Export a progress file or sign in so you do not lose it.',
  ),
  dismiss: bi('Скрыть', 'Dismiss'),
  close: bi('Закрыть', 'Close'),
  wholePage: bi('Вся страница', 'Whole page'),
  openDocs: bi('Открыть документацию', 'Open documentation'),
  fromHere: bi('это отсюда', 'this is from'),
  ask: bi('Спросить нейросеть', 'Ask the AI'),
} as const;
