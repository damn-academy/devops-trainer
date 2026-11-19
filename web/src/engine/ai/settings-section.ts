// Settings → "Your AI" (09 §4.1, §4.4): choose a provider, paste a key, pick a
// model, check the connection; see exactly what the tutor sends.

import { clear, h, icon, toast } from '../../core/dom';
import { bi, fmt, t } from '../../core/i18n';
import { prose, codeBlock } from '../../app/common';
import type { Mounted } from '../../core/types';
import { gather } from './context';
import { buildPrompt } from './prompt';
import { ollamaCommands, preset, PROVIDERS, type ProviderId } from './providers';
import { ai, ERRORS } from './service';
import './ai.css';

const T = {
  intro: bi(
    'Наставник работает на вашей собственной нейросети. Запросы идут прямо из этого браузера к провайдеру, которого вы выберете; сервер курса не видит ни ключа, ни вопросов. Весь курс обычно стоит меньше доллара.',
    'The tutor runs on your own AI. Requests go straight from this browser to the provider you choose; the course server sees neither the key nor the questions. The whole course usually costs less than a dollar.',
  ),
  provider: bi('Провайдер', 'Provider'),
  where: bi('Где взять ключ', 'Where to get a key'),
  install: bi('Скачать', 'Download'),
  url: bi('Адрес API', 'API address'),
  key: bi('Ключ API', 'API key'),
  keySaved: bi('ключ сохранён — оставьте поле пустым, чтобы не менять', 'a key is saved — leave empty to keep it'),
  model: bi('Модель', 'Model'),
  load: bi('Загрузить список', 'Load the list'),
  loaded: bi('Моделей: {n}', 'Models: {n}'),
  remember: bi('Запомнить ключ на этом устройстве (в зашифрованном виде)', 'Remember the key on this device (encrypted)'),
  rememberOff: bi('Выключите на общем компьютере: ключ будет жить в памяти до закрытия вкладки.', 'Switch off on a shared computer: the key lives in memory until the tab is closed.'),
  save: bi('Сохранить и проверить', 'Save and check'),
  checking: bi('Проверяю: короткий вопрос «ответь одним словом»…', 'Checking: a short “reply with one word” question…'),
  ok: bi('Работает: ответ «{text}» за {ms} мс{stream}.', 'Works: the answer “{text}” in {ms} ms{stream}.'),
  streamOk: bi(', ответ приходит по частям', ', the answer streams in parts'),
  streamNo: bi(', но целиком, без потока', ', but in one piece, without streaming'),
  forget: bi('Отключить и удалить ключ', 'Disconnect and delete the key'),
  forgotten: bi('Ключ и настройки удалены из этого браузера', 'The key and settings are deleted from this browser'),
  advice: bi(
    'Совет: создайте для курса отдельный ключ с лимитом расходов (у OpenRouter — лимит на ключ, у DeepSeek — небольшой предоплаченный баланс) и удалите его, когда закончите.',
    'Advice: create a separate key for the course with a spending limit (OpenRouter has per-key limits, DeepSeek a small prepaid balance) and delete it when you finish.',
  ),
  storage: bi(
    'Как хранится ключ: в IndexedDB этого браузера, зашифрованный AES-GCM ключом, который браузер создал неизвлекаемым — его байты не отдаются даже самой странице. Ключ не попадает в файл прогресса и в синхронизацию. Главная защита — на странице нет ни одного чужого скрипта.',
    'How the key is stored: in this browser’s IndexedDB, encrypted with AES-GCM under a key the browser created as non-extractable — its bytes are not handed out even to the page itself. The key never goes into the progress file or sync. The main protection is that the page runs no third-party scripts at all.',
  ),
  ollama: bi('Ollama по умолчанию отвечает только самой себе. Разрешите ей адрес курса и перезапустите:', 'By default Ollama answers only itself. Allow the course address and restart it:'),
  chrome: bi(
    'Chrome спросит разрешение «Доступ к локальной сети» — нажмите «Разрешить». Если вы отказали, разрешение включается в настройках сайта (значок слева от адреса). Safari запрещает HTTPS-страницам обращаться к http://localhost: для Ollama используйте Chrome или Firefox.',
    'Chrome will ask for “Local network access” — press Allow. If you denied it, the permission is in the site settings (the icon left of the address). Safari forbids HTTPS pages to reach http://localhost: use Chrome or Firefox for Ollama.',
  ),
  sees: bi('Что видит ваша нейросеть', 'What your AI sees'),
  seesIntro: bi(
    'Вот из чего наставник собирает запрос прямо сейчас — слоями, от неизменного к изменчивому. Нажмите на слой, чтобы увидеть его текст целиком, как он уйдёт провайдеру.',
    'This is what the tutor builds a request from right now, layer by layer, from the fixed to the changing. Click a layer to see its full text exactly as it goes to the provider.',
  ),
  notInside: bi(
    'Чего в запросе нет: эталонного решения и «запретных» слов задания. Наставник не знает ответа, поэтому не может его выдать; тренажёр сверяет его ответ с решением сам и прячет совпадения.',
    'What is not in the request: the reference solution and the task’s “forbidden” words. The tutor does not know the answer, so it cannot give it away; the trainer checks its answer against the solution itself and hides any match.',
  ),
  sample: bi('Почему команда не нашла файл?', 'Why did the command not find the file?'),
};

export function mountAiSettings(el: HTMLElement): Mounted {
  let disposed = false;
  const status = h('div.ai-status', { 'aria-live': 'polite' });

  const render = () => {
    if (disposed) return;
    clear(el);
    const st = ai().status;
    const s = st.settings;
    let provider: ProviderId = s?.provider ?? 'deepseek';

    const cards = h('div.ai-providers', { role: 'radiogroup', 'aria-label': t(T.provider) });
    const urlIn = h('input.ai-input', { type: 'url', placeholder: 'https://…/v1', value: s?.baseUrl ?? '' }) as HTMLInputElement;
    const keyIn = h('input.ai-input', { type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: st.hasKey ? t(T.keySaved) : 'sk-…' }) as HTMLInputElement;
    const modelIn = h('input.ai-input', { type: 'text', list: 'ai-models', value: s?.model ?? '', spellcheck: 'false' }) as HTMLInputElement;
    const models = h('datalist', { id: 'ai-models' });
    const remember = h('input', { type: 'checkbox', role: 'switch', checked: s?.remember ?? true }) as HTMLInputElement;
    const urlRow = h('label.ai-field', {}, h('span', {}, t(T.url)), urlIn);
    const keyRow = h('label.ai-field', {}, h('span', {}, t(T.key)), keyIn);
    const extra = h('div.ai-extra');

    const pickProvider = (id: ProviderId, fromUser: boolean) => {
      provider = id;
      const p = preset(id);
      urlRow.hidden = !p.editableUrl;
      keyRow.hidden = !p.needsKey;
      if (fromUser || !urlIn.value) urlIn.value = p.baseUrl;
      if (fromUser || !modelIn.value) modelIn.value = p.defaultModel;
      clear(extra);
      extra.append(prose(p.note, 'prose small'));
      if (p.keyUrl) extra.append(h('p.small', {}, h('a', { href: p.keyUrl, target: '_blank', rel: 'noopener noreferrer' }, t(id === 'ollama' ? T.install : T.where), ' ↗'), h('span.muted', {}, ` · ${t(p.cost)}`)));
      if (id === 'ollama') {
        extra.append(h('p.small', {}, t(T.ollama)));
        for (const c of ollamaCommands(location.origin)) extra.append(h('p.small.ai-os', {}, c.os), codeBlock(c.cmd, 'bash'));
        extra.append(h('p.small.muted', {}, t(T.chrome)));
      }
    };
    for (const p of PROVIDERS) {
      const r = h('input', { type: 'radio', name: 'ai-provider', value: p.id, checked: p.id === provider }) as HTMLInputElement;
      r.addEventListener('change', () => pickProvider(p.id, true));
      cards.append(h('label.ai-provider', {}, r, h('span.ai-provider-name', {}, p.name), h('span.small.muted', {}, t(p.cost))));
    }
    pickProvider(provider, false);
    if (s) {
      urlIn.value = s.baseUrl;
      modelIn.value = s.model;
    }

    const loadBtn = h('button.btn.ghost.small', { type: 'button' }, icon('download'), t(T.load));
    loadBtn.addEventListener('click', async () => {
      await save(false);
      try {
        const list = await ai().models();
        models.replaceChildren(...list.map((m) => h('option', { value: m })));
        toast(t(fmt(T.loaded, { n: list.length })));
      } catch (e) {
        toast(t(ERRORS[(e as { code?: keyof typeof ERRORS }).code ?? 'other'] ?? ERRORS.other));
      }
    });

    const save = async (check: boolean) => {
      const p = preset(provider);
      await ai().configure({ provider, baseUrl: p.editableUrl ? urlIn.value : p.baseUrl, model: modelIn.value, remember: remember.checked }, keyIn.value || undefined);
      keyIn.value = '';
      if (!check) return;
      clear(status);
      status.append(h('p.small.muted', {}, t(T.checking)));
      const r = await ai().test();
      clear(status);
      if (r.ok) status.append(h('p.ai-ok', {}, h('span.st-icon.ok', { 'aria-hidden': 'true' }, '✓'), t(fmt(T.ok, { text: r.text.slice(0, 30), ms: r.firstMs ?? r.ms, stream: t(r.streamed ? T.streamOk : T.streamNo) }))));
      else status.append(h('p.ai-err', {}, h('span.st-icon.err', { 'aria-hidden': 'true' }, '⨯'), t(ERRORS[r.error ?? 'other']), r.detail && r.error === 'other' ? h('span.small.muted', {}, ` ${r.detail.slice(0, 160)}`) : null));
    };
    const saveBtn = h('button.btn.primary', { type: 'button' }, t(T.save));
    saveBtn.addEventListener('click', async () => {
      saveBtn.setAttribute('disabled', '');
      try {
        await save(true);
      } finally {
        saveBtn.removeAttribute('disabled');
        keyIn.placeholder = ai().status.hasKey ? t(T.keySaved) : 'sk-…';
      }
    });
    const forgetBtn = h('button.btn.danger.small', { type: 'button', disabled: !s && !st.hasKey }, t(T.forget));
    forgetBtn.addEventListener('click', async () => {
      await ai().forget();
      toast(t(T.forgotten));
      clear(status);
      render();
    });

    // "What your AI sees": the real layers of a request built from the current state.
    const built = buildPrompt(gather({ mode: 'explain', task: null }), t(T.sample));
    const envelope = h(
      'div.ai-envelope',
      {},
      h('p.small', {}, t(T.seesIntro)),
      h('ol.ai-layers', {}, ...built.layers.map((l) => h('li', {}, h('details', {}, h('summary', {}, t(l.title), h('span.small.muted', {}, ` · ≈ ${Math.ceil(l.text.length / 3.5)}`)), h('pre', {}, l.text))))),
      h('div.ai-outside', {}, icon('eye'), h('p.small', {}, t(T.notInside))),
    );

    el.append(
      prose(T.intro),
      h('h3.ai-h', {}, t(T.provider)),
      cards,
      extra,
      urlRow,
      keyRow,
      h('div.ai-field', {}, h('span', {}, t(T.model)), h('div.row', {}, modelIn, loadBtn), models),
      h('label.switch-row', {}, h('label.switch', {}, remember, h('span.switch-track', { 'aria-hidden': 'true' })), h('span', {}, t(T.remember), h('span.muted.small', {}, ` — ${t(T.rememberOff)}`))),
      h('div.row', {}, saveBtn, forgetBtn),
      status,
      h('p.small.muted', {}, t(T.advice)),
      h('p.small.muted', {}, t(T.storage)),
      h('details.ai-sees', {}, h('summary', {}, h('strong', {}, t(T.sees))), envelope),
    );
  };

  el.append(h('p.muted.small', {}, '…'));
  void ai().ready.then(render, render);
  const off = ai().onChange(() => undefined);
  return {
    dispose() {
      disposed = true;
      off();
    },
  };
}
