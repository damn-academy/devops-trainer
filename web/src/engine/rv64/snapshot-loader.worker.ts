import { loadRAMChunk, type PagedManifest } from './paged-snapshot';
self.onmessage = ({ data }: MessageEvent<{ manifest: PagedManifest; url: string; mailbox: SharedArrayBuffer }>) => {
  const words = new Int32Array(data.mailbox, 0, 4);
  const buffer = new Uint8Array(data.mailbox, 16);
  self.onmessage = async ({ data: index }: MessageEvent<number>) => {
    try {
      const chunk = data.manifest.ram[index];
      if (!chunk) throw new Error('Unexpected snapshot page request');
      buffer.set(await loadRAMChunk(data.url, chunk));
      Atomics.store(words, 0, 1);
    } catch (error) {
      self.postMessage({ error: String(error) });
      Atomics.store(words, 0, -1);
    }
    Atomics.notify(words, 0);
  };
  self.postMessage({ ready: true });
};
