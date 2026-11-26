import { copyText, downloadFile, h } from '../../core/dom';
import { bi, lang, t } from '../../core/i18n';
import { PRODUCTS, productById } from '../../core/products';
import { registry } from '../../core/registry';
import { parseRoute } from '../../core/router';
import { store } from '../../core/store';
import type { Level, QText, QuizGrade, QuizItem } from '../../core/types';
import { currentTask, templateTask, templateDraft, documentDraft, terminalTail, vocabulary, where } from './context';
import { chatLink, EXTERNAL_CHATS, packExternalPrompt, type ExternalContext } from './external-prompt';
import { maskSecrets } from './prompt';
import './ai.css';

let closeActive: (() => void) | undefined;

export const EXTERNAL_LABEL = bi('Спросить нейросеть', 'Ask the AI');
export interface ExternalOptions {
  lessonId?: string;
  templateFile?: string;
  level?: Level;
  task?: string;
  screen?: string;
  quiz?: Pick<ExternalContext, 'task' | 'options' | 'response'>;
  want?: string;
}
/** Concept links `[[id]]` and `[[id|text]]` become plain words before the text leaves the page. */
export function plainConcepts(text: string | undefined): string | undefined {
  return text?.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, id: string, label?: string) => label ?? (registry.concepts.get(id) ? t(registry.concepts.get(id)!.term) : id));
}
export function externalContext(o: ExternalOptions = {}): ExternalContext {
  const route = parseRoute(typeof location === 'undefined' ? '' : location.hash);
  const lesson = where().lesson || (o.lessonId && registry.lessons.get(o.lessonId)) || (route.name === 'explainer' ? [...registry.lessons.values()].find(l => l.sections.some(s => s.kind === 'explainer' && s.explainer === route.id)) : undefined);
  const block = lesson?.block;
  const task = (templateTask(lesson, o.templateFile) ?? currentTask(lesson))?.task;
  const dataTasks = o.templateFile ? [] : (lesson?.sections ?? []).flatMap(section => {
    if (section.kind !== 'widget' || section.widget !== 'template') return [];
    const file = (section.props as { file?: string } | undefined)?.file;
    if (!file || !templateDraft(file).trim()) return [];
    const exercise = templateTask(lesson, file);
    return exercise ? [`## ${file}\n\n${t(exercise.task.prompt)}`] : [];
  });
  const criteria = dataTasks.length
    ? [...(documentDraft(lesson, undefined, false) && task ? [t(task.prompt)] : []), ...dataTasks].join('\n\n')
    : task ? t(task.prompt) : undefined;
  return {
    lang: lang(), level: o.level ?? ((block && store.state.levels[block]) || 'beginner'),
    course: block ? t(productById(block)?.title ?? registry.blocks.get(block)?.title ?? bi(block, block)) : undefined,
    block: block ? t(registry.blocks.get(block)?.title ?? bi(block, block)) : undefined,
    lesson: lesson ? t(lesson.title) : undefined, introduced: vocabulary(lesson),
    task: plainConcepts(o.task ?? criteria),
    draft: o.quiz ? undefined : o.templateFile ? templateDraft(o.templateFile) : documentDraft(lesson),
    terminal: terminalTail(), screen: o.screen, ...o.quiz, want: o.want,
  };
}
export function externalButton(o: ExternalOptions | (() => ExternalOptions) = {}): HTMLButtonElement {
  const b = h('button.btn.ghost.small.external-help', { type: 'button', hidden: where().exam }, t(EXTERNAL_LABEL)) as HTMLButtonElement;
  b.addEventListener('click', () => openExternalPanel(typeof o === 'function' ? o() : o));
  return b;
}

export function openExternalPanel(o: ExternalOptions = {}): void {
  if (where().exam) return;
  closeActive?.();
  const previous = document.activeElement as HTMLElement | null;
  const dialog = h('dialog.external-dialog', { 'aria-labelledby': 'external-title' }) as HTMLDialogElement;
  const textarea = h('textarea.external-preview', { rows: 14, 'aria-label': t(bi('Запрос для нейросети', 'Prompt for AI')) }) as HTMLTextAreaElement;
  const context = externalContext(o);
  textarea.value = packExternalPrompt(context);
  const status = h('p.small', { role: 'status' });
  const close = () => { dialog.remove(); window.removeEventListener('hashchange', close); closeActive = undefined; previous?.focus(); };
  closeActive = close;
  const sanitized = () => {
    const value = maskSecrets(textarea.value);
    if (value !== textarea.value) {
      textarea.value = value;
      status.textContent = t(bi('Запрос очищен и сокращён. Проверьте его и нажмите кнопку ещё раз.', 'The prompt was masked and trimmed. Review it and press the button again.'));
      return null;
    }
    return value;
  };
  const copy = async (value: string) => {
    const ok = await copyText(value);
    status.textContent = t(ok ? bi('Запрос скопирован. Вставьте его в выбранный чат.', 'The prompt is copied. Paste it into the selected chat.') : bi('Не удалось скопировать. Удерживайте текст для выделения или скачайте файл.', 'Copy failed. Select the text and copy it manually.'));
    return ok;
  };
  const buttons = h('div.external-chats');
  buttons.append(h('button.btn.primary', { type: 'button', onclick: () => { const value = sanitized(); if (value !== null) void copy(value); } }, t(bi('Копировать', 'Copy'))));
  buttons.append(h('button.btn', { type: 'button', onclick: () => { const value = sanitized(); if (value !== null) downloadFile('prompt.txt', value, 'text/plain;charset=utf-8'); } }, t(bi('Скачать запрос (.txt)', 'Download prompt (.txt)'))));
  for (const chat of EXTERNAL_CHATS) buttons.append(h('button.btn.ghost.small', { type: 'button', onclick: () => {
    const value = sanitized();
    if (value === null || where().exam) return;
    // Open synchronously during the click to avoid popup blockers. No opener is retained.
    const link = chatLink(chat, value);
    void copy(value);
    window.open(link.url, '_blank', 'noopener,noreferrer');
  } }, chat.name));
  if (registry.mentor?.ready()) buttons.append(h('button.btn.ghost.small', { type: 'button', onclick: async () => {
    const value = sanitized();
    if (value === null || where().exam) return;
    close();
    const { openTutor } = await import('./panel');
    openTutor({ mode: o.quiz ? 'review' : o.task ? 'practice' : 'explain', question: value, templateFile: o.templateFile });
  } }, t(bi('Спросить здесь', 'Ask here'))));
  dialog.append(h('h2', { id: 'external-title' }, t(EXTERNAL_LABEL)),
    // Only a prompt that carries a draft has draft sections to remove.
    h('p.small', {}, t(context.draft?.trim() ? bi('Проверьте запрос перед отправкой. Можно изменить текст, удалить разделы с черновиками карточек и написать, что вы хотите понять.', 'Review the prompt before sharing. You can edit it, remove card draft sections and describe what you want to understand.') : bi('Проверьте запрос перед отправкой. Можно изменить текст и написать, что вы хотите понять.', 'Review the prompt before sharing. You can edit it and describe what you want to understand.'))),
    textarea, buttons, status, h('button.btn.ghost', { type: 'button', onclick: close }, t(bi('Закрыть', 'Close'))));
  dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
  window.addEventListener('hashchange', close);
  document.body.append(dialog);
  dialog.showModal();
  textarea.focus();
  textarea.setSelectionRange(0, 0);
  textarea.scrollTop = 0;
}

/** Standalone courses (the business track) do not prepare for a job interview. */
const businessLesson = (id?: string) => { const block = id ? registry.lessons.get(id)?.block : undefined; return !!block && PRODUCTS.some(p => p.kind === 'course' && p.id === block); };

/** Called only after grading; no quiz object is serialized into an external prompt. */
export function answeredQuiz(item: QuizItem, answer: unknown, grade: QuizGrade, actual?: string): ExternalOptions {
  const right = grade.correct;
  const text = (v: QText) => typeof v === 'string' ? v : t(v);
  let options: string[] = [];
  let correct = '';
  if ('options' in item && item.options) {
    options = item.options.map(v => `${v.id}: ${text(v.text)}`);
    correct = item.options.filter(v => v.correct).map(v => `${v.id}: ${text(v.text)}`).join('\n');
  }
  switch (item.kind) {
    case 'order': options = item.steps.map(v => `${v.id}: ${text(v.text)}`).sort(); correct = item.steps.map(v => v.id).join(' → '); break;
    case 'match': options = item.pairs.map(v => `${v.id}: ${text(v.left)} → ${text(v.right)}`); correct = options.join('\n'); break;
    case 'label': options = item.labels.map(v => `${v.id}: ${text(v.text)}`); correct = item.diagram.slots.map(v => `${v.id}: ${v.answer}`).join('\n'); break;
    case 'bugfind': correct = item.bug.join(', '); break;
    case 'fill-command': correct = item.answers?.join('\n') ?? ''; break;
    case 'predict-output': correct = actual ?? correct; break;
  }
  const task = [t(item.prompt), item.kind === 'bugfind' ? item.code : item.kind === 'predict-output' ? item.command : item.kind === 'fill-command' ? item.template : ''].filter(Boolean).join('\n');
  const want = right
    ? t(businessLesson(item.refs?.lesson)
      ? bi('Мой ответ верный, но я хочу разобраться глубже: почему это так, где это встречается на практике и как это проверить в своей работе.', 'I answered correctly but want to go deeper: why it is so, where it shows up in practice and how to check it in my own work.')
      : bi('Мой ответ верный, но я хочу разобраться глубже: почему это так, где это встречается на практике и что спросят об этом на собеседовании.', 'I answered correctly but want to go deeper: why it is so, where it shows up in practice and what an interviewer might ask about it.'))
    : undefined;
  return { lessonId: item.refs?.lesson, want, quiz: { task, options, response: { answered: true, learner: typeof answer === 'string' ? (options.find(v => v.startsWith(answer + ': ')) ?? answer) : JSON.stringify(answer), correct, explanation: [...new Set([...(item.explain ? [t(item.explain)] : []), ...grade.feedback.map(b => t(b))])].join('\n') } } };
}

/** AI-owned integration keeps shared explainer rendering independent of AI. */
export function installExternalCards(): void {
  const observer = new MutationObserver(() => {
    if (where().exam) return;
    for (const card of document.querySelectorAll<HTMLElement>('.ex-card:not([hidden])')) {
      if (!card.querySelector('.external-help')) card.append(externalButton(() => ({ screen: Array.from(card.children).filter(c => !c.classList.contains('external-help')).map(c => c.textContent).join('\n') })));
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
}
