import { instanceCharge, type SharedBlock, type CodeGroup, type SharedCodeCache } from './shared-code';
import { jitCharge, MiB } from './host-memory';
import { compileChainDispatcher, type SharedJitLayout } from './jit-compiler';
export interface SharedJitMemory { ram: WebAssembly.Memory; generations: WebAssembly.Memory; granules: WebAssembly.Memory; bytes: number }
// Free table ranges per table (start, length), sorted and merged: a batch's
// functions occupy consecutive slots, filled by its install(base).
const tableRanges = new WeakMap<WebAssembly.Table, [number, number][]>();
let sessionSerial = 0;
export class JitRuntime {
  private worker: Worker | MessagePort;
  private freeRanges: [number, number][];
  private session = ++sessionSerial;
  private queue: SharedBlock[] = [];
  private sharedStats?: ReturnType<SharedCodeCache['stats']>;
  private sharedHits = 0;
  private crossHartHits = 0;
  private lastTouch = 0;
  private rejected: number[] = [];
  private slots: number[] = [];
  private inflight = 0;
  private hostBudget = 256 * MiB;
  setHostBudget(bytes: number) { this.hostBudget = Math.max(0, bytes); }
  private sharedLayout?: SharedJitLayout;
  private batches: { ids: number[]; slots: number[]; base: number; bytes: number; serial?: number; lease?: number; functions: number; instance: WebAssembly.Instance; used: number }[] = [];
  evicted = 0;
  tailCalls?: boolean;
  compiled = 0;
  private queuedAt = new Map<number, number>();
  latencyTotalMs = 0;
  latencyMaxMs = 0;
  cacheClears = 0;
  private get limit() { return this.cache?.limit ?? (this.sharedLayout ? 131072 : 65536); }
  private get byteLimit() { return this.cache?.byteLimit ?? (this.sharedLayout ? 128 * 1024 * 1024 : Infinity); }
  private get installedBytes() { return this.batches.reduce((n, b) => n + b.bytes, 0); }
  stats() { return { compiled: this.compiled, queued: this.queue.length, inflight: this.inflight,
    pending: this.queuedAt.size, modules: this.batches.length, estimatedHostBytes: this.port ? this.batches.reduce((n,b) => n + instanceCharge(b.functions), 0) : jitCharge(this.installedBytes, this.batches.length), sharedCode: this.sharedStats, sharedCodeHits: this.sharedHits, crossHartCodeHits: this.crossHartHits, encodedBytesPerBlock: this.slots.length ? this.installedBytes / this.slots.length : 0, chargedBytesPerBlock: this.slots.length ? jitCharge(this.installedBytes, this.batches.length) / this.slots.length : 0, hostBudget: this.hostBudget, latencyMeanMs: this.compiled ? this.latencyTotalMs / this.compiled : 0,
    latencyMaxMs: this.latencyMaxMs, cacheClears: this.cacheClears, evicted: this.evicted, installed: this.slots.length, installedLimit: this.limit, installedWasmBytes: this.installedBytes, installedWasmLimit: Number.isFinite(this.byteLimit) ? this.byteLimit : undefined, tailCalls: this.tailCalls }; }
  error?: string;
  constructor(memory: WebAssembly.Memory, private table: WebAssembly.Table,
    private install: (id: number, slot: number, count: number) => void,
    private clear: () => void, slow?: WebAssembly.ExportValue,
    private cache?: { usage(ids: Uint32Array): number; evict(ids: Uint32Array): void; limit?: number; byteLimit?: number }, shared?: SharedJitMemory, private port?: MessagePort) {
    if (port && (!shared || !cache)) throw Error('shared JIT requires shared memories and eviction callbacks');
    this.worker = port ?? new Worker(new URL('./compiler.worker.ts', import.meta.url), { type: 'module' });
    this.freeRanges = tableRanges.get(table) ?? []; tableRanges.set(table, this.freeRanges);
    if (shared) this.sharedLayout = { bytes: shared.bytes, ramPages: shared.ram.buffer.byteLength / 65536, generationPages: shared.generations.buffer.byteLength / 65536, granulePages: shared.granules.buffer.byteLength / 65536 };
    const sharedEnv: WebAssembly.ModuleImports = shared ? { ram: shared.ram, generations: shared.generations, granules: shared.granules } : {};
    const dispatcher = compileChainDispatcher(this.sharedLayout);
    const next = WebAssembly.validate(dispatcher)
      ? new WebAssembly.Instance(new WebAssembly.Module(dispatcher), { env: { memory, table, ...sharedEnv } }).exports.next
      : undefined;
    this.worker.onmessage = ({ data }) => {
      if (data.evict !== undefined) {
        for (const serial of data.evict) this.dropShared(serial);
        this.port?.postMessage({ ack: data.batch }); return;
      }
      if (this.port && data.session !== this.session) return;
      this.inflight--;
      try {
        this.tailCalls = data.tailCalls;
        if (data.error) throw new Error(data.error);
        this.sharedStats = data.shared;
        for (const id of data.rejected ?? []) { this.rejected.push(id); this.queuedAt.delete(id); }
        const groups: CodeGroup[] = data.groups ?? [{ ...data, functions: data.blocks.length }];
        for (const group of groups) {
          let batch = this.port ? this.batches.find(b => b.serial === group.serial) : undefined;
          if (!batch) {
            const instance = new WebAssembly.Instance(group.module, { env: { memory, table, ...sharedEnv, ...(next ? { next } : {}), ...(slow ? { slow } : {}) } });
            const base = this.allocate(group.functions);
            (instance.exports.install as (base: number) => void)(base);
            batch = { ids: [], slots: [], base, bytes: group.byteLength ?? 0, serial: group.serial, lease: group.lease, functions: group.functions, instance, used: 0 };
            this.batches.push(batch);
          }
          batch.lease = group.lease;
          for (const [position, b] of group.blocks.entries()) {
            const slot = batch.base + (b.exportId ?? position); this.slots.push(slot);
            this.install(b.id, slot, b.count); this.compiled++;
            const latency = performance.now() - (this.queuedAt.get(b.id) ?? performance.now());
            this.latencyTotalMs += latency; this.latencyMaxMs = Math.max(this.latencyMaxMs, latency);
            this.queuedAt.delete(b.id); batch.ids.push(b.id); batch.slots.push(slot);
          }
        }
        this.sharedHits += data.sharedCodeHits ?? 0;
        this.crossHartHits += data.crossHartCodeHits ?? 0;
      } catch (error) { this.error = String(error); }
    };
    if (!port) (this.worker as Worker).onerror = e => { this.error = e.message; };
    Object.assign(globalThis, {
      rv64Compile: (id: number, pc: bigint, words: Uint32Array, raw?: Uint32Array, pa?: bigint, generation?: bigint) => {
        // Never re-enter Rust eviction from its compilation callback.
        if (this.queue.length >= 1024 && this.cache) { this.rejected.push(id); return; }
        this.queuedAt.set(id, performance.now());
        this.queue.push({ id, pc, pa, generation, words: Array.from(words), raw: raw && Array.from(raw) });
      },
    });
  }
  private dropShared(serial: number) {
    const batch = this.batches.find(b => b.serial === serial);
    if (!batch) return;
    this.cache?.evict(new Uint32Array(batch.ids)); this.evicted += batch.ids.length;
    const slots = new Set(batch.slots);
    this.free(batch);
    this.slots = this.slots.filter(slot => !slots.has(slot));
    this.batches = this.batches.filter(b => b !== batch);
  }
  private release() {
    for (const batch of this.batches) this.free(batch);
    this.slots = []; this.batches = [];
  }
  /** First fit among the free ranges, else grow the table. */
  private allocate(n: number) {
    const i = this.freeRanges.findIndex(([, length]) => length >= n);
    if (i < 0) return this.table.grow(n);
    const [start, length] = this.freeRanges[i]!;
    if (length === n) this.freeRanges.splice(i, 1); else this.freeRanges[i] = [start + n, length - n];
    return start;
  }
  private free(batch: { base: number; functions: number }) {
    for (let slot = batch.base; slot < batch.base + batch.functions; slot++) this.table.set(slot, null);
    const ranges = this.freeRanges;
    let i = ranges.findIndex(([start]) => start > batch.base); if (i < 0) i = ranges.length;
    ranges.splice(i, 0, [batch.base, batch.functions]);
    if (i + 1 < ranges.length && ranges[i]![0] + ranges[i]![1] === ranges[i + 1]![0]) { ranges[i]![1] += ranges[i + 1]![1]; ranges.splice(i + 1, 1); }
    if (i > 0 && ranges[i - 1]![0] + ranges[i - 1]![1] === ranges[i]![0]) { ranges[i - 1]![1] += ranges[i]![1]; ranges.splice(i, 1); }
  }
  flush() {
    if (this.rejected.length) { this.cache?.evict(new Uint32Array(this.rejected)); this.rejected = []; }
    if (this.error) throw new Error(`JIT compiler: ${this.error}`);
    // Clear both sides only at a quiescent boundary, never recycle a live slot.
    const limit = this.limit;
    if (this.slots.length >= limit || this.installedBytes >= this.byteLimit || !this.port && jitCharge(this.installedBytes, this.batches.length) >= this.hostBudget) {
      if (this.inflight) return;
      if (this.cache) {
        // Evict whole modules so V8 can reclaim code, preserving recently used
        // kernel/runtime batches. Rust drops references before slots are reused.
        const ranked = this.batches.map(batch => ({ batch, used: this.cache!.usage(new Uint32Array(batch.ids)) }))
          .sort((a,b) => a.used - b.used);
        const victims = new Set<typeof this.batches[number]>();
        const ids: number[] = [], slots = new Set<number>();
        let bytes = this.installedBytes;
        for (const { batch } of ranked) {
          bytes -= batch.bytes; victims.add(batch); ids.push(...batch.ids); batch.slots.forEach(slot => slots.add(slot));
          if (this.slots.length - slots.size <= limit * 0.75 && bytes <= this.byteLimit * 0.75 && (this.port || jitCharge(bytes, this.batches.length - victims.size) <= this.hostBudget * 0.75)) break;
        }
        this.cache.evict(new Uint32Array(ids)); this.evicted += ids.length;
        for (const batch of victims) this.free(batch);
        this.slots = this.slots.filter(slot => !slots.has(slot));
        for (const batch of victims) if (this.port) this.port.postMessage({ release: batch.serial, lease: batch.lease });
        this.batches = this.batches.filter(batch => !victims.has(batch));
      } else {
        this.cacheClears++; this.clear(); this.release(); this.queue = []; this.queuedAt.clear();
      }
    }
    if (this.port && performance.now() - this.lastTouch >= 1000) {
      const touch: number[] = [];
      for (const batch of this.batches) {
        const used = this.cache?.usage(new Uint32Array(batch.ids)) ?? 0;
        if (used > batch.used) touch.push(batch.serial!);
        batch.used = used;
      }
      this.port.postMessage({ touch }); this.lastTouch = performance.now();
    }
    // Coalesce sparse SMP requests for at most 4 ms (no extra timer/guest stall).
    if (this.port && this.queue.length < 256 && this.queue.length && performance.now() - this.queuedAt.get(this.queue[0]!.id)! < 4) return;
    while (this.hostBudget > 0 && this.queue.length && this.inflight < 2) { const blocks = this.queue.splice(0, 256); this.worker.postMessage(this.sharedLayout ? { blocks, shared: this.sharedLayout, session: this.session } : blocks); this.inflight++; }
  }
  dispose() { this.worker.onmessage = null; if (this.cache) this.cache.evict(new Uint32Array(this.batches.flatMap(b => b.ids))); else this.clear(); if (this.port) this.port.postMessage({ reset: true }); else { (this.worker as Worker).onerror = null; (this.worker as Worker).terminate(); } this.release(); this.queue = []; this.rejected = []; this.queuedAt.clear(); }
}
