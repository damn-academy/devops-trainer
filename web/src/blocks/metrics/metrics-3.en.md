<!-- lesson: metrics.pipeline | Sales pipeline: stages, coverage, velocity and win rate | 30 -->
<!-- section: hook -->
At the start of the quarter, the head of sales reports pipeline worth three times the target and says the quarter is covered. The quarter ends at 70% of target. A review shows that a third of the opportunities had not moved for six months, a quarter had their close date pushed back three times, and “technical evaluation” included deals where the customer had merely been sent a presentation. Triple coverage guaranteed nothing because the pipeline measured salespeople's hopes. This lesson teaches you to measure pipeline so that it describes buyers' state.

<!-- section: theory | Stages and transition criteria -->
An opportunity's stage is defined by a change in the buyer's state. A seller's action alone does not change the stage, nor does sending a commercial proposal. A practical set of stages for an infrastructure company looks like this:

| Stage | Exit criterion | What to measure |
|---|---|---|
| 0. Accepted, initial discovery | Account, use case and owner exist; the meeting happened; pain and next step are confirmed | Acceptance time, meeting attendance rate, transition to a qualified opportunity |
| 1. Qualified opportunity | Business problem, profile fit, approximate scope and decision process are confirmed | Qualified pipeline created, age, rejection reasons |
| 2. Technical evaluation, pilot | The pilot has been completed against pre-agreed success criteria, data and timeline; the customer has a technical champion, and the result is recorded | Pilot start, completion and success; technical success separate from commercial win |
| 3. Business case, solution selected | Following the evaluation, the buyer confirms value, budget path and preference for our solution | Win conversion, decision-maker coverage, competitor or no decision |
| 4. Procurement, legal, security | Commercial terms agreed, security and legal reviews passed; only the signature remains | Review time, slippage, discount, close-date changes |
| 5. Won or lost | A commitment is signed or the initiative is explicitly abandoned | Annual revenue, loss reason, cycle duration; go-live separately |

A pilot may succeed technically and lose for budget reasons; do not merge these two outcomes.

<!-- section: theory | Target coverage -->
Coverage over a horizon is open pipeline that can realistically close within that horizon divided by the remaining target. Suppose the quarterly new annual revenue target is $1 million, $200,000 has already been won, and $3.2 million of opportunities sits in the pipeline against the remaining $800,000. Remaining-target coverage is four. Dividing by the full target gives 3.2, a valid metric with a different label.

Required coverage depends on the win rate by value and the probability of closing on time. If 25% of opportunity value is won and 80% of those wins close on time, required coverage is roughly `1 / (0.25 × 0.8) = 5`; the second proportion is specifically among wins, otherwise the two cannot be multiplied. That is why “everyone needs triple coverage” does not work. Exclude opportunities with no next step and unrealistic dates.

<!-- section: theory | Velocity, win rate and cycle duration -->
Sales velocity is the number of qualified opportunities multiplied by average deal size and win rate, divided by average cycle duration in days. One hundred opportunities at $40,000, a 25% win rate and a 100-day cycle yield $10,000 in expected bookings per day. This is a comparative throughput measure, not accounting revenue. Reducing the cycle to 80 days, all else equal, gives $12,500 per day, a 25% increase, although in practice the other factors also change. All four numbers must describe one segment.

Win rate is calculated in two ways, and both belong together:

- by count: wins divided by wins plus losses, for example 30 out of 120, or 25%;
- by value: won value divided by won plus lost value; $1.2 million won and $4.8 million lost gives 20%.

If a team wins many small deals and loses large ones, its count-based rate looks good while its value-based rate looks poor. To compare qualification quality, freeze the amount at an agreed stage and show the final amount separately to expose discounts and scope changes.

Stage-to-win conversion is calculated for the cohort entering that stage. Take opportunities that entered technical evaluation in the first quarter and a 180-day window that has already ended for all of them. If there are 60 such opportunities and 24 were won within the window, conversion is 40%. If the window has not yet ended and 10 of the 60 are still open, the ratio of 24 to 50 closed opportunities is called the win rate among closed opportunities, with the 10 open ones shown alongside it. Multiplying stage transitions yields overall conversion only for nested cohorts with identical windows and complete routes. In a real CRM, opportunities skip stages and move backward, so record the counting rule in advance, usually based on first entry date.

Cycle duration runs from qualification to close, separately for wins and losses, showing the median and 75th and 90th percentiles. For cycles of 50, 60, 70, 90 and 230 days, the median is 70 and the mean is 100. It helps to show the lead- or PQA-to-win journey alongside it: an opportunity cycle may “shrink” simply because salespeople start creating opportunities later in the CRM.

<!-- section: theory | Stage age and slippage -->
The stage age of an open opportunity is the time from its latest entry into the current stage to the snapshot date. Compare it with the historical 75th percentile for the same stage and segment: a deal spending three times the usual time in procurement needs a conversation. Slippage is the share of opportunities expected within the horizon at the snapshot date that subsequently moved beyond it. If $300,000 of the $1 million expected at the start of the quarter moved to the next quarter, slippage by value is 30%. Specify whether the definition uses count or value.

<!-- quiz -->
? The quarterly target is $1 million, $200,000 is won and pipeline is $3.2 million. What is remaining-target coverage?
+ Four: $3.2 million in pipeline divided by the remaining $800,000 target || Coverage uses the remaining target.
- 3.2: pipeline is divided by the full quarterly target; other versions are not normally calculated || That is a valid but different metric.
- Five, because triple coverage plus wins provides a buffer || That number does not follow from the data.
? Opportunity values are fixed at qualification. A team won 30 of 120 opportunities, but only 20% by value. What does that mean?
- A CRM error: win rates by count and value always match || They match only when the average values of won and lost opportunities are equal.
+ The team loses large deals more often than small ones || That is why both rates are shown together.
- Salespeople give large discounts, understating won deal value || Values were fixed at qualification, so discounts do not affect this rate; they show up when compared with final values.
? Sixty opportunities entered technical evaluation in the first quarter; the 180-day window has not ended, 24 were won and 10 remain open. What should the ratio of 24 to 50 be called?
- Final stage-to-win conversion, because open opportunities have not yet been lost || Final conversion uses the whole cohort.
- Loss rate, because 26 opportunities were lost || 24 to 50 is a win rate.
+ Win rate among closed opportunities, shown alongside the 10 open ones || The cohort window has not ended, and 10 opportunities remain open.
<!-- /quiz -->

<!-- section: theory | Practice with sample data -->
The “Northwind Data deal pipeline” file below contains quarter-end snapshots of deals: stage, amount, expected close date, and forecast category. The target for new annual revenue in the third quarter is $1,000,000.

The same opportunity appears in multiple snapshots, so snapshots must not be summed; use the appropriate snapshot for each calculation. Calculate coverage from the September 30 snapshot: wins in the third quarter and open opportunities with a third-quarter close date. This snapshot was taken on the last day of the quarter, so coverage here is diagnostic rather than a forecast at the start of the quarter. Calculate win rates from the June 30 snapshot for opportunities closed between January 1 and June 30. Calculate slippage by taking open opportunities in the March 31 snapshot with second-quarter close dates and checking which have moved past June 30 in the June 30 snapshot. In the `category` column, `pipeline`, `best_case` and `commit` are the forecast categories from the forecasting lesson; `closed_won` means a won opportunity and `closed_lost` a lost one.

Calculate coverage of the remaining third-quarter target, win rates by count and amount for deals closed in the first and second quarters, and second-quarter slippage by count and amount.

Answers. In the third quarter, $300,000 has been won, leaving $700,000 to reach the target; open deals with close dates in the quarter total $1,400,000, giving coverage of 2. In the first and second quarters, 12 deals worth $600,000 were won and 8 worth $600,000 were lost: the win rate by count is 60 %, and by amount 50 %, because lost deals are larger on average. In the second quarter, 2 of 12 deals slipped, about 16.7 %, but their original value was $200,000 out of $800,000, or 25 %: it is mainly large deals that slip.

<!-- section: task | Task: stage criteria for your pipeline -->
Complete the task in the document on this page. List your CRM opportunity stages and define each transition as a change in the buyer's state. Then open the five oldest open opportunities and check whether their stages meet the criteria. Calculate remaining-quarter target coverage before and after excluding opportunities with no next step.

<!-- section: sources -->
- Ebsta and Pavilion, GTM Benchmarks 2025 — https://www.joinpavilion.com/hubfs/Ebsta%20x%20Pavilion%202025%20GTM%20Benchmarks%20Report.pdf (pp. 5–6)
- ICONIQ Growth, State of Go-to-Market 2025 — https://www.iconiq.com/growth/reports/state-of-go-to-market-2025

<!-- lesson: metrics.forecast | Sales forecasting, quota attainment and rep ramp-up | 28 -->
<!-- section: hook -->
A week before the board meeting, the head of sales promises $1.1 million for the quarter, which ends at $1 million. The next quarter, it happens again. A 10% error seems small, but if every forecast is too high, the board starts dividing every promise by 1.1, and the CFO holds extra cash reserves. This lesson explains forecast categories, how to measure accuracy and how to calculate sales-team quota attainment.

<!-- section: theory | Forecast categories -->
The forecast is divided into categories:

- Omitted: the opportunity is excluded.
- Pipeline: closing is possible, but evidence is limited.
- Best case: realistic upside if specific conditions are met.
- Commit: the responsible manager expects it to close in the period.
- Closed: the contract is signed.

Category names and aggregation rules depend on CRM configuration. Stage and category are different: a deal in procurement with an unresolved security issue may remain best case.

A weighted forecast is already-won value plus the sum of open opportunities multiplied by their probability of being won before period-end, considering segment, stage, age and evidence. Estimate probabilities from historical pipeline snapshots; assigning “70% to every pilot” substitutes wishful thinking for estimation. Model training must not use information learned after the forecast date, such as the final outcome or a future close date. For a single large deal, show scenarios with and without it so the risk does not disappear into an average.

<!-- section: theory | How to measure accuracy -->
Four checks:

- Bias: (forecast − actual) / actual. A $1.1 million forecast against $1 million actual gives +10%, indicating systematic overstatement.
- Absolute percentage error: |forecast − actual| / actual, here 10%. If accuracy is defined as one minus error, it is 90%, but large errors make accuracy negative; do not clip it to zero without explanation.
- Weighted absolute percentage error (WAPE): the sum of absolute errors across periods divided by total actuals. For two quarters with forecasts of $1.1 and $0.9 million and actuals of $1.0 and $0.8 million, this is 0.2 / 1.8 = 11.11%.
- Calibration: of a hundred opportunities assigned 30% probability, roughly 30 should close on time. Check calibration by segment.

When actuals are zero, percentage error is undefined; show absolute error and the overall weighted error. Compare forecasts at the same distance from period-end: 90, 30 and 7 days. Do not replace the original forecast with the latest version before the board meeting, or accuracy will always look excellent.

<!-- section: theory | Rep quota attainment -->
A salesperson's quota attainment is credited bookings divided by quota: $600,000 out of $800,000 is 75%. For the team, calculate two different numbers. Team attainment in dollars is total credited bookings divided by total quotas. The share of reps hitting quota is the number attaining at least 100% divided by all included reps. If three reps with equal quotas attain 150%, 75% and 75%, the team reaches 100%, but only one of three reps hits quota, or 33.3%.

Separate fully ramped reps from those still ramping, new logos from expansions, and the primary seller from specialists assisting the deal. One dollar of annual revenue may count toward both a seller's and a presales engineer's compensation, but it remains one dollar of company revenue. Reps who leave during the period must not quietly disappear from historical productivity.

<!-- section: theory | Ramp-up and team capacity -->
Rep ramp time is the number of days from joining to a predefined level of sustained productivity, such as at least 80% of prorated quota for three consecutive months. Intermediate milestones include certification, the first qualified opportunity and the first win. A first win after 30 days does not establish readiness: the deal may have been handed over by a colleague.

Ramp-adjusted team capacity is the sum of monthly rep quotas multiplied by each rep's ramp factor. Three experienced reps at $50,000 a month and two new reps with a 0.4 factor yield `3 × 50 + 2 × 50 × 0.4 = 190` thousand dollars per month. This is capacity before actual quota attainment, not a sales promise. Estimate ramp factors from hiring cohorts, including leavers; otherwise they will be optimistic.

<!-- quiz -->
? Forecasts for two quarters are $1.1 and $0.9 million; actuals are $1.0 and $0.8 million. What is WAPE?
- 10%: the average of the two percentage errors, rounded to a whole number || Weighted error divides total errors by total actuals.
+ About 11.11%: $0.2 million in errors divided by $1.8 million in actuals || $0.2 million in errors divided by $1.8 million in actuals.
- 22.2%, because the two quarters' errors are added as percentages || Percentages from different periods cannot be added that way.
? Three reps with equal quotas attain 150%, 75% and 75%. Which statement is true?
+ The team reached 100% of quota, while one of three reps hit quota || These are two different metrics.
- The team reached 75%, because median attainment is 75% || The median is not team attainment.
- Everyone hit quota, because total bookings equal total quotas || The share of reps is calculated individually.
? Why must the original forecast not be replaced by the latest version before the board meeting?
- Because the board is not interested in intermediate forecast versions, only the final one || The issue is accuracy measurement.
- Because the CRM does not retain forecast history and the old version cannot be restored || History must be deliberately retained.
+ Otherwise the forecast is compared with an almost-known actual and always looks accurate || Compare at the same distance from period-end.
<!-- /quiz -->

<!-- section: theory | Practice with sample data -->
The “Northwind Data forecast” file below contains forecasts made 30 days before quarter-end and actual results for four quarters.

Calculate bias and weighted absolute percentage error across the four quarters.

Answers. The quarterly errors are +$30,000, −$30,000, +$60,000, and −$60,000. Total forecasts and total actuals match at $1,200,000 each, so bias is zero. Yet the weighted error is $180,000 out of $1,200,000, or 15 %. Zero bias does not mean an accurate forecast: overestimates and underestimates cancelled each other out, while the forecast was wrong every quarter.

<!-- section: task | Task: your forecast accuracy -->
Complete the task in the document on this page. Find sales forecasts for the last four quarters made 30 days before each quarter-end, along with actual results. Calculate bias and weighted absolute percentage error. Then calculate next quarter's team capacity allowing for new-rep ramp-up and compare it with the target.

<!-- section: sources -->
- ICONIQ Growth, State of Go-to-Market 2025 — https://www.iconiq.com/growth/reports/state-of-go-to-market-2025
- Ebsta and Pavilion, GTM Benchmarks 2025 — https://www.joinpavilion.com/hubfs/Ebsta%20x%20Pavilion%202025%20GTM%20Benchmarks%20Report.pdf
