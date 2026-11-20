// @vitest-environment jsdom
// The cluster repair widget in a DOM: it runs the broken cluster, refuses a
// wrong answer with its reason, and after the right one runs the repaired
// cluster and marks the layer done.

import { beforeAll, describe, expect, it } from 'vitest';
import { registry } from '../src/core/registry';
import { MemoryBackend, store } from '../src/core/store';
import type { WidgetCtx } from '../src/core/types';

beforeAll(async () => {
  await store.init(new MemoryBackend());
});

const until = async (cond: () => boolean, ms = 20000) => {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('timeout');
    await new Promise((r) => setTimeout(r, 20));
  }
};

describe('career.cluster-repair', () => {
  it('walks the first fault from the broken output to the repaired one', async () => {
    const el = document.createElement('div');
    const ctx: WidgetCtx = { level: 'beginner', complete: () => {}, record: (e) => store.record(e), openDoc: () => {} };
    const m = registry.widgets.get('career.cluster-repair')!.mount(el, undefined, ctx);
    const opt = (id: string) => el.querySelector<HTMLButtonElement>(`[data-option="${id}"]`)!;
    expect(opt('scheduler').disabled).toBe(true);
    el.querySelector<HTMLButtonElement>('.cw-repair-stage .btn.primary')!.click();
    await until(() => !!el.querySelector('.cw-repair-out .cw-out'));
    expect(el.querySelector('.cw-repair-out .cw-out')!.textContent).toMatch(/0\/3/);
    opt('scheduler').click();
    expect(el.querySelector('.cw-repair-answer')!.textContent).toMatch(/Pending/);
    opt('controller-manager').click();
    expect(el.querySelector('.cw-repair-answer')!.textContent).toMatch(/kube-controller-manager/);
    el.querySelector<HTMLButtonElement>('.cw-repair-answer .btn.primary')!.click();
    await until(() => !!el.querySelector('.cw-repair-after .cw-out'));
    expect(el.querySelector('.cw-repair-after .cw-out')!.textContent).toMatch(/3\/3/);
    expect(el.querySelector('[data-fault="cp"]')!.textContent).toMatch(/✓/);
    m.dispose();
  }, 60000);
});
