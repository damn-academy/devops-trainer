import type { HTTPDisk } from './block';
import type { TermRecord } from '../../core/types';
/** Portable CPU/device checkpoint. Host network peers are intentionally external. */
export interface RV64Snapshot {
  format: 'dt.rv64.snapshot/v1'; state: Uint8Array; pending: Uint8Array;
  rings: Uint8Array[]; history: TermRecord[]; lastExit: number; diskIdentity: string;
  capturedAt?: number;
}
interface Chunk { url: string; sha256: string; bytes: number; rawBytes: number }
export interface SnapshotManifest {
  format: 'dt.rv64.snapshot.gzip/v1'; wasmSha256: string; memoryMB: number;
  capturedAt: number; diskIdentity: string; history: TermRecord[]; lastExit: number;
  lengths: number[]; chunks: Chunk[];
}
const CHUNK = 4 * 1024 * 1024;
const LIMIT = 1536 * 1024 * 1024;
export async function sha256(bytes: Uint8Array): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>)), b => b.toString(16).padStart(2, '0')).join('');
}
/** Independently compressed chunks bound compression working memory. RAM zero
 * pages are already omitted by the Rust serializer. This format is EAGER: it
 * does not claim to implement guest page faults or demand paging. */
export async function saveSnapshot(snapshot: RV64Snapshot, memoryMB: number, wasmSha256: string,
  write: (name: string, data: Uint8Array) => Promise<void>): Promise<SnapshotManifest> {
  const parts = [snapshot.state, snapshot.pending, ...snapshot.rings];
  const manifest: SnapshotManifest = { format: 'dt.rv64.snapshot.gzip/v1', wasmSha256, memoryMB,
    capturedAt: snapshot.capturedAt ?? Date.now(), diskIdentity: snapshot.diskIdentity,
    history: snapshot.history, lastExit: snapshot.lastExit, lengths: parts.map(p => p.length), chunks: [] };
  for (const part of parts) for (let at = 0; at < part.length; at += CHUNK) {
    const raw = part.subarray(at, at + CHUNK);
    const data = new Uint8Array(await new Response(new Blob([raw as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    const digest = await sha256(data), name = `${digest}.bin`;
    await write(name, data);
    manifest.chunks.push({ url: name, sha256: digest, bytes: data.length, rawBytes: raw.length });
  }
  await write('manifest.json', new TextEncoder().encode(JSON.stringify(manifest)));
  return manifest;
}
export function validateManifest(m: SnapshotManifest, memoryMB: number, wasmSha256: string): void {
  if (m?.format !== 'dt.rv64.snapshot.gzip/v1' || m.memoryMB !== memoryMB || m.wasmSha256 !== wasmSha256
    || !Number.isSafeInteger(m.capturedAt) || m.capturedAt <= 0 || m.capturedAt > Date.now() + 60000
    || typeof m.diskIdentity !== 'string' || !Array.isArray(m.history) || !Number.isInteger(m.lastExit)
    || !Array.isArray(m.lengths) || m.lengths.length !== 6 || !m.lengths[0]
    || m.lengths.some(n => !Number.isSafeInteger(n) || n < 0 || n > LIMIT)
    || m.lengths.reduce((a, b) => a + b, 0) > LIMIT || !Array.isArray(m.chunks)) throw new Error('Invalid/incompatible RV64 snapshot manifest');
  const expected = m.lengths.flatMap(n => Array.from({ length: Math.ceil(n / CHUNK) }, (_, i) => Math.min(CHUNK, n - i * CHUNK)));
  if (m.chunks.length !== expected.length || m.chunks.some((c, i) => !c || !/^[a-f0-9]{64}$/.test(c.sha256)
    || c.url !== `${c.sha256}.bin` || !Number.isSafeInteger(c.bytes) || c.bytes <= 0 || c.bytes > CHUNK + 65536
    || c.rawBytes !== expected[i])) throw new Error('Invalid RV64 snapshot chunk table');
}
export async function loadSnapshot(url: string, memoryMB: number, wasmSha256: string, embedded?: SnapshotManifest): Promise<RV64Snapshot> {
  let manifest = embedded;
  if (!manifest) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Snapshot manifest: HTTP ${response.status}`);
    manifest = await response.json() as SnapshotManifest;
  }
  validateManifest(manifest, memoryMB, wasmSha256);
  const cache = typeof caches === 'undefined' ? undefined : await caches.open('dt-rv64-snapshot-v1').catch(() => undefined);
  const parts = manifest.lengths.map(n => new Uint8Array(n));
  let part = 0, offset = 0;
  for (const chunk of manifest.chunks) {
    while (offset === parts[part].length) { part++; offset = 0; }
    const key = new URL(chunk.url, new URL(url, location.href)).href;
    let compressed: Uint8Array | undefined;
    const cached = await cache?.match(key);
    if (cached) {
      const bytes = new Uint8Array(await cached.arrayBuffer());
      if (bytes.length === chunk.bytes && await sha256(bytes) === chunk.sha256) compressed = bytes;
      else await cache?.delete(key);
    }
    if (!compressed) {
      const fetched = await fetch(key);
      if (!fetched.ok) throw new Error(`Snapshot chunk: HTTP ${fetched.status}`);
      compressed = new Uint8Array(await fetched.arrayBuffer());
      if (compressed.length !== chunk.bytes || await sha256(compressed) !== chunk.sha256) throw new Error('Snapshot chunk checksum mismatch');
      await cache?.put(key, new Response(compressed as Uint8Array<ArrayBuffer>)).catch(() => undefined);
    }
    const reader = new Blob([compressed as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
    let written = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (written + value.length > chunk.rawBytes) { await reader.cancel(); throw new Error('Oversized snapshot chunk'); }
      parts[part].set(value, offset + written); written += value.length;
    }
    if (written !== chunk.rawBytes) throw new Error('Truncated snapshot chunk');
    offset += written;
  }
  return { format: 'dt.rv64.snapshot/v1', state: parts[0], pending: parts[1], rings: parts.slice(2),
    capturedAt: manifest.capturedAt, diskIdentity: manifest.diskIdentity, history: manifest.history, lastExit: manifest.lastExit };
}

/** Identity belongs to immutable content, not its build-time loopback URL. */
export function diskIdentity(image?: HTTPDisk): string {
  return JSON.stringify(image ? { bytes: image.bytes, version: image.version } : null);
}
export function sameDiskIdentity(saved: string, expected: string): boolean {
  const normalize = (text: string): string => {
    const value = JSON.parse(text);
    if (value === null) return 'null';
    if (!Number.isSafeInteger(value?.bytes) || value.bytes <= 0 || value.bytes % 512 || typeof value.version !== 'string' || !value.version) throw new Error('Invalid disk identity');
    return diskIdentity(value);
  };
  try { return normalize(saved) === normalize(expected); } catch { return false; }
}
