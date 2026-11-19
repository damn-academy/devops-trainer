# Review of 07-methodology-kanban.md

Reviewer: in the role of andragogy specialist and instructional designer, the author of `01-andragogy.md`. Cross-checked against `01`, `06` (A0 and C15), `08` (primitives, visual language, content format), `09` (tiers, check contract, storage, AI model), `10` (bank, placement test, exams) and the owner's requirements R1–R12.

## Verdict

The flow model is done well. The deterministic `flowlab` with common random numbers, counterfactuals and two bots, honest metric definitions that are consistent across the CFD, Little's law and DORA, and a task bank in which almost all numbers are correct are the best part of the whole document set, and they must be kept. But in its current form the document cannot be handed over to development, for five reasons. It is built around the simulator: theory is "unlocked along the way" by run events, while the owner requires the core to be a textbook with a strict order of concepts (R1). On top of that, the order here rests on its own glossary with module numbers M0–M12, which is not connected to the `01` graph (M01–M18) or to the ids that `08` and `10` already use. The explainers are made in the Sankofa aesthetic (ink drawings, characters, a backstory, "blots"), and R4 and R5 explicitly forbid this. There is no documentation ladder (R2), even though this block has its own primary sources: the Scrum Guide, the Kanban Guide, the SRE book, the SRE Workbook, dora.dev. The three process explainers that R3 names for methodology explicitly are missing. Below are 31 findings: 5 BLOCKING, 15 MAJOR, 11 MINOR. For every owner requirement, ready text is given that can be pasted into the document.

What was checked against primary sources on 18.11.2026. dora.dev names five metrics in two groups; "failed deployment recovery time" belongs to throughput, `deployment rework rate` to instability, so the document is correct here. The DORA post "Quick Check updates" exists; it is dated 22.04.2026. The Kanban Guide is current in version v2025.5 (May 2025): it has three practices and four mandatory flow measures, it defines the Definition of Workflow and the Service Level Expectation, and "lead time" is not mentioned. Featureban is distributed under CC BY-SA 4.0. All numeric answers of the checks P-I1, P-I6, P-E4 and of the E6 scale were recalculated and are correct.

---

## BLOCKING

### 1. BLOCKING — the textbook is not at the center of the block, theory is unlocked by events (R1)

**Where:** introduction ("The heart of the block is the flow simulator"), §4 "Block modules", §6.9, §11 (`unlocks: { on: { O-band-widening: theory.bottleneck } }`), §8 screen 5 "Theory you unlocked".

**What is wrong.** Theory here is a set of cards that a run unlocks. This has three consequences. (a) The order of theory differs between two learners: it depends on whether an observation fired, which means the "term before introduction" rule cannot be checked at build time; it becomes probabilistic. (b) There is no coherent module text that can be read from beginning to end without the simulator, while R1 names the textbook as the first of the three pillars. (c) A beginner meets a concept for the first time while busy with a stand-up, that is, under high extraneous load, and this contradicts `01` §8 R1/R11 (pre-training: names of the parts before the mechanism).

**Fix.** Turn the construction around and write this at the start of §4:

> Each module is a textbook chapter. A chapter is read linearly and is complete without the simulator: hook → worked example → process explainer (section R3) → coherent theory text with sources → check. The `flowlab` simulator is the chapter's practice; it opens after the text and uses only the concepts introduced by that point. Simulator observations and events do not "unlock" anything: they only link to paragraphs already read (a "back to § 2.3" button). If a pattern (for example, a widening CFD band) belongs to a concept from the next chapter, the observation describes it in the words of the current chapter, without the term ("work is piling up before testing"), and the term "bottleneck" appears in M3.

In the formats: remove `unlocks` from `scenario.yaml` and `events/*.yaml`, and check an observation's `theory:` field at build time: it must point to a paragraph introduced no later than the scenario's module. Rename review screen 5 to "What from the chapter you applied". Each chapter must have its own text volume; the target for L0 is 1,500–2,500 words per module, split into screens of 120 words (`01` §8 R4).

### 2. BLOCKING — Sankofa aesthetic, characters and plot in the explainers (R4, R5)

**Where:** §4 ("Explainers are assembled on the Sankofa scene engine (scrolling, layers, ink drawings)"), E1 ("ink drawing… a wall"), E6 ("blots"), E7 ("Elena wants…"), E8 ("tester Vika… owner Elena"), E11 (four character stories, "Rashomon"), §5.1 "Backstory", §12 (the row "Ink drawings… Characters, the board in explainers, failure blots… a single living style"; the row "Sound… of a pager").

**What is wrong.** R4: no cartoons, characters, plot or decorations; a diagram of blocks and arrows with labels on the lines; one screen — one idea. R5: clean engineering graphics in the spirit of Ciechanowski and Comeau, not Sankofa ink. From Sankofa we take only the magazine-style text presentation, scroll scenes, layers, calm mode, lenses, QR, bilingual YAML, `draft`/`hold`. Incidentally, `08` §5.1 will also have to be corrected: ink is still allowed there "for metaphors and characters".

**Fix.**
- Delete the §12 row "Ink drawings" entirely, delete the row "Sound via WebAudio" (it is a decoration; an incident is shown as a status on the diagram). Of `ink.ts`, keep only `rng(seed)`.
- In §4 replace "(scrolling, layers, ink drawings)" with "(scrolling, layers, calm mode; graphics — the `08` §5.1 blueprint style: 1.5 px line, 8 px grid, labels on arrows)".
- In explainers — roles instead of names: "developer", "tester", "operations", "product owner", "customer". No names, no avatars, no quoted lines of dialogue.
- Rewrite E1 as a diagram (ready text in finding 4, X0). E8 — as a diagram of a message's route through three organizational structures (finding 4, X5). E11 — lenses as *data sources*, not people's stories (finding 4, X4). This is closer to practice: the timeline of a postmortem is assembled from the monitoring graph, the deployment log, the on-call chat and support tickets.
- In the simulator (it is practice, not an explainer) it is acceptable to keep the "online tea shop" domain as a business model. People should be shown as roles with short neutral labels (`Dev-1`, `Dev-2`, `QA`, `Ops`, `PO`, "Customer"), without drawn avatars and without storylines like "Elena accepts your proposals less often". The trust mechanic (D1, `trust: elena`) is better turned into a visible indicator on the panel: "share of team proposals accepted by the customer", with the formula in "How the simulator works".

### 3. BLOCKING — the order of concepts rests on a separate glossary incompatible with the course graph

**Where:** §3 (`glossary.yaml` with a `module` field, "about 60 terms, forms are listed by hand", `forward: true`), §11 (`content/methodology/glossary.yaml`).

**What is wrong.** The product already has a single graph `content/concepts.yaml` (`01` §6) with ids M01–M18, and it is used by `10` (tasks are tagged "concepts M14–M16", "M07, M09") and by `08` §7.3 (a single `content/glossary.yaml`, the rule "a term is introduced in exactly one place"). 07 has its own numbering M0–M12 (modules), its own 50 rows of terms and its own linter. As a result: (a) two validators with different rules (`forward: true` here, `forward: [K01]` and no more than one per lesson in `01`, `allow_early` in `08`); (b) the AI mentor gets two different lists of introduced terms; (c) 07 re-introduces the Orientation concepts F08–F12 ("change", "version", "release", "code repository and merging"), while `08` forbids introducing a term twice; (d) module ids "M2" and concept ids "M02" look alike and will be confused in the data.

**Fix.** Ready text for §3:

> The block uses the shared graph `content/concepts.yaml` (`01` §6) and the shared validator (`08` §7.3). The block's modules are renamed to `meth.m0…meth.m12` so they are not confused with concept ids. Each screen declares `introduces` (≤ 1) and `uses`. The block does not introduce Orientation concepts (F07 client–request, F08 code and build, F09 version and release, F10 environments, F12 collaboration and merging) but uses them; for L1/L2 they are `placed`.

Mapping of §3 terms to the graph, and new concepts that I will add to `01` §6.2 (proposed ids and prerequisites):

| No. in §3 | id in the graph | Requires |
|---|---|---|
| 1–3 | M01 (life cycle, value for the user) | F08, F09, F10 |
| 4, 6 | M02 (development and operations; prod = F10; failure) | M01 |
| 5 | F09 (already introduced) | — |
| 7 | M03 (working definition; full one — M38) | M02 |
| — | M04 the path from idea to user (value stream), introduced in meth.m0 by explainer X1, see finding 4 | M01 |
| 8 | M05, M06 | M04 |
| 9 | M19 pull and push | M06 |
| 10–11 | M07 | M06 |
| 12 | M08 | M06 |
| 13–14 | M20 throughput and work item age | M08 |
| 15 | M21 Little's law | M07, M08, M20 |
| 16 | M22 CFD | M21 |
| 17 | M23 utilization and queue | M20 |
| — | M24 percentile and median (for p50/p85, "aging", SLE) | M08 |
| — | M25 SLE and Definition of Workflow (Kanban Guide) | M24, M07 |
| 18 | M26 variability and dependent events | M23 |
| 19 | M09 | M07, M08 |
| 20–21 | M27 five focusing steps, swarming | M09 |
| 22 | M11 (small batches) | M03, M08 |
| 23–24 | M28 cost of delay, CD3, classes of service | M11 |
| 25–28 | M18 (Agile, Scrum, Kanban, retrospective) — split into M18a Agile Manifesto, M18b Scrum, M18c Kanban method | M06, M11 |
| 29–31 | M29 work types, toil, single point of knowledge | M02, M06 |
| — | M10 automation as the main tool — **currently missing from §3**, introduced in meth.m6 (the answer to toil) | M03, M09 |
| 32 | F12 + C01 ahead (`forward`) | — |
| 33 | M30 build, automated test, environment | F08, F10 |
| 34–36 | M14, M15, M16 | — |
| 37–38 | M17, rollback — M31 | M15 |
| 39–40 | M13 DORA | M08, M11, M32 |
| 41–43 | M33 SRE, SLI/SLO/SLA, error budget (the idea) | M02, M24 |
| 44 | M34 alerting and monitoring (the idea) | M33 |
| 45 | M32 incident: detection, recovery, on-call | M02 |
| 46 | M12 blameless postmortem | M32, M11 |
| 47–49 | M35 Three Ways, M36 CALMS, M37 Westrum | M12, M13 |
| 50 | M38 DevOps in full, DevOps engineer | M35 |

I take two graph fixes on myself. In `01`, M13 (DORA) currently requires M12 (postmortem). This is an unnecessary link: DORA needs an incident caused by a deployment (M32), not a postmortem, and after the fix the 07 order "DORA in M8, postmortem in M10" becomes valid. O09 in monitoring will get the prerequisite M33 and become "SLI/SLO in PromQL" rather than a repeated introduction.

### 4. BLOCKING — the process explainers that R3 requires for methodology are missing

**Where:** §4.1.

**What is wrong.** R3 explicitly names three processes for methodology: "a task from idea to prod", "incident: alert → postmortem", "the flow bottleneck". E5 is a value stream map builder with sliders; it does not show the process itself (how one card moves through the stages). E11 assembles a timeline but does not show the chain "alert → page → acknowledgement → diagnosis → recovery → postmortem → tasks". E4 is dice, an honest mechanic, but without "break it" and without recalculation with an explanation next to it. None of the explainers is described per R4: steps with rewind, a click on every element, parameters with immediate recalculation and a line "what changed and why", "break it" as removal of a component.

**Fix.** Ready storyboards, all on `08` primitives: `stepper`, `diagram`, `breakit`, `packets` (a card token instead of a packet). Common rules for all: a time axis at the bottom, steps can be dragged, paused and stepped through with ←/→; every block and every arrow is clickable and opens a card "what it is / who does it / how to measure it"; any slider recalculates the whole process at once, and one line explaining the change appears to the right of the diagram; animation is only a token moving along an arrow, a counter growing, a block appearing.

**X0 "Two goals, one result" (meth.m0, replaces E1).** Screen 1: two blocks, "Development" and "Operations", with a "Prod" block above them. A "changes" arrow goes from development to prod, the label on the arrow: "N changes per deployment". Under each block is a counter of its goal: "features released", "days without a failure". A slider "deploy every: 90 / 30 / 7 / 1 days". With infrequent deployments, the number on the arrow and the probability of failure grow (the curve from the `flowlab` model, §6.4), and the operations counter drops. Explanation line: "A deployment every 30 days carries 40 changes; if something broke, the cause has to be found among 40". Screen 2: "break it" removes the dividing wall (it is drawn as the boundary between two groups), and both goals are replaced by a single counter "revenue per day = sales − losses from downtime − losses from unreleased work". Line: "A failure and an unreleased feature cost the same money". M03 (working definition) is introduced here. Three screens, no more.

**X1 "A task from idea to customer" (meth.m0 introduces M04; meth.m7 returns to it with the pipeline).** Screen 1: eight blocks from left to right: idea → selection → development → review → testing → waiting for deployment → deployment → with the customer. On each arrow, the label "waits: N h". One card token moves through the steps; at the bottom are two counters: "work" (a green bar grows while the token is inside a block) and "waiting" (a grey bar while the token is on an arrow). Screen 2: a click on any arrow shows why there is waiting there ("the reviewer is busy with another task", "deployments on Thursdays"). A slider "waiting on the arrow" at each arrow; the result is "flow efficiency = work / total time". Screen 3: a switch "batch: 1 / 5 / 20 cards" — the first card reaches the customer after X days instead of Y; the explanation line is recalculated. Screen 4: "break it" → remove the "testing" block; the token arrives faster, but with probability p it returns via a red arrow "defect at the customer" to the beginning, and the time counter grows. In meth.m7, the same thing as screen 5: the blocks "build", "automated tests", "deployment" become a single "pipeline" block, the waits on the three arrows collapse, and the boundaries of CI / continuous delivery / continuous deployment are highlighted on the diagram. A switch "last step: button / automatic". At the bottom, a forward link to the CI/CD block explainer "git push → deploy" (`forward`, without terms).

**X2 "Where the flow gets stuck" (meth.m3, complements E4).** Five stage blocks with a capacity slider on each (1–6 cards per day) and a switch "variability: none / dice". Between the blocks are queue counters; tokens move along the arrows. On the right are three counters: throughput, average cycle time, WIP; Little's line `WIP = TH × CT` is recalculated live. Steps: (1) equal capacities without variability — no queues; (2) turn on variability — queues grow before random stages, output below 3.5; (3) reduce one stage to 2 — a queue only before it, output = 2; (4) speed up a stage that is *not* the bottleneck: line "output did not change: this stage was already waiting"; (5) "break it" → remove the WIP limit: the queue before the bottleneck grows endlessly, cycle time grows, output is the same; (6) turn the limit on — cycle time drops, output is unchanged. A click on a queue opens "what a queue is and why it is not visible on a board without "done" columns".

**X3 "From alert to postmortem" (meth.m10; for meth.m9 — the first four steps).** Five horizontal lanes, time from left to right: "service" (a graph of the error rate), "monitoring", "on-call engineer", "customers" (a graph of lost orders), "error budget" (a shrinking bar). Steps: 1) a deployment with a defect — a marker on the "service" lane; 2) the error rate grows; 3) the SLI crosses the threshold, burn rate 14.4 — an alert (a "page" arrow to the on-call engineer); 4) acknowledgement (a "time to respond" counter); 5) diagnosis — which change was the latest (an arrow to the deployment log); 6) mitigation: rollback; 7) recovery, the graph returns to normal; 8) postmortem draft: the timeline is assembled from the markers of all lanes; 9) improvement tasks go to the board as cards. Parameters: "detection: no monitoring / availability check / SLO-based alert" (240 / 30 / 5 min, from §6.4), "rollback: yes / no", "instructions for the on-call engineer (runbook): yes / no", "deployment size: 1 / 10 changes". "Break it": remove the on-call rotation — nobody acknowledges the alert, after 15 minutes the page escalates to the backup; remove rollback — the path goes through a hotfix, a second (unplanned) deployment appears, the `rework` counter grows. The explanation line is recalculated on every change: "Without rollback, recovery took 120 minutes instead of 10; the month's budget was spent at 310%".

**X4 "One night through the data" (meth.m10, replaces E11).** The lenses are not people but sources: the error graph, the deployment log, the on-call channel, support tickets, an empty lens "customer feedback" (no metric). The learner assembles a timeline by dragging facts from the lenses onto a shared axis. The check mechanic stays from S7, step 1.

**X5 "How bad news travels" (meth.m11, replaces E8 without characters).** Three org structure diagrams (pathological, bureaucratic, generative) — blocks "testing", "development", "manager", "owner". A token "the payment test has been failing for a week" moves along the arrows; each arrow is labeled with a rule ("the messenger is punished", "a request on the proper form is needed", "reported immediately and to everyone"). The culture switch changes the rules on the arrows and recalculates "time until it reaches someone who can fix it". "Break it": remove the shared channel in the generative diagram — the time grows.

Each X needs a static frame for `prefers-reduced-motion` (`01` §8 R8) and a text description for screen readers (`08` §3.2).

### 5. BLOCKING — there is no documentation ladder (R2)

**Where:** there is no such section; the sources in §14 are only a list for authors.

**What is wrong.** R2 requires a ladder in every block. Methodology has its own "documentation": not man, but the primary sources that people actually open at work — the Scrum Guide (13 pages), the Kanban Guide, the SRE book and the SRE Workbook, dora.dev, the Agile Manifesto. For a beginner this is the first encounter with the habit of "opening the primary source, not a retelling", and that is why the methodology block is the best place to instill it before the terminal.

**Fix.** A new section "Primary source ladder":

| Step | Where in the block | What the learner sees | Check |
|---|---|---|---|
| 1. Glimpse | meth.m0–m2 | Paragraphs with definitions have a "where this comes from" icon: a link to the exact place (Kanban Guide → "Flow Measures"; Little 1961; SRE book ch. 5). Optional | None |
| 2. Fragment | meth.m2–m5 | A task hint is a fragment of the primary source with a highlighted line. The structure of a document is shown once: the Scrum Guide (Theory → Values → Team → Events → Artifacts with commitments), the Kanban Guide (Definitions → Practices → Flow Measures), an SRE Workbook chapter (principle → example → parameter table) | The task is checked as usual |
| 3. Find | meth.m5–m8 (L2 starts here) | Only a link to the document is given. Tasks: "Which commitment belongs to the Product Backlog?" (Product Goal); "What does the Kanban Guide call the forecast of how long a card takes, and where does it place it?" (Service Level Expectation, part of the Definition of Workflow); "How does dora.dev define deployment rework rate?" (the share of unplanned deployments caused by an incident in prod); "What is the maximum duration of the Sprint Review for a one-month sprint?" (4 hours) | The answer is checked automatically, plus a field "which section did you rely on" |
| 4. Forcing | meth.m9–m11 | Tasks on what is not in the chapter, and without hints. Examples below. For any question about such a task, the mentor first asks "where did you look?" and points to a section of the document (`01` §14.2, steps H1–H3 with the document instead of the lesson screen) | Automatic |
| 5. Exam | S8 and 9.2 | Only the primary source panel is open (Scrum Guide, Kanban Guide, SRE Workbook: Implementing SLOs, Alerting on SLOs, Error Budget Policy, Postmortem Culture; dora.dev metrics guide). Two tasks require something that is not in the course | Automatic |

Step 4 tasks (ready texts):
- **D4-1 (m9).** "In S6, turn on a second, slow alert. Find the threshold for the 3-day window in the SRE Workbook, "Alerting on SLOs"". Check: in the S6 policy `burn(72h) >= 1 → ticket` (10% of the budget over 3 days, a ticket, not a page).
- **D4-2 (m9).** "In the example error budget policy, find who settles the dispute if the teams do not agree with the budget calculation". Answer: escalation to the CTO (section "Escalation policy").
- **D4-3 (m10).** "Find in Postmortem Culture (SRE book, ch. 15) which events require a postmortem under Google's rules. Mark the incidents in the S7 log that fall under these rules". Check: the incidents selected are those with user-visible downtime above the threshold and with data loss.
- **D4-4 (m8).** "Calculate deployment rework rate from the log using the dora.dev definition, not the simulator's definition. How do they differ?" (the denominator is all deployments, the numerator is only unplanned ones caused by an incident).

Step 5 exam tasks that are not in the course:
- **E5-1.** "From the 9.2 export, state the team's SLE in the form the Kanban Guide gives". Answer: "85% of cards finish in N days or less", N = p85 with a tolerance of ±1 day.
- **E5-2.** "Your team's error budget policy must contain a section on what to do if a single large incident used up the budget. Find how this is handled in the Workbook example and apply it to the S8 situation" (a mandatory postmortem and a decision on a freeze based on its results).

---

## MAJOR

### 6. MAJOR — terms are used before they are introduced (specific violations)

**Where:** §5, §6.7–6.9, §7.

List by module (numbers refer to the §3 table):
- **S0 (m1):** "switching" and `O-multitask` — the term is not in §3. Add "switching between tasks" to m1: S0 is exactly what demonstrates it.
- **S1 (m2):** the "Review" and "Test" columns: "review" is not introduced anywhere, "test" is introduced in m7 (#33). "Percentile" (p85, the 85th percentile line, the "aging" frame in §5.3) is not introduced, and for an accountant this is a new concept. The observation `O-band-widening` leads to `theory.bottleneck` from m3 (see finding 1). Fix: in m0, introduce "check (test)" and "review" as work stages at an everyday level; in m2, introduce M24 "median and percentile" as a separate screen (ready text: "Sort 20 cards by cycle time. The 17th of 20 is the 85th percentile: 85% of cards took no longer than it").
- **S2 (m3):** "backlog" (m5, #26), "internal project" (m6, #29), "automated tests" (m7, #33); option D2 "write automated tests". Fix: in S2, name the card "Make the cart check automatic (a machine checks instead of a person)", and replace "backlog" with "Ideas" (the column already exists).
- **S4 (m6):** "SRE book" and "the 50% rule from the SRE book" (SRE is introduced in m9), "the first and second ways" (m11), "runbook" (not in §3 at all), "monitoring" (m9, #44), "pair work" and "on-call" (m10). Fix: present the 50% rule as an observation without the term SRE ("operations engineers need at least half of their time for improvements, otherwise toil grows"), and give the source in the card as `forward`; introduce "instructions for the on-call engineer (runbook)" and "working in pairs" in m6; remove "Three Ways" from the S4 theory.
- **S5 (m7):** "Goodhart's law" is not in §3; D9 "the second way" (m11). Introduce Goodhart in m8 (E10 is exactly what shows it), remove "the second way" from D9.
- **S6 (m9):** D4 "deploy in parts behind a flag": the feature flag is not introduced anywhere. Either introduce it in m7 with one screen, or replace the option with "deploy one feature out of five".
- **All modules from m0:** "feature" is used from E1 on, but it is not in §3; neither is "defect" (`WorkType 'defect'`). Add them to m0.
- **m8 tests:** "median" — see M24.

Add to §15 item 1: "running the term linter over all of the block's YAML is the first thing done before S1 is shown to learners".

### 7. MAJOR — modules are overloaded with concepts, there is no division into lessons and screens

**Where:** §3, §4.

**What is wrong.** `01` §8: no more than one new concept per screen, no more than four per lesson. Module m2 introduces eight (WIP, limit, cycle time, lead time, throughput, age, Little, CFD, utilization), m5 about fifteen (Agile, manifesto, sprint, product backlog, sprint goal, increment, definition of done, three accountabilities, events, Kanban method, retrospective). The document has neither lessons nor screens with `introduces`.

**Fix.** Split the modules into lessons per `01` §7 and specify a list of screens for each. For example, m2 → four lessons: "Work in progress and the limit" (M07; explainer E2 part 1) → "Cycle time, lead time, throughput, age" (M08, M20) → "Little's law and utilization" (M21, M23; E2 parts 2–3) → "Reading the CFD, median and percentile" (M22, M24); S1 rounds 1–2 after the second lesson, round 3 after the fourth. m5 → three lessons: "The Manifesto" → "Scrum" (two screens on accountabilities and events, one on artifacts and commitments) → "The Kanban method per the Kanban Guide" (with SLE and Definition of Workflow, see finding 12).

### 8. MAJOR — duplication with block A0 in `06`, discrepancy in the number of DORA metrics

**Where:** §4 (m7, m8), E5, E10, §13; `06` §1 "Block A0".

**What is wrong.** `06` A0 again introduces "change, build, test, release, pipeline, CI, Delivery, Deployment, DORA metrics" — and in doing so gives four DORA metrics (rework rate is only "a mention for the experienced level") and an ink diagram with a "little man". 07 introduces the same concepts in m7–m8 and correctly gives five metrics. The `08` §7.3 validator forbids two introductions of one term. In addition, my `01` §4.3 (L2 check, task 1) also lists four metrics — I will fix that.

**Fix.** Write in §13: "Concepts M13–M17 (CI, Delivery, Deployment, pipeline, DORA) are introduced only by this block (m7–m8). Block A0 from `06` is merged with m7: the "One line" screen (`when: manual`) moves to A5 as a reminder via the term card, the A0 quiz becomes part of the m7 bank. DORA everywhere — five metrics in two groups per dora.dev".

### 9. MAJOR — wrong references to where Git and CI practice live

**Where:** §3 #32 ("git — in the Linux/practice block"), §7 S5 ("CI — in the Docker block and in the pet project"), §13 ("'automated build and tests' — practice in the Docker block").

**What is wrong.** Per `01` §5, CI practice is a separate block "CI/CD with Git" after Docker; per `06` §0.1, it is modules A1–A6 after Docker, and Git is module G after Linux. Here `01` and `06` disagree with each other (Git at the start of CI/CD or after Linux), and I resolve that on my side in `01` in favor of `06`. But "the Docker block" as the place for CI practice is wrong according to either document.

**Fix.** #32: "git — module G (after Linux)". S5 and §13: "CI — the CI/CD block (A1–A6, after Docker); environments from code — the Ansible and Terraform blocks; SLO-based alerts — the monitoring block (C15)".

### 10. MAJOR — the placement test does not follow the common `01` / `10` format

**Where:** §2.2–2.4.

**What is wrong.** (a) There is no confidence mark ("guessed" does not count a concept), no key tasks, no retake after 72 hours with a different variant, no parameterized variants (`01` §4.1). (b) `10` §3.5: the L1 and L2 checks have at least two practical tasks in the sandbox, and they are key. P-I1…P-I6 contain not a single practical task; P-E contains one (P-E6). (c) `01` §4.3 and 07 §2.3 describe different tasks for the same block; there must be one source of truth, and it is 07, but in the `01` §4.2 format.

**Fix.** Add to §2.2: "Format and criteria — `01` §4.1 (≥ 80% and all key tasks, confidence, 72 hours, 3–5 variants by seed). The tasks in this section replace `01` §4.3 for methodology". Two practical key tasks on `flowlab`:
- **P-I7 (m2, key, practical).** "Five days of the board on the variant's seed. Set limits so that by day 5 customers have at least 6 cards". Goal in the `09` §2.4 format: `when: "flow.done.count>=6 && flow.day=5"`. Variants: 4 seeds; on each, the reference bot passes and the baseline bot does not.
- **P-I8 (m3, key, practical).** "A board for 10 days, one stage is slower than the others. Find it using the CFD and allocate people so that throughput over days 6–10 grows by at least 30% relative to days 1–5". Checked by metric.
- Mark P-E6 as key. Add **P-E7 (m10, key, practical):** a short S7 night in step mode, restore the service no later than step 8 (this is the `01` §4.3 L2-4 task). L2 criterion: 6 of 7 and all key tasks.

### 11. MAJOR — the deployment risk formula does not produce the stated numbers

**Where:** §6.4.

**What is wrong.** The document claims: a batch of 10 changes without automated tests breaks "in roughly half of cases", a single change with automated tests "in less than 5%". Let us plug into the formula. With `risk = 0.08`, `b = 10`, `testAutomation = 0`: Σ = 0.8; 1.4⁹ ≈ 20.7; 0.8 × 20.7 / 10 ≈ 1.65 → after `clamp` 0.9. Even with `risk = 0.04` the result is 0.86. A single change at the maximum available automation of 0.6 (S5: +0.3 +0.3): 0.03 + 0.08 × 0.4 = 0.062 — more than 5%. Both calibration points are violated; S5 ("share of failed ones around 40%") will not match this formula either.

**Fix (keeps the meaning "changes interact"):**

```
r_eff_i = card.risk_i × (1 − caps.testAutomation) × (1 + 0.05 × (batchSize − 1))
p_fail  = 1 − (1 − 0.02) × Π_i (1 − r_eff_i)
card.risk defaults to 0.03–0.08 by size (mean 0.05)
```

Check: `b = 10`, `r = 0.05`, no automation → `r_eff` = 0.0725, Π = 0.9275¹⁰ ≈ 0.47, p ≈ 0.54. `b = 1`, `a = 0.6` → `r_eff` = 0.02, p ≈ 0.04. The start of S5 (batches of 8–12, `a = 0`) gives 0.45–0.62, which is consistent with "around 40–50%". In §15 item 1, add a calibration property test: both points ±0.05 over 10,000 runs.

### 12. MAJOR — there is no Service Level Expectation and no Definition of Workflow

**Where:** §3 (m2, m5), S1 round 3, the "Promise" drill.

**What is wrong.** In Kanban Guide v2025.5, SLE and the Definition of Workflow are the foundation of the method, not an add-on. The document teaches "promising a date with 85% confidence" but does not call it SLE and does not give the concept "definition of workflow" (the start and end of work, policies, SLE). Meanwhile, all the metric definitions in §6.5 (what counts as the start, what counts as the end) are exactly the Definition of Workflow.

**Fix.** In m5, lesson "The Kanban method": two screens — "Definition of workflow: where work starts and ends, what rules the columns have" and "SLE: '85% of cards in 8 days or less'". In S1 round 3, rephrase the question: "State the team's SLE". Rename the "Promise" drill to "SLE". Add to the m5 bank: "Why does the Kanban Guide not contain the words 'lead time'?" Answer: the method measures cycle time between explicitly defined start and end points (they are part of the definition of workflow), while "lead time" means different things in different teams.

### 13. MAJOR — S0 does not match the switching rule from §6.3

**Where:** §7 S0, §6.3.

**What is wrong.** Per §6.3, at k = 6 the multiplier is max(0.4; 1 − 0.2 × 5) = 0.4, and each card gets 3/6 × 0.4 = 0.2 points per day. The card size in S0 is not specified. With 5 points, sequential work finishes the first card on day 2, and parallel work on day 25, not on day 5 as written. If S0 has its own rule, it is not described.

**Fix.** Set the size in S0 to "each card is 4 points" and write according to the formula: "one at a time: the first is done on day 2, all six on day 8; all at once: the first and all the others on day 20 (0.2 points per day per card)". The effect becomes even more visible. Or, for a milder version, limit parallelism in S0 to three cards: 3/3 × 0.6 = 0.6 points per day, the first is done on day 7.

### 14. MAJOR — S6 has no model under which an SLI can "miss" a failure

**Where:** §7 S6, §6.4.

**What is wrong.** `flowlab` models only minutes of downtime. But S6 requires a choice among five SLIs (CPU, share of successful checkouts, p95 response time, errors in logs, server uptime) and a failure that one SLI sees and another does not. That needs separate series; without them the scenario cannot be built.

**Fix.** Add "Reliability series" to §6.4 (per minute on incident days, per hour on the others):

```ts
interface ReliabilitySample { t: number; reqs: number; checkoutOk: number; checkoutAll: number;
  p95ms: number; cpu: number; hostUp: boolean; logErrors: number; }
type IncidentKind = 'down' | 'checkout-broken' | 'slow' | 'cpu-spike-harmless';
// down: hostUp=false, everything fails; checkout-broken: hostUp=true, cpu normal, checkoutOk/All→0.2;
// slow: p95ms ×8; cpu-spike-harmless: cpu 95%, users are not affected
```

The SLI is computed from the series; the budget is spent according to the chosen SLI, and the "true" damage according to `checkoutOk` and money. Observation `O-sli-blind`: "The chosen SLI is green, but orders per hour are 80% lower than usual" — with both graphs next to it.

### 15. MAJOR — pass thresholds are absolute, even though runs depend on the seed and on the learner

**Where:** S1 ("round 2 better than round 1 by 25%"), S5, S8 §9.1, P-E6.

**What is wrong.** In S1, a learner who already worked carefully in round 1 will not be able to improve the result by 25% and will not pass, even though they understood more than anyone. In S8, events are mixed by seed, and absolute thresholds ("downtime during the sale < 30 minutes", "frequency at least once every 2 days") are unreachable on some seeds even for the reference bot.

**Fix.** A common rule in §7: "Thresholds are set relative to the bots on the same seed. A scenario is passed if the result is no worse than `baseline + 0.6 × (reference − baseline)` on the key metric. The exam seed is chosen only from a pool on which the reference bot passes all dimensions and the baseline bot passes none (the pool is checked in CI)". S1: "p85 cycle time in round 2 is no more than the reference bot's on this seed × 1.2, *or* 25% less than in your round 1".

### 16. MAJOR — the S8 exam does not match the common format and the "AI model is off" rule

**Where:** §9.1, §9.3, §10 item 2.

**What is wrong.** `10` §0 item 6 and §6.1: an exam is 70% state-based checks, 30% "explain", critical checks, a retake after 24 hours with a new variant. `09` §0 and `01` §11.2: the built-in AI model is off during the exam. Here instead: "5 of 6 dimensions", and "Understanding" is checked by the AI model using the 9.3 rubric.

**Fix.** §9.1: "Format — `10` §6.1. The dimensions Flow, Delivery, Stability, Money, People are the practical part (70%), each is a goal with `when` over `flow` facts; critical: "Stability: downtime during the sale" and "Money". "Understanding" is two `explain` questions (30%), assessed by the learner against a reference answer or by their own AI model outside the engine, marked "self-assessment" in the record". Add to §10: "During the placement test, on exit tickets and in the exam, the "Why?" and "Conversation partner" buttons are inactive (`01` §14.1)".

### 17. MAJOR — its own check language and its own storage instead of the shared contracts

**Where:** §6.10, §6.11, §11 (`pass:`, `goal.check`).

**What is wrong.** (a) Pass conditions are written in `flowlab`'s own language, while `09` §2 introduces a single "facts → predicates" contract and the `CheckResult` format, from which `10` computes mastery. (b) Progress is stored in `localStorage` with a "download JSON" button, while `09` §3.1 and `01` §2.3 require the event log to be in IndexedDB and widget snapshots in `snapshots`; `localStorage` only for small UI details.

**Fix.** Keep the §6.10 language internal — for events and observations (it needs the functions `band().growth()`, `rand()`, which `09` does not have). For goals and passing — a shared predicate over a new fact area:

```ts
flow?: { scenario: string; seed: number; day: number;
  metrics: { wipAvg: number; th5: number; cycleP50: number; cycleP85: number; leadP85: number;
             deployFreq7: number; changeLead: number; cfr: number; recoveryMedian: number; rework: number;
             budgetLeftMin: number; moneyNet: number; toilShareOps: number; overtimeDays: number };
  done: { count: number; byType: Record<string, number> };
  bots: { baseline: FlowMetrics; reference: FlowMetrics } }
```

Example: `when: "flow.metrics.cycleP85 <= flow.bots.reference.cycleP85*1.2"`. `flowlab` is registered as an `08` widget (`mount`, `snapshot`/`restore`, `describe`) and as a tier A Worker module in `09` §1.3 (its own budget, for example 60 KB gzip). The decision log is written as `check.result` events and a snapshot in `snapshots`. QR transfer stays (it is `handoff` from `08` §3.9), and `localStorage` is used only for "last opened instruments tab".

### 18. MAJOR — the post-scenario review cannot be stepped through (R4)

**Where:** §8 screen 1, §6.11.

**What is wrong.** There is a "day strip" and "replay the day", but the run cannot be played back as an explainer (forward, back, pause) with recalculation and a line explaining the change. And this is a ready-made "flow bottleneck" explainer on the learner's own data.

**Fix.** Review screen 1 is a `stepper` (`08` §3.1) over the run log: a step is a day, the diagram shows the board and the CFD; add `flow.*` events to the `SimEvent` bus (`flow.card.move`, `flow.deploy`, `flow.incident`, `flow.decision`). A slider "column X limit" on a paused day recalculates the run from that day as a counterfactual (already present in §6.12), and a line appears on the right: "with a limit of 3, p85 cycle time would have been 7 days instead of 11: no queue built up before testing".

### 19. MAJOR — levels differ only in the set of modules, not in lesson order

**Where:** §2.1.

**What is wrong.** `01` §3 and §7: for L2 a lesson starts with a problem (productive failure), for L0 with a worked example; starting support steps S0 / S1 / S3. In 07, the "experienced" learner goes through the same chapters, just fewer of them, and it is not stated that for them the scenario comes *before* the text. Besides, the path "M7–M12 and scenarios S4–S8" contradicts itself: S4 belongs to M6.

**Fix.** Add to §2.1: "L2: in each chapter, first a challenge scenario (a short 10-day run with a goal), then the text based on the results of the attempt; documentation step — from 3. L1: the chapter from the first screen, collapsed L0 screens open on request; documentation step — from 2. L0: in full, step 1". L2 path: "M6–M12 and S4–S8".

### 20. MAJOR — there are no requirements for beauty and color meaning for this block (R5)

**Where:** §5.3 ("type (color and pattern)"), §12.

**What is wrong.** The `08` §5.2 tokens cover the kernel, networks and Kubernetes, but not work types, stages and money. Without tokens, every author will draw in their own way.

**Fix.** Add tokens to `08` §5.2 and reference them:

| Token | Meaning | Shape duplicate |
|---|---|---|
| `--c-work-feature` | A feature for the customer | Solid fill |
| `--c-work-internal` | Improvement and automation | Diagonal hatching |
| `--c-work-change` | Planned change | Dots |
| `--c-work-unplanned` | Unplanned work | Frame with a lightning-bolt notch in the corner |
| `--c-work-toil` | Toil | Horizontal hatching |
| `--c-wait` | Waiting, queue | Grey dashed line on the arrow |
| `--c-money` | Money, revenue | Monospace digit with ₽ / $ |
| `--c-budget` | Error budget | Thermometer bar, like `--c-limit` |

Board stages are neutral, without color: color on the board means only the work type. Instrument graphs follow the rules of `08` and of the visualization skill (a shared day axis, direct labels at the lines instead of a legend).

---

## MINOR

### 21. MINOR — the Scrum Guide 2020 speaks not of "roles" but of accountabilities

**Where:** §3 #26, m5 test.
In the Scrum Guide 2020, Product Owner, Scrum Master and Developers are accountabilities. Replace "roles" with "accountabilities" and add the artifact commitments: Product Goal, Sprint Goal, Definition of Done.

### 22. MINOR — the "Kingman formula" is labeled inaccurately

**Where:** E2.
For a single queue with exponential arrivals and service (M/M/1), the waiting time in the queue = ρ/(1−ρ) × service time exactly; the Kingman formula is an approximation for G/G/1 that reduces to the same thing in this case. The numbers 1 / 4 / 9 / 19 are correct. Write: "for the simplest queue (M/M/1); the Kingman formula generalizes this to any variability". At the same time, a slider "service time variability" can be added — that is Kingman.

### 23. MINOR — the switching rule's floor of 0.4 diverges from Weinberg's table

**Where:** §6.3.
Weinberg gives 25% useful time for 5 projects, while the model stops at 40%. Either write "Weinberg simplified to 4 tasks", or set the floor to 0.25.

### 24. MINOR — E6: the slow alert is described incorrectly

**Where:** E6.
"14.4 over an hour, 6 over 6 hours" are the two *fast* (paging) thresholds. The slow alert in the SRE Workbook is a burn rate of 1 over 3 days, and it creates a ticket. Fix this and align it with `06` C-D11 (the pairs of short windows 5 min / 30 min are already there).

### 25. MINOR — lead time is defined in different ways

**Where:** §3 #12 ("from when the request appears") and §6.2/6.5 (`createdDay` = appeared in "Ready for work").
Make them the same: "from appearing in 'Ready for work'", and state that this is part of the team's definition of workflow (see finding 12).

### 26. MINOR — P-E2 does not cover M2

**Where:** §2.4 P-E2.
DORA metrics from a deployment log check neither WIP, nor Little, nor the CFD. Remove the phrase "also covers M2", or add a table of cards and a question on Little to the log.

### 27. MINOR — review on its own schedule instead of FSRS

**Where:** §9.4 ("after 1, 3 and 7 days"), §9.5.
Per `01` §10 and `10` §5, review goes through FSRS per concept, and the drill is also review. Replace with "wrong answers put the concept into the FSRS queue (`01` §10)". Bring the module quiz size of 6–10 in line with `10` §4 (4–6 tasks, block quiz — 20–25).

### 28. MINOR — the "copy the request" mode and the provider list are already decided in `09`

**Where:** §10.
`09` §4.1 has already checked CORS (18.11.2026) and does not support YandexGPT and GigaChat in the MVP. Replace the last paragraph with a reference to `09` §4 and §4.5 (mentor hint); "copy and paste" should either be added to `09` or removed.

### 29. MINOR — sources: Accelerate in Russian and Featureban

**Where:** §14.
The link mybook.ru/…/smart-reading/… leads to a Smart Reading summary, not to the book. The Russian edition «Ускоряйся! Наука DevOps» (Accelerate: The Science of DevOps) was published by «Интеллектуальная литература» (Intellektualnaya Literatura, part of the Alpina group); verify the publication details and year against the publisher's site. For Featureban, the primary source is the Agendashift page, while esicenter.bg is a retelling; the CC BY-SA 4.0 license is confirmed by the author's slides. For the Kanban Guide, state version v2025.5.

### 30. MINOR — there is no "How this course works" screen and no link to Orientation

**Where:** introduction, §2.1, m0.
`01` §12.1 requires a screen about desirable difficulties in the first methodology lesson, and `01` §3 requires a mini-block "Orientation" for L0 before methodology. Add a first screen to m0 (ready text: "Here we will often ask you to recall rather than reread. It feels slower, but a week later you remember twice as much. Mistakes in predictions are part of the work; they do not count toward the grade") and a line in §2.1: "L0 comes here after Orientation (F01–F12)".

### 31. MINOR — time budget and minor inconsistencies

**Where:** §2.1, §3 #44.
The hours (12–14 / 7–8 / 4) diverge from `01` §13 (12 / 8 / 5); after adding the chapters and explainers X0–X5, recalculate and send me the figures for `01`. "Prometheus — in block 07 of the roadmap" — write "the monitoring block", because "07" here is also the document number. `O-hero`: "3 incidents out of the last 3" — specify the window (for example, 3 of the last 4 within 10 days), otherwise the observation fires in the first days of S4 under any strategy.

---

## What does not belong to this block

R6–R12 (kernel, containers, networks, Kubernetes networking, the reconciliation loop, multi-node v86, three stages of Kubernetes) concern blocks `02`–`05` and `09`. The only link to methodology worth recording in §13: the reconciliation loop explainer (R10) uses the same "desired — actual" pair as the Definition of Workflow and SLE. From there, it is worth linking to m5 as the learner's first encounter with the idea "the system constantly compares the goal and the fact".
