<!-- lesson: finance.statements | Three statements from scratch: P&L, balance sheet and cash flow in one example | 32 -->
<!-- section: hook -->
InfraSeed, a fictional US infrastructure startup, earned $660,000 in revenue and lost $162,800 in 2026. Yet its bank balance grew by $504,000 over the year. In January it made a loss but received more cash than it spent; in December it made a profit but its cash fell. To a founder without a finance background this looks like an accounting mistake, but it all reconciles: three different statements measure profit, cash and company assets, each answering a different question. This lesson works through all three, line by line, using one example and showing how they connect.

<!-- section: theory | What each statement measures -->
The profit and loss statement, or P&L / income statement, shows how much a company earned during a period and what it spent to earn it. The balance sheet shows, at a particular date, what the company owns (assets), what it owes (liabilities), and what remains for its owners (equity). The cash flow statement shows cash received and paid during a period, separating operating activities, investment in equipment, and financing. The US Securities and Exchange Commission describes these statements in its beginners’ guide for investors; US GAAP reporting is built around them.

Learn a few terms immediately: they come up in every conversation with an accountant or investor. Revenue is what the company earns by providing a service. An expense is a cost of the period. Accounts receivable (AR) is what others owe the company. Accounts payable (AP) is what the company owes. An accrual is an expense or income that has arisen but has not yet been paid. A prepaid expense means paying now for a service received later. Deferred revenue means the customer has paid but the company still owes the service.

The central point of accrual accounting: cash received from a customer does not yet mean earned revenue. If a customer pays a year in advance, revenue appears month by month as the company provides the service.

<!-- section: theory | The example company -->
On January 1, InfraSeed has $1.2 million in its bank account from founders and investors, with no other balances. All amounts below are in thousands of dollars and are invented for this teaching example.

- Customer A pays 240 on January 1 for an annual subscription covering January–December.
- Customer B pays 240 on July 1 for a year covering July 2026–June 2027.
- A usage-based cloud service earns 10 in January and 2 more each month; customers pay the following month.
- Implementation services earn 12 each in March, June, September and December, paid the following month.
- Customer cloud hosting costs 4 in January and 0.8 more each month, paid the following month.
- Customer support costs 4 per month; the implementation contractor costs 6 in each implementation month.
- Research and development (R&D) costs 35 per month, sales and marketing (S&M) 12, general and administrative expenses (G&A) 7; December adds 2 for accountant services paid in January.
- Insurance: 12 paid in January for the full year.
- Laptops and equipment: 36 paid on January 1, with a three-year useful life.
- Interest income on bank cash is 2 per month.
- Investors contribute another 600 in July.

Salary lines already include employer taxes and employee insurance. This example has no debt, options or income tax.

<!-- section: theory | Journal entries: how statements are assembled -->
Every business transaction changes at least two accounts by the same amount: the double-entry rule. “Debit” and “credit” here mean the left and right sides of an entry, not “bad” and “loan.” Asset increases normally go on the debit side; increases in liabilities, equity and revenue go on the credit side. Look at InfraSeed’s transactions:

- Customer A pays 240 in January: cash increases by 240 and deferred revenue increases by 240. There is more cash, but no profit yet.
- January service is delivered: deferred revenue falls by 20 and subscription revenue rises by 20. The obligation to the customer decreases; revenue is earned.
- January cloud usage of 10: AR increases by 10 and revenue increases by 10. There is revenue, but no cash yet.
- Customers pay for January usage in February: cash increases by 10 and AR decreases by 10. There is no new revenue.
- January hosting of 4: expense increases by 4 and AP increases by 4. The expense exists, but the cash is still in the bank.
- Insurance of 12 in January: prepaid expenses increase by 12 and cash falls by 12. Only 1 becomes expense each month.
- Equipment of 36: fixed assets increase by 36 and cash decreases by 36. Each month includes depreciation expense of 1.
- December accountant services of 2: expense and accrued liabilities both increase by 2. You cannot wait for the January invoice to recognize December’s expense.
- Investors contribute 600: cash and equity increase by 600. This is neither revenue nor business turnover.

After every month, verify that assets minus liabilities minus equity equals zero. Otherwise, something is wrong.

<!-- section: theory | The annual P&L -->
InfraSeed’s 2026 income statement looks like this.

| Line | 2026, $000 | What to ask yourself |
|---|---:|---|
| Subscription revenue | 360 | Why did we bill 480 but recognize 360? |
| Usage revenue | 252 | Is usage growth profitable or subsidized? |
| Services revenue | 48 | Can sales repeat without manual work? |
| **Total revenue** | **660** | Excludes financing and interest |
| Customer hosting | 100.8 | Is the entire cloud bill included? |
| Support | 48 | Have we hidden it in R&D? |
| Implementation | 24 | Is rework included? |
| **Cost of goods sold (COGS)** | **172.8** | Direct service delivery costs |
| **Gross profit** | **487.2** | Gross margin 73.8% |
| R&D | 420 | All expensed as incurred |
| S&M | 144 | Not all of it is customer acquisition cost |
| G&A | 86 | 84 paid and 2 still owed |
| Insurance | 12 | Separate from the January payment |
| Depreciation | 12 | Allocating equipment cost |
| **Operating expenses** | **674** | |
| **Operating income (EBIT)** | **−186.8** | The core business loses money |
| Interest income | 24 | Not product revenue |
| **Net income** | **−162.8** | Income tax is 0 in this example |

EBITDA equals operating income plus depreciation, or −174.8. It is not cash flow: it does not show receivables, prepayments or equipment purchases. If the company has options, do not silently replace EBITDA with “adjusted” EBITDA: show each adjustment on a separate line.

<!-- section: theory | Month by month -->
Monthly statements reveal what annual statements hide. In January, revenue is 30, COGS 8, operating expenses 56 and net loss 32. In July, the second annual customer arrives, revenue rises to 62 and the loss shrinks to 4.8. September and December, with implementation work, are the first profitable months: 3.6 and 5.2. The accumulated loss for the year is 162.8.

Each month-end balance sheet uses the same formulas: ending cash equals opening cash plus operating, investing and financing flows; ending AR equals opening AR plus revenue on credit minus collections; ending deferred revenue equals opening deferred revenue plus subscription billings minus recognized revenue. On December 31, InfraSeed has 1,704 in cash, 44 in receivables and 24 in equipment net of depreciation: total assets of 1,772. Liabilities are 12.8 owed to the cloud provider, 2 in accrued expenses and 120 in deferred revenue for the remaining six months of service to customer B. Equity is 1,800 contributed less the accumulated loss of 162.8, or 1,637.2. Assets equal liabilities plus equity: 1,772.

The 120 of deferred revenue is not the owners’ money: it is an obligation to serve customer B for another six months. Some bank cash is committed to future work, and the model must reserve it for future delivery costs.

<!-- section: theory | How a founder should read statements -->
Each statement answers its own question. The P&L asks whether we make money on the service we deliver: InfraSeed’s gross margin is 73.8%, and the main question is why development and sales cost more than gross profit. The balance sheet asks what we owe and what others owe us: deferred revenue of 120 represents work still to be done. Cash flow asks when cash arrives and leaves; that is the next lesson.

After each closed month, ask one question from the table above for each line. After three months, you will read the statements faster than the accountant can explain them.

<!-- quiz -->
? A customer paid $240,000 on January 1 for a year’s subscription in advance. How much revenue does the company report for January?
+ $20,000, with $220,000 remaining as deferred revenue || Revenue is recognized as the service is provided: one twelfth each month.
- $240,000, because the cash is already in the bank and the customer cannot get a refund || Bank cash does not mean earned revenue; the company still owes the service.
- Zero, because revenue is recognized only at year-end when the entire service is delivered || Service is provided evenly, so revenue is recognized monthly.
? Investors contributed $600,000 to the company. How does this affect the statements?
+ Cash and equity rise by 600, with no increase in revenue or profit || Investor contributions are financing, unrelated to business operations.
- Revenue rises by 600 because the company received money from outside parties for its shares || Selling shares is financing, not selling services.
- Liabilities rise by 600 because the company must return the money to investors || Equity investment is generally not debt; money is returned only on a sale or under specific terms.
? The company has $120,000 of deferred revenue on December 31. What does this mean for the founder?
+ It has already received cash for six months of services it still owes || This is a liability: some cash will be needed for future delivery costs.
- It is revenue customers have not paid, which must be collected before quarter-end || Unpaid revenue is reflected in accounts receivable.
- It is cash the company can freely spend on hiring and marketing next year || The cash has arrived, but it comes with an obligation to provide service.
<!-- /quiz -->

<!-- section: task | Task: your company’s three statements -->
Complete the task in the “InfraSeed model” spreadsheet template downloadable on this page. First understand the sheets: monthly P&L, cash flow, balance sheet and checks. Then replace InfraSeed’s data with your company’s last year, or invent its first year if it is just starting. The check passes when the balance sheet balances every month and year-end cash matches between the cash flow statement and balance sheet. For every P&L line, write one question you will ask the accountant.

<!-- widget: template {"file":"infraseed-model"} -->

<!-- section: sources -->
- SEC, Beginners' Guide to Financial Statements — https://www.sec.gov/about/reports-publications/beginners-guide-financial-statements (checked November 25, 2026)
- FASB Accounting Standards Codification — https://asc.fasb.org/ (checked November 25, 2026)
- FASB, Topic 606 post-implementation review — https://storage.fasb.org/Post-Implementation%20Review%E2%80%94Revenue%20from%20Contracts%20with%20Customers%20%28Topic%20606%29.pdf (2024)

<!-- lesson: finance.cash-vs-profit | Why a profitable company runs out of cash | 26 -->
<!-- section: hook -->
In January, InfraSeed lost $32,000 while its cash grew by $136,000. In December, it earned $5,200 in profit while cash fell by $44,000. This is not an accounting oddity: it is the main thing founders must understand about money. Profit and cash move at different times. A company with profitable contracts can miss payroll, while a loss-making company can comfortably live on prepayments for a year. This lesson shows how the cash flow statement explains the difference and how to classify expenses so margins do not mislead.

<!-- section: theory | The direct method: cash in and cash out -->
The direct cash flow method lists receipts and payments. Over the year, InfraSeed’s customers paid 736: 480 for subscriptions, 220 for cloud usage and 36 for implementation. Of the 300 earned from usage and implementation, 44 remains unpaid. Interest contributed 24. Operating payments totaled 820: hosting 88, support 48, contractors 24, R&D 420, S&M 144, G&A 84 and insurance 12. Cash flow from operations (CFO) is 736 + 24 − 820 = −60. Equipment purchases are investing cash flow of −36. Investor contributions are financing cash flow of +600. Total cash increased by 504 over the year, ending at 1,704, matching the balance sheet.

<!-- section: theory | The indirect method: a bridge from profit to cash -->
The indirect method starts with net income and removes everything that has not yet become cash flow. It is more useful to founders because it explains why cash and profit diverged.

| Bridge, $000 | Change | Why this sign |
|---|---:|---|
| Net income | −162.8 | Starting point |
| + Depreciation | +12 | Expense without a payment this year |
| − Increase in AR | −44 | Earned but not collected |
| + Increase in AP | +12.8 | Expense recognized, payment later |
| + Increase in accrued expenses | +2 | December accountant remains unpaid |
| + Increase in deferred revenue | +120 | Cash received for services not yet delivered |
| **Operating cash flow** | **−60** | Matches the direct method |

January works as follows: net loss −32, depreciation +1, AR −10, prepaid insurance −11, AP +4 and deferred revenue +220. Operating cash flow is +172 despite the loss: the annual prepayment supplied the cash. December: net income +5.2, depreciation +1, AR −14, insurance +1, AP +0.8, accrual +2 and deferred revenue −40. Operating cash flow is −44 despite the profit: the company is delivering services paid for earlier.

If direct and indirect methods give different operating cash flow, the books contain an error. Find it before sending the statements to investors.

<!-- section: theory | Why a profitable company can run out of cash -->
A short example: in January, a company delivers 100 of services and invoices on 90-day terms. It immediately pays 70 in costs. The P&L shows a profit of 30, but cash fell by 70. If the bank held 50, the company cannot make February payroll despite a profitable contract. Loan repayments, equipment purchases, prepaying a cloud commitment, taxes and paying old vendor invoices have the same effect. Annual prepayments work in reverse: they temporarily improve cash, but the service and its delivery costs still lie ahead.

Cash-basis accounting records income and expenses when cash moves; accrual accounting records income when earned and expenses when incurred. Investors and auditors expect accrual statements; a toggle in accounting software does not change that. Whether cash-basis accounting is allowed for taxes is governed by separate IRS rules, including Internal Revenue Code Section 448.

<!-- section: theory | COGS and operating expenses: where to draw the line -->
Gross margin is meaningful only if COGS includes everything needed to serve the customer, and nothing extra. For an infrastructure company with a cloud service, COGS includes customers’ production cloud resources, support and on-call engineers keeping the service running, implementations, third-party component licenses and payment processing fees. Building the next product version is R&D, even when the same engineers do it.

A common mistake: “Everything paid to AWS is COGS; every engineer is R&D.” This distorts margins in both directions. If an engineer costing 20 per month spends 60% of their time on call and fixing production, and 40% writing new code, allocate 12 to COGS and 8 to R&D, based on task plans or time records and reviewed quarterly. Development and test cloud resources belong to R&D. The free tier needs a separate cost center; it cannot be excluded from the business economics.

The same rule applies to open-source projects: developing the core is R&D, developer marketing is S&M, and SLA support for paying customers is COGS. Split employees who both support customers and expand their contracts using a documented estimate.

<!-- section: theory | The chart of accounts -->
The chart of accounts lists the categories accountants use for transactions. A useful structure for a software startup: 1000–1399 for cash, receivables and prepayments; 1500–1799 for equipment and capitalized development; 2000–2499 for payables, accruals, taxes payable and deferred revenue; 2500–2999 for debt, leases and SAFEs under the chosen classification; 3000–3999 for equity; 4000–4499 for subscription, usage, support and services revenue; 5000–5299 for COGS: cloud resources, support, implementation and fees; 6000–6499 for R&D; 6500–6999 for S&M; 7000–7999 for G&A; 8000–8999 for interest and FX differences; 9000 for income tax.

Track departments, products, customers, states and currencies as dimensions instead of separate accounts: you do not need an account for every AWS service.

<!-- quiz -->
? A company is losing money, yet its cash increased this month. What is the most likely explanation for a subscription business?
+ A customer paid a year in advance, so cash arrived before revenue || Prepayment increases deferred revenue and cash; revenue appears monthly.
- The accountant made a mistake, because a loss always reduces bank cash in the same month || Losses and cash flow differ in timing; that is normal.
- The company sold equipment and included the proceeds in operating cash flow || Selling equipment belongs in investing cash flow.
? An engineer spends half their time on call for customers’ production cloud service and half building the next version. How should their salary be allocated?
+ Half to COGS and half to R&D, based on time records || On-call work delivers the customer service; the new version is development.
- All to R&D, because engineers traditionally belong in research and development || This understates COGS and makes margins look better than they are.
- All to COGS, because the cloud service cannot work without this engineer || Developing the next version is not necessary to deliver the current service.
<!-- /quiz -->

<!-- section: task | Task: a bridge from profit to cash -->
Complete the task in the “InfraSeed model” spreadsheet template on this page. On the cash flow sheet, build an indirect bridge from net income to operating cash flow for two company months: the month with the largest gap between cash and profit, and an ordinary month. For each bridge line, record the event that caused it. Then check how engineering salaries are split between COGS and R&D and recalculate gross margin using the lesson’s rule.

<!-- widget: template {"file":"infraseed-model"} -->

<!-- section: sources -->
- SEC, Beginners' Guide to Financial Statements — https://www.sec.gov/about/reports-publications/beginners-guide-financial-statements (checked November 25, 2026)
- FASB Accounting Standards Codification, ASC 230 — https://asc.fasb.org/ (checked November 25, 2026)
- IRS, Publication 538, accounting methods — https://www.irs.gov/publications/p538 (checked November 25, 2026)
- GitLab, SEC filings — https://ir.gitlab.com/financial-information/sec-filings (checked November 25, 2026)
