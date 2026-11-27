// The light manifest the route map paints from (src/core/manifest.ts): it is
// plain data, it is small, and a registry built from it shows the same route
// map as the full registry without touching the shared terminal or corpus.
import { describe, expect, it } from 'vitest';
import { fromManifest, toManifest } from '../src/core/manifest';
import { registry, registryFromManifest } from '../src/core/registry';
import { corpus } from '../src/engine/docs/corpus';
import { terminalRegistry } from '../src/engine/terminal/registry';

const manifest = toManifest(registry);
const json = JSON.stringify(manifest);

describe('course manifest', () => {
  it('is plain data that survives JSON', () => {
    expect(JSON.parse(json)).toEqual(manifest);
  });

  it('stays light enough for the first visit', () => {
    // Budget for the first visit; raised from 120 000 when the sales partners module arrived.
    expect(json.length).toBeLessThan(125_000);
    expect(new TextEncoder().encode(json).byteLength).toBeLessThan(125_000);
  });

  it('keeps course details out even as their content grows', () => {
    const detail = { ru: 'Подробности'.repeat(10_000), en: 'Details'.repeat(10_000) };
    const expanded = toManifest({
      orderedBlocks: () => registry.orderedBlocks(true).map(b => ({
        ...b,
        modules: [{ title: detail, lessons: b.lessons }],
        ...(b.hidden ? { summary: detail, levels: { beginner: detail, intermediate: detail, experienced: detail } } : {}),
      })),
      orderedLessons: () => registry.orderedLessons().map(l => ({
        ...l, summary: detail,
        ...(registry.blocks.get(l.block)!.hidden ? { minutes: 999, introduces: ['course.detail'] } : {}),
      })),
    });
    expect(expanded).toEqual(manifest);
  });

  it('preserves route descriptions, duration and placement progress inputs', () => {
    const light = registryFromManifest(manifest);
    for (const b of registry.orderedBlocks(false)) {
      expect(light.blocks.get(b.id)).toMatchObject({ title: b.title, summary: b.summary, levels: b.levels, hours: b.hours });
      for (const id of b.lessons) {
        const l = registry.lessons.get(id)!;
        expect(light.lessons.get(id)).toMatchObject({ introduces: l.introduces, tier: l.tier });
        expect(light.lessons.get(id)?.minutes).toBe(l.minutes);
      }
    }
    for (const b of registry.orderedBlocks(true)) expect(light.blocks.get(b.id)?.hours).toEqual(b.hours);
  });

  it('gives the same route map as the full registry', () => {
    const light = registryFromManifest(JSON.parse(json));
    expect(light.complete).toBe(false);
    expect(light.errors).toEqual([]);
    const ids = (r: typeof registry) => r.routeMap().map((x) => (x.kind === 'block' ? `block:${x.block.id}` : `placeholder:${x.entry.id}`));
    expect(ids(light)).toEqual(ids(registry));
    expect(light.orderedLessons().map((l) => l.id)).toEqual(registry.orderedLessons().map((l) => l.id));
    for (const b of registry.orderedBlocks(true)) {
      const s = light.blocks.get(b.id);
      expect(s?.lessons, b.id).toEqual(b.lessons);
      expect(s?.title, b.id).toEqual(b.title);
      expect(light.placementCount(b.id), b.id).toBe(b.placement.length);
      expect(registry.placementCount(b.id), b.id).toBe(b.placement.length);
    }
  });

  it('leaves the shared terminal and documentation corpus alone', () => {
    const commands = terminalRegistry.commands.list().length;
    const pages = corpus.all().length;
    registryFromManifest(manifest);
    expect(terminalRegistry.commands.list().length).toBe(commands);
    expect(corpus.all().length).toBe(pages);
  });

  it('shapes stubs like content types with empty bodies', () => {
    const { lessons, blocks } = fromManifest(manifest);
    expect(lessons.every((l) => l.sections.length === 0)).toBe(true);
    expect(blocks.every((b) => b.placement.length === 0)).toBe(true);
  });
});
