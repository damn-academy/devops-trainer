import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// A "TODO(ru)" placeholder once shipped on 14 block pages for three days.
const root = new URL('../src', import.meta.url).pathname;
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : /\.(ts|md)$/.test(f) && !f.endsWith('.test.ts') ? [p] : [];
});

it('ships no placeholder text to learners', () => {
  const hits = files(root).filter((f) => /TODO\((ru|en)\)|\bTBD\b|lorem ipsum/i.test(readFileSync(f, 'utf8')));
  expect(hits.map((f) => f.slice(root.length + 1))).toEqual([]);
});
