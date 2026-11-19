# 02. Linux block: textbook, explainers, documentation, Linux in the browser, drills, exams

This document describes the second step of the checklist roadmap ("Learn Linux — MUST: file system, processes, systemd, permissions, networking"). The block takes up more study time than any other, and the following blocks rest on it: containers are assembled from kernel primitives that the learner first touches here (namespaces, cgroups, capabilities, overlayfs, PID 1), Kubernetes relies on processes, systemd and logs on the nodes, and Ansible relies on ssh, packages and permissions.

**What matters most in the block.** In order of priority: (1) the textbook — coherent theory with a strict order in which entities are introduced (sections 5.1–5.4); (2) process explainers — step-by-step interactive diagrams with parameters and a "break it" mode (section 6); (3) the habit of reading documentation — a five-rung ladder, where on the top rungs the task cannot be solved without documentation (section 7). Practice (drills and exams, section 8) stands on these three supports: a task checks what the chapter explained, what the explainer showed, and what the documentation let the learner find on their own.

**What the document is aligned with.** The concept graph, lesson anatomy, the S0–S5 support ladder, hints H1–H5 and the rules for the AI mentor — document 01. The visual language, widgets (`stepper`, `diagram`, `breakit`, `terminal`, `split`) and color tokens — document 08. The `dt-kernel` kernel, the `Machine` interface, the service agent, the `dt.facts/v1` fact format, the `goals` check format, OPFS storage and the `vswitch` switch — document 09. These decisions are not redefined here; this document describes what the Linux block needs from them and what the Linux block adds.

**Notation.** The block's modules are M0…M16 (in data `linux.m00`…`linux.m16`), so they are not confused with the levels `L0/L1/L2` and with the graph concepts `L01…L43` from document 01. Levels: **L0** — beginner, **L1** — intermediate, **L2** — experienced (spelled out in words in the interface). Lessons are `linux.<slug>` (`linux.process`), drills are `linux.mNN.drill.N`, exams are `linux.exam.<slug>`. The rungs of the documentation ladder are "rung 1…5" (in data `doc1`…`doc5`; the letter D is taken by Docker concepts).

The interface and theory are bilingual (RU/EN). Command output is always in English, as on real servers; only the markup over the output is translated (captions, hints, field breakdowns).

---

## 1. Three machine tiers

### 1.1. What we chose

The learner works with three tiers, and the trainer moves them from one to another on its own.

| Tier | What it is | Where it runs | When it is used |
|---|---|---|---|
| **A. Stand** | A shell simulator in TypeScript in a Web Worker (`sim.worker.ts`, 09 §1.3): a virtual FS with inodes, users, a process table, parsing of a subset of bash | Any browser, including a phone; instant start | Level L0, modules M0–M7, all explainers in recorded mode, warm-ups inside the theory |
| **B. Real machine** | v86 + the `dt-kernel` 6.12 LTS i686 kernel + the `lab-debian` root (Debian 12 bookworm i386 with systemd); starts from a saved snapshot | Desktop or laptop, ≥ 4 GB RAM; Chrome, Firefox, Safari | Modules M8–M16, all drills with systemd, disks, isolation, ssh; all exams of the block |
| **C. Real VM** | A real VM in the learner's own cloud account or on their own computer (09 §5) | Cloud | The `linux.exam.cloud` exam (optional); after that — the Kubernetes block |

Tiers A and B are shown through one terminal (section 6.0) and one side panel of diagrams. The A → B transition happens without losing work: the Stand's home directory is written into 9p before the machine starts (`Machine.files.put`, 09 §1.5), and after start the agent applies the manifest `/run/trainer/home.manifest` (path, mode, uid, gid) via `chown`/`chmod`, because `create_file` in 9p does not carry the owner and mode. In CI the transition is verified by comparing `stat` before and after: otherwise lesson M5 "permissions" on tier B would start with a wrong picture.

### 1.2. Why exactly this: options considered

**v86** ([github.com/copy/v86](https://github.com/copy/v86), BSD-2-Clause). Emulates 32-bit x86 and translates machine code into WebAssembly. Provides everything the trainer needs: `save_state`/`restore_state`, service UARTs (`uart1`) for the agent, 9p over virtio with the `create_file`/`read_file` API, `hda`/`hdb` disks, and a network card whose frames can be handed to our own switch (section 1.5). Limitations that affect lessons: only 32-bit kernels, **one virtual CPU** (`nproc` is always 1; multi-core examples are shown on recorded snapshots of a real server), and the v86 9p server **does not support extended attributes**: `Txattrwalk` answers `EOPNOTSUPP`, and writes to an xattr fid are rejected (checked against `lib/9p.js` on 18.11.2026). Therefore ACLs, file capabilities, `chattr` and an overlayfs upper layer on the root do not work; section 1.3 gives them separate file systems. The engine version number and size budgets are fixed in one place — 09 §1.4. We take it.

**WebVM / CheerpX** ([github.com/leaningtech/webvm](https://github.com/leaningtech/webvm)). Faster than v86, but the CheerpX license ([cheerpx.io/docs/licensing](https://cheerpx.io/docs/licensing)) is free only for individuals, one-person companies and FOSS projects when the engine is loaded from the Leaning Technologies domain; self-hosting and commercial use require a license on request. In addition, CheerpX emulates system calls rather than the kernel: systemd as PID 1, namespaces, cgroups and `mount` of a second disk do not work there as on a server, and that is the core of modules M11–M15. We do not take it.

**container2wasm** ([github.com/container2wasm/container2wasm](https://github.com/container2wasm/container2wasm), Apache 2.0). Experimental, slow, one image rather than an engine. We do not take it for Linux.

**JSLinux** ([bellard.org/jslinux](https://bellard.org/jslinux/)). A page, not a library: no API for snapshots, a service channel or checks. We do not take it.

**linux-wasm** ([github.com/joelseverin/linux-wasm](https://github.com/joelseverin/linux-wasm), [lwn.net/Articles/1044787](https://lwn.net/Articles/1044787/)). A kernel built into WebAssembly, without an MMU, BusyBox only, no systemd. We do not take it; we re-check every six months.

**Wasm-BusyBox / WASI**. No `fork`, permissions, users or processes as entities — exactly what we teach. We do not take it.

**Pure JS simulator**. This is not Linux, and a command outside the supported set breaks the illusion. But it gives an instant start on a phone, full control over output (we can avoid showing what has not been introduced yet) and synchronous events for diagrams — exactly what a beginner needs in the first hours. We take it as tier A, keep it narrow (section 3) and check it against real Debian in CI.

Decisions we borrow: [sandbox.bio](https://github.com/sandbox-bio/sandbox.bio) (terminal in the browser, exercises), [SadServers](https://sadservers.com/scenarios) (checking the state of a broken server with a script rather than the command history), [OverTheWire Bandit](https://overthewire.org/wargames/bandit/) (a ladder of small tasks on files and permissions), [Killercoda](https://killercoda.com/) (steps, each with a check), [explainshell.com](https://explainshell.com/) (breaking a command into parts), [env86](https://github.com/progrium/env86) (snapshots around v86).

### 1.3. The `lab-debian` image

The root is built from a Dockerfile based on `i386/debian:bookworm-slim`, following the pattern of `tools/docker/debian` from v86, without graphics. Debian 12 was chosen because release 13 no longer builds an i386 kernel and installer, while bookworm is supported by Debian LTS until mid-2028; this family (Debian/Ubuntu) is what the learner is most likely to meet at their first job. Alpine remains the root of the containers block (`lab-alpine`, 09 §1.4); it does not suit the Linux block: OpenRC instead of systemd, BusyBox instead of GNU coreutils.

**Kernel** — the shared `dt-kernel` from 09 §1.4; the `linux-image-686` package is not installed into the image. For the Linux block the kernel configuration must include (a request to 09, verified by the image test): `EXT4_FS`, `EXT4_FS_POSIX_ACL`, `EXT4_FS_SECURITY` (ACLs and capabilities on ext4), `TMPFS`, `TMPFS_XATTR` (overlay upper layer on tmpfs), `MSDOS_PARTITION`, `ATA`/`BLK_DEV_SD` (disks `hda`, `hdb`), `MEMCG`, `CGROUP_PIDS`, `CFS_BANDWIDTH`, `NAMESPACES`, `USER_NS`, `PID_NS`, `UTS_NS`, `NET_NS`, `OVERLAY_FS`, `SECCOMP_FILTER`, `IKCONFIG_PROC`, `SECURITY_DMESG_RESTRICT=y` (as in Debian: `dmesg` without sudo answers `Operation not permitted`, and this is the example of the `CAP_SYSLOG` privilege in M15). Theory texts and "golden recordings" are captured from `lab-debian` on `dt-kernel`, not from plain Debian: the output of `uname -r` and some `dmesg` messages differ between them.

**Documentation in the image.** In Debian slim images dpkg is configured not to install `/usr/share/man/*` and `/usr/share/doc/*` (the file `/etc/dpkg/dpkg.cfg.d/docker`), so the first step of the Dockerfile removes this file, and only then are packages installed. Installed are `man-db`, `manpages`, `manpages-dev` (sections 2 and 7: `clone(2)`, `namespaces(7)`, `cgroups(7)`, `capabilities(7)`, `pid_namespaces(7)`, `user_namespaces(7)`, `seccomp(2)`, `pipe(7)`, `signal(7)`), `groff-base` for rendering pages, and all pages of the installed packages; at the end of the build `mandb` is run so that `apropos` and `man -k` work. This is tens of megabytes, but 9p loads files lazily, and they do not count against the "until the first prompt" budget. Image test: `man -w ls journalctl systemd.unit systemd.exec systemd.resource-control journald.conf sshd_config 5\ crontab capabilities namespaces cgroups pipe` — every page is found.

**Packages** (`--no-install-recommends`): `systemd-sysv`, `bash`, `bash-completion`, `coreutils`, `util-linux` (in bookworm it contains `lsns`, `nsenter`, `unshare`, `findmnt`; checked against the package file list), `procps`, `psmisc`, `htop`, `less`, `nano`, `vim-tiny`, `man-db`, `manpages`, `manpages-dev`, `groff-base`, `sudo`, `acl`, `attr`, `libcap2-bin` (`capsh`, `getcap`, `setcap`, `getpcaps`), `busybox-static` (a root for `chroot` without copying libraries), `file`, `tree`, `jq`, `lsof`, `strace`, `iproute2`, `iputils-ping`, `curl`, `netcat-openbsd`, `openssh-server`, `openssh-client`, `cron`, `logrotate`, `nginx-light`, `e2fsprogs`, `fdisk`, `gawk`, `sed`, `grep`, `findutils`, `tar`, `gzip`, `shellcheck`. `dnsmasq` and `dnsutils` are not part of the Linux block image: DNS is introduced by the "Networks" block (03, N8), and machine names in M16 are set in `~/.ssh/config` (`Host server` → `HostName 10.0.0.20`), which is itself part of the lesson. Users: `root` and `student` (uid 1000, in the `sudo` group, autologin on `ttyS0`). Locale `C.UTF-8`.

**Teaching programs** — static i386 binaries from `tools/lab-bins/`, built in CI, with open source code; each has `--help` and a `man` page in section 1: `threads-demo N` (N threads named `worker-1…N`), `burner` (CPU load, `nice 10` by default so the machine stays responsive; `yes` remains only on the Stand), `leaky` (grows by N MB/s, touching every page), `memhog N` (allocates N MB at 1 MB per second and prints a counter), `spawner N` (spawns N `sleep` children), `sigdemo` (prints received signals; `--no-handler` flag), `zombie-demo`, `web-demo` (listens on a given port), `orders-server` (reads settings from the file given by the `--config` flag), `legacy-agent` (keeps a log open), `noisy` (writes to stdout and stderr).

**Machine file systems.** The root stays on 9p: this gives direct reading of the FS from JavaScript (`fs-probe`, section 4.2), a live tree without load on the guest, and the A → B transition through `files.put`. What 9p cannot do is moved to real file systems:

| Where | What it is | What for |
|---|---|---|
| `/` | 9p | Everything that does not require xattr and an honest `df` |
| `/srv` | ext4 on `hda` (256 MB, sparse image, mounted via `fstab`) | ACLs (M5), shared team directories (M5, access exam), file capabilities (M15), `chattr` (M13), exam data |
| `/lab`, `/run`, `/tmp` | tmpfs (`tmp.mount` enabled; `/lab` — `size=64m`) | overlay, a `chroot` root from busybox (M15); things that must disappear on reboot (M13) |
| `/dev/sdb` | an empty 64 MB `hdb`, created in the browser as an empty buffer | Module M13: partition, create an FS, mount |
| `/var` (only in the `linux.exam.disk` snapshot) | ext4 on a 160 MB `hdb` | The "partition is full" exam (section 8.3) |

Image test in CI on every starting snapshot: `setfacl -m u:nobody:r /srv/t && getfacl /srv/t`, `setcap cap_net_bind_service=+ep /srv/t && getcap /srv/t`, `chattr +i /srv/t && lsattr /srv/t`, `mount -t overlay` with the upper layer on `/lab`; and a negative test: the same commands on 9p fail with the text that the drills show in the explanation ("this FS does not store attributes"). Why `findmnt /` shows `9p` with the source `host9p` is explained in M13 with one card: "the root of this training machine comes from the browser over the 9p network protocol; on a server there would be a disk partition here".

Machine parameters: `memory_size` 256 MB (the two M16 machines get 128 MB each, verified on the spike; fallback 192 MB), `cmdline: "rw init=/bin/systemd root=host9p rootfstype=9p rootflags=trans=virtio,version=9p2000.L console=ttyS0 spectre_v2=off pti=off init_on_free=on quiet"`. `init_on_free=on` zeroes freed memory, and the snapshot compresses noticeably better.

**Budgets** for size and time are shared by all images and recorded in 09 §1.4 (snapshot ≤ 40 MB, files until the first prompt ≤ 15 MB, first visit ≤ 15 s, repeat visit ≤ 4 s, a tab with one machine ≤ 600 MB). The Linux block adds two rules. Files created by the learner on 9p live in the tab's memory: when such files reach 64 MB, a warning appears above the terminal. Blocks written to `hda`/`hdb` in CI go into the snapshot, so disk fill for exams is written as repeating blocks (zeros, repeating log lines) that zstd compresses down to kilobytes; the snapshot size with a disk is verified on the spike (section 11).

The snapshot is built in CI according to 09 §1.4 (the `TRAINER_READY` marker, `sync; echo 3 > /proc/sys/vm/drop_caches`, `save_state()`). Each drill defines its own starting snapshot: the base one plus the scenario's preparation script, run in CI. The learner gets an already broken machine in seconds. The boot log in such a snapshot is the CI boot; after `systemctl reboot` (drills with a reboot) the learner sees their own boot, and explainer X1 suggests comparing them.

### 1.4. Saving work

Machine snapshots are stored in OPFS following the 09 scheme (`/vm/<image>@<version>/<lab>/{latest,prev}.zst`). The 9p state is part of the snapshot, so one `save_state()` saves both memory and disk. Rules: a snapshot is written after every successful step check, when leaving the page (`visibilitychange` → `hidden`, no more than once per 60 s) and on the "Save" button; the latest snapshot and the "before the last check" snapshot are kept ("Roll back step" button); "Reset machine" restores the scenario's starting snapshot. Before the first write `navigator.storage.persist()` is requested. If storage is unavailable (private window), the machine lives until the tab is closed, and the trainer says so in one line above the terminal. When the image version changes, old snapshots are not restored: `/home/student` is extracted from them and carried over into the new one. The Stand's state is a CBOR snapshot from 09 §1.3.

### 1.5. Machine networking and several machines in the browser

By default the machine does not see the internet (09 §1.6). `apt` works through the `fetch` backend and the course mirror (`http://apt.lab/` → CDN). Outbound access through the Wisp relay is not needed in the Linux block: lessons on `curl` and `dig` against the real world moved to the "Networks" block.

**Several machines** are connected not through `inbrowser` but through our own `vswitch` switch. The mechanism is shared by blocks 02, 03, 05, 06 and described in 09; the Linux block needs the following from it:

- each machine runs in its own Web Worker; frames of the v86 network card leave the worker through a `MessagePort` (the buffer is transferred without copying) to `vswitch`, which learns a MAC → port table with 300 s aging, floods broadcast and unknown frames, can disable a port and drop every Nth frame (for "break it"), and mirrors a port into a pcap buffer;
- every frame is published as a `net.packet` event on the 08 §3.0 bus, so the M16 diagram shows an ssh connection as dots moving along port lines rather than as an abstract arrow;
- M16 and the `linux.exam.access` exam run on two nodes (`laptop` 10.0.0.10, `server` 10.0.0.20) with 128 MB of guest memory each; addresses are assigned statically by `systemd-networkd` in the starting snapshot, so DHCP is not needed before the "Networks" block;
- v86 does not run on a phone (section 1.6), so multi-machine lessons on a phone are available only in the explainer's recorded mode.

### 1.6. Devices

`navigator.deviceMemory` exists only in Chromium-based browsers; in Firefox and Safari it is `undefined`. Rule: if `deviceMemory` is defined and less than 4, or the device is a phone (`isPhone` from Sankofa), tier B is not started automatically; if `deviceMemory` is not defined, before the first machine start the trainer asks for confirmation in one line and states the download size. Instead of the machine, the recorded explainer mode, the Stand (if the module allows it) or handing the lesson over to a computer via QR (`engine/qr.ts`; the code contains the lesson address and step number; machine state is not transferred via QR) are offered.

---

## 2. Levels and the entry check

### 2.1. What each level means in the Linux block

Level definitions — 01 §4.3: **L0** works only through a graphical interface; **L1** has opened a terminal, moved around directories and installed packages following instructions, but is not confident about permissions, streams, processes; **L2** works in the terminal daily, writes simple scripts, but does not know systemd, logs, `/proc`, the kernel. An L0 example is a salesperson moving into DevOps; an L2 example is a programmer who has deployed following instructions.

| | L0 | L1 | L2 |
|---|---|---|---|
| Route | All modules in order, from M0 | M0–M3 are closed by a check; route from M4 | M0–M9 are closed by a check; route from M10; M5, M8, M9 — only the "for L2" submodules and drills |
| Tier | M0–M7 on the Stand, from M8 on the machine | From M4 directly on the machine | Machine from the first module |
| Isolation and kernel modules (M14, M15) | Mandatory, reduced depth (section 5.4) | In full | In full plus user namespace and seccomp by hand |
| Lesson anatomy (01 §7) | Hook → watch → try → explanation → practice S0→S3 | S1→S4 | Task first, explanation based on the attempt's result, S3→S5 |
| Documentation ladder | From rung 1 | From rung 2 starting with M4 | From rung 3 from the first module of the route |

### 2.2. Entry check

Its structure, composition, thresholds, confidence mark ("I know / I think / a guess"), repetition after 72 hours and the task bank — 01 §4.1–4.3 and 10 (`content/bank/linux/placement/`). The Linux block does not introduce its own check system. Recorded here is only what depends on the tier, and the task variants that 02 contributes to the bank.

**Tiers.** The L1 check runs entirely on the Stand (tasks 1–8 of 01 §4.3). The L2 check runs on the machine: tasks 1 (broken service), 2 (the `top3.sh` script with hidden tests), 4 (a directory larger than 1 GB — on a snapshot with a filled `/srv`) and 6 (cron) — each with its own starting snapshot; theory and explanation are in the same window without a machine.

**Variants for the bank** (each tagged with graph concepts; format — 01 §4.2):

| For task in 01 | Variant | Format and answer |
|---|---|---|
| L1, 2 | "You are in `/home/anna/projects`. Go up two levels and print the path" | `practical`, checked by `cwd=/home` and the last `pwd` (L04) |
| L1, 6 | The paths `docs/a.txt` and `/docs/a.txt` | `match`: relative (from the current directory) / absolute (from the root) (L04) |
| L1, 6 | What makes the line `rm -rf ~ /old-project` dangerous | `choice`: because of the space there are two arguments, and the home directory is deleted. An example with `/` is not used: GNU `rm` works with `--preserve-root` by default and refuses to delete the root (L06) |
| L1, 7 | `-rw-r----- 1 anna dev 120 report.txt`: bob from group dev | `choice` of the pair "modify no / read yes" (L11) |
| L1, 7 | The number for `rwxr-x---` | `number`: `750` (L11) |
| L1, 3 | `echo hello > f.txt; echo world >> f.txt; wc -l < f.txt` | `number`: `2` (L14) |
| L1, 8 | `export PATH=/opt/bin` "breaks" `ls` | `choice`: the list of search directories is replaced entirely, `/usr/bin` dropped out (L16) |
| L2, 1 | "`report.service` fails on start; fix it so it works and starts at boot" | `practical`; the breakage — `/usr/local/bin/report` has no `x` bit. Check: `units[report.service].active=active && units[report.service].enabled=enabled`; the file mode contains `x` for the owner; the `ExecStart` line was not replaced (hash matches the original) (L23, L11) |
| L2, 7 | Where `ps` gets the process list from | `choice`: from `/proc` (L26) |
| L2, 8 | SIGTERM, SIGKILL, SIGHUP, SIGTSTP — with behavior | `match`; TSTP (Ctrl+Z) can be caught, KILL and STOP cannot (L18) |
| L2, 9 | `set -euo pipefail` and `grep foo missing.txt \| wc -l` | `choice`: because of `pipefail` the pipeline's exit code is 2, because of `-e` the script exits (L21) |
| L2, 7 | load average `4.00 3.50 2.10` on 2 cores | `choice` among similar wordings; correct: "on average about four processes over the last minute were running or waiting for the CPU or disk (state D); for two cores this is overload, and load is growing; look at `wa` and processes in D". Wrong: "the CPU queue is twice the number of cores" (D forgotten), "the CPU is 400% loaded" (L26) |
| L2, 1 | `df -h` shows `/` at 100%, but `du -sh /*` adds up to less | `choice`: a deleted file is still held open by a process; look with `lsof +L1` (L25) |
| L2, 10 | A new "explain" task for R6 | `explain`: "Why does `kill -TERM` from the host not stop a process that became PID 1 in a new PID namespace, while `kill -KILL` does?" Rubric: for a namespace's init, the kernel delivers from ancestors only signals for which it has a handler; `sleep` has no TERM handler; SIGKILL and SIGSTOP from ancestors are delivered forcibly (`pid_namespaces(7)`) (L42, L35) |

The question about `authorized_keys` with mode `666` goes into the level check of the "Networks" block (where SSH is) — per 01 §4.3 the Linux check does not contain SSH.

---

## 3. Tier A: the Stand

### 3.1. Model

The Stand is the `sim/stand` module in `sim.worker.ts` (09 §1.3), a pure model without DOM, following the pattern of `features/model.ts` from Sankofa: the same model runs in tests and in CI. State:

```ts
interface Inode {
  ino: number;
  type: 'file' | 'dir' | 'symlink';
  mode: number;          // 0o755 etc., plus setuid/setgid/sticky bits
  uid: number; gid: number;
  nlink: number;
  size: number; mtime: number;
  data?: string;         // file: text (binary files are a stub with size)
  entries?: Record<string, number>; // directory: name -> ino
  target?: string;       // symlink
}
interface Proc { pid: number; ppid: number; uid: number; comm: string; args: string[];
  state: 'R' | 'S' | 'T' | 'Z'; cpu: number; rss: number; handlers: Partial<Record<Signal, 'ignore'|'exit'|'reload'>> }
interface World { inodes: Map<number, Inode>; procs: Map<number, Proc>; env: Record<string,string>;
  cwd: string; user: number; history: HistoryEntry[]; clock: number }
```

Users and groups are not stored separately: the Stand reads `/etc/passwd` and `/etc/group` from its own FS, so `cat /etc/passwd` and `id` are always consistent. Permissions are checked by a single function `access(world, uid, path, op)`, and the same function draws the check path in explainer X5 and computes the `access[...]` fact for checks (section 4.3): the explanation, the behavior and the grading cannot diverge.

The Stand's processes are props with behavior: `sshd`, `cron`, `nginx` (master + 2 workers), the learner's `bash`, and `sleep` and `yes`, which the learner starts. `yes > /dev/null &` raises `%CPU` in `top`, `kill -STOP <pid>` moves it to `T`, `pkill -HUP -o nginx` (or `kill -HUP $(cat /run/nginx.pid)`) writes to `/var/log/nginx/error.log` the line `[notice] ...: signal 1 (SIGHUP) received from <pid>, reconfiguring`. `kill` with a name instead of a number gives the real bash error: `bash: kill: nginx: arguments must be process or job IDs`.

### 3.2. Command parsing

A subset of bash is supported: simple commands, arguments, single and double quotes, `\` escaping, variables `$VAR`, `${VAR}`, `$?`, `$HOME`, `~`, glob patterns `*`, `?`, `[abc]`, pipelines `|`, redirections `>`, `>>`, `<`, `2>`, `2>&1`, `&>`, lists `;`, `&&`, `||`, background execution `&`, assignment `VAR=value`, `export`. Command substitution `$(...)`, loops, functions and `if` are not supported: the Stand answers "This is part of the bash language; we will get to it in module M9 on a real machine" and offers to move to tier B. Each line is parsed into a tree (`Pipeline → Command → Word | Redirect`), which the "command anatomy" diagram (section 6.1) receives before execution.

### 3.3. Stand command list

Flags missing from the table give an honest message: "In real Linux `ls` has the `-R` flag; in the simplified Stand it does not. Open a real machine?" — rather than an imitation of a GNU error.

| Group | Commands and flags |
|---|---|
| Navigation | `pwd`; `cd` (`-`, `~`, `..`); `ls` (`-l -a -h -d -i -1 -t -r -S`, `--sort=size`); `tree` (`-L N -a -d`) |
| Files | `touch`; `mkdir` (`-p -v`); `rmdir`; `cp` (`-r -i -v -p`); `mv` (`-i -v`); `rm` (`-r -f -i -v`, refusal on `/` as in GNU); `ln` (`-s`); `stat`; `file` |
| Viewing | `cat` (`-n`); `less` (paging, `/search`, `n`, `q`); `head`/`tail` (`-n N`, `-f`); `wc` (`-l -w -c`) |
| Editor | `nano` (arrows, `Ctrl+O`, `Ctrl+X`, `Ctrl+W`) |
| Help | `man` (the real text of Debian pages for Stand commands; shortening is allowed only by removing a whole section, marked "section omitted in the Stand"; translated captions go on top, not instead), `man -k`/`apropos` over these pages, `help`, `--help` for every command (the real GNU text), `type`, `which`, `whatis` |
| Users | `whoami`; `id`; `groups`; `who`; `sudo` (password `student`, log in `/var/log/auth.log`); `su`; `useradd` (`-m -s -G`); `usermod` (`-aG`); `passwd`; `groupadd` |
| Permissions | `chmod` (numeric and symbolic mode, `-R`); `chown` (`user:group`, `-R`); `chgrp`; `umask` |
| Text | `echo` (`-n -e`); `printf`; `grep` (`-i -v -n -c -r -E -o -w -l`); `sort` (`-n -r -k -t -u`); `uniq` (`-c -d`); `cut` (`-d -f -c`); `tr`; `tee` (`-a`); `diff` (`-u`); `sed` (only `s/a/b/[g]`, `-n`, `p`, `d`, `-i`); `awk` (`-F`, `{print $N}`, `NR`, `NF`, a condition before the block, `END{}` with a sum); `sha256sum` (`-c`) |
| Search | `find` (`-name -iname -type f/d -size -mtime -newer -user -perm -maxdepth -exec ... {} \;`); `xargs` (`-n`) |
| Environment | `env`; `printenv`; `export`; `unset`; `alias`; `source` (only `~/.bashrc`); `history`; `clear` |
| Processes (introduction) | `ps` (`aux`, `-ef`, `-o pid,ppid,stat,comm`, `-C`); `pstree` (`-p`); `top` (`q`, `k`, `P`, `M`); `kill` (`-l`, `-TERM -KILL -HUP -STOP -CONT`, numbers, `%N`); `pkill`; `pgrep`; `killall`; `jobs`; `fg`; `bg`; `sleep`; `yes`; `Ctrl+C`, `Ctrl+Z` |
| System (introduction) | `uname` (`-a -r`); `hostname`; `date`; `uptime`; `free` (`-h`); `df` (`-h`); `du` (`-sh`) |
| Archives | `tar` (`-c -x -t -z -f -v -C`); `gzip`/`gunzip` |

86 commands in total. Anything related to systemd, disks, the kernel, isolation, ssh, packages and scripts is not imitated by the Stand: those modules run on tier B, and a simulation there would give a false picture.

### 3.4. Checking against real Linux

In CI every command from the table is run on a reference FS in two places: in the Stand and in `lab-debian` (the same coreutils 9.1, grep 3.8, sed 4.9, gawk 5.2). Output is compared with normalization of dates, PIDs and `ls` order by `LC_ALL=C`; error messages are compared too (this is how `kill <name>` is caught). A mismatch fails the build. The comparison set is 600+ commands collected from all drills and theory examples.

---

## 4. Tier B: machine, agent, checks

### 4.1. Machine interface

The `Machine` interface — 09 §1.5 (`kind: 'sim' | 'v86'`, `tty()`, `events()`, `facts(scope)`, `snapshot()`, `files`). The Linux block uses it as follows: live diagrams subscribe to `events()`; the event for each executed line is `cmd.done {line, exit, cwd, user}` on the 08 §3.0 bus; the "snapshots" of the previous version of the document are expressed as fact scopes: the FS tree — `files`, processes — `procs`, services — `units`, mounts — `mounts`, ports — `net.listen`.

### 4.2. Service agent

Console parsing is not used: `ttyS0` mixes program output, ANSI sequences, input echo and kernel messages. The agent is `trainer-agent` from 09 §1.4 (POSIX sh, arrives over 9p from `/opt/trainer/`, protocol `op: facts` / `op: watch` over `ttyS1`). The Linux block adds three requirements to it.

1. **Protection from being stopped.** The `trainer-agent.service` unit has `RefuseManualStop=yes` and `Restart=always`, with the description "Trainer service unit: answers checks". The learner sees it in `systemctl list-units` but cannot stop it by accident; if it does crash, systemd restarts it on its own, and the trainer does not need to type commands into someone else's input.
2. **Command events do not block the shell.** `/etc/profile.d/trainer.sh` sets `PROMPT_COMMAND`, which appends a JSON line `{line, exit, cwd, user, ts}` to the regular file `/run/trainer/events.log` (tmpfs, mode `0622`; `>>` into a file does not wait for a reader). The agent reads it via `tail -F` and truncates it at 1 MB. A named pipe is not used: opening a FIFO for writing blocks until there is a reader, and with a crashed agent the shell would hang after every command. CI test: stop the agent with `kill -STOP`, run 10 commands; each finishes within 50 ms.
3. **Facts that are not in `dt.facts/v1`.** The list of requests to 09 is in section 4.4.

Root files are read from JavaScript without the agent: the v86 9p FS lives in the page's memory, and `fs-probe` (a wrapper over the internal v86 API with tests for each version) returns content, mode, owner and type. The live tree (section 6.2) works through it without load on the guest. Limitations: a write that the guest has not flushed yet may not be visible (before checking files the agent runs `sync`); `/srv`, `/lab`, `/proc` and `/sys` are not on 9p, so their tree is built through the agent on request and only for expanded branches.

### 4.3. Checks: the 09 format

The check format is `goals` from 09 §2.4 (`needs`, `when` over facts, `keep`, `fail`, `probe`). The Linux block has no predicate vocabulary of its own. The principle is unchanged: the result is checked, not the ritual; `chmod 750` and `chmod u=rwx,g=rx,o=` give the same mode and are graded the same. The command history is needed only for hints and remarks (`soft`).

A complete drill example:

```yaml
id: linux.m05.drill.2
lesson: linux.permissions-dirs
tier: v86                  # sim | v86 | any
levels: [L0, L1]
ladder: { start: { L0: S0, L1: S1 }, doc: doc2 }
setup:                     # script run in CI in the starting snapshot
  - run: groupadd dev && useradd -m -G dev alice && useradd -m -G dev bob && useradd -m eve && install -d -m 0755 /srv/team
title: { ru: "Общая папка команды", en: "A shared team folder" }
task:
  ru: "Сделайте каталог /srv/team, в котором участники группы dev могут создавать и читать файлы, а остальные не видят ничего."
  en: "Make /srv/team a place where members of group dev can create and read files and nobody else can see anything."
goals:
  - id: g-team-dir
    say: { ru: "Каталог /srv/team: группе dev — rwx, остальным — ничего", en: "..." }
    needs: [files:/srv/team]
    when: "files['/srv/team'].group=dev && files['/srv/team'].perm.g=rwx && files['/srv/team'].perm.o='---'"
    fail:
      - if: "files['/srv/team'].group!=dev"
        say: { ru: "Группа каталога всё ещё root: группу меняет chgrp или chown :dev", en: "..." }
        term: L11
      - if: "files['/srv/team'].perm.o!='---'"
        say: { ru: "У «остальных» остались права: последняя цифра режима должна быть 0", en: "..." }
        term: L11
  - id: g-team-behaviour
    say: { ru: "alice может создать и прочитать файл, eve не может даже посмотреть список", en: "..." }
    needs: [access]
    when: "access[user=alice][path='/srv/team'][op=w]=allow && access[user=eve][path='/srv/team'][op=r]=deny"
hints: [H1, H2, H3]        # texts of hints H1–H5 per 01 §14.2 live in the task; no points
doc:                       # rung 2: a page fragment
  - { page: "chmod(1)", section: DESCRIPTION, line: "The letters rwxXst select file mode bits for the affected users", url: "https://manpages.debian.org/bookworm/coreutils/chmod.1.en.html" }
soft:
  - { history_absent: "chmod -R 777", note: { ru: "777 открывает каталог всем — ровно то, чего просили избежать.", en: "..." } }
```

How checks that were separate predicates in the previous version are expressed:

| Was | Now (09) |
|---|---|
| `path_mode {mask, equals}` | `files[p].perm.u/g/o` (an `rwx` string), `perm.setuid/setgid/sticky` — new fact fields |
| `as_user {user, run}` for permissions | The fact `access[user][path][op] = allow/deny`: on the Stand it is computed by `access()`, on v86 by the agent via `runuser -u <user> -- test -r/-w/-x` |
| `as_user` for an action (`sudo -n systemctl restart orders`) | `probe: { as: maria, run: "...", expect_exit: 0 }`, `envs: [v86, vm]` |
| `survives_reboot` | `probe: { action: reboot, then: [<predicates>] }`, `envs: [v86, vm]` |
| `after_wait` | `probe: { action: wait, seconds: 300, then: [...] }` |
| `stdout_of {run, regex}` | `probe: { run: "sshd -T", stdout_regex: "..." }` |
| `→ file` (the learner's answer against a reference on the same machine) | `when: "files['~/x.txt'].text=@ref('<command>')"`: the `@ref` macro runs the reference command in the guest while collecting facts |
| `unit_property`, `cron_entry`, `fstab_entry`, `mounted` | `units[u].props.<Name>`, `cron[...]`, `fstab[...]`, `mounts[...]` — new and existing fact fields |
| `history_contains/absent` | only `soft` (`forbid` in 06 terms), as before |

`probe` in 09 is allowed only with `envs: [vm]` or `[v86, vm]`. This is enough for the Linux block: all checks on the Stand are expressed as observation (through the `access` fact), and actions (`as`, reboot, waiting) are needed only on the machine.

### 4.4. Request to 09: fact fields for Linux

The agent already collects this with the commands `stat`, `getfacl`, `getcap`, `lsattr`, `systemctl show`, `crontab -l`, `findmnt -J`, `blkid`; the fields need names in `dt.facts/v1`:

- `files[*]`: `perm {u, g, o, setuid, setgid, sticky}`, additional `type` values `c`, `b`, `p`, `s` (whiteout — a 0:0 character device), `rdev`, `caps`, `attrs`, `acl`;
- `access[user][path][op]` — a computed fact on request (`needs: [access]`);
- `units[*].props: Record<string,string>` via `needs: units:<name>:<props>` (`User`, `Restart`, `MemoryMax`, `TasksMax`, `CPUQuotaPerSecUSec`, `StartLimitBurst`, `SystemCallFilter`, `ProtectHome`, `CapabilityBoundingSet`, `FragmentPath`, `DropInPaths`); `units[*].restarts` already exists;
- `cron: {user, file, line}[]`, `fstab: {spec, file, vfstype, options}[]`, `blkid: {dev, uuid, type}[]`;
- `procs[*]`: `args`, `state`, `threads`, `nice`, `ioprio`, `root` (`readlink /proc/<pid>/root`), `capEff`, `seccomp`, `uidMap`;
- `uts: {ns, hostname}[]`;
- `cgroups[*]`: `pids.events`, `cpu.stat`, `memory.high`;
- `journal`: on request `{unit, since, regex} → {count, first, firstAt}`;
- `users: {name, uid, shell, home, groups}[]`; `mounts[*].free` (free FS space); `files[*].sha256tree` (directory tree hash);
- `env.hostname`, `env.nproc`;
- the `@ref(cmd)` macro: the reference command runs in the guest while facts are collected, and its output is compared with the learner's file (with whitespace normalization and, where specified, ignoring line order).

---

## 5. Textbook: the block's curriculum

### 5.1. Modules, concepts and order

Each module introduces only concepts whose prerequisites have already been introduced on every allowed path of the learner (01 §6.1). The "Concepts" column contains graph identifiers from 01: the module declares them in the `introduces` of its screens, the build checks the order, and texts, tasks, hints, output breakdowns and the AI mentor's context contain no word forms of concepts that do not exist yet. The "Explainer" column refers to storyboards in section 6, and the "Doc." column to the starting rung of the documentation ladder for L0 (section 7).

| Module | Tier | Concepts (01) | Commands | Explainer | Doc. | Levels |
|---|---|---|---|---|---|---|
| **M0. Computer, OS, terminal** | A | L01, L02 | `echo`, `date`, `whoami`, `clear`, `history` | X2, screen 1 (a line splits into words) | 1 | L0 |
| **M1. File tree and paths** | A | L03, L04, L05 | `pwd`, `cd`, `ls`, `tree` | live tree (6.2) | 1 | L0 |
| **M2. Files and archives** | A | L06, L07, L09, L29 | `touch`, `mkdir`, `cp`, `mv`, `rm`, `rmdir`, `cat`, `less`, `head`, `tail`, `nano`, `file`, `tar`, `gzip` | — | 1 | L0; the "Archives" lesson — L0, L1, L2 |
| **M3. Help and how to read documentation** | A | L08 | `man`, `man 5 crontab`, `/pattern` and `n` in `man`, `man -k`/`apropos`, `--help`, `help`, `type`, `which`, `whatis`, `info coreutils` | page anatomy (6.3) | 2 | L0 |
| **M4. Users and groups** | A | L10 | `id`, `groups`, `who`, `getent passwd`, `cat /etc/passwd`, `cat /etc/group` | — | 2 | L0, L1 |
| **M5. Permissions, root and sudo** | A; ACL — B | L11, L12 | `ls -l`, `chmod`, `chown`, `chgrp`, `umask`, `stat`, `sudo`, `su`, `useradd`, `usermod`, `groupadd`, `passwd`; L1/L2: setgid on a directory, sticky; L2: `getfacl`/`setfacl` on `/srv` | X5 | 2 | L0, L1, L2 |
| **M6. Streams, pipelines, text** | A | L13, L14, L15, L32, L30 | `>`, `>>`, `<`, `2>`, `2>&1`, `\|`, `wc`, `sort`, `uniq`, `cut`, `tr`, `tee`, `grep`, `sed`, `awk`, `find`, `xargs`, `diff`, `sha256sum` | X3 (layer 1) | 2 | L0, L1; the "File fingerprint" lesson — L2 as well |
| **M7. Environment and PATH** | A | L16 | `env`, `export`, `unset`, `alias`, `source`, `which`, `type`, quotes | X2, screen 2 (PATH) | 2 | L0, L1 |
| **M8. Processes, signals and the kernel** | A → B | L17, L18, L19, L34, L27 | `ps`, `pstree`, `top`, `htop`, `jobs`, `fg`, `bg`, `&`, `nohup`, `kill`, `pkill`, `pgrep`, `killall`, `echo $?`; the "kernel" lens with `strace` | X2 in full, X6 (screens 1–2), `top` breakdown (6.4) | 3 | L0, L1, L2 (L2 — shortened) |
| **M9. Bash scripts** | B | L20, L21, L31 (JSON part) | `bash`, `shellcheck`, `read`, `printf`, `test`/`[[ ]]`, `exec`, `jq` | — | 3 | L0, L1, L2 (L2 — shortened); the "JSON and jq" lesson — for everyone |
| **M10. Packages** | B | L22 | `apt update/install/remove/show/search`, `dpkg -l/-L/-S` | — | 3 | L0, L1 |
| **M11. Services and logs** | B | L23, L24; `forward: [N04]` | `systemctl status/start/stop/restart/reload/enable/disable/daemon-reload/cat/edit/list-units --failed`, `journalctl -u -f -b --since -p -n`, `systemd-analyze`, `logrotate` | X1, X4 | 3 | L0, L1, L2 |
| **M12. Scheduling** | B | L28 | `crontab -e/-l`, `systemctl list-timers` | — | 3 | L0, L1, L2 |
| **M13. Disks, file systems, mounting** | B | L25, L39 | `lsblk`, `blkid`, `fdisk`, `mkfs.ext4`, `mount`, `umount`, `findmnt`, `df`, `du`, `ln`, `lsof +L1`, `mount -t tmpfs`, `mount --bind` | X10 | 4 | L0, L1, L2 |
| **M14. The kernel from the inside: /proc, /sys, memory** | B | L26 | `cat /proc/<pid>/{status,cmdline,exe,fd}`, `/proc/loadavg`, `/proc/meminfo`, `dmesg`, `free -h`, `vmstat 1`, `strace -f -e trace=openat,execve,clone` | X2, the "kernel" layer in full | 4 | L0, L1, L2 |
| **M15. How the kernel isolates and limits** | B; `/lab` and `/srv` | L33, L35, L36, L37, L38, L40, L41, L42, L43 | `ps -eLf`, `top -H`, `/proc/<pid>/task`, `unshare`, `nsenter`, `lsns`, `readlink /proc/<pid>/ns/*`, `chroot`, `mount -t overlay`, `systemd-cgls`, `systemd-run -p`, `cat`/`echo` into `/sys/fs/cgroup/...`, `capsh`, `getpcaps`, `getcap`, `setcap`, `grep -E 'Cap\|Seccomp\|NSpid\|Threads' /proc/<pid>/status`, `systemd-analyze syscall-filter` | X6 (screen 3), X7, X8, X9, X5 (layer 2) | 4 | L0 (shortened), L1, L2 |
| **M16. The network from the machine's point of view, and SSH** | B, two machines; in the route — the last Linux module before the "Networks" block (decision 00 §10) | `linux.net-commands`, `linux.ssh-basic` (01: L42, L43) | `ssh`, `ssh-keygen`, `ssh-copy-id`, `scp`, `~/.ssh/config`, `sshd -t`, `sshd -T`, `systemctl reload ssh` | X11 | 4 | L0, L1, L2 |
| **M17. Your own machine in the cloud** | C (the learner's cloud or a local VM on their own computer), optionally — B | `linux.vps` (01: L44) | ordering a VM in the provider's console or CLI, `ssh-keygen`, `ssh -i`, security group, `ufw`/`nft` at the level of "close everything except 22", `apt upgrade`, deleting the VM | — (the `cost` and `cleanup` screens, 01 §7.4) | 3 | L0, L1, L2 |

**What is no longer in the block.** (Refined by decision 00 §10: network observation commands with everyday definitions were returned to the first lesson of M16; the models stay with the "Networks" block.) The former module "The network from the machine's point of view" (interface, IP, mask, route, port, socket, DNS, `/etc/hosts`, `/etc/resolv.conf`, HTTP) was removed: these are concepts N01–N14 of the "Networks" block, and 03 introduces them in its own order (N2–N11). Its quiz and the drill "who is listening on port 6379" are handed over to 03 (module N5). Before networking, the Linux block uses a port once, in M11: the `app` service listens on 8080, and the `forward: [N04]` card says "a port is a number on which a program on the machine waits for connections; which program listens on which port is shown by `ss -ltnp`; in detail — in the Networks block".

**Where networking and SSH sit (decision of master document 00 §10).** The first lesson of M16 brings back into the Linux block "the network from the machine's point of view" to the extent of observation commands (`ip a`, `ip r`, `ss -ltnp`, `ping`, `curl`, `dig`) with everyday definitions of interface, address and port — this is the `linux.net-commands` concept of graph 01. The models (subnets, routing, TCP, DNS) are introduced only by the "Networks" block, which links them to these commands with a `deepens:` relation (03 §3.1). The rest of M16 is SSH as a user (`linux.ssh-basic`: keys, `authorized_keys`, `known_hosts`, `~/.ssh/config`, `sshd_config`, the `ssh` log) on two machines, without the handshake and key exchange: SSH as a protocol is deepened by `net.m12` (`net.ssh-protocol`). M17 "Your own machine in the cloud" (`linux.vps`) closes the block: after it, the `linux.exam.cloud` exam, part B of the networks exam, "real Docker on a VM" (04 m13) and pet projects on a VPS become legitimate. Thus M16 and M17 come in the route before the "Networks" block, not after module N5 as in this revision.

**New and changed graph concepts** (request to 01; numbers L33–L41 — per the 01 author's review, L42–L43 — added here):

| ID | Concept | Requires | Module |
|---|---|---|---|
| L33 | Thread, TID, `/proc/<pid>/task` | L17, L26 | M15 |
| L34 | Process creation: fork and exec; inheritance of environment and descriptors; `exec` in the shell | L17, L16 | M8 (as a mechanism in X2), deepened in M15 (`clone` and its flags) |
| L35 | Namespace: what a process sees; kinds pid, mnt, uts, ipc, user, net, cgroup, time; `unshare`, `nsenter`, `lsns`, `/proc/<pid>/ns`; user namespace and `uid_map` | L27, L26, L25 | M15 |
| L36 | cgroup v2: how much a process consumes; memory, cpu, pids controllers; link to systemd (`MemoryMax=`, `CPUQuota=`, `TasksMax=`) | L26, L23 | M15 |
| L37 | OOM killer: global and inside a cgroup | L36 | M15 |
| L38 | Kernel privileges (capabilities); file capabilities | L12, L27 | M15 |
| L39 | **Change in 01:** "tmpfs and bind mount" (was "bind mount, chroot, pivot_root") | L25 | M13 |
| L40 | overlayfs: lowerdir, upperdir, workdir, merged, copy-up, whiteout | L39, L43 | M15 |
| L41 | seccomp (the idea): a system call filter, `SystemCallFilter=` | L27, L23 | M15 |
| L42 | **New:** PID 1: orphans and subreaper, the duty to reap zombies, special signal rules | L18, L34 | M8 (one phrase "usually to PID 1"), M15 (in full) |
| L43 | **New:** a process's root: `chroot`, the idea of `pivot_root`; why chroot is not isolation | L03, L12, L39 | M15 |

Related in the graph: L26 (`/proc` and `/sys`) requires L17 and L03, not L25 (`/proc` as a window into processes is understandable without mounting; the 01 author promised this fix). L27 (kernel, system call) is introduced in M8, not in M0: M0 does not talk about the kernel; the "operating system" does the work (F04). D03/D04/D05/D09 of the Docker block become "the same in Docker" with prerequisites on L35, L36, L43, L40; N21 (network namespace) requires L35. L31 (YAML and JSON): JSON and `jq` are introduced by M9, YAML by block 06; the concept needs to be split in two (request to 01).

**Concepts outside the entry check.** L29 (archives), L30 (checksum) and the JSON part of L31 are not tested by the 01 §4.3 entry check, so their lessons (`linux.archives`, `linux.checksum`, `linux.json`, 15–20 minutes each) stay in the L1 and L2 routes even where the module is skipped entirely. This way the Docker block gets `tar` (D08), `sha256sum` (D19) and JSON (D21) at all levels.

**Two spirals.** The pipeline (`|`) is introduced in M6 as "the output of one command becomes the input of another", without the word "process". In M8 the pipeline is shown again (the second layer of X3): each command is a process, and between them is a kernel buffer. Likewise, `top` is first shown in M8, but the memory and load fields are analyzed in detail in M14; the "kernel" lens opens in M8 with 3–4 system calls and fully in M14.

**Term order fixes** (found by the review and now checked by the build): in M5 the drill about an executable file says "the program `~/bin/backup`", not "script" (script and shebang come in M9), and runs it by the path `~/bin/backup`, not via `./` and `PATH`; in M6 the `noisy` program is also run by its full path; in the M4 quiz, instead of "the hash in `/etc/shadow`" it says "the password is stored in encrypted form in `/etc/shadow`, which only root can read" (hashing is introduced by M6); in M8 an orphan passes "to the system's first process, PID 1", and the name systemd appears in M11; in explainer X5 before M8 it says "the system checks", and "the kernel" from M8 on.

### 5.2. How a module is built

A module is a **textbook chapter** and the 2–5 lessons it is made of, plus drills and the module's final task.

**A textbook chapter** is a coherent text of 1,500–3,000 words in Sankofa's magazine layout (reading column, scroll scenes, calm mode, bilingual YAML, `draft`/`hold`). The chapter reads as one article from the hook to the conclusion; the lessons are the same chapter, sliced by the 01 §7 anatomy for practice. The lesson's "Explanation" screen and the chapter section are the same text, not two versions. Every statement in a chapter has two sources by the Sankofa rule (01 §7): the manual page for the version installed on the machine (`manpages.debian.org/bookworm/...`) and a check on `lab-debian`; without the second source the block gets `hold: true` and does not get into the build. At the end of the chapter is a "How we know this" block with links to exact places in the pages (this is rung 1 of the documentation ladder). The explainers of section 6 are embedded into the chapter as figures: scrolling drives the stepper, but the learner can take it in hand (08 §3.1). Chapter outlines are in section 5.3.

**A lesson** follows 01 §7: hook → watch → try ("predict what it will print", then run) → explanation → practice along rungs S0–S5 (01 §9) → exit ticket (2–3 tasks, one on transfer) → FSRS review queue. Screens are tagged with 08 kinds (`story`, `mechanism`, `lab`, `check`); no more than one concept is introduced per screen, and no more than four per lesson (01 §8). For L2 the order is different: the challenge task comes first, and the explanation follows from the result of the attempt.

**Drills** of a module are 3–6 tasks with a specified starting rung S for each level and an S5 "breakage" variant (section 8.2). **The module's final task** is a composite task without hints; modules M11, M13, M15 and M16 end with block exams instead (section 8.3).

### 5.3. Chapter outlines

For each chapter: the hook, statements in the order of presentation (each with an explainer or diagram and a primary source), and what the learner should be able to do after the chapter. Content authors write chapters from these outlines; the AI mentor receives the outline of the current chapter in its context instead of the full text.

**M0. Computer, OS, terminal.** Hook: "The team lead writes: log in to the server and check the date. Where are the buttons?" (1) A server usually has no screen or mouse; you talk to it in text. (2) A terminal is a window where you type; a shell is a program that reads the typed line and executes it (`bash(1)`, DESCRIPTION section). (3) A line consists of a command name and arguments separated by spaces (X2, screen 1). (4) A command prints a result — output — and shows the prompt again. (5) `history` remembers what was entered; the up arrow brings back a previous line. Can do: run a command with an argument and read the output.

**M1. File tree and paths.** Hook: "The logs are in /var/log — go take a look." (1) All files of a machine form one tree with the root `/`; there are no C: and D: drives (`hier(7)`, FHS 3.0). (2) A path is a file's address: absolute from the root, relative from the current directory. (3) `.` is the current directory, `..` the parent, `~` the home directory. (4) Files whose name starts with a dot are hidden from `ls` without `-a`. (5) The main directories and what is in them: `/etc` — settings, `/var/log` — logs, `/home` — users, `/usr/bin` — programs, `/tmp` — temporary files. Can do: reach any file in two ways.

**M2. Files and archives.** Hook: "Make a copy of the config before editing it." (1) Creating, copying, moving and deleting are four operations on names in the tree; `rm` does not put things in a trash bin. (2) The pattern `*.log` is expanded by the shell before the command runs (`glob(7)`). (3) An extension is part of the name, not the type; the type is shown by `file`. (4) Text is viewed with `cat`, `less`, `head`, `tail` and edited in `nano`. (5) A `tar` archive glues a directory tree into one file, preserving names, permissions and dates; `gzip` compresses (`tar(1)`). (6) `tar -C` extracts into the desired directory; `tar -tf` shows the contents without extracting. Can do: pack a directory and unpack it elsewhere without an extra nesting level.

**M3. Help and how to read documentation.** Hook: "At an interview they'll ask about a flag you never learned. What will you do?" (1) Every command has a manual page; `man ls` opens it in `less`, `/` searches, `n` goes to the next match. (2) A page is always structured the same way: NAME, SYNOPSIS, DESCRIPTION, OPTIONS, EXIT STATUS, FILES, EXAMPLES, SEE ALSO (`man-pages(7)`). (3) SYNOPSIS is the call grammar: `[ ]` — optional, `...` — can be repeated, `a|b` — one of. (4) Manual sections: 1 — commands, 5 — file formats, 7 — overviews, 8 — administrator commands; `man 5 crontab` and `man crontab` are different pages (`man(1)`). (5) If you don't know a command's name — `man -k word` (`apropos`). (6) Shell builtins (`cd`, `export`) are described in `help`, not in `man`; `type` tells you whether a command is a builtin. (7) GNU coreutils usually have no EXAMPLES section, and the full documentation is `info coreutils`; systemd and OpenSSH, on the contrary, have large pages, and the FILES and SEE ALSO sections are the most useful. Can do: find a flag by describing the action and explain a SYNOPSIS line.

**M4. Users and groups.** Hook: "Why don't you have access to the log when your colleague does?" (1) Every process and file belongs to a user; the system tells users apart by the UID number, and the name is for people. (2) A group is a named set of users with a GID number; a user has one primary group and several supplementary ones. (3) Accounts are described in `/etc/passwd` (seven fields separated by `:`), groups in `/etc/group` (`passwd(5)`, `group(5)`). (4) The password is stored in encrypted form in `/etc/shadow`, which only root can read. (5) `id` shows who you are to the system. Can do: read a line of `/etc/passwd` and say which groups a user is in.

**M5. Permissions, root and sudo.** Hook: "The site returns 403. The file is in place." (1) A file has an owner, a group and three triplets of `rwx` bits: for the owner, the group and others (X5; `chmod(1)`, `path_resolution(7)`). (2) The system checks exactly one triplet: owner → group → others, and the first one that matches decides. (3) For a directory, `r` means reading the list of names, `w` creating and deleting names, `x` entering and passing through; deleting a file depends on the permissions on the directory. (4) Octal notation: `r=4 w=2 x=1`; `umask` removes bits from new files. (5) root is the user with UID 0 for whom permission checks are skipped; `sudo` runs one command as root and writes this to the log (`sudo(8)`). (6) For L1/L2: setgid on a directory — new files get the directory's group; sticky — only the file's owner can delete it. (7) For L2: ACLs add permissions for individual users and groups beyond the three triplets (`acl(5)`; on `/srv`, because the training machine's root does not store ACLs). Can do: set up a shared team directory and explain a 403 caused by `x` on a parent directory.

**M6. Streams, pipelines, text.** Hook: "Find in the log which IPs get 500 most often." (1) Every command has three standard streams: input 0, output 1, errors 2 (`stdin(3)`). (2) `>` and `>>` direct output into a file, `2>` errors, `2>&1` errors to wherever the output is going right now, so the order of redirections matters (`bash(1)`, REDIRECTION). (3) `|` makes the output of one command the input of the next (X3, layer 1). (4) Filters: `grep` selects lines, `cut` fields, `sort` orders, `uniq -c` counts adjacent repeats — which is why `sort` goes before it. (5) A regular expression is a line pattern; `grep -E` enables the extended syntax (`regex(7)`). (6) `find` searches by file properties, `xargs` turns lines into arguments. (7) `sha256sum` gives a fingerprint of the contents: change one byte and the fingerprint is entirely different; `sha256sum -c` checks against a published list. Can do: build a pipeline for a question about a log and verify a downloaded file against its checksum.

**M7. Environment and PATH.** Hook: "I installed a program, but the terminal says command not found." (1) A shell variable is a name with a value; `$VAR` substitutes the value before the command runs. (2) An environment variable is a variable that launched commands receive; without `export` a launched command does not see it (`environ(7)`). (3) `PATH` is a list of directories in which the shell looks for a program by name, one after another; the first one found wins (X2, screen 2). (4) The current directory is not in `PATH`, so a program next to you is run as `./prog`. (5) Single quotes substitute nothing, double quotes substitute variables. (6) `~/.bashrc` runs at the start of every interactive shell; changes in it apply in a new shell or via `source`. Can do: add a directory to `PATH` permanently and explain `command not found`.

**M8. Processes, signals and the kernel.** Hook: "The server is slow; check what's eating the CPU." (1) A program is a file on disk; a process is a running program with a PID number, memory and open files (`ps(1)`). (2) Every process except the first is created by another — the parent (PPID); hence the tree (`pstree(1)`). (3) A new process is a copy of the parent (fork), into which another program is then loaded (exec); this is why the environment and redirections are inherited; the builtin `cd` is executed by the shell itself, without a new process (X2). (4) A process is almost always waiting (S), sometimes running (R), and can be stopped (T); one that has finished but has not been reaped by its parent is a zombie (Z); an orphan usually passes to PID 1 (`ps(1)`, PROCESS STATE CODES). (5) A signal is a short message to a process; the process handles most of them itself (a handler), but not SIGKILL and SIGSTOP; Ctrl+C sends SIGINT, Ctrl+Z SIGTSTP (`signal(7)`, X6). (6) An exit code is a number the process leaves to its parent; 0 means success; in the shell it is `$?` (`bash(1)`, EXIT STATUS). (7) The kernel is the part of the system that manages processes, memory and devices; a process asks it to act through system calls (`clone`, `execve`, `write`, `exit_group`) — this is the "kernel" layer in X2 (`syscalls(2)`, `intro(2)`). (8) `top` shows processes by load; `nice` and memory details come in M14. Can do: find a process by load, stop it politely, explain what happens between Enter and the output.

**M9. Bash scripts.** Hook: "Every morning you type the same five commands." (1) A script is a text file with commands; the first line `#!/bin/bash` (shebang) tells the kernel which program to run it with (`execve(2)`, the "Interpreter scripts" section). (2) Arguments arrive as `$1…$9`, `$@`, `$#`; `"$@"` preserves argument boundaries. (3) A command's return code is a condition: `if`, `&&`, `||`, `test`/`[[ ]]`. (4) `for` and `while read` loops; `for f in $(ls)` breaks on spaces — `for f in *` does not (ShellCheck SC2045). (5) `set -euo pipefail` turns silent errors into stopping the script; `trap` runs cleanup on exit. (6) `exec "$@"` at the end of a wrapper script replaces the shell with the launched program — the PID stays the same and there is no extra process (`pstree -p` before and after; a bridge to ENTRYPOINT in the Docker block). (7) Utilities and agents answer in JSON; `jq -r '.items[].name'` extracts fields (`jq(1)`). (8) `shellcheck` finds errors before running. Can do: write a script with arguments, a return code and error checks; read JSON.

**M10. Packages.** Hook: "Install nginx." (1) A package is an archive of a program with a description and a list of dependencies; the package manager installs it together with the dependencies (`apt(8)`). (2) A repository is a server with packages; `apt update` downloads the list, `apt install` the packages themselves; without `update` the package is "not found". (3) `dpkg -L` — which files a package installed, `dpkg -S` — which package a file belongs to. (4) The Red Hat family has `dnf`, Alpine has `apk` — a correspondence table without practice (the learner will see Alpine in the Docker block). Can do: install a package and find where a file came from.

**M11. Services and logs.** Hook: "After a reboot the site didn't come back up." (1) A service (daemon) is a program that runs in the background without a terminal. (2) systemd is the system's first process (PID 1); it starts services from unit files and watches over them (`systemd(1)`, X1). (3) A unit file: `[Unit]` — description and ordering (`After=`, `Wants=`), `[Service]` — what to run and as whom (`ExecStart=`, `User=`, `Restart=`), `[Install]` — which target to attach it to on `enable` (`systemd.unit(5)`, `systemd.service(5)`). (4) `start` — start now, `enable` — start at boot; after editing the file — `daemon-reload`; edits on top of a package's file — `systemctl edit` (drop-in). (5) Unit states and restarting a crashed service according to `Restart=` with the `StartLimitBurst=` limit (X4). (6) Everything a service writes to stdout and stderr ends up in the journal: `journalctl -u` shows it without any configuration (`StandardOutput=journal` by default, `systemd.exec(5)`) — `docker logs` will later do the same. (7) The journal is filtered by service, time, priority and boot; `/var/log` and `logrotate` are for programs that write files themselves. Can do: make a service out of a program, find the cause of a crash in the journal.

**M12. Scheduling.** Hook: "The backup has to run every night, and you're asleep." (1) cron runs crontab lines on a schedule of five fields: minute, hour, day of month, month, day of week (`crontab(5)`). (2) A command in cron runs without your environment: a short `PATH`, no `~/.bashrc`; hence full paths and redirecting output to a file. (3) `@reboot` — once at boot. (4) For L1/L2: a systemd timer is a `.timer` and `.service` pair, with logging and dependencies for free (`systemd.timer(5)`). Can do: schedule a task and check that it ran.

**M13. Disks, file systems, mounting.** Hook: "We added a disk, but there's no more space." (1) A block device is a whole disk (`/dev/sdb`); a partition is a part of it described by a partition table (X10, `fdisk(8)`). (2) A file system is a way of storing names and data on a partition; `mkfs.ext4` creates a superblock, an inode table and data blocks (`ext4(5)`). (3) Mounting attaches an FS at a point in the tree; the directory's old contents are hidden but not deleted (`mount(8)`). (4) `/etc/fstab` mounts at boot; a UUID is better than a device name because names change (`fstab(5)`). (5) An inode is a record about a file; a name is a link to an inode; a hard link is a second name, a symbolic link is a file with a path inside. (6) A deleted file lives as long as a process keeps it open; this is why `df` and `du` disagree (`lsof +L1`). (7) tmpfs is an FS in memory that disappears on reboot; a bind mount shows one directory at another place in the tree as well (`mount(8)`, the "Bind mount operation" section; a bridge to Docker volumes). Can do: attach a disk permanently, find where the space went.

**M14. The kernel from the inside: /proc, /sys, memory.** Hook: "Monitoring says: 90 MB of 2 GB memory free. Panic?" (1) `/proc` is not files on disk but a window into the kernel: a directory for each process (`status`, `cmdline`, `exe`, `fd`) and general information (`proc(5)`). (2) `/sys` holds devices and kernel settings; in M15 cgroups will be found there (`sysfs(5)`). (3) Memory: `free` distinguishes used memory, cache and `available` — how much can be obtained if the kernel frees the cache (`free(1)`). (4) Load average is the average number of processes that are running or waiting for the CPU or the disk (state D), over 1, 5 and 15 minutes; compare it with the number of CPUs (`proc(5)`, `/proc/loadavg`). (5) `strace` shows a process's system calls — the "kernel" layer of X2 in full (`strace(1)`). (6) Kernel messages are `dmesg`; on this machine it requires sudo (the `dmesg_restrict` setting; why — in M15). (7) The "Where you are" screen: `sudo dmesg | head`, `cat /proc/cpuinfo`, `cat /sys/class/dmi/id/sys_vendor`, `systemd-detect-virt` — the machine in the browser is emulated and has one CPU; the `forward: [D02]` card says "such a machine is called virtual; in detail — in the Docker block". The wording of this screen is captured from the machine on the spike. Can do: find everything about a process via `/proc`, read `free` and load average correctly.

**M15. How the kernel isolates and limits** — the outline and lessons are in section 5.4.

**M16. Linux on a remote server: SSH.** Hook: "You've been given a server: an IP, a login and 'log in with a key'." (1) ssh is a client that opens an encrypted channel to the `sshd` service on the server's port 22 and starts your shell there (`ssh(1)`, X11). (2) On the first login the client remembers the server key's fingerprint in `known_hosts`; a changed fingerprint is a reason to stop. (3) A key pair: the private key stays with the client, the public key is placed on the server in `~/.ssh/authorized_keys`; the server checks a signature, and no password is transmitted (`ssh-keygen(1)`). (4) sshd does not trust keys if `~/.ssh` or `authorized_keys` can be modified by someone else (`StrictModes`, `sshd_config(5)`). (5) `~/.ssh/config` stores server names, users and keys. (6) sshd settings are in `/etc/ssh/sshd_config` and `sshd_config.d/*.conf`; the first value found wins; `sshd -t` checks the syntax, `sshd -T` shows the effective result; the order "check key login → `sshd -t` → `reload`" keeps you from losing access. (7) For L2: port forwarding with `-L`. Can do: set up key login and disable password login without locking yourself out.

### 5.4. Module M15 "How the kernel isolates and limits"

This module is the foundation of the containers block (R6). The word "container" is not used in it (concept D06 is introduced by 04); the last screen is a `forward: [D06]` card: "In the Docker block you will see that all of this together is a container." It runs on tier B: overlay and `chroot` on the `/lab` tmpfs, file capabilities on the `/srv` ext4 (section 1.3).

**Chapter** (eight sections, each with an explainer):

1. **A process is neither a program nor a thread** (L33). Hook: "`top` shows a single `java` process at 380% CPU — how does one process occupy four cores?". A process's passport is `/proc/<pid>/status` (`Pid`, `PPid`, `Threads`, `Uid`, `NSpid`, `CapEff`, `Seccomp`). Threads share memory and open files; processes do not; a thread has its own TID, `ps -eLf` has the `LWP` and `NLWP` columns, and `/proc/<pid>/task/` has a directory per thread. An honest caveat: the training machine has one CPU, so "380%" is shown on a snapshot from a real server, while on the machine you see threads taking turns.
2. **How a process is born at the kernel level** (L34 in depth). `strace -f -e trace=clone,execve,wait4 bash -c 'ls /tmp'`: a process and a thread are created by the same `clone` call with different flags (`CLONE_THREAD` — a thread); `clone` also has `CLONE_NEW*` flags — a bridge to section 4 (X2, the "kernel" layer).
3. **The special process number 1** (L42). Orphans pass to the nearest ancestor that declared itself a subreaper (`PR_SET_CHILD_SUBREAPER`; `systemd --user` does this), and if there is none, to PID 1. PID 1 must reap zombies. The init of a PID namespace receives from ancestors only the signals for which it has a handler; SIGKILL and SIGSTOP are delivered forcibly (`pid_namespaces(7)`). Hence `tini` and the 10 seconds before SIGKILL in `docker stop` in the Docker block (X6, screen 3).
4. **What a process sees** (L35). Eight kinds of namespaces (`namespaces(7)`): uts, pid, mnt, user, ipc, net, cgroup, time — in order of how visible they are. The number in `/proc/<pid>/ns/*` matches for processes in the same namespace. `unshare` creates one, `nsenter` enters someone else's, `lsns` shows all of them. The network namespace in one command: `sudo unshare --net ip a` shows only `lo`; veth and bridges come in the "Networks" block (N20, N21). User namespace: `unshare --user --map-root-user` gives `uid=0` inside, but a file created inside belongs to `student` outside (`user_namespaces(7)`) (X7).
5. **What a process's root is** (L43). `chroot` changes only the visible root; processes, network and hostname stay shared, and root can escape. `pivot_root` — the idea in one diagram for L1/L2.
6. **A file system made of layers** (L40). overlay: the lower layers are read-only, the upper one takes the changes; on the first write a file is copied up in full (copy-up); deletion leaves a whiteout mark — a 0:0 character device; deleting a directory sets the `trusted.overlay.opaque=y` attribute (docs.kernel.org, "Overlay Filesystem") (X9).
7. **How much a process consumes** (L36, L37). cgroup v2 is a single tree in `/sys/fs/cgroup`, and systemd has already placed all services in it (`systemd-cgls`). Files `memory.max`, `memory.current`, `memory.events`, `cpu.max`, `cpu.stat`, `pids.max`, `pids.events`. First through the familiar: `systemctl show nginx -p ControlGroup`, then by hand (`mkdir`, `echo` into files, `cgroup.procs`), then in one systemd line (`systemd-run --scope -p MemoryMax=20M -p CPUQuota=50% -p TasksMax=16`). The OOM killer: global (`Out of memory: Killed process`) and inside a group (`Memory cgroup out of memory: Killed process`); systemd shows `Failed with result 'oom-kill'`; later the learner will recognize this as `OOMKilled` and code 137 (X8).
8. **What a process is allowed to do** (L38, L41). root is about forty separate privileges (`capabilities(7)`); `CAP_DAC_OVERRIDE` explains why root bypasses the `rwx` check from M5, and `CAP_SYSLOG` why `dmesg` requires sudo. File capabilities (`setcap cap_net_bind_service=+ep`) instead of setuid. seccomp is a system call filter: `Seccomp: 2` in `/proc/<pid>/status` means a filter is enabled; systemd has `SystemCallFilter=` (`seccomp(2)`, `systemd.exec(5)`). We do not write our own profiles: that is the Docker block (X5, layer 2).

**Lessons and depth by level.**

| Lesson | Concept | L0 | L1 | L2 |
|---|---|---|---|---|
| `linux.threads` | L33 | in full | in full | condensed |
| `linux.clone` | L34 | 3–4 calls | in full | in full |
| `linux.pid1` | L42 | without subreaper | in full | in full |
| `linux.namespaces` | L35 | uts, pid, mnt, net in one command | all kinds, `nsenter` | plus user namespace by hand, `uid_map` |
| `linux.chroot` | L43 | `chroot` into busybox | plus `pivot_root` as a diagram | the same |
| `linux.overlay` | L40 | the picture and `ls` by layers, one assembly | in full | in full |
| `linux.cgroups` | L36 | memory and pids | plus `cpu.max`, `systemd-run` | plus a comparison with crun's `config.json` as `forward: [D10]` |
| `linux.oom` | L37 | in full | in full | in full |
| `linux.caps` | L38 | one scene: root = a set of privileges; port 80 | in full | in full |
| `linux.seccomp` | L41 | one screen | one lesson | plus `SystemCallFilter=` by hand |

Time: L0 about 4–5 hours, L1 5–6 hours, L2 3–4 hours (theory collapsed to "what's new"). The module's drills are `linux.m15.drill.*` in section 8.2, and the exam is `linux.exam.isolation` in 8.3.

**Final combined task** (no hints, rung 4 of the ladder, before the exam): "Run `report-gen` so that it has its own hostname and its own process tree, no more than 64 MB of memory and 8 processes, no `CAP_NET_RAW`, and its root is an overlay on top of `/lab/rootfs` with changes in tmpfs." Check: `procs[cmd~report-gen].ns.uts!=@host.ns.uts && procs[cmd~report-gen].ns.pid!=@host.ns.pid`; `cgroups[procs~@pid(report-gen)].memory.max<=64M && cgroups[procs~@pid(report-gen)].pids.max<=8`; `procs[cmd~report-gen].capEff` without the `CAP_NET_RAW` bit; `mounts[type=overlay][lower~'/lab/rootfs']` and `procs[cmd~report-gen].root` equals its `target`.

**M15 quiz** (bank, examples):

| Question | Answer |
|---|---|
| `readlink /proc/412/ns/pid` and `/proc/1/ns/pid` give `pid:[4026532201]` and `pid:[4026531836]`. What does this tell you? | Process 412 is in a different PID namespace |
| Why does `ps` after `unshare --pid --fork bash` without `--mount-proc` show all processes? | `ps` reads `/proc`, and the old `/proc` is mounted |
| `memory.events` shows `oom_kill 3`. What happened? | The kernel killed a process of this group three times when the group hit `memory.max` |
| A file was deleted in merged. What is in upperdir? | A 0:0 character device with the same name (whiteout); the file remains in the lower layer |
| Why can root read a file with mode `0000`? | The root process has `CAP_DAC_OVERRIDE`: the permission check is skipped |
| `Seccomp: 2` in `/proc/<pid>/status` | The process runs with a system call filter |
| What does `chroot` isolate: files, processes, network, hostname? | Only the visible file root |
| How many threads does a process have if `/proc/<pid>/task` has seven directories? | Seven, including the main one |

---

## 6. Process explainers and interactive diagrams

### 6.0. General rules and the terminal

**Style.** All diagrams of the block are technical drawings per 08 §5: a precise 1.5 px line, 6 px corner radius, 8 px grid, value labels in IBM Plex Mono 12–13 px, node labels in IBM Plex Sans 14 px. Color encodes the layer and is always duplicated by shape or label: `--c-kernel` — the kernel, a solid band **always at the bottom**; `--c-user` — processes, rectangles above it; `--c-ns-*` — namespace frames; `--c-limit` — limit gauges; `--c-ok/err/warn` — state with an icon ✓ / ⨯ / !. Sankofa's ink (`ink.ts`), characters, metaphorical drawings (pipes, faucets, picture rooms), plot and decoration are not used in the Linux block. The users `anna`, `bob`, `eve` are table rows with UIDs and groups, without avatars. From Sankofa we take the magazine-style text presentation, scroll scenes, layers (`layers.ts` for overlay), calm mode, lenses, QR, bilingual YAML, `draft`/`hold`.

**Animation** shows only the process itself: a dot travels along an arrow, a table row appears, a gauge fills, a counter grows. One scene — one idea. Every arrow is labeled **on the line**, every element is clickable and opens a card "what this is, who creates it, which command shows it, the manual page". The stepper (08 §3.1): forward, back, pause, dragging along the timeline, 0.25×/1×/4×; this is not a video — the picture at time `t` is computed from events. Parameters (sliders, switches) **immediately recompute** the process, and a Δ line "what changed and why" appears next to the diagram. "Break it" — `breakit` toggles (08 §3.5): before switching one on, the learner picks a prediction, and the consequence is shown on the diagram (red outline and ⨯), in the terminal (the real error message) and in the "Why" block. In calm mode — the same steps without motion. On tier B the diagram receives events from the agent (`watch`, 09 §1.4) and replays what the learner has just done; without a machine — a recorded scenario (`sims/*.steps.yaml`, 08 §7.6) captured from `lab-debian`.

**Terminal** (R5). xterm.js 6 (08 §3.4), IBM Plex Mono 14/20, ligatures off. The theme is built from 08 tokens in light and dark variants; the 16 ANSI colors are chosen so that `ls --color` and `systemctl status` stay readable with a contrast of at least 4.5:1. The prompt `student@lab:~$` is in `--c-user`; the root prompt (`#`) has its own color, with the caption "you are root" when it first appears. Lines coming from the kernel (console messages, `dmesg`) are marked on the left with a thin `--c-kernel` band. Over the output there is markup, not replacement: clicking a line opens a breakdown of its columns, the key line of an error is highlighted, and next to it is "how to read this error" (01 §8, R14). Width 80–100 columns; on a phone, horizontal scrolling happens only inside the terminal. The bell is off.

**How many explainers.** Eleven (X1–X11); four of them were directly named by the owner for the Linux block: boot (X1), fork/exec/PATH (X2), pipeline (X3), systemd restarting a crashed service (X4). Each is a `diagram` + `stepper` + `breakit` record with `introduces`/`uses` and a module; each is embedded into a chapter as a figure and opens separately from the explainer catalog.

### 6.1. Command anatomy

Above the input line, while the learner types, the command is broken into parts: name, options, arguments, redirections, pipeline; each part is labeled underneath. Hovering over an option shows the line from the **real** manual page (OPTIONS section) and a link to that place — this is rung 1 of the documentation ladder. Example: `grep -in "error" app.log > errors.txt` → `grep` (command: searches lines) · `-i` (case-insensitive) · `-n` (with line numbers) · `"error"` (what to search for; the shell removes the quotes) · `app.log` (where to search) · `> errors.txt` (output to a file; the file will be overwritten). Works on tiers A and B (the same parser in the browser does the parsing before the line is sent). For L0 it is always on, for others — via `Ctrl+/`.

### 6.2. Live file tree

A side panel with the FS tree, collapsed to three levels and expanded along the path to the current directory. Newly created, modified and deleted nodes are marked for two seconds with `+`, `~`, `−` icons (and color). FHS directories have a one-phrase caption that appears only after M1 has introduced it. Clicking a node shows the absolute and relative path to it; `Alt+click` inserts the path into the input line. On tier B the root tree is built directly from 9p (`fs-probe`); `/srv`, `/lab`, `/proc`, `/sys` — through the agent, only for expanded branches.

### 6.3. Manual page anatomy (M3)

The real `man cp` page from the image in a sheet widget. On the left is the table of sections (NAME, SYNOPSIS, DESCRIPTION, OPTIONS, EXIT STATUS, SEE ALSO), on the right the text; clicking a section in the table highlights it and shows a card "what this section is for". The SYNOPSIS line `cp [OPTION]... [-T] SOURCE DEST` is broken into parts: `[ ]` — "optional", `...` — "can be repeated", uppercase — "substitute your own". A "page from section 1 / 5 / 8" switch opens `crontab(1)` and `crontab(5)` side by side — showing that these are different pages about one word. An exercise inside: "find which flag makes `cp` not overwrite an existing file" — the learner searches with `/` in the widget, and the found line counts when clicked.

### 6.4. Breakdown of the top screen (M8, in detail — M14)

A snapshot of the real `top` from the machine, stopped with the "Freeze" button. Every field is marked up: `load average` (with a "queue / number of CPUs" gauge and the note "includes waiting for disk"), the tasks line, `%Cpu(s)` (`us`, `sy`, `id`, `wa` — each with the question "what does it mean if this is large"), the memory lines, the table columns. The learner starts a load (`burner`, `memhog 64`, writing 32 MB to `/srv` with `oflag=direct`) and sees which field reacts. Next to it there is always a second snapshot — from a real multi-core server: the training machine has one CPU, and disk wait in the emulator is small, and this is stated in a caption rather than hidden.

### 6.5. Three views of one command

Lenses (`engine/lenses.ts`): for `ls -l /etc`, `cat file | grep x`, `systemctl start nginx` — "what you see" (the output), "what the shell does" (parsing, `PATH` lookup, spawning a process, redirections), "what the kernel does" (5–8 system calls from a real `strace -f`). The "kernel" lens opens in M8 for all levels (3–4 calls for L0) and fully in M14. This is the entry into X2, not a separate diagram.

### 6.6. Storyboards X1–X11

#### X1. "From power-on to the prompt" (M11)

| Screen | What is on screen | What moves | Click |
|---|---|---|---|
| 1 | A chain of blocks from left to right: firmware → bootloader → kernel → PID 1 → targets → services → login → `bash`. On the arrows: "finds what to boot from", "puts the kernel into memory and passes the cmdline", "starts the first program", "pulls in dependencies", "starts getty" | The active marker moves along the chain | A block opens a card and the command that makes this stage visible |
| 2 | Bootloader: next to it, the real `cat /proc/cmdline` of this machine | — | An honesty card: "This machine has no bootloader: the emulator puts the kernel into memory itself. On a server GRUB does this" |
| 3 | Kernel: the `--c-kernel` band at the bottom; three highlighted `dmesg` lines — `Linux version`, mounting the root, `Run /bin/systemd as init process` | The lines appear one by one | A line opens an explanation |
| 4 | systemd (PID 1) and the target graph `sysinit.target → basic.target → multi-user.target`; arrows labeled `Wants=` / `After=` | Targets light up as they are reached | A target shows `systemctl list-dependencies <target>` |
| 5 | Services start in parallel: each has a time bar from `systemd-analyze blame` of this machine | Bars grow, a counter "services started: N" | A service shows its unit and its journal lines |
| 6 | `serial-getty@ttyS0` → `login` (autologin) → `bash`; a "you are here" mark | — | — |

Parameters: a target switch `multi-user / rescue / emergency` — the graph is recomputed and only the needed services remain; Δ: "You chose `rescue.target`: the network and `ssh` do not start; you will get a root shell on the console." A slider "start time of `slow.service`" 0–30 s — only the bars of services with `After=slow.service` stretch; Δ: "`web` waits for `slow` because of `After=`; `cron` does not wait — there is no ordering between them." A switch "`app` has / does not have `After=network-online.target` ordering" — without it `app` starts before the network and fails.

Break it (with the prediction "where will boot stop?"): "a disk with a wrong UUID in `/etc/fstab`" → boot waits for the device (90 s timeout), then `Dependency failed for Local File Systems` and emergency mode, with `journalctl -xb` next to it; "`init=/bin/nosuch` in the cmdline" → `Kernel panic - not syncing: Requested init /bin/nosuch failed (error -2)`; "`init=/bin/bash`" → steps 4–6 disappear, PID 1 is `bash`, there are no services; "`WantedBy=` removed from a service" → after a reboot the service does not start, even though "it was working before".

Live: lines of `journalctl -b -o short-monotonic` are highlighted on their blocks; the journal is from the CI boot, and after `systemctl reboot` it is the learner's own boot, and the diagram suggests comparing the two.

#### X2. "What happens when you press Enter" (fork, exec, PATH; M0 screen 1, M7 screen 2, M8 in full, M14 the "kernel" layer)

| Screen | What is on screen | What moves | Label on the arrow |
|---|---|---|---|
| 1 | The line `ls -l /etc > list.txt` is broken into words (diagram 6.1) | Words separate and line up | "the shell splits the line into words" |
| 2 | Substitutions: `~`, `$VAR`, `*` turn into values | The value replaces the pattern | "patterns are expanded by the shell, not by the command" |
| 3 | `PATH` — a row of directory cells; each one is checked for "is `ls` here" | A marker moves along the cells, the found one lights up ✓ | "the first one found wins" |
| 4 | A `bash` rectangle (PID 2210) above the kernel band; a copy with PID 2231 and the same descriptor table 0/1/2 appears | The copy slides out of the parent | "fork: a copy of the shell" (from M8 in the "kernel" layer — `clone`) |
| 5 | In the copy, descriptor 1 switches from the "terminal" arrow to `list.txt` | The end of the arrow moves | "the copy does the redirection before starting the program" |
| 6 | The contents of rectangle 2231 are replaced with `/usr/bin/ls`; the PID stays 2231 | The program label changes, the number does not | "exec: the same process record, a different program" (`execve`) |
| 7 | Parent 2210 in a gray "waiting" frame; `ls` writes to the file and exits | Lines go into `list.txt` | "wait: the parent waits for the exit code" (`wait4`, `write`, `exit_group`) |
| 8 | Code 0 goes into `$?`, the prompt appears again | — | "the exit code is in `$?`" |

Parameters: an editable `PATH` (dragging and removing cells): remove `/usr/bin` → step 3 ends with `command not found`, code 127, steps 4–8 do not happen; Δ: "the shell did not find `ls` in any directory and did not create a process — neither fork nor exec happened"; put `~/bin` first and place your own `ls` there → it wins. A command form switch: `ls` / `cd /tmp` / `exec ls` / `ls &`: `cd` — steps 3–7 disappear, Δ "changing the copy's directory is useless, so `cd` is executed by the shell itself"; `exec ls` — step 4 disappears, and after `ls` exits the terminal closes; `&` — step 7 disappears, the prompt appears immediately. A "bash path cache" switch — shows `hash` and why `hash -r` is needed after moving a program.

Break it: "remove the `x` bit" → step 6: `Permission denied`, code 126; "wrong shebang in a script" (from M9) → `bad interpreter: No such file or directory`; "`> /root/x` as student" → step 5: an error before the program starts, `ls` is not started; "the parent does not call wait" → the child stays in state `Z` (bridge to X6).

Live: on tier B — a real `strace -f -e trace=clone,execve,wait4,write,exit_group` of the learner's command, started by the agent in the service channel; for L0 in M8 four calls are shown, in M14 all of them.

#### X3. "Pipeline: processes and the kernel buffer" (M6 — layer 1, M8 — layer 2)

| Screen | What is on screen | What moves |
|---|---|---|
| 1 | Two command rectangles `producer` → `consumer`, between them a buffer with a fill gauge "buffer, 64 KiB"; arrows labeled `1` (stdout) and `0` (stdin); `2` (stderr) arrows from each command go to the "terminal" block, bypassing the pipeline | Lines of real text travel along the arrow, the buffer gauge fluctuates |
| 2 | The pipeline `cat access.log \| grep ' 500 ' \| cut -d' ' -f1 \| sort \| uniq -c \| sort -rn \| head -3` | Lines fade at the `grep` input if they don't match; `sort` accumulates a counter "lines received: N", its output is empty |
| 3 | EOF reaches `sort` (an "end of input" mark) | `sort` outputs everything at once; `head` takes three lines and exits |
| 4 (layer 2, M8) | Each rectangle is labeled with a PID; the buffer is a "kernel buffer", with the `--c-kernel` band under it | Processes that finished go dark one by one; you can see that `cat`, `grep`, `cut` finished long before `head` |

Parameters: producer and consumer speed sliders (lines/s): if the consumer is slower, the buffer reaches 100% and the producer gets the mark `S` "waiting for space in the buffer" — a link to the process states of M8; buffer size 4 KiB…1 MiB (for L2 with the caption `F_SETPIPE_SZ`, `pipe(7)`), Δ: "the buffer was reduced to 4 KiB: `cat` waits for `grep` more often; this does not affect the result, but it does affect speed"; switches `2>&1`, `> file`, `| tee`.

Break it: "remove `sort` before `uniq -c`" → the count is wrong, Δ "`uniq` merges only adjacent repeats"; "the consumer exited earlier" — on a separate example `yes | head -3`: the producer receives SIGPIPE on its next write, code 141 (128 + 13); Δ explains why in the longer pipeline above `cat` does not get SIGPIPE: `sort` read its input to the end, and by that time `cat` had already exited on its own; "`set -o pipefail` on/off" → the pipeline's `$?` changes when the first command fails.

Live: on the Stand — the model's `pipe.write/read` events; on tier B — process states and `/proc/<pid>/fdinfo` every 200 ms.

#### X4. "systemd restarts a crashed service" (M11)

| Screen | What is on screen | What moves |
|---|---|---|
| 1 | The unit state machine: `inactive → activating → active → deactivating → inactive`, a `failed` branch, an `auto-restart` loop; a timeline on the right; below it a counter "restarts in the `StartLimitIntervalSec` window: n of `StartLimitBurst`" | The current state marker moves along the arrows |
| 2 | `systemctl start app`: `inactive → activating → active`, a new PID for the main process | — |
| 3 | The main process exits with code 1: an arrow into `failed` or into `auto-restart` depending on `Restart=` | A crash mark on the timeline |
| 4 | Waiting for `RestartSec` | The waiting bar grows |
| 5 | A new start: a new PID, counter +1 | — |
| 6 | The fifth crash within 10 s: `start-limit-hit`, the service stays in `failed`; next to it the real journal lines | The counter hits the limit, ⨯ outline |

Parameters: `Restart=` (`no` / `on-failure` / `on-abnormal` / `always`), `RestartSec=` (0.1–30 s), `StartLimitBurst=` (1–10), `StartLimitIntervalSec=` (1–120 s), crash cause (`code 1` / `SIGKILL` / `SIGTERM` / start timeout / OOM), "the service crashes N s after start" (0–30 s). The reaction table is computed from `systemd.service(5)`: `on-failure` restarts on a non-zero code, a signal (except clean ones), a timeout and a watchdog trigger; `on-abnormal` — on a signal, timeout and watchdog, but not on a non-zero code; `always` — always, except on `systemctl stop`. Defaults of systemd 252 (bookworm): `Restart=no`, `RestartSec=100ms`, `StartLimitIntervalSec=10s`, `StartLimitBurst=5`. Δ: "with `RestartSec=100ms` and a crash immediately after start, five restarts fit into one second — systemd gives up with `start-limit-hit`"; "you set `on-abnormal`: exiting with code 1 is a normal termination for systemd, so there will be no restart".

Break it: "`ExecStart` pointing to a nonexistent file" → `status=203/EXEC`, restarts quickly hit the limit; "`Type=simple` for a program that goes into the background" → systemd considers the service finished; "`kill -9` of the main process" → with `on-failure` a restart, with `no` — `failed`; "`systemctl stop`" → no restart with any `Restart=`.

Live: the drill "a service from a program" (the agent does `kill -9`) is drawn on this diagram from `systemctl show -p ActiveState,SubState,NRestarts`. A one-line bridge: "`restart: on-failure` in Docker and `restartPolicy` in Kubernetes work the same way" (`forward` to 04 and 05).

#### X5. "How the system decides whether something is allowed" (M5; layer 2 — M15)

| Screen | What is on screen | What moves |
|---|---|---|
| 1 | On the left, a 3×3 grid of switches (u/g/o × r/w/x) and three additional ones (setuid, setgid, sticky); in the middle, four synchronized notations of the same mode: `0750`, `u=rwx,g=rx,o=`, `-rwxr-x---`, `chmod 750 report.sh` — any of them can be edited | The notations are recomputed on any change |
| 2 | A "who is asking" table: `uid 1001 anna (owner)`, `uid 1002 bob (group dev)`, `uid 1003 eve (others)`; actions: read, modify, execute the file; `ls` of a directory; `cd` into a directory; delete a file from a directory | — |
| 3 | The check chain for the selected pair: "uid = owner? → first triplet" → "gid or supplementary group = file's group? → second" → "otherwise third" → "is the needed bit set? → allowed / `EACCES`" | A marker moves along the chain, the answer at each diamond is labeled |
| 4 | The path to the file `/srv/www/index.html`: the same chain is repeated for each directory of the path (the `x` bit) | The check passes directory by directory |
| 5 (M15) | Before the chain a diamond appears: "does the process have `CAP_DAC_OVERRIDE`?"; for root it is "yes" — the arrow bypasses the `rwx` check | — |

Parameters: the bit grid; a "file / directory" switch (for a directory `x` means "can enter", deletion depends on the directory's permissions); choice of action and user. In M15 — toggles for process privileges (`DAC_OVERRIDE`, `NET_BIND_SERVICE`, `CHOWN`, `KILL`, `SYS_ADMIN`) and actions "read someone else's 0600", "listen on port 80", "change owner", "send a signal to someone else's process", "mount".

Break it: "remove `x` from `/srv`" → access to the file disappears even though the file's own permissions are correct; Δ "the check did not reach the file — the system stopped at the directory; this is the most common nginx 403"; "sticky on a shared directory turned off" → bob deletes alice's file; in M15 "root without privileges" (`capsh --drop=all`) → root gets `Permission denied` on someone else's 0600 file.

Live: the same `access()` function as in the Stand and the `access[...]` fact; a "test yourself" mode: the diagram picks a mode and an action, and the learner answers "yes / no".

#### X6. "A signal to a process and the special PID 1" (M8 — screens 1–2, M15 — screen 3)

| Screen | What is on screen | What moves |
|---|---|---|
| 1 | Sender → kernel band → receiver. The receiver has a table of reactions to signals (`default` / `ignore` / `handler`); a palette of TERM, INT, HUP, KILL, STOP, CONT, TSTP | A signal is a dot that goes through the kernel to the receiver; dragging from the palette onto a process runs a visible `kill` in the terminal |
| 2 | Stopping "politely, then by force": TERM → waiting `TimeoutStopSec=` → KILL | A waiting bar, then a second KILL dot |
| 3 (M15) | The same process as PID 1 in a new PID namespace: a rectangle with two numbers (1 inside, 3120 outside) in a `--c-ns-pid` frame | TERM from the host reaches the frame and stops there |

Parameters: handler toggles in `sigdemo` for each signal; for KILL and STOP the toggle is locked with the caption "cannot be caught: the kernel decides"; a `TimeoutStopSec=` slider (1–90 s; systemd's default is 90 s), Δ "`docker stop` does the same with 10 s" (`forward` to 04). On screen 3 a toggle "PID 1 has / does not have a TERM handler": without a handler, Δ "a namespace's init does not receive signals without a handler from ancestors (`pid_namespaces(7)`); KILL is delivered forcibly".

Break it: "the parent does not collect the exit code" → the child is `Z`, the zombie counter grows; "terminate the parent" → the orphan passes to a new parent: the diagram takes the real new parent from `PPid` in `/proc/<pid>/status` (usually PID 1; under `systemd --user` — its subreaper, which is shown in M15); on screen 3 "PID 1 does not reap zombies" → the `Z` counter grows with every finished child; a toggle "`tini` as PID 1" → zombies are reaped, and TERM is forwarded to the application.

Live: `sigdemo` prints received signals in its window; the agent's `proc.signal` events.

#### X7. "What a process sees: namespaces" (M15)

| Screen | What is on screen | What moves |
|---|---|---|
| 1 | The kernel band at the bottom, the machine's processes above it; around all of them, one frame of each kind with a label and a number `pid:[4026531836]` from `/proc/<pid>/ns` | — |
| 2 | `unshare --uts bash`: a uts frame around the new `bash`; `hostname` inside and outside differ | The frame grows around the process |
| 3 | `--pid --fork`: a pid frame; inside PID 1, outside 3120 — one rectangle with two numbers | The number changes when the point of view is switched |
| 4 | `--mount-proc`: without it `ps` inside shows the host's processes (the old `/proc` is visible) | — |
| 5 | `nsenter -t 3120 -u -p -m`: a second process enters the same frames | The process moves inside the frames |
| 6 | `--user --map-root-user`: inside, `id` → `uid=0`; a file created inside belongs to `student` on the host | The owner label changes when the point of view is switched |

Parameters: checkboxes for `unshare` flags (`--uts --pid --fork --mount-proc --mount --net --ipc --user --map-root-user`): the diagram immediately shows which frames will appear and what will change in the output of `hostname`, `ps`, `mount`, `id`, `ip a`; the "run" button prints the real command into the terminal. A point-of-view switch "from the host / from inside" changes the numbers (`NSpid`), the hostname, the `ip a` list. Δ: "you added `--net`: the process has its own network stack, with only `lo` in state DOWN".

Break it: "without `--fork`" → `bash: fork: Cannot allocate memory` on the second command; Δ "the first child of `unshare` became PID 1 of the new namespace and exited, after which no process can be created in that namespace"; "without `--mount-proc`" → screen 4; "`nsenter` into net but not uts" → the hostname is the outer one, the network is the inner one.

Live: the agent's `watch ns` (`ns.create`, `proc.spawn`).

#### X8. "How much a process consumes: cgroups and the OOM killer" (M15)

| Screen | What is on screen | What moves |
|---|---|---|
| 1 | The `/sys/fs/cgroup` tree from `systemd-cgls`: `system.slice` → services; the selected group on the right | — |
| 2 | The group `/sys/fs/cgroup/lab` with processes inside; a `memory.current` gauge with a `memory.max` mark (`--c-limit`); `memory.events` counters: `high`, `max`, `oom`, `oom_kill`; next to it the same gauge for the whole machine (`MemAvailable`) | `leaky` grows by 4 MB/s, the gauge rises |
| 3 | Approaching `memory.high` (if set): the kernel reclaims pages, growth slows down, `high` increases | The `high` counter |
| 4 | `memory.max`: the process rectangle goes dark, `oom_kill +1`, the `dmesg` line `Memory cgroup out of memory: Killed process …` | Counter, journal line |
| 5 | The rest of the machine is unaffected: the machine gauge is below the edge | — |
| 6 | `cpu.max`: a timeline in 100 ms periods, the shaded fraction = the quota; the `nr_throttled` counter | Periods pass, the shading repeats |
| 7 | `pids.max`: the group's process counter hits the limit, `spawner` gets `Resource temporarily unavailable`, `pids.events max` grows | — |

Parameters: `memory.max` (16 MB … no limit), `memory.high` (off / a value), growth rate, number of processes in the group (whom the OOM killer will pick — by `oom_score`), `cpu.max` (5–100% of the CPU), `pids.max` (5–500), a "via systemd" switch (the same through `MemoryMax=`, `CPUQuota=`, `TasksMax=` on a service; in the journal `Failed with result 'oom-kill'`, restart according to `Restart=` — a link to X4). On tier B, changing a slider writes with `echo` into the real file, and the command is visible in the terminal. Δ: "the limit is below current consumption: the kernel first evicts the cache, then runs the OOM killer inside the group"; "`memory.high` is below `memory.max`: the process is not killed but slowed down — the kernel keeps taking memory away from it". Bridge: "`MemoryMax=` in a unit, `--memory` in Docker and `resources.limits.memory` in Kubernetes write to this same file" (`forward` to 04 and 05).

Break it: "no limit" → growth reaches the edge of the machine, and the global OOM kills the heaviest process of the machine — which may not be `leaky`; this is shown from recorded frames, not on the learner's live machine.

#### X9. "Stacking file systems: overlayfs" (M15; the same widget is reused by 04, interactive 2)

| Screen | What is on screen | What moves |
|---|---|---|
| 1 | Three horizontal sheets (`layers.ts`, SVG): `lower` at the bottom (read-only, gray), `upper` (writable), on top the `merged` view; paths at the edges of the sheets | — |
| 2 | Reading a file: it is taken from lower | The highlight passes through the layers down to lower |
| 3 | Modification: the file is copied to upper in full (copy-up), then changed; caption "1.2 MB copied for the sake of one line" | The copy rises to the upper sheet |
| 4 | Deletion: `c 0,0` (whiteout) appears in upper; the file remains in lower; it is not visible in merged | A mark lands on the upper sheet |
| 5 | Deleting a directory: in upper — a directory with the `trusted.overlay.opaque=y` attribute | — |

Parameters: number of lower layers 1–3 (order `lowerdir=a:b:c` — the leftmost is on top); operations on a file in merged ("read", "modify", "delete", "create"); a switch "upper present / absent" (without upper — read-only). Δ: "you deleted `old.txt`: it did not disappear from the lower layer — a whiteout was placed on top".

Break it: "upper on the 9p root" → a real mount error (the FS does not store the required attributes), Δ "this is why on this machine the upper layer is on the `/lab` tmpfs"; "no `workdir`" or "workdir on a different FS than upper" → a mount error.

Live: the overlay drill is drawn from the `mounts` and `files` facts of the layers.

#### X10. "A file on disk: disk → partition → FS → mount point" (M13)

| Screen | What is on screen | What moves |
|---|---|---|
| 1 | On the left `/dev/sdb` (64 MB) as a strip of blocks, on the right the FS tree | — |
| 2 | `fdisk`: at the beginning of the strip a partition table, then the partition `sdb1` | Segments appear following the learner's commands |
| 3 | `mkfs.ext4`: on the partition a superblock, an inode table, data blocks | Areas are marked out |
| 4 | `mount /dev/sdb1 /data`: the `/data` branch in the tree gets the root of the new FS; the previous contents of `/data` are shown shaded underneath with the caption "hidden, not deleted" | An arrow from the partition to the mount point |
| 5 | A "inode and links" subdiagram: name → inode → blocks; a hard link is a second name of the same inode; a symbolic link is a file with a path inside | Deleting the first name affects each one differently |
| 6 | A deleted but open file: there is no name, the inode lives as long as a process holds a descriptor; `df` counts blocks, `du` counts names | The `df` and `du` counters diverge |

Parameters: a "mounted / not mounted" switch; "`UUID=` / `/dev/sdb1` in fstab" together with an "attach one more disk" switch (device names shift, UUIDs do not); on screen 6 — "a process holds the file / restarted". Δ: "you unmounted `/data`: the old files are visible again — they never went anywhere".

Break it: "the UUID in fstab does not match" → emergency mode at boot (link to X1); "mounting over a non-empty directory" → the files "disappeared"; "`mount -t tmpfs` and a reboot" → the contents vanish.

Live: the strip is built from `lsblk -J` and `blkid` in the facts after each of the learner's commands.

#### X11. "SSH: the path to someone else's shell" (M16; two machines on `vswitch`)

| Screen | What is on screen | What moves |
|---|---|---|
| 1 | On the left `laptop`, on the right `server`, between them a switch with two ports (the nodes' MAC and IP); each machine has a list of the files involved: `~/.ssh/id_ed25519`, `id_ed25519.pub`, `known_hosts`, `config` on the client; `authorized_keys`, `/etc/ssh/ssh_host_*`, `sshd_config` on the server | — |
| 2 | `ssh student@server`: a connection to port 22 | Frames (`net.packet` from `vswitch`) travel along the port lines, labeled `TCP :22` |
| 3 | Checking the server key against `known_hosts` | `ssh_host_ed25519_key.pub` and the `known_hosts` line are highlighted |
| 4 | The client offers its public key and signs; the server checks the signature against `authorized_keys` | Files are highlighted step by step |
| 5 | Checking the permissions of `~/.ssh` and `authorized_keys` (`StrictModes`) | A diamond "can others modify them?" |
| 6 | Starting the user's shell on the server; the terminal on the right becomes the server's terminal | — |

Parameters: login method (key / password), "`PasswordAuthentication` yes / no", "`KbdInteractiveAuthentication` yes / no", `authorized_keys` mode (600 / 644 / 666), fingerprint in `known_hosts` (matches / different). Δ: "you turned off only `PasswordAuthentication`, but `KbdInteractiveAuthentication` with PAM is on — password login is still possible".

Break it (with the prediction "at which step will it stop?"): "`authorized_keys` 666" → step 5, in the server's journal `Authentication refused: bad ownership or modes`; "a different server key" → step 3, `WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!`; "the switch port is disabled" → step 2, `Connection timed out`; "sshd is stopped" → step 2, `Connection refused`. If the login failed, the diagram stops at the step where it broke and shows the line from the server's `journalctl -u ssh`.

---

## 7. The documentation ladder

The Linux block is the course's first technical block, so the habit of reading documentation starts here. A beginner is not sent into the documentation from scratch, but by the end of the block a task cannot be solved without it. The rung is a property of the "learner × block" pair; it is stored in the learner model next to the S0–S5 support rung (01 §9) and is not mixed with it: if a learner is stuck on rung 4, the mentor goes down through hints H1–H5, not down the documentation ladder.

### 7.1. Rungs by level

| Rung | What the learner sees | L0 | L1 | L2 |
|---|---|---|---|---|
| 1. Glimpse | Every new command in the theory has a quiet line "where this comes from: `man ls`, OPTIONS section, `-l`" with a link to the exact place in the page; command anatomy (6.1) shows the line from OPTIONS on hover; at the end of the chapter — "How we know this". Opening it is optional | M0–M2 | — | — |
| 2. Fragment | A hint in a drill is a fragment of the real page (from the image, the same version) with the needed line highlighted and the section labeled; on the first such fragment — the page anatomy markup (6.3) | M3–M7 | M4–M5 | — |
| 3. Find the flag | The task gives no flag, only the page name (`man ps`); the result is checked. The mentor names the page and section, but not the flag | M8–M12 | M6–M10 | M10 and the lessons `linux.archives`, `linux.checksum`, `linux.json` |
| 4. Forcing | 1–2 tasks of a module require a command, flag or directive that is not in the theory (the build checks: `not_in_theory: true`); no hints; the mentor asks "where did you look?" and points to the type of source | M13–M16 | M11–M16 | M11–M16 |
| 5. Exam | Only the official documentation is open; every exam has one or two mandatory tasks on something that was not in the course | all exams | all exams | all exams |

Transition rules. A learner can move up a rung ahead of schedule after two consecutive tasks of the current rung solved without hints H4–H5. A rung-4 task opens only for concepts in the `practicing` state or higher (01 §9): a learner is not sent into the documentation on a topic they have not yet touched by hand. Links lead to pages for the version installed on the machine: `manpages.debian.org/bookworm/...` (bookworm has systemd 252, and `freedesktop.org/.../latest/` has directives that the machine does not have).

### 7.2. Format in content

```yaml
doc:                         # rungs 1–2: where this comes from
  - { page: "ls(1)", section: OPTIONS, anchor: "-S",
      line: "-S     sort by file size, largest first",
      url: "https://manpages.debian.org/bookworm/coreutils/ls.1.en.html" }
doc_task:                    # rungs 3–4
  step: doc4                 # doc3 — the page is shown; doc4 — nothing is shown
  page: "journald.conf(5)"   # for doc4 not shown to the learner; needed by the mentor and the review
  not_in_theory: [SystemMaxUse]   # the build checks that this is not in the block's theory
```

Checking on rungs 3–4 is by result. The flag is not checked from the history. `soft` notes whether the learner opened documentation: a `cmd.done` event with `man`, `--help`, `apropos`, `help`, `info` among the last 20 commands, or opening the "Documentation" panel. In the report this shows as "found in the documentation" or "found otherwise" and does not affect grading.

### 7.3. Rung 2 tasks (examples)

| Module | Task | Fragment in the hint |
|---|---|---|
| M3 | "What do `[ ]` and `...` mean in `cp [OPTION]... SOURCE... DIRECTORY`? Copy three files into a directory with one command" | SYNOPSIS of `cp(1)` with notation markup |
| M3 | "Which `ls` flag sorts by size? List `/var/log` with the largest on top" | OPTIONS of `ls(1)` with `-S` and `--sort=WORD` highlighted |
| M5 | "Make a directory shared for a group" (drill `linux.m05.drill.2`) | DESCRIPTION of `chmod(1)`, the line about `rwxXst` |
| M6 | "Find lines where `error` is a separate word, not part of `errors`" | OPTIONS of `grep(1)`, `-w` |
| M6 | "Verify three downloaded files against the `SHA256SUMS` list" | OPTIONS of `sha256sum(1)`, `-c` |
| M7 | "Why did the `alias` from the last session disappear?" | `help alias` and the INVOCATION section of `bash(1)` about `~/.bashrc` |

### 7.4. Rung 3 tasks (one per module; checked by result)

| ID | Module | Task | Where to look | Check |
|---|---|---|---|---|
| `linux.m06.doc.1` | M6 | "Follow `app.log` so that following does not stop after the log is rotated" | `man tail` | `procs[cmd=tail].args~'-F' \|\| procs[cmd=tail].args~'--follow=name'`; the agent rotates the log, and new lines reach the terminal (an output event) |
| `linux.m08.doc.1` | M8 | "Print processes sorted by memory, with the columns pid, rss, comm; save to `~/mem.txt`" | `man ps`, STANDARD FORMAT SPECIFIERS | `files['~/mem.txt'].text=@ref('ps -eo pid,rss,comm --sort=-rss')` with tolerance for changed lines |
| `linux.m09.doc.1` | M9 | "Make the script print every command it executes" | `help set` | `files['~/s.sh'].text=~'set -[a-z]*x\|set -o xtrace'` and the run output contains lines with `+ ` |
| `linux.m10.doc.1` | M10 | "Which files did the `jq` package install? Save the list" | `man dpkg` | `files['~/jq-files.txt'].text=@ref('dpkg -L jq')` |
| `linux.m11.doc.1` | M11 | "How many times did systemd restart the `flappy` service? The answer goes in `~/restarts.txt`" | `man systemctl`, `show` | `files['~/restarts.txt'].text=@ref('systemctl show -p NRestarts --value flappy')` |
| `linux.m11.doc.2` | M11 | "Save the kernel messages of the current boot" | `man journalctl` | `files['~/kernel.txt'].text=@ref('journalctl -k -b -o cat')` with tolerance for new lines |
| `linux.m12.doc.1` | M12 | "Run `~/warmup.sh` on every boot of the machine via cron" | `man 5 crontab` | `cron[user=student].line=~'^@reboot .*warmup\.sh'`; `probe: { action: reboot, then: ["files['/home/student/warmup.mark'].exists"] }` |
| `linux.m13.doc.1` | M13 | "Find files in `/srv/data` newer than `/etc/passwd`; the list goes in `~/newer.txt`" | `man find`, TESTS | `files['~/newer.txt'].text=@ref('find /srv/data -newer /etc/passwd')`, order does not matter |

### 7.5. Rung 4 tasks (on what is not in the theory; no hints)

| ID | Module | Task | What is not in the theory | Check |
|---|---|---|---|---|
| `linux.m11.doc.3` | M11 | "The systemd journal must not take up more than 50 MB" | `journald.conf(5)`, `SystemMaxUse=` | `probe: { run: "systemd-analyze cat-config systemd/journald.conf", stdout_regex: "^SystemMaxUse=50M" }`; `units[systemd-journald.service]` was restarted after the file changed |
| `linux.m11.doc.4` | M11 | "The `flappy` service must be restarted no more than 3 times per minute and then stay in `failed`" | `StartLimitBurst=`, `StartLimitIntervalSec=` (X4 has the mechanism; the theory does not have the directive in the `[Unit]` section) | `units[flappy.service].props.StartLimitBurst=3`; the agent crashes the service 4 times: `units[flappy.service].active=failed && units[flappy.service].result=start-limit-hit` |
| `linux.m11.doc.5` | M11 | "Change a parameter of the `nginx` service without touching the package's file" | `systemctl edit`, drop-in (mentioned in the theory, not shown hands-on) | `units[nginx.service].props.DropInPaths~'/etc/systemd/system/nginx.service.d/'`; the hash of `/lib/systemd/system/nginx.service` did not change |
| `linux.m13.doc.2` | M13 | "How many free inodes are there on `/srv`? The answer goes in `~/inodes.txt`" | `df -i` | `files['~/inodes.txt'].text=@ref('df -i --output=iavail /srv \| tail -1')` |
| `linux.m13.doc.3` | M13 | "Make `/srv/release.lock` immutable even for root" | `chattr +i` | `files['/srv/release.lock'].attrs~'i'`; `probe: { as: root, run: "rm /srv/release.lock", expect_exit_not: 0 }` |
| `linux.m13.doc.4` | M13 | "Check `/etc/fstab` for errors without rebooting" | `findmnt --verify` | the answer in `~/fstab-check.txt` matches `@ref('findmnt --verify 2>&1')` |
| `linux.m14.doc.1` | M14 | "Run `~/backup.sh` with the lowest priority for both CPU and disk" | `nice`, `ionice -c3` | `procs[cmd~backup.sh].nice=19 && procs[cmd~backup.sh].ioprio=idle` |
| `linux.m14.doc.2` | M14 | "Which service delayed boot the longest?" | `systemd-analyze blame` | `files['~/slow.txt'].text=@ref('systemd-analyze blame \| head -1 \| awk "{print \$2}"')` |
| `linux.m15.doc.1` | M15 | "Run `report-gen` so that it cannot create more than 20 processes, without touching `/sys` by hand" | `systemd-run -p TasksMax=20` | `cgroups[procs~@pid(report-gen)].pids.max=20`; `soft`: no `> /sys/fs/cgroup` in the history |
| `linux.m15.doc.2` | M15 | The M15 final task about `report-builder` (8.2) | `ProtectHome=`, `CapabilityBoundingSet=` / `AmbientCapabilities=` | see 8.2 |
| `linux.m16.doc.1` | M16 | "Allow ssh login to `server` only for members of the `devs` group" | `AllowGroups` | `probe: { run: "sshd -T", stdout_regex: "^allowgroups devs$" }`; login as `alex` (in `devs`) works, `eve` does not |
| `linux.m16.doc.2` | M16 | "No more than three login attempts per connection" | `MaxAuthTries` | `probe: { run: "sshd -T", stdout_regex: "^maxauthtries 3$" }` |

### 7.6. The "Documentation" panel and rung 5

The panel is a full-screen sheet (`mechanics/sheet.ts` from Sankofa) with in-page search and section anchors. The source is a local mirror of the image's man pages built in CI (`man -Thtml` for every page of `lab-debian`): documentation at an exam works offline and matches the machine. External sites open in the same panel only from an allowlist: `manpages.debian.org/bookworm`, `man7.org`, `www.debian.org/doc`, `docs.kernel.org`, `www.freedesktop.org/software/systemd/man`, `man.openbsd.org`. If a site forbids display in a frame, the panel opens its local copy or a new tab, with a note in the report. At an exam (rung 5) only the panel and `man`, `--help`, `apropos`, `help`, `info` inside the machine are available; the mentor is off. The exam report shows which pages the learner opened (`cmd.done` events with `man` and panel clicks): this is material for review, not for grading.

---

## 8. Quizzes, drills, exams

### 8.1. Quizzes

Formats — the `quiz` widget (08 §3.8): single answer, multiple answers, ordering, matching, "predict the output", "find the error" (a line of a unit file, script, crontab). Each question is tagged with a module and a concept; questions are not asked about concepts that come after the module. The bank has at least 15 questions per module; a quiz takes 6 of them, chosen at random with mandatory coverage of every introduced concept; a mistake leads to the chapter paragraph and a similar question. The quiz is part of FSRS review (01 §10), not a separate exam.

| Module | Question | Answer |
|---|---|---|
| M1 | You are in `/var/log`. Which path leads to `/var/lib`? a) `lib` b) `../lib` c) `/lib` | b |
| M2 | What remains after `mv a.txt b.txt` if `b.txt` already existed? | Only `b.txt` with the contents of the former `a.txt` |
| M2 | How does `tar -xzf site.tgz -C /srv/site` differ from `tar -xzf site.tgz` run in `/srv/site`? | No difference in the result: `-C` changes into the directory before extracting |
| M3 | How do you find out that `cd` is a shell builtin? Where is its description? | `type cd`; the description is `help cd` |
| M3 | SYNOPSIS says `cp [OPTION]... SOURCE... DIRECTORY`. Can you copy two files with one command? | Yes: `SOURCE...` can be repeated |
| M4 | `/etc/passwd` has the line `anna:x:1001:1001::/home/anna:/bin/bash`. Where is her password? | Not here: `x` means the password is stored in encrypted form in `/etc/shadow` |
| M5 | A directory has `drwxr-xr--`. An "other" user: `ls dir`? `ls -l dir`? `cd dir`? | `ls` shows the names; `ls -l` shows the names with `?` instead of attributes and `Permission denied` errors; `cd` — no (no `x`) |
| M5 | What mode will a new file get with `umask 027`? | `640` |
| M6 | How do `cmd > out 2>&1` and `cmd 2>&1 > out` differ? | In the first, both streams go to the file; in the second, errors go to the screen |
| M6 | What will `printf 'b\na\nb\n' \| uniq \| wc -l` print? | `3` (uniq removes only adjacent repeats) |
| M7 | Why does `VAR=1; bash -c 'echo $VAR'` print an empty line? | The variable is not exported: a launched command receives only environment variables |
| M8 | A process is in state `Z`. Which signal will remove it? | None: the parent must collect the exit code, or the parent must be terminated |
| M8 | What changes if instead of `kill <pid>` you press Ctrl+Z in its terminal? | The process receives SIGTSTP and stops (`T`); TSTP can be caught, STOP cannot |
| M9 | How does `"$@"` differ from `$*` with the arguments `"a b" c`? | `"$@"` gives two arguments, unquoted `$*` gives three |
| M9 | How many processes will the wrapper `#!/bin/sh … exec "$@"` leave after the program starts? | One: the shell was replaced by the program, the PID is the same |
| M10 | Why does `apt install nginx` right after installing the system say `Unable to locate package`? | The package list has not been downloaded: run `apt update` first |
| M11 | Find the error: `[Service]` `ExecStart=/usr/bin/python3 app.py`; the journal says `python3: can't open file '/app.py': [Errno 2] No such file or directory` | systemd starts the service from `/`; an absolute path to `app.py` or `WorkingDirectory=` is needed |
| M11 | What does `systemctl enable` do, and what does it not do? | It enables starting at boot; it does not start the service now (unless `--now` is given) |
| M11 | A service prints `hello` with `echo`. Where is this line? | In the journal: `journalctl -u <service>` |
| M12 | When does `*/15 9-18 * * 1-5` run? | Every 15 minutes from 9:00 to 18:45 on weekdays |
| M13 | Why is it better to write `UUID=...` in `/etc/fstab` rather than `/dev/sdb1`? | Device names change when another disk is attached; the UUID belongs to the FS |
| M13 | What happens to files in tmpfs after a reboot? | They disappear: tmpfs lives in memory |
| M14 | `free -h`: `available` 1.2G, `free` 90M. Is there enough memory? | Yes: `available` accounts for the cache that the kernel will free |
| M14 | Load average 3.0 on a single-CPU machine, and the CPU is almost idle. How is that possible? | Processes are waiting for the disk (state D): they are also counted in the load average |
| M16 | Which key do you copy to the server: `id_ed25519` or `id_ed25519.pub`? | `.pub`; the private key never leaves the client |

The M15 quiz is in section 5.4.

### 8.2. Drills

Each drill is a task in the format of section 4.3: `goals` in the 09 format, a starting rung S for each level (per 01 §9: L0 — S0, L1 — S1, L2 — S3, unless stated otherwise), a documentation rung, hints H1–H5 (01 §14.2; no points or penalties; H4–H5 lower the review rating to Hard), a review after solving (the reference solution and other correct approaches). The "S5" column is a breakage variant of the same skill ("find and fix"). Abbreviations in the "Check" column: `@ref(cmd)` — a reference computed by the agent on the same machine; `probe` — an action (09 §2.4).

| ID | Module, tier | Task | Preparation | Check | S5 |
|---|---|---|---|---|---|
| `linux.m01.drill.1` | M1, A | "Find the directory where logs are kept, go into it and print the path" | — | the last `cmd.done`: `cwd=/var/log`, command `pwd` | "`cd /var/logs` says No such file" — find the typo using `ls /var` |
| `linux.m01.drill.2` | M1, A | "While in `/usr/lib`, go to `/usr/share/doc` with one command using a relative path" | `cd /usr/lib` | `cwd=/usr/share/doc`; the `cd` argument does not start with `/` (`soft`) | — |
| `linux.m02.drill.1` | M2, A | "Create `~/site/{css,js,img}` and empty `index.html`, `css/main.css`" | — | `files[...]` for five paths, types `d`/`f` | — |
| `linux.m02.drill.2` | M2, A | "`~/photos` has 30 files. Move `2024-*.jpg` into `~/photos/2024` without touching the rest" | 30 files from three years and of several types | exactly 9 files in `2024/`, hashes match; no `2024-*.jpg` in `~/photos`; the other 21 are in place | "`2024-*.png` were moved too" — move the extra ones back |
| `linux.m02.drill.3` | M2, A (all levels) | "Extract `site.tgz` into `/srv/site` so that `index.html` is directly in `/srv/site`, not in `/srv/site/site`" | an archive with a `site/` directory inside | `files['/srv/site/index.html'].exists && !files['/srv/site/site'].exists` | — |
| `linux.m03.drill.1` | M3, A | "Find out from the help which flag makes `ls` sort by size, and save `/var/log` sorted by size into `~/bysize.txt`" | — | `files['~/bysize.txt'].text=@ref('ls -S /var/log')` (`-S` and `--sort=size` are accepted) | — |
| `linux.m04.drill.1` | M4, A | "Which groups is the user `deploy` in? What is their UID? The answer goes in `~/deploy.txt`" | `deploy` in two groups | `files['~/deploy.txt'].text` contains the UID and both groups (reference — `id deploy`) | — |
| `linux.m05.drill.1` | M5, A | "The program `~/bin/backup` does not start: Permission denied. Make it executable by the owner only" | file `0644` | `files['~/bin/backup'].perm.u~'x' && files['~/bin/backup'].perm.g!~'x' && files['~/bin/backup'].perm.o!~'x'`; `access[user=student][path='~/bin/backup'][op=x]=allow` | "after copying from a USB stick the programs do not start" (the `x` bit was lost) |
| `linux.m05.drill.2` | M5, A | "A shared team folder" (example in 4.3) | `dev`, `alice`, `bob`, `eve` | see 4.3 | "the site returns 403": no `x` on `/srv/www` |
| `linux.m05.drill.3` | M5, B (L1, L2) | "In `/srv/team`, `dev` members delete each other's files. Make it so that only the author can delete a file and new files get the `dev` group" | the directory after `drill.2`: group `dev`, mode `0770`, setgid and sticky not set | `files['/srv/team'].perm.setgid && files['/srv/team'].perm.sticky`; `probe: { as: bob, run: "rm /srv/team/alice.txt", expect_exit_not: 0 }`; `probe: { as: alice, run: "touch /srv/team/n && stat -c %G /srv/team/n", stdout_regex: "^dev$" }` | — |
| `linux.m05.drill.4` | M5, B (L2) | "Give the user `auditor` the right to read `/srv/reports/q3.csv` without changing the file's group and mode" | file `0640 root:finance` | `files['/srv/reports/q3.csv'].acl~'user:auditor:r'`; group and mode unchanged; `access[user=auditor][path='/srv/reports/q3.csv'][op=r]=allow` | — |
| `linux.m06.drill.1` | M6, A | "In `access.log` find the three IPs with the most requests, save to `~/top3.txt` as `count IP`" | a 2,000-line log | `files['~/top3.txt'].text=@ref("cut -d' ' -f1 access.log \| sort \| uniq -c \| sort -rn \| head -3")` with whitespace normalization | "the count is wrong" — `sort` before `uniq -c` was removed |
| `linux.m06.drill.2` | M6, A | "Save into `~/errors.txt` only the error messages printed by `~/bin/noisy`" | `noisy`: 50 stdout lines, 7 stderr | `files['~/errors.txt'].text` — 7 lines, each `^ERR` | — |
| `linux.m06.drill.3` | M6, A | "In all `*.conf` in `~/cfg`, replace the address `10.0.0.5` with `10.0.0.50` without creating copies" | 6 files, 4 contain the address, one contains `10.0.0.55` | all occurrences replaced, `10.0.0.55` did not become `10.0.0.505`, no `*.conf~`/`*.bak` files | — |
| `linux.m06.drill.4` | M6, A | "Find files in `/home` larger than 1 MB modified within 7 days; paths go in `~/big.txt`" | 12 files | `files['~/big.txt'].text=@ref('find /home -type f -size +1M -mtime -7')`, order does not matter | — |
| `linux.m06.drill.5` | M6, A (all levels) | "Which of the three downloaded archives matches the published checksum? Delete the others" | `SHA256SUMS` and 3 files, two of them changed by one byte | one file remains, and its `sha256` matches the published one | — |
| `linux.m07.drill.1` | M7, A | "Add `~/bin` to `PATH` so that it persists in new sessions, and run `hello` by name" | `~/bin/hello` | `probe: { as: student, run: "bash -ic hello", expect_exit: 0 }` (on the Stand — the model computes a new session); the line in `~/.bashrc` is only `soft` | "after editing `.bashrc` all commands disappeared": `PATH=~/bin` without `:$PATH` |
| `linux.m08.drill.1` | M8, A → B | "Start `burner` in the background, find it in `top`, stop it without killing it, then resume it and terminate it politely" | — | observed `procs[cmd=burner].state=T`; then `!procs[cmd=burner]`; the last signal is `TERM` (`soft` if `KILL`). Review: Ctrl+Z sends SIGTSTP (20), `kill -STOP` sends SIGSTOP (19); both give `T`, but TSTP can be caught | — |
| `linux.m08.drill.2` | M8, B | "Who is the parent of the `worker` process? Write the parent's PID and name into `~/parent.txt`" | `worker` started from `legacy-launcher` | `files['~/parent.txt'].text=@ref('ps -o ppid=,comm= -p $(ps -o ppid= -p $(pgrep worker))')` | — |
| `linux.m09.drill.1` | M9, B | "Write `~/check_disk.sh`: takes a path and a threshold in percent, prints `OK` or `ALERT: <path> <percent>%`, exits with code 0 or 1" | — | the agent runs the script 4 times with a substitute `df` (via `PATH`) and checks the output and code; `probe: { run: "shellcheck -S error ~/check_disk.sh", expect_exit: 0 }` | — |
| `linux.m09.drill.2` | M9, B | "`~/rotate.sh` deletes archives older than 7 days but breaks on names with spaces. Fix it" | a script with `for f in $(ls ...)` | `old backup.tar.gz` and others deleted, fresh ones in place; `shellcheck` without SC2045/SC2086 | — |
| `linux.m09.drill.3` | M9, B (all levels) | "The wrapper `~/run-app` sets up the environment and starts `~/app`. Make it so that no extra shell remains after starting" | a wrapper without `exec` | `procs[cmd~'/app'].ppid` is the process that started the wrapper; `!procs[cmd~run-app]` | — |
| `linux.m09.drill.4` | M9, B (all levels) | "From `~/units.json` print the names of services in state `failed`, one per line" | JSON with 20 records | `files['~/failed.txt'].text=@ref("jq -r '.[] \| select(.state==\"failed\") \| .name' ~/units.json")` | — |
| `linux.m10.drill.1` | M10, B | "Install `nginx`, make sure it serves a page, and find which package owns `/usr/sbin/nginx`; the answer goes in `~/pkg.txt`" | `nginx-light` removed from the snapshot, available on the mirror | `units[nginx.service].active=active`; `probe: { run: "curl -s -o /dev/null -w '%{http_code}' http://localhost", stdout_regex: "^200$" }`; `files['~/pkg.txt'].text=@ref('dpkg -S /usr/sbin/nginx')` | — |
| `linux.m11.drill.1` | M11, B | "Make a service out of `~/app/server.sh` (listens on port 8080): run as user `app`, restart on crash, start at boot" | user `app`, the script | `units[app.service].active=active && units[app.service].enabled=enabled`; `units[app.service].props.User=app`; `props.Restart` ∈ {`on-failure`, `on-abnormal`, `always`}; `probe` (the agent does `kill -9` of the main process): after 5 s `active=active` and `net.listen[port=8080]`; `probe: { action: reboot, then: [...] }` | "the service does not start after a reboot": no `[Install]` |
| `linux.m11.drill.2` | M11, B | "The `billing` service was restarting during the night. The time of the first crash and the error text go in `~/incident.txt`" | a journal with 3 crashes, generated in CI | `files['~/incident.txt'].text` contains the time of the first `Main process exited` and the error text (the `journal` fact) | — |
| `linux.m11.drill.3` | M11, B | "The program `~/hello` prints a line every second. Make a service out of it and show its output without configuring any log files" | — | `units[hello.service].active=active`; `journal[unit=hello.service].count>=3` | — |
| `linux.m12.drill.1` | M12, B | "Every 10 minutes between 9 and 18 on weekdays run `~/check_disk.sh / 90` and append the output to `~/disk.log`" | `linux.m09.drill.1` | `cron[user=student].line=~'^\*/10 9-18 \* \* 1-5 .*check_disk\.sh / 90 >> .*disk\.log'` or an equivalent timer; the agent runs the line from the crontab and checks that `disk.log` grew | "the cron job is silent": a relative path without `PATH` |
| `linux.m13.drill.1` | M13, B | "Attach the second disk: one ext4 partition over the whole disk, mounted at `/data` so that it persists after a reboot" | an empty 64 MB `hdb` | `mounts[target=/data].type=ext4`; `fstab[file=/data].spec=~'^UUID='` and the UUID matches `blkid`; `probe: { action: reboot, then: ["mounts[target=/data]"] }` | "emergency mode after a reboot": the UUID in fstab does not match |
| `linux.m13.drill.2` | M13, B | "`df` shows 100% on `/srv`, while `du` shows 40%. Get the space back without rebooting the machine and without losing the data in `/srv/orders`" | `legacy-agent` holds a deleted log | free space ≥ the threshold; `/srv/orders` intact (hashes); `procs[cmd=legacy-agent]` alive or restarted | — |
| `linux.m13.drill.3` | M13, B | "Make `/srv/shared/docs` available also as `/home/student/docs`, without copying; and a 16 MB in-memory directory `/scratch`" | — | `mounts[target='/home/student/docs'].source~'/srv/shared/docs'` (bind); `mounts[target=/scratch].type=tmpfs && mounts[target=/scratch].options~'size=16'` | — |
| `linux.m14.drill.1` | M14, B | "The `worker` process is loading the CPU. Using `/proc`, find its PID, PPID and the path to the program; three lines go in `~/worker.txt`" | `worker` from `/opt/legacy/bin/` | `files['~/worker.txt'].text` against `@ref` from `pgrep`, `ps -o ppid=`, `readlink /proc/PID/exe` | — |
| `linux.m14.drill.2` | M14, B | "How many CPUs does the machine see, how much memory is available, what is the 5-minute load average? Is it overloaded?" | `burner` and `leaky` in the background | numbers in `~/sys.txt` against `nproc`, `MemAvailable`, the second field of `/proc/loadavg` (with tolerance); the conclusion about overload — `explain` by rubric (number of CPUs = 1, load above 1) | — |
| `linux.m15.drill.1` | M15, B | "How many threads does `threads-demo` have and what are their names? The number and names go in `~/threads.txt`" | `threads-demo 6` as a service | number = `@ref('ls /proc/$(pgrep threads-demo)/task \| wc -l')` (7: the main one and 6); names against `/proc/*/task/*/comm`, order does not matter | — |
| `linux.m15.drill.2` | M15, B | "In which directories did `env` look for `hello` with `PATH=/opt/a:/opt/b:/usr/local/bin`? The attempts, in order, go in `~/tries.txt`" | `/usr/local/bin/hello` | `/opt/a/hello`, `/opt/b/hello`, `/usr/local/bin/hello` (reference from `strace -f -e trace=execve`, the first two are `ENOENT`); rung 2: a fragment of `strace(1)` with `-e trace=` highlighted | — |
| `linux.m15.drill.3` | M15, B | "Run `sleep 1000` as PID 1 in a new PID namespace so that `ps` inside shows only it and the shell. From the host, try `kill -TERM`, then `kill -KILL`. What worked and why goes in `~/pid1.txt`" | — | a process with `nspid=[N,1]` and `cmd='sleep 1000'` was observed; it is gone now; the first line of the file `=~ KILL`; the explanation — `explain` by the rubric "init has no TERM handler" | — |
| `linux.m15.drill.4` | M15, B | "`unshare --pid bash` without `--fork` behaves strangely. Run it, run `ls` twice, explain the error" | — | `explain` by rubric: the first child became PID 1 and exited, after which `fork: Cannot allocate memory` (`pid_namespaces(7)`); `soft`: later in the history there is `unshare --pid --fork --mount-proc` | — |
| `linux.m15.drill.5` | M15, B (L1, L2) | "In the first terminal run `sudo unshare --uts --net bash` and `hostname lab-box`. In the second, enter the same namespaces of that process and show that the name is `lab-box` and `ip a` shows only `lo`" | — | an `nsenter` process was observed with `ns.uts` and `ns.net` the same as the first terminal's process; the host's `env.hostname` did not change | — |
| `linux.m15.drill.6` | M15, B | "Assemble a root from `busybox` in `/lab/root` and start a shell in it via `chroot`. After `mount -t proc proc /proc` inside, look at `ps`. What chroot isolated and what it did not goes in `~/chroot.txt`" | `/lab` is tmpfs | `files['/lab/root/bin/busybox'].exists`; a process with `root=/lab/root` was observed; `explain`: "the visible root is isolated; processes, network, hostname are shared" | — |
| `linux.m15.drill.7` | M15, B | "Assemble an overlay: lower layer `/lab/lower`, upper `/lab/upper`, result in `/lab/merged`. Modify `etc/motd`, delete `etc/issue`. Show that in the lower layer both files are unchanged" | `/lab/lower` with files | `mounts[target='/lab/merged'].type=overlay && mounts[target='/lab/merged'].upper='/lab/upper'`; `files['/lab/lower/etc/motd'].sha256=@start`; `files['/lab/upper/etc/motd'].exists`; `files['/lab/upper/etc/issue'].type=c`; `fail`: upper on 9p — "this FS does not store the required attributes: use /lab" | "after an edit in merged the image changed": upper points to lower |
| `linux.m15.drill.8` | M15, B | "Limit `memhog 64` to 32 MB so that the kernel stops it rather than the machine. Find the evidence in the cgroup files and in the kernel log; the log line goes in `~/oom.txt`" | — | `cgroups[path~'/lab'].memory.max<=32M` or `units[run-*.scope].props.MemoryMax<=33554432`; `memory.events.oom_kill>=1`; `!procs[cmd~memhog]`; `files['~/oom.txt'].text=~'Memory cgroup out of memory\|oom-kill'`; the machine is alive (`units[nginx.service].active=active`). Both `mkdir /sys/fs/cgroup/lab` + `cgroup.procs` and `systemd-run --scope -p MemoryMax=32M` are accepted | "a limit is set, but OOM killed a neighbor": the process was not moved into the group |
| `linux.m15.drill.9` | M15, B | "`spawner` spawns 200 `sleep`s. No more than 20 processes in its group; the script must get an error rather than hang the machine" | `spawner` | `cgroups[procs~@pid(spawner)].pids.max<=20`; `cgroups[...]['pids.events'].max>=1`; `#procs[cmd=sleep]<=20` | — |
| `linux.m15.drill.10` | M15, B (L1, L2) | "`burner` takes the whole CPU. Give it no more than 25% without restarting it. Confirm with a number from `cpu.stat`" | `burner` in its own group | `cgroups[procs~@pid(burner)].cpu.max` with a field ratio ≤ 0.25; `keep: procs[cmd=burner].pid=@start.pid(burner)`; `cpu.stat.nr_throttled` grows between two samples | — |
| `linux.m15.drill.11` | M15, B | "`/srv/web-demo` must listen on port 80 as user `student` — without sudo at start, without setuid, without changing the port" | the file on the `/srv` ext4 | `net.listen[port=80].pid` → `procs[user=student]`; `files['/srv/web-demo'].caps~'cap_net_bind_service'`; `!files['/srv/web-demo'].perm.setuid`; `fail`: a copy on the root — "this FS does not store capabilities" | — |
| `linux.m15.drill.12` | M15, B (L1, L2) | "Compare the privileges of your shell and of root's shell (`capsh --print`, `grep Cap /proc/self/status`). Which privilege lets root read someone else's `0600` file?" | — | the answer in the file `=~ CAP_DAC_(OVERRIDE\|READ_SEARCH)` | — |
| `linux.m15.drill.13` | M15, B (L2) | "Become root inside a user namespace without sudo. Create `~/ns-file` and show whose it is from outside. Try to modify `/etc/hostname` and explain the refusal" | — | a process with `uidMap` `0 1000 1` was observed; `files['~/ns-file'].owner=student`; `explain`: "root only in its own namespace; the permissions of the real UID apply to host files" | — |
| `linux.m15.drill.14` | M15, B (L2) | "Run `date -s 12:00` under systemd so that the kernel forbids the system calls that change the time. What is the result and which signal?" | — | the answer `=~ SIGSYS`; `units[run-*.service].result=signal` (`systemd-run --wait -p SystemCallFilter=~@clock date -s 12:00`); rung 4: the directive is to be found in `systemd.exec(5)` | — |
| `linux.m16.drill.1` | M16, B×2 | "Set up key login from `laptop` to `server` through the name `server` in `~/.ssh/config`, then disable password login on `server`" | two machines on `vswitch`, password login on `server` | on `laptop`: `probe: { as: student, run: "ssh -o BatchMode=yes server true", expect_exit: 0 }`; password disabled — see the check in `linux.exam.access`; `~/.ssh` permissions `700`, `authorized_keys` without `w` for group and others | "the key is not accepted": `authorized_keys` 664 |

M15 final task (rung 4): "The `report-builder` service sometimes eats all the memory and brings down its neighbors. Let it live within 48 MB, spawn no more than 30 processes, not see `/home` and run without kernel privileges — using the unit file, without changing the program." Check: `units[report-builder.service].active=active`; `cgroups[path~'report-builder'].memory.max<=48M && cgroups[path~'report-builder'].pids.max<=30`; `probe: { unit: report-builder, run: "ls /home", expect_exit_not: 0 }` (`ProtectHome=` or `TemporaryFileSystem=/home`); `procs[cmd~report-builder].capEff=0`. None of the four directives is shown in the theory: documentation — `systemd.resource-control(5)`, `systemd.exec(5)`.

### 8.3. Block exams

Exams run on tier B at rung 5 of the documentation ladder: `man`, `--help`, `apropos` in the machine and the "Documentation" panel with the allowlist (7.6) are open; there are no hints and no mentor; the timer is a guideline, not a cutoff; one "roll the machine back to the start" attempt is allowed. In each exam one mandatory task relies on something that was not in the course. Grading is by `goals`; the post-exam report shows which goals passed, the command timeline, the documentation pages opened and the reference diagnostic path. The exam is passed if all mandatory goals are met.

#### `linux.exam.service` "The service does not start" (after M11, 30 minutes)

Story: "The development team rolled out a new version of the internal `orders` service. After a reboot the server does not respond on `http://localhost:8080/health`. Fix it without changing the application code. Operations also asks that the service receive the variable `ORDERS_MODE=prod`."

Preparation in the starting snapshot. `orders-server` is a static i386 program: it serves `/health` (the body contains the value of `ORDERS_MODE`) and reads settings from the file given by the `--config` flag. The unit runs `ExecStart=/opt/orders/bin/orders-server --config /etc/orders/config.env`; `EnvironmentFile=` is not used (otherwise systemd would read the file as root, and breakage 2 would disappear). CI checks that after fixing breakage 1 the journal really shows `permission denied`, and after breakage 2 — `address already in use`.

1. `ExecStart=/opt/orders/bin/order-server` — a typo; `systemctl status` shows `status=203/EXEC`.
2. `/etc/orders/config.env` belongs to `root` with mode `0600`, while the service runs as `User=orders`; the journal shows `permission denied: /etc/orders/config.env`.
3. Port 8080 is taken by a forgotten enabled service `debug-listener.service` (`ExecStart=/usr/bin/nc -lk 8080`, description "temporary debug listener"): it survives reboots, and that is exactly why the server "does not respond after a reboot". The `orders` journal shows `address already in use`.
4. The `orders` unit is not enabled (`disabled`) — this is visible right away in `systemctl status`.

The first three breakages become visible only after the previous one is fixed; the fourth is visible from the very start. The rung-5 task: `ORDERS_MODE=prod` (the `Environment=` directive is not shown in the theory; the best solution is `systemctl edit orders`).

```yaml
goals:
  - { id: active,  when: "units[orders.service].active=active && units[orders.service].enabled=enabled" }
  - { id: health,  envs: [v86, vm], probe: { run: "curl -s http://localhost:8080/health", stdout_regex: "\"status\":\"ok\".*\"mode\":\"prod\"" } }
  - { id: owner,   when: "net.listen[port=8080].pid=@pid(orders-server)" }
  - { id: secret,  when: "files['/etc/orders/config.env'].perm.o='---'" }                 # secrets are not open to everyone
  - { id: code,    when: "files['/opt/orders/bin/orders-server'].sha256=@start" }          # the code was not touched
  - { id: user,    when: "units[orders.service].props.User=orders" }                       # not switched to root
  - { id: debug,   when: "units[debug-listener.service].enabled!=enabled" }
  - { id: reboot,  envs: [v86, vm], probe: { action: reboot, then: ["units[orders.service].active=active", "net.listen[port=8080].pid=@pid(orders-server)"] } }
soft:
  - { history_absent: "chmod 777", note: "Secrets must not be open to everyone; the orders group or owner is enough." }
  - { history_contains: "journalctl", note: "Causes 2 and 3 cannot be seen without the journal — starting with it is a good habit." }
```

Acceptable solutions for the second step: `chown root:orders` + `0640`, `chown orders` + `0600`. An ACL on this file is impossible (the root on 9p does not store ACLs), so it is not among the acceptable solutions; ACLs are checked in `linux.m05.drill.4` on `/srv`. Not acceptable: `User=root` in the unit, `0644`/`0666` on the file.

#### `linux.exam.disk` "The partition is full" (after M13, 35 minutes)

Story: "Monitoring reports: on `app-01` the `/var` partition is 100% full, and the application has stopped writing orders. Free up space without losing the application's data, and make sure the situation does not repeat. The systemd journal on this server must not take up more than 50 MB."

Preparation: `/var` in this snapshot is a separate ext4 on a 160 MB `hdb`, mounted via `fstab` (a typical server layout); the root stays on 9p. The fill is written as repeating blocks so that the snapshot stays within budget:

1. `/var/log/legacy/debug.log` (45 MB) is deleted but held open by the `legacy-agent` service — `du` does not see it, `lsof +L1` does.
2. `/var/cache/apt/archives` — 15 MB of packages (safe to clean with `apt clean`).
3. `/var/tmp/student/` — 10 MB of temporary files.
4. `/var/lib/orders/` — 25 MB of application data (must not be touched).
5. `/etc/cron.d/legacy-dump` writes a 1 MB dump into `/var/backups/legacy/` every 2 minutes.
6. There is no logrotate rule for `/var/log/legacy/*.log`.

The rung-5 task: the journal is no larger than 50 MB (`SystemMaxUse=` in `journald.conf` or a drop-in).

```yaml
goals:
  - { id: free,    needs: [mounts], when: "mounts[target=/var].free>=40M" }
  - { id: data,    when: "files['/var/lib/orders'].sha256tree=@start" }                   # data intact
  - { id: app,     when: "procs[cmd=orders-server]" }
  - { id: cron,    when: "!cron[file='/etc/cron.d/legacy-dump'] || cron[file='/etc/cron.d/legacy-dump'].line=~'^#'" }
  - { id: rotate,  envs: [v86, vm], probe: { run: "logrotate -d /etc/logrotate.d/legacy 2>&1", stdout_regex: "rotating pattern: /var/log/legacy/\\*\\.log" } }
  - { id: journal, envs: [v86, vm], probe: { run: "systemd-analyze cat-config systemd/journald.conf", stdout_regex: "^SystemMaxUse=50M" } }
  - { id: stable,  envs: [v86, vm], probe: { action: wait, seconds: 300, then: ["mounts[target=/var].free>=35M"] } }   # space is not leaking
soft:
  - { history_contains: "lsof", note: "A deleted but open file is found with lsof +L1 or via /proc/*/fd." }
  - { history_absent: "rm -rf /var/lib", note: "Application data must not be deleted." }
```

The fields `mounts[].free` and `files[].sha256tree` are a request to 09 (4.4). Both ways of getting the 45 MB back are accepted: restarting `legacy-agent` or truncating through `/proc/<pid>/fd/<n>` (`: > /proc/PID/fd/N`). Time is not sped up: the `stable` goal honestly waits 5 minutes while the learner writes a short postmortem (what happened, what was done, what is proposed); the text is not graded automatically but is saved for the mock interview (step 10 of the roadmap).

#### `linux.exam.isolation` "Neighbors get in each other's way" (after M15, 35 minutes; for L0 a lighter variant without items 4–5)

Story: "There are two services on the server: `batch` eats memory and CPU, and because of that `api` responds slowly and crashes. Limit `batch` without touching its code, and prove that the limit works. When memory runs out, `api` must be the last to die."

Breakages: `batch` has no limits; `api` is killed by the global OOM killer (`dmesg` shows `Out of memory: Killed process`); `batch` spawns up to 300 children; `batch.service` has `User=root`, although it does not need root; `MemoryMax=` is written in the `[Unit]` section, and systemd ignores it with a warning in the journal (`Unknown key name 'MemoryMax' in section 'Unit', ignoring`). Rung-5 tasks: `batch`'s CPU share is lower than `api`'s under contention (`CPUWeight=`; the course shows only `cpu.max`), and `api` is protected from the OOM killer (`OOMScoreAdjust=`).

```yaml
goals:
  - { id: mem,    when: "cgroups[path~'batch.service'].memory.max<=64M" }
  - { id: pids,   when: "cgroups[path~'batch.service'].pids.max<=50" }
  - { id: user,   when: "units[batch.service].props.User!=root && units[batch.service].props.User!=''" }
  - { id: weight, when: "units[batch.service].props.CPUWeight<units[api.service].props.CPUWeight" }
  - { id: oom,    when: "units[api.service].props.OOMScoreAdjust<0" }
  - { id: stable, envs: [v86, vm], probe: { action: wait, seconds: 180, then: ["units[api.service].active=active", "units[api.service].restarts=@start"] } }
soft:
  - { history_contains: "systemd-analyze verify", note: "systemd-analyze verify finds directives in the wrong section before a restart." }
```

#### `linux.exam.access` "Access for a new developer" (after M16, 40 minutes, two machines)

Story: "A developer, Maria, has joined the team. She needs key login to `server`, a deployment directory `/srv/releases` shared with the team, and the right to restart only the `orders` service, without full sudo. It is time to disable password login for everyone, and to let only the `devs` group in over ssh."

Preparation: `laptop` with a user `maria` without keys; `server` with the group `devs` (containing `alex`), the `orders` service, and password login; the machines are on `vswitch`. The rung-5 task: `AllowGroups devs` (not shown in the M16 theory).

```yaml
goals:
  - on: server
    goals:
      - { id: user,     when: "users[name=maria].shell=/bin/bash && users[name=maria].groups~devs" }
      - { id: sshdir,   when: "files['/home/maria/.ssh'].perm.g='---' && files['/home/maria/.ssh'].perm.o='---'" }
      - { id: keys,     when: "files['/home/maria/.ssh/authorized_keys'].perm.g!~'w' && files['/home/maria/.ssh/authorized_keys'].perm.o!~'w'" }
      - { id: releases, when: "files['/srv/releases'].group=devs && files['/srv/releases'].perm.setgid && files['/srv/releases'].perm.g=rwx" }
      - { id: newfile,  envs: [v86, vm], probe: { as: maria, run: "touch /srv/releases/m && stat -c %G /srv/releases/m", stdout_regex: "^devs$" } }
      - { id: sudo-ok,  envs: [v86, vm], probe: { as: maria, run: "sudo -n systemctl restart orders", expect_exit: 0 } }
      - { id: sudo-no,  envs: [v86, vm], probe: { as: maria, run: "sudo -n systemctl restart ssh", expect_exit_not: 0 } }
      - { id: shadow,   envs: [v86, vm], probe: { as: maria, run: "sudo -n cat /etc/shadow", expect_exit_not: 0 } }
      - { id: sudoers,  envs: [v86, vm], probe: { run: "visudo -c", stdout_regex: "parsed OK" } }
      - { id: nopass,   envs: [v86, vm], probe: { run: "sshd -T", stdout_regex: "(?s)passwordauthentication no.*kbdinteractiveauthentication no|(?s)kbdinteractiveauthentication no.*passwordauthentication no" } }
      - { id: groups,   envs: [v86, vm], probe: { run: "sshd -T", stdout_regex: "^allowgroups devs$" } }
  - on: laptop
    goals:
      - { id: key-in,   envs: [v86, vm], probe: { as: maria, run: "ssh -o BatchMode=yes server true", expect_exit: 0 } }
      - { id: no-pw,    envs: [v86, vm], probe: { as: maria, run: "ssh -v -o BatchMode=yes -o PubkeyAuthentication=no -o PreferredAuthentications=password,keyboard-interactive server true 2>&1", stdout_not_regex: "Authentications that can continue:.*(password|keyboard-interactive)" } }
      - { id: known,    when: "files['/home/maria/.ssh/known_hosts'].exists" }
soft:
  - { history_contains: "visudo", note: "Edit sudoers via visudo or a file in /etc/sudoers.d — otherwise a single typo takes sudo away from everyone." }
  - { history_contains: "sshd -t", note: "Check the sshd settings before reload: if there is an error, you will lose access to the server." }
```

Why the "password disabled" check is built this way: a login attempt with `BatchMode=yes` and no key fails even when password login is allowed (BatchMode forbids asking for a password), and without `BatchMode` it hangs at the prompt. So the client only asks the server which methods it offers (the `Authentications that can continue:` line in `ssh -v`), and the server shows the effective settings via `sshd -T`. In Debian 12 the settings may be in `/etc/ssh/sshd_config.d/*.conf`, and the first value found wins: `sshd -T` shows the result, a `grep` over one file does not. A separate paragraph of the review covers the trap "turned off `PasswordAuthentication`, but `KbdInteractiveAuthentication` with PAM still lets people in with a password".

The exam's trap: if the learner disables password login before checking key login and gets the permissions wrong, they lose access to `server` from `laptop`. The `server` console remains available (like a provider's console in the cloud), and the review shows why the order "check the key → `sshd -t` → reload" matters. The `users[]` field is a request to 09 (4.4).

#### `linux.exam.cloud` (optional). The same on a real VM

The learner orders the cheapest VM (Debian 12 or Ubuntu 24.04) in a cloud of their choice or brings up a local VM on their own computer (09 §5.2–5.3), runs the scenario's open installer (`curl -fsSL https://<cdn>/exam/service.sh -o service.sh`, reads it, then `sudo bash service.sh`) and passes `linux.exam.service` for real. The facts are collected and signed by the `trainer-exam` agent, which the learner installs on this machine themselves with `trainer-exam enroll <code>` (09 §5.4), and the predicates are computed by `dt-api`; the result goes into the profile as presentable. The last step is mandatory cleanup: for a cloud VM the trainer shows the hourly cost and checks that the learner deleted it (or noted that they are keeping it for the Kubernetes block).

---

## 9. The AI mentor in the Linux block

Connecting your own model, storing the key and adapters — 09 §4; pedagogical behavior, the H1–H5 hint ladder and the rule "there is no ready-made solution on any rung" — 01 §14. If the learner asks "just tell me the command", the mentor explains in one phrase why it won't and offers the next hint rung. Here — what the Linux block adds.

**Context** (the fields of 01 §14.4 plus): module, lesson and step; the task text; the last 10 commands with exit codes and up to 4 KB of their output; the list of introduced graph concepts and the outline of the current chapter (5.3) with an instruction to explain only through them; the level; the documentation rung `doc_step`; for an unmet goal — its `id`, the triggered `fail` and the `matched` paths. The reference solution is not passed into the context. The mentor's answer does not execute commands in the machine.

**Modes by documentation rung:**

| Rung | What the mentor does |
|---|---|
| 1–2 | The H1–H5 ladder as in 01; may quote a manual page line if it is a fragment the task shows anyway |
| 3 | Does not name the flag; names the page and section: "`man find`, the TESTS section — search for the word "newer"" |
| 4 | Works according to the instruction below |
| 5 (exam), quizzes, exit tickets, entry check | Turned off by the engine |

The rung-4 system instruction (inserted into the prompt verbatim):

> On this task the learner is learning to find the answer in the documentation. Do not name the command, flag, configuration option or manual page name. First ask: "Where have you already looked?". If the learner named a source, ask what they searched for there and with which word; suggest a different keyword for `man -k` or for `/` search inside the page. If they have not looked anywhere, name only the type of source: "commands — `man -k <word>` or `<command> --help`; service settings — a section 5 page, search by the settings file name; unit file directives — the `systemd.*` pages of section 5; bash builtins — `help`; a whole package — `/usr/share/doc/<package>`". You may explain how to read an already open page (what SYNOPSIS means, where FILES is). You may not quote the line that solves the task.

A redirection on rung 4 is logged as `hint.opened` with `level: redirect` and does not affect the review rating. The "Explain" button is next to every command output and every unmet goal; in the free sandbox the mentor analyzes any commands without restrictions (01 §14.1).

---

## 10. What we reuse from the Sankofa engine

| What in Sankofa | Where in the Linux block |
|---|---|
| `features/model.ts`: bilingual `Bi {en, ru}` blocks, block roles, the `draft` flag | The format of chapters, tasks, hints, questions (YAML) |
| `hold` + the two-source rule (`mechanics/checks`) | Every statement of a chapter ("SIGKILL cannot be caught", "`on-abnormal` does not restart on a non-zero code") comes with a manual page of that version and a check on `lab-debian`; without the second confirmation the block does not get into the build. The source log is the "How we know this" card |
| Magazine-style text presentation, `engine/scroll.ts` | Textbook chapters; scrolling drives the explainer's stepper until the learner takes it in hand |
| `engine/layers.ts` | overlayfs layers in X9 (SVG sheets) |
| `engine/calm.ts` | The "step by step" mode without motion; enabled by default according to the system setting |
| `Lens` ("Rashomon", `engine/lenses.ts`) | "Three views of one command" (6.5) |
| `engine/qr.ts`, `isPhone` | Continuing a lesson on a computer; the "do not start v86" decision (1.6) |
| `mechanics/sheet.ts` | The "Documentation" panel, the exam report, concept cards |
| `mechanics/cabinet/store.ts` (storage with fallback to page memory) | Settings and progress according to the rules of 09 §3 |
| Glossary links `[[card-id\|words]]` | Marking graph concepts in chapters; a link to a concept not yet introduced is a build error |
| `engine/ink.ts` (ink) | **Not used**: mechanisms in the Linux block are drawn only as technical drawings (08 §5.1, R5) |
| `engine/clap.ts` (sound) | Not used: there are no sounds, except the terminal's system bell, which is off by default |

---

## 11. Sources

Each chapter ends with 2–4 links in English and in Russian. The main English source for commands and formats is the pages for the version installed on the machine: [manpages.debian.org/bookworm](https://manpages.debian.org/bookworm/). Russian man pages on OpenNet are largely taken from FreeBSD or old GNU versions, so they are used only where they match Debian 12 (this is checked under the two-source rule); the main Russian source is the Russian ArchWiki and translations on manpages.debian.org where they exist.

**General courses and references.** EN: The Linux Command Line, William Shotts — [linuxcommand.org/tlcl.php](https://linuxcommand.org/tlcl.php); Linux Journey — [linuxjourney.com](https://linuxjourney.com/); Debian Reference — [debian.org/doc/manuals/debian-reference](https://www.debian.org/doc/manuals/debian-reference/); [man7.org/linux/man-pages](https://man7.org/linux/man-pages/); [explainshell.com](https://explainshell.com/). RU: Debian Handbook — [debian-handbook.info/browse/ru-RU/stable](https://debian-handbook.info/browse/ru-RU/stable/); the Russian ArchWiki (sections below).

**M1 FS and FHS.** EN: [FHS 3.0](https://refspecs.linuxfoundation.org/FHS_3.0/fhs/index.html), [hier(7)](https://manpages.debian.org/bookworm/manpages/hier.7.en.html). RU: [ru.wikipedia.org/wiki/FHS](https://ru.wikipedia.org/wiki/FHS).

**M3 help.** EN: [man-pages(7)](https://man7.org/linux/man-pages/man7/man-pages.7.html) (page structure), [man(1)](https://manpages.debian.org/bookworm/man-db/man.1.en.html). RU: [ArchWiki: man page (Russian)](https://wiki.archlinux.org/title/Man_page_(%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9)).

**M4–M5 users and permissions.** EN: [chmod(1)](https://manpages.debian.org/bookworm/coreutils/chmod.1.en.html), [path_resolution(7)](https://man7.org/linux/man-pages/man7/path_resolution.7.html), [acl(5)](https://manpages.debian.org/bookworm/acl/acl.5.en.html), [ArchWiki: File permissions and attributes](https://wiki.archlinux.org/title/File_permissions_and_attributes). RU: [ArchWiki: File permissions and attributes (Russian)](https://wiki.archlinux.org/title/File_permissions_and_attributes_(%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9)), [ArchWiki: Users and groups (Russian)](https://wiki.archlinux.org/title/Users_and_groups_(%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9)).

**M6 text and pipelines.** EN: [pipe(7)](https://man7.org/linux/man-pages/man7/pipe.7.html), [GNU Awk User's Guide](https://www.gnu.org/software/gawk/manual/), [GNU sed manual](https://www.gnu.org/software/sed/manual/), [sha256sum(1)](https://manpages.debian.org/bookworm/coreutils/sha256sum.1.en.html). RU: the translation of The Linux Command Line (chapters on redirection and text processing).

**M8 processes and signals.** EN: [signal(7)](https://man7.org/linux/man-pages/man7/signal.7.html), [fork(2)](https://man7.org/linux/man-pages/man2/fork.2.html), [execve(2)](https://man7.org/linux/man-pages/man2/execve.2.html), [ps(1)](https://manpages.debian.org/bookworm/procps/ps.1.en.html). RU: Linux Journey, the "Processes" section (Russian translation); the translation of `signal(7)` on manpages.debian.org where available.

**M9 bash.** EN: [GNU Bash Reference Manual](https://www.gnu.org/software/bash/manual/), [ShellCheck](https://www.shellcheck.net/), [jq manual](https://jqlang.org/manual/). RU: [translation of the Advanced Bash-Scripting Guide](https://www.opennet.ru/docs/RUS/bash_scripting_guide/), [Habr: Bash scripts, part 1](https://habr.com/ru/companies/ruvds/articles/325522/).

**M10 packages.** EN: [Debian Reference, ch. 2](https://www.debian.org/doc/manuals/debian-reference/ch02.en.html). RU: [wiki.debian.org/ru/Apt](https://wiki.debian.org/ru/Apt).

**M11–M12 systemd, logs, scheduling.** EN (bookworm, systemd 252): [systemd.service(5)](https://manpages.debian.org/bookworm/systemd/systemd.service.5.en.html), [systemd.unit(5)](https://manpages.debian.org/bookworm/systemd/systemd.unit.5.en.html), [systemd.exec(5)](https://manpages.debian.org/bookworm/systemd/systemd.exec.5.en.html), [journalctl(1)](https://manpages.debian.org/bookworm/systemd/journalctl.1.en.html), [crontab(5)](https://manpages.debian.org/bookworm/cron/crontab.5.en.html). RU: [ArchWiki: systemd (Russian)](https://wiki.archlinux.org/title/Systemd_(%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9)), [ArchWiki: systemd/Journal (Russian)](https://wiki.archlinux.org/title/Systemd/Journal_(%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9)), [ArchWiki: systemd/Timers (Russian)](https://wiki.archlinux.org/title/Systemd/Timers_(%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9)), [ArchWiki: Cron (Russian)](https://wiki.archlinux.org/title/Cron_(%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9)).

**M13 disks.** EN: [fstab(5)](https://manpages.debian.org/bookworm/mount/fstab.5.en.html), [mount(8)](https://manpages.debian.org/bookworm/mount/mount.8.en.html), [ext4(5)](https://manpages.debian.org/bookworm/e2fsprogs/ext4.5.en.html). RU: [ArchWiki: fstab (Russian)](https://wiki.archlinux.org/title/Fstab_(%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9)), [ArchWiki: tmpfs (Russian)](https://wiki.archlinux.org/title/Tmpfs_(%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9)).

**M14 kernel and /proc.** EN: [The /proc Filesystem (kernel docs)](https://docs.kernel.org/filesystems/proc.html), [proc(5)](https://man7.org/linux/man-pages/man5/proc.5.html), [strace(1)](https://manpages.debian.org/bookworm/strace/strace.1.en.html). RU: the Russian ArchWiki on `/proc` and `sysctl`.

**M15 isolation and limits.** EN: [namespaces(7)](https://man7.org/linux/man-pages/man7/namespaces.7.html), [pid_namespaces(7)](https://man7.org/linux/man-pages/man7/pid_namespaces.7.html), [user_namespaces(7)](https://man7.org/linux/man-pages/man7/user_namespaces.7.html), [cgroups(7)](https://man7.org/linux/man-pages/man7/cgroups.7.html), [Control Group v2](https://docs.kernel.org/admin-guide/cgroup-v2.html), [capabilities(7)](https://man7.org/linux/man-pages/man7/capabilities.7.html), [Overlay Filesystem](https://docs.kernel.org/filesystems/overlayfs.html), [seccomp(2)](https://man7.org/linux/man-pages/man2/seccomp.2.html), [systemd.resource-control(5)](https://manpages.debian.org/bookworm/systemd/systemd.resource-control.5.en.html). RU: [ArchWiki: cgroups (Russian)](https://wiki.archlinux.org/title/Cgroups_(%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9)), [ArchWiki: Capabilities](https://wiki.archlinux.org/title/Capabilities); articles on namespaces on Habr — only after checking under the two-source rule.

**M16 ssh.** EN: [ssh(1)](https://man.openbsd.org/ssh), [sshd_config(5)](https://man.openbsd.org/sshd_config), [ssh-keygen(1)](https://man.openbsd.org/ssh-keygen). RU: [ArchWiki: SSH keys (Russian)](https://wiki.archlinux.org/title/SSH_keys_(%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9)).

**Tier B technologies.** [v86](https://github.com/copy/v86): [lib/9p.js](https://github.com/copy/v86/blob/master/lib/9p.js) (no xattr), [docs/filesystem.md](https://github.com/copy/v86/blob/master/docs/filesystem.md), [docs/networking.md](https://github.com/copy/v86/blob/master/docs/networking.md), [tools/docker/debian](https://github.com/copy/v86/tree/master/tools/docker/debian); [util-linux in bookworm, file list](https://packages.debian.org/bookworm/i386/util-linux/filelist); [xterm.js](https://github.com/xtermjs/xterm.js); for comparison — [WebVM](https://github.com/leaningtech/webvm), [CheerpX license](https://cheerpx.io/docs/licensing), [container2wasm](https://github.com/container2wasm/container2wasm), [linux-wasm](https://github.com/joelseverin/linux-wasm), [JSLinux](https://bellard.org/jslinux/), [env86](https://github.com/progrium/env86), [wanix](https://github.com/tractordev/wanix).

---

## 12. Implementation order and requests to neighboring documents

### 12.1. First work items

1. **Tier B spike (1 week, part of phase 0 from 09 §7).** Build `lab-debian` per 1.3 on `dt-kernel`, the snapshot in CI, measure size and start time on three machines (MacBook Air M1, a Windows laptop with 8 GB, a Chromebook with 4 GB) in three browsers. Separately check: a 256 MB `hda` with `/srv` and written blocks in `save_state` (snapshot size with a disk), the 1.3 xattr test on ext4 and tmpfs, the negative test on 9p, two 128 MB machines on `vswitch` with systemd, sshd and journald, and what `systemd-detect-virt`, `/sys/class/dmi/id/*` and `dmesg | head` show in v86 (the texts for the "Where you are" screen in M14). Thresholds — 09 §1.4.
2. **Agent**: the requirements of 4.2, events through a file, the facts of 4.4, goal tests on every starting snapshot.
3. **Stand**: model, parser, 86 commands, the real `man` texts, comparison against `lab-debian` in CI.
4. **Explainers** in module order: X2, X3, X5, X1, X4, X10, X6, X7, X8, X9, X11; diagrams 6.1–6.5.
5. **Content**: chapters and lessons M0–M7 (Stand) in parallel with M8–M15; M16 — together with the "Networks" block; exams — after the agent; rung 3–4 tasks — together with the chapters of their modules.

### 12.2. What is needed from other documents

| Document | What | Why |
|---|---|---|
| 01 | Concepts L33–L43 per table 5.1 (rename L39 to "tmpfs and bind mount", add L42 PID 1 and L43 chroot); L26 requires L17, L03; split L31 into JSON (Linux, M9) and YAML (06); D03/D04/D05/D09 — "the same in Docker" with prerequisites on L35/L36/L43/L40; N21 requires L35; N18 introduces the key pair, N12 uses it; route: M16 after N5 | The graph must match the 02 modules, otherwise the order build fails |
| 03 | Accept the quiz and the "who is listening on the port" drill from the former network module (into N5); do not re-introduce the key pair in N12; the SSH card in the protocol catalog links to M16 | Networking and SSH are introduced once |
| 04 | Rely on L33–L43 from M15 and on explainers X6–X9 (the same overlay widget); do not re-introduce namespaces, cgroups, capabilities, chroot, overlayfs, PID 1 | R6: everything the containers block relies on is introduced in Linux |
| 08 | The "manual page anatomy" widget (6.3) as shared across blocks; the "Documentation" panel | All blocks need the documentation ladder |
| 09 | Kernel: the configuration fragments from 1.3 (`EXT4_FS_POSIX_ACL`, `EXT4_FS_SECURITY`, `TMPFS_XATTR`, `SECURITY_DMESG_RESTRICT=y` and others); the fact fields of 4.4 plus `users[]`, `mounts[].free`, `files[].sha256tree`; the `@ref(cmd)` macro; `probe` kinds: `as`, `action: reboot`, `action: wait`, `unit`; `vswitch` instead of `inbrowser` for multi-machine labs (1.5); `RefuseManualStop` and events through a file for `trainer-agent` | The Linux block's checks and machines stand on the platform |
| 10 | The entry check task variants from 2.2 — into the bank `content/bank/linux/placement/` | A single entry check system |

---

## Changes after review

Reviews: `reviews/02-linux--by-04-containers.md` (hereafter "C", 31 comments) and `reviews/02-linux--by-01-andragogy.md` (hereafter "A", 31 comments), plus the owner's additional requirements R1–R12.

### What was changed

**Owner's requirements.**
- **R1** (priorities: textbook, explainers, documentation). The introduction names the priorities; a module is now a textbook chapter of 1,500–3,000 words plus lessons following the 01 §7 anatomy (5.2); chapter outlines with a hook, statements in order of presentation, an explainer and a primary source were written for all 17 modules (5.3); the module table got columns for graph concepts, explainer and documentation rung (5.1).
- **R2** (documentation ladder). New section 7: rungs 1–5 by level (L2 — from rung 3), transition rules, the `doc`/`doc_task` format, rung 2, 3 and 4 tasks by module with result-based checks, the "Documentation" panel with a local mirror and an allowlist, exams at rung 5 with a task beyond the course in each; mentor modes by rung and the verbatim rung-4 instruction (section 9). Real man pages were returned to the image (removing the slim exclusions, `manpages-dev`, `mandb`), the Stand shows the real page texts, and module M3 teaches page anatomy, SYNOPSIS, sections, `man -k`, `help`, `info`.
- **R3/R4** (explainers). Section 6 was rewritten: general rules (technical drawing, kernel at the bottom, labels on lines, click on any element, parameters with immediate recomputation and a Δ line, "break it" with a prediction, a forward-backward stepper), eleven storyboards X1–X11 screen by screen: boot, Enter → PATH → fork → exec → wait, pipeline, systemd service restart, permission check, signals and PID 1, namespaces, cgroups and OOM, overlayfs, disk → FS → mount, SSH through a switch.
- **R5** (beauty). The terminal is described (6.0): font, theme from 08 tokens, root prompt color, kernel message band, markup over output. Sankofa's ink, "plumbing", characters and metaphors were removed; what is kept from Sankofa is listed in R5.
- **R6** (how the kernel isolates and limits). The new module M15 is mandatory for all levels: a chapter of eight sections, lessons with depth by level, 14 drills, a final task, a quiz, the `linux.exam.isolation` exam; concepts L33–L43; threads, fork/exec/clone, PID 1, all kinds of namespaces, cgroup v2 with an OOM drill, capabilities, chroot, overlayfs, seccomp. The kernel module (M14) also became mandatory for L0. Concepts that the Docker block relies on and that were previously introduced nowhere are now introduced: `tar`/`gzip` (M2), `sha256sum` (M6), JSON and `jq`, `exec` in the shell (M9), service output to the journal (M11), tmpfs and bind mount (M13).
- **R7c** (grounding in the Linux block). The "Where you are" screen in M14: the machine in the browser is emulated, has one CPU, `dmesg`, DMI; the `forward: [D02]` card.
- **R11** (several machines). The two machines of M16 and of the access exam are connected through `vswitch` (the mechanism is in 09), with `net.packet` events for X11 and "disable port" toggles; 128 MB per node.
- R8–R10, R12 do not apply to the Linux block directly; related items (port as `forward`, the bridge from X4 and X8 to Kubernetes, an exam on a real VM with cleanup) are taken into account.

**Blocking comments.**
- **Root on 9p without xattr (C1, A18).** Checked against `lib/9p.js`: `Txattrwalk` answers `EOPNOTSUPP`. Reviewer C's option B was accepted: the root stays on 9p (keeping `fs-probe`, the live tree and the A → B transition), ACLs, capabilities and `chattr` go to the `/srv` ext4 (`hda`), overlay and chroot to the `/lab` tmpfs; CI has a positive and a negative xattr test. The E1 solution via ACL was removed, and the ACL drill moved to `/srv`.
- **The containers foundation is inaccessible to a beginner (C2, A1).** Modules M14 and M15 are mandatory for all levels.
- **Identifiers (C3, A6).** Modules — M0…M16 / `linux.mNN`, drills — `linux.mNN.drill.N`, exams — `linux.exam.<slug>`, levels — `L0/L1/L2`, concepts — only from graph 01.
- **FIFO hangs the shell (C4, A10).** Events are written by appending to a file on tmpfs; `RefuseManualStop=yes` and `Restart=always` for the agent; the test "agent stopped — 10 commands at 50 ms each".
- **Ladder and explainers (C5, A2, A3).** See R2–R4 above.
- **Networking and SSH before the "Networks" block (A4, C8).** The network module was removed and handed to 03; SSH remained a module of the Linux block (M16), but in the route it comes after N5 and introduces graph concept N18.
- **Entry check (A5, C17).** No system of its own: a reference to 01 §4 and 10; only the distribution by tier and the task variants for the bank remain, rewritten into formats that are hard to guess.

**Substantial and minor.**
- Synchronization with 09 (C6, A7): `dt-kernel` instead of `linux-image-686`, the 09 agent and protocol, OPFS, the 09 `Machine` interface, the Stand in a Web Worker; the needed kernel fragments are listed.
- Checks (C7, A8, A9): our own predicate vocabulary was replaced with the 09 `goals` format; a translation table for the former predicates; permissions are checked with the `access[...]` fact, actions with `probe` kinds; a request for fact fields (4.4).
- Concepts that were missing (C9, A17): `tar`, `sha256sum`, JSON, bind mount and tmpfs, service output to the journal, `exec` — introduced, with drills.
- SIGPIPE (C10): the statement about `cat` in a long pipeline was corrected; SIGPIPE is shown on `yes | head -3`.
- `kill -HUP nginx` (C11, A21): the Stand produces the real bash error; the text uses `pkill -HUP -o nginx`; the nginx log line was corrected.
- E2 (C12, A12): a separate `/var` on a 160 MB `hdb` is filled, sizes were recalculated, the fill is repeating blocks.
- E1 (C13, A12): an explicit `--config` without `EnvironmentFile=` and a CI test for breakage 2; the port is taken by an enabled `debug-listener.service` that survives reboots; the wording "each next one is visible after the previous" was clarified.
- Ink and characters (C14, A14): removed; `ink.ts` in the Sankofa table is marked "not used".
- AI at rung 4 (C15) and the rule "no ready-made solution" (A13): section 9.
- Switch (C16, A19): section 1.5.
- Packages (C18): `manpages-dev`, full pages, `libcap2-bin`, `busybox-static`, `attr`, the teaching programs are described; `util-linux` was checked against the bookworm file list.
- The "kernel" lens (C19): L27 is introduced in M8, and the lens is open from M8 for everyone.
- Textbook (C20, A20): sections 5.2–5.3.
- Hints without points, the 01 lesson anatomy, rungs S0–S5 for drills (A13): sections 4.3, 5.2, 8.2.
- Terminal (A15): 6.0.
- Terms before introduction (A16): the kernel was removed from M0; "script" and `./` were removed from M5–M6; "hash" in the M4 quiz was replaced; "orphan to PID 1" without systemd in M8; X5 says "the system" before M8.
- `rm -rf / tmp/x` (C25): replaced with `rm -rf ~ /old-project` with an explanation about `--preserve-root`.
- The M5 quiz about `drwxr-xr--` (C26, A31): the answer was clarified.
- `dmesg` and "you are in a VM" (C27, A30): `SECURITY_DMESG_RESTRICT=y`, the "Where you are" screen in M14 with the wording checked on the spike.
- Orphan and subreaper (C28, A24): the diagram takes the real new parent from `PPid`, subreaper — in M15.
- Minor drill inconsistencies (C29, A31): `eve` is created in the preparation; the setgid/sticky preparation is described unambiguously; Ctrl+Z = SIGTSTP; the ssh checks were fixed; D1 without `history_contains`; D5 accepts `--sort=size` and is checked by result; D14 is checked by behavior; the `Restart=` list was extended; the `python3` error in the M11 quiz is given verbatim; the number of drills is no longer stated in words.
- Versions and links (C30, A26): the v86 version is only in 09; systemd links lead to bookworm; OpenNet is not the main source; ArchWiki "Journal" moved to M11; the new container2wasm address; M15 sources added.
- The real `man` text on the Stand (C31): section 3.3.
- The "password disabled" check (A11): the client asks the server about login methods via `ssh -v`, and the server uses `sshd -T` for `passwordauthentication` and `kbdinteractiveauthentication`.
- `navigator.deviceMemory` (A22): section 1.6.
- One CPU in v86 (A23): caveats in 6.4 and M15; the resource drill asks "is the machine overloaded" with an explanation.
- The `yes` and `memhog` load (A25): on the machine — `burner` with `nice 10`; all teaching programs are listed in 1.3.
- Permissions after the A → B transition (A27): the `home.manifest` manifest and a CI comparison of `stat`.
- `dnsmasq-base` without a service (A28): DNS was removed from the Linux block image together with the network module.
- Boot log from the snapshot (A29): taken into account in 1.3 and X1.

### What was rejected and why

- **C8: SSH as Linux block concepts L33/L34 and isolation numbering L35–L46.** Rejected as far as the numbers go: the graph owner (the author of 01) in review A fixed L33–L41 for isolation and kept SSH as concept N18 of the network block. Two numberings at once are impossible; the graph owner's numbering was adopted, with L42 (PID 1) and L43 (chroot) added, which reviewer C had as separate concepts. In substance C's proposal was taken into account: SSH stays a module of the Linux block, and it introduces the key pair.
- **C8: keep a trimmed L14 in the Linux block with `N01`, `N04`, `N13` as a minimum.** Rejected: a concept is introduced once (01 §6.1), and 03 builds N2–N5 from scratch and explicitly expects from Linux only processes, files and services. The only place where the Linux block needs a port before networking (the service on 8080 in M11) is covered by a single `forward: [N04]` card.
- **C1, option A: the `lab-debian` root on ext4 via an asynchronous `hda`.** Rejected in favor of option B: moving the root breaks direct FS reading from JavaScript, the live tree without load on the guest and the A → B transition via `files.put`, while all exercises that need xattr fit on `/srv` and `/lab`. The cost of option B is a note in M13 that the training machine's root comes over 9p.
- **A2: keep the rung names D1–D5.** Rejected as far as notation goes: the letter D is taken by Docker block concepts (D01–D23), so the rungs are called "rung 1–5", `doc1`–`doc5` in data. The content of the rungs was accepted in full.
- **C24, E3: a login probe "from an address outside the network" through a second node interface.** Rejected: it requires a second network and routing concepts before the "Networks" block. The rung-5 task in the access exam is `AllowGroups devs`; it checks the same skill of searching `sshd_config(5)` without new networking concepts.
- **C24 and A2: the rung-5 task in E1 — limit the service's memory and CPU (`MemoryMax=`, `CPUQuota=`).** Rejected for the services exam: it comes after M11, before M15, and the memory limit (concept L36) has not been introduced yet, and the concept order rule applies to exams too. The rung-5 task in E1 is `Environment=` (the environment variable has been introduced, the directive has not); the limits became part of the `linux.exam.isolation` exam.
- **C22: the experienced level from rung 3 "from the first module", intermediate from rung 2 "starting with L4".** Not rejected but adjusted to the routes: L2 starts with M10, so its rung 3 begins with the first module of its route; L1 — from rung 2 starting with M4.
- **A5: remove the 02 questions from the entry check entirely.** Partially rejected: the questions are not discarded but go as variants into the 01/10 bank (as the reviewer suggested), with corrected answers.
