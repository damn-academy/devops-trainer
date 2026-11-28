// Uses the locally staged wasm; rebuild it before running the fixed regression.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { atomicModule, SharedHartMemory, HartMailboxes, sharedAccessModule, sharedTable, lockBase, LOCK_STRIDE, type SharedAccessExports } from '../src/engine/rv64/smp';

// The core binds its `rv64shared` imports once per module instance, while each
// test builds new memories; forward to the bus of the current test.
let bus: SharedAccessExports | undefined;
(globalThis as { rv64SharedImports?: unknown }).rv64SharedImports = {
  load: (o: number, n: number) => bus!.load(o, n), store: (o: number, n: number, v: bigint) => bus!.store(o, n, v),
  fetch: (o: number) => bus!.fetch(o), generation: (p: number) => bus!.generation(p), cas: (o: number, e: bigint, v: bigint) => bus!.cas(o, e, v), mark: (p: number) => bus!.mark(p),
};
let locks = 0;
// smp_configure plus the hart's store lock, as smp-cpu.worker does.
function configure(core: { smp_configure(h: number, b: number): void; smp_store_lock(o: number): void }, hart: number, bytes: number) {
  core.smp_configure(hart, bytes); core.smp_store_lock(locks + hart * LOCK_STRIDE);
}
function attachBus(memory: WebAssembly.Memory, generations: WebAssembly.Memory, granules: WebAssembly.Memory) {
  const pages = (m: WebAssembly.Memory) => m.buffer.byteLength / 65536;
  locks = lockBase(granules.buffer.byteLength, memory.buffer.byteLength);
  bus = new WebAssembly.Instance(sharedAccessModule(pages(memory), pages(generations), pages(granules)), { env: { ram: memory, generations, granules } }).exports as unknown as SharedAccessExports;
}
import { compileBatch } from '../src/engine/rv64/jit-compiler';

it.skipIf(process.env.RV64_SMP_JIT !== '1')('retains hot physical code across remote translation fences', async () => {
  const url = new URL('../public/rv64/rv64_core.js', import.meta.url).href;
  const mod = await import(/* @vite-ignore */ url);
  const wasm = await mod.default({ module_or_path: readFileSync(process.env.RV64_SMP_JIT_WASM ?? new URL('../public/rv64/rv64_core_bg.wasm', import.meta.url)) });
  const samples = [];
  for (const harts of [1, 2]) {
    const bytes = 32 * 1024 * 1024, pages = bytes / 65536 + 1;
    const memory = new WebAssembly.Memory({ initial: pages, maximum: pages, shared: true });
    const generationTable = sharedTable(bytes / 4096 * 4), generations = new Int32Array(generationTable.buffer);
    const granuleTable = sharedTable(Math.ceil(memory.buffer.byteLength / 128) * 4), granules = new Int32Array(granuleTable.buffer);
    attachBus(memory, generationTable, granuleTable);
    const ram = new SharedHartMemory(memory, atomicModule(pages), generations, granules);
    const bus = new HartMailboxes(harts);
    Object.assign(globalThis, {
      rv64SharedAccess: (op: number, off: number, size: 1|2|4|8, value: bigint) => {
        if (op === 0) return BigInt.asUintN(size * 8, ram.load(off + 64, size));
        if (op === 1) { ram.store(off + 64, size, value); return 0n; }
        throw Error(`unexpected shared operation ${op}`);
      },
    });
    // addi t0,t0,1; jal x0,-4. No OS, clocks, data stores or external compiler.
    ram.store(64, 4, 0x00128293n); ram.store(68, 4, 0xffdff06fn);
    const cores = Array.from({ length: harts }, (_, hart) => {
      const core = new mod.Engine(32); configure(core, hart, bytes);
      core.smp_start(0x80000000n, 0n); core.jit_threshold(1); return core;
    });
    const counts = cores.map(() => 0), busy = cores.map(() => 0);
    const table = cores[0].jit_table(); const slots: number[] = [];
    try {
      for (let round = 0; round < 20; round++) for (let hart = 0; hart < harts; hart++) {
        const core = cores[hart];
        if (harts > 1) {
          const tickets = bus.remoteFence(1n << BigInt(hart), 0n, 'translation');
          bus.service(hart, () => core.smp_fence(), () => core.smp_sfence ? core.smp_sfence() : core.smp_fence());
          expect(tickets.every(t => bus.completed(t))).toBe(true);
        }
        const queue: any[] = [];
        Object.assign(globalThis, { rv64Compile: (id: number, pc: bigint, words: Uint32Array, raw: Uint32Array) => queue.push({ id, pc, words: [...words], raw: [...raw] }) });
        const target = core.retired() + 100000, start = performance.now();
        while (core.retired() < target) {
          core.smp_run(Math.min(2048, target - core.retired()), 0, 0n);
          if (queue.length) {
            const blocks = queue.splice(0);
            const instance = new WebAssembly.Instance(new WebAssembly.Module(compileBatch(blocks)), { env: { memory: wasm.memory, slow: wasm.jit_slow } });
            for (const b of blocks) {
              const slot = table.grow(1); slots.push(slot); table.set(slot, instance.exports[`b${b.id}`]);
              core.jit_install(b.id, slot, b.words.length / 2); counts[hart]++;
            }
          }
        }
        busy[hart]! += performance.now() - start;
      }
      for (const [hart, core] of cores.entries()) samples.push({ harts, hart, compiled: counts[hart], retired: core.retired(), jitRetired: core.jit_retired(), busyMips: core.retired() / busy[hart]! / 1000, counters: JSON.parse(core.metrics()) });
    } finally { slots.forEach(slot => table.set(slot, null)); cores.forEach(core => core.free()); }
  }
  console.log('SMP_JIT_REPRO ' + JSON.stringify(samples));
  for (const sample of samples) {
    expect(sample.compiled).toBe(1);
    expect(sample.counters.jit_cache_clears).toBe(0);
  }
}, 30000);

for (const modifyCode of [false, true]) it.skipIf(process.env.RV64_SMP_JIT !== '1')(
  modifyCode ? 'executes code written by hart A after its SBI remote fence.i ACK' : 'retains hart B compiled code across an unrelated SBI remote fence.i', async () => {
    const mod = await import(/* @vite-ignore */ new URL('../public/rv64/rv64_core.js', import.meta.url).href);
    const wasm = await mod.default({ module_or_path: readFileSync(process.env.RV64_SMP_JIT_WASM ?? new URL('../public/rv64/rv64_core_bg.wasm', import.meta.url)) });
    const bytes = 32 * 1024 * 1024, pages = bytes / 65536 + 1;
    const memory = new WebAssembly.Memory({ initial: pages, maximum: pages, shared: true });
    const generationTable = sharedTable(bytes / 4096 * 4), generations = new Int32Array(generationTable.buffer);
    const granuleTable = sharedTable(Math.ceil(memory.buffer.byteLength / 128) * 4), granules = new Int32Array(granuleTable.buffer);
    attachBus(memory, generationTable, granuleTable);
    const module = atomicModule(pages);
    const ram = [new SharedHartMemory(memory, module, generations, granules), new SharedHartMemory(memory, module, generations, granules)];
    const bus = new HartMailboxes(2);
    let active = 0;
    const queue: any[] = [];
    Object.assign(globalThis, {
      rv64SharedAccess: (op: number, off: number, size: 1|2|4|8, value: bigint) => {
        if (op === 0) return BigInt.asUintN(size * 8, ram[active]!.load(off + 64, size));
        if (op === 1) { ram[active]!.store(off + 64, size, value); return 0n; }
        throw Error(`unexpected shared operation ${op}`);
      },
      rv64Compile: (id: number, pc: bigint, words: Uint32Array, raw: Uint32Array) => queue.push({ id, pc, words: [...words], raw: [...raw] }),
    });
    const put = (off: number, words: number[]) => words.forEach((word, i) => ram[0]!.store(64 + off + i * 4, 4, BigInt(word)));
    // B: publish 1 (later 2) on a separate data page, then loop.
    put(0, [0x00100293, 0x00001317, 0x00533223, 0xff5ff06f]);
    // A: write new instruction to B's code, or to unrelated page 3;
    // fence rw,rw; SBI RFENCE fid=0, mask=2, base=0; ecall.
    put(0x2000, [modifyCode ? 0xffffe297 : 0x00001297, 0x00200337, 0x29330313,
      0x0062a023, 0x0330000f, 0x00200513, 0x00000593, 0x00000813,
      0x524658b7, 0xe4388893, 0x00000073]);
    const cores = [0, 1].map(hart => {
      const core = new mod.Engine(32); configure(core, hart, bytes);
      core.smp_start(hart ? 0x80000000n : 0x80002000n, 0n);
      core.jit_threshold(hart ? 1 : 0); return core;
    });
    const b = cores[1], table = b.jit_table(), slots: number[] = [];
    let compiled = 0;
    const runB = () => {
      active = 1;
      const target = b.retired() + 1000;
      for (let tries = 0; b.retired() < target && tries < 1000; tries++) {
        b.smp_run(Math.min(64, target - b.retired()), 0, 0n);
        if (queue.length) {
          const blocks = queue.splice(0);
          const instance = new WebAssembly.Instance(new WebAssembly.Module(compileBatch(blocks)), { env: { memory: wasm.memory, slow: wasm.jit_slow } });
          for (const block of blocks) {
            const slot = table.grow(1); slots.push(slot); table.set(slot, instance.exports[`b${block.id}`]);
            b.jit_install(block.id, slot, block.words.length / 2); compiled++;
          }
        }
      }
      expect(b.retired()).toBe(target);
    };
    try {
      runB();
      expect(b.test_read(0x80001008n)).toBe(1n);
      expect(b.jit_retired()).toBeGreaterThan(0);
      const before = compiled, version = Atomics.load(generations, 0);
      expect(before).toBeGreaterThan(0);
      active = 0; cores[0].smp_run(100, 0, 0n);
      const [ext, fid, mask, base] = Array.from(cores[0].smp_request()) as bigint[];
      expect([ext, fid, mask, base]).toEqual([0x52464e43n, 0n, 2n, 0n]);
      // The guest store has published its generation BEFORE request and ACK.
      expect(Atomics.load(generations, 0)).toBe(version + Number(modifyCode));
      const tickets = bus.remoteFence(mask!, base!, 'instruction');
      expect(tickets.every(t => bus.completed(t))).toBe(false);
      active = 1;
      bus.service(1, () => {
        expect(tickets.every(t => bus.completed(t))).toBe(false);
        expect(Atomics.load(generations, 0)).toBe(version + Number(modifyCode));
        b.smp_fence();
      }, () => { throw Error('unexpected translation fence'); });
      expect(tickets.every(t => bus.completed(t))).toBe(true);
      cores[0].smp_reply(0n, 0n);
      runB();
      expect(b.test_read(0x80001008n)).toBe(modifyCode ? 2n : 1n);
      const counters = JSON.parse(b.metrics());
      expect(counters.remote_fence_i).toBe(1);
      expect(counters.jit_cache_clears).toBe(0);
      expect(counters.invalidations.remote_fence_i).toBe(0);
      if (modifyCode) expect(compiled).toBeGreaterThan(before);
      else expect(compiled).toBe(before);
      b.jit_clear();
      expect(JSON.parse(b.metrics()).invalidations.explicit_clear).toBe(1);
    } finally { slots.forEach(slot => table.set(slot, null)); cores.forEach(core => core.free()); }
  }, 30000);

it.skipIf(process.env.RV64_SMP_JIT !== '1')('publishes an inline SMP code store before SBI RFENCE ACK and resumes guarded chains', async () => {
  const { compileChainDispatcher } = await import('../src/engine/rv64/jit-compiler');
  const mod = await import(/* @vite-ignore */ new URL('../public/rv64/rv64_core.js', import.meta.url).href);
  const wasm = await mod.default({ module_or_path: readFileSync(process.env.RV64_SMP_JIT_WASM ?? new URL('../public/rv64/rv64_core_bg.wasm', import.meta.url)) });
  const bytes = 32 * 1024 * 1024, pages = bytes / 65536 + 1;
  const memory = sharedTable(pages * 65536), generations = sharedTable(bytes / 4096 * 4);
  const granules = sharedTable(Math.ceil(memory.buffer.byteLength / 128) * 4);
  attachBus(memory, generations, granules);
  const gens = new Int32Array(generations.buffer);
  const ram = [0,1].map(() => new SharedHartMemory(memory, atomicModule(pages), gens, new Int32Array(granules.buffer)));
  const layout = { bytes, ramPages: pages, generationPages: generations.buffer.byteLength / 65536, granulePages: granules.buffer.byteLength / 65536 };
  let active = 0;
  const queues: any[][] = [[],[]], slots: number[] = [], bus = new HartMailboxes(2);
  Object.assign(globalThis, {
    rv64SharedAccess: (op: number, off: number, size: 1|2|4|8, value: bigint) => {
      if (op === 0) return BigInt.asUintN(size*8,ram[active]!.load(off+64,size));
      if (op === 1) { ram[active]!.store(off+64,size,value); return 0n; }
      throw Error(`unexpected shared operation ${op}`);
    },
    rv64Compile: (id: number, pc: bigint, words: Uint32Array, raw: Uint32Array) => queues[active]!.push({id,pc,words:[...words],raw:[...raw]}),
  });
  const put = (off: number, words: number[]) => words.forEach((word,i) => ram[0]!.store(64+off+i*4,4,BigInt(word>>>0)));
  const jal = (offset: number) => ((offset>>20&1)<<31 | (offset>>1&1023)<<21 | (offset>>11&1)<<20 | (offset>>12&255)<<12 | 0x6f) >>> 0;
  // Sv39 identity gigapage. A/D are pre-set; both supervisor harts use it.
  ram[0]!.store(64+0x10000+2*8,8,0x200000cfn);
  for (const [boot,target] of [[0x2000,0],[0x3000,0x4000]]) {
    const prefix = [0x00000297,0x0202b283,0x18029073,0x12000073];
    // Prime A's write TLB for B's page without changing B's instructions.
    // Otherwise changing the target pointer would first take the cold helper.
    if (boot === 0x3000) prefix.push(0xffffd317,0x0e032823); // sw zero,240(t1) at RAM+256
    put(boot!,[...prefix,jal(target!-boot!-prefix.length*4)]);
    ram[0]!.store(64+boot!+32,8,0x8000000000080010n);
  }
  // B's two blocks live on different pages and chain through the fetch TLB.
  put(0,[0x00100293,0x00005317,0x00533223,jal(4096-12)]);
  put(4096,[jal(-4096)]);
  // A warms its generated store on unrelated page 7, polling control page 6.
  // Once the host changes pointer+flag, that same inline store rewrites B and
  // A orders it before issuing the guest SBI remote fence.i request.
  put(0x4000,[0x00002417,0x00043283,0x00200337,0x29330313,0x0062a023,
    0x00843383,0xfe0386e3,0x0330000f,0x00200513,0x00000593,
    0x00000813,0x524658b7,0xe4388893,0x00000073]);
  ram[0]!.store(64+0x6000,8,0x80007000n);
  const cores = [0,1].map(hart => {
    const core = new mod.Engine(32);
    expect(core.smp_jit_abi?.(), 'rebuild R9 WASM before this gate').toBe(9);
    configure(core, hart, bytes); core.smp_start(hart ? 0x80002000n : 0x80003000n,0n); core.jit_threshold(1); return core;
  });
  const table = cores[0].jit_table();
  const env = {memory:wasm.memory,ram:memory,generations,granules,table,slow:wasm.jit_slow};
  const dispatcher = new WebAssembly.Instance(new WebAssembly.Module(compileChainDispatcher(layout)),{env});
  const run = (hart: number) => {
    active = hart; const core = cores[hart]; core.smp_run(128,0,0n);
    const blocks = queues[hart]!.splice(0);
    if (blocks.length) {
      const instance = new WebAssembly.Instance(new WebAssembly.Module(compileBatch(blocks,true,layout)),{env:{...env,next:dispatcher.exports.next}});
      for (const b of blocks) {
        const slot = table.grow(1); slots.push(slot); table.set(slot,instance.exports[`b${b.id}`]); core.jit_install(b.id,slot,b.words.length/2);
      }
    }
  };
  try {
    for (let n=0;n<50;n++) { run(0); run(1); }
    expect(cores[1].test_read(0x80005008n)).toBe(1n);
    const before = JSON.parse(cores[0].metrics());
    expect(before.smp_inline_stores).toBeGreaterThan(0);
    expect(JSON.parse(cores[1].metrics()).smp_jit_chains).toBeGreaterThan(0);
    const generation = Atomics.load(gens,0);
    ram[0]!.store(64+0x6000,8,0x80000000n);
    for (let n=0;n<100 && Atomics.load(gens,0)===generation;n++) run(0);
    expect(Atomics.load(gens,0)).toBeGreaterThan(generation);
    ram[0]!.store(64+0x6008,8,1n);
    let request: bigint[] = [];
    for (let n=0;n<100 && !request.length;n++) { run(0); request = Array.from(cores[0].smp_request()); }
    expect(request.slice(0,4)).toEqual([0x52464e43n,0n,2n,0n]);
    expect(Atomics.load(gens,0)).toBeGreaterThan(generation);
    expect(JSON.parse(cores[0].metrics()).smp_inline_stores).toBeGreaterThan(before.smp_inline_stores);
    expect(JSON.parse(cores[0].metrics()).memory_helpers).toBe(before.memory_helpers);
    const tickets = bus.remoteFence(2n,0n,'instruction');
    bus.service(1,()=>{ expect(bus.completed(tickets[0]!)).toBe(false); cores[1].smp_fence(); },()=>{});
    expect(bus.completed(tickets[0]!)).toBe(true); cores[0].smp_reply(0n,0n);
    const chains = JSON.parse(cores[1].metrics()).smp_jit_chains;
    for (let n=0;n<50;n++) run(1);
    expect(cores[1].test_read(0x80005008n)).toBe(2n);
    expect(JSON.parse(cores[1].metrics()).smp_jit_chains).toBeGreaterThan(chains);
    expect(JSON.parse(cores[1].metrics()).jit_cache_clears).toBe(0);
  } finally { slots.forEach(slot=>table.set(slot,null)); cores.forEach(core=>core.free()); }
},30000);

it.skipIf(process.env.RV64_SMP_JIT !== '1')('samples nonzero comm and valid user stack words from shared SMP RAM', async () => {
  const mod = await import(/* @vite-ignore */ new URL('../public/rv64/rv64_core.js', import.meta.url).href);
  await mod.default({ module_or_path: readFileSync(process.env.RV64_SMP_JIT_WASM ?? new URL('../public/rv64/rv64_core_bg.wasm', import.meta.url)) });
  const bytes = 32 * 1024 * 1024, pages = bytes / 65536 + 1;
  const memory = new WebAssembly.Memory({ initial: pages, maximum: pages, shared: true });
  const generationTable = sharedTable(bytes / 4096 * 4), generations = new Int32Array(generationTable.buffer);
  const granuleTable = sharedTable(Math.ceil(memory.buffer.byteLength / 128) * 4), granules = new Int32Array(granuleTable.buffer);
  attachBus(memory, generationTable, granuleTable);
  const ram = new SharedHartMemory(memory, atomicModule(pages), generations, granules);
  Object.assign(globalThis, {
    rv64SharedAccess: (op: number, off: number, size: 1|2|4|8, value: bigint) => {
      if (op === 0) return BigInt.asUintN(size * 8, ram.load(off + 64, size));
      if (op === 1) { ram.store(off + 64, size, value); return 0n; }
      throw Error(`unexpected shared operation ${op}`);
    },
  });
  // Sv39: supervisor identity + high kernel alias, user low gigapage.
  const pte = 0x200000cfn;
  ram.store(64 + 0x10000, 8, pte | 16n);
  ram.store(64 + 0x10000 + 2 * 8, 8, pte);
  ram.store(64 + 0x10000 + 510 * 8, 8, pte);
  const ld = (rd: number, offset: number) => (offset << 20 | 5 << 15 | 3 << 12 | rd << 7 | 3) >>> 0;
  const csrw = (csr: number, rs: number) => (csr << 20 | rs << 15 | 1 << 12 | 0x73) >>> 0;
  // S-mode boot: install SATP, sscratch task pointer, user SP/PC, then sret.
  const boot = [0x00000297, ld(6, 128), csrw(0x180, 6), ld(6, 136), csrw(0x140, 6),
    ld(2, 144), ld(6, 152), csrw(0x141, 6), csrw(0x100, 0), 0x10200073];
  boot.forEach((word, i) => ram.store(64 + i * 4, 4, BigInt(word)));
  [0x8000000000080010n, 0xffffffff80008000n, 0x6000n, 0x4000n].forEach((word, i) => ram.store(64 + 128 + i * 8, 8, word));
  ram.store(64 + 0x4000, 4, 0x0000006fn); // user jal x0,0
  const comm = 0x006c74636562756bn; // kubectl\0
  ram.store(64 + 0x8000 + 1704, 8, comm);
  for (let i = 0; i < 32; i++) ram.store(64 + 0x6000 + i * 8, 8, 0x12340000n + BigInt(i));
  const before = new Uint8Array(memory.buffer).slice(), versions = generations.slice();
  for (const hart of [0, 1]) {
    const core = new mod.Engine(32);
    try {
      configure(core, hart, bytes); core.smp_start(0x80000000n, 0n); core.jit_threshold(0);
      core.profile_configure(1); core.profile_task_comm(1704); core.smp_run(64, 0, 0n);
      const rows: string[][] = JSON.parse(core.profile_drain()).rows;
      const user = rows.filter(row => BigInt('0x' + row[2]) === 0n);
      expect(user.length).toBeGreaterThan(0);
      for (const row of user) {
        expect(row).toHaveLength(44);
        expect(BigInt('0x' + row[7])).toBe(comm);
        expect(BigInt('0x' + row[11])).toBe(0xffffffffn);
        for (let i = 0; i < 32; i++) expect(BigInt('0x' + row[12 + i])).toBe(0x12340000n + BigInt(i));
      }
    } finally { core.free(); }
  }
  expect(Buffer.from(memory.buffer).equals(Buffer.from(before))).toBe(true);
  expect(generations).toEqual(versions);
});

it.skipIf(process.env.RV64_SMP_JIT !== '1')('runs A compiled code on B and rejects it on both after rewrite and remote fence.i', async () => {
  const { SharedCodeCache } = await import('../src/engine/rv64/shared-code');
  const mod = await import(/* @vite-ignore */ new URL('../public/rv64/rv64_core.js', import.meta.url).href);
  const wasm = await mod.default({ module_or_path: readFileSync(process.env.RV64_SMP_JIT_WASM ?? new URL('../public/rv64/rv64_core_bg.wasm', import.meta.url)) });
  const bytes=32*1024*1024, pages=bytes/65536+1;
  const memory=sharedTable(pages*65536), generations=sharedTable(bytes/4096*4), granules=sharedTable(Math.ceil(memory.buffer.byteLength/128)*4);
  attachBus(memory,generations,granules);
  const gens=new Int32Array(generations.buffer);
  const ram=new SharedHartMemory(memory,atomicModule(pages),gens,new Int32Array(granules.buffer));
  const layout={bytes,ramPages:pages,generationPages:generations.buffer.byteLength/65536,granulePages:granules.buffer.byteLength/65536};
  const queues:any[][]=[[],[]];let active=0;
  Object.assign(globalThis,{
    rv64SharedAccess:(op:number,off:number,size:1|2|4|8,value:bigint)=>{
      if(op===0)return BigInt.asUintN(size*8,ram.load(off+64,size));
      if(op===1){ram.store(off+64,size,value);return 0n;}throw Error('unexpected shared op');
    },
    rv64Compile:(id:number,pc:bigint,words:Uint32Array,raw:Uint32Array,pa:bigint,generation:bigint)=>queues[active]!.push({id,pc,words:[...words],raw:[...raw],pa,generation}),
  });
  ram.store(64,4,0x00100293n);ram.store(68,4,0xffdff06fn);
  const cores=[0,1].map(hart=>{const core=new mod.Engine(32);expect(core.jit_share_abi?.()).toBe(12);configure(core, hart, bytes);core.smp_start(0x80000000n,0n);core.jit_threshold(1);return core;});
  const table=cores[0].jit_table(),slots:number[]=[];
  const installed = [new Map<number, { ids: number[]; slots: number[] }>(), new Map<number, { ids: number[]; slots: number[] }>()];
  let revokeCalls = 0;
  const cache=new SharedCodeCache(async(hart, serials)=>{
    revokeCalls++;
    for (const serial of serials) {
      const batch = installed[hart]!.get(serial);
      if (!batch) continue;
      cores[hart].jit_evict(new Uint32Array(batch.ids));
      for (const slot of batch.slots) table.set(slot, null);
      installed[hart]!.delete(serial);
    }
    expect([...installed[hart]!.keys()].some(serial => serials.includes(serial))).toBe(false);
  });cache.budget=1024*1024;
  const run=async(hart:number)=>{
    active=hart;const core=cores[hart],target=core.retired()+100;
    for(let tries=0;core.retired()<target&&tries<200;tries++){
      core.smp_run(Math.min(16,target-core.retired()),0,0n);
      if(queues[hart]!.length){
        const reply=await cache.request(hart,queues[hart]!.splice(0),layout,false);
        for(const group of reply.groups){
          const instance=new WebAssembly.Instance(structuredClone(group.module),{env:{memory:wasm.memory,ram:memory,generations,granules,slow:wasm.jit_slow}});
          const batch = installed[hart]!.get(group.serial) ?? { ids: [], slots: [] };
          installed[hart]!.set(group.serial, batch);
          for(const b of group.blocks){const slot=table.grow(1);slots.push(slot);batch.ids.push(b.id);batch.slots.push(slot);table.set(slot,instance.exports[`b${b.exportId}`]);core.jit_install(b.id,slot,b.count);}
        }
      }
    }
    expect(core.retired()).toBe(target);expect(core.jit_retired()).toBeGreaterThan(0);
  };
  try{
    await run(0);const compiled=cache.compiled;await run(1);
    expect(cache.compiled).toBe(compiled);expect(cache.hits).toBeGreaterThan(0);
    for(const core of cores)expect(core.register(5)).toBe(1n);
    ram.store(64,4,0x00200293n);
    const bus=new HartMailboxes(2),tickets=bus.remoteFence(3n,0n,'instruction');
    for(const hart of [0,1])bus.service(hart,()=>cores[hart].smp_fence(),()=>{});
    expect(tickets.every(t=>bus.completed(t))).toBe(true);
    await run(0);await run(1);
    expect(cache.compiled).toBeGreaterThan(compiled);
    for(const core of cores){expect(core.register(5)).toBe(2n);expect(JSON.parse(core.metrics()).jit_cache_clears).toBe(0);}
    // Modules unpin at different ticks, so a trim may take several batches;
    // each batch must still send exactly one revoke per holding hart.
    const revokesBefore = revokeCalls, batchesBefore = cache.stats().revokeBatches;
    cache.budget = 0; await cache.trim();
    const batches = cache.stats().revokeBatches - batchesBefore;
    expect(batches).toBeGreaterThan(0);
    expect(revokeCalls - revokesBefore).toBe(2 * batches);
    expect(cache.stats().estimatedHostBytes).toBe(0);
    expect(slots.every(slot => table.get(slot) === null)).toBe(true);
    cache.budget = 1024*1024; await run(0); await run(1);
    for (const core of cores) {
      expect(core.register(5)).toBe(2n);
      expect(JSON.parse(core.metrics()).jit_cache_clears).toBe(0);
    }
  }finally{slots.forEach(slot=>table.set(slot,null));cores.forEach(core=>core.free());}
});
