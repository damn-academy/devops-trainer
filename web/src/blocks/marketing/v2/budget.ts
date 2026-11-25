import { bi, t } from '../../../core/i18n';
import type { WidgetReg } from '../../../core/types';
import './budget.css';

// TODO(prose): review all Russian UI drafts in this strings object.
export const strings = {
  title: bi('Бюджет каналов', 'Channel budget'),
  note: bi('Учебные допущения, не рыночные данные. Расходы повторяются 3 месяца; последствия показаны за 12 месяцев. Неиспользованный бюджет остаётся в резерве.', 'Teaching assumptions, not market data. Spend repeats for 3 months; consequences span 12 months. Unallocated budget stays in reserve.'),
  allocated: bi('Распределено / бюджет в месяц, USD', 'Allocated / monthly budget, USD'),
  single: bi('Один прогон', 'One run'), reset: bi('Сбросить', 'Reset'),
  legend: bi('Возможности продаж: медиана — сплошная линия; 10–90% — полоса; один прогон — пунктир.', 'Sales opportunities: median — solid line; 10–90% — band; one run — dashed line.'),
  month: bi('Месяц', 'Month'), total: bi('Накопленные возможности продаж (медиана и 10–90%)', 'Cumulative opportunities (median and 10–90%)'),
  channels: [bi('Спонсорство рассылки', 'Newsletter sponsorship'), bi('Спонсорство подкаста', 'Podcast sponsorship'), bi('Reddit Ads', 'Reddit Ads'), bi('LinkedIn Thought Leader Ads', 'LinkedIn Thought Leader Ads'), bi('LinkedIn Document Ads', 'LinkedIn Document Ads'), bi('Google Search: категория', 'Google Search: category'), bi('Google Search: конкуренты', 'Google Search: competitor names'), bi('EthicalAds / контекст', 'EthicalAds / contextual'), bi('Ретаргетинг', 'Retargeting'), bi('Спонсорство YouTube-автора', 'YouTube creator sponsorship')],
};

// Teaching assumptions only. capSpend / sampled cost sets the visit cap;
// activation and opportunity are beta(alpha, beta). Lag is whole months,
// decay is the retained fraction of each cohort's effect per later month.
export const CHANNELS = [
  { median: 9, spread: .35, capSpend: 4500, lag: 0, decay: .2, activation: [3, 27], opportunity: [3, 12] },
  { median: 14, spread: .5, capSpend: 5000, lag: 1, decay: .5, activation: [3, 22], opportunity: [3, 12] },
  { median: 7, spread: .6, capSpend: 4000, lag: 0, decay: .1, activation: [2, 28], opportunity: [2, 18] },
  { median: 20, spread: .4, capSpend: 5000, lag: 1, decay: .35, activation: [4, 21], opportunity: [4, 12] },
  { median: 17, spread: .4, capSpend: 4500, lag: 0, decay: .2, activation: [3, 22], opportunity: [3, 12] },
  { median: 12, spread: .35, capSpend: 6000, lag: 1, decay: .65, activation: [4, 21], opportunity: [4, 12] },
  { median: 22, spread: .45, capSpend: 3000, lag: 1, decay: .6, activation: [3, 22], opportunity: [3, 12] },
  { median: 8, spread: .35, capSpend: 3500, lag: 0, decay: .25, activation: [3, 27], opportunity: [3, 17] },
  { median: 5, spread: .3, capSpend: 2500, lag: 0, decay: 0, activation: [5, 20], opportunity: [4, 12] },
  { median: 11, spread: .6, capSpend: 6000, lag: 2, decay: .8, activation: [3, 22], opportunity: [3, 12] },
] as const;
export function seeded(seed: number): () => number {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let n = Math.imul(seed ^ seed >>> 15, 1 | seed); n ^= n + Math.imul(n ^ n >>> 7, 61 | n); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
const normal = (rng: () => number) => Math.sqrt(-2 * Math.log(Math.max(1e-12, rng()))) * Math.cos(2 * Math.PI * rng());
// Integer shape gamma sampling is exact for this table's beta parameters.
function gamma(shape: number, rng: () => number) { let sum = 0; for (let i = 0; i < shape; i++) sum -= Math.log(Math.max(1e-12, rng())); return sum; }
function beta(pair: readonly [number, number], rng: () => number) { const a = gamma(pair[0], rng); return a / (a + gamma(pair[1], rng)); }
export function saturatedVisits(spend: number, capSpend: number, cost: number) { return capSpend / cost * -Math.expm1(-Math.max(0, spend) / capSpend); }
export function runBudget(spends: readonly number[], rng = Math.random): number[] {
  const market = .6 + rng() * .7;
  const eventChannel = rng() < .2 ? Math.floor(rng() * CHANNELS.length) : -1;
  const visits = CHANNELS.map(() => Array<number>(12).fill(0));
  const rates = CHANNELS.map(c => beta(c.activation, rng) * beta(c.opportunity, rng));
  for (const [i, c] of CHANNELS.entries()) {
    const cost = c.median * Math.exp(c.spread * normal(rng)) * (i === eventChannel ? 1.4 : 1);
    const initial = saturatedVisits(spends[i] ?? 0, c.capSpend, cost) * market;
    for (let paid = 0; paid < 3; paid++) for (let month = paid + c.lag; month < 12; month++) visits[i]![month]! += initial * c.decay ** (month - paid - c.lag);
  }
  // Only visitors already delivered by other channels can be retargeted.
  let audience = 0;
  for (let month = 0; month < 12; month++) {
    audience = audience * .5 + visits.reduce((sum, row, i) => sum + (i === 8 ? 0 : row[month]!), 0);
    visits[8]![month] = Math.min(visits[8]![month]!, audience * .2);
  }
  return Array.from({ length: 12 }, (_, m) => visits.reduce((sum, row, i) => sum + row[m]! * rates[i]!, 0));
}
export function quantiles(values: number[]) { values.sort((a, b) => a - b); return [.1, .5, .9].map(p => values[Math.floor((values.length - 1) * p)]!); }
export function simulateBudget(spends: readonly number[], seed = 2026, runs = 300) {
  const rng = seeded(seed), paths = Array.from({ length: runs }, () => runBudget(spends, rng));
  return { months: Array.from({ length: 12 }, (_, m) => quantiles(paths.map(p => p[m]!))), totals: [3, 6, 12].map(n => quantiles(paths.map(p => p.slice(0, n).reduce((a, b) => a + b, 0)))) };
}

export const budgetWidget: WidgetReg = {
  id: 'marketing.budget',
  mount(el, props, ctx) {
    const proposed = (props as { total?: number } | null)?.total;
    const total = typeof proposed === 'number' && Number.isFinite(proposed) && proposed >= 0 ? proposed : 10000;
    const initial = () => CHANNELS.map(() => Math.min(10000, Math.floor(total / 10 / 250) * 250));
    let spends = initial(), single: number[] | undefined;
    el.classList.add('mkt-budget');
    const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '') => { const e = document.createElement(tag); e.textContent = text; return e; };
    el.append(node('h3', t(strings.title)), node('p', t(strings.note)));
    const allocated = node('p'); el.append(allocated);
    const inputs: HTMLInputElement[] = [], outputs: HTMLOutputElement[] = [];
    CHANNELS.forEach((_, i) => {
      const label = node('label'), name = node('span', t(strings.channels[i]!)), output = node('output');
      const input = node('input'); input.type = 'range'; input.min = '0'; input.max = '10000'; input.step = '250'; input.setAttribute('aria-label', t(strings.channels[i]!));
      input.oninput = () => { const other = spends.reduce((s, v, j) => s + (j === i ? 0 : v), 0); spends[i] = Math.min(Number(input.value), Math.floor(Math.max(0, total - other) / 250) * 250); single = undefined; draw(); ctx.complete(); };
      inputs.push(input); outputs.push(output); label.append(name, output, input); el.append(label);
    });
    const controls = node('div'); controls.className = 'mkt-budget-actions';
    const one = node('button', t(strings.single)), reset = node('button', t(strings.reset));
    for (const b of [one, reset]) { b.type = 'button'; b.className = 'btn'; controls.append(b); }
    const chart = node('div'), legend = node('p', t(strings.legend)), totals = node('div');
    el.append(controls, legend, chart, node('h4', t(strings.total)), totals);
    one.onclick = () => { single = runBudget(spends); draw(); ctx.complete(); };
    reset.onclick = () => { spends = initial(); single = undefined; draw(); };
    function draw() {
      inputs.forEach((input, i) => { input.value = String(spends[i]); outputs[i]!.value = `$${spends[i]}`; });
      allocated.textContent = `${t(strings.allocated)}: ${spends.reduce((a, b) => a + b, 0)} / ${total}`;
      const result = simulateBudget(spends);
      const max = Math.max(1, ...result.months.map(q => q[2]!), ...(single ?? []));
      const x = (i: number) => 42 + i * 62, y = (v: number) => 206 - v / max * 175;
      const points = (values: number[]) => values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
      const upper = result.months.map(q => q[2]!), lower = result.months.map(q => q[0]!);
      const band = [...upper.map((v, i) => `${x(i)},${y(v)}`), ...lower.map((v, i) => `${x(i)},${y(v)}`).reverse()].join(' ');
      chart.innerHTML = `<svg viewBox="0 0 760 250" role="img" aria-label="${t(strings.legend)}"><polygon points="${band}" fill="var(--focus)" fill-opacity=".25" stroke="var(--focus)" stroke-opacity=".55"/><polyline points="${points(result.months.map(q => q[1]!))}" fill="none" stroke="var(--link)" stroke-width="3"/>${single ? `<polyline points="${points(single)}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-dasharray="7 5"/>` : ''}<g fill="var(--ink)" font-size="18"><text x="2" y="25">${max.toFixed(0)}</text><text x="15" y="211">0</text>${[0, 2, 5, 8, 11].map(i => `<text x="${x(i)}" y="230" text-anchor="middle">${i + 1}</text>`).join('')}</g></svg>`;
      totals.replaceChildren(...result.totals.map((q, i) => node('p', `${t(strings.month)} ${[3, 6, 12][i]}: ${q[1]!.toFixed(1)} (${q[0]!.toFixed(1)}–${q[2]!.toFixed(1)})`)));
    }
    draw();
    return { dispose() { el.replaceChildren(); el.classList.remove('mkt-budget'); } };
  },
};
