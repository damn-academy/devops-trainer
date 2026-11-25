<!-- lesson: marketing.platforms-map | How to choose platforms for an infrastructure product | 16 -->
<!-- section: hook -->
A company ships a major release, and its marketer posts the same news in eight places in a single evening: LinkedIn, X, Reddit, Hacker News, Telegram, dev.to, the newsletter, and the blog. A week later, it turns out that a moderator removed the Reddit post, it received no comments on Hacker News, company employees liked it on LinkedIn, and the only new user came from the newsletter. This lesson explains why this happens: each platform has its own audience, rules, and way of deciding what to show, and one news item sent everywhere loses almost everywhere.

<!-- section: theory | What makes up a platform -->
It helps to describe each platform through three properties. The first is its audience: who reads and writes there, and what those people are looking for. The second is its rules: what the platform and its moderators allow companies to do, and what they consider advertising. The third is its distribution mechanism: how the platform decides who sees a post, whether through a recommendation feed, reader votes, search, or subscriptions.

The audience matters more than the platform's size. A Pew Research Center survey of five thousand American adults in 2025 found that 84% use YouTube, 26% use Reddit, 21% use X, and 4% use Bluesky. These figures describe the country's population, while your buyer is a platform engineer or a head of infrastructure, whose distribution across platforms is different. Engineers choosing tools read Hacker News, specialist subreddits, GitHub, and technical newsletters. Leaders who approve budgets read LinkedIn, industry media, and analyst reports. So a marketer's first decision is which person from the [[marketing.icp|buyer profile]] they want to meet on a platform, and only then which platform to choose.

Platform rules are written down, and you should read them in full before your first post. Hacker News asks people not to use the site primarily for promotion and prohibits asking for votes. Reddit leaves decisions about self-promotion to each community's moderators, and the rules of r/selfhosted, r/homelab, and r/kubernetes differ considerably. Lobsters limits a member's own links to a quarter of all their submissions and comments over a year. Since March 2026, LinkedIn has been downranking generic posts and manipulated comments. Breaking the rules costs more than skipping a platform: a community remembers a removed post and an “advertising” label for a long time.

The distribution mechanism determines what a post needs to achieve in its first few hours. On Hacker News, the first votes and comments determine a post's fate, followed by freshness, so it is important for the author to be present and respond. LinkedIn's feed shows a post to people the system expects to find it interesting, so the topic and opening lines matter. On YouTube, people find videos through searches for a specific task and through recommendations, and a good demonstration keeps gaining views for years. Every subscriber receives the newsletter, but only those interested in the author open it.

<!-- section: theory | Three roles platforms play in marketing -->
Platforms can usefully be divided by their role in the buyer's journey. Some create awareness: people who have never heard of a product encounter it for the first time. These include Hacker News, Reddit, YouTube, LinkedIn, and conference talks. Others help people choose: a buyer who already knows about the product compares it with alternatives and looks for evidence. These include documentation, comparison pages, GitHub, Reddit discussions, and AI answers that cite those discussions. A third group holds people's attention: someone interested in the product receives news and knowledge from the company and returns. These include newsletters, podcasts, YouTube channels, and Slack or Discord communities.

Many companies start with the mistake of giving every platform the same role, usually that of a loudspeaker for company news. Release news belongs in a newsletter and in GitHub release notes, where subscribers expect it. On Hacker News and Reddit, the same news looks like advertising, while an analysis of the technical problem the release solved interests even people who do not use the product.

<!-- section: theory | How many platforms a company needs -->
A small company does not need to be on every platform. Each requires regular work: replying to comments, understanding local rules, and using its own format. Two or three platforms where the company works every week and has people with established reputations deliver more than ten platforms that receive the same news once a month. Other platforms can be used occasionally: for a major release, a talk, or research that fits that platform better than the others.

People do the work on platforms, and a company logo is trusted less than a person. A Metricool study comparing nearly 674 thousand LinkedIn posts from early 2025 and 2026 found that personal profiles have higher engagement than company pages: 2.6 reactions per hundred impressions versus 1.6. On Reddit and Hacker News, a post on behalf of a company almost always meets suspicion, while an engineer who names their employer and examines their own problem gets a conversation. So choosing platforms also means choosing the people in the company who will work on them: the founder, engineers, and DevRel.

<!-- section: task | Task: your company's platform map -->
Complete this task in a spreadsheet, a document, or on paper. List four roles from your buyer profile, such as a platform engineer, a head of infrastructure, a security specialist, and a chief financial officer. For each role, name two platforms that person visits every week, then check your assumptions and record how you know: from customer conversations or from a guess. Next, for each platform, record which of the three roles it will play, which person in the company will work on it, and how many hours a week that will take. If the total exceeds the hours you have available, cross out the platforms where you have no one with an established reputation.

<!-- quiz -->
? A marketer wants to choose platforms for an infrastructure product. Where should they start?
+ With the roles in the buyer profile and where people in each role spend time every week || The audience matters more than the platform's size: engineers and executives read different places, so choose a platform for a specific person.
- With the platform that has the most users || Pew's survey says 84% of Americans use YouTube, but that represents the country's population; the survey did not study platform engineers and infrastructure leaders separately.
- With platforms where the company already has an account || A company account on a platform says nothing about whether your buyer is there.

? Why does the same release announcement, posted in eight places in one evening, underperform almost everywhere?
+ Platforms have different audiences, rules, and distribution mechanisms, so one announcement does not fit them all || On Hacker News and Reddit, a release announcement looks like advertising, while newsletter subscribers expect it.
- Platforms penalize posting on the same day || There is no universal rule about posting on the same day; the problem is that the format does not fit each platform.
- Release announcements never interest anyone || In a newsletter and release notes, a release announcement is appropriate and useful.
<!-- /quiz -->

<!-- section: sources -->
- Pew Research Center, Americans' Social Media Use 2025 — https://www.pewresearch.org/internet/2025/11/20/americans-social-media-use-2025/ (20.11.2025)
- Metricool, LinkedIn Study 2026 — https://metricool.com/wp-content/uploads/Linkedin-Study-2026-EN.pdf (April 2026)
- Hacker News Guidelines — https://news.ycombinator.com/newsguidelines.html (checked 25.11.2026)
- Lobsters, About — https://lobste.rs/about (checked 25.11.2026)
- LinkedIn, Improving the Feed — https://news.linkedin.com/2026/ImprovingTheFeed (12.03.2026)

<!-- lesson: marketing.platforms-linkedin | LinkedIn: personal profiles, documents, and the new feed | 18 -->
<!-- section: hook -->
The head of infrastructure at a bank, who will be choosing a private cloud platform in six months, spends twenty minutes scrolling through LinkedIn every morning. They do not follow your company and have no intention of doing so. If they see you at all, it will be in a post by your engineer that a former colleague liked, or in a document analyzing a migration that an employee forwarded to them. This lesson covers how LinkedIn's feed works in 2026, how a personal profile differs from a company page, and which formats reach people who make infrastructure purchasing decisions.

<!-- section: theory | How the feed decides what to show -->
On March 12, 2026, LinkedIn announced a redesign of its feed: the system began using language models to understand posts' content and members' interests, and to take into account the sequence of what a person had read and interacted with. In the same announcement, LinkedIn named what it would downrank: recycled generic posts, engagement bait such as “comment ‘yes’ below,” automated comments, and groups that exchange likes, which marketers call pods. The practical conclusion is that everything that used to inflate reach artificially now works against the author, while a post about specific experience on a specific topic has a better chance of reaching people interested in that topic.

LinkedIn's engineering blog describes the system but does not publish its formula. Advice such as “always reply to all comments in the first hour,” “use exactly three hashtags,” or “reading time doubles reach” is not supported by any published LinkedIn document. It should be treated as individual authors' observations that the platform has not confirmed.

<!-- section: theory | Personal profiles and company pages -->
A company page and an employee's personal profile do different jobs. Metricool's 2026 study compared posts from 63 thousand accounts and found that company pages and personal profiles have almost the same average number of impressions, around 830 and 820, but people react to personal posts more often: 2.6 reactions per hundred impressions for personal profiles versus 1.6 for company pages. In the same study, a link in a company page's post was associated with more impressions, while a link in a personal post was associated with fewer: roughly a quarter fewer impressions and a fifth fewer reactions. The study is observational: the authors compared different accounts rather than conducting an experiment, so its figures indicate a direction and cannot serve as a law.

This suggests a division of labor. The company page publishes what should remain in the company's history: releases, customer case studies, job openings, and recordings of talks, and links belong in those posts. The founder's and engineers' personal profiles tell stories about what those people know from their own work: why the team chose one architecture over others, what broke during a customer's migration and how they fixed it, and what measurements they obtained on real hardware. Such a post can work without a link, and a link can go in a comment or in the author's profile if readers do not expect it in the text itself.

People often repeat that employees have ten times the reach of the company. That figure comes from a 2016 LinkedIn article about employer branding, and there are no recent measurements confirming it for infrastructure companies. Companies need employees on LinkedIn for a different reason: people trust them more than a logo, and their former colleagues read their posts, including future buyers.

<!-- section: theory | Formats that reach infrastructure buyers -->
A LinkedIn document, which marketers call a carousel, consists of several PDF pages that readers swipe through without leaving the feed. For an infrastructure product, this is a useful format for an architecture analysis, a total cost of ownership comparison, a step-by-step VMware migration plan, or a security requirements checklist. People forward such documents within a company, and they reach people who do not read LinkedIn themselves. Metricool's study shows high engagement for documents, but bear in mind that each page turn may count as an interaction, so the high figure partly reflects how the format works.

Video on LinkedIn is growing: according to the platform's head of video product, video watch time in February 2025 had grown 36% year over year. Meanwhile, a Socialinsider study of 2.45 million company page posts found that average views per video were falling because there was much more video. Both figures can be true at once: people watch more, but each video gets fewer viewers. A short demonstration narrated by an engineer showing how the product solves one problem works better than a promotional video.

A LinkedIn newsletter lets people subscribe to an author or page and receive new editions through notifications and email. It is useful for a founder who regularly writes long articles about the market, but it does not replace the company's own newsletter: the subscriber list remains with LinkedIn, and the company cannot transfer it to its own mailing list.

<!-- section: theory | What not to do -->
Do not buy into groups that exchange likes or use programs that automatically comment on other people's posts: LinkedIn has named them as targets for downranking. Do not publish identical text on behalf of ten employees on the same day: the system sees repeated text, and people see a campaign. Do not begin a personal post with a product advertisement: the opening lines determine whether someone expands the text, and an advertising opener stops them from reading. Do not measure success by employee likes. Useful measurements include messages from people at target companies, visits to documentation, invitations to calls, and mentions of the post in sales meetings.

<!-- section: task | Task: one engineer's post and one document -->
Complete this task on LinkedIn or in a draft. Take one technical problem your team solved in the past month and write a personal post on behalf of the engineer who solved it: describe the situation in the first line, then what you tried, what worked, and what did not, ending with a question for readers to which the author does not have a ready answer. Next, turn the same topic into a six-to-eight-page document for the company page: a diagram, steps, figures, and a conclusion. After two weeks, compare who reacted to each post: how many of them work at companies that fit your buyer profile.

<!-- quiz -->
? What did LinkedIn announce it would demote in the feed in March 2026?
+ Generic recycled posts, engagement bait, automated comments, and engagement pods || LinkedIn's announcement of March 12, 2026 states this explicitly.
- All posts with links || Metricool's study found that links on company pages even correlated with greater reach; there is no blanket ban on links.
- Posts longer than a thousand characters || The announcement says nothing about post length.

? What does the claim that employees have ten times the reach of a company page show?
+ It is a figure from a 2016 LinkedIn publication, and there are no recent measurements for infrastructure companies || It is repeated as fact, but it does not serve as current evidence.
- It is a finding from Metricool's 2026 study || Metricool compared engagement: 2.6 reactions per hundred impressions for personal profiles versus 1.6 for company pages.
- It is an official rule of the LinkedIn feed || LinkedIn does not publish multipliers for employees.
<!-- /quiz -->

<!-- section: sources -->
- LinkedIn, Improving the Feed — https://news.linkedin.com/2026/ImprovingTheFeed (12.03.2026)
- LinkedIn Engineering, The next generation of LinkedIn's feed — https://www.linkedin.com/blog/engineering/feed/engineering-the-next-generation-of-linkedins-feed (12.03.2026)
- Metricool, LinkedIn Study 2026 — https://metricool.com/wp-content/uploads/Linkedin-Study-2026-EN.pdf (April 2026)
- Socialinsider, LinkedIn benchmarks — https://www.socialinsider.io/social-media-benchmarks/linkedin (checked 25.11.2026)
- LinkedIn, video growth — https://www.linkedin.com/pulse/up-36-over-last-year-video-linkedin-booming-time-now-somasundaram-yqbzc/ (04.02.2025)
- LinkedIn Help, newsletters — https://www.linkedin.com/help/linkedin/answer/a517914 (checked 25.11.2026)
