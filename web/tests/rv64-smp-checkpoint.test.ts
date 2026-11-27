import { expect, test, vi } from 'vitest';
import { storeRam, storeObject, readObject, validateCheckpoint, type SMPCheckpoint } from '../src/engine/rv64/smp-checkpoint';
import { restoreTimeOffset } from '../src/engine/rv64/restore-clock';
test('portable SMP objects stream sparse RAM, verify bytes, and reject incompatible machines', async () => {
  const files = new Map<string, Uint8Array>();
  const write = async (name: string, bytes: Uint8Array) => { files.set(name, bytes.slice()); };
  const ram = new Uint8Array(3 * 1048576); ram[0] = 7; ram[ram.length - 1] = 9;
  const chunks = await storeRam(ram, write);
  expect(chunks.map(c => c.offset)).toEqual([0, 2 * 1048576]);
  const blob = await storeObject(new Uint8Array([1, 2]), write);
  const disk = { url: '/base.img', version: 'a'.repeat(64), bytes: 512 };
  const m: SMPCheckpoint = { format: 'dt.rv64.smp/v1', harts: 2, bytes: ram.length, wasmSha256: 'b'.repeat(64),
    disk, capturedAt: 1000, ticks: 500, marker: 'RV64_NODE_REGISTERED_READY', cpus: [blob, blob], device: blob,
    control: await storeObject(new Uint8Array(128), write), mail: await storeObject(new Uint8Array(64), write), ram: chunks };
  expect(() => validateCheckpoint(m, 2, ram.length, m.wasmSha256, disk)).not.toThrow();
  for (const bad of [{ harts: 4 }, { wasmSha256: 'bad' }, { ticks: NaN }, { ram: [...chunks].reverse() }, { marker: 'RV64_NODE_READY' }]) {
    expect(() => validateCheckpoint({ ...m, ...bad }, 2, ram.length, m.wasmSha256, disk)).toThrow();
  }
  expect(() => validateCheckpoint(m, 2, ram.length, m.wasmSha256, { ...disk, version: 'wrong' })).toThrow();
  vi.stubGlobal('fetch', async (url: URL) => new Response(files.get(url.pathname.split('/').pop()!)! as Uint8Array<ArrayBuffer>));
  try {
    const restored = new Uint8Array(ram.length);
    for (const c of chunks) restored.set(await readObject('http://test/smp.json', c.object), c.offset);
    expect(restored).toEqual(ram);
    files.set(`${blob.sha256}.bin`, new Uint8Array([2, 1]));
    await expect(readObject('http://test/smp.json', blob)).rejects.toThrow('checksum');
  } finally { vi.unstubAllGlobals(); }
});
test('continuous excludes downtime and elapsed includes it without scaling future ticks', () => {
  const clock = (policy: 'continuous' | 'elapsed') => restoreTimeOffset(1e8, 1000, policy, 3601000, 50);
  expect(clock('continuous') + 50 * 10000).toBe(1e8);
  expect(clock('elapsed') + 50 * 10000).toBe(1e8 + 3600000 * 10000);
  expect(clock('continuous') + 1050 * 10000).toBe(1e8 + 1000 * 10000);
});
