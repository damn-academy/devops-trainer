import { h } from '../../core/dom';
import { bi, t } from '../../core/i18n';
import { checkThreads, follows, replyTo, revision, saveFollow, statusText } from './threads';
import type { Page } from '../../app/common';

/** Small safe Markdown subset. No HTML, images or links supplied by a message. */
export function markdownLight(text: string): HTMLElement {
  const el = h('div.feedback-prose');
  for (const line of text.split('\n')) {
    const p = h('p');
    for (const part of line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)) {
      p.append(part.startsWith('**') && part.endsWith('**') ? h('strong', {}, part.slice(2,-2)) : part.startsWith('`') && part.endsWith('`') ? h('code', {}, part.slice(1,-1)) : document.createTextNode(part));
    }
    el.append(p);
  }
  return el;
}
export function messagesPage(): Page {
  const list = h('div.feedback-threads');
  const note = h('p', { role: 'status' }, t(bi('Проверяем, появились ли ответы.', 'Checking for new replies.')));
  const el = h('section.feedback-messages', {}, h('h1', {}, t(bi('Мои сообщения', 'My messages'))), h('p', {}, t(bi('Ответы доступны в этом браузере без аккаунта. Чтобы перенести переписку, сохраните файл прогресса в настройках.', 'Replies are available in this browser without an account. To move the conversation, save the progress file in Settings.'))), note, list);
  let disposed = false;
  const replyIds = new Map<string, string>();
  const render = async () => {
    const entries = await follows(); if (disposed) return;
    const drafts = new Map([...list.querySelectorAll<HTMLTextAreaElement>('textarea[data-thread]')].map(input => [input.dataset.thread!, input.value]));
    list.replaceChildren();
    if (!entries.length) list.append(h('p', {}, t(bi('Вы пока не отправляли сообщений.', 'You have not sent any messages yet.'))));
    for (const f of entries.reverse()) {
      const article = h('article.feedback-thread', {}, h('h2', {}, f.type === 'contact' ? t(bi('Письмо автору', 'Message to the author')) : t(bi('Сообщение о курсе', 'Report about the course'))), h('p.feedback-thread-status', {}, statusText(f.thread)), markdownLight(f.message));
      for (const reply of f.thread?.replies ?? []) article.append(h('section.feedback-reply', {}, h('small', {}, reply.author === 'author' ? t(bi('Автор ответил:', 'The author replied:')) : t(bi('Вы написали:', 'You wrote:'))), markdownLight(reply.message)));
      const input = h('textarea', { rows: 3, maxLength: 12000, required: true, 'aria-label': t(bi('Добавьте ответ.', 'Add a reply.')) });
      input.dataset.thread = f.id; input.value = drafts.get(f.id) ?? '';
      const send = h('button.btn', { type: 'submit' }, t(bi('Отправить', 'Send'))) as HTMLButtonElement;
      const error = h('p', { role: 'status' });
      const form = h('form', {}, h('label', {}, t(bi('Добавьте ответ.', 'Add a reply.')), input), send, error);
      if (!replyIds.has(f.id)) replyIds.set(f.id, crypto.randomUUID());
      form.addEventListener('submit', async e => {
        e.preventDefault(); if (!input.value.trim() || send.disabled) return; send.disabled = true;
        try { await replyTo(f, input.value.trim(), replyIds.get(f.id)!); input.value = ''; replyIds.set(f.id, crypto.randomUUID()); await render(); }
        catch { error.textContent = t(bi('Ответ не отправлен. Текст сохранён в форме, попробуйте ещё раз.', 'The reply was not sent. The text is kept in the form; please try again.')); send.disabled = false; }
      });
      input.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); } });
      article.append(form); list.append(article);
      if (f.thread) { f.seen = revision(f.thread); await saveFollow(f); }
    }
  };
  void (async () => { await render(); await checkThreads(true); if (!disposed) { note.textContent = t(bi('Здесь показаны последние полученные ответы. Если сети нет, новые ответы появятся при следующем открытии.', 'These are the latest replies received. Without a network, new replies appear the next time you open this page.')); await render(); } })();
  return { el, dispose() { disposed = true; } };
}
