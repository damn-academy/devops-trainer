// Flow, DORA and reliability metrics, computed from the run rather than
// stored, so the cumulative flow diagram, Little's law and DORA always agree
// (07 §8.6). These definitions are the Definition of Workflow of our board.

import type { Card, FlowMetrics, Scenario, State } from './types';

/** Nearest-rank percentile: sort, take the ceil(p·n)-th value. */
export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const v = [...values].sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.max(0, Math.ceil(p * v.length) - 1))];
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const v = [...values].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

const avg = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
const r2 = (x: number) => Math.round(x * 100) / 100;

/** Delivered work items of the board (not the operations lane). */
export function finished(s: State): Card[] {
  return s.cards.filter((c) => c.lane !== 'ops' && c.finishedDay !== undefined && c.startedDay !== undefined);
}

export const cycleTime = (c: Card) => c.finishedDay! - c.startedDay! + 1;
export const leadTime = (c: Card) => c.finishedDay! - c.createdDay + 1;
/** Age of a started, unfinished card on day d. */
export const age = (c: Card, d: number) => (c.startedDay === undefined ? 0 : d - c.startedDay + 1);

/** Throughput per day (delivered cards). */
export function throughputSeries(s: State): number[] {
  return s.history.map((h) => h.delivered);
}

/** Little's law check: average WIP vs average throughput × average cycle time over the run. */
export function little(s: State): { wip: number; th: number; ct: number; product: number; stable: boolean } {
  const wip = avg(s.history.map((h) => h.wip));
  const th = avg(throughputSeries(s));
  const ct = avg(finished(s).map(cycleTime));
  const first = s.history.slice(0, Math.ceil(s.history.length / 2)).map((h) => h.wip);
  const second = s.history.slice(Math.ceil(s.history.length / 2)).map((h) => h.wip);
  const stable = avg(second) <= avg(first) * 1.2 + 0.5;
  return { wip: r2(wip), th: r2(th), ct: r2(ct), product: r2(th * ct), stable };
}

export function metrics(s: State, sc: Scenario): FlowMetrics {
  const fin = finished(s);
  const cycles = fin.map(cycleTime);
  // The 85th percentile also counts cards still in progress at their current age: they have been
  // in work at least that long, and a run that finishes nothing must not look fast.
  const lastDayNo = s.history[s.history.length - 1]?.day ?? 0;
  const open = s.cards.filter((c) => c.lane !== 'ops' && c.startedDay !== undefined && c.finishedDay === undefined).map((c) => age(c, lastDayNo));
  const leads = fin.map(leadTime);
  const th = throughputSeries(s);
  const days = s.history.length;
  const sum = (a: number, b: number) => a + b;
  const thWin = (from: number, to: number) => {
    const w = s.history.filter((h) => h.day >= from && h.day <= to).map((h) => h.delivered);
    return w.length ? r2(w.reduce(sum, 0) / w.length) : 0;
  };
  const deploys = s.deploys;
  const planned = deploys.filter((d) => !d.unplanned);
  const lastDay = s.history[s.history.length - 1]?.day ?? 0;
  const recent = deploys.filter((d) => d.day > lastDay - 7);
  const deployIncidents = s.incidents.filter((i) => i.cause === 'deploy');
  const budgetMin = sc.slo ? (1 - sc.slo.target) * 30 * 1440 : 0;
  const bad = s.incidents.reduce((a, i) => a + i.badMinutes, 0);
  const saleBad = sc.sale ? s.incidents.filter((i) => i.day >= sc.sale!.from && i.day <= sc.sale!.to).reduce((a, i) => a + i.badMinutes, 0) : 0;
  const last10 = s.history.slice(-10);
  const opsCap = last10.reduce((a, h) => a + h.ops.capacity, 0);
  const opsBusy = last10.reduce((a, h) => a + h.ops.toil + h.ops.unplanned, 0);
  const promo = s.cards.filter((c) => c.tags?.includes('promo'));
  const promoByDue = promo.filter((c) => c.finishedDay !== undefined && c.finishedDay <= (c.dueDay ?? Infinity)).length;
  return {
    days,
    doneCount: fin.length,
    doneFeatures: fin.filter((c) => c.type === 'feature').length,
    wipAvg: r2(avg(s.history.map((h) => h.wip))),
    thAvg: r2(avg(th)),
    th1to5: thWin(1, 5),
    th6to10: thWin(6, 10),
    cycleAvg: r2(avg(cycles)),
    cycleP50: percentile(cycles, 0.5),
    cycleP85: percentile([...cycles, ...open], 0.85),
    leadP85: percentile(leads, 0.85),
    flowEfficiency: r2(avg(fin.map((c) => Math.min(1, c.workedDays / cycleTime(c))))),
    deploys: deploys.length,
    deployFreq7: days >= 7 ? recent.length : days ? r2((deploys.length / days) * 7) : 0,
    changeLeadMedianDays: r2(median(planned.flatMap((d) => d.leads))),
    cfr: planned.length ? r2(planned.filter((d) => d.failed).length / planned.length) : 0,
    recoveryMedianMin: r2(median(deployIncidents.map((i) => i.downtime))),
    reworkRate: deploys.length ? r2(deploys.filter((d) => d.unplanned).length / deploys.length) : 0,
    budgetMin: r2(budgetMin),
    budgetLeftMin: r2(budgetMin - bad),
    budgetLeftRatio: budgetMin ? r2((budgetMin - bad) / budgetMin) : 0,
    saleBadMinutes: r2(saleBad),
    codLost: Math.round(s.money.codLost),
    downtimeLost: Math.round(s.money.downtimeLost),
    moneyNet: Math.round(s.money.revenue - s.money.codLost - s.money.downtimeLost + s.money.extra),
    opsToilShare10: opsCap ? r2(opsBusy / opsCap) : 0,
    promoByDue,
    incidents: s.incidents.length,
  };
}

/** Cumulative flow: per day, cards that have reached each column or later (classic CFD lines). */
export function cfdSeries(s: State, sc: Scenario): { day: number; bands: Record<string, number> }[] {
  return s.history.map((h) => {
    const bands: Record<string, number> = {};
    for (const col of sc.columns) bands[col] = h.counts[col] ?? 0;
    return { day: h.day, bands };
  });
}
