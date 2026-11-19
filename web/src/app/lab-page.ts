// #/lab/<id>: a standalone lab page. It mounts the widget `lab:<id>` that an
// engine registered (the v86 engine registers `lab:multinode`).

import { h } from '../core/dom';
import { bi, t, UI } from '../core/i18n';
import { registry } from '../core/registry';
import { href } from '../core/router';
import { store } from '../core/store';
import { openDoc } from '../engine/docs/viewer';
import { emptyState, setTitle, type Page } from './common';

export function labPage(id: string): Page {
  const w = registry.widgets.get(`lab:${id}`);
  if (!w) return { el: emptyState(UI.notFound, undefined, { label: UI.backHome, href: href({ name: 'home' }) }) };
  setTitle(t(bi('Лаборатория', 'Lab')));
  const el = h('div.lab-page');
  const m = w.mount(el, {}, { level: 'beginner', complete() {}, record: (e) => store.record(e), openDoc: (r) => openDoc(r) });
  return { el, dispose: () => m.dispose() };
}
