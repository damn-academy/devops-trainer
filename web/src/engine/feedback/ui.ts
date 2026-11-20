import { lang, onLangChange } from '../../core/i18n';
import { categories, prepare, separateTerminal, selectionContext, snapshots, type Report } from './data';
import { collectContext, listenFeedback, recentErrors, transcript } from './context';
import { FeedbackQueue, indexedQueue } from './queue';
import './feedback.css';
const word = (ru: string, en: string) => lang() === 'ru' ? ru : en;
const button = (text: string, action: () => void) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.onclick = action; return b; };
export function mountFeedback(): void {
  listenFeedback();
  const queue = new FeedbackQueue(indexedQueue(), import.meta.env.VITE_FEEDBACK_URL ?? (import.meta.env.DEV ? '/api/feedback' : ''));
  const status = document.createElement('p'); status.className = 'feedback-status'; status.role = 'status';
  document.body.append(status);
  const flush = async () => { try { if ((await queue.flush()).length) status.textContent = word('Сообщение отправлено.', 'Your report has been sent.'); } catch { /* IndexedDB may be unavailable in private mode. */ } };
  window.addEventListener('online', () => void flush()); setInterval(() => void flush(), 30000); void flush();
  let opened = false;
  async function open(target?: Element, selected?: unknown) {
    if (opened) return; opened = true;
    const focus = document.activeElement as HTMLElement | null;
    if (!target) {
      target = focus?.closest('.goal,.quiz-item,.ex2-card,[data-model],.lsec') ?? undefined;
      if (!target) target = [...document.querySelectorAll('.lsec,[data-model],.ex2-card')].find(el => {
        const rect = el.getBoundingClientRect(); return rect.top < innerHeight / 2 && rect.bottom > innerHeight / 2;
      });
    }
    const dialog = document.createElement('dialog'); dialog.className = 'feedback-dialog';
    dialog.setAttribute('aria-label', word('Сообщить о проблеме', 'Report a problem'));
    const form = document.createElement('form');
    const title = document.createElement('h2'); title.textContent = word('Сообщить о проблеме', 'Report a problem');
    const privacy = document.createElement('p'); privacy.textContent = word('После нажатия «Отправить» мы получим ваш текст, сведения об открытом месте курса и выбранные ниже приложения.', 'After you press Send, we receive your message, the course location and the attachments selected below.');
    const field = (name: string, input: HTMLElement) => { const label = document.createElement('label'); label.append(name, input); form.append(label); };
    form.append(title, privacy);
    const category = document.createElement('select'); category.name = 'category';
    const ru = ['Ошибка в тексте или факте', 'Непонятно', 'Не работает', 'Среда упала или зависла', 'Предложение', 'Другое'];
    const en = ['Text or factual error', 'Unclear explanation', 'Something does not work', 'Environment crashed or froze', 'Suggestion', 'Other'];
    categories.forEach((v,i) => category.add(new Option((lang() === 'ru' ? ru : en)[i], v)));
    field(word('Выберите тему сообщения.', 'Choose a category.'), category);
    const message = document.createElement('textarea'); message.name = 'message'; message.required = true; message.maxLength = 12000; message.rows = 4;
    field(word('Расскажите, что произошло.', 'Describe what happened.'), message);
    const contact = document.createElement('input'); contact.type = 'email'; contact.name = 'contact'; contact.maxLength = 254;
    field(word('Оставьте почту, если хотите получить ответ.', 'Leave your email if you would like a reply.'), contact);
    const trap = document.createElement('input'); trap.name = 'website'; trap.tabIndex = -1; trap.autocomplete = 'off'; trap.className = 'feedback-trap'; trap.setAttribute('aria-hidden', 'true'); form.append(trap);
    const preview = document.createElement('pre'); preview.tabIndex = 0; preview.setAttribute('aria-label', word('Точный состав сообщения', 'Exact report payload'));
    const send = document.createElement('button'); send.type = 'submit'; send.textContent = word('Отправить', 'Send'); send.disabled = true;
    const close = () => dialog.close();
    form.append(preview, send, button(word('Отмена', 'Cancel'), close)); dialog.append(form); document.body.append(dialog); dialog.showModal();
    dialog.addEventListener('close', () => { dialog.remove(); opened = false; focus?.focus(); });
    const base: Report = { schema: 'dt.feedback/v1', id: crypto.randomUUID(), time: new Date().toISOString(), category: 'text', message: '', contact: '', website: '', context: collectContext(target, selected), attachments: {}, omitted: [] };
    preview.textContent = word('Собираем сведения о среде…', 'Collecting environment details…');
    const environment = await snapshots(target?.closest('.lab') ?? undefined);
    const attachments: Record<string, unknown> = { errors: recentErrors() };
    if (Object.keys(environment).length || transcript()) {
      const separated = separateTerminal(environment);
      attachments.transcript = (JSON.stringify(separated.records, null, 2).slice(-32000) + '\n' + transcript()).slice(-64000);
      attachments.environment = separated.state;
    }
    const checks = new Map<string, HTMLInputElement>();
    const labels: Record<string,string> = { errors: word('Приложить последние ошибки приложения.', 'Attach recent application errors.'), transcript: word('Приложить команды и вывод терминала.', 'Attach terminal commands and output.'), environment: word('Приложить состояние среды и результаты проверок.', 'Attach environment state and check results.') };
    for (const key of Object.keys(attachments)) {
      const label = document.createElement('label'); const input = document.createElement('input'); input.type = 'checkbox'; input.checked = true;
      checks.set(key,input); label.append(input, labels[key]); form.insertBefore(label, preview);
    }
    let payload: Report;
    const refresh = () => {
      try {
        payload = prepare({ ...base, category: category.value, message: message.value, contact: contact.value, website: trap.value, omitted: [], attachments: Object.fromEntries(Object.entries(attachments).filter(([k]) => checks.get(k)?.checked)) });
        preview.textContent = JSON.stringify(payload, null, 2); send.disabled = false;
      } catch { preview.textContent = word('Сообщение слишком большое. Сократите текст.', 'The report is too large. Shorten your message.'); send.disabled = true; }
    };
    form.addEventListener('input', refresh); refresh();
    form.onsubmit = async e => {
      e.preventDefault(); refresh(); if (send.disabled) return; send.disabled = true;
      try {
        await queue.enqueue(payload!); close();
        status.textContent = word('Сообщение сохранено и будет отправлено, когда появится сеть и сервер станет доступен.', 'Your report is saved and will be sent when the network and server are available.');
        void flush();
      } catch { send.disabled = false; preview.textContent = word('Браузер не смог сохранить сообщение. Скопируйте текст и попробуйте ещё раз.', 'The browser could not save your report. Copy your message and try again.'); }
    };
  }
  const global = button(word('Сообщить о проблеме', 'Report a problem'), () => void open()); global.className = 'feedback-launch'; document.body.append(global);
  onLangChange(() => { global.textContent = word('Сообщить о проблеме', 'Report a problem'); decorate(); });
  const select = button(word('Комментировать', 'Comment'), () => void open(selectionTarget, selected)); select.className = 'feedback-selection'; select.hidden = true; document.body.append(select);
  let selected: unknown, selectionTarget: Element | undefined;
  select.onpointerdown = e => e.preventDefault();
  document.addEventListener('selectionchange', () => {
    if (opened) return;
    const selection = getSelection(); selected = selectionContext(selection); selectionTarget = selection?.anchorNode?.parentElement ?? undefined;
    select.hidden = !selected || !!selectionTarget?.closest('input,textarea,dialog');
    if (!select.hidden && selection?.rangeCount) {
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      select.style.left = `${Math.min(innerWidth - 160, Math.max(8, rect.left))}px`; select.style.top = `${Math.min(innerHeight - 45, Math.max(8, rect.bottom + 5))}px`;
      select.textContent = word('Комментировать', 'Comment');
    }
  });
  function decorate() {
    document.querySelectorAll<HTMLElement>('.lsec,.goal[data-task],.quiz-item,.ex2-card,[data-model]').forEach(el => {
      if (!el.querySelector(':scope > .feedback-comment')) {
        const b = button(word('Комментировать', 'Comment'), () => void open(el)); b.className = 'feedback-comment'; el.append(b);
      } else el.querySelector(':scope > .feedback-comment')!.textContent = word('Комментировать', 'Comment');
    });
  }
  let scheduled = false;
  new MutationObserver(records => {
    if (!records.some(r => [...r.addedNodes].some(n => n instanceof Element && !n.matches('.feedback-comment')))) return;
    if (!scheduled) { scheduled = true; requestAnimationFrame(() => { scheduled = false; decorate(); }); }
  }).observe(document.getElementById('main')!, { childList: true, subtree: true });
  decorate();
}
