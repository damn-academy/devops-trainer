<!-- lesson: strategy.category | Category: how the market learns to name your problem | 20 -->
<!-- section: hook -->
For five years, a company told buyers it built a “hyperconverged cloud platform based on Kubernetes with multi-tenancy support.” Buyers nodded and filed the company under “other.” Once the term “platform engineering” emerged and took hold in the industry, and analysts published reports about it, buyers had a budget under that name, and “where do you fit into this picture?” became the main question at every meeting. This course covers strategy over years: categories, market events, ecosystems and partners, standards and foundations, and AI models as advisers and implementers. The first lesson is about how the market learns to name the problem your product solves, and what a company can do to help.

<!-- section: theory | What a category is -->
A category is an accepted name for a problem and a class of solutions that buyers use to find suppliers, allocate budgets, and compare offers. The book Play Bigger argues that the market rewards whoever defines a category and becomes its reference point; its frequently cited figure of the leader capturing 76 % of category value is presented without a publicly available research methodology, so it should be treated as the authors' hypothesis, not an empirically established law.

Platform engineering is the clearest recent example. The platformengineering.org community says it grew out of the launch of Humanitec and then built the PlatformCon conference, educational videos, and community channels. This is an example of a vendor supporting a profession and a shared language around the problem its product addresses; such a community is not independent validation of the vendor's position. For volume 4 of its State of Platform Engineering report the community surveyed 518 engineers, and the report itself became a language the profession uses to describe itself. Gartner published a Market Guide for Internal Developer Portals on 31 March 2025 and a Hype Cycle for Platform Engineering on 25 June 2025. A developer portal and a platform are different categories: the portal is the user's entry point, while the platform is responsible for the capabilities and operations beneath it.

CNCF, the cloud-native foundation under Linux Foundation that develops Kubernetes and related projects, has a Platform Engineering Maturity Model: a description of how companies progress from scattered scripts to an internal developer platform. Syntasso, which helped prepare the model, described using it to assess its customers. This is a repeatable category-building mechanism: give buyers a language for diagnosing their situation, then help them do the work the diagnosis reveals.

<!-- section: theory | Applying this to your product -->
Start with a recognizable buyer problem in the buyer's own words. For a database tools vendor, this could be “migrate an application from Oracle without rewriting reports”; for an observability vendor, “know the cost of every gigabyte of logs without losing the ones we need”; for a storage vendor, “keep backups outside the cloud and recover within an hour”; for a private cloud platform, “operate a cloud with tenant isolation.” Then show where the product sits relative to adjacent layers: below or above a developer portal, replacing a managed cloud service or working alongside it. A successful story from another category suggests a technique. FinOps Foundation gave finance and engineering teams a shared language for cloud costs, and tool vendors started selling “FinOps capabilities” that buyers could already name. A new category is justified only if customers repeat your problem definition themselves and partners can deliver work against it.

You can measure category building through independently authored articles about the problem, use of your wording in real procurement requirements, and deployments based on your reference architecture. There is no published rule that invalidates category design; the method has a different limitation: vendor communities, forecasts, and analyst mentions do not prove commercial success on their own.

<!-- section: task | Task: define the problem in the customer's words -->
Complete this task in a document. Write down five phrases your buyers used to describe their problem in recent conversations, emails, or procurement requests. Use them to formulate one category phrase and one sentence about where your product sits relative to adjacent categories: for example, a managed cloud service, an open-source product the customer deploys themselves, and a major incumbent's solution. Then find three independent articles describing the same problem and record the words they use. If you have no conversations of your own at hand, use these five illustrative buyer phrases for a database tooling vendor: “we need to leave Oracle before renewal, but nobody can rewrite the finance reports”, “we worry queries will slow down after the move”, “we need a plan we can show auditors”, “we want to migrate one system at a time, not everything at once”, and “we need to know what it will cost including our own people's work”. A good category phrase repeats buyers' words without technology names, and can be tested with one question: will the buyer recognize their problem in it without explanation?

<!-- section: sources -->
- Play Bigger — https://playbigger.com/publications/what-is-category-design
- platformengineering.org, about the community — https://platformengineering.org/about
- platformengineering.org, State of Platform Engineering, volume 4 — https://platformengineering.org/blog/announcing-the-state-of-platform-engineering-vol-4
- Gartner, Market Guide for Internal Developer Portals — https://www.gartner.com/en/documents/6306515 (31.03.2025)
- CNCF TOC, platform maturity model — https://github.com/cncf/toc/issues/1679
- FinOps Foundation, FinOps framework — https://www.finops.org/framework/


<!-- lesson: strategy.market-events | Market events: when a vendor changes the terms | 26 -->
<!-- section: hook -->
A sales team decided that Broadcom's acquisition of VMware had turned every VMware customer into a buyer of alternatives, and called two hundred companies offering “migration in a month.” Only a few responded, and almost all said the same thing: they had renewed for two years, were negotiating, and were considering their options. A year later, another company repeated the mistake with Redis customers, and another year later with Oracle customers. A major vendor's change of terms opens conversations, but leads to a purchase only when a specific customer has a reason to act by a particular date and a verifiable migration path. This lesson examines five cases where a vendor changed its license, price, or renewal rules and shows the offers that grew out of them.

<!-- section: theory | Broadcom and VMware: subscriptions replace perpetual licenses -->
On 11 December 2023, Broadcom announced that VMware was ending perpetual license sales and support renewals and moving customers to subscriptions. In the same announcement, the company said it was halving VMware Cloud Foundation's list price, so claiming “everyone's price rose by the same percentage” without comparing specific bills is wrong. A CloudBolt survey in January 2026 of 302 executives at North American companies with more than one thousand employees found that 86 % were reducing their VMware footprint and 54 % were staying but reducing dependence. The survey was vendor-sponsored and measures intentions, not completed migrations.

Alternative vendors turned the event into programs. Nutanix offers migration, a trial environment, guides, and a limited-time transition promotion listed on its site as running until 31 July 2027. Vates, the company behind the open-source virtualization platform XCP-ng, reports that 90 % of its new customers since 2023 came from VMware. The lesson for any vendor: segment the customer's estate by renewal date, workload criticality, hardware requirements, resilience, team skills, and ecosystem dependence. Migration, diversification, and renegotiation with the incumbent are three different offers. A backup, storage, or networking vendor does not need to sell a hypervisor to benefit from this event: it can enable portability and coexistence of two platforms.

<!-- section: theory | Oracle and PostgreSQL: renewal becomes a migration program -->
On 26 October 2026, AWS published a joint case study with The New York Times and partner Mactores. Migrating the system that calculates subscription revenue from Oracle to Aurora PostgreSQL took 18 weeks, versus a preliminary estimate of up to 18 months. The project involved about 110 thousand conversion units, meaning database objects and code fragments that tools translate from the Oracle dialect, three schemas, more than 8 thousand application files, and almost six million lines of code. Eighteen months was an estimate for an alternative approach, not a controlled experiment, and the result belongs to a particular team.

Several offers have emerged around this transition: AWS tools for schema conversion and data migration, Mactores' AI agent, and commercial PostgreSQL with Oracle compatibility, which EDB sells with IBM. The external trigger is the renewal date and the cost of dependence on the incumbent, while the product is demonstrably lower migration risk. What is sold is a plan covering stored procedures, extensions, application behavior, resilience, performance, and rollback. The AWS guide's claim of “more than 90 % automatic code conversion” describes the vendor's experience, not a guarantee for every customer.

<!-- section: theory | HashiCorp and OpenTofu: an ecosystem builds a shared engine -->
On 10 August 2023, HashiCorp moved future Terraform releases to the Business Source License. Its additional use grant restricts competing hosted and embedded offerings, while internal use is not considered competitive in the reviewed version. This is much more precise than saying “Terraform became paid for everyone.” Several competing companies created the open-source fork OpenTofu under Linux Foundation. By 10 January 2025, the OpenTofu registry served more than six million requests per day, and the project reported that request volume had tripled without specifying over what period; this includes automated requests and does not mean six million users.

Spacelift offers OpenTofu execution, migration help, support, and training, while Gruntwork, env0, Scalr, and other participants build products around the shared engine. The lesson concerns market structure: competitors jointly fund a commoditized engine and compete in orchestration and support. The offer to buyers is validation of state versions, providers, modules, policies, and rollback on a copy of their environment, with legal license assessment kept separate from product migration.

<!-- section: theory | Redis and Valkey: licensing, a fork, and price competition -->
Redis through version 7.2 inclusive was distributed under the permissive BSD license. In March 2024, the company announced that subsequent versions, starting with 7.4, released in July, would use dual RSAL and SSPL licensing, with the user choosing one: RSAL prohibits offering the product as a managed service, while SSPL permits it provided the supplier releases under the same license all code needed to operate the service, including its management layers, and in 2025 Redis 8 added a third option, AGPL. In March 2024, Valkey emerged under Linux Foundation as a continuation of the permissive branch. On 8 October 2024, AWS launched ElastiCache for Valkey, announcing prices 33 % lower for serverless and 20 % lower for node-based deployments compared with other supported engines. This compares specific AWS rates at launch and is not a universal Valkey advantage over every Redis deployment.

The event opened a market for managed alternatives and migration services. The offer must validate commands, client libraries, modules, persistence, latency, and rollback. Once Redis added an AGPL option, “Redis stopped being open source forever” became false, although independent governance, permissive licensing, and economics may remain arguments for Valkey. Licensing facts change, and the strategy should be reviewed with each new release.

<!-- section: theory | Elastic and OpenSearch: the migration market changes with the license -->
OpenSearch forked from Elasticsearch in 2021, and in September 2024 the project gained its own foundation under Linux Foundation. By 25 August 2025, the foundation reported more than one billion downloads and more than 400 participating organizations; these are activity measures, not revenue or migration counts. On 29 August 2024, Elastic announced that it would add AGPL as a license option alongside ELv2 and SSPL in the coming weeks, and subsequently released the Elasticsearch and Kibana source code under a choice of three licenses, making a comparison of “closed Elastic versus open OpenSearch” inaccurate today without specifying the version and product components. On 23 June 2026, AWS added AI assistance to Migration Assistant for moving Solr, Elasticsearch, and OpenSearch to managed OpenSearch, including historical data and live traffic.

AWS's offer lowers migration cost and risk through migration tools. An independent vendor can offer the same at its own scale: compatibility assessment, replaying real queries on a new cluster, checking plugins, indexes, and APIs, and managed search with a clear service-level agreement. The earlier licensing conflict provides a reason for the first conversation, while a validated migration helps close the contract.

<!-- section: theory | What the five cases share -->
In four cases, a vendor changed its terms: the license or sales model. In Oracle's case, the trigger is a particular customer's renewal date and price rather than a new vendor rule, and this contractual trigger works the same way. In all five, offers emerged around reducing migration risk: customer dissatisfaction alone is not enough for a purchase. And in all five, facts kept changing after the initial event: Broadcom lowered list prices, Redis and Elastic added AGPL, and new migration tools appeared. Maintain the market-event dossier by version and date, and recheck the campaign thesis whenever facts change.

<!-- quiz -->
? Broadcom moved VMware to subscriptions. What is the right conclusion for an alternative platform's sales team?
- All VMware customers now want a replacement, so call everyone || Dissatisfaction does not mean a migration budget exists.
+ Segment customers by renewal date, criticality, and skills, and offer different paths || Migration, diversification, and renegotiation are different offers.
- Wait for customers to come on their own because the CloudBolt survey showed a mass departure || The survey measures intentions.
? What do you sell a customer moving from Oracle to PostgreSQL?
+ A verifiable migration plan covering stored procedures, performance, and rollback || The product is lower migration risk.
- A promise of 90 % automatic code conversion, as in the AWS guide || This is the vendor's experience, not a guarantee.
- A first-year discount to cover the difference from Oracle's renewal price || A discount does not remove migration risk.
? Why should “Redis stopped being an open-source project forever” not appear in campaign materials in 2026?
- Because Valkey and Redis are now the same project under one foundation || They are different projects.
- Because a court recognized RSAL as open source || No such ruling exists.
+ Redis 8 added an AGPL option, making the claim outdated || Check licensing facts by version.
<!-- /quiz -->

<!-- section: task | Exercise: a dossier on one change of terms -->
Complete the exercise in the document on this page. Choose one major vendor's change of terms that affects your customers: a license, price, renewal rules, or product discontinuation. Record what changed, with a date and primary source, which versions and contracts it affects, and what changed after the initial event. Then choose three affected customers and, for each, record the renewal date, workload criticality, and which of three offers fits: migration, diversification, or help renegotiating terms.

<!-- section: sources -->
- Broadcom, VMware's transition to subscriptions — https://www.broadcom.com/company/news/articles/cloud/vmware-by-broadcom-business-transformation (11.12.2023)
- CloudBolt, 2026 survey — https://www.cloudbolt.io/company/news/new-cloudbolt-research-86-of-companies-actively-reducing-their-vmware-footprint/ (January 2026)
- Nutanix, transition from VMware — https://www.nutanix.com/vmware-alternative/transition (checked 25.11.2026)
- Vates, growth after customers left VMware — https://vates.tech/blog/what-we-heard-in-vienna-and-why-vates-is-investing-in-dach/
- AWS, The New York Times' migration from Oracle — https://aws.amazon.com/blogs/database/the-new-york-times-cut-oracle-migration-time-from-18-months-to-18-weeks/ (26.10.2026)
- AWS, Oracle-to-PostgreSQL schema conversion guide — https://docs.aws.amazon.com/dms/latest/sbs/chap-oracle-postgresql.migration-process.database-schema-conversion.html
- IBM, EDB Postgres Enterprise — https://www.ibm.com/products/postgres-enterprise/pricing
- HashiCorp, Business Source License — https://www.hashicorp.com/en/bsl
- OpenTofu 1.9 — https://opentofu.org/blog/opentofu-1-9-0/ (10.01.2025)
- Spacelift on OpenTofu — https://spacelift.io/blog/what-is-opentofu
- Redis, licenses — https://redis.io/legal/licenses/
- Valkey, project history — https://valkey.io/about/
- AWS, ElastiCache for Valkey launch — https://aws.amazon.com/about-aws/whats-new/2024/10/amazon-elasticache-valkey/ (08.10.2024)
- OpenSearch Foundation, first anniversary — https://opensearch.org/announcements/opensearch-software-foundation-marks-1-year-anniversary-with-community-growth-agentic-ai-and-hybrid-search-enhancements/ (25.08.2025)
- Elastic, adding AGPL — https://www.elastic.co/blog/elasticsearch-is-open-source-again/ (29.08.2024)
- AWS, AI-assisted OpenSearch migrations — https://aws.amazon.com/about-aws/whats-new/2026/06/amazon-opensearch-service-ai-migrations/ (23.06.2026)

<!-- lesson: strategy.market-shifts | Market events: economics, new interfaces, and trust | 26 -->
<!-- section: hook -->
The observability bill tripled in a year, and the customer's CFO demands a reduction. A month later, an AI agent at the same customer starts accessing the database, and security asks who authorized it. Another six months later, an antivirus update at neighboring companies takes down thousands of computers, and the board asks what would happen if it happened to them. None of these events involves a license change, yet each opens an opportunity for an infrastructure vendor. This lesson covers three other types of market events: changing economics, the emergence of a new interface, and a blow to trust.

<!-- section: theory | Changing economics: observability costs -->
The Grafana Labs survey published on 18 March 2026 is based on 1 363 responses collected through the company's own community and industry events. 65 % of respondents call cost an important selection criterion, 76 % invest in OpenTelemetry, 50.3 % plan to increase observability spending, and 10.4 % plan to reduce it. The sample belongs to one vendor's ecosystem and is not a market census. In its own 2024 technical analysis, ClickHouse described its own logging platform, which processes about 5.4 pebibytes of data per month, or more than 10 trillion rows (a pebibyte is about 1.13 million gigabytes), and estimated that ingesting this stream into Datadog with 30-day retention at list prices would cost 26 million dollars per month. The platform stores about 19 pebibytes in total, or 1.13 pebibytes compressed, but the cost estimate is specifically for the monthly flow. This is a modeled cost without discounts; nobody paid that bill.

Popular stories about particular customers' enormous bills often lack primary-source confirmation and are best left out of campaign materials. A sustainable offer centers on assessing telemetry cost, choosing retention and sampling, portable OpenTelemetry instrumentation, storage migration, and controlling cost per unit of data. OpenTelemetry reduces instrumentation's dependence on a particular backend but does not guarantee cheap storage, queries, or support. Compare the cost of a useful trace or gigabyte at equal retention and service levels, including team labor.

<!-- section: theory | Changing economics: cloud repatriation and accelerator scarcity -->
In October 2024, 37signals reported that moving compute, databases, and search from the cloud to its own servers reduced annual cloud costs from 3.2 to 1.3 million dollars, with about 700 thousand spent on Dell hardware. In March 2025, it described the next step: almost 1.5 million dollars per year for S3, a contract expiring on 30 June 2025, and an installed 18-petabyte Pure Storage system with an S3-compatible API. More than ten million in savings over five years is a forecast, not an accumulated result of that size. The compatible interface reduced application rework, while in-house operating skills and data-center racks made the move possible. One successful move does not prove that owning hardware benefits everyone: staffing, depreciation, replacement, networking, disaster recovery, and growth uncertainty belong in the calculation.

Specialist accelerator clouds show the other side of the economics. CoreWeave reported third-quarter 2026 revenue of 3.661 billion dollars, compared with 1.365 billion a year earlier, and a backlog of future customer commitments of 132.5 billion as of 30 September 2026. The backlog consists of expected amounts conditional on delivery terms being met, not money received. One provider's growth does not prove an equal shortage of every accelerator in every region; in the exercise, specify the shortage precisely: accelerator model, region, volume, delivery date. A networking, storage, or observability vendor can sell reduced downtime and lower cost per successful training job without reselling accelerators. The cost of an accelerator hour without utilization says nothing about useful work.

<!-- section: theory | A new interface: agents and MCP -->
MCP, the protocol through which AI agents connect to tools and data, originated at Anthropic in November 2024. In December 2025, it became one of the first projects of Agentic AI Foundation under Linux Foundation, which had ten projects by October 2026. This signals a shared stack forming, not the number of production deployments. On 25 March 2025, Cloudflare announced tools for remote MCP servers with authorization and a runtime, and on 1 May showcased MCP servers from ten companies, including Atlassian, Sentry, and Stripe. This is already a commercial runtime offer that can be purchased.

For a database vendor, the new interface means secure agent access and query permissions; for security vendors, agent policies and identity; for observability, tracing, cost, and agent action audits; for networking, a gateway and rate limits; for storage, search with permission checks. The offer describes the agent's output, isolation, observability, and failure behavior. MCP repository stars do not measure companies' willingness to pay for your gateway, and a published MCP server address does not establish production readiness.

<!-- section: theory | A blow to trust: CrowdStrike and Log4Shell -->
On 19 July 2024, a faulty CrowdStrike Windows sensor configuration update caused a widespread outage. Microsoft estimated 8.5 million affected devices, fewer than 1 % of Windows devices. CrowdStrike reported that by 29 July about 99 % of sensors were back online relative to the baseline; this is the company's own estimate, with no independent verification of every organization's recovery. SentinelOne's comparison page emphasized control over update pacing, redundancy, and deployment architecture. This is verifiable competitor positioning, not an independent technical assessment, and a mass move to multiple vendors has not been established.

The Log4Shell vulnerability in December 2021 showed an event with a long tail. In its 11 July 2022 report, the US Cyber Safety Review Board called it an endemic vulnerability that could remain in systems for a decade or longer. On 15 March 2022, Cloudflare included managed firewall rules for such vulnerabilities in all plans, including the free plan, quickly reducing risk for a broad range of customers.

Trust events generate offers for resilience assessments, phased update rollouts, recovery drills, inventories of critical nodes and dependencies, software bills of materials (SBOMs), and managed vulnerability remediation. Distinguish urgent risk reduction from a permanent fix: a firewall does not replace updating a vulnerable library. Two vendors instead of one do not guarantee reliability and add complexity, so test failure domains and recovery time. A competitor's incident does not prove your product's technical superiority.

<!-- section: theory | Five types of events -->
| Type of change | Examples | An offer that can be tested |
|---|---|---|
| Vendor terms | Oracle renewal, VMware subscriptions, Terraform, Redis, and Elasticsearch licenses | Assessment, coexistence of two platforms, migration tools, support, portable deployment |
| Economics | Observability bills, cloud repatriation, accelerator utilization | Unit cost audit, new pricing model, optimization, capacity planning |
| Architecture and standards | MCP, OpenTelemetry, open data formats | Adapter, gateway, control plane, managed runtime, compatibility validation |
| Trust and operational risk | CrowdStrike, Log4Shell | Safe updates, independent recovery, inventory, policies, and support |
| Control and residency | Sovereign clouds in Europe, India, the UAE, and Singapore | An offer with a local operator, control of keys and the control plane, disconnected operation, audit evidence |

This is a teaching classification: cases have different causes and profitability, and several events can affect one segment at the same time. The next lesson covers the last type.

<!-- quiz -->
? The Grafana Labs survey found that 65 % of respondents call cost an important criterion. How should you use this figure in a campaign?
- As proof that two-thirds of the market are leaving expensive observability vendors || The survey does not measure departures.
+ As a signal of price sensitivity in one vendor's ecosystem, specifying the sample || The sample was collected through the Grafana community.
- Do not use it at all because vendor surveys prove nothing || The survey is useful when its scope is stated.
? 37signals moved workloads to its own servers and reduced cloud costs. What follows for a storage vendor?
+ Sell a workload and total cost of ownership assessment with three options, including optimizing the current cloud || One move does not prove benefits for everyone.
- Cloud repatriation benefits any company with a bill above one million dollars per year || Staffing, depreciation, and networking belong in the calculation.
- S3 compatibility is unimportant because 37signals rewrote the application anyway || The compatible interface reduced rework.
? What can a networking vendor sell in the accelerator cloud market?
- Accelerators resold at prices below specialist clouds || This is someone else's business with different economics.
- A discount per accelerator hour because buyers compare only that price || Hourly price without utilization says nothing.
+ Reduced downtime and lower cost per successful training job || Value is measured in useful work.
<!-- /quiz -->

<!-- section: task | Exercise: an event in your segment -->
Complete the exercise in the document on this page. Find one event in your segment for each of the five types in the table: vendor terms, economics, architecture and standards, trust, and control and location. For each, record a dated primary source, the affected customers, and a verifiable offer your company could make. Mark the event where you are strongest and record the metric the customer would use to measure the result.

<!-- section: sources -->
- Grafana Labs, 2026 observability survey — https://grafana.com/observability-survey/2026/ (18.03.2026)
- ClickHouse, logging platform — https://clickhouse.com/blog/building-a-logging-platform-with-clickhouse-and-saving-millions-over-datadog (2024)
- DHH, cloud exit savings — https://world.hey.com/dhh/our-cloud-exit-savings-will-now-top-ten-million-over-five-years-c7d9b5bd (17.10.2024)
- DHH, S3 exit — https://world.hey.com/dhh/it-s-five-grand-a-day-to-miss-our-s3-exit-b8293563 (26.03.2025)
- CoreWeave, third-quarter 2026 results — https://investors.coreweave.com/news/news-details/2026/CoreWeave-Reports-Strong-Third-Quarter-2026-Results/
- Linux Foundation, creation of Agentic AI Foundation — https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation
- Linux Foundation, new Agentic AI Foundation projects — https://www.linuxfoundation.org/press/agentic-ai-foundation-announces-four-new-projects-agent-skills-open-responses-openenv-and-opensandbox (22.10.2026)
- Cloudflare, remote MCP servers — https://blog.cloudflare.com/remote-model-context-protocol-servers-mcp/ (25.03.2025)
- Cloudflare, MCP Demo Day — https://blog.cloudflare.com/mcp-demo-day/ (01.05.2025)
- Microsoft on the CrowdStrike outage — https://blogs.microsoft.com/blog/2024/07/20/helping-our-customers-through-the-crowdstrike-outage/ (20.07.2024)
- CrowdStrike, root cause analysis — https://www.crowdstrike.com/en-us/blog/channel-file-291-rca-available/ (06.08.2024)
- SentinelOne, comparison with CrowdStrike — https://www.sentinelone.com/vs/crowdstrike/ (checked 25.11.2026)
- CISA, CSRB report on Log4j — https://www.cisa.gov/sites/default/files/publications/CSRB-Report-on-Log4-July-11-2022_508.pdf (11.07.2022)
- Cloudflare, top exploited vulnerabilities of 2022 — https://blog.cloudflare.com/unmasking-the-top-exploited-vulnerabilities-of-2022/

<!-- lesson: strategy.sovereignty | Sovereign infrastructure: Europe, India, the Middle East, and Singapore | 24 -->
<!-- section: hook -->
A vendor put “sovereign cloud” on its home page because its servers were in Frankfurt, and lost its very first government tender. The procurement requirements had eight items: who has administrative access, where encryption keys are stored, where updates come from, what happens if the connection to the parent company is severed, and four more. Hosting in the country met one of eight items. Sovereignty is a set of measurable properties, and buyers assemble that set differently across regions. This lesson compares four regional models and shows how to build a sovereignty dossier for your product.

<!-- section: theory | Europe: strong interest, limited willingness to pay -->
The Bitkom study published on 11 June 2025 surveyed 604 German companies with at least twenty employees. 78 % consider Germany too dependent on US cloud providers, and 82 % would like competitive European providers. Yet 65 % would accept none of the proposed disadvantages in exchange for a protected German cloud, and only 7 % would pay 10–20 % more. Synergy estimates that European providers hold about 15 % of their regional cloud infrastructure market.

Regulators are turning sovereignty into procurement. The European Data Act entered into force on 11 January 2024 and has applied since 12 September 2025. It includes measures on cloud provider switching and interoperability, but does not require EU organizations to use European-owned clouds. On 10 October 2025, the European Commission announced a sovereign-cloud tender worth up to 180 million euros over six years, with eight sovereignty objectives including legal control, operations, supply chains, technological openness, and security. On 17 April 2026, the Commission announced four winners: Post Telecom with CleverCloud and OVHcloud, STACKIT, Scaleway, and Proximus with S3NS, Clarence, and Mistral. The announcement states that non-European technologies can meet minimum requirements with appropriate controls.

<!-- section: theory | India: a government program for affordable compute -->
On 25 March 2026, the Indian government reported that IndiaAI Mission had a budget of 10 372 crore rupees (a crore is ten million, making the total about 104 billion rupees), more than 38 thousand accelerators connected through its compute portal, and 190 approved projects. An earlier update on 10 February 2026 cited access starting at 65 rupees per hour. This is a government program for affordable AI compute, and that price is not the market rate for any accelerator. Sify sells its CloudInfinit+AI hybrid cloud in its own data centers as sovereign: an example of commercially packaging local hosting, operations, and security, not proof of compliance with every Indian customer's requirements.

<!-- section: theory | The Middle East and Singapore: a local operator on a global stack -->
In an announcement dated 2 July 2025, Oracle reported that operator du had already launched National Hypercloud in the UAE on Oracle Alloy: a local operator, its data center, and more than 200 Oracle Cloud services for the public and private sectors. The offer combines local governance with a global provider's stack. In Saudi Arabia, AWS announced on 4 March 2024 a region planned to launch in 2026 and 5.3 billion dollars in planned investment; this is an announcement, not evidence that the region had actually opened by late 2026. On 18 March 2025, Singapore's defense agency DSTA contracted for an isolated Oracle Cloud region for the Ministry of Defence: sovereign infrastructure disconnected from the outside world beyond the European agenda.

<!-- section: theory | The sovereignty dossier -->
Break “sovereign” down into verifiable properties. The list below is this course's learning dossier for a technical conversation with a buyer; it does not match the eight objectives in the European Commission tender, and for any specific procurement, check the dossier against that procurement's own criteria.

- where data and backups are stored;
- who has administrative access and from where;
- who holds encryption keys;
- who owns and controls the operator;
- what the control plane depends on and what happens when external connectivity is lost;
- where updates come from and who checks them;
- what telemetry the product sends and where;
- how the customer exits the solution with their data.

Hosting in the country covers only the first item. For database, storage, security, content delivery network, or AI platform vendors, the offer is a verifiable deployment design with a local partner and a table of controls for each item. Work through a regional operator or consortium if procurement is structured that way. Legal conclusions must be based on the requirements of the specific procurement; comparing market offers is not a legal opinion.

<!-- quiz -->
? A vendor's servers are located in the customer's country. Which part of the sovereignty requirements does this meet?
+ Only data location; access, keys, updates, and exit are checked separately || Sovereignty breaks down into several properties.
- All requirements, because the data is legally under the country's jurisdiction || Jurisdiction does not resolve access and key issues.
- None, because sovereignty depends only on who owns the vendor company || Storage location is one of the properties.
? What does the Bitkom survey say about demand for sovereign cloud in Germany?
- Companies are moving to European providers en masse and are willing to pay more || 7 % are willing to pay more.
+ Desire for independence is high, but willingness to accept disadvantages for it is low || 78 % see dependence; 65 % would accept no disadvantage.
- There is no demand because 65 % of companies rejected sovereign cloud || Rejecting disadvantages does not mean rejecting cloud.
? How should you read AWS's announcement of a Saudi Arabia region for 2026?
- As proof the region is operating because 2026 has already arrived || An announcement does not confirm opening.
- As a sign that local operators have lost the market to global providers || The announcement does not say this.
+ As an announcement: verify opening through a separate release || Distinguish announcements from facts.
<!-- /quiz -->

<!-- section: task | Exercise: your product's sovereignty dossier -->
Complete the exercise in the document on this page. Fill in the eight items of the sovereignty dossier for your product: how it meets each item today and what evidence supports it. Example of one evidence chain: procurement requirement “the customer holds the encryption keys” → dossier item “who holds the encryption keys” → evidence: documentation for connecting an external key store and a recording of a test in which a key is revoked and the data becomes inaccessible → evidence boundary: the test shows that the mechanism works, but not how the customer stores its keys. Mark weak answers. Then choose one region from the lesson, find a local operator or integrator through which your product could reach procurement, and record which dossier items the partner covers itself.

<!-- section: sources -->
- Bitkom, dependence on US clouds — https://www.bitkom.org/Presse/Presseinformation/Wirtschaft-ruft-nach-deutscher-Cloud (11.06.2025)
- Synergy Research, European cloud providers — https://www.srgresearch.com/articles/european-cloud-providers-local-market-share-now-holds-steady-at-15
- European Commission, Data Act — https://digital-strategy.ec.europa.eu/en/policies/data-act
- European Commission, sovereign-cloud tender announcement — https://commission.europa.eu/news-and-media/news/commission-moves-forward-cloud-sovereignty-eur-180-million-tender-2025-10-10_en (10.10.2025)
- European Commission, tender results — https://commission.europa.eu/news-and-media/news/commission-advances-cloud-sovereignty-through-strategic-procurement-2026-04-17_en (17.04.2026)
- PIB, IndiaAI Mission — https://www.pib.gov.in/PressReleasePage.aspx?PRID=2245069 (25.03.2026)
- PIB, IndiaAI compute access — https://www.pib.gov.in/PressReleasePage.aspx?PRID=2225781 (10.02.2026)
- Sify, cloud services — https://www.sifytechnologies.com/cloud-services-ind/
- Oracle and du, National Hypercloud — https://www.oracle.com/europe/news/announcement/blog/oracle-alloy-enables-offer-sovereign-cloud-capabilities-2025-07-02/ (02.07.2025)
- AWS, Saudi Arabia region announcement — https://press.aboutamazon.com/2024/3/aws-to-launch-an-infrastructure-region-in-the-kingdom-of-saudi-arabia (04.03.2024)
- AWS, partner opportunities in the Middle East — https://aws.amazon.com/blogs/publicsector/how-aws-can-help-partners-grow-in-the-middle-east/
- Oracle and DSTA — https://www.oracle.com/sa/news/announcement/dsta-selects-oracle-cloud-infrastructure-for-ministry-of-defence-singapore-2025-03-19/ (18.03.2025)

<!-- lesson: strategy.event-offer | From a market event to a validated offer | 28 -->
<!-- section: hook -->
Marketing saw news of a major vendor's license change and launched a “switch to us” campaign three days later. A quarter later, the campaign had forty registrations and no deals. Analysis showed that affected customers' renewals were a year and a half away, migration required features the product did not yet have, and free migration help consumed the entire first-year margin. The news was true, but there was no buying window. This lesson provides a seven-step method that separates an event from an opportunity and ends with a decision to launch, scale, or stop.

<!-- section: theory | Where the method comes from -->
The method combines three established approaches. Simon Wardley's maps start with user needs and a chain of dependencies. The FinOps framework connects costs to a unit of useful output. Strategyzer's book Testing Business Ideas and Alexander Osterwalder's Test Card propose testing an offer's desirability, feasibility, and viability through experiments with criteria recorded in advance. The sequence below is a teaching synthesis of these approaches; no organization has published it as a standard.

<!-- section: theory | Seven steps -->
1. Record the event and deadline. Write down what changed, the primary source, publication date, effective date, and affected versions, countries, and contracts. A license change affects particular commercial uses, each customer's Oracle renewal has its own date, and an accelerator shortage concerns a particular type of capacity.
2. Draw the chain of consequences: a change in terms, economics, standards, or risk affects a particular workload and role; the role gains a measurable new cost, risk, or opportunity; a reason to act by a particular date emerges; an accessible solution path exists; build an offer, evidence, and customer access channel around it.
3. Find buying triggers at specific accounts. News and total market size alone are insufficient: you need renewal calendars, significant bill growth, a migration owner, a procurement requirement, an open request, or agreement to an assessment. Sources include customer conversations, data customers provide themselves, public tenders, and official announcements.
4. Test three hypotheses. Desirability means the pain is large enough for the customer to change behavior; complaints are insufficient. Feasibility means the company can deliver the transition with the required compatibility, latency, resilience, security, and deadlines. Viability means margin remains after migration assistance, hardware, implementation, and support.
5. Package the offer: who it is for, what changes, the outcome, inclusions and exclusions, timeline, required inputs, fixed or phased price, compatibility table, rollback plan, evidence, and support owner.
6. Calculate the economics together with migration risk.
7. Record in advance what would disprove the strategy and review it whenever facts change.

<!-- section: theory | The test card -->
Example test card: “Of eight target companies with renewals in the next six months, at least three will provide real data for assessment, and at least one will agree to a paid pilot by 1 March.” These are teaching thresholds, set by the team before the test begins. Interview compliments are not agreement to an assessment, and a free pilot is not a purchase. Concluding “the window is unconfirmed” with good data is better than launching an unfounded campaign.

Examples of packaged offers: an Oracle database assessment listing constructs that cannot be migrated automatically; a telemetry bill review with normalized cost per gigabyte; an accelerator workload pilot with cost per successful job; recovery drills after an endpoint agent failure.

<!-- section: theory | Customer economics -->
`Customer benefit over the period = comparable cost of the current option − target operating costs − one-time migration and parallel operation costs − training and process change costs`.

Service-level, data residency, recovery, and compatibility requirements are mandatory constraints and must not be converted into a discount to total cost of ownership. Show avoided-loss benefits as a separate scenario with an explicit probability; do not add them to direct cash savings. Choose the unit of output for the product: cost per request for an API, cost per transaction at a specified latency for a database, cost per stored gigabyte at a specified query load for logs, and cost per successful job at a specified quality for accelerators.

<!-- section: theory | An illustrative example from start to finish -->
A fictional PostgreSQL migration service provider works through the seven steps using one event; all figures are illustrative.

Event and deadline: target customers' Oracle support renewals fall within the next six months, starting on 1 June 2027. Account triggers: eight companies with renewals in that window are selected from the list, with the database owner and bill amount known for each. Test card: “at least three of the eight will provide data for assessment, and at least one will agree to a paid pilot by 1 March”. Results by 1 March: four companies provided data and one agreed to a $25,000 paid pilot. The desirability hypothesis is confirmed.

Economics over three years for a customer paying $400,000 annually for Oracle support: the current option costs $1,200,000; the target option, managed PostgreSQL with support, costs $120,000 annually, or $360,000; a one-off migration costs $250,000, six months running alongside the old database another $200,000, and training and process changes $40,000. The benefit is `1,200 − 360 − 250 − 200 − 40 = 350` thousand dollars over three years, provided latency and recovery requirements are met. Viability for the provider: the migration contract is worth $250,000, delivery costs $170,000, and the margin is about 32%.

Decision: it is too early to scale because only one pilot is confirmed and sales are not yet repeatable; the right move is to run the pilot and decide based on its results. Stop criteria are recorded in advance: if more than one-fifth of stored procedures cannot be migrated automatically during the pilot, or the customer gets an Oracle discount above 40%, reconsider the offer.

<!-- section: theory | When to stop -->
Predefined events disprove the strategy: the incumbent restores an acceptable license; migration fails functional tests; customer urgency disappears; a large incumbent discount makes the offer uneconomic; the team lacks people to support migrations. The Redis and Elastic stories in the lesson on vendor term changes illustrate why the thesis must be reviewed whenever facts change.

<!-- section: theory | The same method across segments -->
| Segment | Example event | Example offer |
|---|---|---|
| Databases | Oracle renewal | Assessment of schemas and application SQL, migration plan with rollback |
| Observability | Rising telemetry bills | Cost assessment at equal retention, portable instrumentation |
| Security | Log4Shell, agent update failure | Dependency inventory, phased rollout, recovery drills |
| Networking and content delivery | Residency and latency requirements | Portability, local control, latency measurement |
| Storage and backup | Cloud repatriation | Migration with disaster recovery, egress costs, and depreciation |
| Data and streaming | Engine license change | Engine migration, open interfaces, data stream cost |
| Developer platforms | Terraform license | State and provider compatibility validation during migration |
| AI infrastructure | Accelerator scarcity, MCP | Time to capacity, useful utilization, agent runtime |
| Private cloud and virtualization | VMware subscriptions | Phased migration of a bounded workload and platform coexistence |

The table describes teaching examples, not recommendations for all companies. Each specific choice goes through all seven steps.

<!-- quiz -->
? Eight target companies praised the offer in interviews, but none provided data for assessment. What does this mean under the test card?
+ The hypothesis is unconfirmed: the criteria were data and a pilot || Compliments are not agreement to an assessment.
- The hypothesis is confirmed because all eight showed strong interest in the offer || Interest was not the criterion.
- Launch a campaign across the whole market immediately to find companies that will provide data || First revisit the offer or the window.
? Why can avoided losses not be added to direct savings when calculating customer benefit?
- Because losses cannot be valued in money under any circumstances || They can be estimated through a scenario with a probability.
+ Avoided losses are probabilistic and should be shown as a separate scenario with an explicit probability || Cash savings and avoided risk are different quantities.
- Because customers distrust loss estimates and lose trust in the whole calculation || The issue is the nature of the quantity.
? The incumbent restored an acceptable license. What should happen to the strategy built on the license change?
- Continue the campaign because customers will still remember the earlier grievance || The trigger is gone; the thesis needs review.
- Switch to another license to differ from the incumbent again || This is unrelated to validating the window.
+ A predefined stop criterion has been met: revisit the thesis or stop || Stop criteria are recorded before launch.
<!-- /quiz -->

<!-- section: task | Exercise: a market opportunity memo -->
Complete the exercise in the document on this page. Take an event from the dossiers in previous lessons, or, if you have no customer data of your own, use the lesson’s Oracle migration example, replacing two or three assumptions with your own, such as the support price, migration cost or share of migrated procedures, and work through the seven steps: event and deadline, consequence chain, affected customer companies and each company’s reason to act, three hypotheses, packaged offer, benefit calculation for one customer, and stop criteria. Fill in a test card with thresholds and a date. End with a decision: launch a pilot, scale, or stop, and why.

<!-- section: sources -->
- Simon Wardley. Finding a path — https://medium.com/wardleymaps/finding-a-path-cdb1249078c0 (2016)
- FinOps Foundation, unit economics — https://www.finops.org/framework/capabilities/unit-economics/ (checked 25.11.2026)
- Strategyzer, Testing Business Ideas — https://www.strategyzer.com/library/testing-business-ideas-book-summary
- Alexander Osterwalder. Validate your ideas with the Test Card — https://www.strategyzer.com/library/validate-your-ideas-with-the-test-card (05.03.2015)
