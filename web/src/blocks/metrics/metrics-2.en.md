<!-- lesson: metrics.attribution | Attribution: whose deal is it, and why are there several answers? | 28 -->
<!-- section: hook -->
A customer signed a contract worth $100,000 a year. Before that, the customer's CTO listened to a podcast featuring your engineer, spent a week reading documentation, then searched for the company name, clicked an ad and requested a demo. The podcast lead believes the podcast sourced the deal; the paid-search lead credits advertising; and when asked “how did you hear about us?”, the CTO says a former colleague recommended the product. Attribution does not choose who is right. It provides several rules for allocating credit, each answering its own question.

<!-- section: theory | Created and influenced pipeline -->
First, agree on the amount being allocated. Pipeline created is the sum of the annual recurring value of opportunities first qualified during the period. Freeze the amount at qualification and show the current amount alongside it. For a multiyear contract, use the annual figure, not total contract value (TCV) across all years.

Marketing-sourced pipeline is the portion for which marketing is assigned as the sole source under a predefined rule, such as the first confirmed account touch within 180 days before the opportunity. Unknown sources remain a separate category; do not distribute them across channels. Marketing-influenced pipeline is the sum of unique opportunities where at least one buying-group member interacted with marketing within the specified window. An email sent but never opened is not an interaction.

For example, $2 million in pipeline was created; marketing sourced $800,000, or 40%, and influenced $1.4 million, or 70%. You cannot add $800,000 and $1.4 million because the sets overlap. For the same reason, you cannot add influenced pipeline across channels: if webinars influenced $900,000, content $800,000, and their overlap is $300,000, the union is $1.4 million, although simple addition would give $1.7 million. Influence shows contact but does not prove a causal contribution.

<!-- section: theory | Models for allocating credit -->
In multitouch attribution, every opportunity is distributed across channels using weights that sum to one:

`Attributed pipeline for channel c = Σ opportunity amount i × weight i,c`, where for every opportunity `Σ weight i,c = 1`.

Normalized weights add up to 100%; channel-level “influenced” flags do not. The main models are:

- First touch gives the entire opportunity to the first known interaction and answers where observed awareness began. The first known touch was not necessarily the actual first touch: cookies, device changes and anonymous open-edition usage hide the start of the journey.
- Last touch assigns everything to the final touch before the event and shows which path captured existing demand. In this model, branded search and direct visits claim demand created by other channels.
- A linear model splits the opportunity equally among all touches. Noisy channels get credit for frequency, so touches need deduplication.
- A position-based model gives, for example, 40% to the first touch, 40% to the touch at opportunity creation and 20% to the rest. Management chooses these weights; they do not estimate causality.
- A time-decay model gives a touch the weight `exp(−ln 2 × days until outcome / half-life)` and then normalizes. It systematically undervalues channels that create a category and work over long cycles.
- Data-driven models (Markov chains, Shapley values) allocate contribution using observed paths. Missing touches and hidden common causes remain, and such models do not replace experiments.
- Buyer self-report answers two questions: “Where did you first hear about us?” and “What made you contact us now?” It sees communities, referrals, conferences and AI assistant answers that web analytics misses.

Return to the opening deal. For the path “podcast, documentation, paid branded search, demo”, first touch assigns $100,000 to the podcast, last touch assigns it to search, and a linear model with three touches gives $33,333 to each. Counting the demo request itself as a fourth touch would give each $25,000. That is why the event being attributed is usually not treated as a separate channel. Self-report will name the colleague. Keep every version; never overwrite the customer's original answer with the “correct” marketing category.

<!-- section: theory | How to collect self-reports -->
For each answer, retain the original text, normalized category, date, respondent's role, buying stage and the version of the classifier that categorized the answers. Response rate is respondents divided by people surveyed, for example 140 out of 200, or 70%. If 42 of the 140 name the community, that is 30% of respondents; the share among all buyers may differ. Separately examine segments with lower response rates: if large customers stay silent more often than small ones, the overall picture is skewed toward small customers.

<!-- quiz -->
? Webinars influenced $900,000 in opportunities, content $800,000, with $300,000 in common. How much pipeline did these two channels influence together?
- $1.7 million, because influence is counted separately for each channel and then added || Addition counts shared opportunities twice.
+ $1.4 million: the sum of the two channels minus their $300,000 overlap || Influenced sets overlap.
- $600,000: the difference between channels plus the overlap || That formula has no meaning.
? What systematic mistake does a last-touch model make?
+ It credits branded search and direct visits with demand created by other channels || Last touch sees who captured demand.
- It undervalues channels operating closest to contract signing || On the contrary, it overvalues them.
- It divides the opportunity equally among channels regardless of their role in the purchase || That describes a linear model.
? Of 140 responding buyers, 42 named the community; 200 were surveyed. How should the result be recorded?
- The community brought in 30% of all buyers and is the company's main channel || The 30% applies only to respondents.
- The community brought in 21% of buyers because the denominator must include everyone surveyed || Nonrespondents are unknown and cannot be counted as zeros.
+ 30% of respondents, with a 70% response rate and an examination of who stays silent || Show response rate and bias alongside the result.
<!-- /quiz -->

<!-- section: task | Task: three attributions for one deal -->
Complete the task in the document on this page. Take the three most recent won deals and reconstruct each touch journey using the CRM and analytics. Allocate each deal's amount across channels with first-touch, last-touch and linear models. Then find in the records, or ask the salesperson, what the customer said about discovering the company, and compare that answer with the three models.

<!-- section: sources -->
- Cognism, Inside Inbound 2026, Definitions section — https://www.cognism.com/reports/inside-inbound-2026
- Common Room, Pulumi case study — https://www.commonroom.io/customers/pulumi-signals-meetings-booked/

<!-- lesson: metrics.lift | Incrementality and marketing mix modelling | 30 -->
<!-- section: hook -->
Marketing sent personalized offers to a thousand accounts, and after a quarter, 30 became customers. Attribution gives the campaign all 30 purchases. But how many would have bought without the email? If 20 would have, the campaign brought in 10 of the 30 customers, making its cost per customer three times higher. Attribution answers who was touched and where. Only a comparison with a group unaffected by the action answers what happened because of it.

<!-- section: theory | An experiment with a control group -->
Randomly divide accounts into two groups: a treatment group receiving the action and a control group that does not. It is better to randomize accounts: if you randomize people, one member of a buying group may be in treatment and another in control, and they will tell each other about the email. Before starting, record the outcome, measurement period, minimum effect of interest, required number of accounts and stopping rule. For sales, allow for the long tail of the cycle: if there are few deals, use qualified pipeline as an intermediate outcome, but check wins and gross profit later.

Formulas:

- Absolute lift = treatment-group conversion − control-group conversion.
- Relative lift = absolute lift / control-group conversion.
- Incremental customers in the treatment group = treatment-group size × absolute lift.

In the opening example, each group has 1,000 accounts, with 30 buyers in treatment and 20 in control. Absolute lift is one percentage point, relative lift is 50%, and the point estimate is 10 incremental customers. If the campaign cost $30,000, incremental acquisition cost is $3,000 per customer. However, the approximate 95% interval for the difference stretches from about −0.37 to 2.37 points, including zero. The test does not support a confident positive conclusion; the decision to scale the campaign must include that caveat. Extending a test after seeing its results is acceptable only if the extension was specified in the plan beforehand; otherwise, it is significance hunting, and a new independent test is more reliable.

For specialist-assisted sales, you can randomly assign an offer of help among PQAs. Include all accounts assigned help, even those that did not respond: this is the intention-to-treat principle. Keeping only responders leaves the most interested accounts in treatment and inflates the effect. A regional experiment works when there are enough comparable markets; at a large customer with offices in different countries, information flows between offices and breaks group independence.

<!-- section: theory | How many accounts each group needs -->
Choose group sizes before starting; otherwise, the test can easily be too small to detect the expected effect. For comparing two proportions, Lehr's simple rule says that a two-sided test at the 5% level with an 80% chance of detecting an effect if it exists needs approximately `n ≈ 16 × p × (1 − p) / d²` accounts in each group, where `p` is the average expected proportion across the two groups and `d` is the difference you want to detect.

Suppose 2% of accounts buy without the campaign and you hope for 3%. The average proportion is 2.5%, the difference is 1 percentage point, and `16 × 0.025 × 0.975 / 0.0001 = 3,900` accounts are needed in each group. The opening example had 1,000 per group, which is why its interval was so wide. If the company does not have that many target accounts, there are three options: look for a larger effect, measure an intermediate outcome with a higher baseline rate, such as a qualified meeting instead of a purchase, or acknowledge that a test of that size is not feasible in this market. The rule gives a probability of detecting an effect, not a guarantee of an interval excluding zero; for precise calculations, use power calculators in R, Python or spreadsheets.

<!-- section: theory | Marketing mix modelling -->
Marketing mix modelling (MMM) estimates the relationship between channel spend and outcomes using aggregated time series, allowing for delayed effects, saturation and control variables:

`Y(region, week) = baseline + Σ across channels β × saturation(adstock(spend)) + γ × control variables + error`.

The outcome `Y` is qualified pipeline, won recurring revenue or gross profit; do not mix them in one model. Adstock describes how the effect of one week's spend carries into subsequent weeks; saturation describes how each extra dollar in a channel yields less than the previous one. Control variables include seasonality, holidays, price changes, product availability, sales-team size and overall market demand. Branded demand is tricky: for paid advertising it may be a common cause, while for brand advertising it may be the very pathway through which the effect operates. Adding it blindly as a control can remove part of the effect you want to measure.

A reasonable starting point for your own model is two to three years of weekly data, independent budget variation across channels and regional differences. This is a working heuristic, not a strict threshold. With a few dozen deals, one market and all channels growing simultaneously, separating coefficients is practically impossible. Show model results with intervals, holdout validation and sensitivity to initial assumptions, and calibrate them using experiments from the previous section. A precise number such as “LinkedIn return is 4.37” without an interval is misleading.

An interpretation example: the model estimates that $50,000 in spend generated $200,000 in incremental qualified pipeline. That is four dollars of pipeline per dollar spent; it is not revenue yet. Only with a separately justified win rate, say 25%, and an 80% gross margin can this be converted into $40,000 of annual gross profit, which will not arrive immediately. Google's open-source Meridian library implements a Bayesian regional model and supports calibration using experimental results. Having access to the tool does not mean the company has enough data.

<!-- quiz -->
? In treatment, 30 of 1,000 accounts bought; in control, 20 of 1,000 did. The difference interval is −0.37 to 2.37 points. Which conclusion is valid?
+ The point estimate is 10 incremental customers, but the interval includes zero, so there is no confident conclusion || Zero is inside the interval.
- The campaign brought in 30 customers because all received the email before buying || The control group suggests that about 20 purchases would have happened without the email.
- The campaign does not work because the interval starts at a negative number || The interval does not prove the absence of an effect either.
? Why does a specialist-assistance experiment count all assigned accounts, including nonresponders?
- Because it is easier: there is no need to work out who responded || The issue is bias.
+ Otherwise only the most interested accounts remain in treatment, inflating the effect || This is intention-to-treat analysis.
- Because nonresponding accounts buy eventually anyway, just later || The experiment does not establish this.
? A mix model showed $200,000 in incremental pipeline from $50,000 in spend. What can be said about revenue?
- The company will receive $200,000 in revenue; the channel return is four || Pipeline is not revenue yet.
- Nothing, because mix models do not work for business-to-business sales || They can be used with sufficient data.
+ Only with a separately justified win rate and margin, and revenue will arrive with a delay || Conversion and margin translate pipeline into money.
<!-- /quiz -->

<!-- section: theory | Practice with sample data -->
The “Northwind Data experiment” file below contains the results of a test planned using this lesson's rule: 3,900 accounts each in the treatment and control groups, with a flag indicating whether each account purchased.

Calculate the share of buyers in each group, the absolute and relative lift, and an approximate 95% confidence interval for the difference. Calculate the interval as follows: the standard error of the difference is `√(p₁ × (1 − p₁) / n₁ + p₂ × (1 − p₂) / n₂)`, where `p` denotes buyer proportions and `n` group sizes; the interval is the difference in proportions plus or minus 1.96 standard errors. The approximation works when each group has at least ten or so buyers and as many non-buyers, and accounts do not influence one another; if proportions are close to zero or 100%, a precise method is needed, such as a Newcombe interval calculated in R or Python. In a spreadsheet, the lower bound is `=(B2-B3)-1.96*SQRT(B2*(1-B2)/C2+B3*(1-B3)/C3)` and the upper bound uses the same formula with a plus sign; column B holds proportions, column C group sizes, row 2 the treatment group and row 3 the control group. The file's `group` column uses `treatment` for the treatment group and `control` for the control group; `converted` is 1 if the account purchased.

Answers. In the control group, 78 accounts purchased, or 2%; in the treatment group, 117, or 3%. The absolute lift is one percentage point and the relative lift is 50%, as in the introductory example. The standard error is `√(0.03 × 0.97 / 3,900 + 0.02 × 0.98 / 3,900) ≈ 0.0035`, or 0.35 percentage points, and the interval for the difference runs from about 0.31 to 1.69 percentage points, excluding zero. With the same proportions, the interval became narrow because the groups are four times larger than in the introduction. Sufficient group sizes increase the chance of detecting an effect but do not guarantee that outcome in the next test.

<!-- section: task | Task: plan one experiment -->
Complete the task in the document on this page. Choose one marketing or sales action whose effect you are unsure about: an email campaign, an offer of engineering help, a webinar or advertising in one region. Write an experiment plan: randomization unit, group sizes, outcome, duration, minimum effect of interest and stopping rule. Then use the rule from the lesson to estimate how many accounts each group needs for an 80% chance of detecting the expected effect.

<!-- section: sources -->
- Google Meridian, model specification — https://developers.google.com/meridian/docs/advanced-modeling/model-spec
- Google Meridian, introduction — https://developers.google.com/meridian/docs/basics/meridian-introduction
- Google Meridian, experiment calibration — https://developers.google.com/meridian/docs/advanced-modeling/set-custom-priors-past-experiments

<!-- lesson: metrics.channels | Search, acquisition cost by channel and content results | 26 -->
<!-- section: hook -->
The quarterly report shows that tutorial A was read by 20,000 people and tutorial B by 5,000, so B's author is asked to write “like author A”. A month later, it turns out that article A was followed by 20 activations of accounts matching the target profile, while article B was followed by 30. The first article wins on views; the second wins on substance. This lesson examines which metrics show the work of search, acquisition channels and content, and which are useful only for diagnostics.

<!-- section: theory | Share of search and branded search -->
Share of search in a category is the number of branded searches for your brand divided by the total branded searches for a fixed set of brands. With 12,000 searches for your brand and 60,000 across the group, the share is 20%. Fix the country, language, period and search engine, and agree how to distinguish homonyms: Terraform may express interest in the technology without referring to a particular vendor. Google Trends provides normalized indices; values from separate exports without a common scale cannot be added. Search Console shows only your site's data, not competitors' actual volumes. Share of search indicates interest; it is neither market share nor purchase probability.

For branded search, examine impressions, clicks, click-through rate (clicks divided by impressions, for example 3,000 out of 50,000, or 6%), landing-page conversion and the number of branded-query variants. Separate navigational queries such as “login” and “support” from commercial ones. Falling clicks with stable qualified demand may mean people are finding answers elsewhere, for example through an AI assistant; that hypothesis needs testing.

<!-- section: theory | Acquisition cost by channel -->
Fully loaded customer acquisition cost (CAC) by channel is acquisition costs assigned to the channel divided by new paying customers attributed to it. Costs include advertising, agencies, content production, salaries for marketing, sales development representatives (SDRs), salespeople and presales engineers, tools and an agreed allocation of overhead. The same cost must not appear in two channels, and acquisition costs are separated from existing-customer expansion costs. In multitouch attribution, the denominator may be a sum of fractional customer shares. Show advertising-only cost, blended cost across all channels and experimental incremental cost alongside it; do not call them all the same thing.

For example, search cost $120,000, another $30,000 in sales costs was allocated to it, and 25 new customers arrived. Fully loaded CAC is $6,000 per customer; advertising-only cost is $4,800. If the first annual contract is $12,000 with an 80% gross margin, a customer contributes $800 in monthly gross profit, and acquisition pays back in 7.5 months. If January spend created demand that closed in June, simply dividing a month's spend by that month's customers is misleading; cohort reconciliation allowing for the lag is needed.

<!-- section: theory | What counts as a content outcome -->
Each content type has its own primary outcome:

| Content | Primary outcome | Useful diagnostics |
|---|---|---|
| Documentation and quickstart | Share of accounts reaching first value and time to it | Example success, installation errors, unanswered searches, transition from documentation to a working integration |
| Technical tutorial | Activated target-profile accounts per 1,000 readers, then PQAs and payments | Unique readers, traffic quality, product versions, organic and paid traffic shares |
| Comparison and migration guide | Qualified evaluations and opportunities progressing through stages | Technical objections, completed migrations, influenced opportunities without double counting |
| Research, conference, community | Reach within the target profile, subsequent demand, buyer self-report | Buying-group members, return visits, qualitative feedback |
| Security and procurement materials | Review speed and win rate of mature evaluations | Number of question rounds, waiting time, rejection reasons |

On the primary metric, the opening articles look like this: tutorial A produced one activation per 1,000 readers; tutorial B produced six. B is more effective on this metric, but a causal effect is not yet proven: B's audience may have arrived with stronger intent. Views, downloads and time on page are diagnostic and unsuitable as the sole goal. Spending a long time reading documentation sometimes means someone is stuck.

<!-- quiz -->
? A brand received 12,000 searches and the entire brand group 60,000. What can be said about its 20% share of search?
- The company has 20% market share because search interest is proportional to sales || Share of search is not market share.
+ It is an indicator of interest for the selected country, language, period and brand set || Without that scope, the number is not comparable.
- One in five category buyers will choose this product for their next purchase || Search does not measure purchase probability.
? Search cost $120,000 in advertising and $30,000 in sales costs, bringing in 25 customers. What is fully loaded CAC?
- $4,800, because sales costs do not belong to the channel || That is advertising-only cost.
+ $6,000 per customer: $150,000 in costs divided by 25 new customers || $150,000 divided by 25 customers.
- $1,200: sales cost per customer, excluding advertising || Advertising is included in fully loaded cost.
? Tutorial A produced 20 activations from 20,000 readers; B produced 30 from 5,000. What follows?
+ B performs better on activations per thousand readers, but a causal effect is unproven || The audiences may have differed.
- A is better because its reach is four times larger and more people learn about the brand || Reach is diagnostic here.
- The tutorials are equal: a difference of 10 activations is statistically insignificant at these volumes || Six versus one per thousand is a substantial difference.
<!-- /quiz -->

<!-- section: task | Task: an outcome for each content type -->
Complete the task in the document on this page. List the types of content your team produces and record the primary outcome, diagnostic metric and data source for each. Then take two pieces of the same type from last quarter and compare their primary outcome per thousand readers. If that outcome is not measured yet, write down which event or data link is missing.

<!-- section: sources -->
- Google Trends, help on data normalization — https://support.google.com/trends/answer/4365533
- Google Search Console, performance report — https://support.google.com/webmasters/answer/7576553
