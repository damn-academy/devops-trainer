import { expect, it } from 'vitest';
import { compileBatch, compileChainDispatcher } from '../src/engine/rv64/jit-compiler';
function fixture(budget=10000, fault='') {
 const memory=new WebAssembly.Memory({initial:64}), table=new WebAssembly.Table({initial:4,element:'anyfunc'});
 const view=new DataView(memory.buffer), regs=new BigUint64Array(memory.buffer);
 const base=0x80000000n, pc=0x4000n, satp=(8n<<60n)|1n, tlb=1024+4*40;
 const blocks=[{id:1,pc,words:[0x00108093,4]}, {id:2,pc:pc+4n,words:[0x00210113,4]}, {id:3,pc:pc+8n,words:[0xff9ff06f,4]}];
 const dispatcher=new WebAssembly.Instance(new WebAssembly.Module(compileChainDispatcher()),{env:{memory,table}});
 const compiled=new WebAssembly.Module(compileBatch(blocks,true));
 expect(WebAssembly.Module.imports(compiled).some(i=>i.kind==='table')).toBe(false);
 const instance=new WebAssembly.Instance(compiled,{env:{memory,next:dispatcher.exports.next}});
 for(const b of blocks)table.set(b.id,instance.exports['b'+b.id] as any);
 const frame=[pc,0n,32768n,4096n,1024n,1024n,0n,1n,satp,0n,BigInt(budget),0n,0n,0n,0n,1024n,12000n,65536n,1n,0n,13000n,77n];
 frame.forEach((v,i)=>regs[32+i]=v);
 [4n,base,1n,satp].forEach((v,i)=>view.setBigUint64(tlb+i*8,v,true));view.setUint8(tlb+32,1);view.setUint8(tlb+33,1);
 view.setBigUint64(12000,1n,true);
 for(const b of blocks) {
  const pa=base+b.pc-pc, index=Number(((pa>>1n)^(pa>>17n)^(b.pc>>33n))&65535n), off=65536+index*40;
  [b.pc,pa,1n].forEach((v,i)=>view.setBigUint64(off+i*8,v,true));view.setUint32(off+24,b.id,true);view.setUint32(off+28,1,true);view.setUint32(off+32,b.id,true);
  if(b.id===2 && fault==='generation')view.setBigUint64(off+16,2n,true);
  if(b.id===2 && fault==='slot')view.setUint32(off+24,0,true);
 }
 if(fault==='context')view.setBigUint64(tlb+16,0n,true);
 if(fault==='satp')view.setBigUint64(tlb+24,0n,true);
 if(fault==='pmp')view.setUint8(tlb+33,0);
 (instance.exports.b1 as Function)(0,256);
 return {regs,view};
}
it('tail chains ten thousand blocks without growing the stack and keeps exact budget/PC',()=>{
 const {regs,view}=fixture();expect(regs[1]).toBe(3334n);expect(regs[2]).toBe(6666n);expect(regs[33]).toBe(10000n);expect(regs[32]).toBe(0x4004n);expect(regs[51]).toBe(9999n);
 for(const id of [1,2,3])expect(view.getBigUint64(13000+id*8,true)).toBe(77n);
});
it('returns to the dispatcher on changed fetch permissions, translation, code or eviction',()=>{
 for(const reason of ['generation','slot','context','satp','pmp']){const {regs}=fixture(10000,reason);expect(regs[33]).toBe(1n);expect(regs[1]).toBe(1n);expect(regs[2]).toBe(0n);expect(regs[32]).toBe(0x4004n);}
});
