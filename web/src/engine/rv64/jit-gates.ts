import { JitRuntime } from './jit';
const host = globalThis as typeof globalThis & { rv64Result?: unknown };
const log = document.querySelector('#console')!;
try {
  const url = new URL('/rv64/rv64_core.js', location.origin).href; const mod = await import(/* @vite-ignore */ url); const wasm = await mod.default();
  const fixtures = await (await fetch('/rv64/jit-fixtures.json')).json() as { name: string; elf: string; signature?: string }[];
  const channel = new MessageChannel();
  const yieldTask = () => new Promise<void>(resolve => { channel.port1.onmessage = () => resolve(); channel.port2.postMessage(0); });
  const results: { name: string; pass: boolean; jitRetired: number; reason?: string }[] = [];
  const filter = new URLSearchParams(location.search).get('filter');
  for (const fixture of fixtures.filter(f => !filter || f.name.includes(filter))) {
    const core = new mod.Engine(32);
    const symbols = core.test_elf(Uint8Array.from(atob(fixture.elf), c => c.charCodeAt(0))) as BigUint64Array;
    core.jit_threshold(1);
    const jit = new JitRuntime(wasm.memory, core.jit_table(), (id, slot, count) => core.jit_install(id, slot, count), () => core.jit_clear(), wasm.jit_slow);
    let value = 0n; const start = performance.now(); let yieldAt = start;
    const attempts = () => core.test_attempted?.() ?? core.test_cycles();
    try {
      for (let n = 0; attempts() < 2000000 && performance.now() - start < 60000; n++) {
        const before = attempts();
        core.run(256, Math.floor(before / 10));
        value = core.test_read(symbols[0]!);
        if (value) break;
        jit.flush();
        // Forced mode parks before each cold eligible block, so no test can
        // accidentally finish entirely in the interpreter while compilation waits.
        if (attempts() === before || performance.now()-yieldAt > 8) { await yieldTask(); yieldAt = performance.now(); }
      }
      let signature = '';
      if (fixture.signature && value === 1n) {
        for (let a = symbols[1]!; a < symbols[2]!; a += 16n)
          signature += core.test_read(a+8n).toString(16).padStart(16,'0') + core.test_read(a).toString(16).padStart(16,'0') + '\n';
      }
      const pass = core.jit_retired() > 0 && value === 1n && (!fixture.signature || fixture.signature === signature);
      results.push({ name: fixture.name, pass, jitRetired: core.jit_retired(), ...(!pass ? { reason: `tohost=${value} pc=${core.pc().toString(16)} signatureMatch=${fixture.signature === signature}` } : {}) });
    } finally { jit.dispose(); core.free(); }
    log.textContent = JSON.stringify(results.at(-1)) + `\n${results.length}/${fixtures.length}`;
  }
  channel.port1.close(); channel.port2.close();
  host.rv64Result = { type: 'jit-gates', pass: results.every(r => r.pass), results };
} catch (error) { host.rv64Result = { type: 'error', error: String(error) }; }
