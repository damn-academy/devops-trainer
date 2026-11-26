import { loadDraft, saveDraft } from '../../engine/trainers/storage';
// Parametric model of the open-core boundary for the hidden "Продукт" pilot:
// how the placement of the free/paid boundary changes adoption, paying
// accounts, revenue and community trust over twelve months. The model is
// deliberately simple and says so in the UI: it shows the direction of the
// trade-off, not exact numbers (the honest note is part of the widget, per
// the pilot requirement).

import { bi, t } from '../../core/i18n';
import type { Mounted, WidgetReg } from '../../core/types';

export interface OpencoreParams {
  /** Share of the product's capabilities kept behind the paid boundary, 0..0.8. */
  boundary: number;
  /** Share of the workflow the free version completes, 0.2..1. */
  breadth: number;
  /** Price of the paid version, thousands of rubles per cluster per month. */
  price: number;
}

export const OPENCORE_DEFAULTS: OpencoreParams = { boundary: 0.35, breadth: 0.7, price: 6 };

export interface OpencoreRow { month: number; companies: number; paying: number; revenue: number; trust: number }
export interface OpencoreTotals { companies: number; paying: number; revenue: number; trust: number; growthRate: number }

export interface OpencoreResult { rows: OpencoreRow[]; totals: OpencoreTotals }

/** The deterministic twelve-month projection the widget draws; extracted for tests. */
export function opencoreProject(p: OpencoreParams, months = 12): OpencoreResult {
  // monthly adoption: broader free product grows faster, a greedy boundary slows it
  const growth = Math.max(0.005, 0.03 + 0.09 * p.breadth - 0.08 * p.boundary);
  // companies convert when they need the paid layer; low trust halves the conversion
  const conversion = 0.015 + 0.06 * p.boundary;
  let companies = 80;
  let trust = 85;
  const rows: OpencoreRow[] = [];
  for (let month = 1; month <= months; month++) {
    trust = Math.max(5, Math.min(100, trust - Math.max(0, p.boundary - 0.35) * 8 - Math.max(0, 0.45 - p.breadth) * 4));
    companies *= 1 + growth * (trust / 100);
    const conv = trust < 45 ? conversion * 0.6 : conversion;
    const paying = Math.round(companies * conv);
    const revenue = paying * p.price;
    rows.push({
      month,
      companies: Math.round(companies),
      paying: Math.round(paying),
      revenue: Math.round(revenue * 100) / 100,
      trust: Math.round(trust),
    });
  }
  const last = rows[rows.length - 1]!;
  return { rows, totals: { companies: last.companies, paying: last.paying, revenue: last.revenue, trust: last.trust, growthRate: growth } };
}

/** One honest sentence about the current outcome, shown under the counters. */
export function opencoreVerdict(r: OpencoreResult): { ru: string; en: string } {
  void r;
  return { ru: 'Модель не учитывает, как цена влияет на число покупателей, отток клиентов, расходы компании, конкурентов и готовность платить, поэтому советовать по ней цену нельзя: она показывает только, как граница версий меняет рост, доверие и долю платящих.', en: 'This model excludes price elasticity, churn, costs, competition and willingness to pay.' };
}

const KNOBS: { key: keyof OpencoreParams; min: number; max: number; step: number; label: [string, string]; fmt: (v: number) => string }[] = [
  { key: 'boundary', min: 0, max: 0.8, step: 0.05, label: ['Доля возможностей за платной границей', 'Share of capabilities behind the paid boundary'], fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'breadth', min: 0.2, max: 1, step: 0.05, label: ['Доля рабочего процесса в бесплатной версии', 'Share of the workflow in the free version'], fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'price', min: 1, max: 20, step: 0.5, label: ['Цена платной версии, тыс ₽ в месяц', 'Paid version price, kRUB per month'], fmt: (v) => String(v) },
];

let instance = 0;
const css = `
.poc-results { display:grid;gap:14px;min-width:0; }
.poc-formula {white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}
.poc-root { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
.poc-knobs { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(230px, 100%), 1fr)); gap: 10px 18px; }
.poc-knob label { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; }
.poc-knob output { font-variant-numeric: tabular-nums; color: var(--accent, #2f6fdd); }
.poc-knob input[type=range] { width: 100%; }
.poc-totals { display: flex; flex-wrap: wrap; gap: 16px; }
.poc-total b { display: block; font-size: 22px; font-variant-numeric: tabular-nums; }
.poc-verdict { font-size: 13px; border-left: 3px solid var(--accent, #2f6fdd); padding: 6px 10px; }
.poc-bars { display: flex; align-items: flex-end; gap: 3px; height: 72px; }
.poc-bars i { flex: 1; background: var(--accent, #2f6fdd); opacity: .75; border-radius: 2px 2px 0 0; min-height: 2px; }
.poc-table { table-layout: fixed; overflow-wrap: anywhere; width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
.poc-table th, .poc-table td { text-align: right; padding: 3px 8px; border-bottom: 1px solid var(--line, #d8dee9); }
.poc-table th:first-child, .poc-table td:first-child { text-align: left; }
.poc-note { font-size: 13px; color: var(--muted, #5a6577); border-left: 3px solid var(--accent, #2f6fdd); padding: 6px 10px; }
`;

export function mountOpencore(el: HTMLElement, _props: unknown): Mounted {
  const style = document.createElement('style');
  style.textContent = css;
  const root = document.createElement('div');
  root.className = 'poc-root';
  el.append(style, root);
  const params: OpencoreParams = { ...OPENCORE_DEFAULTS, ...loadDraft<Partial<OpencoreParams>>('product.opencore', {}) };
  const h = (tag: string, cls: string, ...kids: (Node | string)[]) => { const e = document.createElement(tag); if (cls) e.className = cls; e.append(...kids); return e; };
  const total = (label: string, value: number | string) => { const d = document.createElement('div'); d.className = 'poc-total'; const b = document.createElement('b'); b.textContent = String(value); d.append(label, b); return d; };
  const inputPrefix = `${++instance}-poc`;
  const results = h('div', 'poc-results');
  root.append(h('div', 'poc-knobs', ...KNOBS.map((k) => {
        const input = document.createElement('input');
        input.type = 'range'; input.min = String(k.min); input.max = String(k.max); input.step = String(k.step); input.value = String(params[k.key]);
        const out = document.createElement('output');
        out.textContent = k.fmt(params[k.key]);
        input.oninput = () => { params[k.key] = Number(input.value) as never; out.textContent = k.fmt(Number(input.value)); render(); };
        input.setAttribute('aria-label', t(bi(k.label[0], k.label[1])));
        const label = h('label', '', h('span', '', t(bi(k.label[0], k.label[1]))), out);
        input.id = `${inputPrefix}-${k.key}`; label.setAttribute('for', input.id);
        return h('div', 'poc-knob', label, input);
      })), results);
  const render = () => {
    saveDraft('product.opencore', params);
    const r = opencoreProject(params);
    const maxCompanies = Math.max(1, ...r.rows.map((x) => x.companies));
    const verdict = opencoreVerdict(r);
    results.replaceChildren(

      h('div', 'poc-totals',
        total(t(bi('Компаний с продуктом', 'Companies with the product')), r.totals.companies),
        total(t(bi('Платящих компаний', 'Paying companies')), r.totals.paying),
        total(t(bi('Выручка, тыс ₽ в месяц', 'Revenue, kRUB per month')), r.totals.revenue),
        total(t(bi('Индекс доверия сообщества', 'Community trust index')), r.totals.trust)),
      h('p', 'poc-verdict', t(bi(verdict.ru, verdict.en))),
      h('div', 'poc-bars', ...r.rows.map((row) => { const i = document.createElement('i'); i.style.height = `${Math.max(2, (row.companies / maxCompanies) * 100)}%`; i.title = `${t(bi('Месяц', 'Month'))} ${row.month}: ${row.companies}`; return i; })),
      h('table', 'poc-table',
        h('thead', '', h('tr', '',
          h('th', '', t(bi('Месяц', 'Month'))),
          h('th', '', t(bi('Компаний', 'Companies'))),
          h('th', '', t(bi('Платящих', 'Paying'))),
          h('th', '', t(bi('Выручка', 'Revenue'))),
          h('th', '', t(bi('Доверие', 'Trust'))))),
        h('tbody', '', ...r.rows.map((row) => h('tr', '',
          h('td', '', String(row.month)),
          h('td', '', String(row.companies)),
          h('td', '', String(row.paying)),
          h('td', '', String(row.revenue)),
          h('td', '', String(row.trust)))))),
      h('p', 'poc-note', t(bi('Как считается модель. Число платящих компаний округляется до целого, и выручка считается от этого целого числа, поэтому она равна числу платящих, умноженному на цену. Коэффициенты роста, доли платящих и доверия ниже — учебные допущения, а не измерения: они показывают направление влияния границы, а не его величину.', 'How the model works. Paying companies are rounded to a whole number, and revenue is computed from that number, so it equals paying companies times price. The growth, conversion and trust coefficients below are teaching assumptions, not measurements: they show the direction of the boundary effect, not its size.'))),
      h('pre', 'poc-formula', `companies₀ = 80; trust₀ = 85
growth = max(0.005, 0.03 + 0.09 × breadth − 0.08 × boundary)
conversion = (0.015 + 0.06 × boundary) × (trust < 45 ? 0.6 : 1)
trust = clamp(trust − max(0, boundary − 0.35) × 8 − max(0, 0.45 − breadth) × 4, 5, 100)
companies ×= 1 + growth × trust / 100
paying = round(companies × conversion)
${r.totals.paying} × ${params.price} = ${r.totals.revenue}`),
    );
  };
  render();
  return { dispose() { root.remove(); style.remove(); }, describe: () => t(bi('Модель границы open-core с ползунками границы, широты бесплатной версии и цены, месячная проекция установок, платящих компаний, выручки и доверия.', 'An open-core boundary model with sliders for the boundary, free-version breadth and price, and a monthly projection of installs, paying companies, revenue and trust.')) };
}

export const opencoreWidget: WidgetReg = { id: 'product.opencore', mount: mountOpencore };
