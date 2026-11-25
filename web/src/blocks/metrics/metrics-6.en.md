<!-- lesson: metrics.dashboards | Dashboards and review cadence: weekly, monthly, quarterly | 26 -->
<!-- section: hook -->
The company has three dashboards with thirty metrics each. At the weekly meeting, people scroll through them for twenty minutes, then discuss one deal everyone already knew about. No number led to a decision. A dashboard is useful when each metric has an owner, a threshold and an action, and the set of metrics fits the meeting's cadence. This lesson arranges the previous lessons' metrics across three review rhythms and explains what belongs beside every number.

<!-- section: theory | Three review levels -->
| Cadence | Participants | Minimum metrics | Resulting decision |
|---|---|---|---|
| Weekly pipeline review | Sales and revenue operations, with marketing and presales engineers for problem areas | Pipeline created by source and segment, remaining-target coverage, stage age, close-date slippage, forecast commit changes, PQA acceptance, pilot obstacles | Who takes the next step and by when, what to remove from the forecast, where pipeline is insufficient |
| Monthly business review | CEO, sales and finance leaders, product, marketing, customer success | ARR bridge, new and expansion ARR, NRR and GRR, win rates by count and value, cycle, mature-cohort CAC and payback, activation and time to value, retention, forecast error | Resource reallocation, onboarding or pricing fixes, segment-level plan changes |
| Board meeting, usually quarterly | CEO, CFO, board | ARR, revenue and growth, gross margin, cash burn and runway, NRR and GRR, customer concentration, sales and marketing efficiency, forecast versus plan, team capacity, cohort quality, consumption and commitment risks | Strategic bets, hiring pace, liquidity risk, annual-plan adjustments |

Calculate several additional ratios for the board. ARR growth is ending ARR divided by starting ARR minus one. The Rule of 40 adds growth rate to a selected profit margin; label which margin (free cash flow or earnings before interest, taxes, depreciation and amortization) and which growth (revenue or ARR) are used. With 30% growth and a −10% free-cash-flow margin, the result is 20%, so the rule is not met. Burn multiple is net cash burn divided by net new ARR for the same period: $2 million burned for $1 million in growth gives 2. With zero or negative growth, the metric loses its usual meaning. Runway is approximately available cash divided by monthly net burn: $6 million at $500,000 a month gives 12 months if burn stays constant. ARR per employee uses period-end headcount and should not be compared with revenue per average headcount.

<!-- section: theory | What belongs beside every number -->
Each dashboard card shows the current value, a comparable prior period, target, denominator, cohort maturity, definition version, data refresh time and owner. A green metric without an adequate denominator or with stale data is an interface error. A weekly dashboard explains actions; a board dashboard explains economics and risks. They should not be mixed on one screen.

<!-- section: theory | Tools and their roles -->
| Layer | Options | Required data-model contents |
|---|---|---|
| CRM | HubSpot, Salesforce, Attio, Pipedrive | Accounts, contacts, opportunities, stage history, amounts, currency, source, close-date history, owner, loss reason |
| Product analytics | PostHog, Amplitude, Mixpanel | Human and machine events, organization grouping, value-event versions, cohorts, windows |
| Event collection | Server events, collection libraries, queue; a separate billing meter | Event ID, event and receipt timestamps, schema version, environment, actor type, consent state |
| Warehouse and transformations | PostgreSQL initially, BigQuery, Snowflake or Databricks as scale grows; SQL and dbt | Identity map, account snapshots, subscription history, opportunities, costs, cohort marts |
| Reverse synchronization | Hightouch or controlled custom synchronization | PQA evidence, risk flags and next actions back to the CRM, with write history and provenance |
| Open-edition and community signals | Common Room, Reo.Dev | Signals with matching confidence and date; confirmed usage separate from inferred interest |
| Finance and billing | Contracts, invoices, consumption metering, accounting | Source of contractual ARR, revenue, credits and refunds, cost of revenue and cash collections |
| Spreadsheets and BI | Spreadsheets early on, then Metabase, Looker, Power BI | Definition table, budgets, variance analysis; formulas are not copied manually between departments |

When choosing a CRM, check stage-history exports, account identity and snapshot support: an attractive funnel interface does not solve definitions. Group analytics is needed when instrumenting events because one person may work in several organizations; PostHog, Amplitude and Mixpanel document these capabilities. Community-signal vendors claim to identify companies through activity on GitHub, registries and documentation, but these are vendor descriptions, not independent accuracy guarantees. Check false matches on your own sample before implementation.

<!-- quiz -->
? With 30% growth and a −10% free-cash-flow margin, what is the Rule of 40 result?
- 40%, because the Rule of 40 is a target threshold and does not need calculation || The threshold and the result are different.
+ 20%, so the rule is not met || 30 + (−10) = 20.
- 30%, because negative margin is excluded from the Rule of 40 || Margin enters with its sign.
? A metric card is green, but its data has not refreshed for a week. How should this be treated?
- As normal if the metric was already green before || Stale data may hide a problem.
+ As an interface error: a metric with stale data cannot be trusted || Show refresh time on every card.
- As a signal to turn it gray and remove it from the dashboard forever || Fix the data failure; keep the metric.
? Which review decides who takes the next step on a deal and by what date?
+ The weekly pipeline review || The weekly cadence owns actions.
- The monthly business review, because the CEO attends || The monthly review decides resource allocation.
- The quarterly board meeting where the forecast is approved || The board decides strategy and risk.
<!-- /quiz -->

<!-- section: task | Task: three dashboards for three cadences -->
Complete the task in the document on this page. Sort the metrics currently on your dashboards into weekly, monthly and quarterly cadences. For each, record the owner, threshold and action when the threshold is crossed. Move metrics without a threshold or action into a separate removal-candidate list.

<!-- section: sources -->
- HubSpot CRM — https://www.hubspot.com/products/crm
- Attio, objects — https://attio.com/help/reference/managing-your-data/objects
- PostHog, group analytics — https://posthog.com/docs/product-analytics/group-analytics
- Amplitude, account-level reporting — https://amplitude.com/docs/analytics/account-level-reporting
- Reo.Dev — https://www.reo.dev/

<!-- lesson: metrics.truth | A single source of truth: data contracts and errors that change conclusions | 30 -->
<!-- section: hook -->
The CFO and head of sales bring two different ARR figures to the board, and half an hour goes into deciding which is right. Finance includes refunds and currency effects; sales includes contracts signed on the quarter's last day but not yet started. Both figures are valid, but they use different definitions and sources. A single source of truth does not necessarily mean one system. It is an agreement on which system is authoritative for each field and where each metric is calculated once.

<!-- section: theory | How the data flows -->
CRM data, product events, billing, finance and external signals with user consent first enter immutable raw records with original timestamps and identity mapping. Versioned transformations then calculate metrics under recorded contracts and create dated account snapshots. BI, spreadsheets and board materials consume shared metric marts. Reverse synchronization delivers calculated features to the CRM with evidence and synchronization time. There must not be a second independent PQA calculation inside the CRM.

The minimum set of tables:

- account dimension: stable ID, parent account, legal grouping, customer profile and effective dates; email domain is a feature, not a primary key, because Gmail, subsidiaries and mergers break that assumption;
- identity bridge: visitor, user, installation, workspace, CRM and billing IDs mapped to an account, with effective dates, matching method, confidence and manual confirmation;
- product events: unique ID, event and receipt timestamps, organization, actor type, environment and value-event version; test and demo events excluded in the model;
- stage transitions and opportunity snapshots: stage and category at a date, amount basis, close date and provenance; historical facts are not overwritten with current values;
- subscription movements: new, expansion, contraction, churn, reactivation, currency effects, currency and contract period;
- consumption and billing: billable units, pricing version, credits, billed revenue and delivery costs; a browser-side counter does not replace the financial meter;
- cost allocation: acquisition, expansion and retention cost pools, with allocation rules by segment and channel;
- metric registry: formulas, unit, windows, exclusions, owner, version, effective date, SQL link and change log.

Implement in this order: first agree on ARR and customer identity with finance; then establish qualification and stage history in the CRM, link product organizations to accounts, define value events and build cohort marts. Only then does automating PQA handoffs and attribution make sense. You can start with CSV exports, SQL and a spreadsheet if you retain raw snapshots.

<!-- section: theory | Quality checks -->
- Opening ARR plus movements equals closing ARR within agreed currency and rounding tolerances.
- No duplicate event IDs or references to nonexistent accounts; entry and exit dates are logically consistent.
- Normalized attribution weights sum to one for each opportunity, or the opportunity is explicitly labeled “source unknown”.
- The shares of unlinked paying accounts, unknown sources, late events and manual corrections are visible on a separate panel.
- ARR reconciles with contracts and billing, recognized revenue with accounting, and consumption charges with the meter.
- Restatements are labeled; closed reporting periods do not change silently; “as reported” and “restated” versions are retained.
- Access to user-level telemetry and commercial enrichment is limited to the task, and deletion and opt-out requests propagate to copies in other systems.

<!-- section: theory | A metric contract template -->
```yaml
metric: account_activation_14d
version: 1
owner: Product Analytics
grain: external_cloud_account
cohort: first_account_created_month_utc
numerator: accounts_reaching_value_v1_within_14_days
denominator: new_accounts_with_full_14_day_observation
exclude: [internal, demo, known_duplicate]
unknown: telemetry_missing_is_reported_separately
dimensions: [icp_segment, acquisition_route, region, product]
source: warehouse.account_activation_cohort
refresh: daily
change_policy: version_new_definition_and_restate_explicitly
```

The template records the definition fields from the course's first lesson—unit, cohort, numerator, denominator, exclusions, source, owner and version—in a form both a person and a validation program can read.

<!-- section: theory | Errors that change management conclusions -->
| Error | Why the result is wrong | How to fix it |
|---|---|---|
| Vanity metrics | Stars, downloads and views measure interest, distribution and bot activity | Link them to active workloads, activation of suitable accounts and subsequent stages |
| Definition change | A new MQL threshold or easier activation creates artificial growth | Versions, effective dates, parallel calculations, restated series |
| Censored observations | November's cohort is compared with January's on annual payment | Use equal ages or survival estimates with intervals |
| Survivorship bias | Churned customers, departed reps and failed pilots disappear from calculations | Fixed starting cohort and recorded exclusion reasons |
| Entity substitution | Users or free signups are divided by enterprise customers | Identity bridge and matching numerator and denominator units |
| Count versus value | Most small deals are won but most money is lost | Show win rates by count and value together |
| Attribution as causation | An existing customer reads an article, which is then declared the cause of the deal | Influence describes contact; measure lift separately |
| Double ARR | Commitment plus consumption covered by it; an old customer's new workspace counted as a new logo | Reconcile contracts and consumption; define parent-account rules |
| NRR hides base erosion | A few large expansions offset many churned customers | Show GRR, logo churn, concentration and segments alongside it |
| Percentages versus points | Growth from 20% to 30% is called 10% growth, although relative growth is 50% | State both quantities |
| Benchmark laundering | A 2026E forecast or a blog retelling becomes a “2026 fact” | Primary source, data year, sample size, statistic, formula |

Simpson's paradox can be checked with an illustrative example. In Q1, the small-company segment won 90 of 100 deals, or 90%; large companies won 20 of 100, or 20%; the total was 110 of 200, or 55%. In Q2, small companies improved to 19 of 20, or 95%, and large companies to 54 of 180, or 30%, while the overall result fell to 73 of 200, or 36.5%. Both segments improved, but the overall metric worsened because the deal mix shifted toward large companies. Show a comparison at a constant mix first, then discuss team performance. Blended CAC, activation and NRR behave similarly when channel mix and contract sizes change.

Goodhart's law says that when a metric becomes a target, it stops measuring well. Paying for booked meetings creates no-shows and weak meetings; paying for pipeline created produces inflated amounts; paying for activation produces an overly easy activation event. Accompany the target metric with guardrails: meetings held, qualified and converted to wins, amount revisions, retention and cost to serve.

<!-- quiz -->
? Both segments improved their win rates, but the overall rate fell from 55% to 36.5%. What happened?
- A data error: if both segments improved, the overall metric cannot fall || It can when the mix changes.
+ Deals shifted toward the segment with the lower win rate || This is Simpson's paradox.
- The team performed worse, and segment improvements are random small-sample noise || The segments improved; the mix changed.
? Salespeople began receiving pay for booked meetings. Which guardrail is needed?
+ The share of meetings held and qualified || Without it, meetings become weak.
- Emails sent, because meetings are booked through emails || Emails do not constrain meeting quality.
- No guardrail is needed if meetings are booked only with target-profile accounts || Profile fit does not guarantee meeting quality.
? Why must an email domain not be the account's primary key?
- Because domains change more often than once a year, so the key constantly becomes stale || Change frequency is not the main reason.
+ Shared email services, subsidiaries and mergers break the domain-to-company mapping || A domain is a feature, not a key.
- Because data-protection rules prohibit storing domains || There is no such prohibition; key reliability is the issue.
<!-- /quiz -->

<!-- section: task | Task: your metric registry -->
Complete the task in the document on this page. Create a metric registry using the contract template and add five metrics departments argue about most often. For each, identify the authoritative source for every field. Then go through the error table and mark those occurring in your current reports, with a specific example.

<!-- section: sources -->
- Hightouch, warehouse-to-HubSpot architecture — https://2739300.fs1.hubspotusercontent-na1.net/hubfs/2739300/From%20Data%20to%20Action%20-%20Connect%20your%20Data%20Warehouse%20to%20HubSpot%20with%20Reverse%20ETL.pdf

<!-- lesson: metrics.stories | Six company stories and a minimum set of metrics | 26 -->
<!-- section: hook -->
Public company case studies are often retold in one sentence: “Pulumi found a quarter of its leads through the community”, “Snowflake grows 26% within customers”. In the original sources, those numbers mean something different, and the difference matters when building your own metrics system. This lesson examines six documented stories, separating source facts from measurement lessons, and ends with a minimum starting set.

<!-- section: theory | Pulumi: community signals became a work queue -->
In Common Room's case study, the tool helped generate 27% of Pulumi's sales-qualified leads in one quarter, with the author explicitly defining these as booked meetings. The team connected community and product signals with Salesforce and minimum qualification criteria. Neither the publication date nor the calendar quarter is disclosed on the page.

This is a useful example of turning open-edition signals into sales work. But 27% is a share of meetings; it says nothing about an increase in win rate, pipeline or incremental revenue. To reproduce the outcome, measure the chain “signal, meeting held, qualified opportunity, win” and maintain a control group.

<!-- section: theory | Cognism: traffic fell while the commercial signal behaved differently -->
Cognism's Inside Inbound 2026 report describes internal 2025 data compared with the same period in 2024: organic traffic fell 33.6%, while direct MQLs grew 6%. It uses CRM, Dreamdata, Outreach and ad-platform data; the precise common cutoff date and full sample size are not disclosed.

This means SEO cannot be declared successful or unsuccessful based on sessions alone. But growth in direct inquiries does not prove it offset lost organic revenue: these are different metrics and attribution buckets. Check qualified accounts, won cohorts and self-report, remembering that this is one company's report about itself.

<!-- section: theory | PostHog: completed onboarding needs downstream validation -->
A PostHog educational video dated September 15, 2025 examines an experiment changing the installation step: onboarding completion rose from 64% to 70%, or 6 percentage points and roughly 9.4% relatively. The description also mentions checking that events started arriving after the change.

Completed onboarding is an intermediate metric; afterward, verify that data arrives and the customer receives value. The public description lacks group sizes, intervals and retention, so no independent conclusion about significance or revenue is possible. A useful PostHog practice documented in its public handbook is separate activation for every platform product.

<!-- section: theory | Snowflake: consumption retention is not a subscription -->
In its February 26, 2025 release, Snowflake reported fiscal 2025 quarterly product revenue of $943.3 million, up 28% year over year, and net revenue retention of 126%. The cohort includes capacity-contract customers who used the platform in the first month of the first of the two comparison years. Second-year revenue is divided by first-year revenue, and churned customers remain in the calculation at zero.

A successful land-and-expand strategy can coexist with consumption volatility, and 126% does not promise 26% growth for every account. Forecasts need consumption, workload, price, credit and commitment data. The potential mistake is the outside reader's: treating this metric as a contractual ARR snapshot.

<!-- section: theory | Datadog: breadth of adoption makes expansion visible -->
On its February 13, 2025 earnings call for Q4 2024, Datadog reported that 50% of customers used four or more products, versus 47% a year earlier, and 26% used six or more, versus 22%.

Breadth of product adoption diagnoses expansion better than logins. However, it is associated with customer size and maturity; without an experiment, you cannot claim that adding a fourth product itself raises NRR. In your own dashboard, store breadth of adoption by account alongside contribution margin and growth in paid consumption.

<!-- section: theory | GitLab: large-customer growth matters more than the user-to-customer ratio -->
For fiscal 2025, ending January 31, 2025, GitLab reported 9,893 customers with ARR above $5,000, up 15%; 1,229 customers with ARR above $100,000, up 29%; and net revenue retention of 123%. These are nested value thresholds within the customer base.

Customers above $5,000 are not all paying customers, and cumulative registered users are not an account cohort for free-to-paid conversion. Dividing one by the other creates a false “open-edition conversion” rate. A proper system links users, workspaces and commercial accounts, showing large-customer growth separately from cohort monetization.

<!-- section: theory | A minimum set to start with -->
1. Vocabulary and identity: one account ID, parent/subsidiary rules, contractual ARR separate from consumption run rate, and owners for every metric.
2. A mature end-to-end cohort: visitor or signup, activation, PQA, qualified lead, opportunity, win, with separate self-service and open-edition routes and a visible “unknown” category.
3. Financial reconciliation: ARR bridge, NRR, GRR and logo churn, acquisition and expansion cost allocation, actual cohort payback.
4. Operational forecasting: pipeline snapshots, stage-transition criteria, remaining-target coverage, slippage and weighted error at fixed horizons.
5. Product outcomes: value event, activation window, time to value alongside nonactivation rate, account and workload retention, gross margin per unit.
6. Marketing validation: sourced and influenced pipeline separately, first touch, last touch and self-report together, and one measurable lift experiment.

The system is ready when marketing, sales, product and finance get the same numbers under the same definition, can reconstruct the original denominator and explain differences from external benchmarks. If no universal range exists for your model, use your own mature cohorts and verifiable experiments instead.

<!-- quiz -->
? In Pulumi's case study, 27% of qualified leads came through community signals. What does this number measure?
- A 27% increase in win rate after implementing the community tool || The case study does not report wins.
- The share of annual revenue contributed by community customers during the quarter || The case study does not report revenue.
+ The share of booked meetings, without a link to pipeline or revenue || The author defines these leads as meetings.
? Snowflake reports net revenue retention of 126%. How should this be read?
+ Cohort revenue grew 26% over a year, churned customers count as zero, and an individual account may shrink || This is cohort revenue, not a promise to each account.
- Every Snowflake customer increased consumption by 26% over the year || A cohort average does not describe everyone.
- The company's contractual ARR grew 26% through renewals || This is a consumption metric, not an ARR snapshot.
? Why cannot GitLab customers with ARR above $5,000 be divided by registered users?
- Because GitLab does not disclose registered-user counts in reports || Disclosure is not the issue.
+ These are different entities, and the ratio creates a false open-edition-to-paid conversion rate || Numerator and denominator must use the same unit.
- Because the $5,000 and $100,000 thresholds are too high for the comparison || The thresholds are irrelevant here.
<!-- /quiz -->

<!-- section: task | Task: your minimum set -->
Complete the task in the document on this page. Go through the six minimum-set items and record what you already have, what is missing and who will own each. Choose one item to complete in the next month and write the first three steps. Then find one public number about a competitor or a company you use as a model and analyze it following the lesson's stories: source fact, definition and a lesson for your system.

<!-- section: sources -->
- Common Room, Pulumi case study — https://www.commonroom.io/customers/pulumi-signals-meetings-booked/
- Cognism, Inside Inbound 2026 — https://www.cognism.com/reports/inside-inbound-2026
- PostHog, experiment walkthrough video — https://www.youtube.com/watch?v=WyYPPSyKmXo (15.09.2025)
- PostHog, per-product activation — https://posthog.com/handbook/growth/growth-engineering/per-product-activation
- Snowflake, fiscal 2025 results — https://www.snowflake.com/en/news/press-releases/snowflake-reports-financial-results-for-the-fourth-quarter-and-full-year-of-fiscal-2025/ (26.02.2025)
- Datadog, Q4 2024 earnings-call transcript — https://investors.datadoghq.com/static-files/d923379a-cb66-40a9-bc83-2ef334c322d4 (13.02.2025)
- GitLab, fiscal 2025 results — https://ir.gitlab.com/news/news-details/2025/GitLab-Reports-Fourth-Quarter-and-Full-Fiscal-Year-2025-Financial-Results/default.aspx
