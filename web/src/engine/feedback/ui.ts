import { lang, onLangChange } from '../../core/i18n';
import { categories, prepare, separateTerminal, selectionContext, snapshots, type Report } from './data';
import { collectContext, listenFeedback, recentErrors, transcript } from './context';
import { FeedbackQueue, indexedQueue } from './queue';
import { endpoint, newToken, checkThreads, follows, unread, saveFollow } from './threads';
import './feedback.css';
const word = (ru: string, en: string) => lang() === 'ru' ? ru : en;
const button = (text: string, action: () => void) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.onclick = action; return b; };
export function mountFeedback(): void {
  listenFeedback();
  const queue = new FeedbackQueue(indexedQueue(), endpoint());
  const status = document.createElement('p'); status.className = 'feedback-status'; status.role = 'status';
  document.body.append(status);
  let toastTimer: ReturnType<typeof setTimeout>;
  const toast = (text: string) => { clearTimeout(toastTimer); toastTimer = setTimeout(() => status.replaceChildren(), 12000); status.replaceChildren(document.createTextNode(text + ' ')); const link = document.createElement('a'); link.href = '#/messages'; link.textContent = word('Мои сообщения', 'My messages'); status.append(link); };
  const flush = async () => { try { if ((await queue.flush()).length) toast(word('Сообщение отправлено.', 'Your report has been sent.')); } catch { /* IndexedDB may be unavailable in private mode. */ } };
  window.addEventListener('online', () => void flush()); setInterval(() => void flush(), 30000); void flush();
  let opened = false;
  async function open(target?: Element, selected?: unknown, type: 'report' | 'contact' = 'report') {
    if (opened) return; opened = true;
    const focus = document.activeElement as HTMLElement | null;
    if (!target) {
      target = focus?.closest('.goal,.quiz-item,.ex2-card,[data-model],.lsec') ?? undefined;
      if (!target) target = [...document.querySelectorAll('.lsec,[data-model],.ex2-card')].find(el => {
        const rect = el.getBoundingClientRect(); return rect.top < innerHeight / 2 && rect.bottom > innerHeight / 2;
      });
      target ??= [...document.querySelectorAll('.lsec')].find(el => { const rect = el.getBoundingClientRect(); return rect.bottom > 0 && rect.top < innerHeight; });
    }
    const dialog = document.createElement('dialog'); dialog.className = 'feedback-dialog';
    dialog.setAttribute('aria-label', type === 'contact' ? word('Написать автору', 'Contact the author') : word('Сообщить о проблеме', 'Report a problem'));
    const form = document.createElement('form');
    const title = document.createElement('h2'); title.textContent = type === 'contact' ? word('Написать автору', 'Contact the author') : word('Сообщить о проблеме', 'Report a problem');
    const field = (name: string, input: HTMLElement) => { const label = document.createElement('label'); label.append(name, input); form.append(label); };
    form.append(title);
    let category = target?.closest('.lab')?.matches('[data-feedback-failed="true"]') || target?.closest('.lab')?.querySelector('.lab-fail,[data-feedback-failed="true"],.fail,.failed,.err,.no,[data-correct="false"]') || target?.closest('.lsec')?.querySelector('.lab-fail,[data-feedback-failed="true"],.lab .fail,.lab .err,.lab .no') ? 'broken' : 'other';
    const chips = document.createElement('div'); chips.className = 'feedback-chips'; chips.setAttribute('aria-label', 'Тему можно уточнить.'); chips.role = 'group';
    const ru = ['Ошибка в тексте', 'Непонятно', 'Не работает', 'Среда зависла', 'Предложение', 'Другое'];
    const en = ['Text error', 'Unclear', 'Not working', 'Frozen', 'Suggestion', 'Other'];
    categories.forEach((v, i) => {
      const chip = button((lang() === 'ru' ? ru : en)[i], () => { category = v; for (const c of chips.children) c.setAttribute('aria-pressed', String(c === chip)); });
      chip.dataset.category = v; chip.setAttribute('aria-pressed', String(v === category)); chips.append(chip);
    });
    if (type === 'report') form.append(chips);
    if (type === 'report' && matchMedia('(pointer: coarse)').matches) {
      const places = [...document.querySelectorAll<HTMLElement>('.lsec')];
      const place = document.createElement('select'); place.add(new Option('Об открытой странице.', ''));
      places.forEach((el,i) => { const option = new Option(el.querySelector('h2,h3')?.textContent ?? 'Раздел ' + (i + 1), String(i)); option.selected = el === target || !!target && el.contains(target); place.add(option); });
      place.onchange = () => { target = place.value === '' ? undefined : places[Number(place.value)]; };
      field('О каком месте вы хотите сообщить?', place);
    }
    const message = document.createElement('textarea'); message.name = 'message'; message.required = true; message.maxLength = 12000; message.rows = 4;
    field(type === 'contact' ? word('Напишите автору.', 'Write to the author.') : word('Расскажите, что произошло.', 'Describe what happened.'), message);
    const contact = document.createElement('input'); contact.type = 'text'; contact.name = 'contact'; contact.maxLength = 254;
    if (type === 'contact') { field(word('Если хотите, оставьте почту или имя в Telegram, которое начинается с @.', 'Optionally leave your email or Telegram @username.'), contact);
      const email = import.meta.env.VITE_AUTHOR_EMAIL; if (email && /^[^\s@]+@[^\s@]+$/.test(email)) { const link = document.createElement('a'); link.href = 'mailto:' + email; link.textContent = word('Можно написать по электронной почте.', 'You can also send an email.'); form.append(link); }
    }
    const trap = document.createElement('input'); trap.name = 'website'; trap.tabIndex = -1; trap.autocomplete = 'off'; trap.className = 'feedback-trap'; trap.setAttribute('aria-hidden', 'true'); form.append(trap);
    const preview = document.createElement('pre'); preview.tabIndex = 0; preview.setAttribute('aria-label', word('Точный состав сообщения', 'Exact report payload'));
    const send = document.createElement('button'); send.type = 'submit'; send.textContent = word('Отправить', 'Send'); send.disabled = false;
    const close = () => dialog.close();
    const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = word('Вместе с сообщением уйдут: место в курсе и вывод терминала', 'Included: course location and terminal output'); details.append(summary, preview);
    if (type === 'report') { const label = document.createElement('label'); label.append('Если хотите, оставьте почту или имя в Telegram для ответа.', contact); details.append(label); form.append(details); }
    const error = document.createElement('p'); error.role = 'status'; form.append(error);
    form.append(send, button(word('Отмена', 'Cancel'), close)); dialog.append(form); document.body.append(dialog); dialog.showModal(); message.focus();
    dialog.addEventListener('close', () => { dialog.remove(); opened = false; focus?.focus(); });
    const base: Report = { schema: 'dt.feedback/v1', id: crypto.randomUUID(), time: new Date().toISOString(), type, category: 'other', message: '', contact: '', website: '', context: type === 'contact' ? {} : collectContext(target, selected), attachments: {}, omitted: [] };
    const attachments: Record<string, unknown> = {};
    const collecting = type === 'contact' ? Promise.resolve() : snapshots(target?.closest('.lab') ?? undefined).then(environment => {
      attachments.errors = recentErrors();
      const separated = separateTerminal(environment);
      attachments.transcript = (JSON.stringify(separated.records, null, 2).slice(-32000) + '\n' + transcript()).slice(-64000);
      attachments.environment = separated.state;
    });
    if (type === 'report' && endpoint()) {
      const context = collectContext(target);
      const query = new URLSearchParams(Object.entries(context).filter(([k,v]) => ['route','section','task','quiz','examCard','explainer','step'].includes(k) && typeof v === 'string') as [string,string][]);
      const hintURL = endpoint() + '/hint?' + query;
      void fetch(hintURL, { credentials: 'omit', signal: AbortSignal.timeout(5000) }).then(r => r.ok ? r.json() : null).then(hint => {
        if (!hint?.open || !dialog.isConnected) return;
        const hintLine = document.createElement('p'); hintLine.className = 'feedback-hint'; hintLine.append('Об этом месте уже сообщили, мы разбираемся. ');
        const same = button('У меня то же самое', () => {
          same.disabled = true;
          void fetch(hintURL, { method: 'POST', credentials: 'omit', signal: AbortSignal.timeout(10000) }).then(r => { if (!r.ok) throw new Error(); close(); toast('Спасибо, мы учли ваше сообщение.'); }).catch(() => { same.disabled = false; error.textContent = 'Не удалось отправить сообщение. Попробуйте ещё раз.'; });
        });
        hintLine.append(same); form.insertBefore(hintLine, chips);
      }).catch(() => {});
    }
    let payload: Report;
    let sending = false; const followToken = newToken();
    const refresh = () => {
      try {
        payload = prepare({ ...base, category, message: message.value, contact: contact.value, website: trap.value, omitted: [], context: type === 'contact' ? {} : collectContext(target, selected), attachments });
        preview.textContent = JSON.stringify(payload, null, 2); send.disabled = sending;
      } catch { preview.textContent = word('Сообщение слишком большое. Сократите текст.', 'The report is too large. Shorten your message.'); send.disabled = true; }
    };
    form.addEventListener('input', refresh); refresh(); void collecting.then(refresh);
    form.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); } });
    form.onsubmit = async e => {
      e.preventDefault();
      const address = contact.value.trim();
      if (address && !/^(?:[^\s@]+@[^\s@]+\.[^\s@]+|@[A-Za-z0-9_]{5,32})$/.test(address)) { error.textContent = 'Проверьте адрес почты или имя в Telegram, которое начинается с @.'; if (type === 'report') details.open = true; contact.focus(); return; }
      if (sending || send.disabled || !message.value.trim()) return; sending = true; send.disabled = true; await collecting; refresh(); send.disabled = true;
      try {
        await queue.enqueue({ ...payload!, followToken }); close();
        toast(word('Сообщение сохранено и ожидает отправки.', 'Your message is saved and waiting to be sent.'));
        void flush();
      } catch { sending = false; send.disabled = false; error.textContent = word('Браузер не смог сохранить сообщение. Скопируйте текст и попробуйте ещё раз.', 'The browser could not save your report. Copy your message and try again.'); }
    };
  }
  window.addEventListener('feedback-contact', () => void open(undefined, undefined, 'contact'));
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
  const updates = async () => {
    const entries = await follows();
    document.querySelectorAll('.feedback-menu').forEach(el => {
      el.classList.toggle('has-unread', entries.some(unread));
      el.setAttribute('aria-label', entries.some(unread) ? 'Мои сообщения. Есть новые ответы.' : 'Мои сообщения');
    });
    for (const f of entries) {
      if (f.fixedSeen || f.thread?.status !== 'fixed' || String(f.context.route).split('/').slice(0,3).join('/') !== location.hash.split('?')[0].split('/').slice(0,3).join('/')) continue;
      const section = typeof f.context.section === 'string' ? document.getElementById('s-' + f.context.section) : document.getElementById('main');
      if (!section) continue;
      const note = document.createElement('p'); note.className = 'feedback-fixed'; note.textContent = 'Это место исправили по вашему сообщению. Спасибо.'; section.prepend(note);
      f.fixedSeen = true; await saveFollow(f);
    }
  };
  window.addEventListener('feedback-page', () => { void updates().catch(() => {}); });
  window.addEventListener('feedback-updated', () => { void updates().catch(() => {}); });
  void checkThreads().then(updates).catch(() => {});
  setInterval(() => void checkThreads().catch(() => {}), 3600000);
  decorate();
}
