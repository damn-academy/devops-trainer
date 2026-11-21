// Small wasm binary encoder. Each batch shares one imported engine memory.
export interface Block { id: number; pc: bigint; words: number[]; raw?: number[] }
export const uleb = (value: number): number[] => {
  const out: number[] = []; do { const b = value & 127; value >>>= 7; out.push(b | (value ? 128 : 0)); } while (value); return out;
};
const sleb = (value: bigint): number[] => {
  value = BigInt.asIntN(64, value); const out: number[] = [];
  for (;;) { const b = Number(value & 127n); value >>= 7n; const end = value === 0n && !(b & 64) || value === -1n && !!(b & 64); out.push(b | (end ? 0 : 128)); if (end) return out; }
};
const str = (s: string) => { const bytes = [...new TextEncoder().encode(s)]; return [...uleb(bytes.length), ...bytes]; };
const section = (id: number, bytes: number[]) => [id, ...uleb(bytes.length), ...bytes];
const get = (r: number) => r ? [0x20, ...uleb(r + 2)] : [0x42, 0];
const constant = (n: bigint) => [0x42, ...sleb(n)];
const sx = (n: number, bits: number) => BigInt(n << (32 - bits) >> (32 - bits));
const helper = (i: number) => [0x2f,0x07,0x27,0x43,0x47,0x4b,0x4f,0x53].includes(i&127);
function body(block: Block): number[] {
  const code: number[] = []; const used = new Set<number>(), dirty = new Set<number>();
  for (let k=0;k<block.words.length;k+=2) { const i=block.words[k]!, rd=i>>>7&31; if (rd && ![0x23,0x63].includes(i&127)) { used.add(rd); dirty.add(rd); } }
  const emit = (...a: number[]) => code.push(...a);
  const frame = (offset: number) => [0x20,1,0x29,3,...uleb(offset)];
  const spill = () => { for (const r of dirty) emit(0x20,0,...get(r),0x37,3,...uleb(r*8)); };
  const count = (n: number) => emit(0x20,1,0x20,43,0xad,...constant(BigInt(n)),0x7c,0x37,3,8);
  const bailout = (condition: number[], pc: bigint, n: number) => {
    emit(...condition,0x04,0x40); spill();
    emit(0x20,1,...constant(pc),0x37,3,0); count(n); emit(0x0f,0x0b);
  };
  const backedge = (n: number, depth: number) => {
    emit(0x20,43,0xad,...constant(BigInt(n+block.words.length/2)),0x7c,...frame(80),0x58,0x04,0x40,
      0x20,43,0x41,...sleb(BigInt(n)),0x6a,0x21,43,0x0c,depth,0x0b);
  };
  let pc = block.pc;
  for (let k = 0; k < block.words.length; k += 2) {
    const i = block.words[k]! >>> 0, len = BigInt(block.words[k + 1]!);
    const op = i & 127, rd = i >>> 7 & 31, f = i >>> 12 & 7, a = i >>> 15 & 31, b = i >>> 20 & 31, top = i >>> 25;
    used.add(a); used.add(b);
    const imm = sx(i >>> 20, 12), word = op === 0x1b || op === 0x3b;
    const reg = (r: number) => [...get(r), ...(word ? [0xa7] : [])];
    const val = (n: bigint) => word ? [0x41, ...sleb(BigInt.asIntN(32, n))] : constant(n);
    let expr: number[] = []; let jumpBack = false;
    const slow = () => {
      spill(); count(k/2+1);
      emit(...frame(96),0xa7,0x41,...sleb(BigInt(i|0)),0x41,...sleb(BigInt((block.raw?.[k/2] ?? i)|0)),
        0x41,...sleb(len),...constant(pc),0x20,1,0x10,0,0x0f);
    };
    const memoryBail = (condition: number[]) => emit(...condition,0x0d,0);
    if (helper(i)) {
      slow();
    } else if (op === 0x03 || op === 0x23) {
      const store = op === 0x23, size = 1 << (f & 3);
      const offset = store ? sx((i >>> 25 << 5) | (i >>> 7 & 31),12) : imm;
      emit(...get(a),...constant(offset),0x7c,0x21,38,0x02,store?0x40:0x7e,0x02,0x40);
      // Only aligned Sv39 RAM hits with whole-page PMP permission use this path.
      memoryBail([...frame(56),...constant(3n),0x83,...constant(3n),0x51,
        ...frame(64),...constant(60n),0x88,...constant(8n),0x52,0x72,
        0x20,38,...constant(BigInt(size-1)),0x83,0x50,0x45,0x72]);
      emit(...frame(store?40:32),0xa7,0x20,38,...constant(12n),0x88,...constant(255n),0x83,0xa7,0x41,40,0x6c,0x6a,0x21,41);
      const tlb = (offset: number) => [0x20,41,0x29,3,offset];
      memoryBail([0x20,41,0x2d,0,32,0x45,0x20,41,0x2d,0,33,0x45,0x72,
        ...tlb(0),0x20,38,...constant(12n),0x88,0x52,0x72,
        ...tlb(16),...frame(56),0x52,0x72,...tlb(24),...frame(64),0x52,0x72]);
      emit(...tlb(8),0x20,38,...constant(4095n),0x83,0x7c,0x21,39,
        0x20,39,...constant(0x80000000n),0x7d,0x21,40);
      memoryBail([0x20,40,...frame(24),0x5a]);
      if (store) memoryBail([...frame(48),0xa7,0x20,40,...constant(12n),0x88,0xa7,0x6a,0x2d,0,0]);
      emit(...frame(16),0xa7,0x20,40,0xa7,0x6a,0x21,42);
      if (store) {
        const opcode = [0x3c,0x3d,0x3e,0x37][f]!;
        emit(0x20,42,...get(b),opcode,f,0,0x20,1,...constant(1n),0x37,3,72);
      } else {
        const opcode = [0x30,0x32,0x34,0x29,0x31,0x33,0x35][f]!;
        emit(0x20,42,opcode,f&3,0);
      }
      // All failing guards share one cold helper call. Successful accesses
      // bypass it, carrying the loaded i64 out of the outer block.
      emit(0x0c,1,0x0b); slow(); emit(0x0b);
      if (!store) emit(...(rd ? [0x21,rd+2] : [0x1a]));
    } else if (op === 0x37) expr = constant(sx(i & 0xfffff000, 32));
    else if (op === 0x17) expr = constant(pc + sx(i & 0xfffff000, 32));
    else if (op === 0x63) {
      const offset = sx((i >>> 31 << 12) | ((i >>> 7 & 1) << 11) | ((i >>> 25 & 63) << 5) | ((i >>> 8 & 15) << 1), 13);
      const cmp: Record<number, number> = { 0: 0x51, 1: 0x52, 4: 0x53, 5: 0x59, 6: 0x54, 7: 0x5a };
      if (BigInt.asUintN(64,pc+offset) === block.pc) {
        emit(...get(a),...get(b),cmp[f]!,0x04,0x40); backedge(k/2+1,2);
        spill(); emit(0x20,1,...constant(pc+offset),0x37,3,0); count(k/2+1); emit(0x0f,0x0b);
      } else bailout([...get(a),...get(b),cmp[f]!],pc+offset,k/2+1);
      emit(...constant(pc+len),0x21,34);
    } else if (op === 0x6f || op === 0x67) {
      if (op === 0x67) emit(...get(a), ...constant(imm), 0x7c, ...constant(-2n), 0x83, 0x21, 34);
      else {
        const off = sx((i >>> 31 << 20) | ((i >>> 12 & 255) << 12) | ((i >>> 20 & 1) << 11) | ((i >>> 21 & 1023) << 1), 21);
        emit(...constant(pc + off), 0x21, 34);
        jumpBack = BigInt.asUintN(64,pc+off) === block.pc;
      }
      expr = constant(pc + len);
    } else if ([0x13, 0x1b, 0x33, 0x3b].includes(op)) {
      const immediate = op === 0x13 || op === 0x1b;
      const left = reg(a), right = immediate ? val(f === 1 || f === 5 ? BigInt(i >>> 20 & (word ? 31 : 63)) : imm) : reg(b);
      const base = word ? 0x6a : 0x7c;
      if (!immediate && top === 1) {
        if (f === 0) expr = [...left, ...right, base + 2];
        else if (f <= 3) {
          const half = (r: number, high: boolean) => [...get(r), ...constant(high ? 32n : 0xffffffffn), high ? 0x88 : 0x83];
          emit(...half(a,true), ...half(b,false), 0x7e, 0x21,35);
          emit(...half(a,false), ...half(b,true), 0x7e, 0x21,36);
          emit(...half(a,false), ...half(b,false), 0x7e, ...constant(32n),0x88,
            0x20,35,...constant(0xffffffffn),0x83,0x7c,0x20,36,...constant(0xffffffffn),0x83,0x7c,0x21,37);
          expr = [...half(a,true),...half(b,true),0x7e,
            0x20,35,...constant(32n),0x88,0x7c,0x20,36,...constant(32n),0x88,0x7c,
            0x20,37,...constant(32n),0x88,0x7c];
          if (f !== 3) expr.push(...get(a),...constant(63n),0x87,...get(b),0x83,0x7d);
          if (f === 1) expr.push(...get(b),...constant(63n),0x87,...get(a),0x83,0x7d);
        } else {
          // RISC-V division never traps (zero and MIN/-1 have defined results).
          const signed = f === 4 || f === 6, remainder = f >= 6;
          const eqz = word ? 0x45 : 0x50, eq = word ? 0x46 : 0x51, type = word ? 0x7f : 0x7e;
          const min = word ? -(1n << 31n) : -(1n << 63n);
          const normal = [...left, ...right, base + (remainder ? signed ? 5 : 6 : signed ? 3 : 4)];
          const nonzero = signed ? [...left, ...val(min), eq, ...right, ...val(-1n), eq, 0x71, 0x04, type, ...val(remainder ? 0n : min), 0x05, ...normal, 0x0b] : normal;
          expr = [...right, eqz, 0x04, type, ...(remainder ? left : val(-1n)), 0x05, ...nonzero, 0x0b];
        }
      } else {
        const shiftRightArithmetic = immediate ? !!(i & 0x40000000) : top === 32;
        const ops: Record<number, number> = { 0: base + (!immediate && top === 32 ? 1 : 0), 1: word ? 0x74 : 0x86, 2: 0x53, 3: 0x54, 4: word ? 0x73 : 0x85, 5: word ? shiftRightArithmetic ? 0x75 : 0x76 : shiftRightArithmetic ? 0x87 : 0x88, 6: word ? 0x72 : 0x84, 7: word ? 0x71 : 0x83 };
        expr = [...left, ...right, ops[f]!, ...(!word && (f === 2 || f === 3) ? [0xad] : [])];
      }
      if (word) expr.push(0xac);
    } else throw new Error(`unsupported JIT encoding ${i.toString(16)}`);
    if (expr.length) {
      if (rd) { emit(...expr, 0x21, rd + 2); dirty.add(rd); } else emit(...expr, 0x1a);
    }
    if (jumpBack) backedge(k/2+1,1);
    pc = BigInt.asUintN(64, pc + len);
  }
  const last = block.words[block.words.length - 2]! & 127;
  if (![0x63, 0x67, 0x6f].includes(last)) emit(...constant(pc), 0x21, 34);
  const prefix: number[] = [2, 39, 0x7e, 3, 0x7f]; // 2..33: x registers; 34: PC; 35..40: i64 scratch; 41..43: TLB/address/count
  for (const r of used) if (r) prefix.push(0x20, 0, 0x29, 3, ...uleb(r * 8), 0x21, r + 2);
  spill(); count(block.words.length/2);
  emit(0x20, 1, 0x20, 34, 0x37, 3, 0, 0x0b);
  const bytes = [...prefix, 0x03,0x40, ...code.slice(0,-1),0x0b,0x0b]; return [...uleb(bytes.length), ...bytes];
}
export function compileBatch(blocks: Block[]): Uint8Array<ArrayBuffer> {
  const hasHelper = blocks.some(b => b.words.some((i,k) => k%2===0 && (helper(i) || [0x03,0x23].includes(i&127))));
  return new Uint8Array([
    0, 97, 115, 109, 1, 0, 0, 0,
    ...section(1, [hasHelper?2:1, 0x60, 2, 0x7f, 0x7f, 0, ...(hasHelper ? [0x60,6,0x7f,0x7f,0x7f,0x7f,0x7e,0x7f,0] : [])]),
    ...section(2, [hasHelper?2:1, ...str('env'), ...str('memory'), 2, 0, 0, ...(hasHelper ? [...str('env'),...str('slow'),0,1] : [])]),
    ...section(3, [...uleb(blocks.length), ...blocks.map(() => 0)]),
    ...section(7, [...uleb(blocks.length), ...blocks.flatMap((b, n) => [...str(`b${b.id}`), 0, ...uleb(n+(hasHelper?1:0))])]),
    ...section(10, [...uleb(blocks.length), ...blocks.flatMap(body)]),
  ]);
}
