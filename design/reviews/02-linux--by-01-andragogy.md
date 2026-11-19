# Review of 02-linux.md (reviewer: the author of 01-andragogy.md)

## Verdict

The document is strong on the engineering side: three machine tiers, the agent on `ttyS1`, state-based checks, starting snapshots with a broken machine, exams E1–E3 with breakages that are revealed one at a time — all of this is right and almost ready for implementation. The educational side is weaker, and it is exactly the part the owner raised in priority after the first wave (R1–R6). There are four main gaps. First, there is no section "How the kernel isolates and limits" (R6): namespaces and cgroups are mentioned in one line in L16, and L16 is also closed to the beginner, while the containers block (04) relies on these concepts at all levels. Second, there is no documentation ladder (R2): help is reduced to an abridged `man` in the sandbox, and the image based on `bookworm-slim` contains no man pages at all. Third, process explanations (R3) exist only for boot and the pipeline, and without parameters or "break it" (R4), and two diagrams violate the style (R4/R5): plumbing with taps and tanks, ink for the boot and disk diagrams, "characters". Fourth, the document has drifted from the decisions in 01, 08 and 09: module identifiers coincide with level and concept codes, networking and SSH are introduced before the "Networks" block contrary to the graph, the placement check does not follow the principle from 01, its own predicate vocabulary does not match the "facts → predicates" contract from 09, and the kernel and image composition differ from `dt-kernel`/`lab-debian`. There are also specific factual errors (`kill -HUP nginx`, `navigator.deviceMemory`, the "password login is disabled" check, a FIFO for events, E1 "after a reboot" with a process from `nohup`). Below are 31 findings; for R2, R3 and R6 I wrote ready text that can be pasted into the document.

Score: BLOCKING — 6, MAJOR — 14, MINOR — 11.

---

## Findings

### 1. BLOCKING. There is no section "How the kernel isolates and limits" (R6); L16 is closed to the beginner, although 04 relies on it

**Where:** 5.1, row L16; 6.10; 10 (sources for L16).

**What is wrong.** Right now L16 introduces in one line "namespace, cgroup (as preparation for the Docker block)", the commands `lsns`, `unshare`, `systemd-cgls`, and is marked "I, E". Document 04 (section 2) says directly: "The block relies on entities from the Linux and networks blocks and does not introduce them itself: process, PID… kernel, system call, `/proc`…", and R6 requires moving threads, fork/exec, namespaces, cgroups v2, capabilities, mount/chroot/overlayfs and seccomp into Linux. A beginner who skips L16 on the 02 route arrives at 04 without the kernel, the system call and `/proc` as understood in L16, and the build under the order rule (01, 6.1) must fail on the beginner route.

**Fix.** Split L16 into two modules, both for all three levels (the beginner gets an abridged version), and add their concepts to the 01 graph. I will update the 01 graph on my side: D03, D04, D05 and part of D09 move to Linux, and in 04 they remain as "recall and apply" (D2 and D3 in 04 are then built on the familiar: "you have already done this in Linux, now let's put it together").

New graph concepts (proposed ids, prerequisites):

| ID | Concept | Requires |
|---|---|---|
| L33 | Thread, TID, `/proc/<pid>/task` | L17, L26 |
| L34 | Process creation: fork and exec, inheritance of the environment and descriptors | L17, L16, L27 |
| L35 | Namespace: what a process *sees*; the kinds pid, mnt, uts, ipc, user, net, cgroup; `unshare`, `nsenter`, `lsns`, `/proc/<pid>/ns` | L27, L26, L25 |
| L36 | cgroup v2: how much a process *consumes*; `/sys/fs/cgroup`, controllers, `memory.max`, `cpu.max`, `pids.max`; the link with systemd (`MemoryMax=`, `CPUQuota=`, `TasksMax=`) | L26, L23 |
| L37 | OOM killer: global and inside a cgroup | L36 |
| L38 | Kernel privileges (capabilities); `capsh`, `getcap`/`setcap` | L12, L27 |
| L39 | Bind mount, `chroot`, the idea of `pivot_root` | L25, L12 |
| L40 | overlayfs: lowerdir, upperdir, workdir, merged, copy-up, whiteout | L39 |
| L41 | seccomp (idea): a system call filter, `SystemCallFilter=` | L27, L23 |

The network namespace in L35 is introduced only as "a process can have its own empty network stack: `unshare --net ip a` shows a single `lo` in the DOWN state". veth, bridge and `ip netns` stay in the "Networks" block (N20, N21), as in 01; this does not contradict R6, because R6 requires introducing the mechanism, and the network wiring is given by the "Networks" block.

Ready text for 5.1 (replaces row L16 with two rows):

| Module | Tier | New concepts | Commands | Levels |
|---|---|---|---|---|
| **L16. Kernel, system calls, /proc** | B | kernel and user space (formally, with the "kernel at the bottom" diagram), the system call, `/proc` as a window into the kernel, `/sys`, kernel messages, memory (`free`: used/buff/cache/available), load average in detail (including the D state) | `strace -f -e trace=openat,execve,clone`, `dmesg`, `free -h`, `vmstat 1`, `cat /proc/<pid>/{status,maps,fd}` | B, I, E |
| **L17. How the kernel isolates and limits** | B | thread and TID; fork/exec as system calls; the namespace and its seven kinds; cgroup v2, the memory/cpu/pids controllers, the OOM killer; capability; bind mount and chroot; overlayfs; seccomp (idea) | `ps -eLf`, `top -H`, `ls /proc/<pid>/task`, `unshare`, `nsenter`, `lsns`, `readlink /proc/<pid>/ns/*`, `systemd-cgls`, `systemd-run -p`, `cat`/`echo` into `/sys/fs/cgroup/...`, `capsh --print`, `getpcaps`, `getcap`, `setcap`, `mount --bind`, `chroot`, `mount -t overlay`, `grep Seccomp /proc/<pid>/status`, `systemd-analyze syscall-filter` | B (abridged: threads, pid/uts/mnt/user, memory and pids, OOM, capabilities, overlay; seccomp in one screen), I, E |

A ready L17 program by lesson (the lesson's core concept is highlighted; the order is valid per the graph):

1. **L17.1 Process and thread (L33).** Hook: "`top` shows one `java` process at 380% CPU — how does one process occupy four cores?". Diagram: a process is a rectangle with its own memory, threads are lanes inside one rectangle, the memory is shared by all, each lane has its own TID. Practice on the teaching program `threads-demo 4` (a static i386 program, built in CI): `ps -eLf | grep threads-demo` (the `LWP`, `NLWP` columns), `ls /proc/<pid>/task`, `top -H -p <pid>`. An important caveat, for honesty: v86 has one virtual CPU, so "380%" is shown in a snapshot from a real server, while in the machine you see the threads taking turns.
2. **L17.2 fork and exec at the kernel level (L34).** A repeat of explanation X2 (section 3 of this review), now with the "kernel" lens: `strace -f -e trace=clone,execve,wait4 bash -c 'ls /tmp'`. On i386, bash creates a process via `clone(...)` without `CLONE_THREAD`, and a thread via `clone` with `CLONE_THREAD`: the same kernel function, different flags. This is the bridge to L17.3: `clone` also has `CLONE_NEW*` flags.
3. **L17.3 Namespaces (L35).** The order of kinds goes from the most visual: uts (`sudo unshare --uts bash; hostname lab-b; hostname` — inside it is `lab-b`, in the neighboring terminal the old name), pid (`sudo unshare --pid --fork --mount-proc bash; ps -ef` — the shell is PID 1, there are two processes), mnt (`sudo unshare --mount bash; mount -t tmpfs none /mnt` — outside, `/mnt` is empty), user (`unshare --user --map-root-user bash; id` — `uid=0(root)`, but a created file belongs to `student` outside), ipc and cgroup in one screen, net with one command (`sudo unshare --net ip a`). Numbers: `readlink /proc/$$/ns/pid` → `pid:[4026531836]`, `lsns`, entering another namespace with `sudo nsenter -t <pid> -u -p -m`.
4. **L17.4 cgroup v2 (L36).** The `/sys/fs/cgroup` tree is systemd slices (`systemd-cgls`), so the first encounter goes through familiar services: `systemctl show nginx -p ControlGroup`, `cat /sys/fs/cgroup/system.slice/nginx.service/memory.current`. Then by hand: `sudo mkdir /sys/fs/cgroup/lab`, `cat cgroup.controllers`, `echo 20M > memory.max`, `echo "50000 100000" > cpu.max`, `echo 16 > pids.max`, `echo <pid> > cgroup.procs`; then the same in one systemd line: `sudo systemd-run --scope -p MemoryMax=20M -p CPUQuota=50% -p TasksMax=16 bash` and a comparison of the files. Counters: `memory.events` (`oom_kill`), `cpu.stat` (`nr_throttled`, `throttled_usec`), `pids.events` (`max`).
5. **L17.5 The OOM killer (L37).** Trainer K4 below; the difference between the global OOM (the whole machine, `dmesg`: `Out of memory: Killed process`) and OOM inside a group (`Memory cgroup out of memory: Killed process`), and what it looks like in systemd: `Failed with result 'oom-kill'`. This is exactly what the learner will later see as `OOMKilled` and code 137 in 04 and 05.
6. **L17.6 Kernel privileges (L38).** "root" is a set of ~40 privileges, not one. `grep Cap /proc/$$/status`, `capsh --decode=...`, `capsh --print`, `getpcaps $$`; the task "listen on port 80 without root and without setuid" via `setcap cap_net_bind_service=+ep`; `getcap -r / 2>/dev/null`; in systemd, `AmbientCapabilities=`, `CapabilityBoundingSet=`.
7. **L17.7 The file view of a process (L39, L40).** `mount --bind`, `chroot` into a directory with `busybox-static` (why chroot is not isolation: processes and network are shared, root can escape), the idea of `pivot_root` in one diagram. overlayfs strictly on tmpfs (see finding 18): `mount -t overlay overlay -o lowerdir=/srv/base,upperdir=/run/ov/upper,workdir=/run/ov/work /srv/merged`; editing a file → copy-up into upper; deletion → whiteout, a 0/0 character device (`ls -l /run/ov/upper` shows `c---------` with `0, 0`).
8. **L17.8 seccomp, the idea (L41).** `grep Seccomp /proc/self/status` (0 — no filter); the filter is set by the program or whoever launches it; in systemd: `SystemCallFilter=~@mount` in a unit, `systemd-analyze syscall-filter @mount`, an attempt to `mount` inside the service gets `Operation not permitted`. We do not write our own profiles: that is 04, D9.
9. **L17 summary (instead of the module's final task).** A combined task without hints: "Run `report-gen` so that it has its own hostname, its own process tree, no more than 64 MB of memory and 8 processes, without `CAP_NET_RAW`, and its root is an overlay on top of `/srv/rootfs` with changes in tmpfs". The word "container" is not used in the module (the term D06 is introduced by 04); the last screen is a "looking ahead" card (`forward: [D06]`): "In the Docker block you will see that all of this together is a container".

L17 trainers (checks in 09 notation, section 2.3; fields not yet in `dt.facts/v1` are marked "+fact", see finding 9):

| # | Task | Setup | Check |
|---|---|---|---|
| K1 | "How many threads does the `threads-demo` process have? Answer in `~/threads.txt`" | `threads-demo 6` as a service | `files['/home/student/threads.txt'].text =~ '^\s*7\s*$'` (main + 6; the agent computes the reference itself via `ls /proc/<pid>/task \| wc -l`) |
| K2 | "The `isolated-app` process lives in its own pid namespace. Run `ps` the way this process sees it, and save the output to `~/inside.txt`" | a process in its own pid+mnt | the file contains no more than 3 process lines and a line with PID 1; soft: `nsenter` in the history |
| K3 | "Start a shell with the hostname `lab-b` without changing the machine's name" | — | `procs[cmd=bash][ns.uts!=@host.ns.uts]` and +fact `uts[@host].hostname=lab` |
| K4 | "The `leaky` service eats all the machine's memory. Limit it to 48 MB so that when it exceeds the limit only it dies, and write to `~/oom.txt` the log line that proves it" | `leaky` grows by 4 MB/s | `units[leaky.service]` +fact `props.MemoryMax=50331648`; `cgroups[path~'leaky.service']['memory.events'].oom_kill>=1`; `files['/home/student/oom.txt'].text =~ 'oom-kill\|killed by the OOM killer'`; the machine is alive (`units[nginx.service].active=active`) |
| K5 | "The `burner` process occupies the whole CPU. Limit it to half a core without restarting it" | `burner` | `cgroups[procs~@pid(burner)].cpu.max='50000 100000'` (any value with a ratio ≤ 0.5 is accepted — the evaluator divides the fields); `keep: procs[cmd=burner].pid=@start.pid(burner)` |
| K6 | "Limit the `sandbox` group to 16 processes and prove that the limit triggers" | an empty group `/sys/fs/cgroup/sandbox` | `cgroups[path=/sandbox].pids.max=16`; +fact `pids.events.max>=1` |
| K7 | "The `web-demo` program must listen on port 80 as the user `student`: without sudo, without setuid, without changing the port" | `/usr/local/bin/web-demo` | `net.listen[port=80].pid` → `procs[user=student]`; +fact `files['/usr/local/bin/web-demo'].caps~'cap_net_bind_service'`; mode without the setuid bit |
| K8 | "Mount `/srv/merged` as an overlay: `/srv/base` at the bottom, changes in `/run/ov/upper`. Change `etc/motd` and delete `old.txt` in `/srv/merged`" | `/srv/base`, `/run` is tmpfs | `mounts[target=/srv/merged].type=overlay && mounts[target=/srv/merged].upper=/run/ov/upper`; `files['/run/ov/upper/etc/motd'].exists`; `files['/srv/base/etc/motd'].sha256=@start...`; +fact `files['/run/ov/upper/old.txt'].type='c'` |
| K9 | "Make the `tool` service unable to mount anything" | `tool.service` | +fact `units[tool.service].props.SystemCallFilter` contains `mount`; `probe` (`envs: [v86, vm]`, comment "an action is needed"): running `mount -t tmpfs none /mnt` inside the service via `systemd-run -p SystemCallFilter=...` gives a nonzero code |
| K10 | "Become root in your own user namespace, create the file `~/mine` and find out who really owns it" | — | `files['/home/student/mine'].owner=student`; `→ file` `~/owner.txt` = `student` |

Module sources (under the two-source rule of 01): [namespaces(7)](https://man7.org/linux/man-pages/man7/namespaces.7.html), [cgroups(7)](https://man7.org/linux/man-pages/man7/cgroups.7.html), [Control Group v2 (kernel docs)](https://docs.kernel.org/admin-guide/cgroup-v2.html), [capabilities(7)](https://man7.org/linux/man-pages/man7/capabilities.7.html), [overlayfs (kernel docs)](https://docs.kernel.org/filesystems/overlayfs.html), [seccomp(2)](https://man7.org/linux/man-pages/man2/seccomp.2.html), [systemd.resource-control(5) for bookworm](https://manpages.debian.org/bookworm/systemd/systemd.resource-control.5.en.html), [systemd.exec(5) for bookworm](https://manpages.debian.org/bookworm/systemd/systemd.exec.5.en.html); RU — ArchWiki "cgroups" and "Capabilities" (the Russian versions where they exist), the "Namespaces in Linux" series on Habr to be checked before inclusion.

Image composition for L17 (add to 1.3): `libcap2-bin` (`capsh`, `getcap`, `setcap`, `getpcaps`), `busybox-static` (a rootfs for chroot), the teaching programs `threads-demo`, `burner`, `leaky`, `web-demo` (static i386, built in CI). `unshare`, `nsenter`, `lsns` are already in `util-linux`.

---

### 2. BLOCKING. There is no documentation ladder (R2); the image has no man pages

**Where:** 1.3 (package list), 3.3 (the "Help" row), 5.1 (L3), 7.2, 7.3, 8.

**What is wrong.** (a) The image is built from `i386/debian:bookworm-slim`; in Debian slim variants dpkg is configured to exclude `/usr/share/man/*` and `/usr/share/doc/*`, so `man-db` will be installed, but there will be no pages: `man ls` will answer "No manual entry". (b) Even after that is fixed, the document installs "only the pages for commands from section 3.3" — this directly contradicts steps 4 and 5 of R2, where a task requires flags and commands not in the theory. (c) In the sandbox, `man` is "abridged pages with translated captions"; at step 2 the learner must learn the anatomy of a *real* page (NAME, SYNOPSIS, DESCRIPTION, OPTIONS, EXAMPLES, SEE ALSO). (d) L3 introduces "option, manual page, builtin command", but not what you cannot search documentation without: manual sections (1, 5, 8), the SYNOPSIS notation (`[ ]`, `...`, `|`), searching with `/` inside `less`, `man -k`/`apropos`, `help` for builtins, `--help | less`, `info coreutils`. (e) The AI tutor (section 8) does not know a "where did you look?" mode. (f) The exams run "without hints, without AI", but without a panel of official documentation and without tasks beyond the course.

**Fix (1.3).** In the image Dockerfile, before installing packages, remove the slim exclusions (`rm /etc/dpkg/dpkg.cfg.d/docker*` or explicitly override with `path-include=/usr/share/man/*`), install `man-db`, `manpages`, `manpages-dev` (system call pages for L16–L17) and all man pages of the installed packages. This is tens of megabytes, but 9p loads files lazily, and they do not count against the "until the first prompt" budget. Add a CI check: `man -w ls journalctl systemd.unit sshd_config crontab.5 capabilities namespaces` — each is found.

**Fix (L3, ready text for 5.1).** "**L3. Help and how to read documentation.** New concepts: option (flag), the manual page and its sections (NAME, SYNOPSIS, DESCRIPTION, OPTIONS, EXIT STATUS, FILES, EXAMPLES, SEE ALSO), the SYNOPSIS notation (`[optional]`, `...` — repeats, `a|b` — one of), the manual section number (1 — commands, 5 — file formats, 8 — administrator commands), builtin command. Commands: `man`, `man 5 crontab`, `/pattern` and `n` inside `man`, `man -k`/`apropos`, `--help`, `help`, `type`, `which`, `whatis`, `info coreutils`. A separate warning screen: GNU coreutils pages usually have no EXAMPLES section, the page is generated from `--help`, and the full documentation is in `info coreutils`; systemd and OpenSSH, on the contrary, have large pages, and the FILES and SEE ALSO sections are the most useful."

**Fix (a new section 5.3 "The documentation ladder in the Linux block", ready text).**

> A step is a property of the "learner × block" pair (like the level in 01, 2.1), stored in the learner model next to the support step S0–S5. The Linux block is the first technical block of the course, so the ladder starts here for everyone except the experienced.
>
> | Step | What the learner sees | Modules for the beginner | Modules for the intermediate | Modules for the experienced |
> |---|---|---|---|---|
> | D1. Flicker | Every new command in the theory has a line "where this comes from: `man ls`, section OPTIONS, `-l`" with a link; opening it is optional | L0–L2 | — | — |
> | D2. Fragment | A hint in a trainer is a fragment of the real page (from the image, the same version) with the relevant line highlighted and the section captioned; the first such fragment has the page anatomy marked up | L3–L7 | L4–L5 | — |
> | D3. Find the flag | The task has no flag, only a link to the page or the command `man …`; the result is checked | L8–L12 | L6–L10 | L4–L10 (from the start of the block) |
> | D4. We make you | 1–2 tasks in a module require a command or flag that is not in the theory; no hints; the tutor answers "where did you look?" and points to `man -k`, `--help`, `/usr/share/doc`, `systemctl --help` | L13–L17 | L11–L17 | L11–L17 |
> | D5. Exam | Only official documentation is open; 1 task in 4–5 is built on what is not in the course | E1–E3 | E1–E3 | E1–E3 |
>
> Moving to the next step ahead of schedule: two tasks in a row at the current step solved without hints. There is no going back down a step: if the learner is stuck at D4, the tutor goes down the hint ladder (H1–H5 from 01), not the documentation ladder. A D4 task opens only for concepts in the `practicing` state or higher: the learner is not sent into documentation on a topic they have not yet touched by hand.
>
> Links lead to pages of the version installed in the machine: `manpages.debian.org/bookworm/…` (not `freedesktop.org/…/latest/`: Debian 12 has systemd 252, and "latest" has options that the machine lacks). The trainer's "Documentation" panel has a local mirror of the same pages, built in CI from the image (`man -Thtml` or `mandoc -T html`), so that during the exam the documentation works offline and matches the machine.

The format in the lesson and trainer YAML (an addition to 4.3):

```yaml
doc:                         # step D1/D2: where this comes from
  - { kind: man, page: "ls(1)", section: OPTIONS, anchor: "-S",
      line: "-S     sort by file size, largest first",
      url: "https://manpages.debian.org/bookworm/coreutils/ls.1.en.html" }
doc_task:                    # step D3/D4
  step: D3                   # D3 — the page is given; D4 — nothing is given
  page: "journalctl(1)"      # not shown for D4, needed only by the tutor
  not_in_theory: true        # mandatory for D4; the build checks that the flag is not in the block's theory
```

D3 tasks (one per module, checked by the result):

| # | Module | Task | Where to look | Check |
|---|---|---|---|---|
| DL3-1 | L6 | "Follow `app.log` so that following does not stop after log rotation" | `man tail` | a `tail` process with the argument `-F` or `--follow=name --retry` is alive (+fact `procs.args`); the agent rotates the log and checks via an output event that new lines reached the terminal |
| DL3-2 | L8 | "Show the threads of the `threads-demo` process with one `ps` command" | `man ps`, section THREAD DISPLAY | the output is saved to `~/lwp.txt`; the agent compares the number of lines with `ls /proc/<pid>/task` |
| DL3-3 | L9 | "Make the script print every command it executes" | `help set` | `files['/home/student/s.sh'].text =~ 'set -[a-z]*x\|set -o xtrace'` |
| DL3-4 | L10 | "Which files did the `jq` package install? Save the list" | `man dpkg` | `→ file` against `dpkg -L jq` |
| DL3-5 | L11 | "Save the kernel messages of the current boot" | `man journalctl` | `→ file` against `journalctl -k -b -o cat` (tolerance for new lines) |
| DL3-6 | L12 | "Run `~/warmup.sh` on every boot of the machine via cron" | `man 5 crontab` | `cron_entry` with the regular expression `^@reboot .*warmup\.sh`; `survives_reboot` + a marker file written by the script |

D4 tasks (flags and commands that are not in the theory; no hints):

| # | Module | Task | What is not in the theory | Check |
|---|---|---|---|---|
| DL4-1 | L11 | "The systemd journal must not take more than 50 MB on disk" | `journald.conf(5)`, `SystemMaxUse=` | +fact: the resulting configuration `systemd-analyze cat-config systemd/journald.conf` contains `SystemMaxUse=50M`; `systemd-journald` was restarted after the edit (the service start time is later than the file modification time) |
| DL4-2 | L11 | "The `flappy` service must restart no more than 3 times per minute and then stay `failed`" | `StartLimitBurst=`, `StartLimitIntervalSec=` | +fact `units[flappy.service].props.StartLimitBurst=3`, `StartLimitIntervalUSec=1min`; the agent crashes the service 4 times and expects `active=failed`, `result=start-limit-hit` |
| DL4-3 | L13 | "How many free inodes are on `/data`? Answer in `~/inodes.txt`" | `df -i` | `→ file` against `df -i --output=iavail /data` |
| DL4-4 | L13 | "Make the file `/data/release.lock` immutable even for root" | `chattr +i` (ext4 on `hdb`; `chattr` does not work on 9p) | +fact `files['/data/release.lock'].attrs~'i'`; `as_user root` `rm /data/release.lock` → code ≠ 0 |
| DL4-5 | L8 | "Run `~/backup.sh` with the lowest priority for both CPU and disk" | `nice`, `ionice -c3` | `procs[cmd~backup.sh]` +facts `nice=19`, `ioprio=idle` |
| DL4-6 | L9 | "`~/sync.sh` must not start a second copy while the first is running" | `flock` | the agent starts two copies in a row: the second exits in < 1 s with a code ≠ 0, the first keeps running |
| DL4-7 | L15 | "Allow ssh login to `server` only for members of the `devs` group" | `AllowGroups` | `stdout_of: sshd -T` regex `^allowgroups devs$`; login as `alex` (in `devs`) works, as `eve` does not |
| DL4-8 | L17 | "Run `report-gen` so that it cannot create more than 20 processes, without touching `/sys` by hand" | `systemd-run -p TasksMax=20` | `cgroups[procs~@pid(report-gen)].pids.max=20`; soft: no `echo … > /sys/fs/cgroup` in the history |

The tutor's behavior at step D4 (add to section 8, ready system instruction text):

> On this task the learner is learning to find the answer in the documentation. Do not name the command, flag, configuration option or manual page name. First ask: "Where have you already looked?". If the learner named a source, ask what they were looking for there and with what word; suggest another keyword for `man -k` or `/` inside the page. If they have not looked anywhere, name only the *type* of source: "commands — `man -k <word>` or `<command> --help`; service settings — a section 5 page, search by the name of the configuration file; bash builtins — `help`; a whole package — `/usr/share/doc/<package>`". You may explain how to read a page that is already open (what SYNOPSIS means, where FILES is). You must not quote the line that solves the task.

Exams (step D5, an addition to 7.3). During the exam, the "Documentation" panel is open with a local mirror of the image's man pages and an allowlist of sites: `manpages.debian.org/bookworm`, `man7.org`, `www.debian.org/doc`, `docs.kernel.org`, `www.freedesktop.org/software/systemd/man`, `man.openbsd.org` (OpenSSH). Every exam has one mandatory task "beyond the course": E1 — "limit `orders` to half a CPU and 64 MB of memory" (`CPUQuota=`, `MemoryMax=` from `systemd.resource-control(5)`; the learner knows the mechanism from L17, but not the specific options); E2 — "the journal must no longer fill up the disk" (`SystemMaxUse=`); E3 — "no more than three login attempts per connection" (`MaxAuthTries`). The exam report lists which pages the learner opened (`man` events from `PROMPT_COMMAND` and panel clicks); this is material for the debrief, not for grading.

---

### 3. BLOCKING. Process explanations (R3) are incomplete and do not match the R4 style: no fork/exec/PATH and no "systemd restarts a crashed service", boot and the pipeline have no parameters and no "break it"

**Where:** 6.5, 6.7, 6.10.

**What is wrong.** R3 names four mandatory explanations for Linux: boot, fork/exec/PATH, the pipeline, systemd restarting a crashed service. The document has a boot scroll scene and a unit state machine (without restarts), the plumbing pipeline and the "what the shell does" lens in 6.10 without a separate step-by-step explanation. None of the diagrams has sliders and toggles that recalculate the process, there is no "break it" (the `breakit` widget from 08, 3.5), no step-by-step rewinding (`stepper` from 08, 3.1). In addition, R6 needs isolation explanations (namespaces, cgroups/OOM, overlayfs), otherwise module L17 from finding 1 will again become a set of commands.

**Fix.** Add section 6.11 "Process explanations" with the storyboards below. Common rules for all of them (one line at the start of the section): the `stepper` + `diagram` + `breakit` widgets from 08; one scene, one idea; animation only for the process (a data packet travels along an arrow, a table row appears, a counter grows); no characters or metaphorical drawings; every element is clickable and opens a card "what it is, who creates it, which command shows it"; the caption sits on the arrow; any parameter change immediately recalculates the steps, and next to the diagram a line "what changed and why" appears; steps can be rewound forward and backward, with pause; in calm mode, the same steps without motion. Where there is a tier B machine, the diagram receives events from the agent in `watch` mode (09, 1.4) and shows what the learner has just done.

#### X1. "From power-on to the prompt" (L11; replaces the first half of 6.7)

| Step | On screen | Caption on the arrow / card |
|---|---|---|
| 1 | A strip from left to right: firmware → bootloader → kernel → PID 1 → targets → services → login → bash. The first plate is active | "The firmware (BIOS/UEFI) finds what to boot from" |
| 2 | The bootloader passes the command line to the kernel; next to it, the real `cat /proc/cmdline` of this machine | Honesty card: "This machine has no bootloader: the v86 emulator puts the kernel into memory itself. On a server, GRUB does this" |
| 3 | The kernel: `dmesg` lines with "Linux version…", "Mounted root…" and "Run /bin/systemd as init process" highlighted; the kernel strip is at the bottom, color `--c-kernel` | "The kernel starts the first program from `init=`" |
| 4 | PID 1 is `systemd`; the target graph `sysinit.target → basic.target → multi-user.target` appears | The arrows are labeled `Wants=`/`After=` |
| 5 | Services start in parallel; each has a time bar from this machine's `systemd-analyze blame` | The counter "services running now: N" grows |
| 6 | `serial-getty@ttyS0` → `login` (autologin) → `bash` | "You are here" |

Parameters: a target switch `multi-user.target / rescue.target / emergency.target` (recalculates which services start and shows where the learner ends up); a switch "order by `After=` / without it" (services that wait for the network start before the network and fail). "Break it": "a typo in `/etc/fstab`" (boot stops at `local-fs.target`, the screen shows the real `emergency mode` message and `journalctl -xb`); "`init=/bin/bash`" (steps 4–6 disappear, PID 1 is `bash`, no services); "a service with `Before=multi-user.target` hangs" (the bar stretches up to `TimeoutStartSec`, 90 s by default). Δ line, example: "You chose `rescue.target`: only the services needed for single-user mode will start; networking and ssh do not start".

#### X2. "What happens when you press Enter" (fork/exec/PATH; L7–L8, the "kernel" lens in L16–L17)

| Step | On screen | Caption |
|---|---|---|
| 1 | The line `ls -l /etc > list.txt` is split into parts (diagram 6.1) | "The shell reads the line and splits it into words" |
| 2 | Expansions: `~`, `$VAR`, `*` turn into values | "Patterns are expanded by the shell, not by the command" |
| 3 | The list of `PATH` directories from left to right; for each, a check "is `ls` here"; the found one is highlighted | "PATH lookup: the first match wins" |
| 4 | The `bash` process (PID 2210) splits in two: a copy appears with a new PID 2231 and the same descriptor table 0/1/2 | "fork: a copy of the shell" |
| 5 | In the copy, descriptor 1 is redirected from the "terminal" arrow to `list.txt` | "The redirection is done by the copy before the program starts" |
| 6 | The contents of rectangle 2231 are replaced with `/usr/bin/ls`; the PID stays 2231 | "exec: the same 'box', a different program" |
| 7 | The parent 2210 is in the "waiting" state; `ls` writes to the file and exits with code 0 | "wait: the parent waits for the exit code" |
| 8 | Code 0 goes into `$?`, the prompt appears | "The exit code is in `$?`" |

Parameters: an editable `PATH` (remove `/usr/bin` → step 3 ends with "command not found", code 127; put `~/bin` first and place your own `ls` there → it wins); a command switch `ls / cd / exec ls / ls &` (`cd` is a builtin: steps 3–7 disappear, "changing the copy's directory is useless, so `cd` is done by the shell itself"; `exec ls` — step 4 disappears, after `ls` exits the terminal closes; `&` — step 7 disappears, the prompt appears immediately). "Break it": clear the `x` bit (step 6: `Permission denied`, code 126), a wrong shebang in a script (step 6: `bad interpreter: No such file or directory`), `> /root/x` as `student` (step 5: an error before `ls` starts, `ls` itself does not start). Δ line, example: "You removed `/usr/bin` from PATH: the shell did not find `ls` in any directory and did not create a process — so neither fork nor exec happened". In L16, steps 4, 6, 7 get a caption with the system call (`clone`, `execve`, `wait4`) from this machine's real `strace -f`.

#### X3. "The pipeline" (L6, a second layer in L8; replaces 6.5)

A diagram without metaphors: command rectangles from left to right, between them a buffer with graduations (a fill bar, captioned "kernel buffer, 64 KiB"), stdout arrows labeled `1`, stderr `2`, both going to the "terminal" rectangle by default. Lines of real text move along the arrows.

| Step | On screen |
|---|---|
| 1 | `cat access.log` emits lines, the buffer to `grep` fills up |
| 2 | `grep ' 500 '` lets some lines through, the rest fade at its input |
| 3 | `sort` collects everything and emits nothing; caption "sort cannot start until it receives the end of input" |
| 4 | The end of input (EOF) reaches `sort`, and it emits the sorted output |
| 5 | `head -3` gets three lines and exits |
| 6 | The previous command writes to a buffer that no longer has a reader: `SIGPIPE`, code 141 (shown only if it was still writing — with a short file `cat` manages to finish earlier, and that is shown too) |

Parameters: a buffer size slider (4 KiB … 1 MiB; in L8 the caption `F_SETPIPE_SZ`, `pipe(7)`); producer and consumer speed sliders (with a slow consumer the buffer fills up and the producer goes into the `S` state — a link to the states from L8); toggles `2>&1`, `> file`, `| tee`. "Break it": remove `sort` before `uniq -c` (the count is wrong: `uniq` removes only adjacent duplicates — the same trap as in the L6 quiz); kill the consumer (`SIGPIPE` for the producer); `set -o pipefail` on/off (the pipeline's `$?` changes when the first command fails). Δ line, example: "The buffer was reduced to 4 KiB: `cat` now waits for `grep` after every hundred lines; this does not affect the result, but it does affect the speed".

#### X4. "systemd restarts a crashed service" (L11; replaces the second half of 6.7)

Diagram: the unit state machine (`inactive → activating → active → deactivating → inactive`, a `failed` branch, an `auto-restart` loop); on the right, a timeline with marks for crashes and restarts; below it, the counter "restarts within the `StartLimitIntervalSec` window: n of `StartLimitBurst`".

| Step | On screen |
|---|---|
| 1 | `systemctl start app`: `inactive → activating → active` |
| 2 | The main process exits with code 1: an arrow into `failed` or into `auto-restart`, depending on `Restart=` |
| 3 | Waiting for `RestartSec`, the timeline ticks |
| 4 | A new start: a new PID, the restart counter +1 |
| 5 | The fifth crash within 10 s: `start-limit-hit`, the service stays `failed`; the real journal lines alongside |

Parameters: `Restart=` (`no / on-failure / on-abnormal / always`), `RestartSec` (0.1–30 s), `StartLimitBurst` (1–10), `StartLimitIntervalSec` (1–120 s), the crash cause (`code 1 / SIGKILL / SIGTERM / start timeout / OOM`). The mapping table is computed from `systemd.service(5)`: for example, `on-failure` restarts on a nonzero code, a signal, a timeout and watchdog, but not on a clean exit; `on-abnormal` does not restart on a nonzero code. The systemd 252 defaults: `Restart=no`, `RestartSec=100ms`, `StartLimitIntervalSec=10s`, `StartLimitBurst=5` (check against `systemd-system.conf(5)` for bookworm). "Break it": `ExecStart` pointing to a non-existent file (`203/EXEC`, restarts are pointless and quickly hit the limit), `Type=simple` for a program that forks into the background (systemd considers the service finished), `RestartSec=0` (the limit triggers within fractions of a second). Δ line, example: "You set `Restart=on-abnormal`: exiting with code 1 is a 'normal' termination from systemd's point of view, there will be no restart". On a tier B machine, the diagram subscribes to the agent's `systemctl show -p ActiveState,SubState,NRestarts` and replays what the learner did in D20.

#### X5. "How the kernel decides whether it is allowed" (L5; a rework of 6.2 without characters)

Instead of three characters, three rows of a "who is asking" table: `uid 1001 anna (owner)`, `uid 1002 bob (group dev)`, `uid 1003 eve (others)`, without avatars. Steps: "a process with uid X asks to open a file" → "uid = owner? → the first triplet" → "gid or a supplementary group = the file's group? → the second triplet" → "otherwise the third" → "is the needed bit set? → allowed / `EACCES`". Parameters: the bit grid, a "file / directory" switch, the action. "Break it": clear `x` on the parent directory (access to the file disappears even with correct permissions on the file itself — the most common nginx 403, a bridge to S5 from 01, section 9). Δ line: "You cleared `x` on `/srv`: the check never reached the file — the kernel stopped at the directory". In L17 a first row is added, "uid = 0? → the permission check is skipped (`CAP_DAC_OVERRIDE`)" — this is how capabilities appear in a familiar diagram.

#### X6. "What a process sees" (namespaces; L17.3)

A diagram following the 08 rule (5.3): the kernel strip at the bottom, processes above it, namespaces as colored frames around processes with a label for the kind (`--c-ns-pid` and so on). A viewpoint switch "from the host / from inside".

| Step | On screen |
|---|---|
| 1 | All of the machine's processes in one frame of each kind; the numbers `pid:[4026531836]` from `/proc/<pid>/ns` |
| 2 | `unshare --uts`: a uts frame appears around the new `bash`; `hostname` inside and outside differ |
| 3 | `--pid --fork`: a pid frame; from inside PID 1, from outside PID 3120 — one and the same rectangle with two numbers |
| 4 | `--mount-proc`: without it, `ps` inside shows the host's processes (it sees the old `/proc`) — a separate step, a common mistake |
| 5 | `nsenter -t 3120 -p -m`: a second process enters the same frame |

Parameters: the set of `unshare` flags (checkboxes for the kinds) — the diagram immediately shows which frames will appear and what will change in the output of `hostname`, `ps`, `mount`, `id`, `ip a`. "Break it": remove `--fork` (`unshare: fork: Cannot allocate memory` on the very first command run — the real message, with the explanation: the first child becomes PID 1 of the new namespace, and `unshare` itself does not enter it); remove `--mount-proc` (step 4). Δ line: "You added `--user --map-root-user`: inside, `id` will show root, but a file created inside belongs to `student` on the host". The event source on tier B is the agent's `watch ns` (09, 1.4).

#### X7. "The memory limit and the OOM killer" (cgroups; L17.4–L17.5)

Diagram: a rectangle for the group `/sys/fs/cgroup/lab` with processes inside; a thermometer scale `memory.current` with a `memory.max` mark (`--c-limit`); the counters `memory.events: high, max, oom, oom_kill`; next to it, the same scale for the whole machine (`MemTotal`/`MemAvailable`).

| Step | On screen |
|---|---|
| 1 | `leaky` grows by 4 MB/s, the scale rises |
| 2 | It approaches `memory.high` (if set): the kernel starts reclaiming pages, growth slows, the `high` counter grows |
| 3 | It reaches `memory.max`: a last attempt to free memory |
| 4 | The OOM killer inside the group: the process rectangle fades, `oom_kill` +1, the `dmesg` line: `Memory cgroup out of memory: Killed process …` |
| 5 | The rest of the machine is unaffected: the machine's scale is below the edge |

Parameters: `memory.max` (16 MB … no limit), `memory.high` (off / a value), growth rate, the number of processes in the group (which of them the OOM killer picks — by `oom_score`), a switch "under systemd" (the same thing via `MemoryMax=` on a service; the journal shows `Failed with result 'oom-kill'`, a restart per `Restart=` — a link to X4). "Break it": "no limit" (growth reaches the machine's edge; the global OOM kills the machine's "heaviest" process — it may turn out not to be `leaky`; in teaching mode this is shown in the stepper from recorded frames, not on the learner's live machine). Δ line: "You set `memory.high` below `memory.max`: the process is not killed but slowed down — the kernel keeps taking memory away from it". A separate screen for `cpu.max`: one timeline in 100 ms periods, the shaded share = the quota; with `50000 100000` the process runs half of each period, and the `nr_throttled` counter grows.

#### X8. "Overlaying file systems" (overlayfs; L17.7, the same widget is reused by 04, interactive 2)

Diagram: three transparent sheets stacked on each other (lower at the bottom, upper on top, merged as the view from above), path captions on the edges. Steps: reading a file (taken from lower), modifying it (copy-up: the file is copied into upper, then changed), deleting a file from lower (a whiteout appears in upper — a 0/0 character device), creating a new one (only in upper). Parameters: the number of lower layers (1–3, the order `lowerdir=a:b:c`), a switch "upper present / read-only" (without upper, the mount is read-only). "Break it": upper on 9p (the real mount error — see finding 18), the same directory as upper and work. Δ line: "You deleted `old.txt`: it did not disappear from the lower layer — a whiteout was laid on top, and it is not visible in merged".

---

### 4. BLOCKING. Networking (L14) and SSH (L15) are introduced in Linux before the "Networks" block, contrary to the 01 graph and the 03 order

**Where:** 5.1 (L14, L15), 6.9, 7.1 (L14, L15), 7.2 (D24, D25), E3.

**What is wrong.** L14 introduces the interface, IP address, mask, route, port, socket, DNS query, `/etc/hosts`, `/etc/resolv.conf`, HTTP. In the 01 graph these are N01, N02, N03, N04, N08, N09, N13, N14 — concepts of the "Networks" block, which comes after Linux; 03 (section 3) introduces them in N2–N11 in its own order and expects from Linux only "the terminal, files and `/etc`, editing, processes and PIDs, `sudo`, `systemctl`, `journalctl`, pipes and `grep`" (03, section 13). SSH is N18 and requires N13. The build under the 01 rule, 6.1, will fail on L14 on any route; and if the rule is relaxed, the learner gets the concepts twice in a different order and at a different depth, and 03 loses its principle "the OSI model after the learner has touched the layers".

**Fix.** (a) Remove module L14 from Linux; its commands (`ip a`, `ip r`, `ss -ltnp`, `ping`, `curl`, `dig`, `getent hosts`, `nc`) are already covered by N2, N4, N5, N8, N11 in 03; hand the L14 quiz and D24 over to 03 (D24 fits well into N5 as a task on `ss -ltnp` + `systemctl disable --now`). (b) Keep L15 SSH and exam E3 within 02's responsibility, but place them in the route after N5 (TCP and ports) as a module "Linux on a remote server" — this way it immediately relies on the socket and the port and becomes a bridge to Ansible and CI (06). In the 01 graph, N18 keeps its prerequisites N13, L10, L11. (c) If for product reasons SSH is needed earlier (for example, for the pet project), an acceptable variant is to keep L15 where it is with a single `forward: [N04]` ("a port is the number of a door on the machine, in detail in the Networks block") and without the words "socket", "TCP", "handshake" in the text and in diagram 6.9; rename the "handshake" step in 6.9 to "host key check". I recommend variant (b): it has no jumping ahead.

---

### 5. BLOCKING. The placement check does not follow the principle from 01 (section 4) and the requirement from 10

**Where:** 2.2.

**What is wrong.** In 02: 8 questions + 1 task, the threshold is 6 of 8 and the task solved, 5–8 minutes. In 01, 4.1 and 4.3 (the "Linux" section): the L1 check is 8 tasks, about 20 minutes, at least half of them practical, the criterion is 7 of 8 and at least 4 of tasks 1–5, key tasks; the L2 check is 10 tasks, about 35 minutes, key tasks 1, 2, 10, an "explain" task with a rubric; confidence "I know / I think / a guess" with every answer; "a guess" is not credited; a retry after 72 hours with a different variant. 10 (3.5) adds: at least two practical key tasks. 02 has one practical task, and the "free answer with choice" (question 2) is exactly the format where guessing is easy. Moreover, the answer to the experienced question 4 ("the CPU run queue is growing") is wrong for Linux: load average includes processes in the D state (waiting for I/O), which 10 (8.2, L-4) correctly analyzes.

**Fix.** Replace section 2.2 with a reference to 01, 4.3 (the task bank is in 10, `content/bank/linux/placement/`) and keep in 02 only what is tier-specific: which tasks run on tier A, which on B, with which starting snapshots. Do not throw away the 02 questions: they are good and fit as variants in the pool (every 01 task has 3–5 variants). Recast them into formats where guessing is hard: question 1 → `practical` ("go to the directory two levels up and print the path", checked by `cwd`); question 2 → `match`; experienced question 4 → `choice` among close wordings with the correct answer "on average 4 processes were running or waiting for the CPU or the disk; for 2 cores this is an overload, look at `wa` and the D state". Add a fifth key practical task on tier B for the experienced, per 01 (L2, task 2 — the `top3.sh` script with hidden tests).

---

### 6. BLOCKING. Module identifiers L0–L16 coincide with level and concept codes

**Where:** 5.1 and the whole document (references "L8", "L11", `module: L5` in YAML).

**What is wrong.** In 01, `L0/L1/L2` are level codes (beginner, intermediate, experienced), and `L01–L32` are identifiers of Linux concepts in the graph. In 02, `L0–L16` are modules. The 02 YAML has `module: L5`, the 01 YAML has `levels: [L0, L1, L2]` and `concepts: [L11, L20]`. "L11" in 02 is the module "Services and logs", in 01 the concept "permissions". The linter will not tell them apart, and the content author and the AI tutor will mix them up.

**Fix.** Rename modules to `lx00`–`lx17` (or `linux.m00`), lessons to `linux.<slug>` following 01, 7 (`linux.process`). Write levels in the 02 YAML with the 01 codes (`level: [L0, L1]`) or in words, but the same in all documents; 08 and 10 already use `L0/L1/L2` and `beginner/intermediate/experienced` interchangeably — I propose fixing `L0/L1/L2` in data and words in the interface. In 5.1, add a "Graph concepts" column with references to the 01 ids (for example, L8 → L17, L18, L19, L34; L11 → L23, L24).

---

### 7. MAJOR. Divergence from the 09 platform: kernel, image, agent, storage, machine interface

**Where:** 1.3, 1.4, 3.1, 4.1, 4.2.

**What is wrong.** 09 (1.4) has already reconciled the decisions of 02 and 04: one kernel `dt-kernel` 6.12 LTS i686 from the Alpine `virt.x86` configuration plus fragments (`CFS_BANDWIDTH`, `OVERLAY_FS`, `SECCOMP_FILTER`, `IKCONFIG_PROC`…), two roots `lab-debian` and `lab-alpine`; the agent `trainer-agent` is POSIX sh and arrives over 9p from `/opt/trainer/`; snapshots are in OPFS; the Stand is in a Web Worker `sim.worker.ts`; the `Machine` interface has `facts()`/`events()`. In 02 there is the `linux-image-686` package (the Debian 6.1 kernel), the agent `trainerd` in bash under `trainer-agent.service`, snapshots in IndexedDB, the sandbox `@trainer/sandbox` with no mention of a worker, the sandbox FS in `localStorage`, its own `Machine` with `check()`/`snapshot(kind)`/`onCommand()`.

**Fix.** Synchronize 02 with 09: in 1.3, remove `linux-image-686` and refer to `dt-kernel` (a shared kernel, the `lab-debian` root); check that the `dt-kernel` fragment has everything L13 and L17 need: `EXT4_FS`, `MSDOS_PARTITION`, `MEMCG`, `CGROUP_PIDS`, `CFS_BANDWIDTH`, `USER_NS`, `OVERLAY_FS`, `SECCOMP_FILTER`, `TMPFS_XATTR`, `BLK_DEV_SD`/ATA for `hdb`. In 1.4, OPFS. In 3.1, the Worker and the CBOR snapshot from 09, 1.3. In 4.1, the interface from 09, 1.5; `onCommand` is expressed through the `cmd.done` event of the 08 bus. In 4.2, the agent's name and language from 09. Keep in mind that with kernel 6.12 instead of 6.1 the output of `uname -r` and some `dmesg` messages change: "golden records" and theory texts must be captured from `lab-debian` on `dt-kernel`, not from plain Debian.

---

### 8. MAJOR. Its own predicate vocabulary does not match the "facts → predicates" contract from 09

**Where:** 4.3, 7.2, 7.3.

**What is wrong.** 09 (2.3–2.4) defines one format: `goals` with `needs`, `when` (a selector over `dt.facts/v1`), `keep`, `fail`, `probe` (only for actions and with a justification). 02 describes YAML objects `path_mode {mask, equals}`, `as_user`, `survives_reboot`, and the exams also use predicates that are not even in the 02 vocabulary: `file_sha256_tree`, `cron_entry_absent_or_disabled`, `after_wait`. Two check systems means two evaluators, two Go implementations for signed exams.

**Fix.** Rewrite 4.3 as a mapping table "02 predicate → goal in the 09 format" and ask 09 to add the missing fact fields (see finding 9). Examples to paste:

```yaml
goals:
  - id: team-dir
    say: { ru: "Каталог /srv/team: группа dev читает и пишет, остальные ничего", en: "..." }
    needs: [files]
    files: [/srv/team]
    when: "files['/srv/team'].type=d && files['/srv/team'].group=dev && files['/srv/team'].perm.g=rwx && files['/srv/team'].perm.o='---'"
  - id: alice-can-write
    envs: [sim, v86]
    probe: { as: alice, run: "touch /srv/team/a && cat /srv/team/a", expect_exit: 0 }   # an action on behalf of a user: cannot be checked by observation
  - id: survives-reboot
    envs: [v86, vm]
    probe: { action: reboot, then: ["units[orders.service].active=active", "http.health.status=200"] }
```

`as_user`, `survives_reboot` and `after_wait` are actions, not observations; in 09 they must become kinds of `probe` (`as`, `action: reboot`, `action: wait`). Right now 09 allows `probe` only with `envs: [vm]` or `[v86, vm]`, while 02 uses `as_user` on tier A too (D7, D8) — 09 needs to explicitly allow `probe: {as: …}` for `sim` (the Stand can run a command on behalf of a user in a copy of the state).

---

### 9. MAJOR. `dt.facts/v1` lacks fields that the Linux checks need

**Where:** 4.3, 7.2, 7.3 (and 09, 2.2).

**What is wrong.** The 09 predicate grammar cannot do a bitmask, and the mode in the facts is a string; 02 checks the mode by mask (`mask 0070 equals 0070`). The facts lack: unit properties (`User`, `Restart`, `MemoryMax`, `StartLimitBurst`), crontab, fstab, `blkid`, `lsattr` attributes, file capabilities, `nice`/`ioprio`, hostname per namespace, `pids.events` events, the "character device" type (needed for whiteout). Without them, half of the 02 trainers and all of the K1–K10 trainers cannot be checked.

**Fix.** A list for 09 (as a request from 02): `files[*].perm: {u, g, o: an 'rwx' string, setuid, setgid, sticky}`, `files[*].type` += `c`, `b`, `p`, `s`; `files[*].caps`, `files[*].attrs`, `files[*].acl`; `units[*].props: Record<string,string>` via `needs: units:<name>:<props>` (through `systemctl show -p`); `cron: {user, line}[]`; `fstab: {spec, file, vfstype, options}[]`; `blkid: {dev, uuid, type}[]`; `procs[*].args`, `nice`, `ioprio`, `state`, `threads`; `uts: {ns, hostname}[]`; `cgroups[*]['pids.events']`, `cpu.stat`; `journal: {unit, since, regex → count, first}` on request. This is exactly what the 02 agent already collects with `stat`, `systemctl show`, `crontab -l`, `findmnt -J` (4.2) — the fields just need to be named.

---

### 10. MAJOR. Command events via a FIFO hang the learner's shell if the agent is not reading

**Where:** 4.2, the paragraph "Command events".

**What is wrong.** `PROMPT_COMMAND` writes to the named pipe `/run/trainer/events`. Opening a FIFO for writing blocks until there is a reader. If the agent crashed or the learner stopped it (and 4.2 explicitly describes this case and does not restart the agent by itself), every next bash prompt will hang forever — the learner will see a "broken terminal" without a single message.

**Fix.** Do not write into a FIFO; instead append a line to an ordinary file `/run/trainer/events.log` (tmpfs, `>>` does not block), which the agent reads via `tail -F` and truncates at startup; or send a datagram to a Unix socket (`logger -u /run/trainer/events.sock`), which returns an error immediately if there is no reader. Add a requirement to the text of 4.2: "writing an event must not block the shell for longer than 50 ms; test — stop the agent and run 10 commands".

---

### 11. MAJOR. The "password login is disabled" check checks nothing

**Where:** 7.2 D25, 7.3 E3 (`on: laptop`).

**What is wrong.** E3 has `ssh -o BatchMode=yes -o PubkeyAuthentication=no server true` with `exit_not: 0`. `BatchMode=yes` forbids the password prompt, so the command will fail even if password login is allowed: the check always passes. D25 has `ssh -o PubkeyAuthentication=no server` without `BatchMode`: if passwords are allowed, ssh will wait for input, and the check will hang until the timeout.

**Fix.** Ask the server which methods it offers instead of trying to log in: `ssh -v -o BatchMode=yes -o PubkeyAuthentication=no -o PreferredAuthentications=password,keyboard-interactive server true 2>&1` and check that the line `Authentications that can continue:` contains neither `password` nor `keyboard-interactive`. Plus `sshd -T` on the server: `passwordauthentication no` **and** `kbdinteractiveauthentication no` (in Debian 12 `KbdInteractiveAuthentication no` is the default, but the learner may turn it on; the trap "turned off passwords, but keyboard-interactive with PAM still lets you in with a password" deserves a separate paragraph in the debrief). Keep in mind that in Debian 12 settings may live in `/etc/ssh/sshd_config.d/*.conf`, and the first value found wins: `sshd -T` shows the result, while a `grep` of one file does not.

---

### 12. MAJOR. E1: breakage 3 contradicts the "after a reboot" story; E2: a 512 MB root does not fit into the tab's budget

**Where:** 7.3, E1 (item 3), E2 ("Setup").

**What is wrong.** E1: the story is "after a reboot the server does not respond", and the port is occupied by "a forgotten manual run of `nohup nc -lk 8080 &` as `student`". After a reboot there is no such process; besides, the `survives_reboot` check will itself kill `nc`, and a learner who found nothing will pass the item by accident. One more detail: if `orders.service` reads `config.env` via `EnvironmentFile=`, the file is read by systemd as root, and breakage 2 will not reproduce — the text must say explicitly that the file is read by the application itself.

E2: the root is "a separate 512 MB ext4 image on `hda`". In the browser this means 512 MB in the tab's memory with the 09 budget of "≤ 600 MB per tab with one machine" and a 256 MB guest; the snapshot either grows to the size of the disk, or the disk does not get into it and the exam state is lost on page reload (exactly how `save_state` behaves with a buffer disk needs to be checked in a spike).

**Fix.** E1: occupy the port with a service that survives a reboot — `orders-debug.service` (enabled, `ExecStart=/usr/bin/nc -lk 8080`, description "temporary debug listener") or an `@reboot` line in `student`'s crontab. A mandatory check: `!units[orders-debug.service].enabled=enabled || !net.listen[port=8080][comm=nc]` after a reboot. E2: keep the root on 9p, and make the "filling" partition a separate sparse 128 MB ext4 on `hdb`, mounted at `/var` (or at `/srv/app` with the application's data and logs), and reduce the volumes proportionally: log 45 MB, package cache 15 MB, temporary files 10 MB, data 25 MB, dumps 1 MB each; `fs_free min_mb` 40 and 35. Change the story to "the `/var` partition is 100% full". Describe the predicates `file_sha256_tree`, `cron_entry_absent_or_disabled`, `after_wait` (finding 8).

---

### 13. MAJOR. Support steps, hints and the AI diverge from 01

**Where:** 4.3 (`hints`), 5.2, 7.2, 8.

**What is wrong.** (a) "Each hint costs one point" — in 01 (12.2) the course has no points, and hints affect only the FSRS rating (H4–H5 → Hard) and the support step. (b) Section 8: the assistant "does not give a ready command *unless the learner explicitly asks*" — in 01 (14.2) there is no ready solution at any step, and to the request "tell me the answer" the tutor explains why it will not and offers the next step (the basis is Bastani et al., 2025). (c) The module structure in 5.2 (theory → quiz → trainers → final task) does not match the lesson anatomy of 01, 7 (hook → watch → try → explanation → practice → check → review): no hook, no "predict", no exit ticket, no FSRS queue, and the experienced has no "task first". (d) The trainers in 7.2 are given in one wording, without the S0–S5 steps (worked example, fill-in-the-gap, Parsons, independent, transfer, breakage).

**Fix.** (a) Remove "minus one point"; write "an opened H4–H5 hint lowers the review rating to Hard and does not raise the support step (01, 9 and 14.2)". (b) Replace the sentence in section 8 with a reference to 01, 14.2–14.3 and add the D4 step rule (finding 2). (c) Rewrite 5.2 as "a lesson per 01, 7; module = 2–5 lessons + trainers + a final task" and mark the scenes with the 08 kinds (`story`, `mechanism`, `lab`, `check`). (d) For each trainer in 7.2, state the starting step and give at least S0 and S5. Example for D7: S0 — `chmod u+x backup.sh` and `ls -l` before and after are shown; S1 — `chmod __ backup.sh`; S2 — a Parsons problem from `chmod`, `u+x`, `go-x`, `+x`, `backup.sh`, `sudo`; S3 — the original task; S4 — a different file and "the owner and the group can run it"; S5 — "the script stopped running after `git clone`" (the `x` bit was lost).

---

### 14. MAJOR. The diagrams violate the R4/R5 and 08 style: plumbing, ink for mechanisms, characters

**Where:** 6 (introduction), 6.2, 6.5, 9 (the `engine/ink.ts` row).

**What is wrong.** "The pipeline as plumbing": machines, pipes, taps, a "tank file", a "tap-in" — a metaphorical drawing, while R4 requires blocks, arrows and captions on lines without decoration. The introduction to section 6 and the table in section 9 use `ink.ts` for "self-drawing diagrams of boot, disks, ssh" — 08 (5.1) allows ink only for metaphors, and R5 says directly "not Sankofa ink drawings". 6.2 has "three characters".

**Fix.** Replace 6.5 with storyboard X3, and 6.2 with X5 (finding 3). In the introduction to section 6, instead of the sentence about `ink.ts`, write: "All diagrams are blueprints following the rules of 08, section 5: a precise line, an 8 px grid, color encodes the layer (`--c-kernel` — the kernel at the bottom, `--c-user` — processes, `--c-ns-*` — namespaces, `--c-limit` — limits). From Sankofa we take magazine-quality text presentation, scroll scenes, layers (`layers.ts` for overlayfs), calm mode, lenses, QR, bilingual YAML, `draft`/`hold`; ink is not used in the Linux block". Remove the `engine/ink.ts` row from the table in section 9.

---

### 15. MAJOR. The terminal and output: the look required by R5 is not specified

**Where:** 1.1, 6.1, 6.6.

**What is wrong.** R5 requires "a beautiful terminal" and meaningful color. In 02, the terminal is "`@xterm/xterm` 6.0.0" without a theme, font or markup.

**Fix (ready text for a new 6.0 "Terminal").** "The font is IBM Plex Mono 14/20 (08, 5.2), ligatures off. The theme uses the 08 tokens in two variants (light and dark), the 16 ANSI colors are chosen so that `ls --color` and `systemctl status` stay readable with a contrast of ≥ 4.5:1. The prompt: `student@lab:~$` in `--c-user`, the root prompt (`#`) in a separate color with the caption "you are root" on its first appearance. Lines that came from the kernel (`dmesg`, console messages) are marked with a `--c-kernel` bar on the left. On top of the output there is markup, not a replacement: clicking a line opens a column breakdown (08, 3.4), the key error line is highlighted (01, R14). Width is 80–100 columns; on a phone, horizontal scrolling happens only inside the terminal, the page does not scroll sideways. The bell is off."

---

### 16. MAJOR. L0–L13 use terms before they are introduced

**Where:** 5.1, 7.1, 7.2, 3.1.

**What is wrong (specific places).**
- L0 introduces "kernel", while 01 (L27) introduces it after the process, and the 01 lesson example (7) says directly "the kernel is not introduced here, it is mentioned via the operating system". One of the two must be fixed; I propose: the kernel is not introduced in L0, it is introduced formally in L16 (finding 1), and in L5 diagram X5 says "the system checks", before L16.
- D7 (L5) — "The script `~/backup.sh`…" and running `./backup.sh`: "script" and "shebang" are introduced by L9, and running via `./` relies on `PATH` from L7. Proposal: in L5 say "executable file", give running via `./` in L5 in one line with a `forward` card, or move D7 to L7.
- D11 (L6) — `./noisy` before L7 (the same).
- The L4 quiz — "the hash in `/etc/shadow`": "hash" (L30) is not introduced anywhere. Replace with "the password is stored in encrypted (hashed) form in `/etc/shadow`, which only root can read" with a card, or introduce `sha256sum` (L30) in L2 or L13.
- L8 introduces `/proc/<pid>`, while 01 (L26) requires L25 (mounting). This is an error in the 01 graph, not in 02: `/proc` as a "window into processes" is understandable without mounting. I will fix 01: L26 requires L17, L03.
- The L7 quiz: "`bash -c` is a newly started command" relies on the process (L8). The wording is acceptable as long as the word "process" is not used; that is how it is now — keep it.
- Diagram 6.4 in L8: "the orphan goes to PID 1" and "`systemd`" before L11 (init, systemd). For L8 write "to the first process of the system (PID 1)", the name systemd from L11.

**Fix.** Add a "graph concepts" column to 5.1 (finding 6) — then the build will find these places itself; fix the listed ones in the text.

---

### 17. MAJOR. Concepts of the 01 graph that 02 does not introduce anywhere: archives, checksum, JSON

**Where:** 5.1.

**What is wrong.** The 01 graph has L29 (`tar`, `gzip`), L30 (`sha256sum`), L31 (YAML and JSON) in the Linux block. The sandbox has `tar` (3.3), the image has `jq`, the agent answers in JSON, but no module introduces these concepts. D08 (an image = layers that are archives), D19 (digest), N15 (certificate and hash) rely on them.

**Fix.** `tar`/`gzip` — in L2 (beginner) as one lesson "pack a directory and unpack it"; `sha256sum` — in L13 (next to the inode: "identical data — identical fingerprint"), with a trainer "find which of three files has changed". JSON and `jq` — in L9 as one lesson "a script reads JSON" (`jq -r '.items[].name'`); leave YAML to block 06 (Y), as decided there, and ask me to move L31 to 06 in the 01 graph — I will do it.

---

### 18. MAJOR. overlayfs, `chattr` and writing large files on the 9p root do not work as described

**Where:** 1.3 (root on 9p), 6.6, 6.8; the new K8, DL4-4.

**What is wrong.** The machine's root is 9p. overlayfs requires the upper layer to support `d_type`, `trusted.*` attributes and `O_TMPFILE`; 9p in v86 does not provide this, and `mount -t overlay` with upper on 9p will fail. `chattr +i` does not work on 9p (there is no ext4 attribute ioctl). In 6.6, `dd if=/dev/zero of=/tmp/x bs=1M count=200`: on 9p, 200 MB will land in the tab's memory and in the snapshot, and "wa" (waiting for disk) hardly grows in v86 with 9p — the diagram will show something other than what it promises.

**Fix.** Write in 1.3: `/run` and `/tmp` are tmpfs (`tmp.mount` enabled), all overlay exercises are on tmpfs (`/run/ov/{upper,work}`), the `chattr` and `lsattr` ones on the ext4 of the second disk (`/data` from D23). In 6.6, generate disk load by writing 32 MB to `/data` with `oflag=direct`, and honestly caption on screen that in the emulator disk waiting is small, and show a `top` snapshot from a real server next to it. Add to the budget (1.3): "files the learner creates on 9p live in the tab's memory; the limit is 64 MB, beyond that a warning".

---

### 19. MAJOR. Several machines (R11) and the machine network: `inbrowser` does not give what the lessons and the visualization need

**Where:** 1.5, L15, 6.9.

**What is wrong.** R11 requires several v86 instances in Web Workers, 64–128 MB each, connected by *our own* JS switch with real L2 (ARP, ping, tcpdump, routing, NAT, WireGuard) and a visualization of the switch. 02 connects two machines via `inbrowser` (BroadcastChannel): frames are not visible to the diagram, the switch cannot be controlled (you cannot break a link or lose a packet), and Debian with systemd at 192 MB ×2 does not scale to 3–4 nodes on a laptop.

**Fix.** In 1.5: "Machines of one lab are connected by a shared `vswitch` engine (owner: 09): v86 sends frames via the bus event `net0-send` and receives them via `net0-receive`; the TypeScript switch learns a MAC table, emits a `net.packet` event (08, 3.0) for the packet animator, and can turn off a port and drop every Nth frame (for "break it")". In the image table: for L15 (two machines) `lab-debian` at 192 MB stays; for 3–4 nodes (networks, hybrid Kubernetes from R11) — `lab-alpine`/`lab-node` at 96–128 MB, which is the domain of 03, 05 and 09. In 6.9, add a view of a two-port switch with ssh frames passing through it — then "where it broke" on the diagram also shows a network cause (port off → `Connection timed out`), not only keys.

---

### 20. MAJOR. The theory of the modules is not described: R1 (a coherent textbook) is not ensured

**Where:** 5.1, 5.2.

**What is wrong.** R1 puts the textbook — coherent theory with a strict order — first. In 02, a module's theory is "a 5–10 minute theory scene" and a list of concepts; there is not a single outline: what statements the module makes, in what order, what model the learner should end up with. From such a description, content authors will write 17 different textbooks.

**Fix.** For each module, add an "outline": 5–8 statements in the order of presentation, each with a source (the two-source rule) and a scene. An example for L8 (paste as a sample):

> 1. A program is a file on disk; a process is a running program with a number (PID), memory and open files. *Scene X2, steps 4–6; `ps(1)`, `proc(5)`.*
> 2. Every process except the first was created by another process, its parent (PPID); hence the tree. *Diagram 6.4; `pstree(1)`.*
> 3. A new process is a copy of the parent into which another program is then loaded (fork and exec); this is why environment variables and redirections are inherited. *X2; `fork(2)`, `execve(2)` — a source for the author, not shown to the learner before L16.*
> 4. A process is almost always waiting (S), sometimes running (R), it can be stopped (T); one that has exited but has not been "collected" by its parent is a zombie (Z). *6.4; `ps(1)`, section PROCESS STATE CODES.*
> 5. A signal is a short message to a process from the kernel or another process; the process can handle most of them itself, but not `SIGKILL` and `SIGSTOP`. *6.4; `signal(7)`.*
> 6. The exit code is a number the process leaves for its parent; 0 is success; in the shell it is `$?`. *X2 step 8; `bash(1)`, EXIT STATUS.*
> 7. Load average is the average number of processes that are running or waiting for the CPU or the disk, over 1, 5 and 15 minutes. *6.6; `proc(5)` (`/proc/loadavg`), `uptime(1)`.*

---

### 21. MINOR. `kill -HUP nginx` and the text in the nginx log

**Where:** 3.1.

**What is wrong.** `kill` takes a PID or a job number, not a name: `kill -HUP nginx` in bash gives `kill: nginx: arguments must be process or job IDs`. The sandbox, which is checked against Debian (3.4), must produce the same error. On `SIGHUP`, nginx writes to `error.log` not `reloading` but `signal 1 (SIGHUP) received from <pid>, reconfiguring`.

**Fix.** "`pkill -HUP nginx` or `kill -HUP $(cat /run/nginx.pid)` writes to `/var/log/nginx/error.log` the line `[notice] …: signal 1 (SIGHUP) received from …, reconfiguring`"; add `pkill`/`pgrep` to table 3.3 (they are already in L8, but not in the sandbox).

---

### 22. MINOR. `navigator.deviceMemory` exists only in Chromium-based browsers

**Where:** 1.6.

**What is wrong.** In Firefox and Safari the property does not exist (`undefined`), and the condition `navigator.deviceMemory < 4` is false there — tier B will start automatically even on a weak machine.

**Fix.** "If `deviceMemory` is undefined, estimate from `navigator.hardwareConcurrency` and the device type (`isPhone` from Sankofa), and ask the learner before the first machine start with one line giving the download size."

---

### 23. MINOR. v86 has one virtual CPU — multi-core examples must be presented differently

**Where:** 2.2 (experienced question 4), 6.6, D26.

**What is wrong.** v86 does not emulate SMP: `nproc` = 1, "queue / number of cores" on the live machine is always divided by 1, and D26 asks "how many cores" — the answer is always 1, and the task degenerates.

**Fix.** In 6.6 and L16, show multi-core examples on recorded `top` snapshots from a real server (next to the machine's live `top`). Rephrase D26: "how many processors does the machine see, how much memory is available, what is the 5-minute load average; explain whether the machine is overloaded" — with the explanation checked against a rubric.

---

### 24. MINOR. Orphan and zombie: "to PID 1" is not always true

**Where:** 6.4.

**What is wrong.** In Linux an orphaned process goes to the nearest ancestor that is a "subreaper" (`PR_SET_CHILD_SUBREAPER`), and only if there is none, to PID 1. Under `systemd --user` and in containers with `tini` this is not PID 1. For L8 the simplification is acceptable, but in L17 it becomes untrue.

**Fix.** In L8: "usually to PID 1"; in L17 (and as a bridge to 04, where PID 1 and `tini` appear): a screen about the subreaper and about why PID 1 in its own pid namespace must reap zombies.

---

### 25. MINOR. The load from `yes` and `memhog` on the emulator

**Where:** 3.1, 6.6, D15.

**What is wrong.** `yes > /dev/null` in v86 takes the emulator's only CPU entirely: the terminal and the agent start responding with delays of seconds, and the 1.5 s silence check (09, 2.5) fires late. `memhog` is a program from the `numactl` package; it is not in the image (it is not said where the "teaching" one is built).

**Fix.** A teaching load generator `burner` with `nice 10` by default (the task shows that there is load, but the machine is responsive); keep `yes` in the sandbox. List all teaching programs (`burner`, `leaky`, `threads-demo`, `zombie-demo`, `web-demo`, `orders-server`, `legacy-agent`) in 1.3 in one line: "static i386 binaries from `tools/lab-bins/`, built in CI".

---

### 26. MINOR. Sources: outdated and irrelevant links

**Where:** 10.

**What is wrong.** (a) The Russian man pages on `opennet.ru/man.shtml` are largely from FreeBSD or very old GNU versions — the flags diverge from Debian 12. (b) For L8, "ArchWiki: Systemd/Journal" as a source on signals is not about signals. (c) The systemd links lead to `freedesktop.org/…/latest/`, while the machine has systemd 252 (Debian 12). (d) container2wasm has moved to `github.com/container2wasm/container2wasm` (the old link redirects, and 09 already uses the new one).

**Fix.** The main EN source for commands and formats is `manpages.debian.org/bookworm/…`; for RU, the translations in the same place where they exist (`…/bookworm/manpages-ru/…`), otherwise the Russian ArchWiki; opennet only if the page matches the GNU version (checked under the two-source rule). For L8 RU, a translation of `signal(7)` or Linux Journey (the RU translation) instead of the article about the journal.

---

### 27. MINOR. The A → B transition: file owners and permissions

**Where:** 1.1.

**What is wrong.** `emulator.create_file` creates a file in 9p without taking into account the uid/gid and mode from the sandbox; after the transition, the learner's files may end up owned by root with the default mode — and the L5 "permissions" task on tier B will start with the wrong picture.

**Fix.** "After the machine starts, the agent applies the manifest `/run/trainer/home.manifest` (path, mode, uid, gid) via `chown`/`chmod`; the transition check is a comparison of `stat` before and after in CI."

---

### 28. MINOR. `dnsmasq-base` without a service

**Where:** 1.3, 1.5.

**What is wrong.** `dnsmasq-base` provides only the binary, without a unit file and `/etc/dnsmasq.d`; "dnsmasq with the zone `lab.` running inside the machine" will not work by itself.

**Fix.** Install the `dnsmasq` package or our own `lab-dns.service` with `ExecStart=/usr/sbin/dnsmasq -k --conf-file=/etc/lab/dnsmasq.conf`. If L14 goes to 03 (finding 4), the `lab.` zone is needed only by E3 and L15 — then `/etc/hosts` is enough.

---

### 29. MINOR. The boot in 6.7 promises journal lines for stages this machine does not have

**Where:** 6.7.

**What is wrong.** "Each stage is confirmed by real journal lines of the current machine", but v86 has no bootloader (the emulator loads the kernel itself), and `systemd-analyze` will not show `firmware` and `loader`. Besides, the learner's machine starts from a snapshot: the "current boot" is the boot in CI, and the times in the journal predate the snapshot restore.

**Fix.** Accounted for in X1 (step 2, the honesty card). Add one sentence to 6.7: "the boot journal comes from building the snapshot in CI; after `systemctl reboot` (trainers with `survives_reboot`) the learner sees their own boot, and the diagram offers to compare".

---

### 30. MINOR. The bridge to containers (R7c) can start in Linux

**Where:** 5.1 (L0, L16).

**What is wrong.** R7c asks the containers block to show that the Linux in the browser is itself a VM (`dmesg`). The Linux block can prepare this without introducing the term "VM" before D02.

**Fix.** In L16, a screen "How does this machine know it is not real": `dmesg | head`, `cat /proc/cpuinfo` (the emulator's CPU model), `cat /sys/class/dmi/id/*` (SeaBIOS data) — with a `forward: [D02]` card "such a machine is called virtual; in detail, in the Docker block". Check in a spike beforehand what `systemd-detect-virt` shows in v86: the emulator most likely does not set the hypervisor flag in CPUID, and the answer will be `none` — this is also good material ("the kernel learns about a hypervisor only if it announces itself"), but the wording must be taken from the machine, not invented.

---

### 31. MINOR. Small inaccuracies in quizzes and trainers

**Where:** 7.1, 7.2.

- The L5 quiz (`drwxr-xr--`, "others"): "`ls` will show the names with attribute access errors" is true only for `ls -l` (or `ls` with color, which does a `stat`); plain `ls` without color shows the names without errors. Clarify: "`ls` shows the names; `ls -l` shows the names and `?????????` instead of attributes; `cd` fails".
- D1: the check "`history_contains: cd`" contradicts the principle "the result, not the ritual" (4.3); `cwd=/var/log` and the last command `pwd` from the `cmd.done` event are enough.
- D5: the regular expression `ls .*-[a-zA-Z]*S` does not accept `ls --sort=size` — a correct answer from the same page. Check via `→ file`: the learner's output against the reference `ls -S /var/log`.
- D14: the regular expression `PATH=.*\$HOME/bin|~/bin.*:\$PATH` does not accept `export PATH="$PATH:$HOME/bin"` with quotes and `PATH=$PATH:/home/student/bin`. Check by behavior (a new interactive shell finds `hello`) — the second check already does this; keep the first as `soft`.
- D20: "the agent does `kill -9` on the main process" — `Restart=on-failure` restarts after `SIGKILL` too, but so does `Restart=on-abnormal`; extend the list of accepted values to `on-failure`, `on-abnormal`, `always`.
- The L11 quiz (`ExecStart=/usr/bin/python3 app.py`): the error in the journal will be `python3: can't open file '/app.py': [Errno 2] No such file or directory` — quote it verbatim (01, R14: the whole error, with the key line highlighted).

---

## What I will do in 01 following this review

So that the author of 02 does not have to wait: I will add the concepts L33–L41 to the graph (finding 1), turn D03/D04/D05 and part of D09 into "recall" with prerequisites on L35–L40, fix the prerequisites of L26 (`/proc` without mounting, finding 16) and L27 (the kernel after the process — I am keeping it), move L31 (YAML) to block 06, and add to 01 a section "Documentation ladder" shared by all blocks, with the table of steps D1–D5 from finding 2. The module numbers `lx00`–`lx17` and the "graph concepts" column in 5.1 are to be added by the author of 02.
