# MVP status — what is done, what is partial, what is missing

English · [Русский](STATUS.ru.md)

State as of 18 November 2026, after the third wave (Kubernetes exams, exams on real machines, a light manifest for the home page). The numbers are taken from the build registry, not from the writers' reports. Every block passes the concept-order linter with no errors; the only warning is that the final block has no placement check, which is by design.

Checks on this date:
- `npm run build` — green, not a single chunk-size warning.
- `npx vitest run` — 59 files, 775 tests: 773 pass, 2 skipped (integration with real v86, run separately).
- `npm run test:e2e` — 35 Playwright scenarios, all pass.

The registry holds 15 route blocks and a hidden demo block, 137 lessons, 363 concepts, 471 items in the quiz bank, 74 process explainers, 21 exams, 26 widgets and 945 pages of offline documentation.

Legend: ✅ done · 🟡 partial · ❌ missing · — not needed by design.

## Summary by block

| Block | Lessons | Process explainers | Sandbox (terminal tasks) | Quizzes (in lessons / bank) | Placement check | Exam | Documentation ladder (docs sections; DL3 / DL4 / DL5 tasks) |
|---|---|---|---|---|---|---|---|
| F Orientation | ✅ 10 | ✅ 7 | ✅ 25 | ✅ 47 / 40 | ✅ 6 | — (intermediate and experienced close the block with three questions) | ✅ 2; 0 / 0 / 0 (the beginner block lives on DL1–DL2) |
| 1 Methodology | ✅ 15 | ✅ 5 + the flowlab board in 3 scenarios | — 3 flow tasks, no labs of its own by design | ✅ 55 / 49 | ✅ 15 | ✅ methodology.exam, 10 tasks | ✅ 6; 2 / 1 / 2 |
| 2 Linux | ✅ 19 | ✅ 6 | ✅ 63 | ✅ 60 / 60 | ✅ 10 | ✅ 5: first-day (6 + 2 questions), service (4, graded), isolation on the simulator (6 + 2); disk on one own VM (6 + 2) and access on two (6 + 2) | ✅ 10; 2 / 4 / 6 |
| 2a Git and YAML | ✅ 4 | ✅ 1 | ✅ 14 | ✅ 15 / 15 | ✅ 5 | ✅ 2: cafe (4 + 2), config (4 + 2, graded) | ✅ 5; 2 / 2 / 2 |
| 3 Networks | ✅ 15 | ✅ 12 | ✅ 52 | ✅ 55 / 55 | ✅ 17 | ✅ 2: networks.exam.office — 13 tasks (11 per variant) + 3 questions; networks.exam.machines, part B on three own VMs, — 7 + 2 | ✅ 18; 7 / 5 / 4 |
| 4 Containers | ✅ 11 | ✅ 7 | ✅ 51 | ✅ 62 / 54 | ✅ 11 | ✅ exam-docker-duty, 4 tasks | ✅ 12; 3 / 6 / 1 |
| 5 CI/CD | ✅ 5 | ✅ 4 | ✅ 16 + the pipeline board | ✅ 12 / 12 | ✅ 5 | ✅ cicd.exam.release (5 + 2) | ✅ 3; 1 / 2 / 1 |
| 6 Kubernetes, stage 1 | ✅ 15 | ✅ 12 + the constructor + the controller lab | ✅ 53 | ✅ 49 / 53 | ✅ 17 | ✅ 2: k8s-1.exam (10 + 3, graded), k8s-1.exam.cka in the spirit of CKA (17, 16 per variant, + 2) | ✅ 6; 6 / 2 / 5 |
| 6a Deploying to Kubernetes from CI | ✅ 1 (lesson A7) | ✅ 1 | ✅ 4 | ✅ 5 / 7 | ✅ 4 | ✅ cicd-k8s.exam (6, 5 per variant, + 2) | ✅ 2; 1 / 1 / 1 |
| 7 Kubernetes, stage 2 | ✅ 7 | ✅ 6 | — real VMs: 14 self-check widgets based on command output | ✅ 23 / 22 | ✅ 8 | ✅ k8s-2.exam on the learner's own three-VM kubeadm cluster (12, 10 per variant, + 2) | 🟡 3; 0 / 0 / 2 |
| 8 IaC | ✅ 7 | ✅ 4 | ✅ 23 | ✅ 23 / 24 | ✅ 7 | ✅ iac.exam (5 + 2) | ✅ 9; 1 / 5 / 1 |
| 9 A cluster from code (k8s-3) | ✅ 8 | ✅ 2 | ✅ 24 | ✅ 22 / 15 | ✅ 8 | ✅ k8s-3.exam.rebuild (7 + 2) | ✅ 4; 1 / 2 / 1 |
| 10 Monitoring | ✅ 8 | ✅ 4 | 🟡 10 + the PromQL and logs workbenches | ✅ 23 / 23 | ✅ 7 | ✅ monitoring.exam (6 + 2) | ✅ 6; 1 / 3 / 1 |
| 11 On-call shift and final exam | ✅ 2 | — | — tasks live inside the exams | 🟡 5 / 3 | — one exam for everyone | ✅ 2 on simulators: final.exam.oncall (5 + 1), final.exam.capstone (9 + 3) | 🟡 DL5 only in the final exam (1) |
| 12 Career | ✅ 9 | ✅ 3 + the review explainer from the "Review" page | — | ✅ 31 / 31 | ✅ 18 | ✅ mock interview rubrics | — |

"In lessons" quizzes are all items in the quiz sections of lessons, including references to the bank; "bank" is the items bound to the block's concepts. Exam in brackets: the number of cards and, after the plus, the number of oral questions at the end.

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
| v86 (tier B), multi-machine lab | 🟡 | The engine and the `#/lab/multinode` page exist, but no lesson runs on v86 yet |
| Bring-your-own AI, mentor | ✅ | The key is encrypted in IndexedDB; tested against a mock provider, not tested with a live provider |
| PWA, offline | ✅ | The service worker precaches all block chunks |
| RV64 track | ❌ | |

## What I fixed in this session (QA and integration)

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
7. **v86 has been tested** only in headless Chrome and Node. It has not been tested on real Safari and iOS, and no lesson runs on it yet.
8. **The Monitoring sandbox is thinner than the others:** 10 terminal tasks; the rest of the practice happens in the PromQL and logs workbenches.
9. **A workaround in the k8s-3 tests.** The tests for the `k8s-3.nodes` lab write the inventory from state directly, because `terraform output -raw` used not to work. It works now, and the tests can be switched to the real command.
