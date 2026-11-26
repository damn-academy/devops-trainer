import { SharedCodeCache } from './shared-code';
import { compileBatch, compileChainDispatcher } from './jit-compiler';
const tailCalls = WebAssembly.validate(compileChainDispatcher()) && WebAssembly.validate(compileBatch([{ id: 0, pc: 0n, words: [0x13, 4] }], true));
const ports = new Map<number, MessagePort>();
const acks = new Map<string, () => void>();
const cache = new SharedCodeCache((client, serial) => new Promise(resolve => {
  const port = ports.get(client);
  if (!port) { resolve(); return; }
  acks.set(`${client}/${serial}`, resolve); port.postMessage({ evict: serial });
}));
self.onmessage = ({ data }) => {
  if (data.report) self.postMessage({ stats: cache.stats() });
  if (typeof data.budget === 'number') { cache.budget = Math.max(0, data.budget); void cache.trim(); }
  if (data.port) {
    const port: MessagePort = data.port, client: number = data.client;
    ports.set(client, port);
    port.onmessage = async ({ data: d }) => {
      if (d.release !== undefined || d.reset) {
        if (d.reset) cache.reset(client); else cache.release(client, d.release);
        for (const [key, resolve] of acks) if (key === `${client}/${d.release}` || d.reset && key.startsWith(`${client}/`)) { acks.delete(key); resolve(); }
      }
      if (d.touch) cache.touch(client, d.touch);
      if (d.blocks) {
        try { port.postMessage({ ...await cache.request(client, d.blocks, d.shared, tailCalls), session: d.session }); }
        catch (error) { port.postMessage({ error: String(error), session: d.session }); }
      }
    };
  }
};
