import { Worker } from 'node:worker_threads';
import { describe, expect, it } from 'vitest';
import { atomicModule, SharedHartMemory, HartMailboxes, RESERVATION_GRANULE, sharedAccessModule, type SharedAccessExports } from '../src/engine/rv64/smp';
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
  it('publishes DMA to every touched reservation granule and code page once', () => {
    const memory = new WebAssembly.Memory({ initial: 2, maximum: 2, shared: true });
    const generations = new Int32Array(new SharedArrayBuffer(4 * 32)), granules = new Int32Array(new SharedArrayBuffer(4 * 1024));
    const a = new SharedHartMemory(memory, atomicModule(2), generations, granules), b = new SharedHartMemory(memory, atomicModule(2), generations, granules);
    const bytes = Uint8Array.from({ length: 4100 }, (_, i) => i & 255);
    b.lr(64 + 4096 + 8, 8);
    a.dmaWrite(64 + 4090, bytes);
    expect(b.sc(64 + 4096 + 8, 8, 1n)).toBe(false);
    expect(b.load(64 + 4090, 1)).toBe(0n); expect(b.load(64 + 4096, 2)).toBe(6n | 7n << 8n);
    expect([...generations.slice(0, 4)]).toEqual([1, 1, 0, 0]);
    expect(granules[Math.floor((64 + 4090) / 128)]).toBe(1); expect(granules[Math.floor((64 + 4090 + 4099) / 128)]).toBe(1);
    const out = new Uint8Array(4100); a.dmaRead(64 + 4090, out); expect(out).toEqual(bytes);
    expect(() => a.dmaWrite(0, bytes)).toThrow(RangeError);
  });
  it('direct wasm bus access follows the SharedHartMemory store protocol', () => {
    const memory = new WebAssembly.Memory({ initial: 2, maximum: 2, shared: true });
    const generations = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true }), granules = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
    const gens = new Int32Array(generations.buffer), grans = new Int32Array(granules.buffer);
    const js = new SharedHartMemory(memory, atomicModule(2), gens, grans);
    const bus = new WebAssembly.Instance(sharedAccessModule(2, 1, 1), { env: { ram: memory, generations, granules } }).exports as unknown as SharedAccessExports;
    bus.store(0x1000, 8, 0x8877665544332211n);
    expect(BigInt.asUintN(64, js.load(64 + 0x1000, 8))).toBe(0x8877665544332211n);
    expect(bus.load(0x1000, 4)).toBe(0x44332211n); expect(bus.load(0x1004, 4)).toBe(0x88776655n);
    expect(bus.load(0x1002, 2)).toBe(0x4433n); expect(bus.load(0x1007, 1)).toBe(0x88n);
    expect(bus.fetch(0x1002)).toBe(0x66554433);
    bus.store(0x1006, 2, 0xffffn); bus.store(0x1001, 1, 0xabn); bus.store(0x1000, 4, 0x0102_0304n | 0xf0000000n);
    expect(BigInt.asUintN(64, js.load(64 + 0x1000, 8))).toBe(0xffff6655f1020304n);
    expect(bus.generation(1)).toBe(4); expect(gens[1]).toBe(4);
    expect(grans[Math.floor((64 + 0x1000) / 128)]).toBe(4);
    expect(new BigInt64Array(memory.buffer, 8, 1)[0]).toBe(0n);
    // LR on the JS path observes direct-bus stores and CAS.
    js.lr(64 + 0x1000, 8); bus.store(0x1000, 8, 0xffff6655f1020304n);
    expect(js.sc(64 + 0x1000, 8, 1n)).toBe(false);
    const old = BigInt.asIntN(64, 0xffff6655f1020304n);
    expect(bus.cas(0x1000, 1n, 2n)).toBe(old); expect(bus.generation(1)).toBe(5);
    expect(bus.cas(0x1000, old, 7n)).toBe(old); expect(bus.load(0x1000, 8)).toBe(7n); expect(bus.generation(1)).toBe(6);
    expect(new Int32Array(memory.buffer, 0, 1)[0]).toBe(0);
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

it('tracks shared writes only on the physical page touched, including DMA and PTE CAS', () => {
  const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
  const generations = new Int32Array(new SharedArrayBuffer(16 * 4));
  const module = atomicModule(1);
  const a = new SharedHartMemory(memory, module, generations);
  const b = new SharedHartMemory(memory, module, generations);
  a.store(64, 4, 0x00128293n);
  const codeVersion = Atomics.load(generations, 0);
  b.store(64 + 4096, 8, 42n);
  b.amo(64 + 4096, 8, 'add', 1n);
  b.cas(64 + 4096, 43n, 44n);
  b.store(64 + 8192, 1, 90n); // device byte-write protocol
  expect(Atomics.load(generations, 0)).toBe(codeVersion);
  expect(Atomics.load(generations, 1)).toBe(3);
  expect(Atomics.load(generations, 2)).toBe(1);
  b.store(64 + 4095, 1, 90n);
  expect(Atomics.load(generations, 0)).toBe(codeVersion + 1);
  expect(Atomics.load(generations, 1)).toBe(3);
});

it('publishes every successful shared writer before an instruction-fence ACK', () => {
  const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
  const generations = new Int32Array(new SharedArrayBuffer(16 * 4));
  const module = atomicModule(1);
  const a = new SharedHartMemory(memory, module, generations);
  const b = new SharedHartMemory(memory, module, generations);
  const bus = new HartMailboxes(2);
  const writers = [
    () => a.store(64, 4, 1n),
    () => a.store(64, 1, 2n), // DMA byte path
    () => a.amo(64, 8, 'add', 1n), // native atomic path
    () => a.amo(64, 4, 'xor', 1n), // locked read/modify/write path
    () => a.cas(64, a.load(64, 8), 4n),
    () => { a.lr(64, 8); expect(a.sc(64, 8, 5n)).toBe(true); },
  ];
  for (const write of writers) {
    const version = Atomics.load(generations, 0);
    write();
    expect(Atomics.load(generations, 0)).toBe(version + 1);
    const value = a.load(64, 8), ticket = bus.remoteFence(2n, 0n, 'instruction')[0]!;
    bus.service(1, () => {
      expect(bus.completed(ticket)).toBe(false);
      expect(Atomics.load(generations, 0)).toBe(version + 1);
      expect(b.load(64, 8)).toBe(value);
    }, () => { throw Error('unexpected translation fence'); });
    expect(bus.completed(ticket)).toBe(true);
  }
  const version = Atomics.load(generations, 0);
  a.cas(64, 999n, 0n);
  expect(a.sc(64, 8, 0n)).toBe(false);
  expect(Atomics.load(generations, 0)).toBe(version);
});
