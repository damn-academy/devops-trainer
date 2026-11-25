// The light manifest of the course: what the route map needs before any block
// module is downloaded. It is computed at build time from the full registry
// (src/core/manifest-plugin.ts → `virtual:dt-manifest`), so it never drifts
// from the content and builders keep writing one index.ts per block. The app
// paints the home page from it and loads the full registry (lesson bodies,
// course modules and summaries, explainers, labs, commands, documentation,
// exams and the quiz bank)
// on the first visit to any other page.

import type { Block, Lesson } from './types';

export const MANIFEST_VERSION = 2;

/** Identity/order for all lessons; progress and duration only for visible route blocks. */
export type LessonStub = Pick<Lesson, 'id' | 'block' | 'title' | 'tier' | 'minutes'> & Partial<Pick<Lesson, 'introduces'>>;

/** Explicit allowlist: new course detail fields must not grow the first download. */
export type BlockStub = Pick<Block, 'id' | 'order' | 'title' | 'lessons' | 'hidden' | 'beginnerOnly' | 'hours'>
  & Partial<Pick<Block, 'summary' | 'levels'>> & { placementCount: number };

export interface Manifest {
  version: typeof MANIFEST_VERSION;
  blocks: BlockStub[];
  lessons: LessonStub[];
}

interface Source {
  orderedBlocks(includeHidden?: boolean): Block[];
  orderedLessons(): Lesson[];
}

export function toManifest(r: Source): Manifest {
  const blocks = r.orderedBlocks(true);
  const visible = new Set(blocks.filter(b => !b.hidden).map(b => b.id));
  return {
    version: MANIFEST_VERSION,
    blocks: blocks.map(({ id, order, title, lessons, hidden, beginnerOnly, hours, summary, levels, placement }) => ({
      id, order, title, lessons, placementCount: placement.length,
      ...(hidden ? { hidden } : { summary, levels }),
      ...(beginnerOnly ? { beginnerOnly } : {}),
      ...(hours ? { hours } : {}),
    })),
    lessons: r.orderedLessons().map(({ id, block, title, tier, minutes, introduces }) => ({
      id, block, title, tier,
      ...(visible.has(block) ? { ...(minutes === undefined ? {} : { minutes }), introduces } : {}),
    })),
  };
}

/** Blocks and lessons shaped like the content types; what the manifest leaves out is empty. */
export function fromManifest(m: Manifest): { blocks: Block[]; lessons: Lesson[]; placements: Map<string, number> } {
  return {
    blocks: m.blocks.map(({ placementCount: _n, ...b }) => ({
      ...b,
      summary: b.summary ?? { en: '', ru: '' },
      levels: b.levels ?? { beginner: { en: '', ru: '' }, intermediate: { en: '', ru: '' }, experienced: { en: '', ru: '' } },
      checklistStep: null,
      placement: [],
      sources: { en: [], ru: [] },
    })),
    lessons: m.lessons.map((l) => ({ ...l, introduces: l.introduces ?? [], uses: [], sections: [], sources: { en: [], ru: [] } })),
    placements: new Map(m.blocks.map((b) => [b.id, b.placementCount])),
  };
}
