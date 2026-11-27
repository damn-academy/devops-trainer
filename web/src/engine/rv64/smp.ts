// Shared RAM and SBI mailboxes for the experimental CPU-per-Worker interpreter.
// All harts and DMA must use this write protocol before SMP can be enabled.
import { uleb } from './jit-compiler';
const string = (s: string) => [s.length, ...new TextEncoder().encode(s)];
const section = (id: number, b: number[]) => [id, ...uleb(b.length), ...b];

/** Fixed shared wasm metadata; pass the Memory itself through structured clone. */
export function sharedTable(bytes: number): WebAssembly.Memory {
  const pages = Math.ceil(bytes / 65536);
  return new WebAssembly.Memory({ initial: pages, maximum: pages, shared: true });
}

/** Small atomic wasm module: addresses are byte offsets in one shared memory. */
export function atomicModule(pages: number): WebAssembly.Module {
  const signatures = [
    [0x60, 1, 0x7f, 1, 0x7e], // load
    [0x60, 2, 0x7f, 0x7e, 0], // store
    [0x60, 2, 0x7f, 0x7e, 1, 0x7e], // rmw
    [0x60, 3, 0x7f, 0x7e, 0x7e, 1, 0x7e], // cmpxchg
  ];
  const operations = [
    { name: 'load', type: 0, op: 0x11, args: 1 },
    { name: 'store', type: 1, op: 0x18, args: 2 },
    { name: 'add', type: 2, op: 0x1f, args: 2 },
    { name: 'swap', type: 2, op: 0x42, args: 2 },
    { name: 'cas', type: 3, op: 0x49, args: 3 },
  ];
  const bodies = operations.map(o => {
    const b = [0, ...Array.from({ length: o.args }, (_, i) => [0x20, i]).flat(), 0xfe, o.op, 3, 0, 0x0b];
    return [...uleb(b.length), ...b];
  });
  return new WebAssembly.Module(new Uint8Array([
    0,97,115,109,1,0,0,0,
    ...section(1, [signatures.length, ...signatures.flat()]),
    ...section(2, [1, ...string('env'), ...string('memory'), 2, 3, ...uleb(pages), ...uleb(pages)]),
    ...section(3, [operations.length, ...operations.map(o => o.type)]),
    ...section(7, [operations.length, ...operations.flatMap((o, i) => [...string(o.name), 0, i])]),
    ...section(10, [operations.length, ...bodies.flat()]),
  ]));
}
/** Direct shared-bus access for the Rust core, imported as module
 * `rv64shared`, so interpreter loads, stores, fetches and page walks never
 * leave wasm. Stores follow the SharedHartMemory writer protocol exactly:
 * lock word at 0, then the reservation granule and the code-page
 * generation of the stored byte. Offsets are guest-physical RAM
 * offsets (guest data starts at byte 64); callers bound and align them.
 * Memories: 0 = RAM, 1 = page generations, 2 = reservation granules. */
export function sharedAccessModule(ramPages: number, generationPages: number, granulePages: number): WebAssembly.Module {
  const sleb = (v: number) => { const out: number[] = []; for (;;) { const b = v & 127; v >>= 7; if (v === 0 && !(b & 64) || v === -1 && b & 64) { out.push(b); return out; } out.push(b | 128); } };
  const i32 = (v: number) => [0x41, ...sleb(v)], i64 = (v: number) => [0x42, ...sleb(v)];
  const get = (i: number) => [0x20, i], set = (i: number) => [0x21, i];
  const at = (op: number, align: number, memory = 0) => memory ? [0xfe, op, align | 64, memory, 0] : [0xfe, op, align, 0];
  const address = [...get(0), ...i32(64), 0x6a];
  // Dispatch on access size 8/4/2/1 (param 1); `pick` emits one arm.
  const bySize = (type: number, pick: (size: number) => number[]) => [
    ...get(1), ...i32(8), 0x46, 0x04, type, ...pick(8), 0x05,
    ...get(1), ...i32(4), 0x46, 0x04, type, ...pick(4), 0x05,
    ...get(1), ...i32(2), 0x46, 0x04, type, ...pick(2), 0x05, ...pick(1), 0x0b, 0x0b, 0x0b];
  const loadOp: Record<number, number[]> = { 8: at(0x11, 3), 4: at(0x16, 2), 2: at(0x15, 1), 1: at(0x14, 0) };
  const storeOp: Record<number, number[]> = { 8: at(0x18, 3), 4: at(0x1d, 2), 2: at(0x1c, 1), 1: at(0x1b, 0) };
  const bodies: [number[], number[]][] = [
    // 0 lock(): 0 -> 1 when free; otherwise mark the lock contended (2) and
    // sleep until the holder releases it (the futex mutex of SharedHartMemory).
    [[], [...i32(0), ...i32(0), ...i32(1), ...at(0x48, 2), 0x04, 0x40, 0x03, 0x40,
      ...i32(0), ...i32(2), ...at(0x41, 2), 0x04, 0x40,
      ...i32(0), ...i32(2), ...i64(100000), ...at(0x01, 2), 0x1a, 0x0c, 1, 0x0b, 0x0b, 0x0b]],
    // 1 unlock(): wake a sleeper only if the lock was marked contended.
    [[], [...i32(0), ...i32(0), ...at(0x41, 2), ...i32(2), 0x46, 0x04, 0x40, ...i32(0), ...i32(1), ...at(0x00, 2), 0x1a, 0x0b]],
    // 2 publish(offset): reservation granule, then code-page generation.
    [[], [...address, ...i32(7), 0x76, ...i32(2), 0x74, ...i32(1), ...at(0x1e, 2, 2), 0x1a,
      ...get(0), ...i32(12), 0x76, ...i32(2), 0x74, ...i32(1), ...at(0x1e, 2, 1), 0x1a]],
    // 3 load(offset, size) -> zero-extended i64
    [[1, 1, 0x7f], [...address, ...set(2), ...bySize(0x7e, n => [...get(2), ...loadOp[n]!])]],
    // 4 store(offset, size, value)
    [[1, 1, 0x7f], [0x10, 0, ...address, ...set(3), ...bySize(0x40, n => [...get(3), ...get(2), ...storeOp[n]!]), ...get(0), 0x10, 2, 0x10, 1]],
    // 5 generation(page) -> i32
    [[], [...get(0), ...i32(2), 0x74, ...at(0x10, 2, 1)]],
    // 6 cas(offset, expected, value) -> old (PTE A/D updates)
    [[1, 1, 0x7e], [0x10, 0, ...address, ...at(0x11, 3), 0x22, 3, ...get(1), 0x51, 0x04, 0x40,
      ...address, ...get(2), ...at(0x18, 3), ...get(0), 0x10, 2, 0x0b, 0x10, 1, ...get(3)]],
    // 7 fetch(offset) -> 32 instruction bits (2-byte aligned, page-internal)
    [[], [...address, 0x28, 1, 0]],
  ];
  const code = bodies.map(([locals, body]) => { const b = [...(locals.length ? locals : [0]), ...body, 0x0b]; return [...uleb(b.length), ...b]; });
  const memory = (name: string, pages: number) => [...string('env'), ...string(name), 2, 3, ...uleb(pages), ...uleb(pages)];
  const exports = [['load', 3], ['store', 4], ['generation', 5], ['cas', 6], ['fetch', 7]] as const;
  return new WebAssembly.Module(new Uint8Array([
    0,97,115,109,1,0,0,0,
    ...section(1, [6, 0x60,0,0, 0x60,1,0x7f,0, 0x60,2,0x7f,0x7f,1,0x7e, 0x60,3,0x7f,0x7f,0x7e,0, 0x60,1,0x7f,1,0x7f, 0x60,3,0x7f,0x7e,0x7e,1,0x7e]),
    ...section(2, [3, ...memory('ram', ramPages), ...memory('generations', generationPages), ...memory('granules', granulePages)]),
    ...section(3, [8, 0, 0, 1, 2, 3, 4, 5, 4]),
    ...section(7, [exports.length, ...exports.flatMap(([name, index]) => [...string(name), 0, index])]),
    ...section(10, [code.length, ...code.flat()]),
  ]));
}
export interface SharedAccessExports {
  load(offset: number, size: number): bigint;
  store(offset: number, size: number, value: bigint): void;
  generation(page: number): number;
  cas(offset: number, expected: bigint, value: bigint): bigint;
  fetch(offset: number): number;
}
interface AtomicExports {
  load(address: number): bigint;
  store(address: number, value: bigint): void;
  add(address: number, value: bigint): bigint;
  swap(address: number, value: bigint): bigint;
  cas(address: number, expected: bigint, value: bigint): bigint;
}
export interface Reservation { address: number; size: 4 | 8; epoch: number }
export type Amo = 'swap' | 'add' | 'xor' | 'and' | 'or' | 'min' | 'max' | 'minu' | 'maxu';

// Reservation sets in 128-byte granules, one epoch counter per granule. Real
// hardware tracks a reservation set (typically a cache line) per hart, not a
// global flag: a store to an unrelated granule must not kill another hart's
// SC. Every hart must share one table: browser workers pass it explicitly
// (each worker is its own realm, so a module-level map is NOT shared there);
// the WeakMap fallback only covers several harts in one realm, like the unit
// tests. Int32 wraparound needs ~4G writes to one granule between LR and SC,
// which cannot happen inside one scheduler quantum.
// No unlocked stores, including JIT stores and DMA, may bypass this protocol;
// ordinary reads use atomic wasm loads and do not require the writer lock.
// Layout: lock at 0, bytes 4..63 unused (formerly a global write counter that
// every store bumped; nothing read it), guest data starts at 64.
export const RESERVATION_GRANULE = 128;
const fallbackGranuleTables = new WeakMap<WebAssembly.Memory, Int32Array>();
export class SharedHartMemory {
  private reservation?: Reservation;
  private words: Int32Array;
  private wasm: AtomicExports;
  private granules: Int32Array;
  constructor(readonly memory: WebAssembly.Memory, module: WebAssembly.Module, private generations?: Int32Array, granules?: Int32Array) {
    if (!(memory.buffer instanceof SharedArrayBuffer)) throw new Error('SMP requires shared wasm memory');
    const buffer: SharedArrayBuffer = memory.buffer;
    this.words = new Int32Array(buffer);
    this.wasm = new WebAssembly.Instance(module, { env: { memory } }).exports as unknown as AtomicExports;
    if (granules) {
      this.granules = granules;
    } else {
      let table = fallbackGranuleTables.get(memory);
      if (!table) {
        table = new Int32Array(new SharedArrayBuffer(Math.ceil(buffer.byteLength / 128) * 4));
        fallbackGranuleTables.set(memory, table);
      }
      this.granules = table;
    }
  }
  private check(address: number, size: number) {
    if (!Number.isInteger(address) || address < 64 || address % size || address + size > this.memory.buffer.byteLength) throw new RangeError('unaligned/out-of-bounds shared RAM');
  }
  // Writer lock word: 0 free, 1 held, 2 held with possible sleepers. Only a
  // release of a contended lock pays for Atomics.notify; JIT stores spin on 0 -> 1.
  private locked<T>(body: () => T): T {
    if (Atomics.compareExchange(this.words, 0, 0, 1) !== 0)
      while (Atomics.exchange(this.words, 0, 2) !== 0) Atomics.wait(this.words, 0, 2, 10);
    try { return body(); } finally { if (Atomics.exchange(this.words, 0, 0) === 2) Atomics.notify(this.words, 0, 1); }
  }
  private read(address: number, size: 1 | 2 | 4 | 8): bigint {
    const value = this.wasm.load(address - address % 8);
    return size === 8 ? value : size === 4 ? BigInt.asIntN(32, value >> BigInt(address % 8 * 8)) : BigInt.asUintN(size * 8, value >> BigInt(address % 8 * 8));
  }
  private write(address: number, size: 1 | 2 | 4 | 8, value: bigint) {
    if (size === 8) this.wasm.store(address, value);
    else {
      const aligned = address - address % 8, shift = BigInt(address % 8 * 8), bits = (1n << BigInt(size * 8)) - 1n, mask = bits << shift;
      this.wasm.store(aligned, (this.wasm.load(aligned) & ~mask) | ((value & bits) << shift));
    }
    Atomics.add(this.granules, Math.floor(address / 128), 1);
    if (this.generations) Atomics.add(this.generations, Math.floor((address - 64) / 4096), 1);
  }
  /** Device DMA: one locked bus transaction, then every touched reservation
   * granule and code page is published once, exactly as per-byte stores did. */
  dmaWrite(address: number, bytes: Uint8Array) {
    if (!bytes.length) return;
    if (!Number.isInteger(address) || address < 64 || address + bytes.length > this.memory.buffer.byteLength) throw new RangeError('out-of-bounds shared DMA');
    this.locked(() => {
      new Uint8Array(this.memory.buffer, address, bytes.length).set(bytes);
      const last = address + bytes.length - 1;
      for (let g = Math.floor(address / 128); g <= Math.floor(last / 128); g++) Atomics.add(this.granules, g, 1);
      if (this.generations) for (let p = Math.floor((address - 64) / 4096); p <= Math.floor((last - 64) / 4096); p++) Atomics.add(this.generations, p, 1);
    });
  }
  dmaRead(address: number, out: Uint8Array) {
    if (!out.length) return;
    if (!Number.isInteger(address) || address < 64 || address + out.length > this.memory.buffer.byteLength) throw new RangeError('out-of-bounds shared DMA');
    out.set(new Uint8Array(this.memory.buffer, address, out.length));
  }
  load(address: number, size: 1 | 2 | 4 | 8): bigint { this.check(address, size); return this.read(address, size); }
  store(address: number, size: 1 | 2 | 4 | 8, value: bigint) { this.check(address, size); this.locked(() => this.write(address, size, value)); }
  clearReservation() { this.reservation = undefined; }
  cas(address: number, expected: bigint, value: bigint): bigint {
    this.check(address, 8);
    return this.locked(() => {
      const old = this.read(address, 8);
      if (BigInt.asUintN(64, old) === BigInt.asUintN(64, expected)) this.write(address, 8, value);
      return old;
    });
  }
  lr(address: number, size: 4 | 8): bigint {
    this.check(address, size);
    return this.locked(() => {
      this.reservation = { address, size, epoch: Atomics.load(this.granules, Math.floor(address / 128)) };
      return this.read(address, size);
    });
  }
  sc(address: number, size: 4 | 8, value: bigint): boolean {
    const reservation = this.reservation;
    this.reservation = undefined;
    this.check(address, size);
    return this.locked(() => {
      if (!reservation || reservation.address !== address || reservation.size !== size || reservation.epoch !== Atomics.load(this.granules, Math.floor(address / 128))) return false;
      this.write(address, size, value); return true;
    });
  }
  amo(address: number, size: 4 | 8, op: Amo, value: bigint): bigint {
    this.check(address, size);
    return this.locked(() => {
      if (size === 8 && (op === 'add' || op === 'swap')) {
        const old = this.wasm[op](address, value);
        Atomics.add(this.granules, Math.floor(address / 128), 1);
        if (this.generations) Atomics.add(this.generations, Math.floor((address - 64) / 4096), 1);
        return old;
      }
      const old = this.read(address, size), bits = size * 8;
      const a = BigInt.asIntN(bits, old), b = BigInt.asIntN(bits, value);
      const au = BigInt.asUintN(bits, a), bu = BigInt.asUintN(bits, b);
      const next = { swap: b, add: a + b, xor: a ^ b, and: a & b, or: a | b,
        min: a < b ? a : b, max: a > b ? a : b, minu: au < bu ? a : b, maxu: au > bu ? a : b }[op];
      this.write(address, size, next); return old;
    });
  }
}

export interface FenceTicket { hart: number; kind: 'instruction' | 'translation'; sequence: number }
/** Per-hart SBI mailbox. RFENCE completion is acknowledged only AFTER the
 * target services its own caches. SFENCE.VMA is local; it must not broadcast.
 * For now a remote range/ASID request conservatively flushes the whole target
 * TLB, which is architecturally permitted. Callers must keep servicing their
 * inbound mailbox while awaiting tickets, including concurrent remote fences.
 */
export class HartMailboxes {
  static readonly stride = 8;
  readonly words: Int32Array;
  constructor(readonly harts: number, buffer = new SharedArrayBuffer(harts * HartMailboxes.stride * 4)) {
    if (!Number.isInteger(harts) || harts < 1 || harts > 64 || buffer.byteLength !== harts * HartMailboxes.stride * 4) throw new RangeError('invalid hart mailboxes');
    this.words = new Int32Array(buffer);
  }
  private base(hart: number) {
    if (!Number.isInteger(hart) || hart < 0 || hart >= this.harts) throw new RangeError('invalid hart');
    return hart * HartMailboxes.stride;
  }
  targets(mask: bigint, base: bigint): number[] {
    const max = (1n << 64n) - 1n;
    if (mask < 0n || mask > max || base < 0n || base > max) throw new RangeError('invalid SBI mask');
    if (base === max) return Array.from({ length: this.harts }, (_, hart) => hart);
    const targets: number[] = [];
    for (let bit = 0; bit < 64; bit++) if (mask & (1n << BigInt(bit))) {
      const hart = base + BigInt(bit);
      if (hart >= BigInt(this.harts)) throw new RangeError('invalid SBI hart target');
      targets.push(Number(hart));
    }
    return targets;
  }
  sendIpi(mask: bigint, base: bigint) { this.targets(mask, base).forEach(hart => this.ipi(hart)); }
  remoteFence(mask: bigint, base: bigint, kind: FenceTicket['kind']) {
    return this.targets(mask, base).map(hart => this.fence(hart, kind));
  }
  private wake(base: number) { Atomics.add(this.words, base, 1); Atomics.notify(this.words, base); }
  wakeSequence(hart: number) { return Atomics.load(this.words, this.base(hart)); }
  /** Wake a hart idling in WFI so it rechecks device requests and interrupts. */
  kick(hart: number) { this.wake(this.base(hart)); }
  ipi(hart: number) { const b = this.base(hart); Atomics.store(this.words, b + 1, 1); this.wake(b); }
  fence(hart: number, kind: FenceTicket['kind']): FenceTicket {
    const b = this.base(hart), slot = b + (kind === 'instruction' ? 2 : 4);
    const sequence = (Atomics.add(this.words, slot, 1) + 1) | 0;
    this.wake(b); return { hart, kind, sequence };
  }
  completed(ticket: FenceTicket): boolean {
    const b = this.base(ticket.hart), slot = b + (ticket.kind === 'instruction' ? 3 : 5);
    // Fewer than 2^31 outstanding requests are allowed; later acks cover earlier requests.
    return ((Atomics.load(this.words, slot) - ticket.sequence) | 0) >= 0;
  }
  service(hart: number, flushInstruction: () => void, flushTranslation: () => void): boolean {
    const b = this.base(hart);
    for (const [offset, flush] of [[2, flushInstruction], [4, flushTranslation]] as const) {
      const requested = Atomics.load(this.words, b + offset);
      if (requested !== Atomics.load(this.words, b + offset + 1)) {
        flush(); // The hart's TLB/JIT/decoded-cache invalidation must finish before ACK.
        Atomics.store(this.words, b + offset + 1, requested);
        Atomics.notify(this.words, b + offset + 1);
      }
    }
    return Atomics.exchange(this.words, b + 1, 0) !== 0;
  }
  wait(hart: number, observed: number, timeoutMs: number) {
    return Atomics.wait(this.words, this.base(hart), observed, timeoutMs);
  }
}
