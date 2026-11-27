import { expect, it, vi } from 'vitest';
import { JitRuntime } from '../src/engine/rv64/jit';
import { sharedTable } from '../src/engine/rv64/smp';
import { compileBatch } from '../src/engine/rv64/jit-compiler';
const cacheTable=new WebAssembly.Table({initial:0,element:'anyfunc'});
for (const mode of ['functions', 'bytes', 'host']) it(`evicts cold modules under the ${mode} cap before reusing slots`, () => {
  let worker: any;
  class StubWorker {
    onmessage: any; onerror: any; pending: any;
    constructor() { worker = this; }
    postMessage(blocks: any) { this.pending = blocks; }
    terminate() {}
    reply() { const blocks=this.pending; const bytes=compileBatch(blocks,false,undefined,undefined,true); this.onmessage({data:{module:new WebAssembly.Module(bytes),byteLength:bytes.byteLength,blocks:blocks.map((b:any)=>({id:b.id,count:1}))}}); }
  }
  vi.stubGlobal('Worker',StubWorker);
  const memory=new WebAssembly.Memory({initial:1}), table=cacheTable;
  const installed=new Map<number,number>(); const evicted:number[]=[]; let clears=0;
  const jit=new JitRuntime(memory,table,(id,slot)=>installed.set(id,slot),()=>{clears++;},undefined,{
    limit:mode === 'functions' ? 4 : 100, byteLimit:mode === 'bytes' ? 350 : undefined, usage:ids=>ids.includes(1)?100:1,
    evict:ids=>{for(const id of ids){expect(table.get(installed.get(id)!)).not.toBeNull();installed.delete(id);evicted.push(id);}}
  });
  if (mode === 'host') jit.setHostBudget(100000);
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

it('bounds queued blocks and rejects overflow only at the quiescent flush boundary', () => {
  vi.stubGlobal('Worker', class { postMessage() {} terminate() {} });
  const evict = vi.fn();
  const jit = new JitRuntime(new WebAssembly.Memory({initial:1}), cacheTable, () => {}, () => {}, undefined, { usage: () => 0, evict });
  for (let id = 0; id < 1100; id++) (globalThis as any).rv64Compile(id, 0n, new Uint32Array([0x13,4]));
  expect(jit.stats().queued).toBe(1024); expect(evict).not.toHaveBeenCalled();
  jit.flush(); expect(evict.mock.calls[0]![0]).toHaveLength(76);
  expect(jit.stats().inflight).toBe(2); expect(jit.stats().queued).toBe(512);
  jit.dispose(); vi.unstubAllGlobals();
});

it('coalesces shared requests, reuses instances and unlinks Rust before acknowledging eviction', () => {
  let now=0;vi.spyOn(performance,'now').mockImplementation(()=>now);
  const messages:any[]=[];
  const port={onmessage:null as any,postMessage:(data:any)=>messages.push(data)} as unknown as MessagePort;
  const memory=new WebAssembly.Memory({initial:1}),table=new WebAssembly.Table({initial:0,element:'anyfunc'});
  const shared={ram:sharedTable(65536),generations:sharedTable(65536),granules:sharedTable(65536),bytes:32768};
  const installed=new Map<number,number>();
  const evict=vi.fn((ids:Uint32Array)=>{for(const id of ids){expect(table.get(installed.get(id)!)).not.toBeNull();installed.delete(id);}});
  const jit=new JitRuntime(memory,table,(id,slot)=>installed.set(id,slot),()=>{},undefined,{usage:()=>1,evict},shared,port);
  const enqueue=(id:number)=>(globalThis as any).rv64Compile(id,0x80000000n,new Uint32Array([0x00700193,4]),undefined,0x80000000n,1n);
  enqueue(10);jit.flush();expect(messages.some(m=>m.blocks)).toBe(false);
  now=4;jit.flush();const request=messages.find(m=>m.blocks);
  const layout={bytes:32768,ramPages:1,generationPages:1,granulePages:1};
  const bytes=compileBatch([{id:0,pc:0x80000000n,words:[0x00700193,4]}],false,layout,undefined,true);
  const module=new WebAssembly.Module(bytes);
  const reply=(id:number)=>port.onmessage!({data:{session:request.session,groups:[{serial:1,lease:id,module,byteLength:bytes.length,functions:1,blocks:[{id,exportId:0,count:1}]}],sharedCodeHits:1}} as MessageEvent);
  reply(10);enqueue(11);now=8;jit.flush();reply(11);
  expect(jit.stats().modules).toBe(1);expect(jit.stats().sharedCodeHits).toBe(2);
  for(const slot of installed.values())(table.get(slot) as Function)(0,256);
  expect(new BigUint64Array(memory.buffer)[3]).toBe(7n);
  const slots=[...installed.values()];
  port.onmessage!({data:{evict:[1],batch:17}} as MessageEvent);
  expect(evict).toHaveBeenCalledOnce();expect(installed.size).toBe(0);
  expect(slots.every(slot=>table.get(slot)===null)).toBe(true);
  expect(messages.at(-1)).toEqual({ack:17});expect(jit.stats().evicted).toBe(2);
  jit.dispose();vi.restoreAllMocks();
});

it('never recycles a slot from another hart table', () => {
  vi.stubGlobal('Worker',class{onmessage:any;postMessage(){}terminate(){}});
  const firstTable=new WebAssembly.Table({initial:20,element:'anyfunc'});
  const memory=new WebAssembly.Memory({initial:1});
  const a=new JitRuntime(memory,firstTable,()=>{},()=>{});
  const bytes=compileBatch([{id:1,pc:0n,words:[0x13,4]}],false,undefined,undefined,true);
  const data={module:new WebAssembly.Module(bytes),byteLength:bytes.length,blocks:[{id:1,count:1}]};
  (a as any).worker.onmessage({data});a.dispose();
  const secondTable=new WebAssembly.Table({initial:0,element:'anyfunc'});
  const b=new JitRuntime(memory,secondTable,()=>{},()=>{});
  (b as any).worker.onmessage({data});expect(b.error).toBeUndefined();expect(secondTable.length).toBe(1);
  b.dispose();vi.unstubAllGlobals();
});
