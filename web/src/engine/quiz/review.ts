// Reference answers in completed assessment reports; never shown during a task.
import { h } from '../../core/dom';
import { bi, t } from '../../core/i18n';
import { renderInline, renderMd } from '../../core/markdown';
import type { QuizItem, QText } from '../../core/types';

export function referenceAnswer(item: QuizItem): HTMLElement {
  const root = h('div.assessment-reference');
  const add = (text: QText) => root.append(h('p', {}, ...renderInline(t(text))));
  root.append(h('strong', {}, t(bi('Правильный ответ', 'Reference answer'))));
  switch (item.kind) {
    case 'mcq': case 'multi': case 'predict-output':
      for (const option of item.options ?? []) if (option.correct) { add(option.text); if (option.why) root.append(renderMd(t(option.why))); }
      break;
    case 'order': item.steps.forEach((step, i) => add(`${i + 1}. ${t(step.text)}`)); break;
    case 'match': item.pairs.forEach(pair => { add(`${t(pair.left)} → ${t(pair.right)}`); if (pair.why) root.append(renderMd(t(pair.why))); }); break;
    case 'fill-command': for (const answer of item.answers ?? []) root.append(h('pre', {}, answer)); break;
    case 'bugfind': item.bug.forEach(line => { add(`${line}. ${item.code.split('\n')[line - 1]}`); if (item.why[line]) root.append(renderMd(t(item.why[line]))); }); break;
    case 'label': item.diagram.slots.forEach((slot, i) => { const label = item.labels.find(l => l.id === slot.answer); if (label) add(`${i + 1}. ${t(label.text)}`); }); break;
  }
  if (item.explain) root.append(renderMd(t(item.explain)));
  return root;
}
