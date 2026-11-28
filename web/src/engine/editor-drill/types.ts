// The shapes of the editor key trainer (Vim course §6.2 item 7, Emacs
// course §6.2 item 14). Pure data: no CodeMirror here, so the drill catalog
// and the checks load in Node and in the route manifest without the editor.

import type { Bi } from '../../core/i18n';

/**
 * Which key layer runs a drill. `cm-vim` is CodeMirror 6 with
 * @replit/codemirror-vim, `cm-emacs` is CodeMirror 6 with the trainer's own
 * Emacs layer (`emacs.ts`). The tag travels with every drill so the trace
 * builder can replay the same keys in the real editor (see `session.ts`).
 */
export type DrillEngine = 'cm-vim' | 'cm-emacs';

/** A position in the buffer: 0-based line and 0-based column in UTF-16 code units. */
export interface Cursor {
  line: number;
  ch: number;
}

/** What a drill starts from. */
export interface DrillStart {
  text: string;
  cursor: Cursor;
}

/**
 * The state of the trainer after the keys, the only thing a check reads.
 * `registers` holds Vim registers by name (`"`, `0`, `-`, `1`–`9`, `a`–`z`)
 * or Emacs text registers; `killRing` is the Emacs kill ring, newest first.
 */
export interface DrillState {
  text: string;
  cursor: Cursor;
  /** `normal`, `insert`, `visual` for Vim; Emacs is always `normal`. */
  mode: string;
  registers: Record<string, string>;
  killRing: string[];
}

/** The goal of a drill. Fields left out are not checked. */
export interface DrillTarget {
  text: string;
  cursor?: Cursor;
  /** Only the named registers are compared. */
  registers?: Record<string, string>;
  /** The newest entries of the kill ring, newest first; older entries are not compared. */
  killRing?: string[];
}

export interface Drill {
  id: string;
  engine: DrillEngine;
  title: Bi;
  /** What to do, in words; no keys in it, so the learner recalls them. */
  task: Bi;
  start: DrillStart;
  target: DrillTarget;
  /**
   * One shortest known solution in the editor's own notation: Vim key
   * notation (`d2w`, `<Esc>`, `<C-v>`) or Emacs `kbd` notation
   * (`C-k C-k C-n C-y`). The same string is fed to the real editor by the
   * trace builder. It sets the key budget, which is feedback only.
   */
  solution: string;
  /** The drill is failed if an arrow key was used (the only key-based condition). */
  noArrows?: boolean;
  /** Shown after a pass: what the drill trained and where it is in the real editor. */
  explain?: Bi;
}

/** One difference between the learner's state and the target, in words. */
export interface DrillMismatch {
  field: 'text' | 'cursor' | 'register' | 'killRing' | 'arrows';
  message: Bi;
}

export interface DrillVerdict {
  ok: boolean;
  mismatches: DrillMismatch[];
}
