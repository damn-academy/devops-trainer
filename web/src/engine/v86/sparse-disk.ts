// A blank virtual disk for v86 that costs memory only for what the guest
// writes. v86 accepts any object with the buffer interface of its
// src/buffer.js (load/get/set/get_buffer/get_state/set_state); its own
// SyncBuffer would allocate the whole disk and put every byte into each
// snapshot. Here a disk is a map of 64 KiB chunks: unwritten chunks read as
// zeros, and a snapshot carries only the written ones. A 2 GiB disk with a
// fresh Alpine install on it adds about the size of the install.

export const CHUNK = 64 * 1024;

/** The disk as plain data: survives postMessage and v86 snapshots. */
export interface SparseDiskData {
  byteLength: number;
  /** Indices of the chunks present, ascending. */
  index: Uint32Array;
  /** The chunks, CHUNK bytes each, in the order of `index`. */
  data: Uint8Array;
}

export class SparseDisk {
  byteLength: number;
  onload: ((e: object) => void) | undefined;
  onprogress: undefined;
  private chunks = new Map<number, Uint8Array>();

  constructor(byteLength: number, from?: SparseDiskData) {
    if (byteLength % 512) throw new Error('a disk size must be a multiple of 512 bytes');
    this.byteLength = byteLength;
    if (from) this.import(from);
  }

  /** Bytes of guest data held in memory. */
  get usedBytes(): number {
    return this.chunks.size * CHUNK;
  }

  load(): void {
    this.onload?.(Object.create(null));
  }

  private read(start: number, len: number): Uint8Array {
    const out = new Uint8Array(len);
    let off = 0;
    while (off < len) {
      const pos = start + off;
      const ci = Math.floor(pos / CHUNK);
      const at = pos - ci * CHUNK;
      const n = Math.min(CHUNK - at, len - off);
      const c = this.chunks.get(ci);
      if (c) out.set(c.subarray(at, at + n), off);
      off += n;
    }
    return out;
  }

  get(start: number, len: number, fn: (data: Uint8Array) => void): void {
    if (start + len > this.byteLength) throw new Error('read past the end of the disk');
    fn(this.read(start, len));
  }

  get_and_cache(start: number, len: number, fn: (data: Uint8Array) => void): void {
    this.get(start, len, fn);
  }

  get_from_cache(start: number, len: number): Uint8Array {
    return this.read(start, len);
  }

  set(start: number, data: Uint8Array, fn: () => void): void {
    if (start + data.byteLength > this.byteLength) throw new Error('write past the end of the disk');
    let off = 0;
    while (off < data.byteLength) {
      const pos = start + off;
      const ci = Math.floor(pos / CHUNK);
      const at = pos - ci * CHUNK;
      const n = Math.min(CHUNK - at, data.byteLength - off);
      const part = data.subarray(off, off + n);
      let c = this.chunks.get(ci);
      if (!c) {
        // Writing zeros into an absent chunk changes nothing (mkfs and dd zero large ranges).
        if (part.every((b) => b === 0)) {
          off += n;
          continue;
        }
        c = new Uint8Array(CHUNK);
        this.chunks.set(ci, c);
      }
      c.set(part, at);
      off += n;
    }
    fn();
  }

  /** v86 calls this to export the image; a sparse disk has no single buffer. */
  get_buffer(fn: (b?: ArrayBuffer) => void): void {
    fn(undefined);
  }

  export(): SparseDiskData {
    const keys = [...this.chunks.keys()].sort((a, b) => a - b);
    const data = new Uint8Array(keys.length * CHUNK);
    keys.forEach((k, i) => data.set(this.chunks.get(k)!, i * CHUNK));
    return { byteLength: this.byteLength, index: Uint32Array.from(keys), data };
  }

  import(d: SparseDiskData): void {
    this.byteLength = d.byteLength;
    this.chunks.clear();
    d.index.forEach((k, i) => this.chunks.set(k, d.data.slice(i * CHUNK, (i + 1) * CHUNK)));
  }

  // v86 snapshots: arrays of numbers and typed arrays only.
  get_state(): [number, Uint32Array, Uint8Array] {
    const e = this.export();
    return [e.byteLength, e.index, e.data];
  }

  set_state(s: [number, Uint32Array, Uint8Array]): void {
    this.import({ byteLength: s[0], index: s[1], data: s[2] });
  }

  /** Does sector 0 end with the boot signature 55 AA (an MBR or a protective MBR)? */
  bootable(): boolean {
    const s = this.read(0, 512);
    return s[510] === 0x55 && s[511] === 0xaa;
  }
}
