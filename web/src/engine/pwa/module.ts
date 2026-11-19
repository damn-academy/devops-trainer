// Offline course (design 09 §3.2): registers sw.js in production builds, offers
// "a new version is available — update" instead of swapping the shell in the
// middle of a lesson, and adds the "Offline" section to the settings.

import { defineModule } from '../../core/define';
import { h, icon, toast } from '../../core/dom';
import { bi, t } from '../../core/i18n';

const T = {
  title: bi('Офлайн', 'Offline'),
  update: bi('Доступна новая версия курса.', 'A new version of the course is available.'),
  apply: bi('Обновить', 'Update'),
  later: bi('Позже', 'Later'),
  on: bi('Курс сохранён в браузере: уроки, объяснения, симулятор и документация открываются без сети.', 'The course is saved in the browser: lessons, explainers, the simulator and the documentation open without a network.'),
  installing: bi('Курс сохраняется для работы без сети…', 'The course is being saved for offline use…'),
  dev: bi('В режиме разработки офлайн-кеш выключен; он работает в собранной версии курса.', 'The offline cache is off in development mode; it works in the built course.'),
  unsupported: bi('Этот браузер не умеет работать без сети (нет Service Worker).', 'This browser cannot work offline (no Service Worker).'),
  files: bi('Файлов в кеше: {n} из {all} · версия {v}', 'Files in the cache: {n} of {all} · version {v}'),
  v86: bi('Настоящая машина для офлайна', 'The real machine offline'),
  v86Keep: bi('Сохранить эмулятор и ядро (≈ {mb} МБ)', 'Keep the emulator and the kernel (≈ {mb} MB)'),
  v86Kept: bi('Эмулятор и ядро сохранены: настоящий Linux запустится и без сети.', 'The emulator and the kernel are saved: real Linux starts without a network too.'),
  v86Drop: bi('Удалить из кеша', 'Remove from the cache'),
  storage: bi('Занято в браузере: {used} МБ из доступных {quota} МБ.', 'Used in the browser: {used} MB of the available {quota} MB.'),
};

const supported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
const prod = import.meta.env.PROD;
let waiting: ServiceWorker | null = null;

function fill(b: { ru: string; en: string }, v: Record<string, string | number>) {
  return t(b).replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));
}

function ask<T>(msg: Record<string, unknown>): Promise<T | null> {
  const ctl = navigator.serviceWorker?.controller;
  if (!ctl) return Promise.resolve(null);
  const id = Math.random().toString(36).slice(2);
  return new Promise((resolve) => {
    const on = (ev: MessageEvent) => {
      if (ev.data?.id !== id) return;
      navigator.serviceWorker.removeEventListener('message', on);
      resolve(ev.data as T);
    };
    navigator.serviceWorker.addEventListener('message', on);
    ctl.postMessage({ ...msg, id });
    setTimeout(() => resolve(null), 30_000);
  });
}

function applyUpdate() {
  if (!waiting) return;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
  waiting.postMessage({ op: 'skip-waiting' });
}

function offerUpdate(w: ServiceWorker) {
  waiting = w;
  if (document.querySelector('.pwa-update')) return;
  const bar = h('div.reminder.pwa-update', { role: 'status' });
  const yes = h('button.btn.small', { type: 'button' }, icon('repeat'), t(T.apply));
  yes.addEventListener('click', applyUpdate);
  const no = h('button.btn.ghost.small', { type: 'button' }, t(T.later));
  no.addEventListener('click', () => bar.remove());
  bar.append(h('span', {}, t(T.update)), yes, no);
  document.body.append(bar);
}

async function register() {
  const link = document.createElement('link');
  link.rel = 'manifest';
  link.href = './manifest.webmanifest';
  document.head.append(link);
  const reg = await navigator.serviceWorker.register('./sw.js');
  if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
  reg.addEventListener('updatefound', () => {
    const w = reg.installing;
    w?.addEventListener('statechange', () => {
      if (w.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(w);
    });
  });
  // The waiting version is applied when the learner moves to another lesson (never in the middle of one).
  let lesson = location.hash.split('/')[2];
  window.addEventListener('hashchange', () => {
    const next = location.hash.split('/')[2];
    if (waiting && location.hash.startsWith('#/lesson/') && next !== lesson) applyUpdate();
    lesson = next;
  });
  setInterval(() => void reg.update().catch(() => undefined), 60 * 60 * 1000);
}

// This module loads with the full content, often after the page's load event.
if (supported && prod && typeof window !== 'undefined') {
  const start = () => void register().catch(() => undefined);
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}

export default defineModule({
  settings: [
    {
      id: 'offline',
      order: 50,
      title: T.title,
      mount(el) {
        const line = h('p');
        const files = h('p.small.muted');
        const storage = h('p.small.muted');
        const v86Row = h('div.row');
        el.append(line, files, storage, h('h3.ai-h', {}, t(T.v86)), v86Row);
        const draw = async () => {
          if (!supported) return void (line.textContent = t(T.unsupported));
          if (!prod) line.textContent = t(T.dev);
          const st = await ask<{ version: string; shell: number; files: number; v86: string[] }>({ op: 'status' });
          if (!st && prod) line.textContent = t(T.installing);
          if (st) {
            line.textContent = t(st.shell >= st.files ? T.on : T.installing);
            files.textContent = fill(T.files, { n: st.shell, all: st.files, v: st.version });
          }
          try {
            const est = await navigator.storage?.estimate?.();
            if (est?.quota) storage.textContent = fill(T.storage, { used: Math.round((est.usage ?? 0) / 1048576), quota: Math.round(est.quota / 1048576) });
          } catch {
            /* no estimate */
          }
          v86Row.replaceChildren();
          const { loadManifest, downloadBytes, formatMB, assetUrl, wasmAssetUrl, IMAGE } = await import('../v86/assets');
          const m = await loadManifest();
          if (!m || !st) return;
          const urls = [wasmAssetUrl(), assetUrl('manifest.json'), ...Object.values(IMAGE).map(assetUrl)];
          const kept = urls.every((u) => st.v86.includes(u));
          if (kept) {
            const drop = h('button.btn.ghost.small', { type: 'button' }, t(T.v86Drop));
            drop.addEventListener('click', async () => {
              await ask({ op: 'drop-v86' });
              void draw();
            });
            v86Row.append(h('span.small', {}, t(T.v86Kept)), drop);
          } else {
            const keep = h('button.btn.small', { type: 'button' }, icon('download'), fill(T.v86Keep, { mb: formatMB(downloadBytes(m)) }));
            keep.addEventListener('click', async () => {
              keep.setAttribute('disabled', '');
              const r = await ask<{ ok: boolean; error?: string }>({ op: 'cache-v86', urls });
              if (r && !r.ok) toast(r.error ?? 'error');
              void draw();
            });
            v86Row.append(keep);
          }
        };
        void draw();
        return { dispose() {} };
      },
    },
  ],
});
