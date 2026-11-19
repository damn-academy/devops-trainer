// Small builders for the diagrams of the methodology block: every node and
// edge carries a card (what it is, who creates it, where it is written), and
// the pictures are built from zero step by step, so a helper hides everything
// except the elements a run starts with.

import { bi, t, type Bi } from '../../../core/i18n';
import type { ColorFamily, DiagramEdge, DiagramNode, DocRef, ElementCard, ElementState, QText, Step } from '../../../core/types';

export const b = bi;
export type { Bi };

export const card = (what: [string, string], who: [string, string], doc?: DocRef, see?: string): ElementCard => ({ what: bi(what[0], what[1]), who: bi(who[0], who[1]), doc, see });

export function node(id: string, label: QText, family: ColorFamily, box: [number, number, number, number], c: ElementCard, more: Partial<DiagramNode> = {}): DiagramNode {
  const [x, y, w, h] = box;
  return { id, label, family, x, y, w, h, card: c, ...more };
}

export function edge(id: string, from: string, to: string, label: QText, c: ElementCard, more: Partial<DiagramEdge> = {}): DiagramEdge {
  return { id, from, to, label, card: c, ...more };
}

/** Every element of `all` is hidden except those listed: the first step of a run that builds its picture. */
export const hiddenExcept = (all: string[], ...shown: string[]): Record<string, ElementState> => Object.fromEntries(all.filter((id) => !shown.includes(id)).map((id) => [id, 'hidden' as ElementState]));

/** The metrics of the last step of a run. */
export const lastMetrics = (s: Step[]): Record<string, number> => s[s.length - 1]?.metrics ?? {};

/** A number as Russian writes it: 12,5 with a comma, thousands split by a thin space. */
export const ruNum = (n: number): string => (Number.isInteger(n) ? Math.abs(n) >= 10000 ? n.toLocaleString('ru-RU') : String(n) : String(n).replace('.', ','));
const enNum = (n: number): string => (Number.isInteger(n) && Math.abs(n) >= 10000 ? n.toLocaleString('en-US') : String(n));

/**
 * Fill {name} placeholders in both halves, writing numbers in each language's
 * own way and taking the matching half of a Bi value.
 */
export function fmtn(text: Bi, vars: Record<string, string | number | Bi>): Bi {
  const fill = (s: string, lang: 'ru' | 'en') =>
    s.replace(/\{(\w+)\}/g, (m, k) => {
      if (!(k in vars)) return m;
      const v = vars[k];
      if (typeof v === 'number') return lang === 'ru' ? ruNum(v) : enNum(v);
      if (typeof v === 'string') return v;
      return v[lang];
    });
  return { ru: fill(text.ru, 'ru'), en: fill(text.en, 'en') };
}

/** "12,5 рабочих дня" / "12.5 working days": a number with its word in the right form. */
export function nWord(n: number, ru: [string, string, string], en: [string, string], ruFraction = ru[1]): Bi {
  const ruForm = !Number.isInteger(n) ? ruFraction : ((a) => (a % 100 > 10 && a % 100 < 20 ? ru[2] : a % 10 === 1 ? ru[0] : a % 10 >= 2 && a % 10 <= 4 ? ru[1] : ru[2]))(Math.abs(n));
  return { ru: `${ruNum(n)} ${ruForm}`, en: `${enNum(n)} ${n === 1 ? en[0] : en[1]}` };
}

/** A number in a node value, written the reader's way: «43,2» in Russian, “43.2” in English. */
export const numIn = (n: number): string => t(bi(ruNum(n), enNum(n)));

/** A percentage in a node value: «99,9 %» in Russian, “99.9%” in English. */
export const pctIn = (n: number): string => t(bi(`${ruNum(n)} %`, `${enNum(n)}%`));
