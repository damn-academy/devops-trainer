import { createSharedCompiler } from './shared-compiler';
import { sharedTable, atomicModule, HartMailboxes, granuleTableBytes } from './smp';
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
    const generations = sharedTable(bytes / 4096 * 4), epoch = performance.timeOrigin + performance.now();
    const granules = sharedTable(granuleTableBytes(memory.buffer.byteLength));
    const control = new SharedArrayBuffer(harts * 64), ctl = new Int32Array(control);
    for (let h = 0; h < harts; h++) ctl[h * 16] = 1;
    const compiler = createSharedCompiler(harts * 256 * 1024 * 1024, harts);
    const workers: Worker[] = [], start = performance.now(); let text = '', sent = false;
    const last = new Map<number, unknown>();
    let shellMs: number | undefined, shellMetrics: unknown;
    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(Error(`Linux ${harts}-hart timeout`)), 900000);
        compiler.onerror = e => { clearTimeout(timeout); reject(Error(e.message)); };
        for (let hart = 0; hart < harts; hart++) {
          const w = new Worker(new URL('./smp-cpu.worker.ts', import.meta.url), { type: 'module' }); workers.push(w);
          w.onerror = e => { clearTimeout(timeout); reject(Error(e.message)); };
          w.onmessage = ({ data }) => {
            if (data.type === 'error') { clearTimeout(timeout); reject(Error(data.error)); }
            if (data.type === 'metrics') { last.set(data.hart, { ms: performance.now() - start, retired: data.retired, jitRetired: data.jitRetired, idleMs: data.idleMs, counters: data.counters, compiler: data.compiler }); output.textContent = text + '\n' + JSON.stringify(data); }
            if (data.type === 'console') {
              text += new TextDecoder().decode(data.bytes).replace(/\r/g, ''); output.textContent = text;
              if (text.includes('Kernel panic')) { clearTimeout(timeout); reject(Error('Kernel panic')); }
              if (!sent && (text.includes('/ #') || text.includes('~ #'))) {
                sent = true;
                workers[0]!.postMessage({ input: new TextEncoder().encode("cat /sys/devices/system/cpu/online; echo SMP_SHELL_OK\n") });
              }
              if (shellMs === undefined && text.includes('\nSMP_SHELL_OK\n')) {
                if (!text.includes(`\n0-${harts - 1}\n`)) { clearTimeout(timeout); reject(Error('unexpected online CPUs')); return; }
                shellMs = performance.now() - start; shellMetrics = Object.fromEntries(last);
                // Fixed CPU-bound guest work on every hart (shell arithmetic,
                // fork/exec, gzip, kernel copies): a steadier speed signal than boot.
                workers[0]!.postMessage({ input: new TextEncoder().encode(
                  "for c in $(seq 1 $(nproc)); do (i=0; while [ $i -lt 20000 ]; do i=$((i+1)); done; gzip -c /bin/busybox | md5sum >/dev/null; dd if=/dev/zero of=/dev/null bs=64k count=4000 2>/dev/null) & done; wait; echo SMP_WORK_DONE\n") });
              }
              if (shellMs !== undefined && text.includes('\nSMP_WORK_DONE\n')) {
                clearTimeout(timeout);
                samples.push({ harts, shellMs, workMs: performance.now() - start - shellMs, shellMetrics, metrics: Object.fromEntries(last), console: text }); resolve();
              }
            }
          };
          const compilerPort = compiler.connect(hart);
          w.postMessage({ compilerPort, hart, harts, bytes, memory, module, mail, control, generations, granules, epoch, kernel: hart ? undefined : kernel, initrd: hart ? undefined : initrd }, [compilerPort]);
        }
      });
    } finally { Atomics.store(ctl, 15, 1); workers.forEach(w => w.terminate()); compiler.terminate(); }
  }
  host.rv64Result = { type: 'smp-linux', pass: true, samples };
} catch (e) { host.rv64Result = { type: 'smp-linux', pass: false, samples, error: String(e), console: output.textContent }; }
