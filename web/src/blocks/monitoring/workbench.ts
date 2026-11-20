// The PromQL workbench (06 §7.5 C-I5) and the incident drill (§7.7): a query
// box, the result as a table and as a chart over the last hours, the /metrics
// text of a target, and goals checked on the result of the learner's query —
// by equivalence with a reference query or by a predicate over the result.

import type { Mounted, WidgetCtx, WidgetReg } from '../../core/types';
import { bi, count, t, type Bi } from '../../core/i18n';
import { clear, h, s } from '../../core/dom';
import { dataset, exposition, type Incident, type Labels } from './prom/data';
import { equivalent, formatLabels, query, queryRange, type Result } from './prom/promql';
import './workbench.css';

export interface WorkbenchGoal {
  id: string;
  prompt: Bi;
  /** Passes when the learner's query is equivalent to this one. */
  reference?: string;
  /** Or when this holds for the instant result (and, optionally, the query text). */
  test?: (r: Result, q: string) => boolean;
  /** Shown after the goal is met: what the evidence means. */
  then?: Bi;
  hint?: Bi;
  /** Near misses: after a run that did not meet the goal, the first that holds explains what is still wrong. */
  miss?: { test: (r: Result, q: string) => boolean; say: Bi }[];
}

export interface WorkbenchProps {
  incident?: Incident;
  query?: string;
  goals?: WorkbenchGoal[];
  /** Instances whose /metrics text the Targets tab shows. */
  targets?: string[];
  /** Hours of the chart. */
  hours?: number;
  /** An alert card on top (the incident drill). */
  alert?: { name: string; summary: Bi; labels: Labels };
  title?: Bi;
}

const L = {
  run: bi('Выполнить', 'Execute'),
  table: bi('Таблица', 'Table'),
  graph: bi('График', 'Graph'),
  targets: bi('Цели (/metrics)', 'Targets (/metrics)'),
  empty: bi('Запрос вернул пустой результат, потому что ни один ряд не подошёл под условия.', 'The query returned an empty result, because no series matched the conditions.'),
  goals: bi('Что найти', 'What to find'),
  done: bi('Найдено', 'Found'),
  placeholder: bi('Выражение PromQL, например rate(http_requests_total[5m])', 'A PromQL expression, e.g. rate(http_requests_total[5m])'),
  firing: bi('Сработал алерт', 'Alert firing'),
  at: bi('момент запроса', 'evaluated at'),
  ago: bi('мин назад', 'min ago'),
  now: bi('сейчас', 'now'),
};

/** "1 ряд", "3 ряда", "8 рядов" / "1 series". */
export const seriesCount = (n: number): string => count(n, ['ряд', 'ряда', 'рядов'], ['series', 'series']);

const PALETTE = ['var(--c-l3)', 'var(--c-flow)', 'var(--c-warn)', 'var(--c-ci-deploy)', 'var(--c-l7)', 'var(--c-ok)', 'var(--c-cp)', 'var(--c-err)'];

function fmtNum(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  if (Math.abs(v) >= 1e6) return v.toExponential(3);
  if (Number.isInteger(v)) return String(v);
  return String(+v.toFixed(Math.abs(v) < 1 ? 4 : 2));
}

function chart(series: { labels: Labels; samples: [number, number][] }[], start: number, end: number): SVGElement {
  const W = 720;
  const H = 240;
  const P = { l: 56, r: 12, t: 12, b: 28 };
  const shown = series.slice(0, PALETTE.length);
  const vals = shown.flatMap((x) => x.samples.map((p) => p[1])).filter(Number.isFinite);
  const max = vals.length ? Math.max(...vals) : 1;
  const min = Math.min(0, ...vals);
  const span = max - min || 1;
  const X = (ts: number) => P.l + ((ts - start) / (end - start)) * (W - P.l - P.r);
  const Y = (v: number) => H - P.b - ((v - min) / span) * (H - P.t - P.b);
  const svg = s('svg.wb-chart', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'chart' });
  for (let i = 0; i <= 4; i++) {
    const v = min + (span * i) / 4;
    svg.append(s('line.wb-grid', { x1: P.l, x2: W - P.r, y1: Y(v), y2: Y(v) }), s('text.wb-tick', { x: P.l - 6, y: Y(v) + 4, 'text-anchor': 'end' }, fmtNum(+v.toPrecision(3))));
  }
  for (let i = 0; i <= 6; i++) {
    const ts = start + ((end - start) * i) / 6;
    const d = new Date(ts);
    svg.append(s('text.wb-tick', { x: X(ts), y: H - 8, 'text-anchor': 'middle' }, `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`));
  }
  shown.forEach((x, i) => {
    const pts = x.samples.filter((p) => Number.isFinite(p[1]));
    if (!pts.length) return;
    const d = pts.map((p, j) => `${j ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join(' ');
    svg.append(s('path.wb-line', { d, stroke: PALETTE[i], 'data-i': i }));
  });
  return svg;
}

export function mountWorkbench(el: HTMLElement, props: WorkbenchProps, ctx: Pick<WidgetCtx, 'complete' | 'record'>): Mounted {
  const db = dataset(props.incident ?? 'none');
  const goals = props.goals ?? [];
  const met = new Set<string>();
  /** The near-miss explanation of each unmet goal after the last run of the learner's own query. */
  const missed = new Map<string, Bi>();
  let tab: 'table' | 'graph' | 'targets' = 'table';
  let lastQ = props.query ?? '';
  let lastR: Result | null = null;
  let error = '';
  const input = h('textarea.wb-input', { rows: 2, spellcheck: 'false', placeholder: t(L.placeholder), 'aria-label': 'PromQL' }) as HTMLTextAreaElement;
  input.value = lastQ;
  const out = h('div.wb-out', { 'aria-live': 'polite' });
  const goalsBox = h('ol.wb-goals');
  const tabs = h('div.wb-tabs', { role: 'tablist' });
  // The query a lesson starts with is only shown, never counted: otherwise a
  // goal could tick before the learner has typed anything.
  const run = (own = true) => {
    lastQ = input.value.trim();
    error = '';
    lastR = null;
    missed.clear();
    if (!lastQ) return draw();
    try {
      lastR = query(db, lastQ);
    } catch (e) {
      error = (e as Error).message;
    }
    if (lastR && own) {
      for (const g of goals) {
        if (met.has(g.id)) continue;
        let ok = false;
        try {
          ok = g.reference ? equivalent(db, lastQ, g.reference).ok : !!g.test?.(lastR, lastQ);
        } catch {
          ok = false;
        }
        if (ok) {
          met.add(g.id);
          ctx.record({ kind: 'x.obs.evidence', goal: g.id, query: lastQ });
          continue;
        }
        const r = lastR;
        const say = g.miss?.find((m) => {
          try {
            return m.test(r, lastQ);
          } catch {
            return false;
          }
        })?.say;
        if (say) missed.set(g.id, say);
      }
      if (goals.length && met.size === goals.length) ctx.complete();
    }
    if (own) ctx.record({ kind: 'x.obs.query', ok: !error });
    draw();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      run();
    }
  });
  const drawGoals = () => {
    clear(goalsBox);
    for (const g of goals) {
      const ok = met.has(g.id);
      const miss = !ok ? missed.get(g.id) : undefined;
      goalsBox.append(
        h(
          'li.goal',
          { class: ok ? 'done' : '' },
          h('span.goal-mark', { 'aria-hidden': 'true' }, ok ? '✓' : ''),
          h(
            'div.goal-body',
            {},
            h('p.goal-text', {}, t(g.prompt)),
            ok && g.then ? h('p.wb-then', {}, t(g.then)) : null,
            miss ? h('p.wb-miss', {}, t(miss)) : null,
            !ok && g.hint ? h('details.wb-hint', {}, h('summary', {}, t(bi('Подсказка', 'Hint'))), h('p', {}, t(g.hint))) : null,
          ),
        ),
      );
    }
  };
  const draw = () => {
    clear(tabs);
    for (const [id, label] of [['table', L.table], ['graph', L.graph], ...(props.targets?.length ? [['targets', L.targets]] : [])] as ['table' | 'graph' | 'targets', Bi][]) {
      tabs.append(h('button.wb-tab', { type: 'button', role: 'tab', 'aria-selected': tab === id ? 'true' : 'false', onclick: () => ((tab = id), draw()) }, t(label)));
    }
    clear(out);
    drawGoals();
    if (tab === 'targets') {
      for (const inst of props.targets ?? []) out.append(h('h4.wb-th', {}, `GET http://${inst}/metrics`), h('pre.wb-expo', {}, exposition(db, inst).split('\n').filter((l) => !l.includes('_bucket') || l.includes('route="/checkout"')).slice(0, 60).join('\n')));
      return;
    }
    if (error) {
      out.append(h('p.wb-err', {}, h('span.st-icon.err', { 'aria-hidden': 'true' }, '!'), ' ', error));
      return;
    }
    if (!lastR) return;
    if (tab === 'graph') {
      const start = db.end - (props.hours ?? 3) * 3_600_000;
      let series;
      try {
        series = queryRange(db, lastQ, start, db.end, 120_000);
      } catch (e) {
        out.append(h('p.wb-err', {}, (e as Error).message));
        return;
      }
      if (!series.length) {
        out.append(h('p.muted', {}, t(L.empty)));
        return;
      }
      out.append(chart(series, start, db.end), h('ul.wb-legend', {}, ...series.slice(0, PALETTE.length).map((x, i) => h('li', {}, h('span.wb-swatch', { style: `background:${PALETTE[i]}` }), formatLabels(x.labels)))));
      if (series.length > PALETTE.length) out.append(h('p.muted.small', {}, `+${seriesCount(series.length - PALETTE.length)}`));
      return;
    }
    if (lastR.type === 'scalar' || lastR.type === 'string') {
      out.append(h('p.wb-scalar', {}, h('code', {}, lastR.type === 'scalar' ? fmtNum(lastR.value) : lastR.value)));
      return;
    }
    if (lastR.type === 'matrix') {
      out.append(h('table.wb-table', {}, h('tbody', {}, ...lastR.data.slice(0, 50).map((x) => h('tr', {}, h('td', {}, formatLabels(x.labels)), h('td.num', {}, x.samples.map((p) => `${fmtNum(p[1])} @${p[0] / 1000}`).join('\n')))))));
      return;
    }
    if (!lastR.data.length) {
      out.append(h('p.muted', {}, t(L.empty)));
      return;
    }
    out.append(h('p.muted.small', {}, seriesCount(lastR.data.length)), h('table.wb-table', {}, h('tbody', {}, ...lastR.data.slice(0, 60).map((x) => h('tr', {}, h('td', {}, formatLabels(x.labels)), h('td.num', {}, fmtNum(x.value)))))));
  };
  clear(el);
  el.append(
    h(
      'div.wb',
      {},
      props.title ? h('h3.wb-title', {}, t(props.title)) : null,
      props.alert ? h('div.wb-alert', {}, h('p.wb-alert-tag', {}, h('span.st-icon.err', { 'aria-hidden': 'true' }, '!'), ` ${t(L.firing)}: `, h('strong', {}, props.alert.name)), h('p', {}, t(props.alert.summary)), h('p.wb-alert-labels', {}, ...Object.entries(props.alert.labels).map(([k, v]) => h('code', {}, `${k}=${v}`)))) : null,
      goals.length ? h('div.wb-goals-box', {}, h('h4.lab-h', {}, t(L.goals)), goalsBox) : null,
      h('div.wb-q', {}, input, h('button.btn.primary.small', { type: 'button', onclick: () => run() }, t(L.run))),
      h('p.muted.small', {}, `${t(L.at)}: ${new Date(db.end).toISOString().replace('T', ' ').slice(0, 16)} UTC`),
      tabs,
      out,
    ),
  );
  if (lastQ) run(false);
  else draw();
  if (!goals.length) ctx.complete();
  return { dispose() {}, describe: () => `PromQL: ${lastQ} → ${lastR?.type === 'vector' ? `${lastR.data.length} series` : error || 'no result'}; goals ${met.size}/${goals.length}` };
}

export const workbenchWidget: WidgetReg = { id: 'obs.workbench', mount: (el, props, ctx) => mountWorkbench(el, props as WorkbenchProps, ctx) };
