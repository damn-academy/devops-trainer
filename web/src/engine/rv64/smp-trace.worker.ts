import { SharedHartMemory } from './smp';
import { JitRuntime } from './jit';
self.onmessage = async ({ data: d }) => {
  self.onmessage = null;
  let jit: JitRuntime | undefined;
  try {
    const mod = await import(/* @vite-ignore */ new URL('/rv64/rv64_core.js', self.location.origin).href), wasm = await mod.default();
    const generations = new Int32Array(d.generations);
    const ram = new SharedHartMemory(d.memory, d.module, generations, new Int32Array(d.granules));
    Object.assign(globalThis, {
      rv64SharedGeneration: (page: number) => Atomics.load(generations, page) >>> 0,
      rv64SharedAccess: (op: number, off: number, size: 1 | 2 | 4 | 8, value: bigint) => {
        if (op === 0) return BigInt.asUintN(size * 8, ram.load(off + 64, size));
        if (op === 1) { ram.store(off + 64, size, value); return 0n; }
        if (size !== 4 && size !== 8) throw Error('bad AMO width');
        if (op === 16) return ram.amo(off + 64, size, 'add', value);
        if (op === 18) return ram.lr(off + 64, size);
        if (op === 19) return ram.sc(off + 64, size, value) ? 0n : 1n;
        throw Error(`unexpected op ${op}`);
      },
      rv64SharedImage: (off: number, bytes: Uint8Array) => new Uint8Array(d.memory.buffer, off + 64, bytes.length).set(bytes),
    });
    const core = new mod.Engine(32), reference = new mod.Engine(32);
    core.smp_configure(d.hart, 32 << 20); reference.test_hart(d.hart);
    // Each hart has a disjoint data page; the instruction stream is common.
    // AMO contention is tested separately; here the scheduling-independent oracle
    // can compare exact state after every generated/interpreted instruction.
    const instructions = [0x00010317, 0x00c51293, 0x00530333, 0x00000393,
      0x00138393, 0x00733023, 0x00033403, 0x007334af, 0x100335af,
      // SC is omitted here: unrelated harts may legitimately invalidate LR.
      0x027404b3, 0x0084d493, 0xfe1ff06f];
    const program = new Uint8Array(new Uint32Array(instructions).buffer);
    reference.load_program(program);
    const barrier = new Int32Array(d.barrier);
    if (d.hart === 0) { core.load_program(program); Atomics.store(barrier, 0, 1); Atomics.notify(barrier, 0); }
    else while (!Atomics.load(barrier, 0)) Atomics.wait(barrier, 0, 0, 100);
    for (const c of [core, reference]) c.smp_start(0x80000000n, 0n);
    core.jit_threshold(1); core.test_single_step();
    jit = new JitRuntime(wasm.memory, core.jit_table(), (id, slot, count) => core.jit_install(id, slot, count), () => core.jit_clear(), wasm.jit_slow);
    const channel = new MessageChannel();
    const yieldHost = () => new Promise<void>(resolve => { channel.port1.onmessage = () => resolve(); channel.port2.postMessage(0); });
    let steps = 0, yielded = performance.now(); const start = yielded;
    const address = 0x80010000n + BigInt(d.hart * 4096);
    while (steps < 100000) {
      const n = core.test_block();
      if (n) {
        if (n !== 1) throw Error('not single-step');
        reference.test_steps(1); steps++;
        if (!core.test_equal(reference, false) || core.test_read(address) !== reference.test_read(address)) throw Error(`hart ${d.hart}: divergence at ${steps}, pc ${core.pc().toString(16)} vs ${reference.pc().toString(16)}`);
      }
      if (!n || performance.now() - yielded > 8) { jit.flush(); await yieldHost(); yielded = performance.now(); }
    }
    if (!core.jit_retired()) throw Error('no compiled instructions executed');
    self.postMessage({ hart: d.hart, pass: true, steps, jitRetired: core.jit_retired(), ms: performance.now() - start });
    channel.port1.close(); channel.port2.close(); core.free(); reference.free();
  } catch (e) { self.postMessage({ hart: d.hart, pass: false, error: String(e) }); }
  finally { jit?.dispose(); }
};
