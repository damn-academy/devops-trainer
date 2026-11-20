// Small helpers the route map shares with the content pages. Kept apart from
// common.ts and lesson.ts so the home page does not pull in their engines.

import { t, UI } from '../core/i18n';
import { registry } from '../core/registry';
import { store } from '../core/store';
import type { BlockId, Lesson, Level } from '../core/types';

export function chosenLevel(block: BlockId): Level | undefined {
  return store.state.levels[block];
}

export function lessonStatus(l: Pick<Lesson, 'id'>): 'done' | 'open' | 'new' {
  const p = store.state.lessons[l.id];
  const lesson = registry.lessons.get(l.id);
  if (lesson && placementDisposition(lesson) === 'covered') return 'done';
  return p?.status === 'done' ? 'done' : p ? 'open' : 'new';
}

export function setTitle(...parts: string[]): void {
  document.title = [...parts.filter(Boolean), t(UI.course)].join(' · ');
}

/** A passed placement covers the block except the reported gaps. */
export function placementDisposition(l: Lesson): 'covered' | 'required' | 'optional' | undefined {
  const level = chosenLevel(l.block);
  const result = store.state.placement[l.block]?.filter(r => r.claimed === level).at(-1);
  if (!result) return undefined;
  if (l.introduces.some(c => result.gaps.includes(c))) return 'required';
  if (result.passed) return 'covered';
  return 'optional';
}

/** Estimated hours left, weighted by authored lesson durations. */
export function remainingShare(block: BlockId): number {
  const lessons = [...registry.lessons.values()].filter(l => l.block === block);
  const total = lessons.reduce((sum, l) => sum + (l.minutes ?? 1), 0);
  return total ? lessons.filter(l => lessonStatus(l) !== 'done').reduce((sum, l) => sum + (l.minutes ?? 1), 0) / total : 1;
}
