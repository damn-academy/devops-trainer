import { expect, it } from 'vitest';
import { restoreTimeOffset } from '../src/engine/rv64/restore-clock';

it('resumes saved time without suspension while retaining real runtime deltas', () => {
  const savedTicks = 746_000 * 10000;
  for (const policy of ['elapsed', 'continuous'] as const) {
    const offset = restoreTimeOffset(savedTicks, 1000, policy, 61000, 350);
    const resumed = 350 * 10000 + offset;
    expect(resumed).toBe(savedTicks + (policy === 'elapsed' ? 60000 * 10000 : 0));
    expect(12350 * 10000 + offset - resumed).toBe(12000 * 10000);
  }
});
it('does not rewind for legacy snapshots or a host wall-clock backstep', () => {
  expect(restoreTimeOffset(10000, undefined, 'elapsed', 61000, 10)).toBe(-90000);
  expect(restoreTimeOffset(10000, 62000, 'elapsed', 61000, 10)).toBe(-90000);
});
