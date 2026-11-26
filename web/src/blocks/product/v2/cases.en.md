<!-- lesson: product.cases | Company case studies: decisions, costs and consequences | 30 -->
<!-- section: hook -->
HashiCorp gave Terraform away for free and by fiscal 2024 was earning $583 million in revenue, but spent 63% of that amount on sales and marketing and was still losing $254 million a year. In August 2023 it moved future releases to the BSL licence, a month later the OpenTofu fork appeared, and in February 2025 IBM bought the company for $6.4 billion. It is easy to take away a slogan such as “changing the licence kills a company” or “open source pays off”, and both would be wrong. This lesson examines eight companies using the same framework: what they decided, what it cost, what happened next, what worked, what did not, and what a company of twenty to sixty people can repeat.

<!-- section: theory | How to read the case studies -->
Before applying someone else's experience, let us agree on three things. First, something happening after a decision does not prove it happened because of it. Elastic's revenue kept growing after the licence change, but that does not mean the licence change caused the growth. Second, revenue, annual recurring revenue (ARR) and investment raised are different numbers and cannot stand in for one another. Third, the share of revenue spent on sales and marketing in public company reports includes salespeople's salaries, free plans and much more, so it is not an advertising budget. GitLab, for example, includes the cost of free GitLab.com in this line.

Public companies report to the stock market, and auditors check their numbers. Private companies such as Grafana Labs, Supabase and Neon report on themselves, and their numbers should be read as claims. Below, the origin of every figure is stated.

<!-- section: theory | HashiCorp: a free tool as the entry point to an expensive enterprise sale -->
HashiCorp described its mechanism in three words: adopt, land, expand. An engineer independently chooses Terraform or Vault and proves its value within their team, and the organisation then buys standardisation, control and support. In December 2014 the company launched the commercial Atlas platform, which later became Terraform Enterprise. In 2016 it brought in Dave McJannet as CEO and began building enterprise sales. By the end of fiscal 2021 it had 500 customers each generating more than $100,000 in annual revenue, and average net revenue from existing customers was growing by 123% a year. In June 2020 it announced the HCP cloud platform to take operations off customers' hands, and cloud revenue grew from $18.6 million in fiscal 2022 to $76.1 million in fiscal 2024.

The cost of this model is visible in the reports. Sales and marketing expenses were 74% of revenue in fiscal 2020, 84% in 2022 and 63% in 2024; the company was unprofitable throughout. Net revenue retention fell from 131% in January 2023 to 115% a year later, but it was already 124% in July 2023, before the licence change, so the entire decline cannot be attributed to the licence. The licence change in August 2023 spawned OpenTofu under the Linux Foundation, which released its first stable version on 10 January 2024; this is a proven consequence. The claim that the fork destroyed sales is not supported by the reports.

A company of twenty to sixty people can borrow the separation between a free working scenario for the engineer and a paid control task for the organisation, and turn security and procurement requests into a repeatable package. What it should not copy is a broad product portfolio and an international sales department before sales become repeatable, or a licence change as a substitute for a competitive advantage: if companies already make money around the project, they can fund a fork.

<!-- section: theory | GitLab: tiers based on who pays -->
GitLab divides its product by buyer. The free plan serves the individual developer, Premium serves the team and its manager, and Ultimate serves the organisation with security and compliance requirements. The company's guidance recommends assigning a feature to a tier according to who has the greatest interest in it. GitLab released its enterprise edition in July 2013 and the Ultimate tier at $99 per seat per month in 2018. Before the IPO, in January 2021, it had 283 customers generating more than $100,000 a year, and revenue from existing customers was growing by 148% a year because they bought more seats and moved to higher tiers.

The cost of this model lies in expenses and the pricing ladder. In fiscal 2020 GitLab spent 122% of revenue on sales and marketing, in 2021 it spent 101%, and by 2026 the share had fallen to 46%. In January 2021 it removed the inexpensive Bronze and Starter plans, and for small teams the price rose from $4 per seat to $19 for Premium after transitional discounts expired. In April 2023 Premium itself rose from $19 to $29. Users complained publicly, but the company did not disclose the share that left. Revenue retention from existing customers declined: 130% in 2024, 118% in 2026, showing that expansion within customers slows over time even at a successful company.

The rule to borrow is this: before placing a feature behind a paid tier, write down who uses it, who pays for it and what business task it solves. Before raising prices, calculate how actual customers' bills will change, provide a transition period and a path for teams that do not need the whole package. Do not mechanically remove an inexpensive tier: the company may lose future internal advocates in small teams.

<!-- section: theory | Grafana Labs: customers pay for operations, the code stays open -->
Grafana connects to other vendors' data sources, so it can be installed without changing everything else. The company earns money from enterprise features and support in Grafana Enterprise and from operations in Grafana Cloud. In January 2021 Grafana Cloud gained a generous free plan: 10,000 time series, 50 gigabytes of logs, 14 days of retention and three users, with the paid plan starting at $49 a month. In April 2021 Grafana, Loki and Tempo moved from Apache to AGPL; CEO Raj Dutt explained that the aim was to remain an open-source project under the OSI definition while keeping the business sustainable. Unlike BSL and SSPL, AGPL does not prohibit competitors from offering a cloud service.

According to the company, annual revenue exceeded $250 million in August 2024, $400 million in September 2025 and $600 million in August 2026, with more than 10,000 customers. These are claims by a private company, but they refute the idea that a large business necessarily requires closing the source code. They do not prove that AGPL caused the growth. Separately, Grafana bought adjacent teams — k6 in 2021, Pyroscope and Asserts.ai in 2023 — and when it bought Pyroscope it merged it with its own Phlare project rather than keeping two similar projects.

A small company should borrow integration with the stack the customer already has, a free allowance sufficient for a first result, and charging for real operational complexity. A generous free cloud plan without scale or protection against abuse costs a small provider more than it costs Grafana.

<!-- section: theory | Elastic and MongoDB: protection from clouds and paid operations -->
In January 2021 Elastic replaced the Apache licence for Elasticsearch and Kibana with the Elastic License and SSPL; founder Shay Banon attributed this to AWS's behaviour, its use of the brand and the cloud provider's limited contribution to the project. In April 2021 AWS announced the Apache-licensed OpenSearch fork, and it reached production release in July. In February 2022 the companies settled their trademark dispute. In August 2024 Elastic added an AGPL option for the open portion of the source code so it could again call itself an open-source project; this was not a return to Apache, and ready-made distributions remained under the Elastic License. In fiscal 2026 Elastic's revenue was $1.74 billion, of which cloud accounted for 48%, while sales and marketing were 41% of revenue. Defending against AWS created a lasting competitor that already owns the cloud procurement channel, and bringing back AGPL did not remove that competitor.

In 2016 MongoDB launched Atlas, a cloud service that handles database provisioning, upgrades, backups and recovery. In October 2018 it moved the server to SSPL, which the OSI does not recognise as open source, explaining that cloud providers should return their service's code to the community. In January 2019 AWS released the interface-compatible DocumentDB; the licence did not stop it. Atlas's share of revenue grew from 32% in early 2019 to 73% in fiscal 2026, and the company says its gross margin declines as that share grows because cloud requires infrastructure. These two stories suggest that selling work the customer wants to get rid of is more reliable than prohibiting someone else's service, and that a cloud service changes the economics: cloud margins cannot be calculated in the same way as subscription sales margins.

<!-- section: theory | Supabase and Neon: a familiar category and integration into other platforms -->
Supabase explained itself through a familiar category, calling itself an open-source Firebase alternative on Postgres. In summer 2020 an outside user posted about it on Hacker News; in a week it attracted 30,000 visitors and more than 1,400 signups, and the immature platform faced a load it was not ready for; the team publicly examined what broke. In March 2021 the company held its first launch week, announcing one finished improvement each day, and made the format recurring. In December 2025 Supabase launched a programme in which platforms such as Lovable and Bolt.new create Supabase projects for their users through an API. By June 2026 the company reported almost 10 million developers and said AI tools created more than 60% of new databases. In a 2026 interview, founder Paul Copplestone acknowledged that he had kept the team small for too long and people were overloaded. Signups and automatically created databases cannot be counted as paying customers.

Neon made a narrow bet: familiar Postgres with storage and compute separated, instant database branching and suspension when idle. In August 2023 it chose a path through integration into Vercel, Replit and other platforms. By May 2025, according to the company, AI agents were creating more than 80% of new databases, and that same month Neon agreed to join Databricks for roughly a billion dollars. After the deal it reduced compute prices by 15–24%. The acquisition confirms the technology's value to the buyer, but proves neither Neon's profitability nor its revenue.

Integration into other platforms removes some acquisition costs but creates dependence: decide in advance who pays for abuse, who owns the relationship with the end customer and what happens if the partner leaves. A launch week should consist only of finished improvements; otherwise the team releases an unfinished database to meet a marketing date.

<!-- section: theory | Docker: an industry standard and difficult monetisation -->
Docker became the container standard but struggled to make money for a long time. Until 2019 it developed developer tools and enterprise orchestration simultaneously; its CEO later called this a lack of focus. In November 2019 the enterprise business was sold to Mirantis, the company was relaunched with $35 million from existing investors, and it focused on Docker Desktop and Docker Hub. In August 2021 Docker Desktop became paid for large organisations: it remained free for companies with fewer than 250 employees and less than $10 million in revenue, and the container engine remained open. In February 2022 annual revenue exceeded $50 million, four times the previous year's figure, and in January 2023 it reached $135 million.

In March 2023 Docker announced the closure of its Free Team plan; it said this affected fewer than 2% of users, but those users maintained images on which many others depended. Ten days later, on 24 March, it reversed the decision, the CEO acknowledged that both the announcement and the decision itself were wrong, and those who had bought a paid plan during those days were refunded. This case shows that sometimes the decision itself needs correcting, and better announcement copy would not have saved it. Before changing a free plan, find out who depends on it beyond those who pay.

<!-- section: theory | What transfers to a company of twenty to sixty people -->
The eight stories suggest conditions under which each choice makes sense. Selling to organisations on top of a free product works when an engineer can independently prove its value and the organisation has a separate control and risk task it will pay for. A cloud service makes sense when operations are a real customer pain, and requires calculating costs, support load and margins after free consumption. Buyer-based tiers work when teams and organisations have different tasks and budgets. Integration into other platforms requires agreement on who pays for free consumption. A licence change should be considered only after answering who will fund a fork and what advantage you will retain afterwards.

All these stories contain survivorship bias: we examine companies that grew and do not see those that closed after making the same decisions. So take conditions and questions from the cases; your results will be your own.

<!-- quiz -->
? From January 2023 to January 2024, HashiCorp's net revenue retention fell from 131% to 115%; the licence change in August 2023 fell within this period. What can be said about the link between these events?
+ The link is not proven: retention was already 124% a month before the licence change, and the decline had begun earlier || HashiCorp's reports show a decline before August 2023 too, so it cannot be attributed to the licence.
- The licence change caused the decline because customers immediately switched to the OpenTofu fork || OpenTofu released its first stable version only in January 2024, while retention was declining before the licence change.
- There is no link because enterprise customers do not follow product licences || Customers do follow them, but the reports do not allow the licence's effect to be separated from other causes.
? What made AWS's response to the Elasticsearch licence change dangerous for Elastic?
+ A competitor emerged with its own brand, roadmap and community, already sold through the AWS cloud || OpenSearch launched in 2021, and bringing back AGPL in 2024 did not undo it.
- AWS won the trademark lawsuit and prohibited Elastic from selling its cloud service on its platform || The companies settled the dispute in 2022, and there was no prohibition.
- Elastic customers left for OpenSearch en masse, and the company's revenue halved in two years || Elastic's revenue continued to grow; it did not disclose the share of customers who left.
? Docker closed a free plan affecting fewer than 2% of users and reversed the decision ten days later. What does this case teach?
+ The share of accounts affected is not the scale of the harm: many people used images that depended on them || The company itself acknowledged that both the announcement and the decision were wrong.
- Pricing announcements need better writing because users did not understand that the decision would affect only a few || The CEO acknowledged that the decision itself was wrong, not just the announcement text.
- Free plans must never be changed because any change provokes user outrage || Docker had previously made Desktop paid for large companies, and that decision remained in place.
<!-- /quiz -->

<!-- section: task | Task: a decision following the case-study framework -->
Complete the task in the document on this page. Choose one decision your company is about to make or recently made: change a licence, introduce or remove a tier, launch a cloud service, integrate into another platform. If there is no such decision, use the fictional company Stratova, which is considering removing multi-cluster management from the free version of its private-cloud platform. Describe it using the lesson's framework: what you are deciding and why; what it will cost, including what you will lose; which of the eight cases is closest and how your conditions differ; what will happen if the decision does not work and how you will reverse it; which number in six months will show that the decision was right, and why that number cannot be explained by other causes.

<!-- section: sources -->
- HashiCorp, S-1/A prospectus — https://www.sec.gov/Archives/edgar/data/1720671/000119312521342246/d205906ds1a.htm (29.11.2021)
- HashiCorp, Vagrant Push and Atlas — https://www.hashicorp.com/id/blog/vagrant-push-one-command-to-deploy-any-application (12.12.2014)
- HashiCorp, fiscal 2024 annual report — https://www.sec.gov/Archives/edgar/data/1720671/000114036124025955/ny20021845x3_ars.pdf (31.01.2024)
- HashiCorp, fiscal 2024 results — https://www.globenewswire.com/news-release/2024/03/05/2840892/0/en/hashicorp-announces-fourth-quarter-and-fiscal-year-2024-financial-results.html (05.03.2024)
- HashiCorp, HCP announcement — https://www.hashicorp.com/en/resources/hashiconf-digital-keynote-hashicorp-cloud-platform-announcement (22.06.2020)
- HashiCorp, adoption of the Business Source License — https://www.hashicorp.com/en/blog/hashicorp-adopts-business-source-license (10.08.2023)
- Linux Foundation, OpenTofu general availability — https://www.linuxfoundation.org/press/opentofu-announces-general-availability (10.01.2024)
- IBM, completion of the HashiCorp acquisition — https://newsroom.ibm.com/2025-02-27-ibm-completes-acquisition-of-hashicorp%2C-creates-comprehensive%2C-end-to-end-hybrid-cloud-platform (27.02.2025)
- GitLab, S-1/A prospectus — https://www.sec.gov/Archives/edgar/data/1653482/000162828021019971/gitlab-sx1a3.htm (12.10.2021)
- GitLab, feature tiering guidance — https://handbook.gitlab.com/handbook/product/product-processes/tiering-guidance-for-features/ (checked 25.11.2026)
- GitLab, new subscription model — https://about.gitlab.com/blog/new-gitlab-product-subscription-model/ (26.01.2021)
- GitLab, Premium update — https://about.gitlab.com/blog/gitlab-premium-update/ (02.03.2023)
- GitLab, fiscal 2026 annual report — https://www.sec.gov/Archives/edgar/data/1653482/000165348226000087/a2026gitlabars.pdf (31.01.2026)
- GitLab, fiscal 2025 annual report — https://www.sec.gov/Archives/edgar/data/1653482/000162828025021579/arsedgargitlabform10k.pdf (31.01.2025)
- Grafana Labs, new Grafana Cloud plans — https://grafana.com/blog/the-new-grafana-cloud-the-only-composable-observability-stack-for-metrics-logs-and-traces-now-with-free-and-paid-plans-to-suit-every-use-case/ (13.01.2021)
- Grafana Labs, licensing — https://grafana.com/licensing/ (20.04.2021)
- Grafana Labs, relicensing Q&A — https://grafana.com/blog/qa-with-our-ceo-on-relicensing/ (21.04.2021)
- Grafana Labs, Pyroscope acquisition — https://grafana.com/press/2023/03/15/grafana-labs-acquires-pyroscope-the-company-behind-the-popular-open-source-continuous-profiling-project/ (15.03.2023)
- Grafana Labs, $250 million in annual revenue — https://grafana.com/press/2024/08/21/grafana-labs-soars-past-250m-arr-and-5000-customers-completes-270m-primary-and-secondary-transaction-and-named-a-leader-in-the-gartner-magic-quadrant-for-observability-platforms/ (21.08.2024)
- Grafana Labs, $400 million in annual revenue — https://grafana.com/press/2025/09/30/grafana-labs-surpasses-400m-arr-and-7000-customers-gains-new-investors-to-accelerate-global-expansion/ (30.09.2025)
- Grafana Labs, 10,000 customers — https://grafana.com/press/2026/08/26/grafana-labs-crosses-10000-customer-milestone-as-ai-adoption-accelerates-growth-across-the-platform/ (26.08.2026)
- Elastic, why the licence changed — https://www.elastic.co/blog/why-license-change-aws (19.01.2021)
- AWS, OpenSearch announcement — https://aws.amazon.com/blogs/opensource/introducing-opensearch/ (12.04.2021)
- Elastic, trademark agreement with Amazon — https://www.elastic.co/blog/elastic-and-amazon-reach-agreement-on-trademark-infringement-lawsuit (16.02.2022)
- Elastic, Elasticsearch is open source again — https://www.elastic.co/blog/elasticsearch-is-open-source-again/ (29.08.2024)
- Elastic, fiscal 2026 annual report — https://s206.q4cdn.com/471820867/files/doc_earnings/2026/q4/general/d5574c72-32de-498a-aa4a-f6c4fcb4b9ab.pdf (08.06.2026)
- MongoDB, Atlas launch — https://www.mongodb.com/company/newsroom/press-releases/mongodb-unveils-mongodb-atlas-the-new-industry-standard-for-database-as-a-service (28.06.2016)
- MongoDB, adoption of SSPL — https://www.mongodb.com/company/newsroom/press-releases/mongodb-issues-new-server-side-public-license-for-mongodb-community-server (16.10.2018)
- AWS, DocumentDB launch — https://aws.amazon.com/blogs/aws/new-amazon-documentdb-with-mongodb-compatibility-fast-scalable-and-highly-available/ (09.01.2019)
- MongoDB, fiscal 2019 results — https://investors.mongodb.com/news-releases/news-release-details/mongodb-inc-announces-fourth-quarter-and-full-year-fiscal-2019 (13.03.2019)
- MongoDB, fiscal 2026 annual report — https://investors.mongodb.com/static-files/e3ad1373-2bbc-45a5-8e7d-b403e607fb82 (11.03.2026)
- Supabase, alpha launch postmortem — https://supabase.com/blog/alpha-launch-postmortem (10.07.2020)
- Supabase, first launch week — https://supabase.com/blog/launch-week (25.03.2021)
- Supabase for Platforms — https://supabase.com/blog/introducing-supabase-for-platforms (05.12.2025)
- Supabase, Series F round — https://supabase.com/blog/supabase-series-f (04.06.2026)
- First Round, Paul Copplestone interview — https://review.firstround.com/how-supabase-became-the-essential-infrastructure-for-the-ai-era-paul-copplestone-co-founder-ceo/ (25.06.2026)
- Neon, Series B round — https://neon.com/blog/series-b-funding (02.08.2023)
- Neon, joining Databricks — https://neon.com/blog/neon-and-databricks (14.05.2025)
- TechTarget, billion-dollar Neon acquisition — https://www.techtarget.com/news/Databricks-adds-Postgres-database-with-1B-Neon-acquisition/842561/ (14.05.2025)
- Neon, compute price reduction — https://neon.com/blog/major-compute-price-reduction-on-neon (03.11.2025)
- Docker, new company direction — https://www.docker.com/press-release/docker-new-direction/ (13.11.2019)
- Docker, Docker Desktop subscription changes — https://docs.docker.com/docker-hub/release-notes/ (31.08.2021)
- Docker, second fiscal year results — https://www.docker.com/blog/celebrating-our-second-fiscal-year/ (01.02.2022)
- Sacra, Scott Johnston interview — https://sacra.com/research/scott-johnston-docker-plg-pivot/ (13.01.2023)
- Docker, reversal of the Free Team closure — https://www.docker.com/blog/no-longer-sunsetting-the-free-team-plan/ (24.03.2023)
