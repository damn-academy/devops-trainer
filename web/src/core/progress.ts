// Progress as a pure function of the event log (01 §2.3, 09 §3). Changing
// the rules of state transitions later does not lose history: the log is
// replayed with the new reducer.

import type { BlockId, ConceptId, ConceptState, DocStep, Level, LessonId, StoreEvent } from './types';

export interface ConceptProgress {
  state: ConceptState;
  /** Review box of the simple spaced schedule (0 = again today). FSRS replaces it later. */
  box: number;
  /** ISO date when the next review is due. */
  due?: string;
  /** Consecutive failures in review (two from mastered → lapsed). */
  fails: number;
}

export interface LessonProgress {
  status: 'open' | 'done';
  sections: string[];
  openedAt: string;
  doneAt?: string;
}

export interface PlacementRecord {
  claimed: Level;
  passed: boolean;
  score: number;
  at: string;
  failed: string[];
  gaps: ConceptId[];
}

export interface Progress {
  levels: Record<BlockId, Level>;
  placement: Record<BlockId, PlacementRecord[]>;
  concepts: Record<ConceptId, ConceptProgress>;
  lessons: Record<LessonId, LessonProgress>;
  /** Ladder step per documentation source; never goes down. `block` is where it was reached. */
  docLadder: Record<string, { step: DocStep; block: BlockId; streak: number }>;
  explainers: Record<string, { maxStep: number; total: number; done: boolean; predictions: number; right: number }>;
  quiz: Record<string, { firstCorrect: boolean; attempts: number; lastAt: string; confidence: number[] }>;
  tasks: Record<string, { passedAt: string; hintLevel: number; docStep: DocStep; docOpened: boolean }>;
  exams: Record<string, { mode: 'exam' | 'training'; score: number; passed: boolean; at: string }[]>;
  /** Pages opened, newest last (the doc trail for the mentor and the exam review). */
  docTrail: { page: string; anchor?: string; at: string }[];
  /** Calibration: confidence vs correctness, counted per confidence level. */
  calibration: Record<1 | 2 | 3, { n: number; right: number }>;
  meta: { firstAt?: string; lastAt?: string; lastExportAt?: string; lastReminderAt?: string; events: number };
}

export function emptyProgress(): Progress {
  return {
    levels: {},
    placement: {},
    concepts: {},
    lessons: {},
    docLadder: {},
    explainers: {},
    quiz: {},
    tasks: {},
    exams: {},
    docTrail: [],
    calibration: { 1: { n: 0, right: 0 }, 2: { n: 0, right: 0 }, 3: { n: 0, right: 0 } },
    meta: { events: 0 },
  };
}

const RANK: Record<ConceptState, number> = { unseen: 0, lapsed: 1, placed: 2, introduced: 3, practicing: 4, mastered: 5 };
/** Days to the next review by box. */
export const INTERVALS = [0, 1, 3, 7, 16, 35];

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function concept(p: Progress, id: ConceptId): ConceptProgress {
  return (p.concepts[id] ??= { state: 'unseen', box: 0, fails: 0 });
}

/** Raise a concept's state; never lowers it (lowering happens only through review failures). */
function raise(p: Progress, id: ConceptId, to: ConceptState, at: string): void {
  const c = concept(p, id);
  if (RANK[to] > RANK[c.state] || c.state === 'lapsed') {
    const wasNew = c.state === 'unseen';
    c.state = to;
    if (wasNew || !c.due) c.due = addDays(at, to === 'placed' ? 3 : 1);
  }
}

/** Apply one event (mutates and returns `p`). */
export function apply(p: Progress, e: StoreEvent): Progress {
  p.meta.events++;
  p.meta.firstAt ??= e.t;
  p.meta.lastAt = e.t;
  switch (e.kind) {
    case 'level.set':
      p.levels[e.block] = e.level;
      break;
    case 'placement.result':
      (p.placement[e.block] ??= []).push({ claimed: e.claimed, passed: e.passed, score: e.score, at: e.t, failed: e.failed, gaps: e.gaps });
      if (e.passed) for (const c of e.concepts) if (!e.gaps.includes(c)) raise(p, c, 'placed', e.t);
      break;
    case 'lesson.open': {
      const l = (p.lessons[e.lesson] ??= { status: 'open', sections: [], openedAt: e.t });
      l.openedAt ??= e.t;
      break;
    }
    case 'section.done': {
      const l = (p.lessons[e.lesson] ??= { status: 'open', sections: [], openedAt: e.t });
      if (!l.sections.includes(e.section)) l.sections.push(e.section);
      break;
    }
    case 'lesson.done': {
      const l = (p.lessons[e.lesson] ??= { status: 'open', sections: [], openedAt: e.t });
      l.status = 'done';
      l.doneAt ??= e.t;
      for (const c of e.concepts) raise(p, c, 'introduced', e.t);
      break;
    }
    case 'quiz.answer': {
      const q = (p.quiz[e.item] ??= { firstCorrect: e.correct, attempts: 0, lastAt: e.t, confidence: [] });
      q.attempts++;
      q.lastAt = e.t;
      q.confidence.push(e.confidence);
      if (q.attempts === 1) {
        p.calibration[e.confidence].n++;
        if (e.correct) p.calibration[e.confidence].right++;
      }
      if (e.context === 'review') {
        for (const id of e.concepts) {
          const c = concept(p, id);
          if (e.correct) {
            c.box = Math.min(INTERVALS.length - 1, c.box + 1);
            c.fails = 0;
            c.due = addDays(e.t, INTERVALS[c.box]);
            if (c.box >= 3 && RANK[c.state] >= RANK.practicing) c.state = 'mastered';
          } else {
            c.fails++;
            c.box = 0;
            // A confident mistake comes back the same session and tomorrow (10 §3.4).
            c.due = e.confidence === 3 ? e.t : addDays(e.t, 1);
            if (c.state === 'mastered' && c.fails >= 2) c.state = 'lapsed';
          }
        }
      }
      break;
    }
    case 'task.pass':
      if (!p.tasks[e.task]) p.tasks[e.task] = { passedAt: e.t, hintLevel: e.hintLevel, docStep: e.docStep, docOpened: e.docOpened };
      if (e.hintLevel < 4) for (const c of e.concepts) raise(p, c, 'practicing', e.t);
      if (e.source) {
        const d = p.docLadder[e.source];
        if (d) d.streak = e.hintLevel < 4 ? d.streak + 1 : 0;
      }
      break;
    case 'doc.open':
      p.docTrail.push({ page: e.page, anchor: e.anchor, at: e.t });
      if (p.docTrail.length > 200) p.docTrail.shift();
      break;
    case 'doc.step': {
      const d = p.docLadder[e.source];
      if (!d || e.step > d.step) p.docLadder[e.source] = { step: e.step, block: e.block, streak: 0 };
      else if (d && e.step === d.step) d.block = e.block;
      break;
    }
    case 'explainer.step': {
      const x = (p.explainers[e.explainer] ??= { maxStep: -1, total: e.total, done: false, predictions: 0, right: 0 });
      x.maxStep = Math.max(x.maxStep, e.step);
      x.total = e.total;
      break;
    }
    case 'explainer.predict': {
      const x = (p.explainers[e.explainer] ??= { maxStep: -1, total: 0, done: false, predictions: 0, right: 0 });
      x.predictions++;
      if (e.correct) x.right++;
      break;
    }
    case 'explainer.done': {
      const x = (p.explainers[e.explainer] ??= { maxStep: -1, total: 0, done: false, predictions: 0, right: 0 });
      x.done = true;
      break;
    }
    case 'exam.result':
      (p.exams[e.exam] ??= []).push({ mode: e.mode, score: e.score, passed: e.passed, at: e.t });
      break;
    case 'progress.export':
      p.meta.lastExportAt = e.t;
      break;
    case 'reminder.shown':
    case 'reminder.dismissed':
      p.meta.lastReminderAt = e.t;
      break;
    default:
      break;
  }
  return p;
}

export function replay(events: StoreEvent[]): Progress {
  const p = emptyProgress();
  for (const e of events) apply(p, e);
  return p;
}

/** Concepts due for review at `now`, most overdue first. */
export function dueConcepts(p: Progress, now = new Date().toISOString()): ConceptId[] {
  return Object.entries(p.concepts)
    .filter(([, c]) => c.state !== 'unseen' && c.due !== undefined && c.due <= now)
    .sort((a, b) => (a[1].due! < b[1].due! ? -1 : 1))
    .map(([id]) => id);
}

/** The weekly one-line reminder: no account, some progress, nothing exported or shown in the last 7 days. */
export function reminderDue(p: Progress, now: Date, signedIn: boolean): boolean {
  if (signedIn || p.meta.events < 5) return false;
  const week = 7 * 24 * 3600 * 1000;
  const last = [p.meta.lastExportAt, p.meta.lastReminderAt, p.meta.firstAt].filter(Boolean).map((t) => Date.parse(t!));
  const newest = Math.max(...last);
  return now.getTime() - newest >= week;
}
