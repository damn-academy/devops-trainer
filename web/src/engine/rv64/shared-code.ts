import { compileBatch, type Block, type SharedJitLayout } from './jit-compiler';
import { jitCharge } from './host-memory';

// These are accounting allowances, not portable measurements of V8 allocations.
export const instanceCharge = (functions: number) => 4096 + 512 * functions;
export interface SharedBlock extends Block { pa?: bigint; generation?: bigint }
export function codeKey(b: SharedBlock, layout: SharedJitLayout) {
  if (b.pa === undefined || b.generation === undefined) throw Error('shared JIT requires R12 physical/generation ABI');
  // Include decoded/raw bytes as well: a fetch racing a writer must never alias
  // a different translation of the same key. Never hash away collision checks.
  return [JSON.stringify(layout), b.pa, b.pc, b.generation, b.words.join(','), b.raw?.join(',')].join('/');
}
export interface CodeGroup {
  serial: number; module: WebAssembly.Module; byteLength: number; functions: number;
  blocks: { id: number; exportId: number; count: number }[];
}
interface Entry {
  serial: number; creator: number; module: WebAssembly.Module; bytes: number; keys: string[];
  blocks: { id: number }[]; bodyBytes: number[]; holders: Set<number>; used: number;
}
/** One compiler/cache per shared machine. Leases include messages in transit.
 * Eviction waits for every hart to unlink Rust entries and table functions.
 * No replacement is admitted until those acknowledgements arrive. */
export class SharedCodeCache {
  private entries = new Map<number, Entry>();
  private index = new Map<string, { entry: Entry; offset: number }>();
  private compilingBytes = 0;
  private encodedBytes = 0;
  private instanceBytes = 0;
  private blockCount = 0;
  private histogram = Array<number>(9).fill(0);
  private readonly buckets = [256,512,1024,2048,4096,8192,16384,32768,Infinity];
  private serial = 0;
  private clock = 0;
  private pending: Promise<unknown> = Promise.resolve();
  budget = 0;
  hits = 0;
  crossHartHits = 0;
  compiled = 0;
  constructor(private revoke: (client: number, serial: number) => Promise<void>,
    private compile: (bytes: Uint8Array<ArrayBuffer>) => Promise<WebAssembly.Module> = bytes => WebAssembly.compile(bytes)) {}
  stats() {
    const encodedBytes = this.encodedBytes, instanceBytes = this.instanceBytes, blocks = this.blockCount;
    const bodyByteHistogram = this.buckets.map((upper, i) => ({ upper: Number.isFinite(upper) ? upper : null, count: this.histogram[i]! }));
    return { compilingBytes: this.compilingBytes, modules: this.entries.size, blocks, encodedBytes,
      encodedBytesPerBlock: blocks ? encodedBytes / blocks : 0,
      chargedBytesPerBlock: blocks ? (jitCharge(encodedBytes, this.entries.size) + instanceBytes) / blocks : 0,
      bodyByteHistogram,
      codeBytes: jitCharge(encodedBytes, this.entries.size), instanceBytes,
      estimatedHostBytes: jitCharge(encodedBytes, this.entries.size) + instanceBytes + this.compilingBytes,
      budget: this.budget, sharedCodeHits: this.hits, crossHartCodeHits: this.crossHartHits, compiledBlocks: this.compiled };
  }
  release(client: number, serial?: number) {
    for (const e of this.entries.values()) if ((serial === undefined || e.serial === serial) && e.holders.delete(client)) this.instanceBytes -= instanceCharge(e.blocks.length);
  }
  reset(client: number) {
    this.release(client);
    this.pending = this.pending.then(() => this.release(client));
  }
  touch(client: number, serials: number[]) {
    for (const serial of serials) { const e = this.entries.get(serial); if (e?.holders.has(client)) e.used = ++this.clock; }
  }
  private async remove(e: Entry) {
    // Leave it charged until every receiver has dropped its live functions.
    await Promise.all([...e.holders].map(client => this.revoke(client, e.serial)));
    for (const key of e.keys) this.index.delete(key);
    this.entries.delete(e.serial);
    this.encodedBytes -= e.bytes; this.blockCount -= e.blocks.length;
    this.instanceBytes -= instanceCharge(e.blocks.length) * e.holders.size;
    for (const n of e.bodyBytes) this.histogram[this.buckets.findIndex(upper => n <= upper)]!--;
  }
  private async room(extra: number, protectedIds: Set<number>) {
    if (this.stats().estimatedHostBytes + extra <= this.budget) return true;
    const target = this.budget * .75;
    for (const e of [...this.entries.values()].sort((a,b) => a.used - b.used)) {
      if (protectedIds.has(e.serial)) continue;
      await this.remove(e);
      if (this.stats().estimatedHostBytes + extra <= target) break;
    }
    return this.stats().estimatedHostBytes + extra <= this.budget;
  }
  request(client: number, blocks: SharedBlock[], layout: SharedJitLayout, tailCalls: boolean) {
    const work = this.pending.then(async () => {
      const hitsBefore = this.hits, crossHartBefore = this.crossHartHits;
      const groups = new Map<number, CodeGroup>();
      const missing: SharedBlock[] = [], keys: string[] = [], rejected: number[] = [];
      const protectedIds = new Set<number>();
      for (const b of blocks) {
        const key = `${Number(tailCalls)}/${codeKey(b, layout)}`, hit = this.index.get(key);
        if (!hit) { missing.push(b); keys.push(key); continue; }
        const e = hit.entry;
        protectedIds.add(e.serial);
        if (!e.holders.has(client)) {
          if (!await this.room(instanceCharge(e.blocks.length), protectedIds)) { rejected.push(b.id); continue; }
          e.holders.add(client); this.instanceBytes += instanceCharge(e.blocks.length);
        }
        e.used = ++this.clock; this.hits++;
        if (e.creator !== client) this.crossHartHits++;
        let group = groups.get(e.serial);
        if (!group) { group = { serial: e.serial, module: e.module, byteLength: e.bytes, functions: e.blocks.length, blocks: [] }; groups.set(e.serial, group); }
        const original = e.blocks[hit.offset]!;
        group.blocks.push({ id: b.id, exportId: original.id, count: b.words.length / 2 });
      }
      if (missing.length) {
        // Export IDs are module-local; consumer Rust IDs need not match.
        const canonical = missing.map((b, id) => ({ ...b, id }));
        const metrics = { bodyBytes: [] as number[] };
        const bytes = compileBatch(canonical, tailCalls, layout, metrics);
        const charge = jitCharge(bytes.byteLength, 1) + instanceCharge(canonical.length);
        if (await this.room(charge, protectedIds)) {
          let module: WebAssembly.Module;
          this.compilingBytes = charge;
          try { module = await this.compile(bytes); } finally { this.compilingBytes = 0; }
          if (!await this.room(charge, protectedIds)) {
            rejected.push(...missing.map(b => b.id));
          } else {
            const e: Entry = { serial: ++this.serial, creator: client, module, bytes: bytes.byteLength, keys, blocks: canonical.map(b => ({ id: b.id })), bodyBytes: metrics.bodyBytes, holders: new Set([client]), used: ++this.clock };
            this.encodedBytes += e.bytes; this.blockCount += e.blocks.length;
            this.instanceBytes += instanceCharge(e.blocks.length);
            for (const n of e.bodyBytes) this.histogram[this.buckets.findIndex(upper => n <= upper)]!++;
            this.entries.set(e.serial, e); keys.forEach((key, offset) => this.index.set(key, { entry: e, offset }));
            this.compiled += canonical.length;
            groups.set(e.serial, { serial: e.serial, module, byteLength: e.bytes, functions: canonical.length,
              blocks: missing.map((b, exportId) => ({ id: b.id, exportId, count: b.words.length / 2 })) });
          }
        } else rejected.push(...missing.map(b => b.id));
      }
      // Replies precede subsequent revokes on each port. A queued trim also
      // revokes protected hit groups if the budget shrank during compilation.
      return { groups: [...groups.values()], rejected, shared: this.stats(), sharedCodeHits: this.hits - hitsBefore, crossHartCodeHits: this.crossHartHits - crossHartBefore, tailCalls };
    });
    this.pending = work.then(() => {}, () => {});
    return work;
  }
  trim() {
    const work = this.pending.then(() => this.room(0, new Set()));
    this.pending = work.then(() => {}, () => {}); return work;
  }
}
