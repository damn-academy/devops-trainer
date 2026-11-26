<!-- lesson: events.own-conf | Your own conference: from the first hundred seats to a program people trust | 28 -->
<!-- section: hook -->
The first GrafanaCon in 2015 lasted one day: four hours of talks, eight speakers, and a hundred attendees. A year later, the organizers were already planning two days and more than two hundred and fifty people, and today GrafanaCON brings people together in Barcelona for three days. A company building an infrastructure product can follow the same path, but a first conference often fails over things nobody thought about beforehand: twice as many people register for free tickets as actually attend, employee talks turn the event into advertising, and the hallway has neither power outlets nor space for conversations. This lesson covers how to run your first conference: choosing its scale, calculating its cost, selecting talks so people trust the program, attracting attendees, planning breaks, and assessing whether the event paid off.

<!-- section: theory | The scale of the first event -->
For a company with twenty to sixty people, a reasonable starting point is a one-day technical user event with a hundred to two hundred seats, a single track of talks, and a separate room for conversations. This is not an industry standard, but a conclusion drawn from several examples: the first GrafanaCon brought together a hundred people in one day; from 2027, the Kubernetes Community Days program has a Tier 0 for first events with up to two hundred attendees; the virtual KubeVirt Summit 2026 took four hours of one day. An online conference is best designed as a separate product, covered in the next lesson.

A full hybrid event, where remote attendees get the same experience as people in the room, almost always turns out more expensive and worse than either option for a first event. PyCon US dropped online participation from 2025 because of cost and complexity, while ContainerDays became fully in person in 2025 and publishes recordings afterward. For your first event, choose an in-person conference with recordings or an online conference, and add the other option only when you have dedicated people for the remote audience.

Decide in advance whose conference you are running. Your own user day lets you openly devote part of the program to the product. A community conference with an independent program committee earns more trust, but requires giving stage time to other people's talks. An event under the name of a project donated to CNCF follows the foundation's rules, covered in the lesson on CNCF events. Mixing these approaches is risky: if you call it a community conference but half the program consists of employees talking about the product, attendees will notice.

<!-- section: theory | What a conference costs -->
Commercial conferences rarely publish budgets, but community conferences publish detailed expenses. PyCon JP 2026 spent around 21.3 million yen for 407 attendees: 6.4 million on the venue, 4.4 million on travel and accommodation, 2.5 million on recording talks, 2.2 million on networking, 2 million on catering, 1.2 million on the party, and 1.2 million on merchandise. That comes to around 52 thousand yen per attendee, a figure that stayed between 49 and 53 thousand over the last three years; these amounts exclude organizers' salaries because they are volunteers. In the United States, PyTexas spent 48.6 thousand dollars in 2025, a third more than the year before, while tickets brought in 31.9 thousand and sponsors covered the difference.

These examples cannot give you a ready-made figure, but they do suggest a calculation method. Count fixed costs, which do not depend on attendance (the venue including setup and teardown, sound and lighting, recording, insurance), separately from variable costs, which grow with each person (catering, merchandise, badges). Add speaker travel, accessibility (captions, a childcare room, interpretation), and registration service fees. Put your employees' time at their fully loaded rate on a separate line: without it, the conference looks half as expensive as it actually is for the company. The difference between the full cost and the revenue from tickets and confirmed sponsors is the amount the company contributes to the event, and you should know it before announcing the conference.

Service fees vary considerably. On its free plan, Luma charges 5 % per paid ticket, pretix charges 2.5 % capped at 15 euros, and Tito charges 3 % capped at 25 euros; free tickets incur no fees on Tito or Eventbrite. Sessionize costs 499 dollars per event for collecting talk proposals and is free only for nonprofit community events: a company conference does not qualify even if admission is free. You can self-host pretalx without a license fee.

<!-- section: theory | Free tickets, paid tickets, and deposits -->
Many people register for a free event, but not everyone attends. The DevOpsDays organizer guide estimates a 30–40 % no-show rate for free tickets. Across 860 events, PheedLoop found a median no-show rate of 28 % for free events and 17 % for paid ones, but clarified in September 2026 that within the same events the difference between paid and free attendees is just 2–4 percentage points, so the gap between events cannot be attributed to payment alone. At the paid PyTexas 2024, 229 of the 276 in-person ticket holders attended, a 17 % no-show rate.

Basecamp described the most striking experiment in August 2026: 84 people registered for a customer breakfast without a deposit and 38 attended, while with a refundable 100-dollar deposit, 55 registered and 50 attended. This was a small event, and you cannot promise the same attendance at a conference, but the direction is clear. There are two workable options for a first event: paid attendee tickets and a higher-priced ticket for people whose employer pays, plus free places by application for students and those who cannot afford a ticket; or free participation with reconfirmation a week beforehand and a waiting list to fill released places.

<!-- section: theory | A program people trust -->
Trust in the program of a company-run conference depends on talk selection. Assemble a program committee of at least five people from three organizations, with no more than two of your employees, and have three people review each proposal independently. Hide the author's name and company in the first round, as PyCon Greece does: assess the content first, then review the speaker's experience separately. This is a design choice modeled on CNCF and PyCon rules, not a standard: KubeCon, for example, does not hide names and evaluates speaker suitability.

Publish the criteria when you open the call for proposals. The first threshold is technical substance without a product pitch. Then score talks from one to five for relevance, concrete evidence (measurements, incident analysis, architecture with constraints), structure, and novelty; this is how KubeCon reviewer criteria work. Give your own product demo a separate slot labeled as an organizer talk; do not present a paid talk or your own talk as one selected by the committee.

Leave plenty of time: the virtual KubeVirt Summit 2026 closed submissions on 22 July, sent decisions on 3 August, and published the program on 5 August, more than two months before the event on 15 October. For an in-person conference of a hundred to two hundred people, start five to six months ahead with the theme, venue, program committee, and call for proposals; announce the first speakers three to four months ahead; publish the full program two months ahead. Offer newcomers help with proposals and a rehearsal, as PyCon US and SREcon do, and publish in advance whether you cover speaker travel and how much. Make rejections specific: explain what was strong in the proposal and what was missing, and do not promise detailed feedback if the committee has not prepared it.

A first-event schedule could include a thirty-minute opening talk, six twenty-five-minute talks, four consecutive five-minute talks, an hour of open conversation with maintainers, and a ninety-minute hands-on lab for registered participants, with an Open Space session running alongside it. Allow about two hours for breaks, lunch, and transitions. Do not make the lab shorter than an hour: at Security Slam 2025, forty-five-minute blocks proved too short for collaborative work.

<!-- section: theory | Where attendees will come from -->
Nobody publishes a reliable percentage of existing users among attendees, so start with a testable hypothesis: your users and two or three partner communities. In the PyCon JP 2024 attendee survey, people most often said they had heard about the conference through friends and colleagues, their employer, X, and other events; advertising was not the main source. PyTexas announces its call for proposals through its mailing list, social media, Discord, conference calendars, and local meetup listings, and reveals the program about three months ahead.

Give each partner and speaker a unique discount code or link so you can see how many registrations and actual attendees each channel brings. GrafanaCON 2026 released a 20 % community discount code with its program announcement. You can arrange a joint technical session and places for members with local CNCF groups, but you cannot call your conference an official CNCF event, and groups lose their affiliation for violating neutrality. During registration, ask whether the person currently uses the project, is evaluating it, or does not use it yet: you will need this answer later to understand whom the conference attracted.

<!-- section: theory | Breaks, interaction, and entertainment -->
Many attendees come for hallway conversations, and these need as much planning as talks: places to stand and sit, laptop tables, power outlets, and quiet space away from the auditorium. The formats below have been used at conferences; there is no evidence that any of them increases sales or retention, so measure your own results.

Open Space is a room and an hour in which attendees propose topics themselves and gather around shared interests; DevOpsDays London devotes the second half of the day to it. Five-minute talks with automatically advancing slides work well for newcomers if slides are collected beforehand and there is a host. Maintainer conversations work when each slot has names and topics, and unanswered questions are recorded. Collaborative coding produces verifiable results: at Security Slam 2025, Flux received three merged pull requests and OSCAL Compass four, but you need prepared tasks and a quiet space. In 2025, eBPF Summit replaced a day of talks with a four-week hackathon that produced 42 projects.

Games and entertainment are optional and must not block access to the main content. Security competitions such as the KubeCon CTF need an easy first challenge for newcomers. More than half of respondents rated the booth stamp quest at PyCon JP 2024 as average, complaining about unclear rules and glitches. Around 63 % of respondents praised the party at the same PyCon JP, but complained about crowding, so give it a separate registration with limited places. Karaoke, morning runs with a specified route and pace, and board games in a quiet area feature at KubeCon and PyCon; people wear PyTexas T-shirts to later editions, but nobody has measured the long-term effect of stickers or other merchandise.

<!-- section: theory | Code of conduct, accessibility, and safety -->
A code of conduct works only when people enforce it. PyCon US publishes a reporting address, names of responsible people, and alternative contacts for conflicts of interest, and trains the people doing this work and schedules shifts of at least two so a volunteer never handles a difficult case alone. In September 2026, PyCon AU published a report on two minor incidents: in response to a complaint about jokes in a five-minute talk, the team passed feedback to the speaker and replied to the complainant. For your conference, designate a reporting channel, trained shifts, an escalation route to someone outside the team, a venue security contact, and online chat moderation.

Check accessibility along the attendee's route: entrance, registration, auditorium, toilet, catering, exit, as well as sound and captions in the auditorium. KubeCon Europe 2026 lists a quiet room and prayer room, a nursing room, free childcare, and captions for all talks; PyCon JP budgets separately for childcare and simultaneous interpretation. Each service needs an owner, and information about it should be on the website before people buy tickets.

<!-- section: theory | After the conference -->
Recordings do not appear immediately: GrafanaCON 2026 published all talks about a month later, SREcon after several weeks, and PyCon JP only published 55 videos from its August event in November. Record viewing counts at consistent intervals, such as after a week, a month, and three months, and keep the measurement date: current YouTube views will not show how they accumulated. Publish attendee surveys with the number of respondents and their share of all attendees: in 2024, 187 of 651 PyCon JP attendees responded, around 29 %, and more than a quarter of them considered the ticket expensive.

Measure conference results against the goals you wrote down beforehand. Measure reach using registrations and actual attendees separately. The number of people who completed the lab shows practical value. For the community, count new issue and pull request authors after one and three months. For the product, count new installations and repeat use separately from existing users. For sales, count conversations people opted into, scheduled meetings, and sales opportunities. Assess costs by dividing the full cost by attendees, lab completers, and new project contributors. Report to sponsors on what you promised in the contract, and do not promise a list of all attendees: PromCon and the Linux Foundation state that they do not sell lists, and sponsors receive contact details only from people who choose to share them.

<!-- quiz -->
? A company is running a free community conference with 150 seats. Based on organizers' experience, what is the best way to avoid an empty room?
+ Reconfirm attendance a week beforehand and use a waiting list to fill released places || DevOpsDays estimates a 30–40 % no-show rate for free tickets; reconfirmation and a waiting list help fill the room without charging.
- Allow three times as many registrations as seats, because around two-thirds of people always miss free events || No-show rates vary; if almost everyone attends, people will have to be turned away at the door.
- Charge for tickets: payment almost completely eliminates no-shows at any event || PheedLoop clarified that within the same events, payment reduces no-shows by only 2–4 percentage points.
? How should you select talks so people trust a company conference's program?
+ An independent committee from several organizations, three reviews per proposal, and a separately labeled organizer talk || This reflects CNCF's program committee requirements and KubeCon reviewer guidelines.
- Let company employees select talks, because they know best which topics product users need || A committee made up entirely of employees turns the program into advertising, and attendees see it.
- Invite only well-known speakers without a call for proposals to guarantee the quality of every talk || Invited talks have a place, but without an open call you miss users with real stories.
? What should have its own line in the conference budget to avoid underestimating the cost by half?
+ Your employees' time at their fully loaded rate || Published community conference budgets exclude this because their organizers are volunteers.
- The registration service fee, because it often exceeds the venue cost || The fee is usually a few percent of the ticket price.
- The exhibitor insurance SREcon sells for 99 dollars, because it covers the organizer's liability || That insurance covers exhibitors, not the organizer's liability.
<!-- /quiz -->

<!-- section: task | Exercise: plan your first conference -->
Complete this exercise in the document on this page. Plan your company's first conference or, if you do not have a company, one for the fictional Stratova, which builds an open-source private cloud platform and wants to bring users together in Prague. Write down: the format and number of seats; one main goal and how you will measure it; the program committee members and their organizations; talk selection criteria and where the organizer's talk fits in the program; a minute-by-minute schedule; the ticket model and how you will handle no-shows; three acquisition channels and how you will distinguish their results; two formats for breaks; who owns the code of conduct and accessibility; budget items with fixed and variable costs and a line for employee time; what you will measure after one and three months. The plan is ready when every item has an owner and a date.

<!-- section: sources -->
- GrafanaCon, 2016 prospectus with 2015 results — https://www.grafanacon.org/2016/grafanacon_2016_prospectus.pdf (2016)
- CNCF, Kubernetes Community Days for the first half of 2027 — https://www.cncf.io/blog/2026/08/20/announcing-h1-2027-kcds/ (20.08.2026)
- KubeVirt Summit 2026 — https://kubevirt.io/summit/ (15.10.2026)
- PyCon US, changes from 2025 — https://pycon.blogspot.com/2024/11/important-changes-ahead-commitment-to.html (01.11.2024)
- ContainerDays, 2025 report — https://www.containerdays.io/pdf/Post-ContainerDays-Conference-2025-Report.pdf (2025)
- PyCon JP, 2026 financial report — https://pyconjp.blogspot.com/2026/ (19.11.2026)
- PyCon JP, 2025 financial report — https://pyconjp.blogspot.com/2026/02/2025-financial-report.html (02.03.2026)
- PyTexas, 2025 recap — https://www.pytexas.org/blog/2025-conference-recap/ (30.06.2025)
- PyTexas, 2024 recap — https://www.pytexas.org/blog/2024-conference-recap/ (02.08.2024)
- PyTexas, venue runbook — https://www.pytexas.org/runbooks/conference/runbooks/venue/ (accessed 25.11.2026)
- PyTexas, preparation timeline — https://www.pytexas.org/runbooks/conference/runbooks/conference-master-timeline/ (accessed 25.11.2026)
- DevOpsDays, organizer guide — https://devopsdays.org/organizing (accessed 25.11.2026)
- PheedLoop, no-show data — https://web.pheedloop.com/blog/event-data-lab-report-06 (01.09.2026)
- Jason Fried, the 100-dollar deposit — https://world.hey.com/jason/5300-in-100s-the-verdict-74c41080 (28.08.2026)
- Luma, pricing — https://luma.com/pricing (accessed 25.11.2026)
- pretix, pricing — https://pretix.eu/about/en/pricing (accessed 25.11.2026)
- Tito, pricing — https://ti.to/pricing (accessed 25.11.2026)
- Eventbrite, fees — https://www.eventbrite.com/help/en-us/articles/755615/how-much-does-it-cost-for-organizers-to-use-eventbrite/ (accessed 25.11.2026)
- Sessionize, pricing — https://sessionize.com/pricing (accessed 25.11.2026)
- pretalx, pricing — https://pretalx.com/p/pricing/ (accessed 25.11.2026)
- KubeCon North America 2025, reviewer guidelines — https://events.linuxfoundation.org/archive/2025/kubecon-cloudnativecon-north-america/program/submission-reviewer-guidelines/ (2025)
- PyCon Greece 2026, call for proposals — https://2026.pycon.gr/en/program/cfp-faq/ (2026)
- PyCon US 2026, speaker mentorship — https://us.pycon.org/2026/speaking/mentorship/ (2026)
- SREcon26 EMEA, call for participation — https://www.usenix.org/conference/srecon26emea/call-for-participation (2026)
- CNCF, Security Slam 2025 report — https://www.cncf.io/wp-content/uploads/2025/05/01_CNCF_2025-Security-Slam-PDF-Report.pdf (05.2025)
- eBPF Summit 2025 — https://ebpf.io/summit-2025/ (2025)
- DevOpsDays London 2025 — https://devopsdays.org/events/2025-london/ (2025)
- PyCon JP, 2024 attendee survey — https://pyconjp.blogspot.com/2024/10/pyconjp2024-questionnaire.html (02.11.2024)
- GrafanaCON 2026, program and discount code — https://community.grafana.com/t/grafanacon-introducing-the-lineup-and-20-ticket-discount/162424 (07.04.2026)
- CNCF, community group organizer guidelines — https://github.com/cncf/communitygroups/blob/main/organizers.md (accessed 25.11.2026)
- PyCon US 2025, code of conduct — https://us.pycon.org/2025/about/code-of-conduct/ (2025)
- PyCon AU 2026, transparency report — https://2026.pycon.org.au/posts/community-transparency-report/ (26.09.2026)
- KubeCon Europe 2026, transparency report — https://www.cncf.io/wp-content/uploads/2026/04/KCEU26-Transparency-Report.pdf (28.04.2026)
- GrafanaCON 2026, talk recordings — https://grafana.com/blog/grafanacon-2026-on-demand-sessions-are-now-available/ (22.05.2026)
- PromCon 2025, registration and privacy — https://promcon.io/2025-munich/register/ (2025)

<!-- lesson: events.online-conf | Online conferences: getting viewers to join and stay | 18 -->
<!-- section: hook -->
The online KubeVirt Summit in October 2025 had 841 registrations and 300 live attendees, around 36 %. EnvoyCon the day before had 441 and 146, and StrimziCon that summer had 506 and 240. Organizers who expect everyone registered to join live are disappointed, while those who count only the live event miss the fact that people watch recordings for months afterward. This lesson covers how to run an online conference: choosing a format and time, selecting a platform, staffing the team, helping viewers talk as well as watch, and deciding what counts as a result.

<!-- section: theory | How many people will join live -->
CNCF publishes comparable figures for virtual project events. In 2025, between 33 and 47 % of registrants joined four events live: KubeVirt had 36 %, EnvoyCon 33 %, StrimziCon 47 %, and GitOpsCon Europe 44 %. If five hundred people register for your event, these proportions suggest roughly 166 to 237 live attendees; this is a scenario based on a small sample, not a forecast. People who miss the live event are not necessarily lost: some will watch the recording.

Other organizers publish figures that cannot be compared with these. PlatformCon reported more than 35 thousand registrations in 2024, 42 thousand views during the conference, and 100 thousand in the first four weeks, but views can repeat and do not equal people. eBPF Summit reported more than two thousand participants in 2024 without explaining its methodology, and in 2025 it counted hackathon projects instead. When comparing your event with another, check that both counted the same thing.

<!-- section: theory | Format and timing -->
A successful online conference rarely copies an in-person one. PlatformCon records talks of about fifteen minutes in advance and makes them available on demand, while running separate live openings for European and American time zones. In 2026, KubeVirt put everything into a single four-hour window, from 12:00 to 16:00 UTC, although its 2024 summit lasted two days. CNCF offers a half-day, single-track format for virtual project summits, with around a hundred and fifty minutes of talks.

For a first event, three to four hours on one day with a single track works well: prerecorded talks followed by live questions for each speaker. A recorded talk is not disrupted by the speaker's poor connection, and the speaker can answer questions in chat while it plays. Choose a time for the people you want to attend: 12:00–16:00 UTC works well for Europe and is manageable for the US East Coast, but inconvenient for Asia; include UTC, local time, and the recording release date in the invitation. If your audience is worldwide, repeat the opening and Q&A for a second time zone so nobody has to attend live in the middle of the night.

<!-- section: theory | Platform and team -->
Choose the platform for the task. YouTube Live suits public talks and a lasting archive: streams shorter than twelve hours are automatically saved, and YouTube shows peak concurrent viewers; manage registration and attendance tracking separately. Twitch keeps past broadcasts for between a week and two months, so it cannot serve as a conference archive. Studios such as StreamYard and Restream let guests join from a browser and stream to several destinations at once; StreamYard sells a separate Business plan for companies, while Restream Business costs 239 dollars a month and offers eight streaming destinations. Zoom Events (149 dollars a month) and Airmeet (from 199 dollars a month for webinars, with full events priced by quote) add networking rooms and multiple tracks. Hopin no longer exists: RingCentral bought its events platform in 2023 and sells it as RingCentral Events. No platform license includes a host, moderation, or technical support.

An online conference team needs three roles, although one person can cover two. The technical producer controls the stream, plays talks, connects speakers, and monitors sound. The moderator collects questions and passes them to the speaker. The community host engages viewers during breaks and responds in chat. Run a full rehearsal with a remote listener before the conference: PyTexas describes hallway echoes, stream failures, and insufficient venue bandwidth in its audiovisual runbook, and there is no proven way to work around these on event day. Keep a local copy of every recording separately from the platform.

<!-- section: theory | Getting viewers to talk -->
The easiest thing for an online conference viewer to do is close the tab, so conversations need as much planning as talks. At its hybrid conference in 2024, PyTexas set up a shared Discord for in-person and remote attendees, collected questions from both audiences in Slido, moderated them in advance, and had the host read each question into a microphone. This is a concrete, verifiable setup, unlike the promise of a “virtual hallway” that nobody facilitates.

Give viewers something to do. A short browser-based hands-on lab with a clear way to check the result, covered in the lesson on hands-on workshops, holds attention better than a fifth consecutive talk. A maintainer Q&A with questions collected beforehand. A channel in the project's chat where the speaker stays after the talk. In 2025, eBPF Summit went further and replaced a day of talks with a four-week hackathon where participants built 42 projects: for an open-source project, this format brings new contributors as well as viewers.

<!-- section: theory | After the live event -->
An online conference begins a second life after the live event. Publish talks as separate videos with clear titles, add them to the documentation alongside the topics they explain, and send registrants a link to the recordings. Measure results as you would for an in-person conference: registrations, live attendees, and peak concurrent viewers separately; recording views after a week, a month, and three months, with measurement dates; lab completers; new project contributors after one and three months; product conversations people chose to have.

<!-- quiz -->
? An online conference had 800 registrations and 280 live attendees. How should you assess this result?
+ As normal: at CNCF virtual events, between a third and a half of registrants join the live stream || KubeVirt had 841 registrations and 300 attendees in 2025, while EnvoyCon had 441 and 146.
- As a failure, because more than half of registrants did not attend and will never watch the recordings || Some people who miss the live event watch recordings; typically a third to half join CNCF events live.
- As a counting error, because almost everyone registered for a free online event attends || At the documented CNCF events, no more than half joined live.
? Why are online conference talks often prerecorded?
- Platforms rank recorded talks higher in recommendations than live streams by the same speakers || Recommendation order is irrelevant here; recording protects the talk from connection failures.
+ A recording cannot break on a bad connection, and the speaker answers in chat || PlatformCon uses this approach: recorded talks and live questions.
- YouTube Live rules prohibit live broadcasts with multiple speakers on free channels || No such rules exist; recording is chosen for reliability.
? Which platform should not be treated as an archive of conference recordings?
- The project's own website, because videos there cannot be found through search || A project website is suitable for an archive, especially when recordings sit alongside documentation.
- YouTube Live, because it deletes recordings more than a year old unless they are downloaded manually || YouTube automatically saves streams shorter than twelve hours.
+ Twitch || Twitch keeps past broadcasts for between a week and two months.
<!-- /quiz -->

<!-- section: task | Exercise: an online conference run of show -->
Complete this exercise in the document on this page. Write a run of show for a three-to-four-hour online conference for your project or the fictional Stratova. Record: the audience and time window, with UTC and local times for the two main regions; a minute-by-minute schedule with recorded talks, live questions, a lab, and breaks; the streaming platform and separate registration and chat platforms, and why you chose them; who serves as technical producer, moderator, and community host; the full rehearsal date; how viewers will talk and what hands-on activities they will do; which figures you will collect on event day and after a week, a month, and three months. The run of show is ready when someone else could use it to run the live event without you.

<!-- section: sources -->
- CNCF, 2025 virtual project events report — https://www.cncf.io/wp-content/uploads/2025/10/cncf_2025_virteventreport_102825a.pdf (28.10.2025)
- Platform Engineering, State of Platform Engineering Report, Volume 3 — https://5890440.fs1.hubspotusercontent-eu1.net/hubfs/5890440/State%20of%20Platform%20Engineering%20Volume%203/State%20of%20Platform%20Engineering%20Report%20Volume%203.pdf (2024)
- PlatformCon 2025, FAQ — https://2025.platformcon.com/faqs (2025)
- eBPF Summit 2024, recap — https://ebpf.io/blog/ebpf-summit-wrapup/ (09.10.2024)
- eBPF Summit 2025 — https://ebpf.io/summit-2025/ (2025)
- KubeVirt Summit 2026 — https://kubevirt.io/summit/ (15.10.2026)
- KubeVirt Summit 2024, sponsorship prospectus — https://kubevirt.io/assets/files/summit24-sponsor.pdf (2024)
- CNCF, 2027 project event guidelines — https://events.linuxfoundation.org/cncf-project-colo-guidelines-2027/ (17.09.2026)
- YouTube, archiving live streams — https://support.google.com/youtube/answer/6247592 (accessed 25.11.2026)
- YouTube, live stream metrics — https://support.google.com/youtube/answer/2853833 (accessed 25.11.2026)
- Twitch, video on demand — https://help.twitch.tv/s/article/video-on-demand (accessed 25.11.2026)
- StreamYard, pricing — https://streamyard.com/pricing (accessed 25.11.2026)
- Restream, pricing — https://restream.io/pricing (accessed 25.11.2026)
- Zoom Events, pricing — https://zoom.us/pricing/events (accessed 25.11.2026)
- Airmeet, pricing — https://www.airmeet.com/hub/pricing/ (accessed 25.11.2026)
- RingCentral, acquisition of Events from Hopin — https://ir.ringcentral.com/news/press-release-details/2023/RingCentral-Expands-Video-Offerings-With-Acquisition-of-Events-and-Session-Product-Lines-From-Hopin/default.aspx (02.08.2023)
- PyTexas, audiovisual runbook — https://www.pytexas.org/runbooks/conference/runbooks/av/ (accessed 25.11.2026)
- PyTexas, 2024 recap — https://www.pytexas.org/blog/2024-conference-recap/ (02.08.2024)
