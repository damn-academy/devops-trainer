import { messagesPage } from '../engine/feedback/messages';
// Every page except the route map. Loaded together with the full content
// (shell.ts), so the home page does not download lessons, labs or engines.

import { UI } from '../core/i18n';
import { href, type Route } from '../core/router';
import { aboutPage } from './about';
import { blockPage } from './block';
import { emptyState, type Page } from './common';
import { examPage } from './exam-page';
import { placementPage } from './exam-placement';
import { labPage } from './lab-page';
import { localLabPage } from './local-lab';
import { lessonPage } from './lesson';
import { explainerPage } from './pages';
import { reviewPage } from './review-page';
import { settingsPage } from './settings';

export { closeDoc } from '../engine/docs/viewer';

export function renderPage(r: Exclude<Route, { name: 'home' }>): Page {
  switch (r.name) {
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
    case 'messages':
      return messagesPage();
    case 'settings':
      return settingsPage();
    case 'review':
      return reviewPage();
    case 'lab':
      return labPage(r.id);
    case 'local-lab':
      return localLabPage();
    case 'about':
      return aboutPage(r.page);
    case 'notfound':
      return { el: emptyState(UI.notFound, undefined, { label: UI.backHome, href: href({ name: 'home' }) }) };
  }
}
