import { sha256 } from './snapshot';
import type { HTTPDisk } from './block';
import { fetchObject, isEncoding, type Encoding, type ObjectRef } from './objects';
import type { ObjectPool } from './object-pool';
export type { ObjectRef } from './objects';
export interface SMPCheckpoint {
  format: 'dt.rv64.smp/v1'; harts: number; bytes: number; wasmSha256: string;
  disk: HTTPDisk; capturedAt: number; ticks: number; marker: string;
  cpus: ObjectRef[]; device: ObjectRef; control: ObjectRef; mail: ObjectRef;
  ram: { offset: number; object: ObjectRef }[];
  /** Published checkpoints (tools/kube-wasm/publish-node.mjs): every object
   * is stored encoded, as `<sha256>.gzip`, in `objects` (relative to smp.json). */
  encoding?: Encoding; objects?: string;
}
/** Where a checkpoint's objects are and how they are stored; `pool` reads
 * them in workers (object-pool.ts) instead of on the calling thread. */
export interface ObjectStore { base: string; encoding?: Encoding; pool?: ObjectPool }
export function checkpointStore(m: SMPCheckpoint, smpUrl: string): ObjectStore {
  return { base: new URL(m.objects ?? '', smpUrl).href, encoding: m.encoding };
}
export async function storeObject(data: Uint8Array, write: (name: string, data: Uint8Array) => Promise<void>): Promise<ObjectRef> {
  const ref = { sha256: await sha256(data), bytes: data.length };
  await write(`${ref.sha256}.bin`, data); return ref;
}
export function validateCheckpoint(m: SMPCheckpoint, harts: number, bytes: number, wasm: string, disk: HTTPDisk) {
  if (m.format !== 'dt.rv64.smp/v1' || m.harts !== harts || m.bytes !== bytes || m.wasmSha256 !== wasm ||
    m.disk.version !== disk.version || m.disk.bytes !== disk.bytes || m.cpus.length !== harts ||
    !Number.isFinite(m.capturedAt) || !Number.isSafeInteger(m.ticks) || m.ticks < 0 ||
    m.marker !== 'RV64_NODE_REGISTERED_READY') throw Error('SMP checkpoint machine/provenance mismatch');
  let end = 0;
  for (const chunk of m.ram) {
    if (!Number.isSafeInteger(chunk.offset) || chunk.offset < end || chunk.offset % 1048576 ||
      chunk.object.bytes !== Math.min(1048576, bytes - chunk.offset)) throw Error('Invalid SMP RAM layout');
    end = chunk.offset + chunk.object.bytes;
    if (end > bytes) throw Error('SMP RAM exceeds memory');
  }
  for (const ref of [...m.cpus, m.device, m.control, m.mail, ...m.ram.map(c => c.object)]) {
    if (!/^[a-f0-9]{64}$/.test(ref.sha256) || !Number.isSafeInteger(ref.bytes) || ref.bytes <= 0 || ref.bytes > 128 * 1048576) throw Error('Invalid SMP object');
  }
  if (m.control.bytes !== harts * 64 || m.mail.bytes !== harts * 32) throw Error('Invalid SMP host state');
  if ((m.encoding !== undefined && !isEncoding(m.encoding)) ||
    (m.objects !== undefined && (typeof m.objects !== 'string' || /^[a-z]+:|^\/\//i.test(m.objects)))) throw Error('Invalid SMP object store');
}
/** Reads one object; `base` is a URL in the store's directory, or a store.
 * Encoded (published) objects are kept in Cache Storage for the next visit. */
export async function readObject(base: string | ObjectStore, ref: ObjectRef): Promise<Uint8Array> {
  const store: ObjectStore = typeof base === 'string' ? { base } : base;
  const o = { encoding: store.encoding, cache: !!store.encoding };
  return store.pool ? store.pool.read(store.base, ref, o) : fetchObject(store.base, ref, o);
}
const PAGE = 4096;
/** Guest memory starts zeroed: writing a zero page would only make the host
 * commit it. A 1 MiB chunk is nonzero if any byte is, and a captured guest's
 * free pages are scattered, so a third of a chunk's pages are often zero. */
function writeNonzeroPages(view: Uint8Array, data: Uint8Array, offset: number) {
  const words = new Uint32Array(data.buffer, data.byteOffset, data.byteLength >> 2);
  for (let page = 0; page < data.length; page += PAGE) {
    const end = Math.min(page + PAGE, data.length) >> 2;
    for (let w = page >> 2; w < end; w++) {
      if (words[w]) { view.set(data.subarray(page, page + PAGE), offset + page); break; }
    }
  }
}
/** Writes the checkpoint's RAM chunks into guest memory, a few at a time.
 * Fetching every chunk at once kept up to the whole RAM in transient
 * buffers, and the allocator keeps such a high-water mark for good. */
export async function restoreRam(base: string | ObjectStore, ram: SMPCheckpoint['ram'], view: Uint8Array,
  concurrency = typeof base === 'string' || !base.pool ? 4 : 2 * base.pool.size) {
  let next = 0;
  const lane = async () => {
    while (next < ram.length) {
      const chunk = ram[next++]!;
      writeNonzeroPages(view, await readObject(base, chunk.object), chunk.offset);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, ram.length) }, lane));
}
/** Stream one MiB at a time; never duplicate the guest's entire RAM. */
export async function storeRam(ram: Uint8Array, write: (name: string, data: Uint8Array) => Promise<void>) {
  const chunks: SMPCheckpoint['ram'] = [];
  for (let offset = 0; offset < ram.length; offset += 1048576) {
    const part = ram.subarray(offset, offset + 1048576);
    if (part.some(b => b !== 0)) chunks.push({ offset, object: await storeObject(part.slice(), write) });
  }
  return chunks;
}
