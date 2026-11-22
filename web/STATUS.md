# MVP status — what is done, what is partial, what is missing

English · [Русский](STATUS.ru.md)

State as of 19 November 2026, after the fourth wave: the "before Docker" lab on real Linux in the tab (v86), a cloud with a REST API, git.lab with CI and an OpenTofu provider. Before it came the third wave (Kubernetes exams, exams on real machines, a light manifest for the home page). The numbers are taken from the build registry, not from the writers' reports. Every block passes the concept-order linter with no errors; the only warning is that the final block has no placement check, which is by design.

Checks on this date:
- `npx tsc --noEmit` — no errors.
- `npm run build` — green; one size warning: the Linux block chunk is 703 KB against a 700 KB limit.
- `npx vitest run` — 71 files (64 run, 7 skipped), 899 tests: 877 pass, 22 skipped. The skipped ones are runs on real v86, switched on by variables (`V86_LAB=1`, `V86_TF=1`, `V86_CLOUDLAB=1` and others).
- `npm run test:e2e` — 35 Playwright scenarios, all pass, plus a 36th tagged `@v86` that is skipped without `E2E_V86=1`.
- `npm run test:e2e:v86` — boots a real machine in headless Chromium and passes a checked goal of the `linux.install` lesson (GPT partitioning): green, 36 s.

The registry holds 15 route blocks and a hidden demo block, 147 lessons, 387 concepts, 498 items in the quiz bank, 76 process explainers, 24 exams, 33 widgets and 952 pages of offline documentation.

Legend: ✅ done · 🟡 partial · ❌ missing · — not needed by design.

## Summary by block

| Block | Lessons | Process explainers | Sandbox (terminal tasks) | Quizzes (in lessons / bank) | Placement check | Exam | Documentation ladder (docs sections; DL3 / DL4 / DL5 tasks) |
|---|---|---|---|---|---|---|---|
| F Orientation | ✅ 10 | ✅ 7 | ✅ 25 | ✅ 47 / 40 | ✅ 6 | — (intermediate and experienced close the block with three questions) | ✅ 2; 0 / 0 / 0 (the beginner block lives on DL1–DL2) |
| 1 Methodology | ✅ 15 | ✅ 5 + the flowlab board in 3 scenarios | — 3 flow tasks, no labs of its own by design | ✅ 55 / 49 | ✅ 15 | ✅ methodology.exam, 10 tasks | ✅ 6; 2 / 1 / 2 |
| 2 Linux | ✅ 23 (4 on real machines) | ✅ 6 | ✅ 63 | ✅ 60 / 60 | ✅ 10 | ✅ 5: first-day (6 + 2 questions), service (4, graded), isolation on the simulator (6 + 2); disk on one own VM (6 + 2) and access on two (6 + 2), both now also have a variant on machines in the tab | ✅ 10; 2 / 4 / 6 |
| 2a Git and YAML | ✅ 4 | ✅ 1 | ✅ 14 | ✅ 15 / 15 | ✅ 5 | ✅ 2: cafe (4 + 2), config (4 + 2, graded) | ✅ 5; 2 / 2 / 2 |
| 3 Networks | ✅ 16 (`networks.linux-lab`: 6 labs on real machines) | ✅ 12 | ✅ 52 | ✅ 55 / 55 | ✅ 17 | ✅ 3: networks.exam.browser on machines in the tab; networks.exam.office — 13 tasks (11 per variant) + 3 questions; networks.exam.machines, part B on three own VMs, — 7 + 2 | ✅ 18; 7 / 5 / 4 |
| 4 Containers | ✅ 11 | ✅ 7 | ✅ 51 | ✅ 62 / 54 | ✅ 11 | ✅ exam-docker-duty, 4 tasks | ✅ 12; 3 / 6 / 1 |
| 5 CI/CD | ✅ 5 | ✅ 4 | ✅ 16 + the pipeline board | ✅ 12 / 12 | ✅ 5 | ✅ 2: cicd.exam.release (5 + 2); cicd.exam.tab — deploying on real machines through git.lab and CI | ✅ 3; 1 / 2 / 1 |
| 6 Kubernetes, stage 1 | ✅ 15 | ✅ 12 + the constructor + the controller lab | ✅ 53 | ✅ 49 / 53 | ✅ 17 | ✅ 2: k8s-1.exam (10 + 3, graded), k8s-1.exam.cka in the spirit of CKA (17, 16 per variant, + 2) | ✅ 6; 6 / 2 / 5 |
| 6a Deploying to Kubernetes from CI | ✅ 1 (lesson A7) | ✅ 1 | ✅ 4 | ✅ 5 / 7 | ✅ 4 | ✅ cicd-k8s.exam (6, 5 per variant, + 2) | ✅ 2; 1 / 1 / 1 |
| 7 Kubernetes, stage 2 | ✅ 7 | ✅ 6 | — real VMs: 14 self-check widgets based on command output | ✅ 23 / 22 | ✅ 8 | ✅ k8s-2.exam on the learner's own three-VM kubeadm cluster (12, 10 per variant, + 2) | 🟡 3; 0 / 0 / 2 |
| 8 IaC | ✅ 12 (5 on the cloud in the tab) | ✅ 4 | ✅ 23 | ✅ 23 / 24 | ✅ 7 | ✅ 2: iac.exam (5 + 2); iac.exam.cloud — a service from scratch in the cloud in the tab | ✅ 9; 1 / 5 / 1 |
| 9 A cluster from code (k8s-3) | ✅ 8 | ✅ 2 | ✅ 24 | ✅ 22 / 15 | ✅ 8 | ✅ k8s-3.exam.rebuild (7 + 2) | ✅ 4; 1 / 2 / 1 |
| 10 Monitoring | ✅ 8 | ✅ 4 | 🟡 10 + the PromQL and logs workbenches | ✅ 23 / 23 | ✅ 7 | ✅ monitoring.exam (6 + 2) | ✅ 6; 1 / 3 / 1 |
| 11 On-call shift and final exam | ✅ 2 | — | — tasks live inside the exams | 🟡 5 / 3 | — one exam for everyone | ✅ 2 on simulators: final.exam.oncall (5 + 1), final.exam.capstone (9 + 3) | 🟡 DL5 only in the final exam (1) |
| 12 Career | ✅ 9 | ✅ 3 + the review explainer from the "Review" page | — | ✅ 31 / 31 | ✅ 18 | ✅ mock interview rubrics | — |

"In lessons" quizzes are all items in the quiz sections of lessons, including references to the bank; "bank" is the items bound to the block's concepts. Exam in brackets: the number of cards and, after the plus, the number of oral questions at the end. This wave recounted only lessons and exams; the other columns are from the third wave, and for Linux, Networks and IaC they have grown.

## Engines and platform

| Part | Status | Comment |
|---|---|---|
| Shell, route, RU/EN, light and dark themes, reduced motion | ✅ | A scan of the second wave's 182 routes at 390 px in both languages and at 1440 px, and of the seven new exams at 390 and 1280 px: no sideways scroll, no page errors, no empty pages |
| Loading by block | 🟡 | Every block and every engine is its own chunk. The home page paints from a manifest built at build time: startup JS about 108 KB (38 KB gzipped), the whole first visit to the home page about 220 KB including fonts. The first entry into a lesson still loads all blocks; the largest chunk is the Kubernetes block, 690 KB |
| Concept-order linter | ✅ | |
| Stand (tier A): Linux, kernel, systemd | ✅ | Namespaces, cgroups v2 with OOM, capabilities, procfs |
| sim-net | ✅ | netfilter, NAT, ARP, TCP, DNS hierarchy, nginx, TLS |
| dsim (Docker) | ✅ | CLI, layers, registry, build, compose, crun |
| kube-lite | ✅ | API server, admission, controllers, scheduler, kubelet, kubectl, NetworkPolicy, a sandbox for your own controller in a Worker, checks based on command output |
| Git, GitLab CI, glab | ✅ | Plus deploying from a job into kube-lite |
| Ansible, Terraform, Edu Cloud | ✅ | Roles, modules, `moved`, `import`, `-refresh-only`, `-detailed-exitcode` |
| Prometheus, PromQL, Alertmanager, logs (LogQL) | ✅ | |
| Process explainer engine | ✅ | Steps, knobs, "break it", "what will happen?", cards, request waterfall |
| Documentation ladder, offline corpus | ✅ | |
| Quizzes (8 kinds), FSRS review, confidence | ✅ | |
| Placement checks, exams, protocol | ✅ | |
| Exams on the learner's own machines | ✅ | Setup scripts and a read-only fact collector (`trainer-check-host.sh`, and `check/trainer-check.sh` for Kubernetes); the fact block is parsed in the browser, and goals are judged by machine state, not by the commands typed |
| flowlab (Kanban) | ✅ | |
| v86 (tier B), multi-machine lab | ✅ | `V86Lab`: Alpine machines in their own workers on a shared switch, boot snapshots and saving to OPFS. 10 lessons and 5 exams run on v86, see the section below |
| Lab image (Alpine 3.24) | ✅ | Profiles `lab-node` and `lab-installer`, built by `npm run build:lab-image` without Docker, every download recorded in a manifest with URL, sha256 and license |
| Lab host (L2–L4 in the page) | ✅ | ARP, IPv4, ICMP, UDP, TCP, DHCP, `.lab` DNS, HTTP/1.1, the `mirror.lab` mirror |
| Cloud in the tab (`api.cloud.lab`) | ✅ | REST per OpenAPI, VMs are real v86 machines, load balancer, DNS, S3 |
| git.lab and CI | ✅ | Smart HTTP, a push starts a pipeline on the workstation |
| OpenTofu provider `lab` | ✅ | Go, linux/386, 11 resources and 4 data sources, in the image's filesystem_mirror |
| Bring-your-own AI, mentor | ✅ | The key is encrypted in IndexedDB; tested against a mock provider, not tested with a live provider |
| PWA, offline | ✅ | The service worker precaches all block chunks |
| RV64 track | ❌ | |

## The lab on real Linux, the cloud, git.lab and the provider

Everything below runs on the real v86 0.5.473 emulator: in Node (the same `host.ts` as the browser worker) and in headless Chromium. The Chromium numbers were taken on a Mac that was running other builds and tests at the same time, so they are an upper bound; in Node the machine is the same, but without the page and xterm.

| Part | Status | What is there |
|---|---|---|
| Image `lab-node` | ✅ | Alpine 3.24 x86, 309 packages: OpenSSH, nginx, iproute2 (bridge, VLAN, netns), nftables and iptables, dnsmasq, tcpdump, LVM, parted, sfdisk, git, curl, OpenTofu and the `lab` provider. Kernel `linux-virt` 6.18 (i686, PAE), root over 9p, our own initramfs |
| Image `lab-installer` | ✅ | A live system of 100 packages and a repository at `/media/cdrom/apks` with the signed index; after `setup-disk` the machine boots from its own disk through GRUB |
| Image build | ✅ | `npm run build:lab-image`, no Docker, 60–90 s. APKINDEX signatures are checked against Alpine's key, every .apk against the checksum in the index; every download is in a manifest with URL, sha256 and license. The files live in `public/v86/lab` (265 MB, not in git) |
| Lab host | ✅ | An L2–L4 stack in the page: Ethernet with 802.1Q, ARP, IPv4, ICMP, UDP, TCP with a window and retransmission; DHCP, DNS for the `.lab` zone, HTTP/1.1 with keep-alive and chunked, the `mirror.lab` mirror |
| Cloud `api.cloud.lab` | ✅ | REST per OpenAPI: projects, keys, networks, subnets, security groups (enforced by the lab host's routing), VMs, disks, a load balancer with health checks, DNS, S3 storage; asynchronous operations, quotas and errors as in real clouds. `POST /vms` boots a new real machine |
| git.lab and ci.lab | ✅ | Smart HTTP v0/v1: clone, fetch, push, non-fast-forward refused, stored in IndexedDB. A push starts the `.gitlab-ci.yml` pipeline on the workstation; the plan goes from the plan job to apply as an artifact |
| OpenTofu provider `lab` | ✅ | Go, terraform-plugin-framework 1.19, linux/386, 18 MB. 11 resources, 4 data sources; it sits in a filesystem_mirror, so `tofu init` works offline. State in `s3://tfstate` with locking |
| Lessons and exams | ✅ | Linux: `linux.ssh-hops`, `linux.web-openrc`, `linux.install`, `linux.disk-real`, in-browser variants of `linux.exam.disk` and `linux.exam.access`. Networks: `networks.linux-lab` (6 labs), `networks.exam.browser`. IaC: `iac.cloud-api`, `iac.tofu-lab`, `iac.remote-state`, `iac.modules-lab`, `iac.ci-apply`, `iac.exam.cloud`. CI/CD: `cicd.exam.tab`. The reference solutions pass on real v86 |

### Measurements

| What | Node | Chromium |
|---|---|---|
| Cold boot of a 128 MB machine to the prompt | 33–49 s | 29 s (`linux.install`, until the lesson is ready) |
| Two machines of the Networks lesson, cold (the second is a copy of the first one's snapshot) | — | 74–101 s |
| The same two machines after a page reload, from the boot snapshot | — | 12 s |
| Restore from a snapshot: emulator ready / first command answered | 69 ms / 151 ms | — |
| Boot snapshot | 114.7 MB, 19.0 MB gzipped, saved in 91 ms | — |
| Command latency: `true` / `ls /etc` / `ip -br addr` / `ss` | 20 / 43 / 60–89 / 181 ms | pinging the neighbour 0.1–0.4 s including typing |
| Lesson goal passed after Enter (GPT partitioning) | — | 4.4 s |
| Cloud workstation, 512 MB, cold | 32–38 s | 119 s |
| `curl` to the cloud API | 0.24–0.30 s | 0.83 s including typing |
| `POST /vms` → 202 / first VM booted next to the workstation | 0.64 s / 108 s | — |
| ssh into the new VM with a key | 1.8–2.3 s | — |
| `tofu init` / `plan` for 1 VM / `apply` / `plan` with no changes / `destroy` | 5.4 / 20.8 / 71.0 / 26.4 / 28.8 s | — |
| `git push` to git.lab / pipeline push → done (plan 28 s + apply 30 s) | 0.9 s / 59 s | — |
| Memory | Node process: 1140 MB with the workstation, 1381 MB with it and one VM — about 240 MB per 128 MB machine | page JS heap 215 MB (guest memory not included) |

The workstation with OpenTofu needs at least 384 MB of guest memory: `tofu` and the provider do not fit into 128 MB. The peak memory of `tofu` in the guest was not measured. The same provider and cloud with `tofu` running on the Mac (`TF_LAB=1`) give init 59 ms, plan for 11 resources 574 ms, apply 511 ms.

Runs: `npm run test:e2e:v86` (browser), `V86_LAB=1`, `V86_TF=1`, `V86_CLOUDLAB=1 npx vitest run …` (Node).

## QA of the fourth wave

**Types.** `tsc` failed on two unfinished pieces: the cloud did not know the `onLbTargets` hook through which the load balancer reports its targets' health, and the HTTP parser kept its buffer with too narrow a type. The hook is now on `Cloud`, and `GET` of a load balancer returns the `targets` field, as described in the OpenAPI file.

**The Networks lab layout.** The "Start the machines" button and the memory line ran into each other: the widget did not include the shared v86 styles. It does now.

**Browser check.** The 15 new pages (lessons and exams) were opened in Chromium at 1280 and 390 px in both languages: no sideways scroll, no console errors. The diagrams in the SSH and installation lessons scroll inside their own frame on a phone, like the other explainers. Cyrillic on English pages appears only in the titles of Russian-language sources. The Linux, Networks and cloud labs were run end to end: the machines boot, and commands reach the neighbours and the API.

## What was fixed in the third wave (QA and integration)

**Raw markdown in the interface.** Goal labels in the real-machine exams, machine requirements, quiz options and hints after a failed check printed backticks as is: "on \`vm1\` there is \`wg0\`". Now these strings go through inline markdown like the rest of the text: code is highlighted and no backticks are visible. Options containing code exist in the quizzes of five blocks, so the fix is not limited to the new exams.

**Phone.** In the real-machine exams the fact-collector command did not fit at 390 px: the page shifted sideways by 576 px in Networks and by 6–22 px in the Linux exams. Now the command block is limited to the column width and scrolls inside itself, and the "Copy" button sits below it. The goal icon no longer breaks away from its label onto a separate line. The hint after a failed check in the isolation exam, which now contains code, wraps by words instead of pushing the page sideways.

**Kubernetes collector.** The k8s-2 exam takes the text of `public/check/trainer-check.sh` straight from the file, and in development mode Vite warned on every request that importing from `public/` is not allowed. A small plugin, `src/core/public-raw-plugin.ts`, serves such files as text: the learner downloads and reads the same file that is shown on the page, and the warnings are gone.

**Verification.** The seven new exams were opened in Chromium at 1280 and 390 px in both languages, along with the intro page and training mode: no sideways scroll, no console errors, no raw markdown. The block pages of k8s-1, k8s-2, cicd-k8s, Networks and Linux link to their exams.

## Known issues

1. **A lesson still pulls in the whole textbook.** The course map paints from a light manifest assembled at build time, and the first visit to the home page weighs about 220 KB instead of 2.2 MB (330 KB instead of 6.5 MB uncompressed). But entering any lesson loads all blocks at once, because terminal commands, documentation pages and explainers are shared across blocks. To load only the needed block, each block needs an explicit list of what it relies on in other blocks.
2. **The real-machine exams have not been run on real machines.** The setup scripts and collectors are checked syntactically and by tests on recorded fact blocks; nobody has yet run them end to end on cloud VMs or on a kubeadm cluster.
3. **WireGuard in part B of Networks is installed by the setup script.** The block has no lesson on VPN, so the tunnel is given ready-made, and the learner's work is routing, NAT and a firewall on top of it.
4. **Technical labels in English in Russian mode.** Ethernet, IP and TCP header fields (`Destination MAC`, `TTL`…), columns like `READY` and command names are deliberately left in English, as in Wireshark and kubectl.
5. **Packet label at the target.** On the last segment of an edge, a packet's label may touch the frame of the node it is travelling to. Static labels are not affected.
6. **The Kubernetes constructor on a phone** scrolls sideways inside its frame. Dragging blocks there is awkward; the "tap a block → tap a block" buttons work.
7. **v86 has been tested** only in headless Chrome and Node. It has not been tested on real Safari and iOS; a manual checklist is at the end of the file.
8. **The Monitoring sandbox is thinner than the others:** 10 terminal tasks; the rest of the practice happens in the PromQL and logs workbenches.
9. **The browser is slower than Node.** The 512 MB cloud workstation took 119 s to boot in Chromium against 32–38 s in Node, and the two Networks machines 74–101 s (the Mac was busy with parallel jobs); after the first boot the snapshot helps — 12 s for two machines.

## Manual checklist for Safari and iOS

The course engine and v86 are tested automatically only in Chromium and Node. Until this checklist is walked through on real hardware, Safari and iOS do not count as verified. You need Safari on macOS and an iPhone or iPad with Safari; about 20 minutes.

1. Open the course, switch to Russian: the home page renders without console errors and the service worker registers.
2. Walk a lesson with a terminal (`linux.terminal`): the terminal answers and the step check fires.
3. Open the v86 lab (the `#/lab/linux-disk` page or a lesson with the lab widget): the machine boots to a shell and the boot snapshot restores. The console must show no `SharedArrayBuffer` or origin-isolation errors (Safari has supported COOP/COEP since 15.2, but the server must send the headers to Safari too).
4. Open an explainer (`net.ip` or `containers.orchestration`): the diagram animates and the steps advance.
5. On iOS repeat steps 1–3; one v86 machine should fit the device's memory.
6. Record the OS and Safari versions, the machine boot time and the console errors (Web Inspector; on iOS via a connected Mac, or repeat the steps in Safari with an iPhone emulation).

## Backlog

1. **SEO and GEO for damn.academy.** The course now has its own domain and should be discoverable by search engines and AI search (ChatGPT, Perplexity, Google AI Overviews): `robots.txt` and `sitemap.xml`, canonical URLs and `hreflang` for the Russian and English versions, per-block and per-lesson `title`, `description` and Open Graph images, schema.org markup (`Course`, `LearningResource`), `llms.txt`, lesson text served without JavaScript (prerendering), Google Search Console and Bing Webmaster Tools.
