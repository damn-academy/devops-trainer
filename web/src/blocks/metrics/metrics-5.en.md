<!-- lesson: metrics.activation | Activation, time to value and retention cohorts | 28 -->
<!-- section: hook -->
The product team reports that median time to first value fell from four hours to two. But the share of activated accounts fell from 40% to 30% in the same quarter. Perhaps difficult customers stopped reaching the outcome, and the median among those remaining improved by itself. Time to value without the share that never reached it is misleading. This lesson explains how to define activation, calculate time to value and retention, and why login counts mean very little for infrastructure.

<!-- section: theory | What counts as activation -->
Good activation describes a customer's completed job. For an observability system, it means the customer's own production data arrived, a query ran and the user found the required signal. For an infrastructure-as-code tool, it means successfully deploying the customer's own resources. For a database, it means loading their own data and running a useful query. For a security product, it means scanning a repository and investigating at least one finding. The product team defines the specific event for its product; it should not borrow it from someone else's report.

It helps to distinguish three levels. Technical activation means the integration works. Value activation means a verifiable useful outcome was achieved. Organizational adoption means usage repeats and covers the necessary teams and workloads.

Fourteen-day activation is calculated for a mature cohort: the number of new eligible accounts whose 14 days have elapsed and that activated within those 14 days, divided by all new eligible accounts whose 14 days have elapsed. If 300 of 1,000 such accounts activated, the rate is 30%. Do not add yesterday's 200 signups to the denominator: those accounts are immature and must not be counted as unsuccessful.

<!-- section: theory | Time to value -->
Time to value (TTV) is the interval from the start to the first useful outcome. Show two starting points: signup and the actual start of setup. The gap explains waiting for access and approvals. Report the median and 75th and 90th percentiles among activated accounts, alongside activation rate and the share that did not reach value within 14 and 30 days.

For example, 40 of 100 organizations activated, with a median time to value of two hours. You cannot claim that a typical new customer gets value in two hours: 60% have not received it yet. A more meaningful target is “increase the share of new target-profile organizations receiving value within 24 hours from 25% to 35%”.

To test whether activation predicts retention, compare day-90 retention of accounts activated by day 14 with nonactivated accounts, using the same starting point and segments. This shows association, not causation. Claiming that improved onboarding raises retention requires an experiment: otherwise active customers may simply be more likely to do both.

<!-- section: theory | Retention cohorts -->
Account retention in interval k is the number of cohort accounts performing a useful action in interval k divided by eligible accounts originally entering the cohort. For monthly cohorts, the event must occur in month k. Unbounded retention (activity in month k or later) is a different metric and is usually higher. Continuous retention requires activity in every preceding interval and answers a third question.

| Cohort | Size | Month 1 | Month 2 | Month 3 |
|---|---:|---:|---:|---:|
| July | 100 | 70% | 60% | 55% |
| August | 120 | 75% | 65% | — |
| September | 150 | 80% | — | — |

A dash means a window that has not arrived yet, not zero retention. Account-count retention is not revenue-weighted; calculate revenue retention separately. For customer-hosted open editions, mark missing telemetry as “unknown” when disabling reporting cannot be distinguished from stopping usage.

<!-- section: theory | Daily activity: who and what to count -->
Daily active users (DAU) are unique people performing a useful action in a calendar day; weekly active users (WAU) cover a rolling seven days. For API products, also track active accounts, active workloads and successful billable operations. Health checks, retries, demo data, build-pipeline installations and service accounts are excluded from human activity. Machine activity has its own unit.

For example, 40 active people per day and 100 per week give a DAU-to-WAU ratio of 40%, while 80 out of 100 organizations with workloads active daily and weekly give an account ratio of 80%. Do not add these numbers. A month's average daily metric is the mean of daily values; monthly uniques divided by 30 is a different quantity.

A reliable database can run for a month without an administrator logging in, so low control-panel activity does not prove a lack of value. For a disaster-recovery system, daily recovery is not even a desirable outcome. Suitable metrics include the share of protected workloads, successful scheduled recovery tests and achievement of recovery-time objectives. The metric's cadence should match the user's job.

<!-- quiz -->
? Median time to value halved, while activation fell from 40% to 30%. How should this be understood?
+ Difficult customers probably stopped reaching the outcome, improving the median among those remaining || Read time to value alongside activation rate.
- The product became simpler and customers get value twice as fast as before || That is true only for those who made it through.
- It is a data error because the median and activation rate always move together || They can move in opposite directions.
? The September cohort has a dash in month three of the cohort table. What does it mean?
- Third-month retention is zero because there was no activity || The window has not arrived yet.
+ This cohort's third-month window has not arrived yet || An immature observation.
- September telemetry was lost and must be restored from backup || A dash does not indicate data loss.
? Is low daily user activity bad for a disaster-recovery system?
- Yes, because customers will soon stop paying for a product they do not use daily || This product's job has a different cadence.
- No, because user activity is irrelevant to all infrastructure products || Activity matters for many products.
+ Not necessarily; protected-workload share and successful recovery tests are suitable metrics || The metric should match the job's cadence.
<!-- /quiz -->

<!-- section: theory | Practice with sample data -->
The “Northwind Data cohorts” file below describes 600 accounts at a fictional company that registered from January through June 2026. For each account, it records registration and activation dates, dates of PQA, first deal, win or loss, annual contract value, and an internal-account flag. The snapshot date is 1 July 2026.

File columns: `account_id` is the account identifier, `signup_date` the signup date, `activated_at` the first-value date, and `pqa_at`, `first_opp_at`, `won_at` and `lost_at` the dates of PQA, first opportunity, win and loss. `acv_usd` is annual contract value in dollars; `is_internal` is 1 for internal accounts. An empty cell means the event has not occurred. Dates use year-month-day format. An account is activated within 14 days if its activation date is no later than its signup date plus 14 days; it is mature if its signup date plus 14 days is no later than the snapshot date.

Do the calculations yourself before reading the answers. First exclude internal accounts. Then calculate 14-day activation for each monthly cohort, keeping only accounts whose 14-day window had elapsed by the snapshot date in both the numerator and denominator. Next, calculate registration-to-win conversion within 180 days for the January, February, and March cohorts.

Answers. There are 60 internal accounts. The 14-day activation rates for January through June are 30, 40, 50, 60, 70, and 80 %; in June, only 50 of 90 accounts were mature, and 40 recent accounts were excluded. Only part of the January cohort, 50 accounts, had reached 180 days; 10 of those were won, or 20 %. For February and March, the window has not yet elapsed, so conversion is undefined; dividing their wins by all registrations would give an understated figure and lead you to conclude that the pipeline had deteriorated.

<!-- section: task | Task: your product's value event -->
Complete the task in the document on this page. Define three activation levels for your product: technical, value and organizational, with a specific event and window for each. Calculate activation rate and median time to value for the most recent mature monthly cohort, alongside the share that did not reach value within 14 days. Then build a retention table for the three latest cohorts and mark immature cells.

<!-- section: sources -->
- PostHog, per-product activation — https://posthog.com/handbook/growth/growth-engineering/per-product-activation
- OpenView and Pendo, Product Benchmarks 2023, archived copy — https://www.scribd.com/document/680456182/OpenView-2023-Product-Benchmarks-Report

<!-- lesson: metrics.pqa | Product-qualified accounts and open-edition telemetry | 28 -->
<!-- section: hook -->
Every week, sales receives a list of a hundred accounts “actively using the product” and calls them all. A quarter later, the list turns out to include students, test environments and build pipelines, while real companies ready to buy got lost in the middle. Salespeople stop opening the list. This lesson explains how to define a product-qualified account, validate the rule's quality and collect open-edition telemetry without losing users' trust.

<!-- section: theory | The PQA rule -->
A working rule for a paid cloud or enterprise product might look like this:

- Fit: the account matches the chosen customer profile, the organization is known and there is an applicable production use case.
- Value: successful useful operations on three different days in the last 14, excluding demo and internal traffic.
- Potential: consumption approaches a commercial threshold, multiple teams use the product, or the account requests single sign-on, an audit log or private networking.
- Contactability: an allowed channel and clear context exist, and communication opt-outs are respected.

These numbers are a starting hypothesis. A security product may deliver value to one specialist; requiring “three users” would exclude suitable accounts. PQA is an account state; handoff to a salesperson is a separate event. The signal expires, for example after 30 days without confirmation, but the first PQA date remains in history.

<!-- section: theory | Rule precision and recall -->
Check rule quality with two numbers:

- Precision = PQA accounts becoming qualified opportunities within 90 days / mature PQA accounts.
- Recall = accounts flagged by the rule before their opportunity was qualified / all eligible accounts that gained a qualified opportunity within the same window. Count an account with two opportunities only once.

With 100 PQA accounts, of which 30 gained a qualified opportunity within 90 days, and 50 accounts with opportunities over the same period, precision is 30% and recall 60%. If comparable non-PQA accounts produce opportunities 5% of the time, the rule's observed lift is sixfold. However, this is not the effect of sales calls: good selection alone explains the difference. Test sales impact using a PQA holdout group receiving no calls, incremental annual revenue, and the cost of salesperson and engineer time. Do not optimize the rule for email opens.

If the team can handle 40 accounts a week, the quality of the top forty matters; measure precision at that volume. Train and validate scoring models over time, and never use features appearing after opportunity creation: they leak information from the future and make the model look better than it is.

<!-- section: theory | Open-edition telemetry and trust -->
A customer-hosted open edition is visible to the company mainly through telemetry, but also through support requests, user accounts of their experience and interviews, and its design affects community trust. Good practice includes a public list of collected events and fields, a clear explanation of purpose, controls for enabling and disabling collection, and documented sending endpoints and retention periods. For sensitive environments, it is reasonable to ask for consent by default or agree on minimal operational telemetry with the administrator. This is a recommendation, not a claim of a universal legal requirement.

Do not collect query text, data contents, secrets, private repository paths or resource names for marketing. Use allowlisted event names, volume ranges instead of exact values, pseudonymous installation identifiers and server-side aggregates. Hashing an email address does not make the information anonymous. Operational telemetry, product analytics and commercial data enrichment serve different purposes; permission for one does not imply permission for another.

The consenting sample may differ from isolated enterprise installations with no internet access; show this bias in reports. Mark consent-form changes on activation and retention charts. A GitHub star is a public interest signal, not proof of adoption, authority or consent to a call. Grafana's gcx CLI usage-statistics documentation lists transmitted fields and exclusions and explains how to disable reporting. It is an example of a thorough description, not evidence that the same model suits every open-source project.

<!-- quiz -->
? Of 100 PQA accounts, 30 gained an opportunity. There were 50 accounts with opportunities in total, 30 flagged beforehand. What are the rule's precision and recall?
- Precision 60%, recall 30%, because recall uses all PQAs as the denominator || Recall uses all accounts with opportunities.
+ Precision 30%, recall 60% || 30 of 100 PQA accounts and 30 of 50 accounts with opportunities.
- Both 30%, because both numerators contain the same 30 accounts || The denominators differ.
? PQA accounts produce opportunities six times more often than others. Does this prove the benefit of sales calls?
+ No: selection explains the difference; test calls using a PQA holdout group without calls || Selection quality and action impact are different things.
- Yes, because sales called only PQAs, so the calls caused the difference || PQAs would buy more often even without calls.
- Yes, if the difference lasts three consecutive quarters, it can no longer be random || Persistence does not separate selection from impact.
? What open-edition data is reasonable to collect for product analytics?
- Query text and resource names if hashed before sending || Hashing does not make sensitive data safe.
- Anything that helps sales if the license says telemetry is enabled || Analytics and sales have different purposes.
+ Allowlisted events, volume ranges and pseudonymous identifiers from a public list || Publish the field list and provide control over disabling collection.
<!-- /quiz -->

<!-- section: task | Task: a PQA rule and its validation -->
Complete the task in the document on this page. Write the first version of your product's PQA rule using four conditions: fit, value, potential and contactability. Using the last six months' data, calculate how many accounts it would have flagged, how many of them acquired a qualified opportunity and how many accounts with opportunities the rule missed. Then draft a public list of telemetry fields you collect or want to collect and mark those you could do without.

<!-- section: sources -->
- Grafana, gcx usage statistics — https://grafana.com/docs/grafana/latest/ai-tools/grafana-cli/gcx/anonymous-usage-statistics/
- Common Room, Pulumi case study — https://www.commonroom.io/customers/pulumi-signals-meetings-booked/
- Reo.Dev — https://www.reo.dev/

<!-- lesson: metrics.usage | Consumption revenue: commitments, run rate and margin | 26 -->
<!-- section: hook -->
A customer signed an annual commitment of $120,000 and consumed $15,000 last month. Sales reports $120,000 in commitment plus $180,000 in annualized consumption, totaling $300,000 in annual revenue. The CFO counts $180,000 because part of consumption is covered by the commitment and cannot be counted twice. Revenue in a usage-based product behaves differently from subscription revenue; this lesson explains the metrics it needs.

<!-- section: theory | Consumption metrics -->
| Metric | Definition | Example |
|---|---|---|
| Billable consumption | Total billable units after deduplication, free allowances and credits | 10 million requests, 2 million free, leaving 8 million |
| Effective price | Net consumption revenue / billable units | $16,000 for 8 million: $0.002 per request |
| Consumption gross margin | (revenue − cost of consumption) / revenue | (16 − 6) / 16 = 62.5% |
| Contribution per unit | (net revenue − variable delivery costs) / units | At a cost of $0.00075: $0.00125 per request; this is not full operating margin |
| Committed ARR | Annual contractual minimum | A $120,000 annual contract means $120,000; overages are counted separately |
| Annualized consumption run rate | 12 × last month's revenue or 4 × last quarter's revenue, with the method labeled | $15,000 per month means $180,000 annually, without a guarantee |
| Commitment utilization | Consumed dollars / commitment over the contract window | $75,000 in the first 9 months of a $120,000 annual commitment is 62.5%; linear pacing would be 75% |
| Consumption revenue retention | Starting cohort's revenue in the current window / same cohort's revenue in the previous window | $110,000 / $100,000 = 110% by revenue; no ARR snapshot is used |
| Consumption retention | Same cohort's consumption volume in the current window / baseline window | 120 / 100 million units = 120%; it may rise while revenue falls |

The commitment and consumption run rate in the opening example cannot be added: some consumption is covered by the commitment. Forecast overages and revenue recognition separately. Remaining performance obligations (RPO) equal neither ARR nor actual consumption revenue.

<!-- section: theory | Volume and price -->
Decompose consumption-revenue changes into volume and price. Previously there were 100 units at $1, totaling $100; now there are 120 units at $0.90, totaling $108. The volume effect is `(120 − 100) × 1 = +20` dollars; the price effect is `120 × (0.9 − 1) = −12` dollars; the total is +8. With several products, add a mix effect and fix the decomposition order; otherwise the result depends on what you calculate first.

Also break consumption growth down by source: new workloads, growth of existing workloads, price changes and plan changes. Without this, revenue growth from one large customer upgrading to a more expensive plan looks like broad product growth.

<!-- section: theory | AI and agent products -->
In AI agent products, consumption also grows when an agent loops or performs worse: tokens and API calls are spent without tasks being completed. Add successful task count, latency and error rate, cost per successful task, retry rate, abuse and spending concentration among a few customers to consumption metrics. A completed task demonstrates commercial value; call count does not.

A public-company snapshot shows how to read such numbers. For fiscal 2025, ending January 31, 2025, Snowflake reported quarterly product revenue of $943.3 million, up 28% year over year, and net revenue retention of 126%. The cohort includes capacity-contract customers, with second-year revenue divided by first-year revenue and churned customers retained at zero. A 126% retention rate does not promise 26% growth for every account; forecasting requires separate data on consumption, workloads, prices, credits and commitments.

<!-- quiz -->
? A customer commits $120,000 annually, with an annualized consumption rate of $180,000 covered by the commitment. What annual revenue should be recorded?
- $300,000, because commitment and consumption are separate revenue sources || Some consumption is covered by the commitment.
+ About $180,000 as a labeled run rate, with the $120,000 commitment shown separately || There must be no double counting.
- $120,000, because annual revenue includes only the contractual minimum || Overages are also revenue and are shown separately.
? There were 100 units at $1; now there are 120 at $0.90. What are the volume and price effects?
+ Volume +$20, price −$12, total +$8 || Volume uses the old price; price uses the new volume.
- Volume +20%, price −10%, total +10% || Percentages cannot be added this way; the total is +8%.
- Volume +$12, price −$4, total +$8 || The decomposition is incorrect.
? Agent tokens and calls doubled in a month. What should be checked before calling this success?
- Nothing: consumption growth in a usage-based product always means more value || Growth may come from a loop.
+ Successful tasks, retry rate and cost per successful task || Completed tasks demonstrate value.
- Only gross margin, because it always falls as volume grows || Margin matters but does not establish value.
<!-- /quiz -->

<!-- section: task | Task: your product's consumption metrics -->
Complete the task in the document on this page. If your product has usage-based billing, calculate last quarter's billable consumption, effective price, consumption gross margin and commitment utilization for the largest customers. Decompose the revenue change from the previous quarter into volume and price effects. If there is no usage-based billing, describe which consumption unit best reflects your product's value and how it could be charged for.

<!-- section: sources -->
- Snowflake, fourth-quarter and full-year fiscal 2025 results — https://www.snowflake.com/en/news/press-releases/snowflake-reports-financial-results-for-the-fourth-quarter-and-full-year-of-fiscal-2025/ (26.02.2025)
- ICONIQ Growth, State of Scaling 2026 — https://www.iconiq.com/growth/reports/2026-state-of-scaling
- High Alpha and Visible, Startup Benchmarks 2026 — https://visible.vc/startup-benchmarks/
