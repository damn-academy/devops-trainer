// Helpers shared by the Orientation explainers: element cards, bilingual
// placeholders and the "picture built from zero" start state.

import type { Bi } from '../../../core/i18n';
import type { ElementCard, ElementState } from '../../../core/types';

export const card = (what: Bi, who: Bi, extra: Partial<ElementCard> = {}): ElementCard => ({ what, who, ...extra });

/** fmt with values that may themselves be bilingual: {v} takes v.ru in Russian and v.en in English. */
export function fmtb(b: Bi, vars: Record<string, string | number | Bi>): Bi {
  const fill = (s: string, lang: 'ru' | 'en') =>
    s.replace(/\{(\w+)\}/g, (m, k) => {
      const v = vars[k];
      if (v === undefined) return m;
      return typeof v === 'object' ? v[lang] : String(v);
    });
  return { ru: fill(b.ru, 'ru'), en: fill(b.en, 'en') };
}

/** Every element of `all` except `shown` starts hidden; later steps reveal them. */
export const startWith = (all: string[], ...shown: string[]): Record<string, ElementState> =>
  Object.fromEntries(all.filter((id) => !shown.includes(id)).map((id) => [id, 'hidden' as ElementState]));

/** The last value of a metric in a run. */
export const lastMetric = (steps: { metrics?: Record<string, number> }[], id: string): number => {
  for (let i = steps.length - 1; i >= 0; i--) {
    const v = steps[i].metrics?.[id];
    if (v !== undefined) return v;
  }
  return 0;
};

/** Compares a metric before and after a change: 'up', 'down' or 'same' (within `tolerance`, a share of the old value). */
export const compare = (before: number, after: number, tolerance = 0): 'up' | 'down' | 'same' => {
  const d = after - before;
  if (Math.abs(d) <= Math.abs(before) * tolerance || d === 0) return 'same';
  return d > 0 ? 'up' : 'down';
};

/** A number with a decimal comma for Russian text: 2.1 → «2,1». */
export const ruNum = (x: number) => String(x).replace('.', ',');
