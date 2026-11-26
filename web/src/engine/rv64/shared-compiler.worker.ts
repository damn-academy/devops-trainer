import { SharedCodeCache } from './shared-code';
import { CompilePool } from './compile-pool';
import { compileBatch, compileChainDispatcher } from './jit-compiler';
const tailCalls = WebAssembly.validate(compileChainDispatcher()) && WebAssembly.validate(compileBatch([{ id: 0, pc: 0n, words: [0x13, 4] }], true));
const ports = new Map<number, MessagePort>();
const acks = new Map<string, () => void>();
let batch = 0;
let pool: CompilePool;
const cache = new SharedCodeCache((client, serials) => new Promise(resolve => {
  const port = ports.get(client);
  if (!port) { resolve(); return; }
  const id = ++batch;
  acks.set(`${client}/${id}`, resolve); port.postMessage({ evict: serials, batch: id });
}), bytes => pool.compile(bytes));
const stats = () => ({ ...cache.stats(), ...pool.stats() });
self.onmessage = ({ data }) => {
  if (data.poolSize && !pool) pool = new CompilePool(Array.from({ length: Math.min(4, Math.max(1, data.poolSize)) }, () => {
    const worker = new Worker(new URL('./shared-code.worker.ts', import.meta.url), { type: 'module' });
    return bytes => new Promise((resolve, reject) => {
      worker.onmessage = ({ data: result }) => result.error ? reject(Error(result.error)) : resolve(result);
      worker.onerror = event => reject(Error(event.message));
      worker.postMessage(bytes, [bytes.buffer]);
    });
  }));
  if (data.report) self.postMessage({ stats: stats() });
  if (typeof data.budget === 'number') { cache.budget = Math.max(0, data.budget); void cache.trim(); }
  if (data.port) {
    const port: MessagePort = data.port, client: number = data.client;
    ports.set(client, port);
    port.onmessage = async ({ data: d }) => {
      if (d.release !== undefined) cache.release(client, d.release, d.lease);
      if (d.reset) cache.reset(client);
      if (d.ack !== undefined || d.reset) {
        for (const [key, resolve] of acks) if (key === `${client}/${d.ack}` || d.reset && key.startsWith(`${client}/`)) { acks.delete(key); resolve(); }
      }
      if (d.touch) cache.touch(client, d.touch);
      if (d.blocks) {
        try { port.postMessage({ ...await cache.request(client, d.blocks, d.shared, tailCalls), shared: stats(), session: d.session }); }
        catch (error) { port.postMessage({ error: String(error), session: d.session }); }
      }
    };
  }
};
