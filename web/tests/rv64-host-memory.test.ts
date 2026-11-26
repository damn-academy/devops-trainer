import { expect, it } from 'vitest';
import { BoundedHistory, ConsoleTail, hartBudget, pressureCeiling, HOST_BUDGET, HOST_RESERVE, jitCharge, MiB } from '../src/engine/rv64/host-memory';
it('counts shared RAM once and keeps per-hart allowances within the accounting budget', () => {
  for (const harts of [2, 4]) {
    const privateBytes = Array(harts).fill(128 * MiB), shared = 1058 * MiB;
    const allowance = hartBudget(shared, privateBytes);
    expect(shared + harts * 128 * MiB + allowance * harts + HOST_RESERVE).toBeLessThanOrEqual(HOST_BUDGET);
    expect(hartBudget(shared, privateBytes, HOST_BUDGET + 1)).toBe(Math.floor(allowance / 2));
    expect(jitCharge(100, 2)).toBe(800 + 2 * 65536);
  }
  expect(hartBudget(HOST_BUDGET, [MiB])).toBe(0);
});
it('bounds profile history by bytes and count, reports discarded records', () => {
  const history = new BoundedHistory<string>(20, 2);
  history.push('abc'); history.push('def'); history.push('ghi');
  expect(history.entries).toEqual(['def', 'ghi']); expect(history.bytes).toBe(20);
  history.push('much too large for this history');
  expect(history.dropped).toBe(2); expect(history.bytes).toBe(20);
});
it('bounds console characters while preserving total offsets', () => {
  const tail = new ConsoleTail(5); tail.append('abc'); tail.append('defgh');
  expect(tail.text).toBe('defgh'); expect(tail.dropped).toBe(3); expect(tail.total).toBe(8);
});

it('ratchets the live JIT ceiling down under measured pressure without regrowing between samples', () => {
  let ceiling = 256 * MiB;
  ceiling = pressureCeiling(ceiling, HOST_BUDGET + 1);
  expect(ceiling).toBe(128 * MiB);
  expect(pressureCeiling(ceiling, 0)).toBe(ceiling);
  expect(pressureCeiling(ceiling, HOST_BUDGET + 1)).toBe(64 * MiB);
});
