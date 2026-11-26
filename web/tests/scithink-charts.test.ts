// @vitest-environment jsdom
// Figures of the scientific-thinking course: the same numbers on a cropped
// and on a zero-based axis, and the base-rate thousand drawn as dots.
import { expect, it } from 'vitest';
import { AXIS_DATA, apparentRatio, mountAxis, mountThousand, thousandLayout } from '../src/blocks/scithink/charts';
import { SCITHINK_LESSONS } from '../src/blocks/scithink/content';
import type { WidgetCtx } from '../src/core/types';

const ctx = { complete() {}, record() {} } as unknown as WidgetCtx;
const lesson = (id: string) => SCITHINK_LESSONS.find(l => l.id === id)!;

it('places the figures in the lessons that describe them', () => {
  expect(lesson('scithink.numbers').sections.some(s => s.kind === 'widget' && s.widget === 'scithink.axis')).toBe(true);
  expect(lesson('scithink.base-rate').sections.some(s => s.kind === 'widget' && s.widget === 'scithink.thousand')).toBe(true);
});

it('matches the lesson arithmetic of the cropped axis', () => {
  expect(AXIS_DATA).toEqual({ old: 80, next: 82 });
  expect(apparentRatio(79)).toBe(3);
  expect(apparentRatio(0)).toBeCloseTo(1.025);
});

it('draws accessible SVG figures with fictional-data captions', () => {
  const el = document.createElement('div');
  mountAxis(el, undefined, ctx);
  const svgs = el.querySelectorAll('svg');
  expect(svgs.length).toBe(3);
  for (const svg of svgs) {
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.querySelector('title')?.textContent).toBeTruthy();
    expect(svg.querySelector('desc')?.textContent).toBeTruthy();
  }
  expect(el.textContent).toContain('вымышленные');
  const range = el.querySelector('input[type=range]') as HTMLInputElement;
  range.value = '79';
  range.dispatchEvent(new Event('input'));
  expect(el.querySelector('.sct-readout')?.textContent).toContain('в 3 раза');

  const dots = document.createElement('div');
  mountThousand(dots, undefined, ctx);
  expect(dots.querySelectorAll('circle')).toHaveLength(1000);
  expect(thousandLayout().falseAlarms.size).toBe(50);
  expect(dots.textContent).toContain('Вымышленная');
});

it('links the doubt register template from the final lesson as a download', async () => {
  const { renderMd } = await import('../src/core/markdown');
  const { existsSync } = await import('node:fs');
  const register = lesson('scithink.final').sections.find(s => s.id === 'register');
  if (register?.kind !== 'text') throw new Error('register section missing');
  for (const lang of ['ru', 'en'] as const) {
    const links = [...renderMd(register.body[lang]).querySelectorAll('a[download]')].map(a => a.getAttribute('href')!);
    expect(links).toHaveLength(2);
    for (const href of links) {
      expect(href).toMatch(/templates\/doubt-register(-en)?\.(xlsx|csv)$/);
      expect(existsSync(`public/${href.replace(/^.*templates\//, 'templates/')}`)).toBe(true);
    }
  }
});
