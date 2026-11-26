<!-- lesson: oss.foundations | A project's legal home: whether it needs a foundation and which one | 28 -->
<!-- section: hook -->
The board of a company developing an open-source database decided at one meeting to “donate the project to a foundation” because competitors in a neighboring category had done so. Six months later, it emerged that the chosen foundation focused on cloud platforms and hosted only a few database projects, the company was not ready to give up the trademark under which it sold its commercial version, and the only maintainer outside the company had moved to another firm. The donation stalled because of the company, not the foundation: it had not separated four different decisions or compared options, including leaving things as they were. This lesson teaches you to make that comparison before talking to any foundation.

<!-- section: theory | Four different decisions -->
When a company says “donate the project to a foundation,” it mixes four decisions:

- Code license: what rights users and competitors receive.
- Project governance: who accepts changes, appoints maintainers, and ships releases.
- Legal home: who holds funds, domains, and trademarks and signs contracts.
- Corporate membership: what services the company buys with an annual fee.

Donating a project does not mean transferring the company or all its commercial products. A company's foundation membership does not mean its project has been accepted and does not grant technical control. Supporting someone else's project, donating your own, and creating a new foundation are three different routes. The TODO Group guide to starting an open-source project separates these decisions in the same way.

<!-- section: theory | Options in increasing order of complexity -->
| Option | When it is sufficient | What you must provide |
|---|---|---|
| Use and contribute to an existing project | You need a reliable component, not your own standard | Engineering time, maintainer relationships, license compliance |
| Support an existing foundation or project | You need a critical dependency to be sustainable and a role in the ecosystem | A fee or donation plus real work: sponsorship does not replace contribution |
| Run a company open-source project | You need open code with centralized governance | Public rules, a clear license, an explicit account of what the company decides |
| Fiscal sponsorship | You need a legal home for funds and contracts without a large industry association | A mission, governance rules, funding, administrative fees |
| Donate the project to a suitable foundation | You need neutrality, shared governance, and adoption across companies | Scope of rights and trademark transfer, maintainer diversity, budget, open roadmap |
| Create a new foundation or consortium | Existing homes do not fit, and several sustainable participants exist | A separate organization, legal and operating costs, independent rules and funding |

Fiscal sponsorship is an arrangement in which a nonprofit legally holds a project's funds and assets and handles accounting and contracts while technical governance remains with the project. Software Freedom Conservancy, NumFOCUS, and, in some cases, Python Software Foundation work this way.

<!-- section: theory | Types of foundations -->
Different foundations have different admission routes and trademark rules:

- Apache Software Foundation accepts projects through its incubator: a proposal, mentors, a podling, code rights checks, public releases, and graduation by board decision. A company cannot buy committer or project committee seats, and the project trademark transfers to the foundation; if the company keeps the old name, the project needs a new one.
- Linux Foundation provides a shared legal and operational home for collaborative initiatives. Each hosted project has its own charter, and there is no single maturity ladder for all foundation projects. It includes industry foundations with their own rules: CNCF for cloud projects, including observability, storage, networking, and security; OpenSSF for open-source and supply-chain security; LF AI & Data for data and machine learning; PyTorch Foundation, which has united PyTorch, vLLM, DeepSpeed, and Ray since 2025; Agentic AI Foundation for agent infrastructure; and OpenInfra Foundation, which joined Linux Foundation along with OpenStack on 3 June 2025.
- Eclipse Foundation is a European organization with projects ranging from enterprise Java and Jakarta EE to developer tools, the Internet of Things, and automotive systems. Projects move from proposal through creation review and incubation to maturity with code rights checks, and the trademark transfers to the foundation before project creation.
- NumFOCUS works with scientific and data projects and offers two routes: affiliation, where the project remains legally independent, and full fiscal sponsorship with rigorous review. As of late November 2026, NumFOCUS says it is temporarily not accepting new applications while updating its financial and administrative systems, with no reopening date announced; meanwhile, a scientific project can choose another fiscal sponsor, such as Software Freedom Conservancy, or remain independent.
- Software Freedom Conservancy accepts free software projects with a public-benefit mission and typically takes about 10 % of project income for accounting, contracts, and asset management.
- PostgreSQL has no single foundation that owns the project: development takes place in the community, while the nonprofit PGCA holds trademarks and domains. A vendor earns money from services, products, and reputation; a contribution cannot buy PostgreSQL.
- Rust Foundation supports the language ecosystem and, through Rust Innovation Lab, takes fully funded infrastructure initiatives under its care.

Start the choice with the object of collaboration. For a data engine, compare ASF, LF AI & Data, and an independent community model; for telemetry, CNCF or the home of its main users; for an AI runtime, PyTorch Foundation or Agentic AI Foundation; for a scientific library, NumFOCUS; for Java and edge devices, Eclipse. The shortlist does not automatically assign projects by keyword: check project maturity, license compatibility, a second company willing to support maintainers, brand constraints, and admission timelines.

<!-- section: theory | A route outside CNCF: the Apache Software Foundation example -->
The following lessons examine CNCF's procedure as the most extensively documented, but the path to another foundation involves the same questions. Here is the Apache Software Foundation route for a company developing an open-source data engine.

1. Read the ASF incubator guides on project proposals and graduation so you know the exit requirements in advance.
2. Find a champion, an ASF member who will support the project, and two or three mentors. Look through the incubator mailing list and people already working on related Apache projects.
3. Write a proposal using the incubator template: what the project does, why it needs ASF, its current state, known risks including dependence on one company, and the initial committers and their employers.
4. Pass the incubator committee vote. Afterwards, the company signs a Software Grant: a non-exclusive copyright and patent license to the foundation, while the company retains copyright ownership. Contributors sign individual contribution agreements granting the same kind of non-exclusive license. The trademark is a separate matter: the project name is checked and transferred to the foundation or changed.
5. Work in the incubator: release versions through votes following the Apache process, write quarterly reports and expand the committer group beyond the company.
6. Graduate when the community is independent of a single employer and releases follow foundation rules.

Stopping without a transfer is reasonable if there is no second company willing to support maintainers and none is likely within a year, if the company is unwilling to give up the project name, or if the product needs a fast release pace under company control. Part of the evidence table the next lesson builds for CNCF is useful here too: both ASF and Linux Foundation’s industry foundations check independent maintainers, written rules and releases following those rules. Only CNCF requests user interviews and a security report in this form; for other routes, fill in these rows only if the chosen procedure requires them.

<!-- section: theory | What was donated in 2024–2026 -->
- On 22 October 2026, Agentic AI Foundation accepted Agent Skills from Anthropic, Open Responses from OpenAI, OpenEnv from Hugging Face, and OpenSandbox from Alibaba, bringing its project count to ten. A format, isolation environment, or integration contract can be donated separately; the whole commercial agent need not be transferred.
- In July 2026, Okahu's generative model tracing project Monocle moved from Sandbox to Incubation in LF AI & Data. It addresses observability but chose the foundation where its developers and dependencies reside.
- Agentic AI Foundation was created on 9 December 2025: Anthropic donated MCP, Block donated goose, OpenAI donated AGENTS.md, and Obot.ai also donated the MCP Dev Summit conference and podcast. Community events can be donated too.
- On 23 April 2025, OpenTofu, created under Linux Foundation in 2023, was accepted into CNCF Sandbox. A new maturity-level affiliation is not the same as the first donation of a project.
- In September 2024, OpenSearch Software Foundation was established under Linux Foundation so that the project would no longer be seen as belonging to AWS alone.
- In March 2024, after Redis changed its licenses, Valkey emerged under Linux Foundation. No trademark was transferred: Redis Ltd. retained the Redis name, so the project needed a new name. The same happened with OpenTofu and Terraform.

<!-- quiz -->
? A company joined a foundation at Silver level. What does this tell you about its open-source project?
- The project was accepted into the foundation and received its first maturity level along with membership || Membership and project admission are separate decisions.
+ Nothing: company membership and project admission are decided separately || A membership fee cannot buy project admission.
- The project received the right to use the foundation logo in the company's product marketing || Membership does not change the project's status.
? A company needs a legal home for project funds and contracts but does not need an industry association with large fees. Which option fits?
+ Fiscal sponsorship by a nonprofit that holds the project's funds and contracts || Technical governance remains with the project.
- Create its own foundation because that is the only way to separate project funds from company funds || This is the most expensive route.
- Join Linux Foundation at Silver level || Membership does not make the foundation the project's home.
? Why did the Redis fork need the new name Valkey?
- Because Linux Foundation requires a new name for every accepted project || No such general rule exists.
- Because another open-source project had taken the Redis name in the package registry || The issue is the trademark.
+ Redis Ltd. retained the Redis trademark, and the code license does not grant rights to the name || A free code license does not grant trademark rights.
<!-- /quiz -->

<!-- section: task | Exercise: compare options for your project -->
Complete the exercise in the document on this page. Record four decisions separately for your project: license, governance, legal home, and membership. State the business reason for considering a foundation: reducing fear of dependence on one vendor, gaining competitors' adoption of a shared protocol, sharing maintenance costs, or legally hosting a community project. Then compare three options from the lesson's table, including one without project donation, and record what you would need to provide for each.

<!-- section: sources -->
- TODO Group, starting an open-source project — https://todogroup.org/resources/guides/starting-an-open-source-project/ (checked 25.11.2026)
- Apache Software Foundation, project proposals — https://incubator.apache.org/guides/proposal.html; graduation from the incubator — https://incubator.apache.org/guides/graduation.html; trademarks — https://www.apache.org/foundation/marks/naming.html
- Linux Foundation, project hosting — https://www.linuxfoundation.org/projects/hosting
- CNCF, project lifecycle — https://github.com/cncf/toc/blob/main/process/README.md
- OpenSSF, technical initiative lifecycle — https://openssf.org/about/tac/technical-initiative-funding/
- LF AI & Data, Monocle project — https://lfaidata.foundation/projects/monocle/
- PyTorch Foundation, new members — https://www.linuxfoundation.org/press/pytorch-foundation-announces-new-members-as-agentic-ai-demand-grows (24.02.2026)
- Linux Foundation, creation of Agentic AI Foundation — https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation (09.12.2025)
- Linux Foundation, new Agentic AI Foundation projects — https://www.linuxfoundation.org/press/agentic-ai-foundation-announces-four-new-projects-agent-skills-open-responses-openenv-and-opensandbox (22.10.2026)
- OpenInfra joins Linux Foundation — https://openinfra.org/blog/openinfra-joins-linux-foundation/ (03.06.2025)
- Eclipse Foundation, project handbook — https://www.eclipse.org/projects/handbook/
- NumFOCUS, project models — https://numfocus.org/projects-overview
- Software Freedom Conservancy, application — https://sfconservancy.org/projects/apply/; agreement — https://handbook.sfconservancy.org/fiscal-sponsorship-agreement.html
- PostgreSQL, financial sponsors — https://www.postgresql.org/about/financial/
- Rust Foundation, Rust Innovation Lab — https://rustfoundation.org/rust-innovation-lab/
- CNCF, OpenTofu project page — https://www.cncf.io/projects/opentofu/
- Valkey, project history — https://valkey.io/about/

<!-- lesson: oss.donation | What changes after project donation: rights, money, and three-year cost | 26 -->
<!-- section: hook -->
Company leadership approved donating a project to a foundation after reading a presentation promising “marketing, users, and neutrality.” A year later, marketing amounted to two posts on the foundation's blog, all maintainers still worked for the company, and lawyers discovered that the project domain was still registered to an employee. Meanwhile, the company continued paying for maintainers, releases, and security as before. None of these surprises had been hidden: everything was in the charter and agreement, which nobody had compared with expectations. This lesson provides three tools for that comparison: a before-and-after rights table, a three-year cost calculation, and metrics showing whether the donation succeeded.

<!-- section: theory | A before-and-after rights table -->
Create the rights table before deciding. Its rows are:

- name, logo, and domain;
- copyright and licensing;
- patents;
- repositories and administrator rights;
- release signing keys;
- vulnerability response;
- roadmap;
- right to accept changes;
- fundraising;
- commercial packaging.

For each row, record two states, before and after the transfer, and three distinct powers in each: who owns it, who administers it, and who makes decisions. In the example below, the company held all three powers before the transfer, so only the owner is shown for the “before” state; in your own table, fill in all six cells and mark unknowns as “find out” with the name of the person responsible. These may be different parties: the foundation may own the domain, maintainers may administer it, and the project committee may decide to change it. Two completed rows might look like this:

| Item | Owner before | Owner after | Administrator after | Decision-maker after | Governing document |
|---|---|---|---|---|---|
| Name and logo | Company | Foundation | Foundation | Foundation under its trademark policy | Trademark transfer agreement |
| Release signing keys | Company | Foundation if keys are created under its accounts; otherwise mark “not applicable” and keys remain personal to maintainers | Held by two maintainers from different organizations | Project committee | Release rules in the project repository |

If any row has no answer, the project is not ready for a decision.

Checklist for the company team:

- Brand. Determine what is transferred: project name, logo, domain. Separate the commercial product name from the project name in advance. A free code license does not grant trademark rights.
- Code and rights. Inventory your own and third-party contributions, licenses, patents, contributor agreements (CLA or DCO), and record which rights the foundation needs and which remain with authors.
- Governance. Publish rules, the path from contributor to maintainer, election and appointment procedures, conflict-of-interest rules, and release authority. Competitor participation must be possible in practice.
- Operations. Budget for maintainers, issue triage, vulnerability response, release signing, documentation, and compatibility testing. The foundation does not replace a product team.
- Commercial model. Support, a managed service, enterprise features, and integrations must have value of their own because the company no longer exclusively owns the donated project.
- Marketing. Say “the project was accepted,” “the company is a foundation member,” and “the product is certified” only when true. These three statuses are not interchangeable.

<!-- section: theory | What membership costs -->
Public fee schedules as of late 2026, in dollars per year unless stated otherwise:

| Organization | Fees | What not to promise leadership |
|---|---|---|
| CNCF | Silver from 2 to 50 thousand, or 7 to 70 thousand including Linux Foundation, based on the entire corporate group's headcount; Gold — 100 thousand plus Linux Foundation dues, Platinum — 350 thousand plus Linux Foundation dues with a three-year commitment | A Platinum board seat does not grant sole technical control; a KubeCon booth is paid separately |
| Linux Foundation | Silver from 5 to 20 thousand by headcount, Gold — 100 thousand, Platinum — 500 thousand | Silver does not include industry foundation fees |
| OpenSSF | From 1 January 2026, Premier — 250 thousand, General from 5 to 50 thousand, both plus Linux Foundation dues | Membership is not a product security audit |
| LF AI & Data | Premier — 150 thousand, General from 10 to 40 thousand, both plus Linux Foundation dues | Case studies and events, not sales |
| Agentic AI Foundation | Gold — 200 thousand, Silver from 5 to 75 thousand, both tiers plus Linux Foundation dues; Platinum seats are unavailable on the page | Membership does not imply buyer adoption of a protocol |
| Apache Software Foundation | Sponsorship rather than membership: from 6 to 125 thousand | Sponsors do not buy change acceptance, releases, or product endorsement |
| Eclipse Foundation | In euros: from 1 500 for companies with revenue below one million euros and fewer than ten employees to 25 thousand by revenue, strategic membership from 30 to 300 thousand | Working group fees, such as Jakarta EE, are paid separately |
| PostgreSQL (PGCA) | Since February 2026, from donations below 2 500 dollars to 40 thousand | These are donations; PostgreSQL has no participation fee |
| Software Freedom Conservancy | Usually 10 % of project income | The percentage applies to project income, excluding the vendor company's revenue |

When a company joins several Linux Foundation industry foundations, it pays the Linux Foundation fee once: a 40-person company joining CNCF and OpenSSF at entry levels pays $5,000 to each plus $5,000 to Linux Foundation, totaling $15,000 per year. Fees cover membership only. Engineers, documentation, vulnerability response, and community support cost extra, and the three-year cost must include everything:

`Three-year cost = foundation fees + project funding + maintainer time + security, releases, and documentation + legal work and foundation admission + community work + selected events`.

Worked example. Under the current schedule, a company of 40 employees pays 5 thousand to CNCF and 5 thousand to Linux Foundation, totaling 10 thousand per year for Silver. This is the minimum membership fee, not an open-source project budget: if the project has two full-time maintainers, their time costs tens of times more. For the same company, OpenSSF membership including Linux Foundation also costs 10 thousand per year, but the foundations' goals and communities differ, and an identical price does not make the routes interchangeable.

A full three-year calculation looks like this. The assumptions are illustrative: two maintainers each spend half their time on the project at a fully loaded employee cost of $180,000 per year; a quarter of an engineering role at the same fully loaded annual cost of $180,000 goes to security, releases and documentation; legal work and foundation admission cost $20,000 once in the first year; community work costs $15,000 annually, events $25,000 and dues $10,000. “Project funding” here means money the company gives the project itself for infrastructure, audits and contributor travel; maintainer salaries are excluded from that line to avoid double-counting.

| Item | Year 1 | Year 2 | Year 3 |
|---|---:|---:|---:|
| Dues | 10 | 10 | 10 |
| Project funding: infrastructure, audits, travel | 0 | 0 | 0 |
| Maintainer time, 2 × 0.5 full-time roles | 180 | 180 | 180 |
| Security, releases, documentation, 0.25 full-time role | 45 | 45 | 45 |
| Legal work and foundation admission | 20 | 0 | 0 |
| Community work | 15 | 15 | 15 |
| Events | 25 | 25 | 25 |
| Total, thousands of dollars | 295 | 275 | 275 |

The three-year total is $845,000, of which dues account for $30,000, less than 4%. If some maintainers eventually work for other companies, the company's share of the maintainer-time line shrinks, provided it does not hire replacements. That is the economic rationale for donation from the company's perspective; the project's total cost does not decrease but is shared among several participants.

<!-- section: theory | How to tell whether donation succeeded -->
The CHAOSS community offers project sustainability metrics. The contributor absence factor shows how many people account for half the project's activity, and the elephant factor shows how many organizations do. If employees of one company do half the work over the chosen period, such as half the accepted changes in a year, the elephant factor is one. This signals risk: the project may stop if that company leaves, even if governance rules are neutral; how likely that is depends on whether people can be replaced, how access is distributed, and whether the project can release without the company. Check governance neutrality separately through the rules and who actually makes decisions. Add the number of maintainers outside the company, review time, the project's ability to release without its founding company, vulnerability response speed, and confirmed production users.

The company's strategy succeeds through lower adoption barriers and a sustainable project; foundation success does not necessarily mean growth in the company's sales pipeline. Record this in the memo in advance so that leadership does not judge the donation by lead count a year later.

<!-- quiz -->
? A company with 40 employees joined CNCF at Silver level for 10 thousand per year. How much of the open-source project budget does this cover?
- The whole budget, because the foundation takes over project releases, security, and documentation || The foundation does not do this work for the project.
+ Membership only; maintainers, security, and documentation are paid separately || The fee is a small part of the cost.
- Half, because the foundation pays the other half from large members' fees || The foundation does not fund the project proportionally.
? After donation, employees of one company still make half the project's contributions. What is the elephant factor?
+ One: one organization accounts for half the activity || The project depends on one organization even if its rules are neutral.
- Zero, because after donation the project belongs to the foundation rather than the company || The factor is calculated from contributions.
- Two, because it counts the company and foundation that jointly oversee the project || The foundation is not included in the contribution count.
? What can a company write in marketing materials if it has joined a foundation but its project is still under review?
- “Our project has been accepted into the foundation” because the company is already a member || The project has not yet been accepted.
- “Our product is certified by the foundation” because membership confirms quality || Membership is not certification.
+ “The company is a foundation member,” with nothing about project status until a decision || The three statuses are not interchangeable.
<!-- /quiz -->

<!-- section: task | Exercise: a project donation memo -->
Complete the exercise in the document on this page. Write a memo for leadership: the business reason, three alternatives including no donation, a before-and-after rights table for the chosen option, and the three-year cost using the lesson's formula. Record the metrics you will use to judge success in a year, including current values for the elephant factor and the number of maintainers outside the company. Mark rights table rows you cannot yet answer.

<!-- section: sources -->
- CHAOSS, assessing viability — https://www.chaoss.community/practitioner-guide-viability/
- CHAOSS, organizational diversity — https://chaoss.community/kb/metric-organizational-diversity/
- CNCF, joining and fee schedule — https://www.cncf.io/about/join/ (checked 25.11.2026)
- Linux Foundation, fee table in the agreement — https://cdn.platform.linuxfoundation.org/agreements/netdev-foundation.pdf (07.01.2025)
- OpenSSF, joining — https://openssf.org/join/
- LF AI & Data, joining — https://lfaidata.foundation/join/
- Agentic AI Foundation, members — https://aaif.io/members
- Apache Software Foundation, sponsorship — https://svn-master.apache.org/repos/infra/websites/production/www/content/foundation/sponsorship.html
- Eclipse Foundation, membership — https://www.eclipse.org/membership/
- PostgreSQL, PGCA tier update — https://www.postgresql.org/about/news/updates-to-pgca-non-profit-sponsorship-levels-website-3254/ (11.03.2026)
- Software Freedom Conservancy, fiscal sponsorship agreement — https://handbook.sfconservancy.org/fiscal-sponsorship-agreement.html

<!-- lesson: oss.cncf-path | Project maturity levels through CNCF: Sandbox, Incubating, Graduated | 20 -->
<!-- section: hook -->
A company submitted its project for Incubating status, attaching twelve thousand GitHub stars, a list of customer logos, and a marketing presentation. Several months later, the foundation committee returned the application with questions: who besides the founding company could ship a new release, how the project removed maintainers, which users were willing to discuss adoption, and where the security report was. Stars were not mentioned in these questions. Most foundations have a similar ladder: ASF takes projects through its incubator to top-level status, Eclipse from incubation to maturity, and LF AI & Data and OpenSSF through Sandbox, Incubation, and Graduation levels. This lesson examines the most detailed published procedure, CNCF's: what the foundation checks as a project moves between levels and how to gather evidence in advance. In the exercise, you can also fill in the table using another foundation’s procedure; the exercise explains what changes.

<!-- section: theory | Who decides and what is reviewed -->
The CNCF charter assigns decisions on project admission and maturity levels to the Technical Oversight Committee, or TOC, and marketing and the budget to the Governing Board. Company membership in the foundation and project maturity level are different things: advancement to the next level cannot be bought. The old graduation criteria document now points to the incubation and graduation application templates, which are at version 1.6 as of the end of 2026; a course citing only the old criteria list misses new requirements.

The Incubating application template requires a General Technical Review, a governance review, vendor-neutral resources, a documented maintainer lifecycle used in practice, open communication channels, a contributor guide, and current maintainer company affiliations with a rule to update them when someone changes jobs. Before a review is scheduled, the template asks for five to seven user interviews; these are interviews for the reviewers, and the template does not require seven public logos.

The Graduated application template requires maintainers from at least two organizations who demonstrate that the project can survive the departure of one of them, a mechanism for balancing organizations in decisions, a role ladder used in practice, a public release and support policy, and at least three independent users with suitable use cases; the same five to seven interviews are requested separately. A security self-assessment, a third-party audit, and an OpenSSF Best Practices badge at the passing level are required; silver and gold levels are recommended. Identified medium- and low-severity issues must be tracked until resolved. A completed review is not yet a TOC decision.

<!-- section: theory | The evidence package -->
Prepare an evidence package well before applying: installation, upgrades and rollback, architecture, operational limits, release and support policy, named people responsible for security, user feedback, maintainer affiliations, and examples of actual decisions made under the governance rules. A large star count does not replace this evidence. A useful example is the announcement by a project that completed its General Technical Review on the path to incubation in September 2026 and published measured platform overhead and workload tests on three servers, while also identifying unfinished security and documentation work.

<!-- section: theory | TAG groups -->
In May 2025, the TOC restructured its technical groups. There are now five: Developer Experience, Infrastructure, Operational Resilience, Security and Compliance, and Workloads Foundation, while Contributor Strategy and Advocacy, Mentoring, and Project Reviews became TOC subprojects. The old group Slack channels were archived on 24 June 2025, with some exceptions. A cloud platform project should take infrastructure and virtualization, security, and governance questions to the relevant new groups; a mailing list directory from before 2025 is outdated. Working with a group provides architectural feedback and context for a review, but this is community work and does not offer approval for payment; the TOC's project guideposts remain advice, not maturity-level requirements.

<!-- section: task | Exercise: a readiness spreadsheet for the next level -->
Complete the exercise in a spreadsheet. In the first column, start with the route chosen in the foundations lesson and the deciding body, because all other rows depend on the route:

- CNCF: the application template requirements for the next level; the TOC decides. Separately list five to seven users for interviews and the operational problem each solves with the project, because the template requires this before review;
- ASF: the incubator graduation guide, which checks community independence, releases under foundation rules and clear rights to the code; the foundation board decides on the incubator committee’s recommendation. This procedure does not require user interviews, so leave the interview column blank;
- OpenSSF: the project lifecycle procedure; apply through a pull request to `github.com/ossf/tac` with a file based on the template for the required stage in `project-lifecycle-documents`. The project needs a sponsoring working group, which conducts the technical review for Incubating; the Technical Advisory Council, TAC, decides by vote;
- LF AI & Data: apply through a pull request to the `proposals` directory of `github.com/lfai/proposing-projects` using its template; the project presents the proposal at a meeting of the foundation’s Technical Advisory Council, which makes the decision; even the Sandbox stage requires a sponsor company that belongs to LF AI & Data or joins the foundation for this application, so record who will sponsor the project and what membership will cost;
- a fiscal sponsor, such as Software Freedom Conservancy: the application form, which checks the project’s mission, governance rules and finances; Conservancy’s own evaluation committee decides;
- a project remaining independent: the evidence your buyers and users request, with no deciding body.

Then, for every requirement of the chosen procedure, record the evidence you already have, with a link, what is missing and who is responsible for collecting it.

<!-- widget: deptsim {"scenario":"oss.incubation"} -->

<!-- section: sources -->
- CNCF, charter — https://github.com/cncf/foundation/blob/main/charter.md
- CNCF TOC, graduation criteria — https://github.com/cncf/toc/blob/main/process/graduation_criteria.md
- CNCF TOC, incubation application template — https://github.com/cncf/toc/blob/main/.github/ISSUE_TEMPLATE/template-incubation-application.md
- CNCF TOC, graduation application template — https://github.com/cncf/toc/blob/main/.github/ISSUE_TEMPLATE/template-graduation-application.md
- Cozystack, General Technical Review — https://cozystack.io/blog/2026/09/cozystack-cncf-general-technical-review/ (29.09.2026)
- OpenSSF TAC, project lifecycle and application procedure — https://github.com/ossf/tac/blob/main/process/project-lifecycle.md
- LF AI & Data, project lifecycle and application template — https://github.com/lfai/proposing-projects/blob/master/ProjectLifecycle.md
- CNCF, technical group restructuring — https://www.cncf.io/blog/2025/05/07/10-years-in-cloud-native-toc-restructures-technical-groups/ (07.05.2025)
- CNCF TOC, project guideposts — https://github.com/cncf/toc/blob/main/resources/project_guideposts.md

<!-- lesson: oss.cncf-benefits | What a foundation offers member companies and projects: CNCF as a case study | 22 -->
<!-- section: hook -->
A marketer at a company that joined CNCF at Silver level expected the foundation to publish a joining press release, invite them to host a live webinar, and share viewers' contact details. The foundation listed the company in its quarterly new-member announcement, offered two blog posts and two recorded webinars per year, and shares viewer contacts with nobody. Using CNCF as an example, this lesson examines what a foundation offers companies by membership level and projects by maturity level and how to use these benefits, then compares them with other foundations.

<!-- section: theory | Member companies -->
All foundation members receive marketing calls, sponsorship discounts, a badge and logo in the member directory, and a mention in the quarterly new member announcement. Academic and nonprofit members receive an additional discounted booth. Silver provides two blog articles and two recorded webinars a year, KubeCon news packages, early access to the foundation's research and dashboards, and the right to use them. Gold provides four articles and four online program events a year, an individual membership press release, a mention in the KubeCon opening keynote, and promotion of member articles in the monthly newsletter. Platinum adds a five-minute membership talk on the keynote stage, promotion in the analyst newsletter, access to live webinars, and sponsorship discounts for subsidiaries. Quotas grant the right to submit material for editorial review; they do not guarantee publication. Companies selling cloud hosting, support, software, training, or consulting generally cannot be end user members of the foundation, so a vendor should not build its budget around those benefits.

CNCF's blog guidelines require recent material, published no more than two months earlier, that is vendor-neutral and contains neither paid advertising nor product promotion; technical comparisons are allowed, but attacks intended to discourage use of another project are not. One external link is allowed in a short conclusion. A response takes seven to ten business days, and publication takes two to three weeks. Online programs are included in CNCF's YouTube playlists; live sessions focus on live demonstrations, coding, or discussions without promotional slides, and CNCF does not share viewers' contact details.

<!-- section: theory | Projects by maturity level -->
Projects have their own set of services, depending on their level. A Sandbox project receives an admission announcement only on the TOC mailing list and introductions to journalists in response to incoming requests, without a substantial release promotion package or release webinars; blog and online program access is limited, sometimes through a member company. On admission, an Incubating project receives a CNCF blog article, a media pitch, and a post on the foundation's social channels, along with major release promotion, up to two release webinars a year, online programs and the project blog, a maintainer track, and a project meeting at KubeCon. A Graduated project receives a press release, media outreach, a post, and a talk at KubeCon, with promotion covering both major and minor releases. A booth in the KubeCon project pavilion, case studies, monthly office hours, LFX Insights, DevStats, CLOMonitor, LFX Security, legal help with licensing, governance support, Zoom, and Slack are available at all levels. The foundation does not guarantee press coverage at any level.

The project pavilion at KubeCon is intended for conversations between maintainers and project users, and selling is not allowed: projects can demonstrate installation, operator workflows, and the contributor journey. Project lightning talks last seven minutes and help newcomers choose which projects to visit. CNCF and Linux Foundation training and certifications include a free introductory Kubernetes course, the KCNA, KCSA, CKA, CKAD, and CKS exams, and project certifications such as Cilium CCA, Prometheus PCA, and Argo CAPA; development of a course for your project can be requested separately. LFX Crowdfunding helps projects raise money for audits, infrastructure, travel, and community work; as of November 2026, it has raised 6,4 million dollars from 2880 sponsors, and 81 % of that money has gone to mentorship.

Landscape, CNCF's map of cloud technologies, accepts companies and projects through pull requests to its repository. A Landscape listing, company membership, Kubernetes certification, and project maturity level are four different designations, and a logo in Landscape is not a certification. The Cloud Native Glossary accepts contributions to definitions and translations: a Vietnamese version was released in June 2025, followed by sign language materials in July; product promotion is not allowed in the glossary.

<!-- section: theory | How other foundations work -->
CNCF's benefits are among the most detailed, while other foundations work differently. Apache Software Foundation accepts sponsorship rather than membership: a logo, thanks, and report mentions, but sponsors do not gain change acceptance, releases, or product endorsement. OpenSSF's published benefits table offers training, community days, demos, and a 10 % discount on sponsoring its events. Eclipse Foundation offers promotional programs and working group participation, but working group fees are separate. LF AI & Data offers case studies, community days, press support, and a listing in its own technology landscape. They share one rule: a publication quota is the right to submit material, and no foundation shares viewers' contact details or promises sales.

<!-- section: task | Exercise: an annual plan for using benefits -->
Complete the task in a table. Record your company's membership level in the foundation you chose in previous lessons and your project's maturity level, or choose them for the fictional company in the simulator. List all benefits available at those levels and assign a topic, date, and owner to each for the coming year: which blog posts you will submit, which webinars you will run, whether you will have a project-area kiosk and lightning talk, and which certifications your engineers will pursue. If your foundation is not CNCF, find its benefits table on its website and build the same plan from it. If the company belongs to no foundation, a plan is still possible: build it from opportunities available without membership—talks through the general selection process, project blog posts, your own online events, participation in community groups and open certifications for engineers. Mark the benefits you have never used before.

<!-- section: sources -->
- CNCF, membership benefits — https://www.cncf.io/about/join/ (checked 25.11.2026)
- CNCF, end user community — https://www.cncf.io/enduser/
- CNCF, blog guidelines — https://github.com/cncf/foundation/blob/main/policies-guidance/blog-guidelines.md; online program guidelines — https://github.com/cncf/foundation/blob/main/policies-guidance/online-programs-guidelines.md
- CNCF, project marketing services — https://contribute.cncf.io/resources/services/marketing/; service catalog — https://contribute.cncf.io/resources/services/
- CNCF, project pavilion — https://contribute.cncf.io/events/project-pavilion/; project lightning talks — https://contribute.cncf.io/events/project-lightning-talks/
- KubeCon NA 2025, transparency report — https://www.cncf.io/wp-content/uploads/2025/12/KCNA25_TransparencyReport.pdf
- CNCF, training — https://www.cncf.io/training/
- LFX Crowdfunding — https://crowdfunding.linuxfoundation.org/for-projects; statistics — https://crowdfunding.linuxfoundation.org/statistics
- CNCF, Membership Hub — https://www.cncf.io/membership-hub/
- Cloud Native Glossary, Vietnamese version — https://www.cncf.io/blog/2025/06/26/cloud-native-glossary-the-vietnamese-version-is-live/ (26.06.2025)
