// Parametric regions simulator for the hidden marketing pilot: how the same
// monthly effort adds up to different pipeline and deals in the US, DACH and
// Asia, depending on budget, the content share and localisation (module H of
// the marketing school). The model is deliberately simple and openly says so:
// it is one way to reason about regional markets, not a law (the honest note
// is part of the UI, like in the sales pilot's funnel).

import { bi, t } from '../../core/i18n';
import type { Mounted, WidgetReg } from '../../core/types';
import { HONEST_NOTE } from './content';

interface RegionsParams {
  /** Marketing budget, thousand dollars per month. */
  budget: number;
  /** Share of the budget spent on content and community rather than sponsorships. */
  content: number;
  /** Share of the materials adapted to each market (not just translated). */
  localized: number;
  /** Planning horizon, months. */
  months: number;
  /** How the effort is split across the three markets. */
  us: number;
  dach: number;
  asia: number;
}

const DEFAULTS: RegionsParams = { budget: 20, content: 0.6, localized: 0.3, months: 12, us: 0.5, dach: 0.3, asia: 0.2 };

interface RegionSpec {
  key: 'us' | 'dach' | 'asia';
  label: [string, string];
  /** How many thousands of relevant contacts one budget dollar reaches per month. */
  depth: number;
  /** How well the unlocalised default (English) message converts here, 0..1. */
  englishFit: number;
  /** How much localisation multiplies the message, 0..1 added to the fit. */
  localGain: number;
  /** Contact → qualified opportunity. */
  opp: number;
  /** Qualified opportunity → deal. */
  win: number;
}

const REGIONS: RegionSpec[] = [
  {
    key: 'us', label: ['США', 'The US'], depth: 1.0, englishFit: 0.7, localGain: 0.2, opp: 0.04, win: 0.25,
  },
  {
    key: 'dach', label: ['DACH', 'DACH'], depth: 0.7, englishFit: 0.35, localGain: 0.55, opp: 0.05, win: 0.25,
  },
  {
    key: 'asia', label: ['Азия', 'Asia'], depth: 0.9, englishFit: 0.03, localGain: 0.8, opp: 0.035, win: 0.2,
  },
];

const KNOBS: { key: 'budget' | 'content' | 'localized' | 'months'; min: number; max: number; step: number; label: [string, string]; fmt: (v: number) => string }[] = [
  { key: 'budget', min: 5, max: 100, step: 1, label: ['Бюджет, тыс. долларов в месяц', 'Budget, thousand dollars per month'], fmt: (v) => String(v) },
  { key: 'content', min: 0, max: 1, step: 0.05, label: ['Доля бюджета на контент и сообщество', 'Budget share on content and community'], fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'localized', min: 0, max: 1, step: 0.05, label: ['Доля материалов, адаптированных под рынок', 'Share of materials adapted to the market'], fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'months', min: 3, max: 24, step: 1, label: ['Горизонт планирования, месяцев', 'Planning horizon, months'], fmt: (v) => String(v) },
];

const SPLITS: { key: 'us' | 'dach' | 'asia'; label: [string, string] }[] = [
  { key: 'us', label: ['Доля усилий: США', 'Effort share: the US'] },
  { key: 'dach', label: ['Доля усилий: DACH', 'Effort share: DACH'] },
  { key: 'asia', label: ['Доля усилий: Азия', 'Effort share: Asia'] },
];

export interface RegionsRow { month: number; leads: number; opportunities: number; deals: number }
export interface RegionResult { key: string; label: [string, string]; rows: RegionsRow[]; totals: { leads: number; opportunities: number; deals: number } }
export interface RegionsResult { regions: RegionResult[]; totalDeals: number; effort: number }

/** The deterministic projection the widget draws; extracted for tests. */
export function regionsProject(p: RegionsParams): RegionsResult {
  const effort = p.us + p.dach + p.asia;
  const share = { us: effort ? p.us / effort : 0, dach: effort ? p.dach / effort : 0, asia: effort ? p.asia / effort : 0 };
  const regions = REGIONS.map((r): RegionResult => {
    const rows: RegionsRow[] = [];
    let deals = 0;
    const fit = Math.min(1, r.englishFit + r.localGain * p.localized);
    let leads = 0, opportunities = 0;
    for (let month = 1; month <= p.months; month++) {
      // Content displaces immediate outbound, takes three months to mature,
      // and saturates. These coefficients are illustrative, not calibrated.
      const maturity = Math.min(1, Math.max(0, month - 3) / 9);
      const channelFactor = (1 - p.content) + 2 * Math.sqrt(p.content) * maturity;
      const monthlyLeads = p.budget * 1000 * share[r.key] * r.depth * 0.02 * channelFactor * fit;
      const monthlyOpps = monthlyLeads * r.opp;
      leads += monthlyLeads;
      opportunities += monthlyOpps;
      deals += monthlyOpps * r.win * (month > 1 ? 1 : 0.4);
      rows.push({ month, leads: Math.round(leads * 10) / 10,
        opportunities: Math.round(opportunities * 100) / 100,
        deals: Math.round(deals * 100) / 100 });
    }
    const last = rows[rows.length - 1] ?? { leads: 0, opportunities: 0, deals: 0 };
    return { key: r.key, label: r.label, rows, totals: { leads: last.leads, opportunities: last.opportunities, deals: last.deals } };
  });
  return { regions, totalDeals: Math.round(regions.reduce((s, r) => s + r.totals.deals, 0) * 100) / 100, effort };
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
.sfu-region { font-weight: 600; }
`;

export function mountRegions(el: HTMLElement, _props: unknown): Mounted {
  const style = document.createElement('style');
  style.textContent = css;
  const root = document.createElement('div');
  root.className = 'sfu-root';
  el.append(style, root);
  const params: RegionsParams = { ...DEFAULTS };
  const h = (tag: string, cls: string, ...kids: (Node | string)[]) => { const e = document.createElement(tag); if (cls) e.className = cls; e.append(...kids); return e; };
  const total = (label: string, value: number | string) => { const d = document.createElement('div'); d.className = 'sfu-total'; const b = document.createElement('b'); b.textContent = String(value); d.append(label, b); return d; };
  const render = () => {
    const r = regionsProject(params);
    const maxDeals = Math.max(0.01, ...r.regions.flatMap((x) => x.rows.map((row) => row.deals)));
    root.replaceChildren(
      h('div', 'sfu-knobs',
        ...KNOBS.map((k) => {
          const input = document.createElement('input');
          input.type = 'range'; input.min = String(k.min); input.max = String(k.max); input.step = String(k.step); input.value = String(params[k.key]);
          const out = document.createElement('output');
          out.textContent = k.fmt(params[k.key]);
          input.oninput = () => { params[k.key] = Number(input.value) as never; out.textContent = k.fmt(Number(input.value)); render(); };
          return h('div', 'sfu-knob', h('label', '', h('span', '', t(bi(k.label[0], k.label[1]))), out), input);
        }),
        ...SPLITS.map((s) => {
          const input = document.createElement('input');
          input.type = 'range'; input.min = '0'; input.max = '100'; input.step = '5'; input.value = String(Math.round(params[s.key] * 100));
          const out = document.createElement('output');
          out.textContent = `${Math.round(params[s.key] * 100)}%`;
          input.oninput = () => { params[s.key] = Number(input.value) / 100; out.textContent = `${input.value}%`; render(); };
          return h('div', 'sfu-knob', h('label', '', h('span', '', t(bi(s.label[0], s.label[1]))), out), input);
        })),
      h('div', 'sfu-totals',
        total(t(bi('Сделок за горизонт суммарно', 'Total deals over the horizon')), r.totalDeals),
        ...r.regions.map((x) => total(`${t(bi(x.label[0], x.label[1]))}: ${t(bi('сделок', 'deals'))}`, x.totals.deals))),
      h('div', 'sfu-bars', ...r.regions.flatMap((x) => x.rows.map((row) => { const i = document.createElement('i'); i.style.height = `${Math.max(2, (row.deals / maxDeals) * 100)}%`; i.title = `${t(bi(x.label[0], x.label[1]))} · ${t(bi('месяц', 'month'))} ${row.month}: ${row.deals}`; return i; }))),
      h('table', 'sfu-table',
        h('thead', '', h('tr', '',
          h('th', '', t(bi('Рынок', 'Market'))),
          h('th', '', t(bi('Контакты накоплено', 'Contacts (cum.)'))),
          h('th', '', t(bi('Возможности накоплено', 'Opportunities (cum.)'))),
          h('th', '', t(bi('Сделок накоплено', 'Deals (cum.)'))))),
        h('tbody', '', ...r.regions.map((x) => h('tr', '',
          h('td', 'sfu-region', t(bi(x.label[0], x.label[1]))),
          h('td', '', String(x.totals.leads)),
          h('td', '', String(x.totals.opportunities)),
          h('td', '', String(x.totals.deals)))))),
      h('p', 'sfu-note', t(bi('Учебная модель, а не прогноз выручки. Контент и исходящие касания делят один бюджет. Исходящие касания дают результат сразу; контент начинает работать после третьего месяца, выходит на полную силу к двенадцатому, и каждый следующий вложенный в него доллар даёт меньше предыдущего. Месячный множитель канала равен (1 − доля контента) + 2 × √(доля контента) × зрелость контента. Коэффициенты охвата, соответствия покупателю и конверсии по регионам — постоянные допущения, а не данные о рынке.', 'Illustrative model, not a revenue forecast. Content uses the same budget as outbound. Outbound contributes immediately; content starts after month 3 and reaches full effect in month 12, with diminishing returns. Monthly channel factor = (1 − content share) + 2 × √content share × maturity. Regional reach, fit and conversion coefficients are fixed assumptions, not calibrated market data.'))),
      h('p', 'sfu-note', t(HONEST_NOTE)),
    );
  };
  render();
  return { dispose() { root.remove(); style.remove(); }, describe: () => t(bi('Симулятор региональных рынков с ручками бюджета, контента, локализации и распределения усилий.', 'A regional-markets simulator with knobs for budget, content, localisation and the split of effort.')) };
}

export const regionsWidget: WidgetReg = { id: 'marketing.regions', mount: mountRegions };
