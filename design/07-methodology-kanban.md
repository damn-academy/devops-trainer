# 07. The "Methodology" block: DevOps, flow, Kanban, CI/CD as a value stream, SRE

This document designs the first step of the roadmap from the checklist (`source/checklist.txt`, item 01: "What CI/CD and the DevOps methodology are. It is important to understand what tasks you face and why the business needs them"). The block comes first after the "Orientation" mini-block (F01–F12, document `01` §3), so it has to work for a person with no IT experience: before it the learner has not seen Linux, git or containers. Hence the main constraint: everything about CI/CD is explained at the level of the flow of work and decisions, and the pipeline is built by hand later, in the CI/CD block (modules A1–A6 of document `06`, after Docker), in the Ansible and Terraform blocks and in the pet project. Here the learner understands why a pipeline is needed, what steps it consists of and how to measure that it has become better.

## 0. What the block consists of and in what order

The block rests on three pillars, and the order of their importance is set by the product owner.

1. **The textbook.** Each module is a chapter that can be read from start to finish without the simulator. Concepts are introduced strictly in the order of the shared graph `content/concepts.yaml` (document `01` §6): no more than one new concept per screen, no more than four per lesson, a term does not appear before its own screen. The order is checked by the build, not by editing (section 3).
2. **Process explanations.** Each chapter has at least one step-by-step process explanation: a diagram of blocks and arrows with labels on the lines, steps forward, back and pause, every element is clickable, sliders and switches immediately recalculate the process, "break it" removes a component. The owner assigned the methodology three mandatory processes: a task from idea to production (X1), an incident from alert to review (X10), the bottleneck of the flow (X4). There are thirteen explanations in total (section 5).
3. **The habit of opening the primary source.** Methodology has its own documentation: the Scrum Guide, the Kanban Guide, the SRE book and the SRE Workbook, the metrics guide on dora.dev, the Agile Manifesto. The block leads the learner up a five-rung ladder from "this definition is taken from here" to tasks that are not in the course (section 6). Methodology is the best place to lay down this habit even before the terminal: the documents are short and written in plain human language.

Practice rests on these pillars. Its main tool is the `flowlab` flow simulator: a board on which the learner runs the work of a small team of an online tea shop, sets limits, decides whether to automate or fight fires, lives through incidents and sees how the cumulative flow diagram, cycle time, throughput and the DORA metrics change. The simulator opens after the chapter text and uses only concepts already introduced. Its observations do not "unlock" anything: they refer to paragraphs already read.

This is not a game. The simulator has no points, levels, lives, rewards, characters or plot. There is a model of production that honestly shows the consequences of decisions, and a review that explains why things turned out as they did. People on the board are designated by roles, the customer by a job title, requests come as internal memos. Genre references: the training simulations getKanban and Featureban, the business simulation The Phoenix Project from GamingWorks and the explorable explanations of Bret Victor and Nicky Case.

The anatomy of a module, the same for all chapters:

```text
Module MTx =
  1. Textbook chapter: lessons per 01 §7 (hook → worked example → process explanation
     → connected theory text with EN and RU sources → practice → exit ticket).
     The primary-source ladder rung depends on the learner's level (section 6).
  2. Process explanation X… inside the lesson (the "watch" step).
  3. Simulator scenario — the chapter's practice. Observations refer to paragraphs of the chapter.
  4. Module quiz and drills; mistakes go into the FSRS review queue (01 §10).
```

---

## 1. What we take from existing simulations and what we do differently

| Product | What works in it | What is missing for us | Decision |
|---|---|---|---|
| **getKanban** (Russell Healy), a board game, 4–6 people per board, specialists are dice of different colors | Dice as capacity variability; defects, blockers, policies; CFD and control chart; events by day | Needs a facilitator and a group; no operations, deployment, incidents; metrics are counted by hand | We take capacity as a random variable per specialist, events by day, the CFD. We add operations, deployment, incidents, SRE |
| **Featureban** (Mike Burrows, Agendashift) | Iterations: without limits → with limits → with metrics on a cleared board, limits are kept; strict mode blocks violations | Too abstract: no value and no business | We take the structure "the same process without limits, then with limits" in S1 and the "strict limits" mode. We confirm the license and the iteration scheme against the author's materials; until then the source card is in `hold` (section 16) |
| **The Phoenix Project simulation** (GamingWorks, 10–12 people, 4 rounds) | Business context, business pressure, rounds as an evolution of maturity, reflection after a round | In person only, expensive, the plot is closed | We take the idea of rounds and a review after each one. We have no plot and no characters; the book remains a source of theory |
| **Kanban Flow Simulation** (Businessmap), kanbansim, Insight Maker | Limits per column, highlighting of violations, a live CFD | No manager decisions and no explanations | We take violation highlighting and the live CFD; we add decisions, observations, links to the chapter |
| **Dice game** from Goldratt's "The Goal" (thedicegame.pages.dev, DiscreteEvents.jl) | Dependent events + fluctuations reduce line output with equal average capacities | A single idea | Explanation X3 before X4 |
| **Penny game** (coins, batches 20 → 5 → 1) | Batch size and time to first value | A single idea | Explanation X5 |
| **Parable of the Polygons** (Vi Hart, Nicky Case) | A model you touch before the formulas; a prediction before running | — | The principle "predict first, then look" is built into the explanations and the simulator (section 8.9) |

The main difference of our simulator: it is deterministic by seed and records a log of decisions. This enables a review with counterfactual runs ("if on day 4 you had not taken two urgent features, the p85 cycle time would have been 6 days instead of 11"), replaying a day with a different decision and playing back one's own run as a step-by-step explanation (section 10).

---

## 2. Levels of preparation and the level check

### 2.1. What each level means in this block

**Beginner (L0).** A person with no IT experience: a sales manager, an accountant, a teacher. They come after Orientation (F01–F12), so they already know the words "source code and build", "version and release", "environment: development, test, production", "collaborating on code and merging". The block does not define them again, it uses them (`uses: [F07, F08, F09, F10, F12]`). They can work with a task queue: a salesperson runs a funnel, and that funnel is structured like a board. The hooks of the first chapters rely on this. Lesson order per `01` §7: hook → worked example and process explanation → try → text → practice along the support ladder S0→S3 → ticket. The primary-source ladder rung grows by chapter from 1 to 4 (section 6). Path: all modules MT0–MT12, all scenarios. Time estimate — 14 hours.

**Intermediate (L1).** Has worked next to an IT team, but not as a programmer: an analyst, a tester, a support specialist, a project manager, a system administrator. Has managed tasks in a tracker, heard "sprint" and "CI/CD", seen incidents, but has not measured flow and cannot explain why a work-in-progress limit speeds a team up. A chapter starts from the first screen, L0 screens are collapsed and open on request. The primary-source ladder starts from rung 2. Path: MT0 and MT1 are credited by the check, MT2–MT12 are taken, S0 is skipped, in S3 only the "flow" half is played, and the "sprint" half is shown as a finished run of the reference bot for comparison. Estimate — 8 hours.

**Experienced (L2).** A programmer or administrator who has not worked as a DevOps engineer: uses git and pull requests, has seen a build pipeline, has worked with Scrum. Most often they have false confidence in two places: they confuse continuous delivery with continuous deployment and believe that speed and stability have to be traded off against each other. The lesson order for them is reversed (productive failure, `01` §3): in each chapter first a 10-day challenge scenario with a goal, then the text based on the attempt, process explanations in "mechanism only" mode (`08` §4). The primary-source ladder starts from rung 3, rung 4 from MT7. Path: the level check, then MT6–MT12 and scenarios S4–S8; the rest is available as a reference. Estimate — 5 hours.

The L0 budget grew from 12 to 14 hours compared to `01` §13: connected chapters and thirteen process explanations were added. The figures 14 / 8 / 5 have been passed to the author of `01`.

### 2.2. The logic of the check

The format and criteria are shared, per `01` §4.1: the learner chooses the level themselves; the "Show what you can already do" check confirms the choice of "Intermediate" or "Experienced"; before each answer there is a confidence mark ("I know", "I think so", "a guess"), and a correct answer marked "a guess" does not credit the concept; the check is passed with ≥ 80% and all key tasks (`key: true`); a repeat after 72 hours with a different variant (each task has 3–5 parameterized variants by seed), two attempts. The level is never changed forcibly. Each task is tagged with graph concepts (`concepts`), a failed concept becomes a "gap", and a lesson opens for it even at a high level.

The tasks in this section are the canon for methodology and replace `01` §4.3. At least two practical tasks in each check are done in the `flowlab` simulator and checked by a predicate over the run facts (`10` §3.5, `09` §2). The tasks do not check memorized definitions: each one requires calculating, ordering, reading a diagram or choosing a decision in a situation. The built-in AI model is off during the check (section 12).

### 2.3. Check for the intermediate level (8 tasks, about 20 minutes)

**P-I1* (M21, Little's law, number, key).** "The team's 'in progress' columns hold 12 tasks on average. The team finishes 3 tasks a day on average. How many days on average pass from the start of work on a task to its completion?" Answer 4, tolerance 0. The typical mistake 36 (multiplied) gets a separate explanation. Variants: WIP ∈ {8, 12, 15, 18}, throughput ∈ {2, 3}, the answer is always an integer or has one decimal place.

**P-I2 (M22, reading a CFD, click).** A cumulative flow diagram for 20 days with the bands "Ready to start", "Development", "Review", "Testing", "Done"; the "Testing" band widens from day 8, the "Done" line is almost horizontal. "Click the area where work is piling up and choose what it means". Correct: a click inside the "Testing" band on days 8–20 and the option "testing cannot keep up, this is the bottleneck". A click on the "Development" band is explained separately: it is even, it only looks wide.

**P-I3 (M27, the five focusing steps, choice).** "There is one tester and they cannot keep up, the developers are idle. What should be done first?" Options: (a) the developers take new features so as not to be idle; (b) the developers help with testing, no new features are started; (c) hire a second tester; (d) raise the limit of the "Testing" column. Correct: (b). Explanation: (a) will increase the queue before testing and the cycle time; (c) is an acceptable but expensive and slow "elevate" step, which per Goldratt comes after "exploit" and "subordinate"; (d) hides the problem.

**P-I4 (M29, types of work, sorting).** Six cards into four bins ("business project", "internal project", "change", "unplanned work"): "a new discounts page", "moving the site to a new server", "renew the hosting contract", "the site does not open for customers", "add a payment method", "urgently export a report for the tax office that nobody planned". Credited at 5 matches out of 6; "renew the contract" is credited both as "change" and as "unplanned work" if the card's hint says the contract has already expired.

**P-I5 (M14–M16, pipeline, ordering).** Put the steps of a change's path in order: "the change is merged into the shared code repository", "automated build", "automated tests", "deployment to the test environment", "checking on the test environment", "deployment to production". Then mark where continuous integration ends (after the automated tests) and how continuous delivery differs from continuous deployment (the last step by a button or by itself). Credited if the order is correct and both boundaries are marked.

**P-I6* (M44, error budget, number + choice, key).** "The site's availability target is 99.9% over 30 days. How many minutes of full unavailability does this target allow?" Answer 43.2 (±0.5). Then: "Over the last four weeks there were three full outages of 20 minutes each. Marketing wants to deploy a big change tomorrow. What does the error budget policy from the SRE Workbook say?" Correct: the budget is exceeded by 16.8 minutes, so changes and releases are frozen until the service is back within the SLO; exceptions are P0 fixes and security fixes. Variants by seed: SLO ∈ {99.5; 99.9; 99.95}, two or three outages of 5–25 minutes; in half of the variants the budget is not exceeded, and then the correct answer is "the policy does not forbid the deployment". This checks that the learner knows the freeze condition rather than repeating "the budget is almost gone — stop".

**P-I7* (M07, WIP limit, practice in the simulator, key).** "Five days of the board on the variant's seed. Set the limits so that by day 5 at least 6 cards are done". Goal: `flow.day=5 && flow.done.count>=6`. Four seeds; on each the reference bot reaches the goal and the baseline one does not (checked in CI).

**P-I8* (M09, bottleneck, practice in the simulator, key).** "A board for 10 days, one stage is slower than the others. Find it using the CFD and assign people so that throughput over days 6–10 grows by at least 30% compared to days 1–5". Goal: `flow.metrics.th6to10>=flow.metrics.th1to5*1.3`. Four seeds with a different slow stage.

### 2.4. Check for the experienced level (7 tasks, about 35 minutes)

**P-E1 (M15, M16, choice + explanation).** "In your team every change after merging is automatically built, passes the tests and lands on the test environment; production is deployed by the on-call person with a button once a week. Is this continuous integration, continuous delivery or continuous deployment? What needs to change to reach the next level?" Correct: continuous delivery; the explanation should say "every change that passes the pipeline goes to production automatically, without a manual step". The explanation is assessed with a rubric of three key elements (automatically, every change, without a manual decision); the learner compares it with the reference themselves.

**P-E2* (M13, DORA from a log, numbers, key).** A log of 10 deployments over two weeks: commit time, deployment time, failure yes/no, recovery time, planned or unplanned. Calculate the deployment frequency per week, the median change lead time (from commit to running in production), the change failure rate, the median time to restore after a failed deployment and the share of unplanned deployments caused by an incident. All five numbers ±5%. The log is generated by `flowlab` from the variant's seed.

**P-E3 (M13, choice among close options).** "The manager says: 'We'll deploy less often, but more reliably'. What does DORA research say about this?" Correct: for most teams speed and stability are positively correlated, frequent small changes are easier to deploy and roll back; reducing the batch size improves both groups of metrics. The option "a balance between speed and stability has to be found" is explained as a common misconception.

**P-E4 (M34, burn rate, number + choice).** "The SLO is 99.9% successful requests over 30 days. Over the last hour 2% of the error budget was consumed. What is the burn rate and what should be done?" Answer 14.4 (2% of the budget in 1 hour with a 720-hour window) ±0.5; the choice "urgent alert, wake up the on-call person" is the threshold from the SRE Workbook, "Alerting on SLOs".

**P-E5 (M12, editing text).** A sentence from a report: "The outage happened because a developer carelessly ran a migration script in production". Rewrite it in the format of a blameless review. Automatic check: no judgmental words from the list (carelessly, negligently, the fault of, made a mistake, forgot) and no person in the role of the cause; there is a description of conditions (the script can be run in production without confirmation; the test environment and production have the same database names).

**P-E6* (M29, M43, practice in the simulator, key).** A 10-day run (`placement-exp`): a board with overloaded operations, where the only employee who knows production carries incidents, routine work and deployments. Goal: p85 cycle time by day 10 no worse than `baseline + 0.6 × (reference − baseline)` on the same seed. People usually succeed if they stop starting new work, set a limit and put into work the card "describe and automate the manual deployment".

**P-E7* (M32, practice in the simulator, key).** A short S7 night in step mode: an alert came in, the service must be restored no later than step 8 (80 minutes of model time). Goal: `flow.incident.restoredStep<=8`.

L2 criterion: 6 out of 7 and all key tasks.

---

## 3. Strict order of introducing concepts

### 3.1. The rule and the mechanism

The block uses the shared graph `content/concepts.yaml` (`01` §6), the shared glossary `content/glossary.yaml` and the shared term validator (`08` §7.3). The block has no glossary of its own. Modules are named `MT0…MT12` (in the data — `methodology/MT2`), so that they cannot be confused with the concept ids `M01…`. Concept ids are maintained by the author of `01`; below is the mapping and the proposed new ids, passed on to them.

Each chapter screen declares `introduces` (no more than one concept) and `uses`. Term word forms in two languages are stored in the shared `08` glossary (the `stems` field), a term refers to a graph concept, and the concept in `concepts.yaml` has `introduced_in: methodology/MT2.3`. The `08` §7.3 validator goes through chapter texts, diagram labels, the texts of explanations, scenarios, events, decisions, observations, questions and hints, and fails if a word form of a concept appears before its screen. A forward reference is allowed only as `allow_early: [id]` with a reason and is shown as "this is covered in chapter MT7", not as a term. A simulator observation whose `ref:` points to a paragraph of a chapter later than the current one is a build error. The learner's connected AI model receives the same list of introduced concepts (section 12).

The block does not re-introduce the Orientation concepts: F07 "client, request, response", F08 "source code and build", F09 "version and release", F10 "environments, including production", F12 "collaborating on code and merging". For L1 and L2 they are `placed`.

### 3.2. Order of concepts by lesson

| Lesson | Concept (id) | Terms and word forms on the screen | Requires |
|---|---|---|---|
| MT0.1 | M01 Lifecycle and value | product, user (customer), value, change, feature, defect | F08, F09, F10 |
| MT0.1 | M02 Development and operations | development, operations, outage (incident) as "production works badly or does not work" | M01 |
| MT0.2 | M04 The path from idea to user (value stream) | stage, handoff, waiting; stages: selection, development, review (code checked by a colleague), testing, deployment | M01 |
| MT0.2 | M03 DevOps, working definition | development and operations are responsible for a shared result; the full definition is M38 | M02, M04 |
| MT1.1 | M05 The task card and the definition of done | task, card, "done" | M04 |
| MT1.1 | M06 Board and columns | board, column, "in progress / done" sub-columns | M05 |
| MT1.2 | M19 Pull and push | pull, push | M06 |
| MT1.2 | M39 Switching between tasks | multitasking, switching losses | M06 |
| MT2.1 | M07 Work in progress and its limit | work in progress (WIP), WIP limit | M06 |
| MT2.2 | M08 Cycle time and lead time | cycle time, lead time | M06 |
| MT2.2 | M20 Throughput and work item age | throughput, work item age | M08 |
| MT2.3 | M21 Little's law | Little's law and its conditions | M07, M08, M20 |
| MT2.3 | M23 Utilization and queue | utilization, queue, waiting | M20 |
| MT2.4 | M24 Median and percentile | median, 85th percentile | M08 |
| MT2.4 | M22 Cumulative flow diagram | CFD, band, arrival and departure lines | M21 |
| MT3.1 | M26 Variability and dependent events | variability, dependent events | M23 |
| MT3.1 | M09 Bottleneck | bottleneck (constraint), idle time | M07, M08, M26 |
| MT3.2 | M27 The five focusing steps and swarming | identify, exploit, subordinate, elevate, repeat; swarming | M09 |
| MT4.1 | M11 Small batches and feedback | batch size | M03, M08 |
| MT4.1 | M28 Cost of delay and the order of work | cost of delay, CD3, class of service, expedite lane | M11 |
| MT5.1 | M18a The Agile Manifesto | four values, twelve principles | M06, M11 |
| MT5.2 | M18b Scrum: team and accountabilities | Scrum team, product owner, Scrum master, developers — accountabilities | M18a |
| MT5.2 | M18c Scrum: events and artifacts | sprint, planning, daily event, review, retrospective; product backlog, sprint backlog, increment; commitments: product goal, sprint goal, definition of done | M18b |
| MT5.3 | M18d The Kanban method | the three practices of the Kanban Guide; the four mandatory flow metrics | M07, M08, M20 |
| MT5.3 | M25 Definition of workflow and service level expectation | Definition of Workflow, SLE | M24, M18d |
| MT6.1 | M29 The four types of work | business project, internal project, change, unplanned work | M02, M06 |
| MT6.1 | M42 Toil | toil | M29 |
| MT6.2 | M43 The single person who knows | the single person who knows (a single point of failure in people) | M29 |
| MT6.2 | M40 A runbook for the on-call person and pairing | runbook, pairing | M43 |
| MT6.2 | M10 Automation as the main tool | automation | M03, M09, M42 |
| MT7.1 | M30 Build, automated test, test environment | automated build, automated test, test environment | F08, F10, M10 |
| MT7.1 | M14 Continuous integration (CI) | continuous integration | F12, M10, M30 |
| MT7.2 | M15 Continuous delivery | continuous delivery (Continuous Delivery); in Russian «поставка» is a synonym word form | M14, F10 |
| MT7.2 | M16 Continuous deployment | continuous deployment (Continuous Deployment) | M15 |
| MT7.3 | M17 The deployment pipeline and flow efficiency | pipeline, flow efficiency | M14, M15, M04 |
| MT7.3 | M31 Rollback and recovery | rollback, hotfix, time to restore | M15 |
| MT8.1 | M13 DORA metrics | five metrics in two groups | M08, M11, M31, M02 |
| MT8.1 | M41 Goodhart's law | a metric that has become a target | M13 |
| MT9.1 | M33 SRE and SLI/SLO/SLA | SRE, SLI, SLO, SLA | M02, M24 |
| MT9.1 | M44 Error budget and budget policy | error budget, budget policy, freeze | M33 |
| MT9.2 | M34 Monitoring and burn-rate alerting | monitoring, alerting, burn rate, page versus ticket | M44 |
| MT10.1 | M32 Incident response | detection, diagnosis, mitigation, recovery, on-call duty, escalation | M02, M31, M34 |
| MT10.2 | M12 Blameless review | review (postmortem), timeline, contributing factors | M32, M11 |
| MT11.1 | M35 The Three Ways | flow, feedback, continual learning and experimentation | M12, M13 |
| MT11.1 | M36 CALMS | Culture, Automation, Lean, Measurement, Sharing | M35 |
| MT11.2 | M37 Westrum's typology of cultures | pathological, bureaucratic, generative | M35 |
| MT11.2 | M38 DevOps in full and the DevOps engineer | DevOps engineer; the main tool is automation (the checklist's wording) | M35, M10 |

What changed in the `01` graph and was passed to its author: M13 (DORA) requires not M12 (review) but M31 (recovery after a failed deployment), so DORA in MT8 before the review in MT10 is a legitimate order; M04 is introduced in MT0 as the path of a single task, and flow efficiency along this path in MT7 (M17); M18 is split into M18a–M18d; M19–M44 were added. O09 in monitoring (`06`, C15) gets the prerequisite M33/M44/M34 and becomes "SLI/SLO and burn rate in PromQL" rather than a repeated introduction.

### 3.3. Concepts that are not in the chapter but are needed by the simulator

Scenario texts are checked by the same validator, so the names in the simulator depend on the chapter:

- before MT5 there is no word "backlog": the column is called "Ideas", the selected work — "Ready to start";
- before MT6 there is no "internal project" and no "automation": in S2 the improvement is called "A checklist and prepared data for checking the cart";
- before MT7 there is no "automated test", "test environment", "rollback": the "roll back" option of the dilemma is hidden while `caps.rollback=false`;
- before MT9 there is no "monitoring": in S4 the internal project is called "A signal when the site goes down";
- before MT11 there is no "first and second way";
- "feature flag" is not introduced in the block at all; its dilemma is replaced by the option "deploy one feature out of five".

---

## 4. Textbook: the block's chapters

For each chapter the following are given: the lessons, the screens with the concepts they introduce, the process explanation, the connected theory text (what it is about and which primary sources it relies on), the primary-source ladder rung for L0 and the practice. Screen text is up to 120 words for L0 and up to 180 for L1/L2 (`01` §8 R4); the length of an L0 chapter is 1,500–2,500 words.

| Module | Topic | Lessons | Explanations | Scenario | Levels |
|---|---|---|---|---|---|
| MT0 | Why the business needs development and operations | 2 | X0, X1 (screens 1–4) | — | L0, L1 (collapsed) |
| MT1 | Work becomes visible | 2 | — (a worked example on the board) | S0 | L0 |
| MT2 | Flow | 4 | X2 | S1 | L0, L1 |
| MT3 | Bottleneck and variability | 2 | X3, X4 | S2 | L0, L1 |
| MT4 | Batches and cost of delay | 1 | X5 | a "CD3" drill on the board (10 days) | L0, L1 |
| MT5 | Agile, Scrum, Kanban | 3 | X6 | S3 | L0, L1 |
| MT6 | Types of work, toil, automation | 2 | X7 | S4 | all |
| MT7 | The deployment pipeline | 3 | X1 (screens 5–8) | S5 (part 1) | all |
| MT8 | DORA and Accelerate | 1 | X8 | S5 (part 2) | all |
| MT9 | SRE: SLO and error budget | 2 | X9 | S6 | all |
| MT10 | Incidents and review | 2 | X10, X11 | S7 | all |
| MT11 | Culture and the full definition of DevOps | 2 | X12 | — | all |
| MT12 | Practical exam | — | — | S8 + live data | all |

### MT0. Why the business needs development and operations

**Lesson MT0.1 "The product and two sides".** The first screen is "How this course works" (`01` §12.1), with no new concepts: "Here we will often ask you to recall rather than reread. It feels slower, but a week later you remember twice as much. Mistakes in predictions are part of the work; they do not count towards the grade". Hook: "An online shop makes money as long as the site works and has what customers need. In an hour you will be able to explain why two different departments take care of this and why they argue". Screen M01: product, customer, value; a change is any edit to the product; a feature is a new capability for the customer; a defect is a change that does not work as intended. Screen M02: development makes changes, operations keeps production running; an outage is when production works badly or does not work. Then explanation X0: two goals, one result.

**Lesson MT0.2 "The path of a task and the working definition of DevOps".** Screen M04 — explanation X1, screens 1–4: one task goes through the stages from idea to customer, and almost all the time it is waiting. Screen M03: the working definition — "a way of working in which development and operations are responsible for a shared result: changes reach customers quickly and do not break the site". Theory text: the conflict of goals from "The DevOps Handbook" (ch. 1, the "wall of confusion" as a concept, without the picture), the value stream per the "Handbook" (ch. 7) and DORA. Ladder rung: 1 (a "where this comes from" badge next to the DevOps definition → DORA "Capabilities", next to the task path → "The DevOps Handbook", ch. 7). Ticket: "A customer clicked 'pay', the money was not charged, and this has been going on for an hour. Is this a change, an outage or a deployment?"; "Development is assessed by the number of features, operations by the days without outages. Why is this a conflict?"; transfer: choose the stage where the task waits longest, using the diagram of a new path.

### MT1. Work becomes visible

**Lesson MT1.1 "The card and the board".** Hook — a task list in a messenger where it is unclear what has been started. Screen M05: a task is a card with a definition of done ("done when the customer sees the new page"). Screen M06: the board, columns for the stages of the path from MT0, "in progress / done" sub-columns. Worked example: the same work on three boards (a list, a single "in progress" column, columns by stage).

**Lesson MT1.2 "Pulling and switching".** Screen M19: we take new work when a slot frees up, not when it is handed to us. Screen M39: one person on several tasks — each one goes slower, and the total is smaller (Weinberg's table). Practice — S0 "One desk". The theory text relies on the Kanban Guide (the practice "Actively managing items in a workflow") and Weinberg. Ladder rung: 1.

### MT2. Flow

Four lessons, per `01` §7, with two concepts at most each.

- **MT2.1 "Work in progress and the limit"** (M07). A worked example on the S0 board; S1 round 1 starts after this lesson.
- **MT2.2 "Time and output"** (M08, M20). Cycle time — from the start of work to done; lead time — from appearing in "Ready to start" to done; throughput — cards per day; age — how many days a started card has been in progress. After the lesson — S1 round 2.
- **MT2.3 "Little's law and utilization"** (M21, M23). Explanation X2 "A queue at one worker". Text: Little's law and its conditions per Vacanti (the system is stable, everything started gets finished, the average age does not grow), utilization and the growth of waiting.
- **MT2.4 "Reading a CFD"** (M24, M22). Screen M24: "Sort 20 cards by cycle time. The seventeenth is the 85th percentile: 85% of the cards took no longer than it". Screen M22: the CFD bands, the vertical distance is WIP, the horizontal distance is roughly the cycle time. After the lesson — S1 round 3.

Primary sources: Kanban Guide v2025.5, the "Flow Metrics" section (WIP, Throughput, Work Item Age, Cycle Time); Little (1961); Vacanti; Kaiten on reading a CFD (RU). Ladder rung for L0 — 1, for L1 — 2 (hints for S1 are fragments of "Flow Metrics" with the line highlighted).

### MT3. Bottleneck and variability

- **MT3.1 "Why averages lie"** (M26, M09). X3 "Dice" and X4 screens 1–3.
- **MT3.2 "Five steps"** (M27). X4 screens 4–6; text based on Goldratt's "The Goal" and "The DevOps Handbook" (ch. 2, the theory of constraints). The "make everyone work" trap and its link to M23 (utilization).

Practice — S2. Ladder rung for L0 — 1.

### MT4. Batches and cost of delay

**Lesson MT4.1** (M11, M28). X5 "Batch size"; screen M28: cost of delay — how much money we lose for every day the change is not with the customers; CD3 — cost of delay divided by duration; class of service and the expedite lane — different rules for different kinds of cards. Text based on Reinertsen and Black Swan Farming. Practice — the "CD3" drill on the board: 10 days, 8 features with different costs of delay, the learner chooses the order of pulling, the review compares it with FIFO. Ladder rung for L0 — 2: the first encounter with the anatomy of a document (the Black Swan Farming page "Cost of Delay": definition → example → formula).

### MT5. Agile, Scrum, Kanban

- **MT5.1 "The Manifesto"** (M18a). Four values and twelve principles, each tied to an already familiar mechanic: "responding to change" — small batches, "working software" — the definition of done.
- **MT5.2 "Scrum"** (M18b, M18c). Screen M18b: the Scrum team and three accountabilities (that is what the 2020 Scrum Guide calls them: accountabilities, not roles) — product owner, Scrum master, developers. Screen M18c: events (the sprint — up to a month; planning, the daily event, review, retrospective) and artifacts with commitments: the product backlog — the product goal, the sprint backlog — the sprint goal, the increment — the definition of done. One more `uses` screen without a new concept: timeboxes.
- **MT5.3 "The Kanban method"** (M18d, M25). Screen M18d: the three practices of the Kanban Guide — defining and visualizing the workflow, actively managing items in the workflow, improving the workflow — and the four mandatory metrics (WIP, throughput, age, cycle time). Screen M25: the Definition of Workflow with six minimal elements — the unit of value, where work starts and ends, the states, WIP control, explicit policies, the SLE; and the SLE — "85% of cards finish in 8 days or faster", based on cycle time history. The learner is told directly: "In S1 you already made such a promise. It has a name". A separate paragraph: the Kanban Guide does not use the term "lead time", because the method measures cycle time between explicitly defined start and end points, while "lead time" means different things in different teams; in our course it is the time from appearing in "Ready to start" to done, and this is part of our board's Definition of Workflow.

Explanation — X6 "One piece of work, two boards". Practice — S3. Ladder rung for L0 — 2 (the anatomy of the Scrum Guide and the Kanban Guide is shown here), for L1 — 3.

### MT6. Types of work, toil, automation

- **MT6.1 "What eats up time"** (M29, M42). The four types of work from "The Phoenix Project" and toil per the SRE book, ch. 5: manual, repetitive, grows with the service and leaves no lasting value. The rule "operations engineers need at least half of their time for improvements" is introduced as an observation; the fact that it comes from SRE practice is stated with a forward reference to MT9 (`allow_early: [M33]`, reason "the source of the rule").
- **MT6.2 "One person for everything"** (M43, M40, M10). The single person who knows, a runbook for the on-call person and pairing as a way to pass on knowledge, automation as the answer to toil. Text: "The DevOps Handbook" (ch. 1–2), SRE book ch. 5.

Explanation — X7 "A team's month by type of work". Practice — S4. Ladder rung for L0 — 2, for L1 — 3.

### MT7. The deployment pipeline

- **MT7.1 "Build and continuous integration"** (M30, M14). X1 screen 5. Text based on Fowler: every change is frequently merged into the shared branch and checked automatically; a red pipeline is fixed first.
- **MT7.2 "Delivery and deployment"** (M15, M16). X1 screen 6. Text based on Humble & Farley and continuousdelivery.com. The "One line" screen from the former block A0 of document `06`: the last block of the diagram is either a "Release" button or an "automatically" arrow; in A5 the learner will see the same thing as `when: manual` in YAML. A sentence for the chapter: "Continuous deployment has no generally accepted abbreviation; in an interview, name the practices in full".
- **MT7.3 "The pipeline and rollback"** (M17, M31). X1 screens 7–8, then the builder (screen 9). Flow efficiency = working time / total time.

Practice — S5 part 1. Ladder rung: L0 — 2, L1 — 3, L2 — 4 (from this chapter).

### MT8. DORA and Accelerate

**Lesson MT8.1** (M13, M41). The five metrics per dora.dev in two groups. Throughput: change lead time (from a commit to the version control system to running in production), deployment frequency, time to restore after a failed deployment. Instability: change failure rate (deployments after which immediate intervention is needed — a rollback or a hotfix) and the share of unplanned deployments caused by an incident in production (deployment rework rate, added by DORA in 2024, in the Quick Check since April 2026). The Accelerate conclusion: speed and stability are not enemies. Goodhart's law and DORA's warning not to turn metrics into targets. Explanation — X8. Practice — S5 part 2. Ladder rung: L0 — 3, L1 — 3.

### MT9. SRE: SLO and error budget

- **MT9.1** (M33, M44). SRE as operations engineering; SLI — what we measure, SLO — what target we set, SLA — what we promise by contract with consequences (the SLO is usually stricter than the SLA). Error budget = 1 − SLO. A request-based SLO consumes the budget in proportion to the share of errors: a minute in which 10% of requests fail costs one tenth of a minute of full downtime. The budget policy following the SRE Workbook example: if over the previous four weeks the budget was **exceeded**, changes and releases stop until the service is back within the SLO; exceptions are P0 and security fixes.
- **MT9.2** (M34). Monitoring and burn-rate alerts: two page thresholds (14.4 over 1 hour with a short window of 5 minutes; 6 over 6 hours with a short window of 30 minutes) and a ticket (1 over 3 days with a short window of 6 hours). Why not 100%.

Explanation — X9. Practice — S6. Ladder rung: L0 — 3, L1 — 4.

### MT10. Incidents and review

- **MT10.1 "Response"** (M32). X10 "From alert to review". First restore the service, then look for the cause; on-call duty and escalation.
- **MT10.2 "A blameless review"** (M12). X11 "One night from the data". A timeline from all sources, the question "what did you see at that moment", contributing factors instead of culprits. Text: SRE book ch. 15, Workbook ch. 10, the Etsy Debriefing Facilitation Guide, Dekker.

Practice — S7. Ladder rung: L0 — 4, L1 — 4.

### MT11. Culture and the full definition of DevOps

- **MT11.1** (M35, M36). The Three Ways from "The DevOps Handbook" and CALMS; each way and each letter is tied to a mechanic already covered (WIP limits — the first way; automated tests and alerts — the second; reviews and time for improvements — the third).
- **MT11.2** (M37, M38). Westrum's typology (X12), the full definition of DevOps and the role of the DevOps engineer: "a person who puts this methodology into practice; the main tool is automation".

Ladder rung: L0 — 4.

### MT12. Practical exam

S8 "Black Friday" and "live data" (section 11.1). Ladder rung — 5 for everyone.

---
## 5. Process explanations

### 5.1. General rules for all explanations

All explanations are built on the `08` lesson engine from the primitives `stepper` (steps with a timeline), `diagram` (a live diagram bound to the model state), `breakit` ("break it" switches), `packets` (a token moves along an arrow; here the token is a card or a message) and `lenses` (switching data sources). The model that recalculates the process is the same `flowlab` code as in the simulator, so the numbers in the explanation and on the board match.

- **Graphics are only a blueprint** (`08` §5.1): line 1.5 px, corner radius 6 px, 8 px grid, value labels in monospace IBM Plex Mono 12–13 px, block labels in Inter 14 px semibold (fonts — `08` §6.4). No ink drawings, no characters, no lines of dialogue, no plot, no sound. Blocks are named by roles and stages: "development", "testing", "operations", "product owner".
- **One idea per screen.** A screen introduces no more than one concept.
- **Labels on lines.** Every arrow is labeled: what goes along it and how long it waits.
- **Everything is clickable.** A click on a block or an arrow opens a card "what it is / who does it / how to measure it / where it is in the primary source".
- **Parameters recalculate immediately.** Any slider or switch recalculates the whole process, and to the right of the diagram one line "what changed and why" appears with numbers from the model.
- **"Break it"** removes a component (a stage, a limit, rollback, the on-call person), the diagram shows the consequences, and the explanation line says why.
- **Steps, not video.** A stepper: forward, back, pause, the ←/→ keys, dragging along the timeline. Animation is only a token moving along an arrow, a counter growing, a block appearing; autoplay lasts no longer than 5 seconds.
- **Accessibility.** For `prefers-reduced-motion` each step has a static frame (`01` §8 R8); each diagram has a text description for a screen reader (`08` §3.2); color is always duplicated by shape.
- **Forward references.** X1 on its last screen refers to the `06` explanation "The path of a commit to production" (`git push → webhook → runner → image → environment`), X10 to the monitoring block explanation "scrape → storage → PromQL → alert → notification". Both references are `allow_early` without terms: "how this works inside — in the CI/CD block".

Table of explanations:

| id | Title | Chapter | Process | In the previous revision |
|---|---|---|---|---|
| X0 | Two goals, one result | MT0 | How deployment frequency changes the size and risk of a deployment | E1 "The wall of confusion" |
| X1 | A task from idea to production | MT0 (1–4), MT7 (5–9) | The path of one task through the stages; waiting; the pipeline | E5 "The path of a change" (became screen 9) |
| X2 | A queue at one worker | MT2 | Utilization, queue, Little's law | E2 "The coffee shop queue" |
| X3 | Dice: dependent events | MT3 | Fluctuations on a line of stations | E4 |
| X4 | Where the flow gets stuck | MT3 | Bottleneck, five steps, swarming | new |
| X5 | Batch size | MT4 | Batch 20 → 5 → 1 | E3 "Coins" |
| X6 | One piece of work, two boards | MT5 | Sprint and flow on one queue | E7 "The Manifesto line by line" |
| X7 | A team's month by type of work | MT6 | How unplanned work crowds out everything else | E9 |
| X8 | Five gauges | MT8 | How batch size and automated tests move the DORA metrics | E10 |
| X9 | Nines and the budget | MT9 | How outages consume the budget, when alerts fire | E6 |
| X10 | From alert to review | MT10 | An incident from a deployment with a defect to improvement tasks | new |
| X11 | One night from the data | MT10 | Assembling a timeline from sources | E11 |
| X12 | The path of bad news | MT11 | A message through three types of organizations | E8 |

Below are the storyboards. Columns: what is on the screen; what moves; what is clickable; parameters and "break it"; what is recalculated and which explanation line appears.

### 5.2. X0 "Two goals, one result" (MT0, 3 screens)

Diagram: a "Development" block on the left, an "Operations" block on the right, a "Production" block above them, a "Customers" block below them. A "changes" arrow from development to production, labeled "N changes per deployment". Under development is a counter of its goal "features released", under operations — "days without an outage". The team makes on average 1.3 changes per working day.

| # | On screen | Moves | Click | Parameters / "break it" | Recalculation and explanation |
|---|---|---|---|---|---|
| 1 | Two goals, one arrow | Change tokens pile up at the "Development" block and go to production in a batch | Block → "who this is and how they are assessed"; arrow → "what a deployment is" | Slider "deploy once every: 90 / 30 / 7 / 1 days" | 90 days → 120 changes per deployment, the outage risk per the `flowlab` model hits the 90% ceiling; 30 → 40 changes; 7 → 9 changes, risk 49%; 1 → 1 change, risk 7%. Line: "A deployment once every 30 days carries 40 changes; if something breaks, the cause is searched for among forty" |
| 2 | Why operations slows deployments down | The "days without an outage" counter drops after every large deployment | Counter → the risk formula (section 8.4) | The same slider | Line: "Every deployment is a risk for the operations goal, so it benefits from deploying less often, and development from deploying more often. The goals are opposite" |
| 3 | One goal | The two counters merge into one "revenue per day" | Counter → "sales − losses from downtime − losses from unreleased work" | "Break it": remove the boundary between the groups | Line: "An outage and an unreleased feature cost the same money: with a deployment once every 30 days the shop loses X ₽ a day on waiting and Y ₽ on outages" (X, Y from the model). The working definition of DevOps (M03) is introduced here |

### 5.3. X1 "A task from idea to production" (MT0 screens 1–4, MT7 screens 5–9)

Diagram from left to right: `Idea → Selection → Development → Review → Testing → Waiting for deployment → Deployment → Customers`. Between the blocks are arrows labeled "waits: N h". Under the diagram is a time strip: the solid part is work (`--c-flow-active`), hatching is waiting (`--c-wait`). Counters: "work", "waiting", "flow efficiency".

| # | On screen | Moves | Click | Parameters / "break it" | Recalculation and explanation |
|---|---|---|---|---|---|
| 1 | One card goes along the path | A card token moves step by step; the work strip grows while the token is inside a block, the waiting strip while it is on an arrow | Block → "what is done here"; arrow → "why it waits here" ("the reviewer is busy with another task", "deployments on Thursdays") | — | "Out of the 12 days on the path, the card was worked on for 1.5 days". Efficiency 12.5% |
| 2 | Where it waits longest | The longest hatching is highlighted | Arrow → a waiting card with the reason | A "waits" slider on each arrow, 0–72 h | "Waiting for the deployment window was cut from 72 to 8 h → the path is 9.3 days, efficiency 16%" |
| 3 | Many cards at once | Five tokens move along the diagram, a pile grows before "Review" | Pile → "this is a queue; on the board it is visible only if there is a 'done' sub-column" | Slider "cards in progress at the same time" 1–10 | "WIP 6 → waiting before review grew from 0.5 to 3 days" |
| 4 | Without testing | — | — | "Break it": remove the "Testing" block | The token gets through faster, but with the defect probability (the `flowlab` model) it returns along a red arrow "defect at the customer" to the start of the path. "Without testing the path is 2 days shorter, but every fifth card goes through it twice" |
| 5 (MT7) | Manual build → automatic | A "build manually" block and the waiting "waiting for the build" before "Testing" | Block → "build" (F08); a "CI" bracket over "Development → build → automated tests" | Switch "automatic build after merging"; "break it" — remove the automatic build | "The 'waiting for the build' wait (1 day) is gone: testing 10 minutes after merging". The "continuous integration" bracket ends after the automated tests |
| 6 (MT7) | The last step | The token stops before "Deployment" at a button or passes by itself | Button → "continuous delivery"; the "automatically" arrow → "continuous deployment" | Switch "last step: button / automatically"; slider "share of checks done by machine" 0–100% | "A button is continuous delivery: any tested change can be deployed at any moment. Automatically is continuous deployment". "Share of checks done by machine 60% → the risk of deploying one change 7% → 4%" |
| 7 (MT7) | Batches | Tokens gather into a batch before "Deployment" | Batch → "batch size" (M11) | Slider "batch size" 1–20 | "Batch 10 → risk 54%, diagnosing the outage takes 1 h 45 min, because it is unclear which of the ten changes is to blame" (the formulas of section 8.4) |
| 8 (MT7) | Rollback | After a red "outage" mark the token returns along the "rollback" arrow | Arrow → "rollback and recovery" (M31) | "Break it": remove rollback | "Without rollback recovery takes 120 minutes instead of 10: the path goes through a hotfix, and a second, unplanned deployment appears" |
| 9 (MT7) | The builder | The learner "buys" improvements themselves: automatic build, automated tests, a deployment button, deployment without a window | Each improvement → which wait it collapses | All parameters of screens 2–8 | The goal of the screen: flow efficiency ≥ 40%. At the bottom is a forward reference to "The path of a commit to production" (`06`) |

The boundary with `06`: X1 shows the organizational path (waits, handoffs, batches, the boundaries of CI and CD). The mechanics `git push → webhook → runner → job → registry → deployment` are an explanation of the CI/CD block.

### 5.4. X2 "A queue at one worker" (MT2, 4 screens)

Diagram: `Incoming → Queue → Worker → Done`. On the "Incoming → Queue" arrow the label "λ requests per hour", on the "Worker" block — "t minutes per request". On the right, a chart of queue length and waiting time over time. The lesson hook may mention a familiar queue (a checkout, a coffee shop), but the diagram is blocks.

| # | On screen | Moves | Click | Parameters / "break it" | Recalculation and explanation |
|---|---|---|---|---|---|
| 1 | Prediction | — | — | Question: "The worker is busy 90% of the time. How many times longer does a request wait compared to 50% utilization?" (almost the same / twice as long / about 9 times) | The answer is recorded, the comparison is on screen 2 |
| 2 | Utilization and waiting | Tokens arrive randomly, the queue grows and shrinks | The "Worker" block → "utilization = λ × t" | Sliders λ and t | For the simplest queue (M/M/1) the waiting time in the queue = ρ/(1−ρ) × t: at 50% — 1t, 80% — 4t, 90% — 9t, 95% — 19t. Line: "Utilization 90% → a request waits 9 times longer than it is served" |
| 3 | Spread | The same | "Spread" → Kingman's formula | Slider "spread of service time" (coefficient of variation 0–2) | Kingman generalizes the formula to any spread: waiting ≈ ρ/(1−ρ) × (cₐ² + cₛ²)/2 × t. "Half the spread → waiting at the same utilization is 37% shorter" |
| 4 | Little's law | Counters "in the system", "arrive per minute", "time in the system" | The Little line → the conditions of the law | "Break it": raise λ above 1/t | "There are 6 requests in the system on average = 2 per minute × 3 minutes". After breaking: "More arrives than the worker can handle: the queue grows without bound, Little's law does not apply — the system is unstable" |

### 5.5. X3 "Dice: dependent events" (MT3, 3 screens)

Diagram: five stations in a line, queue counters between them, each station has a 1–6 die. Each turn a station processes as many as it rolled, but no more than what is in its queue. The average capacity of each is 3.5.

| # | On screen | Moves | Click | Parameters / "break it" | Recalculation and explanation |
|---|---|---|---|---|---|
| 1 | Prediction | — | — | "How many will come out per turn on average?" | — |
| 2 | 20 turns | Tokens move between stations; the queues before some of them grow; an output counter | Station → its roll and idle time; queue → "why it grows" | Buttons "turn" and "20 turns"; switch "spread: none / die" | Without spread the output is 3.5. With a die it is less: a station's shortfall cannot be made up later if its queue was empty. "In 20 turns 58 came out instead of 70: station 3 stood idle for 6 turns with an empty queue" (numbers from a run on the seed) |
| 3 | Where to improve | The same | — | For one station: "stronger" (die 2–7) or "weaker" (0–5) | "We strengthened station 2 — the output did not change. We strengthened the one that is actually slowest — the output grew". Transition to X4 |

### 5.6. X4 "Where the flow gets stuck" (MT3, 6 screens)

Diagram: `Ready to start → Development → Review → Testing → Done`. Above each station a capacity label ("testing: 2/day"), under each station the queue as a pile, on the right three counters (throughput, average cycle time, WIP) and the Little line `WIP = TH × CT`, recalculated live. Under the diagram a small CFD of the same days.

| # | On screen | Moves | Click | Parameters / "break it" | Recalculation and explanation |
|---|---|---|---|---|---|
| 1 | Equal capacities of 3/day | The flow is even, there are no queues | Counter → definition (M20, M08) | Slider "incoming per day" 1–5 | "Input 4 is greater than capacity 3 → the queue before the first stage grows without bound" |
| 2 | Slow testing | A pile grows before "Testing"; a band widens on the CFD | Station → "a bottleneck is the stage that sets the pace of the whole system" | Capacity sliders for each station | "System output = the capacity of the slowest station: 2/day. Speeding development up to 6 achieved nothing: development was waiting anyway" |
| 3 | Without a limit | The pile before testing grows every day | Pile → M07 | "Break it": remove the WIP limit on development | "Without a limit the queue before testing grows, the cycle time grows, the output is the same: 2/day". Bringing the limit back → "With a limit of 3 the queue is no more than 3, the cycle time drops from 11 to 5 days, the developers are free" |
| 4 | Exploit and subordinate | Testing has no idle time and no switching | The label "exploit" → a paragraph of the chapter | Switch "testing is not distracted by other work" | "Testing without switching: 2 → 2.4/day" |
| 5 | Swarming | Free developers move over to testing | "Swarming" → M27 | Slider "developers helping testing" 0–1 (coefficient 0.5 from section 8.3) | "Testing capacity 2.4 → 3.2; the bottleneck moved to review" (highlighted) |
| 6 | Five steps | The labels "identify, exploit, subordinate, elevate, repeat" attach to the actions of screens 2–5 | Each step → a paragraph of chapter MT3.2 | A stepper by step | "Step 5: after elevating, review became the bottleneck — we start over" |

### 5.7. X5 "Batch size" (MT4, 4 screens)

Diagram: four stations in a row, `Station 1 → 2 → 3 → 4 → Customer`. 20 tokens. Each station "processes" a token (flips it) in t seconds; t is taken from the learner's pace at station 1, where they click the tokens themselves, and the other stations work with the same t. Passing on happens only as a whole batch.

| # | On screen | Moves | Click | Parameters / "break it" | Recalculation and explanation |
|---|---|---|---|---|---|
| 1 | Batch of 20 | The learner flips 20 tokens, the batch moves on | Arrow → "batch: how many go at once" | — | Table: the first token reaches the customer after 80t, the last after 80t |
| 2 | Batch of 5 | The same in batches of 5 | — | — | First — 20t, last — 35t |
| 3 | Prediction and batch of 1 | Before the round, the question "how many times faster will the customer get the first token?" | — | — | First — 4t, last — 23t. "Time to first value shrank 20 times, total time 3.5 times" |
| 4 | Transfer to changes | The tokens become changes, the "customer" becomes production | Token → "change" (M01) | Slider "batch size" 1–20 and switch "cost of delay: 2,000 ₽/day per change" | "Batch of 20 → changes reach the customer on average N days later, losses X ₽". A link to the next screen of the chapter (M28) |

### 5.8. X6 "One piece of work, two boards" (MT5, 4 screens)

Diagram: one and the same queue of 12 features with different costs of delay (labels "₽/day" on the cards) and two boards one above the other. On top, "sprint": the day axis is split into segments of 5 days, each segment labeled "sprint goal". Below, "flow": a board without segments, with limits above the columns.

| # | On screen | Moves | Click | Parameters / "break it" | Recalculation and explanation |
|---|---|---|---|---|---|
| 1 | Two boards on one piece of work | Cards move along both boards at the same time, a shared day counter | Sprint segment → "sprint, planning, review, retrospective" (M18c); limit → M07 | — | — |
| 2 | The sprint as a limit | On the upper board as many cards enter the sprint as were chosen at planning | Sprint backlog → the "sprint goal" commitment | Slider "sprint length" 5 / 10 days | "Sprint of 10 days → up to 8 cards in progress at the same time, cycle time 7 days; 5 days → up to 4, cycle time 4 days. A sprint is also a limit on work in progress, only in time" |
| 3 | Something urgent in the middle of a sprint | An urgent card arrives in the middle of a segment | Card → "class of service" (M28) | Switch "break the sprint / wait for the next one"; the flow has an expedite lane with a limit of 1 | "Waiting for the next sprint: the urgent item reaches customers in 6 days. Expedite lane: in 2 days, the other cards were delayed by 1 day" |
| 4 | Compatibility | The lower board fits inside the segments of the upper one | Label → Kanban Guide for Scrum Teams | "Break it": remove the sprint goal | "Without a sprint goal the sprint is filled from the list, and the review shows a set of tasks instead of a result". Conclusion: Scrum and Kanban are compatible, a WIP limit inside a sprint is acceptable |

### 5.9. X7 "A team's month by type of work" (MT6, 3 screens)

Diagram: a timeline of 20 working days horizontally, and vertically four bands of team capacity by type of work (`--c-work-feature`, `--c-work-internal`, `--c-work-change`, `--c-work-unplanned`, toil — `--c-work-toil`). On the right a counter "share of unplanned work this week".

| # | On screen | Moves | Click | Parameters / "break it" | Recalculation and explanation |
|---|---|---|---|---|---|
| 1 | Sorting | The learner sorts 8 cards into four bins | Bin → the definition of the type (M29) | — | A wrong bin — an explanation at the card |
| 2 | A month without internal projects | The unplanned work band grows week after week | Band → "where it comes from" (incidents, toil grows with the service) | Slider "share of time for internal projects" 0–40% | Model: share of unplanned work per week `U(w+1) = clamp(U(w) × 1.05 × (1 − 0.6 × I(w)), 0.1; 0.9)`, starting at 0.45. "0% → after a month 55% of the time goes to unplanned work; 20% → 27%" |
| 3 | The single person who knows | All unplanned work goes through one "Operations" block | Block → M43 | "Break it": operations goes on vacation for 5 days | "Without a runbook for the on-call person, two incidents wait for their return: X ₽ lost". The switch "runbook and pairing" → "the incident is closed in an hour" |

### 5.10. X8 "Five gauges" (MT8, 4 screens)

Diagram: a panel of five gauges in two groups with group labels ("throughput", "instability"), under the panel a small model of a change's path from X1 (screens 5–8) with the same parameters.

| # | On screen | Moves | Click | Parameters / "break it" | Recalculation and explanation |
|---|---|---|---|---|---|
| 1 | Five metrics | The gauge needles settle according to the run | Gauge → the dora.dev definition and from which event to count | — | — |
| 2 | Batch size | The needles move together | Gauge → the formula from the model | Slider "batch size" 1–20 | "Batch 10 → 1: frequency ×10, change lead time 6 days → 0.8, change failure rate 54% → 7%. A smaller batch improves both groups" |
| 3 | Automated tests | The same | — | Slider "share of checks done by machine" 0–100%; "break it": remove rollback | "Without rollback the time to restore is 155 min instead of 45: the path goes through a hotfix, and every failed deployment produces one more, unplanned one" |
| 4 | A metric as a target | Deployment frequency grows, while the "features at the customers" counter stands still | Label → Goodhart's law (M41), the DORA warning | Switch "bonus for the number of deployments" | "The frequency was inflated with empty deployments: the gauge is green, the value for the customer is the same". The "gauge that lies" mechanism is `lyingProgress` from Sankofa's `features/engine/decay.ts`, applied to data, without illustrations |

### 5.11. X9 "Nines and the budget" (MT9, 4 screens)

Diagram: an SLO slider on top; under it three scales of allowed unavailability; below, a month axis (30 days) with a thermometer strip for the budget (`--c-budget`) and two rows — the error rate and the burn rate with threshold lines.

| # | On screen | Moves | Click | Parameters / "break it" | Recalculation and explanation |
|---|---|---|---|---|---|
| 1 | Nines | The scales change length | Scale → the formula `(1 − SLO) × window` | SLO slider 90–99.999% | 99% — 7.2 h over 30 days; 99.5% — 3.6 h; 99.9% — 43.2 min (10.1 min per week, 1.44 min per day); 99.95% — 21.6 min; 99.99% — 4.32 min; 99.999% — 26 s |
| 2 | An outage consumes the budget | The learner places an outage on the axis (drags a segment), the thermometer goes down | Segment → duration and error rate | Sliders "duration" and "share of failed requests" 1–100% | "20 minutes at 10% errors = 2 bad minutes, 4.6% of the budget; 20 minutes of full downtime = 46%". Minutes of full downtime are the special case of an error rate of 1 |
| 3 | When the alert will fire | On the burn rate row, lines at 14.4 (1 h window), 6 (6 h window), 1 (3-day window) | Line → the SRE Workbook threshold table, "Alerting on SLOs" | The same error rate slider | Burn rate = error rate / (1 − SLO). "Error rate 20% → burn rate 200 → a page after 5 minutes. 1% → burn rate 10: the 14.4 threshold is not crossed, the 6-over-6-h threshold fires after 3.6 hours. 0.2% → burn rate 2: only a ticket over 3 days" |
| 4 | Why not 100% | A scale of the cost of each next nine | Nine → "what has to be built" | Switch "a customer on mobile internet" | "The customer's connection is available 99.5% of the time: they will not notice the difference between our 99.99% and 99.999%, but it costs more than the previous nine" |

### 5.12. X10 "From alert to review" (MT10, 9 steps)

Diagram: five horizontal lanes, time from left to right in minutes. Lanes: "Service" (an error rate chart), "Monitoring" (burn rate with thresholds), "On-call" (action marks), "Status channel" (messages), "Error budget" (a shrinking strip). On the right, counters: time to detect, time to restore, budget consumed in bad minutes, lost revenue. In step 1, MT9 uses screens 1–4 as preparation; the explanation is shown in full in MT10.

| Step | What happens | Label on the line | Click |
|---|---|---|---|
| 1 | A deployment; the error rate rises to 20% | "deployment #41, 3 changes" | Mark → the deployment log |
| 2 | The burn rate crosses 14.4 (1 h window, 5 min short window) | "page threshold" | Line → the threshold in the Workbook |
| 3 | The alert goes to the on-call person, who acknowledges it | "time to detect = 5 min" | The "page" arrow → "a page wakes a person up, a ticket does not" |
| 4 | The first status update in the channel: what we see, what we are doing, when the next update is | "status 1" | Message → the status template |
| 5 | Diagnosis: which change was the last one | an arrow to the deployment log | — |
| 6 | Mitigation: rollback; the error rate drops | "time to restore = 60 min" | The "rollback" arrow → M31 |
| 7 | Recovery confirmed, the final status | "status 3: restored" | — |
| 8 | A draft review: the timeline is assembled from the marks of all lanes | "fact ↔ time" | Mark → its source |
| 9 | Contributing factors turn into tasks on the board | "factor → task" | Task → a card on the S8 board |

Parameters: "detection: no monitoring / server availability check / SLO alert"; "rollback: yes / no"; "runbook for the on-call person: yes / no"; "deployment size: 1 / 3 / 10 changes"; "error rate" 1–100%. "Break it": remove the on-call rotation — nobody acknowledges the alert, after 15 minutes it escalates to the backup; remove rollback — the path goes through a hotfix, a second, unplanned deployment appears, the share of unplanned deployments grows; "an alert on CPU load instead of the error rate" — the server is alive, payments are failing, there is no alert (link to S6).

Recalculation per the model of section 8.4 with an explanation next to it, for example: "Without monitoring the outage was noticed through a customer complaint after 240 minutes; the outage lasted 295 minutes, at 20% errors that is 59 bad minutes, 137% of the month's budget". "Without rollback recovery took 120 minutes instead of 10". "The server availability check does not see the payment outage: the server answers, but 20% of orders do not go through".

### 5.13. X11 "One night from the data" (MT10, 3 screens)

The `lenses` (`08` §3.11) here are not people but data sources: "error rate chart", "deployment log", "on-call channel", "support tickets" and an empty lens "customer feedback" — it has no metric, only a chart of lost orders. This is closer to practice: the timeline of a review is assembled from monitoring, the deployment log, the on-call chat and the tickets.

| # | On screen | Moves | Click | Parameters | Recalculation and explanation |
|---|---|---|---|---|---|
| 1 | Five sources | Switching lenses changes the visible facts | Fact → its source and time | Lenses | — |
| 2 | A shared axis | The learner drags 12 facts onto the time axis | An empty spot on the axis → "there is no data here in any source" | — | Check: the order matches the reference up to a swap of two neighbors. "Between 02:10 and 02:40 there are no facts: the alert came only at 02:40" |
| 3 | What each source saw | For three moments, what was visible in each lens is highlighted | Moment → "which decision was reasonable given this data" | — | "At 02:15 there was not a single signal in the on-call channel: the decision to wait was reasonable given this data. The factor is the alert threshold, not the on-call person" |

### 5.14. X12 "The path of bad news" (MT11, 3 screens)

An organization diagram: four role blocks "Testing → Development → Manager → Product owner". A message token "the payment test has been failing for a week" travels along the arrows; each arrow is labeled with the forwarding rule and the delay. A counter "how long until the news reaches someone who can fix it".

| # | On screen | Moves | Click | Parameters / "break it" | Recalculation and explanation |
|---|---|---|---|---|---|
| 1 | Three cultures | The token travels along the arrows | Arrow → the rule ("the messenger is punished", "a request on the proper form is required", "report immediately and to everyone") | Switch "pathological / bureaucratic / generative" | Pathological: on the second arrow the token fades out, the counter shows "did not get through". Bureaucratic: "waits for the procedure for 3 days". Generative: "within an hour" |
| 2 | Where the manager decides | At each point the learner chooses the manager's reaction | Reaction → its place in Westrum's typology | Choice of reaction | "The reaction 'who is to blame?' on arrow 2 → the next piece of news follows the bureaucratic rule" |
| 3 | A shared channel | — | — | "Break it": remove the shared channel in the generative scheme | "Without a shared channel the news goes along the chain: 1 hour → 9 hours". Source: DORA, "Generative organizational culture", and Westrum (2004) |

---

## 6. The primary-source ladder

### 6.1. The block's documents and their structure

At rung 2 the learner learns the structure of a document the same way that in Linux they learn SYNOPSIS / OPTIONS / EXAMPLES of a `man` page.

| Document | Structure | Where to look for "what is mandatory" |
|---|---|---|
| Kanban Guide v2025.5 (May 2025, CC BY-SA 4.0) | Definition of Kanban → Why Use Kanban → Kanban Theory → Kanban Practices (three practices) → Flow Metrics (WIP, Throughput, Work Item Age, Cycle Time) | The minimal elements of the Definition of Workflow; the word "must". A Russian translation exists only for the 2020.12 edition; in the RU text the terms follow 2025.5, and this is stated directly |
| Scrum Guide 2020 | Scrum Theory → Scrum Values → Scrum Team (accountabilities) → Scrum Events → Scrum Artifacts (each with a commitment) | Timeboxes in Events; a commitment for each artifact |
| dora.dev/guides/dora-metrics | Definitions of the five metrics → the throughput and instability groups → how to measure → warnings about use | Definitions start with the words "how long", "how often", "the ratio" |
| SRE Workbook, a chapter | Concept → example → parameter table → appendix with a policy | Threshold tables ("Alerting on SLOs"); "Example Error Budget Policy" |
| SRE book, a chapter | Principle → Google practice → conclusions | "Postmortem Culture": a list of events that require a review |
| Agile Manifesto | Four values → twelve principles | The phrase "while there is value in the items on the right…" |

### 6.2. Rungs by level

| Rung | L0 | L1 | L2 | What the learner sees | Check |
|---|---|---|---|---|---|
| 1. Glimpse | MT0–MT3 | — | — | Next to a paragraph with a definition there is a "where this comes from" badge: a link to the exact place (Kanban Guide → `#flow-metrics`; Little 1961; SRE book ch. 5). Opening it is optional | None |
| 2. Fragment | MT4–MT7 | MT2–MT4 | — | The hint for a task is a fragment of the primary source with the line highlighted and a label of the structural part ("Artifacts → commitment"). The structure of the Scrum Guide, the Kanban Guide and a Workbook chapter is shown once | The task is checked as usual |
| 3. Find it yourself | MT8–MT9 | MT5–MT8 | MT6 | Only a link to the document is given, without an anchor | The answer is checked automatically, plus a field "which section did you rely on" (not graded, visible in the review) |
| 4. Requiring | MT10–MT11 | MT9–MT11 | MT7–MT11 | The task requires something that is not in the chapter. No hints. To any question the mentor first asks "where did you look?" and names the document, but not the section | Automatically |
| 5. Exam | MT12 | MT12 | MT12 | Only the "Reference" tab with the block's official documents is open, the built-in AI model is off; one or two tasks on things that are not in the course | Automatically and by rubric |

L0 is not sent to a primary source from scratch: for the first four chapters the document only glimpses by. L1 starts at rung 2, L2 at rung 3.

### 6.3. Tasks by rung

**Rung 2 (fragment).**
- MT4: "Which of the two features should be done first according to CD3?" Hint — a fragment of Black Swan Farming with the formula "Cost of Delay ÷ Duration" highlighted.
- MT5: "Which commitment belongs to the increment?" Hint — a fragment of the Scrum Guide, the Artifacts section, with "Definition of Done" highlighted.
- MT6: "Why is granting access manually toil?" Hint — a fragment of the SRE book ch. 5 with the characteristics highlighted (manual, repetitive, automatable, tactical, no enduring value, scales linearly).

**Rung 3 (find it yourself).**
- "Which commitment belongs to the product backlog?" — the Product Goal.
- "What is the maximum duration of the sprint review for a one-month sprint?" — 4 hours.
- "Find the minimal elements of the Definition of Workflow in the Kanban Guide and mark which of them are on the S1 board". Answer — six: the unit of value, start and end, states, WIP control, explicit policies, SLE. The S1 board has all of them except a written SLE. The check is a set.
- "What does the Kanban Guide call the forecast of how long a card will take, and where does it put it?" — the Service Level Expectation, part of the Definition of Workflow.
- "From which event does dora.dev count the change lead time?" — from the commit to the version control system.
- "How does dora.dev define the deployment rework rate?" — the share of unplanned deployments caused by an incident in production.

**Rung 4 (requiring, without hints).**
- **LD4-1 (MT9).** "In S6, enable the slow alert. Find the threshold and the windows in the SRE Workbook, 'Alerting on SLOs'". The check in the S6 policy: `flow.policies.alerts[kind=ticket].burn=1 && flow.policies.alerts[kind=ticket].window=3d` (10% of the budget over 3 days, a ticket, not a page).
- **LD4-2 (MT9).** "One incident in S6 ate 25% of the budget. According to the Example Error Budget Policy, what must happen besides the freeze decision?" Answer: a mandatory review with at least one P0 action item. The threshold of 20% from a single incident was not introduced in the chapter.
- **LD4-3 (MT9).** "In the same example policy, find who resolves the dispute if the teams disagree with the budget calculation". Answer: escalation to the CTO.
- **LD4-4 (MT9).** "Which short window does the Workbook recommend for the 6-over-6-hours alert?" — 30 minutes.
- **LD4-5 (MT10).** "Find in 'Postmortem Culture' (SRE book, ch. 15) which events require a review under Google's rules. Mark the incidents in the S7 log that fall under these rules". Check: the selected incidents are those with user-visible downtime above the threshold, with data loss and with on-call intervention (rollback).
- **LD4-6 (MT8, for L2 in MT7–MT8).** "Using the S5 log, calculate the deployment rework rate per the dora.dev definition. How does it differ from the change failure rate?" Answer: the numerator is the unplanned deployments caused by an incident; the denominator is all deployments.
- **LD4-7 (MT11).** "Set an SLE for the S3 board according to the Kanban Guide". Check: `flow.policies.sle.prob=0.85 && flow.policies.sle.days>=@p85-1 && flow.policies.sle.days<=@p85+1`.

**Rung 5 (exam, tasks outside the course).**
- **LD5-1.** "Using the live data export, formulate the team's SLE in the form given by the Kanban Guide". Answer: "85% of cards finish in N days or faster", N = p85 ±1 day.
- **LD5-2.** "Write an error budget policy for the shop following the example of the Workbook appendix, including the escalation of disagreements". Rubric: a freeze when the budget is exceeded over 4 weeks; exceptions for P0 and security; a review when a single incident consumes > 20% of the budget; escalation to a CTO-level manager.

### 6.4. Mentor behavior and markup

At rungs 4–5 the mentor gets a system prompt: "do not answer on the substance; ask which document the learner opened, and name a suitable primary source from the task's `docs_allowed`, but not the section" (`01` §14.2, rungs H1–H3 with a document instead of a lesson screen). At rung 5 the built-in mentor is off. In the task YAML there are the fields `doc_step: 1..5` and `docs_allowed: [kanban-guide, scrum-guide, dora-metrics, sre-workbook, sre-book, agile-manifesto]`; the validator checks that the task's `doc_step` is not lower than the level's starting rung in this chapter.

---
## 7. The `flowlab` simulator: what the learner sees

### 7.1. The domain

The business model is a small online tea shop. Each hour the site is up brings in 12,000 ₽ on average (in the EN version — $150), ×1.5 on weekends, ×4 during a sale. Money is a unit of value that a salesperson understands from the first screen: every feature carries a cost of delay in rubles per day, every outage a loss of revenue.

The team is designated by roles, without names, avatars or lines of dialogue: `DEV-1`, `DEV-2` ("Developer 1", "Developer 2"), `QA` ("Tester"), `OPS` ("Operations"), `PO` ("Product owner"). The source of requests is `OWNER` ("Business owner"). In different scenarios the learner is the team lead or an engineer who runs the board and makes decisions for the team. Requests and dilemmas come as an internal memo: "The business owner asks: …", without quoted dialogue. The customer's attitude towards the team is not a plot but a visible indicator on the panel, "share of the team's proposals accepted by the business owner", with a formula in the "How the simulator works" section.

### 7.2. The screen

The screen is divided into four zones. On top, the day strip: "Day 7 of 30", a "Finish the day" button (Enter), a "Skip to the event" button, a "strict limits" switch. In the center, the board. On the right, the gauge panel with the tabs "Flow" (CFD, cycle time scatterplot, work item age), "DORA" (five metrics and the trend), "Reliability" (error budget, burn rate, SLI series); a tab appears only when its concepts have been introduced in the chapter. At the bottom, the day log: events, observations, links "go back to chapter MT2, paragraph 4". A chapter paragraph opens as a panel over the board, closing it returns to the same day (the mechanic of cards over the scene from Sankofa).

On a phone the board is shown as a list of columns with "3/4" counters and a mini CFD strip above it; tapping expands the column's cards, moving is done with the "forward", "back", "assign" buttons. There is no horizontal page scrolling.

### 7.3. The board

The columns depend on the scenario. The full board (S5–S8):

| Column | Sub-columns | Who works | Meaning |
|---|---|---|---|
| Ideas (from MT5 — "Product backlog") | — | PO | Everything that is wanted; no limit |
| Ready to start | — | PO | Selected and sorted; lead time is counted from here |
| Development | in progress / done | DEV-1, DEV-2 | Work + waiting for the next stage |
| Review | in progress / done | DEV-1, DEV-2 | Code checked by a colleague |
| Testing | in progress / done | QA | Manual testing; with a pipeline the machine does part of it |
| Deployment | waiting / deploying | OPS or the pipeline | The change is on its way to production |
| At the customers | — | — | The end of the path, value is counted from here |

Above the board are an expedite lane (limit 1) and an operations lane (incidents, toil, internal OPS tasks) with simplified columns "new → in progress → done".

A card shows the title, the type (color and pattern per the tokens of section 14), the amount of work per stage as dots (filled — done), the assignee's role badge, the age in days, a blocked icon and, for features, the cost of delay "−4,000 ₽/day". A card whose age exceeds the 85th percentile of cycle time gets a thin "aging" frame (from MT2.4).

### 7.4. The learner's actions

Dragging a card into the next column: only from the "done" of the previous stage (pulling). In strict mode the engine will not let a card be dropped into a column whose limit is exhausted; in normal mode it will drop it and highlight the column. Assigning a worker: drag a badge onto a card; one person can be on several cards, with switching losses. Limits — a number above the column, with ± buttons. Policies — in the "Team rules" panel. Answering dilemmas. Taking improvement cards into work; they lie on the board as ordinary cards and require people's time.

Accessibility: a card gets focus with Tab; space picks it up, the arrows move it across columns, space drops it; `aria-live` announces "'Card payment' moved to 'Testing', column at 3 of 3". Calm mode (`calm.ts` from Sankofa) turns off the dot-filling animation.

### 7.5. The day

1. **Morning.** The engine plays out the day's events and shows them in the log. If an event requires a decision, a dilemma memo arrives; until the decision is made, the day cannot end.
2. **Stand-up.** The learner moves cards, assigns people, changes limits. The main phase.
3. **Work.** On "Finish the day" everyone spends the day's capacity on their cards (animation 1–1.5 s, instant in calm mode). The pipeline, if built, moves changes by itself. Deployments and their consequences happen.
4. **Evening.** The metrics and diagrams are updated, the engine looks for patterns and writes 0–2 observations with a link to a paragraph of the chapter. Sometimes, before the next day, there is a prediction question (8.9).

---

## 8. The `flowlab` engine: model and rules

### 8.1. Principles

The engine is pure TypeScript without the DOM; it runs in the browser, in the build and in the tier A Web Worker (`09` §1.3, budget 60 KB gzip). It registers as an `08` widget (`mount`, `snapshot` / `restore`, `describe`) and publishes events to the `SimEvent` bus: `flow.card.move`, `flow.deploy`, `flow.incident`, `flow.decision`, `flow.day.end`. The state is a serializable object. The day function `step(state, actions, rng) → {state, log}` is pure. Randomness comes from a seeded generator (mulberry32, `rng(seed)` from Sankofa's `features/engine/ink.ts` — the only thing the block takes from that file), split into independent streams: each person's capacity, events, deployment outcomes, the type and severity of an incident. This is the common random numbers technique: if the learner changed one decision, the dice of the others and the day's events are not reshuffled, and the difference is explained only by the decision. Without it, a counterfactual review would be noise.

The model is open to the learner: the "How the simulator works" section shows all the formulas below. The learner sees that "a WIP limit helps" is not hard-coded but follows from the queues.

### 8.2. Entities

```ts
type Stage = 'ready' | 'dev' | 'review' | 'test' | 'deploy' | 'done';
type WorkType = 'feature' | 'internal' | 'change' | 'unplanned' | 'toil' | 'defect';
type CoS = 'standard' | 'fixed-date' | 'expedite' | 'intangible';
type Role = 'DEV-1' | 'DEV-2' | 'QA' | 'OPS' | 'PO' | string;

interface Card {
  id: string;
  title: Bi;                       // { en, ru }
  type: WorkType;
  cos: CoS;
  work: Partial<Record<Stage, number>>;   // amount of work per stage, in points
  done: Partial<Record<Stage, number>>;   // done (fractional)
  stage: Stage;
  sub: 'doing' | 'done';
  assignees: Role[];
  createdDay: number;              // appeared in "Ready to start" — start of lead time
  startedDay?: number;             // first taken into development — start of cycle time
  committedDay?: number;           // development finished, change in the repository — start of change lead time (DORA)
  mergedDay?: number;              // left review — for flow efficiency
  deployedDay?: number;
  finishedDay?: number;
  codDaily?: number;               // cost of delay, ₽/day
  dueDay?: number;                 // for fixed-date
  blockedBy?: string;
  risk: number;                    // contribution to deployment risk, 0.03..0.08
  effect?: Effect[];               // for internal: what changes permanently after deployment
  knowledge?: 'ops-only';          // only OPS can move it until there is a runbook or the knowledge has been passed on
}

interface Person {
  role: Role;
  skills: Stage[];
  die: number[];                   // distribution of capacity per day, e.g. [1,2,3,4,5,6]
  away?: [number, number][];
  overtimeDays: number;
}

interface Policies {
  wip: Partial<Record<Stage, number | null>>;
  strictWip: boolean;
  pullOrder: 'fifo' | 'cod' | 'cd3';
  deploy: { mode: 'train'; everyDays: number } | { mode: 'on-merge' } | { mode: 'manual' };
  freezeOnBudget: boolean;
  expediteLimit: number;
  pairing: boolean;                // OPS works in a pair, knowledge is passed on
  sprint?: { lengthDays: number };
  sle?: { days: number; prob: number };                       // from MT5
  alerts?: { kind: 'page' | 'ticket'; burn: number; window: string; short: string }[];   // from MT9
  sli?: 'checkout-success' | 'p95-latency' | 'cpu' | 'log-errors' | 'host-uptime';       // from MT9
}

interface Capabilities {           // changed only by internal projects
  ci: boolean;
  testAutomation: number;          // 0..1, the share of checks done by the machine
  autoDeploy: boolean;
  rollback: boolean;
  monitoring: 'none' | 'host-check' | 'slo-alerts';
  runbooks: boolean;
  iacEnvs: boolean;
  toilAutomation: number;          // 0..1
}

interface State {
  day: number; seed: number; scenarioId: string;
  cards: Card[]; people: Person[]; policies: Policies; caps: Capabilities;
  slo?: { target: number; windowDays: number; badMinutes: number };
  money: { earned: number; codLost: number; downtimeLost: number };
  ownerAcceptance: { proposed: number; accepted: number };
  history: DaySnapshot[];
  deploys: DeployRecord[];
  incidents: IncidentRecord[];
  reliability: ReliabilitySample[];
}
```

### 8.3. A day's work

A person's capacity for the day is a roll of their die (by default 1–6, an average of 3.5 points; OPS has its own distribution in overload scenarios). Someone who is away has 0. Points are fractional.

Work outside one's own stage goes with a coefficient of 0.5: a developer helping with testing does half as much as the tester, but not zero. This is the swarming mechanism. A card with `knowledge: 'ops-only'` cannot be moved by anyone except OPS until the internal project "runbook for the on-call person" has been deployed or the knowledge has been passed on by pairing: each day paired with OPS on such a card gives the partner +1 knowledge, and at 3 the knowledge is passed on.

Switching between tasks follows Weinberg's table ("Quality Software Management", vol. 1). If a person is assigned to k cards, their daily capacity is multiplied by the share of useful time and divided equally among the cards:

| k | 1 | 2 | 3 | 4 | 5 or more |
|---|---|---|---|---|---|
| Share of useful time | 1.0 | 0.8 | 0.6 | 0.4 | 0.25 |

Overtime: the decision "work on the weekend" gives +50% capacity for the day and +1 to `overtimeDays`. With `overtimeDays ≥ 3` within 7 days, the risk of each new card by this person grows by 0.02 for every day of overtime beyond two. This is a delayed effect, visible in the review.

When `done[stage] ≥ work[stage]`, the card moves to the stage's "done" and waits to be pulled. Waiting in "done" and in queues eats flow efficiency.

Pulling: the learner moves the cards themselves. In "skip to the event" and in bot runs the engine pulls by `pullOrder`: `fifo` — the oldest, `cod` — the one with the highest cost of delay, `cd3` — the one with the highest ratio of cost of delay to remaining work (CD3 per Black Swan Farming).

### 8.4. Deployment, risk and incident

The deployment method is set by the policy: `manual` — OPS spends 2 points on one deployment of any size; `train` — once every N days OPS deploys everything accumulated; `on-merge` (only with `caps.ci && caps.autoDeploy`) — each change is deployed the same day by itself.

The risk of failure when deploying a batch of b changes: each change carries its own risk, automated tests remove part of it, and in a large batch the changes interact, so the risk of each grows with the batch size.

```
r'_i   = card.risk_i × (1 − caps.testAutomation) × (1 + 0.05 × (b − 1))
p_fail = clamp( 1 − (1 − 0.02) × Π_i (1 − r'_i), 0, 0.9 )
card.risk defaults to 0.03–0.08 depending on the amount of work (average 0.05)
```

The calibration table at `card.risk = 0.05` is shown in "How the simulator works" and is checked by a property test (section 17):

| b | testAutomation | p_fail |
|---|---|---|
| 1 | 0 | 0.07 |
| 1 | 0.6 | 0.04 |
| 5 | 0 | 0.28 |
| 8 | 0 | 0.44 |
| 10 | 0 | 0.54 |
| 10 | 0.6 | 0.27 |

This is an illustrative model, not DORA data, and the theory says so; the link to the research is given qualitatively: a smaller batch is better for both throughput and stability (dora.dev).

A failed deployment creates an incident. The incident type is chosen by the `rand('impact')` stream: `checkout-broken` (60%: the server is alive, CPU load is normal, the share of failed checkouts is 0.05–0.30), `slow` (20%: the response time for 95% of requests ×8, orders go through), `down` (20%: the site is unavailable, error rate 1). A separate load event adds two more types: `traffic` (error rate 0.10–0.50) and `cpu-spike-harmless` (CPU load 95%, customers do not suffer).

Incident duration in minutes:

```
detect =
  monitoring = none        → 240                                   // customer complaint
  monitoring = host-check  → kind = down ? 30 : 240                 // a server availability check sees only a crash
  monitoring = slo-alerts  → burn ≥ 14.4 ? 5
                           : burn ≥ 6    ? min(240, 2160 / burn)    // 6 h window, threshold 6
                           : 240                                    // only a ticket; customers will notice earlier
  where burn = badRatio(SLI) / (1 − slo.target), slo.target defaults to 0.999
diagnose = 30 × (1 + 0.25 × (b − 1)) × (OPS is away && !caps.runbooks ? 6 : 1)
restore  = caps.rollback ? 10 : 120                                 // a hotfix by the manual path; without OPS and a runbook — until the next day
downtime = detect + diagnose + restore
```

Recovery creates an `unplanned` card in the expedite lane ("find the cause"), and without rollback also an unplanned hotfix deployment, which counts towards the share of unplanned deployments. Money lost = downtime × revenue per minute × the share of failed orders (×1.5 on weekends, ×4 during a sale).

### 8.5. Reliability series and the error budget

So that the SLI chosen by the learner can "miss" an outage (S6), the engine keeps separate series: per minute on days with an incident and per hour on the other days.

```ts
interface ReliabilitySample {
  t: number;              // minute from the start of the scenario
  reqs: number; ok: number;               // all requests
  checkoutAll: number; checkoutOk: number; // checkouts
  p95ms: number; cpu: number; hostUp: boolean; logErrors: number;
}
```

Each SLI is computed from the series: `checkout-success` = checkoutOk / checkoutAll; `p95-latency` = the share of minutes with p95 ≤ 800 ms; `host-uptime` = the share of minutes with `hostUp`; `cpu` = the share of minutes with load ≤ 90%; `log-errors` = the share of minutes with log errors below the threshold. Bad minutes for the chosen SLI:

```
badMinutes = Σ over minutes (1 − SLI_minute) × traffic(t) / avgTraffic
budget.left = (1 − slo.target) × windowMinutes − badMinutes
```

A request-based SLO consumes the budget in proportion to the error rate and the traffic: a minute with 10% errors costs one tenth of a minute of full downtime, and during a sale there are more failed requests at the same error rate. The budget is consumed according to the chosen SLI, while the "true" damage is counted by `checkoutOk` and money. If they diverge, the `O-sli-blind` observation fires: "The chosen SLI is green, but there were 80% fewer orders in the hour than usual" — with both charts side by side.

### 8.6. Metrics: exact definitions

All metrics are computed from `history`, `deploys`, `incidents` and `reliability` rather than stored separately; that is why the CFD, Little and DORA are consistent. The set of definitions below is the Definition of Workflow of our board, and chapter MT5 points this out.

| Metric | Definition | Where it is shown |
|---|---|---|
| WIP of day d | The number of cards with `startedDay ≤ d ≤ finishedDay` (were in progress for at least part of the day); separately on the CFD — "WIP at the end of the day" | Counter, CFD |
| Throughput | Cards that moved to "At the customers" per day; a 5-day moving average | "Flow" |
| Cycle time | `finishedDay − startedDay + 1` | A scatterplot with the 50th and 85th percentile lines |
| Lead time | `finishedDay − createdDay + 1` (from "Ready to start") | The same place, via a switch |
| Work item age | `day − startedDay + 1` for unfinished ones | An age chart by column |
| Little's check | The average WIP over a window and the average throughput × the average cycle time of the items finished in the window. With the WIP definition above the identity is exact on windows where the system starts and ends empty | A line under the CFD "12.1 ≈ 1.5 × 8.0" and a "the system is unstable" badge if WIP in the window grew by more than 20% |
| Flow efficiency | Days when someone worked on the card / cycle time, averaged over finished cards | "Flow" (from MT7) |
| Change lead time (DORA) | `deployedDay − committedDay`, with the fractional part from the hour of deployment | "DORA" |
| Deployment frequency | Deployments over 7 days | "DORA" |
| Time to restore after a failed deployment | The median `downtime` of incidents caused by deployments | "DORA" |
| Change failure rate | Deployments after which immediate intervention (rollback or hotfix) was needed / all deployments | "DORA" |
| Share of unplanned deployments | Unplanned deployments caused by an incident / all deployments | "DORA" |
| Error budget | `budget.left` (8.5) | "Reliability" |
| Burn rate | The share of the budget consumed over a window / the window's share of the SLO period, windows of 5 min, 30 min, 1 h, 6 h, 3 days | "Reliability" |
| Money | Revenue; losses from delay (the sum of `codDaily` over the days before deployment); losses from downtime | The strip on top, the review |
| People's load | The share of capacity spent on toil and unplanned work; overtime days | The review |
| Share of accepted proposals | `ownerAcceptance.accepted / proposed` | The strip on top |

Terms on the tabs are written out in full; the abbreviation WIP or DORA is given next to it after it has been introduced.

### 8.7. Team rules

Policies are permanent settings in the "Team rules" panel; every change is written to the decision log. Rules appear as concepts are introduced: in S1 limits, in S3 the pull order, sprints and the SLE, in S4 the expedite lane and pairing, in S5 the deployment method, in S6 the SLI, alerts and the budget freeze, in S7 on-call duty.

### 8.8. Events and dilemmas

Events and dilemmas are data. The trigger conditions are written in the internal `flowexpr` language (8.10).

```yaml
# content/methodology/events/incident-traffic.yaml
id: incident-traffic
title: { ru: "Сайт тормозит под нагрузкой", en: "The site slows down under load" }
when: "has(scenario.tags,'traffic') && rand('events') < 0.04 + 0.10 * traffic(day)"
effects:
  - spawn: { template: incident-generic, lane: expedite, knowledge: ops-only }
  - incident: { kind: traffic }
ref: methodology/MT6.1#p3          # the chapter paragraph the log refers to
log: { ru: "Поддержка сообщает: страница корзины открывается 20 секунд.", en: "Support reports: the cart page takes 20 seconds to open." }
```

The event catalogue:

| id | What happens | Effect | Which chapter |
|---|---|---|---|
| `owner-promo` | The business owner asks for an urgent feature for a promo | A `fixed-date` card, due in 5 days | MT4 |
| `expedite-bug` | Customers cannot pay | An `expedite` card, cost of delay ×10 | MT4 |
| `incident-traffic` | Load | A `traffic` incident, OPS only | MT6 |
| `ops-vacation` | Operations goes on vacation for 5 days | `away` | MT6 |
| `env-unavailable` | The test environment is broken | Blocks testing for 1–2 days if there is no `iacEnvs` | MT7 (before MT7 the text is "the environment for testing is unavailable", F10) |
| `flaky-test` | An automated test fails randomly | +1 testing point per card until it is fixed | MT7 |
| `toil-access` | Requests for granting access | `toil` cards of 1 OPS point each, the number grows with the day | MT6 |
| `audit` | The tax office asks for an export by Friday | `fixed-date` | MT4 |
| `security-patch` | A vulnerability in a library | `change`, risk 0.08, due in 3 days | MT6 |
| `new-hire` | The director gives two newcomers | Newcomers with capacity 1 and −1 for the mentor for 5 days | MT6 (Brooks's law) |
| `report-utilization` | The director asks for a report "is everyone loaded at 100%" | Dilemma D8 | MT2 |
| `cpu-spike` | CPU load 95% with no harm to customers | `cpu-spike-harmless` | MT9 |
| `sale` | A sale | Traffic ×4, revenue ×4 for 3 days | MT9 |

A dilemma comes as a memo with 2–4 options. Each option has an immediate and a delayed effect and an explanation that is shown in the evening in the log and in full in the review, so that the learner sees the consequences first. The reference option is marked `reference: true`.

```yaml
id: D1-five-features
when: "day == 3"
text:
  ru: "Владелец бизнеса просит: акция через две недели, начать сразу все пять функций, все срочные."
  en: "The business owner asks: the promo starts in two weeks, start all five features now, all urgent."
options:
  - id: take-all
    label: { ru: "Начать все пять", en: "Start all five" }
    effects: [{ move: { cards: "tag:promo", to: dev } }]
    ref: methodology/MT2.1#p2
  - id: pick-by-cod
    reference: true
    label: { ru: "Предложить выбрать одну с наибольшей стоимостью задержки и начать с неё", en: "Propose to start with the one with the highest cost of delay" }
    effects: [{ sortReady: cod }, { move: { cards: "top:1:tag:promo", to: dev } }, { owner: propose, acceptIf: "has_data" }]
    ref: methodology/MT4.1#p4
  - id: refuse
    label: { ru: "Отказать: незавершённой работы уже много", en: "Refuse: WIP is already full" }
    effects: [{ owner: propose, acceptIf: "false" }]
    ref: methodology/MT2.1#p5
```

| id | Situation | Options | What the consequence shows |
|---|---|---|---|
| D1 | The business owner wants five urgent features at once | all / propose an order by cost of delay / refuse | All at once — the cycle time grows for all five, 1–2 are ready for the promo; by cost of delay — the 3 most expensive ones are ready; refusing without data lowers the share of accepted proposals |
| D2 | The tester cannot keep up, the developers are free | new features / help with testing / prepare a testing checklist | Swarming and improvement versus a growing queue |
| D3 | Production broke, operations is on vacation | call them / try ourselves / roll back (only if `caps.rollback`) | The price of the single person who knows, the value of a runbook and rollback |
| D4 | The error budget is exceeded, marketing wants a big release for the promo | deploy everything / freeze / deploy one feature out of five after fixing reliability | The error budget policy; small batches |
| D5 | After an outage the business owner asks "who is to blame?" | name the author of the change / hold a blameless review / stay silent | Naming someone — in the next incidents the sources "go quiet" (diagnosis ×2, a fact disappears from the on-call channel lens); a review — tasks for the contributing factors appear |
| D6 | The team can work on the weekend | yes / no | A short-term gain and delayed defects |
| D7 | The project is late, the director gives two newcomers a week before the deadline | to the project / to internal tasks / decline | Brooks's law |
| D8 | The director wants everyone loaded at 100% | load them / show the queues on the CFD | Utilization and waiting (X2) |
| D9 | Two weeks to automate deployment, but two features will ship later | automate / postpone | The payback point on the money chart |
| D10 | Operations spends 60% of the day on toil | hire one more person / automate the toil / leave it | Toil and the rule "no more than half of the time on operational work" |

### 8.9. Observations and predictions

Observations are rules that every evening look for known patterns and write about them in the words of the current chapter, with a link to a paragraph already read. If a pattern belongs to a concept of the next chapter, the observation describes it without the term: in S1 (MT2) a growing CFD band is "work is piling up before testing", and "bottleneck" will appear in MT3. No more than two observations a day, and the same one no more often than once every five days. Numbers in the texts are substituted from the state by a template (`{{diagnoseMin}}`), not written by hand.

```yaml
id: O-band-widening
when: "band('test').growth(3) > 0.5 && throughput(5) <= throughput(10)"
text:
  MT2: { ru: "Полоса «Проверка» за три дня стала в полтора раза шире, а готовых карточек больше не стало. Работа копится перед проверкой.", en: "..." }
  MT3: { ru: "Полоса «Проверка» за три дня стала в полтора раза шире: проверка — узкое место.", en: "..." }
ref: { MT2: methodology/MT2.4#p3, MT3: methodology/MT3.1#p4 }
highlight: { chart: cfd, band: test, days: [-3, 0] }
```

| id | Pattern | Chapter paragraph |
|---|---|---|
| `O-wip-over` | A column above its limit | MT2.1 |
| `O-starvation` | A person is idle while the queue before them is full, or a column is empty while the previous one's "done" is full | MT1.2 |
| `O-band-widening` | A CFD band grows for 3 days | MT2.4 / MT3.1 |
| `O-aging` | A card older than the 85th percentile | MT2.4 |
| `O-multitask` | A person has 3 or more cards | MT1.2 |
| `O-little-mismatch` | Little "does not add up" because WIP is growing | MT2.3 |
| `O-big-batch` | A deployment of 5+ changes: "the deployment had {{b}} changes, diagnosis took {{diagnoseMin}} minutes, because it is unclear which of them broke payments" | MT4.1 |
| `O-hero` | OPS took part in 3 of the last 4 incidents within 10 days | MT6.2 |
| `O-toil-half` | Toil > 50% of operations capacity for 3 days in a row | MT6.1 |
| `O-budget-burn` | `burn('1h') > 14.4 \|\| burn('6h') > 6` | MT9.2 |
| `O-sli-blind` | The chosen SLI is normal, but there are 50% fewer successful checkouts than usual | MT9.1 |
| `O-expedite-cost` | The expedite lane is occupied for 3 days in a row, the cycle time of standard cards grows | MT4.1 |
| `O-payback` | An internal project has paid off (the money curve crossed the baseline) | MT6.2 |

Predictions. Before key moments (the first limit, the first automation, the first freeze) the engine asks a question: "How will the cycle time change over the next 5 days: will it grow, stay the same, decrease?" Five days later the log shows the answer with a chart. The accuracy of predictions is shown in the review as "how well your model of the system matched the real one" — feedback, not a grade.

### 8.10. Two languages: internal and for checks

The conditions of events and observations are written in the internal language `flowexpr`: numbers, strings, comparisons, `&&`, `||`, `!` and state functions (`day`, `wip(stage)`, `limit(stage)`, `throughput(n)`, `cycleP(p, n)`, `band(stage).growth(n)`, `age(cardId)`, `count(type, stage)`, `load(role)`, `budget.left`, `burn(window)`, `traffic(day)`, `rand(stream)`, `decided(id, option)`, `caps.<name>`, `has(scenario.tags, tag)`), without `eval`, with our own recursive descent parser. It is needed because functions like `band().growth()` and `rand()` do not exist in the shared predicate language. An erroneous expression is a build error.

The pass conditions of scenarios and the tasks of the level check and the exam are not `flowexpr` but goals of the shared contract `09` §2: predicates over the fact projection `facts.flow`, the result is a `CheckResult`, the log entry is `check.result`. `flowlab` computes all derived values in advance, because the `09` grammar has no arithmetic between paths.

```ts
// addition to shared/facts/v1.ts — proposed to the author of 09
flow?: {
  scenario: string; seed: number; day: number;
  metrics: { wipAvg: number; th5: number; th1to5: number; th6to10: number;
             cycleP50: number; cycleP85: number; leadP85: number;
             deployFreq7: number; changeLeadMedianDays: number; cfr: number;
             recoveryMedianMin: number; reworkRate: number;
             budgetLeftMin: number; budgetLeftRatio: number; saleBadMinutes: number;
             moneyNet: number; opsToilShare10: number; overtimeDays: number };
  rounds?: { id: number; cycleP85: number; p85RatioToR1?: number }[];
  done: { count: number; byType: Record<WorkType, number> };
  policies: { wip: Record<string, number | null>; sle?: { days: number; prob: number };
              alerts?: { kind: string; burn: number; window: string }[]; sli?: string };
  incident?: { restoredStep?: number };
  bots: { baseline: FlowMetrics; reference: FlowMetrics };   // the same metrics fields on the same seed
  passLine: FlowMetrics;                                      // baseline + 0.6 × (reference − baseline), computed by the engine
  answers: Record<string, { pass: boolean }>;                // review questions: cfd-click and the like
}
```

### 8.11. Storage, replay and handoff to the phone

Every learner action is a `LearnEvent` of the new types `sim.action` and `sim.result` (`ref: methodology/S2`, `data: {seed, d, k, args}`) in IndexedDB (`09` §3.1); a snapshot of the day goes to `snapshots`. Export and synchronization are shared (`09` §3.3–3.4). `localStorage` keeps only interface trivia (the last opened gauge tab). The new event types have been passed to the author of `09`.

The state of any day is restored as `replay(seed, scenario, log[0..k])`. Hence:

- **"Replay the day".** Going back to the morning of any past day; the log after it is truncated; the previous branch is shown dashed on the charts.
- **Handoff to the phone** (`handoff`, `08` §3.9). The Sankofa QR generator holds up to 213 bytes (versions 1–10, level M), so only `{v, scenario, seed, day, decisions[], policyChanges[]}` is passed through the QR code, compressed with deflate, target ≤ 200 bytes. Card movements on the phone are restored by the learner's `pullOrder` policy, and the run opens in "review and reading" mode with one line: "card movements were restored according to your pull rules". The full log is transferred by the shared export or synchronization.

### 8.12. Bots, counterfactuals, thresholds

For each scenario two bots are run on the learner's seed in a Web Worker.

**The baseline bot** works the way teams work without a methodology: no limits, FIFO pulling, everything urgent goes into work, the first option in dilemmas, no internal projects.

**The reference bot** follows rules that are the same for all scenarios, so that the reference is reproducible:
1. The WIP limit at a stage = the number of people at the stage + 1.
2. Pulling by CD3.
3. If the queue before a stage is ≥ 2 × the limit, free people swarm on it.
4. An internal project is taken if its payback point, calculated by cost of delay, comes before the end of the scenario.
5. Deployment uses the most frequent of the available `deploy.mode` options.
6. In dilemmas — the option with `reference: true`.

**Counterfactuals.** Up to 12 weighty decisions are chosen from the log (answers to dilemmas, changes to limits and policies, taking on internal projects). For each one a run is made in which only that decision is replaced by an alternative (another dilemma option; the reference policy's limit; the internal project taken 5 days earlier or not taken), and the rest of the log is applied as is, as far as possible. The contribution of a decision is the change in the final vector (money, p85 cycle time, change failure rate, error budget) in normalized units. The three decisions with the largest contribution are shown in the review. A 30-day run with 40–60 cards takes milliseconds; 14 runs in a Worker go unnoticed.

**Pass thresholds are relative.** Absolute thresholds are unreachable on some seeds even for the reference, and a learner who played the first round well would not be able to "improve by 25%". Therefore a scenario is passed if the key metric is no worse than `passLine = baseline + 0.6 × (reference − baseline)` on the same seed. Scenario and exam seeds are taken only from a pool on which the reference bot passes all goals and the baseline one passes none of the key ones; the pool is checked in CI.

---
## 9. Scenarios

Each scenario is described by a `scenario.yaml` file (section 13). A scenario opens after the text of its chapter, uses only concepts already introduced, and its pass conditions are `09` goals with the `passLine` threshold (8.12). These are not points but a minimal bar of understanding: the learner got a result and was able to explain why.

### S0 "One desk" (MT1, L0 only, 10 minutes)

A board "Ready to start → In progress → Done", one person DEV-1, six cards of 4 points each. There is no randomness: the capacity is exactly 3 points a day; if a card is finished in the middle of the day, the remaining capacity goes to the next assigned one. Eight days. The learner learns to move a card, assign a person, finish the day. On the second screen PO puts six more cards and suggests "starting everything at once". Per the formulas of 8.3:

- one at a time: the first is done on day 2, all six on day 8;
- three at once: 3 × 0.6 = 1.8 points a day, 0.6 per card, the first three are done only on day 7;
- all six at once: 3 × 0.25 = 0.75 points a day, 0.125 per card; in 8 days not a single one is done, each has 1 point out of 4, and all six would be done at the same time on day 32.

The idea "finishing is more important than starting" is introduced. Pass: `flow.done.count>=6`.

### S1 "Traffic jam" (MT2, 30–40 minutes)

The Featureban structure in three rounds on one board (Development → Review → Testing → Done), team DEV-1, DEV-2, QA, 15 working days per round, the same seed in rounds 1 and 2.

- **Round 1, without limits** (after lesson MT2.1). Every day PO brings 2 cards; the learner moves them as they see fit. Usually work starts wide, WIP grows, the CFD fans out. The "Flow" tab opens on day 5 with the `O-multitask` or `O-wip-over` observation.
- **Round 2, with limits** (after MT2.2). The same incoming work. The learner sets limits on all columns (hint: "start with the number of people at the stage plus one"). Strict mode is optional.
- **Round 3, metrics** (after MT2.4). The board is cleared, the limits are kept. The cycle time scatterplot and Little's check. Question: "What deadline will you promise the business owner with 85% confidence?" The answer is the 85th percentile line ±1 day. In MT5 this same answer will get the name SLE.

Pass:

```yaml
goals:
  - id: s1-wip-helps
    needs: [flow]
    when: "flow.rounds[id=2].cycleP85<=flow.passLine.cycleP85 || flow.rounds[id=2].p85RatioToR1<=0.75"
    envs: [sim]
    fail:
      - if: "flow.rounds[id=2].p85RatioToR1>0.75"
        say: { ru: "Время цикла во втором раунде почти не изменилось. Посмотрите, в какой колонке лимит выше числа людей на этапе.", en: "..." }
        term: M07
  - id: s1-promise
    needs: [flow]
    when: "flow.answers.q-S1-p85.pass=true"
    envs: [sim]
```

The review shows three CFDs side by side. The chapter paragraphs the scenario refers to: WIP and the limit, cycle time and lead time, throughput, age, Little's law and its conditions (Vacanti), the CFD.

### S2 "Bottleneck" (MT3, 30 minutes)

A board as in S1, QA has a 1–4 die, the developers 1–6, 20 days. Events: `env-unavailable` on day 8, dilemma D2 on day 6. The "Ideas" column contains the improvement "A checklist and prepared data for checking the cart" (4 development points, 2 testing points; effect: the testing work for cart cards ×0.6).

The goal in business language: "The business owner needs 12 features in 20 days". Without changes the team does 8–9. The reference bot repeats Goldratt's five steps: it identifies the bottleneck from the CFD (testing); exploits it fully (QA has no idle time and no switching); subordinates the others (a limit on development, the developers help with testing); elevates it (the checklist); returns to step 1 — after the checklist, review becomes the bottleneck, which is visible on the CFD by days 16–18.

Pass: `flow.done.byType.feature>=flow.passLine.doneFeatures` and a correct click in the review on the question "where is the bottleneck now, on day 20?" (`flow.answers.q-S2-where-now.pass=true`).

### The "CD3" drill (MT4, 10 minutes)

A 10-day board without randomness, 8 features with different costs of delay (500–8,000 ₽/day) and amounts of work. The learner chooses the pull order manually or by a rule (FIFO, cost of delay, CD3). The review shows the delay losses of the three orders side by side.

### S3 "Sprint or flow" (MT5, 45 minutes; L1 — only half B, 20 minutes)

One queue of 25 features with different costs of delay (500–8,000 ₽/day, three features with a hard deadline for the promo on day 18) is played twice, 20 days each, on the same seed.

- **Half A, Scrum.** Sprints of 5 days. At planning the learner chooses cards for the sprint backlog and a sprint goal (of three wordings one is a task list, one is vague, one is verifiable). In the middle of the sprint an urgent card arrives: whether to break the sprint. At the end — a review (what is with the customers, the share of accepted proposals changes) and a retrospective: the learner chooses one improvement out of three, and it takes effect from the next sprint.
- **Half B, Kanban.** The board is not cleared, WIP limits, the learner chooses the pull order (FIFO, cost of delay, CD3), an expedite lane with a limit of 1. The learner writes an SLE into the team rules.

For L1, half A is shown as a finished run of the reference bot on the same seed. The review compares the halves by money (especially delay losses) and by predictability, without declaring a winner. The conclusions that are checked by questions: ordering by CD3 gives more value with the same capacity; a sprint is also a limit on work in progress, only in time; Scrum and Kanban are compatible (Kanban Guide for Scrum Teams).

Pass: delay losses in half B are no worse than `passLine`, and the Scrum accountabilities, events and artifacts are correctly matched in a short test after the scenario.

### S4 "Firefighters" (MT6, 40 minutes)

The full board without a pipeline, OPS in the team, the operations lane open, 25 days. Every day `toil-access` brings toil (from 2 to 6 requests by the end); with a probability of 10–15% per day `incident-traffic` (OPS only); on day 12 `ops-vacation` for 5 days and right after that an outage (D3, without the "roll back" option). Deployment is manual, OPS only. Dilemma D10 on day 5.

There are three improvements on the board: "A script for granting access" (toil −80%), "A runbook for typical outages and two drills" (`runbooks: true`), "A signal when the site goes down" (`monitoring: host-check`). Pairing is switched on in the team rules.

The main idea of "The Phoenix Project": unplanned work is the most destructive because it is invisible and takes the time of the single person who knows. By day 8 the reference bot takes the access script and switches on pairing, the runbook is ready by the vacation, and the outage during the vacation is closed in an hour instead of two days.

Pass: `flow.metrics.opsToilShare10<=flow.passLine.opsToilShare10` and at least one incident closed without OPS.

### S5 "Release train" (MT7 + MT8, 50 minutes)

The same team, toil under control. Deployment is a train once every 10 days (batches of 8–12 changes, risk per the formula of 8.4 — 0.44–0.62, that is, roughly every second train breaks). 40 days. Part 1 (MT7) — days 1–20, part 2 (MT8) — days 21–40; the "DORA" tab opens at the start of part 2 and shows the five metrics for the past days as well.

On the board there is a chain of improvements that repeats X1 on a live team: "Automatic build and automated tests after merging" (`ci: true`, `testAutomation +0.3`), "Automated tests for the main scenarios" (`+0.3`), "Deployment by a button and rollback" (`autoDeploy`, `rollback`), "Environments from code" (`iacEnvs`). The deployment policy is changed by the learner: `train 10` → `train 5` → `manual` (each change by a button, continuous delivery) → `on-merge` (continuous deployment, after CI and automatic deployment). Dilemma D9 on day 4. On hover an improvement card shows "you will do this by hand in the CI/CD block (A1–A6)" or "in the Ansible and Terraform blocks" (environments from code).

The `O-big-batch` observation explains each failed train with numbers from the formula: "the deployment had 11 changes, diagnosis took 105 minutes".

Pass: deployment frequency, change failure rate and change lead time over days 31–40 are no worse than `passLine`; the review shows that all five metrics improved at the same time and asks question P-E3 ("speed versus stability?").

### S6 "Error budget" (MT9, 40 minutes)

The site's target: 99.9% successful checkouts over 30 days (43.2 bad minutes of budget). Start: `ci`, `autoDeploy`, `rollback`, `testAutomation 0.6`, `monitoring: host-check`, deployment `on-merge`. Marketing pushes features for the promo, on day 15 there is a mini-sale (`sale` with traffic ×2), on day 9 a `cpu-spike`.

First the learner chooses an SLI out of five: "server CPU load", "share of successful checkouts", "home page response time for 95% of requests", "number of errors in the logs", "server uptime". The correct ones are checkouts and response time: they describe the customer's experience. A wrong choice does not block the scenario: the reliability series (8.5) are arranged so that during the first week there is a `checkout-broken` outage (the server is alive, the CPU is normal, 20% of orders do not go through) and a harmless `cpu-spike`. "Uptime" and "CPU load" see the second and do not see the first, `O-sli-blind` fires, and the observation explains why.

Then the learner accepts or does not accept a budget policy following the SRE Workbook example: if the budget is exceeded over 4 weeks — a freeze on everything except P0 and security fixes. If the budget is exceeded, dilemma D4 arrives. The improvement "Burn-rate alerts" (`monitoring: slo-alerts`) shortens the time to detect per the formula of 8.4. The ladder tasks LD4-1–LD4-4 (section 6.3) are built into this scenario: the learner configures the slow alert themselves according to the Workbook.

Pass: `flow.metrics.budgetLeftRatio>=flow.passLine.budgetLeftRatio` and a correctly calculated remaining budget on day 20 (±1 bad minute).

### S7 "Night and morning" (MT10, 40 minutes)

**Night** is the step mode, one step is 10 minutes of model time. The learner is the on-call person. Steps: an alert came in → look at the gauges → a hypothesis (out of 4 options) → an action (roll back, restart, call the author of the change, write a status update to the business owner) → a check. A wrong hypothesis costs steps but does not end the scenario. First restore the service, then look for the cause.

Between night and morning there is dilemma D5 "who is to blame?". If the learner names a culprit, the review is still held, but in the "on-call channel" lens the message "saw a pipeline warning at 01:50" is missing — a missing fact, and the timeline cannot be assembled completely. This is how the model shows that fear of punishment takes information away from the organization.

**Morning** is a blameless review in five steps:

1. **Timeline.** The X11 source lenses (the error chart, the deployment log, the on-call channel, support tickets, the empty customer feedback lens). 12 facts onto the axis; the order matches the reference up to a swap of two neighbors.
2. **What was visible.** For three key moments the learner chooses which decision was reasonable given the data visible at that moment (the Etsy Debriefing Facilitation Guide, Dekker).
3. **Contributing factors.** From 10 factors choose those that played a role ("the migration script can be run in production without confirmation", "the alert came after 40 minutes", "rollback requires OPS"), distinguishing them from judgments of people.
4. **Improvement tasks.** Up to three; they will appear on the S8 board as improvements.
5. **Text.** A summary of 3–5 sentences. Automatic check: no person in the role of the cause, no words from the blame list, at least one condition factor and one task.

Pass: the service is restored no later than step `passLine.restoredStep` (reference + 2), the timeline is assembled, the factors are chosen with no more than one mistake, the text passed the automatic check.

### S8 "Black Friday" (MT12, exam, 90 minutes)

The whole board, all mechanics, 45 days. The start is a neglected team: no limits, a deployment train once every two weeks, toil eats OPS, monitoring is only a server check, no SLO is defined. Tasks in business language: "three features are needed for the sale on day 40; the site must work during the sale; over 45 days the shop must earn more than last month". Events are mixed from the catalogue by a seed from the exam pool; the learner does not know them in advance. If the learner passed S7, their improvement tasks lie on the board. The grading format is section 11.1. There is one exam run (the seed is fixed at the start, "replay the day" is disabled); practice runs are unlimited on other seeds.

---

## 10. Review after a scenario

The review is five screens, scrolled like scroll scenes (in calm mode everything is static).

**Screen 1 "Your run step by step".** A `stepper` over the run log: a step is a day, the diagram shows the board and the CFD of that day; forward, back, pause, dragging along the timeline. The timeline marks decisions, events, observations and breaks in the metrics. On a paused day a slider "limit of column X" (and other policies) is available: it recalculates the run from that day as a counterfactual (8.12), and on the right a line appears "with a limit of 3 the p85 cycle time would have been 7 days instead of 11: no queue would have piled up before testing". This is the "bottleneck of the flow" explanation on the learner's own data. The "replay from here" button starts a new branch.

**Screen 2 "Your run and two references".** Four charts one above the other with a shared day axis: money (cumulative), p85 cycle time, change failure rate (from S5), error budget (from S6). Three lines with direct labels: your run, the baseline bot, the reference bot. Under each chart one sentence without judgments: "You earned 34,000 ₽ more than the baseline team and 9,000 ₽ less than the reference one; the difference from the reference fell on days 6–11, when there were 7 cards in development".

**Screen 3 "The three decisions that changed the most".** For each: what you did, what would have changed with a different decision (two small charts side by side), an explanation and a link to a paragraph of the chapter. If the learner's decision was better than the reference one, this is said directly.

**Screen 4 "Explain it yourself".** One open question in interview format "what it is → why → how it works → when you use it". In S1: "Explain why the work-in-progress limit sped the team up even though no people were added". The answer is checked for key concepts (limit, queue, switching, Little's law); with a connected AI model — by the rubric of 11.3.

**Screen 5 "What you applied from the chapter".** A list of the chapter paragraphs that the run's observations and decisions referred to, marked with which concepts have already been consolidated by exit tickets. Buttons: "module quiz", "again with the same seed", "with a new seed".

---

## 11. Exam, tests, drills

### 11.1. The S8 exam in the `10` §6.1 format

The built-in AI model is off. At the start the learner chooses the "with an assistant" or "without" mode, and the mode is written to the record. Only the "Reference" tab is open (rung 5 of the ladder, section 6). To pass — all critical checks and ≥ 70% of the total. A retake — after 24 hours, with a new seed from the pool; before the retake, a 15-minute series of drills on the failed concepts.

| Part | What is checked | Goal (predicate over `facts.flow`) | Weight | Critical |
|---|---|---|---|---|
| Flow | p85 cycle time over days 30–45 | `flow.metrics.cycleP85<=flow.passLine.cycleP85` | 14% | — |
| Delivery | Deployment frequency and change lead time over the last 10 days | `flow.metrics.deployFreq7>=flow.passLine.deployFreq7 && flow.metrics.changeLeadMedianDays<=flow.passLine.changeLeadMedianDays` | 14% | — |
| Stability during the sale | Bad minutes during the sale (8.5) | `flow.metrics.saleBadMinutes<=flow.passLine.saleBadMinutes` | 14% | yes |
| Money | Revenue minus losses from delay and downtime | `flow.metrics.moneyNet>=flow.bots.baseline.moneyNet*1.1` | 14% | yes |
| People | The share of toil and unplanned work for OPS over the last 10 days; overtime | `flow.metrics.opsToilShare10<=flow.passLine.opsToilShare10 && flow.metrics.overtimeDays<=3` | 14% | — |
| Explanation 1 | The three main decisions, why, what the counterfactuals showed | `explain`, rubric 11.3 | 15% | — |
| Explanation 2 | Live data (11.2): the bottleneck and three proposals with the expected effect | `explain`, rubric 11.3 | 15% | — |

In the "with an assistant" mode the explanations are assessed by the learner's AI model outside the engine according to rubric 11.3, with quotes; in the "without" mode — by the learner themselves against the reference, and both parts are marked "self-assessment". The live data numbers are checked automatically and enter "Explanation 2" as key elements of the rubric. The rung 5 tasks (LD5-1, LD5-2) are part of the live data.

### 11.2. Live data

An export from a tracker and a deployment log (CSV) of a fictional but realistic team: 60 cards and 25 deployments. The data is generated by the engine from a hidden run, so each learner has their own set.

```csv
id,type,created,started,finished
T-101,feature,2026-03-02,2026-03-04,2026-03-11
T-102,defect,2026-03-02,2026-03-02,2026-03-03
...
```
```csv
deploy_id,committed_at,deployed_at,failed,restored_at,unplanned
D-01,2026-03-04T15:10,2026-03-06T11:00,false,,false
D-02,2026-03-06T10:00,2026-03-06T16:30,true,2026-03-06T18:05,false
...
```

Tasks: throughput by week; p50 and p85 cycle time; average WIP by day and a check of Little's law; a CFD (with a "build" button, but the learner chooses the fields for each line); the five DORA metrics; the team's SLE (LD5-1); the bottleneck and three changes with the expected effect. The numbers are checked automatically with a 5% tolerance (the reference is computed by the same code as the simulator).

### 11.3. Rubric for text answers

Five "yes / no" items: (1) the chapter's concept is named with the correct term; (2) the mechanism (why) is given, not only the fact; (3) there is a number or a reference to a chart of the run; (4) there is no blaming of people and no judgmental words (for reviews); (5) the proposal is verifiable — it says which metric will move and in which direction. Without an AI model, items 1, 3, 4 are checked automatically (by glossary and templates), and items 2 and 5 are marked by the learner themselves against a reference that opens after submission. With an AI model (outside the exam) — all five, with a quote from the answer for each item.

### 11.4. Module and block quizzes

Per `10` §4: a module quiz is 4–6 tasks from a bank of 15–25 module tasks; the block quiz is 20–25 tasks. Types: a single correct answer (each wrong one has its own explanation), a number with a tolerance, ordering, sorting into bins, a click on a chart (an area of the CFD or the scatterplot), editing text. Passed at 80%. Wrong answers put the concept into the FSRS queue (`01` §10); the block has no review schedule of its own. Each task has a `doc_step` field (section 6).

Examples (the full bank is `content/methodology/quizzes/MT*.yaml`):

**MT0.** "A customer clicked 'pay', the money was not charged, and this has been going on for an hour. Is this a change, an outage or a deployment?" — an outage. "Development is assessed by the number of features, operations by the days without outages. Why is this a conflict?" — every change is a risk to stability.

**MT1.** "Why is it better to take a new card when a slot frees up rather than when it is handed to you?" — work does not pile up where it cannot be done in time. Order three boards by how well the work is visible.

**MT2.** Little in three forms. "The team starts more tasks, throughput does not change. What happens to the cycle time?" — it grows in proportion to WIP. A click on the CFD: "where do you read the average cycle time?" — the horizontal distance between the start-of-work line and the done line. "Little does not add up: 6 by the formula, 11 on the board. Why?" — the system is unstable, WIP is growing.

**MT3.** "The fourth stage has the largest queue. Where is the bottleneck?" — most likely at the fourth stage; check by the idle time of the stages after it. Order the five steps. "Development was made twice as fast, the output did not change. Why?"

**MT4.** "Feature A — 10,000 ₽/week and 2 weeks of work; B — 6,000 ₽/week and 1 week. Which goes first by CD3?" — A = 5,000, B = 6,000 → B. "Why is one batch of 20 changes worse than 20 batches of one?"

**MT5.** Match the Scrum accountabilities, events, artifacts and commitments. "How does a Scrum master differ from a manager who hands out tasks?" "Can a Scrum team limit WIP?" — yes (Kanban Guide for Scrum Teams). Choose a verifiable sprint goal. "Why does the Kanban Guide not use the term 'lead time'?" Formulate an SLE from a scatterplot.

**MT6.** Sorting into the four types. "Operations spends 70% of the time manually granting access. Why is hiring a second person a weak solution?" — toil grows with the service.

**MT7.** Order the stages of the pipeline; mark where CI ends; classify three descriptions as CI / continuous delivery / continuous deployment. Situations from the former A0 quiz of `06`: "a pipeline once a week on the release branch is not CI"; "a branch lives for three weeks, tests on every push — not CI". "The pipeline has been red for a day, and everyone keeps merging changes. What is wrong?"

**MT8.** The five metrics from a log of 6 deployments (change lead time — from the commit). "A bonus for 50 deployments a week. What will happen?" — Goodhart's law. "Which two groups of metrics does DORA distinguish?"

**MT9.** Nines into minutes for 30 days and a week. Choose an SLI. "The budget over 4 weeks is exceeded. What may be deployed according to the Workbook example policy?" — P0 and security fixes. "The budget is 90% consumed but not exceeded. Does the example policy forbid deployment?" — no. "How does an SLO differ from an SLA?" "20 minutes at 10% errors — how many bad minutes?" — 2.

**MT10.** Rewrite a blaming sentence. Order the steps of incident response. "Why does a review ask 'what was visible at that moment' rather than 'why did you make a mistake'?"

**MT11.** Match the Three Ways with the simulator mechanics. Expand CALMS and for each letter say where it came up. Identify the type of culture from three schemes of how news travels.

### 11.5. Drills

Endless task generators built from random engine runs; this is also review, and the answers go into FSRS.

| Drill | What it generates | Check |
|---|---|---|
| "Little" | Two of the three quantities, find the third; sometimes data with growing WIP — the correct answer is "cannot be done" | A number ±2% or "cannot be done" |
| "Reading a CFD" | A CFD with a known bottleneck | A click on a band and a range of days |
| "SLE" | A cycle time scatterplot | A deadline with 85% probability |
| "Nines" | SLO and window → minutes; an outage and an error rate → bad minutes; burn rate and window → action | A number ±1% |
| "DORA from a log" | A log of 5–15 deployments | Five numbers ±5% |
| "CI, delivery or deployment" | A description of a team's process | Classification |
| "Type of work" | A card from a team's life | One of the four bins |
| "Blameless" | A blaming sentence | Automatic check by glossary |
| "CD3" | A set of features with cost of delay and amount of work | Order |

---

## 12. Your own AI model in this block

The connection is shared across the product (`09` §4: providers checked for CORS, adapters, key storage). The block never depends on it: all explanations, observations and reviews exist as ready texts. Uses:

1. **"Why is that?"** at an observation, a decision and a chart. The model gets a snapshot: the scenario, the day, the metrics for 5 days, the decision and its consequences, the text of the chapter paragraph, the learner's level, the ladder rung and the list of concepts introduced by this point, with the rule "use only these terms; if a new one is needed, explain it in simple words without naming it".
2. **Checking text answers** by rubric 11.3 outside the exam: the model returns JSON `{criteria:[{id, pass, quote, comment}]}`; if the answer cannot be parsed, a self-check against the reference is shown.
3. **A conversation partner in the review** (screen 4): one follow-up question about the learner's answer and an assessment of the second answer by the same rubric.
4. **The mentor at rungs 4–5 of the ladder** answers "where did you look?" and names a document from `docs_allowed` (section 6.4).

During the entry check, the exit tickets and the S8 exam the "Why is that?" and "Conversation partner" buttons are inactive (`01` §14.1, `09` §4.7).

---
## 13. Data formats

The block's content is bilingual (`Bi` = `{en, ru}`); a block with `draft: true` does not get into the build for learners, one with `hold: true` waits for a second source. The two-source rule is carried over to the theory: any statement with a number or a study (DORA, Accelerate, the 50% rule in SRE, Weinberg's table) keeps at least two sources, at least one of them primary (`doc`/`spec`/`book`), otherwise the paragraph is in `hold`. The source registry is the shared `sources.yaml` (`08` §7.4).

```
content/methodology/
  lessons/MT0.1.yaml … MT11.2.yaml     # chapters: lesson format 01 §7 / 08 §7.2
  explainers/X0.yaml … X12.yaml        # mechanism scenes: stepper, diagram, breakit, packets, lenses
  placement/{l1,l2}.yaml               # format 01 §4.2
  scenarios/S0..S8/scenario.yaml
  events/*.yaml
  decisions/*.yaml
  observations/*.yaml
  quizzes/MT0..MT11.yaml
  exam/exam-methodology.yaml           # format 10 §6.2
# concepts — the shared content/concepts.yaml; word forms — the shared content/glossary.yaml; sources — the shared sources.yaml
```

**A chapter screen:**

```yaml
id: methodology/MT2.3
block: methodology
core: M21
levels: [L0, L1, L2]
hook: { ru: "Владелец бизнеса спрашивает: «Сколько дней ждать новую функцию?» Через полчаса вы ответите без гадания.", en: "..." }
screens:
  - id: s1
    kind: diagram
    widget: explainer
    explainer: X2
    introduces: [M23]
    uses: [M07, M08, M20]
  - id: s3
    kind: theory
    introduces: [M21]
    doc_step: { L0: 1, L1: 2 }
    claims:
      - text: { ru: "Среднее число начатых и не законченных задач равно средней пропускной способности, умноженной на среднее время цикла, если система стабильна.", en: "..." }
        sources: [little-1961, vacanti-aamfp, kaiten-cfd-ru]
practice: [S1.round2]
exit: [q.MT2.little-01, q.MT2.little-02, q.MT2.transfer-01]
```

**A scenario:**

```yaml
id: S2
module: methodology/MT3
title: { ru: "Узкое место", en: "The bottleneck" }
days: 20
seedPool: pool.S2                      # seeds checked in CI on the bots
board: [ready, dev, review, test, done]
people:
  - { role: DEV-1, skills: [dev, review], die: [1,2,3,4,5,6] }
  - { role: DEV-2, skills: [dev, review], die: [1,2,3,4,5,6] }
  - { role: QA,    skills: [test],        die: [1,2,3,4] }
policies: { wip: {}, strictWip: false, pullOrder: fifo }
backlog:
  - { template: feature-cart, count: 8 }
  - { template: feature-misc, count: 10 }
  - { template: improve-cart-checklist }
arrivals: { perDay: [1, 2], from: ideas }
events: [env-unavailable@8]
decisions: [D2@6]
observations: [O-band-widening, O-starvation, O-multitask, O-wip-over]
goals:
  - id: s2-features
    needs: [flow]
    when: "flow.done.byType.feature>=flow.passLine.doneFeatures"
    envs: [sim]
    fail:
      - if: "flow.metrics.cycleP85>flow.passLine.cycleP85"
        say: { ru: "Функций меньше, чем могло быть: работа копилась перед проверкой. Посмотрите на полосу «Проверка» CFD.", en: "..." }
        term: M09
  - id: s2-where-now
    needs: [flow]
    when: "flow.answers.q-S2-where-now.pass=true"
    envs: [sim]
bots: { baseline: bot.baseline, reference: bot.reference }
debrief: { explain: q.S2.explain-five-steps }
```

**A quiz task:**

```yaml
id: q.MT2.little-01
kind: number
concepts: [M21]
doc_step: 1
text: { ru: "В работе в среднем 12 задач, команда заканчивает 3 в день. Среднее время цикла, дней?", en: "..." }
answer: 4
tolerance: 0
wrong:
  - { value: 36, why: { ru: "Вы перемножили. Время цикла = WIP / пропускная способность.", en: "..." } }
ref: methodology/MT2.3#p2
```

**A rung 4 task:**

```yaml
id: q.MT9.slow-alert
kind: sim-policy
concepts: [M34]
doc_step: 4
docs_allowed: [sre-workbook]
text: { ru: "Включите в S6 медленное оповещение по SLO. Порог и окна найдите в первоисточнике.", en: "..." }
check: "flow.policies.alerts[kind=ticket].burn=1 && flow.policies.alerts[kind=ticket].window=3d"
hints: []                              # there are no hints at rung 4
```

**An event in the run log:**

```json
{ "type": "sim.action", "ref": "methodology/S2",
  "data": { "seed": 20261118, "d": 6, "k": "decide", "id": "D2", "o": "swarm" } }
```

---

## 14. The block's visual language and what we take from Sankofa

### 14.1. Color that carries meaning

Color on the board and in the explanations means only the type of work and the state of the flow; the board's stages are neutral. The tokens are proposed to the author of `08` for §5.2, the contrast is checked by their test (text ≥ 4.5:1, lines ≥ 3:1), and every color is duplicated by shape.

| Token | Meaning | Light | Duplicating shape |
|---|---|---|---|
| `--c-work-feature` | Feature, business project | `#0F766E` | Solid fill |
| `--c-work-internal` | Internal project, improvement | `#5B21B6` | Diagonal hatching |
| `--c-work-change` | Planned change | `#8A5A00` | Dots |
| `--c-work-unplanned` | Unplanned work | `#9D174D` | Cross-hatching and a "!" icon |
| `--c-work-toil` | Toil | `#475569` | Horizontal hatching |
| `--c-wait` | Waiting, queue | `#94A3B8` | A grey dashed line on an arrow, hatching on the time strip |
| `--c-flow-active` | Work on a card | `--c-flow` | A solid strip |
| `--c-money` | Money | `--c-flow` | A monospace number with ₽ / $ |
| `--c-budget` | Error budget | a scale like `--c-limit` | A thermometer strip |

Red `--c-err` is not used for unplanned work: that is a type of work, not an error. It means only a state (an outage, a violated limit) and is always accompanied by the ⨯ sign.

### 14.2. Typography and charts

The fonts are shared: IBM Plex Sans and IBM Plex Mono. Chapter texts are presented as a Sankofa magazine page: a 64–72 character column, a large lead, source footnotes in the margins, and under the paragraph on a phone. Gauge charts follow the rules of `08` and the data visualization skill: a shared day axis for charts stacked one above the other; direct labels on lines instead of a legend; no 3D and no decorative fills. Transitions between explanation steps are smooth (200–300 ms), instant with `prefers-reduced-motion`.

### 14.3. What we take from the Sankofa engine

| Sankofa mechanism | Where it lives | Use in the block |
|---|---|---|
| Magazine-style text delivery, scroll scenes, layers | `features/engine/scroll.ts`, `layers.ts` | Chapters, explanations X0–X12, review screens |
| The seeded generator `rng(seed)` | `features/engine/ink.ts` | `flowlab` determinism; nothing else from this file (ink drawings) is used |
| Calm mode | `features/engine/calm.ts` | No dot-filling animation; a static review |
| QR and handoff to the phone | `features/engine/qr.ts` (up to 213 bytes) | The run's seed, decisions and policies (8.11) |
| "The gauge that lies" `lyingProgress` | `features/engine/decay.ts` | X8 screen 4: a green gauge while value stands still — as data behavior, without illustrations |
| Lenses and the empty lens | `features/model.ts` (`Lens`, `empty`, `silence`) | X11 and S7: the lenses are data sources, the empty one is customer feedback |
| Bilingual blocks, `draft` / `hold`, checks at build time | `features/model.ts` | All content; the two-source rule |
| Cards over the scene with a return to the same place | the glossary mechanic | A chapter paragraph over the board, a return to the same day |
| Data loading with caching and retry | `mechanics/data.ts` | Scenarios and the task bank |

We do not take: ink drawings (`sketch`, `ink`, `hatch`), characters and storylines, sound (`clap.ts`). The alert in S7 and X10 is shown visually — with a `page` mark on the "On-call" lane and a flashing status through `FlashGate` (no more than 3 flashes per second). The Sankofa paths are given according to the `sankofa-angel` working copy; before implementation they are pinned by a commit in `08` §2, otherwise the links will break.

---

## 15. Links to other blocks

- **CI/CD (`06`).** Concepts M13–M17 (CI, continuous delivery, continuous deployment, pipeline, DORA) are introduced only by this block, in MT7–MT8. Block A0 from `06` was merged into MT7: the "One line" screen became a screen of chapter MT7.2, the A0 quiz went into the MT7 bank, the term everywhere is "continuous delivery (Continuous Delivery)", and in Russian «поставка» is a synonym word form in the shared glossary. DORA everywhere means five metrics in two groups per dora.dev, change lead time is counted from the commit. CI practice is the CI/CD block (A1–A6, after Docker); explanation X1 refers forward to "The path of a commit to production".
- **Git.** The code repository and merging are Orientation concepts (F12); Git practice is module G after Linux (`06` §0.1).
- **Ansible and Terraform.** The "Environments from code" improvement in S5 refers to these blocks.
- **Monitoring (`06`, C15).** SLI, SLO, error budget and burn rate are introduced here (M33, M44, M34); in monitoring the learner writes them in PromQL (`1 − sum(rate(ok))/sum(rate(all))`) for their own service and compares the multi-window alert with the setting from S6. Explanation X10 refers forward to "scrape → storage → PromQL → alert → notification".
- **Kubernetes, the reconciliation loop explanation.** The "desired — actual" pair that a controller compares endlessly is first encountered by the learner here: in the Definition of Workflow and the SLE (MT5) and in the SLO (MT9) the system constantly compares the target with the fact. The reconciliation loop explanation in the Kubernetes block refers to MT5 as the first encounter with this idea.
- **Kubernetes, stage 3 (installation on VMs).** The mandatory step "clean up after yourself and see how much the VMs cost" relies on the cost of delay and money from MT4: the time machines sit idle is money lost.
- **Pet project.** The learner sets up a table of the five DORA metrics of their pipeline and computes them with the same code as in the live data of 11.2. An export recipe:

```bash
# GitLab: deployments to production and the commits that went into them
glab api "projects/:id/deployments?environment=production&per_page=100" \
  | jq -r '.[] | [ "D-\(.id)", .deployable.commit.created_at, .finished_at,
                   (.status=="failed"), "", false ] | @csv' > deploys.csv
# GitHub: gh api repos/:owner/:repo/deployments and .../deployments/{id}/statuses
```

The learner sets the `unplanned` field from `hotfix` labels, and `restored_at` from when the incident was closed. Built-in DORA dashboards in GitLab are not available on all tiers, so we compute them ourselves.
- **Career.** The block contributes the "CI, delivery or deployment" drill, the "Explain it yourself" screens and the AI-based conversation partner.

---

## 16. Sources

### English

- Gene Kim, Kevin Behr, George Spafford. *The Phoenix Project*. IT Revolution, 2013. https://itrevolution.com/product/the-phoenix-project/
- Gene Kim, Jez Humble, Patrick Debois, John Willis, Nicole Forsgren. *The DevOps Handbook*, 2nd ed. IT Revolution, 2021. https://itrevolution.com/product/the-devops-handbook-second-edition/
- Nicole Forsgren, Jez Humble, Gene Kim. *Accelerate*. IT Revolution, 2018. https://itrevolution.com/product/accelerate/
- DORA. Software delivery performance metrics (five metrics, throughput and instability; change lead time from commit). https://dora.dev/guides/dora-metrics/
- DORA. Quick Check updates (22.04.2026, deployment rework rate). https://dora.dev/quickcheck/ , https://dora.dev/insights/quickcheck-updates/
- CD Foundation. DORA's 5 metrics (16.10.2025). https://cd.foundation/blog/2025/10/16/dora-5-metrics/
- DORA. Generative organizational culture (Westrum). https://dora.dev/capabilities/generative-organizational-culture/
- Ron Westrum. A typology of organisational cultures. BMJ Quality & Safety, 2004. https://qualitysafety.bmj.com/content/13/suppl_2/ii22
- Google. *Site Reliability Engineering*: Eliminating Toil; Postmortem Culture. https://sre.google/sre-book/eliminating-toil/ , https://sre.google/sre-book/postmortem-culture/
- Google. *The Site Reliability Workbook*: Implementing SLOs; Alerting on SLOs; Example Error Budget Policy; Postmortem Culture. https://sre.google/workbook/implementing-slos/ , https://sre.google/workbook/alerting-on-slos/ , https://sre.google/workbook/error-budget-policy/ , https://sre.google/workbook/postmortem-culture/
- Etsy. Debriefing Facilitation Guide (Allspaw, Evans, Schauenberg, 2016). https://extfiles.etsy.com/DebriefingFacilitationGuide.pdf ; https://www.etsy.com/codeascraft/blameless-postmortems
- Jez Humble, David Farley. *Continuous Delivery*. Addison-Wesley, 2010; https://continuousdelivery.com/
- Martin Fowler. Continuous Integration. https://martinfowler.com/articles/continuousIntegration.html
- The Kanban Guide, v2025.5 (1 May 2025, CC BY-SA 4.0). https://kanbanguides.org/the-kanban-guide/ ; PDF: https://kanbanguides.org/the-kanban-guide/2025.5/pdf/kanban-guide.v2025.5.en.pdf
- Scrum Guide 2020. https://scrumguides.org/
- Kanban Guide for Scrum Teams. https://www.scrum.org/resources/kanban-guide-scrum-teams
- Manifesto for Agile Software Development. https://agilemanifesto.org/
- Daniel Vacanti. *Actionable Agile Metrics for Predictability*. https://actionableagile.com/resources/publications/aamfp/
- John D. C. Little. A Proof for the Queuing Formula L = λW. Operations Research, 1961. https://doi.org/10.1287/opre.9.3.383
- Black Swan Farming. Cost of Delay, CD3. https://blackswanfarming.com/qualitative-cost-delay/ , https://blackswanfarming.com/all-pages
- Donald Reinertsen. *The Principles of Product Development Flow*. Celeritas, 2009.
- Eliyahu Goldratt. *The Goal*. North River Press. Dice game: https://thedicegame.pages.dev/game1.html ; https://juliadynamics.github.io/DiscreteEvents.jl/v0.2/examples/dicegame/dicegame
- getKanban (Russell Healy). https://getkanban.com/ ; an overview of the games: https://kirillklimov.com/kanban-games/
- Featureban (Mike Burrows), primary source — the Agendashift materials: https://www.agendashift.com/featureban (license CC BY-SA 4.0 according to the author's slides; until confirmed by the primary source page, the card is in `hold`). Online adaptation: https://esicenter.bg/featureban-simulation/
- GamingWorks. The Phoenix Project business simulation. https://www.itpreneurs.com/course/gamingworks-the-phoenix-project/
- Businessmap Kanban Flow Simulation. https://knowledgebase.businessmap.io/hc/en-us/articles/4524939368338-The-Kanban-Flow-Simulation
- Insight Maker: Kanban Board Simulation. https://insightmaker.com/tag/toc
- Penny game. https://www.sessionlab.com/methods/ubyljf
- Nicky Case, Vi Hart. Parable of the Polygons. https://ncase.me/polygons/ ; Explorable Explanations: https://explorabl.es/
- Bret Victor. Explorable Explanations. http://worrydream.com/ExplorableExplanations/
- Bartosz Ciechanowski (ciechanow.ski) and Josh Comeau (joshwcomeau.com) — references for the engineering graphics of explanations.
- Gerald Weinberg. *Quality Software Management, Vol. 1: Systems Thinking*. Dorset House, 1992 (the table of switching losses).
- Frederick Brooks. *The Mythical Man-Month*. Addison-Wesley, 1975/1995.
- J. F. C. Kingman. The single server queue in heavy traffic. Proc. Cambridge Philosophical Society, 1961.

### Russian

- Gene Kim, Kevin Behr, George Spafford. «Проект "Феникс". Роман о том, как DevOps меняет бизнес к лучшему» (The Phoenix Project, Russian edition). Eksmo (Bombora). https://eksmo.ru/book/proekt-feniks-kak-devops-menyaet-biznes-k-luchshemu-ITD959565/
- Gene Kim, Patrick Debois, John Willis, Jez Humble. «Руководство по DevOps» (The DevOps Handbook, Russian edition). Mann, Ivanov and Ferber (check the imprint against the publisher's site before publication).
- Nicole Forsgren, Jez Humble, Gene Kim. «Ускоряйся! Наука DevOps» (Accelerate, Russian edition). Intellektualnaya Literatura, 2020, ISBN 978-5-6042881-1-5.
- Betsy Beyer, Chris Jones, Jennifer Petoff, Niall Murphy. «Site Reliability Engineering. Надёжность и безотказность как в Google» (Site Reliability Engineering, Russian edition). Piter.
- Jez Humble, David Farley. «Непрерывное развёртывание ПО» (Continuous Delivery, Russian edition). Williams, 2011.
- Eliyahu Goldratt. «Цель. Процесс непрерывного совершенствования» (The Goal, Russian edition). Popurri / Alpina.
- David Anderson. «Канбан. Альтернативный путь в Agile» (Kanban, Russian edition). Mann, Ivanov and Ferber.
- Kanban Guide, Russian translation of the 2020.12 edition (there is no translation of v2025.5; we give the terms per v2025.5). https://kanbanguides.org/the-kanban-guide/translations/
- Scrum Guide 2020, translations. https://scrumguides.org/download.html
- The Agile Manifesto, Russian version. https://agilemanifesto.org/iso/ru/manifesto.html
- Featureban Online: a facilitator's guide (translation). https://habr.com/ru/articles/499050/
- Kaiten: how to read a cumulative flow diagram. https://habr.com/ru/companies/kaiten/articles/769212
- Cumulative Flow Diagram analysis. https://vc.ru/id2611688/2005756-analiz-cumulative-flow-diagram
- Flant / Express 42. State of DevOps Russia 2025. https://deckhouse.ru/wp-content/uploads/docs/stateofdevopsrussia2025.pdf ; overview: https://habr.com/ru/companies/flant/articles/837472/
- An overview of "State of DevOps in Russia 2025" on the Yandex Cloud blog. https://yandex.cloud/ru/blog/state-of-devops-russia-2025

Books and official documents are marked in the registry as primary, Habr and vc.ru as explanatory. Before release every link goes through an availability check in the build (a response other than 200 puts the paragraph into `hold`).

---

## 17. Implementation order

1. **The term validator over all of the block's content** (`concepts.yaml`, `08` §7.3) — before anything is shown to learners. The texts of chapters MT0–MT2 and explanations X0–X2.
2. **The `flowlab` engine** with property tests: Little's law holds on windows where the system starts and ends empty (`|avgWIP − TH·avgCT| / avgWIP < 0.02`), and with a tolerance of 0.1 on stable windows (1,000 seeds); the risk calibration table of 8.4 is reproduced with an accuracy of ±0.01 analytically and ±0.05 over 10,000 runs; the same log on the same seed gives a byte-for-byte identical state; changing one decision does not change the random streams of other people; S0 produces the numbers from section 9.
3. **S1 in full** (the board, the CFD, the scatterplot, observations, a review without counterfactuals) — the first showing to live L0 learners; based on the results we adjust the texts and constants.
4. **Bots, `passLine`, seed pools in CI** (the reference passes all goals, the baseline passes none of the key ones), counterfactuals and the stepper review; MT3–MT5 with X3–X6, S2–S3.
5. **Deployments, incidents, DORA**: MT6–MT8, X1 in full, X7–X8, S4–S5.
6. **Reliability series and SLO**: MT9–MT10, X9–X11, S6–S7; the S6 calibration test (the reference passes on ≥ 90% of seeds, the baseline on ≤ 20%).
7. **The S8 exam and live data**, the primary-source ladder with rungs 3–5, level checks, drills, connecting the AI model.
8. **MT11 and X12**, the EN version of the texts.

---

## Changes after review

The reviews `reviews/07-methodology-kanban--by-01-andragogy.md` (hereafter Rev1) and `reviews/07-methodology-kanban--by-06-iac-cicd-monitoring.md` (hereafter Rev6) were taken into account, as well as the owner's requirements R1–R5. Disputed facts were checked against the primary sources on 18.11.2026: Kanban Guide v2025.5 (six minimal elements of the Definition of Workflow, SLE, three practices, four metrics, no term "lead time"), dora.dev (five metrics, change lead time from the commit, the definition of deployment rework rate), SRE Workbook "Example Error Budget Policy" (a freeze only when the budget over 4 weeks is exceeded, exceptions for P0 and security, a review at > 20% from a single incident, escalation to the CTO).

### What was changed

1. **The textbook at the center (R1; Rev1-1, Rev6-2).** Section 0 with the anatomy of a module and section 4 "Textbook" were added: each module has lessons, screens with `introduces`, hooks, topics of the connected text and primary sources. The simulator became the chapter's practice; the `unlocks` mechanism was removed, observations and events refer to chapter paragraphs (`ref`), and a forward reference is a build error. Review screen 5 was renamed "What you applied from the chapter".
2. **The style of explanations (R4, R5; Rev1-2, Rev6-1, Rev6-7).** Ink drawings, characters (names, avatars, lines of dialogue), the legend-plot, "blots" and the pager sound were removed. The simulator has the roles `DEV-1`, `DEV-2`, `QA`, `OPS`, `PO`, `OWNER`, dilemmas come as internal memos; the trust mechanic became a visible indicator "share of accepted proposals". E1, E8, E11 were rewritten as the diagrams X0, X12, X11 (the lenses are data sources). From Sankofa we kept the magazine-style delivery, scenes, layers, calm mode, lenses, QR, bilingual YAML, `draft`/`hold` (section 14.3).
3. **The shared concept graph (Rev1-3, Rev6-8).** The block's own `content/methodology/glossary.yaml` was abolished; the block uses the `concepts.yaml` graph, the shared glossary and the `08` validator. The modules were renamed to `MT0…MT12`. A mapping table to the `01` concepts and new ids (M19–M44, M18a–M18d) are given; the Orientation concepts F07–F12 are used, not introduced. The missing concept M10 "automation" was added (MT6.2).
4. **Process explanations (R3; Rev1-4, Rev6-6).** Section 5: general rules and thirteen storyboards X0–X12 screen by screen (what is on the screen, what moves, what is clickable, parameters and "break it", the recalculation and the explanation line). The mandatory methodology processes: X1 "A task from idea to production", X4 "Where the flow gets stuck", X10 "From alert to review". The numbers in the explanations are computed by the engine's formulas.
5. **The primary-source ladder (R2; Rev1-5, Rev6-3).** Section 6: the structure of the block's documents, rungs by level (L0 1→4 by chapter, L1 from 2, L2 from 3, rung 5 at the exam), the tasks of each rung with checks, the mentor behavior "where did you look?", the `doc_step` and `docs_allowed` fields.
6. **Terms before their introduction (Rev1-6, Rev6-9).** "Feature" and "defect" are introduced in MT0, "review" and "testing" in MT0.2, the percentile in MT2.4, "switching" in MT1.2, runbook and pairing in MT6.2, Goodhart's law in MT8. S2 no longer uses "backlog", "internal project", "automated tests" (the improvement is a "testing checklist"); in S4 "A signal when the site goes down" instead of "monitoring", "roll back" is hidden without `caps.rollback`; "The Three Ways" and "the second way" were removed before MT11; the 50% rule in MT6 is given as an observation with a forward reference; the feature flag option in D4 was replaced. For L0, "certificate" and "database server" in P-I4 were replaced with "hosting contract" and "moving the site".
7. **Concept load (Rev1-7, Rev6-9).** Modules are split into lessons per `01` §7, no more than one concept per screen and four per lesson; MT2 has four lessons, MT5 three.
8. **Duplication with A0 and DORA (Rev1-8, Rev6-16, Rev6-17).** A0 from `06` was merged into MT7 (the "One line" screen, the A0 quiz, the sentence about the CDP abbreviation); a single term "continuous delivery", and in Russian «поставка» is a synonym. DORA is five metrics everywhere; change lead time is counted from the commit (`committedDay`), `mergedDay` is kept for flow efficiency.
9. **Links to blocks (Rev1-9, Rev6-9).** Git is module G and concept F12; CI is the CI/CD block (A1–A6); monitoring is named as a block, not "07".
10. **The level check (Rev1-10, Rev6-15).** The `01` §4.1 format (confidence, key tasks, 72 hours, variants); practical tasks P-I7, P-I8, P-E7 were added; key tasks are marked; the tasks are declared the canon instead of `01` §4.3. P-E2 no longer "closes M2" (Rev1-26).
11. **The risk formula (Rev1-11, Rev6-4).** Replaced by a model of independent risks with a correction for interaction; a calibration table and a property test are given. S5 was brought to "roughly every second train breaks".
12. **SLE and Definition of Workflow (Rev1-12, Rev6-18).** Concept M25 in MT5.3; the S1 question gets the name SLE in MT5; the "Promise" drill became "SLE"; the theory explains why the Kanban Guide has no "lead time". Scrum — accountabilities and the commitments of artifacts (Rev1-21).
13. **S0 (Rev1-13, Rev6-21).** Cards of 4 points, 8 days, the numbers recalculated by Weinberg's table: "all six at once" — not a single one done in 8 days.
14. **Reliability series and a request-based budget (Rev1-14, Rev6-5).** Incident types, per-minute series, SLIs from the series, bad minutes with the error rate and traffic, the `O-sli-blind` observation were added; detection with `slo-alerts` depends on the burn rate. S6 became passable, the calibration test is in section 17.
15. **Relative thresholds (Rev1-15).** All scenarios and the exam are passed by `passLine = baseline + 0.6 × (reference − baseline)` on seeds from a pool checked in CI. The rules of the reference bot are described explicitly (Rev6-23).
16. **The exam (Rev1-16, Rev6-14).** S8 in the `10` §6.1 format: 70% practice through goals, 30% `explain`, the critical parts "stability during the sale" and "money", the AI model is off, the assistant mode is in the record, a retake after 24 hours.
17. **The 09 contracts (Rev1-17, Rev6-12, Rev6-13).** The internal language was named `flowexpr` and kept for events and observations; passing is `09` goals over `facts.flow`; progress is `LearnEvent` `sim.action`/`sim.result` in IndexedDB and `snapshots`; `localStorage` is only for interface trivia.
18. **QR (Rev6-11).** Only the seed, decisions and policies go through the QR code (≤ 200 bytes after deflate); the full log goes through the shared export.
19. **Little (Rev6-10).** The WIP of a day is defined as the cards with `startedDay ≤ d ≤ finishedDay`; the identity with the cycle time `f − s + 1` became exact; the test tolerances are in section 17.
20. **The stepper review (Rev1-18).** Review screen 1 is a `stepper` over the log with a policy slider and recalculation as a counterfactual; `flow.*` events on the `SimEvent` bus.
21. **Lesson order by level (Rev1-19, Rev6-27).** L2 — a challenge scenario before the text, explanations in "mechanism only" mode; the L2 path is MT6–MT12 and S4–S8; L0 comes after Orientation.
22. **Color (Rev1-20, Rev6-25).** Tokens for work types, waiting, money and the budget with a duplicating shape; red only for a state.
23. **P-I6 and the budget policy (Rev6-19).** The task and the MT9 quiz were brought to the condition "the budget is exceeded", the exceptions are P0 and security; half of the variants check that an unexhausted budget does not forbid deployment.
24. **Alert thresholds (Rev1-24, Rev6-20).** Two page thresholds (14.4/1 h/5 min and 6/6 h/30 min) and a ticket (1/3 days/6 h); `O-budget-burn` was rewritten.
25. **Small things.** The Kingman label was clarified and a spread slider was added (Rev1-22); the switching floor is Weinberg's table down to 0.25 (Rev1-23); lead time is counted from "Ready to start" everywhere (Rev1-25); review through FSRS, quiz sizes per `10` §4 (Rev1-27); AI model providers — by a link to `09` §4, the "copy the prompt" mode was removed (Rev1-28); sources: the Russian edition of Accelerate, Featureban via Agendashift with `hold`, Kanban Guide v2025.5 with the PDF and a note about the translation, Sankofa paths per the working copy with the requirement to pin a commit (Rev1-29, Rev6-26); the "How this course works" screen in MT0 (Rev1-30); `O-hero` with a window of 3 out of 4 within 10 days, the `O-big-batch` text with numbers from the formula (Rev1-31, Rev6-22); the time budget of 14 / 8 / 5 hours was passed to the author of `01` (Rev1-31, Rev6-27); a DORA export recipe for the pet project (Rev6-24).
26. **R6–R12.** These requirements concern the Linux, networking, containers and Kubernetes blocks; within the methodology area two links were recorded (section 15): the reconciliation loop refers to MT5 and MT9 as the first encounter with the "target — fact" pair, and the VM cleanup step at Kubernetes stage 3 refers to the cost of delay from MT4.

### What was rejected and why

- **Rev1-3: module ids `meth.m0…m12`.** Rev6's proposal `MT0…MT12` was accepted: it is shorter, reads well in text and does not conflict with `meth.l1.5` — the ids of level check tasks in `01`.
- **Rev6-8: move M04 (value stream) after M09 and introduce "incident" as M02a.** Rev1's option was accepted: the path of one task is introduced in MT0 (a beginner needs an image of the path before the board and before the bottleneck), and flow efficiency along this path in MT7 (M17). A separate M02a is not needed: "outage" is part of M02 at an everyday level, and response is a separate concept M32 in MT10.
- **Rev1-3: M13 (DORA) requires M32.** In Rev1's table M32 is introduced in MT10, while DORA is in MT8, so this prerequisite would break the order. Instead, DORA requires M31 "rollback and recovery" (MT7): the recovery and change failure rate metrics need rollback, but not on-call duty and diagnosis.
- **Rev6-1: keep names in the simulator in small print.** Rejected. Rev1 and R4 require roles without names, and a "show names" setting would give scenario authors a reason to write a plot again. Roles are also less ambiguous in the review.
- **Rev6-2 / Rev6-9: in S2, "move the automated tests mechanic to S5".** Another option from the same Rev6 was accepted: the improvement in S2 was kept but became a testing checklist without "automation"; this way S2 keeps the "elevate" step, without which Goldratt's five steps do not close the loop.
- **Rev1-6: introduce "feature flag" in MT7.** Rejected: it is an unnecessary concept for a block where the pipeline is not built by hand. Dilemma D4 was reworded without it ("deploy one feature out of five"), and feature flags remain with the CI/CD block.
- **Rev6-8: store word forms in `concepts.yaml`.** Rejected: word forms are already stored by the shared `08` §7.3 glossary (the `stems` field), and a second source of them would again give two linters. Only `introduced_in` remains in `concepts.yaml`.
- **Rev6-27: cut S3 for L1 for the sake of the 8-hour budget.** Accepted. The proposal to fit L0 into the 12 hours of `01` was rejected: connected chapters and thirteen process explanations are mandatory requirements R1 and R3, and the honest estimate is 14 hours; the figure was passed to the author of `01`.
- **Rev6-11: restore card movements on the phone with "the reference policy".** Changed to the learner's own pull policy: the reference one would show someone else's run under their name.
