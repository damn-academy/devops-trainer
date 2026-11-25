<!-- lesson: pr.crisis | Crisis communication: the first twenty-four hours | 22 -->
<!-- section: hook -->
At nine on Monday morning, the press team learns of two problems at once: a vulnerability has been found in a product dependency, and the researcher has already posted on X that “vendors are keeping quiet, as usual”; meanwhile, a Hacker News thread says the company has “started closing off the project” because a week earlier it moved a feature into the paid version with a single line in the release notes. The founder wants to deny everything, the CTO wants to stay silent until there is a fix, and the lawyer wants to approve every word. This lesson covers how to get through the first twenty-four hours of a crisis: whom to inform and in what order, what to say in the first statement, who speaks for the company, and how to preserve trust when making corrections. It continues the lesson on open-source project crises in the “Open source” course and looks at the same cases through the press team's eyes.

<!-- section: theory | The order of audiences -->
A crisis has several audiences, each needing its own information at the right time. The preferred order is directly affected people first, then the community and open-source users, then journalists and analysts. Customers whose systems are at risk need an email or call explaining what to do. The community gets a public statement on a channel independent of any single platform, such as the xz page on its maintainer’s site. Inside the company, support, sales and DevRel receive the same statement and a short guide to what to say and where to direct questions before answering externally.

This order works when there is time. Often there is not, so adapt it to the situation. If the problem is already public, as in the opening story, publish a brief statement first: silence can look like concealment. Customer emails follow within hours. If the scope is unknown, do not wait: say what is known, what is being checked and when you will say more; do not name a customer count before counting. Have legal check contractual notification deadlines and regulatory duties in the first hour; these take priority over press releases. If few customers are affected, call them personally.

<!-- section: theory | The first statement -->
The first statement is written quickly and with limited knowledge; that is both its danger and its purpose. In November 2023, Okta initially reported that the incident affected files belonging to 134 customers, fewer than 1 %, then acknowledged a few weeks later that a report containing support-system user data had been downloaded on a much broader scale; premature certainty about the scope cost the company trust when it corrected the record. In May 2026, Grafana structured its statement differently: it identified what was known, separated the affected environment from customers' production systems, promised another update, and kept that promise on 1 June and 23 June without rewriting earlier entries.

The first statement has five parts: what is known at this time; which versions, environments, or data are affected and which, according to current evidence, are not; what users should do immediately; the boundaries of the investigation; and when the next update will appear. The statement does not promise what you do not know, minimize the problem, or argue with the researcher. A researcher who found a vulnerability wants recognition and a fix; if you communicate openly and respectfully and thank them publicly, they become an ally.

<!-- section: theory | Who speaks -->
During a crisis, the person who made the decision or is responsible for implementing it speaks for the company. In May 2025, Redis CEO Rowan Trollope signed the explanation of the return to an open-source license and acknowledged that the earlier decision had damaged community relations. An anonymous “team” statement or a press-office reply in a technical thread looks like an attempt to hide. Technical questions should be handled by an engineer, not the CEO.

Four roles approve the first statement; appoint them before a crisis. The facts owner, usually the technical lead, ensures accuracy. The editor, usually the communications lead, handles clarity and audience order. Legal checks promises the company may not be able to keep and notification deadlines. One person publishes, and all crisis statements pass through them so an emotional founder post about a competitor or researcher does not turn one crisis into two.

Legal often wants to say less while communications wants to speak sooner. Agree in advance on a response deadline, such as one hour, an overnight and weekend substitute, and who resolves disagreements, usually the CEO. Prepare a legally preapproved holding statement: “We know about the problem, are checking whether customer data is affected, and will report results by [time].” Publish it while the detailed statement is being approved.

<!-- section: theory | Disputes about licensing and the boundary between editions -->
A crisis over a license change or the boundary between the open-source and paid editions almost always begins with a decision announced after the fact and in fine print. Explain the decision before it takes effect: what changes, what remains open, why the company decided this, what it means for users of the open-source edition and project contributors, and who made the decision. If a thread is already underway, reply personally, substantively, and without a defensive tone; acknowledge communication mistakes separately from defending the decision itself, and promise only what you will deliver.

<!-- section: theory | Journalists during a crisis -->
A journalist covering a crisis will publish with or without your comment. Readers often interpret a bare “no comment” as hiding bad news, and journalists find a press release in place of answers frustrating. If you cannot speak, for example during an investigation or coordinated vulnerability disclosure, explain why: “We are withholding details until users have updated; a full analysis will follow the fix.” Provide the facts you have, a person who answers questions and the time of the next update. You may not know when the cause will be established, but you control the next communication time: promise it, for example “next update at 18:00”, and publish then even if there is little news, saying the investigation continues. Internal correspondence can leak, so write about decisions as though the text may become public.

<!-- section: task | Task: a crisis week in the simulator -->
Complete this task in the “Crisis Week” simulator on this page. Choose a preset company or create your own, and play at least the first four turns, each advancing time by half a day. In each turn, decide whom you inform and what you say, who speaks for the company, and how you respond to a journalist. After the facilitator's review, write down one decision that worked because of its quality and one that succeeded or failed because of circumstances you could not see.

<!-- widget: rubric {"trainer":"pr.crisis-statement"} -->

<!-- widget: deptsim {"scenario":"pr.crisis"} -->

<!-- section: sources -->
- Tukaani, the xz backdoor — https://tukaani.org/xz-backdoor/
- Okta, incident root cause — https://sec.okta.com/articles/2023/11/unauthorized-access-oktas-support-case-management-system-root-cause/ (03.11.2023); recommendations — https://sec.okta.com/articles/october-security-incident-recommended-actions/ (29.11.2023)
- Grafana, security update — https://grafana.com/blog/grafana-labs-security-update-latest-on-tanstack-npm-supply-chain-ransomware-incident/ (19.05.2026)
- Redis, AGPLv3 — https://redis.io/blog/agplv3/ (01.05.2025)

<!-- lesson: pr.founder | Founder visibility | 14 -->
<!-- section: hook -->
The founder of an infrastructure company runs an X account posting about new product features and a LinkedIn account reposting press releases. Employees and investors read them. The founder of another company publishes an analysis of one company decision every month: why they chose one architecture over others, how much a cluster on their own hardware cost, or why they turned down a major customer. Journalists quote the founder, engineers come for interviews, and podcasts send invitations. This lesson explains why an infrastructure founder needs public visibility and what makes it useful.

<!-- section: theory | What is known about founder visibility -->
There are no measurements of how many customers founder visibility brings; there is experience. Y Combinator's December 2025 interview with PostHog founder James Hawkins examines the company's early pivots, its breakthrough through open source, and its brand strategy in detail, and such conversations serve as primary sources for people studying the company. The Redis CEO's signature on the licensing explanation shows another role for public visibility: accountability for decisions with lasting consequences.

Useful founder content is something the reader can verify: an architecture decision, a cost breakdown, a project governance decision, or an incident analysis. Such material lives on the company or project website as a permanent record, with linked excerpts posted on social media. A founder's follower count does not amount to trust in the product or prove adoption.

<!-- section: theory | Combining it with the job -->
Start with one long article a month and regular conversations on two platforms your buyers use. After six months, check progress toward the purpose of the founder’s writing: whether people recognise the company at meetings, candidates have read the articles or buyers mention them to sales. If the purpose is explaining decisions, cadence matters less: write when a decision is made. An editor can interview the founder and draft the text, as in the marketing course’s technical-blog process. Write about competitors through verifiable comparisons of capabilities, terms and limits, with sources and acknowledgement of where they are better. Emotional attacks, mockery and arguments in someone else’s thread almost always cost more than they bring: readers remember tone longer than arguments. During a crisis, the founder’s statements pass through the single owner described in the previous lesson.

<!-- section: task | Task: twelve topics for the year -->
Complete this exercise in a document. List twelve decisions your company made in the past two years about architecture, licensing, pricing, hiring or customers. For each, record what can be discussed publicly and which figures can be shown. Mark the first three topics and the platforms where excerpts will appear. Then prepare for the founder’s next speaking engagement: record its objective, three facts they can share, off-limits subjects and the hardest audience question with a three-sentence answer.

<!-- section: sources -->
- Y Combinator, interview with James Hawkins — https://www.youtube.com/watch?v=5WN8bfG06Hk (10.12.2025)
- Redis, AGPLv3 — https://redis.io/blog/agplv3/ (01.05.2025)
