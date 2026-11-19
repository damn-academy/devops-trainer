// Entry point: fonts and styles, language, the progress store, the app shell.
// The route map paints from the light manifest; the full content (every block
// and engine module) is loaded when the learner opens any other page.

import '@fontsource-variable/literata/opsz.css';
import '@fontsource-variable/literata/opsz-italic.css';
import '@fontsource-variable/inter/index.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import './styles/widgets.css';
import './styles/explainer.css';

import manifest from 'virtual:dt-manifest';
import { startApp } from './app/shell';
import { initLang } from './core/i18n';
import { useManifest } from './core/registry';
import { store } from './core/store';

async function boot(): Promise<void> {
  initLang();
  useManifest(manifest);
  await store.init();
  void store.requestPersist();
  const root = document.getElementById('app');
  if (root) startApp(root);
}

void boot();
