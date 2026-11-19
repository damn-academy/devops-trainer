# Review of 04-containers.md (reviewer: the author of 09, runtime environments and AI)

Reviewer: solution architect (document 09). Date: 18.11.2026. Subject: `design/04-containers.md`, draft of 18.11.2026. Checked against documents 01, 02, 03, 05, 08, 09, 10, the Alpine 3.22 aports sources, the Docker documentation and moby releases as of 18.11.2026.

## Verdict

As an engineering document on the runtime, 04 is strong: the "container by hand" lab goes all the way down to the crun `config.json`, the image breakdown goes down to the byte, the simulator has golden recordings, and the registry and build cache model is done honestly. But in its current form the document cannot be handed over to development, for three reasons. First: after the owner's second wave of requirements the document rests on outdated premises. It introduces namespaces, cgroups, capabilities, overlayfs and seccomp itself, although under R6 these are now the foundation of the Linux block. Its visual language is ink-based, with "houses", "rooms", a "bookshelf" and "Rashomon witnesses", and R4 and R5 explicitly forbid this. The documentation ladder (R2) is missing entirely, and on top of that the simulator is designed against it: the help is cut down, and on an unsupported flag it explains by itself what that flag means. The six boundaries and the "hardware → VM → containers → nesting doll" explainer (R7) are also missing. Second: the document diverges from the platform. The check format, the in-guest agent, the kernel, the network engine and the 08 storyboards exist in two incompatible versions. Third: the v86 lab has errors the learner will get stuck on. `pgrep` finds the wrong process, minirootfs has no `httpd`, `capsh` has no `/bin/bash`, the kernel fragment enables iptables-legacy, while in Alpine 3.22 `iptables` runs on nft. There are also two substantive errors in the exercises: d13 on PID 1 and d26 on seccomp. Below are 31 findings: 6 blocking, 15 major, 10 minor. For each owner requirement I have written ready text that can be pasted in.

---

## Blocking

### 1. BLOCKING. The block introduces kernel primitives itself, although under R6 they are the foundation from Linux

**Where:** section 2 "Order of introducing entities" (rows 4–8, 15, 27), 3.2 (D2, D3), 3.3 (D2), 6.3–6.4.

**What is wrong.**
- R6 requires that process and thread, namespaces (`unshare`, `nsenter`, `/proc/<pid>/ns`, `lsns`), cgroups v2 (`memory.max`, `cpu.max`, `pids.max`, an OOM drill), capabilities (`capsh`, `getcap`/`setcap`), mount/chroot/overlayfs and seccomp (at the level of the idea) be introduced in the Linux block. In 04 they are introduced in D2/D3 (entities 4–8), OverlayFS in D5 (15), seccomp in D9 (27).
- The 01 graph (section 6.2) keeps them in group D (D03 namespaces, D04 cgroups, D05 chroot, D09 overlayfs). Under R6 these rows move to group L, and 01 will have to be fixed as well. Right now 04 and 01 agree with each other, but both diverge from the owner.
- The beginner route (3.2: D1 → D2 → D4 … D8 → D3) also violates the 01 graph itself: D06 "container" requires D05 `chroot`, but the beginner gets `chroot` only in D3, after Compose. The text says that "lessons D4–D8 are written so that they do not use them", but a build under the 01 rule (6.1: prerequisites of `introduces` are introduced earlier) will fail on the first screen of D4, where the container is introduced.
- `veth` (entity 7) is N20 from the networks block. 03 (section "What is needed from others", the row about the Docker block) says directly: "The Docker block does not re-introduce NAT, DNAT, the bridge switch".

**Fix.** In section 2, split the table in two.

Table A: "Relies on (introduced earlier, in the Linux/networks block)". It can be pasted as is; the identifiers of the new L concepts need to be agreed with the author of 02/01:

| Concept | Where introduced | What the D block does with it |
|---|---|---|
| process, PID, PPID, `fork`/`exec`, thread (`/proc/<pid>/task`, `ps -eLf`) | Linux, "How the kernel isolates and limits" (R6) | uses: container PID 1, double PID |
| namespace, 8 kinds (mnt, pid, net, uts, ipc, user, cgroup, time), `unshare`, `nsenter`, `lsns`, `/proc/<pid>/ns` | Linux (R6); net namespace — N21 | assembles a container from them (D3) |
| cgroup v2, `memory.max`, `cpu.max`, `pids.max`, `memory.events`, OOM killer | Linux (R6) | links to `--memory`, `--cpus`, `--pids-limit`, `OOMKilled` |
| capability, `capsh`, `getcap`/`setcap`, bounding set | Linux (R6) | Docker's default set, `--cap-drop/--cap-add` |
| `chroot`, `mount --bind`, mount namespace and propagation, `pivot_root` (idea), OverlayFS (lower/upper/work/merged) | Linux (R6) | image layers as lowerdir, container layer as upperdir |
| seccomp (system call filter, idea) | Linux (R6) | Docker's default profile, `seccomp=` |
| veth, bridge, NAT, DNAT, iptables/nft, DNS | Networks (N11, N17, N20, N21, N08) | `docker0`, `-p` as DNAT, 127.0.0.11 |

Table B: "Introduced by the D block". It keeps everything that belongs to containers: the container as an assembly of a process, namespaces, cgroup and rootfs; OCI bundle; runtime; image; layer (as a unit of the image, not as a filesystem mechanism); digest; manifest; registry; Dockerfile; cache; ENTRYPOINT/CMD; volume; Docker networks; Compose; healthcheck; Docker security profile; containerd/shim.

Rename D2 to "A container from familiar parts". This is a review-synthesis (a retrieval-practice pass from 01), not an introduction: 4 recall questions on L concepts, then interactive 1 (reworked per finding 2). D3 is placed right after D2 for all tiers: the beginner already has the parts from Linux, so the former argument "`unshare` is hard for a beginner" no longer holds. The beginner takes D3 with hints from steps S1–S2 of the 01 support ladder instead of postponing it.

### 2. BLOCKING. The visual language contradicts R4/R5: ink, houses, rooms, characters

**Where:** 4.2 ("each container is drawn as a house… a room… drawn in ink", "bookshelf", "mailbox"), 4.4 ("the walls are drawn at once"), 5.3 screen F (fan of sheets `layers.ts`), 6.3 ("each room is drawn in ink"), section 8 (`ink.ts`, "Rashomon" with "six witnesses", "a witness who gave no testimony").

**What is wrong.** R4 requires only simple process animation, without cartoons, characters, plot or decoration. R5 requires clean engineering graphics in the spirit of Ciechanowski and Comeau, and excludes Sankofa ink drawings. From Sankofa it is allowed to take the magazine-style text presentation, scroll-driven scenes, layers, calm mode, lenses, QR, bilingual YAML and draft/hold. The "house and rooms" metaphor is exactly decoration and a character. The "witnesses" are a plot. 08 (section 5, line 220) has already restricted ink to metaphors, while 04 uses it to draw a mechanism, so it violates 08 as well.

**Fix.** For interactive 1 and the D3 lab I propose the following visual vocabulary (replaces 4.2):

- **Kernel band** at the bottom, full width, color `--c-kernel` (dark graphite). Above it, a thin "system call" boundary and **user space** (`--c-user`, light background). R5: color carries the meaning "kernel / user space".
- **Process** — a 1.5 px rectangle with a 6 px corner radius. Inside, `comm` and PID in a monospace font. The double PID is written as `1 · 4123` with the caption "inside · on the host".
- **Namespace** — a dashed frame around processes in its own color: pid `--c-ns-pid`, mnt `--c-ns-mnt`, net `--c-ns-net`, uts, ipc, user, cgroup, time. The inode number sits on the frame itself, like a label on a line. Host (initial) namespaces are solid thin frames across the full width. If a namespace is shared with the host, the process has no frame of its own in that color: the absence is immediately visible.
- **cgroup** — a horizontal bar under the process (`memory.current` / `memory.max`, `pids.current` / `pids.max`, CPU share / `cpu.max`). The limit is marked with a vertical line and a number. No gauge needles, no "red line".
- **rootfs** — a column of paths to the right of the process; each row has the mount type (`overlay`, `proc`, `tmpfs`, `bind`) from `/proc/<pid>/mountinfo`.
- **veth** — a line from the net frame to the host bridge with labels on the line: `eth0@if7 ↔ veth3a1f@if6`.
- A click on any element opens a card: what it is, which kernel file shows it (`/proc/4123/ns/pid`), the command to see it.
- "Break it": toggles "without pid namespace", "without mnt namespace", "without memory limit". When switched off, the frame disappears, `ps` in the container terminal is recomputed (in live mode — `box` is restarted with a different spec), and an explanation appears next to it.
- Animation only through transitions: a frame grows in 200 ms, a bar grows, on OOM a process fades to an outline with the caption `oom_kill 1` from `memory.events`.

Section 8, the "Rashomon" lens, is reworked into a **sequence diagram with swimlanes** (see finding 4, explainer E-A). Six lanes: CLI, dockerd, containerd, shim, runc, kernel. Steps scroll forward and backward. The "empty lens" becomes a seventh lane, "guest kernel", behind a "VM" switch, which is empty for a container. The Sankofa lens mechanism (R5 allows it) stays as a point-of-view switch "what component X sees", without "testimony" and "witnesses". Delete the `ink.ts` rows from the section 8 table; keep `layers.ts` in screen F only as the mechanics of spreading the stack, drawn as plain layer rectangles with sizes.

### 3. BLOCKING. There is no documentation ladder (R2), and dsim actively hinders it

**Where:** the whole document; 7.3 ("Flags outside the list get an honest answer: … on real Docker it means …", "help texts … cut down to the supported flags"); 13 (exams); 15 (AI).

**What is wrong.**
- Not a single module has steps 1–5. Under R2 the experienced tier starts at step 3, and the document says nothing about this.
- At steps 2–3 the learner studies the anatomy of a page (SYNOPSIS, OPTIONS, EXAMPLES). A truncated `docker run --help` with three dozen flags instead of a hundred and fifty looks different from the one on a real machine.
- Step 4 requires tasks on flags that were not in the theory. If dsim answers an unknown flag with "on real Docker it means …", the task is solved without documentation, and nothing forces the learner to use it.

**Fix 1 (7.3, replace the first paragraph).**

> The `docker <cmd> --help` output is shown in full, as in the Engine 29.x golden recording. Flags the trainer does not execute are shown dimmed in the output, without explanations. On an unsupported flag the trainer answers: `dsim: flag --xyz is not simulated here; it works on a real Docker Engine (D11)`. It does not say what the flag does. The learner finds out the meaning of the flag from `--help` or docs.docker.com — this is intended (documentation ladder, steps 3–5). Every flag that a step 4 task or an exam relies on must be executed (list in section 7.3.1).

**Fix 2: a new section "3.4. Documentation ladder".**

| Step | Modules and tier | What it looks like in the block | Example |
|---|---|---|---|
| 1. Glimpse | D1, D4, D5 for the beginner | Under a command from the lesson, a dimmed line "this comes from here" with a link to the exact spot; opening it is optional | after `docker run -d -p 8080:80 nginx` → `docs.docker.com/reference/cli/docker/container/run/#publish` |
| 2. Hint — a fragment of the help | D6–D8 for the beginner, D4–D5 for the intermediate | Hint H2 shows not the answer but an excerpt from the real help with the line highlighted and a caption naming the page section (SYNOPSIS / OPTIONS / EXAMPLES) | d13: an excerpt from the Dockerfile reference "Shell and exec form" with "The exec form… PID 1… receive Unix signals" highlighted; d17: an excerpt from `docker network create --help` |
| 3. "Find the flag" | D9–D10 for the beginner, D6+ for the intermediate, from the first module for the experienced | Only the task and a link to the page are given; the result is checked | see the table below |
| 4. Forcing | D9–D11 for the intermediate, D5+ for the experienced, review in D11 for all | The task requires a flag or instruction that was not in the theory; no hints; the AI answers "where did you look?" and names only the source | see the table below |
| 5. Exam | E1–E4 | Only official documentation from the list is open; 1–2 tasks on things that are not in the course | see finding 13 |

Step 3 tasks (checked by state, in the 09 format):

| ID | Task | Where to look | Check |
|---|---|---|---|
| dk.f01 | Show the size of the writable layer of each container | `docker ps --help` | `docker ps` with `-s`/`--size` in the history, and the numeric answer matches `containers[name=web].sizeRw` |
| dk.f02 | Print the `api` log only for the last 5 minutes | `docker logs --help` | a call with `--since`; the output contains no lines older than the model's 5 minutes |
| dk.f03 | Make `docker stop web` wait 30 seconds instead of 10, without changing the stop command | `docker run --help` | `containers[name=web].stopTimeout=30` |
| dk.f04 | Find out how many times `worker` was restarted, with a single command | `docker inspect` + Go templates docs | answer = `restartCount`, `--format` in the history |
| dk.f05 | Run `unshare` so that `/proc` gets mounted by itself | `man unshare` (OPTIONS) | in v86 the process is in a new pid ns, `/proc` is mounted, `--mount-proc` in the history |
| dk.f06 | Show which volumes exist and how much space they take | `docker system df --help` | a call with `-v` |
| dk.f07 | Bring up a compose project and wait until all services are healthy, with a single command | `docker compose up --help` | a call with `--wait`; all services are healthy at the moment it returns |

Step 4 tasks. These need flags that are not in the theory; the AI behaves according to the rule from finding 21.

| ID | Task | Needed but not introduced | Check |
|---|---|---|---|
| dk.x30 | A Python application does not stop within 10 s, the code cannot be changed, `--init` is forbidden | `STOPSIGNAL SIGINT` in the Dockerfile | `config.StopSignal=SIGINT`; `docker stop` < 1 s of model time |
| dk.x31 | The container log has filled the disk; limit it to 3 files of 10 MB | `--log-opt max-size=10m --log-opt max-file=3` (or `logging:` in compose) | `hostConfig.logConfig.config.max-size=10m` and `max-file=3` |
| dk.x32 | `pip install` downloads the packages again on every build, although the layer is legitimately rebuilt; speed it up | `RUN --mount=type=cache,target=/root/.cache/pip` | a step with `mount cache` in `build`; the second build after changing requirements does not download packages already downloaded (model) |
| dk.x33 | nginx running as an unprivileged user must listen on port 80, without `NET_BIND_SERVICE` | `--sysctl net.ipv4.ip_unprivileged_port_start=0` | `user!=0`, `capAdd` is empty, `http :80 = 200` |
| dk.x34 | The application needs to open 65536 files | `--ulimit nofile=65536:65536` | `exec ulimit -n` = 65536 |
| dk.x35 | Get a file out of a container that has already crashed and does not start | `docker cp` from a stopped container | the file is in the project, sha matches |
| dk.x36 | Find out which container on the host hit OOM in the last hour, without going through inspect one by one | `docker events --filter event=oom --since 1h` | the name answer matches |
| dk.x37 | (v86, experienced) Enter only the network namespace of the container, staying in the host filesystem, and run the host `tcpdump` there | `nsenter -t PID --net` (without `-a`) | a tcpdump process with `ns.net` = the container's ns and `ns.mnt` = the host's |
| dk.x38 | (v86) Find out which process owns the network namespace with inode N | `lsns -t net`, `ip netns identify` | the PID answer matches |

Links for steps 1–3 are stored in the lesson YAML as `docs: [{tool: man, page: "unshare(1)", anchor: "OPTIONS", line: "--fork"}]` or `{url: "https://docs.docker.com/reference/cli/docker/container/run/", anchor: "publish"}`. The "help fragment" widget (step 2) then takes the text from a golden snapshot of the man page or help and highlights the line. This is a shared mechanism for all blocks. I will add it to 09 as `docs.snapshot`; 04 must list which pages it needs: `docker run|build|network|volume|compose --help`, Dockerfile reference, compose-spec, `unshare(1)`, `nsenter(1)`, `lsns(8)`, `capsh(1)`, `crun(1)`, `namespaces(7)`, `cgroups(7)`, OCI runtime-spec `config.md`, image-spec `manifest.md`.

### 4. BLOCKING. The process explainers (R3) are not written as R4 explainers

**Where:** 4.6, 5.3, section 8. R3 requires at least three explainers for containers: the path of `docker run` from the CLI to the process, `docker build` layer by layer with the cache, and pulling an image by its manifest. R7(c) adds a fourth (see finding 5).

**What is wrong.** "Rashomon" is described in one table row. Screens A–G of interactive 2 are a breakdown of documents, not a process with a stepper. There is no layer-by-layer build at all: screen G is only about sizes. Nowhere are there parameters, toggles, "break it", instant recomputation with an explanation and scrolling through steps, as R4 requires.

**Fix: storyboards to paste (a new section "8. Process explainers", the current 8 shifts down).** Common rules for all explainers: the `stepper` widget from 08 (3.1), the state at time t is a fold of events; steps go forward, backward and can be paused; any parameter change recomputes the scenario from step 0 and shows on the right a line "what changed and why"; labels sit on the lines; one scene — one idea; calm mode makes transitions instant.

**E-A. `docker run -d -p 8080:80 --memory 64m nginx`: from the CLI to the process.**
Lanes from left to right: `docker` CLI · `dockerd` · `containerd` · `containerd-shim-runc-v2` · `runc` · kernel. Time flows top to bottom.
1. CLI → dockerd. An arrow labeled `POST /containers/create` over `/var/run/docker.sock`; a click opens the JSON body (`Image`, `HostConfig.PortBindings`, `HostConfig.Memory`).
2. dockerd: image resolution. Toggle "image already present locally". When off, a pull branch is inserted, collapsed into one step with a link to E-C.
3. dockerd → containerd: snapshot preparation. Label `Snapshots.Prepare(key, parent=ChainID)`; under the kernel lane a line `mount -t overlay … lowerdir=…:…,upperdir=…` appears.
4. dockerd: network. A veth pair, an IP from IPAM 172.17.0.0/16 and a DNAT rule are created. The `-p` toggle turns off DNAT, and the explanation says: "The port is not published: 172.17.0.2:80 cannot be reached from outside, but it can from the host".
5. containerd → shim → `runc create`: on the kernel lane appear `clone(CLONE_NEWPID|CLONE_NEWNS|CLONE_NEWNET|CLONE_NEWUTS|CLONE_NEWIPC|CLONE_NEWCGROUP)`, the write `memory.max = 67108864` and `pivot_root`. The `--memory` slider from 16 to 512 MB changes the number in `memory.max` on the line.
6. `runc start` → `execve("/docker-entrypoint.sh")`. The `runc` lane fades out with the caption "runc exited, the process remained a child of the shim".
7. The CLI receives the ID and exits. The "time per stage" counter is taken from the golden recording.
"Break it": (a) "stop dockerd". The `live-restore` toggle decides the outcome: off — the containers stop together with the daemon, on — they keep running, held by the shim. (b) "remove the shim from the chain" — an explanation of why, without the shim, a containerd restart would kill the container and lose the exit code. (c) the "VM instead of a container" toggle adds a "guest kernel" lane with a boot, and the time counter grows by two orders of magnitude.

**E-B. `docker build`: layer by layer, with the cache.**
On the left, a 6-line Dockerfile (`FROM python:3.13-slim`, `WORKDIR /app`, `COPY requirements.txt .`, `RUN pip install -r requirements.txt`, `COPY . .`, `CMD ["python","main.py"]`). On the right, a stack of layers; each layer shows its size and its cache key in the form `sha256(parent + "RUN pip install…")`.
1–6. Each line either produces a layer (`RUN`, `COPY`) or adds a line to the config (`WORKDIR`, `CMD`). Label on the arrow: "new layer" or "metadata only".
Parameters: a "what changed" switch (`main.py` / `requirements.txt` / `README.md` in `.dockerignore` / nothing) and a draggable `COPY . .` line (it can be moved above `RUN pip`). On recomputation, layers from the cache are grey with the `CACHED` mark, rebuilt ones are marked with their time. Explanation next to it: "`main.py` changed → the checksum of the `COPY . .` context changed → this layer and all layers below it are rebuilt; `pip install` higher in the stack comes from the cache".
Counters: build time (golden recording model), context bytes sent to the builder.
"Break it": delete `.dockerignore` — the context counter jumps by 200 MB of `testdata/`, and `COPY . .` never hits the cache again, because `.git` changes. Second: `RUN rm -rf /var/lib/apt/lists/*` as a separate line — the stack size does not shrink, and it is visible that the file lies in a lower layer.

**E-C. `docker pull nginx:1.30-alpine`: by the manifest.**
Lanes: client · registry (`/v2/`) · blob storage. Steps: `GET /v2/` → 401 with `WWW-Authenticate` → `GET /token?scope=repository:library/nginx:pull` → `HEAD /v2/library/nginx/manifests/1.30-alpine` (the `Docker-Content-Digest` header is labeled on the line) → `GET` index → platform selection → `GET` manifest by digest → `GET` config → parallel `GET blobs/<digest>` with download bars.
Parameters: platform (`linux/amd64`, `linux/arm64`, `linux/386`); toggle "alpine:3.x already downloaded" (shared layers are marked `Already exists` and are not downloaded); toggle "pull by digest" (the tag HEAD step disappears).
"Break it": "move the tag to a new build" — with a pull by tag the digest changes, with a pull by digest it does not; "tamper with a byte in a blob" — the sha256 check fails, and the real error line from the golden recording appears on the line; "anonymous request limit" — 429 `toomanyrequests` and an explanation of where this comes from at Docker Hub.

Explainers E-D ("hardware → VM → containers → nesting doll") and E-E ("six boundaries") are in finding 5. Additional ones: E-F "`docker stop` and signals" and E-G "`-p` as DNAT" are in finding 6.

### 5. BLOCKING. R7(b) "six boundaries" and R7(c) "hardware → VM → containers → the modern nesting doll" are missing

**Where:** D1, 4.6, D7, D9; section 10 (exercises).

**What is wrong.** The interaction of the container with its environment is scattered across D6, D7 and D9 without a common frame. Some of the boundaries are missing entirely: user namespace and bind mount permissions, log driver, zombies. "The container does not work, the cause is on one boundary" drills do not exist as a class. The VM-versus-container scene in 4.6 is a building-block constructor: it has no nesting (containers in cloud VMs, k8s on bare metal, VMs inside k8s via KubeVirt/Cozystack), no "how many applications" slider, no "kernel vulnerability" toggle and no counters. There is also no "the browser Linux is itself a VM" practice.

**Fix A: a new module "D7. The six boundaries of a container" (the former D7 "Data and network" and part of D9 merge into it).**

Theory (a textbook chapter, about 1500 words). A container is a process that has six boundaries with its environment. Almost any breakage sits on exactly one of them, so the first diagnostic question is "on which boundary?". For the network it turns into "on which layer?" per R8.

| Boundary | What passes through it | What is introduced/reviewed | Typical breakage |
|---|---|---|---|
| 1. Host kernel | system calls, CPU architecture, kernel parameters | one kernel, `uname -r`, image platform, `--sysctl`, seccomp and capabilities as a filter on this boundary | `exec format error` (an arm64 image on amd64); the application needs a kernel module |
| 2. Network | packets | veth, `docker0`, NAT to the outside, `-p` as DNAT, built-in DNS 127.0.0.11, `host`, `none` | listens on 127.0.0.1; the default network has no DNS; port is taken |
| 3. Storage | files | the overlay upper layer lives as long as the container; volume; bind; tmpfs | data lost after `rm`; a bind mount hid the image files |
| 4. Process and signals | signals, exit codes, children | PID 1, SIGTERM → (timeout) → SIGKILL, zombies, `tini`/`--init` | `stop` takes 10 s; zombies pile up; the daemon went to the background and the container exited |
| 5. I/O and logs | stdout/stderr | the shim holds stdio → log driver (`json-file` by default; `local`) → file | `docker logs` is empty (writes to a file); a log without rotation ate the disk; stdout buffering |
| 6. Configuration and identity | env, secrets, UID | env, `.env`, secrets, UID inside and outside, user namespace (userns-remap / rootless), bind mount permissions | `Permission denied` in a bind mount; a secret in a layer; a typo in a variable name |

Explainer **E-E "Six boundaries"**. One process in the center, six sides around it, each with its own color and label. A click on a side expands the flow that passes through it: a packet, a file, a signal, a log line, a variable. The "break it" toggle on each side turns on the typical breakage from the table. The terminal next to it shows the real symptom from the golden recording, and the side is highlighted. The learner first picks a side ("where did it break?"), and only then sees the explanation.

"The container does not work" drills. The first step of each is to pick the boundary: this is a separate goal, and the answer is checked. Checks are in the 09 format (`when` over facts):

| ID | Tier | Boundary | Symptom (initial state) | Check |
|---|---|---|---|---|
| dk.b01 | B | 1 kernel | `exec format error`: the image is built for `linux/arm64` | `images[ref=app:1.0].platform=linux/amd64 && containers[name=app][state=running]` |
| dk.b02 | I | 1 kernel | `worker` `OOMKilled`, limit 64 MB, the README requires 128 | `containers[name=worker].hostConfig.memory>=128M && containers[name=worker].oomKilled=false` (`memory=0` in `forbid`) |
| dk.b03 | B | 2 network | listens on 127.0.0.1 (currently d18) | `http.web.status=200`; a separate goal "boundary = network, layer = L4/socket" |
| dk.b04 | B | 2 network | `ping db` → `bad address` in the default network (currently d17) | `containers[name=api].networks~appnet && containers[name=db].networks~appnet` |
| dk.b05 | I | 2 network | `Bind for 0.0.0.0:8080 failed: port is already allocated` | the new container is running; `ports` without conflict; the old one is not removed (`forbid`) |
| dk.b06 | I | 2 network | `--network none`, the application does not see the DB | `containers[name=api].networks!~none && http.api_db.status=200` |
| dk.b07 | B | 3 storage | the DB data is lost (currently d15) | as d15 |
| dk.b08 | I | 3 storage | the bind mount `./src:/app` hid `/app/node_modules` from the image → `Cannot find module` | `containers[name=web].mounts[target=/app/node_modules][type=volume]` and `http=200` |
| dk.b09 | I | 4 process | `stop` takes 10 s (currently d13, fixed, see finding 10) | as in finding 10 |
| dk.b10 | I | 4 process | (v86) a PID 1 script spawns children and does not reap them: zombies pile up | `procs[cgroup=/box-app][state=Z]#=0` 30 s after start; `procs[cgroup=/box-app][nspid~1].cmd~tini` or equivalent |
| dk.b11 | B | 4 process | `CMD service nginx start` — the container immediately goes `Exited (0)` | the container is running; `config.Cmd` contains `daemon off;` or nginx runs in the foreground |
| dk.b12 | B | 5 logs | `docker logs app` is empty, the application writes to `/var/log/app.log` | `logs[name=app].text~'started'` (a symlink to `/dev/stdout` or config) |
| dk.b13 | I | 5 logs | the Python log appears with a delay of minutes | `config.Env~PYTHONUNBUFFERED=1` or `Cmd~'-u'`; lines appear in the log 1 s after the event (model) |
| dk.b14 | I | 6 identity | an application running as UID 1000 writes to a bind mount of a root:root 755 directory → `Permission denied` | `exec(touch /data/x).exit=0 && containers[name=app].user!=0` (`--user 0` and `chmod 777` in `forbid`, with an explanation) |
| dk.b15 | I | 6 identity | files created by the container in a bind mount are owned by root on the host, and the developer cannot delete them | a new run with the developer's `--user <uid>:<gid>`; `files[./out/report.txt].owner=dev` |
| dk.b16 | I | 6 identity | `POSTGRES_PASWORD` (typo) | `containers[name=db][state=running]`, env contains `POSTGRES_PASSWORD` |

**Fix B: explainer E-D "Hardware → VM → containers → nesting doll" (replaces 4.6).** One idea per screen, simple animation only.

1. **Two towers side by side.** Left: hardware → hypervisor → [guest kernel → libraries → application] × N. Right: hardware → host kernel → container runtime → [libraries → application] × N. Layers are plain rectangles with labels; the kernel color is `--c-kernel` everywhere.
2. **"How many applications" slider** (1–50). The towers grow. On the right are three counters that are recomputed instantly: "memory", "start time of the N-th instance", "CPU spent on overhead". The model is simple and is shown openly on click: VM = 512 MB base + application, boot 20–40 s; container = application + ~1 MB, start 0.1–0.5 s. The numbers come from the lesson measurements (step 5), not out of thin air. Explanation next to it: "With 30 applications, the VMs spend 15 GB on 30 copies of the kernel and the OS".
3. **"Kernel vulnerability" toggle.** On the left, one guest kernel is highlighted in red, the other VMs are intact. On the right, the shared kernel under all containers is highlighted. Explanation: "Container isolation is a boundary inside one kernel; for a VM the boundary is the hypervisor". A card on seccomp and user namespace as ways to narrow the attack surface.
4. **"Different kernel/OS" toggle** (an application for Windows or an old kernel): impossible on the right, possible on the left.
5. **Today's nesting doll.** A three-position switch: (a) cloud — the provider's hypervisor → your VM → the VM kernel → containers (this is how almost all "containers in the cloud" work); (b) Kubernetes on bare metal — hardware → kernel → kubelet → containers (pods); (c) VM inside Kubernetes — hardware → kernel → kubelet → a pod with `virt-launcher` → QEMU/KVM → guest kernel → application (KubeVirt; this is how Cozystack gives VMs to tenants). Each layer is clickable; the overall conclusion: "containers and VMs are not rivals but layers that are nested into each other according to the isolation needed".
6. **Practice in v86** (a new D1 step, for all tiers):
   - "This Linux is itself a VM": `cat /sys/class/dmi/id/bios_vendor` (SeaBIOS), `dmesg | head -20` (emulated hardware), `lspci` (virtio and emulated devices), `cat /proc/cpuinfo | grep 'model name'`. Check: the learner picks on the tower where they are now — "a guest kernel inside a VM in the browser".
   - `uname -r`, `ps -e | wc -l`, `hostname` on the v86 host and inside `box run` — the kernel is the same, everything else differs. Check: the facts of the two `uname -r` match, plus the answer to the question.
   - Measurement: `time box run --rm hello true` versus booting a **second** v86 machine **from a cold start** (not from a snapshot, otherwise the comparison lies). The "boot a second VM" button starts a second v86 instance with `lab-node` without `initial_state`; the timer runs until `TRAINER_READY`. One more counter is the tab memory before and after (`performance.measureUserAgentSpecificMemory` where available, otherwise the guest memory size). The resulting numbers become the parameters of the screen 2 model. On a phone this step shows numbers recorded on the test bench.

### 6. BLOCKING. The check format and the in-guest agent are incompatible with the platform (09)

**Where:** 4.5 (`nsview` on `ttyS1`), 6.5 (`/opt/checks/<id>.sh` on the same `ttyS1`, its own JSON `{"check","ok","facts","failed"}`), 11.2 (`check: all/any/forbid` with predicates `container`, `compose_service`…), 11.3.

**What is wrong.** 09 (sections 1.4 and 2) fixed a single contract: the environment emits `dt.facts/v1` facts, a check is a `when` selector over them, the guest has one `trainer-agent` multiplexed by `id`, and `nsview` is its `watch` mode. In 04 the `ttyS1` channel is at the same time an `nsview` snapshot stream every 500 ms and the check command channel. Without multiplexing they will get mixed up. The 11.2 predicates and the 6.5 scripts would have to be implemented by a second evaluator, and in Go as well for signed exams. If content authors start writing hundreds of exercises in the 11.2 format, redoing this later will be expensive.

**Fix.** Rewrite 4.5, 6.5, 11.2 and 11.3 for 09. Ready examples:

```yaml
# 11.3, lab step (replaces check/expect/explain)
id: dk.l3-s4
goals:
  - id: g-limits
    say: { ru: "Задайте группе box лимиты: 32 МБ памяти, 20 процессов, 20% CPU", en: "..." }
    needs: [cgroups]
    when: "cgroups[path=/box].memory.max=33554432 && cgroups[path=/box].pids.max=20 && cgroups[path=/box].cpu.max='20000 100000'"
    envs: [v86]
    fail:
      - if: "cgroups[path=/box].pids.max=max"
        say: { ru: "Лимит процессов не задан: запишите 20 в pids.max группы box." }
        term: cgroup
  - id: g-moved
    needs: [cgroups, procs]
    when: "cgroups[path=/box].procs~@pid(sh@ns)"      # @pid(sh@ns): the sh whose nspid ends with 1
    fail:
      - if: "!cgroups[path=/box].procs~@pid(sh@ns)"
        say: { ru: "Группа есть, но процесс контейнера в неё не перенесён: запишите его PID с хоста в cgroup.procs." }
  - id: g-oom
    needs: [cgroups]
    when: "cgroups[path=/box].memory.events.oom_kill>=1"
  - id: g-pids-hit
    needs: [cgroups]
    when: "cgroups[path=/box].pids.events.max>=1"
```

```yaml
# 11.2, exercise d21 (replaces check/forbid)
id: dk.x21
setup: { env: sim, project: fixtures/compose-race/, run: ["docker compose up -d"] }
goals:
  - id: g-health
    needs: [compose]
    when: "compose.services[name=db].healthcheck"
  - id: g-wait
    needs: [compose]
    when: "compose.services[name=api].depends_on[name=db].condition=service_healthy"
  - id: g-stable
    do: ["docker compose down", "docker compose up -d"]   # action before evaluation
    needs: [containers, logs]
    when: "containers[service=api][state=running].restartCount=0 && !logs[service=api].text~'could not connect'"
forbid:
  - when: "compose.services[name=api].restart=always"
    say: { ru: "restart: always скрывает гонку, а не устраняет её." }
```

What I add to 09 on my side (these are gaps in 09 that 04 has revealed): fact scopes `compose` (normalized output of `docker compose config`), `builds` (recent builds: steps, `cached`, size, `history`), `registry` (repositories, tags, digest, request log), `logs` (per container, tail of N lines), `cgroups[].pids.events` and `cgroups[].cpu.stat`. Also the `do:` step of a goal and the `@pid(cmd@ns)` macro. `/opt/checks/*.sh` turn into `facts.sh` with scopes plus `probe` only where an action is needed (09, 2.4). 04 has one task — to list which fact fields it needs (a table in the appendix to 04).

---

## Major

### 7. MAJOR. Container anatomy (R7a) is introduced last and not according to the graph

**Where:** section 2 (entities 9 and 28), D4, D10, 6.4 step 8.

**What is wrong.** In 01, D10 "architecture CLI → dockerd → containerd → runc" comes before D11 "lifecycle". In 04 the chain appears only in the last content module, and D4 only says "client and daemon". The words "OCI bundle (rootfs + `config.json`)" appear for the first time in step 8 of D3, and without an introduction. The lifecycle states are given incorrectly (see finding 23), and the OCI runtime states (`creating`, `created`, `running`, `stopped`) are not mentioned.

**Fix.** A new module "D4. Container anatomy" before "First steps" (numbering shifts). Textbook chapter:
1. "A container on disk": OCI bundle = a `rootfs/` directory + `config.json`. The learner opens the `config.json` generated by `crun spec` and finds in it what they know from Linux: `linux.namespaces`, `linux.resources`, `process.args`, `process.capabilities`, `mounts`, `root.path`.
2. "Who starts it": the chain `docker` → `dockerd` → `containerd` → `containerd-shim-runc-v2` → `runc` (or `crun`) → process, at the level of "who calls whom and who stays alive". In detail — explainer E-A, and D11 "Under the hood" goes deeper (snapshots, CRI, the Engine 29 image store).
3. "States": OCI runtime — `creating → created → running → stopped` (`crun state`); Docker — `created`, `running`, `paused`, `restarting`, `exited`, `dead`, `removing`. The diagram shows the transitions as commands: `create`, `start`, `pause`/`unpause`, `stop`/`kill`/process exit, policy `restart`, `rm`. In v86 the learner runs `crun create x` → `crun state x` (`created`, the process already exists and is waiting) → `crun start x` → `running`, and after the process exits — `stopped`.

### 8. MAJOR. The kernel fragment will not give a working `iptables` in Alpine 3.22 and will silently lose some options

**Where:** 1 (table, row 2), 6.2.

**What was checked.** `main/iptables/APKBUILD` in the 3.22-stable branch makes `/usr/sbin/iptables` a link to `xtables-nft-multi`, and legacy is split out into the `iptables-legacy` subpackage. In the 3.22 `virt.x86.config`, `NF_TABLES`, `NFT_COMPAT`, `NF_CONNTRACK`, `BRIDGE_NETFILTER`, `VETH`, `BRIDGE`, `OVERLAY_FS`, 9p are built as modules (`=m`). The 6.2 fragment enables only `IP_NF_*` (legacy) and does not enable `NF_TABLES`. Step 5 of D3 and d19 will fail with `iptables: Failed to initialize nft: Protocol not supported`. In addition, with `NF_CONNTRACK=m` and `NF_NAT=m`, kconfig will downgrade `CONFIG_IP_NF_NAT=y` to `m` (a tristate cannot be `y` if its dependency is `m`), and `olddefconfig` will do this without an error. Separately: the claim "the cpu controller is present via `SCHED_AUTOGROUP`" is correct (`SCHED_AUTOGROUP` selects `CGROUP_SCHED` and `FAIR_GROUP_SCHED`), and `CFS_BANDWIDTH` is indeed off. This part of the document is correct.

**Fix.** Do not duplicate the fragment in 04: the owner is `dt-kernel` from 09 (1.4). In 04, keep a link and the list of requirements. The merged fragment that I am adding to 09:

```
CONFIG_CFS_BANDWIDTH=y
CONFIG_OVERLAY_FS=y
CONFIG_VETH=y
CONFIG_BRIDGE=y
CONFIG_BRIDGE_NETFILTER=y
CONFIG_NETFILTER_XTABLES=y
CONFIG_NF_CONNTRACK=y
CONFIG_NF_NAT=y
CONFIG_NF_TABLES=y
CONFIG_NF_TABLES_INET=y
CONFIG_NFT_CT=y
CONFIG_NFT_NAT=y
CONFIG_NFT_MASQ=y
CONFIG_NFT_COMPAT=y
CONFIG_NETFILTER_XT_NAT=y
CONFIG_NETFILTER_XT_MATCH_CONNTRACK=y
CONFIG_NETFILTER_XT_MATCH_ADDRTYPE=y
CONFIG_NETFILTER_XT_TARGET_MASQUERADE=y
CONFIG_IP_NF_IPTABLES=y
CONFIG_IP_NF_FILTER=y
CONFIG_IP_NF_NAT=y
CONFIG_VXLAN=y            # R9/R11: overlay between nodes
CONFIG_WIREGUARD=y        # R11: WireGuard between nodes
CONFIG_DUMMY=y
CONFIG_NET_9P=y
CONFIG_NET_9P_VIRTIO=y
CONFIG_9P_FS=y
CONFIG_SECCOMP_FILTER=y
CONFIG_IKCONFIG=y
CONFIG_IKCONFIG_PROC=y
```

In CI, after `merge_config.sh` + `olddefconfig`, a check runs: every line of the fragment must have the same value in the resulting `.config`, otherwise the build fails. This catches silent downgrades. In the lessons `iptables` is the nft backend, as on modern Debian and Ubuntu. Show experienced learners both `iptables -t nat -S` and `nft list ruleset`, so that it is visible that the rules actually live in nftables. Mention the nftables mode of Docker Engine 29 itself (the `firewall-backend` option) only after checking against the release notes and with a golden recording.

### 9. MAJOR. Errors in the D3 lab commands that the learner will get stuck on

**Where:** 6.4, steps 3, 5, 6, 7.

1. **Steps 3 and 5: `pgrep -n -f 'chroot /c/rootfs'` finds the `unshare` process, not the container's `sh`.** After `chroot`, an exec into `/bin/sh` happens, and the command line of the container process becomes `/bin/sh`. The string `chroot /c/rootfs` remains only on the parent `unshare`. And `unshare --pid --fork` itself stays in the host pid namespace; only its children enter the new one. So `readlink /proc/$P/ns/pid` will show **the same** inode as the host, and the lesson will "prove" the opposite of what was intended. `lsns -p` will also show the host pid ns. Fix:
   ```sh
   U=$(pgrep -n -f '^unshare .*chroot /c/rootfs')   # the parent in the host pid ns
   P=$(pgrep -P "$U")                               # the container's sh is its child
   grep NSpid /proc/$P/status                       # NSpid: 412 1
   readlink /proc/$P/ns/pid /proc/self/ns/pid
   ```
   It would be good to turn this into a separate teaching moment: "why `unshare` and `sh` have different pid namespaces — look at `/proc/$U/ns/pid_for_children`".
2. **Step 5: there is no `httpd` in Alpine minirootfs.** In the 3.22 `main/busybox/busyboxconfig`, `# CONFIG_HTTPD is not set`; `httpd` is built in `busybox-extras`. The same applies to interactive 1 (`box start web` with `busybox httpd`) and E3. Fix: put `trainer-rootfs-3.22-x86.tar.gz` = minirootfs + `busybox-extras` into `/opt/images/` and use it everywhere instead of the bare minirootfs. Separately: `wget …/hostname` with `-h /etc` serves the `/etc/hostname` file from the rootfs, not the UTS name. For the UTS lesson, a CGI script `cgi-bin/hostname` that calls `hostname` is better.
3. **Step 6: a whiteout cannot be converted while the overlay is mounted**, and the `.wh.` file itself must be deleted. Changing a lower layer under a mounted overlay leads to undefined behavior (kernel overlayfs documentation, "Changes to underlying filesystems"). Fix:
   ```sh
   umount /c/merged
   find /c/l2 -name '.wh.*' ! -name '.wh..wh..opq' | while read -r wh; do
     d=$(dirname "$wh"); n=$(basename "$wh"); n=${n#.wh.}
     rm "$wh" && mknod "$d/$n" c 0 0
   done
   find /c/l2 -name '.wh..wh..opq' | while read -r o; do
     d=$(dirname "$o"); rm "$o" && setfattr -n trusted.overlay.opaque -v y "$d"
   done
   mount -t overlay overlay -o lowerdir=/c/l2:/c/l1,upperdir=/c/upper,workdir=/c/work /c/merged
   ```
   Add `attr` (`setfattr`/`getfattr`) to the package list in 6.1; tmpfs supports `trusted.*`.
4. **Step 7: `capsh` and `unshare --user` do not work in their current form.** (a) `capsh … -- -c` runs `/bin/bash`, and the image has no bash. `capsh --shell=/bin/sh …` is needed; libcap 2.7x from Alpine 3.22 supports this. (b) Dropping a capability from the bounding set (`--drop`) is possible only with `CAP_SETPCAP`. Under `trainee` this will fail with `Operation not permitted`, that is, with the same error that is expected, but for a different reason. The learner will draw the wrong conclusion. (c) The lines after `unshare … sh -c '…'` already run outside the user namespace. The fixed step:
   ```sh
   # as trainee: root only inside your own user namespace
   unshare --user --map-root-user sh -c 'id; cat /proc/self/uid_map; grep CapEff /proc/self/status'
   unshare --user --map-root-user --mount sh -c 'mount -t tmpfs t /mnt && echo "mount inside your own userns+mntns is allowed"'
   unshare --user --map-root-user sh -c 'hostname evil'   # Operation not permitted: uts belongs to the initial userns
   # as root: the capability is removed from the bounding set and is gone after exec
   capsh --shell=/bin/sh --drop=cap_sys_admin -- -c 'mount -t tmpfs t /mnt'   # Operation not permitted
   capsh --print
   ```

### 10. MAJOR. d13 and the D6 theory on PID 1 are substantively wrong

**Where:** 3.3 D6, exercise d13, D6 quiz (3).

**What is wrong.** It is claimed that the exec form `CMD ["python","app.py"]` fixes a slow `docker stop`. But Python does not install a SIGTERM handler (it installs only SIGINT → `KeyboardInterrupt`). For PID 1 in a pid namespace, the kernel does not deliver signals with a default action if the process has no handler (`pid_namespaces(7)`). So Python, having become PID 1 through the exec form, still ignores SIGTERM, and `stop` still waits 10 s and then sends SIGKILL (code 137). The exec form is needed for the signal to reach the application. But that is not enough: the application also has to handle it. The golden recording will catch this, but the exercise and the theory are written with the wrong model.

**Fix.** Text for D6:
> The signal from `docker stop` is received by the container's PID 1. In shell form, PID 1 is `/bin/sh` (unless the shell replaced itself with the application via exec), and the signal does not reach the application. But even when the application itself has become PID 1, the kernel has a special rule for PID 1: signals for which the process has no handler are ignored. Python, Node.js and many home-grown programs do not handle SIGTERM by default. There are three ways out: handle SIGTERM in the code; add a small init (`docker run --init` or `tini` in the image), which is PID 1 itself, forwards the signal and reaps zombies; change the stop signal to one the application handles (`STOPSIGNAL`).

The d13 check in the 09 format: `containers[name=app].stopDurationMs<1000` (a fact from the `docker stop` model) and one of the conditions: `hostConfig.init=true`, `config.Entrypoint~tini`, `config.StopSignal=SIGINT` or "process model: SIGTERM handler" (if the learner fixed the code from the model catalog). Move the `STOPSIGNAL` variant into a step 4 task (dk.x30). Rephrase D6 quiz (3): "Why is the exec form a necessary but not sufficient condition for a correct stop?"

### 11. MAJOR. d26 describes seccomp incorrectly; the right answer is simpler

**Where:** exercise d26, 3.3 D9.

**What is wrong.** Docker's default seccomp profile depends on capabilities: with `--cap-add SYS_ADMIN` it allows `mount` and the related calls by itself. A custom profile "allowing mount" is not needed, yet the check requires one. On hosts with AppArmor (Ubuntu — exactly the VM from D11) the `docker-default` profile forbids `mount` regardless of capabilities, and `--security-opt apparmor=unconfined` will be needed there. Most importantly: the task "mount a tmpfs inside" is solved without any privileges via `--tmpfs /mnt` or `--mount type=tmpfs`. That is exactly the answer expected at an interview.

**Fix.** Check: `!containers[name=job].privileged && (containers[name=job].mounts[type=tmpfs][target=/mnt] || (capAdd~SYS_ADMIN && exec(mount -t tmpfs t /mnt).exit=0))`. Question rubric: the best answer is `--tmpfs` without new privileges; `SYS_ADMIN` is almost root ("the new `CAP_SYS_ADMIN`": `capabilities(7)` calls it exactly that); on a host with AppArmor there is also the profile. Add a sentence to D9: "Docker's default seccomp profile is aligned with capabilities: an added capability also opens the related system calls".

### 12. MAJOR. dsim duplicates the netlab and Stand engines

**Where:** 7.1 (`engine/net.ts`, `shell/`), 7.3 (shell commands inside the container), 19.

**What is wrong.** 03 (decision 2) and 09 (1.3) fixed: one network model for the whole course (netlab). A dsim container is a Stand process in its own netlab network model; everything runs in a single `sim.worker.ts`. In 04, dsim has its own `net.ts` with IPAM, DNS and ports, and its own `shell/`. The result would be two implementations of veth, bridge, DNAT and DNS, and a learner who looked at `iptables-save` in netlab in the networks block will not see the same rules in dsim. Ping in 7.3 is modeled "from the network graph and the presence of CAP_NET_RAW", but that is separate logic that bypasses netlab.

**Fix.** In 7.1, replace `engine/net.ts` with `engine/net-adapter.ts`: "the bridge/host/none drivers are netlab node configuration: `docker0` is a netlab bridge, a container is a netlab network namespace with a veth, `-p` is a DNAT rule in the `DOCKER` chain of the netlab nat table, the built-in DNS is a netlab service on 127.0.0.11 in the container namespace". Then `iptables -t nat -S DOCKER`, `tcpdump -i docker0` and `ip netns` from the host will work in dsim without code of its own. `shell/` is the Stand from 02 with the container filesystem mounted from `engine/fs.ts`. In section 19, rewrite the first two items as "we use" rather than "needed from others".

### 13. MAJOR. The exams do not match step 5 of the documentation ladder and diverge from 10

**Where:** section 13.

**What is wrong.** R2 (step 5): only official documentation is open, as on the CKA, and some tasks are built on things that are not in the course. 04 only says "without hints and without AI". In 10 the Docker exam is described differently (`content/bank/docker/exam/exam-docker.yaml`, `sandbox: { image: docker-lab }`, `probe: recreate-db`), and E1–E4 from 04 are not connected to it.

**Fix.** Add to 13:
> **Documentation mode during the exam.** The "Documentation" tab opens only: docs.docker.com (reference and manuals), compose-spec, man7.org (sections 1, 2, 7, 8), docs.kernel.org (cgroup-v2, overlayfs), github.com/opencontainers (image-spec, runtime-spec), plus `--help` and `man` in the terminal. The trainer does not open any other addresses. The AI is turned off.
> **Tasks beyond the course** (one in each exam, from a pool):
> - E1: "the image must also build for `linux/arm64`" (`docker buildx build --platform`, a model in dsim); "reduce the rebuild time of dependencies" (`--mount=type=cache`).
> - E2: "logs must not take more than 30 MB per service" (`logging.options` in compose); "api must start only after a one-off migration has completed" (`depends_on: condition: service_completed_successfully`).
> - E3: "forbid the container from creating new processes beyond 15 and from gaining new privileges via setuid" (`process.noNewPrivileges` in `config.json`; the course only covered `--security-opt`).
> - E4: "find the container that writes the most to disk" (`docker ps -s` / `docker system df -v`).

Bring the exam fields in line with the 10 schema (`id: exam-docker-e1`, `sandbox`, `goals`, `probe`). The owner of the exam schema (10) should confirm that `docs_allowlist` becomes an exam field.

A separate unresolved point in E3: "a process run by an unprivileged user via a user namespace" plus "a 24 MB memory limit" means a rootless container with limits. This requires a delegated cgroup subtree (`chown trainee` on `cgroup.procs`, `cgroup.subtree_control` and the limit files, mounting `cgroup2` with `nsdelegate`). Without it the limit cannot be set. There are two options: prepare a delegated group in the exam's starting snapshot, or explicitly allow configuring the cgroup as root and then moving into the user namespace. The task must state this.

### 14. MAJOR. The registry in the Service Worker is unreachable from a real VM, and from v86 only through address rewriting

**Where:** 7.6, exercise d09 (marked "VM"), 11.

**What is wrong.**
- d09 "VM": on a real VM (D11), `docker push registry.trainer.local/...` will not reach the Service Worker in the learner's browser. No such registry exists on the network.
- From v86 the guest uses HTTP. The `fetch` adapter calls `fetch("http://registry.trainer.local/…")`, and from a page opened over HTTPS this is mixed content, which the browser blocks before it ever reaches the Service Worker. Besides, a request to a foreign non-existent domain from the v86 worker is intercepted by the Service Worker only if that worker is a controlled client. Per the specification, a dedicated worker inherits the document's controller, but in our spike this needs to be checked in Safari.
- A real `docker push` sends `POST` → `PATCH` (stream) → `PUT`, while the registry in 7.6 only supports a monolithic `PUT`.

**Fix.** (a) The registry lives at **its own path on the same origin**: `https://<course>/registry/v2/…`. `registry.trainer.local` is only a name inside dsim and the guest. The v86 `fetch` adapter rewrites `http://registry.trainer.local/` to this path (the same way 09 rewrites `apt.lab`). (b) In D11 and for exercises marked "VM", the registry is either `registry:2` brought up by the learner on the VM itself (`docker run -d -p 5000:5000 registry:2`; a good exercise in itself), or the registry of the learner's cloud provider (Yandex Container Registry, Amazon ECR) or a free public one (GitHub Container Registry, Docker Hub). Rewrite d09 for the first option. (c) In 7.6, add `PATCH /v2/<name>/blobs/uploads/<uuid>` and `Range`/`Location` per the Distribution Spec, so that an experienced learner can walk through the protocol with `curl` the same way the client does.

### 15. MAJOR. The block's contribution to hybrid Kubernetes and the multi-node network (R11) is missing

**Where:** 6.1 (256 MB, one machine), 19 (about Kubernetes — only "the visual language of rooms is shared").

**What is wrong.** Under R11, 3–4 v86 machines of 64–128 MB each run in the browser, connected by our JS switch. Each node runs a small real "kubelet" agent that starts pods via crun. The runtime on the node, unpacking an image from the course registry into a bundle, and the pod network are exactly what the containers block builds in D3. If 04 does not fix this as a contract, the Kubernetes block will write a second `box`.

**Fix: a new section "6.6. `box` — the node runtime, shared with hybrid Kubernetes".**

> `box` is a POSIX script (about 300 lines) on top of `crun`, `curl`, `jq`, `tar`, which the learner recognizes at the end of D3 as "their own `mybox.sh`, turned into a tool". The same `box` starts pods in hybrid Kubernetes (document 05), and the teaching phrase "the kubelet asks the runtime to do the same thing you did by hand" becomes literal.
>
> Interface:
> - `box pull REF`: token → index → manifest for `linux/386` → blobs from the course registry; unpacking layers into `/var/lib/box/layers/<diff_id>` with whiteout conversion (D3, step 6). This is the same protocol as `curl` by hand in 7.6.
> - `box sandbox create POD`: `ip netns add`, a veth to the `cni0` bridge, an address from the node subnet (`10.244.N.0/24`), a default route. This is the analog of the pause container: the pod network namespace, shared by its containers.
> - `box create|start|kill|rm CTR --pod POD --image REF [--memory] [--cpus] [--env]`: overlay mount, generation of `config.json` (`linux.namespaces` with a `path` to the pod netns), cgroup `/sys/fs/cgroup/kubepods/<pod>/<ctr>`, `crun run --detach`.
> - `box ps --json`, `box logs CTR` (stdout to `/var/log/box/<ctr>.log`), `box exec CTR CMD` (`crun exec`).
>
> The `lab-node` image: Alpine 3.22 x86, `crun`, `busybox-extras`, `iproute2`, `iptables`, `wireguard-tools`, `tcpdump`, `jq`, `curl`, `box`, `trainer-agent` and the kubelet agent from 05. Budget: 96 MB of guest memory and a snapshot of no more than 20 MB. On a laptop, three nodes of 96 MB each plus 256 MB of `lab-alpine` must not exceed the tab budget from 09.
>
> An exercise for experienced learners, D7+ (a bridge to R9): two `lab-node` nodes on a shared switch, each with its own `cni0` (`10.244.1.0/24` and `10.244.2.0/24`). A container on node 1 cannot ping a container on node 2. The learner adds `ip route add 10.244.2.0/24 via <node2>` on node 1 and the reverse route on node 2, and sees in the switch visualization how the packet travels without NAT. Conclusion: "This is the Kubernetes network model: each pod has its own IP, with no NAT between nodes; CNI does for you what you have just done with routes". The continuation — the same path through VXLAN (`ip link add vx0 type vxlan id 42 dstport 4789 …`) — belongs to the Kubernetes block.

### 16. MAJOR. The textbook (R1) is written as a list of topics, not as coherent theory

**Where:** 3.3. Each module is described by a single list-paragraph ("Instructions one by one: FROM, RUN, COPY, ADD …"). Under R1 the textbook is the main thing, and practice relies on it. Document 04 describes the interactives over ten pages and the theory in one.

**Fix.** For each module, add a "chapter plan": 5–8 sections with one idea each, a guiding question, the place of the explainer and the place of practice. A sample for D6:

> **Chapter "Dockerfile and the build".** 1. Why record the build in a file: reproducibility, review, cache. 2. An instruction = a step that has a result: a layer or a config line (explainer E-B, steps 1–6). 3. The build context — what goes to the builder and why `.dockerignore` is a matter of both speed and security. 4. Cache: the step key and the rule "from the first changed instruction and below" (E-B, parameters). 5. What will run: ENTRYPOINT and CMD, exec and shell forms, PID 1 and signals (E-F). 6. Two stages: build in one image, ship in another. 7. Secrets do not belong in layers. Practice after 2, 4, 5, 6; the chapter wrap-up is d10–d14.

The texts are written by the content role, but the order of sections is 04's decision on the order of introduction, and it must be fixed here.

### 17. MAJOR. Two versions of the same interactives: 04 and 08 (6.1, 6.2)

**Where:** 04 sections 4–6 and 08 section 6.1–6.2.

**What is wrong.** 08 laid out "What happens inside a container" (10 scenes) and "How an image is packaged" (9 scenes) in its own way. There `unshare`, `pivot_root`, `stress --vm-bytes` run in the Stand simulator, and v86 is "for those who want it". The image is `alpine:3.20`, "Break it" and the checks are its own, and term introductions do not match 04 (08 introduces "tar" and "hash" in Docker, while in 01 these are L29 and L30). In 04 the same labs run on v86 by default. A developer will not understand what to build.

**Fix.** One decision for both documents: the 08 storyboards are the skeleton of scenes and widgets, 04 is their content and environment. Specifically: the D3 lab runs on v86 by default, and the Stand is the fallback for phones and weak machines in "recorded mode" (4.4). This matches the 09 decision: lessons about namespaces and cgroups need a real kernel. In 04, add a mapping table "08 scene → 04 screen/step" and remove the discrepancies in versions and commands from 08. Remove the 08 scenes "0. The room" and "0. A stack of tracing paper" (ink, a person in a room) from both documents per R4/R5.

### 18. MAJOR. Identifiers conflict between documents

**Where:** modules D1–D12 (04), concepts D01–D23 (01), exercises d01–d28 (04), exercises D04 in 05 (`| D04 | Н | Обновите web …`), tasks `docker.d08.q04` (10), lessons L1–L16 in 02 alongside concepts L01–L32 in 01.

**What is wrong.** "D3" in 04 is the "container by hand" module, "D03" in 01 is the concept "namespaces", "D04" in 05 is a Kubernetes exercise. The build, the AI context (09, 4.5) and the event log (01, section 2) refer to these ids, so the collisions are real data errors.

**Fix (I propose it as a general rule and will add it to 09, 6.2):** concepts — `D01…` (as in 01); modules — `docker.m01…`; lessons — `docker.m03.l2`; exercises — `docker.x01…`; boundary drills — `docker.b01…`; ladder tasks — `docker.f01…`; exams — `docker.e1…`; quizzes — `docker.m07.q03`. Rename in 04, and in the section 2 table indicate the mapping of rows to 01 concepts (D06, D08 …).

### 19. MAJOR. D11 "Real Docker on a VM": no cost and no mandatory cleanup

**Where:** 3.3 D11.

**What is wrong.** For real VMs, R12 requires showing the cost and including a mandatory cleanup step. 09 (section 5) already describes provisioning machines and `trainer-check`. 04 has no price, no cleanup, and nothing about what `trainer-check` checks.

**Fix.** Text for D11:
> Before ordering, the trainer shows the price of the selected machine per hour and for the expected 2 hours of the module (from the provider's price list in 09, 5.2; a local VM on one's own computer costs nothing) and the `trainer=devops` label. `trainer-check docker` collects facts (`docker info`, `docker ps -a --format json`, `docker image ls --format json`, `docker volume ls`, `iptables -t nat -S DOCKER`) and checks the same goals as the exercises marked "VM", under the 09 contract. The last step of the module is mandatory: "Delete the VM", with the provider command (`hcloud server delete …`, `yc compute instance delete …`, `multipass delete --purge …` for a local VM). The module counts as completed only after the `trainer-check cleanup` block has confirmed that the provider has no machines with the learner's label. If the machine is not deleted within 24 hours, a reminder is sent.

### 20. MAJOR. Network drills are not linked to R8 ("which layer broke")

**Where:** D7, d17–d19, E4 (1).

**Fix.** Add to each network drill a first "layer" goal (`choice`, checked) following the 03 pattern: d17 — L7/DNS (the name does not resolve); d18 — L4 (socket on 127.0.0.1, RST); dk.b05 — L4 on the host (port taken); dk.b06 — L3 (no route in `--network none`); `ip link set eth0 down` in the container — L2. Explainer E-G "`-p 8080:80` as DNAT": a packet goes from the client to the host `eth0`, passes `PREROUTING`/`DOCKER` (DNAT, label `dport 8080 → 172.17.0.2:80` on the line), `docker0`, veth and reaches the process socket. Toggles: "the application listens on 127.0.0.1" (the packet reaches the namespace and gets an RST, label "L4"), "request from the host itself" (the `OUTPUT` chain instead of `PREROUTING`), "`--network host`" (DNAT disappears, the process port is the host port). Layer labels use the same colors as in the "envelopes" explainer from 03.

### 21. MAJOR. AI behavior at step 4 is not described

**Where:** section 15.

**Fix.** Add a paragraph (the AI context is built by 09, 4.5; here is the block rule):
> On step 4 tasks of the documentation ladder the mentor does not name the flag, instruction or field. To the question "how do I do X" it asks: "Where have you already looked?" Then it names the source without the answer: "`docker run --help`, the section on resources", "`man 7 capabilities`, search for the word bind", "Dockerfile reference, the instruction that sets the stop signal". If the learner has shown that they opened the right page and did not understand it, the mentor explains **the line of the help**, not the task. `ladder_step: 4` and the lesson's `docs` field are passed into the mentor's context. In 09 this is set by the `hint_policy: point-to-docs` flag.

---

## Minor

### 22. MINOR. Image versions are outdated and pinned in prose

**Where:** 2, 3.3, 5.2, 7.4, 9, 11 (`nginx:1.27-alpine`, `alpine:3.22`, `postgres:17-alpine`); 08 (`alpine:3.20`).
As of 18.11.2026 on Docker Hub the nginx stable branch is `1.30.x`, mainline is `1.31.x`, and 1.27 has long been out of support. Alpine's current branches are 3.23 and 3.24; 3.22 is supported until May 2027. Engine is 29.10.0 (16.11.2026), so "29.x" is correct. Fix: do not write versions into lesson texts; substitute them from `content/versions.yaml` (`nginx_tag`, `alpine_tag`, `postgres_tag`, `engine`), which is updated together with the golden recordings. For v86, pin one Alpine branch in 09 for the whole course.

### 23. MINOR. Incorrect lifecycle diagram

**Where:** 3.3 D4 (`created → running → paused → exited → removed`).
`removed` is not a state: after removal there is no container. `paused` is a branch from `running`, not a step toward `exited`. `restarting` and `dead` are missing. The correct model is given in finding 7.

### 24. MINOR. Interactive 1, step 3: wrong answer to the question about shared namespaces

**Where:** 4.3, step 3. With a `config.json` from `crun spec`, the new namespaces are pid, network, ipc, uts, mount, cgroup. **user and time** remain shared with the host, and this is also visible in the 4.5 JSON (`user` matches). The answer "for example, time" is incomplete: add user to the rubric and show the link to D9 ("that is why root inside is UID 0 of the host").

### 25. MINOR. The `ping` model in dsim

**Where:** 7.3 ("ping (model: … presence of CAP_NET_RAW)").
Since Docker 20.10, `net.ipv4.ping_group_range=0 2147483647` is set in the container network namespace. So a `ping` that can use datagram ICMP sockets (iputils) works even without `NET_RAW`. The model must take into account both this sysctl value and which `ping` is in the image. Reduce it to a golden recording: `docker run --cap-drop NET_RAW alpine ping -c1 …` and the same for `debian` with iputils.

### 26. MINOR. Container environment variables and the OOM killer are not introduced in the order of introduction

**Where:** section 2. `-e`, `--env-file` and `DB_HOST` are already used in d05 (D4), but there is no such entity in the table (in 01 it is D14). The word "OOM killer" appears in interactive 1 (D2, step 6), but is introduced in `l3-s4` (D3). After finding 1, OOM will come from Linux, and D14 needs to be added to D4.

### 27. MINOR. The memory budget diverges from 09

**Where:** 16 ("256 MB of tab memory"). 256 MB is guest memory. A tab with one machine fits into 600 MB under the 09 budget. Replace with a link to the 09 budget table (1.4).

### 28. MINOR. The second "container" terminal in interactive 1 is not described

**Where:** 4.2, 6.3. It is not said how the terminal on `ttyS2` gets inside the container. Describe it: on `ttyS2`, `inittab` has a `getty` with autologin whose profile runs `box exec web sh` (or `nsenter -t $(box pid web) -a sh`). After `box rm` the terminal returns to the host with a caption. The `ttyS1` channel is occupied by `trainer-agent` (finding 6).

### 29. MINOR. "Express" is not defined

**Where:** 3.2 (express for the intermediate and experienced). There is no definition of what the express version includes. I propose: one summary page of the chapter (key statements and a diagram), 3 `predict`/`order` questions, one confirmation exercise. On a mistake the full version of the chapter opens, and the concept is marked as a "gap" per 01 (section 3).

### 30. MINOR. The experienced learner's entry check starts below step 3

**Where:** 9.3. Under R2 the experienced tier starts at step 3. So in the entry check at least one practical task must come with a single link to a page and without a description of the flags. For example, give task 2 ("limit `stress-mem`…") with a link only to `docs.kernel.org/admin-guide/cgroup-v2.html`, without mentioning `memory.max`.

### 31. MINOR. Links and wording of sources

**Where:** 18, 5.2.
- The minirootfs archive name is `alpine-minirootfs-3.22.<patch>-x86.tar.gz` (with the patch number); in the text, take it from `versions.yaml`.
- For D9 and d26, add the sources `pid_namespaces(7)` (PID 1 signals) and Docker's default seccomp profile (`moby/profiles/seccomp/default.json`), as well as the Docker page on AppArmor.
- The claim about userns-remap is confirmed: docs.docker.com/engine/storage/containerd/ says "The containerd image store is not available when using user namespace remapping (userns-remap)", with a link to moby#47377. Move the issue link to the sources of block D9.
- Check the Russian links to Habr for "translation of an English source" before publication (a rule from section 18 of the document itself). Currently none of them is marked as original or translation.

---

## What the author of 09 will add following this review

So that 04 can refer to it rather than duplicate it: (1) the merged `dt-kernel` fragment (finding 8) and the kconfig check in CI; (2) fact scopes `compose`, `builds`, `registry`, `logs`, `cgroups.pids.events/cpu.stat`, the `do:` step and the `@pid(cmd@ns)` macro (finding 6); (3) `docs.snapshot` — snapshots of man and `--help` for step 2 hints (finding 3); (4) the registry at its own path on the same origin and rewriting of `registry.trainer.local` in the `fetch` adapter (finding 14); (5) the `lab-node` image and the "3 nodes + 1 lab" budget in table 1.4 (finding 15); (6) the identifier rule (finding 18); (7) `hint_policy: point-to-docs` for the AI (finding 21).
