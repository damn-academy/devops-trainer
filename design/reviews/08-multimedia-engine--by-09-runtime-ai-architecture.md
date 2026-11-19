# Review of 08 "Interactive textbook engine" (reviewer: role 09, runtime environments and AI architecture)

Reviewer: the author of `09-runtime-ai-architecture.md`. Date: 18.11.2026. Version under review: 08, version 1 of 18.11.2026. Cross-checked against 01–07, 09, 10 and the owner's requirements R1–R12.

## Verdict

As an engine, the document is strong. The Sankofa analysis is accurate, and it has lazy chunks, a split "terminal + diagram" screen, the "state, not command text" rule, WCAG 2.2 accessibility and budgets in CI. The `SimEvent` bus and the `WidgetInstance` interface are already in my 09 (§1.3, §1.5), and I am not proposing to change them. Still, in its current form the document cannot be accepted as the foundation for content. There are five reasons, each of them blocking:

1. The visual language is built on ink drawings, metaphors and characters. R4 and R5 explicitly forbid this.
2. The stepper plays back a recorded event tape and cannot recompute the process when the learner changes a parameter. That is exactly the core mechanic of R4.
3. The lesson format (`glossary.yaml`, string ids, `scenes`, `beginner/intermediate/experienced`, `requires`) diverges from the concept graph in 01 (`concepts.yaml`, `L17`/`D03`, `screens`, `L0/L1/L2`, `uses`, the "one concept per screen" rule).
4. Flagship 6.1 introduces namespaces, cgroups, capabilities and chroot in the Docker block. Under R6 all of this must come earlier, in the Linux block.
5. All four flagships duplicate interactives from 03, 04 and 05 and contradict them in several places.

On top of that, the document has no documentation ladder (R2), no catalog of explanations for each block (R3), and no widgets for a multi-node network (R11) or for the real-environment stage (R12). Below, for each point, there is ready-to-paste text.

Total: 6 BLOCKING, 14 MAJOR, 8 MINOR.

---

## Findings

### 1. BLOCKING — Ink, metaphors and characters contradict R4/R5

**Where:** §1 "An explanation that draws by hand"; §2, the `ink.ts` and `decay.ts` rows; §5.1 "Two hands"; §5.3 item 8; scenes 6.1/0 "The room", 6.2/0 "A stack of tracing sheets", 6.3/2 ("Ink in the style of How DNS works", "a line of dialogue on an arrow"), 6.4/1 "The thermostat".

**What is wrong.** R4 requires: "NO cartoons, no characters, no plot, no decoration", and animation is allowed only to show a process. R5 requires clean engineering graphics in the spirit of Ciechanowski/Comeau, "not Sankofa's ink drawings". The document, however, declares ink the second official drawing style and opens every topic with a metaphor. The resolver's lines ("I don't know, ask the .com servers") are a character. Rule 01 R9 ("ink only in hooks") must also yield to R4. Since 08 sets the visual rules for all documents, the same ink will have to be removed in 04 §4.2 (houses and rooms), 05 §6.1 (ink blocks) and 07 §4.1 (E1 "The wall", E2 "The coffee shop", E8 with the characters Vika and Elena).

**Fix.** Replace the `ink.ts` row in the §2 table with: "`ink.ts` — not used. From the mechanism we take only `data-fade` (a caption fading in) and `data-develop` as a smooth transition of the diagram state, without hand drawing". Delete the "An explanation that draws by hand" paragraph in §1. Replace §5.1 with this text:

> **5.1. One style — the blueprint.** Everything on screen corresponds to a real mechanism: blocks, arrows, labels on lines, values in a monospace font. There are no metaphors, characters, plot or decorative illustrations, neither in hooks nor in introductions. A lesson hook is a work situation in text (a ticket, a message from the on-call engineer, an error line, 01 §7, step 1), not a picture. Only three kinds of animation are allowed: (1) **movement** — a packet, request or object moves along an edge; (2) **appearance and disappearance** — a layer, a namespace frame, a pod, an iptables rule; (3) **change of magnitude** — a counter, a gauge, a queue length. Transition duration is 180–320 ms, `ease-out`. Parallax, a "boiling" line, jitter, shadows and gradients are not used. One diagram — one idea: if there are two processes on screen, that is two screens.

Delete item 8 of §5.3 (neural-network art). Replace scenes 6.x/0 as follows: 6.1/0 becomes a text hook "Two applications on one server require different versions of libssl" plus a two-block diagram; 6.2/0 — go straight to 6.2/1; 6.3/2 — a sequence diagram (the `seq` widget, finding 21) with labels on the arrows: `QNAME shop.example.com A?` → `REFERRAL NS a.gtld-servers.net`; 6.4/1 — go straight to the blueprint of the reconciliation loop (finding 19, screen R10-1).

### 2. BLOCKING — The stepper does not recompute the process when a parameter changes (R4)

**Where:** §3.1, §3.5, §7.6.

**What is wrong.** Stepper steps come either from a YAML scenario or from a recording of a live session, i.e. they are a fold over a **fixed** event tape. R4 requires that changing a parameter (replicas, memory limit, TTL, TCP window) **immediately** recomputes the process and explains next to it what changed. A recorded tape cannot do that: with TTL=0, new queries to the root will not appear in it. The "break it" toggle in §3.5 "restarts the current scenario step", but a scenario that came from a recording stays the same after the breakage.

**Fix.** Add a new primitive to §3 and make it the basis of `stepper`:

```ts
// web/src/engine/process-model.ts
export interface ParamSpec {
  id: string;                         // 'ttl', 'replicas', 'memory.max', 'tcp.window'
  label: Bi;
  kind: 'range' | 'toggle' | 'choice';
  min?: number; max?: number; step?: number; unit?: string;   // '512Ki', 's'
  options?: { id: string; label: Bi }[];
  default: number | boolean | string;
}
export interface Step {
  id: string; label: Bi;               // short label on the timeline: 'SYN'
  at: number;                          // model time, ms
  events: SimEvent[];                  // what changes on the diagram (the same bus)
  caption: Bi;                         // one sentence: "what happened"
  focus: string[];                     // ids of nodes and edges to highlight
}
export interface ProcessModel<P = Record<string, unknown>> {
  id: string;
  params: ParamSpec[];
  breaks: { id: string; label: Bi; remove: string[] }[];    // "break it": which nodes/edges are switched off
  run(p: P, broken: string[]): Step[];                     // pure function, deterministic, Vitest
  explainDelta(prev: Step[], next: Step[], changed: string): Bi;  // "TTL 0 → the answer is not cached: steps 3–5 repeat on every query"
}
```

Rules for §3.1:

1. The timeline is `run(params, broken)`. When a parameter changes, the model is recomputed in ≤ 16 ms. The stepper stays on the step with the same `id`, and if that step no longer exists, on the nearest one by `at`.
2. To the right of the diagram is a "What changed" panel with the `explainDelta` text and the step diff (steps that appeared or disappeared, plus the time difference: "Connect: 1 RTT → 0, connection reused").
3. "Break it" is the same kind of parameter: `broken` removes nodes and edges, the model builds the process without them, and the break is drawn in place with a label.
4. The recorded tape of a live session remains a separate source (`source: recording`), but it has no parameters. In that mode the sliders are inactive and labeled: "this is a recording of your session; to change parameters, open the model".
5. The model must match the simulator. CI runs `run(default)` and the simulator recording on the same scenario and compares the event sequences. This extends the §7.6 rule and the "golden recordings" from 09 §1.3.

In §7.6, add a `model: models/dns-resolve.ts` field as an alternative to `steps:`. In the lesson YAML, parameters are listed, not programmed:

```yaml
- widget: stepper
  model: dns-resolve
  params: { ttl: { default: 300, min: 0, max: 86400 }, cache: { default: true } }
  breaks: [authoritative-down, wrong-a-record]
```

### 3. BLOCKING — The lesson format is incompatible with the 01 concept graph

**Where:** §4, §7.1–7.3.

**What is wrong.**

| What | 01 | 08 |
|---|---|---|
| Graph file | `content/concepts.yaml` | `content/glossary.yaml` |
| Identifier | `L17`, `D03`, `K09` | `process`, `pid-namespace` |
| Screen prerequisites | `uses` | `requires` (at lesson level) |
| Word forms | `forms` (regular expressions) | `stems` |
| Lesson unit | `screens`, `kind: diagram/example/predict/sandbox/theory/task/exit` | `scenes`, `kind: story/mechanism/lab/check` |
| Levels | `L0/L1/L2` | `beginner/intermediate/experienced` |
| Limit | `introduces` ≤ 1 per screen, ≤ 4 per lesson (01 §8 R1/R2) | several terms per scene, about 20 for lesson 6.1 |
| Running ahead | `forward: [K01]`, no more than one per lesson | `allow_early` with no limit |

Blocks 04 and 05 refer to their own lesson formats (04 §11.1, 05 §13), and 06 to its own (`kind: explainer.shelves`). The result is four schemas for one validator.

**Fix.** Write in §7: "The single lesson format is 01 §7. 08 extends it rather than replacing it". Mapping table to paste:

| 08 had | Becomes |
|---|---|
| `glossary.yaml`, `stems` | `concepts.yaml`, `forms`; the `card` and `short` fields move to `concepts.yaml` |
| `scenes[]` | `screens[]`; `kind` is merged: `diagram`, `example`, `predict`, `sandbox`, `theory`, `task`, `exit` from 01 plus `mechanism` (stepper or model), `lab` (split view with goals), `breakit` |
| `level: [beginner]` | `levels: [L0]` (`L0` beginner, `L1` intermediate, `L2` experienced — as in 01 and 10) |
| lesson `requires` | screen `uses`; the lesson does not declare prerequisites, the build derives them |
| `introduces: [a, b, c]` | one concept per screen; the "The other six" scene from 6.1 becomes six screens in one stepper, where each step introduces one concept (01 R1 is counted per stepper step, not per widget) |
| `allow_early` | `forward` with a "for now it is enough to know…" card, no more than one per lesson |
| `checks` / `goals` | goals per 09 §2.4 (`needs`, `when`, `envs`, `keep`, `fail`) |

Reword rule 4 of §7.3 ("for experienced, collapsed terms count as introduced") as in 01 §6.1: a term counts as introduced if the learner has completed the screen **or** an entry check that covers this term. "An experienced learner knows it by definition" is not acceptable: an experienced developer may not know cgroups.

### 4. BLOCKING — Kernel isolation is introduced in Docker, not in Linux (R6)

**Where:** all of §6.1; the line "Requires terms introduced in the Linux block: process, PID… /proc".

**What is wrong.** Under R6, namespaces (`unshare`, `nsenter`, `/proc/<pid>/ns`, `lsns`), cgroups v2 (`memory.max`, `cpu.max`, `pids.max`, OOM), capabilities (`capsh`, `getcap`/`setcap`), mount/chroot/overlayfs, seccomp, and process versus thread (`/proc/<pid>/task`, `ps -eLf`) are introduced in **Linux**, and for all levels. 6.1 introduces them in the Docker block, and scenes 2–7 are in fact a Linux lesson. In 01, D03 is in the Docker group but requires N21; in 02 §5.1, namespace and cgroup appear only in L16 and only for intermediate/experienced learners. So a beginner arrives at Docker without these concepts, and R6 is violated in three documents at once. 08 has to resolve this: it owns the flagship, and 01 and 02 will follow it.

**Fix.** Split 6.1 into two explanations.

**6.1a (Linux block, new module L17 "How the kernel isolates and limits", for all levels; an experienced learner starts from screen 2 after the entry check).** Requires L17 (process), L26 (`/proc`), L27 (kernel, system call), L25 (mounting), L12 (root). Environment: tier B `lab-alpine`, because the topic needs a real kernel (09 §1.4). Storyboard, one concept per screen:

| # | Screen | What is on the blueprint | Controls and "break it" | Terminal (v86) | Check | Introduces |
|---|---|---|---|---|---|---|
| 1 | Process and thread | A "process 4127" block with shared memory; inside, three thread lanes with TIDs | "Threads" slider from 1 to 8: the number of lines in `/proc/4127/task` grows, the PID does not change | `ps -eLf \| head`, `ls /proc/$(pidof busybox-httpd)/task` | `predict`: how many lines `ps -eLf` will show for a process with 4 threads | thread, TID |
| 2 | fork and exec | Timeline: `bash` → `fork()` → a copy with a new PID → `execve("/bin/ls")` → the process image is replaced, same PID | "Without exec" toggle: the bash copy remains; "without fork" toggle: the shell disappears (`exec ls`) | `strace -f -e trace=clone,execve sh -c ls` | `order`: clone → execve → exit → wait | fork, exec |
| 3 | PID namespace | Above the kernel line, a block of host processes; `unshare` draws a frame around a new bash; the bash has two numbers on one label: `1 \| 4127` | Viewpoint switch "from inside / from the host"; "break it: without `--fork`" — `unshare: fork: Cannot allocate memory` (the first child becomes PID 1 and exits immediately) | `unshare --pid --fork --mount-proc sh`, `ps`, then from the host `grep NSpid /proc/<pid>/status` | `predict` based on `ps` inside | namespace, PID namespace |
| 4 | Other kinds | A 7-step stepper, each step adds a frame of its kind: mnt, uts, net, ipc, user, cgroup, time | One toggle per kind, each changes one visible thing | `ls -l /proc/$$/ns` (10 links, finding 14), `lsns -p $$` | `match`: kind ↔ what it isolates | one kind per step |
| 5 | Entering someone else's namespace | An `nsenter` arrow from the host shell into the frame | Choice of flags `-p -m -n -u`: the frames entered are highlighted | `nsenter -t <pid> -a sh`, `nsenter -t <pid> -n ip a` | `task`: run `hostname` in the uts namespace of process X | nsenter |
| 6 | cgroup v2: tree and limit | The `/sys/fs/cgroup` tree; the `demo` group has a `memory.current` gauge with a `memory.max` mark | `memory.max` slider from 8 to 128 MB, a "how much the process asks for" slider; recomputation: OOM or not | `mkdir`, `echo +memory +pids +cpu > /sys/fs/cgroup/cgroup.subtree_control`, `echo 32M > demo/memory.max`, `echo 0 > demo/memory.swap.max`, `echo $$ > demo/cgroup.procs` | `predict`: will the process be killed at 40 MB | cgroup, controller |
| 7 | OOM kill (drill) | The gauge reaches the mark; the process goes dark with an "OOM" tag; the `memory.events oom_kill` counter grows | "Swap allowed" toggle: the process is not killed but slowly goes to swap (if the image has a swap file) | `head -c 64m /dev/zero \| tail`, `cat demo/memory.events`, `dmesg \| tail -3` | Goal: `cgroups[path=/demo].memory.events.oom_kill>=1` | OOM killer |
| 8 | cpu.max and pids.max | Two gauges: CPU share per 100 ms window; number of processes | Quota slider 10–200%; a "fork bomb" hits `pids.max` | `echo "50000 100000" > cpu.max`, `echo 20 > pids.max`, `yes >/dev/null &` × 3, `top` | `fill`: limit the group to two cores → `cpu.max = "200000 100000"` | CPU limit, process limit |
| 9 | Capabilities | A root process has a set of flags (`CAP_NET_BIND_SERVICE`, `CAP_SYS_ADMIN`, `CAP_CHOWN`…), some of them dropped | Drop or restore a capability: which actions are allowed is recomputed | `capsh --print`, `capsh --drop=cap_net_raw -- -c 'ping -c1 127.0.0.1'`, `setcap cap_net_bind_service=+ep ./srv`, `getcap ./srv` | `task`: start a server on port 80 without root | capability |
| 10 | Mount, chroot, overlay | The process's file system tree; `chroot` changes the root only for this process; three overlay sheets: lower, upper, merged | Writing to merged: the file is copied to upper (copy-up); deletion: whiteout | `mount -t overlay overlay -o lowerdir=l,upperdir=u,workdir=w m`, `chroot rootfs /bin/sh` | `predict`: where the modified file will end up | chroot, overlayfs |
| 11 | Seccomp (the idea) | A filter sits on the "system call" arrow; a forbidden call is bounced with `EPERM` | Filter toggle on `mkdir` | `grep Seccomp /proc/$$/status` (look only) | `choice` | seccomp |
| 12 | Putting it together | All frames, gauges and sheets on one blueprint, caption: "this is what a container will be made of" (forward D06) | — | — | `explain` against a rubric | — |

**6.1b (Docker block) — "Anatomy of a container and the six boundaries"** (R7a/b): storyboard in finding 7. Remove scenes 6.1/5–9 from the container block lesson: in Docker they are repeated as a single "recall" screen with links to the L-module cards.

### 5. BLOCKING — The flagships duplicate the interactives of 03, 04, 05 and contradict them

**Where:** all of §6.

| 08 flagship | Already exists | Contradictions |
|---|---|---|
| 6.1 "Inside a container" | 04 §4 "What is inside a container", 04 §6 "A container in bash" | 08: simulator by default, v86 "for those who want it" (§3.4); 04 and 09 §1.4: v86 by default, recording as the fallback mode. 08: seven namespace kinds; 04: counts `time` |
| 6.2 "How an image is packaged" | 04 §5 | `alpine:3.20` versus `alpine:3.22` (04 §5.2) |
| 6.3 "URL" | 03 §7.1, §7.2 | 08 makes the URL explanation **introductory** (it introduces DNS, port, TCP, TLS, OSI); in 01 this is N16, a synthesis that requires N08, N11 and N15; in 03 §7.1 the stages refer to modules already completed. 03 has CDN, the waterfall and HAR, 08 does not; 08 has lenses, 03 has its own "Lenses" panel |
| 6.4 "Kubernetes from blocks" | 05 §6.1, §6.2 | 08: Ingress in the final check; 05 §0 item 4: Gateway API is primary, Ingress is legacy. 08 introduces etcd by picking it from a palette; 05 keeps blocks locked until the term is introduced |

**Fix.** Insert at the beginning of §6:

> **Who owns what.** Explanation storyboards belong to the block documents: 02 (Linux), 03 (networks), 04 (containers), 05 (Kubernetes), 06 (Git, CI/CD, IaC, monitoring), 07 (methodology). 08 owns the engine (the §3 primitives), the visual language (§5), the format (§7) and the **explanation catalog** (§6.0). The storyboards below are the reference for form. If a block's storyboard differs from the reference in substance, the block document wins and 08 corrects the reference. Divergences resolved by this version: 6.1 → 02 L17 + 04 D2/D10 (v86 by default); 6.3 → 03 §7.1 (URL is a synthesis after N15; the lenses from 08 move to stage 11 of the 03 table); 6.4 → 05 §6.1 (Gateway API primary, Ingress in a footnote; blocks unlock as terms are introduced).

### 6. BLOCKING — There is no catalog of explanations for each block (R3)

**Where:** §6 (four flagships), §11.

**Fix.** A new section §6.0 "Catalog of process explanations". Each row is one `ProcessModel` (finding 2) and at least one "break it" screen. "Exists" means the storyboard is already in the block document; "none" means it has to be written, with a draft in this review.

| Block | Explanation | Parameters (sliders and toggles) | "Break it" | Check | Storyboard |
|---|---|---|---|---|---|
| Methodology | A task from idea to prod | work and wait time per stage; batch size; automated tests on/off | remove review; remove the automated build | `predict` of flow efficiency | exists: 07 E5 |
| Methodology | Incident: alert → postmortem | time to detection; on-call engineer present/absent; runbook present/absent | no alert (empty lens) | `order` of the chronology | 07 E11 + draft R3-M2 below |
| Methodology | Flow bottleneck | WIP limit; station capacity | — | `hotspot` on the bottleneck | exists: 07 E4, S2 |
| Linux | Machine boot | — (steps from `journalctl -b`) | broken unit in `multi-user.target` | `order` | exists: 02 §6.7 |
| Linux | fork/exec and PATH lookup | contents of `PATH`; directory order | remove a directory from PATH → `command not found` | `predict` based on `which` | 6.1a screen 2 + draft R3-L2 |
| Linux | Pipeline | speed, buffer size | `head` closes the pipe → SIGPIPE | `predict` | exists: 02 §6.5 |
| Linux | systemd restarts a crashed service | `Restart=` (no/on-failure/always); `RestartSec`; `StartLimitBurst` | the process exits with code 1 | goal on `units[x].restarts>=2` | draft R3-L4 |
| Linux | Kernel isolation and limits | see 6.1a | see 6.1a | see 6.1a | 6.1a |
| Networks | Zoomable map of the internet | zoom level; CDN cache on/off | cable cut, BGP prefix withdrawal | `hotspot` | draft R8-1 (finding 8) |
| Networks | OSI / TCP/IP envelopes | 7/4 model; MTU | DF=1 + ICMP filter | `order` of nesting | exists: 03 §7.2 |
| Networks | Entering a URL | browser cache, DNS, keep-alive, HSTS | 9 breakages | `order` | exists: 03 §7.1 |
| Networks | DNS resolution | TTL; resolver cache; `+trace` | authoritative server down; NXDOMAIN | `order` | 6.3/2 after the edits (finding 15) |
| Networks | TCP + TLS 1.3 | RTT; TCP window; resumption on/off | port closed / DROP / certificate expired | `predict` refused or timeout | 6.3/6–7 after the edits |
| Networks | A packet through NAT and a router | routing table; SNAT rule | no default route | `hotspot` | exists: 03 §7.2 screens 3–4 |
| Networks | Where a 504 comes from | `proxy_read_timeout`; DB response time; pool size | DB responds in 40 s; application crashed (502) | debugging `task` | 6.3/9 → into 03 stage 11 |
| Containers | The `docker run` → process chain | `--rm`, `-d`; runtime runc/crun | remove the shim: restarting containerd kills the container | `order` | draft R7-a (finding 7) |
| Containers | `docker build` layer by layer with cache | instruction order; file edit | `COPY . .` above `RUN npm ci` | `order` | exists: 6.2/6 → 04 §5 |
| Containers | `docker pull` by manifest | platform amd64/arm64; layer X already present | tag re-pointed | `predict` | 6.2/4, 6.2/8 → 04 §5 |
| Containers | Six boundaries | one boundary per screen | one breakage per boundary | drills | draft R7-b |
| Containers | Hardware → VM → containers → nesting | number of applications; kernel vulnerability | — | `explain` | draft R7-c |
| Kubernetes | Reconciliation loop | replicas; image; controller pause | delete a pod; kill a node | goals | 05 §6.2 + draft R10 (finding 19) |
| Kubernetes | `kubectl apply` through all components | — | remove a component | `order` | exists: 05 §6.1 screen 4 |
| Kubernetes | Pod scheduling | requests; taints; number of nodes | all nodes busy → `FailedScheduling` | `predict` of the message | draft R3-K3 |
| Kubernetes | Rolling update | `maxSurge`, `maxUnavailable`; readiness on/off | the new image fails readiness | `predict` | draft R3-K4 |
| Kubernetes | Node failure | `node-monitor-grace-period`; `tolerationSeconds` | switch off a node | `order` of the timeline | draft R3-K5 |
| Kubernetes | A request through Gateway/Ingress → Service → pod | kube-proxy mode iptables/nftables/eBPF; `externalTrafficPolicy` | selector does not match; NetworkPolicy deny | R9 drill | 05 §6.4 + finding 20 |
| CI/CD | `git push` → deploy | runner cache; stages; manual gate | a test fails; a secret is not set | `order` | draft R3-C1 |
| IaC | `terraform plan/apply` and state | resource in code / in state / in the cloud (three columns) | manual edit in the cloud (drift); state lost | `predict` of the plan | 06 B2-I* + draft R3-I1 |
| IaC | Idempotent Ansible run | `changed_when`; module versus `shell` | `shell: echo >> file` on the second run | `idempotent` goal | 06 B1 + draft R3-I2 |
| Monitoring | scrape → storage → PromQL → alert → notification | `scrape_interval`; `for:`; `group_wait` | target down; an alert without `for` flaps | `predict` of time to notification | draft R3-O1 |

**Storyboard drafts** (screen — what is on the blueprint — controls — check):

**R3-M2. Incident.** (1) Timeline: change shipped at 14:02 → errors grow → alert at 14:09 → on-call acknowledges at 14:12 → rollback at 14:20 → recovery at 14:23; the TTD/TTA/TTR intervals are labeled on the line. An "alert threshold" slider moves 14:09, and TTD and the error budget are recomputed (reusing the 07 E6 model). (2) "No runbook" toggle: the "figuring out what to do" segment grows by 8 minutes. (3) Postmortem: the learner places facts on the timeline (`order`), then writes "what to change in the system, not in the people" (`explain`).

**R3-L2. fork/exec/PATH.** (1) The `ls -l` line is parsed by the shell (02 §6.1). (2) PATH lookup: the list of directories from left to right, a check "does the file exist and have the x bit" in each, the first match highlighted. Control: dragging to reorder directories (your own `~/bin/ls` above `/usr/bin`). (3) `fork` → `execve(found path)` → `wait` → exit code in `$?`. "Break it": remove `/usr/bin` from PATH → `sh: ls: not found`, while `/usr/bin/ls` by its full path works. Check: `predict` of the `which -a ls` output, then `type ls`.

**R3-L4. systemd restarts a service.** (1) The unit state machine (02 §6.7) with a `failed → activating` edge (labeled `Restart=on-failure`, `RestartSec=2s`). (2) A training service exits with code 1 every 3 s; the `NRestarts` counter grows; after `StartLimitBurst=5` within `StartLimitIntervalSec=10s` the state becomes `failed (start-limit-hit)`. Controls: `Restart`, `RestartSec`, `StartLimitBurst`, timeline recomputation. (3) Check on tier B: `units[demo.service].restarts>=2 && units[demo.service].active=active` after editing the unit via `systemctl edit`.

**R3-K3. Scheduling.** Three nodes with CPU and memory bars (`allocatable`), a pod with `requests`. Sliders: pod requests, number of replicas, taint on node 2. The model runs the filters (NodeResourcesFit, TaintToleration, NodeAffinity) and shows the scores. "Break it": requests larger than any node → the real event `0/3 nodes are available: 3 Insufficient cpu. preemption: 0/3 nodes are available: 3 No preemption victims found for incoming pod.` Check: `predict` of the event text.

**R3-K4. Rolling update.** Two lanes: the old ReplicaSet (v1) and the new one (v2), pods as squares. Sliders: `replicas` 1–10, `maxSurge` 0–100%, `maxUnavailable` 0–100%, readiness toggle. The model shows step by step how many pods of each version are ready, plus an "available / desired" counter. "Break it": v2 fails readiness → the rollout stops, after `progressDeadlineSeconds` `ProgressDeadlineExceeded` appears, v1 keeps serving; a `kubectl rollout undo` button. Constraint: `maxSurge=0` and `maxUnavailable=0` together is a real validation error. Check: `predict` of the number of pods at step 2 with surge 1 / unavailable 0.

**R3-K5. Node failure.** A timeline with the real default values: the kubelet stops renewing its Lease → after `node-monitor-grace-period` (50 s since v1.32) Ready=Unknown, taint `node.kubernetes.io/unreachable:NoExecute` → pods have `tolerationSeconds: 300` → eviction → the ReplicaSet creates replacements on other nodes. Speed-up ×60 (as in 05). Controls: grace period, tolerationSeconds in the pod template. Check: `order` and `predict` of "when the pod on node 2 gets a replacement".

**R3-C1. git push → deploy.** Edges: `git push` → webhook → queue → runner → stages (lint, test, build, push image, deploy) → registry → cluster or server. Each stage shows its time and artifact. Controls: dependency cache on/off (the test stage gets shorter), a manual gate before prod. "Break it": a test exits with code 1 → the following stages are grayed out, the commit is red; the `REGISTRY_TOKEN` secret is empty → `unauthorized: authentication required` on push. Check: `order`, then a `task` in the 06 A-I2 pipeline builder.

**R3-I1. Terraform plan/apply and state.** Three columns: "code (.tf)", "state", "cloud". `plan` is a comparison of "code versus state refreshed from the cloud", with `+ ~ - -/+` markers. Controls: editing an attribute in code (in-place, or replace if the attribute is ForceNew), removing a resource from code, a manual edit in the cloud. "Break it": delete the state → `plan` wants to create everything again, even though the resources already exist in the cloud (teaching `import`). Check: `predict` of the line `Plan: 1 to add, 0 to change, 1 to destroy`.

**R3-I2. Ansible, idempotency.** Two runs side by side; each task has an `ok/changed/failed` status. Controls: the `lineinfile` module versus `shell: echo ... >> file`, `changed_when`. Second run: in the correct playbook everything is `ok`, while with `shell` it is `changed` again and the file has two lines. Check: the `idempotent` goal from 06.

**R3-O1. From scrape to notification.** Edges: target `/metrics` → scrape (every `scrape_interval`) → TSDB (points on a time axis) → rule (`expr`, `for`) → states `inactive → pending → firing` → Alertmanager (`group_wait`, `group_interval`, `repeat_interval`) → receiver. Controls: `scrape_interval`, `for`, `group_wait`. Recomputation: "from the start of the failure to the message in chat — 1 m 45 s". "Break it": target down (the metric `up=0`, not a missing series), `for: 0` → flapping. Check: `predict` of the time to notification.

### 7. MAJOR — Container anatomy, six boundaries, VMs versus containers (R7)

**Where:** 6.1/8–9; the required content is missing.

**What is wrong.** 6.1 has no OCI bundle (`rootfs` + `config.json`), no CLI → dockerd → containerd → shim → runc/crun chain with lifecycle states, no six boundaries with drills, no "hardware → VM → containers → nesting" towers and no "container versus a second v86 VM" measurement. Scene 6.1/8 only compares 50 copies by memory.

**Ready content for 6.1b (Docker block, moves to 04).**

**R7-a. Anatomy.** (1) The OCI bundle: a `bundle/` directory with two parts, `rootfs/` and `config.json`. Clicking a `config.json` field (`process.args`, `process.user`, `linux.namespaces`, `linux.resources.memory.limit`, `mounts`) highlights which frame or gauge from L17 that field turns on. On v86: `crun spec`, edit `args`, `crun run demo`. (2) The chain: `docker run` → REST to `dockerd` (`/var/run/docker.sock`) → gRPC to `containerd` → `containerd-shim-runc-v2` → `runc create`/`start` → process; runc exits, the shim remains the parent. Edge labels: `POST /containers/create`, `Tasks.Create`, `runc create --bundle`. "Break it": "restart dockerd" — with `live-restore` the container stays alive, without it the container is stopped; "kill the shim" — the container loses its parent and stdio. (3) States: `created → running → paused → stopped (exited) → removed`; each transition has a command (`create`, `start`, `pause`, `stop`, `rm`) and what changes in the kernel (`pause` = cgroup freezer). Check: `order` of the chain, `hotspot` of "who remains the parent of the process". On v86 the real chain is trimmed down to crun; the full one is shown by a model verified against the golden recording from 04 §7.7.

**R7-b. Six boundaries.** The screen is a blueprint of "a container in the middle of a host", with six numbered sides. Each side is a separate screen showing the mechanism and a breakage drill. The cause in a drill always lies on a single boundary:

| Boundary | Mechanism on the blueprint | "Container does not work" drill | Check (09 §2.3 predicate) |
|---|---|---|---|
| 1. Host kernel | shared kernel; `uname -r` is the same inside and outside | the image needs a kernel module or syscall that is not there (`Function not implemented`) | `explain`: "why you cannot fix it from inside" |
| 2. Network | veth pair, `docker0`, NAT to the outside (MASQUERADE), `-p 8080:80` as DNAT in the `DOCKER` chain, the built-in DNS `127.0.0.11` in user-defined networks, host/none modes | the service listens on `127.0.0.1:80` inside the container → from the host, `curl localhost:8080` gives `Connection reset by peer` | `containers[name=web].ports~'8080->80/tcp' && http.web.status=200` |
| 3. Storage | overlay upper (disappears on `rm`), volume, bind, tmpfs | DB data disappeared after the container was recreated | `containers[name=db].mounts[type=volume][destination=/var/lib/postgresql/data]` |
| 4. Process and signals | PID 1 in the container, `docker stop` = SIGTERM → 10 s → SIGKILL, zombies, `--init`/tini | `CMD sh -c "node app.js"` (shell form): stop hangs for 10 s, exit 137 | `containers[name=app].exitCode=0` after `stop` in < 3 s |
| 5. I/O and logs | stdout/stderr → log driver → `docker logs` | the application writes to `/var/log/app.log` → `docker logs` is empty | `containers[name=app]` and `docker logs` contains a `listening` line |
| 6. Configuration and identity | env, secrets (as a file, not in env), UID inside and outside, userns-remap, bind-mount permissions | a container with `USER 1000` cannot write to a bind mount of a root:root 0755 directory → `Permission denied` | `files['/srv/data'].owner='1000'` or `:U`/`chown` |

In 04 §10 these six drills become exercises. The "On-call" exam (04 §13.4) picks a random boundary.

**R7-c. Hardware → VM → containers → today's nesting.** A blueprint of two layer towers side by side on a shared "hardware" axis at the bottom. Left: hardware → hypervisor → N × (guest kernel → libraries → application). Right: hardware → kernel → runtime → N × (libraries → application).

- Screen 1. A "number of applications" slider 1–50. Three counters per tower: memory used (VM: N × (kernel 120 MB + OS 300 MB + application); container: N × application + shared layers once), startup time (VM: kernel boot, on the order of seconds to tens of seconds; container: `fork`+`exec`, hundreds of milliseconds), hardware load. The numbers come from the screen 4 measurement and are not made up.
- Screen 2. A "kernel vulnerability" toggle: in the right tower a red boundary encloses all containers (the kernel is shared), in the left one a single VM. Label on the boundary: "container escape = code in the host kernel".
- Screen 3. Nesting today, three presets under one blueprint: (a) containers in a cloud VM (typical managed Kubernetes); (b) Kubernetes on bare metal; (c) a VM inside Kubernetes via KubeVirt (this is how Cozystack works): the `virt-launcher` pod → QEMU/KVM → guest kernel → application. Clicking a layer shows who manages that layer and what to inspect it with.
- Screen 4 (hands-on, v86). "The browser Linux is itself a VM": `dmesg | grep -i -E 'hypervisor|bochs|seabios'`, `cat /proc/cpuinfo | head` (emulated CPU), `uname -r` inside and outside the container (`crun exec`), `ps` inside and outside. Measurement: `time crun run --detach x` versus a "boot a second v86 machine" button (cold boot, 09 §1.4); both numbers feed into the screen 1 counters. Goal: `facts.http` is not needed; the check is `containers[name=x][state=running] && env.kind=v86`.
- Check: `explain` "why containers run inside VMs in the cloud" against a rubric: tenant isolation, shared kernel, the VM as a security boundary, density.

### 8. MAJOR — Networks from the big picture down to the packet, and a protocol catalog (R8)

**Where:** 6.3, §3.6.

**What is wrong.** There is no zoomable map of the internet (AS, BGP, IXP, cables, root DNS, CDN). There is no unified protocol card and no widget for it. There is no "first ask which layer broke" rule.

**Fix.**

**R8-1. Map of the internet (the `zoommap` widget).** Five zoom levels of a single blueprint, switched with the mouse wheel or buttons rather than as separate pictures: (1) laptop → home router → ISP; (2) the ISP as autonomous system AS64500 with routers and exits to neighbors; (3) several ASes, an IXP as a shared switch, transit and peering; BGP prefix announcements on the edges (`203.0.113.0/24 AS_PATH 64500 64510`); (4) continents and submarine cables schematically, with latency on the line; (5) a data center: racks, a load balancer, a CDN node near the user. Root DNS servers are visible at all levels (13 names `a`–`m.root-servers.net`, hundreds of anycast instances — the label is right on the icon). Controls: "CDN cache on/off" (the path shortens to the CDN node, RTT is recomputed), "withdraw a prefix" (BGP withdraw: the path is rebuilt or disappears, with the label "this is what major outages looked like when an AS vanished from BGP"). Check: `hotspot` "where two ASes exchange traffic without transit", `order` of the request path to the CDN. Real addresses only from RFC 5737 and AS numbers from RFC 5398 (64496–64511).

**R8-2. The layer rule.** Add item 9 to §5.3: "Every network breakage on a blueprint is labeled with its layer (L2…L7). The first question of any network drill is a `choice` "which layer broke?" before the terminal". In §3.5, the default prediction question for network toggles is "at which layer is the break".

**R8-3. Protocol card (the `protocard` widget).** A single form. YAML fields:

```yaml
protocol:
  id: dhcp
  level: L0               # L0 beginner, L1 intermediate, L2 experienced
  layer: L7-over-UDP      # where it lives
  why: { ru: "Машина без адреса получает адрес, маску, шлюз и DNS", en: "..." }
  sequence: seq/dhcp.yaml # sequence diagram for the seq widget (finding 21)
  observe:                # how to see it for yourself
    - "tcpdump -n -i eth0 port 67 or port 68"
    - "journalctl -u systemd-networkd | grep DHCP"
  breaks:                 # how it breaks: symptom → layer → command
    - { symptom: "169.254.x.x on the interface", layer: L7, check: "tcpdump: DISCOVER without OFFER" }
  rfc: [RFC 2131]
  docs: [man-dhclient, man-systemd-networkd]   # for the documentation ladder (finding 9)
```

Card list by level: L0 — DHCP, ARP, ICMP, TCP, UDP, DNS, HTTP, HTTPS/TLS, SSH; L1 — NTP, SMTP, FTP/SFTP, HTTP/2, HTTP/3 (QUIC), WebSocket, gRPC, VLAN (802.1Q), NAT/PAT; L2 — BGP, VXLAN/Geneve, IPsec, WireGuard, mTLS, OSPF (the idea). The card overview is a "level × layer" grid. Clicking a cell opens the card; the sequence diagram in it is a `seq` widget with steps and parameters (for TCP — window and RTT, for QUIC — 0-RTT on/off). 03 writes the card content; 08 provides the form and the widget.

### 9. MAJOR — There is no documentation ladder (R2)

**Where:** nowhere. §3.4 item 1 (next-command chips) and §7.5 (hints with `reveals`) contradict steps 3–5.

**Fix.** A new section §3.12 "Documentation ladder".

**Widgets.**

1. `docref` (step 1, "glimpse"). A small `man 1 ps · OPTIONS` tag next to a command in the text, a chip, or an output line. Hovering shows one line, "this comes from here"; clicking opens `docpeek`. Optional, checks nothing.
2. `docpeek` (step 2). A side panel with a **fragment** of the page: the real text of the man page or of a kubernetes.io/docs.docker.com section. The sections `NAME / SYNOPSIS / DESCRIPTION / OPTIONS / EXAMPLES / SEE ALSO` are labeled in the margin as the anatomy of the page, the relevant line is highlighted, the rest is dimmed, and there is a "full page" button. The level 2 hint from 01 §14.2 **is** `docpeek` at this step, not a retelling.
3. `findflag` (step 3, a check type in §3.8). The task "find the flag that does X" plus **only** a link to the page (`docpeek` opened in full, without highlighting). The answer is checked by its effect: the command runs in a copy of the environment and the state is compared. Separately, whether the learner opened the page is tracked (the `doc.opened` event in the 09 §3.1 log, for statistics only).
4. **Forcing mode** (step 4). Tasks require commands and flags that are not in the theory (`introduces` does not contain them, the task is marked `beyond: true`). No hints, chips are hidden. The `docs-coach` AI mode (added to the 09 §4.5 modes table): "Do not name the command or the flag. Ask: "Where have you already looked?" Name the source (`man <cmd>`, `<cmd> --help`, `kubectl explain <resource>.<field>`, `docs.docker.com/reference/cli/...`) and the section to look in. If the learner quoted the right line, confirm it and explain it". The engine checks the AI's answer for the reference command and collapses it, as in `lab` mode.
5. `docsbrowser` (step 5, exams). Inside an exam, an "official documentation" window: only the corpus from `docs.yaml` (man, kubernetes.io, docs.docker.com, developer.hashicorp.com/terraform, docs.ansible.com, prometheus.io/docs), search over it, no AI (09 §4.7). An exam has 20–30% of tasks with `beyond: true`. For the Kubernetes block, the list of allowed sites matches the current CKA rules on the Linux Foundation page (check before release, `sources.yaml: checked`).

**Offline documentation corpus.** `content/docs/` with excerpts and full pages: man pages for the course's commands (about 150, on the order of 1–2 MB compressed, a separate chunk per block), `kubectl explain` generated from the same v1.37 OpenAPI schemas as kube-lite (05 §0 item 2), site fragments. Licenses are recorded in the rights registry: the Linux man-pages project uses various free licenses per page, and each fragment keeps its license header; GNU coreutils pages are GFDL; kubernetes.io is CC BY 4.0 (attribution required); docs.docker.com is Apache-2.0 (the docker/docs repository). Budget limit — a line in §10: "Documentation corpus: up to 2 MB per block, on demand".

**YAML fields.**

```yaml
# source with an anchor — needed for steps 1–2
- id: man-ps
  url: https://man7.org/linux/man-pages/man1/ps.1.html
  kind: doc
  local: docs/man/ps.1.json        # offline copy, split into sections
  anchors: { eLf: "OPTIONS/-L", o: "STANDARD FORMAT SPECIFIERS" }

# on a screen and a task
doc_step: 2                         # 1..5; by default taken from the block's ladder
doc: { ref: man-ps, anchor: eLf }   # for docref/docpeek
beyond: true                        # for steps 4–5: not introduced in the theory
```

**The ladder by block** (the learner's step = `max(block ladder step, level's starting step)`; an experienced learner starts at step 3, per R2):

| Block | Modules at steps 1 → 5 | Example step 3 task (`findflag`) | Example step 4 (forcing, `beyond`) | Example step 5 (exam) |
|---|---|---|---|---|
| Linux | L0–L3: 1; L4–L8: 2; L9–L12: 3; L13–L17: 4; E1–E3: 5 | "`ps` will show threads — which flag?" (`-L`) | "Find the process holding a deleted file" (`lsof +L1`, not introduced) | "Limit a service to 200 MB using systemd" (`MemoryMax=` in `systemd.resource-control(5)`) |
| Networks | N0–N4: 1; N5–N8: 2; N9–N12: 3; N13–N15: 4; exam: 5 | "`dig` with nothing extra — just the address" (`+short`) | "Show TCP socket timers" (`ss -o`) | "Limit SSH to 3 attempts per minute" (`nft` limit) |
| Containers | D1–D4: 2 (the beginner arrived after Linux); D5–D7: 3; D8–D10: 4; exams: 5 | "How do you avoid inheriting the cache during a build?" (`--no-cache`) | "Limit a container to 50 processes" (`--pids-limit`, `docker run --help`) | "Build an arm64 image on amd64" (`buildx --platform`) |
| CI/CD | first modules: 2; then 3–4; exam: 5 | "How do you run a job only for tags?" (`rules: if: $CI_COMMIT_TAG`) | "Cancel outdated runs on a branch" (`interruptible` / `concurrency`) | — |
| Kubernetes | K0–K5: 2; K6–K12: 3; K13–K20: 4; exam E: 5 | "Which field limits the time a pod has to terminate?" (`kubectl explain pod.spec.terminationGracePeriodSeconds`) | "Make sure the pod does not land on a node labeled `disk=hdd`" (nodeAffinity `NotIn`, not introduced) | "Back up etcd" (`etcdctl snapshot save`, from the docs) |
| IaC | 3 → 4 → 5 | "How do you show the plan for a single resource?" (`-target`) | "Move a resource between modules without recreating it" (`moved`, if not introduced for beginners) | — |
| Monitoring | 3 → 4 → 5 | "The PromQL function for the 95th percentile" (`histogram_quantile`) | "Silence an alert during maintenance" (`amtool silence add`) | — |

The chips in §3.4 item 1 are governed by the step: steps 1–2 — the full command; step 3 — only the command name; steps 4–5 — chips off. The hint ladder in §7.5 ends with `docpeek` at step 3, not with `reveals`. At steps 4–5 `hints` is empty, and the validator checks this.

### 10. MAJOR — The event bus is not enough for R7, R9, R11, and the type diverges from the examples

**Where:** §3.0, §7.6.

**What is wrong.** (a) In §7.6 the `proc.spawn` event has a `nspid: 1` field, but the type does not have it; `ns` is typed as `NsSet`, although the example passes a partial object. (b) The `at` field is promised in the text but missing from the type. (c) Events carry no node or machine, and with several v86 nodes (R11) and hybrid Kubernetes, without this the diagram does not know which node a process is on. (d) There are no events for veth/bridge, netfilter rules and conntrack, signals, logs, ARP, controller reconciliation, or the node Lease.

**Fix (replace the type in §3.0; in 09 §1.3 the type refers to 08, so it changes only here):**

```ts
type Base = { at: number; machine: string };      // machine: 'node-1', 'host', 'sim'
type SimEvent = Base & (
  | { t: 'proc.spawn'; pid: number; ppid: number; tid?: number; cmd: string; nspid: number[]; ns: Partial<Record<NsKind, string>>; cgroup: string; uid: number }
  | { t: 'proc.exec'; pid: number; path: string }
  | { t: 'proc.signal'; pid: number; sig: string; from: number; handled: boolean }
  | { t: 'proc.exit'; pid: number; code: number; reason?: 'oom' | 'signal' | 'normal' }
  | { t: 'ns.create'; kind: NsKind; id: string; by: number }
  | { t: 'ns.enter'; pid: number; kinds: NsKind[]; target: number }
  | { t: 'cgroup.set'; path: string; key: string; value: string }
  | { t: 'cgroup.usage'; path: string; memory: number; cpu: number; pids: number }
  | { t: 'cgroup.event'; path: string; key: 'oom' | 'oom_kill' | 'max'; count: number }
  | { t: 'fs.mount'; type: string; target: string; lower?: string[]; upper?: string; ns: string }
  | { t: 'fs.copyup'; path: string; fromLayer: string }
  | { t: 'net.link'; op: 'add' | 'del' | 'up' | 'down' | 'move'; name: string; kind: 'veth' | 'bridge' | 'vxlan' | 'wireguard' | 'eth'; peer?: string; ns?: string; master?: string }
  | { t: 'net.packet'; id: string; from: string; to: string; via?: string; layers: PacketLayers; verdict?: 'ok' | 'drop' | 'rst' | 'nat' | 'reject' }
  | { t: 'net.rule'; table: string; chain: string; rule: string; hit: string /* packet id */ }
  | { t: 'net.conntrack'; op: 'new' | 'update' | 'destroy'; orig: string; reply: string }
  | { t: 'net.arp'; op: 'request' | 'reply'; ip: string; mac?: string }
  | { t: 'dns.query'; id: string; name: string; type: string; server: string; answer?: string[]; ttl?: number; cached?: boolean; rcode?: string }
  | { t: 'img.layer'; digest: string; size: number; instruction: string; cached: boolean }
  | { t: 'log.line'; source: string; stream: 'stdout' | 'stderr' | 'journal'; text: string }
  | { t: 'k8s.object'; verb: 'create' | 'update' | 'delete' | 'bind'; kind: string; name: string; ns?: string; by: string; rv: string }
  | { t: 'k8s.watch'; component: string; kind: string; name: string }
  | { t: 'k8s.reconcile'; controller: string; key: string; desired: unknown; actual: unknown; action: string }
  | { t: 'k8s.status'; kind: string; name: string; phase: string; reason?: string }
  | { t: 'k8s.lease'; node: string; renewed: boolean }
  | { t: 'doc.opened'; ref: string; anchor?: string }     // for the documentation ladder, log only
  | { t: 'cmd.done'; tty: string; line: string; exit: number }
);
```

### 11. MAJOR — The `bind`/`when` selector and the goal format diverge from the 09 check contract

**Where:** §3.2 (`bind: "proc[pid=1]"`), §7.5 (`proc[cmd=bash][ns.pid!=host][nspid=1]`, `cgroup[procs~bash].memory.max<=104857600`).

**What is wrong.** In 09 §2.3 the grammar is defined over `dt.facts/v1` facts: plural paths (`procs`, `cgroups`, `containers`), the `@host` and `@pid(name)` macros, sizes like `20M`. In 08 the paths are singular, `host` is a bare word, and the state is that of the "simulator" rather than facts. Two grammars mean two evaluators and drift between tiers A, B and C. The 08 goals have no `needs`, `envs`, `keep`, `fail`.

**Fix.** Write in §3.2 and §7.5: "`bind` and `when` are the 09 §2.3 predicate language over `dt.facts/v1` facts; the diagram subscribes to the facts of the `needs` scope and to the bus. The goal format is 09 §2.4". Rewrite the examples: `procs[cmd=bash][ns.pid!=@host.ns.pid][nspid=1]` (comparison against an element of the `nspid` array uses the last element — to be specified in 09, I will fix it on my side), `cgroups[procs~@pid(bash)].memory.max<=100M`.

### 12. MAJOR — QR and serverless WebRTC do not work as described

**Where:** §3.9.

**What is wrong.** (a) An SDP offer with a DTLS fingerprint, ufrag/pwd and candidates takes hundreds of bytes, and at least on the order of 100–150 bytes after compression. That is at the edge of the QR version 10/M limit (213 bytes), and a scene snapshot will not fit on top of it. (b) The SDP answer from the phone has to be delivered to the laptop. A "short code that the learner types in" cannot carry the fingerprint (32 bytes) and the candidates, which come to dozens of base32 characters. (c) The laptop cannot scan a QR code: 09 §6.4 has `Permissions-Policy: camera=()`. (d) Chrome by default hides host candidates behind `.local` mDNS names, and in some networks they do not resolve. Without STUN/TURN, the connection will not be established on guest Wi-Fi with client isolation.

**Fix.** Replace the second paragraph:

> **"Diagram on a second screen"** — only when `dt-api` is available: the laptop opens the `wss://<domain>/api/pair` channel and shows a QR code with a one-time room code (16 bytes); the phone joins the same room; SDP is exchanged through it, and then data flows directly over a WebRTC data channel (STUN is ours, no TURN; on failure the room itself relays bus events, up to 50 KB/s, for no longer than 2 hours). The server sees only the bus events of this scene, with no terminal and no keys. Without `dt-api` the mode is unavailable, and "keep reading on the go" works as before.

I will add the `/api/pair` path in 09 §1.6/§6.

### 13. MAJOR — Connecting a neural network contradicts 09: key, context, modes

**Where:** §3.10.

**What is wrong.** "The key in this browser's `localStorage`" contradicts 09 §4.4: the key is stored in IndexedDB, encrypted with a non-extractable `CryptoKey`, there is a "do not remember" mode, and the key must not be in `localStorage` (any script can read it and it ends up in profile dumps). The context has 20 terminal lines, while 09 has 40 with secret masking. There is no mode (`learn`/`lab`/`explain-output`/`review`/`exam`) and no documentation ladder step.

**Fix.** Replace the sentence about connecting with: "Connection, key storage (IndexedDB, AES-GCM, "do not remember" mode) and prompt assembly — 09 §4.1–4.5. The engine passes to `ask(context)`: `lesson`, `screen`, `level`, `mode` (from the 09 §4.5 table plus `docs-coach`), `docStep` (1–5), the widgets' `describe()`, `goals` with their state, `introduced`/`notYet` from the 01 graph. The terminal is collected and masked by 09". In §3.4 item 2, the "Ask the neural network" button is not shown in `exam` mode and at steps 4–5 turns into "Where to look?" (`docs-coach` mode).

### 14. MAJOR — Factual errors in 6.1

**Where:** 6.1/3, 6.1/5, 6.1/6, 6.1/9, §5.2 (`--c-ns-*`).

1. "Seven links" in `ls -l /proc/$$/ns`. On kernel 6.12 (`dt-kernel`, 09 §1.4) there are 10: `cgroup, ipc, mnt, net, pid, pid_for_children, time, time_for_children, user, uts`. There are eight namespace kinds (time since Linux 5.6). Fix: "eight kinds; the two `*_for_children` links show which namespace children will end up in", and add `time` to the §5.2 palette and to `NsKind`.
2. "`id` inside is root, while from the host the same process is uid 100000". With `unshare --user --map-root-user`, outside the process keeps the UID of whoever started it (for example, 1000). 100000 is the range from `/etc/subuid` (rootless Podman/Docker, `userns-remap`). Fix: "`unshare --user --map-root-user`: 0 inside, 1000 outside (`cat /proc/<pid>/uid_map` → `0 1000 1`); in rootless engines the inner root is mapped to 100000 from `/etc/subuid`". The same error is in 04 §4.2.
3. cgroup: the sequence is incomplete. `mkdir /sys/fs/cgroup/demo` is needed. The memory controller must be enabled in the parent (`echo +memory > /sys/fs/cgroup/cgroup.subtree_control`), and without systemd in the `lab-alpine` image it is not enabled by default. If swap is present, the process is not killed but goes to swap, so `memory.swap.max=0` is needed. `stress --vm-bytes 150M` without `--vm 1` does not start a worker; the worker is killed, not the parent (`stress: FAIL: [..] (415) <-- worker 4212 got signal 9`). Simpler and without an extra package: `head -c 150m /dev/zero | tail` (as in 04 §4.3).
4. `chroot` "can be escaped". Only a process with `CAP_SYS_CHROOT` (root) can escape. Clarify: "root inside a chroot can escape (the classic trick with a nested chroot and `..`); `pivot_root` in a new mount namespace changes the root of the whole namespace, and the old root can be unmounted". For `pivot_root`, the new root must be a mount point (`mount --bind rootfs rootfs`) — this is a mandatory step of lab 6.1/9.
5. bocker uses btrfs and cgroups v1 via `cgcreate` and has been unmaintained for a long time. Write "based on the idea of bocker", but give cgroup v2 commands.
6. Scene 6.1/9 "`docker run --memory 100m` in the neighboring tab" does not specify where this runs. Per 09 §1.7, `docker` is simulated by dsim, so "the same picture" will be a model. More honest: in v86, `crun run` with the bundle from R7-a, and next to it dsim labeled "this is how Docker would do it (simulator, verified against Docker Engine 29.x)".

### 15. MAJOR — Factual errors in 6.3 (networks)

1. 6.3/2: "the `+trace` output matches the arrows line by line" to the recursive resolver. `dig +trace` performs iterative resolution **itself**, from the learner's machine to the root, the TLD and the authoritative server; the ISP's recursive resolver and its cache do not take part in the trace (only for the initial query for the root NS). So the "after 30 s / after 2 h" slider with `+trace` does not show the cache. Fix: two separate lanes — "how the resolver asks" (a model; cache and TTL are controls) and "how `dig +trace` repeats it" (no cache); the resolver cache is visible via `dig @resolver name` twice: a decreasing TTL in the second answer.
2. 6.3/7, TLS 1.3: the order "certificate → chain verification → shared key → Finished" is the TLS 1.2 scheme. In 1.3 the shared secret is derived right after ServerHello (`key_share`), and the server's `EncryptedExtensions`, `Certificate`, `CertificateVerify`, `Finished` are sent **already encrypted** (RFC 8446 §2). Fix the stepper steps and mark on the envelope from which step the contents are sealed.
3. 6.3/6: "the firewall silently drops — a stopwatch until `Connection timed out`". curl's default connection timeout is 300 s, while the Linux kernel gives up after `tcp_syn_retries=6` (about 127 s). In the simulator, show the real SYN retry ladder (1, 2, 4, 8… s) and suggest `--connect-timeout`. This is already done in 03 §7.1.
4. §3.6 and 6.3/5–6: on a router, it is not only the IP that changes with NAT. On **every** L3 hop the Ethernet envelope is removed and a new one is put on (new MACs), TTL decreases by 1, and the checksum is recalculated (03 §7.2 screen 3). The animator must show this, otherwise the learner will conclude that the destination MAC is the server's MAC. Add to §3.6: "at each router the outer L2 envelope is replaced (old MACs struck through), TTL −1".
5. §3.6: the example `dst 93.184.215.14:443` violates the document's own rule §5.3 item 5 (addresses from RFC 5737), and the example.com address changed long ago anyway. Replace with `198.51.100.20`.
6. §3.6: "the load balancer opens the HTTP" is true only for an L7 load balancer that **terminates TLS**. Add an "L4 / L7" toggle: with L4 the TLS envelope is not opened, and the load balancer sees only IP:port. This is exactly the "L4/L7 load balancer" vocabulary from R8.
7. Order of introduction: "router" and "L3" are introduced in 6.3/6 but used in 6.3/5 ("NAT on the home router"). The terms L2 and ARP are introduced in the `intermediate+` scene 6.3/4, while the model assembly in 6.3/10 for beginners relies on L2. If the URL explanation becomes a synthesis after N15 (finding 5), both problems go away.

### 16. MAJOR — Errors and outdated content in 6.4 and §3.5 (Kubernetes)

1. 6.4/5: "the node is `NotReady` after ~40 seconds". Since v1.32 the default `node-monitor-grace-period` is 50 s ([kubernetes.io/docs/reference/node/node-status](https://kubernetes.io/docs/reference/node/node-status/)); the course targets v1.36–1.37 (05 §0, 09 §1.3). More precisely: "after 50 s the Ready condition = Unknown, `kubectl get nodes` shows `NotReady`; after 300 s (`tolerationSeconds` for the `unreachable` taint) the pods are evicted".
2. 6.4/7: "`kubectl get endpoints` is empty". The `v1 Endpoints` API has been deprecated since v1.33, and kubectl prints the warning `Warning: v1 Endpoints is deprecated in v1.33+; use discovery.k8s.io/v1 EndpointSlice` ([kubernetes.io/blog/2025/04/24/endpoints-deprecation](https://kubernetes.io/blog/2025/04/24/endpoints-deprecation/)). Teach `kubectl get endpointslices -l kubernetes.io/service-name=web`, as in 05 §6.4. Also fix the command list at the end of 6.4.
3. §3.5: the "Without scheduler" toggle lists the message `0/3 nodes are available`. That is the text of the FailedScheduling event, which is written by a **running** scheduler. When there is no scheduler, there are no events at all (as stated in 6.4/4 and 05 §6.1). Replace the example with "No room on the nodes" → `0/3 nodes are available: 3 Insufficient memory.`
4. 6.4/9 and 6.4/10: Ingress in the final check contradicts 05 §0 item 4 (Gateway API is primary; ingress-nginx was retired in March 2026). Final check: "Deployment with 3 replicas + Service + Gateway + HTTPRoute"; Ingress in a footnote.
5. 6.4/7: kube-proxy in nftables mode (05 §0 item 5) is not mentioned. An iptables/nftables/eBPF mode toggle (Cilium without kube-proxy) is needed on the "rule on the node" screen.
6. 6.4/5 and 6.1/9 introduce "container runtime" a second time (01 K08 requires D10; rule 2 in §7.3 "a term is introduced in exactly one place"). In 6.4, use `uses: [D10]` and introduce only CRI.

### 17. MAJOR — Kubernetes networking as a separate section (R9): 6.4 has two screens, a drill and a debugging sequence are needed

**Where:** 6.4/7–9.

**What is wrong.** In 6.4 networking takes one scene about Service and one `intermediate+` scene about CNI. In 05 §6.4 the mechanism is worked out better, but it also lacks: the "every pod has an IP, no NAT" model as a separate screen, a drill "find in iptables where a ClusterIP packet goes", `ndots` as a control, NetworkPolicy as "everything open by default + CNI support", and the debugging sequence as an algorithm.

**Ready content (the `split` + `packets` widget, tier A kube-lite + netlab; on the R11 hybrid — the node's real iptables):**

| # | Screen | Blueprint | Controls / "break it" | Check |
|---|---|---|---|---|
| K-N1 | Network model | Nodes, each pod has its own IP from the node's `podCIDR`; three rule labels: pod ↔ pod without NAT, node ↔ pod without NAT, a pod sees its own IP the same way others see it; a frame "this promise is fulfilled by the CNI" | "CNI not installed" toggle → node `NotReady`, `cni plugin not initialized` | `choice`: "who assigns an IP to a pod" |
| K-N2 | Pod ↔ pod on the same node | Pod A netns → veth → `cni0` bridge → veth → pod B | "Number of pods" slider: the number of veths grows | `hotspot`: where the packet passes from the pod's netns to the node's netns |
| K-N3 | Pod ↔ pod across nodes | Three modes of one diagram: routing (route `10.42.1.0/24 via 192.0.2.11`), VXLAN (outer UDP 8472 header with node IPs), Cilium eBPF (no bridge, a program on the veth) | Mode switch; MTU: 1450 inside VXLAN | `predict`: which source IP tcpdump will see on the physical interface |
| K-N4 | Service: an address that is on no interface | `ip a` on the node does not contain the ClusterIP; EndpointSlice → kube-proxy rules | kube-proxy mode iptables/nftables/eBPF | **Drill:** "find the rule that determines where a packet to 10.43.12.7:80 goes" — `iptables -t nat -L KUBE-SERVICES -n \| grep 10.43.12.7` → `KUBE-SVC-…` → `KUBE-SEP-…` → `DNAT to 10.42.1.15:8080`. Check: the learner enters the pod's IP:port, compared against the `net.iptables` facts |
| K-N5 | Cluster DNS | The pod's `/etc/resolv.conf`: `nameserver 10.43.0.10`, `search default.svc.cluster.local svc.cluster.local cluster.local`, `options ndots:5` | `ndots` slider 1–5: the number of queries for `api.example.com` is recomputed (at 5 — first three search-domain lookups with NXDOMAIN) | `predict` of the number of DNS queries |
| K-N6 | Ingress from outside | NodePort (the `KUBE-NODEPORTS` chain), LoadBalancer (external IP → NodePort), Gateway API (Gateway → HTTPRoute → Service), Ingress in a footnote | `externalTrafficPolicy: Local/Cluster`: whether the client IP is preserved, whether a node without a pod responds | `order` of the path |
| K-N7 | NetworkPolicy | Everything open by default; a default-deny policy → the packet is dropped on the receiving node | "CNI does not support NetworkPolicy" toggle (flannel without add-ons) → the policy is created but changes nothing | `predict` |
| K-N8 | "The pod could not reach the Service" | A ladder algorithm: DNS (`nslookup web`) → Service (`kubectl get svc web`) → EndpointSlice (are there addresses, `ready`) → pod (`kubectl get pod -o wide`, readiness) → NetworkPolicy; each step has its own command and signal | A random breakage out of five | `task` with the goal "the request goes through" + `order` of the steps |

### 18. MAJOR — There are no widgets for a multi-node lab and hybrid Kubernetes (R11) or for the real-environment stage (R12)

**Where:** §3.3, §3.4 "Real kernel level", §9.

**What is wrong.** The engine knows only one machine. R11 requires 3–4 v86 machines in Workers, connected by our JS switch (in 09 §1.6 I have `inbrowser` over BroadcastChannel; below is what I expect from the engine, and I will fix the platform part on my side). Hybrid Kubernetes: the control plane is kube-lite, the nodes run real kubelet agents via crun. Under R12, at stage 3 the trainer guides and checks, shows the cost and requires cleanup. 08 has none of this, and §3.4 describes the remote terminal as "ttyd", whereas in 09 §1.5/§5.3 it is the `remote` machine via `dt-api`.

**Fix — add to §3:**

**3.13. `fabric` — a machine network widget.** Blueprint: nodes (v86 machines and simulated netlab hosts) as rectangles, the switch as a bar with ports; each port is labeled `eth0 52:54:00:..:01 · 10.0.0.11/24`. Frames travel along the wires; they come from the `net.packet` bus with the `machine` field, and the source is the JS switch itself (it sees every frame). The switch's MAC table is visible and ages on a timer. A probe on a port = `tcpdump` without entering the machine, with a `.pcap` download (as in 03 §7.3.1). Terminal tabs per machine; on a phone, one machine (R11) and model nodes instead of the rest, with a label. "Break it" toggles: pull a cable, VLAN on a port (L1), 5% loss. Memory indicator: "3 machines × 128 MB = 384 MB of guests; tab ≈ 1.2 GB". Before starting a fourth machine with `deviceMemory < 8`, show a warning.

**3.14. `cluster` — hybrid Kubernetes.** At the top, the kube-lite control plane (the same blocks as in 6.4); at the bottom, v86 nodes with real processes. A pod is a frame in a node; clicking it expands its real namespaces and cgroups from the agent's facts (`procs`, `ns`, `cgroups` 09 §2.2). Actions: "kill the node" (stop the v86 machine), "`kubectl exec`" (a real `nsenter` into the container). Lease counters per node (`k8s.lease`). The "model / real" distinction is always visible: kube-lite blocks are outlined with a dashed line labeled "simulator", nodes with a solid line labeled "real kernel". This follows directly from the honesty rule (09 §1.3).

**3.15. `realstage` — the real-environment stage (R12, stage 3).** A checklist screen instead of a lab: on the left, the track steps (`terraform apply` → `ansible-playbook` → `kubeadm init` → join → Cilium → storage → certificates → version upgrade → `etcdctl snapshot save/restore` → break and fix a node → **cleanup**); each step has what to do (text, a link to the docs per ladder steps 4–5), how to check it (`trainer-check run --step ...`, a field for pasting the result, 09 §5.4), and a status from `CheckResult`. Top right: a cost counter — provider, configuration, "running 2 h 14 min ≈ 61 ₽ / €0.31" (prices from `providers.yaml`, 05 §10.2 and 09 §5.2), with a reminder every 2 hours. The last step is **mandatory and cannot be skipped**: "Cleanup" with a command (`terraform destroy`), the check is `trainer-check run --step cleanup` plus pasting the `terraform state list` output (empty). The track does not count as completed until cleanup is checked off. At stages 1–2 (R12), the same widget with k3s/minikube/kind steps, without the cost counter if the machine is the learner's own.

### 19. MAJOR — The reconciliation loop explanation (R10) is incomplete

**Where:** 6.4/1 (the ink thermostat), 6.4/6.

**What is wrong.** In 08 the loop is shown once, through a metaphor. 05 §6.2 has desired/actual, disturbances and a custom controller, but no visual chain of controllers as a continuation of the same loop. R10 requires three parts in one explanation: loop → chain → custom controller = operator.

**Ready content (the `reconcile` widget, the model is kube-lite):**

- R10-1. On the left, "Desired" (YAML from etcd, key `/registry/deployments/default/web`, field `spec.replicas: 3`), on the right, "Actual" (pods), in the middle the controller — a ring of three labeled arcs `observe → diff → act`, with a revolution counter. The diff line: `want 3 · have 2 · act: create 1 pod`. Learner actions: delete a pod, kill a node, set `replicas` with a 0–10 slider, change the image. After each action the ring makes a revolution and the diff collapses. Pausing the controller (05 §6.2 screen 3) shows level-triggered behavior: three changes — one action.
- R10-2. The chain: the same drawing repeated four times horizontally, each ring with its own "desired" and "actual": the Deployment controller (want: a ReplicaSet with the template hash) → the ReplicaSet controller (want: N pods) → the scheduler (want: the pod has a `nodeName`) → the kubelet (want: the pod's containers are running). The actual state of one link is the desired state of the next; the label on the arrow between rings is the object that connects them. Changing the image launches a wave along the chain, and you can see which ring is working right now.
- R10-3. A custom controller: an editor with the template from 05 §6.2 screen 2b, CRD `Website`. When it runs, a fifth ring labeled "your code" appears in the chain. The caption under it: "an operator = the same loop for your own resource". Checks from 05: a deleted Deployment comes back, deleting the Website removes everything. Bridge to the pet project: a "the same in Go" button opens the kubebuilder storyboard (real-environment stage).

### 20. MAJOR — The palette is not calm and has collisions (R5)

**Where:** §5.2.

**What is wrong.** The diagrams use 18 saturated hues (7 namespaces, 5 layers, 3 Kubernetes, 3 states). `#A16207` means both TLS and warn. The pid-namespace frame `#C2410C` next to `--c-err` and `--c-limit` `#B91C1C` reads as an error. The three blues (`--c-kernel #3B3F8F`, `--c-cp #1E3A8A`, L3 `#0369A1`) are almost indistinguishable. `time` is missing. "Dark = 25% lighter" does not guarantee 3:1 contrast.

**Fix — replace the table with a principle and tokens:**

> Color encodes the **domain**, a shade within the domain encodes the subtype, and the distinction between subtypes is duplicated by stroke and label. Red is reserved exclusively for errors and limit violations; no domain uses it. Saturation is muted (OKLCH, C ≤ 0.12 for fills, ≤ 0.16 for lines); the background is warm paper.

| Domain | Tokens (light theme, OKLCH) | Subtypes |
|---|---|---|
| Kernel | `--c-kernel: oklch(0.38 0.08 275)` | — |
| User space | `--c-user-fill: oklch(0.97 0.01 85)`, outline `oklch(0.45 0.02 85)` | — |
| Namespaces | a single hue `oklch(0.55 0.10 160)` (green-teal) | 8 kinds: stroke (solid, dashed, dotted, double…) + a tab label; color does not distinguish the kind |
| cgroups | `oklch(0.60 0.11 70)` (ochre) | the gauge is gray, the limit mark is ochre, exceeding it is `--c-err` |
| Network L2/L3/L4/TLS/L7 | a lightness scale of one blue `oklch(0.35…0.75 0.09 240)`, L7 the lightest | plus a layer label on the envelope flap |
| Kubernetes control plane / node / objects | purple `oklch(0.45 0.09 300)` / green `oklch(0.50 0.08 145)` / brown `oklch(0.50 0.07 50)` | shape: hexagon / rack / document |
| State | `--c-ok oklch(0.55 0.13 150)`, `--c-warn oklch(0.70 0.13 85)`, `--c-err oklch(0.55 0.17 25)` | always with a ✓ ! ⨯ icon |

The dark theme has separate lightness values chosen by a contrast test in CI (§8), not "+25%".

### 21. MINOR — There is no sequence diagram widget

**Where:** §3; needed for TCP, TLS, DNS, DHCP, SSH and for every protocol card (R8).

**Fix.** Add `seq`: participants as columns, time from top to bottom, messages as arrows with labels **on the line** (`SYN seq=0 win=64240`), latency visible as the slope of the arrow (RTT is a control). It works on top of `ProcessModel` (finding 2) and is linked to the packet animator: clicking an arrow opens the same envelope as in `packets`. Two views of one process: "topology" (`packets`) and "sequence" (`seq`), with a switch above the diagram.

### 22. MINOR — "Magazine-quality" typography (R5) is not described

**Where:** §5.2, last paragraph.

**Fix.** Add §5.4:

> Body text — a serif face with full Cyrillic (IBM Plex Serif or Source Serif 4, OFL), 18–19 px, line height 1.55, measure of 62–70 characters; captions and UI — IBM Plex Sans; code, values on diagrams, terminal — IBM Plex Mono. Headings — Plex Sans semibold, scale 1.25. Hanging punctuation (`hanging-punctuation: first`), non-breaking spaces after one-letter prepositions and before dashes (at build time), «guillemets» in RU, “curly quotes” in EN. Diagram captions go to the right of the diagram on wide screens (a margin, as in magazine layout) and below the diagram on narrow ones. Terminal — its own xterm theme on tokens: background `--c-term-bg` (deep graphite in both themes), ANSI colors muted to the same palette, block cursor, Plex Mono 14 px, line-height 1.35; the prompt is colored (`user@host:path$`) with the same tokens as "user" and "kernel" on the diagrams. Transition between steps — 240 ms, `cubic-bezier(.2,.7,.2,1)`; 0 ms in reduced-motion mode.

### 23. MINOR — The experienced level "sees only the mechanism, the lab and the check"

**Where:** §4, the paragraph about levels.

**What is wrong.** Under R1, the core of the product is coherent theory and a strict order for everyone. An experienced programmer does not know cgroups or the Kubernetes network stack, and hiding the theory will leave gaps. In addition, under R2 an experienced learner starts at step 3 of the documentation ladder, and §4 does not say this.

**Fix.** "An experienced learner sees the theory in condensed form (screens with `levels: [L0]` are collapsed into a single line, `theory` screens are shortened to a summary paragraph with a "full text" button), starts with a challenge task (01 §7, L2) and at step 3 of the documentation ladder".

### 24. MINOR — The §4 screens have no "theory" kind

**Where:** §4, the `kind` table.

The four kinds (`story/mechanism/lab/check`) do not provide coherent theory text as a separate screen, while R1 puts it first. Add `theory` (from 01) and make "Core knowledge can be read without a single click" a requirement specifically for it.

### 25. MINOR — Minor inaccuracies in 6.2

1. 6.2/2: `tar -tzf blobs/sha256/<layer>`. Layers in `docker save` are either uncompressed (classic storage) or compressed (containerd image store), so `-z` sometimes works and sometimes fails. Write `tar -tf` (GNU tar and busybox detect compression themselves) or first `file blobs/sha256/<layer>`.
2. 6.2/1: "`EXPOSE`/`CMD` do not create a sheet". Correct with respect to layers, but in `docker history` these instructions appear as rows of size 0B. Say this explicitly, otherwise the `history` output "will not match the stack".
3. `FROM alpine:3.20` → `alpine:3.22`, as in 04 §5.2.

### 26. MINOR — The loading budget does not include the documentation corpus or multi-machine mode

**Where:** §10.

Add the rows "Documentation corpus: up to 2 MB per block, on demand" (finding 9) and "v86 × N machines: guest memory N × 128 MB, tab ≤ 1.5 GB with 3 machines; one on a phone" (finding 18). Replace the row "Simulator core: per the simulator role's document" with a reference to 09 §1.3 with numbers.

### 27. MINOR — Sources

**Where:** §12, §1.

1. Remove the references to Julia Evans and howdns.works as models (§1, §12), or keep them marked "not as a style" — under R4 this is the opposite style. In the "Genre" section, keep Ciechanowski and Comeau as models for graphics, and Red Blob as a model for the "text ↔ diagram" link.
2. Add primary sources for the new topics: OCI Runtime Spec (`github.com/opencontainers/runtime-spec`), Kubernetes Networking Model (`kubernetes.io/docs/concepts/services-networking/`), Gateway API (`gateway-api.sigs.k8s.io`), Node Status (`kubernetes.io/docs/reference/node/node-status/`), EndpointSlice deprecation blog (2025-04-24), RFC 8446 §2 (TLS 1.3 message order), `time_namespaces(7)`, `user_namespaces(7)`, `systemd.service(5)` (`Restart=`), `systemd.unit(5)` (`StartLimitBurst`), RFC 5398 (AS numbers for documentation).
3. RU sources for mechanism scenes (§7.4): the R3 catalog does not have them yet. Extend the `ru_missing` rule to all rows of the catalog.

### 28. MINOR — The order of work (§11) needs to shift to accommodate R6

**Where:** §11.

Do 6.1a "How the kernel isolates and limits" (Linux block, v86) first, not "Inside a container". It exercises `ProcessModel`, `split`, `breakit`, gauges, the documentation ladder (step 2 on `man 7 namespaces`) and tests the main platform risk — a live diagram driven by the real kernel via `trainer-agent watch` (09 §1.4, phase 0 item 2). Second — the R10 reconciliation loop (kube-lite, no v86); third — `fabric` with two machines (R11).

---

## What I will fix on my side in 09 as a result of this review

This covers what depends on my decisions, so that the author of 08 does not have to wait: `NsKind` with `time`; comparison of `nspid` by the last element in the predicate language; the `/api/pair` path for the second screen; the `docs-coach` AI mode; the `doc.opened` event in the log; a JS switch instead of `inbrowser` for multi-machine labs (R11); and a single v86 on a phone with `deviceMemory ≥ 4`.
