// The documentation ladder (01 §11.3, 08 §4.3). The step is kept per
// documentation source and never goes down. Inside a block it rises with the
// module position, so forcing (DL4) reaches every learner; in a new block a
// source starts no lower than one step under what was reached before; three
// tasks in a row without H4–H5 lift the source one step early.

import type { BlockId, DocSource, DocStep, HintLevel, Level } from '../../core/types';

/** Start step by level: Beginner DL1, Intermediate DL2, Experienced DL3. */
export function startStep(level: Level): DocStep {
  return level === 'beginner' ? 1 : level === 'intermediate' ? 2 : 3;
}

/**
 * The schedule by module position (01 §11.3): first third, second third, last
 * third; the last module of a beginner is DL4.
 */
export function scheduleStep(level: Level, index: number, count: number): DocStep {
  if (count <= 0) return startStep(level);
  const third = Math.min(2, Math.floor((index / count) * 3));
  const table: Record<Level, DocStep[]> = {
    beginner: [1, 2, 3],
    intermediate: [2, 3, 4],
    experienced: [3, 4, 4],
  };
  if (level === 'beginner' && index === count - 1 && count > 1) return 4;
  return table[level][third];
}

export interface LadderInput {
  level: Level;
  block: BlockId;
  /** Position of the lesson in its block and the block's lesson count. */
  index: number;
  count: number;
  /** What the learner reached with this source before (from progress.docLadder). */
  stored?: { step: DocStep; block: BlockId; streak: number };
  /** Task or lesson override (08 §4.3 doc_step). A forced step wins over the schedule. */
  override?: DocStep;
  exam?: boolean;
}

/** The step a learner is on for one source at one place of the course. */
export function effectiveStep(i: LadderInput): DocStep {
  if (i.exam) return 5;
  let step = Math.max(startStep(i.level), scheduleStep(i.level, i.index, i.count));
  if (i.stored) {
    const carried = i.stored.block === i.block ? i.stored.step : Math.max(1, i.stored.step - 1);
    // Early rise: three tasks in a row at this step without H4–H5.
    const early = i.stored.streak >= 3 ? Math.min(4, i.stored.step + 1) : i.stored.step;
    step = Math.max(step, carried, i.stored.block === i.block ? early : carried);
  }
  if (i.override) step = Math.max(step, i.override);
  return Math.min(5, step) as DocStep;
}

export interface HintPolicy {
  /** Hints the learner may open, in order. */
  allowed: HintLevel[];
  /** What H3 is at this step: our text, the page fragment, or only the page link. */
  h3: 'text' | 'fragment' | 'link';
  /** Command chips under the prompt: the whole command, only its name, or none. */
  chips: 'full' | 'name' | 'none';
  /** Show the `docref` flicker chip next to the task. */
  docref: boolean;
  /** The mentor's mode on this step. */
  mentor: 'practice' | 'docs' | 'off';
}

export function hintPolicy(step: DocStep): HintPolicy {
  switch (step) {
    case 1:
      return { allowed: ['H1', 'H2', 'H3', 'H4', 'H5'], h3: 'text', chips: 'full', docref: true, mentor: 'practice' };
    case 2:
      return { allowed: ['H1', 'H2', 'H3', 'H4'], h3: 'fragment', chips: 'full', docref: true, mentor: 'practice' };
    case 3:
      return { allowed: ['H1', 'H2', 'H3'], h3: 'link', chips: 'name', docref: false, mentor: 'practice' };
    case 4:
      return { allowed: [], h3: 'link', chips: 'none', docref: false, mentor: 'docs' };
    case 5:
      return { allowed: [], h3: 'link', chips: 'none', docref: false, mentor: 'off' };
  }
}

/** Should a new step be recorded for this source (never lower than what is stored)? */
export function shouldRecord(next: DocStep, stored?: { step: DocStep; block: BlockId }, block?: BlockId): boolean {
  if (!stored) return true;
  return next > stored.step || (next === stored.step && block !== undefined && stored.block !== block);
}

export const STEP_NAMES: Record<DocStep, { ru: string; en: string }> = {
  1: { ru: 'мелькает', en: 'flicker' },
  2: { ru: 'анатомия', en: 'anatomy' },
  3: { ru: 'найди флаг', en: 'find the flag' },
  4: { ru: 'принуждение', en: 'forcing' },
  5: { ru: 'экзамен', en: 'exam' },
};

export function isKnownSource(s: string): s is DocSource {
  return s.length > 0;
}
