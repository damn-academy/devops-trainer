# Review of 07-methodology-kanban.md (reviewer: the author of 06-iac-cicd-monitoring.md, IaC, CI/CD, monitoring)

Reviewer: the author of `06-iac-cicd-monitoring.md` (DevOps/SRE, pipelines, SLOs, alerts). Checked against documents 01, 06, 08, 09, 10, against the Sankofa code (`sankofa-angel/web/src/features/engine/{qr,decay,ink}.ts`, `features/model.ts`) and against primary sources: dora.dev, SRE Workbook, Kanban Guide v2025.5, Scrum Guide 2020.

## Verdict

The subject-matter part is strong, and as a production model the document is better than anything else in the product on the topic of process. The deterministic `flowlab` with common random numbers, counterfactuals, data instead of code, the rubric for text answers — all of this should be kept as is. Still, the document cannot be accepted in its current form, for four reasons.

1. It contradicts the owner's requirements R1, R4 and R5. The simulator is called the heart of the block, theory is opened through slide-out cards, and explainers are drawn in ink, with characters and a plot.
2. It has no documentation ladder (R2) and no step-by-step process explainers in the R3/R4 format.
3. The model constants do not produce the results the text promises. Batch risk, the error budget, the Little's law check and S0 do not add up arithmetically, and with the stated formulas S6 is almost impossible to pass.
4. The document diverges from the shared contracts. Module IDs conflict with the graph in 01. The QR code cannot hold the log. Progress is stored in `localStorage` instead of the journal from 09. It uses its own condition language instead of the predicates from 09. The exam is structured differently from 10. And block A0 from my document 06 duplicates M7/M8.

Below are 27 findings: 6 BLOCKING, 13 MAJOR, 8 MINOR. Each comes with a ready fix.

---

## Findings

### 1. BLOCKING — R4/R5: ink, characters and a plot in the explainers

**Where:** §4 (introduction: "Explainers are assembled on the Sankofa scene engine (scrolling, layers, ink drawings)"), §4.1 E1, E7, E8, E11, §6.8, §12 (the lines "Ink drawings… Characters", "Sound… of a pager").

**What is wrong.** The owner requires (R4): a process explainer is a simple diagram of blocks, arrows and labels on the lines, basic animation, no cartoons, characters or plot. R5 adds: clean engineering graphics in the spirit of Ciechanowski/Comeau, not Sankofa ink. Document 07 does the opposite. E1 is "an ink drawing, a development desk, a wall". E8 is a piece of news that the tester Vika carries to the owner Elena. E11 is "four stories" by characters. In §12 ink is used "for characters", and on top of that a pager sound plays. Document 08 (§5.1) still allows ink for metaphors, but R5 cancels that too. Incidentally, my 06 (§0.5, `ink.ts`) has the same sin, and I will fix it.

**Fix.**
- In §4 replace the sentence with: "Explainers are assembled on the lesson engine (document 08): `mechanism` scenes with a stepper (`stepper`), a live diagram (`diagram`), `breakit` toggles and lenses (`lenses`). Graphics are only "blueprint" (08, §5.1): blocks, arrows, labels on the lines, monospaced values. Ink, characters, dialogue lines and plot are not used in explainers."
- In §12 delete the line "Ink drawings". Replace the `clap.ts` line with: "Sound is not used; the alert in S7 is shown visually (a blinking `page` label via `FlashGate`, ≤ 3 flashes/s)."
- Rebuild E1, E8 and E11 (below, finding 7) and E5 (finding 6, X1).
- The simulator is not an explainer but a case, so names are acceptable in it. But avatars and speech "bubbles" must be removed. Proposal: a role badge on the card — `DEV-1`, `DEV-2`, `QA`, `OPS`, `PO`, `OWNER` — and the name in small text in the caption (optional, can be turned off in settings). Dilemmas are presented as an internal memo: "The business owner asks: …", without quoted dialogue.

### 2. BLOCKING — R1: the textbook rests on the simulator, not the other way round

**Where:** preamble ("The heart of the block is the flow simulator"; "Theory opens as you go: every notable decision… is tied to a theory card"), §5.2 ("Theory opens as a slide-out panel over the board").

**What is wrong.** Under R1 the core of the block consists of three things: (a) a coherent textbook with a strict order of entities, (b) process explainers, (c) the habit of going to the documentation. Practice rests on them. In document 07 theory is a set of cards that pop up on simulator events. There is no coherent chapter text. A learner who picks the "wrong" decisions in S1 will not see part of the theory at all: `unlocks.on: O-band-widening`. The result is a textbook that depends on luck.

**Fix.** In §4 add a mandatory module anatomy and make the module table follow it.

```text
Module Mx = 
  1. Textbook chapter (linear text, 1 screen = 1 concept from glossary, strictly in the order of §3;
     links to the primary source — a step of the documentation ladder from §R2 below).
  2. Process explainer (X…/E…): stepper + diagram + sliders + "break it".
  3. Simulator scenario — applying concepts already introduced. Simulator observations
     refer to a paragraph of the chapter ("back to chapter M2, paragraph 4") rather than opening new theory.
  4. Module test and drills.
```

In §6.2 change the meaning of `unlocks`. Now it is "theory opened by the simulator", and it should be "chapter paragraphs the simulator refers to". No concept should appear for the first time in the simulator log. This also closes part of the term-order violations from finding 9.

### 3. BLOCKING — R2: there is no documentation ladder

**Where:** the whole document. Sources exist only in the theory cards (§11) and in §14.

**What is wrong.** Methodology has its own documentation, and learners need to be able to read it too: Scrum Guide, Kanban Guide (current edition v2025.5, May 2025), dora.dev, the SRE book and SRE Workbook, the Agile Manifesto. The document has no steps 1–5. The tutor does not redirect to the primary source. An experienced learner does not start at step 3.

**Fix: a ready section §2.5 "The documentation ladder in the methodology block".**

The anatomy of primary sources that the learner studies at step 2 (the analogue of SYNOPSIS/OPTIONS/EXAMPLES in man):

| Document | Anatomy | Where to look for "what is mandatory" |
|---|---|---|
| Kanban Guide v2025.5 | Definition of Kanban → Kanban Theory → Kanban Practices (three practices) → Flow Metrics (WIP, Throughput, Work Item Age, Cycle Time) | The words "must", "minimum elements" in Definition of Workflow |
| Scrum Guide 2020 | Scrum Theory → Values → Scrum Team (accountabilities) → Events → Artifacts (each with a commitment) | Timeboxes in Events, the commitment of each artifact |
| dora.dev/guides/dora-metrics | Definitions of the five metrics → throughput/instability groups → how to measure → usage warnings | Definitions start with "How long / How often / The share of" |
| SRE Workbook, a chapter | Concept → example → parameter table → appendix policy | Threshold tables (alerting-on-slos), Appendix "Example Error Budget Policy" |

Steps by tier (B — beginner, I — intermediate, E — experienced):

| Step | Who | What the learner sees | Example in the block | Check |
|---|---|---|---|---|
| 1. Glimpse | B: M0–M4 | Under the definition, a line "This definition is from the Kanban Guide, Flow Metrics section ↗", a link to the exact anchor, optional | M2: the WIP definition with a link to `kanbanguides.org/the-kanban-guide/#flow-metrics` | None |
| 2. Fragment | B: M5–M9; I: M2–M5 | Hint = a fragment of the primary source with a highlighted line and a label of the anatomy part ("Artifacts → commitment") | Hint for the M5 test "what is the increment's commitment": a Scrum Guide fragment, "Definition of Done" highlighted | Test answer |
| 3. Find it yourself | B: M10–M11; I: M6–M11; **E: from the first module** | Only a link to the document, without an anchor | (a) "Find in the Kanban Guide the minimum elements of the Definition of Workflow and mark which ones are present on the S1 board." Answer — six: units of work, start and end points, states, WIP control, explicit policies, Service Level Expectation. (b) "Find in the Scrum Guide the maximum sprint length" — one month or less. (c) "Find on dora.dev from which event change lead time is measured" — from the commit to version control, not from the merge | `choice`/`match` over a set, `number` |
| 4. Forcing | B: M12 (S8); I: M9–M12; E: everywhere | The task requires something the course did not cover. No hints. The tutor only answers "where did you look?" and names the document, but not the section | (a) "One incident in S6 consumed 25% of the budget. According to the Example Error Budget Policy, what must happen besides a freeze?" Answer: a mandatory postmortem with at least one P0 action item. The 20% threshold was not introduced in the course. (b) "What short window does the Workbook recommend for the 6× over 6 h alert?" — 30 minutes. (c) "Set an SLE for the S3 board according to the Kanban Guide" — two parts: a time limit and a probability; p85 from history | Numbers, `choice`; for the SLE — the predicate `flow.policies.sle.days=<p85 ±1> && flow.policies.sle.prob=0.85` |
| 5. Exam | everyone: S8 + 9.2 | Only the list of official documents is open (the "Reference" tab: Scrum Guide, Kanban Guide, dora.dev, SRE Workbook), the AI is turned off. 1–2 tasks on things that are not in the course | "Write an error budget policy for the shop following the Workbook appendix, including escalation of disagreements." Rubric: freeze when exceeded over 4 weeks; P0 and security exceptions; postmortem when > 20% by one incident; escalation — to a CTO-level executive | Rubric 9.3 + key elements |

Tutor behaviour (add to §10): at steps 4–5 the system prompt is "do not answer on the substance; ask which document the learner opened, and name a suitable primary source from the module's `docs_allowed` list". The task YAML needs a `doc_step: 1..5` field and `docs_allowed: [kanban-guide, scrum-guide, dora-metrics, sre-workbook]`.

### 4. BLOCKING — the deployment risk model does not produce the promised numbers

**Where:** §6.4, the `p_fail` formula.

**What is wrong.** Σ over a batch of b cards ≈ b·r̄, and after dividing by b what remains is `p ≈ 0,03 + r̄·(1−ta)·1,4^(b−1)`. At b = 10 the multiplier 1,4⁹ ≈ 20,7. With r̄ = 0,08 we get 1,68, i.e. a clamp to 0,9, not "about half". A single change with `testAutomation = 0,6` (the maximum reachable in S5) and r = 0,12 gives 0,078, not "less than 5%". So S5 is calibrated on the wrong curve, and the `O-big-batch` observation will fire on almost every train.

**Fix** (independent risks with an interaction correction, plus a baseline background):

```
r'_i   = card.risk_i × (1 − caps.testAutomation) × (1 + 0.05 × (b − 1))
p_fail = clamp( 1 − (1 − 0.02) × Π_i (1 − r'_i), 0, 0.9 )
card.risk defaults to 0.03–0.08 (mean 0.05) depending on size
```

Check table at r = 0,05 (insert into the "How the simulator works" theory and into the property test in §15):

| b | testAutomation | p_fail |
|---|---|---|
| 1 | 0 | 0,07 |
| 1 | 0,6 | 0,04 |
| 5 | 0 | 0,28 |
| 8 | 0 | 0,44 (≈ "about 40%" in S5) |
| 10 | 0 | 0,54 (≈ "about half") |
| 10 | 0,6 | 0,27 |

In §15 add a property test: "for r = 0,05 the table values are reproduced to within ±0,01".

### 5. BLOCKING — with these formulas S6 can hardly be passed, and a request-based SLO is computed as a time-based one

**Where:** §6.4 (`downtime`), §6.5 ("Error budget = (1 − slo.target) × windowDays × 1440 − spentMin"), S6.

**What is wrong.**
- The minimum downtime of one failed deployment with the best capabilities (`slo-alerts`, `rollback`) is 5 + 30 + 10 = 45 min. That is more than the entire 99,9% budget, which is 43,2 min. With `basic` it comes to 70 min. Thirty deployments a day with a failure share of 4–7% give 1–2 failures per month, i.e. 105–210% of the budget. The pass condition "did not go more than 20% into the negative" is met only with zero failures, and that is a matter of luck, not of decisions.
- In S6 the SLO is defined as "99,9% of successful requests", while the budget is computed as "minutes of full unavailability". These are different SLOs: request-based and time-based. We will teach the learner incorrectly, and in the monitoring block (06, C) they will compute the budget as `1 − sum(rate(ok))/sum(rate(all))`.

**Fix.**

```
incident.errorRatio ∈ [0.05, 1.0]   // share of failed requests during the incident
  failed deploy:     0.05–0.30 (80%), 1.0 (20%)   — from the rand('impact') stream
  incident-traffic:  0.10–0.50
badMinutes = downtime_min × errorRatio × trafficFactor(day)/avgTraffic
budget.left = (1 − slo.target) × windowMinutes − Σ badMinutes
```

Add a paragraph to the M9 theory: "A request-based SLO consumes the budget in proportion to the error share. A minute in which 10% of requests fail costs a tenth of a minute of full downtime. That is why Black Friday traffic burns the budget faster: with the same error share there are more failed requests." E6 keeps "minutes" as the first, simplified scale and states explicitly that this is the special case errorRatio = 1. Recompute the S6 condition on the new model with the reference bot: the reference must pass on ≥ 90% of seeds, the baseline on ≤ 20%. Add this to §15 as a calibration test.

### 6. BLOCKING — R3: there are no process explainers in the R4 format

**Where:** §4.1. E5 is a builder, E4 is a dice game, S7 is a scenario. None of them is a step-by-step process explainer with scrolling forward and back, clickable elements, sliders and "break it".

**Fix.** Add three explainers X1–X3 (08 widgets: `stepper`, `diagram`, `breakit`). Common rules: one idea per screen; labels sit on the lines; clicking an element opens a card "what it is / who does it / where in the primary source"; changing a parameter immediately recomputes the process and writes on the right "what changed and why"; the stepper can be moved back and forward and paused.

**X1 "A task from idea to production" (M7, replaces E5; the E5 builder remains as screen 6).** Diagram from left to right: `Idea → Ready for work → Development → Review → Test → Waiting for deployment → Production → Customers`. Between the blocks are arrows with labels: "handoff", "waiting for a reviewer", "waiting for a window". Under the diagram is a time strip: solid — work, hatching — waiting.

| Screen | What is shown | Parameters | "Break it" | Explanation on change |
|---|---|---|---|---|
| 1 | One card travels the path; the counters "work time", "wait time", "flow efficiency" grow step by step | — | — | "Out of 12 days, someone worked on the card for 1,5 days" |
| 2 | Queues before stages (stacks of dots) | Slider "cards in progress at once" 1…10 | — | "WIP 6 → waiting before review grew from 0,5 to 3 days" |
| 3 | Manual build and check | Toggle "auto-build after merge" | Remove auto-build: a "build manually" block and a 1-day wait appear | "The 'waiting for the build' wait disappeared: the check runs 10 minutes after the merge" |
| 4 | The CI boundary on the diagram (a bracket) | Slider "share of checks done by machine" 0…100% | Remove automated tests: the "Test" arrow again goes through the manual queue | "Change failure share by the model: 7% → 4%" (formula from finding 4) |
| 5 | The last step | Switch "button / automatic"; slider "batch size" 1…20 | Remove rollback: recovery 120 min instead of 10 | "Button — continuous delivery; automatic — continuous deployment. Batch 10 → risk 54%, diagnosis 1 h 45 min" |
| 6 | The E5 builder: the learner collapses the waits themselves | As in E5 | — | Goal: flow efficiency ≥ 40% |

The boundary with my 06: X1 shows the organisational path (waits, handoffs, batches). The mechanics of `git push → webhook → runner → job → registry → deploy` are the 06 explainer "The path of a commit to production", in block A. On its last screen X1 refers to it with a "forward" link (`forward: true`).

**X2 "The bottleneck in the flow" (M3, after E4).** Four stations in a row, card dots moving between them. Above each station is a capacity label ("test: 2/day"), below the station is a queue as a stack.

| Screen | What is shown | Parameters | "Break it" | Explanation |
|---|---|---|---|---|
| 1 | Equal capacities of 3/day, the flow is even | Slider "incoming per day" 1…5 | — | "Input 4 > capacity 3 → the queue grows without limit" |
| 2 | "Test" has a capacity of 2 | Capacity sliders for each station | Remove the tester (capacity 0) | "System output = capacity of the slowest station: 2/day. Speeding up development to 6 achieved nothing" |
| 3 | A queue grows before test, the band widens on the CFD | Toggle "WIP limit on development" | — | "With the limit, the queue before test is no more than 3; developers are free → swarming" |
| 4 | Swarming | Slider "developers helping test" 0…1 (coefficient 0,5 from §6.3) | — | "Test capacity 2 → 3; the bottleneck moved to review" (highlighted) |
| 5 | The five focusing steps as labels on the same actions | Stepper through the steps | — | Each step refers to a paragraph of chapter M3 |

**X3 "From alert to postmortem" (M10, before S7).** Horizontal swimlanes: `Service (error share)`, `Monitoring (burn rate)`, `On-call`, `Status channel`, `Postmortem`. Horizontally, time in minutes; a stepper at the bottom.

| Step | What happens | Labels on the lines |
|---|---|---|
| 1 | Deployment; the error share rises to 20% | "deployment #41" |
| 2 | The burn rate crosses 14,4 (1 h window, 5 min short window) | "paging alert threshold" |
| 3 | Alert → the on-call engineer acknowledges | "time to detect = 6 min" |
| 4 | Status in the channel: "what we see / what we are doing / when the next status is" | "status 1" |
| 5 | Rollback → the error share drops | "time to restore" |
| 6 | The timeline is assembled from the swimlanes | "fact ↔ time" |
| 7 | Contributing factors → tasks | "factor → task" |

Parameters: `monitoring: none / basic / SLO-based` (without monitoring detection = "customer complaint", 240 min), `runbook: yes/no`, `rollback: yes/no`, `batch size`. "Break it": "alert on CPU load instead of error share" (the server is alive, payments are failing, no alert; linked to S6), "no on-call engineer". Counters: time to detect, time to restore, budget consumed in minutes (by the model from finding 5), lost revenue.

### 7. MAJOR — E1, E8 and E11 must be redone as diagrams

**Where:** §4.1.

**Fix.**
- **E1 "Two goals"** (M0). Two blocks, "Development" and "Operations". From each, an arrow to its own metric: "number of features" and "days without failures". The slider "how often we deploy" changes two counters: "changes waiting for customers" and "size of one deployment". The toggle "shared goal" merges both arrows into one metric, "revenue per day", and shows that an undelivered feature and downtime are losses in the same roubles.
- **E8 "The path of bad news"** (M11). An organisation diagram: 5 nodes (test → development → manager → owner) and edges labelled with a delay. The switch "pathological / bureaucratic / generative" changes the edge properties: "suppressed", "waits for procedure for 3 days", "gets through in an hour". On an edge there is a counter "how long until the news reaches someone who can act". No characters. Nodes are named by roles.
- **E11 "One night, four sources"** (M10). The lenses remain, but they are not people's stories, they are data: the deployment log, the error-share chart, the on-call channel log, a support ticket. A fifth, empty lens: "the customer's story — there is none, only a chart". Assembling the timeline still requires dragging facts. The `Lens/empty/silence` mechanics from `features/model.ts` fit as is.

### 8. MAJOR — module IDs conflict with the concept graph in 01, and the order of concepts diverges

**Where:** §3, §4, §11 (`glossary.yaml`), compared with 01, §6.2 (M01–M18) and 10, §8.1 (references to "concepts M14–M16").

**What is wrong.**
- Modules in 07 are called M0…M12, concepts in 01 are called M01…M18. "M2" reads either as the "Flow" module or as concept M02 "Development and operations". 10 says "concepts M14–M16".
- 07 has its own `content/methodology/glossary.yaml`, while 01 has a shared `content/concepts.yaml`. That gives two sources of truth for one linter.
- The order does not match. In 01 M04 (value stream) comes before the board, while in 07 it is in M7. In 01 M12 (incident and postmortem) and M13 (DORA) come before M14 (CI), while in 07 it is CI → DORA → SRE → postmortem. 01 has no SRE concepts at all (SLI/SLO/budget), and in my 06 they are introduced in block C for the intermediate tier, burn rate for the experienced tier.

**Fix.**
1. Rename the modules to `MT0…MT12`. Concepts stay `M01…`, and their IDs are maintained only by 01.
2. Abolish `glossary.yaml`. Store word forms and the introducing module in `concepts.yaml` with the field `introduced_in: methodology/MT2`.
3. The order in 07 is more logical than in 01. I propose that 01 adopts it. Mapping table for both authors:

| 07 (term) | 01 concept | Change in 01 |
|---|---|---|
| MT0: product, change, production, deployment | F09, F10 (Orientation) + M01 | 07 does not reintroduce "production" and "release" but uses `uses: [F09, F10]` |
| MT0: development/operations | M02 | — |
| MT0: failure, incident | **new M02a "Incident"** | Split M12 into M02a "incident" (MT0) and M12 "blameless postmortem" (MT10) |
| MT0/MT11: DevOps | M03 | — |
| MT1: card, board, column | M05, M06 | — |
| MT2: WIP, WIP limit, cycle/lead time, throughput, age, Little, CFD | M07, M08 + new M08a–M08d | Add |
| MT3: bottleneck | M09 | — |
| MT4: batch size, cost of delay | M11 | — |
| MT5: Scrum/Kanban | M18 | — |
| MT7: value stream | M04 | Move M04 after M09; `requires: [M06, M09]` |
| MT7: CI/CD/CDp, pipeline | M14–M17 | — |
| MT8: DORA | M13 | `requires: [M16, M02a]` instead of `[M08, M12]` |
| MT9: SRE, SLI/SLO/SLA, budget, burn rate | **new M19–M22** | Add. In 06, block C switches from `introduces` to `uses` for SLI/SLO/budget/burn rate (this is a change to my document) |
| MT10: postmortem | M12 | — |

### 9. MAJOR — terms appear before they are introduced, within document 07 itself

The build per §3 will fail at these places:

| Where | Term | Introduced | Fix |
|---|---|---|---|
| S1 (MT2), board "Development → Review → Test" | "review", "test" | Review nowhere; "automated test" in MT7 | Introduce in MT1: "review (check by a colleague)", "testing (manual check)". In MT7 introduce only "automated test" |
| S2 (MT3), "Automated tests for the cart", D2 "write automated tests", P-I3 (b) | "automated test", "internal project" | MT7, MT6 | In S2 replace with "Cart check checklist" (speeds up test ×0,7) or move this mechanic to S5 |
| S2, S3, §6.2 "sits in the backlog" | "backlog" | MT5 | Before MT5 say "the 'Ideas' column" |
| MT0, E1, P-I4, tests MT0–MT4 | "feature" | nowhere | Add to MT0: "feature — a new capability for the customer" |
| S4 (MT6): "Basic monitoring", "runbook", D3 "roll back" | "monitoring", "runbook", "rollback" | MT9, nowhere, MT7 | Rename the S4 internal projects: "Write instructions for typical failures" (introduce "runbook" in MT6 as a term), "Signal when the site goes down" without the word "monitoring"; hide the "roll back" option in D3 while `caps.rollback=false` |
| P-I4, M6 test: "certificate", "database server" | — | nowhere (acceptable for I) | For the beginner-tier variant replace with "renew the hosting contract" and "moving the site to a new server" |
| §3 No. 32 "git — in the Linux/practice block" | — | Git is a separate block G (06 §0.1) | "git — block G 'Git'" |
| §13 "auto-build and tests — practice in the Docker block" | — | CI practice is blocks A1–A6 after Docker (06, 01 §5) | "…in the CI/CD block (A1–A6) and in the pet project" |
| §3 No. 44 "Prometheus — in block 07 of the roadmap" | — | Gets confused with document 07 | "in the 'Monitoring' block (step 07 of the checklist)" |

In addition, §3 introduces terms in bulk: in MT0 seven lines of terms for 3–4 screens of E1, in MT5 more than ten Scrum terms in a single line. This contradicts the rule in 01 §8 "no more than one concept per screen". MT0 and MT5 must be laid out across chapter screens: one line — one screen.

### 10. MAJOR — an off-by-one-day error in the Little's law check that the learner sees

**Where:** §6.5 (WIP "at end of day", cycle time `finishedDay − startedDay + 1`), §15 (the Little's law property test).

**What is wrong.** A card started on day s and finished on day f is counted in end-of-day WIP on days s…f−1, i.e. f − s days. But its cycle time is computed as f − s + 1. Hence the identity: average WIP = TH × (CT − 1). With TH = 1,5 the line "12,1 ≈ 1,5 × 8,0" will systematically be off by 1,5 cards. The property test on 1000 seeds will fail, or its tolerance will have to be inflated so much that it stops catching errors.

**Fix.** "WIP of day d = the number of cards with `startedDay ≤ d ≤ finishedDay` (in progress for at least part of the day)". On the CFD, show "WIP at end of day" separately. In the test: |avgWIP − TH·avgCT| / avgWIP < 0,02 on windows where the system starts and ends empty, and < 0,1 on stable windows inside a run.

### 11. MAJOR — the QR code cannot hold the run log

**Where:** §6.11 ("30 days usually fit into 300–600 bytes, 60 days — up to 1,2 KB. This fits into a QR code (`qr.ts`, `byteCapacity`)").

**What is wrong.** The Sankofa `qr.ts` supports versions 1–10 at level M, which is up to 213 bytes. This is stated directly in the file header and confirmed in 08 §3.9. Besides, base64url inflates the data by a third.

**Fix.** Pass only `{v, scenario, seed, day, policies, decisions[]}` via QR: dilemma answers and changes to limits and policies, without card moves. Plus deflate, target ≤ 200 bytes. On a phone the run opens in "review and read" mode: card moves are reconstructed by the reference `pullOrder` policy, and this is honestly stated in one line. The full log is transferred via the export from 09 §3.3 or via sync (09 §3.4). Keep the bit layout from §6.11 for export.

### 12. MAJOR — progress storage contradicts 09

**Where:** §6.11 ("Progress is saved in `localStorage` … a 'download progress' button").

**What is wrong.** Per 09 §3.1 the source of truth is the `LearnEvent` journal in IndexedDB, snapshots live in `snapshots`, and `localStorage` is reserved only for minor UI details. An S8 exam run in `localStorage` will not get into sync or export.

**Fix.** "The run's decision log is written to IndexedDB as `LearnEvent` events of new types `sim.action` and `sim.result` (`ref: methodology/S2`, `data: {seed, k, args}`). The day snapshot goes to `snapshots`. Export and sync are shared (09, §3.3–3.4)." The new types need to be proposed to the author of 09.

### 13. MAJOR — a second condition language instead of the predicates from 09

**Where:** §6.10, §11 (`goal.check`, `pass`).

**What is wrong.** 09 §2.3 defines a single predicate language; it has two implementations (TS and Go) and shared test vectors. 07 has its own recursive-descent parser with function calls (`band('test').growth(3)`). For internal engine events this is acceptable. But pass conditions are checks, and they must produce a `CheckResult` and go into the shared journal. The 09 grammar has no arithmetic between paths, so the expression "round 2 p85 is 25% lower than round 1 p85" cannot be written in it directly.

**Fix.** `flowlab` exposes a fact projection `facts.flow` in which all derived values are already computed:

```ts
flow?: {
  scenario: string; day: number; seed: number;
  rounds?: { id: number; p85: number; p85RatioToR1?: number }[];
  counts: Record<WorkType, Record<Stage, number>>;
  dora: { deployFreq7d: number; leadTimeMedianDays: number; cfr: number; recoveryMedianMin: number; reworkRate: number };
  budget?: { leftMin: number; leftRatio: number };
  people: { id: string; toilShare10d: number; overtimeDays: number }[];
  answers: Record<string, { pass: boolean }>;   // review questions (cfd-click, etc.)
}
```

Rewrite the pass conditions as 09 goals:

```yaml
goals:
  - id: s1-wip-helps
    needs: [flow]
    when: "flow.rounds[id=2].p85RatioToR1<=0.75 && flow.answers.q-S1-p85.pass=true"
    envs: [sim]
    fail:
      - if: "flow.rounds[id=2].p85RatioToR1>0.75"
        say: { ru: "Время цикла во втором раунде сократилось меньше чем на четверть. Посмотрите, в какой колонке лимит выше числа людей на этапе.", en: "..." }
        term: wip-limit
```

(The `ru` string is the Russian UI text: "Cycle time in the second round dropped by less than a quarter. Look at which column has a limit higher than the number of people at that stage.")

Keep the §6.10 language only for `events.when` and `observations.when` and call it `flowexpr`, so that it does not look like yet another checking mechanism.

### 14. MAJOR — the S8 exam does not follow the format of 10 and 01

**Where:** §9.1, §7 S8.

**What is wrong.** Per 10 §6.1 a block exam looks like this: 3–5 practical tasks (70%) + 2 `explain` questions (30%), critical checks `critical: true`, pass = all critical + ≥ 70%; the built-in AI is turned off, and the mode with or without an assistant is recorded in the protocol. 07 has its own scheme, "5 of 6 dimensions, understanding mandatory", and it allows the AI to check "Understanding". 09 §4.7 also requires turning off the engine AI in self-check exams.

**Fix: mapping of the 9.1 dimensions to the format of 10.**

| 9.1 dimension | Format of 10 | critical |
|---|---|---|
| Flow | practice, 14% | — |
| Delivery | practice, 14% | — |
| Stability during the sale (< 30 min in bad-minutes, finding 5) | practice, 14% | **yes** |
| Money (≥ baseline by 10%) | practice, 14% | **yes** |
| People | practice, 14% | — |
| Understanding (review of three decisions) | explain 1, 15% | — |
| 9.2 "live data": bottleneck + three proposals | explain 2, 15% | — |

The AI is turned off in S8. If the learner chose "with an assistant", the explanations are graded by their AI using rubric 9.3, and this is recorded in the protocol. Without an assistant — self-assessment marked "self-assessment" (10 §6.1). A retake is a new seed after 24 hours.

### 15. MAJOR — the entry check is not in the 01 format and duplicates 01 §4.3

**Where:** §2.2–2.4.

**What is wrong.** 01 §4.3 already has its own methodology tasks L1 (6, the 6th is the key one) and L2 (5 tasks, "4 DORA metrics out of 8"). 07 has a different set: P-I1…6 and P-E1…6. There are no confidence marks, no `key: true`, no 3–5 parameterised variants for a retake after 72 hours, no 80% threshold. The "four DORA metrics" in 01 are outdated (see finding 16).

**Fix.** Declare the 07 set canonical. In 01 §4.3 leave a reference "tasks — 07 §2". Format each task per 01 §4.2: `kind`, `key`, `concepts` (IDs from 01), `variants`, `time_norm_s`. Key tasks: P-I1 (Little), P-I6 (budget), P-E2 (DORA from a log), P-E6 (simulator). Parameterisation: P-I1 — WIP ∈ {8, 12, 15, 18}, TH ∈ {2, 3}; P-I6 — SLO ∈ {99,5; 99,9; 99,95}, 2–3 failures of 5–25 min; P-E2 — the log is generated by `flowlab` from a seed. The intermediate tier skips the MT0/MT1 tasks, but the check has none of them. Add one: ordering the lifecycle (01 L1-1).

### 16. MAJOR — DORA: lead time is measured from the merge but should be from the commit; the product has three different metric counts

**Where:** §6.2 (`mergedDay`), §6.5 ("`deployedDay − mergedDay`"), compared with 01 §4.3 L2-1, 06 §1.2 screen 3, 10 §8.1 M-4.

**What is wrong.** On dora.dev change lead time is the time from the commit to version control until it runs in production. There are five metrics: throughput — change lead time, deployment frequency, failed deployment recovery time; instability — change fail rate, deployment rework rate. In 07 the grouping is correct, but the starting point is different, even though "per dora.dev" is claimed. In 01 there are four metrics, with "uptime" listed among the distractors. In my 06 there are four, and rework rate is mentioned as "since 2024" and optional. In 10 — "since 2025".

**Fix.** Add `committedDay` to `Card`: the first day development is finished, i.e. the change has landed in the repository. Metric = `deployedDay − committedDay`, and keep `mergedDay` for flow efficiency. Wording in all documents: "five DORA metrics (dora.dev/guides/dora-metrics); deployment rework rate was added in 2024, and in Quick Check since April 2026". I will fix my 06 §1.2. In 01 L2-1 the task becomes "5 out of 10".

### 17. MAJOR — block A0 of my 06 duplicates MT7/MT8, and the terms diverge

**Where:** MT7/MT8 and §13 versus 06 §1 "A0. Methodology: CI, Continuous Delivery, Continuous Deployment".

**What is wrong.** These are two modules at step 01 about the same thing, with different screens, a different number of DORA metrics and different Russian terms: 07 writes «непрерывная доставка», 06 — «непрерывная поставка» (two Russian renderings of "continuous delivery").

**Fix.** The owner of the topic is 07. A0 from 06 is abolished, and its useful parts move to MT7. The "One line" screen with `when: manual` was shown as a picture in A0; in MT7 it becomes the last screen of X1. Add the A0 quiz (6 situations: "a pipeline once a week on the release branch — not CI", "a branch three weeks old with tests on every push — not CI") to the MT7 bank. The sentence "CDP — there is no generally accepted abbreviation, name the practices in full" goes into the MT7 chapter. Single term: «непрерывная доставка (Continuous Delivery)»; in `concepts.yaml` M15, give «поставка» as a synonym word form. I will fix 06 on my side.

### 18. MAJOR — Kanban lacks the Service Level Expectation, Scrum is described imprecisely

**Where:** §3 (No. 26, No. 27), S1 round 3, MT5.

**What is wrong.**
- Per Kanban Guide v2025.5 the Definition of Workflow must include a Service Level Expectation: a time limit plus a probability, based on cycle time history. In S1 the learner effectively sets an SLE ("promise with 85% confidence"), but the term is never introduced. The reference "The Kanban Guide (2025)" in §14 is correct, but the section's content is outdated.
- Scrum Guide 2020 does not say "roles" but accountabilities: Product Owner, Scrum Master, Developers. The three commitments are not mentioned: Product Goal, Sprint Goal, Definition of Done.

**Fix.** In §3 after No. 16 add a line: "MT2 | service level expectation (Service Level Expectation, SLE) | '85% of cards finish in N days or faster'; set from cycle time history". In No. 26 replace "roles" with "accountabilities" and add "artifact commitments: product goal, sprint goal, definition of done". In No. 27 list the three Kanban Guide practices and the four mandatory metrics.

### 19. MAJOR — P-I6 misrepresents the error budget policy

**Where:** §2.3, P-I6; §9.4 M9 ("Budget exhausted… only reliability and security fixes").

**What is wrong.** In the Workbook's Example Error Budget Policy the freeze happens when the budget for the previous 4 weeks has been **exceeded**, and the exceptions are P0 and security fixes. There is no "almost exhausted" threshold there. In P-I6 3,2 minutes remain, the budget is not exceeded, and the "correct" answer is "we postpone". That is an opinion, not the policy.

**Fix.** Option A: "there have already been three failures of 20 minutes each" → exceeded by 16,8 min → freeze, except for P0 and security fixes. Option B: keep two failures and ask: "What does the policy say? And what would you say?" Correct: "the policy allows it (the budget is not exceeded), but the remaining 3,2 min is a risk; it is reasonable to deploy in parts behind a flag". Change item M9 to "only P0 and security fixes". The 20%-by-one-incident threshold will be useful in the documentation ladder, at step 4 (finding 3).

### 20. MINOR — burn rate thresholds

**Where:** E6 ("slow and fast alert (14,4 over an hour, 6 over 6 hours)"), `O-budget-burn` ("> 6 per day").

**What is wrong.** In the Workbook both thresholds, 14,4 (1 h window, 5 min short window) and 6 (6 h window, 30 min short window), page the on-call engineer. The "slow" alert is a ticket at a rate of 1 over 3 days (6 h short window). There is no "6 per day" in the Workbook.

**Fix.** E6: "page — 14,4 over 1 h and 6 over 6 h; ticket — 1 over 3 days". `O-budget-burn`: `burn(6) > 6 || burn(1) > 14.4`.

### 21. MINOR — S0: the promised numbers are impossible

**Where:** S0 ("the first card reaches the customer on day 5 instead of day 2").

**What is wrong.** Card size is not specified. With a capacity of 3 and the first card done by day 2 under focus, a card weighs 4–6 points. Six cards in parallel get 3 × 0,4 / 6 = 0,2 points per day per card, and the first one is done only on day 20–30. Even without switching losses (0,5 per day) it comes to day 8 or later, but not day 5.

**Fix.** "Cards of 4 points. One at a time: the first is done on day 2, all six on day 8. All at once: because of switching, Anya does 1,2 points a day instead of 3, and the first card is done only on day 20." Limit S0 to eight days. The learner will see that in 8 days "all at once" did not produce a single finished card. This is stronger than "5 instead of 2".

### 22. MINOR — the observation text does not match the diagnosis formula

**Where:** §7 S5, `O-big-batch` ("11 changes, diagnosis took 3,5 hours") versus §6.4: 30 × (1 + 0,25 × 10) = 105 min.

**Fix.** "…diagnosis took 1 h 45 min", or substitute the number from the formula with the `{{diagnoseMin}}` template. Observation texts with numbers must always take the numbers from the state.

### 23. MINOR — the reference bot is not described

**Where:** §6.12 ("as an experienced coach would do it").

**Fix: rules of the reference policy.** WIP limit at a stage = number of people at the stage + 1. Pulling by CD3. If the queue before a stage is ≥ 2 × the limit, free people swarm on it. Internal projects are taken when the payback point, computed from the cost of delay, comes before the end of the scenario. Deployment: the most frequent of the available `deploy.mode` values. In dilemmas — the option marked `reference: true` in the YAML. Without these rules, counterfactuals "against the reference" are not reproducible, and different scenario authors will have different "references".

### 24. MINOR — the pet project "DORA of your own pipeline": a recipe is needed

**Where:** §13 ("uploading a CSV from the GitHub/GitLab deployment log").

**Fix** (from my area; the CSV format is in §9.2):

```bash
# GitLab: deployments to production and the commits that went into them
glab api "projects/:id/deployments?environment=production&per_page=100" \
  | jq -r '.[] | [ "D-\(.id)", .deployable.commit.created_at, .finished_at,
                   (.status=="failed"), "", false ] | @csv' > deploys.csv
# GitHub: gh api repos/:owner/:repo/deployments + .../deployments/{id}/statuses
```

The learner sets the `unplanned` field themselves based on `hotfix` labels, and `restored_at` based on incident closure. In the theory, state that the built-in GitLab DORA dashboards are not available on all tiers, so we compute the metrics ourselves with the same code as in 9.2.

### 25. MINOR — colour that carries meaning (R5)

**Where:** §5.3 ("type (colour and pattern)"). 08 §5.2 has no tokens for methodology.

**Fix** (propose to the author of 08, check contrast with their test):

| Token | Meaning | Light | Shape duplicate |
|---|---|---|---|
| `--c-work-feature` | Feature / business project | `#0F766E` | solid fill |
| `--c-work-internal` | Internal project | `#5B21B6` | diagonal hatching |
| `--c-work-change` | Change | `#8A5A00` | dots |
| `--c-work-unplanned` | Unplanned work | `#9D174D` | cross-hatching + ! icon |
| `--c-flow-wait` | Waiting on the time strip | grey `#94A3B8`, hatching | hatching |
| `--c-flow-active` | Work | `--c-flow` | solid |

Do not use the red `--c-err` for "unplanned work": it is a type of work, not an error state. E9, the board, the CFD and X1 use only these tokens.

### 26. MINOR — sources

**Where:** §14.
- Featureban: the link to esicenter.bg leads to someone else's online adaptation. No licence is stated there, and the structure is described as "six rounds of five simulation days". The CC BY-SA 4.0 licence and the three-iteration scheme must be confirmed by the primary source: the materials of Mike Burrows / Agendashift. Until then the card stays in `hold`, by your own two-source rule.
- Kanban Guide: state the version v2025.5 (1 May 2025), the CC BY-SA 4.0 licence and the link to the PDF `kanbanguides.org/the-kanban-guide/2025.5/pdf/kanban-guide.v2025.5.en.pdf`. A Russian translation exists only for the 2020.12 edition. Say this directly, and in the RU text give the terms according to 2025.5.
- The Sankofa paths (`features/engine/decay.ts` → `lyingProgress`, `qr.ts`, `ink.ts` → `rng`) exist in the `sankofa-angel*`/`sankofa-int` working copies, but not in the current checkout `~/projects/sankofa`. A branch or commit must be specified, otherwise the links will break.
- The links dora.dev/insights/quickcheck-updates (22.04.2026) and cd.foundation (16.10.2025) have been checked, they are live.

### 27. MINOR — tier routes and time budget

**Where:** §2.1.
- Time: in 07 12–14 / 7–8 / 4 h, in 01 §13 12 / 8 / 5 h. This needs to be reconciled (I propose adopting 01 and cutting S3 down to one half of B for the intermediate tier).
- Per 01 §3 the beginner tier goes through "Orientation" F01–F12 before methodology. 07 does not mention this, yet the MT0 texts rely on "website", "server", "program". Add to §2.1: "for the beginner tier `requires: [F01…F12]`; MT0 does not redefine 'version', 'release', 'production'".
- The experienced learner, per 01 §3, starts every concept "with a task first". For MT7–MT12, the experienced learner's chapter comes after the scenario, and X1–X3 are shown in "mechanism only" mode (08 §4).

---

## What to keep unchanged

Determinism by seed with independent random streams. Counterfactuals and their review. Events and dilemmas as data. Predictions before key moments. Rubric 9.3. Generation of individual data for 9.2. The thresholds 14,4 and 6, the numbers in E6 and P-E4 — they have been checked and are correct (43,2 min; 4,32 min; 26 s; 14,4 = 2% × 720 h). The 50% rule for operational work in D10.
