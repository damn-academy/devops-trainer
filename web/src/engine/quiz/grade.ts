// Grading of quiz items (08 §3.10, 10 §2). Pure functions, except that
// fill-command with a check and predict-output run a fresh simulated machine:
// the reference is what the simulator really does, so it never drifts.

import { evaluateCheck } from '../../core/check';
import type { Bi, BugfindItem, FillCommandItem, LabelItem, MatchItem, McqItem, MultiItem, OrderItem, PredictOutputItem, QuizGrade, QuizItem } from '../../core/types';
import { createSimMachine, stripAnsi } from '../terminal/shell';

const ok = (feedback: Bi[]): QuizGrade => ({ correct: true, score: 1, feedback });

function withExplain(item: QuizItem, fb: Bi[]): Bi[] {
  return item.explain ? [...fb, item.explain] : fb;
}

export function gradeMcq(item: McqItem, choice: string): QuizGrade {
  const o = item.options.find((x) => x.id === choice);
  const correct = !!o?.correct;
  return { correct, score: correct ? 1 : 0, feedback: withExplain(item, o?.why ? [o.why] : []) };
}

export function gradeMulti(item: MultiItem, choice: string[]): QuizGrade {
  const chosen = new Set(choice);
  const right = new Set(item.options.filter((o) => o.correct).map((o) => o.id));
  const fb: Bi[] = [];
  let hits = 0;
  for (const o of item.options) {
    const picked = chosen.has(o.id);
    if (picked && o.correct) hits++;
    if (picked !== !!o.correct && o.why) fb.push(o.why);
  }
  const wrongPicks = [...chosen].filter((c) => !right.has(c)).length;
  const correct = hits === right.size && wrongPicks === 0;
  const score = Math.max(0, (hits - wrongPicks) / right.size);
  return { correct, score, feedback: withExplain(item, fb) };
}

/** Length of the longest increasing subsequence: partial credit for order. */
function lis(a: number[]): number {
  const tails: number[] = [];
  for (const x of a) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    tails[lo] = x;
  }
  return tails.length;
}

export function gradeOrder(item: OrderItem, order: string[]): QuizGrade {
  const pos = order.map((id) => item.steps.findIndex((s) => s.id === id));
  const correct = pos.every((p, i) => p === i) && pos.length === item.steps.length;
  const score = item.steps.length ? lis(pos) / item.steps.length : 0;
  const fb: Bi[] = [];
  if (!correct) {
    const first = pos.findIndex((p, i) => p !== i);
    const misplaced = item.steps[pos[first]];
    if (misplaced?.why) fb.push(misplaced.why);
  }
  return { correct, score, feedback: withExplain(item, fb) };
}

export function gradeMatch(item: MatchItem, pairs: Record<string, string>): QuizGrade {
  let right = 0;
  const fb: Bi[] = [];
  for (const p of item.pairs) {
    if (pairs[p.id] === p.id) right++;
    else if (p.why) fb.push(p.why);
  }
  const correct = right === item.pairs.length;
  return { correct, score: right / item.pairs.length, feedback: withExplain(item, fb) };
}

export function gradeBugfind(item: BugfindItem, line: number): QuizGrade {
  const correct = item.bug.includes(line);
  const why = item.why[line];
  return { correct, score: correct ? 1 : 0, feedback: withExplain(item, why ? [why] : []) };
}

export function gradeLabel(item: LabelItem, placed: Record<string, string>): QuizGrade {
  let right = 0;
  const fb: Bi[] = [];
  for (const slot of item.diagram.slots) {
    if (placed[slot.id] === slot.answer) right++;
    else {
      const wrong = item.labels.find((l) => l.id === placed[slot.id]);
      if (wrong?.why) fb.push(wrong.why);
    }
  }
  const n = item.diagram.slots.length;
  return { correct: right === n, score: n ? right / n : 0, feedback: withExplain(item, fb) };
}

/** Normalise a command line for comparison: trim, collapse spaces, unify quotes around simple words. */
export function normalizeCommand(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(["'])([\w./:=-]+)\1/g, '$2');
}

export function fullLine(item: FillCommandItem, answer: string): string {
  return item.template ? item.template.replace(/_{3,}/, answer.trim()) : answer;
}

export async function gradeFill(item: FillCommandItem, answer: string): Promise<QuizGrade> {
  const line = fullLine(item, answer);
  const misconception = item.misconceptions?.find((m) => new RegExp(m.match).test(line));
  if (item.check) {
    const m = await createSimMachine(item.setup);
    await m.exec(line);
    const r = evaluateCheck(item.check, await m.facts());
    m.dispose();
    if (r.pass) return ok(withExplain(item, []));
    return { correct: false, score: 0, feedback: withExplain(item, [misconception?.why, r.say].filter(Boolean) as Bi[]) };
  }
  const norm = normalizeCommand(line);
  const correct = (item.answers ?? []).some((a) => normalizeCommand(fullLine(item, a)) === norm || normalizeCommand(a) === norm);
  return { correct, score: correct ? 1 : 0, feedback: withExplain(item, misconception && !correct ? [misconception.why] : []) };
}

/** Normalise output for predict-output: whitespace, trailing newlines. */
export function normalizeOutput(s: string): string {
  return stripAnsi(s)
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .trim();
}

/** Run the command of a predict-output item and return what it prints. */
export async function runPredict(item: PredictOutputItem): Promise<string> {
  const m = await createSimMachine(item.setup);
  const r = await m.exec(item.command);
  m.dispose();
  return stripAnsi(r.out);
}

export async function gradePredict(item: PredictOutputItem, answer: string): Promise<QuizGrade & { actual: string }> {
  const actual = await runPredict(item);
  if (item.options) {
    const g = gradeMcq({ ...item, kind: 'mcq', options: item.options }, answer);
    return { ...g, actual };
  }
  const correct = normalizeOutput(answer) === normalizeOutput(actual);
  return { correct, score: correct ? 1 : 0, feedback: withExplain(item, []), actual };
}
