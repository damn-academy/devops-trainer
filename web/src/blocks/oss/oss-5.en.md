<!-- lesson: oss.revenue | От открытого проекта к выручке: сигналы и их пределы | 18 -->
<!-- section: hook -->
The sales team bought a service that identifies companies from downloads of an open source project and began emailing employees at those companies. A month later, an email deliverability specialist who had received such a message at an address known only to one third-party service published an investigation into where the sales team had obtained the address, and the story spread through professional chats. This lesson covers how companies connect use of an open source project to sales, which signals they use, and where this work becomes a reputational risk.

<!-- section: theory | Как компании связывают проект с продажами -->
Scarf connects package and container downloads, documentation visits, and telemetry to organizations and says that it does not retain personal data by default. In January 2026, Liquibase described how it made project usage detected by Scarf a requirement for the higher tiers of its ideal customer profile and linked it to territory planning, target account work, and emails; the project's 100 million downloads provide background in this account, and the company does not publish campaign results. Pulumi and Common Room connected engagement and customer profile fit signals to CRM routing, sales summaries, and qualification; according to Common Room, this work supported 27 % of booked meetings in one quarter. Through Reo.dev, Unstructured connected signals from Docker, the command line, GitHub, and its website to HubSpot and reported a 20 % increase in first meetings and 40 % of its deal pipeline from identified companies; the year and sample size were not disclosed.

Identifying a company from signals does not establish which employees use the project, prove that the company has a purchasing need, or provide consent for marketing emails. Record the type of evidence and the confidence level. Network address translation, shared cloud infrastructure, build systems, caches, and repeated downloads complicate inference.

<!-- section: theory | Где начинается риск -->
In October 2025, an email deliverability specialist at Word to the Wise described receiving an email from Unstructured at a unique address given only to Strapi, then tracing the address's path through Reo using correspondence and a response to a personal data request. This is the affected person's account; it is neither a court ruling nor a verified description of Reo's entire operation, but it shows how developer identification can turn into unexpected emails and reputational damage.

A safe measurement sequence is: identified organization, repeated meaningful activity, explicit request for evaluation or contact, qualified opportunity, closed and retained revenue. Keep “source” and “influence” fields separate, record attribution windows, deduplicate companies, and compare with a control group where possible. A usage signal starts a research task; contacting a person requires the channel and basis discussed in the Dream 100 module of the sales course.

<!-- section: task | Задание: цепочка от скачивания до выручки -->
Complete the exercise in a spreadsheet. Describe which usage signals you collect or could collect for your project: downloads, telemetry, documentation visits, and GitHub activity. For each, record what it proves, what it does not prove, and which task it triggers. Then draw the sequence from the lesson for your company and mark the steps you do not currently measure.

<!-- section: sources -->
- Scarf — https://app.scarf.sh/; Liquibase and Scarf — https://about.scarf.sh/post/building-a-predictable-icp/ (05.01.2026)
- Common Room, Pulumi case study — https://www.commonroom.io/customers/pulumi-signals-meetings-booked/
- Reo.dev, Unstructured case study — https://www.reo.dev/customer-stories/unstructured
- Word to the Wise, email investigation — https://www.wordtothewise.com/2025/10/ (October 2025)

<!-- lesson: oss.crises | Кризисы открытого проекта: лицензия, уязвимость, взлом | 18 -->
<!-- section: hook -->
On a Friday evening, a researcher messages a maintainer: a backdoor has been found in a release archive downloaded by thousands of people. A few hours later, GitHub blocks the repository and the maintainers' accounts, and the usual communication channel with users disappears. This is how the xz incident began in March 2024. This lesson covers how to respond to an open source project crisis involving a vulnerability, a compromise, or a licensing dispute, and what to remember from the experiences of xz, Redis, Okta, and Grafana.

<!-- section: theory | xz: когда пропадает обычный канал -->
xz maintainer Lasse Collin published an incident page on his own website. It identifies the compromised release archives 5.6.0 and 5.6.1, distinguishes signing issues from hosting issues, records that GitHub blocked both maintainers' accounts and restored Collin's account on 2 April 2024, and later closed pull requests with misleading attribution, and links to review notes and clean releases dated 29 May 2024. A page on a website the maintainer controlled preserved a channel for facts when repository work was disrupted. This leads to the first rule: a project must have a place for announcements that does not depend on a single platform.

<!-- section: theory | Okta и Grafana: как писать об инциденте -->
In its November 2023 root cause report, Okta stated that an attacker had obtained files related to 134 customers, or less than 1 %, and several weeks later acknowledged that a report containing names and email addresses of support system users had been downloaded on a much broader scale. These are different datasets, but the initial statement sounded final and later had to be corrected. On 19 May 2026, Grafana published a security update: unauthorized GitHub access and code exfiltration had been announced on 16 May; the update distinguished the affected environment from customers' production systems, added the investigation's conclusion on 1 June, and added a post-incident review on 23 June.

These cases suggest an order for an incident statement: what is known, which versions and environments are affected, what users should do immediately, the limits of the investigation, and when the next update will appear. Append corrections to the record rather than rewriting history. Keep security instructions separate from advertising. Okta illustrates premature certainty about scope, xz the loss of usual channels, and Grafana a continuous record of dated updates.

<!-- section: theory | Кризис доверия после смены лицензии -->
In May 2025, Redis CEO Rowan Trollope acknowledged in a statement under his own name that the 2024 license change had damaged relations with the community and explained why Redis 8 was getting an AGPLv3 option. A leader's visibility in a crisis serves accountability; reach is secondary. Meanwhile, the fork continued: in its 2025 review, Valkey reported 346 active contributors during the year and ongoing releases and events. Nobody has measured how many customers Redis lost.

It is better to prevent a dispute over licensing or version boundaries than to contain it afterward: explain the decision before the announcement, name the person who made it, describe what remains open and what changes for users, and respond personally in discussion threads. A line in the release notes saying that a feature has moved to the paid version almost guarantees a Hacker News thread with a headline about the project closing.

<!-- section: task | Задание: страница инцидента -->
Complete the exercise in a document. Imagine that a remote code execution vulnerability has been found in a dependency of your project and a researcher has already written about it publicly. Write the first statement in the order given in the lesson: what is known, what is affected, what to do now, the limits of the investigation, and the time of the next update. Decide where you will publish it if the repository becomes unavailable. Then open your project's SECURITY.md and check whether it specifies a private channel for vulnerability reports and response times.

<!-- section: sources -->
- Tukaani, xz backdoor — https://tukaani.org/xz-backdoor/ (entries March–May 2024)
- Okta, root cause — https://sec.okta.com/articles/2023/11/unauthorized-access-oktas-support-case-management-system-root-cause/ (03.11.2023); recommendations — https://sec.okta.com/articles/october-security-incident-recommended-actions/ (29.11.2023)
- Grafana, security update — https://grafana.com/blog/grafana-labs-security-update-latest-on-tanstack-npm-supply-chain-ransomware-incident/ (19.05.2026, updates 01.06 and 23.06.2026)
- Redis, AGPLv3 — https://redis.io/blog/agplv3/ (01.05.2025)
- Valkey, 2025 review — https://valkey.io/blog/2025-year-end/ (22.01.2026)
