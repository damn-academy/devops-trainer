<!-- lesson: marketing.cases | Case studies: how open-source infrastructure companies found buyers | 24 -->
<!-- section: hook -->
Before its IPO GitLab spent 122% of its revenue on sales and marketing, HashiCorp spent 74%, and both companies were unprofitable for years. Supabase spent almost nothing on acquisition when an outside user posted it on Hacker News and 30,000 visitors arrived in a week, but the platform could not handle the load. Docker became an industry standard and still struggled to make money from it for a long time, while one failed pricing announcement had to be reversed ten days later. This lesson examines how seven companies turned the spread of an open product into buyers, what it cost them and what a small company can repeat.

<!-- section: theory | What to count in other companies' stories -->
Public companies report sales and marketing expenses in one line, which includes the salaries of salespeople, presales engineers and marketing staff, and even free plans: GitLab, for example, assigns the cost of free GitLab.com to it. This line's share of revenue therefore shows what the entire path to the buyer costs the company, but not its advertising budget. Private companies do not disclose their expenses and report on themselves. Above all, growth after a marketing decision does not prove that the decision caused the growth. None of the companies below has published how much revenue a particular conference or launch week generated.

<!-- section: theory | HashiCorp and GitLab: a free product and expensive sales to organisations -->
HashiCorp described its path in three words — adopt, land, expand. An engineer installs Terraform or Vault independently, proves its value within their team, and the organisation then buys standardisation, control and support through salespeople. Free distribution made the first step cheap, but the rest proved expensive: sales and marketing expenses were 74% of revenue in fiscal 2020, 84% in 2022 and 63% in 2024, while the annual loss in 2024 was $254 million. Meanwhile, the number of customers paying more than $100,000 a year grew from 798 to 897 in a year.

GitLab built its marketing around who buys. The free plan serves the developer, Premium serves the team, and Ultimate serves the organisation with security requirements; each tier has its own message and buyer. The public company handbook served as a description of processes, recruitment material and evidence of how the company operates, although its contribution to sales has not been measured separately. Sales and marketing expenses fell from 122% of revenue in fiscal 2020 to 46% in 2026, and the number of customers spending more than $100,000 a year grew to 1,456. When GitLab removed inexpensive plans in 2021 and raised Premium from $19 to $29 in 2023, users complained publicly, but it did not disclose the share who left.

The useful sequence for a small company is a free product an engineer can first evaluate independently, followed by selling to organisations that already use it. But do not build an international sales department before deals become repeatable or treat a public company's expenses as the norm for your budget: both companies lived on outside funding.

<!-- section: theory | Grafana Labs: community, free cloud and its own conference -->
Grafana connects to any data source, so it can be installed without replacing the rest of the stack, and this is its main distribution channel. In January 2021 the company introduced a generous free Grafana Cloud plan to remove the choice between a complex self-hosted installation and an expensive cloud service; by April 2022 it reported 900,000 active installations and 10 million users. These are distribution metrics; according to the company, paying customers were fewer: more than 5,000 in August 2024 and more than 10,000 in August 2026, with annual revenue above $600 million.

Grafana uses its GrafanaCON conference as a venue for product releases, training and user stories; the acquisition of k6 in 2021 was announced at the online GrafanaCONline conference, while it holds a separate ObservabilityCON for a broader audience. The first GrafanaCon in 2015 brought together a hundred people for one day. The company does not publish how much revenue the conference generated, so the connection is what to borrow from this story; event size is secondary: the conference shows users' real work and product releases, and recordings are then placed in the documentation. A generous free cloud plan will cost a small provider without scale or protection against abuse too much.

<!-- section: theory | Supabase and Neon: category, launch weeks and integration -->
From the start, Supabase explained itself through a familiar category: an open-source Firebase alternative on Postgres. In summer 2020 an outside user posted about it on Hacker News; in one week it attracted 30,000 visitors and more than 1,400 signups, followed by more than a thousand databases. The platform was not ready for that load, and the team published an account of what broke; this open analysis itself became material engineers trust. In March 2021 Supabase held its first launch week, announcing one finished improvement each day, and made the format recurring. It gives a reason to show completed work, provided the improvements are ready when announced.

Since December 2025 Supabase has also spread through other products: platforms such as Lovable and Bolt.new create Supabase databases for their users through an API. By June 2026 the company reported almost 10 million developers and said AI tools created more than 60% of new databases. Neon took the same path earlier: in 2023 it chose integration into Vercel, Replit and other platforms, and in 2025, when agents were creating more than 80% of new databases, it agreed to be sold to Databricks for roughly a billion dollars. Signups and databases created are not paying customers, and integration makes the company dependent on a partner; decide in advance who pays for free consumption and who owns the relationship with the end user.

<!-- section: theory | Docker and Elastic: when the brand and message work against the company -->
Docker became the container standard but spent a long time spreading itself thin between developer tools and enterprise orchestration; in 2019 the enterprise business was sold to Mirantis and the company focused on Docker Desktop and Docker Hub. In 2021 Desktop became paid for large organisations, and by January 2023 annual revenue had grown to $135 million. In March 2023 Docker announced the closure of its Free Team plan, saying this affected fewer than 2% of users. Its first explanation came down to a poor announcement, but ten days later the CEO acknowledged that the decision itself was wrong and reversed it: images used by many people depended on those users. Marketing cannot fix a decision that is bad for the community, and this needs to be understood before the announcement.

In 2021 Elastic changed its licence, explaining that AWS was using the Elasticsearch brand and contributing little to the project. AWS responded with the OpenSearch fork, with its own brand, roadmap and community, and in 2022 the companies settled the trademark dispute. In 2024 Elastic added the AGPL licence for the open portion of the code, and Shay Banon wrote that Elasticsearch was open source again. The company's return to the word “open” shows that belonging to open-source projects had value for its buyers. A small company should borrow the practice of deciding code and brand questions separately.

<!-- section: theory | What transfers to a small company -->
The seven stories suggest several conditions. A free product brings buyers when an engineer can independently get a result and their organisation has a separate task it will pay for; but the path from user to deal costs money, and that money needs counting. A familiar category quickly explains a new product if a working demonstration immediately shows the difference. Launch weeks and your own conference help when finished work stands behind them and the recordings are then placed in documentation. Integration into other platforms lowers acquisition costs and creates dependence. An announcement about a paid change to a free product should first be tested with those who depend on it.

All these stories contain survivorship bias: we see companies that grew and do not see those that did the same thing and closed. So borrow the conditions and questions; your results will be your own.

<!-- quiz -->
? Before its IPO GitLab spent more than its entire revenue on sales and marketing. What follows from this for a small company?
+ The path from a free product to a deal costs money, and those expenses need to be planned in advance || GitLab and HashiCorp were unprofitable for years and lived on outside funding.
- An open product does not pay off, so a small company needs to close its code and sell licences from day one || Both companies grew to hundreds of millions of dollars in revenue; the expensive part was the path to the buyer, not open source.
- A small company must spend as much on sales as GitLab or it will never grow to the same size || A public company's expenses cannot be treated as the norm for a small one; GitLab lived on outside funding.
? A post about Supabase on Hacker News brought 30,000 visitors in a week. What went wrong, and what did the company do?
+ The platform could not handle the load, and the team openly examined what broke || The public analysis of the failure became material engineers trust.
- Visitors did not sign up because the post was not published by the company itself || There were more than 1,400 signups in a week, followed by more than a thousand databases.
- Hacker News moderators removed the post for self-promotion, and the company had to launch again || The post was not removed; an outside user published it.
? Docker closed a free plan and reversed the decision ten days later. What follows from this for marketing?
+ Marketing cannot fix a decision that is bad for the community, and this must be checked before the announcement || The CEO acknowledged that the decision itself was wrong, not just the announcement.
- Announcements of paid changes should be released on Friday evening so the reaction has time to die down by Monday || The timing of the announcement does not change the fact that the decision harms dependent users.
- Plan changes should be kept secret until they take effect so users have no time to protest || A concealed change creates even greater distrust when it is discovered.
<!-- /quiz -->

<!-- section: task | Task: examine one competitor's decision -->
Complete the task in the document on this page. Choose a company in your category that has made a notable marketing or commercial move in the past two years: changed its plans, launched a cloud service, held its own conference or integrated into another platform. Describe it using the lesson's framework: what the company did and how it explained it; what it cost, if known from reports or statements; what happened afterwards and which numbers it published; which of these numbers actually says something about the result and which only about distribution; what you could repeat from this move at your size and what you cannot.

<!-- section: sources -->
- HashiCorp, S-1/A prospectus — https://www.sec.gov/Archives/edgar/data/1720671/000119312521342246/d205906ds1a.htm (29.11.2021)
- HashiCorp, fiscal 2024 annual report — https://www.sec.gov/Archives/edgar/data/1720671/000114036124025955/ny20021845x3_ars.pdf (31.01.2024)
- HashiCorp, fiscal 2024 results — https://www.globenewswire.com/news-release/2024/03/05/2840892/0/en/hashicorp-announces-fourth-quarter-and-fiscal-year-2024-financial-results.html (05.03.2024)
- GitLab, S-1/A prospectus — https://www.sec.gov/Archives/edgar/data/1653482/000162828021019971/gitlab-sx1a3.htm (12.10.2021)
- GitLab, feature tiering guidance — https://handbook.gitlab.com/handbook/product/product-processes/tiering-guidance-for-features/ (checked 25.11.2026)
- GitLab, fiscal 2026 annual report — https://www.sec.gov/Archives/edgar/data/1653482/000165348226000087/a2026gitlabars.pdf (31.01.2026)
- GitLab, Premium update — https://about.gitlab.com/blog/gitlab-premium-update/ (02.03.2023)
- Grafana Labs, new Grafana Cloud plans — https://grafana.com/blog/the-new-grafana-cloud-the-only-composable-observability-stack-for-metrics-logs-and-traces-now-with-free-and-paid-plans-to-suit-every-use-case/ (13.01.2021)
- Grafana Labs, Series D round — https://grafana.com/press/2022/04/06/grafana-labs-announces-240-million-investment-round-led-by-gic-and-welcomes-new-investor-j-p--morgan/ (06.04.2022)
- Grafana Labs, $250 million in annual revenue — https://grafana.com/press/2024/08/21/grafana-labs-soars-past-250m-arr-and-5000-customers-completes-270m-primary-and-secondary-transaction-and-named-a-leader-in-the-gartner-magic-quadrant-for-observability-platforms/ (21.08.2024)
- Grafana Labs, 10,000 customers — https://grafana.com/press/2026/08/26/grafana-labs-crosses-10000-customer-milestone-as-ai-adoption-accelerates-growth-across-the-platform/ (26.08.2026)
- Grafana Labs, k6 a year after acquisition — https://grafana.com/blog/grafana-k6-one-year-later-lessons-learned-after-an-acquisition/ (07.10.2022)
- GrafanaCon, 2016 prospectus with 2015 results — https://www.grafanacon.org/2016/grafanacon_2016_prospectus.pdf (2016)
- Supabase, alpha launch postmortem — https://supabase.com/blog/alpha-launch-postmortem (10.07.2020)
- Supabase, first launch week — https://supabase.com/blog/launch-week (25.03.2021)
- Supabase for Platforms — https://supabase.com/blog/introducing-supabase-for-platforms (05.12.2025)
- Supabase, Series F round — https://supabase.com/blog/supabase-series-f (04.06.2026)
- Neon, Series B round — https://neon.com/blog/series-b-funding (02.08.2023)
- Neon, joining Databricks — https://neon.com/blog/neon-and-databricks (14.05.2025)
- Docker, new company direction — https://www.docker.com/press-release/docker-new-direction/ (13.11.2019)
- Sacra, Scott Johnston interview — https://sacra.com/research/scott-johnston-docker-plg-pivot/ (13.01.2023)
- Docker, apology for the Free Team announcement — https://www.docker.com/blog/we-apologize-we-did-a-terrible-job-announcing-the-end-of-docker-free-teams/ (16.03.2023)
- Docker, reversal of the Free Team closure — https://www.docker.com/blog/no-longer-sunsetting-the-free-team-plan/ (24.03.2023)
- Elastic, why the licence changed — https://www.elastic.co/blog/why-license-change-aws (19.01.2021)
- AWS, OpenSearch announcement — https://aws.amazon.com/blogs/opensource/introducing-opensearch/ (12.04.2021)
- Elastic, Elasticsearch is open source again — https://www.elastic.co/blog/elasticsearch-is-open-source-again/ (29.08.2024)
