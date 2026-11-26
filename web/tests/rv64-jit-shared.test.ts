import { expect, it } from 'vitest';
import { compileBatch, compileChainDispatcher, type SharedJitLayout } from '../src/engine/rv64/jit-compiler';
import { atomicModule, sharedTable, SharedHartMemory, HartMailboxes } from '../src/engine/rv64/smp';

function fixture() {
  const memory = new WebAssembly.Memory({ initial: 64 });
  const ram = sharedTable(65536), generations = sharedTable(64), granules = sharedTable(2048);
  const layout: SharedJitLayout = { bytes: 32768, ramPages: 1, generationPages: 1, granulePages: 1 };
  const env = { memory, ram, generations, granules };
  const regs = new BigUint64Array(memory.buffer), view = new DataView(memory.buffer);
  const satp = 0x8000000000000001n;
  const frame = [0x4000n,0n,0n,0n,1024n,2048n,0n,1n,satp,0n,10000n,0n,0n,0n,0n,3072n,12000n,65536n,1n,0n,13000n,77n,0n,0n];
  frame.forEach((n,i) => regs[32+i] = n);
  for (const base of [1024,2048,3072]) for (let page = 4; page < 6; page++) {
    const entry = base + page * 40;
    [BigInt(page),0x80000000n+BigInt(page-4)*4096n,1n,satp].forEach((n,i) => view.setBigUint64(entry+i*8,n,true));
    view.setUint8(entry+32,1); view.setUint8(entry+33,1);
  }
  const bus = new SharedHartMemory(ram, atomicModule(1), new Int32Array(generations.buffer), new Int32Array(granules.buffer));
  let helpers = 0;
  const run = (words: number[], pc = 0x4000n) => {
    const binary = compileBatch([{ id: 1, pc, words: words.flatMap(i => [i,4]) }], false, layout);
    const instance = new WebAssembly.Instance(new WebAssembly.Module(binary), { env: { ...env, slow: () => { helpers++; } } });
    (instance.exports.b1 as Function)(0,256);
  };
  return { env, layout, regs, view, bus, run, helpers: () => helpers };
}

it('uses memory 1 for every integer width, with exact sign extension and no JS helpers', () => {
  const f = fixture();
  for (let width = 0; width < 4; width++) {
    f.regs[1] = 0x4008n; f.regs[2] = 0xfedcba987654ff80n;
    f.bus.store(64,8,0x1122334455667788n); f.bus.store(80,8,0x8877665544332211n);
    f.run([0x00208023 | width << 12]);
    const size = (1 << width) as 1|2|4|8;
    expect(BigInt.asUintN(size*8,f.bus.load(72,size))).toBe(BigInt.asUintN(size*8,f.regs[2]!));
    expect(f.bus.load(64,8)).toBe(0x1122334455667788n);
    expect(BigInt.asUintN(64,f.bus.load(80,8))).toBe(0x8877665544332211n);
    f.run([0x00008183 | width << 12]);
    expect(BigInt.asIntN(64,f.regs[3]!)).toBe(BigInt.asIntN(size*8,f.regs[2]!));
    if (width < 3) {
      f.run([0x00008183 | (width+4) << 12]);
      expect(f.regs[3]).toBe(BigInt.asUintN(size*8,f.regs[2]!));
    }
  }
  expect(f.helpers()).toBe(0);
  expect(f.regs[54]).toBe(7n); expect(f.regs[55]).toBe(4n);
  expect(Atomics.load(new Int32Array(f.env.ram.buffer),0)).toBe(0);
});

it('preserves LR/SC granules and serializes subword writes with helper AMOs/CAS', () => {
  const f = fixture(); f.regs[1] = 0x4000n; f.regs[2] = 42n;
  f.bus.store(64,8,1n); f.bus.lr(64,8); f.run([0x0020b023]);
  expect(f.bus.sc(64,8,9n)).toBe(false);
  f.bus.lr(64,8); f.regs[1] = 0x4100n; f.run([0x0020b023]);
  expect(f.bus.sc(64,8,9n)).toBe(true);
  f.regs[1] = 0x4001n; f.run([0x00208023]);
  expect(f.bus.cas(64,0x2a09n,7n)).toBe(0x2a09n);
  expect(f.bus.amo(64,8,'add',1n)).toBe(7n);
  expect(f.helpers()).toBe(0);
});

it('falls back before touching shared RAM on alignment, bounds, context or permission misses', () => {
  for (const fault of ['alignment','bounds','tag','pmp','context','satp']) {
    const f = fixture(); f.regs[1] = fault === 'alignment' ? 0x4001n : 0x4000n;
    f.regs[2] = 99n;
    for (const base of [1024,2048]) {
      const entry = base+4*40;
      if (fault === 'bounds') f.view.setBigUint64(entry+8,0x80008000n,true);
      if (fault === 'tag') f.view.setBigUint64(entry,6n,true);
      if (fault === 'pmp') f.view.setUint8(entry+33,0);
      if (fault === 'context') f.view.setBigUint64(entry+16,0n,true);
      if (fault === 'satp') f.view.setBigUint64(entry+24,0n,true);
    }
    f.run([0x0020b023]); f.run([0x0000b183]);
    expect(f.helpers(),fault).toBe(2);
    expect(f.bus.load(64,8)).toBe(0n);
    expect(f.regs[54]).toBe(0n); expect(f.regs[55]).toBe(0n);
  }
});

it('rejects a stale shared chain target after inline code write and remote fence.i ACK', () => {
  const f = fixture(), table = new WebAssembly.Table({ initial: 4, element: 'anyfunc' });
  const mailbox = new HartMailboxes(2), gen = new Int32Array(f.env.generations.buffer);
  const pc = 0x5000n, pa = 0x80001000n;
  f.bus.store(64+4096,4,0x00118193n); // addi x3,x3,1
  const dispatcher = new WebAssembly.Instance(new WebAssembly.Module(compileChainDispatcher(f.layout)), { env: { ...f.env, table } });
  const install = () => {
    const word = Number(BigInt.asUintN(32,f.bus.load(64+4096,4)));
    const module = new WebAssembly.Module(compileBatch([{id:1,pc,words:[word,4]}],true,f.layout));
    const instance = new WebAssembly.Instance(module,{env:{...f.env,next:dispatcher.exports.next}});
    table.set(1,instance.exports.b1 as any);
    const index = Number(((pa>>1n)^(pa>>17n)^(pc>>33n))&65535n), off = 65536+index*40;
    [pc,pa,BigInt(Atomics.load(gen,1)>>>0)].forEach((v,i)=>f.view.setBigUint64(off+i*8,v,true));
    f.view.setUint32(off+24,1,true); f.view.setUint32(off+28,1,true); f.view.setUint32(off+32,1,true);
  };
  const chain = () => { f.regs[32]=pc; (dispatcher.exports.next as Function)(0,256); };
  Atomics.store(gen,1,-1); // unsigned generation comparison and wrap to zero
  install(); chain(); expect(f.regs[3]).toBe(1n); expect(f.regs[51]).toBe(1n);
  // Hart A generated store rewrites B's target page. The private page cache
  // intentionally stays unchanged; chaining must read memory 2 atomically.
  const before = Atomics.load(gen,1);
  f.regs[1]=pc; f.regs[2]=0x00218193n; f.run([0x0020a023]);
  expect(f.regs[55]).toBe(1n); expect(f.helpers()).toBe(0);
  expect(Atomics.load(gen,1)).toBe(before+1);
  chain(); expect(f.regs[3]).toBe(1n); expect(f.regs[51]).toBe(1n);
  const tickets = mailbox.remoteFence(2n,0n,'instruction');
  mailbox.service(1,()=>{ expect(mailbox.completed(tickets[0]!)).toBe(false); expect(Atomics.load(gen,1)).toBe(before+1); },()=>{});
  expect(mailbox.completed(tickets[0]!)).toBe(true);
  chain(); expect(f.regs[3]).toBe(1n); expect(f.regs[51]).toBe(1n);
  install(); chain(); expect(f.regs[3]).toBe(3n); expect(f.regs[51]).toBe(2n);
});


it('chains shared targets across pages with a bounded budget and no stack growth', () => {
  const f=fixture(), table=new WebAssembly.Table({initial:3,element:'anyfunc'});
  const blocks=[{id:1,pc:0x4000n,words:[0x0000106f,4]}, {id:2,pc:0x5000n,words:[0x800ff06f,4]}];
  const dispatcher=new WebAssembly.Instance(new WebAssembly.Module(compileChainDispatcher(f.layout)),{env:{...f.env,table}});
  const instance=new WebAssembly.Instance(new WebAssembly.Module(compileBatch(blocks,true,f.layout)),{env:{...f.env,next:dispatcher.exports.next}});
  for (const b of blocks) {
    table.set(b.id,instance.exports['b'+b.id] as any);
    const pa=0x80000000n+b.pc-0x4000n, index=Number(((pa>>1n)^(pa>>17n)^(b.pc>>33n))&65535n), off=65536+index*40;
    [b.pc,pa,0n].forEach((v,i)=>f.view.setBigUint64(off+i*8,v,true));
    f.view.setUint32(off+24,b.id,true); f.view.setUint32(off+28,1,true); f.view.setUint32(off+32,b.id,true);
  }
  (instance.exports.b1 as Function)(0,256);
  expect(f.regs[33]).toBe(10000n); expect(f.regs[51]).toBe(9999n); expect(f.regs[32]).toBe(0x4000n);
});
