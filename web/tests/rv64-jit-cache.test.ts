import { expect, it, vi } from 'vitest';
import { JitRuntime } from '../src/engine/rv64/jit';
import { compileBatch } from '../src/engine/rv64/jit-compiler';
it('evicts a cold whole module before reusing slots, preserving hot code', () => {
  let worker: any;
  class StubWorker {
    onmessage: any; onerror: any; pending: any;
    constructor() { worker = this; }
    postMessage(blocks: any) { this.pending = blocks; }
    terminate() {}
    reply() { const blocks=this.pending; this.onmessage({data:{module:new WebAssembly.Module(compileBatch(blocks)),blocks:blocks.map((b:any)=>({id:b.id,count:1}))}}); }
  }
  vi.stubGlobal('Worker',StubWorker);
  const memory=new WebAssembly.Memory({initial:1}), table=new WebAssembly.Table({initial:0,element:'anyfunc'});
  const installed=new Map<number,number>(); const evicted:number[]=[]; let clears=0;
  const jit=new JitRuntime(memory,table,(id,slot)=>installed.set(id,slot),()=>{clears++;},undefined,{
    limit:4, usage:ids=>ids.includes(1)?100:1,
    evict:ids=>{for(const id of ids){expect(table.get(installed.get(id)!)).not.toBeNull();installed.delete(id);evicted.push(id);}}
  });
  const queue=(ids:number[])=>{for(const id of ids)(globalThis as any).rv64Compile(id,0x80000000n,new Uint32Array([(id<<20)|(3<<7)|0x13,4]));jit.flush();worker.reply();};
  queue([1,2]);queue([3,4]);jit.flush();
  expect(evicted).toEqual([3,4]);expect(clears).toBe(0);expect(jit.stats().installed).toBe(2);
  queue([5,6]);
  for(const id of [1,2,5,6]) { (table.get(installed.get(id)!) as Function)(0,256);expect(new BigUint64Array(memory.buffer)[3]).toBe(BigInt(id)); }
  jit.dispose();vi.unstubAllGlobals();
});
