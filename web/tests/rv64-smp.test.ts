import { Worker } from 'node:worker_threads';
import { describe, expect, it } from 'vitest';
import { atomicModule, SharedHartMemory, RESERVATION_GRANULE } from '../src/engine/rv64/smp';
function machine() {
  const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
  const module = atomicModule(1);
  return [new SharedHartMemory(memory, module), new SharedHartMemory(memory, module)];
}
describe('R3 shared wasm RAM substrate (not integrated CPU)', () => {
  it('invalidates reservations on another hart writing the same value or ABA', () => {
    const [a, b] = machine();
    a!.store(64, 8, 42n); expect(a!.lr(64, 8)).toBe(42n);
    b!.store(64, 8, 42n); expect(a!.sc(64, 8, 1n)).toBe(false);
    a!.lr(64, 8); b!.store(64, 8, 0n); b!.store(64, 8, 42n);
    expect(a!.sc(64, 8, 1n)).toBe(false);
    a!.lr(64, 8); expect(a!.sc(64, 8, 43n)).toBe(true);
    expect(a!.sc(64, 8, 44n)).toBe(false); expect(b!.load(64, 8)).toBe(43n);
  });
  it('consumes a reservation even when SC targets the wrong address', () => {
    const [a] = machine(); a!.lr(64, 8);
    expect(a!.sc(72, 8, 1n)).toBe(false); expect(a!.sc(64, 8, 1n)).toBe(false);
  });
  it('handles overlapping W/D stores, sign extension and signed/unsigned AMOs', () => {
    const [a, b] = machine(); a!.store(64, 8, 0x12345678ffffffffn);
    expect(b!.load(64, 4)).toBe(-1n); expect(b!.load(68, 4)).toBe(0x12345678n);
    a!.lr(64, 8); b!.amo(68, 4, 'swap', 0x80000000n);
    expect(a!.sc(64, 8, 0n)).toBe(false);
    expect(a!.amo(68, 4, 'max', 1n)).toBe(-2147483648n);
    expect(a!.load(68, 4)).toBe(1n);
    a!.amo(64, 4, 'minu', 2n); expect(b!.load(64, 4)).toBe(2n);
    expect(b!.load(68, 4)).toBe(1n);
  });
  it('rejects MMIO, misalignment and overflow before touching shared RAM', () => {
    const [a] = machine();
    for (const address of [0, 65, 65536, -8, NaN]) expect(() => a!.load(address, 8)).toThrow(RangeError);
  });
});

for (const harts of [2, 4]) it(`${harts} actual Workers contend on one wasm memory without lost AMOs`, async () => {
  const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
  const module = atomicModule(1), barrier = new SharedArrayBuffer(4);
  const granules = new SharedArrayBuffer(Math.ceil(65536 / RESERVATION_GRANULE) * 4);
  const workers: Worker[] = [];
  try {
    await Promise.all(Array.from({ length: harts }, () => new Promise<void>((resolve, reject) => {
      const worker = new Worker(`
        const { parentPort, workerData } = require('node:worker_threads');
        const Hart = (${SharedHartMemory.toString()});
        const h = new Hart(workerData.memory, workerData.module, undefined, new Int32Array(workerData.granules));
        const gate = new Int32Array(workerData.barrier);
        Atomics.add(gate, 0, 1); Atomics.notify(gate, 0);
        for (;;) { const n = Atomics.load(gate, 0); if (n === workerData.harts) break; Atomics.wait(gate, 0, n, 100); }
        for (let i = 0; i < 10000; i++) h.amo(64, 8, 'add', 1n);
        parentPort.postMessage('done');
      `, { eval: true, workerData: { memory, module, barrier, granules, harts } });
      workers.push(worker); worker.on('error', reject);
      worker.on('message', () => resolve());
      worker.on('exit', code => { if (code) reject(new Error(`worker exit ${code}`)); });
    })));
    expect(new SharedHartMemory(memory, module).load(64, 8)).toBe(BigInt(harts * 10000));
  } finally { await Promise.all(workers.map(w => w.terminate())); }
}, 15000);

it('targets remote fences and acknowledges only after cache invalidation', async () => {
  const { HartMailboxes } = await import('../src/engine/rv64/smp');
  const bus = new HartMailboxes(4);
  const before = bus.wakeSequence(2), ticket = bus.fence(2, 'translation');
  expect(bus.wait(2, before, 0)).toBe('not-equal');
  expect(bus.completed(ticket)).toBe(false);
  bus.service(1, () => { throw Error('wrong hart'); }, () => { throw Error('wrong hart'); });
  let flushed = 0;
  bus.service(2, () => { throw Error('wrong cache'); }, () => {
    expect(bus.completed(ticket)).toBe(false); flushed++;
  });
  expect(flushed).toBe(1); expect(bus.completed(ticket)).toBe(true);
  bus.ipi(3); expect(bus.service(3, () => {}, () => {})).toBe(true);
  expect(bus.service(3, () => {}, () => {})).toBe(false);
});
it('does not lose a fence submitted during invalidation', async () => {
  const { HartMailboxes } = await import('../src/engine/rv64/smp');
  const bus = new HartMailboxes(2);
  const first = bus.fence(1, 'instruction'); let second = first;
  bus.service(1, () => { second = bus.fence(1, 'instruction'); }, () => {});
  expect(bus.completed(first)).toBe(true); expect(bus.completed(second)).toBe(false);
  bus.service(1, () => {}, () => {}); expect(bus.completed(second)).toBe(true);
});

it('validates all SBI hart targets before publishing and handles broadcast', async () => {
  const { HartMailboxes } = await import('../src/engine/rv64/smp');
  const bus = new HartMailboxes(4);
  expect(bus.targets(3n, 1n)).toEqual([1, 2]);
  expect(bus.targets(0n, (1n << 64n) - 1n)).toEqual([0, 1, 2, 3]);
  expect(() => bus.sendIpi(17n, 0n)).toThrow(RangeError);
  expect(bus.service(0, () => {}, () => {})).toBe(false);
  const tickets = bus.remoteFence(2n, 1n, 'translation');
  expect(tickets.map(t => t.hart)).toEqual([2]);
  expect(() => bus.targets(1n, 1n << 64n)).toThrow(RangeError);
});

it('preserves adjacent bytes and invalidates LR on byte DMA and PTE CAS', () => {
  const [a, b] = machine();
  a!.store(64, 8, 0x1122334455667788n);
  for (let offset = 0; offset < 8; offset++) expect(a!.load(64 + offset, 1)).toBe((0x1122334455667788n >> BigInt(offset * 8)) & 255n);
  a!.lr(64, 8); b!.store(67, 1, 0xffn);
  expect(a!.sc(64, 8, 0n)).toBe(false);
  expect(a!.load(64, 8)).toBe(0x11223344ff667788n);
  a!.lr(64, 8);
  expect(b!.cas(64, 0n, 1n)).toBe(0x11223344ff667788n);
  expect(a!.sc(64, 8, 7n)).toBe(true);
  a!.lr(64, 8); expect(b!.cas(64, 7n, 7n)).toBe(7n);
  expect(a!.sc(64, 8, 0n)).toBe(false);
});
