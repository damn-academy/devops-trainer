# Review of 04-containers.md (reviewer: the author of 02-linux.md, a Linux engineer)

Reviewer: a Linux engineer (the author of 02-linux.md). Date: 18.11.2026. The document under review was not modified.

## Verdict

A strong engineering foundation: the "container by hand" lab in v86, a byte-level breakdown of the OCI image, dsim with golden recordings, checks by state rather than by command text. But after the owner's second wave of requirements, the document cannot be accepted in its current form. There are four reasons. First: the block itself introduces namespaces, cgroups, capabilities, chroot and overlayfs, while R6 moves them to Linux, so D2 and D3 must be rewritten from "introduction" to "assembly from familiar parts". Second: the visual language (houses, ink-drawn rooms, bookshelves, mailboxes, Rashomon "witnesses") directly contradicts R4/R5. Third: there is no documentation ladder (R2), no process explainers with rewind, parameters and "break it" (R3), no six container boundaries with exercises on them (R7b), no "hardware → VM → containers → nesting" scene (R7c). Fourth: the document duplicates shared engines and contracts (network, agent, v86 image, checks, concept graph) that 03, 08 and 09 have already agreed on. In addition, the lab contains commands that will not work in the described image: `httpd` is not in minirootfs, `capsh --` calls `/bin/bash`, `pgrep` picks the wrong process, `iptables` in Alpine goes through nft, while the kernel is built with legacy only. Below are 32 findings; for each owner requirement, ready text that can be pasted is given.

Summary: BLOCKING — 6, MAJOR — 17, MINOR — 9.

---

## A. Owner requirements (R1–R12)

### 1. BLOCKING — R6 and the order of introduction: the block introduces what Linux must now introduce
**Where:** §2 "Order of introducing entities" (rows 4–8, 15, 27), §3.2–3.3 (D2, D3), §19.

**What is wrong.** Entities 4–8 (namespace and its kinds, cgroup and controllers, rootfs, chroot/unshare/pivot_root/veth, capability), 15 (OverlayFS) and 27 (seccomp) are introduced in D2/D3/D5/D9. Under R6, all of this is introduced by the Linux block, in the module "How the kernel isolates and limits", and the containers block only relies on these concepts. As it stands, the same thing will be written twice and differently: in 02 L16 I give `lsns`, `unshare`, `systemd-cgls`, while in 04 D2 there are "rooms". The 01 graph also diverges from R6 (D03–D05 in group D) and must be fixed in sync; this is a finding against 01, but the 04 code must be ready.

**Fix.** Split the responsibility as follows (on the 02 side I take the left column; I will add module L17 "How the kernel isolates and limits" to 02 after L16):

| Concept / skill | Introduced by (Linux, L17) | Applied by (Containers) |
|---|---|---|
| process and thread, `fork`/`exec`, `/proc/<pid>/task`, `ps -eLf` | L17.1 | D10 (`clone` in runc), PID 1 in D6 |
| namespace, 8 kinds, `/proc/<pid>/ns`, `lsns`, `unshare`, `nsenter` | L17.2 | D2 (overview "what a container is made of"), D3, d27 |
| cgroup v2: `/sys/fs/cgroup`, `memory.max`, `cpu.max`, `pids.max`, `memory.events`, OOM-kill drill | L17.3 | D3 step 4 (2-minute repeat), D9 limits, E4.2 |
| capabilities: `capsh`, `getcap`/`setcap`, `CapEff` in `status` | L17.4 | D9, d24, d26 |
| mount namespace, bind mount, `chroot`, `pivot_root` (idea), overlayfs (lower/upper/work/merged, copy-up, whiteout) | L17.5 | D5 (image layers as lowerdir), D3 step 6, D7 (volume/bind) |
| seccomp (idea: a system call filter) | L17.6 | D9 (Docker profile), D3 step 8 for experienced learners |
| veth, bridge, netns | networks N20/N21 (already in 01) | D7 |

In 04, accordingly:
- §2: rework rows 4–8, 15 and 27: `requires: [L-ns, L-cg, L-cap, L-chroot, L-overlay, L-seccomp]` instead of `introduces`. The Docker block introduces only combinations: "container = process + namespaces + cgroup + rootfs from layers" (D06 per 01), "OCI bundle", "runtime".
- Rename D2 to "A container from familiar parts". 20 minutes to assemble already known mechanisms into a single definition, with no new vocabulary.
- Keep D3 as the main lab, but with a different framing: "you have already done each step separately in L17, now assemble them into one script and compare with `config.json`". For the beginner, D3 stays after D8, but steps 2–4 become a repetition rather than a first encounter.
- Entry check 9.1 for the beginner: replace "find the PID of crond" with an L17 check ("create a process in a new pid namespace", "read memory.max of the group"). If the learner has not passed L17, they are sent there, not to D2.

### 2. BLOCKING — R4/R5: "house/rooms/shelf/mailbox" metaphors and ink in the mechanisms
**Where:** §4.2 "Screen" (house, ink rooms `ink.ts`, "bookshelf", "mailbox", "sign"), §6.3 "each room is drawn in ink", §8 (ink for walls and arrows; Rashomon "six witnesses", "the witness who gave no testimony"), §2 rows 4–6 ("rooms", "meters", "bookshelf").

**What is wrong.** R4: no characters, plot or decorations; a simple diagram of blocks, arrows and labels on lines. R5: clean engineering graphics in the spirit of Ciechanowski and Comeau, not Sankofa ink. Even 08 limits ink to introductory metaphors (08, line 37), while 04 draws the mechanism itself with it.

**Fix (ready specification of interactive 1, paste instead of §4.2):**

> The screen is split vertically into two zones by color, and this color means the same thing throughout the course: **kernel space** (bottom band, neutral dark gray) and **user space** (above, light background). Kernel space contains a single band "Linux 6.12 (one kernel)" and inside it eight horizontal lanes-tables, one per namespace kind: `pid`, `mnt`, `net`, `uts`, `ipc`, `user`, `cgroup`, `time`. Each lane holds instance rectangles with an inode number (`4026531836`). On the right of the kernel is the cgroup v2 tree (`/`, `/system`, `/box-web`) with three gauges at each node: memory, cpu, pids (a thin fill bar, a limit tick mark, the number `current / max` in a monospace font).
> User space shows processes as rectangles labeled with `comm` and PID. Thin lines go down from each process, one to its instance in each lane; the line is labeled with the kind (`pid`) and carries the number from `readlink`. The container's processes are enclosed in a common frame "container web" — this is a group frame, not a "house". The frame appears only when the processes have at least one non-shared namespace.
> Clicking any element opens a card: what it is, which kernel file shows it (`/proc/412/ns/net`, `/sys/fs/cgroup/box-web/memory.max`), a link to the man page (a level of the R2 ladder, see finding 3).
> Toggles: one switch per namespace kind ("shared with host / own"). When the learner turns off `pid`, the process lines jump to the host instance, and in the container terminal `ps` starts showing all processes; next to it an explanation line appears: "without its own pid namespace the process sees and can send a signal to any host process (`docker run --pid host`)". The `memory.max` slider (8–64 MB) moves the tick mark; if current is above it, the tick turns red, and the next frame shows the OOM kill: the process disappears, the `oom_kill` counter in `memory.events` becomes 1, a `dmesg` line is printed under the gauge.
> Only basic animation: a line moves to another instance in 200 ms, a gauge grows, a disappearing process fades. No walls, furniture, people or "rooms".

The "rooms" metaphor may remain only in a single introductory frame of D2 (as 08 permits), with an explicit transition to the diagram. Everywhere else in the document, replace the words "room", "house", "shelf", "meter device" with "namespace", "container process group", "rootfs", "cgroup gauge".

Rashomon (§8): keep the lenses as a mechanism (R5 permits lenses), but remove the "witnesses" and "testimony". A lens is a filter over one and the same chain diagram: CLI / dockerd / containerd / shim / runc / kernel. The calls visible to the selected component are highlighted. The "empty lens" becomes a toggle "guest kernel: none" labeled "a container has no kernel of its own; in the VM diagram this lane is filled".

### 3. BLOCKING — R2: there is no documentation ladder at all
**Where:** the whole document; closest are §7.3 ("Flags outside the list… link to documentation"), §11.2 `hints`, §13 exams, §15 AI.

**What is wrong.** There are no steps 1–5, no "man excerpt with the line highlighted in the hint" mechanism, no "find the flag" tasks, no enforced step and no exam with official documentation open and tasks outside the course. The AI tutor (§15) cannot answer "where did you look?".

**Fix (new section 10.1 "Documentation ladder").**

Format of the excerpt hint (shared by all blocks; I propose exactly the same in 02):
```yaml
doc_hint:
  source: {kind: cli-help, cmd: "docker container run --help", version: "29.x"}   # cli-help | man | web
  anchor: "--stop-timeout"          # the line we highlight
  context_lines: 3                  # how many lines around it
  anatomy: [usage, options]         # which parts of the page to label (Usage/Options; for man — SYNOPSIS/OPTIONS/EXAMPLES)
  url: "https://docs.docker.com/reference/cli/docker/container/run/#stop-timeout"
```
Help texts are taken from the golden recording (`docker … --help` on Engine 29), man pages from the `man-pages`, `util-linux-doc`, `libcap-doc` packages in lab-alpine (they are currently missing from §6.1, add them), and for experienced learners and exams — `crun --help`, OCI runtime-spec `config.md`.

| Step | Who | What it looks like in the block | Example tasks (ready) | Check |
|---|---|---|---|---|
| 1. Glimpse | Beg: D1–D5 | Every new command in the theory has a "where this comes from" icon, a link to the exact anchor: `docs.docker.com/reference/cli/docker/container/run/#publish`, `man7.org/linux/man-pages/man7/namespaces.7.html`. Optional, affects nothing | — | None; clicks are counted for analytics |
| 2. Excerpt | Beg: D6–D9, Int: D1–D4 | Hint = an excerpt from `--help` or man with the line highlighted and the parts labeled (Usage / Options / Aliases; SYNOPSIS / OPTIONS / EXAMPLES) | d04: hint — `docker container rm --help`, `-f, --force` highlighted; d06: `docker run --help`, `-i` and `-t` highlighted; d25: `--pids-limit` highlighted | As usual, by state |
| 3. Find the flag | Int: D5–D10, Exp: from the start of the block | The task names the effect, the link leads only to the page, without an anchor. The answer is checked by the result | **f1.** "Show only the IDs of stopped containers" (`docker ps -aq --filter status=exited`). **f2.** "Give container `web` 30 seconds for graceful shutdown on stop, without changing the image" (`--stop-timeout 30`; check `HostConfig.StopTimeout=30`). **f3.** "View the `api` log for the last 2 minutes only, with timestamps" (`logs --since 2m -t`; check — the saved output matches the reference). **f4.** "Find out from inspect whether the container was killed by OOM" (`--format '{{.State.OOMKilled}}'`). **f5 (v86).** "Enter only the network namespace of the httpd process, staying in the host file system" (`nsenter -t PID -n`; check: in the shell `ip a` shows `veth-box`, and `ls /opt/images` works) | State or saved output |
| 4. Enforcement | Int: D11, E4; Exp: D9–D12 | Tasks require commands and flags that are not in the theory. No hints. To any question, the AI first asks "where did you look?" and points to: `docker <cmd> --help`, `man`, docs.docker.com, `crun --help`, OCI spec. It gives no ready answer until the learner names a source | **p1.** "The container must stop on SIGINT, not SIGTERM" (`--stop-signal SIGINT` or `STOPSIGNAL`). **p2.** "Copy `/etc/nginx/nginx.conf` from a stopped container to the host" (`docker cp` with a stopped container). **p3.** "Add the entry `legacy.db → 10.0.0.5` to the container's `/etc/hosts`" (`--add-host`). **p4.** "Change the restart policy of a running container without recreating it" (`docker update --restart`). **p5.** "Show the platforms of the `nginx` image in the course registry without pulling the image" (`docker buildx imagetools inspect` or `docker manifest inspect`). **p6 (v86).** "Run a command in an already running crun container" (`crun exec`). **p7 (v86).** "Make it so that the process in the container cannot gain new privileges via setuid" (`"noNewPrivileges": true` in `config.json`, per the OCI runtime-spec) | State; the AI request log shows that the learner named a source (does not affect the pass) |
| 5. Exam | Everyone: E1–E4 | Only official documentation is open (a reader tab with an allowlist: docs.docker.com, man7.org, github.com/opencontainers/*, docs.kernel.org). AI is off. Each exam has one task outside the course | E1 +item 8: "Add the OCI label `org.opencontainers.image.source` to the image" (LABEL with an annotation from image-spec `annotations.md`). E3 +: "Make the container root read-only, but `/tmp` writable" (`root.readonly` + tmpfs in `mounts`). E4 +incident 5: "The container log ate the disk" (`--log-opt max-size`, `max-file`; see finding 5, the I/O boundary) | State |

The experienced level starts at step 3: on its route, level-2 hints in D4–D6 are hidden, and tasks f1–f5 are mandatory. In §15, add to the AI instructions: "At step 4, answer the learner's first question with the question 'where have you already looked?'; if they have not looked — name one page (`docker run --help`, `man 7 capabilities`, a docs.docker.com page) without the answer; a substantive answer only after the learner has quoted the line they found". Make the exam reader tab shared with 05 (CKA-like mode), not a separate one.

### 4. BLOCKING — R3: process explainers with rewind, parameters and "break it"
**Where:** §8 Rashomon (a static list of voices), §5.3 screen F/G (partially), D6 (cache — text only).

**What is wrong.** R3 requires three processes for containers: `docker run` from the CLI to the process, `docker build` layer by layer with the cache, `docker pull` by manifest. The document has state breakdowns, but no processes as steps that can be rewound forward and back and paused, with sliders and switching a component off. Some of the scenes already exist in 08 (lines 300–306); they should not be duplicated but consolidated in one place (see finding 7).

**Fix — three storyboards (the stepper engine from 08 §3.1, `breakit` from 08 §3.5; each screen = one idea).**

**X1. `docker run -d -p 8080:80 nginx` — from command to process.** Diagram: rectangles from left to right `docker CLI` → `/var/run/docker.sock` → `dockerd` → `containerd` → `containerd-shim-runc-v2` → `runc` → `nginx process`; below, the kernel band with namespaces/cgroup/netfilter lanes. Labels on the arrows are the real calls.
1. CLI: arrow `POST /v1.5x/containers/create` (the JSON body expands on click: `Image`, `HostConfig.PortBindings`).
2. dockerd: is the image local? The "no" branch → a call to X3 (pull) as a collapsed block; "yes" → onward.
3. dockerd → containerd: `snapshots.Prepare` — an empty upper appears above the layer stack (link to interactive 2, screen F).
4. dockerd: network — a veth pair appears between `docker0` and the future netns, IPAM assigns `172.17.0.2`; the rule `DNAT tcp dpt:8080 → 172.17.0.2:80` appears in the netfilter lane (rule text verbatim from the golden recording).
5. `POST /containers/{id}/start` → containerd `tasks.Create` → the shim starts (its rectangle stays until the end).
6. shim → runc `create`: namespace instances, a cgroup node and `pivot_root` appear in the kernel; runc `start` → `execve("/docker-entrypoint.sh")`.
7. runc disappears (the rectangle fades, label "runc has exited; the container's parent is the shim").
8. Result: the host's `ps -ef --forest`, with the path `containerd-shim-runc-v2 → nginx: master → worker` highlighted.
Parameters: a `-p` toggle (without it step 4 creates no DNAT, and in the final frame `curl localhost:8080` gets `Connection refused`); a `--network bridge | host | none` switch (host: step 4 skips veth, the process is attached to the host netns; none: only `lo`); a `--memory` slider (step 6 writes the value to `memory.max`); a toggle "image already present locally". "Break it": remove containerd (dockerd complains `failed to dial "/run/containerd/containerd.sock"`), remove the shim from the diagram ("then restarting dockerd would kill all containers — this is what the shim is for"), occupy port 8080 with another process (`Bind for 0.0.0.0:8080 failed: port is already allocated`). Error texts come from the golden recording.

**X2. `docker build` layer by layer.** On the left, a six-line Dockerfile; on the right, a layer stack growing bottom-up; between them, a "cache key" column with short hashes.
1. `FROM node:22-alpine` — the stack of base layers appears all at once (label "taken from local storage or downloaded via X3").
2. `WORKDIR /app` — no layer, only the config changes (the config sheet on the right highlights `WorkingDir`).
3. `COPY package*.json ./` — the sha256 of the file contents is computed, key = (parent, text, file hash); a new layer.
4. `RUN npm ci` — a layer, a stopwatch with model time.
5. `COPY . .` — a layer.
6. `CMD ["node","server.js"]` — config only.
Rewind back and forward; a "rebuild" button. Parameters: an editor where the learner changes `server.js` or `package.json`: when `server.js` is edited, steps 1–4 turn gray with a `CACHED` label; when `package.json` is edited, the cache breaks from step 3, and everything below is rebuilt (a red line "the cache is invalid from here" with an explanation of which key component changed). A toggle "swap lines 3–5 to `COPY . .` before `RUN npm ci`" shows that any code edit reinstalls the dependencies. A `--no-cache` toggle; a `.dockerignore` toggle with `node_modules` (without it the hash of step 5 depends on a gigabyte of files, the context grows, the "sent to builder" counter shows the size). "Break it": `RUN rm -rf node_modules` as a separate line — the image size counter does not decrease, the deletion layer weighs 0, and the previous one still sits in the stack.

**X3. `docker pull nginx:1.28-alpine` by manifest.** A sequence diagram (time from top to bottom): `dockerd` ↔ `registry` ↔ `auth`.
1. `GET /v2/` → `401`, header `WWW-Authenticate: Bearer realm=…,scope=repository:library/nginx:pull`.
2. `GET /token?...` → a token (the JWT expands on click).
3. `GET /v2/library/nginx/manifests/1.28-alpine`, `Accept: index, manifest` → an index with the list of platforms.
4. Platform selection `linux/amd64` → `GET …/manifests/sha256:…` → manifest.
5. `GET …/blobs/sha256:<config>`.
6. Layers: parallel arrows `GET …/blobs/sha256:<layer>` with download bars; after each — a sha256 check (checkmark) and unpacking into a snapshot.
Parameters: a platform switch (`amd64`/`arm64`/`386` — a different manifest and different layers); a toggle "layer already present locally" (the arrow is skipped, label `Already exists`); a switch "by tag / by digest" (by digest, steps 3–4 merge into one, no tag is needed). "Break it": tamper with a byte in a layer (sha256 does not match — `failed to verify digest`, the pull is aborted), withhold the token (401 → `pull access denied`), repoint the tag to another image (by tag a new digest arrives, by digest the old one).

These three explainers must operate on the same dsim state and registry as the exercises: step X1.4 draws exactly the rules that `iptables -t nat -S` will later show in d19.

### 5. BLOCKING — R7b: six container boundaries and "the container does not work" exercises
**Where:** §3.3 D4/D7/D9, §10 (exercises are scattered across modules and not tied to boundaries).

**What is wrong.** There is no concept of a "boundary" and no cross-cutting rule "first ask at which boundary it broke" (an analogue of R8 for networks). There are no zombies, no tini as a zombie reaper, no log drivers, no UID inside and outside on a bind mount, no userns, no embedded DNS as a point of failure, no host kernel as a boundary (module, sysctl, architecture).

**Fix.** A new module **D7b "Six container boundaries"** (after D7, before D8; for the beginner — after D8 together with D3). Base diagram: a container frame in the center, six sides, each labeled and clickable; in every exercise of the module the first question is "at which boundary?" (a choice, scored separately, a mistake is explained).

| Boundary | What passes through it | Theory (briefly) | Exercises (ready, with checks) |
|---|---|---|---|
| 1. Host kernel | system calls, modules, sysctl, architecture | There is one kernel: no module on the host means none in the container either; some sysctls belong to a namespace (net.*), others only to the host; a binary for a different architecture does not run | **b1.** "`docker run trainer/tool:arm64` fails immediately: `exec format error`". Check: the image is run with `--platform linux/amd64` or with the tag for the right platform; boundary = kernel. **b2 (v86, Exp).** "The container needs `net.ipv4.ip_forward=1`, but `sysctl -w` inside gives `Read-only file system`". Check: the value is set via `--sysctl` (dsim) or `config.json linux.sysctl` (crun), not `--privileged` |
| 2. Network | veth, `docker0`, NAT, `-p` as DNAT, embedded DNS, host/none | None; refers to N9, N10, N20 and X1 | d17, d18 (exist). **b3.** "`api` cannot find `db` by name" — both are on the default `bridge` network. Check: a user-defined network, `nslookup db` from `api` returns an IP. **b4.** "No internet from the container, but ping 172.17.0.1 works". Initial state: `ip_forward` is off on the dsim host. Check: `ip_forward=1`, the MASQUERADE rule is in place |
| 3. Storage | upper (ephemeral), volume, bind, tmpfs | What survives `rm`, what survives a reboot, what lives only in memory | d15, d16 (exist). **b5.** "After `docker compose up --force-recreate` the files uploaded by users are gone". Check: the uploads directory is on a volume |
| 4. Process and signals | PID 1, SIGTERM → SIGKILL, zombies, tini | PID 1 in a namespace receives no signals without a handler; PID 1 must reap zombies | d13 (fix, see finding 13). **b6.** "`[sh] <defunct>` entries pile up in the container's `ps`". Initial state: a wrapper application starts child processes and does not call `wait`. Check: `--init` or `tini` in ENTRYPOINT; after 60 model seconds there are no processes in state Z |
| 5. I/O and logs | stdout/stderr → log driver | `docker logs` sees only the stdout/stderr of PID 1; an application writing to a file is "silent"; `json-file` without rotation grows without limit | **b7.** "`docker logs app` is empty although the application is running". Initial state: the application writes to `/var/log/app.log`. Check: the file is replaced with a link to `/dev/stdout` (as in the nginx image) or the application is switched to stdout; `docker logs` contains the startup line. **b8 (R2 step 4).** "The container log has taken 3 GB". Check: `--log-opt max-size` and `max-file` are set |
| 6. Configuration and identity | env, secrets, UID inside and outside, userns, permissions on a bind mount | A UID is a number; the user name inside and outside may differ; a bind mount preserves numeric owners | d05, d14, d23 (exist). **b9.** "A container with `USER 1001` cannot write to the bind mount `./data`, and suggesting `chmod 777` is not allowed". Check: the directory owner on the host = 1001 (`chown`) or `-u $(id -u)`; the mode is not 777 (`forbid`). **b10 (Exp, v86).** "With rootless/userns, files created by root in the container belong to 100000 on the host". Task: explain it using `/proc/<pid>/uid_map` and make the directory writable. Check: `uid_map` has been read (saved output), directory owner = 100000 |

The final exercise of the module, **b-mix**: five random breakages from the table in a row, without the boundary being given. It is passed if the boundary is named correctly and the breakage is fixed; the debrief shows how many times the learner started from the wrong boundary.

### 6. BLOCKING — R7c: the "hardware → VM → containers → nesting" scene and the startup measurement
**Where:** §3.3 D1, §4.6 "VM versus container".

**What is wrong.** There is a builder for two stacks and a comparison of "v86 startup time versus a container", but: (a) there is no present-day nesting (containers in cloud VMs, k8s on bare metal, VMs inside k8s via KubeVirt/Cozystack); (b) there is no "number of applications" slider, no "kernel vulnerability" toggle, no counters; (c) the VM startup measurement is impossible as described: per §6.1, v86 is always restored from a snapshot in 1–3 s, the learner never sees the boot and will get "a VM starts almost as fast as a container" — exactly the opposite of the intended conclusion.

**Fix — storyboard X4 (replaces §4.6; scene 8 from 08 becomes part of it).**
1. **Hardware.** One tower: `server` → `kernel` → `OS` → `app A`, `app B`. Counters at the top: server CPU load, memory used / total, "time to start one more application". A "number of applications" slider 1–50: on a library conflict (toggle "A and B require different libssl versions") application B is marked red "does not start". Server load ~10%.
2. **VM.** On the left, the same tower; on the right, a new one: `server` → `hypervisor` → N × (`guest kernel` → `OS` → `app`). The counters are recomputed as the slider moves: memory = N × (kernel + OS + app), startup = kernel boot (tens of seconds), utilization grows. Label at N = 20: "memory ran out at the 14th VM".
3. **Containers.** The right tower: `server` → `host kernel` → N × (`rootfs + app` in a namespaces/cgroup frame). At N = 50 memory barely grows, startup is a fraction of a second.
4. **"Kernel vulnerability" toggle.** In the VM tower, one guest kernel lane turns red, the other VMs are unaffected; in the container tower, the shared kernel band turns red, and all N frames get a red outline. Label: "containers share one kernel — one vulnerability affects all of them; this is why untrusted code is run in VMs or in sandboxes (gVisor, Kata Containers)".
5. **Today: nesting.** Three towers side by side, a switch:
   - "cloud": `provider hardware` → `hypervisor` → `customer VM` → `VM kernel` → `containers` (this is how almost any managed Kubernetes works);
   - "k8s on bare metal": `hardware` → `kernel` → `kubelet` → `containers`;
   - "VM inside k8s" (KubeVirt, Cozystack): `hardware` → `kernel` → `kubelet` → pod `virt-launcher` (container) → QEMU/KVM → `guest kernel` → `app`. Clicking `virt-launcher` explains: a VM is an ordinary QEMU process inside a pod's container, scheduled by Kubernetes as a pod.
   The counters on this screen are "how many kernels are in the tower" and "where the isolation boundary is" (highlighted with a thick line).
6. **Where we are now.** A fourth tower — your laptop: `hardware` → `laptop OS` → `browser` → `v86 (x86 emulator)` → `Linux 6.12 i686 kernel` → `crun container`. Label: "the course lab is itself a VM".

Practice (v86, lab-alpine):
```sh
dmesg | grep -i -E 'virtio|9p|DMI|Hypervisor' | head      # virtio and 9p devices are signs of a VM
cat /proc/cpuinfo | grep -m1 'model name'                   # the CPU model the emulator reports
uname -r; box start x; box exec x uname -r                  # one kernel
ps -e | wc -l; box exec x ps -e | wc -l                     # different view of processes
time box start y                                            # container startup
```
VM startup measurement: the button "boot a second machine from scratch" starts a second v86 instance in a separate Worker **without** `initial_state` (a cold boot of the same kernel and root, ~20–30 s) and shows a stopwatch next to `time box start y`. Memory: `free -m` in the guest plus the RAM of the second v86 instance from `performance.measureUserAgentSpecificMemory()` (where available) or the configured `memory_size` value. Check: both numbers are obtained (from the "machine ready" event and from the saved `time` output), and the learner has entered them into the comparison table. What exactly `dmesg` shows in v86 must be verified in a spike: v86 may not set the hypervisor CPUID bit, in which case rely on virtio/9p and SeaBIOS in the log.

### 7. MAJOR — Duplication of shared engines and divergence from 03, 08, 09
**Where:** §1 (v86 image, its own kernel), §4.5 (`nsview` on `ttyS1`), §6.5 (check agent on `ttyS1`), §7.1 `engine/net.ts`, §11.2 (its own check format), §8 (its own table of Sankofa mechanisms).

**What is wrong.**
- 03 (line 725) states directly: the Docker block uses the `netlab` core (netns, veth, `docker0`, DNAT, 127.0.0.11), and 09 §1.3 states that a dsim container is a Sandbox process in the netlab network model. In 04, dsim has its own `engine/net.ts` with IPAM and DNS. Two network models will inevitably diverge (rule order, `iptables -S` texts).
- 09 §1.4 decided: one `dt-kernel` 6.12 LTS i686 kernel and the `lab-debian`/`lab-alpine` roots, the `trainer-agent` agent, the `dt.facts/v1` facts. 04 has its own kernel "based on linux-virt", a check agent with the format `{check, ok, facts, failed}` and a separate `nsview` streamer, both on `ttyS1`. Two writers on one UART means interleaved JSON lines.
- In 02 the training user is `student` (uid 1000), in 04 it is `trainee`.
- The D2/D5/D6 scenes (room, layers, overlayfs, cache, registry) are already laid out in 08 (lines 262–306) with different numbers and wording.

**Fix.**
- In §7.1, replace `engine/net.ts` with the line "networks — via netlab (document 03): dsim calls `netlab.createBridge`, `netlab.attachVeth`, `netlab.addRule('nat', 'DOCKER', …)`; dsim stores only the network ↔ container binding and the Docker IPAM data".
- In §6.1–6.2, refer to `dt-kernel` and `lab-alpine` from 09, and hand over its own configuration fragment to the shared one (with the corrections from finding 12).
- §4.5 and §6.5: one agent `trainer-agent` and the protocol from 02 §4.2 / 09 (request-response with `id`); snapshots for interactive 1 are the operation `{"op":"snapshot","kind":"ns"}` with the subscription `{"op":"watch","kind":"ns","ms":500}`, responses on the same channel with `id`. The `/opt/checks/*.sh` checks return `dt.facts/v1` facts, the predicates are shared (finding 8).
- The user is `student`.
- Replace §8 with a reference to 08 with a table "08 scene ↔ 04 interactive"; keep only the data and checks in 04.

### 8. MAJOR — Concept identifiers and the lesson format do not match the 01 graph
**Where:** §2 (numbering 1–28), §11.1 (`introduces: [layer, overlayfs, upperdir, lowerdir, whiteout, copy-up]`, `requires:`).

**What is wrong.** 01 §6 defines `content/concepts.yaml` with IDs `D01–D23`, the `uses` field and the rule "one screen — no more than one new concept". 04 uses its own numbers and slug names, the `requires` field, and introduces six concepts in one lesson. The 01 builder will not accept such a lesson. In addition, 04 has concepts that are not in the graph: OCI bundle, shim, seccomp, capability, index/platform, BuildKit secret, log driver, and also the six boundaries from R7.

**Fix.** In §2, add an "01 ID" column and propose new IDs to 01: `D24 OCI bundle and runtime spec`, `D25 shim and the OCI lifecycle`, `D26 index and platform`, `D27 log driver`, `D28 container boundary (6 kinds)`, `D29 Docker seccomp profile`, `D30 userns/rootless`. `L-ns`, `L-cg`, `L-cap`, `L-ovl`, `L-sec` move to group L (finding 1). Bring the lesson format in §11.1 in line with 01: `introduces` at the screen (scene) level, no more than one ID; `uses` instead of `requires`.

### 9. MAJOR — R11: the lab must become the basis of a hybrid Kubernetes node
**Where:** §4.3 (`box` — a wrapper over `crun run`), §6.1 (256 MB), §16 (v86 does not run on a phone), §19.

**What is wrong.** Under R11, each v86 node runs a real small "kubelet" that starts pods via crun, with 64–128 MB per node, 3–4 nodes on a laptop and one on a phone. 04 is the only document where crun in v86 is designed, but the `box` wrapper is described in one line, the memory budget is 256 MB, and the phone is excluded.

**Fix.**
- Describe `box` as a contract (later called by the node agent from 05):
  ```
  box sandbox create <pod>            # netns + uts + ipc (pause-like process `sleep infinity`), cgroup /pods/<pod>
  box run <pod> <ctr> --image <ref> [--mem N] [--pids N] [--env K=V]...   # crun run with the pod's namespaces (path in config.json)
  box exec <pod> <ctr> -- CMD         # crun exec
  box kill <pod> <ctr> [SIG]; box rm <pod>
  box ps --json                       # facts for trainer-agent
  ```
  Pod = shared net/ipc/uts via `linux.namespaces[].path=/proc/<pause>/ns/net`; this is exactly the bridge to K09 from 01.
- Budget: aim `lab-alpine` at 96 MB (Alpine with OpenRC and no extra services fits; tmpfs `/c` — 32 MB, OOM exercises at 8–16 MB limits instead of 32–64). Then 3–4 nodes of 96–128 MB each on a laptop and one on a phone are realistic. Fix §16: one v86 node is allowed on a phone with `deviceMemory ≥ 4`, recorded mode only below that.
- The network between nodes is the shared JS switch from R11 (03/09), not `inbrowser` by default. In D7 for experienced learners, add the exercise "two v86 nodes, a container on node 1 reaches a container on node 2 via a route" — this is a precursor of pod-to-pod across nodes (R9).

### 10. MAJOR — R1: the textbook is thin, the document rests on practice
**Where:** §3.3 (each module is one paragraph), §11.1.

**What is wrong.** R1 puts the textbook (coherent theory, strict order), the explainers and reading documentation above practice. Modules D4–D10 have lists of topics, but no chapter plan: what is explained, with which example, in what order, what question comes at the end of the chapter.

**Fix.** Add a chapter plan in a uniform format for each module. Sample for D5:
> **D5. How an image is built.** 1) The chapter question: "what exactly does `docker pull` download?" 2) An image is files and a description: a rootfs of layers (the transition from overlayfs in L17) and a config. 3) Content addressing: sha256 (from L30) → digest; why a tag can be repointed but a digest cannot. 4) The manifest links the config and the layers; the index links the platforms. 5) Explainer X3. 6) Documentation: the step by level — OCI image-spec `manifest.md`, `config.md`. 7) A chapter summary in three sentences and two retrieval-practice questions.
Length: 1,500–2,500 words per module; the text follows the typography rules from 08 (R5).

### 11. MINOR — R12 and D11: the "real VM" stage
**Where:** §3.3 D11.

Add the mandatory R12 elements: showing the VM cost before ordering (from the shared price list of 09/05), a mandatory "delete the VM" step checked via the provider API or `trainer-check --cleanup`, and an explicit note that at this stage the trainer only guides and checks, and does not execute. Next to the cloud providers, list the option of a local VM on one's own computer (09, 5.3).

---

## B. Technical errors

### 12. MAJOR — The kernel configuration fragment is incomplete
**Where:** §1 (row 2 of the table), §6.2.

**What is wrong.**
- `CONFIG_TMPFS_XATTR` is neither in the `virt.x86.config` base nor in the fragment. overlayfs with upperdir on tmpfs (the whole of step 6 and screen F) cannot set `trusted.overlay.opaque` without xattr on the upper and works with limitations. This must be enabled.
- `CONFIG_TIME_NS` is not in the base, while §4.3 step 3 asks specifically about `time`. Enable it.
- The fragment enables only legacy iptables (`IP_NF_IPTABLES`, `IP_NF_NAT`), whereas since 3.19 Alpine calls iptables through the nft backend (`xtables-nft-multi`, [release notes 3.19](https://wiki.alpinelinux.org/wiki/Release_Notes_for_Alpine_3.19.0)). Either build in `NF_TABLES`, `NFT_COMPAT`, `NFT_NAT`, `NFT_MASQ`, `NFT_CT`, or install `iptables-legacy` and call it explicitly. I recommend the former: 09 already mentions `NF_TABLES`, Docker 29 supports nftables, and k8s is moving to the nftables kube-proxy.
- Build in (`=y`, not as a module) `NETFILTER_XT_NAT` (the DNAT/SNAT target lives here in newer kernels), `NF_CONNTRACK`, `NETFILTER_XT_MATCH_CONNTRACK`, `BRIDGE_NETFILTER` (for the exercise with `br0` as in Docker); `VETH` and `BRIDGE` are already there.
- In row 2 of the §1 table, the conclusion "the `cpu` controller is present via `SCHED_AUTOGROUP`" is wrong: autogroup has nothing to do with the cpu cgroup controller; the controller comes from `CGROUP_SCHED`/`FAIR_GROUP_SCHED`, and `cpu.max` is provided only by `CFS_BANDWIDTH`. The conclusion "there will be no `cpu.max`" itself is correct (`virt.x86.config` has no `CFS_BANDWIDTH`).
- Pure cgroup v2: OpenRC may mount the hierarchy in hybrid mode, and then `mount | grep cgroup2` will find `/sys/fs/cgroup/unified`, while writing to `/sys/fs/cgroup/cgroup.subtree_control` will fail. Add `cgroup_no_v1=all systemd.unified_cgroup_hierarchy=1` to the cmdline (the latter is for `lab-debian`), and `rc_cgroup_mode="unified"` to the image's `/etc/rc.conf`. Replace the step 4 line `mount | grep cgroup2 || mount …` with `stat -fc %T /sys/fs/cgroup` → `cgroup2fs`.

### 13. MAJOR — PID 1 and signals: exercise d13 and question D6(3) accept an incorrect fix
**Where:** §10 d13, §12 D6 (3), §3.3 D6.

**What is wrong.** The kernel does not deliver signals from the parent namespace to the PID 1 of a namespace if the process has no handler (except SIGKILL/SIGSTOP; `pid_namespaces(7)`). Python does not install a SIGTERM handler. So `CMD ["python","app.py"]` in exec form also waits 10 seconds and gets SIGKILL (code 137). The d13 check "CMD in exec form **or** `--init`" will accept a non-working solution. Conversely: in `python:3.x`, `/bin/sh` is dash, which does an exec for `sh -c 'python app.py'` with a single command. Then the shell form gives the same PID 1 = python, and the "breakage" in the initial scenario is in fact not caused by the shell form.

**Fix.**
- Initial scenario: `CMD echo starting; python app.py` (sh stays PID 1 and does not forward the signal); the `trainer/api` application handles SIGTERM in one variant and does not in the other.
- Check: `all: [ {build: {pid1_comm_not: sh}}, {after: "docker stop app", expect: {exit_code_in: [0, 143], stop_duration_lt: 2}} ]`, so the result of stopping is checked, not the form of CMD. The explanation on failure "exec form is there, but 137": "now python is PID 1, and PID 1 ignores SIGTERM without a handler: add `--init`/`tini` or a signal handler in the application".
- D6(3): the answer "the exec form is better because the application itself, not `sh`, receives the signal; but if the application is PID 1 and does not handle SIGTERM, `--init` is needed". Separately state that the shell form of `ENTRYPOINT` ignores `CMD` and the `docker run` arguments.
- A golden recording of the scenario is mandatory: the behavior of `sh` (dash, busybox ash) changes from version to version.

### 14. MAJOR — `pgrep -n -f 'chroot /c/rootfs'` finds the wrong process
**Where:** §6.4 steps 3 and 5, §6.4 summary.

**What is wrong.** `unshare --pid --fork … chroot /c/rootfs /bin/sh`: the string `chroot /c/rootfs` is contained in the cmdline of the parent `unshare` process, while the child, after two `exec`s, is already `/bin/sh`. `unshare --pid` does not move the caller itself into the new pid namespace. Therefore `readlink /proc/$P/ns/pid` will show the host pid namespace, the check "the `ns/pid` inode differs" will fail for someone who did everything correctly, and the "1 / 412" visual will bind to the wrong PID. With `ip link set veth-box netns $P` everything works by accident: `unshare` itself called `unshare(CLONE_NEWNET)`.

**Fix.**
```sh
U=$(pgrep -n -x unshare)          # the parent in the host pid namespace
P=$(pgrep -P "$U")                # the container's PID 1, as seen by the host
readlink /proc/$P/ns/pid /proc/self/ns/pid
grep NSpid /proc/$P/status        # NSpid: 412 1
```
The check script should find the process by a property, not by its command line: "there is a process whose last `NSpid` field = 1 and `ns/pid` ≠ `/proc/1/ns/pid`". Extend the question "why is `--fork` needed" with the same observation: "`unshare` itself kept its pid namespace; only its children get the new one".

### 15. MAJOR — `httpd` is not in Alpine minirootfs
**Where:** §4.3 step 1 (`busybox httpd`), §6.4 step 5 (`httpd -p 80 -h /etc` inside the rootfs), §13.3 E3.

**What is wrong.** In Alpine, the `httpd` applet was moved to the `busybox-extras` package long ago ([unix.stackexchange](https://unix.stackexchange.com/questions/452194/how-to-enable-busybox-httpd-on-alpine-linux-image)); it is not in `alpine-minirootfs-*.tar.gz`, and the command will give `httpd: not found`.

**Fix.** Put a custom rootfs `trainer-rootfs.tar.gz` in `/opt/images/` = minirootfs + `busybox-extras` + a `/www` directory with `index.html` (do not serve `/etc` to the outside, that is a bad example). Alternatively, a static busybox with `httpd` over 9p. In step 5, replace with `httpd -f -p 80 -h /www &` (`-f` — do not daemonize; without it the process detaches and the visual loses the PID).

### 16. MAJOR — `capsh … -- -c` calls `/bin/bash`, which Alpine does not have
**Where:** §6.4 step 7.

**What is wrong.** `capsh --` runs `/bin/bash` with the remaining arguments (`capsh(1)`). lab-alpine has no bash, so both lines will fail. In addition, the step mixes root and the unprivileged `trainee`: `unshare --user` is shown first, while the switch to a regular user comes at the end of the text.

**Fix.**
```sh
# as root
grep Cap /proc/self/status
capsh --decode=$(awk '/CapEff/{print $2}' /proc/self/status)
capsh --shell=/bin/sh --drop=cap_sys_admin -- -c 'mount -t tmpfs t /mnt'   # mount: permission denied
capsh --shell=/bin/sh --drop=cap_net_raw   -- -c 'ping -c1 127.0.0.1'       # ping: permission denied (are you root?)
# as a regular user
su student -c "unshare --user --map-root-user sh -c 'id; cat /proc/self/uid_map'"
```
Explain that `--drop` removes the capability from the bounding set, and after `exec` even root no longer has it. The ping example is correct only with `net.ipv4.ping_group_range = 1 0` (the default value in the guest); verify this and mention it (related to finding 22).

### 17. MAJOR — overlayfs: editing lowerdir on a mounted overlay, no `setfattr`, no shell in the layers
**Where:** §6.4 step 6.

**What is wrong.**
- "The learner … manually turns the whiteout (`mknod /c/l2/<name> c 0 0`)" after `mount -t overlay`. The kernel documentation explicitly forbids changing the lower layers of a mounted overlay: the behavior is undefined ([overlayfs.rst, "Changes to underlying filesystems"](https://docs.kernel.org/filesystems/overlayfs.html)).
- An opaque directory requires `setfattr -n trusted.overlay.opaque -v y`, and the `attr` package is not in §6.1.
- `trainer/app` is a multi-stage build of a Go application; its final layers most likely have no `/bin/sh` and no `ls`, and after `pivot_root` the `ls /` command from the example will not run.

**Fix.** Order: unpack → `find /c/l2 -name '.wh.*'` → for each, `rm` the marker and `mknod … c 0 0`; for `.wh..wh..opq` — `setfattr -n trusted.overlay.opaque -v y <dir>` → only then `mount`. Add `attr` to the packages. For step 6, use the layers of the training image `trainer/shell-app` (alpine + busybox-extras + application), and use the Go image only in screen G and D6.

### 18. MAJOR — A chroot escape "via nested chroot and `cd ..`" cannot be shown with busybox
**Where:** §6.4 step 6, the paragraph "Question with a demonstration".

**What is wrong.** The classic escape requires a program that calls `chroot()` without `chdir()` and then `chdir("..")` in a loop. The `chroot` utility (busybox and coreutils) does `chdir("/")` after the call, so the escape cannot be reproduced from a shell, and there is no compiler in the image.

**Fix.** Show an escape that works right away and that the learner already prepared in step 1 (by mounting `/proc`): `ls /proc/1/root/` and `chroot /proc/1/root /bin/sh` — inside a chroot, root reaches the host root through `/proc/<pid>/root` of a process outside. After `pivot_root` in a new pid and mount namespace, the host's process 1 is not visible, and the old root is unmounted. This is exactly the difference the step is written for.

### 19. MAJOR — d26: the obstacle is AppArmor, not seccomp; the check requires something unnecessary
**Where:** §10 d26.

**What is wrong.** The default Docker seccomp profile allows `mount` if the container has `CAP_SYS_ADMIN` (the conditional rule `includes.caps`). A custom profile is not needed. On hosts with AppArmor, mounting is blocked by the `docker-default` profile (`deny mount`), and `--security-opt apparmor=unconfined` or a custom AppArmor profile is required. The check "`--security-opt seccomp=…` permitting mount" requires something superfluous and does not teach the cause.

**Fix.** Check: `privileged: false`, `capAdd ⊇ [SYS_ADMIN]`, tmpfs is mounted inside (`exec mount | grep tmpfs`). In the explanation: "dsim has no AppArmor; on Ubuntu (D11) you will also need `apparmor=unconfined` — verify this in the d26 VM". Mark the exercise "VM".

### 20. MAJOR — Registry from v86: HTTPS is impossible through the `fetch` backend, `.local` is a bad name
**Where:** §1 the "Registry" row, §7.6.

**What is wrong.** The v86 `fetch` backend intercepts the guest's plain HTTP and turns it into a browser `fetch()`; TLS initiated in the guest cannot be passed through this way. `curl https://registry.trainer.local/v2/` from the guest will not work. The `.local` zone is reserved for mDNS (RFC 6762), and 02 already has the training zone `lab.` (`apt.lab`).

**Fix.** The name `registry.lab`, in the guest — `http://registry.lab/v2/…`; in dsim, Docker treats it as an insecure registry (this is a line in the simulator's `docker info` and a short lesson "why TLS is needed in real life"). Verify in a spike that the `fetch` backend passes `HEAD`, the `Accept` and `Authorization` headers unchanged. Without this, the manual pull from §7.6 cannot be built.

### 21. MAJOR — The `nsview` agent on a busybox shell every 500 ms distorts what it shows
**Where:** §4.1, §4.5.

**What is wrong.** A shell script that every 500 ms runs `readlink` over all `/proc/*/ns/*` and reads cgroup files means, in an emulator running at 1–2% of native speed, dozens of `fork`/`exec` per pass. It will take a noticeable share of the guest CPU, distort `cpu.stat` and `nr_throttled` in the `cpu.max` exercise, and itself show up in the host's `ps` as noise. Plus the collision with the check channel (finding 7).

**Fix.** A single long-lived `awk` process (or a small static C binary with its source next to it for reading) with no forks per pass. Poll only on change (`onCommand` events) and no more than once every 2 s when idle. Move the agent process into a separate cgroup `/trainer` and hide it from the visual with a filter. Keep the source open for reading (this is a good idea in the document), but do not justify the load by educational value.

### 22. MINOR — `ping` in dsim is modeled via `CAP_NET_RAW`
**Where:** §7.3 "Shell commands inside the container".

Since Docker 20.10, a container gets `net.ipv4.ping_group_range=0 2147483647`, and ping via an ICMP datagram socket works without `CAP_NET_RAW` (iputils; busybox — depending on the build). The model "no NET_RAW — no ping" will produce the wrong output for `--cap-drop ALL`. Take the behavior from the golden recording for each image.

### 23. MINOR — The Docker container lifecycle is described incorrectly
**Where:** §3.3 D4, §2 row 12.

`created → running → paused → exited → removed` is neither a chain nor a complete list. The states from `docker inspect .State.Status`: `created`, `running`, `paused`, `restarting`, `removing`, `exited`, `dead`; "removed" is not a state but the absence of the object. Draw a transition graph (run/start/stop/kill/pause/unpause/restart/rm), not a line. Separately, in D10, the OCI runtime states (`creating`, `created`, `running`, `stopped`; runtime-spec `runtime.md`) — R7a requires this explicitly, and it is missing from the document.

### 24. MAJOR — There are eight kinds of namespaces, not seven
**Where:** §2 row 4, §3.3 D2 ("seven kinds"), §4.2 table, §4.3 step 3.

Since Linux 5.6 there is the `time` namespace (`namespaces(7)`): cgroup, ipc, mnt, net, pid, time, user, uts. Step 3 meanwhile uses `time` in the answer, although the kind has not been introduced. Change to "eight", add `time` to the L17 introduction list (finding 1) and `CONFIG_TIME_NS` (finding 12). The answer to the step 3 question: "the shared ones are those the runtime did not create: for `crun spec` by default these are `user` and `time`".

### 25. MINOR — Publishing a port on `127.0.0.1` in Docker goes through `docker-proxy`
**Where:** §6.4 step 5 (comparison with `iptables -t nat -S DOCKER`), §3.3 D7.

The `OUTPUT … DNAT` + `route_localnet` + `MASQUERADE` rules in the lab are correct, but by default (`userland-proxy: true`) Docker serves `localhost:8080` with a `docker-proxy` process, while DNAT applies to traffic from outside. Without this caveat, the line-by-line comparison will mislead. Show `ss -ltnp | grep 8080` (`docker-proxy`) in the golden recording. Also take into account that Docker's iptables rules changed significantly between 28 and 29 (the `DOCKER-FORWARD` chains, rules in `raw` against direct access), and compare only with the recording of the version shown by the simulator's `docker version`.

### 26. MINOR — Image and engine versions
**Where:** §5.2, §7.4, D4, E texts.

`nginx:1.27-alpine` — the 1.27 mainline branch was closed in 2025 (stable 1.28, mainline 1.29+), and its images are no longer updated: take the current stable branch as of the recording date. `alpine:3.22` is supported until May 2027, but as of 18.11.2026 newer releases already exist; fix the rule "the latest release that is still built for x86" and verify that x86 is there (09 checked only 3.22). `postgres:17-alpine` is acceptable. Docker Engine "29.x" — pin the minor version in the golden recording and in the simulator's `docker version`, not `x`.

### 27. MINOR — Minor inconsistencies in the text
- §3.3 D11: "repeat of eight exercises (marked … "VM")", while in the §10 table the "VM" mark is on five: d02, d09, d15, d20, d24. Mark three more (I propose d13, d19, d26 — each of them shows on a real host something that dsim does not have) or fix the number.
- §3.3 D5: "почему в продакшене образ ссылаются по digest" → "на образ ссылаются" (a grammar fix in the Russian text: "why in production the image is referenced by digest").
- §4.3 step 5: `echo 16M > …/memory.max` while the running process already uses more will cause an immediate OOM even before step 6. Warn about this in the text or set the limit with headroom.
- §6.4 step 4: `echo 0 > memory.swap.max 2>/dev/null` in a guest without swap is unnecessary noise. Remove it or explain it.

---

## C. Order of terms and pedagogy

### 28. MAJOR — Beginner route: D7 relies on entity 7 (veth), which the beginner gets in D3 after D8
**Where:** §3.2 (beginner order), §3.3 D7 ("a veth pair per container"), §2 row 7.

The text of §3.2 promises that D4–D8 do not use entities 7–8, yet D7 uses veth. In fact veth is introduced by networks (N20 in 01; N1/N20 in 03), so the problem is a superfluous `introduces` in 04: veth must be removed from row 7, and a reference to the networks concept must be written into the `uses` of D7. The same goes for "NAT" and "DNAT" in D7 (N9/N10).

### 29. MAJOR — D1 introduces the container before namespaces and checks with measurements that cannot be understood yet
**Where:** §3.3 D1, §4.6.

In D1, the beginner runs `uname -r` "on the host and in the container" and measures container startup in v86, although the words "start a container" do not yet exist on the route (D4 comes later), and `box start` requires v86 (tier B), which the beginner may not yet have opened at this point. Fix: in D1, only explainer X4 (finding 6) with ready-made frames; the "one kernel" practice and the measurements move to the end of D2 (after L17 the learner already understands what they are seeing).

### 30. MINOR — The entry check is not tied to concept IDs or to the 01 levels
**Where:** §9.

01 §4.3 already contains a Docker check (7 tasks on L1/L2 with different wording: port 8081, `APP_MODE=prod`), and each task there is tied to concepts in order to reveal "gaps". 04 has its own check with different tasks and rules ("5 out of 6, practice mandatory"). There should be one. I propose taking the 04 tasks (they are stronger: a d11-like cache check, `NSpid`), adding `concepts: [D16]` etc. to each, and replacing the Docker section in 01 §4.3 with them. In 9.1, "find the PID of `crond`" — in lab-debian the service is called `cron`; the beginner's readiness check must run in the same environment as L17.

### 31. MINOR — The experienced learner lacks the "documentation" step and the "comparison with what they know"
**Where:** §3.1 "Experienced".

02 collapses the theory for experienced learners to "what is new compared to what you know". 04 does not say this. Add: for experienced learners, each chapter has an "if you are a programmer" sidebar (container = `fork` + `unshare` + `execve`; image = a content-addressed store, like git objects; build cache = memoization by key) and the mandatory R2 ladder starting at step 3 (finding 3).

### 32. MINOR — Recorded mode and "calm mode" for the explainers
**Where:** §4.4.

Recorded mode is described for interactive 1, but not for X1–X4 and D7b. Rule: every explainer must work without v86 (on dsim/netlab or from recorded facts); a live v86 only adds a terminal. In calm mode, steps switch instantly, while rewind remains available, because it is not animation but control.

---

## D. What I confirm (verified)

- Docker's default capabilities (14 of them) are listed correctly.
- The ChainID formula, the pair of the compressed blob digest / the `diff_id` of the uncompressed tar, whiteout = character device 0:0, opaque via `trusted.overlay.opaque=y` — correct.
- Engine 29: the containerd image store is the default on new installations, upgraded hosts keep `overlay2`; with `userns-remap` the containerd store is unavailable ([docs.docker.com/engine/storage/containerd](https://docs.docker.com/engine/storage/containerd/), moby#47377). Keep the D9 wording "incompatible".
- `CFS_BANDWIDTH` is indeed absent from `virt.x86.config`; `USER_NS`, `MEMCG`, `CGROUP_BPF`, `BPF_SYSCALL` are present; `OVERLAY_FS`, `VETH`, `9P_FS`, `NF_TABLES` are modules. The decision to build them in is correct.
- Quiz q-d7-03 (the `-e` flag after the image name → `docker-entrypoint.sh` receives it as an argument → exit 1) is correct.
- The embedded DNS 127.0.0.11 only in user-defined networks, `docker0` 172.17.0.0/16 — correct.

## E. What to add to §19 "What is needed from other roles" (from the Linux side)

- From 02: module L17 "How the kernel isolates and limits" with the concepts from finding 1, the user `student`, the shared agent `trainer-agent` with the `snapshot ns`/`watch` operations, the man pages `namespaces(7)`, `cgroups(7)`, `capabilities(7)`, `unshare(1)`, `nsenter(1)`, `capsh(1)` in the images (for R2), the `doc_hint` format.
- From 09: `lab-alpine` within a 96 MB budget, the kernel fragment from finding 12, a `fetch` backend with `HEAD`/`Accept`/`Authorization`, a switch between nodes.
- From 05: the `box` contract (finding 9) as the runtime of the hybrid Kubernetes node agent.
- From 08: a single list of scenes for the containers block (X1–X4, interactives 1–2, D7b) without duplicates.

