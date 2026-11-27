import { compileBatch, compileChainDispatcher, type SharedJitLayout, type Block } from './jit-compiler';
const tailCalls = WebAssembly.validate(compileChainDispatcher()) && WebAssembly.validate(compileBatch([{ id: 0, pc: 0n, words: [0x13, 4] }], true));
self.onmessage = async ({ data }: MessageEvent<Block[] | { blocks: Block[]; shared: SharedJitLayout }>) => {
  try {
    const blocks = Array.isArray(data) ? data : data.blocks;
    const shared = Array.isArray(data) ? undefined : data.shared;
    const bytes = compileBatch(blocks, tailCalls, shared, undefined, true);
    const module = await WebAssembly.compile(bytes);
    self.postMessage({ module, byteLength: bytes.byteLength, tailCalls, blocks: blocks.map(b => ({ id: b.id, count: b.words.length / 2 })) });
  } catch (error) { self.postMessage({ error: String(error) }); }
};
