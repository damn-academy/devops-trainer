<!-- lesson: finance.close | Weekly bookkeeping and month-end close: responsibilities and preventing theft | 26 -->
<!-- section: hook -->
In December 2024, US-Canadian bookkeeping company Bench, which kept the books for thousands of small companies, announced it was shutting down. Another company bought its assets but did not assume its obligations to customers, and many startups lost access to their books for several weeks before tax filing. Books “handled by someone else” remain the founder’s responsibility. This lesson covers who does what in a small US company’s finances, a day-by-day month-end close, bank and processor reconciliation, and simple rules that stop one person from quietly taking money out.

<!-- section: theory | Who is responsible for what -->
Startup accounting involves several roles; one job title does not cover them all. The bookkeeper imports statements, categorizes transactions, manages receivables and payables and reconciles the bank. The controller or accounting firm owns US GAAP policies, unusual contracts, deferred revenue, options and the monthly close. The CFO, often a fractional CFO working a few hours a week, builds budgets, cash forecasts, scenarios and board reports. The tax CPA prepares federal and state returns and the research tax credit study. The CEO signs returns after reviewing them and approves payments.

In a team of five to ten, roles may overlap, but preparing and approving a payment must remain separate actions by different people. The bookkeeper prepares the payment batch; the founder releases it. A new vendor or a change in bank details is confirmed by calling a previously known number and by a second employee.

<!-- section: theory | The weekly rhythm -->
Two or three times a week, import bank statements, collect receipts and investigate failed or suspicious payments: no large unexplained expense should sit unresolved for more than a few days. Every week, update overdue receivables, the payment calendar, cash for the next payroll and the thirteen-week cash forecast covered in the next lesson. Every overdue customer invoice has an owner and a promised payment date.

<!-- section: theory | Month-end close, day by day -->
Closing the month is the work that makes that month’s statements ready for investors. Plan it by days after month-end:

- Three days before month-end, remind employees of document deadlines, collect new contracts and staffing changes, and review unfinished projects.
- In the first two days, import bank, card, payment processor and payroll statements and close the usage accounting period.
- By day four, reconcile cash, the processor account, receivables, payables and payroll liabilities to statements.
- By day five, accrue cloud hosting, expense the relevant share of prepayments, record depreciation and update commission and revenue schedules.
- By day seven, review deferred revenue, accrued revenue and doubtful-debt allowances; send disputed contracts to the accounting firm.
- By day eight, read the P&L, balance sheet and cash flow, compare them with budget, and explain every variance exceeding both 5% and $5,000.
- By day ten, the CEO and CFO review the report, lock the period against changes and send it to investors.

Quarterly, also review estimated taxes, presence in new states, headcount, the cap table, cash placement and system access. Annually, prepare the tax package and option share valuation, and review accounting policies.

<!-- section: theory | Reconciliation is not automatic matching -->
Bank reconciliation means comparing the book balance with the statement and explaining every difference; an “everything matches” button does not do this. For a processor such as Stripe: opening balance plus customer payments minus refunds, disputes and fees minus payouts to the bank equals closing balance. A bank payout must not be recorded as revenue a second time. For payroll, accrued wages, employer taxes and insurance equal expense; transfers to employees and tax authorities settle liabilities. For AR, opening balance plus invoices minus credit notes, collections and write-offs equals closing balance. Separately review debts overdue by 30, 60, 90 or more days.

An accrual example: on March 31, the cloud provider has not sent its invoice, but the console shows March usage of $18,000. Record March expense and an accrued liability of 18. In April, reverse the accrual and record the invoice of 18.6, showing the 0.6 difference separately. Do not retain both the accrual and invoice: that doubles the expense. If a material error is found in a closed period, the accounting owner decides how to correct it; do not quietly edit the old line.

<!-- section: theory | Controls you can introduce tomorrow -->
A small set of rules covers most risks. Confirm changed vendor bank details by calling a previously verified number and obtaining a second employee’s approval, recording the old and new details. Someone else, such as a board member, approves the founder’s expenses. Every auto-renewing contract has an owner, renewal date and cancellation deadline, with reminders 60 and 30 days ahead. A large one-off payment, for example over $5,000, requires budget-owner and finance approval; above $25,000, require another person at the bank, using two electronic approvals. Two signatures on a PDF do not provide that protection. Every card has an owner and limit; there are no shared logins. An independent person reviews manual entries and payments monthly.

Two approvals are an internal control, not a Delaware or IRS requirement. In a small team, the bookkeeper can prepare payments, the CEO release them, and an outside accountant review statements and unusual entries monthly. The key is that one person cannot create a vendor, change its account, send money and reconcile the transaction alone.

<!-- section: theory | Documents and retention periods -->
The IRS gives a general income-tax record retention period of three years, six for substantial income understatement, seven for certain bad-debt claims, and at least four for employment-tax records. A sensible startup policy is stricter: retain source documents, entries, close packages and banking and tax confirmations for at least seven years; retain the charter, board resolutions, cap table, share issuances, 83(b) elections, IP assignments and QSBS documentation permanently.

The Bench lesson is that access to your books must not depend on one supplier. Every month, export journal entries, the trial balance, AR and AP lists, the revenue schedule and transaction attachments. Quarterly, try to reconstruct a selected month from the export.

<!-- quiz -->
? A vendor emails new bank details. What should you do before the first payment to them?
- Send a small payment to the new details and, if the vendor does not complain, transfer the rest || The test payment goes to the fraudster just like the main payment.
- Reply to the email and ask for the details to be confirmed, then pay once the vendor confirms them || If the vendor’s email is compromised, the fraudster will provide confirmation.
+ Call the vendor on a previously known number and have a second employee confirm the change || Bank-detail substitution is a common theft scheme; verification through a known channel stops it.
? The cloud provider’s invoice has not arrived by the end of March. What should happen to March’s expense?
+ Accrue it using console data and replace the accrual with the invoice in April || March expense belongs in March; otherwise the month’s margin is wrong.
- Nothing: the expense appears in April with the invoice || That makes March look better and April worse than they actually were.
- Record both the March expense and the April invoice || This doubles the expense; reverse the accrual when the invoice arrives.
<!-- /quiz -->

<!-- section: task | Task: close calendar and control matrix -->
Complete the task in the document on this page. Schedule your company’s close by days after month-end: what is done, by whom, and who reviews it. Then build a control matrix: for each lesson risk, record the rule you will introduce, who executes it and where evidence is retained. Separately check whether anyone can single-handedly create a vendor, change its bank details and send it money.

<!-- section: sources -->
- Bench, transition questions following shutdown — https://www.bench.co/transition-faqs (event December 27, 2024; checked November 25, 2026)
- IRS, how long to keep records — https://www.irs.gov/businesses/small-businesses-self-employed/how-long-should-i-keep-records (checked November 25, 2026)
- Stripe, reconciliation and revenue recognition — https://docs.stripe.com/revenue-recognition (checked November 25, 2026)

<!-- lesson: finance.runway | Cash and runway: a 13-week forecast, scenarios and where to keep money | 30 -->
<!-- section: hook -->
When Silicon Valley Bank collapsed in March 2023, payroll service Rippling had $545 million in customer funds trapped there, intended for salaries. It urgently raised $500 million and established an alternative payment route. Roku held about $487 million at the same bank, a quarter of its cash. Startup founders rarely face those amounts, but the question is the same: will there be enough for the next payroll if something goes wrong? This lesson covers burn and runway, building a thirteen-week forecast in a day, testing survival without the next round, and where to keep money after a bank collapse.

<!-- section: theory | Calculating cash burn -->
Agree on definitions first, because “burn” means different things in conversation. Gross operating burn is all monthly operating payments, excluding equipment purchases, debt principal and financing. Net operating burn is operating payments minus customer collections and interest, or negative operating cash flow. All-in burn also includes equipment purchases and mandatory debt principal repayments. InfraSeed from the previous lesson has annual gross burn of 820, or 68.3 per month; net burn of 60 annually, or 5 monthly; and burn including equipment of 8 monthly.

Naive runway for InfraSeed is 1,704 divided by 5, or about 340 months (340.8 exactly). This is meaningless: it relies on two annual prepayments, second-half growth and no new hires. The right headline measure is the month or week in which forecast unrestricted cash first falls below the minimum buffer. Dividing cash by burn is a quick indicator, not a promise. If net burn is negative, write “cash does not run out under these assumptions”; there is no negative runway.

Exclude restricted deposits, untouchable customer funds, unreceived SAFEs and promised but unsigned rounds from available cash. Deferred revenue does not legally restrict cash, but it obliges you to deliver services, so the model must reserve money for them.

<!-- section: theory | The 13-week forecast -->
A thirteen-week cash forecast is a founder’s main tool and can be assembled in a day. Create two sheets. On Events, each row represents one expected payment or receipt: bank, currency, counterparty, type, original date, latest expected date, amount, confidence, scenario, owner, actual date and amount, and document. On Weekly, create thirteen columns of Monday dates.

Weekly rows include: opening cash (the reconciled bank balance for week one); existing AR collections by expected payment week, regardless of revenue month; renewals and prepayments by contract date; usage collections allowing for billing and payment delays; wages, payroll taxes and benefits by payment calendar; hosting based on usage forecasts, invoice dates and credit expiry; approved vendor invoices; taxes, legal and insurance; other approved spending; equipment purchases and debt principal separately; and financing separately, with no unsigned round in the base case. At the bottom: closing cash, a minimum buffer (for example, the next payroll, taxes and four weeks of mandatory payments), and headroom above the buffer, highlighted red when negative.

Example: opening cash 500 and a floor of 150, in thousands. Customers pay 30 weekly, with a large payment of 100 replacing the usual 30 in week three. Payroll including taxes is 100 every two weeks, hosting 20 weekly, other expenses 10 weekly and 40 in week five.

| Week | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Customers | 30 | 30 | 100 | 30 | 30 | 30 | 30 | 30 | 30 | 30 | 30 | 30 | 30 |
| Payroll | 0 | 100 | 0 | 100 | 0 | 100 | 0 | 100 | 0 | 100 | 0 | 100 | 0 |
| Hosting | 20 | 20 | 20 | 20 | 20 | 20 | 20 | 20 | 20 | 20 | 20 | 20 | 20 |
| Other | 10 | 10 | 10 | 10 | 40 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 |
| Closing | 500 | 400 | 470 | 370 | 340 | 240 | 240 | 140 | 140 | 40 | 40 | −60 | −60 |

Cash falls below the floor in week eight and cannot cover payroll in week twelve. If the 100 due in week three slips to week six, weeks three to five end 70 lower but stay above the floor, and from week six the table is unchanged. A delay past the low point is what hurts: if the 100 arrives only after week twelve, the shortfall in week twelve grows to 130. An annual P&L will not show this. Act before week eight: accelerate collections, postpone optional spending and review hiring. An unclosed round belongs in a separate upside scenario, not something to rely on.

Update the forecast every Friday: freeze the previous version, replace the elapsed week with bank actuals, explain variances (timing, amount or omitted payment), add week fourteen, and have every AR owner confirm expected dates. Record forecast accuracy separately: actual versus forecast closing cash. Do not rewrite the old forecast retrospectively.

<!-- section: theory | Scenarios and the survival test -->
Keep downside and upside scenarios alongside the base case. In the downside, new sales are 30% lower and the sales cycle 60 days longer; the largest customer halves its renewal; unfilled roles are frozen; cloud credits expire and unit costs rise 20%; customers pay 30 days later and one large customer goes unpaid for 90 days; there is no financing. In the upside, sales growth cannot exceed delivery capacity, and hiring follows cash or margin thresholds.

In 2015, Paul Graham proposed the “default alive or default dead” test: does a company reach break-even at current growth and spending before cash runs out? Example: fixed costs of 100 per month, current revenue 80, gross margin 75%, revenue growing 5% monthly, immediate customer payment. Current gross profit is 60; break-even revenue is 100 / 0.75 = 133.3, reached after 11 months of growth. Cumulative burn during those months is about 248. With cash of 400 and a floor of 100, the company is default alive, ending with 152; with 300, it is not. Hiring or collection delays can change the answer, so calculate the test using cash after working capital, taxes and equipment; EBITDA is unsuitable.

<!-- section: theory | Where to keep money after SVB -->
The FDIC insures corporate deposits up to $250,000 per depositor, per bank, per ownership category. Multiple company accounts at one bank do not multiply the limit. Insurance protects against bank failure, not problems at a fintech intermediary. “Insured up to $5 million” advertising means funds are distributed among partner banks through a sweep program. For a specific balance, obtain the bank list, check whether the company has direct deposits at those same banks, and establish withdrawal times.

A sensible policy: keep cash for upcoming payroll, taxes and vendor bills in an operating account; maintain a second independent payment route and test it before a crisis; hold reserves in an insured sweep program and a short Treasury-bill ladder. T-bills are US Treasury obligations, not FDIC-insured deposits. They mature in 4–52 weeks and carry price risk if sold before maturity. An illustrative $2 million ladder: 300 in the operating account, 300 in an instantly accessible reserve and 350 each maturing in 4, 8, 13 and 17 weeks. This is an illustration, not a recommendation to buy particular securities.

If the company pays contractors in euros, FX affects both cash and profit. A €10,000 invoice recognized at 1.10 creates $11,000 of AP. At month-end, the rate is 1.12, so AP becomes $11,200 and the FX loss is $200. Paying at 1.13 creates another $100 loss. Forecast cash using the expected payment rate and fees, hold some currency against known payments, and test a 10% exchange-rate move. Do not speculate with payroll reserves.

<!-- quiz -->
? There is $1.7 million in the bank, net burn is $5,000 monthly, and two annual prepayments arrived this year. How should runway be stated?
- 340 months, because that is cash divided by the company’s current net burn || This relies on one-off prepayments and ignores future spending.
+ By the month when forecast cash first falls below the minimum buffer || Dividing cash by average burn hides prepayments, seasonality and future hiring.
- Infinite, because the company barely uses cash || Prepayments require service delivery, and hiring and growth change burn.
? Can the base cash forecast include a round with a signed term sheet?
- Yes, but include only half the amount to allow for the round closing late || Half the cash will not arrive: the round either closes or does not.
- Yes, because the term sheet with the investor has already been signed by both sides || Deals fail after term sheets too; the forecast must show the risk.
+ No; until cash is received, the round remains a separate upside scenario || A term sheet does not guarantee closing, while spending decisions must be made beforehand.
? A company holds $3 million across two accounts at one bank. How much is FDIC-insured?
+ Up to $250,000 for the company at that bank, regardless of account count || The limit applies by depositor, bank and ownership category.
- Up to $500,000, because the $250,000 insurance applies separately to each account || Multiple accounts at one bank do not multiply the limit.
- All $3 million, because authorities guarantee every startup deposit after SVB || Protecting all SVB deposits was a one-off government decision.
<!-- /quiz -->

<!-- section: task | Task: a 13-week forecast -->
Complete the task in the “13-week cash forecast” spreadsheet template downloadable on this page. Fill Events with your company’s actual expected payments and receipts, set a floor and identify the first week cash falls below it. Then build a downside scenario following this lesson and record what decisions you must make and by which week. Separately check how much of your cash is insured and how many days it would take to pay salaries if the primary bank closed.

<!-- widget: template {"file":"cash-13w"} -->

<!-- section: sources -->
- Rippling, Series E after the SVB collapse — https://www.rippling.com/blog/rippling-raises-500m-in-series-e-funding (March 2023)
- Roku, 8-K on SVB cash — https://www.sec.gov/Archives/edgar/data/1428439/000142843923000010/wk-20230310.htm (March 10, 2023)
- Treasury, Federal Reserve and FDIC, joint statement on SVB depositors — https://www.fdic.gov/news/press-releases/2023/pr23017.html (March 12, 2023)
- Paul Graham. Default Alive or Default Dead? — https://paulgraham.com/aord.html (October 2015)
- David Skok. SaaS Economics — https://www.forentrepreneurs.com/saas-economics-1/ (2010)
- FDIC, corporate deposit insurance — https://www.fdic.gov/financial-institution-employees-guide-deposit-insurance/corporation-partnership-and-unincorporated (checked November 25, 2026)
- TreasuryDirect, Treasury bills — https://www.treasurydirect.gov/marketable-securities/treasury-bills/ (checked November 25, 2026)
- FASB ASC 830, foreign currency — https://asc.fasb.org/ (checked November 25, 2026)
