import { describe, expect, it } from 'vitest';
import { compileBatch, type Block } from '../src/engine/rv64/jit-compiler';
const R = (op: number, f: number, top = 0, rd = 3, a = 1, b = 2) => (top << 25 | b << 20 | a << 15 | f << 12 | rd << 7 | op) >>> 0;
function run(words: number[], a = 0n, b = 0n, pc = 0x80000000n) {
  const memory = new WebAssembly.Memory({ initial: 1 }); const regs = new BigUint64Array(memory.buffer);
  regs[1] = BigInt.asUintN(64, a); regs[2] = BigInt.asUintN(64, b);
  const block: Block = { id: 1, pc, words: words.flatMap(i => [i, 4]) };
  const module = new WebAssembly.Module(compileBatch([block]));
  const instance = new WebAssembly.Instance(module, { env: { memory } });
  (instance.exports.b1 as (r: number, p: number) => void)(0, 256);
  return { value: BigInt.asIntN(64, regs[3]!), pc: regs[32]!, regs };
}
describe('RV64 wasm compiler', () => {
  it('batches functions, spills dependent locals and preserves x0', () => {
    const r = run([R(0x33, 0), R(0x33, 0, 0, 3, 3, 2), R(0x33, 0, 0, 0)], 4n, 8n);
    expect(r.value).toBe(20n); expect(r.pc).toBe(0x8000000cn); expect(r.regs[0]).toBe(0n);
    const module = new WebAssembly.Module(compileBatch([{ id: 1, pc: 0n, words: [0x13, 4] }, { id: 2, pc: 4n, words: [0x13, 4] }]));
    expect(WebAssembly.Module.exports(module).map(e => e.name)).toEqual(['b1', 'b2']);
  });
  it('matches independent integer arithmetic over boundary values', () => {
    const values = [0n, 1n, -1n, -(1n << 63n), (1n << 63n) - 1n, 0x123456789abcdefn, 32n, 64n];
    for (const a of values) for (const b of values) {
      const ua = BigInt.asUintN(64, a), ub = BigInt.asUintN(64, b), sh = ub & 63n;
      const expected = [a+b, ua<<sh, BigInt(a<b), BigInt(ua<ub), a^b, ua>>sh, a|b, a&b];
      for (let f = 0; f < 8; f++) expect(run([R(0x33, f)], a,b).value).toBe(BigInt.asIntN(64, expected[f]!));
      expect(run([R(0x33, 0, 32)],a,b).value).toBe(BigInt.asIntN(64,a-b));
      expect(run([R(0x33, 5, 32)],a,b).value).toBe(a>>sh);
    }
  });
  it('implements defined division zero/overflow and word sign extension', () => {
    const values = [0n, 1n, -1n, -(1n<<63n), -(1n<<31n), (1n<<63n)-1n, 0xffffffffn, 123n, -17n];
    for (const word of [false,true]) for (const a of values) for (const b of values) {
      const bits = word ? 32 : 64, sa = BigInt.asIntN(bits,a), sb = BigInt.asIntN(bits,b), ua = BigInt.asUintN(bits,a), ub = BigInt.asUintN(bits,b);
      const results: Record<number,bigint> = { 0: sa*sb, 4: sb ? sa/sb : -1n, 5: ub ? ua/ub : -1n, 6: sb ? sa%sb : sa, 7: ub ? ua%ub : ua };
      for (const f of [0,4,5,6,7]) expect(run([R(word?0x3b:0x33,f,1)],a,b).value).toBe(BigInt.asIntN(bits,results[f]!));
    }
  });
  it('computes all three high multiply variants using 32-bit limbs', () => {
    const values = [0n,1n,-1n,-(1n<<63n),(1n<<63n)-1n,0x123456789abcdefn,0xffffffffn];
    for (const a of values) for (const b of values) for (const f of [1,2,3]) {
      const left = f === 3 ? BigInt.asUintN(64,a) : a;
      const right = f === 1 ? b : BigInt.asUintN(64,b);
      expect(run([R(0x33,f,1)],a,b).value).toBe(BigInt.asIntN(64,(left*right)>>64n));
    }
  });
  it('continues a trace at a forward jal target with the exact link and PC', () => {
    // addi x3,x1,1; jal x5,+12; (skipped) addi x3,x3,100 x2; addi x3,x3,2; addi x6,x0,7
    const jal = (rd: number, offset: number) => ((offset>>20&1)<<31 | (offset>>1&1023)<<21 | (offset>>11&1)<<20 | (offset>>12&255)<<12 | rd<<7 | 0x6f) >>> 0;
    const memory = new WebAssembly.Memory({ initial: 1 }); const regs = new BigUint64Array(memory.buffer);
    regs[1] = 10n; const frame = new BigUint64Array(memory.buffer, 256, 24);
    const words = [0x00108193, 4, jal(5, 12), 4, 0x00218193, 4, 0x00700313, 4];
    const instance = new WebAssembly.Instance(new WebAssembly.Module(compileBatch([{ id: 1, pc: 0x80000000n, words }])), { env: { memory } });
    (instance.exports.b1 as (r: number, p: number) => void)(0, 256);
    expect(regs[3]).toBe(13n); expect(regs[5]).toBe(0x80000008n); expect(regs[6]).toBe(7n);
    expect(frame[0]).toBe(0x80000018n); expect(frame[1]).toBe(4n);
  });
  it('branches relative to the exact guest PC and reads JALR before writing its source', () => {
    expect(run([0x00208463],4n,4n).pc).toBe(0x80000008n);
    expect(run([0x00208463],4n,5n).pc).toBe(0x80000004n);
    const r = run([0x000081e7],0x1235n); expect(r.pc).toBe(0x1234n); expect(r.value).toBe(0x80000004n);
  });
});

describe('generated direct-mapped TLB memory path', () => {
  function fixture(words: number[], fault?: string) {
    const memory = new WebAssembly.Memory({initial:1}), regs = new BigUint64Array(memory.buffer), view = new DataView(memory.buffer);
    const satp = 0x8000000000000001n;
    regs[1]=0x4000n; regs[2]=0xfedcba9876543210n;
    [0n,0n,8192n,4096n,1024n,2048n,4096n,1n,satp,0n].forEach((n,i)=>regs[32+i]=n);
    for (const base of [1024,2048]) {
      const entry=base+4*40;
      [4n,0x80000000n,1n,satp].forEach((n,i)=>view.setBigUint64(entry+i*8,n,true));
      view.setUint8(entry+32,1);view.setUint8(entry+33,1);
      if(fault==='tag') view.setBigUint64(entry,5n,true);
      if(fault==='pmp') view.setUint8(entry+33,0);
      if(fault==='satp') view.setBigUint64(entry+24,0n,true);
      if(fault==='context') view.setBigUint64(entry+16,0n,true);
      if(fault==='mmio') view.setBigUint64(entry+8,0x10000000n,true);
    }
    if(fault==='alignment') regs[1]++;
    if(fault==='code') view.setUint8(4096,1);
    view.setBigUint64(8192,0xdeadbeef01234567n,true);
    const module = new WebAssembly.Module(compileBatch([{id:1,pc:0x80000000n,words:words.flatMap(i=>[i,4])}]));
    const slow=(_cpu:number,_ins:number,_raw:number,_len:number,pc:bigint,_frame:number)=>{regs[32]=pc;regs[43]=1n;};
    const instance = new WebAssembly.Instance(module,{env:{memory,slow}});
    (instance.exports.b1 as (r:number,p:number)=>void)(0,256);
    return {regs,view};
  }
  it('loads and stores directly on an authorized RAM hit',()=>{
    const load=fixture([0x0000b183]);expect(load.regs[3]).toBe(0xdeadbeef01234567n);expect(load.regs[33]).toBe(1n); expect(load.regs[45]).toBe(1n); expect(load.regs[46]).toBe(0n);
    const store=fixture([0x0020b023]);expect(store.view.getBigUint64(8192,true)).toBe(0xfedcba9876543210n);expect(store.regs[41]).toBe(1n);
  });
  it('spills the exact prefix and fault PC before slow-path dispatch',()=>{
    for(const fault of ['tag','pmp','satp','context','mmio','alignment']) {
      const r=fixture([0x00700193,0x0000b203],fault);
      expect(r.regs[3]).toBe(7n);expect(r.regs[4]).toBe(0n);expect(r.regs[32]).toBe(0x80000004n);expect(r.regs[33]).toBe(2n);expect(r.regs[43]).toBe(1n);
      if (['tag','pmp','satp','context'].includes(fault)) { expect(r.regs[45]).toBe(1n); expect(r.regs[46]).toBe(1n); }
    }
    const r=fixture([0x0020b023],'code');expect(r.regs[33]).toBe(1n);expect(r.view.getBigUint64(8192,true)).toBe(0xdeadbeef01234567n);
  });
});

describe('budgeted internal backedges',()=>{
  function loop(budget:number) {
    const memory=new WebAssembly.Memory({initial:1}), regs=new BigUint64Array(memory.buffer);
    regs[1]=3n;regs[42]=BigInt(budget); // frame[10] at byte 256+80
    const module=new WebAssembly.Module(compileBatch([{id:1,pc:0x80000000n,words:[0xfff08093,4,0xfe009ee3,4]}]));
    const instance=new WebAssembly.Instance(module,{env:{memory}});
    (instance.exports.b1 as (r:number,p:number)=>void)(0,256);return regs;
  }
  it('loops with locals live and exits on the guest condition',()=>{
    const r=loop(64);expect(r[1]).toBe(0n);expect(r[33]).toBe(6n);expect(r[32]).toBe(0x80000008n);
  });
  it('exits before exhausting the interrupt budget',()=>{
    const r=loop(4);expect(r[1]).toBe(1n);expect(r[33]).toBe(4n);expect(r[32]).toBe(0x80000000n);
  });
});

it('spills registers written in a previous loop iteration on an early TLB miss',()=>{
  const memory=new WebAssembly.Memory({initial:1}),r=new BigUint64Array(memory.buffer),v=new DataView(memory.buffer);
  const satp=0x8000000000000001n;r[1]=0x4ff8n;r[2]=3n;
  [0n,0n,8192n,4096n,1024n,2048n,4096n,1n,satp,0n,64n].forEach((n,i)=>r[32+i]=n);
  [4n,0x80000000n,1n,satp].forEach((n,i)=>v.setBigUint64(1024+160+i*8,n,true));
  v.setUint8(1024+160+32,1);v.setUint8(1024+160+33,1);v.setBigUint64(8192+4088,123n,true);
  const off=-12;const branch=((off>>>12&1)<<31|(off>>>5&63)<<25|2<<20|4<<15|1<<12|(off>>>1&15)<<8|(off>>>11&1)<<7|0x63)>>>0;
  const words=[0x0000b183,0x00808093,0x00120213,branch].flatMap(i=>[i,4]);
  const instance=new WebAssembly.Instance(new WebAssembly.Module(compileBatch([{id:1,pc:0x80000000n,words}])),{env:{memory,slow:(_c:number,_i:number,_r:number,_l:number,pc:bigint)=>{r[32]=pc;r[43]=1n;}}});
  (instance.exports.b1 as (r:number,p:number)=>void)(0,256);
  expect(r[1]).toBe(0x5000n);expect(r[3]).toBe(123n);expect(r[4]).toBe(1n);expect(r[33]).toBe(5n);expect(r[32]).toBe(0x80000000n);
});

it('terminates A/F/D blocks through the exact wasm helper after spilling the prefix',()=>{
  const memory=new WebAssembly.Memory({initial:1}),r=new BigUint64Array(memory.buffer);r[1]=5n;r[44]=123n;
  const instruction=0x0000b207;
  const module=new WebAssembly.Module(compileBatch([{id:7,pc:0x80000000n,words:[0x00108193,4,instruction,2],raw:[0x00108193,0x2000]}]));
  let called=false;
  const slow=(cpu:number,ins:number,raw:number,len:number,pc:bigint,frame:number)=>{
    called=true;expect([cpu,ins,raw,len,pc,frame]).toEqual([123,instruction,0x2000,2,0x80000004n,256]);
    expect(r[3]).toBe(6n);expect(r[33]).toBe(2n);r[3]=999n;r[32]=pc+BigInt(len);
  };
  const instance=new WebAssembly.Instance(module,{env:{memory,slow}});
  (instance.exports.b7 as (r:number,p:number)=>void)(0,256);
  expect(called).toBe(true);expect(r[3]).toBe(999n);expect(r[32]).toBe(0x80000006n);
});
it('runs Zicsr and FENCE.I through the helper and compiles FENCE as a no-op',()=>{
  const memory=new WebAssembly.Memory({initial:1}),r=new BigUint64Array(memory.buffer);r[1]=5n;
  // addi x3,x1,1; fence rw,rw; csrrs x4,sstatus,x0
  const csr=0x10002273;
  const module=new WebAssembly.Module(compileBatch([{id:8,pc:0x80000000n,words:[0x00108193,4,0x0330000f,4,csr,4]}]));
  const calls:number[]=[];
  const slow=(_cpu:number,ins:number,_raw:number,_len:number,pc:bigint)=>{calls.push(ins);expect(pc).toBe(0x80000008n);expect(r[3]).toBe(6n);expect(r[33]).toBe(3n);r[4]=42n;r[32]=pc+4n;};
  (new WebAssembly.Instance(module,{env:{memory,slow}}).exports.b8 as (r:number,p:number)=>void)(0,256);
  expect(calls).toEqual([csr]);expect(r[4]).toBe(42n);expect(r[32]).toBe(0x8000000cn);
  const fenceI=new WebAssembly.Module(compileBatch([{id:9,pc:0x80000000n,words:[0x0000100f,4]}]));
  let seen=0;(new WebAssembly.Instance(fenceI,{env:{memory,slow:(_c:number,ins:number)=>{seen=ins;}}}).exports.b9 as (r:number,p:number)=>void)(0,256);
  expect(seen).toBe(0x100f);
});
