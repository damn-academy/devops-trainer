import { it, expect } from 'vitest';
import { registry } from '../src/core/registry';
import type { QText, QuizItem } from '../src/core/types';

const allQuestions = (): QuizItem[] => {
  const all = new Map(registry.quiz);
  for (const lesson of registry.lessons.values()) for (const s of lesson.sections) if (s.kind === 'quiz') for (const q of s.items) if (typeof q !== 'string') all.set(q.id, q);
  return [...all.values()];
};

const plain = (v: QText, lang: 'ru' | 'en'): string => typeof v === 'string' ? v : 'ru' in v ? v[lang] : JSON.stringify(v);
// Visible length: Markdown links and emphasis do not count, runs of spaces count once.
const visibleLength = (s: string): number => [...s
  .replace(/\[\[([^\]]+)\]\]/g, (_, ref: string) => ref.split('|').at(-1)!)
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/[*_`]/g, '')
  .replace(/\s+/g, ' ')
  .trim()].length;

// Business-course quizzes must not be solvable by option length alone:
// the correct option may be the unique longest or the unique shortest only in a minority of questions.
const BUSINESS = ['marketing.', 'product.', 'sales.', 'scithink.', 'aicontent.', 'finance.', 'metrics.', 'events.', 'oss.', 'strategy.'];
it('keeps option length from giving away the answer in business courses', () => {
  let n = 0, longest = 0, shortest = 0;
  const longestIds: string[] = [], shortestIds: string[] = [];
  for (const q of allQuestions()) {
    if (!BUSINESS.some(p => q.id.startsWith(p)) || !('options' in q) || !q.options?.length) continue;
    if (q.options.filter(o => o.correct).length !== 1) continue;
    const len = q.options.map(o => (typeof o.text === 'string' ? o.text : o.text.ru).length);
    const c = q.options.findIndex(o => o.correct);
    const unique = (v: number) => len.filter(x => x === v).length === 1;
    n++;
    if (len[c] === Math.max(...len) && unique(len[c])) { longest++; longestIds.push(`${q.id} (${len.join("/")})`); }
    if (len[c] === Math.min(...len) && unique(len[c])) { shortest++; shortestIds.push(`${q.id} (${len.join("/")})`); }
  }
  expect(n).toBeGreaterThan(50);
  expect(longest / n, `Unique longest correct options: ${longestIds.join(", ")}`).toBeLessThan(0.45);
  expect(shortest / n, `Unique shortest correct options: ${shortestIds.join(", ")}`).toBeLessThan(0.45);
});

// Per course and per language, the correct option of a single-answer question may be the unique longest,
// the unique shortest or the unique median-length option (odd option counts only) in at most
// MAX_SHARE of the questions. A test-taker who always picks the same length rank should do no better
// than chance by much. Courses with fewer than MIN_QUESTIONS such questions are too small to judge.
const MAX_SHARE = 0.45;
const MIN_QUESTIONS = 8;
// Courses written before this check, with the share they had then. They may not get worse;
// remove an entry once its course is rebalanced below MAX_SHARE.
const LEGACY_CEILING: Record<string, number> = {
  orient: 0.70, linux: 0.83, containers: 0.83, cicd: 0.89, 'k8s-3': 0.94, career: 0.96,
  product: 0.86, scithink: 0.72, events: 0.47, strategy: 0.59, finance: 0.71, aicontent: 0.62,
};

type Rank = 'longest' | 'shortest' | 'median';
const rankOfCorrect = (len: number[], c: number): Rank | null => {
  const v = len[c];
  if (len.filter(x => x === v).length !== 1) return null;
  if (v === Math.max(...len)) return 'longest';
  if (v === Math.min(...len)) return 'shortest';
  if (len.length % 2 === 1 && [...len].sort((a, b) => a - b)[(len.length - 1) / 2] === v) return 'median';
  return null;
};

type CourseReport = { course: string; lang: 'ru' | 'en'; rank: Rank; ids: string[]; total: number };
const lengthRankReports = (): CourseReport[] => {
  const qs = allQuestions();
  const out: CourseReport[] = [];
  for (const block of registry.orderedBlocks(true)) {
    const bank = qs.filter(q => q.id.startsWith(block.id + '.') && 'options' in q && q.options && q.options.length >= 2 && q.options.filter(o => o.correct).length === 1);
    if (bank.length < MIN_QUESTIONS) continue;
    for (const lang of ['ru', 'en'] as const) {
      const counts: Record<Rank, string[]> = { longest: [], shortest: [], median: [] };
      for (const q of bank) {
        if (!('options' in q) || !q.options) continue;
        const len = q.options.map(o => visibleLength(plain(o.text, lang)));
        const rank = rankOfCorrect(len, q.options.findIndex(o => o.correct));
        if (rank) counts[rank].push(`${q.id} (${len.join('/')})`);
      }
      for (const rank of ['longest', 'shortest', 'median'] as const) out.push({ course: block.id, lang, rank, ids: counts[rank], total: bank.length });
    }
  }
  return out;
};

it('keeps the correct option from sitting at one length rank in any course', () => {
  const reports = lengthRankReports();
  const failures = reports
    .filter(r => r.ids.length / r.total > (LEGACY_CEILING[r.course] ?? MAX_SHARE))
    .map(r => `${r.course} ${r.lang}: correct option is the ${r.rank} in ${r.ids.length}/${r.total} (limit ${LEGACY_CEILING[r.course] ?? MAX_SHARE}): ${r.ids.join(', ')}`);
  expect(new Set(reports.map(r => r.course)).size).toBeGreaterThan(5);
  expect(reports.some(r => r.course === 'marketing')).toBe(true);
  expect(failures, failures.join('\n')).toEqual([]);
});

it('keeps a legacy ceiling only for a course that still exceeds the common limit', () => {
  const reports = lengthRankReports();
  for (const course of Object.keys(LEGACY_CEILING)) {
    const worst = Math.max(...reports.filter(r => r.course === course).map(r => r.ids.length / r.total));
    expect(worst, `${course} is now within ${MAX_SHARE}; drop it from LEGACY_CEILING`).toBeGreaterThan(MAX_SHARE);
  }
});
