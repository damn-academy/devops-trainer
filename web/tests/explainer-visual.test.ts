// @vitest-environment jsdom
// The second layer of the process explainer: a picture built from zero
// (hidden → revealed), one focus per step, speech callouts at the acting node,
// labelled cards on the lines, pictograms, a legend, a "how to use" note,
// grouped knobs, breaks by level and the stop label. Plus the pure maths of
// callouts and the two gold explainers that use all of it.

import { beforeAll, describe, expect, it } from 'vitest';
import { bi } from '../src/core/i18n';
import type { ExplainerCtx, ProcessModel, Step } from '../src/core/types';
import { bubblePath, placeCallout, words, wrapWords } from '../src/engine/explainer/callout';
import { fold, iconPad } from '../src/engine/explainer/geometry';
import { NODE_ICONS, defaultWork } from '../src/engine/explainer/icons';
import { longChoice, mountModel, restAt } from '../src/engine/explainer/render';
import { overlap } from '../src/engine/explainer/tidy';
import { permModel } from '../src/blocks/linux/explainers/perm';
import { urlModel } from '../src/blocks/networks/explainers/url';
import { registry } from '../src/core/registry';

beforeAll(() => {
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});

const card = { what: bi('w', 'w'), who: bi('w', 'w') };
const ctx = (level: ExplainerCtx['level'] = 'beginner'): ExplainerCtx => ({ level, onComplete() {}, record() {}, openDoc() {} });

const tiny: ProcessModel = {
  id: 't.tiny',
  title: bi('Т', 'T'),
  block: 'linux',
  intro: bi('Нажмите «Начать: шаг вперёд».', 'Press “Start: step forward”.'),
  legend: [
    { mark: 'active', text: bi('работает', 'working') },
    { mark: 'icon:dns', text: bi('сервер DNS', 'DNS server') },
  ],
  stopLabel: bi('Поиск остановился', 'The search stopped'),
  diagram: {
    width: 400,
    height: 200,
    nodes: [
      { id: 'a', label: 'A', icon: 'browser', family: 'user', x: 10, y: 10, w: 140, h: 60, card },
      { id: 'b', label: 'B', icon: 'dns', family: 'l7', x: 240, y: 10, w: 140, h: 60, card },
      { id: 'c', label: 'C', icon: 'disk', family: 'store', x: 10, y: 120, w: 80, h: 30, card },
    ],
    edges: [{ id: 'ab', from: 'a', to: 'b', label: 'q', card }],
  },
  params: [
    { id: 'k1', label: bi('Один', 'One'), kind: 'toggle', default: false, group: bi('Кэши', 'Caches') },
    { id: 'k2', label: bi('Два', 'Two'), kind: 'toggle', default: false, group: bi('Соединение', 'Connection') },
    { id: 'k3', label: bi('Три', 'Three'), kind: 'toggle', default: false, group: bi('Кэши', 'Caches') },
  ],
  breaks: [
    { id: 'x', label: bi('Сломать всё', 'Break all'), remove: ['b'], predict: { prompt: bi('?', '?'), options: [{ id: 'y', text: bi('да', 'yes') }], resolve: () => 'y' } },
    { id: 'pro', label: bi('Для опытных', 'For the experienced'), remove: [], levels: ['experienced'], predict: { prompt: bi('?', '?'), options: [{ id: 'y', text: bi('да', 'yes') }], resolve: () => 'y' } },
  ],
  run(_p, broken): Step[] {
    const s: Step[] = [
      { id: 's0', label: '0', caption: bi('ноль', 'zero'), focus: ['a'], say: { a: bi('Браузер разбирает `адрес`: схема https.', 'The browser splits the `address`.') }, states: { b: 'hidden', ab: 'hidden', c: 'hidden' } },
      { id: 's1', label: '1', caption: bi('один', 'one'), focus: ['ab', 'b'], reveal: ['b', 'ab'], tokens: [{ edge: 'ab', label: bi('вопрос', 'question') }], say: { b: bi('Резолвер ищет адрес shop.example.', 'The resolver looks for shop.example.') } },
    ];
    if (broken.has('x')) s.push({ id: 's2', label: '2', caption: bi('стоп', 'stop'), focus: ['b'], broken: { at: 'b', message: 'SERVFAIL', caption: bi('на DNS', 'at DNS') } });
    return s;
  },
  explainDelta: () => bi('изменилось', 'changed'),
};

describe('explainer: a picture built from zero', () => {
  it('hidden elements appear with reveal and disappear again when scrubbing back', () => {
    const steps = tiny.run({}, new Set());
    expect(fold(steps, 0).states).toMatchObject({ b: 'hidden', ab: 'hidden' });
    expect(fold(steps, 1).states).toMatchObject({ b: 'on', ab: 'on', c: 'hidden' });
    const root = document.createElement('div');
    document.body.append(root);
    const m = mountModel(root, tiny, ctx());
    const node = (id: string) => root.querySelector(`g.node[data-id="${id}"]`)!;
    expect(node('b').getAttribute('class')).toContain('st-hidden');
    expect(node('b').getAttribute('aria-hidden')).toBe('true');
    (root.querySelector('.ex-intro-go') as HTMLButtonElement).click();
    expect(node('b').getAttribute('class')).not.toContain('st-hidden');
    expect(node('b').getAttribute('aria-hidden')).toBeNull();
    (root.querySelector('button[aria-label="Шаг назад"], button[aria-label="Step back"]') as HTMLButtonElement).click();
    expect(node('b').getAttribute('class')).toContain('st-hidden');
    m.dispose();
  });

  it('a reveal does not override a state set earlier', () => {
    const steps: Step[] = [
      { id: 'a', label: 'a', caption: bi('', ''), focus: [], states: { x: 'ok' } },
      { id: 'b', label: 'b', caption: bi('', ''), focus: [], reveal: ['x', 'y'] },
    ];
    expect(fold(steps, 1).states).toEqual({ x: 'ok', y: 'on' });
  });
});

describe('explainer: one focus, the acting node and its callout', () => {
  it('dims the rest, marks the actor and draws its sentence in a bubble', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const m = mountModel(root, tiny, ctx());
    const svg = root.querySelector('svg.ex-svg')!;
    expect(svg.classList.contains('focusing')).toBe(true);
    expect(root.querySelector('g.node[data-id="a"]')!.getAttribute('class')).toMatch(/\bfocus\b.*\bacting\b/);
    const say = root.querySelector('g.say[data-for="a"]')!;
    expect(say.querySelector('path.say-bubble')).toBeTruthy();
    // the code run keeps its font and the colon stays glued to it
    // lines are separate tspans: compare without the spaces of line breaks
    expect(say.textContent!.replace(/\s+/g, '')).toContain('Браузерразбираетадрес:схемаhttps.');
    expect(say.textContent).not.toContain('адрес :');
    expect(say.querySelector('tspan.code')?.textContent?.trim()).toBe('адрес');
    expect(m.describe!()).toContain('Браузер разбирает');
    m.dispose();
  });

  it('the token is a card with its bilingual label', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const m = mountModel(root, tiny, ctx());
    (root.querySelector('.ex-intro-go') as HTMLButtonElement).click();
    const tok = root.querySelector('g.token.card')!;
    expect(tok.textContent).toBe('вопрос');
    expect(tok.querySelector('rect.token-bg')).toBeTruthy();
    expect(root.querySelector('g.say[data-for="b"]')).toBeTruthy();
    expect(root.querySelector('g.say[data-for="a"]')).toBeNull();
    m.dispose();
  });
});

describe('explainer: pictograms, legend, intro, knobs, breaks, stop label', () => {
  it('draws pictograms inside big nodes and on the corner of small ones', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const m = mountModel(root, tiny, ctx());
    expect(root.querySelector('g.node[data-id="a"] path.icon-glyph')!.getAttribute('d')).toBe(NODE_ICONS.browser);
    expect(root.querySelector('g.node[data-id="b"]')!.getAttribute('class')).toContain('work-spin');
    expect(iconPad(tiny.diagram.nodes[0])).toBeGreaterThan(0);
    expect(iconPad(tiny.diagram.nodes[2])).toBe(0);
    // the label moves right of the icon
    expect(Number(root.querySelector('g.node[data-id="a"] text.node-label')!.getAttribute('x'))).toBeGreaterThan(10 + 140 / 2);
    m.dispose();
  });

  it('every pictogram is defined and the busy animation follows the icon', () => {
    for (const k of ['browser', 'server', 'dns', 'router', 'switch', 'disk', 'process', 'file', 'user', 'lock', 'cloud', 'container', 'terminal', 'database'] as const) expect(NODE_ICONS[k]).toMatch(/^M/);
    expect(defaultWork('dns')).toBe('spin');
    expect(defaultWork('browser')).toBe('dots');
    expect(defaultWork(undefined)).toBe('pulse');
  });

  it('shows the legend, the intro before the first step and a details line after', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const m = mountModel(root, tiny, ctx());
    expect(root.querySelectorAll('.ex-legend-item')).toHaveLength(2);
    expect(root.querySelector('.ex-legend .lg-icon path')!.getAttribute('d')).toBe(NODE_ICONS.dns);
    expect(root.querySelector('.ex-intro-text')!.textContent).toContain('Начать');
    (root.querySelector('.ex-intro-go') as HTMLButtonElement).click();
    expect(root.querySelector('.ex-intro-text')).toBeNull();
    expect(root.querySelector('.ex-intro details')).toBeTruthy();
    m.dispose();
  });

  it('groups knobs by the part of the system they change and offers breaks by level', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const m = mountModel(root, tiny, ctx('beginner'));
    const groups = [...root.querySelectorAll('fieldset.knob-group')];
    expect(groups.map((g) => g.querySelector('legend')!.textContent)).toEqual(['Кэши', 'Соединение']);
    expect([...groups[0].querySelectorAll('[data-knob]')].map((k) => k.getAttribute('data-knob'))).toEqual(['k1', 'k3']);
    expect(root.querySelectorAll('.break-toggle')).toHaveLength(1);
    m.dispose();
    const m2 = mountModel(root, tiny, ctx('experienced'));
    expect(root.querySelectorAll('.break-toggle')).toHaveLength(2);
    m2.dispose();
  });

  it('names the stop with the model’s words, or neutrally', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const m = mountModel(root, tiny, ctx());
    (root.querySelector('.break-toggle input') as HTMLInputElement).click();
    (root.querySelector('.ex-predict-opts button') as HTMLButtonElement).click();
    expect(root.querySelector('.ex-broken strong')!.textContent).toBe('Поиск остановился');
    m.dispose();
    const plain = { ...tiny, stopLabel: undefined };
    const m2 = mountModel(root, plain, ctx());
    (root.querySelector('.break-toggle input') as HTMLInputElement).click();
    (root.querySelector('.ex-predict-opts button') as HTMLButtonElement).click();
    expect(root.querySelector('.ex-broken strong')!.textContent).toBe('Остановилось');
    m2.dispose();
  });

  it('long choices become a drop-down list', () => {
    expect(longChoice(permModel.params.find((p) => p.id === 'who')!)).toBe(true);
    expect(longChoice(permModel.params.find((p) => p.id === 'u')!)).toBe(false);
  });
});

describe('callout maths', () => {
  it('splits words, keeps code runs and glues punctuation', () => {
    expect(words('eve набирает `cat index.html`: да')).toEqual([
      { text: 'eve', code: false, glue: false },
      { text: 'набирает', code: false, glue: false },
      { text: 'cat', code: true, glue: false },
      { text: 'index.html', code: true, glue: false },
      { text: ':', code: false, glue: true },
      { text: 'да', code: false, glue: false },
    ]);
  });
  it('wraps to the width', () => {
    const lines = wrapWords('aaaa bbbb cccc dddd', 90, (r) => r.text.length * 10);
    expect(lines.map((l) => l.runs.map((r) => r.text).join(' '))).toEqual(['aaaa bbbb', 'cccc dddd']);
    expect(lines.every((l) => l.width <= 90)).toBe(true);
  });
  it('places the bubble next to the node, off other boxes and inside the frame', () => {
    const anchor = { x: 100, y: 10, w: 100, h: 50 };
    const bounds = { x: 0, y: 0, w: 600, h: 400 };
    const p = placeCallout(anchor, 160, 60, [], bounds);
    expect(p.side).toBe('bottom'); // no room above
    expect(p.box.y).toBeGreaterThan(anchor.y + anchor.h);
    const blocker = { x: 60, y: 70, w: 200, h: 100 };
    const q = placeCallout(anchor, 160, 60, [blocker], bounds);
    expect(overlap(q.box, blocker)).toBe(0);
    expect(q.box.x).toBeGreaterThanOrEqual(0);
    expect(bubblePath(q.box, q.side, q.tip)).toMatch(/^M.*Z$/);
  });
  it('rests a token away from the edge label and off the nodes', () => {
    const pts: [number, number][] = [
      [0, 0],
      [400, 0],
    ];
    const f = restAt(pts, [300, 0], 30);
    expect(f).toBeLessThan(0.6);
    expect(restAt([[0, 0], [40, 0]], null, 50)).toBe(0.5);
  });
});

describe('gold explainers', () => {
  const defaults = (m: ProcessModel<any>) => Object.fromEntries(m.params.map((p) => [p.id, p.default]));
  for (const model of [permModel, urlModel] as ProcessModel<any>[]) {
    it(`${model.id}: starts small, reveals step by step, every step has an actor with an icon`, () => {
      expect(model.intro && model.legend?.length && model.stopLabel).toBeTruthy();
      const steps = model.run(defaults(model), new Set());
      const ids = new Set(model.diagram.nodes.map((n) => n.id));
      const visible0 = model.diagram.nodes.filter((n) => fold(steps, 0).states[n.id] !== 'hidden');
      expect(visible0.length).toBeLessThanOrEqual(5);
      for (const [i, st] of steps.entries()) {
        const frame = fold(steps, i);
        const actors = Object.keys(st.say ?? {});
        expect(actors.length, st.id).toBeGreaterThan(0);
        for (const a of actors) {
          expect(ids.has(a), `${st.id}: ${a}`).toBe(true);
          expect(frame.states[a], `${st.id}: ${a} is hidden`).not.toBe('hidden');
          expect(model.diagram.nodes.find((n) => n.id === a)!.icon, a).toBeTruthy();
        }
        for (const tk of st.tokens ?? []) expect(frame.states[tk.edge], `${st.id}: token on hidden ${tk.edge}`).not.toBe('hidden');
      }
      expect(steps.some((s) => s.tokens?.some((t) => t.label))).toBe(true);
    });
    it(`${model.id}: every break still names where it stopped, and says stay on visible nodes`, () => {
      for (const b of model.breaks) {
        const steps = model.run(defaults(model), new Set([b.id]));
        expect(steps.some((s) => s.broken), b.id).toBe(true);
        steps.forEach((st, i) => {
          for (const a of Object.keys(st.say ?? {})) expect(fold(steps, i).states[a], `${b.id}/${st.id}`).not.toBe('hidden');
        });
      }
    });
  }
  it('perm: the answer follows the triad of the person asking', () => {
    const d = defaults(permModel);
    const last = (p: Record<string, unknown>) => fold(permModel.run(p as never, new Set()), 99).states.result;
    expect(last(d)).toBe('err');
    expect(last({ ...d, who: 'bob' })).toBe('ok');
    expect(last({ ...d, who: 'root' })).toBe('ok');
    expect(last({ ...d, action: 'list', who: 'anna' })).toBe('ok');
  });
});

describe('every registered explainer still mounts', () => {
  it('renders all models with their default run', () => {
    const models = [...registry.explainers.values()].filter((r) => r.model);
    for (const r of models) {
      const root = document.createElement('div');
      document.body.append(root);
      const m = r.mount(root, ctx('experienced'));
      expect(root.querySelector('svg.ex-svg'), r.id).toBeTruthy();
      m.dispose();
      root.remove();
    }
  });
});
