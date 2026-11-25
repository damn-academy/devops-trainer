import { it, expect } from 'vitest';
import { registry } from '../src/core/registry';

// Business-course quizzes must not be solvable by option length alone:
// the correct option may be the unique longest or the unique shortest only in a minority of questions.
const COURSES = ['marketing.', 'product.', 'sales.', 'scithink.', 'aicontent.', 'finance.', 'metrics.'];
it('keeps option length from giving away the answer in business courses', () => {
  const all = new Map(registry.quiz);
  for (const lesson of registry.lessons.values()) for (const s of lesson.sections) if (s.kind === 'quiz') for (const q of s.items) if (typeof q !== 'string') all.set(q.id, q);
  let n = 0, longest = 0, shortest = 0;
  const longestIds: string[] = [], shortestIds: string[] = [];
  for (const q of all.values()) {
    if (!COURSES.some(p => q.id.startsWith(p)) || !('options' in q) || !q.options?.length) continue;
    if (q.options.filter(o => o.correct).length !== 1) continue;
    const len = q.options.map(o => (typeof o.text === 'string' ? o.text : o.text.ru).length);
    const c = q.options.findIndex(o => o.correct);
    const unique = (v: number) => len.filter(x => x === v).length === 1;
    n++;
    if (len[c] === Math.max(...len) && unique(len[c])) { longest++; longestIds.push(`${q.id} (${len.join("/")})`); }
    if (len[c] === Math.min(...len) && unique(len[c])) { shortest++; shortestIds.push(`${q.id} (${len.join("/")})`); }
  }
  expect(n).toBeGreaterThan(50);
  expect(longest / n, `Unique longest correct options: ${longestIds.join(", ")}`).toBeLessThan(0.45);
  expect(shortest / n, `Unique shortest correct options: ${shortestIds.join(", ")}`).toBeLessThan(0.45);
});
