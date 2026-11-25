<!-- lesson: marketing.search-changes | How search changed in 2024–2026 | 18 -->
<!-- section: hook -->
A marketer opens a Search Console report and sees that the company's page impressions in Google rose by a third over the year, while clicks nearly halved. The rankings are the same, the pages are the same, and nothing is broken. Search itself has changed: an AI answer now sits above the links, and people often get their answer without opening any website. This lesson covers what happened to Google Search over the past two years, which studies measured it, and how to read their figures without drawing the wrong conclusions for your own site.

<!-- section: theory | Helpfulness became part of the core algorithm -->
On March 5, 2024, Google announced that content helpfulness assessment, previously described as a separate Helpful Content update, had become part of several core ranking systems. Google also expanded its spam policies: mass-producing pages to gain search rankings violates the rules regardless of whether the pages were written by people, software, or a combination. For an infrastructure company, this means a thousand nearly identical Kubernetes glossary pages or “our product versus every competitor” comparisons remain a violation even if an engineer approved each page.

In November 2024, Google introduced a site reputation abuse policy: third-party material must not be placed on a strong site to exploit its search reputation, such as outside advertorials on a well-known engineering blog's subdomain. Since August 30, 2026, the procedure has changed in the European Economic Area: instead of manual actions against the offending part of a site, Google ranks those sections separately from the rest of the site. Old descriptions of this rule for Europe are outdated.

<!-- section: theory | AI answers above the links -->
Google's AI Overviews and AI Mode answer a query with text assembled from several sources. To appear in such an answer, a page does not need special markup or a dedicated file: it must be indexed and eligible to appear with a snippet. Ordinary settings such as `nosnippet` and `noindex` affect this. The separate Google-Extended setting controls another use of data and does not affect inclusion in search answers. In its 2026 guide, Google explicitly states that no special AI optimization is required, and that an `llms.txt` file is neither a positive nor a negative ranking factor.

Separate reports on page impressions in AI answers appeared in Google Search Console in June 2026 and became available worldwide by August 31. Old advice that “Search Console does not show AI visibility” is outdated, but the report shows only impressions, not full statistics on clicks and inquiries.

<!-- section: theory | How many clicks AI answers take away -->
Several studies have measured how AI answers affect clicks to websites, and each answers a different question.

In March 2025, Pew Research Center observed 900 American adults who performed nearly 69 thousand searches. When an AI Overview appeared above the results, people clicked an ordinary link in 8% of cases, compared with 15% without an overview; they clicked a link within the overview itself in 1% of cases. This is an observation of behavior, not an experiment, and queries with and without overviews differ in meaning.

Ahrefs compared Search Console data for 300 thousand queries from December 2023 and December 2025. The click-through rate for the first position in queries with an overview fell from 7.3 to 1.6 per hundred impressions, while for similar queries without an overview it fell from 7.6 to 3.9. After accounting for the overall decline, clicks on queries with an overview were 58% lower than expected. That figure means forty-two of every hundred expected clicks arrived; it does not mean sites lost 58% of all their traffic.

In 2025, Seer Interactive examined its clients' queries: from June 2024 to September 2025, the click-through rate for queries with an overview fell from 1.76 to 0.61 per hundred impressions, while brands cited in the overview received more clicks than those it did not cite. In a 2026 update using a broader sample, Seer found that from December 2025 to February 2026, the click-through rate for queries with an overview rose from 1.3 to 2.4, but still did not return to its January 2025 level.

In June 2026, Similarweb reported that 68% of Google searches ended without a click to an external website. That figure describes people's behavior in search overall: many queries, such as weather or exchange rates, never led to websites in the first place.

These studies support one conclusion: search clicks for informational queries have declined, and how much depends on how you count. For your own site, the only reliable measurement is to compare the same queries, in the same country, on the same device type, and at the same ranking before and after, separately for queries with and without the company name.

<!-- section: theory | What this means for an infrastructure company -->
AI answers primarily take clicks from simple questions with short answers. An engineer searching for how to fix a specific error during a cluster upgrade still opens the documentation because they need exact commands. A manager asking how one product category differs from another may get an answer without opening any website, so it is important for that answer to describe your company correctly. The next lesson covers how AI systems choose sources and how to influence their answers honestly.

<!-- section: task | Task: your own sample of queries -->
Complete this task in your website's Google Search Console, if you have access, or using the lesson's practice data. Choose twenty queries without the company name for which the site ranked in the top three both a year ago and now. Compare their impressions, clicks, and click-through rates for the same month in both years, on the same device type. Mark queries that now have an AI Overview. Record where clicks have declined and which pages could win them back: pages with exact commands, measurements, or comparisons that are absent from the short answer.

<!-- quiz -->
? What does Ahrefs' finding that queries with an AI Overview received 58% fewer clicks than expected mean?
+ Out of a hundred expected clicks on the top position, about forty-two arrived || This figure does not represent a loss of 58% of a site's total traffic.
- Websites lost 58% of all their traffic || The study measured the click-through rate for the top position in specific queries.
- The click-through rate fell by 58 percentage points || The click-through rate was about seven per hundred impressions, so it could not fall by 58 points.

? Does a page need special markup to appear in a Google AI Overview?
+ No, it needs normal indexing and eligibility to display a snippet || Google says no special optimization for AI is required.
- Yes, it needs an llms.txt file || Google explicitly says llms.txt does not affect ranking.
- Yes, it needs FAQ markup || Google stopped showing FAQ rich results in May 2026.
<!-- /quiz -->

<!-- section: sources -->
- Google, core algorithm and spam policy update — https://developers.google.com/search/blog/2024/03/core-update-spam-policies (05.03.2024)
- Google, site reputation abuse — https://developers.google.com/search/blog/2024/11/site-reputation-abuse (19.11.2024); EEA change — https://developers.google.com/search/blog/2026/08/update-site-reputation-policy (28.08.2026)
- Google, AI features in search — https://developers.google.com/search/docs/appearance/ai-features (10.12.2025)
- Google, generative search optimization guide — https://developers.google.com/search/docs/fundamentals/ai-optimization-guide (10.07.2026)
- Google, AI answer impression reports — https://developers.google.com/search/blog/2026/06/gen-ai-performance-reports (03.06.2026)
- Pew Research Center, clicks with AI Overviews — https://www.pewresearch.org/short-reads/2025/07/21/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/ (22.07.2025)
- Ahrefs, AI Overviews reduce clicks — https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/ (04.02.2026)
- Seer Interactive, 2026 update — https://www.seerinteractive.com/insights/aio-impact-on-google-ctr-2026-update (24.04.2026)
- Similarweb, zero-click searches — https://aisearch.similarweb.com/blog/zero-click-marketing/ (10.06.2026)
