// The pet-projects block: ten independent projects after the career block,
// each with a sequential algorithm, a “where to recall” list of course links
// and the honest one-way-not-a-law note.
import { describe, expect, it } from 'vitest';
import { PET_CONCEPTS } from '../src/blocks/pet-projects/concepts';
import { PET_PROJECTS } from '../src/blocks/pet-projects/index';
import { PET_LESSONS_1 } from '../src/blocks/pet-projects/lessons-1';
import { PET_LESSONS_2 } from '../src/blocks/pet-projects/lessons-2';
import { HONEST_NOTE } from '../src/blocks/pet-projects/shared';
import { conceptLinks } from '../src/core/markdown';
import { ROUTE } from '../src/core/route';
import { loadRegistry, registry } from '../src/core/registry';

const ALL = [...PET_LESSONS_1, ...PET_LESSONS_2];

describe('pet-projects block', () => {
  it('sits on the route right after career, with no placement and no level gate', () => {
    const i = ROUTE.findIndex((e) => e.id === 'pet-projects');
    expect(i).toBeGreaterThan(-1);
    expect(ROUTE[i - 1]!.id).toBe('career');
    expect(PET_PROJECTS.order).toBeGreaterThan(ROUTE[i - 1]!.order);
    expect(PET_PROJECTS.placement).toEqual([]);
    expect(PET_PROJECTS.beginnerOnly).toBeUndefined();
    expect(PET_PROJECTS.hidden).toBeUndefined();
  });

  it('has ten lessons, one per project, all listed in the block', () => {
    expect(ALL).toHaveLength(10);
    expect(PET_PROJECTS.lessons).toEqual(ALL.map((l) => l.id));
    for (const l of ALL) {
      expect(l.block).toBe('pet-projects');
      expect(l.sources.en.length).toBeGreaterThan(0);
      expect(l.sources.ru.length).toBeGreaterThan(0);
    }
  });

  it('gives every project an intro, an algorithm, a recall list and the honest note', () => {
    for (const l of ALL) {
      const ids = l.sections.map((s) => s.id);
      expect(ids).toEqual(['hook', 'algorithm', 'recall', 'honest']);
      const byId = new Map(l.sections.map((s) => [s.id, s]));
      const algo = byId.get('algorithm')!;
      const recall = byId.get('recall')!;
      const honest = byId.get('honest')!;
      if (algo.kind !== 'text' || recall.kind !== 'text') throw new Error(`${l.id}: algorithm/recall is not a text section`);
      if (honest.kind !== 'callout') throw new Error(`${l.id} § honest is not a callout`);
      // The algorithm is an ordered plain list with no recipes: numbered
      // steps, no fenced code.
      expect(algo.body.ru).toMatch(/1\. /);
      expect(algo.body.ru).not.toContain('```');
      // The recall list links back to the course with [[concept]] links.
      expect(conceptLinks(recall.body.ru).length).toBeGreaterThanOrEqual(2);
      expect(honest.body).toBe(HONEST_NOTE);
    }
  });

  it('introduces its own concepts and links only concepts introduced earlier', async () => {
    await loadRegistry();
    const pos = (id: string) => registry.position(id);
    const introduced = new Set(ALL.flatMap((l) => l.introduces));
    for (const c of PET_CONCEPTS) expect(introduced.has(c.id)).toBe(true);
    for (const l of ALL) {
      const here = pos(l.id);
      for (const s of l.sections) {
        if (s.kind !== 'text' && s.kind !== 'callout') continue;
        for (const link of conceptLinks(s.body.ru)) {
          const c = registry.concepts.get(link.id);
          expect(c, `${l.id} links unknown concept ${link.id}`).toBeTruthy();
          expect(pos(c!.introducedIn), `${l.id} links ${link.id} before its lesson`).toBeLessThanOrEqual(here);
        }
      }
    }
  });
});
