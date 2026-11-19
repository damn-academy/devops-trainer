# Review of 02-linux.md (reviewer: the author of 04-containers.md, a container runtime engineer)

Date: 18.11.2026. The document under review was not modified.

## Verdict

For the first wave, the document is strong. Three tiers, checks by state rather than by ritual, checking the sandbox against real Debian in CI, exams E1–E3 with a chain of breakages are done at the level of a good production trainer (SadServers/Killercoda), and almost all of it can be built. The document cannot be accepted as is, for three reasons.

1. **There is no foundation for containers (R6).** The containers block relies on namespaces, cgroups v2, capabilities, chroot/overlayfs, PID 1 and signals, fork/exec and threads. In the document all of this is squeezed into one line L16, "namespace, cgroup (as preparation for the Docker block)", and the beginner does not take this module at all. As a result, the concept graph from 01 (`D03 → L27`, `D04 → L26`) simply will not build on the beginner route.
2. **The owner's additional requirements R1–R5 and R11 are not accounted for**: there is no documentation ladder, the process explainers have no parameters and no "break it" mode, half of the diagrams are built on metaphors and ink, and there is no multi-machine network through our own switch.
3. **There are technical errors that will break lessons on tier B.** The main one: the v86 9p server does not support xattr. So `setfacl`, `setcap` and overlay with upperdir on the root do not work, and L5 (ACL), the accepted solution of E1 and the whole capabilities lesson from R6 depend on them. Another one: the events FIFO hangs the shell. In addition, there are discrepancies with 01 and 09 (identifiers, kernel, machine interface, check format).

Below are 31 findings: BLOCKING — 5, MAJOR — 19, MINOR — 7. For R6 and R2–R4, ready text that can be pasted is given.

---

## Part 1. Blocking

### 1. BLOCKING — §1.3 "Tier B image", §1.4, §4.2, §5.1 L5, §7.3 E1: a root on 9p does not hold xattr, and therefore ACL, capabilities and overlay

**What is wrong.** The v86 9p server (`lib/9p.js`) answers `Txattrwalk` with the error `EOPNOTSUPP` ("Setxattr not supported"), and writing to an xattr fid is also rejected. Checked against the master source on 18.11.2026. Consequences:
- `setfacl`/`getfacl` (L5 "for the experienced — ACL", tier B) fail with `Operation not supported`;
- the acceptable E1 solution "ACL `setfacl -m u:orders:r`" is impossible on this machine;
- `setcap`/`getcap` (security.capability) do not work, and without them there is no capabilities lesson from R6;
- the overlayfs upperdir cannot be put on 9p (this is already written in 04, §6.1), so the overlay lesson from R6 also needs a different FS;
- in addition, `findmnt /` and `df /` show `host9p ... 9p`, and in L13 the beginner sees an incomprehensible entity in place of the root.

**How to fix** (choose in the spike in §11.1; add the item to the spike):
- Option A (I recommend it). Keep the `lab-debian` root on an ext4 image attached as `hda` via the v86 asynchronous buffer (blocks are loaded lazily via Range, written blocks go into `save_state`: `AsyncXHRBuffer.get_state` saves `block_cache_is_write`). Then xattr, ACL, capabilities, overlay, an honest `df`, real inode numbers and E2 without a separate image all work. The price: direct reading of the FS from JS (`fs-probe`, §4.2) is lost, and the live tree (§6.3) will have to be built via the agent (`find -printf` with a diff once a second, only for open branches).
- Option B (minimal). Keep the root on 9p, and add a second ext4 disk `hdb` (256 MB) to the base snapshot, mounted via fstab as `/srv`, plus a tmpfs `/lab`. Do all exercises with ACL, capabilities and overlay there. In the text of L5 and E1, state the paths explicitly: `/srv/team`, `/srv/orders/config.env` instead of `/etc/orders/config.env`.
- In either option, add an image test to CI: `setfacl -m u:nobody:r f && getfacl f`, `setcap cap_net_bind_service=+ep f && getcap f`, `mount -t overlay` on every starting snapshot.

### 2. BLOCKING — §5.1, row L16; §2.1: the foundation of containers is unavailable to the beginner and does not cover R6

**What is wrong.** L16 is marked "I, E", and the beginner goes straight from L15 to networks and Docker. In 01, the concept `D03` (namespaces) requires `L27` (kernel, system call), and `D04` (cgroups) requires `L26` (`/proc`, `/sys`). If the beginner skips L16, the build of the beginner route fails under rule 01 §6.1. Besides, in terms of content L16 has only `lsns`, `unshare`, `systemd-cgls`, `cat /sys/fs/cgroup/...`. There are no threads, fork/exec, the special semantics of PID 1, capabilities, chroot, overlayfs, seccomp, the OOM killer, the user namespace.

**How to fix.** Split L16 into two modules and make both mandatory for all levels (the beginner gets reduced depth, but not a skip):
- **L16. Kernel, system calls, /proc** (B, I, E);
- **L17. How the kernel isolates and limits** (B — the core of the module, I — in full, E — in full plus userns and seccomp by hand).

The full text of L17 is given in finding 21.

### 3. BLOCKING — §5.1, §7.2, §7.3: identifiers conflict with the 01 graph and with the Docker block

**What is wrong.**
- Modules `L0…L16` share a namespace with the concepts `L01…L32` from 01 §6.2. "L16" in 02 is the module "Kernel", and in 01 the concept "Environment variables, PATH". The glossary from §5.1 ("a term is marked up as `[[process]]`, the build checks the numbers") and `concepts.yaml` from 01 check different numbers.
- Trainers `D1…D26` coincide with the Docker block modules `D1…D12` (04 §3.2) and with the concepts `D01…D23` (01). "D9" means three different things.
- Exams `E1…E4` coincide with the exams in 04 §13 (`E1…E4`).
- 01 prescribes the item identifier format: `linux.process.drill.3`.

**How to fix.** Modules — `linux.m00 … linux.m17` (in text, "Module 8. Processes"). Trainers — `linux.m05.drill.2`. Exams — `linux.exam.service`, `linux.exam.disk`, `linux.exam.access`, `linux.exam.cloud`. Concepts — only identifiers from 01's `concepts.yaml`: in module texts write `introduces: [L17, L18]`, not a list of words. Add a "Concept IDs" column to the §5.1 table. Example for the current L8: `introduces: [L17, L18, L19]`; `/proc/<pid>` belongs to `L26` and is introduced in L16, not L8, otherwise the order `L26 → L25` is violated.

### 4. BLOCKING — §4.2 "Command events": the named pipe hangs the shell

**What is wrong.** `PROMPT_COMMAND` writes to the FIFO `/run/trainer/events`. Opening a FIFO for writing blocks until there is a reader. If the agent is stopped (and §4.2 explicitly discusses that case: "if the learner stops it"), crashed, or has not started yet after `survives_reboot`, the shell hangs after every command. The learner sees a "broken terminal", and the hint about the missing heartbeat does not explain it.

**How to fix.** Write non-blockingly, accepting lost events rather than waiting. For example, `printf '%s\n' "$json" >> /run/trainer/events.log` (the agent reads it via `tail -F`; the file is on tmpfs, rotated by the agent at 1 MB) or `logger --socket-errors=off -u /run/trainer/ev.sock "$json"` (a datagram socket: if there is no reader, an error, but no blocking). Protect the agent itself with `RefuseManualStop=yes` and `Restart=always` in `trainer-agent.service`. Then "a restart via `serial0_send("sudo systemctl start …")`" is no longer needed — it types into someone else's input and runs into the sudo password.

### 5. BLOCKING — sections 6 and 7: R2 (the documentation ladder) and R3/R4 (process explainers with parameters and "break it") are not met

**What is wrong.** The document does not mention the documentation ladder even once. The AI assistant in §8 is designed as "explain/guide", while R2 at step 4 requires the answer "where did you look?" with a redirect to `man`/`--help`. The exams (§7.3) run "without hints, without AI", but there is no "only official documentation is open" mode and no tasks on material not covered. Abridged man pages with translation (§3.3) and `man-db` "only for the commands from 3.3" (§1.3) make steps 2–5 impossible: the learner does not see the real anatomy of a page, and at step 4 the needed pages simply do not exist. The explainers (section 6) have no parameters, no "break it" toggles, no recalculation of the process when a parameter changes, and no step scrolling. There are no explainers for fork/exec/PATH and "systemd restarts a crashed service", which R3 names directly for Linux.

**How to fix.** Ready text in findings 22 (the ladder), 23 (storyboards) and 24 (step 5 exams).

---

## Part 2. Major

### 6. MAJOR — §1.3, §1.4: divergence from 09 on the kernel, agent, storage and interface

- **Kernel.** 02 uses `linux-image-686` from Debian. 09 §1.4 adopted one kernel, `dt-kernel` 6.12 LTS i686, for both roots (`lab-debian`, `lab-alpine`). Remove `linux-image-686` from the package list, and refer to `dt-kernel` in `cmdline`. There are two consequences: the vanilla configuration does not have the Debian patch `kernel.unprivileged_userns_clone`, and `dmesg_restrict` will be whatever it is built with (see finding 27).
- **Agent.** In 02 it is `trainerd`/`trainer-agent` in bash, `User=root`, protocol `op: check / snapshot`. In 09 it is `trainer-agent` in POSIX sh from `/opt/trainer/` via 9p, protocol `op: facts / watch`, format `dt.facts/v1`. Keep one name (`trainer-agent`) and one protocol, the one in 09.
- **Snapshots.** In 02 they are in IndexedDB (`lab:<labId>:v<imageVersion>`), in 09 in OPFS (`/vm/<image>@<version>/<lab>/{latest,prev}.zst`). Rewrite §1.4 for OPFS, keep the saving rules from 02.
- **Interface.** `Machine` in 02 (`tier: 'sandbox'|'v86'|'cloud'`, `check(Predicate)`, `snapshot(kind)`) does not match 09 §1.5 (`kind: 'sim'|'v86'|'remote'`, `facts(scope)`, `events()`). Replace §4.1 with a reference to 09 §1.5. Express the "snapshots" `tree/procs/units/mounts/sockets` as fact `scope`s: `files`, `procs`, `units`, `mounts`, `net.listen`.
- **The name of tier A.** In 02 it is the "Sandbox", in 09 the "Stand", and in 08 "Sandbox with rollback" refers to a terminal feature. One word must be chosen (I propose "Stand", so as not to confuse it with the rollback button from 08).

### 7. MAJOR — §4.3: the predicate vocabulary does not match the 09 §2 contract

**What is wrong.** 02 has its own DSL (`path_mode {mask, equals}`, `unit_active`, `as_user`, `survives_reboot`, `after_wait`, `file_sha256_tree`, `cron_entry_absent_or_disabled`). 09 has `goals: { when: "<a selector over facts>", keep, fail[], probe }`. The last three 02 predicates are not even in its own §4.3 table, although they are used in E2.

**How to fix.** Move the format to 09. What is observable is expressed via `when`. Actions (`as_user`, `survives_reboot`, `after_wait`, `http`) become requested probes in `needs`/`probe`. An example translation of `perm-03-shared-dir`:

```yaml
goals:
  - id: g-team-dir
    say: { ru: "Каталог /srv/team: группе dev — rwx, остальным — ничего", en: "..." }
    needs: [files:/srv/team]
    when: "files['/srv/team'].type=d && files['/srv/team'].group=dev && files['/srv/team'].mode=~'^0?[0-7][0-7]70$|^0?[0-7]770$'"
    fail:
      - if: "files['/srv/team'].group!=dev"
        say: { ru: "Группа каталога всё ещё root: группу меняет chgrp или chown :dev", en: "..." }
        term: L11
      - if: "files['/srv/team'].mode=~'[1-7]$'"
        say: { ru: "У «остальных» остались права: последняя цифра режима должна быть 0", en: "..." }
        term: L11
  - id: g-team-behaviour
    say: { ru: "alice может создать файл, eve — не может войти", en: "..." }
    envs: [sim, v86]
    probe: { as: [ {user: alice, run: "touch /srv/team/a && cat /srv/team/a", exit: 0}, {user: eve, run: "ls /srv/team", exit_not: 0} ] }
```

In 09, `probe` is allowed only for `envs: [vm]` or `[v86, vm]`. For `as_user` on tier A, either the 09 rule must be extended (`probe.as` is computed by the Stand model), or `as_user` must be declared a fact (`access[user=eve][path=/srv/team][op=x]=deny`) — the latter is better: the same `access()` function as in the permissions calculator. The decision must be recorded in 09; on its side, 02 must send the list of actions that need a probe.

### 8. MAJOR — §5.1 L14 and L15: network concepts introduced twice, and SSH without an owner in the graph

**What is wrong.** L14 introduces the interface, IP, mask, route, port, socket, DNS, `/etc/resolv.conf` and HTTP. In the 01 graph these are `N01–N05`, `N08`, `N09`, `N13`, `N14`, and per 03 they are introduced by modules N2–N11 of the next block. A concept can have only one `introduces`. Right now either the build will fail or the concept will be "introduced" twice in different language. L15 introduces SSH and the "key pair", while in 01 this is `N18` (requires `N13`) in the networks block. The 03 program has no SSH module at all, and "public and private key" is introduced by N12 (TLS), i.e. later.

**How to fix** (a proposal for the orchestrator, it affects 01 and 03):
- Rename L14 to "The network through the server's eyes: first commands". It introduces only `N01` (interface and IP: "the machine has an address, `ip a` shows it") and `N04` (a port as the number on which a program waits for connections), plus `N13` at a minimum (`ss -ltnp`, `curl http://localhost:8080`). Present routes, mask, DNS, HTTP as `forward:` from 01 §6.1, one per lesson, with a card "in detail in the Networks block, module N4/N8/N11". Remove `dig` and `/etc/resolv.conf` from L14: they are introduced in N8.
- Move SSH into the graph as a Linux block concept: `L33 SSH: client, server, host fingerprint` (requires `N04`, `L10`, `L11`) and `L34 Key pair: public and private` (requires `L33`). `N12` (TLS) then uses `L34` rather than introducing it. In the protocol catalog from R8, the SSH card references L15.
- Start the numbering of the R6 concepts (finding 21) after these two.

### 9. MAJOR — §5.1: concepts the Docker block needs are not introduced in any module

| Concept (01) | Who requires it | Where in 02 | What to do |
|---|---|---|---|
| `L29` archives `tar`, `gzip` | `D08` image: layers are tar | only the sandbox command table §3.3, in no module | Add to L2 (I: `tar -czf/-xzf/-tf`, `-C`) with a trainer "unpack the site archive into `/srv/site` without creating an extra directory" |
| `L30` checksum `sha256sum` | `D19` digest; `N15` TLS | nowhere (except the agent's internal checks) | Add to L6: "one bit changed — the whole hash is different". Trainer: "which of three downloaded files matches the published sum" (`sha256sum -c SHA256SUMS`) |
| `L31` YAML and JSON | `K02`, `D21`, `C08` | `jq` is in the image, there is no module; 06 introduces YAML as a separate module Y | Agree with 06: if 06 introduces YAML, move the concept to `Y`. JSON and `jq .` — in L6 (the agent and `ip -j` output JSON) |
| bind mount, tmpfs | `D13` volumes (requires `L25`) | L13 without `mount --bind` and `tmpfs` | In L13: `mount --bind /srv/data /mnt/x`, `mount -t tmpfs -o size=16m tmpfs /lab`, the question "where did the files go after a reboot" |
| a service's stdout → the journal | `D11` `docker logs`, R7 "I/O & logs" | L11 introduces the journal but does not say it is the process's stdout/stderr | In L11, one scene: `ExecStart=/usr/local/bin/hello` prints to stdout, the line appears in `journalctl -u hello`; `StandardOutput=journal` by default. A bridge to `docker logs` and the log driver |
| `exec` in the shell | `D15` shell and exec form of ENTRYPOINT, PID 1 | nowhere | In L9: `exec "$@"` at the end of a wrapper, `pstree -p` before and after |

### 10. MAJOR — §6.5 "The pipeline as plumbing": a factual error about SIGPIPE and an R4 violation

**What is wrong.** The claim "you can see that `head -3` finishes before everyone else, and `cat` gets `SIGPIPE`" for the pipeline `cat access.log | grep | cut | sort | uniq -c | sort -rn | head -3` is wrong. `sort` reads its input to the end, so `cat`, `grep` and `cut` have already finished by the time `head` works. Only the last `sort -rn` can get `SIGPIPE`, and only if its output is larger than the 64 KB buffer. The metaphor of "machines, taps, tanks" contradicts R4: blocks, arrows and captions are needed, without decoration.

**How to fix.** Use a separate example for SIGPIPE: `yes | head -3` and `cat big.log | head -3` (a large file, `strace -f -e trace=none -e signal=SIGPIPE`). Redraw the diagram per R4 (see storyboard X3 in finding 23).

### 11. MAJOR — §3.1: the `kill -HUP nginx` command in the sandbox

**What is wrong.** In bash, `kill` takes a PID or a job, not a name: the real `kill -HUP nginx` gives `bash: kill: nginx: arguments must be process or job IDs`. If the sandbox accepts this form, it teaches something wrong, and the check in §3.4 should have caught it.

**How to fix.** In the text write `kill -HUP $(cat /run/nginx.pid)` or `pkill -HUP -o nginx` (a signal to the master process). In the sandbox, `kill <name>` should produce the real bash error.

### 12. MAJOR — §7.3 E2: the sizes do not add up, the snapshot will not fit the budget

**What is wrong.** The root is a 512 MB ext4. Per §1.3 the Debian root is about 350 MB, plus 180 + 60 + 40 + 90 MB of filler, plus dumps. That is more than 700 MB on a 512 MB disk. In addition, all the filler written in CI will end up in the "dirty" blocks of `save_state` (the v86 asynchronous buffer saves written blocks), and the snapshot will grow by hundreds of megabytes with a budget of 40 MB (09 §1.4).

**How to fix.** Fill not `/` but a separate `/var` on a 256 MB `hdb`. Change the story to "`/var` is 100% full": this is just as realistic and even more typical. Write the filler as zeros or repeating blocks (`head -c 180M /dev/zero`, logs from repeating lines), then zstd will compress the dirty blocks down to kilobytes. New sizes: `debug.log` 90 MB (deleted but still open), apt cache 40 MB, `~/tmp` 30 MB, `orders` data 60 MB, 3 MB dumps every 2 minutes; the threshold `fs_free /var ≥ 100 MB`, after 5 minutes `≥ 90 MB`. With option A from finding 1, a separate image for E2 is not needed at all.

### 13. MAJOR — §7.3 E1: two breakages disappear or contradict the story

- Breakage 2 (permissions on `config.env`) exists only if the application opens the file itself. If the unit file author writes `EnvironmentFile=/etc/orders/config.env`, the file is read by PID 1 as root before switching users, and there will be no breakage. The setup must state explicitly: "`orders-server --config /etc/orders/config.env`, `EnvironmentFile=` is not used". Plus a CI test that after fixing breakage 1 the journal really shows `permission denied`.
- Breakage 3: "after a reboot", a manually started `nohup nc -lk 8080 &` does not survive. This contradicts the story ("after a reboot the server does not respond"). Replace it with a forgotten enabled service `debug-listener.service` (`ExecStart=/usr/bin/nc -lk 8080`, `enabled`): it survives a reboot and teaches `systemctl list-units --type=service --state=running` and `ss -ltnp`. Extend the check: `units['debug-listener.service'].enabled!=enabled`.
- Breakage 4 (`disabled`) is visible in `systemctl status` right away, not "after the previous one is fixed". Soften the wording "each next one is visible only after the previous one is fixed" to "the first three".

### 14. MAJOR — §6 (introduction), §6.7, §6.8, §9: Sankofa ink and characters contradict R4/R5

**What is wrong.** "Line illustrations in the theory use `ink.ts`", "the `/data` branch tears off", "three characters" in the permissions calculator, plumbing with taps and tanks — R5 explicitly excludes all of this ("not Sankofa ink drawings"), and R4 forbids "characters, plot, decoration".

**How to fix.** Take from Sankofa only what R5 lists: magazine-style text presentation, scroll scenes, layers, calm mode, lenses, QR, bilingual YAML, draft/hold. Replace the `ink.ts` row in the §9 table with "blueprint" from 08 §5.1 (1.5 px line, 8 px grid, monospaced values). `anna`/`bob`/`eve` remain as accounts, i.e. table rows with UIDs and groups, without avatars. Take colors from 08 §5.2: `--c-kernel` for the kernel (the strip is always at the bottom), `--c-user` for processes, `--c-ns-*` for namespace frames in L17, `--c-limit` for cgroup scales. This is the same color axis as in the containers block, and the learner will recognize it in D2.

### 15. MAJOR — §8: the AI assistant does not implement step 4 of the ladder and is turned off where R2 requires it

**How to fix.** Add assistant modes by ladder step (the `ladder_step` field in the context from 01 §14.4):
- steps 1–2: as now ("explain, guide");
- step 3: does not name the flag, but gives the page name and section ("`man find`, section TESTS, search for the word "newer"");
- step 4: its first question is "where have you already looked?". If the answer is "nowhere" or "in the AI", it sends the learner to a specific source (`man 5 systemd.exec` → `/MemoryMax`, `journalctl --help | grep -i vacuum`, `apropos namespace`). It does not give a ready command even if asked: "at this step you need to find the flag yourself — open `man journalctl` and search for `/disk`";
- step 5 (exam): off, as now.

A refusal to give the command at step 4 is logged as `hint.opened` with `level: redirect` and costs no points.

### 16. MAJOR — §1.5, §5.1 L15: two machines via BroadcastChannel instead of our own switch (R11)

**What is wrong.** R11 requires several v86 instances in Web Workers (64–128 MB each, 3–4 nodes on a laptop), connected by our JS switch with real L2, visualization and `tcpdump`. 02 uses `inbrowser` (BroadcastChannel) and 192 MB per machine. The same mechanism is needed by 03 (a real kernel), 05 (hybrid kube-lite with v86 nodes) and 06 (Ansible over ssh to 3 nodes). It should be described once in 09 and referenced here.

**How to fix** (text for 02 §1.5, the mechanism goes in 09):
- Each machine runs in its own Worker. The v86 network card is `ne2k`/`virtio-net`: outgoing frames arrive as the `net0-send` event, incoming ones are fed into `bus.send("net0-receive", frame)`. The Worker forwards frames via a `MessagePort` (a Transferable `ArrayBuffer`) to `vswitch`, which runs in the main thread or in a separate Worker.
- `vswitch`: a MAC → port table with learning and aging (300 s, as in a Linux bridge), flooding of unknown and broadcast frames, a per-port VLAN tag for R8 (VLAN, intermediate level), port mirroring into a pcap buffer (export of `.pcap` for Wireshark, the same parsing as `netlab` in 03).
- Visualization: the switch is a rectangle with ports, each port with the node's MAC and IP. A frame is a dot that moves along the port's line and is captioned `ARP who-has 10.0.0.2` / `ICMP echo` / `TCP SYN :22`. The MAC table grows next to it.
- Budgets: `lab-debian` up to 128 MB of guest memory per node (check in the spike systemd + sshd + journald at 128 MB: 70–90 MB RSS after boot is expected), 3 nodes on a laptop with 8 GB, 1 on a phone (only on tier A; per §1.6 v86 is not started on a phone).
- What this gives 02: L15 on two nodes (`laptop`, `server`), E3 on two nodes, and in L17 a bridge to networks: `ip netns` inside one node versus two nodes on a switch.

### 17. MAJOR — §2.2: the placement check diverges from 01 §4.3

In 01, the Linux levels are called L0/L1/L2, the L1 check has 8 tasks with a 7/8 threshold and 4 of tasks 1–5 mandatory, the L2 check has 10 tasks with an 8/10 threshold and key tasks 1, 2, 10. 02 has B/I/E, 8 questions each, a 6/8 threshold and one task. The task texts also differ. One version must remain. I propose taking the structure and thresholds of 01, and moving the best 02 tasks (`lsof +L1`, `StrictModes`, `report.service`) into the 01 bank. For R6, add a task to the experienced check: "Why does `kill -TERM` to a process with PID 1 in a new PID namespace do nothing, while `kill -KILL` from the host kills it?" Answer: the kernel delivers to a namespace's init only signals for which it has a handler; SIGKILL and SIGSTOP from the parent namespace are delivered forcibly (`pid_namespaces(7)`).

### 18. MAJOR — §1.3: the package list does not cover R2 and R6

Add:
- `manpages`, `manpages-dev` (sections 2 and 7: `man 7 namespaces`, `man 7 cgroups`, `man 7 capabilities`, `man 2 clone`, `man 7 pid_namespaces`, `man 7 user_namespaces`, `man 2 seccomp`); full pages for all installed packages, not only for the commands from §3.3 (otherwise step 4 of the ladder is impossible); run `mandb` in the image so that `apropos` and `man -k` work;
- `libcap2-bin` (`capsh`, `getcap`, `setcap`);
- `busybox-static` (a rootfs for `chroot` without copying libraries);
- `systemd-container` is not needed; `systemd-run` is part of `systemd`;
- teaching programs (static i386, we build them ourselves, the sources are open): `threads-demo` (4 threads named `worker-1..4`), `memhog N` (already mentioned in §6.6 but not described: allocates and touches N MB at 1 MB per second, prints a counter), `sigdemo` (prints the signals it receives; a `--no-handler` mode), `zombie-demo` (§6.4);
- check in the spike that `unshare`, `nsenter`, `lsns` are in bookworm's `util-linux` (`dpkg -S /usr/bin/lsns`), not in `util-linux-extra`.

### 19. MAJOR — §6.10 "Three views": the "kernel" lens is closed until L16, while the main fork/exec explainer is needed earlier

**What is wrong.** Per 01 §4.3 (the L2 check, task 10), "what happens between Enter and the output of `ls`" is a key understanding. In 02 the "kernel" lens is empty until L16 and only for I/E. R3 requires a fork/exec/PATH explainer in the Linux block.

**How to fix.** Introduce `L27` (kernel, system call, user space) in L8, in the scene "the process asks the kernel" (`L27` requires only `F04`, `L17`), not in L16. The "kernel" lens opens from L8 for all levels; for the beginner with 3–4 calls (`clone`, `execve`, `write`, `exit_group`). Storyboard X2 is in finding 23.

### 20. MAJOR — §5.2: R1 — the textbook is thinner than the practice

**What is wrong.** The theory takes 5–10 minutes of scrolling per module, followed by a quiz and 3–6 trainers. R1 puts a coherent textbook first, process explainers second, the documentation habit third. The document has neither texts nor even chapter outlines.

**How to fix.** In §5.2, before "Theory scene", insert an item "Textbook chapter": a coherent text of 1,500–3,000 words, Sankofa magazine layout, concepts marked up, one X* explainer per R3 embedded in the chapter as a "figure", and at the end a block "How we know this" with links to man and documentation (this is step 1 of the ladder). For each module in §5.1, add the columns "Explainer" (X1–X10 from finding 23) and "Ladder step" (finding 22). A sample chapter outline for L17 is in finding 21.

---

## Part 3. Ready text for R6: module L17 "How the kernel isolates and limits"

### 21. MAJOR — a new module (insert after L16 in §5.1, the trainers in §7.2)

**New concepts for `concepts.yaml`** (numbers after SSH from finding 8; `D03`/`D04`/`D05`/`D09` in 01 are redefined as "the same in Docker" with `requires` on these concepts; on my side I will restructure 04 so that D2/D3 assemble already familiar primitives rather than introduce them):

```yaml
- { id: L35, name: { ru: "Поток (thread) и процесс", en: "Thread vs process" }, requires: [L17, L26] }
- { id: L36, name: { ru: "fork, exec, wait; поиск программы по PATH", en: "fork, exec, wait; PATH lookup" }, requires: [L16, L17, L27] }
- { id: L37, name: { ru: "PID 1: сироты, зомби, особые сигналы", en: "PID 1: orphans, zombies, signal rules" }, requires: [L18, L36] }
- { id: L38, name: { ru: "Пространство имён (namespace): виды, /proc/<pid>/ns, lsns", en: "Namespace" }, requires: [L26, L27] }
- { id: L39, name: { ru: "user namespace и отображение UID", en: "User namespace, uid_map" }, requires: [L38, L10] }
- { id: L40, name: { ru: "Корень процесса: chroot, pivot_root", en: "Process root: chroot, pivot_root" }, requires: [L03, L12, L25] }
- { id: L41, name: { ru: "tmpfs и bind mount", en: "tmpfs and bind mount" }, requires: [L25] }
- { id: L42, name: { ru: "overlayfs: lower, upper, work, merged; copy-up, whiteout", en: "overlayfs" }, requires: [L41, L40] }
- { id: L43, name: { ru: "cgroup v2: дерево, контроллеры, memory.max, cpu.max, pids.max", en: "cgroup v2" }, requires: [L26, L23] }
- { id: L44, name: { ru: "OOM killer", en: "OOM killer" }, requires: [L43] }
- { id: L45, name: { ru: "Capabilities: root как набор привилегий", en: "Capabilities" }, requires: [L12, L27] }
- { id: L46, name: { ru: "seccomp: фильтр системных вызовов (идея)", en: "seccomp (idea)" }, requires: [L27, L45] }
```

The network namespace `N21` stays in networks but requires `L38`. In L17 the net namespace is shown only as "its own `lo` and an empty `ip a`", without veth (that is `N20`).

**A row for the §5.1 table:**

| Module | Tier | New concepts | Commands | Levels |
|---|---|---|---|---|
| **L17. How the kernel isolates and limits** | B (`lab-debian`; exercises with xattr and overlay on ext4/tmpfs, see finding 1) | L35–L46 | `ps -eLf`, `ls /proc/<pid>/task`, `strace -f -e trace=clone,execve,wait4`, `env`, `exec`, `unshare`, `nsenter`, `lsns`, `readlink /proc/<pid>/ns/*`, `chroot`, `mount -t tmpfs`, `mount --bind`, `mount -t overlay`, `systemd-cgls`, `systemd-run -p MemoryMax=`, `cat /sys/fs/cgroup/...`, `capsh --print`, `getcap`, `setcap`, `grep -E 'Cap|Seccomp|NoNewPrivs|NSpid|Threads' /proc/<pid>/status` | B (core), I, E |

**Route by level:**
- B: L35, L36, L37 (without the subreaper), L38 (pid, mnt, uts, net), L40 (chroot), L41, L42 (only the picture and `ls` by layer), L43 (memory, pids), L44, L45 (one scene: "root = a set of separate rights; `ping`/port 80"), L46 (one screen). About 4–5 hours.
- I: everything, plus `cpu.max`, `nsenter`, `pivot_root`, propagation in `unshare -m`, `systemd-run`. About 5–6 hours.
- E: everything, plus `unshare -Ur` and `uid_map`, bind mount in a user namespace, `SystemCallFilter=`, a comparison with crun's `config.json` as a forward to 04/D10. 3–4 hours (the theory is condensed to "what is new").

**Textbook chapter outline** (one chapter, eight sections; each with an explainer X5–X9 from finding 23):
1. "A process is not a program and not a thread". What the kernel stores about a process (`/proc/<pid>/status` as a passport: `Pid`, `PPid`, `Threads`, `Uid`, `NSpid`, `CapEff`, `Seccomp`). Threads share memory and files, processes do not; in `ps -eLf` the `LWP` column; in `/proc/<pid>/task/` one directory per thread.
2. "How a process is born": `fork` copies, `exec` replaces, `wait` collects the exit code. Lookup via `PATH`. `exec` in the shell and why there is no shell after it. This is the foundation for the shell and exec forms of `ENTRYPOINT` in 04.
3. "The special process number 1": orphans go to init (or to a subreaper: `prctl(PR_SET_CHILD_SUBREAPER)`, which is what `systemd --user` does), init must reap zombies, init does not receive signals without a handler. Hence `tini` and `--init` in 04 and the 10 seconds before SIGKILL in `docker stop`.
4. "What a process sees": seven, and with `time` eight, kinds of namespaces (`namespaces(7)`). The number in `/proc/<pid>/ns/*` is the number of a "room": processes in the same room have the same one. `unshare` creates a room, `nsenter` enters someone else's, `lsns` shows them all.
5. "What a process's root is": `chroot` changes only the root. Why this is not isolation (processes, network and name are shared). `pivot_root` is an idea for I/E.
6. "A file system made of layers": tmpfs, bind mount, overlay. Lower layers are read-only, the upper one takes changes, on the first write a file is copied up (copy-up), deletion leaves a "marker" (whiteout: a 0:0 character device).
7. "How much a process consumes": cgroup v2 is one tree in `/sys/fs/cgroup`. systemd already arranges everything into slices/services (`systemd-cgls`). The files `memory.max`, `memory.current`, `memory.events`, `cpu.max`, `cpu.stat`, `pids.max`. The OOM killer inside a group. `MemoryMax=` in a unit file is the same file written by systemd; `docker run --memory` and `resources.limits` in Kubernetes later write to the same place.
8. "What a process is allowed to do": root is about 40 separate capabilities (`capabilities(7)`), and `CAP_DAC_OVERRIDE` explains why root bypasses the `rwx` from L5. File capabilities (`setcap`) instead of setuid. seccomp is a system call filter: `Seccomp: 2` in `/proc/self/status` means the filter is on.

**Trainers** (the 09 §2.4 format; `@pid(...)` is a 09 macro):

| ID | Level | Task (RU) | Setup | Check |
|---|---|---|---|---|
| `linux.m17.drill.1` | B I E | "`threads-demo` is running on the system. How many threads does it have and what are they called? Answer in `~/threads.txt`: the number, then the names one per line." | `threads-demo` as a service | `files['~/threads.txt'].text` matches the agent's reference (`ls /proc/@pid(threads-demo)/task \| wc -l`, `cat /proc/*/task/*/comm`), the order of names does not matter |
| `linux.m17.drill.2` | B I E | "Find out in which directories `env` tried to find the program `hello` if `PATH=/opt/a:/opt/b:/usr/local/bin`. Save the attempted paths in order to `~/tries.txt`." Ladder step 2: the hint is a fragment of `man strace` with the line `-e trace=` highlighted. | `/usr/local/bin/hello` | The file matches `/opt/a/hello`, `/opt/b/hello`, `/usr/local/bin/hello` (the reference from `strace -f -e trace=execve env PATH=... hello`, where the first two are `ENOENT`) |
| `linux.m17.drill.3` | B I E | "Run `sleep 1000` as PID 1 in a new PID namespace so that `ps` inside shows only it. Then from the host try to stop it with `kill -TERM`, then `kill -KILL`. Write to `~/pid1.txt` which signal worked and why (in one sentence)." | — | Observation: the agent's event log had a process with `nspid=[N,1]` and `cmd=sleep 1000`; `procs[cmd='sleep 1000']` is absent; the first line of `~/pid1.txt` `=~ KILL`; the explanation is graded by a rubric (`explain`): "init has no TERM handler" |
| `linux.m17.drill.4` | B I E | "Without `--fork`, `unshare --pid bash` behaves strangely. Run it, execute `ls` twice, explain the error." | — | `explain` by rubric: the first child becomes PID 1 and exits, after which `fork: Cannot allocate memory` (`pid_namespaces(7)`); `soft`: the history contained `unshare --pid --fork --mount-proc` |
| `linux.m17.drill.5` | I E | "Open a second terminal. In the first, run `sudo unshare --uts --net bash`, and there `hostname lab-box`. In the second, enter the same namespaces of that process and show that the name is `lab-box` and `ip a` contains only `lo`." | — | Observation: an `nsenter` process with `ns.uts` and `ns.net` equal to the `ns` of the process from the first terminal; the host's `hostname` has not changed (`facts.env.hostname`) |
| `linux.m17.drill.6` | B I E | "Build a minimal root from `busybox` in `/lab/root` and start a shell in it via `chroot`. Make sure: `ls /` shows your root, while `ps` after `mount -t proc proc /proc` shows all of the host's processes. Write to `~/chroot.txt` what chroot isolated and what it did not." | `/lab` is tmpfs | `files['/lab/root/bin/busybox'].exists`; a process with `root=/lab/root` was observed (the agent reads `readlink /proc/<pid>/root`); `explain`: "files are isolated; processes, network, name are shared" |
| `linux.m17.drill.7` | B I E | "Build an overlay: the lower layer `/lab/lower` (ready), the upper `/lab/upper`, the result in `/lab/merged`. Change `/lab/merged/etc/motd` and delete `/lab/merged/etc/issue`. Show that both files are unchanged in the lower layer." | `/lab/lower` with files | `mounts[target='/lab/merged'].type=overlay`; `files['/lab/lower/etc/motd'].sha256=@start`; `files['/lab/upper/etc/motd'].exists`; `files['/lab/upper/etc/issue'].type=c` (whiteout); `fail`: upperdir on 9p — "overlay does not accept 9p as the upper layer: use /lab (tmpfs)" |
| `linux.m17.drill.8` | B I E | "Limit `memhog` to 32 MB of memory so that the kernel stops it, and find the evidence in the cgroup files and in the kernel log." | `memhog 64` ready to run | `cgroups[path~'/lab'].memory.max<=32M`; `cgroups[path~'/lab'].memory.events.oom_kill>=1`; `procs[cmd~memhog]` is absent; both methods are accepted: `mkdir /sys/fs/cgroup/lab` + `echo $$ > cgroup.procs` and `systemd-run --scope -p MemoryMax=32M memhog 64` |
| `linux.m17.drill.9` | B I E | "Protect the machine from the fork bomb of the teaching script `spawner` (spawns 200 `sleep`s): no more than 20 processes in its group. The script must get an error rather than hang the machine." | `spawner` | `cgroups[procs~@pid(spawner)].pids.max<=20`; the `journal`/output contains `Resource temporarily unavailable`; `#procs[cmd=sleep] <= 20` |
| `linux.m17.drill.10` | I E | "`yes` occupies a whole core. Give it no more than 25% of one core without killing the process. Confirm with a number from `cpu.stat`." | `yes > /dev/null` in its own group | `cgroups[procs~@pid(yes)].cpu.max='25000 100000'`; `keep: procs[cmd=yes].pid=@start.pid(yes)`; `cpu.stat.nr_throttled` grows between two snapshots |
| `linux.m17.drill.11` | B I E | "The program `~/web80` (a copy of `nc`) must listen on port 80 as the user `student` — without sudo at launch and without setuid." | `/lab/web80` on tmpfs or ext4 (xattr, see finding 1) | `net.listen[port=80].pid` belongs to the user `student`; `files['/lab/web80'].mode !~ '^[2-7]...'` (no setuid/setgid); `stdout_of: getcap /lab/web80 =~ cap_net_bind_service=ep`; `fail`: the file is on 9p — "this FS does not store capabilities" |
| `linux.m17.drill.12` | I E | "Compare the privileges of your shell and of root's shell: `capsh --print`, `grep Cap /proc/self/status`. Decode root's `CapEff` with `capsh --decode` and find in the list the right that lets root read someone else's file with mode `0600`." | — | the answer in the file `=~ CAP_DAC_(OVERRIDE|READ_SEARCH)` |
| `linux.m17.drill.13` | E | "Become root inside a user namespace without sudo (`unshare -Ur`). Create a file in your home directory and show who owns it outside. Try to change `/etc/hostname` and explain the refusal." | — | Observation: a process with `uid_map` `0 1000 1`; `files['~/ns-file'].owner=student`; `explain`: "root only in its own room; the host's files are governed by the permissions of the real UID" |
| `linux.m17.drill.14` | E | "Run `date -s 12:00` under systemd so that the kernel forbids the system calls that change the time. What exit code and what signal?" | — | `units['run-*.service'].result=signal`; the answer `=~ SIGSYS` (`systemd-run --wait -p SystemCallFilter=~@clock date -s 12:00`); ladder step 4: `SystemCallFilter=` is not shown in the theory, look it up in `man 5 systemd.exec` |

**The module's final task** (without hints): "The `report-builder` service sometimes eats all the machine's memory and brings down its neighbors. Make it live within 48 MB, unable to spawn more than 30 processes, unable to see `/home`, and running without any capabilities — using the unit file, not by changing the program." Check: `units[report-builder.service].active=active`; `cgroups[path~'report-builder'].memory.max<=48M && pids.max<=30`; a probe `as unit: ls /home → exit_not 0` (`ProtectHome=yes` or `TemporaryFileSystem=/home`); `procs[cmd~report-builder].capEff=0` (a new fact `capEff` in `procs` is needed — a request to 09). None of the four directives is shown in the theory: this is the first ladder step 4 task, the documentation is `man 5 systemd.resource-control`, `man 5 systemd.exec`.

**L17 quiz** (bank; examples):

| Question | Answer |
|---|---|
| `ls -l /proc/412/ns/pid` and `/proc/1/ns/pid` show `pid:[4026532201]` and `pid:[4026531836]`. What does this tell you? | Process 412 is in a different PID namespace |
| Why does `ps` after `unshare --pid --fork bash` without `--mount-proc` still show all processes? | `ps` reads `/proc`, and the host's old `/proc` is mounted |
| `memory.events` shows `oom_kill 3`. What happened? | The kernel killed a process of this group three times on reaching `memory.max` |
| A file was deleted in the upper layer of an overlay. What is in upperdir? | A 0:0 character device with the same name (whiteout); the file in the lower layer remains |
| Why can root read a file with mode `0000`? | It has `CAP_DAC_OVERRIDE`: the kernel skips the permission check |
| `Seccomp: 2` in `/proc/<pid>/status` | The process runs with a system call filter (filter mode) |
| Which of these does `chroot` isolate: files, processes, network, hostname? | Only files (the visible root) |

**Block exam E5 "Isolation"** (after L17, 35 minutes, I and E; for the beginner a lighter version without items 4–5). Story: "Two services on a server interfere with each other: `batch` eats memory and CPU, and because of it `api` responds slowly and crashes. Limit `batch` without touching its code, and prove that the limit works". Breakages: `batch` has no limits; `api` was killed by the machine's OOM killer (not the group's; `dmesg` shows `Out of memory: Killed process`); `batch` spawns up to 300 children; `batch.service` has `User=root`, although it does not need to run as root; `MemoryMax=` is written in the `[Unit]` section rather than `[Service]`, and systemd silently ignores it with a warning in the journal. Checks: `cgroups[path~batch].memory.max<=64M`, `pids.max<=50`, `cpu.max` is set; `units[api.service].active=active` and `restarts` does not grow during `after_wait 180s` while `batch` runs; `units[batch.service]` with `User!=root`; `history` with `systemd-analyze verify` or `journalctl -u batch` — `soft`. Tasks on material not covered (step 5): `CPUWeight=` (the course shows only `cpu.max`) and `OOMScoreAdjust=` for `api`.

---

## Part 4. Ready text for R2, R3, R4

### 22. MAJOR — the documentation ladder for the Linux block (insert as a new section 7.4)

**How to tie it to modules.** The ladder step is a property of the task (`ladder: 1..5`) and of the AI mode (finding 15). The beginner starts at step 1, the intermediate at step 2 starting from L4, the experienced at step 3 from the first module (requirement R2).

| Step | Modules (B) | How it looks in the interface | Task examples |
|---|---|---|---|
| 1. Flicker | L0–L2 | Under every command in the theory, a quiet line "Where this comes from: `man ls`, section OPTIONS, `-l`" with a link to the exact place (`man7.org/linux/man-pages/man1/ls.1.html#OPTIONS` and the option anchor); opening it is optional | Ordinary L0–L2 trainers |
| 2. Page fragment | L3–L7 | The hint is a real fragment of a man page (Debian `manpages` text, with translated captions on top of it, not instead of it), the relevant line highlighted; on the side, a diagram of the page anatomy: NAME → SYNOPSIS → DESCRIPTION → OPTIONS → EXIT STATUS → EXAMPLES → SEE ALSO, and the manual sections 1/5/7/8 | L3 "Reading SYNOPSIS": "what do `[ ]` and `...` mean in `cp [OPTION]... SOURCE... DIRECTORY`"; D5 (ls by size) — the hint = an OPTIONS fragment with `-S` highlighted; L6: a fragment of `man grep` with `-w` highlighted |
| 3. Find the flag | L8–L12 | The task has only a link to the page ("`man ps`"), without a fragment; the result is checked | "List processes sorted by memory, with the columns pid, rss, comm" (`ps -eo pid,rss,comm --sort=-rss`); "Show the service's log from the start of the current boot in reverse order" (`journalctl -u x -b -r`); "Find files newer than `/etc/passwd`" (`find -newer`); "How many times has systemd restarted the service" (`systemctl show -p NRestarts`) |
| 4. Enforcement | L13–L17 and exams E1–E3 | The task needs commands and flags that were not in the theory; no hints; the AI asks "where did you look?" and sends the learner to `man`, `--help`, `apropos`, `/usr/share/doc`, freedesktop.org/software/systemd/man | "How much space does the journal take, and how to reduce it to 50 MB" (`journalctl --disk-usage`, `--vacuum-size=50M`); "Which services depend on `network-online.target`" (`systemctl list-dependencies --reverse`); "What slows down boot" (`systemd-analyze blame`); "Check fstab for errors without rebooting" (`findmnt --verify`); "Change a service parameter without touching the package's file" (`systemctl edit` — a drop-in); the L17 final task (`ProtectHome=`, `CapabilityBoundingSet=`) |
| 5. Exam | E1–E5 | Only `man`, `--help`, `apropos` inside the machine and an allowlist in the built-in documentation window are open (man7.org, freedesktop.org/software/systemd/man, debian.org/doc, kernel.org/doc); the AI is off; 1–2 items of each exam are built on what was not in the course | E1: "limit the service to 128 MB of memory" (`MemoryMax=`); E2: "forbid journald from taking more than 100 MB" (`SystemMaxUse=` in `journald.conf`); E3: "allow `maria` to log in only with a key and only from `10.0.0.0/24`" (`Match Address` in `sshd_config` or `from=` in `authorized_keys`) |

**Checking steps 3–4 "by the result".** The flag is not checked via the history. The result is checked (a file, a state), and `soft` records whether `man`/`--help` was opened: a `cmd.done` event with `man|--help|apropos` in the last 20 commands. This shows up in the report as "found it in the documentation" or "found it another way" and does not affect the pass.

**The documentation window.** A built-in sheet (`mechanics/sheet.ts` from §9) with search within the page and section anchors. External links open in it via an iframe only for allowlisted domains (man7.org does not send `X-Frame-Options: DENY`; check this; if framing is forbidden, use a local copy of the `manpages` pages from the image, rendered with `man -Thtml`).

### 23. MAJOR — process explainers for the Linux block (R3, R4): storyboards

Common rules for all (they extend 08 §3.1–3.5): a blueprint, not ink; the kernel is a `--c-kernel` strip at the bottom; one idea per screen; every arrow has a caption on the line; every element is clickable (a card "what it is, who creates it, how to look at it"); a stepper with forward and backward scrolling, pause, 0.25×/1×/4×; changing a parameter immediately recalculates the process, and a line "what changed and why" appears next to it; "break it" is the toggles from 08 §3.5 with a prediction question. If the diagram is live, the state comes from the machine via `events()` (09 §1.5), otherwise from a recorded scenario.

**X1. Boot: from power to the prompt** (L11; replaces the first part of §6.7)
- Screen 1. A chain of blocks from left to right: firmware → bootloader → kernel → `systemd` (PID 1) → `multi-user.target` → services → `getty` → `login` → `bash`. Under each block, the time from the current machine's `systemd-analyze`; on the arrows, the captions "loads", "passes cmdline", "starts as PID 1", "pulls in dependencies".
- Screen 2. Inside systemd, the target graph: `sysinit.target` → `basic.target` → `multi-user.target`, with `After=`/`Wants=` arrows on the services. Services start in parallel, each with a time bar.
- Parameters: choice of target (`multi-user` / `rescue` / `emergency`) — the graph is recalculated, "rescue has no network and no sshd"; a slider "start time of `slow.service`" (0–30 s) — you can see whom it delays (only those with `After=slow`).
- Break it: "an error in `/etc/fstab`" → boot stops at `local-fs.target`, emergency shell, the journal line `Dependency failed for Local File Systems`; "`init=` points to a non-existent file" → `Kernel panic - not syncing: No working init found`; "remove `WantedBy=` from a service" → the service does not start at boot, although it "worked before the reboot".
- Live: lines of `journalctl -b -o short-monotonic` are highlighted on their blocks.

**X2. Enter after `ls`: parsing, PATH, fork, exec, wait** (L8; the "kernel" lens from §6.10 becomes this explainer)
- Screen 1. Blocks: "terminal" → "bash" (`--c-user`) → "kernel" (the strip). The line `ls -l /etc` is split into tokens (we reuse §6.1).
- Screen 2. PATH: bash goes through the `PATH` directories one by one, each is a cell with the status "no" / "found". The parameter is an editable `PATH` (drag directories, delete them): with `PATH=/opt/bin` the command is not found, `command not found`, linked to question 8 of the placement check. A "bash hash" toggle (`hash -r`) shows the cache of found paths.
- Screen 3. `clone` (an arrow down to the kernel, captioned "a copy of the bash process, PID 4127"), in the child `execve("/usr/bin/ls")` (an arrow captioned "replace the program; the PID stays the same"), the parent in `wait4` (a grey frame "waiting"), the child `write(1, ...)` → terminal, `exit_group(0)` → `$?=0`.
- Parameters: "background run `&`" — the parent does not wait and prints the prompt immediately; "builtin command (`cd`)" — no `clone`, no `execve`; "`exec ls`" — no `clone`, bash is replaced and after `ls` the terminal closes.
- Break it: "the file has no `x` bit" → `execve` returns `EACCES`, `Permission denied`, code 126; "the parent does not call `wait`" → the child stays `Z` (a bridge to X5).
- Live: on tier B, a real `strace -f -e trace=clone,execve,wait4,write` in the agent's hidden channel, 5–8 lines.

**X3. The pipeline: two processes and a kernel buffer** (L6, a second layer in L8; replaces the "plumbing" of §6.5)
- Screen 1. Two process blocks `producer` and `consumer` above the kernel strip, between them a rectangle "pipe buffer, 64 KB" with a fill scale. The arrows "write(1)" and "read(0)".
- Parameters: producer and consumer speed (lines/s); buffer size (4 KB…1 MB, `fcntl F_SETPIPE_SZ` for E). If the consumer is slower, the scale reaches 100%, and the producer goes into the `S` state with the caption "waiting for space in the buffer".
- Screen 2. A long pipeline `grep | sort | head`: `sort` is captioned "accumulates the whole input" — its output is empty until EOF.
- Break it: "the consumer exited" (`head -3`) → the producer gets `SIGPIPE` on the next write, code 141 (`yes | head -3`); "`2>&1` off" → the red stderr arrow goes to the screen bypassing the pipeline.
- Live: in the Stand, `pipe.write/read` events from the model; on tier B, `/proc/<pid>/fdinfo` and the process states every 200 ms.

**X4. systemd restarts a crashed service** (L11; the second part of §6.7)
- Screen 1. The unit state machine: `inactive → activating → active → deactivating → inactive`, a `failed` branch with the reasons `exit-code`, `signal`, `timeout`, `start-limit-hit`. A timeline above it.
- Parameters: `Restart=` (`no`/`on-failure`/`always`), `RestartSec=` (0.1–10 s), `StartLimitBurst=` (1–10) and `StartLimitIntervalSec=` (5–60 s), "the service crashes N s after start" (0–30 s). Changing a parameter recalculates the timeline: the points of crashes, restarts and the final `start-limit-hit`, with a line next to it: "with `RestartSec=100ms` and a crash right after start, 5 restarts fit within 10 s — systemd gives up".
- Break it: "`ExecStart` points to a non-existent file" → `203/EXEC`, restarts also up to the limit; "`kill -9` of the main process" → with `on-failure` a restart (a signal counts as a failure), with `no` — `failed`; "`systemctl stop`" → no restart with any `Restart=`.
- Live: trainer D20 (`kill -9` by the agent) is drawn on this same diagram from `systemctl show -p ActiveState,SubState,NRestarts`.
- Bridge: one line "`restart: on-failure` in Docker and `restartPolicy` in Kubernetes work the same way" (a forward to 04/D23 and 05).

**X5. A signal to a process and the special PID 1** (L8 — the first two screens, L17 — the third)
- Screen 1. Sender → kernel → receiver. The receiver has a table of handlers (`default` / `ignore` / `handler`). A palette of signals TERM, INT, HUP, KILL, STOP, CONT (we reuse the drag-and-drop of §6.4).
- Parameter: handler toggles on `sigdemo` for each signal; for KILL and STOP the toggle is locked with the caption "cannot be caught: the kernel decides".
- Screen 2. Stopping "politely, then by force": TERM → waiting for `TimeoutStopSec=` (slider 1–90 s, 90 s by default in systemd) → KILL. Next to it, the line "`docker stop` does the same with 10 s" (a forward to 04/D4).
- Screen 3 (L17). The same process as PID 1 in a new PID namespace. A toggle "TERM handler present/absent": without a handler, TERM from the host is dropped in the kernel (the arrow breaks off with the caption "a namespace's init does not receive signals without a handler", `pid_namespaces(7)`), KILL gets through. Break it: "PID 1 does not reap zombies" → the `Z` counter grows with each finished child; a toggle "`tini` as PID 1" → zombies are reaped, TERM is forwarded to the application.

**X6. Rooms: namespaces** (L17)
- Screen 1. The kernel strip at the bottom, process rectangles above it. Around each group of processes, `--c-ns-*` frames of its kind (pid, mnt, uts, net, ipc, user, cgroup, time), each with a label giving the inode number from `/proc/<pid>/ns/*`. The host's frames match `/proc/1/ns/*`.
- Parameters: the set of `unshare` flags (checkboxes `--pid --fork --mount-proc --uts --net --mount --user`). Pressing "run" creates a process, frames are drawn only for the checked kinds, and the real command appears in the terminal. A switch "from inside / from the host" changes the PID numbers (`NSpid`), the hostname and the `ip a` list.
- Break it: "without `--fork`" → `fork: Cannot allocate memory` (drill.4); "without `--mount-proc`" → `ps` inside shows the host's processes; "`nsenter` into net but not uts" → the hostname is the outer one, the network the inner one.
- Live: the agent's `watch` mode from 09 §1.4 (`ns.create`, `proc.spawn`).

**X7. Counters: cgroup v2** (L17)
- Screen 1. The `/sys/fs/cgroup` tree: `system.slice` → `nginx.service` and so on (from `systemd-cgls`); on the right, three scales for the selected group: memory (`memory.current` against `memory.max`), cpu (the share per second against `cpu.max`), pids (`pids.current` against `pids.max`).
- Parameters: sliders `memory.max` (8–256 MB), `cpu.max` (5–100% of a core), `pids.max` (5–500); "load" — `memhog` at N MB/s, `yes` on/off, `spawner` with N children. Changing a limit is written to the file immediately (on tier B, an `echo` into the real file, visible in the terminal). A "why" line under the scale: "the limit is below the current consumption — the kernel first evicts the cache, then starts the OOM killer inside the group".
- Break it: "no memory limit" → `memhog` runs into the machine's memory, the machine's OOM killer kills a random neighbor (`api` from E5), a `dmesg` line; "OOM in the group" → only the group's process is killed, `memory.events oom_kill +1`.
- Bridge: "`MemoryMax=` in a unit, `--memory` in Docker, `resources.limits.memory` in Kubernetes write to this same file" — forward cards to 04/D9 and 05/K22.

**X8. Layers: overlayfs** (L17; the basis for 04/D5, where the image and digest are added)
- Screen 1. Three horizontal layers: `lower` (read-only, grey), `upper` (writable), `merged` (what the process sees). For each file you can see which layer it came from.
- Parameters: the number of lower layers (1–3); operations on a file in merged — "read", "modify", "delete", "create".
- Steps: modification → the file is copied into upper in full (copy-up, with a size caption "1.2 MB copied for the sake of one line"), then changed; deletion → `c 0,0` appears in upper (whiteout), the file stays in lower; deleting a directory → opaque (`trusted.overlay.opaque=y`).
- Break it: "upper on 9p" → `mount: wrong fs type` (the real error, a bridge to finding 1); "no `workdir`" → a mount error.
- Live: drill.7.

**X9. Permissions and privileges: the kernel's check path** (L5, a second layer in L17; extends §6.2)
- Screen 1 (L5) — as in §6.2: the check path "owner? → group? → others → bit".
- Screen 2 (L17): before this chain, a block appears: "does the process have `CAP_DAC_OVERRIDE`?". For root the answer is "yes" — the arrow bypasses the `rwx` check. Toggles for the process's capabilities (DAC_OVERRIDE, NET_BIND_SERVICE, CHOWN, KILL, SYS_ADMIN) and the actions "read someone else's 0600", "listen on port 80", "change the owner", "send a signal to someone else's process", "mount".
- Break it: "root without capabilities" (`capsh --drop=all`) → root gets `Permission denied` on someone else's 0600 file. A bridge to `--cap-drop ALL` in 04/D9.

**X10. A file on disk: disk → partition → FS → mount point** (L13; keep §6.8, but in blueprint style) — without the "tears off" metaphor; when mounting over a non-empty directory, the old contents are shown shaded under the new FS, captioned "hidden, not deleted". The parameter is a "mounted/not" switch; break it — "the UUID in fstab does not match" → `emergency.target` at boot (a link to X1).

Each explainer is a separate `diagram` + `stepper` entry from 08 §3.1–3.2 with `introduces`/`uses` and the module stated. The number per block: 10 (R3 says "in every block", not only the flagship ones).

### 24. MAJOR — §7.3: exams without ladder step 5

**How to fix.** Insert at the start of §7.3: "Exams run at ladder step 5: `man`, `--help`, `apropos` in the machine and the documentation window with an allowlist are open (finding 22); the AI is off; in every exam, 1–2 mandatory checks rely on what was not in the course". Specific additions:
- E1: a check `units[orders.service]` with `MemoryMax` ≤ 128M (in the story: "the operations team requires limiting the service to 128 MB");
- E2: `files['/etc/systemd/journald.conf.d/*.conf'].text =~ SystemMaxUse=` (or the main file); `journalctl --disk-usage` ≤ the limit;
- E3: `sshd -T -C user=maria,addr=192.0.2.10,host=x` → `authenticationmethods`/`denyusers` depending on the chosen method, or `from="10.0.0.0/24"` in `authorized_keys`; a probe from an address outside the network (a second node interface on the switch from finding 16) → refusal.

---

## Part 5. Minor

### 25. MINOR — §2.2, question 3: the `rm -rf / tmp/x` example is not dangerous in GNU coreutils
Since version 6.4, `rm` works with `--preserve-root` by default and answers `/` with `it is dangerous to operate recursively on '/'`. The same holds in coreutils 9.1 from bookworm, so the example teaches a myth. Replace it with `rm -rf ~ /old-project` (with the space, the home directory is deleted) and add an item about `--preserve-root`.

### 26. MINOR — §7.1, L5: the answer about `drwxr-xr--` is inaccurate
`ls dir` (without `-l`) shows the names without errors; attribute errors appear with `ls -l` (the `?????????` lines) or with colored output if an alias does a `stat`. Phrase it as: "`ls` shows the names; `ls -l` shows the names with `?` instead of attributes and `Permission denied` errors; `cd` fails".

### 27. MINOR — L16/L17: `dmesg` for `student` and the claim "this machine is a VM" (R7c)
In Debian kernels `dmesg_restrict=1`, so `student` without sudo gets `Operation not permitted`. In `dt-kernel` (09) the value depends on the configuration. It must be fixed and stated in L16 (which is also a good example of capabilities: `CAP_SYSLOG`). Add a minute "you are inside a virtual machine" to L16: `sudo dmesg | head` (SeaBIOS, emulated devices), `lscpu`, `systemd-detect-virt` (check in the spike what v86 returns: if `none`, that is also a lesson — "the emulator does not announce itself"). The term "virtual machine" is introduced by 04/D1 (`D02`); here only `forward:`. This is the support for the R7c practice in 04: comparing `uname -r`, `ps` inside a container and outside, a container start against booting a second v86.

### 28. MINOR — §6.4: the orphan "goes to PID 1"
True for terminal processes on `ttyS0`. But if the learner runs `zombie-demo` from `systemd-run --user` or from a process under `systemd --user`, the adoptive parent will be the subreaper (`systemd --user`), and the picture will diverge from reality. In the diagram, take the real new parent from `/proc/<pid>/status` (`PPid`), and introduce the subreaper concept in L17 (`L37`).

### 29. MINOR — §7.2: counting and small inconsistencies
- "Below are 24 trainers", while the table has 26 (D1–D26).
- D8: setup creates `alice` and `bob`, but the check refers to `eve` — add `useradd -m eve`.
- D9: "D8 is solved, mode `2770` is not set" is unclear; write "the directory is in the state after D8 (mode `0770`, group `dev`), setgid and sticky are not set".
- D15: `Ctrl+Z` sends `SIGTSTP` (20), not `SIGSTOP` (19). Both give state `T`, but the debrief must say that these are different signals and TSTP can be caught.
- D25: in the check `ssh -o PubkeyAuthentication=no server`, add `-o BatchMode=yes`, as in E3; without it, if a password was accidentally left enabled, the check will hang on the prompt.

### 30. MINOR — §1.2, §10: versions and links
- "npm package `v86` 0.5.473 as of 30.10.2026" — 09 took the engine sizes with `npm view` on 18.11.2026; take the version number from the same place and record it in one place (09 §1.4), do not duplicate it in 02.
- In §10, the link to ArchWiki "Systemd/Journal (Russian)" is in the section "L8 processes and signals" — it is off topic. Replace it with `signal(7)` from OpenNet or with the translation of "The Linux Command Line", ch. 10.
- Add sources for L17: EN — `namespaces(7)`, `pid_namespaces(7)`, `user_namespaces(7)`, `cgroups(7)`, `capabilities(7)`, `seccomp(2)`, kernel.org "Control Group v2" (`admin-guide/cgroup-v2`), kernel.org "Overlay Filesystem" (`filesystems/overlayfs`), `systemd.resource-control(5)`; RU — translations of the man pages on OpenNet (`namespaces`, `capabilities`), the article "Containers in Linux: namespaces and cgroups" from a blog translated on Habr (choose under the two-source rule from §9).

### 31. MINOR — §3.3: "abridged man pages with translation" on tier A
For the sake of ladder step 2, show the real text of the Debian page in the sandbox (abridging is allowed only by removing whole sections, marked "section omitted in the sandbox") and translate the captions on top of it. Abridging within sections breaks the page anatomy that R2 teaches.

---

## Summary for the orchestrator

| Must be decided outside 02 | Who | Proposal |
|---|---|---|
| Owner of the namespaces/cgroups/chroot/overlay/capabilities concepts | 01, 02, 04 | Linux (`L35–L46`); `D03/D04/D05/D09` in 01 become "the same in Docker", and I restructure 04 for this myself |
| Owner of SSH and the "key pair" | 01, 02, 03 | Linux (`L33`, `L34`); the SSH card in the 03 protocol catalog references L15 |
| The `lab-debian` root: 9p or ext4 | 02, 09 | ext4 on an asynchronous `hda` (finding 1), decided by the spike |
| `as_user` as an `access[...]` fact or a probe on tier A | 09 | A fact (one `access()` function for the diagram and the check) |
| New facts: `procs.capEff`, `procs.seccomp`, `procs.root`, `cgroups.cpu.stat` | 09 | Add to `dt.facts/v1` |
| `vswitch` for several v86 instances | 09, 03, 05, 06 | One mechanism in 09, referenced from 02 §1.5 |
