import { afterEach, expect, it, vi } from 'vitest';
import { gzipSync } from 'node:zlib';
import { digest, fetchBootSnapshot, V86_VERSION, type BootSnapshot } from '../src/engine/v86/boot-snapshot';

afterEach(() => vi.unstubAllGlobals());

it('restores only an intact snapshot matching the emulator, image and hardware', async () => {
  const bytes = Uint8Array.from(gzipSync('snapshot')).buffer;
  const entry: BootSnapshot = { file: 'state.gz', key: 'hardware', imageHash: 'image', v86: V86_VERSION, sha256: await digest(bytes), size: bytes.byteLength };
  const fetch = vi.fn(async () => new Response(bytes));
  vi.stubGlobal('fetch', fetch);
  for (const bad of [{ ...entry, key: 'other' }, { ...entry, imageHash: 'old' }, { ...entry, v86: 'old' }]) {
    expect(await fetchBootSnapshot(bad, 'hardware', 'image', (s) => s)).toBeNull();
  }
  expect(fetch).not.toHaveBeenCalled();
  expect(new TextDecoder().decode((await fetchBootSnapshot(entry, 'hardware', 'image', (s) => s))!)).toBe('snapshot');
  expect(await fetchBootSnapshot({ ...entry, sha256: 'wrong' }, 'hardware', 'image', (s) => s)).toBeNull();
  expect(await fetchBootSnapshot({ ...entry, size: 0 }, 'hardware', 'image', (s) => s)).toBeNull();
  fetch.mockRejectedValueOnce(new Error('offline'));
  expect(await fetchBootSnapshot(entry, 'hardware', 'image', (s) => s)).toBeNull();
});

it('invalidates the image identity when the kernel, initramfs, root or command line changes', async () => {
  const { imageHash } = await import('../src/engine/v86/boot-snapshot');
  const manifest = {
    kernel: { file: 'kernel' }, initrd: { file: 'initrd' }, cmdline: 'root=host9p',
    outputs: { kernel: { sha256: 'a' }, initrd: { sha256: 'b' }, root: { sha256: 'c' } },
  } as unknown as import('../src/engine/v86/assets').LabManifest;
  const original = await imageHash(manifest, 'root');
  for (const file of ['kernel', 'initrd', 'root']) {
    const changed = structuredClone(manifest);
    changed.outputs[file].sha256 = 'different';
    expect(await imageHash(changed, 'root')).not.toBe(original);
  }
  expect(await imageHash({ ...manifest, cmdline: 'other' }, 'root')).not.toBe(original);
});

it('keeps verified gzip bytes for the next machine without recompressing them', async () => {
  const { saveCompressedState, loadState, deleteState } = await import('../src/engine/v86/state-cache');
  const bytes = Uint8Array.from(gzipSync('cached boot state')).buffer;
  const key = 'boot-prebuilt-unit-test';
  try {
    expect(await saveCompressedState(key, bytes)).toBe(bytes.byteLength);
    expect(new TextDecoder().decode((await loadState(key))!)).toBe('cached boot state');
  } finally { await deleteState(key); }
});
