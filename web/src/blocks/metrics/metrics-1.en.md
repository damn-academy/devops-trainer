<!-- lesson: metrics.contract | What makes up a metric: numerator, denominator, window and owner | 26 -->
<!-- section: hook -->
At the monthly meeting, marketing reports that signup-to-payment conversion has risen to 4%, sales says 2%, and the CFO thinks there are fewer paying customers. All three are right because each divided their own number by their own denominator: marketing divided this month's payments by this month's signups, sales divided deals by all accounts in the CRM, and finance divided contracts by legal entities. Arguing over whose number is right is pointless here. Until a metric has a written definition, the argument is about definitions, although participants think it is about numbers. This lesson teaches you to read and record a metric so that the same question produces the same number in every department.

<!-- section: theory | Who we are counting -->
Several different entities coexist in an infrastructure company, and it is easy to substitute one for another without noticing. A website visitor is a person or their browser. A user is a person's account in the product. An organization, or account, is a workspace shared by several users. An open-edition installation is a program running somewhere at an unfamiliar team. A buyer is the legal entity signing a contract. An opportunity is a specific commercial initiative by that buyer.

The working unit for the commercial funnel is the account; for product, it is the account and its workloads; for marketing, first the visitor and then the identified account. One person may work in three organizations, one organization may create two workspaces, and a large customer may buy through several subsidiaries. So the first rule sounds dull and prevents half the mistakes: the numerator and denominator of a metric use the same unit. Dividing user signups by contracts with companies produces a number that measures nothing.

<!-- section: theory | The ten fields of a definition -->
Every metric discussed in meetings needs a written definition. It has ten fields:

- the business question the metric answers;
- numerator;
- denominator;
- unit of analysis (user, account, opportunity, contract);
- starting point;
- observation window;
- exclusions;
- data source;
- owner;
- definition version number and effective date.

An example of a well-written definition: “the share of new October cloud organizations that successfully deployed their own resources within 14 days of creation; company employees, test organizations and repeat signups are excluded.” One sentence contains the unit, cohort, event, window and exclusions, and two analysts using it will produce the same number.

Versions matter because definitions change. If the qualified-lead threshold was lowered in March, April's growth in lead count may reflect the new rule. The new definition gets a new number, the old and new versions are calculated in parallel for a while, and earlier periods are explicitly recalculated and labeled as restated.

<!-- section: theory | Cohort conversion and immature observations -->
The most common mistake in funnel reports is dividing current-month events by events in that same month. November payments are divided by November signups, although most payers signed up in September and October. Proper conversion is calculated by cohort: a group of entities entering the initial stage in the same period:

`CR(A→B; W) = number of entities in cohort A reaching B no later than W after entering A / number of entities in cohort A whose window W has already ended`.

Take a 90-day window. At the end of November, the October signup cohort has not yet lived through its 90 days. Those who have not paid yet still have time, and this cannot be counted as failure. Such observations are called immature. Reports always show cohort size, age and the number of open observations alongside conversion. Immature outcomes must not be counted as rejections: otherwise every fresh cohort will look worse than older ones, and the team will look for a problem that does not exist.

<!-- section: theory | When a number does not yet mean much -->
Small samples fluctuate widely. If 5 out of 20 opportunities are won, the win rate is 25%, but the 95% Wilson interval for 5 out of 20 stretches from roughly 11 to 47%. One major win next quarter will move the metric several points without saying anything about process quality. With low volumes, it is therefore more useful to compare against your own mature cohort in the same segment from previous quarters and show an interval beside the point estimate.

Other companies' benchmarks require even more caution. Reports distinguish observations (published results for a specific sample), forecasts (respondents' expectations, marked E) and the author's recommendations. The median across surveyed companies is not the ratio of total numerators to total denominators, and a forecast in a 2025 report does not become a fact by the end of 2026. For example, the 2024 KeyBanc and Sapphire survey reports median customer acquisition payback of 21 months for 2023 and a forecast of 20 months for 2024, while Benchmarkit's 2026 report gives 16 months for 2025 in a different sample. These numbers cannot be combined into one time series because the surveys have different participants and definitions.

<!-- quiz -->
? Marketing divided November payments by November signups and got 4%. Why cannot this number be called signup-to-payment conversion?
+ Most November payments came from people who signed up earlier, so the numerator and denominator describe different people || Conversion is calculated by cohort: the same entities in the numerator and denominator.
- Because 4% is too high for an infrastructure product and must contain a data error || The value itself proves nothing; the calculation method is the problem.
- Because the calculation should include only paying users, excluding free users || Free signups are the start of the funnel.
? Of 20 opportunities in the quarter, 5 were won. What is the most appropriate statement for the report?
- The win rate rose to 25%, and the sales process improved over last quarter || Twenty opportunities do not support that conclusion.
+ 25%, an interval of roughly 11–47%, compared with our own mature cohort || With small volumes, show an interval alongside the point estimate.
- Nothing: metrics should only be calculated once there are a hundred opportunities || You can calculate them; you need to show uncertainty.
? Marketing lowered the lead qualification threshold, and lead count grew by a third. What should happen to the definition?
- Keep the old name and version because the metric's meaning has not changed and reports must not break || That presents growth caused by a rule change as growth in demand.
+ Give the definition a new version, calculate old and new versions in parallel and label restated periods || This separates growth due to the rule from growth in demand.
- Stop counting leads and switch to another metric because this one is compromised || The metric is useful if the definition version is recorded.
<!-- /quiz -->

<!-- section: task | Task: define three of your metrics -->
Complete the task in the document on this page. Choose the three metrics most often discussed at your team's meetings and fill in all ten definition fields for each: business question, numerator, denominator, unit, starting point, window, exclusions, source, owner and version. If you do not know an answer, write down whom to ask. Then check whether the numerator and denominator of each metric use the same unit.

<!-- section: sources -->
- KeyBanc Capital Markets and Sapphire Ventures, SaaS Survey 2024 — https://www.cfodesk.co.il/wp-content/uploads/2024/10/2024_kbcm_sapphire_saas_survey.pdf (pp. 3–5)
- Benchmarkit, 2026 B2B SaaS & AI-Native Performance Benchmarks — https://www.benchmarkit.ai/_files/ugd/2a084b_f19d7f96a9e24aba9202e01224d0dbcc.pdf (pp. 10–13)
- Benchmarkit and Pavilion, SaaS Performance Benchmarks 2025, Glossary section — https://5242563.fs1.hubspotusercontent-na1.net/hubfs/5242563/Pavilion%20Benchmarkit%202025%20SaaS%20Performance%20Benchmarks.pdf

<!-- lesson: metrics.funnel | The end-to-end funnel: from visitor to contract expansion | 30 -->
<!-- section: hook -->
A company with an open edition, a cloud service and a sales team sees a hundred thousand website and documentation visitors every month but signs only a few dozen contracts. Nobody can say where the others disappear: marketing counts visitors, product counts signups, sales counts opportunities, and there are no bridges between their tables. This lesson assembles the entire funnel: its stages, the name of each event, the denominators and how much revenue ultimately comes from a hundred thousand visitors.

<!-- section: theory | Several routes instead of one chain -->
Marketing textbooks draw the funnel as one chain: visitor, lead, qualified lead, opportunity, customer. An infrastructure company has several intersecting routes. A developer finds a GitHub repository and installs the open edition locally. Someone else signs up for the cloud service, connects their data and starts using it. A third person requests a demo immediately because they need a contract and a security review. A small team may buy a plan by card and never enter the CRM. An existing customer whose consumption has grown becomes interesting to sales again, but as an expansion candidate, not a new logo.

It therefore helps to draw the funnel as a route map. Website visits lead to cloud signup or an inquiry; the repository leads to an open-edition installation. Signup leads to activation: the first useful result on the customer's data. Activation and observed open-edition usage lead to a product-qualified account (PQA): it has the right profile, demonstrated value and signs of commercial interest. Next come sales qualification, an opportunity, technical evaluation, negotiation and signing, followed by implementation, renewal and expansion.

<!-- section: theory | Stages and their denominators -->
Each stage has its own event and denominator:

- Visit: a human viewing the site. Bots, employees, login and support pages are excluded; sessions and unique visitors are counted separately.
- Signup: the first external cloud organization. An invited colleague is not a new organization.
- Open-edition installation: the first confirmed run, if observable. Registry downloads indicate distribution, not installations: build pipelines, caches and mirrors distort them.
- Activation: the first verifiable result on customer resources within 14 days (sometimes 7 or 30; label the window). Logging in and installing a library do not count as activation.
- PQA: first product qualification within 30 days of activation, with the rule version and evidence timestamp.
- Sales-qualified lead (SQL): the problem, product fit and an agreed next step are confirmed. A booked meeting and completed qualification are different events.
- Opportunity: a specific initiative with an amount, timeline and buying account. Do not create an opportunity for every pricing-page view.
- Win: a signed commitment. Win rate is wins divided by wins plus losses; opportunities where the customer makes no decision count as losses.
- Annual contract value (ACV) and expansion: the annual recurring amount of a new contract excluding one-time services, and growth in the recurring amount from existing customers.

The simple ratio of “new organizations divided by unique visitors this month” is useful operationally but is not a transition probability: an organization may appear without a tracked visit, and one visitor may create several organizations. For the open edition, publish three numbers together: observed active installations, identified active accounts and the share of installations sending telemetry. Missing events from an installation do not mean it is unused.

<!-- section: theory | An end-to-end example with a hundred thousand visitors -->
Take an illustrative mature cloud cohort where all identifiers are linked and every signup creates one new account:

| Step | Count | Transition from the previous step |
|---|---:|---:|
| Unique visitors | 100 000 | — |
| New cloud accounts within 30 days | 5 000 | 5% |
| Activated within 14 days | 1 500 | 30% |
| PQA within 30 days after activation | 300 | 20% |
| SQL within 30 days after PQA | 180 | 60% |
| Opportunity within 30 days after SQL | 120 | 66.67% |
| Win by day 180 of the opportunity | 30 | 25%, if the other 90 have already been lost |

Multiplying gives `100 000 × 0.05 × 0.30 × 0.20 × 0.60 × 2/3 × 0.25 = 30` wins. From visitor to signed contract, 0.03% make it through; from signup, 0.6%. At an average annual contract value of $40,000, new annual recurring revenue (new ARR) will be $1.2 million.

Suppose another 150 accounts in the same cohort bought a plan themselves at $2,000 a year. There are now 180 paying customers, signup-to-payment conversion is 3.6%, and new revenue is $1.5 million. The average amount per new paying customer is $8,333, a different number from the $40,000 for sales-led contracts. Stage windows follow one another, so the path from visit to money may take much longer than 180 days. This calculation describes a mature cohort and does not promise all that revenue in the quarter when the visitors arrived.

<!-- section: theory | What to do with MQL -->
A marketing-qualified lead (MQL) often accumulates points for easy actions: downloading a document, attending a webinar or opening an email. A developer explores the open edition with no intention of buying, while a procurement employee with budget may never open the product. Contact-level scores miss the buying group, create several leads for one initiative and cause arguments over whose opportunity it is.

Many infrastructure companies replace MQL with two entry points into sales: an explicit request from a suitable account and a PQA with evidence of value. Marketing owns access to the right accounts and qualified demand, product owns time to first value, and sales owns confirmation of the buying process and the outcome. This does not mean the term has disappeared: Cognism's Inside Inbound 2026 report calls high-intent inquiries, including demos and pricing, MQLs, while Pulumi routes community leads into an MQL queue. Changing the meaning and incentives matters more than renaming the column.

Published transition benchmarks are scarce. OpenView and Pendo's 2023 study reports a median visitor-to-trial conversion of 5%, visitor-to-free-plan conversion of 9%, and trial-to-paid conversion of about 10%. Ebsta and Pavilion report 68% MQL-to-SQL conversion and a 19% win rate for new opportunities in 2025. There is no reliable public range for open-edition-to-activation, activation-to-PQA or PQA-to-opportunity conversion; you have to build it from your own cohorts.

<!-- quiz -->
? Why cannot image downloads from a registry be recorded as installations in the funnel?
- Because the registry reports downloads several days late, and the dates do not match signups || Delay is not the main problem.
+ Build pipelines, caches and mirrors distort them, so a download indicates distribution || An installation is confirmed by a run.
- Because downloads belong to marketing and installations to product, and departments cannot be mixed in one funnel || Departments are irrelevant; the entity matters.
? An illustrative cohort has 30 contracts at $40,000 and 150 self-service purchases at $2,000. What is the average amount per new paying customer?
+ About $8,333, which is different from the average sales-led contract || $1.5 million divided by 180 customers.
- $40,000, because self-service purchases are excluded from the average contract amount || That is the average sales-led contract, but the question covers all paying customers.
- $21,000: the arithmetic mean of the two amounts || That does not work because the groups differ in size.
? An existing customer's consumption grew, and product marked it as a PQA. Where should it be recorded?
- Among new logos, because the signal came from product and sales has not worked with it yet || The logo is already in the customer base.
+ Among existing-customer contract expansion candidates, separate from new logos || A repeat PQA for an existing customer belongs to expansion.
- Nowhere: product qualification applies only to free accounts || The signal is also useful for customers.
<!-- /quiz -->

<!-- section: task | Task: map your funnel -->
Complete the task in the document on this page. Draw your funnel routes: where people come from, where they sign up or install the open edition, where they get their first value, and how they reach sales or buy on their own. For each stage, record the event, unit, window and data source. Then mark the stages where the link to the previous stage is currently lost, for example between visitor and account or between installation and company.

<!-- section: sources -->
- OpenView and Pendo, Product Benchmarks 2023, archived copy — https://www.scribd.com/document/680456182/OpenView-2023-Product-Benchmarks-Report (pp. 10, 22, 28, 33–34)
- Kyle Poyar. Your guide to SaaS product metrics — https://kylepoyar.substack.com/p/your-guide-to-saas-product-metrics (19.07.2023)
- Ebsta and Pavilion, GTM Benchmarks 2025 — https://www.joinpavilion.com/hubfs/Ebsta%20x%20Pavilion%202025%20GTM%20Benchmarks%20Report.pdf (pp. 5–6)
- Cognism, Inside Inbound 2026 — https://www.cognism.com/reports/inside-inbound-2026
- Common Room, Pulumi case study — https://www.commonroom.io/customers/pulumi-signals-meetings-booked/
