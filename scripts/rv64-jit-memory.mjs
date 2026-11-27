#!/usr/bin/env node
// Diagnostic only: process deltas include allocator noise and V8 tiering.
// Run separate processes; never use forced GC in the emulator's budget loop.
import { compileBatch } from '../web/src/engine/rv64/jit-compiler.ts';
import { getHeapCodeStatistics } from 'node:v8';
const batch = Number(process.argv[2] ?? 16), count = Number(process.argv[3] ?? 4096);
if (!global.gc) throw Error('run node --expose-gc scripts/rv64-jit-memory.mjs [batch] [blocks]');
const collect = () => { global.gc(); global.gc(); return { ...process.memoryUsage(), ...getHeapCodeStatistics() }; };
const delta = (a,b) => Object.fromEntries(Object.keys(a).map(k => [k, b[k]-a[k]]));
const memory = new WebAssembly.Memory({initial:1});
const modules = [], instances = [], functions = [];
const blocks = Array.from({length:count}, (_, id) => ({id, pc:0x80000000n+BigInt(id*64), words:Array.from({length:16},()=>[0x00128293,4]).flat()}));
// Warm encoder/compilation paths before the baseline.
for(let i=0;i<100;i++) new WebAssembly.Instance(await WebAssembly.compile(compileBatch(blocks.slice(0,batch))),{env:{memory}});
const before = collect(); let encoded=0;
for(let i=0;i<count;i+=batch) { const bytes=compileBatch(blocks.slice(i,i+batch));encoded+=bytes.length;modules.push(await WebAssembly.compile(bytes)); }
const compiled = collect();
for(const module of modules) instances.push(new WebAssembly.Instance(module,{env:{memory}}));
const instantiated = collect();
for(const instance of instances) for(const fn of Object.values(instance.exports)) { functions.push(fn); fn(0,256); }
const executed = collect();
console.log(JSON.stringify({node:process.version,v8:process.versions.v8,batch,blocks:count,modules:modules.length,encoded,encodedPerBlock:encoded/count,
 compiled:delta(before,compiled),instantiated:delta(compiled,instantiated),executed:delta(instantiated,executed),
 retained:delta(before,executed),note:'Process/heap deltas, not exact native-code bytes; not browser RSS. Export wrappers are included in instantiation.'},null,2));
// Keep all stages alive across collection.
if(functions.length!==count) throw Error('missing exports');
