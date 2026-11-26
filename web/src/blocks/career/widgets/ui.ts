// Small shared pieces of the career widgets.

import { h } from '../../../core/dom';
import { bi, t, type Bi } from '../../../core/i18n';
import { store } from '../../../core/store';
import type { QText, StoreEvent } from '../../../core/types';
import { renderMd } from '../../../core/markdown';

/**
 * Prose in the current language. Widgets render it with the markdown-lite of
 * the core (no app imports: block modules load in tests without a DOM).
 */
export function prose(b: Bi | string, cls = 'prose'): HTMLElement {
  return h(`div.${cls}`, {}, renderMd(typeof b === 'string' ? b : t(b)));
}

/** A terminal string in mono, prose otherwise. */
export function qtextBlock(q: QText): HTMLElement {
  return typeof q === 'string' ? h('pre.cw-out', {}, q) : prose(q, 'prose cw-say');
}

/** Events of one engine kind from the log, oldest first. */
export function eventsOf<T = Record<string, unknown>>(kind: string): (StoreEvent & T)[] {
  return store.log.filter((e) => e.kind === kind) as (StoreEvent & T)[];
}

/** Read a saved value; undefined in a private window or on error. */
export async function load<T>(key: string): Promise<T | undefined> {
  try {
    return await store.getKV<T>(`career:${key}`);
  } catch {
    return undefined;
  }
}

export function save(key: string, value: unknown): void {
  void store.setKV(`career:${key}`, value);
}

export function scoreDots(score: number): HTMLElement {
  return h('span.cw-dots', {}, h('b', { style: 'font-weight:normal;margin-right:6px' }, t(bi(`Оценка ${score} из 3`, `Score ${score} out of 3`))), ...[1, 2, 3].map((i) => h('span', { class: i <= score ? 'on' : '' })));
}

export function label(b: Bi): string {
  return t(b);
}

/** A short "debounce then save" for text areas. */
export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms = 400): (...a: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...a: A) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...a), ms);
  };
}
