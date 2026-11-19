// The app shell: top bar (course name, route, review, settings, language,
// theme), the weekly "export or sign in" line, and the page outlet.

import { clear, h, icon, downloadFile } from '../core/dom';
import { bi, lang, onLangChange, setLang, t, UI } from '../core/i18n';
import { href, onRoute, type Route } from '../core/router';
import { store } from '../core/store';
import { blockPage } from './block';
import { examPage } from './exam-page';
import { placementPage } from './exam-placement';
import { emptyState, type Page } from './common';
import { homePage } from './home';
import { lessonPage } from './lesson';
import { explainerPage } from './pages';
import { labPage } from './lab-page';
import { reviewPage } from './review-page';
import { settingsPage } from './settings';
import { getTheme, setTheme, shownTheme } from './theme';
import { closeDoc } from '../engine/docs/viewer';

function render(r: Route): Page {
  switch (r.name) {
    case 'home':
      return homePage();
    case 'block':
      return blockPage(r.id);
    case 'placement':
      return placementPage(r.id);
    case 'lesson':
      return lessonPage(r.id, r.section);
    case 'explainer':
      return explainerPage(r.id);
    case 'exam':
      return examPage(r.id);
    case 'settings':
      return settingsPage();
    case 'review':
      return reviewPage();
    case 'lab':
      return labPage(r.id);
    case 'notfound':
      return { el: emptyState(UI.notFound, undefined, { label: UI.backHome, href: href({ name: 'home' }) }) };
  }
}

function topBar(current: Route): HTMLElement {
  const nav = (r: Route, label: string, ic: Parameters<typeof icon>[0]) =>
    h('a.nav-link', { href: href(r), 'aria-current': current.name === r.name ? 'page' : undefined }, icon(ic), h('span', {}, label));
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
  return h(
    'header.topbar',
    {},
    h('a.brand', { href: href({ name: 'home' }) }, h('span.brand-mark', { 'aria-hidden': 'true' }, icon('term')), h('span', {}, t(UI.course))),
    h('nav.topnav', {}, nav({ name: 'home' }, t(UI.map), 'map'), nav({ name: 'review' }, t(UI.review), 'repeat'), nav({ name: 'settings' }, t(UI.settings), 'gear')),
    h('div.top-tools', {}, langBtn, themeBtn),
  );
}

function reminder(): HTMLElement | null {
  if (!store.reminderDue()) return null;
  store.record({ kind: 'reminder.shown' });
  const bar = h('div.reminder', { role: 'status' });
  const exp = h('button.btn.small', { type: 'button' }, icon('download'), t(UI.export));
  exp.addEventListener('click', () => {
    downloadFile(`devops-trainer-progress-${new Date().toISOString().slice(0, 10)}.json`, store.exportJSON());
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
  root.append(h('a.skip', { href: '#main', onclick: (e: Event) => (e.preventDefault(), main.focus()) }, t(bi('К содержанию', 'Skip to content'))), header, main, footer);

  const show = (r: Route, keepScroll = false) => {
    route = r;
    closeDoc();
    page?.dispose?.();
    clear(header);
    header.append(topBar(r));
    const rem = reminder();
    if (rem) header.append(rem);
    page = render(r);
    clear(main);
    main.append(page.el);
    footer.replaceChildren(h('p', {}, t(bi('Прогресс сохраняется в этом браузере после каждого действия. Курс не игра: без очков, значков и серий.', 'Progress is saved in this browser after every action. The course is not a game: no points, badges or streaks.'))));
    if (!keepScroll) window.scrollTo({ top: 0 });
  };
  onRoute((r) => show(r));
  onLangChange(() => show(route, true));
}
