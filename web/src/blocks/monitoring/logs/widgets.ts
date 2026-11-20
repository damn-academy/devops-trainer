// The log explorer (LogQL over the Shop logs, like Grafana Explore with Loki)
// and the trace viewer (search, waterfall, span attributes and the log lines
// of a trace). Goals are checked on what the learner found: the result of a
// query, the trace and the span that are open.

import type { Mounted, WidgetCtx, WidgetReg } from '../../../core/types';
import { bi, count, t, type Bi } from '../../../core/i18n';
import { seriesCount } from '../workbench';
import { clear, h } from '../../../core/dom';
import type { Incident, Labels } from '../prom/data';
import { iso, logDataset, type Span, type Trace } from './data';
import { flatEntries, formatLogLabels, runLogQL, type LogResult } from './logql';
import '../workbench.css';
import './widgets.css';

export interface LogGoal {
  id: string;
  prompt: Bi;
  test: (r: LogResult, q: string) => boolean;
  then?: Bi;
  hint?: Bi;
}

export interface LogsProps {
  incident?: Incident;
  query?: string;
  goals?: LogGoal[];
  title?: Bi;
}

const L = {
  run: bi('Выполнить', 'Run query'),
  placeholder: bi('Запрос LogQL, например {app="api"} |= "error"', 'A LogQL query, e.g. {app="api"} |= "error"'),
  goals: bi('Что найти', 'What to find'),
  hint: bi('Подсказка', 'Hint'),
  empty: bi('Ни одна строка журнала не подошла под запрос.', 'No log line matched the query.'),
  range: bi('за последний час, сначала новые', 'over the last hour, newest first'),
  labels: bi('Метки потоков', 'Stream labels'),
  at: bi('момент запроса', 'evaluated at'),
};

function highlight(line: string): (Node | string)[] {
  try {
    const o = JSON.parse(line) as Record<string, unknown>;
    const parts: (Node | string)[] = ['{'];
    Object.entries(o).forEach(([k, v], i) => {
      if (i) parts.push(', ');
      parts.push(h('span.lx-k', {}, `"${k}"`), ':', h(`span.lx-v${k === 'level' ? `.lv-${String(v)}` : ''}`, {}, JSON.stringify(v)));
    });
    parts.push('}');
    return parts;
  } catch {
    return [line.replace(/\blevel=(\w+)/, 'level=$1')];
  }
}

function goalList(goals: { id: string; prompt: Bi; then?: Bi; hint?: Bi }[], met: Set<string>): HTMLElement {
  return h(
    'ol.wb-goals',
    {},
    ...goals.map((g) => {
      const ok = met.has(g.id);
      return h('li.goal', { class: ok ? 'done' : '', 'data-task': g.id }, h('span.goal-mark', { 'aria-hidden': 'true' }, ok ? '✓' : ''), h('div.goal-body', {}, h('p.goal-text', {}, t(g.prompt)), ok && g.then ? h('p.wb-then', {}, t(g.then)) : !ok && g.hint ? h('details.wb-hint', {}, h('summary', {}, t(L.hint)), h('p', {}, t(g.hint))) : null));
    }),
  );
}

export function mountLogs(el: HTMLElement, props: LogsProps, ctx: Pick<WidgetCtx, 'complete' | 'record'>): Mounted {
  const db = logDataset(props.incident ?? 'none');
  const goals = props.goals ?? [];
  const met = new Set<string>();
  let lastQ = props.query ?? '';
  let lastR: LogResult | null = null;
  let error = '';
  const input = h('textarea.wb-input', { rows: 2, spellcheck: 'false', placeholder: t(L.placeholder), 'aria-label': 'LogQL' }) as HTMLTextAreaElement;
  input.value = lastQ;
  const out = h('div.wb-out', { 'aria-live': 'polite' });
  const goalsBox = h('div');
  const labelsBox = h('div.lx-labels');
  // The query a lesson starts with is only shown, never counted towards the goals.
  const run = (own = true) => {
    lastQ = input.value.trim();
    error = '';
    lastR = null;
    if (lastQ) {
      try {
        lastR = runLogQL(db, lastQ, { limit: 200 });
      } catch (e) {
        error = (e as Error).message;
      }
    }
    if (lastR && own) {
      for (const g of goals) {
        if (met.has(g.id)) continue;
        let ok = false;
        try {
          ok = g.test(lastR, lastQ);
        } catch {
          ok = false;
        }
        if (ok) {
          met.add(g.id);
          ctx.record({ kind: 'x.obs.evidence', goal: g.id, query: lastQ });
        }
      }
      if (goals.length && met.size === goals.length) ctx.complete();
    }
    if (own) ctx.record({ kind: 'x.obs.logquery', ok: !error });
    draw();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      run();
    }
  });
  const insert = (k: string, v: string) => {
    input.value = `{${k}="${v}"}`;
    input.focus();
  };
  const drawLabels = () => {
    clear(labelsBox);
    const names = [...new Set(db.streams.flatMap((s) => Object.keys(s.labels)))].sort();
    labelsBox.append(
      h('p.lx-h', {}, t(L.labels)),
      ...names.map((n) => h('p.lx-row', {}, h('code', {}, n), ' ', ...[...new Set(db.streams.map((s) => s.labels[n]))].sort().map((v) => h('button.lx-chip', { type: 'button', onclick: () => insert(n, v) }, v)))),
    );
  };
  const draw = () => {
    clear(goalsBox);
    if (goals.length) goalsBox.append(h('div.wb-goals-box', {}, h('h4.lab-h', {}, t(L.goals)), goalList(goals, met)));
    clear(out);
    if (error) {
      out.append(h('p.wb-err', {}, h('span.st-icon.err', { 'aria-hidden': 'true' }, '!'), ' ', error));
      return;
    }
    if (!lastR) return;
    if (lastR.type === 'scalar') {
      out.append(h('p.wb-scalar', {}, h('code', {}, String(+lastR.value.toFixed(4)))));
      return;
    }
    if (lastR.type === 'vector') {
      if (!lastR.data.length) return void out.append(h('p.muted', {}, t(L.empty)));
      out.append(h('p.muted.small', {}, seriesCount(lastR.data.length)), h('table.wb-table', {}, h('tbody', {}, ...lastR.data.slice(0, 60).map((x) => h('tr', {}, h('td', {}, formatLogLabels(x.labels)), h('td.num', {}, String(Number.isInteger(x.value) ? x.value : +x.value.toFixed(4))))))));
      return;
    }
    const rows = flatEntries(lastR);
    if (!rows.length) return void out.append(h('p.muted', {}, t(L.empty)));
    out.append(
      h('p.muted.small', {}, `${count(rows.length, ['строка', 'строки', 'строк'], ['line', 'lines'])} · ${t(L.range)}`),
      h(
        'ol.lx-lines',
        {},
        ...rows.slice(0, 200).map((x) =>
          h(
            'li.lx-line',
            {},
            h('span.lx-ts', {}, iso(x.ts).slice(11, 19)),
            h('span.lx-lab', {}, x.labels.instance ?? x.labels.app ?? ''),
            h('details.lx-body', {}, h('summary', {}, ...highlight(x.line)), h('p.lx-all', {}, formatLogLabels(x.labels as Labels))),
          ),
        ),
      ),
    );
  };
  clear(el);
  el.append(
    h(
      'div.wb.lx',
      {},
      props.title ? h('h3.wb-title', {}, t(props.title)) : null,
      goalsBox,
      h('div.wb-q', {}, input, h('button.btn.primary.small', { type: 'button', onclick: () => run() }, t(L.run))),
      h('p.muted.small', {}, `${t(L.at)}: ${iso(db.end).replace('T', ' ').replace('Z', '')} UTC`),
      h('details.lx-browser', {}, h('summary', {}, t(L.labels)), labelsBox),
      out,
    ),
  );
  drawLabels();
  if (lastQ) run(false);
  else draw();
  if (!goals.length) ctx.complete();
  return { dispose() {}, describe: () => `LogQL: ${lastQ} → ${lastR ? (lastR.type === 'streams' ? `${flatEntries(lastR).length} lines` : lastR.type) : error || 'no result'}; goals ${met.size}/${goals.length}` };
}

// ── traces ──

export interface TraceState {
  trace?: Trace;
  span?: Span;
  search: { service: string; route: string; minMs: number; traceId: string };
}

export interface TraceGoal {
  id: string;
  prompt: Bi;
  test: (s: TraceState) => boolean;
  then?: Bi;
  hint?: Bi;
}

export interface TracesProps {
  incident?: Incident;
  goals?: TraceGoal[];
  title?: Bi;
}

const T = {
  search: bi('Найти трейсы', 'Find traces'),
  route: bi('Маршрут', 'Route'),
  any: bi('любой', 'any'),
  min: bi('Длительность от, мс', 'Duration from, ms'),
  id: bi('trace_id', 'trace_id'),
  longest: bi('показаны самые долгие', 'the longest are shown'),
  none: bi('Ничего не найдено.', 'Nothing found.'),
  attrs: bi('Атрибуты спана', 'Span attributes'),
  logs: bi('Строки журнала с этим trace_id', 'Log lines with this trace_id'),
  pick: bi('Выберите спан на водопаде, чтобы увидеть его атрибуты.', 'Pick a span on the waterfall to see its attributes.'),
};

export function waterfallRows(tr: Trace): { span: Span; depth: number }[] {
  const out: { span: Span; depth: number }[] = [];
  const walk = (parent: string | undefined, depth: number) => {
    for (const s of tr.spans.filter((x) => x.parentId === parent).sort((a, b) => a.start - b.start)) {
      out.push({ span: s, depth });
      walk(s.spanId, depth + 1);
    }
  };
  walk(undefined, 0);
  return out;
}

export function mountTraces(el: HTMLElement, props: TracesProps, ctx: Pick<WidgetCtx, 'complete' | 'record'>): Mounted {
  const db = logDataset(props.incident ?? 'none');
  const goals = props.goals ?? [];
  const met = new Set<string>();
  const state: TraceState = { search: { service: 'frontend', route: '', minMs: 0, traceId: '' } };
  const goalsBox = h('div');
  const listBox = h('div.tv-list');
  const viewBox = h('div.tv-view');
  const evaluate = () => {
    for (const g of goals) {
      if (met.has(g.id)) continue;
      let ok = false;
      try {
        ok = g.test(state);
      } catch {
        ok = false;
      }
      if (ok) {
        met.add(g.id);
        ctx.record({ kind: 'x.obs.evidence', goal: g.id, trace: state.trace?.traceId, span: state.span?.name });
      }
    }
    if (goals.length && met.size === goals.length) ctx.complete();
    clear(goalsBox);
    if (goals.length) goalsBox.append(h('div.wb-goals-box', {}, h('h4.lab-h', {}, t(L.goals)), goalList(goals, met)));
  };
  const routeSel = h('select.tv-in', { 'aria-label': t(T.route) }, h('option', { value: '' }, t(T.any)), ...['/', '/cart', '/checkout', '/api/products'].map((r) => h('option', { value: r }, r))) as HTMLSelectElement;
  const minIn = h('input.tv-in', { type: 'number', min: 0, step: 100, value: 0, 'aria-label': t(T.min) }) as HTMLInputElement;
  const idIn = h('input.tv-in.tv-id', { type: 'text', spellcheck: 'false', placeholder: '4bf92f3577b34da6a3ce929d0e0e4736', 'aria-label': 'trace_id' }) as HTMLInputElement;
  const search = () => {
    state.search = { service: 'frontend', route: routeSel.value, minMs: Number(minIn.value) || 0, traceId: idIn.value.trim() };
    const hits = db.traces.filter((tr) => (state.search.traceId ? tr.traceId === state.search.traceId : (!state.search.route || tr.route === state.search.route) && tr.spans[0].duration >= state.search.minMs));
    clear(listBox);
    if (!hits.length) listBox.append(h('p.muted', {}, t(T.none)));
    else {
      const top = [...hits].sort((a, b) => b.spans[0].duration - a.spans[0].duration).slice(0, 12);
      listBox.append(
        h('p.muted.small', {}, `${count(hits.length, ['трейс найден', 'трейса найдено', 'трейсов найдено'], ['trace found', 'traces found'])}, ${t(T.longest)}`),
        h(
          'table.wb-table.tv-table',
          {},
          h(
            'tbody',
            {},
            ...top.map((tr) =>
              h(
                'tr',
                { class: state.trace === tr ? 'tv-sel' : '' },
                h('td', {}, h('button.tv-link', { type: 'button', onclick: () => open(tr) }, tr.traceId.slice(0, 12) + '…')),
                h('td', {}, `${tr.spans[0].name}`),
                h('td.num', {}, `${tr.spans[0].duration} ms`),
                h('td.num', {}, count(tr.spans.length, ['спан', 'спана', 'спанов'], ['span', 'spans'])),
                h('td', {}, tr.spans.some((s) => s.status === 'error') ? h('span.tv-err', {}, 'error') : ''),
              ),
            ),
          ),
        ),
      );
      if (hits.length === 1) open(hits[0]);
    }
    ctx.record({ kind: 'x.obs.tracesearch', hits: hits.length });
    evaluate();
  };
  const open = (tr: Trace) => {
    state.trace = tr;
    state.span = undefined;
    drawView();
    evaluate();
  };
  const drawView = () => {
    clear(viewBox);
    const tr = state.trace;
    if (!tr) return;
    const total = tr.spans[0].duration;
    const rows = waterfallRows(tr);
    viewBox.append(
      h('h4.wb-th', {}, `trace ${tr.traceId} · ${iso(tr.at).replace('T', ' ').replace('Z', '')} · ${total} ms`),
      h(
        'ol.tv-wf',
        {},
        ...rows.map(({ span, depth }) =>
          h(
            'li.tv-row',
            { class: state.span === span ? 'tv-sel' : '' },
            h('button.tv-name', { type: 'button', style: `padding-left:${depth * 14 + 4}px`, onclick: () => ((state.span = span), drawView(), evaluate()) }, h(`span.tv-svc.svc-${span.service}`, {}, span.service), ' ', span.name),
            h('span.tv-track', {}, h(`span.tv-bar.svc-${span.service}${span.status === 'error' ? '.tv-bar-err' : ''}`, { style: `left:${(span.start / total) * 100}%;width:${Math.max(0.6, (span.duration / total) * 100)}%` })),
            h('span.tv-ms', {}, `${span.duration} ms`),
          ),
        ),
      ),
    );
    const sp = state.span;
    if (!sp) viewBox.append(h('p.muted.small', {}, t(T.pick)));
    else
      viewBox.append(
        h('h4.wb-th', {}, `${t(T.attrs)}: ${sp.service} · ${sp.name}`),
        h('table.wb-table', {}, h('tbody', {}, ...[['span_id', sp.spanId], ['parent_span_id', sp.parentId ?? '—'], ['duration', `${sp.duration} ms`], ['status', sp.status], ...Object.entries(sp.attrs)].map(([k, v]) => h('tr', {}, h('td', {}, String(k)), h('td', {}, String(v)))))),
      );
    const logs = flatEntries(runLogQL(db, `{app="api"} |= "${tr.traceId}"`, { limit: 10 }));
    if (logs.length) viewBox.append(h('h4.wb-th', {}, t(T.logs)), h('ol.lx-lines', {}, ...logs.map((x) => h('li.lx-line', {}, h('span.lx-ts', {}, iso(x.ts).slice(11, 19)), h('span.lx-lab', {}, x.labels.instance ?? ''), h('span.lx-body', {}, ...highlight(x.line))))));
  };
  clear(el);
  el.append(
    h(
      'div.wb.tv',
      {},
      props.title ? h('h3.wb-title', {}, t(props.title)) : null,
      goalsBox,
      h('div.tv-search', {}, h('label.tv-field', {}, h('span', {}, t(T.route)), routeSel), h('label.tv-field', {}, h('span', {}, t(T.min)), minIn), h('label.tv-field.tv-grow', {}, h('span', {}, t(T.id)), idIn), h('button.btn.primary.small', { type: 'button', onclick: search }, t(T.search))),
      listBox,
      viewBox,
    ),
  );
  evaluate();
  if (!goals.length) ctx.complete();
  return { dispose() {}, describe: () => `traces: open ${state.trace?.traceId ?? 'none'}, span ${state.span?.name ?? 'none'}; goals ${met.size}/${goals.length}` };
}

export const logsWidget: WidgetReg = { id: 'obs.logs', mount: (el, props, ctx) => mountLogs(el, props as LogsProps, ctx) };
export const tracesWidget: WidgetReg = { id: 'obs.traces', mount: (el, props, ctx) => mountTraces(el, props as TracesProps, ctx) };
