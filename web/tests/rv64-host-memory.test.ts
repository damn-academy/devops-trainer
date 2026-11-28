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

it('bounds the URL/env ceiling and keeps both A/B budgets below dynamic and pressure limits', async () => {
  const { jitCeilingBytes } = await import('../src/engine/rv64/host-memory');
  expect(jitCeilingBytes(null)).toBe(256 * MiB);
  expect(jitCeilingBytes(null, '384')).toBe(384 * MiB);
  expect(jitCeilingBytes('256', '384')).toBe(256 * MiB);
  for (const invalid of ['', '0', '-1', '257', '385', 'Infinity', 'NaN']) {
    expect(() => jitCeilingBytes(invalid)).toThrow();
    expect(() => jitCeilingBytes(null, invalid)).toThrow();
  }
  for (const value of ['256', '384']) {
    const ceiling = jitCeilingBytes(value), shared = 1058 * MiB;
    let previous = Infinity;
    for (const privateBytes of [[128 * MiB, 128 * MiB], [400 * MiB, 500 * MiB], [800 * MiB, 800 * MiB]]) {
      const budget = Math.min(ceiling, hartBudget(shared, privateBytes));
      expect(budget).toBeLessThanOrEqual(previous);
      expect(budget).toBeLessThanOrEqual(ceiling);
      if (budget > 0) expect(shared + privateBytes.reduce((a,b) => a+b,0) + 2 * budget + HOST_RESERVE).toBeLessThanOrEqual(HOST_BUDGET);
      const pressure = pressureCeiling(ceiling, HOST_BUDGET + 1);
      expect(Math.min(pressure, hartBudget(shared, privateBytes))).toBeLessThanOrEqual(budget);
      expect(pressureCeiling(pressure, 0)).toBe(pressure);
      previous = budget;
    }
  }
});
