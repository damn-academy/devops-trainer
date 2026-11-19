// Small helpers the route map shares with the content pages. Kept apart from
// common.ts and lesson.ts so the home page does not pull in their engines.

import { t, UI } from '../core/i18n';
import { store } from '../core/store';
import type { BlockId, Lesson, Level } from '../core/types';

export function chosenLevel(block: BlockId): Level | undefined {
  return store.state.levels[block];
}

export function lessonStatus(l: Pick<Lesson, 'id'>): 'done' | 'open' | 'new' {
  const p = store.state.lessons[l.id];
  return p?.status === 'done' ? 'done' : p ? 'open' : 'new';
}

export function setTitle(...parts: string[]): void {
  document.title = [...parts.filter(Boolean), t(UI.course)].join(' · ');
}
