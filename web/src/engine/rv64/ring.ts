/** Single producer/single consumer byte ring. Publication is atomic; bytes never overwrite unread data. */
export class ByteRing {
  readonly words: Int32Array;
  readonly bytes: Uint8Array;
  constructor(readonly buffer: SharedArrayBuffer) {
    if (buffer.byteLength < 32) throw new Error('ring is too small');
    this.words = new Int32Array(buffer, 0, 4);
    this.bytes = new Uint8Array(buffer, 16);
    if ((this.bytes.length & (this.bytes.length - 1)) !== 0) throw new Error('ring capacity must be a power of two');
  }
  static create(capacity = 65536): ByteRing { return new ByteRing(new SharedArrayBuffer(16 + capacity)); }
  write(data: Uint8Array): number {
    const read = Atomics.load(this.words, 0) >>> 0;
    const write = Atomics.load(this.words, 1) >>> 0;
    const count = Math.min(data.length, this.bytes.length - ((write - read) >>> 0));
    for (let i = 0; i < count; i++) this.bytes[(write + i) % this.bytes.length] = data[i]!;
    Atomics.store(this.words, 1, (write + count) | 0);
    Atomics.add(this.words, 2, 1);
    Atomics.notify(this.words, 2);
    return count;
  }
  read(): Uint8Array {
    const read = Atomics.load(this.words, 0) >>> 0;
    const write = Atomics.load(this.words, 1) >>> 0;
    const count = (write - read) >>> 0;
    const out = new Uint8Array(count);
    if (!count) return out;
    for (let i = 0; i < count; i++) out[i] = this.bytes[(read + i) % this.bytes.length]!;
    Atomics.store(this.words, 0, write | 0);
    Atomics.add(this.words, 2, 1);
    Atomics.notify(this.words, 2);
    return out;
  }
}

/** Frames are published whole; a full ring drops a frame rather than truncating it. */
export class FrameRing {
  constructor(readonly ring: ByteRing) {}
  write(frame: Uint8Array): boolean {
    if (frame.length > 65535) return false;
    const read = Atomics.load(this.ring.words, 0) >>> 0, write = Atomics.load(this.ring.words, 1) >>> 0;
    if (frame.length + 4 > this.ring.bytes.length - ((write - read) >>> 0)) return false;
    const packet = new Uint8Array(frame.length + 4);
    new DataView(packet.buffer).setUint32(0, frame.length, true); packet.set(frame, 4);
    return this.ring.write(packet) === packet.length;
  }
  read(): Uint8Array[] {
    const bytes = this.ring.read(), frames: Uint8Array[] = [];
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let pos = 0; pos < bytes.length;) {
      if (pos + 4 > bytes.length) throw new Error('truncated frame header');
      const size = view.getUint32(pos, true); pos += 4;
      if (size > 65535 || pos + size > bytes.length) throw new Error('truncated frame');
      frames.push(bytes.slice(pos, pos + size)); pos += size;
    }
    return frames;
  }
}
