// Accounting budget, not a promise about V8 RSS/GC. Shared memories count once.
export const MiB = 1024 * 1024;
export const HOST_BUDGET = 2560 * MiB;
export const HOST_RESERVE = 256 * MiB; // workers, queues, DOM, disk/network, transient compilation
export const JIT_EXPANSION = 8; // conservative native-code/metadata allowance per encoded byte
export const MODULE_OVERHEAD = 64 * 1024;
export function jitCharge(bytes: number, modules: number) { return bytes * JIT_EXPANSION + modules * MODULE_OVERHEAD; }
export function hartBudget(shared: number, privateBytes: number[], measured = 0) {
  const available = Math.max(0, HOST_BUDGET - HOST_RESERVE - shared - privateBytes.reduce((a, b) => a + b, 0));
  return Math.floor(available / privateBytes.length * (measured > HOST_BUDGET ? 0.5 : 1));
}
export class BoundedHistory<T> {
  entries: T[] = [];
  private sizes: number[] = [];
  bytes = 0;
  dropped = 0;
  constructor(readonly limit: number, readonly count = 4096) {}
  push(value: T) {
    const size = JSON.stringify(value).length * 2;
    if (size > this.limit) { this.dropped++; return; }
    while (this.entries.length && (this.bytes + size > this.limit || this.entries.length >= this.count)) {
      this.bytes -= this.sizes.shift()!; this.entries.shift(); this.dropped++;
    }
    this.entries.push(value); this.sizes.push(size); this.bytes += size;
  }
}
export class ConsoleTail {
  text = ''; total = 0;
  constructor(readonly limit = MiB) {}
  append(chunk: string) { this.total += chunk.length; this.text = (this.text + chunk).slice(-this.limit); }
  get dropped() { return this.total - this.text.length; }
}

// Pressure only tightens the ceiling; do not regrow it between slow UA samples.
export function pressureCeiling(current: number, measured: number) {
  return measured > HOST_BUDGET ? Math.floor(current / 2) : current;
}

// URL wins over the Vite environment. Bound the experiment to audited ceilings.
export function jitCeilingBytes(url: string | null, env?: string) {
  const value = Number(url ?? env ?? '256');
  if (value !== 256 && value !== 384) throw Error('jitBudgetMb must be 256 or 384');
  return value * MiB;
}
