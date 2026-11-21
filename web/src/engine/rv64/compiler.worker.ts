import { compileBatch, type Block } from './jit-compiler';
self.onmessage = async ({ data }: MessageEvent<Block[]>) => {
  try {
    const module = await WebAssembly.compile(compileBatch(data));
    self.postMessage({ module, blocks: data.map(b => ({ id: b.id, count: b.words.length / 2 })) });
  } catch (error) { self.postMessage({ error: String(error) }); }
};
