// Layout clean-up after the diagram is in the document (fonts measured):
//   1. a node label wider than its box shrinks, and if that is not enough,
//      wraps onto two lines;
//   2. every edge label is placed where it overlaps no box and no other
//      label: along the line, then further off it on either side;
//   3. the viewBox fits what is drawn, so labels pushed outside stay visible
//      and empty margins do not shrink the picture.
// Pure placement maths is exported for tests; `tidyDiagram` does the DOM part.

import type { Diagram } from '../../core/types';
import { iconPad, pointAt, type Pt } from './geometry';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

const FRACTIONS = [0, 0.15, -0.15, 0.3, -0.3, 0.42, -0.42];
const EXTRA = [0, 10, 22, 36, 52, 80, 120, 180, 260];

/**
 * The best box for a label of size w×h on a polyline: no overlap with
 * `obstacles` if possible, close to the preferred fraction `at`, close to the line.
 */
/** Length of the part of segment a–b inside a box (Liang–Barsky clipping). */
export function clipLength(a: Pt, b: Pt, box: Box): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-dx, a[0] - box.x],
    [dx, box.x + box.w - a[0]],
    [-dy, a[1] - box.y],
    [dy, box.y + box.h - a[1]],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return 0;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return 0;
  }
  return (t1 - t0) * Math.hypot(dx, dy);
}

export function placeLabel(pts: Pt[], at: number, w: number, h: number, obstacles: Box[], lines: [Pt, Pt][] = []): Box {
  let best: { box: Box; hit: number } | null = null;
  for (const extra of EXTRA) {
    for (const df of FRACTIONS) {
      const f = Math.min(0.92, Math.max(0.08, at + df));
      const { p, angle } = pointAt(pts, f);
      const nx = -Math.sin(angle);
      const ny = Math.cos(angle);
      // Distance from the line to the box centre along the normal: half the box's extent on it plus a gap.
      const half = (Math.abs(nx) * w + Math.abs(ny) * h) / 2;
      for (const side of [-1, 1]) {
        const d = side * (half + 3 + extra);
        const box = { x: p[0] + nx * d - w / 2, y: p[1] + ny * d - h / 2, w, h };
        let hit = 0;
        for (const o of obstacles) hit += overlap(box, o);
        for (const [a, b] of lines) hit += clipLength(a, b, box) * 4;
        if (hit === 0) return box;
        if (!best || hit < best.hit) best = { box, hit };
      }
    }
  }
  return best!.box;
}

/** Split a label into two lines at the space nearest the middle. */
export function splitLabel(text: string): [string, string] | null {
  const mid = text.length / 2;
  let at = -1;
  for (let i = 0; i < text.length; i++) if (text[i] === ' ' && (at < 0 || Math.abs(i - mid) < Math.abs(at - mid))) at = i;
  return at > 0 ? [text.slice(0, at), text.slice(at + 1)] : null;
}

const SVGNS = 'http://www.w3.org/2000/svg';

/** Measure and tidy a mounted diagram. Safe to call more than once; does nothing without layout (jsdom). */
/**
 * Fits a node's mono value line (it changes per step) into the node width:
 * shrinks the font down to 62 %, then shortens the text with an ellipsis and
 * keeps the full value in a tooltip. Does nothing before layout.
 */
export function fitSub(sub: SVGTextElement, nodeWidth: number): void {
  if (typeof sub.getComputedTextLength !== 'function' || !sub.isConnected) return;
  sub.style.fontSize = '';
  sub.querySelector('title')?.remove();
  const full = sub.dataset.full ?? sub.textContent ?? '';
  sub.textContent = full;
  const avail = nodeWidth - 12;
  const width = sub.getComputedTextLength();
  if (!full || width === 0 || width <= avail) return;
  const base = parseFloat(getComputedStyle(sub).fontSize) || 12;
  const k = avail / width;
  sub.style.fontSize = `${(base * Math.max(0.62, k)).toFixed(2)}px`;
  if (k >= 0.62) return;
  let n = full.length;
  while (n > 4 && sub.getComputedTextLength() > avail) sub.textContent = `${full.slice(0, --n).trimEnd()}…`;
  const tip = document.createElementNS(SVGNS, 'title');
  tip.textContent = full;
  sub.append(tip);
}

export function tidyDiagram(svg: SVGSVGElement, d: Diagram): void {
  const probe = svg.querySelector<SVGTextElement>('text');
  if (!probe || typeof probe.getComputedTextLength !== 'function' || !svg.isConnected) return;
  if (probe.getComputedTextLength() === 0 && (probe.textContent ?? '').length > 0) return; // not laid out yet

  const nodeBoxes: Box[] = [];
  // 1. node labels
  for (const n of d.nodes) {
    const g = svg.querySelector<SVGGElement>(`g.node[data-id="${CSS.escape(n.id)}"]`);
    if (!g) continue;
    if ((n.shape ?? 'box') !== 'bar') nodeBoxes.push({ x: n.x - 3, y: n.y - 3, w: n.w + 6, h: n.h + 6 });
    if (n.shape === 'bar') continue;
    const label = g.querySelector<SVGTextElement>('text.node-label');
    if (!label || label.dataset.fit) continue;
    label.dataset.fit = '1';
    const avail = n.w - 14 - iconPad(n);
    const width = label.getComputedTextLength();
    if (width <= avail) continue;
    const base = parseFloat(getComputedStyle(label).fontSize) || 14;
    const k = avail / width;
    if (k >= 0.8) {
      label.style.fontSize = `${(base * k).toFixed(2)}px`;
      continue;
    }
    const parts = splitLabel(label.textContent ?? '');
    const sub = g.querySelector<SVGTextElement>('text.node-sub');
    const hasSub = !!sub && (sub.textContent ?? '') !== '';
    if (!parts || n.h < (hasSub ? 52 : 34)) {
      label.style.fontSize = `${(base * Math.max(0.68, k)).toFixed(2)}px`;
      continue;
    }
    const x = label.getAttribute('x') ?? '0';
    const y = Number(label.getAttribute('y'));
    label.textContent = '';
    const lines = parts.map((p, i) => {
      const ts = document.createElementNS(SVGNS, 'tspan');
      ts.setAttribute('x', x);
      ts.setAttribute('dy', i ? '1.1em' : '0');
      ts.textContent = p;
      return ts;
    });
    label.append(...lines);
    label.setAttribute('y', String(y - (hasSub ? 10 : 8)));
    if (hasSub) sub!.setAttribute('y', String(Number(sub!.getAttribute('y')) + 7));
    const widest = Math.max(...lines.map((l) => l.getComputedTextLength()));
    if (widest > avail) label.style.fontSize = `${(base * Math.max(0.68, avail / widest)).toFixed(2)}px`;
  }
  for (const n of d.nodes) {
    if (n.shape === 'bar') continue;
    const sub = svg.querySelector<SVGTextElement>(`g.node[data-id="${CSS.escape(n.id)}"] text.node-sub`);
    if (sub) fitSub(sub, n.w - iconPad(n));
  }

  // 2. edge labels
  const placed: Box[] = [];
  const groupLabels = [...svg.querySelectorAll<SVGTextElement>('text.group-label')].map((el) => bbox(el));
  const edges = d.edges
    .map((e) => {
      const g = svg.querySelector<SVGGElement>(`g.edge[data-id="${CSS.escape(e.id)}"]`);
      const text = g?.querySelector<SVGTextElement>('text.edge-label');
      const path = g?.querySelector<SVGPathElement>('path.edge-line');
      return g && text && path && text.textContent ? { e, text, pts: parsePath(path.getAttribute('d') ?? '') } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x && x.pts.length > 1);
  // Short edges have the fewest good spots: place them first.
  edges.sort((a, b) => len(a.pts) - len(b.pts));
  const segs = (pts: Pt[]) => pts.slice(1).map((p, i) => [pts[i], p] as [Pt, Pt]);
  for (const { e, text, pts } of edges) {
    const w = text.getComputedTextLength() + 6;
    const h = 15;
    const others = edges.flatMap((x) => segs(x.pts));
    const box = placeLabel(pts, e.labelAt ?? 0.5, w, h, [...nodeBoxes, ...placed, ...groupLabels], others);
    placed.push(box);
    text.setAttribute('x', (box.x + box.w / 2).toFixed(1));
    text.setAttribute('y', (box.y + box.h / 2 + 4.5).toFixed(1));
  }

  // 3. viewBox fits the drawing
  const parts = [...svg.querySelectorAll<SVGGraphicsElement>('g.l-groups, g.l-edges, g.l-nodes')];
  // hidden elements still count: the frame stays the same while the picture is built step by step
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of parts) {
    const b = p.getBBox();
    if (!b.width && !b.height) continue;
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.width);
    y1 = Math.max(y1, b.y + b.height);
  }
  if (Number.isFinite(x0)) {
    const pad = 10;
    svg.setAttribute('viewBox', `${(x0 - pad).toFixed(0)} ${(y0 - pad - (d.topPadding ?? 0)).toFixed(0)} ${(x1 - x0 + 2 * pad).toFixed(0)} ${(y1 - y0 + 2 * pad + (d.topPadding ?? 0)).toFixed(0)}`);
    // On a phone the diagram keeps a readable scale (labels ≥ ~9 px) and scrolls sideways inside its frame.
    svg.style.setProperty('--ex-minw', `${Math.round((x1 - x0 + 2 * pad) * 0.7)}px`);
  }
}

function bbox(el: SVGGraphicsElement): Box {
  const b = el.getBBox();
  return { x: b.x - 2, y: b.y - 2, w: b.width + 4, h: b.height + 4 };
}

function parsePath(dAttr: string): Pt[] {
  const out: Pt[] = [];
  for (const m of dAttr.matchAll(/[ML]\s*(-?[\d.]+)[ ,](-?[\d.]+)/g)) out.push([Number(m[1]), Number(m[2])]);
  return out;
}

function len(pts: Pt[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
}
