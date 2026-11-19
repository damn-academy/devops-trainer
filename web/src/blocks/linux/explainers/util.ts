// Helpers shared by the Linux explainers.

import type { Bi } from '../../../core/i18n';

/** fmt with values that may themselves be bilingual: {v} takes v.ru in Russian and v.en in English. */
export function fmtb(b: Bi, vars: Record<string, string | number | Bi>): Bi {
  const fill = (s: string, lang: 'ru' | 'en') => s.replace(/\{(\w+)\}/g, (m, k) => {
    const v = vars[k];
    if (v === undefined) return m;
    return typeof v === 'object' ? v[lang] : String(v);
  });
  return { ru: fill(b.ru, 'ru'), en: fill(b.en, 'en') };
}
