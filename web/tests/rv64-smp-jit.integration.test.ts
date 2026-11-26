// Uses the locally staged wasm; rebuild it before running the fixed regression.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { atomicModule, SharedHartMemory, HartMailboxes } from '../src/engine/rv64/smp';
import { compileBatch } from '../src/engine/rv64/jit-compiler';

it.skipIf(process.env.RV64_SMP_JIT !== '1')('retains hot physical code across remote translation fences', async () => {
  const url = new URL('../public/rv64/rv64_core.js', import.meta.url).href;
  const mod = await import(/* @vite-ignore */ url);
  const wasm = await mod.default({ module_or_path: readFileSync(process.env.RV64_SMP_JIT_WASM ?? new URL('../public/rv64/rv64_core_bg.wasm', import.meta.url)) });
  const samples = [];
  for (const harts of [1, 2]) {
    const bytes = 32 * 1024 * 1024, pages = bytes / 65536 + 1;
    const memory = new WebAssembly.Memory({ initial: pages, maximum: pages, shared: true });
    const generations = new Int32Array(new SharedArrayBuffer(bytes / 4096 * 4));
    const ram = new SharedHartMemory(memory, atomicModule(pages), generations);
    const bus = new HartMailboxes(harts);
    Object.assign(globalThis, {
      rv64SharedAccess: (op: number, off: number, size: 1|2|4|8, value: bigint) => {
        if (op === 0) return BigInt.asUintN(size * 8, ram.load(off + 64, size));
        if (op === 1) { ram.store(off + 64, size, value); return 0n; }
        throw Error(`unexpected shared operation ${op}`);
      },
      rv64SharedGeneration: (page: number) => Atomics.load(generations, page) >>> 0,
    });
    // addi t0,t0,1; jal x0,-4. No OS, clocks, data stores or external compiler.
    ram.store(64, 4, 0x00128293n); ram.store(68, 4, 0xffdff06fn);
    const cores = Array.from({ length: harts }, (_, hart) => {
      const core = new mod.Engine(32); core.smp_configure(hart, bytes);
      core.smp_start(0x80000000n, 0n); core.jit_threshold(1); return core;
    });
    const counts = cores.map(() => 0), busy = cores.map(() => 0);
    const table = cores[0].jit_table(); const slots: number[] = [];
    try {
      for (let round = 0; round < 20; round++) for (let hart = 0; hart < harts; hart++) {
        const core = cores[hart];
        if (harts > 1) {
          const tickets = bus.remoteFence(1n << BigInt(hart), 0n, 'translation');
          bus.service(hart, () => core.smp_fence(), () => core.smp_sfence ? core.smp_sfence() : core.smp_fence());
          expect(tickets.every(t => bus.completed(t))).toBe(true);
        }
        const queue: any[] = [];
        Object.assign(globalThis, { rv64Compile: (id: number, pc: bigint, words: Uint32Array, raw: Uint32Array) => queue.push({ id, pc, words: [...words], raw: [...raw] }) });
        const target = core.retired() + 100000, start = performance.now();
        while (core.retired() < target) {
          core.smp_run(Math.min(2048, target - core.retired()), 0, 0n);
          if (queue.length) {
            const blocks = queue.splice(0);
            const instance = new WebAssembly.Instance(new WebAssembly.Module(compileBatch(blocks)), { env: { memory: wasm.memory, slow: wasm.jit_slow } });
            for (const b of blocks) {
              const slot = table.grow(1); slots.push(slot); table.set(slot, instance.exports[`b${b.id}`]);
              core.jit_install(b.id, slot, b.words.length / 2); counts[hart]++;
            }
          }
        }
        busy[hart]! += performance.now() - start;
      }
      for (const [hart, core] of cores.entries()) samples.push({ harts, hart, compiled: counts[hart], retired: core.retired(), jitRetired: core.jit_retired(), busyMips: core.retired() / busy[hart]! / 1000, counters: JSON.parse(core.metrics()) });
    } finally { slots.forEach(slot => table.set(slot, null)); cores.forEach(core => core.free()); }
  }
  console.log('SMP_JIT_REPRO ' + JSON.stringify(samples));
  for (const sample of samples) {
    expect(sample.compiled).toBe(1);
    expect(sample.counters.jit_cache_clears).toBe(0);
  }
}, 30000);
