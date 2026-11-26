import { expect, it, vi } from 'vitest';
import { JitRuntime } from '../src/engine/rv64/jit';
import { sharedTable } from '../src/engine/rv64/smp';
import { compileBatch } from '../src/engine/rv64/jit-compiler';
const cacheTable=new WebAssembly.Table({initial:0,element:'anyfunc'});
for (const byteLimited of [false, true]) it(`evicts cold modules under the ${byteLimited ? 'byte' : 'function'} cap before reusing slots`, () => {
  let worker: any;
  class StubWorker {
    onmessage: any; onerror: any; pending: any;
    constructor() { worker = this; }
    postMessage(blocks: any) { this.pending = blocks; }
    terminate() {}
    reply() { const blocks=this.pending; const bytes=compileBatch(blocks); this.onmessage({data:{module:new WebAssembly.Module(bytes),byteLength:bytes.byteLength,blocks:blocks.map((b:any)=>({id:b.id,count:1}))}}); }
  }
  vi.stubGlobal('Worker',StubWorker);
  const memory=new WebAssembly.Memory({initial:1}), table=cacheTable;
  const installed=new Map<number,number>(); const evicted:number[]=[]; let clears=0;
  const jit=new JitRuntime(memory,table,(id,slot)=>installed.set(id,slot),()=>{clears++;},undefined,{
    limit:byteLimited ? 100 : 4, byteLimit:byteLimited ? 350 : undefined, usage:ids=>ids.includes(1)?100:1,
    evict:ids=>{for(const id of ids){expect(table.get(installed.get(id)!)).not.toBeNull();installed.delete(id);evicted.push(id);}}
  });
  const queue=(ids:number[])=>{for(const id of ids)(globalThis as any).rv64Compile(id,0x80000000n,new Uint32Array([(id<<20)|(3<<7)|0x13,4]));jit.flush();worker.reply();};
  queue([1,2]); const firstBytes=jit.stats().installedWasmBytes; expect(firstBytes).toBeGreaterThan(0);
  queue([3,4]); expect(jit.stats().installedWasmBytes).toBeGreaterThan(firstBytes); jit.flush();
  expect(jit.stats().installedWasmBytes).toBe(firstBytes);
  expect(evicted).toEqual([3,4]);expect(clears).toBe(0);expect(jit.stats().installed).toBe(2);
  expect(jit.stats().evicted).toBe(2);
  expect(jit.stats().compiled).toBe(jit.stats().evicted + jit.stats().installed);
  queue([5,6]);
  expect(jit.stats().compiled).toBe(jit.stats().evicted + jit.stats().installed);
  for(const id of [1,2,5,6]) { (table.get(installed.get(id)!) as Function)(0,256);expect(new BigUint64Array(memory.buffer)[3]).toBe(BigInt(id)); }
  jit.dispose();vi.unstubAllGlobals();
});


it('uses a larger bounded SMP cache and sends the shared layout to the compiler', () => {
  let sent: any;
  vi.stubGlobal('Worker', class { postMessage(data: any) { sent=data; } terminate() {} });
  const memory=new WebAssembly.Memory({initial:1}), table=new WebAssembly.Table({initial:0,element:'anyfunc'});
  const shared={ram:sharedTable(65536),generations:sharedTable(65536),granules:sharedTable(65536),bytes:32768};
  const jit=new JitRuntime(memory,table,()=>{},()=>{},undefined,undefined,shared);
  expect(jit.stats().installedLimit).toBe(131072);
  expect(jit.stats().installedWasmLimit).toBe(128*1024*1024);
  (globalThis as any).rv64Compile(1,0x4000n,new Uint32Array([0x13,4])); jit.flush();
  expect(sent.shared).toEqual({bytes:32768,ramPages:1,generationPages:1,granulePages:1});
  expect(sent.blocks).toHaveLength(1);
  jit.dispose(); vi.unstubAllGlobals();
});
