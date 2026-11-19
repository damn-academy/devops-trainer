# 10. Assessment, exams and the career block

Document for the role "assessment specialist + DevOps hiring manager / career coach". It designs five things: the assessment system for the whole course (task types, the bank, mastery, spaced repetition, the documentation ladder and process explanations as subjects of assessment, practical exams, the cross-block on-call shift, the final exam, an honest position on AI), sample tasks for the eight blocks, the process explanations of assessment itself and of the career block, the career block for steps 8–11 of the checklist (pet projects, interview preparation, mock interviews, applications) and a consolidated list of sources. Date of design and of the second revision: 18.11.2026; links in section 12 were checked on that day.

The document relies on the decisions of the neighbouring documents and does not redefine them: the learner model, levels L0/L1/L2, the concept graph, FSRS and the "confidence" rule are in `01-andragogy.md`; question widgets (`choice`, `order`, `match`, `hotspot`, `predict`, `fill`, `explain`, `task`), explanation primitives (`diagram`, `stepper`, `breakit`, `packets`, `lenses`) and `when` selectors are in `08-multimedia-engine.md`, sections 3 and 7.5; the "facts → predicates" check contract (`dt.facts/v1`, the predicate language, `goals`, `probe`, `CheckResult`), environment tiers A/B/C, `dt-api`, the `trainer-check` agent and proctored (presented) exams are in `09-runtime-ai-architecture.md`, sections 1, 2, 4.7 and 5; the check types of `06`, section 0.4 (`yaml_path`, `lint`, `run`, `idempotent`, `plan_expect`, `promql_equiv`, `forbid`) are special cases of the `09` contract; the hybrid kube-lite + v86 cluster (`lab-node`, `dt-kubelet`, `vswitch`) and the real tracks are in `05-kubernetes.md`, sections 5.9 and 10. Here all of this is brought together into a single bank and a single exam frame, and whatever is missing is added.

## 0. Key decisions in one place

1. **Assessment rests on the course's three pillars and checks them explicitly** (owner requirement R1). The textbook, process explanations and the habit of reading documentation are the core; practice stands on them. So each of the three has its own subject of assessment: concepts — quizzes and spaced repetition; explanations — `scene` tasks (section 2.3); documentation — `docanatomy`, `docfind` and `beyond_course` tasks (section 3.6). A module is not closed and a block exam does not open until all three pillars are passed (section 4.3).
2. **Skill is assessed, not text.** Everything that can be checked from the state of the environment (files, processes, cgroups, ports, HTTP responses, Kubernetes objects, Terraform state, pipeline status, explanation state) is checked from `dt.facts/v1` facts with a `09` predicate. Text answers appear only where an explanation is being checked, and they do not count toward the exam pass score.
3. **The quiz teaches, the exam measures.** Quizzes and repetition are low-stakes, with immediate feedback and retries without penalty (the testing effect, `01`, section 1). Exams have a timer, a variant from a seed, no built-in mentor, open official documentation, and a report.
4. **Every wrong answer option is a recorded misconception.** Every distractor links to an entry in the `misconceptions.yaml` catalogue and has an explanation in two languages; a mistake immediately says *what exactly* the learner thinks wrongly and puts the relevant concept into repetition.
5. **The bank is parameterised.** A task has 3–5 variants (names, ports, addresses, the cause of the failure); `predict` and `scene` tasks get their reference answer by running the simulator or the explanation itself in CI, so the reference never diverges from what the learner will see.
6. **Mastery is per concept, not per lesson.** A module is closed when the module's final check is ≥ 80% on the first attempt, all key tasks are done, the `scene` tasks of the module's process explanation are solved and the task for the module's documentation step is done. A concept becomes `mastered` after a delayed repetition in a different format (`01`, section 2.2). The 80% threshold is the lower bound of Bloom's mastery learning (80–90%): an adult career changer gets stuck at 90% and quits, and the gap is caught by repetition anyway.
7. **The documentation ladder is measured per block.** Five steps (glimpse → highlighted fragment → "find the flag" → tasks without theory and a mentor asking "where did you look?" → an exam with only the official documentation) are built into quizzes, trainers and exams; L0 starts at the first step, L1 at the second, L2 at the third. The concept order rule is not broken: commands and flags may run ahead, concepts may not (section 2.5).
8. **A block exam is a common frame with declared per-block deviations** (section 6.1). Mandatory for all: checks by facts via any path, `critical` and `forbid`, documentation step 5, 10–25% of the weight on out-of-course tasks (minimum 10/15/20% for L0/L1/L2), explanations as a separate "interview readiness" mark with weight 0 in the pass, a soft timer (a hard one only in presented exams, the "On-call shift" and part B of the final exam), a retake after 24 hours with a new variant. The credit exam of a block is the same for all levels and checks the core (`01`, section 3.3); learning exams per level and the `plus`/`pro` parts are defined by the block itself. Duration and threshold (66–85%) are set by the block roles.
9. **The cross-block exam "On-call shift"** runs in the course's hybrid environment: the control plane is kube-lite, two nodes are real v86 machines with `dt-kubelet` and `crun`, the shop server is a third v86 machine, monitoring is a simulator that reads facts from the real machines. Incidents arrive overlapping, and the on-call board has a WIP limit of 1. There is no k3s in the browser, and the document does not mention it as an environment.
10. **The final exam is on three real VMs**, which the learner orders with Terraform and configures with Ansible: L0 and L1 — a three-node k3s, L2 — kubeadm with Cilium, an etcd snapshot, a version upgrade and certificate checks (the third Kubernetes step, owner requirement R12). The trainer executes nothing on the VMs itself: it guides step by step, shows the cost and checks with the agent. The cleanup step is mandatory: the report is not issued until the VMs are deleted.
11. **Two authenticity modes, as in `09`, section 5.4.** *Self-check* (your own clouds, no server): `trainer-check.sh run --nonce` only reads the system, and the report is marked "self-check". *Presented exam* (the learner's machine in their own cloud or on their own computer, registered with `trainer-exam enroll`): failures are injected by the `trainer-exam` agent from a signed package, time is counted by `dt-api`, the result is signed with Ed25519, and the report can be verified by a third party via a link. In both modes the report is not a certificate.
12. **An honest position on AI.** We do not control external AI and do not pretend to: there will be no proctoring, no tab tracking and no "AI detectors". The learner chooses "exam" (word of honour: only the built-in documentation; closes the block) or "training" (any assistants; full debrief, does not close the block). The built-in mentor is always off during an exam.
13. **The mock interviewer is the learner's own neural network.** Voice is the Web Speech API with an `available({quality: "conversation"})` check and installation of a local package; fallback recognition is Whisper in the browser. Scoring uses the product's single rubric `criteria[{id, score, evidence}]`; a score without a quote that fuzzily matches the transcript is reset. The DeepSeek API accepts requests directly from the browser: on 18.11.2026 a CORS preflight request to `https://api.deepseek.com/chat/completions` returned `access-control-allow-origin` with our origin.
14. **The career block is trainers with checks, not advice:** a "command → logic" translator with confirmation from documentation, situational-question drills in a sandbox with the "named the layer" criterion, a self-presentation trainer with measurement, a résumé builder with a linter, a job posting analyser using the 60% rule, an application funnel as a flow board. Everything the learner writes, they write themselves; the neural network only reviews what was written against a rubric (`01`, section 14.3).
15. **Pet projects: nine projects (eight from the checklist plus a kubeadm cluster as 7b) with measurable acceptance criteria, agent checks, cost display and cleanup.** A beginner must do four, an intermediate six, an experienced learner five plus kubeadm; all paths converge in the final exam.

## 1. What exactly we measure

A junior's employer, according to our hiring experience and public descriptions of hiring processes (KTS, DOU, Habr, section 9.5), checks five things: whether the person understands the mechanism rather than remembering commands; whether they can act in an unfamiliar failure; whether they can explain what they did; whether they can find an answer in the documentation on their own when they were not taught it; whether they are honest about the limits of their knowledge. Hence five dimensions that the product tracks for every block:

| Dimension | Measured by | Where the learner sees it |
|---|---|---|
| Knowledge and understanding of the mechanism | Quizzes and repetition (`choice`, `order`, `match`, `predict`, `hotspot`, `label`) and `scene` tasks on process explanations | The block's concept map: `introduced` → `practicing` → `mastered`; each explanation has a "predicted the process" mark |
| Ability to act | `task`, `fill`, `bugfind`, failure trainers, practical exams | A "practice passed" mark per module and block |
| Working with documentation | `docanatomy`, `docfind`, `beyond_course` tasks; the share of out-of-course exam tasks solved with documentation; the log of opened pages (`doc_open`) | The documentation ladder step per block (1–5) and a "documentation passport": which sources the learner has already opened on their own (man, `--help`, `kubectl explain`, docs.docker.com, kubernetes.io, developer.hashicorp.com, docs.ansible.com, prometheus.io) and how quickly they found the answer |
| Explanation | `explain` against a rubric, the exam debrief, mock interviews | An "interview readiness" mark per block |
| Calibration | Confidence with every answer (`01`, section 4.1) | A weekly chart: "when you said 'I know', you were right N% of the time" |

Calibration is not a bonus: without calibrated self-assessment a person will not say in an interview "I don't know, but I would find out like this: I'd open `man ss`, the FILTER section", and that is one of the most valued answers from a junior (checklist, section 2; rubric — section 9.3). Working with documentation and calibration are directly linked: the "honesty" rubric gives the top score only when the learner named a specific source and the place in it.

## 2. Task types and authoring rules

### 2.1. Types

Eight question widgets are defined by the engine (`08`, section 3.8). Assessment needs five more types. `bugfind` and `label` are built on existing widgets; `docanatomy` and `docfind` on the built-in documentation viewer; `scene` on the explanation primitives `stepper`, `diagram`, `breakit`, `packets` (`08`, sections 3.1–3.6). None of the new types requires new simulator code.

| Type | What it checks | How it is checked automatically | Example |
|---|---|---|---|
| `choice` (`multi: false/true`) | Telling similar things apart, understanding the mechanism | The set of chosen options; an explanation for each wrong one | "nginx returned 504. What is most likely?" |
| `order` | The sequence of a process | A permutation; partial credit for the longest correct subsequence | Steps from `kubectl apply` to a running container |
| `match` | The "element ↔ role" link | A set of pairs; partial credit per pair | Control plane component ↔ what it is responsible for |
| `fill` (command or number) | Ability to formulate a command | Not by string: the command runs in a copy of the environment and its effect is checked by facts; a number is checked with a tolerance | "Show the ssh service log for the last hour" |
| `predict` | A model of system behaviour | Comparison with the simulator output after normalisation (whitespace, PIDs, time) | "What will `ls -l` print after `chmod 640`?" |
| `bugfind` (new) | Reading configuration, finding a defect | Two steps: click on a line (`hotspot` by line number) and fix in the editor; the fix is checked by a linter and a run (`lint`, `run`, `yaml_path`), not by text comparison | A Dockerfile that reinstalls dependencies every time |
| `label` (new) | Knowing the structure on a diagram | Drag labels onto diagram nodes; a set of `label → node.id` pairs (implemented as `match` where the right side is `diagram` nodes) | Label the container diagram: namespaces, cgroups, overlay |
| `hotspot` | Localisation on a diagram | Hitting a `node.id` | "Where does NAT happen here?" |
| `scene` (new, 2.3) | A model of the process: the learner drives the explanation | The explanation is put into an initial state; the learner predicts, then moves a parameter, breaks a component or scrubs through steps to the target condition; the condition is a predicate over the explanation state | "Choose `maxSurge` and `maxUnavailable` so that with 4 replicas there are never fewer than 4 ready pods at any moment" |
| `docanatomy` (new, step 2) | Knowing the structure of a documentation page | A fragment of a real page from the course mirror is shown; click on a section (`hotspot` by `section.id`: NAME, SYNOPSIS, DESCRIPTION, OPTIONS, EXIT STATUS, EXAMPLES, SEE ALSO; for kubernetes.io — Concepts / Tasks / Reference; for `kubectl explain` — FIELDS, the `<Object>`/`<string>` type, `-required-`) or on the line with the needed flag | "On the `ss(8)` page, click the line that explains how to show the process that owns a socket" → `-p, --processes` |
| `docfind` (new, step 3) | Ability to find a flag or field on one's own | Only a link to the page is given (a button opens the built-in viewer, the page is not highlighted, searching within it is allowed). The answer is a command or a field, checked by effect, like `fill`. The log records whether the page was opened and after how many seconds the answer was found | "Find in `man journalctl` how to show only entries from the previous boot" → effect: a journal query with `boot=-1` |
| `explain` | Explanation in one's own words | A rubric with key points; the learner's neural network scores with quotes; without a neural network — self-check against a checklist of points. Does not count toward the exam pass score | "Why is a container not a virtual machine?" |
| `task` | Practical skill | `goals` under the `09` contract, 2.4 (`when`, `keep`, `fail`, and `probe` on tiers B and C when needed) | "Fix the service so that `curl` returns 200" |
| `scenario` (exam) | Acting within a coherent storyline under a timer | A set of `task`s with weights, criticality and a shared timer (section 6) | The "On-call shift" exam |

Of the `06` and `09` checks, assessment needs one more: **`warn`** — "count it, but flag it in the debrief". In the meaning of `06` and `09`, `forbid` means "not counted", so outdated but working syntax (`only/except` in GitLab CI, `netstat` instead of `ss`) goes through `warn: { when: "…", say: {ru, en} }`.

### 2.2. The `scene` task format and the prediction rule

A `scene` task refers to a process explanation (`scene: k8s.rolling-update`), puts it into an initial state (`set`, `step`) and sets a subtype:

| Subtype | What the learner does | How it is checked |
|---|---|---|
| `next` | Points to which block or arrow will light up next | `hotspot` by `node.id` |
| `param` | Moves a slider or switch to the value at which the named condition occurs | A predicate over the explanation state (`scene.state.minReady>=4`) |
| `break` | Sees the explanation with a component removed and chooses the symptom or clicks the place of the first error | `choice` or `hotspot` |
| `scrub` | Scrubs through steps and stops at the step where the named event occurs | `scene.step = 'mitigated'` |

The rule without which `scene` turns into a slider game: **before manipulating, the learner commits a prediction** (`predict` — a number, a choice or a click), and only the combination "prediction correct on the first attempt + condition reached" counts. If the prediction is wrong and the condition is reached by trial and error, the task counts as training (Good is not set in FSRS, Hard is), and the debrief shows the difference between the predicted and the computed value. The `scene` reference answer is obtained by running the explanation in CI, just like for `predict`.

```yaml
id: net.dns-resolution.s03
kind: scene
scene: net.dns-resolution          # the "how a name is resolved" explanation (03)
subkind: param
level: [L0, L1, L2]
concepts: [c:N08, c:N09]
set: { cache: warm, ttl_s: 300, changed_at: "12:00" }
predict: { kind: choice, ru: "Когда резолвер провайдера отдаст новый адрес?", options: [сразу, через-остаток-TTL, через-24-часа], answer: через-остаток-TTL }
q:
  ru: "Администратор сменил A-запись shop.example в 12:00. Передвиньте ползунок «время запроса» на первый момент, когда резолвер провайдера гарантированно отдаст новый адрес."
  en: "The admin changed the A record of shop.example at 12:00. Move the 'query time' slider to the first moment the ISP resolver is guaranteed to return the new address."
answer: { when: "scene.t >= scene.cached_at + scene.ttl_s" }
options_why:
  early: { misconception: net.dns-change-instant, ru: "Резолвер отдаёт копию из кэша, пока не истёк TTL; смена записи на авторитативном сервере не видна сразу." }
```

### 2.3. The explanation coverage rule

Every process explanation from the list of owner requirement R3 (section 3.7) must have at least two `scene` tasks of different subtypes and one `order` task on its steps; at least one `scene` is part of the block quiz. The build checks this in the same way as the "≥ 3 tasks of three types per concept" rule and does not build the block without them. The tasks are written by the block roles together with the explanation's storyboard; the list of minimum tasks is in section 3.7.

### 2.4. Authoring rules checked by the content linter

The build fails if any rule is violated. **The samples in this document are run through the same linter in CI** as the bank: the first revision contained Docker and Kubernetes terms in the methodology quiz, and this rule closes that kind of error for good.

- **Distractors are plausible and diagnostic.** Every wrong option links to a `misconception` in the catalogue. The options "all of the above" and "none of the above" are forbidden: they test test-taking skill, not DevOps.
- **Length does not give the answer away.** Across the whole bank, the correct option must not be the longest in more than 35% of questions; the position of the correct option is shuffled on display.
- **Concept order** — section 2.5.
- **The network layer is mandatory.** Tasks in the "Networks" block and network tasks in Docker and Kubernetes have a `layer: L1 | L2 | L3 | L4 | L6 | L7 | mixed` field; using it, the debrief says "the cause was at L4", and progress shows at which layer the learner makes mistakes more often.
- **An explanation for every answer.** Every option has a `why` in two languages; a generic "wrong" is forbidden.
- **A fact comes with a source.** Statements in the debrief link to a source from the log (`sources:`); under the Sankofa two-source rule, a disputed fact is marked `hold: true` and does not get into the build.
- **Freshness of market data.** Salaries, channel member counts, internship deadlines older than 6 months at build date are a warning, older than 12 months an error.
- **Two languages at once.** A task without `en` or `ru` does not get into the build; options in `predict` and `fill` are language-independent.

### 2.5. Concept order and the documentation ladder

A task is shown when all of its `concepts` are at least `introduced` or `placed` for the learner (`01`, section 6). The task text, the options and the debrief go through the same vocabulary linter as lessons: the word "pod" cannot slip into a Linux module question, and "image" or "registry" cannot slip into the methodology quiz.

Steps 4 and 5 of the documentation ladder require the opposite: commands that were not in the theory. The contradiction is resolved by separating **concepts** from **tools**:

> **Concepts always obey the graph. Commands, flags, API fields and functions are not concepts.** A task with `beyond_course: true` may require a command, flag, field or function that is not in any lesson, under three conditions: (1) the task has a `doc_ref` — the exact address of the answer (`man:journalctl(1)#--list-boots`, `kubectl explain pod.spec.terminationGracePeriodSeconds`, `https://kubernetes.io/docs/…#anchor`), and this address exists in the documentation mirror of the current course version; (2) all *concepts* needed to understand the found line have already been introduced (example: the concept "systemd unit" is introduced, the flag `systemctl --failed` is not; this is allowed); (3) the task has a `doc_step` (4 or 5) and `doc_allowed` — a list of sources where to search. The word the learner must find is listed in `discover: ["--failed"]` and is not passed to the vocabulary linter. The task text does not contain word forms of concepts that have not been introduced. A `doc_ref` that is not in the mirror fails the build.

Identifiers in the bank are written with a namespace, because blocks have their own module numbers that coincide with concept numbers in the graph (`N14` is the HTTP concept in the `01` graph and the VPN module in `03`):

| What | Notation | Example |
|---|---|---|
| A concept of the `01` graph | `c:<ID>`; in the `concepts` field the prefix is implied | `c:N14`, `concepts: [N14]` |
| A module of a block document | `m:<block>/<block module ID>` | `m:networks/N14`, `m:linux/L13` |
| A real track of `05` | `track:k8s/<id>` | `track:k8s/r3` |
| A process explanation | `scene:<block>.<slug>` | `scene:k8s.rolling-update` |
| An owner requirement | only in prose: "owner requirement R2" | — |

The `module` field of a task is only `m:`, and `remedy` in the misconception catalogue is only concepts. New concepts that this revision uses before the `01` graph is updated are marked as provisional: L33 stream, L34 namespaces, L35 cgroups v2, L36 capabilities, L37 overlayfs and chroot, L38 seccomp (idea), L39 file descriptor and `/proc/<pid>/fd`; N22 tunnel and WireGuard, N23 packet capture (`tcpdump`); K40 pod network model, K41 EndpointSlice, K42 NetworkPolicy, K43 Ingress and Gateway API. The `01` role moves into Linux the isolation concepts that used to belong to Docker (D03–D05), and moves "cloud VM" (K31) to the end of the "Networks" block; the references in this document already follow the new order.

## 3. The task bank

### 3.1. Where it lives and how it is organised

```
content/
  bank/
    misconceptions.yaml          # misconception catalogue shared by all blocks
    rubrics/                     # single rubric schema (3.1, section 11)
      explain-default.yaml
      interview.yaml
      incident.yaml              # incident status and post-mortem, shared with 07
    docs/
      snapshot.yaml              # docs.snapshot (09): documentation mirror of the course version — sources, pages, anchors
    linux/
      m-L11-permissions/         # bank/<block>/<block module ID>-<slug>/
        q01.yaml … q12.yaml
      exam/
        exam-linux.yaml
    networks/ docker/ kubernetes/ iac/ cicd/ monitoring/ methodology/ career/
  exams/
    oncall-shift.yaml            # cross-block exam "On-call shift"
    capstone.yaml
```

This document is the canonical task format. The build converts the block formats (`03`, section 8.3; `04`, section 11.4; `05`, section 13) into the canonical one using a mapping table, and block authors write new tasks directly in the canonical format:

| Blocks (`03` and others) | Canonical |
|---|---|
| `single` / `multi` | `choice` with `multi: false/true` |
| `number` | `fill` with `answer.number` and a tolerance |
| `command` | `fill` (by effect) |
| `text` | `explain` |
| `capture` | `hotspot` on a frame or field of the packet viewer (`target: capture`) |
| `lab` | `task` |
| `beginner / intermediate / experienced` | `L0 / L1 / L2` |
| `entry: true` | `purpose: [entry]` |
| `concepts: [slug]` | `concepts: [graph ID]`; slugs only as `subconcepts`, the build requires a slug-to-ID mapping |

One task record (fields that are new relative to `01`, section 4.2, are marked):

```yaml
id: docker.d08.q04
block: docker
module: m:docker/D3                 # module of the block document
level: [L0, L1, L2]
level_variants:                     # new: a separate variant for L2 so an experienced learner does not solve a beginner's task
  L2: { q: { ru: "В этом Dockerfile две ошибки, из-за которых сборка медленная и образ большой. Найдите обе.", en: "..." }, doc_step: 3 }
kind: bugfind
key: false
purpose: [module-check, review, interview]   # new: where the task may appear
concepts: [D08, D16]                # layers and build cache
bloom: analyze                      # new: remember | understand | apply | analyze | evaluate
difficulty: 3                       # new: author's estimate 1–5, refined by statistics (3.3)
time_norm_s: 90
doc_step: 2                         # new: documentation step the task is written for
doc_ref: "docs.docker.com/build/cache/#order-your-layers"   # new: where this is in the documentation (steps 1–2 show the link in the debrief)
q:
  ru: "Сборка этого образа идёт 4 минуты после любой правки в коде. Найдите строку, из-за которой так происходит, и исправьте файл."
  en: "Building this image takes 4 minutes after any code change. Find the line that causes it and fix the file."
file:
  path: Dockerfile
  content: |
    FROM node:22-alpine
    WORKDIR /app
    COPY . .
    RUN npm ci
    CMD ["node", "server.js"]
answer:
  line: 3
  check:
    - lint: dockerfile                     # DL3xxx rule set in TypeScript, cross-checked against hadolint in CI (section 13)
    - run: { build: 2, touch: server.js }  # build, change server.js, build again
      expect: { layer_cached: "RUN npm ci" }
options_why:
  1: { misconception: docker.base-image-slow, ru: "Базовый образ скачивается один раз и потом берётся из кэша." }
  4: { misconception: docker.npm-ci-is-slow, ru: "npm ci медленный, но выполнялся бы из кэша, если бы перед ним не менялся слой." }
  5: { misconception: docker.cmd-runs-at-build, ru: "CMD не выполняется при сборке, он задаёт команду запуска контейнера." }
variants:
  - { base: "node:22-alpine", deps: "npm ci", manifest: "package*.json" }
  - { base: "python:3.13-slim", deps: "pip install -r requirements.txt", manifest: "requirements.txt" }
  - { base: "golang:1.25", deps: "go mod download", manifest: "go.mod go.sum" }
sources: [docker-build-cache, docker-multistage]
ai_context: "The learner knows layers and cache; multi-stage builds have not been introduced yet — do not mention them."
```

A misconception catalogue record (with a network layer):

```yaml
- id: net.504-means-app-down
  block: networks
  layer: L7
  ru: "504 значит, что приложение не запущено"
  en: "504 means the application is not running"
  truth: { ru: "Не запущенное приложение обычно даёт 502 (соединение отклонено). 504 — прокси дождался таймаута: приложение не ответило вовремя или соединение не установилось.", en: "..." }
  remedy: [N14, N19]            # graph concepts that are put into repetition
```

A mistake tied to a misconception writes a `misconception` event to the event log (event format — `01`, section 2.3), and the error review on the progress screen is grouped by misconception, not by question number: "You confused 502 and 504 three times" is more useful than "questions 4, 11, 17".

### 3.2. Volume and coverage

Each module has at least 8 tasks with variants: 2 entry tasks (`entry`), 4–5 final ones, 2 for repetition in a different format; plus `scene` tasks on the module's explanations (2.3) and documentation step tasks (3.6). With 195 concepts this is about 1,700 tasks and 5,500 variants. Coverage is checked by the build: each concept must have at least three tasks of three different types, otherwise FSRS will show the same thing and the learner will memorise the answer rather than the concept. A generator (`kind: generated`, for example `generator: flowlab.little` in methodology or `generator: subnet` in networks) counts as N tasks, where N is the number of distinguishable answer types, but no more than 4. Tasks with `purpose: interview` (about 300) also serve as the mock interviewer's pool (section 9.3).

### 3.3. Difficulty and statistics

The author's difficulty 1–5 is set when writing and is used for selection at the start. Empirical indicators — the share of correct first-attempt answers (p) and discrimination (point-biserial correlation with the module result) — are computed from anonymised statistics: the learner turns on "help improve the questions", and once a day the browser sends `dt-api` an aggregate `{item, variant, first_try_correct, ms, confidence}` without identifiers. p is computed at n ≥ 30 first attempts per variant, the correlation at n ≥ 50; until then the task is marked "not enough data". A task with p > 0.95 is marked "too easy" (goes only to repetition), one with p < 0.25 or a negative correlation goes to the author for review: usually this is an ambiguous wording or an error in the key.

The entire server side of assessment is `dt-api` from `09`: presented exams (section 6.5), progress sync under `09`, section 3.4, if the learner has an account, and anonymised statistics with consent. By default, progress lives in the learner's browser.

### 3.4. Mastery and repetition

Concept states, transitions and FSRS (`ts-fsrs`, target retention 0.9, an Again/Hard/Good/Easy rating from correctness, hints, time and confidence) are defined in `01`, sections 2.2 and 10. Assessment adds six rules:

1. **A different format at each repetition.** A concept repetition takes a task of a different `kind` than last time, and a different variant. A concept whose correct answers were all obtained in one format does not move to `mastered`.
2. **Sandbox micro-tasks in repetition.** Once every three repetitions of a concept with a practical side, the repetition is not a question but a 30–90 second task in a mini-sandbox ("show who is listening on port 5432"). On a phone such cards are skipped and wait for a computer.
3. **A high-confidence misconception — repeat in the same session and the next day.** A mistake made with "I know" confidence puts the catalogue entry into a separate queue: after 10 minutes a task in a different format on the same misconception, the next day another one.
4. **The module's final check on the first attempt.** The first attempt goes into progress; you can retry immediately, but with a different variant, and the module is credited on the first attempt at ≥ 80% and all key tasks. If not passed, the product builds a list of concepts from the mistakes and gives a series of 10–15 minute trainers on them, followed by a new attempt.
5. **The documentation skill is repeated like a concept.** Each source has an FSRS skill card `doc.<source>` (`doc.man`, `doc.kubectl-explain`, `doc.docker-ref`…). A learner who has never opened `kubectl explain` on their own gets a `docfind` task specifically on it in repetition.
6. **"Where did you look?" mode** (the `docs` mentor mode, `01`, section 16.1). At step 4 of a block (3.6), for `beyond_course` tasks the built-in mentor first answers any question about the task with a question: "Where have you already looked? `man <command>`, `<command> --help`, `kubectl explain <resource>`, docs.docker.com, kubernetes.io?". If the learner names a source, the mentor says which *section* of that source to look in (OPTIONS, FIELDS, a reference section), but not the line. If not, it gives only the list of sources for this tool. At this step the mentor never gives a ready-made command, flag or field; this is checked in `ai-evals` (`09`, section 4.6) with a set of 20 attempts to "talk it into" breaking the block, passing is 20 out of 20.

### 3.5. Placement check

The principle, format and criteria of the placement check (≥ 80% and all key tasks, "guess" confidence does not count, a retake after 72 hours with a different variant, then a module-by-module bypass) and the substantive definitions of levels L0/L1/L2 are set in `01-andragogy.md`, section 4.3, and refined by the block roles (`03`, section 4; `05`, section 2). Assessment is responsible for making the placement check built from the same bank and the same types as the exams, and adds three requirements:

- **Every L1 and L2 placement check has at least two practical sandbox tasks, and they are key tasks.** A programmer answers theory confidently; the difference between "knows the words" and "can do it" is visible only in the terminal.
- **The L2 placement check has one key `docfind` task.** An experienced learner starts the documentation ladder at the third step, and the placement check must confirm that they really find the flag on their own.
- **Key tasks of the placement check never appear in quizzes of the same level.** Otherwise a learner who failed the check and went through the modules would recognise the tasks at the retake instead of showing skill.

The levels of the career block and its diagnostics are in section 9.1.

### 3.6. The documentation ladder in assessment

Owner requirement R2: a beginner cannot be sent to documentation from scratch, but at some point the course must make them go there. Assessment makes this measurable: each step has its own task type, its own hint and mentor behaviour and its own pass rule.

| Step | What the learner sees | Tasks | Hints | Mentor | Pass rule |
|---|---|---|---|---|---|
| 1. Glimpse | Under the debrief of every answer, a line "this comes from: `man 1 chmod`, DESCRIPTION section" with a link to the exact place in the mirror; it can be left unopened | Regular; `doc_ref` is shown in the debrief | Regular H1–H5 (`01`, section 9) | Regular | No effect |
| 2. Fragment | A second-level hint is a page fragment with a highlighted line and the section label | 1–2 `docanatomy` per module | A fragment instead of a retelling | Regular | `docanatomy` is part of the module result |
| 3. Find it yourself | Only a link to the page, nothing highlighted | ≥ 2 `docfind` per module | A link to the page | Names the section but not the flag | `docfind` are key tasks (`key: true`) in the module result |
| 4. Forces | The task requires a command or flag that was not in the theory | 20–30% of failure trainer and block quiz tasks are `beyond_course` | None | "Where did you look?" mode (3.4, rule 6) | The block quiz requires ≥ 1 solved `beyond_course`; for L2 one of them is a key task |
| 5. Exam | Only the official documentation is open in the built-in viewer | Exam tasks with `beyond_course: true` | None | Off | Out-of-course tasks are not `critical`; their weight: L0 — 10%, L1 — 15%, L2 — 20% of practice |

**Start and progression by level.** L0 starts each block at step 1: the first third of the modules is step 1, the second is 2, the third is 3, the block quiz is 4, the exam is 5. L1 starts at step 2: the first third is 2, the second is 3, the third and the block quiz are 4. L2 starts at step 3: the first third is 3, then 4. The step rises ahead of schedule when the learner solves two `docfind` or `beyond_course` tasks in a row without hints. There is no demotion: a learner stuck on `docfind` can open the step 2 hint as a *hint* (this lowers the FSRS rating to Hard), but their step does not roll back.

**The documentation mirror** (`docs.snapshot` of the `09` platform; in lessons links are stored in the `docs` field, the step 2 fragment in the `doc_hint` field, as in `04`, section 5). External pages cannot be embedded (the platform CSP `frame-src 'none'`, `09`, section 6.4), so the course keeps its own mirror for the course version, offline in the PWA, with the original anchors. This is not a limitation but a condition of measurement: the event log receives `{type: "doc_open", source, page, anchor, ms_to_answer, item}`, and the debrief says "you found the `--since` flag in 40 seconds in the OPTIONS section". Sources by block — also the list that is open during the block exam (step 5):

| Block | Sources in the mirror |
|---|---|
| Methodology | dora.dev/guides, sre.google (the SRE books and the Workbook), kanbanguides.org, scrumguides.org |
| Linux | man pages of the `lab-debian` image (`man-db` is in the image per `02`), `--help`, `/usr/share/doc`, man7.org: `namespaces(7)`, `cgroups(7)`, `capabilities(7)` |
| Networks | man (`ip`, `ip-route`, `ss`, `dig`, `nft`, `tcpdump`, `wg`, `tracepath`), MDN HTTP; for L2 — RFCs from rfc-editor.org |
| Containers | docs.docker.com (reference and manuals), compose-spec.io, man7.org (sections 1, 2, 7, 8: `unshare`, `nsenter`, `crun`, `namespaces(7)`, `capabilities(7)`), docs.kernel.org (cgroup-v2, overlayfs), github.com/opencontainers (image-spec, runtime-spec, distribution-spec) — the list in `04`, section 5.6 |
| CI/CD | docs.gitlab.com/ci/yaml, git-scm.com/docs |
| Kubernetes | kubernetes.io/docs and kubernetes.io/blog, helm.sh/docs, gateway-api.sigs.k8s.io, `kubectl explain`, `kubectl <command> --help` — exactly the list allowed in the CKA ([Linux Foundation, Resources Allowed](https://docs.linuxfoundation.org/tc-docs/certification/certification-resources-allowed), checked 18.11.2026; if the page changes, the list in the mirror changes with it) |
| IaC | developer.hashicorp.com/terraform (language, CLI, the course's provider), `terraform -help`, docs.ansible.com, `ansible-doc <module>` |
| Monitoring | prometheus.io/docs, `promtool --help`, grafana.com/docs |

**Ready-made tasks for steps 2–4 by block** (one per step; the reference answer and the effect are checked by facts):

| Block | Step 2 `docanatomy` | Step 3 `docfind` | Step 4 `beyond_course` (no hints) |
|---|---|---|---|
| Methodology | In the Kanban Guide, click the paragraph that lists the mandatory practices | "Find on dora.dev which group the failed deployment recovery time belongs to" → throughput; `doc_ref` is the anchor of the metrics page | "Find in the SRE Workbook which sections a sample postmortem has, and fill in our template for incident S6" → the template sections are filled in (checked by fields) |
| Linux | In `man 1 ls`, click the line of the option that sorts by modification time → `-t` in OPTIONS | "In `man find`, find how to search for files larger than 100 MB modified in the last 24 hours" → the output contains `/var/log/big.log` | "The `report` service crashes once an hour. Show all failed services with one command" → `systemctl --failed` or `list-units --state=failed`; "show processes sorted by memory with one `ps` command" → `ps aux --sort=-rss` |
| Networks | In `ss(8)`, click the line that shows the socket's process → `-p, --processes` | "In `man ss`, find how to show only established TCP connections to port 5432" → `ss -tn state established '( dport = :5432 )'` | "Find the path MTU to 10.0.2.9" → `tracepath` or `ping -M do -s <n>`; the number matches the netlab model |
| Containers | In the `docker run` reference, click the section that describes resource limits | "In the `docker run` reference, find how to limit a container to 50 processes" → `--pids-limit 50`; fact `cgroups[…].pids.max=50` | "The container must run with a read-only root, except `/tmp`" → `--read-only --tmpfs /tmp`; `mounts` facts |
| CI/CD | In the `.gitlab-ci.yml` reference, click the keyword that sets the conditions for running a job → `rules` | "Find how to run a job only when files in `docs/` change" → `rules: changes:` | "The `deploy` job must not start while the previous deployment is running" → `resource_group` |
| Kubernetes | In the output of `kubectl explain pod.spec.containers`, click the field marked `-required-` → `name` | "Using `kubectl explain`, find the field that forbids a container from running as root" → `securityContext.runAsNonRoot` | "The pod must terminate no later than 5 seconds after SIGTERM" → `terminationGracePeriodSeconds: 5`; "find which API resources support `patch`" → `kubectl api-resources -o wide` |
| IaC | On the provider's resource page, click the Argument Reference section | "Find the argument that prevents Terraform from deleting the VM" → `lifecycle { prevent_destroy = true }`; `plan_expect` for an error on `destroy` | "An Ansible task must run only on the first host of a group" → `run_once: true` |
| Monitoring | On the PromQL functions page, click the description of `rate` | "Find the function that predicts the value in 4 hours" → `predict_linear`; `promql_equiv` | "The alert must not fire on weekends" → `day_of_week()` in the expression or `time_intervals` in Alertmanager |

The career block goes through the same ladder using interview material (section 9.2): at step 3 the learner backs up their claim with a link to a place in the documentation, at step 4 a drill requires an out-of-course command, at step 5 the mock interview has a "live sandbox with documentation" phase.

### 3.7. Process explanations as a subject of assessment

Owner requirement R3 puts process explanations into every block, and R4 sets their style: blocks, arrows, labels on lines, one idea per screen, animation of the process itself only, everything clickable, sliders and "break it" immediately recompute the process with an explanation next to it, steps can be stepped forward and back. Explanation storyboards are written by the block roles; assessment sets the minimum set of `scene` tasks without which the block does not build (2.3). The tasks below are samples from which the rest are written.

| Block | Explanation | Minimum `scene` tasks (subtype — what is checked) |
|---|---|---|
| Methodology | A task from idea to production | `param`: "Flow efficiency is 12%. Buy no more than two improvements so that the time from idea to production becomes less than 3 days"; the prediction — which wait on the timeline is the longest (answer: the deployment window); the failure debrief: "you sped up the work, not the waiting" |
| Methodology | Incident: alert → post-mortem | `scrub`: stop at the step where the service is already restored but the cause has not yet been found (`scene.step='mitigated' && !scene.causeKnown`) |
| Methodology | The flow bottleneck | `param`: add an extra person to the stage where the 20-day output will grow the most; `break`: remove the WIP limit before review — predict what will happen to cycle time (the 85th percentile will grow) |
| Linux | Boot | `next`: what starts after the kernel has mounted the root (PID 1) |
| Linux | fork/exec/PATH | `next` after `fork()`; `break`: a directory is removed from PATH — at which lookup step the command will not be found and which exit code (127) |
| Linux | Pipeline (`\|`) | `param`: pipe buffer size and reader speed — at what ratio the writing process blocks |
| Linux | systemd restarts a crashed service | `param`: `Restart=on-failure`, `StartLimitBurst=3`, `StartLimitIntervalSec=60` — on which crash systemd stops restarting the service |
| Linux | How the kernel isolates and limits | `param`: `memory.max` versus the process's consumption — at what value an oom-kill appears; `break`: remove the PID namespace — what `ps` will see inside |
| Networks | Entering a URL | `order` of the steps; `next` after the DNS response |
| Networks | Name resolution | `param` on TTL (example in 2.2); `break`: the root server is unavailable — what changes for a cached name |
| Networks | TCP + TLS handshake | `next` in the handshake; `param`: RTT 20 → 200 ms — after how many RTTs the first byte of the response arrives with TLS 1.3 (answer: 3 RTT from SYN to the first byte) |
| Networks | A packet through NAT and a router | `hotspot`/`next`: on which node the source address changes; `break`: remove the conntrack entry — what happens to the reply packet |
| Networks | Where 504 comes from | `param`: `proxy_read_timeout` versus the application's response time — at what value 504 changes to 200; `break`: a firewall drops SYN — does the client see 504 or 502 (504, `while connecting to upstream`) |
| Containers | `docker run`: CLI → process | `scrub` to the step where the process PID appears; `break`: remove the shim — what happens to the container when dockerd restarts |
| Containers | `docker build` layer by layer with cache | `param`: which Dockerfile line to change so that exactly 2 layers are rebuilt |
| Containers | Pull by manifest | `break`: the registry returned 404 for the manifest for the `linux/arm64` platform — at which step the error occurs |
| Containers | Hardware → VM → containers → nesting | `param`: "move the slider for the number of applications so that on the same 64 GB containers fit at least 5 times more than VMs, and name which VM resource ran out first" (memory for guest kernels and OSes); `break`: turn on "kernel vulnerability" and mark all affected applications in both towers |
| Kubernetes | `kubectl apply` through all components | `order` (K-1, section 8.5); `next`: who is the first to learn about the new ReplicaSet |
| Kubernetes | Pod scheduling | `param`: pod requests versus free capacity on nodes — at what value the pod stays `Pending` |
| Kubernetes | Rolling update | `param`: `maxUnavailable`/`maxSurge` with 4 replicas — no fewer than 4 ready pods at any moment |
| Kubernetes | Node failure | `break`: kubelet is stopped — after how many seconds pods start being recreated with the default `not-ready` toleration (300 s) |
| Kubernetes | A request through Ingress → Service → kube-proxy → pod | `next` for a packet to a ClusterIP (DNAT in `KUBE-SEP-…`); `break`: remove `br_netfilter` — which path stops working (a pod to the ClusterIP of a neighbour on the same bridge) |
| Kubernetes | The reconciliation loop | K-11 (section 8.5) |
| CI/CD | `git push` → deployment | `break`: the registry token expired — which job is red and what production will see (the old version) |
| IaC | `terraform plan`/`apply` and state | `param`: remove a resource from state — what plan will show (creation of a duplicate) |
| IaC | An idempotent Ansible run | `scrub` to the task that will report `changed` on the second run |
| Monitoring | scrape → storage → PromQL → alert → notification | `param`: `scrape_interval` and the `rate()` window — at what window the graph becomes empty (a window smaller than two intervals); `param`: `for: 5m` — is the alert `pending` or `firing` after a 3-minute spike |

## 4. Module quiz, block quiz and exam conditions

### 4.1. Module quiz

The final check of a lesson: 4–6 tasks, 5–10 minutes, at least two different types, at least one application task (`fill`, `predict`, `bugfind`, `task` or `scene`) and the module's documentation step task (3.6: `docanatomy` at step 2, `docfind` at step 3). For methodology, where tasks are generated by the flow simulator, the module quiz may be longer (up to 10 tasks) — this is a decision of `07`.

### 4.2. Block quiz and levels

The block quiz is 20–25 tasks from all modules of the block, shuffled, 30 minutes, with a mandatory 40% share of practical types, at least one `scene` for each process explanation of the block and a `beyond_course` share per step 4 (3.6). It serves the learner as a last self-check before the exam. The block quiz does not fail anything: with a result below 70% the product honestly says "you most likely won't pass the exam right now; here are three modules worth reviewing" and gives a "go to the exam anyway" button.

An experienced learner should not solve a beginner's tasks: for L2 the block quiz takes `level_variants.L2` where they exist; at least 50% of tasks at `bloom: analyze` and above; no tasks with `difficulty` ≤ 2; no more than 20% of tasks from modules they skipped via the placement check (concepts in the `placed` state); the share of `bugfind`, `scene` and `beyond_course` is increased. Tasks on the catalogue protocols (`03`) get their `level` from the protocol's level: basic — `[L0, L1, L2]`, intermediate — `[L1, L2]`, experienced — `[L2]`; a task on an experienced-level protocol does not get into the L0 quiz.

### 4.3. What opens the block exam

The block exam opens when three conditions on the three R1 pillars are met:

1. all key concepts of the block have a status no lower than `practicing` (textbook);
2. for each process explanation of the block at least one `scene` has been solved with a correct prediction (explanations);
3. the learner has reached step 4 of the documentation ladder in this block (documentation).

These three conditions block, because without them the exam measures luck rather than foundation. The block quiz still does not block.

Sample tasks are in section 8: five to twelve tasks per block, with answers and an explanation for every wrong option.

## 5. Trainers and the process explanations of assessment

### 5.1. Accounting for trainers

The three kinds of trainers (fluency, reading output, failures) are defined in `01`, section 11.1. A trainer does not give points to module progress, but every attempt is written to the event log with its concepts and updates FSRS (correct without hints is Good, so a trainer also works as repetition). The failure trainer records the learner's path (the sequence of commands and opened documentation pages) and after the attempt shows it next to the reference path with marks "here you collected evidence", "here you acted without a hypothesis", "here you took a destructive action before collecting evidence" (for example, `systemctl restart` before reading the journal), "here you found the answer in the documentation". These marks are the basis for scoring the situational drills (section 9.2) and the "On-call shift" (6.4). At step 4, 20–30% of failures require out-of-course commands (3.6).

### 5.2. Explanations designed by this role

Assessment and the career block have their own processes, and owner requirement R3 "explanations in every block" applies to them just as it does to Linux. The five explanations below are built on the `08` primitives (`diagram`, `stepper`, `breakit`, `packets`, `lenses`) in the R4 and R5 style: a magazine-style text column on the left, a drawing on the right; blocks and arrows, labels on lines; animation of the process itself only (a card moves along an arrow, a counter grows, a bar fills), without characters, plot or decoration; colour carries meaning and matches the lesson palette (`08`, section 5.2): green — check passed, red — only `critical` and destructive actions, grey — "not checked", the colours of network layers and Kubernetes components are as in the blocks. Every block of the diagram is clickable and opens a card "what this is and why it is here"; steps can be moved forward, back and paused; in calm mode the animation is replaced by a frame change. Each explanation has two `scene` tasks (rule 2.3).

**O-1. "How the trainer checks your solution".** (Merged with P4 of the platform, 09 §1.12: one explanation; the screen content is here, the model and data are in 09; decision 00 §10.) Shown before the first exam and via the "how is this checked?" button on any goal. The explanation's job is to make the honesty of the mechanism visible: the state is checked, not the text.

| Screen | What is on the screen | What moves | What is clickable | Parameters, "break it" | What changes and the explanation next to it |
|---|---|---|---|---|---|
| 1 | On the left, a terminal with the learner's three commands; on the right, the machine: blocks "processes", "network", "files", "containers" | Commands one by one, each highlighting the machine block it changed | Each machine block: "what the fact collector reads from here" | A switch "the same goal with a different command" (`docker run -d --name web nginx` ↔ `docker run --name=web -d nginx`) | The machine blocks end up the same; next to it: "the check looks here, not at the terminal — that is why any path counts" |
| 2 | The fact collector: arrows from the machine blocks to a `dt.facts/v1` document | JSON lines travel along the arrows (`containers[name=web].state=running`) | Each line: from which kernel command it was obtained (`/proc`, `ss`, `crun list`) | "Break it": turn off the collector's `net` area | A goal that needs the network turns grey "not checked"; explanation: "no facts means no verdict, not a 'fail'" |
| 3 | The goal predicate as a line over the facts; matched paths are highlighted | The highlight runs along the predicate path from left to right | Each path segment: what it selects | A "threshold" slider: `size<150M` moves from 100 to 200 MB | The verdict is recomputed immediately; next to it — which number is in the facts and why the goal passed or not |
| 4 | Exam goals in a column: `critical` ones have a red frame, the rest have points | Points add up into a "practice total" bar | A goal: why it is critical | A switch "do it via `chmod 777`" | The `forbid` goal lights up red, the task's points are reset; explanation: "at work, a workaround is worse than not doing it" |
| 5 | Two modes: "self-check" and "presented"; the second has the agent, `dt-api`, a signature | The failure package goes from `dt-api` to the agent, the signed answer goes back | The signature: what it proves and what it does not | A mode switch | In self-check the signature disappears and the report gets the "self-check" mark; the explanation is one sentence about who needs each mode |

Tasks: `break` — "the collector's `units` area is turned off; which exam goals will turn grey?" (`hotspot` on goals); `param` — "move the image size threshold so that your image from the previous task stops passing, and predict that number in advance".

**O-2. "A situational question: from symptom to cause".** The method tested by questions like "504 — what do you do?" and by the drills in section 9.2.

| Screen | What is on the screen | What moves | What is clickable | Parameters, "break it" | What changes and the explanation next to it |
|---|---|---|---|---|---|
| 1 | On the left, a column of layers (L1 link … L7 application, below it the database); on the right, a list of hypotheses (8 cards: "the application is not running", "firewall", "slow query", "DNS"…) | — | Each hypothesis: which layer it is at and which command checks it | A "cause variant" switch (seed: slow SQL / a `drop` rule / connection pool) | Only the hidden cause changes; explanation: "the method is the same for all variants" |
| 2 | The observation "`curl` → 504, `server: nginx`" | The observation flies into the layer column and lights up L7 at nginx; hypothesis cards that contradict the observation (DNS, certificate) go dark | A darkened hypothesis: which observation ruled it out | — | Counter "hypotheses left: 5"; explanation: "a response from nginx proves that DNS, TCP and TLS up to nginx work" |
| 3 | The next command — the nginx error log | The line `while reading response header` versus `while connecting to upstream`; the hypotheses split into two branches | Each of the two log lines: what it means | A slider "application response time" versus `proxy_read_timeout` | When the response is faster than the timeout, 504 changes to 200; explanation next to it |
| 4 | The branch chosen by the seed: a direct request to the application or `ss -tn` | The hypothesis counter decreases to 1 | The final hypothesis: which piece of evidence proved it | "Break it": "restart everything before collecting evidence" | The evidence column is cleared, the hypothesis counter returns to 5, and a minute later the symptom returns; explanation: "the restart wiped the evidence and did not remove the cause" |
| 5 | Mitigation and fix: "restore the service" (roll back *the change that caused it*: the deployment or the firewall rule) and "eliminate the cause" | A "downtime, minutes" bar grows until the service is restored | Each action: what it changes and how it is checked | A switch "roll back the deployment" when the cause is "the `drop` rule" | Downtime keeps growing; explanation: "you roll back what changed, not what is closest at hand" |

Tasks: `scrub` — "stop at the step after which the 'DNS' hypothesis is ruled out, and name the evidence"; `break` — "turn on 'restart before collecting evidence'; predict how many hypotheses will remain" (5).

**O-3. "The job search funnel as a flow".** Links the job search to the methodology block: the same board, the same flow metrics, Little's law.

| Screen | What is on the screen | What moves | What is clickable | Parameters, "break it" | What changes and the explanation next to it |
|---|---|---|---|---|---|
| 1 | A board: application → response → screening → technical → final → offer | Application cards move across the columns; some go to "rejected" | A column: what usually happens in it and how long it lasts | A slider "applications per week" (3–30) | The number of cards in progress grows; explanation: "WIP = throughput × time in the system" (Little's law) |
| 2 | Under the board — counters: in progress, throughput, time to offer | The counters are recomputed with every movement | A counter: how it is computed | Conversion sliders for each stage (illustrative parameters marked "put in your own after two weeks") | Time to offer is recomputed; the explanation names the stage that limits it the most |
| 3 | The same, with card age (work item age): each card has a number of days | The age grows with each step | A card older than 14 days without a response: "close it and don't wait" | A switch "cover letter tailored to the posting" | First-stage conversion grows; explanation: what exactly changes in the recruiter's eyes (section 9.6) |
| 4 | Steady throughput versus "applications in batches once a month" | Two boards side by side | — | "Break it": "stop applying while studying" | After N weeks the board empties, time to offer grows by the same pause plus the funnel length; explanation: "a search is a flow; it cannot be paused without losses" |

Tasks: `param` — "with an average application path of 3 weeks, what flow of applications per week will give about 36 cards in progress?" (12); `break` — "predict after how many weeks after applications stop the board will be empty with a 3-week path".

The conversion parameters in O-3 are a model, not market statistics, and the screen says so directly; the learner gets real numbers from their own funnel (section 9.7).

**O-4. "Why this question came back today".** FSRS repetition and the rules of 3.4 shown in one picture.

| Screen | What is on the screen | What moves | What is clickable | Parameters, "break it" | What changes and the explanation next to it |
|---|---|---|---|---|---|
| 1 | The forgetting curve of one concept: recall probability along the time axis, repetition points | After each repetition the curve becomes flatter | A repetition point: which task format it was and what rating | A slider "target retention" 0.80–0.95 | There are more or fewer repetition points per month; explanation: "0.9 is a compromise between workload and forgetting" |
| 2 | Several concepts of the block on one axis; today's repetitions are highlighted | Highlighted concepts move into the "today" queue | A concept: why it is in the queue today | A switch "answered with 'I know' confidence but was wrong" | A separate misconception queue appears: repeat after 10 minutes and tomorrow; explanation: "a confident mistake is more dangerous than an unconfident one" |
| 3 | A row of formats (`choice`, `fill`, `scene`, a sandbox micro-task) | The next repetition takes a different format | A format: why not the same one | "Break it": "repeat in the same format" | The concept gets stuck before `mastered`; explanation: "they memorised the answer, not the concept" |

Tasks: `next` — "which format will the next repetition of a concept take if the last two were `choice` and `fill`?"; `param` — "set the target retention so that there are no more than 30 repetitions per week with the current map".

**O-5. "How the neural network scores an answer".** Explains the quote check (section 9.3) and why a score is sometimes "not confirmed".

| Screen | What is on the screen | What moves | What is clickable | Parameters, "break it" | What changes and the explanation next to it |
|---|---|---|---|---|---|
| 1 | On the left, the transcript of the answer; on the right, a six-criterion rubric | Lines run from quotes in the transcript to the criteria, with a score on each line | A line: which quote confirms which score | — | — |
| 2 | Quote check: the normalised quote is overlaid on the transcript | Matching words are highlighted one by one | A word that did not match because of a recognition error | A "tolerance" slider (normalised word distance 0–0.3) | At tolerance 0 honest scores are reset because of recognition errors; at 0.3 invented ones pass; explanation: why 0.15 was chosen |
| 3 | A model answer with one quote that is not in the transcript | The line of this quote breaks, and the criterion score turns grey "not confirmed" | A grey score: what to check yourself | "Break it": "the model invented praise" | The average score drops; explanation: "a score without evidence does not count — this protects against model flattery" |

Tasks: `break` — "in which criterion will the score become 'not confirmed' if the phrase about cgroups is removed from the transcript?"; `param` — "find the tolerance at which a quote with one recognition error passes but an invented one does not".

## 6. Practical exams

### 6.1. The common frame of a block exam

Block exams are designed by the block roles, and they take different forms: Linux has scenarios on tier B with an indicative timer (`02`, section 8.3), networks have a two-part exam with a simulator and a VM, 80 out of 100 (`03`, section 17), containers have four exams E1–E4 with a soft timer (`04`, section 17), Kubernetes has three exams B/I/E by level with a 66% threshold, as in the CKA (`05`, section 10), methodology has a flow simulator run (`07`). The single format along the lines of "60–120 minutes, 70/30, ≥ 70%" announced in the first revision matched none of them. So assessment sets not a format but a **frame**: what is mandatory for all and what the block chooses itself.

| Parameter | Mandatory for all blocks | Set by the block |
|---|---|---|
| Storyline | Tasks arrive in business language from the "tracker" (cards of the same kind as in the `07` kanban simulation), not as commands | The legend, the number of tasks |
| Practice check | By `dt.facts/v1` facts with `09` predicates, any path; partial credit by sub-goals; `critical: true` — failing any critical goal = exam not passed; `forbid` — workarounds do not count (`chmod 777`, `allow_failure` on tests, `--force` without need, disabled TLS verification); `keep` — the original cannot be swapped (the same process, the same etcd) | The set of goals |
| Documentation | Step 5: only the built-in mirror viewer is open, with the block's `docs_allowlist` whitelist (3.6); the log of opened pages is shown in the debrief and does not count toward the score | The list of sources |
| Out-of-course tasks | Tasks with `beyond_course: true`, not `critical`; share of the practice weight — no less than 10% (L0), 15% (L1), 20% (L2) | A share above the minimum (Kubernetes — 20–30%) |
| Explanations | Two `explain` questions at the end; the result is a separate "interview readiness" mark for the block; **they do not count toward the pass score** (decision of `01`, section 11.2) | The questions |
| Timer | Soft by default: the time is written to the report and to the "fluency" debrief but does not cut off. Hard only in presented exams (time is counted by `dt-api`), in the "On-call shift" and in part B of the final exam, where time is part of the skill | Duration 30–180 minutes |
| Threshold | All critical goals + the block threshold in the 66–85% range | The number (Kubernetes 66%, Networks 80 out of 100) |
| Levels | One credit core exam for all levels (`01`, section 3.3); learning exams per level are allowed but do not go into the report; the `plus` and `pro` parts are separate optional parts | Learning exams and `plus`/`pro` parts |
| Variant | Generated from a seed: names, ports, addresses, which failure cause is chosen | The failure pool |
| Mentor and AI | The built-in mentor is always off; "exam" or "training" mode (section 7) | — |
| Retake | After 24 hours, with a new variant, unlimited attempts; before the retake — a 15-minute series of trainers on the failed concepts (`01`, section 11.2) | — |
| File format | `bank/<block>/exam/*.yaml` per the 6.2 schema: `sandbox`, `tasks[].goals`, `docs_allowlist`, `explain`, `pass` | — |

Compliance of the block exams with the frame as of 18.11.2026: `02` — compliant (one step 5 task in each exam); `03` — part A "real time is not limited" = a soft timer, the 80 out of 100 threshold is within the range, item 8 (step 5) weighs 10 — for L1 and L2 it must be raised to 15 and 20; `04` — compliant (soft timer, `docs_allowlist`, out-of-course tasks in every exam), but E4 is called "On duty", so the cross-block exam here is called "On-call shift"; `05` — compliant; `06` and `07` — are being moved to the 6.2 schema (the methodology example is in 6.3).

### 6.2. Exam specification: a containers block example

The specification is written as checks under the `09` contract. The example is an exam of three cards; the `04` role has its own content for exams E1–E4, here the format is what matters.

```yaml
# content/bank/docker/exam/exam-docker-shop.yaml
id: exam-docker-shop
block: docker
time: { mode: soft, norm_min: 90 }
docs_allowlist: [docs.docker.com, compose-spec.io, man7.org, docs.kernel.org/admin-guide/cgroup-v2, github.com/opencontainers]
story:
  ru: "Вы первый день в «Ларьке» — маленьком интернет-магазине. Сайт и база работают на одном сервере «как-то так». Тимлид оставил три карточки."
  en: "..."
sandbox: { env: sim, image: docker-lab, seed: "{{seed}}" }     # tier A (dsim)
tasks:
  - id: t1
    weight: 25
    card: { ru: "Упакуйте сайт (каталог ~/shop) в образ shop:1.0. Образ должен быть не больше чем на 40 МБ тяжелее базового.", en: "..." }
    goals:
      - { id: t1a, critical: true, when: "images[ref='shop:1.0']" }
      - { id: t1b, points: 10, when: "images[ref='shop:1.0'].size <= @base_size(shop:1.0) + 40M" }   # threshold relative to the variant's base
      - { id: t1c, points: 5, lint: dockerfile, max_level: warning }
  - id: t2
    weight: 35
    card: { ru: "Запустите сайт и базу так, чтобы сайт открывался на порту 8080, а данные базы переживали пересоздание контейнера.", en: "..." }
    goals:
      - { id: t2a, critical: true, when: "containers[state=running].ports~'8080->' && http.shop.status=200" }
      - id: t2b
        critical: true
        sim_action: { op: recreate, target: "containers[name=db]" }   # tier A simulator action before evaluating when (request to 09, section 13)
        when: "http.shop_order_marker.status=200"
        envs: [sim]
      - { id: t2c, points: 5, forbid: "containers[name=db].ports~'5432->'", message: { ru: "Базе незачем торчать наружу." } }
  - id: t3
    weight: 25
    card: { ru: "После вашего запуска пришла жалоба: страница оформления заказа падает. Найдите и устраните причину. В карточку решения впишите, на какой границе контейнера была причина.", en: "..." }
    fault_pool:                      # the seed picks a boundary the learner did not meet in the quiz, then a variant
      kernel:   [fault-oom, fault-pids-limit]
      network:  [fault-listen-loopback, fault-port-conflict, fault-default-bridge-no-dns]
      storage:  [fault-anon-volume, fault-tmp-ephemeral]
      process:  [fault-shell-form-no-sigterm, fault-zombie-no-init]
      io_logs:  [fault-log-to-file-not-stdout]
      identity: [fault-env-missing, fault-bind-perm-uid]
    goals: "{{fault.goals}}"
    boundary_field: { id: boundary, expect: "{{fault.boundary}}", points: 3 }
  - id: t4
    weight: 15
    beyond_course: true
    doc_ref: "docs.docker.com/reference/cli/docker/container/run/#read-only"
    card: { ru: "Безопасник просит: корень контейнера сайта только для чтения, писать можно только в /tmp.", en: "..." }
    goals:
      - { id: t4a, points: 15, when: "containers[name=shop].mounts[target=/][options~ro] && containers[name=shop].mounts[target=/tmp][type=tmpfs] && http.shop.status=200" }
explain:
  weight: 0
  readiness_mark: true
  questions:
    - id: e1
      q: { ru: "Тимлид спрашивает: «Чем то, что ты сделал, лучше, чем просто запустить сайт на сервере, как было?» Ответьте ему.", en: "..." }
      rubric: rubrics/explain-default.yaml
      key_points: [isolation-of-deps, same-artifact-everywhere, reproducible-build, not-a-vm]
    - id: e2
      q: { ru: "Почему данные базы пережили пересоздание контейнера и что было бы без вашего решения?", en: "..." }
      key_points: [writable-layer-ephemeral, volume-outside-container, anonymous-vs-named]
pass: { critical: all, total_min: 75 }
```

The `boundary` of the failed or found failure is written to the report, and the debrief says: "the cause sat at the *identity* boundary: the UID inside the container does not match the owner of the directory outside". The six boundaries — host kernel, network, storage, process and signals, I/O and logs, configuration and identity — are the same as in the `04` explanations (owner requirement R7); the exam guarantees that over the course the learner meets a failure at each one.

The share of out-of-course tasks in the 6.2 and 6.3 examples is designed for L0 and L1 (15% and 10% of practice); for the L2 exam variant the seed adds a second task from the out-of-course pool and recomputes the weights so that its share is no less than 20%.

The cross-block exams — the "On-call shift" and the final exam — are this role's area (6.4 and 6.5).

### 6.3. Methodology and Linux exams within the frame

**Methodology.** The block exam is scenario S8 "Black Friday" in the `flowlab` flow simulator (`07`) plus computing metrics on live data. Within the frame it looks like this; "Understanding", which in `07` was a text-based pass criterion, has been turned into automatically checkable counterfactual predictions (t5): after the run the learner predicts what would have happened with a different decision, and `flowlab` replays the run with that decision and compares.

```yaml
# content/bank/methodology/exam/exam-methodology.yaml
id: exam-methodology
block: methodology
time: { mode: soft, norm_min: 120 }
docs_allowlist: [dora.dev, sre.google, kanbanguides.org, scrumguides.org]
sandbox: { engine: flowlab, scenario: S8, seed: "{{seed}}", replay: false }
tasks:
  - id: t1                      # "Flow", "Delivery"
    weight: 25
    goals:
      - { id: t1a, points: 15, when: "metrics.cycleTimeP85[30..45] <= 0.6 * metrics.cycleTimeP85[1..10]" }
      - { id: t1b, points: 10, when: "metrics.deployEveryDays[36..45] <= 2 && metrics.leadTimeDays[36..45] < 3" }
  - id: t2                      # "Stability"
    weight: 20
    goals:
      - { id: t2a, critical: true, when: "metrics.downtimeMin[sale] < 30" }
      - { id: t2b, points: 10, when: "metrics.changeFailRate[31..45] < 0.2" }
  - id: t3                      # "Money", "People"
    weight: 15
    goals:
      - { id: t3a, points: 8, when: "money.net >= 1.1 * baseline.money.net" }
      - { id: t3b, points: 7, when: "people.gena.unplannedShare[36..45] < 0.5 && people.gena.overtimeDays <= 3" }
  - id: t4                      # live data, 07 §9.2
    weight: 15
    goals:
      - { id: t4a, points: 15, numeric: { fields: [throughputWeekly, cycleP50, cycleP85, wipAvg, dora5], tolerance: 0.05 } }
  - id: t5                      # counterfactuals: "what would have happened if…"
    weight: 15
    goals:
      - { id: t5a, points: 15, counterfactual: { pick: 3, from: "@student.decisions", predict: [leadTimeDays, downtimeMin], tolerance: 0.25 } }
  - id: t6
    weight: 10
    beyond_course: true
    doc_ref: "sre.google/workbook/postmortem-culture/"
    goals:
      - { id: t6a, points: 10, fields_filled: "postmortem[S8].sections ⊇ @doc.sre_postmortem_sections" }
explain:
  weight: 0
  readiness_mark: true
  questions:
    - { id: e1, q: { ru: "Три решения, которые вы считаете главными, и что показали контрфакты" }, rubric: rubrics/explain-default.yaml }
    - { id: e2, q: { ru: "По данным второй части: где узкое место и три изменения с ожидаемым эффектом" }, rubric: rubrics/explain-default.yaml }
pass: { critical: all, total_min: 70 }
```

**Linux: the mandatory isolation task.** Everything the containers block relies on must be introduced and checked in Linux (owner requirement R6). So in the intermediate and experienced Linux exam one task is necessarily about resource limits; for L0 it replaces one of the tasks of the "Service won't start" exam (`02`, section 8.3) as an additional, non-critical one.

> "The `report` service (systemd) must stay within 64 MB of memory and 20 processes; when memory is exceeded, systemd restarts it, but no more than three times a minute." The environment is tier B (`lab-debian`).

```yaml
goals:
  - { id: limits, critical: true, when: "cgroups[path~'report.service'].memory.max<=64M && cgroups[path~'report.service'].pids.max=20" }
  - { id: restart-policy, points: 10, yaml_path: { file: "@unit(report.service)", expect: ["Restart=on-failure", "StartLimitBurst=3", "StartLimitIntervalSec=60"] } }
  - id: oom-observed
    critical: true
    envs: [v86, vm]
    probe: { script: probes/report-leak.sh, why: "a leak has to be triggered and the reaction of the kernel and systemd awaited; observation is not enough" }
    then: "cgroups[path~'report.service'].memory.events.oom_kill>=1 && units[report.service].restarts<=3"
  - { id: drop-in, points: 5, warn: { when: "files['/etc/systemd/system/report.service'].sha256!=@start", say: { ru: "Правка самого unit-файла работает, но обновление пакета её затрёт; лучше `systemctl edit report` (drop-in)." } } }
```

### 6.4. The cross-block exam "On-call shift"

Before the final exam the learner goes through one shift as the on-call engineer: 60 minutes on a hard timer, three overlapping incidents in a connected environment. The "On-call shift" is a dress rehearsal for an interview and for a first job, so it checks not only the fix but also the on-call engineer's behaviour.

**Environment.** Hybrid, tiers A + B (`09`, section 1; `05`, section 5.9):

| What | Where | Why this way |
|---|---|---|
| The `shop` shop server (nginx and the application as systemd services, no dockerd) | A v86 `lab-alpine` machine, 96 MB | dockerd in v86 is uselessly slow (`09`, section 1.2); nginx and the application as services give real logs, `ss`, `nft`, a disk |
| Kubernetes | Hybrid: the control plane is kube-lite in `sim.worker.ts`; nodes `worker-1`, `worker-2` are v86 `lab-node` machines of 96 MB each with `dt-kubelet`, pods are real `crun` processes in their own namespaces | `kubectl exec` enters a real container, kube-proxy rules are visible with a real `iptables-save`, a "failed node" is a stopped machine |
| Network | The course `vswitch`: real L2 between the three machines (ARP, `tcpdump`, routes, NAT) | Network causes are real |
| Prometheus, Grafana, Alertmanager, CI | Tier A simulators; node and `shop` metrics are taken from the facts of the real machines | A real Prometheus in the browser is not needed for on-call |

Three v86 machines take about 900 MB of tab memory, so the full environment is enabled when `navigator.deviceMemory >= 8`. With `deviceMemory` 4 the `shop` server moves to tier A (dsim), the nodes stay v86; checks for pools A and B then use `sim_action` instead of `probe`. On a weaker device it is the same shift entirely on tier A (dsim + kube-lite without v86), with `env: sim` noted in the report. On a phone the "On-call shift", block exams and sandbox micro-tasks are unavailable, and the interface says so before the start, not after.

**Incident pools.** The seed picks three incidents so that they touch at least three blocks; one of the three is always low-impact (pool D).

| Pool | Tier | The symptom the learner sees | Cause variants (one is chosen) | Blocks |
|---|---|---|---|---|
| A | B (`shop`) | Alert `HighErrorRate`, the site returns 504 | a slow DB query after a deployment; the application's connection pool is exhausted; a new firewall rule drops packets to the upstream (`while connecting to upstream`); the upstream in nginx points to an old address | Networks, Linux, monitoring |
| B | B (`shop`) | Alert `DiskWillFillIn4Hours` | a deleted but still open log; an application log without rotation; an overgrown temporary files directory of a service | Linux |
| C | hybrid | After a deployment, the new version does not accept traffic | CrashLoopBackOff because of an environment variable; a readiness probe on the wrong port; ImagePullBackOff because of a typo in the tag; a NetworkPolicy from the same deployment cut the new pod off from the database | Kubernetes, CI/CD, Networks |
| D | A (CI) | The main pipeline has been red for the third hour | a flaky test with `retry`; the registry token expired; the build cache is poisoned | CI/CD |
| E | hybrid | Alert `KubeNodeNotReady`, some pods are `Terminating`/`Pending` | the node machine is stopped; `dt-kubelet` crashed (a service on the node); the node ran out of memory and the agent was OOM-killed; the route between nodes on the switch is broken (pods are Running but unreachable from the neighbouring node) | Kubernetes, Linux, Networks |
| F | hybrid | "`api` cannot reach `orders`": `curl http://orders` from the `api` pod fails | `orders` is in another namespace and the client uses the short name; the Service selector does not match the labels — the EndpointSlice is empty; `targetPort` does not match the container port; the `orders` pods are not ready (readiness) — `ready: false` in the EndpointSlice; a `default-deny` NetworkPolicy in the `orders` namespace | Kubernetes, Networks |

**Flow and prioritisation.** Incidents arrive overlapping: the second 8–12 minutes after the first, the third while the second is still open. On the right is the on-call board: "New → Investigating → Mitigated → Closed" with a WIP limit of 1 in "Investigating" (a shared vocabulary with `07`: class of service, unplanned work). What is assessed: the incident with the greatest user impact (by alerts and metrics) is taken first; the low-priority one is deferred with a message in the chat, not forgotten; there is no more than one incident in "Investigating" at a time.

**State checks.** Pool A: "5xx errors below 1% over 5 minutes" by `shop` metrics; B: "≥ 20% of the disk free, application data intact" (`keep` on the hash of the data files); C and F: the Deployment is available, `http.api_to_orders.status=200`, `forbid` on "open everything" (a `NetworkPolicy` with an empty `podSelector` and an allow-all `ingress`); D: the main pipeline is green without `allow_failure` and without increasing `retry`; E: pods are Running on a live node within the kube-lite eviction timeout or the node is returned (`k8s.objects[kind=Node][metadata.name=worker-2].status.conditions[type=Ready].status=True`), PVC data is intact, pods were not deleted by hand before evidence was collected.

**The on-call engineer's behaviour** is assessed from the action log and the `rubrics/incident.yaml` rubric (shared with `07`):

| Criterion | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Layer and evidence | Acted without observations | Named a layer or component without evidence | Named it based on evidence ("ping by IP works — L3 is fine") | Named it and narrowed it down as new evidence came in |
| Safety | A destructive action before collecting evidence (restart, pod deletion) | A destructive action after partial collection | No destructive actions | + service restoration first, then searching for the cause |
| Prioritisation | Took incidents in the order they arrived | Changed priority without explanation | First by impact | + the deferred incident was announced in the chat |
| Status: impact | Not stated | "The site is slow" | Who is affected and how badly ("payment for everyone, ~30% of requests 504") | + since when and whether it is growing |
| Status: what we are doing | None | An action without a goal | An action and what we expect | + how we will roll back if it does not help |
| Status: next update | None | "Later" | A time | A time and a condition ("at 14:40 or earlier if…") |
| Post-mortem: timeline | None | One event | Key moments with times | + the moment of detection and the moment of recovery |
| Post-mortem: contributing factors | A guilty person is named | One "root cause" | Two or more system conditions | + why the safeguard did not work |
| Post-mortem: actions | None | "Be more careful" | A verifiable change | + an owner and a deadline |

After each incident there is a four-line post-mortem: timeline, impact, contributing factors, actions. The first revision asked for "symptom, cause, what will prevent it" — this taught looking for a single root cause, while a blameless post-mortem (`07`, SRE Workbook) talks about contributing factors. Pass: all state checks of the critical goals of the three incidents and an average rubric score ≥ 2 with no zero in "Safety".

### 6.5. The final exam

The final exam confirms that a person can build and defend a small but real system. It takes place on three cloud VMs that the learner orders with Terraform and configures with Ansible: this is the third Kubernetes step (owner requirement R12) and the same cluster as in the `track:k8s/r3-iac` track (`05`, sections 11.1 and 11.4, part B; the final exam of the IaC block in `06`). The trainer executes nothing on the VMs itself: it shows steps and commands, the learner runs them on their side, and the result is checked by the `trainer-check` agent (`09`, section 5.4), which only reads the system, apart from failures from signed packages. The exam consists of three parts and a cleanup.

**Where to get VMs and how much it costs.** The course does not provide machines: the learner gets them from a cloud provider of their choice per the `providers.yaml` table (`09`, section 5.2; `05`, section 11.2) — Yandex Cloud, VK Cloud, Selectel, Timeweb Cloud, Hetzner, AWS, Oracle — or runs three local VMs on their own computer if it has enough memory (`09`, section 5.3). For a cloud, before ordering, the screen shows the estimate "3 VMs × size × hours" at the chosen provider and, separately, the price per day if you forget to delete them; while working, the header shows a counter "VMs running for N h M min, ≈ X ₽/€". So that 14 days of preparation do not cost 14 days of rental, part A is done like this: the learner writes and debugs the code and the pipeline on their side (one VM or their own machine); the final build — ordering three VMs and bringing everything up from code from scratch — fits into one session of up to 8 hours. Bringing everything up from code from scratch is itself an IaC check (A8).

**Part A. Build (up to 14 days, at your own pace; the final build is one session).** The learner deploys their own service (it may be the service from pet project 3, section 10) according to these requirements:

| # | Requirement | How it is checked |
|---|---|---|
| A1 | Code in a public GitHub or GitLab repository, a README following the template (what it is, a diagram, how to run it, decisions and their reasons, known issues) | The GitHub API from the browser (CORS is allowed) or a script for GitLab; presence of README sections by headings |
| A2 | Pipeline: lint → tests → image build tagged with the commit → publishing to a registry → deployment; no deployment on branches other than main | The pipeline file (`yaml_path`), the status of the last main run — success, image tags in the registry match the commit SHAs |
| A3 | Three VMs are created by Terraform; Ansible prepares the nodes (kernel modules, sysctl, containerd, k3s or kubeadm/kubelet of the right version); a repeated playbook run gives `changed=0`, a repeated `terraform plan` gives `No changes` | `plan_expect` and `idempotent` on the pasted output; the agent compares the actual node state (`modprobe`, `sysctl`, package versions) with the roles from the repository |
| A4 | A three-node cluster: L0 and L1 — k3s (1 server + 2 agents; L1 may choose kubeadm); L2 — kubeadm: 1 control plane + 2 workers, Cilium CNI, a StorageClass. The application is deployed with a Helm chart via Argo CD | `trainer-check run --track capstone --nonce …`: nodes Ready, versions, Application Synced/Healthy, the revision matches HEAD, the `trainer-proof` ConfigMap |
| A4b | L2 only: a scheduled etcd snapshot (CronJob or systemd timer) and a verified restore; upgrading the cluster to the next minor version during the exam; certificate expiry per `kubeadm certs check-expiration` more than 30 days | The agent reads `/etc/kubernetes/manifests/etcd.yaml`, snapshots younger than 24 hours (`etcdctl snapshot status`), `kubeadm certs check-expiration -o json`, the `nodes[].kubelet` versions before and after |
| A5 | Monitoring: Prometheus and Grafana, a dashboard with the four golden signals, an error-rate alert with `for:`; the alert is delivered to Telegram | Agent: the rule is loaded (`promtool`), target `up == 1`; the failure is injected by the agent from a signed package (presented mode) or by the learner using the shown command (self-check); after 5 minutes the learner pastes the text of the received alert with a one-time code |
| A6 | Basic security: key-based login, password disabled, the firewall opens only the needed ports, secrets are not in the repository | Agent: `sshd -T` (`passwordauthentication no`), nftables/ufw rules; in the repository — a gitleaks check |
| A7 | An out-of-course task (step 5): one from the pool — a PodDisruptionBudget so that a node upgrade does not take down the service; `topologySpreadConstraints` across nodes; a `HorizontalPodAutoscaler` on CPU | The agent, by objects; documentation — the kubernetes.io mirror |
| A8 | Everything comes up from code from scratch: `terraform apply` + the playbook + Argo CD on an empty project lead to a working service | The time and output of the final build in the report; the agent — all A3–A6 checks on fresh VMs |

**Part B. Fix (60 minutes, hard timer).** In presented mode the agent injects one failure from a signed package into the learner's system (chosen by the seed; for L2 — from the pool of exam E of `05`, section 10.3: a stopped kubelet on a worker, a corrupted `--etcd-servers`, an expired certificate); only `dt-api` knows the time and moment of the failure. In self-check mode the trainer shows the whole failure command, the learner runs it themselves and does not read it (word of honour). This is the same format as the "On-call shift", but on real machines. The check is the same agent: after "fixed", all part A checks are green again, the `keep` conditions are met (the same etcd, the same PVCs), and the status in the "chat" and the post-mortem are scored with the `incident.yaml` rubric. Failures are only reversible ones that do not touch the learner's data; their full list and the rollback commands are shown before the start.

**Part C. Defend (40 minutes).** The mock interviewer (section 9.3) receives the README, the diagram, the pipeline file and the report of parts A and B, and conducts a technical interview about the project: "what would you gain and lose by using k3s instead of kubeadm" (L2) or "what did k3s hide from you compared to kubeadm" (L0, L1); "what happens if the node with Prometheus fails"; "how do you roll back a deployment"; "where is the single point of failure in this project"; "how would you restore etcd from a snapshot" (L2); "what would you do differently". Scoring uses the interview rubric; the threshold is an average score ≥ 2 out of 3 and no 0 on "honesty". Alongside, the product persistently suggests going through the same defence with a live person (section 9.4): the neural network is good for repetition, but only a live interviewer removes the fear of the interview.

**Cleanup (mandatory; without it the report is not issued).** After the defence there is a "delete the VMs" step. In their cloud the learner pastes the output of `terraform destroy` (the last line `Destroy complete! Resources: N destroyed.`, where N matches the number of lines of `terraform state list` saved at step A3), then the empty output of `terraform state list` and, as in `05`, section 11.6, the provider's list of VMs by label in JSON format (`hcloud server list -l trainer=devops -o json`, `yc compute instance list --format json` filtered by the `trainer=devops` label via `jq`): credited if the list is empty. Terraform creates all exam VMs with the `trainer=devops` label. For local VMs an empty `terraform state list` or the hypervisor's VM list is enough. This is a self-check, and the screen says so directly; on the next visit a day later the product reminds about the unfinished cleanup. If the learner wants to keep the service alive for an employer, the product allows keeping one VM and shows its monthly cost; the report gets the mark "1 VM kept, ≈ X ₽ per month".

**Report.** A report page (HTML and JSON): what was checked, which checks passed, in which authenticity mode ("self-check" or "presented" with `attest` and a verification link) and in which work mode ("exam" or "training"), links to the repository and the live service, the result of the defence with quotes, the cleanup mark. The report is not a certificate, and that is exactly what we call it: an employer needs not our badge but a repository they can open and a person who can explain it. The authenticity of a presented report can be verified by a third party via a link to `dt-api`.

### 6.6. What the exam, the debrief and the report look like

The report is what the learner will show to an employer; the exam screen and the path debrief are the product's longest-used pages. Requirements for their look (implemented by `08`, section 5):

- **Sankofa magazine layout:** a text column, tabular figures in the report, RU/EN bilingualism via a switch, calm mode, A4 printing, a QR code to the live report page (handoff to a phone from `08`, section 3.9).
- **Colour is only semantic:** green — check passed, red — only `critical` and destructive actions, grey — "not checked"; block colours (kernel and user space, network layers, Kubernetes components) repeat the lesson palette.
- **The learner's path** is a horizontal ribbon of commands in the style of the course terminal with marks "evidence", "no hypothesis", "destructive action", "found in documentation"; it scrolls like a stepper (`08`, section 3.1), the only animation is the step transition; in calm mode it is a static list.
- **The exam screen** has no animations except the step change; the timer does not change colour until the last 10 minutes; no award badges, confetti or characters.

## 7. AI and honesty: position and mechanism

The learner sees this text on the first screen of any exam (the wording is final):

> We don't watch you and don't check whether you have another tab open. The exam checks the state of the system, not text: the service either responds or it doesn't. The built-in mentor is off here, and only the official documentation is open — as at a real job and in the CKA. Choose the mode honestly. "Exam" — you work only with the documentation; this way you will find out where you really stand and close the block. "Training" — with any assistants; you will get a full debrief, but the block will not close. If a neural network does the task for you, you will get a green tick and will not get the skill, and at the interview you will be asked to do the same thing in front of everyone. Both modes are normal: training is not penalised in any way.

How this is supported by the mechanism and not only by words:

| Measure | What it gives |
|---|---|
| Checking by the final state of the environment | Copied text gives nothing; you have to act in your own sandbox |
| A coherent storyline and out-of-course tasks | You can paste a task into a chat and run the answer, but three connected overlapping failures cannot be passed without understanding; this is visible in the action log |
| A variant from a seed, parameterised failures | Someone else's walkthrough and a memorised answer do not help |
| A log of actions and opened documentation pages | The learner can see where they acted blindly; a path like "pasted twenty commands in a row without reading the output" is flagged in the debrief |
| Presented mode (`09`, sections 4.7 and 5.6) | The failure is injected by the agent, time is counted by the server, the result is signed: for the person the report is presented to, authenticity is verifiable |
| An oral defence of your own work (part C) | Something AI will not do for a person at a real interview |
| The built-in mentor is always off, the task FAQ is static | The product itself gives no hints |
| The mode is written to the report and not hidden | Dishonesty becomes pointless: a "training" report is not worse — it is just different |

What we do not do and why: camera proctoring, screen recording, blocking text pasting into the terminal, "AI detectors" in `explain` answers. Detectors produce false positives and punish honest people, blocking paste breaks an engineer's normal work (copying from documentation is a working skill), and a camera will scare off adults and prove nothing. Our answer is to make cheating useless, not impossible.

## 8. Sample tasks by block

Samples of block quizzes (section 4) with levels, the correct answer and an explanation for every wrong option; in the bank each has parameterised variants. The samples are run through the vocabulary linter (2.4). Concepts are given per the `01` graph; provisional new IDs per 2.5.

### 8.1. Methodology

The "Methodology" block quiz is the first block of the course. The vocabulary already available in it (`07`, section 3): repository and merging, build, automated test, test environment (staging), continuous integration, delivery, deployment, pipeline, rollback, alerting and monitoring, WIP, flow, cycle time. The words "commit", "main", "artifact", "image", "registry", "GitOps", "infrastructure as code" are not in it: they are introduced in the CI/CD, containers, Kubernetes and IaC blocks, and the tasks using them live there.

**M-1. `choice`, L0–L2, concepts M14–M16.** Every change merged into the shared branch is automatically built and checked by tests, and the result can be released to production at any moment. It is released to production by a person pressing a button. What is this practice called?
- a) Continuous integration — *wrong: continuous integration ends at the merge and the automated check; here the next step has been taken — every change is ready for release at any moment.*
- **b) Continuous delivery — correct: every change is ready for release, but the decision to release is made by a person.**
- c) Continuous deployment — *wrong: with continuous deployment every change that passes the pipeline goes to production automatically, without a manual step. The button is the sign of delivery.*
- d) A release train — releasing on a schedule — *wrong: with a train, the release waits for a window, while here it can be done at any moment (the train is covered in scenario S5 of `07`).*

The question "how does GitOps differ from continuous delivery" lives in the Kubernetes quiz (`concepts: [K29, M15]`).

**M-2. `order`, L0–L2, concepts M14, M15, M17, F10.** Arrange the pipeline stages in a sensible order: (1) release to production, (2) build, (3) fast automated tests, (4) deployment to the test environment, (5) checking the whole system in the test environment, (6) manual approval.
**Answer: 2 → 3 → 4 → 5 → 6 → 1.** The debrief is built around the first point of divergence: system check before deployment to the test environment — "checking the whole system needs a running system"; approval after release to production — "that is no longer an approval but a notification"; fast tests after slow ones — "cheap and fast checks come before expensive ones (fail fast): a build that fails after a minute saves an hour". The variant with an image and a registry is in the CI/CD quiz (`concepts: [C08, C11, M17]`).

**M-3. `choice`, L0–L2, concepts M07, M09.** On the board, the "Review" column has a WIP limit of 2, and there are already two cards in it. A developer has finished their task. What is the right thing for them to do?
- a) Put the card into "Review" — the limit can be exceeded once — *wrong: a limit that is exceeded "once" stops working; this is exactly the moment when it should stop the flow.*
- **b) Help finish reviewing the cards already there — correct: the limit signals that the bottleneck is in review; freeing it up is faster than starting new work. Their own card stays in the "Development" column with a "done" mark (or in a "Ready for review" sub-column if there is one) — this is a visible queue that the limit does not let further, not hidden work.**
- c) Take a new task from the backlog while review frees up — *wrong: this increases work in progress and the time it takes a task to go through; the board fills up with started work.*
- d) Ask the manager to raise the limit to 3 — *wrong: raising a limit makes sense if it systematically gets in the way, not at the first contact with it; otherwise the bottleneck gets hidden.*

**M-4. `choice`, L1–L2, concept M13.** The team started deploying five times more often, but the share of failed deployments rose from 5% to 30%. The manager asks whether things got better. What do you answer?
- a) Yes, deployment frequency is the main DevOps metric — *wrong: DORA considers throughput and instability metrics together; growth of one at the expense of the other does not mean improvement.*
- **b) Speed went up, stability went down; improvement is not proven — correct: DORA looks at five metrics together. Throughput — change lead time, deployment frequency and failed deployment recovery time; instability — change failure rate and deployment rework rate (the share of unplanned fix deployments, added in the 2024 report). You need to look at how recovery time and the share of fix deployments changed.**
- c) No, we should go back to infrequent deployments — *wrong: DORA research shows that in strong teams speed and stability grow together; you need to treat the causes of failures (tests, small batches, rollback), not the frequency.*
- d) This cannot be assessed without the number of lines of code — *wrong: code volume is not part of the DORA metrics and reflects value delivery poorly.*

**M-5. `match`, L0–L2, concepts M07, M10, M11, M12, M14.** Match the problem with the practice that solves it.

| Problem | Practice |
|---|---|
| Servers are configured by hand, each one a little differently | Automating routine work: the configuration is described once and applied the same way |
| We learn about the site being down from customers | Symptom-based alerts |
| Branches are merged once a month with heavy conflicts | Continuous integration |
| The same outages repeat, people hide mistakes | A blameless incident post-mortem |
| Work piles up at the review stage | A WIP limit |

A common mistake is to link "hide mistakes" with monitoring: monitoring will show the outage but will not create the safety in which people talk about their mistakes; that is done by the culture of post-mortems. The name "infrastructure as code" for the first row will appear in the IaC block (`forward: [I01]`, one look-ahead per lesson under the rule in `01`, section 6.1).

**M-6. `docfind`, L1–L2, step 3, concepts M07–M09.** "Find in the Kanban Guide which practices it names as mandatory." `doc_ref: kanbanguides.org/english/` (the section on Kanban practices). **Answer:** defining and visualising the workflow; actively managing items in the workflow; improving the workflow. The check is a `choice` on what was found (six options, three correct); the log records whether the page was opened.

**M-7. `scene` (`scrub`), L0–L2, the "Incident: alert → post-mortem" explanation, concept M12.** Prediction: "at which step does the service work for customers again — before or after the cause is found?". Scrub to the step where `scene.step='mitigated' && !scene.causeKnown`. Failure debrief: "recovery comes before searching for the cause: first restore the service (roll back the change), then investigate".

### 8.2. Linux

**L-1. `predict`, L0–L1, concept L11.** What will the first column of `ls -l report.txt` show after `chmod 640 report.txt`?
- **a) `-rw-r-----` — correct: 6 = 4+2 (read and write) for the owner, 4 (read) for the group, 0 for others.**
- b) `-rw-r--r--` — *wrong: that is 644; the last digit 0 means others get nothing.*
- c) `-rwxr-----` — *wrong: that is 740; 6 does not include execute (1).*
- d) `-r--rw----` — *wrong: the digits are read left to right as owner, group, others, and 6 is `rw-`, not `r--`.*

L2 variant (`level_variants`): "After `chmod 640 report.txt` (owner `alice`, group `adm`), a process of the user `backup` from the `staff` group cannot read the file. How do you give it read access without changing the permissions of others and without touching the file's group?" → `setfacl -m u:backup:r report.txt` (step 4, `beyond_course`, `doc_ref: man:setfacl(1)`), checked with `getfacl` and a read as `backup`.

**L-2. `choice`, L1–L2, concepts L25, L17, L39.** The disk is 100% full. You deleted a large log of the `report` service: `rm /var/log/report/app.log`. `df -h` still shows 100%. Why?
- a) `df` shows data with a delay, you need to wait a minute — *wrong: `df` reads file system data immediately.*
- **b) The `report` process keeps the file open; while at least one file descriptor is open, the space is not freed — correct: `rm` removes the name, and the data lives on while the file is open. To find such files: `ls -l /proc/<pid>/fd | grep deleted` or `lsof +L1`; to free the space, make the service reopen the log (the signal it understands for this, or a restart). For the future, truncate the log rather than delete it: `: > app.log` or `truncate -s 0 app.log`.**
- c) The file moved to the trash — *wrong: `rm` on the command line has no trash.*
- d) The server must be rebooted — *wrong as a cause: a reboot will close the file and free the space, but the explanation is the open descriptor, and on production a reboot for this is unnecessary downtime.*

**L-3. `fill`, L0–L2, concept L24.** Show the log of the `ssh` service for the last hour.
**Answer (checked by effect):** for example, `journalctl -u ssh --since "1 hour ago"` or `journalctl -u ssh.service --since -1h`. Check: the simulator recorded a journal query with the filter `unit=ssh.service` and a start no earlier than an hour ago. Debrief of common wrong answers: `systemctl status ssh` — shows only the last lines, not an hour; `journalctl --since "1 hour ago"` without `-u` — the log of the whole system. A separate debrief line: "not all services log to journald: by default nginx writes to `/var/log/nginx/error.log` and `access.log`, and `journalctl -u nginx` will mostly show start and stop". Hence a separate `choice` task "Where do you look for the cause of an nginx 502?" in the Networks quiz, where nginx has already been introduced.

**L-4. `choice`, L1–L2, concept L17.** On a 4-core server, `uptime` shows `load average: 4.00, 3.95, 3.90`. What does it mean?
- a) The server is 400% loaded and is about to crash — *wrong: load average is not a percentage; on 4 cores a value of 4 means the cores are busy on average, but the queue is not growing.*
- **b) On average about 4 processes were either running or waiting for the CPU or I/O; for 4 cores this is a full but not excessive load, and you need to see what causes it — correct: in Linux the load average also counts processes in uninterruptible I/O wait (D), so a high load can occur with an idle CPU but a slow disk. The next step is `top` (the `%CPU`, `wa` columns) or `vmstat 1`.**
- c) 4 processes are running — *wrong: there are hundreds of processes on a server; load average counts only those that are running or waiting.*
- d) There were 4 errors in the last minutes — *wrong: this number has nothing to do with errors.*

**L-5. `predict`, L0–L2, concept L19.** There is no file `missing.txt`. What will `grep foo missing.txt; echo $?` print as the last line?
- **a) `2` — correct: grep returns 0 if it found a match, 1 if it did not, 2 on an error (for example, no file).**
- b) `1` — *wrong: 1 means "no matches" in an existing file; here grep could not open the file.*
- c) `0` — *wrong: 0 is success; a missing file is not success.*
- d) `127` — *wrong: 127 is returned by the shell when the command itself is not found, and grep was found.*

Tasks L-6 – L-11 are the "How the kernel isolates and limits" module, the foundation of the containers block (owner requirement R6). The word "container" is not used in them: it has not been introduced yet; the link to Docker and Kubernetes is shown after the task is passed.

**L-6. `predict`, L1–L2, concepts L17, L33.** The `java` process has PID 812. `ps -o nlwp= -p 812` shows `37`. What will `ls /proc/812/task | wc -l` print?
- **a) `37` — correct: the `task` directory contains a subdirectory for each thread (TID), and `nlwp` is their number; the first TID matches the PID (the main thread). To see threads together with processes — `ps -eLf`, the LWP column.**
- b) `1` — *wrong: one is only for a single-threaded process; threads share a PID (TGID) but have their own TIDs, and the kernel schedules threads.*
- c) An error: threads have no entries in `/proc` — *wrong: threads are visible in `/proc/<pid>/task/` and in `ps -eLf`.*
- d) The number of child processes — *wrong: child processes are separate PIDs with their own `/proc/<pid>` directories.*

**L-7. `choice`, L1–L2, concept L34.** `readlink /proc/1/ns/net` and `readlink /proc/2245/ns/net` print `net:[4026531992]` and `net:[4026532301]`. What does this mean?
- **a) Processes 1 and 2245 are in different network namespaces: they have different interfaces, addresses, routing tables and firewall rules. To enter the second one's namespace — `nsenter -t 2245 -n ip a`; to list all — `lsns -t net` — correct.**
- b) Process 2245 was started by another user — *wrong: the user does not change the namespace; that is done by `unshare`, `clone()` with `CLONE_NEW*` flags or `setns()`.*
- c) The number is the network interface number — *wrong: it is the inode number of the namespace object; the same number means the same namespace.*
- d) Process 2245 is a thread of process 1 — *wrong: threads of the same process share namespaces.*

**L-8. `choice`, L1–L2, concept L34.** You ran `unshare --pid --fork --mount-proc bash` and executed `ps -ef` inside. What will you see?
- **a) Only `bash` with PID 1 and `ps` itself — correct: a new PID namespace, and `--mount-proc` mounts a fresh `/proc` that shows only the processes of this namespace.**
- b) All host processes with new numbers — *wrong: processes of the parent namespace are not visible from inside the child; visibility goes only the other way.*
- c) All host processes as usual — *wrong for this command; that would be the case without `--mount-proc`: `ps` would read the old `/proc` (misconception `linux.ps-reads-kernel-directly`).*
- d) An error: PID 1 can only be systemd — *wrong: PID 1 is the first process of its namespace, whatever it is.*

**L-9. `task`, L0–L2, concepts L35, L18. OOM-kill drill.** The environment is tier B (`lab-debian`). "The `hog` process eats memory. Limit it to 32 MB without restarting it, and prove that the kernel kills it when it goes over."
- Check by `09` facts: before triggering, `cgroups[procs~@pid(hog)].memory.max<=32M` with `keep: procs[cmd=hog].pid=@start.pid(hog)`; then `cgroups[path~@cg(hog)].memory.events.oom_kill>=1 && !procs[cmd=hog]`; the learner enters a line from `dmesg` containing `Memory cgroup out of memory` or `oom-kill`, and it is present in the guest kernel log.
- `fail`: `memory.max=max` — "the group is created, the limit is not written"; the process is in the root group — "the PID was not moved into `cgroup.procs`: the limit applies only to processes of the group"; writing to `memory.limit_in_bytes` — "this is the cgroups v1 interface; in v2 the file is called `memory.max`".
- After passing: "this is exactly what `docker run -m 32m` and `resources.limits.memory` in Kubernetes will do" — and the K-4 debrief refers to this task.

**L-10. `fill`, L1–L2, concepts L36, L12.** "Allow `/usr/local/bin/web` to listen on port 80 as the user `student` without giving them root."
Answer by effect: `sudo setcap cap_net_bind_service=+ep /usr/local/bin/web`; check — `getcap` shows the capability, the `web` process running as `student` listens on `:80` (`net.listen[port=80].pid=@pid(web) && procs[cmd=web].user=student`). `forbid`: `chmod u+s` and running via `sudo` — "that is the whole of root, and only one privilege is needed". Debrief: "root in Linux is a set of separate kernel capabilities; to see them for a process — `grep Cap /proc/<pid>/status` and `capsh --decode=<mask>`".

**L-11. `choice`, L1–L2, concept L37.** Overlay directories: `lowerdir=/img`, `upperdir=/up`, `merged=/m`. You ran `rm /m/etc/motd`, and the file was in `/img`. What is on disk?
- **a) `/img/etc/motd` is in place, and a whiteout (character device 0:0) appeared in `/up/etc/motd` — correct: the lower layer does not change, the deletion is recorded in the upper one. Modifying a file, by contrast, copies it up (copy-up).**
- b) The file is deleted from `/img` — *wrong: lower layers are read-only; layer reuse relies on this.*
- c) Nothing changed, `rm` returned an error — *wrong: deletion is allowed in merged.*
- d) The file was moved to `/up` — *wrong: copy-up happens on modification, not on deletion.*

**L-12. `choice`, L1–L2, concept L38 (idea).** A process has all the necessary permissions, but the `mount` system call is forbidden to it — the call returns `EPERM` instead of executing. Which kernel mechanism does this?
- **a) A seccomp filter: the process has received a list of allowed system calls in advance, and the kernel rejects the rest — correct.**
- b) cgroups — *wrong: cgroups limit resources (memory, CPU, number of processes), not the set of calls.*
- c) mount namespace — *wrong: a separate mount namespace changes *what* is visible but does not forbid the call.*
- d) Permissions on the `/bin/mount` file — *wrong: this is about a system call, not a program.*

### 8.3. Networks

The main principle of the block (owner requirement R8) is to first ask which layer broke. Every task has a `layer`, and N-6 checks the principle itself.

**N-1. `order`, L0–L2, concepts N08, N05, N15, N14, N16, `layer: mixed`.** What happens when you run `curl https://shop.example/` for the first time: (1) the TLS handshake and certificate check, (2) a DNS query for the name shop.example, (3) the HTTP request `GET /`, (4) the TCP handshake with the server's address, (5) the HTTP response.
**Answer: 2 → 4 → 1 → 3 → 5.** Debrief by the first divergence: TLS before TCP — "an encrypted channel needs an already established channel"; TCP before DNS — "to establish a connection you need an address, and so far it is known only by name"; HTTP before TLS — "in HTTPS the request already goes inside the encrypted channel".

**N-2. `choice`, L1–L2, concepts N13, N16, N19, `layer: L7`.** nginx sits in front of the application and returns `504 Gateway Timeout` to the user. What is most likely?
- a) The application is not running — *wrong in most cases: if nobody is listening on the port, the connection is refused immediately, and nginx returns 502 Bad Gateway.*
- **b) The application accepts connections but does not manage to respond within the proxy timeout, for example, it is waiting for a slow database query — correct: 504 means the proxy waited until the timeout. `error.log` will contain `upstream timed out (110: Connection timed out) while reading response header from upstream`. The same code occurs on a connection *establishment* timeout (`while connecting to upstream`) — when a firewall silently drops packets.**
- c) The site name does not resolve — *wrong: then the client would not have reached nginx at all.*
- d) The site's certificate has expired — *wrong: the client would have aborted the connection at TLS before the HTTP request; nginx would not have returned a response code.*

**N-3. `fill` (number), L0–L2, concept N02, `layer: L3`, generator `subnet`.** How many addresses can be assigned to hosts in the subnet `192.168.10.0/26`?
**Answer: 62.** A /26 mask leaves 6 bits for hosts, which is 64 addresses; the network address (.0) and the broadcast address (.63) are not assigned to hosts. Debrief of wrong answers: 64 — "forgot the network and broadcast addresses"; 26 — "that is the mask length"; 254 — "that is /24"; 63 — "subtracted only one reserved address". Parameters: a mask from /24 to /30, a random network.

**N-4. `choice`, L0–L2, concepts N08, N09, N12, `layer: L7`.** `ping 8.8.8.8` works, `ping google.com` says `Temporary failure in name resolution`. Where is the problem?
- a) No internet access — *wrong: packets reach 8.8.8.8 and come back, so there is a route.*
- **b) Name resolution does not work: a wrong or unreachable DNS server in the settings — correct. The next step is to see which server is used (`resolvectl status` or `/etc/resolv.conf`) and query it directly: `dig google.com @<server>`.**
- c) google.com blocks ICMP — *wrong: it never got as far as sending ICMP — the name did not turn into an address.*
- d) A wrong default gateway — *wrong: with a wrong gateway `ping 8.8.8.8` would not work either.*

**N-5. `match`, L0–L2, concepts N13, N09, N12, N03, N23.** Match the tool with the question it answers.

| Question | Tool |
|---|---|
| Which process is listening on port 443? | `ss -ltnp` |
| What address does the name have and which server gave it? | `dig` |
| Through which hops do packets go to an address? | `traceroute` |
| Through which interface and gateway will a packet to this address leave? | `ip route get <address>` |
| What is actually transmitted over the network? | `tcpdump` |

Common mistakes: `ping` instead of `traceroute` ("ping tells you whether the packet gets there, but not by which path"); `netstat` instead of `ss` — `warn`: counted with the note "`netstat` is outdated and not installed by default in many distributions".

**N-6. `match`, L0–L2, concept N07, "which layer".** Match the symptom with the layer where you should look first.

| Symptom | Layer |
|---|---|
| `ip a` shows `state DOWN`, `NO-CARRIER` | L1–L2 (link) |
| `ping 10.0.0.1` from your own subnet → `Destination Host Unreachable`, `ip neigh` shows `FAILED` | L2 (ARP) |
| `ping` to the gateway works, `ping 8.8.8.8` → `Network is unreachable` | L3 (route) |
| `curl` hangs before the connection is established, `ss` shows `SYN-SENT` | L4 (connection, firewall) |
| `curl` → `SSL certificate problem: certificate has expired` | TLS (L6 in OSI vocabulary) |
| A `502 Bad Gateway` response from nginx | L7 |

Debrief: "we search from the bottom up until the symptom is explained; 'the problem is at L3' is the vocabulary the team speaks and the first question on call".

**N-7. `choice`, L0–L2, concepts N07, N12, N13, `layer: L4`.** `ping 10.0.0.5` works, `curl http://10.0.0.5:8080` waits and fails with a timeout. At which layer do you look?
- **a) L4 on the path to the port: a firewall silently drops TCP to 8080 or the service listens on the wrong address; L3 is fine — ping proved that — correct. Next step: `ss -ltn` on the server and `tcpdump -n port 8080` — do SYNs arrive.**
- b) L3, no route — *wrong: ICMP reaches the address and comes back.*
- c) L7, an application error — *wrong: it never got to HTTP, the connection was not established; an application error would have given a response code.*
- d) L2, ARP — *wrong: without ARP ping would not have worked either.*

**N-8. `order`, L0–L2, the DHCP protocol (catalogue, basic level), concept N10, `layer: L7`.** Arrange the messages: Request, Offer, Discover, Ack. **Answer: Discover → Offer → Request → Ack.** Debrief: "Discover is broadcast because the client does not yet have an address; Request comes after Offer because the client could have received several offers and chooses one; after Ack the address can be used".

**N-9. `choice`, L1–L2, the HTTP/3 protocol (catalogue, intermediate level), `layer: L4`.** The site runs on HTTP/2; after HTTP/3 was enabled, nothing changed for the office staff. The office firewall allows only TCP 80/443. Why?
- **a) HTTP/3 runs over QUIC, that is, over UDP 443; blocked UDP makes the browser stay on HTTP/2 over TCP — correct.**
- b) HTTP/3 requires a different certificate — *wrong: the certificate is the same; TLS 1.3 is built into QUIC.*
- c) HTTP/3 uses port 8443 — *wrong: the port is the same, 443, but UDP.*
- d) Browsers do not support HTTP/3 — *wrong: the major browsers support it.*

**N-10. `choice`, L2, the VXLAN protocol (catalogue, experienced level), `layer: L2`.** A VXLAN overlay is set up between nodes, the physical network MTU is 1500. Small requests go through, large responses hang. Most likely?
- **a) VXLAN encapsulation adds 50 bytes; the inner interface MTU must be no more than 1450, otherwise large packets do not get through (especially if ICMP "fragmentation needed" is filtered) — correct.**
- b) VXLAN does not support TCP — *wrong: it encapsulates whole L2 frames.*
- c) IPsec must be enabled — *wrong: encryption is not related to size.*
- d) ARP is overloaded — *wrong: ARP does not depend on the response size.*

Bank rule: each protocol in the `03` catalogue (DHCP, ARP, ICMP, TCP, UDP, DNS, HTTP, TLS, SSH; NTP, SMTP, SFTP, HTTP/2, QUIC, WebSocket, gRPC, VLAN, NAT; BGP, VXLAN, Geneve, IPsec, WireGuard, mTLS, OSPF) has at least three tasks from the protocol card: `order` on the exchange steps, `match` "header field ↔ layer", `choice` "how it breaks" with distractors from neighbouring layers, `docfind` "how to observe" (a filter in `man tcpdump`). The build generates drafts from the card, and the author edits them. The "Networks" block exam has at least one task on a catalogue protocol of the learner's level.

### 8.4. Containers

**D-1. `bugfind`, L0–L2, concepts D08, D15, D16.** The task from section 3.1: in the Dockerfile `COPY . .` comes before `RUN npm ci`. **Answer: line 3; the fix is `COPY package*.json ./` first, then `RUN npm ci`, then `COPY . .`.** Any code change changes the `COPY . .` layer, and all layers after the changed one are rebuilt, so dependencies are installed every time.

**D-2. `choice`, L0–L2, concepts L34, L35, D06.** What do all containers on one host have in common that virtual machines on one hypervisor do not?
- **a) A single kernel of the host operating system — correct: a container is a host process in its own namespaces and cgroup, which you set up by hand in the Linux block; each virtual machine has its own kernel on top of virtual hardware. That is why a container starts in a fraction of a second, and a program that needs a different kernel (for example, a Windows application on a Linux host) cannot be run in a container without a VM: an image has no kernel, only files.**
- b) Its own lightweight kernel instance in each image — *wrong: there is no kernel in an image (misconception `docker.image-contains-kernel`); `uname -r` is the same inside and outside the container.*
- c) A shared IP address — *wrong: by default each container has its own network namespace and its own address in the bridge network.*
- d) Processes of one container are visible in another — *wrong: the PID namespace shows a container only its own processes.*

**D-3. `predict`, L1–L2, concepts D11, D13.** The following commands were run (between the first and the second, they waited for the database to be ready, `until pg_isready`):
```bash
docker run -d --name db -e POSTGRES_PASSWORD=pw postgres:16
docker exec db psql -U postgres -c "CREATE TABLE t(x int)"
docker rm -f db
docker run -d --name db -e POSTGRES_PASSWORD=pw postgres:16
```
Is the table `t` in the new container?
- a) Yes, the container has the same name — *wrong: the name is just a label; the new container is a new object with a new writable layer.*
- **b) No; the data stayed in the anonymous volume of the old container, which is not attached to the new one — correct: the postgres image declares a `VOLUME` for the data directory, so Docker created an anonymous volume; `docker rm -f` without `-v` did not delete it, but the new container got a new empty volume. The right way is a named volume: `-v pgdata:/var/lib/postgresql/data`. To find the lost volume: `docker volume ls -f dangling=true`.**
- c) No, the data was deleted irreversibly — *wrong: the anonymous volume remains on disk until it is deleted (`docker volume prune`).*
- d) Yes, the data is stored in the postgres:16 image — *wrong: the image is immutable; writes in a running container do not go into the image.*

The variant with `postgres:18` changes the path in the debrief: since version 18 the image declares the volume at `/var/lib/postgresql`, and the data lives in a version subdirectory (`/var/lib/postgresql/18/docker`); the named volume must be mounted at `/var/lib/postgresql`.

**D-4. `choice`, L1–L2, concepts D08, D09, D17, L37.** The Dockerfile has two lines: `RUN apt-get update && apt-get install -y build-essential` and, next, `RUN rm -rf /var/lib/apt/lists/*`. The image did not get smaller. Why?
- a) `rm` does not work inside `RUN` — *wrong: it works, and the files are not in the final file system.*
- **b) Each `RUN` instruction creates a new layer; deletion in the next layer writes a whiteout and only hides the files, while the bytes stay in the previous layer — correct (the same mechanism as in L-11): you need to clean up in the same instruction, and not carry build tools into the final image at all (a multi-stage build).**
- c) Docker caches deleted files — *wrong: the issue is not the build cache but how layers work.*
- d) You need to run `docker image prune` — *wrong: prune deletes unused images entirely but does not shrink the layers of an existing one.*

**D-5. `choice`, L1–L2, concepts D12, N13, `layer: L4`, the "network" boundary.** A container is run with `-p 8080:80`. `curl localhost:8080` on the host gives `Connection reset by peer`. Inside the container `ss -ltn` shows `LISTEN 127.0.0.1:80`. What is going on?
- a) The ports are mixed up, it should be `-p 80:8080` — *wrong: the host port comes first, the container port second; the application listens on 80 inside — the ports are correct.*
- **b) The application listens only on the loopback interface of its network namespace; traffic from the host arrives at the container's `eth0`, where nobody is listening — correct: the application must be configured to listen on `0.0.0.0:80`. A common failure with applications that listen on `localhost` by default — Flask, Vite, many debug servers.**
- c) The host firewall blocks 8080 — *wrong: blocking would give a timeout or a refusal on the host, not a connection reset; besides, the internal cause is already visible in `ss`.*
- d) The container has no IP address — *wrong: it has an address in the bridge network, otherwise port publishing would not work at all.*

Tasks D-6 – D-12 cover anatomy, the six boundaries and nesting (owner requirement R7).

**D-6. `order`, L1–L2, concept D10 (anatomy).** Arrange whom `docker run nginx` passes through on the way to the nginx process: (1) `runc` (or `crun`) creates namespaces and the cgroup and does `exec`, (2) the `docker` CLI sends a request over the `/var/run/docker.sock` socket, (3) `containerd-shim` starts and remains the parent of the container process, (4) `dockerd` validates the request and hands the job to `containerd`, (5) `containerd` prepares the file system snapshot and the OCI bundle (rootfs + `config.json`).
**Answer: 2 → 4 → 5 → 3 → 1.** Debrief: the shim starts before runc and calls it; runc exits right after the process starts, and the shim remains the parent — that is why restarting dockerd with `live-restore` does not kill containers. If the learner puts 1 before 3: "then who is the parent of the process once runc has already exited?".

**D-7. `predict`, L1–L2, concepts D11, L18, the "process and signals" boundary.** The Dockerfile ends with the line `CMD node server.js` (shell form). Roughly how long will `docker stop app` take and what is the container's exit code?
- **a) ≈ 10 seconds, code 137 — correct: in shell form PID 1 is `/bin/sh -c`; sh does not forward SIGTERM to the child node, Docker waits for the timeout (10 s by default) and sends SIGKILL (128 + 9). The fix is the exec form `CMD ["node", "server.js"]`, `exec` in the startup script, or `--init` (tini) if zombies also need reaping.**
- b) Instantly, code 0 — *wrong: that would be the case in exec form with an application that handles SIGTERM.*
- c) ≈ 10 seconds, code 143 — *wrong: 143 = 128 + 15, the process would have exited from SIGTERM, but SIGTERM was received by sh, not node.*
- d) The container will not stop — *wrong: after the timeout SIGKILL arrives, and it cannot be caught.*

**D-8. `choice`, L1–L2, concepts D12, N17, `layer: L3`, the "network" boundary.** What does `-p 8080:80` actually do in the default mode?
- **a) Adds a DNAT rule in the `DOCKER` chain of the `nat` table: packets to host port 8080 get the destination address `<container IP>:80`; for requests from the host itself to `localhost`, `docker-proxy` also works — correct. To see it: `iptables -t nat -L DOCKER -n` or `nft list ruleset`.**
- b) Opens a port in the firewall — *wrong: this is destination address redirection, not a permission.*
- c) Creates a second interface in the container — *wrong: the container has one interface (`eth0` at the end of a veth), only the packet's destination address changes.*
- d) Copies traffic into the container through a shared socket — *wrong: the packet travels over the network through the `docker0` bridge and the veth.*

**D-9. `choice`, L0–L2, concept D12, `layer: L7`, the "network" boundary.** Containers are started with `docker run -d --name db postgres:16` and `docker run -d --name api …` without `--network`. `api` cannot connect to `db:5432`: `could not translate host name "db"`. Why?
- **a) The default bridge network has no built-in DNS for container names; it exists only in user-defined networks — correct: `docker network create shop` and run both with `--network shop`.**
- b) Port 5432 is not published with `-p` — *wrong: `-p` is needed for access from the host; containers in the same network see each other's ports without publishing.*
- c) Postgres has not started yet — *wrong: then it would be a connection error, not a name resolution error.*
- d) `db` must be added to the host's `/etc/hosts` — *wrong: the name is resolved inside the `api` network namespace; the host has nothing to do with it.*

**D-10. `task`, L1–L2, the "configuration and identity" boundary.** `docker run -v ./data:/data -u 1000 app` fails with `permission denied: /data/db.sqlite`. On the host `ls -ln data` shows the owner `0 0` and mode `755`. Fix it without using `chmod 777` and without running the container as root.
Check: the container is `running`, the file is created in `./data` on the host; `forbid`: `files['./data'].mode=0777`, `containers[name=app].user=0`. Debrief: "the UID inside and outside is the same number unless a user namespace is enabled; `chown 1000 data` on the host, or a container user matching the directory owner".

**D-11. `match`, L0–L2, the six boundaries.** Match the symptom with the boundary where you look for the cause.

| Symptom | Boundary |
|---|---|
| `Permission denied` when writing to a mounted directory | Configuration and identity (UID) |
| After `docker rm` and a new run, uploaded files are gone | Storage (the overlay upper layer) |
| `docker logs` is empty, but the application works | I/O and logs (writes to a file, not to stdout) |
| `docker stop` waits 10 seconds, code 137 | Process and signals (PID 1) |
| `curl` from the host — reset, inside the application listens on `127.0.0.1` | Network |
| The container is killed, code 137, `dmesg` shows oom-kill | Host kernel (cgroup memory) |

**D-12. `task` (tier B), L0–L2, the "Hardware → VM → containers → nesting" explanation.** "Measure: (1) how long the `crun run demo` container takes to start in your v86 machine; (2) how long a second v86 machine takes to boot (the 'one more VM' button). Enter both numbers and answer why the difference is what it is."
Check: the numbers are compared with the bus log (`crun` time from `cmd.done`, the second machine's boot from the `machine.ready` event) with a ±20% tolerance; `uname -r` is the same inside and outside the container, `ps -e | wc -l` is different (the learner marks what matched and what did not); `dmesg | grep -i hypervisor` shows that the browser machine itself is a VM. `explain` on key points: "a VM has its own kernel, which has to be booted"; "a container is a process of an already running kernel"; "in the cloud, containers usually run inside VMs — as here, in v86".

### 8.5. Kubernetes

**K-1. `order`, L1–L2, concepts K02–K08, K11, K12, K27.** What happens after `kubectl apply -f deploy.yaml` (a new Deployment), in order: (1) the kubelet on the node starts the containers through the runtime, (2) the API server validates the object and stores it in etcd, (3) the ReplicaSet controller creates Pod objects, (4) the scheduler assigns the pods to nodes, (5) the Deployment controller creates a ReplicaSet.
**Answer: 2 → 5 → 3 → 4 → 1.** Debrief: all components learn about new objects by watching the API server, not by calling each other; the scheduler before the pods are created — "it has nothing to assign: it works with pods that do not yet have a node"; the kubelet before the scheduler — "the kubelet only starts pods assigned to its node".

**K-2. `bugfind`, L1–L2, concepts K14, K15, K16.** The Service `web` has endpoints, but `curl http://web` from a neighbouring pod returns `Connection refused`. Find the line with the error.
```yaml
apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 8080
```
The container in the pod declares `containerPort: 80` and listens on 80.
**Answer: line 10 (`targetPort: 8080`), the fix is `targetPort: 80`.** Check by effect: after `kubectl apply`, `curl http://web` from the `client` pod returns 200. Debrief of clicks: line 7 (`app: web`) — "the selector matches the pod labels: there are endpoints after all; if it did not match, the EndpointSlice would be empty"; line 9 (`port: 80`) — "this is the port of the service itself, and the client connects exactly to it".

**K-3. `choice`, L0–L2, concept K33.** A pod is in the `CrashLoopBackOff` status. What do you do first?
- a) Delete the pod — it will be recreated — *wrong: a new pod from the same template will crash the same way; and the evidence will be lost.*
- **b) Look at the log of the crashed run (`kubectl logs <pod> --previous`) and the events (`kubectl describe pod <pod>`) — correct: the container starts and crashes; the cause is usually in the application log (a missing variable, no access to the database) or in the events (OOMKilled, a failed liveness probe).**
- c) Increase the number of replicas — *wrong: more replicas means more crashing pods.*
- d) Reboot the node — *wrong: the pod crashes because of itself, not because of the node; besides, this would affect all other pods on the node.*

**K-4. `choice`, L1–L2, concepts K22, L35, L18.** A pod has `Last State: Terminated, Reason: OOMKilled, Exit Code: 137`. What happened?
- a) The application crashed with a bug in the code, and 137 is its own code — *wrong: 137 = 128 + 9, the process was killed by SIGKILL.*
- **b) The container exceeded its memory limit (`resources.limits.memory`), and the kernel killed the process — correct: the *container's* limit becomes `memory.max` of its cgroup (as in drill L-9); when it is exceeded, the OOM killer fires. It also happens without exceeding its own limit: if the whole node runs out of memory, the kernel picks a victim by `oom_score_adj`, which the kubelet sets according to the pod's QoS class. Next, figure out whether it is a leak or the limit is too small (`kubectl top pod`, memory graphs), and only then change the limit.**
- c) The node ran out of disk — *wrong: when disk runs out, the pod is evicted (Evicted), not OOMKilled.*
- d) The kubelet restarted the container because of a liveness probe — *wrong: then the reason would be `Error` or `Completed`, and the events would show `Liveness probe failed`.*

**K-5. `match`, L1–L2, concepts K04–K08, K15, K27.** Match the component with its responsibility.

| Component | What it is responsible for |
|---|---|
| kube-apiserver | The single entry point: validates and writes objects, sends changes to watchers |
| etcd | Stores the cluster state |
| kube-scheduler | Chooses a node for a pod |
| kube-controller-manager | Brings the actual state to the desired one (ReplicaSet, Deployment, nodes) |
| kubelet | Starts and watches the containers of pods on its node |
| kube-proxy | Rules on the node by which traffic to a Service reaches the pods |

A common mistake is to attribute node selection to the kubelet or container startup to the scheduler; the debrief shows on the "Kubernetes from blocks" diagram (`08`, section 6.4) that the scheduler only writes the node name into `spec.nodeName`.

Tasks K-6 – K-10 are Kubernetes networking (owner requirement R9); the environment is the hybrid cluster (`05`, section 5.9) or kube-lite with an iptables model. Addresses are as in the course cluster: podCIDR `10.42.N.0/24`, ClusterIP `10.43.0.0/16`.

**K-6. `task`, L1–L2, concepts K14, K41, N17, `layer: L3`. "Where the ClusterIP goes".** "The `web` service has ClusterIP `10.43.12.7`. Find on the node the rule by which a packet to this address gets the address of a specific pod, and enter the pod address and port."
Expected path: `ssh worker-1`, `iptables -t nat -L KUBE-SERVICES -n | grep 10.43.12.7` → the `KUBE-SVC-…` chain → `KUBE-SEP-…` → `DNAT to:10.42.1.9:8080`. Check: the entered `IP:port` ∈ `k8s.objects[kind=EndpointSlice][metadata.labels.kubernetes.io/service-name=web].endpoints.addresses`; if there are two addresses, both are needed, plus the `0.5` probability on the first one's rule (`statistic mode random`). Debrief: "the ClusterIP is not on any interface (`ip a` will not show it): in iptables mode it is only a NAT rule; in IPVS mode kube-proxy puts the address on the service interface `kube-ipvs0`; in Cilium with kube-proxy replacement the translation is done by eBPF". L2 variant: a cluster with Cilium, `cilium service list` — "there are no iptables rules, the service is implemented in eBPF".

**K-7. `choice`, L1–L2, concept K14, `layer: L3`.** `ping 10.43.12.7` (a ClusterIP, kube-proxy in iptables mode) does not respond, but `curl 10.43.12.7` returns 200. Is the service broken?
- **a) No: DNAT rules are created only for the service ports over TCP and UDP; nobody handles ICMP to a ClusterIP — correct.**
- b) Yes, the EndpointSlice is empty — *wrong: then curl would not work either.*
- c) CoreDNS is broken — *wrong: this is an address, not a name.*
- d) A NodePort is needed — *wrong: a ClusterIP is reachable from inside the cluster without a NodePort.*

**K-8. `predict`, L1–L2, concept K16, `layer: L7`.** In a pod in the `shop` namespace, `/etc/resolv.conf` contains `search shop.svc.cluster.local svc.cluster.local cluster.local` and `options ndots:5`. (a) Which name will the resolver try first for `getent hosts api`? (b) How many A queries will go out before the external `api.example.com` is resolved, if all search suffixes return NXDOMAIN?
**Answer: (a) `api.shop.svc.cluster.local`; (b) 4** — the name has 2 dots, which is fewer than 5, so first the three suffixes from `search`, then the name as is; with AAAA queries, twice as many. Debrief: search is built from the pod's namespace (hence not `api.default.svc.cluster.local`); the remedy for external names is a trailing dot (`api.example.com.`) or `dnsConfig.options` with `ndots: 2`. The reference number of queries is obtained by running `coredns-lite` in CI.

**K-9. `order`, L1–L2, concepts K14, K16, K41, K42, K33. The diagnostic order for "a pod could not reach a service".** Arrange the checks: (1) NetworkPolicy in the service's namespace (`default-deny`, selectors); (2) the name resolves (`getent hosts api.<ns>`); (3) the service has ready endpoints (`kubectl get endpointslices -l kubernetes.io/service-name=api`); (4) the target pod responds directly by `IP:port`; (5) the service port and `targetPort` match the container port.
**Answer: 2 → 3 → 5 → 4 → 1** — along the packet's path, from the name to the pod; NetworkPolicy last, because traffic is open by default and a policy is a frequent but not the first cause. Partial credit is given for the longest correct subsequence. This is also the order of the "a pod could not reach a service" drill (9.2) and of pool F of the "On-call shift".

**K-10. `choice`, L1–L2, concept K42.** A NetworkPolicy was applied that allows `db` to accept connections only from `api`, but `curl` from the `test` pod to `db` still gets through. The cluster was installed with flannel without add-ons, and nothing was changed.
- **a) The cluster's CNI does not implement NetworkPolicy: the API server accepted the object, but there is nobody to enforce it — correct. The policy is enforced by the CNI (Calico, Cilium, kube-router); flannel does not enforce it.**
- b) The policy applies only to new pods — *wrong: it applies to pods matching the selector immediately.*
- c) kube-proxy must be restarted — *wrong: kube-proxy does not apply NetworkPolicy.*
- d) Pods are isolated by default, the policy is redundant — *wrong: by default everything is allowed.*

Tasks K-11 and K-12 are the reconciliation loop and the bridge to operators (owner requirement R10); they use the visualiser and the controller sandbox of `05` (section 6, screens 3, 5a, 5b; QuickJS).

**K-11. `scene`, L0–L2, the "Reconciliation loop" explanation, concepts K02, K03, K11.** On the left, YAML in etcd (`replicas: 3`), on the right, the pods, in the middle, the ReplicaSet controller.
- Part 1 (`scrub` + `predict`): "Delete one pod and stop scrubbing at the step where the controller detected the divergence. How many pods will it create?" → prediction `1`, `scene.step='diff-detected'`.
- Part 2 (`break`): "The controller is paused. Delete two of the three pods, then change `replicas` from 3 to 4. How many pods will the controller create after the pause is lifted, and in how many reconciliation passes?" → **3 pods in one pass** (4 desired, 1 present). Debrief: the controller does not replay events, it compares the current state with the desired one (level-triggered); misconception `k8s.controller-replays-events`.
- Part 3 (`param`): "Change `replicas` to 2 without touching the pods. Which pod will the controller delete?" The reference is computed by kube-lite; the debrief explains the selection order: first those not assigned to a node, then those not ready, then the younger ones.

**K-12. `task` "Your own controller", L1–L2, concepts K03, K30.** In the `05` sandbox (screen 5b, CRD `Website`) the learner writes `reconcile` in TypeScript. The check is not by text but by running it against a kube-lite perturbation scenario:

```yaml
check:
  run_controller:
    resource: { kind: Website, spec: { replicas: 2, message: "hi" } }
    perturbations: [create, delete-deployment, set-replicas-4, change-message, kill-node-1, noop-x5, delete-website]
    expect:
      - converges_within_ticks: 5           # after each perturbation actual == desired
      - no_actions_when_equal: true         # on noop-x5 an empty action list, the Deployment resourceVersion does not change
      - no_duplicates: true                 # at no moment are there more objects than desired
      - owner_refs_set: true                # created objects have ownerReferences to Website; delete-website removes everything
```

Failure debrief by item: "the controller creates a Deployment on every pass, even when everything matches — you are comparing not with the actual state but with the last action"; "after `delete-website` a Service remained — there are no `ownerReferences`". Passing K-12 is the condition for opening pet project 8; its first defence question: "show the place in your Go code that was the line `if (!have) create` in the browser controller".

### 8.6. IaC (Terraform, Ansible)

**I-1. `choice`, L1–L2, concept I06.** A colleague deleted the `terraform.tfstate` file, but the cloud resources remained. What will `terraform plan` show?
- a) "No changes" — Terraform will ask the cloud what already exists — *wrong: Terraform maps configuration resources to real objects through the state; without the state it does not know that these VMs are its own.*
- **b) That all resources need to be created again, even though they exist — correct: the state stores the link "resource address in code ↔ object ID in the cloud". Without it, `apply` will create duplicates or fail on a name conflict. Recovery — `terraform import` or an `import` block; prevention — a remote state with locking and versioning.**
- c) That all resources will be deleted — *wrong: Terraform can only delete what it knows about from the state.*
- d) A syntax error — *wrong: configuration syntax does not depend on the state.*

**I-2. `predict`, L1–L2, concept I05.** After changing the boot disk image of a VM, `terraform plan` shows `-/+ resource "…" "web" { … } # forces replacement`. What will happen on `apply`?
- **a) The VM will be deleted and a new one created: everything on its local disk will be lost, the internal and external addresses may change — correct: `-/+` and `forces replacement` mean recreation, because this attribute cannot be changed in place. If losing it is not acceptable, move the data to a separate disk, pin the address, consider `lifecycle { create_before_destroy = true }`.**
- b) The running VM will get the new image without a reboot — *wrong: the boot disk image of a running machine does not change.*
- c) The VM will reboot with the new disk, and the data will be preserved — *wrong: that would be `~` (an in-place change), and the plan explicitly says replacement.*
- d) Nothing, until you run `terraform apply -refresh-only` — *wrong: `apply` will apply the plan; the `-refresh-only` mode (the replacement for the deprecated `terraform refresh` command) only updates the state to match reality.*

**I-3. `choice`, L0–L2, concept I02.** The Ansible task `shell: echo "export APP_ENV=prod" >> ~/.bashrc` was run three times. What is in the file and what is the right way?
- a) One line: Ansible is idempotent — *wrong: modules that check state are idempotent; `shell` just runs the command every time.*
- **b) Three identical lines; the right way is the `lineinfile` module with `line: "export APP_ENV=prod"`, which adds the line only if it is not there — correct: idempotency is a property of the task, not of the tool. A repeated run of a correct playbook gives `changed=0`.**
- c) An error on the second run — *wrong: appending to a file does not cause errors.*
- d) The file will be overwritten with one line — *wrong: `>>` appends; `>` would overwrite the whole `.bashrc`, which is even worse.*

**I-4. `bugfind`, L1–L2, concepts I02, I10, I11.** Why does every run of this playbook restart nginx, even when the configuration has not changed? Find the line and fix it.
```yaml
- hosts: web
  become: true
  tasks:
    - name: Install nginx
      ansible.builtin.apt:
        name: nginx
        state: present
    - name: Deploy config
      ansible.builtin.template:
        src: nginx.conf.j2
        dest: /etc/nginx/nginx.conf
    - name: Restart nginx
      ansible.builtin.service:
        name: nginx
        state: restarted
```
**Answer: line 15 (`state: restarted`).** `restarted` always restarts the service. The fix: give the template task `notify: Restart nginx`, and move the restart into `handlers`; the handler runs only if the template changed the file. Check: `idempotent` (the second run gives `changed=0`) and `run` (after the template changes, the handler fired exactly once). Debrief of clicks: line 7 (`state: present`) — "this is idempotent: the package is installed only if it is missing"; line 2 (`become: true`) — "needed to install packages and write to /etc; it has nothing to do with restarts".

**I-5. `choice`, L0–L2, concepts I04, I10, I13.** You need to create a network and three VMs in the cloud, and then install nginx on them and deploy the configuration. How is it sensible to divide the work?
- **a) Terraform creates the network and the VMs, Ansible configures what is inside the VMs — correct: Terraform declaratively manages cloud resources and keeps their state; Ansible brings the OS and applications into the desired shape over SSH.**
- b) Everything with Ansible: it also has cloud modules — *wrong as the best answer: there are modules, but Ansible does not keep the state of cloud resources: it will not figure out that it should delete a VM that disappeared from the playbook, and it has no reliable plan of cloud changes like `terraform plan` (`--check --diff` works well for files and packages inside a VM, but is not supported everywhere by cloud modules).*
- c) Everything with Terraform via `remote-exec` — *wrong as the best answer: HashiCorp itself calls provisioners a last resort; errors in them are hard to reproduce and they are not idempotent.*
- d) Create the VMs by hand in the console, Ansible for configuration — *wrong: what is created by hand cannot be reproduced or reviewed — exactly the problem IaC solves.*

**I-6. `scene` (`param`), L1–L2, the "`plan`/`apply` and state" explanation, concept I06.** "Remove the `web` resource from the state with the 'forget' button (`terraform state rm`). Predict what the next `plan` will show, then scrub." → `+ create` for `web` while the VM is alive in the cloud (a duplicate); the debrief refers to I-1.

### 8.7. CI/CD

**C-1. `bugfind`, L1–L2, concepts C08, C13, M15.** The `deploy` job deploys to production from any branch, including experimental branches. Find what is missing and fix it.
```yaml
stages: [test, build, deploy]
test:
  stage: test
  script: [npm ci, npm test]
build:
  stage: build
  script: [docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA ., docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA]
deploy:
  stage: deploy
  script: [./deploy.sh $CI_COMMIT_SHA]
```
**Answer: `deploy` has no rule; it needs `rules: [{ if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH' }]` (it can be extended with `when: manual` for continuous delivery).** Check: `lint: gitlab-ci` (the `.gitlab-ci.yml` JSON Schema from the GitLab repository, section 13); `run` on the `feature/x` branch — the `deploy` job is not in the pipeline; `run` on `main` — it is. `warn`: `only/except` is counted with the note "outdated syntax, use `rules`".

**C-2. `choice`, L0–L2, concept C12.** The pipeline needs the registry password. Where do you store it?
- a) In `.gitlab-ci.yml`, the repository is private anyway — *wrong: the password will stay in the Git history forever and will be available to everyone with access to the code, including future copies and forks.*
- **b) In a CI/CD variable with the "masked" and "protected" flags (or in an external secrets store) — correct: the secret does not get into the repository, is hidden in job logs and is available only to protected branches.**
- c) In an `ARG` in the Dockerfile — *wrong: the `ARG` value is visible in `docker history` and in the image metadata; for build secrets there is `RUN --mount=type=secret`.*
- d) In a `.env` file next to the code — *wrong: `.env` is easy to commit by accident, and it still sits in plain text on the build machine.*

**C-3. `predict`, L0–L2, concept C08.** In the pipeline from task C-1 (already with the rule), the `test` job failed on `main`. What happens to `build` and `deploy`?
- **a) They will not start (status skipped): by default, jobs of later stages run only if all jobs of the previous stages succeeded — correct: this is the default `when: on_success` behaviour.**
- b) They will start: stages are independent — *wrong: jobs within one stage are independent, not the stages.*
- c) `build` will start, `deploy` will not — *wrong: `build` is in the stage after `test`, the rule is the same.*
- d) The pipeline will restart `test` automatically — *wrong: without `retry` there is no repeat; and if a repeat is needed, that is a reason to look into the test (C-5).*

**C-4. `choice`, L1–L2, concept C15.** Why are images for deployment tagged with the commit SHA (`app:3f9c2ab`) rather than `latest`?
- **a) A commit tag unambiguously indicates which code is deployed; a rollback is a deployment of the previous tag; `latest` changes meaning with every build, and two nodes can run different versions under the same tag — correct.**
- b) `latest` is forbidden in the registry — *wrong: it is not forbidden; it is just set by default.*
- c) A SHA tag makes the image smaller — *wrong: a tag is a name, it does not affect size.*
- d) Without a SHA tag the build cache does not work — *wrong: the layer cache does not depend on tags.*

**C-5. `choice`, L1–L2, concepts C10, M11.** Tests pass in 80% of runs. The team added `retry: 2`, and the pipeline is almost always green. What is wrong with that?
- a) Nothing: the pipeline is green — the goal is achieved — *wrong: the goal of a pipeline is a reliable signal, not the colour green.*
- **b) The retry hides the cause: a flaky test may be catching a real race in the code, and the team stops trusting the pipeline and gets used to restarting red runs — correct: a flaky test must be fixed or temporarily moved out of the blocking set with a ticket to fix it and a deadline.**
- c) The pipeline will take three times longer — *wrong as the main problem: time grows only on retries; the main harm is false trust.*
- d) `retry` cannot be set on tests in GitLab — *wrong: technically it can.*

**C-6. `scene` (`break`), L1–L2, the "`git push` → deployment" explanation, concepts C11, C15.** "The registry token expired. Predict which job will turn red and which version users will see, then scrub." → `build` (on `docker push`), users see the previous version: "the deployment did not start, production was not touched — this is exactly how a pipeline should behave".

### 8.8. Monitoring

**P-1. `choice`, L0–L2, concepts O01, O11, O12.** A user request goes through five services and takes 3 seconds. What do you use to find on which of them 2 seconds are lost?
- a) Metrics — *wrong as the best answer: metrics will show that a service's average response time has grown, but will not link a specific request to its path through all the services.*
- b) Logs — *wrong as the best answer: you can find it if every log has a common request ID, but assembling the picture by hand takes long.*
- **c) Tracing — correct: a trace is a tree of segments (spans) of one request across all services with the duration of each; the longest segment is visible immediately.**
- d) Alerts — *wrong: an alert reports a problem but does not localise it.*

**P-2. `predict`, L1–L2, concepts O03, O06.** What will `rate(http_requests_total[5m])` return?
- **a) The average rate of increase of the counter in requests per second over the last 5 minutes, separately for each label set — correct; `rate` also accounts for counter resets when the process restarts.**
- b) The number of requests over 5 minutes — *wrong: that is `increase(http_requests_total[5m])`, roughly `rate × 300`.*
- c) The current value of the counter — *wrong: that is just `http_requests_total`.*
- d) The number of requests per minute — *wrong: the unit of `rate` is per second, regardless of the window.*

**P-3. `choice`, L1–L2, concept O08.** Which alert is it better to wake the on-call engineer at night for?
- a) `CPU > 80%` on any server — *wrong as the best answer: high CPU may be normal (batch processing) and does not mean users are suffering; such alerts teach people to ignore notifications.*
- **b) The share of 5xx responses above 2% for 5 minutes (`for: 5m`) — correct: this is a symptom that users feel; `for` filters out short spikes. The SRE recommendation is to page on symptoms, and keep causes (CPU, disk) on dashboards and in low-priority notifications.**
- c) Any `ERROR` line in the log — *wrong: there are many errors in logs and not all are important; the on-call engineer will drown.*
- d) A restart of any pod — *wrong: restarts are a normal part of how Kubernetes works; it matters if they repeat and hit users.*

**P-4. `match`, L1–L2, concept O03.** Match the metric with its type.

| Metric | Type |
|---|---|
| How many requests have been processed since the process started | counter |
| How much memory is free right now | gauge |
| The distribution of response time by buckets (≤ 0.1 s, ≤ 0.5 s, ≤ 1 s …) | histogram |
| The number of connections in the pool right now | gauge |

A common mistake is to call "the number of connections" a counter: a counter only grows (except for a reset on restart), while the number of connections goes up and down.

**P-5. `choice`, L0–L2, concepts O04, O05.** A Grafana panel has been empty for the last 10 minutes, and the query `up{job="shop"}` in Prometheus returns 0. What does it mean?
- **a) Prometheus cannot scrape metrics from the target: the process crashed, the port is unreachable over the network, or the `/metrics` path returns an error — correct: `up` is a service metric that Prometheus writes itself on every scrape; 0 means the scrape failed. The Targets page will show the error text.**
- b) Grafana broke — *wrong: Prometheus itself says the scrape failed; Grafana only shows the absence of data.*
- c) The service has no requests — *wrong: with no requests the counters stay put, but `up` equals 1.*
- d) Prometheus is overloaded — *wrong: then other targets would fail too, and `up` is written for each target separately.*

**P-6. `scene` (`param`), L1–L2, the "scrape → storage → PromQL → alert → notification" explanation, concepts O04, O06, O08.** "`scrape_interval` is 30 s. Predict the largest `rate(...[window])` window at which the graph becomes empty, then find it with the slider." → a window smaller than 60 s (at least two points are needed in the window). The second part: "an error spike lasted 3 minutes with `for: 5m` — what state is the alert in?" → `pending`, no notification will go out.

## 9. The career block

The career block runs in parallel with the technical ones, not after them, and opens according to the graph (`01`, section 6.2, concepts R01–R10, P01–P03). The concept R05 "situational question" is split in two (the graph change is with `01`): **R05a** "situational question on networks and Linux" (requires R04, N16, L24) and **R05b** "situational question on Kubernetes" (requires R05a, K33). The mock interview (R07) requires R05a. Schedule:

| What | When it opens | Why |
|---|---|---|
| Answer structure (R04), "I don't know" (R06), job posting analysis (R01) | After methodology | From the first month it is clear what you are learning and why |
| Résumé draft (R02) | After Docker | There are passed exams to show |
| Self-presentation (R03) | After the first pet project | There is something to talk about |
| Mock interview (R07) | After R05a and the first pet project; the situational question comes from networks and Linux | The "504" network drill is possible without Kubernetes |
| Situational questions on Kubernetes (R05b) | After K33 | The interviewer takes questions only from blocks with `practicing` status |
| Applications | After the Kubernetes exam or at ≥ 60% on three real job postings | Checklist: "start early — don't wait for perfect readiness" |

The decision differs from the first revision of `01`, section 5 ("self-presentation after Docker, mock interview after Kubernetes"): self-presentation needs material, and a mock interview without Kubernetes is useful and legitimate according to the graph if the situational question is about networks. The same text is added to `01`, section 5.

### 9.1. Levels and diagnostics

The levels of the career block (L0 — has not had IT interviews, L1 — has had non-technical interviews or ones in another field, L2 — has had technical interviews as a developer or admin) and the five-task diagnostic are set in `01`, section 4.3. The diagnostic does not close modules but sets the emphasis:

| Level | Typical candidate | Main risk at an interview | What is reinforced in the block |
|---|---|---|---|
| L0 | A salesperson, manager, teacher, courier moving into DevOps | Fear, inarticulateness in technical matters, "memorised commands", no stories from practice | Self-presentation, the "command → logic" translator, drills out loud, at least 5 mock interviews, translating experience into the résumé |
| L1 | Tech support, tester, analyst, manager in IT | Describes experience in process terms rather than system terms; underestimates their incident experience | Translating support experience into DevOps wording, situational questions, the depth of "why" |
| L2 | Programmer, admin | Arrogance toward "simple" questions, answers with commands rather than the mechanism; cannot say "I don't know" | Answer structure, talking about trade-offs, "I don't know", questions about process and reliability |

### 9.2. Interview preparation: trainers

**The "command → logic" translator (R04).** The main rule of the checklist is "explain the logic, don't quote commands". The trainer shows a "bad" answer consisting of a command and asks to rewrite it as a mechanism following the scheme "what → why → how it works → when you use it". Example: "How do you check DNS? — `nslookup host`" → "DNS turns a name into an address. The client asks the resolver; if the resolver does not know the answer, it goes from the root servers to the zone's server and caches the answer for the TTL. I check with the resolver directly — `dig name` — and, if the answer is strange, I ask the authoritative server to separate a cache problem from a record problem". The check is a rubric with key points (every question with `purpose: interview` has `key_points`) plus local checks: the answer has all four parts of the scheme (the neural network marks them with quotes), and the share of text taken by commands is less than a third. 40 cards at launch: 5 per block from the list of mandatory questions below.

**The documentation ladder in the career block.** The same translator at steps 3–5 teaches backing up words with a source — this is the answer to the follow-up "how do you know that?", which is asked more and more often in interviews.

| Step | What the learner does | How it is checked |
|---|---|---|
| 1 | Under the reference answer, a line "this comes from: kubernetes.io, Concepts → Services" | Not checked |
| 2 | The reference answer is shown together with the documentation fragment it relies on; the learner marks which sentence of the reference the highlighted line confirms | `match` sentence ↔ line |
| 3 | After their answer, the learner backs up one claim with a link to a place in the documentation | `docfind`: a link with an anchor ∈ the question's `doc_ref`, or confirmed by the same mirror fragment |
| 4 | A drill requires an out-of-course step (for example, `ss -K` or `kubectl debug`); the mentor answers "where did you look?" | The effect of the step in the sandbox |
| 5 | The mock interview has a "live sandbox with documentation" phase (9.3): a task that was not in the course, documentation is open, the interviewer watches | Goals by facts + the "Method" rubric |

**Mandatory junior questions.** The list is compiled from the checklist, public question collections (roadmap.sh, DOU "300+ questions", enigmai.ru, devops-exercises, KodeKloud) and typical requirements of 2025–2026 job postings (section 9.8); each question has a reference answer following the scheme and key points:

| Block | Questions |
|---|---|
| Methodology | What DevOps is and what a DevOps engineer does; continuous integration, delivery and deployment; what steps a pipeline consists of; DORA metrics; Kanban and Scrum; WIP and why a limit speeds things up; SLO and error budget; a blameless incident post-mortem |
| Linux | What happens at boot and what systemd is; process and thread; a signal, a zombie process; permissions and `chmod 755`; what `top` and load average show; hard and symbolic links; where to look if the disk is full; how the kernel isolates a process: namespaces, cgroups, capabilities; what the OOM killer is and how to see it |
| Networks | What happens when you type an address in the browser; the OSI and TCP/IP models; how you debug a network — which layer you start with; ARP and the broadcast domain; DHCP; TCP and UDP; DNS; NAT; 502 and 504; what a /24 subnet is; for L2 — HTTP/2 and HTTP/3, what VXLAN is and why it is in Kubernetes |
| Containers | A container and a virtual machine (via namespaces and cgroups) and how they nest inside each other; image, layer, container; what happens on `docker run` (dockerd, containerd, shim, runc); `COPY` and `ADD`, `CMD` and `ENTRYPOINT`; why `docker stop` waits 10 seconds; multi-stage builds; volumes; Docker networks and `-p` |
| Kubernetes | Architecture: control plane and nodes; Pod, Deployment, Service, Ingress and Gateway; readiness and liveness; what happens on `kubectl apply`; the reconciliation loop; how a pod on one node reaches a pod on another; what a ClusterIP is and where it "lives"; how you debug "a pod can't see a service" and CrashLoopBackOff; Helm |
| IaC | What IaC is and why; Terraform state; plan and apply; idempotency; Terraform and Ansible; playbook, role, handler |
| CI/CD | GitLab CI: stages, jobs, runners, artifacts, cache; where to store secrets; deployment strategies and rollback; GitOps |
| Monitoring | Metrics, logs, traces; the Prometheus pull model; metric types; `rate`; symptom-based alerts; SLI in PromQL (the SLO concept is in methodology) |

**Separate cards for the two questions that "everyone confuses"** (checklist, section 2):

*A container and a virtual machine.* Reference: "A virtual machine emulates a computer: it has its own OS kernel on top of a hypervisor, it is heavier and starts longer, but the isolation is stronger and you can run a different OS. A container is an ordinary host process to which the kernel shows its own view of the system through namespaces (its own processes, network, file system, host name) and whose resources it limits through cgroups. The kernel is shared, so a container is light and starts in a fraction of a second, but you cannot run the kernel of a different OS in it, and a kernel vulnerability affects everyone. They do not exclude each other: in the cloud, containers almost always run inside VMs, Kubernetes is also installed on bare metal, and with KubeVirt virtual machines run inside Kubernetes — this is how platforms such as Cozystack work, for example. I choose a VM when I need strong isolation or a different OS, and a container for packaging and running applications". Key points: its own kernel and a shared kernel; namespaces; cgroups; consequences (speed, density, isolation); nesting. Check trainer: in 3 minutes the learner shows this by hand in the Linux lesson "How the kernel isolates" — `unshare --pid --fork --mount-proc bash` and `ps` (L-8) — and task D-12 (a container versus a second v86 machine).

*Continuous integration, delivery and deployment.* Reference: "Continuous integration — developers frequently merge changes into a shared branch, and every merge is automatically built and checked by tests so that integration errors are found within minutes. Continuous delivery is the next step: every change that has passed the pipeline is ready to be released to production at any moment, but the release is started by a person. Continuous deployment — the release to production is automatic too, without a manual step; this requires good test coverage, monitoring and fast rollback". Key points: frequent merging + automated check; always ready, a manual decision; no manual step; prerequisites. Check — task M-1, an `order` of the three definitions and an oral answer to the mock interviewer.

**Situational drills (R05a, R05b).** "504 — what do you do?" and related questions check the method: whether the person goes from symptom to cause layer by layer, puts forward hypotheses, collects evidence before making changes, thinks about users. Explanation O-2 (5.2) shows the method before the first drill. A drill is a mix of interview and sandbox: the learner names the next step and a hypothesis, the trainer runs the step in the sandbox and shows the output, the learner continues. A step is accepted in one of three forms:

| Kind of step | How it is recognised | Without a neural network |
|---|---|---|
| A command | Executed in the sandbox; the step is recognised by the bus event and the facts | Yes |
| A choice of 4–6 "next steps" | `choice`; the options are reference steps and bad paths | Yes |
| Free text ("I'll look at the nginx log") | The neural network matches the text against the `expect_action` list and must return a step ID; if it cannot, it falls back to a choice | No: the drill can be completed with commands and choices |

The "504" drill (storyline and branching):

| Step | What the learner must do and say | What the sandbox shows | Scoring |
|---|---|---|---|
| 0 | Clarify: for everyone or for one user, always or sometimes, since when, what changed | The interviewer's answers: "for everyone, on the checkout page, since 14:10; there was a deployment at 14:05" | Clarifying before acting — +1 to "Method" |
| 1 | Confirm the symptom from outside, figure out who returns 504, name the layer | `curl -sv https://shop.example/checkout` → `HTTP/2 504`, `server: nginx` | Understood that 504 is returned by the proxy (L7), and DNS, TCP and TLS up to nginx work |
| 2 | The nginx error log (`/var/log/nginx/error.log`) | Variant A: `upstream timed out … while reading response header`; variant B: `… while connecting to upstream` | Distinguished "connected but waited for a response" from "did not connect" (L7 versus L4) |
| 3A | Query the application directly, bypassing nginx, and measure the time | `curl -w '%{time_total}' localhost:8000/checkout` → 35 s; `/health` → 0.01 s | Narrowed it down to a specific handler |
| 4A | The application log and database metrics | A slow SQL query after the deployment (a new query without an index) or an exhausted connection pool | Found the cause based on evidence |
| 3B | Reachability of the upstream over the network | `ss -tn` shows `SYN-SENT`; `nft list ruleset` — a new `drop` rule on port 8000 | Found the cause based on evidence |
| 5 | Mitigate and fix | Roll back *the change that caused it*: the deployment (A) or the firewall rule (B); then the index or a fix to the rule; re-check | Restore the service first, then fix; rolled back the right thing; checked the result |
| 6 | Status to the team and a post-mortem | The "message to chat" field and a four-line post-mortem (6.4) | The `incident.yaml` rubric |

Bad paths are flagged explicitly in the debrief: "immediately increased `proxy_read_timeout`" (hides the problem: users will wait 60 seconds instead of getting an error); "restarted everything" before reading the logs (evidence lost, the problem will return with the first wave of requests); "went to check DNS" (the site responds from nginx — DNS works; the hypothesis contradicts the observation); "rolled back the deployment" when the cause was "the `drop` rule" (rolled back something other than what changed).

**The drill rubric** (0–3 per criterion): **layer** — 0 not named; 1 named without evidence; 2 named based on evidence ("ping by IP works — L3 is fine"); 3 named and narrowed down as new evidence came in; **method** (hypotheses, clarifications); **evidence** (actions rely on the output); **safety** (no destructive steps before collecting evidence, service restoration first); **result**; **communication**.

The "disk full" drill (pool B of the "On-call shift"):

| Step | What the learner must do | What the sandbox shows | Scoring |
|---|---|---|---|
| 0 | Clarify: which partition, how fast it grows, what runs on the server | "Alert `DiskWillFillIn4Hours` on `/`, server `shop`" | Clarifying before acting |
| 1 | See which partition and how much | `df -h` → `/` 97% | Confirmed the symptom |
| 2 | Find where the space is | `du -xh / --max-depth=2 \| sort -h` → nothing large (variant A) or `/var/log/app` 6 GB (B) or `/var/lib/report/tmp` (C) | Went from the general to the specific |
| 3A | A discrepancy between `df` and `du` → deleted but open files | `ls -l /proc/*/fd 2>/dev/null \| grep deleted` or `lsof +L1` → `report` holds a deleted 5 GB log | Linked the discrepancy to an open descriptor (L-2) |
| 3B | A log without rotation | `ls -lh /var/log/app` → one 6 GB file, no `logrotate` for it | Found the cause |
| 4 | Free the space safely | A: the service reopens the log; B: `truncate -s 0`, set up rotation; C: clean the service's temporary files | Without deleting application data (`keep` on the hash) |
| 5 | Prevent a recurrence | A `logrotate` config or `SystemMaxUse` for journald; the alert already exists | A verifiable change |

Bad paths: `rm -rf /var/log/*` (deleted the evidence and the logs of other services); deleting an open file without restarting the service (the space will not be freed); rebooting the server as the first action.

The "pod in CrashLoopBackOff" drill (R05b, pool C):

| Step | What the learner must do | What the sandbox shows | Scoring |
|---|---|---|---|
| 0 | Clarify: what changed, whether all replicas are affected | "At 14:05 a new version was deployed, all pods of the new version crash" | Linked it to the change |
| 1 | Look at the state and the events | `kubectl get pods` → `CrashLoopBackOff`, `RESTARTS 6`; `kubectl describe pod` → `Back-off restarting failed container`, `Exit Code 1` (A) or `OOMKilled` (B) | Read the termination reason |
| 2A | The log of the crashed run | `kubectl logs <pod> --previous` → `KeyError: DATABASE_URL` | Found evidence before acting |
| 2B | The memory limit versus consumption | `kubectl top pod`, a 64Mi limit; the application needs 90Mi at startup | Distinguished a leak from a too-small limit |
| 3 | Mitigate | `kubectl rollout undo deployment/<name>` | Restore the service first |
| 4 | Fix through Git and the pipeline | A variable in the manifest or a Secret; a limit based on data, not "a bit more" | No `kubectl edit` bypassing Git if deployment is via GitOps |

Bad paths: `kubectl delete pod` (a new pod will crash the same way, the `--previous` evidence is gone); increasing replicas; removing the memory limit altogether.

The "a pod could not reach a service" drill (R05b, pool F) follows the K-9 order: name → Service → EndpointSlice → `targetPort` → the pod directly → NetworkPolicy:

```yaml
# bank/career/drills/k8s-svc-unreachable.yaml
steps:
  - expect_action: "getent hosts / nslookup orders from the api pod"
    sandbox_output: { v1: "NXDOMAIN orders.api.svc.cluster.local", default: "10.43.14.7" }
  - expect_action: "kubectl get svc orders -n orders"
  - expect_action: "kubectl get endpointslices -n orders -l kubernetes.io/service-name=orders"
    sandbox_output: { v2: "ENDPOINTS: <none>", v4: "ready: false", default: "10.42.1.5:8080" }
  - expect_action: "compare port/targetPort with containerPort"
    sandbox_output: { v3: "targetPort: 8080, containerPort: 80" }
  - expect_action: "curl podIP:port directly"
  - expect_action: "kubectl get networkpolicy -n orders"
    sandbox_output: { v5: "default-deny   <none>   podSelector: {}" }
bad_paths:
  - { action: "kubectl delete pod", why: "Recreating changes neither the selector nor the policy; events are lost" }
  - { action: "look at iptables right away", why: "The cheap layers are checked first: the name, the object, the endpoints" }
checks:
  pass: "http.api_to_orders.status=200"
  forbid: ["k8s.objects[kind=NetworkPolicy][spec.podSelector={}][spec.ingress~'{}']"]   # "open everything" does not count
```

Other drills in the same format: "the site became slow", "can't log in via SSH", "502 after a deployment", "the pipeline is red", "alert: node memory at 95%", "the certificate expires tomorrow", "node NotReady". The "disk full", "CrashLoopBackOff" and "a pod could not reach a service" tables are mandatory for the MVP because they are in the "On-call shift" pools; the rest are written following the same pattern. Each drill has 3–5 cause variants by seed, so that the learner learns the method, not the answer.

**"I don't know" (R06).** The trainer asks a question deliberately beyond what has been covered (by the graph: an `unseen` concept) and scores the answer against a rubric: honestly admitted it; linked it to what they know ("I haven't worked with Consul, but judging by the task it's service discovery — I know how DNS solves this in Kubernetes"); said how they would find out and named a specific source (documentation with a section, an experiment in the sandbox, asking a colleague). Making up an answer is 0 on "honesty", and this is the only criterion where a zero fails the whole mock interview.

### 9.3. A mock interviewer on your own neural network

**Connection.** The common mechanism for your own neural network (`09`, section 4; `08`, section 3.10): an OpenAI-compatible API (DeepSeek, OpenRouter, a local Ollama, etc.) or the `09` adapters; the key is stored in the learner's browser. DeepSeek has been tested for requests directly from the browser (decision 13). On connection, the interface says in one sentence: "the key is stored in this browser; create a separate key with a spending limit for the trainer".

**Voice.** Speech recognition is the Web Speech API (`SpeechRecognition`). The selection order:

1. `SpeechRecognition.available({ langs: ["ru-RU"], processLocally: true, quality: "conversation" })` (an interview needs the `conversation` mode, weak devices use `dictation`). `available` — local mode; `downloadable` or `downloading` — the product offers `SpeechRecognition.install({...})` with the same parameters and shows the size; the browser returns `downloadable` until the site has called `install()`, even if the package is already present, so calling `install()` is a normal step, not an exception.
2. `unavailable` — a choice between the browser's server-side recognition (with an honest note that the audio goes to the browser vendor's server) and Whisper in the browser via transformers.js: for Russian, `whisper-small` on WebGPU by default; without WebGPU, `whisper-base` on WASM with a warning about more errors; the model is downloaded once and cached.

The interviewer's speech synthesis is `speechSynthesis` with a system voice. The text mode is always available and is no worse for learning; voice is needed to train fluency and deal with fear, and it is offered from the second mock interview on.

**Interview script.** 45 minutes by default, like a typical junior technical interview:

| Phase | Minutes | Content |
|---|---|---|
| Introduction | 3 | The interviewer introduces themselves by role (team lead of the platform team) and explains the format |
| Self-presentation | 3 | "Tell me about yourself" — the self-presentation rubric (9.4) |
| Technical questions | 18 | 5–7 questions from the `purpose: interview` bank, only for blocks where the learner is at least `practicing`; for each, 1–2 follow-ups "why", "what if…", "how do you know that?" |
| Situational question | 8 | One drill from 9.2 in text form, without a sandbox: the interviewer answers what "the command showed"; before K33 only R05a (networks and Linux) |
| Live sandbox with documentation | 6 | Only from documentation step 5: a task that was not in the course (`beyond_course` from the block bank), in the sandbox, with documentation open; like the KTS interview (9.5) |
| Behavioural question | 4 | "Tell me about a conflict, a mistake, a time you didn't know what to do" — the STAR structure |
| Candidate's questions | 3 | The learner asks the company questions; assessed is whether there are any and whether they make sense (about process, on-call, mentoring) |

The questions are chosen by the product, not by the model: the model receives a list of questions with the reference answer, key points and allowed follow-ups, and conducts the conversation. This way the interview does not drift into topics the learner has not covered and does not break the concept order. The model's system instruction (abridged): "You are an interviewer for a junior DevOps position. Ask questions strictly from the list, one at a time. After an answer, ask no more than two follow-ups. Do not give hints and do not evaluate out loud during the interview. If the candidate says 'I don't know', ask how they would find out and where exactly they would look. Do not use terms from the `unknown_concepts` list. Speak briefly, like a real person".

**Scoring and debrief.** After the interview, a separate model call (temperature 0) receives the transcript, the reference answers and the rubric, and returns strictly JSON following the **product's single rubric schema** (the same for `explain`, the `07` post-mortem and the "On-call shift"): `criteria[{id, score, evidence, note}]`, where a binary item is a special case of the `{0, 3}` scale.

```json
{
  "answers": [
    {
      "q": "docker.vm-vs-container",
      "criteria": [
        { "id": "correctness",   "score": 2, "evidence": "a container shares the kernel with the host", "note": "no cgroups" },
        { "id": "structure",     "score": 1, "evidence": "well, it's like a VM, only lighter", "note": "the 'when you use it' part is missing" },
        { "id": "mechanism",     "score": 2, "evidence": "a process in its own namespaces" },
        { "id": "depth",         "score": 1, "evidence": null, "note": "no answer to the follow-up about isolation" },
        { "id": "honesty",       "score": 3, "evidence": "I don't know about seccomp, I'd look in the Docker documentation, the security section" },
        { "id": "communication", "score": 2, "evidence": "a 70-second answer, no long pauses" }
      ],
      "review_concepts": ["c:L34", "c:L35"],
      "model_answer_ref": "docker.vm-vs-container.answer"
    }
  ],
  "summary": { "strong": ["…"], "work_on": ["…"] }
}
```

The product checks the model's answer: every score above 1 must have `evidence`, and this quote must match a fragment of the transcript **fuzzily** — the normalised word-level Levenshtein distance must be no more than 0.15 (explanation O-5): a strict match would reset honest scores because of speech recognition errors. A score without a confirmed quote is reset to 1 and marked "not confirmed". This makes the score verifiable by the learner and protects against invented praise. Concepts from `review_concepts` go into the FSRS queue — the interview also works as repetition.

**The interview rubric** (`rubrics/interview.yaml`, 0–3 per criterion, with anchors):

| Criterion | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Correctness | Wrong in substance | Partially correct, with an error | Correct, a key point is missing | Correct, all key points |
| Structure (what → why → how → when) | No structure, a set of facts | One or two parts | Three parts | All four, in a logical order |
| Mechanism, not commands | Only commands or names | The mechanism is mentioned | The mechanism is explained | The mechanism is explained and linked to consequences |
| Depth (follow-ups) | Did not withstand the follow-up | Answered in general terms | Answered to the point | Answered and named a trade-off or limitation themselves |
| Honesty | Made it up | Evaded the answer | Admitted not knowing | Admitted it and named a specific source and place where they would find out |
| Communication | Impossible to understand | Confused, very long or monosyllabic | Clear | Clear, brief, with an example from their own practice |

The "ready for a live interview" threshold: an average score ≥ 2 across three mock interviews in a row and no 0 on honesty. This is not a certification, but a signal that "it's time to go to people".

### 9.4. Self-presentation, awkward questions, live mock interviews

**Self-presentation (R03).** A structure for 60–90 seconds: who I am and where I come from (one sentence, no apologising for the past); what I can do — with evidence (passed course exams, pet projects with a link); what I have done with my own hands — one specific story with a problem and a solution; why DevOps — a bridge from previous experience; what I am looking for. There are worked examples for three typical learners — a former salesperson ("negotiating with customers taught me to find out what a person really needs — in DevOps that's half of working with developers"), a support specialist ("for three years I handled incidents on the first line — now I want to prevent them"), a programmer ("I'm tired of my code taking two weeks to reach production"). Neither the product nor the neural network writes a ready-made self-presentation for the learner (`01`, section 14.3): the learner writes the text, records it by voice, and the trainer measures:

| What we measure | How | Norm |
|---|---|---|
| Duration | The recording timer | 60–90 s |
| Parts of the structure | The neural network marks each part with a quote; without a neural network, the learner marks the parts against a checklist | All five |
| Filler words | Local counting against a dictionary ("ну", "как бы", "типа", "короче", "в общем"; EN — "um", "like", "you know") in the transcript | < 1 per 15 seconds |
| Specifics | There is a number, a project name or a link | At least one |
| Apologies | A dictionary ("к сожалению" / "unfortunately", "я пока только" / "so far I only", "наверное, не подойду" / "I probably won't fit") | 0 |

The recording stays only in the learner's browser; the "compare with the previous one" button shows progress on these numbers.

**Awkward questions.** A separate deck with debriefs, trained the same way — by voice or text, with a rubric: "Why are you leaving sales?", "You have no experience, why should we hire you?", "What are your salary expectations?" (with market data from 9.8), "Tell me about a mistake you made", "What will you do if you can't cope with a task?", "Why not development?", "Where do you see yourself in two years?", "What did you use AI for in your pet project and how did you check it?". The last question is asked more and more often, and the checklist says directly: "vibe coding impresses no one these days" and "AI — understand and check the code, don't copy blindly". Reference: say honestly what AI did and where, and show how you checked it (tests, linters, going through every line of configuration, checking against the documentation).

**Live mock interviews.** The checklist requires at least 3–5 mock interviews before real ones. A neural network does not replace them: it removes inarticulateness, but not the fear of a live person. So after the second mock interview with the neural network, the product leads the learner to people and gives tools for it: a sheet "how to ask for a mock interview" with a message template; a list of platforms (GetMentor, Mentor in Tech, ADPList, the DevOps Kitchen Talks community, the `devops_ru` chat, section 12); an interviewer's form — the same rubric, a printable page or a link with which the interviewer scores from a phone (handoff via QR from the Sankofa engine, `08`, section 3.9), and the result returns to the learner's progress as a "live mock interview". Recordings of mock interviews on YouTube (DevOps Kitchen Talks publishes mock interviews of juniors, middles and seniors) are embedded as a "rate the candidate" exercise: the learner watches a fragment and scores it with our rubric, then sees the course author's scores. Rating other people's answers is a quick way to understand what good ones sound like.

### 9.5. How junior interviews work in 2025–2026 and what follows from it

Public sources and our hiring experience form the picture the whole block relies on:

- **The structure of the process** at Russian employers: a screening with a recruiter (15–30 minutes: motivation, expectations, format), a technical interview (60–90 minutes: theory by block, "what happens when…", a situational question), sometimes a practical task or a live sandbox, a final interview with the manager (team, motivation, soft skills). Take-home assignments are less common for juniors than for middles and are usually small: a Dockerfile and compose for an application, a simple pipeline, a playbook ([Tproger, a collection of take-home tasks for junior DevOps](https://tproger.ru/articles/nebolshaja-podborka-testovyh-zadanij-dlja-junior-devops-inzhenera)).
- **A live sandbox instead of theory.** KTS describes how it moved DevOps interviews to a trainer: in a clean cluster the candidate deploys nginx and provides a public link; googling and documentation are allowed, the screen is shared, interviewers give hints; then the tasks get harder (monitoring via Helm), and the level is determined by how far the candidate got ([Habr, KTS](https://habr.com/ru/companies/kts/articles/795277)). Our exams, the "live sandbox with documentation" phase and the drills deliberately repeat this format, and the documentation ladder prepares for the fact that "you can google" is not a relief but a test of the ability to search.
- **The reaction to AI.** Large companies (according to CNBC, as retold by Entrepreneur — Google, Cisco, McKinsey) brought back in-person stages because of candidates reading out neural network answers ([Entrepreneur](https://www.entrepreneur.com/business-news/google-mckinsey-reintroduce-in-person-interviews-due-to-ai/496041)); interviewing.io writes that companies' main response is to change the questions and the format themselves rather than to ban ([interviewing.io blog](https://interviewing.io/blog/how-is-ai-changing-interview-processes-not-much-and-a-whole-lot)). For a junior this means: the questions "why", "what if" and "how do you know" after an answer will always be there, and that is exactly what our mock interviewer trains for.
- **What they ask** is a stable set that matches across Russian and international collections: Linux, networks, Docker, Kubernetes basics, CI/CD, Git, IaC (Terraform state, Ansible idempotency), monitoring, Bash or Python scripting ([roadmap.sh, DevOps questions](https://roadmap.sh/questions/devops), [DOU, 300+ questions](https://dou.ua/lenta/articles/interview-devops/), [enigmai.ru, junior DevOps](https://enigmai.ru/prep/devops/junior/), [KodeKloud](https://kodekloud.com/blog/devops-interview-questions/)). In the international market, a cloud (AWS or another) and Terraform are more often expected as mandatory rather than desirable; in Russia, Zabbix next to Prometheus and domestic clouds are noticeably more common.

### 9.6. Résumé builder

**Data format.** The résumé is stored as JSON Resume ([jsonresume.org/schema](https://jsonresume.org/schema)) with an `x-trainer` extension: each skill and each experience item has an `evidence` field — a link to a passed exam, a pet project (repository) or a final exam report. This lets the linter check the main rule of a junior résumé: every claimed skill is backed by something that can be opened.

```json
{
  "basics": { "name": "…", "label": "Junior DevOps Engineer", "summary": "…" },
  "skills": [
    { "name": "Docker", "keywords": ["multi-stage", "compose", "volumes"],
      "x-trainer": { "evidence": ["exam:docker:passed:2026-10-02", "pet:3"] } }
  ],
  "projects": [
    { "name": "Shop: CI/CD + Kubernetes + monitoring", "url": "https://github.com/…",
      "highlights": ["GitLab CI pipeline: lint, tests, image build, deployment via Argo CD"],
      "x-trainer": { "pet": 3, "checks_passed": ["A1","A2","A4","A5"], "attest": "https://…/verify/…" } }
  ],
  "work": [
    { "name": "…", "position": "Sales manager", "x-trainer": { "relevance": "bridge" } }
  ]
}
```

**The résumé linter** (each rule is a check with an explanation; the learner can deliberately dismiss a warning, but not an error):

| # | Rule | Level |
|---|---|---|
| CV1 | The headline is the target role ("Junior DevOps Engineer", "DevOps engineer (intern)"), not the previous profession | error |
| CV2 | Each skill in the "Skills" section has `evidence`; a skill without backing is moved to "Familiar with" or removed | error |
| CV3 | A link to GitHub/GitLab with pinned pet projects; the pinned repositories have a README following the template | error |
| CV4 | Irrelevant experience is compressed to one line (position, company, years) or turned into a "bridge" (table below) | warning |
| CV5 | Experience and project items are action and result ("set up…, which reduced…"), not duties ("was responsible for…") | warning |
| CV6 | No empty phrases ("confident PC user", "stress-resistant", "fast learner") | warning |
| CV7 | Length: one A4 page for a junior | warning |
| CV8 | EN version: no photo, age or marital status (the norm of the international market) | error in EN |
| CV9 | Keywords of the target job posting (from the 9.7 analyser) appear where the learner has backing for them — and only there | hint |
| CV10 | Nothing invented: experience as a DevOps engineer is not claimed if there was none; a pet project is called a pet project | error |

**Translating previous experience.** The main value of the builder for a beginner is an honest translation of experience into wording a DevOps hiring manager understands. The learner chooses what they actually did and rewrites it in their own words:

| Was | How to rewrite it honestly | Why DevOps values it |
|---|---|---|
| Handling objections, negotiations | "Gathered customer requirements and translated them into tasks for the technical team" | Working with developers and the business is half of DevOps work |
| Maintained the CRM, built reports in Excel | "Automated reporting: exports, formulas, macros; cut manual work from N hours to M" | An inclination toward automation is the main DevOps tool |
| First-line support | "Handled up to N requests a day, localised problems using logs and reproduction steps, escalated with a description" | Incident experience and reading logs; checklist: "tech support experience is a plus, not a minus" |
| Wrote instructions for colleagues | "Wrote documentation and instructions for N people" | Documentation and runbooks |
| Led a shift, assigned tasks | "Planned the shift's work, tracked deadlines and workload" | Understanding the flow of work, kanban |
| Programmer (backend) | "Wrote Dockerfiles and pipelines for my services, took part in incident post-mortems" — only if they did | Ready for DevOps from the development side |
| Tester | "Automated tests and integrated them into CI" | CI is the core of the profession |

**Output.** Two versions: RU (for hh.ru and Habr Career, as text to paste into a form and as PDF) and EN (for LinkedIn, PDF). The PDF is produced by printing the page with a separate stylesheet in the magazine layout (6.6). The cover letter (R08) is a three-paragraph template (why this company — with a reference to something specific in the posting; what I can do of what is needed — with evidence; what I want and how I can be useful); the linter checks that the first paragraph would not fit any other posting (it contains the company name and a detail from the posting text).

### 9.7. The job posting analyser and search strategy

**The 60% rule.** Checklist: "if you match 60%, apply — the requirements are inflated on purpose". The analyser makes this rule measurable. The learner pastes the posting text; the product finds the requirements by a dictionary (about 400 terms, each mapped to graph concepts: "Kubernetes" → K01–K20, "GitLab CI" → C07–C14, "Zabbix" → a separate "out of course" label) and, if a neural network is connected, refines the analysis (mandatory and desirable requirements). Then it compares with the learner's state:

```
Posting: Junior DevOps, LLC "…"
Requirement             Wt    Your state                    Counted
Linux                   req   exam passed                   yes
Docker, compose         req   exam passed, pet project 3    yes
GitLab CI               req   modules C07–C12 mastered      yes
Kubernetes              pref  modules K01–K14 practicing    half
Ansible                 req   not started                   no
Zabbix                  pref  out of course                 no
Total: 64% (mandatory 75%)  →  apply
What to brush up before the interview: Ansible (modules I09–I12, ~8 h); Zabbix — read the overview (link)
```

The application threshold: ≥ 60% overall and ≥ 50% on mandatory requirements. Below that, the product does not forbid but says which two or three modules are missing.

**The application funnel is a flow board.** The tracker in the learner's browser is shown as the same board as in the methodology block (`flowlab`, display only): application → response → screening → technical interview → final → offer, with dates. The board shows flow metrics: card age ("an application without a response for 14 days — close it and don't wait"), throughput (applications per week), a cumulative flow diagram for the month and Little's law ("with 12 applications a week and an average path of 3 weeks, you have ~36 applications in progress"); explanation O-3 (5.2) shows this before the first application. The weekly goal is 10–15 meaningful applications with a cover letter tailored to the posting; this is realistic while working and studying at the same time. Every two weeks the product shows the conversion by stage and what to do about it: few responses — the résumé and rule CV9; responses but rejections after screening — self-presentation and motivation; rejections after the technical interview — drills and mock interviews on the failed topics.

**A retro after each interview.** A short form: what questions were asked (can be dictated), where it was hard, what you answered. The questions are matched against the bank; the concepts found go into the learner's FSRS, and questions that are not in the bank can be sent to the authors (anonymised). The checklist advises "going to interviews as practice" — the retro turns each interview into a lesson.

**Where to look.** Cards with up-to-date links (checked 18.11.2026, section 12): the Telegram job channel `@devops_jobs`, hh.ru and Habr Career, internship programmes of large companies (Yandex, Sber, T-Bank, T1 — recruitment dates change, so the card contains not dates but a link and advice to subscribe to notifications), programmes for women in IT (the checklist mentions Women in Tech), LinkedIn for the international market (a profile in English, the EN version of the résumé). Internships and "grow into it" vacancies are the main entry point for L0. According to Habr Career, the path from zero to a first job takes 9–15 months, including 2–4 months of active searching, and the competition is about 13 people per opening ([Habr Career, the DevOps profession](https://career.habr.com/professions/devops)); the product shows these numbers honestly at the start of the career block: a long search is a market norm, not a personal failure. The numbers and channel member counts are subject to the freshness rule (2.4) and are updated with every content release.

### 9.8. Market expectations for 2025–2026 and course coverage

| What is expected of a junior | Source of the expectation | Where in the course |
|---|---|---|
| Confident Linux: processes, systemd, logs, permissions, disks, isolation | All question collections; checklist — MUST | The Linux block, the exam, the "disk full" and "SSH" drills |
| Networks: DNS, TCP/IP, HTTP, NAT, layer-by-layer troubleshooting | Checklist; "a weak spot even for experienced people" | The "Networks" block, the "504" drill |
| Docker: images, layers, compose, multi-stage | Habr Career top skills; checklist — MUST | The containers block, pet projects 1–3 |
| Kubernetes: architecture, basic objects, networking, debugging | The first skill in the Habr Career list; "the move from junior to middle is tied to Kubernetes" | The Kubernetes block, pet projects 7 and 7b |
| CI/CD (GitLab CI in Russia, GitHub Actions in the international market) | Job postings; checklist | The CI/CD block, all pet projects |
| Ansible, Terraform | Top skills | The IaC block, pet project 5, final exam A3 |
| Prometheus, Grafana; sometimes Zabbix | Top skills; checklist | The monitoring block, pet project 6 |
| Bash and Python for automation | Top skills (Python, Bash) | Bash in the Linux block; Python is out of course, in pet project 2 only reading the bot's ready-made code |
| Git | All job postings | The CI/CD block (Git) |
| Cloud | The international market; in Russia, domestic clouds | Real VMs (from the end of the "Networks" block, Kubernetes, the final exam) |
| Soft skills: explaining, listening, saying "I don't know" | Checklist; all final interviews | The whole career block |

Salary benchmarks are shown in the "Your expectations" card (an awkward question from 9.4) with a date and a source. The figures from the first revision (Habr Career: a junior with less than a year of experience — 80–160 thousand ₽; career.hh.ru: a DevOps engineer range of 180–600 thousand ₽ based on August 2025 job postings, [career.hh.ru](https://career.hh.ru/profession/53)) are older than 12 months as of the document date, so under the freshness rule the card is set to `hold: true` until it is updated from both sources before release.

Certificates: for a junior in Russia they barely affect hiring and are not part of the mandatory path. For an experienced learner (L2) aiming at Kubernetes roles or the international market, the product suggests the CKA ([Linux Foundation](https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/)) after the Kubernetes block: the CKA exam is practical, in a terminal, with only the official documentation open, and exam E of the Kubernetes block together with step 5 of our ladder prepares for it.

## 10. Pet projects

The eight checklist projects plus a kubeadm cluster (7b, the third Kubernetes step) are tied to blocks: a project opens when the exams of the required blocks are passed and the required concepts are introduced, and each one adds one or two new skills on top of already verified ones. Projects are done on a real machine — a VPS for 300+ ₽ a month, as the checklist advises, a VM in the learner's cloud or a local VM on their computer; this is the first place in the course where the learner runs into real failures that do not exist in the sandbox. The concept "your own machine in the cloud: ordering, key, public IP, security group, cost, deletion" (`linux.vps`, code L44), by decision of `01`, is in the last module of the Linux block, so projects on a VPS are legitimate after it. A pet project is done for oneself and defended at an interview; a README following the template is mandatory (what it is and why; a diagram; how to run it; decisions and why; what broke along the way and how I fixed it; what I would do next). The "what broke" section is the most important one for an interview: the checklist directly advises talking about the stack and the mistakes.

For every project on a VM the same rule applies as for the final exam (6.5): before ordering — a cost estimate per `providers.yaml`, while working — a counter, at the end — a cleanup step or an explicit decision to "keep the VM" with its monthly price. The check is the agent `trainer-check run --track pet<N> --nonce …` (self-check) or presented mode on machines registered with `trainer-exam enroll`.

| # | Project (from the checklist) | Opens after | Mandatory | Acceptance criteria | How it is checked |
|---|---|---|---|---|---|
| 1 | A business-card site in Docker with CI/CD on a VPS: nginx + Docker + GitLab CI + auto-deploy | Linux (including `linux.vps`), Networks, Docker, CI/CD | L0, L1 | The site over HTTPS with a valid certificate; a push to main deploys the new version in under 5 minutes without manual actions; login to the VPS by key only; no deployment from branches | Agent: the certificate, the version header on the page matches the SHA of the last commit, `sshd -T`; the GitLab/GitHub API: the last main pipeline succeeded |
| 2 | A Telegram bot deployed to a public cloud | Docker, CI/CD; the course bot template (ready-made Python code — programming is out of course; the learner writes the Dockerfile, CI and deployment) | optional | The image is under 150 MB, a multi-stage build, not running as root; the bot token is not in the repository; the bot restarts after a crash; the log is visible in the cloud | Agent: image size and user, the restart policy; gitleaks on the repository; the learner sends the bot a one-time code, and the bot replies with the same code |
| 3 | docker-compose + a GitLab pipeline: frontend + backend + DB | Docker, CI/CD | L0, L1, L2 | `docker compose up` brings everything up from scratch with one command; DB data survives `down`/`up`; services have a healthcheck and a readiness dependency; the pipeline builds and tests all three images; logs of all services go to stdout | Agent: the compose project, healthcheck in the healthy state, a marker in the DB after recreation; `yaml_path` on compose and the pipeline |
| 4 | A VPN server on a VPS: WireGuard or OpenVPN, nftables | Linux (including `linux.vps`), Networks (including the `net.m14` "VPN and WireGuard" module) | L0, L1 | The client connects, traffic goes through the VPS (the client's external address = the VPS address); only SSH and the VPN port are open on the VPS; firewall rules survive a reboot | Agent: `wg show` (a handshake fresher than 3 minutes), nftables rules, their persistence after `reboot`; the learner opens a page that shows their external address and compares |
| 5 | Automation with Ansible: provision a VPS, a set of servers and the OS | IaC | L1, L2; L0 — as part of the final exam | One playbook with roles brings a clean VM to the state of project 1 or 3; the second run gives `changed=0`; secrets in ansible-vault; VMs are created by Terraform | The learner pastes the output of the second run; the agent compares the VM state with the expected one; `plan_expect` on the `terraform plan` output |
| 6 | Monitoring: Prometheus + Grafana (+ Loki) | Monitoring | L0, L1, L2 | A dashboard with the four golden signals for project 1 or 3; node_exporter; an alert on the error rate and on disk filling with `for:`; the alert arrives in Telegram; logs in Loki | Agent: targets `up == 1`, rules loaded; "cause a failure" and paste the text of the received alert with a one-time code |
| 7 | A cluster with Helm and Argo CD (the second Kubernetes step): k3s, kind or minikube on one VM or your own machine | Kubernetes (stage 2, track `track:k8s/r1`) | L0, L1, L2 | The application of project 3 as a Helm chart; the image from a real registry, built by the learner's CI; Ingress or Gateway; Argo CD syncs from Git; a change to `values.yaml` in Git is deployed without `kubectl`; readiness and liveness probes and resources are set | Agent: Application Synced/Healthy, revision = HEAD; all containers have `resources` and probes |
| 7b | A kubeadm cluster by hand (the third Kubernetes step) | Kubernetes (stage 3, track `track:k8s/r3`); the variant with Terraform and Ansible — `track:k8s/r3-iac` after IaC | mandatory for L2, recommended for L1, optional for L0 | 3 VMs: 1 control plane + 2 workers; containerd, Cilium, a StorageClass; certificates in order; an etcd snapshot and a verified restore; an upgrade to a minor version; a broken and repaired node; cleanup | The R3 checklist and the agent per `05`, sections 11.4–11.6 |
| 8 | A Kubernetes operator in Go: CRD, controller, reconciliation loop | Kubernetes (L2) and a passed task K-12 (the browser controller) | optional, L2 | A CRD with schema validation; the controller creates and deletes dependent objects for its resource; the same four properties as in K-12: converges after perturbations, does nothing when everything matches, creates no duplicates, sets `ownerReferences`; tests on envtest | The agent on a real cluster: the CRD is installed; the K-12 perturbation scenario (delete a dependent object, change the spec, restart the controller, `noop`) — checking the same four properties |

Paths: L0 does 1 → 3 → 4 → 6 → 7 and the final exam (which includes 5 in a minimal scope); L1 — 1 → 3 → 4 → 5 → 6 → 7, with 7b recommended; L2 — 3 → 5 → 6 → 7 → 7b and optionally 8. Project 3 is the basis of the final exam, so it is mandatory for everyone.

For each project the bank has 8–10 defence questions that the mock interviewer asks based on the learner's README: for project 1 — "what happens if a deployment fails halfway", "how did you get the certificate and what will happen in 90 days", "why is nginx in a container and not on the host"; for project 4 — "how does a client packet get to the internet through the VPS, which NAT rules are responsible for that, at which layer does WireGuard work"; for project 7 — "what happens if someone does a `kubectl edit` bypassing Git"; for 7b — "what will you do if the API server certificate expired", "how do you restore etcd from a snapshot"; for 8 — "show the place that was `if (!have) create` in the browser controller". A project is credited when the checks and the defence against the rubric (an average ≥ 2) are passed.

## 11. Assessment data formats

A summary of the entities this document introduces and where they live. All are YAML in the content repository, except the learner's progress and records (IndexedDB, the event format from `01`, section 2.3; sync — `09`, section 3.4).

| Entity | File | Key fields |
|---|---|---|
| Task | `bank/<block>/<module ID>-<slug>/qNN.yaml` | `id, block, module (m:), level, level_variants, kind, subkind, key, purpose, concepts (c:), layer, bloom, difficulty, time_norm_s, doc_step, doc_ref, beyond_course, discover, doc_allowed, scene, set, predict, q, options/file/answer, options_why{misconception}, variants, sources, ai_context` |
| Misconception | `bank/misconceptions.yaml` | `id, block, layer, ru/en, truth, remedy[c:]` |
| Rubric (single schema) | `bank/rubrics/*.yaml` | `criteria[{id, scale: [0,3] \| [0,1,2,3], anchors{0..3}}], key_points_required, pass`; the scorer's answer is `criteria[{id, score, evidence, note}]` |
| Documentation mirror | `bank/docs/snapshot.yaml` (`docs.snapshot` of `09`) | `sources[{id, base, version, pages[{path, anchors[]}]}]` |
| Block exam | `bank/<block>/exam/*.yaml` | `time{mode, norm_min}, docs_allowlist, story, sandbox{env}, tasks[{weight, card, goals[{critical, points, when, keep, forbid, warn, probe, sim_action, envs}], fault_pool, boundary_field, beyond_course, doc_ref}], explain{weight: 0, readiness_mark, questions}, pass` |
| On-call shift | `exams/oncall-shift.yaml` | `env{tiers, device_min_memory, fallback}, pools[{id, tier, symptom, variants[], blocks[]}], arrival{offset_min}, board{wip}, rubric: rubrics/incident.yaml, pass` |
| Final exam | `exams/capstone.yaml` | `levels{L0, L1, L2}, requirements[{id, check, track}], fault_pack (signed), cost{providers_ref}, cleanup{expect}, defense{questions}, pass` |
| Drill | `bank/career/drills/*.yaml` | `symptom, clarifications, variants[{cause, steps[{expect_action, sandbox_output, input: command\|choice\|text}]}], bad_paths[{action, why}], checks{pass, forbid}, rubric` |
| Interview | `bank/career/interview.yaml` | `phases[{id, minutes, source, requires}], system_prompt, followups_per_question, quote_match{max_distance: 0.15}` |
| Pet project | `bank/career/pets/*.yaml` | `opens_after[blocks, concepts, items], required_for[levels], track, acceptance[{id, check}], cost, cleanup, defense_questions` |
| Exam result / report | IndexedDB + JSON/HTML export; presented ones — in `dt-api` | `exam, seed, mode (exam\|training), authenticity (self\|attested), env (sim\|v86\|vm), started, finished, checks[{id, pass, points}], boundaries[], doc_opens[], explain[{criteria}], readiness_mark, cleanup{done, kept_vm, monthly_cost}, nonce, attest` |
| Documentation event | the `01` event log | `{type: "doc_open", source, page, anchor, ms_to_answer, item}` |
| Résumé | IndexedDB, JSON Resume export | `basics, skills[x-trainer.evidence], projects[x-trainer.attest], work[x-trainer.relevance]` |
| Funnel and retros | IndexedDB | `applications[{company, url, stage, dates}], retros[{questions, mapped_items, notes}]` |

The content build checks: all `concepts` exist in the graph, all `module`s are in `content/modules.yaml`; all `misconception`s exist in the catalogue; each concept has ≥ 3 tasks of different types; each process explanation has ≥ 2 `scene`s of different subtypes and one `order`; each `beyond_course` task has a `doc_ref` present in the mirror; an exam has practice weights summing to 100, at least one critical check in each task, a `beyond_course` share no lower than the level minimum and `explain.weight` equal to 0; each `predict` and `scene` has a reference answer obtained by a run; each rubric has anchors for all scores in two languages; each source in `sources` has an entry in the source log with a check date; market data is no older than 12 months; the samples in this document pass the vocabulary linter.

## 12. Sources by block

All links were checked on 18.11.2026 (HTTP 200 when requesting the page; the key facts of the sources added in the second revision were verified against the page text). Sites that return 403 to automated requests but open in a browser are marked "(bot protection)". Checklist sources that could not be found are listed at the end of the section.

### Methodology and CI/CD

- EN: DORA, delivery metrics (the "throughput" and "instability" groups) — https://dora.dev/guides/dora-metrics/ ; history of the metrics (rework rate — since the 2024 report, MTTR renamed to failed deployment recovery time in 2023) — https://dora.dev/guides/dora-metrics/history/ ; the 2025 report "State of AI-assisted Software Development" — https://dora.dev/research/2025/dora-report/
- EN: Martin Fowler, Continuous Integration — https://martinfowler.com/articles/continuousIntegration.html ; Continuous Delivery — https://martinfowler.com/bliki/ContinuousDelivery.html
- EN: Jez Humble, continuousdelivery.com — https://continuousdelivery.com
- EN: Atlassian, CI vs Delivery vs Deployment — https://www.atlassian.com/continuous-delivery/principles/continuous-integration-vs-delivery-vs-deployment ; Kanban — https://www.atlassian.com/agile/kanban
- EN: The Kanban Guide — https://kanbanguides.org/
- EN: IT Revolution books: The Phoenix Project — https://itrevolution.com/product/the-phoenix-project/ ; The DevOps Handbook, 2nd ed. — https://itrevolution.com/product/the-devops-handbook-second-edition/ (both are published in Russian: «Проект "Феникс"», «Руководство по DevOps»)
- EN: Google SRE Workbook, postmortems and culture — https://sre.google/workbook/postmortem-culture/
- EN/RU: The Twelve-Factor App — https://12factor.net , https://12factor.net/ru/
- EN: GitLab CI — https://docs.gitlab.com/ci/ , quick start https://docs.gitlab.com/ci/quick_start/ ; GitHub Actions — https://docs.github.com/en/actions
- RU: Habr, the DevOps hub — https://habr.com/ru/hubs/devops/

### Linux

- EN: roadmap.sh/linux — https://roadmap.sh/linux
- EN: William Shotts, The Linux Command Line (free) — https://linuxcommand.org/tlcl.php ; RU edition: «Командная строка Linux. Полное руководство», 2nd int. ed., Piter, 2020, ISBN 978-5-4461-1430-6
- EN: Linux Foundation, Introduction to Linux (LFS101, free) — https://training.linuxfoundation.org/training/introduction-to-linux/
- EN: kernel man pages — https://www.kernel.org/doc/man-pages/ ; namespaces(7) — https://man7.org/linux/man-pages/man7/namespaces.7.html ; cgroups(7) — https://man7.org/linux/man-pages/man7/cgroups.7.html ; capabilities(7) — https://man7.org/linux/man-pages/man7/capabilities.7.html ; cgroup v2 — https://docs.kernel.org/admin-guide/cgroup-v2.html ; overlayfs — https://docs.kernel.org/filesystems/overlayfs.html
- EN: Advanced Bash-Scripting Guide — https://tldp.org/LDP/abs/html/
- EN: practice: OverTheWire Bandit — https://overthewire.org/wargames/bandit/ ; SadServers (failures on real servers) — https://sadservers.com ; Linux Upskill Challenge — https://linuxupskillchallenge.org ; Linux Journey — https://linuxjourney.com (bot protection)
- EN: Brendan Gregg, USE method — https://www.brendangregg.com/usemethod.html
- RU: Stepik, «Введение в Linux» (free) — https://stepik.org/course/73 ; «Основы Linux» (free) — https://stepik.org/course/762
- RU: Hexlet, «Основы командной строки» — https://ru.hexlet.io/courses/cli-basics

### Networks

- EN: "What happens when…" — https://github.com/alex/what-happens-when ; How Web Works — https://github.com/vasanthk/how-web-works
- EN: Ilya Grigorik, High Performance Browser Networking (free) — https://hpbn.co
- EN: Beej's Guide to Network Programming — https://beej.us/guide/bgnet/
- EN: Cisco NetAcad, Networking Basics (free) — https://www.netacad.com/courses/networking-basics
- EN: Wireshark wiki — https://wiki.wireshark.org ; WireGuard quickstart — https://www.wireguard.com/quickstart/
- EN/RU: MDN, HTTP — https://developer.mozilla.org/ru/docs/Web/HTTP ; 504 — https://developer.mozilla.org/ru/docs/Web/HTTP/Status/504 , https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/504
- RU: Olifer, Olifer. «Компьютерные сети. Принципы, технологии, протоколы» (Computer Networks: Principles, Technologies and Protocols). Anniversary edition, Piter — https://www.piter.com/collection/top-2/product/kompyuternye-seti-printsipy-tehnologii-protokoly-yubileynoe-izdanie-dopolnennoe-i-ispravlennoe
- RU: Miminet — a network simulator (from the checklist) — https://miminet.ru
- A detailed list on networks — `03-networks.md`, section 12.

### Docker and containers

- EN: roadmap.sh/docker — https://roadmap.sh/docker
- EN: Docker docs: Get started — https://docs.docker.com/get-started/ ; Dockerfile reference — https://docs.docker.com/reference/dockerfile/ ; multi-stage — https://docs.docker.com/build/building/multi-stage/ ; security — https://docs.docker.com/engine/security/
- EN: OCI Image Spec — https://github.com/opencontainers/image-spec ; OCI Runtime Spec — https://github.com/opencontainers/runtime-spec
- EN: the postgres image, the change of `VOLUME` and `PGDATA` since version 18 — https://hub.docker.com/_/postgres
- EN: Julia Evans, What even is a container — https://jvns.ca/blog/2016/10/10/what-even-is-a-container/
- EN: Ivan Velichko, iximiuz — articles https://iximiuz.com/en/ and labs https://labs.iximiuz.com
- EN: Play with Docker — https://labs.play-with-docker.com
- EN: linters and scanners: hadolint — https://github.com/hadolint/hadolint ; Trivy — https://github.com/aquasecurity/trivy
- RU: the Telegram community `@docker_ru` — https://t.me/docker_ru (12 thousand members)

### Kubernetes

- EN: kubernetes.io docs — https://kubernetes.io/docs/home/ ; components — https://kubernetes.io/docs/concepts/overview/components/
- RU: kubernetes.io in Russian — https://kubernetes.io/ru/docs/home/ ; components — https://kubernetes.io/ru/docs/concepts/overview/components/ ; basics — https://kubernetes.io/ru/docs/tutorials/kubernetes-basics/
- EN: roadmap.sh/kubernetes — https://roadmap.sh/kubernetes
- EN: Kubernetes The Hard Way — https://github.com/kelseyhightower/kubernetes-the-hard-way
- EN: NetworkPolicy and CNI support — https://kubernetes.io/docs/concepts/services-networking/network-policies/ ; kindnet (current versions enforce NetworkPolicy) — https://kindnet.sigs.k8s.io/docs/user/network-policies/ ; DNS for pods and `ndots` — https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/
- EN: Killercoda (free scenarios, including CKA) — https://killercoda.com , https://killercoda.com/killer-shell-cka ; killer.sh (CKA simulator) — https://killer.sh
- EN: Helm — https://helm.sh/docs/ ; Argo CD — https://argo-cd.readthedocs.io/en/stable/ ; the Kubebuilder book (for pet project 8) — https://book.kubebuilder.io
- EN: Marko Lukša, Kubernetes in Action, 2nd ed. — https://www.manning.com/books/kubernetes-in-action-second-edition ; RU edition of the first: «Kubernetes в действии»
- EN: CKA — https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/ ; resources allowed in the exam (kubernetes.io/docs and /blog, helm.sh/docs, gateway-api.sigs.k8s.io for the CKA) — https://docs.linuxfoundation.org/tc-docs/certification/certification-resources-allowed ; KCNA — https://www.cncf.io/training/certification/kcna/
- RU: Slurm, Kubernetes for developers — https://slurm.io/kubernetes-for-developers
- RU: `@kubernetes_ru` — https://t.me/kubernetes_ru (11.5 thousand)
- A detailed list — `05-kubernetes.md`.

### IaC: Terraform and Ansible

- EN: Terraform tutorials — https://developer.hashicorp.com/terraform/tutorials ; state — https://developer.hashicorp.com/terraform/language/state ; `apply -refresh-only` instead of `terraform refresh` — https://developer.hashicorp.com/terraform/cli/commands/refresh
- EN: roadmap.sh/terraform — https://roadmap.sh/terraform
- EN: Yevgeniy Brikman, Terraform: Up & Running — https://www.terraformupandrunning.com (published in Russian: «Terraform: инфраструктура на уровне кода»)
- EN: Ansible getting started — https://docs.ansible.com/ansible/latest/getting_started/index.html ; playbook guide — https://docs.ansible.com/ansible/latest/playbook_guide/index.html
- RU: Yandex Cloud, practical guides (including Terraform) — https://cloud.yandex.ru/ru/docs/tutorials/
- RU: `@pro_ansible` — https://t.me/pro_ansible (4.7 thousand)

### Monitoring

- EN: Prometheus overview — https://prometheus.io/docs/introduction/overview/ ; PromQL — https://prometheus.io/docs/prometheus/latest/querying/basics/ ; alerting — https://prometheus.io/docs/practices/alerting/
- EN: Grafana docs — https://grafana.com/docs/grafana/latest/ , getting started https://grafana.com/docs/grafana/latest/getting-started/ ; Loki — https://grafana.com/docs/loki/latest/ ; playground — https://play.grafana.org
- EN: Google SRE Book, Monitoring Distributed Systems (the four golden signals) — https://sre.google/sre-book/monitoring-distributed-systems/ ; all books — https://sre.google/books/
- EN: RED method — https://grafana.com/blog/2018/08/02/the-red-method-how-to-instrument-your-services/

### Interviews, career, résumé

- EN: roadmap.sh/devops — https://roadmap.sh/devops ; questions — https://roadmap.sh/questions/devops ; sources — https://github.com/kamranahmedse/developer-roadmap
- EN: devops-exercises (thousands of questions and exercises) — https://github.com/bregman-arie/devops-exercises
- EN: Linux/Ops questions (from the checklist entry "Linux/Ops questions (GitHub)") — https://github.com/trimstray/test-your-sysadmin-skills
- EN: KodeKloud, DevOps interview questions — https://kodekloud.com/blog/devops-interview-questions/
- EN: Tech Interview Handbook: résumé — https://www.techinterviewhandbook.org/resume/ ; behavioural questions — https://www.techinterviewhandbook.org/behavioral-interview/
- EN: JSON Resume schema — https://jsonresume.org/schema
- EN: interviewing.io, how AI is changing interviews — https://interviewing.io/blog/how-is-ai-changing-interview-processes-not-much-and-a-whole-lot
- RU/UA: DOU, "300+ questions for Junior, Middle, Senior" — https://dou.ua/lenta/articles/interview-devops/ ; "How to interview a DevOps engineer" — https://dou.ua/lenta/articles/how-to-interview-devops-engineer/
- RU: questions from real junior DevOps interviews — https://enigmai.ru/prep/devops/junior/ ; a collection of questions — https://github.com/Swfuse/devops-interview
- RU: Tproger, junior DevOps take-home tasks — https://tproger.ru/articles/nebolshaja-podborka-testovyh-zadanij-dlja-junior-devops-inzhenera
- RU: Habr, a round table "common questions from beginner DevOps engineers" — https://habr.com/ru/post/717204 ; KTS, interviews on a trainer — https://habr.com/ru/companies/kts/articles/795277
- RU: market: Habr Career, the DevOps profession — https://career.habr.com/professions/devops ; career.hh.ru — https://career.hh.ru/profession/53
- Mock interviews and mentors: DevOps Kitchen Talks (YouTube) — https://www.youtube.com/@DevOpsKitchenTalks , Telegram https://t.me/DevOpsKitchenTalks ; GetMentor — https://getmentor.dev ; Mentor in Tech — https://mentorintech.ru ; ADPList — https://adplist.org
- Internships: Yandex — https://yandex.ru/yaintern ; T1 — https://t1.ru/career/ ; the Sber and T-Bank internship sites did not open from our check location (probably geo-blocking); in the card they are given as a link with the note "check manually".

### Telegram channels and YouTube from the checklist (checked)

| Channel | Purpose | Subscribers / members as of 18.11.2026 |
|---|---|---|
| https://t.me/devops_prosto — «Просто Devops» ("Simply DevOps") | Learning | 27.6 thousand |
| https://t.me/BugUser | Books and courses | 11.2 thousand |
| https://t.me/docker_ru | Docker community | 12 thousand |
| https://t.me/devops_ru | DevOps community | 20 thousand |
| https://t.me/kubernetes_ru | Kubernetes community | 11.5 thousand |
| https://t.me/pro_ansible | Ansible community | 4.7 thousand |
| https://t.me/os_linux_ru — «Linux для чайника» ("Linux for Dummies") | Linux | 19.5 thousand |
| https://t.me/devops_jobs | Jobs and analytics | 23 thousand |
| https://www.youtube.com/@ADV-IT | ADV-IT, Denis Astakhov: AWS, Terraform, Kubernetes, Ansible | — |

Learning platforms from the checklist: Slurm — https://slurm.io ; Rebrain — https://rebrainme.com ; Yandex Practicum — https://practicum.yandex.ru.

**Not found or not confirmed:** "Shortcut — mock interviews" (the shortcut.ru domain does not respond, and the service was not found by search; we do not include it in the product); "300+ DevOps questions (itvdn)" — no such article was found at ITVDN; a collection with this title exists on DOU (link above), and that is what we give; the YouTube channel «Просто Девопс» — the address was not found, so we give the Telegram channel `@devops_prosto`. We do not take the checklist author's materials (her post with questions, channels) into the course — we use only the structure of the checklist.

### Sources on the design of assessment

- FSRS: https://github.com/open-spaced-repetition ; ts-fsrs — https://github.com/open-spaced-repetition/ts-fsrs ; ABC of FSRS — https://github.com/open-spaced-repetition/fsrs4anki/wiki/ABC-of-FSRS
- Roediger, Karpicke (2006). Test-Enhanced Learning. Psychological Science 17(3) — doi:10.1111/j.1467-9280.2006.01693.x (the publisher returns 403 to automated requests)
- Mastery learning and the 80–90% threshold: a Great Hearts Institute review — https://institute.greatheartsamerica.org/media/scholarship-and-research/research-on-mastery-learning-including-a-comparison-of-the-bloom-model-and-the-fwtm-model/
- hadolint (the DL3xxx rules, the reference for our own rule set) — https://github.com/hadolint/hadolint ; the `.gitlab-ci.yml` JSON Schema — https://gitlab.com/gitlab-org/gitlab/-/blob/master/app/assets/javascripts/editor/schema/ci.json
- Killercoda: the step check format (a `verify` script, success on exit code 0) — https://killercoda.com/creators
- Web Speech API — https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API ; `processLocally` — https://developer.mozilla.org/docs/Web/API/SpeechRecognition/processLocally ; `SpeechRecognition.available()` (options `langs`, `quality`, `processLocally`; results `available`, `downloadable`, `downloading`, `unavailable`) — https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/available_static ; transformers.js — https://huggingface.co/docs/transformers.js/index ; Whisper base and small ONNX — https://huggingface.co/onnx-community/whisper-base , https://huggingface.co/onnx-community/whisper-small
- DeepSeek API — https://api-docs.deepseek.com
- The return of in-person interviews — https://www.entrepreneur.com/business-news/google-mckinsey-reintroduce-in-person-interviews-due-to-ai/496041

## 13. Dependencies on other roles

- **Engine (`08`):** five new task kinds — `bugfind` (click on a line + editor + check by effect), `label` (a `match` variant with `diagram` nodes), `scene` (subtypes `next`/`param`/`break`/`scrub` on top of `stepper`, `diagram`, `breakit`, `packets`, with a mandatory prediction before manipulation and the explanation state available to the predicate), `docanatomy` and `docfind` (the built-in mirror viewer with `hotspot` on sections and lines and the `doc_open` event); five explanations O-1 – O-5 (5.2); the exam mode (soft and hard timer, freezing, the mentor turned off, the "exam / training" switch, the documentation panel with `docs_allowlist`); report and path debrief pages per 6.6.
- **Platform (`09`):** the `sim_action` check type — a deterministic tier A simulator action before evaluating `when`, as a replacement for `probe` where there is no real machine; `warn` in the goal language; `hint_policy: point-to-docs` and the `ai-evals` set "talk the mentor into it" with 20 attempts per block; the `capstone` and `pet<N>` agent tracks, signed failure packages for part B of the final exam and for the A5 failure; the "On-call shift" memory profile (three v86 machines at `deviceMemory ≥ 8`, the fallbacks of 6.4); `dt-api`: presented exams, the report verification page, receiving anonymised task statistics; our own `lint: dockerfile` rule set in TypeScript with DL3xxx codes and cross-checking against the real hadolint in CI (there is no official hadolint build for the browser); `lint: gitlab-ci` per the `.gitlab-ci.yml` JSON Schema from the GitLab repository, without the `ci/lint` API, which needs a token.
- **Simulators and environments (`02`–`06`):** facts for exam selectors per `dt.facts/v1` (`images[].size`, `containers[].ports`, `mounts`, `cgroups`, `units[].restarts`, `memory.events`); the `@base_size(image)` macro; recording the action log for the path debrief; generating `predict` output and running `scene` in CI; failures across the six boundaries for `fault_pool` (`04`); "On-call shift" pools A–F with parameterisation.
- **Block roles:** exams per the 6.1 frame and the 6.2 schema (`docs_allowlist`, `beyond_course`, `explain.weight: 0`); 8+ tasks per module with misconception catalogue entries and a `layer` field for network ones; for each process explanation, 2 `scene`s of different subtypes and one `order`; documentation step 2–4 tasks following the 3.6 samples; `key_points` for `purpose: interview` questions; `03` — exam item 8 raised to 15 and 20 points for L1 and L2; `04` — keep the name E4 "On duty", the cross-block exam is named differently; `07` — the exam in the 6.3 schema, rubrics in the single schema, the bank in `content/bank/methodology/`, FSRS instead of repetitions "after 1, 3 and 7 days".
- **Andragogy (`01`):** moving the isolation concepts into Linux (L33–L38), new L39 "file descriptor", N22 "tunnel and WireGuard", N23 "packet capture", K40–K43 Kubernetes networking; moving K31 to the end of the "Networks" block; splitting R05 into R05a and R05b; the career block schedule per section 9; the 6.1 exam frame in section 11.2; the "where did you look?" mentor mode in section 14.
- **Kubernetes (`05`):** the controller sandbox (screens 5a, 5b, QuickJS) with a run of the K-12 perturbation scenario; the `r1`, `r3`, `r3-iac`, `capstone` tracks; the exam E failure pool for part B of the final exam.
- **The AI role:** a scoring call with a JSON schema and temperature 0, fuzzy quote checking (word distance ≤ 0.15), the mock interviewer script with the "live sandbox" phase, recognising a drill step from free text, voice (Web Speech with `quality: "conversation"` and `install()`, Whisper small/base in the browser).

## 14. Changes after review

The second revision takes into account the reviews `reviews/10-assessment-career--by-07-methodology-kanban.md` (27 comments) and `reviews/10-assessment-career--by-01-andragogy.md` (36 comments), as well as owner requirements R1–R12. Disputed facts were checked on 18.11.2026: the DORA metric groups and the year rework rate appeared — at dora.dev (the guide and the metrics history); the list of CKA resources — on the Linux Foundation page; the options of `SpeechRecognition.available()` — on MDN; the volume change of the postgres 18 image — on Docker Hub; NetworkPolicy support in kindnet — in the kindnet documentation.

### What was changed

**Owner requirements**
- **R1.** New decision 1 and section 4.3: the three pillars (textbook, explanations, documentation) got their own subject of assessment; a module is not closed without a `scene` and a documentation step task, the block exam does not open without `practicing` on key concepts, a correct `scene` for each explanation and step 4 (comments 07-4, 01-10).
- **R2.** A fifth dimension "working with documentation" (section 1); the `docanatomy` and `docfind` types (2.1); an exception from the concept order for commands and flags with `doc_ref`, `doc_step`, `discover`, `doc_allowed` (2.5); a table of steps with hints, mentor and pass rules, the L0/L1/L2 start at steps 1/2/3, the mirror and `doc_open`, sources by block, ready-made step 2–4 tasks for the eight blocks (3.6); the FSRS skill `doc.<source>` and the "where did you look?" mode with `ai-evals` (3.4); step 5 and the share of out-of-course tasks in the exam frame (6.1); the ladder in the career block and the "live sandbox with documentation" phase in the mock interview (9.2, 9.3); `docfind` in the L2 placement check (3.5) (comments 07-1, 07-2, 01-1).
- **R3, R4.** The `scene` type with subtypes and the prediction rule (2.2), the coverage rule (2.3), the minimum set of tasks for all R3 explanations across the eight blocks (3.7), `scene` samples in quizzes (M-7, K-11, I-6, C-6, P-6); five explanations of the role itself in the R4 style — screen by screen (5.2) (comments 07-3, 01-2).
- **R5.** Section 6.6 on the look of the exam, the debrief and the report; the semantic palette in the 5.2 explanations (comments 07-12, 01-36).
- **R6.** Tasks L-6 – L-12 (threads, `/proc/<pid>/ns`, `unshare`, the OOM-kill drill with `09` predicates, capabilities, overlay and whiteout, seccomp at the level of the idea); a mandatory isolation task in the Linux exam (6.3); D-2 and K-4 refer to Linux concepts; the "container versus VM" trainer moved to a Linux lesson; Linux in the mandatory questions (comments 07-5, 01-3).
- **R7.** The exam `fault_pool` across the six boundaries with a `boundary` field (6.2); D-6 the runtime chain, D-7 PID 1 and SIGTERM, D-8 `-p` as DNAT, D-9 DNS of the default bridge network, D-10 UID and bind mount, D-11 symptom ↔ boundary, D-12 the "container versus a second v86 machine" measurement with `dmesg`; nesting in the "container and VM" reference answer; a `scene` for the "hardware → VM → containers → nesting" explanation (comments 07-6, 01-4).
- **R8.** A `layer` field in tasks and the misconception catalogue; N-6 "which layer", N-7 ping works — curl hangs, N-8 DHCP, N-9 HTTP/3, N-10 VXLAN; the rule for tasks from a protocol card and protocol levels; the "Layer" criterion first in the drill rubric (comments 07-7, 01-5).
- **R9.** K-6 – K-10 (ClusterIP in iptables, pinging a ClusterIP, `ndots` and the number of queries, the diagnostic order, NetworkPolicy without CNI support); the drill and pool F "a pod could not reach a service"; NetworkPolicy in pool C; Kubernetes networking in the mandatory questions (comments 07-8, 01-6).
- **R10.** K-11 (a three-part `scene` of the reconciliation loop) and K-12 (your own controller, checked by a perturbation run); pet project 8 opens after K-12 and is checked with the same four properties (comments 07-9, 01-7).
- **R11.** The "On-call shift" in the hybrid environment: kube-lite + v86 nodes with `dt-kubelet`, the `shop` server in v86, `vswitch`; memory thresholds and fallbacks; phones are not allowed; pool E "node NotReady" (comments 07-10, 01-8).
- **R12.** The final exam on three VMs with Terraform + Ansible; L2 — kubeadm with Cilium, etcd, an upgrade and certificates (A4b); the trainer guides and checks but does not execute; cost, the final build in one session, mandatory cleanup with a check; pet project 7 is the second step, the new 7b is the third (comments 07-11, 01-9).

**Factual errors**
- M-4: the DORA metrics are split into throughput (with recovery time) and instability; rework rate is one metric, introduced in the 2024 report (07-13, 01-21).
- D-2: "an image with a different kernel" replaced with "there is no kernel in an image", a misconception distractor added (07-14, 01-22).
- L-3: the task moved to the `ssh` service, and the debrief now says that nginx writes its logs to files (01-23).
- K-4: "pod limit" → "container limit", node OOM and `oom_score_adj` by QoS added (07-14).
- I-2: `terraform refresh` → `terraform apply -refresh-only` (07-14).
- I-5: acknowledged that Ansible has `--check --diff`; clarified what it lacks for cloud resources (01-26).
- D-3: waiting for the database to be ready and the postgres 18 variant with the new volume path (01-28).
- Voice: `available()` with `quality: "conversation"`, handling `downloadable` via `install()`, `whisper-small` for Russian, fuzzy quote checking (01-29).
- Exam t1b: the size threshold relative to the variant's base image (07-14).

**Alignment with neighbouring documents**
- An exam frame instead of a "single format", explanation weight 0 and the "interview readiness" mark, a soft timer by default, compliance of the `02`–`07` exams (07-18, 01-11, 01-19, 01-35).
- Two authenticity modes per `09`, `dt-api` as the server side, the `trainer-check run --track … --nonce …` syntax, the agent injects failures only from signed packages (07-20, 01-12).
- Exam checks rewritten per `dt.facts/v1`; `probe` on tier A replaced with `sim_action` with a request to `09` (01-13).
- The format mapping table `03` → canonical (01-14); the `c:`, `m:`, `track:`, `scene:` namespaces (07-17, 01-17).
- The methodology exam in the 6.3 schema (07-18); the single rubric schema and `rubrics/incident.yaml` (07-19); a four-line post-mortem with contributing factors (07-19).
- The cross-block exam renamed to "On-call shift" (01-18).
- Generators count as N tasks (07-21).
- The career block schedule per the graph with R05a/R05b (07-22, 01-15); K31 and N22 for pet projects 1 and 4, the bot template for pet project 2, an honest line about Python in 9.8 (01-15).
- SLO is a methodology concept, SLI in PromQL is monitoring (07-23).
- The "exam / training" mode instead of "with an assistant / without" (01-20).

**Terms and concept order**
- M-1, M-2, M-5 rewritten with the vocabulary of the "Methodology" block; the rule "the document's samples pass the linter" (07-16, 01-16).
- L-2 moved to the `report` service and concept L39; N-5 relies on N23, `mtr` removed; K-1, K-2, K-5 got the missing concepts (07-14, 01-24, 01-25).

**Assessment and pedagogy**
- The "On-call shift" with overlapping incidents, a WIP 1 board and a "Prioritisation" criterion (07-24).
- The application funnel as a flow board with Little's law and explanation O-3 (07-25).
- M-3: where to put a finished card (07-26).
- The block quiz for L2: `level_variants`, ≥ 50% `analyze`, no `difficulty` ≤ 2, ≤ 20% from skipped modules (07-27, 01-34).
- Statistics sample thresholds n ≥ 30 and n ≥ 50 (01-33).
- Three kinds of drill step input and full tables for the "disk full", "CrashLoopBackOff" and "a pod could not reach a service" drills (01-32).
- The `warn` type for things counted with a note (07-14, 01-27); Dockerfile and `.gitlab-ci.yml` linting — our own rule sets cross-checked in CI (07-15, 01-31).
- The market data freshness rule; the salary card on `hold` until updated (01-30).

### What was rejected or adopted differently from the proposal

- **The `explorer` type name (07-3).** The `scene` type from the `01` review with four subtypes was adopted: it describes the same actions (parameter, "break it", scrubbing) and adds `next`. The main thing was taken from `explorer` — a mandatory prediction before manipulation and credit only for a correct prediction (2.2).
- **A 30% weight for explanations and a critical question `e1` in the methodology exam (07-18).** Rejected: decision `01`, section 11.2, and the `01` review require that explanations do not fail an exam, and scoring by a neural network or by self-assessment is not reliable enough for a pass score. The "Understanding" for which `07` made `e1` critical is checked automatically — by task t5 with counterfactual predictions that `flowlab` replays (6.3).
- **A hard timer on block exams for L1 and L2 (01-11, 01-35).** Adopted differently: the `02`, `03`, `04` exams are already designed with a soft timer, and time in a block exam is a fluency signal, not a filter. The hard timer is kept where time is part of the skill: presented exams, the "On-call shift", part B of the final exam.
- **"4 GB of free memory" as an "On-call shift" requirement (01-8).** Replaced with `deviceMemory ≥ 8` for three v86 machines according to the hybrid budgets of `05`, section 5.9 (about 900 MB of tab memory), with two fallbacks for weaker computers; phones are not allowed, as the `01` review proposed, rather than moved to tier A, as `07` proposed: an exam with a different environment on a small screen would measure the interface, not the skill.
- **External internet during the exam: "we don't block it but record the panel's pages" (07-1) versus "only the built-in viewer is open" (01-1).** Both were taken in a single formulation: external tabs cannot be forbidden (section 7), the exam provides only the built-in viewer with a whitelist, and the "exam" mode is a word of honour to work only with it.
- **Note 07-1 "do not list the CKA domains, keep them on `hold`".** Rejected: the official Linux Foundation page was checked on 18.11.2026 and explicitly lists kubernetes.io/docs, kubernetes.io/blog, helm.sh/docs and gateway-api.sigs.k8s.io (the last one for the CKA); the list is given with a link to the source and a rule to update the mirror together with the page.
- **The NetworkPolicy example with kindnet (01-6, K-8).** Rejected as outdated: the current kindnet documentation describes NetworkPolicy support. The example was rewritten for flannel, which does not enforce policies (K-10).
- **Out-of-course task shares "≥ 15% of the total" (01-1) versus "10/15/20% by level" (07-2).** Adopted by level, 10/15/20% as a minimum; a block may go higher (Kubernetes has 20–30%, `05`).
- **Ladder steps by shares "30/60/90% of modules" (07-2).** Replaced with thirds of the block from the `01` review: simpler to compute and matches how blocks already mark up their modules.
- **The ID syntax `meth.M14`, `career.R04`, `k8s.r4` (07-17).** The `c:` / `m:` / `track:` namespace scheme from the `01` review was adopted: it distinguishes concepts and modules in the same way in all blocks, not only in methodology and career.
- **Checking cleanup with the `trainer-check cleanup --label` command (07-11).** Not adopted: after the VMs are deleted the agent has nowhere to run, and the provider's VM list requires cloud keys on the agent's side. Cleanup in your own cloud is checked by the `terraform destroy` output, an empty `state list` and the VM list by label, as in `05`, section 11.6; this is honestly called a self-check.
- **Two-node k3s for L0 and L1 in the final exam (01-9).** The `07` review's option was adopted — three nodes for all levels: the third step of R12 speaks of 3+ VMs, and Terraform and Ansible must manage the same set as for L2; for L0 and L1 the only difference is k3s instead of kubeadm.
- **Moving concepts in the graph, splitting R05, new concepts (01-15, 01-24, review 07-5).** Adopted as references; the graph changes themselves are the `01` area, and the IDs in this document are marked as provisional until the graph is updated.
