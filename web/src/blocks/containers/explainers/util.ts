// Helpers shared by the explainers of the containers block.

import type { Bi } from '../../../core/i18n';
import type { ElementState } from '../../../core/types';

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

/** The picture starts empty except for the given elements: every other id of `all` is hidden. */
export const startWith = (all: string[], ...shown: string[]): Record<string, ElementState> =>
  Object.fromEntries(all.filter((id) => !shown.includes(id)).map((id) => [id, 'hidden' as ElementState]));

export const man = (n: string, s: number) => ({ url: `https://man7.org/linux/man-pages/man${s}/${n}.${s}.html`, label: `${n}(${s})` });
