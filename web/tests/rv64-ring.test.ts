import { describe, it, expect } from 'vitest';
import { ByteRing, FrameRing } from '../src/engine/rv64/ring';
describe('RV64 SPSC ring', () => {
  it('preserves backpressure and wrap-around', () => {
    const ring = ByteRing.create(16);
    expect(ring.write(Uint8Array.from({ length: 20 }, (_, i) => i))).toBe(16);
    expect(ring.write(new Uint8Array([99]))).toBe(0);
    expect([...ring.read()]).toEqual(Array.from({ length: 16 }, (_, i) => i));
    expect(ring.write(new Uint8Array([42, 43]))).toBe(2);
    expect([...ring.read()]).toEqual([42, 43]);
  });
  it('does not change wake sequence when reading an empty ring', () => {
    const ring = ByteRing.create(16); const seq = Atomics.load(ring.words, 2);
    expect(ring.read().length).toBe(0); expect(Atomics.load(ring.words, 2)).toBe(seq);
  });
  it('survives 32-bit counter overflow', () => {
    const ring = ByteRing.create(16); Atomics.store(ring.words, 0, -2); Atomics.store(ring.words, 1, -2);
    ring.write(new Uint8Array([1, 2, 3, 4])); expect([...ring.read()]).toEqual([1, 2, 3, 4]);
  });
});

it('publishes complete Ethernet frames and drops without corrupting a full ring', () => {
  const frames = new FrameRing(ByteRing.create(32));
  expect(frames.write(new Uint8Array([1, 2, 3]))).toBe(true);
  expect(frames.write(new Uint8Array(24))).toBe(false);
  expect(frames.read().map(f => [...f])).toEqual([[1, 2, 3]]);
  expect(frames.write(new Uint8Array([4, 5]))).toBe(true);
  expect(frames.read().map(f => [...f])).toEqual([[4, 5]]);
});
