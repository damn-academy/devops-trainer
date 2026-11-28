import { afterEach, expect, test, vi } from 'vitest';
import zlib from 'node:zlib';
import { decode, fetchObject, objectName, OBJECT_CACHE } from '../src/engine/rv64/objects';
import { HTTPBlockDevice, CHUNK_BYTES } from '../src/engine/rv64/block';
import { checkpointStore, readObject, restoreRam, validateCheckpoint, type SMPCheckpoint } from '../src/engine/rv64/smp-checkpoint';
import { sha256 } from '../src/engine/rv64/snapshot';
afterEach(() => vi.unstubAllGlobals());
const gzip = async (b: Uint8Array) => new Uint8Array(await new Response(new Blob([b as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
/** A server holding `files` and a Cache Storage that records its keys. */
function stubs(files: Map<string, Uint8Array>) {
  const entries = new Map<string, Response>(); const opened: string[] = [];
  vi.stubGlobal('caches', { open: async (name: string) => { opened.push(name); return {
    match: async (key: string) => entries.get(key)?.clone(), put: async (key: string, value: Response) => { entries.set(key, value); },
    delete: async (key: string) => entries.delete(key) }; } });
  const fetcher = vi.fn(async (url: string | URL) => {
    const body = files.get(new URL(url).pathname);
    return body ? new Response(body as Uint8Array<ArrayBuffer>) : new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetcher);
  return { entries, opened, fetcher };
}
test('encoded objects are decoded, verified, cached encoded and fetched once', async () => {
  const data = new Uint8Array(70000).map((_, i) => i % 251);
  const ref = { sha256: await sha256(data), bytes: data.length };
  const encoded = await gzip(data);
  const files = new Map([[`/objects/${objectName(ref.sha256, 'gzip')}`, encoded]]);
  const { entries, opened, fetcher } = stubs(files);
  expect(await fetchObject('https://t.invalid/objects/', ref, { encoding: 'gzip', cache: true })).toEqual(data);
  expect(await fetchObject('https://t.invalid/objects/', ref, { encoding: 'gzip', cache: true })).toEqual(data);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(opened[0]).toBe(OBJECT_CACHE);
  expect(new Uint8Array(await [...entries.values()][0]!.clone().arrayBuffer())).toEqual(encoded);
  // A damaged cache entry is dropped and fetched again.
  entries.set([...entries.keys()][0]!, new Response(new Uint8Array([1, 2, 3])));
  expect(await fetchObject('https://t.invalid/objects/', ref, { encoding: 'gzip', cache: true })).toEqual(data);
  expect(fetcher).toHaveBeenCalledTimes(2);
  // Wrong content under the name, or more bytes than recorded, are refused.
  files.set(`/objects/${objectName(ref.sha256, 'gzip')}`, await gzip(data.map((b) => b ^ 1)));
  await expect(fetchObject('https://t.invalid/objects/', ref, { encoding: 'gzip' })).rejects.toThrow('checksum');
  await expect(decode(encoded, 'gzip', data.length - 1)).rejects.toThrow('Oversized');
  await expect(decode(encoded, 'gzip', data.length + 1)).rejects.toThrow('Truncated');
});
test('zstd objects are decoded by the bundled decoder and verified', async () => {
  const data = new Uint8Array(300000).map((_, i) => (i * i) % 253);
  const ref = { sha256: await sha256(data), bytes: data.length };
  const files = new Map([[`/o/${objectName(ref.sha256, 'zstd')}`, new Uint8Array(zlib.zstdCompressSync(data))]]);
  stubs(files);
  expect(await fetchObject('https://t.invalid/o/', ref, { encoding: 'zstd', cache: true })).toEqual(data);
  await expect(fetchObject('https://t.invalid/o/', { ...ref, bytes: ref.bytes + 1 }, { encoding: 'zstd' })).rejects.toThrow();
});
test('a published checkpoint reads its objects from the store it names', async () => {
  const ram = new Uint8Array(1048576); ram.fill(5, 4096, 8192);
  const ref = { sha256: await sha256(ram), bytes: ram.length };
  const files = new Map([[`/rv64/objects/${objectName(ref.sha256, 'gzip')}`, await gzip(ram)]]);
  stubs(files);
  const m = { objects: '../objects/', encoding: 'gzip' } as SMPCheckpoint;
  const store = checkpointStore(m, 'https://t.invalid/rv64/kube-node-1/smp.json');
  expect(store).toEqual({ base: 'https://t.invalid/rv64/objects/', encoding: 'gzip' });
  const view = new Uint8Array(ram.length);
  await restoreRam(store, [{ offset: 0, object: ref }], view);
  expect(view).toEqual(ram);
  expect(await readObject(store, ref)).toEqual(ram);
  const disk = { url: '/d.img', version: 'v', bytes: 512 };
  const base: SMPCheckpoint = { format: 'dt.rv64.smp/v1', harts: 1, bytes: ram.length, wasmSha256: 'b'.repeat(64), disk, capturedAt: 1, ticks: 1,
    marker: 'RV64_NODE_REGISTERED_READY', cpus: [ref], device: ref, control: { sha256: ref.sha256, bytes: 64 }, mail: { sha256: ref.sha256, bytes: 32 }, ram: [] };
  expect(() => validateCheckpoint({ ...base, encoding: 'gzip', objects: '../objects/' }, 1, ram.length, base.wasmSha256, disk)).not.toThrow();
  for (const bad of [{ encoding: 'lz4' }, { objects: 'https://elsewhere.invalid/' }, { objects: '//elsewhere.invalid/' }]) {
    expect(() => validateCheckpoint({ ...base, ...bad } as SMPCheckpoint, 1, ram.length, base.wasmSha256, disk)).toThrow('object store');
  }
});
test('a published disk reads whole chunk objects and lays the overlay over them', async () => {
  vi.stubGlobal('self', { location: { href: 'https://t.invalid/assets/worker.js' } });
  const image = new Uint8Array(CHUNK_BYTES + 1024).map((_, i) => (i * 7) % 256);
  const parts = [image.subarray(0, CHUNK_BYTES), image.subarray(CHUNK_BYTES)];
  const chunks = await Promise.all(parts.map((p) => sha256(p)));
  const files = new Map<string, Uint8Array>();
  for (let i = 0; i < 2; i++) files.set(`/rv64/objects/${objectName(chunks[i]!, 'gzip')}`, await gzip(parts[i]!));
  const { fetcher } = stubs(files);
  const overlay = [{ offset: CHUNK_BYTES - 2, data: new Uint8Array([1, 2, 3, 4]) }];
  const disk = new HTTPBlockDevice({ url: 'https://t.invalid/rv64/objects/', bytes: image.length, version: 'v', chunks, encoding: 'gzip', overlay });
  const first = await disk.chunk(0), second = await disk.chunk(1);
  expect(first.subarray(0, CHUNK_BYTES - 2)).toEqual(image.subarray(0, CHUNK_BYTES - 2));
  expect([...first.subarray(CHUNK_BYTES - 2), ...second.subarray(0, 2)]).toEqual([1, 2, 3, 4]);
  expect(second.subarray(2)).toEqual(image.subarray(CHUNK_BYTES + 2));
  await disk.chunk(0);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(() => new HTTPBlockDevice({ url: '/o/', bytes: image.length, version: 'v', chunks: chunks.slice(1) })).toThrow('chunk index');
  expect(() => new HTTPBlockDevice({ url: '/o/', bytes: image.length, version: 'v', chunks: ['x', 'y'] })).toThrow('chunk index');
});
