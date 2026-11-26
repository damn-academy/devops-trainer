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

for (const modifyCode of [false, true]) it.skipIf(process.env.RV64_SMP_JIT !== '1')(
  modifyCode ? 'executes code written by hart A after its SBI remote fence.i ACK' : 'retains hart B compiled code across an unrelated SBI remote fence.i', async () => {
    const mod = await import(/* @vite-ignore */ new URL('../public/rv64/rv64_core.js', import.meta.url).href);
    const wasm = await mod.default({ module_or_path: readFileSync(process.env.RV64_SMP_JIT_WASM ?? new URL('../public/rv64/rv64_core_bg.wasm', import.meta.url)) });
    const bytes = 32 * 1024 * 1024, pages = bytes / 65536 + 1;
    const memory = new WebAssembly.Memory({ initial: pages, maximum: pages, shared: true });
    const generations = new Int32Array(new SharedArrayBuffer(bytes / 4096 * 4));
    const module = atomicModule(pages);
    const ram = [new SharedHartMemory(memory, module, generations), new SharedHartMemory(memory, module, generations)];
    const bus = new HartMailboxes(2);
    let active = 0;
    const queue: any[] = [];
    Object.assign(globalThis, {
      rv64SharedAccess: (op: number, off: number, size: 1|2|4|8, value: bigint) => {
        if (op === 0) return BigInt.asUintN(size * 8, ram[active]!.load(off + 64, size));
        if (op === 1) { ram[active]!.store(off + 64, size, value); return 0n; }
        throw Error(`unexpected shared operation ${op}`);
      },
      rv64SharedGeneration: (page: number) => Atomics.load(generations, page) >>> 0,
      rv64Compile: (id: number, pc: bigint, words: Uint32Array, raw: Uint32Array) => queue.push({ id, pc, words: [...words], raw: [...raw] }),
    });
    const put = (off: number, words: number[]) => words.forEach((word, i) => ram[0]!.store(64 + off + i * 4, 4, BigInt(word)));
    // B: publish 1 (later 2) on a separate data page, then loop.
    put(0, [0x00100293, 0x00001317, 0x00533223, 0xff5ff06f]);
    // A: write new instruction to B's code, or to unrelated page 3;
    // fence rw,rw; SBI RFENCE fid=0, mask=2, base=0; ecall.
    put(0x2000, [modifyCode ? 0xffffe297 : 0x00001297, 0x00200337, 0x29330313,
      0x0062a023, 0x0330000f, 0x00200513, 0x00000593, 0x00000813,
      0x524658b7, 0xe4388893, 0x00000073]);
    const cores = [0, 1].map(hart => {
      const core = new mod.Engine(32); core.smp_configure(hart, bytes);
      core.smp_start(hart ? 0x80000000n : 0x80002000n, 0n);
      core.jit_threshold(hart ? 1 : 0); return core;
    });
    const b = cores[1], table = b.jit_table(), slots: number[] = [];
    let compiled = 0;
    const runB = () => {
      active = 1;
      const target = b.retired() + 1000;
      for (let tries = 0; b.retired() < target && tries < 1000; tries++) {
        b.smp_run(Math.min(64, target - b.retired()), 0, 0n);
        if (queue.length) {
          const blocks = queue.splice(0);
          const instance = new WebAssembly.Instance(new WebAssembly.Module(compileBatch(blocks)), { env: { memory: wasm.memory, slow: wasm.jit_slow } });
          for (const block of blocks) {
            const slot = table.grow(1); slots.push(slot); table.set(slot, instance.exports[`b${block.id}`]);
            b.jit_install(block.id, slot, block.words.length / 2); compiled++;
          }
        }
      }
      expect(b.retired()).toBe(target);
    };
    try {
      runB();
      expect(b.test_read(0x80001008n)).toBe(1n);
      expect(b.jit_retired()).toBeGreaterThan(0);
      const before = compiled, version = Atomics.load(generations, 0);
      expect(before).toBeGreaterThan(0);
      active = 0; cores[0].smp_run(100, 0, 0n);
      const [ext, fid, mask, base] = Array.from(cores[0].smp_request()) as bigint[];
      expect([ext, fid, mask, base]).toEqual([0x52464e43n, 0n, 2n, 0n]);
      // The guest store has published its generation BEFORE request and ACK.
      expect(Atomics.load(generations, 0)).toBe(version + Number(modifyCode));
      const tickets = bus.remoteFence(mask!, base!, 'instruction');
      expect(tickets.every(t => bus.completed(t))).toBe(false);
      active = 1;
      bus.service(1, () => {
        expect(tickets.every(t => bus.completed(t))).toBe(false);
        expect(Atomics.load(generations, 0)).toBe(version + Number(modifyCode));
        b.smp_fence();
      }, () => { throw Error('unexpected translation fence'); });
      expect(tickets.every(t => bus.completed(t))).toBe(true);
      cores[0].smp_reply(0n, 0n);
      runB();
      expect(b.test_read(0x80001008n)).toBe(modifyCode ? 2n : 1n);
      const counters = JSON.parse(b.metrics());
      expect(counters.remote_fence_i).toBe(1);
      expect(counters.jit_cache_clears).toBe(0);
      expect(counters.invalidations.remote_fence_i).toBe(0);
      if (modifyCode) expect(compiled).toBeGreaterThan(before);
      else expect(compiled).toBe(before);
      b.jit_clear();
      expect(JSON.parse(b.metrics()).invalidations.explicit_clear).toBe(1);
    } finally { slots.forEach(slot => table.set(slot, null)); cores.forEach(core => core.free()); }
  }, 30000);
