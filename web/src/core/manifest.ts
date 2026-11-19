// The light manifest of the course: what the route map needs before any block
// module is downloaded. It is computed at build time from the full registry
// (src/core/manifest-plugin.ts → `virtual:dt-manifest`), so it never drifts
// from the content and builders keep writing one index.ts per block. The app
// paints the home page from it and loads the full registry (lesson bodies,
// explainers, labs, commands, the documentation corpus, exams, the quiz bank)
// on the first visit to any other page.

import type { Block, Lesson } from './types';

export const MANIFEST_VERSION = 1;

/** What the route map shows of a lesson. */
export type LessonStub = Pick<Lesson, 'id' | 'block' | 'title' | 'tier' | 'minutes'>;

/**
 * A block without its placement tasks (they carry check functions; `placementCount`
 * keeps their number) and without sources (shown only on the block page).
 */
export type BlockStub = Omit<Block, 'placement' | 'sources'> & { placementCount: number };

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
  return {
    version: MANIFEST_VERSION,
    blocks: r.orderedBlocks(true).map(({ placement, sources: _s, ...b }) => ({ ...b, placementCount: placement.length })),
    lessons: r.orderedLessons().map(({ id, block, title, tier, minutes }) => ({ id, block, title, tier, minutes })),
  };
}

/** Blocks and lessons shaped like the content types; what the manifest leaves out is empty. */
export function fromManifest(m: Manifest): { blocks: Block[]; lessons: Lesson[]; placements: Map<string, number> } {
  return {
    blocks: m.blocks.map(({ placementCount: _n, ...b }) => ({ ...b, placement: [], sources: { en: [], ru: [] } })),
    lessons: m.lessons.map((l) => ({ ...l, introduces: [], uses: [], sections: [], sources: { en: [], ru: [] } })),
    placements: new Map(m.blocks.map((b) => [b.id, b.placementCount])),
  };
}
