// The shared process explainer (08 §3.1–3.7): a diagram the learner drives.
// Steps scrub forward and back; knobs recompute the process at once with one
// line "what changed and why" next to the knob; "break it" stops the process
// at the break; a "what will happen?" question comes before the first change
// of a knob and before every break; every element opens a card.

import { calm, clear, h, icon, put, s } from '../../core/dom';
import { bi, lang, t, type Bi } from '../../core/i18n';
import type { DiagramGroup, DiagramNode, ElementCard, ExplainerCtx, ExplainerReg, ModelChange, Mounted, ParamSpec, Prediction, ProcessModel, QText, Step } from '../../core/types';
import { renderInline, renderMd } from '../../core/markdown';
import { docChip } from '../docs/viewer';
import { tidyDiagram } from './tidy';
import { changedElements, edgePoints, fold, keepIndex, metricDelta, pathD, pointAt, type Pt } from './geometry';

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
  breakIt: bi('Сломай', 'Break it'),
  changed: bi('Что изменилось', 'What changed'),
  predict: bi('Что будет?', 'What will happen?'),
  youSaid: bi('Ты предположил', 'You predicted'),
  happened: bi('Вышло', 'What happened'),
  right: bi('Совпало', 'Right'),
  notRight: bi('Не совпало — посмотри, где расходится', 'Not quite — see where it differs'),
  cardWho: bi('Кто создаёт', 'Who creates it'),
  cardSee: bi('Как посмотреть', 'How to look at it'),
  cardDoc: bi('Где написано', 'Where it is written'),
  stoppedAt: bi('Процесс остановился', 'The process stopped'),
  speed: bi('Скорость', 'Speed'),
  hintClick: bi('Нажми на любой элемент схемы — он объяснит себя.', 'Click any element of the diagram — it explains itself.'),
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
  let completed = false;
  let playing = 0;
  let playStarted = 0;
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
  const ticks = h('div.ex-ticks', { 'aria-hidden': 'true' });
  const counter = h('span.ex-counter');
  const playBtn = h('button.icon-btn.ex-play', { type: 'button', 'aria-label': t(L.play) }, icon('play'));
  const backBtn = h('button.icon-btn', { type: 'button', 'aria-label': t(L.back) }, icon('prev'));
  const fwdBtn = h('button.icon-btn', { type: 'button', 'aria-label': t(L.fwd) }, icon('next'));
  const firstBtn = h('button.icon-btn', { type: 'button', 'aria-label': t(L.first) }, icon('first'));
  const lastBtn = h('button.icon-btn', { type: 'button', 'aria-label': t(L.last) }, icon('last'));
  const speedSel = h(
    'select.ex-speed',
    { 'aria-label': t(L.speed) },
    ...[0.25, 1, 4].map((v) => h('option', { value: v, selected: v === 1 }, `${v}×`)),
  ) as HTMLSelectElement;

  const el = h(
    'div.explainer',
    { tabindex: 0, 'data-model': model.id },
    h('header.ex-head', {}, h('h3', {}, t(model.title)), model.summary ? h('p.ex-summary', {}, ...renderInline(t(model.summary))) : null),
    h('div.ex-controls', {}, knobBox, breakBox),
    predictBox,
    h('div.ex-stage', {}, h('div.ex-canvas', {}, svg, h('p.ex-hint', {}, t(L.hintClick))), h('div.ex-side', {}, deltaBox, card)),
    brokeLine,
    caption,
    metricsBox,
    waterfallBox,
    h('div.ex-stepper', {}, h('div.ex-buttons', {}, firstBtn, backBtn, playBtn, fwdBtn, lastBtn, counter, speedSel), h('div.ex-scrubwrap', {}, scrub, ticks)),
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
  svg.append(layerGroups, layerEdges, layerNodes, layerTokens);

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
      void (fonts ? fonts.ready : Promise.resolve()).then(() => tidyDiagram(svg, d));
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
    const lx = isBar ? x + 16 : x + w / 2;
    const anchor = isBar ? 'start' : 'middle';
    const ly = n.sub !== undefined || shape === 'buffer' ? y + hh / 2 - (shape === 'buffer' ? 8 : 4) : y + hh / 2 + 5;
    parts.push(s('text.node-label', { x: lx, y: ly, 'text-anchor': anchor }, label));
    const sub = s('text.node-sub', { x: lx, y: ly + 17, 'text-anchor': anchor }, n.sub ?? '');
    parts.push(sub);
    subEls.set(n.id, sub);
    parts.push(s('text.node-x', { x: x + w - 10, y: y + 16, 'text-anchor': 'middle', 'aria-hidden': 'true' }, '⨯'));
    const fn = activate(n.id, n.card, label);
    const g = s(
      'g.node',
      { 'data-id': n.id, class: `fam-${n.family} shape-${shape}`, tabindex: 0, role: 'button', 'aria-label': label, onclick: fn, onkeydown: keyActivate(fn) as never },
      ...parts,
    );
    (shape === 'bar' ? layerGroups : layerNodes).append(g);
    nodeEls.set(n.id, g);
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
            h('span.wf-val', {}, `${formatNum(dur)}${spec?.unit ? ' ' + spec.unit : ''}`),
          ),
        );
      }
      prev = end;
    });
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
  function paint(animateFrom?: number) {
    const st = steps[idx];
    const frame = fold(steps, idx);
    const brokeAt = steps.find((x, i) => i <= idx && x.broken)?.broken;
    const focus = new Set(st?.focus ?? []);
    for (const [id, g] of nodeEls) {
      const state = frame.states[id];
      g.setAttribute(
        'class',
        [
          g.getAttribute('class')!.split(' ').filter((c) => !/^(focus|st-|broken|changed|selected|removed)/.test(c)).join(' '),
          focus.has(id) ? 'focus' : '',
          state ? `st-${state}` : '',
          brokeAt?.at === id ? 'broken' : '',
          broken.size && [...broken].some((b) => model.breaks.find((x) => x.id === b)?.remove.includes(id)) ? 'removed' : '',
          highlight.includes(id) ? 'changed' : '',
          selected === id ? 'selected' : '',
        ]
          .filter(Boolean)
          .join(' '),
      );
      const sub = subEls.get(id);
      if (sub) sub.textContent = frame.values[id] ?? d.nodes.find((n) => n.id === id)?.sub ?? '';
    }
    for (const [id, f] of fillEls) {
      const v = Math.max(0, Math.min(1, frame.fill[id] ?? 0));
      f.el.setAttribute('width', String(Math.max(0, (f.n.w - 8) * v)));
      f.el.setAttribute('class', `node-fill${v >= 1 ? ' full' : ''}`);
    }
    for (const [id, e] of edgeEls) {
      const state = frame.states[id];
      const isFocus = focus.has(id);
      const removed = [...broken].some((b) => model.breaks.find((x) => x.id === b)?.remove.includes(id));
      const isErr = state === 'err' || brokeAt?.at === id;
      e.g.setAttribute('class', ['edge', isFocus ? 'focus' : '', state ? `st-${state}` : '', removed ? 'removed' : '', isErr ? 'broken' : '', selected === id ? 'selected' : '', highlight.includes(id) ? 'changed' : ''].filter(Boolean).join(' '));
      e.path.setAttribute('marker-end', `url(#arr-${model.id}-${isErr ? 'e' : isFocus ? 'f' : 'n'})`);
    }
    // tokens
    cancelAnimationFrame(tokenAnim);
    clear(layerTokens);
    const toks = (st?.tokens ?? []).map((tk) => {
      const e = edgeEls.get(tk.edge);
      if (!e) return null;
      const pts = tk.reverse ? [...e.pts].reverse() : e.pts;
      const g = s('g.token', {}, s('circle', { r: 5 }), tk.label ? s('text', { y: -9, 'text-anchor': 'middle' }, tk.label) : null);
      layerTokens.append(g);
      return { g, pts };
    });
    const place = (f: number) => {
      for (const tk of toks) {
        if (!tk) continue;
        const { p } = pointAt(tk.pts, f);
        tk.g.setAttribute('transform', `translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})`);
      }
    };
    const animate = animateFrom !== undefined && animateFrom < idx && !calm();
    if (animate && toks.some(Boolean)) {
      const start = performance.now();
      const dur = 300 / speed;
      const tick = (now: number) => {
        const k = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - k, 3);
        place(0.08 + 0.84 * eased);
        if (k < 1) tokenAnim = requestAnimationFrame(tick);
      };
      place(0.08);
      tokenAnim = requestAnimationFrame(tick);
    } else place(0.92);

    // caption, broken line, metrics, stepper
    clear(caption);
    if (st) caption.append(renderMd(t(st.caption)));
    if (brokeAt) {
      brokeLine.hidden = false;
      clear(brokeLine);
      brokeLine.append(h('span.st-icon.err', { 'aria-hidden': 'true' }, '⨯'), h('div', {}, h('strong', {}, t(L.stoppedAt)), ' — ', t(brokeAt.caption), h('pre.tool-msg', {}, brokeAt.message)));
    } else brokeLine.hidden = true;
    clear(metricsBox);
    const m = st?.metrics ?? {};
    for (const spec of model.metrics ?? []) {
      if (!(spec.id in m)) continue;
      metricsBox.append(h('div', {}, h('dt', {}, t(spec.label)), h('dd', {}, `${formatNum(m[spec.id])}${spec.unit ? ' ' + spec.unit : ''}`)));
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

  function drawTicks() {
    clear(ticks);
    steps.forEach((st, i) => {
      ticks.append(
        h(
          'button.ex-tick',
          { type: 'button', style: `left:${steps.length > 1 ? (i / (steps.length - 1)) * 100 : 0}%`, tabindex: -1, title: txt(st.label), onclick: () => go(i), class: st.broken ? 'broken' : undefined },
          h('span', {}, txt(st.label)),
        ),
      );
    });
  }

  function go(i: number, animate = true) {
    const prev = idx;
    idx = Math.max(0, Math.min(steps.length - 1, i));
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
  }

  function stop() {
    if (playing) clearInterval(playing);
    playing = 0;
    playBtn.replaceChildren(icon('play'));
    playBtn.setAttribute('aria-label', t(L.play));
  }
  function play() {
    if (playing) return stop();
    if (idx >= steps.length - 1) go(0, false);
    playStarted = performance.now();
    playBtn.replaceChildren(icon('pause'));
    playBtn.setAttribute('aria-label', t(L.pause));
    playing = window.setInterval(
      () => {
        if (idx >= steps.length - 1 || performance.now() - playStarted > 5000) return stop();
        go(idx + 1);
      },
      Math.max(250, 1100 / speed),
    );
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
      return h('span.ex-mdelta', { class: v > 0 ? 'up' : 'down' }, `${v > 0 ? '+' : ''}${formatNum(v)}${spec?.unit ? ' ' + spec.unit : ''} ${spec ? t(spec.label) : k}`);
    });
    put(deltaBox, h('h4', {}, t(L.changed)), h('p', {}, t(delta)), chips.length ? h('div.ex-mdeltas', {}, ...chips) : null);
    // the one-line delta also sits next to the knob that changed
    const near = el.querySelector(`[data-knob="${CSS.escape(change.id)}"] .knob-delta`);
    for (const other of el.querySelectorAll('.knob-delta')) other.textContent = '';
    if (near) near.textContent = t(delta);
  }

  function askPrediction(p: Pending) {
    pending = p;
    clear(predictBox);
    predictBox.hidden = false;
    predictBox.append(
      h('p.ex-predict-q', {}, h('strong', {}, t(L.predict)), ' ', t(p.predict.prompt)),
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
                    h('span', {}, `${t(L.youSaid)}: ${t(o.text)}. ${t(L.happened)}: ${rightText ? t(rightText) : '—'}. ${ok ? t(L.right) : t(L.notRight)}.`),
                  ),
                );
                pending = null;
              },
            },
            t(o.text),
          ),
        ),
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
    const prevParams = { ...params };
    const change: ModelChange = { kind: 'param', id: spec.id, from: params[spec.id], to: value };
    const apply = () => {
      params = { ...params, [spec.id]: value };
      recompute(change, prevParams);
      updateKnobValues();
    };
    if (spec.predict && !asked.has(spec.id)) {
      asked.add(spec.id);
      askPrediction({ change, apply, predict: spec.predict, revert: revertUi });
    } else apply();
  }

  const knobValues = new Map<string, HTMLElement>();
  function updateKnobValues() {
    for (const spec of model.params) {
      const out = knobValues.get(spec.id);
      if (out) out.textContent = formatParam(spec, params[spec.id]);
    }
  }

  const visibleParams = model.params.filter((p) => !p.levels || p.levels.includes(ctx.level));
  if (visibleParams.length) knobBox.append(h('h4', {}, t(L.knobs)));
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
    knobBox.append(h('div.knob', { 'data-knob': spec.id }, h('div.knob-head', {}, h('span.knob-label', {}, t(spec.label)), value), control, h('p.knob-delta', { 'aria-live': 'polite' })));
  }

  if (model.breaks.length) {
    breakBox.append(h('h4', {}, icon('bolt'), ' ', t(L.breakIt)));
    for (const b of model.breaks) {
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
      stop();
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
      return `${t(model.title)} — ${t(L.step)} ${idx + 1}/${steps.length}: ${st ? t(st.caption) : ''}${vals ? ` (${vals})` : ''}${broken.size ? ` [broken: ${[...broken].join(', ')}]` : ''}`;
    },
  };
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString(lang() === 'ru' ? 'ru-RU' : 'en-US') : n.toFixed(2);
}

function formatParam(spec: ParamSpec, v: unknown): string {
  if (spec.kind === 'toggle') return v ? t(bi('вкл.', 'on')) : t(bi('выкл.', 'off'));
  if (spec.kind === 'choice') {
    const o = spec.options?.find((x) => x.id === v);
    return o ? t(o.label) : String(v);
  }
  return `${formatNum(Number(v))}${spec.unit ? ' ' + spec.unit : ''}`;
}
