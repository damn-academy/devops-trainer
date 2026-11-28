import type { Encoding, ObjectRef } from './objects';
/** A few workers that fetch, decode and verify objects (fetchObject) in
 * parallel: a restore decodes ~700 MB, and the zstd decoder is JavaScript. */
export class ObjectPool {
  private workers: Worker[] = [];
  private busy: number[] = [];
  private waiting = new Map<number, { worker: number; resolve: (b: Uint8Array) => void; reject: (e: Error) => void }>();
  private next = 0;
  constructor(size = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 2) - 1))) {
    for (let i = 0; i < size; i++) {
      const w = new Worker(new URL('./object.worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = ({ data }: MessageEvent<{ id: number; bytes?: Uint8Array; error?: string }>) => {
        const job = this.waiting.get(data.id);
        if (!job) return;
        this.waiting.delete(data.id); this.busy[job.worker]!--;
        if (data.bytes) job.resolve(data.bytes); else job.reject(new Error(data.error));
      };
      w.onerror = (e) => {
        for (const [id, job] of this.waiting) if (job.worker === i) { this.waiting.delete(id); job.reject(new Error(`object worker: ${e.message}`)); }
      };
      this.workers.push(w); this.busy.push(0);
    }
  }
  get size() { return this.workers.length; }
  read(base: string, ref: ObjectRef, o: { encoding?: Encoding; cache?: boolean } = {}): Promise<Uint8Array> {
    const worker = this.busy.indexOf(Math.min(...this.busy)), id = this.next++;
    this.busy[worker]!++;
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { worker, resolve, reject });
      this.workers[worker]!.postMessage({ id, base, ref, encoding: o.encoding, cache: !!o.cache });
    });
  }
  dispose() { this.workers.forEach((w) => w.terminate()); }
}
