// Shared RAM and SBI mailboxes for the experimental CPU-per-Worker interpreter.
// All harts and DMA must use this write protocol before SMP can be enabled.
import { uleb } from './jit-compiler';
const string = (s: string) => [s.length, ...new TextEncoder().encode(s)];
const section = (id: number, b: number[]) => [id, ...uleb(b.length), ...b];

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
interface AtomicExports {
  load(address: number): bigint;
  store(address: number, value: bigint): void;
  add(address: number, value: bigint): bigint;
  swap(address: number, value: bigint): bigint;
  cas(address: number, expected: bigint, value: bigint): bigint;
}
export interface Reservation { address: number; size: 4 | 8; epoch: bigint }
export type Amo = 'swap' | 'add' | 'xor' | 'and' | 'or' | 'min' | 'max' | 'minu' | 'maxu';

/** Conservative global reservation epoch and lock. ABA writes invalidate LR.
 * False SC failures from unrelated writes are permitted. No unlocked stores,
 * including JIT stores and DMA, may bypass this protocol. Ordinary reads use
 * atomic wasm loads; they do not require the writer lock.
 * Layout: lock at 0, epoch at 8, guest data starts at 64.
 */
export class SharedHartMemory {
  private reservation?: Reservation;
  private words: Int32Array;
  private wasm: AtomicExports;
  constructor(readonly memory: WebAssembly.Memory, module: WebAssembly.Module, private generations?: Int32Array) {
    if (!(memory.buffer instanceof SharedArrayBuffer)) throw new Error('SMP requires shared wasm memory');
    this.words = new Int32Array(memory.buffer);
    this.wasm = new WebAssembly.Instance(module, { env: { memory } }).exports as unknown as AtomicExports;
  }
  private check(address: number, size: number) {
    if (!Number.isInteger(address) || address < 64 || address % size || address + size > this.memory.buffer.byteLength) throw new RangeError('unaligned/out-of-bounds shared RAM');
  }
  private locked<T>(body: () => T): T {
    while (Atomics.compareExchange(this.words, 0, 0, 1) !== 0) Atomics.wait(this.words, 0, 1, 10);
    try { return body(); } finally { Atomics.store(this.words, 0, 0); Atomics.notify(this.words, 0, 1); }
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
    this.wasm.add(8, 1n);
    if (this.generations) Atomics.add(this.generations, Math.floor((address - 64) / 4096), 1);
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
      this.reservation = { address, size, epoch: this.wasm.load(8) };
      return this.read(address, size);
    });
  }
  sc(address: number, size: 4 | 8, value: bigint): boolean {
    const reservation = this.reservation;
    this.reservation = undefined;
    this.check(address, size);
    return this.locked(() => {
      if (!reservation || reservation.address !== address || reservation.size !== size || reservation.epoch !== this.wasm.load(8)) return false;
      this.write(address, size, value); return true;
    });
  }
  amo(address: number, size: 4 | 8, op: Amo, value: bigint): bigint {
    this.check(address, size);
    return this.locked(() => {
      if (size === 8 && (op === 'add' || op === 'swap')) {
        const old = this.wasm[op](address, value);
        this.wasm.add(8, 1n);
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
