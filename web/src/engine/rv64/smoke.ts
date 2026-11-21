import { ByteRing } from './ring';
const program = new Uint32Array([0x02a00513, 0x10500073]); // addi a0,x0,42; wfi
const input = ByteRing.create(), output = ByteRing.create();
const control = new SharedArrayBuffer(32);
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const host = globalThis as typeof globalThis & { rv64Result?: unknown };
worker.onmessage = ({ data }) => {
  if (data.type === 'smoke' || data.type === 'error') {
    host.rv64Result = data;
    document.querySelector('#console')!.textContent = JSON.stringify(data);
    if (!new URLSearchParams(location.search).has('profile')) worker.terminate();
  }
};
worker.onerror = (e) => { host.rv64Result = { type: 'error', error: e.message }; };
const boot = new URLSearchParams(location.search).has('boot');
if (boot) {
  const start = performance.now(); let text = ''; let sent = false; let benchStart = 0; let retiredStart = 0; let busyStart = 0;
  const decoder = new TextDecoder(); const ctl = new Int32Array(control);
  const [kernel, initrd] = await Promise.all(['/rv64/vmlinuz.efi', '/rv64/alpine.cpio'].map(async url => {
    const response = await fetch(url); if (!response.ok) throw new Error(`${url}: ${response.status}`); return response.arrayBuffer();
  }));
  const bootStart = performance.now();
  const timer = setInterval(() => {
    const bytes = output.read(); if (!bytes.length) return;
    text += decoder.decode(bytes, { stream: true }).replace(/\r/g, '');
    document.querySelector('#console')!.textContent = text;
    if (!sent && (text.includes('~ #') || text.includes('/ #'))) {
      (host as typeof host & { bootMs?: number }).bootMs = performance.now() - bootStart;
      benchStart = performance.now(); retiredStart = Atomics.load(ctl, 1) * 1000; busyStart = Atomics.load(ctl, 4);
      input.write(new TextEncoder().encode('/bin/coremark; echo RV64_BENCH_DONE\n')); sent = true;
    }
    if (text.includes('\nRV64_BENCH_DONE\n')) {
      const seconds = (performance.now() - benchStart) / 1000;
      host.rv64Result = { type: 'boot', stimecmpWrites: Atomics.load(ctl, 3), bootMs: (host as typeof host & { bootMs?: number }).bootMs, benchmarkSeconds: seconds,
        busyMips: (Atomics.load(ctl, 1) * 1000 - retiredStart) / (Atomics.load(ctl, 4) - busyStart),
        effectiveMips: (Atomics.load(ctl, 1) * 1000 - retiredStart) / seconds / 1e6, totalMs: performance.now() - start, console: text };
      clearInterval(timer); if (!new URLSearchParams(location.search).has('profile')) worker.terminate();
    }
  }, 8);
  worker.postMessage({ input: input.buffer, output: output.buffer, control, kernel, initrd, memoryMB: 512, cmdline: 'earlycon=sbi console=hvc0 rdinit=/init nokaslr' });
} else worker.postMessage({ input: input.buffer, output: output.buffer, control, program: program.buffer, memoryMB: 32 });
