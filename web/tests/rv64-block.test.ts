import { describe, it, expect, vi, afterEach } from 'vitest';
import { HTTPBlockDevice } from '../src/engine/rv64/block';
afterEach(() => vi.unstubAllGlobals());
describe('HTTP disk', () => {
  it('validates range responses and caches complete immutable chunks', async () => {
    const entries = new Map<string, Response>();
    vi.stubGlobal('self', { location: { href: 'https://test.invalid/' } });
    vi.stubGlobal('caches', { open: async () => ({ match: async (key: string) => entries.get(key)?.clone(), put: async (key: string, value: Response) => { entries.set(key, value); }, delete: async (key: string) => entries.delete(key) }) });
    const fetcher = vi.fn(async () => new Response(new Uint8Array(512).fill(7), { status: 206, headers: { 'Content-Range': 'bytes 0-511/512' } }));
    vi.stubGlobal('fetch', fetcher);
    const disk = new HTTPBlockDevice({ url: '/disk', bytes: 512, version: 'sha256:one' });
    expect((await disk.chunk(0))[0]).toBe(7); expect((await disk.chunk(0))[0]).toBe(7);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await new HTTPBlockDevice({ url: '/disk', bytes: 512, version: 'sha256:two' }).chunk(0);
    expect(fetcher).toHaveBeenCalledTimes(2);
    await expect(disk.chunk(1)).rejects.toThrow();
  });
  it('rejects a server ignoring Range', async () => {
    vi.stubGlobal('self', { location: { href: 'https://test.invalid/' } });
    vi.stubGlobal('caches', undefined);
    vi.stubGlobal('fetch', async () => new Response(new Uint8Array(512)));
    await expect(new HTTPBlockDevice({ url: '/disk', bytes: 512, version: 'one' }).chunk(0)).rejects.toThrow('byte-range');
  });
});
