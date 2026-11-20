import { encodeTransfer, decodeTransfer } from '../core/progress-transfer';
import { exportWithFeedback, importFeedback } from '../engine/feedback/threads';
// Settings: language, theme, calm mode, progress export/import, storage,
// and sections registered by modules (the AI builder adds "Your AI" here).

import { downloadFile, h, icon, pickFile, toast } from '../core/dom';
import { bi, lang, LANGS, setLang, t, UI } from '../core/i18n';
import { registry } from '../core/registry';
import { store } from '../core/store';
import type { Mounted } from '../core/types';
import { setTitle, type Page } from './common';
import { getTheme, isCalm, setCalm, setTheme, type Theme } from './theme';

export function settingsPage(): Page {
  setTitle(t(UI.settings));
  const mounts: Mounted[] = [];
  const themeSel = h(
    'div.segmented',
    { role: 'radiogroup', 'aria-label': t(UI.theme) },
    ...(['auto', 'light', 'dark'] as Theme[]).map((th) => {
      const r = h('input', { type: 'radio', name: 'theme', value: th, checked: getTheme() === th }) as HTMLInputElement;
      r.addEventListener('change', () => setTheme(th));
      return h('label', {}, r, h('span', {}, t(th === 'auto' ? UI.themeAuto : th === 'light' ? UI.themeLight : UI.themeDark)));
    }),
  );
  const langSel = h(
    'div.segmented',
    { role: 'radiogroup', 'aria-label': t(UI.language) },
    ...LANGS.map((l) => {
      const r = h('input', { type: 'radio', name: 'lang', value: l, checked: lang() === l }) as HTMLInputElement;
      r.addEventListener('change', () => setLang(l));
      return h('label', {}, r, h('span', {}, l === 'ru' ? 'Русский' : 'English'));
    }),
  );
  const calm = h('input', { type: 'checkbox', role: 'switch', checked: isCalm() }) as HTMLInputElement;
  calm.addEventListener('change', () => setCalm(calm.checked));

  const p = store.state;
  const persistLine =
    store.persisted === true
      ? t(bi('Браузер обещал не удалять данные курса.', 'The browser promised to keep the course data.'))
      : store.persisted === false
        ? t(bi('Браузер может удалить данные сам (например, Safari — после 7 дней без визитов). Выгружайте файл прогресса.', 'The browser may clear the data on its own (Safari does after 7 days without visits). Export a progress file.'))
        : t(bi('Браузер не сообщает, сохранит ли он данные.', 'The browser does not say whether it will keep the data.'));

  const exportBtn = h('button.btn', { type: 'button' }, icon('download'), t(UI.export));
  exportBtn.addEventListener('click', async () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(`devops-trainer-progress-${date}.json`, await exportWithFeedback(store.exportJSON()));
    toast(t(bi('Файл прогресса сохранён', 'Progress file saved')));
  });
  const transferBox = h('div.progress-transfer', { 'aria-live': 'polite' });
  const transferBtn = h('button.btn', { type: 'button' }, t(bi('Перенести на другое устройство', 'Transfer to another device')));
  transferBtn.addEventListener('click', async () => {
    transferBtn.setAttribute('disabled', '');
    try {
      const json = await exportWithFeedback(store.exportJSON());
      const payload = await encodeTransfer(json);
      transferBox.replaceChildren();
      if (payload.length > 12_000) {
        downloadFile('devops-trainer-progress.json', json);
        transferBox.append(h('p', {}, t(bi('Прогресс не помещается в короткую ссылку, поэтому сохранён файл для загрузки на другом устройстве.', 'Progress is too large for a short link, so a file has been saved for import on the other device.'))));
      } else {
        const url = location.href.split('#')[0] + '#/settings?transfer=' + payload;
        const field = h('textarea', { rows: 3, readonly: true, 'aria-label': t(bi('Ссылка для переноса прогресса', 'Progress transfer link')) }) as HTMLTextAreaElement;
        field.value = url;
        transferBox.append(field, h('button.btn', { type: 'button', onclick: async () => { field.select(); try { await navigator.clipboard.writeText(url); } catch { field.focus(); } } }, t(bi('Скопировать ссылку', 'Copy link'))));
      }
    } catch { toast(t(bi('Не удалось создать ссылку; воспользуйтесь выгрузкой файла.', 'Could not create a link; use file export.'))); }
    finally { transferBtn.removeAttribute('disabled'); }
  });
  const incoming = new URLSearchParams(location.hash.split('?')[1] ?? '').get('transfer');
  if (incoming) {
    const accept = h('button.btn', { type: 'button' }, t(bi('Загрузить прогресс по ссылке', 'Import progress from this link')));
    transferBox.append(accept);
    accept.addEventListener('click', async () => {
      accept.setAttribute('disabled', '');
      try {
        const json = await decodeTransfer(incoming);
        await store.importJSON(json);
        await importFeedback(json);
        history.replaceState(null, '', location.href.split('#')[0] + '#/settings');
        transferBox.replaceChildren(h('p', {}, t(bi('Прогресс загружен на это устройство.', 'Progress has been imported on this device.'))));
      } catch { transferBox.replaceChildren(h('p', {}, t(bi('Ссылка повреждена или срок её действия истёк; создайте новую на исходном устройстве.', 'The link is invalid or expired; create a new one on the source device.')))); }
    });
  }
  const importBtn = h('button.btn.ghost', { type: 'button' }, icon('upload'), t(UI.import));
  importBtn.addEventListener('click', async () => {
    const text = await pickFile();
    if (!text) return;
    try {
      const r = await store.importJSON(text);
      await importFeedback(text);
      toast(t(bi(`Добавлено событий: ${r.added}`, `Events added: ${r.added}`)));
    } catch (e) {
      toast((e as Error).message);
    }
  });
  const resetBtn = h('button.btn.danger', { type: 'button' }, t(bi('Стереть прогресс в этом браузере', 'Erase progress in this browser')));
  resetBtn.addEventListener('click', async () => {
    if (!confirm(t(bi('Стереть весь прогресс в этом браузере? Сначала лучше выгрузить файл.', 'Erase all progress in this browser? Export a file first.')))) return;
    await store.reset();
    toast(t(bi('Прогресс стёрт', 'Progress erased')));
  });

  const extra = registry.settings.map((s) => {
    const host = h('div');
    mounts.push(s.mount(host));
    return h('section.settings-sec', { 'data-id': s.id }, h('h2', {}, t(s.title)), host);
  });
  const aiPlaceholder = registry.settings.some((s) => s.id === 'ai')
    ? null
    : h(
        'section.settings-sec',
        { 'data-id': 'ai' },
        h('h2', {}, t(bi('Ваша нейросеть', 'Your AI'))),
        h(
          'p',
          {},
          t(
            bi(
              'Наставник работает на нейросети ученика: запросы идут прямо из браузера к вашему провайдеру, наш сервер ключа не видит. Подключение появится здесь.',
              'The mentor runs on the learner’s own AI: requests go straight from the browser to your provider; our server never sees the key. Connecting will appear here.',
            ),
          ),
        ),
      );

  const el = h(
    'div.settings',
    {},
    h('h1', {}, t(UI.settings)),
    h('button.btn', { type: 'button', onclick: () => window.dispatchEvent(new Event('feedback-contact')) }, t(bi('Написать автору', 'Contact the author'))),
    h('section.settings-sec', {}, h('h2', {}, t(UI.language)), langSel),
    h('section.settings-sec', {}, h('h2', {}, t(UI.theme)), themeSel, h('label.switch-row', {}, h('label.switch', {}, calm, h('span.switch-track', { 'aria-hidden': 'true' })), h('span', {}, t(UI.calm), h('span.muted.small', {}, ` — ${t(UI.calmHint)}`)))),
    h(
      'section.settings-sec',
      {},
      h('h2', {}, t(UI.progress)),
      h(
        'p',
        {},
        t(bi('Прогресс автоматически сохраняется в этом браузере после каждого действия.', 'Progress is saved automatically in this browser after every action.')),
      ),
      h('p.small.muted', {}, persistLine, store.volatile ? ' ' + t(bi('Хранилище недоступно: прогресс живёт до закрытия вкладки.', 'Storage is unavailable: progress lives until the tab is closed.')) : ''),
      h('p.small.muted', {}, `${t(bi('Событий в журнале', 'Events in the log'))}: ${p.meta.events}${p.meta.lastExportAt ? ` · ${t(bi('последняя выгрузка', 'last export'))}: ${p.meta.lastExportAt.slice(0, 10)}` : ''}`),
      h('div.row', {}, transferBtn, exportBtn, importBtn), h('p', {}, t(bi('Отправьте ссылку на другое устройство и откройте её в течение 15 минут, чтобы загрузить прогресс.', 'Send the link to the other device and open it within 15 minutes to import progress.'))), transferBox,
      h('p.small.muted', {}, t(bi('Вход по ссылке на почту, через GitHub или Google появится позже — тогда журнал будет синхронизироваться.', 'Sign-in by e-mail link, GitHub or Google comes later; then the log will sync.'))),
    ),
    ...extra,
    aiPlaceholder,
    h('section.settings-sec', {}, h('h2', {}, t(bi('Опасная зона', 'Danger zone'))), resetBtn),
  );
  return { el, dispose: () => mounts.forEach((m) => m.dispose()) };
}
