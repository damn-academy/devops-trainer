// A widget whose code loads on first mount: the emulator, xterm and the lab UI
// are not part of the app shell (09 §3.2: the v86 engine loads only when a
// lesson asks for a real machine).

import { h } from '../../core/dom';
import { bi, t } from '../../core/i18n';
import type { Mounted, WidgetCtx, WidgetReg } from '../../core/types';

export function lazyWidget(id: string, load: () => Promise<(el: HTMLElement, props: unknown, ctx: WidgetCtx) => Mounted>): WidgetReg {
  return {
    id,
    mount(el, props, ctx) {
      let inner: Mounted | null = null;
      let disposed = false;
      el.append(h('p.muted.small', {}, t(bi('Загружаю…', 'Loading…'))));
      load().then(
        (mount) => {
          if (disposed) return;
          el.replaceChildren();
          inner = mount(el, props, ctx);
        },
        (e: Error) => el.replaceChildren(h('p.err', {}, e.message)),
      );
      return {
        dispose() {
          disposed = true;
          inner?.dispose();
        },
        describe: () => inner?.describe?.() ?? '',
      };
    },
  };
}
