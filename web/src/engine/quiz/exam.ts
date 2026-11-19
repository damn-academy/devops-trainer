// Practical exams (10 §6, 01 §13.3) as pure functions: the variant from a
// seed, the score with weights and critical tasks, the share of tasks beyond
// the course, the retake gate and the protocol. The page (app/exam-page.ts)
// renders; the sandbox checks each task by the state of the machine.

import type { Exam, ExamTask, Level } from '../../core/types';

/** Minimum share of practice weight on tasks beyond the course, by level (10 §3.6, §6.1). */
export const BEYOND_MIN: Record<Level, number> = { beginner: 0.1, intermediate: 0.15, experienced: 0.2 };
export const RETAKE_HOURS = 24;

/** A small deterministic PRNG (mulberry32) from a string seed. */
export function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh seed for a new attempt. */
export function newSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * The tasks of one variant: every task without a pool, plus one task per pool
 * chosen by the seed. Authoring order is kept; the first task of a pool keeps
 * the pool's place.
 */
export function pickTasks(exam: Exam, seed: string): ExamTask[] {
  const r = rng(`${exam.id}:${seed}`);
  const pools = new Map<string, ExamTask[]>();
  for (const t of exam.tasks) if (t.pool) (pools.get(t.pool) ?? pools.set(t.pool, []).get(t.pool)!).push(t);
  const chosen = new Map<string, ExamTask>();
  for (const [pool, list] of pools) chosen.set(pool, list[Math.floor(r() * list.length)]);
  const out: ExamTask[] = [];
  const placed = new Set<string>();
  for (const t of exam.tasks) {
    if (!t.pool) out.push(t);
    else if (!placed.has(t.pool)) {
      placed.add(t.pool);
      out.push(chosen.get(t.pool)!);
    }
  }
  return out;
}

export interface ExamScore {
  total: number;
  got: number;
  /** 0..1 */
  score: number;
  criticalOk: boolean;
  passed: boolean;
  /** Task ids that did not pass. */
  failed: string[];
  /** Critical tasks that did not pass. */
  criticalFailed: string[];
  /** Weight share of beyond-the-course tasks that passed, of their total. */
  beyondSolved: number;
}

/** Score a variant. `results` maps task id → 0..1 (partial credit allowed). */
export function scoreExam(exam: Exam, tasks: readonly ExamTask[], results: ReadonlyMap<string, number>): ExamScore {
  const total = tasks.reduce((s, t) => s + t.weight, 0);
  const got = tasks.reduce((s, t) => s + t.weight * Math.max(0, Math.min(1, results.get(t.id) ?? 0)), 0);
  const failed = tasks.filter((t) => (results.get(t.id) ?? 0) < 1).map((t) => t.id);
  const criticalFailed = tasks.filter((t) => t.critical && (results.get(t.id) ?? 0) < 1).map((t) => t.id);
  const beyond = tasks.filter((t) => t.beyond);
  const bTotal = beyond.reduce((s, t) => s + t.weight, 0);
  const bGot = beyond.reduce((s, t) => s + t.weight * (results.get(t.id) ?? 0), 0);
  const score = total ? got / total : 0;
  const criticalOk = criticalFailed.length === 0;
  // Compare in whole points so 0.7 * 100 does not fail on floating point.
  const passed = criticalOk && Math.round(score * 10000) >= Math.round(exam.pass * 10000);
  return { total, got, score, criticalOk, passed, failed, criticalFailed, beyondSolved: bTotal ? bGot / bTotal : 0 };
}

/** Share of the practice weight on beyond-the-course tasks in a variant. */
export function beyondShare(tasks: readonly ExamTask[]): number {
  const total = tasks.reduce((s, t) => s + t.weight, 0);
  return total ? tasks.filter((t) => t.beyond).reduce((s, t) => s + t.weight, 0) / total : 0;
}

export interface PastExam {
  mode: 'exam' | 'training';
  passed: boolean;
  at: string;
}

/** Retake in 24 hours with a new variant, attempts unlimited (10 §6.1). Training is always open. */
export function examGate(history: readonly PastExam[], now: Date, hours = RETAKE_HOURS): { allowed: boolean; opensAt?: string; passed: boolean } {
  const exams = history.filter((h) => h.mode === 'exam');
  const passed = exams.some((h) => h.passed);
  const last = exams[exams.length - 1];
  if (!last || last.passed) return { allowed: true, passed };
  const opens = Date.parse(last.at) + hours * 3600 * 1000;
  return opens <= now.getTime() ? { allowed: true, passed } : { allowed: false, opensAt: new Date(opens).toISOString(), passed };
}

/**
 * The frame every block exam must follow (10 §6.1), as text problems:
 * practice weights sum to 100; at least one critical task; beyond-the-course
 * tasks are never critical and take at least 10% of the weight in every
 * variant; every task id is unique; pools have at least two tasks of equal weight.
 */
export function lintExam(exam: Exam): string[] {
  const out: string[] = [];
  const ids = exam.tasks.map((t) => t.id);
  if (new Set(ids).size !== ids.length) out.push('duplicate task ids');
  if (!(exam.pass >= 0.66 && exam.pass <= 0.85)) out.push(`pass threshold ${exam.pass} is outside 0.66–0.85`);
  const pools = new Map<string, ExamTask[]>();
  for (const t of exam.tasks) if (t.pool) (pools.get(t.pool) ?? pools.set(t.pool, []).get(t.pool)!).push(t);
  for (const [p, list] of pools) {
    if (list.length < 2) out.push(`pool "${p}" has a single task`);
    if (new Set(list.map((t) => t.weight)).size > 1) out.push(`pool "${p}" mixes weights`);
    if (new Set(list.map((t) => !!t.critical)).size > 1) out.push(`pool "${p}" mixes critical and non-critical tasks`);
  }
  // The first variant is representative: pools have equal weights.
  const variant = pickTasks(exam, 'lint');
  const sum = variant.reduce((s, t) => s + t.weight, 0);
  if (sum !== 100) out.push(`practice weights sum to ${sum}, expected 100`);
  if (!variant.some((t) => t.critical)) out.push('no critical task');
  for (const t of exam.tasks) if (t.beyond && t.critical) out.push(`task ${t.id} is beyond the course and critical`);
  if (exam.kind !== 'capstone' && beyondShare(variant) < BEYOND_MIN.beginner) out.push(`beyond-the-course share ${Math.round(beyondShare(variant) * 100)}% is below 10%`);
  if ((exam.explain?.length ?? 0) > 0 && exam.explain!.some((q) => !q.keyPoints.length)) out.push('an explain question has no key points');
  return out;
}

export interface ProtocolTask {
  id: string;
  title: string;
  weight: number;
  critical: boolean;
  beyond: boolean;
  result: number;
}

/** The exam protocol (10 §11): what was checked and how; it is not a certificate. */
export interface ExamProtocol {
  format: 'devops-trainer/exam-protocol@1';
  exam: string;
  title: string;
  seed: string;
  mode: 'exam' | 'training';
  authenticity: 'self';
  env: 'sim';
  started: string;
  finished: string;
  minutes: number;
  overTime: boolean;
  score: number;
  passed: boolean;
  checks: ProtocolTask[];
  docOpens: { page: string; anchor?: string; at: string }[];
  explain: { id: string; covered: number; of: number }[];
  readinessMark: boolean;
}

export function protocol(p: Omit<ExamProtocol, 'format' | 'authenticity' | 'env' | 'readinessMark'>): ExamProtocol {
  const readinessMark = p.explain.length > 0 && p.explain.every((e) => e.of > 0 && e.covered / e.of >= 0.75);
  return { format: 'devops-trainer/exam-protocol@1', authenticity: 'self', env: 'sim', readinessMark, ...p };
}
