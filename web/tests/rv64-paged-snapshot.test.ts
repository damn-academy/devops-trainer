// @vitest-environment node
import { webcrypto } from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';
import { loadRAMChunk, RAM_CHUNK, savePagedSnapshot, validatePaged } from '../src/engine/rv64/paged-snapshot';
vi.stubGlobal('crypto', webcrypto);
const wasm = 'a'.repeat(64);
describe('demand-paged RAM transport', () => {
  it('omits zero pages, uses an exact range, and reconstructs untouched neighbours', async () => {
    const files = new Map<string, Uint8Array>();
    const manifest = await savePagedSnapshot({ format: 'dt.rv64.snapshot/v1', state: new Uint8Array([1]), pending: new Uint8Array(),
      rings: Array.from({ length: 4 }, () => new Uint8Array()), diskIdentity: 'disk', history: [], lastExit: 0, capturedAt: Date.now() }, 32, wasm,
      index => { const block = new Uint8Array(RAM_CHUNK); if (index === 3) { block[4096] = 42; block[63 * 4096] = 7; } return block; },
      async (name, bytes) => { files.set(name, bytes); });
    validatePaged(manifest, 32, wasm);
    expect(manifest.ram.filter(Boolean)).toHaveLength(1);
    const chunk = manifest.ram[3]!;
    expect(chunk.pages).toEqual([1, 63]);
    const fetcher = vi.fn(async (_url: string, options: RequestInit) => {
      expect(options.headers).toEqual({ Range: `bytes=0-${chunk.bytes - 1}` });
      return new Response(files.get(`${chunk.sha256}.bin`) as Uint8Array<ArrayBuffer>, { status: 206,
        headers: { 'Content-Range': `bytes 0-${chunk.bytes - 1}/${chunk.bytes}` } });
    });
    vi.stubGlobal('fetch', fetcher);
    const ram = await loadRAMChunk('https://fixture.test/paged.json', chunk);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(ram[4096]).toBe(42); expect(ram[63 * 4096]).toBe(7);
    ram[4096] = ram[63 * 4096] = 0;
    expect(ram.every(b => b === 0)).toBe(true);
    manifest.hot = { sha256: chunk.sha256, bytes: chunk.bytes, indices: [3] };
    validatePaged(manifest, 32, wasm);
    manifest.hot.indices = [3, 3];
    expect(() => validatePaged(manifest, 32, wasm)).toThrow('hot set');
    manifest.hot.indices = [4];
    expect(() => validatePaged(manifest, 32, wasm)).toThrow('hot set');
    delete manifest.hot;
    chunk.pages = [2, 1];
    expect(() => validatePaged(manifest, 32, wasm)).toThrow('index');
  });
});

it('validates cached bytes and rejects a server ignoring Range', async () => {
  const { sha256 } = await import('../src/engine/rv64/snapshot');
  const packed = new Uint8Array(4096).fill(42);
  const compressed = new Uint8Array(await new Response(new Blob([packed]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  const chunk = { sha256: await sha256(compressed), bytes: compressed.length, pages: [2] };
  const cache = new Map<string, Response>();
  vi.stubGlobal('caches', { open: async () => ({ match: async (key: string) => cache.get(key)?.clone(),
    put: async (key: string, value: Response) => { cache.set(key, value.clone()); }, delete: async (key: string) => cache.delete(key) }) });
  const fetcher = vi.fn(async () => new Response(compressed, { status: 206, headers: { 'Content-Range': `bytes 0-${chunk.bytes - 1}/${chunk.bytes}` } }));
  vi.stubGlobal('fetch', fetcher);
  expect((await loadRAMChunk('https://fixture.test/paged.json', chunk))[8192]).toBe(42);
  await loadRAMChunk('https://fixture.test/paged.json', chunk);
  expect(fetcher).toHaveBeenCalledTimes(1);
  cache.set(`https://fixture.test/${chunk.sha256}.bin`, new Response(new Uint8Array([0])));
  await loadRAMChunk('https://fixture.test/paged.json', chunk);
  expect(fetcher).toHaveBeenCalledTimes(2);
  cache.clear();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(compressed)));
  await expect(loadRAMChunk('https://fixture.test/paged.json', chunk)).rejects.toThrow('Range');
  vi.stubGlobal('caches', undefined);
});

it('prefetches two hot groups with one Range request and still verifies each member', async () => {
  const { prefetchRAM } = await import('../src/engine/rv64/paged-snapshot');
  const { sha256 } = await import('../src/engine/rv64/snapshot');
  const parts = await Promise.all([17, 42].map(async value => new Uint8Array(await new Response(
    new Blob([new Uint8Array(4096).fill(value)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer())));
  const ram = await Promise.all(parts.map(async data => ({ sha256: await sha256(data), bytes: data.length, pages: [3] })));
  const packed = new Uint8Array(parts[0].length + parts[1].length);
  packed.set(parts[0]); packed.set(parts[1], parts[0].length);
  const manifest = { ram, hot: { sha256: await sha256(packed), bytes: packed.length, indices: [0, 1] } } as Parameters<typeof prefetchRAM>[1];
  const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
    expect(init.headers).toEqual({ Range: `bytes=0-${packed.length - 1}` });
    return new Response(packed, { status: 206, headers: { 'Content-Range': `bytes 0-${packed.length - 1}/${packed.length}` } });
  });
  vi.stubGlobal('fetch', fetcher);
  const hot = await prefetchRAM('https://fixture.test/paged.json', manifest);
  expect((await loadRAMChunk('https://fixture.test/paged.json', ram[0], hot.get(0)))[12288]).toBe(17);
  expect((await loadRAMChunk('https://fixture.test/paged.json', ram[1], hot.get(1)))[12288]).toBe(42);
  expect(fetcher).toHaveBeenCalledTimes(1);
  hot.get(0)![0] ^= 1;
  await expect(loadRAMChunk('https://fixture.test/paged.json', ram[0], hot.get(0))).rejects.toThrow('checksum');
  packed[0] ^= 1;
  await expect(prefetchRAM('https://fixture.test/paged.json', manifest)).rejects.toThrow('checksum');
});
