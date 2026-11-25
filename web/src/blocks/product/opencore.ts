// Parametric model of the open-core boundary for the hidden "Продукт" pilot:
// how the placement of the free/paid boundary changes adoption, paying
// accounts, revenue and community trust over twelve months. The model is
// deliberately simple and says so in the UI: it shows the direction of the
// trade-off, not exact numbers (the honest note is part of the widget, per
// the pilot requirement).

import { bi, t } from '../../core/i18n';
import type { Mounted, WidgetReg } from '../../core/types';
import { PRODUCT_HONEST_NOTE } from './content';

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
    const paying = companies * conv;
    const revenue = paying * p.price;
    rows.push({
      month,
      companies: Math.round(companies),
      paying: Math.round(paying),
      revenue: Math.round(revenue),
      trust: Math.round(trust),
    });
  }
  const last = rows[rows.length - 1]!;
  return { rows, totals: { companies: last.companies, paying: last.paying, revenue: last.revenue, trust: last.trust, growthRate: growth } };
}

/** One honest sentence about the current outcome, shown under the counters. */
export function opencoreVerdict(r: OpencoreResult): { ru: string; en: string } {
  const { trust, paying, revenue } = r.totals;
  if (trust < 45) {
    return {
      ru: 'Граница слишком жадная: доверие сообщества падает, и рост платящих компаний замедляется именно там, где нужна скорость.',
      en: 'The boundary is too greedy: community trust falls, and the growth of paying companies slows exactly where speed is needed.',
    };
  }
  if (paying < 3) {
    return {
      ru: 'Доверие в порядке, но платят почти никто: бесплатная версия решает слишком много, и продавать нечего.',
      en: 'Trust is fine, but almost nobody pays: the free version does too much, and there is nothing left to sell.',
    };
  }
  if (revenue < 30) {
    return {
      ru: 'Модель работает, но цена слишком низкая для корпоративного слоя: попробуйте поднять её, прежде чем двигать границу.',
      en: 'The model works, but the price is too low for the enterprise layer: try raising it before moving the boundary.',
    };
  }
  return {
    ru: 'Граница стоит ровно там, где бесплатное решает задачу маленькой команды, а компании платят за свой слой.',
    en: 'The boundary sits exactly where the free tier solves a small team’s job and companies pay for their own layer.',
  };
}

const KNOBS: { key: keyof OpencoreParams; min: number; max: number; step: number; label: [string, string]; fmt: (v: number) => string }[] = [
  { key: 'boundary', min: 0, max: 0.8, step: 0.05, label: ['Доля возможностей за платной границей', 'Share of capabilities behind the paid boundary'], fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'breadth', min: 0.2, max: 1, step: 0.05, label: ['Доля рабочего процесса в бесплатной версии', 'Share of the workflow in the free version'], fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'price', min: 1, max: 20, step: 0.5, label: ['Цена платной версии, тыс ₽ в месяц', 'Paid version price, kRUB per month'], fmt: (v) => String(v) },
];

const css = `
.poc-root { display: grid; gap: 14px; }
.poc-knobs { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px 18px; }
.poc-knob label { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; }
.poc-knob output { font-variant-numeric: tabular-nums; color: var(--accent, #2f6fdd); }
.poc-knob input[type=range] { width: 100%; }
.poc-totals { display: flex; flex-wrap: wrap; gap: 16px; }
.poc-total b { display: block; font-size: 22px; font-variant-numeric: tabular-nums; }
.poc-verdict { font-size: 13px; border-left: 3px solid var(--accent, #2f6fdd); padding: 6px 10px; }
.poc-bars { display: flex; align-items: flex-end; gap: 3px; height: 72px; }
.poc-bars i { flex: 1; background: var(--accent, #2f6fdd); opacity: .75; border-radius: 2px 2px 0 0; min-height: 2px; }
.poc-table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
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
  const params: OpencoreParams = { ...OPENCORE_DEFAULTS };
  const h = (tag: string, cls: string, ...kids: (Node | string)[]) => { const e = document.createElement(tag); if (cls) e.className = cls; e.append(...kids); return e; };
  const total = (label: string, value: number | string) => { const d = document.createElement('div'); d.className = 'poc-total'; const b = document.createElement('b'); b.textContent = String(value); d.append(label, b); return d; };
  const render = () => {
    const r = opencoreProject(params);
    const maxCompanies = Math.max(1, ...r.rows.map((x) => x.companies));
    const verdict = opencoreVerdict(r);
    root.replaceChildren(
      h('div', 'poc-knobs', ...KNOBS.map((k) => {
        const input = document.createElement('input');
        input.type = 'range'; input.min = String(k.min); input.max = String(k.max); input.step = String(k.step); input.value = String(params[k.key]);
        const out = document.createElement('output');
        out.textContent = k.fmt(params[k.key]);
        input.oninput = () => { params[k.key] = Number(input.value) as never; out.textContent = k.fmt(Number(input.value)); render(); };
        return h('div', 'poc-knob', h('label', '', h('span', '', t(bi(k.label[0], k.label[1]))), out), input);
      })),
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
      h('p', 'poc-note', t(PRODUCT_HONEST_NOTE)),
    );
  };
  render();
  return { dispose() { root.remove(); style.remove(); }, describe: () => t(bi('Модель границы open-core с ползунками границы, широты бесплатной версии и цены, месячная проекция установок, платящих компаний, выручки и доверия.', 'An open-core boundary model with sliders for the boundary, free-version breadth and price, and a monthly projection of installs, paying companies, revenue and trust.')) };
}

export const opencoreWidget: WidgetReg = { id: 'product.opencore', mount: mountOpencore };
