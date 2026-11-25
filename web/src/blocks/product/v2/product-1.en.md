<!-- lesson: product.roadmap | An open roadmap: making public promises without misleading people | 18 -->
<!-- section: hook -->
A company published its open-source project's roadmap on GitHub with quarterly dates. Six months later, half the items had slipped, two had vanished without explanation, and one had ended up in the paid edition. An issue titled “What happened to the roadmap?” attracted two hundred comments, and users started asking on sales calls whether the company's other promises could be trusted. This lesson is about maintaining an open roadmap that helps users plan and the company gather feedback, without turning into a list of broken promises.

<!-- section: theory | Why an open project needs a roadmap -->
Users of an open infrastructure project plan years ahead: an operator decides whether to build a cloud on the project, a bank whether to migrate, and a contributor from another company whether to invest in a feature. They need to understand where the project is going. For the CNCF, an open roadmap is a sign of neutral governance, and incubation and graduation application templates require an open release and support policy. For the founding company, an open roadmap is a way to hear from users before the work is done and show that the boundary between the open and paid editions follows a clear rule.

<!-- section: theory | How to organize the roadmap -->
It is useful to divide a roadmap into three horizons. “Now” contains work under way for the current release, with links to issues and pull requests. “Next” contains what the team plans to do in the next one or two releases, without precise dates. “Later” contains directions and problems on which the team wants feedback. Set dates only where they depend on you and you are ready to meet them; quarterly dates for everything will almost certainly become a list of delays.

Each roadmap item should include the user problem it solves, a discussion link, an owner, and an indication of which edition it belongs in: the open project or the company's paid product. It is better to decide on the edition before work begins and explain it using the rule discussed in the lesson on the open-core boundary: capabilities needed by an organization as a whole can be paid, while capabilities needed by every engineer stay open.

<!-- section: theory | When plans change -->
Plans change, and that is fine if the change is visible. When an item slips or is dropped, explain in its issue what changed, why, and what happens next; do not close it silently. If an item moves from the open edition to the paid one, announce it before release, explain the decision, and name the person who made it: the Linkerd story in 2024 shows that even a change to how builds are distributed, without a license change, creates conflict when people learn about it after the fact. Once a quarter, publish a short review: what shipped, what slipped and why, and what changed in the plans.

A roadmap gathers feedback when people can discuss it: votes on issues, community meetings that review roadmap items, and user surveys. Votes show interest, not need: a hundred votes from people who tried the project on a laptop carry less weight than three production deployments that cannot upgrade without a feature. So record who is voting alongside the votes.

<!-- section: theory | Announcing a change to the boundary between versions -->
Changing the boundary between open and paid versions is a particularly risky roadmap change. Prepare it as a separate release. First distinguish the code license, availability of ready-made builds, and the version that includes each feature. Linkerd did not change its license in 2024, but stopped producing its own stable builds; users perceived that as closing the project. Explain exactly what changes and what stays the same.

Before announcing the change, identify affected open-version users and their current usage. Specify what existing users receive: how long the feature remains open in their branch, security fixes, and a migration path. Set announcement and effective dates far enough apart for users to plan, normally at least one release. Name the decision makers and those answering questions in issues and chat. Explain where feedback is collected and what would trigger reconsideration.

Publish where open-version users will see it: release notes, the project blog, the mailing list and community meetings. Decision makers should join the discussions. A small footnote in release notes is likely to start a thread accusing the company of closing the project.

<!-- section: task | Assignment: a roadmap with three horizons -->
Do this assignment in a document or in your project's GitHub Projects. Divide your current plans into three horizons. For each item, record the user problem, discussion link, owner, and edition. Find items with dates and check whom each date depends on. Draft a quarterly roadmap review in five or six paragraphs. If your plans include moving a feature between editions, draft its announcement and check that it answers every question in the section on changing the boundary.

<!-- section: sources -->
- CNCF TOC, incubation and graduation application templates — https://github.com/cncf/toc/tree/main/.github/ISSUE_TEMPLATE
- CNCF, vendor neutrality — https://contribute.cncf.io/projects/best-practices/community/vendor-neutrality/
- Buoyant, clarification on stable Linkerd releases — https://www.buoyant.io/blog/clarifications-on-linkerd-2-15-stable-announcement (23.02.2024)
- GitHub Projects — https://docs.github.com/en/issues/planning-and-tracking-with-projects

<!-- lesson: product.signals | Community signals as a source of product discovery | 18 -->
<!-- section: hook -->
An infrastructure platform's product manager interviews customers once a quarter and hears the same things from three large accounts every time. Meanwhile, forty people describe installation failures on one type of network card in the project's issues, the community chat gets weekly questions about moving virtual machines between clusters, and sales records buyers' fears about upgrades on calls. None of these signals reaches planning. This lesson is about bringing signals from the open community and sales calls into continuous product discovery.

<!-- section: theory | Where signals come from -->
An open infrastructure product has five sources of signals about users' needs. Issues and votes on them reveal bugs and requests, but they come from people who made it to GitHub. Questions in the community chat show where people get stuck during installation and operation, and a recurring question means a gap in the product or documentation. Sales call recordings reveal what frightens and convinces buyers, in their own words. Support requests from paying customers show what breaks in production. Product data, telemetry when users have consented to it, and documentation visits show what people actually do.

Teresa Torres's continuous discovery method proposes talking to users every week and connecting conversations to an opportunity tree: the product outcome, opportunities—that is, users' needs and pain points—solutions, and experiments. In an open project, conversations already happen daily in issues, chat, and community meetings, and the product manager's job is to turn them into such a tree.

<!-- section: theory | How to collect signals -->
Once a week, the product manager sets aside an hour for signals. They read new issues and add labels for the user problem alongside the component. They note recurring chat questions and check whether the documentation answers them. They read two or three sales call records and copy buyers' phrases verbatim. They look at which installation step most often stops users. Each signal goes into one table: source, user problem, who reported it, user type (trying, running in production, paying), verbatim quote, and link.

Signals from different users carry different weight, and this needs to be visible. Forty beginners who cannot install the project tell you about the first few minutes and activation. Three production deployments that cannot upgrade tell you about retention and trust. One large customer asking for a feature “just for us” tells you about a deal, but not necessarily about the product. Priorities are decided by value and cost, allowing for uncertainty in the estimates, as discussed in the lesson on continuous discovery.

Signals should come back to the people who provided them. If a request is accepted for development, say so in the issue and add it to the roadmap; if it is rejected, explain why. A community that sees it is being heard sends more signals of higher quality.

<!-- section: theory | Saying no to a customer and sales -->
A large customer's request is neither an automatic commitment nor automatic noise: investigate it first. Suppose sales brings two requests. A bank wants integration with its audit system and promises a larger contract. A hosting provider requests the same capability in a different form. The team can deliver one large item this quarter, and half its capacity is already committed to a Kubernetes update needed to keep community installations working.

First find the underlying job: the bank needs an administrator activity log for regulators; the provider needs the same log for customers. That shared job is a signal. Then explain the opportunity cost: what would be displaced and the consequences. Offer alternatives: a common audit log next quarter; a narrow customer-funded implementation now that will become part of the product; or a refusal with a workaround through the existing API. The product manager and sales lead make the decision together. Only the person accountable for delivery dates makes the customer commitment.

Record a refusal just as you would an acceptance: in an issue or request table, with its reason, the alternative offered and the condition for reopening it, such as two more requests from that segment. Explain the decision personally, give a review date and honor it. A refusal followed by a promised review protects the relationship better than an unfulfilled commitment.

<!-- section: task | Assignment: a week of signals -->
Do this assignment in the “A week of signals” template, which you can download on this page. Over one week, collect at least twenty signals from the lesson's five sources and record each using the table's fields. Group signals by user problem and find three problems mentioned across several sources. For each, record the opportunity it adds to the discovery tree and a small experiment to test it.

<!-- widget: template {"file":"signals-week"} -->

<!-- widget: deptsim {"scenario":"product.quarter"} -->

<!-- section: sources -->
- Teresa Torres, Continuous Discovery Habits — https://www.producttalk.org/2021/05/continuous-discovery-habits/
- Rob Fitzpatrick, The Mom Test — https://momtestbook.com/
- CHAOSS, time to first response — https://www.chaoss.community/kb/metric-time-to-first-response/
- GitHub Discussions — https://docs.github.com/en/discussions
