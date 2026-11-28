import { sha256 } from './snapshot';
import { zstdDecompress } from './zstd';
/** Published node assets (tools/kube-wasm/publish-node.mjs) are content
 * addressed: `<sha256 of the decoded bytes>.<encoding>`. The page decodes
 * them itself and Cache Storage keeps the encoded bytes. The extension is
 * not `.gz`: static servers such as Vite's (sirv) send `.gz` files with
 * Content-Encoding: gzip, and the browser would decode them first. */
export type Encoding = 'gzip' | 'zstd';
export const ENCODINGS: readonly Encoding[] = ['gzip', 'zstd'];
const EXTENSION: Record<Encoding, string> = { gzip: 'gzip', zstd: 'zstd' };
export const OBJECT_CACHE = 'dt-rv64-objects-v1';
export interface ObjectRef { sha256: string; bytes: number }
export function objectName(sha: string, encoding?: Encoding) {
  return encoding ? `${sha}.${EXTENSION[encoding]}` : `${sha}.bin`;
}
export function isEncoding(value: unknown): value is Encoding {
  return ENCODINGS.includes(value as Encoding);
}
/** Decodes into a buffer of the expected size, never past it. gzip goes
 * through the browser's DecompressionStream, zstd through ./zstd.ts. */
export async function decode(data: Uint8Array, encoding: Encoding, bytes: number): Promise<Uint8Array> {
  const out = new Uint8Array(bytes);
  if (encoding === 'zstd') {
    if (zstdDecompress(data, out) !== bytes) throw Error('Truncated object');
    return out;
  }
  const reader = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream(encoding)).getReader();
  let count = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (count + value.length > bytes) { await reader.cancel(); throw Error('Oversized object'); }
    out.set(value, count); count += value.length;
  }
  if (count !== bytes) throw Error('Truncated object');
  return out;
}
async function decodeVerified(encoded: Uint8Array, ref: ObjectRef, encoding?: Encoding) {
  const data = encoding ? await decode(encoded, encoding, ref.bytes) : encoded;
  if (data.length !== ref.bytes || await sha256(data) !== ref.sha256) throw Error(`object ${ref.sha256} checksum mismatch`);
  return data;
}
/** Fetches and verifies one object. With `cache` it is read from Cache
 * Storage when present and stored there after a verified download; the
 * name is the content, so a cached entry never goes stale. */
export async function fetchObject(base: string | URL, ref: ObjectRef, o: { encoding?: Encoding; cache?: boolean } = {}): Promise<Uint8Array> {
  const url = new URL(objectName(ref.sha256, o.encoding), base);
  const key = url.href;
  const cache = o.cache && typeof caches !== 'undefined' ? await caches.open(OBJECT_CACHE).catch(() => undefined) : undefined;
  const hit = await cache?.match(key).catch(() => undefined);
  if (hit) {
    try { return await decodeVerified(new Uint8Array(await hit.arrayBuffer()), ref, o.encoding); }
    catch { await cache?.delete(key).catch(() => undefined); }
  }
  // Kept in Cache Storage: a copy in the HTTP cache too would double the
  // space the node takes on the student's disk.
  const response = await fetch(url, cache ? { cache: 'no-store' } : undefined);
  if (!response.ok) throw Error(`object ${ref.sha256}: HTTP ${response.status}`);
  const encoded = new Uint8Array(await response.arrayBuffer());
  const data = await decodeVerified(encoded, ref, o.encoding);
  await cache?.put(key, new Response(encoded as Uint8Array<ArrayBuffer>)).catch(() => undefined);
  return data;
}
