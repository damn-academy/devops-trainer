import { sha256, saveSnapshot, validateManifest, type RV64Snapshot, type SnapshotManifest } from './snapshot';
export const RAM_CHUNK = 256 * 1024;
export interface RAMChunk { sha256: string; bytes: number; pages: number[] }
export interface PagedManifest {
  format: 'dt.rv64.paged/v1'; hot?: { sha256: string; bytes: number; indices: number[] }; validFrom?: number; validUntil?: number; machine: SnapshotManifest; ram: (RAMChunk | null)[];
}
export function validatePaged(m: PagedManifest, memoryMB: number, wasmSha256: string): void {
  if (m?.format !== 'dt.rv64.paged/v1') throw new Error('Unsupported paged snapshot');
  validateManifest(m.machine, memoryMB, wasmSha256);
  if ((m.validFrom !== undefined && (!Number.isSafeInteger(m.validFrom) || Date.now() < m.validFrom))
    || (m.validUntil !== undefined && (!Number.isSafeInteger(m.validUntil) || Date.now() >= m.validUntil))) throw new Error('Snapshot certificate validity window does not cover restore');
  if (!Array.isArray(m.ram) || m.ram.length !== memoryMB * 4 || m.ram.some(c => c !== null &&
    (!c || !/^[a-f0-9]{64}$/.test(c.sha256) || !Number.isSafeInteger(c.bytes) || c.bytes <= 0 || c.bytes > RAM_CHUNK + 65536
      || !Array.isArray(c.pages) || c.pages.length === 0 || c.pages.length > 64
      || c.pages.some((p, i) => !Number.isInteger(p) || p < 0 || p >= 64 || (i > 0 && p <= c.pages[i - 1]))))) throw new Error('Invalid paged RAM index');
  if (m.hot && (!/^[a-f0-9]{64}$/.test(m.hot.sha256) || !Number.isSafeInteger(m.hot.bytes) || m.hot.bytes <= 0
    || !Array.isArray(m.hot.indices) || !m.hot.indices.length || new Set(m.hot.indices).size !== m.hot.indices.length
    || m.hot.indices.some(i => !Number.isInteger(i) || !m.ram?.[i])
    || m.hot.indices.reduce((sum, i) => sum + m.ram[i]!.bytes, 0) !== m.hot.bytes)) throw new Error('Invalid snapshot hot set');
}
export async function savePagedSnapshot(snapshot: RV64Snapshot, memoryMB: number, wasmSha256: string,
  ram: (index: number) => Uint8Array, write: (name: string, data: Uint8Array) => Promise<void>, publish = true): Promise<PagedManifest> {
  const machine = await saveSnapshot(snapshot, memoryMB, wasmSha256, write);
  const manifest: PagedManifest = { format: 'dt.rv64.paged/v1', machine, ram: [] };
  for (let index = 0; index < memoryMB * 4; index++) {
    const block = ram(index), pages: number[] = [];
    if (block.length !== RAM_CHUNK) throw new Error('Invalid RAM export');
    for (let p = 0; p < 64; p++) if (block.subarray(p * 4096, (p + 1) * 4096).some(b => b !== 0)) pages.push(p);
    if (!pages.length) { manifest.ram.push(null); continue; }
    const packed = new Uint8Array(pages.length * 4096);
    pages.forEach((p, i) => packed.set(block.subarray(p * 4096, (p + 1) * 4096), i * 4096));
    const compressed = new Uint8Array(await new Response(new Blob([packed]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    const digest = await sha256(compressed);
    await write(`${digest}.bin`, compressed);
    manifest.ram.push({ sha256: digest, bytes: compressed.length, pages });
  }
  if (publish) await write('paged.json', new TextEncoder().encode(JSON.stringify(manifest)));
  return manifest;
}
/** One range fetch per group of at most 64 pages. Zero pages have no payload.
 * A separate loader Worker runs this while the hart blocks in Atomics.wait;
 * there is no async unwind, guest trap, or replay of a partially executed DMA. */
export async function loadRAMChunk(base: string, chunk: RAMChunk, prefetched?: Uint8Array): Promise<Uint8Array> {
  const url = new URL(`${chunk.sha256}.bin`, base).href;
  const cache = prefetched || typeof caches === 'undefined' ? undefined : await caches.open('dt-rv64-snapshot-v1').catch(() => undefined);
  let bytes: Uint8Array | undefined = prefetched;
  if (bytes && (bytes.length !== chunk.bytes || await sha256(bytes) !== chunk.sha256)) throw new Error('Snapshot prefetched RAM checksum mismatch');
  const cached = !bytes ? await cache?.match(url) : undefined;
  if (cached) {
    const value = new Uint8Array(await cached.arrayBuffer());
    if (value.length === chunk.bytes && await sha256(value) === chunk.sha256) bytes = value;
    else await cache?.delete(url);
  }
  if (!bytes) {
    const response = await fetch(url, { headers: { Range: `bytes=0-${chunk.bytes - 1}` } });
    if (response.status !== 206 || response.headers.get('Content-Range') !== `bytes 0-${chunk.bytes - 1}/${chunk.bytes}`) throw new Error('Snapshot RAM requires exact Range responses');
    bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length !== chunk.bytes || await sha256(bytes) !== chunk.sha256) throw new Error('Snapshot RAM checksum mismatch');
    await cache?.put(url, new Response(bytes as Uint8Array<ArrayBuffer>)).catch(() => undefined);
  }
  const packed = new Uint8Array(chunk.pages.length * 4096);
  const reader = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  let count = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (count + value.length > packed.length) { await reader.cancel(); throw new Error('Oversized snapshot RAM'); }
    packed.set(value, count); count += value.length;
  }
  if (count !== packed.length) throw new Error('Truncated snapshot RAM');
  const result = new Uint8Array(RAM_CHUNK);
  chunk.pages.forEach((p, i) => result.set(packed.subarray(i * 4096, (i + 1) * 4096), p * 4096));
  return result;
}

/** Fetch the recorded working set once; member hashes remain independently checked. */
export async function prefetchRAM(base: string, manifest: PagedManifest): Promise<Map<number, Uint8Array>> {
  const result = new Map<number, Uint8Array>();
  const hot = manifest.hot;
  if (!hot) return result;
  const response = await fetch(new URL(`${hot.sha256}.bin`, base).href, { headers: { Range: `bytes=0-${hot.bytes - 1}` } });
  if (response.status !== 206 || response.headers.get('Content-Range') !== `bytes 0-${hot.bytes - 1}/${hot.bytes}`) throw new Error('Snapshot hot set requires exact Range responses');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length !== hot.bytes || await sha256(bytes) !== hot.sha256) throw new Error('Snapshot hot set checksum mismatch');
  let offset = 0;
  for (const index of hot.indices) {
    const length = manifest.ram[index]!.bytes;
    result.set(index, bytes.subarray(offset, offset + length)); offset += length;
  }
  return result;
}
