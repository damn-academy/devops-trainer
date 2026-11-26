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
