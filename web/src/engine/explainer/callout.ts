// Speech callouts of the process explainer: the sentence "what this block is
// doing now" drawn as a bubble next to the acting node, with a tail pointing
// at it. Pure maths (wrapping, placing, the bubble outline) lives here so it
// can be tested without a browser; render.ts does the DOM part.

import { clipLength, overlap, type Box } from './tidy';
import type { Pt } from './geometry';

/** A run of text inside a line; `code` runs (from `backticks`) are set in the mono font. */
export interface Run {
  text: string;
  code: boolean;
  /** Glued to the previous run (no space before it): `cat`: → "cat" + ":". */
  glue?: boolean;
}
export interface Line {
  runs: Run[];
  width: number;
}

/** Splits `a `b` c` into words that remember whether they were inside backticks and whether a space came before them. */
export function words(text: string): Run[] {
  const out: Run[] = [];
  let spaced = true;
  text.split('`').forEach((part, i) => {
    const pieces = part.split(/(\s+)/);
    for (const piece of pieces) {
      if (!piece) continue;
      if (/^\s+$/.test(piece)) {
        spaced = true;
        continue;
      }
      out.push({ text: piece, code: i % 2 === 1, glue: !spaced && out.length > 0 });
      spaced = false;
    }
  });
  return out;
}

/** Greedy word wrap to `maxW`; `measure` returns the width of one word in its font. */
export function wrapWords(text: string, maxW: number, measure: (r: Run) => number, space = 4): Line[] {
  const lines: Line[] = [];
  let cur: Line = { runs: [], width: 0 };
  for (const w of words(text)) {
    const ww = measure(w);
    const add = cur.runs.length ? (w.glue ? 0 : space) + ww : ww;
    if (cur.runs.length && !w.glue && cur.width + add > maxW) {
      lines.push(cur);
      cur = { runs: [{ ...w, glue: false }], width: ww };
    } else {
      cur.runs.push(w);
      cur.width += add;
    }
  }
  if (cur.runs.length) lines.push(cur);
  return lines;
}

/** Width estimate of a word before fonts are measured (and in tests). */
export function estimate(r: Run, size: number): number {
  return r.text.length * size * (r.code ? 0.6 : 0.54);
}

export type Side = 'top' | 'bottom' | 'left' | 'right';

export interface Placed {
  box: Box;
  side: Side;
  /** Where the tail touches the node. */
  tip: Pt;
}

const GAP = 14;

/**
 * Puts a w×h bubble next to `anchor` where it covers the fewest other boxes
 * and lines and stays inside `bounds`: above, below, to the right, to the left,
 * shifted along the side if that helps.
 */
export function placeCallout(anchor: Box, w: number, h: number, obstacles: Box[], bounds: Box, lines: [Pt, Pt][] = [], allowOutside = false): Placed {
  const cx = anchor.x + anchor.w / 2;
  const cy = anchor.y + anchor.h / 2;
  const cands: { box: Box; side: Side; pref: number }[] = [];
  const shifts = [0, -0.35, 0.35, -0.7, 0.7, -1, 1];
  for (const k of shifts) {
    cands.push({ side: 'top', box: { x: cx - w / 2 + k * w, y: anchor.y - GAP - h, w, h }, pref: 0 + Math.abs(k) });
    cands.push({ side: 'bottom', box: { x: cx - w / 2 + k * w, y: anchor.y + anchor.h + GAP, w, h }, pref: 0.3 + Math.abs(k) });
  }
  for (const k of [0, -0.4, 0.4]) {
    cands.push({ side: 'right', box: { x: anchor.x + anchor.w + GAP, y: cy - h / 2 + k * h, w, h }, pref: 0.6 + Math.abs(k) });
    cands.push({ side: 'left', box: { x: anchor.x - GAP - w, y: cy - h / 2 + k * h, w, h }, pref: 0.8 + Math.abs(k) });
  }
  if (allowOutside) {
    // Dense diagrams may have no free slot directly beside the actor.
    for (const c of [...cands]) {
      for (const distance of [40, 80, 120, 180, 260]) {
        const dx = c.side === 'left' ? -distance : c.side === 'right' ? distance : 0;
        const dy = c.side === 'top' ? -distance : c.side === 'bottom' ? distance : 0;
        cands.push({ ...c, box: { ...c.box, x: c.box.x + dx, y: c.box.y + dy }, pref: c.pref + distance / 100 });
      }
    }
  }
  let best: { c: (typeof cands)[number]; score: number } | null = null;
  for (const c of cands) {
    const b = c.box;
    const out = Math.max(0, bounds.x - b.x) + Math.max(0, b.x + b.w - (bounds.x + bounds.w)) + Math.max(0, bounds.y - b.y) + Math.max(0, b.y + b.h - (bounds.y + bounds.h));
    let score = out * (allowOutside ? 0.2 : 400) + c.pref * 300;
    score += overlap(b, { x: anchor.x - 4, y: anchor.y - 4, w: anchor.w + 8, h: anchor.h + 8 }) * 20;
    for (const o of obstacles) score += overlap(b, o) * 100;
    for (const [a, z] of lines) score += clipLength(a, z, b) * 6;
    if (!best || score < best.score) best = { c, score };
  }
  const { box, side } = best!.c;
  return { box, side, tip: tipFor(anchor, box, side) };
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

/** The point on the node the tail points at: its nearest edge, under the bubble where possible. */
function tipFor(a: Box, b: Box, side: Side): Pt {
  if (side === 'top' || side === 'bottom') {
    const x = clamp(clamp(a.x + a.w / 2, b.x + 18, b.x + b.w - 18), a.x + 8, a.x + a.w - 8);
    return [x, side === 'top' ? a.y - 2 : a.y + a.h + 2];
  }
  const y = clamp(clamp(a.y + a.h / 2, b.y + 14, b.y + b.h - 14), a.y + 6, a.y + a.h - 6);
  return [side === 'left' ? a.x - 2 : a.x + a.w + 2, y];
}

/** The bubble outline: a rounded rectangle with a tail on `side` ending at `tip`. */
export function bubblePath(b: Box, side: Side, tip: Pt, r = 10, tail = 9): string {
  const { x, y, w, h } = b;
  const x1 = x + w;
  const y1 = y + h;
  const f = (n: number) => n.toFixed(1);
  // the tail base sits on the side, as close to the tip as the corners allow
  const bx = clamp(tip[0], x + r + tail, x1 - r - tail);
  const by = clamp(tip[1], y + r + tail, y1 - r - tail);
  const top = side === 'bottom' ? `L${f(bx - tail)} ${f(y)} L${f(tip[0])} ${f(tip[1])} L${f(bx + tail)} ${f(y)} ` : '';
  const right = side === 'left' ? `L${f(x1)} ${f(by - tail)} L${f(tip[0])} ${f(tip[1])} L${f(x1)} ${f(by + tail)} ` : '';
  const bottom = side === 'top' ? `L${f(bx + tail)} ${f(y1)} L${f(tip[0])} ${f(tip[1])} L${f(bx - tail)} ${f(y1)} ` : '';
  const left = side === 'right' ? `L${f(x)} ${f(by + tail)} L${f(tip[0])} ${f(tip[1])} L${f(x)} ${f(by - tail)} ` : '';
  return (
    `M${f(x + r)} ${f(y)} ${top}L${f(x1 - r)} ${f(y)} Q${f(x1)} ${f(y)} ${f(x1)} ${f(y + r)} ` +
    `${right}L${f(x1)} ${f(y1 - r)} Q${f(x1)} ${f(y1)} ${f(x1 - r)} ${f(y1)} ` +
    `${bottom}L${f(x + r)} ${f(y1)} Q${f(x)} ${f(y1)} ${f(x)} ${f(y1 - r)} ` +
    `${left}L${f(x)} ${f(y + r)} Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)} Z`
  );
}
