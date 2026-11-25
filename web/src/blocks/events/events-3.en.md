<!-- lesson: events.local | Meetups and KCD as daily work | 24 -->
<!-- section: hook -->
An open-source project maintainer decided to speak at meetups in his region, emailed the organizers of three groups he knew, and received one reply. Six months later, another maintainer of the same project was tracking sixty groups in twelve cities in a spreadsheet, spending forty minutes every day on emails and submission deadlines, and had spoken at fourteen meetups and two KCDs using three versions of the same talk. After each talk, he published the recording and a review of the questions. This lesson covers how to turn small local events into systematic daily work that advances an open-source project.

<!-- section: theory | Mapping regional events -->
Start by mapping all events in the region; a list of well-known conferences is too short for this purpose. Define your region as the cities you can reach within your travel budget, and search for events by topic and role: Kubernetes, cloud technologies, Linux, SRE, DevOps, platform engineering, networking and eBPF, data storage, virtualization and KubeVirt, GitOps, observability, and infrastructure as code. Create one record for each organizing group and separate records for its meetings so that you do not confuse an abandoned group with an upcoming opportunity.

Search in several places because none is complete. Meetup separates groups from events and supports searches by city and radius; group membership and RSVPs do not equal attendance, so check the most recent actual meeting and the organizer's activity. Luma provides city pages and community calendars; subscribe to the entire calendar, since a single event is not enough. CNCF community groups and the KCD directory are separate sources; in May 2026, CNCF groups moved from Bevy to Open Community Groups, so old addresses need to be checked. The DevOpsDays calendar lists editions by city, each with its own submissions and sponsorship. Sessionize shows calls for proposals only to people with a public profile specifying a city and topics, and only if the organizer has enabled discovery. The confs.tech dataset on GitHub and the dev.events directory help identify candidates, but every date must be checked on the event's own website. PaperCall could not be confirmed as a functioning submission channel in 2026. Once a week, check your map against CNCF's monthly newsletter, which lists open calls for proposals and local meetings.

Add university communities, distributed systems research groups, and Linux user groups to the map, and find out whether they admit people from outside. The organizer of KCD Lima 2026 teaches at a university, and the KCD took place at UTEC university.

<!-- section: theory | How to become a speaker organizers need -->
DevOpsDays organizers recommend keeping submissions open for at least a month, allowing at least two weeks for selection, and closing submissions six to eight weeks before the event because speakers need four to six weeks to arrange travel. Timelines vary between events: KCD Beijing 2025 closed submissions 38 days before the event. Meetups invite speakers much faster, sometimes with a couple of weeks' notice, and many groups continuously welcome both new and experienced speakers; the Cloud Native and Kubernetes Oslo group asks for speakers, venues, and sponsors.

An initial email to an organizer works when it offers something useful to the organizer. Refer to a recent group meeting, propose one talk that complements it, offer two possible dates and a link to a recording or demo, state whether you will attend in person or speak remotely, and offer a short backup talk in case the program is full. Offering a venue, recording, or help with audio is useful too.

Prepare a speaker package: a short biography, a photo, a 100–150-word abstract, three audience takeaways, the audience level, and 15-, 30-, and 45-minute versions of the talk. In 2025, DevOpsDays Chicago required three specific takeaways, rejected product advertising and third-party submissions, and preferred material the local audience had not heard before. Frame the topic as an engineering problem, such as “Operating customer Kubernetes clusters on shared hardware: isolation, recovery, and cost,” with a reproducible lab and a failure-and-recovery scenario, and disclose your employer.

<!-- section: theory | Kubernetes Community Days -->
Kubernetes Community Days are local conferences run by communities with CNCF support. In 2025, 29 KCDs took place in 22 countries, attracting more than 10 500 people; the annual event count fell by 17 %, while attendance grew by 3,5 %. For 2025, 61 cities applied for 30 places. Under the 2026 rules, a KCD operates as a nonprofit event through a fiscal sponsor, with open finances and registration through CNCF's system. Registration is capped at tiers of 300, 350, and 600 people, including speakers and sponsors. Selecting cities for the program and selecting talks are separate processes: a city's acceptance into the program does not give a sponsor the right to a talk.

KCD sponsorship prices are low compared with KubeCon. KCD Gujarat offered packages from 1200 to 5000 dollars in 2026. Rules vary between events: some KCDs give sponsors a technical talk or demo, while DevOpsDays does not sell talks at all. Registration is not attendance: of the 1377 people registered for KCD Lima 2025, 520 attended. CNCF's organizer guide gives different figures, around 30 % no-shows at meetups and 92 % attendance at KCDs, without describing the sample.

<!-- section: theory | Your own CNCF group -->
You can start a CNCF community group by applying on GitHub with a name such as “Cloud Native City.” The foundation pays for the platform and, after two in-person meetings with more than ten people, provides a one-time 100-dollar merchandise coupon, but it does not fund meetings. There must be at least two organizers, with no more than half from the same company. The group must meet at least six times a year, and groups that have not met for more than 90 days may be removed. Repeated neutrality violations lead to a written warning, then a final warning, then deactivation of the group. An organizer employed by a vendor therefore cannot give every speaking slot to colleagues.

Grafana offers another approach: its Grafana & Friends program has more than 70 groups that meet at least four times a year, receive monthly organizer meetings, and get a food budget based on attendance. This is one company's branded program, and its rules differ from those of neutral CNCF groups.

A small meeting for 30 people at a host company's office costs a few hundred dollars for food, adapters, and contingency, excluding people's time. Before a practical session, check the guest network, cloud quotas, screen readability, and projector adapters.

<!-- section: theory | One talk in ten cities and a working routine -->
In May 2025, after its main conference, Grafana ran half-day GrafanaCON Local events in Singapore, Berlin, Toronto, and Bangalore. The same principle works for one person: prepare one versioned demo and three abstracts for different audiences, such as operational reliability, platform architecture, and project internals for contributors. Offer the talk to ten suitable groups in nearby cities, openly stating that you have given it before, and adapt the examples to the local audience. Record which version each city has heard.

Daily work takes 30–45 minutes: check submission deadlines and organizer replies, verify two new events, send one proposal, and update the dates for next actions. A useful weekly schedule is: Monday, check calendars and deadlines; Tuesday, prepare or rehearse part of the talk; Wednesday, handle logistics and deliver on commitments; Thursday, speak or run a meeting; Friday, publish materials and review results. A travel week replaces preparation rather than adding to it.

For each group, the event spreadsheet should store the city and language, the organizer's public contact and preferred channel, the last meeting, the audience, links to the event and call for proposals, the deadline with its time zone, the format, expenses and travel support, the talk topic and version, status, last contact, next action, and recording rights.

<!-- section: theory | After the talk -->
Within two business days, send the organizer the slides, demo repository, and any answers you promised. Contact attendees only through the agreed channel: no one is obliged to give you attendee lists. After two weeks, ask whether they tried the lab; after 30 and 90 days, record whether there was a project contribution, installation, evaluation, or nothing.

Each talk becomes a set of materials: a full recording, slides, exact software versions, reproducible commands, and a short explanation of the problem. Audience questions become a technical article and two or three standalone excerpts. Altinity, PostHog, CelerData, and Sentry published their July 2025 meeting at Sentry's San Francisco office this way.

Count registrations, attendees, substantive conversations, labs started and completed, agreed next steps, evaluations started, first contributions, and retained users separately. A GitHub star expresses interest and is not an installation. Even CNCF's Cilium project journey report says it cannot tie every growth metric to specific actions, so do not attribute all project growth to meetups.

<!-- section: task | Exercise: map a region in one week -->
Complete this exercise in the course's “Event map” spreadsheet. Choose a region and, over a week, find at least twenty groups and events there using six sources from the lesson. Fill in the spreadsheet fields for each and mark which groups have met in the last three months. Prepare a speaker package and send two initial emails to organizers following the lesson's guidelines. At the end of the week, record how many minutes a day this work took.

<!-- widget: template {"file":"event-map"} -->

<!-- section: sources -->
- CNCF, 2025 annual report — https://www.cncf.io/reports/cncf-annual-report-2025/ (24.02.2026)
- CNCF, KCD 2025 — https://www.cncf.io/blog/2024/10/30/mark-your-calendars-here-come-the-2025-kubernetes-community-days/ (30.10.2024); KCD rules — https://www.cncf.io/kcds/faq/ (checked 25.11.2026)
- CNCF, community group rules — https://github.com/cncf/communitygroups/blob/main/README.md, https://github.com/cncf/communitygroups/blob/main/organizers.md, https://github.com/cncf/communitygroups/blob/main/best_practices.md (checked 25.11.2026)
- CNCF, groups moving to Open Community Groups — https://github.com/cncf/contribute-site/blob/main/blog/2026-05-29-cloud-native-project-monthly-may-2026.md (29.05.2026)
- KCD Lima, an organizer's experience — https://www.cncf.io/blog/2026/09/15/what-i-learned-organizing-kcd-lima-2026/ (15.09.2026)
- KCD Gujarat, sponsorship — https://www.kcdgujarat.com/sponsorship (2026)
- DevOpsDays, information for organizers — https://devopsdays.org/organizing; DevOpsDays Chicago 2025 proposals — https://devopsdays.org/events/2025-chicago/propose
- Cloud Native and Kubernetes Oslo — https://github.com/Cloud-Native-and-Kubernetes-Oslo/meetups
- Grafana & Friends — https://grafana.com/community/meetups/; GrafanaCON Local — https://grafana.com/blog/grafanacon-local-our-biggest-community-event-is-coming-to-a-city-near-you/ (03.04.2025)
- Altinity, meetup at Sentry — https://altinity.com/blog/real-time-data-lakes-meetup-at-sentry-in-san-francisco (14.07.2025)
- CNCF, Cilium project journey — https://www.cncf.io/reports/cilium-project-journey-report/ (11.11.2024)
- Meetup — https://www.meetup.com/find/; Luma — https://luma.com/discover; Sessionize — https://sessionize.com/playbook/speaker-dashboard; confs.tech — https://github.com/tech-conferences/conference-data; dev.events — https://dev.events/
