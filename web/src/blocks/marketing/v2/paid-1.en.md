<!-- lesson: marketing.paid | Paid promotion you can evaluate | 22 -->
<!-- section: hook -->
The board allocated $30,000 for a quarter's advertising. The marketer launched LinkedIn ads targeting “platform engineer” and “head of infrastructure” job titles, and the campaign generated 140 completed report-download forms over the quarter. Sales called everyone and discovered that almost none of them intended to evaluate anything: the report was interesting, but there was nothing to buy and nobody ready to buy it. This lesson covers which paid channels work for infrastructure products according to published cases from 2025–2026, how much they cost, how they operate, and how to check whether the money produced anything beyond clicks.

<!-- section: theory | What counts as a result -->
A paid channel is evaluated by what someone does after clicking. For an infrastructure product, these actions form a sequence: opening documentation, launching a practice environment, installing the product on their own machine, starting to use it in an organization, requesting a commercial evaluation, and becoming a sales opportunity. In its public handbook, PostHog separates campaigns into acquisition and awareness and measures engaged visits, organization signups, organizations that continue using the product, and revenue for each. Self-managed installations of an open-source product are often entirely invisible, and that gap should be stated openly in the report.

Platforms and publishers publish their success stories and almost never their failures, so every published case describes a selected success. The sales pipeline reported in these accounts is the sum of potential deal values, not revenue: usually only a smaller portion closes.

<!-- section: theory | Newsletter sponsorship -->
TLDR sells advertising in its technical newsletters, with no more than three advertisers per edition; according to the publisher, TLDR DevOps has 350 thousand subscribers and a 42% open rate. There is no fixed rate card; pricing is quoted on request. TLDR published a Plaid case study: a fintech predictions campaign generated 70 inquiries and $382 thousand in pipeline, which the publisher called a “20.1x return”; the campaign cost and how many deals closed were not stated. In the case of cybersecurity company ThreatSpike, each campaign generated $25–75 thousand in pipeline, according to the publisher. Cooper Press, publisher of JavaScript Weekly, Node Weekly, Go Weekly, and Postgres Weekly, publishes prices for Q4 2026: a main placement in Postgres Weekly costs $1,280, in Go Weekly $1,120, and a short ad $200–250.

PostHog, by contrast, paused paid newsletter placements because the cost per conversion was too high, and noted that linking to a specific article brings subscribers more effectively than linking to a general signup page. For a newsletter placement, agree in advance on the edition, position in the email, date, number of delivered emails, method of counting unique clicks, and compensation if the publisher fails to deliver what was promised.

<!-- section: theory | Podcast sponsorship -->
The Changelog publishes its rates: its main podcast costs $3,000 per week for two episodes with a four-week minimum, or at least $12,000, while the short news edition costs $1,500 per week. The publisher estimates 20–25 thousand listens per main-show episode in the first 30–45 days. Dividing $1,500 by that figure gives $60–75 per thousand listens; this is a calculated figure, and the publisher does not guarantee that reach. Measure a podcast through a memorable address the host says aloud, the question “How did you hear about us?”, and a dedicated link in the description.

<!-- section: theory | Reddit Ads -->
Reddit advertising can show ads to people who subscribe to selected communities or have visited them recently; this is not the same as showing ads only within the selected subreddit, and the help documentation describes a 28-day activity window. Since March 2026, Reddit has required automatic audience expansion to similar people in some configurations, so a narrow audience no longer guarantees narrow delivery: check placement reports and exclusions. Reddit publishes a Bitly case study showing growth in new website users, but there are no recent measured cases for infrastructure products, and PostHog reported weak Reddit results in 2023. A Reddit ad should look like a useful post: a specific problem and a destination readers can evaluate, such as a deployment guide or a practice environment.

<!-- section: theory | LinkedIn Ads -->
LinkedIn is expensive, and cost estimates vary. From 138 advertisers' campaigns in 2025, Metadata found median costs of $9.39 per click, $63 per thousand impressions, and $202 per inquiry, with a click-through rate of 0.67%. In 2026, Dreamdata reported an average cost per click of around €6 and said that under its attribution model, LinkedIn delivered a better return than Google Search and Meta. PostHog reported paying more than $5 per LinkedIn click, 10–20 times more than on Meta.

LinkedIn offers two formats useful to an infrastructure company. Thought Leader Ads promote an employee's or founder's existing post with their permission; documents and polls cannot be promoted this way, and the author can revoke permission, stopping promotion. Document Ads distribute a document with or without a contact form; according to Metadata, an inquiry through a document cost $142 versus $200 for images and $265 for video. A cheap completed form does not make someone a buyer: the opening story shows where chasing forms leads.

<!-- section: theory | Google Search -->
Search advertising reaches a person while they are looking for a solution. Across 56 advertisers, Metadata found a median cost per click of $9.76 and a cost per inquiry of $524; Dreamdata reported that non-brand search click costs rose 29% while click-through rates fell 26%, though that observation does not establish a cause. Separate campaigns into three groups: your own company name, a problem or category, and competitor names. Google rules generally allow buying a competitor's name as a keyword, but restrict its use in ad copy and prohibit misleading people. Someone arriving from a competitor query should find an honest comparison page with a date, architecture, migration steps, and licensing.

<!-- section: theory | Contextual ads, reviews, retargeting, and creators -->
EthicalAds displays advertising on documentation and technical sites based on the page's topic, without tracking the person; as of November 2026, a thousand impressions in the DevOps category cost $4.10–6.50, with a $1,000 minimum campaign. Carbon Ads works similarly but quotes prices on request.

Review platforms G2, TrustRadius, and Gartner Peer Insights prohibit buying positive reviews and paying for a good rating; neutral compensation for a review is permitted only with disclosure, and Gartner limits it to a small amount. A review platform's paid services and customers' honest reviews are different things.

Retargeting, advertising to people who have already visited the site, generated inquiries at $196 according to Metadata, but those people were already interested in the product, so without a control group you cannot say the advertising caused a deal. In April 2025, Google decided against disabling third-party cookies entirely in Chrome, so the claim that “browser retargeting has disappeared” is incorrect, though it does not work everywhere.

PostHog calls long YouTube videos by creators who use the product themselves its strongest creator collaboration format, and in 2026 it was spending $228 thousand a month on newsletters and creators combined. US law requires paid partnerships to be clearly disclosed to viewers. Supporting open-source projects through GitHub Sponsors or direct donations, as Tailscale does for WireGuard, strengthens the ecosystem but does not buy advertising unless the sponsorship terms say so.

<!-- section: theory | What not to do -->
Do not put installation documentation behind a form: an engineer who needs a command will go to a competitor. The opposite claim, “gated content never works,” is also wrong: a research report behind a form can generate inquiries from managers. Do not buy impressions for their own sake. Do not launch old campaign types using old instructions: Google Ads migrated Video Action campaigns to Demand Gen by May 2026, and KubeWeekly can no longer be bought as a standalone newsletter. Do not ask a conference program committee to accept a promotional talk: KubeCon reviewer guidelines rate product pitches poorly.

<!-- section: task | Task: a measurable quarterly experiment -->
Complete this task in the “Budget allocation” simulator on this page and record the outcome in the field below with the columns “channel”, “amount”, “destination”, “tagged link”, “step counted as a result”, “minimum result to continue”. Divide a practice budget of $30,000 among three channels from the lesson. For each, record the destination (a comparison page, practice environment, or article), a separate tagged link, the step that will count as a result, and the minimum result required to continue the channel next quarter. Use the simulator to see how saturation and delays affect results after three, six, and twelve months, and how much the outcome varies from run to run.

<!-- widget: marketing.budget -->

<!-- quiz -->
? How does the pipeline reported in advertising success stories differ from revenue?
+ Pipeline is the total value of potential deals, and usually only a smaller portion closes || The Plaid case reports $382,000 in pipeline; it says nothing about revenue.
- They are the same thing || Pipeline consists of potential deals, and not all of them close.
- Pipeline is always exactly five times revenue || The ratio depends on the company's close rate.

? What happened to Reddit Ads targeting in March 2026?
+ Reddit made automatic audience expansion to similar people mandatory for some settings || A narrow audience no longer guarantees narrow delivery.
- Reddit banned ads in technical communities || There is no such ban.
- Reddit started showing ads only to community subscribers || Community targeting also reaches people who visited the community in the past 28 days.
<!-- /quiz -->

<!-- section: sources -->
- PostHog, paid marketing — https://posthog.com/handbook/marketing/paid; newsletter advertising — https://posthog.com/handbook/content/newsletter-ads; 2026 marketing budget — https://posthog.com/founders/actual-marketing-budget-2026 (24.06.2026)
- TLDR, Plaid and ThreatSpike case studies — https://advertise.tldr.tech/case-studies/plaid-adds-382k-in-pipeline-with-tldr-campaign-their-best-direct-buy-yet/ (16.09.2025), https://advertise.tldr.tech/case-studies/threatspike-adds-up-to-75000-in-net-new-business-pipeline-per-campaign-with-tldr/ (10.06.2025)
- Cooper Press, Q4 2026 media kit — https://cooperpress.com/files/cooperpress-media-kit-q4-2026.pdf
- The Changelog, sponsorship pricing — https://changelog.com/sponsor/pricing (checked 25.11.2026)
- Reddit Ads, audiences and automated targeting — https://business.reddithelp.com/articles/Knowledge/Overview-Reddit-Ads-Audience-and-Targeting, https://business.reddithelp.com/articles/Knowledge/automated-targeting (checked 25.11.2026)
- Metadata, what LinkedIn costs — https://metadata.io/resources/blog/what-linkedin-ads-cost (25.08.2026)
- Dreamdata, LinkedIn Ads Benchmarks 2026 — https://dreamdata.io/blog/announcing-linkedin-ads-benchmarks-report-2026 (10.03.2026)
- LinkedIn, Thought Leader Ads — https://business.linkedin.com/advertise/ads/sponsored-content/thought-leader-ads/specs (checked 25.11.2026)
- Google Ads, trademarks — https://support.google.com/adspolicy/answer/6118 (checked 25.11.2026)
- EthicalAds, for advertisers — https://www.ethicalads.io/advertisers/ (checked 25.11.2026)
- G2, community guidelines — https://legal.g2.com/community-guidelines; TrustRadius — https://www.trustradius.com/static/content-integrity; Gartner Peer Insights — https://www.gartner.com/reviews/faq (checked 25.11.2026)
- Google, Privacy Sandbox next steps — https://privacysandbox.google.com/blog/privacy-sandbox-next-steps (22.04.2025)
- FTC, disclosure of connections in endorsements, 16 CFR 255.5 — https://www.govinfo.gov/content/pkg/CFR-2026-title16-vol1/xhtml/CFR-2026-title16-vol1-sec255-5.html
- GitHub Sponsors — https://docs.github.com/en/sponsors/getting-started-with-github-sponsors/about-github-sponsors (checked 25.11.2026)
