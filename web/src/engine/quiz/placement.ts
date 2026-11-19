// The placement check "show what you already know" (01 §4.1, 10 §3.5) as
// pure functions: which tasks a variant has, how the result is scored, when a
// retake is allowed. The page (app/exam-placement.ts) only renders.
//
// Rules: 80% of the tasks (rounded up) and every key task; a right answer
// marked "guessing" does not count; failed tasks become gaps (concepts whose
// lessons open even at the claimed level), never a silent downgrade; a retake
// in 72 hours with another variant, two attempts, then module by module.

import type { ConceptId, Level, PlacementTask } from '../../core/types';

export const PASS_SHARE = 0.8;
export const RETAKE_HOURS = 72;
export const MAX_ATTEMPTS = 2;

/** Variants defined for a level, sorted; [1] when no task names one. */
export function variantsOf(tasks: readonly PlacementTask[], level: Level): number[] {
  const set = new Set(tasks.filter((t) => t.level === level && t.variant !== undefined).map((t) => t.variant!));
  return set.size ? [...set].sort((a, b) => a - b) : [1];
}

/** Tasks of one variant: the variant's own tasks plus those without a variant, in authoring order. */
export function tasksOf(tasks: readonly PlacementTask[], level: Level, variant: number): PlacementTask[] {
  return tasks.filter((t) => t.level === level && (t.variant === undefined || t.variant === variant));
}

export interface PastAttempt {
  claimed: Level;
  passed: boolean;
  at: string;
}

/** The variant for the next attempt: attempt k takes the k-th variant, round the list. */
export function nextVariant(tasks: readonly PlacementTask[], level: Level, history: readonly PastAttempt[]): number {
  const vs = variantsOf(tasks, level);
  const done = history.filter((h) => h.claimed === level).length;
  return vs[done % vs.length];
}

export interface RetakeState {
  /** May start now. */
  allowed: boolean;
  /** When the next attempt opens (ISO), if not now. */
  opensAt?: string;
  /** Failed attempts at this level so far. */
  failures: number;
  /** After two failures the check goes module by module (exit tickets), 01 §4.1. */
  moduleByModule: boolean;
  /** Already confirmed at this level. */
  confirmed: boolean;
}

export function retakeState(history: readonly PastAttempt[], level: Level, now: Date, hours = RETAKE_HOURS): RetakeState {
  const mine = history.filter((h) => h.claimed === level);
  const confirmed = mine.some((h) => h.passed);
  const failures = mine.filter((h) => !h.passed).length;
  const last = mine[mine.length - 1];
  if (confirmed || !last || last.passed) return { allowed: true, failures, moduleByModule: false, confirmed };
  if (failures >= MAX_ATTEMPTS) return { allowed: false, failures, moduleByModule: true, confirmed };
  const opens = Date.parse(last.at) + hours * 3600 * 1000;
  return opens <= now.getTime() ? { allowed: true, failures, moduleByModule: false, confirmed } : { allowed: false, opensAt: new Date(opens).toISOString(), failures, moduleByModule: false, confirmed };
}

export interface PlacementAnswer {
  id: string;
  /** The check held (quiz right, terminal goal reached). */
  right: boolean;
  /** Confidence was "guessing" (quiz only). */
  guessed?: boolean;
}

export interface PlacementScore {
  /** Share of counted tasks, 0..1. */
  score: number;
  counted: number;
  /** Tasks needed: 80% rounded up. */
  needed: number;
  total: number;
  keysOk: boolean;
  passed: boolean;
  /** Task ids that did not count (wrong, not done, or guessed). */
  failed: string[];
  /** Right answers that did not count because they were guesses. */
  guessed: string[];
  /** Concepts the check covered. */
  concepts: ConceptId[];
  /** Concepts of the failed tasks: their lessons open even at the claimed level. */
  gaps: ConceptId[];
}

export function scorePlacement(tasks: readonly PlacementTask[], answers: readonly PlacementAnswer[]): PlacementScore {
  const byId = new Map(answers.map((a) => [a.id, a]));
  const counts = (t: PlacementTask) => {
    const a = byId.get(t.id);
    return !!a && a.right && !a.guessed;
  };
  const total = tasks.length;
  const countedTasks = tasks.filter(counts);
  const failedTasks = tasks.filter((t) => !counts(t));
  const needed = Math.ceil(total * PASS_SHARE);
  const keysOk = tasks.every((t) => !t.key || counts(t));
  const passed = total > 0 && countedTasks.length >= needed && keysOk;
  const concepts = [...new Set(tasks.flatMap((t) => t.concepts))];
  const gaps = [...new Set(failedTasks.flatMap((t) => t.concepts))];
  return {
    score: total ? countedTasks.length / total : 0,
    counted: countedTasks.length,
    needed,
    total,
    keysOk,
    passed,
    failed: failedTasks.map((t) => t.id),
    guessed: tasks.filter((t) => byId.get(t.id)?.right && byId.get(t.id)?.guessed).map((t) => t.id),
    concepts,
    gaps,
  };
}

/** Contract checks for a block's placement (10 §3.5, 01 §4.1); returns problems as text. */
export function lintPlacement(tasks: readonly PlacementTask[], opts: { career?: boolean } = {}): string[] {
  const out: string[] = [];
  for (const level of ['intermediate', 'experienced'] as Level[]) {
    for (const v of variantsOf(tasks, level)) {
      const set = tasksOf(tasks, level, v);
      if (!set.length) continue;
      if (set.length < 5 || set.length > 10) out.push(`${level} v${v}: ${set.length} tasks, expected 5–10`);
      if (opts.career) continue;
      const practical = set.filter((t) => t.kind === 'task');
      if (practical.length * 2 < set.length) out.push(`${level} v${v}: fewer than half of the tasks are practical`);
      if (practical.filter((t) => t.key).length < 2) out.push(`${level} v${v}: fewer than two key practical tasks`);
    }
  }
  const ids = tasks.map((t) => t.id);
  if (new Set(ids).size !== ids.length) out.push('duplicate placement task ids');
  return out;
}
