import { atomicModule, SharedHartMemory } from './smp';
const result = globalThis as typeof globalThis & { rv64Result?: unknown };
const samples: unknown[] = [];
try {
  for (const harts of [2, 4]) {
    const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
    const module = atomicModule(1), barrier = new SharedArrayBuffer(4), workers: Worker[] = [];
    const started = performance.now();
    try {
      const replies = await Promise.all(Array.from({ length: harts }, () => new Promise<{ retries: number }>((resolve, reject) => {
        const worker = new Worker(new URL('./smp.worker.ts', import.meta.url), { type: 'module' });
        workers.push(worker);
        const timeout = setTimeout(() => reject(new Error('shared memory contention timeout')), 30000);
        worker.onerror = e => { clearTimeout(timeout); reject(new Error(e.message)); };
        worker.onmessage = ({ data }) => { clearTimeout(timeout); if (data.error) reject(new Error(data.error)); else resolve(data); };
        worker.postMessage({ memory, module, barrier, harts });
      })));
      const ram = new SharedHartMemory(memory, module), expected = BigInt(harts * 10000);
      if (ram.load(64, 8) !== expected || ram.load(72, 8) !== expected) throw new Error('lost atomic update');
      samples.push({ workers: harts, ms: performance.now() - started, amoIncrements: String(expected), lrscIncrements: String(expected), retries: replies.reduce((sum, r) => sum + r.retries, 0) });
    } finally { workers.forEach(w => w.terminate()); }
  }
  result.rv64Result = { type: 'smp-substrate', pass: true, samples };
} catch (error) { result.rv64Result = { type: 'smp-substrate', pass: false, error: String(error), samples }; }
document.querySelector('#console')!.textContent = JSON.stringify(result.rv64Result, null, 2);
