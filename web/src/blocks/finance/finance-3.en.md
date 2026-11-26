<!-- lesson: finance.metrics | Subscription business metrics: exact formulas and where they mislead | 30 -->
<!-- section: hook -->
At a board meeting, an investor asks about burn multiple, CAC payback and NRR. The founder, whose model was built by a fund analyst, does not know how they were calculated. Worse, the same metric can mean different things in different reports: SaaS Capital, High Alpha and Bessemer use their own definitions. Even monthly churn of 2% translates to 21.5% annually, not 24%. This lesson provides precise definitions and examples, explains where LTV and CAC mislead, and shows which benchmarks you can use in 2026.

<!-- section: theory | Data rules first -->
Before building a dashboard, document the rules without which no metric is reproducible: who counts as a customer (the billed legal entity or a corporate group); the time zone and cutoff for a period; how taxes, FX, credits and refunds, subscription pauses and cancellations, trials and discounts are treated. Keep three distinct numbers: the annual value of active contracted subscriptions (contracted ARR), annualized usage (usage run-rate), and US GAAP revenue. The definitions document has an owner and version number; do not change definitions between investor reports to hide deterioration.

<!-- section: theory | A metric glossary -->
These are the definitions used in this course. They are a chosen policy, not definitions prescribed by US GAAP. When reading another report, first ask how its metrics were calculated.

- **MRR** is the monthly value of active recurring commitments, excluding taxes, one-off services and unsigned deals. An annual $120,000 contract contributes $10,000 MRR; a one-off $20,000 implementation contributes zero.
- **ARR** is twelve times MRR at the measurement date. MRR of $80,000 gives ARR of $960,000; this is not last year’s revenue.
- **Usage run-rate** is twelve times the latest month’s usage revenue or four times the latest quarter’s. With usage of 10, 40 and 10 over three months, the latest-month annualization is 120 and the quarterly annualization 240. State the method.
- **Bookings** is the value of contracts signed during a period. A three-year contract at 100 per year has total value 300 and annual value 100; a renewal is not a new customer.
- **Billings** is invoices issued during a period, excluding taxes. An annual prepayment of 120 produces billings of 120 immediately.
- **NRR**, net revenue retention, is end-of-period revenue from the same customer cohort, including expansion, contraction and churn, divided by its starting revenue. 100 + 20 − 5 − 10 = 105: NRR is 105%. New customers are excluded.
- **GRR**, gross retention, is the same calculation without expansion. (100 − 5 − 10) / 100 = 85%; it cannot exceed 100%.
- **Logo churn** is customers lost from the starting cohort divided by starting customers. Five out of 100 means 5%.
- **CAC** is fully loaded new-customer acquisition spending (salaries, contractors, tools and advertising) divided by new paying customers, with a chosen time lag. Spending 120 to acquire 20 customers gives CAC of 6.
- **CAC payback** is CAC / (new-customer monthly revenue × gross margin). 6,000 / (500 × 0.8) = 15 months.
- **LTV** is monthly customer revenue multiplied by gross margin and divided by monthly churn. 500 × 0.8 / 0.02 = 20,000; this is a model, not an observed customer value.
- **Gross margin** is (revenue − full cost of service delivery) / revenue. “Revenue minus the AWS bill” overstates it.
- **Burn multiple** is net cash burn divided by net new ARR over the same period. Burn of 600 with ARR growth of 300 gives 2.0. Do not calculate it when ARR has not grown.
- **Rule of 40** is revenue growth in percent plus free-cash-flow or EBITDA margin. Growth of 50% with a margin of −20% gives 30.
- **Magic number** is quarterly revenue growth multiplied by four and divided by the previous quarter’s S&M spending. (300 − 250) × 4 / 200 = 1.0.
- **ARR per employee** is period-end ARR divided by employee count; calculate a separate variant including contractors.

Monthly churn of 2% gives annual churn of 1 − 0.98¹² = 21.5%, because each month’s churn applies to a smaller base.

<!-- section: theory | Where LTV, CAC and margins mislead -->
The churn-based LTV formula assumes similar customer behavior and a sufficiently mature sample. If ten customers have no churn over three months, LTV does not become infinite. You cannot put NRR above 100% into the denominator instead of churn: the result is meaningless. A more reliable approach tracks each cohort’s gross profit by month over a limited horizon.

Payback is also better calculated by cohort. Acquisition cost 120, and quarterly cohort gross profit was 20, 25, 30, 35 and 40. By the end of quarter four, cumulative profit is 110. The remaining 10 is recovered in 10 / 40 × 3 = 0.75 months of quarter five, giving 12.75 months total. This is more accurate than dividing today’s average revenue across all customers by last month’s spending. Annual prepayments recover cash earlier than economic cost, so show both measures.

Margin depends on revenue mix. Customer-hosted software subscriptions might earn 85%, cloud services 55% and implementation 30%. With equal revenue of 100 each, blended margin is 56.7%. If services grow to 200 at the same margin, blended margin falls to 50%, although no product worsened. Calculate margins by product and, for cloud services, each customer’s contribution: revenue minus variable cloud resources, traffic and support.

<!-- section: theory | Choosing benchmarks -->
2026 benchmarks are useful when read alongside their samples.

- High Alpha and Visible surveyed more than 500 companies for their 2026 report, three quarters from the US. Among companies with ARR of $1–5 million, those founded since 2022 had median growth of 185%, compared with 32% for older companies. The AI generation changes the picture; mixing those figures with ordinary infrastructure is dangerous.
- SaaS Capital’s July 2026 survey of over a thousand private companies reported median ARR per employee of $141,000; for companies with ARR of $1–3 million, it was $110,000.
- For bootstrapped companies with ARR of $3–20 million, SaaS Capital reported median growth of 15%, NRR of 103% and GRR of 91% in April 2026.
- In 2025 retention data, companies with average annual contracts below $12,000 had NRR of 98% and GRR of 90%; above $250,000, the figures were 106% and 95%.
- Bessemer wrote in 2024 that investors in early loss-making companies look at burn multiple and prefer 1–1.5. This is an investor preference, not a market median.

There is no single fresh benchmark for CAC payback, magic number or cloud-service margin specifically covering US infrastructure startups from pre-seed through Series B. Instead of inventing precision, set your own thresholds: annual GRR below 90% triggers a retention review; CAC payback beyond 18 months pauses channel scaling; burn multiple above 2 for two consecutive quarters triggers reforecasting; production-service margin falling by more than five points triggers a cost review.

<!-- section: theory | Open source, usage and contract expansion -->
For an open-source project, measure the funnel by organizations: active organizations, production users, qualified companies, paying customers and expanding customers. Downloads and stars are neither ARR nor customer acquisition. Developer relations and the free tier belong in acquisition economics, even if booked under R&D or COGS.

Usage revenue equals volume times the effective unit price after tiers, discounts, credits, included usage and minimum commitments. If a customer prepays a minimum annual commitment of 120 but uses 8 monthly, 24 remains unused at year-end. Its treatment depends on the contract and revenue recognition rules. Track commitment utilization, overages, credit expiry, unbilled usage and unit margin.

An escalating-payment contract, for example 60 in year one, 120 in year two and 180 in year three, has total value 360 and average annual value 120; current ARR in year one is 60. “Exit ARR of 180” can be shown only as a separate future contracted revenue line.

<!-- quiz -->
? A customer cohort started the year at 100, expanded by 20, contracted by 5 and churned by 10. What are NRR and GRR?
+ NRR 105% and GRR 85%: expansion is included only in the first metric || NRR includes expansion; GRR includes only losses.
- NRR 105%, GRR 105%, because both metrics use the same customer cohort || GRR excludes expansion and cannot exceed 100%.
- NRR 85%, GRR 105% || It is the reverse: only NRR includes expansion.
? Monthly customer churn is 2%. What is annual churn?
+ About 21.5%: each month, 98% of the previous base remains || 1 − 0.98¹² ≈ 21.5%: each month’s churn applies to a smaller base.
- 24%: twelve times two percent || The base shrinks each month, so this calculation is wrong.
- About 2%, because churn is an average monthly measure and cannot be annualized || Annual churn can be calculated and is much larger than monthly churn.
? Ten customers have had no churn over three months. What LTV does the churn formula produce?
+ The formula is inapplicable: ten customers over three months is too small and young a sample || Zero churn does not make LTV infinite; track cohort profit by month.
- Infinite, which is a strong argument for investors in the next funding round || Infinite LTV indicates that the formula has broken down.
- Three months of revenue, because the company has no more data yet || LTV describes the entire customer lifetime; three months of revenue cannot replace it.
<!-- /quiz -->

<!-- section: task | Task: define your company’s metrics -->
Complete the task in the document on this page. Write your data rules: who counts as a customer, when periods close, and how you treat taxes, currencies, credits, refunds and trials. Using your data, calculate MRR and ARR, annual NRR and GRR, logo churn, CAC and payback, gross margin by product and burn multiple. For every metric, record the formula and data source and set a threshold that will trigger investigation.

<!-- section: sources -->
- High Alpha, Visible. Startup Benchmarks 2026 — https://saasbenchmarks.highalpha.com/ (2026)
- SaaS Capital, ARR per employee 2026 — https://www.saas-capital.com/blog-posts/revenue-per-employee-benchmarks-for-private-saas-companies/ (July 30, 2026)
- SaaS Capital, bootstrapped company metrics 2026 — https://www.saas-capital.com/blog-posts/benchmarking-metrics-for-bootstrapped-saas-companies/ (April 24, 2026)
- SaaS Capital, retention 2025 — https://www.saas-capital.com/wp-content/uploads/2025/09/RB32WS1-2025-B2B-SaaS-Retention-Benchmarks.pdf (September 2025)
- Bessemer. The Rule of X — https://www.bvp.com/atlas/the-rule-of-x (2024)
- David Skok. TRUE LTV — https://www.forentrepreneurs.com/ltv/ (2015)
- ChartMogul documentation — https://help.chartmogul.com/ (checked November 25, 2026)

<!-- lesson: finance.model | A hiring-driven financial model: budgets, forecasts and actuals | 26 -->
<!-- section: hook -->
In 2016, Buffer grew from 34 to 94 people in a year, then laid off ten because cash was insufficient: hiring had outpaced cash. Founders need financial models to see the consequences of hiring, pricing and sales decisions, not to show investors three years of precise P&L forecasts that cannot exist. This lesson covers a model built around hiring, forecasting revenue without a drawn exponential curve, and comparing plan with actuals every month.

<!-- section: theory | Structuring the spreadsheet -->
Build monthly forecasts for 24–36 months, detailing the first year. Separate history from forecast, color input values and avoid hardcoded numbers inside output formulas. Useful sheets include: settings (version, actuals cutoff, selected scenario, author and key assumptions); a locked ledger export; customers with contracts, prices, dates and payment terms; revenue bridging opening ARR through new customers, expansion, contraction and churn; usage and unit costs; a person-by-person hiring plan; other expenses by vendor; working capital (payment delays, prepayments and deferred revenue); equipment, debt and equity; the three statements; budget versus actuals; scenarios; and checks. Checks are mandatory: the balance sheet balances, direct and indirect cash flow agree, cash matches the bank, the ARR bridge reconciles, and deferred revenue agrees with its schedule.

Free SCORE templates and David Skok’s SaaS cash-trough model are useful starting points, but you must update taxes, pricing and revenue recognition policies yourself.

<!-- section: theory | Hiring is the main lever -->
People consume most startup cash, so hiring is the model’s main controllable driver. An engineer earns 180 annually, estimated employer taxes are 8%, and benefits cost 18 annually. Fully loaded monthly cost is 180 / 12 × 1.08 + 18 / 12 = 17.7. Recruiting of 20 and equipment of 3 are paid on hiring. A July 1 start costs 6 × 17.7 + 23 = 129.2 through year-end. Delaying two such engineers from July to October saves 2 × 3 × 17.7 = 106.2 this year. But product delivery may slip, so the scenario must change revenue too; otherwise the savings are fictitious.

Distinguish three hiring statuses: offer accepted, role approved and role under discussion. Headcount is not the number of names: a part-timer is 0.5, a mid-month start reduces that month’s cost, and contractors are separate. Before each hire, verify an approved budget slot, an owner and start date, fully loaded cost, downside-runway impact and the goal requiring that person. Options create separate dilution and a separate stock-compensation expense schedule.

<!-- section: theory | Revenue forecasts without a drawn exponential curve -->
Forecast revenue from what produces it. For self-service purchases: new paying customers equal qualified signups times activation and paid-conversion rates, followed by cohort retention and average revenue. For enterprise sales: new bookings equal productive salespeople times quota times attainment, allowing for rep ramp-up, sales cycles and implementation capacity. Do not add the CRM forecast to sales-capacity forecasts: one validates the other.

Example: two salespeople with annual quotas of 600 thousand and attainment of 60% generate 720 thousand in annual new bookings. If the second salesperson works at 50% productivity for the first six months and at full productivity for the second six months, effective capacity is 1 + 0.5 × 0.5 + 0.5 × 1 = 1.75 reps, or 630 thousand instead of 720 thousand. An annual 120 thousand contract signed in December contributes almost no revenue that year.

A discount changes more than it seems. A million units at ten cents generates 100 in revenue; delivery cost of four cents per unit is 40, leaving gross profit of 60. A 20% discount at the same volume gives revenue of 80 and profit of 40: price fell 20%, but profit fell 33%. Restoring profit of 60 requires selling 1.5 million units, 50% more. A discounted annual prepayment improves cash but reduces lifetime contract profit; the decision must show both lines.

<!-- section: theory | Plan versus actuals -->
After each monthly close, compare the plan with actuals and explain variances. Planned usage revenue was 100, actual 90: volume contributed −15 and price/mix +5. Planned hosting was 40, actual 46: volume −6, unit cost +8 and expired credits +4. Planned salaries were 150, actual 140: a vacancy was filled later, so this is timing, not permanent savings. Planned collections were 100, actual 65: revenue contributed −10 and a customer delayed 25.

Positive expense variance is unfavorable; positive revenue variance is favorable. Store favorable/unfavorable in a separate column so the dashboard does not color everything alike. Keep the original annual budget, latest forecast and actuals side by side; do not rewrite the budget to match actuals. Reforecast quarterly, or immediately after sharp cash changes, major churn or financing changes.

<!-- section: theory | What to show an investor -->
At seed stage, investors need understandable drivers, 18–24 months of cash visibility, hiring milestones, uses of round proceeds, base and downside scenarios, and unit economics. Series A adds historical monthly statements, cohort retention, acquisition channels, sales capacity, renewals, production delivery costs, a revenue-to-cash bridge and past forecast accuracy. The model should explain what verifiable next stage the round buys. Do not promise three years of exact P&L; show how minimum cash changes with growth, margin, hiring dates and payment terms, and when spending cuts become necessary.

<!-- quiz -->
? A founder delays two engineering hires by three months to save money. What else must change in the model?
+ Revenue: the product may launch later, making savings without this adjustment fictitious || Hiring scenarios are connected to revenue drivers.
- Nothing, because hiring only affects company expenses and revenue is independent || Without people, product development and sales move more slowly.
- Only payroll taxes || Taxes move with salary automatically; revenue is the key issue.
? Unit price is cut by 20% and unit cost is 40% of the original price. How much must volume rise to preserve gross profit?
+ By 50%: profit per unit falls from 60 to 40 || Unit profit falls from six cents to four, requiring one and a half times the volume.
- By 20%, the same percentage as the price cut, to offset the discount || The discount consumes unit profit, which is much smaller than revenue.
- By 25%, because the company must recover one fifth of its lost revenue || Calculate using unit profit.
<!-- /quiz -->

<!-- section: task | Task: a model built from hiring -->
Complete the task in the “InfraSeed model” spreadsheet template on this page. On Hiring, list every employee and vacancy for the next 18 months with fully loaded cost and status. If a person works on both cost of revenue and development, repeat the name in two rows with full amounts and enter each row’s share in the “Share of cost, %” column, for example 60 and 40; the Checks sheet verifies that the shares for each name add up to 100%. Build revenue from drivers: signups and conversion, or salespeople and quotas. See how minimum cash changes if you delay two hires by a quarter and simultaneously delay the product launch. Write down the verifiable next stage your next round’s cash should buy.

<!-- widget: template {"file":"infraseed-model"} -->

<!-- section: sources -->
- Buffer, layoffs and next steps — https://buffer.com/resources/layoffs-and-moving-forward/ (June 16, 2016)
- Buffer, December 2016 report — https://buffer.com/resources/people-ops-report-december-2016/ (December 2016)
- SCORE, financial projections template — https://www.score.org/templates/financial-projections-template/ (checked November 25, 2026)
- David Skok. SaaS Economics — https://www.forentrepreneurs.com/saas-economics-1/ (2010)
- Bessemer. The Rule of X — https://www.bvp.com/atlas/the-rule-of-x (2024)
