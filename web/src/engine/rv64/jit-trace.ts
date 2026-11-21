// Differential CPU state at every generated-block/interpreter-instruction exit.
// Host time and device polling are deterministic; full RAM is compared at the end.
import { JitRuntime } from './jit';
const host = globalThis as typeof globalThis & { rv64Result?: unknown };
try {
  const url = new URL('/rv64/rv64_core.js', location.origin).href, mod = await import(/* @vite-ignore */ url), wasm = await mod.default();
  const [kernel, initrd] = await Promise.all(['/rv64/vmlinuz.efi','/rv64/alpine.cpio'].map(async u => new Uint8Array(await (await fetch(u)).arrayBuffer())));
  const core = new mod.Engine(256), reference = new mod.Engine(256);
  for (const c of [core,reference]) c.boot(kernel,initrd,'earlycon=sbi console=hvc0 rdinit=/init nokaslr');
  core.jit_threshold(1);
  const singleStep = new URLSearchParams(location.search).has("single");
  if (singleStep) core.test_single_step();
  const jit = new JitRuntime(wasm.memory, core.jit_table(), (id,slot,count) => core.jit_install(id,slot,count), () => core.jit_clear(), wasm.jit_slow);
  const channel = new MessageChannel();
  const yieldTask = () => new Promise<void>(resolve => { channel.port1.onmessage=()=>resolve(); channel.port2.postMessage(0); });
  let instructions = 0, boundaries = 0, tickAt = 0, yieldAt = performance.now();
  const start = performance.now();
  try {
    while (instructions < (singleStep ? 2000000 : 20000000)) {
      if (instructions >= tickAt) { for (const c of [core,reference]) c.test_time(BigInt(Math.floor(instructions/10))); tickAt = instructions+4096; }
      const n = core.test_block();
      if (n) {
        reference.test_steps(n); instructions += n; boundaries++;
        if (!core.test_equal(reference,false)) throw new Error(`state divergence at ${instructions}, JIT pc=${core.pc().toString(16)} reference pc=${reference.pc().toString(16)}`);
      }
      jit.flush();
      if (!n || performance.now()-yieldAt > 8) {
        await yieldTask(); yieldAt = performance.now();
        document.querySelector('#console')!.textContent = JSON.stringify({instructions,boundaries,jitRetired:core.jit_retired()});
      }
    }
    if (!core.test_equal(reference,true)) throw new Error('final RAM divergence');
    host.rv64Result = { type:'jit-trace', pass:true, instructions, boundaries, jitRetired:core.jit_retired(), compiled:jit.compiled, milliseconds:performance.now()-start, singleStep, scope:singleStep ? 'CPU state after every instruction with one-instruction JIT blocks; exact full RAM at end' : 'CPU state at block exits; exact full RAM at end' };
  } finally { channel.port1.close(); channel.port2.close(); jit.dispose(); core.free(); reference.free(); }
} catch(error) { host.rv64Result = { type:'error', error:String(error) }; }
