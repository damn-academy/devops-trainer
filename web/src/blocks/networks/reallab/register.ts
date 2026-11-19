// The widget registration of the real-Linux network labs. The lab UI, the
// emulator and xterm load only when a section mounts the widget.

import { h } from '../../../core/dom';
import { bi, t } from '../../../core/i18n';
import type { Mounted, WidgetReg } from '../../../core/types';

export const realLabWidget: WidgetReg = {
  id: 'net.reallab',
  mount(el, props, ctx) {
    let inner: Mounted | null = null;
    let disposed = false;
    el.append(h('p.muted.small', {}, t(bi('Загружаю лабораторию…', 'Loading the lab…'))));
    import('./widget').then(
      ({ mountNetLab }) => {
        if (disposed) return;
        el.replaceChildren();
        inner = mountNetLab(el, props as { lab: string }, ctx);
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
