import { atomicModule } from './smp';
const host = globalThis as typeof globalThis & { rv64Result?: unknown };
const samples: unknown[] = [];
try {
  for (const harts of [2, 4]) {
    const bytes = 32 << 20, pages = bytes / 65536 + 1;
    const memory = new WebAssembly.Memory({ initial: pages, maximum: pages, shared: true });
    const module = atomicModule(pages), generations = new SharedArrayBuffer(bytes / 4096 * 4), barrier = new SharedArrayBuffer(4);
    const workers: Worker[] = [];
    try {
      const rows = await Promise.all(Array.from({ length: harts }, (_, hart) => new Promise((resolve, reject) => {
        const worker = new Worker(new URL('./smp-trace.worker.ts', import.meta.url), { type: 'module' }); workers.push(worker);
        const timeout = setTimeout(() => reject(Error('trace timeout')), 120000);
        worker.onerror = e => { clearTimeout(timeout); reject(Error(e.message)); };
        worker.onmessage = ({ data }) => { clearTimeout(timeout); if (!data.pass) reject(Error(data.error)); else resolve(data); };
        worker.postMessage({ hart, memory, module, generations, barrier });
      })));
      samples.push({ harts, rows });
    } finally { workers.forEach(w => w.terminate()); }
  }
  host.rv64Result = { type: 'smp-trace', pass: true, samples };
} catch (e) { host.rv64Result = { type: 'smp-trace', pass: false, samples, error: String(e) }; }
document.querySelector('#console')!.textContent = JSON.stringify(host.rv64Result);
