<!-- lesson: events.map | Mapping events and calculating whether an event paid off | 18 -->
<!-- section: hook -->
A company took a booth at a major conference, returned with six hundred scanned badges, and reported “600 leads” to its board. Six months later, it turned out that forty of those six hundred people worked at companies matching the buyer profile, twelve had agreed to a call, and the two deals that sales attributed to the conference had started before it. This course covers how to choose events, how to work at them, and how to measure results without misleading yourself. The first lesson maps the different types of events and provides a way to calculate whether an event paid off.

<!-- section: theory | Your own and others' events, online and in person -->
An infrastructure company's events can be mapped along two axes. The first separates your own events from others' events: you organize your own events and decide whom to invite and what to show; at others' events, you are a guest, speaker, or sponsor and follow the organizer's rules. The second separates online events from in-person events: online events cost less and bring together people from different countries, while in-person events cost more but allow personal conversations that make people respond to your emails afterward.

This gives four groups. Your own online events include webinars and online workshops with labs. Your own in-person events include meetups, local workshops, dinners, and roundtables. Others' online events include foundations' online programs, partner webinars, and virtual conferences such as PlatformCon or POSETTE for PostgreSQL users. Others' in-person events include major cloud provider conferences (AWS re:Invent, Google Cloud Next, Microsoft Ignite), industry conferences (KubeCon, PGConf, SREcon, RSAC, NANOG, Open Source Summit), community events (FOSDEM, DevOpsDays, BSides, community days), vendor user conferences (Snowflake Summit, Data + AI Summit, Datadog DASH, ObservabilityCON), and meetups where your company gives a talk.

Each group offers something different. A talk at someone else's conference builds credibility and produces a recording that remains useful for years. A booth provides many short conversations over three days. Your own meetup builds relationships with local engineers. A dinner with executives allows a conversation about money and risk that would not happen at a booth. A webinar provides a recording and a list of people who spent an hour on the topic.

<!-- section: theory | Different events have different rules -->
Sponsors' and speakers' rights vary significantly between events and must be checked in each contract. DevOpsDays does not sell speaking slots: sponsors' employees submit proposals on the same terms as everyone else, and sponsors do not receive attendee lists. FOSDEM is a free, nonprofit event whose charter prohibits sponsorship from buying preferential treatment for talks, stands, or developer rooms. At KubeCon, sponsors receive contact details only for people whose badges they scanned at their booth; they do not receive the full attendee list. CNCF online programs do not share webinar viewers' contact details with companies. Scanned badges, webinar viewers, community members, and newsletter subscribers are four different datasets with different usage rights.

<!-- section: theory | How to measure results -->
Evaluate an event through verifiable steps: registration or invitation; attendance or a substantive booth conversation; agreement on a next step; a completed meeting; a sales-accepted opportunity; a closed deal. For a workshop, add lab completion and subsequent product use between these steps. Several employees from the same company represent one account and must not be counted as multiple opportunities.

Use two distinct financial metrics, and do not confuse them. Pipeline per dollar is the value of potential deals divided by the event's cost. Return on investment is the gross profit from deals originating at the event minus the cost, divided by the cost. To estimate whether an event will pay off, calculate this in advance: if the full event cost is C, gross profit per deal is G, and your typical opportunity win rate is W, breaking even requires C/G deals and C/(G×W) opportunities. For example, with a trip costing 40 000 dollars, profit per deal of 50 000 dollars, and one in five opportunities closing, the event must produce at least four opportunities. It is useful to know that number before buying a booth.

The full cost of an event exceeds the package price. The cheapest KubeCon Europe booth for startups that were CNCF members cost 12 000 dollars in 2026, but foundation membership, booth production, shipping, flights, hotels, staff time, demo infrastructure, and follow-up work all add to that amount. A 12 000-dollar booth becomes a campaign costing 30–50 thousand. Other venues have their own price ranges: at PGConf.EU 2026, an exhibitor table was included only in the 12 000-euro Gold package, while the 750-euro Bronze package offered no booth; Open Source Summit North America packages cost 10–90 thousand dollars; DevOpsDays Dallas sold badge lanyard sponsorship for 5 000 dollars and party sponsorship for 7 500 rather than booths.

Event results take time. In 2026, Dreamdata calculated an average of 281 days from the first LinkedIn ad impression to revenue; equally reliable data is not available for events, but this gives a sense of the timescale. Review event results after 30, 90, and 180 days rather than declaring failure after a week. To avoid attributing a deal to an event when it was already progressing, check which opportunities were in progress before the event.

<!-- section: task | Exercise: return-on-investment calculator -->
Complete the exercise in the “Event return on investment” simulator on this page. Set the full cost of a conference booth, including all expenses from the lesson, profit per deal, and your company's opportunity win rate. Check how many opportunities you need to break even. Then vary the share of scanned attendees who match your target audience, the share contacted within the first two days, and the share of meetings that took place. See which values make the booth pay off in most runs and which make it almost never pay off.

<!-- widget: events.roi -->

<!-- section: sources -->
- CNCF, 2026 sponsorship packages — https://events.linuxfoundation.org/wp-content/uploads/2025/12/sponsor-cncf-2026_120425.pdf (version 04.12.2025)
- DevOpsDays, information for sponsors — https://devopsdays.org/sponsor/ (checked 25.11.2026)
- FOSDEM, 2026 charter — https://archive.fosdem.org/2026/about/charter/
- CNCF, online program guidelines — https://github.com/cncf/foundation/blob/main/policies-guidance/online-programs-guidelines.md (checked 25.11.2026)
- Dreamdata, LinkedIn Ads Benchmarks 2026 — https://dreamdata.io/blog/announcing-linkedin-ads-benchmarks-report-2026 (10.03.2026)
- PGConf.EU 2026, sponsorship terms — https://2026.pgconf.eu/become-sponsor/
- Open Source Summit North America 2026, sponsorship packages — https://events.linuxfoundation.org/wp-content/uploads/2026/05/sponsor-oss-na26_051426.pdf (p. 8)
- DevOpsDays Dallas 2026, sponsorship — https://devopsdays.org/events/2026-dallas/sponsor
- KubeCon Europe 2025, transparency report — https://www.cncf.io/wp-content/uploads/2025/06/KubeCon_EU_25_TransparencyReport.pdf (June 2025)

<!-- lesson: events.portfolio | Event portfolio: where to meet the right role | 26 -->
<!-- section: hook -->
For the third year in a row, a PostgreSQL tools vendor bought a booth at the largest cloud conference because “everyone is there.” Each time, it returned with hundreds of scans and almost no conversations with the database administrators who actually bought its product. When the team finally examined the audience, it found that those same people gathered at PGConf.EU, PGConf.dev, and local PostgreSQL user groups, where an exhibitor table cost a fraction of the price and people listened to a migration talk from start to finish. The industry's main conference is not always where your buyers are. This lesson teaches you to build an event portfolio from your customer profile; the list of famous conferences is only raw material for selection.

<!-- section: theory | Mapping venues beyond a single ecosystem -->
An infrastructure company's venues fall into four classes.

Major cloud provider and vendor conferences attract tens of thousands of people. Google Cloud Next 2026 attracted more than 32 thousand executives, developers, and partners, AWS re:Invent 2025 drew 60 thousand, and Cisco Live in San Diego in 2025 drew 22 thousand. Eligibility to buy a re:Invent package depends on AWS partner program status. At such events, access to the provider's ecosystem and joint selling matter more to a vendor than booth foot traffic.

Independent and industry conferences gather people in one profession. Open Source Summit North America together with Embedded Linux Conference in 2026 drew 1 231 attendees from 524 organizations and 41 countries, and is useful for storage, Linux, edge systems, and hardware. PGConf.EU brings together database administrators and developers working on migrations. SREcon attracts reliability engineers who care about databases, content delivery networks, storage, and monitoring regardless of Kubernetes. RSAC 2026 drew more than 43 500 people: security specialists, security executives, buyers, and investors. NANOG 96 in February 2026 drew 806 network engineers, operators, and peering specialists. KubeCon + CloudNativeCon Europe in Amsterdam in 2026 registered 13 414 people from 3 644 companies. FOSDEM gathers developers and maintainers but has no buyer meeting program.

Vendor user conferences bring together the installed base of one stack: Snowflake Summit, Databricks' Data + AI Summit, Datadog DASH, Grafana's ObservabilityCON, MongoDB.local, Confluent Current, and HashiConf, which became part of IBM TechXchange in 2026. For vendors of compatible tools, extensions, and migration services, this is direct access to users, but the organizer sets the rules, and the event is not a neutral overview of all vendors. At Snowflake Summit 2025, the simplest ready-made booth cost 55 thousand dollars.

Buyer conferences form a separate class. Gartner IT Infrastructure, Operations & Cloud Strategies in the US advertises more than 4 000 attendees and, according to the organizer's 2025 data, 50 % at director level or above and 89 % involved in technology purchasing. For storage, backup, private cloud, and observability, this is a place to meet budget owners.

Local communities are covered in the next lesson.

<!-- section: theory | How to evaluate an event -->
1. Define the role and action. For each product, list the user, technical evaluator, budget owner, and partner separately. An event has one main goal: for example, ten problem interviews, three technical evaluations, five meetings on active deals, or two joint integration plans. These outcomes must not be combined into a single “leads” metric.
2. Build a shortlist of 10–15 candidates based on customers' stacks. For each, record the city, audience role, target companies, technologies, access format, package price and full cost, sponsor material version, call-for-proposals status, and follow-up owner. Use your account lists, customer interviews, and the organizer's report to assess the audience.
3. Score the event using a weighted model. Example weights for this exercise: customer profile fit — 35 %, access to the right role — 20 %, meetings that can be scheduled in advance — 20 %, suitable format — 15 %, economics and team readiness — 10 %. Score each field from 0 to 5 and mark unknowns as unknown rather than assigning an average score. High attendance must not outweigh zero profile fit. Adjust weights to the task: working with maintainers and finding major deals require different weights.
4. Choose the minimum sufficient format: a ticket and prearranged meetings, a talk or contribution to the community program, a small workshop, a joint partner session, a booth, or a separate room for executive meetings. A paid sponsor talk and an editorially selected talk are different formats. If nobody can run the technical demo and follow-up, a good package alone will not help.

<!-- section: theory | Event economics -->
`Full cost = sponsorship + travel + booth and services + materials and demo + team time + follow-up`.

`Expected new deals = completed target-account meetings × sales-accepted opportunity rate × win rate`.

`Expected gross profit = new deals × first-year revenue per deal × gross margin`.

`Return on investment = (incremental gross profit − full cost) / full cost`.

Worked example: full cost of 30 thousand dollars, 24 completed meetings with target accounts, a quarter becoming opportunities, and a fifth of opportunities won gives 1.2 expected deals. With 40 thousand dollars in annual revenue per deal and a 75 % gross margin, that is 36 thousand in gross profit and an expected return of 20 %. The model promises nothing: recalculate with conversion halved, account for the time until money arrives, and show existing deals separately. Revenue from deals that an event merely touched cannot all be counted as the event's incremental revenue.

If the calculation and audience show that a booth is unnecessary, deciding “do not buy a booth” is a good analytical outcome.

<!-- section: theory | Portfolios for different segments -->
| Segment | Example events |
|---|---|
| Databases | PGConf.EU, PGConf.dev, Percona Live, local PostgreSQL user groups |
| Observability | SREcon, ObservabilityCON, Datadog DASH, Monitorama |
| Security | RSAC, Black Hat, local BSides, OWASP chapters |
| Networking and content delivery | NANOG, Cisco Live, Cloudflare Connect |
| Storage and backup | Gartner IOCS, Open Source Summit, operator meetings |
| Data and streaming | Confluent Current, Data + AI Summit, Snowflake Summit |
| Developer platforms | DevOpsDays, KubeCon, Microsoft Ignite, HashiConf |
| AI infrastructure | NVIDIA GTC, Data + AI Summit, specialist agent conferences |
| Hardware and embedded systems | Embedded Linux Conference, Open Source Summit, manufacturer and sales channel conferences |

The table shows possible combinations, not a recommendation for everyone to buy the listed packages. Each choice goes through this lesson's evaluation and calculation.

<!-- quiz -->
? A PostgreSQL tools vendor is choosing between a booth at a major cloud conference and a table at PGConf.EU. What determines the choice?
- Attendance: a major conference has more people, so it has more buyers || High traffic does not outweigh zero profile fit.
+ Where database administrators gather and how many meetings with them can be arranged in advance || Profile fit and access to the role carry the most weight.
- Price: choose the cheapest option because event ROI cannot be calculated || ROI is calculated using a model.
? The model predicts 1.2 expected deals and a 20 % return. What should you do before buying the package?
+ Recalculate with conversion halved and separate existing deals || Test the model's robustness.
- Buy the package because the return is positive and the decision is obvious to any executive || The model promises nothing.
- Decline because 1.2 deals is too few for any conference || Deal count is assessed together with deal value.
? When evaluating an event, “access to the right role” is still unknown. How should you fill it in?
- Assign the average score to avoid understating or overstating the event's overall score || An average score hides the gap.
- Assign zero because an unknown value means the right people are absent || Unknown does not mean zero.
+ Mark it as unknown and request data from the organizer or customers || Unknowns are explicitly marked.
<!-- /quiz -->

<!-- section: task | Exercise: a portfolio of three events -->
Complete the exercise in the document on this page. Describe your product's buyer roles and the main goal for next year. Build a shortlist of ten events across the lesson's four classes and score each using the weighted model, marking unknown fields. Choose three events of different types and, for each, record the participation format, full cost, expected ROI calculation, and a criterion for declining participation the following year.

<!-- section: sources -->
- GitLab, event request guidelines — https://handbook.gitlab.com/handbook/marketing/events/ (checked 25.11.2026)
- Google Cloud Next 2026, wrap-up — https://cloud.google.com/blog/topics/google-cloud-next/google-cloud-next-2026-wrap-up (24.04.2026)
- AWS re:Invent 2025, recap — https://assets.community.aws/a/reCap-Summary-2025.pdf
- AWS re:Invent 2026, sponsorship eligibility — https://aws-sponsorship.zendesk.com/hc/en-us/articles/47187717797908-AWS-re-Invent-2026-Sponsorship-Eligibility
- Cisco Live 2025 — https://blogs.cisco.com/customerexperience/cisco-live-2025-back-in-san-diego
- Open Source Summit North America 2027, sponsor prospectus with 2026 results — https://events.linuxfoundation.org/wp-content/uploads/2026/11/sponsor-oss-na27_110626-3.pdf (p. 4)
- PGConf.EU 2026 — https://www.postgresql.org/about/event/pgconfeu-2026-2587/
- SREcon26 Americas — https://www.usenix.org/conference/srecon26americas
- RSAC 2026, wrap-up — https://www.rsaconference.com/library/press-release/2026-closing-release (27.03.2026)
- NANOG, February 2026 recap — https://lists.nanog.org/archives/list/nanog-announce%40lists.nanog.org/2026/2/
- KubeCon + CloudNativeCon Europe 2026, transparency report — https://www.cncf.io/wp-content/uploads/2026/04/KCEU26-Transparency-Report.pdf (28.04.2026)
- Snowflake Summit 2025, partner prospectus — https://www.snowflake.com/wp-content/uploads/2024/12/Snowflake-Summit-25_Partnership-Prospectus-1.pdf (p. 10)
- HashiConf — https://www.hashicorp.com/en/conferences/hashiconf
- Gartner IOCS US 2026, exhibitor information — https://www.gartner.com/en/conferences/na/infrastructure-operations-cloud-us/exhibitors/become-an-exhibitor
