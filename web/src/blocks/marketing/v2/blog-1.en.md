<!-- lesson: marketing.blog-formats | The technical blog: what to write so people read it for years | 18 -->
<!-- section: hook -->
An infrastructure company has a blog with a new post every two weeks. Almost all its posts are release announcements or retellings of documentation, read only by product users. One day, a company engineer wrote an analysis of a customer outage: how a network configuration error made a service unavailable for two hours, how the team found it, and what they changed in the product. More people read that analysis than all the year's announcements combined, two newsletters linked to it, and sales began sending it to buyers who asked about reliability. This lesson covers formats that make a technical blog a company asset, and who should write those texts.

<!-- section: theory | Why an infrastructure company needs a blog -->
A technical blog serves three purposes. It introduces the company to engineers who have not heard of it: good posts spread through Hacker News, Reddit, newsletters, and chats. It helps buyers evaluating options see how the company thinks and works: how it approaches outages, security, and measurements. And it adds to what search engines and AI systems find when people ask about problems in the category. A company news feed serves only one purpose, informing existing users, and release notes and a newsletter are better suited to that.

<!-- section: theory | Formats that work -->
Published cases from infrastructure companies in 2025–2026 show several formats that people read and cite.

The first format is built on the company's own data. In July 2025, Cloudflare published observations from its network showing the ratio between the number of website pages AI crawlers read and the visits those AI systems send back to websites. Only that company has those data, so other authors cite them. A small company also has its own data: measurements on its hardware, support request statistics, and results from surveys of project users.

The second format analyzes an outage. Cloudflare described its November 18, 2025 outage in detail; in March 2025, Grafana described an incident lasting around 150 minutes that affected roughly a quarter of Grafana Cloud services. Such an analysis describes the chain of causes, the consequences, and what the team changed. It does not prove that the company never makes mistakes; it shows how the company acts when it does, and that matters more to an infrastructure buyer.

The third format is a benchmark: a comparative performance measurement. In May 2026, PlanetScale published a discussion of how to compare databases properly and removed the ban on publishing benchmarks from its terms of use. A year earlier, Xata's CTO repeated PlanetScale's PostgreSQL benchmarks and publicly criticized the choice of workloads and interpretation of the results. The rule that follows is that a benchmark attracts both attention and scrutiny, so it must describe the hardware, settings, price, workload, and how to reproduce the measurement.

The fourth format describes difficult work that is usually invisible from outside. At Chainguard, two principal engineers wrote a series about why vulnerability scanners' results are so hard to reconcile with actual package contents. Isovalent examines specific functions of its security system and compares logging methods by their CPU and memory demands. Sidero published a reference architecture for a Kubernetes cluster on Talos Linux. Such texts show buyers the hidden complexity of the problem the product solves.

The fifth format is an open engineering work log. Fly.io maintains a public infrastructure changelog recording changes, tradeoffs, and fixes, including its own mistakes.

The sixth format is a launch week. In July 2025, Supabase held another launch week: each day brought a major release with a detailed post, and a hackathon ran around the week. The format works when a company has accumulated five real releases; a launch week made of minor changes feels forced.

<!-- section: theory | Who writes -->
Engineers write the best infrastructure blog posts because only they know the details. But you should not expect every engineer to start writing regularly on their own. PostHog's handbook describes how its editorial team works: knowledge comes from engineers, while writer-editors interview them, structure the text, edit it, and keep it up to date. In its 2025 review, PostHog also acknowledges that its plan to publish a post every week ran into staffing and quality constraints, and that some posts did not work.

This suggests a practical approach for a small company. Once a week, an editor or marketer interviews one engineer for half an hour about what they did or learned. The editor drafts a post from the interview, the engineer reviews and adds to it, and the post is published under the engineer's name. The engineer spends an hour or two on the post instead of two evenings, and the blog gains the voice of the person who did the work.

In 2026, Grafana went further and launched a separate Medium publication for writing by its engineers and community, promoting the best pieces through the main company blog. This saves editorial resources but gives some search traffic to another platform; the company has not yet reported the results.

<!-- section: theory | What not to do -->
Do not publish a post just to keep to a schedule: an empty post every week is worse than a good one every month, and the published cases imply no optimal number of posts per week. Do not hide an outage analysis if customers already know about the incident: silence reads worse than acknowledgment. Do not publish a benchmark that cannot be reproduced. Do not turn a technical post into an advertisement in its final paragraph: one calm sentence about where the product helps with this problem is appropriate, while a “book a demo” call at the end of an outage analysis is off-putting.

<!-- section: task | Task: a quarterly calendar -->
The task takes longer than reading the lesson: three fifteen-minute conversations and about an hour for the topics. Record the result in the field below or in your own spreadsheet with the columns “topic”, “format”, “author”, “editor”, “original data or code”, “needs customer or legal approval”. Talk to three team engineers for fifteen minutes each and ask what was hardest in their work over the past quarter, what broke and how they fixed it, and what measurements they took. From their answers, put together six post topics for the quarter and specify each one's format from this lesson, author, editor, and the original data or code it will contain. Mark topics requiring a customer's or lawyer's approval and start seeking that approval early.

<!-- quiz -->
? Which technical blog post format requires describing the hardware, settings, workload, and how to reproduce the measurement?
- An incident review || An incident review describes the chain of causes and the changes made; it usually does not include a reproducible measurement.
+ A benchmark || The PlanetScale and Xata story shows that benchmarks attract both attention and scrutiny from competitors.
- A release announcement || An announcement does not contain measurements.

? How can a small company get posts from engineers without taking up their evenings?
- Set a schedule: every engineer writes a post once a week during working hours || PostHog acknowledges that this schedule runs into staffing and quality constraints.
- Write posts with AI from tracker tasks and publish them under engineers' names || Readers notice this kind of writing, and the blog loses its voice.
+ An editor interviews the engineer and writes a draft; the engineer checks it, and the post goes out under the engineer's name || This is how PostHog's editorial process works: engineers provide the knowledge, and an editor provides the text.
<!-- /quiz -->

<!-- section: sources -->
- PostHog, 2025 newsletter review — https://newsletter.posthog.com/p/the-best-of-product-for-engineers (22.12.2025)
- PostHog, content handbook — https://posthog.com/handbook/content (checked 25.11.2026)
- Cloudflare, AI crawl-to-refer ratio — https://blog.cloudflare.com/ai-search-crawl-refer-ratio-on-radar/ (01.07.2025)
- Cloudflare, November 18, 2025 outage — https://blog.cloudflare.com/18-november-2025-outage/ (18.11.2025)
- Grafana, partial outage analysis — https://grafana.com/blog/how-we-responded-to-a-2-hour-partial-outage-in-grafana-cloud/ (14.03.2025)
- Grafana, Unprompted publication — https://grafana.com/blog/from-ai-agents-to-fishing-dashboards-the-latest-stories-from-unprompted/ (20.11.2026)
- PlanetScale, on benchmarking — https://planetscale.com/blog/on-benchmarking (05.05.2026)
- Xata, response to PlanetScale benchmarks — https://xata.io/blog/reaction-to-the-planetscale-postgresql-benchmarks (16.07.2025)
- Chainguard, vulnerability scanner integration — https://www.chainguard.dev/unchained/this-shit-is-hard-vulnerability-scanner-integration (30.06.2025)
- Isovalent, Runtime Security 1.18 — https://isovalent.com/blog/post/isovalent-runtime-security-118/ (04.12.2025)
- Fly.io, infrastructure log — https://fly.io/infra-log/2025-01-25/ (25.01.2025)
- Supabase, launch weeks — https://supabase.com/blog/categories/launch-week (July 2025)

<!-- lesson: marketing.blog-distribution | How a post finds readers and subscribers | 16 -->
<!-- section: hook -->
A blog post went live on Thursday evening, forty people read it, and by Monday it was forgotten. A month later, the same team released its next post differently: on publication day, the engineer discussed it in a relevant subreddit and on LinkedIn, the link went into the project's newsletter, release notes, and an answer to a Slack question, and two weeks later the editor pitched a shortened version to an industry publication. Eight thousand people read this post, and three hundred subscribed to the newsletter. This lesson covers distributing each post and turning readers into subscribers.

<!-- section: theory | Distribution is tied to the post itself -->
A good post has natural places where it is needed. An outage analysis gets a link from the status page and from support replies to affected customers. A benchmark is published alongside a repository containing the measurement scripts and becomes the basis of a talk. A detailed analysis of a new feature gets links from release notes, documentation, and the newsletter. Write the distribution plan alongside the post outline: which three to five places should link to it in its first week, and who will make that happen.

Then the post goes out to platforms under each one's rules, covered in the “Platforms” module: the engineer who wrote it discusses it where they have an established reputation; it is submitted to Hacker News only if it interests people who do not use the product and the author is ready to answer comments. After a few weeks, the same material can be republished with a canonical link and cut into shorter formats.

<!-- section: theory | Subscriptions: RSS and email -->
A reader arriving from Hacker News will leave and never return unless the blog offers a way to follow new posts. There are two ways, serving different purposes. An RSS or Atom feed is for readers who collect blogs in a feed reader; Hugo and other site generators create it automatically, and its link should be visible. An email subscription is for people who want emails; the signup form should be at the end of every post and explain what they will receive and how often.

It is useful to separate the blog newsletter from security and release notifications: someone who signed up for engineering analyses does not want promotional emails, while someone who signed up for security warnings must receive them even if they unsubscribe from everything else. Do not count followers of the company's LinkedIn page as your own list: those people belong to LinkedIn, and the company cannot email them.

<!-- section: theory | What to measure -->
For each post, it is useful to record the author, how much time it took, its format, where it was distributed, how many real people read it, how many external sites linked to it, how many people subscribed after reading it, and how many readers went on to documentation or a trial installation. Calculate subscriptions relative to people who saw the signup form; if you divide by all visitors, a bot that loaded the page lowers the conversion rate. RSS feed requests cannot be counted as subscribers: a single feed reader may request it many times a day. Compare posts on these measures once a quarter, and after six months you will see which formats and topics work for your audience.

<!-- section: task | Task: a distribution plan for one post -->
Complete this task in a document. Take one post topic from the calendar you created in the previous lesson. Record five places that should link to it in its first week and the person who will make that happen. Record two platforms where the author will discuss the post, and how the discussion will differ on each. Check the company's blog: is there a visible RSS link, is there a signup form at the end of the post, and does it explain what the person will receive?

<!-- widget: deptsim {"scenario":"marketing.blog"} -->

<!-- quiz -->
? Why should blog subscriptions be measured relative to the people who saw the subscription form?
+ Otherwise bots that loaded the page drag the sign-up share down || The denominator should consist of real people who saw the form.
- It gives higher percentages, which are easier to show to management in a report || The aim of measurement is accuracy; an attractive number in a report achieves nothing.
- GA4 requires it: a sign-up event is counted only after the form has been shown || This is a choice of measurement method, not something the tool imposes.
<!-- /quiz -->

<!-- section: sources -->
- Hugo, RSS templates — https://gohugo.io/templates/rss/ (08.11.2026)
- Fly.io, infrastructure log with RSS — https://fly.io/infra-log/2025-01-25/ (25.01.2025)
- Grafana, promoting engineers' writing — https://grafana.com/blog/from-ai-agents-to-fishing-dashboards-the-latest-stories-from-unprompted/ (20.11.2026)
- PostHog, 2025 newsletter review — https://newsletter.posthog.com/p/the-best-of-product-for-engineers (22.12.2025)
