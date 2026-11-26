import { documentTemplate } from './document-fields';
import { h, downloadFile } from '../../core/dom';
import briefRu from '../../blocks/aicontent/aicontent-1.ru.md?raw';
import briefEn from '../../blocks/aicontent/aicontent-1.en.md?raw';
import { bi, lang, t } from '../../core/i18n';
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
export function mountTaskDocument(el: HTMLElement, id: string, title: string, task: string, complete?: () => void, alreadyDone = false): Mounted {
  const root = h('div', { class: 'task-document', style: 'display:grid;gap:12px;margin-block:20px' });
  const template = documentTemplate(id, title, task);
  const input = h('textarea', { rows: 10, 'data-document-id': id, placeholder: t(bi('Запишите здесь свой результат по заданию выше.', 'Write your result for the task above here.')), style: 'width:100%;font:inherit;box-sizing:border-box' });
  const saved = loadDraft(`document.${id}`, template);
  // Earlier versions pre-filled the field with a copy of the task; such an
  // untouched copy is replaced by the blank form.
  input.value = !saved.trim() ? template : saved.startsWith(`${title}\n\n`) && saved.replace(/\s+/g, '').length <= `${title}${task}${template}`.replace(/\s+/g, '').length && saved.includes(task.slice(0, 40)) ? template : saved;
  input.dataset.documentTemplate = template;
  const edited = () => input.value.trim() !== '' && input.value.trim() !== template.trim();
  const download = h('button', { type: 'button', class: 'btn' }, t(id.startsWith('aicontent.brief') ? strings.downloadDocumentExample : strings.downloadTxt));
  download.onclick = () => downloadFile(`${id}.txt`, [`${id.startsWith('metrics.') ? `# ${t(strings.mainDocument)}\n\n` : ''}${input.value}${documentExample(id)}`, ...Array.from((el.closest('.lesson-body') ?? el).querySelectorAll<HTMLTextAreaElement>('textarea[data-template-id]')).map(note => `## ${note.dataset.templateId?.startsWith('metrics-') ? t(strings.cardCalculation).replace('{name}', note.dataset.templateTitle ?? '') : note.dataset.templateTitle}\n\n${note.value}`)].join('\n\n'), 'text/plain;charset=utf-8');
  root.append(h('p.task-guide', {}, t(bi('Запишите результат задания в поле ниже: черновик сохраняется в этом браузере после каждого изменения. Сверьте работу с требованиями задания сами и, если нужно, скачайте текст. Затем нажмите «Завершить самопроверку»: урок отметит практику выполненной, а текст останется в поле.', 'Write the task result in the field below: the draft is saved in this browser after every change. Check the work against the task requirements yourself and download the text if you need it. Then press “Finish self-review”: the lesson marks the practice done and the text stays in the field.'))), h('label', {}, t(id.startsWith('metrics.') ? strings.mainDocument : strings.input), input), download); el.append(root);
  let done = alreadyDone;
  const status = h('p', { role: 'status' });
  // The status speaks about the text in the field now, so a cleared field is not called saved.
  const showStatus = () => { status.textContent = !done ? '' : t(edited() ? bi('Самопроверка завершена. Текст сохранён в этом браузере.', 'Self-review complete. The text is saved in this browser.') : bi('Самопроверка была завершена, но поле сейчас пустое.', 'Self-review was completed, but the field is empty now.')); };
  const finish = h('button.btn', { type: 'button', disabled: !edited(), onclick: () => { if (!edited()) return; complete?.(); done = true; showStatus(); } }, t(bi('Завершить самопроверку', 'Finish self-review'))) as HTMLButtonElement;
  const hint = h('p.small.muted', { hidden: edited() }, t(bi('Кнопка станет доступна, когда вы запишете результат.', 'The button becomes available once you write the result.')));
  input.oninput = () => { saveDraft(`document.${id}`, input.value); finish.disabled = !edited(); hint.hidden = edited(); showStatus(); };
  showStatus();
  root.append(finish, hint, status);
  return { dispose() { root.remove(); } };
}
