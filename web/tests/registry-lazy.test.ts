// The registry loads every engine and block module through dynamic import()
// (one chunk per block) and fills the shared object in place.
import { describe, expect, it } from 'vitest';
import { loadRegistry, registry } from '../src/core/registry';
import { ROUTE } from '../src/core/route';

describe('lazy registry', () => {
  it('fills the exported object in place and is idempotent', async () => {
    const a = await loadRegistry();
    const b = await loadRegistry();
    expect(a).toBe(registry);
    expect(b).toBe(registry);
    expect(registry.errors).toEqual([]);
  });

  it('delivers every block of the route', () => {
    for (const e of ROUTE) expect(registry.blocks.has(e.id), e.id).toBe(true);
    expect(registry.routeMap().every((x) => x.kind === 'block')).toBe(true);
  });

  it('keeps engines before blocks, so block commands can override engine ones', () => {
    const files = [...registry.origin.values()];
    const firstBlock = files.findIndex((f) => f.includes('/blocks/'));
    const lastEngine = files.map((f) => f.includes('/engine/')).lastIndexOf(true);
    expect(firstBlock).toBeGreaterThan(-1);
    expect(lastEngine).toBeLessThan(firstBlock);
  });
});
