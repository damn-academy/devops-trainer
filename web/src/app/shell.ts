import { loadDraft, saveDraft } from '../engine/trainers/storage';
import { exportWithFeedback } from '../engine/feedback/threads';
import { mountFeedback } from '../engine/feedback/ui';
// The app shell: top bar (course name, route, review, settings, help,
// language, theme), the weekly "export or sign in" line, and the page outlet.

import { clear, h, icon, downloadFile } from '../core/dom';
import { bi, lang, onLangChange, setLang, t, UI } from '../core/i18n';
import { loadRegistry, registry } from '../core/registry';
import { href, onRoute, type Route } from '../core/router';
import { store } from '../core/store';
import type { Page } from './common';
import { helpButton } from './help';
import { homePage } from './home';
import { getTheme, setTheme, shownTheme } from './theme';

type ContentPages = typeof import('./content-pages');
let contentPages: ContentPages | null = null;

/** The full content and the code of every page but the route map, loaded on the first visit to such a page. */
async function loadContent(): Promise<ContentPages> {
  const [pages] = await Promise.all([import('./content-pages'), loadRegistry()]);
  contentPages = pages;
  return pages;
}

function topBar(current: Route): HTMLElement {
  const nav = (r: Route, label: string, ic: Parameters<typeof icon>[0], also: Route['name'][] = []) =>
    h('a.nav-link', { href: href(r), 'aria-current': current.name === r.name || also.includes(current.name) ? 'page' : undefined }, icon(ic), h('span', {}, label));
  const themeBtn = h('button.icon-btn', { type: 'button', 'aria-label': t(UI.theme), title: t(UI.theme) }, icon(shownTheme() === 'dark' ? 'moon' : 'sun'));
  themeBtn.addEventListener('click', () => {
    const next = getTheme() === 'auto' ? (shownTheme() === 'dark' ? 'light' : 'dark') : getTheme() === 'dark' ? 'light' : 'dark';
    setTheme(next);
    themeBtn.replaceChildren(icon(next === 'dark' ? 'moon' : 'sun'));
  });
  const langBtn = h(
    'div.lang-switch',
    { role: 'group', 'aria-label': t(UI.language) },
    ...(['ru', 'en'] as const).map((l) => h('button', { type: 'button', 'aria-pressed': lang() === l ? 'true' : 'false', onclick: () => setLang(l) }, l.toUpperCase())),
  );
  const exportBtn = h('button.icon-btn', { type: 'button', 'aria-label': t(UI.exportProgress), title: t(UI.exportProgress) }, icon('download'));
  exportBtn.addEventListener('click', async () => {
    downloadFile(`devops-trainer-progress-${new Date().toISOString().slice(0, 10)}.json`, await exportWithFeedback(store.exportJSON()));
  });
  return h(
    'header.topbar',
    {},
    h('a.brand', { href: href({ name: 'home' }) }, h('span.brand-mark', { 'aria-hidden': 'true' }, icon('term')), h('span', {}, t(UI.course))),
    h(
      'nav.topnav',
      {},
      nav({ name: 'professions' }, t(bi('Профессии', 'Professions')), 'map', ['profession', 'block', 'placement', 'exam']),
      nav({ name: 'courses' }, t(bi('Курсы', 'Courses')), 'doc', ['course']),
      nav({ name: 'review' }, t(UI.review), 'repeat'),
      nav({ name: 'about' }, t(bi('Справка', 'Help')), 'book'),
      nav({ name: 'settings' }, t(UI.settings), 'gear'),
      h('a.nav-link.feedback-menu', { href: '#/messages' }, icon('ask'), h('span', {}, t(bi('Мои сообщения', 'My messages')))),
    ),
    h('div.top-tools', {}, helpButton(), exportBtn, langBtn, themeBtn),
  );
}

function reminder(): HTMLElement | null {
  if (!store.reminderDue()) return null;
  store.record({ kind: 'reminder.shown' });
  const bar = h('div.reminder', { role: 'status' });
  const exp = h('button.btn.small', { type: 'button' }, icon('download'), t(UI.export));
  exp.addEventListener('click', async () => {
    downloadFile(`devops-trainer-progress-${new Date().toISOString().slice(0, 10)}.json`, await exportWithFeedback(store.exportJSON()));
    bar.remove();
  });
  const dismiss = h('button.btn.ghost.small', { type: 'button' }, t(UI.dismiss));
  dismiss.addEventListener('click', () => {
    store.record({ kind: 'reminder.dismissed' });
    bar.remove();
  });
  bar.append(h('span', {}, t(UI.reminder)), exp, dismiss);
  return bar;
}

export function startApp(root: HTMLElement): void {
  let page: Page | null = null;
  let route: Route = { name: 'home' };
  const header = h('div.top');
  const main = h('main.page', { id: 'main', tabindex: -1 });
  const footer = h(
    'footer.foot',
    {},
    h('p', {}, t(bi('Прогресс сохраняется в этом браузере после каждого действия.', 'Progress is saved in this browser after every action.'))),
  );
  // Shown while the full content loads; outside <main>, which stays empty until the page is ready.
  const loadingLine = h('p.boot-loading', { role: 'status', hidden: true }, t(bi('Загружаем учебник…', 'Loading the textbook…')));
  root.append(h('a.skip', { href: '#main', onclick: (e: Event) => (e.preventDefault(), main.focus()) }, t(bi('К содержанию', 'Skip to content'))), header, loadingLine, main, footer);

  let shown = 0;
  let readingKey: string | undefined;
  let restoring = false;
  const saveReading = () => { if (readingKey && !restoring) saveDraft(readingKey, window.scrollY); };
  window.addEventListener('scroll', saveReading, { passive: true });
  window.addEventListener('pagehide', saveReading);

  const waitForContent = (r: Route, seq: number, keepScroll: boolean) => {
    clear(main);
    loadingLine.textContent = t(bi('Загружаем учебник…', 'Loading the textbook…'));
    loadingLine.hidden = false;
    loadContent().then(
      () => {
        if (seq === shown) show(r, keepScroll);
      },
      () => {
        if (seq !== shown) return;
        loadingLine.hidden = true;
        const retry = h('button.btn', { type: 'button', onclick: () => show(r, keepScroll) }, t(bi('Попробовать ещё раз', 'Try again')));
        main.replaceChildren(h('div.empty', {}, h('p', {}, t(bi('Не удалось загрузить учебник. Проверьте соединение с сетью.', 'The textbook could not be loaded. Check the network connection.'))), retry));
      },
    );
  };
  const show = (r: Route, keepScroll = false): void => {
    saveReading();
    readingKey = undefined;
    route = r;
    const seq = ++shown;
    contentPages?.closeDoc();
    page?.dispose?.();
    page = null;
    clear(header);
    header.append(topBar(r));
    // The route map needs only the manifest; every other page needs the full content.
    const pages = registry.complete ? contentPages : null;
    if (r.name !== 'home' && !pages) {
      waitForContent(r, seq, keepScroll);
      return;
    }
    loadingLine.hidden = true;
    const rem = reminder();
    if (rem) header.append(rem);
    page = r.name === 'home' || !pages ? homePage() : pages.renderPage(r);
    clear(main);
    main.append(page.el);
    footer.replaceChildren(h('p', {}, t(bi('Прогресс сохраняется в этом браузере после каждого действия. Здесь учатся, а не играют: без очков, значков и серий.', 'Progress is saved in this browser after every action. This is a place to learn, not to play: no points, badges or streaks.'))));
    footer.append(
      h(
        'p.foot-links',
        {},
        h('a', { href: href({ name: 'about' }) }, t(bi('Справка о платформе', 'About the platform'))),
        ' · ',
        h('a', { href: href({ name: 'about', page: 'deploy' }) }, t(bi('Развернуть у себя', 'Run it yourself'))),
        ' · ',
        h('a', { href: href({ name: 'about', page: 'contribute' }) }, t(bi('Как поучаствовать', 'Contributing'))),
        ' · ',
        h('a', { href: href({ name: 'about', page: 'projects' }) }, t(bi('Наши проекты', 'Our projects'))),
      ),
    );
    const exportBtn = h('button.btn.ghost', { type: 'button' }, icon('download'), t(UI.export));
    exportBtn.addEventListener('click', async () => {
      downloadFile(`devops-trainer-progress-${new Date().toISOString().slice(0, 10)}.json`, await exportWithFeedback(store.exportJSON()));
    });
    footer.append(
      h(
        'div.foot-actions',
        {},
        exportBtn,
        h('button.btn.ghost', { type: 'button', onclick: () => window.dispatchEvent(new Event('feedback-contact')) }, t(bi('Написать автору', 'Contact the author'))),
      ),
    );
    window.dispatchEvent(new Event('feedback-page'));
    readingKey = r.name === 'lesson' ? `reading.${r.id}` : undefined;
    if (!keepScroll) {
      const top = readingKey ? loadDraft(readingKey, 0) : 0;
      restoring = true;
      requestAnimationFrame(() => {
        if (seq !== shown) return;
        window.scrollTo({ top: Number.isFinite(top) ? top : 0, behavior: 'instant' });
        restoring = false;
      });
    }

  };
  mountFeedback();
  onRoute((r) => show(r));
  onLangChange(() => show(route, true));
}
