<!-- lesson: pr.crisis | Crisis communication: the first twenty-four hours | 22 -->
<!-- section: hook -->
At nine on Monday morning, the press team learns of two problems at once: a vulnerability has been found in a product dependency, and the researcher has already posted on X that “vendors are keeping quiet, as usual”; meanwhile, a Hacker News thread says the company has “started closing off the project” because a week earlier it moved a feature into the paid version with a single line in the release notes. The founder wants to deny everything, the CTO wants to stay silent until there is a fix, and the lawyer wants to approve every word. This lesson covers how to get through the first twenty-four hours of a crisis: whom to inform and in what order, what to say in the first statement, who speaks for the company, and how to preserve trust when making corrections. It continues the lesson on open-source project crises in the “Open source” course and looks at the same cases through the press team's eyes.

<!-- section: theory | The order of audiences -->
A crisis has several audiences, each needing its own information at the right time. Those directly affected should hear first: customers whose systems are at risk should receive an email or call explaining what to do before they read about it in the press. Next come the community and users of the open-source version: a public statement in a channel that does not depend on a single platform, such as the xz page on its maintainer's website. Then come journalists already working on the story and analysts whose clients are asking questions. Inside the company, everyone answering external questions—support, sales, and DevRel—must receive the same statement and a short guide to what to say and where to direct questions before they start responding.

<!-- section: theory | The first statement -->
The first statement is written quickly and with limited knowledge; that is both its danger and its purpose. In November 2023, Okta initially reported that the incident affected files belonging to 134 customers, fewer than 1 %, then acknowledged a few weeks later that a report containing support-system user data had been downloaded on a much broader scale; premature certainty about the scope cost the company trust when it corrected the record. In May 2026, Grafana structured its statement differently: it identified what was known, separated the affected environment from customers' production systems, promised another update, and kept that promise on 1 June and 23 June without rewriting earlier entries.

The first statement has five parts: what is known at this time; which versions, environments, or data are affected and which, according to current evidence, are not; what users should do immediately; the boundaries of the investigation; and when the next update will appear. The statement does not promise what you do not know, minimize the problem, or argue with the researcher. A researcher who found a vulnerability wants recognition and a fix; if you communicate openly and respectfully and thank them publicly, they become an ally.

<!-- section: theory | Who speaks -->
During a crisis, the person who made the decision or is responsible for implementing it speaks for the company. In May 2025, Redis CEO Rowan Trollope signed the explanation of the return to an open-source license with his own name and acknowledged that the earlier decision had damaged community relations. An anonymous statement from “the team” or a press-team reply in a technical thread reads as an attempt to hide. Technical questions in the thread, however, should be handled by an engineer; they do not need the CEO. A founder posting emotionally on X about a competitor or researcher turns one crisis into two, so agree in advance that every public statement during a crisis goes through one person.

<!-- section: theory | Disputes about licensing and the boundary between editions -->
A crisis over a license change or the boundary between the open-source and paid editions almost always begins with a decision announced after the fact and in fine print. Explain the decision before it takes effect: what changes, what remains open, why the company decided this, what it means for users of the open-source edition and project contributors, and who made the decision. If a thread is already underway, reply personally, substantively, and without a defensive tone; acknowledge communication mistakes separately from defending the decision itself, and promise only what you will deliver.

<!-- section: theory | Journalists during a crisis -->
A journalist covering a crisis will publish with or without your comment. “No comment” reads as an admission, and a press release instead of answers to questions is frustrating. Give the journalist the facts you have, someone who answers questions, and the time of the next update. If you do not know an answer, say when you will know. Internal correspondence can leak, so write about decisions inside the company as though the text could become public.

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
One long article a month and regular participation in conversations on two platforms where buyers spend time are enough for a founder. An editor can interview the founder and prepare a draft, as in the technical-blog workflow in the marketing course. A founder's posts about competitors and arguments on social media almost always cost more than they deliver, and during a crisis their statements go through one responsible person, as discussed in the previous lesson.

<!-- section: task | Task: twelve topics for the year -->
Complete this task in a document. List twelve decisions your company made in the last two years: about architecture, licensing, pricing, hiring, and customers. For each, record what can be discussed publicly and which figures can be shown. Mark three topics the founder will start with and the platforms where excerpts will appear.

<!-- section: sources -->
- Y Combinator, interview with James Hawkins — https://www.youtube.com/watch?v=5WN8bfG06Hk (10.12.2025)
- Redis, AGPLv3 — https://redis.io/blog/agplv3/ (01.05.2025)
