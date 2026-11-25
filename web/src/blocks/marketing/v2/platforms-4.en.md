<!-- lesson: marketing.platforms-syndication | Blogging platforms and other people's newsletters: dev.to, Medium, Hashnode, Substack, daily.dev | 16 -->
<!-- section: hook -->
A company has a good technical blog on its own website, but only people who already know the company read it. The marketer decides to republish articles on dev.to, Medium, and Hashnode and connect the blog's RSS feed to daily.dev. A month later, they discover three problems: search shows the Medium copy above the original, daily.dev no longer accepts company blogs as sources, and the free method for automatically publishing on Hashnode has stopped working. This lesson covers how the platforms where infrastructure companies republish articles work in 2025–2026, and which old advice about republishing is now outdated.

<!-- section: theory | Canonical links -->
Republishing an article on another platform helps only if search engines understand where the original is. To do that, the copy includes a canonical link: the address of the original article on the company's website. dev.to supports a `canonical_url` field in article settings; Medium lets you set a canonical link manually, while importing an article by URL sets it automatically. After importing, check that the link is there. A canonical link does not guarantee that the original will rank above the copy, but without one, a strong platform will almost certainly outrank the company's site.

<!-- section: theory | dev.to and Hashnode -->
In February 2026, dev.to joined Major League Hacking, an organization that runs hackathons for students and younger developers; the platform's team remained, while Forem, the open-source engine behind dev.to, stayed a separate project. dev.to's audience is younger and broader than that of infrastructure platforms, and tutorials with working code are well received here: how to deploy, how to troubleshoot, and how a component works. The dev.to editor lets authors indicate AI involvement in writing the text, and that field should be filled in: the platform's readers notice generated text and stop trusting the author.

Hashnode added product documentation alongside blogs in 2024, and in 2026 changed its feed and stopped providing free access to its API; old instructions companies used to publish articles automatically on Hashnode no longer work without a paid plan. Before building automation around a platform, check its changelog.

<!-- section: theory | Medium -->
Medium pays authors for reads by paying subscribers. Since November 2025, part of those payments has depended on search traffic, and since February 2026, on how many new subscribers an article brings in. These rules are designed for authors earning money on Medium and have nothing to do with a company's objective. For an infrastructure company, Medium is useful as another place where an article can be found, but a tutorial with commands and requirements should not be hidden behind a paywall: a reader who needs an answer will go to someone who provides it for free.

<!-- section: theory | daily.dev -->
daily.dev is a feed of technical articles that many developers see in every new browser tab. In July 2024, the platform stopped adding company blogs as sources and offered Squads instead: communities where members manually post material. The rules require authors to disclose their connection to a company and prohibit selling spots in the community feed. The advice to “connect your blog's RSS feed to daily.dev” is outdated. The platform offers paid placements, and in its published case study of Context.dev, ads received 1.27 clicks per hundred impressions on the campaign's best day, compared with the platform's usual 0.3–0.5; the case study does not state how much the campaign cost or how many users it brought in.

<!-- section: theory | Substack and technical newsletters -->
Substack is a newsletter platform where readers subscribe to authors. PostHog, which makes an open-source product analytics tool, runs Product for Engineers on Substack: in 2025, it published 28 editions that were read more than a million times, and its subscriber count grew from 38 thousand to more than 100 thousand. The newsletter covers product engineers' work in general and hardly mentions PostHog itself; as a result, people who have not yet been choosing an analytics tool read it, and some later come to the product. Substack promotes newsletters through recommendations: authors can recommend other newsletters to their subscribers, and the platform claims that authors who recommend others are recommended three times as often; it does not disclose how it measured this.

Other people's newsletters form a separate channel. For an infrastructure audience, these include TLDR, Console.dev, DevOps Weekly, Last Week in AWS, and the CNCF monthly newsletter. The weekly KubeWeekly digest closed in May 2025 and merged into CNCF Monthly, so old advice to “get into KubeWeekly” no longer works. Some newsletters offer free inclusion if the material is useful to the editor; others require payment. The lesson on paid promotion covers newsletter sponsorship in more detail.

<!-- section: task | Task: a republishing plan for one article -->
Complete this task in a document. Choose one tutorial from the company's blog. Record which two platforms from this lesson are worth republishing it on and why you chose them, how you will set the canonical link on each, and how you will adapt the headline and opening paragraph to the platform's audience. Then find two newsletters run by others whose readers match your buyer profile, and read the latest three editions of each: what material gets included, and could yours be included too?

<!-- quiz -->
? Why should you specify a canonical link when republishing an article on dev.to or Medium?
+ So search engines understand where the original is and do not rank the copy above the company website || Without a canonical link, a strong platform will almost certainly outrank the site.
- So the article appears in the platform's recommendations || The canonical link is for search engines; it does not affect the platform's recommendations.
- Copyright law requires it || This is a mechanism for search engines, and the law does not require it.

? Can you connect a company blog's RSS feed to daily.dev as a source in 2026?
+ No, since July 2024 daily.dev has stopped adding company blogs as sources and offers Squads instead || The advice to connect your RSS feed to daily.dev is outdated.
- Yes, it is free and automatic || That was the case before July 2024.
- Yes, if the blog is in English || The language does not change the rule.
<!-- /quiz -->

<!-- section: sources -->
- DEV and Major League Hacking — https://dev.to/devteam/a-new-chapter-dev-is-joining-forces-with-major-league-hacking-mlh-3kfd (18.02.2026)
- DEV, editor guide — https://dev.to/p/editor_guide (checked 25.11.2026)
- Hashnode, changelog — https://hashnode.com/changelog (entries 19.02–07.10.2026)
- Medium, Partner Program changes — https://medium.com/blog/partner-program-update-starting-february-17-were-rewarding-stories-that-bring-in-new-members-3e84d2eb6e68 (18.02.2026)
- Medium Help, canonical links — https://help.medium.com/hc/en-us/articles/360033930293-Set-a-canonical-link (13.11.2026)
- daily.dev, discontinuing company sources — https://daily.dev/blog/why-we-are-discontinuing-company-sources-and-moving-forward-with-squads/ (28.07.2024)
- PostHog, newsletter highlights from 2025 — https://newsletter.posthog.com/p/the-best-of-product-for-engineers (22.12.2025)
- CNCF, the last KubeWeekly edition — https://www.cncf.io/kubeweekly/kubeweekly-434-this-isnt-goodbye-its-just-the-beginning-of-something-even-better/ (30.05.2025)

<!-- lesson: marketing.platforms-github | GitHub, Quora, Stack Overflow, and community chats | 16 -->
<!-- section: hook -->
An engineer follows a link from Hacker News to a project's repository and has half a minute to decide whether to spend an evening on it. They read the first screen of the README, check when the last release was, whether issues receive answers, and whether they can run the project on a laptop. If the first screen of the README talks about a “revolutionary next-generation platform,” the engineer closes the tab. This lesson covers how GitHub and question-and-answer sites work as marketing channels, and how to behave in Kubernetes and CNCF community chats, where a company can easily become a spammer.

<!-- section: theory | READMEs and releases -->
The README is the first page most engineers see when they arrive at an open-source project, and for many it replaces the company's website. A good README answers readers' questions in the order they ask them: what the project does, who needs it, what is required to run it, how to get it running in a few minutes, how it works, what license it uses, where to get help, and what the company behind it offers beyond the open-source project. If those answers are only on the website, a reader from Hacker News will not find them.

Release notes are written for people operating the project: what changed, what needs to be done before upgrading, compatibility with Kubernetes versions, and migration examples. Good release notes themselves become a reason to post on other platforms.

Discussions is the repository section for conversations unrelated to bugs in the code: architecture questions, installation help, and adoption stories. Answers in Discussions remain publicly accessible and can be found through search, unlike messages in a private chat.

<!-- section: theory | Trending, stars, and awesome lists -->
GitHub's trending page shows repositories gaining stars quickly, and appearing there brings new people. GitHub does not publish an official formula for inclusion, while buying stars corrupts the measurement itself and gets detected. Awesome lists are curated lists of tools organized by topic; the main awesome project requires each list to be focused and vetted, and each list has its own inclusion rules. A request to add a project to a list remains a request to a maintainer, who has the right to decline.

Repository traffic statistics are retained for around two weeks and show views, unique visitors, and clones, but their traffic source information is incomplete. If you launch a project on platforms, save the statistics promptly before they disappear, and do not count clones as installations: bots and builds clone repositories too.

<!-- section: theory | Quora and Stack Overflow -->
Quora is often considered an abandoned platform, but according to Ahrefs data for May 2025, its answers appeared in 4% of Google AI Overviews. This means old, detailed Quora answers still reach people asking a search engine questions. The widely cited figure of 400 million Quora users has not been updated for a long time and should not be used as the basis for a plan.

By April 2025, the number of questions and answers on Stack Overflow had fallen by around 64% year over year and by 90% compared with April 2020; these figures describe members' contributions and say nothing about website traffic. Stack Overflow rules allow authors to mention their own product if the answer solves the question and they disclose their connection to the product; an answer consisting of a link is considered advertising. A maintainer can usefully find old, popular questions about problems their project solves and add to the answers where the project fits; the flow of new questions is no longer what it used to be.

<!-- section: theory | Kubernetes Slack, CNCF Slack, and Discord -->
The Kubernetes community Slack has more than two hundred thousand members. Its rules restrict commercial promotion, prohibit unsolicited private messages, bots, and exports of member lists, and reserve specific channels for announcements. Joining Slack does not give you permission to message members with offers: a member contacted by a salesperson without permission reports it to moderators, and the account is suspended. CNCF Slack follows the foundation's code of conduct and the principle of neutrality: project channels exist for collaboration on projects, and selling in them is not allowed.

Work in these chats as you would on Reddit: maintainers answer questions in their project's technical channels and in general channels relevant to their topic, disclose their employer, and move useful answers into public documentation. A project's own community can live in Slack, Discord, GitHub Discussions, or Telegram; the course “Open source: project, community, and governance” explains how to choose a home for a community.

<!-- section: task | Task: a README through a Hacker News reader's eyes -->
Complete this task in your project's repository or that of any open-source project you know. Open the README and set a timer for thirty seconds. Record which questions from the lesson you found answers to in that time, and which you did not. Then rewrite the first screen of the README so that in thirty seconds a reader learns what the project does, who needs it, and how to get it running in a few minutes.

<!-- quiz -->
? What should the first screen of a README tell an engineer arriving from Hacker News?
+ What the project does, who needs it, and how to run it in a few minutes || An engineer decides in half a minute whether the project is worth an evening.
- The company's history and a list of investors || This does not help them decide whether to try the project.
- A link to a “request a demo” form || An engineer from Hacker News wants to run the project themselves.

? Can you message members of the Kubernetes community Slack with a product offer?
+ No, the rules prohibit unsolicited direct messages and commercial promotion outside designated channels || A member contacted by a salesperson reports it to the moderators, and the account is blocked.
- Yes, if they belong to a channel related to the product || Channel membership does not constitute consent to sales outreach.
- Yes, if the message is short || Message length does not change the rules.
<!-- /quiz -->

<!-- section: sources -->
- GitHub Docs, READMEs — https://github.com/github/docs/blob/main/content/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes.md (checked 25.11.2026)
- GitHub Docs, traffic statistics — https://docs.github.com/en/repositories/viewing-activity-and-data-for-your-repository/viewing-traffic-to-a-repository (checked 25.11.2026)
- Awesome, contribution rules — https://github.com/sindresorhus/awesome/blob/main/contributing.md (checked 25.11.2026)
- DevClass, declining Stack Overflow activity — https://www.devclass.com/ai-ml/2025/05/13/stack-overflow-seeks-rebrand-as-traffic-continues-to-plummet-which-is-bad-news-for-developers/1623624 (13.05.2025)
- Stack Overflow, promotion rules — https://stackoverflow.com/help/promotion (checked 25.11.2026)
- Kubernetes, Slack guidelines — https://www.kubernetes.dev/docs/comms/slack/ (checked 25.11.2026)
- CNCF, project neutrality — https://contribute.cncf.io/projects/best-practices/community/vendor-neutrality/ (checked 25.11.2026)
