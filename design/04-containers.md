# 04. The "Containers and Docker" block — design

Role: container runtime engineer (Docker/OCI internals). Draft of 18.11.2026, second revision after review by the authors of 02 (Linux) and 09 (runtime environments and AI) and the second wave of owner requirements (R1–R12).

This document describes the fourth step of the roadmap from the checklist ("Docker, containerization mechanisms — MUST: image, container, layer, compose, Dockerfile, multi-stage, registry. Containers are a technology, Docker is an application") and the mandatory interview question "container versus virtual machine, explain through namespaces and cgroups". It settles in which order the block introduces concepts and what it relies on from the Linux and networking blocks, how textbook chapters, process explainers and the documentation ladder are built, what really runs in the browser and what is modeled, how labs, exercises, exams and the entry check are built, and what the block contributes to the hybrid Kubernetes of the next block.

---

## 1. Key decisions in brief

| Question | Decision | Why |
|---|---|---|
| What matters most in the block | The textbook (coherent theory, a strict order of concepts), process explainers and the habit of reading documentation. Practice stands on them: every exercise links to a chapter, an explainer and a rung of the documentation ladder (section 2) | Owner requirement R1 |
| What the block introduces itself | Only container entities: the container as an assembly of familiar mechanisms, the OCI bundle, the runtime and its chain, states, image, digest, manifest, registry, Dockerfile, cache, PID 1 in a container, volumes, Docker networks, logs, Compose, Docker's security profile, userns in Docker, the node runtime. Namespaces, cgroups, capabilities, chroot/pivot_root, overlayfs and seccomp are introduced by the Linux block in the module "How the kernel isolates and limits"; veth, bridge, NAT, DNAT, DNS are introduced by the networking block | R6; one theory in one place; otherwise the 01 concept graph does not build (section 3) |
| Visual language | The technical drawing from 08 (5.1): 1.5 px line, 6 px corner radius, 8 px grid, monospaced value labels, the kernel always at the bottom as a `--c-kernel` band, namespaces as dashed frames in their own color with the inode number on the frame, cgroups as gauges. Sankofa's ink, "houses", "rooms", characters and "witnesses" are not used anywhere in the block | R4, R5. From Sankofa we take the magazine-style text presentation, scroll scenes, layers (as the mechanic of spreading a stack apart), calm mode, lenses (as a point-of-view switch), QR, bilingual YAML, draft/hold |
| Where practice runs | The three tiers of the 09 platform: **A** — dsim and the registry in the shared `sim.worker.ts` on top of the Stand (02) and netlab (03); **B** — v86 with the shared `dt-kernel` 6.12 LTS i686 kernel and the `lab-alpine` root; **C** — real VMs in the learner's own cloud account or on their own computer | 09, section 1. Kernel lessons need a real kernel (B), CLI exercises need an instant and deterministic engine (A), installing Docker needs a real machine (C) |
| Docker CLI in the browser | Our own engine simulator in TypeScript (dsim): content-addressable storage with real sha256, an overlay FS of layers with whiteouts, networks as netlab configuration, processes as Stand processes, behavior models of images | Real `dockerd`+`containerd` in a 32-bit v86 guest means hundreds of megabytes of Go binaries, minutes to start and 512+ MB of memory; real registries are not reachable from the browser without a proxy and run into Docker Hub limits |
| How not to lie in the simulator | Golden recordings: every scenario is run on a real Docker Engine (the version is pinned to the minor in `content/versions.yaml`) on a test VM of the course team, and CI compares dsim output with the recording after normalizing IDs, times and sizes. `--help` output is taken in full from the recording | Error texts, columns, exit codes, the order of iptables rules come from reality; the full help is needed by the documentation ladder |
| Registry | The course registry per the OCI Distribution Spec in a Service Worker on top of IndexedDB, at the same-origin path `https://<course>/registry/v2/…`. Inside dsim and the v86 guest it is called `registry.lab` (the `.lab` training zone, like `apt.lab` in 09); the v86 `fetch` adapter rewrites `http://registry.lab/` to this path. For real VMs — `registry:2` on the VM itself | The `.local` zone is taken by mDNS (RFC 6762); HTTPS from the guest cannot be passed through the `fetch` backend, and HTTP from a page served over HTTPS is mixed content; the browser's Service Worker is unreachable from a real VM |
| Runtime in v86 | `box` — a POSIX script on top of `crun`, which at the end of the lab the learner recognizes as their own `mybox.sh`, turned into a tool. The same `box` is the node runtime of the hybrid Kubernetes (05): pod sandbox, pull from the course registry, containers via crun | R11; without a shared contract the Kubernetes block would write a second runtime (section 10) |
| Machine budget | `lab-alpine` — 96 MB of guest memory, snapshot ≤ 20 MB; OOM exercises use limits of 8–24 MB | Three or four nodes on a laptop and one on a phone (R11) |
| Checks | The single 09 contract: the environment returns `dt.facts/v1` facts, and a goal is a `when` selector over facts. The guest has one `trainer-agent` on `ttyS1`; live snapshots for diagrams are its `watch` mode | One goal is checked in dsim, in v86 and on a real VM without rewriting |
| Alternatives we rejected | container2wasm (one image in Bochs, slow, not an engine), WebVM/CheerpX (its own system call layer rather than the Linux kernel: `unshare` and cgroups are not guaranteed; a commercial license for self-hosting), WebContainers (Node.js only, no kernel), real k3s in v86 (64-bit, does not fit into memory) | A real kernel is needed for labs and a predictable engine for the CLI |
| Presentation | Not a game. No points, lives or "leveling up". There is system state, a command, a result and an explanation | Owner requirement |

---

## 2. How the block is built: textbook, explainers, documentation, practice

Each module of the block is a textbook chapter. A chapter starts with a leading question the learner could ask themselves ("what exactly does `docker pull` download?"), proceeds in coherent prose with one idea per screen, and at the right moment opens a process explainer: a diagram where the process can be stepped forward and backward, a parameter changed and a part switched off. After the explainer the chapter shows where this mechanism is described in the official documentation, and does so at the ladder rung matching the learner's level. Only then comes practice: a lab in v86 or exercises in dsim. A chapter ends with a three-sentence summary and two retrieval questions.

That is why the order in this document is: first the order of concepts (section 3), then the curriculum and chapter plans (section 4), the documentation ladder (section 5) and the explainers (section 6), and only after them the interactives, the lab, the simulator, exercises and exams.

A chapter is 1,500–2,500 words; a beginner gets the full chapter, intermediate and experienced learners get the "express" version. Express is defined the same way for all modules: one summary page of the chapter (key statements and the main diagram without stepping), three `predict` or `order` questions and one confirmation exercise. A mistake in express opens the full chapter and marks the concept as a "gap" per 01 (section 3 of document 01). For the experienced level each chapter contains an "if you are a programmer" sidebar: a container = `fork` + `unshare` + `execve` into a prepared root; an image = content-addressed object storage, like git objects; the build cache = memoization by key; Compose = a declarative description that is reconciled to state once. The sidebar replaces the introductory screens.

---

## 3. Order of introducing entities

The rule "no term before it is introduced" is checked by the build. Lesson texts mark terms with a glossary link (`[[D08|image]]`, the `lib/links.ts` mechanism from Sankofa), and a lesson declares, in the 01 format: at the screen (scene) level `introduces` — no more than one new concept, at the lesson level `uses` — the concepts it relies on. The build walks each of the three routes and fails if a term appears in a text, a quiz question, hint output, diagram text or the `ai_context` field before the screen that introduces it. Command output is marked up too: if an exercise shows `CONTAINER ID` in the output, the concept "container" must already be introduced.

### 3.1. What the block relies on (introduced earlier, in the Linux and networking blocks)

The containers block does not re-introduce anything from this table. In its chapters it does a "roll call": a screen with three recall questions and a link to the lesson where it was covered. The new L-group identifiers are proposed in 01; until they are approved, the build uses them as they are.

| Concept (ID in 01) | Where it is introduced | What the containers block does with it |
|---|---|---|
| process, PID, PPID (L17), signals and `kill` (L18), exit code (L19), environment variables (L16), daemon and systemd (L23), logs (L24), `/proc` and `/sys` (L26), kernel and system call (L27), `tar` (L29), `sha256sum` (L30), YAML and JSON (L31) | Linux, lessons L8–L16 in 02 numbering | PID 1 of a container, the double PID, codes 137/143, the dockerd daemon, a layer as tar, a digest as sha256, compose.yaml |
| thread, `/proc/<pid>/task`, `ps -eLf`, `fork`/`exec` (proposed **L33**) | Linux, module 02 "How the kernel isolates and limits" (hereafter the Linux R6 module) | `clone` in runc, the process chain shim → application |
| namespace, eight kinds (cgroup, ipc, mnt, net, pid, time, user, uts), `/proc/<pid>/ns`, `lsns`, `unshare`, `nsenter` (**L34**, formerly D03) | the Linux R6 module; net namespace — N21 | a container is assembled from them (docker.m02, m04), `nsenter` in debugging |
| cgroup v2, `/sys/fs/cgroup`, `memory.max`, `cpu.max`, `pids.max`, `memory.events`, OOM killer (**L35**, formerly D04) | the Linux R6 module, with the OOM-kill exercise there as well | `--memory`, `--cpus`, `--pids-limit`, `OOMKilled`, code 137 |
| capability, `capsh`, `getcap`/`setcap`, bounding set, `CapEff` (**L36**) | the Linux R6 module | Docker's default set, `--cap-drop/--cap-add` |
| mount namespace and mount propagation, bind mount, `chroot`, `pivot_root` (the idea) (**L37**, formerly D05) | the Linux R6 module | the container root, volume and bind mount |
| OverlayFS: lowerdir, upperdir, workdir, merged, copy-up, whiteout (**L38**, formerly D09) | the Linux R6 module | image layers as lowerdir, the container layer as upperdir |
| seccomp as a system call filter (**L39**) | the Linux R6 module, at the level of the idea | Docker's default profile, `seccomp=` |
| port and socket (N04), private addresses and NAT (N11), the `iptables`/`nftables` firewall (N17), DNS (N08, N09), veth and bridge (N20), network namespace (N21), DNAT (N17) | Networks | `docker0`, `-p` as DNAT, 127.0.0.11, Docker networks |

If a learner comes straight to the containers block, the entry check (section 13) tests concepts L34–L38 in v86 and, on failure, sends the learner to the Linux R6 module rather than explaining them here.

### 3.2. What the block introduces

Module numbers follow the 09 identifier rule (`docker.m01…`). Concepts D01–D23 are from graph 01; D24–D33 are new, proposed to 01 by this document.

| # | Concept (ID) | Module | Screen where it is first introduced |
|---|---|---|---|
| 1 | the "works on my machine" environment problem (D01) | m01 | Two applications on one server require different versions of the same library (explainer X4, screen 1) |
| 2 | virtual machine, hypervisor, guest kernel (D02) | m01 | X4, screen 2 |
| 3 | container = process + namespaces + cgroup + rootfs (D06) | m01 | X4, screen 3: "you know the parts from Linux; a container is their combination" |
| 4 | container and VM: the difference (D07) | m01 | X4, screens 4–5 |
| 5 | OCI bundle and runtime spec: `rootfs/` + `config.json` (D24) | m03 | The learner opens the `config.json` from `crun spec` and recognizes the Linux R6 module in it |
| 6 | architecture: docker CLI → dockerd → containerd → shim → runc/crun (D10) | m03 | Explainer X1 at the level of "who calls whom and who stays alive" |
| 7 | container states: OCI (`creating`, `created`, `running`, `stopped`) and Docker (`created`, `running`, `paused`, `restarting`, `removing`, `exited`, `dead`) (D25) | m03 | Explainer X8 and `crun create` → `crun state` → `crun start` |
| 8 | the lifecycle in Docker: `run`, `ps`, `logs`, `exec`, `stop`, `rm` (D11) | m05 | `docker run hello-world` and a breakdown of every output line |
| 9 | image name and tag (part of D18, reading the name only) | m05 | `nginx:1.30-alpine` — what the name consists of |
| 10 | container environment variables (D14) | m05 | `app` exits immediately without `DB_HOST` |
| 11 | port publishing `-p` (D12) | m05 | `-p 8080:80` and what each number means (in detail — X6 in m08) |
| 12 | image: layers and configuration (D08) | m06 | Interactive 2, screen A |
| 13 | OCI manifest and digest (D19) | m06 | Interactive 2, screens A–B |
| 14 | index and platform (D26) | m06 | Interactive 2, screen A; explainer X3 |
| 15 | tag, registry, `push`/`pull` (D18) | m06 | X3 |
| 16 | Dockerfile: instructions, build context, `.dockerignore` (D15) | m07 | X2, screens 1–3 |
| 17 | build cache and instruction order (D16) | m07 | X2, screen 4 |
| 18 | PID 1 in a container, the stop signal, init (`--init`, tini), ENTRYPOINT/CMD, exec and shell form (D27) | m07 | Explainer X7 |
| 19 | multi-stage (D17) | m07 | A Go application image 900 MB → 12 MB |
| 20 | the container boundary, six kinds (D29) | m08 | Explainer X5 |
| 21 | volumes, bind mount, tmpfs (D13) | m08 | The "storage" boundary |
| 22 | Docker networks: bridge, host, none, user-defined network, embedded DNS (D20) | m08 | The "network" boundary, explainer X6 |
| 23 | container logs and log driver (D28) | m08 | The "input/output" boundary |
| 24 | Docker Compose: project, service (D21) | m09 | Three `docker run` commands are translated into `compose.yaml` |
| 25 | healthcheck and restart policy (D23) | m09 | The database is not ready yet, but the application has already started |
| 26 | image security: USER, a minimal base, scanning (D22) | m10 | A secret deleted in the next layer |
| 27 | Docker's security profile: the default capability set, the seccomp profile, AppArmor/SELinux, `no-new-privileges`, `--privileged` (D30) | m10 | Root in a container and what restricts it |
| 28 | user namespace in Docker: userns-remap, rootless (D31) | m10 | The `uid_map` of a rootless container |
| 29 | containerd from the inside: snapshots, the Engine 29 image store, shim and `live-restore` (D33) | m11 | X1 at full depth |
| 30 | node runtime and pod sandbox (D32) | m12 | `box sandbox create` |

The order of modules is the same for every route (section 4.2), so the former problem "a beginner builds a container by hand after Compose" no longer exists: they already know the parts from the Linux R6 module, and lab m04 is for them an assembly of the familiar, not a first encounter.

Lab m04 uses an overlay of two prepared directories before the concept "image" (D08, m06) is introduced. This is acceptable: overlayfs is introduced in Linux (L38), and the directories are called "lower directories" in the text, without the words "image layer". The link "this is how an image is built" is made in m06 with a back-reference.

---

## 4. Curriculum by level

### 4.1. What each level means in this block

**Beginner.** A person with no IT experience (for example, a sales manager) who has completed the Linux blocks (including the module "How the kernel isolates and limits") and networking: can move around directories, look at processes, has created a process in a new pid namespace, set a memory limit on a group and seen an OOM kill, understands port, IP, NAT. Has never run containers. Outcome of the block: starts and stops containers, publishes ports, writes a simple Dockerfile and a Compose file for a three-service application, explains in their own words and in terms of namespaces and cgroups how a container differs from a VM and how they are nested inside each other today, finds the cause of a breakage starting with the question "at which boundary?". By the end of the block reaches rung 3 of the documentation ladder.

**Intermediate.** Uses Docker at work or in a pet project but understands the internals poorly: why the build cache breaks, how a volume differs from a bind mount, why containers on the default network do not see each other by name, why `docker stop` waits 10 seconds. Outcome: optimizes images, debugs a container across the six boundaries, builds a container by hand in bash and compares it with `config.json`, knows basic security, passes rung-4 tasks (flags that were not in the theory).

**Experienced.** A programmer or system administrator who understands processes, system calls and file systems but is not a DevOps engineer. Outcome: reads the OCI image-spec and runtime-spec fluently, understands the runtime chain down to the shim and the snapshotter, digest and ChainID, user namespaces and rootless, writes a seccomp profile, analyzes incidents at the kernel level, understands how their runtime will become a Kubernetes node. Starts at rung 3 of the documentation ladder and gets "find the flag" tasks from the first module.

### 4.2. Modules and routes

The order of modules is the same for all levels; the depth differs.

| Module | Content | Beginner | Intermediate | Experienced |
|---|---|---|---|---|
| m01. Why containers | The environment problem, VMs, the container as a combination of kernel mechanisms, VM versus container, today's nesting; explainer X4; "this Linux is itself a VM" | in full | express | express |
| m02. A container from familiar parts | Roll call of the Linux R6 module concepts, interactive 1, "one kernel" and measuring a container start against a cold boot of a second VM | in full | in full | in full, with user and time ns |
| m03. Anatomy of a container | OCI bundle, the runtime chain, OCI and Docker states; X1 (overview depth), X8 | in full | in full | in full + runtime-spec `runtime.md` at rung 3 |
| m04. A container with your own hands | A lab in v86: chroot → namespaces → cgroup → network → overlay and pivot_root → capabilities → crun | steps 0–5, 8 with rung-2 hints | all steps | all steps without hints + a seccomp filter |
| m05. First steps with Docker | run/ps/logs/exec/stop/rm, variables, ports | in full | express | express |
| m06. How an image is built | Layers, digest, manifest, index, registry; interactive 2, explainer X3 | without ChainID | in full | in full + a manual pull with `curl` in v86 |
| m07. Dockerfile and build | Instructions, context, cache, PID 1 and signals, multi-stage, secrets; X2, X7 | in full | in full | express + BuildKit cache/secret mounts at rung 4 |
| m08. The six boundaries of a container | Kernel, network, storage, process and signals, input/output, configuration and identity; X5, X6; "the container doesn't work" drills | in full | in full | in full + `iptables -t nat -S` and `nft list ruleset` in v86 |
| m09. Compose | Project, services, project networks and volumes, `.env`, healthcheck, `depends_on`, profiles | in full | in full | express |
| m10. Security | USER, the Docker profile, `--privileged`, read-only, limits, rootless and userns-remap, secrets in layers, scanning | the basic part | in full | in full + your own seccomp profile |
| m11. Under the hood of Docker | containerd, snapshots, shim, `live-restore`, the Engine 29 image store, Docker's iptables/nftables rules | overview scene | in full | in full |
| m12. Node runtime: `box` and several machines | `box` as a tool, pod sandbox, two v86 nodes on a shared switch, a route between container subnets | overview scene | in full | in full |
| m13. Real Docker on a VM | Ordering a VM with its cost, installing Engine, repeating exercises marked "VM", `trainer-check docker`, mandatory cleanup | in full | in full | optional |
| m14. Interview | The "container versus VM" answer builder, 12 questions | in full | in full | in full |

### 4.3. Chapter plans

Each plan is a decision about the order of introduction; the texts are written by the content role following the 08 typography rules.

**m01. Why containers.** Leading question: "why is it convenient to run the same program on the same server in a container rather than just as is?" 1) The environment problem: two applications, two versions of a library, updating one breaks the other (X4, screen 1). 2) The first solution is a virtual machine: a hypervisor, a guest kernel, its own OS; the price is memory and boot time (X4, screen 2). 3) The second solution is a container: there is one kernel, but the kernel shows the process its own set of processes, files and network and limits its resources; the learner knows all the parts by name from the Linux R6 module, and here they are named together for the first time (X4, screen 3; D06 is introduced). 4) Comparison by isolation, kernel, size, start time and density; why a Windows container will not start on a Linux kernel; why a VM isolates more strongly (X4, screens 4–5; D07). 5) Today they are nested inside each other: containers in cloud VMs, Kubernetes on bare metal, VMs inside Kubernetes via KubeVirt, as in Cozystack (X4, screen 6). 6) "This Linux is itself a VM": practice in v86 without containers (X4, screen 7). 7) Documentation, rung 1: `man7.org namespaces(7)`, the "Namespace types" section, docs.docker.com "What is a container". Summary and two questions.

**m02. A container from familiar parts.** Leading question: "what is a container from the kernel's point of view?" No new concepts. 1) Roll call: four recall questions on L34–L37 ("which file shows which pid namespace a process is in?", "what will you write to limit a group to 16 MB?"). 2) Interactive 1: a live container in v86 from two sides — from inside the container and from the host. 3) "Own / shared with the host" toggles for each kind of namespace and a `memory.max` slider. 4) "One kernel": `uname -r` inside and outside, `ps -e | wc -l` inside and outside. 5) Measurement: a container start against a cold boot of a second v86 machine. 6) Documentation: rung 1 for the beginner (`namespaces(7)`), rung 2 for the intermediate (a fragment of `unshare(1)` with `--fork` highlighted), rung 3 for the experienced ("find in `lsns(8)` how to show only network namespaces"). Summary: "a container is a host process; namespaces determine what it sees, the cgroup how much it can consume; the kernel is shared".

**m03. Anatomy of a container.** Leading question: "what is on disk and who starts the process when people say 'start a container'?" 1) A container on disk: OCI bundle = `rootfs/` + `config.json` (D24). In v86 the learner opens the `config.json` from `crun spec` and finds familiar things: `linux.namespaces`, `linux.resources`, `process.args`, `process.capabilities`, `mounts`, `root.path`. 2) Who starts it: the chain CLI → dockerd → containerd → shim → runc/crun → process, at the level of "who calls whom and who stays alive" (X1 at overview depth, D10). 3) States: OCI runtime and Docker — a graph with transitions (X8, D25); `crun create x` → `crun state x` (`created`: the process already exists and is waiting) → `crun start x` → `running` → exit → `stopped`. 4) Documentation: rung 2 — a fragment of runtime-spec `runtime.md` "State" with the list of states highlighted; rung 3 for the experienced — "find in `crun --help` the command that shows all containers". Summary.

**m04. A container with your own hands.** Leading question: "can you build a container without Docker?" The lab steps (section 9) — each step repeats one part of the Linux R6 module in two minutes and adds one line to the growing `mybox.sh`. The last step is the same container via crun, with lines from the `config.json` fields to the steps. Documentation: rung-2 hints for the beginner (fragments of `unshare(1)`, `pivot_root(8)`, `capsh(1)`), rung 3 for the intermediate ("find the `unshare` flag that mounts `/proc` by itself"), rung 4 for the experienced (a seccomp filter per runtime-spec `config-linux.md`, no hints). Summary: "Docker does the same thing, only for you".

**m05. First steps with Docker.** Leading question: "what happened when I typed `docker run`?" 1) `docker run hello-world` and a breakdown of every output line (the client contacted the daemon, the image is not present locally, it was downloaded, a container was created, started, the output came back) — a link to X1. 2) Image name and tag — only as part of the name (in detail in m06). 3) Modes `-d`, `-it`, `--rm`, names, `docker ps -a`, `logs`, `exec`. 4) Stopping: `stop` versus `kill`, exit codes 0, 1, 137, 143 (in detail — X7 in m07). 5) Environment variables `-e`, `--env-file` (D14). 6) Port publishing `-p 8080:80` and what each number means (D12; in detail — X6). 7) The states from m03 on a live example: the dsim panel highlights the X8 graph node. 8) Documentation: rung 1 for the beginner (under every command — a link to its docs.docker.com page), rung 2 for the intermediate (fragments of `docker container rm --help`, `docker run --help` with `-i`, `-t`). Summary.

**m06. How an image is built.** Leading question: "what exactly does `docker pull` download?" 1) An image is files and a description: a stack of layers (each a tar, L29) and a config; a back-reference to the overlay from m04 (D08). 2) Content addressing: sha256 (L30) → digest; why a tag can be moved but a digest cannot (D19). 3) The manifest ties the config and layers together; the index ties platforms together (D26). 4) The registry and the protocol: token → manifest → blobs; explainer X3 (D18). 5) Two hashes of one layer; ChainID for the experienced. 6) Why an image weighs a gigabyte (screen G of interactive 2). 7) Documentation: rung 1 for the beginner — image-spec `manifest.md`; rung 2 for the intermediate — a fragment of `docker image inspect --help` with `--format`; rung 3 for the experienced — "find in the distribution-spec which response header carries the manifest digest" (`Docker-Content-Digest`). Summary and two questions.

**m07. Dockerfile and build.** Leading question: "how does an image come out of source code, and why is the second build faster than the first?" 1) Why write the build down in a file: reproducibility, review, cache. 2) An instruction = a step with a result: a layer (`RUN`, `COPY`, `ADD`) or a config line (`ENV`, `WORKDIR`, `CMD`, `EXPOSE` — documentation, not publishing) — X2, screens 1–3 (D15). 3) The build context: what goes to the builder and why `.dockerignore` is a question of both speed and security. 4) The cache: the step key and the rule "from the first changed instruction downward"; the order "dependencies first, then code"; why `RUN rm` on a separate line does not shrink the image (X2, screen 4; D16). 5) What will start and how it will stop: ENTRYPOINT and CMD, exec and shell form, PID 1 and signals, `--init` (X7, D27). The exec form is a necessary but not sufficient condition for a correct stop. 6) Two stages: build in one image, ship in another (`COPY --from`, D17). 7) Secrets not in layers: why `ARG PASSWORD` and `COPY .env` stay in the history, `RUN --mount=type=secret`. 8) Documentation: rung 2 for the beginner — a fragment of the Dockerfile reference "Shell and exec form"; rung 3 for the intermediate — the docker.f-* tasks; rung 4 for the experienced — `STOPSIGNAL`, `--mount=type=cache` without theory. Practice after sections 2, 4, 5, 6; the chapter's summary is docker.x10–x14.

**m08. The six boundaries of a container.** Leading question: "the container doesn't work — where do I start?" 1) A container is a process that has six boundaries with its environment; almost any breakage sits on one of them, so the first diagnostic question is "at which boundary?", and for networking "at which layer?" (X5, D29). 2) The "host kernel" boundary: one kernel, the image architecture and `exec format error`, sysctls that belong to a namespace and to the host. 3) The "network" boundary: veth, `docker0`, NAT to the outside, `-p` as DNAT, the embedded DNS at 127.0.0.11 only in user-defined networks, `host` and `none` (X6, D20). 4) The "storage" boundary: the overlay upper layer lives as long as the container; volume, bind mount, tmpfs; a bind mount hides the image's files (D13). 5) The "process and signals" boundary: PID 1, SIGTERM → timeout → SIGKILL, zombies, tini (a repeat of X7). 6) The "input/output" boundary: the shim holds stdio → log driver (`json-file` by default) → file; an application that writes to a file is "silent"; a log without rotation grows; stdout buffering (D28). 7) The "configuration and identity" boundary: env and `.env`, secrets, the UID inside and outside is just a number, a bind mount preserves numeric owners, user namespace. 8) Drills b01–b16 and the final b-mix (section 12). 9) Documentation: rung 2 for the beginner — a fragment of `docker network create --help`; rung 3 for the intermediate; rung 4 for the experienced (`--log-opt`, `--sysctl`, `--ulimit` without theory). Summary: "first the boundary, then the cause".

**m09. Compose.** Leading question: "how do you describe three containers so they can be brought up with one command?" 1) `compose.yaml` as a record of the same `docker run`s: the learner translates three commands from m08 into a file and sees the same state in dsim (D21). 2) Project, service, the project's default network, named volumes. 3) Variables and `.env`, `docker compose config` as a way to see the final configuration. 4) Readiness: healthcheck, `depends_on` with `condition: service_healthy`, the `restart` policy (D23). 5) Profiles. 6) A bridge to Kubernetes: `compose up` brings the system to the description once and exits; the restart policy is a small local loop "crashed → bring it up"; in the Kubernetes block this will become a reconciliation loop that compares desired and actual state endlessly (05, R10). 7) Documentation: rung 2 for the beginner — a fragment of the compose-spec on `depends_on`; rung 3 for the intermediate — docker.f07 (`--wait`). Summary.

**m10. Security.** Leading question: "how is root in a container different from root on the host?" 1) Without a user namespace it is the same UID 0 in the kernel, restricted by a set of capabilities (D30). 2) Docker's default set is 14 capabilities: CHOWN, DAC_OVERRIDE, FSETID, FOWNER, MKNOD, NET_RAW, SETGID, SETUID, SETFCAP, SETPCAP, NET_BIND_SERVICE, SYS_CHROOT, KILL, AUDIT_WRITE (checked against a golden recording). 3) The default seccomp profile is coordinated with capabilities: an added capability also opens the related system calls (with `SYS_ADMIN`, `mount` is allowed); AppArmor `docker-default` on Ubuntu forbids `mount` regardless. 4) `--privileged` — all capabilities, host devices, seccomp and AppArmor turned off; almost an escape. 5) Narrowing: `USER`, `--read-only` with tmpfs, `--cap-drop ALL` and targeted `--cap-add`, `no-new-privileges`, limits. 6) User namespace: rootless Docker and userns-remap (with the documentation's caveat: the containerd image store is unavailable with userns-remap; D31). 7) The image: a minimal base, secrets in layers, scanning (Trivy, Docker Scout — an overview with a sample report; D22). 8) Documentation: rung 2 for the beginner — a fragment of `capabilities(7)` about `CAP_NET_BIND_SERVICE`; rungs 3–4 for the intermediate and experienced. Summary.

**m11. Under the hood of Docker.** Leading question: "what does each component of the chain do, and what happens if one of them crashes?" 1) X1 at full depth: the socket's HTTP API, `Snapshots.Prepare`, containerd tasks, shim, `runc create/start`. 2) Shim and `live-restore`: what survives a dockerd restart. 3) The image store: in Engine 29 on new installations — the containerd store (snapshotter), on upgraded hosts — `overlay2` in `/var/lib/docker`; where the layers are in each case (D33). 4) Network rules: Docker's iptables chains in the current version (per the golden recording), `docker-proxy` for requests from the host itself, the experimental nftables backend (`firewall-backend`) in Engine 29. 5) Documentation: rungs 3–4 — containerd docs, moby release notes. Summary.

**m12. Node runtime: `box` and several machines.** Leading question: "what needs to be added to my script so that Kubernetes can use it?" 1) `box` as a tool: pull from the course registry, unpacking with whiteout conversion, pod sandbox, containers with shared net/ipc/uts (D32). 2) Two v86 machines on a shared switch, each with its own container subnet; containers on different nodes do not see each other; add a route — and they do, without NAT (explainer X9). 3) Conclusion and bridge: this is what the Kubernetes network model looks like; CNI does it for you (05, R9). Documentation: rungs 3–4 (`ip-route(8)`, runtime-spec on `linux.namespaces[].path`).

**m13. Real Docker on a VM.** Section 18.

**m14. Interview.** Section 19.

---

## 5. The documentation ladder (R2)

### 5.1. Rungs in this block

| Rung | Where in the block | What it looks like | Check |
|---|---|---|---|
| 1. Glimmer | Beginner: m01–m05 | Under a command and under a concept in the text — a faint line "this comes from here" with a link to the exact anchor: `docs.docker.com/reference/cli/docker/container/run/#publish`, `man7.org/linux/man-pages/man7/namespaces.7.html#…`. Opening it is optional | None; the click is logged for analytics |
| 2. Fragment | Beginner: m06–m10, m04; intermediate: m01–m05 | The hint for an exercise is not the answer but a clipping from the real help with the line highlighted and the parts of the page labeled: for `--help` — Usage / Options / Aliases, for man — NAME / SYNOPSIS / DESCRIPTION / OPTIONS / EXAMPLES, for the Dockerfile reference — the instruction heading and an example. Under the clipping, an "open the whole page" link | As usual, by state |
| 3. Find the flag | Beginner: m11–m14; intermediate: m06 onward; experienced: from m01 | The task names the effect, and the link leads only to the page without an anchor; no hints. The result is checked | By state or saved output (5.4) |
| 4. Forcing | Intermediate: m10–m13, exam E4; experienced: m04 (seccomp), m06 onward | The task requires a flag, instruction or field that was not in the theory. No hints. For any question, the AI first asks "where did you look?" and names only the source (5.7) | By state; the log shows whether the learner named a source (does not affect grading) |
| 5. Exam | E1–E4 | Only the official documentation from the allowlist (5.6) is open, the AI is off; every exam has one task on something that is not in the course | By state |

A beginner is not sent to the documentation from scratch: until m06 they have only rung 1, and no task requires opening a page. From m11 rung 3 is mandatory for them too. The experienced learner starts at rung 3: the rung-2 hints are hidden in their route, and tasks docker.f01–f05 are already mandatory in m02–m05.

### 5.2. Format of links and fragment hints

Links for rungs 1–3 are stored in the lesson YAML in the `docs` field, and the rung-2 hint in the `doc_hint` field. The clipping text is taken not from the network but from the 09 platform's `docs.snapshot`: `--help` output — from the golden recording of the same Engine version that the simulator's `docker version` shows; man pages — from the `man-pages`, `util-linux-doc`, `libcap-doc` packages of the `lab-alpine` image; web pages — as a snapshot on the date of the golden recording.

```yaml
docs:
  - {tool: man, page: "unshare(1)", anchor: "OPTIONS", line: "--fork"}
  - {url: "https://docs.docker.com/reference/cli/docker/container/run/", anchor: "publish"}
doc_hint:
  source: {kind: cli-help, cmd: "docker container run --help", version: engine}   # cli-help | man | web
  anchor: "--stop-timeout"          # the line we highlight
  context_lines: 3                  # lines around it
  anatomy: [usage, options]         # which parts of the page to label
  url: "https://docs.docker.com/reference/cli/docker/container/run/#stop-timeout"
```

### 5.3. Help in dsim

`docker <cmd> --help` output is shown in full, as in the golden recording. Flags that the trainer does not execute are shown faint (ANSI faint) in the output, without explanation. To an unsupported flag the trainer responds with one line: `dsim: flag --xyz is not simulated here; it works on a real Docker Engine (module m13)` — and does not say what the flag does: the learner finds out its meaning from `--help` or docs.docker.com, as intended. Every flag that a rung 3–5 task relies on must be executable; CI checks this against the list `content/docker/ladder-flags.yaml`.

### 5.4. Rung 3 "find the flag" tasks

| ID | Task | Where to look (link without an anchor) | Check |
|---|---|---|---|
| docker.f01 | Show only the IDs of stopped containers | `docker ps --help` | the saved output matches `docker ps -aq --filter status=exited` |
| docker.f02 | Give the `web` container 30 seconds for a graceful shutdown, without changing the image and without passing anything to `docker stop` | `docker run --help` | `containers[name=web].hostConfig.stopTimeout=30` |
| docker.f03 | Show the `api` log only for the last 2 minutes, with timestamps | `docker logs --help` | a call with `--since` and `-t`; the output contains no lines older than two model minutes |
| docker.f04 | Find out with one command whether the `worker` container was OOM-killed and how many times it was restarted | `docker inspect` + Go templates | answer = `oomKilled`, `restartCount`; `--format` in the history |
| docker.f05 | (v86) Run `unshare` so that `/proc` is mounted automatically | `man unshare` | a process in a new pid ns, `/proc` mounted inside; `--mount-proc` in the history |
| docker.f06 | Show the size of each container's writable layer | `docker ps --help` | a call with `-s`; the answer matches `sizeRw` |
| docker.f07 | Bring up a compose project and wait until all services are healthy, with one command | `docker compose up --help` | a call with `--wait`; all services healthy at the moment it returns |
| docker.f08 | Show which volumes exist and how much space they take | `docker system df --help` | a call with `-v` |
| docker.f09 | (v86) Enter only the network namespace of the `httpd` process, staying in the host's file system | `man nsenter` | in the shell `ip a` shows `veth-box`, while `ls /opt/images` works: `procs[...].ns.net` = the container's ns, `ns.mnt` = the host's |
| docker.f10 | Find out which processes own the machine's network namespaces | `man lsns` | a call with `-t net`; the PID in the answer matches |

### 5.5. Rung 4 "forcing" tasks

| ID | Task | Needed but not introduced in the theory | Check |
|---|---|---|---|
| docker.p01 | A Python application does not stop within 10 s; the code cannot be changed, `--init` is forbidden | `STOPSIGNAL SIGINT` or `--stop-signal` | `config.StopSignal=SIGINT` or `hostConfig.stopSignal`; `stopDurationMs<1000` |
| docker.p02 | A container's log filled the disk; limit it to three files of 10 MB | `--log-opt max-size=10m --log-opt max-file=3` or `logging:` in compose | `hostConfig.logConfig.config.max-size=10m`, `max-file=3` |
| docker.p03 | `pip install` downloads packages again on every legitimate rebuild of the layer; speed it up | `RUN --mount=type=cache,target=/root/.cache/pip` | `builds[-1]` has a step with `mount cache`; the second build after changing requirements does not download what was already downloaded (model) |
| docker.p04 | nginx running as an unprivileged user must listen on port 80 without `NET_BIND_SERVICE` | `--sysctl net.ipv4.ip_unprivileged_port_start=0` | `user!=0`, `capAdd` empty, `http :80 = 200` |
| docker.p05 | The application needs to open 65536 files | `--ulimit nofile=65536:65536` | `exec(ulimit -n)=65536` |
| docker.p06 | Get a file out of a container that crashed and does not start | `docker cp` from a stopped container | the file is in the project, the sha matches |
| docker.p07 | Add the entry `legacy.db → 10.0.0.5` to the container's `/etc/hosts` | `--add-host` | `exec(getent hosts legacy.db)` = 10.0.0.5 |
| docker.p08 | Change the restart policy of a running container without recreating it | `docker update --restart` | the same `id`, a new `restartPolicy` |
| docker.p09 | Show the platforms of the `nginx` image in the course registry without pulling the image | `docker manifest inspect` or `docker buildx imagetools inspect` | the saved output contains all platforms of the index; `images` did not change |
| docker.p10 | Find out which container hit OOM in the last hour without going through inspect one by one | `docker events --filter event=oom --since 1h` | the name in the answer matches |
| docker.p11 | (v86, experienced) Run the host's `tcpdump` in the container's network namespace | `nsenter -t PID --net` | a tcpdump process with the container's `ns.net` and the host's `ns.mnt` |
| docker.p12 | (v86) Run a command in an already running crun container | `crun exec` | a process with the container's ns and the `cmd` from the task |
| docker.p13 | (v86) Forbid a process in a crun container from gaining new privileges through setuid | `"noNewPrivileges": true` in `config.json` (runtime-spec) | `procs[...].status.NoNewPrivs=1` |
| docker.p14 | (v86, experienced) Forbid the container the `mkdir` system call | `linux.seccomp` in `config.json` (runtime-spec `config-linux.md`) | `exec(mkdir /x)` → EPERM; `procs[...].status.Seccomp=2` |

### 5.6. Rung 5: exams

The exam reader tab opens only: docs.docker.com (reference and manuals), compose-spec.io and github.com/compose-spec, man7.org (sections 1, 2, 7, 8), docs.kernel.org (cgroup-v2, overlayfs), github.com/opencontainers (image-spec, runtime-spec, distribution-spec), and in the terminal — `--help` and `man`. Other addresses do not open. The tab is shared with the Kubernetes block (a mode similar to the CKA), and the allowlist is the exam's `docs_allowlist` field per the 10 schema. Tasks outside the course are listed in section 17.

### 5.7. AI behavior at rung 4

On rung-4 tasks the mentor does not name the flag, instruction or field. To the question "how do I do X" it first asks: "Where have you already looked?" If the learner has not looked, the mentor names one page without the answer: "`docker run --help`, the section on resources", "`man 7 capabilities`, search for the word bind", "the Dockerfile reference, the instruction that sets the stop signal". If the learner quoted the line they found and did not understand it, the mentor explains the help line, not the task. The mentor's context receives `ladder_step: 4` and the lesson's `docs` field; in 09 this is the flag `hint_policy: point-to-docs`.

### 5.8. Which pages the block needs in `docs.snapshot`

`docker run|create|ps|logs|inspect|stop|cp|update|events|build|network|volume|system df|manifest --help`, `docker compose up|config --help`, `docker buildx imagetools --help`, the Dockerfile reference, compose-spec (`services`, `depends_on`, `logging`), Docker docs: storage/containerd, network/drivers/bridge, network/packet-filtering-firewalls, firewall-nftables, security/seccomp, security/apparmor, logging/configure, `crun(1)`, `unshare(1)`, `nsenter(1)`, `lsns(8)`, `capsh(1)`, `pivot_root(8)`, `ip-route(8)`, `namespaces(7)`, `pid_namespaces(7)`, `user_namespaces(7)`, `cgroups(7)`, `capabilities(7)`, OCI runtime-spec `config.md`, `config-linux.md`, `runtime.md`, image-spec `manifest.md`, `config.md`, `layer.md`, `image-index.md`, `annotations.md`, distribution-spec `spec.md`.

---
## 6. Process explainers (R3, R4)

### 6.1. General rules

An explainer is the `stepper` widget from 08 (3.1) over a live `diagram` (3.2) with `breakit` toggles (3.5). The diagram's state at time t is a fold of the events up to t, so the steps go forward and backward, pause and are scrubbed with a timeline; this is not a video. Any parameter change recomputes the scenario from step 0 and leaves the learner on the same step; to the right of the diagram appears a line "what changed and why". Every "break it" toggle requires a prediction before switching it on (08, 3.5). Labels sit on the lines. One scene — one idea. Every element is clickable and opens a card: what it is, who creates it, which command or file shows it, a link to the documentation page at the learner's rung.

Animation is basic only: a call arrow travels along a line, a rectangle appears or fades, a gauge grows, a counter changes its number. No characters, no plot, no decoration. Colors are the 08 tokens (5.2): `--c-kernel` for the kernel, `--c-user` for processes, `--c-ns-*` for namespaces (an eighth shade for `time` is being added to 08), `--c-l2…l7` for network layers, `--c-ok/err/warn` for states, always with a duplicating shape.

All explainers work without v86: they take events from dsim/netlab or from facts recorded on the test bench. A live v86 only adds a terminal. In calm mode transitions between steps are instant, continuous playback is off, and scrubbing remains, because it is control, not animation. Error texts on diagrams and in the terminal are verbatim from golden recordings.

The block's explainers: X1 `docker run` from command to process; X2 `docker build` layer by layer with the cache; X3 `docker pull` by manifest; X4 hardware → VM → containers → nesting; X5 the six boundaries; X6 `-p 8080:80` as DNAT; X7 `docker stop`: signals and PID 1; X8 container states; X9 a packet between containers on two machines.

### 6.2. X1. `docker run -d -p 8080:80 --memory 64m nginx` — from command to process

**Diagram.** A sequence diagram: six lanes from left to right — `docker` CLI · `dockerd` · `containerd` · `containerd-shim-runc-v2` · `runc` · kernel (the `--c-kernel` band at the bottom, with the rows `namespaces`, `cgroup`, `mount`, `netfilter` inside it). Time flows from top to bottom. On the right — the "what changed and why" column. At the bottom — a strip of labeled steps.

1. **Request.** On screen: a CLI → dockerd arrow over the label `/var/run/docker.sock`, with `POST /containers/create` on the arrow. Moves: the arrow. Clicking the arrow expands the JSON body (`Image`, `HostConfig.PortBindings`, `HostConfig.Memory=67108864`). Explanation: "The CLI starts nothing itself — it sends an HTTP request to the daemon."
2. **Image.** On screen: on the dockerd lane, a block "is the image present locally?". Parameter: a toggle "image already present locally". When off, a collapsed "pull" block appears on the diagram with a link to X3, the steps below shift, and the "time to start" counter grows by the time it takes to download the layers.
3. **Snapshot.** On screen: a dockerd → containerd arrow labeled `Snapshots.Prepare(key, parent=ChainID)`; on the kernel's `mount` row the line `overlay lowerdir=…:…,upperdir=…,workdir=…` appears. Clicking the line opens the link to screen F of interactive 2.
4. **Network.** On screen: on the kernel row a veth pair appears between `docker0` and the future net namespace, the address `172.17.0.2` from IPAM, and on the `netfilter` row the rule `DNAT tcp dpt:8080 → 172.17.0.2:80` (the rule text is verbatim from the golden recording of the Engine version that `docker version` shows). Parameters: a `-p` toggle (off — the rule does not appear, explanation: "the port is not published: from outside you cannot reach 172.17.0.2:80, from the host you can"); a `--network bridge | host | none` switch (host — no veth and DNAT are created, the process is on the host's network; none — only `lo` in the net namespace).
5. **Task.** On screen: `POST /containers/{id}/start` → containerd `Tasks.Create` → a shim rectangle appears; it stays until the end.
6. **Process creation.** On screen: shim → `runc create`; on the kernel row appear `clone(CLONE_NEWPID|CLONE_NEWNS|CLONE_NEWNET|CLONE_NEWUTS|CLONE_NEWIPC|CLONE_NEWCGROUP)`, the write `memory.max = 67108864`, `pivot_root`. Parameter: a `--memory` slider 16–512 MB changes the number on the `memory.max` line; the "no limit" position writes `max`.
7. **Start.** On screen: `runc start` → `execve("/docker-entrypoint.sh")`; the runc lane fades with the caption "runc exited, the process remained a child of shim".
8. **Result.** On screen: the host's `ps -ef --forest`, with the path `containerd-shim-runc-v2 → nginx: master → worker` highlighted; the CLI received the ID and exited. The "time by stage" counter comes from the golden recording.

**Lenses.** A point-of-view switch (Sankofa's lens mechanism): "what the CLI / dockerd / containerd / shim / runc / kernel sees". The selected lens keeps only the calls this component makes and receives bright; everything else fades. The seventh position is "guest kernel": the lane appears empty with the caption "a container has no kernel of its own; in the VM diagram this lane is filled with the kernel boot".

**Break it.** (a) "Stop containerd" — at step 3 dockerd gets `failed to dial "/run/containerd/containerd.sock"`. (b) "Stop dockerd after step 8" with a `live-restore` toggle: off — the containers stop together with the daemon; on — they keep running, held by the shim. (c) "Remove the shim from the chain" — an explanation that then a containerd restart would kill the container and lose the exit code. (d) "Port 8080 is taken by another process" — step 4 ends with `Bind for 0.0.0.0:8080 failed: port is already allocated`. (e) "A VM instead of a container" — a filled "guest kernel" lane with a boot is added, and the time counter grows by two orders of magnitude.

Depth: in m03 and m05 steps 1, 2, 5, 7, 8 are shown large and the rest are collapsed into one line; in m11 — all steps and all "break it" toggles.

### 6.3. X2. `docker build` layer by layer, with the cache

**Diagram.** On the left, a six-line Dockerfile: `FROM python:3.13-slim`, `WORKDIR /app`, `COPY requirements.txt .`, `RUN pip install -r requirements.txt`, `COPY . .`, `CMD ["python","main.py"]`. On the right, a stack of layers grows from bottom to top as even rectangles with sizes. Between them, a "cache key" column with short hashes in the form `sha256(parent + "RUN pip install…")`. At the top right — the config sheet. Counters: build time (golden recording model), context bytes sent to the builder, image size.

1. `FROM` — the stack of base layers appears all at once; caption "taken from local storage or downloaded via X3".
2. `WORKDIR /app` — no layer; `WorkingDir` is highlighted on the config sheet; the caption on the arrow is "metadata only".
3. `COPY requirements.txt .` — the content sha256 "travels" along the line from the file to the key; key = (parent, text, file hashes); a new layer.
4. `RUN pip install` — a layer; a stopwatch with model time.
5. `COPY . .` — a layer; the hash is computed over the whole context, taking `.dockerignore` into account.
6. `CMD` — config only.

**Parameters.** A "what changed" switch: `main.py` / `requirements.txt` / `README.md` (in `.dockerignore`) / nothing. A "rebuild" button. On recomputation, layers from the cache turn gray with a `CACHED` mark, rebuilt ones are marked with their time; a red line "the cache is invalid from here" is placed at the first changed step, and the explanation names the changed component of the key: "`main.py` changed → the checksum of the `COPY . .` context changed → this layer and everything above it were rebuilt; `pip install` lower in the stack comes from the cache." The `COPY . .` line can be dragged above `RUN pip install` — after that any code edit reinstalls the dependencies, and the time counter shows it. A `--no-cache` toggle.

**Break it.** (a) Delete `.dockerignore` — the context counter jumps by the 200 MB of `testdata/`, and `COPY . .` no longer hits the cache because `.git` changes. (b) `RUN rm -rf /var/lib/apt/lists/*` on a separate line — the layer with the deletion weighs almost nothing, the image size counter does not decrease, and the previous layer still sits in the stack.

Depth: beginner — the steps and the "what changed" parameter; intermediate and experienced — everything, plus for the experienced a second tab with `RUN --mount=type=cache` (rung 4, docker.p03).

### 6.4. X3. `docker pull nginx:1.30-alpine` by manifest

**Diagram.** A sequence diagram with lanes: client (`dockerd`/containerd) · registry `/v2/` · token service · blob storage. On the right — expandable index, manifest and config documents.

1. `GET /v2/` → `401`, on the line the header `WWW-Authenticate: Bearer realm=…,service=…,scope=repository:library/nginx:pull`.
2. `GET /token?scope=…` → a token (clicking expands the JWT).
3. `HEAD /v2/library/nginx/manifests/1.30-alpine` → on the line the `Docker-Content-Digest` header.
4. `GET` of the same manifest with `Accept: application/vnd.oci.image.index.v1+json, …` → an index with the list of platforms.
5. Choosing a platform → `GET …/manifests/sha256:…` → the manifest.
6. `GET …/blobs/sha256:<config>`.
7. Layers: parallel `GET …/blobs/sha256:<layer>` arrows with download bars; after each — a sha256 check (a checkmark) and unpacking into a snapshot.

**Parameters.** Platform `linux/amd64 | linux/arm64 | linux/386` — the manifest and the set of layers change. A toggle "`alpine:3.22` already pulled" — shared layers are marked `Already exists` and are not downloaded. A toggle "pull by digest" — steps 3–4 merge, no tag is needed.

**Break it.** (a) "Move the tag to a new build" — by tag a new digest arrives, by digest the old image. (b) "Swap a byte in a blob" — the sha256 check fails, an error line from the golden recording appears on the line, and the pull is aborted. (c) "Withhold the token" — `401` → `pull access denied`. (d) "Anonymous request limit" — `429 toomanyrequests` and an explanation of where this comes from at Docker Hub.

The explainer works against the same course registry as the exercises and the experienced learners' manual pull with `curl` (11.6): the registry request log and the X3 steps match line by line.

### 6.5. X4. Hardware → VM → containers → nesting (R7c)

**Diagram.** Towers of layers made of even rectangles with labels; the kernel is `--c-kernel` everywhere, the hypervisor has its own color with a label. Above the towers — three counters: "memory used / total", "time to start one more application", "share of CPU spent on overhead". The counter model opens on click: VM = guest OS base + application, kernel boot; container = application + a few megabytes, process start. Default values come from the test bench; after screen 7 the numbers measured by the learner are substituted.

1. **One server.** The tower `server` → `kernel` → `OS` → `app A`, `app B`. A toggle "A and B require different versions of libssl": B is marked ⨯ "does not start". Server load about 10%. Introduces D01.
2. **VM.** Next to it the tower `server` → `hypervisor` → N × (`guest kernel` → `OS` → `app`). A "number of applications" slider 1–50: the tower grows, the counters are recomputed instantly, and when memory runs out the caption says: "memory ran out at the 14th VM". Clicking `hypervisor` — type 1 and type 2. Introduces D02.
3. **Containers.** A third tower `server` → `host kernel` → N × (`rootfs + app` in dashed namespace frames above a cgroup gauge). The same slider: at N = 50 memory barely grows, start takes fractions of a second. Clicking a frame — which namespaces and cgroup (links to the Linux R6 module). Introduces D06.
4. **A kernel vulnerability.** A toggle "vulnerability in the kernel": in the VM tower one guest kernel band turns red and the other VMs are intact; in the container tower the shared kernel band turns red and all N frames get a red outline. Explanation: "for containers the isolation boundary is inside one kernel, for VMs it is the hypervisor; this is why untrusted code is run in VMs or in sandboxes (gVisor, Kata Containers)". A card about seccomp and user namespace as ways to narrow the attack surface. Introduces D07.
5. **A different kernel.** A toggle "the application needs a different kernel or OS" (a Windows program, an old kernel): in the container tower ⨯ "a container uses the host kernel", in the VM tower — it works.
6. **Today: nesting.** A three-position switch, the towers rebuild with a transition: (a) "cloud" — `provider hardware` → `hypervisor` → `customer VM` → `VM kernel` → containers (this is how almost any managed Kubernetes works); (b) "Kubernetes on bare metal" — `hardware` → `kernel` → `kubelet` → pod containers; (c) "a VM inside Kubernetes" — `hardware` → `kernel` → `kubelet` → the `virt-launcher` pod (a container) → QEMU/KVM → `guest kernel` → `app` (KubeVirt; this is how Cozystack gives VMs to tenants). Clicking `virt-launcher`: "a VM is an ordinary QEMU process inside a pod's container, and Kubernetes schedules it like a pod". The counters on this screen are "how many kernels are in the tower" and "where the isolation boundary is" (a thick line). Conclusion: "a container and a VM are not rivals but layers that are nested inside each other according to the isolation needed".
7. **Where we are now.** A fourth tower — the learner's laptop: `hardware` → `laptop OS` → `browser` → `v86 (x86 emulator)` → `Linux 6.12 i686 kernel` → (later, in m02) `crun container`. Next to it the v86 terminal (practice below). Check: the learner clicks the layer of the tower where their shell is running right now.

**m01 practice (v86, `lab-alpine`), without containers.**

```sh
cat /sys/class/dmi/id/bios_vendor          # SeaBIOS — the emulator's firmware
dmesg | grep -i -E 'virtio|9p|DMI|Hypervisor' | head
cat /proc/cpuinfo | grep -m1 'model name'  # the CPU that the emulator reports
uname -r                                   # the guest kernel
```

What exactly `dmesg` shows in v86 is checked on the spike: v86 may not set the hypervisor CPUID bit, in which case we rely on virtio, 9p and SeaBIOS.

**m02 practice (continuation of X4 after interactive 1).**

```sh
uname -r; box exec web web -- uname -r      # one kernel
ps -e | wc -l; box exec web web -- ps -e | wc -l
time box start hello -- true                 # container start
```

The VM measurement: the "boot a second machine from scratch" button starts a second v86 instance in a separate Worker with the same kernel and root **without** `initial_state` (a cold boot, on the order of 20–30 s; the course's first machine is always restored from a snapshot in 1–3 s, so it cannot be used for comparison). The stopwatch runs until the `TRAINER_READY` event and is shown next to the output of `time box start`. Memory: `free -m` in the first guest and the memory of the second instance (`performance.measureUserAgentSpecificMemory()` where available, otherwise the machine's `memory_size`). Check: both numbers were obtained (the readiness event and the saved `time` output), the learner entered them into the comparison table, and the numbers became parameters of the model for screens 2–3. On a phone the second machine does not boot, and the recorded numbers from the test bench are used.

### 6.6. X5. The six boundaries of a container

**Diagram.** In the center — the container process (a rectangle with `comm` and a double PID) in dashed namespace frames above the kernel band. Around it — the six sides of a hexagon, each with its own color and label: "host kernel", "network", "storage", "process and signals", "input/output", "configuration and identity". From each side, a thin line goes outward to what the boundary connects to: system calls and sysctl; veth → `docker0` → NAT; overlay upper, volume, bind, tmpfs; signals from the shim; stdout/stderr → shim → log driver → file; env, secrets, UID ↔ uid_map.

1. **Six sides.** All sides are visible; clicking a side expands the flow that passes through it: a packet along the network line, a file along the storage line, a signal along the process line, a log line along the input/output line, a variable along the configuration line. Animation — a marker dot travels along the line.
2–7. **One side per screen.** Each screen expands one side in detail: what passes through it, which command shows it (a `docker inspect` field, a file in `/proc`, an iptables rule), a link to the chapter. Screen parameters: network — a `bridge | user-network | host | none` switch; storage — a switch "where `/data` lives: upper / volume / bind / tmpfs" and a "`docker rm` and a new `run`" button (the data disappears or stays); process — a switch "PID 1: sh / an application without a handler / an application with a handler / tini" (link to X7); input/output — a switch "the application writes to stdout / to a file / to stdout with buffering" and a `max-size` slider; configuration — a process UID slider 0–2000 and the owner field of the bind-mounted directory (the write succeeds or gets `Permission denied`), a user namespace toggle (`uid_map 0 100000 65536`); kernel — an image platform switch (`amd64`/`arm64`) and a toggle "sysctl from the namespace / host only".
8. **Where did it break?** A "break it" toggle on each side turns on a typical breakage from table 12.1; in the terminal next to it the real symptom from the golden recording appears. The learner first picks a side, and only then is the side highlighted and the explanation opened. A wrong choice is explained: "`Connection refused` is not storage: the file has nothing to do with it, the refusal came from a socket; look at the network, layer L4."

### 6.7. X6. `-p 8080:80` as DNAT (the "network" boundary, R8)

**Diagram.** From left to right: client → host `eth0` → the `PREROUTING` / `DOCKER` chains of the nat table → `docker0` → veth → container `eth0` → the process's socket. The packet is drawn by the `packets` animator from 08 (3.6) as nested envelopes of layers L2–L7 in `--c-l*` colors; at each device the envelope opens down to the layer that device reads.

1. A packet `dst 203.0.113.10:8080` arrives at the host's `eth0`.
2. At `DOCKER` — DNAT: the line is labeled `dport 8080 → 172.17.0.2:80`, in the envelope the old value is crossed out and the new one written next to it.
3. Routing into `docker0`, veth, into the container's net namespace.
4. The process's socket accepts the connection; the reply goes back with the reverse substitution (conntrack).

**Parameters.** A toggle "the application listens on 127.0.0.1" — the packet reaches the namespace and gets an RST, with the layer caption "L4: the socket is on a different address". A toggle "request from the host itself" — the `OUTPUT` chain instead of `PREROUTING`, and in `userland-proxy: true` mode (the default) the connection is accepted by the `docker-proxy` process (`ss -ltnp` from the golden recording). A `--network host` toggle — DNAT disappears, and the process's port is the host's port. A "rule backend" switch: `iptables -t nat -S` / `nft list ruleset` (for the experienced; Engine 29 has an experimental nftables backend).

**Break it.** "Turn off `ip_forward` on the host" — the packet stops at `docker0`, caption "L3: the host does not forward"; "delete the MASQUERADE rule" — the container cannot get out, the reply does not come back.

### 6.8. X7. `docker stop`: signals and PID 1

**Diagram.** Lanes: `docker stop` · dockerd · shim · the container's PID 1 · a child process. Under the PID 1 lane — the process's table of signal handlers (from `/proc/<pid>/status`, the `SigCgt` field, decoded). The `--stop-timeout` timer (10 s) runs as a bar.

1. `docker stop` → dockerd → shim → `kill(PID1, SIGTERM)` (or the signal from `StopSignal`).
2. The kernel: does PID 1 have a handler? The fork is drawn as two lines.
3. Yes — the application exits, code 0 or 143.
4. No — the signal is ignored (the kernel rule for the init of a pid namespace, `pid_namespaces(7)`), the timer reaches 10 s, `SIGKILL`, code 137.

**Parameters.** A "what is PID 1" switch: `sh -c "python app.py; echo exited"` (shell form, sh remains the parent and does not forward the signal) / `python app.py` in exec form without a handler / the same with a SIGTERM handler / `--init` (tini as PID 1 forwards the signal to the child, which is no longer PID 1 and dies by the default action, code 143). A `--stop-timeout` slider 1–60 s. A `STOPSIGNAL` switch: `SIGTERM` / `SIGINT` (Python handles SIGINT as `KeyboardInterrupt`). On recomputation the explanation always names which of the three conditions applied.

**Break it.** "PID 1 does not reap its children" — every time a child process starts, `[sh] <defunct>` appears on the lane and the zombie counter grows; `--init` resets it to zero.

### 6.9. X8. Container states

**Diagram.** Two graphs side by side. On the left — Docker: nodes `created`, `running`, `paused`, `restarting`, `exited`, `dead`, `removing`; edges labeled with commands and events: `create`, `start`, `pause`/`unpause`, `stop`/`kill`/process exit, `restart` (policy), `rm`. A removed container is not a state: after `rm` the node disappears. On the right — the OCI runtime: `creating → created → running → stopped` with the edges `create`, `start`, process exit, `delete`.

Steps: the learner walks one container through the graph; the current node is highlighted; clicking a node shows what exists in the system at that moment (is there a process, an upper layer, a cgroup) and which command shows it (`docker inspect -f '{{.State.Status}}'`, `crun state`). Parameter: the restart policy `no | on-failure | always | unless-stopped` and a toggle "the process crashed with code 1" — the graph shows the transition through `restarting` or into `exited`. In dsim the state panel highlights the same graph for each container.

### 6.10. X9. A packet between containers on two machines (m12, bridge to R9)

**Diagram.** Two v86 machines (`node1`, `node2`) and between them the course's shared JS switch (03/09), drawn as in the networking block. Each machine has a `cni0` bridge (`10.244.1.0/24` and `10.244.2.0/24`) and one container. The packet is an envelope from the `packets` animator.

Steps: `ping 10.244.2.2` from the container on `node1` → `cni0` → the `node1` routing table → no route → the packet goes to the default gateway and is lost (⨯, caption "L3: no route"). Parameter: a toggle "route `10.244.2.0/24 via node2` on node1" and the same reverse route on node2 — the packet passes through the switch, the IP header does not change (caption "no NAT"). A second switch (for the experienced, a transition to 05): "routes / VXLAN" — the packet is wrapped in an outer UDP envelope with `dport 4789`. Explanation of the result: "each container has its own address that is visible from another node without NAT — this is the Kubernetes network model; CNI does for you what you did with routes".

### 6.11. Correspondence with the 08 scenes

The 08 storyboards (6.1 "What happens inside a container", 6.2 "How an image is packaged") are the widget framework; the content, environment and order follow this document. The 08 scenes "0. The room" and "0. The stack of tracing paper" (ink) are removed in both documents. The 08 scenes 6.1.2–6.1.7 (namespaces, cgroups, chroot, capabilities) move to the Linux R6 module. The lab runs on v86 by default, with the Stand as a fallback in recorded mode.

| 08 scene | Here |
|---|---|
| 6.1.1 "An ordinary process" | m02 roll call |
| 6.1.2–6.1.7 | the Linux R6 module (not here) |
| 6.1.8 "Container or VM" | X4 |
| 6.1.9 "Do it yourself in bash" | lab m04 (section 9) |
| 6.1.10 "Scene exam" | m04 quiz (section 16) |
| 6.2.1 "Dockerfile line by line" | X2 |
| 6.2.2–6.2.4 layer, hash, manifest | interactive 2, screens A–E |
| 6.2.5 overlayfs | interactive 2, screen F (overlayfs as a mechanism — in Linux) |
| 6.2.6 cache | X2, parameters |
| 6.2.7 multi-stage | m07, section 6 of the chapter |

---

## 7. Interactive 1. "A container from familiar parts"

### 7.1. Goal

Show on a live container that it is a host process with non-shared namespaces and in its own cgroup, visible simultaneously from the container and from the host. The data is live: a container `box start web` is running in v86, and `trainer-agent` in `watch` mode returns snapshots.

### 7.2. Screen

Two vertical zones whose colors mean the same thing throughout the course. At the bottom — **kernel space** (`--c-kernel`): a band "Linux 6.12 (one kernel)" with eight horizontal lanes inside, one per namespace kind: `pid`, `mnt`, `net`, `uts`, `ipc`, `user`, `cgroup`, `time`. Each lane has instance rectangles with an inode number (`4026531836`) in a monospaced font. On the right of the kernel band — the cgroup v2 tree (`/`, `/box/web`, `/trainer`) with three gauges at the container's node: memory, cpu, pids (a thin fill bar, a limit tick with a number, `current / max`).

Above — **user space** (`--c-user`): processes as rectangles with `comm` and PID. From each process thin lines go down, one to its instance in each lane; the line is labeled with the kind and carries the inode from `readlink`. Container processes are enclosed in dashed frames of their namespaces in `--c-ns-*` colors; the inode number is on the frame itself. The host's (initial) namespaces are thin solid frames across the full width. If a namespace is shared with the host, the process has no frame of that color of its own, and this is immediately visible. The double PID is written as `1 · 4123` with the caption "inside · on the host" (from `NSpid:`). To the right of the process — a column of rootfs paths with the mount type for each line (`overlay`, `proc`, `tmpfs`, `bind`) from `/proc/<pid>/mountinfo`. veth is a line from the net frame to the host bridge, with `eth0@if7 ↔ veth3a1f@if6` written on the line.

At the top — **two terminals** side by side: "host" (`ttyS0`) and "container" (`ttyS2`: `inittab` runs a `getty` with autologin on it, whose profile runs `nsenter -t $(box pid web web) -a sh`; after `box rm` the terminal returns to the host with a caption). The `ttyS1` channel is taken by `trainer-agent`.

Clicking any element opens a card: what it is, which kernel file shows it (`/proc/4123/ns/net`, `/sys/fs/cgroup/box/web/memory.max`), which command to look at it with, a link to the man page at the learner's rung.

### 7.3. Parameters and "break it"

- **Namespace toggles**: one per kind, "own / shared with the host". Turning one off restarts `box` with a different `config.json` (without that namespace); the process's lines move to the host instance, the frame disappears within 200 ms, `ps` in the container terminal is recomputed, with an explanation line next to it. For `pid`: "without its own pid namespace the process sees and can send a signal to any host process — this is how `docker run --pid host` works." For `net`: "the container is on the host network: `--network host`." For `mnt`: "the process sees the host root."
- **A `memory.max` slider** 8–64 MB writes the value into the group's file. If `memory.current` is higher, the tick turns `--c-limit`, and the next frame shows an OOM kill: the process fades to an outline with the caption `oom_kill 1` from `memory.events`, and under the gauge — a `dmesg` line.
- **A `pids.max` slider** and a "start 20 processes" button.

### 7.4. Scenario (steps the learner performs by hand)

1. On the host: `box start web` — a container with `sh` and `httpd -f -p 80 -h /www`. Frames appear.
2. In the container: `ps`. `sh` with PID 1 and `httpd` are visible. On the host, `ps -o pid,comm | grep httpd` shows a different number; a line connects the two numbers.
3. On the host: `ls -l /proc/$(box pid web web)/ns/` and `ls -l /proc/self/ns/`. Matching inodes fill the lane with one color. Question: "Which namespaces does the container share with the host?" Answer: `user` and `time` — `box`, like `crun spec`, does not create them; that is why root inside is UID 0 of the host (a forward link to m10).
4. In the container: `hostname`, `ip addr`, `ls /`. The uts, net, mnt lanes are highlighted.
5. On the host: `cat /sys/fs/cgroup/box/web/memory.current` and `echo 16M > /sys/fs/cgroup/box/web/memory.max` (there is headroom: the processes take about 1–2 MB, so there is no immediate OOM). The tick moves.
6. In the container: `head -c 24m /dev/zero | tail` (`tail` keeps the whole input in memory because it contains no newline). The gauge grows, the process is killed; `cat /sys/fs/cgroup/memory.events` inside (through the cgroup namespace this is its own group) shows `oom_kill 1`.
7. An open question with the AI (if connected) or self-check against a rubric: "Why is `uname -r` the same in the container and on the host, while `hostname` differs?"

### 7.5. Modes

**Live** (desktop; a phone with `navigator.deviceMemory ≥ 4`): data from v86. **Recorded** (a weak device, iOS, v86 did not start within 20 s): the same diagram replays recorded fact frames from the test bench; the terminals show recorded output, and input is replaced with a "run the next command" button. The mode is labeled in a corner with one line, "recording from the test bench". **Calm** (`prefers-reduced-motion`, `calm.ts`): frames and gauges change without transitions, and OOM is shown as a change of state.

### 7.6. Data

Snapshots come through `trainer-agent` (09, 1.4): a subscription `{"id":12,"op":"watch","scopes":["procs","ns","cgroups","mounts"],"ms":500}`, replies in the same channel with the same `id`, in the `dt.facts/v1` format. The agent is a single long-lived process without a `fork` per pass (reading `/proc/[0-9]*/status`, `readlink` over `ns/*` using built-in `awk` facilities or a small static binary with its source next to it), polling on change (after every command in the terminal) and no more than once every 2 s when idle. The agent process lives in its own group `/trainer` and is hidden from the diagram by a filter so as not to distort the learner's `cpu.stat` and `ps`. The agent's source is open for reading as learning material. Fields the interactive needs: `procs[].{pid,nspid,ppid,uid,comm,state,cgroup,ns.{8 kinds},status.{CapEff,NoNewPrivs,Seccomp,SigCgt}}`, `ns_host`, `cgroups[].{path,memory.current,memory.max,memory.events,pids.current,pids.max,pids.events,cpu.max,cpu.stat}`, `mounts[pid]`.

---

## 8. Interactive 2. "How an image is packaged"

### 8.1. Goal

Take a real OCI image apart down to the byte: index → manifest → config → layers → files, show that every address is a sha256 of content, and show the assembly of the final file system by stacking layers with whiteout and copy-up.

### 8.2. Where the images come from

1. **The course set** — pre-exported OCI layouts; tags are taken from `content/versions.yaml` as of the golden recording date (as of 18.11.2026: `alpine:3.22` for linux/386 and linux/amd64, `busybox:1.37`, `hello-world`, `nginx:1.30-alpine`). Training images: `trainer/app:1.0` (a multi-stage build of a Go application with a special layer containing a deleted file and a layer with a deleted directory — for whiteout and opaque whiteout) and `trainer/shell-app:1.0` (alpine + busybox-extras + a static site; its layers are used in the lab). Licenses: for images with busybox and GNU utilities we publish a link to the sources (GPL); this is recorded in the media rights register.
2. **The learner's own image** — dragging in a `docker save` file (docker-archive or OCI) or a file exported from dsim. Parsing happens entirely in the browser: a tar parser, gzip via `DecompressionStream`, zstd layers via `fzstd`. Nothing is sent to the server.
3. **From the course registry** via `/v2/` (11.6).

### 8.3. Screens

JSON documents are sheet cards in the technical-drawing style; the links between them are lines with labels on the lines.

**Screen A. "What's on the label".** The learner enters `nginx:1.30-alpine`. The label splits into registry, repository and tag. The tag expands into an **index** sheet (`application/vnd.oci.image.index.v1+json`) with platforms. The learner chooses `linux/amd64` — a line labeled "by digest" leads to the **manifest** sheet. Labels on the lines are mandatory: "by digest", "by mediaType", "by platform".

**Screen B. "The address is a fingerprint".** On the manifest sheet there is a "compute the sha256 of these bytes" button: the hash is computed via WebCrypto and matches the digest by which the sheet was found. The learner changes one character in the JSON — the hash changes completely, and the line breaks with the caption "there is no such document at this address". Conclusion: a digest guarantees that the content was not tampered with, while a tag can be moved.

**Screen C. "Config".** The fields `architecture`, `os`, `config.Env`, `config.Entrypoint`, `config.Cmd`, `config.ExposedPorts`, `config.User`, `config.StopSignal`, `rootfs.diff_ids`, `history`. Clicking a field shows the Dockerfile instruction (`history[].created_by`). Entries with `empty_layer: true` are highlighted: ENV or CMD do not create a layer.

**Screen D. "Two hashes of one layer".** In the manifest a layer is described by the digest of the compressed archive; in the config — by the `diff_id`, the hash of the uncompressed tar. The archive is unpacked, the second hash is computed under it, and the match with `rootfs.diff_ids[i]` is highlighted. For the experienced — ChainID: `ChainID(L0) = DiffID(L0)`, `ChainID(Ln) = sha256(ChainID(Ln-1) + " " + DiffID(Ln))`; the learner computes it in a field with WebCrypto and sees that this is the name of the snapshot in containerd.

**Screen E. "Inside a layer".** Each layer expands into a tree of tar files with mode, owner and size columns. Special entries are highlighted: `.wh.<name>` (whiteout — "the file was deleted in this layer") and `.wh..wh..opq` (opaque — "the directory is completely replaced").

**Screen F. "Stacking".** Layers are even rectangular plates stacked in axonometric view; the mechanic of spreading the stack apart is `layers.ts` (`depth`, `open`), and the drawing is a technical drawing. On top — the `merged` tree. Clicking a file in merged highlights the layer it came from and the layers below where it is overridden. A file deleted by a whiteout is visible in the lower layer but not in merged; caption "the file is still in the image and takes up space". A "start a container" switch adds an empty upperdir plate on top. In a small terminal the learner runs `echo hi >> /etc/nginx/nginx.conf` — copy-up: the file rises from the lower plate to the upper one in full, and only then is the line changed. `rm /usr/share/nginx/html/index.html` — a whiteout appears in upperdir (in the kernel — a 0:0 character device; in a layer tar — `.wh.index.html`; the caption explains the difference). Under the stack — the mount line `mount -t overlay overlay -o lowerdir=L3:L2:L1,upperdir=U,workdir=W merged` with real paths and a link to step 6 of the lab.

**Screen G. "Why the image weighs 1 GB".** A training image of three instructions: `RUN apt-get update && apt-get install -y build-essential`, `RUN make`, `RUN apt-get purge -y build-essential`. Layer size bars show that the third one reduced nothing. The learner merges the instructions into one and sees the recalculation (sizes come from the golden recording). The transition to multi-stage is in m07.

### 8.4. Questions inside the interactive

"Click the layer where `/usr/sbin/nginx` appeared", "Which digest will you pass to `docker pull` to get exactly this image on arm64?", "Which config field determines what starts by default?", "Why does the `ENV` instruction have no layer?". Checking is by the identifier of the selected element (`hotspot`).

---
## 9. Lab "A container with your own hands" (m04)

### 9.1. Environment

Tier B of the 09 platform: v86, the `dt-kernel` kernel, the `lab-alpine` root (Alpine 3.22 x86 over 9p). The machine starts from a saved snapshot (`initial_state`, zstd) in 1–3 s. Guest memory is 96 MB. The guest root is on 9p, so everything to do with overlay and `pivot_root` the learner does in a 32 MB tmpfs `/c` (overlay does not accept 9p as an upperdir, and `pivot_root` requires the new root to be a mount point).

`lab-alpine` packages (a list shared with 09): `busybox`, `busybox-extras`, `util-linux` and `util-linux-misc` (`unshare`, `nsenter`, `lsns`, `pivot_root`, `mount`), `iproute2`, `iptables` (the nft backend, as in Alpine since 3.19) and `nftables`, `libcap` (`capsh`, `getcap`, `setcap`), `attr` (`setfattr`, `getfattr`), `crun`, `jq`, `curl`, `tar`, `strace`, `procps`, `tcpdump`, `wireguard-tools`, `man-pages`, `util-linux-doc`, `libcap-doc`, `mandoc`. Users: `root` and `student` (uid 1000, as in 02). The `/opt/images/` directory: `trainer-rootfs-x86.tar.gz` (minirootfs + `busybox-extras` + a `/www` directory with `index.html` and a CGI script `/www/cgi-bin/hostname` that prints the UTS name), the `trainer/shell-app` layers as tar files. There is no `httpd` in the bare minirootfs (the applet moved to `busybox-extras`), so the bare minirootfs is not used in the lab. The service parts (`trainer-agent`, `box`, the fact collector) arrive over 9p from `/opt/trainer/` and are updated without rebuilding the image.

Boot: the kernel cmdline has `cgroup_no_v1=all`, and `/etc/rc.conf` has `rc_cgroup_mode="unified"`, so that OpenRC mounts a pure cgroup v2 hierarchy at `/sys/fs/cgroup` rather than a hybrid with `/sys/fs/cgroup/unified`. `net.ipv4.ping_group_range` in the guest is left at the default (`1 0`), so that `ping` requires `CAP_NET_RAW` (step 7); this is checked on the spike.

### 9.2. Kernel requirements

The kernel is the shared `dt-kernel` from 09; the block does not maintain its own fragment but passes its requirements into the combined 09 fragment:

- cgroups: `MEMCG`, `CGROUP_PIDS`, `CFS_BANDWIDTH` (without it there is no `cpu.max` file; `virt.x86.config` does not have it — checked). The `cpu` controller is in the base: `SCHED_AUTOGROUP=y` selects `CGROUP_SCHED` and `FAIR_GROUP_SCHED`, but only `CFS_BANDWIDTH` provides `cpu.max`.
- namespaces: `NAMESPACES`, `USER_NS`, `PID_NS`, `NET_NS`, `UTS_NS`, `IPC_NS`, `CGROUP_NS`, `TIME_NS` (default `y`, but pinned explicitly because the lab relies on it).
- file systems: `OVERLAY_FS=y`, `TMPFS_XATTR=y` (overlay with upperdir on tmpfs sets `trusted.overlay.*`, and the opaque directory in step 6 cannot be done without it), 9p built in.
- network: `VETH`, `BRIDGE`, `BRIDGE_NETFILTER`, `NF_CONNTRACK`, `NF_NAT`, `NF_TABLES`, `NF_TABLES_INET`, `NFT_CT`, `NFT_NAT`, `NFT_MASQ`, `NFT_COMPAT`, `NETFILTER_XTABLES`, `NETFILTER_XT_NAT`, `NETFILTER_XT_MATCH_CONNTRACK`, `NETFILTER_XT_MATCH_ADDRTYPE`, `NETFILTER_XT_TARGET_MASQUERADE`, `VXLAN`, `WIREGUARD`, `DUMMY` — all built in (`=y`), so that modules do not have to be loaded over 9p.
- security: `SECCOMP_FILTER`.
- lesson: `IKCONFIG`, `IKCONFIG_PROC` — the learner runs `zgrep -E 'NAMESPACES|USER_NS|MEMCG|OVERLAY|CFS_BANDWIDTH' /proc/config.gz` and sees that containers are a kernel configuration.

In CI, after `merge_config.sh` and `olddefconfig`, each line of the fragment is checked against the final `.config`: a tristate option `=y` with a dependency at `=m` is silently downgraded, and the build must fail. The kernel is 32-bit (v86 does not support 64-bit kernels).

### 9.3. Screen

The 08 split (3.3): on the left the host terminal (`ttyS0`), under it a second terminal (`ttyS2`), so the learner is inside their container and outside at the same time. On the right — the interactive 1 diagram in "assembly" mode: an empty kernel band and host processes; each namespace frame, cgroup gauge and veth line appears when the corresponding step goal passes. Above the terminal — the step card: what we are doing, why, a link to the Linux R6 module lesson, the commands (collapsed for the intermediate — try it yourself first), the expected result. At the bottom `mybox.sh` grows: at the end the learner has a file that repeats everything they did.

### 9.4. Steps

Each step is a repeat of one part of the Linux R6 module in a minute or two; what is new here is assembling the parts into one whole.

**Step 0. Preparing the root.**

```sh
mkdir -p /c && mount -t tmpfs -o size=32m tmpfs /c
mkdir -p /c/rootfs
tar -xzf /opt/images/trainer-rootfs-x86.tar.gz -C /c/rootfs
ls /c/rootfs
```

Goal: `/c` is a tmpfs, and `/c/rootfs/bin/busybox` and `/c/rootfs/usr/sbin/httpd` (or the busybox-extras applet) exist. Diagram: a column of rootfs paths appears to the right of the future process.

**Step 1. chroot — only a different root.**

```sh
chroot /c/rootfs /bin/sh
ls /                   # we see the rootfs, not the host
ps                     # empty or an error: /proc is not mounted
mount -t proc proc /proc
ps                     # ALL host processes are visible
hostname               # the host's name
ls /proc/1/root/       # the host root through /proc of a process outside
chroot /proc/1/root /bin/sh -c 'ls /opt/images'   # we are back in the host root
umount /proc; exit
```

The lesson's conclusion: `chroot` changes only which directory the process considers the root. Processes, network and hostname are shared, and root inside gets out through `/proc/<pid>/root` of any process outside. The classic escape "nested `chroot` and `cd ..`" cannot be shown from the shell: the `chroot` utility does `chdir("/")` after the call, so a dedicated program is needed for it. Goals: the facts contained a process with `root` = `/c/rootfs`; the answer to the question "what of this did chroot isolate?" (files / processes / network / name).

**Step 2. UTS — your own name.**

```sh
unshare --uts sh -c 'hostname box; hostname'
hostname               # the host's name did not change
```

Goal: the hostname is unchanged, and the facts contained a process with `ns.uts` ≠ the host's. The uts frame appears.

**Step 3. PID and mount — your own PID 1.**

```sh
unshare --pid --fork --mount --uts --ipc chroot /c/rootfs /bin/sh
# inside:
mount -t proc proc /proc
ps                     # PID 1 is sh
echo $$                # 1
```

In the second terminal (host):

```sh
U=$(pgrep -n -x unshare)      # the parent: unshare itself stayed in the host pid namespace
P=$(pgrep -P "$U")            # the container's PID 1 as the host sees it
grep NSpid /proc/$P/status    # NSpid: 412 1
readlink /proc/$P/ns/pid /proc/$U/ns/pid /proc/$U/ns/pid_for_children
lsns -p $P
```

The process cannot be found by the string `chroot /c/rootfs`: only the `unshare` parent carries this string, while the child after two `exec`s is already `/bin/sh`. Hence a teaching moment: `unshare --pid` does not move the caller itself into the new namespace; `unshare`'s `ns/pid` is the host's, and `pid_for_children` is the new one. Goal (by attribute, not by command line): there is a process whose last `NSpid` field = 1 and whose `ns.pid` and `ns.mnt` differ from the host's. Diagram: the double number `1 · 412`. Question: "Why is `--fork` needed?" — without it the first process of the new namespace would be not `sh` but its first child; `sh` would get an error when trying to spawn a second process, and `unshare` itself does not enter the new namespace.

**Step 4. cgroups v2 — limits.** On the host:

```sh
stat -fc %T /sys/fs/cgroup                 # cgroup2fs — a pure v2 hierarchy
cat /sys/fs/cgroup/cgroup.controllers
echo '+memory +pids +cpu' > /sys/fs/cgroup/cgroup.subtree_control
mkdir /sys/fs/cgroup/box
echo 16M > /sys/fs/cgroup/box/memory.max
echo 20 > /sys/fs/cgroup/box/pids.max
echo '20000 100000' > /sys/fs/cgroup/box/cpu.max
echo "$P" > /sys/fs/cgroup/box/cgroup.procs
```

Three experiments inside the container: `head -c 24m /dev/zero | tail` (killed; on the host `cat /sys/fs/cgroup/box/memory.events` → `oom_kill 1`); `for i in $(seq 30); do sleep 60 & done` (around the twentieth — `can't fork: Resource temporarily unavailable`); `while :; do :; done &` and on the host `cat /sys/fs/cgroup/box/cpu.stat` (`nr_throttled` grows). The guest has no swap, so we do not touch `memory.swap.max`. Goals are in 15.3. Diagram: three gauges with ticks.

**Step 5. Network — a veth pair.** A new container with its own net namespace:

```sh
unshare --pid --fork --mount --uts --ipc --net chroot /c/rootfs /bin/sh
```

On the host:

```sh
U=$(pgrep -n -x unshare); P=$(pgrep -P "$U")
ip link add veth-host type veth peer name veth-box
ip link set veth-box netns "$P"
ip addr add 10.10.0.1/24 dev veth-host
ip link set veth-host up
```

Inside (the rootfs has no iproute2, but it has `ip` from busybox):

```sh
mount -t proc proc /proc
hostname box
ip link set lo up
ip addr add 10.10.0.2/24 dev veth-box
ip link set veth-box up
ping -c1 10.10.0.1
httpd -f -p 80 -h /www &          # -f: do not go into the background, the PID stays visible
```

On the host: `wget -qO- http://10.10.0.2/` and `wget -qO- http://10.10.0.2/cgi-bin/hostname` (the answer is `box` — the name from the container's UTS). veth, the bridge and the net namespace were introduced in networking (N20, N21); here they are assembled into a container for the first time.

Continuation for the intermediate and experienced: a second container; a bridge `ip link add br0 type bridge`, both veth pairs into the bridge, the address 10.10.0.1/24 moves onto `br0` — this is exactly `docker0`. Then port publishing:

```sh
sysctl -w net.ipv4.ip_forward=1
iptables -t nat -A PREROUTING -p tcp --dport 8080 -j DNAT --to-destination 10.10.0.2:80
iptables -t nat -A OUTPUT -p tcp -d 127.0.0.1 --dport 8080 -j DNAT --to-destination 10.10.0.2:80
sysctl -w net.ipv4.conf.all.route_localnet=1
iptables -t nat -A POSTROUTING -s 127.0.0.1 -d 10.10.0.0/24 -j MASQUERADE
wget -qO- http://127.0.0.1:8080/
iptables -t nat -S; nft list ruleset       # the rules actually live in nftables
```

Next to them, line by line — Docker's rules from the golden recording of the Engine version that the simulator's `docker version` shows (the chains of Docker 28 and 29 differ noticeably: `DOCKER-FORWARD`, rules in `raw` against direct access). A caveat without which the comparison is misleading: by default (`userland-proxy: true`) Docker serves requests to `localhost:8080` from the host itself with the `docker-proxy` process, while DNAT applies to traffic from outside; in the recording this is visible via `ss -ltnp | grep 8080`. Goal: in the process's net namespace there is an interface with the address 10.10.0.2/24 in state UP, and an HTTP request from the host to 10.10.0.2:80 returns 200.

**Step 6. Lower directories, overlay and pivot_root.** Two prepared lower directories (later, in m06, the learner will find out that this is how image layers are built):

```sh
mkdir -p /c/l1 /c/l2 /c/upper /c/work /c/merged
tar -xf /opt/images/shell-app/layer1.tar -C /c/l1
tar -xf /opt/images/shell-app/layer2.tar -C /c/l2
find /c/l2 -name '.wh.*'
mount -t overlay overlay -o lowerdir=/c/l2:/c/l1,upperdir=/c/upper,workdir=/c/work /c/merged
ls /c/merged/www               # the file "deleted" in the second directory is still visible, and so is the .wh. marker
umount /c/merged               # the lower directories of a mounted overlay must not be changed
```

The `.wh.<name>` marker is an archive format; the kernel does not understand it. Converting to the kernel format, only after unmounting (the lower directories under a mounted overlay must not be changed: the behavior is undefined, see the overlayfs documentation "Changes to underlying filesystems"):

```sh
find /c/l2 -name '.wh.*' ! -name '.wh..wh..opq' | while read -r wh; do
  d=$(dirname "$wh"); n=$(basename "$wh"); n=${n#.wh.}
  rm "$wh" && mknod "$d/$n" c 0 0
done
find /c/l2 -name '.wh..wh..opq' | while read -r o; do
  d=$(dirname "$o"); rm "$o" && setfattr -n trusted.overlay.opaque -v y "$d"
done
mount -t overlay overlay -o lowerdir=/c/l2:/c/l1,upperdir=/c/upper,workdir=/c/work /c/merged
ls /c/merged/www               # the deleted file is gone
```

This explains why a runtime needs an unpacking layer (`box pull` does this too, section 10). Then `pivot_root`:

```sh
unshare --pid --fork --mount --uts --ipc --net sh
# inside the new mount namespace:
mount --make-rprivate /
mount --bind /c/merged /c/merged
cd /c/merged
mkdir -p .oldroot
pivot_root . .oldroot
cd /
mount -t proc proc /proc
umount -l /.oldroot
rmdir /.oldroot
ls /                           # only files from the lower directories and upper
ls /proc/1/root/               # this is the container's own root: there is nowhere to escape to
```

A question with a demonstration: why chroot is worse. In step 1 root got out through `/proc/1/root` of a host process. After `pivot_root` in new pid and mount namespaces no host process is visible, and the old root is unmounted — it does not exist in this mount namespace. Goals: the process has `root` = `/`, `mountinfo` contains no host paths except `proc`; the root is an overlay.

**Step 7. Users and capabilities.** As root:

```sh
grep Cap /proc/self/status
capsh --decode=$(awk '/CapEff/{print $2}' /proc/self/status)
capsh --shell=/bin/sh --drop=cap_sys_admin -- -c 'mount -t tmpfs t /mnt'   # Operation not permitted
capsh --shell=/bin/sh --drop=cap_net_raw   -- -c 'ping -c1 127.0.0.1'       # no right to a raw socket
capsh --print
```

`capsh --` runs `/bin/bash` by default, which Alpine does not have, so `--shell=/bin/sh` is mandatory. `--drop` removes a capability from the bounding set, and after `exec` even root does not have it; dropping itself requires `CAP_SETPCAP`, so this experiment is done as root. The `ping` experiment is valid only with `ping_group_range = 1 0` in the guest (9.1); in Docker containers since 20.10 it is set to `0 2147483647`, and `ping` with an ICMP socket works without `NET_RAW` — we will come back to this in m10.

As a regular user:

```sh
su student -c "unshare --user --map-root-user sh -c 'id; cat /proc/self/uid_map; grep CapEff /proc/self/status'"
su student -c "unshare --user --map-root-user --mount sh -c 'mount -t tmpfs t /mnt && echo ok'"
su student -c "unshare --user --map-root-user sh -c 'hostname evil'"   # Operation not permitted
```

Conclusion: root inside its own user namespace is full root over the objects that this namespace owns (its own mount namespace — mounting is allowed), and nobody to everyone else (UTS belongs to the initial user namespace — the name cannot be changed). Question: "How does root inside a user namespace differ from root without one?" Goals: there was a process with `uid_map` `0 1000 1`; the answer to the question.

**Step 8. The same container with a real runtime.**

```sh
mkdir -p /c/bundle/rootfs && cd /c/bundle
cp -a /c/merged/. rootfs/
crun spec
jq '.linux.namespaces, .linux.resources, .process.capabilities.bounding' config.json
jq '.hostname="crunbox" | .linux.resources.memory.limit=16777216 | .linux.resources.pids.limit=20' config.json > c.json && mv c.json config.json
crun run crunbox
```

Diagram: on the right `config.json`, with each field linked by a line to the step where the learner did the same by hand: `linux.namespaces` → steps 2, 3, 5, 6; `linux.resources` → 4; `root.path` and `mounts` → 6; `process.capabilities` and `process.user` → 7. The learner checks the list of namespaces: pid, network, ipc, uts, mount, cgroup — new; user and time — shared with the host, as with `box` in interactive 1. For the experienced (rung 4, docker.p14): the `linux.seccomp` field from `crun spec` is empty; the task is to forbid `mkdir` according to the runtime-spec, without a hint. The reference for the checker: `{"defaultAction":"SCMP_ACT_ALLOW","architectures":["SCMP_ARCH_X86"],"syscalls":[{"names":["mkdir","mkdirat"],"action":"SCMP_ACT_ERRNO"}]}`; `mkdir /x` in the container gets `Operation not permitted`.

**Result.** The learner assembles `mybox.sh` (about 30 lines) from the fragments of the steps. The final goal runs `sh mybox.sh` in the background and checks by facts: PID 1 inside; ns pid, mnt, net, uts, ipc differ; hostname `mybox`; `memory.max` = 16777216 and `pids.max` = 20; an interface with an address from 10.10.0.0/24; the root is an overlay; there is no `/.oldroot`. The last screen: "your `mybox.sh` is what `box` (section 10) does properly, and `box` is what containerd and runc do for Docker".

### 9.5. How checks work in v86

The "check" button sends `trainer-agent` a request for facts of the needed scopes (`{"id":31,"op":"facts","scopes":["procs","ns","cgroups","mounts","links"]}`), and the reply is `dt.facts/v1`; the step goals are `when` selectors over the facts, evaluated by the shared 09 evaluator. Checks look at state, not at the text of commands: the result can be reached by any path. The command history is used only in hints ("you created a group but did not move the process into it"). For goals that need an action (running `mybox.sh`), `probe` from 09 (2.4) is used. The fact fields the block needs beyond those already described in 09 are listed in 15.6.

---

## 10. `box` — the node runtime, shared with the hybrid Kubernetes (R11)

### 10.1. What it is

`box` is a POSIX script (about 300 lines) on top of `crun`, `curl`, `jq`, `tar`, `ip` and `iptables`, located at `/opt/trainer/bin/box` in the `lab-alpine` image. The learner sees it in interactive 1 as a ready-made tool, and after lab m04 opens it and recognizes their own `mybox.sh`, turned into a tool. The same `box` is called by the node agent of the hybrid Kubernetes (document 05): the control plane is the kube-lite simulator, and on each v86 node a small "kubelet" agent turns a pod into `box` calls. The phrase "the kubelet asks the runtime to do what you did by hand" becomes literal.

### 10.2. Contract

```
box pull REF                                # token → index → manifest linux/386 → blobs from the course registry;
                                            # unpacking into /var/lib/box/layers/<diff_id> with whiteout conversion (step 6)
box sandbox create POD [--subnet CIDR]      # pod sandbox: a pause process `unshare --net --ipc --uts sleep 2147483647`,
                                            # its netns is bound to /run/netns/<POD> (visible in `ip netns`),
                                            # veth to the cni0 bridge, an address from the node subnet (10.244.N.0/24), a default route,
                                            # cgroup /sys/fs/cgroup/box/<POD>
box sandbox rm POD
box run POD CTR --image REF [--memory N] [--pids N] [--cpus N] [--env K=V]... [--] [CMD...]
                                            # overlay of layers + upper in /var/lib/box/<POD>/<CTR>,
                                            # config.json: linux.namespaces[] with path=/proc/<pause>/ns/{net,ipc,uts}, own pid and mnt,
                                            # cgroup /sys/fs/cgroup/box/<POD>/<CTR>, crun run --detach, stdout/stderr to /var/log/box/<POD>_<CTR>.log
box exec POD CTR -- CMD...                  # crun exec
box kill POD CTR [SIG]; box rm POD [CTR]
box logs POD CTR [--tail N]
box pid POD CTR                             # the PID of the container process in the host pid namespace
box ps --json                               # a list for the fact collector (pods, containers, state, PID, exit code)
box start NAME [-- CMD...]                  # a shortcut for lessons: sandbox create NAME + run NAME NAME --image trainer/shell-app
```

A pod is shared net, ipc and uts through `path` in `config.json`, like Kubernetes' pause container; this way the concept "pod" from 05 rests on interactive 1 and step 8 of the lab. `box` prints exit codes and errors in a format that the node agent translates into kube-lite states (`ErrImagePull`, `CrashLoopBackOff`, `OOMKilled` from `memory.events`).

### 10.3. Image and budget

There is one root — `lab-alpine` (section 9.1); the hybrid Kubernetes nodes run the same image with the `node` profile (autostart of the node agent and `trainer-agent`, no man pages in the snapshot). Guest memory is 96 MB, snapshot ≤ 20 MB. On a laptop — three or four nodes of 96 MB each in separate Web Workers; on a phone — one node when `navigator.deviceMemory ≥ 4`, below that and on iOS — recorded mode, until the 09 spike shows otherwise. Tab budgets follow the 09 table (1.4); the block passes these numbers there.

### 10.4. Two machines (m12)

Two `lab-alpine` nodes on the course's shared JS switch (documents 03 and 09: a real L2 with ARP, visible in the switch diagram). On each, `box sandbox create` brings up `cni0` with its own subnet (`10.244.1.0/24` and `10.244.2.0/24`) and one container each.

1. The container on `node1` does not ping the container on `node2`: `ping -c1 10.244.2.2` is silent, and `tcpdump -ni eth0` on `node1` shows a packet to the default gateway.
2. The learner adds `ip route add 10.244.2.0/24 via <node2 address>` on `node1` and the reverse route on `node2`, enables forwarding (`sysctl -w net.ipv4.ip_forward=1`) and excludes the subnet from MASQUERADE.
3. The ping goes through; `tcpdump` on `node2` shows the source address `10.244.1.2` — without NAT. Explainer X9 draws the same path.
4. For the experienced: the same path via VXLAN (`ip link add vx0 type vxlan id 42 dstport 4789 remote <node2> dev eth0`) and WireGuard between the nodes — this continues in the Kubernetes (R9) and networking blocks.

Goals: the `node1` container's `procs` received an ICMP reply (saved output), `routes[node1]` contains `10.244.2.0/24`, and in `tcpdump` on `node2` the source is `10.244.1.2`. The screen's conclusion: "this is the Kubernetes network model: each pod has its own address without NAT between nodes; CNI does for you what you did with routes".

---

## 11. The Docker simulator (dsim) and the registry

### 11.1. Architecture

dsim lives in the platform's shared `sim.worker.ts` (09, 1.3) next to the Stand (02) and netlab (03): a dsim container is a Stand process with its own set of namespaces in its own netlab network model. A pure core without DOM, tested in Node.

| Module | Responsibility |
|---|---|
| `engine/state.ts` | Daemon state: images, containers, networks, volumes, blob storage, events. Serialized (CBOR) for snapshots, facts and the AI context |
| `engine/store.ts` | Content-addressable storage: blobs, manifest, config; sha256 via WebCrypto (in Node — `crypto`) |
| `engine/fs.ts` | The virtual FS of a layer (mode, owner, size, contents of text files up to 64 KB, the "weight" of large binaries), overlay merging with whiteout and opaque, copy-up. The same code draws screen F of interactive 2 and is mounted into the Stand as the container FS |
| `engine/tar.ts` | Deterministic serialization of a layer into tar (digest and `docker save`) |
| `engine/net-adapter.ts` | Docker networks are netlab node configuration: `docker0` is a netlab bridge, a container is a netlab network namespace with a veth, `-p` is a DNAT rule in the `DOCKER` chain of the netlab nat table (rule texts follow the golden recording of the Engine version), the embedded DNS is a netlab service at 127.0.0.11 in the container's namespace, only for user-defined networks. dsim stores only the "Docker network ↔ container" binding and the Docker IPAM data (172.17.0.0/16 by default, user-defined — 172.18.0.0/16 and onward). This is why `iptables -t nat -S DOCKER`, `tcpdump -i docker0`, `ip netns` from the host work in dsim without code of its own |
| `engine/proc.ts` | Process models (11.4): image behavior on top of Stand processes, including signal handlers |
| `engine/build.ts` | The Dockerfile builder: parsing (`dockerfile-ast`), stages, cache, `--mount=type=cache|secret`, BuildKit-style output |
| `engine/compose.ts` | Compose: YAML parsing (`yaml`), validation against the compose-spec JSON schema (`ajv`), plan and execution through the same engine |
| `engine/facts.ts` | The `dt.facts/v1` fact collector for the scopes `containers`, `images`, `networks`, `volumes`, `builds`, `compose`, `registry`, `logs` (15.6) |
| `cli/argv.ts` | Argument parsing as in cobra: combined short flags (`-dit`), `--name=x` and `--name x`, `--`, repeatable flags |
| `cli/format.ts` | Table output with columns and widths as in Docker, ID truncation, relative time, a subset of Go templates for `--format` |
| `cli/help.ts` | Full help from the golden recording, with faint markup of non-executable flags (5.3) |
| `registry/sw.ts` | The registry Service Worker (11.6) |
| `ui/` | Terminal, state side panel, "what happened" panel, "browser" tab |

The shell inside a container (`docker exec -it … sh`) is the Stand from 02 with the container FS from `engine/fs.ts` and a netlab network namespace. `ping` inside is the Stand's `ping` on the netlab model, not separate logic; its behavior without `NET_RAW` is determined by the value of `net.ipv4.ping_group_range` (in Docker containers since 20.10 — `0 2147483647`) and by which `ping` is in the image (busybox or iputils), and is checked against the golden recording `docker run --cap-drop NET_RAW <image> ping -c1 …` for each image in the catalog.

### 11.2. Screen

The terminal on the left, the state panel on the right: container cards (name, image, state with the X8 graph node, ports, networks), images with layer size bars, networks as lines between containers (the shared netlab diagram), volumes. After each command the "what happened" panel explains the engine's action: "Container web was created from the image nginx:1.30-alpine. Docker added a writable layer on top of the image's 7 layers, connected the container to the bridge network with the address 172.17.0.2 and published host port 8080 to container port 80." For the experienced — a `docker events` stream in the real format. The "browser" tab: an address bar, and `http://localhost:8080` shows the response of the process model — this closes the loop "started it → opened it in the browser".

### 11.3. Supported commands

Help and unsupported flags — per 5.3.

**General:** `docker version`, `docker info` (among other things — `Insecure Registries: registry.lab`), `docker --help`, `docker <cmd> --help`, `docker system df [-v]`, `docker system prune [-a] [--volumes] [-f]`, `docker events [--since] [--filter]`, `docker login|logout <registry>`.

**Images:** `docker pull NAME[:TAG|@DIGEST] [--platform]`, `docker images` and `docker image ls [-a] [-q] [--digests] [--filter dangling=true|reference=…] [--format]`, `docker image inspect [--format]`, `docker image history [--no-trunc] [--format]`, `docker rmi` and `docker image rm [-f]`, `docker image prune [-a] [-f]`, `docker tag`, `docker push`, `docker save -o FILE IMAGE...`, `docker load -i FILE`, `docker manifest inspect`, `docker buildx imagetools inspect`.

**Build:** `docker build [-t NAME:TAG]... [-f FILE] [--target STAGE] [--build-arg K=V]... [--no-cache] [--pull] [--progress=plain|tty] [--secret id=…,src=…] [--platform] CONTEXT`, `RUN --mount=type=cache|secret`, `docker builder prune [-a] [-f]`. The context is a virtual project directory with an editor next to the terminal; `.dockerignore` is honored.

**Containers:** `docker run` and `docker create` with the flags `-d`, `-i`, `-t`, `--rm`, `--name`, `-p [IP:]HOST:CONT[/udp]`, `-P`, `-e K=V`, `--env-file`, `-v NAME:/path[:ro]`, `-v /host:/path[:ro]`, `--mount type=volume|bind|tmpfs,…`, `--tmpfs`, `--network NAME|host|none`, `--network-alias`, `--hostname`, `--add-host`, `-w`, `-u UID[:GID]`, `--entrypoint`, `--restart no|on-failure[:N]|always|unless-stopped`, `-m/--memory`, `--memory-swap`, `--cpus`, `--pids-limit`, `--ulimit`, `--sysctl`, `--read-only`, `--cap-add`, `--cap-drop`, `--security-opt no-new-privileges|seccomp=unconfined|seccomp=FILE|apparmor=…`, `--privileged`, `--pid host`, `--init`, `--stop-signal`, `--stop-timeout`, `--log-driver json-file|local|none`, `--log-opt max-size|max-file`, `--health-cmd`, `--health-interval`, `--health-retries`, `--label`, `--platform`; `docker start [-a] [-i]`, `stop [-t N] [-s SIG]`, `restart`, `kill [-s SIG]`, `pause`, `unpause`, `rm [-f] [-v]`, `rename`, `wait`, `ps [-a] [-q] [-l] [-n N] [-s] [--filter …] [--format] [--no-trunc]`, `logs [-f] [--tail N] [-t] [--since]`, `exec [-it] [-u] [-e] [-w]`, `inspect [--format] [--type]`, `top`, `stats [--no-stream]`, `port`, `cp SRC DST` (in both directions, including from a stopped container), `diff`, `commit`, `container prune [-f]`, `update --memory|--cpus|--restart`.

**Networks:** `docker network ls [--filter]`, `create [--driver bridge] [--subnet] [--gateway] [--internal] NAME`, `inspect`, `connect [--alias]`, `disconnect`, `rm`, `prune`.

**Volumes:** `docker volume ls [--filter dangling=true]`, `create`, `inspect`, `rm`, `prune [-a] [-f]`.

**Compose:** `docker compose [-f FILE] [-p NAME] [--profile P] [--env-file]` with the subcommands `up [-d] [--build] [--force-recreate] [--no-deps] [--wait] [SERVICE...]`, `down [-v] [--rmi local|all] [--remove-orphans]`, `ps [-a]`, `logs`, `exec`, `run [--rm]`, `build`, `pull`, `config`, `start`, `stop`, `restart`, `top`, `images`, `port`. Supported: `depends_on` with the conditions `service_started`, `service_healthy`, `service_completed_successfully`, `logging`, `profiles`.

**Go templates for `--format`:** fields, `{{json .X}}`, `{{range}}`, `{{index}}`, `len`, the `table` prefix. Anything else gives an understandable error.

**Commands inside a container** — those present in the image (`scratch` has nothing, alpine has busybox) — are executed by the Stand.

### 11.4. Process models

Each image in the catalog has a behavior description in YAML: what it listens on, what it writes to the log (and where — stdout or a file), which variables are required, which signals it handles, whether it buffers stdout, how much memory it "consumes", what it answers over HTTP.

```yaml
image: postgres:17-alpine
entrypoint_model: postgres
requires_env:
  - any_of: [POSTGRES_PASSWORD, POSTGRES_HOST_AUTH_METHOD]
    on_missing: {exit_code: 1, logs_from: golden/postgres-17-missing-password.log}
listens: [{port: 5432, proto: tcp, bind: 0.0.0.0}]
ready_after_ms: 2500
data_dir: /var/lib/postgresql/data
memory_mb: 40
signals: {SIGTERM: graceful, SIGINT: graceful}     # handlers; without an entry — the default action
logs: {to: stdout, on_start: golden/postgres-17-start.log}
```

The model catalog: `hello-world`, `alpine`, `busybox`, `debian:bookworm-slim`, `nginx` (alpine and debian), `httpd`, `redis`, `postgres`, `mysql`, `python` (full, slim, alpine), `node`, `golang`, `traefik`, `registry:2`, `adminer`, `trainer/api` (two variations: with and without a SIGTERM handler), `trainer/web`, `trainer/worker` (spawns child processes and does not `wait` — for zombies), `trainer/logger` (writes to a file), `trainer/tool` (built for `linux/arm64`). The training application is a Python API that reads `DB_HOST`, `DB_PASSWORD`, connects to postgres by name and returns JSON; on a connection error — a realistic traceback and code 1.

The PID 1 rule is modeled the same way as in the kernel: if a process is PID 1 of its namespace and has no handler for a signal, the signal is ignored (except SIGKILL). The shell form gives PID 1 = `/bin/sh` with behavior from the golden recording (dash and busybox ash differ in whether they `exec` the last command, so a scenario is not published without a recording). For the learner's images the model is computed from the config: a known binary gets the behavior from its model; an unknown one makes the container print "the trainer does not know what this program does" and behave like `sleep infinity`.

### 11.5. Building in the simulator

RUN is executed by a "recipe" interpreter: a catalog of supported commands with their effect on the layer FS and a size model. Supported: `apk add [--no-cache]`, `apk del`, `apt-get update`, `apt-get install [-y] [--no-install-recommends]`, `rm -rf /var/lib/apt/lists/*`, `apt-get purge/clean`, `pip install [--no-cache-dir] [-r requirements.txt]`, `npm ci`, `npm install`, `npm run build`, `go build -o`, `go mod download`, `make`, `useradd`/`adduser [-D] [-u]`, `addgroup`, `mkdir -p`, `chmod`, `chown`, `echo … > file`, `cp`, `mv`, `rm`, `ln -s` (including `ln -sf /dev/stdout /var/log/app.log`), `wget/curl -o` (to training URLs), `&&`, `\` line continuations, `set -e`. An unknown command does not fail the step, but the layer is marked "effect unknown", and goals that depend on sizes are not credited for such an image; the learner can see this.

Package and base image sizes come from golden recordings with megabyte precision. The output mirrors BuildKit `--progress=plain` (`#5 [build 2/6] RUN go mod download`, `#5 CACHED`, `#7 DONE 3.2s`); the time is model time. A step's cache key = sha256(the parent key, the normalized instruction text, the values of the ARGs used in it, and for COPY/ADD — the sha256 of the contents of the copied files taking `.dockerignore` into account). Invalidation cascades. `--no-cache`, `--pull`, `--target` work; unused stages are not built.

### 11.6. Registry

The Service Worker serves the same-origin path `https://<course>/registry/v2/…`. Inside dsim and the v86 guest the registry is called `registry.lab`; dsim treats it as an insecure registry (a line in `docker info` and a short screen in m06 "why TLS is needed in real life"), and the v86 `fetch` adapter rewrites `http://registry.lab/` to the same-origin path (as 09 rewrites `apt.lab`), so there is no mixed content. A subset of the OCI Distribution Spec is implemented:

- `GET /v2/` — `401` and `WWW-Authenticate: Bearer realm=…,service=…,scope=…` for unauthorized clients;
- `GET /token?scope=repository:NAME:pull,push` — a training token;
- `GET|HEAD /v2/<name>/manifests/<tag|digest>` with `Accept` negotiation (index, OCI manifest, Docker v2) and the `Docker-Content-Digest` header;
- `GET|HEAD /v2/<name>/blobs/<digest>`;
- upload: `POST /v2/<name>/blobs/uploads/` → `202` with `Location`; `PATCH <location>` (stream, `Range` in the response); `PUT <location>?digest=…` (completion or monolithic upload); `PUT /v2/<name>/manifests/<tag>`;
- `GET /v2/<name>/tags/list`, `GET /v2/_catalog`.

Storage is IndexedDB. The registry panel shows repositories, tags, digests and the request log: on `docker push`, layers that already exist are not uploaded (`HEAD` → 200 → `Layer already exists`). Experienced learners go through the protocol by hand in v86: `curl` for a token, `curl -H 'Accept: application/vnd.oci.image.index.v1+json'` for the index, then the manifest and a blob, `sha256sum` to verify, `tar -tzf` to look inside a layer, and an upload with `POST`/`PATCH`/`PUT`. The spike must confirm that the v86 `fetch` backend passes `HEAD`, `PATCH`, and the `Accept`, `Authorization`, `Range` and `Location` headers unchanged, and that the Service Worker intercepts requests from the dedicated v86 worker in all three browsers (Safari separately). For real VMs (m13) the course registry is unreachable: `registry:2` on the VM itself is used there.

### 11.7. Golden recordings

The `golden/record.sh` script brings up, on the course team's test machines, a clean VM with Docker Engine of the version from `content/versions.yaml` (the minor version is pinned) and, for each scenario `golden/scenarios/*.yaml`, runs the commands, saving stdout, stderr, the exit code, `docker inspect` after each step, `iptables -t nat -S` and `nft list ruleset`, `ss -ltnp`, as well as the full `--help` for every command from 5.8. CI replays the same scenarios in dsim and compares after normalization: IDs and digests are replaced with placeholders in order of appearance, times and sizes are compared within a tolerance, and the order of `docker ps` lines follows Docker's sort rule. A mismatch fails the build. When the Engine version changes, the recordings, `versions.yaml` and the lesson texts are updated; tags are substituted into the lessons from `versions.yaml` rather than written into the prose.

---

## 12. The six boundaries of a container (m08, R7b)

### 12.1. Boundaries

| Boundary | What passes through it | What is repeated or introduced | Typical breakage |
|---|---|---|---|
| 1. Host kernel | system calls, CPU architecture, kernel parameters | one kernel; the image platform; sysctls that belong to a namespace (`net.*`) and only to the host; capabilities and seccomp as a filter on this boundary | `exec format error` (an arm64 image on amd64); `sysctl -w` inside — `Read-only file system`; a kernel module missing on the host |
| 2. Network | packets | veth, `docker0`, NAT to the outside, `-p` as DNAT, 127.0.0.11 only in user-defined networks, `host`, `none` | listens on 127.0.0.1; the default network has no DNS; the port is taken; no `ip_forward` |
| 3. Storage | files | upper lives as long as the container; volume; bind; tmpfs | data disappeared after `rm`; a bind mount hid the image's files |
| 4. Process and signals | signals, exit codes, children | PID 1, SIGTERM → timeout → SIGKILL, zombies, `--init`/tini | `stop` takes 10 s; zombies pile up; the daemon went into the background and the container exited |
| 5. Input/output and logs | stdout/stderr | the shim holds stdio → log driver (`json-file` by default, `local`) → file | `docker logs` is empty; a log without rotation ate the disk; stdout buffering |
| 6. Configuration and identity | env, secrets, UID | env, `.env`, secrets, UID inside and outside, user namespace, bind mount permissions | `Permission denied` in a bind mount; a secret in a layer; a typo in a variable name |

### 12.2. "The container doesn't work" drills

The first goal of each drill is to choose the boundary (`choice`, credited separately, a mistake is explained); for network drills — also the layer per R8 (`choice`: L2, L3, L4, L7/DNS), as in the networking block. Then comes the fix, checked by facts. Drills b03–b06 and b07–b08 include the former d15–d18.

| ID | Lvl | Boundary (layer) | Symptom (initial state) | Goal by facts |
|---|---|---|---|---|
| docker.b01 | B | 1 kernel | `docker run trainer/tool` fails immediately: `exec format error` (a `linux/arm64` image) | an image of the right platform is started: `images[ref=…].platform=linux/amd64`, the container is `running` |
| docker.b02 | I | 1 kernel | `worker` is `OOMKilled`, the limit is 64 MB, the README requires 128 MB | `hostConfig.memory>=134217728`, `oomKilled=false`; `memory=0` in `forbid` with the explanation "you don't remove a limit, you tune it" |
| docker.b03 | E | 1 kernel | (v86) the container needs `net.ipv4.ip_forward=1`, `sysctl -w` inside — `Read-only file system` | the value is set through `linux.sysctl` in `config.json` (crun) or `--sysctl` (dsim); `privileged` in `forbid` |
| docker.b04 | B | 2 network (L7/DNS) | `api` cannot find `db` by name — both are in the default `bridge` network (was d17) | both in the same user-defined network; `exec(api, nslookup db)` returns `db`'s IP |
| docker.b05 | B | 2 network (L4) | the port is published, `curl localhost:8080` — connection reset: the application listens on 127.0.0.1 inside (was d18) | the application restarted with `BIND=0.0.0.0`, `http :8080 = 200` |
| docker.b06 | I | 2 network (L4, host) | `Bind for 0.0.0.0:8080 failed: port is already allocated` | a new container `running` on a free port; the old one is not deleted (`forbid`) |
| docker.b07 | I | 2 network (L3) | `api` is started with `--network none` and does not see the DB | `networks` does not contain `none`, `http api→db` goes through |
| docker.b08 | I | 2 network (L3) | no internet from the container, but `ping 172.17.0.1` works: `ip_forward` is off on the host | `host.sysctl.ip_forward=1`, the MASQUERADE rule is in place |
| docker.b09 | B | 3 storage | postgres data disappeared after `rm` (was d15) | a named volume on `/var/lib/postgresql/data`; after `rm -f` and a new `run` the table is in place |
| docker.b10 | I | 3 storage | a developer wants to see code edits without rebuilding (was d16) | a bind mount of the project directory onto the code path; a file edit is visible in the container |
| docker.b11 | I | 3 storage | the bind mount `./src:/app` hid `/app/node_modules` from the image → `Cannot find module` | `mounts[target=/app/node_modules].type=volume`, `http=200` |
| docker.b12 | I | 3 storage | after `docker compose up --force-recreate` the files uploaded by users disappeared | the uploads directory is on a volume |
| docker.b13 | I | 4 process | `docker stop` waits 10 s (was d13, fixed) | see docker.x13 |
| docker.b14 | I | 4 process | (v86 or dsim) a PID 1 script spawns children and does not reap them: `[sh] <defunct>` pile up | after 30 model seconds `procs[cgroup=…][state=Z]` is empty; PID 1 is tini (`--init` or ENTRYPOINT) |
| docker.b15 | B | 4 process | `CMD service nginx start` — the container immediately goes `Exited (0)`: the daemon went into the background, PID 1 exited | the container is `running`; nginx in the foreground (`daemon off;`) |
| docker.b16 | B | 5 logs | `docker logs app` is empty: the application writes to `/var/log/app.log` | `logs[name=app].text~'started'` (a link to `/dev/stdout`, as in the nginx image, or switching to stdout) |
| docker.b17 | I | 5 logs | the Python application's log appears with a delay of minutes | `config.Env~PYTHONUNBUFFERED=1` or `Cmd~'-u'`; lines in the log within 1 model second |
| docker.b18 | I | 5 logs | the container log took 3 GB (rung 4, same as docker.p02) | `logConfig.max-size` and `max-file` are set |
| docker.b19 | I | 6 identity | the application under UID 1001 cannot write to the bind mount `./data` (root:root 755) | `exec(touch /data/x).exit=0`, `user!=0`; `--user 0` and mode 777 in `forbid` with an explanation |
| docker.b20 | I | 6 identity | files created by the container in a bind mount belong to root on the host, and the developer cannot delete them | a new run with the developer's `--user <uid>:<gid>`; the owner of a new file is the developer |
| docker.b21 | E | 6 identity | (v86) with userns, files created by root in the container belong to 100000 on the host; explain and make the directory writable | `uid_map` was read (saved output), the directory owner = 100000 |
| docker.b22 | B | 6 identity | `POSTGRES_PASWORD` (a typo) | `db` is `running`, env contains `POSTGRES_PASSWORD` |

**docker.b-mix.** The module's final drill: five random breakages from the table in a row, without the boundary being named. Credited if the boundary is named correctly and the breakage is fixed; the review shows how many times the learner started from the wrong boundary.

---
## 13. Level entry check (placement)

The check takes 10–15 minutes, the AI is off, there are no hints. The result is a route: which modules to skip, which to take as express, which concepts are marked as a "gap". Each task is tied to concept IDs (`concepts:`), as in 01 (4.3); this check replaces the Docker section in 01 §4.3 (a proposal to 01).

### 13.1. Beginner: readiness check

A beginner has nothing to confirm in Docker, but we need to make sure the Linux R6 module and networking are behind them. The tasks run in the same environment as the Linux R6 module (v86).

1. "Start `sh` in a new pid namespace so that `echo $$` inside prints 1" (`concepts: [L34]`) — goal: a process whose last `NSpid` = 1.
2. "Read the memory limit of the group `/sys/fs/cgroup/demo` and write it into `~/limit.txt`" (`[L35]`) — the file matches `memory.max`.
3. "Which user are you working as and what is its UID?" (`[L17]`) — the answer is checked against `id`.
4. "A server listens on port 8080 on 127.0.0.1. Can you connect to it from another computer? Why?" (`[N04]`) — a choice with an explanation.

Three out of four is a pass; otherwise — links to the lessons of the Linux R6 module and networking that close the gap.

### 13.2. Intermediate: confirmation

Six tasks, 5 of 6 are needed, and both practical ones are mandatory.

1. (dsim, `[D11, D12]`) "Run nginx in the background with the name `web` so that `http://localhost:8080` opens its start page." Goal: `web` running from `nginx:*`, publishing 8080→80, HTTP 200 in the browser tab.
2. (dsim, `[D15, D16]`) Given a Dockerfile:
   ```dockerfile
   FROM python:3.13
   COPY . /app
   RUN pip install -r /app/requirements.txt
   CMD python /app/main.py
   ```
   "Change it so that editing `main.py` does not cause the dependencies to be reinstalled." Goal: two builds, and in the second the `pip install` step is CACHED.
3. (`[D20]`) "Two containers on the default `bridge` network. Why does `ping db` from one not find the other?" — the default network has no embedded DNS by name.
4. (`[D13]`) "How does a volume differ from a bind mount?" — a multiple choice of 5 statements, 2 are correct.
5. (`[L35, D27]`) "A container exited with code 137. What are the two most likely causes?" — the OOM killer or SIGKILL after the `stop` timeout.
6. (`[D13, L38]`) "What will remain of a file created in a container after `docker rm`, if no volumes are attached?" — nothing, the upper layer is deleted.

Outcome: 6/6 — m01 and m05 as express, the rest along the intermediate route; 5/6 — the same plus the module of the wrong answer in full; fewer than 5 — the beginner route without m01.

### 13.3. Experienced: confirmation (from rung 3)

Six tasks, 5 of 6 are needed, the practical ones are mandatory. Practical tasks are given with a link only to the documentation page, without naming flags or files.

1. (v86, `[L34]`) "Start `sh` in new pid and mount namespaces so that `ps` inside shows only itself. Documentation: `man unshare`." Goal: a process with `NSpid … 1`, a different `ns.pid`, `/proc` mounted inside.
2. (v86, `[L35]`) "Limit the already running process `stress-mem` to 20 MB of memory without restarting it. Documentation: docs.kernel.org/admin-guide/cgroup-v2.html." Goal: the process is in a group with `memory.max` = 20971520.
3. (`[D19]`) "Which two hashes does an image layer have, and where is each recorded?" — the digest of the compressed blob in the manifest, the diff_id of the uncompressed tar in `rootfs.diff_ids`.
4. (`[D10]`) Put in order: docker CLI → dockerd → containerd → containerd-shim-runc-v2 → runc → process (runc exits after the start).
5. (`[D30]`) "Why is `--privileged` dangerous even if the process inside is not root?" — an open answer graded by a rubric: all capabilities, access to host devices, seccomp and AppArmor turned off, the host disk can be mounted.
6. (`[L38, D08]`) "How is a whiteout from a tar layer turned into the OverlayFS format?" — a 0:0 character device, an opaque directory via the xattr `trusted.overlay.opaque=y`.

Outcome: 6/6 — m01, m05, m07, m09 as express, the rest in full; 5/6 — plus the module with the mistake; fewer — the intermediate route.

---

## 14. Exercises (drills)

Short exercises on one idea each: the wording, the initial state, the goal by facts. "Lvl" is the minimum level (B — beginner, I — intermediate, E — experienced); "VM" means the exercise is repeated on a real VM in m13 (eight of them). The `docker.xNN` numbers keep the former `dNN` numbers; d15–d18 moved into the boundary drills (12.2). The ladder rung is given if the exercise uses a help fragment (2) or requires finding a flag (3).

| ID | Lvl | Module | Task | Goal by facts |
|---|---|---|---|---|
| docker.x01 | B | m05 | Run `hello-world` and find the stopped container in the list | a container from `hello-world` in `exited(0)`; `ps -a` in the history |
| docker.x02 | B | m05 VM | Run nginx in the background with the name `web` on port 8080 | `web` running, 8080→80/tcp, HTTP 200 on `localhost:8080` |
| docker.x03 | B | m05 | Go into `web` and replace the start page with the text "Hello, DevOps" | the HTTP response contains the string; `docker diff web` shows C/A in upper |
| docker.x04 | B | m05 | Stop and remove all containers except `web` (rung 2: `docker container rm --help`, `-f`) | no containers except `web`; `web` is in its previous state |
| docker.x05 | B | m05 | The `app` container exits immediately. Find out why and run it correctly | initial: `app` from `trainer/api` without `DB_HOST`; a new `app` running with `DB_HOST`, no error in the log; `logs app` in the history |
| docker.x06 | B | m05 | Run `alpine` so that it does not exit immediately, and run `ps` in it (rung 2: `-i`, `-t`) | an alpine container running; `exec … ps` in the history or `ps` output in an interactive session |
| docker.x07 | B | m06 | Pull `nginx:1.30-alpine` and find out how many layers it has | the number in the answer = the length of `RootFS.Layers` |
| docker.x08 | I | m06 | Pull an image by digest rather than by tag | the registry log has a request with `@sha256:`; `docker images --digests` shows it |
| docker.x09 | I | m06 VM | Push your image to the registry under the tag `registry.lab/<login>/web:1.0`; on the VM — to a `registry:2` that you brought up yourself (`localhost:5000/<login>/web:1.0`) | `registry` has a manifest under the tag, and the layers are blobs; on the VM — the same via `curl localhost:5000/v2/…/tags/list` |
| docker.x10 | B | m07 | Write a Dockerfile for a static site on nginx from the `site/` directory | the build succeeds; the container serves `site/index.html` on the published port |
| docker.x11 | I | m07 | Make it so that a code edit does not rebuild the dependencies | two builds, in the second the dependency step is CACHED and the code COPY is not |
| docker.x12 | I | m07 | Shrink the Go application image to less than 30 MB | size < 30 MB by the model; `/health` responds; there is a `COPY --from` |
| docker.x13 | I | m07 VM | `docker stop app` waits 10 seconds. Fix it | the initial CMD is in shell form `CMD python app.py; echo "app exited"` (sh stays PID 1 and does not forward the signal); the image variation is with or without a SIGTERM handler (the learner does not know which). The goal is the result of the stop, not the form of CMD: `stopDurationMs<2000` and `exitCode ∈ {0,143}`, plus PID 1 is not `sh` |
| docker.x14 | I | m07 | Remove the database password from the image history | `history --no-trunc` and the config do not contain the password; `--secret` or a variable at run time |
| docker.x19 | E | m08 VM | Explain from the rules how `-p 8080:80` works and repeat it by hand in v86 | in v86 a DNAT rule on 8080 to the container's address, the request goes through; on the VM — the Docker rule found in `iptables -t nat -S` and the `docker-proxy` process in `ss -ltnp` |
| docker.x20 | B | m09 VM | Translate the three `docker run` commands from b04, b09, b10 into `compose.yaml` | `compose up -d` gives an equivalent state: services, network, volume, variables |
| docker.x21 | I | m09 | The API fails at startup because the DB is not ready yet | see 15.2 |
| docker.x22 | I | m09 | Start the `adminer` service only with the `debug` profile | `up -d` without the profile does not create `adminer`; with `--profile debug` it does |
| docker.x23 | I | m10 | Run the application not as root | `exec(id -u)` ≠ 0; the application works |
| docker.x24 | I | m10 VM | Run nginx with minimal privileges | `--read-only` with tmpfs for `/var/cache/nginx` and `/run`, `--cap-drop ALL` and only the needed `--cap-add` (CHOWN, SETUID, SETGID, NET_BIND_SERVICE), `no-new-privileges`; HTTP 200 |
| docker.x25 | I | m10 | Limit the container to 128 MB of memory and 50 processes (rung 2: `--pids-limit`) | `hostConfig.memory=134217728`, `pidsLimit=50` |
| docker.x26 | E | m10 VM | Explain why `--privileged` lets you see the host's disks, and solve the task "mount a tmpfs at `/mnt` inside" without it | `privileged=false` and (`mounts[type=tmpfs][target=/mnt]` or `capAdd~SYS_ADMIN` and `exec(mount -t tmpfs t /mnt).exit=0`); the answer is graded by a rubric. The best answer is `--tmpfs /mnt` without new privileges; `SYS_ADMIN` is almost root; Docker's default seccomp profile with `SYS_ADMIN` already allows `mount`, so no custom profile is needed; on a VM with Ubuntu AppArmor `docker-default` gets in the way, and the `SYS_ADMIN` variant additionally requires `apparmor=unconfined` — the learner checks this on the VM |
| docker.x27 | E | m11 | Find the `web` container's process on the v86 host and enter its namespaces without `docker exec` | in v86: a process with the container's ns, and inside, the container's `hostname` (`nsenter -t <pid> -a`) |
| docker.x28 | I | m05 | Free up space: delete dangling images and unused volumes without touching the ones in use | no dangling images and no volumes without containers; the volumes of containers in use are intact |

The explanation when docker.x13 fails with "the exec form is there, but the code is 137": "now python is PID 1, and a PID 1 without a handler ignores SIGTERM: add `--init`/tini, a signal handler in the application, or change the stop signal". The variant with `STOPSIGNAL` without `--init` is the rung-4 task docker.p01. The scenario is published only with a golden recording: the behavior of `sh` (dash, busybox ash) changes from version to version.

---

## 15. Data formats

The format is shared with 01 (lesson), 08 (scenes) and 09 (goals over facts).

### 15.1. Lesson

```yaml
id: docker.m06.l1
module: docker.m06
levels: [beginner, intermediate, experienced]
uses: [D06, D11, L29, L30, L38]
scenes:
  - id: image-is-files
    kind: mechanism
    introduces: [D08]
    widget: {interactive: image-explode, screen: A}
    docs:
      - {url: "https://github.com/opencontainers/image-spec/blob/main/manifest.md", ladder: {beginner: 1, intermediate: 2}}
    blocks:
      - id: s1
        role: text
        draft: true
        en: "An [[D08|image]] is not one archive but a stack of layers plus a config..."
        ru: "[[D08|Образ]] — не один архив, а стопка слоёв и конфигурация..."
  - id: digest
    kind: mechanism
    introduces: [D19]
    blocks:
      - id: fact-1
        role: note
        draft: true
        hold: true
        check: "Engine 29: containerd image store default on fresh installs — need RU source"
        sources:
          - {lang: en, url: "https://docs.docker.com/engine/storage/containerd/"}
        en: "..."
        ru: "..."
```

### 15.2. Exercise

```yaml
id: docker.x21
module: docker.m09
level: intermediate
title: {en: "The API starts before the database is ready", ru: "API стартует раньше базы"}
setup: {env: sim, project: fixtures/compose-race/, run: ["docker compose up -d"]}
task:
  ru: "После `docker compose up -d` сервис api перезапускается несколько раз и падает. Сделайте так, чтобы api стартовал только когда база готова принимать соединения."
  en: "..."
docs:
  - {url: "https://docs.docker.com/reference/compose-file/services/#depends_on", ladder: {beginner: 2}}
doc_hint: {source: {kind: web, url: "https://docs.docker.com/reference/compose-file/services/#depends_on"}, anchor: "service_healthy", context_lines: 4}
goals:
  - id: g-health
    needs: [compose]
    when: "compose.services[name=db].healthcheck"
    fail:
      - if: "!compose.services[name=db].healthcheck"
        say: {ru: "Без проверки здоровья Compose знает только, что контейнер db запущен, а не что PostgreSQL готов. Добавьте healthcheck с pg_isready."}
  - id: g-wait
    needs: [compose]
    when: "compose.services[name=api].depends_on[name=db].condition=service_healthy"
  - id: g-stable
    do: ["docker compose down", "docker compose up -d"]
    needs: [containers, logs]
    when: "containers[service=api][state=running].restartCount=0 && !logs[service=api].text~'could not connect'"
forbid:
  - when: "compose.services[name=api].restart=always"
    say: {ru: "restart: always скрывает гонку, а не устраняет её: api всё равно падает, просто снова и снова."}
hints:
  - {after_attempts: 1, ru: "Посмотрите `docker compose logs api` — что пишет приложение в первые секунды?"}
golden: golden/scenarios/compose-race.yaml
```

Boundary drills add a first choice goal:

```yaml
goals:
  - id: g-boundary
    kind: choice
    ask: {ru: "На какой границе сломалось?"}
    options: [kernel, network, storage, process, io, identity]
    correct: network
    explain: {ru: "Отказ пришёл от сокета: это сеть, уровень L4."}
  - id: g-layer
    kind: choice
    ask: {ru: "На каком уровне?"}
    options: [L2, L3, L4, L7]
    correct: L4
```

### 15.3. A lab step in v86

```yaml
id: docker.m04.s4
lab: build-container
env: v86
image: lab-alpine
title: {ru: "cgroups v2: лимиты", en: "cgroups v2: limits"}
uses: [L35]
goals:
  - id: g-limits
    say: {ru: "Задайте группе box лимиты: 16 МБ памяти, 20 процессов, 20% CPU"}
    needs: [cgroups]
    when: "cgroups[path=/box].memory.max=16777216 && cgroups[path=/box].pids.max=20 && cgroups[path=/box].cpu.max='20000 100000'"
    fail:
      - if: "cgroups[path=/box].pids.max=max"
        say: {ru: "Лимит процессов не задан: запишите 20 в pids.max группы box."}
  - id: g-moved
    needs: [cgroups, procs]
    when: "cgroups[path=/box].procs~@pid(sh@ns)"
    fail:
      - if: "!cgroups[path=/box].procs~@pid(sh@ns)"
        say: {ru: "Группа есть, но процесс контейнера в неё не перенесён: запишите его PID с хоста в cgroup.procs."}
  - id: g-oom
    needs: [cgroups]
    when: "cgroups[path=/box].memory.events.oom_kill>=1"
  - id: g-pids-hit
    needs: [cgroups]
    when: "cgroups[path=/box].pids.events.max>=1"
  - id: g-throttled
    needs: [cgroups]
    when: "cgroups[path=/box].cpu.stat.nr_throttled>0"
visual: {diagram: ns-live, gauges: [memory, pids, cpu]}
```

`@pid(sh@ns)` is a 09 macro: the `sh` process whose last `NSpid` field equals 1.

### 15.4. Quiz question

```yaml
id: docker.m08.q03
module: docker.m08
type: predict
level: beginner
prompt: {ru: "Что выведет последняя команда?"}
code: |
  docker network create appnet
  docker run -d --name db --network appnet postgres:17-alpine -e POSTGRES_PASSWORD=x
  docker ps -a --filter name=db --format '{{.Status}}'
options:
  - {id: a, ru: "Up 2 seconds"}
  - {id: b, ru: "Exited (1) 2 seconds ago", correct: true}
  - {id: c, ru: "Created"}
explain:
  ru: "Флаг -e стоит после имени образа, поэтому Docker передал его postgres как аргумент, а не как переменную окружения. Без POSTGRES_PASSWORD образ завершается с кодом 1. Все флаги docker run пишутся до имени образа."
golden: golden/scenarios/flag-after-image.yaml
```

### 15.5. dsim state (for facts and the AI)

```json
{"engine":{"version":"29.10.0-sim","golden":"2026-11"},
 "containers":[{"id":"3f2a…","name":"web","image":"nginx:1.30-alpine","imageId":"sha256:…",
   "state":"running","exitCode":null,"restartCount":0,"oomKilled":false,"stopDurationMs":null,"sizeRw":1093,
   "ports":[{"host":"0.0.0.0:8080","container":"80/tcp"}],
   "networks":{"bridge":{"ip":"172.17.0.2"}},"mounts":[],
   "config":{"User":"","Cmd":["nginx","-g","daemon off;"],"Entrypoint":["/docker-entrypoint.sh"],"StopSignal":"SIGQUIT","Env":["…"]},
   "hostConfig":{"memory":0,"pidsLimit":null,"capAdd":[],"capDrop":[],"readonly":false,"privileged":false,"init":false,
     "user":"","stopTimeout":null,"logConfig":{"type":"json-file","config":{}},"sysctls":{},"ulimits":[]}}],
 "images":[…],"networks":[…],"volumes":[…],"builds":[…],"registry":{…},
 "history":["docker run -d --name web -p 8080:80 nginx:1.30-alpine"]}
```

### 15.6. Fact fields the block needs

The `dt.facts/v1` scopes that 09 adds at this block's request: `compose` (a normalized `docker compose config` + service states), `builds` (recent builds: steps, `cached`, size, `history`, the `--mount`s used), `registry` (repositories, tags, digests, request log), `logs` (per container, the tail of N lines, line times), `cgroups[].pids.events`, `cgroups[].cpu.stat`, `cgroups[].memory.events`, `procs[].status.{CapEff,NoNewPrivs,Seccomp,SigCgt}`, `procs[].root`, `mounts[pid]`, `links[netns]`, `routes[node]`, `host.sysctl`, as well as the `containers[]` fields from 15.5 (`oomKilled`, `stopDurationMs`, `sizeRw`, `hostConfig.init`, `stopTimeout`, `logConfig`, `sysctls`, `ulimits`, `config.StopSignal`). The `do:` step of a goal and the `@pid(cmd@ns)` macro are also 09's. On a real VM the same scopes are collected by `trainer-check docker` (section 18).

---

## 16. Quizzes by module

Each module has 8–12 questions of the 08 types (3.8): `choice`, `order`, `match`, `hotspot`, `predict`, `fill`, `explain`. Below are three questions per module to set the level.

**m01.** (1) "Can a Windows program be run in a container on a Linux host without a VM?" — no: a container uses the host kernel. (2) Order the "VM inside Kubernetes" tower from bottom to top. (3) "What starts faster and why?" — `explain`, rubric: no kernel boot, a process start.

**m02.** (1) `hotspot`: "click the namespace lane that gives the container its own PID 1". (2) "A process sees PID 1 inside and has PID 4123 on the host. Is it the same process?" — yes. (3) `match`: namespace ↔ cgroup ↔ "what it sees / how much it consumes".

**m03.** (1) `order`: the `docker run` chain. (2) "In which OCI state does the container process already exist but the program has not been started yet?" — `created`. (3) "Which of these is not a Docker state: `paused`, `restarting`, `removed`, `dead`?" — `removed`: after `rm` the container simply does not exist.

**m04.** (1) "Why did `ps` show host processes after chroot?" (2) `order`: the `pivot_root` commands. (3) "What happens if you do not move the process into `cgroup.procs`?" — the limits do not apply to it. Plus the six questions of the scene exam from 08 (6.1.10).

**m05.** (1) `predict`: `docker ps` after `docker run alpine echo hi` — empty, the container exited. (2) "What is the exit code after `docker stop` if the application did not exit within 10 seconds?" — 137, SIGKILL; "and if it handled SIGTERM and exited on its own?" — usually 0. (3) "In `-p 8080:80`, which number is the host port?"

**m06.** (1) "Does the `latest` tag mean the newest version?" — no, it is just a tag name. (2) `hotspot` in the stack: "where the deleted file is". (3) "Why does a repeated `docker pull` download only one layer?" — the rest matched by digest.

**m07.** (1) `find-bug`: `COPY . .` before `RUN npm ci`. (2) "How many layers will ENV, CMD, EXPOSE create?" — none. (3) "Why is the exec form a necessary but not sufficient condition for a correct stop?" — in the exec form the signal is received by the application itself, not by `sh`; but if the application is PID 1 and does not handle SIGTERM, the kernel ignores the signal, and `--init`, a handler or `STOPSIGNAL` is needed. Separately: the shell form of `ENTRYPOINT` ignores `CMD` and the `docker run` arguments.

**m08.** (1) The question from 15.4. (2) "Where does `nslookup db` look in a user-defined network?" — 127.0.0.11. (3) `match`: symptom ↔ boundary (`exec format error` — kernel, `Connection refused` — network, `docker logs` empty — input/output, `Permission denied` in a bind mount — identity).

**m09.** (1) `find-bug`: `DB_HOST=localhost` in compose. (2) "What does `docker compose down -v` do?" (3) "Does the short form `depends_on: [db]` guarantee that the database is ready?" — no.

**m10.** (1) "Is root in a container without a user namespace the host's root?" — the same UID 0, but with reduced capabilities and seccomp. (2) Choose the capabilities nginx needs on port 80. (3) "Why did a secret deleted in the next layer still leak?"

**m11.** (1) "Why is the shim needed?" — it holds stdio and the exit code and allows dockerd and containerd to be restarted without stopping containers. (2) "Where on disk are the image layers in Engine 29 on a fresh installation?" — in the containerd snapshotter, not in `/var/lib/docker/overlay2`. (3) "Why might `curl localhost:8080` from the host not go through DNAT?" — it is served by `docker-proxy`.

**m12.** (1) "Which namespaces do containers of one pod share?" — net, ipc, uts. (2) `predict`: a ping between containers on two nodes without routes. (3) "Does the source address change when a packet travels between node subnets via a route?" — no.

---

## 17. Exams

An exam is a set of tasks without hints and without the AI, with a soft timer (the time is recorded but does not cut anything off), checked by facts. Attempts are unlimited; each new one starts with a different variant of the initial data (service names, ports, versions, application). The documentation mode is rung 5 (5.6). Fields conform to the 10 schema: `id: exam-docker-e1`, `sandbox`, `goals`, `probe`, `docs_allowlist`.

### 17.1. exam-docker-e1. "A production image" (intermediate; for the beginner — items 1–4 and 7)

Given: a Go or Python application project (a variant) and a bad Dockerfile: `FROM golang:latest`, `COPY . .`, `RUN go build`, running as root, no `.dockerignore`, and the context contains a `.env` with a password and a 200 MB `testdata/`.

| # | Requirement | Goal |
|---|---|---|
| 1 | The image builds, and the application responds 200 on `/health` on port 8080 | `build` ok, `run` + `http` |
| 2 | Final size < 25 MB (Go) or < 180 MB (Python) | `builds[-1].size` |
| 3 | Base images with a pinned version, not `latest` | every `FROM` has a tag of the form `x.y` or a digest |
| 4 | The application does not run as root | `config.User` is not empty and not `0`/`root`; `exec(id -u)` ≠ 0 |
| 5 | A code edit does not rebuild the dependencies | two builds, the dependency step is CACHED |
| 6 | Secrets and junk did not get into the image | no `.env`, no `testdata/` in any layer; no password in `history` and config |
| 7 | There is a HEALTHCHECK | `config.Healthcheck`, the container is healthy |
| 8 | Outside the course (one from a pool): add the OCI label `org.opencontainers.image.source` (image-spec `annotations.md`); or speed up repeated dependency downloads with `--mount=type=cache` | `config.Labels` contains the key; or `builds[-1]` has a step with `mount cache` |

### 17.2. exam-docker-e2. "Fix the compose file" (beginner and intermediate)

Given: the `compose.yaml` of a three-service application (web on nginx as a reverse proxy, api, db) with six errors, one per topic: `ports: "80:8080"` instead of `"8080:80"`; `DB_HOST: localhost`; the database volume on `/var/lib/postgres` instead of `/var/lib/postgresql/data`; `depends_on` without a condition while there is no healthcheck; `api` in a separate network unreachable from `web`; `POSTGRES_PASWORD`. Outside the course (one from a pool): "logs must not take more than 30 MB per service" (`logging.options`); "api must start only after a one-off migration has completed" (`condition: service_completed_successfully`).

Goals: `docker compose up -d`; HTTP 200 on `localhost:8080/api/items` with data from the database; `probe: recreate-db` — `docker compose down && docker compose up -d`, and the data added via `POST /api/items` is still there; no service has any restarts. The learner sees not a list of "errors found" but the result of three checks.

### 17.3. exam-docker-e3. "A container without Docker" (intermediate and experienced, v86)

Task: "Run `/opt/exam/app` (busybox httpd with files) so that: inside it is PID 1, its own name `exam`, its own mnt/net/uts/ipc/pid, the root is an overlay of two directories in `/opt/exam/layers/` (with whiteout conversion), a limit of 24 MB of memory and 15 processes, the address 10.20.0.2/24 reachable from the host, and the page opens from the host at `http://127.0.0.1:9090`." Goals — the items of the m04 final check plus DNAT. For the experienced additionally: the process is started as an unprivileged user via a user namespace, and `ptrace` is forbidden by a seccomp profile (`strace` inside gets EPERM). Limits for an unprivileged container require a delegated cgroup subtree: the exam's starting snapshot contains the group `/sys/fs/cgroup/exam` delegated to `student` (owner of `cgroup.procs`, `cgroup.subtree_control` and the limit files, the hierarchy mounted with `nsdelegate`); the task says so. Outside the course: "forbid the process from gaining new privileges through setuid" (`process.noNewPrivileges` in `config.json`; the course covered only `--security-opt`).

### 17.4. exam-docker-e4. "On call" (intermediate and experienced, dsim)

Four incidents in a row in one environment, each a message "from the team chat" plus the system state; the first goal of each is the boundary (12.2):

1. "The site does not open" — the application listens on 127.0.0.1 inside the container.
2. "The worker container keeps restarting" — `OOMKilled: true`, a 64 MB limit with 90 MB consumption; the solution is to raise the limit to the value from the README, not to remove it.
3. "The disk ran out" — 40 dangling images and the build cache; free up space without deleting volumes with data and images in use.
4. "After the api image update everything broke" — the `latest` tag was moved to an incompatible version; roll back to the previous one by digest from `deploy.log`.
5. Outside the course (one from a pool): "a container log ate the disk" (`--log-opt max-size`, `max-file`); "find the container that writes the most to disk" (`docker ps -s` / `docker system df -v`).

For each incident, besides the fix, the learner writes one or two sentences on "the cause and what I did" — the rubric is checked by self-check or by the AI during the post-exam review.

---

## 18. Real Docker on a VM (m13, R12)

At this stage the trainer does not execute but guides and checks: the learner runs the commands on their own machine, and the trainer shows the steps, collects facts and checks the goals.

1. **Where to get a VM.** The learner gets the machine themselves: from a cheap Russian or international cloud in the 09 price list (5.2), or as a local VM on their own computer (Multipass, Vagrant with VirtualBox, UTM; 09 §5.3). For a cloud, before ordering, the trainer shows the price of the chosen machine per hour and for the expected 2 hours of the module, and the `trainer=devops` label that the learner puts on the machine.
2. **Installation.** Docker Engine from the official repository, `docker info` and a comparison with what the learner knows: storage driver or containerd store, cgroup driver, security options (AppArmor on Ubuntu), firewall backend.
3. **Repeating the eight exercises marked "VM":** docker.x02, x09 (with a `registry:2` brought up on the VM: `docker run -d -p 5000:5000 registry:2`), x13, x19 (find the Docker rule in `iptables -t nat -S` and `docker-proxy` in `ss -ltnp`), x20, x24, x26 (AppArmor `docker-default`), b09.
4. **Checking.** `trainer-check docker` on the VM collects facts (`docker info`, `docker ps -a --format json`, `docker image ls --format json`, `docker volume ls`, `docker inspect`, `iptables -t nat -S`, `nft list ruleset`, `ss -ltnp`) into `dt.facts/v1` and checks the same goals as in dsim, per the 09 contract; the result arrives in the trainer.
5. **Mandatory cleanup.** The last step: "Delete the VM", with the command for the provider (`hcloud server delete …`, `yc compute instance delete …`; for a local VM, `multipass delete --purge` or `vagrant destroy`). For a cloud, the module is credited only after `trainer-check cleanup --provider …` has printed a block from which the trainer sees that the provider has no machines with the learner's label (09 §5.7). If the cloud machine has not been deleted within 24 hours, a reminder is sent.

m13 is preparation for stage 2 of the Kubernetes block (a cluster on one machine or one VPS): the same machine and the same ordering mechanism are used there later.

---

## 19. Interview preparation (m14)

**The "container versus VM" answer builder.** Following the checklist scheme "what it is → why → how it works → when you use it". The learner assembles an answer from statement cards (some correct, some typical mistakes: "a container is a lightweight virtual machine", "Docker virtualizes the kernel"), arranging them into four parts, then says the answer out loud or writes it. The rubric of mandatory elements: the shared host kernel; namespaces restrict visibility (name at least pid, net, mnt); cgroups restrict resources; a VM emulates hardware and carries its own kernel through a hypervisor; the consequences — size, start speed, density, strength of isolation; when to choose which (untrusted code and a different kernel — a VM, dense packing of homogeneous services — containers) and today's combinations (containers in cloud VMs, Kata Containers, VMs inside Kubernetes via KubeVirt). If an AI is connected, it checks the answer against the rubric and asks one follow-up question, like an interviewer.

**12 questions with rubrics:** how an image differs from a container; what a layer is and why the order of instructions matters; CMD versus ENTRYPOINT and what happens with signals; COPY versus ADD; volume versus bind mount; how containers communicate over the network and what a user-defined network is; what multi-stage is; how to shrink an image; why not to run as root and what capabilities are; what happens on `docker stop` and when memory is exceeded; tag versus digest; what happens on `docker run` (the chain of components). For each — a rubric of 3–5 elements and a link to the module.

---

## 20. Your own AI (DeepSeek and others)

The general mechanics are in 09 (section 4). For this block the AI receives: the lesson and scene identifier, the learner's level and current ladder rung (`ladder_step`) with the lesson's `docs` field; the list of concepts already introduced (an instruction not to use the others — the same order control as for texts); the last 20 commands with output; dsim facts (15.5) or the latest `trainer-agent` snapshot; the task text and the explanations of failed goals. The "explain" button is available on command output, on an error message, on a failed goal and on every explainer element. At rung 4 rule 5.7 applies (`hint_policy: point-to-docs`). The AI is off in the entry check and in exams; a review is available after an exam. The API key is stored only in the learner's browser.

---

## 21. Device load and offline

The `lab-alpine` machine — 96 MB of guest memory, snapshot ≤ 20 MB, the first launch is tens of megabytes of traffic (kernel, snapshot, 9p files on demand); tab budgets follow the 09 table (1.4). dsim with the registry is about 100 KB gzipped plus the models and golden outputs. Everything is cached by the Service Worker, and a repeat launch needs no network. Phone: one v86 node when `navigator.deviceMemory ≥ 4`, otherwise recorded mode and QR handoff to a computer; dsim works with a simplified terminal and chips for common flags. Every explainer (X1–X9), interactive and boundary drill must work without v86 — on dsim/netlab or from recorded facts; a live v86 only adds a terminal.

---

## 22. Dependencies and versions

xterm.js (`@xterm/xterm` 6.x), v86 (vendoring a build at a specific commit with a hash), `dockerfile-ast`, `yaml`, `ajv` with the compose-spec JSON schema, `fzstd`, `cbor-x`. Versions are pinned to exact numbers; an update is a separate change with a run of the golden scenarios. Image and engine versions in texts come only through `content/versions.yaml` (`engine`, `nginx_tag`, `alpine_tag`, `postgres_tag`, `python_tag`); the examples in this document are as of 18.11.2026 (Engine 29.10, `nginx:1.30-alpine`, `alpine:3.22`, `postgres:17-alpine`). There is one Alpine branch for v86 for the whole course, pinned in 09; the rule is the latest release where x86 is still built, with a check that x86 is present on update. The minirootfs archive name is taken with the patch number (`alpine-minirootfs-3.22.<patch>-x86.tar.gz`) from `versions.yaml`.

---

## 23. What we take from the Sankofa engine and 08

| Mechanism | Where it is used in the block |
|---|---|
| Scroll scenes (`scroll.ts`, the 08 `scrub` mode) | Textbook chapters; the progress of the "leading" scene drives the explainer's stepper step |
| `stepper`, `diagram`, `split`, `terminal`, `breakit`, `packets`, `constructor`, `quiz` (08, section 3) | Explainers X1–X9, interactives 1–2, the lab, the boundary drills |
| Layers (`layers.ts`) — as the mechanic of spreading a stack apart | Screen F of interactive 2; the drawing is a technical drawing, not tracing paper |
| Calm mode (`calm.ts`) | All animations; transitions are instant, scrubbing remains |
| QR handoff (`handoff`) | The lab on a computer, the theory and step questions on a phone; "the diagram on a second screen" |
| Bilingual YAML blocks (`Bi {en, ru}`) | All texts of the block |
| `draft` / `hold` and the two-source rule | Every factual statement (Docker defaults, the capability list, Engine 29 behavior) is a block with `sources:`; without two sources or a golden recording it is `hold` |
| Lenses — as a point-of-view switch | X1: "what component X sees"; without "witnesses" and "testimonies" |
| The glossary linker (`lib/links.ts`) | Term markup and checking the order of introduction (section 3) |
| Ink (`ink.ts`), the "development" from ink → drawing | Not used in the block |
| Clap and sound (`clap.ts`) | Not used: sound turns an exercise into a game |

---

## 24. Sources

### English

- Liz Rice, "Containers From Scratch": https://github.com/lizrice/containers-from-scratch ; "Container Security" (O'Reilly, 2020).
- Julia Evans, "How Containers Work": https://wizardzines.com/zines/containers/
- Ivan Velichko, iximiuz Labs: https://labs.iximiuz.com/tutorials/container-filesystem-from-scratch ; https://labs.iximiuz.com/challenges/union-mount-container-image-layers-using-overlayfs ; https://labs.iximiuz.com/tutorials/change-your-root-chroot-basics-1cef74c2
- OCI Image Spec (manifest, config, layer, image-index, annotations): https://github.com/opencontainers/image-spec
- OCI Runtime Spec (`config.md`, `config-linux.md`, `runtime.md`): https://github.com/opencontainers/runtime-spec
- OCI Distribution Spec: https://github.com/opencontainers/distribution-spec/blob/main/spec.md
- Docker docs: containerd image store — https://docs.docker.com/engine/storage/containerd/ (including "not available when using user namespace remapping", moby#47377); storage drivers — https://docs.docker.com/engine/storage/drivers/select-storage-driver/ ; seccomp — https://docs.docker.com/engine/security/seccomp/ ; AppArmor — https://docs.docker.com/engine/security/apparmor/ ; nftables — https://docs.docker.com/engine/network/firewall-nftables/ ; packet filtering — https://docs.docker.com/engine/network/packet-filtering-firewalls/ ; logging — https://docs.docker.com/engine/logging/configure/ ; build cache — https://docs.docker.com/build/cache/ ; multi-stage — https://docs.docker.com/build/building/multi-stage/ ; Engine 29 release notes — https://docs.docker.com/engine/release-notes/
- Docker's default seccomp profile: https://github.com/moby/profiles/blob/main/seccomp/default.json
- Linux man-pages: `namespaces(7)`, `pid_namespaces(7)` (PID 1 signals), `user_namespaces(7)`, `cgroups(7)`, `capabilities(7)`, `pivot_root(2)`, `unshare(1)`, `nsenter(1)`, `capsh(1)`; cgroup v2 — https://docs.kernel.org/admin-guide/cgroup-v2.html ; OverlayFS (including "Changes to underlying filesystems") — https://docs.kernel.org/filesystems/overlayfs.html
- Kernel: `init/Kconfig` (`SCHED_AUTOGROUP` selects `CGROUP_SCHED` and `FAIR_GROUP_SCHED`) — https://github.com/torvalds/linux/blob/master/init/Kconfig
- Michal Pitr, "Linux container from scratch": https://michalpitr.substack.com/p/linux-container-from-scratch
- Martin Heinz, "Deep Dive into Docker Internals — Union Filesystem": https://martinheinz.dev/blog/44
- Registry Explorer: https://oci.dag.dev , https://github.com/jonjohnsonjr/dagdotdev
- v86: https://github.com/copy/v86 , Alpine build: https://github.com/copy/v86/tree/master/tools/docker/alpine , networking: https://github.com/copy/v86/blob/master/docs/networking.md
- Alpine: kernel configurations — https://github.com/alpinelinux/aports/tree/master/main/linux-lts (`virt.x86.config`); iptables via nft since 3.19 — https://wiki.alpinelinux.org/wiki/Release_Notes_for_Alpine_3.19.0 ; `httpd` in `busybox-extras` — https://unix.stackexchange.com/questions/452194
- KubeVirt: https://kubevirt.io/user-guide/ ; Cozystack: https://cozystack.io/docs/
- container2wasm (rejected): https://github.com/container2wasm/container2wasm ; WebVM/CheerpX (rejected): https://github.com/leaningtech/webvm

### Russian

- Habr, OverlayFS in Docker: https://habr.com/ru/post/701950
- Habr, a breakdown of `manifest.json` from `docker save` (OTUS): https://habr.com/ru/companies/otus/articles/859256
- Habr, manifests and multi-arch: https://habr.com/ru/posts/990638
- Habr, chroot versus pivot_root: https://habr.com/ru/articles/880342
- Habr, a container via unshare and cgroups: https://habr.com/ru/articles/880354
- Habr, cgroups v1 and v2: https://habr.com/ru/articles/858780
- Habr, pivot_root in C code: https://habr.com/ru/post/527542
- The docker_ru Telegram chat (from the checklist resources) — for the "where to ask" section.

Before publication every fact block goes through the two-source rule; for each Russian link it is noted before publication whether it is an original or a translation: a translation of an English source does not count as a second independent source.

---

## 25. What is needed from other roles

- **01 (andragogy):** moving D03, D04, D05, D09 into the L group (the proposed L33–L39), the new concepts D24–D33, replacing the Docker section of the 01 §4.3 entry check with section 13.
- **02 (Linux):** the module "How the kernel isolates and limits" with concepts L33–L39 and the OOM-kill exercise; the `student` user; the man pages `namespaces(7)`, `pid_namespaces(7)`, `cgroups(7)`, `capabilities(7)`, `unshare(1)`, `nsenter(1)`, `capsh(1)` in the images; the `docs`/`doc_hint` format shared across blocks.
- **03 (networks):** netlab as the dsim network (`net-adapter`), the shared JS switch for two v86 nodes, layer colors for X6 and X9.
- **05 (Kubernetes):** the `box` contract (section 10) as the runtime of the hybrid Kubernetes node agent; pod = shared net/ipc/uts through `path`; the continuation of X9 via VXLAN; a shared exam reader mode.
- **08 (multimedia):** remove scenes 6.1.0 and 6.2.0 (ink), move 6.1.2–6.1.7 to Linux, add the `--c-ns-time` token, the correspondence table 6.11.
- **09 (platform):** the combined `dt-kernel` fragment with the requirements of 9.2 and a kconfig check in CI; `lab-alpine` at 96 MB and the `node` profile; `trainer-agent` with `watch` and the fact scopes of 15.6; `docs.snapshot` per the list in 5.8; the registry at a same-origin path and rewriting `registry.lab` in the `fetch` adapter with a check of `HEAD`/`PATCH`/headers; `hint_policy: point-to-docs`; the identifier rule `docker.m…/x…/b…/f…/p…`.
- **10 (assessment):** the `docs_allowlist` field on an exam; the exams `exam-docker-e1…e4` per the 10 schema.
- **Course infrastructure:** a team test VM for golden recordings; the price-before-ordering screen and the cleanup check (`trainer-check cleanup`) shared with the Kubernetes block.

---

## Changes after review

### What was changed

1. **Concept order (R6; 02 #1, #8, #28; 09 #1, #18, #26).** Section 2 of the previous revision was split into "relies on" (3.1) and "introduces" (3.2). Namespaces, cgroups, capabilities, chroot/pivot_root, overlayfs and seccomp are no longer introduced by the block: they are in the Linux module "How the kernel isolates and limits" with the proposed IDs L33–L39; veth, NAT, DNAT, DNS come from networking. The 01 concept IDs and the new D24–D33 were introduced, the lesson format was aligned with 01 (`introduces` per screen, `uses`), and D14 (variables) and OOM were put in order. The identifiers of modules, exercises and tasks follow the 09 rule.
2. **Curriculum (09 #1, #7; 02 #29).** The order of modules is the same for all levels: lab m04 comes right after m02 for the beginner too. D2 became "A container from familiar parts" without a new vocabulary. Module m03 "Anatomy of a container" (OCI bundle, the runtime chain, OCI and Docker states) was added before the first steps. The former "Data and network" became module m08 "The six boundaries". m12 "Node runtime" was added. "Express" was defined, and the "if you are a programmer" sidebar was added.
3. **Textbook (R1; 02 #10; 09 #16).** Section 2 on chapter structure and chapter plans for all modules (4.3) were added, with a leading question, the order of sections, and the placement of the explainer, documentation and practice.
4. **Documentation ladder (R2; 02 #3, #31; 09 #3, #21, #30).** New section 5: rungs by module and level, the `docs`/`doc_hint` format on `docs.snapshot`, full help in dsim and a refusal without explanation for an unsupported flag, rung 3 tasks (docker.f01–f10) and rung 4 tasks (docker.p01–p14), the exam allowlist, the AI rule "where did you look?", the list of needed pages. The experienced entry check starts from rung 3. Man pages were added to the image.
5. **Process explainers (R3, R4; 02 #4, #6, #32; 09 #4, #5, #20).** New section 6 with general rules and storyboards X1–X9 screen by screen: what is on screen, what moves, what is clickable, parameters, "break it", explanation. "Rashomon" became a sequence diagram with filter lenses. The "VM versus container" scene was replaced with explainer X4 with nesting (cloud, Kubernetes on bare metal, KubeVirt/Cozystack), a slider for the number of applications, a kernel vulnerability toggle and counters. The VM measurement is a cold boot of a second v86 instance without a snapshot. The rule that explainers work without v86 and in calm mode.
6. **Visual language (R4, R5; 02 #2; 09 #2).** Houses, rooms, ink, shelves, mailboxes and "witnesses" were removed. Interactive 1 was rewritten as a technical drawing: a kernel band with eight namespace lanes, dashed frames with inodes, cgroup gauges, toggles and sliders. Screen F is drawing-style plates with the `layers.ts` mechanic. The table of Sankofa mechanisms (23) keeps only those allowed by R5.
7. **Six boundaries (R7b; 02 #5; 09 #5, #20).** New section 12: the boundary table and drills docker.b01–b22 with the first goal "at which boundary" and the R8 layer for network drills, the final b-mix; explainer X5; d15–d18 were folded into the drills.
8. **Anatomy (R7a; 09 #7; 02 #23).** The OCI bundle, the runtime chain and states are introduced in m03; the lifecycle was corrected to a graph with the real Docker states (`created`, `running`, `paused`, `restarting`, `removing`, `exited`, `dead`) and OCI states (`creating`, `created`, `running`, `stopped`), and "removed" is no longer a state (X8).
9. **Platform contracts (02 #7, #21; 09 #6, #12, #17, #27, #28).** Our own kernel fragment, `nsview` and the check agent on `ttyS1` were replaced with `dt-kernel`, `trainer-agent` with `watch` mode and `dt.facts/v1` facts; the agent does not `fork` per pass, lives in its own group `/trainer` and is hidden from the diagram. The checks of d21 and lab step 4 were rewritten as `goals/when`; the needed fact scopes are listed (15.6). `engine/net.ts` was replaced with `net-adapter` on top of netlab, and the shell in a container is the Stand. The `student` user. The `ttyS2` terminal is described. A correspondence table with the 08 scenes was added. The tab budget is a reference to 09.
10. **Kernel (02 #12; 09 #8).** The kernel requirements were handed to the shared 09 fragment: the nft backend (`NF_TABLES`, `NFT_*`), `NF_CONNTRACK`/`NF_NAT` built in, `BRIDGE_NETFILTER`, `TMPFS_XATTR`, `TIME_NS`, `VXLAN`, `WIREGUARD`; a kconfig check in CI against silent downgrades; `cgroup_no_v1=all` and `rc_cgroup_mode="unified"`; step 4 checks `stat -fc %T`.
11. **Lab errors (02 #14–#18, #27; 09 #9, #24).** The container PID is found via `pgrep -x unshare` and `pgrep -P`, with an explanation of `pid_for_children`; our own `trainer-rootfs` with `busybox-extras` and `/www`, `httpd -f`, a CGI for the UTS name instead of serving `/etc`; `capsh --shell=/bin/sh` as root and `unshare --user` as `student` with three experiments; whiteouts are converted only after `umount`, `setfattr` was added (the `attr` package); for overlay — the `trainer/shell-app` layers, not a Go image without a shell; the chroot escape is shown via `/proc/1/root`; the memory limit has headroom (16 MB with a 24 MB load), `memory.swap.max` was removed; the answer about shared namespaces is `user` and `time`; eight kinds of namespaces, not seven.
12. **Content errors (02 #13, #19, #22, #25; 09 #10, #11, #25).** docker.x13 (formerly d13) checks the result of stopping (`stopDurationMs`, code 0/143, PID 1 is not `sh`), and the initial CMD is in shell form with a following command; the m07 theory and a quiz question about the exec form being necessary but not sufficient (a PID 1 without a handler ignores SIGTERM). docker.x26 (formerly d26): the correct answer is `--tmpfs`; Docker's seccomp with `SYS_ADMIN` allows `mount`, and on Ubuntu AppArmor gets in the way. `ping` in dsim follows `ping_group_range` and the golden recording. A caveat about `docker-proxy` and the differences between the Docker 28/29 rules; the experimental nftables backend of Engine 29 is mentioned.
13. **Registry (02 #20; 09 #14).** The name `registry.lab` instead of `.local`, the same-origin path `/registry/v2` with rewriting in the `fetch` adapter, an insecure registry in dsim, `PATCH`, `Range`, `Location` added; for a VM — `registry:2` on the VM; docker.x09 was rewritten.
14. **Hybrid Kubernetes and several nodes (R11; 02 #9; 09 #15).** New section 10: the `box` contract with a pod sandbox (a pause process, `path` to namespaces), pull with whiteout conversion, per-pod cgroups, `box ps --json`; a 96 MB budget, 3–4 nodes on a laptop, one on a phone with `deviceMemory ≥ 4`; an exercise with two nodes and routes between container subnets, and explainer X9 as a bridge to Kubernetes networking (R9).
15. **Real VM (R12; 02 #11; 09 #19).** Section 18: the trainer guides and checks, a machine from the learner's cloud or a local VM, the price before ordering, `trainer-check docker`, mandatory cleanup checked by `trainer-check cleanup`; eight "VM" exercises instead of the stated eight with only five marked.
16. **Exams (09 #13).** Rung 5: the documentation allowlist, a task outside the course in every exam, fields per the 10 schema, a delegated cgroup for the unprivileged variant of E3.
17. **Versions and minor items (02 #26, #27; 09 #22, #31).** Versions via `content/versions.yaml`, examples as of 18.11.2026 (`nginx:1.30-alpine`, Engine 29.10); the typo "на образ ссылаются" ("the image is referenced by") was fixed; sources were supplemented with `pid_namespaces(7)`, the moby seccomp profile, AppArmor, nftables, `init/Kconfig`; an "original/translation" mark on Russian links.
18. **A bridge to the reconciliation loop (R10).** The Compose chapter shows how the one-time reconciliation of `compose up` and the restart policy differ from the endless reconciliation loop of Kubernetes.

### What was rejected or accepted partially

- **02 #12, the point about `SCHED_AUTOGROUP`** ("autogroup has nothing to do with the cpu controller"). Rejected. According to `init/Kconfig`, `SCHED_AUTOGROUP` selects `CGROUPS`, `CGROUP_SCHED` and `FAIR_GROUP_SCHED`, so the `cpu` controller in Alpine's base configuration really is present for exactly this reason; 09 #8 is right. The wording in 9.2 was clarified: only `CFS_BANDWIDTH` provides `cpu.max`.
- **02 #1, the point "for the beginner D3 stays after D8".** Rejected in favor of 09 #1: since the parts are introduced in Linux, the former argument "`unshare` is hard for a beginner" no longer holds, and a postponed lab breaks graph 01 (D06 requires chroot). The lab comes right after m02 for everyone.
- **02 #5, a separate module D7b.** Accepted in substance, rejected in form: per 09 #5 the former module "Data and network" was merged into "The six boundaries" (m08); otherwise volumes and networks would be explained twice — first on their own, then as boundaries.
- **02 #29, moving all the practice from D1 to the end of D2.** Partially accepted. The "inside and outside the container" comparisons and the start-time measurement were moved to m02. The "this Linux is itself a VM" practice (`dmesg`, SeaBIOS) stayed in m01, as 09 #5 suggests: it has no containers, and R7c requires it next to explainer X4.
- **02 #9, the pod sandbox as `sleep infinity`, and 09 #15, the sandbox as `ip netns add`.** Combined: a pause process holds net, ipc and uts (a pod in Kubernetes shares all three, while `ip netns add` gives only the network), and its net namespace is bound to `/run/netns/<pod>` so that `ip netns` works. Instead of `sleep infinity` — `sleep 2147483647`, because support for `infinity` in busybox depends on the build.
- **02 #20 (`registry.lab`) and 09 #14 (keep `registry.trainer.local` with rewriting).** The name was taken from 02 (the `.local` zone is taken by mDNS, and 09 already has the `.lab` training zone), and the rewriting mechanism and the same-origin path from 09.
- **02 #9, "a 96 MB budget for lab-alpine" versus 256 MB in the 09 table.** 96 MB was accepted; the limits of the OOM exercises were reduced accordingly. If the 09 spike shows that the lab does not fit in 96 MB, only the lab profile changes, not the node profile.
- **09 #8, "mention Docker's experimental nftables only after checking".** Checked against the Docker documentation (Engine 29.0, `firewall-backend: nftables`, experimental), so it is mentioned in m11 and X6 for the experienced; it is not used in exercises until there is a golden recording.
- **02 #12, `CONFIG_TIME_NS` "is not in the base".** Accepted as an explicit line in the fragment, but with a correction: the option has `default y`, and the aports file stores only the differences from the defaults, so its absence from the file does not mean it is off. The line is needed so that the kconfig check in CI guarantees what the lab relies on.
