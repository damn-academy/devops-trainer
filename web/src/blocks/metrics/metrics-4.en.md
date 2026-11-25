<!-- lesson: metrics.arr | Recurring revenue: ARR, retention and the revenue bridge | 30 -->
<!-- section: hook -->
A company tells investors its net revenue retention (NRR) is 105%, which sounds trouble-free: the customer base grows by itself. A closer look shows that three large customers doubled, twelve small ones left and another ten reduced their contracts. A year later, the large customers will stop growing and retention will fall below a hundred. This lesson breaks down recurring revenue, how to calculate retention and why one number is never enough.

<!-- section: theory | Five different kinds of money -->
Annual recurring revenue (ARR) is the annual amount of recurring customer commitments at a given date, excluding implementation services and one-time payments. Monthly recurring revenue (MRR) expresses the same thing monthly; ARR equals 12 × MRR only under a consistent annualization method. Four other quantities sit alongside them and are easily confused:

- bookings: commitments signed during the period;
- billings: amounts invoiced to customers;
- recognized revenue: amounts earned during the period under accounting rules;
- cash collections: money received in the bank account.

These five quantities are not interchangeable. A customer signing a three-year contract with annual upfront payment generates a large booking, a large invoice and a large cash receipt, while revenue arrives month by month.

Annual contract value (ACV) is the contract's recurring amount divided by its number of years. A three-year contract with $120,000 in recurring payments and $15,000 for implementation has $40,000 ACV and $135,000 total contract value (TCV). If the contract ramps from $20,000 to $40,000 to $60,000 by year, show the $40,000 average ACV, $20,000 first-year value and $60,000 exit annual amount separately: average ACV is not today's ARR.

<!-- section: theory | Revenue and logo retention -->
For a fixed starting customer base with ARR of `B`, retention is calculated as follows:

- gross revenue retention (GRR) = (B − churned ARR − contraction) / B;
- net revenue retention (NRR) = (B − churned ARR − contraction + expansion) / B;
- logo churn = lost customers from the starting base / starting customers; logo retention = 1 − churn.

New customers are excluded from the retention numerator. Churn means complete loss of the recurring relationship by the end of the window; contraction means a lower amount while the customer remains. GRR cannot exceed 100%; NRR can. For cohort GRR, aggregate changes per customer so that one customer's growth does not offset another's losses.

<!-- section: theory | The annual revenue bridge -->
An illustrative annual recurring revenue bridge, in millions of dollars:

| Movement | ARR | Explanation |
|---|---:|---|
| Start of year | 10.0 | 200 paying customers |
| New customers | +2.5 | Accounts purchasing for the first time |
| Expansion | +1.5 | Growth from the starting base |
| Contraction | −0.4 | Reduction without complete churn |
| Churn | −0.6 | 12 customers from the starting base left completely |
| End of year | 13.0 | No currency effects or mergers in this example |

Thus GRR = (10 − 0.4 − 0.6) / 10 = 90%, NRR = (10 − 0.4 − 0.6 + 1.5) / 10 = 105%, logo churn is 12 out of 200, or 6%, net new ARR is $3 million, and ARR growth is 30%.

Shares are easy to confuse here. Expansion as a share of the starting base is 1.5 / 10 = 15%. Expansion's share of gross additions is 1.5 / (2.5 + 1.5) = 37.5%. Expansion's share of net growth is 1.5 / 3 = 50%, a third metric that becomes unstable with small or negative net growth. Read “expansion generated 40% of growth” only alongside its denominator.

A real bridge adds currency effects, acquisitions and disposals, returning churned customers, refunds and credits, and methodological adjustments. A customer in the starting base who returns within the same window does not become a new logo. Constant-currency analysis separates sales performance from exchange-rate movements.

Monthly retention cannot be mechanically compared with annual retention. At a constant 1% monthly churn rate, annual churn is `1 − 0.99^12 ≈ 11.36%`, because each month's losses come from an already smaller base. Renewal rate uses contracts due for renewal during the period; the entire base is not a suitable denominator.

<!-- quiz -->
? The revenue bridge gives GRR of 90% and NRR of 105%. What do these numbers say together?
- The company loses 5% of revenue because the difference between NRR and GRR is churn || The difference is expansion.
+ The base loses 10% through churn and contraction, while expansion more than offsets it || GRR shows losses; NRR shows losses plus expansion.
- All customers grew by 5% on average, and nobody churned || There was churn, visible in GRR.
? A three-year contract is worth $20,000, $40,000 and $60,000 by year. Which number equals first-year ARR?
+ $20,000 || Today's annual amount is the first year's value.
- $40,000, because ARR equals average ACV over the three years || Average ACV is not today's ARR.
- $120,000, the full recurring contract value || That is the value across all years.
? Monthly logo churn is a constant 1%. What is annual churn?
- 12%, because monthly churn is multiplied by twelve months || Churn is calculated on a shrinking base.
- About 1%, because monthly and annual churn coincide with a constant base || Annual churn accumulates.
+ About 11.36% || 1 − 0.99 to the twelfth power.
<!-- /quiz -->

<!-- section: task | Task: your company's revenue bridge -->
Complete the task in the document on this page. Build an ARR bridge for the last twelve months: opening balance, new customers, expansion, contraction, churn and closing balance. Check that the opening balance plus movements equals the closing balance. Calculate GRR, NRR and logo churn, then examine what share of expansion came from the five largest customers.

<!-- section: sources -->
- Benchmarkit, 2026 B2B SaaS & AI-Native Performance Benchmarks — https://www.benchmarkit.ai/_files/ugd/2a084b_f19d7f96a9e24aba9202e01224d0dbcc.pdf (pp. 36–42)
- KeyBanc Capital Markets and Sapphire Ventures, SaaS Survey 2024 — https://www.cfodesk.co.il/wp-content/uploads/2024/10/2024_kbcm_sapphire_saas_survey.pdf (pp. 4–5)

<!-- lesson: metrics.efficiency | Growth efficiency: magic number, acquisition cost and payback | 28 -->
<!-- section: hook -->
Two founders compare metrics at a conference. The first has acquisition payback of 7.5 months, the second 12.5, and the second feels discouraged. It turns out the second allocates all sales and marketing costs to acquisition, including work with existing customers, while the first includes only new-customer costs. The companies are identical; their accounting policies differ. This lesson explains how to calculate growth efficiency so that a number can at least be compared with itself a quarter later.

<!-- section: theory | Magic number and ARR efficiency -->
“Sales efficiency” is ambiguous, so label every formula. The quarterly revenue-based magic number is:

`magic number = 4 × (quarterly recurring revenue − previous-quarter revenue) / previous-quarter sales and marketing expense`.

If quarterly recurring revenue grew from $3 million to $3.3 million and previous-quarter sales and marketing expense was $1.5 million, the magic number is `4 × 0.3 / 1.5 = 0.8`. The factor of 4 annualizes quarterly revenue. Some surveys, including the 2025 Benchmarkit and Pavilion glossary, print magic number without that factor. These numbers cannot be compared automatically: read the formula notes first.

Three more ARR-based metrics:

- Gross ARR efficiency = (new-customer ARR + expansion ARR) / previous-quarter sales and marketing expense.
- Net ARR efficiency = (new + expansion − contraction − churn) / the same expense.
- New-logo cost ratio = acquisition expense / new-customer ARR. It shows dollars spent per dollar of new annual revenue, not the cost of acquiring one customer.

With $1.5 million in gross additions, $0.3 million in losses and $1.5 million in previous-quarter expense, gross efficiency is 1.0 and net efficiency 0.8. ARR is already annual; multiplying it by 4 is a mistake.

<!-- section: theory | Acquisition cost and payback -->
Customer acquisition cost (CAC) is fully loaded new-customer acquisition expense divided by the number of acquired paying customers. Gross-margin-adjusted payback in months is CAC divided by monthly gross profit per acquired customer. With aligned periods and steady monetization, it can be estimated as:

`payback = 12 × acquisition expense / (new-customer ARR × recurring-revenue gross margin)`.

For example, acquisition expense is $600,000; 30 new customers bring $1.2 million in annual revenue at an 80% gross margin. CAC is $20,000, monthly revenue per customer is $3,333, monthly gross profit is $2,667, and payback is 7.5 months. Including the entire $1 million in sales and marketing expense, with expansion and retention work, produces 12.5 months. Marketing did not get worse; only the cost-allocation policy changed. This difference separated the two founders in the opening story.

Cohort payback is more precise: the first month when the customer cohort's cumulative actual gross profit catches up with its acquisition expense. It captures churn, gradual consumption growth and actual margins. Allocate expansion and support costs under your policy either to CAC or to subsequent profit; the key is neither losing nor double-counting them. Annual prepayment improves cash collections but does not automatically shorten economic payback measured through gross profit.

For an infrastructure company, cost of revenue includes cloud compute, storage and networking, third-party models and support work. An 80% gross margin from software-subscription surveys is not a norm for products with AI inference or expensive data-processing infrastructure.

<!-- section: theory | Customer lifetime value -->
Simplified customer lifetime value (LTV) is monthly revenue per account × gross margin / monthly logo churn. The formula works only with stable churn and a homogeneous base without material expansion. When NRR exceeds 100%, do not substitute negative net churn, or value becomes negative or infinite. Observed discounted cohort gross profit over a limited horizon, such as five years, is more reliable.

Use survey benchmarks cautiously: Benchmarkit's 2026 report gives median payback of 16 months for 2025, 11 months for contracts below $5,000 and 22 months for contracts between $50,000 and $100,000. Large-contract economics cannot be judged by small-contract payback.

<!-- quiz -->
? Quarterly recurring revenue grew from $3 million to $3.3 million; previous-quarter sales and marketing expense was $1.5 million. What is the annualized magic number?
- 0.2: revenue growth divided by expense, without adjustments || Quarterly growth is annualized.
+ 0.8 || 4 × 0.3 / 1.5.
- 3.2, because ARR is also multiplied by four to obtain an annual figure || ARR is already annual and must not be multiplied.
? The same company gets payback of 7.5 or 12.5 months depending on included costs. What should it do?
+ Record the cost-allocation policy and compare only numbers under the same policy || Both figures are valid under their respective rules.
- Choose the lower figure because investors compare companies using the best value || A lower figure without a policy is misleading.
- Take the average, 10 months, to avoid overstating or understating the result || The average of two policies describes neither.
? Why cannot the simple LTV formula be used when NRR exceeds 100%?
- Because with high retention, lifetime value always equals annual revenue || That is not true.
- Because the formula ignores gross margin, which falls at high NRR || Margin is in the formula.
+ Net churn becomes negative, producing a negative or infinite value || Use cohort gross profit over a limited horizon.
<!-- /quiz -->

<!-- section: task | Task: payback under your policy -->
Complete the task in the document on this page. Record your cost-allocation policy: which sales and marketing expenses belong to new-customer acquisition and which to expansion and retention. Calculate last quarter's CAC and payback using the gross-margin formula. Then take the cohort acquired a year ago and check which month its cumulative gross profit caught up with acquisition costs.

<!-- section: sources -->
- Benchmarkit and Pavilion, SaaS Performance Benchmarks 2025, Glossary — https://5242563.fs1.hubspotusercontent-na1.net/hubfs/5242563/Pavilion%20Benchmarkit%202025%20SaaS%20Performance%20Benchmarks.pdf
- Benchmarkit, 2026 B2B SaaS & AI-Native Performance Benchmarks — https://www.benchmarkit.ai/_files/ugd/2a084b_f19d7f96a9e24aba9202e01224d0dbcc.pdf (pp. 10–13)
