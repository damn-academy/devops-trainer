// The situational drill (10 §9.2): the learner names the next step — by
// picking one of 4–6 moves or by typing a command — and the sandbox shows
// what that step would show for the hidden cause (the variant). Wrong moves
// are kept in the path with their explanation; the score follows the drill
// rubric (layer and evidence, method, safety, result, status to the team).
// Pure functions: the widget renders, the tests check the scoring.

import type { Bi, QText } from '../../core/types';
import { statusParts, type CriterionScore, type Score } from '../../engine/quiz/rubric';

export type Tag = 'clarify' | 'evidence' | 'level' | 'destructive' | 'hide' | 'contradicts' | 'detour' | 'mitigate' | 'fix' | 'verify' | 'fix-first';

export interface DrillOption {
  id: string;
  text: Bi;
  tags: Tag[];
  /** Right for every variant. */
  good?: boolean;
  /** Right only for these variants. */
  rightFor?: string[];
  /** What the sandbox or the interviewer shows: a terminal string, prose, or per variant. */
  out?: QText | Record<string, QText>;
  /** Why the move is good or bad; per variant when it differs. */
  why: Bi | Record<string, Bi>;
  /** Regular expressions: a typed command that matches picks this move. */
  cmd?: string[];
  /** Outputs that follow the learner's own flags: the first case-sensitive match on the typed line replaces `out`. */
  outCmd?: { re: string; out: QText | Record<string, QText> }[];
}

export interface DrillStep {
  id: string;
  prompt: Bi;
  options: DrillOption[];
}

export interface Drill {
  id: string;
  title: Bi;
  /** What the learner is told at the start. */
  symptom: Bi;
  variants: { id: string; cause: Bi }[];
  steps: DrillStep[];
  /** Concepts the drill trains (go to review on a weak score). */
  concepts: string[];
}

export interface PathEntry {
  step: string;
  option: string;
  right: boolean;
  tags: Tag[];
  via: 'choice' | 'command';
  line?: string;
}

export interface DrillState {
  drill: string;
  variant: string;
  step: number;
  path: PathEntry[];
  done: boolean;
  status?: string;
}

export function startDrill(d: Drill, variant: string): DrillState {
  return { drill: d.id, variant, step: 0, path: [], done: false };
}

export function isRight(o: DrillOption, variant: string): boolean {
  return o.rightFor ? o.rightFor.includes(variant) : !!o.good;
}

function isBi(x: unknown): x is Bi {
  return typeof x === 'object' && x !== null && 'ru' in x && 'en' in x;
}

function pickOut(out: QText | Record<string, QText> | undefined, variant: string): QText | undefined {
  if (out === undefined || typeof out === 'string' || isBi(out)) return out as QText | undefined;
  return (out as Record<string, QText>)[variant] ?? (out as Record<string, QText>).default;
}

/** What the sandbox shows for a move; a typed line picks the output that matches its flags. */
export function outputFor(o: DrillOption, variant: string, line?: string): QText | undefined {
  const own = line ? o.outCmd?.find((c) => new RegExp(c.re).test(line)) : undefined;
  return pickOut(own ? own.out : o.out, variant);
}

export function whyFor(o: DrillOption, variant: string): Bi {
  if (isBi(o.why)) return o.why;
  const per = o.why as Record<string, Bi>;
  return per[variant] ?? per.default ?? Object.values(per)[0];
}

/** A typed line without the `sudo` in front: the sandbox runs everything with enough rights anyway. */
export function bareCommand(line: string): string {
  return line.trim().replace(/^(?:sudo(?:\s+-\S+)*\s+)+/, '');
}

/** The move a typed command stands for at this step, if any. */
export function matchCommand(step: DrillStep, line: string): DrillOption | undefined {
  const l = bareCommand(line);
  if (!l) return undefined;
  return step.options.find((o) => o.cmd?.some((re) => new RegExp(re, 'i').test(l)));
}

/**
 * A command typed at a clarifying step that already belongs to the next
 * step ("df -h" before asking which partition fills up): the learner chose
 * to look for themselves instead of asking. The clarifying step is passed
 * over and the command is taken at the next step; the method score then
 * shows that nobody was asked.
 */
export function matchAhead(d: Drill, s: DrillState, line: string): DrillOption | undefined {
  const step = d.steps[s.step];
  const next = d.steps[s.step + 1];
  if (!step || !next) return undefined;
  const clarifying = step.options.some((o) => isRight(o, s.variant) && o.tags.includes('clarify'));
  if (!clarifying) return undefined;
  const o = matchCommand(next, line);
  return o && isRight(o, s.variant) ? o : undefined;
}

/** Pass over the clarifying step (see matchAhead). */
export function skipStep(s: DrillState): DrillState {
  return { ...s, step: s.step + 1 };
}

export interface MoveResult {
  state: DrillState;
  option: DrillOption;
  right: boolean;
  output?: QText;
  why: Bi;
}

/** Take a move. A right move advances to the next step; a wrong one stays and is recorded. */
export function move(d: Drill, s: DrillState, optionId: string, via: 'choice' | 'command' = 'choice', line?: string): MoveResult {
  const step = d.steps[s.step];
  const option = step.options.find((o) => o.id === optionId);
  if (!option) throw new Error(`no option ${optionId} at step ${step.id}`);
  const right = isRight(option, s.variant);
  const entry: PathEntry = { step: step.id, option: option.id, right, tags: option.tags, via, line };
  const next = right ? s.step + 1 : s.step;
  const state: DrillState = { ...s, step: next, path: [...s.path, entry], done: next >= d.steps.length };
  return { state, option, right, output: outputFor(option, s.variant, line), why: whyFor(option, s.variant) };
}

export function finishStatus(s: DrillState, text: string): DrillState {
  return { ...s, status: text };
}

const clamp = (n: number): Score => Math.max(0, Math.min(3, n)) as Score;

/**
 * Score the path with the drill rubric. Evidence lines quote the path, so the
 * learner sees what each score is based on.
 */
export function scoreDrill(d: Drill, s: DrillState): CriterionScore[] {
  const p = s.path;
  const firstEvidence = p.findIndex((e) => e.right && e.tags.includes('evidence'));
  const before = (i: number) => firstEvidence < 0 || i < firstEvidence;
  const destructiveBefore = p.some((e, i) => e.tags.includes('destructive') && before(i));
  const destructiveAfter = p.some((e, i) => e.tags.includes('destructive') && !before(i));
  const fixFirst = p.some((e) => e.tags.includes('fix-first'));
  const hidden = p.some((e) => e.tags.includes('hide'));
  const contradicts = p.filter((e) => e.tags.includes('contradicts') || e.tags.includes('detour')).length;
  const first = p[0];
  const actedFirst = !!first && (first.tags.includes('destructive') || first.tags.includes('hide') || first.tags.includes('fix-first'));
  const levelSteps = new Set(d.steps.filter((st) => st.options.some((o) => o.tags.includes('level'))).map((st) => st.id));
  const levelMisses = p.filter((e) => levelSteps.has(e.step) && !e.right).length;
  const levelReached = [...levelSteps].every((id) => p.some((e) => e.step === id && e.right));

  const level = actedFirst ? 0 : !levelReached ? 1 : levelMisses === 0 ? 3 : levelMisses === 1 ? 2 : 1;
  const clarified = !!first && first.right && first.tags.includes('clarify');
  const method = actedFirst ? 0 : clarified ? (contradicts === 0 ? 3 : 2) : contradicts === 0 ? 2 : 1;
  const safety = destructiveBefore ? 0 : destructiveAfter ? 1 : fixFirst ? 2 : 3;
  const fixStep = d.steps[d.steps.length - 1];
  const fixFirstTry = p.filter((e) => e.step === fixStep.id).length === 1 && p.some((e) => e.step === fixStep.id && e.right);
  const result = !s.done ? 0 : hidden ? 1 : fixFirstTry ? 3 : 2;
  const st = statusParts(s.status ?? '');
  const communication = s.status?.trim() ? Number(st.impact) + Number(st.action) + Number(st.next) : 0;

  const quote = (e?: PathEntry) => (e ? `${e.step}: ${e.option}` : null);
  return [
    { id: 'level', score: clamp(level), evidence: quote(p.find((e) => levelSteps.has(e.step) && e.right)), note: levelMisses ? `${levelMisses} miss(es) on the layer` : undefined },
    { id: 'method', score: clamp(method), evidence: quote(first), note: contradicts ? `${contradicts} detour(s)` : undefined },
    { id: 'safety', score: clamp(safety), evidence: quote(p.find((e) => e.tags.includes('destructive')) ?? p.find((e) => e.tags.includes('mitigate'))) },
    { id: 'result', score: clamp(result), evidence: quote(p.find((e) => e.step === fixStep.id && e.right)) },
    { id: 'communication', score: clamp(communication), evidence: s.status?.trim() ? s.status.trim().slice(0, 140) : null, note: `impact ${st.impact ? '✓' : '·'} action ${st.action ? '✓' : '·'} next ${st.next ? '✓' : '·'}` },
  ];
}

/** Pick a variant for a new attempt, avoiding the previous one when possible. */
export function pickVariant(d: Drill, previous?: string, r: () => number = Math.random): string {
  const pool = d.variants.filter((v) => v.id !== previous);
  const list = pool.length ? pool : d.variants;
  return list[Math.floor(r() * list.length)].id;
}
