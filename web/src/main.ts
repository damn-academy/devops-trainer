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
import { initLang } from './core/i18n';
import { store } from './core/store';

async function boot(): Promise<void> {
  initLang();
  await store.init();
  void store.requestPersist();
  const root = document.getElementById('app');
  if (root) startApp(root);
}

void boot();
