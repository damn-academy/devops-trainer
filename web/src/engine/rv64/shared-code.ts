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
  serial: number; lease: number; module: WebAssembly.Module; byteLength: number; functions: number;
  blocks: { id: number; exportId: number; count: number }[];
}
interface Entry {
  serial: number; creator: number; module: WebAssembly.Module; bytes: number; keys: string[];
  blocks: { id: number }[]; bodyBytes: number[]; holders: Map<number, number>; used: number; pins: number; revoked: boolean; releases: (() => void)[];
}
/** Machine-wide deduplication, reserved concurrent jobs and acknowledged batch eviction. */
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
  private jobs = new Map<string, Promise<void>>();
  private epochs = new Map<number, number>();
  private lease = 0;
  private trimming?: Promise<void>;
  private revokedBytes = 0;
  private revokeBatches = 0;
  private revokeTotalMs = 0;
  private revokeMaxMs = 0;
  private admissionWaits = 0;
  private admissionTotalMs = 0;
  private admissionMaxMs = 0;
  private compileJobs = 0;
  private compileTotalMs = 0;
  private compileMaxMs = 0;
  private compileBusy = 0;
  budget = 0;
  hits = 0;
  crossHartHits = 0;
  compiled = 0;
  constructor(private revoke: (client: number, serials: number[]) => Promise<void>,
    private compile: (bytes: Uint8Array<ArrayBuffer>) => Promise<WebAssembly.Module> = bytes => WebAssembly.compile(bytes)) {}
  stats() {
    const encodedBytes = this.encodedBytes, instanceBytes = this.instanceBytes, blocks = this.blockCount;
    const bodyByteHistogram = this.buckets.map((upper, i) => ({ upper: Number.isFinite(upper) ? upper : null, count: this.histogram[i]! }));
    return { revokeBatches: this.revokeBatches, revokedBytes: this.revokedBytes,
      revokeRoundTripMeanMs: this.revokeBatches ? this.revokeTotalMs / this.revokeBatches : 0, revokeRoundTripMaxMs: this.revokeMaxMs,
      admissionWaits: this.admissionWaits, admissionWaitMeanMs: this.admissionWaits ? this.admissionTotalMs / this.admissionWaits : 0, admissionWaitMaxMs: this.admissionMaxMs,
      compilePoolBusy: this.compileBusy, compileJobs: this.compileJobs,
      compileJobMeanMs: this.compileJobs ? this.compileTotalMs / this.compileJobs : 0, compileJobMaxMs: this.compileMaxMs,
      compilingBytes: this.compilingBytes, modules: this.entries.size, blocks, encodedBytes,
      encodedBytesPerBlock: blocks ? encodedBytes / blocks : 0,
      chargedBytesPerBlock: blocks ? (jitCharge(encodedBytes, this.entries.size) + instanceBytes) / blocks : 0,
      bodyByteHistogram,
      codeBytes: jitCharge(encodedBytes, this.entries.size), instanceBytes,
      estimatedHostBytes: jitCharge(encodedBytes, this.entries.size) + instanceBytes + this.compilingBytes,
      budget: this.budget, sharedCodeHits: this.hits, crossHartCodeHits: this.crossHartHits, compiledBlocks: this.compiled };
  }
  release(client: number, serial?: number, lease?: number) {
    for (const e of this.entries.values()) if ((serial === undefined || e.serial === serial) &&
      (lease === undefined || e.holders.get(client) === lease) && e.holders.has(client)) {
      if (e.pins && serial !== undefined) {
        const expected = lease ?? e.holders.get(client);
        e.releases.push(() => this.release(client, e.serial, expected));
        continue;
      }
      e.holders.delete(client);
      const charge = instanceCharge(e.blocks.length);
      this.instanceBytes -= charge;
      if (e.revoked) this.revokedBytes -= charge;
    }
  }
  reset(client: number) {
    this.epochs.set(client, (this.epochs.get(client) ?? 0) + 1);
    this.release(client);
  }
  touch(client: number, serials: number[]) {
    for (const serial of serials) { const e = this.entries.get(serial); if (e?.holders.has(client)) e.used = ++this.clock; }
  }
  private startTrim(extra = 0, proactive = false) {
    if (this.trimming) return this.trimming;
    if (this.stats().estimatedHostBytes + extra <= this.budget * (proactive ? .85 : 1)) return;
    let remaining = this.stats().estimatedHostBytes + extra;
    const victims: Entry[] = [], clients = new Map<number, number[]>();
    for (const e of [...this.entries.values()].sort((a,b) => a.used - b.used)) {
      if (e.pins || e.revoked) continue;
      e.revoked = true; victims.push(e);
      for (const key of e.keys) this.index.delete(key);
      const charge = jitCharge(e.bytes, 1) + instanceCharge(e.blocks.length) * e.holders.size;
      this.revokedBytes += charge; remaining -= charge;
      for (const client of e.holders.keys()) {
        const serials = clients.get(client) ?? []; serials.push(e.serial); clients.set(client, serials);
      }
      if (remaining <= this.budget * .75) break;
    }
    if (!victims.length) return;
    const start = performance.now(); this.revokeBatches++;
    this.trimming = Promise.all([...clients].map(([client, serials]) => this.revoke(client, serials))).then(() => {
      for (const e of victims) {
        const charge = jitCharge(e.bytes, 1) + instanceCharge(e.blocks.length) * e.holders.size;
        this.revokedBytes -= charge;
        this.entries.delete(e.serial); this.encodedBytes -= e.bytes; this.blockCount -= e.blocks.length;
        this.instanceBytes -= instanceCharge(e.blocks.length) * e.holders.size;
        for (const n of e.bodyBytes) this.histogram[this.buckets.findIndex(upper => n <= upper)]!--;
      }
      const ms = performance.now() - start; this.revokeTotalMs += ms; this.revokeMaxMs = Math.max(this.revokeMaxMs, ms);
    }).finally(() => { this.trimming = undefined; });
    return this.trimming;
  }
  private async reserve(charge: number) {
    if (charge > this.budget) return false;
    // Revoked code remains part of estimatedHostBytes until every ACK.
    // Concurrent reservations are committed synchronously before yielding.
    if (this.stats().estimatedHostBytes + charge > this.budget) {
      if (!this.trimming && [...this.entries.values()].some(e => e.pins)) await new Promise(resolve => setTimeout(resolve, 0));
      const batch = this.startTrim(charge);
      if (batch) {
        const start = performance.now(); this.admissionWaits++;
        await batch;
        const ms = performance.now() - start; this.admissionTotalMs += ms; this.admissionMaxMs = Math.max(this.admissionMaxMs, ms);
      }
    }
    if (this.stats().estimatedHostBytes + charge > this.budget) return false;
    this.compilingBytes += charge;
    return true;
  }
  async request(client: number, blocks: SharedBlock[], layout: SharedJitLayout, tailCalls: boolean) {
    const epoch = this.epochs.get(client) ?? 0;
    const keys = blocks.map(b => `${Number(tailCalls)}/${codeKey(b, layout)}`);
    const pinned = new Set<Entry>();
    const pin = (e: Entry) => { if (!pinned.has(e)) { pinned.add(e); e.pins++; } };
    const missing = new Map<string, SharedBlock>();
    const waits = new Set<Promise<void>>();
    for (let i = 0; i < blocks.length; i++) {
      const key = keys[i]!, hit = this.index.get(key);
      if (hit) pin(hit.entry);
      else if (this.jobs.has(key)) waits.add(this.jobs.get(key)!);
      else missing.set(key, blocks[i]!);
    }
    if (missing.size) {
      // Register every key before the asynchronous admission/compile begins.
      const job = Promise.resolve().then(async () => {
        const canonical = [...missing.values()].map((b, id) => ({ ...b, id }));
        const metrics = { bodyBytes: [] as number[] };
        const bytes = compileBatch(canonical, tailCalls, layout, metrics);
        const byteLength = bytes.byteLength; // pool transfers and detaches the buffer
        const charge = jitCharge(byteLength, 1);
        if (!await this.reserve(charge)) return;
        let module: WebAssembly.Module;
        const start = performance.now(); this.compileBusy++;
        try { module = await this.compile(bytes); }
        finally {
          this.compilingBytes -= charge; this.compileBusy--; this.compileJobs++;
          const ms = performance.now() - start; this.compileTotalMs += ms; this.compileMaxMs = Math.max(this.compileMaxMs, ms);
        }
        if (this.stats().estimatedHostBytes + charge > this.budget) return;
        const e: Entry = { serial: ++this.serial, creator: client, module, bytes: byteLength,
          keys: [...missing.keys()], blocks: canonical.map(b => ({ id: b.id })), bodyBytes: metrics.bodyBytes,
          holders: new Map(), used: ++this.clock, pins: 0, revoked: false, releases: [] };
        pin(e);
        this.encodedBytes += e.bytes; this.blockCount += e.blocks.length;
        for (const n of e.bodyBytes) this.histogram[this.buckets.findIndex(upper => n <= upper)]!++;
        this.entries.set(e.serial, e); e.keys.forEach((key, offset) => this.index.set(key, { entry: e, offset }));
        this.compiled += canonical.length;
      }).finally(() => { for (const key of missing.keys()) this.jobs.delete(key); });
      for (const key of missing.keys()) this.jobs.set(key, job);
      waits.add(job);
    }
    const groups = new Map<number, CodeGroup>(), rejected: number[] = [];
    let hits = 0, cross = 0;
    try {
      await Promise.all(waits);
      if ((this.epochs.get(client) ?? 0) !== epoch) return { groups: [], rejected: blocks.map(b => b.id), shared: this.stats(), sharedCodeHits: 0, crossHartCodeHits: 0, tailCalls };
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i]!, hit = this.index.get(keys[i]!);
        if (!hit) { rejected.push(b.id); continue; }
        const e = hit.entry; pin(e);
        if (!e.holders.has(client)) {
          const charge = instanceCharge(e.blocks.length);
          if (!await this.reserve(charge)) { rejected.push(b.id); continue; }
          this.compilingBytes -= charge;
          if ((this.epochs.get(client) ?? 0) !== epoch) { rejected.push(b.id); continue; }
          // Another request for this hart may have acquired it while we waited.
          if (!e.holders.has(client)) this.instanceBytes += charge;
        }
        let group = groups.get(e.serial);
        if (!group) {
          const lease = ++this.lease; e.holders.set(client, lease);
          group = { serial: e.serial, lease, module: e.module, byteLength: e.bytes, functions: e.blocks.length, blocks: [] }; groups.set(e.serial, group);
        }
        e.used = ++this.clock;
        if (!missing.has(keys[i]!)) { hits++; if (e.creator !== client) cross++; }
        group.blocks.push({ id: b.id, exportId: e.blocks[hit.offset]!.id, count: b.words.length / 2 });
      }
      if ((this.epochs.get(client) ?? 0) !== epoch) return { groups: [], rejected: blocks.map(b => b.id), shared: this.stats(), sharedCodeHits: 0, crossHartCodeHits: 0, tailCalls };
      for (const group of groups.values()) {
        group.lease = ++this.lease; this.entries.get(group.serial)!.holders.set(client, group.lease);
      }
      this.hits += hits; this.crossHartHits += cross;
      return { groups: [...groups.values()], rejected, shared: this.stats(), sharedCodeHits: hits, crossHartCodeHits: cross, tailCalls };
    } finally {
      // Keep replies ahead of revokes on each MessagePort, including waiters
      // on a deduplicated job. Broker posts the reply in this microtask turn.
      setTimeout(() => {
        for (const e of pinned) {
          e.pins--;
          if (!e.pins) for (const release of e.releases.splice(0)) release();
        }
        void this.startTrim(0, true);
      }, 0);
    }
  }
  async trim() {
    await new Promise(resolve => setTimeout(resolve, 0));
    await this.startTrim();
  }
}
