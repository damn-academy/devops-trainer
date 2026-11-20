// The shared process explainer (08 §3.1–3.7): a diagram the learner drives.
// Steps scrub forward and back; knobs recompute the process at once with one
// line "what changed and why" next to the knob; "break it" stops the process
// at the break; a "what will happen?" question comes before the first change
// of a knob and before every break; every element opens a card.

import { calm, clear, h, icon, put, s } from '../../core/dom';
import { bi, lang, t, type Bi } from '../../core/i18n';
import type { DiagramGroup, DiagramNode, ElementCard, ExplainerCtx, ExplainerReg, LegendMark, ModelChange, Mounted, ParamSpec, Prediction, ProcessModel, QText, Step } from '../../core/types';
import { renderInline, renderMd } from '../../core/markdown';
import { docChip } from '../docs/viewer';
import { fitSub, tidyDiagram, overlap, placeLabel, type Box } from './tidy';
import { changedElements, edgePoints, fold, iconInside, iconPad, keepIndex, metricDelta, pathD, pointAt, polyLength, type Pt } from './geometry';
import { bubblePath, estimate, placeCallout, wrapWords, type Run } from './callout';
import { defaultWork, NODE_ICONS } from './icons';

const L = {
  steps: bi('Шаги', 'Steps'),
  step: bi('Шаг', 'Step'),
  play: bi('Проиграть', 'Play'),
  pause: bi('Пауза', 'Pause'),
  back: bi('Шаг назад', 'Step back'),
  fwd: bi('Шаг вперёд', 'Step forward'),
  first: bi('В начало', 'To the start'),
  last: bi('В конец', 'To the end'),
  knobs: bi('Параметры', 'Parameters'),
  breakIt: bi('Сломать', 'Break it'),
  changed: bi('Что изменилось', 'What changed'),
  predict: bi('Что будет?', 'What will happen?'),
  youSaid: bi('Вы предположили', 'You predicted'),
  happened: bi('Вышло', 'What happened'),
  right: bi('Совпало', 'Right'),
  notRight: bi('Не совпало — посмотрите, где расходится', 'Not quite — see where it differs'),
  cardWho: bi('Кто создаёт', 'Who creates it'),
  cardSee: bi('Как посмотреть', 'How to look at it'),
  cardDoc: bi('Где написано', 'Where it is written'),
  stoppedAt: bi('Остановилось', 'Stopped'),
  howTo: bi('Как пользоваться схемой', 'How to use the diagram'),
  start: bi('Начать с первого шага', 'Start from the first step'),
  legend: bi('Как читать схему', 'How to read the diagram'),
  speed: bi('Скорость', 'Speed'),
  hintClick: bi('Нажмите на любой элемент схемы, и появится карточка с его объяснением.', 'Click any element of the diagram to open a card that explains it.'),
  cancel: bi('Отмена', 'Cancel'),
  waterfall: bi('Водопад запроса', 'Request waterfall'),
};

const txt = (q: QText) => (typeof q === 'string' ? q : t(q));

/** Build an ExplainerReg from a model: what block modules put in `explainers`. */
export function fromModel<P extends Record<string, unknown>>(model: ProcessModel<P>): ExplainerReg {
  return {
    id: model.id,
    title: model.title,
    block: model.block,
    summary: model.summary,
    concepts: model.concepts,
    model: model as unknown as ProcessModel<Record<string, unknown>>,
    mount: (el, ctx) => mountModel(el, model as unknown as ProcessModel<Record<string, unknown>>, ctx),
  };
}

interface Pending {
  change: ModelChange;
  apply: () => void;
  predict: Prediction;
  revert: () => void;
}

export function mountModel(root: HTMLElement, model: ProcessModel<Record<string, unknown>>, ctx: ExplainerCtx): Mounted {
  const d = model.diagram;
  let params: Record<string, unknown> = Object.fromEntries(model.params.map((p) => [p.id, ctx.params?.[p.id] ?? p.default]));
  const broken = new Set<string>();
  let steps: Step[] = model.run(params, broken);
  let idx = 0;
  let maxSeen = -1;
  let introStarted = false;
  let completed = false;
  let playing = 0;
  let speed = 1;
  let pending: Pending | null = null;
  const asked = new Set<string>();
  let highlight: string[] = [];
  let selected: string | null = null;

  // ── layout ──
  const svg = s('svg.ex-svg', { viewBox: `0 0 ${d.width} ${d.height}`, role: 'group', 'aria-label': t(model.title), preserveAspectRatio: 'xMidYMid meet' }) as SVGSVGElement;
  const caption = h('div.ex-caption', { 'aria-live': 'polite' });
  const brokeLine = h('div.ex-broken', { hidden: true });
  const metricsBox = h('dl.ex-metrics');
  const waterfallBox = h('figure.ex-waterfall', { hidden: !model.waterfall });
  const card = h('aside.ex-card', { hidden: true, 'aria-live': 'polite' });
  const deltaBox = h('div.ex-delta', { hidden: true, 'aria-live': 'polite' });
  const predictBox = h('div.ex-predict', { hidden: true, role: 'group' });
  const knobBox = h('div.ex-knobs');
  const breakBox = h('div.ex-breaks');
  const scrub = h('input.ex-scrub', { type: 'range', min: 0, max: Math.max(0, steps.length - 1), step: 1, value: 0, 'aria-label': t(L.steps) }) as HTMLInputElement;
  const ticks = h('div.ex-ticks');
  const counter = h('span.ex-counter');
  const playBtn = h('button.icon-btn.ex-play', { type: 'button', 'aria-label': t(L.play) }, icon('play'));
  const backBtn = h('button.icon-btn', { type: 'button', 'aria-label': t(L.back) }, icon('prev'));
  const fwdBtn = h('button.icon-btn', { type: 'button', 'aria-label': t(L.fwd) }, icon('next'));
  const firstBtn = h('button.icon-btn', { type: 'button', 'aria-label': t(L.first) }, icon('first'));
  const lastBtn = h('button.icon-btn', { type: 'button', 'aria-label': t(L.last) }, icon('last'));
  const speedSel = h(
    'select.ex-speed',
    { 'aria-label': t(L.speed) },
    ...[0.5, 1, 2].map((v) => h('option', { value: v, selected: v === 1 }, `${v}×`)),
  ) as HTMLSelectElement;

  for (const [button, label] of [[playBtn, L.play], [backBtn, L.back], [fwdBtn, L.fwd], [firstBtn, L.first], [lastBtn, L.last]] as const) {
    button.title = t(label);
    button.append(h('span', {}, t(label)));
  }

  const mobileNotes = h('div.ex-mobile-notes');
  const mobileNodes = h('details.ex-mobile-nodes', {}, h('summary', {}, t(bi('Элементы схемы', 'Diagram elements'))), ...d.nodes.map(n => h('button.btn.ghost.small', { type: 'button', onclick: () => { selected = n.id; showCard(n.id, n.card, txt(n.label)); } }, txt(n.label))));
  const canvasEl = h('div.ex-canvas', {}, svg, h('p.ex-hint', {}, t(L.hintClick)));
  const introBox = model.intro ? h('div.ex-intro', { role: 'note' }) : null;
  const legendBox = model.legend?.length ? drawLegend(model.legend) : null;
  const el = h(
    'div.explainer',
    { tabindex: 0, 'data-model': model.id, 'data-frame': model.frame ?? 'fixed' },
    h('header.ex-head', {}, h('h3', {}, t(model.title)), model.summary ? h('p.ex-summary', {}, ...renderInline(t(model.summary))) : null),
    h('div.ex-controls', {}, knobBox, breakBox),
    predictBox,
    introBox,
    // the step controls sit right above the picture, under the settings that shape it
    h('div.ex-stepper', {}, h('div.ex-buttons', {}, firstBtn, backBtn, playBtn, fwdBtn, lastBtn, counter, speedSel), h('div.ex-scrubwrap', {}, scrub, ticks)),
    h('div.ex-stage', {}, canvasEl, h('div.ex-side', {}, deltaBox, card)),
    mobileNotes,
    mobileNodes,
    brokeLine,
    caption,
    metricsBox,
    waterfallBox,
    legendBox,
  );
  clear(root);
  root.append(el);

  // ── diagram ──
  const defs = s(
    'defs',
    {},
    ...['n', 'f', 'e'].map((k) =>
      s('marker', { id: `arr-${model.id}-${k}`, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse', class: `arrow arrow-${k}` }, s('path', { d: 'M0 1 L9 5 L0 9 z' })),
    ),
  );
  svg.append(defs);
  const layerGroups = s('g.l-groups');
  const layerEdges = s('g.l-edges');
  const layerNodes = s('g.l-nodes');
  const layerTokens = s('g.l-tokens');
  const layerSay = s('g.l-say', { 'aria-hidden': 'true' });
  const measurer = s('text.say-measure', { x: -9999, y: -9999, 'aria-hidden': 'true' }) as SVGTextElement;
  svg.append(layerGroups, layerEdges, layerNodes, layerTokens, layerSay, measurer);

  const nodeEls = new Map<string, SVGElement>();
  const edgeEls = new Map<string, { g: SVGElement; path: SVGPathElement; pts: Pt[] }>();
  const subEls = new Map<string, SVGElement>();
  const fillEls = new Map<string, { el: SVGElement; n: DiagramNode }>();

  const activate = (id: string, ec: ElementCard, label: string) => (e: Event) => {
    e.stopPropagation();
    selected = id;
    showCard(id, ec, label);
    paint();
  };
  const keyActivate = (fn: (e: Event) => void) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn(e);
    }
  };

  for (const g of d.groups ?? []) drawGroup(g);
  for (const e of d.edges) {
    const pts = edgePoints(d, e);
    const path = s('path.edge-line', { d: pathD(pts), 'marker-end': `url(#arr-${model.id}-n)`, class: e.dashed ? 'dashed' : undefined }) as SVGPathElement;
    const hit = s('path.edge-hit', { d: pathD(pts) });
    const { p } = pointAt(pts, e.labelAt ?? 0.5);
    const label = txt(e.label);
    const tx = s('text.edge-label', { x: p[0], y: p[1] - 6, 'text-anchor': 'middle' }, label);
    const fn = activate(e.id, e.card, label);
    const g = s('g.edge', { 'data-id': e.id, tabindex: 0, role: 'button', 'aria-label': label, onclick: fn, onkeydown: keyActivate(fn) as never }, hit, path, tx);
    layerEdges.append(g);
    edgeEls.set(e.id, { g, path, pts });
  }
  for (const n of d.nodes) drawNode(n);

  // Once the diagram has a size and fonts are in: fit node labels, place edge labels, fit the viewBox.
  let tidyObs: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    tidyObs = new ResizeObserver((entries) => {
      if (!entries.some((en) => en.contentRect.width > 0)) return;
      tidyObs?.disconnect();
      tidyObs = null;
      const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
      void (fonts ? fonts.ready : Promise.resolve()).then(() => {
        if (disposed) return;
        tidyDiagram(svg, d);
        paint();
      });
    });
    tidyObs.observe(svg);
  }

  function drawGroup(g: DiagramGroup) {
    const members = d.nodes.filter((n) => g.around.includes(n.id));
    if (!members.length) return;
    const pad = g.pad ?? 12;
    const x = Math.min(...members.map((n) => n.x)) - pad;
    const y = Math.min(...members.map((n) => n.y)) - pad - 14;
    const w = Math.max(...members.map((n) => n.x + n.w)) + pad - x;
    const hh = Math.max(...members.map((n) => n.y + n.h)) + pad - y;
    const label = txt(g.label);
    const fn = activate(g.id, g.card, label);
    const el = s(
      'g.group',
      { 'data-id': g.id, class: `fam-${g.family} dash-${g.dash ?? 'dash'}`, tabindex: 0, role: 'button', 'aria-label': label, onclick: fn, onkeydown: keyActivate(fn) as never },
      s('rect.group-box', { x, y, width: w, height: hh, rx: 8 }),
      s('text.group-label', { x: x + 10, y: y + 14 }, label),
    );
    layerGroups.append(el);
    nodeEls.set(g.id, el);
  }

  function drawNode(n: DiagramNode) {
    const label = txt(n.label);
    const shape = n.shape ?? 'box';
    const parts: SVGElement[] = [];
    const { x, y, w, h: hh } = n;
    if (shape === 'hex') {
      const k = Math.min(18, w / 5);
      parts.push(s('polygon.node-shape', { points: `${x + k},${y} ${x + w - k},${y} ${x + w},${y + hh / 2} ${x + w - k},${y + hh} ${x + k},${y + hh} ${x},${y + hh / 2}` }));
    } else if (shape === 'doc') {
      const c = 12;
      parts.push(s('path.node-shape', { d: `M${x} ${y + 6} Q${x} ${y} ${x + 6} ${y} H${x + w - c} L${x + w} ${y + c} V${y + hh - 6} Q${x + w} ${y + hh} ${x + w - 6} ${y + hh} H${x + 6} Q${x} ${y + hh} ${x} ${y + hh - 6} Z` }));
      parts.push(s('path.node-fold', { d: `M${x + w - c} ${y} V${y + c} H${x + w}` }));
    } else {
      const rx = shape === 'pill' ? hh / 2 : 6;
      parts.push(s('rect.node-shape', { x, y, width: w, height: hh, rx }));
      if (shape === 'rack') {
        parts.push(s('line.node-rack', { x1: x + 8, y1: y + hh - 10, x2: x + w - 8, y2: y + hh - 10 }));
      }
      if (shape === 'buffer') {
        const fill = s('rect.node-fill', { x: x + 4, y: y + hh - 10, width: 0, height: 6, rx: 2 });
        parts.push(s('rect.node-gauge', { x: x + 4, y: y + hh - 10, width: w - 8, height: 6, rx: 2 }), fill);
        fillEls.set(n.id, { el: fill, n });
      }
    }
    const isBar = shape === 'bar';
    const pad = iconPad(n);
    parts.unshift(s('rect.node-halo', { x: x - 5, y: y - 5, width: w + 10, height: hh + 10, rx: shape === 'pill' ? (hh + 10) / 2 : 10 }));
    const lx = isBar ? x + 16 + pad : x + pad + (w - pad) / 2;
    const anchor = isBar ? 'start' : 'middle';
    const ly = n.sub !== undefined || shape === 'buffer' ? y + hh / 2 - (shape === 'buffer' ? 8 : 4) : y + hh / 2 + 5;
    parts.push(s('text.node-label', { x: lx, y: ly, 'text-anchor': anchor }, label));
    const sub = s('text.node-sub', { x: lx, y: ly + 17, 'text-anchor': anchor }, txt(n.sub ?? ''));
    parts.push(sub);
    subEls.set(n.id, sub);
    parts.push(s('text.node-x', { x: x + w - 10, y: y + 16, 'text-anchor': 'middle', 'aria-hidden': 'true' }, '⨯'));
    if (n.icon) parts.push(drawIcon(n));
    // "typing" dots on the top-right corner while the node writes its answer
    const dx = x + w - 20;
    parts.push(
      s(
        'g.node-dots',
        { 'aria-hidden': 'true' },
        s('rect', { x: dx - 15, y: y - 8, width: 30, height: 16, rx: 8 }),
        ...[0, 1, 2].map((i) => s('circle', { cx: dx - 7 + i * 7, cy: y, r: 2.2, style: `animation-delay:${(i * 0.18).toFixed(2)}s` })),
      ),
    );
    const fn = activate(n.id, n.card, label);
    const g = s(
      'g.node',
      { 'data-id': n.id, class: `fam-${n.family} shape-${shape}${n.icon ? ' has-icon' : ''} work-${n.work ?? defaultWork(n.icon)}`, tabindex: 0, role: 'button', 'aria-label': label, onclick: fn, onkeydown: keyActivate(fn) as never },
      ...parts,
    );
    (shape === 'bar' ? layerGroups : layerNodes).append(g);
    nodeEls.set(n.id, g);
  }

  /** The pictogram in a soft disc: inside the node on the left, or on its top-left corner when the node is small. */
  function drawIcon(n: DiagramNode): SVGElement {
    const inside = iconInside(n);
    const r = inside ? 15 : 12;
    const cx = inside ? n.x + 6 + r : n.x + 2;
    const cy = inside ? n.y + n.h / 2 : n.y + 2;
    const k = inside ? 0.8 : 0.66;
    return s(
      'g.node-icon',
      { 'aria-hidden': 'true' },
      s('circle.icon-disc', { cx, cy, r }),
      s('circle.icon-spin', { cx, cy, r: r + 3 }),
      s('path.icon-glyph', { d: NODE_ICONS[n.icon!], transform: `translate(${(cx - 12 * k).toFixed(1)} ${(cy - 12 * k).toFixed(1)}) scale(${k})` }),
    );
  }

  function drawLegend(items: NonNullable<ProcessModel['legend']>): HTMLElement {
    return h(
      'div.ex-legend',
      { role: 'list', 'aria-label': t(L.legend) },
      h('span.ex-legend-title', {}, t(L.legend)),
      ...items.map((it) => h('span.ex-legend-item', { role: 'listitem' }, legendMark(it.mark), h('span', {}, ...renderInline(t(it.text))))),
    );
  }

  function drawWaterfall() {
    const id = model.waterfall!;
    const spec = model.metrics?.find((x) => x.id === id);
    const scale = Math.max(1, steps[steps.length - 1]?.metrics?.[id] ?? 0);
    const rows: HTMLElement[] = [];
    let prev = 0;
    steps.forEach((st, i) => {
      const end = st.metrics?.[id] ?? prev;
      const dur = end - prev;
      if (dur > 0) {
        rows.push(
          h(
            'div.wf-row',
            { class: i > idx ? 'future' : i === idx ? 'now' : undefined },
            h('span.wf-name', {}, txt(st.label)),
            h('span.wf-track', {}, h('span.wf-bar', { style: `left:${(prev / scale) * 100}%;width:${Math.max(0.8, (dur / scale) * 100)}%` })),
            h('span.wf-val', {}, `${formatNum(dur)}${spec?.unit ? ' ' + txt(spec.unit) : ''}`),
          ),
        );
      }
      prev = end;
    });
    clear(waterfallBox);
    put(waterfallBox, h('figcaption', {}, t(L.waterfall)), ...rows);
  }

  function showCard(id: string, c: ElementCard, label: string) {
    clear(card);
    card.hidden = false;
    put(
      card,
      h(
        'header',
        {},
        h('strong', {}, label),
        h(
          'button.icon-btn',
          {
            type: 'button',
            'aria-label': t(bi('Закрыть карточку', 'Close the card')),
            onclick: () => {
              card.hidden = true;
              selected = null;
              paint();
            },
          },
          icon('close'),
        ),
      ),
      h('div.ex-card-what', {}, renderMd(t(c.what))),
      h('div.ex-card-who', {}, h('span.k', {}, t(L.cardWho)), ' ', renderMd(t(c.who))),
      c.see ? h('p.ex-card-see', {}, h('span.k', {}, t(L.cardSee)), ' ', h('code', {}, c.see)) : null,
      c.doc ? h('p.ex-card-doc', {}, h('span.k', {}, t(L.cardDoc)), ' ', docChip(c.doc)) : null,
    );
    ctx.record({ kind: 'x.explainer.card', explainer: model.id, element: id });
  }

  // ── painting ──
  let tokenAnim = 0;
  let cameraAnim = 0;
  let disposed = false;
  function paint(animateFrom?: number) {
    const st = steps[idx];
    const frame = fold(steps, idx);
    const brokeAt = steps.find((x, i) => i <= idx && x.broken)?.broken;
    const focus = new Set(st?.focus ?? []);
    const actors = new Set(Object.keys(st?.say ?? {}));
    const removedIds = new Set([...broken].flatMap((b) => model.breaks.find((x) => x.id === b)?.remove ?? []));
    // One focus per step: everything else steps back.
    svg.classList.toggle('focusing', focus.size > 0);
    for (const [id, g] of nodeEls) {
      const state = frame.states[id];
      g.setAttribute(
        'class',
        [
          g.getAttribute('class')!.split(' ').filter((c) => !/^(focus|st-|broken|changed|selected|removed|acting)/.test(c)).join(' '),
          focus.has(id) ? 'focus' : '',
          actors.has(id) ? 'acting' : '',
          state ? `st-${state}` : '',
          brokeAt?.at === id ? 'broken' : '',
          removedIds.has(id) ? 'removed' : '',
          highlight.includes(id) ? 'changed' : '',
          selected === id ? 'selected' : '',
        ]
          .filter(Boolean)
          .join(' '),
      );
      setHidden(g, state === 'hidden');
      const sub = subEls.get(id);
      if (sub) {
        const n = d.nodes.find((x) => x.id === id);
        const text = frame.values[id] ?? txt(n?.sub ?? '');
        if (sub.dataset.full !== text) {
          sub.dataset.full = text;
          sub.textContent = text;
          if (n && n.shape !== 'bar') fitSub(sub as SVGTextElement, n.w - iconPad(n));
        }
      }
    }
    for (const [id, f] of fillEls) {
      const v = Math.max(0, Math.min(1, frame.fill[id] ?? 0));
      f.el.setAttribute('width', String(Math.max(0, (f.n.w - 8) * v)));
      f.el.setAttribute('class', `node-fill${v >= 1 ? ' full' : ''}`);
    }
    for (const [id, e] of edgeEls) {
      const state = frame.states[id];
      const isFocus = focus.has(id);
      const isErr = state === 'err' || brokeAt?.at === id;
      const carrying = (st?.tokens ?? []).some((tk) => tk.edge === id && tk.label);
      const moving = (st?.tokens ?? []).some((tk) => tk.edge === id);
      e.g.setAttribute('class', ['edge', carrying ? 'carrying' : '', moving ? 'moving' : '', isFocus ? 'focus' : '', state ? `st-${state}` : '', removedIds.has(id) ? 'removed' : '', isErr ? 'broken' : '', selected === id ? 'selected' : '', highlight.includes(id) ? 'changed' : ''].filter(Boolean).join(' '));
      const tokens = (st?.tokens ?? []).filter((tk) => tk.edge === id);
      const undirected = d.edges.find((edge) => edge.id === id)?.undirected;
      const marker = `url(#arr-${model.id}-${isErr ? 'e' : isFocus ? 'f' : 'n'})`;
      e.path.setAttribute('marker-start', !undirected && tokens.some((tk) => tk.reverse) ? marker : 'none');
      e.path.setAttribute('marker-end', !undirected && (!tokens.length || tokens.some((tk) => !tk.reverse)) ? marker : 'none');
      setHidden(e.g, state === 'hidden');
    }
    // tokens: a labelled token is a small card with what is handed over, an unlabelled one a dot
    cancelAnimationFrame(tokenAnim);
    clear(layerTokens);
    const toks = (st?.tokens ?? []).map((tk) => {
      const e = edgeEls.get(tk.edge);
      if (!e || frame.states[tk.edge] === 'hidden') return null;
      const pts = tk.reverse ? [...e.pts].reverse() : e.pts;
      const g = tk.label ? tokenCard(txt(tk.label)) : s('g.token.dot', {}, s('circle', { r: 5 }));
      layerTokens.append(g);
      const lab = e.g.querySelector('text.edge-label');
      const at: Pt | null = lab ? [Number(lab.getAttribute('x')), Number(lab.getAttribute('y')) - 4] : null;
      const half = tk.label ? Number(g.getAttribute('data-w')) / 2 : 6;
      const preferred = restAt(pts, at, half);
      const nodeBoxes = d.nodes.filter((n) => frame.states[n.id] !== 'hidden').map((n) => ({ x: n.x - 8, y: n.y - 8, w: n.w + 16, h: n.h + 16 }));
      for (const caption of svg.querySelectorAll<SVGGraphicsElement>('.node-label, .node-sub, .group-label')) {
        if (caption.closest('.st-hidden, .removed') || typeof caption.getBBox !== 'function') continue;
        const b = caption.getBBox();
        nodeBoxes.push({ x: b.x - 4, y: b.y - 4, w: b.width + 8, h: b.height + 8 });
      }
      const fits = (f: number, shift: Pt) => {
        const { p } = pointAt(pts, f);
        const box = { x: p[0] + shift[0] - half, y: p[1] + shift[1] - 11, w: half * 2, h: 22 };
        return nodeBoxes.every((n) => overlap(box, n) === 0);
      };
      // Try positions on the line first; a short line may need a small perpendicular offset.
      let best: { rest: number; shift: Pt; score: number } | undefined;
      const fractions = [preferred, ...Array.from({ length: 19 }, (_, i) => (i + 1) / 20)];
      for (let distance = 0; distance <= Math.max(d.width, d.height); distance += 8) {
        if (best && distance * 2 > best.score) break;
        for (const f of fractions) {
          const { angle } = pointAt(pts, f);
          for (const side of distance ? [-1, 1] : [1]) {
            const shift: Pt = [-Math.sin(angle) * distance * side, Math.cos(angle) * distance * side];
            const score = distance * 2 + Math.abs(f - preferred) * polyLength(pts) * 0.3;
            if ((!best || score < best.score) && fits(f, shift)) best = { rest: f, shift, score };
          }
        }
      }
      const { rest, shift } = best ?? { rest: preferred, shift: [0, 0] as Pt };
      let start = rest;
      // Animate only the contiguous part of the route that stays clear of nodes.
      while (start > 0.03 && fits(start - 0.02, shift)) start -= 0.02;
      return { g, pts, rest, half, shift, start };
    });
    const place = (f: number | null) => {
      for (const tk of toks) {
        if (!tk) continue;
        const { p } = pointAt(tk.pts, f ?? tk.rest);
        tk.g.setAttribute('transform', `translate(${(p[0] + tk.shift[0]).toFixed(1)} ${(p[1] + tk.shift[1]).toFixed(1)})`);
      }
    };
    const animate = animateFrom !== undefined && animateFrom < idx && !calm();
    if (animate && toks.some(Boolean)) {
      const start = performance.now();
      const dur = 520 / speed;
      const tick = (now: number) => {
        const k = Math.max(0, Math.min(1, (now - start) / dur));
        const eased = 1 - Math.pow(1 - k, 3);
        for (const tk of toks) if (tk) tk.g.setAttribute('transform', translateAt(tk.pts, tk.start + (tk.rest - tk.start) * eased, tk.shift));
        if (k < 1) tokenAnim = requestAnimationFrame(tick);
      };
      for (const tk of toks) if (tk) tk.g.setAttribute('transform', translateAt(tk.pts, tk.start, tk.shift));
      tokenAnim = requestAnimationFrame(tick);
    } else place(null);

    const tokenBoxes = toks.flatMap((tk) => {
      if (!tk) return [];
      const points = Array.from({ length: 25 }, (_, i) => pointAt(tk.pts, tk.start + (tk.rest - tk.start) * i / 24).p);
      const xs = points.map((p) => p[0] + tk.shift[0]);
      const ys = points.map((p) => p[1] + tk.shift[1]);
      return [{ x: Math.min(...xs) - tk.half - 3, y: Math.min(...ys) - 14,
        w: Math.max(...xs) - Math.min(...xs) + tk.half * 2 + 6, h: Math.max(...ys) - Math.min(...ys) + 28 }];
    });
    tidyDiagram(svg, d);
    const labelObstacles = [...d.nodes.filter((n) => frame.states[n.id] !== 'hidden'), ...tokenBoxes];
    for (const [id, edge] of edgeEls) {
      if (frame.states[id] === 'hidden') continue;
      const label = edge.g.querySelector<SVGTextElement>('text.edge-label');
      if (!label || typeof label.getBBox !== 'function') continue;
      const b = label.getBBox();
      if (tokenBoxes.some((box) => overlap(box, { x: b.x, y: b.y, w: b.width, h: b.height }))) {
        const box = placeLabel(edge.pts, d.edges.find((e) => e.id === id)?.labelAt ?? 0.5, b.width + 6, b.height + 6, labelObstacles);
        label.setAttribute('x', String(Number(label.getAttribute('x')) + box.x + 3 - b.x));
        label.setAttribute('y', String(Number(label.getAttribute('y')) + box.y + 3 - b.y));
      }
      const placed = label.getBBox();
      labelObstacles.push({ x: placed.x, y: placed.y, w: placed.width, h: placed.height });
    }
    clear(mobileNotes);
    for (const [id, text] of Object.entries(st?.say ?? {})) {
      const node = d.nodes.find(n => n.id === id);
      mobileNotes.append(h('p', {}, node ? h('strong', {}, txt(node.label), '. ') : null, ...renderInline(t(text))));
    }
    drawSays(st, frame.states, tokenBoxes);
    fitCamera(tokenBoxes);
    keepInView(animateFrom !== undefined);

    // caption, broken line, metrics, stepper
    clear(caption);
    if (st) caption.append(renderMd(t(st.caption)));
    if (brokeAt) {
      brokeLine.hidden = false;
      clear(brokeLine);
      brokeLine.append(h('span.st-icon.err', { 'aria-hidden': 'true' }, '⨯'), h('div', {}, ...(/^[A-ZА-ЯЁ]/.test(t(brokeAt.caption)) ? [h('strong', {}, ...renderInline(t(brokeAt.caption)))] : [h('strong', {}, t(model.stopLabel ?? L.stoppedAt)), ' — ', t(brokeAt.caption)]), h('pre.tool-msg', {}, brokeAt.message)));
    } else brokeLine.hidden = true;
    clear(metricsBox);
    const m = st?.metrics ?? {};
    for (const spec of model.metrics ?? []) {
      if (st?.metricText?.[spec.id] !== undefined) {
        metricsBox.append(h('div', {}, h('dt', {}, t(spec.label)), h('dd', {}, txt(st.metricText[spec.id]))));
        continue;
      }
      if (!(spec.id in m)) continue;
      metricsBox.append(h('div', {}, h('dt', {}, t(spec.label)), h('dd', {}, `${formatNum(m[spec.id])}${spec.unit ? ' ' + txt(spec.unit) : ''}`)));
    }
    if (model.waterfall) drawWaterfall();
    scrub.max = String(Math.max(0, steps.length - 1));
    scrub.value = String(idx);
    counter.textContent = `${t(L.step)} ${idx + 1} / ${steps.length}`;
    backBtn.toggleAttribute('disabled', idx === 0);
    firstBtn.toggleAttribute('disabled', idx === 0);
    fwdBtn.toggleAttribute('disabled', idx >= steps.length - 1);
    lastBtn.toggleAttribute('disabled', idx >= steps.length - 1);
    for (const [i, tick] of [...ticks.children].entries()) tick.classList.toggle('on', i <= idx);
  }

  /** Animate only the camera; the drawing retains its authored coordinates. */
  function fitCamera(tokenBoxes: Box[]) {
    const parts = [...svg.querySelectorAll<SVGGraphicsElement>('.node, .edge, .group, .say, .token')];
    const boxes = parts.flatMap((el) => {
      if (typeof el.getBBox !== 'function' || el.classList.contains('removed') || (model.frame === 'visible' && el.classList.contains('st-hidden'))) return [];
      const b = el.getBBox();
      const transform = el.transform?.baseVal.consolidate()?.matrix;
      return [{ x: b.x + (transform?.e ?? 0), y: b.y + (transform?.f ?? 0), w: b.width, h: b.height }];
    });
    boxes.push(...tokenBoxes);
    if (!boxes.length) return;
    const x = Math.min(...boxes.map((b) => b.x)) - 20;
    const y = Math.min(...boxes.map((b) => b.y)) - 20 - (d.topPadding ?? 0);
    const target = [x, y, Math.max(...boxes.map((b) => b.x + b.w)) + 20 - x, Math.max(...boxes.map((b) => b.y + b.h)) + 20 - y];
    cancelAnimationFrame(cameraAnim);
    const from = (svg.dataset.camera ?? target.join(' ')).split(' ').map(Number);
    const start = performance.now();
    const update = (now: number) => {
      const k = calm() ? 1 : Math.max(0, Math.min(1, (now - start) / 320));
      const eased = 1 - (1 - k) ** 3;
      const value = target.map((v, i) => from[i] + (v - from[i]) * eased).join(' ');
      svg.setAttribute('viewBox', value);
      svg.dataset.camera = value;
      if (k < 1) cameraAnim = requestAnimationFrame(update);
    };
    svg.style.setProperty('--ex-minw', `${Math.round(target[2] * 0.7)}px`);
    update(start);
  }

  function setHidden(g: SVGElement, hidden: boolean) {
    if (hidden) {
      g.setAttribute('aria-hidden', 'true');
      g.setAttribute('tabindex', '-1');
    } else if (g.getAttribute('aria-hidden')) {
      g.removeAttribute('aria-hidden');
      g.setAttribute('tabindex', '0');
    }
  }

  /** Width of a word in the callout or token font; an estimate until the diagram is laid out. */
  function measure(r: Run, size: number, cls: string): number {
    if (typeof measurer.getComputedTextLength === 'function' && measurer.isConnected) {
      measurer.setAttribute('class', `say-measure ${cls}${r.code ? ' code' : ''}`);
      measurer.textContent = r.text;
      const w = measurer.getComputedTextLength();
      if (w > 0) return w;
    }
    return estimate(r, size);
  }

  function tokenCard(label: string): SVGElement {
    const run = { text: label, code: true };
    const w = measure(run, 11.5, 'token-text') + 30;
    const hh = 22;
    return s(
      'g.token.card',
      { 'data-w': Math.ceil(w) },
      s('rect.token-bg', { x: -w / 2, y: -hh / 2, width: w, height: hh, rx: 5 }),
      s('path.token-env', { d: `M${-w / 2 + 7} -4 h12 v8 h-12 Z M${-w / 2 + 7} -4 l6 4.5 l6 -4.5`, transform: '' }),
      s('text.token-text', { x: -w / 2 + 24, y: 4 }, label),
    );
  }

  /** The speech callouts of the acting nodes, placed where they cover the least. */
  function drawSays(st: Step | undefined, states: Record<string, string>, tokenBoxes: Box[]) {
    clear(layerSay);
    const says = Object.entries(st?.say ?? {}).filter(([id]) => states[id] !== 'hidden');
    if (!says.length) return;
    const vb = svg.viewBox.baseVal;
    const bounds: Box = vb && vb.width ? { x: vb.x, y: vb.y, w: vb.width, h: vb.height } : { x: 0, y: 0, w: d.width, h: d.height };
    const visible = d.nodes.filter((n) => states[n.id] !== 'hidden' && n.shape !== 'bar');
    const obstacles: Box[] = visible.map((n) => ({ x: n.x - 4, y: n.y - 4, w: n.w + 8, h: n.h + 8 }));
    obstacles.push(...tokenBoxes);
    for (const el of svg.querySelectorAll<SVGGraphicsElement>('.edge-label, .group-label, .node-label, .node-sub')) {
      if (el.closest('.st-hidden, .removed') || typeof el.getBBox !== 'function') continue;
      const b = el.getBBox();
      obstacles.push({ x: b.x - 4, y: b.y - 4, w: b.width + 8, h: b.height + 8 });
    }
    const lines: [Pt, Pt][] = [];
    for (const [id, e] of edgeEls) if (states[id] !== 'hidden') for (let i = 1; i < e.pts.length; i++) lines.push([e.pts[i - 1], e.pts[i]]);
    // on a phone the picture is scaled down: the callout text grows so it stays readable
    const scale = svg.clientWidth && bounds.w ? svg.clientWidth / bounds.w : 1;
    const size = Math.max(14, Math.min(19, 11.5 / (scale || 1)));
    const lh = Math.round(size * 1.36);
    layerSay.style.setProperty('--say-size', `${size.toFixed(1)}px`);
    for (const [id, text] of says) {
      const n = d.nodes.find((x) => x.id === id);
      if (!n) continue;
      const maxW = Math.min(300, Math.max(200, bounds.w * 0.3));
      const linesOf = wrapWords(t(text), maxW - 24, (r) => measure(r, size, 'say-text') * (size / 14));
      const w = Math.max(...linesOf.map((l) => l.width), 60) + 24;
      const hh = linesOf.length * lh + 16;
      const anchor = { x: n.x, y: n.y, w: n.w, h: n.h };
      const pl = placeCallout(anchor, w, hh, obstacles, bounds, lines, true);
      obstacles.push(pl.box);
      const textEl = s('text.say-text', { x: pl.box.x + 12, y: pl.box.y + 8 + lh * 0.72 });
      linesOf.forEach((ln, i) => {
        ln.runs.forEach((r, j) => {
          const ts = s('tspan', { class: r.code ? 'code' : undefined }, (j && !r.glue ? ' ' : '') + r.text);
          if (j === 0) {
            ts.setAttribute('x', String(pl.box.x + 12));
            if (i) ts.setAttribute('dy', String(lh));
          }
          textEl.append(ts);
        });
      });
      layerSay.append(s('g.say', { 'data-for': id, class: `side-${pl.side}` }, s('path.say-bubble', { d: bubblePath(pl.box, pl.side, pl.tip) }), textEl));
    }
  }

  /** On a narrow screen the diagram scrolls sideways: bring the acting node and its callout into view. */
  function keepInView(smooth: boolean) {
    if (canvasEl.scrollWidth <= canvasEl.clientWidth + 4) return;
    const targets = [...layerSay.querySelectorAll('g.say'), ...svg.querySelectorAll('g.node.acting, g.node.focus')] as SVGGraphicsElement[];
    if (!targets.length) return;
    const c = canvasEl.getBoundingClientRect();
    let x0 = Infinity;
    let x1 = -Infinity;
    for (const el of targets) {
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      x0 = Math.min(x0, r.left);
      x1 = Math.max(x1, r.right);
    }
    if (!Number.isFinite(x0)) return;
    const mid = (x0 + x1) / 2 - c.left + canvasEl.scrollLeft;
    const left = x1 - x0 > c.width ? x0 - c.left + canvasEl.scrollLeft - 8 : mid - c.width / 2;
    canvasEl.scrollTo({ left: Math.max(0, left), behavior: smooth && !calm() ? 'smooth' : 'auto' });
  }

  function drawTicks() {
    clear(ticks);
    steps.forEach((st, i) => {
      ticks.append(
        h(
          'button.ex-tick',
          { type: 'button', style: `left:${steps.length > 1 ? (i / (steps.length - 1)) * 100 : 0}%;max-width:calc(${100 / Math.max(1, steps.length)}% - 4px)`, tabindex: 0, 'aria-label': txt(st.label), 'data-label': txt(st.label), title: txt(st.label), onclick: () => go(i), class: st.broken ? 'broken' : undefined },
          h('span', {}, txt(st.label)),
        ),
      );
    });
  }

  function go(i: number, animate = true) {
    if (pending) return;
    const prev = idx;
    idx = Math.max(0, Math.min(steps.length - 1, i));
    el.dataset.feedbackStep = steps[idx]?.id ?? String(idx);
    if (idx > maxSeen) {
      maxSeen = idx;
      ctx.record({ kind: 'explainer.step', explainer: model.id, step: idx, total: steps.length });
    }
    if (!completed && maxSeen >= steps.length - 1) {
      completed = true;
      ctx.record({ kind: 'explainer.done', explainer: model.id });
      ctx.onComplete();
    }
    paint(animate ? prev : undefined);
    drawIntro();
  }

  /** "How to use" before the first step; afterwards it folds into a details line. */
  function drawIntro() {
    if (!introBox || !model.intro) return;
    const fresh = maxSeen <= 0 && !introStarted;
    fwdBtn.classList.toggle('ex-cue', fresh);
    if (introBox.dataset.fresh === String(fresh)) return;
    introBox.dataset.fresh = String(fresh);
    clear(introBox);
    if (fresh) {
      put(
        introBox,
        h('div.ex-intro-text', {}, renderMd(t(model.intro))),
        h('button.btn.primary.ex-intro-go', { type: 'button', onclick: () => { introStarted = true; go(0, false); } }, t(L.start), ' ', icon('next')),
      );
    } else put(introBox, h('details.ex-intro-more', {}, h('summary', {}, t(L.howTo)), renderMd(t(model.intro))));
  }

  function stop() {
    if (playing) clearTimeout(playing);
    playing = 0;
    playBtn.replaceChildren(icon('play'), h('span', {}, t(L.play)));
    playBtn.title = t(L.play);
    playBtn.setAttribute('aria-label', t(L.play));
  }
  /** How long a step stays on screen while playing: enough to read its caption and callouts at 1×. */
  function readingTime(i: number): number {
    const st = steps[i];
    if (!st) return 3000;
    let chars = t(st.caption).length;
    for (const v of Object.values(st.say ?? {})) chars += t(v).length;
    const ms = 2200 + chars * 45; // ~45 ms per character is a calm reading pace
    return Math.min(14000, Math.max(3000, ms)) / speed;
  }
  function play() {
    if (pending) return;
    if (playing) return stop();
    if (idx >= steps.length - 1) go(0, false);
    playBtn.replaceChildren(icon('pause'), h('span', {}, t(L.pause)));
    playBtn.title = t(L.pause);
    playBtn.setAttribute('aria-label', t(L.pause));
    const tick = () => {
      if (idx >= steps.length - 1) return stop();
      go(idx + 1);
      playing = window.setTimeout(tick, readingTime(idx));
    };
    playing = window.setTimeout(tick, readingTime(idx));
  }

  // ── knobs, breaks, predictions ──
  function recompute(change: ModelChange, prevParams: Record<string, unknown>) {
    const prevSteps = steps;
    steps = model.run(params, broken);
    idx = keepIndex(prevSteps, steps, idx);
    highlight = changedElements(prevSteps, steps);
    const delta = model.explainDelta(prevSteps, steps, change, prevParams, params);
    showDelta(delta, metricDelta(prevSteps, steps), change);
    drawTicks();
    paint();
    return { prevSteps, next: steps };
  }

  function showDelta(delta: Bi, md: Record<string, number>, change: ModelChange) {
    clear(deltaBox);
    deltaBox.hidden = false;
    const chips = Object.entries(md).map(([k, v]) => {
      const spec = model.metrics?.find((x) => x.id === k);
      return h('span.ex-mdelta', { class: v > 0 ? 'up' : 'down' }, `${v > 0 ? '+' : ''}${formatNum(v)}${spec?.unit ? ' ' + txt(spec.unit) : ''} ${spec ? t(spec.label) : k}`);
    });
    put(deltaBox, h('h4', {}, t(L.changed)), h('p', {}, ...renderInline(t(delta))), chips.length ? h('div.ex-mdeltas', {}, ...chips) : null);
    // the one-line delta also sits next to the knob that changed
    const near = el.querySelector(`[data-knob="${CSS.escape(change.id)}"] .knob-delta`);
    for (const other of el.querySelectorAll('.knob-delta')) other.textContent = '';
    if (near) near.textContent = t(delta);
  }

  function askPrediction(p: Pending) {
    stop();
    pending = p;
    clear(predictBox);
    predictBox.hidden = false;
    predictBox.append(
      h('p.ex-predict-q', {}, h('strong', {}, t(L.predict)), ' ', ...renderInline(t(p.predict.prompt))),
      h(
        'div.ex-predict-opts',
        {},
        ...p.predict.options.map((o) =>
          h(
            'button.btn.option',
            {
              type: 'button',
              onclick: () => {
                const prevSteps = steps;
                pending = null;
                p.apply();
                const right = p.predict.resolve(prevSteps, steps);
                const ok = right === o.id;
                ctx.record({ kind: 'explainer.predict', explainer: model.id, about: p.change.id, choice: o.id, correct: ok });
                clear(predictBox);
                const rightText = p.predict.options.find((x) => x.id === right)?.text;
                predictBox.append(
                  h(
                    'p.ex-predict-result',
                    { class: ok ? 'ok' : 'warn' },
                    h('span.st-icon', { 'aria-hidden': 'true' }, ok ? '✓' : '!'),
                    h('span', {}, ok ? `${t(L.right)}. ${t(o.text)}` : `${t(L.youSaid)}: ${t(o.text)}. ${t(L.happened)}: ${rightText ? t(rightText) : '—'}. ${t(L.notRight)}.`),
                  ),
                );
                pending = null;
              },
            },
            t(o.text),
          ),
        ),
        h('button.btn.ghost', { type: 'button', onclick: () => { pending = null; p.apply(); predictBox.hidden = true; } }, t(bi('Пропустить прогноз', 'Skip prediction'))),
        h(
          'button.btn.ghost',
          {
            type: 'button',
            onclick: () => {
              p.revert();
              predictBox.hidden = true;
              pending = null;
            },
          },
          t(L.cancel),
        ),
      ),
    );
    (predictBox.querySelector('button') as HTMLButtonElement | null)?.focus();
  }

  function setParam(spec: ParamSpec, value: unknown, revertUi: () => void) {
    if (pending) {
      revertUi();
      return;
    }
    predictBox.hidden = true;
    clear(predictBox);
    const prevParams = { ...params };
    const change: ModelChange = { kind: 'param', id: spec.id, from: params[spec.id], to: value };
    const apply = () => {
      params = { ...params, [spec.id]: value };
      for (const other of model.params) if (other.shownWhen && !other.shownWhen(params)) params[other.id] = other.default;
      recompute(change, prevParams);
      updateKnobValues();
    };
    if (spec.predict && !asked.has(spec.id)) {
      asked.add(spec.id);
      askPrediction({ change, apply, predict: spec.predict, revert: revertUi });
    } else apply();
  }

  const knobValues = new Map<string, HTMLElement>();
  const knobEls = new Map<string, HTMLElement>();
  function updateKnobValues() {
    for (const spec of model.params) {
      const out = knobValues.get(spec.id);
      if (out) out.textContent = formatParam(spec, params[spec.id]);
      const el = knobEls.get(spec.id);
      if (el) el.hidden = !!spec.shownWhen && !spec.shownWhen(params);
    }
    for (const g of knobGroups.values()) {
      const knobs = [...g.box.querySelectorAll<HTMLElement>(':scope > .knob')];
      if (knobs.length) g.box.hidden = knobs.every((k) => k.hidden);
    }
  }

  const visibleParams = model.params.filter((p) => !p.levels || p.levels.includes(ctx.level));
  if (visibleParams.length) knobBox.append(h('h4', {}, t(L.knobs)));
  // Knobs of one part of the system sit together under its name, in the order of their first knob.
  const knobGroups = new Map<string, { label?: Bi; box: HTMLElement }>();
  const groupBox = (spec: ParamSpec): HTMLElement => {
    if (!spec.group) return knobBox;
    const key = spec.group.ru + '|' + spec.group.en;
    let g = knobGroups.get(key);
    if (!g) {
      const box = h('fieldset.knob-group', {}, h('legend', {}, t(spec.group)));
      g = { label: spec.group, box };
      knobGroups.set(key, g);
      knobBox.append(box);
      knobBox.classList.add('grouped');
    }
    return g.box;
  };
  for (const spec of visibleParams) {
    const value = h('output.knob-value', {}, formatParam(spec, params[spec.id]));
    knobValues.set(spec.id, value);
    let control: HTMLElement;
    if (spec.kind === 'range') {
      const input = h('input', { type: 'range', min: spec.min ?? 0, max: spec.max ?? 100, step: spec.step ?? 1, value: String(params[spec.id]), 'aria-label': t(spec.label) }) as HTMLInputElement;
      let committed = String(params[spec.id]);
      input.addEventListener('input', () => {
        value.textContent = formatParam(spec, Number(input.value));
      });
      input.addEventListener('change', () => {
        const v = Number(input.value);
        const before = committed;
        committed = input.value;
        setParam(spec, v, () => {
          input.value = before;
          committed = before;
          value.textContent = formatParam(spec, Number(before));
        });
      });
      control = input;
    } else if (spec.kind === 'toggle') {
      const input = h('input', { type: 'checkbox', role: 'switch', checked: !!params[spec.id], 'aria-label': t(spec.label) }) as HTMLInputElement;
      input.addEventListener('change', () => setParam(spec, input.checked, () => (input.checked = !input.checked)));
      control = h('label.switch', {}, input, h('span.switch-track', { 'aria-hidden': 'true' }));
    } else if (longChoice(spec)) {
      // many long options: a drop-down list instead of a wall of buttons
      const sel = h('select.knob-select', { 'aria-label': t(spec.label) }, ...(spec.options ?? []).map((o) => h('option', { value: o.id, selected: params[spec.id] === o.id }, t(o.label)))) as HTMLSelectElement;
      let committed = sel.value;
      sel.addEventListener('change', () => {
        const before = committed;
        committed = sel.value;
        setParam(spec, sel.value, () => {
          sel.value = before;
          committed = before;
        });
      });
      control = sel;
    } else {
      const name = `${model.id}-${spec.id}-${Math.random().toString(36).slice(2, 6)}`;
      control = h(
        'div.segmented',
        { role: 'radiogroup', 'aria-label': t(spec.label) },
        ...(spec.options ?? []).map((o) => {
          const r = h('input', { type: 'radio', name, value: o.id, checked: params[spec.id] === o.id }) as HTMLInputElement;
          r.addEventListener('change', () => {
            const before = params[spec.id];
            setParam(spec, o.id, () => {
              const back = control.querySelector<HTMLInputElement>(`input[value="${CSS.escape(String(before))}"]`);
              if (back) back.checked = true;
            });
          });
          return h('label', {}, r, h('span', {}, t(o.label)));
        }),
      );
    }
    const knobEl = h('div.knob', { 'data-knob': spec.id, 'data-kind': spec.kind }, h('div.knob-head', {}, h('span.knob-label', {}, t(spec.label)), value), control, h('p.knob-delta', { 'aria-live': 'polite' }));
    knobEls.set(spec.id, knobEl);
    groupBox(spec).append(knobEl);
  }
  updateKnobValues();

  const visibleBreaks = model.breaks.filter((b) => !b.levels || b.levels.includes(ctx.level));
  if (visibleBreaks.length) {
    breakBox.append(h('h4', {}, icon('bolt'), ' ', t(L.breakIt)));
    for (const b of visibleBreaks) {
      const input = h('input', { type: 'checkbox', role: 'switch', 'aria-label': t(b.label) }) as HTMLInputElement;
      input.addEventListener('change', () => {
        const on = input.checked;
        if (pending) {
          input.checked = !on;
          return;
        }
        const change: ModelChange = { kind: 'break', id: b.id, on };
        const apply = () => {
          if (on) broken.add(b.id);
          else broken.delete(b.id);
          recompute(change, { ...params });
          if (on) {
            const at = steps.findIndex((x) => x.broken);
            if (at >= 0) go(at, false);
          }
        };
        // Every break is predicted; switching a break off is not.
        if (on) askPrediction({ change, apply, predict: b.predict, revert: () => (input.checked = false) });
        else apply();
      });
      breakBox.append(h('label.break-toggle', { class: b.layer ? `layer-${b.layer}` : undefined }, input, h('span.switch-track', { 'aria-hidden': 'true' }), h('span', {}, t(b.label)), b.layer ? h('span.tag', {}, b.layer) : null));
    }
  }

  // ── wiring ──
  scrub.addEventListener('input', () => {
    stop();
    go(Number(scrub.value), false);
  });
  backBtn.addEventListener('click', () => {
    stop();
    go(idx - 1, false);
  });
  fwdBtn.addEventListener('click', () => {
    stop();
    go(idx + 1);
  });
  firstBtn.addEventListener('click', () => {
    stop();
    go(0, false);
  });
  lastBtn.addEventListener('click', () => {
    stop();
    go(steps.length - 1, false);
  });
  playBtn.addEventListener('click', play);
  speedSel.addEventListener('change', () => {
    speed = Number(speedSel.value);
    if (playing) {
      stop();
      play();
    }
  });
  el.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, select, textarea, button, [role="button"]') && target !== el) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      stop();
      go(idx + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      stop();
      go(idx - 1, false);
    } else if (e.key === ' ') {
      e.preventDefault();
      play();
    } else if (e.key === 'Home') {
      e.preventDefault();
      go(0, false);
    } else if (e.key === 'End') {
      e.preventDefault();
      go(steps.length - 1, false);
    } else if (e.key === 'Escape') {
      card.hidden = true;
      selected = null;
      paint();
    }
  });
  svg.addEventListener('click', () => {
    if (selected) {
      selected = null;
      card.hidden = true;
      paint();
    }
  });

  drawTicks();
  go(0, false);

  return {
    dispose() {
      disposed = true;
      stop();
      cancelAnimationFrame(cameraAnim);
      cancelAnimationFrame(tokenAnim);
      tidyObs?.disconnect();
      clear(root);
    },
    describe() {
      const st = steps[idx];
      const frame = fold(steps, idx);
      const vals = Object.entries(frame.values)
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ');
      const says = Object.entries(st?.say ?? {})
        .map(([k, v]) => `${k}: ${t(v)}`)
        .join('; ');
      return `${t(model.title)} — ${t(L.step)} ${idx + 1}/${steps.length}: ${st ? t(st.caption) : ''}${says ? ` [${says}]` : ''}${vals ? ` (${vals})` : ''}${broken.size ? ` [broken: ${[...broken].join(', ')}]` : ''}`;
    },
  };
}

/** A choice with more than three options and long labels reads better as a drop-down list. */
export function longChoice(spec: ParamSpec): boolean {
  const opts = spec.options ?? [];
  return opts.length > 3 && opts.some((o) => o.label.ru.length > 24 || o.label.en.length > 24);
}

/** Where a token rests on its edge: late on the line (handed to the next node), but away from the edge's label. */
export function restAt(pts: Pt[], label: Pt | null, half = 40): number {
  const total = polyLength(pts);
  // keep the card off both nodes: at least its half width plus a gap from each end
  const lo = total ? Math.max(0.35, (half + 8) / total) : 0.5;
  const hi = total ? Math.min(0.86, 1 - (half + 8) / total) : 0.5;
  if (lo > hi) return 0.5;
  if (!label || !Number.isFinite(label[0]) || !Number.isFinite(label[1])) return Math.min(hi, Math.max(lo, 0.72));
  let best = hi;
  let bestScore = -Infinity;
  for (let f = lo; f <= hi + 1e-9; f += (hi - lo) / 20 || 1) {
    const { p } = pointAt(pts, f);
    const dist = Math.min(90, Math.hypot(p[0] - label[0], (p[1] - label[1]) * 2));
    const score = dist + f * 20;
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return best;
}

function translateAt(pts: Pt[], f: number, shift: Pt = [0, 0]): string {
  const { p } = pointAt(pts, f);
  return `translate(${(p[0] + shift[0]).toFixed(1)} ${(p[1] + shift[1]).toFixed(1)})`;
}

function formatNum(n: number): string {
  // Two decimals at most, no float noise ("25.000000004" → "25"), locale decimal mark.
  return n.toLocaleString(lang() === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits: 2 });
}

function formatParam(spec: ParamSpec, v: unknown): string {
  if (spec.kind === 'toggle') return v ? t(bi('вкл.', 'on')) : t(bi('выкл.', 'off'));
  if (spec.kind === 'choice') {
    const o = spec.options?.find((x) => x.id === v);
    return o ? t(o.label) : String(v);
  }
  return `${formatNum(Number(v))}${spec.unit ? ' ' + txt(spec.unit) : ''}`;
}

/** A small drawing of what a legend line explains, in the diagram's own style. */
function legendMark(mark: LegendMark): SVGElement {
  const box = (cls: string, extra: SVGElement[] = []) => s('svg.lg-mark', { viewBox: '0 0 34 20', width: 34, height: 20, class: cls }, s('rect.lg-box', { x: 3, y: 3, width: 28, height: 14, rx: 3 }), ...extra);
  if (mark.startsWith('icon:')) {
    const name = mark.slice(5) as keyof typeof NODE_ICONS;
    return s('svg.lg-mark.lg-icon', { viewBox: '0 0 34 20', width: 34, height: 20 }, s('circle.icon-disc', { cx: 17, cy: 10, r: 9.5 }), s('path.icon-glyph', { d: NODE_ICONS[name] ?? '', transform: 'translate(9.8 2.8) scale(0.6)' }));
  }
  switch (mark) {
    case 'active':
      return box('lg-active', [s('rect.lg-halo', { x: 0.5, y: 0.5, width: 33, height: 19, rx: 5 })]);
    case 'token':
      return s('svg.lg-mark.lg-token', { viewBox: '0 0 34 20', width: 34, height: 20 }, s('line.lg-line', { x1: 0, y1: 10, x2: 34, y2: 10 }), s('rect.token-bg', { x: 5, y: 3.5, width: 24, height: 13, rx: 3 }), s('path.token-env', { d: 'M10 7 h10 v6.5 h-10 Z M10 7 l5 3.6 l5 -3.6' }));
    case 'say':
      return s('svg.lg-mark.lg-say', { viewBox: '0 0 34 20', width: 34, height: 20 }, s('path.say-bubble', { d: bubblePath({ x: 2, y: 1.5, w: 30, h: 12 }, 'top', [12, 19], 4, 3.5) }));
    case 'line':
    case 'dashed':
      return s('svg.lg-mark', { viewBox: '0 0 34 20', width: 34, height: 20, class: `lg-${mark}` }, s('line.lg-line', { x1: 2, y1: 10, x2: 32, y2: 10 }));
    default:
      return box(`lg-${mark}`);
  }
}
