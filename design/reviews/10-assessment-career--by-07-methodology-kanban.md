# Review of `10-assessment-career.md` (reviewer: the author of `07`, the "Methodology and Kanban" role)

Date: 18.11.2026. The document was read in full; cross-checked against `01` (the concept graph, block order), `05` (real tracks R1–R5, decision 7), `07` (my own), `08` (the `diagram`, `stepper`, `breakit`, `packets`, `lenses` primitives), `09` (tiers A/B/C, `dt-api`, `trainer-check`, the facts contract).

## Verdict

A strong document, unusually honest: the position on AI, checking by state, the misconception catalog, quotes as a condition for a score, the job posting analyzer with the 60% rule — all of this is ready for implementation, and I would leave most of it alone. But in its current form the document **does not cover the owner's requirements R1–R12 as far as assessment is concerned**: it has not a single mechanism that would measure the habit of reading documentation (R2), the exams do not open the official documentation and contain no "beyond the course" tasks (R2, step 5), the process explainers (R3/R4) have not been turned into tasks, the Linux and Docker quiz samples do not rely on "how the kernel isolates and limits" (R6/R7), networks and Kubernetes networking are checked without tying them to the model layer (R8/R9), the reconciliation loop and your own controller are not checked (R10), "On-call" and the final exam do not account for the hybrid cluster (R11) and the three-stage Kubernetes with kubeadm, cost and mandatory cleanup (R12). On top of that there is a factual error about the DORA metrics, concept order violations in the methodology samples (my area), and discrepancies with `07` and `09` on the exam format, the rubric and the server side. Below are 27 findings: 7 BLOCKING, 13 MAJOR, 7 MINOR; for each owner requirement, ready text to paste is given.

---

## A. Owner requirements (R1–R12)

### 1. BLOCKING — R2: the documentation ladder is missing from the assessment system
**Where:** §0, §1 "What exactly we measure", §2 "Task types", §6.1, §7.

**What is wrong.** The document mentions documentation only as "copying from the documentation is a working skill" (§7) and as links in `sources`. Missing: (a) a measure of "can find the answer in the documentation"; (b) task types for steps 2–3 of the ladder; (c) a rule by which, at step 4, the built-in assistant answers "where did you look?"; (d) an exam mode "only the official documentation is open" (step 5); (e) tasks built on things that were not in the course. Moreover, the §2 "Concept order" rule ("a task is shown only when all concepts have been introduced") in its current wording **directly forbids** steps 4–5.

**Fix — add a fifth row to the §1 table:**

| Dimension | Measured by | Where the learner sees it |
|---|---|---|
| Working with documentation | `doc_anatomy`, `doc_find` tasks, tasks with `docs_forcing: true`; the share of "beyond the course" exam tasks solved using the documentation; the log of documentation pages opened during the exam | The documentation ladder step for each block: 1 "glimpses" → 2 "I read a fragment" → 3 "I find it myself" → 4 "I manage without hints" → 5 "exam with the official documentation" |

**Add two new types and one field to §2:**

| Type | What it checks | How it is checked automatically | Example |
|---|---|---|---|
| `doc_anatomy` (new, step 2) | Knowledge of page anatomy: NAME, SYNOPSIS, DESCRIPTION, OPTIONS, EXIT STATUS, EXAMPLES, SEE ALSO; on kubernetes.io — Concept / Task / Reference; in `kubectl explain` — FIELDS, `<Object>`/`<string>`, `-required-` | `hotspot` over the page markup: a click on the right section and on the option line; the page is a local copy (man from `lab-debian`, a kubernetes.io snapshot for the course version) | "Show where in `man 1 ls` it says which option sorts by time" → click on `-t` in OPTIONS |
| `doc_find` (new, step 3) | The ability to find a flag or field given a link to a page | The learner is given only a link to the page (or `man journalctl`); the answer is checked by its effect in the sandbox, like `fill`; search inside the built-in viewer is allowed | "Find in `man journalctl` how to show only entries from the previous boot" → effect: a journal query with `boot=-1` |
| field `docs_forcing: true` (step 4) | The task requires a command or flag that was not in the theory | Like a regular `task`; hints H1–H5 are disabled, `ask` switches to "where did you look?" mode (below) | "Show processes sorted by memory with a single `ps` command" (`--sort=-rss` was not introduced in the course) |

**Add an exception to the "Concept order" rule in §2:**

> Concepts (`concepts`) always obey the graph. **Commands, flags and API fields** are not concepts: a task with `docs_forcing: true` or an exam task with `beyond_course: true` may require a command, flag or field that is not in any lesson, under two conditions: (1) the task has a `docs_target` — the exact address where the answer is (`man:journalctl(1)#--list-boots`, `kubectl explain deployment.spec.strategy`, `https://kubernetes.io/docs/...#anchor`, `docs.docker.com/...`), and this address is part of the local documentation snapshot for this course version; (2) all *concepts* needed to understand the line found have already been introduced. The linter checks both conditions; a `docs_target` that is not in the snapshot fails the build.

**Add rule 5 to §3.4 and a row to the §6.1 table — "where did you look?":**

> **The "where did you look?" mode** is enabled for tasks with `docs_forcing: true` starting from step 4 of the block. The built-in tutor answers any question about the task with a question first: "Where have you already searched? `man <command>`, `<command> --help`, `kubectl explain <resource>`, docs.docker.com, kubernetes.io?". If the learner named a source, the tutor shows which *section* of that source to look in (not the line). If not, it only gives the list of sources for this tool. At this step the tutor never gives out a ready command or flag; this is checked in `ai-evals` (`09`, 4.6) with a set of 20 attempts to "talk it into it".

**Row for the §6.1 table:**

| Parameter | Value | Why |
|---|---|---|
| Documentation | To the right of the terminal — a "Documentation" panel: the image's local man pages, `--help`, `kubectl explain`, a snapshot of kubernetes.io/docs, docs.docker.com, developer.hashicorp.com/terraform, docs.ansible.com, prometheus.io/docs for the version that is in the sandbox; search across them is available. The exam does not block the external internet (§7), but the protocol records which pages were opened in the panel | This is how the CKA works: only the official documentation is open; at work, the answer is looked up there too |
| Beyond-the-course tasks | 15–20% of the practice weight — tasks with `beyond_course: true`: a command or field that was not in the lessons but can be found in the documentation panel within 2–3 minutes. None of these tasks is `critical` | Step 5 of the ladder: the ability to learn is checked, not memory |

A note on facts: the Linux Foundation changes the list of resources allowed on the CKA; kubernetes.io/docs (and the blog) is consistently allowed, Helm docs are allowed or not depending on the source. In the product text, write "as on the CKA" without listing domains and with a link to the official Resources Allowed page, with `hold: true` until verified by two sources.

### 2. BLOCKING — R2: there is no per-block schedule of ladder steps and levels
**Where:** §3.5, §4, §8.

**What is wrong.** R2 requires: for a beginner, documentation does not start from scratch; for an experienced learner, it starts at step 3. The document has levels L0/L1/L2, but no steps, and the block quizzes (§4) do not account for them.

**Ready text for a new §4.1 "Documentation steps in quizzes and exams":**

| Where in the block | L0 | L1 | L2 |
|---|---|---|---|
| First 30% of modules | Step 1: in the explanation of every answer — a line "This is from: `man 1 chmod`, section DESCRIPTION" with a link, optional | Step 2 | Step 3 |
| 30–60% of modules | Step 2: hint H2 — a page fragment with the line highlighted; one `doc_anatomy` in the module quiz | Step 3 | Step 3–4 |
| 60–90% of modules | Step 3: one `doc_find` in each module quiz | Step 3–4 | Step 4 |
| Block quiz | One `doc_find`; one `docs_forcing` (not key) | Two `docs_forcing` | Three `docs_forcing`, one key |
| Block exam | Step 5, beyond-the-course tasks — 10% of the weight | 15% | 20% |

Moving one step up within a block — two `doc_find`/`docs_forcing` in a row without hints, like the rule for moving up the support ladder in `01`, §9. The step never drops below the starting step of the level.

**Documentation source per block (for `docs_target`):** Methodology — dora.dev/guides, sre.google (the books), kanbanguides.org, scrumguides.org; Linux — the image's man pages, `--help`, `/usr/share/doc`; Networks — man (`ip-route(8)`, `ss(8)`, `dig(1)`), RFCs via rfc-editor.org (L2 only); Docker — docs.docker.com/reference; Kubernetes — `kubectl explain`, `kubectl <cmd> --help`, kubernetes.io/docs; IaC — `terraform -help`, developer.hashicorp.com, `ansible-doc <module>`; CI/CD — docs.gitlab.com/ci/yaml; Monitoring — prometheus.io/docs, `promtool --help`.

**The "Methodology" block (my area) has steps 3–4 too:** "Find in the Kanban Guide which three practices are mandatory" (answer: defining and visualizing the workflow, actively managing items in the workflow, improving the workflow); "Find on dora.dev which group the failed deployment recovery time belongs to" (answer: throughput). Checking — `choice` on what was found, `docs_target` — the exact page anchor.

### 3. BLOCKING — R3/R4: the process explainers have not become tasks
**Where:** §2, §3.4, §4, §8.

**What is wrong.** R1 puts process explainers at the core of the product, R4 requires each of them to have parameters, "break it" and step-by-step playback. If nothing in the assessment refers to them, authors will have no incentive to make them checkable, and learners will have no incentive to return to them. Currently the only link is `label`/`hotspot` on static diagrams.

**Add a type to §2:**

| Type | What it checks | How it is checked automatically | Example |
|---|---|---|---|
| `explorer` (new) | The model of a process: the learner drives the explainer instead of answering a question about it | The task refers to an explainer (`explainer: k8s.rolling-update`) and sets a target condition over its state (the same `when` language as scene goals, `08` §7.5): "set the parameters so that…", "break a component so that…", "stop the playback at the step where…" | "Choose `maxSurge` and `maxUnavailable` so that with 4 replicas there are never fewer than 4 ready pods at any moment" → `state.minReady >= 4` |

Rules for `explorer`: before manipulating — `predict` (the learner writes down the expectation), after — a comparison with what the explainer computed; it counts only with a correct prediction on the first attempt + the condition reached. Every process explainer must have at least two `explorer` tasks and one `order` task over its steps — the build checks this the same way as "≥ 3 tasks of three types per concept".

**Ready `explorer` tasks for the "Methodology" block explainers (from R3; I will add the storyboards of the explainers themselves to `07`):**

```yaml
- id: meth.idea-to-prod.x01
  kind: explorer
  explainer: meth.idea-to-prod          # "A task from idea to prod" (E5 in 07, extended)
  concepts: [M04, M14, M15]
  q: { ru: "Эффективность потока сейчас 12%. Купите не больше двух улучшений так, чтобы время от идеи до прода стало меньше 3 дней. Сначала предскажите: какое ожидание на ленте самое длинное?", en: "Flow efficiency is now 12%. Buy no more than two improvements so that the time from idea to prod becomes less than 3 days. First predict: which wait on the timeline is the longest?" }
  predict: { choice: [wait-review, wait-build, wait-tester, wait-release-window], answer: wait-release-window }
  goal: { when: "state.leadTimeDays < 3 && state.purchased.length <= 2" }
  why_fail: { ru: "Вы ускорили работу, а не ожидание: время работы в этом потоке — 12% от общего." }   # en: "You sped up the work, not the waiting: work time in this flow is 12% of the total."

- id: meth.incident-flow.x01
  kind: explorer
  explainer: meth.alert-to-postmortem   # "Incident: alert → postmortem"
  concepts: [M12]
  q: { ru: "Прокрутите инцидент и остановитесь на шаге, где сервис для покупателей уже восстановлен, а причина ещё не найдена.", en: "Play the incident and stop at the step where the service has already been restored for customers but the cause has not been found yet." }
  goal: { when: "state.step == 'mitigated' && state.rootCauseKnown == false" }
  why_fail: { ru: "Восстановление идёт раньше поиска причины: сначала вернуть сервис (откат), потом разбираться." }   # en: "Recovery comes before finding the cause: first restore the service (rollback), then investigate."

- id: meth.bottleneck.x01
  kind: explorer
  explainer: meth.flow-bottleneck       # "Bottleneck in the flow" (E4 + the board)
  concepts: [M07, M09]
  q: { ru: "У вас один дополнительный человек. Поставьте его на этап так, чтобы выход за 20 дней вырос сильнее всего. Затем сломайте: снимите лимит WIP перед ревью и посмотрите, что стало с временем цикла.", en: "You have one extra person. Assign them to a stage so that the output over 20 days grows the most. Then break it: remove the WIP limit before review and see what happened to the cycle time." }
  goal: { when: "state.extraAt == state.bottleneck && state.wipLimitRemoved == true && state.observed('cycleTimeP85.up')" }
```

Similar `explorer` pairs for each explainer from R3 (Linux boot, fork/exec/PATH, pipe, systemd restart; URL, DNS, TCP+TLS, NAT, 504; docker run, build by layers, pull by manifest; kubectl apply, scheduling, rolling update, node failure, Service/Ingress/kube-proxy; git push→deploy; terraform plan/apply+state, idempotent Ansible; scrape→alert→notify) are written by the block roles; add a row to §13: "block roles: 2 `explorer` + 1 `order` for each process explainer".

### 4. MAJOR — R1: the assessment weights do not reflect the owner's priorities
**Where:** §0 items 1, 6; §6.1.

**What is wrong.** Practice 70% + explanation 30% is right for an exam, but the mastery model (§3.4) has no condition that the learner went through the module's process explainer and answered its `explorer` tasks. R1: the textbook, the explainers and the documentation are the core; practice stands on them.

**Fix — extend §0 item 5:**

> A module is closed when (1) the module's final check is ≥ 80% on the first attempt, (2) all key tasks are done, (3) **the `explorer` tasks of the module's process explainer are done**, and (4) **the module's documentation step task is done** (§4.1). Items 3 and 4 give no points, but without them the module does not close: these are the three pillars on which practice stands.

### 5. BLOCKING — R6: the Linux quiz does not check "how the kernel isolates and limits"; the isolation concepts are listed under Docker
**Where:** §8.2, §8.4 (D-2 "concepts D03–D07"), §9.2 (the trainer "unshare … lesson from `08` §6.1").

**What is wrong.** Under R6, processes and threads, namespaces, cgroups v2, capabilities, overlayfs/chroot and seccomp are introduced in Linux, and everything the containers block relies on must be introduced earlier. The Linux samples have not a single task on this, and D-2 refers to concepts D03–D05 (the `01` graph still keeps them in Docker — that is a fix for `01`, but `10` must also refer to the new ids). Ready tasks for §8.2 (concept ids are temporary, `L33…L40`, until `01` renumbers them):

**L-6. `predict`, L0–L2, concepts L17, L33 (thread).** The `java` process with PID 812 started 40 threads. What will `ls /proc/812/task | wc -l` show?
- **a) `40` — correct: each thread is a separate kernel task with its own TID, and all of them are in `/proc/<pid>/task`; the first TID equals the PID (the main thread). To see them together with processes — `ps -eLf` (the LWP column).** *(A clarification for authors: 40 threads including the main one; if it says "started another 40", the answer is 41 — pin down the wording in the variant.)*
- b) `1` — *incorrect: that is the number of processes, and one process can have many threads; the kernel schedules threads.*
- c) `0` — *incorrect: every process has a `task` directory, with at least the main thread in it.*
- d) An error: threads are only visible in `top -H` — *incorrect: `top -H` is one of the ways, `/proc/<pid>/task` is the original source.*

**L-7. `choice`, L1–L2, concepts L34 (namespaces).** `readlink /proc/1/ns/net` and `readlink /proc/2245/ns/net` print different numbers, `net:[4026531992]` and `net:[4026532301]`. What does this mean?
- **b) Processes 1 and 2245 are in different network namespaces: they have different interfaces, addresses, routing tables and firewall rules. To enter the second one's namespace — `nsenter -t 2245 -n ip a`; to list all — `lsns -t net` — correct.**
- a) Process 2245 was started by a different user — *incorrect: the user does not change the namespace; that is done by `unshare`, `clone()` with `CLONE_NEW*` flags, or `setns()`.*
- c) The number is the network interface number — *incorrect: it is the inode number of the namespace object; the same number = the same namespace.*
- d) Process 2245 is a thread of process 1 — *incorrect: threads of one process share namespaces.*

**L-8. `task`, L0–L2, concepts L35 (cgroups v2), L18. OOM-kill drill.** In the v86 sandbox (`lab-alpine`): create the cgroup `/sys/fs/cgroup/demo`, limit its memory to 32 MB, run `stress-ng --vm 1 --vm-bytes 64M` in it, and find the evidence that the kernel killed the process.
- Checking by facts: `cgroup[/demo].memory.max == 33554432`; `cgroup[/demo].memory.events.oom_kill >= 1`; the learner enters into a field a line from `dmesg` containing `Memory cgroup out of memory` or `oom-kill`, and it is present verbatim in the guest kernel log.
- Explanation of common mistakes: writing `32M` to `memory.limit_in_bytes` — "that is the cgroups v1 interface; in v2 the file is called `memory.max`"; the process was started before its PID was written to `cgroup.procs` — "the limit applies to processes that are in the group; move the PID into `cgroup.procs`".
- Link: "this is exactly what `docker run -m 32m` and `resources.limits.memory` in Kubernetes will do" — shown after submission, not before (the term "container" has not been introduced yet).

**L-9. `choice`, L1–L2, concepts L36 (capabilities), L12.** A program needs to listen on port 80 but does not need the rest of root's privileges. What is the right way?
- **c) Give the program file a single kernel capability: `setcap cap_net_bind_service=+ep /usr/local/bin/app`, check with `getcap`; run the process as a regular user — correct: root in Linux is a set of separate capabilities, and you can grant only the one needed. To view a process's capabilities — `grep Cap /proc/<pid>/status` and `capsh --decode=<mask>`.**
- a) Run as root — *incorrect: the process gets all capabilities, including `CAP_SYS_ADMIN`; a bug in it means full control over the machine.*
- b) `chmod 4755` (setuid) — *incorrect: setuid root gives the program full root on every run — worse than a).*
- d) `chmod 777` on the program — *incorrect: file permissions do not grant the right to a privileged port.*

**L-10. `predict`, L1–L2, concepts L37 (overlayfs), L25.** `mount -t overlay overlay -o lowerdir=/lo,upperdir=/up,workdir=/wk /merged` was run, then `echo new > /merged/a.txt` (the file `a.txt` was in `/lo`). Where are the two versions of the file now?
- **a) The old one stayed in `/lo/a.txt`, the new one is in `/up/a.txt`; `/merged` shows the upper one — correct: the lower layer is read-only, a write copies the file up (copy-up).**
- b) The file was changed in `/lo` — *incorrect: the lower layer does not change; layer reuse is built on this.*
- c) Only in `/merged` — *incorrect: `/merged` is a view, it has no data of its own.*
- d) In `/wk` — *incorrect: `workdir` is a service directory for overlay's atomic operations.*

Also, in §9.2 move the "Container vs VM" trainer (`unshare --pid --fork --mount-proc bash`) to the Linux lesson "How the kernel isolates" and link to it, rather than to `08` §6.1 as a Docker lesson. Seccomp — one idea-level `choice` ("which mechanism forbids a process the `mount` system call even when it has the privileges"), without practice.

### 6. MAJOR — R7: the Docker quiz and exam do not check the anatomy, the runtime chain and the six boundaries
**Where:** §6.2 (`exam-docker.yaml`, `t3.variant_of`), §8.4.

**What is wrong.** The t3 breakages (`fault-port-bind, fault-env-missing, fault-healthcheck, fault-oom`) do not cover the "process and signals", "I/O and logs", "UID and bind mount permissions" boundaries, and the quiz does not check the OCI bundle and the `docker → dockerd → containerd → shim → runc` chain.

**Fix 1 — tag the t3 breakage pool by boundary (one is chosen by the seed), replace the `variant_of` line:**

```yaml
variant_of:
  - { id: fault-listen-loopback,  boundary: network,  hint_layer: "the application listens on 127.0.0.1 in its own netns" }
  - { id: fault-port-conflict,    boundary: network,  hint_layer: "the host port is taken — there is nowhere to put the DNAT" }
  - { id: fault-volume-perms,     boundary: identity, hint_layer: "bind mount of a root:root 0755 directory, the process runs as UID 1000" }
  - { id: fault-env-missing,      boundary: config }
  - { id: fault-pid1-no-sigterm,  boundary: process,  hint_layer: "shell form of CMD: sh is PID 1, SIGTERM does not get through, stop waits 10 s and sends SIGKILL (code 137)" }
  - { id: fault-log-to-file,      boundary: io,       hint_layer: "the application writes its log to a file inside the container, docker logs is empty" }
  - { id: fault-oom,              boundary: kernel }
  - { id: fault-tmp-ephemeral,    boundary: storage,  hint_layer: "uploads are written to the overlay upper layer and disappear when the container is recreated" }
```

Write the `boundary` of the failed breakage into the exam protocol; the debrief says "the cause sat on the *identity* boundary: the UID inside ≠ the owner of the directory outside".

**Fix 2 — add to §8.4:**

**D-6. `order`, L1–L2, concepts D10.** Put in order who `docker run nginx` passes through before it reaches the nginx process: (1) `runc` (or `crun`) creates the namespaces and the cgroup and does `exec`, (2) the `docker` CLI sends a request over the `/var/run/docker.sock` socket, (3) `containerd` prepares the filesystem snapshot and the OCI bundle, (4) `dockerd` validates the request and calls `containerd`, (5) `containerd-shim` stays as the parent of the container process. **Answer: 2 → 4 → 3 → 5 → 1** (the shim starts before runc and calls it; after the start runc exits, while the shim stays). Explanation: "if runc has exited, why is the container alive? — its parent is the shim; that is why restarting dockerd with `live-restore` does not kill containers".

**D-7. `predict`, L1–L2, concepts D11, L18, L35.** `Dockerfile`: `CMD python app.py` (shell form). `time docker stop app` — roughly how long is the wait, and what is the container's exit code?
- **a) ~10 seconds, code 137 — correct: in the shell form PID 1 is `/bin/sh -c`, which does not forward SIGTERM; after 10 s (by default) Docker sends SIGKILL, 137 = 128 + 9. The fix is the exec form `CMD ["python", "app.py"]` or `--init` (tini) / `exec` in the startup script.**
- b) Instantly, code 0 — *incorrect: that would be the case with the exec form and a SIGTERM handler.*
- c) ~10 seconds, code 143 — *incorrect: 143 = 128 + 15 (terminated by SIGTERM); here the signal never reached the application.*
- d) The container will not stop — *incorrect: SIGKILL always stops it.*

**D-8. `choice`, L1–L2, concepts D12, N17.** What does `-p 8080:80` actually do in the default mode?
- **b) Adds a DNAT rule to the `nat` table in the `DOCKER` chain: packets to port 8080 on the host get the destination address `<container IP>:80`; for requests from the host itself to `localhost`, `docker-proxy` additionally works — correct. To see it: `iptables -t nat -L DOCKER -n` (or `nft list ruleset`).**
- a) Opens a port in the firewall — *incorrect: this is address translation, not a permission.*
- c) Creates a second interface in the container — *incorrect.*
- d) Copies the traffic into the container through a shared socket — *incorrect.*

**D-9. `match`, L0–L2, concepts D13, D23 + boundaries.** Match the symptom with the container boundary where to look for the cause: "`Permission denied` when writing to a mounted directory" — identity (UID); "the uploaded files disappeared after `docker rm`" — storage (the overlay upper layer); "`docker logs` is empty, but the application works" — I/O (it writes to a file, not to stdout); "`docker stop` waits 10 seconds" — process and signals (PID 1); "`curl` from the host — reset" — network; "the container was killed, code 137, oom-kill in `dmesg`" — kernel (cgroup memory).

**Fix 3 — turn the "hardware → VM → containers → nesting" explainer (R7c) into two `explorer` tasks:** "move the number-of-applications slider so that on the same 64 GB the containers fit at least 5 times more than the VMs, and name which VM resource ran out first" (the answer comes from the counter: memory for guest kernels); "turn on a 'kernel vulnerability' and mark all the applications it affects in both towers". And one `task` on tier B: "show that the browser machine itself is a VM (`dmesg | grep -i hypervisor` or DMI), compare `uname -r` and `ps` outside and inside a container, measure the container start time and the boot time of a second v86 machine" — check: the numbers entered match the environment facts ±20%, `uname -r` is the same outside and inside.

### 7. MAJOR — R8: network checks are not tied to the model layer, there is no protocol catalog in the bank
**Where:** §3.1 (`misconceptions.yaml`), §8.3, §9.2 (the "504" drill).

**What is wrong.** The owner's principle is "first ask which layer broke". Tasks N-1…N-5 and the drill rubric lack this step. A protocol catalog with a uniform card (why, layer, exchange diagram, how to observe, how it breaks) should generate tasks uniformly.

**Fix 1 — add a `layer: L1|L2|L3|L4|L7|mixed` field to the task and misconception format** (mandatory for the "Networks" block and for Docker/Kubernetes network tasks), and make the first criterion of the situational drill rubric (§9.2) "Named the layer": 0 — did not name it; 1 — named it without evidence; 2 — named it based on evidence ("ping by IP works — L3 is intact"); 3 — named it and narrowed it down as new evidence came in.

**Fix 2 — a task template from the protocol card** (the build generates them for each card in the catalog, the author only edits):

```yaml
protocol_card_items:              # for each card protocol: dhcp|arp|icmp|tcp|udp|dns|http|tls|ssh|…
  - kind: order                   # exchange steps from the card's sequence diagram
    q: "Расставьте сообщения {{protocol}} по порядку"     # en: "Put the {{protocol}} messages in order"; DHCP: DISCOVER → OFFER → REQUEST → ACK
  - kind: match                   # header field ↔ layer
  - kind: choice                  # "how it breaks": symptom → likely cause; distractors are neighboring layers
  - kind: doc_find                # "how to observe": find the filter for this protocol in man tcpdump
```

**Fix 3 — three ready tasks for §8.3:**

**N-6. `choice`, L0–L2, concepts N07, N12, N13.** `ping 10.0.0.5` works, `curl http://10.0.0.5:8080` hangs and fails with a timeout. At which layer should you look?
- **b) L4 and above on the way to the port: a firewall silently drops TCP to 8080, or the service is not listening on the external address; L3 is intact — ping proved it — correct. Next step: `ss -ltn` on the server and `tcpdump -n port 8080` — do the SYNs arrive.**
- a) L3, no route — *incorrect: ICMP reaches the address and comes back.*
- c) L7, an application error — *incorrect: it never got to HTTP, the connection was not established; an application error would have produced a response code.*
- d) L2, ARP — *incorrect: without ARP, ping would not have worked either.*

**N-7. `order`, L0–L2, concepts N10.** DHCP messages when a laptop connects: OFFER, ACK, DISCOVER, REQUEST. **Answer: DISCOVER → OFFER → REQUEST → ACK.** Explanation: "REQUEST comes after OFFER because the client may receive several offers and picks one; ACK is the server's confirmation, after which the address can be used".

**N-8. `match`, L1–L2, concepts N07 (as a vocabulary).** "L7 load balancer" — looks into HTTP: the path, the Host header, cookies; "L4 load balancer" — sees only TCP/UDP addresses and ports; "a problem at L2" — ARP does not answer, a duplicate MAC, the wrong VLAN; "a problem at L3" — no route, a wrong netmask, NAT.

Protocols at the "intermediate/experienced" level (HTTP/2, QUIC, gRPC, VXLAN, WireGuard, BGP, mTLS) get tasks from the same template with `level: [L1, L2]` or `[L2]`; the "Networks" block exam has at least one task on a protocol from the catalog at the learner's level.

### 8. MAJOR — R9: Kubernetes networking is not checked as a separate topic
**Where:** §8.5, §6.3 pool C.

**What is wrong.** K-2 is the only Kubernetes networking task. Missing: ClusterIP is not attached to any interface, the packet path through the iptables chains, cluster DNS and `ndots`, the diagnostic order for "a pod could not reach a service", NetworkPolicy is open by default.

**Ready tasks for §8.5:**

**K-6. `task` (drill), L1–L2, concepts K14, K15, N17.** "Find in the node's rules where a packet to ClusterIP `10.43.12.7:80` will go." In "SSH to node" on the hybrid cluster (R11), the learner runs `iptables -t nat -L KUBE-SERVICES -n | grep 10.43.12.7` → the `KUBE-SVC-…` chain → `KUBE-SEP-…` → `DNAT to:10.42.1.9:8080`. Check: the learner enters the final `IP:port` of the pod(s), and they match the service's EndpointSlice in the cluster facts; if there are two endpoints, both are needed, plus the probability `0.5` in the first one's rule. Explanation: "ClusterIP does not belong to any interface: it is an address that exists only in the NAT rules (in iptables mode; in IPVS mode kube-proxy attaches it to the service interface `kube-ipvs0`; in Cilium with kube-proxy replacement the translation is done by eBPF on the socket or on the interface)".

**K-7. `choice`, L1–L2, concepts K14.** `ping 10.43.12.7` (a ClusterIP, kube-proxy in iptables mode) does not answer, while `curl 10.43.12.7` returns 200. Is the service broken?
- **b) No: the DNAT rules are created only for the service's TCP/UDP ports; nobody handles ICMP to a ClusterIP — correct.**
- a) Yes, the endpoints are empty — *incorrect: then curl would not work either.*
- c) CoreDNS is broken — *incorrect: this is an address, not a name.*
- d) A NodePort is needed — *incorrect: a ClusterIP is reachable from inside the cluster without a NodePort.*

**K-8. `predict`, L1–L2, concepts K16.** In a pod in the `shop` namespace, `nslookup api` is run. Which name will the resolver try first if `/etc/resolv.conf` has `search shop.svc.cluster.local svc.cluster.local cluster.local` and `options ndots:5`?
- **a) `api.shop.svc.cluster.local` — correct: the name has fewer than 5 dots, so the suffixes from `search` are tried first; that is also why a query from a pod to the external `api.example.com` first goes through three extra queries, and a trailing dot is added to external names (`api.example.com.`).**
- b) `api` as is — *incorrect with ndots:5.*
- c) `api.cluster.local` — *incorrect: that is the last suffix.*
- d) `api.default.svc.cluster.local` — *incorrect: search is built from the pod's namespace.*

**K-9. `order`, L1–L2, concepts K14, K16, K26, K33 + NetworkPolicy.** The checking order for "the `client` pod could not reach the `api` service": (1) NetworkPolicy in the `api` namespace (default-deny, selectors); (2) the name resolves (`nslookup api.<ns>`); (3) the service has endpoints (`kubectl get endpointslices -l kubernetes.io/service-name=api`); (4) the target pod answers directly on IP:port; (5) the service port and `targetPort` match the container port. **Answer: 2 → 3 → 5 → 4 → 1** — along the packet path, from the name to the pod; NetworkPolicy goes last because traffic is open by default, and a policy is a frequent but not the first cause. Partial credit — by the longest correct subsequence (§2).

**K-10. `choice`, L1–L2, concept NetworkPolicy.** The NetworkPolicy `default-deny-ingress` was applied in the `shop` namespace, but traffic still flows. What is most likely?
- **c) The cluster's CNI does not implement NetworkPolicy (for example, flannel without an add-on): the API server accepts the object, but there is nobody to enforce it — correct.** The other distractors — "the policy applies only to new pods", "kube-proxy needs a restart", "you need to specify `egress`" — with explanations.

Add to the "On-call" pool C the cause "a NetworkPolicy added in the same rollout cut the new pod off from the database" (blocks Kubernetes, Networks).

### 9. MAJOR — R10: the reconciliation loop and your own controller are not checked
**Where:** §8.5, §10 (pet project 8).

**What is wrong.** R10 builds a bridge "reconciliation loop → chain of controllers → your own controller in the browser → an operator in Go". The bank has only K-1 (`order`), and pet project 8 has no intermediate browser step.

**Ready text.**

**K-11. `explorer`, L0–L2, concepts K02, K03, K11.** The "Desired and actual" explainer: on the left, YAML in etcd (`replicas: 3`), on the right, the pods, in the middle, the controller. Task: "Delete one pod and stop the playback at the step where the controller detected the mismatch. How many pods will it create?" → `predict: 1`, `goal: state.step == 'diff-detected'`. Second part: "Change `replicas` to 2 without touching the pods. Which pod will the controller delete?" (`predict`: the newest / random per the ReplicaSet rules — the reference answer is computed by kube-lite; the explanation describes the order of choosing a deletion candidate: first unscheduled, then not ready, then younger ones).

**K-12. `task` "Your own controller", L1–L2, concepts K03, K30.** In the browser editor the learner writes a function `reconcile(desired, actual) → actions[]` in TypeScript (the sandbox is a Worker without network access). The check is not by text but by a run against a kube-lite perturbation scenario:

```yaml
check:
  run_controller:
    resource: { kind: Greeting, spec: { replicas: 2, message: "hi" } }   # a training CRD
    perturbations: [delete-one-pod, set-replicas-4, change-message, kill-node-1, noop-x5]
    expect:
      - converges_within_ticks: 5           # after each perturbation actual == desired
      - no_actions_when_equal: true         # on noop-x5 — an empty action list (idempotency)
      - no_duplicates: true                 # at no moment more pods than desired + 0
      - owner_refs_set: true                # created objects have ownerReferences to Greeting
```

The failure explanation goes point by point: "the controller creates a pod on every tick even when everything matches — you are comparing not with the actual state but with your last action", and so on. Passing K-12 is the condition for unlocking pet project 8 (the "Unlocks after" row in §10: "Kubernetes (L2) + task K-12"), and the acceptance criteria of pet project 8 should be reworded in terms of the same four properties, checked by `trainer-check` on a real cluster.

### 10. BLOCKING — R11: "On-call" is described on an environment that does not exist
**Where:** §6.3 ("a VM with nginx and an application in Docker, next to it the simulator's k3s cluster, the simulator's Prometheus with Grafana").

**What is wrong.** (a) The "simulator's k3s cluster" does not exist: in `05`/`09` it is kube-lite, and a real k3s in v86 is impossible (32 bits, memory) — R11 and `05` §1 say so directly. (b) "A VM with nginx and Docker" in the browser is either the Stand+dsim (tier A) or v86 (tier B), where dockerd is "uselessly slow" (`09` §1.2). (c) The R11 decision on the hybrid cluster is not accounted for: a kube-lite control plane + v86 nodes with a small kubelet agent and `crun`. (d) The memory constraints are not stated: 3–4 nodes of 64–128 MB each on a laptop, one on a phone.

**Ready text for §6.3, the "Environment" paragraph:**

> **The "On-call" environment** is hybrid (tier A + B, `09`): the control plane is kube-lite in `sim.worker.ts`; two worker nodes are v86 `lab-alpine` machines with 96 MB each in separate Web Workers, connected by our virtual switch (real L2: ARP, `tcpdump`, `iptables`); each node runs a kubelet agent that starts pods via `crun` as assigned by kube-lite, so `kubectl exec` enters a real container, and a "node failure" is a stopped machine. A third v86 machine is the "shop server" with nginx and the application as systemd services (without dockerd). Prometheus and Grafana are tier A simulators, but they collect metrics from the real node agents. The exam is available only on a computer with `navigator.deviceMemory >= 8` (~500 MB is needed for three machines); on a weak device, the same exam runs entirely in tier A (dsim + kube-lite without v86), marked `env: sim` in the protocol.

**Add pool E:**

| Pool | Symptom | Possible causes | Blocks |
|---|---|---|---|
| E | Alert `KubeNodeNotReady`, some pods `Terminating`/`Pending` | the node is stopped (the v86 machine is powered off); the kubelet agent crashed (a service on the node); the node ran out of memory and the agent was OOM-killed | Kubernetes, Linux |

Check for E: the pods were recreated on a live node within kube-lite's `pod-eviction` timeout; in the status update the learner stated that the node is unreachable and what was done (cordon/drain or waiting), and did not delete pods by hand before gathering evidence.

### 11. BLOCKING — R12: the final exam diverges from the three Kubernetes stages
**Where:** §6.4 (A3, A4, part C, "Protocol"), §10 (pet project 7).

**What is wrong.** (a) A4 is "k3s on at least two nodes"; R12, stage 3 is kubeadm on 3+ VMs, Cilium, storage, certificates, a version upgrade, etcd backup/restore, with the VMs ordered by Terraform and configured by Ansible. (b) There is no display of VM cost and no **mandatory cleanup step** with a check. (c) The defense question "why k3s and not kubeadm" implies that the learner did not do kubeadm. (d) It is not stated that at stage 3 the trainer does not execute anything but guides and checks.

**Ready text replacing A3–A4 and a new A7:**

| No. | Requirement | How it is checked |
|---|---|---|
| A3 | VMs (3+) are created by Terraform and configured by Ansible (node preparation: kernel modules, sysctl, containerd, kubeadm/kubelet of the required version); a repeated playbook run gives `changed=0`, a repeated `terraform plan` gives `No changes` | `plan_expect` and `idempotent` on the pasted output; `trainer-check` compares the actual state of the nodes (`modprobe`, `sysctl`, package versions) with the roles in the repository |
| A4 | A kubeadm cluster (L2) or k3s of 3 nodes (L0, L1): 1 control plane + 2 workers, CNI Cilium (for kubeadm), a StorageClass, the application as a Helm chart via Argo CD; for L2 additionally: an etcd snapshot was taken and verified with `etcdctl snapshot status`, the cluster was upgraded by a minor version (track R4 from `05`) | `trainer-check run --track capstone --nonce …` (syntax from `09` §5.4): nodes Ready, versions, Application Synced/Healthy, revision = HEAD, `trainer-proof` |
| A7 | **Cost and cleanup.** Before the VMs are ordered, the trainer shows a calculation based on `providers.yaml` (`05` §10.2): price per hour and for 14 days at the chosen provider; a timer "VMs have been running for N hours, spent ≈ X ₽/€". After the defense — a mandatory `terraform destroy` step | The exam does not close until the learner has pasted the output of `terraform destroy` (`Destroy complete! Resources: N destroyed`, where N = the number of resources in the state) **and** `trainer-check cleanup --label trainer=devops` (the provider's VM list by label is empty). A protocol without the "cleaned up" mark is marked "VMs not deleted" |

Replace the defense question "why k3s and not kubeadm" with "what would you have gained and lost by installing k3s instead of kubeadm" (for L2) and "what did k3s hide from you compared to kubeadm" (for L0/L1). Add a sentence to §6.4: "At stage 3 the trainer executes nothing on the learner's machines: it shows the steps and commands and checks the result with a read-only agent".

### 12. MAJOR — R5: the assessment pages are not described visually
**Where:** §6.4 "Protocol", §6.1, §9.3.

**What is wrong.** The exam protocol, the exam screen and the path review are the most "presentable" pages of the product, yet their appearance gets a single sentence, "the font and layout are up to the visual language role" (and only for the resume).

**Ready text (one paragraph in §6.4 and §13):**

> The exam protocol and the path review use the engine's editorial layout (`08` §5): a text column, numbers in tabular figures, color only for meaning — green for "check passed", red only for `critical`, gray for "not checked"; the block color (kernel/user space, network layers, Kubernetes components) repeats the lesson palette. The learner's path is a horizontal ribbon of commands with the marks "evidence", "no hypothesis", "destructive action", scrolled like a stepper (`08` §3.1), with no animation other than the step transition; in calm mode it is a static list. No badges, confetti or characters. The protocol prints on A4 and opens via a QR code on a phone (`handoff`).

---

## B. Factual and technical errors

### 13. MAJOR — DORA: wrong grouping of metrics and the wrong year
**Where:** §8.1, M-4, option (b).

**What is wrong.** "stability (change failure rate, recovery time, and since 2025 also the share of unplanned deployments, rework rate)" is wrong twice over. On dora.dev now: **throughput** — change lead time, deployment frequency, **failed deployment recovery time**; **instability** — change fail rate, deployment rework rate. Recovery time was moved to throughput, and rework rate was introduced **in the 2024 report** (where MTTR was also renamed to failed deployment recovery time). My `07` (E10, question M8) already teaches it this way — the `10` quiz currently contradicts the lesson.

**Fix — option (b):** "Speed went up, stability went down; the improvement is not proven. DORA looks at five metrics together: throughput — change lead time, deployment frequency, failed deployment recovery time; instability — change fail rate and the share of unplanned (remediating) deployments, rework rate, added in 2024". Source: https://dora.dev/guides/dora-metrics/ and https://dora.dev/guides/dora-metrics/history/.

### 14. MINOR — small inaccuracies in the samples
- **K-4 (§8.5):** "the pod limit turns into a cgroup memory limit" → "the *container* limit" (`memory.max` of the container's cgroup; for the pod it is the sum). Add to the explanation: `OOMKilled` also happens without exceeding the container's own limit, when the whole node runs out of memory — then `oom_score_adj` by QoS class decides.
- **D-2 (§8.4):** "an image with a different kernel (for example, Windows on a Linux host)" — an image has no kernel. Replace with: "a program built for a different kernel (for example, a Windows image on a Linux host) cannot be run without a VM".
- **I-2 (§8.6), option (d):** `terraform refresh` is deprecated; write `terraform apply -refresh-only`.
- **L-2 (§8.2):** the word "descriptor" and `lsof` are not introduced in the `01` graph (there is no "file descriptor" concept). Either add the concept (naturally, in a new Linux section "a process and its resources" next to `/proc/<pid>/fd`), or rewrite as "while the file is open by a process".
- **K-1, K-5:** `concepts` is missing K12 (Deployment) and K27 (controller-manager), although they are named in the text — the §2 vocabulary linter will fail the build by itself.
- **C-1:** "`forbid`: `only/except` is counted with a mark" contradicts the semantics of `forbid` ("workarounds are not counted", §6.1). A separate `warn` type is needed (count it, but mark it).
- **§6.2, t1b:** `node:22-alpine` in `docker images` weighs about 150–160 MB by itself; the "< 150 MB" threshold for the Node variant may be unreachable without changing the base. Compute the threshold from the variant's base size (`base_size + 30 MB`) or verify it on the golden recording.
- **§6.3, table, pool A:** "the firewall drops packets to the upstream (connection timeout)" and **step 3B of the "504" drill** — consistent; good. But in step 5 of the drill, "first restore the service (rollback)" — for the cause "a new `drop` rule", rolling back the release will not help; the explanation must distinguish "rolling back the change that caused it" (the firewall rule) from "rolling back the release".

### 15. MINOR — `lint: hadolint` cannot be implemented in the browser "as is"
**Where:** §3.1, §6.2.

hadolint is written in Haskell, and there is no official WebAssembly build. Either state explicitly in §13 "engine: a subset of hadolint rules (DL3xxx, SC) in TypeScript, cross-checked against the real hadolint in CI on the same files", or replace it with `lint: dockerfile` with a list of rules. The same goes for `lint: gitlab` — offline this is the JSON Schema of `.gitlab-ci.yml` (the one editors use), not the `/ci/lint` API, which needs a token.

---

## C. Concept order (my area — methodology)

### 16. BLOCKING — samples M-1, M-2, M-5 use terms that do not exist yet in the "Methodology" block
**Where:** §8.1.

**What is wrong.** The "Methodology" block quiz is block 1 (`01` §5). In it:
- M-1: "a commit to main" (C02, C03 — block 5), "artifact" (C09), "GitOps" (K29 — block 6).
- M-2: "linter", "unit/integration tests", "image", "registry" (D18 — block 4); C09 is listed directly in `concepts`.
- M-5: "Infrastructure as Code" (I01 — block 7) and `concepts` I01, O08.
The `10` §2 vocabulary linter will not let these tasks through by itself, but the document presents them as ready samples — authors will copy them. My glossary (`07` §3) introduces only: repository and merge, build, automated test, staging environment, CI, delivery, deployment, pipeline, rollback, alert/monitoring.

**Ready replacements:**

**M-1 (rewritten).** "Every change is automatically built and checked by tests after the merge, and the result can be released to prod at any moment. A person releases it to prod with a button." Options: a) continuous integration; **b) continuous delivery**; c) continuous deployment; d) "manual release on a schedule (release train)" — *incorrect: with a train, the release waits for a window, while here it is at any moment; the train is from scenario S5*. Remove GitOps from the distractors; the question "how is GitOps different from CD" goes to the Kubernetes quiz (`concepts: [K29, M15]`).

**M-2 (rewritten), `concepts: [M14, M15, M17]`.** Stages: (1) release to prod, (2) build, (3) fast automated tests, (4) release to the staging environment, (5) check on the staging environment, (6) manual approval. **Answer: 2 → 3 → 4 → 5 → 6 → 1.** The explanation is the same (fail fast). The variant with "image and registry" goes to the CI/CD quiz (`concepts: [C08, C11, M17]`), where it already fits.

**M-5 (rewritten), `concepts: [M07, M10, M11, M12, M14]`.** Pairs: "servers are configured by hand, each one a little differently" → "automating routine work" (M10; IaC is named in the IaC block); "we learn about the site going down from customers" → "symptom-based alerts" (term 44 in `07`); "branches are merged once a month" → CI; "the same outages keep recurring" → blameless postmortem; add a fifth pair, "work piles up at the review stage" → WIP limit.

### 17. MAJOR — two identifier systems for "M" and three for "R"
**Where:** §8.1 (`concepts M14–M16`, `M07, M09`, `M13`), §9 (`R01–R10`, `R04`, etc.), and in the neighboring documents — `05` tracks R1–R5, owner requirements R1–R12.

**What is wrong.** In `07` the modules are named M0–M12 (M10 is "incidents"), while in the `01` graph the concepts are M01–M18 (M10 is "automation"). The entry "concepts M10, M12" in M-5 can be read two ways. With "R" it is worse: R04 (answer structure), R4 (the kubeadm upgrade track in `05`), R4 (the owner requirement about the explainer style).

**Fix.** In `10`, write concepts only with the block prefix in the bank: `concepts: [meth.M14]`, modules — `module: meth.m07`; the real `05` tracks — `track: k8s.r4`; career concepts — `career.R04`. This is one line in §3.1 ("identifier format") and a replacement in §8–9; on my side I will rename the `07` modules to lowercase `m0…m12`.

---

## D. Discrepancies with neighboring documents

### 18. MAJOR — the methodology exam does not fit the "single format"
**Where:** §0 item 6 ("the format is the same in all blocks"), §6.1, §6.2.

**What is wrong.** The "Methodology" block exam in `07` is S8 "Black Friday" in the `flowlab` flow simulator (45 days, a rubric with six dimensions, passing — 5 out of 6 + "Understanding") plus a second part on live data (CSV, metrics with a 5% tolerance). This is not "3–5 tasks in a sandbox + 2 `explain`, all critical + ≥ 70%". Without an explicit mapping, one of the two specifications will be ignored.

**Ready specification in the `10` §6.2 format (I propose inserting it into §6.2 as a second example):**

```yaml
# content/bank/methodology/exam/exam-methodology.yaml
id: exam-methodology
block: methodology
time_limit_min: 120
sandbox: { engine: flowlab, scenario: S8, seed: "{{seed}}", replay: false }
tasks:
  - id: t1                      # S8, dimensions "Flow", "Delivery"
    weight: 25
    checks:
      - { id: t1a, points: 15, state: "metrics.cycleTimeP85[30..45] <= 0.6 * metrics.cycleTimeP85[1..10]" }
      - { id: t1b, points: 10, state: "metrics.deployEveryDays[36..45] <= 2 && metrics.leadTimeDays[36..45] < 3" }
  - id: t2                      # "Stability" — critical
    weight: 20
    checks:
      - { id: t2a, critical: true, state: "metrics.downtimeMin[sale] < 30" }
      - { id: t2b, points: 10, state: "metrics.changeFailRate[31..45] < 0.2" }
  - id: t3                      # "Money", "People"
    weight: 15
    checks:
      - { id: t3a, points: 8, state: "money.net >= 1.1 * baseline.money.net" }
      - { id: t3b, points: 7, state: "people.gena.unplannedShare[36..45] < 0.5 && people.gena.overtimeDays <= 3" }
  - id: t4                      # 07 §9.2, live data
    weight: 10
    checks:
      - { id: t4a, points: 10, numeric: { fields: [throughputWeekly, cycleP50, cycleP85, wipAvg, dora5], tolerance: 0.05 } }
explain:
  weight: 30
  questions:
    - { id: e1, q: { ru: "Три решения, которые вы считаете главными, и что показали контрфакты", en: "The three decisions you consider the most important, and what the counterfactuals showed" }, rubric: rubrics/explain-default.yaml, critical: true }
    - { id: e2, q: { ru: "По данным второй части: где узкое место и три изменения с ожидаемым эффектом", en: "Based on the data from the second part: where the bottleneck is, and three changes with their expected effect" }, rubric: rubrics/explain-default.yaml }
pass: { critical: all, total_min: 70 }
```

In `07` §9.1 I will replace "5 out of 6" with this specification; in `10` the claim that the content of a block exam is defined only by "a sandbox with tasks" needs to be removed — for methodology, the sandbox = a `flowlab` run.

### 19. MAJOR — the explanation rubric and the neural network's answer format diverge from `07`
**Where:** §6.1 "Explanations", §9.3 (JSON `scores{score, evidence}`), §13 ("the status and postmortem rubric is shared with the methodology block").

**What is wrong.** `07` §9.3 has five binary "present/absent" items, JSON `{criteria:[{id, pass, quote, comment}]}`; `10` has 0–3 with anchors and `evidence`. §13 claims that the rubric is shared, but it does not exist.

**Fix.** One schema for the product: `criteria[{id, score: 0..3, evidence, note}]`, where a binary item is a special case with the scale `{0, 3}`. My five items become the criteria of `explain-default.yaml` (term; mechanism; a number/reference to data; no blame; the proposal is verifiable), and the interview "0–3" items become a separate rubric. In `07` I will switch the format; in `10` §11, write in the "Rubric" row: `criteria[{id, scale: [0,3] | [0,1,2,3], anchors}]`.

**Ready status and postmortem rubric for "On-call" and `07` (insert as `rubrics/incident.yaml`):**

| Criterion | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Impact | Not stated | "The site is slow" | Who is affected and how badly ("checkout for everyone, ~30% of requests 504") | + since when and whether it is growing |
| What we are doing | Nothing | An action without a goal | An action and what we expect from it | + how we will roll back if it does not help |
| Next update | None | "Later" | A time | A time and a condition ("at 14:40 or earlier if…") |
| Postmortem: timeline | None | One event | Key moments with times | + the moment of detection and the moment of recovery |
| Postmortem: contributing factors | A guilty person is named | A single "root cause" | Two or more system conditions | + why the safeguard did not work |
| Postmortem: actions | None | "Be more careful" | A verifiable change | + an owner and a deadline |

This also fixes §6.3: "three lines of the postmortem (symptom, *cause*, what will prevent it)" teaches looking for a single root cause, while a blameless postmortem (`07` M10, SRE Workbook) talks about contributing factors. Replace with "timeline, impact, contributing factors, actions" — in four lines.

### 20. MAJOR — the "no server" position contradicts `09`
**Where:** §0 item 7, §3.3 ("the only server-side part of assessment"), §6.4 "Protocol" ("without our own server we cannot confirm authenticity"), §13 "Platform".

**What is wrong.** `09` has already adopted `dt-api`: journal sync, login, the `trainer-check` agent in server mode with an Ed25519 signature and an `attest` field, "presentable exams: signed breakage packages, a server timer, signed results". `10` is designed as if there is no server and never will be.

**Fix.** In §6.4 "Protocol" and §0 item 7: "Two modes, as in `09` §5.4: *self-check* (no server, code in a ConfigMap, an unsigned protocol — the default for your own clouds) and *presentable exam* (via `dt-api`: a server timer, the part B breakage package is signed and applied by the agent, the results are signed, the protocol gets a `signature` and a verification page via a link). The protocol of a presentable exam is still not a certificate, but its authenticity can be verified by a third party". Align the command syntax with `09`: `trainer-check run --track capstone --nonce …` instead of `trainer-check capstone`.

### 21. MAJOR — the size and composition of the module quiz, the storage location
**Where:** §3.1 (`content/bank/<block>/…`), §3.2, §4.

**What is wrong.** `10`: a module quiz has 4–6 tasks, ≥ 8 tasks per module in the bank, the path `content/bank/methodology/`. `07` §9.4: a module test has 6–10 tasks from a bank of 15–25, the path `content/methodology/quizzes/*.yaml`, mistakes are repeated "after 1, 3 and 7 days" (rather than FSRS).

**Fix.** Adopt the `10` decision (FSRS, `content/bank/`), but raise the lower bound of the bank for blocks with generators: in methodology the "Little's law", "DORA from the log" and "Nines" tasks are infinitely parameterized, so the "≥ 8 tasks" rule is satisfied for them by a single generator — add to §3.2: "a generator (`kind: generated`, `generator: flowlab.little`) counts as N tasks, where N is the number of distinguishable answer types, but no more than 4". On my side I will switch `07` to FSRS and the `content/bank/methodology/` path.

### 22. MINOR — the career block schedule does not match `01`
**Where:** §9, the introductory paragraph.

`01` §5: the self-presentation comes after Docker, the mock interview after Kubernetes. `10`: the self-presentation and the mock interview come after the first pet project (and pet project 1 unlocks after Linux, Networks, Docker, CI/CD). The `10` decision is more sensible (there is something to talk about), but `01` needs to be fixed and this recorded as a decision with a reason, otherwise the graph linter will unlock the modules according to `01`.

### 23. MINOR — SLI/SLO are introduced in two places
**Where:** §9.2, the "Mandatory questions" table, the row "Monitoring: SLI/SLO (at the concept level)"; the "Methodology" row does not include SLO.

`07` introduces SLI/SLO/error budget in M9 (terms 41–43), the `01` graph in O09 (monitoring). There should be one place. I propose: the concept in methodology (M9 of `07`), the numeric implementation (`recording rules`, burn rate in PromQL) in monitoring as `uses`. In the "Mandatory questions" table, "Methodology" row, add: "Kanban vs Scrum; WIP and why a limit speeds things up; SLO and error budget; blameless postmortem".

---

## E. Pedagogy and assessment methodology

### 24. MAJOR — "On-call" does not check prioritization of the incident flow
**Where:** §6.3.

**What is wrong.** "Three incidents in a row" is a sequential queue, while a real shift is overlapping events. The main skill of an on-call engineer in Kanban and SRE terms is classes of service (the expedite lane) and limiting work in progress: not starting three investigations at once, handling first what hits users.

**Ready text:** "Incidents arrive with overlap: the second one 8–12 minutes after the first, the third while the second is still open; one of the three is always low-impact (pool D, 'the pipeline is red'). On the right is the on-call board with the columns 'New → Investigating → Mitigated → Closed' and a WIP limit of 1 in 'Investigating'. What is assessed: the incident with the greatest user impact (according to alerts and metrics) was taken first; the low-priority one was deferred with a message in the chat, not forgotten; no more than one incident at a time in 'Investigating'. This is the 'Prioritization' 0–3 rubric criterion and a shared vocabulary with the methodology block (`07` M4 'class of service', M6 'unplanned work')".

### 25. MINOR — the application funnel is a Kanban board, and flow metrics are worth reusing
**Where:** §9.7 "Application funnel".

The funnel "application → response → screening → technical → final → offer" is the same board the learner built in the "Methodology" block. I propose showing it as a `flowlab` board (display only, no simulation): work item age — "application without a response for 14 days — close it"; throughput — applications per week; CFD for the month. This is one line in §9.7 and a strong learning bridge: the learner applies Little's law to their own job search ("with 12 applications a week and an average path of 3 weeks, you have ~36 applications in progress").

### 26. MINOR — M-3: the explanation does not say where to put the finished card
**Where:** §8.1, M-3.

The correct option (b) is right, but a beginner will ask: "and where does my card go?". Add to the explanation: "Your card stays in the 'Development' column marked 'done' (or in the 'Ready for review' subcolumn, if there is one) — this is exactly the visible queue that the limit does not let move further". Otherwise the learner will decide that the limit "hides" work.

### 27. MINOR — quiz levels: an experienced learner should not solve what they skipped through the level check
**Where:** §4, §8 (levels `L0–L2` on almost all samples).

For L2 in methodology (`07` §2.1) the path is M7–M12; tasks M-3 (WIP limit) and M-5 at L2 will come from modules they skipped through the level check — this is fine only if those concepts are in the `placed` state for them. The §2 rule already allows this, but in the block quiz for L2 it is worth limiting the share of tasks from skipped modules (≤ 20%) and raising the share of `bugfind`/`explorer`/`docs_forcing`, otherwise an experienced learner gets an easy quiz and treats the exam as a formality. One line in §4.

---

## Verification sources

- DORA metrics: https://dora.dev/guides/dora-metrics/ (metric groups), https://dora.dev/guides/dora-metrics/history/ (rework rate — since the 2024 report; MTTR → failed deployment recovery time, moved to throughput)
- The methodology §12 links were checked (HTTP 200, 18.11.2026): https://sre.google/workbook/postmortem-culture/ , https://kanbanguides.org/ , https://dora.dev/research/2025/dora-report/
- CKA, allowed resources: the official page — https://docs.linuxfoundation.org/tc-docs/certification/tips-cka-and-ckad (the list of domains differs across third-party retellings; do not list them in the product text)
