<!-- lesson: oss.contributors | Contributors: from the first issue to maintainer | 18 -->
<!-- section: hook -->
Over a year, two hundred people submitted their first pull request to the project, and almost none returned with a second. When the maintainers examined the numbers, they found that the median time to a first response to a new contributor's pull request was nine days, and one in ten requests received no response at all. This lesson covers how to measure the contributor journey, help newcomers reach their second contribution, and understand the mentorship programs available in CNCF.

<!-- section: theory | Metrics with the right denominators -->
CHAOSS, a Linux Foundation project that defines metrics for open source project health, defines time to first response as the time between an issue, pull request, or email being submitted and the first human response; automated bot responses do not count. Report the median and ninetieth percentile separately for new and returning contributors, different types of issues, and responses from maintainers and other contributors, and include unanswered items in the report. There is no universally accepted “healthy” value for infrastructure projects.

The bus factor is the number of people who account for half of the work in a project, while the elephant factor is the number of organizations that account for half of the work. Calculate both using reviews and release permissions as well as commits: five maintainers working for one company do not give the project five independent sources of funding.

Different reports give different contributor counts for the same project because they count different things. Cilium's 2024 project journey report lists 4464 contributors, while the 2025 annual report notes a thousand contributors to the main repository; the first number counts activity across all repositories, and the second counts code authors in one. Before including a contributor count in sales materials, check which repositories, actions, and period it covers, whether bots are excluded, and how company affiliation is determined.

<!-- section: theory | The contributor funnel -->
The contributor journey runs as follows: first issue or question, first accepted contribution, second contribution within 90 days, regular contributions, review permissions, maintainer role. Measure each step separately. CNCF compiled answers to frequently asked questions for new contributors based on the experience of more than 850 community members and 2200 messages from November 2023 through the end of 2025; this is practical guidance, not an experiment testing whether `good first issue` labels work. A good first task is reproducible, has a named helper, and has explicit conditions for accepting the change.

<!-- section: theory | Mentorship -->
CNCF tracks successfully completed internships; applications are not counted. In 2025, 176 LFX Mentorship internships and 11 Google Summer of Code internships were successfully completed, for a total of 187; in 2024, the figures were 134 LFX internships, 11 GSoC, and 2 Outreachy, for a total of 147. CNCF's 2025 annual report states that 25 former LFX mentees have become project maintainers since 2020. In the third LFX term of 2025, mentees worked on 27 CNCF projects at different maturity levels, including Sandbox, so the program is also available to young projects. A mentee becoming a maintainer is the best outcome of mentorship, so count not only mentees but also which of them remain in the project a year later.

<!-- section: task | Exercise: metrics for your project -->
Complete the exercise in the “Project Health” simulator on this page or in LFX Insights for your own project. Calculate the median and ninetieth percentile of time to first response to new contributors' pull requests over the past six months, the share of unanswered requests, and the bus factor and elephant factor based on reviews. Find the step in the contributor funnel where the most people are lost, and write down two changes you will make this month to improve it.

<!-- section: sources -->
- CHAOSS, time to first response — https://www.chaoss.community/kb/metric-time-to-first-response/
- CHAOSS, viability metrics — https://www.chaoss.community/viability-metrics-what-its-made-of/ (2023)
- CNCF, Cilium project journey — https://www.cncf.io/reports/cilium-project-journey-report/ (11.11.2024)
- LFX Insights — https://insights.lfx.linuxfoundation.org/
- CNCF, new contributor questions — https://contribute.cncf.io/contributors/faq/
- CNCF, mentorship statistics — https://github.com/cncf/mentoring/blob/main/README.md
- CNCF, 2025 annual report — https://www.cncf.io/wp-content/uploads/2026/03/cncf_ar25_033126a.pdf (24.02.2026)
- CNCF, LFX Mentorship 2025 term three results — https://www.cncf.io/blog/2026/02/04/cncf-celebrates-successful-mentees-from-lfx-mentorship-2025-term-3/ (04.02.2026)

<!-- lesson: oss.community | Community: where it gathers, meetups, users, and ambassadors | 18 -->
<!-- section: hook -->
For three years, the project's community answered questions in a free Slack workspace. Then one day a maintainer discovered that answers older than a year had disappeared: since August 2024, free Slack workspaces have been deleting old messages. Thousands of resolved installation questions were lost with no way to recover them. This lesson covers where to host a community, how to run meetings, how to collect user stories, and how to organize an ambassador program.

<!-- section: theory | Slack, Discord, GitHub Discussions -->
Free Slack shows only the last 90 days of conversations, and since 26 August 2024 it has deleted messages and files older than a year. Deleted content cannot be recovered even after upgrading to a paid plan. Paid plans and workspaces provided by CNCF may work differently. Questions resolved in chat should therefore be moved into documentation or GitHub Discussions before they disappear.

In October 2026, Discord announced that it would publish web pages for public servers from 16 November 2026 and start showing their messages in search from mid-December 2026; this applies only to servers that enable discovery. Old messages, private servers, and direct messages will not appear in search, and administrators control the channels. The claim that “Discord is not indexed” has become too broad: tell participants which settings your server uses, and keep the main technical documentation outside chat.

GitHub Discussions lives alongside the code: categories, answers that can be marked as solutions, announcements, polls, pinning, and conversion of issues into discussions and back. Public architecture proposals and answered installation questions remain accessible there and can be found through search without a separate account.

<!-- section: theory | Meetups, releases, and users -->
An open community meeting with a recording, agenda, and notes allows people who could not attend to participate. Attendance numbers say little; it is more useful to track who returns, which decisions are implemented, and which contributions follow the meeting.

A release email serves as evidence when it includes supported upgrade paths, breaking changes, artifacts, a working example, and the problem the release solves. Frequent releases without a version support policy create extra work for operators.

An ADOPTERS file should distinguish people trying the project from those using it in production, and permission to name an organization from permission to describe its architecture. Keep a contact for verification by the foundation and separate consent for a public story: a logo alone says nothing about the scale or value of adoption. In Cilium's 2025 annual report, 18 organizations described their production deployments. The DB Schenker story describes Cilium on more than 460 Kubernetes nodes, with 700 business applications and more than 7 million HTTP requests per hour, while the Michelin story describes a live migration of roughly 70–80 clusters over about two months in spring 2025. A regular user interview process achieves more than asking maintainers to “write more posts.”

<!-- section: theory | Community manager, DevRel, and ambassadors -->
Community work can usefully be divided into two roles. A community manager is responsible for moderation, meetings, onboarding new contributors, recognizing their work, and ensuring that questions get answered. DevRel is responsible for technical educational materials, integration feedback, and obstacles to adoption. One person can fill both roles, but community safety cannot be measured by the number of sales meetings.

According to the company at its 2025 conference, Grafana's Champions program nearly tripled in size. This is growth in participation; to make the program useful, connect it to actual talks, educational materials, mentorship, and local meetups, and measure those activities. CNCF ambassadors may publish up to two articles a month on the foundation's blog under its editorial rules; this is an individual's path, and a company cannot use it to bypass its own article quota.

<!-- section: task | Exercise: move knowledge out of chat -->
Complete the exercise in your project's community. Find ten questions from the past quarter that received detailed answers in chat, and move them to GitHub Discussions or the documentation with the solutions identified. Check the ADOPTERS file: does it distinguish people trying the project from those using it in production, and do you have a verification contact for each? Write down who is responsible for the community manager and DevRel roles in the project.

<!-- section: sources -->
- Slack, history retention in free workspaces — https://slack.com/help/articles/29414264463635-Updates-to-message-and-file-history-on-free-workspaces (from 26.08.2024)
- Discord, public server content in search — https://discord.com/blog/ (announcement October 2026)
- GitHub Discussions — https://docs.github.com/en/discussions/collaborating-with-your-community-using-discussions/about-discussions
- OpenTofu 1.10 — https://opentofu.org/blog/opentofu-1-10-0/ (23.06.2025)
- Cilium, 2025 annual report — https://www.cncf.io/wp-content/uploads/2025/12/cilium-annual-report-2025-final.pdf
- CNCF, DB Schenker — https://www.cncf.io/case-studies/db-schenker/ (07.03.2025); Michelin — https://www.cncf.io/case-studies/michelin-2/
- GrafanaCON 2025, opening keynote — https://grafana.com/events/grafanacon/2025/keynote-grafana-12/
- CNCF, blog guidelines — https://github.com/cncf/foundation/blob/main/policies-guidance/blog-guidelines.md
