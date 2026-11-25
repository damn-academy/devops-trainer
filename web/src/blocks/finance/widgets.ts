import { bi, lang, t } from '../../core/i18n';
import type { WidgetReg } from '../../core/types';

export interface RoundInput { founder: number; safes: { amount: number; cap: number }[]; round: number; valuation: number; poolPercent: number; existingPool: number }
export const ROUND_DEFAULTS: RoundInput = { founder: 8_000_000, safes: [{ amount: 1_000_000, cap: 10_000_000 }, { amount: 500_000, cap: 10_000_000 }], round: 5_000_000, valuation: 20_000_000, poolPercent: 10, existingPool: 0 };
export function roundNumbers(p: RoundInput) {
  if (![p.founder, p.round, p.valuation].every(n => Number.isFinite(n) && n > 0) || !Number.isFinite(p.existingPool) || p.existingPool < 0 || !Number.isFinite(p.poolPercent) || p.poolPercent < 0 || p.safes.length > 3 || p.safes.some(s => !Number.isFinite(s.amount) || s.amount < 0 || !Number.isFinite(s.cap) || s.cap <= 0)) throw new Error('inputs');
  const fractions = p.safes.map(s => s.amount / s.cap);
  const safeTotal = fractions.reduce((a, b) => a + b, 0);
  const investor = p.round / (p.valuation + p.round);
  const target = p.poolPercent / 100 / (1 - investor);
  if (safeTotal >= 1 || target >= 1) throw new Error('ownership');
  const total = (p.founder + p.existingPool) / (1 - safeTotal);
  const shares = [p.founder, ...fractions.map(f => f * total), p.existingPool, 0];
  const extraPool = Math.max(0, (target * total - p.existingPool) / (1 - target));
  const stage = (extra: number, investment: boolean) => {
    const pre = total + extra;
    const price = p.valuation / pre;
    const newShares = investment ? p.round / price : 0;
    const quantities = shares.map((s, i) => i === shares.length - 2 ? s + extra : i === shares.length - 1 ? newShares : s);
    return { ownership: quantities.map(s => 100 * s / (pre + newShares)), price, newShares, shares: quantities };
  };
  // The cap-only equations are valid only while every nonzero SAFE's cap binds.
  // Check both displayed round variants; a pool top-up can lower the round price.
  const lowestRoundPrice = p.valuation / (total + extraPool);
  if (p.safes.some(s => s.amount > 0 && lowestRoundPrice < s.cap / total - Number.EPSILON * Math.max(1, lowestRoundPrice))) throw new Error('cap-not-binding');
  return { before: stage(0, false), withoutPool: stage(0, true), withPool: stage(extraPool, true) };
}
export interface FranchiseInput { authorized: number; issued: number; par: number; assets: number }
export const FRANCHISE_DEFAULTS: FranchiseInput = { authorized: 10_000_000, issued: 8_000_000, par: 0.00001, assets: 2_000_000 };
export function franchiseNumbers(p: FranchiseInput) {
  if (![p.authorized, p.issued].every(n => Number.isSafeInteger(n) && n > 0) || p.issued > p.authorized || !Number.isFinite(p.par) || p.par <= 0 || !Number.isFinite(p.assets) || p.assets < 0) throw new Error('inputs');
  const authorized = Math.min(200_000, p.authorized <= 5000 ? 175 : p.authorized <= 10000 ? 250 : 250 + Math.ceil((p.authorized - 10000) / 10000) * 85);
  const assumed = Math.min(200_000, Math.max(400, Math.ceil(Math.max(p.assets / p.issued, p.par) * p.authorized / 1_000_000) * 400));
  const tax = Math.min(authorized, assumed);
  return { authorized, assumed, tax, fee: 50, total: tax + 50, instalments: tax >= 5000 };
}
const label = (ru: string, en: string) => t(bi(ru, en));
// Format only at the display boundary; calculations retain their full precision.
const fmt = (n: number, maximumFractionDigits = 0) => new Intl.NumberFormat(
  lang() === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits },
).format(Math.round((n + Math.sign(n) * Number.EPSILON * Math.max(1, Math.abs(n))) * 10 ** maximumFractionDigits) / 10 ** maximumFractionDigits).replace(/\u00a0/g, '\u202f');
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '') => { const e = document.createElement(tag); e.textContent = text; return e; };
function shell(el: HTMLElement, title: string) {
  const root = node('section'); root.className = 'finance-trainer';
  const style = node('style', '.finance-trainer{padding:20px;border:1px solid var(--border,#8885);border-radius:12px;min-width:0}.finance-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:14px;margin:16px 0}.finance-fields label{display:grid;gap:6px}.finance-fields input{width:100%;min-width:0;box-sizing:border-box;padding:8px;font:inherit;color:inherit;background:transparent;border:1px solid #8888;border-radius:5px}.finance-result{overflow-x:auto}.finance-result table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}.finance-result th,.finance-result td{text-align:left;padding:9px;border-bottom:1px solid #8885}.finance-result th{white-space:normal;min-width:100px}.finance-trainer button{margin:8px 0;padding:8px;font:inherit}.finance-trainer p{overflow-wrap:anywhere}@media(max-width:480px){.finance-result table{table-layout:fixed;font-size:12px}.finance-result th,.finance-result td{min-width:0;padding:7px 3px;overflow-wrap:anywhere}.finance-trainer{padding:14px}}');
  root.append(style, node('h3', title));
  const fields = node('div'); fields.className = 'finance-fields';
  const result = node('div'); result.className = 'finance-result'; result.setAttribute('aria-live', 'polite');
  root.append(fields, result); el.append(root);
  const input = (ru: string, en: string, value: number, set: (n: number) => void, min = 0, step = 'any') => {
    const l = node('label', label(ru, en)); const i = node('input'); i.type = 'number'; i.value = String(value); i.min = String(min); i.step = step;
    i.addEventListener('input', () => set(i.valueAsNumber)); l.append(i); fields.append(l);
  };
  return { root, fields, result, input };
}
function table(headers: string[], rows: string[][]) {
  const tbl = node('table'); const head = node('thead'); const tr = node('tr');
  headers.forEach(s => { const th = node('th', s); th.scope = 'col'; tr.append(th); }); head.append(tr); tbl.append(head);
  const body = node('tbody'); rows.forEach(row => { const r = node('tr'); row.forEach((s, i) => { const c = node(i ? 'td' : 'th', s); if (c instanceof HTMLTableCellElement && !i) c.scope = 'row'; r.append(c); }); body.append(r); }); tbl.append(body); return tbl;
}
const invalid = () => node('p', label('Проверьте значения: положительные суммы и оценки; доли SAFE и целевой пул должны оставлять долю основателю. Число выпущенных акций не может превышать разрешённое.', 'Check the inputs: positive amounts and valuations; SAFE ownership and the target pool must leave founder ownership. Issued shares cannot exceed authorized shares.'));
export const roundWidget: WidgetReg = { id: 'finance.round', mount(el) {
  const p = structuredClone(ROUND_DEFAULTS);
  const ui = shell(el, label('SAFE, раунд и пул опционов', 'SAFEs, round and option pool'));
  const render = () => {
    ui.result.replaceChildren();
    try {
      const r = roundNumbers(p);
      const names = [label('Основатель', 'Founder'), ...p.safes.map((_, i) => `SAFE ${i + 1}`), label('Невыданный пул', 'Unallocated pool'), label('Новый инвестор', 'New investor')];
      ui.result.append(table(['', label('Доли до раунда', 'Ownership before the round'), label('После раунда без пула', 'After the round without pool'), label('После раунда с пулом', 'After the round with pool')], names.map((n, i) => [n, ...[r.before, r.withoutPool, r.withPool].map(s => fmt(s.ownership[i], 1) + ' %')]).concat([
        [label('Цена акции раунда', 'Round share price'), '—', fmt(r.withoutPool.price, 6), fmt(r.withPool.price, 6)],
        [label('Новые акции инвестора', 'New investor shares'), '—', fmt(r.withoutPool.newShares), fmt(r.withPool.newShares)],
      ])));
    } catch (e) { ui.result.append(e instanceof Error && e.message === 'cap-not-binding' ? node('p', label('Цена раунда ниже цены по потолку SAFE. Этот калькулятор не считает такую конвертацию. Результат скрыт.', 'The round price is below a SAFE cap price. This calculator does not support that conversion. The result is hidden.')) : invalid()); }
  };
  const fields = () => {
    ui.fields.replaceChildren();
    ui.input('Акции основателя', 'Founder shares', p.founder, n => { p.founder = n; render(); }, 1, '1');
    p.safes.forEach((s, i) => {
      ui.input(`SAFE: сумма (${i + 1})`, `SAFE: amount (${i + 1})`, s.amount, n => { s.amount = n; render(); });
      ui.input(`SAFE: потолок оценки после денег (${i + 1})`, `SAFE: post-money valuation cap (${i + 1})`, s.cap, n => { s.cap = n; render(); });
      const remove = node('button', label(`Удалить SAFE ${i + 1}`, `Remove SAFE ${i + 1}`)); remove.type = 'button';
      remove.onclick = () => { p.safes.splice(i, 1); add.disabled = false; fields(); render(); }; ui.fields.append(remove);
    });
    ui.input('Раунд: сумма', 'Round: amount', p.round, n => { p.round = n; render(); });
    ui.input('Оценка до денег', 'Pre-money valuation', p.valuation, n => { p.valuation = n; render(); });
    ui.input('Пул опционов после раунда, %', 'Post-round option pool, %', p.poolPercent, n => { p.poolPercent = n; render(); });
    ui.input('Существующий пул, акций', 'Existing pool, shares', p.existingPool, n => { p.existingPool = n; render(); }, 0, '1');
  };
  const add = node('button', label('Добавить SAFE', 'Add SAFE')); add.type = 'button';
  add.onclick = () => { if (p.safes.length < 3) p.safes.push({ amount: 0, cap: 10_000_000 }); add.disabled = p.safes.length >= 3; fields(); render(); };
  ui.root.insertBefore(add, ui.result);
  ui.root.append(node('p', label('Расчёт для post-money SAFE, где срабатывает потолок оценки, без скидок, других конвертируемых бумаг и права на долю в следующих раундах. Реальные документы считают юристы по своим формулам.', 'Calculation for post-money SAFEs where the valuation cap applies, without discounts, other convertible securities or pro rata rights in later rounds. Lawyers calculate actual documents using their specific formulas.')));
  fields(); render(); return { dispose: () => ui.root.remove() };
} };
export const franchiseWidget: WidgetReg = { id: 'finance.franchise', mount(el) {
  const p = { ...FRANCHISE_DEFAULTS }; const ui = shell(el, label('Франшизный налог Делавэра', 'Delaware franchise tax'));
  const render = () => {
    ui.result.replaceChildren();
    try {
      const r = franchiseNumbers(p);
      ui.result.append(table(['', '$'], [
        [label('Метод по числу акций', 'Authorized shares method'), fmt(r.authorized)],
        [label('Метод условного номинального капитала', 'Assumed par value capital method'), fmt(r.assumed)],
        [label('К уплате (меньший метод)', 'Tax due (lower method)'), fmt(r.tax)],
        [label('Сбор за годовой отчёт', 'Annual report fee'), fmt(r.fee)],
        [label('Всего со сбором', 'Total including fee'), fmt(r.total)],
      ]), node('p', r.instalments ? label('Платить частями: 40 % к 1 июня, по 20 % к 1 сентября и 1 декабря, остаток к 1 марта', 'Pay instalments: 40% by June 1, 20% each by September 1 and December 1, the remainder by March 1') : label(`Рассрочка не требуется: налог меньше ${fmt(5000)} долларов.`, `Instalments are not required: tax is below $${fmt(5000)}.`)));
    } catch { ui.result.append(invalid()); }
  };
  ui.input('Разрешённые к выпуску акции', 'Authorized shares', p.authorized, n => { p.authorized = n; render(); }, 1, '1');
  ui.input('Выпущенные акции', 'Issued shares', p.issued, n => { p.issued = n; render(); }, 1, '1');
  ui.input('Номинал акции, $', 'Par value per share, $', p.par, n => { p.par = n; render(); });
  ui.input('Валовые активы, $', 'Gross assets, $', p.assets, n => { p.assets = n; render(); });
  ui.root.append(node('p', label('Упрощённый расчёт для одного класса акций с номиналом. При нескольких классах акций и акциях без номинала используйте официальный калькулятор Делавэра.', 'Simplified calculation for a single class of par-value shares. For multiple classes and no-par shares, use Delaware’s official calculator.')));
  render(); return { dispose: () => ui.root.remove() };
} };
