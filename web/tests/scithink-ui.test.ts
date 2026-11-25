// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { blockPage } from '../src/app/block';
import { coursesPage } from '../src/app/courses-page';
import { CLAIMS, mountCalibration } from '../src/blocks/scithink/calibration';
import { SCITHINK_LESSONS } from '../src/blocks/scithink/content';
import { setLang } from '../src/core/i18n';
import { MemoryBackend, store } from '../src/core/store';
import type { Mounted } from '../src/core/types';

let mounted: Mounted | undefined;
beforeEach(async () => {
  localStorage.clear();
  await store.init(new MemoryBackend());
});
afterEach(() => {
  mounted?.dispose();
  mounted = undefined;
  setLang('ru');
});

it.each(['ru', 'en'] as const)('renders the pilot catalog and all course lesson links in %s', (lang) => {
  setLang(lang);
  const catalog = coursesPage();
  expect(catalog.el.querySelector('a[href="#/course/scithink"]')).toBeTruthy();
  const page = blockPage('scithink');
  expect(page.el.querySelectorAll('.lesson-list li')).toHaveLength(12);
  for (const lesson of SCITHINK_LESSONS) {
    expect(page.el.querySelector(`a[href="#/lesson/${lesson.id}"]`)?.textContent).toBe(lesson.title[lang]);
  }
  expect(page.el.querySelector('a[href="#/explainer/scithink.correlation"]')).toBeTruthy();
  catalog.dispose?.();
  page.dispose?.();
});

it('requires ten answers and records the current calibration statistics, including after a retry', () => {
  const el = document.createElement('div');
  const complete = vi.fn();
  const record = vi.fn();
  mounted = mountCalibration(el, undefined, { level: 'beginner', complete, record, openDoc() {} });
  for (const value of [100, 0]) {
    const show = el.querySelector<HTMLButtonElement>('.scb-actions .scb-btn')!;
    expect(show.disabled).toBe(true);
    show.click();
    expect(el.querySelector('.scb-verdicts')).toBeNull();
    const inputs = [...el.querySelectorAll<HTMLInputElement>('input[type=range]')];
    expect(inputs).toHaveLength(CLAIMS.length);
    inputs.forEach((input, i) => {
      input.value = String(value);
      input.dispatchEvent(new Event('input'));
      expect(show.disabled).toBe(i < CLAIMS.length - 1);
    });
    show.click();
    expect(record).toHaveBeenLastCalledWith({ kind: 'x.calibration.done', answered: 10, mean: value, shareTrue: 50 });
    expect(el.querySelectorAll('.scb-verdict')).toHaveLength(10);
    expect(el.querySelectorAll('.scb-root > .scb-curve svg circle')).toHaveLength(1);
    mounted.dispose();
    mounted = mountCalibration(el, undefined, { level: 'beginner', complete, record, openDoc() {} });
    expect(el.querySelectorAll('.scb-verdict')).toHaveLength(10);
    el.querySelector<HTMLButtonElement>('.scb-btn.ghost')!.click();
  }
  expect(complete).toHaveBeenCalledTimes(2);
});
