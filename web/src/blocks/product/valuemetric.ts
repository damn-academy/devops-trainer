import { loadDraft, saveDraft } from '../../engine/trainers/storage';
// Value-metric chooser for the hidden "Продукт" pilot: pick the unit you
// charge for (node, user, gigabyte, million requests) and see how the
// revenue scales with the customer's growth and how predictable the bill
// stays. The model is deliberately simple and says so in the UI (the honest
// note is part of the widget, per the pilot requirement).

import { bi, t } from '../../core/i18n';
import type { Mounted, WidgetReg } from '../../core/types';

export type ValueMetricId = 'node' | 'user' | 'gb' | 'request';

export interface ValuemetricParams {
  metric: ValueMetricId;
  customers: number;
  /** Price per unit, thousands of rubles per month. */
  price: number;
  /** How many times the customer grows within a year. */
  growth: number;
}

export const VALUEMETRIC_DEFAULTS: ValuemetricParams = { metric: 'node', customers: 40, price: 0.8, growth: 3 };

export interface MetricSpec {
  id: ValueMetricId;
  label: [string, string];
  /** Units per customer today. */
  units: number;
  /** How the yearly bill scales with the customer's growth factor. */
  factor: (growth: number) => number;
  /** How predictable the bill stays, 0..100. */
  predictability: number;
  verdict: [string, string];
}

export const VALUE_METRICS: MetricSpec[] = [
  {
    id: 'node',
    label: ['За узел инфраструктуры', 'Per infrastructure node'],
    units: 20,
    factor: (g) => g,
    predictability: 90,
    verdict: [
      'Счёт растёт вместе с объёмом инфраструктуры клиента, и клиент заранее знает, сколько заплатит.',
      'The bill grows with the size of the customer’s infrastructure, and the customer knows in advance what they will pay.',
    ],
  },
  {
    id: 'user',
    label: ['За пользователя', 'Per user'],
    units: 8,
    factor: (g) => Math.sqrt(g),
    predictability: 65,
    verdict: [
      'Подходит продуктам, где ценность в людях; у инфраструктурного инструмента счёт отстанет от роста клиента.',
      'Fits products where value is in people; for an infrastructure tool the bill lags behind the customer’s growth.',
    ],
  },
  {
    id: 'gb',
    label: ['За гигабайт данных', 'Per gigabyte of data'],
    units: 6,
    factor: (g) => 1 + (g - 1) * 1.4,
    predictability: 40,
    verdict: [
      'Растёт быстрее успеха клиента, но счёт становится непредсказуемым, и каждый пик превращается в разговор о деньгах.',
      'Grows faster than the customer’s success, but the bill turns unpredictable and every spike becomes a money talk.',
    ],
  },
  {
    id: 'request',
    label: ['За миллион запросов в месяц', 'Per million requests per month'],
    units: 3,
    factor: (g) => 1 + (g - 1) * 0.85,
    predictability: 70,
    verdict: [
      'Связывает плату с использованием, но наказывает клиента за популярность его собственного сервиса.',
      'Ties payment to usage but punishes the customer for the popularity of their own service.',
    ],
  },
];

export interface MetricRow { id: ValueMetricId; mrrNow: number; mrrYear: number; predictability: number }
export interface ValuemetricResult { rows: MetricRow[]; chosen: MetricRow & { spec: MetricSpec } }

/** The deterministic projection the widget draws; extracted for tests. */
export function valuemetricProject(p: ValuemetricParams): ValuemetricResult {
  const rows: MetricRow[] = VALUE_METRICS.map((m) => {
    const mrrNow = p.customers * m.units * p.price;
    return { id: m.id, mrrNow: Math.round(mrrNow), mrrYear: Math.round(mrrNow * m.factor(p.growth)), predictability: m.predictability };
  });
  const spec = VALUE_METRICS.find((m) => m.id === p.metric)!;
  const chosenRow = rows.find((r) => r.id === p.metric)!;
  return { rows, chosen: { ...chosenRow, spec } };
}

const KNOBS: { key: 'customers' | 'price' | 'growth'; min: number; max: number; step: number; label: [string, string]; fmt: (v: number) => string }[] = [
  { key: 'customers', min: 5, max: 200, step: 1, label: ['Число клиентов', 'Number of customers'], fmt: (v) => String(v) },
  { key: 'price', min: 0.1, max: 5, step: 0.1, label: ['Цена за единицу, тыс ₽ в месяц', 'Price per unit, kRUB per month'], fmt: (v) => String(v) },
  { key: 'growth', min: 1, max: 5, step: 0.5, label: ['Рост клиента за год, во сколько раз', 'Customer growth per year, times'], fmt: (v) => `×${v}` },
];

let instance = 0;
const css = `
.pvm-results { display:grid;gap:14px;min-width:0; }
.pvm-formula {white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}
.pvm-root { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
.pvm-choice { display: flex; flex-wrap: wrap; gap: 6px; }
.pvm-choice button { border: 1px solid var(--line, #d8dee9); background: transparent; border-radius: 6px; padding: 5px 10px; font-size: 13px; cursor: pointer; }
.pvm-choice button.on { border-color: var(--accent, #2f6fdd); background: var(--accent, #2f6fdd); color: #fff; }
.pvm-knobs { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(230px, 100%), 1fr)); gap: 10px 18px; }
.pvm-knob label { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; }
.pvm-knob output { font-variant-numeric: tabular-nums; color: var(--accent, #2f6fdd); }
.pvm-knob input[type=range] { width: 100%; }
.pvm-totals { display: flex; flex-wrap: wrap; gap: 16px; }
.pvm-total b { display: block; font-size: 22px; font-variant-numeric: tabular-nums; }
.pvm-verdict { font-size: 13px; border-left: 3px solid var(--accent, #2f6fdd); padding: 6px 10px; }
.pvm-table-scroll { overflow:auto; }
.pvm-table { min-width:560px; width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
.pvm-table th, .pvm-table td { text-align: right; padding: 3px 8px; border-bottom: 1px solid var(--line, #d8dee9); }
.pvm-table th:nth-child(-n+2), .pvm-table td:nth-child(-n+2) { text-align: left; }
.pvm-table tr.on td { background: color-mix(in srgb, var(--accent, #2f6fdd) 8%, transparent); }
@media (max-width: 560px) {
  .pvm-table { min-width: 0; }
  .pvm-table thead { display: none; }
  .pvm-table tr { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 12px; padding: 6px 0; border-bottom: 1px solid var(--line, #d8dee9); }
  .pvm-table td { border: 0; padding: 0; text-align: left !important; }
  .pvm-table td:first-child { grid-column: 1 / -1; font-weight: 600; }
  .pvm-table td[data-label]::before { content: attr(data-label) ': '; color: var(--muted, #5a6577); }
}
.pvm-note { font-size: 13px; color: var(--muted, #5a6577); border-left: 3px solid var(--accent, #2f6fdd); padding: 6px 10px; }
`;

export function mountValuemetric(el: HTMLElement, _props: unknown): Mounted {
  const style = document.createElement('style');
  style.textContent = css;
  const root = document.createElement('div');
  root.className = 'pvm-root';
  el.append(style, root);
  const params: ValuemetricParams = { ...VALUEMETRIC_DEFAULTS, ...loadDraft<Partial<ValuemetricParams>>('product.valuemetric', {}) };
  const h = (tag: string, cls: string, ...kids: (Node | string)[]) => { const e = document.createElement(tag); if (cls) e.className = cls; e.append(...kids); return e; };
  const total = (label: string, value: number | string) => { const d = document.createElement('div'); d.className = 'pvm-total'; const b = document.createElement('b'); b.textContent = String(value); d.append(label, b); return d; };
  const cell = (label: string, value: number) => { const td = h('td', '', String(value)); td.dataset.label = label; return td; };
  const inputPrefix = `${++instance}-pvm`;
  const results = h('div', 'pvm-results');
  root.append(h('div', 'pvm-knobs', ...KNOBS.map((k) => {
        const input = document.createElement('input');
        input.type = 'range'; input.min = String(k.min); input.max = String(k.max); input.step = String(k.step); input.value = String(params[k.key]);
        const out = document.createElement('output');
        out.textContent = k.fmt(params[k.key]);
        input.oninput = () => { params[k.key] = Number(input.value) as never; out.textContent = k.fmt(Number(input.value)); render(); };
        input.setAttribute('aria-label', t(bi(k.label[0], k.label[1])));
        const label = h('label', '', h('span', '', t(bi(k.label[0], k.label[1]))), out);
        input.id = `${inputPrefix}-${k.key}`; label.setAttribute('for', input.id);
        return h('div', 'pvm-knob', label, input);
      })), results);
  const render = () => {
    saveDraft('product.valuemetric', params);
    const r = valuemetricProject(params);
    results.replaceChildren(
      h('div', 'pvm-choice', ...VALUE_METRICS.map((m) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = m.id === params.metric ? 'on' : '';
        b.textContent = t(bi(m.label[0], m.label[1]));
        b.onclick = () => { params.metric = m.id; render(); };
        return b;
      })),

      h('div', 'pvm-totals',
        total(t(bi('Выручка сейчас, тыс ₽ в месяц', 'Revenue now, kRUB per month')), r.chosen.mrrNow),
        total(t(bi('Выручка через год', 'Revenue in a year')), r.chosen.mrrYear),
        total(t(bi('Предсказуемость счёта из 100', 'Bill predictability out of 100')), r.chosen.predictability)),
      h('p', 'pvm-verdict', t(bi(r.chosen.spec.verdict[0], r.chosen.spec.verdict[1]))),
      h('div', 'pvm-table-scroll', h('table', 'pvm-table',
        h('thead', '', h('tr', '',
          h('th', '', t(bi('Метрика', 'Metric'))),
          h('th', '', t(bi('Сейчас', 'Now'))),
          h('th', '', t(bi('Через год', 'In a year'))),
          h('th', '', t(bi('Предсказуемость', 'Predictability'))))),
        h('tbody', '', ...r.rows.map((row) => {
          const m = VALUE_METRICS.find((x) => x.id === row.id)!;
          return h('tr', row.id === params.metric ? 'on' : '',
            h('td', '', t(bi(m.label[0], m.label[1]))),
            cell(t(bi('Сейчас', 'Now')), row.mrrNow),
            cell(t(bi('Через год', 'In a year')), row.mrrYear),
            cell(t(bi('Предсказуемость', 'Predictability')), row.predictability));
        })))),
      h('p', 'pvm-note', t(bi('Как считается таблица. Месячная выручка — число клиентов × сколько единиц метрики у одного клиента × цена единицы; число единиц на клиента для каждой метрики задано в модели. Через год выручка умножается на рост с поправкой, и поправка касается только прироста: при росте ×1 счёт не меняется ни у одной метрики. Для оплаты по пользователям рост берётся под корнем, потому что число людей растёт медленнее нагрузки; для гигабайтов прирост умножается на 1,4, потому что данные копятся быстрее нагрузки; для запросов — на 0,85, потому что часть роста клиента приходится на кэш и пакетную обработку. Например, при росте ×3 счёт за гигабайты вырастает в 1 + 2 × 1,4 = 3,8 раза. Предсказуемость счёта — постоянная учебная оценка для каждой метрики, ползунки её не меняют. Все поправки иллюстративные и не взяты из исследований.', 'How the table is computed. Monthly revenue is customers × units of the metric per customer × unit price; units per customer are fixed in the model per metric. Revenue in a year is multiplied by growth with an adjustment that applies only to the increase: at growth ×1 no metric’s bill changes. Per-user pricing takes the square root of growth because headcount grows slower than load; for gigabytes the increase is multiplied by 1.4 because data accumulates faster than load; for requests by 0.85 because part of the customer’s growth goes to caching and batch processing. For example, at growth ×3 the gigabyte bill grows 1 + 2 × 1.4 = 3.8 times. Bill predictability is a fixed teaching score per metric that the sliders do not change. All adjustments are illustrative, not taken from research.'))),
      h('pre', 'pvm-formula', VALUE_METRICS.map(m => `${t(bi(...m.label))}: ${params.customers} × ${m.units} × ${params.price} = ${Math.round(params.customers * m.units * params.price)}; × ${m.id === 'user' ? '√growth' : m.id === 'gb' ? '(1 + (growth − 1) × 1.4)' : m.id === 'request' ? '(1 + (growth − 1) × 0.85)' : 'growth'}; ${m.predictability}/100`).join('\n')),
    );
  };
  render();
  return { dispose() { root.remove(); style.remove(); }, describe: () => t(bi('Выбор метрики ценности с кнопками метрик и ползунками клиентов, цены и роста; сравнительная таблица выручки и предсказуемости счёта.', 'A value-metric chooser with metric buttons and sliders for customers, price and growth; a comparison table of revenue and bill predictability.')) };
}

export const valuemetricWidget: WidgetReg = { id: 'product.valuemetric', mount: mountValuemetric };
