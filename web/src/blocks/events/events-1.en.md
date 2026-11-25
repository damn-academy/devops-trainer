<!-- lesson: events.map | Mapping events and calculating whether an event paid off | 18 -->
<!-- section: hook -->
A company took a booth at a major conference, returned with six hundred scanned badges, and reported “600 leads” to its board. Six months later, it turned out that forty of those six hundred people worked at companies matching the buyer profile, twelve had agreed to a call, and the two deals that sales attributed to the conference had started before it. This course covers how to choose events, how to work at them, and how to measure results without misleading yourself. The first lesson maps the different types of events and provides a way to calculate whether an event paid off.

<!-- section: theory | Your own and others' events, online and in person -->
An infrastructure company's events can be mapped along two axes. The first separates your own events from others' events: you organize your own events and decide whom to invite and what to show; at others' events, you are a guest, speaker, or sponsor and follow the organizer's rules. The second separates online events from in-person events: online events cost less and bring together people from different countries, while in-person events cost more but allow personal conversations that make people respond to your emails afterward.

This gives four groups. Your own online events include webinars and online workshops with labs. Your own in-person events include meetups, local workshops, dinners, and roundtables. Others' online events include CNCF online programs, partner webinars, and virtual conferences such as PlatformCon. Others' in-person events include KubeCon, Kubernetes Community Days, DevOpsDays, FOSDEM, Open Source Summit, ContainerDays, regional conferences, and meetups where your company gives a talk.

Each group offers something different. A talk at someone else's conference builds credibility and produces a recording that remains useful for years. A booth provides many short conversations over three days. Your own meetup builds relationships with local engineers. A dinner with executives allows a conversation about money and risk that would not happen at a booth. A webinar provides a recording and a list of people who spent an hour on the topic.

<!-- section: theory | Different events have different rules -->
Sponsors' and speakers' rights vary significantly between events and must be checked in each contract. DevOpsDays does not sell speaking slots: sponsors' employees submit proposals on the same terms as everyone else, and sponsors do not receive attendee lists. FOSDEM is a free, nonprofit event whose charter prohibits sponsorship from buying preferential treatment for talks, stands, or developer rooms. At KubeCon, sponsors receive contact details only for people whose badges they scanned at their booth; they do not receive the full attendee list. CNCF online programs do not share webinar viewers' contact details with companies. Scanned badges, webinar viewers, community members, and newsletter subscribers are four different datasets with different usage rights.

<!-- section: theory | How to measure results -->
Evaluate an event through verifiable steps: registration or invitation; attendance or a substantive booth conversation; agreement on a next step; a completed meeting; a sales-accepted opportunity; a closed deal. For a workshop, add lab completion and subsequent product use between these steps. Several employees from the same company represent one account and must not be counted as multiple opportunities.

Use two distinct financial metrics, and do not confuse them. Pipeline per dollar is the value of potential deals divided by the event's cost. Return on investment is the gross profit from deals originating at the event minus the cost, divided by the cost. To estimate whether an event will pay off, calculate this in advance: if the full event cost is C, gross profit per deal is G, and your typical opportunity win rate is W, breaking even requires C/G deals and C/(G×W) opportunities. For example, with a trip costing 40 000 dollars, profit per deal of 50 000 dollars, and one in five opportunities closing, the event must produce at least four opportunities. It is useful to know that number before buying a booth.

The full cost of an event exceeds the package price. The cheapest KubeCon booth for startups that were CNCF members cost 12 000 dollars in 2026, but foundation membership, booth production, shipping, flights, hotels, staff time, demo infrastructure, and follow-up work all add to that amount. A 12 000-dollar booth becomes a campaign costing 30–50 thousand.

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
- KubeCon Europe 2025, transparency report — https://www.cncf.io/wp-content/uploads/2025/06/KubeCon_EU_25_TransparencyReport.pdf (June 2025)
