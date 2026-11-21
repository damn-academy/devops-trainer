import { compileBatch, compileChainDispatcher, type Block } from './jit-compiler';
const tailCalls = WebAssembly.validate(compileChainDispatcher()) && WebAssembly.validate(compileBatch([{ id: 0, pc: 0n, words: [0x13, 4] }], true));
self.onmessage = async ({ data }: MessageEvent<Block[]>) => {
  try {
    const module = await WebAssembly.compile(compileBatch(data, tailCalls));
    self.postMessage({ module, tailCalls, blocks: data.map(b => ({ id: b.id, count: b.words.length / 2 })) });
  } catch (error) { self.postMessage({ error: String(error) }); }
};
