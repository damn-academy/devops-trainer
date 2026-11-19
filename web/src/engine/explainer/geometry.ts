// Pure geometry and state folding for the process explainer (testable without a DOM).

import type { Diagram, DiagramEdge, DiagramNode, ElementState, Step } from '../../core/types';

export type Pt = [number, number];

export function center(n: DiagramNode): Pt {
  return [n.x + n.w / 2, n.y + n.h / 2];
}

/** Where the segment from the box centre towards `toward` leaves the box. */
export function borderPoint(n: DiagramNode, toward: Pt): Pt {
  const [cx, cy] = center(n);
  const dx = toward[0] - cx;
  const dy = toward[1] - cy;
  if (dx === 0 && dy === 0) return [cx, cy];
  const sx = dx !== 0 ? n.w / 2 / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? n.h / 2 / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return [cx + dx * s, cy + dy * s];
}

/** The polyline of an edge: border of `from`, via points, border of `to`. */
export function edgePoints(d: Diagram, e: DiagramEdge): Pt[] {
  const a = d.nodes.find((n) => n.id === e.from);
  const b = d.nodes.find((n) => n.id === e.to);
  if (!a || !b) return [];
  const via = (e.via ?? []) as Pt[];
  const first = via[0] ?? center(b);
  const last = via[via.length - 1] ?? center(a);
  return [borderPoint(a, first), ...via, borderPoint(b, last)];
}

export function polyLength(pts: Pt[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return len;
}

/** Point at fraction `f` (0..1) of the polyline length, with the direction of that segment. */
export function pointAt(pts: Pt[], f: number): { p: Pt; angle: number } {
  if (pts.length < 2) return { p: pts[0] ?? [0, 0], angle: 0 };
  const total = polyLength(pts);
  let want = Math.max(0, Math.min(1, f)) * total;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const seg = Math.hypot(x1 - x0, y1 - y0);
    if (want <= seg || i === pts.length - 1) {
      const k = seg ? want / seg : 0;
      return { p: [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k], angle: Math.atan2(y1 - y0, x1 - x0) };
    }
    want -= seg;
  }
  return { p: pts[pts.length - 1], angle: 0 };
}

export function pathD(pts: Pt[]): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
}

export interface Frame {
  states: Record<string, ElementState>;
  values: Record<string, string>;
  fill: Record<string, number>;
}

/** The picture at step n: states, values and fill folded over steps 0..n (08 §3.2). */
export function fold(steps: Step[], n: number): Frame {
  const f: Frame = { states: {}, values: {}, fill: {} };
  for (let i = 0; i <= n && i < steps.length; i++) {
    Object.assign(f.states, steps[i].states ?? {});
    Object.assign(f.values, steps[i].values ?? {});
    Object.assign(f.fill, steps[i].fill ?? {});
  }
  return f;
}

/** Elements whose final picture differs between two runs (highlighted after a change). */
export function changedElements(prev: Step[], next: Step[]): string[] {
  const a = fold(prev, prev.length - 1);
  const b = fold(next, next.length - 1);
  const ids = new Set<string>();
  for (const k of new Set([...Object.keys(a.states), ...Object.keys(b.states)])) if (a.states[k] !== b.states[k]) ids.add(k);
  for (const k of new Set([...Object.keys(a.values), ...Object.keys(b.values)])) if (a.values[k] !== b.values[k]) ids.add(k);
  const brokeA = prev.find((s) => s.broken)?.broken?.at;
  const brokeB = next.find((s) => s.broken)?.broken?.at;
  if (brokeA !== brokeB) for (const x of [brokeA, brokeB]) if (x) ids.add(x);
  return [...ids];
}

/** Index to stay on after a recompute: the same step id, else the nearest index. */
export function keepIndex(prev: Step[], next: Step[], i: number): number {
  const id = prev[i]?.id;
  const same = next.findIndex((s) => s.id === id);
  if (same >= 0) return same;
  return Math.max(0, Math.min(next.length - 1, i));
}

/** Metric differences between the last steps of two runs: { queries: +3 }. */
export function metricDelta(prev: Step[], next: Step[]): Record<string, number> {
  const a = prev[prev.length - 1]?.metrics ?? {};
  const b = next[next.length - 1]?.metrics ?? {};
  const out: Record<string, number> = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const d = (b[k] ?? 0) - (a[k] ?? 0);
    if (d) out[k] = d;
  }
  return out;
}
