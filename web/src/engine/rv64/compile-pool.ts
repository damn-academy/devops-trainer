/** Bounded execution pool; queued jobs retain their broker reservations. */
export class CompilePool {
  private idle: number[];
  private queue: { bytes: Uint8Array<ArrayBuffer>; resolve: (module: WebAssembly.Module) => void; reject: (error: unknown) => void }[] = [];
  busy = 0;
  jobs = 0;
  totalMs = 0;
  maxMs = 0;
  constructor(private workers: ((bytes: Uint8Array<ArrayBuffer>) => Promise<{ module: WebAssembly.Module; compileMs: number }>)[]) {
    this.idle = workers.map((_, i) => i);
  }
  compile = (bytes: Uint8Array<ArrayBuffer>) => new Promise<WebAssembly.Module>((resolve, reject) => {
    this.queue.push({ bytes, resolve, reject }); this.pump();
  });
  stats() { return { compilePoolSize: this.workers.length, compilePoolBusy: this.busy, compilePoolQueued: this.queue.length,
    compileJobs: this.jobs, compileJobMeanMs: this.jobs ? this.totalMs / this.jobs : 0, compileJobMaxMs: this.maxMs }; }
  private pump() {
    while (this.idle.length && this.queue.length) {
      const slot = this.idle.pop()!, job = this.queue.shift()!; this.busy++;
      void this.workers[slot]!(job.bytes).then(result => {
        this.jobs++; this.totalMs += result.compileMs; this.maxMs = Math.max(this.maxMs, result.compileMs);
        job.resolve(result.module);
      }, job.reject).finally(() => { this.busy--; this.idle.push(slot); this.pump(); });
    }
  }
}
