// Pod-only diagnostic host for the SAME wasm JIT; not a native Rust backend.
import { readFile, open, copyFile } from 'node:fs/promises';
import { Worker as NodeWorker } from 'node:worker_threads';
import { createSocket } from 'node:dgram';
import { randomBytes, createHash } from 'node:crypto';
if (process.env.CARGO_HOME !== '/work/cargo') throw new Error('Run only in rv64-dev');
class CompilerWorker {
  constructor() {
    this.worker = new NodeWorker(`const {parentPort}=require('node:worker_threads');
      globalThis.self=globalThis;globalThis.postMessage=data=>parentPort.postMessage(data);
      import('file:///work/rv64-node-compiler.mjs').then(()=>parentPort.on('message',data=>self.onmessage({data})));`, {eval:true});
    this.worker.on('message',data=>this.onmessage?.({data}));
    this.worker.on('error',error=>this.onerror?.({message:String(error)}));
  }
  postMessage(data) { this.worker.postMessage(data); }
  terminate() { this.worker.terminate(); }
}
globalThis.Worker=CompilerWorker;
const {JitRuntime}=await import('file:///work/rv64-node-runtime.mjs');
await copyFile('/work/out/rv64_core.js','/work/out/rv64_core.mjs');
const mod=await import('file:///work/out/rv64_core.mjs');
const wasmBytes=await readFile('/work/out/rv64_core_bg.wasm');
const wasmSha256=createHash('sha256').update(wasmBytes).digest('hex');
const compilerSha256=createHash('sha256').update(await readFile('/work/rv64-node-compiler.mjs')).digest('hex');
const wasm=await mod.default({module_or_path:wasmBytes});
const core=new mod.Engine(1024);core.jit_threshold(50);
const cacheLimit=Number(process.env.RV64_JIT_CACHE_LIMIT??65536);
if(!Number.isInteger(cacheLimit)||cacheLimit<1024||cacheLimit>1048576)throw Error('invalid JIT cache limit');
const jit=new JitRuntime(wasm.memory,core.jit_table(),(id,slot,count)=>core.jit_install(id,slot,count),()=>core.jit_clear(),wasm.jit_slow,
  {usage:ids=>core.jit_usage(ids),evict:ids=>core.jit_evict(ids),limit:cacheLimit});
const disk=await open('/work/guest/kuberoot/uncompressed.img','r');
const diskBytes=(await disk.stat()).size;core.lazy_disk(diskBytes);
const socket=createSocket('udp4'), rx=[];
socket.on('message',data=>rx.push(data));
await new Promise(resolve=>socket.connect(Number(process.env.RV64_NET_PORT??18083),'127.0.0.1',resolve));
core.boot(await readFile('/work/guest/vmlinuz.efi'),await readFile('/work/guest/kuberoot/initrd.cpio'),
  'earlycon=sbi console=hvc0 nokaslr kuberoot.root=PARTLABEL=KUBEROOT-MEDIA:/kuberoot/rootfs.squashfs kuberoot.verbose');
const start=performance.now(), seconds=Number(process.env.RV64_PROBE_SECONDS??900);
let busyMilliseconds=0, waitMs=0, lastYield=start, lastMetrics=start, lastMemoryCheck=start, entropyAt=-Infinity, text='', readyMs, complete=false, failure;
const reads=new Map();
const stats=()=>({host:'pod-node-v8',node:process.version,v8:process.versions.v8,wasmSha256,compilerSha256,cacheLimit,nodeMemory:process.memoryUsage(),wasmMemoryBytes:wasm.memory.buffer.byteLength,compilerModules:jit.batches.length,nativeRustJit:false,elapsedMs:performance.now()-start,retired:core.retired(),jitRetired:core.jit_retired(),
  busyMilliseconds,waitMs,compiler:jit.stats(),counters:JSON.parse(core.metrics()),readyMs,complete});
try {
  while(performance.now()-start < seconds*1000) {
    if(failure)throw failure;
    if(performance.now()-lastMemoryCheck>=1000){lastMemoryCheck=performance.now();if(process.memoryUsage.rss()>Number(process.env.RV64_MAX_RSS_MB??4096)*1048576)throw Error('pod diagnostic RSS limit exceeded');}
    if(performance.now()-lastYield>=8) {jit.flush();await new Promise(setImmediate);lastYield=performance.now();}
    for(const frame of rx.splice(0))core.net_receive(frame);
    const now=performance.now();
    if(now-entropyAt>=1000){core.entropy(randomBytes(4096));entropyAt=now;}
    const run=performance.now(), state=core.run(4096,(now-start)*10000);busyMilliseconds+=performance.now()-run;
    for(const index of core.disk_missing()) {
      if(reads.has(index))continue;
      const buffer=Buffer.alloc(Math.min(262144,diskBytes-index*262144));
      reads.set(index,disk.read(buffer,0,buffer.length,index*262144).then(({bytesRead})=>{
        if(bytesRead!==buffer.length)throw new Error('short disk read');core.disk_chunk(index,buffer);
      }).catch(error=>{failure=error;}).finally(()=>reads.delete(index)));
    }
    for(let frame=core.net_take();frame.length;frame=core.net_take())socket.send(frame);
    const out=core.output();
    if(out.length){const str=Buffer.from(out).toString();process.stdout.write(str);text=(text+str).slice(-1000000);}
    if(readyMs===undefined && text.includes('\nRV64_NODE_READY')){readyMs=performance.now()-start;console.error('BOOT_READY_MS='+readyMs);}
    if(text.includes('\nRV64_PROBE_DONE')){complete=true;break;}
    if(state===2 || state===3)throw new Error('guest stopped/reset');
    if(state===1){const idle=performance.now();await new Promise(resolve=>setTimeout(resolve,Math.min(core.deadline_ms(),reads.size?1:10)));waitMs+=performance.now()-idle;}
    if(performance.now()-lastMetrics>=10000){console.error('METRICS '+JSON.stringify(stats()));lastMetrics=performance.now();}
  }
  console.error('RESULT '+JSON.stringify(stats()));
  if(!complete)process.exitCode=1;
} catch(error) {
  console.error('RESULT '+JSON.stringify({...stats(),error:String(error)}));
  throw error;
} finally {await Promise.all(reads.values());jit.dispose();socket.close();await disk.close();core.free();}
