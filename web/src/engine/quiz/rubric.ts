// The single rubric schema of the product (10 §9.3, §11): criteria scored
// 0–3 with anchors, and a grader answer `criteria[{id, score, evidence,
// note}]`. A score above 1 counts only with evidence: a quote that matches
// the transcript fuzzily (word-level Levenshtein distance ≤ 0.15 of the quote
// length, so speech-recognition slips do not erase honest points). A score
// without a confirmed quote drops to 1 and is marked "not confirmed".
// Also: the local text checks of the career trainers (filler words, apologies,
// concreteness, share of commands, the four parts of an answer).

import { bi, type Bi } from '../../core/i18n';

export type Score = 0 | 1 | 2 | 3;

export interface RubricCriterion {
  id: string;
  title: Bi;
  /** What 0, 1, 2 and 3 mean. */
  anchors: [Bi, Bi, Bi, Bi];
  /** A zero here fails the whole interview (honesty). */
  zeroFails?: boolean;
}

export interface Rubric {
  id: string;
  title: Bi;
  criteria: RubricCriterion[];
  /** Mean score needed (of 3). */
  pass: number;
}

export interface CriterionScore {
  id: string;
  score: Score;
  evidence: string | null;
  note?: string;
  /** Set by verifyScores: the evidence was found in the transcript. */
  verified?: boolean;
  /** Set by verifyScores: the score was lowered because the evidence was not found. */
  lowered?: boolean;
}

/** The interview rubric (10 §9.3), 0–3 with anchors. */
export const INTERVIEW_RUBRIC: Rubric = {
  id: 'interview',
  title: bi('Рубрика интервью', 'Interview rubric'),
  pass: 2,
  criteria: [
    {
      id: 'correctness',
      title: bi('Корректность', 'Correctness'),
      anchors: [bi('Неверно по сути', 'Wrong in substance'), bi('Частично верно, есть ошибка', 'Partly right, with a mistake'), bi('Верно, пропущен ключевой пункт', 'Right, a key point missing'), bi('Верно, все ключевые пункты', 'Right, every key point')],
    },
    {
      id: 'structure',
      title: bi('Структура: что → зачем → как → когда', 'Structure: what → why → how → when'),
      anchors: [bi('Набор фактов без структуры', 'A heap of facts, no structure'), bi('Одна-две части', 'One or two parts'), bi('Три части', 'Three parts'), bi('Все четыре, в логичном порядке', 'All four, in a logical order')],
    },
    {
      id: 'mechanism',
      title: bi('Механизм, а не команды', 'Mechanism, not commands'),
      anchors: [bi('Только команды или названия', 'Only commands or names'), bi('Механизм упомянут', 'The mechanism is mentioned'), bi('Механизм объяснён', 'The mechanism is explained'), bi('Объяснён и связан с последствиями', 'Explained and tied to its consequences')],
    },
    {
      id: 'depth',
      title: bi('Глубина: уточнения', 'Depth: follow-ups'),
      anchors: [bi('Уточнение не выдержал', 'Did not survive the follow-up'), bi('Ответил общими словами', 'Answered in general words'), bi('Ответил по существу', 'Answered to the point'), bi('Ответил и сам назвал компромисс или ограничение', 'Answered and named a trade-off or a limit')],
    },
    {
      id: 'honesty',
      title: bi('Честность', 'Honesty'),
      zeroFails: true,
      anchors: [bi('Выдумал', 'Made it up'), bi('Ушёл от ответа', 'Dodged the question'), bi('Признал незнание', 'Admitted not knowing'), bi('Признал и назвал источник и место, где выяснил бы', 'Admitted it and named the source and the place to find out')],
    },
    {
      id: 'communication',
      title: bi('Коммуникация', 'Communication'),
      anchors: [bi('Не понять', 'Impossible to follow'), bi('Сбивчиво, очень длинно или односложно', 'Muddled, very long or monosyllabic'), bi('Понятно', 'Clear'), bi('Понятно, кратко, с примером из практики', 'Clear, brief, with an example from practice')],
    },
  ],
};

/** The drill and incident rubric (10 §6.4, §9.2). */
export const DRILL_RUBRIC: Rubric = {
  id: 'drill',
  title: bi('Рубрика ситуационного вопроса', 'Situational question rubric'),
  pass: 2,
  criteria: [
    {
      id: 'level',
      title: bi('Уровень и улики', 'Layer and evidence'),
      anchors: [bi('Действовал без наблюдений', 'Acted without observing'), bi('Назвал уровень без улики', 'Named a layer without evidence'), bi('Назвал уровень по улике', 'Named the layer from evidence'), bi('Назвал и сузил по мере новых улик', 'Named it and narrowed down as evidence came')],
    },
    {
      id: 'method',
      title: bi('Метод: уточнения и гипотезы', 'Method: questions and hypotheses'),
      anchors: [bi('Сразу чинил', 'Went straight to fixing'), bi('Одна гипотеза без проверки', 'One untested hypothesis'), bi('Уточнил и проверял гипотезы', 'Asked first and tested hypotheses'), bi('Уточнил, проверял и отбрасывал гипотезы по уликам', 'Asked, tested and dropped hypotheses by evidence')],
    },
    {
      id: 'safety',
      title: bi('Безопасность', 'Safety'),
      zeroFails: true,
      anchors: [bi('Разрушающее действие до сбора улик', 'A destructive action before evidence'), bi('Разрушающее действие после частичного сбора', 'A destructive action after partial evidence'), bi('Без разрушающих действий', 'No destructive actions'), bi('И сначала вернул сервис, потом искал причину', 'And restored the service before hunting the cause')],
    },
    {
      id: 'result',
      title: bi('Результат', 'Result'),
      anchors: [bi('Причина не найдена', 'Cause not found'), bi('Спрятал симптом', 'Hid the symptom'), bi('Устранил причину', 'Removed the cause'), bi('Устранил и проверил результат', 'Removed it and verified the result')],
    },
    {
      id: 'communication',
      title: bi('Статус команде', 'Status to the team'),
      anchors: [bi('Нет', 'None'), bi('Действие без влияния и срока', 'An action, no impact or time'), bi('Влияние и что делаем', 'Impact and what we do'), bi('Влияние, что делаем и когда следующий статус', 'Impact, what we do and when the next update is')],
    },
  ],
};

// ── Fuzzy quote matching (О-5) ─────────────────────────────────────────────

/** Words of a text, lower case, punctuation dropped, ё = е. */
export function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter(Boolean);
}

/** Levenshtein distance over words. */
export function wordDistance(a: readonly string[], b: readonly string[]): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

export const QUOTE_TOLERANCE = 0.15;

export interface QuoteMatch {
  ok: boolean;
  /** Normalised distance of the best window, 0..1. */
  distance: number;
  /** Word index of the best window in the transcript. */
  at: number;
  length: number;
}

/**
 * Does the quote occur in the transcript, allowing a few word errors? Windows
 * of the quote's length ± 2 words are compared; the distance is divided by the
 * quote length.
 */
export function matchQuote(quote: string, transcript: string, tolerance = QUOTE_TOLERANCE): QuoteMatch {
  const q = words(quote);
  const tr = words(transcript);
  if (!q.length) return { ok: false, distance: 1, at: -1, length: 0 };
  let best: QuoteMatch = { ok: false, distance: 1, at: -1, length: 0 };
  for (let len = Math.max(1, q.length - 2); len <= q.length + 2; len++) {
    for (let i = 0; i + len <= tr.length; i++) {
      const d = wordDistance(q, tr.slice(i, i + len)) / q.length;
      if (d < best.distance) best = { ok: false, distance: d, at: i, length: len };
      if (d === 0) break;
    }
  }
  if (best.at < 0 && tr.length) {
    const d = Math.min(1, wordDistance(q, tr) / q.length);
    best = { ok: false, distance: d, at: 0, length: tr.length };
  }
  best.ok = best.distance <= tolerance + 1e-9;
  return best;
}

/** Lower every score above 1 whose evidence is not in the transcript (10 §9.3). */
export function verifyScores(scores: readonly CriterionScore[], transcript: string, tolerance = QUOTE_TOLERANCE): CriterionScore[] {
  return scores.map((s) => {
    const score = clampScore(s.score);
    if (score <= 1) return { ...s, score, verified: !!s.evidence && matchQuote(s.evidence, transcript, tolerance).ok };
    const ok = !!s.evidence && matchQuote(s.evidence, transcript, tolerance).ok;
    return ok ? { ...s, score, verified: true } : { ...s, score: 1, verified: false, lowered: true };
  });
}

export function clampScore(n: unknown): Score {
  const x = Math.round(Number(n));
  return (Number.isFinite(x) ? Math.max(0, Math.min(3, x)) : 0) as Score;
}

export function meanScore(scores: readonly { score: number }[]): number {
  return scores.length ? scores.reduce((s, x) => s + x.score, 0) / scores.length : 0;
}

/** Passed: mean ≥ rubric.pass and no zero where a zero fails. */
export function rubricPassed(r: Rubric, scores: readonly CriterionScore[]): boolean {
  const zeroFail = r.criteria.some((c) => c.zeroFails && scores.find((s) => s.id === c.id)?.score === 0);
  return !zeroFail && meanScore(scores) >= r.pass;
}

export interface GraderAnswer {
  q: string;
  criteria: CriterionScore[];
}

export interface GraderResult {
  answers: GraderAnswer[];
  summary?: { strong?: string[]; work_on?: string[] };
}

/** Parse the grader's JSON (the first {...} in the text); null when it is not the schema. */
export function parseGrader(text: string): GraderResult | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let data: unknown;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const d = data as { answers?: unknown; summary?: unknown };
  if (!Array.isArray(d.answers)) return null;
  const answers: GraderAnswer[] = [];
  for (const a of d.answers as { q?: unknown; criteria?: unknown }[]) {
    if (!a || typeof a.q !== 'string' || !Array.isArray(a.criteria)) continue;
    answers.push({
      q: a.q,
      criteria: (a.criteria as Record<string, unknown>[])
        .filter((c) => c && typeof c.id === 'string')
        .map((c) => ({ id: c.id as string, score: clampScore(c.score), evidence: typeof c.evidence === 'string' && c.evidence.trim() ? (c.evidence as string) : null, note: typeof c.note === 'string' ? c.note : undefined })),
    });
  }
  const summary = typeof d.summary === 'object' && d.summary ? (d.summary as GraderResult['summary']) : undefined;
  return { answers, summary };
}

// ── Local checks of spoken and written answers (10 §9.2, §9.4) ────────────

const FILLERS: Record<'ru' | 'en', string[]> = {
  ru: ['ну', 'как бы', 'типа', 'короче', 'в общем', 'вот', 'это самое', 'значит', 'собственно'],
  en: ['um', 'uh', 'like', 'you know', 'basically', 'kind of', 'sort of', 'i mean'],
};
const APOLOGIES: Record<'ru' | 'en', string[]> = {
  ru: ['к сожалению', 'я пока только', 'наверное, не подойду', 'наверное не подойду', 'извините', 'я всего лишь', 'у меня нет опыта'],
  en: ['unfortunately', 'i am only', "i'm only", 'i probably', 'sorry', 'just a beginner', 'i have no experience'],
};

function countPhrases(text: string, list: string[]): number {
  const w = ` ${words(text).join(' ')} `;
  let n = 0;
  for (const p of list) {
    const needle = ` ${words(p).join(' ')} `;
    let i = w.indexOf(needle);
    while (i >= 0) {
      n++;
      i = w.indexOf(needle, i + needle.length - 1);
    }
  }
  return n;
}

export function fillerCount(text: string, lang: 'ru' | 'en'): number {
  return countPhrases(text, FILLERS[lang]);
}

export function apologyCount(text: string, lang: 'ru' | 'en'): number {
  return countPhrases(text, APOLOGIES[lang]);
}

/** A number, a link or a project-like name in Latin letters inside a Russian text. */
export function hasConcrete(text: string): boolean {
  return /\d/.test(text) || /https?:\/\/|github\.com|gitlab\.com/i.test(text);
}

/** Words per minute when the learner reads aloud: 130 is a calm interview pace. */
export const SPEECH_WPM = 130;

export function speakingSeconds(text: string, wpm = SPEECH_WPM): number {
  return Math.round((words(text).length / wpm) * 60);
}

const CMD = /`[^`]+`|(?:^|\s)(?:sudo\s+)?(?:kubectl|docker|systemctl|journalctl|nslookup|dig|curl|ping|traceroute|ss|netstat|ip|ls|cat|grep|ps|top|df|du|chmod|chown|git|terraform|ansible(?:-playbook)?|helm|tail|less|nano|vim)(?:\s+[-\w./:=@]+)*/g;

/** Share of the answer's characters taken by commands: should stay under a third (10 §9.2). */
export function commandShare(text: string): number {
  const len = text.replace(/\s+/g, ' ').trim().length;
  if (!len) return 0;
  const cmd = (text.match(CMD) ?? []).reduce((s, m) => s + m.trim().length, 0);
  return Math.min(1, cmd / len);
}

/** The four parts of an answer and the words that usually open them (a hint, not a verdict). */
export const ANSWER_PARTS = ['what', 'why', 'how', 'when'] as const;
export type AnswerPart = (typeof ANSWER_PARTS)[number];

export const PART_TITLES: Record<AnswerPart, Bi> = {
  what: bi('Что это', 'What it is'),
  why: bi('Зачем', 'Why it exists'),
  how: bi('Как работает', 'How it works'),
  when: bi('Когда использую', 'When I use it'),
};

export interface KeyPoint {
  id: string;
  text: Bi;
  /** Regular expressions (case-insensitive) that indicate the point is covered, in either language. */
  any: string[];
}

/** Which key points an answer mentions (a local, honest approximation: the learner confirms the rest). */
export function coveredPoints(text: string, points: readonly KeyPoint[]): string[] {
  const low = text.toLowerCase().replace(/ё/g, 'е');
  return points.filter((p) => p.any.some((re) => new RegExp(re, 'iu').test(low))).map((p) => p.id);
}

/** A status message to the team has impact, action and the next update (10 §6.4). */
export function statusParts(text: string): { impact: boolean; action: boolean; next: boolean } {
  const low = text.toLowerCase();
  return {
    impact: /\d+\s*%|всех|все пользоват|часть пользоват|users|customers|клиент|оплат|checkout|заказ/.test(low),
    action: /откат|rollback|roll back|чиним|смотрим|investigat|restor|восстанав|мигрир|mitigat|перевод|switch|чистим|освобожда/.test(low),
    next: /\d{1,2}[:.]\d{2}|через \d+|in \d+\s*min|next update|следующ/.test(low),
  };
}
