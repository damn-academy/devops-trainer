import { fetchObject, isEncoding, type Encoding } from './objects';
/** Immutable HTTP base image + per-machine writes in Rust. Cache keys include
 * the caller's immutable image version; writable overlays never enter Cache Storage. */
export interface HTTPDisk {
  url: string; bytes: number; version: string;
  /** A published image (tools/kube-wasm/publish-node.mjs): chunk i is the
   * object `<chunks[i]>.<encoding>` (the SHA-256 of its CHUNK_BYTES decoded
   * bytes) in the directory `url`, read whole instead of by byte range. */
  chunks?: string[]; encoding?: Encoding;
  /** Bytes laid over the image after it is read, e.g. a join ticket the page
   * writes into a placeholder file of the boot medium. Never cached. */
  overlay?: { offset: number; data: Uint8Array }[];
  /** Skip Cache Storage: read every chunk over HTTP. */
  noCache?: boolean;
}
export const CHUNK_BYTES = 256 * 1024;
export class HTTPBlockDevice {
  constructor(readonly image: HTTPDisk) {
    if (!Number.isSafeInteger(image.bytes) || image.bytes <= 0 || image.bytes % 512 || !image.version) throw new Error('Invalid HTTP disk geometry/version');
    if (image.chunks && (image.chunks.length !== Math.ceil(image.bytes / CHUNK_BYTES) || image.chunks.some(c => !/^[a-f0-9]{64}$/.test(c)) ||
      (image.encoding !== undefined && !isEncoding(image.encoding)))) throw new Error('Invalid HTTP disk chunk index');
  }
  async chunk(index: number): Promise<Uint8Array> {
    const bytes = await this.base(index);
    const start = index * CHUNK_BYTES;
    for (const { offset, data } of this.image.overlay ?? []) {
      const from = Math.max(offset, start), to = Math.min(offset + data.length, start + bytes.length);
      if (from < to) bytes.set(data.subarray(from - offset, to - offset), from - start);
    }
    return bytes;
  }
  private async base(index: number): Promise<Uint8Array> {
    const start = index * CHUNK_BYTES, end = Math.min(start + CHUNK_BYTES, this.image.bytes) - 1;
    if (!Number.isSafeInteger(index) || index < 0 || start >= this.image.bytes) throw new Error('Invalid disk chunk');
    const url = new URL(this.image.url, self.location.href);
    if (this.image.chunks) return fetchObject(url, { sha256: this.image.chunks[index]!, bytes: end - start + 1 }, { encoding: this.image.encoding, cache: !this.image.noCache });
    const key = new URL(url);
    key.searchParams.set('dt-rv64-version', this.image.version);
    key.searchParams.set('dt-rv64-chunk', String(index));
    const cache = typeof caches !== 'undefined' && !this.image.noCache ? await caches.open('dt-rv64-block-v1').catch(() => undefined) : undefined;
    const cached = await cache?.match(key.href);
    if (cached) {
      const bytes = new Uint8Array(await cached.arrayBuffer());
      if (bytes.length === end - start + 1) return bytes;
      await cache?.delete(key.href);
    }
    const response = await fetch(url, { headers: { Range: `bytes=${start}-${end}` } });
    if (response.status !== 206 || response.headers.get('Content-Range') !== `bytes ${start}-${end}/${this.image.bytes}`) throw new Error('HTTP disk requires exact byte-range responses');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length !== end - start + 1) throw new Error('Truncated HTTP disk chunk');
    // Cache Storage does not accept 206 responses; store a complete chunk as 200.
    await cache?.put(key.href, new Response(bytes)).catch(() => undefined);
    return bytes;
  }
}
