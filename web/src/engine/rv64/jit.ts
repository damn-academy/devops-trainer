import type { Block } from './jit-compiler';
const freeSlots: number[] = [];
export class JitRuntime {
  private worker = new Worker(new URL('./compiler.worker.ts', import.meta.url), { type: 'module' });
  private queue: Block[] = [];
  private slots: number[] = [];
  private inflight = 0;
  compiled = 0;
  error?: string;
  constructor(memory: WebAssembly.Memory, private table: WebAssembly.Table,
    private install: (id: number, slot: number, count: number) => void,
    private clear: () => void, slow?: WebAssembly.ExportValue) {
    this.worker.onmessage = ({ data }) => {
      this.inflight--;
      try {
        if (data.error) throw new Error(data.error);
        const instance = new WebAssembly.Instance(data.module, { env: { memory, ...(slow ? { slow } : {}) } });
        for (const b of data.blocks) {
          const slot = freeSlots.pop() ?? table.grow(1);
          table.set(slot, instance.exports[`b${b.id}`]); this.slots.push(slot);
          this.install(b.id, slot, b.count); this.compiled++;
        }
      } catch (error) { this.error = String(error); }
    };
    this.worker.onerror = e => { this.error = e.message; };
    Object.assign(globalThis, {
      rv64Compile: (id: number, pc: bigint, words: Uint32Array, raw?: Uint32Array) => { this.queue.push({ id, pc, words: Array.from(words), raw: raw && Array.from(raw) }); },
    });
  }
  private release() {
    for (const slot of this.slots) { this.table.set(slot, null); freeSlots.push(slot); }
    this.slots = [];
  }
  flush() {
    if (this.error) throw new Error(`JIT compiler: ${this.error}`);
    // Clear both sides only at a quiescent boundary, never recycle a live slot.
    if (this.slots.length >= 65536) {
      if (this.inflight) return;
      this.clear(); this.release(); this.queue = [];
    }
    while (this.queue.length && this.inflight < 2) { this.worker.postMessage(this.queue.splice(0, 256)); this.inflight++; }
  }
  dispose() { this.worker.onmessage = null; this.worker.onerror = null; this.worker.terminate(); this.release(); this.queue = []; }
}
