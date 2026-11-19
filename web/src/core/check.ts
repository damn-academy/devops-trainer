// Checks over facts: the goal passes on state, not on typed text (09 §2).

import { evaluate } from './predicate';
import type { Check, CheckResult, Facts } from './types';

/** Output of the last command on a tty (ANSI already stripped by the machine). */
export function lastOutput(facts: Facts, tty = 'main'): string {
  const list = facts.term?.[tty] ?? [];
  return list.length ? list[list.length - 1].out : '';
}

function holds(cond: string | ((f: Facts, s?: Facts) => boolean), facts: Facts, start?: Facts, matched?: string[]): boolean {
  if (typeof cond === 'function') {
    try {
      return !!cond(facts, start);
    } catch {
      return false;
    }
  }
  const r = evaluate(cond, facts, start);
  matched?.push(...r.matched);
  return r.pass;
}

export function evaluateCheck(check: Check, facts: Facts, start?: Facts): CheckResult {
  const matched: string[] = [];
  let pass = true;
  if (check.when !== undefined) pass = holds(check.when, facts, start, matched);
  if (pass && check.stdout !== undefined) {
    const out = lastOutput(facts);
    pass = typeof check.stdout === 'string' ? out.includes(check.stdout) : check.stdout.test(out);
    matched.push(`${pass ? '✓' : '✗'} stdout ${String(check.stdout)}`);
  }
  if (pass) return { pass, matched };
  const fails = check.fail ?? [];
  for (let i = 0; i < fails.length; i++) {
    if (holds(fails[i].if, facts, start)) return { pass, matched, say: fails[i].say, failIndex: i };
  }
  return { pass, matched };
}
