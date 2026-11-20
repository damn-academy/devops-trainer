// The engine's order item cannot be submitted yet: its "Check" button stays
// disabled after the learner rearranges the steps (engine/quiz/render.ts,
// case 'order', never calls update()). Until that is fixed, the career
// block shows its order items as a match of each step to its place, which
// the engine submits and grades correctly. Remove this mapping once the
// order widget enables "Check".

import { bi } from '../../core/i18n';
import type { MatchItem, QuizItem } from '../../core/types';

const place = (n: number) => bi(`На ${n}-м месте`, `In place ${n}`);

export function orderAsMatch<T extends QuizItem>(item: T): T | MatchItem {
  if (item.kind !== 'order') return item;
  const { steps, kind: _kind, ...base } = item;
  return {
    ...base,
    kind: 'match',
    prompt: bi(`${item.prompt.ru} Для каждой строки выберите её место по порядку.`, `${item.prompt.en} For each line choose its place in the order.`),
    pairs: steps.map((s, i) => ({ id: s.id, left: s.text, right: place(i + 1), why: s.why })),
  };
}
