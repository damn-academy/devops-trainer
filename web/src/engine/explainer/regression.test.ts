// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { bi, setLang } from '../../core/i18n';
import type { ExplainerCtx, ProcessModel } from '../../core/types';
import { mountModel, restAt } from './render';
import { placeCallout } from './callout';
import { fitSub, overlap } from './tidy';

const card = { what: bi('Узел', 'Node'), who: bi('Курс', 'Course') };
const model: ProcessModel = {
  id: 'regression', block: 'orient', title: bi('Проверка', 'Check'),
  diagram: {
    width: 600, height: 300,
    nodes: [
      { id: 'a', label: 'A', sub: bi('4 ядра', '4 cores'), x: 20, y: 100, w: 100, h: 50, family: 'node', card },
      { id: 'b', label: 'B', sub: 'PID 1', x: 480, y: 100, w: 100, h: 50, family: 'node', card },
    ],
    edges: [{ id: 'e', from: 'a', to: 'b', label: 'HTTP', card }],
    groups: [{ id: 'g', label: 'Group', around: ['b'], family: 'node', card }],
  },
  params: [{ id: 'delay', label: bi('Задержка', 'Delay'), kind: 'range', min: 0, max: 10, default: 5, unit: bi('мс', 'ms') }],
  metrics: [{ id: 'time', label: bi('Время', 'Time'), unit: bi('мс', 'ms') }],
  breaks: [],
  run: () => [
    { id: 'request', label: bi('Длинная подпись первого шага', 'A long first step label'), caption: bi('Запрос', 'Request'), focus: ['a'], tokens: [{ edge: 'e', label: 'GET' }], states: { g: 'off' }, metrics: { time: 5 } },
    { id: 'reply', label: '200', caption: bi('Ответ', 'Reply'), focus: ['b'], tokens: [{ edge: 'e', label: '200', reverse: true }], states: { g: 'hidden' }, metrics: { time: 10 } },
  ],
  explainDelta: () => bi('Изменено', 'Changed'),
};
const ctx: ExplainerCtx = { level: 'experienced', record() {}, onComplete() {}, openDoc() {} };
const mounted: ReturnType<typeof mountModel>[] = [];
function mount(m = model) {
  const root = document.createElement('div');
  document.body.append(root);
  mounted.push(mountModel(root, m, ctx));
  return root;
}
afterEach(() => {
  mounted.splice(0).forEach((m) => m.dispose());
  document.body.replaceChildren();
  setLang('ru');
});

describe('explainer visual regressions', () => {
  it('localizes subtitles, knob units and metric units while preserving plain strings', () => {
    for (const [language, cores, unit] of [['ru', '4 ядра', 'мс'], ['en', '4 cores', 'ms']] as const) {
      setLang(language);
      const root = mount();
      expect(root.querySelector('[data-id="a"] .node-sub')?.textContent).toBe(cores);
      expect(root.querySelector('[data-id="b"] .node-sub')?.textContent).toBe('PID 1');
      expect(root.querySelector('.ex-knobs')?.textContent).toContain(`5 ${unit}`);
      expect(root.querySelector('.ex-metrics')?.textContent).toContain(`5 ${unit}`);
    }
  });

  it('reverses reply arrowheads, restores request arrowheads and exposes full tick labels to keyboard users', () => {
    const root = mount();
    const path = root.querySelector('.edge-line')!;
    const ticks = root.querySelectorAll<HTMLButtonElement>('.ex-tick');
    expect(path.getAttribute('marker-start')).toBe('none');
    ticks[1].click();
    expect(path.getAttribute('marker-end')).toBe('none');
    expect(path.getAttribute('marker-start')).toContain('url(');
    expect(root.querySelector('.group')?.getAttribute('aria-hidden')).toBe('true');
    ticks[0].click();
    expect(path.getAttribute('marker-start')).toBe('none');
    expect(path.getAttribute('marker-end')).toContain('url(');
    expect(root.querySelector('.group')?.classList.contains('st-off')).toBe(true);
    expect(ticks[0].tabIndex).toBe(0);
    expect(ticks[0].getAttribute('aria-label')).toBe('Длинная подпись первого шага');
    expect(ticks[0].closest('[aria-hidden="true"]')).toBeNull();
  });

  it('keeps undirected edges free of arrowheads even when carrying a reply', () => {
    const root = mount({ ...model, diagram: { ...model.diagram, edges: model.diagram.edges.map((e) => ({ ...e, undirected: true })) } });
    root.querySelectorAll<HTMLButtonElement>('.ex-tick')[1].click();
    const path = root.querySelector('.edge-line')!;
    expect(path.getAttribute('marker-start')).toBe('none');
    expect(path.getAttribute('marker-end')).toBe('none');
  });

  it('allows a bubble outside a crowded drawing instead of covering captions or cards', () => {
    const anchor = { x: 100, y: 10, w: 100, h: 50 };
    const obstacles = [{ x: 0, y: 65, w: 400, h: 200 }, { x: 210, y: 0, w: 200, h: 70 }];
    const placed = placeCallout(anchor, 160, 60, obstacles, { x: 0, y: 0, w: 400, h: 265 }, [], true);
    expect(placed.box.y).toBeLessThan(0);
    expect(obstacles.every((b) => overlap(b, placed.box) === 0)).toBe(true);
  });

  it('fits the visible camera without changing node coordinates and keeps fixed framing as the default', () => {
    Object.defineProperty(SVGElement.prototype, 'getBBox', { configurable: true, value() {
      const n = model.diagram.nodes.find((n) => n.id === this.getAttribute('data-id'));
      return n ? { x: n.x, y: n.y, width: n.w, height: n.h } : { x: 20, y: 100, width: 0, height: 0 };
    } });
    document.documentElement.setAttribute('data-calm', '');
    try {
      const framed: ProcessModel = { ...model, frame: 'visible', run: () => [
        { id: 'first', label: 'First', caption: bi('Первый', 'First'), focus: [], states: { b: 'hidden', e: 'hidden', g: 'hidden' } },
        { id: 'next', label: 'Next', caption: bi('Следующий', 'Next'), focus: [], reveal: ['b', 'e', 'g'] },
      ] };
      const root = mount(framed);
      const svg = root.querySelector('svg.ex-svg')!;
      const width = () => Number(svg.getAttribute('viewBox')!.split(' ')[2]);
      const initial = width();
      const nodeX = root.querySelector('[data-id="a"] .node-shape')!.getAttribute('x');
      root.querySelectorAll<HTMLButtonElement>('.ex-tick')[1].click();
      expect(width()).toBeGreaterThan(initial * 2);
      expect(root.querySelector('[data-id="a"] .node-shape')!.getAttribute('x')).toBe(nodeX);
      const fixed = mount({ ...framed, frame: undefined });
      const before = fixed.querySelector('svg.ex-svg')!.getAttribute('viewBox');
      fixed.querySelectorAll<HTMLButtonElement>('.ex-tick')[1].click();
      expect(fixed.querySelector('svg.ex-svg')!.getAttribute('viewBox')).toBe(before);
    } finally {
      delete (SVGElement.prototype as unknown as Record<string, unknown>).getBBox;
      document.documentElement.removeAttribute('data-calm');
    }
  });

  it('keeps the full subtitle through repeated fitting', () => {
    const sub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    sub.dataset.full = 'A long subtitle that does not fit';
    sub.textContent = sub.dataset.full;
    Object.defineProperty(sub, 'getComputedTextLength', { value: () => (sub.textContent?.length ?? 0) * 10 });
    document.body.append(sub);
    fitSub(sub, 80);
    const once = sub.textContent;
    fitSub(sub, 80);
    expect(sub.textContent).toBe(once);
    expect(sub.querySelector('title')?.textContent).toBe(sub.dataset.full);
  });

  it('rests a wide card at least eight units from each endpoint when it fits', () => {
    const half = 80;
    const f = restAt([[0, 0], [240, 0]], null, half);
    expect(f * 240 - half).toBeGreaterThanOrEqual(8);
    expect((1 - f) * 240 - half).toBeGreaterThanOrEqual(8);
  });
});
