// @vitest-environment node
import { webcrypto } from 'node:crypto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadSnapshot, saveSnapshot, validateManifest, type RV64Snapshot } from '../src/engine/rv64/snapshot';
vi.stubGlobal('crypto', webcrypto);
vi.stubGlobal('location', { href: 'https://fixture.test/' });
afterEach(() => vi.restoreAllMocks());
const source = (): RV64Snapshot => ({ format: 'dt.rv64.snapshot/v1', state: new Uint8Array(4 * 1024 * 1024 + 19).fill(17),
  pending: new Uint8Array([1, 2]), rings: [new Uint8Array(0), new Uint8Array([3]), new Uint8Array(0), new Uint8Array([4, 5])],
  diskIdentity: 'base-v1', history: [], lastExit: 0, capturedAt: Date.now() - 1000 });
const wasm = 'a'.repeat(64);
async function fixture() {
  const files = new Map<string, Uint8Array>();
  const snapshot = source();
  const manifest = await saveSnapshot(snapshot, 768, wasm, async (name, bytes) => { files.set(name, bytes); });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(files.get(url.split('/').pop()!) as Uint8Array<ArrayBuffer>)));
  return { files, snapshot, manifest };
}
describe('portable compressed RV64 snapshots', () => {
  it('round trips chunk boundaries, empty sections and timestamp', async () => {
    const { snapshot, manifest } = await fixture();
    expect(manifest.chunks.length).toBe(5);
    const loaded = await loadSnapshot('https://fixture.test/manifest.json', 768, wasm);
    expect(loaded.state.length).toBe(snapshot.state.length);
    expect(loaded.state.every(n => n === 17)).toBe(true);
    expect(loaded.pending).toEqual(snapshot.pending);
    expect(loaded.rings).toEqual(snapshot.rings);
    expect(loaded.capturedAt).toBe(snapshot.capturedAt);
  });
  it('rejects corrupt compressed data before restoring the CPU', async () => {
    const { files, manifest } = await fixture();
    files.get(manifest.chunks[0].url)![10] ^= 1;
    await expect(loadSnapshot('https://fixture.test/manifest.json', 768, wasm)).rejects.toThrow('checksum');
  });
  it('rejects incompatible builds, geometry, huge lengths and chunk traversal', async () => {
    const { manifest } = await fixture();
    expect(() => validateManifest(manifest, 512, wasm)).toThrow();
    expect(() => validateManifest(manifest, 768, 'b'.repeat(64))).toThrow();
    expect(() => validateManifest({ ...manifest, lengths: [2 ** 32, 0, 0, 0, 0, 0] }, 768, wasm)).toThrow();
    manifest.chunks[0].url = '../other';
    expect(() => validateManifest(manifest, 768, wasm)).toThrow();
  });
});

it('allows relocating immutable media while rejecting a different version or geometry', async () => {
  const { diskIdentity, sameDiskIdentity } = await import('../src/engine/rv64/snapshot');
  const legacy = JSON.stringify({ url: 'http://127.0.0.1:18082/media', bytes: 512, version: 'sha-v1' });
  const hosted = diskIdentity({ url: 'https://course.test/media', bytes: 512, version: 'sha-v1' });
  expect(sameDiskIdentity(legacy, hosted)).toBe(true);
  expect(sameDiskIdentity(legacy, diskIdentity({ url: '/media', bytes: 1024, version: 'sha-v1' }))).toBe(false);
  expect(sameDiskIdentity(legacy, diskIdentity({ url: '/media', bytes: 512, version: 'sha-v2' }))).toBe(false);
  expect(sameDiskIdentity('null', hosted)).toBe(false);
});
