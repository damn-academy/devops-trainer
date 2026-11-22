import { prefetchRAM, loadRAMChunk, type PagedManifest } from './paged-snapshot';
self.onmessage = async ({ data }: MessageEvent<{ manifest: PagedManifest; url: string; mailbox: SharedArrayBuffer }>) => {
  let hot: Map<number, Uint8Array>;
  try { hot = await prefetchRAM(data.url, data.manifest); }
  catch (error) { self.postMessage({ error: String(error) }); return; }
  const words = new Int32Array(data.mailbox, 0, 4);
  const buffer = new Uint8Array(data.mailbox, 16);
  self.onmessage = async ({ data: index }: MessageEvent<number>) => {
    try {
      const chunk = data.manifest.ram[index];
      if (!chunk) throw new Error('Unexpected snapshot page request');
      buffer.set(await loadRAMChunk(data.url, chunk, hot.get(index)));
      hot.delete(index);
      Atomics.store(words, 0, 1);
    } catch (error) {
      self.postMessage({ error: String(error) });
      Atomics.store(words, 0, -1);
    }
    Atomics.notify(words, 0);
  };
  self.postMessage({ ready: true });
};
