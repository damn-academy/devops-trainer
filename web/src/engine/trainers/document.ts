import { documentTemplate } from './document-fields';
import { h, downloadFile } from '../../core/dom';
import briefRu from '../../blocks/aicontent/aicontent-1.ru.md?raw';
import briefEn from '../../blocks/aicontent/aicontent-1.en.md?raw';
import { lang, t } from '../../core/i18n';
import type { Mounted } from '../../core/types';
import { strings } from './strings';
import { loadDraft, saveDraft } from './storage';

export function documentExample(id: string): string {
  if (!id.startsWith('aicontent.brief')) return '';
  const source = (lang() === 'ru' ? briefRu : briefEn).split('<!-- lesson: aicontent.brief')[1] ?? '';
  const blocks = [...source.split('<!-- quiz -->')[0].matchAll(/```markdown\n([\s\S]*?)```/g)].map(match => match[1].trim());
  return `\n\n# ${lang() === 'ru' ? 'Образец' : 'Example'}\n\n${blocks.join('\n\n')}`;
}

/** An editable local document built from the authored task, without inventing a model answer. */
export function mountTaskDocument(el: HTMLElement, id: string, title: string, task: string): Mounted {
  const root = h('div', { class: 'task-document', style: 'display:grid;gap:12px;margin-block:20px' });
  const input = h('textarea', { rows: 10, 'data-document-id': id, style: 'width:100%;font:inherit;box-sizing:border-box' });
  const template = documentTemplate(id, title, task);
  const saved = loadDraft(`document.${id}`, template);
  input.value = saved === `${title}\n\n${task}\n\n` ? template : saved;
  input.dataset.documentTemplate = template;
  input.oninput = () => saveDraft(`document.${id}`, input.value);
  const download = h('button', { type: 'button', class: 'btn' }, t(id.startsWith('aicontent.brief') ? strings.downloadDocumentExample : strings.downloadTxt));
  download.onclick = () => downloadFile(`${id}.txt`, [`${id.startsWith('metrics.') ? `# ${t(strings.mainDocument)}\n\n` : ''}${input.value}${documentExample(id)}`, ...Array.from((el.closest('.lesson-body') ?? el).querySelectorAll<HTMLTextAreaElement>('textarea[data-template-id]')).map(note => `## ${note.dataset.templateId?.startsWith('metrics-') ? t(strings.cardCalculation).replace('{name}', note.dataset.templateTitle ?? '') : note.dataset.templateTitle}\n\n${note.value}`)].join('\n\n'), 'text/plain;charset=utf-8');
  root.append(h('label', {}, t(id.startsWith('metrics.') ? strings.mainDocument : strings.input), input), download); el.append(root);
  return { dispose() { root.remove(); } };
}
