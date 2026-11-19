# Review of `01-andragogy.md` — the view of an assessment specialist and hiring manager (author of `10-assessment-career.md`)

Date: 18.11.2026. The document was read in full; for cross-checking, the sections on concept order, levels, checks and exams in `02`–`07`, the visual language in `08`, the v86 tiers and the machine network in `09`, and my own `10` were read. The links from section 15 were checked with requests (all respond with 200), and the licenses of `ts-fsrs` (MIT), `kubernetes/website` (CC BY 4.0) and `docker/docs` (Apache 2.0) were checked via the GitHub API.

## Verdict

The research base, the learner model, the concept order rule, the support ladder and the behavior of the AI tutor are the strong part, and they should be kept almost unchanged. But the document was written before the owner's requirements R1–R12, and right now it diverges from them in the most important places. The concept graph (section 6.2) is the only source of truth for the build linter, and it lacks what the owner builds the course on: a section "How the kernel isolates and limits" in Linux, the anatomy of a container and its six boundaries, the map of the internet and a protocol catalog, a large Kubernetes networking section, the controller chain and one's own controller, the three Kubernetes stages. There is no documentation ladder (R2) at all, and without it the AI tutor and the exams are set up opposite to the requirement: the tutor answers with hints from the lesson instead of sending the learner back to `man`. Process explanations (R3–R4) have become neither a step of the lesson anatomy nor a build check. In addition, the document has no concept identifier shared with the blocks: each block has its own numbering and its own order, and in several places they contradict the `01` graph. Until this is reconciled, the term-order linter cannot be built. Total: **5 blocking, 13 major and 11 minor findings**. Below, each has ready text or a concrete edit.

---

## Blocking

### 1. BLOCKING — The course has five incompatible concept graphs

**Where:** sections 6.1–6.2; comparison with `02` §5.1, `03` §3, `04` §2, `05` §3, `06` §0.2, `07` §3.

**What is wrong.** `01` declares `content/concepts.yaml` with identifiers `L01…L32`, `N01…N21`, `D01…D23`, `K01…K33`. In the block documents the same letters denote **modules**, not concepts (`L0…L16` in `02`, `N0…N15` in `03`, `D1…D10` in `04`, `K0…K15` in `05`, `M0…M12` in `07`), and concepts are named with string ids (`pod`, `service`, `[[ip-address|…]]`) or live in a separate `glossary.yaml` (`07`). This is not cosmetic; the order diverges too:

| Place | `01` | Block document |
|---|---|---|
| Pod and kubelet | K09 Pod requires K08 kubelet | `05`: Pod is No. 4, kubelet is No. 16 |
| kubeconfig | K05 next to kubectl, at the start | `05`: No. 37, after RBAC |
| Kernel | L27, after processes; lesson L17 stresses "the kernel is not introduced here" | `02`: the kernel is introduced in module L0 together with the terminal |
| SSH | N18, the "Networks" block | `02`: module L15, the Linux block |
| IP, port, DNS, HTTP | N01…N14, the "Networks" block | `02`: module L14 "The network from the machine's point of view" |
| MAC and IP | N01 IP before N06 MAC | `03`: N1 frame and MAC before N2 IP |
| Git | C01–C06 at the start of CI/CD, after Docker | `06`: block G right after Linux, before networks |
| YAML | L31 in Linux | `06`: module Y together with Git; `05` refers to `docker:yaml` |
| Runtime chain | D10, right after the container concept | `04`: No. 28, the last module D10 |
| namespaces, cgroups | D03, D04 in Docker | `02`: module L16 introduces namespace and cgroup |

One more cross-cutting order error: the networks exam (`03` §10, part B) runs on "two cloud VMs", while the cloud VM concept in `01` is K31, in the Kubernetes block.

**Fix.** Record in 6.1 the decision on who owns the graph and the identifier format:

> There is one concept graph for the course, and it lives in `content/concepts.yaml`. A concept identifier is `<block>.<slug>` (`linux.process`, `net.arp`, `k8s.pod`), a module identifier is `<block>.m<NN>` (`linux.m08`). The alphanumeric codes from the tables below (`L17`, `K09`) are aliases for readability; content uses the slug. Block documents set the order **within** a block and must use these slugs; if a block document needs a different order, it changes `concepts.yaml` through a review by the instructional designer, rather than starting its own list. Prerequisites from another block are written with the full id (`requires: [linux.cgroups-v2]`).

And rebuild 6.2 so that the conflicts from the table are resolved rather than hidden. My proposals for each:

- Pod before kubelet: adopt the order of `05` (the pod is introduced as "what we ask to run", kubelet when we need to explain who ran it). Then `K09.requires = [K01, K04, D06]`, `K08.requires = [K09, D10]`. This is also better for explaining the reconciliation loop (finding 9).
- Kernel: the kernel comes before processes, but in plain terms (`L00 linux.kernel-idea`: "the main program through which all others get the disk, memory and network"), while the system call and user space (L27) come later, as now. Lesson L17 can then say "the kernel creates the process" instead of avoiding the word.
- IP, port, SSH in Linux: keep the practical introduction in `02` ("how to look at the network on a server"), but as separate concepts `linux.net-commands` and `linux.ssh-basic`. The models (subnet, route, TCP) stay in networks. Rename the concept `net.ssh` from N18 to `net.ssh-protocol` (handshake, host keys) and make it depend on `linux.ssh-basic`.
- MAC and IP: adopt the order of `03` (frame, MAC, then IP). It explains why ARP exists and matches the layer-by-layer diagnosis from R8.
- Git and YAML: adopt the order of `06` (Git and YAML right after Linux) and rewrite the paragraph in the introduction and row 5 in section 5 (finding 6).
- Cloud VM: move K31 to the end of the "Networks" block as `net.cloud-vm` (ordering, public IP, security group, ssh), because the networks exam is the first to require it.

### 2. BLOCKING — Requirements R6/R7: the foundation of containers is not in Linux, the container anatomy is incomplete

**Where:** 6.2, tables "Linux (L)" and "Docker and containers (D)"; the paragraph after table N about "concrete before general".

**What is wrong.** R6 requires that everything the containers block relies on be introduced in Linux. Right now namespaces (D03), cgroups (D04) and chroot (D05) are concepts of the Docker block, and so is overlayfs (D09). Threads, fork/exec, capabilities and seccomp are not in the graph at all. The paragraph "the network namespace is introduced in networks and generalized in Docker" directly contradicts R6. The D table has no OCI bundle, shim, crun, lifecycle states, PID 1 and signals, log driver, UID inside and outside, which means there are also no "the container doesn't work" drills where the cause sits on one of the six boundaries (R7b).

**Fix — ready rows for `concepts.yaml`.** A new Linux module "How the kernel isolates and limits", after L26/L27 (in `02` this is an extended L16; it is better to split it into L16 "kernel and /proc" and L17 "isolation and limits"):

| ID | Concept | Requires | Commands and files introduced |
|---|---|---|---|
| L33 `linux.thread` | Thread and process: shared memory and group PID, own TID | L17, L26 | `/proc/<pid>/task/`, `ps -eLf`, `ps -T -p <pid>`, `top -H` |
| L34 `linux.fork-exec` | fork and exec, parent and child, PPID, zombie and orphan, how the shell finds a program via PATH | L16, L17, L19, L27 | `pstree -p`, `ps -o pid,ppid,stat,cmd`, `strace -f -e trace=clone,execve bash -c ls` |
| L35 `linux.namespaces` | Namespaces: pid, mnt, uts, ipc, net, user, cgroup, time; links in `/proc/<pid>/ns` | L26, L27, L34 | `lsns`, `readlink /proc/$$/ns/pid`, `unshare --pid --fork --mount-proc`, `unshare --uts`, `nsenter -t <pid> -a` |
| L36 `linux.cgroups-v2` | cgroups v2: the `/sys/fs/cgroup` tree, controllers, `memory.max`, `memory.events`, `cpu.max`, `pids.max`; the OOM killer | L17, L23, L26 | `systemd-cgls`, `cat /proc/self/cgroup`, `mkdir /sys/fs/cgroup/demo`, `echo 50M > memory.max`, `echo "20000 100000" > cpu.max`, `dmesg \| grep -i oom`, `systemd-run --scope -p MemoryMax=50M` |
| L37 `linux.capabilities` | root is split into privileges; the effective and permitted sets; file capabilities | L12, L27 | `capsh --print`, `grep Cap /proc/$$/status`, `getcap /usr/bin/ping`, `setcap cap_net_bind_service=+ep ./srv` |
| L38 `linux.mount-chroot` | Mounting in more depth: bind mount, one's own root point; `chroot` and how `pivot_root` differs from it | L25, L35 | `mount --bind`, `findmnt`, `chroot ./rootfs /bin/sh`, `unshare --mount` + `pivot_root` |
| L39 `linux.overlayfs` | overlayfs: lowerdir, upperdir, workdir, merged; copy-up, whiteout | L38 | `mount -t overlay overlay -o lowerdir=…,upperdir=…,workdir=… merged` |
| L40 `linux.seccomp` | seccomp (idea): a filter on a process's system calls | L27, L37 | `grep Seccomp /proc/$$/status` |
| L41 `linux.isolation-sum` | Summary: process + namespaces (what it sees) + cgroup (how much it may use) + capabilities (what it is allowed) + its own root (which files) | L35–L40 | — (explanation and lab, the word "container" as `forward`) |

Replace the paragraph about "concrete before general": "The network namespace is introduced in Linux as one of the kinds (L35), and in networks (N21) the learner applies an already familiar mechanism: `ip netns`, veth between namespaces, a route".

The containers block stops introducing kernel mechanisms and introduces what is built on top of them:

| ID | Concept | Requires |
|---|---|---|
| D03 `docker.recognize-isolation` | "Recognizing the familiar": a container has the same namespaces, cgroup, capabilities, its own root | L41 |
| D06 `docker.container` | Container = process + L35 + L36 + L37 + L38 (+ the default seccomp profile) | D03 |
| D24 `docker.oci-bundle` | OCI bundle: `rootfs/` + `config.json`; `runc spec`, `runc run` | D06, L31 |
| D10 `docker.runtime-chain` | docker CLI → (HTTP API over a unix socket) dockerd → containerd → containerd-shim-runc-v2 → runc or crun → process; the shim holds stdio and the exit code, runc exits after start | D24, L23, L34 |
| D25 `docker.lifecycle` | States: created, running, paused, restarting, exited, dead; mapping to the OCI states (creating, created, running, stopped) | D10 |
| D09 `docker.image-layers` | An image as a stack of overlayfs layers; the container's top layer is ephemeral | D08, L39 |
| D20 `docker.network` | veth pair, the `docker0` bridge, MASQUERADE outward, `-p` as DNAT (+ `docker-proxy`), the embedded DNS `127.0.0.11` only in user-defined networks, the `host` and `none` modes | D12, N11, N17, N20, N21 |
| D26 `docker.pid1` | PID 1 in a container: signals without a handler are ignored by default, `docker stop` = SIGTERM, SIGKILL after 10 s (`-t`), zombies, `--init` (tini), the exec form of CMD | D15, L18, L34 |
| D27 `docker.logs` | stdout/stderr → log driver (`json-file` by default, `local`, `journald`), `max-size` rotation; why a log written to a file inside the container is not visible in `docker logs` | D11, L13, L24 |
| D28 `docker.identity` | Configuration and identity: env, secrets (file vs variable), UID inside and outside, user namespace (`userns-remap`, rootless), bind mount permissions | D13, D14, L11, L35 |
| D29 `docker.six-boundaries` | The diagnostic model: six boundaries (host kernel, network, storage, process and signals, I/O and logs, configuration and identity) — "at which boundary did it break?" | D20, D26, D27, D28, D13 |
| D30 `docker.vm-to-containers` | Evolution: hardware → VM → containers → nesting (containers in cloud VMs). The second half of the explanation (Kubernetes on bare metal, VMs inside Kubernetes via KubeVirt and Cozystack) is introduced in the Kubernetes block as K52, because it requires K01 | D07 |

In K09 `requires`, replace `D03` with `L35`; in K22, `D04` with `L36`; in K13, with `L35`.

Drills on the six boundaries (R7b), one symptom and one boundary each, each with 3–5 cause variants by seed. The check is by state, plus the learner marks the boundary on the container diagram (`hotspot` on `node.id`); the boundary without a fix gives 0.3 points, a fix without the correct boundary gives 0.7.

| Boundary | Symptom | Cause variants | Check |
|---|---|---|---|
| Host kernel | `docker run` fails with `exec format error` | an arm64 image on x86; an empty file without a shebang as ENTRYPOINT; a binary built against glibc in alpine | the container is `running`, `docker inspect …State.ExitCode` = 0 after 30 s |
| Network | `curl localhost:8080` from the host gives `connection refused` | the application listens on `127.0.0.1` inside the container; the wrong port is published; `--network none` | HTTP 200 from the host; `forbid: network_mode=host` |
| Storage | after recreation, user uploads are gone | writes to the top layer; the volume is mounted at the wrong path; an anonymous volume instead of a named one | a `recreate` probe preserves a marker file |
| Process and signals | `docker stop` waits 10 s, the application loses unwritten data | shell form of CMD, `sh` receives the signal; PID 1 has no SIGTERM handler; zombies accumulate | `docker stop` < 2 s, the log has the line `graceful shutdown`; `ps` inside has no `Z` |
| I/O and logs | `docker logs` is empty although the application "writes logs" | it writes to `/var/log/app.log` inside; stdout buffering (Python without `-u`); the `none` driver | a marker line is visible in `docker logs` within 5 s |
| Configuration and identity | `Permission denied` when writing to a bind mount | the process UID is 1000 inside, the host directory belongs to root; read-only mount `:ro`; userns-remap shifted the UID | the file is created, `forbid: chmod 777` on the host directory |

### 3. BLOCKING — There is no documentation ladder (R2), and the tutor and the exams are set up against it

**Where:** sections 3, 7, 9, 11.2, 14.1–14.3; rule 6.1.

**What is wrong.** The document knows only one ladder — support S0–S5 — and one hint ladder H1–H5, where H3 refers to the lesson screen, not to the documentation. 14.3 has one phrase, "for questions about flags — `man` first", but there are no steps, no moments when the course starts **forcing** the learner to read documentation, and no design of exams with open official documentation. There is also a direct conflict with R2: rule 6.1 "not a single term before it is introduced", as currently worded, forbids step 4 tasks built on what was not in the theory.

**Fix — a new section 9a "Documentation ladder"** (insert after section 9):

> The documentation ladder is a third axis alongside the support ladder (S0–S5) and the hint ladder (H1–H5). Its step is stored **per documentation source**, not per concept: `man`, `--help`, `kubectl explain`, kubernetes.io, docs.docker.com, developer.hashicorp.com/terraform, docs.ansible.com, prometheus.io/docs. Experience with one source partially transfers to another: a learner at step D4 for `man` who opens kubernetes.io for the first time starts at D2, not at D1.
>
> | Step | How it looks in a lesson | What the tutor does | How it is checked | Which levels enter at this step |
> |---|---|---|---|---|
> | D1 "Glimpses" | Under an example, a line "this comes from here" with a link to the exact place (`ps(1)`, section OPTIONS, `-C`). Following it is optional | As now | Not checked; opening is written to the log (`doc_open`) | L0 |
> | D2 "The hint is the page" | An H2/H3 hint is not our text but a fragment of the real page in the viewer: the NAME/SYNOPSIS header is always visible, the relevant line is highlighted, with captions "SYNOPSIS: how to call", "OPTIONS: flags", "EXAMPLES: ready examples". Once per module, a micro-task on anatomy: "click the section where you should look for a flag" | Gives the hint as a page fragment, not in its own words | `hotspot` on a page section | L1 |
> | D3 "Find the flag" | Task "find the flag that does X"; only a link to the whole page is given, without highlighting | Hints H1–H2, then "the OPTIONS section, search for the word …" | By state: the flag's effect is achieved by any path. It is credited separately if the page was opened before the answer | L2 |
> | D4 "Enforcement" | In practice and trainers, 20–30% of tasks require flags and subcommands that were not in the theory (`untaught:`); there are no lesson hints | `forcing` mode: to any question, first "Where have you already looked?"; if nowhere, it names the **type** of source (`man ss`, `kubectl explain pod.spec`, `docker run --help`); if the learner looked, it names the section; then a word to search for. It never names the flag itself | By state; the debrief shows the path "which page was opened and after how many seconds the answer was found" | All, from the middle of the block |
> | D5 "Exam with documentation" | During the exam only the built-in viewer of official documentation is open (modelled on the CKA). One task in 3–5 is built on something not in the course | Off | As an exam; the out-of-course task is not marked `critical`, its weight is ≤ 25% | All |
>
> Moving up: a source's step rises when three tasks in a row at that step are solved without H4–H5 hints; at D4, when in two of three tasks the needed page was found faster than the norm. The step never goes down: if the learner is stuck at D4, the tutor offers a D3 hint (a link to the page), but the step stays.
>
> The order rule (6.1) applies to **concepts**, not to flags and subcommands. An `untaught` task may require a flag that was not in the theory, but not a new concept: `ss -p` is allowed, "conntrack" without introduction is not. The linter checks three things for an `untaught` task: the listed flags do not appear in any route text before this task; the page from `doc_ref` exists in the versioned corpus snapshot; the answer is on that page (the authors give an anchor, the linter searches for the flag in the snapshot text).

A field in the task (compatible with the format in 4.2 and with the bank from `10` §3.1):

```yaml
id: linux.l08.drill.7
doc_ladder: D4
untaught: ["ps --sort", "-o pid,%mem,cmd"]
doc_ref:
  - { source: man, page: "ps(1)", section: "STANDARD FORMAT SPECIFIERS", anchor: "--sort" }
prompt:
  ru: "Выведи пять процессов, которые занимают больше всего памяти, — только PID, %MEM и команду."
check:
  all:
    - output_rows: { cmd_any: true, columns: [PID, "%MEM", CMD], sorted_by: "%MEM desc", count: 5 }
ai_mode: forcing
```

The documentation corpus and licenses: man pages are already in the tier B image (`02` §1.3, `man-db` + `manpages`) and are shown from it; tier A needs the same snapshot of pages, built from the image in CI. Mirrors of kubernetes.io (CC BY 4.0) and docs.docker.com (Apache 2.0) can be kept offline with attribution; for Terraform, Ansible and Prometheus, the mirror license must be checked separately, and until it is checked, open the live site in the viewer and count only navigation from it.

**The ladder by block — what exactly happens at each step** (for the beginner; the intermediate starts at step D2, the experienced at D3):

| Block | D1 | D2 | D3 | D4 (enforcement) | D5 (exam) |
|---|---|---|---|---|---|
| Methodology | links to the Kanban Guide, dora.dev | a fragment of dora.dev with the definition of "failed deployment recovery time" highlighted | "Find on dora.dev which fifth metric was added to the four" (deployment rework rate) | — (a block without tools) | — |
| Linux | `ls(1)`, `cp(1)` under the examples of modules L1–L3 | from the permissions module: a `chmod(1)` hint with the line about `u+x` highlighted; a walkthrough of the page anatomy | from the processes module: "find the `ps` flag that shows the tree" (`--forest`, `f`) | from the services module: `journalctl --since "10 min ago" -p err` without explaining `-p`; `find -mmin`, `tar --exclude`, `systemctl list-dependencies` | block exam: `man` and `--help` are open, one task on `lsof +L1` or `ionice`, which are not in the course |
| Networks | `ip-address(8)`, `dig(1)` | a fragment of `ss(8)` with `-p` highlighted | "find how `dig` queries a specific server and shows the path from the root" (`@server`, `+trace`) | `tcpdump -nn port 53`, `curl --resolve`, `nft list ruleset` without explaining the flags | `man` and RFC links are open; one task on `mtr` or `ip rule` |
| Containers | docs.docker.com: `docker run` | a fragment of the `docker run` reference with `--memory` highlighted | "find the flag that replaces PID 1 with an init" (`--init`) | `docker run --read-only --tmpfs`, `docker inspect -f '{{.State.OOMKilled}}'`, `docker buildx build --platform` | docs.docker.com and `--help` are open; one task on `docker system df -v` or `--cap-drop` |
| Kubernetes | kubernetes.io: Pods, Deployments | the output of `kubectl explain deployment.spec.strategy` with `maxUnavailable` highlighted | "find in `kubectl explain` where `terminationGracePeriodSeconds` is set" | `kubectl debug --profile`, `topologySpreadConstraints`, `kubectl rollout history --revision` | only kubernetes.io/docs, /blog, helm.sh/docs, gateway-api.sigs.k8s.io (as in the CKA) and `kubectl explain` |
| CI/CD and Git | `git-commit(1)`, docs.gitlab.com | a fragment of `git log --help` with `--oneline --graph` highlighted | "find how to undo a commit without rewriting history" (`git revert`) | `git bisect run`, `rules:changes`, `needs:` without explanation | GitLab CI documentation and `git help` |
| IaC | developer.hashicorp.com: `plan` | a fragment of the `lifecycle` page with `prevent_destroy` highlighted | `ansible-doc lineinfile` — find the parameter that creates the file (`create`) | the `terraform import` block, `moved`, `ansible --check --diff` | `ansible-doc`, `terraform -help`, provider documentation |
| Monitoring | prometheus.io/docs: PromQL basics | a fragment of the PromQL functions with `rate` highlighted | "find the function that predicts the disk filling up" (`predict_linear`) | `absent()`, `label_replace`, `inhibit_rules` | Prometheus and Alertmanager documentation |

### 4. BLOCKING — The exam "the same for all levels" does not match any block

**Where:** section 3 ("the finish line is the same"), 11.2 (the "Kubernetes" paragraph), 13.

**What is wrong.** The principle "the level changes the entry, not the finish" is the main one in `01`, and `10` relies on it. But `04` §13 gives exams E1–E4 with different sets by level, `05` §9 gives exams B, I and E (CKA-like only for the experienced), and `03` §10 gives parts A and B without a split. `01` itself says in 11.2 that the Kubernetes exam installs kubeadm on three VMs, while `05` (decision 7) gives the beginner and the intermediate k3s on one VM, and kubeadm only to the experienced. Requirement R12 adds a third stage (kubeadm on 3+ VMs with Terraform and Ansible), which `01` cannot assign to "everyone" without rewriting the time budget.

**Fix.** In 11.2, replace the "Kubernetes" item and add a rule:

> **One block exam, different roads to it.** The block exam (the pass/fail test) is the same for all levels. Block documents may provide **practice** exams by level (for example, E1–E4 in Docker, B/I/E in Kubernetes), but only the block exam goes into the record and the skill map. The level changes how many practice exams the learner takes before the pass/fail test, not the test itself.
>
> **Kubernetes is passed in three stages**, and all three are mandatory for all levels: stage 1 — an exam in the browser (simulator and hybrid, ~90 minutes); stage 2 — a real single-node cluster (k3s, kind or minikube) on one's own machine or a single VPS: Helm, Ingress or Gateway, an image from a real registry; stage 3 — kubeadm on 3+ VMs ordered by Terraform and configured by Ansible (comes **after** the IaC block, see finding 5). At stage 3 the trainer executes nothing: it guides step by step, shows the VM cost and checks the result with the `trainer-check` script. The "CKA-style" exam from `05` §9.3 remains an optional advanced track for the experienced.

I will carry the same wording over into `10` §6.1, so that the two documents have one rule.

### 5. BLOCKING — The block order is incompatible with R12 and with its own dependencies

**Where:** section 5, rows 6–8; graph K31, K32, I03.

**What is wrong.** Row 7 justifies IaC by "the learner ordered VMs for the cluster by hand", while R12 requires that Kubernetes stage 3 be done **through** Terraform and Ansible. Right now K32 (kubeadm) is in block 6 and IaC in block 7, so stage 3 cannot be completed where it sits in the graph. In addition, `06` §0.1 puts Ansible before Terraform, while the `01` graph does the opposite (I04 Terraform before I09 Ansible).

**Fix — a new table for section 5:**

| No. | Block | Checklist step | Why here |
|---|---|---|---|
| 0 | Orientation (L0 only) | — | as now |
| 1 | Methodology | 1 | as now |
| 2 | Linux (incl. "How the kernel isolates and limits") | 2 | The foundation; by the end of the block the learner knows everything a container is made of |
| 2a | Git and YAML | — | Needed from the Docker block: Dockerfile and compose live in a repository (decision of `06`) |
| 3 | Networks (map of the internet → envelopes → layers by hand → whole processes; cloud VM at the end) | 3 | Needs Linux (process, socket, net namespace) |
| 4 | Containers | 4 | Needs Linux (L33–L41) and networks (veth, bridge, NAT, DNAT) |
| 5 | CI/CD | 1 (practice) | The pipeline builds and publishes an image |
| 6 | Kubernetes, stages 1–2 (browser, hybrid, single-node cluster), incl. the "Kubernetes networking" section | 5 | Only after the Docker exam |
| 7 | IaC: Ansible, then Terraform | 6 | Ansible relies on the already familiar (ssh, systemd), Terraform introduces a cloud resource (decision of `06`) |
| 7a | Kubernetes, stage 3: kubeadm on 3+ VMs via Terraform and Ansible | 5 + 6 | The first task where IaC pays off: three identical machines, repeatable configuration, cleanup with one command |
| 8 | Monitoring | 7 | Monitors the stage 3 or stage 2 cluster |
| 9 | Pet project | 8 | as now |
| 10 | Career | 9–11 | as now |

In the graph: `K32.requires = [K26, K27, I05, I10, net.cloud-vm, N15]`; swap I04 and I09 in row order (Ansible first), `I03.requires = [net.cloud-vm, N14]`.

---

## Major

### 6. MAJOR — The introduction and section 5 describe a deviation from the checklist that no longer exists

**Where:** the second paragraph of the document; section 5, row 5.

The paragraph "Git… is introduced at the start of the CI/CD block" is wrong after findings 1 and 5. Replacement:

> The document deviates from the checklist order in three places: Git and YAML are introduced right after Linux (Dockerfile and compose require them); CI/CD practice is moved into a separate block after containers; installing Kubernetes on several VMs (stage 3) comes after IaC, because it is done through Terraform and Ansible.

### 7. MAJOR — Process explanations (R3, R4) are built neither into the lesson anatomy nor into the build

**Where:** sections 7 and 8 (rules R8, R9, R15).

**What is wrong.** In the lesson anatomy, the "Watch" step is "an interactive diagram or a worked example". There is neither a requirement that every process concept has a process explanation, nor a pedagogical contract for such an explanation (predict, change a parameter, see the recalculation with an explanation, break a component, rewind a step). Rule R9 allows "ink drawings from the Sankofa engine" in hooks, while the owner's R5 excludes them; `08` §5.1 also keeps ink for metaphors and characters, while R4 forbids characters and plot.

**Fix.** (a) Replace rule R9:

> R9. No decorative illustrations, characters or narrative pictures, including in hooks. A hook is typography and a real work artifact: a chat message, a ticket, an alert, a piece of output. From the Sankofa engine we take the magazine-style text presentation, scroll scenes, layers, calm mode, lenses, QR, bilingual YAML, `draft`/`hold`; ink drawings are not taken.

(b) Add rules R16–R20 to section 8:

| No. | Rule | Basis | Check |
|---|---|---|---|
| R16 | Every module where a process concept is introduced (marked `process: true` in the graph) has at least one `kind: explainer` explanation | The owner's R3; segmenting | build |
| R17 | An explanation is steps, not video: forward, back, pause, jump to any step; animation only shows movement (a packet along a line, a layer appearing, a counter growing) | Segmenting | build: an `explainer` has `steps[]`, no `autoplay` longer than 5 s |
| R18 | Every element of the diagram is clickable and explains itself (`node.explain`, `edge.label`); captions sit on the lines, not in a legend | Spatial contiguity | build: every `node` and `edge` has text in two languages |
| R19 | Changing a parameter (`params[]`) immediately recalculates the process, and next to the changed place one sentence appears, "what changed and why"; before the first change, a prediction question | Prediction, generative processing | build: every `param` has `on_change.explain`, and at least one has `predict` |
| R20 | "Break it" (`breaks[]`) removes or damages one component; after the breakage the learner first answers what will break, then sees it | Deliberate practice; break-fix | build: a process explanation has ≥ 1 `break` |

(c) In the lesson anatomy table, rename step 2 to "Watch the process" and state: L0 — a step-by-step explanation with a prediction question on every second step; L1 — the same, with parameters open from the start; L2 — the explanation opens after the challenge task, starting in "break it" mode.

(d) A mandatory registry of explanations by block (tied to the graph so that the order rule also applies to explanations). "After" is the concepts that must be introduced; steps and parameters are the minimal set for the storyboard by the block's role and by `08`.

| Block | Explanation | After | Steps (brief) | Parameters | "Break it" | Prediction question |
|---|---|---|---|---|---|---|
| Methodology | A task from idea to prod | M05, M14, M15 | card → development → review → CI → staging → prod → metrics | batch size, WIP, share of manual steps | remove automated tests | "What happens to lead time if the batch is doubled?" |
| Methodology | Incident: alert → postmortem | M12 | alert → on-call → status → mitigation → fix → postmortem | response time, whether a runbook exists | remove the on-call engineer | "Where are the most minutes lost?" |
| Methodology | A bottleneck in the flow | M09 | queues grow in front of the slow column | column throughput, WIP | remove the WIP limit | "Will a second developer speed up the flow?" |
| Linux | Machine boot | L23, L27 | firmware → bootloader → kernel → initramfs → systemd (PID 1) → units → getty/ssh | `systemctl` target, a failing unit | remove an `/etc/fstab` entry | "Will the machine boot if nginx failed?" |
| Linux | fork/exec and PATH | L34 | Enter → parsing the line → lookup via PATH → fork → exec → wait → exit code | PATH contents, alias | remove a directory from PATH | "What will `type ls` print?" |
| Linux | Pipeline | L15, L34 | two processes, a kernel buffer, blocking on a full buffer, SIGPIPE | buffer size, reader speed | kill the reader | "What happens with `yes \| head -1`?" |
| Linux | systemd restarts a crashed service | L23, L24 | the process crashes → systemd receives SIGCHLD → `Restart=on-failure` → `RestartSec` → `StartLimitBurst` | `Restart=`, `RestartSec`, the limit | exhaust the limit | "After how many attempts will the unit become failed?" |
| Linux | How the kernel isolates and limits | L35–L40 | process → its own pid frame → its own mnt frame → net frame → the cgroup thermometer → the set of capabilities | `memory.max`, `pids.max`, `cpu.max`, visible namespaces | remove the mnt namespace (the process sees the host root) | "What will `ps` show inside a new pid frame?" |
| Networks | Entering a URL | N16, N19 | DNS → TCP → TLS → HTTP → proxy → backend → response | DNS cache TTL, RTT, keep-alive | delete the DNS record, take down the backend | "How many RTTs until the first byte with TLS 1.3?" |
| Networks | DNS name resolution | N08, N09 | stub → recursive → root → TLD → authoritative → cache | TTL, whether a cache exists | unreachable root (the cache saves the day) | "Will the query go to the root the second time?" |
| Networks | TCP + TLS handshake | N05, N15 | SYN, SYN-ACK, ACK, ClientHello, ServerHello…Finished | RTT, TCP window, packet loss | an expired certificate | "How much data goes out in the first RTT with a window of 10 segments?" |
| Networks | A packet through NAT and a router | N03, N11, N17 | headers change at every hop: the MAC every time, the IP only at NAT | NAT rule, route | delete the return route | "Which src IP will the server see?" |
| Networks | Where a 504 comes from | N19 | client → proxy → upstream; the proxy timeout | `proxy_read_timeout`, backend response time | DROP on the firewall toward the upstream | "502 or 504 if the backend is not running?" |
| Containers | `docker run`: from the CLI to the process | D10, D25 | CLI → dockerd API → containerd → shim → runc → `clone` with namespaces → exec → runc exits | `--memory`, `--pid=host` | kill the shim / dockerd (with `live-restore` the container lives on) | "Will the container die if dockerd is restarted?" |
| Containers | `docker build` layer by layer | D09, D16 | each instruction → layer → cache key → CACHED or rebuild | order of COPY/RUN, editing a file | change `requirements.txt` | "Which steps will be rebuilt?" |
| Containers | `docker pull` by manifest | D19 | tag → index → platform manifest → config → layers by digest → unpacking | platform, already downloaded layers | swap a layer (the digest does not match) | "How many bytes will be downloaded if the base is already there?" |
| Containers | Hardware → VM → containers (R7c) | D07 | see the storyboard in finding 10 | — | — | — |
| Kubernetes | The reconciliation loop (R10) | K03 | see the storyboard in finding 9 | — | — | — |
| Kubernetes | `kubectl apply` through all components | K27, K08 | kubectl → API (authn, authz, admission) → etcd → Deployment controller → RS controller → scheduler → kubelet → CRI → status back | replicas, image | turn off the scheduler (pods Pending) | "What will `kubectl get pods` show if there is no scheduler?" |
| Kubernetes | Pod scheduling | K07, K22 | filters (resources, taints, affinity) → scoring → binding | pod requests, free node capacity, taint | raise requests above capacity | "Which node will the pod land on?" |
| Kubernetes | Rolling update | K12 | new pods per `maxSurge`, old ones removed per `maxUnavailable`, readiness holds traffic | maxSurge, maxUnavailable, startup duration | broken readiness | "How many ready replicas at the worst moment?" |
| Kubernetes | Node failure | K27, K21 | kubelet goes silent → `node-monitor-grace-period` → NotReady → taint → eviction after `tolerationSeconds` (300 s) → new pods | grace period, tolerationSeconds | — | "After how many minutes will the pods move?" |
| Kubernetes | A request through Service, Ingress/Gateway, kube-proxy | K15, K18 | client → LB → node → Gateway/Ingress → ClusterIP → DNAT to a pod | kube-proxy mode, number of endpoints | a pod without the required label | "How many endpoints if one pod has a typo in its label?" |
| CI/CD | git push → deploy | C13, C14 | push → webhook → runner → stages → image → registry → deployment → health check | `rules`, `when: manual`, cache | a red test | "Will a commit in a feature branch reach prod?" |
| IaC | terraform plan/apply and state | I05, I06 | configuration + state + refresh → diff → plan → apply → new state | changing an attribute (in-place vs replace) | editing a resource by hand (drift) | "What will plan show after a manual edit?" |
| IaC | An idempotent Ansible run | I02, I10 | facts → the task compares desired with actual → ok/changed → handler | changing a template | `shell` instead of a module | "How many changed in the second run?" |
| Monitoring | scrape → storage → PromQL → alert → notification | O04, O08 | target → `/metrics` → TSDB → `rate` → rule → pending → firing → Alertmanager → grouping → receiver | `scrape_interval`, `rate` window, `for:` | target down (`up == 0`) | "Will an alert with `for: 10m` fire on a 3-minute spike?" |

### 8. MAJOR — Requirement R1: the theory is scattered across 120-word screens, there is no coherent textbook

**Where:** section 7 (step 4 "Explanation" — 1–3 screens), rule R4 in section 8.

**What is wrong.** The owner puts a textbook with coherent theory at the core of the course, and practice on top of it. In `01`, theory is the fourth step of seven, "a short coherent text" on 1–3 screens of 120–180 words. A book does not add up from such pieces, and an experienced learner who wants to read a chapter before a task cannot do so. It also follows that section 1 declares break-fix the "cross-cutting format", while R1 puts practice after the three pillars.

**Fix.** Add to section 7 before the table:

> The order of the course's pillars: (1) the textbook — coherent theory with a strict concept order; (2) process explanations; (3) the documentation habit (section 9a); practice stands on them. Every module has a **chapter** — a coherent text of 1,500–4,000 words with sources, written like a magazine article (the text presentation comes from Sankofa). Lesson screens are cut out of the chapter and reference its paragraphs; the whole chapter is available in "read" mode at any level. Rule R4 (120/180 words) applies to interactive screens, not to the chapter. An L2 learner can open the chapter before the challenge task; this does not violate the "task first" order: the task still comes first on the lesson screen, but the book is not hidden.

In section 1 (Ericsson), replace "therefore the cross-cutting trainer format is break-fix" with "therefore the main trainer format is break-fix; trainers rely on the module's chapter and explanations and reference them in the debrief".

### 9. MAJOR — The reconciliation loop (R10) is a single concept K03, with no controller chain and no own controller

**Where:** graph K03, K11, K12, K27, K30.

**Fix — graph rows:**

| ID | Concept | Requires |
|---|---|---|
| K03 `k8s.reconcile` | Desired (YAML in etcd) versus actual; the controller compares and corrects endlessly; level-triggered | K02, K04 |
| K40 `k8s.controller-chain` | The chain: Deployment → ReplicaSet → Pod → scheduler (`nodeName`) → kubelet (container) → status upward; ownerReferences and garbage collection | K12, K07, K08 |
| K41 `k8s.write-controller` | One's own controller in the browser: watch, list, compare, create/delete, resync | K40, K30 |

**Storyboard of the "Reconciliation loop" explanation** (`explainer`, on top of kube-lite; six screens, one idea per screen):

1. Two columns: on the left "desired" — a YAML card `replicas: 3` captioned "stored in etcd"; on the right "actual" — three pod rectangles. Between them is the controller: a circle with an arrow "compare → correct", the loop counter grows. Clicking on any element explains it.
2. **Delete a pod.** The learner clicks a pod and deletes it; a loop: "desired 3, actual 2 → create 1". The explanation next to the new pod: "the controller does not know *why* the pod disappeared, it cares that one is missing". Prediction before the click: "How many pods will there be after one loop?"
3. **Change replicas** (slider 0–10). Immediate recalculation; next to it, "difference 3 → 7: create 4". At 0, "pods are deleted, the Deployment remains".
4. **Kill a node** (toggle). The node's pods turn grey "Unknown"; the loop does not act immediately — the `tolerationSeconds` counter counts down (slider 10–300 s); then pods are created on other nodes. Explanation: "we wait because the node may have just briefly dropped off the network".
5. **Change the image.** A second ReplicaSet appears; pods are replaced per `maxSurge`/`maxUnavailable`; the "desired" and "actual" columns now show two rows each. From here, the transition to the second part: the chain.
6. **The controller chain.** A horizontal diagram: Deployment controller → ReplicaSet controller → scheduler → kubelet; each has its own small loop and its own "desired/actual" pair (for the scheduler: a pod without a node → a pod with a node; for the kubelet: a pod on the node → a container in the runtime). "Break it": turn off any controller and see where the flow gets stuck (without the scheduler — Pending, without the RS controller — the Deployment exists, there are no pods).

**Lab "Your own controller".** A TypeScript editor, the kube-lite API:

```ts
// the learner is given a skeleton; fill in reconcile()
export async function reconcile(api: Api, site: Website) {
  const pods = await api.list("Pod", { labels: { site: site.metadata.name } });
  // TODO: create the missing ones and delete the extra ones to reach site.spec.replicas
}
```

The check is a hidden test bench with five scenarios: create `Website{replicas: 3}` → within ≤ 5 loops exactly 3 pods with an ownerReference; delete a pod → restored; `replicas: 1` → the extra ones are deleted; **lost events**: the bench drops 50% of watch events — the controller must converge via resync (a level-triggered check); two controllers at once must not create 6 pods (an idempotency check: creation by a deterministic name or with a check). Final screen: "This is what an operator is: the same loop for one's own resource (CRD)", a bridge to the operator pet project in Go.

### 10. MAJOR — The "hardware → VM → containers → nesting" explanation (R7c) and practice on v86 are missing

**Where:** D02, D07; lesson anatomy.

**Storyboard** (`explainer`, D30, after D07; the second half is K52 after K01):

1. Two towers of layers side by side: on the left "hardware → hypervisor → guest kernel → libraries → application" ×N; on the right "hardware → host kernel → (namespaces + cgroups) → libraries → application" ×N. Every layer is clickable.
2. A "number of applications" slider 1–50. The counters under the towers are recalculated immediately: memory (VMs: N × (kernel ~100–300 MB + OS) versus containers: N × application + one kernel), startup time (VM — seconds to tens of seconds, container — fractions of a second), machine utilization. Next to it, an explanation of the layer that makes the difference ("the guest kernel is repeated N times").
3. A "kernel vulnerability" toggle. On the left one VM is highlighted (the boundary is the hypervisor), on the right all containers at once (a shared kernel). Explanation: "this is why clouds do not put strangers into containers on a shared kernel without VMs underneath".
4. "Today's nesting": containers inside a cloud VM (the most common case at work). The layers fold into one three-level tower.
5. (K52, in the Kubernetes block) Kubernetes on bare metal and VMs inside Kubernetes (KubeVirt, Cozystack): a pod with a QEMU process, and inside it a guest kernel. A "where is the isolation boundary" toggle shows it at each level.

**Practice** (on tier B, checked by the agent's output):

- "Your Linux in the browser is itself a virtual machine". `dmesg | grep -i -E 'hypervisor|bochs|qemu'`, `cat /proc/cpuinfo | grep -m1 'model name'`. Task: find a sign in the kernel log that the machine is virtual, and paste the line. Check: the line is present in this machine's `dmesg`.
- "Inside and outside". In one tab `uname -r` and `ps -e | wc -l` on the host, in the other in a container (crun on tier B). A prediction question before running: "Will the kernel version match?" Check: both values are entered, `uname -r` matches, the number of processes differs.
- "Stopwatch". Measure `time crun run …` and the boot time of a second v86 machine (the interface sets a timer from start to the prompt). Check: both numbers are entered and fall within allowed ranges, the learner chooses an explanation of the difference from three options.

### 11. MAJOR — Networks (R8): the graph starts with the interface, there is no map of the internet and no protocol catalog

**Where:** the "Networks (N)" table.

**Fix — new rows:**

| ID | Concept | Requires | Level |
|---|---|---|---|
| N00 `net.internet-map` | The internet as a network of networks: laptop → home router → provider → backbone → internet exchange point (IXP) → submarine cables → data center (a zoomable map) | F05 | all |
| N22 `net.as-bgp` | Autonomous system and BGP: who announces routes to whom (the idea at L0/L1, messages and attributes at L2) | N03, N00 | all / L2 |
| N23 `net.dns-hierarchy` | Root servers, TLD, authoritative servers, anycast | N08, N22 | all |
| N24 `net.cdn` | CDN: a cache near the user, anycast, edge | N19, N23 | all |
| N25 `net.which-layer` | The diagnostic principle: "which layer broke?" — OSI as a vocabulary ("an L3 problem", "an L7 load balancer") | N07 | all |
| N26 `net.tunnel-vpn` | Tunnel, re-encapsulation, WireGuard (keys, `AllowedIPs`, MTU) | N07, N11, N17 | L1+ |
| N27 `net.vlan` | VLAN: the 802.1Q tag, L2 separation | N06 | L1+ |
| N28 `net.overlay` | VXLAN and Geneve: L2 over UDP, VNI | N20, N05, N27 | L2, but mandatory before K26 |
| N29 `net.modern-http` | HTTP/2, HTTP/3 (QUIC), WebSocket, gRPC | N14, N15 | L1+ |
| N30 `net.mtls` | mTLS | N15 | L2 |

The first screen of the block is N00 (the big picture), then N07 as envelopes with real header fields, then the layers by hand (the order of `03` N1–N15), then end-to-end processes (N16, 504). `N07.requires` is then reduced to N00, and the "envelopes with fields" are shown twice: as an overview at the start, with header fields after N05.

**The protocol card** is a common format for the catalog (one card per protocol, identical sections):

```yaml
id: proto.dhcp
level: L0                       # L0 | L1 | L2 — from which level it is mandatory
layer: L7                       # per OSI; transport: UDP 67/68
why: { ru: "Получить адрес, шлюз и DNS, не зная ещё ничего о сети", en: "Get an address, a gateway and DNS without knowing anything about the network yet" }
sequence:                       # for the exchange diagram (packets from 08)
  - { from: client, to: broadcast, msg: DHCPDISCOVER }
  - { from: server, to: client,    msg: DHCPOFFER }
  - { from: client, to: broadcast, msg: DHCPREQUEST }
  - { from: server, to: client,    msg: DHCPACK }
observe: ["tcpdump -ni eth0 port 67 or port 68", "journalctl -u systemd-networkd"]
breaks:                         # how it breaks — each item is linked to a troubleshooting scenario
  - { symptom: "address 169.254.x.x", cause: "no response from the server", scenario: net.trbl.dhcp-1 }
concepts: [N10]
```

The catalog by level (R8): L0 — DHCP, ARP, ICMP, TCP, UDP, DNS, HTTP, HTTPS/TLS, SSH; L1 — NTP, SMTP, FTP/SFTP, HTTP/2, HTTP/3 QUIC, WebSocket, gRPC, VLAN, NAT/PAT; L2 — BGP, VXLAN/Geneve, IPsec, WireGuard, mTLS, OSPF (idea). The build checks that every card has all five sections and at least one breakage scenario.

### 12. MAJOR — Kubernetes networking (R9) is six rows, with no NetworkPolicy and no packet path

**Where:** K14–K18, K26.

**Fix — graph rows** (order from top to bottom):

| ID | Concept | Requires |
|---|---|---|
| K34 `k8s.net-model` | The network model: every pod has its own IP, pod ↔ pod without NAT, on any node; the CNI implements the model | K09, N11 |
| K26 `k8s.cni-path` | The packet path: on one node (veth → bridge or route), between nodes (routing, VXLAN/Geneve, eBPF in Cilium) | K34, N20, N28 |
| K14 `k8s.service` | Service and ClusterIP: a virtual address that is not on any interface (in iptables and nftables modes; in IPVS it sits on `kube-ipvs0`) | K10, K34 |
| K35 `k8s.endpointslice` | EndpointSlice (the Endpoints API is deprecated since v1.33, `kubectl get endpoints` prints a warning) | K14, K03 |
| K15 `k8s.kube-proxy` | kube-proxy: iptables, nftables, IPVS (being phased out) modes; replacing kube-proxy with eBPF in Cilium | K35, N17 |
| K16 `k8s.dns` | CoreDNS, `svc.cluster.local`, search domains, `ndots:5` and extra queries | K14, N09, N23 |
| K17 `k8s.nodeport-lb` | NodePort, LoadBalancer | K14, N11 |
| K18 `k8s.ingress` | Ingress and the controller (legacy: Ingress NGINX was retired in March 2026, `05` decision 4) | K17, N15, N19 |
| K36 `k8s.gateway-api` | Gateway API: GatewayClass, Gateway, HTTPRoute | K18 |
| K37 `k8s.netpol` | NetworkPolicy: by default everything is open; a policy works only if the CNI supports it; default deny | K10, K26, N17 |
| K38 `k8s.net-troubleshoot` | The method for "the pod couldn't reach the service": DNS → Service → EndpointSlice → pod (ready? listening?) → NetworkPolicy | K16, K35, K37, K33 |

**Drill "Find in iptables where a packet to a ClusterIP goes"** (hybrid, finding 13: kube-lite produces EndpointSlices, and a small kube-proxy agent on each v86 node writes **real** iptables rules). Task: "Pod `client` on `node-1` connects to `10.96.0.42:80`. Walk the rule chain and enter the IP and port of the pod the packet goes to if the first probability rule matches". The learner works with `iptables -t nat -L KUBE-SERVICES -n`, `iptables -t nat -L KUBE-SVC-… -n`, `iptables -t nat -L KUBE-SEP-… -n`. Check: the entered chain (`KUBE-SERVICES → KUBE-SVC-xxx → KUBE-SEP-yyy`) and `ip:port` match the rules the agent wrote on this node for this seed. A variant for L2: the same question in nftables mode (`nft list table ip kube-proxy`).

**Drill "The pod couldn't reach the service"** (5 cause variants by seed, one per attempt): a typo in the service name (NXDOMAIN); the Service selector does not match the labels (an empty EndpointSlice); the pod is not ready (readiness, an endpoint with `ready: false`); the application listens on a different port (`targetPort`); a default-deny NetworkPolicy without an allowing rule. Check: `curl` from `client` to the service returns 200; `forbid`: deleting the NetworkPolicy entirely (an allowing one must be added). The debrief shows the learner's path through the five steps of the K38 method and marks the skipped ones.

### 13. MAJOR — The multi-node browser and hybrid Kubernetes (R11) are not reflected in the learner model and the levels

**Where:** 2.3 (data format), 7 (anatomy), 11.

**What is wrong.** If the lessons on Kubernetes networking, node failure and WireGuard between nodes require 3–4 v86 machines, then some tasks cannot be done on a phone or a weak laptop. Right now the model has no device, and the task has no requirement for the number of nodes. There is also a discrepancy with `02` §1.3: a tier B machine is Debian with systemd at 256 MB (192 MB with two machines), while R11 talks about 64–128 MB per node; 3–4 such Debian + systemd + crun + agent machines are unlikely to fit in 128 MB each — a lightweight node image is needed, and that is a decision for `02`/`09`, but `01` must know that the task set depends on the device.

**Fix.** Add to 2.3 `"device": { "max_nodes": 3, "mobile": false, "ram_gb": 16 }` (determined by a trial run on first entry into the Kubernetes block). Add `requires_nodes: 3` to the lesson and task format. Rule:

> A task with `requires_nodes > device.max_nodes` is replaced with its variant in the pure kube-lite simulator (the same scenario, the same state checks, without real processes) and marked "simulator" in the record. The stage 1 exam contains at most one task with `requires_nodes > 1`, and it always has a simulator variant. On a phone, only review and explanations are available.

Separately, a new concept K53 `k8s.hybrid-node`: "a real node in the browser: a kubelet agent runs the pod via crun, `kubectl exec` enters a real container" (requires K08, D10). It is introduced by the first lesson where the hybrid appears, so that the learner understands where the simulator ends and real processes begin. It is important to say directly: k3s and a real kubelet inside v86 are impossible (32-bit emulation, memory), the agent is ours.

### 14. MAJOR — Kubernetes in three stages (R12): no concepts for stages 2 and 3, cost and cleanup

**Where:** K31, K32, section 11.2, section 13.

**Fix — graph rows:**

| ID | Concept | Requires |
|---|---|---|
| K48 `k8s.single-node` | A real single-node cluster: k3s, kind or minikube; how each differs | K27, K33 |
| K49 `k8s.real-registry` | A real registry, `imagePullSecrets` | K48, D18 |
| K32 `k8s.kubeadm` | kubeadm: `init`, `join`, static pods in `/etc/kubernetes/manifests`, PKI in `/etc/kubernetes/pki` | K26, K27, I05, I10, net.cloud-vm |
| K50 `k8s.cni-install` | Installing a CNI (Cilium) after `kubeadm init`; nodes are NotReady until the CNI is in place | K32, K26 |
| K51 `k8s.certs` | Certificates: `kubeadm certs check-expiration`, renewal | K32 |
| K54 `k8s.upgrade` | Version upgrade: `kubeadm upgrade plan/apply`, one minor version at a time, control plane first, then nodes (`drain`) | K32, K45 (drain) |
| K55 `k8s.etcd-backup` | etcd backup: `etcdctl snapshot save`, restore with `etcdutl snapshot restore` (since etcd 3.5, restoring via `etcdctl` is deprecated) | K06, K32 |
| K56 `k8s.node-break-fix` | Break and fix a node: kubelet stopped, certificate expired, CNI did not come up | K32, K50 |
| K57 `cloud.cost-cleanup` | VM cost and mandatory cleanup | net.cloud-vm, I05 |

In 11.2 for stage 3:

> The "Cleanup" step is the mandatory last step of stage 3 and of the final exam; without it the stage is not credited. Check: the learner runs `terraform destroy` and pastes the output (`Destroy complete! Resources: N destroyed.`, where N matches the number of resources from `apply`), and if the machines were in a cloud, also the empty list of the provider's VMs with the course label. From the moment of `apply`, the interface shows a counter "machines have been running N hours ≈ X ₽/$", and once a day a reminder until cleanup is confirmed. Machine requirements follow the kubeadm documentation: at least 2 vCPU and 2 GB of memory per control plane node; prices and providers belong to `05` §10.2, `01` does not duplicate them.

Add stage markup (`stage: 1|2|3`) to the K table and a rule: stage 1 introduces K01–K47 and K52–K53, stage 2 K48–K49, stage 3 K32, K50–K57.

### 15. MAJOR — The Kubernetes graph is poorer than the `05` program and interview questions

**Where:** the "Kubernetes (K)" table.

Besides networking (finding 12) and stages (finding 14), the graph lacks concepts that `05` introduces and that a junior gets asked about in interviews: HPA and metrics-server, taints/tolerations and affinity, cordon/drain and PodDisruptionBudget, Kustomize, headless Service, static pods. Rows: K42 `k8s.hpa` (K22, K12), K43 `k8s.taints-affinity` (K07), K44 `k8s.headless` (K14, K23), K45 `k8s.drain-pdb` (K43, K12), K46 `k8s.kustomize` (K04), K47 `k8s.static-pods` (K08). The number of concepts in 6.2 (195) and the paragraph "195 concepts in 11 groups" need to be recounted after all the additions: by my edits it comes to about 255.

### 16. MAJOR — The placement checks are duplicated with different criteria in each block

**Where:** 4.3; comparison with `02` §2.2, `03` §4.2, `04` §9, `05` §2, `07` §2.

| Block | `01` | Block document |
|---|---|---|
| Linux L1 | 8 tasks, 7 of 8, ~20 min | 8 questions + a problem, 6 of 8 and the problem, 5–8 min, the check can be skipped |
| Networks L1 | 7 tasks, 6 of 7 | 8 tasks, 7 of 8, tasks 6–8 mandatory, 10–15 min |
| Docker L1 | 7 tasks, 6 of 7, key tasks 1 and 3 | 6 tasks, 5 of 6, both practical ones mandatory |
| Kubernetes L1 | 6, 5 of 6, key task 1 | 6, 5 of 6, both practical ones mandatory (but the tasks have different content) |
| Methodology L1 | 6 tasks (its own set) | P-I1…P-I6 (a different set) |

My `10` §3.5 belongs here too: it names `01` 4.3 as the source and at the same time requires "at least two practical key tasks" — `01` has three key tasks in Linux L1 and one in Methodology L1. Decision:

> Section 4.1 is a single **principle** (confidence, 80%, key tasks, retry after 72 hours, partial result, tone). The concrete check tasks belong to the block documents; section 4.3 becomes a sample for blocks without their own document (career) and is not used in the build. Numbers mandatory for all blocks: 5–10 tasks; an 80% threshold (rounded up); at least two practical tasks, and they are `key: true`; duration 15–35 minutes; "skip the check" is not allowed — without the check the route is L0. Block documents bring their checks in line with these numbers.

This removes the 6-of-8 versus 7-of-8 discrepancies and the "can be skipped" in `02`.

### 17. MAJOR — The tutor: there is no enforcement mode and no exam-with-documentation mode

**Where:** 14.1, 14.2, 14.4.

Add rows to 14.1:

| Where the learner is | What the tutor can do | What it cannot do |
|---|---|---|
| A `doc_ladder: D4` task | Only the questions "where did you look?", the source type, the page section, a word to search for (section 9a) | Name the flag or subcommand, write the command |
| Exam (D5) | Nothing; the built-in viewer of official documentation is open | Everything |

In 14.4, add to the context `"doc_ladder": {"step": "D4", "sources_opened": ["man:ss(8)"], "untaught": true}`, and to the rules in 14.3, "at step D4 the first sentence of any answer is a question about where the learner has already looked". Quality check (`09` §4.6): in the set of test dialogs at D4, the share of answers where the model named a flag from `untaught` must be 0; such an answer is intercepted by the product before display by comparing the text against `untaught` (flags are strings, the check is cheap).

### 18. MAJOR — The time budget does not withstand the new requirements and contradicts itself

**Where:** section 13.

**What is wrong.** The rationale "40–45 minutes per concept at L0" gives 195 × 0.7 h ≈ 137 hours, while the table gives 421 hours. So the numbers were not derived from the graph. After R6–R12 the following is added: the isolation module in Linux, the map of the internet and the protocol catalog, container anatomy and boundaries, Kubernetes networking, one's own controller, Kubernetes stages 2 and 3, the documentation ladder (D4 tasks are slower than ordinary ones).

**Fix.** Remove "40–45 minutes per concept" and write the formula: `block hours = Σ(concepts × norm per level) + explanations × 0.3 h + exams + 15% review`, the norm being 1.5 h per concept at L0 with practice, 0.9 at L1, 0.4 at L2. My estimate of the new table (to be corrected after the formula):

| Block | L0, h | L1, h | L2, h |
|---|---|---|---|
| Linux (incl. isolation) | 82 | 48 | 20 |
| Git and YAML | 14 | 8 | 3 |
| Networks (incl. the map and the catalog) | 55 | 34 | 16 |
| Containers | 50 | 32 | 16 |
| CI/CD | 25 | 16 | 8 |
| Kubernetes, stages 1–2 (incl. networking) | 85 | 60 | 38 |
| Kubernetes, stage 3 | 22 | 18 | 14 |

The total for L0 will grow to about 480 hours (about 11–12 months at 10 h/week). This must be said honestly on the first screen of the course rather than discovered in the seventh month.

---

## Minor

### 19. MINOR — The `rm -rf /` demonstration is factually wrong and violates the concept order

**Where:** 12.2, "The terminal cannot be broken".

GNU coreutils (tier B is Debian, `02` §1.3) answers `rm -rf /` with `rm: it is dangerous to operate recursively on '/'` and deletes nothing without `--no-preserve-root`; as an ordinary user there is also `Permission denied`. The "everything disappeared" demonstration will not work, and the learner will remember a command they will later type with `sudo` and the flag. Besides, this is "the first Linux screen" — before `rm` (L06), the root `/` (L03) and root (L12). Replacement: on the first screen, "delete all your files": `rm -rf ~/*` in the sandbox with a file explorer next to it, then "restore". Move the discussion of `rm -rf /` and `--preserve-root` to lesson L12 (root and sudo) as an error walkthrough.

### 20. MINOR — A secret that got into a commit is "removed" incorrectly

**Where:** 4.3, CI/CD, the L2 check, task 2.

The check "the password is not in the working tree or in the last commit" credits a solution in which the password remains in the history. In an interview, the correct answer is "the secret is compromised: revoke and replace it, then remove it from the code; rewriting history is a separate team decision". New check: (1) the password is not in the working tree; (2) the job gets it from a CI variable with the masked flag; (3) the variable's value differs from the committed one (the secret was replaced); (4) a `choice` question "what else needs to be done" with the correct answer "change the password in the database". The distractor "removing it from the last commit is enough" refers to the misconception `cicd.secret-removed-from-head`.

### 21. MINOR — The kube-proxy and Endpoints rubric is outdated

**Where:** 4.3, Kubernetes L1 task 1 and L2 task 6.

"The Service has three endpoints" — check via EndpointSlice (`kubectl get endpointslices -l kubernetes.io/service-name=…`). Replace rubric L2-6 "iptables or IPVS" with "iptables or nftables rules on every node (IPVS is a mode being phased out; in Cilium, eBPF instead of kube-proxy)", which matches `05` decision 5. Give task L2-1 "Ingress does not serve the site" in two variants — Ingress and HTTPRoute.

### 22. MINOR — The `unshare` task in the Docker L2 check cannot be checked as written

**Where:** 4.3, Docker L2, task 5.

`echo $$` shows 1 only with `--fork`; `ps` inside shows the host's processes without `--mount-proc`; without root, `--user --map-root-user` is needed. The check "output of `echo $$` or `ps`" will credit a wrong solution. New check: the tier B agent finds the learner's shell process and compares `readlink /proc/<pid>/ns/pid` with the host's `/proc/1/ns/pid` (they must differ) and `NSpid` in `/proc/<pid>/status` (the last value is 1). After R6 the task moves to the Linux L2 check.

### 23. MINOR — The DORA metrics in the Methodology L2 check are outdated

**Where:** 4.3, Methodology L2, task 1.

DORA renamed "time to restore" to failed deployment recovery time and added a fifth metric, deployment rework rate (dora.dev/guides/dora-metrics/history). The task "mark four of eight" must be rebuilt: "mark the five DORA metrics among nine", wording per dora.dev; keep the distractors (test coverage, story points, number of commits, uptime). Fix the same in rubric M13.

### 24. MINOR — Three definitions of `mastered`

**Where:** 2.2, 9, 10; `10` §3.4.

2.2: "the lesson's final check and one delayed review (≥ 3 days) without errors"; section 9: "requires S4 and a delayed review"; `10`: "in a different format". Consolidate in 2.2: "`mastered` — the exit ticket is passed, step S4 is reached, and a delayed (≥ 3 days) review is passed without errors in a format different from the format of the last correct answer". In 2.2, replace "without level 4–5 hints" with "without H4–H5 hints", so as not to confuse them with steps S4–S5.

### 25. MINOR — The wording of the time criterion in 4.1 is unclear

"If the learner fit within the norm with a margin of less than three times" reads two ways. Replacement: "If the total time is no more than three norms, the level is credited; if more, it is credited with a 'fluency' mark, and speed trainers are put into review".

### 26. MINOR — The namespaces in D03 are not listed completely

`pid, mnt, uts, user, net` — ipc, cgroup, time (since kernel 5.6) are missing. After finding 2, the full list lives in L35.

### 27. MINOR — `ss` and the process name in the Networks L1 check

Task 2 "which process listens on 8080": `ss -ltnp` without root does not show other users' processes. In `setup`, either run the listener as `student`, or explicitly teach `sudo ss -ltnp` in the debrief; otherwise a learner who did everything right sees an empty column.

### 28. MINOR — The check code in 11.2 "tied to the cluster UID" diverges from `05` and `10`

`05` (decision 7) and `10` §6.4 use a one-time code that the learner puts into a ConfigMap and that the script reads back. Write the same in 11.2: "a one-time code from the trainer in a ConfigMap + the UID of the `kube-system` namespace in the script's report".

### 29. MINOR — Sankofa lenses are not used, although R5 names them

Lenses (`08` §3.11) map naturally onto levels: one chapter, and the "beginner", "intermediate", "experienced" lenses change the depth of the expanded paragraphs and the examples from the previous profession. Add one line to section 7: "A module's chapter is shown through the level's lens; the learner can switch the lens without changing their level in the model".

---

## Pedagogy of the three levels — summary

- **Beginner.** The document's strength is Orientation, worked examples, the first 10 minutes of success. What is missing is a promise that they will not start reading documentation from zero — right now they are not led into it at all. The ladder from finding 3 gives this promise: D1 from the first module, D4 only from the middle of Linux.
- **Intermediate.** What hinders them most is the duplication of checks (finding 16): different documents promise different thresholds. Starting at D2 is right — they have already seen `--help` but cannot read a page.
- **Experienced.** "Task first" and D3 from the first module are a good pair. But for a programmer, the main thing the course gives is the operational model (isolation, networking, the reconciliation loop), not commands. Explanations with parameters and "break it" (finding 7) are what they will stay for; without them they get bored by the second block. Exams with one out-of-course task (D5) are the best preparation for them for the CKA and for the first month at work.

## What I will fix in my own `10` after this review

To avoid having two rules: in §3.5 I will refer to the single placement-check principle from finding 16; in §6.1 to "one block exam, different roads" and the three Kubernetes stages (finding 4); I will add the fields `doc_viewer: {allowed: […]}` and `untaught_task` (weight ≤ 25%, not `critical`) to the exam specification; the fields `doc_ladder`, `untaught`, `doc_ref` to the task bank; and `cicd.secret-removed-from-head` to the misconception catalog.
