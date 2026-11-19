// Small SVG charts for flowlab: cumulative flow diagram, cycle-time scatter
// with percentile lines, throughput bars, comparison lines for the debrief and
// the error-budget gauge. Engineering graphics: thin lines, direct labels,
// mono numbers, colour by column (one hue, lightness by stage).

import { s } from '../../core/dom';
import { t, type Bi } from '../../core/i18n';
import { cycleTime, finished, percentile } from './metrics';
import { colName } from './sim';
import type { Scenario, Stage, State } from './types';

const W = 520;
const H = 200;
const PAD = { l: 34, r: 92, t: 12, b: 24 };

function frame(title: string, w = W, h = H): SVGSVGElement {
  return s('svg', { class: 'fl-chart', viewBox: `0 0 ${w} ${h}`, role: 'img', 'aria-label': title }) as SVGSVGElement;
}

function axes(svg: SVGElement, days: number, maxY: number, w = W, h = H, yLabel?: string): { x: (d: number) => number; y: (v: number) => number } {
  const iw = w - PAD.l - PAD.r;
  const ih = h - PAD.t - PAD.b;
  const x = (d: number) => PAD.l + ((d - 1) / Math.max(1, days - 1)) * iw;
  const y = (v: number) => PAD.t + ih - (v / Math.max(1e-9, maxY)) * ih;
  svg.append(s('line', { class: 'fl-axis', x1: PAD.l, y1: PAD.t + ih, x2: PAD.l + iw, y2: PAD.t + ih }));
  svg.append(s('line', { class: 'fl-axis', x1: PAD.l, y1: PAD.t, x2: PAD.l, y2: PAD.t + ih }));
  const step = days > 12 ? 5 : days > 6 ? 2 : 1;
  for (let d = 1; d <= days; d += step) svg.append(s('text', { class: 'fl-tick', x: x(d), y: h - 6, 'text-anchor': 'middle' }, String(d)));
  const ticks = niceTicks(maxY);
  for (const v of ticks) {
    svg.append(s('line', { class: 'fl-grid', x1: PAD.l, y1: y(v), x2: PAD.l + iw, y2: y(v) }));
    svg.append(s('text', { class: 'fl-tick', x: PAD.l - 6, y: y(v) + 4, 'text-anchor': 'end' }, fmtNum(v)));
  }
  if (yLabel) svg.append(s('text', { class: 'fl-tick', x: PAD.l, y: PAD.t - 2 }, yLabel));
  return { x, y };
}

function niceTicks(max: number): number[] {
  if (max <= 0) return [0];
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((x) => x >= raw) ?? raw;
  const out: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

const fmtNum = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v * 10) / 10));

const STAGE_TONE: Record<Stage, number> = { backlog: 0, analysis: 1, dev: 2, test: 3, deploy: 4, done: 5, ops: 0 };

/** Cumulative flow diagram: stacked bands of cards per column at the end of each day, Done at the bottom. */
export function cfdChart(st: State, sc: Scenario, o: { highlight?: Stage; onBand?: (stage: Stage, day: number) => void } = {}): SVGSVGElement {
  const svg = frame(t({ ru: 'Накопительная диаграмма потока', en: 'Cumulative flow diagram' }));
  const hist = st.history;
  const cols = [...sc.columns].reverse(); // done first: it is the bottom band
  const days = Math.max(sc.days, 2);
  const tops = hist.map((h) => cols.reduce((a, c) => a + (h.counts[c] ?? 0), 0));
  const { x, y } = axes(svg, days, Math.max(4, ...tops));
  if (!hist.length) {
    svg.append(s('text', { class: 'fl-empty', x: W / 2 - 40, y: H / 2, 'text-anchor': 'middle' }, t({ ru: 'появится после первого дня', en: 'appears after the first day' })));
    return svg;
  }
  const base = hist.map(() => 0);
  for (const col of cols) {
    const upper = hist.map((h, i) => base[i] + (h.counts[col] ?? 0));
    const pts = [...hist.map((h, i) => `${x(h.day)},${y(upper[i])}`), ...hist.map((h, i) => `${x(h.day)},${y(base[i])}`).reverse()];
    const band = s('polygon', { class: `fl-band tone-${STAGE_TONE[col]}${o.highlight === col ? ' hl' : ''}`, points: pts.join(' '), 'data-stage': col }) as SVGPolygonElement;
    const name = t(colName(sc, col));
    band.append(s('title', {}, name));
    if (o.onBand) {
      band.style.cursor = 'pointer';
      band.addEventListener('click', (e) => {
        const r = svg.getBoundingClientRect();
        const px = ((e as MouseEvent).clientX - r.left) * (W / r.width);
        const day = Math.max(1, Math.min(days, Math.round(1 + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (days - 1))));
        o.onBand!(col, day);
      });
    }
    svg.append(band);
    const last = hist.length - 1;
    const mid = (upper[last] + base[last]) / 2;
    if (upper[last] - base[last] > 0) svg.append(s('text', { class: 'fl-label', x: x(hist[last].day) + 6, y: y(mid) + 4 }, `${name} ${upper[last] - base[last]}`));
    upper.forEach((v, i) => (base[i] = v));
  }
  return svg;
}

/** Cycle times of finished cards by finish day, with the 50th and 85th percentile lines. */
export function scatterChart(st: State, sc: Scenario): SVGSVGElement {
  const svg = frame(t({ ru: 'Время цикла законченных карточек', en: 'Cycle time of finished cards' }));
  const fin = finished(st);
  const ct = fin.map(cycleTime);
  const days = Math.max(sc.days, 2);
  const { x, y } = axes(svg, days, Math.max(5, ...ct), W, H, t({ ru: 'дней', en: 'days' }));
  for (const [p, cls, label] of [
    [0.5, 'p50', 'p50'],
    [0.85, 'p85', 'p85'],
  ] as const) {
    if (!ct.length) break;
    const v = percentile(ct, p);
    svg.append(s('line', { class: `fl-pline ${cls}`, x1: PAD.l, x2: W - PAD.r, y1: y(v), y2: y(v) }));
    svg.append(s('text', { class: 'fl-label', x: W - PAD.r + 6, y: y(v) + 4 }, `${label} = ${v} ${t({ ru: 'дн.', en: 'd' })}`));
  }
  const jitter = new Map<string, number>();
  for (const c of fin) {
    const k = `${c.finishedDay}:${cycleTime(c)}`;
    const j = jitter.get(k) ?? 0;
    jitter.set(k, j + 1);
    const dot = s('circle', { class: `fl-dot type-${c.type}`, cx: x(c.finishedDay!) + j * 5, cy: y(cycleTime(c)), r: 3.5 });
    dot.append(s('title', {}, `${t(c.title)}: ${cycleTime(c)}`));
    svg.append(dot);
  }
  return svg;
}

/** Cards delivered per day. */
export function throughputChart(st: State, sc: Scenario): SVGSVGElement {
  const svg = frame(t({ ru: 'Пропускная способность', en: 'Throughput' }), W, 150);
  const days = Math.max(sc.days, 2);
  const vals = st.history.map((h) => h.delivered);
  const { x, y } = axes(svg, days, Math.max(3, ...vals), W, 150, t({ ru: 'карточек в день', en: 'cards per day' }));
  const bw = Math.max(4, ((W - PAD.l - PAD.r) / days) * 0.6);
  for (const h of st.history) {
    if (!h.delivered) continue;
    svg.append(s('rect', { class: 'fl-bar', x: x(h.day) - bw / 2, y: y(h.delivered), width: bw, height: y(0) - y(h.delivered) }));
  }
  return svg;
}

export interface Series {
  label: Bi;
  cls: string;
  values: number[];
}

/** Comparison lines with direct labels (the debrief: you, baseline, reference). */
export function linesChart(title: Bi, series: Series[], days: number, unit?: Bi): SVGSVGElement {
  const svg = frame(t(title));
  const all = series.flatMap((x) => x.values);
  const max = Math.max(1, ...all);
  const min = Math.min(0, ...all);
  const { x, y } = axes(svg, Math.max(days, 2), max - min, W, H, unit ? t(unit) : undefined);
  const yy = (v: number) => y(v - min);
  const placed: number[] = [];
  for (const se of series) {
    if (!se.values.length) continue;
    const d = se.values.map((v, i) => `${i ? 'L' : 'M'}${x(i + 1)},${yy(v)}`).join(' ');
    svg.append(s('path', { class: `fl-line ${se.cls}`, d }));
    let ly = yy(se.values[se.values.length - 1]) + 4;
    while (placed.some((p) => Math.abs(p - ly) < 12)) ly += 12;
    placed.push(ly);
    svg.append(s('text', { class: `fl-label ${se.cls}`, x: x(se.values.length) + 6, y: ly }, t(se.label)));
  }
  return svg;
}

/** Error budget gauge: what is left of the 30-day budget. */
export function budgetGauge(leftMin: number, totalMin: number): SVGSVGElement {
  const w = 520;
  const h = 46;
  const svg = frame(t({ ru: 'Бюджет ошибок', en: 'Error budget' }), w, h);
  const ratio = totalMin ? leftMin / totalMin : 0;
  const iw = w - 160;
  svg.append(s('rect', { class: 'fl-gauge', x: 0, y: 10, width: iw, height: 18, rx: 4 }));
  const fill = Math.max(0, Math.min(1, ratio));
  svg.append(s('rect', { class: `fl-gauge-fill${ratio < 0 ? ' over' : ratio < 0.25 ? ' low' : ''}`, x: 0, y: 10, width: iw * fill, height: 18, rx: 4 }));
  svg.append(
    s(
      'text',
      { class: 'fl-label', x: iw + 10, y: 24 },
      ratio < 0
        ? t({ ru: `превышен на ${Math.round(-leftMin)} мин`, en: `exceeded by ${Math.round(-leftMin)} min` })
        : t({ ru: `осталось ${Math.round(leftMin)} из ${Math.round(totalMin)} мин`, en: `${Math.round(leftMin)} of ${Math.round(totalMin)} min left` }),
    ),
  );
  return svg;
}
