import { documentTemplate } from './document-fields';
import { h, downloadFile } from '../../core/dom';
import { t } from '../../core/i18n';
import type { Mounted } from '../../core/types';
import { strings } from './strings';
import { loadDraft, saveDraft } from './storage';

/** An editable local document built from the authored task, without inventing a model answer. */
export function mountTaskDocument(el: HTMLElement, id: string, title: string, task: string): Mounted {
  const root = h('div', { class: 'task-document', style: 'display:grid;gap:12px;margin-block:20px' });
  const input = h('textarea', { rows: 10, 'data-document-id': id, style: 'width:100%;font:inherit;box-sizing:border-box' });
  const template = documentTemplate(id, title, task);
  const saved = loadDraft(`document.${id}`, template);
  input.value = saved === `${title}\n\n${task}\n\n` ? template : saved;
  input.dataset.documentTemplate = template;
  input.oninput = () => saveDraft(`document.${id}`, input.value);
  const download = h('button', { type: 'button', class: 'btn' }, t(strings.downloadTxt));
  download.onclick = () => downloadFile(`${id}.txt`, [input.value, ...Array.from((el.closest('.lesson-body') ?? el).querySelectorAll<HTMLTextAreaElement>('textarea[data-template-id]')).map(note => `## ${note.dataset.templateTitle}\n\n${note.value}`)].join('\n\n'), 'text/plain;charset=utf-8');
  root.append(h('label', {}, t(strings.input), input), download); el.append(root);
  return { dispose() { root.remove(); } };
}
