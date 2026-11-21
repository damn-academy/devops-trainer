import { compileChainDispatcher, type Block } from './jit-compiler';
const freeSlots: number[] = [];
export class JitRuntime {
  private worker = new Worker(new URL('./compiler.worker.ts', import.meta.url), { type: 'module' });
  private queue: Block[] = [];
  private slots: number[] = [];
  private inflight = 0;
  private batches: { ids: number[]; slots: number[] }[] = [];
  evicted = 0;
  tailCalls?: boolean;
  compiled = 0;
  private queuedAt = new Map<number, number>();
  latencyTotalMs = 0;
  latencyMaxMs = 0;
  cacheClears = 0;
  stats() { return { compiled: this.compiled, queued: this.queue.length, inflight: this.inflight,
    pending: this.queuedAt.size, latencyMeanMs: this.compiled ? this.latencyTotalMs / this.compiled : 0,
    latencyMaxMs: this.latencyMaxMs, cacheClears: this.cacheClears, evicted: this.evicted, installed: this.slots.length, tailCalls: this.tailCalls }; }
  error?: string;
  constructor(memory: WebAssembly.Memory, private table: WebAssembly.Table,
    private install: (id: number, slot: number, count: number) => void,
    private clear: () => void, slow?: WebAssembly.ExportValue,
    private cache?: { usage(ids: Uint32Array): number; evict(ids: Uint32Array): void; limit?: number }) {
    const dispatcher = compileChainDispatcher();
    const next = WebAssembly.validate(dispatcher)
      ? new WebAssembly.Instance(new WebAssembly.Module(dispatcher), { env: { memory, table } }).exports.next
      : undefined;
    this.worker.onmessage = ({ data }) => {
      this.inflight--;
      try {
        this.tailCalls = data.tailCalls;
        if (data.error) throw new Error(data.error);
        const instance = new WebAssembly.Instance(data.module, { env: { memory, ...(next ? { next } : {}), ...(slow ? { slow } : {}) } });
        const batch = { ids: [] as number[], slots: [] as number[] };
        for (const b of data.blocks) {
          const slot = freeSlots.pop() ?? table.grow(1);
          table.set(slot, instance.exports[`b${b.id}`]); this.slots.push(slot);
          this.install(b.id, slot, b.count); this.compiled++;
          const latency = performance.now() - this.queuedAt.get(b.id)!;
          this.latencyTotalMs += latency; this.latencyMaxMs = Math.max(this.latencyMaxMs, latency);
          this.queuedAt.delete(b.id); batch.ids.push(b.id); batch.slots.push(slot);
        }
        this.batches.push(batch);
      } catch (error) { this.error = String(error); }
    };
    this.worker.onerror = e => { this.error = e.message; };
    Object.assign(globalThis, {
      rv64Compile: (id: number, pc: bigint, words: Uint32Array, raw?: Uint32Array) => { this.queuedAt.set(id, performance.now()); this.queue.push({ id, pc, words: Array.from(words), raw: raw && Array.from(raw) }); },
    });
  }
  private release() {
    for (const slot of this.slots) { this.table.set(slot, null); freeSlots.push(slot); }
    this.slots = []; this.batches = [];
  }
  flush() {
    if (this.error) throw new Error(`JIT compiler: ${this.error}`);
    // Clear both sides only at a quiescent boundary, never recycle a live slot.
    const limit = this.cache?.limit ?? 65536;
    if (this.slots.length >= limit) {
      if (this.inflight) return;
      if (this.cache) {
        // Evict whole modules so V8 can reclaim code, preserving recently used
        // kernel/runtime batches. Rust drops references before slots are reused.
        const ranked = this.batches.map(batch => ({ batch, used: this.cache!.usage(new Uint32Array(batch.ids)) }))
          .sort((a,b) => a.used - b.used);
        const victims = new Set<typeof this.batches[number]>();
        const ids: number[] = [], slots = new Set<number>();
        for (const { batch } of ranked) {
          victims.add(batch); ids.push(...batch.ids); batch.slots.forEach(slot => slots.add(slot));
          if (this.slots.length - slots.size <= limit * 0.75) break;
        }
        this.cache.evict(new Uint32Array(ids)); this.evicted += ids.length;
        for (const slot of slots) { this.table.set(slot, null); freeSlots.push(slot); }
        this.slots = this.slots.filter(slot => !slots.has(slot));
        this.batches = this.batches.filter(batch => !victims.has(batch));
      } else {
        this.cacheClears++; this.clear(); this.release(); this.queue = []; this.queuedAt.clear();
      }
    }
    while (this.queue.length && this.inflight < 2) { this.worker.postMessage(this.queue.splice(0, 256)); this.inflight++; }
  }
  dispose() { this.worker.onmessage = null; this.worker.onerror = null; this.worker.terminate(); this.release(); this.queue = []; }
}
