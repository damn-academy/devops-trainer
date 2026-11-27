// Bounded old-vs-shared table-import probe; run only in rv64-dev.
import {readFile} from 'node:fs/promises';
if(process.env.CARGO_HOME!=='/work/cargo')throw Error('rv64-dev only');
const mode=process.argv[2];if(!['inline','shared'].includes(mode))throw Error('inline|shared required');
const memory=new WebAssembly.Memory({initial:1}), table=new WebAssembly.Table({initial:65536,element:'anyfunc'});
const dispatcher=mode==='shared'?new WebAssembly.Instance(new WebAssembly.Module(await readFile('/work/out/chain-dispatch.wasm')),{env:{memory,table}}):undefined;
const module=new WebAssembly.Module(await readFile(`/work/out/chain-${mode}.wasm`));
global.gc?.();const before=process.memoryUsage(), start=performance.now();
for(let i=1;i<=128;i++){
 const instance=new WebAssembly.Instance(module,{env:{memory,table,...(dispatcher?{next:dispatcher.exports.next}:{})}});
 table.set(i,instance.exports.b1);
}
global.gc?.();const after=process.memoryUsage();if(!table.get(1))throw Error('lost function');
console.log(JSON.stringify({mode,node:process.version,instances:128,tableSlots:table.length,milliseconds:performance.now()-start,before,after,rssDelta:after.rss-before.rss}));
