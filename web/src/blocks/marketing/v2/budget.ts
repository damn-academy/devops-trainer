import { loadDraft, saveDraft } from '../../../engine/trainers/storage';
import { bi, t } from '../../../core/i18n';
import type { WidgetReg } from '../../../core/types';
import './budget.css';

export const strings = {
  title: bi('Распределение бюджета по каналам', 'Channel budget'),
  note: bi('Модель построена на учебных допущениях, близких к опубликованным отраслевым данным, и прогнозом для вашей компании не служит. Распределение повторяется три месяца подряд, а последствия видны на графике за двенадцать месяцев; нераспределённые деньги остаются в резерве.', 'Teaching assumptions, not market data. Spend repeats for 3 months; consequences span 12 months. Unallocated budget stays in reserve.'),
  allocated: bi('Распределено из месячного бюджета, долларов', 'Allocated / monthly budget, USD'),
  single: bi('Показать один прогон', 'One run'), reset: bi('Вернуть исходное распределение', 'Reset'),
  legend: bi('График показывает возможности сделок по месяцам. Сплошная линия — медиана трёхсот прогонов, полоса — разброс, в который попадают восемь прогонов из десяти, пунктир — один случайный прогон.', 'Sales opportunities: median — solid line; 10–90% — band; one run — dashed line.'),
  month: bi('Месяц', 'Month'), total: bi('Сколько возможностей сделок накопится, по медиане и разбросу восьми прогонов из десяти', 'Cumulative opportunities (median and 10–90%)'),
  funnel: bi('Как сужается воронка от квалифицированных посещений к активациям и возможностям сделок, медианы с накоплением', 'Qualified visits → activations → opportunities (cumulative medians)'),
  channels: [bi('Спонсорство рассылки', 'Newsletter sponsorship'), bi('Спонсорство подкаста', 'Podcast sponsorship'), bi('Reddit Ads', 'Reddit Ads'), bi('LinkedIn Thought Leader Ads', 'LinkedIn Thought Leader Ads'), bi('LinkedIn Document Ads', 'LinkedIn Document Ads'), bi('Поиск Google по категории', 'Google Search: category'), bi('Поиск Google по названиям конкурентов', 'Google Search: competitor names'), bi('EthicalAds и другая контекстная реклама', 'EthicalAds / contextual'), bi('Ретаргетинг', 'Retargeting'), bi('Спонсорство автора на YouTube', 'YouTube creator sponsorship')],
};

// Teaching calibration, not a forecast. CPL anchors: course research, Metadata
// 2026 (LinkedIn ~$200, Search ~$520, retargeting ~$196). Activations are leads.
// Qualified-visit cost = CPL * mean activation rate, before saturation/market fit.
// capSpend is the monthly audience saturation scale; beta pairs model uncertain
// conversion rates. Lag/decay distribute a cohort's lifetime effect, not extra leads.
export const CHANNELS = [
  // Newsletter: a small, well-matched technical audience; few leads, 15% accepted.
  { cpl: 130, spread: .35, capSpend: 6000, lag: 0, decay: .2, activation: [3, 27], opportunity: [3, 17], incrementality: 1 },
  // Podcast: scarce trusted placements, slower response and 15% acceptance.
  { cpl: 160, spread: .5, capSpend: 6000, lag: 1, decay: .5, activation: [3, 27], opportunity: [3, 17], incrementality: 1 },
  // Reddit: inexpensive attention but weak infrastructure buying intent; 5% accepted.
  { cpl: 400, spread: .6, capSpend: 2500, lag: 0, decay: .1, activation: [2, 38], opportunity: [2, 38], incrementality: 1 },
  // Thought Leader: LinkedIn's ~$200 CPL with strong expert/audience fit; 15% accepted.
  { cpl: 200, spread: .4, capSpend: 6000, lag: 1, decay: .35, activation: [4, 36], opportunity: [3, 17], incrementality: 1 },
  // Document: ~$200 CPL, but downloads seldom indicate a buying project; 5% accepted.
  { cpl: 200, spread: .4, capSpend: 3000, lag: 0, decay: .2, activation: [3, 27], opportunity: [2, 38], incrementality: 1 },
  // Category Search: ~$520 CPL; explicit intent gives 12% acceptance, limited volume.
  { cpl: 520, spread: .35, capSpend: 3500, lag: 1, decay: .35, activation: [4, 36], opportunity: [3, 22], incrementality: 1 },
  // Competitor Search: benchmark CPL with a switching premium; 8% accepted.
  { cpl: 650, spread: .45, capSpend: 2000, lag: 1, decay: .3, activation: [3, 37], opportunity: [2, 23], incrementality: 1 },
  // Contextual: technical readers, few active buyers; 5% acceptance and modest reach.
  { cpl: 380, spread: .35, capSpend: 3000, lag: 0, decay: .25, activation: [3, 47], opportunity: [2, 38], incrementality: 1 },
  // Retargeting: ~$196 CPL, 10% acceptance; only 5% incremental, existing audience only.
  { cpl: 196, spread: .3, capSpend: 1500, lag: 0, decay: 0, activation: [5, 20], opportunity: [2, 18], incrementality: .05 },
  // Creator: trusted niche demos, 15% accepted; long tail shifts delivery past month 3.
  { cpl: 170, spread: .6, capSpend: 6000, lag: 2, decay: .8, activation: [3, 27], opportunity: [3, 17], incrementality: 1 },
] as const;
export function seeded(seed: number): () => number {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let n = Math.imul(seed ^ seed >>> 15, 1 | seed); n ^= n + Math.imul(n ^ n >>> 7, 61 | n); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
}
const normal = (rng: () => number) => Math.sqrt(-2 * Math.log(Math.max(1e-12, rng()))) * Math.cos(2 * Math.PI * rng());
// Integer shape gamma sampling is exact for this table's beta parameters.
function gamma(shape: number, rng: () => number) { let sum = 0; for (let i = 0; i < shape; i++) sum -= Math.log(Math.max(1e-12, rng())); return sum; }
function beta(pair: readonly [number, number], rng: () => number) { const a = gamma(pair[0], rng); return a / (a + gamma(pair[1], rng)); }
export function saturatedVisits(spend: number, capSpend: number, cost: number) { return capSpend / cost * -Math.expm1(-Math.max(0, spend) / capSpend); }
export function runBudgetFunnel(spends: readonly number[], rng = Math.random) {
  // Shared market-fit uncertainty: diversifying channels cannot remove product risk.
  const market = 1.65 * beta([1, 2], rng);
  const eventChannel = rng() < .2 ? Math.floor(rng() * CHANNELS.length) : -1;
  const visits = CHANNELS.map(() => Array<number>(12).fill(0));
  const rates = CHANNELS.map(c => ({ activation: beta(c.activation, rng), opportunity: beta(c.opportunity, rng) }));
  for (const [i, c] of CHANNELS.entries()) {
    const cost = (c.cpl * c.activation[0] / (c.activation[0] + c.activation[1])) * Math.exp(c.spread * normal(rng)) * (i === eventChannel ? 1.4 : 1);
    const initial = saturatedVisits(spends[i] ?? 0, c.capSpend, cost) * market;
    for (let paid = 0; paid < 3; paid++) for (let month = paid + c.lag; month < 12; month++) visits[i]![month]! += initial * (1 - c.decay) * c.decay ** (month - paid - c.lag);
  }
  // Only visitors already delivered by other channels can be retargeted.
  let audience = 0;
  for (let month = 0; month < 12; month++) {
    audience = audience * .5 + visits.reduce((sum, row, i) => sum + (i === 8 ? 0 : row[month]!), 0);
    visits[8]![month] = Math.min(visits[8]![month]!, audience * .2);
  }
  const qualifiedVisits = Array<number>(12).fill(0), activations = [...qualifiedVisits], opportunities = [...qualifiedVisits];
  for (const [i, row] of visits.entries()) for (let m = 0; m < 12; m++) {
    // Count incremental visits/leads only, so retargeting does not claim organic demand.
    const incremental = row[m]! * CHANNELS[i]!.incrementality;
    qualifiedVisits[m]! += incremental;
    activations[m]! += incremental * rates[i]!.activation;
    opportunities[m]! += incremental * rates[i]!.activation * rates[i]!.opportunity;
  }
  return { qualifiedVisits, activations, opportunities };
}
export function runBudget(spends: readonly number[], rng = Math.random): number[] {
  return runBudgetFunnel(spends, rng).opportunities;
}
export function quantiles(values: number[]) { values.sort((a, b) => a - b); return [.1, .5, .9].map(p => values[Math.floor((values.length - 1) * p)]!); }
export function simulateBudget(spends: readonly number[], seed = 2026, runs = 300) {
  const rng = seeded(seed), paths = Array.from({ length: runs }, () => runBudgetFunnel(spends, rng));
  const totalsFor = (key: keyof ReturnType<typeof runBudgetFunnel>) => [3, 6, 12].map(n => quantiles(paths.map(p => p[key].slice(0, n).reduce((a, b) => a + b, 0))));
  return {
    months: Array.from({ length: 12 }, (_, m) => quantiles(paths.map(p => p.opportunities[m]!))),
    totals: totalsFor('opportunities'),
    qualifiedVisits: totalsFor('qualifiedVisits'),
    activations: totalsFor('activations'),
  };
}

export const budgetWidget: WidgetReg = {
  id: 'marketing.budget',
  mount(el, props, ctx) {
    const proposed = (props as { total?: number } | null)?.total;
    const total = typeof proposed === 'number' && Number.isFinite(proposed) && proposed >= 0 ? proposed : 10000;
    const initial = () => CHANNELS.map(() => Math.min(10000, Math.floor(total / 10 / 250) * 250));
    const key = `marketing.budget.v1.${total}`;
    let spends = loadDraft(key, initial());
    if (spends.length !== CHANNELS.length || spends.some(v => !Number.isFinite(v) || v < 0 || v > 10000) || spends.reduce((a,b) => a+b,0) > total) spends = initial();
    let single: number[] | undefined;
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
    const chart = node('div'), legend = node('p', t(strings.legend)), totals = node('div'), funnel = node('div');
    funnel.className = 'mkt-budget-funnel';
    el.append(controls, legend, chart, node('h4', t(strings.total)), totals, node('h4', t(strings.funnel)), funnel);
    one.onclick = () => { single = runBudget(spends); draw(); ctx.complete(); };
    reset.onclick = () => { spends = initial(); single = undefined; draw(); };
    function draw() {
      saveDraft(key, spends);
      inputs.forEach((input, i) => { input.value = String(spends[i]); outputs[i]!.value = `$${spends[i]}`; });
      allocated.textContent = `${t(strings.allocated)}: ${spends.reduce((a, b) => a + b, 0)} / ${total}`;
      const result = simulateBudget(spends);
      const max = Math.max(1, ...result.months.map(q => q[2]!), ...(single ?? []));
      const x = (i: number) => 42 + i * 62, y = (v: number) => 206 - v / max * 175;
      const points = (values: number[]) => values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
      const upper = result.months.map(q => q[2]!), lower = result.months.map(q => q[0]!);
      const band = [...upper.map((v, i) => `${x(i)},${y(v)}`), ...lower.map((v, i) => `${x(i)},${y(v)}`).reverse()].join(' ');
      chart.innerHTML = `<svg viewBox="0 0 760 250" role="img" aria-label="${t(strings.legend)}"><polygon points="${band}" fill="var(--focus)" fill-opacity=".25" stroke="var(--focus)" stroke-opacity=".55"/><polyline points="${points(result.months.map(q => q[1]!))}" fill="none" stroke="var(--link)" stroke-width="3"/>${single ? `<polyline points="${points(single)}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-dasharray="7 5"/>` : ''}<g fill="var(--ink)" font-size="18"><text x="2" y="25">${max.toFixed(0)}</text><text x="15" y="211">0</text>${[0, 2, 5, 8, 11].map(i => `<text x="${x(i)}" y="230" text-anchor="middle">${i + 1}</text>`).join('')}</g></svg>`;
      funnel.replaceChildren(...result.qualifiedVisits.map((q, i) => node('p', `${t(strings.month)} ${[3, 6, 12][i]}: ${q[1]!.toFixed(0)} → ${result.activations[i]![1]!.toFixed(1)} → ${result.totals[i]![1]!.toFixed(1)}`)));
      totals.replaceChildren(...result.totals.map((q, i) => node('p', `${t(strings.month)} ${[3, 6, 12][i]}: ${q[1]!.toFixed(1)} (${q[0]!.toFixed(1)}–${q[2]!.toFixed(1)})`)));
    }
    draw();
    return { dispose() { el.replaceChildren(); el.classList.remove('mkt-budget'); } };
  },
};
