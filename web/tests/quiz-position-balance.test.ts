import { it, expect } from 'vitest';
import { registry } from '../src/core/registry';
import { shuffle } from '../src/engine/quiz/render';
import type { QuizItem } from '../src/core/types';

type Choice = Extract<QuizItem, { options: unknown }>;
const singleAnswer = (): Choice[] => {
  const all = new Map(registry.quiz);
  for (const lesson of registry.lessons.values()) for (const s of lesson.sections) if (s.kind === 'quiz') for (const q of s.items) if (typeof q !== 'string') all.set(q.id, q);
  return [...all.values()].filter((q): q is Choice => 'options' in q && Array.isArray(q.options) && q.options.length >= 2 && q.options.filter(o => o.correct).length === 1);
};

// The quiz shows options in a deterministic shuffle keyed by question id, so the on-screen slot of the
// correct option follows from the source order. Within one course (question ids share their first
// segment) no slot may hold the correct option much more often than chance: the share of questions with
// the answer in slot p may exceed the chance share of p (the mean of 1/n over questions with n > p options)
// by at most MARGIN, and may never exceed MAX_SHARE. Options are bilingual objects in one array, so the
// slot is the same in Russian and English. Courses with fewer than MIN_QUESTIONS questions are too small to judge.
const MARGIN = 0.2;
const MAX_SHARE = 0.5;
const MIN_QUESTIONS = 8;

const course = (id: string) => id.split('.')[0]!;
const slotOfCorrect = (q: Choice) => shuffle(q.options, q.id).findIndex(o => o.correct);

it('spreads the on-screen slot of the correct option in every course', () => {
  const byCourse = new Map<string, Choice[]>();
  for (const q of singleAnswer()) byCourse.set(course(q.id), [...(byCourse.get(course(q.id)) ?? []), q]);
  const failures: string[] = [];
  let judged = 0;
  for (const [name, bank] of byCourse) {
    if (bank.length < MIN_QUESTIONS) continue;
    judged++;
    const width = Math.max(...bank.map(q => q.options.length));
    for (let p = 0; p < width; p++) {
      const chance = bank.reduce((s, q) => s + (p < q.options.length ? 1 / q.options.length : 0), 0) / bank.length;
      const limit = Math.min(MAX_SHARE, chance + MARGIN);
      const ids = bank.filter(q => slotOfCorrect(q) === p).map(q => q.id);
      if (ids.length / bank.length > limit) failures.push(`${name}: correct option in slot ${p + 1} in ${ids.length}/${bank.length} (limit ${limit.toFixed(2)}): ${ids.join(', ')}`);
    }
  }
  expect(judged).toBeGreaterThan(10);
  expect(failures, failures.join('\n')).toEqual([]);
});
