// Deterministic fictional Northwind Data fixtures. All monetary amounts are USD.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const output = fileURLToPath(new URL('../public/templates/', import.meta.url));
const csv = (name, header, rows) => {
  const data = [header, ...rows].map(row => row.join(',')).join('\n') + '\n';
  for (const suffix of ['', '-en']) writeFileSync(`${output}${name}${suffix}.csv`, data);
};
const date = (month, day = 1) => `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const plus = (day, n) => new Date(Date.parse(day) + n * 86400000).toISOString().slice(0, 10);
const cohorts = [];
for (let m = 1; m <= 6; m++) for (let i = 0; i < 100; i++) {
  const signup = date(m, i < 50 ? 1 : 20), active = i % 10 < m + 2;
  const observed = d => d <= '2026-07-01' ? d : '';
  cohorts.push([`ND-C${m}${String(i).padStart(3, '0')}`, signup,
    active ? observed(plus(signup, i % 2 ? 14 : 7)) : i % 5 <= 1 ? observed(plus(signup, 18)) : '',
    i % 5 <= 1 ? observed(plus(signup, 20)) : '',
    i % 5 <= 1 ? observed(plus(signup, 30)) : '',
    i % 5 === 0 ? observed(plus(signup, 60)) : '',
    i % 5 === 1 ? observed(plus(signup, 45)) : '', 10000, i >= 90 ? 1 : 0]);
}
csv('metrics-cohorts', ['account_id','signup_date','activated_at','pqa_at','first_opp_at','won_at','lost_at','acv_usd','is_internal'], cohorts);
const ends = ['2026-03-31','2026-06-30','2026-09-30','2026-12-31'];
const pipeline = [];
for (let s = 0; s < 4; s++) {
  for (let q = 0; q <= Math.min(s + 1, 3); q++) for (let i = 0; i < 10; i++) {
    const closed = q <= s, won = i < 6;
    pipeline.push([`ND-O${q+1}${i}`, `ND-P${q+1}${i}`, ends[s],
      closed ? (won ? 'won' : 'lost') : 'proposal',
      won ? 50000 : 75000, ends[q], closed ? (won ? 'closed_won' : 'closed_lost') : 'pipeline']);
  }
  for (let i = 0; i < 2; i++) pipeline.push([`ND-S${i}`, `ND-S${i}`, ends[s],
    s === 3 ? 'lost' : 'proposal', 100000, s === 0 ? ends[1] : ends[2], s === 3 ? 'closed_lost' : 'best_case']);
  if (s === 2) for (let i = 0; i < 6; i++) pipeline.push([`ND-R${i}`, `ND-R${i}`, ends[s],
    'negotiation', 200000, ends[2], i < 3 ? 'commit' : 'pipeline']);
}
csv('metrics-pipeline', ['opp_id','account_id','snapshot_date','stage','amount_usd','close_date','category'], pipeline);
csv('metrics-forecast', ['quarter','forecast_d30_usd','actual_usd'],
  [330000,270000,360000,240000].map((f,i)=>[`2026-Q${i+1}`,f,300000]));
const start = Array.from({length:100}, (_,i)=>[`ND-A${String(i+1).padStart(3,'0')}`,10000]);
csv('metrics-arr-start', ['account_id','starting_arr_usd'], start);
const moves = [];
for (let i = 0; i < 20; i++) moves.push([start[i][0], '2025-03', 'expansion', 5000]);
for (let i = 20; i < 30; i++) moves.push([start[i][0], '2025-06', 'contraction', -2000]);
for (let i = 90; i < 100; i++) moves.push([start[i][0], '2025-09', 'churn', -10000]);
for (let i = 0; i < 20; i++) moves.push([`ND-N${i+1}`, '2025-12', 'new', 10000]);
csv('metrics-arr', ['account_id','month','movement','arr_delta_usd'], moves);
csv('metrics-ab', ['account_id','group','converted'],
  ['control','treatment'].flatMap((group,g)=>Array.from({length:3900},(_,i)=>[`ND-E${g}-${i+1}`,group,i < (g ? 117 : 78) ? 1 : 0])));
