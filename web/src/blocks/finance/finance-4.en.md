<!-- lesson: finance.safe | SAFEs, rounds and option pools: ownership arithmetic | 30 -->
<!-- section: hook -->
A founder raised two SAFEs at a $10 million valuation, then closed a $5 million round at a $20 million pre-money valuation, expecting to retain about 68%. But the investor required a 10% post-round option pool included in the pre-money valuation, leaving the founder with 59.5%. Nothing illegal happened: that is how option pools work, and their arithmetic is worth understanding before negotiations. This lesson covers cap tables, SAFE conversion, option-pool dilution, liquidation preferences, 409A valuations and monthly investor reporting.

<!-- section: theory | The cap table is a register of rights -->
A cap table records rights, not just percentages. For each holder, record security type, issuance or grant date, share count, option exercise price, invested amount, vesting schedule and vested amount, conversion terms, liquidation preference, voting rights, participation rights in later rounds, fully diluted share count including all options and convertibles, and ownership. Separately record authorized shares, issued shares, the reserved option pool and options already granted. The unallocated pool belongs to nobody and generally has no vote.

SAFEs, common stock and preferred stock carry different rights. A standard Y Combinator SAFE has no maturity date or interest like a convertible note: it converts at the next round under the contract’s rules. A SAFE’s post-money cap is not the common-share price used for employee options.

<!-- section: theory | How a post-money SAFE converts -->
Consider an example with no existing option pool, other convertible securities or discounts, and a future round price above the SAFE cap. The founder owns eight million common shares. SAFE A invests one million at a ten-million post-money cap, giving its investor 10% before the new round and pool. SAFE B invests 0.5 million at the same cap for 5%. The founder retains 85%. Total shares after conversion are 8 / 0.85 = 9.41 million; SAFE A receives 0.94 million and SAFE B 0.47 million. The SAFE share price is one million / 0.94 million = $1.0625.

Next comes a five-million round at a twenty-million pre-money valuation including converted SAFEs, with no pool increase. Round share price is 20 / 9.41 = $2.125; the new investor receives 5 / 2.125 = 2.35 million shares. After the round, the founder owns 68%, SAFE A 8%, SAFE B 4% and the new investor 20%.

Dividing investment by cap is a convenient approximation only when the cap applies. A low-priced round may give a SAFE more ownership; a discount-only SAFE uses the discounted price; when both cap and discount exist, apply the contract’s selection rule rather than multiplying them. SAFE cash is financing when received; conversion is a noncash event. Balance-sheet classification depends on the terms, not the security’s name.

<!-- section: theory | The option pool: who pays for it -->
Continue the example. The investor requires a 10% unallocated pool after the round, included in the twenty-million pre-money valuation. The new investor retains 20%; all prior holders together receive 70% instead of 80%. Before the round, the pool must represent 10% / (1 − 20%) = 12.5% of pre-round capitalization.

| Holder | After SAFEs, before round | Round without pool | Round with 10% pool |
|---|---:|---:|---:|
| Founder | 85% | 68% | 59.5% |
| SAFE A | 10% | 8% | 7% |
| SAFE B | 5% | 4% | 3.5% |
| Unallocated pool | 0 | 0 | 10% |
| New investor | 0 | 20% | 20% |

In shares: add a 1.34-million pool to 9.41 million, giving 10.76 million pre-money shares, a share price of $1.859, and 2.69 million new investor shares. The pool dilutes SAFE holders too: a post-money SAFE does not protect against every future dilution.

If a pool already exists, calculate only the top-up to the target. In negotiations, show a 12–18-month grant plan, promised options and refresh grants: the pool funds specific hiring, and its size is negotiable. Comparing offers only by valuation is dangerous: pool size, liquidation preferences, participation and pro rata rights can change economics more substantially.

<!-- section: theory | Liquidation preference -->
An investor puts in five million for 20% with 1× non-participating preferred stock. On a ten-million sale, it chooses the greater of its five-million preference and 20% of ten million: five million. Common holders get the other five. At a fifty-million sale, conversion to common is better, yielding ten. Debt, fees, seniority across series and participating preferences change this calculation; National Venture Capital Association (NVCA) model documents show how such terms are written.

<!-- section: theory | 409A valuations and options -->
A 409A valuation determines common-stock fair market value for employee option exercise prices; it is not the round’s preferred-stock valuation. An independent valuation is generally updated at least every twelve months, and after a new round, major transaction or material business change before the next option grant. If a common share is worth $0.50, an employee exercising 100,000 options pays $50,000. Financial-statement option expense is calculated separately under ASC 718 using grant-date option fair value; option count times exercise price is not appropriate.

<!-- section: theory | What to send investors -->
The monthly one- or two-page investor update covers cash and its availability; actual and forecast burn; downside runway; the ARR bridge and retention; usage and production-service margin; hiring versus plan; three wins, three risks and two concrete requests. State which periods are closed and which figures remain preliminary. Do not change metric definitions to hide deterioration.

The quarterly board package adds monthly statements and budget comparisons, a thirteen-week cash forecast, a twenty-four-month forecast, cohort retention and revenue concentration, sales capacity and pipeline, the cap table, granted options and the pool, cash placement and compliance exceptions, and decisions with owners and deadlines.

The financial data room for the next round contains closed monthly statements for 24–36 months or the young company’s entire history, ledger exports, budget and forecast assumptions, bank statements and reconciliations, AR and AP lists, customer contracts and revenue schedules, billings-to-revenue reconciliation, metric definitions, tax returns and notices, research-credit support, debt, SAFE and equity documents, the cap table, 409A valuation, payroll summaries, cloud commitments and leases, related-party transactions and accounting policies. Before opening it, reconcile its figures with the investor deck and remove unnecessary personal information.

<!-- quiz -->
? An investor requires a 10% post-round option pool included in pre-money valuation. Who pays for the pool?
+ All prior holders, including the founder and SAFE holders || The new investor retains its share; the pool dilutes pre-round holders.
- The new investor || A pre-money pool does not dilute the new investor.
- Everyone, including the new investor, proportionally to post-round ownership || That would apply to a post-money pool; this one is pre-money.
? An investor with a 1× non-participating preference invested five million for 20%. The company sells for ten million. What does the investor receive?
+ Five million: the preference exceeds its 20% share of the sale price || The five-million preference exceeds 20% of ten million.
- Two million, its 20% of the sale, because preferences apply only in bankruptcy || Preferences apply on company sales, and the investor chooses the greater amount.
- Six million: the preference plus 20% of the remainder || That describes a participating preference; this one is non-participating.
<!-- /quiz -->

<!-- section: task | Task: the round calculator -->
Complete the task in the “SAFE and round calculator” trainer on this page. Enter your SAFEs or the lesson’s example, then a round with pre-money valuation and the required option pool. See how founder, SAFE-holder and new-investor ownership changes. Find the pool size at which your post-round ownership falls below your acceptable threshold and record the hiring plan that justifies the pool.

<!-- widget: finance.round {} -->

<!-- section: sources -->
- Y Combinator, SAFE forms and guide — https://www.ycombinator.com/safe (checked November 25, 2026)
- Y Combinator, post-money SAFE guide — https://www.ycombinator.com/assets/ycdc/Primer%20for%20post-money%20safe%20v1.1-2af8129e12effd9638eeab383b7309142c8f415e5cdb0bc210d573f779177a1c.pdf (checked November 25, 2026)
- NVCA, model documents — https://nvca.org/model-legal-documents/ (checked November 25, 2026)
- IRS, 409A rules — https://www.irs.gov/irb/2007-19_IRB (2007)
- FASB ASC 718, stock compensation — https://asc.fasb.org/ (checked November 25, 2026)

<!-- lesson: finance.revenue | ASC 606 revenue recognition for infrastructure company contracts | 24 -->
<!-- section: hook -->
In September 2024, the SEC charged former executives of advertising company Kubient over about $1.3 million in product-testing revenue recognized even though the tests had not occurred. In 2019, Comscore addressed regulator allegations of roughly $50 million of overstated revenue; restatement and audit work reduced working capital and led to staff cuts. Startups are far from those amounts, but revenue recognition errors surface in the first pre-round audit and are expensive to fix. This lesson applies ASC 606’s five questions to infrastructure company contracts.

<!-- section: theory | Five questions -->
ASC 606, the US GAAP standard for revenue from customer contracts, comes down to five questions. Is there a contract with identifiable rights, payment terms and probable collection? What distinct performance obligations are promised: cloud access, a software license, support, implementation? What is the transaction price after variable consideration, refunds, credits and discounts? How should it be allocated among obligations in proportion to standalone selling prices? When is each obligation satisfied: at a point in time or over time? IFRS 15 is similar, but a US company applies ASC 606.

<!-- section: theory | Contract examples -->
A cloud subscription costs 120 for January 1–December 31, paid upfront. Cash and the customer liability increase by 120; each full month recognizes revenue of 10 and reduces the liability by 10. ARR of 120, cash of 120 and January revenue of 10 are different numbers.

The same contract starts January 15. Allocate revenue over the actual service period using one consistent method, such as daily recognition; do not recognize a full January.

Three years of identical access are billed at 60, 120 and 180 per year. If there is one uniform obligation, revenue is 360 / 36 = 10 per month: rising payments do not mean more service. Separately check for a financing component.

Service access plus distinct implementation has a total contract price of 110 and standalone selling prices of 120 and 20. Allocate 110 × 120 / 140 = 94.29 to access and 15.71 to implementation. Recognize access at 7.86 monthly and implementation upon completion. A “setup 10” invoice line does not determine the revenue allocation.

Setup that merely enables access and provides nothing distinct is not a separate obligation. Allocate its price to the service; the word “nonrefundable” does not make it earned at signing.

March usage of two million units at two cents is invoiced in April. Revenue of 40 belongs in March if service was delivered and price is determinable. Do not wait for processor payout to recognize revenue.

Prepaid credits of 100, with 30 used: revenue is 30 and the liability 70. Unused credits do not automatically become revenue; expiry needs separate analysis.

An invoice for 120 is issued December 15 for service beginning January 1. If the payment right is unconditional, December AR and the customer liability both rise by 120, with no December revenue.

<!-- section: theory | Receivables, contract assets and deferred revenue -->
Three similar concepts are easy to confuse. AR is a payment right for which only time remains before payment is due. A contract asset is an earned right still conditional on something else, such as completing the next milestone. Deferred revenue is an obligation to provide a service already paid or billed. Do not collapse everything into one “unbilled revenue” account.

Other cases need attention. A customer-installed software license may generate revenue on delivery, while support is recognized over its period. Downtime credits, refunds and usage estimates are variable consideration, recognized subject to a constraint against significant later reversal. Cloud-marketplace sales require determining who controls the service, which determines gross versus net revenue. Sales commissions for obtaining a contract may be capitalized and amortized, but that is a separate schedule and must not be used to reduce investor-report CAC.

<!-- section: theory | The revenue register -->
Maintain a revenue register with contract, customer, amendment version, obligation, standalone selling price, allocated price, service start and end, recognition method, currency, monthly revenue, billings, collections, AR, contract asset, deferred revenue and reviewer. With daily straight-line recognition, monthly revenue equals allocated price times service days in the month divided by all service days.

Checks: allocated prices sum to the contract price; cumulative revenue does not exceed what obligations permit; billings and collections reconcile to invoice and cash registers; opening deferred revenue plus advance billings minus recognized revenue plus adjustments equals closing deferred revenue; no obligation is recognized before service starts. Quarterly, an accountant reviews a sample of contracts with escalating payments, implementations, cancellations, free periods and amendments. Billing software calculates invoices; it does not by itself prove revenue is correct.

<!-- quiz -->
? A customer buys service access and distinct implementation for 110, with standalone prices of 120 and 20. How much revenue is allocated to implementation?
+ About 15.7 thousand: the discount is allocated in proportion to standalone prices || Allocate contract price in proportion to standalone prices: 110 × 20 / 140.
- 20, the standalone implementation price, with the remainder allocated to access || The discount is allocated proportionally across obligations.
- Zero, because implementation is part of the subscription and recognized with access || Distinct implementation has its own revenue allocation.
? A three-year contract provides identical access with payments of 60, 120 and 180. What is first-year revenue?
+ 120 thousand, if there is one obligation and access is the same for all three years || Increasing payments do not mean increasing service: revenue is 360 / 36 months.
- 60 thousand, as paid in the first year || Payments and revenue differ when service is uniform.
- 360, because the contract covers the full term and cannot be canceled || Revenue is recognized as service is provided.
<!-- /quiz -->

<!-- section: task | Task: review three of your contracts -->
Complete the task in the document on this page. Choose your three most complex contracts: implementation, escalating payments, usage or credits. Answer the five ASC 606 questions for each, allocate the price among obligations and write a monthly recognition schedule. Note where your answer differs from the accountant’s or billing system’s current treatment and what you will ask the accounting firm.

<!-- section: sources -->
- SEC, charges against former Kubient executives — https://www.sec.gov/enforcement-litigation/litigation-releases/lr-26107 (September 16, 2024)
- SEC, Comscore — https://www.sec.gov/newsroom/press-releases/2019-186 (September 24, 2019)
- Comscore, 2018 Form 10-K — https://www.sec.gov/Archives/edgar/data/1158172/000115817219000020/a201810kscor.htm (2019)
- FASB ASU 2014-09, Topic 606 — https://storage.fasb.org/ASU%202014-09_Section%20A.pdf (May 28, 2014)
- FASB Accounting Standards Codification — https://asc.fasb.org/ (checked November 25, 2026)
