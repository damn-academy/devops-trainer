import { RAM_CHUNK, validatePaged, type PagedManifest } from './paged-snapshot';
import { loadSnapshot, type RV64Snapshot } from './snapshot';
export class SnapshotPager {
  private loader: Worker;
  private mailbox = new SharedArrayBuffer(16 + RAM_CHUNK);
  private words = new Int32Array(this.mailbox, 0, 4);
  private buffer = new Uint8Array(this.mailbox, 16);
  private trace: { index: number; startMs: number; durationMs: number }[] = [];
  drainTrace() { return this.trace.splice(0); }
  faults = 0;
  faultMs = 0;
  constructor(private manifest: PagedManifest, private url: string) {
    this.loader = new Worker(new URL('./snapshot-loader.worker.ts', import.meta.url), { type: 'module' });
  }
  async start(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      // A hot pack is one large transfer, unlike a single 256-KiB demand fault.
      const timer = setTimeout(() => reject(new Error('Snapshot loader startup timeout')), this.manifest.hot ? 120000 : 30000);
      this.loader.onerror = event => { clearTimeout(timer); reject(new Error(event.message)); };
      this.loader.onmessage = ({ data }) => {
        if (data.error) { clearTimeout(timer); reject(new Error(data.error)); }
        if (data.ready) { clearTimeout(timer); resolve(); }
      };
      this.loader.postMessage({ manifest: this.manifest, url: this.url, mailbox: this.mailbox });
    });
    Object.assign(globalThis, { rv64SnapshotPage: (index: number, page: Uint8Array) => {
      if (!Number.isInteger(index) || !this.manifest.ram[index] || page.length !== RAM_CHUNK) throw new Error('Invalid snapshot page fault');
      const start = performance.now();
      Atomics.store(this.words, 0, 0);
      this.loader.postMessage(index);
      const deadline = start + 30000;
      while (Atomics.load(this.words, 0) === 0) {
        const remaining = deadline - performance.now();
        if (remaining <= 0) throw new Error(`Snapshot page ${index} timed out`);
        Atomics.wait(this.words, 0, 0, remaining);
      }
      if (Atomics.load(this.words, 0) !== 1) throw new Error(`Snapshot page ${index} could not be loaded`);
      page.set(this.buffer);
      const durationMs = performance.now() - start;
      this.trace.push({ index, startMs: start, durationMs });
      this.faults++; this.faultMs += durationMs;
    } });
  }
  dispose(): void { this.loader.terminate(); }
  static async open(url: string, memoryMB: number, wasmSha256: string): Promise<{ pager: SnapshotPager; state: RV64Snapshot; present: Uint8Array }> {
    url = new URL(url, location.href).href;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Snapshot index: HTTP ${response.status}`);
    const manifest: PagedManifest = await response.json();
    validatePaged(manifest, memoryMB, wasmSha256);
    // Use the index's pinned metadata rather than refetching a mutable second
    // manifest: all member names/checksums belong to this exact checkpoint.
    const state = await loadSnapshot(url, memoryMB, wasmSha256, manifest.machine);
    const pager = new SnapshotPager(manifest, url);
    try { await pager.start(); }
    catch (error) { pager.dispose(); throw error; }
    return { pager, state, present: Uint8Array.from(manifest.ram, chunk => chunk ? 1 : 0) };
  }
}
