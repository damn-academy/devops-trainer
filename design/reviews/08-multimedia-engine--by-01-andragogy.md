# Review of 08-multimedia-engine.md (reviewer: the andragogy specialist, the author of 01-andragogy.md)

Date: 18.11.2026. Version 1 of document 08 is under review. Cross-checked against 01, 03, 04, 05, 06, 07, 09 and the owner's requirements R1–R12.

## Verdict

As an engine, the document is strong. The primitives `stepper` with a pure fold over events, `diagram` with manual layout, `split`, `breakit` with a mandatory prediction, and the `SimEvent` bus provide exactly the mechanics R4 needs, and the port from Sankofa is done carefully: the modules and symbols (`decayAt`, `lensPane`, `FlashGate`, `data-develop`, QR up to version 10 and 213 bytes) really do exist in `sankofa-int/web/src`. In its current form the document cannot be accepted, for five reasons.

1. The visual language is built on ink, metaphors and characters, and R4 and R5 explicitly forbid them.
2. The four flagship storyboards repeat the interactives from 03, 04 and 05, contradict them and the concept graph from 01, and in places break the order of terms.
3. The content model (glossary, identifiers, levels, scene kinds, "running ahead") is incompatible with the format from 01 that 02–07 and 10 rely on.
4. The engine has not a single primitive for the documentation ladder (R2). Worse, the hints in 7.5 reveal the ready answer.
5. Per R6, "How the kernel isolates and limits" must be part of the Linux block, yet in 6.1 all of isolation is introduced in the Docker block.

In addition, R3 (process explainers in every block), R7 (container anatomy and the six boundaries), R8 (internet map and protocol catalog), R10 (controller in the browser), R11 (several nodes and a switch) and R12 (stage 3) are not covered. There are factual errors in the explainers themselves: the TLS 1.3 order, `dig +trace`, the 504 timeout, the node grace period, `docker save`. Below are 26 findings: 6 blocking, 13 major and 7 minor. Where content is missing, I have written ready text that can be pasted in.

A correction to my own document. Rule R9 in 01, section 8 ("ink only in hooks and on opening screens") is obsolete after requirement R5. I am removing it from 01, so it cannot be cited as permission for ink in 08.

---

## Findings

### 1. BLOCKING — Ink, metaphors and characters contradict R4/R5

**Where:** section 1 ("An explanation that draws by hand"), section 2 (the `ink.ts` and `layers.ts` rows), 5.1 "Two hands", 5.3 item 8 (neural-network art), scenes 0 in 6.1 ("a person in a room"), 6.2 ("a stack of tracing sheets"), 6.3 sc. 2 ("ink in the style of How DNS works", lines like "— I don't know, ask .com"), 6.4 sc. 1 ("ink: thermostat"), table 4 (`story` = "ink or diagram").

**What is wrong.** R4 requires only basic process animation, with no cartoons, characters, plot or decoration. R5 requires clean engineering graphics in the spirit of Ciechanowski and Comeau, "not Sankofa's ink drawings". From Sankofa we take the text presentation, scroll scenes, layers, calm mode, lenses, QR, bilingual YAML and draft/hold, but not the drawing. Server lines ("I don't know, ask…") are personification, that is, the same characters.

**Fix.**
- Remove the paragraph "An explanation that draws by hand" from section 1. Put a rule in its place: "A metaphor is allowed only in words, in one sentence of text. The drawing always shows the mechanism".
- In the section 2 table, change the `ink.ts` row to: "Not used. From `ink.ts` we take only the deterministic seeded random for layout jitter in tests and `data-fade` for node appearance". Delete item 5.3.8.
- Replace 5.1 with this text:

> **5.1. One hand: the blueprint.** All illustrations are an engineering blueprint: 1.5 px line, 6 px corner radius, 8 px grid, value labels in a monospace font. There are no raster drawings, characters, faces, hands or decorative backgrounds. Animation comes in five kinds: (1) an object moves along an edge (a packet, request, signal); (2) a node or layer appears or disappears (fade ≤ 200 ms); (3) a counter changes its number; (4) a gauge fills; (5) highlighting of the element being discussed. There are no other kinds of motion: no camera, no shaking, no particles, no "boiling" line. A metaphor is allowed as one sentence of text ("a port is a door number in a building"); it does not appear in the drawing.

- Rewrite scenes 0 as schematic hooks. Ready replacements below.
  - 6.1 sc. 0 "Two applications, one library". The diagram shows one host, two processes above the kernel, both referencing `libssl.so`; one needs version 1.1, the other 3. The toggle "upgrade libssl to 3" kills the first process (⨯ "version not found"). Question: how do you give each its own environment without buying a second server? Introduces the concept of isolation (D01/D06 in the graph).
  - Remove 6.2 sc. 0. The layer is introduced directly on `docker history`; one sentence of text about "transparent sheets" is enough. `layers.ts` stays, but draws SVG layer plates, not tracing sheets.
  - 6.3 sc. 2: arrows are labelled with protocol messages (`Q: A shop.example.com?` → `referral: NS a.gtld-servers.net`), and under each label there is a plain-language line for L0 ("the root server does not know the address, but knows who is responsible for .com").
  - 6.4 sc. 1: remove the thermostat and replace the scene with the reconciliation loop explainer from finding 15.
- Add a build rule to the validator (7.3): a scene with a `widget` in `mechanism`/`lab`/`check` cannot reference `art/*.webp`, and a diagram element `kind: character|illustration` is forbidden. The same rule will hit 07 (E1 "ink drawing", E2 "coffee shop", E8 "Vika and Elena") — notify the author of 07.

### 2. BLOCKING — The flagship storyboards duplicate 03/04/05 and contradict them

**Where:** all of section 6, section 11 ("we do "Inside a container" first").

**What is wrong.** Each of the four explainers already exists in the document of its block, and there it is more detailed and more accurate:

| 08 | Already exists | Discrepancies |
|---|---|---|
| 6.1 "Inside a container" | 04 §4 "What is inside a container", §6 "A container by hand in bash" | 04 introduces namespaces in D2, `chroot`/`pivot_root`/`veth`/capability in D3, the Docker daemon in D4. In 08 all of this is introduced in one lesson, and in a different order |
| 6.2 "How an image is packaged" | 04 §5 | In 04 the layer (14) and OverlayFS (15) come before the Dockerfile (19); in 08 the Dockerfile is in scene 1. In 04 the image is introduced in D4 via `docker run hello-world`; in 08 it is introduced anew in 6.2/1 |
| 6.3 "A URL in the browser" | 03 §7.1 (14 stages, waterfall, CDN, 9 breakages), 03 §7.2 "Envelopes" | In 03 OSI (N6) comes before DNS (N8) and the URL. In 08 the URL serves as the *introduction* to the network model, and OSI is assembled only in scene 10. TLS 1.3 is described correctly in 03 (`key_share`) and incorrectly in 08 (finding 11) |
| 6.4 "Kubernetes from blocks" | 05 §6.1 (consequences table, the `apply` path in 14 steps), §6.2 (reconciliation loop, your own controller), §6.4 (network) | In 08 etcd comes before the API, the pod before kubelet, ReplicaSet before labels (finding 10). Cluster networking in 08 is one "intermediate+" scene, in 05 it is five scenes |

When the same thing exists in two places, content divergence is guaranteed: lesson authors will not know which storyboard to follow.

**Fix.** Split the responsibility and write this at the beginning of section 6:

> **6.0. Who owns a storyboard.** The content of an explainer (scenes, terms, commands, checks) belongs to the block document: 02 — Linux, 03 — networks, 04 — containers, 05 — Kubernetes, 06 — CI/CD, IaC and monitoring, 07 — methodology. Document 08 owns the primitives, the explainer contract (section 3.12, see finding 8), the visual language and the **engine acceptance scenarios**. An acceptance scenario is a reference to the block's storyboard plus a list of what the engine must be able to do for it. Sections 6.1–6.4 are renamed to "Engine acceptance on the flagships" and reduced to tables "block scene → primitive → bus events → simulator commands → budget".

Move 08's good finds that are not in the block documents there via reviews: the `predict` "what will ps show inside", "break it: without a PID namespace", the build cache on two Dockerfiles, "re-point the `latest` tag", trap blocks in the constructor. Take the scene order everywhere from 01 §6.2 with the corrections from findings 5 and 10.

### 3. BLOCKING — The content model is incompatible with 01

**Where:** 4 (scene kinds, levels), 7.1–7.3 (glossary.yaml, `requires`, `introduces`, `allow_early`, rule 4).

**What is wrong.**

| What | 01 (and 02–07, 10) | 08 | Consequence |
|---|---|---|---|
| Concepts file | `content/concepts.yaml`, ids like `L17`, `K09`, a `forms` field (RU/EN regexes), `requires` (concept prerequisites) | `content/glossary.yaml`, ids like `pid-namespace`, a `stems` field | Two dictionaries; the validator will not be able to check the graph |
| Unit | screen `screens[]` with `introduces` ≤ 1 and `uses` | scene `scenes[]` with several `introduces`, `requires` for the whole lesson | 6.3/7 introduces 4 terms, 6.4/7 introduces 6. Rules R1 and R2 from 01 §8 are broken (≤ 1 per screen, ≤ 4 per lesson) |
| Levels | `L0`/`L1`/`L2` | `beginner`/`intermediate`/`experienced` | Key mismatch in progress and placement (10) |
| Early mentions | `forward: [K01]`, no more than one per lesson, with a "for now it is enough to know…" card | `allow_early: [cgroup]` with a reason, no limit | A loophole with no limit |
| Experienced | A concept counts as introduced in the `placed` state, only after the entry check (01 §2.2) | 7.3 item 4: in a scene collapsed for the experienced learner, the terms "are still considered introduced" | Choosing a level without a check unlocks the whole dictionary. Both the order and the AI context break |
| Kinds | `diagram, example, predict, sandbox, theory, task, exit` + anatomy steps "Hook…Review" | `story, mechanism, lab, check` | The steps "Explanation", "Exit ticket", "Review" cannot be expressed in 08 |

**Fix.** Adopt one schema. I propose this one: 01 provides the pedagogy data, 08 provides the widgets.

```yaml
# content/concepts.yaml — the single dictionary (format of 01 §6.1) + card fields from 08
- id: D03
  block: docker            # after R6 — linux, see finding 5
  name: { ru: "Пространство имён (namespace)", en: "Namespace" }
  forms: { ru: ["пространств(о|а|у|ом|е) имён"], en: ["\\bnamespaces?\\b"] }
  requires: [L27, N21]
  short: { ru: "Отдельная картина мира для процесса: свои PID, сеть, точки монтирования.", en: "..." }
  card:  { ru: "...", en: "..." }
  sources: [man-namespaces, habr-namespaces-ru]   # ids from sources.yaml (format of 08 §7.4)

# lessons/<id>/lesson.yaml — screens from 01, widgets from 08
screens:
  - id: s2
    kind: diagram          # screen kind from 01
    step: look             # anatomy step: hook|look|try|explain|practice|exit|review
    levels: [L0, L1]
    introduces: [D03]      # ≤ 1, build check
    uses: [L17, L27]
    forward: []            # ≤ 1 per lesson
    widgets:               # everything in 08 §3, unchanged
      - { widget: stepper, diagram: diagrams/ns-room.yaml, steps: sims/unshare-pid.steps.yaml, scroll: true }
```

Replace item 7.3.4 with: "Terms of a collapsed scene count as introduced only for concepts in the `placed` state or higher. If an experienced learner opened a lesson without a check, the collapsed scenes expand into "check yourself" cards (2 questions), and only after them does the concept get `placed`". The level names are `L0/L1/L2`. In the interface the labels "Новичок / Средний / Опытный" (Beginner / Intermediate / Experienced) stay.

### 4. BLOCKING — There is no documentation ladder (R2), and the hints reveal the answer

**Where:** 3.4 (terminal), 3.8, 3.10, 7.5 (`hints` with `reveals: true`), section 4 (lesson screen).

**What is wrong.** The engine has not a single primitive that would train the habit of reading documentation. The `sources` references in 7.4 serve the editorial report "How do we know this", not the learner. The hint ladder in 7.5 ends with the ready command (`unshare --pid --fork --mount-proc bash`, `reveals: true`). This contradicts 01 §14.2 (H1–H5, there is no ready solution on any step) and R2 (on step 2 the hint is a fragment of the man page, on step 4 there are no hints at all). The AI also has no "where did you look?" mechanism (3.10).

**Fix: three new primitives and a `doc_step` field.**

> **3.13. Documentation as a subject of study.**
>
> **`docref` (step 1, "glimpse").** A small source tag next to a command, flag, YAML field or output line: `man 1 ps · STANDARD FORMAT SPECIFIERS`, `kubernetes.io › Pods`. Optional; on hover it shows one line from the source. A click opens `docview` at the right place. On L0 the tag is grey and not distracting. The link source is `sources.yaml` with an anchor (`anchor: "STANDARD FORMAT SPECIFIERS"` or `#pod-lifecycle`).
>
> **`docview` (steps 2–5).** A side panel documentation reader that works offline. Formats: man page (pre-rendered from roff to HTML at build time, the version from the v86 image/golden recording), `--help` output, `kubectl explain <path>` (from the OpenAPI of the same kube-lite version), snapshots of docs.docker.com / kubernetes.io / developer.hashicorp.com / prometheus.io pages with the snapshot date. On the left is the "anatomy" of the page: NAME, SYNOPSIS, DESCRIPTION, OPTIONS, EXAMPLES, SEE ALSO for man; FIELDS for `kubectl explain`; headings for docs sites. There is search within the page. The `highlight` mode highlights one line and scrolls to it. The commands `man X`, `X --help` and `kubectl explain` in the terminal open the same panel (and print to the terminal, like the real ones). Every opening writes a `doc.open {source, anchor, via: 'terminal'|'docref'|'search'}` event to the bus, from where it gets into `doc_trail` for the AI and analytics.
>
> **`docexam` (step 5).** Exam mode: internet links are closed, only `docview` is available with the list of allowed sources for the block (as on the CKA, where kubernetes.io/docs and related sites are allowed). The AI is turned off (01 §14.1). Documentation openings are logged: this is not a penalty but material for the post-exam debrief ("you spent 6 minutes looking for `ndots`, here is where it is written").
>
> **The field `doc_step: 1..5`** on a task and a screen. By default the engine computes it: `doc_step = clamp(level_start + position_in_block, …)`, where `level_start` = 1 for L0, 2 for L1, 3 for L2 (the experienced learner starts at the third step per R2). The position in the block gives +1 in the second third of the block and +2 in the last. Step 4 "enforcement" is mandatory for all levels in the last third of every block: at least 2 tasks per block. Step 5 occurs only in block exams.
>
> | Step | What the engine draws | Hints (`hints`) | AI mentor |
> |---|---|---|---|
> | 1 | `docref` next to a new flag or field | H1–H5 from 01 §14.2 | The usual ladder |
> | 2 | H3 (concept) is replaced by `docview` with `highlight` on the needed line and a section label: "this is the OPTIONS section; flags here are always in alphabetical order" | H1, H2, **H3 = documentation fragment**, H4 | Explains how the page is structured, does not read the line for the learner |
> | 3 | Only a `docview` link to the page, without an anchor. The effect is checked | H1, H2, H3 = link to the page | May say *which page* to open, but not the section |
> | 4 | Nothing. The task requires a command or flag that was not in the theory | None | The first answer is always: "Where have you already looked? Which help commands did you run?" If `doc_trail` is empty, it names the tool (`man`, `--help`, `kubectl explain`, docs.docker.com) but not the page. If it is not empty, it says in which section of the opened page to look. It never names the flag |
> | 5 | `docexam` | None | Turned off |

Rework `hints` in 7.5: delete `reveals`, name the steps `H1…H5`, and for each specify the `doc_step` at which it is allowed. Bring `CheckResult.hintLevel` (09 §2.4) to 0–5.

**Ready tasks by step** (two per block, to be pasted into the block documents, checks per 09 §2):

| Block | Step | Task | Source | Check |
|---|---|---|---|---|
| Linux | 1 | `ps -o pid,ppid,cmd`: next to it, `docref` → `man 1 ps · STANDARD FORMAT SPECIFIERS` | man ps | — |
| Linux | 2 | "Show processes sorted by memory". H3 opens `ps(1)` with the `--sort spec` line highlighted | man ps | `output`: the first line of output is the `hog` process |
| Linux | 3 | "Find the `ls` flag that sorts by size and list `/var/log` from largest to smallest" | link to `ls(1)` | `output` matches the reference after normalization |
| Linux | 4 | "Find files in `/var` larger than 50 MB modified in the last 2 days and write their paths to `/tmp/big.txt`" (`-size`, `-mtime` were not covered) | — | `files['/tmp/big.txt'].sha256 = <reference>` |
| Linux | 4 | "Make `backup.service` restart no more than 3 times in 5 minutes" (`StartLimitBurst`, `StartLimitIntervalSec` were not covered) | — | `units[backup.service]` + `files[unit].text =~ 'StartLimitBurst=3'` |
| Networks | 2 | "Ask the server `@198.51.100.53` for the MX record only". H3 opens `dig(1)` with the SYNOPSIS `[@server] [name] [type]` highlighted | man dig | `history` contains `dig` and `output` contains `MX` |
| Networks | 4 | "Find out the path MTU to 203.0.113.80 without sending fragmented packets" (`ping -M do -s`, not covered) | — | `files['/tmp/mtu.txt'].text = 1400` |
| Containers | 3 | "Find the `docker run` flag that removes the container after it exits" | link to docs.docker.com › docker run | `containers[name=t]` is absent after exit and `history` contains this run |
| Containers | 4 | "Run a container so that its file system is read-only, except `/tmp`" (`--read-only`, `--tmpfs`) | — | `containers[name=ro].mounts` and `ReadonlyRootfs=true` |
| K8s | 2 | "Add a strategy to the Deployment under which there are never fewer than 3 ready pods during an update". H3 is `kubectl explain deployment.spec.strategy.rollingUpdate` with `maxUnavailable` highlighted | kubectl explain | `k8s.objects[kind=Deployment][metadata.name=web].spec.strategy.rollingUpdate.maxUnavailable=0` |
| K8s | 4 | "Spread 3 replicas across different nodes so that with 2 nodes the third waits instead of landing on an occupied one" (`topologySpreadConstraints` or anti-affinity, not covered) | — | pod 3 is `Pending` with `FailedScheduling`, ≤ 1 pod on each node |
| CI/CD | 4 | "Make the `deploy` job run only on a tag of the form `v*`" (`rules: if: $CI_COMMIT_TAG =~ …`) | — | `yaml_path` + a run on the `tag v1.2.0` event and on `push main` |
| IaC | 4 | "Do not let Terraform recreate the VM if only `user_data` changed" (`lifecycle { ignore_changes }`) | — | `plan_expect: no-replace` |
| Monitoring | 4 | "Compute the 95th percentile of latency per route over 5 minutes" (`histogram_quantile` not covered) | — | `promql_equiv` |
| All | 5 | Block exam: 20–30% of tasks are built on flags or fields outside the course | `docexam` | as usual |

For L0, steps 1–2 start no earlier than the lesson where L08 "Help: `man`, `--help`" is introduced. Before it, `docref` is not shown at all, because per R2 a beginner cannot be sent to the documentation from scratch.

### 5. BLOCKING — Kernel isolation must be in the Linux block (R6), but 6.1 introduces it in Docker

**Where:** 6.1 (scenes 2–7: namespaces, cgroups, chroot/pivot_root, capabilities, seccomp), the heading "Block: Docker…".

**What is wrong.** Per R6 the Linux block must have a section "How the kernel isolates and limits": process and thread, fork/exec, namespaces, cgroups v2 with an OOM drill, capabilities, mount/chroot/overlayfs, seccomp. The containers block should recognize the familiar, not introduce it. In 6.1 all of this is introduced anew in Docker, in one lesson and in a batch (scene 3 introduces six kinds of namespace at once).

On my side, I am moving the concepts in the 01 graph. New Linux ids: **L33** thread, `/proc/<pid>/task`, `ps -eLf`; **L34** fork/exec and lookup via `PATH`; **L35** namespaces (formerly D03), `unshare`, `nsenter`, `lsns`, `/proc/<pid>/ns`; **L36** cgroups v2 (formerly D04): `memory.max`, `cpu.max`, `pids.max`, OOM; **L37** capabilities: `capsh`, `getcap`/`setcap`; **L38** mount namespace, `chroot`, `pivot_root` (formerly D05); **L39** overlayfs by hand (part of D09); **L40** seccomp as an idea. N21 will require L35. D06 "container = process + …" requires L35–L38 and becomes the first concept of the Docker block.

**Fix.** Move the 6.1 storyboard into 02 as an engine acceptance scenario for Linux. Below is a ready skeleton (screens in the 01 format, `introduces` ≤ 1):

> **Linux, module "How the kernel isolates and limits".** Tier B (`lab-alpine`, 09 §1.4), with a recorded mode for phones.
>
> 1. **Process and thread** (`diagram` → `sandbox`, introduces L33). Diagram: a process rectangle (PID 4127, its own memory), inside it three "threads" with LWP 4127/4128/4129 over shared memory. A "threads" slider 1–8 for the training program `/opt/lab/threads N`: the number of threads grows, the PID does not change, `NLWP` in the table grows. Commands: `ps -eLf | grep threads` (labels of the `LWP`, `NLWP` columns on the lines to the threads), `ls /proc/<pid>/task`. "Break it": `kill -9` on the LWP of one thread kills the whole process (prediction before running).
> 2. **fork and exec** (`stepper`, introduces L34). Steps: bash reads the line `ls` → looks for the file in the `PATH` directories from left to right (the directories light up in turn, ✓ on the third) → `fork()`: a copy of bash appears with a new PID → `execve("/bin/ls")`: the contents of the copy are replaced, the PID stays the same → `exit(0)` → `wait()`, the parent receives the exit code (link to L19). Slider: the order of directories in `PATH`; if you put `/tmp/evil` first, a fake `ls` is invoked (the output of `which ls` changes immediately). "Break it": remove `/usr/bin` from `PATH` → `command not found`, but `/usr/bin/ls` works.
> 3. **Namespaces** (introduces L35; one screen per kind). Screen 3a, PID: `unshare --pid --fork --mount-proc sh` → a frame around sh; the "inside / from the host" switch shows 1 / 4127. `ls -l /proc/$$/ns` shows **10 links** on a 6.x kernel: cgroup, ipc, mnt, net, pid, pid_for_children, time, time_for_children, user, uts. The numbers in `[...]` match the frame labels. `lsns -t pid`. `nsenter -t 4127 -p -m ps` from the host: "enter someone else's room". Screens 3b–3d: uts (`hostname` inside), net (only `lo` inside, and it is DOWN), mnt (its own `mount`); user — on L1+ (`unshare --user --map-root-user id` shows `uid=0(root)`, while from the host `/proc/<pid>/status` shows the learner's uid, for example 1000; `cat /proc/<pid>/uid_map` → `0 1000 1`). A `match` check: kind ↔ what it isolates (8 kinds, including time and cgroup as "they exist, we do not go deep").
> 4. **cgroups v2: memory limit** (introduces L36). Preparation (on L0, in a worked example): `mkdir /sys/fs/cgroup/demo`, `echo +memory +pids +cpu > /sys/fs/cgroup/cgroup.subtree_control`. A `memory.current` gauge with a `memory.max` mark. A `memory.max` slider 16–256 MB, a slider "how much `/opt/lab/eat` consumes" 0–300 MB. On crossing: the process ⨯ "OOM-kill", `memory.events` → `oom_kill 1`, a `dmesg` line: `Memory cgroup out of memory: Killed process … (eat)`. **OOM drill (S5):** a service crashes every 2 minutes with exit code 137; find the cause via `memory.events` and `dmesg`, raise the limit. Check per 09: `cgroups[procs~@pid(eat)].memory.max>=128M && cgroups[...].memory.events.oom_kill=@start`.
> 5. **cpu.max and pids.max** (no new concepts, L36 practice). `echo "50000 100000" > cpu.max` — half a CPU; the `nr_throttled` counter in `cpu.stat` grows, `top` shows ~50%. `echo 20 > pids.max` and a fork bomb in a training wrapper: the 21st fork → `Resource temporarily unavailable`, the host is alive.
> 6. **Capabilities** (introduces L37). The training binary `/opt/lab/bindport 80` run by a regular user → `Permission denied`. `sudo setcap cap_net_bind_service=+ep /opt/lab/bindport` → it listens. `getcap /opt/lab/bindport`; `capsh --print` for root and for the user: the "key ring" as a list of lines, the key is highlighted on the diagram. Prediction: "do you need root to listen on port 80?"
> 7. **Your own root** (introduces L38). `chroot /srv/rootfs /bin/sh` → diagram: the FS tree, the process root is moved to a branch. "Break it" (L1+): escaping chroot as root via a second `chroot` and `..`. Explanation of why `pivot_root` is used in a mount namespace. Introduced only at the level of "this is how runtimes do it", with no mandatory practice on L0.
> 8. **overlayfs by hand** (introduces L39). `mount -t overlay overlay -o lowerdir=/l/top:/l/base,upperdir=/u,workdir=/w /merged`. Label on the diagram: "in `lowerdir` the leftmost is the top". Editing a file from `base` → copy-up into `/u`; `rm` → a whiteout appears in `/u` (`c 0 0` in `ls -l`).
> 9. **seccomp as an idea** (introduces L40). `grep Seccomp /proc/self/status` → `0`. Explanation: a filter at the entry of a system call, a grille on the syscall arrow in the diagram. No practice; in Docker it will come back as `Seccomp: 2`.
> 10. **Exit ticket:** "Run an `sh` that does not see the host's processes, has its own hostname and cannot take more than 64 MB" — `procs[cmd=sh][ns.pid!=@host.ns.pid][nspid~1] && procs[cmd=sh].ns.uts!=@host.ns.uts && cgroups[procs~@pid(sh)].memory.max<=64M`.

Scene 6.1/8 "Container or VM" and 6.1/9 "Assemble it in bash" stay in the containers block (04 §6), but are phrased as "assemble from what you know": there are no new concepts there except veth (already N20) and runtime.

### 6. BLOCKING — The URL explainer serves as the introduction to networking, while R8 requires the order "from the big picture to the packet"

**Where:** 6.3, the introductory paragraph ("OSI is not given as a table upfront… in scene 9 they are assembled into a model"), sc. 10.

**What is wrong.** R8 sets the order: (1) the internet map, (2) OSI and TCP/IP as nested envelopes, OSI as a vocabulary, (3) each layer by hand, (4) end-to-end processes (URL, 504). The same order is set by the 01 graph (N07 comes before N16, N16 requires N15) and by 03 (N6 "Envelopes" comes before N8 DNS). In 08 the URL comes first and the model last. In addition, the R8 principle "every network problem is tied to a layer; first ask which layer is broken" is not expressed in any primitive in 08.

**Fix.** The URL explainer moves to the end of the block and becomes review rather than introduction (as in 03 §7.1). To every "break it" and every troubleshooting task the engine adds a mandatory first step:

> **`layerq` (the question "which layer is broken").** Before any "break it" and any troubleshooting task in networking and in Kubernetes networking, the learner chooses a layer: L1/L2/L3/L4/TLS/L7 (on L0, in plain words: "wire and neighbours / address and route / port and connection / encryption / the request itself"). Only after that do the terminal and hints open. The answer is recorded separately (metacognition, 01 §12.1) and is not penalized. The debrief shows at which layer the cause was and which command proves it. Data field: `layer: L3` on every `breakit` breakage.

The internet map and envelopes are in finding 13.

### 7. MAJOR — There is no catalog of process explainers across all blocks (R3)

**Where:** section 6 (4 explainers), section 11.

**What is wrong.** Per R3, process explainers are needed in *every* block. The engine must know the full list to plan primitives, bus events and budgets. Right now 08 has only four flagships.

**Fix.** Add a section "6.5. Explainer catalog" (content owner — the block, engine — 08). I checked the status against documents 02–07.

| Block | Explainer | Model (knobs) | "Break it" | Primitives | Storyboard exists? |
|---|---|---|---|---|---|
| Methodology | A task from idea to production | a queue at each stage, WIP limit | remove automated tests → defects in production | stepper, knob, counter | partly 07 E5; rewrite without characters |
| Methodology | Incident: alert → on-call → rollback → postmortem | response time, whether a runbook exists | no alert (empty lens) | stepper, lenses | 07 E11 (lenses); add a timeline |
| Methodology | Flow bottleneck | station throughput, batch size | — | knob, gauge | 07 E4 (rewrite without character cubes) |
| Linux | Boot: firmware → bootloader → kernel → initramfs → systemd → targets | — | broken `fstab` → emergency mode | stepper | 02 §6.7 |
| Linux | fork/exec and `PATH` | `PATH` order | remove a directory | stepper, knob | **no** → finding 5, screen 2 |
| Linux | Pipeline `a | b`: two processes, pipe buffer | buffer size, reader speed | reader died → SIGPIPE | stepper, gauge | 02 §6.5 (remove "plumbing" as a drawing) |
| Linux | systemd restarts a crashed service | `Restart=`, `RestartSec`, `StartLimitBurst` | `Restart=no` | stepper, knob, counter | **no**, add to 02 |
| Linux | Isolation and limits | see finding 5 | | | **no** → finding 5 |
| Networks | Internet map (zoom) | see finding 13 | BGP withdrawal | zoommap | **no** |
| Networks | TCP/IP envelopes with real fields | MTU, tunnel | MTU < size | packets | 03 §7.2 |
| Networks | DNS resolution | TTL, cache | NXDOMAIN, SERVFAIL | stepper, knob | 03 §7.1 stages 2–3 |
| Networks | TCP + TLS 1.3 handshake | RTT, TCP window, loss | RST, DROP, expired certificate | sequence, knob | 03 §7.1 stages 6–7 |
| Networks | A packet through NAT and a router | rules, translation table | no route | packets | 03 §7.1 stage 5 |
| Networks | Where 504 comes from | `proxy_read_timeout`, DB response time | DB 90 s | stepper, knob | 03 §7.1 + 08 6.3/9 |
| Containers | `docker run`: CLI → dockerd → containerd → shim → runc → process | — | kill dockerd | stepper, lenses | 04 D10 "Rashomon" (briefly) → finding 12 |
| Containers | `docker build` layer by layer with cache | which line changed | `COPY . .` before `npm ci` | stepper, layers | 08 6.2/6 → move to 04 §5 |
| Containers | `pull` by manifest | amd64/arm64 platform | no platform → `no matching manifest` | stepper | 04 §5 (extend) |
| Containers | Hardware → VM → containers → nesting | see finding 12 | kernel vulnerability | towers | 04 §4.6 (briefly) |
| K8s | `kubectl apply` through all components | — | remove a component | constructor, stepper | 05 §6.1 screen 4 |
| K8s | Pod scheduling | requests, taints | no resources | knob, gauge | 05 §6.5 |
| K8s | Rolling update | maxSurge, maxUnavailable | bad image | knob, stepper | 05 §6.5 |
| K8s | Node failure | grace, tolerationSeconds | — | stepper, multinode | 05 §6.1 (extend, finding 18) |
| K8s | A request via Ingress → Service → kube-proxy → pod | number of replicas, iptables/IPVS/eBPF mode | selector, targetPort, NetworkPolicy | packets, ruletrace | 05 §6.4 |
| K8s | Reconciliation loop | see finding 15 | | reconcile, code | 05 §6.2 |
| CI/CD | `git push` → pipeline → image → deploy | runners, cache | test failure, missing secret | stepper | 06 A-I1 |
| IaC | `terraform plan/apply` + state | code change, manual edit | drift, state loss | stepper, threecol | 06 B2-I1, B2-I7 |
| IaC | Idempotent Ansible run | run no. 1, 2, 3 | `shell` without `creates` | grid | 06 B1-I4 |
| Monitoring | scrape → TSDB → PromQL → rule → Alertmanager → notification | scrape interval, `for` | target unreachable | stepper, knob | 06 C-I3 + C-I9 (merge into one end-to-end explainer) |

Build rule: each block has at least one `mechanism` explainer per module, otherwise a warning in the editorial report.

### 8. MAJOR — There is no common "parameter → recompute → explanation of the difference" primitive (R4)

**Where:** 3.1, 3.2, 3.5.

**What is wrong.** R4 requires sliders and toggles (replicas, memory limit, TTL, TCP window) to recompute the process immediately and explain next to it what changed. In 08 sliders appear in individual scenes, but there is no contract: it is unclear who computes the new process (the YAML scenario is static), how the stepper keeps its position and where the "what changed" text comes from.

**Fix.** Add section 3.12:

```ts
// engine/explainer.ts — process explainer contract
interface ExplainerModel<P extends Record<string, number | boolean | string>> {
  params: ParamSpec<P>[];                 // sliders and toggles: id, min/max/step | options, units, default
  breaks: BreakSpec[];                    // "break it": id, layer?, predict question
  run(p: P, broken: ReadonlySet<string>): Step[];   // pure function: same input → same steps (Vitest)
  delta(prev: Step[], next: Step[], changed: keyof P | string): Bi;   // "what changed and why" text
}
interface Step { id: string; events: SimEvent[]; caption: Bi; metrics?: Record<string, number> }
```

Behaviour:
- When a knob changes, the engine calls `run` and looks for a step with the same `id` in the new list. If the step has disappeared, it moves to the nearest preceding one.
- Under the diagram a "What changed" plate appears with the `delta` text and the metric difference: "TTL 30 s → cache expired: +3 queries to the root, TLD and authoritative, +84 ms".
- Recompute and redraw fit within 100 ms (the rule from section 1).
- The model is the same pure arithmetic as `decayAt`. Where the behaviour comes from a simulator (dsim, kube-lite), `run` runs the scenario in a copy of the simulator with the parameters.

Style rules for the validator (R4, "one screen — one idea"):
- no more than 12 nodes in a diagram;
- every edge must have a label (`label`), otherwise the build fails. This is already promised in 5.3 item 4, but not checked;
- every node must have an `explain` card ("what it is, who creates it, which command shows it");
- one stepper per scene.

Limit continuous playback in 3.1 to 5 seconds in a row (01 §8, rule R8), then pause until a click. Keep the 0.25× and 4× speeds.

### 9. MAJOR — The palette is overloaded, colours coincide in meaning, the fonts are not "magazine-like" (R5)

**Where:** 5.2.

**What is wrong.**
- **Collisions.** `--c-limit` `#B91C1C` = `--c-err` `#B91C1C`. TLS `#A16207` = `--c-warn` `#A16207`. There are four greens: L4 `#047857`, `--c-ok` `#15803D`, `--c-node` `#166534`, ns-uts `#4D7C0F`. There are two oranges: ns-pid `#C2410C` and `--c-obj` `#9A3412`. With such a set, "colour carries meaning" (R5) is not satisfied: the learner will not tell L4 from "success".
- **Overload.** 7 namespace shades + 5 network layers + 3 k8s colours + 3 states — about 20 tones. For a teaching diagram this is extraneous load: one screen should have no more than 4–5 meaningful colours.
- **Fonts.** R5 requires Sankofa's magazine-style text presentation. Sankofa sets text in Literata/Fraunces (display) and Inter (UI), while 08 introduces IBM Plex Sans.

**Fix.** Colour encodes the *family*, and a shade within a family distinguishes elements only together with shape and label:

| Family | Tone | Where | Distinguished within the family by |
|---|---|---|---|
| Kernel / kernel space | indigo | Linux, containers | — |
| User space | warm grey (paper) | Linux, containers | — |
| Isolation (namespaces) | a single tone — plum | frames | **stroke and a tab label** (`pid`, `net`…), not colour |
| Network | a blue-teal scale of 4 lightness steps: L2 lightest, L7 darkest | envelopes | lightness + flap label |
| Control plane | deep blue | k8s | shape: hexagon |
| Node and agents | olive | k8s | shape: rack |
| API objects | ochre | k8s | shape: document |
| State | ok — green, err — red, warn — amber | statuses only | ✓ ⨯ ! |
| Limit | **not red**: a dark grey mark on the gauge. The gauge turns red only when exceeded (that is already the err state) | cgroups, quota | — |

Reserve green, red and amber for state only. Do not give them to a layer or component. Add a CI test: family tokens are distinguishable by ΔE2000 ≥ 15 from each other and from the state tokens in both themes.

Fonts: headings and long text — Literata (it has Cyrillic, as in Sankofa), interface and node labels — Inter, values, code and terminal — IBM Plex Mono or JetBrains Mono (both have full Cyrillic). Terminal: a theme from the same tokens, no neon green on black; prompt, paths, errors and the highlighted key line (01 §8, rule R14) — four colours, no more.

### 10. MAJOR — Violations of term order inside the storyboards

**Where:** 6.1–6.4 (if the storyboards remain at least as acceptance, the order must be fixed).

| Place | Violation | Fix |
|---|---|---|
| 6.4 sc. 2 → 3 | etcd is introduced before the API server, while K06 requires K04 | First "one door" (API, object), then "where the API stores it" (etcd) |
| 6.4 sc. 4 → 5 | The pod is introduced before kubelet, while K09 requires K08. The scheduler (K07) requires only K01, K04, and at this point there are no "pods without a node" yet | Order per 01: API → etcd → scheduler (schedules a "unit of work"; the term "pod" is not yet introduced) → kubelet and runtime → **pod** |
| 6.4 sc. 6 → 7 | ReplicaSet (K11) requires labels (K10), and labels are introduced in sc. 7 | Labels and selector are introduced before sc. 6 on a separate screen |
| 6.4 sc. 7 | 6 concepts in one scene | Split into 4 screens: labels → Service/ClusterIP → kube-proxy → CoreDNS |
| 6.3 sc. 1 | HSTS before TLS/HTTPS (sc. 7) | HSTS moves to the TLS scene or to the review |
| 6.3 sc. 2, 4, 5 | "Router" and "gateway" are used in sc. 2 and 5, while "router" and L3 are introduced retroactively in sc. 6 | The gateway and route are introduced in their own module (N03) before the URL |
| 6.3 sc. 0 | The example `https://…` and "443" appear before the port (sc. 3) | Solved by moving the URL to the end of the block (finding 6) |
| 6.2 sc. 4 → 8 | Manifest and digest (D19) come before the registry (D18) | First the registry and tag, then the manifest (as in 01) |
| 6.2 "Requires" | tar and hash "are introduced here if not already introduced", but these are L29, L30 from Linux | Move them to `uses`. A second introduction is forbidden by rule 7.3 item 2 of 08 itself |
| 6.2 sc. 1 | "Image" is introduced anew, although in 04 it is introduced in D4 via `docker run` | Take it from 04 |
| 6.1 sc. 8 | VM and hypervisor (D02) are not introduced anywhere | D02 is a separate screen before the comparison (finding 12) |
| 6.1 sc. 9 | `docker run` before D10/D11 | Either `forward: [D11]`, or the scene goes after the lifecycle |
| 3.10 / 7.2 `ai_context` | The list of forbidden words ("Do not use: cgroup, image, pod") is a blacklist, while 01 §14.4 passes a whitelist (`known_concepts`) | See finding 16 |

### 11. MAJOR — Factual errors in the explainers

**Where:** 6.1–6.4, 3.6.

Errors that teach a wrong model:

| Place | Error | Correct version |
|---|---|---|
| 6.3 sc. 7 | TLS 1.3 is shown as "ServerHello + certificate → chain verification → shared key → Finished". This is the TLS 1.2 order | In TLS 1.3 the shared key is derived immediately from `key_share` in ClientHello/ServerHello. Everything after ServerHello (EncryptedExtensions, **Certificate**, CertificateVerify, Finished) is already encrypted (RFC 8446 §2). Steps: ClientHello (`supported_versions`, `key_share`, SNI, ALPN) → ServerHello (`key_share`) → [encrypted] EncryptedExtensions, Certificate, CertificateVerify, Finished → the client verifies the chain and the signature → the client's Finished. Hence for the "ISP lens": in 1.3 the certificate is not visible on the wire |
| 6.3 sc. 2 | "The output of `dig +trace` matches the arrows line by line" of the ISP resolver | `+trace` performs the iteration **by the client itself** from the root; the ISP resolver does not take part in it (only the list of root NS is taken from the resolver). Two different animations are needed: "how a recursive resolver walks" (plain `dig`, the answer from cache or after the walk) and "what `dig +trace` does" (the same walk, but from the laptop) |
| 6.3 sc. 9 | "nginx waits for the upstream for 30 seconds and returns 504" | `proxy_read_timeout` defaults to 60 s. Make it a knob (R4): `proxy_read_timeout` 5–120 s and "DB response time" 1–120 s; 504 appears exactly when `db > timeout` |
| 6.4 sc. 5 | "NotReady after ~40 seconds" | `node-monitor-grace-period` defaults to 50 s since Kubernetes 1.32 (in the code: "default value of 50 seconds"). Eviction happens via `tolerationSeconds: 300` of the `not-ready`/`unreachable` taints. And "pods move" does not mean moving: the ReplicaSet creates **new** pods on other nodes, while the old ones hang in `Terminating` until the node comes back or they are force-deleted. This must be shown, otherwise the learner will not understand StatefulSet behaviour |
| 6.1 sc. 3 | "Seven kinds" of namespaces, "`ls -l /proc/$$/ns` shows seven links" | There are 8 kinds (there is also time, since Linux 5.6). On a 6.x kernel there are 10 links: `pid_for_children` and `time_for_children` are added |
| 6.1 sc. 3 | user ns: "from the host the same process is uid 100000" | With `unshare --user --map-root-user`, root inside is mapped to the uid of whoever launched it (for example, 1000; `uid_map` = `0 1000 1`). 100000 is the subuid range for rootless/userns-remap, which is a different case |
| 6.2 sc. 2 | `tar -tzf blobs/sha256/<layer>` | In `docker save` (Docker 25+, OCI layout format) the layers are stored as **uncompressed** tar; the `-z` flag will give an error. `tar -tf` is needed. Layers are compressed (gzip/zstd) in a registry, so a layer's digest in the registry ≠ the `diff_id` in the config: this is worth showing in the manifest scene |
| 6.2 sc. 4 | `cat manifest.json | jq` as "the OCI manifest" | `manifest.json` in a `docker save` archive is the legacy Docker format (Config/RepoTags/Layers). The OCI manifest is in `blobs/sha256/…`, and the reference to it is in `index.json`. The chain for the learner: `jq . index.json` → manifest digest → `jq . blobs/sha256/<digest>` |

Minor inaccuracies (one edit each):
- 6.2 sc. 1: "a 6-line Dockerfile", but 5 are listed. In Alpine the `nginx` package serves static files from `/var/lib/nginx/html`, while `/usr/share/nginx/html` is the path of the official `nginx` image. Either `FROM nginx:1.27-alpine` + `COPY site/ /usr/share/nginx/html`, or change the path.
- 6.1 sc. 5: `stress` needs `--vm 1 --vm-bytes 150M`. Before writing to `memory.max`, `mkdir` and `+memory` in the parent's `cgroup.subtree_control` are needed. Without this the learner in v86 will get `No such file or directory`.
- 6.4, commands: since 1.33, `kubectl get endpoints` prints a deprecation warning for the Endpoints API. Teach `kubectl get endpointslices -l kubernetes.io/service-name=web`.
- 3.6: the example `dst 93.184.215.14` is a real address, while 5.3 item 5 requires documentation ranges. Use `203.0.113.10`.
- 12: the link `https://howdns.works/` redirects to `dnsimple.com/comics/how-dns-works/`. This is a DNSimple comic, not Julia Evans's (she has the zine "How DNS Works" and messwithdns.net). The sources need to be separated. The link to the container2wasm write-up on Medium returns 403 to automated clients — check it manually or replace it with the repository README.

### 12. MAJOR — Container anatomy, the six boundaries and "hardware → VM → containers → nesting" (R7)

**Where:** 6.1 sc. 8–9. The rest is absent from 08.

**What is wrong.** Of R7, 08 lacks: the OCI bundle (`rootfs` + `config.json`), the runtime chain, lifecycle states, the six boundaries with drills, and the full "hardware → VM → containers → nesting" explainer with towers, a slider, a vulnerability toggle, counters and practice on v86. Scene 8 gives two diagrams and lenses, but without nesting, without the kernel vulnerability and without measurements.

**Fix.** Ready storyboards for 04 (engine: `towers`, `stepper`, `breakit`, `split`).

> **A. "Hardware → VM → containers → how it is today"** (`towers`, introduces D02 on the first screen, D07 on the last).
> Screen 1. One tower: hardware → kernel → 3 applications. Counters: "hardware utilization", "application start time", "memory used". A "number of applications" slider 1–50: at 1, hardware utilization is ~10%, and that is the motivation.
> Screen 2 (introduces D02). Two towers side by side: on the left "on bare metal", on the right "VM": hardware → hypervisor → N × (guest kernel → application). Same slider. On the right, a "guest kernel" layer with memory is added for each copy. Counters are computed by a model with parameters from `sources` (`hold: true` until checked on a test bench): VM start — seconds to tens of seconds, memory overhead — tens to hundreds of MB per guest.
> Screen 3. The right tower changes to "containers": hardware → kernel → N frames. The start counter drops to fractions of a second, memory barely grows.
> Screen 4. A "kernel vulnerability" toggle. On the left (containers), the **shared** kernel turns red, and ⨯ is on all frames. On the right (VM), one guest kernel, the neighbours are intact, and the hypervisor remains under attack (a thin strip labelled "the attack surface is smaller, but it exists"). Prediction before switching on.
> Screen 5 (introduces D07). "How it is today": three ready stacks, toggled between: (a) containers in a cloud VM: hardware → hypervisor → guest kernel → containerd → pods; (b) Kubernetes on bare metal; (c) VMs inside Kubernetes (KubeVirt; this is how Cozystack works): hardware → kernel → kubelet → pod → QEMU/KVM → guest kernel → application. A click on each layer opens a "who manages this layer" card.
> Screen 6 (practice, tier B). "You are inside a VM right now": `dmesg | head -30` in `lab-alpine`. The learner finds signs of emulated hardware: BIOS lines, the ne2k network card model, the disk. The exact lines are fixed by the `dt-kernel` golden recording; until then the scene is `hold`. Then `uname -r` and `ps` outside and inside `crun run demo`: one kernel, different processes. Then a measurement: `time crun run demo true` versus the "boot a second VM" button (the engine measures the time until the `TRAINER_READY` marker). A table of the two numbers is built on screen.
> An `explain` check by rubric: shared kernel; namespaces/cgroups isolation versus a separate kernel; start time and density; where the security boundary is.

> **B. Anatomy: the OCI bundle and the runtime chain** (introduces D10; states are auxiliary).
> Screen 1. `mkdir -p demo/rootfs && tar -xf alpine-minirootfs.tar.gz -C demo/rootfs && cd demo && crun spec`. Diagram: the bundle folder = `rootfs/` + `config.json`. A click on the `config.json` fields (`process.args`, `root.path`, `linux.namespaces`, `linux.resources.memory.limit`) highlights which Linux concept from L35–L38 it turns on. The link "you have already done this by hand".
> Screen 2. `crun run demo` → `crun list` / `crun state demo`. OCI state diagram: `creating → created → running → stopped`.
> Screen 3 (`stepper` + lenses). `docker run nginx` step by step: docker CLI (HTTP to `/var/run/docker.sock`) → dockerd (image, network, volumes) → containerd (gRPC) → containerd-shim-runc-v2 → runc/crun (creates namespaces and cgroup, does `execve`, exits) → the nginx process, whose parent is the shim. Edge labels: protocol and verb. `ps -ef --forest` in v86 confirms the parent. "Rashomon" lenses: what each component sees.
> Screen 4. Docker states: created, running, paused, restarting, exited, dead. A "restart policy" knob (`no`, `on-failure:3`, `always`) and a "the process crashed with code 1" button: the diagram shows who restarts it (dockerd, not the kernel).

> **C. The six boundaries of a container** (one diagram for the whole module, the container in the centre, six boundary sides; each opens with its own screen and its own drill).
>
> | Boundary | What the diagram shows | Knob / "break it" | Drill "the container does not work" (S5) | Check (09 §2) |
> |---|---|---|---|---|
> | Host kernel | the shared kernel at the bottom, `uname -r` is the same | the container asks for a kernel module or sysctl that is not there | The application crashes with `Operation not permitted` on `sysctl -w net.core.somaxconn` | the learner explains (`choice`) and runs with an allowed namespaced sysctl `--sysctl net.core.somaxconn=1024`: `containers[name=app][state=running]` |
> | Network | veth → `docker0` → NAT outward; `-p 8080:80` as a DNAT rule in `iptables -t nat -L DOCKER -n`; the built-in DNS `127.0.0.11` in a user-defined network; `host`/`none` modes | a `-p` toggle, a "own network / default bridge" toggle | `curl app` from a neighbouring container: `Could not resolve host` (both in the default bridge, where there is no DNS by name) | `containers[name=web].networks~'appnet' && http.web.status=200` |
> | Storage | lower layers, upper (ephemeral), volume, bind, tmpfs | `docker rm` → upper is gone, the volume remains | "The DB data disappeared after re-creation" | `containers[name=db].mounts[type=volume][destination=/var/lib/postgresql/data]` |
> | Process and signals | PID 1 in the container; `docker stop` → SIGTERM → 10 s → SIGKILL; zombies; `--init` (tini) | a `--stop-timeout` knob; a shell-form / exec-form `CMD` toggle | "The container takes exactly 10 seconds to stop and exits with code 137": CMD in shell form, `sh` does not forward SIGTERM | `containers[name=app].exitCode=143` or `=0` after `docker stop`, stop time < 2 s (a fact from the `proc.exit` event with `reason: signal`) |
> | I/O and logs | the process's stdout/stderr → the `json-file` logging driver → `docker logs` | the application writes to a file instead of stdout | "`docker logs` is empty, but the application is running" | `history` contains `docker logs app`, and the log has a marker line after the config fix |
> | Configuration and identity | env, secrets (as a file, not a variable), UID inside and outside, userns, permissions on a bind mount | `--user 1000:1000`, `:ro` | "The application cannot write to the mounted directory: `Permission denied`" (on the host the owner is root, in the container uid 1000) | `files['/srv/data/out.txt'].exists && containers[name=app].state=running` without `--privileged` (`forbid`) |
>
> Before each drill — the `layerq` question in its container version: "at which boundary is the cause?" (finding 6).

### 13. MAJOR — There is no internet map, no envelopes with fields and no protocol catalog (R8)

**Where:** 3.6 (there is a packet animator, the rest is missing).

**Fix: two primitives and one storyboard.**

> **`zoommap` — a zoomable diagram.** Nodes with a level of detail `zoom: 1..5`; when zooming in, a node expands into a nested diagram (semantic zoom, with no cartographic base layer: submarine cables are schematic lines with labels, not a world map). Mouse wheel, pinch gesture and "+/−" buttons, keyboard `+`/`-`, breadcrumbs "Internet › ISP › Home".
>
> **Storyboard "How the internet works"** (03, the module before N1; new concepts in the 01 graph — N22 "autonomous system and BGP", N23 "IXP and CDN"; root DNS servers — in N08).
> Zoom 1. A laptop and a home router (Wi-Fi, cable). Labels on the lines: "Wi-Fi", "Ethernet".
> Zoom 2. The ISP access network: fibre/DSL to the node, CGNAT (`100.64.0.0/10`, RFC 6598) — a toggle "I have a public address / CGNAT".
> Zoom 3. The ISP as an autonomous system: the AS number on the frame; interconnections: transit (we pay) and peering at an IXP (exchange for free). A "via IXP / via transit" toggle changes the path and the latency counter.
> Zoom 4. The backbone and submarine cables between regions (as a diagram), a data centre with a CDN node. A "where the user is" knob → the nearest CDN node.
> Zoom 5. Root DNS servers: 13 names `a`–`m.root-servers.net`, each is anycast, hundreds of instances (the number is taken from root-servers.org on the check date, `hold`).
> "Break it": an AS withdraws its BGP routes, and the paths to its addresses disappear from all arrows (a real example is the Facebook outage of 4.10.2021, `sources` with a write-up). Prediction: "does this company's DNS work?"
> Practice: `traceroute`/`tracepath` to training addresses in netlab (tier A is enough). **Note for 09:** only TCP streams go through the Wisp relay (09 §1.6), so a real `traceroute` (UDP/ICMP) from v86 to the internet does not work. The real path is only via a recording or at the own-machine stage. `docref` to bgp.tools / RIPEstat — step 1.
>
> **`protocard` — protocol card** (a single format per R8, rendered by the built-in `stepper` as a sequence diagram):
>
> ```yaml
> # content/protocols/dns.yaml
> id: dns
> level: L0                # L0 | L1 | L2 → when it opens in the catalog
> concept: N08
> name: { ru: "DNS", en: "DNS" }
> why:  { ru: "Превращает имя в адрес, чтобы людям не помнить IP", en: "..." }
> layer: L7                # plus transport
> transport: [ "udp/53", "tcp/53", "tls/853 (DoT)", "https/443 (DoH)" ]
> sequence:                # actors and messages → sequence diagram in stepper
>   actors: [client, resolver, root, tld, auth]
>   steps:
>     - { from: client, to: resolver, msg: "Q A shop.example.com RD=1" }
>     - { from: resolver, to: root, msg: "Q A shop.example.com" }
>     - { from: root, to: resolver, msg: "referral NS a.gtld-servers.net" }
>     - { from: resolver, to: tld, msg: "Q A shop.example.com" }
>     - { from: tld, to: resolver, msg: "referral NS ns1.example.com" }
>     - { from: resolver, to: auth, msg: "Q A shop.example.com" }
>     - { from: auth, to: resolver, msg: "A 203.0.113.10 TTL 300 AA" }
>     - { from: resolver, to: client, msg: "A 203.0.113.10 TTL 300" }
> params: [ { id: ttl, min: 0, max: 86400, default: 300 }, { id: cached, type: bool } ]
> observe:                 # how to observe
>   - { cmd: "dig shop.example.com", note: { ru: "ответ резолвера; смотри ANSWER и Query time" } }
>   - { cmd: "dig +trace shop.example.com", note: { ru: "обход делает сам dig, а не резолвер" } }
>   - { cmd: "tcpdump -n -i eth0 port 53" }
> breaks:                  # how it breaks: symptom → cause → command
>   - { id: nxdomain, layer: L7, symptom: "Could not resolve host", cause: "имени нет", cmd: "dig … → status: NXDOMAIN" }
>   - { id: servfail, layer: L7, symptom: "долго, затем ошибка", cause: "авторитетный недоступен или DNSSEC", cmd: "dig … → SERVFAIL" }
>   - { id: udp-blocked, layer: L4, symptom: "timeout", cause: "межсетевой экран режет 53/udp", cmd: "dig +tcp работает, dig — нет" }
> docs: [ rfc1034, rfc1035, man-dig ]   # docref; ladder steps — per doc_step
> ```
>
> Catalog by level (R8): L0 — DHCP, ARP, ICMP, TCP, UDP, DNS, HTTP, HTTPS/TLS, SSH; L1 — NTP, SMTP, FTP/SFTP, HTTP/2, HTTP/3 (QUIC), WebSocket, gRPC, VLAN, NAT/PAT; L2 — BGP, VXLAN/Geneve, IPsec, WireGuard, mTLS, OSPF (idea). A card of a level above the current one is shown as a silhouette labelled "opens at level…", like the palette blocks in 05 §6.1. The validator checks that each card has all five sections filled in: why, level, sequence, how to observe, how it breaks.

Envelopes with real fields (R8 item 2) are described in 03 §7.2. 08 only needs to confirm that `packets` can show the fields as a tree and as hex with synchronized highlighting, and that OSI serves as a vocabulary: under each envelope a label "L3 — in conversation, "a problem at layer three"".

### 14. MAJOR — Kubernetes networking: the engine lacks primitives for R9

**Where:** 6.4 sc. 7–9 (one scene about CNI, `intermediate+` only), 3.0 (no kernel rule events), 3.6.

**What is wrong.** The content of R9 is almost entirely in 05 §6.4, but the engine needs three things for it that 08 does not have:
1. A packet must travel between **nodes** with encapsulation (outer and inner header at the same time).
2. A ClusterIP "does not live on any interface". It must be drawn as a ghost address: a dashed node without an interface that appears only at the moment of DNAT.
3. A walk-through of the packet's path through iptables/nftables/eBPF rules is needed.

**Fix.**
- Add a bus event `{ t: 'net.rule'; table: 'nat'|'filter'|'mangle'|'ebpf'; chain: string; rule: string; verdict: 'jump'|'dnat'|'accept'|'drop'|'reject'; packet: string }`, which the simulator sends for every rule that fires.
- **`ruletrace`**: a vertical strip of chains (`PREROUTING → KUBE-SERVICES → KUBE-SVC-… → KUBE-SEP-… → DNAT`), with the rule that fired highlighted. A click opens the full rule. A "number of replicas" knob 1–5 recomputes the `--probability` values (1/3, 1/2, 1 for three) with a "why it is so" label. A mode switch: iptables / IPVS / nftables / Cilium eBPF (for eBPF the strip is a "service map" instead of chains).
- Drill "find in iptables where a packet to a ClusterIP goes" (R9):

> The learner on a node (tier A, kube-lite + netlab) runs `iptables -t nat -L KUBE-SERVICES -n | grep 10.43.12.7`, goes into the `KUBE-SVC-…` chain, then into `KUBE-SEP-…`, and writes to `/tmp/ep.txt` the address and port to which DNAT will go for the **second** entry. Check: `files['/tmp/ep.txt'].text = '<IP:port of the second EndpointSlice>'` (the reference is computed from facts, addresses are parameterized per attempt). Documentation step 3: a link to kubernetes.io › Virtual IPs and Service Proxies.

- **Troubleshooting "a pod cannot reach a service"** as a five-step `stepper` checklist: DNS (`nslookup web` from a pod, `ndots:5` and search domains in `/etc/resolv.conf`) → Service (`kubectl get svc web`, port and `targetPort`) → EndpointSlice (`kubectl get endpointslices -l kubernetes.io/service-name=web`) → pod (`ready`, whether it listens on the port) → NetworkPolicy (`kubectl get netpol`, first ask whether the CNI supports policy). Exactly one of the five links is broken, at random. The learner first answers `layerq` and points to the link, then fixes it. Check: `http.web-from-client.status=200` and `failId` equals the chosen link (credited separately as "diagnosis correct").
- Make the CNI scene available for all levels. For L0 keep "pod to pod on one node" and "on different nodes" with a packet animation. The Cilium native routing / eBPF switches are for L1+.

### 15. MAJOR — The reconciliation loop explainer does not match R10 and duplicates 05

**Where:** 6.4 sc. 1 (thermostat in ink), 6.4 sc. 6.

**What is wrong.** R10 sets the layout and sequence: desired state (YAML in etcd) on the left, actual on the right, the controller in the middle, which compares and corrects endlessly. The learner intervenes and watches. Then the chain of controllers Deployment → ReplicaSet → Pod → scheduler → kubelet. In the finale the learner writes a tiny controller in the browser and sees that an operator is the same loop for a CRD. In 08 there is a thermostat instead, and one scene with `kubectl delete pod`. 05 §6.2 has all of this, but the engine for it is not described: section 3 has no code editor and no sandbox for user code.

**Fix.**
- Delete sc. 1 in 08. The canonical storyboard is 05 §6.2. Add engine acceptance to 08:

> **`reconcile`**. Three fixed-width columns: "Desired" (YAML from etcd, changed fields highlighted) — "Controller" (an observe → diff → act arc with the iteration number and a diff line `want 3, have 2 → create 1`) — "Actual" (pod cards). Intervention buttons: delete a pod, "kill a node", change `replicas`, change `image`, "pause the controller". Each intervention is a `k8s.object` event; the engine draws which iteration noticed it. Screen 2: a chain of five such mini-loops in a row (Deployment controller → ReplicaSet controller → scheduler → kubelet → runtime). The output of one loop is the input of the next, labelled on the edge (`creates ReplicaSet`, `creates Pod`, `binds nodeName`, `starts containers`). A "watch delay" knob shows that the loops are independent and converge in any order.
>
> **`code`** — an editor (CodeMirror 6 with TS/YAML/HCL/PromQL highlighting; one module for the whole course, because 06 needs it too: PromQL, playbooks, HCL) + execution of user TS in a dedicated Worker without network and DOM (transpilation with `sucrase` or `esbuild-wasm` on demand). Iteration time is limited: if `reconcile` runs longer than 2 s, the learner's controller gets a `timeout`. The client is a proxy to kube-lite with the RBAC of its ServiceAccount (as in 05). Budget: editor ≤ 150 KB gz, transpiler — on demand.
>
> The finale "operator = the same loop": in the same "Desired" column, a `Website` object (CRD); in the middle, the learner's code instead of the built-in controller; on the right, the Deployment and Service it created. The label under the diagram: "Kubernetes does not distinguish your controller from its own: the same watch, the same loop". The bridge to the Go pet project: a "the same on controller-runtime" button shows the equivalent `Reconcile(ctx, req)` alongside (read-only).

### 16. MAJOR — The query to the neural network diverges from 01 §14 and does not know about modes

**Where:** 3.10.

**What is wrong.**
1. A blacklist of not-yet-introduced words is passed, while 01 §14.4 passes a whitelist `known_concepts` and `glossary`. A blacklist of ~150 terms is a spoiler in itself and does not fit in the context.
2. There are no modes from 01 §14.1: the "Ask" button is available "for every error and for the question after the answer", including, judging by the text, in the exit ticket and in the exam. 01 and 09 (§0, "Exams: the neural network is turned off by the engine") forbid this.
3. The hint step and `doc_step` are not passed (finding 4), so the AI cannot follow the ladder.
4. `describe()` of all widgets plus 20 terminal lines is sent. The task solution does not go into the context, which is correct, but step 4 also needs `doc_trail`.

**Fix.** Bring the `ask(context)` contract in line with 01 §14.4 and add the engine fields:

```json
{
  "mode": "practice",                       // lesson | practice | sandbox | review | exit | exam → exit/exam: the button is inactive
  "doc_step": 4,
  "hint_step_used": "H2",
  "known_concepts": ["L17", "L33", "L35"],
  "glossary": { "L35": { "ru": "…" } },
  "scene": { "lesson": "linux.isolation", "screen": "s3a", "describe": ["Схема: sh в своём pid namespace…"] },
  "terminal_tail": ["…"],                   // ≤ 20 lines, trimmed by the trim rule
  "doc_trail": [ { "source": "man-unshare", "anchor": "OPTIONS", "via": "terminal" } ],
  "question": "почему ps показывает только два процесса?"
}
```

In the answer panel, show the note "an answer from your neural network; the engine has not checked it". The step restrictions (H1–H5, "where did you look?") go into the system instruction from 01 §14.

### 17. MAJOR — Levels: the experienced learner gets the same order, just with scenes cut out

**Where:** section 4 ("the experienced learner sees only the mechanism, the lab and the check"), 3.8 (recording of the first attempt).

**What is wrong.** Per 01 §1 and §7, for L2 a lesson starts with a task before the explanation (productive failure), and for L0 with a worked example. In 08 the scene order is the same for everyone; only visibility changes. R2 also requires the experienced learner to start at documentation step 3. For L1, the "Basics — expand" collapsing is correct.

**Fix.** Add a per-level order to `lesson.yaml`, and teach the engine to apply it:

```yaml
order:
  L0: [hook, look, try, explain, practice, exit]
  L1: [hook, look, try, explain, practice, exit]   # look is compressed: L0 screens collapsed
  L2: [hook, practice:challenge, explain, practice, exit]   # challenge task first, explanation after the attempt
```

For the `look` screen at L2, add an "after the attempt" entry: the engine shows the stepper steps where the learner made a mistake (by `failId` from 09 §2.4), not the whole mechanism. For each explainer in the catalog (finding 7), specify how each level uses it:
- **L0:** the stepper by button, a prediction before every "break it", knobs unlocked one at a time;
- **L1:** all knobs unlocked, "break it" with a prediction;
- **L2:** "break it" first without the diagram, a task right away ("here is the symptom, find it"), the diagram opens as the debrief.

### 18. MAJOR — Several v86 machines, our own switch and hybrid Kubernetes (R11)

**Where:** 3.4 ("The "real kernel" level" — one machine on a button), 3.0 (no L2 or node events), section 10.

**What is wrong.** R11 requires 3–4 v86 VMs in Web Workers (64–128 MB each, one on a phone), connected by our JS switch with real L2 (ARP, ping, tcpdump, routing, iptables, NAT, WireGuard between nodes) and a **visualized** switch. On top of this, hybrid Kubernetes is needed: the control plane is kube-lite, and on each v86 node there is a small real kubelet agent that runs pods via crun. 08 has none of this. In 09 §1.6 the inter-machine network is the `inbrowser` backend (BroadcastChannel), and the switch there is not visible to the learner.

**Fix (engine side; the kernel and the agent are 09).**
- **Switch.** Each v86 sends its network card frames (`net0-send` / `net0-receive` on the v86 bus) not directly to BroadcastChannel, but to a shared `vswitch` module in the main thread or in a separate Worker. The module maintains a MAC → port table (learning, 300 s aging), floods broadcast and unknown frames, and supports VLAN tags (for the VLAN card, L1). For the diagram it sends `{ t: 'l2.frame'; port: string; src: string; dst: string; ethertype: number; vlan?: number; summary: string }` (summary — like one line of `tcpdump -e`). To keep the diagram from lagging, frames are thinned to 20 events per second, while per-port counters are not thinned.
- **The `switchview` widget.** The switch in the centre, nodes in a circle, the MAC table under the switch fills up before your eyes. A "hub / switch" toggle (frames go to everyone / to one) — an explanation of ARP and switch learning with one knob. "Break it": unplug a node's cable (port down), a loop (only in the model, with storm limiting).
- **Memory and devices.** 4 nodes × 96 MB guest plus v86 overhead — about 1.5–2 GB per tab. This exceeds the 09 §1.4 budget ("≤ 600 MB with one machine"), so the engine offers the multi-node lab only when `navigator.deviceMemory ≥ 8` and shows a memory estimate before start. On a phone — 1 node, the remaining nodes in tier A (netlab) with the same switch: frames from simulated nodes go into the same `vswitch`. Add a row to the section 10 budgets: "multi-node lab: snapshot per node ≤ 25 MB (guest 64–96 MB, `lab-alpine` worker image)".
- **Hybrid node.** Node events: `{ t: 'node.agent'; node: string; state: 'up'|'down'; pods: string[] }` and `proc.spawn` with a `node` field. The "Kubernetes from blocks" diagram in "hybrid" mode shows real crun processes with guest PIDs above the nodes. `kubectl exec` opens a terminal tab with `nsenter` into the real container. "Kill a node" is `stop()` on the v86 Worker: after the grace period (50 s, sped up by a button) kube-lite marks the node `NotReady` and creates pods on other nodes. The old pods remain `Terminating` (finding 11).
- **WireGuard between nodes** — L2 (protocol card). The `dt-kernel` kernel needs `CONFIG_WIREGUARD`, and the image needs `wireguard-tools`. Notify 09: they are not in the `lab-alpine` package list.
- In 3.4, replace the paragraph "v86 … only on a computer" with a reference to 09 §1.4 and this section, and the figure "tens of MB" with the 09 budgets (snapshot ≤ 40 MB).

### 19. MAJOR — Stage 3 (real VMs): the trainer guides and checks, it does not execute (R12)

**Where:** 3.4 last paragraph (terminal over WebSocket to ttyd/the VM console), 7.5 (`probe`).

**What is wrong.** Per R12, at the third stage the trainer does not execute commands: it guides step by step, checks (a check script → the result in the trainer), shows the VM cost and requires a mandatory cleanup step. A built-in terminal to the VM via ttyd over WebSocket contradicts this. Besides, it is one more access point to the learner's machine that has to be secured. 09 §5.4 already has the right mechanism — the `trainer-check` agent with a one-time code or a signed connection. The engine has no widget for stages 2 and 3.

**Fix.** Delete the ttyd paragraph: the stage 3 machines belong to the learner, who logs in to them over ssh from their own terminal. Add:

> **`runbook`** — the checklist screen of a real stage.
> - On the left, the steps (for example, R3: "order 3 VMs with Terraform" → "configure with Ansible" → "kubeadm init" → "join workers" → "Cilium" → "storage" → "certificates" → "version upgrade" → "etcd backup/restore" → "break and fix a node" → **"cleanup"**). Each step has: what to do, a command with a "copy" button (not "run"), a `docref` per `doc_step` (at stage 3 — steps 3–4), the expected result.
> - On the right, the check status: either a field "paste the result of `trainer-check run --nonce …`" (serverless mode, 09 §5.4), or the live agent status (server mode), the last check time and a `CheckResult` for each goal.
> - At the top, a **cost counter**: the provider, the number and type of VMs from the agent's facts (`k8s.nodes[].providerID`, or the learner enters them manually), the hourly price from `sources.yaml` with the check date, the accumulated total since the first step. Prices are data with `hold` and a date, not numbers in code.
> - **Cleanup is mandatory.** The stage is not credited until the last goal "VMs deleted" passes: `terraform state list` is empty, the provider's VM list by the course label is empty, the agent's "machine is shutting down" mark. If the learner closed the tab, on the next visit the trainer's first screen shows "you may have VMs running: ~N ₽/hour" with the cleanup command.

### 20. MINOR — Transfer via QR with WebRTC is infeasible as described

**Where:** 3.9.

**What is wrong.** An SDP offer with ICE candidates and a DTLS fingerprint takes 1–3 KB, while the Sankofa encoder holds 213 bytes. The phone's answer (also SDP) cannot be turned into a "short code that the learner enters on the computer". Without STUN only local network candidates work, and browsers hide them behind `.local` mDNS names, which do not resolve on all networks.

**Fix.** Move the "diagram on a second screen" mode to v2 and implement it via `dt-api` (09 §0): a short room code in the QR, SDP exchange via the service, the data goes peer-to-peer. Without the service — only a static copy of the scene. Keep the "keep reading on the go" mode as is; it fits in 213 bytes.

### 21. MINOR — The checks contract diverges from 09 in names and fields

**Where:** 7.5.

**What is wrong.** 08 has `proc[...]`, `cgroup[...]`, `memory.max<=104857600`. 09 §2.3 has `procs[...]`, `cgroups[...]`, sizes like `20M`, mandatory `needs`, `envs`, and `fail` with `term`. `probe` in 08 is described as "a shell script with an exit code", in 09 as `{script, expect_exit, timeout}` and only with `envs: [vm]`.

**Fix.** Replace the 7.5 example with a reference to 09 §2.4 and one example in its syntax. Declare the diagrams' own `bind` selector (3.2) to be the same predicate language as 09 §2.3: one `evaluate` implementation, one set of vectors.

### 22. MINOR — One mode of interaction per screen

**Where:** 3.3 (`split`), 6.1 sc. 3 (six toggles + terminal), 6.3 sc. 2 (terminal + TTL slider + "break it").

**What is wrong.** Rule R12 from 01 §8 ("one mode of interaction per screen") is broken in several scenes. For L0 this is direct overload.

**Fix.** On `lab` the diagram is passive: it reacts to the terminal but is not controlled itself. Knobs and "break it" live on the adjacent `diagram` screen. For L1/L2, allow combining with a `combine: true` flag (build check: only with `levels` without L0).

### 23. MINOR — Text limits and captions

**Where:** section 4, 7.2.

**What is wrong.** The engine does not check the word limits from 01 §8 (rule R4: 120 words on L0, 180 on L1/L2) or rule R7 ("no "see the figure above"").

**Fix.** Add both rules to the 7.3 validator list.

### 24. MINOR — `explain` graded by rubric by the neural network in exams

**Where:** 3.8 (`explain`), 6.1 sc. 10, 6.3 sc. 11.

**What is wrong.** In exams the AI is turned off (01 §14.1, 09 §0), so `explain` in an exam must be graded by self-check against the rubric or (for presentable exams) deferred. This is not specified.

**Fix.** A row for the 3.8 table: "In `exit`/`exam` modes — only self-check against the rubric checklist. Grading by the neural network is available after the exam is finished, in the debrief".

### 25. MINOR — Trap blocks in the constructor for the beginner

**Where:** 6.4 sc. 10, 3.7.

**What is wrong.** Trap blocks ("Docker daemon on the node", "configuration database") are useful for L1/L2. For L0 this is productive failure without prior knowledge, and that works worse for beginners (Sinha and Kapur, 2021; 01 §1).

**Fix.** A field `traps: { L0: 0, L1: 2, L2: 4 }` on the constructor scene.

### 26. MINOR — Sound and the "tick per packet"

**Where:** 2 (`clap.ts`), 3.6.

**What is wrong.** Sound by itself does not violate R4 (it is off by default), but sound "voices" for packets are a decorative layer that has to be built and maintained with no learning payoff.

**Fix.** Postpone to v2. In the MVP keep only a sound on the "check passed" event, if it is needed at all.

---

## What to accept first

1. Findings 1, 2, 3: remove ink, hand the storyboards over to the blocks, switch to the 01 content model. Without this the other fixes have nowhere to go.
2. Finding 4 and section 3.13: `docref`, `docview`, `docexam`, `doc_step`. Every block needs them and nobody has described them.
3. Finding 8 (explainer contract) and finding 7 (catalog): the block documents will rewrite their interactives against them for R3/R4.
4. Findings 5, 12, 13, 14, 15, 18, 19: storyboards and primitives for R6–R12 that need to be inserted into 02, 03, 04, 05, 09 and into 08 itself.
5. Move the factual fixes from finding 11 into the block documents together with the storyboards.
