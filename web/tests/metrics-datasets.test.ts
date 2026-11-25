import metrics from '../src/blocks/metrics';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const names = ['metrics-cohorts', 'metrics-pipeline', 'metrics-forecast', 'metrics-arr', 'metrics-arr-start', 'metrics-ab'];
function csv(name: string) {
  const [header, ...rows] = readFileSync(`public/templates/${name}.csv`, 'utf8').trim().split('\n');
  return rows.map(row => Object.fromEntries(header.split(',').map((key, i) => [key, row.split(',')[i]])));
}
const sum = (rows: Record<string, string>[], key: string) => rows.reduce((total, row) => total + Number(row[key]), 0);
function answer(name: string, actual: Record<string, unknown>) {
  const expected = JSON.parse(readFileSync(`src/blocks/metrics/answers/${name}.json`, 'utf8'));
  function compare(a: unknown, e: unknown) {
    if (typeof e === 'number') expect(a).toBeCloseTo(e, 12);
    else if (e !== null && typeof e === 'object') {
      expect(Object.keys(a as object).sort()).toEqual(Object.keys(e).sort());
      for (const key of Object.keys(e)) compare((a as Record<string, unknown>)[key], (e as Record<string, unknown>)[key]);
    } else expect(a).toEqual(e);
  }
  compare(actual, expected);
}
it('ships identical RU/EN synthetic CSV data', () => {
  for (const name of names) expect(readFileSync(`public/templates/${name}-en.csv`, 'utf8')).toBe(readFileSync(`public/templates/${name}.csv`, 'utf8'));
});
it('recomputes every cohort answer with explicit maturity windows', () => {
  const all = csv('metrics-cohorts'), rows = all.filter(r => r.is_internal === '0');
  expect(all).toHaveLength(600);
  const snapshot = '2026-07-01';
  const age = (date: string, from: string) => (Date.parse(date) - Date.parse(from)) / 86400000;
  const mature = (r: Record<string, string>, days: number) => age(snapshot, r.signup_date) >= days;
  const cohorts = (months: number, days: number, field: string, label: string) =>
    Object.fromEntries(Array.from({ length: months }, (_, i) => {
      const month = `2026-${String(i + 1).padStart(2, '0')}`;
      const eligible = rows.filter(r => r.signup_date.startsWith(month) && mature(r, days));
      const successes = eligible.filter(r => r[field] && age(r[field], r.signup_date) >= 0 && age(r[field], r.signup_date) <= days).length;
      return [month, { eligible: eligible.length, [label]: successes, rate: eligible.length ? successes / eligible.length : null }];
    }));
  for (const r of rows) for (const field of ['activated_at','pqa_at','first_opp_at','won_at','lost_at']) {
    if (r[field]) expect(r[field] >= r.signup_date && r[field] <= snapshot).toBe(true);
  }
  answer('metrics-cohorts', {
    snapshot, internal_excluded: all.length - rows.length,
    activation_14d: cohorts(6,14,'activated_at','activated'),
    activation_immature_excluded: rows.filter(r => !mature(r,14)).length,
    conversion_180d: cohorts(3,180,'won_at','won'),
    conversion_immature_excluded: rows.filter(r => r.signup_date < '2026-04-01' && !mature(r,180)).length,
  });
});
it('recomputes coverage, win rates and slippage without double-counting snapshots', () => {
  const rows = csv('metrics-pipeline');
  expect(new Set(rows.map(r => r.opp_id + r.snapshot_date)).size).toBe(rows.length);
  const q3 = rows.filter(r => r.snapshot_date === '2026-09-30' && r.close_date >= '2026-07-01' && r.close_date <= '2026-09-30');
  const won = sum(q3.filter(r => r.category === 'closed_won'), 'amount_usd');
  const open = sum(q3.filter(r => ['pipeline','best_case','commit'].includes(r.category)), 'amount_usd');
  const closed = rows.filter(r => r.snapshot_date === '2026-06-30' && r.close_date <= '2026-06-30' && r.close_date >= '2026-01-01');
  const wins = closed.filter(r => r.category === 'closed_won'), losses = closed.filter(r => r.category === 'closed_lost');
  const wv = sum(wins,'amount_usd'), lv = sum(losses,'amount_usd');
  const base = rows.filter(r => r.snapshot_date === '2026-03-31' && r.close_date >= '2026-04-01' && r.close_date <= '2026-06-30' && !r.category.startsWith('closed_'));
  const slipped = base.filter(r => {
    const next = rows.find(n => n.opp_id === r.opp_id && n.snapshot_date === '2026-06-30');
    expect(next).toBeDefined();
    return next!.close_date > '2026-06-30';
  });
  answer('metrics-pipeline', {
    q3_target:1000000,q3_won:won,q3_remaining_target:1000000-won,q3_open_pipeline:open,q3_coverage:open/(1000000-won),
    q1_q2_won_count:wins.length,q1_q2_lost_count:losses.length,q1_q2_won_value:wv,q1_q2_lost_value:lv,
    count_win_rate:wins.length/(wins.length+losses.length),value_win_rate:wv/(wv+lv),
    q2_slippage_base_count:base.length,q2_slippage_count:slipped.length,q2_slippage_share:slipped.length/base.length,
    q2_slippage_base_value:sum(base,'amount_usd'),q2_slippage_value:sum(slipped,'amount_usd'),q2_slippage_value_share:sum(slipped,'amount_usd')/sum(base,'amount_usd'),
  });
});
it('recomputes forecast bias/WAPE and reconciles actuals to pipeline', () => {
  const rows = csv('metrics-forecast'), pipeline = csv('metrics-pipeline');
  const errors = rows.map(r => Number(r.forecast_d30_usd)-Number(r.actual_usd));
  rows.forEach((r,i) => {
    const end = ['2026-03-31','2026-06-30','2026-09-30','2026-12-31'][i];
    const start = `2026-${String(i*3+1).padStart(2,'0')}-01`;
    expect(sum(pipeline.filter(p => p.snapshot_date === end && p.category === 'closed_won' && p.close_date >= start && p.close_date <= end),'amount_usd')).toBe(Number(r.actual_usd));
  });
  const actual = sum(rows,'actual_usd');
  answer('metrics-forecast',{errors,forecast_total:sum(rows,'forecast_d30_usd'),actual_total:actual,
    bias:errors.reduce((a,b)=>a+b,0)/actual,wape:errors.reduce((a,b)=>a+Math.abs(b),0)/actual});
});
it('recomputes ARR bridge, retention and logo churn from account balances', () => {
  const starts = csv('metrics-arr-start'), moves = csv('metrics-arr');
  const balances = new Map(starts.map(r => [r.account_id,Number(r.starting_arr_usd)]));
  const startingIds = new Set(balances.keys());
  for (const r of moves) {
    expect(r.month.startsWith('2025-')).toBe(true);
    const delta = Number(r.arr_delta_usd);
    expect(['churn','contraction'].includes(r.movement) ? delta < 0 : delta > 0).toBe(true);
    balances.set(r.account_id,(balances.get(r.account_id) ?? 0)+delta);
    expect(balances.get(r.account_id)).toBeGreaterThanOrEqual(0);
  }
  const total = (kind: string) => sum(moves.filter(r => r.movement === kind),'arr_delta_usd');
  const start = sum(starts,'starting_arr_usd'), end = [...balances.values()].reduce((a,b)=>a+b,0);
  const churned = starts.filter(r => balances.get(r.account_id) === 0).length;
  const existingExpansion = sum(moves.filter(r => r.movement === 'expansion' && startingIds.has(r.account_id)),'arr_delta_usd');
  expect(start+sum(moves,'arr_delta_usd')).toBe(end);
  answer('metrics-arr-start',{starting_logos:starts.length,starting_arr:start});
  answer('metrics-arr',{start,new:total('new'),expansion:total('expansion'),contraction:total('contraction'),churn:total('churn'),end,
    grr:(start+total('contraction')+total('churn'))/start,nrr:(start+existingExpansion+total('contraction')+total('churn'))/start,
    starting_logos:starts.length,churned_logos:churned,logo_churn:churned/starts.length});
});
it('recomputes experiment conversions, lifts and the unpooled normal CI', () => {
  const rows = csv('metrics-ab'), c = rows.filter(r => r.group === 'control'), t = rows.filter(r => r.group === 'treatment');
  expect(new Set(rows.map(r=>r.account_id)).size).toBe(7800);
  expect(rows.every(r => ['0','1'].includes(r.converted))).toBe(true);
  const cc = sum(c,'converted'), tc = sum(t,'converted'), pc = cc/c.length, pt = tc/t.length;
  const d = pt-pc, margin = 1.96*Math.sqrt(pc*(1-pc)/c.length+pt*(1-pt)/t.length);
  answer('metrics-ab',{control_n:c.length,treatment_n:t.length,control_conversions:cc,treatment_conversions:tc,
    control_rate:pc,treatment_rate:pt,absolute_lift:d,relative_lift:d/pc,ci_low:d-margin,ci_high:d+margin,excludes_zero:d-margin>0 || d+margin<0});
});

it('exposes every dataset through lesson template widgets', () => {
  const files = metrics.lessons!.flatMap(lesson => lesson.sections.flatMap(section =>
    section.kind === 'widget' && section.widget === 'template' ? [(section.props as { file?: string } | undefined)?.file] : []));
  for (const name of names) expect(files).toContain(name);
});
