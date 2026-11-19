# Review of `10-assessment-career.md` (reviewer: the andragogy and instructional design role, the author of `01-andragogy.md`)

Date: 18.11.2026. The document under review was not modified.

## Verdict

The document is strong: the consistent principle "the quiz teaches, the exam measures", the misconception catalog as the basis for distractors, checks by state, the honest stance on AI and the citation check in neural-network grading are done well and must be kept. The career block for steps 8–11 of the checklist is brought all the way to trainers, not just advice. Still, in its current form the document cannot be handed over to development. The owner's second-wave requirements are not reflected in it: the R2 documentation ladder is not built into assessment and directly conflicts with the rule "an item only on introduced concepts", the R3/R4 process explainers have not become a subject of checking, and isolation in Linux (R6), the six container boundaries (R7), the protocol catalog (R8), Kubernetes networking (R9), the reconciliation loop (R10), the hybrid cluster (R11) and the three Kubernetes stages (R12) do not appear in the bank or the exams. In addition, the document declares a "unified exam format" that the exams in `03`, `04` and `05` do not match. It diverges from `09` in how signing and the server side work, and from `01` in the weight of explanations on the exam and in the schedule of the career block. The quizzes violate concept order: the methodology quiz contains image, registry, GitOps and IaC. Several factual errors were also found: the grouping of DORA metrics, "an image with a different kernel", `journalctl -u nginx` as the nginx log. Below are 36 findings: 10 BLOCKING, 16 MAJOR, 10 MINOR. Almost every one comes with ready text.

Notation: "the graph" — `01-andragogy.md`, section 6.2; concept IDs follow the `01` graph.

---

## A. Owner requirements R1–R12

### 1. BLOCKING — The documentation ladder (R2) is not built into assessment and contradicts the concept order rule

**Where:** section 2 ("Authoring rules", the "Concept order" item), 6.1, 7, 3.5.

**What is wrong.** The document requires that an item be shown only when *all* of its concepts are `introduced`. R2 (steps 4–5) requires the opposite: items on commands and flags that were not in the theory, and exams with items "beyond the course". There is not a single item type for working with documentation ("find the flag", "find the OPTIONS section"). It is not specified which documentation is open on the exam: `05`, section 9, already has a kubernetes.io side panel "as on the CKA", `10` does not. There is no "can search the documentation" dimension. There is no rule "an experienced learner starts at step 3".

**Fix — insert into the document:**

**(a) A fifth dimension in section 1:**

| Dimension | Measured by | Where the learner sees it |
|---|---|---|
| Working with documentation | `docfind` and `docanatomy` items, step 4 "no theory" items, the share of `beyond_course` exam tasks solved with the documentation open; the log of opened pages | The ladder step per block (1–5) and the "documentation passport": which sources the learner has already opened on their own (man, `--help`, `kubectl explain`, docs.docker.com, kubernetes.io, developer.hashicorp.com, docs.ansible.com, prometheus.io) |

**(b) An exception to the concept order rule in section 2:**

> **Concept order and the documentation ladder.** An item is shown when all of its `concepts` are at least `introduced` for the learner. The exception is items with `beyond_course: true`: they serve steps 4–5 of the documentation ladder and allow in the wording a *command or flag* that was not in the theory, but not a new *concept*. Example: concept L23 (systemd unit) is introduced, the flag `systemctl list-units --failed` is not. This is allowed: the learner finds the flag in `systemctl --help`. For such items the linter requires `doc_ref` (the exact place: page and section or anchor), `doc_step` ≥ 4 and `doc_allowed` (the list of sources). The item text may not contain word forms of concepts not yet introduced. The word the learner has to find is checked against a separate list `discover: [ "--failed" ]` and does not go to the vocabulary linter.

**(c) Two new item types in the section 2 table:**

| Type | What it checks | How it is checked | Example |
|---|---|---|---|
| `docanatomy` (step 2) | Knowledge of how a documentation page is structured | A fragment of a real man page or docs page from the course mirror is shown; the learner clicks a section (`hotspot` by `section.id`: NAME, SYNOPSIS, DESCRIPTION, OPTIONS, EXAMPLES, EXIT STATUS, SEE ALSO) or the line with the required flag | "On this `ss(8)` page, click the line that explains how to show the process owning a socket" → the line `-p, --processes` |
| `docfind` (step 3) | The ability to find a flag or field on one's own | Only a link to the page is given (the button opens the built-in viewer; the page is not highlighted). The answer is a command, checked by effect, like `fill`. The log records whether the learner opened the page and how many seconds they searched | "Find in `man journalctl` how to show only entries with priority err and higher, and show them for nginx" → effect: a journal query with `priority<=3` |

**(d) A table of steps for assessment (section 3.4 or a new 3.6 "The documentation ladder in the bank"):**

| Step | Where in assessment | Hint in the item | AI mentor | Passing rule |
|---|---|---|---|---|
| 1 | Quizzes of the first modules of the block (L0) | Under the answer explanation, a line "this comes from: `man chmod`, DESCRIPTION section", a link to the exact place. May be left unopened | Normal | Does not affect |
| 2 | Quizzes and trainers of the second third of the block (L0), first modules (L1) | A second-level hint — a page fragment with the highlighted line and the section caption; 1–2 `docanatomy` items per module | Normal | `docanatomy` counts toward the module result |
| 3 | Final quizzes of the block (L0, L1); from the first module for L2 | Only a link to the page; `docfind` items (at least 2 per module) | Hints at the section but not the flag | Key `docfind` items (`key: true`) count toward the module result from the third third of the block |
| 4 | Breakage trainers and the block quiz | None. 20–30% of items are `beyond_course` | "Where did you look?" mode: on any question it first asks what is open and points to `man`, `--help`, `kubectl explain`, docs; it does not give the answer itself (`01`, section 14 — I am fixing this on my side) | The block quiz requires ≥ 1 solved `beyond_course` item |
| 5 | The block exam and the final exam | Only the official source is open in the built-in viewer (list per block below); 1–2 `beyond_course` tasks | Off | `beyond_course` tasks are not critical but give ≥ 15% of the total |

Starting step by level: L0 — step 1 in each block. L1 — step 2, step 3 from the second third of the block. L2 — step 3 from the first module, step 4 from the second third. The step for a block goes up when the final checks of two consecutive modules are passed at the current step. There is no going down: a learner stuck on `docfind` gets the step 2 hint as a *hint*, not as a step rollback.

**(e) Documentation open on the block exam (step 5).** This is the course mirror in the built-in viewer (offline, PWA), not external tabs. That way the log of opened pages becomes part of the debrief: "you found the `--since` flag in 40 seconds in the OPTIONS section".

| Block | Open |
|---|---|
| Linux | man pages of the `lab-debian` image (`man-db` is already in the image per `02`), `--help` |
| Networks | man (`ip`, `ss`, `dig`, `nft`, `tcpdump`, `wg`), MDN HTTP |
| Containers | docs.docker.com (CLI reference, Dockerfile, Compose spec), man `unshare`, `nsenter`, `capabilities(7)`, `cgroups(7)` |
| CI/CD | docs.gitlab.com/ci/yaml, git-scm.com/docs |
| Kubernetes | kubernetes.io/docs and /blog, helm.sh/docs, gateway-api.sigs.k8s.io, `kubectl explain` — exactly the CKA list ([LF, Resources Allowed](https://docs.linuxfoundation.org/tc-docs/certification/certification-resources-allowed)) |
| IaC | developer.hashicorp.com/terraform (language, CLI), docs.ansible.com (collections index), `ansible-doc` |
| Monitoring | prometheus.io/docs, grafana.com/docs |

**(f) A log event** (`01`, section 2.3): `{type: "doc_open", source, page, anchor, ms_to_answer, item}`. It is used to compute the "documentation passport" and the FSRS skill `doc.<source>`: a learner who has never opened `kubectl explain` gets a `docfind` item on it in their review queue.

**(g) Ready items for steps 3–4 per block** (one per step; `beyond_course` only at step 4):

| Block | Step 3 `docfind` | Step 4 `beyond_course` (no hints) |
|---|---|---|
| Linux | "In `man find`, find how to search for files larger than 100 MB modified within the last day" → effect: the output contains `/var/log/big.log` | "The `report` service crashes once an hour. Show all failed units with one command" → `systemctl --failed` / `list-units --state=failed`; the learner has not seen this flag |
| Networks | "In `man ss`, find how to show only established TCP connections to port 5432" → `ss -tn state established '( dport = :5432 )'`, effect checked on the output | "Find the path MTU to 10.0.2.9 without external utilities" → `ping -M do -s <n>` or `tracepath`; check: the number answered in the field matches the netlab model |
| Containers | "In the `docker run` reference, find how to limit a container to 50 processes" → `--pids-limit 50`; check `containers[name=x]` + cgroup facts `pids.max=50` | "The container must start with a read-only file system, except `/tmp`" → `--read-only --tmpfs /tmp`; this was not in the theory |
| CI/CD | "In the `.gitlab-ci.yml` reference, find how to run a job only when files in `docs/` change" → `rules: changes:` | "Make the `deploy` job not start while the previous rollout is in progress" → `resource_group` |
| Kubernetes | "Using `kubectl explain`, find the field that forbids a container from running as root" → `securityContext.runAsNonRoot`; check on the object | "A pod must terminate no later than 5 seconds after SIGTERM" → `terminationGracePeriodSeconds: 5`; "find out which API resources support `patch`" → `kubectl api-resources -o wide` |
| IaC | "In the resource documentation, find the argument that prevents Terraform from deleting a VM" → `lifecycle { prevent_destroy = true }`; `plan_expect` for an error on `destroy` | "An Ansible task must run only on the first host of the group" → `run_once: true` |
| Monitoring | "In the PromQL documentation, find the function that predicts a value 4 hours ahead" → `predict_linear`; `promql_equiv` | "The alert must not fire on weekends" → `day_of_week()` in the expression or `time_intervals` in Alertmanager |

### 2. BLOCKING — Process explainers (R3/R4) are not a subject of checking

**Where:** section 2 (item types), 4 (quizzes), 8 (samples).

**What is wrong.** R1 names process explainers one of the three foundations of the course, and R3 requires them in every block. Assessment, however, knows about diagrams only through `hotspot` and `label`, that is, through a *static* picture. It has no items that use the main property of explainers — the slider, the toggle, "break it", scrubbing through steps. A learner can go through an explainer with their eyes and never once predict what changes when a parameter changes. Such knowledge is passive, and it is not checked.

**Fix — a new type and a coverage rule.**

| Type | What it checks | How it is checked |
|---|---|---|
| `scene` (new, on `stepper` + `diagram` + `breakit` from `08`, 3.1–3.5) | The process model: predict the next step, the effect of a parameter, the symptom of a breakage | The item puts the scene into an initial state (`scene: <id>`, `set: {param: value}`, `step: n`) and sets a subkind: `next` — which node or arrow lights up next (`hotspot` by `node.id`); `param` — the learner moves the slider to the value at which the condition occurs (checked by scene state); `break` — a component is removed, the learner picks the symptom or clicks the place of the first error; `scrub` — the learner scrubs through steps and stops at the step where the named event occurs |

Linter rule: every process explainer from the R3 list has ≥ 2 `scene` items of different subkinds, and at least one of them goes into the block quiz. Without this the block does not build.

Sample entry:

```yaml
id: net.dns-resolution.s03
kind: scene
scene: net.dns-resolution          # the "how a name is resolved" explainer (03)
subkind: param
level: [L0, L1, L2]
concepts: [N08, N09]
set: { cache: warm, ttl_s: 300 }
q:
  ru: "Администратор сменил A-запись shop.example в 12:00. Передвиньте ползунок «время запроса» на первый момент, когда резолвер провайдера гарантированно отдаст новый адрес."
answer: { when: "scene.t >= scene.cached_at + ttl_s" }   # 12:00 + the remaining cache TTL, computed by the scene
options_why:
  early: { misconception: net.dns-change-instant, ru: "Резолвер отдаёт копию из кэша, пока не истёк TTL; смена записи на авторитативном сервере не видна сразу." }
```

(The `ru` strings above are Russian-language item content: "The administrator changed the A record of shop.example at 12:00. Move the 'request time' slider to the first moment when the provider's resolver is guaranteed to return the new address." and "The resolver returns the cached copy until the TTL expires; a record change on the authoritative server is not visible immediately.")

Minimum set of `scene` items for the R3 explainers (subkind — what is checked):

| Block | Explainer | Items |
|---|---|---|
| Methodology | A task from idea to prod; the flow bottleneck | `param`: raise the WIP of the "Review" column to the value at which lead time stops falling; `break`: remove automated tests — where the queue grows first |
| Methodology | Incident: alert → postmortem | `scrub`: stop at the step where the service is already restored but the cause is not yet found (mitigation ≠ fix) |
| Linux | Boot; fork/exec/PATH; pipe; systemd restarts a service | `next` after `fork()`; `param`: `Restart=on-failure`, `StartLimitBurst=3` — on which crash systemd stops restarting; `break`: remove a directory from PATH — which step fails |
| Networks | URL; DNS; TCP+TLS; a packet through NAT; where a 504 comes from | `next` in the handshake; `param`: `proxy_read_timeout` versus response time — at which value 504 turns into 200; `break`: the firewall drops SYN — does the client see 504 or 502 |
| Containers | `docker run` CLI → process; `docker build` layer by layer with cache; pull by manifest | `scrub` to the step where the process PID appears; `param`: which Dockerfile line to change so that exactly 2 layers are rebuilt; `break`: the registry returned 404 for the platform manifest — where the error is |
| Kubernetes | `kubectl apply` through the components; scheduling; rolling update; node failure; a request through Service/Ingress | `param`: `maxUnavailable`/`maxSurge` — how many pods exist simultaneously with 4 replicas; `break`: kubelet on the node is stopped — after how many seconds the pods are recreated (per the `not-ready` toleration, 300 s); `next` for a packet to a ClusterIP |
| CI/CD | `git push` → rollout | `break`: the registry token expired — which job is red, what prod sees |
| IaC | `plan`/`apply` + state; an idempotent Ansible run | `param`: remove a resource from state — what plan shows; `scrub` to the task that reports `changed` on the second run |
| Monitoring | scrape → TSDB → PromQL → alert → notification | `param`: `scrape_interval` and the `rate()` window — at which window the graph becomes empty (window < 2 intervals); `param`: `for: 5m` — is the alert pending or firing after a 3-minute spike |

### 3. BLOCKING — Kernel isolation (R6) is missing from the Linux quiz and the Linux exam

**Where:** 8.2, 6.2 (there is no Linux exam), 9.2 (mandatory questions, the Linux row).

**What is wrong.** All five Linux items check only the classic minimum. Under R6, namespaces, cgroups v2, capabilities, overlayfs and threads are introduced in Linux. Currently D-2 and K-4 rely on D03/D04 as Docker-block concepts, and the "container vs VM" trainer refers to `unshare` from the containers lesson. In the `01` graph (my area), concepts D03–D05 and capability will move to Linux. In `10`, the references need to be changed and items added.

**Fix — add to 8.2 (the new IDs are provisional until the graph is updated: L33 thread, L34 namespaces, L35 cgroups v2, L36 capabilities, L37 overlayfs, L38 the seccomp idea):**

**L-6. `predict`, L1–L2, concepts L17, L33.** The `java` process has PID 812. What will `ls /proc/812/task | wc -l` print if `ps -o nlwp= -p 812` shows `37`?
- **a) `37` — correct: the `task` directory contains one subdirectory per thread (TID); `nlwp` is their count.**
- b) `1` — *incorrect: one is only for a single-threaded process; threads share a PID (TGID) but have their own TIDs.*
- c) An error: threads have no entries in `/proc` — *incorrect: threads are visible in `/proc/<pid>/task/` and in `ps -eLf`.*
- d) The number of child processes — *incorrect: child processes are separate PIDs with their own `/proc/<pid>` directories.*

**L-7. `task`, L0–L2, concepts L35, L18.** "The `hog` process is eating memory. Limit it to 32 MB without restarting it, and make sure the kernel kills it when it exceeds the limit." Environment: v86 (`lab-debian`).
Check (predicates from `09`, 2.3): `cgroups[procs~@pid(hog)].memory.max<=32M` before triggering; then `cgroups[path~@cg(hog)].memory.events.oom_kill>=1 && !procs[cmd=hog]`. `fail`: `memory.max=max` — "the group is created, the limit is not written"; the process is in the root group — "the PID was not moved to `cgroup.procs`". Debrief: the `oom-kill` line in `dmesg` and `memory.events`. This is the same mechanism as `OOMKilled` in K-4, and the K-4 debrief should reference this item.

**L-8. `choice`, L1–L2, concept L34.** You ran `unshare --pid --fork --mount-proc bash` and executed `ps -ef` inside. What will you see?
- **a) Only `bash` with PID 1 and `ps` itself — correct: a new PID namespace, and `--mount-proc` mounts a fresh `/proc` that shows only the processes of this namespace.**
- b) All host processes, but with new numbers — *incorrect: processes of the parent namespace are not visible from inside the child; visibility goes the other way.*
- c) All host processes as usual — *incorrect for this command; that would happen without `--mount-proc`: `ps` would read the old `/proc`.* (This is a separate misconception, `linux.ps-reads-kernel-directly`.)
- d) An error — only systemd can be PID 1 — *incorrect: PID 1 is the first process of its namespace, any process.*

**L-9. `fill`, L1–L2, concept L36.** "Allow `/usr/local/bin/web` to listen on port 80 as user `student` without giving it root."
Answer by effect: `sudo setcap cap_net_bind_service=+ep /usr/local/bin/web`; check — `getcap` shows the capability, the `web` process as uid 1000 listens on `:80` (`net.listen[port=80][pid=@pid(web)]`, `procs[cmd=web].user=student`). `forbid`: `chmod u+s`, running via `sudo` — "this is all of root, but only one privilege is needed".

**L-10. `choice`, L1–L2, concept L37.** Overlay directories: `lowerdir=/img`, `upperdir=/up`, `merged=/m`. You ran `rm /m/etc/motd`; the file was in `/img`. What is on disk?
- **a) `/img/etc/motd` is in place, and a whiteout (character device 0:0) appeared in `/up/etc/motd` — correct: the lower layer does not change, the deletion is recorded in the upper one.**
- b) The file was deleted from `/img` — *incorrect: lower layers are read-only.*
- c) Nothing changed, `rm` returned an error — *incorrect: deletion is allowed in merged.*
- d) The file was moved to `/up` — *incorrect: copy-up happens on modification, not on deletion.*

**Linux exam (6.2, mandatory task).** If the owner of the Linux exam (`02`) does not add such a task themselves, this role sets it: "The `report` service (systemd) must stay within 64 MB and 20 processes; after exceeding memory, systemd restarts it no more than three times". Checks: `units[report.service]` with `MemoryMax=64M`, `TasksMax=20` (facts `cgroups[path~report.service].memory.max<=64M && pids.max=20`); a `probe` in v86 starts a leak, the critical check is `memory.events.oom_kill>=1 && units[report.service].restarts<=3`.

**Mandatory questions, the Linux row (9.2):** add "process and thread", "how the kernel isolates a process: namespaces, cgroups, capabilities" and "what the OOM killer is and how to see it".

### 4. BLOCKING — The six container boundaries (R7) have not become the basis of the exam and the drills

**Where:** 6.2 (`exam-docker`, task t3), 8.4, 9.2 (the "container vs VM" card).

**What is wrong.** The t3 breakages (`fault-port-bind`, `fault-env-missing`, `fault-healthcheck`, `fault-oom`) are random and not tied to boundaries, and the "process and signals" boundary is not covered at all. There are no items on anatomy: the OCI bundle, the runtime chain, lifecycle states. There is no practical check for the "bare metal → VM → containers → nesting" explainer. The "container vs VM" reference answer does not mention nesting, although interviews ask about it ("so where do your containers run? — in cloud VMs").

**Fix.**

(a) In `exam-docker`, define the t3 breakage as "boundary × variant", so that the seed guarantees a boundary the learner has not yet met in the quiz:

```yaml
  - id: t3
    weight: 15
    fault_pool:            # the seed picks a boundary, then a variant
      kernel:   [fault-oom, fault-pids-limit]
      network:  [fault-listen-127, fault-wrong-network, fault-default-bridge-no-dns]
      storage:  [fault-anon-volume, fault-bind-perm-uid]
      process:  [fault-shell-form-no-sigterm, fault-zombie-no-init]
      io_logs:  [fault-log-to-file-not-stdout]
      identity: [fault-env-missing, fault-secret-in-env-wrong-key]
    card: { ru: "После вашего запуска пришла жалоба: страница оформления заказа падает. Найдите и устраните причину. В карточку решения впишите, на какой границе контейнера была причина.", en: "..." }
    checks: "{{fault.checks}}"
    explain_field: { id: boundary, expect: "{{fault.boundary}}", points: 3 }
```

(The `ru` card text: "After your launch a complaint came in: the checkout page crashes. Find and fix the cause. In the solution card, write which container boundary the cause was on.")

(b) Items in 8.4:

**D-6. `predict`, L1–L2, the "process and signals" boundary.** The Dockerfile ends with the line `CMD node server.js` (shell form). How many seconds will `docker stop app` take, and with what code will the container exit?
- **a) ≈ 10 seconds, code 137 — correct: in shell form PID 1 is `/bin/sh -c`; sh does not forward SIGTERM to the child node, Docker waits for the timeout (10 s by default) and sends SIGKILL (128+9). The fix is the exec form `CMD ["node","server.js"]`, and if zombies need reaping — `--init` (tini).**
- b) Instantly, code 0 — *incorrect: that would happen in exec form with an application that handles SIGTERM.*
- c) Instantly, code 143 — *incorrect: 143 = 128+15, the process would have died from SIGTERM, but SIGTERM was received by sh, not node.*
- d) The container will not stop — *incorrect: after the timeout SIGKILL arrives, and it cannot be caught.*

**D-7. `task`, L1–L2, the "configuration and identity" boundary.** `docker run -v ./data:/data -u 1000 app` fails with `permission denied: /data/db.sqlite`. On the host, `ls -ln data` shows owner `0 0` and mode `755`. Fix it without using `chmod 777` and without running the container as root.
Check: the container is `running`, the file is created in `./data` on the host; `forbid`: `files[./data].mode=0777`, `containers[name=app].user=0`. Debrief: without a user namespace, the UID inside and outside is the same number; `chown 1000 data` on the host or `--user` matching the owner.

**D-8. `choice`, L0–L2, the "network" boundary.** Two containers are started with `docker run -d --name db postgres:16` and `docker run -d --name api …` without `--network`. `api` cannot connect to `db:5432`: `could not translate host name "db"`. Why?
- **a) The default bridge network has no built-in DNS for container names; it exists only in user-defined networks — correct: `docker network create shop` and start both with `--network shop`.**
- b) Port 5432 is not published via `-p` — *incorrect: `-p` is needed for access from the host; containers on the same network see each other's ports without publishing.*
- c) Postgres has not started yet — *incorrect: then there would be a connection error, not a name resolution error.*
- d) `db` needs to be added to the host's `/etc/hosts` — *incorrect: resolution happens inside the network namespace of `api`, the host has nothing to do with it.*

**D-9. `order`, L1–L2, anatomy.** Arrange who calls whom on `docker run nginx`: (1) runc creates namespaces and the cgroup and does exec, (2) the docker CLI sends a request to the API, (3) containerd-shim remains the parent of the process, (4) dockerd hands the job to containerd, (5) containerd prepares the OCI bundle (rootfs + `config.json`).
**Answer: 2 → 4 → 5 → 3 → 1.** Debrief: shim starts before runc and lives after it exits — that is why `systemctl restart docker` (with `live-restore`) does not kill containers. Here shim is placed before runc because it starts runc; if the learner puts 1 before 3, the debrief is: "runc exits right after the process starts, shim remains the parent".

**D-10. `task` (v86, tier B), L0–L2, the "VM vs container" explainer.** "Measure: (1) how long the `crun run demo` container takes to start in your v86 machine; (2) how long a second v86 machine takes to boot (the “one more VM” button). Enter both numbers and explain why the difference is what it is."
Check: the numbers are compared with the bus log (the `crun` time from `cmd.done`; the second machine's boot time from the `machine.ready` event) with a ±20% tolerance. `explain` by key points: "a VM has its own kernel, which has to boot"; "a container is a process of an already running kernel". In addition, the learner runs `uname -r` and `ps -e | wc -l` inside and outside the container and notes what matched (the kernel) and what did not (the processes). `dmesg | grep -i hypervisor` shows that the browser machine itself is a VM.

(c) The "Container vs VM" card (9.2): add to the reference answer: "…and they are not mutually exclusive: in the cloud, containers almost always run inside VMs, Kubernetes is also installed on bare metal, and with KubeVirt virtual machines are run inside Kubernetes — this is how, for example, platforms like Cozystack are built". Key point `nesting`.

### 5. MAJOR — Networks (R8): no "which layer broke" principle, no protocols by learner level

**Where:** 8.3, 9.2 (the "Networks" row), 6.3 (the "504" drill).

**What is wrong.** The networks quiz consists of good but disconnected items. The main principle of R8 ("first ask which layer broke") is not checked explicitly. The protocol catalog is not reflected: DHCP, ARP, ICMP for L0; HTTP/2, QUIC, gRPC, VLAN for L1; BGP, VXLAN, WireGuard, mTLS for L2. All items are labeled the same, "L0–L2" or "L1–L2", and an experienced learner gets the same items as a beginner.

**Fix.**

**N-6. `match`, L0–L2, "which layer".** Match the symptom with the layer where you should look first:

| Symptom | Layer |
|---|---|
| `ip a` shows `state DOWN`, `NO-CARRIER` | L1–L2 (link) |
| `ping 10.0.0.1` → `Destination Host Unreachable` from your own subnet, `ip neigh` shows `FAILED` | L2 (ARP) |
| `ping` to the gateway works, `ping 8.8.8.8` — `Network is unreachable` | L3 (route) |
| `curl` hangs before the connection is established, `ss` shows `SYN-SENT` | L4 (connection/firewall) |
| `curl` gets `SSL certificate problem: certificate has expired` | L6/"TLS" |
| A `502 Bad Gateway` response from nginx | L7 |

Debrief: "We search bottom-up until the symptom is explained; the layer in a phrase like "the problem is at L3" is the vocabulary the team speaks".

**N-7. `order`, L0–L2, the DHCP protocol.** Arrange the messages: Request, Offer, Discover, Ack. **Answer: Discover → Offer → Request → Ack (DORA).** Debrief: Discover is broadcast because the client does not have an address yet.

**N-8. `choice`, L1–L2, HTTP/3.** A site runs on HTTP/2, and after enabling HTTP/3 nothing changed for some clients. The office firewall allows only TCP 80/443. Why?
- **a) HTTP/3 runs over QUIC, that is, over UDP 443; blocked UDP makes the browser stay on HTTP/2 over TCP — correct.**
- b) HTTP/3 requires a different certificate — *incorrect: the certificate is the same; TLS 1.3 is built into QUIC.*
- c) HTTP/3 uses port 8443 — *incorrect: the standard port is the same, 443, but UDP.*
- d) Browsers do not support HTTP/3 — *incorrect: the major browsers support it.*

**N-9. `choice`, L2, VXLAN.** A VXLAN overlay is set up between nodes, the physical network MTU is 1500. Small requests go through, large responses hang. What is most likely?
- **a) VXLAN encapsulation adds 50 bytes; the inner interface MTU must be ≤ 1450, otherwise large packets do not get through (especially if ICMP "frag needed" is filtered) — correct.**
- b) VXLAN does not support TCP — *incorrect: it encapsulates entire L2 frames.*
- c) IPsec needs to be enabled — *incorrect: encryption is not related to size.*
- d) ARP is overloaded — *incorrect: ARP does not depend on the response size.*

**Level rule for the bank:** every protocol in the R8 catalog has ≥ 3 items, and `level` is taken from the protocol's level in the catalog (`03`): "basic" — `[L0, L1, L2]`, "intermediate" — `[L1, L2]`, "experienced" — `[L2]`. An item on a protocol from the "experienced" column does not go into the L0 quiz.

**Mandatory questions, the "Networks" row (9.2):** add "ARP and what a broadcast domain is", "DHCP", "how you debug a network — which layer you start with"; for L2 — "HTTP/2 vs HTTP/3", "what VXLAN is and why it is in Kubernetes".

### 6. BLOCKING — Kubernetes networking (R9) is not covered by a drill or the exam

**Where:** 8.5, 6.3 (pool C), 9.2 (drills).

**What is wrong.** Of the Kubernetes networking part, the document has only K-2 (`targetPort`). There is no main R9 drill "a pod cannot reach a service" with the chain DNS → Service → Endpoints → pod → NetworkPolicy. There is no item "find in iptables where a packet to a ClusterIP goes". There is no `ndots` and no search domains. There is no NetworkPolicy.

**Fix.**

(a) A drill in 9.2 and pool E in 6.3:

| Pool | Symptom | Cause variants | Blocks |
|---|---|---|---|
| E | "`api` cannot reach `orders`": `curl http://orders` from the `api` pod — an error | (1) DNS: `orders` is in another namespace, and the client uses the short name; (2) the Service selector does not match the labels — the EndpointSlice is empty; (3) `targetPort` does not match the container port; (4) the `orders` pods are not Ready (readiness) — endpoints exist but `ready: false`; (5) a `default-deny` NetworkPolicy in the `orders` namespace | Kubernetes, Networks |

Reference path and step checks (`bank/career/drills/k8s-svc-unreachable.yaml`):

```yaml
steps:
  - expect_action: "nslookup/dig orders из пода"   # DNS
    sandbox_output: { v1: "NXDOMAIN orders.api.svc.cluster.local", default: "10.96.14.7" }
  - expect_action: "kubectl get svc orders -n <ns>"
  - expect_action: "kubectl get endpointslices -l kubernetes.io/service-name=orders"
    sandbox_output: { v2: "ENDPOINTS: <none>", v4: "ready: false", default: "10.244.1.5:8080" }
  - expect_action: "curl podIP:port напрямую"   # bypassing the Service
  - expect_action: "kubectl get networkpolicy -n orders"
bad_paths:
  - { action: "kubectl delete pod", why: "Пересоздание не меняет ни селектор, ни политику; улики (Events) теряются" }
  - { action: "сразу смотреть iptables", why: "Сначала проверяют дешёвые слои: имя, объект, endpoints" }
checks:
  pass: "http.api_to_orders.status=200 && !k8s.objects[kind=NetworkPolicy][metadata.name=allow-all]"
  forbid: ["k8s.objects[kind=NetworkPolicy][spec.podSelector={}][spec.ingress~'{}']"]  # "open everything" does not count
```

(The Russian strings are drill content: "nslookup/dig orders from the pod", "curl podIP:port directly", "Recreating does not change either the selector or the policy; the evidence (Events) is lost", "look at iptables right away", "First check the cheap layers: the name, the object, the endpoints".)

(b) **K-6. `task`, L1–L2, "where a ClusterIP goes".** Environment — the hybrid cluster (R11) or `kube-lite` with an iptables model. "The `web` service has ClusterIP 10.96.0.20. Find on the node the rule by which a packet to this address gets the address of a specific pod, and enter that pod address."
Expected path: `iptables -t nat -L KUBE-SERVICES -n | grep 10.96.0.20` → the `KUBE-SVC-…` chain → `KUBE-SEP-…` → `DNAT to:10.244.x.y:8080`. Check: the entered address ∈ `endpointslices[service=web].endpoints.addresses`. Debrief: "A ClusterIP is not on any interface (`ip a` will not show it); it is only a NAT rule". For L2 — a Cilium variant: `cilium service list` and "there are no iptables rules, the service is implemented in eBPF".

(c) **K-7. `predict`, L2, `ndots`.** In a pod, `/etc/resolv.conf` contains `search shop.svc.cluster.local svc.cluster.local cluster.local` and `options ndots:5`. How many DNS queries will be sent before `api.example.com` (the name exists externally) resolves, if all search suffixes return NXDOMAIN?
**Answer: 4** (three suffixes, then the name as is: the name has 2 dots < 5, so the search list is tried first). If AAAA is included as well — 8. Debrief and remedy: an FQDN with a trailing dot (`api.example.com.`) or `dnsConfig.options ndots: 2`.

(d) **K-8. `choice`, L1–L2, NetworkPolicy.** A NetworkPolicy was applied that allows `db` to accept traffic only from `api`, but `curl` from the `test` pod to `db` still goes through. The cluster is kind with the default CNI (kindnet), nothing was changed.
- **a) The CNI in use does not implement NetworkPolicy: the object was accepted by the API server, but nobody applies the rules — correct. The policy is enforced by the CNI (Calico, Cilium); kindnet did not support it in older versions.** *(Note to the author: check the current kindnet version — NetworkPolicy support appeared in kind 0.24+; if the facts change, the option is rewritten to "flannel".)*
- b) The policy applies only to new pods — *incorrect: it applies to pods matching the selector immediately.*
- c) kube-proxy needs to be restarted — *incorrect: kube-proxy does not apply NetworkPolicy.*
- d) Pods are isolated by default, the policy is redundant — *incorrect: everything is allowed by default.*

(e) Mandatory questions, the Kubernetes row: add "how a pod on one node reaches a pod on another", "what a ClusterIP is and where it "lives"", "how you debug "a pod cannot see a service"".

### 7. MAJOR — The reconciliation loop (R10) and the bridge to the operator are not tied to assessment

**Where:** 8.5, 10 (pet project 8).

**What is wrong.** The reconciliation loop visualizer and "your own controller in the browser" already exist in `05`, 6.2, but the bank has not a single item on them. Pet project 8 (an operator in Go) opens "after Kubernetes (L2)" without checking that the learner has written the toy controller in the browser.

**Fix.**

**K-9. `scene` (break), L0–L2, concepts K02, K03, K11.** In the reconciliation loop visualizer, the ReplicaSet controller is paused. You delete two pods out of three, then change `replicas` from 3 to 4. How many pods will the controller create after the pause is lifted, and in how many actions?
**Answer: 3 pods in one reconciliation pass** (desired 4, actual 1). Debrief: the controller does not replay events, it compares the current state with the desired one (level-triggered). Misconception `k8s.controller-replays-events`.

**K-10. `task`, L1–L2, concept K30.** In the `05`, 6.2 editor (screen 2b), finish `reconcile` for `Website` so that it passes the trainer's four scenarios: creation, changing replicas, manual deletion of the Deployment, deletion of the Website. Checks — state-based, from `05`. A separate idempotency check: calling `reconcile` twice without changes does not change the Deployment's `resourceVersion`.

**Pet project 8, the "Opens after" column:** "Kubernetes (L2) **and K-10 passed**". The first defense question: "Show the place in your Go code that was the line `if (!have) create` in the browser controller".

### 8. BLOCKING — The hybrid cluster and browser machines (R11) are not accounted for in "On-call", in the exams, or in the phone rules

**Where:** 6.3, 6.2, 3.4 (item 2), 13.

**What is wrong.**
- 6.3 says "next to it, the simulator's k3s cluster". This is a contradiction in terms: k3s in the browser is impossible (R11, `09`, section 0). The browser has `kube-lite` and, per R11, the hybrid: control plane on `kube-lite`, nodes are v86 machines with a kubelet agent and crun.
- It is not specified which tier each incident runs on. This determines whether `probe` is allowed (`09`, 2.4) and which facts are available.
- It is not specified what to do on a phone (R11: one machine) with exams and "On-call".

**Fix — replace the first paragraph of 6.3:**

> Before the final exam, the learner goes through one shift of an on-call engineer: 60 minutes, three incidents in a row in a connected environment of three tiers. Tier B — two v86 machines on the course's virtual switch: `edge` (nginx) and `app` (the application in crun). Hybrid Kubernetes: control plane — `kube-lite`, nodes `node-1` and `node-2` — v86 machines with a kubelet agent, pods are real crun processes. Tier A — the simulator's Prometheus and Grafana, which read metrics from tier B facts. Device requirements: 4 GB of free memory and a desktop browser. On a phone, "On-call", block exams and sandbox micro-tasks are unavailable, and the interface says so before the start, not after. Incidents from pools A, B and E run on tier B, so their checks may use `probe`. Incidents from pools C and D run in `kube-lite`/the CI simulator, and there only `when` is available.

Add pool F to 6.3 (hybrid only): "Node `node-2` stopped responding" — variants: the kubelet agent is stopped; the node ran out of memory (the node's `memory.events`); the route between nodes on the switch is broken (pods on `node-2` are Running but unreachable from `node-1`). Check: the pods moved or the node is back (`k8s.objects[kind=Node][metadata.name=node-2].status.conditions[type=Ready].status=True` or pods Running on `node-1`), `keep`: PVC data is intact.

### 9. BLOCKING — The three Kubernetes stages (R12) and the final exam are not aligned; there is no mandatory cleanup and no cost

**Where:** 6.4 (A4, part B), 10 (pet project 7), 9.8.

**What is wrong.**
- The final exam requires "k3s on at least two nodes". That is stage 2 under R12. Stage 3 (kubeadm on 3+ VMs, Cilium, certificates, a version upgrade, etcd backup and restore, Terraform and Ansible) is not assessed in `10`, although `01`, 11.2 and `05`, 9.3 require it.
- There is no display of VM cost and no mandatory cleanup step with a check. R12 makes it mandatory.
- Pet project 1 and pet project 4 require a VPS, while the cloud VM concept (K31) is introduced in the Kubernetes block. More on this in finding 15.

**Fix.**

(a) Split requirement A4 by level:

| No. | Requirement | L0, L1 | L2 |
|---|---|---|---|
| A4 | Cluster | k3s on 2 nodes (stage 2) | kubeadm on 3 VMs: 1 control plane + 2 workers, Cilium CNI, VMs created by Terraform, configured by Ansible (stage 3) |
| A4b | Cluster operations (L2 only) | — | A scheduled etcd snapshot (CronJob or systemd timer) and a verified restore; an upgrade to the next minor version during the exam; certificate lifetimes `kubeadm certs check-expiration` > 30 days |

A4b check: `trainer-check` reads `/etc/kubernetes/manifests/etcd.yaml`, the presence of snapshots younger than 24 h, `kubeadm certs check-expiration -o json`, the `nodes[].kubelet` versions.

(b) A mandatory "Cleanup" step at the end of part A, part B and in every pet project:

> **Cost and cleanup.** Before part A starts, the product shows an estimate: number of VMs × size × hours from the `providers.yaml` table (`05`, 10.2), and for local VMs on one's own computer, "free" (`09`, 5.3). A "spent so far (estimated)" counter is visible on the exam page. The final exam protocol is not issued until cleanup is passed. Cleanup check: the learner pastes the output of `terraform destroy` (the last line `Destroy complete! Resources: N destroyed.`, where N matches the number of resources from the `terraform state list` output at step A3) and then `terraform state list` with empty output. If the learner wants to keep the service alive for an employer, the product leaves one VM and honestly shows its monthly cost.

(c) Rewrite pet project 7 as stage 2 (k3s on one VM or one's own machine, Helm, Ingress, a real registry). Add a row "7b. A kubeadm cluster by hand" (stage 3) — mandatory for L2, optional for L1. Criteria — from `05`, 10.3 (track R3). Check — `trainer-check run --track r3`.

### 10. MAJOR — R1 priorities: assessment does not check that theory is in place before practice

**Where:** 0 (decision 6), 6.1.

**What is wrong.** The block exam is 70% practice, 30% explanation. That is right for "skill", but R1 puts the textbook, explainers and documentation *at the foundation* of practice. The progress model has no condition that the block's practical exam opens only after the block's concepts have passed the theory and explainer checks. The block quiz "fails nothing" and does not gate the exam itself. As a result, a learner can break through to the exam bypassing the foundation.

**Fix (section 4, instead of the last sentence of the paragraph about the block quiz):**

> The block exam opens when (1) all concepts of the block with `key: true` have a status of at least `practicing`, (2) at least one `scene` item has been solved for each process explainer of the block, (3) the learner has reached step 3 of the documentation ladder in this block. The block quiz still does not block: with a result below 70% the product warns and offers a "go anyway" button. Conditions (1)–(3) do block, because without them the exam measures luck, not the foundation.

---

## B. Inconsistencies with other documents

### 11. BLOCKING — The "unified exam format" does not match the exams of `03`, `04`, `05`

**Where:** 0 (decision 6), 6.1, 6.2 ("networks already have one, `03`, section 10; Kubernetes — `05`").

**What is wrong.** The document declares: an exam of 60–120 minutes, 70/30, passing — all critical checks and ≥ 70%. In fact:
- in `03`, 10, part A — "real time is not limited", the threshold is 75 out of 90, no explanations; part B — about 3 hours on a VM;
- in `04`, 13 — four exams E1–E4 with a soft timer, passing is "all seven", no weights and no explanations in the score;
- in `05`, 9 — three exams B/I/E by level, a 66% threshold as on the CKA, tasks weighted by domain;
- in `01`, 11.2 — one exam per block, "the same for all levels", explanations "do not fail the exam".

**Fix — replace the 6.1 table with a framework that all blocks can conform to, and list the deviations explicitly:**

| Parameter | Mandatory for all blocks | Set by each block |
|---|---|---|
| Practice check | By facts (`09`, 2), by any path, `critical` and `forbid` | The set of tasks |
| Explanations | 2 `explain` questions, **a separate "interview readiness" mark**, not part of the passing score (decision `01`, 11.2; remove the 30% weight) | The questions |
| Timer | Hard for L1/L2; soft (time is recorded, does not cut off) for L0 | Duration 45–180 min |
| Threshold | All critical checks + a block threshold in the 66–80% range | The number (Kubernetes — 66%, as on the CKA) |
| Levels | A separate exam per level (`05`) or one exam with a lighter variant for L0 (`04`, E1) is allowed | The choice |
| Documentation | Step 5 of the ladder (finding 1e) | — |
| Retake | After 24 h, a new variant, a series of trainers | — |

Add a conformance line for each block: `03` — part A gets a 120-minute real-time timer for L1/L2 (simulated time remains a metric); `04` — E1+E2 form the L0/L1 exam, E3+E4 — L2, no weights, threshold "all critical + 80%"; `05` — unchanged.

Convert the `exam-docker` example from 6.2 to an explanation weight of 0: `explain: { weight: 0, readiness_mark: true, ... }`.

### 12. BLOCKING — The signing and server model contradicts `09`

**Where:** 0 (decisions 7 and 8), 3.3 ("the only server-side part of assessment"), 6.4 ("without our own server we cannot confirm authenticity", "the product verifies the code and the signature"), 11 (`signature: null`), 13.

**What is wrong.** `09` (2.5, 4.7, 5.4, 5.6) already designs `dt-api`, an agent with an Ed25519 key, signed breakage packages, a *presentable exam* with a server that keeps time and injects the breakage, and a predicate evaluator in Go. `10` says there is no server and there can be no signature, yet at the same time "the product verifies the code and the signature of the result". A signature made by an open script without a secret certifies nothing. And also: "the script only reads the system", while in part B and in A5 the script injects a failure ("to cause a failure, the script stops the application"). `09` allows the agent to inject breakages only from signed packages.

**Fix — replace decision 7 and the "Protocol" paragraph in 6.4:**

> The final exam runs in one of the two modes of `09`, 5.4. **Self-check** (one's own cloud, no server): `trainer-check run --nonce` only reads the system and prints a block of facts; the one-time code proves freshness but not authenticity. The protocol is marked "self-check". **Presentable** (the learner's VM registered via `trainer-check enroll`): the part B breakages and the A5 failure are injected by the agent from a signed package, `dt-api` knows the time and the moment of the breakage, and the agent's response is signed. The protocol gets `attest` and a verifiable link. The script changes nothing in the system except the actions from signed breakage packages; their full list and rollback commands are shown before the start.

Section 3.3: replace "the only server-side part of assessment" with "the server-side part of assessment is `dt-api` from `09` (presentable exams) and, with consent, anonymized item statistics; progress is kept in the browser by default, synchronization follows `09`, 3.4".

### 13. MAJOR — The exam check format does not match the `09` facts contract and violates its validator

**Where:** 6.2 (`exam-docker`), 11, 13.

**What is wrong.**
- `state: "image[repo=shop][tag=1.0]"`, `container[name=db].ports[*].host=5432` do not match the `dt.facts/v1` schema. It has `images[{ref, digest, layers, size}]` and `containers[].ports: string[]` of the form `'8080->80/tcp'`, in the plural.
- `probe: recreate-db` in an exam that runs in `dsim` (tier A). Per `09`, 2.4, `probe` is allowed only with `envs: [vm]` or `[v86, vm]` and with a justification.
- Section 0 refers to the check types of `06`, 0.4 as the source, while the consolidated contract is `09`, 2.4.

**Fix:**

```yaml
checks:
  - { id: t1a, critical: true, when: "images[ref='shop:1.0']" }
  - { id: t1b, points: 10, when: "images[ref='shop:1.0'].size<150M" }
  - { id: t2c, points: 5, forbid: "containers[name=db].ports~'5432->'", message: { ru: "Базе незачем торчать наружу." } }
  - id: t2b
    critical: true
    sim_action: { op: recreate, target: "containers[name=db]" }   # new: a tier A simulator action, not a probe
    when: "http.shop_order_marker.status=200"
    envs: [sim]
```

(The `ru` message: "The database has no reason to be exposed.")

In `13` (dependencies), add a request to `09`: a `sim_action` type for tier A (a deterministic simulator action before `when` is evaluated) as a replacement for `probe` where there is no real machine. In section 0, replace the reference "check types — in `06`, section 0.4" with "the check contract — `09`, section 2; the `06` types are its special cases".

### 14. MAJOR — The item format is declared compatible with `03`, 8.3, but is not compatible

**Where:** 3.1 ("the format is compatible with `03`, section 8.3").

**What is wrong.** In `03`: `kind: single | multi | order | match | number | text | hotspot | capture | command | lab`, levels `beginner/intermediate/experienced`, `concepts` are slugs (`recursive-resolver`), and there is an `entry: true` flag. In `10`: `kind: choice/fill/bugfind…`, levels `L0/L1/L2`, `concepts` are graph IDs, `purpose: [entry…]`. On top of that, `04` (11.4) and `05` (13) have their own formats. A unified bank cannot be assembled with such discrepancies.

**Fix — a mapping table in 3.1 and the decision "the canon is the `10` format":**

| `03` | `10` (canon) |
|---|---|
| `single` / `multi` | `choice` with `multi: false/true` |
| `number` | `fill` with `answer.number` and a tolerance |
| `command` | `fill` (by effect) |
| `text` | `explain` |
| `capture` | `hotspot` on a packet analyzer frame/field (`target: capture`) |
| `lab` | `task` |
| `beginner/intermediate/experienced` | `L0/L1/L2` |
| `entry: true` | `purpose: [entry]` |
| `concepts: [slug]` | `concepts: [graph ID]`; slugs are allowed only as `subconcepts`, and the build requires a slug-to-ID mapping |

The build converts block files to the canon, and block authors write directly in the canon.

### 15. BLOCKING — The career block and pet projects violate the concept graph

**Where:** 9 (introduction), 10 (the pet projects table, the "Opens after" column).

**What is wrong.**
1. The career block schedule in `10` ("self-presentation and the mock interview — after the first pet project") diverges from `01`, 5 ("self-presentation — after Docker, the mock interview — after Kubernetes"). Most importantly, it diverges from the graph: R07 (mock interview) requires R05, and R05 requires K33. A mock interview before Kubernetes is impossible according to the graph, and the "situational question" phase (9.3) is incorrect without K33.
2. Pet projects 1 and 4 ("on a VPS") open after Linux, Networks, Docker, CI/CD. But the cloud VM (K31) and VPS hardening (P02, requires K31) are introduced only in the Kubernetes block. WireGuard (project 4) is absent from the graph altogether, although the module exists in `03` (N14).
3. Pet project 2 requires writing a bot in Python or Go. There is no programming in the graph.

**Fix.**
- Split R05 into two concepts (I am fixing the graph on my side, here are the references): **R05a "Situational question on networks and Linux"** (requires R04, N16, L24) and **R05b "Situational question on Kubernetes"** (R05a, K33). R07 requires R05a. Then the first mock interview is possible after the Networks block and the first pet project, and Kubernetes questions appear in the interview only after K33 (the product already takes questions only from blocks with `practicing` status). Rewrite the introduction of section 9 as follows: "R04, R06, R01 — after methodology; the résumé draft (R02) — after Docker; self-presentation (R03) — after the first pet project; the mock interview (R07) — after R05a and the first pet project, with a situational question from networks and Linux; Kubernetes situational questions — after K33; applications — after the Kubernetes exam or at ≥ 60% on three job postings". I will put the same text into `01`, 5.
- Move K31 "Cloud VM: ordering, access, network" from Kubernetes to the end of the Networks block (requires D02? no — reword it as "A VM at a provider", requires F06, N17, N18). Then P02 and pet projects 1 and 4 become legitimate. Add the concept N22 "Tunnel and VPN, WireGuard" to the graph (requires N03, N11, N17).
- Pet project 2: extend "Opens after" with "and the course bot template (ready code in Python, the learner writes only the Dockerfile, CI and the rollout)". In 9.8, correct the line "Bash and Python" honestly: "Bash — in the Linux block; Python — outside the course, only reading ready code in pet project 2".

### 16. MAJOR — The methodology quiz uses concepts that do not exist yet

**Where:** 8.1, items M-1, M-2, M-5.

**What is wrong.** The methodology block quiz (block 1) contains:
- M-1: "a commit to main" (C02, C03), "artifact" (C09), "GitOps" and "controller" (K29, K03);
- M-2: "image", "registry", "environment" (D08, D18) and "the C09 concepts";
- M-5: concepts I01 and O08 — blocks 7 and 8.

The vocabulary linter from section 2 should fail these items. The fact that they made it into the samples shows that the linter was not run on the document's own examples.

**Fix.**
- M-1: "Every change merged into the shared branch is automatically checked by tests and built into a version of the program ready for rollout. A person rolls it out to prod by pressing a button". Replace option d) with "Manual testing — *incorrect: the checks here are automatic, only the rollout step is manual*".
- M-2: the steps "(1) rollout to prod, (2) code style check and build, (3) fast automated tests, (4) packaging the version and storing it in the version storage, (5) rollout to the test environment (F10), (6) checking the whole system in the test environment, (7) manual approval"; concepts M14, M15, M17, F10.
- M-5: move it to the *final review* quiz (after monitoring) or rewrite the right column without I01/O08: "describe server configuration in files and apply it automatically" / "watch the system and alert on failures" with `forward: [I01, O08]` under the rule of `01`, 6.1 (one look-ahead per lesson).
- Add a rule to section 2: "The samples in this document are run through the vocabulary linter in CI just like the bank".

### 17. MAJOR — Module IDs and concept IDs collide across documents

**Where:** 3.1 (`module: D08 # модуль = урок графа`), 3.1 (`remedy: [N14, N19]`), 11.

**What is wrong.** `module` in `10` is "a graph lesson", that is, a concept ID. In `02`, however, the modules are L01…L16 (L13 — "Disks"), in `03` — N0…N15 (N14 — "VPN"), in `04` — D1…D10, in `05` — K0…K14. Hence `remedy: [N14, N19]` for 504: in the graph N14 is HTTP, in `03` it is the VPN module. `l11-permissions` in the bank path is ambiguous too: L11 in the graph is permissions, while in `02` L11 is a different module.

**Fix.** Introduce ID namespaces and record the rule in 3.1 and 11:
- concepts — `c:` + graph ID (`c:N14`); in YAML the `concepts` field is in this namespace by default;
- modules — `m:<block>/<module ID from the block document>` (`m:networks/N14`, `m:linux/L13`);
- the `module` field in an item — only `m:`; the bank path is `bank/<block>/<module ID>-<slug>/` by the module ID from the block document;
- `remedy` — only `c:` concepts.

The build checks that every `m:` exists in `content/modules.yaml`, and every concept of a module exists in the graph.

### 18. MAJOR — The name "On-call" is already taken by exam E4 in `04`

**Where:** 6.3; `04`, 13.4.

**Fix.** Name the cross-block exam "On-call shift" (`exams/oncall-shift.yaml`), and keep E4 in `04` as "On-call (containers)" or suggest to the `04` author "Container incidents". Otherwise progress and protocols will have two different entities with the same name.

### 19. MAJOR — The weight of explanations on the exam contradicts `01`, 11.2

**Where:** 0 (decision 6), 6.1, 6.2 (`explain.weight: 30`).

`01`, 11.2: explanations "do not fail the exam, but give an "interview readiness" mark". In `10`, explanations give 30% of the total with a 70% threshold, so in practice they can fail the exam. There is also a pedagogical argument in favor of `01`. Grading an explanation by the learner's neural network or by self-assessment is unreliable, and if it is mixed with the fact-based check, the exam score becomes dishonest: a learner without a neural network gets "self-assessment" for 30% of the passing score. The fix is in finding 11 (weight 0, a separate mark).

### 20. MAJOR — AI on the exam: the wording contradicts `01`, `04`, `05` and R2

**Where:** 0 (decision 8), 6.1 (the "Assistant" row), 7.

**What is wrong.** In `01` 11.2, `04` 13 and `05` 9, the neural network is off on the exam, period. `10` has a "with assistant" mode, and it is unclear whether this is the built-in assistant or an external one. R2 (step 5) requires "only the official documentation is open". The "we do not monitor" stance itself is right, but the "with assistant" mode cannot be called a block exam: it is a practice run.

**Fix (the 6.1 table, the "Assistant" row, and the first-screen text, 7):**

> The built-in mentor is always off on the exam; only the built-in viewer of the official documentation is open (finding 1e). We do not control external AI and do not pretend that we do. The learner chooses: **"exam"** — a word of honor that they work only with the documentation (counts as passing the block, the protocol says "without assistant"); **"practice"** — with any assistants (the protocol says "practice run", it does not close the block exam, but it is not penalized in any way and gives a full debrief).

Keep the last sentence of the first-screen text ("both modes are normal"). There is no contradiction: both are normal, but only one closes the block.

---

## C. Factual and technical errors

### 21. MAJOR — M-4: the DORA metrics are grouped incorrectly

**Where:** 8.1, M-4, option b.

According to the current DORA guide ([dora.dev/guides/dora-metrics](https://dora.dev/guides/dora-metrics/), updated 05.01.2026), the metrics are divided into **throughput**: change lead time, deployment frequency, **failed deployment recovery time** — and **instability**: change fail rate, deployment rework rate. The document assigns recovery time to stability, and describes rework rate as "since 2025 also the share of unplanned deployments, rework rate", as if these were two metrics. It is one metric: the share of deployments that were unplanned and fixed a user-visible defect. It appeared in DORA reports in 2024, not in 2025.

Ready text for option b: "**Speed went up, stability went down; an overall improvement is not proven — correct: DORA looks at two groups together: throughput (time from commit to prod, deployment frequency, recovery time after a failed deployment) and instability (change fail rate and the share of unplanned fix deployments, rework rate).**"

### 22. MAJOR — D-2: "an image with a different kernel" is itself a misconception

**Where:** 8.4, D-2, option a.

A container image contains no kernel. The phrase "an image with a different kernel (for example, Windows on a Linux host) cannot be run without a VM" reinforces in a beginner exactly the misconception it is supposed to break (`docker.image-contains-kernel`). Fix: "…that is why a container starts in a fraction of a second, while a program that needs a different kernel (for example, a Windows application on a Linux host) cannot be run in a container without a VM: an image has no kernel, only files". Add the misconception to the catalog and make it a distractor in D-2 (the option "Its own lightweight kernel instance").

### 23. MAJOR — L-3: `journalctl -u nginx` does not show the nginx log

**Where:** 8.2, L-3.

By default nginx writes `error.log` and `access.log` to `/var/log/nginx/`, and only the startup and shutdown messages on stderr reach the systemd journal. The answer "the nginx service log for the last hour = `journalctl -u nginx --since "1 hour ago"`" is formally correct for the unit, but misleading in practice. The same misconception later breaks the "504" drill: there the learner has to read `error.log`. Fix: replace the service with one that writes to journald (`ssh` / `sshd` or the training service `shop-api`), and add a line to the debrief: "nginx has its own log files — `/var/log/nginx/error.log`; `journalctl -u nginx` will show only startup and shutdown". Or turn this into a separate `choice` item, "where to look for the cause of a 502 in nginx".

### 24. MINOR — L-2 and N-5: concepts outside the graph

L-2 relies on "file descriptor" and `lsof`. The graph has neither a descriptor concept nor `lsof`: in `02`, `lsof +L1` is in module L13, but the `01` graph has no corresponding concept. The Linux quiz contains nginx (N19 — the Networks block). N-5 relies on `tcpdump` and `mtr`, which are not in the graph. Fix: in L-2, replace nginx with "the `report` service", and add to `concepts` a new concept "file descriptor, `/proc/<pid>/fd`, `lsof`" (I will add it to the graph as L39, requires L26). In N-5, specify the concept "packet capture, `tcpdump`" (I will add it as N23, requires N07) or remove the line.

### 25. MINOR — K-1: the concept list is incomplete; K-2 relies on cluster DNS

K-1 checks Deployment, ReplicaSet and controller-manager: `concepts` should contain K11, K12, K27, not just "K02–K08, K11". K-2 uses `curl http://web`, that is, K16 (CoreDNS), which is not in the list. Without this, the rule "an item is shown when all concepts are introduced" will not work.

### 26. MINOR — I-5, option b: "the plan of changes is not shown before applying"

Ansible has `--check --diff`, a preview of changes inside the VM. The debrief is inaccurate. Ready text: "*incorrect as the best answer: the modules exist, but Ansible does not keep state of cloud resources: it will not figure out to delete a VM that disappeared from the playbook, and it has no reliable plan of cloud changes like `terraform plan` (`--check` is not supported everywhere for cloud modules).*"

### 27. MINOR — C-1: `forbid` is used as "counts with a note"

Per `06` and `09`, `forbid` means "does not count". For `only/except` a separate mechanism is needed — `warn`: "counts, the debrief has a note". I suggest adding to the format: `warn: { when: "yaml_path(.deploy.only)", say: {...} }`.

### 28. MINOR — D-3: a race condition in the task statement

`docker exec db psql …` right after `docker run -d postgres:16` often fails: the database is still initializing (`the database system is starting up` or there is no socket). This is a `predict` item, and the reference answer is generated by the simulator. If `dsim` models the initialization time, the output will diverge from the question. Add the line "(after waiting until the database is ready)" to the statement, or an `until pg_isready` step. Separately: starting with postgres 18, the `VOLUME` directory changed to `/var/lib/postgresql`. A parameterization variant with version 18 must change the path in the debrief as well.

### 29. MINOR — Voice: `SpeechRecognition.available()` is called without `quality`; whisper-base is poor for Russian

**Where:** 9.3.

According to MDN ([SpeechRecognition.available()](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/available_static)), the options include `quality` (`command` by default, `dictation`, `conversation`), and the result can be `available`, `downloadable`, `downloading`, `unavailable`. An interview needs `quality: "conversation"` or at least `"dictation"`. On `downloadable`, the product should offer `SpeechRecognition.install(...)` rather than going straight to the server. `whisper-base` makes noticeably more errors in Russian than in English. Filler words and the verbatim citation check (`evidence` must "occur verbatim in the transcript") are sensitive to recognition errors. Proposal: for RU, `whisper-small` (WebGPU) by default with `base` as a fallback, and make the citation check fuzzy (normalized word-level Levenshtein distance ≤ 0.15). Otherwise honest scores will be dropped because of recognition errors.

### 30. MINOR — Salary data is outdated by release time

**Where:** 9.8. "Based on job postings from August 2025" in a document dated 18.11.2026 is data 15 months old. There is a rule "a card without a date does not go into the build", but no freshness rule. Add to the linter: "market figures older than 6 months on the build date — a warning, older than 12 — an error".

---

## D. Underspecified and infeasible

### 31. MAJOR — `bugfind` and `hadolint` in the browser: it is not specified what runs the lint

**Where:** 2, 3.1 (`lint: hadolint`), 6.2 (`t1c`).

hadolint is a Haskell binary. It is unknown whether there is a browser build of it in the `09`, 6.1 stack. If not, the `lint: hadolint` check on tier A is infeasible. One of two is needed: (a) take a browser build of hadolint into the stack and test it in the phase 0 spike (`09`, 7); (b) our own rule set in TypeScript over a parsed Dockerfile, with the same `DL3xxx` codes, and golden records against real hadolint in CI. Record the decision in 13 as a dependency on `09`. The same applies to `lint: gitlab` (C-1): GitLab has no offline linter, only the `ci/lint` API. Our own schema based on the `.gitlab-ci.yml` JSON Schema from the GitLab repository is needed.

### 32. MAJOR — Career trainers without item texts and without logic for checking "bad paths"

**Where:** 9.2 (the "other drills" list), 11 (`Drill`).

Only "504" is described in detail. The other eight drills are one line each. The drill format does not say how `expect_action` is recognized when the learner writes free text ("I'll look at the nginx log") rather than a command. Proposal: a drill step accepts either a command (executed in the sandbox, recognized via the bus), or a choice among 4–6 "next steps" (`choice`, no neural network), or free text (the neural network matches it against the `expect_action` list and must return a step ID, otherwise it falls back to the choice). Without a neural network, a drill can be fully completed in the "command" and "choice" modes. Each of the eight drills needs a table of the same kind as for "504". At minimum, "disk full" and "pod in CrashLoopBackOff" before the MVP, because they are already in the "On-call" pools.

### 33. MINOR — The minimum sample size for item statistics is not specified

**Where:** 3.3. The thresholds p > 0.95 and p < 0.25 are meaningless on 5 answers. Add: "metrics are computed at n ≥ 30 first attempts per variant; until then the item is marked "insufficient data"". Point-biserial correlation — at n ≥ 50.

---

## E. Pedagogy and levels

### 34. MAJOR — The same bank for L0 and L2: an experienced learner solves beginner items

**Where:** 8 (almost all items are "L0–L2"), 3.1 (`level` without variants).

For an experienced programmer, items like L-1 (`chmod 640`) are a waste of time and a signal that "this course is not for me". Per `01`, 3, L2 has a different entry point and a different level of challenge. Proposal — a `level_variants` field:

```yaml
level_variants:
  L0: { q: "...", options: [...] }           # with scaffolding, documentation step 1–2
  L2: { q: "Почему после `chmod 640 report.txt` процесс nginx (пользователь www-data, в группе adm) читает файл, а `backup` (в группе staff) — нет? Как проверить, не меняя права?", answer: "...", doc_step: 3 }
```

(The L2 question: "Why, after `chmod 640 report.txt`, does the nginx process (user www-data, in group adm) read the file, while `backup` (in group staff) does not? How do you check this without changing the permissions?")

Coverage rule: in the block quiz for L2, at least 50% of items are at `bloom: analyze` or higher, and not a single item has `difficulty` ≤ 2.

### 35. MINOR — A 60–120-minute exam for L0 with a hard timer

For an adult beginner, a hard timer on the first exam is a common reason to drop the course. `04` sensibly uses a soft timer. I suggest a soft timer for L0 (time goes into the protocol, passing is by state) and a hard one for L1/L2 (included in the finding 11 table). The time from the debrief remains a "fluency" signal, as in the entry assessment of `01`, 4.1.

### 36. MINOR — Beauty (R5): the exam page and the protocol have no visual requirements

**Where:** 6.4 ("Protocol"), 13.

The final exam protocol is what the learner will show to an employer, yet there are no requirements for how it looks. Add to 13 (for the `08` role): the protocol page in the Sankofa editorial layout (a text column, calm mode, RU/EN bilingual via a toggle, a QR code to the live page). Status colors — from the `08`, 5.2 meaning palette, without "gamified" badges. The "action log" block is shown as a terminal feed in the style of the course terminal. The exam screen — no animations except the step change; the timer is not red until the last 10 minutes.

---

## What I need to change in `01-andragogy.md` following this review (for the information of the `10` author)

- Graph: move D03–D05 and capability to Linux (L33–L38), new L39 "descriptor", N22 "tunnel/WireGuard", N23 "packet capture", move K31 to the end of Networks, split R05 into R05a/R05b, Kubernetes networking concepts (pod network model, EndpointSlice, NetworkPolicy, Gateway API).
- Section 5: the career block schedule in sync with finding 15.
- Section 14: the "where did you look?" mentor mode for step 4.
- Section 11.2: the exam framework from finding 11 (on my side, agreement with an explanation weight of 0 and a soft timer for L0).
