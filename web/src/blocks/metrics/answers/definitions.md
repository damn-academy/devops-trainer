# Northwind Data practice datasets

Northwind Data is a fictional company. Every record is synthetic; all amounts are USD.
The Russian (no suffix) and English (-en) CSVs have identical English column names
and data. Regenerate with `node scripts/build-metrics-datasets.mjs` from web/.
Answer JSONs are private source fixtures, never imported by the application.

Downloads are attached in metrics/index.ts to activation, pipeline, forecast, ARR,
and lift lessons. Explicit markers take precedence over these default placements.
Template markers (the lead can insert these in both lesson languages):
- `<!-- widget: template {"file":"metrics-cohorts"} -->`
- `<!-- widget: template {"file":"metrics-pipeline"} -->`
- `<!-- widget: template {"file":"metrics-forecast"} -->`
- `<!-- widget: template {"file":"metrics-arr"} -->`
- `<!-- widget: template {"file":"metrics-arr-start"} -->`
- `<!-- widget: template {"file":"metrics-ab"} -->`

## Cohorts
Snapshot: 2026-07-01, inclusive, UTC dates. Exclude is_internal=1 first.
An account matures at signup + window days; use mature accounts within each
signup-month cohort, not a blanket exclusion of the whole calendar month.
Activation means activated_at in [signup, signup+14], inclusive.
The 180-day conversion is won_at in [signup, signup+180], inclusive, with the
same maturity rule, restricted to January–March signups.
February and March have no mature accounts: their final conversion is unknown,
not zero. January is only partially mature. Do not quote the observed conversion
across all January–March accounts as a completed 180-day result.
Immature exclusions are reported separately for the two windows.

## Pipeline and forecast
Quarter-end snapshots repeat opportunities; never sum them across snapshots.
Coverage uses the 2026-09-30 snapshot, Q3 close dates only, and all open
pipeline/best_case/commit amounts divided by (1,000,000 minus Q3 closed_won).
This is a quarter-end remaining-target diagnostic, not a beginning-quarter forecast;
open opportunities dated September 30 are still unresolved at the snapshot.
Q1–Q2 win rates use the June 30 snapshot, close dates January 1–June 30,
and only closed_won/closed_lost. Value win rate uses won/(won+lost) amounts.
Q2 slippage follows open opportunities at March 31 with planned Q2 close dates:
a deal slips if its June snapshot close_date is after June 30. Denominator is that
original set; report count and original-value shares. All such deals are present
in both snapshots, so no missing-snapshot inference is necessary.
Forecast bias = sum(forecast-actual)/sum(actual); WAPE = sum(abs(error))/sum(actual).
Positive bias means overforecast. Actuals reconcile to each quarter's won deals.

## ARR
Starting ARR is at 2025-01-01; ending ARR is at 2025-12-31.
Deltas are annualized recurring revenue, not monthly revenue or cash.
Contraction and churn are negative. GRR=(start+contraction+churn)/start.
NRR=(start+existing-account expansion+contraction+churn)/start, excluding new logos.
Logo churn is starting logos whose ending ARR is zero / starting logos.
New logos do not enter either retention denominator. Every starting logo is 10,000.

## A/B
Account-level independent randomized groups: 3,900 per arm.
Difference and confidence interval are proportions (multiply by 100 for percentage
points). Relative lift=(treatment-control)/control.
Unpooled normal 95% CI = difference ± 1.96 *
sqrt(pt*(1-pt)/nt + pc*(1-pc)/nc); no continuity correction.
