# 01. Andragogy and Instructional Design of DevOps Trainer

Role: andragogue and instructional designer for adults who are changing careers. This document sets the course priorities, the learner model, the three levels and content tiers, the principle of the placement check, the global order in which concepts are introduced (a single graph for all blocks), the anatomy of a lesson and of a textbook chapter, the cognitive load rules, the mandatory process explanations, the three ladders (support, hints and documentation), review, practice and exams, the motivational layer and the pedagogical behavior of the AI mentor. Everything decided here must become data and build checks, not wishes addressed to authors.

The base course plan is the structure of the beginner DevOps engineer checklist (`source/checklist.txt`, 11 steps). The document departs from its order in three places, and each departure is justified in section 5. Git and YAML are introduced right after Linux, because Dockerfiles, compose files and manifests live in a repository. CI/CD practice is moved into a separate block after containers (in the checklist it is part of methodology). Installing Kubernetes on several VMs (the third stage of the block) comes after IaC, because it is done with Terraform and Ansible.

---

## 0. Conventions: identifiers, levels, rule names

The first edition of this document and the block documents 02–10 used overlapping notations: `L0` meant both the "Beginner" level and the Linux module, `K10` meant both the "labels" concept and the "Access" module, `R1` meant both a load rule and an owner requirement. From this edition on, the following conventions apply, and they are mandatory for all documents and for content.

| What | How it is written in data | How it is written in the interface and in this document | Example |
|---|---|---|---|
| Concept | slug `<block>.<name>`: `orient`, `method`, `linux`, `git`, `yaml`, `net`, `proto`, `docker`, `cicd`, `k8s`, `iac`, `obs`, `pet`, `career` | short code from the tables in section 6 (`L17`, `K09`) — only as an alias for reading the tables, not used in content | `linux.process` (code L17) |
| Term | term slug with a `concept:` field (section 6.1) | a word from the glossary | `linux.pid` → `concept: linux.process` |
| Block module | `<block>.m<NN>` | "Linux module 8" | `linux.m08` |
| Learner level | `beginner`, `intermediate`, `experienced` | "Beginner", "Intermediate", "Experienced" | the codes `L0/L1/L2`, `Н/С/О`, `B/I/E` are no longer used |
| Content tier | `tier: core`, `plus`, `pro` | "core", "extension", "deep dive" | section 3 |
| Kubernetes stage | `stage: 1`, `2`, `3` | "stage 1" | section 5 |
| Support ladder step | `S0…S5` | the same | section 10 |
| Hint ladder step | `H0…H5` (`H0` — no hints) | the same | section 16.2 |
| Documentation ladder step | `DL1…DL5` | "glimpse", "anatomy", "find the flag", "forcing", "exam" | section 11 |
| Cognitive load rule | `CL1…CL21` | the same | section 8 |
| Owner requirement | `R1…R12` | the same; appears only in references and in the "Changes after review" section | — |

The only concept registry is `content/concepts.yaml`. The glossaries of 07 (`glossary.yaml`) and 08 (§7.3) become views of this file, not separate sources. Block documents set the order of concepts within their block and use these slugs; if a block document needs a different order, it changes `concepts.yaml` through review by the instructional designer rather than keeping its own list.

---

## 1. Scientific basis and what follows from it for the product

There are six lines of research here, and each has one or two direct consequences for the product. References are collected in section 17.

**Knowles's andragogy.** Knowles described the adult learner with six assumptions: an adult needs to know why they are learning something; they see themselves as self-directed and do not tolerate being treated like a schoolchild; their experience is a resource and at the same time a source of biases; they are ready to learn what they need for a new social role; they are oriented toward tasks, not subjects; they are driven by intrinsic motivation. For DevOps Trainer three decisions follow from this. Every lesson opens with a work situation of a junior DevOps engineer, not with a definition (section 7, the "Hook" step). The learner chooses the level themselves, and the check only confirms the choice and never silently lowers the level (section 4). Experience from the previous profession is used explicitly: to a salesperson a kanban board is explained through a sales funnel, to a tester CI is explained through a regression run, to a programmer a container is explained through a process they already run.

**Sweller's cognitive load theory and the expertise reversal effect.** Working memory holds only a handful of new elements, and load is divided into intrinsic (the complexity of the material itself), extraneous (poor presentation) and germane (the work of building a schema). We cut extraneous load with screen rules (section 8). We regulate intrinsic load with the order of concepts: a new concept appears only when all its prerequisites have already become familiar schemas (section 6). The expertise reversal effect (Kalyuga et al., 2003) says that a worked example that helps a beginner hinders an experienced learner: they spend effort checking redundant material. That is why the three levels differ not only in their starting point, but also in which step of the support ladder each concept starts at (section 10) and which step of the documentation ladder each block starts at (section 11).

**Mayer's principles of multimedia learning.** Of the twelve principles, seven carry over directly into the product: coherence (no decorative pictures on concept screens), signaling (highlighting the key line of output), redundancy (do not duplicate narration with the same text), spatial and temporal contiguity (a label sits next to its element and appears at the same time), segmenting (animation advances in steps on the learner's button), pre-training (names of the parts before the mechanism). The modality principle (a diagram accompanied by voice rather than a paragraph) does not carry over in the first version: narration in two languages for three dozen explanations and three hundred concepts is not in the budget, and its role is taken over by temporal contiguity — the label on a line appears in the same step as the event (rule CL10). Meta-analyses show that the principles are not equally strong (see the Skillbox review in section 17); the most robust ones are coherence, signaling, segmenting and pre-training, which is why exactly they became build checks.

**Bjork's desirable difficulties.** Spaced repetition, interleaving of topics, retrieval from memory instead of rereading, and varying conditions slow down progress during a session but improve retention and transfer. To the learner this feels worse, because fluency while rereading feels like knowledge. The product must explain this in advance (section 14) and must not give the learner a direct "reread the lesson" path instead of review: the "reread" button exists, but it goes through one attempt to recall.

**The testing effect and Dunlosky's ranking of techniques.** Roediger and Karpicke (2006) showed that testing memory beats restudying on a delayed test; the review by Dunlosky et al. (2013) ranked distributed practice and practice testing first in utility, and highlighting and rereading last. Two decisions follow: a quiz in the product is first of all a means of teaching, not of assessing (low stakes, immediate walkthrough), and the product has no text highlighting tools as a learning activity.

**Ericsson's deliberate practice.** Mastery grows from practice at the edge of current ability, with a clear goal, immediate feedback and the skill broken into parts that can be drilled. For DevOps the edge skill is diagnosing failures, so the main trainer format is "broken, fix it" (break-fix), checked against the state of the system and followed by a walkthrough after every attempt. Trainers rely on the chapter, the process explanations and the module documentation, and refer to them in the walkthrough (sections 1.1 and 13): practice consolidates the model, it does not replace it.

Two corrections to these lines also shape the design. The meta-analysis by Sinha and Kapur (2021) showed that "problem first, explanation after" (productive failure) works better than the reverse order, but weaker for those who have almost no prior knowledge. Therefore for the "Experienced" level a lesson starts with a problem before the explanation, and for the "Beginner" level with a worked example. The field experiment by Bastani et al. (PNAS, 2025) with GPT-4 among school students showed that an unrestricted chatbot raises results during practice and lowers them on a final test taken without it, while the group with a restricted tutor (hints instead of answers) showed no significant drop on the final test. Hence the strict AI mentor rules in section 16.

The motivational basis is Bandura's self-efficacy theory: the belief "I can do it" is built from one's own successful actions (the strongest source), observing similar people, persuasion by others, and physiological state (anxiety is read as "I won't manage"). For an adult who is afraid of the terminal, the first ten minutes of the course must give a real successful action, not a motivational text (section 14).

### 1.1. Course priorities: three pillars and practice built on them

The course stands on three pillars, and practice relies on them, not the other way around.

1. **Textbook.** Coherent theory in a strict order of introducing entities. Each module exists as a continuous chapter that can be read straight through from beginning to end, and the order of concepts in it is the same as in the lesson (sections 6 and 7).
2. **Process explanations.** In every block, mechanisms are shown as a step-by-step process: a diagram, motion only where something actually moves, parameters that immediately recompute the process, and "break it" (section 9).
3. **Documentation.** The habit of looking for the answer in `man`, `--help`, `kubectl explain` and official documentation grows from "this comes from here" to tasks that cannot be solved without documentation, and to an exam with only the official documentation open (section 11).

Practice — trainers, break-fix tasks, exams — checks and consolidates these three pillars but does not replace them. Hence the rule for authors: a task that cannot be solved by relying on the chapter, a process explanation or the documentation is a design error. Every task in the bank refers to at least one of the three (`refs: { chapter: …, process: …, docs: … }`), and the walkthrough after an attempt shows exactly that reference.

The priority also changes the design of the levels. An "Experienced" learner may solve a challenge task before reading the chapter, but cannot complete a module without seeing the process explanation: the operational models (isolation, networking, the reconciliation loop) are exactly what they lack (section 7).

---

## 2. Learner model

### 2.1. Who comes

The audience is adults aged 22–45 who study in the evenings and on weekends, 6–12 hours a week, alongside their main job. Typical profiles against which every decision is checked:

| Profile | What they can do | What they fear | What they need from the course |
|---|---|---|---|
| SaaS sales manager ("Beginner" level almost everywhere) | Talk to a customer, run a funnel, work with a CRM | The black screen, "breaking the server", looking stupid | Confidence in the first commands, vocabulary, a sense of progress in work terms |
| First-line support specialist ("Intermediate" in Linux and networks, "Beginner" in Kubernetes) | Read logs following instructions, restart services, ssh with a ready-made command | That support experience "doesn't count" | A model instead of a set of recipes, proof that support is a plus |
| Tester, analyst ("Intermediate" in methodology and CI/CD) | Jira, test cases, sometimes Git and SQL | Kubernetes as "magic" | Connecting a familiar process to infrastructure |
| Backend programmer ("Experienced" in Linux and Git, "Intermediate" in Docker, "Beginner" in monitoring) | Write code, Docker following a README, sometimes kubectl | Boredom on basic topics, wasted time | Quickly pass what they know via a check and move on to the gaps |

Conclusion from the table: the level is a property of the pair "learner × block", not of the learner. A programmer can be "Experienced" in Linux and a "Beginner" in monitoring at the same time, and the product supports this.

### 2.2. Knowledge state

The unit of the model is a concept from the graph (section 6). For each concept, a state and a history of evidence are stored.

| State | What it means | How a concept gets there |
|---|---|---|
| `unseen` | Not encountered yet | Initial |
| `placed` | Credited by the placement check, the lesson was not taken | The level check was passed and the concept belongs to the credited modules; for F01–F12 — the three control questions of "Orientation" (section 3) |
| `introduced` | The concept screen was shown, the example was walked through; for a process concept, all steps of its explanation were viewed | The learner reached the screen where the concept is introduced. For an "Experienced" learner the mark is set only after viewing the process explanation, even if the challenge task was solved (section 7) |
| `practicing` | There is at least one successful independent attempt | A task of step S3 or higher was completed without hints H4–H5 |
| `mastered` | Transfer is confirmed | The lesson exit ticket was passed, step S4 was reached, a delayed (≥ 3 days) review was passed without errors in a format different from the format of the last correct answer; for an "Experienced" learner who skipped the chapter — additionally one "explain it" answer about the model |
| `lapsed` | Was mastered but forgotten | Two failures in a row on review |

The order rule (section 6) treats a concept as "introduced" in the states `introduced` and above, and also in `placed`. A concept in `placed` enters the review queue with lower stability, so that the delayed check confirms it is really known.

Besides concept states, the model stores the documentation ladder step for each source (`man`, `--help`, `kubectl explain`, kubernetes.io, docs.docker.com, etc., section 11) and the device capabilities (how many v86 machines it can handle, section 13.4).

### 2.3. Data format

The model lives in the browser (IndexedDB) with export and import to JSON, so that progress is not lost when switching devices. Synchronization with a server is a decision of the platform role (09); the format does not depend on it.

```json
{
  "learner": {
    "id": "local-7f3a",
    "locale": "ru",
    "weekly_hours": 8,
    "previous_job": "sales",
    "levels": { "methodology": "intermediate", "linux": "beginner", "git": "beginner",
                "networks": "beginner", "containers": "beginner", "cicd": "intermediate",
                "kubernetes": "beginner", "iac": "beginner", "monitoring": "beginner",
                "career": "beginner" },
    "tiers_opted": { "networks": ["core"], "linux": ["core", "plus"] },
    "device": { "max_nodes": 3, "mobile": false, "ram_gb": 16, "probed_at": "2026-11-18T19:00:00Z" },
    "doc_ladder": { "man": "DL2", "help": "DL2", "kubectl-explain": "DL1", "kubernetes.io": "DL1" },
    "placement": [
      { "block": "methodology", "claimed": "intermediate", "attempt": 1, "at": "2026-11-18T19:04:00Z",
        "result": "passed", "score": 0.83, "failed_items": ["method.place.int.5"],
        "gap_concepts": ["method.continuous-deployment"] }
    ]
  },
  "concepts": {
    "linux.process": { "state": "practicing", "scaffold_step": "S3",
                       "fsrs": { "due": "2026-11-21", "stability": 3.1, "difficulty": 5.2, "reps": 2, "lapses": 0 } }
  },
  "events": [
    { "t": "2026-11-18T19:31:12Z", "kind": "attempt", "item": "linux.process.drill.3",
      "concepts": ["linux.process", "linux.signals"], "correct": true, "hint": "H1",
      "ms": 74000, "confidence": 2, "env": "v86x1" },
    { "t": "2026-11-18T19:33:40Z", "kind": "doc_open", "source": "man", "page": "ps(1)",
      "section": "STANDARD FORMAT SPECIFIERS", "from_item": "linux.process.drill.4" }
  ]
}
```

The `events` field is an append-only log modeled on xAPI, from which all states are recomputed; this makes it possible to change the rules of transitions between states without losing history. The `device` field is filled in by a trial launch of a v86 machine on the first entry into a block that needs a multi-machine environment, and is updated by a button.

---

## 3. Three levels, content tiers and a single block exam

### 3.1. Levels

The level changes the entry point and the amount of support. It changes neither the content core nor the block's final exam.

| Level | In data | Who this is | Support step at the start of a concept | Documentation step at the start of a block | Order within a lesson | Pace |
|---|---|---|---|---|---|---|
| Beginner | `beginner` | No experience in the topic; knows IT as a user | S0 (full worked example) | DL1 | Hook → watch the process → try → explanation | 1 lesson = 1 core concept + 1–3 small ones, 25–40 min |
| Intermediate | `intermediate` | Worked near the topic, ran commands following instructions, knows the words without the model | S1–S2 (example with gaps, assembling from parts) | DL2 | The same, shorter explanation, the explanation's parameters open right away | Repeated screens collapsed, 20–30 min |
| Experienced | `experienced` | Uses the topic at work in an adjacent role, does not know the operational depth | S3 (task with hints on request) | DL3 | Challenge task → process explanation (mandatory, starting with the "break it" mode) → walkthrough | Module = one challenge task + explanation + walkthrough, 15–25 min |

### 3.2. Core, extension, deep dive

Every concept in the graph is marked with a tier:

- **`core`.** The same for all levels. Everything that the following blocks rely on must be in the core: namespaces and cgroups are needed by containers, so they are core Linux for everyone, including the "Beginner".
- **`plus`, extension.** Enabled by default for "Intermediate" and "Experienced"; for "Beginner" — optional after passing the core (the "continue to Intermediate" button). Examples: the NTP, SMTP, HTTP/3, WebSocket and gRPC protocols in networks; `rebase` in Git.
- **`pro`, deep dive.** Enabled by default for "Experienced". Examples: BGP sessions and attributes, IPsec, OSPF; `reflog`; a TypeScript controller on top of the watch API.

Linter rule: a `core` concept cannot require a `plus` or `pro` concept. A concept may have a core idea and deep-dive details (BGP: "providers negotiate routes" is `core`, messages and attributes are `pro`); in that case these are two concepts with an explicit link.

### 3.3. One block exam, different roads to it

**There is one final block exam for all levels, and it checks the core.** An "Experienced" programmer takes the same Linux exam as a former salesperson; they simply arrive at it after roughly 25 hours rather than 75. The extension and deep dive are taken as separate parts of the exam; their result goes into the skill map, not into the "block passed" mark.

Block documents may provide **practice** exams per level (E1–E4 in containers, B/I/E in Kubernetes): these are intermediate checkpoints after which the learner sees their gaps. Only the final exam goes into the course record and the skill map. The level changes how many practice exams the learner takes before the final one, not the final exam itself. Document 05 recasts the B/I/E exams into the form "core final exam (based on B and I) + a `pro` part (based on E, modeled on the CKA)".

**Kubernetes is taken in three stages, and all three are mandatory for all levels** (sections 5, 13.3). Stage 3 — kubeadm on several VMs — is not an extension: without it the learner has never seen the control plane with their own hands, and that is the first question in a junior interview.

### 3.4. Orientation and onboarding

For the "Beginner", the methodology block is preceded by the mini-block "Orientation" (concepts F01–F12): how a computer works, what a program, a file, a server, code, a version, an environment and a configuration are. Without it, the very first sentence about CI/CD contains three unfamiliar words. "Intermediate" and "Experienced" learners skip it via three control questions; correct answers set F01–F12 to `placed`.

Onboarding is a separate 10 minutes before all blocks: three commands (`echo`, `mkdir`, `ls`) with full S0 support, and the words "command" and "folder" are introduced right there in everyday form (`introduces: [orient.file, linux.command]`). After that, "Orientation" and methodology are interleaved with "terminal five-minuters" (`pwd`, `ls`, `cat`, `echo`), so the learner arrives at the Linux block with 20–30 successful commands. Methodology runs in parallel with "Orientation", not after it, following the same "spreading" scheme as the career block.

---

## 4. Placement check

### 4.1. Principle

The learner chooses the level themselves for each block, before the block starts, not at the beginning of the course: a person arrives at Kubernetes different from who they were on day one. The choice is suggested by a short questionnaire of five statements about experience ("I have run commands in a terminal following instructions", "I have written a Dockerfile myself", etc.), but the decision remains with the learner (Knowles: self-direction). A "Beginner" needs no check. Choosing "Intermediate" or "Experienced" is confirmed by a check; it cannot be skipped — without the check, the route runs at the "Beginner" level.

Section 4.1 is a single principle for all blocks. The specific check tasks belong to the block documents (02–07, 10); section 4.3 is the template they are aligned to, and the only source only for blocks that have no document of their own. Numbers mandatory for all blocks:

| Parameter | Value |
|---|---|
| Number of tasks | 5–10 |
| Duration | 15–35 minutes ("Intermediate" closer to 15–20, "Experienced" closer to 30–35) |
| Practical tasks | at least half, and at least two of them `key: true` |
| Threshold | 80% of tasks (rounded up) and all `key: true` |
| "Explain" tasks | not key and do not move concepts to `placed`; they give only the "ready to explain" mark |
| Retake | after 72 hours, a different variant, two attempts |

How the check works:

- **Practice checked by state.** Practical tasks are performed in the browser sandbox and checked by the state of the system, not by the command text: any path to the correct state counts. The rest is theory in formats where guessing is hard: matching, ordering, a numeric answer with tolerance, a choice among close wordings.
- **Explanation without a neural network.** An "explain in your own words" task is graded by self-check against a checklist of rubric items; the AI mentor is not invoked during the check (`exam` mode, 09 §4.5). That is why such tasks do not give `placed`: self-assessment does not prove knowledge.
- **Confidence.** Before submitting each answer, the learner marks confidence: "I know", "I think so", "a guess". A "guess" answer, even a correct one, does not credit the concept as `placed`; it puts it into the review queue: a correct guess is not knowledge. An error under "I know" is marked as a high-confidence error; such errors are corrected better than others (the hypercorrection effect, Butterfield and Metcalfe, 2001), so the walkthrough is shown immediately and in detail.
- **Time.** Time is recorded but does not fail the check. If the total time is no more than three norms, the level is credited; if more, it is credited with a "fluency" note, and speed trainers are added to review.
- **Partial result.** Every task is tied to concepts in the graph. Failed tasks do not lower the level if the check as a whole is passed: the related concepts become "gaps", and lessons for them open even at a high level. The learner sees this as "credited, except for three topics: …", not as a grade.
- **Failed check.** The level is not lowered silently. The learner sees what worked and what did not, and chooses: take the block one level lower, or stay at the claimed level with mandatory lessons on the gaps. If at the chosen level they then fail the exit tickets of two lessons in a row, the product offers once (without imposing) to switch only those modules to a lower level.
- **Retake.** Each task has 3–5 parameterized variants: different file names, ports, addresses, causes of failure. After the second failure, the per-module check remains: before each module, the learner can pass its exit ticket and skip the module. This keeps things honest (no brute-forcing of variants) and does not lock an experienced person into someone else's level.
- **Tone.** The check is called "Show what you can already do", not "test". The first task is always the simplest one in the check. Failure is described in terms of "we'll cover these topics", without percentages on the results screen (percentages are visible in the details).

### 4.2. Check task format

A task is written in the shared check contract of 09 (§2.3–2.4): facts, a `when` predicate, `fail[]` with a targeted message, `envs`. The widget type comes from the list in 08 §3.8; the `number` type (entering a number with tolerance `tol`) is added to 08, because tasks like "how many ERROR lines", "median in days", "43.2 minutes" depend on it.

```yaml
id: linux.place.int.4
block: linux
level: intermediate
kind: task                 # task | order | match | number | choice | explain | hotspot
key: true
concepts: [linux.permissions, linux.script]
time_norm_s: 120
envs: [sim, v86x1]
prompt:
  ru: "Сделай скрипт ~/deploy.sh исполняемым для владельца и запусти его."
  en: "Make ~/deploy.sh executable for its owner and run it."
setup:
  files: [{ path: /home/learner/deploy.sh, mode: "0644", content: "#!/bin/sh\necho DEPLOY-{{token}}\n" }]
goals:
  - id: g1
    needs: [files, cmds]
    when: "files[path=/home/learner/deploy.sh].mode.owner_x=true && cmds[exit=0].stdout~'DEPLOY-{{token}}'"
    fail:
      - if: "files[path=/home/learner/deploy.sh].mode.owner_x=false"
        say: { ru: "Файл всё ещё не исполняемый: посмотри первую колонку ls -l", en: "The file is still not executable: look at the first column of ls -l" }
        term: linux.permissions
variants: 4                # {{token}} and the file name change from variant to variant
```

### 4.3. Levels and checks by block (template)

Below, for each block, it is stated what each level means, and the check tasks are listed. Block documents bring their checks in line with the numbers from 4.1; where a block document gives its own set, that set applies, and this section remains a template. Notation: **P** — a practical task in the sandbox, **T** — theory, **Ex** — an explanation with a rubric (self-check, not key); an asterisk marks a key task.

#### Methodology (DevOps, process, CI/CD as an idea)

| Level | Who this is |
|---|---|
| Beginner | Has not worked in an IT team; knows that "there are developers" |
| Intermediate | Worked near an IT team (SaaS sales, support, project management, QA): saw tickets, releases, task boards, but does not distinguish CI from CD |
| Experienced | Worked in a team with a pipeline: used a board, saw green and red builds, took part in an incident review |

Check for "Intermediate" (6 tasks, criterion 5 of 6, key tasks 3 and 6; in a block without a terminal, tasks on the board and in the simulator count as practice):

1. **T, ordering.** Arrange the stages: idea, writing code, testing, releasing a version, running at users, user feedback. Checked: the order; the cycle must close with feedback leading to the idea.
2. **T, choice.** "A company releases a new version once a quarter, and each release is a week of firefighting and rollbacks. What will DevOps propose first?" Options: hire more testers; release smaller and more often and automate building and testing; forbid changes one month before a release; switch to another language. The correct one is the second; the walkthrough explains why the third option makes the problem worse.
3. **T, click on the board.** A snapshot of a kanban board with card counts and time in columns. Click the column that is the bottleneck. Checked: the identifier of the column where the queue grows while the next one is idle.
4. **T, choice among close options.** Four definitions of continuous integration that differ in one detail (frequency of merging; automatic checking of every merge; a manual run before release; deploying to a server). The correct one is frequent merging into a shared branch with automatic checking of each merge.
5. **T, matching.** Continuous Integration, Continuous Delivery, Continuous Deployment — with three descriptions. The key to telling them apart: Delivery leaves a manual decision about deploying to production, Deployment does not.
6. **P*, simulation.** Five turns of a mini version of the kanban simulator (its design belongs to the process simulation role): set work-in-progress limits so that at least six cards are done within five turns. Checked: the resulting throughput.

Check for "Experienced" (5 tasks, criterion 4 of 5, key tasks 2 and 4):

1. **T, choose 5 of 9.** Mark the five DORA metrics among nine: change lead time, deployment frequency, failed deployment recovery time, change fail rate, deployment rework rate; the traps are test coverage, number of commits, team velocity in story points, uptime. The walkthrough separately explains why "time to restore service" was renamed and narrowed to failures caused by deployments.
2. **T*, number.** A table of events for five cards (taken into work, done, deployed). Calculate the median time from taking into work to deployment, in days. Checked: a number with a tolerance of 0.5.
3. **T, choice.** Three fragments of a postmortem of one incident; choose the one written without blame and explain the choice in one sentence (the sentence is not graded but is shown in the walkthrough next to the reference answer).
4. **P*, simulation.** Ten turns of the simulator with an incident on turn 6. Keep the card cycle time no higher than the given value and restore the service no later than turn 8.
5. **Ex.** "Explain the difference between CI, Continuous Delivery and Continuous Deployment in no more than 80 words." Rubric: frequent merging and automatic checking; an artifact that is always ready to deploy; deployment without a manual step. Self-check against a checklist of three elements; no neural network is invoked during the check.

#### Linux

| Level | Who this is |
|---|---|
| Beginner | Works only through the Windows or macOS graphical interface |
| Intermediate | Has opened a terminal, navigated directories and installed packages following instructions; unsure about permissions, streams, processes |
| Experienced | Works in the terminal daily (a programmer on Linux or macOS), writes simple scripts; does not know systemd, logs, /proc, the kernel |

Check for "Intermediate" (8 tasks, criterion 7 of 8, at least 4 of tasks 1–5):

1. **P*.** Print the last 5 lines of the file `/srv/app/logs/app.log`. Checked: the output matches the reference `tail -n 5`, files are unchanged.
2. **P.** Create the directory `~/backup` and copy all `.conf` files from `/etc/myapp` into it. Checked: the files exist, their sha256 matches the originals, there are no extra files.
3. **P.** How many lines with the word `ERROR` are in `app.log`? Enter the number. Checked: the number (the variant changes the count).
4. **P*.** Make `~/deploy.sh` executable for the owner and run it (format above).
5. **P*.** There is a process in the system that takes almost the entire CPU. Find it and stop it. Checked: the load process spawned by the sandbox is gone; other processes are alive.
6. **T, choice.** What does `command > out.txt 2>&1` do? Four options; the correct one is both streams into the file.
7. **T, choice.** The file `-rw-r----- alice dev report.txt`. Can bob from the dev group write to it? Read it? Checked: the pair of answers "no / yes".
8. **T, choice.** Why is the command `myscript` not found even though the file is in the current directory? The correct answer is related to `PATH`.

Check for "Experienced" (10 tasks, criterion 8 of 10, key tasks 1, 2, 7):

1. **P*.** The `web` service does not start. Find the cause in the log (`journalctl -u web`) and fix the configuration. Checked: `systemctl is-active web` → `active`.
2. **P*.** Write a script `top3.sh`: it takes a directory and prints the three largest files in it; without an argument it exits with code 2 and a message on stderr. Checked: hidden tests — three directories, a call without an argument, checking the exit code and the streams.
3. **P.** From `access.log`, print the five IP addresses with the most requests, in descending order. Checked: the output.
4. **P.** The disk is almost full. Find a directory in `/var` that takes more than 1 GB and enter its path. Checked: the path.
5. **P.** Create a user `deploy` in the group `www` and give the group write permission on `/srv/www`. Checked: the account, membership, directory permissions.
6. **P.** Add a job that runs `/opt/backup.sh` every 5 minutes. Checked: the learner's crontab is parsed, and the schedule is equivalent to `*/5 * * * *`.
7. **P*.** Without Docker, using Linux tools: start a shell in a new process namespace so that inside it `ps` shows only the shell itself and its descendants (moved here from the containers check). The solution is `unshare --pid --fork --mount-proc bash` (as a regular user — with `--user --map-root-user`). Checked by facts from the tier B agent: the shell's `readlink /proc/<pid>/ns/pid` differs from the host, the last value of `NSpid` in `/proc/<pid>/status` is 1, and `ps` inside prints fewer than six lines. Without `--fork`, `echo $$` does not give 1; without `--mount-proc`, `ps` shows the host's processes — the walkthrough explains both traps.
8. **T, matching.** SIGTERM, SIGKILL, SIGHUP — with the process behavior.
9. **T, choice.** What will `set -e` do in a script if the second of five commands returns code 1?
10. **Ex.** "What happens between pressing Enter after `ls` and the list of files appearing?" Rubric: the shell parses the line; looks for the program in PATH; creates a process (fork and exec); the program calls the kernel via system calls; the output goes to the terminal's stdout. Self-check, 4 of 5.

#### Networks

| Level | Who this is |
|---|---|
| Beginner | Knows the words "Wi-Fi", "internet", "IP" in everyday use |
| Intermediate | Has configured a router, set DNS, pinged; knows what an IP and a port are, but not subnets, routes and NAT |
| Experienced | A web developer or administrator: fluent with HTTP, curl, ports; weaker in routing, NAT, firewalls, TLS |

Check for "Intermediate" (7 tasks, criterion 6 of 7, key tasks 1 and 2):

1. **P*.** Find the server's IP address on the `eth0` interface and the default gateway. Enter both. Checked: the values.
2. **P*.** Is anything listening on port 8080, and which process is it? Enter the process name. The listener is started by another user, so `ss -ltnp` without root will not show the process column: the walkthrough teaches `sudo ss -ltnp`, and `setup` gives the learner `sudo` rights.
3. **P.** Find the IP address of the name `shop.lab`. Checked: the address (the sandbox runs its own DNS).
4. **T, choice.** Are 192.168.1.10/24 and 192.168.2.10/24 in the same subnet? Is a router needed between them?
5. **T, matching.** DNS, DHCP, NAT — with their tasks.
6. **T, matching.** TCP or UDP: a DNS query, a file download, a video call.
7. **T, choice.** "Connection refused" and "Connection timed out": what each one says about the server and the path to it.

Check for "Experienced" (7 tasks, criterion 6 of 7, key tasks 2 and 3):

1. **P.** `curl https://api.lab` fails with a certificate error. Find out the cause (expired or name mismatch) and enter it. Checked: one of the options according to the scenario.
2. **P*.** The service `10.0.1.5:80` is unreachable from a host in the network `10.0.2.0/24`. Fix the route. Checked: a request from host B returns 200.
3. **P*.** Allow incoming 443, close 8080, without losing SSH. Environment `envs: [netlab]` with a netfilter model; predicate `probe.tcp[dst_port=22].result=accept && probe.tcp[dst_port=443].result=accept && probe.tcp[dst_port=8080].result~drop|reject`. REJECT and DROP both count as "closed"; the walkthrough explains the difference between timeout and refused (linked to task 7 of the "Intermediate" check).
4. **T, number.** How many host addresses are in a /26? Into which four equal subnets is 10.0.0.0/24 divided?
5. **T, choice.** What does NAT change in a packet when a laptop on a home network goes to the internet?
6. **T, matching.** MAC, IP, TCP, HTTP — with the layers of the OSI model.
7. **Ex.** "A user opens a site and gets a 504. Describe what you check and in what order." Rubric: the name resolves; the connection is established; TLS succeeds; the 504 response comes from the proxy, so the proxy did not get a reply from the backend in time; we look at the logs and the availability of the backend. Self-check, 4 of 5.

#### Containers

| Level | Who this is |
|---|---|
| Beginner | Has not run containers |
| Intermediate | Has run `docker run` and `docker compose up` from a README; has not written a Dockerfile or wrote one from a template |
| Experienced | Writes Dockerfiles and compose files; does not know what a container is made of (bundle, runtime chain, layers), how it interacts with its environment (PID 1, logs, UID), has not done multi-stage builds and has not thought about image security |

Check for "Intermediate" (7 tasks, criterion 6 of 7, key tasks 1 and 3):

1. **P*.** Run nginx in a container so that it answers on port 8081 of the host. Checked: `curl localhost:8081` → 200.
2. **P.** The `api` container crashed. Find the cause in its logs and enter the keyword of the error.
3. **P*.** Write a Dockerfile for `app.py` (a Python web application, dependencies in `requirements.txt`). Checked: the image builds, the container answers on `/health`.
4. **P.** Run a container with the variable `APP_MODE=prod`. Checked: the variable is visible inside the container.
5. **T, choice.** An image and a container — how they differ (four close wordings).
6. **T, choice.** After `docker rm`, the database data is gone. What should have been done? The correct answer is a volume.
7. **T, choice.** The main technological difference between a container and a virtual machine. The correct answer is the shared host kernel.

Check for "Experienced" (7 tasks, criterion 6 of 7, key tasks 4 and 5):

1. **P.** Shrink the image of a Go application from ~900 MB to under 30 MB. Environment `envs: [sim]`: dsim does not compile Go, so the base images (`golang:1.x`, `scratch`, `gcr.io/distroless/static`) and the result of `go build` are stubs with real sizes from the golden recording `golden/go-multistage`; predicate `images[tag=app:small].size<30M && http.app.status=200`.
2. **P.** Restructure the Dockerfile so that a code change does not cause dependencies to be reinstalled. Checked: the sandbox changes a code file and rebuilds; the dependency layer is taken from the cache.
3. **P.** compose: the application and PostgreSQL on a shared network, the application finds the database by the service name. Checked: the application's `/db` answers 200.
4. **P*.** Limit the container to 256 MB of memory. Checked: the limit; an additional question: what happens when it is exceeded (OOM kill).
5. **P*.** `docker stop app` waits 10 seconds and exits with code 137, and the application loses unwritten data. Find the boundary and fix it so that stopping takes less than 2 seconds. Cause variants by seed: the shell form of `CMD` (the signal is received by `sh`); no SIGTERM handler in PID 1 (`--init`). Checked: `docker stop` < 2 s, code 0 or 143, the line `graceful shutdown` in the log.
6. **T, matching.** Parts of an image: layer archives, configuration, manifest, digest — with descriptions.
7. **Ex.** "How a container differs from a virtual machine", in terms of kernel mechanisms. Rubric: a host process; namespaces — what it sees; cgroups — how much it consumes; capabilities and seccomp — what is allowed; a shared kernel; a VM has its own kernel on top of a hypervisor. Self-check, 5 of 6.

#### CI/CD and Git

| Level | Who this is |
|---|---|
| Beginner | Has not used Git |
| Intermediate | Committed and pushed through an IDE, saw green CI checkmarks, did not edit the pipeline itself |
| Experienced | Works with branches and merge requests, has edited a CI file, but has not built a pipeline from commit to deployment |

Check for "Intermediate" (5 tasks, criterion 4 of 5, key tasks 1 and 2):

1. **P*.** Create the branch `fix-title`, commit a change to `index.html`, merge the branch into `main`. Checked: the history contains the commit and the merge, the change is in `main`.
2. **P*.** Resolve a merge conflict between two branches in `config.yaml` so that both keys remain. Checked: the file contents, the merge commit.
3. **P.** Add a `test` job to the pipeline file that runs `make test` at the `test` stage. Checked: the runner simulator executes the job.
4. **T, matching.** CI, Continuous Delivery, Continuous Deployment.
5. **T, choice.** Why did the pipeline turn red if the tests "seemed to pass"? The job output is shown; the correct answer is that the command returned a non-zero code.

Check for "Experienced" (5 tasks, criterion 4 of 5, key tasks 1 and 2):

1. **P*.** Build a pipeline: style check → tests → image build → publishing with the commit tag → deployment to a test server. Checked: all stages are green in the simulator, and the image with the right tag is running on the "server".
2. **P*.** The repository contains the database password in `settings.py`, and it is already in the history. Eliminate the leak. Checked: (1) the password is not in the working tree; (2) the job gets it from a CI variable with the masked flag; (3) the variable's value differs from the committed one — the secret has been replaced; (4) a `choice` question "what else needs to be done" with the correct answer "change the password in the database and revoke the old one". The distractor "removing it from the last commit is enough" points to the misconception `cicd.secret-removed-from-head`; rewriting history is a separate team decision.
3. **P.** Make deployment to production run only from `main` and only manually. Checked: the pipeline rules on three test events.
4. **T, choice.** Which part of a semantic version should be bumped for an incompatible API change?
5. **Ex.** "A new version broke checkout. How do you roll back, and how do you make fewer users affected next time?" Rubric: rollback to the previous artifact; canary or blue-green; an automatic health check before switching. Self-check, 2 of 3.

#### Kubernetes

The block opens only after passing containers, as the checklist requires ("only after confident Docker"). So "Beginner" here means "knows containers from our block, has not seen clusters". The level descriptions are aligned with 05 §2.

| Level | Who this is |
|---|---|
| Beginner | Confident Docker, has not seen a cluster |
| Intermediate | Has done `kubectl apply` and `kubectl get pods` following instructions, or deploys to Kubernetes at work using ready-made manifests and Helm values; does not know the control plane, Service networking, RBAC, debugging |
| Experienced | A programmer or administrator who writes manifests and charts and investigates pod failures; the goal by the end of the block is CKA level |

Check for "Intermediate" (6 tasks, criterion 5 of 6, key tasks 1 and 3):

1. **P*.** Create a Deployment of three nginx replicas and a ClusterIP Service for it. Checked: three ready pods, three ready addresses in the service's EndpointSlice (`kubectl get endpointslices -l kubernetes.io/service-name=…`).
2. **P.** A pod is in `CrashLoopBackOff`. Find the cause (`logs`, `describe`) and enter it.
3. **P*.** Scale to five replicas, then roll the Deployment back to the previous image version. Checked: the number of replicas and the image of the current revision.
4. **T, choice.** Who decides which node a pod will run on?
5. **T, choice.** What happens if you delete one pod of a Deployment by hand?
6. **T, matching.** ConfigMap and Secret — with data examples.

Check for "Experienced" (7 tasks, criterion 6 of 7, key tasks 1, 4 and 5):

1. **P*.** The site cannot be opened from outside. Find the break in the chain ingress → Service → selector → pod (labels do not match) and fix it. Two variants by seed: entry via Ingress or via Gateway API (HTTPRoute). Checked: a request from outside → 200.
2. **P.** Add a readiness probe so that traffic does not go to a pod that is not ready. Checked: the sandbox slows down startup, the endpoint appears only after readiness.
3. **P.** Give the ServiceAccount `reader` the right only to read pods in the `dev` namespace. Checked: `kubectl auth can-i` on four action-resource pairs.
4. **P*.** A pod is stuck in `Pending`. Find the cause (the resource request exceeds free capacity) and fix it. Checked: the pod is `Running`.
5. **T*, builder.** Assemble from blocks the path from `kubectl apply -f deploy.yaml` to a running container: kubectl, API server, etcd, Deployment controller, ReplicaSet controller, scheduler, kubelet, container runtime. Checked: the order and the "who watches whom" arrows.
6. **Ex.** "Where does a Service IP address live, and who turns a request to it into a request to a pod?" Rubric: a virtual address that exists on no interface; kube-proxy; iptables or nftables rules on every node (or eBPF with Cilium without kube-proxy; mentioning IPVS counts but is not required — the mode is deprecated since v1.35); EndpointSlice. Self-check, 3 of 4.
7. **P.** Install a Helm chart with modified values (two replicas, a different image tag). Checked: the release, the number of replicas, the image.

#### IaC (Terraform, Ansible)

| Level | Who this is |
|---|---|
| Beginner | Has not heard of it or has heard the name |
| Intermediate | Has run `terraform apply` or `ansible-playbook` on existing code |
| Experienced | Has written small Terraform configurations or playbooks; has not worked with remote state, modules, roles, has not thought about idempotency |

Check for "Intermediate" (5 tasks, criterion 4 of 5, key tasks 1 and 2):

1. **P*.** In an existing Terraform configuration, change the VM size and run `plan`. How many resources will be changed, created, destroyed? Checked: three numbers (the sandbox provides a training provider without a cloud).
2. **P*.** To a playbook that installs nginx, add a task that copies `index.html`. Checked on training hosts.
3. **T, choice.** What Terraform state stores and why it is needed.
4. **T, choice.** A playbook was run a second time without changes. What should the outcome be? The correct answer is `changed=0`.
5. **T, matching.** Terraform and Ansible — with the tasks "create a network and a VM", "install a package and configure a service".

Check for "Experienced" (6 tasks, criterion 5 of 6, key tasks 2 and 3):

1. **P.** Extract three identical resources into a module with a count parameter. Checked: `plan` after the refactoring does not change the infrastructure.
2. **P*.** The task `shell: echo ... >> file` appends a line on every run. Make it idempotent. Checked: the second run gives `changed=0`, there is one line.
3. **P*.** Someone changed a resource by hand. Detect the drift and bring it back in line with the code. Checked: `plan` is empty.
4. **T, choice.** Why remote state and locking are needed when two people work.
5. **P.** A role that restarts a service only when the configuration template changes. Checked: two runs, with and without a change.
6. **Ex.** "Where should the database password that a playbook needs be stored?" Rubric: not in git in plain text; a secrets store or vault; access through CI environment variables. Self-check, 2 of 3.

#### Monitoring

| Level | Who this is |
|---|---|
| Beginner | Has not seen dashboards |
| Intermediate | Has looked at ready-made Grafana dashboards, knows the word "metric" |
| Experienced | Has configured alerts or written simple PromQL queries, or has worked with Zabbix |

Check for "Intermediate" (5 tasks, criterion 4 of 5, key tasks 1 and 2):

1. **P*.** In the training Prometheus, find the CPU usage metric for node `node-2` and enter the current value.
2. **P*.** In the training Grafana, build a panel showing requests per second.
3. **T, choice.** A counter and a gauge: which is which — on three examples.
4. **T, matching.** Metrics, logs, traces — with the questions "how much", "what exactly happened", "where the request is slow".
5. **T, choice.** Who connects to whom in Prometheus: the server to the application or the other way around.

Check for "Experienced" (5 tasks, criterion 4 of 5, key tasks 1 and 2):

1. **P*.** A query: the share of 5xx responses over 5 minutes for each service. Checked: the query result on the training dataset matches the reference (series are compared, not the query text).
2. **P*.** An alert rule: more than 5% errors for 10 minutes. Checked: on a synthetic timeline, the alert fires at the given minute and does not fire on a short spike.
3. **P.** The 95th percentile of latency from a histogram. Checked: the result.
4. **T, number.** An availability SLO of 99.9% over 30 days. How many minutes of downtime are in the budget? The answer is 43.2.
5. **Ex.** The USE and RED methods: what each one measures and what it is for. A rubric of four elements, self-check, 3 of 4.

#### Career

Here the level means interview experience, and the check neither opens nor closes modules: it only sets the emphasis.

| Level | Who this is |
|---|---|
| Beginner | Has not had IT interviews |
| Intermediate | Has had interviews for non-technical IT roles or technical ones in another field |
| Experienced | Has had technical interviews as a developer or administrator |

Diagnostics (for all levels, 5 tasks, about 25 minutes):

1. **Ex.** A two-minute self-introduction (text or voice recording). Rubric: who I am and where I come from; why DevOps; what I have done with my own hands; what I am looking for. Shows whether the self-introduction module is needed.
2. **Ex.** An answer to "What is DNS?" following the checklist scheme "what → why → how it works → when you use it".
3. **T, choice.** Four answers to a question the candidate does not know; the best one is an honest "I don't know" plus reasoning out loud about how they would find out.
4. **P.** In a training résumé, mark the lines that are not relevant to a DevOps profile.
5. **Ex.** (For "Intermediate" and "Experienced".) The situational question "504 — what do you do?", with the rubric as in the "Networks" block.

---

## 5. Order of blocks and justification of departures from the checklist

| No. | Block | Checklist step | Why here |
|---|---|---|---|
| 0 | Onboarding (10 minutes) and Orientation ("Beginner" only) | — | Without the concepts "program", "server", "version" it is impossible to explain even why DevOps is needed; onboarding gives the first successful action in the terminal before any theory |
| 1 | Methodology | 1 | Motivation and a picture of the profession before tools; does not require a terminal. Interleaved with Orientation |
| 2 | Linux, including the module "How the kernel isolates and limits" and the module "Your own machine in the cloud" | 2 | The foundation. By the end of the block the learner knows everything a container is made of (L33–L41) and can order, secure and delete a VM (L44) |
| 2a | Git and YAML | — | Needed from the containers block on: Dockerfiles, compose files and manifests live in a repository. Require only files, an editor and a shell (decision 06 §0.1) |
| 3 | Networks: map of the internet → envelopes with fields → layers by hand → whole processes → protocol catalog | 3 | Needs Linux: process, socket, net namespace |
| 4 | Containers | 4 | Needs Linux (isolation, overlayfs, signals) and networks (veth, bridge, NAT, DNAT) |
| 5 | CI/CD | 1 (practice) | A job runs in an image, the pipeline builds and publishes an image: without containers this is magic |
| 6 | Kubernetes, stage 1: browser — the kube-lite simulator and a hybrid cluster on v86 machines; includes a large section "Kubernetes networking" and the reconciliation loop | 5 | Only after passing containers |
| 7 | Kubernetes, stage 2: a real single-node cluster (k3s, kind or minikube) on your own machine or on one VM; Helm, Ingress and Gateway API, images from a real registry; deployment from CI (06, module A7) | 5 | Transition from the model to a real cluster without the cost of several machines; one VM ordered by hand in L44 is the pain that IaC later removes |
| 8 | IaC: Ansible, then Terraform | 6 | Ansible builds on the familiar (ssh, packages, systemd), Terraform introduces a new entity — a cloud resource (decision 06 §0.1) |
| 9 | Kubernetes, stage 3: kubeadm on 3+ VMs ordered with Terraform and configured with Ansible; Cilium CNI, storage, certificates, version upgrade, etcd backup, breaking and fixing a node | 5 + 6 | The first task where IaC pays off: three identical machines, repeatable configuration, cleanup with one command. Here the trainer does not execute; it guides and checks |
| 10 | Monitoring | 7 | Installed on the stage 3 cluster if it is still alive, otherwise on the stage 2 cluster |
| 11 | Pet project | 8 | A combined project from all blocks |
| 12 | Career | 9–11 | Modules open earlier and run in parallel in short sessions |

The career block is deliberately "spread out": the module "how to read a job posting" opens right after methodology, the résumé draft after containers, the self-introduction after the first pet project, the mock interview after the networking situational question and the first pet project, the Kubernetes situational questions after K33 (schedule — 10 §9, decision of master document 00 §10). The checklist advises applying when there is a 60% match and going to interviews as practice; the learner should start doing this before they feel ready.

Where a VM first appears. The first cloud VM is needed before Kubernetes: the optional Linux exam at tier C (02), the networks exam on two VMs (03), "real Docker on a VM" (04). Therefore the concept "cloud VM: ordering, key, public IP, security group, cost, deletion" lives in Linux (L44, after SSH), not in Kubernetes as in the first edition. The "Cost" screen and the "Cleanup" step (section 7.4) are introduced there and then reused in stage 2, in IaC and in stage 3.

---

## 6. Concept graph and the order rule

### 6.1. Rule

No term appears on a screen, in a chapter, in a task, in sandbox output with a hint, in a process explanation or in an AI mentor answer before the learner has reached the screen where this term is introduced or has obtained it through the placement check. The rule is checked by machine.

**Concept and term.** The graph has two granularities. A *concept* (`concept`) is a unit of mastery and of FSRS review; there are about three hundred of them in the course. A *term* (`term`) is a unit of the linter: a word that can appear in text; each has a `concept:` field. Block documents list about 600 terms (02 §5.1 — ~150, 03 §3 — ~100, 05 §3 — 46 entries), and this is normal: rule CL1 "no more than one new concept per screen" applies to concepts, while up to three terms are allowed on a screen if all of them belong to the concept being introduced. The DNS resolution scene introduces one concept `net.dns-resolution` and the terms "resolver", "root server", "TTL".

**Concept schema:**

```yaml
- id: k8s.pod
  code: K09                       # alias for the tables in this document
  block: kubernetes
  tier: core                      # core | plus | pro
  stage: 1                        # only for the Kubernetes block
  process: false                  # true — the concept has a mechanism over time, an explainer is needed (CL17)
  env_min: sim                    # sim | v86x1 | v86x3 — the minimum environment for practice
  name: { ru: "Под", en: "Pod" }
  forms:
    ru: ["под(а|у|ом|е|ы|ов|ам|ами|ах)?\\b"]
    en: ["\\bpods?\\b"]
  requires: [k8s.cluster, k8s.desired-state, docker.container]
  contrast_with: []               # a homonym or something similar: show the contrast, but do not require it
  terms: [k8s.pod-ip, k8s.sidecar]
  sources:
    - { lang: en, title: "Kubernetes docs: Pods", url: "https://kubernetes.io/docs/concepts/workloads/pods/" }
    - { lang: ru, title: "Документация Kubernetes: Поды", url: "https://kubernetes.io/ru/docs/concepts/workloads/pods/" }
```

**What the build checks:**

- the graph is acyclic; a `core` concept does not require `plus` or `pro`; a concept of `stage: 1` does not require concepts of stages 2–3;
- every screen and chapter paragraph has `introduces` (no more than one concept, CL1) and `uses`; all `uses` and all prerequisites of `introduces` are introduced earlier on every admissible learner path (taking into account the level and the chosen tiers);
- the text of a screen, chapter or explanation contains no word forms of terms that are not in `uses` and `introduces` and their `terms`; a violation fails the build;
- every `process: true` has at least one process explanation (section 9);
- every `contrast_with` has a contrast screen where the second concept of the pair is introduced.

**Running ahead.** An unavoidable mention before introduction (for example, the word "Kubernetes" in the overview of the profession) is marked with an explicit `forward: [k8s.cluster]` and a pop-up card "for now it is enough to know that this is…". There is no more than one such place per lesson.

**Flags and subcommands are not concepts.** The order rule applies to concepts and terms, not to flags, options and subcommands. A task at documentation ladder step DL4 (section 11) may require a flag that was not in the theory (`ss -p`, `journalctl -p err`), but not a new concept: "conntrack" without introduction is not allowed. A documentation page that the learner opens is not subject to the order rule: it is external text, and the learner learns to find their way in it, skipping the unfamiliar.

**Clickability.** Terms introduced earlier remain clickable: a click opens the concept card over the lesson, closing it returns to the same place (this is how the glossary works in Sankofa).

**Mentor.** AI mentor answers receive the list of introduced concepts in their context (section 16.4) and must respect it.

**Homonyms.** "Namespace" in Linux (`linux.namespaces`) and "Namespace" in Kubernetes (`k8s.namespace`) are different concepts linked through `contrast_with`, not through `requires`: lesson 05 K2 can be taken without reopening the chapter on isolation, but the contrast screen is always shown. In the same way, "process" in the everyday sense (F02) and a Linux process (L17), "server" as a machine (F06) and as a program listening on a port (N13), rolling update in CI/CD (C14) and in a Deployment (K12) are kept apart.

**Who owns the order.** The methodology group (M) belongs to 07; module A0 in 06 only repeats it with a reference (`uses`, not `introduces`). SLO as an idea is introduced in methodology (`method.slo`), while SLI as a PromQL query and burn rate are introduced in monitoring (`obs.slo-promql`). The order of the other groups below is agreed with the block documents; the places where a block document must change are listed in the "Changes after review" section.

### 6.2. Graph

About three hundred concepts in 14 groups; the exact number is generated from `concepts.yaml` at build time and is not written by hand in the document. The order of rows is an admissible order of introduction; prerequisites always come above. Within a block, lessons may rearrange concepts if the graph allows it. The "Requires" column contains alias codes; `concepts.yaml` records slugs. The tier, if not stated, is `core`. An asterisk after a code marks a process concept (`process: true`).

**Orientation (F, "Beginner" only; onboarding introduces F03 and L02 in everyday form)**

| Code | Slug | Concept | Requires |
|---|---|---|---|
| F01 | `orient.computer` | Computer: processor, memory, disk | — |
| F02 | `orient.program` | A program and running it (everyday sense) | F01 |
| F03 | `orient.file` | File and folder | F01 |
| F04 | `orient.os` | Operating system | F01, F02, F03 |
| F05 | `orient.network` | A network as a connection between computers | F01 |
| F06 | `orient.server` | A server as a machine that serves others | F04, F05 |
| F07 | `orient.client-request` | Client, request, response | F05 |
| F08 | `orient.source-build` | Source code and building a program | F02 |
| F09 | `orient.version` | Version and release | F08 |
| F10 | `orient.environments` | Environment: development, test, production | F06, F09 |
| F11 | `orient.config` | Configuration separate from code | F03, F08 |
| F12 | `orient.collaboration` | Working on code together and merging changes | F08 |

**Methodology (M; the order owner is 07 §3, this is a summary)**

| Code | Slug | Concept | Requires |
|---|---|---|---|
| M01 | `method.sdlc` | Software lifecycle | F08, F09, F10 |
| M02 | `method.dev-ops-conflict` | Development and operations: roles and the conflict of goals | M01 |
| M03 | `method.devops` | DevOps as a methodology and the engineer's role | M02 |
| M04 | `method.value-stream` | Value stream | M01 |
| M05 | `method.card-dod` | A task card and the definition of done | M04 |
| M06 | `method.kanban-board` | Kanban board and columns | M05 |
| M07 | `method.wip` | Work-in-progress limit (WIP) | M06 |
| M08 | `method.lead-cycle-time` | Lead time and cycle time | M06 |
| M09* | `method.bottleneck` | Bottleneck | M07, M08 |
| M10 | `method.automation` | Automation as the main tool | M03, M09 |
| M11 | `method.feedback-small-batches` | Feedback and small batches | M03, M08 |
| M12* | `method.incident-postmortem` | Incident and blameless postmortem | M02, M11 |
| M14 | `method.ci` | Continuous integration (CI) | F12, M10 |
| M15 | `method.continuous-delivery` | Continuous Delivery | M14, F10 |
| M16 | `method.continuous-deployment` | Continuous Deployment | M15 |
| M17* | `method.pipeline` | Pipeline as a concept; a task from idea to production | M14, M15 |
| M13 | `method.dora` | DORA metrics: five indicators — change lead time, deployment frequency, failed deployment recovery time, change fail rate, deployment rework rate | M08, M12, M16 |
| M18 | `method.scrum-vs-kanban` | Scrum and Kanban: a comparison | M06, M11 |
| M19 | `method.slo` | SLO and error budget as the idea of an agreement on reliability | M12, M13 |

**Linux (L)**

| Code | Slug | Concept | Requires |
|---|---|---|---|
| L00 | `linux.kernel-idea` | The kernel in plain terms: the main program of the OS, through which all others get the processor, memory, disk and network | F04 |
| L01 | `linux.terminal-shell` | Terminal and shell | F04, L00 |
| L02 | `linux.command` | Command, arguments, options | L01 |
| L03 | `linux.fs-tree` | The file system as a tree, the root `/` | F03, L01 |
| L04 | `linux.path` | Path; `pwd`, `cd`, `ls` | L02, L03 |
| L05 | `linux.home-hidden` | Home directory `~`, hidden files | L04 |
| L06 | `linux.file-ops` | `mkdir`, `touch`, `cp`, `mv`, `rm` | L04 |
| L07 | `linux.view-text` | Viewing text: `cat`, `less`, `head`, `tail` | L04 |
| L08 | `linux.man-help` | Help: `man`, `--help`; anatomy of a manual page (NAME, SYNOPSIS, DESCRIPTION, OPTIONS, EXAMPLES, SEE ALSO), sections 1/5/8 | L02 |
| L09 | `linux.editor` | A terminal editor: `nano`, a minimum of `vim` | L07 |
| L10 | `linux.users-groups` | User and group, UID and GID | F04, L07 |
| L11 | `linux.permissions` | `rwx` permissions, `chmod`, `chown` | L06, L10 |
| L12 | `linux.root-sudo` | root and `sudo`; why `rm -rf /` refuses to work (`--preserve-root`) and why this does not protect against `sudo rm -rf /*` | L11 |
| L13 | `linux.streams` | The stdin, stdout, stderr streams | L07 |
| L14 | `linux.redirection` | Redirection `>`, `>>`, `2>` | L06, L13 |
| L15 | `linux.pipe-filters` | The pipeline `\|`; `grep`, `wc`, `sort`, `uniq` (as a "pipe", without the word "process"; the spiral is in L33) | L13 |
| L16 | `linux.env-path` | Environment variables, `PATH`, `which`, `type` | L02, L04 |
| L17 | `linux.process` | Process, PID, PPID, `ps`, `top`; the kernel creates a process | F02, L00, L02 |
| L18 | `linux.signals` | Signals and `kill`; SIGTERM, SIGKILL, SIGHUP | L17 |
| L19 | `linux.exit-code` | Exit code; `&&`, `\|\|` | L17 |
| L20 | `linux.script` | Script: shebang, executable file | L09, L11, L19 |
| L21 | `linux.script-control` | Variables, conditions, loops, script arguments, `set -euo pipefail` | L16, L20 |
| L22 | `linux.packages` | Packages and `apt` | L12, F09 |
| L23* | `linux.systemd` | Daemon, systemd unit, `systemctl`; restarting a crashed service | L17, L22 |
| L24 | `linux.journal` | Logs: `journalctl`, `/var/log` | L07, L23 |
| L25 | `linux.disks-mount` | Disks and mounting: `mount`, `df`, `du` | L03 |
| L26 | `linux.proc-sys` | `/proc` and `/sys` | L17, L25 |
| L27 | `linux.syscall` | System call; kernel space and user space | L00, L17 |
| L28 | `linux.scheduling` | Scheduling: `cron`, systemd timers | L21, L23 |
| L29 | `linux.archives` | Archives: `tar`, `gzip` | L06 |
| L30 | `linux.hash` | Checksum: `sha256sum` | L07 |
| L32 | `linux.find-xargs` | `find` and `xargs` | L15 |
| L45* | `linux.boot` | Booting a machine: firmware → bootloader → kernel → initramfs → systemd (PID 1) → units | L23, L27 |
| L42 | `linux.net-commands` | The network from the machine's point of view: `ip a`, `ip r`, `ss -ltnp`, `ping`, `curl`, `dig` as observation commands (models are in the "Networks" block) | L17, L02 |
| L43 | `linux.ssh-basic` | SSH as a user: key login, `ssh-keygen`, `authorized_keys`, `known_hosts` | L10, L11, L42 |
| L44 | `linux.vps` | Your own machine in the cloud: ordering, SSH key, public IP, security group, basic hardening, **cost and deletion** | L12, L43 |

*Module "How the kernel isolates and limits" (`linux.m15`, tier B, core for all levels).* This is the foundation of the containers block: everything that block relies on is introduced here. In 02 these are modules M14 "The kernel from the inside: /proc, /sys, memory" and M15 "How the kernel isolates and limits"; M15 is mandatory for all levels. The codes L33–L45 in this table are aliases for reading; in 02 the same concepts have other codes, and the source of truth is the slugs (00 §10).

| Code | Slug | Concept | Requires | Commands and files |
|---|---|---|---|---|
| L33* | `linux.fork-exec` | How a process is born: `fork` and `exec`, parent and child, PPID, the tree, zombie and orphan; how the shell finds a program via `PATH`; a pipeline as two processes and a kernel buffer | L15, L16, L17, L19, L27 | `pstree -p`, `ps -o pid,ppid,stat,cmd`, `strace -f -e trace=clone,execve bash -c ls`, `type`, `hash` |
| L34 | `linux.thread` | Thread and process: threads share memory and the group PID, each has its own TID | L26, L33 | `ls /proc/<pid>/task/`, `ps -eLf` (columns LWP, NLWP), `ps -T -p <pid>`, `top -H` |
| L35* | `linux.namespaces` | Namespaces: pid, mnt, uts, ipc, net, user, cgroup, time; links in `/proc/<pid>/ns` | L26, L27, L33 | `lsns`, `readlink /proc/$$/ns/pid`, `unshare --pid --fork --mount-proc bash`, `unshare --uts`, `unshare --user --map-root-user`, `nsenter -t <pid> -a` |
| L36* | `linux.cgroups` | cgroups v2: the `/sys/fs/cgroup` tree, controllers, `memory.max`, `memory.events`, `cpu.max`, `pids.max`, `cgroup.procs`; the OOM killer; systemd slices | L17, L23, L26 | `systemd-cgls`, `cat /proc/self/cgroup`, `mkdir /sys/fs/cgroup/lab`, `echo 20M > memory.max`, `echo "20000 100000" > cpu.max`, `dmesg \| grep -i oom`, `systemd-run --scope -p MemoryMax=50M` |
| L37 | `linux.capabilities` | root is split into privileges; the effective and permitted sets; file capabilities; `CAP_NET_BIND_SERVICE` | L12, L27 | `capsh --print`, `grep Cap /proc/$$/status`, `getcap /usr/bin/ping`, `setcap cap_net_bind_service=+ep ./srv` |
| L38 | `linux.mount-chroot` | Mounting in more depth: bind mount, mount namespace, your own root; `chroot` and how `pivot_root` differs from it (idea) | L25, L35 | `mount --bind`, `findmnt`, `chroot ./rootfs /bin/sh`, `unshare --mount` |
| L39 | `linux.overlayfs` | overlayfs: lowerdir, upperdir, workdir, merged; copy-on-write (copy-up), whiteout | L38 | `mount -t overlay overlay -o lowerdir=…,upperdir=…,workdir=… merged` |
| L40 | `linux.seccomp` | seccomp at the level of the idea: a filter of a process's system calls | L27, L37 | `grep Seccomp /proc/$$/status` |
| L41* | `linux.isolation-sum` | Summary: process + namespaces (what it sees) + cgroup (how much it may use) + capabilities (what is allowed) + its own root (which files) + seccomp (which calls). The "container by hand" lab; the word "container" goes through `forward` | L35–L40 | `unshare`, `chroot`, `cgroup.procs` together |

**Git and YAML (G, Y; after Linux, before networks; order — 06 §0.2)**

| Code | Slug | Concept | Requires | Tier |
|---|---|---|---|---|
| G01 | `git.repo` | Version control system, repository; `git init`, `clone` | F12, L04 | core |
| G02 | `git.commit` | Working directory, index, commit, history; `add`, `commit`, `log`, `diff` | G01, L09 | core |
| G03 | `git.branch-merge` | Branch, HEAD, merge, conflict | G02 | core |
| G04 | `git.remote` | Remote repository; `push`, `fetch`, `pull` over SSH and HTTPS | G03, L43 | core |
| G05 | `git.merge-request` | Merge request and code review | G04, M14 | core |
| G06 | `git.ignore-secrets` | `.gitignore`; secrets outside the repository; a leaked secret must be changed, not only deleted | G02, F11 | core |
| G07 | `git.tags-semver` | Tags and semantic versioning | G02, F09 | core |
| G08 | `git.rebase` | rebase | G03 | plus |
| G09 | `git.reflog` | reflog and recovery | G08 | pro |
| Y01 | `yaml.basics` | YAML and JSON: document, key and value, map, list, nesting by indentation, multi-line strings | L09 | core |
| Y02 | `yaml.traps` | Scalar types and traps (`yes`, `on`, `0755`, `1.10`); anchors and aliases are `pro` | Y01 | core |

**Networks (N; from the big picture to the packet)**

Order of the block: (1) a map of the internet, (2) the layer model as nested envelopes, (3) each layer by hand, starting with the frame and MAC (order of 03 N1–N15), (4) whole processes (URL, 504), (5) a protocol catalog. The main diagnostic principle — "first ask which layer is broken" — is introduced as a separate concept N25 and becomes the mentor's first move in any networking task (section 16.3).

| Code | Slug | Concept | Requires | Tier |
|---|---|---|---|---|
| N00 | `net.internet-map` | The internet as a network of networks: laptop → home router → provider → backbone → internet exchange point (IXP) → submarine cables → data center; a zoomable map | F05, L42 | core |
| N07 | `net.layers` | The OSI model and the TCP/IP stack as nested envelopes; OSI as a vocabulary ("an L3 problem", "an L7 load balancer") | N00 | core |
| N06 | `net.frame-mac` | Ethernet frame and MAC address; switch | N07 | core |
| N01 | `net.ip` | Network interface and IP address; `ip a` | N06 | core |
| N32 | `net.arp` | ARP: how an IP turns into a MAC | N01, N06 | core |
| N02 | `net.subnet` | Subnet, mask, CIDR | N01 | core |
| N03 | `net.routing` | Gateway and route; `ip route` | N02, N32 | core |
| N12 | `net.icmp-tools` | ICMP; `ping`, `traceroute`, `mtr` | N03 | core |
| N04 | `net.port` | A port as the address of a process on a machine | N01, L17 | core |
| N05* | `net.tcp-udp` | TCP and UDP; connection setup, window, retransmission | N04 | core |
| N33 | `net.headers` | Envelopes with real fields: Ethernet (MAC, EtherType), IP (src, dst, TTL, protocol), TCP (ports, flags, seq), HTTP (method, Host) | N05, N03 | core |
| N13 | `net.socket` | Socket and listening on a port; `ss`, `curl`, `nc` | N05, L17 | core |
| N25 | `net.which-layer` | Diagnostic principle: symptom → layer → checking command | N33, N12, N13 | core |
| N34 | `net.protocol-card` | How to read a protocol card: purpose, layer, exchange, how to observe, how it breaks | N33 | core |
| N08* | `net.dns-resolution` | DNS: name → address; A, AAAA, CNAME records; recursive resolution and cache, TTL | N01, N05 | core |
| N23 | `net.dns-hierarchy` | Root servers, TLDs, authoritative servers, anycast | N08, N00 | core |
| N09 | `net.resolv-conf` | `/etc/hosts`, `/etc/resolv.conf`, `dig` | N08, L07 | core |
| N10 | `net.dhcp` | DHCP | N03, N08 | core |
| N11* | `net.nat` | Private addresses, NAT and PAT, conntrack | N02, N03 | core |
| N22 | `net.as-bgp` | Autonomous system and BGP: the idea "providers announce routes to each other" (`core`); sessions, attributes, path selection are `pro` | N03, N00 | core / pro |
| N14 | `net.http` | HTTP: method, path, status, headers | N13 | core |
| N15* | `net.tls` | TLS, certificate, chain of trust, HTTPS, SNI | N14, L30 | core |
| N19 | `net.reverse-proxy` | Reverse proxy and load balancer (nginx); upstream; 502 and 504 | N14 | core |
| N24 | `net.cdn` | CDN: a copy closer to the user, anycast, edge | N19, N23 | core |
| N16* | `net.url-path` | What happens when you type a URL (the whole process) | N08, N11, N15, N19 | core |
| N17 | `net.netfilter` | Firewall: netfilter, `iptables`, `nftables`; chains, the nat table, DNAT and SNAT | N04, N11, L12 | core |
| N18 | `net.ssh-protocol` | SSH as a protocol: handshake, host key, port forwarding | N13, N15, L43 | core |
| N20 | `net.veth-bridge` | Virtual interfaces: veth and bridge | N03, N06 | core |
| N21 | `net.netns` | A network namespace in practice: `ip netns`, veth between namespaces, a route | N20, L35 | core |
| N27 | `net.vlan` | VLAN: the 802.1Q tag, L2 separation | N06 | plus |
| N26 | `net.tunnel` | Tunnel and re-encapsulation; WireGuard (keys, `AllowedIPs`, MTU) | N33, N11, N17 | plus |
| N28 | `net.overlay` | VXLAN and Geneve: L2 over UDP, VNI. For `core` — as a single "packet inside a packet" scene before K26, details are `pro` | N20, N05 | core (idea) / pro |
| N29 | `net.modern-http` | HTTP/2, HTTP/3 (QUIC), WebSocket, gRPC | N14, N15 | plus |
| N30 | `net.mtls` | mTLS | N15 | pro |

A network namespace is one of the kinds of namespaces introduced in Linux (L35). In networks the learner does not learn a new concept but applies a familiar mechanism to the network stack: they create a namespace, connect it with veth to a bridge, and set a route. The first edition went from the specific to the general (net namespace in networks, all kinds in Docker); the requirement "everything containers rely on goes into Linux" cancels that order.

**Protocol catalog.** Each protocol is a concept `proto.<name>` with a card in a single format (purpose; layer; exchange diagram; how to observe; how it breaks). The card is tied to the main graph concept if there is one (`proto.dhcp` → N10), and becomes a concept itself if there is none (`proto.ntp`). The exchange diagram is built from the `packets` bus (08 §3.6) from the same netlab scenario as the animation, so they do not diverge. The build checks that every card has all five sections and at least one failure scenario.

| Tier | Protocols |
|---|---|
| core (all levels) | DHCP, ARP, ICMP, TCP, UDP, DNS, HTTP, HTTPS/TLS, SSH |
| plus | NTP, SMTP, FTP/SFTP, HTTP/2, HTTP/3 (QUIC), WebSocket, gRPC, VLAN, NAT/PAT |
| pro | BGP, VXLAN/Geneve, IPsec, WireGuard, mTLS, OSPF (idea) |

```yaml
id: proto.dhcp
tier: core
concept: net.dhcp
layer: L7                       # by OSI; transport: UDP 67/68
why: { ru: "Получить адрес, шлюз и DNS, ещё ничего не зная о сети", en: "Get an address, gateway and DNS before knowing anything about the network" }
sequence:                       # exchange diagram, packets bus (08)
  - { from: client, to: broadcast, msg: DHCPDISCOVER }
  - { from: server, to: client,    msg: DHCPOFFER }
  - { from: client, to: broadcast, msg: DHCPREQUEST }
  - { from: server, to: client,    msg: DHCPACK }
observe: ["tcpdump -ni eth0 port 67 or port 68", "journalctl -u systemd-networkd"]
breaks:
  - { symptom: "address 169.254.x.x", cause: "no response from the server", layer: L7, scenario: net.trbl.dhcp-1 }
docs: { kind: url, url: "https://www.rfc-editor.org/rfc/rfc2131", anchor: "section-3.1" }
```

**Containers (D)**

The block no longer introduces kernel mechanisms: it recognizes the familiar from Linux and builds on top of it the anatomy of a container (what kind of object it is and who starts it) and the model of six boundaries (how a container interacts with its environment).

| Code | Slug | Concept | Requires |
|---|---|---|---|
| D01 | `docker.env-problem` | The environment problem ("works on my machine") | F10, F11, L22 |
| D02 | `docker.vm-hypervisor` | Virtual machine and hypervisor; guest kernel | F01, L27, L44 |
| D03 | `docker.recognize-isolation` | "Recognizing the familiar": a container has the same namespaces, cgroup, capabilities, its own root, a seccomp profile | L41 |
| D06 | `docker.container` | Container = process + namespaces + cgroup + capabilities + its own root (+ the default seccomp profile) | D03 |
| D07 | `docker.container-vs-vm` | Container and VM: a shared kernel versus its own | D02, D06 |
| D30* | `docker.virt-nesting` | Hardware → VMs → containers → nesting today (containers inside cloud VMs). The second half — Kubernetes on bare metal and VMs inside Kubernetes — is introduced in K52 | D07 |
| D08 | `docker.image` | Image: layer archives and configuration | D06, L29 |
| D09 | `docker.image-layers` | An image as a stack of overlayfs layers; the container's top layer is ephemeral | D08, L39 |
| D24 | `docker.oci-bundle` | OCI bundle: `rootfs/` + `config.json`; runtime-spec; `runc spec`, `runc run` | D06, Y01 |
| D10* | `docker.runtime-chain` | docker CLI → (HTTP API over a unix socket) dockerd → containerd → containerd-shim-runc-v2 → runc or crun → process; the shim holds stdio and the exit code, runc exits after start | D24, L23, L33 |
| D25 | `docker.lifecycle` | States: created, running, paused, restarting, exited, dead; mapping to the OCI states (creating, created, running, stopped) | D10 |
| D11 | `docker.cli-basics` | `run`, `ps`, `logs`, `exec`, `stop`, `rm` | D25, L24 |
| D12 | `docker.publish-port` | Publishing a port with `-p` as a DNAT rule (and `docker-proxy`) | D11, N04, N11, N17 |
| D13 | `docker.storage` | Storage: ephemeral top layer, named volume, bind mount, tmpfs | D09, D11, L38 |
| D14 | `docker.env-vars` | Container environment variables | D11, L16, F11 |
| D15 | `docker.dockerfile` | Dockerfile: FROM, RUN, COPY, WORKDIR, CMD, ENTRYPOINT; shell and exec form | D08, D11, L20 |
| D16* | `docker.build-cache` | Building layer by layer, the cache and the order of instructions | D09, D15 |
| D17 | `docker.multistage` | Multi-stage build | D15, F08 |
| D18 | `docker.registry` | Tag, registry, `push` and `pull` | D08, F09, N14 |
| D19* | `docker.manifest-digest` | OCI manifest, per-platform index and digest; pull by manifest | D18, L30 |
| D20 | `docker.network` | Container networking: veth pair, the `docker0` bridge, MASQUERADE outward, the built-in DNS `127.0.0.11` (only in user-defined networks), the `host` and `none` modes | D12, N08, N20, N21 |
| D26 | `docker.pid1-signals` | PID 1 in a container: signals without a handler are ignored, `docker stop` = SIGTERM and after 10 s SIGKILL (`-t`), codes 137 and 143, zombies, `--init` (tini) | D15, L18, L33 |
| D27 | `docker.logs-path` | stdout/stderr → shim → log driver (`json-file` by default, `local`, `journald`), rotation with `max-size`; why a log written to a file inside the container is not visible in `docker logs` | D11, L13, L24 |
| D28 | `docker.identity` | Configuration and identity: env and secrets (file versus variable), UID inside and outside, `USER`, user namespace (`userns-remap`, rootless), bind mount permissions | D13, D14, L11, L35, L37 |
| D29 | `docker.six-boundaries` | The "six boundaries" diagnostic model: host kernel, network, storage, process and signals, I/O and logs, configuration and identity; "the container doesn't work" = at which boundary did it break? | D07, D13, D20, D26, D27, D28 |
| D21 | `docker.compose` | Docker Compose | D13, D14, D20, Y01 |
| D22 | `docker.image-security` | Image security: USER, a minimal base, `--cap-drop`, scanning | D15, D28, L37, L40 |
| D23 | `docker.healthcheck` | Healthcheck and restart policy | D11, L19 |

**CI/CD (C)**

| Code | Slug | Concept | Requires |
|---|---|---|---|
| C07 | `cicd.runner` | CI runner and executor | G04, M17, D11 |
| C08 | `cicd.pipeline-file` | Pipeline file: stage, job, script, `image` | C07, Y01 |
| C09 | `cicd.artifact-cache` | Artifact and cache | C08, F08 |
| C10 | `cicd.tests-exit` | Tests in the pipeline and failing on the exit code | C08, L19 |
| C11 | `cicd.build-image` | Building and publishing an image in CI | C08, D18 |
| C12 | `cicd.variables-secrets` | CI variables and secrets (masked, protected) | G06, C08 |
| C17 | `cicd.rules-manual` | `rules`, manual run, environments | C08 |
| C13* | `cicd.deploy-ssh` | Deploying to a server over SSH and compose; git push → deploy end to end | C11, C12, D21, N18 |
| C14 | `cicd.strategies` | Deployment strategies: rolling, blue-green, canary, rollback | C13, N19 |

**Kubernetes (K)**

The order follows 05 §3: first the observable, then the mechanism; a component is introduced when what was seen cannot be explained without it. A pod is introduced as "what we ask to run", kubelet — when we need to explain who started it. Kubernetes networking is a separate section of twelve concepts that comes as one piece right after the control plane. The "Stage" column is `stage`.

| Code | Slug | Concept | Requires | Stage |
|---|---|---|---|---|
| K00 | `k8s.orchestration` | Orchestration: why many containers on many machines | D21, F06 | 1 |
| K01 | `k8s.cluster` | Cluster and node | K00 | 1 |
| K02 | `k8s.desired-state` | Declarativeness: desired and actual state | K01, Y01 | 1 |
| K09 | `k8s.pod` | Pod | K01, K02, D06 | 1 |
| K04 | `k8s.manifest` | kube-apiserver, object and manifest: apiVersion, kind, metadata, spec | K09, Y01, N14 | 1 |
| K05 | `k8s.kubectl` | `kubectl` | K04, L16 | 1 |
| K58 | `k8s.status-events` | status and events | K04 | 1 |
| K10 | `k8s.labels` | Labels and selectors | K04 | 1 |
| K13 | `k8s.namespace` | Kubernetes Namespace (`contrast_with: linux.namespaces`) | K04 | 1 |
| K03* | `k8s.reconcile` | Controller and reconciliation loop: compares and corrects endlessly, level-triggered | K02, K58 | 1 |
| K11 | `k8s.replicaset` | ReplicaSet | K03, K10 | 1 |
| K06 | `k8s.etcd` | etcd | K04, K02 | 1 |
| K59 | `k8s.controller-manager` | kube-controller-manager | K03 | 1 |
| K12* | `k8s.deployment` | Deployment: rolling update, rollback (`contrast_with: cicd.strategies`) | K11 | 1 |
| K07* | `k8s.scheduler` | Scheduler: filters, scoring, binding | K09, K01 | 1 |
| K08 | `k8s.kubelet-cri` | kubelet and container runtime (CRI) | K01, D10 | 1 |
| K53 | `k8s.hybrid-node` | A real node in the browser: a kubelet agent on a v86 machine starts a pod via crun; where the simulator ends | K08, D10 | 1 |
| K61 | `k8s.pod-is-processes` | A pod on a node is processes in namespaces and a cgroup: `crun list`, `lsns`, `ps -ef --forest` on the node | K53, L35, L36 | 1 |
| K27 | `k8s.control-plane` | Control plane and worker nodes as a whole | K04, K06, K07, K59, K08 | 1 |
| K40* | `k8s.controller-chain` | The chain: Deployment → ReplicaSet → Pod → scheduler (`nodeName`) → kubelet → status upward; ownerReferences and garbage collection; the path of `kubectl apply` | K12, K27 | 1 |
| K60* | `k8s.node-failure` | Node failure: NotReady, taint, eviction via `tolerationSeconds` | K40 | 1 |

*Section "Kubernetes networking" (`k8s.net.*`, stage 1, core for everyone).*

| Code | Slug | Concept | Requires | Stage |
|---|---|---|---|---|
| K34 | `k8s.net.model` | The network model: every pod has its own IP, pod ↔ pod without NAT on any node, nodes see pods; the model is implemented by the CNI | K09, N03, N11 | 1 |
| K62* | `k8s.net.same-node` | Pod ↔ pod on one node: veth in the pod's namespace → a bridge or a /32 route | K34, N20, N21 | 1 |
| K26* | `k8s.net.cross-node` | Between nodes: direct routing, VXLAN/Geneve, eBPF (Cilium); CNI as a plugin | K62, N28 | 1 |
| K14 | `k8s.service` | Service and ClusterIP: a virtual address that exists on no interface (in the iptables and nftables modes) | K10, K34, N11, N17 | 1 |
| K35 | `k8s.endpointslice` | EndpointSlice: who is currently behind a Service and why a pod that is not ready does not get there (the Endpoints API is deprecated since v1.33) | K14, K03 | 1 |
| K15* | `k8s.kube-proxy` | kube-proxy: iptables or nftables rules on every node; IPVS was declared deprecated in v1.35 — in one sentence; replacing kube-proxy with eBPF in Cilium | K35, N17 | 1 |
| K16* | `k8s.dns` | CoreDNS, `svc.cluster.local`, search domains, `ndots:5` and why `curl api` makes several queries | K14, N09, N23 | 1 |
| K17 | `k8s.nodeport-lb` | NodePort, LoadBalancer | K14, N11 | 1 |
| K18 | `k8s.ingress` | Ingress and the Ingress controller — as legacy (Ingress NGINX was retired in March 2026, 05 decision 4) | K17, N15, N19 | 1 |
| K36 | `k8s.gateway-api` | Gateway API: GatewayClass, Gateway, HTTPRoute | K18 | 1 |
| K37 | `k8s.netpol` | NetworkPolicy: everything is open by default; a policy works only if the CNI supports it; default deny | K10, K26, N17 | 1 |

*The rest of the stage 1 core and stage 2.* The network debugging method K38 belongs to the "Kubernetes networking" section, but comes after general debugging K33, on which it relies; lesson K38 closes the networking section as soon as K33 is passed.

| Code | Slug | Concept | Requires | Stage |
|---|---|---|---|---|
| K19 | `k8s.config` | ConfigMap and Secret | K04, D14 | 1 |
| K20 | `k8s.storage` | volume, PersistentVolume, PVC, StorageClass | K09, K03, D13 | 1 |
| K21 | `k8s.probes` | Probes: liveness, readiness, startup | K09, K08, D23 | 1 |
| K22 | `k8s.resources` | Requests and limits, QoS classes (`contrast_with: linux.cgroups`) | K07, L36 | 1 |
| K42 | `k8s.hpa` | metrics-server and HPA | K22, K12 | 1 |
| K24 | `k8s.jobs-daemonsets` | Job, CronJob, DaemonSet | K03, K09, L28 | 1 |
| K23 | `k8s.statefulset` | StatefulSet | K12, K20 | 1 |
| K44 | `k8s.headless` | Headless Service | K14, K23 | 1 |
| K33 | `k8s.debug` | Debugging: `describe`, `logs`, events, typical statuses (Pending, CrashLoopBackOff, ImagePullBackOff) | K12, K21, K58 | 1 |
| K38 | `k8s.net.debug` | "The pod could not reach the service": DNS → Service → EndpointSlice → pod (ready? listening?) → NetworkPolicy | K16, K35, K37, K33 | 1 |
| K63 | `k8s.serviceaccount` | ServiceAccount | K09, K04 | 1 |
| K25 | `k8s.rbac` | RBAC: Role, RoleBinding, ClusterRole | K63, K13, L10 | 1 |
| K39 | `k8s.kubeconfig` | kubeconfig and context | K25, K05 | 1 |
| K43 | `k8s.taints-affinity` | Taints, tolerations, affinity | K07 | 1 |
| K45 | `k8s.drain-pdb` | cordon, drain, PodDisruptionBudget | K43, K12 | 1 |
| K28 | `k8s.helm` | Helm: chart, template, values, release | K12, K19 | 1 |
| K46 | `k8s.kustomize` | Kustomize | K04 | 1 |
| K29 | `k8s.gitops` | GitOps (Argo CD, Flux) | K03, K28, G05 | 1 |
| K30 | `k8s.crd` | CRD and custom resource | K04, K03 | 1 |
| K41 | `k8s.operator` | Operator = a controller for your own type; your own controller in the browser (bash for `core`, TypeScript — `plus`) | K30, K40, L21 | 1 |
| K52* | `k8s.vms-in-k8s` | Back to the towers: Kubernetes on bare metal and VMs inside Kubernetes (KubeVirt, Cozystack) — a pod with a QEMU process and a guest kernel | K09, D30 | 1 |
| K48 | `k8s.single-node` | A real single-node cluster: k3s, kind or minikube; how they differ | K27, K33, L44 | 2 |
| K49 | `k8s.real-registry` | A real registry, `imagePullSecrets` | K48, D18 | 2 |
| C16 | `cicd.deploy-k8s` | Deploying to Kubernetes from CI (`kubectl apply`, `helm upgrade`; 06, module A7) | C13, K28, K48 | 2 |

**IaC (I; Ansible first)**

| Code | Slug | Concept | Requires |
|---|---|---|---|
| I01 | `iac.as-code` | Infrastructure as code in a repository | K02, G02 |
| I02 | `iac.idempotency` | Idempotency | I01, L21 |
| I09 | `iac.ansible-inventory` | Ansible: control machine, inventory, connecting over SSH, ad-hoc | I01, N18 |
| I10* | `iac.ansible-playbook` | Playbook, play, task, module; facts; ok/changed/failed | I02, I09, Y01 |
| I11 | `iac.ansible-templates` | Variables, Jinja2 templates, handlers, `when`, `loop` | I10, L23 |
| I12 | `iac.ansible-roles` | Roles, variable precedence | I11 |
| I16 | `iac.ansible-check` | check mode and diff | I10 |
| I03 | `iac.cloud-resource` | Cloud provider: resource, API, credentials | L44, N14 |
| I04 | `iac.terraform` | Terraform: provider, resource, HCL, references, graph | I01, I03 |
| I05* | `iac.tf-workflow` | `init`, `plan`, `apply`, `destroy`; known after apply; in-place and replacement | I04 |
| I06 | `iac.tf-state` | State, remote storage, locking | I05 |
| I07 | `iac.tf-modules` | Variables, outputs, locals, data, `count`/`for_each`, modules | I04 |
| I08 | `iac.drift` | Drift | I06, K02 |
| I13 | `iac.provision-vs-config` | Creating infrastructure and configuring it: who does what | I05, I10 |
| I14 | `iac.secrets` | Secrets in IaC: ansible-vault, CI environment variables | I07, I11, C12 |
| I15 | `iac.cluster-vms` | VMs for a cluster: Terraform orders 3+ machines with the `dt-lab` tag, Ansible prepares the nodes (containerd, swap, kernel modules, sysctl, kubeadm) | I05, I07, I12, K27 |

**Kubernetes, stage 3 (after IaC)**

| Code | Slug | Concept | Requires | Stage |
|---|---|---|---|---|
| K32 | `k8s.kubeadm` | kubeadm: `init`, `join`, static pods in `/etc/kubernetes/manifests`, PKI in `/etc/kubernetes/pki` | K27, K26, I15, L23 | 3 |
| K50 | `k8s.cni-install` | Installing a CNI (Cilium) after `kubeadm init`; nodes are NotReady until the CNI | K32, K26 | 3 |
| K65 | `k8s.storage-install` | Installing a volume provisioner (CSI or local-path-provisioner) and a default StorageClass | K32, K20 | 3 |
| K51 | `k8s.certs` | Cluster certificates: `kubeadm certs check-expiration`, renewal | K32, N15 | 3 |
| K54 | `k8s.upgrade` | Version upgrade: `kubeadm upgrade plan/apply`, one minor version at a time, control plane first, then nodes via `drain` | K32, K45 | 3 |
| K55 | `k8s.etcd-backup` | etcd backup: `etcdctl snapshot save`, restore with `etcdutl snapshot restore` (restoring via `etcdctl` is deprecated since etcd 3.5) | K06, K32 | 3 |
| K56 | `k8s.node-break-fix` | Breaking and fixing a node: kubelet stopped, certificate expired, CNI did not come up | K32, K50 | 3 |

**Monitoring (O)**

| Code | Slug | Concept | Requires |
|---|---|---|---|
| O01 | `obs.observability` | Observability: metrics, logs, traces | M12, L24 |
| O02 | `obs.time-series` | Time series: a metric with labels, cardinality | O01, K10 |
| O03 | `obs.metric-types` | Types: counter, gauge, histogram, summary | O02 |
| O04* | `obs.prometheus-scrape` | Prometheus: pull, scrape, `/metrics`, targets, `up` | O02, N14 |
| O05 | `obs.exporters` | Exporters (node_exporter) | O04, L23 |
| O06 | `obs.promql` | PromQL: selectors, `rate`, aggregation, `histogram_quantile` | O03, O04 |
| O07 | `obs.grafana` | Grafana: data source, panel, dashboard, variables | O06 |
| O08* | `obs.alerting` | Alert rule, pending and firing, Alertmanager: routing, grouping, inhibition | O06 |
| O09 | `obs.slo-promql` | SLI as a PromQL query, burn rate | O08, M19 |
| O10 | `obs.use-red` | The USE and RED methods, golden signals | O06, O09 |
| O11 | `obs.logs` | Centralized and structured logs (Loki) | O01, D27 |
| O12 | `obs.tracing` | Tracing and spans; OpenTelemetry | O01, N14 |
| O13 | `obs.k8s` | Monitoring in Kubernetes: kube-state-metrics, ServiceMonitor | O05, K14, K30 |
| O14 | `obs.zabbix` | Zabbix and the agent model (`plus`) | O04 |

**Pet project (P) and career (J)**

The career block codes changed from `R01…` to `J01…` to avoid confusion with owner requirements and load rules.

| Code | Slug | Concept | Requires |
|---|---|---|---|
| P01 | `pet.architecture` | The project's architecture diagram | C13, D21, N19 |
| P02 | `pet.vps-hardening` | VPS: basic hardening (user, keys, firewall, updates) | L44, N17 |
| P03 | `pet.readme-defense` | README and defending the project at an interview | P01 |
| J01 | `career.read-vacancy` | How to read a job posting (the 60% rule) | M03 |
| J02 | `career.resume` | A résumé for a DevOps profile | J01, P03 |
| J03 | `career.self-presentation` | Self-introduction | J02 |
| J04 | `career.answer-structure` | Structure of a technical answer: what → why → how → when | M03 |
| J05 | `career.situational` | A situational question and debugging out loud | J04, N16, K33 |
| J06 | `career.dont-know` | How to say "I don't know" | J04 |
| J07 | `career.mock-interview` | Mock interview | J03, J05, J06 |
| J08 | `career.cover-letter` | Cover letter | J02 |
| J09 | `career.internships` | Internships and applications | J08 |
| J10 | `career.portfolio` | GitHub and LinkedIn as a portfolio | G04, P03 |

J02 depends on P03, but the résumé module opens before the pet project: before P03 the learner writes a draft version with training projects from the exams, and afterwards rewrites it. This is the only place where a module is taken twice, and the graph reflects the final version.

---

## 7. Textbook chapter and lesson anatomy

### 7.1. The chapter is the single source of theory

Every module has a **chapter**: a coherent text of 1,500–4,000 words, written like an article in a good magazine, with a strict order of concepts and sources for every claim. The presentation of the text comes from the Sankofa engine: magazine layout, scroll scenes, layers, calm mode, lenses, QR codes, bilingual YAML, `draft`/`hold`. Process explanations (section 9) are embedded in the chapter as figures that can be manipulated right in the text.

Theory is written once, in the chapter (`chapter.yaml`, paragraphs with `claims` and sources). Lesson screens contain no theory text of their own: they refer to chapter paragraphs (`text: chapter#p4`). The "Textbook" mode shows the whole chapter; the "Lesson" mode shows the same paragraphs in portions according to rule CL4, interleaved with interactive elements. This way the "120 words per screen" limit and a coherent textbook are one and the same text, not two.

The chapter is shown through a **level lens**: one chapter, and the "Beginner", "Intermediate", "Experienced" lenses change the depth of the expanded paragraphs (`plus` and `pro` paragraphs are collapsed or expanded) and the examples drawn from the learner's previous profession. The learner can switch the lens without changing their level in the model. The chapter is available in full at any level; an "Experienced" learner can open it before the challenge task, and this does not break the "problem first" order: the task still comes first on the lesson screen, but the book is not hidden.

### 7.2. Lesson steps

A lesson is 15–40 minutes, one core concept and no more than three auxiliary ones. There are seven steps; their order and length change at different levels.

| Step | What happens | Beginner | Intermediate | Experienced |
|---|---|---|---|---|
| 1. Hook | A real artifact from a junior engineer's work: a message from a team lead, a ticket, an alert, a piece of output, an interview question. One line "why you need this". No illustrations (CL9) | 1 screen | 1 screen | 1 screen |
| 2. Watch the process | A step-by-step process explanation (section 9) or a worked example if the concept has no mechanism over time. Documentation glimpses next to each element (DL1) | Step-by-step explanation, a prediction question on every second step, 2–5 screens | The same, parameters open right away, 1–3 | Mandatory after the challenge task, starting with the "break it" mode |
| 3. Try | Sandbox: "predict what it will print", then run and compare | 1–2 | 1–2 | The challenge task comes first |
| 4. Explanation | Chapter paragraphs with EN and RU sources: a model, not a list of facts | 1–3 screens, a "read the whole chapter" link | 1–2 | 1–2, depending on the results of the attempt |
| 5. Practice | 3–6 tasks along the support ladder (section 10) and at the current step of the documentation ladder (section 11) | S0→S3 | S1→S4 | S3→S5 |
| 6. Check | Exit ticket: 2–3 tasks, one on transfer (new data) | yes | yes | yes |
| 7. Review | The lesson's concepts go into the FSRS queue; the first review after 1–2 days | yes | yes | yes |

For the "Experienced" learner, the process explanation is mandatory even if the challenge task was solved: "you solved it; here is what was happening inside". The `introduced` mark is set only after all steps of the explanation have been viewed. They may skip the chapter, but then `mastered` requires an "explain it" answer about the model (section 2.2).

### 7.3. A complete lesson example: L17 "Process"

"Beginner" level, 30 minutes. Prerequisites: F02 (program, everyday sense), L00 (the kernel in plain terms), L02 (command). Documentation step — DL1.

1. **Hook.** A chat message: "The server is crawling, take a look at what's eating the CPU." A line below it: "In half an hour you'll be able to answer this message."
2. **Watch the process, screen 1** (introduces L17, `kind: process`, two steps). On the left, on disk, the program file `/usr/bin/sleep` — a gray rectangle with the label "lies on disk" on its line. Step 1 → 2: along the arrow "the kernel starts" a process rectangle with the number 4117 comes out of the file into the memory area on the right; the label on the arrow reads "start = the kernel creates a process". Clicking the process rectangle opens the card "PID 4117, owner learner, state S (sleeping), started from /usr/bin/sleep". A slider "how many times to start" 1–5: the same number of rectangles with different PIDs appears on the right, while there is still one file on the left; next to the counter — "one program, five processes: each has its own number and its own memory". A prediction question before the first movement of the slider: "If you start the program three times, how many files will there be on disk?" A toggle "Break it: kill a process": one rectangle goes dark, the file on the left does not change, the label "the program is unharmed — the process has ended". The step timeline rewinds back and forward.
3. **Watch, screen 2.** A worked example: the `ps` command in the sandbox terminal with trimmed output (four lines, the PID and CMD columns), arrows from the columns to the rectangles of the previous diagram. Each column has a DL1 label "this comes from here" → `ps(1)`, section STANDARD FORMAT SPECIFIERS. A self-explanation question: "Why do two lines have the same CMD but different PIDs?" — the answer is free-form; after answering, the reference answer is shown.
4. **Try.** "Now you'll type `top`. Which process do you think will be at the top?" Three options (the oldest, the most loaded, alphabetical). Then the learner runs `top`; the sandbox highlights the line with the load process and the %CPU column, the other columns are dimmed, and a "show everything" button removes the dimming. Exiting with `q` is hinted right on the terminal screen.
5. **Explanation.** Paragraphs of the "Processes" chapter (about 120 words per screen): what a process is, that the kernel creates it at the request of another program, why every process has a number and a parent. The details of `fork` and `exec` are in the isolation module (L33); here the word "kernel" is used in the everyday sense of L00. Sources: EN — `ps(1)` on man7.org; RU — W. Shotts, "The Linux Command Line" (Russian edition, «Командная строка Linux. Полное руководство»), chapter "Processes". The `ps` page on opennet.ru is not suitable as an RU source: it is in English.
6. **Practice.** S0: a worked example "find a process by name" using `ps -C nginx` — it selects processes by name without a pipeline, which is shorter (the learner already knows pipelines from L15, and `ps aux | grep nginx` is walked through as a second path with a trap: the line of `grep` itself); S1: the same task with an option left out; S2: find the PID of the `backup` process; S3: which process takes the most memory — without hints, with hints on request.
7. **Check.** (a) In a new sandbox, find the process with the highest load and enter its PID. (b) Matching: program / process / PID. (c) Transfer: "You started the same program in two terminal windows. How many processes and how many PIDs?"
8. **Review.** L17 goes into the queue; signals and `kill` (L18) are the next lesson, and its hook continues the same story: "you found it — now stop it".

Lesson format in content:

```yaml
id: linux.process
block: linux
core: linux.process
levels: [beginner, intermediate, experienced]
chapter: linux/chapters/processes.yaml
hook:
  ru: "Сервер тормозит, глянь, что там жрёт процессор."
  en: "The server is crawling — check what's eating the CPU."
screens:
  - id: s1
    kind: process              # process | example | predict | sandbox | theory | task | exit | cost | cleanup
    explainer: p.lin.process-birth
    introduces: [linux.process]
    uses: [orient.program, linux.kernel-idea]
    levels: [beginner, intermediate]
  - id: s2
    kind: example
    uses: [linux.process, linux.command]
    docs: [{ kind: man, page: ps, section: 1, anchor: "STANDARD FORMAT SPECIFIERS", step: DL1 }]
  - id: s4
    kind: theory
    text: chapter#p3-p5        # chapter paragraphs, not its own text
    uses: [linux.process, linux.command]
practice: [linux.process.drill.1, linux.process.drill.2, linux.process.drill.3, linux.process.drill.4]
exit: [linux.process.exit.a, linux.process.exit.b, linux.process.exit.c]
```

A chapter paragraph with claims and sources:

```yaml
- id: p3
  introduces: []
  uses: [linux.process, linux.kernel-idea]
  tier: core
  claims:                      # every theory claim comes with references, per the Sankofa rule
    - text: { ru: "У каждого процесса есть уникальный номер — PID.", en: "Every process has a unique ID — the PID." }
      sources:
        - { lang: en, url: "https://man7.org/linux/man-pages/man1/ps.1.html" }
        - { lang: ru, title: "Шоттс У. Командная строка Linux. Полное руководство. Глава «Процессы»" }
      hold: false
  draft: true
```

From the Sankofa engine, the bilingual `Bi` type, the `draft` and `hold` marks and the two-source rule carry over here. A theory claim without a second source gets `hold: true` and does not go into the build. For a textbook this rule is even more important than for a museum: an error in an explanation turns into an error at an interview.

### 7.4. Lessons with paid resources: "Cost" and "Cleanup"

A lesson that creates paid resources (`env: vm`: module L44, the networks exam on two VMs, stage 2 on a VPS, IaC, Kubernetes stage 3) starts with a `kind: cost` screen and ends with a `kind: cleanup` step.

- **Cost.** The price per hour and per day at the chosen provider, taken from a price table with a verification date (the table belongs to 05 §10.2 and 09 §5.2, not from the author's head), and the total "if you forget to delete it — this much per month". From the moment resources are created, the interface shows a counter "machines have been running for N hours ≈ X ₽ / $".
- **Cleanup.** The last step, which cannot be skipped: without it, the lesson, stage or exam is not credited. The check is done not from inside the deleted cluster (it will not print anything anymore) but from the learner's machine: `trainer-check cleanup` reads `terraform state list` (it must be empty) and compares it with the output `Destroy complete! Resources: N destroyed.`, where N equals the number of resources from `apply`; if the learner provided a read-only token, the script additionally looks at the list of VMs at the provider by the labels `trainer=devops` and `dt-track=<track>` (the single labeling rule is 00 §6.7). On local VMs there is nothing to pay for: the cost screen shows zero, and the cleanup step reminds the learner to delete the machines to give the computer its memory and disk back. Until cleanup in the cloud is confirmed, a reminder with the accumulated amount arrives once a day.

---

## 8. Cognitive load and visual language rules

The rules are formulated so that they can be checked. Those marked "build" are checked by the content linter; the rest by storyboard review. The names `CL1…CL21` do not overlap with the owner requirements `R1…R12`.

| No. | Rule | Basis | Check |
|---|---|---|---|
| CL1 | No more than one new concept is introduced on a screen and in a chapter paragraph (`introduces` ≤ 1); no more than three terms of that concept | Sweller: working memory limit | build |
| CL2 | No more than four new concepts in a lesson; no more than eight in the recommended daily portion | Sweller | build |
| CL3 | A term does not appear before it is introduced (section 6) | Pre-training (Mayer) | build |
| CL4 | Interactive screen: up to 120 words for "Beginner", up to 180 for the others. The chapter is not limited by this rule (section 7.1) | Segmenting | build |
| CL5 | Sandbox output is trimmed to the relevant lines; the full output is available via a button | Signaling, coherence | review, the `trim` flag on the task |
| CL6 | A label sits next to the element it refers to (an output line, a diagram node), not in a paragraph below the picture | Spatial contiguity | review |
| CL7 | A diagram and its text are on the same screen; no "see the figure above" | Contiguity | build searches for reference phrases |
| CL8 | Animation shows only the process: a packet travels along a line, a layer appears, a counter grows. The step timeline rewinds forward and backward and stops at any point; there is no continuous animation without controls. With `prefers-reduced-motion`, transitions are instant and motion is replaced by a change of state | Segmenting; calm mode from Sankofa | build: every explanation has `steps[]` and a static frame for every step; `autoplay` is forbidden |
| CL9 | There are no decorative images anywhere, including hooks and block opening screens: no characters, no narrative illustrations, no ink drawings, no parallax, no cartoons. A hook is typography and a real work artifact; a block opening screen is typography and one diagram of the block | Coherence | review |
| CL10 | There is no narration in the first version. The modality principle is replaced by temporal contiguity: the label on a line appears in the same step as the event | Redundancy, temporal contiguity | review |
| CL11 | Names of the parts before the mechanism: before "the path of `kubectl apply`" the learner gets acquainted with each component. A process explanation introduces no more than one concept — "the process as a whole" (`net.url-path`, `k8s.controller-chain`); its parts are introduced earlier | Pre-training | graph |
| CL12 | There is one *action input* on a screen: a terminal, or drag-and-drop, or choosing an answer. Controlling an explanation (timeline, sliders, "break it" toggles, click cards) is not counted as an interaction mode and is allowed together with any of them | Extraneous load | build by `kind` |
| CL13 | In the Russian version, the English term is given once in parentheses at introduction, and from then on the same Russian word from the glossary is used (под, узел, образ, том) | Consistency | build by glossary |
| CL14 | An error message is shown in full, the key line is highlighted, and next to it is "how to read this error" | Signaling; fear of errors | review |
| CL15 | A long process is split into scroll scenes: one scene is one transition between components, scrolling can be stopped at any step | Segmenting; scroll scenes from Sankofa | review |
| CL16 | Color carries meaning and is the same throughout the course: kernel space and user space, network layers (L2, L3, L4, L7), Kubernetes components (control plane, node, pod), desired and actual state take colors from the semantic palette of 08 §5.2. Color is never the only carrier of meaning (each has a duplicate shape). A color outside the palette is a build error | Signaling; consistency | build |
| CL17 | Every process concept (`process: true`) has at least one `kind: process` explanation | The "process explanations" priority (section 1.1) | build |
| CL18 | Every element of a diagram is clickable and explains itself (`node.explain`); labels sit on lines (`edge.label`), not in a legend; one scene — one idea | Spatial contiguity | build: every `node` and `edge` has text in two languages |
| CL19 | Changing a parameter (`params[]`) immediately recomputes the process, and next to the changed place appears one sentence "what changed and why"; before the first change — a prediction question | Generative processing, prediction | build: every `param` has `on_change.explain`, at least one has `predict` |
| CL20 | "Break it" (`breaks[]`) removes or damages one component; after the breakage the learner first answers what will break, then sees it | Deliberate practice | build: ≥ 1 `break` in the explanation |
| CL21 | The terminal, text and diagrams are set in Sankofa's magazine typography: one text typeface and one monospace, a calm palette, an even rhythm; the terminal highlights the prompt, input and output with different font styles rather than rainbow colors | Coherence; aesthetics as a reduction of extraneous load | review against the 08 checklist |

---

## 9. Process explanations

### 9.1. Pedagogical contract

A process explanation (`kind: process`) is a mandatory screen of the "Watch the process" step for every concept that has a mechanism over time (marked with an asterisk in the graph). It is not a video and not a cartoon, but a drawing that the learner drives themselves. The contract is the same for all blocks and is checked by rules CL8, CL9, CL11, CL16–CL20:

1. **Diagram.** Blocks, arrows, labels on lines; one scene — one idea. Colors come from the semantic palette (kernel and user, network layers, Kubernetes components).
2. **Motion only where something moves:** a packet travels along a line, a layer appears, a counter grows, a rectangle goes dark. No characters, no plot and no decoration.
3. **Step timeline.** Forward, back, pause, jump to any step. Every step has a static frame.
4. **Everything is clickable.** Clicking a block, an arrow, a header field, a YAML line opens a card: what it is, where it comes from (a DL1 documentation label), what happens if it is removed.
5. **Parameters.** Sliders and switches (replicas, memory limit, TTL, TCP window, `maxSurge`). A change immediately recomputes the process, and next to the changed place appears one sentence "what changed and why".
6. **Prediction.** Before the first parameter change and before every "break it" — the question "what will happen?". The answer is recorded, then the learner sees the result and the comparison.
7. **"Break it".** A toggle removes or damages one component. The process continues and stops where it broke, with a label at the point of the break.
8. **Concept order.** An explanation introduces no more than one concept — the process as a whole; all its parts are introduced earlier (CL11). At the "Beginner" level, the first 1–2 scenes may be pre-training cards for the parts, each introducing one concept.
9. **Link to practice.** Every explanation has at least one "the same thing by hand" task in the sandbox and at least one break-fix trainer that refers to it in the walkthrough.

How this looks by level: the "Beginner" goes step by step with a prediction question on every second step; the "Intermediate" sees the parameters right away; the "Experienced" opens the explanation after the challenge task and starts with the "break it" mode.

Format in content (the full widget schema is in 08):

```yaml
id: p.lin.isolation
kind: process
block: linux
introduces: [linux.isolation-sum]
uses: [linux.namespaces, linux.cgroups, linux.capabilities, linux.mount-chroot, linux.seccomp]
steps:
  - id: s1
    caption: { ru: "Обычный процесс видит всё", en: "A plain process sees everything" }
    nodes: [proc, host-pids, host-fs, host-net]
    edges: [{ from: proc, to: host-pids, label: { ru: "видит", en: "sees" } }]
params:
  - id: memory_max
    kind: slider
    range: [8, 512]
    unit: MiB
    predict: { ru: "Что будет, если лимит станет меньше, чем нужно процессу?", en: "..." }
    on_change:
      explain: { ru: "Лимит ниже рабочего набора: ядро убьёт процесс внутри этой группы, остальные не заметят", en: "..." }
breaks:
  - id: drop-mnt-ns
    label: { ru: "Убрать mount namespace", en: "Drop the mount namespace" }
    predict: { ru: "Что теперь покажет ls / внутри?", en: "..." }
    effect: { ru: "Процесс видит корень хоста: /etc/shadow хоста рядом", en: "..." }
docs: [{ kind: man, page: namespaces, section: 7, step: DL1 }]
practice: [linux.ns.drill.1, linux.cgroups.drill.oom]
```

### 9.2. Mandatory catalog by block

The catalog is the minimum that the build checks: every `id` must exist, and its `uses` must be introduced earlier than the place where it stands. Block documents may add explanations but may not remove these. Detailed storyboards for each belong to the block roles and to 08; below, for each one, are the steps, parameters, "break it" and the prediction question, and in 9.3 — full storyboards of the four explanations on which R6, R7, R9 and R10 rest.

| id | Block | Process | After | Steps | Parameters | "Break it" | Prediction |
|---|---|---|---|---|---|---|---|
| `p.meth.idea-to-prod` | Methodology | A task from idea to production | M17 | card → development → review → CI → staging → production → metrics | batch size, WIP, share of manual steps | remove automated tests (manual testing) | "What happens to lead time if the batch size is doubled?" |
| `p.meth.incident` | Methodology | Incident: alert → postmortem | M12 | alert → on-call → status → mitigation → fix → postmortem | reaction time, whether a runbook exists | no alert (we learn from a customer) | "Where are the most minutes lost?" |
| `p.meth.bottleneck` | Methodology | Flow and bottleneck | M09 | the queue grows before the slow column, the next one is idle | column speed, WIP | remove the WIP limit | "Will a second developer speed up the flow?" |
| `p.lin.process-birth` | Linux | A program on disk → a process in memory | L17 | file → "the kernel starts" → a process with a PID | number of starts | kill the process (the file is intact) | "How many files are on disk after three starts?" |
| `p.lin.boot` | Linux | Booting a machine | L45 | firmware → bootloader → kernel → initramfs → systemd (PID 1) → units → getty and sshd | target, a failing unit | a broken entry in `/etc/fstab` | "Will the machine boot if nginx failed?" |
| `p.lin.fork-exec` | Linux | Enter after `ls`: fork, exec, PATH | L33 | parsing the line → builtin or external → PATH lookup → fork → exec → system calls → stdout → wait → `$?` | order of directories in PATH, alias | remove a directory from PATH → `command not found` | "What will `type ls` print?" |
| `p.lin.pipe` | Linux | A pipeline as two processes and a kernel buffer | L33 | two processes, a buffer, blocking on a full and an empty buffer, SIGPIPE | writer and reader speed, buffer size | the reader exited | "What happens with `yes \| head -1`?" |
| `p.lin.systemd-restart` | Linux | systemd restarts a crashed service | L23 | the process crashes → systemd receives SIGCHLD → `Restart=on-failure` → `RestartSec` → `StartLimitBurst` | `Restart=`, `RestartSec`, limit | crash every second → `start-limit-hit` | "After how many attempts will the unit become failed?" |
| `p.lin.isolation` | Linux | How the kernel isolates and limits | L41 | storyboard 9.3.1 | seven namespaces, `memory.max`, `pids.max`, `cpu.max`, capabilities | remove the mount namespace; a limit below the working set | "What will `ps` show inside a new pid frame?" |
| `p.net.internet-map` | Networks | A zoomable map of the internet | N00 | laptop → router → provider → backbone → IXP → cable → data center; the path of one request | scale, choice of destination | a cable cut (the route is rebuilt) | "Through how many networks will a request to a neighboring city pass?" |
| `p.net.envelopes` | Networks | Nested envelopes with fields | N33 | HTTP → TCP → IP → Ethernet; at each step a header with real fields is added | data size, MTU | MTU smaller than the packet | "Which fields will change at the next router?" |
| `p.net.dns` | Networks | Recursive DNS resolution | N23 | stub → recursive → root → TLD → authoritative → cache | TTL, "time elapsed" | NXDOMAIN; an unreachable root (the cache saves the day) | "Will the query go to the root a second time?" |
| `p.net.tcp-tls` | Networks | TCP and TLS handshake | N15 | SYN, SYN-ACK, ACK, ClientHello … Finished | RTT, TCP window, TLS 1.2 or 1.3, loss | SYN-ACK lost → retransmission; an expired certificate; a wrong SNI | "How many RTTs until the first byte with TLS 1.3?" |
| `p.net.nat-router` | Networks | A packet through NAT and a router | N11 | the MAC changes at every hop, the IP only at NAT; conntrack remembers | number of clients, conntrack timeout | delete the return route; flush conntrack | "Which src IP will the server see?" |
| `p.net.url` | Networks | Typing a URL, end to end | N16 | DNS → TCP → TLS → HTTP → proxy → backend → response | DNS cache TTL, RTT, keep-alive, HTTP/1.1 or 2 | delete the DNS record; take down the backend | "What will change on the second visit?" |
| `p.net.504` | Networks | Where a 504 comes from | N19 | client → proxy → upstream; the proxy's timer | `proxy_read_timeout`, backend response time | the backend is not running; DROP to the upstream | "502 or 504 if the backend is not running?" |
| `p.ctr.towers` | Containers | Hardware → VMs → containers → nesting | D30 | storyboard 9.3.2 | number of applications | a kernel vulnerability | "Where is the isolation boundary of each tower?" |
| `p.ctr.run` | Containers | `docker run`: from the CLI to the process | D25 | CLI → dockerd API → containerd → shim → runc → `clone` with namespaces → exec → runc exits → the shim holds stdio | `--memory`, `--pid=host`, `-d` or `-it`, `--rm` | kill the shim; restart dockerd (with `live-restore` the container stays alive) | "Will the container die if dockerd is restarted?" |
| `p.ctr.build` | Containers | `docker build` layer by layer with the cache | D16 | instruction → layer → cache key → CACHED or rebuild | order of COPY and RUN, a changed file | `COPY . .` before installing dependencies | "Which steps will be rebuilt after a code change?" |
| `p.ctr.pull` | Containers | Pull by manifest | D19 | tag → token → index → platform manifest → config → layers by digest → unpacking | platform, layers already downloaded | a substituted layer (the digest does not match) | "How many bytes will be downloaded if the base is already present?" |
| `p.k8s.reconcile` | Kubernetes | The reconciliation loop and the controller chain | K03, K40 | storyboard 9.3.3 | replicas, image, `tolerationSeconds` | stop the controller; shut down a node | "How many pods will there be after one iteration?" |
| `p.k8s.apply` | Kubernetes | `kubectl apply` through all components | K40 | kubectl → API (authn, authz, admission) → etcd → Deployment controller → RS controller → scheduler → kubelet → CRI → status back | replicas, image | turn off the scheduler (pods Pending) | "What will `kubectl get pods` show without a scheduler?" |
| `p.k8s.schedule` | Kubernetes | Scheduling a pod | K07 | filters (resources, taints, affinity) → scoring → binding | pod requests, free node capacity, taint | requests above capacity | "Which node will the pod land on?" |
| `p.k8s.rolling` | Kubernetes | Rolling update | K12 | new pods by `maxSurge`, old ones leave by `maxUnavailable`, readiness holds the traffic | maxSurge, maxUnavailable, startup time | readiness never passes → the rollout is stuck | "How many ready replicas at the worst moment?" |
| `p.k8s.node-fail` | Kubernetes | Node failure | K60 | kubelet is silent → grace period → NotReady → taint → eviction via `tolerationSeconds` (300 s by default) → new pods | grace period, tolerationSeconds | — (the process itself is the breakage) | "After how many minutes will the pods move?" |
| `p.k8s.pod-network` | Kubernetes | A packet pod → pod on a node and between nodes | K26 | veth → bridge → route → (VXLAN: packet in a packet) → node 2 → veth → pod | CNI mode: routing, VXLAN, eBPF | delete the route to the node's subnet | "Which source IP will a pod on another node see?" |
| `p.k8s.service-path` | Kubernetes | A request through Gateway/Ingress, Service and kube-proxy | K15, K36 | storyboard 9.3.4 | kube-proxy mode (iptables, nftables, eBPF), number of endpoints | a pod without the required label | "How many endpoints if one pod has a typo in its label?" |
| `p.k8s.dns-ndots` | Kubernetes | A service name in a pod: search domains and ndots | K16 | `curl api` → trying `api.<ns>.svc.cluster.local`, `api.svc…`, `api.cluster.local` → answer | `ndots`, a fully qualified name with a trailing dot | CoreDNS is down | "How many DNS queries will go out for `api.example.com`?" |
| `p.ci.push-deploy` | CI/CD | git push → deploy | C13 | push → webhook → runner → stages → image → registry → deployment → health check | `rules`, `when: manual`, cache | a red test | "Will a commit in a feature branch reach production?" |
| `p.iac.ansible` | IaC | An idempotent Ansible run | I10 | facts → the task compares desired with actual → ok or changed → handler | a template change, a second run | `shell: echo >>` instead of a module | "How many changed in the second run?" |
| `p.iac.tf` | IaC | `terraform plan/apply` and state | I05 | configuration + state + refresh → diff → plan → apply → new state | an attribute change (in-place or replace) | editing a resource by hand (drift) | "What will plan show after a manual edit?" |
| `p.obs.pipeline` | Monitoring | scrape → storage → PromQL → alert → notification | O08 | target → `/metrics` → TSDB → `rate` → rule → pending → firing → Alertmanager → grouping → receiver | `scrape_interval`, the `rate` window, `for:`, threshold | the target is down (`up == 0`) | "Will an alert with `for: 10m` fire on a 3-minute spike?" |

### 9.3. Storyboards of the key explanations

Each storyboard below is screen by screen: what is on the screen, what moves, what is clickable, which parameters and "break it", what changes and which sentence appears next to it.

#### 9.3.1. `p.lin.isolation` — "How the kernel isolates and limits" (Linux, after L41)

Color code: kernel space uses the "kernel" color, processes use the "user" color; namespace frames have an outline in the same color as their kind (pid, mnt, net…), the same throughout the course.

1. **A plain process.** At the bottom, a "kernel" band; above it, the process `bash` (PID 2301) and next to it three shared host resources: "process list", "file tree", "network". The arrows from the process to each are labeled "sees everything". Clicking an arrow: a card "through which system call the process sees this" (`getdents` on `/proc`, `open`, `socket`) with a DL1 label on `syscalls(2)`. Nothing moves.
2. **Its own pid frame.** The `pid` switch turns on a frame around the process; inside, the number changes to 1, outside it remains 2301 — both numbers are visible at the same time, with the label on the line "one process, two numbers". A prediction before the switch: "What will `ps` show inside the new pid frame?" At the bottom, a terminal band with the command that does the same: `unshare --pid --fork --mount-proc bash`. Clicking `--fork` explains why without it `echo $$` does not give 1.
3. **Its own mnt frame and its own root.** The `mnt` and "own root" switches: the "file tree" arrow is redirected from the host root to the directory `./rootfs`. On the left, a miniature of the host tree; on the right, the tree the process sees. The toggle "Break it: remove the mount namespace" returns the arrow to the host root, the host's `/etc/shadow` appears next to it with the label "the process sees the host's files — there is no file isolation".
4. **Its own network.** The `net` switch: only `lo` remains for the process, the arrow to the host network is cut; the label "an empty network stack — connectivity will appear when we run a veth (the "Networks" block)". The other kinds (`uts`, `ipc`, `user`, `cgroup`, `time`) are switches in one row, each with one line of effect; `user` shows the pair "UID 0 inside = UID 100000 outside".
5. **How much is allowed: cgroup.** Next to the process, a memory "thermometer" appears with a `memory.max` mark. The process grows (the bar fills by 1 MB per step). A `memory.max` slider 8–512 MiB, `pids.max` 1–100 and `cpu.max` 10–100% sliders. Prediction: "What will happen when the bar reaches the mark?" Moving the slider below the current fill level is "Break it": the process goes dark, the `oom_kill` counter in `memory.events` becomes 1, the label "the kernel killed the process inside the group; neighboring groups did not notice". `pids.max=5` and a fork bomb: the sixth rectangle does not appear, the label "fork returned an error". `cpu.max`: the counter "CPU time per 100 ms" stops growing above the quota.
6. **What is allowed: capabilities and seccomp.** Above the process — a row of several privilege icons (`CAP_NET_BIND_SERVICE`, `CAP_SYS_ADMIN`, `CAP_NET_RAW`, etc.). The "root inside" switch lights them all up, then the learner turns them off one by one; when trying to listen on port 80 without `CAP_NET_BIND_SERVICE`, the arrow to the port is cut with the label `bind: Permission denied`. The last row is the seccomp filter: a "window" through which system calls pass; the `reboot` call hits the filter.
7. **Summary.** All frames are on: the process in its own namespaces, in its own cgroup, with reduced capabilities, with its own root and a call filter. Label: "what you've assembled will from now on be called a container" (`forward: docker.container`). The "same by hand" button leads to the `linux.container-by-hand` lab at tier B.

By hand: the OOM trainer (section 13.1) and the DL4 task "limit `sleep` to five processes without touching `/sys/fs/cgroup` by hand" (section 11.4).

#### 9.3.2. `p.ctr.towers` — "Hardware → VMs → containers → nesting" (containers, after D30; continued in K52)

1. **Two towers.** On the left, "VMs": hardware | hypervisor | guest kernel | OS | application — repeated N times above the hypervisor. On the right, "containers": hardware | host kernel | (namespaces + cgroups) | libraries | application ×N. The layers are labeled on the boundaries between them; the kernel is in the "kernel" color (the same as in Linux), user space in the "user" color. Clicking each layer opens a card (what it is, who provides it, a documentation label). Nothing moves.
2. **The "number of applications" slider 1–20.** The towers grow: on the left, a "guest kernel + OS" floor is added for every application; on the right, only the top floor is added. Under each tower are three counters: memory, startup time, CPU usage. The numbers come from a model with explicit assumptions (VM: +512 MB per guest OS, boot 20–40 s; container: +5–50 MB, start under a second); clicking a counter opens the assumptions and their sources. On every change, next to the memory counter — "each VM carries its own kernel and OS — that's why memory grows in steps".
3. **The "kernel vulnerability" toggle.** In the left tower, one VM (its guest kernel) is highlighted; in the right one, the shared kernel and all applications above it. The label on the boundary: "the VM boundary is the hypervisor, the container boundary is the kernel shared by all". A prediction before the toggle: "How many applications are at risk in each tower?"
4. **Today: nesting.** A third tower: hardware → cloud hypervisor → VM → VM kernel → containers. Label: "almost all containers in the cloud live inside VMs — this is how container density is combined with the hypervisor boundary". The "where is the isolation boundary" switch highlights it at each level.
5. **(Kubernetes, K52.) Back to the towers.** A fourth tower: hardware → kernel → Kubernetes → pod → QEMU process → guest kernel → application (KubeVirt, Cozystack). Label: "the VM is inside again — now as a pod managed by the same reconciliation loop". The screen is in the Kubernetes block because it requires K01 and K09: showing it in the containers block would break the order rule.

By hand, at tier B, checked by agent facts:

- "Your Linux in the browser is itself a virtual machine". `dmesg | head`, `cat /proc/cpuinfo | grep -m1 'model name'`, `dmesg | grep -i -E 'hypervisor|bochs|qemu'`. In v86 there may be no hypervisor line; then the emulator's CPU model serves as the sign. Which line is reliable for the 09 image is checked on it and written into the golden recording. Task: paste the line that shows the machine is virtual. Checked: the line is present in the output of `dmesg` or `/proc/cpuinfo` of this machine.
- "Inside and outside". On the host and in a container (crun) — `uname -r` and `ps -e | wc -l`. A prediction before running: "Will the kernel version match?" Checked: both values are entered, `uname -r` matches, the number of processes differs.
- "Stopwatch". `time crun run …` versus booting a second v86 machine from a cold image (not from a snapshot, otherwise the comparison is unfair; the interface sets the timer from start to the prompt). Checked: both numbers are entered, the ratio is greater than 10, and the learner chooses an explanation of the difference from three.

#### 9.3.3. `p.k8s.reconcile` — the reconciliation loop, the controller chain and your own controller (Kubernetes, after K03; steps 7–9 after K40 and K30)

Three columns on one screen. On the left, "desired": the object's YAML as it is stored in etcd, with `resourceVersion`. On the right, "actual": nodes and pod rectangles. Between them, the controller — a ring of three arcs labeled "watch", "compare", "act". Under the ring, an iteration counter and the difference line `want 3 · have 3`. Colors: desired and actual are a pair of colors from the palette, the same throughout the course.

| Step | What changes | What the learner can do | Label next to the change |
|---|---|---|---|
| 1 | Stable: want 3, have 3; the ring spins, no actions | Click an arc: a card "the controller does not wait for events, it reconciles state" | "No difference — the iterations run idle" |
| 2 | The learner deletes a pod (a button by the rectangle or `kubectl delete pod` in the terminal next to it). A prediction before the click: "How many pods will there be after one iteration?" | Pause, step back and forward | "Actual: 2. Desired: 3. Difference +1 → create a pod. The controller does not care why the pod disappeared" |
| 3 | The `replicas` slider 0–10 | Move it; recompute on every value | "The desired state changed in etcd; the controller saw it on the next iteration: create 4". At 0 — "pods are deleted, the Deployment remains" |
| 4 | The toggle "Break it: the controller is stopped" | Delete a pod with the controller off, then turn it on | "Nobody is reconciling — the difference accumulates. Turn it on — it will be fixed in one iteration: the controller compares state, it does not count events" |
| 5 | The toggle "Break it: a node went down"; a `tolerationSeconds` slider 10–300 s and "speed up time" | Watch the node's pods become gray `Unknown`, the counter decreases, then pods are created on other nodes | "We wait because the node may have dropped off the network only briefly" |
| 6 | Changing the image `web:1` → `web:2`; `maxSurge`, `maxUnavailable` sliders | Move the sliders during the rollout | A second ReplicaSet appears; counters of old and new pods, the line "available now ≥ 2" |
| 7 | The chain: the ring unfolds into four rings — Deployment controller → ReplicaSet controller → scheduler → kubelet; each has its own "desired/actual" pair (for the scheduler: a pod without a node → a pod with a node; for the kubelet: a pod on the node → a container in the runtime); arrows "writes to the API → another one sees it" | Click each ring: what it watches and what it writes. "Break" any ring | Without the scheduler — "pods Pending"; without the RS controller — "the Deployment exists, there are no pods"; the common label "nobody calls anybody: everyone writes to the API and watches the API" |
| 8 | A new object type `Greeting` (CRD) without a controller: the object is created, nothing happens | `kubectl apply -f greeting.yaml` | "The API stores anything; without a controller this is just a record" |
| 9 | The learner writes their own controller (the lab below) and runs it | Editor and terminal | "Your loop is the same ring. An operator is a controller for its own type of objects" |

**The "Your own controller" lab.** For the core — **bash** on top of `kubectl` from kube-lite: bash is introduced in Linux (L20–L21), so the order rule is respected. The learner is given a skeleton and completes the loop themselves:

```bash
while true; do
  for name in $(kubectl get greetings -o jsonpath='{.items[*].metadata.name}'); do
    want=$(kubectl get greeting "$name" -o jsonpath='{.spec.message}')
    have=$(kubectl get configmap "greeting-$name" -o jsonpath='{.data.message}' 2>/dev/null)
    # TODO: if want and have differ, bring the ConfigMap to the desired state
  done
  sleep 2
done
```

For `plus` — the same controller in TypeScript on top of the kube-lite watch API (an informer-style interface, about 30 lines); for `pro` — with an ownerReference and garbage collection. Checked by a hidden test bench, using `k8s.objects` facts: (1) after `spec.message` is changed, the ConfigMap matches within two iterations; (2) a deleted ConfigMap is restored, and the controller was not restarted in the meantime (`keep`); (3) **event loss**: for the TypeScript version, the bench drops half of the watch events, and the controller must converge through periodic re-reconciliation — this is the level-triggered check; (4) two controller instances running at the same time do not create duplicates (creation by a deterministic name). The final screen: "this is what an operator is", a bridge to the Go operator pet project — the same three steps rewritten on controller-runtime (`Reconcile(ctx, req)`).

Requirements for kube-lite that follow from the lab: `kubectl get -o jsonpath`, `--dry-run=client -o yaml`, CRDs with an arbitrary schema, a long-running background learner process that writes to the API. They are passed on to 05 §5.5 and 09 §1.7.

#### 9.3.4. `p.k8s.service-path` — a request through Gateway, Service and kube-proxy (Kubernetes, after K15 and K36)

1. **The whole path.** On the left, a client on the internet, then a cloud load balancer, two nodes, each with a Gateway pod and `web` pods; above the nodes, a Service `web` plate with the address `10.43.12.7:80`, which has no line to any interface — the label "this address exists on no interface". Network layers on the arrows are labeled in their colors (L4, L7).
2. **Entry from outside.** A packet goes from the client to the load balancer and to the NodePort of node 1; clicking the arrow shows the header fields (src, dst, port) on this segment. The "entry type" switch: NodePort, LoadBalancer, Gateway API — the diagram is recomputed, unnecessary segments go dark.
3. **Gateway → Service.** The HTTPRoute matches `Host` and the path; the packet goes to `10.43.12.7:80`. Prediction: "Which process on the node will accept the packet at this address?" Answer: none — it will be intercepted by a kernel rule.
4. **kube-proxy and the rules.** The packet enters the `KUBE-SERVICES` chain, then `KUBE-SVC-…` with two `KUBE-SEP-…` branches (`--probability 0.5`), then DNAT to `10.244.1.5:8080`. The mode switch: iptables, nftables (`nft list table ip kube-proxy`), eBPF in Cilium (no iptables rules, a map in the kernel). The "number of pods" slider 1–5: `KUBE-SEP` branches are added, probabilities are recomputed, the label "the probabilities are chosen so that each pod gets an equal share".
5. **EndpointSlice.** Next to the Service — an EndpointSlice table with a `ready` column. "Break it: a pod without the required label" — the row disappears from the table and the `KUBE-SEP` branch from the rules; "Break it: readiness failed" — the row remains with `ready: false`, the branch disappears. Label: "a Service leads only to ready pods that matched the selector".
6. **The response back.** The packet returns along the same path, conntrack performs the reverse address translation; clicking conntrack shows the entry. The final label: "a Service is DNAT rules on every node, not a proxy".

By hand on the hybrid (section 13.4): the trainer "find in iptables where a packet to a ClusterIP goes" and the trainer "the pod could not reach the service".

---

## 10. Worked examples and the support ladder

For each concept, tasks go through six steps. The learner climbs them adaptively, as in research on adaptive fading of support (Salden et al., 2010), not along a fixed program.

| Step | Format | Example for L11 "permissions" |
|---|---|---|
| S0 | A fully worked example with a self-explanation question | `chmod u+x deploy.sh` is shown with `ls -l` output before and after; question: "What changed in the first column, and why only for the owner?" |
| S1 | An example with one gap (completion) | `chmod __ deploy.sh` so that the group can read |
| S2 | Assembling from shuffled parts with extra pieces (a Parsons problem) | Assemble a command from `chmod`, `g+w`, `o-r`, `-R`, `report/`, `sudo` so that the group can write to the whole directory tree |
| S3 | An independent task, hints on request (the hint ladder, section 16.2) | Give the `dev` group write access to `/srv/app`, and nothing to others |
| S4 | Transfer to new data without hints | Another directory, another group, plus the owner must change |
| S5 | Breakage: find and fix | The site returns 403; the cause is the permissions on the static files directory |

Transition rule: two correct answers in a row at a step without hints H4–H5 — move up a step; an error — stay; another error in a row — step down. The starting step depends on the level: "Beginner" — S0, "Intermediate" — S1, "Experienced" — S3. The content of hints at S3 and above also depends on the documentation ladder step (section 11): at DL4, steps S3–S5 go without content hints. The `practicing` state is set at S3; `mastered` requires S4 and a delayed review.

Parsons problems (S2) were chosen for the command line deliberately: they provide the syntax without requiring it to be recalled from scratch, and in research on programming education they give comparable results in less time than writing code from scratch (Ericson et al., 2017).

---

## 11. Documentation ladder

### 11.1. Why a separate ladder

The habit of reading documentation is the third pillar of the course (section 1.1), and it cannot be left to chance. At work, a junior engineer meets a flag every day that was not in any course, and the one who finds it in `man` or on kubernetes.io in two minutes wins. But a beginner cannot be sent to the documentation from the first lesson: a manual page in an unfamiliar language of concepts only adds extraneous load (Sweller), and the learner decides that "this is not for me". So documentation appears in five steps: at first it only glimpses, then it becomes a hint, then the only hint, then the course forces the learner to go to it, and at the exam it is all that remains.

This is the third axis alongside the support ladder (S0–S5, section 10) and the hint ladder (H0–H5, section 16.2). The step is stored **per documentation source**, not per concept: `man`, `--help`, `kubectl explain`, kubernetes.io, docs.docker.com, docs.gitlab.com and `git help`, docs.ansible.com and `ansible-doc`, developer.hashicorp.com/terraform, prometheus.io/docs. Experience with one source partially transfers to another: a learner at DL4 for `man` who opens kubernetes.io for the first time starts at DL2, not DL1.

### 11.2. Steps

| Step | What the learner sees | What the mentor does | How it is checked |
|---|---|---|---|
| **DL1. Glimpse** | Every command and option in an example and every element of a process explanation has a "this comes from here" label leading to the exact place: `tail(1) → OPTIONS → -n`, `kubernetes.io → Pod lifecycle`. The label sits next to the element (CL6) and opens in a built-in viewer over the lesson. Opening it is not required | Explains in its own words, as usual | Not checked; the opening is written to the log (`doc_open`) |
| **DL2. The hint is the page** | An H2–H3 hint is not our text but a fragment of the real page with the needed line highlighted. Above the fragment, a mini-map of the page: NAME, SYNOPSIS, DESCRIPTION, OPTIONS, EXAMPLES, SEE ALSO; the current section is highlighted, with the labels "SYNOPSIS — how to call it", "OPTIONS — flags", "EXAMPLES — ready-made examples". Once per module, a task on the anatomy of the page. The first opening of a full page comes with one screen "how to read a page with a lot of unfamiliar material" | Gives the hint as a fragment of the page rather than a retelling | Anatomy tasks are a `hotspot` on a section of the page |
| **DL3. Find the flag** | A task "find the option that does X". Only a link to the whole page (or the command `man ss`) is given, without highlighting | Hints H1–H2; after that only "the OPTIONS section, search for the word …" | By effect: the flag is applied by any path. Opening the page before answering is credited separately |
| **DL4. Forcing** | The task requires a command, flag or subcommand that is not in the theory (`untaught`). There are no content hints | `docs` mode: the first move is "where have you already looked, what did you find?"; if nowhere — it names the **type** of source (`man ss`, `kubectl explain pod.spec`, `docker run --help`); if they looked — it names the section of the page; then — a word to search for. It never names the flag, subcommand or command | By effect; in the walkthrough — the path "which page you opened and how many seconds it took to find" |
| **DL5. Exam with documentation** | At the final exam, only the built-in viewer of official documentation from the block's allowlist is open (modeled on the CKA). 10–25% of the exam weight is tasks on what was not in the course | Turned off | Like the exam (section 13.3); a task outside the course is not marked `critical`, its weight is no more than 25% |

**A flag is not a concept.** A flag or command that is looked up in documentation is not a graph concept, so the order rule (6.1) is not violated. The task text is phrased with concepts already introduced: "show which process is listening on the port" is allowed; "show the conntrack entries" without introducing conntrack is not.

### 11.3. Start and climbing

The starting step in the first block: "Beginner" — DL1, "Intermediate" — DL2, "Experienced" — DL3. Climbing within a block follows the position of the module, so that the course is guaranteed to reach forcing rather than get stuck on hints:

| Part of the block | Beginner | Intermediate | Experienced |
|---|---|---|---|
| First third of the modules | DL1 | DL2 | DL3 |
| Second third | DL2 | DL3 | DL4 |
| Last third and break-fix trainers | DL3; in the last module — DL4 | DL4 | DL4 |
| Final exam | DL5 | DL5 | DL5 |

Two rules apply on top of the schedule. **Carry-over:** if in the previous block the learner reached step *k* for a source, in the new block they start with that source no lower than *k − 1*: a beginner who reached DL4 for `man` in Linux does not go back to "glimpse" for `--help` in containers. **Advancing early:** a source's step is raised ahead of schedule when three tasks in a row at it are solved without hints H4–H5; at DL4 — when in two out of three tasks the needed page is found faster than the norm. The step is never lowered: to a learner stuck at DL4 the mentor offers a DL3 hint (a link to the page), but the step remains.

So a beginner is not sent into the documentation from scratch: in the first third of Linux they see `man` only as labels, in the second as highlighted fragments, and only by services and logs do they get the first "find it yourself" tasks. But by the Linux exam, forcing has already begun.

### 11.4. Tasks by block

One example per step in each block; these are tasks for block authors and for the 10 bank. Predicates are in the 09 contract.

| Block | DL1 | DL2 | DL3 | DL4 (forcing) | DL5 (exam) |
|---|---|---|---|---|---|
| Methodology | Labels on the Kanban Guide and dora.dev | A fragment of dora.dev with the definition of "failed deployment recovery time" highlighted | "Find on dora.dev which metric was added to the four classic ones" (deployment rework rate) | — (a block without tools) | — |
| Linux | `tail -n 5 app.log`: a label at `-n` → `tail(1)`, OPTIONS, `-n, --lines=[+]NUM` | A hint for "show the service log for the last hour": a fragment of `journalctl(1)` with `-S, --since=` highlighted. Anatomy: "in the SYNOPSIS `journalctl [OPTIONS…] [MATCHES…]`, are MATCHES mandatory?" (`hotspot` on the brackets) | "Find the `ss` option that shows which process is listening on a port" (a link to `ss(8)` is given); predicate `cmds[argv0=ss][exit=0].stdout~'users:(('` | (a) "Print the process tree together with arguments": `pstree -a` or `ps --forest`; (b) "Print only the errors from the service log for 10 minutes": `journalctl -p err --since "10 min ago"`; (c) isolation: "run `sleep 1000` so that it cannot create more than 5 processes, without touching `/sys/fs/cgroup` by hand" — `systemd-run --scope -p TasksMax=5`; predicate `cgroups[procs~@pid(sleep)].pids.max=5` | Exam: "set up rotation of the application log once a day, keep 7 copies" (`logrotate.conf(5)`); "find a file that has been deleted but still holds disk space" (`lsof +L1`) |
| Git and YAML | A label at `git log --oneline` → `git-log(1)` | A fragment of `git log --help` with `--graph` highlighted | "Find how to undo a published commit without rewriting history" (`git revert`) | `git bisect run` to find the commit that broke a test | — (Git is assessed within the CI/CD final exam) |
| Networks | A label at `dig +short` → `dig(1)`, query options | A fragment of `ip-route(8)` with `via ADDRESS` highlighted | "Find the `curl` option that shows the timing of connection phases" (`-w` with `time_connect` or `--trace-time`); "how `dig` shows the path from the root" (`+trace`) | "Find the path MTU to `api.lab`" (`tracepath` or `ping -M do -s`); `tcpdump -nn port 53`; `curl --resolve` | "Limit new SSH connections to three per minute" (`nft` limit or `iptables -m hashlimit`; the nftables wiki documentation is on the allowlist); a task on `ip rule` |
| Containers | A label at `-p` → docs.docker.com, `docker container run`, `--publish` | A hint for "restart on crash": a fragment of the reference for `--restart` with `on-failure[:max-retries]` highlighted | "Find the flag that puts an init in place of PID 1" (`--init`); "show only container IDs" (`-q`) | `docker cp` from a stopped container; `docker inspect -f '{{.State.OOMKilled}}'`; `--read-only --tmpfs /tmp` | A build for two platforms (`docker buildx build --platform`); `docker system df -v`; `--cap-drop` |
| Kubernetes | A label at `spec.replicas` → `kubectl explain deployment.spec.replicas` and kubernetes.io | The output of `kubectl explain pod.spec.containers.readinessProbe` with `initialDelaySeconds` highlighted; anatomy: "where in the output is the field type, and where is the description" | "Find how to list pods together with their node" (`-o wide` or `custom-columns` with `.spec.nodeName`); "where `terminationGracePeriodSeconds` is set" | "Make the pod not run on `node-2` without changing the node's labels" (nodeAffinity `NotIn` on `kubernetes.io/hostname`); `kubectl debug --profile`; `topologySpreadConstraints` | As in the CKA: kubernetes.io/docs (searching on the site is allowed, opening external results is not), kubernetes.io/blog, helm.sh/docs, gateway-api.sigs.k8s.io; `kubectl explain` and `--help` |
| CI/CD | A label at `rules:` → docs.gitlab.com | A fragment of the reference for `needs:` with an example highlighted | "Find the key that runs a job only when files in `app/` change" (`rules:changes`) | `parallel:matrix`, `include` without explanation in the theory | GitLab CI documentation and `git help` |
| IaC | A label at `plan` → developer.hashicorp.com | A fragment of the `lifecycle` page with `prevent_destroy` highlighted | `ansible-doc lineinfile`: find the parameter that creates the file (`create`) | "Make Terraform not delete the database on re-creation" (`prevent_destroy`, if it was not in the theory); a `moved` block; `ansible-playbook --check --diff` | `ansible-doc`, `terraform -help`, provider documentation |
| Monitoring | A label at `rate` → prometheus.io/docs, PromQL functions | A fragment of the PromQL functions with `rate` highlighted | "Find the function that predicts the disk filling up in 4 hours" (`predict_linear`) | `absent()`, `label_replace`, `inhibit_rules` | Prometheus and Alertmanager documentation |

**Minimums checked by the build.** In every technical block — at least 6 DL3 tasks, 4 DL4 tasks and 2 DL5 tasks in the final exam.

### 11.5. Format and linter

```yaml
id: linux.m08.drill.7
doc_ladder: DL4
docs:
  ref: { kind: man, page: ps, section: 1, anchor: "--sort" }   # or { kind: url, url: "https://kubernetes.io/docs/...", anchor: "..." }
  untaught: ["--sort", "-o pid,%mem,cmd"]                     # what the solution requires and was not in the theory
  solution_tokens: ["--sort", "-%mem", "pmem"]                 # what the mentor must not name
prompt:
  ru: "Выведи пять процессов, которые занимают больше всего памяти, — только PID, %MEM и команду."
goals:
  - id: g1
    needs: [cmds]
    when: "cmds[argv0=ps][exit=0].stdout.columns=[PID,%MEM,CMD] && sorted_by('%MEM',desc) && rows#=5"
ai_mode: docs
```

For a task with `untaught`, the linter checks: (1) the listed flags are not present in any text on the route before this task; (2) the page from `docs.ref` is in the versioned snapshot of the corpus; (3) the anchor exists, and the flag is found in the snapshot text at that anchor. A broken link or a vanished anchor fails the build. The DL5 Kubernetes exam allowlist is checked at every build against the Linux Foundation page on allowed resources: it changes (Gateway API was added in 2025).

### 11.6. Documentation corpus

The corpus is a shared platform resource (09): `docs/<source>/<version>/…` with an anchor map and the license of each source.

- **man and `--help`.** Tier B shows the real pages from the image: in minimal Debian images `/usr/share/man` is often stripped by a `path-exclude` rule in `/etc/dpkg/dpkg.cfg.d/`, so the `lab-debian` image explicitly installs `man-db` and `manpages` and removes the exclusion. Tier A gets a snapshot of the same pages of the same version, built from the image in CI, not written anew.
- **`kubectl explain`** in kube-lite is built directly from the OpenAPI schemas of the Kubernetes version that 05 models; the command is added to the list in 05 §5.5.
- **Web documentation** is a mirror with a snapshot date, otherwise the DL3–DL5 anchors break when the sites are updated. kubernetes.io (CC BY 4.0) and docs.docker.com (Apache 2.0) are mirrored offline with attribution. For the pages of the man-pages project, GNU, Terraform, Ansible and Prometheus, the license is checked against each source's repository before embedding; until it is checked, the source is only linked (DL1, DL3) and opened as the live site in the viewer, and DL2 fragments from it are not embedded. The table "source → license → embed a fragment or only link" is maintained by the role responsible for the corpus.

---

## 12. Retrieval practice and spaced repetition

The scheduler is FSRS in the `ts-fsrs` implementation (MIT, TypeScript, runs in the browser), with a target recall probability of 0.9. A card is created per concept, not per fact; a concept has several question formats, and a different one is taken at each review.

| Format | Example | Grading |
|---|---|---|
| Recall | "What does `2>&1` do?" — an answer in your own words, then the reference | By the learner: "didn't recall / with difficulty / recalled / easily" |
| Predict the output | A command and a state are shown, choose the output | Automatic |
| Choose a command | A task in words, four commands | Automatic |
| Micro-task in the sandbox | 30–90 seconds: "stop process X" | Automatic, by state |
| Explain out loud | "Explain to a colleague what a Service is" — text or voice, rubric | Self, by rubric, or the AI mentor |

Automatic grading is translated into an FSRS rating as follows: an error — Again; correct with a hint or more than twice the norm — Hard; correct within the norm — Good; correct in less than half the norm with confidence "I know" — Easy. An error with confidence "I know" additionally schedules the concept for repetition in the same session.

Daily review — up to 15 minutes or 30 cards. A new lesson opens after review: if more than two days' worth has accumulated, the product suggests clearing the queue first, but does not block. Review mixes blocks (interleaving per Bjork): after the third Linux module, Linux and Orientation enter the queue mixed together; after containers — Linux, networks and containers together. Interleaving works for telling similar things apart: `cp` and `mv`, TCP and UDP, ConfigMap and Secret. That is why pairs where confusion is most costly are deliberately placed next to each other in the queue: `linux.namespaces` and `k8s.namespace` (homonyms), `docker.storage` and `k8s.storage`, `net.nat` and `k8s.service` (DNAT in both), `linux.cgroups` and `k8s.resources`, rolling update in CI/CD and in a Deployment, `docker.pid1-signals` and `k8s.probes`.

Review is designed for a phone: the QR handoff from the Sankofa engine (`engine/qr.ts`) moves the queue to the phone, and cards in the "recall", "predict" and "choose" formats can be done on the subway. Process explanations also work on a phone (their timeline and sliders do not need a keyboard). Sandbox micro-tasks remain on the computer.

---

## 13. Practice, trainers and practical exams

### 13.1. Trainers

A trainer is a series of short tasks on one skill with immediate feedback, following the principles of deliberate practice: a clear goal, the edge of current ability, a walkthrough of every error, repetition with new data. Every trainer relies on the chapter, a process explanation or the module documentation and refers to them in the walkthrough (section 1.1). Three kinds of trainers:

- **Fluency.** 10 tasks of 20–60 seconds each: navigation, permissions, `ss`, `kubectl get`. The time is shown only to the learner, without leaderboards. The goal is to free working memory from syntax.
- **Reading.** Output is shown (`top`, `journalctl`, `kubectl describe`, a `curl -v` response, a `man` page), and the question is what matters in it. It teaches reading output and documentation, which command-focused courses do not provide.
- **Break-fix.** A "broken — fix it" scenario in the sandbox. Checked by state. After the attempt — a walkthrough: what was broken, by which signs it can be seen, which diagnostic path is shorter. The learner sees their command history next to the reference path, and this is the main feedback, not a grade.

Every break-fix scenario is parameterized (3–5 cause variants for one symptom), so that the learner learns the diagnostic path rather than memorizing the answer. In every block, break-fix tasks are tied to its diagnostic model: in networks — "which layer is broken" (N25), in containers — "at which boundary" (D29), in Kubernetes networking — the five steps of K38. The walkthrough notes if the learner checked things outside the model ("checked NetworkPolicy before DNS" — the mark "acted without a hypothesis", 10 §5).

### 13.2. Key trainers required by R6–R11

**OOM in a cgroup (`linux.cgroups.drill.oom`, tier B, a kernel with `CONFIG_MEMCG`).** Setup: the group `/sys/fs/cgroup/lab` is created, `memory.max=max`, the process `hog` grows by 1 MB per second. Task: "Limit `hog` to 20 MB without restarting it, and see what the kernel does when the limit runs out." Before that, a prediction question: it will slow down / get a memory allocation error / be killed by the kernel. Goals: (1) `cgroups[procs~@pid(hog)].memory.max<=20M` with the same PID (`keep`); (2) the event `proc.exit[reason=oom]` for `hog`. Walkthrough: `memory.events` → `oom_kill 1`, the `dmesg` line `Memory cgroup out of memory: Killed process …`. Transfer to containers: `docker run -m 20m` gives the same effect, exit code 137 and `OOMKilled: true`.

**Container by hand (`linux.container-by-hand`).** Without Docker, the learner assembles a process in its own pid, mnt, uts and net namespaces, in its own cgroup with a memory limit and with its own root on overlayfs. Checked by agent facts: `readlink /proc/<pid>/ns/pid` differs from the host, the last value of `NSpid` in `/proc/<pid>/status` is 1, the process is in a group with the given `memory.max`, and its root is the `merged` directory.

**"The container doesn't work" across the six boundaries (D29).** One symptom and one boundary in each, 3–5 cause variants by seed. Checked by state, plus the learner marks the boundary on the container diagram (`hotspot` on `node.id`). The boundary without a fix gives 0.3 points, a fix without the correct boundary gives 0.7: the course teaches thinking first and fixing second, but the fix matters more.

| Boundary | Symptom | Cause variants | Check |
|---|---|---|---|
| Host kernel | `exec format error` at start | an arm64 image on amd64; an empty file without a shebang as ENTRYPOINT; a glibc binary in alpine | the container is `running`, after 30 s `State.ExitCode` is not set |
| Network | `curl localhost:8080` from the host — `connection refused` or reset | the application listens on `127.0.0.1` inside; the wrong port is published; `--network none` | HTTP 200 from the host; `forbid: network_mode=host` |
| Storage | after re-creation, user uploads are gone | writing to the top layer; the volume is mounted at the wrong path; an anonymous volume instead of a named one; tmpfs | a marker file survives `rm` + `run` |
| Process and signals | `docker stop` waits 10 s, code 137, data not written | shell form of CMD, the signal is received by `sh`; no SIGTERM handler in PID 1; zombies accumulate | `docker stop` < 2 s, code 0 or 143, `graceful shutdown` in the log, no `Z` in `ps` |
| I/O and logs | `docker logs` is empty although the application "writes logs" | it writes to a file inside; stdout buffering (Python without `-u` or `PYTHONUNBUFFERED`); the `none` driver | a marker line is visible in `docker logs` within 5 s |
| Configuration and identity | `Permission denied` when writing to a bind mount | UID 1000 inside, the host directory is `root:root 0755`; a `:ro` mount; userns-remap shifted the UID | the file is created; `forbid: chmod 777` on the host directory |

**"Find in iptables where a packet to a ClusterIP goes" (`k8s.net.drill.iptables-trace`).** A hybrid cluster: kube-lite issues EndpointSlices, and a small kube-proxy agent on every v86 node writes real rules. Task: "The pod `client` on `node-1` connects to `10.43.12.7:80`. Walk the chain of rules and enter the IP and port of the pod where the packet will go via the first branch." The learner works with `iptables-save -t nat | grep 10.43.12.7` → `KUBE-SVC-…` → two `KUBE-SEP-…` with `--probability 0.5` → `DNAT --to-destination`. Checked: the chain `KUBE-SERVICES → KUBE-SVC-xxx → KUBE-SEP-yyy` and the `ip:port` match the rules the agent wrote on this node for this seed. Transfer: delete one pod — one `KUBE-SEP` branch disappears, and the probability of the second becomes 1. The `plus` variant: the same question in nftables mode (`nft list table ip kube-proxy`).

**"The pod could not reach the service" (`k8s.net.drill.unreachable`).** Five cause variants by seed, one at each step of the K38 method: a typo in the service name or another namespace (DNS, NXDOMAIN); a wrong `targetPort` (Service); the selector does not match or readiness failed (an empty EndpointSlice or `ready: false`); the application listens on 127.0.0.1 (pod); a default-deny NetworkPolicy without an allowing rule. Checked: `curl` from `client` to the service returns 200; `forbid`: deleting the NetworkPolicy entirely (an allowing one must be added). The walkthrough shows the learner's path through the five steps and marks the skipped ones.

**"A node went down" (`k8s.drill.node-down`, hybrid, 3 nodes).** The learner finds which pods were on `node-2` (`kubectl get pods -o wide`), predicts what will happen and after how long, turns off the node, watches the move, then on `node-1` uses `ps -ef --forest` to find the processes of the moved pod and its cgroup. Checked: `k8s.objects[kind=Pod][spec.nodeName!=node-2]#=3` and the entered PID of the nginx process matches the `procs` facts of node `node-1`. This is a direct payoff of the isolation module: a former salesperson recognizes in a pod what they assembled by hand in Linux.

### 13.3. Practical exams

**One final block exam for all levels** (section 3.3):

- **Composition.** 60–120 minutes; 3–5 related practical tasks in one scenario ("company X is moving from a single server to containers") and 2 "explain" questions in interview format. The exam checks the block's core; the `plus` and `pro` parts are separate optional parts.
- **Documentation.** The exam runs in DL5 mode: only the built-in viewer of official documentation from the block's allowlist is open; 10–25% of the weight is tasks on what was not in the course (not `critical`).
- **Checking.** Practice — by the final state of the system (files and their permissions, processes, listening ports, HTTP responses, Kubernetes objects and their statuses), by any path. Explanations — by rubric; they do not fail the exam but give the "interview readiness" mark for the block.
- **Retake.** After 24 hours, with a new variant, with no limit on the number of attempts. Before a retake, the product compiles a list of concepts from the failed checks and gives a 15-minute series of trainers on them.
- **The AI mentor is turned off during the exam** (section 16). An exam "with an assistant" in 10 §0 means DL5 mode with documentation, not with a neural network.

**Kubernetes: three mandatory stages** (R12):

| Stage | Where | What is assessed | How it is checked |
|---|---|---|---|
| 1 | Browser: kube-lite and the hybrid on v86 machines | Architecture, objects, kubectl, the reconciliation loop, Kubernetes networking, your own controller; ~90 minutes | Predicates on simulator and node facts. No more than one task with `requires_nodes > 1`, and it always has a variant for the pure simulator |
| 2 | One machine: your own (kind, minikube) or a VPS (k3s) | A Helm release, entry via Ingress or Gateway API, an image from a real registry with `imagePullSecrets`, deployment from CI | `trainer-check` in the learner's cluster: the learner puts a one-time code from the trainer into a ConfigMap, the script reads it back and writes the UID of the `kube-system` namespace into the report; the report is pasted into the trainer |
| 3 | 3+ VMs ordered with Terraform and configured with Ansible (after the IaC block) | `kubeadm init` and `join`, Cilium, a volume provisioner, checking certificates, upgrading by one minor version, etcd backup and restore, breaking and fixing a node | The trainer does not execute commands; it guides step by step and checks: `trainer-check` with the same ConfigMap code mechanism; then mandatory cleanup (7.4) |

At stage 3, the learner takes machines from a cheap Russian or international cloud of their choice or brings up local VMs on their own computer; node requirements follow the kubeadm documentation (at least 2 vCPUs and 2 GB of memory per control plane node); providers and prices are in 05 §10.2, and this document does not duplicate them. The "CKA-style" exam from 05 §9.3 remains part of `pro`.

### 13.4. Several machines in the browser and hybrid Kubernetes

Several v86 machines in Web Workers, connected by our JS switch (real L2: ARP, ping, tcpdump, routing, iptables, NAT, WireGuard between nodes), change the pedagogy of the "Networks" and "Kubernetes" blocks: pods become real processes in real namespaces, `kubectl exec` enters a real container, and a killed node forces pods to move. The hybrid works like this: the control plane is our kube-lite simulator in TypeScript; on every v86 node there is a small "kubelet" agent that starts pods via crun, and a kube-proxy agent that writes real rules. A real k3s or kubelet inside v86 is impossible (32-bit emulation, memory), and the learner is told this directly in the first lesson where the hybrid appears (K53): they must understand where the model ends and real processes begin.

Three rules matter for pedagogy:

- **Minimum environment.** Every task and lesson has `env_min: sim | v86x1 | v86x3` and `requires_nodes`. Any `core` concept can be completed on `sim`. A task with `requires_nodes > device.max_nodes` is replaced by its variant in the pure simulator (the same scenario, the same predicates on facts, without real processes) with a "simulator" mark in the record. This is cheap because the 09 predicates are shared by all environments.
- **Device.** `device.max_nodes` is determined by a trial launch: the guideline is 3–4 nodes of 64–128 MB on a laptop, 1 on a phone. On a phone, review, process explanations and `sim` tasks are available. A lightweight node image (without full Debian with systemd, which takes 256 MB in 02 §1.3) is a decision for 02 and 09; this document only records that the set of tasks depends on the device.
- **"Here is the same thing for real".** `v86x3` scenes come after the model, not instead of it: first the process explanation and the task in the simulator, then the same story on real nodes. A learner on a weak device loses no concepts, only the recognition scene.

---

## 14. Metacognition and motivation

### 14.1. Metacognition

- **Confidence** with every answer in checks and review (section 4). Once a week — a calibration chart: "when you answered "I know", you were right 78% of the time; "I know" errors were in the topics NAT and permissions". Calibration teaches not so much knowledge as honest self-assessment, without which it is impossible to say "I don't know" at an interview.
- **Prediction before running.** Before every new command in "Try" — a choice of what it will print. A prediction error is a reason to dig in, not a failure.
- **Self-explanation.** In worked examples, one "why" question per example (Chi: active and constructive engagement is stronger than passive).
- **Explaining desirable difficulties in advance.** The first methodology lesson contains a screen "How this course works": why we make you recall rather than reread, why review feels hard and that this is normal, why we will open documentation more and more often until at the exam it is all that remains. Without this, the learner perceives difficulty as their own inability.
- **Knowledge base.** The checklist advises keeping a knowledge base (Obsidian, OneNote). After every lesson, the product suggests writing down in three lines, in your own words, what you understood; the notes are exported to Markdown with internal links to concepts and open in Obsidian. This is both generative learning and preparation for interviews.
- **Weekly reflection.** Three questions once a week: what worked, where I got stuck, what I will change in my schedule. Only the learner sees the answers.

### 14.2. Motivation of adults who are changing careers

The checklist explicitly names stress, impostor syndrome and the fear of asking questions as the main difficulties of the transition, and mock interviews as a remedy for fear. Decisions:

- **The first ten minutes are a real success.** Onboarding (section 3.4) goes straight to the sandbox terminal, where the learner types three commands and gets a visible result (created a folder, saw it in the "file manager" next to the terminal). No introductory video before that. Bandura: one's own successful experience is stronger than any persuasion.
- **The terminal cannot be broken.** In the first Linux module, right after `rm` (L06): "delete all your files" — `rm -rf ~/*` in the sandbox, the home directory in the "file manager" next to it empties, and a "restore" button brings it back from a snapshot. The fear of "breaking the server" is removed once and for all. The course does not show the famous `rm -rf /` as "everything disappeared": the real GNU `rm` refuses to run it (`rm: it is dangerous to operate recursively on '/'`, the `--preserve-root` protection), and tier B would immediately refute it. It is discussed in lesson L12 on root and `sudo` as a walkthrough of a mistake: the protection exists only for `/` itself, and it will not stop `sudo rm -rf /*`.
- **An error is a source of information.** Every typical error (Permission denied, command not found, connection refused, CrashLoopBackOff) has a card "how to read this error". An error in the sandbox is highlighted not with a red "wrong" but with a neutral "here is what the system said".
- **Progress in work terms.** Instead of points and badges — a skill map worded like job postings: "you can find the process that is loading the server", "you can build an image and publish it", "you can explain how a container differs from a VM". This is a direct answer to impostor syndrome: proof that you can do it, not a feeling. There are no leaderboards, points, or day streaks with "flames": the product is not a game, and comparison with others hurts those who started from zero.
- **Similar people.** On block opening screens — short stories of people who came to DevOps from support, sales, testing (we collect them ourselves from course graduates and engineers we know, with their consent). Stories are text and, if available, a real photograph with the person's consent; we do not draw illustrations (CL9). Observing a similar person is the second strongest source of self-efficacy.
- **Experience from the previous profession counts.** In the questionnaire the learner states their previous profession, and the analogies in hooks are chosen for it (sales funnel ↔ kanban; regression ↔ CI; support on-call ↔ incident). The checklist says directly: technical support experience is a plus.
- **An adult's time.** A lesson can be interrupted on any screen and resumed from the same screen; the daily recommendation is calculated from the stated hours per week; skipping a week is not punished but met with a short review "what happened last time".
- **Early contact with the market.** The module "how to read a job posting" comes right after methodology: the learner analyzes three real job postings and marks which of the requirements the course will provide and when. This makes the goal tangible and prepares the rule "60% match — apply".

---

## 15. Time budget

Hours are derived from the graph by a formula, not assigned:

`block hours = (Σ core concepts × norm × level coefficient + process explanations × 0.3 h + block exams × level coefficient) × 1.15`

- **The norm per core concept** for "Beginner" is 1.2 h: about 45 minutes of lesson (chapter, explanation, try, exit ticket) and about 25 minutes of practice (trainers, DL3–DL4 tasks, which are slower than usual). For methodology — 0.8 h (no terminal), for "Orientation" — 0.5 h. For stages on real VMs (Kubernetes stages 2 and 3) — 2.0 and 2.5 h: installing and waiting for machines takes time regardless of experience.
- **Level coefficient:** "Intermediate" — 0.6, "Experienced" — 0.3 (some concepts are `placed`, support steps start higher). On stages with real VMs — 0.85 and 0.7. Exams — 1, 0.85 and 0.7.
- **A process explanation** is 0.3 h for all levels: the "Experienced" learner does not skip them (section 7.2).
- **1.15** — review (about 15% of the time).

| Block | Core concepts | Explanations | Exams, h | Beginner, h | Intermediate, h | Experienced, h |
|---|---|---|---|---|---|---|
| Orientation | 12 | — | — | 6 | — | — |
| Methodology | 19 | 3 | 2 | 21 | 13 | 8 |
| Linux (incl. isolation and your own VM) | 45 | 6 | 8 | 73 | 47 | 27 |
| Git and YAML | 11 | — | 2 | 15 | 10 | 5 |
| Networks (core; `plus` and `pro` — about 12 h more) | 31 | 7 | 6 | 52 | 34 | 20 |
| Containers | 28 | 4 | 6 | 47 | 30 | 18 |
| CI/CD | 10 | 1 | 4 | 19 | 13 | 8 |
| Kubernetes, stage 1 (incl. networking and your own controller) | 53 | 8 | 8 | 85 | 54 | 31 |
| Kubernetes, stage 2 | 3 | — | 6 | 14 | 12 | 10 |
| IaC | 16 | 2 | 5 | 29 | 19 | 11 |
| Kubernetes, stage 3 | 7 | — | 10 | 32 | 27 | 22 |
| Monitoring | 14 | 1 | 4 | 24 | 16 | 9 |
| Pet project | — | — | — | 40 | 35 | 30 |
| Career (incl. 3–5 mock interviews) | — | — | — | 25 | 22 | 18 |
| **Total** | | | | **≈ 480** | **≈ 330** | **≈ 215** |

At 10 hours a week, a "Beginner" completes the course in about 11–12 months, an "Intermediate" in 8, an "Experienced" in 5. This is said honestly on the first screen of the course, not discovered in the seventh month. A real learner is mixed (a programmer is "Experienced" in Linux and a "Beginner" in monitoring), and the product calculates the duration from their block levels, chosen tiers and stated hours. The recommended rhythm is 4–5 sessions a week of 1.5–2.5 hours plus daily review on the phone; the product does not offer more than 3 hours of new material per day, because distributed practice is more effective than massed practice.

The norms are an estimate; after the first 50 learners they are recalculated from the actual event log, and the table is generated from `concepts.yaml` and the norms at build time.

---

## 16. AI mentor: pedagogical behavior

The learner connects their own model (DeepSeek or another compatible one) with a key in the browser. The system instructions and context are set by the product. The mentor is needed where command output, the chapter and the process explanation are not enough: to explain what is unclear, to walk through one's own mistake, to answer "but why". The experiment by Bastani et al. is unambiguous on the main point: a mentor that hands out answers harms learning, while a mentor with restrictions caused no significant harm on the final test. That is why the restrictions are strict, and with the documentation ladder the mentor gets one more role — to bring the learner back to the primary source.

### 16.1. Modes

| Where the learner is | Mode | What the mentor may do | What it may not do |
|---|---|---|---|
| Chapter, the "Watch the process" and "Explanation" steps | `explain` | Explain freely, in other words, with examples from the learner's previous profession; suggest moving a parameter of the explanation | Introduce concepts that are not in the list of introduced ones without a "running ahead" mark |
| Practice and trainers, steps DL1–DL3 | `practice` | The hint ladder, one step per request (16.2) | Give a ready-made command or the solution of the current task |
| A `doc_ladder: DL4` task | `docs` | Only "where have you already looked, what did you find?", the type of source, the section of the page, a word to search for (section 11.2) | Name the flag or subcommand, write the command |
| Free sandbox (outside tasks) | `free` | Explain output, suggest what to try, walk through any commands | — |
| Exit ticket, placement check, exam (DL5) | `exam` | Nothing; the mentor button is inactive, questions about the wording are covered by the task's static FAQ; at the exam, the built-in viewer of official documentation is open | Everything |
| Review | `review` | Explain after the answer why it is correct or incorrect | Give hints before the answer |

### 16.2. Hint ladder

There is one scale for all documents (09 switches to it instead of `hintLevel 0–3`): `H0` — no hints, `H1…H5` — as below. The content of H2–H3 depends on the learner's documentation step for the relevant source.

| Step | What the mentor says | DL1–DL2 | DL3 | DL4 | Effect on grading |
|---|---|---|---|---|---|
| H1 | A leading question about the goal and the observation: "What do you want to get? What does the output show right now?" | as is | as is | "Where have you already looked?" | None |
| H2 | Pointing to the area: "Look at the first column of `ls -l`" | as is; at DL2 — a documentation fragment with highlighting | only the name of the page | the type of source | None |
| H3 | The concept and a link to the chapter paragraph or the process explanation step where it is explained | at DL2 — plus a fragment of the page | the section of the page | the section of the page, a word to search for | None |
| H4 | A worked similar example with different data | as is | as is | unavailable | The answer is graded as Hard |
| H5 | A solution skeleton with gaps | as is | as is | unavailable | The answer is graded as Hard, the support ladder step is not raised |

There is no ready-made solution at any step, and there is no "show solution" button during an attempt. The reference command is known to the *engine* (to collapse leaks in the mentor's answers and to build the walkthrough), but not to the *model*. After the third failed attempt or on the "I give up" button, the task is closed as failed (FSRS: Again), and only then is the walkthrough shown: the reference path next to the learner's path and a link to the chapter, explanation or documentation page (section 13.1). This is not a hint but feedback after an attempt. If the learner asks to "just tell me the answer", the mentor replies with one sentence explaining why it does not do that ("if I type it for you, there will be nobody to type it at the interview") and offers the next step.

### 16.3. Rules of behavior

- The Socratic move by default: end the answer with a question that moves the learner to the next step, not with a statement.
- Short answers: up to 120 words for "Beginner", up to 180 for the others (as in CL4), unless the learner asked for more detail.
- The learner's vocabulary: use only concepts from the list of introduced ones; a new concept is either avoided or explicitly marked and explained in one sentence.
- Analogies from the learner's previous profession, if it is stated.
- Ask for a prediction: "what do you think will happen if…", before explaining the result; in a process explanation — suggest moving a parameter or turning on "break it".
- **Networking tasks.** In the "Networks" block and in networking tasks of containers and Kubernetes, the first move is "at which layer do you think the problem is, and which command will check it?". In "the container doesn't work" tasks — "at which of the six boundaries?".
- **Documentation.** For any question about a specific flag — first `man`, `--help`, `kubectl explain` or the page from the concept card, not an answer from memory; admit uncertainty and do not invent flags. At step DL4, the first sentence of any answer is a question about where the learner has already looked.
- Do not praise for nothing and do not shame; walk through the error on its merits.
- Do not write the pet project, résumé or self-introduction for the learner in full; review what they wrote against the rubric.
- Answer in the language of the learner's interface.

### 16.4. Context the model receives

```json
{
  "mode": "docs",
  "locale": "ru",
  "learner": { "level_in_block": "beginner", "previous_job": "sales" },
  "known_concepts": ["orient.program", "linux.kernel-idea", "linux.command", "linux.process", "linux.signals"],
  "current": {
    "item": "linux.m08.drill.7",
    "goal": { "ru": "Выведи пять процессов, которые занимают больше всего памяти" },
    "solution_hidden": true,
    "hint_step_used": "H1"
  },
  "doc_ladder": { "step": "DL4", "source": "man", "sources_opened": ["man:ps(1)"], "untaught": true },
  "terminal_tail": ["$ ps", "  PID TTY  TIME CMD", " 4117 pts/0 00:00:00 bash"],
  "glossary": { "linux.process": { "ru": "Процесс — запущенная программа с номером PID" } }
}
```

The reference solution is not passed into the context at all: the model cannot give away what it does not know, and restrictions in system instructions can be broken through by persuasion. Hints H4–H5 are built from similar examples and skeletons written in advance by authors and stored in the task; the model only presents and explains them. In `docs` mode, before showing the model's answer, the engine checks it against the task's `solution_tokens` (flags are strings, so the check is cheap); a match collapses the answer, and the model receives a request to rephrase without the flag. Quality check (09 §4.6): in the set of test dialogues at DL4, the share of answers in which the model named a flag from `untaught` should tend to zero before interception and be zero after interception.

### 16.5. Honesty and workarounds

The learner's key and model are their own, and nothing prevents them from opening a chat in a neighboring tab. The product accepts this and does not build proctoring. The learning outcome is protected by the design of the tasks: checking by system state with parameterized variants, explanations graded by rubric, confidence calibration, tasks outside the course at the exam, and a direct conversation about why all this matters on the first screen of the course. An adult who pays with their own time for a career change only deceives themselves, and the product tells them this once, without lecturing.

---

## 17. Sources

### Andragogy

- EN: Knowles M. S., Holton E. F., Swanson R. A. *The Adult Learner*, 9th ed. Routledge, 2020. Overview: https://en.wikipedia.org/wiki/Andragogy
- RU: Mukhlaeva T. V. "Andragogy, classics and modernity: an analysis of the body of literature" // Chelovek i obrazovanie (Man and Education), 2025, No. 1. https://haed.elpub.ru/jour/article/download/7/6
- RU: Zmeev S. I. "Andragogy and adult education: basic concepts and terms", 1996. https://elar.rsvpu.ru/bitstream/123456789/39636/1/5-7488-0242-2_1996_029.pdf

### Cognitive load and expertise reversal

- EN: Sweller J. Cognitive load during problem solving: Effects on learning // Cognitive Science, 1988, 12(2). DOI 10.1207/s15516709cog1202_4
- EN: Kalyuga S., Ayres P., Chandler P., Sweller J. The expertise reversal effect // Educational Psychologist, 2003, 38(1). Overview: https://en.wikipedia.org/wiki/Expertise_reversal_effect
- EN: Salden R., Aleven V., Schwonke R., Renkl A. The expertise reversal effect and worked examples in tutored problem solving // Instructional Science, 2010. https://link.springer.com/doi/10.1007/s11251-009-9107-8
- RU: Chicherina N. V., Linpen Ya. Conceptualizing the notion of cognitive load // Theory and Methods of Professional Education (SPbPU), 2023, No. 4. https://tmhe.spbstu.ru/userfiles/files/articles/2023/4-2023/01_CHicherina%2C-Linpen.pdf
- RU: Butarev K. V. Cognitive load theory in teaching programming. https://school.infojournal.ru/jour/article/download/805/789
- RU: Skillbox Media. Prior knowledge and cognitive load. https://skillbox.ru/media/education/issledovanie-predvaritelnye-znaniya-ne-umenshayut-a-uvelichivayut-kognitivnuyu-nagruzku/

### Multimedia learning

- EN: Mayer R. E. Using multimedia for e-learning // Journal of Computer Assisted Learning, 2017. DOI 10.1111/jcal.12197
- EN: Mayer R. E. Multimedia Instruction. https://eddl.tru.ca/wp-content/uploads/2020/01/mayer-multimedia-instruction.pdf
- RU: Skillbox Media. Mayer's theory of multimedia learning. https://skillbox.ru/media/education/teoriya-multimediynogo-obucheniya-mayera-chto-eto-i-gde-primenyaetsya/
- RU: Skillbox Media. Not all of Mayer's principles turned out to be equally useful (meta-analysis). https://skillbox.ru/media/education/issledovanie-ne-vse-principy-mayera-okazalis-odinakovo-polezny/

### Desirable difficulties, testing, repetition

- EN: Bjork R. A., Bjork E. L. Desirable difficulties (UCLA Bjork Lab). https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/07/RBjork_inpress.pdf
- EN: APS Observer. Desirable Difficulties. https://www.psychologicalscience.org/observer/desirable-difficulties
- EN: Roediger H. L., Karpicke J. D. Test-enhanced learning // Psychological Science, 2006. https://psychology.ecu.edu/wp-content/pv-uploads/sites/216/2019/03/Roediger-Karpicke-2006.pdf
- EN: Dunlosky J. et al. Improving students' learning with effective learning techniques // Psychological Science in the Public Interest, 2013, 14(1). DOI 10.1177/1529100612453266; https://www.psychologicalscience.org/?p=81837
- EN: Butterfield B., Metcalfe J. Errors committed with high confidence are hypercorrected // Journal of Experimental Psychology: Learning, Memory, and Cognition, 2001.
- EN: Open Spaced Repetition (FSRS). https://github.com/open-spaced-repetition; ts-fsrs: https://open-spaced-repetition.github.io/ts-fsrs
- RU: Brown P., Roediger H., McDaniel M. *Make It Stick* (Russian edition «Запомнить всё. Усвоение знаний без скуки и зубрёжки»). Alpina Publisher. Overview: https://skillbox.ru/media/education/knizhnaya-polka-zapomnit-vsye
- RU: Skillbox Media. How to turn tests into a tool for remembering. https://skillbox.ru/media/education/kak-prevratit-testy-v-instrument-zapominaniya-a-ne-tolko-otsenivaniya/
- RU: Skillbox Media. Interleaving of studied topics. https://skillbox.ru/media/education/cheredovanie-izuchaemykh-tem-pomogaet-nadolgo-zapomnit-material/
- RU: Habr. What spaced repetition is (FSRS). https://habr.com/ru/post/915202

### Deliberate practice, productive failure, active learning

- EN: Ericsson K. A., Krampe R. T., Tesch-Römer C. The role of deliberate practice in the acquisition of expert performance // Psychological Review, 1993, 100(3). DOI 10.1037/0033-295X.100.3.363
- RU: Ericsson A., Pool R. «Максимум. Как достичь личного совершенства с помощью современных научных открытий» (the Russian edition of *Peak*, 2016).
- EN: Sinha T., Kapur M. When problem solving followed by instruction works: Evidence for productive failure // Review of Educational Research, 2021. DOI 10.3102/00346543211019105
- EN: Chi M. T. H., Wylie R. The ICAP framework // Educational Psychologist, 2014. DOI 10.1080/00461520.2014.965823
- EN: Ericson B., Margulieux L., Rick J. Solving Parsons problems versus fixing and writing code // Koli Calling, 2017.

### Motivation, self-efficacy, impostor syndrome

- EN: Bandura A. Self-efficacy: Toward a unifying theory of behavioral change // Psychological Review, 1977, 84(2). DOI 10.1037/0033-295X.84.2.191
- EN: Clance P. R., Imes S. A. The imposter phenomenon in high achieving women, 1978. https://www.paulineroseclance.com/pdf/ip_high_achieving_women.pdf
- RU: Sheveleva M. S. et al. The impostor phenomenon: a review of foreign research // Journal of Medical Psychology, 2023, No. 2. https://psyjournals.ru/journals/jmfp/archive/2023_n2/Sheveleva

### AI in learning

- EN: Bastani H. et al. Generative AI without guardrails can harm learning: Evidence from high school mathematics // PNAS, 2025, 122(26). https://ideas.repec.org/a/nas/journl/v122y2025pe2422633122.html; preprint: https://papers.ssrn.com/abstract=4895486
- EN: Wharton Knowledge. Without guardrails, generative AI can harm education. https://knowledge.wharton.upenn.edu/article/without-guardrails-generative-ai-can-harm-education
- EN: LearnLM Team, Google. LearnLM: Improving Gemini for Learning, 2024 (pedagogical principles for an AI tutor: active learning, managing load, metacognition, adaptation). https://arxiv.org/abs/2412.16429

### Original course plan

- "The beginner DevOps engineer checklist" (only its structure is used), `~/projects/devops-trainer/source/checklist.txt` (the resources recommended there — roadmap.sh, miminet.ru and others — are connected to concept cards as RU and EN sources).

### Subject-matter facts verified during the revision

- EN: DORA. DORA's software delivery performance metrics (five metrics; failed deployment recovery time, deployment rework rate). https://dora.dev/guides/dora-metrics/ ; change history: https://dora.dev/guides/dora-metrics/history/
- EN: The Linux Foundation. Certification resources allowed (CKA: kubernetes.io/docs, kubernetes.io/blog, helm.sh/docs, gateway-api.sigs.k8s.io). https://docs.linuxfoundation.org/tc-docs/certification/certification-resources-allowed
- EN: Kubernetes docs. Virtual IPs and Service Proxies (IPVS mode: deprecated since v1.35; nftables). https://kubernetes.io/docs/reference/networking/virtual-ips/
- EN: Kubernetes blog. Kubernetes v1.33: Continuing the transition from Endpoints to EndpointSlices, 2025. https://kubernetes.io/blog/2025/04/24/endpoints-deprecation/
- EN: Kubernetes blog. Ingress NGINX retirement, 2025. https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/
- EN: GNU coreutils manual, `rm` invocation (`--preserve-root` by default). https://www.gnu.org/software/coreutils/manual/html_node/rm-invocation.html
- EN: man-pages project: namespaces(7), cgroups(7), capabilities(7), seccomp(2). https://man7.org/linux/man-pages/man7/namespaces.7.html
- EN: Open Container Initiative. Runtime Specification (bundle, config.json, lifecycle). https://github.com/opencontainers/runtime-spec
- RU: Shotts W. «Командная строка Linux. Полное руководство». St. Petersburg: Piter (the Russian edition of The Linux Command Line), chapter "Processes".
- RU: Kubernetes documentation in Russian: "Services, Load Balancing, and Networking". https://kubernetes.io/ru/docs/concepts/services-networking/

---

## Changes after review

Reviews: `reviews/01-andragogy--by-10-assessment-career.md` (hereafter "review 10") and `reviews/01-andragogy--by-08-multimedia-engine.md` ("review 08"), plus the owner requirements R1–R12. Disputed facts were checked against primary sources (section 17, subsection "Subject-matter facts").

### What was changed

1. **Identifiers (review 10 #1, review 08 #1).** A new section 0: concepts are slugs `<block>.<name>`, codes are only table aliases; levels are `beginner/intermediate/experienced` and "Beginner/Intermediate/Experienced" (the codes `L0/L1/L2` were removed throughout the document); modules are `<block>.m<NN>`; load rules were renamed to `CL1…CL21`; career concepts are `J01…J10`. `concepts.yaml` is declared the only registry, and the glossaries of 07 and 08 are its views. The "concept / term" distinction was introduced (6.1).
2. **Priorities R1 (review 08 #10, review 10 #8).** A new section 1.1 "Three pillars and practice built on them"; in section 1, the wording about break-fix was replaced with "the main trainer format, relying on the chapter, explanations and documentation". A new section 7.1: every module has a chapter of 1,500–4,000 words as the only source of theory, screens refer to chapter paragraphs, level lenses (review 10 #29).
3. **One finish line (review 10 #4, review 08 #4).** Section 3 was rewritten: tiers `core/plus/pro`, one core final exam for all levels, per-level practice exams are allowed but do not go into the record; the three Kubernetes stages are mandatory for everyone; the linter rule "core does not require plus/pro".
4. **Order of blocks (review 10 #5, #6; review 08 #3, #19).** Section 5: Git and YAML right after Linux; Kubernetes is split into stages 1–2 before IaC and stage 3 after IaC; in IaC, Ansible comes first; the introduction was rewritten — there are now three departures from the checklist.
5. **The graph (section 6.2) was rebuilt entirely.** Group K is aligned with 05 §3 (pod before kubelet, kubeconfig after RBAC, `k8s.namespace` without requiring the Linux namespace but with `contrast_with`); HPA, taints, drain/PDB, Kustomize, headless, ServiceAccount, status and events were added (review 10 #15, review 08 #2). The kernel is introduced in plain terms as the first Linux concept (L00), the system call later (review 10 #1, review 08 #8). Linux gained `linux.net-commands` and `linux.ssh-basic`; the SSH model in networks became `net.ssh-protocol`. In networks, the frame and MAC come before IP. Prerequisites that taught a wrong model were fixed: Service no longer requires a reverse proxy, `-p` requires netfilter, Deployment is linked to CI strategies through `contrast_with` (review 08 #9). Methodology is owned by 07; SLO is split into `method.slo` and `obs.slo-promql` (review 08 #5).
6. **R6 — isolation in Linux (review 10 #2, review 08 #13).** The module "How the kernel isolates and limits": L33–L41 (fork/exec, threads, all eight kinds of namespaces, cgroups v2 with OOM, capabilities, mount and chroot, overlayfs, seccomp at the level of the idea, the "container by hand" summary), core for all levels; the "specific before general" paragraph was reversed. The `p.lin.isolation` explanation (9.3.1), the OOM and "container by hand" trainers (13.2), a DL4 task on `TasksMax`.
7. **R7 — containers (review 10 #2, #10; review 08 #14, #21).** Group D no longer introduces kernel mechanisms: added the OCI bundle, the full runtime chain with the shim and crun, states, PID 1 and signals, the log path, identity and userns, the six-boundaries model, the "towers" explanation with a continuation in K52; trainers on the six boundaries scored 0.3/0.7; practice on v86 (`dmesg`, "inside and outside", stopwatch).
8. **R8 — networks (review 10 #11, review 08 #15).** A map of the internet, envelopes with real fields, AS/BGP, the DNS hierarchy, CDN, "which layer is broken", tunnels, VLAN, overlays, modern HTTP, mTLS; a protocol catalog with a single-format card and tiers per R8; the mentor's first move in networking tasks is a question about the layer.
9. **R9 — Kubernetes networking (review 10 #12, review 08 #16).** The `k8s.net.*` section of twelve concepts as one piece: the model, the packet path on a node and between nodes, Service, EndpointSlice, kube-proxy (iptables, nftables, eBPF; IPVS — in one sentence as deprecated), DNS and ndots, NodePort/LB, Ingress as legacy, Gateway API, NetworkPolicy, the debugging method; the explanations `p.k8s.pod-network`, `p.k8s.service-path` (9.3.4), `p.k8s.dns-ndots`; the iptables-trace and "the pod could not reach" trainers.
10. **R10 — the reconciliation loop (review 10 #9, review 08 #17).** Concepts K03, K40, K41; a nine-step storyboard (9.3.3); the "Your own controller" lab: bash for the core, TypeScript for `plus`, a check with event loss and two instances; a bridge to a Go operator; requirements for kube-lite passed on to 05 and 09.
11. **R11 — several machines and the hybrid (review 10 #13, review 08 #18).** `device` in the learner model, `env_min` and `requires_nodes` in a task, substitution with the simulator on a weak device, concepts K53 and K61, the "A node went down" trainer (13.2, 13.4).
12. **R12 — three stages (review 10 #14, review 08 #19).** Concepts of stages 2 and 3 (K48, K49, K32, K50, K65, K51, K54, K55, K56, I15), the stages table in 13.3, the `cost` and `cleanup` lesson steps with the cleanup check from the learner's machine (7.4).
13. **R2 — the documentation ladder (review 10 #3, #17; review 08 #11, #12, #30).** A new section 11: five steps DL1–DL5, a start by level, climbing by module position with carry-over between blocks and advancing early based on results, tasks for every step in every block, the `docs`/`untaught`/`solution_tokens` format, the linter, minimums, the CKA allowlist, the corpus and licenses. The exception to the order rule for flags is recorded in 6.1. The mentor got a `docs` mode and flag interception (16.1, 16.4).
14. **R3–R5 — process explanations and the visual language (review 10 #7, review 08 #20, #22, #28, #29).** A new section 9: the explanation contract, a catalog of 32 mandatory explanations across all blocks, four full storyboards. Rules CL8–CL10 were rewritten (no ink, parallax, autoplay or narration), CL11 was clarified ("an explanation introduces no more than one concept"), CL12 allows controlling an explanation together with input, CL16 (semantic color), CL17–CL20 (mandatory explanations and their design) and CL21 (typography) were added. Mayer's modality principle was removed from the list of those carried over into the product.
15. **The L17 lesson example (review 08 #23).** Screen 1 became a process explanation with a slider, cards and "break it"; DL1 labels; the RU source was replaced (the `ps` page on opennet is in English); the reason for `ps -C` is stated honestly; the word "kernel" is used via L00.
16. **Placement checks (review 10 #16, review 08 #7, #31).** 4.1 — a single principle with mandatory numbers, the check cannot be skipped, "explain" tasks are not key and use no neural network; 4.2 — an example in the 09 contract, the `number` type; 4.3 — a template brought in line with these numbers (each block has at least two practical key tasks).
17. **Mentor (review 08 #25).** One hint scale H0–H5; there is no "show solution" button during an attempt, the walkthrough comes after the third failure or "I give up"; length 120/180 words.
18. **Time budget (review 10 #18, review 08 #27).** A formula instead of "40–45 minutes per concept", a table for the new blocks; the total is ≈ 480 / 330 / 215 hours.
19. **Minor factual corrections.** DORA — five metrics with the new names (review 10 #23, review 08 #6; checked against dora.dev). `rm -rf /`: on GNU coreutils it is refused due to `--preserve-root`; the demonstration was replaced with `rm -rf ~/*` and restoring, and the discussion of `--preserve-root` was moved to L12 (review 10 #19, review 08 #24). Leaked secret: the check requires changing the secret (review 10 #20). EndpointSlice instead of Endpoints, nftables instead of IPVS in the rubrics (review 10 #21, review 08 #34; checked: Endpoints is deprecated since v1.33, IPVS since v1.35). The `unshare` task was moved to the Linux "Experienced" check with checking by `NSpid` (review 10 #22, review 08 #13). The full list of namespace kinds (review 10 #26). `sudo ss -ltnp` in the networks check (review 10 #27). The `trainer-check` code via a ConfigMap (review 10 #28). The definition of `mastered` was consolidated into one (review 10 #24, review 08 #38). The wording of the time criterion (review 10 #25). `envs` for dsim and netlab tasks, REJECT counts as "closed" (review 08 #32, #33). The "Experienced" profile in Kubernetes was aligned with 05 (review 08 #36). Onboarding and terminal five-minuters (review 08 #35). Pairs for interleaving in review (review 08 #37). The wording about the Bastani result was softened to the precise one; the primary LearnLM report was added; "Similar people" — only text and photographs with consent (review 08 #38).

### What was rejected or partially accepted, and why

- **Kubernetes stage 3 as `plus` for the "Beginner" (review 08 #19) — rejected.** R12 lists three stages without division by level, and installing kubeadm is the first place where a beginner sees the control plane with their own hands and what they will be asked about at an interview. Stage 3 is core for everyone; the relief for a beginner comes from support (step-by-step guidance, S0–S1), not from excluding the stage.
- **seccomp as `plus` (review 08 #13) — rejected.** R6 explicitly requires seccomp in Linux at the level of the idea; the idea is one screen and one command, and it is needed to understand the default profile in containers. Concept L40 is core.
- **A cloud VM at the end of the "Networks" block (review 10 #1, #11) — rejected in favor of the review 08 #8 option, but with the core tier rather than the extension.** The first VM is needed before networks — in the optional Linux exam at tier C; and the networks exam on two VMs requires it mandatorily, so L44 is core Linux.
- **Kubernetes networking "right after Pod and ReplicaSet, before Deployment" (review 08 #16) — the position was changed.** The section comes after the control plane: the explanation of kube-proxy and of the packet path relies on the node and the kubelet (K08, K27), and EndpointSlice relies on controllers. The order of 05 (Deployment before Service) is preserved; the R9 requirement "a large separate section" is met by the twelve concepts coming as one piece.
- **OCI bundle after the runtime chain (review 08 #14) — the order from review 10 was accepted.** First the object (the bundle: the root and `config.json`), then the chain of programs that execute it: otherwise, in the `docker run` explanation, the arrow "runc reads config.json" would lead to a concept not yet presented.
- **Climbing the documentation ladder only by results (review 10 #3) or only by module position (review 08 #11) — combined.** The position guarantees that forcing will happen for everyone (the R2 requirement); results let a strong learner climb earlier; the step is never lowered (review 10).
- **The share of out-of-course tasks at the exam (review 10: one of 3–5, up to 25%; review 08: 10–20%) — 10–25% of the weight was accepted.** The lower bound guarantees that such a task is always present; the upper bound guarantees that the exam remains a check of the course.
- **Norms of 1.5 / 0.9 / 0.4 h per concept (review 10 #18) — partially accepted.** After the graph was rebuilt there are ~265 concepts instead of 195, and the 1.2 h norm with coefficients of 0.6 and 0.3, plus separate norms for stages on real VMs, gives the same total for the "Beginner" (≈ 480 h) as the review's estimate, but it is derived from the graph rather than set.
- **A separate concept `cloud.cost-cleanup` (review 10 #14) — rejected.** Cost and cleanup are a procedure repeated in every lesson with a VM, not a concept to memorize; they became the mandatory lesson steps `cost` and `cleanup` (7.4), and knowledge of them became part of L44.
- **Checking the controller with the loss of half the events for the core (review 10 #9) — moved to `plus`.** The core writes the controller in bash (review 08 #17), and a loop with periodic polling is not subscribed to events and converges by construction; event loss is checked for the TypeScript version with watch, where it is meaningful.
- **A separate concept for static pods K47 (review 10 #15) — merged into K32.** At a junior interview, static pods are asked about in the context of kubeadm (`/etc/kubernetes/manifests`); a separate lesson is not needed.
- **The "exam with an assistant" item from 10 §0 item 8 (review 08 #11)** — not rejected but clarified: it is DL5 mode with documentation; the change in 10 is up to its author.

### What other documents must change (passed on to their authors)

- 02: split module L16 (`linux.m16`) into "The kernel and /proc" and "Isolation and limits" (for all levels); introduce the kernel in plain terms in the first module (`linux.m00`); a lightweight node image for 3–4 machines; `man-db` and `manpages` in `lab-debian`; check the RU links to opennet (the manual pages there are in English).
- 03: start the block with the map of the internet; the protocol catalog in card format; several v86 machines are no longer "unacceptable" (R11).
- 04: remove the introduction of namespaces and cgroups (`uses` instead of `introduces`); add D24–D30 and the six-boundaries trainers; the third tower goes to 05.
- 05: Kubernetes networking as one section after the control plane; three mandatory stages; B/I/E exams → core final exam + a `pro` part; `kubectl explain` from OpenAPI and the controller lab requirements in kube-lite.
- 06: A0 only repeats methodology (`uses`); Ansible before Terraform is kept; I15 for stage 3.
- 07: owner of group M; DORA — five metrics.
- 08: remove ink, characters and metaphor scenes (CL9); the `number` type; the `protocol-card` and `process` widgets per the 9.1 contract.
- 09: the H0–H5 hint scale instead of `hintLevel`, no "show solution" button; `solution_tokens` interception; the documentation corpus.
- 10: a reference to the single check principle (4.1), one final exam and three stages (3.3, 13.3); the fields `doc_ladder`, `docs.untaught`, `docs.ref`; the misconception `cicd.secret-removed-from-head`.
