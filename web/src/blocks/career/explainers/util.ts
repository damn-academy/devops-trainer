// Helpers shared by the career explainers.

import { pluralRu, type Bi } from '../../../core/i18n';
import type { ElementState } from '../../../core/types';

/** fmt with values that may themselves be bilingual: {v} takes v.ru in Russian and v.en in English. */
export function fmtb(b: Bi, vars: Record<string, string | number | Bi>): Bi {
  const fill = (s: string, lang: 'ru' | 'en') =>
    s.replace(/\{(\w+)\}/g, (m, k) => {
      const v = vars[k];
      if (v === undefined) return m;
      if (typeof v === 'object') return v[lang];
      if (typeof v === 'number' && lang === 'ru') return String(v).replace('.', ',');
      return String(v);
    });
  return { ru: fill(b.ru, 'ru'), en: fill(b.en, 'en') };
}

/** A number rounded to one decimal, as a bilingual string with the decimal comma in Russian. */
export const num1 = (x: number): Bi => {
  const s = (Math.round(x * 10) / 10).toString();
  return { ru: s.replace('.', ','), en: s };
};

/**
 * A number with its noun in both languages: «1,8 ответа», «5 откликов», «21 отклик».
 * A fractional number takes the genitive singular, as Russian requires.
 */
export function nouned(x: number, ru: [string, string, string], en: [string, string]): Bi {
  const r = Math.round(x * 10) / 10;
  const n = num1(r);
  const form = Number.isInteger(r) ? pluralRu(r, ru) : ru[1];
  return { ru: `${n.ru} ${form}`, en: `${n.en} ${r === 1 ? en[0] : en[1]}` };
}

/** Every listed element starts hidden except the given ones. */
export const startWith = (all: string[], ...shown: string[]): Record<string, ElementState> =>
  Object.fromEntries(all.filter((id) => !shown.includes(id)).map((id) => [id, 'hidden' as ElementState]));
