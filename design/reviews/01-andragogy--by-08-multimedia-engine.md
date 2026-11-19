# Review of 01-andragogy.md

Reviewer: author of 08-multimedia-engine.md (the interactive textbook engine, visual language, process explanations). Date: 18.11.2026.
Subject: `design/01-andragogy.md` as of 18.11.2026 15:26. Documents 02–10 were read to check consistency. External facts were checked: DORA (dora.dev), the list of resources allowed during the CKA (docs.linuxfoundation.org), the `ps` page on opennet.ru.

## Verdict

The research part of the document is strong, and I would keep almost all of it: the learner model, concept states, the S0–S5 support ladder, FSRS, confidence calibration, the constrained tutor. But as the "single source of truth" for concept order the document does not work right now, and it does not yet account for the owner's requirements R1–R12. There are five main problems.

1. Identifiers collide. The level codes `L0/L1/L2` coincide with the Linux concept identifiers `L01…` and with the modules `L0…L16` in 02. The concept numbers `D01…`, `K01…`, `N01…` coincide with the module numbers in 03/04/05. And 08, 09, 03 and 05 refer to terms by slugs altogether (`pid-namespace`, `service`).
2. The concept graph diverges from the order in the block documents: Kubernetes, Git/YAML, the place of namespaces/cgroups. It lacks entire sections required by R6–R12.
3. The principle "one finish line for all levels" contradicts 02, 05 and R8: different exams, modules only for I/E, protocols by level. This must be resolved explicitly.
4. There is no documentation ladder (R2) in the document. The tutor and the hints point back to the lesson screen, not to man and docs.
5. The lesson anatomy and the load rules allow what R4/R5 forbid (ink, parallax, voice-over, autoplay), and do not require a process explanation in every block (R3). Also, short 120-word screens do not add up to a coherent textbook (R1).

Below are 38 findings: 10 blocking, 19 major, 9 minor. Where possible, I give ready-to-paste text.

---

## A. Identifiers, the graph and consistency with other documents

### 1. BLOCKING. Identifier namespace collision
**Where:** §2.3 (data format), §3 (level codes), §6.2 (graph), §8 (rules R1–R15).
**What is wrong.** The same string means different things:
- `L0` is the "Beginner" level (01 §3) and at the same time the module "Computer, OS, terminal" (02 §5.1). `L11` is the concept "rwx permissions" (01) and the module "Services and logs" (02).
- `D10` is the concept "docker CLI → dockerd… architecture" (01) and the module "Docker under the hood" (04). `K10` is "Labels and selectors" (01) and the module "Access and security" (05). `N8` in 03 is DNS, and `N08` in 01 is also DNS, but `N10` in 03 is Netfilter, while in 01 it is DHCP.
- `R1…R15` are the cognitive load rules, `R01…R10` are the concepts of the career block. At the same time the owner also calls their requirements `R1…R12`.
- Levels are named differently in each document: `L0/L1/L2` (01, 10), `Н/С/О` (Beginner/Intermediate/Experienced in Russian abbreviations; 02, 04), `beginner/intermediate/experienced` (08, 09), `B/I/E` (05).
- References to concepts also differ: `K09` (01), `[[process]]` with a module number (02), `[[ip-address|…]]` (03), `[[namespace|…]]` (04), `glossary.yaml` with slugs (07, 08), `known_concepts: ["L17"]` (01 §14.4) versus `Already introduced: process, pid, namespace` (09 §4.5).

If left as is, the term-order linter cannot be built: it does not know which registry is the primary one.

**Fix (ready text for §6.1):**
> **Identifiers.** A concept is identified by a slug `<block>.<name>` (`linux.process`, `net.dns`, `k8s.pod`). The slug is stable, human-readable, and used in `[[…]]` links, in `uses/introduces`, in the tutor context and in the task bank. The short code (`L17`) remains only as the `code` field for this document's tables and is not used in content. Learner levels: `beginner | intermediate | experienced` in data, "Beginner / Intermediate / Experienced" in the interface. The codes `L0/L1/L2` are not used. Block modules are numbered `<block>.m<NN>` (`linux.m08`). The cognitive load rules are renamed `CL1…CL15`. The only registry is `content/concepts.yaml`: the glossaries of 07 (`glossary.yaml`) and 08 (§7.3) become views of this file rather than separate sources.

Two-level granularity is also needed. 01 has 195 concepts, while the block documents have about 600 terms: ~150 in 02 §5.1, ~100 in 03 §3, 46 items in 05 §3. I propose `concept` (the unit of FSRS and mastery) and `term` (the unit of the linter; a term has a `concept:` field). Rule CL1 "≤ 1 new concept per screen" applies to concepts, while up to three terms are allowed per screen, all of them belonging to the concept being introduced. Without this, the flagship DNS scene (08 §6.3, scene 2 introduces DNS, resolver, root server, record, TTL) violates CL1, although in meaning it is a single concept, "DNS resolution".

### 2. BLOCKING. The Kubernetes graph contradicts the order in 05
**Where:** §6.2, group K.
**What is wrong.** 01 introduces `K07 scheduler` and `K08 kubelet/CRI` before `K09 Pod`, and `K05 kubeconfig/context` as the fifth concept. In 05 §3 Pod comes fourth (K1), scheduler and kubelet fifteenth and sixteenth (K3), "a component is introduced when what you see cannot be explained without it", and kubeconfig thirty-seventh (K10). `K13 Namespace` requires `D03`, while in 05 namespace (No. 9) does not rely on D03. 01 lacks Gateway API, EndpointSlice, NetworkPolicy, HPA, PDB and Kustomize, although they are in 05. Kubernetes is the heaviest block in the graph. If 01 remains the source of truth, it must be aligned with 05, because the order in 05 is pedagogically better: first the observable, then the mechanism.
**Fix.** Take the table in 05 §3 as the basis for group K. Add the concepts from findings 16 and 17 (Kubernetes networking and the three stages). Change the prerequisite of `k8s.namespace`: `requires: [k8s.manifest]`, plus an explicit "contrast card" with `linux.namespaces` (a `contrast_with` dependency, not `requires`). Then lesson 05 K2 can be completed without opening D03, and the difference between the homonyms is still shown.

### 3. BLOCKING. The place of Git and YAML: 01 and 06 contradict each other
**Where:** §5 (block order), §6.2 L31 and group C.
**What is wrong.** According to 01, Git is introduced at the start of the CI/CD block, after Docker, and YAML (`L31`) is part of Linux. According to 06 §0.1, Git (G) and YAML (Y) come as separate modules after Linux and before networks, because "Dockerfiles and compose files live in repositories". One of the two decisions has to go.
**Fix.** Adopt the 06 variant: G and Y after Linux. The argument in 06 is stronger, and moreover R7 and R12 require working with a repository at the Docker stage and in the pet project. Insert a row in §5: "2a | Git and YAML | — | Needed with Docker: Dockerfile, compose and manifests live in a repository; requires only files, an editor and a shell". Move `C01–C06` and `C15` to a new group `git.*`, and `L31` to `yaml.*`. Rewrite the paragraph about the second deviation from the checklist (line 5 of the document).

### 4. BLOCKING. The "one finish line" principle is not followed in any block document
**Where:** §3 (the decision "that holds the whole structure together"), §11.2.
**What is wrong.** In 05 §9 there are three different exams: B (6 tasks, 45 min), I (10 tasks, 90 min), E (16 tasks, CKA). The real stage there also differs: k3s for the beginner, kubeadm for the experienced. In 02 module L16 (kernel, namespaces, cgroups) is marked "I, E", meaning the beginner does not take it. In 04 the beginner has "D2 simplified version, 4 rooms". R8 explicitly sets protocols by level: BGP, VXLAN, IPsec only for the experienced. So either the principle is wrong, or five documents are wrong.
**Fix (ready text for §3):**
> **Core and extensions.** Every block has a *core* (`tier: core`): concepts and a practical exam that are the same for all levels. The level changes the entry point and the amount of support, but not the core. Above the core there are extensions `tier: plus` (default for Intermediate and Experienced, optional for Beginner) and `tier: pro` (default for Experienced). An extension has its own exam part, taken separately. Its result goes into the skill map, not into "block passed". After passing the core, a Beginner sees a "continue to Intermediate" button. Everything that subsequent blocks rely on must be in the core: for example, namespaces and cgroups are needed by Docker, so they are Linux core for all levels (see finding 13).

Along with this, a `tier` field is needed in the concept schema (§6.1) and a linter rule: a `core` concept cannot require a `plus/pro` concept. 05 §9 must recast exams B/I/E as "core (B) + plus (I part) + pro (E part)".

### 5. MAJOR. Methodology is introduced three times
**Where:** §6.2 group M, O09.
**What is wrong.** CI, Continuous Delivery, Continuous Deployment and DORA are introduced in 01 (`M14–M16`, `M13`), in 06 §1 (block A0) and in 07 §3 (No. 34–39). SLI/SLO/error budget appear both in 07 (M9, No. 42–43) and in 01 as `O09` in monitoring. The rule in 08 §7.3 item 2 ("a term is introduced in exactly one place") will not let the build pass.
**Fix.** Make 07 the owner of group M (it has the most detailed order, 50 items). Reduce 06 A0 to "a recap with a link" (`uses`, not `introduces`). Split `O09` into two parts: `method.slo` (the idea, introduced in 07 M9) and `obs.slo-in-promql` (SLI as a PromQL query, burn rate), which is introduced in monitoring and requires `method.slo`.

### 6. MAJOR. DORA: the L2 check uses an outdated model
**Where:** §4.3, "Methodology", the L2 check, task 1.
**What is wrong.** The task asks to "mark the four DORA metrics among eight", and "time to restore" counts as correct in it. Since the 2024 report DORA has five metrics: change lead time, deployment frequency, failed deployment recovery time (formerly time to restore, with the scope narrowed to failures caused by deployments), change fail rate and deployment rework rate (https://dora.dev/guides/dora-metrics-four-keys, https://dora.dev/guides/dora-metrics/history/). 07 §3 No. 39 already gives five, which means the 01 task will give a wrong answer key to a learner who has gone through 07.
**Fix.** "**T, choose 5 of 9.** Mark the five DORA metrics: change lead time, deployment frequency, failed deployment recovery time, change fail rate, rate of unplanned (corrective) deployments. Distractors: test coverage, number of commits, velocity in story points, uptime. The debrief separately explains why 'time to restore service' was renamed and narrowed."

### 7. MAJOR. The check format does not match the 09 contract
**Where:** §4.2 (`check: all: - file_mode … - stdout_contains`), §14.2 (H1–H5).
**What is wrong.** 09 §2.3–2.4 has a single contract: facts, a `when` predicate, `keep`, `fail[]`, `envs`. 08 §3.8 has widget types `choice/order/match/hotspot/predict/fill/explain/task`. 01 has its own check vocabulary and a `number` type that exists neither in 08 nor in 10. The hint ladder: in 01 it is H1–H5, in 09 `hintLevel: 0|1|2|3`, where 3 means "answer revealed". At the same time 01 forbids a ready solution at any step (see finding 25).
**Fix.** Rewrite the example in §4.2 in the 09 contract:
```yaml
id: linux.place.int.4
block: linux
level: intermediate
kind: task
key: true
concepts: [linux.permissions, linux.script]
time_norm_s: 120
prompt: { ru: "Сделай скрипт ~/deploy.sh исполняемым для владельца и запусти его.", en: "Make ~/deploy.sh executable for its owner and run it." }
setup:
  files: [{ path: /home/learner/deploy.sh, mode: "0644", content: "#!/bin/sh\necho DEPLOY-{{token}}\n" }]
goals:
  - id: g1
    needs: [files, cmds]
    when: "files[path=/home/learner/deploy.sh].mode.owner_x=true && cmds[exit=0].stdout~'DEPLOY-{{token}}'"
    fail:
      - if: "files[path=/home/learner/deploy.sh].mode.owner_x=false"
        say: { ru: "Файл всё ещё не исполняемый: посмотри первую колонку ls -l", en: "..." }
        term: linux.permissions
variants: 4
```
Add the `number` type to 08 §3.8 (numeric input with a `tol` tolerance), otherwise there is nothing to put tasks like "how many ERROR lines", "median in days" and "43.2 minutes" on. Reduce the hint scales to one (see finding 25).

### 8. MAJOR. Term order violations across documents: "cloud VM" and "kernel"
**Where:** §6.2 `K31`, `L27`; §5.
**What is wrong.**
- `K31 Cloud VM: ordering, access, network` is introduced in Kubernetes. But the learner orders a cloud VM earlier: in 02 tier C ("optional final Linux exam"), in 03 decision 4 (the networks exam on two cloud VMs), in 04 D11 ("Real Docker on a VM"). The term is used two or three blocks before it is introduced.
- `L27 Kernel` comes after `L17 Process`, and the L17 lesson example deliberately avoids the word "kernel". But 02 introduces "kernel" in the very first module L0, and for the beginner at that. The phrase in the example, "the kernel is not introduced here", does not match 02.
**Fix.** Move `cloud-vm` (ordering, SSH key, public IP, cost, deletion) to Linux as an extension module after SSH (`linux.vps`, requires `linux.ssh`). In Kubernetes, keep only "several VMs in one network". Introduce the kernel as in 02: in L0 at an everyday level ("the kernel is the part of the OS that manages the hardware and starts programs"), with a separate concept `linux.syscall` later. The L17 lesson example can then say directly "the kernel creates the process", which is more honest.

### 9. MINOR. Prerequisites that teach the wrong model
**Where:** §6.2.
- `K14 Service` requires `N19 Reverse proxy`. This presents Service as a proxy, although in iptables/nftables mode there is no proxy at all: it is DNAT in the kernel (05 E6 tests exactly this). Replace with `requires: [k8s.labels, k8s.pod-network, net.nat, net.netfilter]`.
- `D12 Port publishing` requires `N11 NAT` but not `N17 iptables`. R7 requires showing `-p` as a DNAT rule, so `net.netfilter` must be added.
- `K12 Deployment` requires `C14 Deployment strategies`. If Git and CI come earlier, this is acceptable, but rolling update in Kubernetes is better introduced on its own, with C14 made `contrast_with`.
- `D02 VM and hypervisor` requires only `F01, F04`, although for L1 and L2 the F concepts are not introduced and, per §2.2, become `placed`. State explicitly in §3: passing the three "Orientation" control questions puts F01–F12 into `placed`.

---

## B. Owner requirements R1–R12

### 10. BLOCKING. R1: the product priorities in the document are different
**Where:** §1 (Ericsson: "the cross-cutting trainer format is break-fix"), §7, §8 CL4.
**What is wrong.** The document builds everything around practice and trainers. The textbook (coherent theory), process explanations and the habit of reading documentation are not named as the core. Theory is step 4 of a lesson, sized "1–3 screens of 120 words". A coherent textbook does not add up from such pieces: rule CL4 and requirement R1(a) pull in different directions.
**Fix (new §1.1, ready text):**
> **Priorities.** The course rests on three pillars, and practice relies on them. (1) *The textbook*: coherent theory in strict order of introducing entities. Every module exists as a continuous chapter that can be read straight through. (2) *Process explanations*: in every block, mechanisms are shown as a step-by-step process, with parameters and "break it". (3) *Documentation*: the habit of looking for the answer in man, `--help`, `kubectl explain` and the official documentation grows from "flicker" to enforcement (section 9a). Practice (trainers, breakages, exams) tests and reinforces these three pillars but does not replace them: a task that cannot be solved by relying on the chapter, the process explanation or the documentation is a design error.

And the single-source rule (in §7):
> The theory of a module is written as one chapter (`chapter.yaml`, paragraphs with `claims` and sources). Lesson screens contain no theory text of their own: they reference paragraphs of the chapter (`text: chapter#p4`). "Textbook" mode shows the whole chapter, in a magazine layout, with process explanations as embedded figures. "Lesson" mode shows the same paragraphs in portions according to CL4. So 120 words per screen and coherent text are one and the same text.

### 11. BLOCKING. R2: there is no documentation ladder
**Where:** no section. Nearby places: §9 (S0–S5), §14.2 (H3 "link to the lesson screen"), §14.3 ("first man or --help").
**What is wrong.** Requirement R2 is implemented nowhere. Hint H3 leads back into the lesson, not into the documentation. There are no "use what was not in the theory" tasks at all. An "official documentation only" exam is not described. On top of that, 10 allows an exam "with an assistant" (§0 item 8), while 01 and 09 do not.
**Fix: a new section "9a. Documentation ladder", ready text.**

> ### 9a. Documentation ladder
>
> The habit of reading documentation is the third pillar of the course (section 1.1). A beginner cannot be sent into man from the first lesson: a manual page in an unfamiliar language of concepts only adds extraneous load. So documentation appears in five steps. A step is a property of the "learner × block" pair, like the level.
>
> | Step | What the learner sees | Where the documentation is in the interface | How it is checked |
> |---|---|---|---|
> | DL1. Flicker | Every command and option in an example has a source label "where this comes from": `man 1 tail → -n`, `kubernetes.io → Pod lifecycle`. The label leads to the exact place (the option anchor, the page section). Opening it is optional | A label next to the element (spatial contiguity), opens in a built-in viewer over the lesson | Not checked. The open counter goes only to the log |
> | DL2. Page anatomy | A hint at level H2–H3 is a *fragment* of a documentation page with the relevant line highlighted. Above the fragment is a mini-map of the page: NAME, SYNOPSIS, DESCRIPTION, OPTIONS, EXAMPLES, SEE ALSO; the current section is highlighted. Once per module, a task "find in SYNOPSIS whether the argument is required" | A fragment in the hint, the full page via a button | Anatomy tasks are `hotspot` over page sections |
> | DL3. Find the flag | Task: "find the option that does X". Only a link to the page (or the command `man ss`) is given, no content hints. The result is checked by the action, not by the text of the flag | Only a link to the page | A predicate on the effect (`ss` showed the PID → the output contains `users:(…)`) |
> | DL4. Enforcement | The task requires commands or options that are not in the theory (`untaught: true`). No content hints. The tutor is in `docs` mode: its first move is to ask "where did you look?" and to direct to man, `--help`, `kubectl explain`, docs.docker.com, but not to name the flag | Viewer and terminal; built-in search over the documentation corpus | A predicate on the effect. The engine checks the tutor's answer against the task's `solution_tokens`: if the flag is there, the answer is collapsed and the tutor rephrases |
> | DL5. Exam | Only the official documentation from the block's allowlist is open (modelled on the CKA). The tutor is off. 10–20% of tasks are built on what was not in the course | Built-in viewer with an allowlist | As an exam (section 11.2) |
>
> **Start and progression.** The starting step in a block: Beginner — DL1, Intermediate — DL2, Experienced — DL3. If in the previous block the learner reached step *k*, in the new block they start no lower than *k − 1*: a beginner who reached DL4 in Linux does not go back to flicker in Docker. Progression within a block follows the module position, not the answers:
>
> | Part of the block | Beginner | Intermediate | Experienced |
> |---|---|---|---|
> | First third of modules | DL1 | DL2 | DL3 |
> | Second third | DL2 | DL3 | DL4 |
> | Last third and breakage trainers | DL3, DL4 in the last module | DL4 | DL4 |
> | Block exam | DL5 | DL5 | DL5 |
>
> **Minimums checked by the build.** Every technical block has at least 6 DL3 tasks, 4 DL4 tasks (`untaught: true`) and 2 DL5 problems in the exam. Every DL3–DL5 task has `docs.ref`, an anchor where the answer actually is. CI checks that the anchor exists in the corpus mirror (a broken link fails the build).
>
> **Relation to the term-order rule.** A flag or command that is looked up in the documentation is not a concept of the graph. It does not appear in the task text; the task is phrased using concepts already introduced. The documentation page itself is not subject to the order rule: it is external text, and the learner learns to navigate it while skipping the unfamiliar. So that this is not a shock, the first opening of a full page at DL2 is accompanied by one screen "how to read a manual page that has a lot of unfamiliar things in it".
>
> **Format in a task:**
> ```yaml
> docs:
>   ref: { kind: man, page: ss, section: 8, anchor: "-p" }     # or { kind: url, url: "https://kubernetes.io/docs/reference/kubectl/generated/kubectl_logs/", anchor: "options" }
>   untaught: true                  # for DL4–DL5: the solution requires something not in the theory
>   solution_tokens: ["-p", "--processes"]   # what the tutor must not name
> ```

This section needs three edits elsewhere in 01:
- §14.1: add a `docs` mode (DL4) with the rule "first move is a question 'where did you look, what did you find?'; second is to name the *source* (page, section), but not the line; never name the flag".
- §14.2: H3 depends on the step. At DL1–DL2 it is a documentation fragment with highlighting, at DL3 only the page name, at DL4 there are no content hints, only the question of where the learner searched.
- §11.2: the exam runs in DL5 mode, documentation only from the built-in viewer. Fix 10 §0 item 8: the exam "with an assistant" is DL5 mode with documentation, not with a neural network. Otherwise there is a contradiction with 01 §14.1 and 09 §4.5.

### 12. MAJOR. R2: documentation ladder tasks per block (ready)
**Where:** new section 9a, appendix.
I propose one task per step in each block. These are samples for block authors. The predicates are written in the 09 contract.

**Linux.**
- DL1. Example `tail -n 5 app.log`; the label on `-n` leads to `man 1 tail`, section OPTIONS, line `-n, --lines=[+]NUM`.
- DL2. Hint for "show the service log for the last hour": a fragment of `man journalctl` with the line `-S, --since=, -U, --until=` highlighted, OPTIONS highlighted on the mini-map. Anatomy task: "in SYNOPSIS `journalctl [OPTIONS…] [MATCHES…]`, are MATCHES required?" (`hotspot` on the square brackets).
- DL3. "Find the `ss` option that shows which process is listening on a port". A link `man 8 ss` is given. Predicate: `cmds[argv0=ss][exit=0].stdout~'users:(('`.
- DL4. "Print the process tree together with command-line arguments". `pstree -a` was not given in the theory. Predicate: `cmds[argv0=pstree].argv~'-a' || cmds[argv0=ps].argv~'--forest'` (we accept both paths).
- DL4 (isolation, R6). "Run `sleep 1000` so that it cannot create more than 5 processes, without touching /sys/fs/cgroup by hand". `systemd-run --scope -p TasksMax=5` is not in the theory. Predicate: `cgroups[procs~@pid(sleep)].pids.max=5`.
- DL5. Exam: "configure application log rotation once a day, keep 7 copies" (`man logrotate.conf`).

**Networks.**
- DL1. The label on `dig +short` leads to `man dig`, section query options.
- DL2. A fragment of `man ip-route` with the line `via ADDRESS` highlighted.
- DL3. "Find the `curl` option that shows the time of each connection stage". Both `-w` and `--trace-time` are accepted. Predicate on the output: it contains `time_connect` fields or timestamps.
- DL4. "Find out the path MTU to `api.lab`, without tools not in the theory". `tracepath`, or `ping -M do -s`. Predicate: the entered number matches the scenario's MTU.
- DL5. "Limit incoming SSH connections to 3 new ones per minute" (`nft` limit or `iptables -m hashlimit`; the netfilter documentation/nftables wiki is on the allowlist).

**Containers.**
- DL1. The label on `-p` leads to docs.docker.com, the `docker container run` page, section `--publish`.
- DL2. Hint for "the container must restart when it crashes": a fragment of the `--restart` reference with the line `on-failure[:max-retries]` highlighted.
- DL3. "Find how to show only the IDs of all containers". A link to `docker container ls`. Predicate: `cmds[argv~'ls|ps'][argv~'-q|--quiet']`.
- DL4. "Copy a file from a stopped container to the host" (`docker cp`; it was not in the theory). Predicate: the file is on the host, the hash matches.
- DL5. "Build an image for two platforms" (`docker buildx build --platform`), docs.docker.com on the allowlist.

**Kubernetes.**
- DL1. The label on `spec.replicas` leads to `kubectl explain deployment.spec.replicas` and to kubernetes.io.
- DL2. A hint for probes is the output of `kubectl explain pod.spec.containers.readinessProbe` with the line `initialDelaySeconds` highlighted. Anatomy: "where in the `kubectl explain` output is the field type, and where is the description".
- DL3. "Find how to list pods together with the node they run on". A link to `kubectl get --help`. Predicate: `cmds[argv0=kubectl].argv~'-o wide'` or `custom-columns` with `.spec.nodeName`.
- DL4. "Make the pod not run on node `node-2` without changing the node's labels" (a taint with a toleration-less pod, or nodeAffinity `NotIn` on `kubernetes.io/hostname`). Predicate on the placement facts.
- DL5. Like the CKA. Allowlist: `kubernetes.io/docs`, `kubernetes.io/blog`, `helm.sh/docs`, `gateway-api.sigs.k8s.io`. This matches the official LF list for the CKA (https://docs.linuxfoundation.org/tc-docs/certification/certification-resources-allowed). The LF page states explicitly that search on kubernetes.io/docs is allowed, but external results must not be opened. Check the list at build time; it changes.

**CI/CD, IaC, monitoring.** The same scheme: DL3 — "find the `.gitlab-ci.yml` key that runs a job only when files in `app/` change" (`rules:changes`); DL4 — "make Terraform not delete the database on recreation" (`lifecycle.prevent_destroy`, if it was not in the theory); DL4 for monitoring — "find the PromQL function that predicts the disk filling up in 4 hours" (`predict_linear`).

### 13. BLOCKING. R6: "How the kernel isolates and limits" is missing from Linux
**Where:** §6.2 groups L, N, D; §5 (rationale for the Docker order).
**What is wrong.** Namespaces (`D03`), cgroups (`D04`), chroot (`D05`) and overlayfs (`D09`) are introduced in the Docker block. Threads, `fork/exec`, capabilities and seccomp are not in Linux. R6 requires that everything the containers block relies on be introduced in Linux. In 02 module L16 partially covers this, but only for I and E, and without capabilities, overlayfs and seccomp. 04 §2 also introduces namespaces and cgroups on its own (D2).
**Fix: new rows for group L, insert after L27.** All rows are `tier: core` except those marked.

| ID (code) | Slug | Concept | Requires |
|---|---|---|---|
| L33 | `linux.fork-exec` | How a process is born: `fork`, `exec`, PPID, the process tree, lookup via `PATH` | L16, L17, L27 |
| L34 | `linux.thread` | Thread and process: threads share memory; `/proc/<pid>/task`, `ps -eLf`, the LWP and NLWP columns | L26, L33 |
| L35 | `linux.namespaces` | Namespaces: pid, mnt, uts, net, ipc, user, cgroup; `unshare`, `nsenter`, `/proc/<pid>/ns`, `lsns` | L26, L27, L33 |
| L36 | `linux.cgroups` | cgroups v2: `/sys/fs/cgroup`, `memory.max`, `cpu.max`, `pids.max`, `cgroup.procs`; the OOM killer; systemd slices (`systemd-cgls`) | L23, L26, L35 |
| L37 | `linux.capabilities` | Kernel privileges instead of an "almighty root": `capsh --print`, `getcap`/`setcap`, `CAP_NET_BIND_SERVICE` | L12, L27 |
| L38 | `linux.mount-ns` | Mounting in detail: bind mount, mount namespace, `chroot`, the idea of `pivot_root` | L25, L35 |
| L39 | `linux.overlayfs` | overlayfs: lower, upper, work, merged; copy-up, whiteout | L38 |
| L40 | `linux.seccomp` (plus) | seccomp as a system call filter (idea level), `grep Seccomp /proc/<pid>/status` | L27, L37 |
| L41 | `linux.container-by-hand` | Assembly: a process in its own namespaces, in its own cgroup, with its own root — "this is what will later be called a container" | L35, L36, L38, L39 |

After that, in group D: `D03` → "Namespaces in a container (recap)", `uses: [linux.namespaces]`; `D04` → `uses: [linux.cgroups]`; `D05` → `uses: [linux.mount-ns]`; `D09` → `uses: [linux.overlayfs]`; `D06` requires `linux.container-by-hand`. `N21 Network namespace` requires `L35`, and the paragraph "concrete before general" under table N must be reversed: the general concept of namespaces already exists from Linux, and networking adds veth and routes. Linux time in §13 grows: I propose +8 h for L0, +6 for L1, +4 for L2.

**OOM trainer (ready):**
> `linux.cgroups.drill.oom`. Tier B (v86, kernel with `CONFIG_MEMCG`). Setup: group `/sys/fs/cgroup/lab` is created, `memory.max=max`, process `hog` grows by 1 MB/s. Task: "Limit `hog` to 20 MB without restarting it, and see what the kernel does when the limit runs out". Goals: (1) `cgroups[procs~@pid(hog)].memory.max<=20M`, `keep` by PID; (2) event `proc.exit[reason=oom]` for `hog`; (3) a `predict` question before it happens: "what will happen when `hog` reaches 20 MB?" (it will slow down / get a malloc error / be killed by the kernel). Debrief: `memory.events` → `oom_kill 1`, the `dmesg` line `Memory cgroup out of memory: Killed process …`. Transfer to Docker: `docker run -m 20m` gives the same effect, exit code 137.

**Placement.** Move task 5 of the Docker L2 check ("without Docker, start a shell in a new PID namespace") into the Linux L2 check. And refine the check: `unshare --pid --fork --mount-proc bash`; without `--fork`, `echo $$` does not give 1, and without `--mount-proc`, `ps` shows the host's processes. Predicate: `procs[cmd=bash][nspid=1] && cmds[argv0=ps].stdout.lines#<6`.

### 14. MAJOR. R7: container anatomy and the "six boundaries" in the graph
**Where:** §6.2 group D.
**What is wrong.** There is no OCI bundle (`config.json` + rootfs), no shim and crun (`D10` stops at runc), no PID 1, zombies and `tini`, no stdout/stderr → log driver path, no UID inside and outside and userns. The "six boundaries" are not systematized. There is no explanation "hardware → VM → containers → nesting today".
**Fix: new and changed rows for D.**

| ID | Slug | Concept | Requires |
|---|---|---|---|
| D10 (changed) | `docker.runtime-chain` | docker CLI → dockerd → containerd → containerd-shim → runc/crun → process; who lives on after dockerd exits | D06, L23, L33 |
| D24 | `docker.oci-bundle` | OCI bundle: rootfs + `config.json`; runtime-spec; `runc spec` | D10, L31 |
| D25 | `docker.lifecycle-states` | created → running → paused → stopped (exited) → removed; who stores the state | D11 |
| D26 | `docker.pid1-signals` | PID 1 in a container, SIGTERM → 10 s → SIGKILL, codes 137/143, zombies, `tini`/`--init` | D11, L18, L33 |
| D27 | `docker.logs-path` | stdout/stderr → shim → log driver (json-file, local, journald) → `docker logs` | D11, L13, L24 |
| D28 | `docker.identity` | UID inside and outside, `USER`, userns-remap, rootless, bind mount permissions | D13, L11, L35 |
| D29 | `docker.six-boundaries` | The six boundaries of a container: host kernel, network, storage, process and signals, I/O and logs, configuration and identity; "the container doesn't work" = look for the boundary | D12, D13, D14, D20, D26, D27, D28 |
| D30 | `docker.virt-nesting` | Nesting today: containers inside cloud VMs; Kubernetes on bare metal. "VMs inside Kubernetes" (KubeVirt, Cozystack) — `forward: [k8s.*]`, fully covered in Kubernetes, after K01 | D07 |

Order rule: the "VMs inside Kubernetes" screen requires `k8s.cluster` and `k8s.pod`. It cannot be shown in Docker, otherwise the document's own rule in §6.1 is violated. So the third tower of explanation R7(c) moves to the K block as a "return to the towers" (a scene after K09). Docker keeps two towers and the "containers in a cloud VM" screen.

**"The container doesn't work" trainers by boundary (ready, for 04 and for the bank):**

| Boundary | Symptom | Parameterized causes | Fix predicate |
|---|---|---|---|
| Kernel | `exec format error` | an arm64 image on amd64; a binary built against glibc in alpine | `containers[name=app].state=running` |
| Network | `curl localhost:8080` → reset | the application listens on 127.0.0.1 inside; `-p 8080:8000` instead of `:80`; the container is in `--network none` | `http.host:8080.status=200` |
| Storage | data disappeared after recreation | writes to the upper layer; the volume is mounted at the wrong path; tmpfs | the file exists after `rm` + `run` |
| Process and signals | `docker stop` waits 10 s, code 137 | shell form of `CMD`, PID 1 is `sh`; no SIGTERM handler | `stop` < 2 s, code 0 or 143 |
| I/O | `docker logs` is empty | the application writes to a file; stdout buffering (`PYTHONUNBUFFERED`) | `logs` contains the line `READY` |
| Configuration and identity | `Permission denied` on a bind mount | UID 1000 inside, the host directory is `root:root 0755`; userns-remap shifts the UID | the application writes to the directory; `forbid: chmod 777` |

### 15. MAJOR. R8: the networks graph lacks the "big picture" and a protocol catalog
**Where:** §6.2 group N; §4.3 "Networks".
**What is wrong.** The graph has 21 concepts, and it starts with `ip a`. There is no map of the internet (provider, backbone, IXP, cables, data center), no AS/BGP, root DNS or CDN. OSI (`N07`) comes before DNS, but without "envelopes with real fields". There is no protocol catalog with a uniform card. The principle "first ask which layer broke" is present neither in the graph nor in the tutor's behavior.
**Fix.**
1. New concepts:

| ID | Slug | Concept | Requires | tier |
|---|---|---|---|---|
| N00 | `net.internet-map` | Map of the internet: laptop → home router → provider → backbone → IXP → submarine cables → data center | F05 | core |
| N22 | `net.as-bgp` | Autonomous system and BGP (idea: "providers agree on routes") | N00, N03 | core (idea) / pro (session, attributes) |
| N23 | `net.dns-hierarchy` | Root servers, TLD, authoritative server (split out of N08) | N08, N00 | core |
| N24 | `net.cdn` | CDN: a copy closer to the user, anycast (idea) | N19, N23 | core |
| N25 | `net.layer-diagnosis` | "Which layer broke": symptom → layer → check command | N07, N12, N13 | core |
| N26 | `net.tunnel` | Tunnel and re-encapsulation (the basis for VXLAN, WireGuard, IPsec) | N07 | plus |
| N27 | `net.protocol-card` | How to read a protocol card (purpose, layer, exchange, how to observe, how it breaks) | N07 | core |

2. The protocol catalog in the graph: every protocol has its own concept `net.proto.<name>`, `requires: [net.protocol-card, …]`. Tiers: core — DHCP, ARP, ICMP, TCP, UDP, DNS, HTTP, HTTPS/TLS, SSH; plus — NTP, SMTP, FTP/SFTP, HTTP/2, HTTP/3 (QUIC), WebSocket, gRPC, VLAN, NAT/PAT; pro — BGP, VXLAN/Geneve, IPsec, WireGuard, mTLS, OSPF (idea).
3. The order N00 → N01… means "from the picture to the packet", as R8 requires: the first networks lesson is the map, not `ip a`. 03 §3 starts with N0 "The network as a postal service". It must be replaced with N00 or merged with it, and this needs to be agreed with 03.
4. In §14.3 (tutor rules) add: "In tasks of the 'Networks' block and in network tasks of Docker and Kubernetes, the tutor's first move is 'at which layer do you think the problem is, and what command would check it?'".
5. Protocol card format for 08: a `protocol-card` widget with five tabs. The sequence diagram of the exchange is built from the `packets` bus (08 §3.6) of the same netlab scenario, so the diagram and the animation do not diverge.

### 16. BLOCKING. R9: Kubernetes networking as a separate large section
**Where:** §6.2 group K (`K14–K18`, `K26`).
**What is wrong.** `K26 CNI and pod networking` comes *after* Service, Ingress and RBAC and requires only `K09, N03, N20`. This means Service is explained before the learner knows that a pod has its own IP. There is no network model (an IP per pod, no NAT), no pod-to-pod path on a node and between nodes, VXLAN/eBPF, EndpointSlice, "ClusterIP is not on any interface", search domains/ndots, Gateway API, NetworkPolicy, or a method for "the pod couldn't reach the Service".
**Fix: a group `k8s.net.*` of ten concepts, insert right after Pod and ReplicaSet, before Deployment.**

| Slug | Concept | Requires |
|---|---|---|
| `k8s.net.model` | The network model: every pod has its own IP, pods see each other without NAT, nodes see pods; the CNI must provide this | k8s.pod, net.nat, net.routing |
| `k8s.net.same-node` | Pod to pod on one node: veth in the pod's namespace → bridge (or a /32 route) | k8s.net.model, net.veth-bridge, linux.namespaces |
| `k8s.net.cross-node` | Between nodes: direct routing, VXLAN overlay, eBPF (Cilium) | k8s.net.same-node, net.tunnel* |
| `k8s.service` | Service and ClusterIP: a virtual address that is not on any interface | k8s.net.model, k8s.labels |
| `k8s.endpointslice` | EndpointSlice: who is currently behind the Service and why a pod that is not ready is not included | k8s.service, k8s.controller |
| `k8s.kube-proxy` | kube-proxy: iptables/nftables rules on every node; replacement with eBPF in Cilium; IPVS in one sentence | k8s.endpointslice, net.netfilter |
| `k8s.dns` | CoreDNS, `svc.cluster.local`, search domains, `ndots:5` and why `curl api` makes several queries | k8s.service, net.resolv-conf |
| `k8s.ingress-path` | Entry from outside: NodePort → LoadBalancer → Ingress (legacy) → Gateway API | k8s.service, net.tls, net.reverse-proxy |
| `k8s.netpol` | NetworkPolicy: by default everything is open; a policy works only if the CNI supports it | k8s.labels, k8s.net.model, net.netfilter |
| `k8s.net.debug` | "The pod couldn't reach the Service": DNS → Service → EndpointSlice → pod → NetworkPolicy | all of the above |

`*` For core, VXLAN is explained at the level of "a packet inside a packet" without `net.tunnel`. For plus/pro, with it.

Mandatory trainer (ready text for 05):
> `k8s.net.drill.iptables-trace`. A hybrid cluster (R11) or kube-lite with the netfilter model from netlab. Task: "Find in the node's rules where a packet to ClusterIP `10.96.12.7:80` of service `web` goes". The learner runs `iptables-save -t nat | grep 10.96.12.7` → `KUBE-SVC-…` → two `KUBE-SEP-…` with `--probability 0.5` → `DNAT --to-destination 10.244.1.5:8080`. Input: the IP of the pod the packet goes to with probability 1/2, and the chain number. The check is `number`/`choice`. A variant with nftables: `nft list table ip kube-proxy`. Transfer: delete one pod and see how one `KUBE-SEP` disappeared and the probability became 1.

A "the pod couldn't reach it" trainer with a parameterized cause at each of the five steps: a typo in the service name or a foreign namespace (DNS); a wrong `targetPort` (Service); the selector does not match or readiness failed (EndpointSlice); the application listens on 127.0.0.1 (pod); `deny-all` without an exception (NetworkPolicy). The debrief shows the learner's path next to the reference check order. "Checked NetworkPolicy before DNS" is the "acted without a hypothesis" mark from 10 §5.

### 17. MAJOR. R10: explaining the reconciliation loop and "your own controller"
**Where:** §6.2 `K02`, `K03`, `K30`; §7.
**What is wrong.** `K03 Controller` is in the graph, but 01 has no requirements for how it is explained. The main pedagogical question is not resolved: in which language does a beginner write a "small controller in the browser", given that before Kubernetes the course teaches only bash. 05 §6.2 names "interactive 2b" without a language.
**Fix: a storyboard of the explanation (for 08 §6 and 05 §6.2) and a decision on the language.**

> **Explanation "The reconciliation loop".** A blueprint, no characters. Three columns on one screen: on the left "Desired" (the object's YAML as it is stored in etcd, with `resourceVersion`), on the right "Actual" (nodes and pod rectangles), between them the controller — a ring of three arcs with labels on the arcs: "watch", "compare", "act". Below the ring, a loop counter and a difference line `want 3 · have 2 → creating 1`.
>
> | Step | What changes | What the learner can do | Caption for the change (next to the element) |
> |---|---|---|---|
> | 1 | Stable: want 3, have 3; the ring spins, no actions | Click on an arc: the card "the controller does not wait for events, it compares state" | "No difference — the loops run idle" |
> | 2 | The learner deletes a pod (a button by the rectangle or `kubectl delete pod` in the terminal alongside) | Pause, step back and forward on the timeline | "Actual: 2. Desired: 3. Difference: +1 → create a pod" |
> | 3 | A `replicas` slider 1…6 | Move it; at each value a recalculation and one line of explanation | "The desired state changed in etcd; the controller saw it on the next loop" |
> | 4 | A toggle "Break it: the controller is stopped" | Delete a pod while the controller is off | "Nobody is comparing — the difference accumulates. Turn it on — it will be fixed in one loop" (level-triggered, the same question as 05 E3) |
> | 5 | A toggle "Break it: the node went down" | Watch the node's pods go to `Unknown` → get recreated on others (with a modelled `node-monitor-grace-period` delay, a "speed up time" slider) | "The actual state is not learned instantly: the node is silent for N seconds before its pods are considered lost" |
> | 6 | Image change `web:1` → `web:2` | Sliders `maxSurge`, `maxUnavailable` | Counters of old and new pods, the line "available now ≥ 2" |
> | 7 | Chain: the ring unfolds into five rings — Deployment → ReplicaSet → (a pod without a node) → scheduler → kubelet; arrows "writes to the API → another one sees it" | Click on each ring: what it watches and what it writes | "Nobody calls anybody: everyone writes to the API and watches the API" |
> | 8 | A new object type `Greeting` (CRD) without a controller: the object is created, nothing happens | `kubectl apply -f greeting.yaml` | "The API stores anything; without a controller it is just a record" |
> | 9 | The learner writes a controller (see below) and runs it | Editor + terminal | "Your loop is the same ring. An operator is a controller for its own type of objects" |
>
> **The controller language.** For core — **bash** on top of kubectl from kube-lite. bash was introduced in Linux (L20–L21), and the order rule is respected:
> ```bash
> while true; do
>   for name in $(kubectl get greetings -o jsonpath='{.items[*].metadata.name}'); do
>     want=$(kubectl get greeting "$name" -o jsonpath='{.spec.message}')
>     have=$(kubectl get configmap "greeting-$name" -o jsonpath='{.data.message}' 2>/dev/null)
>     [ "$want" = "$have" ] || kubectl create configmap "greeting-$name" \
>         --from-literal=message="$want" --dry-run=client -o yaml | kubectl apply -f -
>   done
>   sleep 2
> done
> ```
> Check: predicates on `k8s.objects` facts — after `spec.message` changes, the ConfigMap matches within 2 loops; after the ConfigMap is deleted, it is restored (`keep`: the controller was not restarted). For plus/pro — the same controller in TypeScript with the kube-lite watch API (an `informer`-like interface, 30 lines). From it there is a bridge to the pet project in Go: the same three steps rewritten on controller-runtime (`Reconcile(ctx, req)`).
>
> Requirements for kube-lite: `kubectl get -o jsonpath`, `--dry-run=client -o yaml`, CRDs with an arbitrary schema, a long-running process in the Stand that writes to the API (a bash background job in `sim.worker`). They need to be passed to 05 §5.5 and 09 §1.7.

In the graph: `k8s.operator` (`K30`) requires `linux.script-control` (L21) for the core path.

### 18. MAJOR. R11: hybrid Kubernetes and multi-node networking are not reflected in the route and the checks
**Where:** §6.2 (K), §10 ("micro-tasks stay on the computer"), §11.
**What is wrong.** 01 does not know about the hybrid: about real processes in real namespaces on v86 nodes, about `kubectl exec` into a real container, about pods moving after a node dies. This changes the pedagogy. A link with Linux appears: "a pod is the processes you saw in L35–L36, here they are in the node's `ps`". And device constraints appear: 3–4 nodes on a laptop, 1 on a phone. Meanwhile 03 §2 still claims that several v86 instances are "unacceptable", which contradicts R11. This is a question for 03, but 01 must record which concepts *require* a multi-node environment.
**Fix.**
- Add `env_min: sim | v86x1 | v86x3` to the lesson and task schema. Rule: any core concept can be completed on `sim` (phone, weak laptop). `v86x3` scenes give "here is the same thing for real", and each has a fallback on `sim` with the same check (the 09 predicates are shared, so this comes for free).
- Add a bridge concept `k8s.pod-is-processes` to the graph ("a pod on a node is processes in namespaces and a cgroup, `crun list`, `lsns` on the node"), requires `k8s.pod`, `linux.namespaces`, `linux.cgroups`. This is the direct payoff of R6 and the strongest moment of the course for a former salesperson: they recognize what they did by hand.
- Trainer (ready): "Node `node-2` went down". Hybrid, 3 nodes. The learner finds which pods were on `node-2` (`kubectl get pods -o wide`), predicts what will happen and how long it will take, watches the move, then on `node-1` uses `ps -ef --forest` to find the processes of the moved pod and its `cgroup`. Check: `k8s.objects[kind=Pod][spec.nodeName!=node-2]#=3` and input of the PID of the nginx process on `node-1` (checked against the node's `procs` facts).

### 19. BLOCKING. R12: three Kubernetes stages, the place of Terraform and Ansible, cleanup
**Where:** §5 (block order), §11.2 "Kubernetes", §13, `K31–K32`.
**What is wrong.**
- According to §11.2 the installation exam is for everyone: three VMs, kubeadm. According to 05 §0 item 7, k3s for the beginner and intermediate, kubeadm for the experienced. R12 requires three stages: the browser; a single node (k3s, minikube or kind) on one's own machine or a VPS, with Helm, Ingress and real images; a full kubeadm setup on 3+ VMs, with control plane, join, Cilium, storage, certificates, upgrade, etcd backup, node break-fix, *as well as Terraform to order the VMs and Ansible to configure them*.
- According to §5, IaC comes *after* Kubernetes ("the pain Terraform removes is understood"), but R12 requires Terraform and Ansible inside stage 3. This is a direct order conflict.
- 01 has no mandatory cleanup and no cost display. The check mechanism "trainer-check prints a code tied to the cluster UID" is not suitable for cleanup: a deleted cluster prints nothing.

**Fix (new order for §5):**

| No. | Block | Why |
|---|---|---|
| 6 | Kubernetes, stage 1 (browser: kube-lite + hybrid) | Architecture, objects, kubectl, the reconciliation loop, cluster networking |
| 7 | Kubernetes, stage 2 (single node: k3s on a VPS or kind/minikube locally) | Helm, Ingress/Gateway, images from a real registry. Requires `linux.vps` (finding 8) |
| 8 | IaC (Terraform, Ansible) | The pain of manual ordering has already been lived through in stage 2 (one VM by hand). The §5 argument is preserved |
| 9 | Kubernetes, stage 3 (kubeadm on 3+ VMs ordered by Terraform and configured by Ansible) | Brings IaC and Kubernetes together. The trainer does not execute; it guides and checks |
| 10 | Monitoring | Installed on the stage 3 cluster if it is still alive, otherwise on stage 2 |

Stage 3 is `tier: plus` for the Beginner (the core finish line is stage 2) and `core` for Intermediate and Experienced. This makes an honest compromise between §3 and 05. New concepts: `k8s.single-node` (stage 2), `k8s.kubeadm-init-join`, `k8s.pki`, `k8s.etcd-backup`, `k8s.upgrade`, `k8s.node-break-fix`, `iac.tf-vms-for-cluster`, `iac.ansible-node-prep`.

**A mandatory lesson step `kind: cleanup`** (for all lessons with `env: vm`, text for §7):
> A lesson that creates paid resources starts with a "Cost" screen: the price per hour and per day at the chosen provider, taken from a price table with a verification date (not from the author's head; the table belongs to 05 §10.2 and 09 §5.2), and the total "if you forget to delete it, this much per month". The lesson ends with a "Cleanup" step that cannot be skipped: `terraform destroy` (or deletion in the console) and a check. The cleanup check does not run from inside the cluster but from the learner's machine: `trainer-check cleanup` reads `terraform state list` (it must be empty) and, if the learner provided a read-only token, the list of VMs at the provider by the tag `dt-lab=<code>`. If cleanup is not confirmed, the lesson is not closed, and after 24 hours a reminder arrives with the amount accrued during that time.

### 20. BLOCKING. R3: process explanations are not mandatory and not listed
**Where:** §7 (anatomy), §8.
**What is wrong.** The "Watch" step allows "an interactive diagram or a worked example". There is no requirement that every block has process explanations, no catalog of them and no place for them in the graph (which concept each explanation introduces, which it requires). 08 has four flagships, while R3 requires explanations in all blocks.
**Fix.** Add to §7:
> **Process explanation** (`kind: process`) is a mandatory "Watch" screen type for every concept that has a mechanism unfolding in time. Every block contains no fewer explanations than listed in the catalog below; the build checks that every `process.<id>` exists and that its `uses` are introduced before the place where it stands.

Catalog (ready, tied to the graph; "Break it" means toggles, "Parameters" means sliders and switches):

| id | Block | Process | Comes after | Parameters | Break it |
|---|---|---|---|---|---|
| `p.meth.idea-to-prod` | Methodology | A task from idea to prod across board columns | M06 | WIP limit, batch size | remove automated tests (the "check" stage is manual) |
| `p.meth.incident` | Methodology | Alert → on-call → diagnosis → recovery → postmortem | M12 | response time, whether a runbook exists | no alert (we learn from the customer) |
| `p.meth.bottleneck` | Methodology | Flow and bottleneck: the queue grows in front of a slow stage | M09 | stage speeds, WIP | remove the WIP limit |
| `p.lin.boot` | Linux | Boot: firmware → bootloader → kernel → initramfs → systemd PID 1 → units | L23, L27 | — (step by step) | a broken unit in `multi-user.target` |
| `p.lin.fork-exec` | Linux | Enter after `ls`: parsing the line → `PATH` → fork → exec → syscalls → stdout → wait | L33 | `PATH` (reorder directories), builtin or external command | remove a directory from `PATH` → `command not found` |
| `p.lin.pipe` | Linux | Pipeline: two processes, a kernel buffer, blocking on a full and an empty buffer | L15, L33 | writer and reader speed, buffer size | the reader exited → SIGPIPE |
| `p.lin.systemd-restart` | Linux | A service crashes → systemd sees the exit → `Restart=on-failure` → `RestartSec` → the `StartLimitBurst` limit | L23, L24 | `Restart`, `RestartSec`, `StartLimitBurst` | the process crashes every second → `start-limit-hit` |
| `p.lin.isolation` | Linux | A process enters namespaces and a cgroup one at a time: what it sees and how much it consumes | L35, L36 | toggles for 7 namespaces, `memory.max` | a limit below the working set → OOM |
| `p.net.url` | Networks | Entering a URL (flagship 08 §6.3) | N16 | cache TTL, HTTP/1.1 or 2 | a wrong A record, an expired certificate |
| `p.net.dns` | Networks | Recursive resolution with a cache | N23 | TTL, "time elapsed" | NXDOMAIN, unreachable resolver |
| `p.net.tcp-tls` | Networks | SYN/SYN-ACK/ACK → ClientHello … Finished | N05, N15 | RTT, TCP window, TLS 1.2 or 1.3 (number of RTTs) | lost SYN-ACK → retransmits; wrong SNI |
| `p.net.nat-router` | Networks | A packet through a home router: SNAT, conntrack, the reply back | N11 | number of clients, conntrack timeout | flush conntrack → replies are lost |
| `p.net.504` | Networks | Where a 504 comes from: client → proxy → backend, the proxy timer | N19 | `proxy_read_timeout`, backend response time | the backend went down (502 vs 504) |
| `p.ctr.run` | Containers | `docker run`: CLI → dockerd → containerd → shim → runc → process | D10 | `-d`/`-it`, `--rm` | kill dockerd → the container is alive (live-restore) or not |
| `p.ctr.build` | Containers | `docker build` layer by layer with a cache | D16 | order of COPY and RUN, a changed file | `COPY . .` before installing dependencies |
| `p.ctr.pull` | Containers | Pull: token → manifest (index → platform) → blobs → unpacking | D19 | platform, already downloaded layers | a wrong digest → rejection |
| `p.ctr.towers` | Containers | Hardware → VM → containers (R7c, below) | D07 | number of applications | a kernel vulnerability |
| `p.k8s.apply` | Kubernetes | `kubectl apply` through all components | k8s.kubelet | replicas | turn off the scheduler → Pending |
| `p.k8s.reconcile` | Kubernetes | The reconciliation loop (finding 17) | k8s.controller | replicas, image | controller stopped, node went down |
| `p.k8s.schedule` | Kubernetes | Filters → scoring → binding | k8s.scheduler | requests, taints | requests larger than free capacity → Pending |
| `p.k8s.rolling` | Kubernetes | Rolling update | k8s.deployment | maxSurge, maxUnavailable | readiness never passes → rollout stuck |
| `p.k8s.node-fail` | Kubernetes | Node went down → NotReady → eviction | k8s.replicaset | grace period | — |
| `p.k8s.service-path` | Kubernetes | A request through Ingress/Gateway → Service → kube-proxy → pod | k8s.kube-proxy | number of pods, iptables/nftables/eBPF mode | the selector did not match |
| `p.ci.push-deploy` | CI/CD | git push → webhook → runner → stages → registry → deployment | C13 | branch, `when: manual` | a red test → it does not go further |
| `p.iac.tf` | IaC | `plan` (state ↔ code ↔ cloud) → `apply` → new state | I06 | change an attribute in place or with recreation | a manual edit in the cloud → drift |
| `p.iac.ansible` | IaC | An idempotent run: facts → task → ok/changed → handler | I11 | a second run | `shell: echo >>` → always changed |
| `p.obs.pipeline` | Monitoring | scrape → TSDB → PromQL → rule → pending → firing → Alertmanager → notification | O08 | `scrape_interval`, `for:`, threshold | a target went down → `up=0` |

The R4 requirement for each of them (it becomes rule CL15 and part of the storyboard review checklist): "steps can be rewound forward and backward, pause anywhere; changing a parameter immediately recalculates the process, and next to the changed element one line 'what changed and why' appears; any element is clickable and opens a card; at least one 'break it' toggle".

### 21. MAJOR. R7(c): storyboard "Hardware → VM → containers → nesting"
**Where:** new material for 04 D1 and for the catalog from finding 20.
04 D1 describes the scene in words ("the learner builds the stack from blocks"). A ready storyboard in the R4 style:

> **Screen 1. Two towers.** On the left "VMs", on the right "Containers". The layers from bottom to top are labeled on the lines between them: hardware | hypervisor | guest kernel ×N | OS ×N | application ×N — and hardware | host kernel | container runtime | application ×N. Colors carry meaning: the kernel is in the "kernel" color (the same as for kernel space in Linux), user space has its own color.
> **Screen 2. A "number of applications" slider 1…20.** The towers grow, next to each are three counters: "memory used, GB", "startup time, s", "CPU usage, %". The numbers come from a model with explicit assumptions (VM: +512 MB per guest OS, boot 20–40 s; container: +5–50 MB, start < 1 s). The assumptions open with a click on the counter, each with a source. On change — the line "each VM carries its own kernel and OS — that is why memory grows in steps".
> **Screen 3. A "kernel vulnerability" toggle.** In the right tower, *one* kernel and all the applications above it are highlighted; in the left, only one VM. Line: "the boundary of a VM is the hypervisor, the boundary of a container is the kernel, shared by all".
> **Screen 4. Today: nesting.** A third tower: hardware → cloud hypervisor → VM → kernel → containers. Caption: "almost all containers in the cloud live inside VMs". (The fourth tower, "VMs inside Kubernetes — KubeVirt, Cozystack", is shown in the K block, see finding 14.)
> **Screen 5. Hands-on.** The v86 terminal: `dmesg | grep -i -m3 hypervisor` → the learner sees that their "real Linux" is itself a VM (in v86 there may be no hypervisor line — then `dmesg | head` and `cat /proc/cpuinfo`, which show the emulator's CPU model; check on the 09 image and record in the golden record). Then `uname -r` outside and inside a container (the same), `ps -e | wc -l` outside and inside (different). Then a measurement: `time` of starting a container versus booting a second v86 (the "boot a second machine" button starts a worker from a cold image, not from a snapshot — otherwise the comparison is unfair). Predicate: the learner entered both times, and the ratio is > 10.

---

## C. Lesson anatomy, load rules, visual language

### 22. MAJOR. Rules CL8–CL10 contradict R4/R5
**Where:** §8, rules R8, R9, R10; §1 (Mayer, modality).
**What is wrong.**
- R9 allows "parallax and ink drawings from the Sankofa engine" in hooks and opening screens. R4/R5 forbid cartoons, characters, plot and decorations, and from Sankofa they say to take the magazine text layout, scroll scenes, layers, calm mode, lenses, QR, bilingual YAML, draft/hold, but not the ink. This also concerns my own 08 (§5.1 "Two hands", the scenes "Room", "Stack of tracings", "Thermostat", the ink DNS). I will rework my document, but 01, as the source of the rules, must close this first.
- R8: "autoplay no longer than 5 seconds". R4 requires timelines with forward and backward rewinding and pause, not video. The rule must be reworded.
- R10 and the modality principle assume voice-over. The engine (08) has none (only synthesized event sounds), and recording voice in two languages for ~30 explanations and 195 concepts is a separate budget that does not exist in any document.
**Fix (ready text of the rules):**
> CL8. Animation shows only a process (a packet moves along a line, a layer appears, a counter grows). The step timeline can be rewound forward and backward and stopped anywhere; there is no continuous animation without controls; under `prefers-reduced-motion` the transitions between steps are instant, and motion is replaced by a change of state. *Build:* every `process` has `steps[]` and a static frame for each step.
> CL9. There are no decorative images anywhere, including hooks and block opening screens: no characters, no narrative illustrations, no ink drawings, no parallax. A block's opening screen is typography and one diagram of the block. *Review.*
> CL10. There is no voice-over in v1. The modality principle is implemented through temporal contiguity: a caption on a line appears in the same step as the event. *Review.*
> CL16 (new). Color carries meaning and is the same throughout the course: kernel space, user space, network layers (L2, L3, L4, L7), Kubernetes components (control plane, node, pod) take their colors from the semantic palette of 08 §5.2. A color outside the palette is a build error.

In §1, remove modality from the list of principles that "carry over directly" (seven will remain) and explain the reason.

### 23. MAJOR. The L17 lesson example does not satisfy R3, R4 and R2
**Where:** §7, the `linux.process` lesson example.
**What is wrong.** The diagram on screen 1 is static, except for the "run again" button. No parameters, no "break it", no clickable elements, no timeline. Documentation appears only in "Explanation" (`man 1 ps` + opennet). This is a link, not DL1 on an element. The opennet link is presented as a "RU source", but the `ps` page there is in English: checked, `NAME: ps - report process status`. The two-source rule (RU and EN) is therefore not satisfied. And one more small thing: "`ps aux | grep` does not work because the pipeline has not been introduced yet" contradicts the row order of the document's own table (L15 comes before L17) and 02 (L6 before L8).
**Fix.** Rework screen 1 into a two-step `process`: the program on disk → `exec` → the process in memory. Clicking the process rectangle shows the card "PID, PPID, owner, state"; a "launches" slider from 1 to 5; a toggle "Break it: kill the process" — the rectangle disappears, the file on disk remains, and the caption "the program was not harmed — the process died". Each column of the trimmed `ps` has a DL1 label → `man 1 ps`, section STANDARD FORMAT SPECIFIERS. RU source: replace it with a Russian-language text, for example the chapter on processes from the Russian translation of "The Linux Command Line" or an article on Habr. Into the concept card, not into a claim — opennet does not fit here. Keep the S0 task as `ps -C nginx`, but give the honest reason: "`-C` selects processes by name without a pipeline — it is shorter".

### 24. MINOR. "The terminal cannot be broken": `rm -rf /` teaches the wrong behavior
**Where:** §12.2, second item.
**What is wrong.** On real Debian, GNU `rm` with `--preserve-root` by default (coreutils ≥ 6.4) answers `rm -rf /` with `rm: it is dangerous to operate recursively on '/'` and deletes nothing. If the tier A sandbox "deletes everything", that is a lesson about behavior that does not exist. The very first comparison with tier B (02 §3.4 "Checking against real Linux") will catch it. And besides, the learner does not have `sudo` yet, so even `rm -rf /*` would delete only what they have permissions for.
**Fix.** Scenario: `rm -rf ~/*` in the sandbox — the home directory is empty, a "restore" button. Then show that real Linux refuses to do `rm -rf /`, with the verbatim message, and explain in one line that on a server with `sudo` and `/*` there is no protection. The restore predicate is a VFS snapshot.

### 25. MAJOR. The tutor: the "no ready solution" rule diverges from 09
**Where:** §14.2, §14.4.
**What is wrong.** 01: "there is no ready solution at any step", the reference solution is not passed into the context. 09 §4.5: the `lab` mode checks the answer against the reference command (the engine knows it, that is fine), but provides a button "Show solution — the goal will be counted with a hint", and `hintLevel 3` means "answer revealed". Length limit: 120 words in 01 and 150 in 09. Together with DL4, a third mode appears.
**Fix.** Record in 01 and pass on to 09:
> There is one hint scale: `H0` (no hints), `H1…H5` as in table 14.2. The reference command is known to the *engine* (for collapsing leaks in the tutor's answers and for the debrief after an attempt), but not to the *model*. There is no "show solution" button during an attempt. After the third failed attempt or on the "I give up" button, the task is closed as failed (FSRS: Again), and only then is the debrief shown with the reference path next to the learner's path (section 11.1). This is not a hint but feedback after an attempt. Answer length: 120 words for Beginner, 180 for the others, as CL4.

### 26. MAJOR. The "Experienced" level: "task first" versus R1
**Where:** §3, §7 (L2: "Watch — after the attempt"), §1 (Sinha and Kapur).
**What is wrong.** For L2 the "Watch" step comes after the attempt, and the explanation is "based on the attempt's results". This is consistent with productive failure, but not with R1: an experienced learner can complete a block without ever opening the chapter or the process explanation. And it is precisely this learner who, per the profile in §2.1 ("doesn't know the control plane, Service networking"), needs the models.
**Fix.** For Experienced, the process explanation is mandatory *after* the challenge task, even if the task is solved: "you solved it; here is what was happening inside". The `introduced` mark is set only after all steps of the explanation have been viewed. The Experienced learner may skip the chapter, but `mastered` requires an `explain`-type question about the model.

### 27. MAJOR. The time budget does not match its own estimate and does not account for R6–R12
**Where:** §13.
**What is wrong.** "About 40–45 minutes per concept at L0 with practice" × 195 concepts ≈ 140 hours, while the table says 421 hours, i.e. about 2.2 hours per concept. One of the two is wrong. If this includes exams, trainers, review and the pet project, it needs to be broken down. After R6, R8, R9, R12 (≈ +60 concepts and two new Kubernetes stages with real VMs) the numbers will grow further.
**Fix.** Rewrite the paragraph: "≈ 45 minutes per concept in a lesson (≈ 150 h at L0) + block trainers and exams (≈ 120 h) + pet project (40 h) + career (25 h) + review (≈ 15%)". And add rows: Linux +8/+6/+4 h (isolation), Networks +6/+5/+4 (map, plus/pro protocols separately), Kubernetes stage 2 +10/+8/+5, stage 3 +20/+18/+15 (plus for L0), Kubernetes networking +8/+6/+5. Recalculate the totals and the durations in months.

### 28. MAJOR. The "≤ 1 concept per screen" rule and process explanation scenes
**Where:** §8 CL1, CL11, CL15.
**What is wrong.** The explanation "the path of `kubectl apply`" under CL11 requires all components to be introduced beforehand. That is correct, but it means a process explanation is *review and connection*, not introduction. It is currently unclear whether a `process` can introduce anything at all. 08 §6 introduces 3–5 terms in each flagship.
**Fix.** Rule: a `process` introduces at most one concept, and it is always the concept of "the process as a whole" (`net.url-path`, `k8s.apply-path`). The parts of the process — the components — are introduced earlier by pre-training cards (CL11). For the 08 flagships this means the first 1–2 scenes are pre-training of the parts (each introduces one concept), and the process itself comes on the next screen. I will fix 08, but this rule needs to be written down in 01.

### 29. MINOR. CL12 "one interaction mode per screen" versus `split` and R4
**Where:** §8 CL12.
**What is wrong.** R4 requires one screen to have sliders, toggles, clicking on elements and rewinding. 08 has `split` (terminal + live diagram). Read literally, CL12 forbids all of this.
**Fix.** "A screen has one *action input*: either the terminal, or drag-and-drop, or answer selection. Controls of the explanation (timeline, parameter sliders, 'break it' toggles, click cards) do not count as an interaction mode and are allowed together with any of them."

---

## D. Infeasible and underspecified

### 30. MAJOR. The documentation corpus for the ladder: man in tiers A and B, licenses
**Where:** §14.3 ("first `man` or `--help` in the sandbox"), new §9a.
**What is wrong.** For R2 to work, an offline documentation corpus is needed. Right now it is nowhere.
- Tier A (the Stand) must produce the real text of `man` and `--help` for every supported command. It must be taken from real packages of the same version as in the golden records, not written anew.
- Tier B: Alpine has no man pages; `mandoc` and `*-doc` packages are needed. In minimal Debian images `/usr/share/man` is often stripped via `path-exclude` in `/etc/dpkg/dpkg.cfg.d/`. The `lab-debian` image (09 §0) must be checked, and `man-db` and `manpages` installed explicitly.
- `kubectl explain` in kube-lite: 05 promises v1.37 OpenAPI schemas, and `explain` is built directly on them. This must be added to the command list in 05 §5.5.
- A built-in viewer for DL1–DL5 with anchors on options. For web documentation, a dated mirror, otherwise DL3–DL5 anchors break when the sites are updated.
- Corpus licenses: pages of the man-pages project have their own licenses on each page; GNU coreutils man pages are released under a GNU license; kubernetes.io documentation is CC BY 4.0; docs.docker.com and Prometheus follow the licenses of their repositories; the Terraform documentation has its own license. Embedding fragments at DL2 is distribution. A table "source → license → can a fragment be embedded or only linked" is needed, owned by the role that maintains the corpus. Check each license against the repository, not from memory.
**Fix.** In §9a: "The documentation corpus is a shared platform resource (09): `docs/<source>/<version>/…`, with an anchor map and the license of each source; if the license is unclear, the source is only linked (DL1, DL3), and fragments are not embedded at DL2".

### 31. MAJOR. Checking "explain" without a neural network and honest rubrics
**Where:** §4.3 (**E** tasks, "assessed by the learner against the reference or by the AI tutor"), §11.2.
**What is wrong.** In the placement check, an "E" task with self-assessment is a way to "credit oneself" with a concept (`placed`) without evidence. 10 §6.1 marks such exams as "self-assessment", but placement in 01 has no such caveat. A learner's neural network grading the rubric in the entry check contradicts §14.1 (the tutor is off during checks).
**Fix.** "In the placement check, 'E' tasks are not key tasks and do not move concepts into `placed`. They only give a 'ready to explain' mark. The assessment is a self-check against a checklist of points; the neural network is not called during the check (`exam` mode, 09 §4.5)".

### 32. MINOR. Docker L2 placement: task 1 is infeasible in dsim without clarification
**Where:** §4.3 Docker L2, task 1 ("shrink a Go image from ~900 MB to < 30 MB").
**What is wrong.** dsim (04 §7) models the build but does not compile Go. The image size is the sum of the model's layer sizes. It must be stated that the base images (`golang:1.x`, `scratch`, `gcr.io/distroless/static`) and the result of `go build` in dsim are stubs with real sizes from the golden records. Otherwise the check "the application responds" relies on the image's process model (04 §7.4), and that should be stated.
**Fix.** Add to the task: "`envs: [sim]`; sizes and the process model come from the golden record `golden/go-multistage`; predicate `images[tag=app:small].size<30M && http.app.status=200`".

### 33. MINOR. Network placement tasks that cannot be checked without a model
**Where:** §4.3 Networks L2, task 3 ("Allow 443, close 8080, without losing SSH; the sandbox runs synthetic packets").
This is correct if it is netlab (03 §7.3) with a netfilter model. It is necessary to specify `envs: [netlab]` and a predicate like `probe.tcp[dst_port=22].result=accept && probe.tcp[dst_port=443].result=accept && probe.tcp[dst_port=8080].result=drop|reject`, and also to decide whether REJECT counts as "closed". I propose counting both, and explaining the difference between timeout and refused in the debrief. This is a direct link to task 7 of the L1 check.

### 34. MINOR. K8s L2 check, task 6: IPVS instead of nftables
**Where:** §4.3 Kubernetes L2, task 6, rubric "iptables or IPVS rules".
According to 05 §0 item 5, the course teaches the iptables and nftables modes and mentions IPVS in one sentence as being phased out. The rubric should accept "iptables or nftables (or eBPF with Cilium without kube-proxy)", and count IPVS but not require it.

---

## E. Pedagogy and clarity by level

### 35. MAJOR. The Beginner and the "silence" in the first block with a terminal
**Where:** §5 (Methodology before Linux), §12.2 ("the first ten minutes are the terminal").
**What is wrong.** §12.2 says: "onboarding is the sandbox terminal right away". But block 1 is methodology, which "does not require a terminal", and Orientation for L0 is 6 hours without a terminal. So it is one of two: either the learner spends the first ten minutes in the terminal and encounters the terms "file" and "command" before F03/L02, or they do not see the terminal for the first 18 hours, and then the "real success" is postponed.
**Fix.** Onboarding = 10 minutes, separate from the blocks: three commands (`echo`, `mkdir`, `ls`) with full S0 support, the words "command" and "folder" are introduced right there as `F03`/`L02` in everyday form (`introduces` at onboarding). Orientation alternates with short "terminal five-minute sessions" (`pwd`, `ls`, `cat`), so that the learner arrives at Linux with 20–30 successful commands. Methodology runs in parallel with Orientation, not after it, using the same "spreading" already done for the career block.

### 36. MINOR. The "Experienced" profile in Kubernetes and the CKA
**Where:** §4.3 Kubernetes, the levels table.
L2 is described as "deploys to Kubernetes at work, … does not know the control plane, Service networking, RBAC, debugging". In 05 §2.3, Experienced is "a programmer…, at CKA level by the end of the block". These are different people: someone who deploys at work is more of an Intermediate in 05's terms. One wording is needed. I propose the one from 05, and to give the 01 description to Intermediate.

### 37. MINOR. Interleaved review and R6
**Where:** §10 ("after Docker — Linux, networks and Docker together").
After moving isolation into Linux (finding 13), the interleaving should explicitly include the pairs where confusion is most costly: `linux.namespaces` ↔ `k8s.namespace` (homonyms), `docker.volume` ↔ `k8s.pv`, `net.nat` ↔ `k8s.service` (DNAT in both), `linux.cgroups` ↔ `k8s.resources`. Interleaving à la Bjork works precisely on discriminating similar things, and §10 itself says so.

### 38. MINOR. Small text issues
- §1, Bastani et al.: "a constrained tutor removes this harm". In the paper, the GPT Tutor group showed no significant drop on the final test, i.e. the harm is "largely removed". The wording should be softened to the exact one.
- §2.2: `mastered` requires "a delayed review (≥ 3 days) without errors", while 10 §3.4 item 1 adds "in a different format". This should be moved into the state definition in 01 so that the rule lives in one place.
- §6.2: "195 concepts in 11 groups" will become ≈ 260 after the edits. The number is better generated from `concepts.yaml` at build time than written by hand.
- §12.2 "People like you": keep the stories as text and, if available, a real photograph with the person's consent. Do not draw illustrations (CL9).
- §15: the Google LearnLM overview on techlearning.com is a secondary source. A primary link to the LearnLM technical report is needed.

---

## Summary of what the author should do first

1. Unified identifiers and the `term` versus `concept` level (finding 1). Without this, the other edits will not fit.
2. Core and extensions instead of "one finish line" (finding 4) and the new block order with three Kubernetes stages around IaC (finding 19).
3. New graph groups: isolation in Linux (13), containers (14), networks (15), Kubernetes networking (16), the reconciliation loop (17), the hybrid (18).
4. Section 9a "Documentation ladder" (11, 12, 30) and the tutor edits (25).
5. §1.1 priorities and "the chapter as the single source" (10), the process explanations catalog (20), rules CL8–CL10 and CL16 (22).
