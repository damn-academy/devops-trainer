// Parametric funnel simulator for the hidden sales pilot: how touch
// parameters add up to meetings, POCs and deals over a quarter. The model is
// deliberately simple and openly says so: it is one way to reason about a
// pipeline, not a law (the honest note is part of the UI, per the pilot
// requirement). TODO(ru-en): English UI pass.

import { bi, t } from '../../core/i18n';
import type { Mounted, WidgetReg } from '../../core/types';
import { HONEST_NOTE } from './content';

interface FunnelParams {
  /** Target accounts in the worked set. */
  accounts: number;
  /** Personal touches per account per week. */
  touches: number;
  /** Share of touches that get any answer. */
  respond: number;
  /** Share of answers that become a meeting. */
  meeting: number;
  /** Share of meetings that start a paid POC. */
  poc: number;
  /** Share of POCs that close. */
  close: number;
  weeks: number;
}

const DEFAULTS: FunnelParams = { accounts: 30, touches: 2, respond: 0.15, meeting: 0.3, poc: 0.4, close: 0.35, weeks: 12 };

const KNOBS: { key: keyof FunnelParams; min: number; max: number; step: number; label: [string, string]; fmt: (v: number) => string }[] = [
  { key: 'accounts', min: 5, max: 133, step: 1, label: ['Аккаунтов в работе', 'Accounts in the worked set'], fmt: (v) => String(v) },
  { key: 'touches', min: 1, max: 8, step: 1, label: ['Касаний на аккаунт в неделю', 'Touches per account per week'], fmt: (v) => String(v) },
  { key: 'respond', min: 0.02, max: 0.5, step: 0.01, label: ['Доля ответов', 'Response rate'], fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'meeting', min: 0.05, max: 0.8, step: 0.01, label: ['Ответ → встреча', 'Answer → meeting'], fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'poc', min: 0.05, max: 0.8, step: 0.01, label: ['Встреча → POC', 'Meeting → POC'], fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'close', min: 0.05, max: 0.8, step: 0.01, label: ['POC → сделка', 'POC → deal'], fmt: (v) => `${Math.round(v * 100)}%` },
];

export interface FunnelRow { week: number; meetings: number; pocs: number; deals: number }
export interface FunnelResult { rows: FunnelRow[]; totals: { meetings: number; pocs: number; deals: number; touches: number } }

/** The deterministic projection the widget draws; extracted for tests. */
export function funnelProject(p: FunnelParams): FunnelResult {
  let meetings = 0, pocs = 0;
  const rows: FunnelRow[] = [];
  const weeklyTouches = p.accounts * p.touches;
  for (let week = 1; week <= p.weeks; week++) {
    meetings += weeklyTouches * p.respond * p.meeting;
    pocs += meetings * 0.15 * p.poc; // a running pipeline converts steadily, not instantly
    const deals = pocs * p.close * 0.25;
    rows.push({ week, meetings: Math.round(meetings * 10) / 10, pocs: Math.round(pocs * 10) / 10, deals: Math.round(deals * 100) / 100 });
  }
  const last = rows[rows.length - 1]!;
  return { rows, totals: { meetings: Math.round(last.meetings), pocs: Math.round(last.pocs * 10) / 10, deals: Math.round(last.deals * 100) / 100, touches: weeklyTouches * p.weeks } };
}

const css = `
.sfu-root { display: grid; gap: 14px; }
.sfu-knobs { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px 18px; }
.sfu-knob label { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; }
.sfu-knob output { font-variant-numeric: tabular-nums; color: var(--accent, #2f6fdd); }
.sfu-knob input[type=range] { width: 100%; }
.sfu-table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
.sfu-table th, .sfu-table td { text-align: right; padding: 3px 8px; border-bottom: 1px solid var(--line, #d8dee9); }
.sfu-table th:first-child, .sfu-table td:first-child { text-align: left; }
.sfu-totals { display: flex; flex-wrap: wrap; gap: 16px; }
.sfu-total b { display: block; font-size: 22px; font-variant-numeric: tabular-nums; }
.sfu-note { font-size: 13px; color: var(--muted, #5a6577); border-left: 3px solid var(--accent, #2f6fdd); padding: 6px 10px; }
.sfu-bars { display: flex; align-items: flex-end; gap: 3px; height: 72px; }
.sfu-bars i { flex: 1; background: var(--accent, #2f6fdd); opacity: .75; border-radius: 2px 2px 0 0; min-height: 2px; }
`;

export function mountFunnel(el: HTMLElement, _props: unknown): Mounted {
  const style = document.createElement('style');
  style.textContent = css;
  const root = document.createElement('div');
  root.className = 'sfu-root';
  el.append(style, root);
  const params: FunnelParams = { ...DEFAULTS };
  const render = () => {
    const r = funnelProject(params);
    const maxMeetings = Math.max(1, ...r.rows.map((x) => x.meetings));
    root.replaceChildren(
      h('div', 'sfu-knobs', ...KNOBS.map((k) => {
        const input = document.createElement('input');
        input.type = 'range'; input.min = String(k.min); input.max = String(k.max); input.step = String(k.step); input.value = String(params[k.key]);
        const out = document.createElement('output');
        out.textContent = k.fmt(params[k.key]);
        input.oninput = () => { params[k.key] = Number(input.value) as never; out.textContent = k.fmt(Number(input.value)); render(); };
        return h('div', 'sfu-knob', h('label', '', h('span', '', t(bi(k.label[0], k.label[1]))), out), input);
      })),
      h('div', 'sfu-totals',
        total(t(bi('Встреч за квартал', 'Meetings per quarter')), r.totals.meetings),
        total(t(bi('POC', 'POCs')), r.totals.pocs),
        total(t(bi('Сделок', 'Deals')), r.totals.deals),
        total(t(bi('Всего касаний', 'Total touches')), r.totals.touches)),
      h('div', 'sfu-bars', ...r.rows.map((row) => { const i = document.createElement('i'); i.style.height = `${Math.max(2, (row.meetings / maxMeetings) * 100)}%`; i.title = `${t(bi('Неделя', 'Week'))} ${row.week}: ${row.meetings}`; return i; })),
      h('table', 'sfu-table',
        h('thead', '', h('tr', '', h('th', '', t(bi('Неделя', 'Week'))), h('th', '', t(bi('Встреч накоплено', 'Meetings (cum.'))), h('th', '', t(bi('POC накоплено', 'POCs (cum.'))), h('th', '', t(bi('Сделок накоплено', 'Deals (cum.'))))),
        h('tbody', '', ...r.rows.map((row) => h('tr', '', h('td', '', String(row.week)), h('td', '', String(row.meetings)), h('td', '', String(row.pocs)), h('td', '', String(row.deals)))))),
      h('p', 'sfu-note', t(HONEST_NOTE)),
    );
  };
  const total = (label: string, value: number | string) => { const d = document.createElement('div'); d.className = 'sfu-total'; const b = document.createElement('b'); b.textContent = String(value); d.append(label, b); return d; };
  const h = (tag: string, cls: string, ...kids: (Node | string)[]) => { const e = document.createElement(tag); if (cls) e.className = cls; e.append(...kids); return e; };
  render();
  return { dispose() { root.remove(); style.remove(); }, describe: () => t(bi('Симулятор воронки продаж с ручками параметров и помесячной проекцией.', 'A sales funnel simulator with parameter knobs and a weekly projection.')) };
}

export const funnelWidget: WidgetReg = { id: 'sales.funnel', mount: mountFunnel };
