// Documentation support is bounded by the lesson and learner level.

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

  return Math.min(startStep(level) + Math.max(0, index), table[level][third]) as DocStep;
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
  lessonStep?: DocStep;
  exam?: boolean;
}

/** The step a learner is on for one source at one place of the course. */
export function effectiveStep(i: LadderInput): DocStep {
  if (i.exam) return 5;
  const scheduled = scheduleStep(i.level, i.index, i.count);
  const earlyBlock = ['orientation', 'orient', 'methodology'].includes(i.block);
  const ceiling = i.level === 'beginner' && earlyBlock ? 2 : 4;
  const lesson = Math.min(ceiling, i.lessonStep ?? scheduled, startStep(i.level) + Math.max(0, i.index));
  // A task may offer more help, but cannot remove help promised by its lesson.
  return Math.max(1, Math.min(lesson, i.override ?? lesson)) as DocStep;
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
  3: { ru: 'найдите флаг', en: 'find the flag' },
  4: { ru: 'принуждение', en: 'forcing' },
  5: { ru: 'экзамен', en: 'exam' },
};

export function isKnownSource(s: string): s is DocSource {
  return s.length > 0;
}
