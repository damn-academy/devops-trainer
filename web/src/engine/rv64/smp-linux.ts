import { atomicModule, HartMailboxes, RESERVATION_GRANULE } from './smp';
const host = globalThis as typeof globalThis & { rv64Result?: unknown };
const output = document.querySelector('#console')!;
const samples: unknown[] = [];
try {
  const [kernel, initrd] = await Promise.all(['/rv64/vmlinuz.efi', '/rv64/alpine.cpio'].map(async u => {
    const r = await fetch(u); if (!r.ok) throw Error(`${u}: ${r.status}`); return new Uint8Array(await r.arrayBuffer());
  }));
  for (const harts of [2, 4]) {
    const bytes = 256 * 1024 * 1024, pages = bytes / 65536 + 1;
    const memory = new WebAssembly.Memory({ initial: pages, maximum: pages, shared: true });
    const module = atomicModule(pages), mail = new HartMailboxes(harts).words.buffer;
    const generations = new SharedArrayBuffer(bytes / 4096 * 4), epoch = performance.timeOrigin + performance.now();
    const granules = new SharedArrayBuffer(Math.ceil(memory.buffer.byteLength / RESERVATION_GRANULE) * 4);
    const control = new SharedArrayBuffer(harts * 64), ctl = new Int32Array(control);
    for (let h = 0; h < harts; h++) ctl[h * 16] = 1;
    const workers: Worker[] = [], start = performance.now(); let text = '', sent = false;
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(Error(`Linux ${harts}-hart timeout`)), 900000);
        for (let hart = 0; hart < harts; hart++) {
          const w = new Worker(new URL('./smp-cpu.worker.ts', import.meta.url), { type: 'module' }); workers.push(w);
          w.onerror = e => { clearTimeout(timeout); reject(Error(e.message)); };
          w.onmessage = ({ data }) => {
            if (data.type === 'error') { clearTimeout(timeout); reject(Error(data.error)); }
            if (data.type === 'metrics') output.textContent = text + '\n' + JSON.stringify(data);
            if (data.type === 'console') {
              text += new TextDecoder().decode(data.bytes).replace(/\r/g, ''); output.textContent = text;
              if (text.includes('Kernel panic')) { clearTimeout(timeout); reject(Error('Kernel panic')); }
              if (!sent && (text.includes('/ #') || text.includes('~ #'))) {
                sent = true;
                workers[0]!.postMessage({ input: new TextEncoder().encode("cat /sys/devices/system/cpu/online; echo SMP_SHELL_OK\n") });
              }
              if (text.includes('\nSMP_SHELL_OK\n')) {
                clearTimeout(timeout);
                if (!text.includes(`\n0-${harts - 1}\n`)) reject(Error('unexpected online CPUs'));
                else { samples.push({ harts, shellMs: performance.now() - start, console: text }); resolve(); }
              }
            }
          };
          w.postMessage({ hart, harts, bytes, memory, module, mail, control, generations, granules, epoch, kernel: hart ? undefined : kernel, initrd: hart ? undefined : initrd });
        }
      });
    } finally { Atomics.store(ctl, 15, 1); workers.forEach(w => w.terminate()); }
  }
  host.rv64Result = { type: 'smp-linux', pass: true, samples };
} catch (e) { host.rv64Result = { type: 'smp-linux', pass: false, samples, error: String(e), console: output.textContent }; }
