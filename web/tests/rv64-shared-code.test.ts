import { expect, it, vi } from 'vitest';
import { SharedCodeCache, codeKey, instanceCharge } from '../src/engine/rv64/shared-code';
import { jitCharge } from '../src/engine/rv64/host-memory';
import { sharedTable } from '../src/engine/rv64/smp';
const layout = { bytes: 32768, ramPages: 1, generationPages: 1, granulePages: 1 };
const block = (id = 1, generation = 1n, value = 7) => ({ id, pc: 0x80000000n, pa: 0x80000000n, generation, words: [(value << 20) | (3 << 7) | 0x13, 4] });
it('shares one compiled module, remaps IDs and binds separate hart memories', async () => {
  const compile = vi.fn((bytes: Uint8Array<ArrayBuffer>) => WebAssembly.compile(bytes));
  const cache = new SharedCodeCache(async () => {}, compile); cache.budget = 1024*1024;
  const a = await cache.request(0, [block(17)], layout, false);
  const b = await cache.request(1, [block(99)], layout, false);
  expect(compile).toHaveBeenCalledTimes(1);
  expect(b.groups[0]!.module).toBe(a.groups[0]!.module);
  expect(b.groups[0]!.blocks[0]).toEqual({id:99,exportId:0,count:1});
  const ram=sharedTable(65536), generations=sharedTable(65536), granules=sharedTable(65536);
  const memories=[new WebAssembly.Memory({initial:1}),new WebAssembly.Memory({initial:1})];
  const instances=memories.map(memory=>new WebAssembly.Instance(structuredClone(a.groups[0]!.module),{env:{memory,ram,generations,granules}}));
  (instances[0]!.exports.b0 as Function)(0,256);
  expect(new BigUint64Array(memories[1]!.buffer)[3]).toBe(0n);
  (instances[1]!.exports.b0 as Function)(0,256);
  expect(memories.map(memory=>new BigUint64Array(memory.buffer)[3])).toEqual([7n,7n]);
  expect(cache.stats().estimatedHostBytes).toBe(jitCharge(a.groups[0]!.byteLength,1)+2*instanceCharge(1));
  expect(cache.stats().sharedCodeHits).toBe(1);
  expect(cache.stats().crossHartCodeHits).toBe(1);
  cache.release(0); expect(cache.stats().instanceBytes).toBe(instanceCharge(1));
});
it('keys physical/virtual PC, generation and exact decoded/raw bytes, never hart IDs', () => {
  const b=block(); expect(codeKey(b,layout)).toBe(codeKey({...b,id:123},layout));
  for(const patch of [{pa:4n},{pc:4n},{generation:2n},{words:[0x13,4]},{raw:[1]}]) expect(codeKey({...b,...patch},layout)).not.toBe(codeKey(b,layout));
  expect(()=>codeKey({...b,pa:undefined},layout)).toThrow('R12');
});
it('keeps code charged and blocks replacement until both eviction acknowledgements', async () => {
  const resolves: (()=>void)[]=[];
  const revoke=vi.fn(()=>new Promise<void>(resolve=>resolves.push(resolve)));
  const cache=new SharedCodeCache(revoke); cache.budget=200000;
  await cache.request(0,[block()],layout,false); await cache.request(1,[block(2)],layout,false);
  const before=cache.stats().estimatedHostBytes; cache.budget=before;
  let done=false;
  const pending=cache.request(0,[block(3,2n,8)],layout,false).then(r=>{done=true;return r;});
  await vi.waitFor(()=>expect(revoke).toHaveBeenCalledTimes(2));
  expect(cache.stats().estimatedHostBytes).toBe(before); expect(done).toBe(false);
  resolves[0]!(); await Promise.resolve(); expect(done).toBe(false);
  resolves[1]!(); const result=await pending;
  expect(result.groups).toHaveLength(1);expect(cache.stats().modules).toBe(1);
  expect(cache.stats().estimatedHostBytes).toBeLessThanOrEqual(cache.budget);
});
it('rejects oversized admission and trims on a reduced budget without new requests', async () => {
  const cache=new SharedCodeCache(async()=>{});cache.budget=1;
  expect((await cache.request(0,[block()],layout,false)).rejected).toEqual([1]);
  expect(cache.stats().modules).toBe(0);cache.budget=200000;
  await cache.request(0,[block()],layout,false);cache.budget=0;await cache.trim();
  expect(cache.stats().estimatedHostBytes).toBe(0);
});
it('accounts in-flight compilation and rejects admission when the cap shrinks', async () => {
  let finish: ((module: WebAssembly.Module)=>void) | undefined;
  let compiled: WebAssembly.Module | undefined;
  const cache=new SharedCodeCache(async()=>{},async bytes=>{
    compiled=await WebAssembly.compile(bytes);
    return new Promise<WebAssembly.Module>(resolve=>{finish=resolve;});
  });
  cache.budget=200000;const pending=cache.request(0,[block()],layout,false);
  await vi.waitFor(()=>expect(finish).toBeDefined());
  expect(cache.stats().compilingBytes).toBeGreaterThan(0);
  cache.budget=0;const trim=cache.trim();finish!(compiled!);
  expect((await pending).rejected).toEqual([1]);await trim;
  expect(cache.stats().estimatedHostBytes).toBe(0);
});
it('drops old-session leases after an outstanding compile before serving a new session', async () => {
  let finish: ((module: WebAssembly.Module)=>void) | undefined;
  let compiled: WebAssembly.Module | undefined;
  const cache=new SharedCodeCache(async()=>{},async bytes=>{
    compiled=await WebAssembly.compile(bytes);
    return new Promise<WebAssembly.Module>(resolve=>{finish=resolve;});
  });
  cache.budget=200000;const old=cache.request(0,[block()],layout,false);
  await vi.waitFor(()=>expect(finish).toBeDefined());
  cache.reset(0);finish!(compiled!);await old;
  await cache.request(1,[block(2)],layout,false);
  expect(cache.stats().instanceBytes).toBe(instanceCharge(1));
  expect(cache.stats().bodyByteHistogram.reduce((n,b)=>n+b.count,0)).toBe(1);
});

it('revokes a whole batch once per hart, hides victims immediately and keeps all charge until all ACKs', async () => {
  const resolves: (() => void)[] = [];
  const revoke = vi.fn((_client: number, _serials: number[]) => new Promise<void>(resolve => resolves.push(resolve)));
  const cache = new SharedCodeCache(revoke); cache.budget = 1000000;
  for (let i = 1; i <= 4; i++) {
    await cache.request(0, [block(i, BigInt(i))], layout, false);
    await cache.request(1, [block(i, BigInt(i))], layout, false);
  }
  await new Promise(resolve => setTimeout(resolve, 5));
  const before = cache.stats().estimatedHostBytes;
  cache.budget = 1; const trim = cache.trim();
  await vi.waitFor(() => expect(revoke).toHaveBeenCalledTimes(2));
  expect(revoke.mock.calls.map(call => call[1].length)).toEqual([4,4]);
  const hits = cache.hits;
  expect((await cache.request(2, [block()], layout, false)).groups).toEqual([]);
  expect(cache.hits).toBe(hits);
  expect(cache.stats().estimatedHostBytes).toBe(before);
  resolves[0]!(); await Promise.resolve();
  expect(cache.stats().estimatedHostBytes).toBe(before);
  resolves[1]!(); await trim;
  expect(cache.stats().estimatedHostBytes).toBe(0);
  expect(cache.stats().revokeBatches).toBe(1);
});

it('admits below the remaining budget while an unrelated batch awaits ACK', async () => {
  let ack!: () => void;
  const cache = new SharedCodeCache(() => new Promise<void>(resolve => { ack = resolve; }));
  cache.budget = 1000000;
  await cache.request(0, [block()], layout, false);
  await new Promise(resolve => setTimeout(resolve, 5));
  cache.budget = 0; const trim = cache.trim();
  await vi.waitFor(() => expect(ack).toBeDefined());
  cache.budget = 1000000;
  expect((await cache.request(1, [block(2,2n)], layout, false)).groups).toHaveLength(1);
  expect(cache.stats().revokedBytes).toBeGreaterThan(0);
  ack(); await trim;
});

it('runs independent jobs concurrently and deduplicates overlapping in-flight keys', async () => {
  const finishes: (() => void)[] = [];
  const compile = vi.fn(async (bytes: Uint8Array<ArrayBuffer>) => {
    const module = await WebAssembly.compile(bytes);
    await new Promise<void>(resolve => finishes.push(resolve)); return module;
  });
  const cache = new SharedCodeCache(async () => {}, compile); cache.budget = 1000000;
  const a = cache.request(0, [block()], layout, false);
  const b = cache.request(1, [block(2)], layout, false);
  const c = cache.request(1, [block(3,2n)], layout, false);
  await vi.waitFor(() => expect(finishes).toHaveLength(2));
  expect(cache.stats().compilePoolBusy).toBe(2);
  expect(cache.stats().compilingBytes).toBeGreaterThan(0);
  finishes.forEach(finish => finish());
  const [ra, rb, rc] = await Promise.all([a,b,c]);
  expect(ra.groups[0]!.serial).toBe(rb.groups[0]!.serial);
  expect(rc.groups[0]!.serial).not.toBe(ra.groups[0]!.serial);
  expect(compile).toHaveBeenCalledTimes(2);
  expect(cache.stats().compilingBytes).toBe(0);
});

it('ignores a stale release while a hit reply is pending and releases the current lease', async () => {
  const cache = new SharedCodeCache(async () => {}); cache.budget = 1000000;
  const old = (await cache.request(0, [block()], layout, false)).groups[0]!;
  const pending = cache.request(0, [block(2)], layout, false);
  cache.release(0, old.serial, old.lease);
  const current = (await pending).groups[0]!;
  await new Promise(resolve => setTimeout(resolve, 5));
  expect(current.lease).toBeGreaterThan(old.lease);
  expect(cache.stats().instanceBytes).toBe(instanceCharge(1));
  cache.release(0, current.serial, old.lease);
  expect(cache.stats().instanceBytes).toBe(instanceCharge(1));
  cache.release(0, current.serial, current.lease);
  expect(cache.stats().instanceBytes).toBe(0);
});

it('preserves encoded charge when a pool worker receives a transferred buffer', async () => {
  let encoded = 0;
  const cache = new SharedCodeCache(async () => {}, async bytes => {
    encoded = bytes.byteLength;
    const transferred = structuredClone(bytes, { transfer: [bytes.buffer] });
    expect(bytes.byteLength).toBe(0);
    return WebAssembly.compile(transferred);
  });
  cache.budget = 1000000;
  const reply = await cache.request(0, [block()], layout, false);
  expect(reply.groups[0]!.byteLength).toBe(encoded);
  expect(cache.stats().estimatedHostBytes).toBe(jitCharge(encoded,1) + instanceCharge(1));
});

it('refunds failed compile reservations and allows retry of the same keys', async () => {
  let fail = true;
  const cache = new SharedCodeCache(async () => {}, async bytes => {
    if (fail) throw Error('failed compilation');
    return WebAssembly.compile(bytes);
  });
  cache.budget = 1000000;
  await expect(cache.request(0, [block()], layout, false)).rejects.toThrow('failed compilation');
  expect(cache.stats().estimatedHostBytes).toBe(0);
  fail = false;
  expect((await cache.request(1, [block()], layout, false)).groups).toHaveLength(1);
});
