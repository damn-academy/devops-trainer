// Entry point: fonts and styles, language, the progress store, the app shell.

import '@fontsource-variable/literata/opsz.css';
import '@fontsource-variable/literata/opsz-italic.css';
import '@fontsource-variable/inter/index.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import './styles/widgets.css';

import { startApp } from './app/shell';
import { h } from './core/dom';
import { bi, initLang, t } from './core/i18n';
import { loadRegistry } from './core/registry';
import { store } from './core/store';

async function boot(): Promise<void> {
  initLang();
  const root = document.getElementById('app');
  root?.append(h('p.boot-loading', { role: 'status' }, t(bi('Загружаем учебник…', 'Loading the textbook…'))));
  const content = loadRegistry();
  await store.init();
  await content;
  void store.requestPersist();
  if (root) {
    root.replaceChildren();
    startApp(root);
  }
}

void boot();
