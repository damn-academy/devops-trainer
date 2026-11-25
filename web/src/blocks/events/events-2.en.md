<!-- lesson: events.webinars | Webinars: topic, format, recording, and follow-up | 16 -->
<!-- section: hook -->
A company's webinar attracted 380 registrations, but only 120 people attended, which disappointed the marketer. A month later, another 210 people had watched the recording, eight of them had contacted an engineer with questions about their deployments, and two had started pilots. This lesson covers how many people actually attend webinars, which formats suit engineers, and why the recording matters more than the live broadcast.

<!-- section: theory | How many people attend -->
Webinar platforms publish their own reports, and their figures differ because they measure differently. Across its customers in 2025, ON24 reported that 60 % of registrants attended, with an average of 239 viewers spending around 49 minutes on a webinar, including some who watched the recording. For the same year, Goldcast reported attendance of around 40 % across 26 thousand webinars from 522 companies, with averages of 251 registrations and 102 viewers; 89 % of webinars were available as recordings, but recordings accounted for only 16 % of all views. BigMarker reported averages of 322 registrations and 171 viewers for 2024. You cannot divide one average by the other and call it the attendance rate: the averages are calculated across different webinars.

For planning, these reports suggest a range: between one-third and sixty percent of registrants attend a webinar when recording views are included. Report live viewers, recording-only viewers, and people who watched both separately, and count recording views over a consistent period, such as 30 days.

<!-- section: theory | Formats for engineers -->
Engineers attend webinars to see a working system. A good format for an infrastructure product looks like this: the presenter uses a single API to create a customer cluster and a virtual machine, breaks something and demonstrates recovery, explains the tradeoffs, then answers questions about viewers' deployments and publishes the commands and recording afterward. A panel featuring a customer discussing their deployment also works, provided the customer discusses difficulties as well as successes.

Webinar series are common: according to Goldcast, almost a third of webinars in 2025 were part of a series, but there is no evidence that being part of a series alone attracts more people. PostHog stopped running webinars altogether and prefers small in-person gatherings; that is one company's choice and cannot serve as evidence that webinars do not work.

<!-- section: theory | Joint webinars and CNCF -->
CNCF runs online programs: recorded webinars for foundation members and live broadcasts with demos, coding, or discussions. Silver members receive two recorded webinars a year; Gold and Platinum members receive four events. Incubating and Graduated projects can run up to two release webinars a year. The rules require a live demo or conversation and prohibit promotional slides, and CNCF does not share viewers' contact details. Recordings are added to playlists on CNCF's YouTube channel.

A joint webinar with a partner doubles the audience if the partner has similar buyers. Before the broadcast, agree on who receives viewers' contact details, what they will be offered afterward, and who contacts them first. Webinar platforms can export reports on attendance, questions, polls, and clicks, and you should agree in advance on how to share these reports.

<!-- section: theory | After the webinar -->
A response to a webinar poll is not yet a sales opportunity. After the broadcast, divide people into groups: those who watched to the end and asked questions, those who left partway through, and those who registered but did not attend. For the first group, answer questions you did not get to during the broadcast; send the second group a recording with a timestamp showing where they left; send the third group a recording and a short email summarizing the broadcast. An offer to speak with an engineer is appropriate for the first group; leave it until later for the others.

<!-- section: task | Exercise: webinar plan -->
Complete this exercise in a document. Choose one problem your product solves that you can demonstrate live in twenty minutes. Write a demo script: what you create, what you break, how you recover, and which commands you will publish. Decide whether to run the webinar alone or with a partner. If you choose a partner, write down how you will share contacts and follow-up work. Draft three follow-up emails for the three viewer groups from the lesson.

<!-- section: sources -->
- ON24, 2026 webinar report — https://www.on24.com/blog/key-takeaways-from-the-webinar-benchmarks-report/ (19.06.2026)
- Goldcast, B2B Webinar Benchmark Report 2026 — https://www.goldcast.io/reports/b2b-webinar-benchmark-report-2026
- BigMarker, B2B Webinar Benchmarks 2025 — https://5419875.fs1.hubspotusercontent-na1.net/hubfs/5419875/Gated%20Content%20Downloads/BigMarker-2025-B2B-Webinar-Benchmarks_043025.pdf
- CNCF, online program guidelines — https://github.com/cncf/foundation/blob/main/policies-guidance/online-programs-guidelines.md (checked 25.11.2026)
- CNCF, marketing services for projects — https://contribute.cncf.io/resources/services/marketing/ (checked 25.11.2026)
- PostHog, events — https://posthog.com/handbook/marketing/events (checked 25.11.2026)

<!-- lesson: events.labs | Online workshops and browser-based labs | 14 -->
<!-- section: hook -->
Eighty people joined an online workshop, and the first forty minutes went into getting the right version of the command-line tool installed for everyone. By the end of the two-hour workshop, eleven participants had reached the last exercise. This lesson covers how to run practical workshops so that participants reach a result and how to verify that they did.

<!-- section: theory | A ready-to-use environment -->
Environment setup is the main reason participants drop out of practical workshops. A browser-based lab removes this problem: each participant receives a ready-to-use machine or cluster with everything already installed. At KubeCon Europe 2025, Syntasso and The Access Group ran a Kratix hackathon for more than two hundred participants in Instruqt browser environments. According to the platform's report, each participant saved around 25 minutes on installation, and participants spent more than 120 hours in the labs in total. The report does not say how many finished or how many later started using Kratix.

Killercoda lets authors define scenarios in a GitHub repository: configuration, Markdown instructions, and scripts, including verification scripts that check whether a step is complete. A step counts as complete when it passes verification; clicking “next” does not count as completing a step. The environments are temporary, so participants need a way to restart a step, and credentials in these environments must not be real.

<!-- section: theory | What to measure and how to follow up -->
For a cloud platform lab, count unique starts, successful customer cluster creation, successful workload launches, successful recovery checks, and return visits separately. Calculate completion rates both as a share of starts and as a share of registrations, and record environment failures separately so that you do not confuse them with people abandoning the learning process.

After the workshop, contact participants based on their results. Send those who finished a path to a production deployment. Send those who got stuck a walkthrough of the step where they stopped. Send those who did not attend a new lab link. Evaluate the workshop through repeat runs, evaluation requests, and organizations that started using the product; the number of participation certificates issued does not show this.

<!-- section: task | Exercise: verifying one step -->
Complete this exercise in a document. Take one step from your workshop, such as creating a customer cluster. Write down the command that can verify completion and its expected output. Write down what participants should do if the step fails and how to restart it. Then list four events you will count in the lab and the formula for the completion rate.

<!-- section: sources -->
- Instruqt, Syntasso and The Access Group hackathon at KubeCon — https://instruqt.com/blog/instruqt-in-action-how-syntasso-and-the-access-group-delivered-a-scalable-hackathon-at-kubecon (16.06.2025)
- Instruqt, 2025 review — https://instruqt.com/blog/instruqt-year-in-review-how-customers-powered-hands-on-learning-at-scale (22.12.2025)
- Killercoda, information for creators — https://killercoda.com/creators (checked 25.11.2026)
