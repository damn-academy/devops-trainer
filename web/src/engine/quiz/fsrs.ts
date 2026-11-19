// Spaced review on FSRS (01 §12, 10 §3.4), in the ts-fsrs implementation.
// One card per concept, not per question. The card state is a pure replay of
// the event log: a finished lesson creates the card, a passed placement
// creates it with a later first review, and every graded review
// (`x.review.grade`) moves it. Nothing about the schedule is stored apart
// from the log, so changing the parameters later re-plans everything.

import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs';
import type { ConceptId, Confidence, StoreEvent } from '../../core/types';

/** Target probability of recall (01 §12). */
export const TARGET_RETENTION = 0.9;
/** The daily review budget: up to 15 minutes or 30 cards (01 §12). */
export const DAILY_MINUTES = 15;
export const DAILY_CARDS = 30;
/** Event kind of one graded review. */
export const REVIEW_EVENT = 'x.review.grade';

export { Rating, State };
export type { Card, Grade };

export function scheduler(retention = TARGET_RETENTION) {
  return fsrs(generatorParameters({ request_retention: retention, enable_fuzz: false, enable_short_term: true }));
}

export interface ReviewOutcome {
  correct: boolean;
  confidence: Confidence;
  /** Time to answer. */
  ms: number;
  /** Time norm of the format (seconds × 1000). */
  normMs: number;
  /** A hint or a lower doc-ladder step was used. */
  hinted?: boolean;
}

/**
 * Automatic grading → FSRS rating (01 §12): a mistake is Again; right with a
 * hint, slower than twice the norm, or right while "guessing" is Hard (a lucky
 * guess is not knowledge, 01 §4.1); right within the norm is Good; right in
 * less than half the norm with "I know" is Easy.
 */
export function ratingFor(o: ReviewOutcome): Grade {
  if (!o.correct) return Rating.Again;
  if (o.hinted || o.confidence === 1 || o.ms > 2 * o.normMs) return Rating.Hard;
  if (o.confidence === 3 && o.ms < o.normMs / 2) return Rating.Easy;
  return Rating.Good;
}

export const RATING_NAMES: Record<number, { ru: string; en: string }> = {
  [Rating.Again]: { ru: 'снова', en: 'again' },
  [Rating.Hard]: { ru: 'с трудом', en: 'hard' },
  [Rating.Good]: { ru: 'вспомнил', en: 'good' },
  [Rating.Easy]: { ru: 'легко', en: 'easy' },
};

/** The `x.review.grade` event: one concept, one item, one rating. */
export interface ReviewGradeEvent {
  kind: typeof REVIEW_EVENT;
  concept: ConceptId;
  item: string;
  /** Format of the item: mcq, fill-command, task… (rule 1 of 10 §3.4: another format each time). */
  format: string;
  rating: Grade;
  correct: boolean;
  confidence: Confidence;
  ms: number;
}

export interface ConceptCard {
  concept: ConceptId;
  card: Card;
  /** Formats of the last reviews, newest last. */
  formats: string[];
  /** Formats in which the concept was answered right. */
  rightFormats: string[];
  /** Item ids of the last reviews, newest last. */
  items: string[];
  reviews: number;
  /** A mistake made with "I know": comes back in the same session (10 §3.4 rule 3). */
  confidentMiss: boolean;
}

const DAY = 24 * 3600 * 1000;

function newCard(at: Date, firstReviewDays: number): Card {
  const c = createEmptyCard(at);
  c.due = new Date(at.getTime() + firstReviewDays * DAY);
  return c;
}

/**
 * Replay the log into concept cards. A finished lesson schedules the first
 * review a day later; a placement-confirmed concept three days later (the
 * delayed check proves it is really known, 01 §2.2).
 */
export function buildCards(events: readonly StoreEvent[], f = scheduler()): Map<ConceptId, ConceptCard> {
  const cards = new Map<ConceptId, ConceptCard>();
  const ensure = (concept: ConceptId, at: Date, days: number) => {
    let c = cards.get(concept);
    if (!c) {
      c = { concept, card: newCard(at, days), formats: [], rightFormats: [], items: [], reviews: 0, confidentMiss: false };
      cards.set(concept, c);
    }
    return c;
  };
  for (const e of events) {
    const at = new Date(e.t);
    if (e.kind === 'lesson.done') for (const c of e.concepts) ensure(c, at, 1);
    else if (e.kind === 'placement.result' && e.passed) {
      for (const c of e.concepts) if (!e.gaps.includes(c)) ensure(c, at, 3);
    } else if (e.kind === REVIEW_EVENT) {
      const g = e as unknown as ReviewGradeEvent & StoreEvent;
      const c = ensure(g.concept, at, 0);
      c.card = f.next(c.card, at, g.rating).card;
      c.formats = [...c.formats, g.format].slice(-6);
      c.items = [...c.items, g.item].slice(-12);
      if (g.correct && !c.rightFormats.includes(g.format)) c.rightFormats.push(g.format);
      c.confidentMiss = !g.correct && g.confidence === 3;
      c.reviews++;
    }
  }
  return cards;
}

/** Cards due at `now`, most overdue first. */
export function dueCards(cards: Map<ConceptId, ConceptCard>, now: Date): ConceptCard[] {
  return [...cards.values()].filter((c) => c.card.due.getTime() <= now.getTime()).sort((a, b) => a.card.due.getTime() - b.card.due.getTime());
}

/** Probability of recall now, 0..1. */
export function recall(c: ConceptCard, now: Date, f = scheduler()): number {
  if (c.card.state === State.New) return 1;
  return f.get_retrievability(c.card, now, false);
}

/** Days to the next review for each rating, from now (for the explainer and the "why today" line). */
export function forecast(card: Card, now: Date, f = scheduler()): Record<'again' | 'hard' | 'good' | 'easy', number> {
  const p = f.repeat(card, now);
  const d = (g: Grade) => (p[g].card.due.getTime() - now.getTime()) / DAY;
  return { again: d(Rating.Again), hard: d(Rating.Hard), good: d(Rating.Good), easy: d(Rating.Easy) };
}

/** A reviewable thing for a concept: a bank item or a sandbox micro-task. */
export interface Candidate {
  id: string;
  /** mcq, multi, order, match, fill-command, predict-output, bugfind, label, task. */
  format: string;
  /** Expected seconds (time norm). */
  seconds: number;
  /** Needs a keyboard and a wide screen (sandbox micro-tasks wait for a computer). */
  desktop?: boolean;
}

/** Time norms per format in seconds (01 §12: micro-tasks 30–90 s). */
export const FORMAT_SECONDS: Record<string, number> = {
  mcq: 30,
  multi: 45,
  order: 50,
  match: 50,
  'fill-command': 45,
  'predict-output': 45,
  bugfind: 40,
  label: 50,
  task: 90,
};

/**
 * Pairs that are easy to confuse and are put next to each other on purpose
 * (01 §12, interleaving after Bjork). Ids that are not in the build are ignored.
 */
export const CONFUSABLE: [ConceptId, ConceptId][] = [
  ['linux.namespaces', 'k8s.namespace'],
  ['docker.storage', 'k8s.storage'],
  ['net.nat', 'k8s.service'],
  ['linux.cgroups', 'k8s.resources'],
  ['docker.pid1-signals', 'k8s.probes'],
  ['net.tcp', 'net.udp'],
  ['k8s.configmap', 'k8s.secret'],
  ['career.q-ci-cd', 'cicd.pipeline'],
];

export interface QueueEntry {
  concept: ConceptId;
  candidate: Candidate;
  /** Why it is here today, for the line under the card. */
  reason: 'due' | 'confident-miss' | 'lapsed';
}

export interface QueueOptions {
  now: Date;
  /** Which block a concept belongs to (to interleave blocks). */
  blockOf(concept: ConceptId): string | undefined;
  /** Everything that can review a concept. */
  candidates(concept: ConceptId): Candidate[];
  minutes?: number;
  maxCards?: number;
  /** A narrow screen: skip desktop-only candidates (they wait for a computer). */
  phone?: boolean;
}

/**
 * Pick the candidate for a concept: another format than last time (rule 1);
 * every third review of a concept with a practical side is a sandbox
 * micro-task (rule 2); otherwise the item seen least recently.
 */
export function pickCandidate(card: ConceptCard | undefined, list: Candidate[], phone = false): Candidate | undefined {
  const usable = list.filter((c) => !(phone && c.desktop));
  if (!usable.length) return undefined;
  const lastFormat = card?.formats[card.formats.length - 1];
  const reviews = card?.reviews ?? 0;
  const tasks = usable.filter((c) => c.format === 'task');
  if (tasks.length && reviews > 0 && (reviews + 1) % 3 === 0) return leastRecent(tasks, card);
  const other = usable.filter((c) => c.format !== lastFormat && c.format !== 'task');
  const pool = other.length ? other : usable.filter((c) => c.format !== 'task').length ? usable.filter((c) => c.format !== 'task') : usable;
  return leastRecent(pool, card);
}

function leastRecent(list: Candidate[], card: ConceptCard | undefined): Candidate {
  const items = card?.items ?? [];
  const age = (c: Candidate) => {
    const i = items.lastIndexOf(c.id);
    return i < 0 ? -1 : i;
  };
  return [...list].sort((a, b) => age(a) - age(b) || a.id.localeCompare(b.id))[0];
}

/**
 * Today's queue (01 §12): due concepts, most overdue first, interleaved
 * across blocks round-robin, confusable pairs side by side, cut at the time
 * budget (15 minutes) or 30 cards. A concept with nothing to ask is skipped.
 */
export function buildQueue(cards: Map<ConceptId, ConceptCard>, o: QueueOptions): QueueEntry[] {
  const budget = (o.minutes ?? DAILY_MINUTES) * 60;
  const max = o.maxCards ?? DAILY_CARDS;
  const due = dueCards(cards, o.now);
  // Confident mistakes first: they are the most valuable to correct (hypercorrection).
  due.sort((a, b) => Number(b.confidentMiss) - Number(a.confidentMiss));
  const byBlock = new Map<string, ConceptCard[]>();
  for (const c of due) {
    const b = o.blockOf(c.concept) ?? '';
    if (!byBlock.has(b)) byBlock.set(b, []);
    byBlock.get(b)!.push(c);
  }
  const lanes = [...byBlock.values()];
  const order: ConceptCard[] = [];
  for (let i = 0; lanes.some((l) => l.length > i); i++) for (const l of lanes) if (l[i]) order.push(l[i]);
  // Confusable pairs next to each other.
  for (const [a, b] of CONFUSABLE) {
    const ia = order.findIndex((c) => c.concept === a);
    const ib = order.findIndex((c) => c.concept === b);
    if (ia >= 0 && ib >= 0 && Math.abs(ia - ib) > 1) {
      const [moved] = order.splice(ib, 1);
      order.splice(order.findIndex((c) => c.concept === a) + 1, 0, moved);
    }
  }
  const out: QueueEntry[] = [];
  let seconds = 0;
  for (const c of order) {
    if (out.length >= max) break;
    const cand = pickCandidate(c, o.candidates(c.concept), o.phone);
    if (!cand) continue;
    if (out.length && seconds + cand.seconds > budget) break;
    seconds += cand.seconds;
    out.push({ concept: c.concept, candidate: cand, reason: c.confidentMiss ? 'confident-miss' : c.card.state === State.Relearning ? 'lapsed' : 'due' });
  }
  return out;
}

/** Estimated minutes of a queue. */
export function queueMinutes(q: QueueEntry[]): number {
  return Math.ceil(q.reduce((s, e) => s + e.candidate.seconds, 0) / 60);
}
