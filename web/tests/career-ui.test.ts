// @vitest-environment jsdom
// Smoke tests of the career widgets, explainers and the assessment pages in a
// DOM: they mount, react to the main interactions and record their events.

import { beforeAll, describe, expect, it } from 'vitest';
import { registry } from '../src/core/registry';
import { MemoryBackend, store } from '../src/core/store';
import type { WidgetCtx } from '../src/core/types';

const ctx = (done: { n: number }): WidgetCtx => ({ level: 'beginner', complete: () => void done.n++, record: (e) => store.record(e), openDoc: () => {} });

beforeAll(async () => {
  await store.init(new MemoryBackend());
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame ??= (fn: () => void) => setTimeout(fn, 0);
  Element.prototype.scrollIntoView ??= function () {};
});

describe('career widgets', () => {
  it('every registered widget mounts and disposes', () => {
    for (const id of ['career.translator', 'career.drill', 'career.mock', 'career.pitch', 'career.resume', 'career.vacancy', 'career.checklist', 'career.oncall']) {
      const el = document.createElement('div');
      const m = registry.widgets.get(id)!.mount(el, id === 'career.checklist' ? { kind: 'capstone' } : undefined, ctx({ n: 0 }));
      expect(el.textContent!.length, id).toBeGreaterThan(10);
      m.dispose();
    }
  });

  it('the drill takes moves by click and by typed command, then scores', () => {
    const el = document.createElement('div');
    const done = { n: 0 };
    registry.widgets.get('career.drill')!.mount(el, { drill: 'drill.crashloop' }, ctx(done));
    const click = (re: RegExp) => [...el.querySelectorAll<HTMLButtonElement>('.cw-option')].find((b) => re.test(b.textContent ?? ''))!.click();
    click(/Уточнить|Ask/);
    const input = el.querySelector<HTMLInputElement>('.cw-cmd')!;
    input.value = 'kubectl get pods -n shop';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(el.querySelector('.cw-log')!.textContent).toContain('CrashLoopBackOff');
    expect(el.querySelectorAll('.cw-entry').length).toBe(2);
  });

  it('the vacancy analyzer gives a verdict', () => {
    const el = document.createElement('div');
    registry.widgets.get('career.vacancy')!.mount(el, undefined, ctx({ n: 0 }));
    el.querySelector<HTMLTextAreaElement>('textarea')!.value = 'Требования:\nLinux\nDocker\nKubernetes\nTerraform';
    el.querySelector<HTMLButtonElement>('.btn.primary')!.click();
    expect(el.querySelector('.cw-table')).toBeTruthy();
    expect(store.log.some((e) => e.kind === 'x.career.vacancy')).toBe(true);
  });

  it('the on-call shift enforces WIP 1', () => {
    const el = document.createElement('div');
    const m = registry.widgets.get('career.oncall')!.mount(el, undefined, ctx({ n: 0 }));
    el.querySelector<HTMLButtonElement>('.btn.primary')!.click();
    const takes = () => [...el.querySelectorAll<HTMLButtonElement>('.cw-col[data-col="new"] .btn')];
    expect(takes().length).toBe(2);
    takes()[1].click();
    expect(el.querySelectorAll('.cw-col[data-col="doing"] .cw-card').length).toBe(1);
    expect(takes().every((b) => b.disabled)).toBe(true);
    m.dispose();
  });
});

describe('career explainers', () => {
  it('each mounts from its model', () => {
    for (const id of ['career.symptom', 'career.quote', 'career.funnel', 'career.fsrs']) {
      const el = document.createElement('div');
      const m = registry.explainers.get(id)!.mount(el, { level: 'experienced', onComplete: () => {}, record: () => {}, openDoc: () => {} });
      expect(el.querySelector('svg'), id).toBeTruthy();
      m.dispose();
    }
  });
});

describe('assessment pages', () => {
  it('review, exam and placement pages render', async () => {
    const { reviewPage } = await import('../src/app/review-page');
    const { examPage } = await import('../src/app/exam-page');
    const { placementPage } = await import('../src/app/exam-placement');
    expect(reviewPage().el.textContent).toBeTruthy();
    const ex = examPage('linux.exam.first-day');
    expect(ex.el.textContent).toContain('CKA');
    const pl = placementPage('career');
    expect(pl.el.querySelectorAll('.level-card').length).toBe(1);
    pl.el.querySelector<HTMLButtonElement>('.level-card')!.click();
    expect(pl.el.querySelector('.quiz-item')).toBeTruthy();
    pl.dispose?.();
  });
});
