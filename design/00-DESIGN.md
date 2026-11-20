# 00. DevOps Trainer — consolidated design

This document brings the ten design documents of the course (`01`–`10`) together into one picture and settles the disputed points between them. Its purpose is twofold. The owner should be able to understand in a single reading what product will come out, what it rests on and what it will cost. An engineer or content author should be able to use it to find where each detail lives and whose decision on it is final. Details are not repeated here: each section links to sections of the block documents, and the document linked to remains the source of truth on its topic. If a block document contradicts this one, this one prevails, and the discrepancy is to be corrected (section 10).

The course is based on the structure of the "Checklist for a beginner DevOps engineer" (`source/checklist.txt`, 11 steps from methodology to applying for jobs). Only the order of topics and the list of areas are taken from the checklist; the author's texts, stories and materials are not carried over into the course. The documents were designed on 18 November 2026, and tool versions and prices were checked as of that date.

| Document | Topic | What it owns |
|---|---|---|
| `01-andragogy.md` | Andragogy and instructional design | Concept graph `concepts.yaml`, levels, tiers `core/plus/pro`, lesson anatomy, load rules CL1–CL21, ladders S0–S5, H0–H5, DL1–DL5, time budget, mentor behavior |
| `02-linux.md` | Linux block | Modules M0–M17, `lab-debian` image, the Stand, isolation and limits (R6) |
| `03-networks.md` | "Networks" block | Modules `net.m00`–`net.m16`, `netlab`, `lab-net`, protocol catalog, troubleshooting scenarios |
| `04-containers.md` | "Containers and Docker" block | Modules m01–m14, dsim, course registry, `box`, six boundaries, `lab-alpine` |
| `05-kubernetes.md` | Kubernetes block | Modules KM00–KM16 and KN1–KN8, kube-lite, hybrid, three stages |
| `06-iac-cicd-monitoring.md` | Git, CI/CD, Ansible, Terraform, cluster from code, monitoring | Blocks G, A, B1, B2, B3, C; runner simulators, ansim, tfsim, PromQL |
| `07-methodology-kanban.md` | "Methodology" block | Modules MT0–MT12, flow simulator `flowlab`, scenarios S0–S8 |
| `08-multimedia-engine.md` | Interactive textbook engine | Primitives, `ProcessModel`, visual language, color and typography, flagship acceptance |
| `09-runtime-ai-architecture.md` | Platform | Tiers A/B/C, `Machine`, v86, `dt-switch`, hybrid, check contract, storage, our own neural network, real VMs, stack, work plan |
| `10-assessment-career.md` | Assessment and career | Task bank, quizzes, exams, "On-call shift", final exam, career block, pet projects |

---

## 1. Idea and principles

### 1.1. What the product is

DevOps Trainer is an interactive textbook for adults who are changing careers and want to become junior DevOps engineers. A typical learner studies in the evenings, 6–12 hours a week, and comes from sales, technical support, testing or development. The course leads them through the eleven steps of the checklist from "why a business needs DevOps" to the first job application, and does it so that the result is a person who understands the mechanism rather than remembering commands. The whole course runs in the browser: real Linux boots in an emulator right in the tab, several machines are connected by our own switch, and Kubernetes is assembled from a control plane model and real nodes. Real cloud machines appear where they cannot be avoided, and always with a cost meter and mandatory cleanup.

### 1.2. Three pillars and practice on top of them

The course rests on three pillars, and their order of importance is set by the owner (R1, `01` §1.1).

**Textbook.** Coherent theory with a strict order in which entities are introduced. Each module is a continuous chapter of 1,500–4,000 words that can be read straight through, like a magazine article; lessons are cut from that same chapter rather than written separately (`01` §7.1). The order of concepts is checked by machine: a single graph `content/concepts.yaml` of about three hundred concepts and six hundred terms, and the build fails if a term appears on screen, in sandbox output, in a hint or in a mentor answer earlier than the screen where it is introduced (`01` §6.1). Flags and subcommands are not covered by this rule: they can be looked up in the documentation without waiting for the lesson.

**Process explanations.** Everything that happens over time — a machine booting, `fork` and `exec`, the TLS handshake, a packet's path through NAT, `docker build` layer by layer, `kubectl apply` through all components, scrape → alert — is shown as a step-by-step diagram that the learner drives. Explanations exist in every block, not only in the flagships: the mandatory catalog in `01` §9.2 has 32 entries, and together with the block-specific ones there are about 85.

**Documentation.** The habit of reading `man`, `--help`, `kubectl explain` and official documentation grows over five rungs, from "this comes from here" to an exam where only official documentation is open (section 1.5).

**Practice** — breakage trainers, labs, exams — checks and reinforces these three pillars but does not replace them. The rule for authors: a task that cannot be solved by relying on the chapter, a process explanation or the documentation is a design error. Every task in the bank has links `refs: { chapter, process, docs }`, and the review after an attempt shows exactly those.

### 1.3. Not a game

The course has no points, badges, day streaks, leaderboards, lives, characters or storyline. Progress looks like a skills map worded as in job postings ("can find the process that is loading the server", "can explain how a container differs from a VM") and like passed checks. The methodology simulator is a model of production, not a game: people on the board are labeled by role, and requests arrive as internal memos. This decision is the same for all documents (`01` §14.2, `04` §1, `07` §0, `08` §1).

### 1.4. Levels

A level is a property of the "learner × block" pair, not of the learner: a programmer can be "Experienced" in Linux and a "Beginner" in monitoring at the same time. There are three levels: "Beginner" (`beginner`), "Intermediate" (`intermediate`), "Experienced" (`experienced`). The learner chooses the level before each block, and a short "Show what you already know" check confirms the choice; the level is never lowered silently (`01` §4). The level changes the entry point, the amount of support and the starting documentation rung, but changes neither the core content nor the qualifying exam: an "Experienced" programmer takes the same Linux exam as a former salesperson, they simply reach it after about 25 hours instead of 75 (`01` §3).

Content is marked with tiers: `core` (the core, the same for everyone; everything the following blocks rely on lives here), `plus` (an extension, on by default for "Intermediate" and "Experienced", available to "Beginner" via a button) and `pro` (deeper material for "Experienced"). A core concept cannot require an extension or deep-dive concept, and the linter checks this.

### 1.5. The documentation ladder

A beginner cannot be sent to the documentation from the first lesson: a manual page in an unfamiliar language of concepts only adds load, and the person decides that "this is not for them". But by the exam the course must make them go there. So documentation appears over five rungs (`01` §11):

| Rung | What the learner sees | What the mentor does |
|---|---|---|
| DL1 "glimpse" | Next to each command, flag and diagram element there is a "this comes from here" label pointing to the exact place: `tail(1) → OPTIONS → -n`, `kubernetes.io → Pod lifecycle`. Opening it is optional | Explains in its own words |
| DL2 "anatomy" | A hint is not our text but a fragment of the real page with the line highlighted and a mini-map NAME, SYNOPSIS, OPTIONS, EXAMPLES; once per module there is a page anatomy task | Gives the hint as a page fragment |
| DL3 "find the flag" | "Find the option that does X"; only a link to the page is given; the result is checked | Names only the section of the page |
| DL4 "enforcement" | The task requires a command or flag that was not in the theory; there are no content hints | `docs` mode: "where have you already looked?", then source type, section, search word; never names the flag, and the engine intercepts leaks via `solution_tokens` |
| DL5 "exam" | Only the built-in viewer of official documentation from the block's allowlist is open, as on the CKA; 10–25% of the weight is tasks on things the course did not cover | Off |

The rung is stored per documentation source (`man`, `--help`, `kubectl explain`, kubernetes.io, docs.docker.com, etc.), not per concept. Start: "Beginner" — DL1, "Intermediate" — DL2, "Experienced" — DL3. Within a block, the rung rises with the module's position (first third, second third, last third), so enforcement arrives for everyone; a strong learner rises earlier based on results; the rung never goes down; in a new block the learner starts no lower than one rung below the one reached (`01` §11.3). The documentation corpus is offline and versioned: `man` and `--help` pages come from the same packages installed in the lab machines, `kubectl explain` is built from the OpenAPI of the Kubernetes version the course models, and web documentation is mirrored as a dated snapshot (`09` §2.6).

### 1.6. Explanation style

A process explanation is not a video or a cartoon but a drawing that the learner drives (`01` §9.1, `08` §3, §6). The contract is the same for all blocks and is checked by the build:

- a diagram of boxes and arrows, labels sit on the lines themselves, one scene — one idea;
- motion only where something actually moves: a packet travels along a line, a layer appears, a counter grows; a step transition takes 180–320 ms, autoplay lasts no longer than 5 seconds;
- steps can be rewound forward and backward and paused, and each has a static frame;
- every element is clickable and explains itself: what it is, who creates it, which command shows it, where it is documented;
- sliders and toggles (replicas, memory limit, TTL, TCP window, `maxSurge`) recompute the process immediately, and next to the changed spot a single sentence appears: "what changed and why";
- "break it" removes or damages one component, and the process runs up to the break point and stops with a caption;
- before the first parameter change and before each "break it" there is a "what will happen?" question; the answer is recorded and compared with the result.

Technically an explanation is a pure function `ProcessModel.run(params, broken) → steps` with `explainDelta` (`08` §3.1); where behavior is more complex than arithmetic, the model runs the scenario in a copy of the simulator with the `whatif` operation on virtual clocks (`09` §1.11). The real kernel in v86 serves as confirmation after the explanation, not as the engine behind the sliders: it cannot be rewound.

### 1.7. Beauty

Text presentation is taken from Sankofa: a magazine column of 62–70 characters, Literata at 18–19 px with 1.55 line height, hanging punctuation, «guillemets» in Russian and “curly quotes” in English, diagram captions in the right margin, scroll scenes, calm mode, lenses, QR handoff to the phone, bilingual YAML, `draft` and `hold`. Graphics are a clean engineering drawing in the spirit of Bartosz Ciechanowski and Josh Comeau, not Sankofa's ink drawings: 1.5 px line, 6 px corner radius, 8 px grid, no shadows, gradients or parallax (`08` §6).

Color carries meaning and is the same throughout the course. The kernel is an indigo band at the bottom of every diagram about Linux and containers, user space is warm paper above it, namespaces are plum frames with different stroke styles, cgroup limits are graphite gauges, network layers are a single blue lightness scale from L2 to L7, the control plane is a teal hexagon, a node is a stone-colored rack, an API object is an ochre document. Green, amber and red are reserved for state and are always duplicated by an icon. Values are specified in OKLCH, and token distinguishability (ΔE2000 ≥ 15) and contrast are checked by a CI test (`08` §6.3). Fonts: Literata for text, Inter for the interface and diagram labels, IBM Plex Mono for code, values and the terminal (`08` §6.4). The terminal has its own xterm theme on the same tokens, without neon green on black (`08` §6.5, `09` §6.5).

---

## 2. Course route

### 2.1. Block order

The route follows the checklist and departs from it in three places, each justified in `01` §5. Git and YAML are introduced right after Linux, because Dockerfiles, compose files and manifests live in a repository. CI/CD practice is moved into a separate block after containers: a job runs in an image, and without containers that is magic. The third Kubernetes stage (kubeadm on several VMs) comes after IaC, because the VMs are ordered by Terraform and the nodes are prepared by Ansible.

| # | Block or segment | Modules (block identifiers) | Checklist step | What opens alongside |
|---|---|---|---|---|
| 0 | Onboarding, 10 minutes | three commands in the sandbox terminal with full support | — | The first successful action before any theory |
| F | Orientation ("Beginner" only) | 12 concepts `orient.*`: computer, program, file, OS, network, server, client and request, source code and build, version, environments, configuration, collaborative work on code | — | Interleaved with methodology and "five-minute terminal breaks"; "Intermediate" and "Experienced" close it with three questions |
| 1 | Methodology | MT0–MT12, `flowlab` scenarios S0–S8 (`07`) | 01 | Career: answer structure, "I don't know", reading a job posting |
| 2 | Linux | M0–M15, then M16 "Networking from the machine's point of view and SSH" and M17 "Your own machine in the cloud" (`02` §5.1) | 02 | First cloud VM (`linux.vps`) and the optional exam `linux.exam.cloud` |
| 2a | Git and YAML | G-local (repository, commit, index, branches, merge, `.gitignore`) and Y1 with YAML traps (`06` §2, §2.7) | — | Needed by the containers block |
| 3 | Networks | `net.m00` internet map → `net.m01`–`m05` layers by hand → `net.m06` OSI and TCP/IP envelopes → `m07`–`m14` DNS, DHCP, NAT, netfilter, HTTP, TLS and SSH, proxies, VPN → `m15` networks inside one kernel → `m16` troubleshooting; protocol catalog (`03` §3.2, §13) | 03 | Pet project 4 (VPN on a VPS) |
| 4 | Containers | m01–m14, including the "container by hand" lab (m04), six boundaries (m08), node runtime (m12) and real Docker on a VM (m13) (`04` §4.2) | 04 | Resume draft |
| 5 | CI/CD | G-remote (remote repository, merge request, tags, rebase, revert), A1–A6, A5b (deployment and strategies), A6g (GitHub Actions) (`06` §3) | 01 (practice) | Pet projects 1–3; after the first one — self-presentation and a mock interview with a networking situational question |
| 6 | Kubernetes, stage 1 | KM00–KM03, the "Kubernetes networking" section KN1–KN8, KM05–KM13, KM16; hybrid and reconciliation loop (`05` §4.1) | 05 | Kubernetes situational questions after K33 |
| 7 | Kubernetes, stage 2 | KM14 — one real node (k3s on one VM or kind/minikube/k3d locally), Helm, Gateway and Ingress, an image from a real registry; A7 — deploying to the cluster from CI (`05` §11.3, `06` §3.7) | 05 | Pet project 7 |
| 8 | IaC | B1 Ansible, B2 Terraform, bridge E-REC "four reconciliation executors" (`06` §4, §5) | 06 | Pet project 5 |
| 9 | Kubernetes, stage 3 | Block B3 "Cluster from code": Terraform orders three VMs, Ansible prepares the nodes, kubeadm once by hand, then the same via a role; Cilium, storage, certificates, version upgrade, etcd snapshot and restore, break and fix a node; mandatory cleanup (`06` §6, Kubernetes content — `05` §11.4, KM15) | 05 + 06 | Pet project 7b |
| 10 | Monitoring | C1–C17: metrics, PromQL, Grafana, alerts, Alertmanager, logs, traces, SLO and burn rate, Kubernetes metrics (`06` §7) | 07 | Pet project 6 |
| 11 | Cross-block exam and wrap-up | "On-call shift" in the hybrid environment, then the final exam on three VMs (`10` §6.4–6.5) | 08 | Applications |
| 12 | Career | Runs in parallel from the first month in short sessions (`10` §9) | 09–11 | Mock interviews, resume, applications by the 60% rule |

Where the cross-cutting things live. **Git** — in segment 2a (local) and at the start of CI/CD (remote); the Git assessment is part of the CI/CD assessment. **YAML** — in segment 2a, together with the YAML 1.1 and 1.2 traps (`yes`, `on`, `0755`, `1.10`), because the first consumer is the compose files of the containers block; JSON and `jq` are introduced by Linux in M9. **Cloud VM** — the concept `linux.vps` in Linux module M17: ordering, SSH key, public IP, security group, cost and deletion; the "Cost" screens and the "Cleanup" step are introduced there and repeated in every lesson with paid resources (`01` §7.4). **Career modules** open by the graph, not after the technical blocks (`10` §9): reading a job posting and answer structure — after methodology, resume draft — after Docker, self-presentation — after the first pet project, mock interview — after the networking situational question and the first pet project, Kubernetes situational questions — after concept K33, applications — after the Kubernetes exam or upon a 60% match with three real job postings. **Pet projects** open as the required blocks are passed (`10` §10), not as a single block at the end.

### 2.2. Time by level

Hours are derived from the graph by the formula in `01` §15, not assigned: a norm of 1.2 hours per core concept for "Beginner" (0.8 for methodology, 0.5 for Orientation, 2.0 and 2.5 for the stages on real VMs), coefficients 0.6 and 0.3 for "Intermediate" and "Experienced", 0.3 hours per process explanation for all levels (the experienced learner does not skip them) and 15% for review. The block documents give their own estimates (methodology 14/8/5 hours, networks 50/32/15); they serve as input for recalculation, and the interface shows what the build generates from `concepts.yaml`. After the first 50 learners the norms are recalculated from the event log.

| Block | Beginner, h | Intermediate, h | Experienced, h |
|---|---|---|---|
| Orientation | 6 | — | — |
| Methodology | 21 | 13 | 8 |
| Linux, including isolation and your own VM | 73 | 47 | 27 |
| Git and YAML | 15 | 10 | 5 |
| Networks (core; `plus` and `pro` — about 12 more) | 52 | 34 | 20 |
| Containers | 47 | 30 | 18 |
| CI/CD | 19 | 13 | 8 |
| Kubernetes, stage 1 | 85 | 54 | 31 |
| Kubernetes, stage 2 | 14 | 12 | 10 |
| IaC | 29 | 19 | 11 |
| Kubernetes, stage 3 | 32 | 27 | 22 |
| Monitoring | 24 | 16 | 9 |
| Pet projects | 40 | 35 | 30 |
| Career, including 3–5 mock interviews | 25 | 22 | 18 |
| **Total** | **≈ 480** | **≈ 330** | **≈ 215** |

At 10 hours a week, a "Beginner" completes the course in 11–12 months, an "Intermediate" in 8, an "Experienced" in 5. This is stated on the first screen of the course. A real learner is mixed, and the product calculates their timeline from block levels, selected tiers and declared hours. The product never offers more than three hours of new material a day.

---

## 3. Levels

### 3.1. What a level means overall

| Level | Who this is | Support at the start of a concept | Documentation at the start of a block | Lesson order | Pace |
|---|---|---|---|---|---|
| Beginner | No experience in the topic; knows IT as a user | S0 — full worked example | DL1 | Hook → watch the process → try → explanation | 25–40 minutes per lesson |
| Intermediate | Has worked near the topic, ran commands from instructions, knows the words without a model | S1–S2 — example with gaps | DL2 | The same, shorter explanation, parameters open from the start | 20–30 minutes |
| Experienced | Uses the topic in an adjacent role, lacks operational depth | S3 — task with hints on request | DL3 | Challenge task → process explanation in "break it" mode → review | 15–25 minutes per module |

The level check is structured the same way in all blocks (`01` §4.1): 5–10 tasks, 15–35 minutes, at least half practical and at least two key practical tasks, the threshold is 80% and all key tasks, practice is checked by the system state by any route, a "guess" answer is not counted even if correct, "explain" tasks are not key and are checked by self-assessment against a rubric, and the neural network is off during the check. If the learner fails, they see what worked and choose themselves: the block one level lower, or the declared level with mandatory lessons on the "gaps". A retry after 72 hours with a different variant, then a per-module bypass via exit tickets.

### 3.2. Levels by block

Below is a condensed summary. Full checks are in `01` §4.3 (the template) and in the block documents, which supply variants to the bank (`content/bank/<block>/placement/`). An asterisk marks a key task.

| Block | Beginner | Intermediate | Experienced | Typical check tasks | Details |
|---|---|---|---|---|---|
| Methodology | Has not worked in an IT team | Has seen tickets, releases and boards, does not distinguish CI from CD | Has worked with a pipeline, took part in an incident review | I: click the bottleneck column on a board snapshot; *five moves of the mini-simulator with WIP limits. E: *median time from pickup to deployment from an event table; *ten moves with an incident on the sixth | `01` §4.3, `07` §2 |
| Linux | Graphical interface only | Has opened a terminal, installed packages from instructions | Writes scripts, does not know systemd, logs, /proc, the kernel | I: *last five lines of the log; *make a script executable and run it; *find and stop the load-generating process. E: *fix a service using `journalctl`; *script `top3.sh` with hidden tests; *a shell in a new pid namespace via `unshare` | `01` §4.3, `02` §2 |
| Git and YAML | Has not used Git | Committed through an IDE | Branches and merge requests, has edited a CI file | I: *branch, commit, merge; *resolve a conflict in `config.yaml`. E: *remove a leaked password and rotate the secret | `01` §4.3, `06` §2.1 |
| Networks | "Wi-Fi" and "IP" as everyday words | Has configured a router, pinged, does not know subnets and NAT | Fluent with HTTP and curl, weak in routing, NAT, TLS | I: *IP and gateway of an interface; *who is listening on port 8080 (via `sudo ss -ltnp`). E: *fix a route between networks; *open 443, close 8080 without losing SSH | `01` §4.3, `03` §4 |
| Containers | Has not run containers | Has run `docker run` from a README | Writes Dockerfiles, does not know the bundle, the runtime chain, PID 1 | I: *nginx on port 8081; *Dockerfile for a Python application. E: *a 256 MB limit and what happens when it is exceeded; *`docker stop` waits 10 s — find the boundary and fix it | `01` §4.3, `04` §13 |
| CI/CD | — (via Git) | Has seen green CI checkmarks | Has edited a CI file, has not built a pipeline through to deployment | I: a `test` job in the pipeline. E: *a pipeline from lint to deployment; *deploy to prod only from `main` and manually | `01` §4.3, `06` §3.2 |
| Kubernetes | Confident with Docker, has not seen a cluster | `kubectl apply` from instructions | Writes manifests and charts, aims for CKA level | I: *a Deployment of three replicas and a Service; *scale and roll back. E: *the site is not reachable from outside — a break in the chain entry → Service → selector → pod; *a pod in `Pending`; *assemble the `kubectl apply` path from blocks | `01` §4.3, `05` §2 |
| IaC | Has heard the name | Has run ready-made code | Has written small configurations, does not know state, roles, idempotency | I: *change a VM's size and read the `plan`; *add a task to a playbook. E: *make `shell: echo >>` idempotent; *detect and eliminate drift | `01` §4.3, `06` §4.2, §5.2 |
| Monitoring | Has not seen dashboards | Has looked at ready-made dashboards | Has written alerts or PromQL, has worked with Zabbix | I: *node CPU metric; *requests-per-second panel. E: *share of 5xx by service; *an alert "errors above 5% for 10 minutes" that does not fire on a spike | `01` §4.3, `06` §7.2 |
| Career | Has not had IT interviews | Non-technical IT interviews | Technical interviews as a developer or admin | Diagnostics without a threshold: a two-minute self-presentation, "what is DNS" following "what → why → how → when", best answer to an unfamiliar question | `01` §4.3, `10` §9.1 |

In Kubernetes, "Beginner" means "knows containers from our block": the block opens only after the containers assessment is passed, as the checklist requires. In the "Experienced" check of every block, one key task is `docfind`: they start at rung DL3 and must show that they find the flag themselves (`10` §3.5).

---

## 4. Blocks

Each block below has the same layout: what is in the textbook, which processes are explained, where practice happens, which trainers, quizzes and exam there are, what is special about the block on the documentation ladder, and where the sources are. Quizzes are structured the same way in all blocks (`10` §3–4): each module has at least eight multiple-choice tasks (two entry, four to five final, two for review in a different format), a module is closed at 80% on the first attempt and all key tasks, plus `scene` tasks on the module's explanations and a documentation rung task; the block quiz unlocks the exam.

### 4.1. Methodology and Kanban

**Textbook** (`07` §4). Thirteen chapters that work for a person without IT experience: MT0 "Why a business needs development and operations", MT1 "Work becomes visible", MT2 "Flow", MT3 "Bottleneck and variability", MT4 "Batches and cost of delay", MT5 Agile, Scrum and Kanban, MT6 "Types of work, toil, automation", MT7 "Deployment pipeline", MT8 DORA and Accelerate (the five metrics under their current dora.dev names), MT9 SRE: SLO and error budget, MT10 "Incidents and blameless reviews", MT11 "Culture and the full definition of DevOps", MT12 practical exam. CI, Continuous Delivery and Continuous Deployment, the pipeline as an idea, and DORA are introduced here; the CI/CD block only shows them in code. The owner of the order of the `method.*` group is `07` §3.

**Process explanations** (`07` §5):
- X0 "Two goals, one result" — the conflict between development and operations;
- X1 "A task from idea to prod" — card, code, review, CI, staging, prod, metrics; knobs for batch size and share of manual steps;
- X2 "A queue at a single worker" — how WIP stretches waiting time;
- X3 "Dice: dependent events" — why equal average capacities give lower output;
- X4 "Where the flow gets stuck" — a queue in front of the slow column, the next one sits idle;
- X5 "Batch size" — time to first value;
- X6 "One job, two boards" — sprint and flow on the same data;
- X7 "A team's month by type of work" — planned, unplanned, toil;
- X8 "Five instruments" — DORA metrics on live data;
- X9 "Nines and the budget" — SLO and minutes of downtime;
- X10 "From alert to review" — alert, on-call, status, mitigation, fix, postmortem;
- X11 "One night from the data" — an incident from a time series;
- X12 "The path of bad news" — how culture lets a signal through or suppresses it.

**Practice.** Tier A: the seed-deterministic flow simulator `flowlab` (an online tea shop, roles instead of characters, CFD, cycle time, throughput, DORA, error budget), scenarios S0–S8, counterfactual runs in the review ("if you had not taken two urgent features on day 4, p85 would have been 6 days instead of 11") (`07` §7–§10). It works on a phone too.

**Trainers and quizzes** — `07` §11.4–11.5: calculating lead time and medians, reading a CFD, "where is the bottleneck", classes of service. **Exam** — S8 "Black Friday" in `flowlab` plus calculating metrics on live data; "understanding" is checked by predicting counterfactuals, which `flowlab` replays (`10` §6.3).

**Documentation.** The block's sources are the Scrum Guide, the Kanban Guide, the SRE book and SRE Workbook, dora.dev, the Agile Manifesto: short and human, which is why methodology is the best place to build the habit before the terminal. Rungs DL1–DL3, rung 4 for "Experienced" from MT7; DL4 as enforcement on flags does not apply here (`07` §6). **Sources EN/RU** — `07` §16.

### 4.2. Linux

**Textbook** (`02` §5). Eighteen modules: M0 computer, OS, terminal; M1 the file tree and paths; M2 files and archives; M3 help and how to read documentation; M4 users and groups; M5 permissions, root and sudo; M6 streams, pipelines, text; M7 environment and PATH; M8 processes, signals and the kernel; M9 bash scripts and JSON with `jq`; M10 packages; M11 services and logs; M12 scheduling; M13 disks, filesystems, mounting, tmpfs and bind mount; M14 the kernel from inside: /proc, /sys, memory; **M15 "How the kernel isolates and limits"**; M16 networking from the machine's point of view and SSH; M17 your own machine in the cloud.

M15 is the foundation of the containers block and core for all levels (R6, `02` §5.4). Process and thread (PID and TID, `fork` and `exec`, `/proc/<pid>/task`, `ps -eLf`, `top -H`); all eight kinds of namespaces (`unshare`, `nsenter`, `lsns`, `/proc/<pid>/ns`, user namespace and `uid_map`); cgroups v2 (`/sys/fs/cgroup`, `memory.max`, `cpu.max`, `pids.max`, `memory.events`, the link to systemd's `MemoryMax=` and `TasksMax=`) with an OOM-kill exercise; capabilities (`capsh`, `getpcaps`, `getcap`, `setcap`); PID 1, orphans and zombies; `chroot` and the idea of `pivot_root`, why chroot is not isolation; overlayfs (lowerdir, upperdir, workdir, merged, copy-up, whiteout); seccomp at the level of the idea. The module ends with the "container by hand" lab without Docker: a process in its own pid, mnt, uts and net, in its own cgroup with a limit and with a root on overlayfs. Everything the containers block relies on is introduced here and is not introduced again there.

**Process explanations** (`02` §6.6):
- X1 "From power-on to the prompt" — firmware, bootloader, kernel, initramfs, systemd as PID 1, units, getty and sshd;
- X2 "What happens when you press Enter" — line parsing, PATH, `fork`, `exec`, system calls, `$?`;
- X3 "A pipeline: processes and the kernel buffer" — two processes, a buffer, blocking, SIGPIPE;
- X4 "systemd restarts a crashed service" — `Restart=`, `RestartSec`, `StartLimitBurst`, `start-limit-hit`;
- X5 "How the system decides whether it is allowed" — permissions, root, and in a second layer capabilities;
- X6 "A signal on its way to a process, and the special PID 1";
- X7 "What a process sees: namespaces";
- X8 "How much a process consumes: cgroups and the OOM killer";
- X9 "Layered filesystems: overlayfs" (the same widget is later used in containers);
- X10 "A file on disk: disk → partition → FS → mount point";
- X11 "SSH: the path to someone else's shell" on two machines.

Plus interactive diagrams: anatomy of a command, a live file tree, anatomy of a manual page, a breakdown of the `top` screen, "three views of one command" (`02` §6.1–6.5).

**Practice.** Tier A — the Stand, a shell simulator in TypeScript (86 commands, checked against real Debian in CI) for M0–M7 for "Beginner" and for phones. Tier B — v86 with the `dt-kernel` 6.12 LTS i686 kernel and the `lab-debian` root (Debian 12 i386 with systemd, 256 MB guest, two machines of 128 MB each in M16) for M8–M17 and all trainers with systemd, disks and isolation. The root is on 9p, `/srv` is ext4 on `hda` (ACL, file capabilities, `chattr`), `/lab` and `/run` are tmpfs (overlay, chroot), `hdb` is for partitioning (`02` §1.3). The transition A → B does not lose work. Tier C — a cloud VM in M17 and in the optional `linux.exam.cloud`.

**Trainers** (`02` §8.2): fluency (navigation, permissions, `ss`), reading output (`top`, `journalctl`, `man`), breakages on a machine snapshot — a service does not start, a disk is filled by a deleted open file, OOM in a cgroup (`linux.cgroups.drill.oom`: limit a growing `hog` to 20 MB without restarting and see `oom_kill 1`). **Quizzes** — `02` §8.1. **Exams** on tier B with rung 5: `linux.exam.service` "The service does not start", `linux.exam.disk` "The partition is full", `linux.exam.isolation` "Neighbors interfere with each other", `linux.exam.access` "Access for a new developer" on two machines, `linux.exam.cloud` optionally (`02` §8.3). The block's qualifying exam is assembled from them within the frame of `10` §6.1 (`exam-linux.yaml`); the rest remain practice tests.

**Documentation.** The block lays down the anatomy of a manual page (M3 — rung 2 from that very module). The image installs `man-db`, `manpages`, `manpages-dev` and removes the `path-exclude` exclusion from the slim image, so `man 7 namespaces`, `man 7 cgroups`, `man 2 clone` open in the machine itself. Rung examples: DL3 — "find the `ss` option that will show the process"; DL4 — `pstree -a`, `journalctl -p err --since`, `systemd-run --scope -p TasksMax=5`; DL5 — `logrotate.conf(5)`, `lsof +L1` (`01` §11.4, `02` §7). **Sources** — `02` §11.

### 4.3. Networks

**Textbook** (`03` §3.2, §5). Movement from the big picture to the packet (R8). The block opens with the zoomable internet map `net.m00`: a laptop, a home router, an ISP, a backbone, an internet exchange point, a submarine cable, a data center, autonomous systems and the idea of BGP, root DNS servers and anycast, CDN. Then the layers by hand from the frame upward: `m01` frame and MAC, `m02` IP and subnet, `m03` ARP, `m04` routing and ICMP, `m05` ports, UDP and TCP. Only then does `m06` assemble what has been touched into nested OSI and TCP/IP envelopes with real header fields — the model serves as a vocabulary ("a problem at L3", "an L7 load balancer"), not as dogma. Next come `m07` DNS, `m08` DHCP, `m09` NAT and conntrack, `m10` netfilter (iptables and nftables), `m11` HTTP, `m12` TLS, HTTPS and SSH as a protocol, `m13` proxies, load balancers and CDN, `m14` VPN and WireGuard, `m15` networks inside one kernel (netns, veth, bridge, routing without NAT, VXLAN, eBPF as an idea for the experienced) and `m16` troubleshooting with the whole URL path. One rule runs through the whole block: **every network problem is tied to a layer, and the first question is which layer broke**. It is built into the mechanics: every scenario has a `layer` field, the first step is to name the layer before the first command, and the mentor's first move in any networking task is the same question.

**Protocol catalog** (`03` §13): 24 cards in one format — why, layer, exchange diagram, how to observe, how it breaks (symptom → layer). Beginner: DHCP, ARP, ICMP, TCP, UDP, DNS, HTTP, HTTPS/TLS, SSH. Intermediate: NTP, SMTP, FTP/SFTP, HTTP/2, HTTP/3 and QUIC, WebSocket, gRPC, VLAN, NAT/PAT. Experienced: BGP, VXLAN and Geneve, IPsec, WireGuard, mTLS, the idea of OSPF. VLAN, BGP and OSPF are studied as understanding and observation, without configuring hardware; the platform guarantees where to observe them on real kernels (`09` §1.7).

**Process explanations** (`03` §7):
- E-MAP "How the internet is built" — a zoomable map and the path of one request;
- E-ENV "Envelopes" — a header is added at each layer, the fields are real, MTU;
- E-DNS "How a name turns into an address" — stub, recursive, root, TLD, authoritative, cache and TTL;
- E-ROUTE "A packet through a router and NAT" — the MAC changes at every hop, the IP only at NAT;
- E-TCPTLS "TCP and TLS handshakes" — RTT to the first byte, TLS 1.2 versus 1.3;
- E-WIN "TCP window and speed" — the bandwidth-delay product;
- E-DHCP "How a laptop gets an address";
- E-NF "A packet's path through netfilter" — hooks, tables, chains;
- E-504 "Where 504 and 502 come from" — the proxy's timer versus the backend;
- E-URL "What happens when you type a URL" — the backbone of the block, opened section by section after each module;
- E-NS "A packet between stacks of one kernel and between machines".

**Practice.** Tier A — `netlab`, a discrete-event simulator with modeled clocks and a seed: a 127-second timeout passes instantly, a breakage is reproducible, it works on a phone. Tier B — `lab-net`: 2–4 real v86 machines of 96 MB each on the `lab-alpine` root, connected by the `dt-switch` switch with real L2 (ARP, VLAN, ping, tcpdump, routing, iptables, NAT, WireGuard between nodes), with a "mini-internet" made of real daemons `nsd`, `unbound`, `nginx`, `chrony`, `bird2` (`03` §9, `09` §1.7). Tier C — part B of the exam on two VMs. One network model for the whole course: dsim and kube-lite do not model packets themselves but configure `netlab` via `NetlabApi`, so a learner who wrote DNAT themselves in the "Networks" block recognizes their own rules in a Kubernetes node's `iptables-save` (`03` §2, §8.6). The packet viewer shows captures with our own dissectors in TypeScript, without Wireshark: its GPL would extend to the client (`03` §11).

**Trainers** (`03` §10, §12): subnets, "walk the chains" of netfilter, "which layer?", "count the latency"; troubleshooting scenarios T1–T15 (504 after two minutes, 502 after a deploy, the application listens on 127.0.0.1, a stale A record due to TTL, a `search` domain, a certificate, MTU through a VPN, no masquerade, asymmetric routing, a second DHCP server, `rp_filter`, the overlay's UDP 4789 blocked). **Quizzes** — `03` §16. **Exam** (`03` §17): part A "A small company's network" in the simulator — qualifying for everyone; part B "On real machines" — WireGuard between two VMs, nginx as a reverse proxy with a certificate from the course CA, nftables, a breakage with 504 and mandatory cleanup; mandatory for "Intermediate" and "Experienced", recommended for "Beginner" after containers.

**Documentation** (`03` §14): offline man and nginx documentation inside the trainer; the simulator does not answer an unknown flag with a list of supported ones — that would cancel rung 4. Examples: DL3 — `curl -w` with `time_connect`, `dig +trace`; DL4 — `tracepath`, `ping -M do -s`, `tcpdump -nn port 53`, `curl --resolve`; DL5 — a limit on new SSH connections in nftables, `ip rule`. **Sources** — `03` §20.

### 4.4. Containers

**Textbook** (`04` §4). The block introduces only container entities; it takes the kernel and network mechanisms ready-made from Linux and networks (R6). Modules: m01 "Why containers" (the environment problem, VMs, a container as a combination of kernel mechanisms, today's nesting; "this Linux is itself a VM" — `dmesg` and SeaBIOS right inside v86); m02 "A container from familiar parts" (a callback to M15, measuring a container's start against a cold boot of a second v86 machine); m03 "Anatomy": OCI bundle (rootfs + `config.json`), the chain docker CLI → dockerd → containerd → shim → runc/crun → process, states; m04 "Container by hand" in bash (chroot → namespaces → cgroup → network → overlay and pivot_root → capabilities → crun); m05 first steps with Docker; m06 "How an image is built" (layers, digest, manifest, index, registry); m07 Dockerfile and build (cache, PID 1 and signals, multi-stage, secrets); **m08 "The six boundaries of a container"**; m09 Compose; m10 security (USER, read-only, limits, rootless and userns-remap, secrets in layers, scanning, seccomp profile); m11 Docker under the hood (containerd, snapshots, shim, `live-restore`, Docker's iptables and nftables rules); m12 the `box` node runtime and two machines; m13 real Docker on a VM; m14 interview.

The six boundaries (R7b, `04` §12): the host kernel; network (veth, the `docker0` bridge, NAT, `-p` as DNAT, built-in DNS, `host` and `none`); storage (the ephemeral overlay upper layer, volume, bind, tmpfs); process and signals (PID 1, SIGTERM → SIGKILL, zombies, tini); I/O and logs (stdout/stderr → log driver); configuration and identity (env, secrets, UID inside and outside, userns, permissions on bind mounts). The "the container does not work" drills give one symptom, and the cause sits on one boundary; the learner first marks the boundary on the diagram, then fixes it.

**Process explanations** (`04` §6):
- X1 `docker run -d -p 8080:80 --memory 64m nginx` — from the command to the process through the whole runtime chain;
- X2 `docker build` layer by layer with cache — which steps are rebuilt after an edit;
- X3 `docker pull` by manifest — tag, token, index, platform manifest, config, layers by digest;
- X4 hardware → VM → containers → nesting (flagship, section 5.6);
- X5 the six boundaries of a container;
- X6 `-p 8080:80` as DNAT;
- X7 `docker stop`: signals and PID 1;
- X8 container states;
- X9 a packet between containers on two machines — a bridge to Kubernetes networking.

Plus two flagship interactives: "A container from familiar parts" and "How an image is packaged" (section 5).

**Practice.** Tier A — dsim, our own Docker engine simulator in TypeScript: content-addressable storage with real sha256, a layer overlay with whiteouts, networks as `netlab` configuration, processes as Stand processes, full `--help` from a golden recording. The course registry following the OCI Distribution Spec lives in a Service Worker and is called `registry.lab` inside the lab machines. Tier B — `lab-alpine` (96 MB) for the m04 lab, interactive 1 and `box`. Tier C — m13, real Docker Engine on a VM. We do not run a real dockerd in v86: hundreds of megabytes of Go binaries and minutes to start (`04` §1, §11).

**Trainers** (`04` §14): docker.x01–x28 — from `hello-world` to "shrink a Go image to 30 MB", "`docker stop` waits 10 seconds", "remove a password from the image history", "nginx with minimal privileges", "enter a container's namespaces without `docker exec`"; drills on the six boundaries. **Quizzes** — `04` §16. **Exams** (`04` §17): practice exams e1 "An image for production", e2 "Fix the compose file", e3 "A container without Docker" (v86), e4 "On call"; the qualifying one is `exam-docker-shop` within the frame of `10` §6.2.

**Documentation** (`04` §5): dsim help is served in full, as with real Docker. DL3 — `--init`, `-q`; DL4 — `docker cp` from a stopped container, `docker inspect -f '{{.State.OOMKilled}}'`, `--read-only --tmpfs`; DL5 — `buildx --platform`, `docker system df -v`, `--cap-drop`. The experienced learner reads the OCI image-spec and runtime-spec from rung 3. **Sources** — `04` §24.

### 4.5. Kubernetes, including networking and the reconciliation loop

**Textbook** (`05` §4). Stage 1 in the browser: KM00 "Why orchestration" without a single Kubernetes term (the learner distributes containers across servers themselves and lives through a server failure, and then names what they did by hand: scheduler, controller, desired state); KM01 the first pod; KM02 labels and reconciliation; KM03 Deployment, scheduler, kubelet. Then a large separate section **"Kubernetes networking"** (R9) of eight modules in one piece: KN1 the network model (a pod has its own IP, no NAT between pods, the CNI fulfills the promise); KN2 pod-to-pod on one node (veth, bridge); KN3 pod-to-pod across nodes (routing, VXLAN, WireGuard, Cilium eBPF for the experienced) with a packet animation; KN4 Service (a ClusterIP is not attached to any interface, EndpointSlice, kube-proxy in iptables and nftables modes, Cilium eBPF for the experienced, IPVS in one sentence as deprecated since v1.35); KN5 cluster DNS (CoreDNS, `svc.cluster.local`, search domains, `ndots`); KN6 ingress from outside (NodePort, LoadBalancer, Gateway API as the main path, Ingress as legacy — Ingress NGINX was retired in March 2026); KN7 NetworkPolicy (everything is open by default, a policy works only if the CNI supports it); KN8 the "pod cannot reach" method: DNS → Service → EndpointSlice → pod → NetworkPolicy. Next come KM05 configuration and volumes, KM06 health and resources, KM07 workload types, KM08 storage, KM09 access and security, KM10 scheduling and maintenance, KM11 Helm and Kustomize, KM12 GitOps (Argo CD in the simulator, Flux in theory), KM13 API extension and operators, KM16 a fault-finding workshop. Stage 2 is KM14, stage 3 is KM15 in block B3 after IaC.

**Process explanations** (`05` §6):
- the "Kubernetes from blocks" builder (flagship, section 5.8);
- E1 the path of `kubectl apply` through authn, authz, admission, etcd, controllers, scheduler, kubelet, CRI and back as status;
- E2 the reconciliation loop (flagship, section 5.9);
- E3 how the scheduler picks a node — filters, scoring, binding;
- E4 rolling update — `maxSurge`, `maxUnavailable`, readiness holds traffic;
- E5 a node went down — Lease, a 50 s grace period, taint, eviction via `tolerationSeconds` 300 s, new pods;
- E6 a packet from pod to pod on one node and across nodes in three delivery modes;
- E7 a request through a Service and kube-proxy — from ClusterIP through KUBE-SERVICES to KUBE-SEP and DNAT;
- E8 from outside to a pod: where 502 and 504 come from;
- E9 the cost of `ndots` — how many queries go out for `api.example.com`;
- E10 NetworkPolicy as a "from × to" matrix;
- E11 requests and limits in cgroups;
- E12 how a PVC finds a volume;
- E13 a request's path through authn → authz → admission;
- E14 Helm: from values to a release;
- E15 GitOps: from `git push` to a pod.

**Practice.** Stage 1 — kube-lite (a store with etcd semantics, apiserver-lite with validation against OpenAPI v1.37, controllers as real loops, a scheduler with real filters and messages, `cni-lite`, `kube-proxy-lite`, `coredns-lite` on top of `netlab`, containers from dsim) and the hybrid, where the nodes are real v86 machines (section 6.5). The Helm template engine is the only part in Go compiled to wasm (2.5 MB gzip, lazy-loaded). Stage 2 — k3s on one VM or kind/minikube/k3d on the learner's own machine, checked by `trainer-check.sh`. Stage 3 — kubeadm on three VMs in block B3 (section 4.7). All three stages are mandatory for all levels; a beginner follows the full checklist with support at stage 3, an experienced learner starts from scratch.

**Trainers** (`05` §8): D01–D30 (from the first pod to an etcd snapshot, a static pod with a broken `--etcd-servers` and a CSR for a user) and the networking N-D1–N-D9, among them "find in iptables where a packet to a ClusterIP goes" (the learner walks `KUBE-SERVICES → KUBE-SVC → KUBE-SEP` with `--probability` and enters the pod's IP and port; an nftables variant for the extension tier), "pod cannot reach" with a random breakage at each KN8 step, hairpin without `br_netfilter`, "a node went dark" on three hybrid nodes with finding the process of the relocated pod via `ps -ef --forest`. **Quizzes** — `05` §9. **Exams** (`05` §10): the qualifying stage 1 exam for everyone is assembled from exams B and I; exam E modeled on the CKA (16 tasks in the simulator, 120 minutes, a 66% threshold, plus two tasks on real VMs) is an optional `pro` part.

**Documentation** (`05` §7): a mirror of kubernetes.io, helm.sh/docs and gateway-api.sigs.k8s.io for v1.37 inside the trainer (external pages cannot be embedded because of CSP), full `kubectl --help`, `kubectl explain` from OpenAPI. DL4 — nodeAffinity `NotIn` on `kubernetes.io/hostname`, `kubectl debug --profile`, `topologySpreadConstraints`; DL5 — an allowlist exactly as on the CKA, checked against the Linux Foundation page on every build. **Sources** — `05` §15.

### 4.6. CI/CD and Git

**Textbook** (`06` §2–3). Git comes in two parts. G-local in segment 2a: repository, commit and history (a hash as a name), index, HEAD and a branch as a movable pointer, merge and conflict, `.gitignore` and secrets outside the repository; for "Intermediate" and "Experienced" — Git objects. G-remote opens the CI/CD block: a remote repository and the non-fast-forward rejection, merge request and review, tags and semver, rebase, `reset` and `revert`, reflog for the experienced. Then CI/CD in practice: the runner and the job image, the pipeline file, a test and the exit code, artifact versus cache, variables and secrets, building and publishing an image, environments, deployment via SSH and compose, deployment strategies (recreate, rolling, blue-green, canary — introduced before Kubernetes, because a Deployment's rolling update relies on them), rules and events, `needs`, matrix and reuse, the same concepts in GitHub Actions; after Kubernetes stage 2 — A7 deploying to the cluster from CI in push and pull models.

**Process explanations** (`06` §0.6): E-GIT "what `git commit` and `git push` do" — file → blob → tree → commit → ref → forge; E-CI "from `git push` to a running version" — webhook, runner, stages, image, registry, deployment, health check; E-DEPLOY "how deployments are done" — four strategies with the share of traffic on the new version.

**Practice.** Tier A: Git — isomorphic-git on top of the Stand's filesystem plus our own `revert`, `cherry-pick`, `rebase`, `bisect` and reflog in Git's format; CI — a GitLab CI and GitHub Actions runner simulator with file validation by JSON Schema and actionlint in wasm; `docker build` inside a job — dsim; `npm ci`, `pip install`, `go build` — tool models whose errors are checked against the real tools (`06` §0.3). A real pipeline is in the pet projects.

**Trainers** — `06` §2.5, §3.6: a merge conflict, a leaked secret (passing requires rotating the secret, not just deleting it), a red pipeline, cache versus artifact, deployment only from `main` and manually. **Exams** — G-remote and A in the simulator (`06` §2.6, §3.8), moved onto the `10` §6.2 scheme. **Documentation** — docs.gitlab.com and `git help`: DL3 — `rules:changes`, DL4 — `parallel:matrix`, `include`, `git bisect run`. **Sources** — `06` §2.8, §3.9.

### 4.7. IaC: Ansible, Terraform and cluster from code

**Textbook** (`06` §4–6). Ansible comes first because it works with familiar Linux entities (package, file, unit): infrastructure as code, idempotency, inventory and SSH, module, task, play, playbook, FQCN and collections, facts, variables and Jinja2, handler, role, variable precedence, check mode and diff, vault. Terraform (and OpenTofu) introduces a new entity — a cloud resource: provider and HCL, `init`/`plan`/`apply`/`destroy`, state, in-place change versus replacement, the resource graph, variables and modules, drift, `count` and `for_each`, a bucket and remote state with locking, `import`/`moved`/`removed`, creating and configuring together, Terraform in CI. The E-REC bridge shows four reconciliation executors — Ansible, Terraform, a Kubernetes controller, Argo CD — and prepares for meeting the reconciliation loop again.

Block B3 is the third Kubernetes stage (R12): step 0 — choosing a provider and the cost; step 1 — nodes with a Terraform module labeled `trainer=devops`; step 2 — Ansible roles `k8s_prereq`, `containerd`, `kube_packages`; step 3 — `kubeadm init` and `join` once by hand following the `05` checklist; step 4 — the same with roles using `creates:`, then `tofu destroy` and bringing it up from scratch; step 5 — operations (storage, certificates, etcd snapshot and restore, upgrading v1.36 → v1.37 with a playbook using `serial: 1`, a broken and repaired node); step 6 — verification; step 7 — mandatory cleanup (`06` §6.2).

**Process explanations**: E-ANS "an idempotent Ansible run" — facts, comparing desired with actual, ok or changed, handler; E-TF "`plan` and `apply`: code, state, cloud" — refresh, diff, plan, new state, drift after a manual edit; E-REC "four reconciliation executors"; E-K8S-CODE "from `tofu apply` to three Ready nodes".

**Practice.** Tier A: ansim (an Ansible simulator in TypeScript, `ansible-doc` from `ansible-doc -j` of real ansible-core) and tfsim (Go → wasm on `hashicorp/hcl/v2`, the training provider Edu Cloud); tier B — `lab-ansible` (a 256 MB control node and two 96 MB hosts) for "Experienced"; tier C — B3 on three VMs. At the B3 stage the trainer executes nothing: it guides through the steps, shows the cost and checks the result (section 6.6).

**Trainers** — `06` §4.6, §5.6: `shell: echo >>` → an idempotent task, a handler only when the template changes, drift, `prevent_destroy`, a module with `for_each`. **Exams** — B1 and B2 in the simulator (`06` §4.7, §5.7), B3 is checked by the agent. **Documentation** — `ansible-doc`, `terraform -help`, developer.hashicorp.com, provider documentation; DL3 — `ansible-doc lineinfile` → `create`; DL4 — `prevent_destroy`, the `moved` block, `--check --diff`. **Sources** — `06` §4.8, §5.8.

### 4.8. Monitoring

**Textbook** (`06` §7). Observability, time series, cardinality, metric types, Prometheus as pull (`/metrics`, targets, `up`), exporters, instant and range vectors, `rate` and `increase`, aggregation, vector matching, histograms and `histogram_quantile`, Grafana, USE, RED and the golden signals, an alerting rule, the states inactive → pending → firing and `for`, Alertmanager (route, grouping, inhibition, silence), recording rules, logs, traces and OpenTelemetry, SLI, SLO and error budget as a PromQL query, burn rate, target discovery in Kubernetes via EndpointSlice, container metrics from cgroups, kube-state-metrics and ServiceMonitor, Zabbix for comparison. SLO as an idea came from methodology; here it becomes a query.

**Process explanations**: E-MON "from a counter in code to a message to the on-call engineer: scrape → store → PromQL → alert → notify" with knobs for `scrape_interval`, the `rate` window, `for:` and the threshold; E-OTEL "the path of a trace: SDK → OTLP → Collector → backends"; E-CG "where container metrics come from: cgroup → cAdvisor → PromQL".

**Practice.** Tier A: a metric generator with incident scenarios, a PromQL engine in TypeScript, `promtool` and `amtool` in the simulator; the `promql_equiv` query check compares the result series, not the text (`06` §7.6). Real Prometheus runs on the stage 3 cluster if it is still alive, otherwise on the stage 2 cluster, and in pet project 6. **Trainers** — `06` §7.8, incident scenario C13 "Why latency went up". **Exam** — `06` §7.9. **Documentation** — prometheus.io/docs and Alertmanager; DL3 — `predict_linear`, DL4 — `absent()`, `label_replace`, `inhibit_rules`. **Sources** — `06` §7.11.

### 4.9. Career

**Content** (`10` §9). The block runs in parallel with the technical ones from the first month and consists of trainers with checks, not advice: a "command → logic" translator with confirmation from the documentation; situational question drills in the sandbox with the criterion "named the layer"; a self-presentation trainer with timing; a resume builder with a linter; a job posting analyzer using the 60% rule; an application funnel as a flow board; a mock interviewer on the learner's own neural network with voice via the Web Speech API and rubric-based scoring, where a score without a quote from the transcript is reset. Everything the learner writes, they write themselves; the neural network only reviews what was written. Alongside, the product persistently offers a live mock interview: only a live interviewer removes the fear of interviews.

**Process explanations** (`10` §5.2): C-1 "How the trainer checks your solution" (a single explanation shared with platform P4); C-2 "A situational question: from symptom to cause"; C-3 "The job search funnel as a flow" (the same board, Little's law); C-4 "Why this question came back today" (FSRS); C-5 "How the neural network scores an answer".

**Pet projects** (`10` §10): the eight checklist projects plus the kubeadm cluster 7b — a business-card site in Docker with CI/CD on a VPS, a Telegram bot in the cloud, compose + a pipeline of three services (the basis of the final exam, mandatory for everyone), a VPN on a VPS with nftables, Ansible automation, monitoring with Prometheus + Grafana + Loki, a cluster with Helm and Argo CD, a kubeadm cluster, an operator in Go. Each has measurable acceptance criteria, an agent check, a cost estimate and cleanup. Paths: "Beginner" — 1, 3, 4, 6, 7 and the final one; "Intermediate" — 1, 3, 4, 5, 6, 7; "Experienced" — 3, 5, 6, 7, 7b and optionally 8.

**Sources** — `10` §12, including the vetted Telegram channels and YouTube from the checklist.

---

## 5. Flagship explanations

Flagships are the explanations that carry requirements R6–R10 and on which the engine is accepted (`08` §8): the engine is ready for a block when its flagship is completed end to end by a Playwright script in both themes and two widths, in calm mode, with a step transition of no more than 100 ms from knob to frame.

### 5.1. What is inside a container

The "A container from familiar parts" interactive (`04` §7; storyboard for the Linux part — `01` §9.3.1, `02` X7–X9). At the bottom is the kernel band "Linux 6.12 (one kernel)" with eight namespace lanes and inode numbers, and on its right a cgroup v2 tree with memory, cpu and pids gauges. Above are processes with a double PID "1 · 4123" (inside · on the host); a thin line runs from each process to its instance in each lane, and the container's processes are outlined with dashed frames of their namespaces. The data is live: `box start web` is running in v86, and the agent sends fact snapshots. "Own / shared with host" toggles for each namespace kind restart the container without it, and a sentence appears next to it, such as "without its own pid namespace the process sees every process on the host — this is how `--pid host` works". The `memory.max` slider drives it to a real OOM kill with a `dmesg` line under the gauge. Two terminals side by side — "host" and "container". On a weak device the same diagram plays recorded frames from the test bench.

### 5.2. How an image is packaged

The "How an image is packaged" interactive (`04` §8, X3). The learner types `nginx:1.30-alpine`, the reference splits into registry, repository and tag, the tag expands into an index with platforms, and a "by digest" line leads to the manifest. The "compute sha256 of these bytes" button computes the hash via WebCrypto and shows that it matches the address; editing one character breaks the line. Then come the config (Env, Entrypoint, Cmd, `diff_ids`, `history`, empty layers for ENV and CMD), two hashes of one layer (the compressed digest and the `diff_id`, and for the experienced, ChainID as the snapshot name in containerd), a layer's file tree with whiteout and opaque whiteout, a stack of layers with a `merged` tree and copy-up on write, and finally "why the image weighs 1 GB" with a transition to multi-stage. The learner can drag in their own image from `docker save`: the analysis runs entirely in the browser.

### 5.3. What happens when you type a URL

E-URL (`03` §7.10) is the backbone of the "Networks" block. It appears in the first lesson "in fog": the stage frames with numbers are visible, without labels or values. After each module its own section opens — DNS, TCP, TLS, HTTP, proxy, backend. In `net.m16` the learner goes through the whole path without fog: knobs for DNS cache TTL, RTT, keep-alive, HTTP/1.1 versus 2; "break it" deletes a DNS record or takes down the backend. The prediction question "what will change on the second visit?" ties together the DNS cache, connection reuse and the TLS session. There is one domain — `shop.example`, and nginx's default timeout is 60 seconds; the 504 path is covered by a separate explanation, E-504.

### 5.4. Envelopes: OSI and TCP/IP

E-ENV (`03` §7.2, `01` p.net.envelopes). HTTP data acquires headers step by step: TCP (ports, flags, seq), IP (src, dst, TTL, protocol), Ethernet (MAC, EtherType) — all fields are real and clickable. Sliders for data size and MTU; "break it" makes the MTU smaller than the packet. The question "which fields will change at the next router?" reinforces the main distinction: the MAC changes at every hop, the IP only at NAT. The NAT screen opens in `m09`, the tunnel in `m14`, as a continuation of the same scene. The model appears sixth, after the learner has touched each layer: that way it becomes a vocabulary rather than rote memorization.

### 5.5. How the internet is built

E-MAP (`03` §7.1, the `zoommap` primitive `08` §3.13). A zoomable map: a laptop, a home router, an ISP, a backbone, an internet exchange point, a submarine cable, a data center; autonomous systems with numbers from the documentation range, root DNS servers and anycast, CDN. The path of one request runs across the map; the knobs are scale and destination; "break it" is a cable cut, and the route is rebuilt. The question: "how many networks will a request to a neighboring city pass through?". For the experienced learner the map is mandatory in express mode: even web developers lack the big picture.

### 5.6. Hardware → VM → containers → today's nesting

X4 (`04` §6.5, `01` §9.3.2, the `towers` primitive `08` §3.12). Two towers of layers side by side: on the left "hardware → hypervisor → guest kernels → applications", on the right "hardware → one kernel → processes within namespaces". The "number of applications" slider adds guest kernels to the left tower and frames to the right one, and the utilization, startup time and memory counters grow differently. The "kernel vulnerability" toggle shows where the isolation boundary runs for each tower. The last screen is today's nesting: containers in cloud VMs, Kubernetes on bare metal, VMs inside Kubernetes via KubeVirt and Cozystack. Practice alongside: `dmesg` shows that the lab Linux is itself a VM; `uname` and `ps` inside and outside the container; a stopwatch "container start versus a cold boot of a second v86 machine". Basic animation only, no cartoon.

### 5.7. Container by hand in bash

Lab m04 (`04` §9) on `lab-alpine` in v86. Step by step, the learner assembles a container from what they studied in M15: `chroot` into an unpacked root, then `unshare` with pid, mnt, uts and net, then a cgroup with a memory limit, then a veth into the network namespace and a route, then overlayfs and `pivot_root`, then dropping capabilities, and at the end `crun` produces the same result from a hand-written `config.json`. Each step is checked against the agent's facts: a different inode for `/proc/<pid>/ns/pid`, the last value of `NSpid` equals 1, the process is in a group with the required `memory.max`, the root is the `merged` directory. In m12 the learner recognizes their `mybox.sh` script in `box` — the node runtime through which the hybrid Kubernetes runs pods.

### 5.8. Kubernetes from blocks

The builder (`05` §6.2, the `constructor` primitive `08` §3.9). A palette of components (kubectl, kube-apiserver, etcd, scheduler, controller-manager, kubelet, containerd, kube-proxy, CNI, CoreDNS, metrics-server, Gateway controller) and a canvas: the control plane at the top, up to three nodes at the bottom. Wires are typed: everything except etcd talks to the API server, and only the API server talks to etcd; a forbidden connection does not go through and explains why. A run on kube-lite assembled from what is on the canvas: remove the scheduler — pods stay in `Pending` forever without events; remove kube-proxy — the pod IP works, the ClusterIP times out; remove CoreDNS — `curl http://web` does not resolve. Blocks for concepts not yet introduced are visible as silhouettes labeled "opens in KN4". At stage 3 the same screen labels the blocks with the real pod names from the learner's cluster.

### 5.9. The reconciliation loop

E2 (`05` §6.3, `01` §9.3.3, the `reconcile` and `code` primitives `08` §3.16). On the left is the record `/registry/replicasets/default/web` in etcd with a growing `resourceVersion`, on the right are live pods, and in the middle the "observe → compare → act" loop with an iteration counter and a diff line. The learner intervenes: deletes a pod, moves `replicas`, creates a "foreign" pod with matching labels, removes a label, changes the ReplicaSet's image (nothing happens), turns off a node. The "missed events" screen explains the level-triggered approach: three changes while the controller is stopped produce one correction. Then the chain of loops Deployment → ReplicaSet → scheduler → kubelet → EndpointSlice, where a single `scale 3 → 5` lights them up one after another. At the end the learner writes their own loop: in the core tier — in bash, a loop with `kubectl get` and `kubectl create` on top of kube-lite; in the extension tier — in TypeScript in a QuickJS sandbox with checks for lost events and two instances. The last screen: an operator is the same loop for a `Website` CRD; a bridge to the Go operator pet project.

### 5.10. Kubernetes networking

E6, E7 and E9 (`05` §6.8–6.11, `01` §9.3.4). E6 — a packet from pod to pod: veth, bridge, route, and between nodes a delivery mode switch (host-gw, VXLAN, WireGuard); on the hybrid, the same `ping` is visible on the switch probe as three different frames: bare IP, IP in UDP, encrypted UDP. E7 — a request through a Gateway, a Service and kube-proxy: the Service tile with the address `10.43.12.7:80` is not connected to any interface, the packet is intercepted by a kernel rule, and the `KUBE-SVC` chain picks a `KUBE-SEP` by probability; the knobs are the kube-proxy mode (iptables, nftables, eBPF) and the number of endpoints; "break it" is a typo in a pod label. E9 — the cost of `ndots`: iterating over search domains and the number of queries. All of this is repeated on real nodes: `iptables-save` on a v86 node shows rules with the same names as real kube-proxy.

### 5.11. Kanban simulation

`flowlab` (`07` §7–§10). The board of a small team at an online tea shop: columns, WIP limits, people as roles with capacity as a random variable, work of different types, deployments with risk, incidents and reliability series. The learner sets limits, decides whether to automate or fight fires, and sees how the CFD, cycle time, throughput, DORA metrics and error budget change. Before a run — a prediction. Seed determinism and a decision log provide a review with counterfactuals and a replay of the day with a different decision; the learner's own run opens as a step-by-step explanation. Scenarios S0–S8 range from "one desk" to the "Black Friday" exam. There are no points or characters; Little's law and the risk calibration tables are checked by property tests.

---

## 6. Architecture

### 6.1. Execution tiers

| Tier | What it is | Where it runs | What it is for |
|---|---|---|---|
| A — simulators | TypeScript in a shared `sim.worker.ts`: the Stand, `netlab`, dsim and the registry, kube-lite, `flowlab`, ansim, tfsim, the CI runner simulator, the PromQL and Alertmanager engine | Any browser, including a phone; instant start | Beginner, theory, explanations, drills, long timeouts, phone |
| B — real Linux | v86 (BSD-2-Clause, vendored by commit) with the `dt-kernel` 6.12 LTS i686 kernel and the roots `lab-debian` (systemd), `lab-alpine` (containers, `lab-node` nodes), `lab-net`, `lab-ansible` | Desktop and laptop; on a phone — one `lab-node` on a button press | Isolation, cgroups, systemd, disks, machine networking, hybrid Kubernetes |
| C — real VMs | The learner's own cloud account at a provider of their choice, or local VMs on their computer | The learner's cloud or computer | Docker on a VM, networking exams, Kubernetes stages 2–3, IaC, pet projects, final exam |

Rejected: CheerpX/WebVM (licensing for self-hosting, and emulating system calls instead of a kernel), WebContainers (Node.js only), container2wasm (slow, one image), linux-wasm (nommu, a tech demo), the v86 `inbrowser` backend (a hub, not a switch), real k3s or kubelet in v86 (no i386 build and not enough memory) (`09` §1.2). The learner does not see the words "tier A/B/C": the interface says "in the simulator", "on real Linux in the browser", "on real machines".

The v86 budgets are recorded in one place — `09` §1.4: snapshot ≤ 40 MB, files before the first prompt ≤ 15 MB, first visit ≤ 15 s, repeat visit ≤ 4 s, a tab with one machine ≤ 600 MB. A machine autostarts only when `navigator.deviceMemory ≥ 4`; in Safari and Firefox, where the property is undefined, the machine starts on a button press that states the download size.

### 6.2. The machine interface and the check contract

All environments implement one `Machine` interface (`09` §1.5): `kind` (`sim`, `v86`, `vm`), terminals, a bus event stream, `facts(scope)`, snapshot and restore, `files.put/get`. A set of machines with a switch and kube-lite is a `Lab` with a consistent snapshot and `power(machine, on)` for "turn off a node". The textbook engine and the lessons work only with these interfaces and do not know what is behind them.

The check works the same way everywhere (`09` §2): the environment produces **facts** in the `dt.facts/v1` schema, and the lesson goal is a **predicate** over facts (`cgroups[...].memory.max<=20M`, `k8s.objects[kind=Pod]...`), with `fail[]` fields for targeted messages, `forbid` for forbidden shortcuts, and `keep` for "the same process, the same etcd". Each environment has its own fact collectors (the simulator, `dt-agent` inside v86, `trainer-check.sh` and `trainer-exam` on a VM), the predicates are shared, and the evaluator is implemented in TypeScript and in Go with shared test vectors. So one goal is checked in the simulator, in v86, in the hybrid and on a real VM without rewriting, and a three-node task on a weak device is replaced by a variant in the pure simulator with the same predicates.

### 6.3. Shared engines

| Engine | What it models | Owner | Where |
|---|---|---|---|
| Stand | Shell, a filesystem with inodes, users, processes, a subset of bash | 02 | `02` §3, `09` §1.3 |
| `netlab` | A discrete-event network: hosts with iproute2, iptables, nft, dig, curl, ss, tcpdump; a netfilter that executes everything Docker and kube-proxy write; a DNS hierarchy; nginx with real retry logic; `NetlabApi` for other engines | 03 | `03` §8 |
| dsim and registry | Docker engine: CAS, layers, networks via `netlab`, processes via the Stand, builds with cache; an OCI registry in a Service Worker | 04 | `04` §11 |
| kube-lite | A store with watch and MVCC, apiserver-lite with OpenAPI v1.37, controllers, scheduler, `cni-lite`, `kube-proxy-lite`, `coredns-lite`, Helm in wasm, Argo CD | 05 | `05` §5 |
| `flowlab` | Work flow, deployments, incidents, SLO; bots and counterfactuals | 07 | `07` §8 |
| ansim | Ansible: inventory, modules, facts, handler, roles, check mode | 06 | `06` §4.1 |
| tfsim | Terraform/OpenTofu on real HCL in wasm, a training provider, state, drift | 06 | `06` §5.1 |
| CI simulator | GitLab CI and GitHub Actions runner, cache, artifacts, environments, tool models | 06 | `06` §3.1 |
| PromQL and Alertmanager | Metric generator, TSDB, PromQL engine, rules, Alertmanager routing, `promtool`, `amtool` | 06 | `06` §7.1 |

All engines run on virtual clocks with a seed, support `whatif` for explanations, emit events to the shared bus in `08` §3.0, and are checked against the real tools with **golden recordings**: each scenario is run on real Docker Engine, k3s (k3d), kubeadm, nginx on the course's own runners and test VMs, and CI compares the simulator's output with the recording after normalization. A mismatch is a red build; we fix the simulator, not the recording, and until it is fixed the lesson is in `hold` (`09` §1.3, §8). To an unknown flag the simulator replies with "this flag exists in the tool and works at the real stage", while `unknown flag` is only for what does not exist in the real tool; full `--help` is always served, otherwise rungs 3–4 are impossible.

### 6.4. Multiple machines in the browser and the switch

Each v86 machine runs in its own Web Worker; the `dt-switch` switch is a separate worker, `net.worker.ts`, to which the machines are connected by their own `MessageChannel`s; frames are passed as transferable `ArrayBuffer`s and do not go through the main thread (`09` §1.7). On the diagram the switch is shown by the `vswitch` widget (`08` §3.17). The switch is real L2: a learning MAC table with aging, broadcast, 802.1Q VLANs with access and trunk ports, a "hub" mode with one toggle for the ARP lesson, link parameters (latency, loss, bandwidth) as knobs and "break it", and a probe on a port with a ring buffer and `.pcap` export. `netlab` model ports without a kernel connect to the same switch: `coredns-lite`, an "external client", and on a phone, models of the other nodes next to one real machine.

Budgets (`09` §1.7, `05` §5.9): a `lab-node` guest is 96 MB; two machines — up to 700 MB per tab, the default mode when `deviceMemory ≥ 4`; three — up to 900 MB when `deviceMemory ≥ 8`; four or `lab-ansible` — up to 1.2 GB on a button press; 1.5 GB is the emergency ceiling at which the lab switches to `sim` nodes. Nodes start from one snapshot in ≤ 5 s; after restore the agent changes the hostname, MAC, address, `machine-id` and host keys. There is one address plan for the course: the lab network `10.0.0.0/24`, hybrid nodes `192.168.56.11–13`, pods `10.42.N.0/24`, Services `10.43.0.0/16` with DNS at `10.43.0.10`, the "mini-internet" on RFC 5737 addresses, Docker `172.17.0.0/16`.

### 6.5. Hybrid Kubernetes

The control plane is kube-lite in the simulator, and the nodes are real `lab-node` machines with the `dt-kubelet` agent (a mode of the Go agent `dt-agent --kubelet`, `GOARCH=386`, RSS ≤ 15 MB) (`05` §5.9, `09` §1.8). The agent talks to kube-lite not over the guest network but over the service channel `ttyS1`, so the control plane does not depend on what the learner did to the node's iptables. The agent performs sandbox, image and container operations through `box` — the node runtime from `04` §10 on top of `crun`: a pause process holds the pod's net and ipc, layers are pulled from the course registry only for `linux/386`, requests and limits become real `memory.max` and `cpu.max`, `kubectl exec` goes over virtio-console into a real mount and pid namespace, kube-proxy-lite rules are written into real netfilter with chain names like real kube-proxy's, and NetworkPolicy becomes filter chains on the bridge. The hybrid's clocks are tied to real time, and the defaults are real (a 50 s grace period, `tolerationSeconds` 300 s), while the "fast-forward the wait" button advances timers to the nearest deadline and at the same time renews the Lease of live nodes. A node failure is two buttons: "power off" and "disconnect network"; after the network returns, the agent kills the pods that no longer exist in the API ("kubelet reconciles too"). Cluster DNS is answered by a model on a switch port, but the pods' queries and `resolv.conf` are real. Cilium eBPF cannot be reproduced in v86 and stays in the model and at stage 3. The learner is told this with a single card next to the control plane hexagon: where the model ends and the real processes begin.

The hybrid is prototyped first (section 8.1). If the spike does not fit the budgets, the Kubernetes networking section is built on `sim` nodes with the same content, and this is recorded explicitly.

### 6.6. The real VM stage and verification

Where to get machines (`09` §5.2–5.3): the course does not provide machines. The learner orders VMs in their own cloud account at a provider of their choice (Yandex Cloud, VK Cloud, Selectel, Timeweb Cloud, AWS Free, Oracle Always Free, Hetzner) or brings up local VMs on their own computer (Multipass, Vagrant, UTM, libvirt; three nodes need 12+ GB of RAM). At stage 3 and in IaC the learner orders VMs with their own Terraform at their own provider; without a cloud account they practice ordering machines with code in the in-tab cloud (6.13) and install the cluster on local VMs. There is a single price table for the course — `providers.yaml` with the date it was checked. Before each order, a screen shows the price per hour, per day and "if you forget it for a month", and a meter stays visible while working.

At the real VM stage the trainer **executes nothing**: it guides through the steps, shows commands and checks the result. There are two checkers (`09` §5.4). `trainer-check.sh` is a readable, read-only bash script with `facts.sh`, which the setup screen invites the learner to read before running; it collects the track's facts, embeds a one-time `nonce` (for Kubernetes it also reads the `trainer-proof` ConfigMap where the learner put the same code) and prints a base64 block that the learner pastes into the browser. This is self-assessment. `trainer-exam` is a signed Go agent for certifiable exams, which the learner installs on their own machine with `enroll`: it injects a breakage from a package signed with the course key, collects and signs the facts with Ed25519, and only the server knows the attempt time. Both use the same facts code, and CI compares their output.

**Labels and cleanup.** All resources created by the course's lessons and modules get the labels `trainer=devops` and `dt-track=<track>`. Cleanup is mandatory: a lesson, stage, exam or pet project is not credited without it. In a cloud the learner pastes the output of `terraform destroy`, an empty `terraform state list` and an empty list of the provider's VMs by label; for local VMs an empty list of the hypervisor's machines is enough. Until cleanup is confirmed, a reminder with the accumulated amount is shown on every login.

### 6.7. Our own neural network

The "bring your own key" model (`09` §4). The course sends requests directly from the learner's browser to their provider; our server neither sees nor proxies the key. CORS was checked with preflight requests on 18.11.2026: open at DeepSeek, OpenRouter, OpenAI, Mistral, Groq, Gemini (OpenAI-compatible layer), Cloud.ru Foundation Models and Anthropic (with the direct browser access header); closed at YandexGPT and GigaChat, so they are not supported in the MVP. For learners from Russia the connection screen offers Cloud.ru and DeepSeek first. Locally — Ollama and LM Studio on localhost (with instructions on `OLLAMA_ORIGINS` and a warning about Chrome's "Local network access" dialog) and WebLLM in the browser for those who have WebGPU and 8 GB of memory. A weekly automated test in CI watches whether a provider has closed access.

**Key storage** (`09` §4.4): the main thing is not a single third-party script on the page (CSP `script-src 'self' 'wasm-unsafe-eval'`, Trusted Types, model responses are rendered without `innerHTML`, the learner's code runs in QuickJS without network access); the key is encrypted with a non-exportable AES-GCM key in IndexedDB and never goes into sync, export, QR or logs; a "don't remember" mode for shared computers at workshops; advice to create a separate key for the course with a spending limit.

**Mentor modes** (`01` §16.1): `explain` in the chapter and explanations; `practice` in trainers with the H1–H5 hint ladder, one rung per request; `docs` on DL4 tasks ("where have you already looked?", the flag is not named, the answer is checked against `solution_tokens` and collapsed on a leak); `free` in the free sandbox; `review` after an answer during review; `exam` — the mentor is off. There is no ready-made solution at any rung: the reference solution is never passed into the model's context at all, and hints H4–H5 are built from pre-written examples and scaffolds. The model receives the list of introduced concepts and must follow it. Answers are short (120 words for a beginner, 180 for others), Socratic, with analogies from the learner's previous profession. Quality is checked by the `ai-evals` suite: on DL4, after interception, the share of answers containing a flag from `untaught` is zero, and 20 out of 20 attempts to "talk it into" giving the answer are rebuffed (`09` §4.6, `10` §3.4).

**Exams and AI.** The built-in mentor is always switched off by the engine during an exam. We do not control external AI and do not pretend to: there is no proctoring and no "AI detectors". The learner chooses "exam" mode (word of honor: built-in documentation only; closes the block) or "practice" mode (any assistants; full review; does not close the block). The learning result is protected by state-based checks with parameterized variants, tasks outside the course and confidence calibration (`10` §7).

### 6.8. Storage, offline, sync

Local-first (`09` §3). An xAPI-style event log in IndexedDB is the only source from which concept states, rungs and progress are recomputed; machine snapshots are in OPFS, images and the documentation corpus in Cache Storage. The course works without registration and without network after the first visit: one Service Worker caches the shell, lessons, the corpus and the course registry (PWA). Transfer without an account is JSON export and import and QR handoff of the screen to a phone; the account and log sync are in v1, and logs merge without conflicts.

Saving rules approved by the owner on 18.11.2026. Saving is automatic after every action, and there is no "save" button: a person will close the tab, and progress must not be lost. Learning can start immediately, without registration. An account is optional and passwordless: sign-in via an email link, GitHub or Google. Only the progress log (kilobytes) is synced; machine snapshots (tens of megabytes) stay on the device, and when moving to another device they are restored from the exercise's starting snapshot. An account is mandatory for certifiable exams and the certificate: the result is signed on the server. The browser may clear local data on its own (Safari erases a site's storage after 7 days without visits, incognito on close), so the course requests `navigator.storage.persist()`, and once a week shows a learner without an account a single line: "export your progress file or sign in so you don't lose it". Without the `dt-api` service only sync, machine access to the real internet (through our Wisp relay and our DoH with an allowlist) and certifiable exams are lost.

### 6.9. Two languages

Routes `/ru/…` and `/en/…`, bilingual content in one YAML (the `Bi` type from Sankofa), interface strings in `i18n/{ru,en}.yaml`, and the build fails on a missing translation (`09` §6.3). Commands, terminal output and documentation pages are always in English, as on real servers; only the markup on top is translated. An English term in Russian text is given once in parentheses when introduced, and afterward the same Russian word from the glossary is used (CL13). Each lesson has sources in English and in Russian; each technical fact has two confirmations (primary documentation and a check on the specified version), otherwise the fact is in `hold` and is not released (`08` §2).

### 6.10. Stack and repository

The frontend is TypeScript 7, Vite 8, no UI framework (an `h()` helper and on-demand modules, as in Sankofa), xterm.js 6, `idb`, `vite-plugin-pwa`, `ts-fsrs`, MiniSearch, `quickjs-emscripten` and `sucrase` for the learner's code, WebLLM as a separate chunk, Vitest and Playwright. The server and agents are Go 1.27: `dt-api` (sync, sign-in, Wisp, DoH, workshop groups, exams), `dt-agent` for v86 (`GOARCH=386`) and `trainer-exam` (amd64, arm64). Deployment is static files in Cozystack object storage behind a CDN and `dt-api` with two replicas and managed Postgres in the same cluster; strict security headers (`09` §6.4). Chunk budgets are checked by size-limit on every PR (`08` §12): shell 60 KB, lesson host 40 KB, widget 15–30 KB, terminal 120 KB, kube-lite 300 KB.

Monorepo (`09` §6.2): `content/` (lessons, `concepts.yaml`, bank, sources), `web/src/{app,engine,models,runtime/{sim,v86,net,hybrid,usercode,remote},checker,docs,store,ai,sw}`, `shared/` (the facts schema and predicate vectors for TS and Go), `check/` (`trainer-check.sh`, `facts.sh`), `images/` (kernel, `lab-debian`, `lab-alpine`, `lab-net`, `lab-ansible`, `lab-tiny`, corpus build), `vendor/v86/`, `golden/`, `server/`, `agent/`, `probes/` (signed probe and breakage packages), `ai-evals/`, `infra/` (manifests, `cost.md`, Terraform modules for learners). The facts schema and both evaluator implementations change in a single PR.

### 6.11. What we take from Sankofa

From the Sankofa engine (`~/projects/sankofa-int/web/src/features`) we carry over the architecture and the magazine-style presentation (`08` §2): bilingual scenes and the `model.ts` validator with `draft` and `hold` and the two-source rule; `scroll.ts` for scroll scenes with a `scrub` mode, where scrolling sets the stepper's step; `layers.ts` as the mechanics of spreading a stack apart (image layers, overlay, towers); `calm.ts` and an explicit "step by step" toggle; `FlashGate` for drop and OOM flashes; our own QR encoder `qr.ts` and `isPhone`; role lenses from `lenses.ts` (one event through the eyes of Dev, Ops, a manager, a user); `decay.ts` as a pure function "value by progress" for gauges; glossary links `[[id|words]]` with a card on top and a way back; a deterministic random number generator for `flowlab`; lazy module loading from `host.ts`; i18n utilities. We do not take: the ink drawings of `ink.ts`, kinetic decay effects, parallax, sound.

### 6.12. Our own fast engine: RV64 with JIT

**Owner decision (20.11.2026): kuberoot instead of k3s.** Wherever the course itself brings up real Kubernetes (the RV64 engine in the browser, the local lab on the learner's computer, the "one real node" stage), it uses kuberoot (github.com/tym83/kuberoot): a distribution with its own kernel, installer and node API, built for amd64 and arm64. The RV64 engine needs a riscv64 build of kuberoot, a separate task of the track. k3s, kind and minikube stay in lessons only as common industry options the learner should know about.

The main limitation of v86 is not speed but word size: it emulates 32-bit x86, while k3s, containerd, kubelet and Cilium are built only for 64 bits. So real Kubernetes in the browser is impossible right now, and the course relies on the hybrid (section 6.5). Our own 64-bit engine removes this limitation. CheerpX does not serve as a model: it is fast because it throws out the kernel, and the kernel is exactly what the course runs real Linux for.

**Decision.** Our own full computer emulation on RISC-V 64 (RV64GC, the privileged architecture with Sv39) with a JIT to WebAssembly. RISC-V was chosen over x86-64: the instruction set is small and regular, and a decoder and JIT can be written in months rather than years; Debian, Alpine, k3s and containerd are already built for `riscv64`. The learner will see `riscv64` in `uname -m` — this does not matter for the lab tasks, and on the "where are you" screen it is even an extra occasion to talk about processor architectures. The reference point for checking behavior is Fabrice Bellard's TinyEMU (RV64 without a JIT, already boots Linux in the browser).

**Where the speed comes from.** Speed is built into the design from day one rather than optimized later:

1. JIT of guest basic blocks and traces into WebAssembly modules with a cache; the browser itself takes them down to machine code. Regular RISC-V instructions give fast decoding and simple translation.
2. A software TLB with a fast path on a hit (a couple of operations per memory access); a full page table walk only on a miss.
3. Multiple vCPUs: each in its own Web Worker, with guest memory shared via `SharedArrayBuffer` (the site already serves COOP/COEP). Kubernetes is multithreaded, so this is a direct gain.
4. Only virtio (blk, net, console, 9p, rng), no emulation of legacy hardware; the guest kernel is built for virtio, with unneeded drivers removed.
5. Snapshots instead of booting: a node with k3s already running is snapshotted at build time and is unpacked on the learner's side in seconds.
6. A lazy filesystem: files are loaded on access and cached in Cache Storage.
7. Lightweight guests: a minimal node image, systemd only where it is being studied.

**Speed budget** (targets checked at every stage): restoring a node from a snapshot ≤ 5 s; `kubectl get pods` ≤ 0.5 s; starting a pod with an image from the course registry ≤ 3 s; `curl` to a Service ≤ 0.3 s; a k3s node guest ≤ 512 MB; on a laptop with 16 GB — two k3s nodes in one tab. Emulation is still several times slower than hardware; the goal is the feel of a weak VPS, not waiting.

**How it fits in.** The engine implements the same `Machine` interface (section 6.2) with a new `kind: 'rv64'`, so lessons, checks and diagrams do not change. The course launches on v86 and the hybrid; when the engine meets the criteria, Kubernetes stage 1 switches from the hybrid to real k3s in the browser, and the hybrid remains for weak devices.

**Stages and criteria.**

| Stage | What we do | Success criterion |
|---|---|---|
| R0. Measurement | TinyEMU in the browser with Debian riscv64 and k3s | Numbers: k3s startup time, memory, `kubectl get pods`; it is clear how many times faster we need to get |
| R1. Interpreter | Our own RV64GC with Sv39 MMU, CLINT/PLIC, virtio, SBI; passes riscv-tests and boots Linux | Debian boots and passes the riscv-arch-test suite |
| R2. JIT | Translating blocks to WebAssembly, a TLB with a fast path | Speedup relative to R1 and TinyEMU on CoreMark and k3s startup time |
| R3. SMP and snapshots | Multiple vCPUs in workers, saving and restoring state | A k3s node starts from a snapshot in ≤ 5 s, a pod starts in ≤ 3 s |
| R4. Cluster | Two nodes on the `dt-switch` switch, Flannel or Cilium without eBPF acceleration | `kubectl apply` produces real pods on two nodes, a node failure moves the pods |

This is a separate research track running in parallel with the MVP, not its foundation. R0 is in phase 0, R1–R2 during the MVP period, R3–R4 by v1.

---

### 6.13. The "before Docker" lab: SSH, OS installation, a cloud in a tab

**Priority (owner, 18.11.2026): after content.** First the textbook, multimedia explanations, quizzes and exercises on what already works (Tier A and stock v86). This section is the next wave.

The owner's requirement of 18.11.2026: on the machines in the browser, do everything an admin does by hand before containers, and bring up infrastructure through a cloud API, as in real life.

- **Our own image instead of the stock buildroot from v86.** It needs dropbear or openssh, nginx, iptables and nftables, iproute2 with bridge, VLAN and netns, fdisk, sfdisk, parted, lvm2, mkfs.ext4, git, curl. The kernel is built with virtio-blk, ext4, LVM (dm), bridge, veth, 8021q, netfilter and NAT.
- **SSH between machines.** This is a real sshd on VMs in a shared L2 network 10.0.0.0/24: keys, `~/.ssh/config`, a jump host, `scp`, port forwarding.
- **OS installation.** A machine boots from "installation media" and gets an empty virtual disk. The learner partitions it (GPT, partitions, LVM), creates filesystems, installs the system from a local package mirror inside the tab, configures the bootloader, fstab, network and a user, and reboots into their own system. For now this is Alpine x86 (`setup-alpine` and the manual path). Ubuntu is impossible on 32-bit v86: there are no i386 builds. It will appear on the RV64 track (6.12): Ubuntu has an official riscv64 version.
- **Networking.** A router made from a Linux machine (`ip_forward`, NAT), bridges, VLAN, netns, a firewall, DNS (dnsmasq), DHCP. We add latency, loss and traffic capture for tcpdump to the switch.
- **A cloud in a tab (Tier A+).** The cloud emulator is a JS service at the virtual address `api.cloud.lab` (10.0.0.1), reachable by VMs through the switch. A REST API in the style of real clouds: projects, access keys, networks, subnets, security groups, VMs, disks, a load balancer, DNS, object storage. Creating a VM via the API boots a **real** new v86 machine and connects it to the switch; it is not a text stub. Errors, quotas, asynchronous operations and states (PENDING → RUNNING) work as in real clouds. The limit is the tab's memory, usually 3–5 machines.
- **Terraform and OpenTofu.** Official linux_386 builds exist. Our own `lab` provider (Go, GOARCH=386) sits in a filesystem_mirror in the image, so `init/plan/apply/destroy` work without the internet. State can be stored in the cloud's object storage. The expected `plan` speed is seconds; measure the budget in phase 0.
- **A Git server in a tab.** Smart HTTP on the same JS host (`git.lab`). A template repository: push → webhook → CI runner (8.x) → `terraform apply` or ansible on the cloud's machines. This is how the "Git and CI", "IaC" and "Linux" blocks are tied together.
- **Checks** — by facts (6.2): cloud state from the API, `sshd` is listening, a partition is mounted by UUID from fstab, nginx serves a page to a neighboring machine.

## 7. Assessment

**Task bank** (`10` §3). Tasks live in `content/bank/<block>/` and are described in the platform's check contract. Types: `choice`, `order`, `match`, `number` with a tolerance, `predict`, `hotspot`, `label`, `task`, `fill`, `bugfind`, `scene` (a task on a process explanation, where the learner first predicts, then manipulates), `docanatomy`, `docfind`, `beyond_course`, `explain` with a rubric. Each task has 3–5 parameterized variants; reference answers for `predict` and `scene` are produced by running the simulator or the explanation model itself in CI, so they do not diverge from what the learner will see. Each wrong answer option is a recorded misconception from `misconceptions.yaml` with an explanation in two languages. The volume is about 1,700 tasks and 5,500 variants, with at least three tasks of three different types per concept. Difficulty is calculated from anonymized statistics (p and discrimination) only with the learner's consent.

**Quizzes** teach rather than measure: low stakes, immediate review, retries without penalty. A module is closed at ≥ 80% on the first attempt and all key tasks, plus the solved `scene` tasks of its explanations and the task for its documentation rung; the block exam does not open until all three pillars are passed (`10` §4).

**Trainers** come in three kinds (`01` §13.1): fluency (10 tasks of 20–60 seconds each, the time is visible only to the learner), reading output and documentation, and "broken — fix it" breakages with state-based checks, 3–5 possible causes for one symptom, and a review where the learner's path is shown next to the reference one. Breakages are tied to the block's diagnostic model: in networks — "which layer", in containers — "which boundary", in Kubernetes networking — the five KN8 steps; the review flags "acted without a hypothesis".

**Practical exams** (`10` §6.1). The frame is common to all blocks: tasks come in business language from a "tracker"; checks are by facts, any route, with `critical`, `forbid` and `keep`; rung DL5 with a documentation allowlist; 10–25% of the weight is tasks outside the course (a minimum of 10/15/20% for beginner, intermediate and experienced; up to 30% in the Kubernetes `pro` part); two "explain" questions give an "interview readiness" mark but do not count toward the score; a soft timer; a block threshold of 66–85% and all critical tasks; a variant from a seed; a retake after 24 hours with a new variant after a 15-minute series of trainers. **The block's qualifying exam is the same for all levels and checks the core**; the levels' practice exams (Linux service/disk/isolation/access, Docker e1–e4, Kubernetes B/I/E) are intermediate tests and do not go into the transcript; the `plus` and `pro` parts are taken separately and go into the skills map.

**"On-call shift"** (`10` §6.4) is a cross-block exam before the final one: 60 minutes on a hard timer, three overlapping incidents in the hybrid environment (the shop server is a v86 machine, Kubernetes is kube-lite and two v86 nodes, the network is the switch's real L2, monitoring and CI are simulators reading the facts of the real machines). Incident pools touch at least three blocks: a 504 from the proxy, a disk filling up, a new version not accepting traffic, a red pipeline, `KubeNodeNotReady`, "api could not reach orders". Not only the fix is assessed but also the on-call engineer's behavior against a rubric: evidence before actions, no destructive actions before collecting evidence, prioritizing by impact, status updates in the chat, a blameless review. On a weak device the same shift runs entirely in the simulator, with a note in the transcript.

**Final exam** (`10` §6.5) — on three real VMs that the learner orders with Terraform and configures with Ansible. Part A "Build" (up to 14 days at one's own pace, the final build from scratch is one session of up to 8 hours): a public repository with a README, a pipeline through to deployment, idempotent Terraform and Ansible, a three-node cluster (for "Beginner" and "Intermediate" — k3s, because they have already built kubeadm in B3; for "Experienced" — kubeadm with Cilium, a scheduled etcd snapshot, a version upgrade during the exam and certificate checks), a Helm chart via Argo CD, monitoring with an alert to Telegram, basic security, a task outside the course, bringing everything up from code from scratch. Part B "Fix" — 60 minutes, one breakage from a signed package (in self-assessment the learner runs the displayed breakage command themselves). Part C "Defend" — a 40-minute technical interview with the mock interviewer based on the README and the transcript. Cleanup is mandatory. The transcript — HTML and JSON with an authenticity mode ("self-assessment" or "certifiable" with a verification link) — is not a certificate, and is honestly named as such.

**Review** (`01` §12, `10` §3.4). The FSRS scheduler (`ts-fsrs`, target retention 0.9); a card is created per concept, not per fact; each review uses a different format (recall, predict output, pick a command, a micro-task in the sandbox every third review, explain); a concept does not become `mastered` while the correct answers were obtained in only one format. An error made with "I know it" confidence schedules a review in the same session and the next day. Review interleaves blocks and deliberately places side by side the pairs where confusion is most costly: a Linux namespace and a Kubernetes namespace, NAT and a Service, cgroups and requests/limits, rolling update in CI/CD and in a Deployment. The documentation skill is reviewed as a concept: each source has its own `doc.<source>` card. Daily — up to 15 minutes or 30 cards, designed for a phone.

**Metacognition.** Confidence is marked with every answer; once a week there is a calibration chart ("when you said 'I know', you were right 78% of the time"). Without calibrated self-assessment, a person will not say in an interview "I don't know, but I would find out like this: I'd open `man ss`, the FILTER section" — and that is one of the most valued answers from a junior.

---

## 8. Build plan

Platform estimates are taken from `09` §7 (a team of two frontend developers, a half-time Go developer and a half-time image engineer). Content, explanation models and block simulators are not included in `09`; their estimate below was made by this document based on the size of the catalogs and needs refinement after the prototype.

### 8.1. Phase 0: prototype and spikes (4 weeks)

The first prototype answers two questions without which the rest cannot be planned: can the browser handle real Linux and hybrid Kubernetes, and does the owner like the visual language.

| What | Scope | "Go" criterion |
|---|---|---|
| Spike 1: kernel and images | `dt-kernel` with a config fragment, `lab-alpine` and `lab-debian` with snapshots; measurements on a 2020 laptop with 8 GB, a MacBook Air, a Chromebook, three browsers, an iPhone and an Android with 4 GB; what `dmesg`, `/proc/cpuinfo`, `systemd-detect-virt` show | snapshot ≤ 40 MB, first visit ≤ 15 s, repeat ≤ 4 s |
| Spike 2: `dt-agent` | Facts in ≤ 300 ms, `watch` without missed `exec`s, RSS ≤ 15 MB | all thresholds |
| Spike 5: hybrid and switch | Two, then three `lab-node` nodes + `dt-switch` + `dt-kubelet` + kube-lite: a three-replica Deployment produces `crun` processes in the nodes' `ps`; `curl` from node-1 to a ClusterIP gets a response from a pod on node-2; `kubectl exec`; "power off" → pods on other nodes in ≤ 60 s with fast-forward | budgets in `09` §1.7–1.8; on "no", Kubernetes networking is built on `sim` nodes |
| Flagship for approving the visual language | "How the kernel isolates and limits" (`08` §7.2.4, text `02` M15) on live v86: the kernel band with namespace lanes, cgroup gauges, a `memory.max` slider to OOM kill, "break it" for the mount namespace, a DL1 label on `man 7 namespaces`, the terminal in the course theme; both themes, calm mode | the owner approves the style, palette, typography and terminal |
| Spikes 3, 4, 6, 7 | Outbound access via the `fetch` backend and Wisp/DoH; QuickJS and xterm.js under CSP and Trusted Types; three local VMs and three VMs at a cloud provider with kubeadm, Cilium and an MTU measurement; the CORS matrix of neural network providers | a decision on each is recorded |

The scope is about 9 person-weeks (7 pw for the spikes per `09` plus 2 pw for the flagship with the model and storyboard). The flagship was chosen because it simultaneously tests the main technical risk (a live diagram on top of a real kernel) and uses almost all engine primitives: `split`, `stepper`, `breakit`, gauges, `docview peek`.

### 8.2. MVP (14 weeks)

No accounts and no server other than static files. First the three pillars, then the sandboxes. Platform: shell, router, bilingual support; `sim.worker.ts` with the Stand, `netlab` and dsim on virtual clocks; `whatif` and session recording; the documentation corpus from images and a snapshot of docs.docker.com, `docview` with search; the mentor with the `openai-chat` adapter, all modes and the `solution_tokens` filter; `Machine` with `sim` and `v86` backends; the predicate evaluator in TS; the event log, snapshots, export; PWA with offline support; CSP from day one (about 38 pw). Content: Onboarding, Orientation, Methodology with `flowlab`, all of Linux, Git and YAML, all of Containers.

Definition of done: the Linux blocks (including isolation on `lab-debian`) and "Containers" can be completed from start to finish offline after the first visit; every module has a process explanation with a knob and "break it" that recomputes in ≤ 100 ms; every task has a documentation rung; the mentor in `docs` mode passes `ai-evals` without a single flag after interception; on a phone a lesson can be completed in the model, and only goals with `envs: [v86]` remain incomplete.

### 8.3. v1 (16 weeks)

Platform (about 44 pw): `net.worker.ts` with `dt-switch`, model ports and the probe; multi-machine labs `lab-node`, `lab-net`, `lab-ansible`; hybrid Kubernetes; kube-lite and the controller editor; a kubernetes.io v1.37 mirror and `kubectl explain`; `dt-api` with sync, sign-in, Wisp and DoH; the stage 3 Terraform modules for clouds and local VMs; `trainer-check.sh`; the price-before-order screen, the cost meter and cleanup verification; the Go evaluator; Anthropic and WebLLM adapters; `grade` mode. Content: Networks, CI/CD, Kubernetes stages 1–2, IaC, B3, Monitoring, career trainers, pet projects 1–7b, "On-call shift".

Criterion: the three Kubernetes stages can be completed — the hybrid in the browser, k3s on one VM, kubeadm on three VMs in the learner's cloud ordered by their Terraform, or on three local VMs, with confirmed cleanup; the learner continues on a second device with the same progress.

### 8.4. v2 (10 weeks)

Platform (about 22 pw): `trainer-exam` with signed breakage packages and a server-side timer; certifiable exams and the final exam in certifiable mode; workshop groups with a facilitator table; Terraform modules for external clouds with a weekly `apply`/`destroy` in Yandex Cloud and Hetzner; "the diagram on a second screen" via QR through `dt-api /api/pair`; switching Kubernetes stage 1 to real k3s in the browser on our own RV64 engine, if it has passed R4 (section 6.12); a proxy for YandexGPT and GigaChat — only if there is demand. Content: the `pro` parts (exam E modeled on the CKA, an operator in Go), an English edition of all texts where it lagged behind.

### 8.5. Total scope of work

The estimates below are given in person-weeks for a team of people. The code in the project is written by a neural network, so the calendar for the software part shrinks several times over; the bottlenecks remain device measurements, golden recordings, proofreading texts in two languages and the owner's review of storyboards. The track for our own RV64 engine (section 6.12) is not included in the table.

| Area | Estimate, pw | Basis |
|---|---|---|
| Platform (phase 0 – v2) | ≈ 111 | `09` §7 |
| Phase 0 flagship | ≈ 2 | section 8.1 |
| Block simulators: the Stand, `netlab`, dsim and registry, kube-lite with networking, `flowlab`, the Git layer, the CI runner, ansim, tfsim, PromQL and Alertmanager | ≈ 70 | from the descriptions in `02`–`07`; Git — 2–3 weeks per `06` §0.3 |
| Process explanations: about 85 models with storyboards, Vitest tests and checks against recordings | ≈ 85 | ~1 pw per explanation, flagships cost more |
| Chapters and lessons in two languages with two sources per fact: about 130 modules | ≈ 80 | ~0.6 pw per module |
| Task bank, trainers, breakage scenarios, exams, golden recordings | ≈ 55 | ~1,700 tasks, generators reduce the manual volume |
| **Total** | **≈ 400** | |

With a team of eight to nine people (the platform per the `09` lineup plus four to five authors and simulator engineers, each the owner of their block) this is about a year of calendar time; an MVP with Linux and containers is visible to learners about five months after phase 0 starts. The order of work on a block's content is the same (`08` §13): research of EN and RU sources → storyboard in the block document → owner approval → process model and its tests → recordings from the environment and checking → texts with `draft` → the editor removes `draft` → validator → e2e → critics (a beginner, a practicing engineer, an editor) → rollout.

---

## 9. Owner decisions and risks

### 9.1. What remains with the owner

Below is only what cannot be settled by design: money, law and external agreements. For each item, what the project proposes is stated.

1. **Product license.** The code of the trainer, agents and simulators, and the license for the learning texts. Proposal: code — Apache-2.0 (compatible with v86, isomorphic-git, quickjs, WebLLM; this is also why GPL-licensed Wireshark is not embedded in the client), texts and diagrams — CC BY-SA 4.0. A decision is needed before the first public repository.
2. **Domain and name.** The documents use `<domain>` everywhere; CSP, `OLLAMA_ORIGINS` and package signatures depend on it.
3. **Money model.** A free course, a paid course, or a free course with paid certifiable exams. In none of the options does the course provide machines (owner decision of 19.11.2026): the learner pays their own provider for real VMs or brings them up on their own computer.
4. **A neural network on the course side.** There is none now: only the learner's key, directly from the browser. Options for a decision: pay for a small quota through our own key for learners without a key (then requests go through our server, and the promise "the key never leaves the browser" changes to "your requests go through us"); a transparent proxy for YandexGPT and GigaChat in v2. Proposal: do neither until there is demand.
5. **CheerpX — decided, we are not buying it.** It emulates system calls, not a kernel: systemd as PID 1, namespaces and cgroups do not work there. Speed is solved with our own engine (section 6.12).
6. **Legal review of the documentation corpus.** Distributing man-pages, GNU, curl, BSD and MPL-2.0 pages as aggregated documentation, the Terraform, Ansible, Prometheus and Grafana documentation, the Featureban scheme (CC BY-SA), the Russian edition of The DevOps Handbook. Until the review, these sources are opened by link, and DL2 fragments from them are not embedded (`01` §11.6, `03` §14.1). kubernetes.io (CC BY 4.0) and docs.docker.com (Apache-2.0) can already be mirrored with attribution.
7. **Personal data.** With accounts in v1, `dt-api` stores the learner's event log and certifiable exams. Needed: the storage jurisdiction (for learners from Russia, taking Federal Law 152-FZ into account), a privacy policy and a retention period.
8. **Branding of CNCF projects and Cozystack.** CNCF logos are used only as identifying marks under the `cncf/artwork` rules (`08` §6.2); how to present Cozystack, on which the course website runs and which appears in lessons as an example of VMs inside Kubernetes, is the owner's decision.

### 9.2. Known risks

| Risk | What it threatens | What we do |
|---|---|---|
| v86 is slow on weak laptops | The learner waits for the machine longer than 15 seconds and quits | The phase 0 threshold; less guest memory and fewer packages in the snapshot; the recorded mode and the explanation model are always available |
| The hybrid does not fit in memory | No "pod as a real process" | Kubernetes networking on `sim` nodes with the same content; one real machine for "pod = process" |
| A simulator diverges from reality | The learner memorizes something untrue | Golden recordings before the first lesson; a red build; the lesson in `hold` until fixed |
| The mentor gives away the answer | Learning without learning (Bastani et al., 2025) | The reference solution is not passed to the model; `solution_tokens` interception; `ai-evals`; a model is removed from the recommended list if leaks before interception exceed 5% |
| Content volume | About 1,700 tasks, 85 explanations and 130 chapters in two languages — the main cost item | Task generators; one format and a validator; blocks are released one at a time, starting with Linux and containers |
| The learner forgot a VM in their cloud | The learner's real money | Mandatory cleanup, labels, a reminder on every login |
| MTU and L2 at the learner's provider or hypervisor | The learner's cluster has "ping works, HTTPS hangs" | MTU autodetection in the Cilium template and a check in `trainer-check.sh` (`09` §5.3); NodePort instead of an internal LoadBalancer if L2 does not pass through |
| A neural network provider closed CORS | The connection stops working | A weekly automated test; the provider is marked unavailable, the others keep working |
| Version drift | Kubernetes v1.37, Docker Engine 29, Debian 12 LTS until 30.06.2028, Ingress NGINX retired, IPVS deprecated | Versions in `content/versions.yaml`; re-recording golden recordings per release; disputed facts (IPVS removal dates, CrashLoopBackOff timings) in `hold` until a second source |
| Abuse of the Wisp relay | An open proxy from our IP | A name allowlist through our own DoH, traffic limits, port 25 closed |

### 9.3. Open technical questions that phase 0 will close

What in `dmesg`, `/proc/cpuinfo` and DMI reliably shows virtualization in v86 (the text of the "your Linux is a VM" screen); whether 3–4 nodes of 96 MB each fit in a tab; whether the v86 `fetch` backend passes the HEAD and PATCH methods and the Authorization and Range headers unchanged, and whether a Service Worker intercepts requests from a dedicated worker in Safari; whether lab m04 fits in 96 MB with a 32 MB tmpfs `/c`; whether changing the MAC from the guest works on virtio-net; whether `save_state` with an ext4 disk fits the budget; the size of tfsim in wasm against 2.5 MB gzip; what MTU local hypervisors and the providers from `09` §5.2 give, and whether their network passes Cilium L2 announcements.

---

## 10. Conflicts between documents and how they were resolved

The documents were revised in parallel, and some decisions in one document did not reach another. Below is what was found and what was decided. The "Edit" column states what was corrected in the documents themselves; where there is no edit, the decision applies from here, and the block document is brought into line with it at its next revision.

### 10.1. Identifiers: slugs are the single source of truth

Concept codes diverged. In `01` §6.2 the isolation module is L33 `fork-exec`, L34 thread, L35 namespaces, L36 cgroups, L37 capabilities, L38 mount and chroot, L39 overlayfs, L40 seccomp, L41 summary, and L42–L44 are networking from the machine's point of view, SSH and the cloud VM. In `02` §5.1 the same codes mean other concepts (L33 thread, L34 `fork-exec`, L37 OOM, L42 PID 1, L43 chroot), and `04`, `08` and `10` refer to "L33–L39" in a third sense. Git in `01` is G01–G09, in `06` it is C01–C21; career in `01` is J01–J10, in `10` it is R01–R10. Levels in `02`, `03`, `05`, `07`, `10` are still written L0/L1/L2, although `01` §0 forbade it.

**Decision.** Per `01` §0, only slugs exist in the data (`linux.namespaces`, `git.commit`); codes are aliases for reading tables inside a single document and are not used in content. Codes from different documents are not mapped to each other. The concepts of the isolation module are the union of the two documents: `linux.fork-exec`, `linux.thread`, `linux.namespaces`, `linux.cgroups`, `linux.oom` (separately, as in `02`), `linux.capabilities`, `linux.tmpfs-bind` (M13), `linux.chroot`, `linux.overlayfs`, `linux.seccomp`, `linux.pid1`, `linux.isolation-sum`. Module numbering is set by the block documents (the isolation module is `linux.m15`). The notation L0/L1/L2 in block documents reads as "Beginner/Intermediate/Experienced"; in data it is `beginner/intermediate/experienced`. We are not doing a bulk replacement: in the networking documents "L2" means an OSI model layer. **Edit:** in `01` §6.2 the isolation module was renamed to `linux.m15` and a note about codes was added.

### 10.2. Content decisions

| # | Conflict | Decision | Edit |
|---|---|---|---|
| 1 | Networking from the machine's point of view and SSH. `02` removed the networking module and placed SSH (M16) after module N5 of "Networks"; `01` keeps `linux.net-commands`, `linux.ssh-basic`, `linux.vps` in Linux; `03` relies on "L14 network" and "L15 SSH" from Linux and only deepens them | The `01` and `03` variant is adopted. M16 "Networking from the machine's point of view and SSH" is the last Linux module before "Networks": observation commands with everyday definitions and SSH as a user; models are introduced only by the "Networks" block via the `deepens:` link; SSH as a protocol is in `net.m12` | `02` §5.1: the M16 row rewritten, M17 added, the paragraph on the place of networking and SSH replaced, a note on the "What is no longer in the block" paragraph |
| 2 | Cloud VM: `01` — L44 in Linux; `02` has no module; `10` §10 refers to "K31 at the end of the Networks block" | Module M17 "Your own machine in the cloud" (`linux.vps`) at the end of Linux, core for everyone | `02` §5.1 — the M17 row; `10` §10 — references to K31 replaced with `linux.vps` |
| 3 | Kubernetes stage 3: `01` — mandatory for everyone, after IaC; `05` — "L0 optional", separate passes R3 in the Kubernetes block and R3-iac after IaC; `06` B3 — levels L1 and L2 only | One pass for all levels in block B3 after IaC; kubeadm once by hand is step 3 inside B3. Beginner — the full checklist with ready-made roles and S0–S1 support, intermediate — a scaffold, experienced — from scratch | `05` §0 item 10, the §4.1 table (KM15), the §11.1 table; `06` §6.1 |
| 4 | Final exam: `10` — k3s for L0 and L1, kubeadm for L2 — while kubeadm is mandatory for everyone in B3 | Left as in `10`: everyone has already built kubeadm in B3, the final exam checks the whole system and must fit in one session; the experienced learner additionally takes kubeadm operations | — |
| 5 | Qualifying exam: `01` — one core exam for all levels; `10` §6.1 allowed "a separate exam per level"; `05` — exams B/I/E by level | One qualifying core exam; the levels' practice exams do not go into the transcript; in Kubernetes the qualifying exam is assembled from B and I, exam E is part of `pro` | `10` §0 item 8 and the "Levels" row in §6.1; `05` §10 — the "Which exam is qualifying" paragraph |
| 6 | Share of tasks outside the course on the exam: `01` — 10–25%; `10` — a minimum of 10/15/20% by level and "10–20%" in §0; `08` and `09` — 20–30% | 10–25% of the weight with a minimum of 10/15/20% for beginner, intermediate and experienced; up to 30% in the Kubernetes `pro` part (modeled on the CKA). For breakage trainers and the block quiz, 20–30% `beyond_course` remains (`10` §3.6) — this is a different measure | `10` §0 item 8; `08` §4.1; `09` §2.6 |
| 7 | Exam timer: `10` §0 — "hard for L1/L2", `10` §6.1 and the changes section — soft by default | Soft; hard only in certifiable exams, the "On-call shift" and part B of the final exam | `10` §0 item 8 |
| 8 | Own controller (R10): `01` — core in bash, TypeScript in the extension tier; `05` — TypeScript for everyone, L0 adds three lines | Core — a bash loop in the Stand on top of kube-lite (the learner knows bash, JavaScript is not introduced in the course, otherwise the ordering rule is broken); TypeScript in QuickJS — `plus` and `pro` with a check for lost events; a Go operator — pet project 8 | `05` §6.3, screen 5a |
| 9 | Schedule of career modules: `01` §5 — self-presentation after containers, mock interview after stage 2; `10` §9 — self-presentation after the first pet project, mock interview after the networking situational question | The `10` schedule is adopted (the owner of the career block): self-presentation needs material, and a mock interview on a networking question is legitimate before Kubernetes | `01` §5 |
| 10 | The place of YAML: `01` — the "Git and YAML" segment after Linux; `06` — Y1 inside Linux after scripts and YAML traps at the start of CI/CD; `02` — YAML handed over to `06` | Y1 and YAML traps are in segment 2a together with G-local, right after Linux: the first consumer is the compose files of the containers block; JSON and `jq` stay in Linux (M9). The lesson text is written by `06` §2.7 | — |
| 11 | Time per block: `01` — 21/13/8 h for methodology and 52/34/20 for networks; `07` — 14/8/5; `03` — 50/32/15 | The formula in `01` §15 is canonical, and the interface shows what the build generates; block estimates are input for calibration after 50 learners | — |
| 12 | `rm -rf /`, DORA, Endpoints and IPVS in different editions | Already reconciled in `01` (the changes section): `--preserve-root`, five DORA metrics, EndpointSlice, IPVS deprecated since v1.35, without an exact removal date | — |

### 10.3. Platform decisions

| # | Conflict | Decision | Edit |
|---|---|---|---|
| 13 | Switch: `02`, `03`, `05`, `08` call it `vswitch`, `09` — `dt-switch`; `05` places it in the main thread, `09` in a separate worker | The implementation is `dt-switch` in `net.worker.ts` (`09` §1.7), `vswitch` is the name of the diagram widget (`08` §3.17) | `05` §5.2 (diagram), §5.9 (diagram and the paragraph about the switch) |
| 14 | Node agent: `04` — the hybrid node calls `box`; `05` and `09` — the Go agent `dt-kubelet` does netns, veth and `crun` itself | `dt-kubelet` (Go) parses the assignments and keeps the bookkeeping, and creates the sandbox, image and container through `box` under the `04` §10.2 contract; that way the phrase "kubelet asks the runtime to do what you did by hand" is literal | `05` §5.9 — the paragraph before the operations table |
| 15 | Agents on VMs: `03`, `05`, `10` use `trainer-check enroll`, "the Go binary trainer-check"; `09` split it into `trainer-check.sh` (read-only) and `trainer-exam` (breakages and signatures) | The `09` §5.4 split is adopted | `03` §17 (part B), `05` §11.5, `10` §0 item 11 |
| 16 | Resource labels: `01` — `dt-lab=<code>`, `03` — `dt-exam=net`, `06` and `10` — `trainer=devops`, `09` — `dt-track` and `dt-owner` | All course resources — `trainer=devops` and `dt-track=<track>` (plus `dt-owner` in the course's Terraform modules) | `01` §7.4, `03` §17, `09` §5.7 |
| 17 | ClusterIP address in examples: `01` — `10.96.12.7`, the course address plan (`09` §1.7, `05` §5.9) — Services in `10.43.0.0/16` | `10.43.12.7`, as in the hybrid and the k3d golden recordings. `10.96…` is left in the lab examples of the "Networks" block: there it is not a cluster | `01` §9.3.4, §13.2 |
| 18 | Mentor mode names: `01` — `explain/practice/docs/free/exam/review`; `08` — `learn/lab/docs-coach/exit`; `05` and `10` — `docs-coach`, `hint_policy: point-to-docs` | The names from `01` §16.1 (`09` adopted them too) | `05` §7.3, §7.7, §12, §17; `08` §3.21, §4.3, §4.4; `10` §3.4 |
| 19 | A ready-made solution command: `05` §12 — "after `n−1` opened hints"; `01` — there is no ready-made solution at any rung | There is no solution at any rung; a review with the reference path only after three failures or "I give up" | `05` §12 |
| 20 | Tab memory with three nodes: `08` — 1.5 GB; `05` and `09` — 900 MB | A 900 MB budget, 1.5 GB is the emergency ceiling with a switch to `sim` | `08` §8, §12 |
| 21 | v86 on a phone: `02` and `03` — does not run; `01`, `05`, `09` — one machine | One `lab-node` (64–96 MB) on a button press, without autostart; `lab-debian` and multi-machine labs do not run on a phone (`09` §1.4, §1.7) | — |
| 22 | Diagram label font: `03` and `07` — IBM Plex Sans; `08` — Inter | Inter (`08` §6.4 — the owner of the visual language) | `03` §6, `07` §5.1 |
| 23 | "How the trainer checks": P4 in `09` §1.12 and C-1 in `10` §5.2 are the same explanation | One explanation: screens — `10`, model and data — `09` | `09` §1.12, `10` §5.2 |
| 24 | `08` in its "what needs fixing" list and `07` in its open questions assume that `08` §5.1 still allows ink and characters | Already removed: `08` §0, §2, §6.1 forbid ink, characters and storyline; `01` CL9 — the same. No edits needed | — |
| 25 | Hybrid node in `01` §13.4 and `08` — "64–128 MB", in `05` and `09` — 96 MB | 96 MB by default, 64 MB as a fallback, 128 MB only for `lab-debian` in two-machine Linux labs | — |

### 10.4. What was changed in the documents

- `01-andragogy.md`: §5 — the schedule of career modules per `10` §9; §6.2 — the isolation module `linux.m15` and the note about codes; §7.4 — labels `trainer=devops` and `dt-track`; §9.3.4 and §13.2 — ClusterIP `10.43.12.7`.
- `02-linux.md`: §5.1 — M16 "Networking from the machine's point of view and SSH" before the "Networks" block, a new row M17 "Your own machine in the cloud", the paragraph on the place of networking and SSH, a note on the paragraph about the removed module.
- `03-networks.md`: §6 — Inter as the label font; §17 part B — `trainer-exam enroll` and `farewell`, labels `trainer=devops` and `dt-track=net-b`.
- `05-kubernetes.md`: §0 item 10, §4.1 (KM15), §11.1 — stage 3 is mandatory for everyone and is taken in B3 after IaC; §5.2 and §5.9 — `dt-switch` in `net.worker.ts`, `vswitch` as a widget; §5.9 — `dt-kubelet` works through `box`; §6.3 screen 5a — a bash loop in the core, TypeScript in the extension tier; §7.3, §7.7, §12 and §17 — `docs` mode, the `01` mode names, no ready-made solution command; §10 — the qualifying exam from B and I, E as `pro`; §11.5 — the two `09` checkers.
- `06-iac-cicd-monitoring.md`: §6.1 — the "Beginner" level in B3.
- `07-methodology-kanban.md`: §5.1 — Inter as the label font.
- `08-multimedia-engine.md`: §3.21 — the `01` mode names; §4.1 — the share of tasks outside the course; §4.3 and §4.4 — `docs` mode; §8 and §12 — a 900 MB memory budget with a 1.5 GB ceiling.
- `09-runtime-ai-architecture.md`: §1.12 — P4 merged with C-1; §2.6 — the share of tasks outside the course; §5.7 — the `trainer=devops` label.
- `10-assessment-career.md`: §0 item 8 — the share of tasks outside the course, the timer, one qualifying exam; §0 item 11 — `trainer-check.sh` and `trainer-exam`; §3.4 — `docs` mode; §5.2 — C-1 merged with P4; §6.1 — the "Levels" row; §10 — `linux.vps` instead of K31.

The changes were made in the working copies and are not committed.
