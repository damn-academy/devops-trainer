import { sha256 } from './snapshot';
import type { HTTPDisk } from './block';
export interface ObjectRef { sha256: string; bytes: number }
export interface SMPCheckpoint {
  format: 'dt.rv64.smp/v1'; harts: number; bytes: number; wasmSha256: string;
  disk: HTTPDisk; capturedAt: number; ticks: number; marker: string;
  cpus: ObjectRef[]; device: ObjectRef; control: ObjectRef; mail: ObjectRef;
  ram: { offset: number; object: ObjectRef }[];
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
}
export async function readObject(base: string, ref: ObjectRef): Promise<Uint8Array> {
  const r = await fetch(new URL(`${ref.sha256}.bin`, base));
  if (!r.ok) throw Error(`SMP object HTTP ${r.status}`);
  const data = new Uint8Array(await r.arrayBuffer());
  if (data.length !== ref.bytes || await sha256(data) !== ref.sha256) throw Error('SMP object checksum mismatch');
  return data;
}
/** Writes the checkpoint's RAM chunks into guest memory, a few at a time.
 * Fetching every chunk at once kept up to the whole RAM in transient
 * buffers, and the allocator keeps such a high-water mark for good. */
export async function restoreRam(base: string, ram: SMPCheckpoint['ram'], view: Uint8Array, concurrency = 4) {
  let next = 0;
  const lane = async () => {
    while (next < ram.length) {
      const chunk = ram[next++]!;
      view.set(await readObject(base, chunk.object), chunk.offset);
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
