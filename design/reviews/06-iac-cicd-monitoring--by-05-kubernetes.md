# Review of 06-iac-cicd-monitoring.md (reviewer: the Kubernetes role, author of 05-kubernetes.md)

Date: 18.11.2026. Document 06 was read in full; for cross-checking: 01 (concept graph, block order, level checks), 05 (kube-lite, Helm, the real-cluster stage), 07 (methodology, DORA), 08 (primitives and visual language), 09 (tiers, check contract, the `trainer-check` agent, the v86 network).

## Verdict

The document is strong on the engineering side: the simulators (ansim, tfsim on real HCL, our own PromQL run against `promqltest`), "reference stands" in CI, `promql_equiv` over several datasets, incident C13 with evidence through queries — this is the best there is in the whole document set in terms of checkability. But in its current form it cannot be handed over to development, for three reasons. **First:** it diverges from the common framework: a different block order (Git and YAML before networks, although in 01 CI/CD with Git comes after Docker, and C04 requires N14), its own string concept identifiers instead of the 01 graph, its own check contract instead of `goals`/facts from 09, its own practicum checker instead of the `trainer-check` agent, its own level checks that do not match 01 §4.3, and module A0, which duplicates the methodology block 07 (there are five DORA metrics there, four here). **Second:** the owner's second-wave requirements are barely covered. There is no documentation ladder (R2) at all. Process explainers (R3) exist only as scroll scenes without parameters and without "break it" (R4), and in places they contain what is explicitly forbidden: ink, a "little figure", a "Friday release" storyline, a bot named "Petya". Stage 3 of Kubernetes with Terraform and Ansible (R12) contradicts the block order. The "reconciliation loop ↔ IaC ↔ GitOps" bridge (R10) is not built. **Third:** the junction with Kubernetes (A7, C16) is underspecified. Deploying to the cluster from CI is done with a "tool model" that bypasses kube-lite and `helm-engine.wasm`, and cluster metrics are not tied to the kube-lite state. Below are 30 findings; every blocking finding and most major ones come with ready text that can be pasted.

Severity totals: **BLOCKING — 7, MAJOR — 13, MINOR — 10.**

---

## Part 1. Consistency with the framework and term order

### 1. BLOCKING — The Git/YAML block order contradicts 01 and the concept graph
**Where:** 0.1 "Place of the blocks in the overall sequence", 0.2.

**What is wrong.** 06 puts **G. Git** and **Y. YAML** "after Linux, before networks", while 01 §5 has "5. CI/CD with Git" after Docker. The placement in 06 itself breaks the 01 graph: `C04 Remote repository` requires `N14 HTTP`, while G6 (remote, push, fetch) in 06 comes before networks. In addition, `C05 Merge request` requires `M14`, and `C07 Runner` requires `D11`. YAML is already in the graph as `L31 Data formats YAML and JSON` (Linux block), while 06 introduces it a second time with module Y and its own chain. The builder with the `introduces/uses` check (01 §6.1) will fail on this.

**Fix (I propose agreeing on it with 01 and applying it on both sides):**

| Position | Module | 01 concepts |
|---|---|---|
| End of the Linux block | **G-local** (G1–G5, G8 without tags): repository, commit, index, branch, merge, conflict, `.gitignore` | C01, C02, C03, C06 |
| End of the Networks block (after N14, N18) | **G-remote** (G6–G7): remote, push/fetch/pull, ssh key for the forge, merge request | C04, C05 |
| After Docker | A1–A6 | C07–C15 |
| After Kubernetes | A7 | K28/K29 + new C-ids (see No. 2) |

Remove module **Y** as a standalone module: introducing YAML stays with `L31` (document 02). 06 keeps the lesson **Y-traps** "YAML through the parser's eyes" (`uses: [L31]`, `introduces: [C-yaml-11-vs-12]`), taken before A1. The rationale "the Dockerfile lives in the repository" is covered by G-local: the Docker block needs local Git, not a remote.

### 2. BLOCKING — Concept identifiers are not from the 01 graph, and a screen introduces more than one concept
**Where:** 0.2, 0.4 (`introduces: [artifact, cache]`).

**What is wrong.** In 01, concepts have identifiers `C01…C15`, `I01…I14`, `O01…O14`, word forms and `requires`. In 06 the chains in 0.2 contain about 120 entities, and the lesson YAML uses string ids (`artifact`, `job-log`). There is no mapping, so the word-form linter will not work. In addition, 01 §6.1 requires: "Each screen declares `introduces` (no more than one concept)". Lesson a3 introduces two concepts, and at the lesson level rather than the screen level.

**Fix.** (a) Declare `introduces/uses` on the scene (`scenes[].introduces`), not on the lesson. (b) Extend the 01 graph with new ids. Below is a draft to paste into `content/concepts.yaml` and into the tables of 01 §6.2; the "Requires" column contains only existing ids or ids introduced right here.

| ID | Concept | Requires |
|---|---|---|
| C16 | Index (staging area) | C02 |
| C17 | HEAD and a branch as a pointer | C03 |
| C18 | Rebase and rewriting history | C17, C04 |
| C19 | Reflog | C18 |
| C20 | Runner executor (shell, docker) | C07, D11 |
| C21 | Job image (`image:`) | C20, D08 |
| C22 | CI cache (versus artifact) | C09 |
| C23 | Run rules (`rules`, MR/tag events) | C08, C05, C15 |
| C24 | CI environment and deployment history | C13, F10 |
| C25 | `needs` job graph | C08 |
| C26 | Reuse: `extends`, `include`, reusable workflows | C08 |
| C27 | Deploying to Kubernetes from CI (push model) | C24, K12, K25 |
| C28 | GitOps deployment from CI (pull model): CI writes the tag to the configuration repository | C27, K29 |
| I15 | Ansible facts | I10 |
| I16 | Handler | I11 |
| I17 | Variable precedence | I11, I12 |
| I18 | Terraform resource graph, `depends_on` | I05 |
| I19 | In-place update and replacement | I05, I06 |
| I20 | `count` and `for_each`, instance address | I07 |
| I21 | `import`, `moved`, `state mv` | I06, I20 |
| I22 | Three ways to bring the world to the desired state: Ansible, Terraform, a controller | I13, K03 (see No. 13) |
| I23 | A Kubernetes cluster from code: Terraform + Ansible + kubeadm | I13, K32 (see No. 6) |
| O15 | Cardinality | O02 |
| O16 | `histogram_quantile` and buckets | O03, O06 |
| O17 | Recording rule | O06 |
| O18 | Alert states: pending/firing, `for` | O08 |
| O19 | Alertmanager route, grouping, inhibition | O08 |
| O20 | Burn rate | O09 |
| O21 | Container metrics from cgroups (cAdvisor) | O13, D04 |

(c) In 0.2, give an id for every chain, for example "artifact (C09) → cache (C22)". Entities that do not deserve a separate id (`policy: pull`, `expireIn`) should be modeled as a `facet` of an existing concept. Then they do not count as an "introduction" and do not break the "one concept per screen" rule.

### 3. BLOCKING — Its own check contract instead of "facts → predicates" from 09
**Where:** 0.4 (table of check types, example `a3-d1`), 7 (practicum checker).

**What is wrong.** 09 §2.4 has already reduced the check types of 06 to the `goals[]` form with `when`/`keep`/`fail`/`envs`, and kept the evaluators `yaml_path`, `lint`, `plan_expect`, `promql_equiv` as pluggable, but with a common `CheckResult`. 06 still has the old `checks:` format. Feedback there is described as `forbid.message` rather than `fail[].say` + `fail[].term`. The `term` field is mandatory: it is used to send the learner to the lesson where the term was introduced, and this is a requirement of 06 itself (0.4, "which term to review").

**Fix — `a3-d1` in the 09 format (paste instead of the example in 0.4):**

```yaml
id: a3-d1
kind: pipeline-fix
level: L0
doc_step: 2                          # documentation ladder step, see No. 4
task:
  ru: "Джоба deploy падает с «dist/: No such file or directory». Сделайте так, чтобы результат сборки дошёл до деплоя."
  en: "The deploy job fails with 'dist/: No such file or directory'. Make the build result reach the deploy job."
start: { repo: fixtures/site-no-artifacts, pipeline_file: .gitlab-ci.yml }
goals:
  - id: g-lint
    eval: { lint: gitlab }
  - id: g-run
    needs: [pipeline]
    eval: { run: { event: push, ref: main } }
    when: "pipeline.last.jobs[name=build].status=success && pipeline.last.jobs[name=deploy].status=success"
    fail:
      - if: "pipeline.last.jobs[name=deploy].log~'dist/: No such file'"
        say: { ru: "deploy всё ещё не видит dist/: у build нет artifacts:paths", en: "deploy still cannot see dist/: build has no artifacts:paths" }
        term: C09
  - id: g-artifact
    eval: { yaml_path: "$.build.artifacts.paths", contains: "dist/" }
  - id: g-no-rebuild
    eval: { yaml_path: "$.deploy.script[*]", not_matches: "npm (ci|install|run build)" }
    fail:
      - say: { ru: "Деплой не должен собирать сайт заново: сборка — работа джобы build.", en: "Deploy must not rebuild the site." }
        term: C09
hints: [a3-h1, a3-h2]
ai_context: [task, pipeline_file, last_run_log, doc_step]
```

The pipeline simulator must emit facts in the `dt.facts/v1` schema with the `pipeline` scope (`pipelines[].jobs[].{name,status,log,artifacts,startedAt,finishedAt,runner}`). The same kind of scopes are needed for ansim (`ansible.runs[].hosts[].tasks[]`), tfsim (`tf.state`, `tf.plan`) and monitoring (`prom.targets`, `prom.rules`, `am.routes`). These scopes must be added to 09 §2.2, and 06 should reference them.

**Practicum (section 7).** Replace `docker run ghcr.io/<org>/devops-trainer-checker` with the `trainer-check` agent from 09 §5.4 with the `iac-pet` track: `trainer-check run --track iac-pet --nonce …`. The agent already knows how to collect facts, verify a one-time code and sign the result for presentable exams. A separate container duplicates it and provides no signature. Fact scopes for the track: `prom.targets` (`/api/v1/targets`), `prom.rules`, `grafana.dashboards` (by UID), `http` (application probe), `tf.state` (the agent reads a file with the output of `terraform show -json`, which the learner puts next to it), `ansible.rerun` (output of the second run).

### 4. BLOCKING — There is no documentation ladder (R2)
**Where:** missing in all blocks G, A, B1, B2, C.

**What is wrong.** Nowhere does it say how the learner learns to read `man git-*`, the GitLab CI reference, `ansible-doc`, Terraform provider pages and the PromQL function reference. Yet this is exactly the documentation they will be looking at every day at work. The 06 exams are framed as "AI turned off", but it is not said which documentation is open during them.

**Fix — insert a common "Documentation ladder" section into 0.x and a table into each block.** General rule: an exercise has a `doc_step: 1..5` field. A beginner goes through steps 1→5 over the course of the block, an intermediate learner starts at step 2, an experienced one at step 3 (as R2 requires). At step 4 the AI mentor gets the instruction "do not name the command or flag; ask where the learner looked; point them to `man`/`--help`/`ansible-doc`/`terraform -help`/the official page". The 09 §4.5 assistant must accept `doc_step` in its context.

**Page anatomy taught at step 2** (the section is highlighted in the fragment):
- `man git-log`: NAME / SYNOPSIS / DESCRIPTION / OPTIONS / EXAMPLES / SEE ALSO; `git help -a`, `git log -h` (short help).
- GitLab CI YAML reference: every keyword has the blocks **Keyword type / Supported values / Example / Additional details / Related topics**.
- `ansible-doc ansible.builtin.lineinfile`: OPTIONS (`=` — required parameter, `-` — optional, `default:`), ATTRIBUTES (`check_mode`, `diff_mode`), EXAMPLES, RETURN VALUES. `ansible-doc -l`, `ansible-doc -t filter`, `ansible-doc -s` (snippet).
- A resource page in the Terraform Registry: **Example Usage / Argument Reference (Required/Optional) / Attributes Reference / Import**. Plus `terraform -help plan`, `terraform plan -help`.
- prometheus.io, "Query functions": every function has the signature `rate(v range-vector)`, a description and caveats. Plus "Configuration" with the notation `<duration>`, `[ - <scrape_config> ... ]`, `promtool --help`, `amtool --help`.

**Tasks by step (3–4 per block, ready wording):**

| Block | Step 1 "glimpsed" | Step 2 fragment with highlighting | Step 3 "find the flag", link only | Step 4 forcing (not covered in theory) | Step 5 exam |
|---|---|---|---|---|---|
| G | under the `git status` output, a line "this is from `man git-status`, section SHORT FORMAT" | hint for G-D1: a fragment of `git restore` OPTIONS with `--staged` highlighted | "Show the history as one line per commit with a branch graph" → link to `git-log` OPTIONS; check: the command log contains `--oneline` and `--graph` | "Find the commit in which the line `DEBUG=1` disappeared from the code" (`git log -S`/`-G`; check — the entered hash); "Temporarily set your changes aside without committing them and switch to hotfix" (`git stash`, if it was not introduced in theory); "Work on two branches at once in two directories" (`git worktree add`; `state` check: two working trees) | exam G: only git-scm.com/docs is open; task "find the culprit commit with a binary search" (`git bisect` was not taught) |
| A | on `rules:` in A-I6, a note "Keyword reference → rules" | hint for A-D4: a `tags` fragment with "Jobs with tags… only run on runners with all the tags" highlighted | "Make the job run only when files in `docs/` change, compared with main" → link to `rules:changes`; check — `run` on two events | "Let a failed `lint` not block the pipeline, but the MR shows a warning" (`allow_failure: true` on lint, not on tests — `forbid` on tests); "Compare changes against `main`, not against the previous push" (`rules:changes:compare_to`); "Limit the artifact to one week" (`artifacts:expire_in`); "Retry on runner failure, but not on a test failure" (`retry:when: runner_system_failure`) | exam A: docs.gitlab.com/ci and docs.github.com/actions are open; one task on `workflow:rules` + `auto_cancel`, which were not in the course |
| B1 | in the `ansible-playbook` output, a link "module `apt` — `ansible-doc apt`" | hint for B1-D3: a fragment of `ansible-doc lineinfile` with `regexp` and `line` highlighted | "Install the package only if the apt cache is older than an hour" → only `ansible-doc apt`; check: `cache_valid_time` in the task + `idempotent` | "Restart the playbook from the failed task" (`--start-at-task`); "Run a task once for the whole group" (`run_once`); "Delegate removing the host from the load balancer to lb1" (`delegate_to`); "Show all hosts of a group without a run" (`--list-hosts`) | exam B1: only docs.ansible.com + `ansible-doc` in the terminal are open; a task on a module that was not in the course (`ansible.builtin.cron` or `ansible.posix.sysctl`) |
| B2 | in the `plan` output, at `# forces replacement`, a note "Registry → edu_vm → Argument Reference" | hint for B2-D1: a fragment of the `edu_vm` page with "Changing this forces a new resource" highlighted | "Show the plan without refreshing state from the cloud" → only `terraform -help plan`; check: `-refresh=false` in the log | "Generate code for the imported bucket" (`plan -generate-config-out`); "Mark the VM for replacement without editing code" (`-replace`); "Find an output value outside the Terraform terminal, in JSON" (`output -json`); "Check a `cidrsubnet` expression interactively" (`terraform console`) | exam B2: developer.hashicorp.com/terraform and the `edu` provider page are open; a task on `check {}` or `precondition`, which were not in the course |
| C | on `rate` in C-I6, a note "prometheus.io → Query functions → rate()" | hint for C-D5: a fragment of the `rate` description with "should only be used with counters" highlighted | "How many times did the process restart in an hour?" → link to the functions page; check: `promql_equiv` against the reference `changes(process_start_time_seconds[1h])` | "An alert on a vanished series" (`absent_over_time`); "Rename the `instance` label to `host` in the result" (`label_replace`); "Set a 2-hour silence from the terminal" (`amtool silence add`); "Check an alert rule with a unit test" (`promtool test rules`, the test file was not shown) | exam C: prometheus.io/docs and grafana.com/docs are open; a task with `promtool test rules` and `time()` arithmetic |

**Technical side.** Step 5 needs a built-in viewer of the official documentation or a domain allowlist in a separate tab. How to implement this technically should be decided by 09. Offline, a snapshot of the documentation in a Service Worker is needed; for licenses, see No. 19.

### 5. BLOCKING — Process explainers (R3/R4) do not meet the requirements and in places directly violate them
**Where:** 0.5 (`ink.ts`: "all diagrams are drawn as SVG with these attributes"), 1.2 (A0 screens 1–2: "Ink diagram", "little figure", the "Friday release" storyline), 5.4 (B2-I4 "Petya increased the disk… it was urgent"), 3.4 A-I1, 5.4 B2-I7, 6.4 C-I3.

**What is wrong.**
- R4 forbids characters, storylines and decoration, and 08 §5.1 keeps ink only for metaphors. In 06 it is precisely the mechanism diagrams that are "inked", and there is a "little figure" with a button and a storyline with a Saturday outage.
- The process explainers required by R3 (CI/CD "git push → deploy", "terraform plan/apply + state", "idempotent Ansible run", "scrape → store → PromQL → alert → notify") are done in 06 as scroll scenes (`scroll.ts`). They have not a single slider or toggle, no "break it", no recalculation with an explanation next to it, and no `stepper` primitive with forward, backward and pause (08 §3.1).

**Fix.** (a) In 0.5, replace the `ink.ts` line with "diagrams use the 'blueprint' hand (08 §5.1): primitives `diagram` + `stepper` + `breakit` + `packets`; `ink.ts` only for `data-ink` drawing of the blueprint line, without the boiling line and `sketch`". (b) In A0, remove the "little figure" (a "Release" button without a figure) and the storyline (see No. 7). (c) In scenarios with "manual" changes, replace "Petya" with a neutral log event: "At 14:02 the `size_gb` of disk `disk-db` was changed via the console (source: console, user ops-2)". (d) Insert the four storyboards below. All of them are `widget: stepper` on top of `diagram`; every state is computed by folding the events of the 08 §3.0 bus.

**Storyboard E-CI "From `git push` to a running version"** (block A, after A2; again in A7)
- Screen 1. Blocks from left to right: `working directory` → `forge` → `pipeline` → `job queue` → `runner` → `image registry` → `staging` → `production`. Labels on the lines: `git push (HTTPS/SSH)`, `webhook: push event`, `creates pipeline from .gitlab-ci.yml`, `runner polls: POST /jobs/request`, `docker pull image:`, `docker push :$CI_COMMIT_SHORT_SHA`, `deploy`. There is a single animation: the commit square `1a2b3c4` crawls along the line.
- Screen 2. Inside the "runner": a clean machine → `git clone --depth 20` → cache restore → script → artifact upload → status. A "job time" counter grows.
- Parameters: a runner `concurrent` slider 1–4 (the queue is recalculated, with text on the right "jobs wait for a free slot: +N s"); a `cache: on/off` toggle (`npm ci` 9 s ↔ 52 s; explanation "the cache speeds things up but may disappear — the build still succeeds"); a `needs` / stages toggle (the timeline is rebuilt into a DAG); a `when: manual` toggle on production (Delivery ↔ Deployment, the label changes); a `GIT_DEPTH` slider.
- "Break it": remove the runner with the `docker` tag (the job is `pending`, real text "stuck…"); delete `artifacts` (deploy fails with `dist/: No such file`); the image does not exist (`failed to pull image`); a test fails (the arrow to staging is not drawn, label "exit code 1 → job failed → next stages skipped").
- Clicking any arrow opens a card: "what it is, who initiates it, where to see it" (`CI_PIPELINE_SOURCE`, the runner log, the Jobs page).

**Storyboard E-TF "`terraform plan` and `apply`: code, state, cloud"** (block B2, replaces B2-I7 as a scroll scene)
- Screen 1. Three columns "Code / State / Cloud API", with a row of phases at the bottom: `read → parse → graph → refresh → diff → plan → confirm → apply → write state`.
- Refresh step: arrows `GET /vms/vm-7` go from State to the API, responses come back, and a diverging attribute gets a "drift" mark.
- Diff step: each resource gets a `+ ~ - -/+` icon, with the reason labeled on the line (`image_id changed → forces replacement`).
- Apply step: graph nodes light up in dependency order, in parallel up to `-parallelism`; after each resource the state `serial` goes +1.
- Parameters: a `-parallelism` slider 1–10; a `create_before_destroy` toggle (order `-/+` ↔ `+/-`, next to it a counter "VM downtime: 40 s ↔ 0 s"); a `-refresh=false` toggle (drift is not visible, with an explanation); a "change attribute" field with a choice of `name`/`zone`/`cores` (the icon is recalculated immediately).
- "Break it": delete state (all nodes `+`, the cloud has not changed, label "Terraform does not know these VMs — there will be duplicates or a name conflict"); turn off locking and run a second `apply` (state gets overwritten); the API responds with 429/quota (apply stops midway, state contains only what was created — the "partial apply" lesson).

**Storyboard E-ANS "An idempotent Ansible run"** (block B1, together with B1-I3/B1-I4)
- Screen 1. The control machine on the left, three hosts on the right, on the lines `ssh`, `python3 /tmp/ansible-tmp-…/AnsiballZ_apt.py`, `JSON: {"changed": false}`.
- Steps: gather facts → task 1 on all hosts (`linear` strategy) → task 2 → handlers at the end of the play → RECAP. The `ok/changed/failed` counters grow per host.
- Parameters: `forks` 1–5 (how many ssh arrows at once); `strategy: linear/free`; `serial` 1/2/all; a "run No." toggle 1→2→3, where the idempotency grid fills column by column; `--check` (arrows are dashed, nothing changes on the hosts, label "the module reports what it would change").
- "Break it": replace `lineinfile` with `shell: echo >>` (the column is always yellow, the file grows); put `ansible_date_time` into the template (the handler fires every time); turn off python on a host (`/usr/bin/python3: not found`, label "Ansible is agentless, but not python-less — except for `raw`"); crash one host on task 2 (the handler did not run on it).

**Storyboard E-MON "From a counter in code to a message to the on-call engineer"** (block C, end-to-end, replaces and merges C-I3 + C-I9)
- Blocks: `api process (counter in memory)` → `/metrics` → `Prometheus scrape` → `TSDB (head block)` → `rule evaluation` → `Alertmanager` → `receiver (pager/chat)`. Labels on the lines: `HTTP GET /metrics every 15s`, `append sample (t, v)`, `eval every 1m`, `POST /api/v2/alerts`, `group_wait 30s`, `webhook`.
- Parameters: `scrape_interval` 5/15/60 s (points on the series strip get sparser, `rate[1m]` at 60 s goes empty with an explanation); `for` 0/1/5/10 min (state axis inactive → pending → firing); `group_wait` and `repeat_interval` (how many messages arrive per hour); `evaluation_interval`. A "time from breakage to message" counter is the sum of `scrape + eval + for + group_wait` and is shown as a formula next to it.
- "Break it": the target is unreachable (`up=0`, explanation "the alert must be on `up`, otherwise there is silence"); stop Alertmanager (the rule is firing, no message, label "who watches the watcher: Watchdog alert / dead man's switch"); a wrong `receiver` in the route (the message goes to default); a `user_id` label (the series counter shoots up, the memory scale turns red).

### 6. BLOCKING — Stage 3 of Kubernetes with Terraform and Ansible (R12) does not fit the block order, and 06 does not have it
**Where:** 0.1, 5.3 (B2-13), 7.

**What is wrong.** R12 requires ordering VMs through Terraform and configuring them through Ansible at stage 3. Per 01 §5, IaC comes **after** Kubernetes, and that is justified: "after the learner has ordered VMs for the cluster by hand, the pain is understood". If nothing is done, stage 3 will use concepts that have not been introduced yet. The 06 practicum (section 7) says nothing about a Kubernetes cluster.

**Fix.** Split stage 3 into two passes and pin this down in 01, 05 and 06:
- **3a (K8s block, track R3 of document 05):** kubeadm by hand on three VMs ordered with `hcloud`/`yc` commands or brought up on one's own computer with Multipass or Vagrant. This is the "pain".
- **3b (finale of the IaC block, new module B-K8s in 06):** the same cluster, but from code. Add it to 06 as section 7.2.

> **7.2. B-K8s. A Kubernetes cluster from code (I23).** Levels: L1 — from a template; L2 and experienced — from scratch. Time: 4–6 hours. The trainer does not execute, but guides and checks (tier C).
>
> 1. **Terraform** (`modules/k8s-node`, `for_each` over `{cp-1 = "control-plane", worker-1 = "worker", worker-2 = "worker"}`): VMs with 2 vCPU / 4 GB, a private network, a security group. Open between nodes: 6443/tcp (API), 2379–2380/tcp (etcd, cp only), 10250/tcp (kubelet), 10257, 10259/tcp (controller-manager, scheduler, cp only), 4240/tcp (Cilium health), 8472/udp (Cilium VXLAN); from outside — 22/tcp and 6443/tcp only from the learner's IP. The label `trainer=devops` on all resources. `output "inventory"` returns a YAML Ansible inventory with the groups `control_plane` and `workers`. Provider options are the learner's cloud: `hetznercloud/hcloud`, `yandex-cloud/yandex` (via a mirror) and others from 09 §5.2. For a learner without a cloud account, the Terraform part is shown on the in-tab cloud (00 §6.13, the `lab` provider), and the cluster is installed on local VMs on their own computer (09 §5.3) from a hand-written inventory.
> 2. **Ansible**: role `k8s_prereq` (swap off and removal from fstab; modules `overlay`, `br_netfilter` in `/etc/modules-load.d/`; `net.ipv4.ip_forward=1` via `ansible.posix.sysctl`); role `containerd` (`SystemdCgroup = true` in `config.toml`, restart handler); role `kube_packages` (repository `pkgs.k8s.io/core:/stable:/v1.36/deb/`, kubeadm/kubelet/kubectl packages with a pinned version and `dpkg_selections: hold`); role `kubeadm_init` on cp-1 (`kubeadm init --config` from a template, a task with `creates: /etc/kubernetes/admin.conf` — the main idempotency lesson for a "command without a module"); role `kubeadm_join` (token via `kubeadm token create --print-join-command`, `delegate_to: cp-1`, `run_once`, then join with `creates: /etc/kubernetes/kubelet.conf`); installing Cilium via `helm` or `cilium install` with the same idempotency guard.
> 3. **Checks (`trainer-check` agent, `iac-k8s` track):** 3 nodes Ready, the same kubelet version; Cilium pods Running on every node; the second playbook run has `changed=0` (the learner pastes the RECAP, the agent verifies the output hash); `terraform plan` → "No changes" (pasted); all VMs have the `trainer=devops` label.
> 4. **Cost** — the 05 §10.2 calculator with the same `providers.yaml`: "3 VMs × rate × hours"; in large type — "if you forget it for a month".
> 5. **Teardown (mandatory):** `terraform destroy`, then paste the output of `hcloud server list -l trainer=devops -o json` or `yc compute instance list --format json` with a filter — passed when the list is empty. Until the step is marked, the module is not credited; a reminder on the next login — as in 05 §10.5.

---

## Part 2. Overlaps with neighboring documents

### 7. MAJOR — Module A0 duplicates the methodology block 07, and the DORA metrics diverge
**Where:** 1 (A0), 1.2 screen 3, 0.1.

**What is wrong.** The definitions of CI, Delivery and Deployment (M14–M16), the quiz with situations and the link to the kanban simulation already exist in 07 (P-I5, P-E1, E10 "Five instruments"). 06 has "four DORA metrics (… since 2024 also rework rate for the experienced)", while 07 has "five metrics per dora.dev", including the share of unplanned deployments. Since 2023 DORA has named "time to restore" as "failed deployment recovery time".

**Fix.** Remove A0 from 06. 07 remains the owner of M14–M17 and DORA. 06 keeps only the "bridge" A-I6 "One line" (YAML version). Hand screen 2 "Pipeline" with gates over to 07 as a storyboard, without the "little figure". Replace the "Friday release" storyline with the R3 process explainer "a task from idea to production" with a "batch size" slider (07 does this). In 0.1, replace the first line with "A0 — see 07, M14–M17".

### 8. MAJOR — Level checks diverge from 01 §4.3
**Where:** 2.1, 3.2, 4.2, 5.2, 6.2.

**What is wrong.** 01 has L1/L2 level checks for "CI/CD (with Git)", "IaC", "Monitoring" with criteria ("4 out of 5, key one — 1"). 06 has its own sets with different tasks and the threshold "all tasks of the level, up to two attempts". The levels are called "Beginner/Intermediate/Experienced" rather than L0/L1/L2. The learner model of 01 §2 will not be able to record the result.

**Fix.** The single source is 01 §4.3. 06 keeps a reference and **additional** tasks marked "key: no" that widen the pool of variants (protection against memorization). Bring the level terminology to L0/L1/L2. Merge task 01 "CI/CD L1 No. 3: `make test`" and task 06 "A-D1: `./test.sh`" into one training project.

### 9. MAJOR — A7 "Deploying to Kubernetes" is done with a tool model that bypasses kube-lite and `helm-engine.wasm`
**Where:** 3.1 ("Commands that cannot be executed in the browser (… `helm upgrade`) are implemented as tool models"), 3.3 A7, 9.

**What is wrong.**
- Per 05 §0 items 2–3 and 09 §1.7, `kubectl` and `helm` **are executed** in the browser in kube-lite and `helm-engine.wasm` in the shared `sim.worker.ts`. A "model with a plausible log" would produce a second, diverging Kubernetes.
- It is not described how a CI job gets access to the cluster. Teaching "the administrator kubeconfig as a File variable" is harmful: in real work this is how cluster-admin leaks happen.
- GitLab has removed certificate-based cluster integration (GitLab 15.0); the recommended path is the GitLab agent for Kubernetes (`ci_access`).
- In Helm 4 (since November 2025) `--atomic` was renamed to `--rollback-on-failure`, and `--force` to `--force-replace`; the old flags produce a warning ([Helm 4 overview](https://helm.sh/docs/overview), [Helm 3 EOL](https://helm.sh/blog/helm-v3-end-of-life)).

**Fix — replace the A7 row in 3.3 and add section 3.8:**

> **3.8. A7. Deploying to Kubernetes from CI.** The A7 job is executed by the simulator's runner. The `kubectl` and `helm` commands in its script are executed by the kube-lite of the same worker (05 §5.2), authenticating with a ServiceAccount token. That is why the reconciliation loop visualizer and the "Kubernetes from blocks" diagram show the rollout started by the pipeline.
>
> Curriculum (concepts C27, C28; requires K12, K25, K28, K29):
> 1. **How to log in to the cluster.** ServiceAccount `deployer` in namespace `staging`, a Role with `get/list/watch/create/update/patch` on `deployments`, `services`, `configmaps`, a RoleBinding; the token — `kubectl create token deployer --duration=1h` in a File variable `KUBECONFIG`, Protected, scoped to the `staging` environment. As an overview — the GitLab agent for Kubernetes (`ci_access`) as GitLab's recommended path and OIDC for cloud clusters. Anti-example — a `cluster-admin` kubeconfig; the check `kubectl auth can-i delete nodes` from the job must return `no`.
> 2. **An immutable tag.** Image `registry/web:$CI_COMMIT_SHORT_SHA`; `kubectl set image` or `helm upgrade --install web ./chart --set image.tag=$CI_COMMIT_SHORT_SHA`. Explanation through the reconciliation loop: a new tag → a new `pod-template-hash` → a new ReplicaSet. With `:latest` and an unchanged manifest, the Deployment does not change and there is no rollout.
> 3. **Wait and roll back.** `kubectl rollout status deploy/web --timeout=120s` (the job fails if the rollout did not complete); `helm upgrade --install --wait --rollback-on-failure` (Helm 4; `--atomic` is the old name); manual rollback — `kubectl rollout undo` / `helm rollback` or Re-deploy of an old environment job (A-I5).
> 4. **Push versus pull.** CI with permissions in the cluster (push) versus CI that commits the tag to the configuration repository, and `argocd-lite` from 05 that pulls it in (pull). Link to the reconciliation loop explainer (No. 13).
>
> Drills:
> - **A-D15** "The job is green, but the site is old": tag `latest` and `imagePullPolicy: IfNotPresent`. Goal: `k8s.objects[kind=Deployment,name=web].spec.template.spec.containers[0].image~':[0-9a-f]{8}$'` and `rollout` completed.
> - **A-D16** "The deploy failed with Forbidden": a Role without `patch`. Goal: job success; `keep`: the SA has no ClusterRoleBinding; `fail.term: K25`.
> - **A-D17** "A broken image went to production": add `rollout status --timeout` and a rollback. Goal: with image `trainer/web:2.0` (CrashLoop, 05 §5.2) the job is failed **and** the Deployment still has ready pods of the previous revision (`keep`: `readyReplicas>=2` over the whole time, kube-lite log).
> - **A-D18** (L2) "Move the deployment to GitOps": CI commits the tag to `deploy/values.yaml`, Application `argocd-lite` is Synced. `forbid`: `kubectl` in the job script.

### 10. MAJOR — C16 "Monitoring in Kubernetes" is not tied to kube-lite and cgroups (R6)
**Where:** 6.1 (the Shop generator is independent of the cluster), 6.3 C16 ("overview"), 9.

**What is wrong.** The metrics generator is a function `f(seriesId, t, seed, incidents)` separate from kube-lite. In C16 the learner cannot delete a pod and see how `kube_deployment_status_replicas_available` changes, or set `limits.memory` and see OOM in the metrics. The bridge "cgroups v2 in Linux → `memory.max` in the pod limit → container metric" (R6) is not built, although this is the most valuable place in the whole course for job interviews.

**Fix — replace the C16 row and add section 6.10:**

> **6.10. C16. Kubernetes as a source of metrics.** In C16 mode the generator takes series from the kube-lite state: `metrics-server-lite` from 05 §5.2 is extended to the exporters `kube-state-metrics-lite` (series from objects) and `cadvisor-lite` (series from the cgroup model of each container on a node). The learner's actions in `kubectl` are immediately visible in PromQL.
>
> Series: `kube_pod_status_phase`, `kube_pod_container_status_restarts_total`, `kube_pod_container_status_last_terminated_reason{reason="OOMKilled"}`, `kube_deployment_status_replicas_available`, `kube_deployment_spec_replicas`, `kube_node_status_condition`; `container_cpu_usage_seconds_total`, `container_memory_working_set_bytes`, `container_spec_memory_limit_bytes`, `container_cpu_cfs_periods_total`, `container_cpu_cfs_throttled_periods_total`.
>
> Curriculum: (1) where container metrics come from — the pod cgroup in `/sys/fs/cgroup/kubepods.slice/…`, the files `memory.current`, `memory.max`, `cpu.stat` (`nr_periods`, `nr_throttled`), which the learner has already read in Linux (R6); (2) `kubernetes_sd_configs` with the roles `node`, `pod`, `endpointslice`, relabel `__meta_kubernetes_pod_label_app` → `app`, the `prometheus.io/scrape` annotation as a convention rather than a built-in feature; (3) ServiceMonitor and PodMonitor as prometheus-operator CRDs (requires K30); (4) control plane metrics as an overview (`apiserver_request_total`, `scheduler_pending_pods`).
>
> Drills:
> - **C-D12** "The pod is slow, CPU is not at 100%": `limits.cpu: 200m` on `trainer/hog`. Query for the throttling share: `sum by (pod) (rate(container_cpu_cfs_throttled_periods_total[5m])) / sum by (pod) (rate(container_cpu_cfs_periods_total[5m]))`. Then `kubectl exec` and `cat /sys/fs/cgroup/cpu.max` → `20000 100000`. Goal: `promql_equiv` + the answer "cpu.max = 20000/100000".
> - **C-D13** "Restarts": an alert on `increase(kube_pod_container_status_restarts_total[15m]) > 3` + the reason from `last_terminated_reason`; the learner raises `limits.memory`, and the alert goes to resolved. Goals: `prom.rules[name=PodRestarting].state=inactive` after the fix; `keep`: the same Deployment.
> - **C-D14** "Fewer replicas than needed": `kube_deployment_spec_replicas != kube_deployment_status_replicas_available` with `for: 10m`; to break it — `kubectl cordon` two nodes with `requests` larger than the free capacity.

Add a fifth incident variant to 6.6, related to R9: **"504 at the entrance"**. The Gateway returns 504 because the Service has an empty EndpointSlice: readiness fails after a release, and a NetworkPolicy from the same release cuts traffic from the Gateway controller to the pods. Evidence: `kube_endpoint_address{ready="true"}` = 0 (or an EndpointSlice metric), growth of `5xx` at the Gateway level with zero requests at the `api` level. The investigation chain DNS → Service → Endpoints → pod → NetworkPolicy is the same as in the Kubernetes networking block (05 §6.4), only through metrics.

### 11. MAJOR — The "Real Ansible" lab diverges from 09 and R11
**Where:** 4.1 (three v86, `inbrowser`, 10.5.0.x, dropbear), 8.1 (snapshots of 40–60 MB).

**What is wrong.**
- Per R11, machines must connect through our JS switch with visualization, not through raw `inbrowser`. In 09 §1.6 the segment is `10.0.0.0/24` with DHCP from `dnsmasq`, not static 10.5.0.x.
- There is no image with ansible-core in the image list of 09 §1.4.
- dropbear does not include `sftp-server`. By default Ansible tries sftp, then scp, and fails without them. `openssh-server` is needed (it is small in Alpine), or `ansible_ssh_transfer_method: piped`.
- Memory: R11 budgets 64–128 MB per node. A control machine with ansible-core (Python 3.12, worker forks) needs at least 256 MB. The 09 snapshot budget is ≤ 40 MB per machine, so 3 machines are 80–120 MB, not "40–60 MB".

**Fix (insert into 4.1):** "The lab runs on the common multi-node network of R11. Control node `lab-ansible` (= `lab-alpine` + `python3`, `ansible-core` 2.18+, `openssh-client`), 256 MB. Managed nodes `lab-alpine` + `python3` + `openssh-server`, 96 MB each. Addresses are handed out by the switch's DHCP, names by its DNS (`node-1.lab`). The switch visualizes ssh sessions: with `forks=5` five simultaneous streams are visible. The lab is not available on a phone (R11: one node); QR handoff is offered. The same managed nodes are suitable for the hybrid Kubernetes of 05/R11: Ansible configures the node on which our kubelet agent then runs". Budget in 8.1: "snapshots of three machines ≈ 90–110 MB zstd, loaded only on explicit launch". Add the `lab-ansible` image to 09 §1.4.

### 12. MAJOR — The practicum does not work on local VMs as described and diverges from the provider list of 05/09
**Where:** 7.

**What is wrong.** 09 §5.2–5.3 offers the learner two paths: a cloud of their choice or local VMs on their own computer. 06 mentions only Yandex Cloud and Hetzner and does not mention local VMs at all. Local VMs have **no inbound public addresses** (09 §5.3), so step 3 "deploy to app-VM over ssh from GitLab CI" with gitlab.com shared runners will not work.

**Fix (insert into 7):**
- The provider list and calculator — by reference to 05 §10.2 and 09 §5.2, without a list of its own.
- On local VMs: (1) the GitLab runner is registered **on the monitoring-VM** (`gitlab-runner register`, docker executor). It polls gitlab.com itself, no inbound access is needed, and the deploy to app-VM goes over the private network. This also clearly demonstrates the runner pull model from A-I1. (2) The learner opens Grafana and Prometheus in their own browser at the local VM's address or via `ssh -L 3000:localhost:3000`. (3) The Telegram alert is outbound HTTPS through the local hypervisor's NAT.
- In the learner's cloud — as now, plus a security group rule "3000/9090 only from the learner's IP".
- Teardown — the wording of No. 6, item 5 (mandatory step, pasting the empty list).

### 13. MAJOR — There is no "reconciliation loop ↔ Ansible ↔ Terraform ↔ GitOps" bridge (R10)
**Where:** 4.4, 5.4, 3.3 A7.

**What is wrong.** R10 builds the reconciliation loop as the central idea of Kubernetes, and operators as "the same loop for CRDs". The IaC block comes after Kubernetes, and this is the best moment to show that Ansible, Terraform and a controller solve the same "desired ↔ actual" problem in three ways. At a job interview the learner distinguishes them precisely by this property.

**Fix — explainer E-CONV (I22), insert into 4.4 or 5.4 as the last screen of the IaC block:**
- Screen 1. Three identical diagrams in a row: on the left "desired" (playbook / `.tf` + state / YAML in etcd), on the right "actual" (hosts / cloud / pods), in the middle the executor. Labels on the lines: Ansible — "started by a human or CI → compare → change → exit"; Terraform — "plan: compare code with state and cloud → apply on confirmation → write state → exit"; controller — "watch → compare → change → watch again, always".
- A "time" toggle, 0–60 min: at minute 20 "someone by hand" changes the actual state in all three columns. Ansible and Terraform stay in drift until the next run (a "minutes in drift" counter grows), the controller fixes it within seconds.
- A toggle "run Ansible via cron every 15 min" / "Argo CD for Terraform-like code (Crossplane, overview)" — drift shrinks. Explanation: "the perpetual loop is a property of the executor, not of the description language".
- "Break it": delete Terraform's state (the column loses knowledge of the actual state), delete etcd (the controller has nothing to compare), bring down SSH (Ansible cannot even look).
- `explain` question: "Why is Argo CD called a controller, but Terraform is not?" Rubric: continuous observation; comparison with the actual state; self-correction without being started by a human.

### 14. MAJOR — R5: color and visual language are not bound to the 08 tokens
**Where:** 3.4 (card statuses), 5.4 (plan icons), 6.4, 0.5.

**What is wrong.** Pipeline statuses, Terraform plan symbols and alert states are not linked to the 08 §5.2 tokens anywhere. Yet in R5 color must carry meaning, and 08 requires duplicating it with shape.

**Fix (insert into 0.5):**

| Entity | 08 token | Shape duplicate |
|---|---|---|
| Job success / failed / running / pending / manual / skipped | `--c-ok` / `--c-err` / `--c-flow` / gray / `--c-warn` / gray dashed | ✓ / ⨯ / spinning arc (in calm mode — ◐) / ◯ / ▶ / ⤼ |
| Plan: `+` / `~` / `-` / `-/+` / `<=` | `--c-ok` / `--c-warn` / `--c-err` / `--c-err` with a `--c-ok` outline / gray | the plan symbol itself is always printed in Plex Mono before the address |
| Ansible ok / changed / failed / skipped | as in Ansible: `--c-ok` / `--c-warn` / `--c-err` / gray | letters `ok`, `ch`, `F`, `s` in the grid cell |
| Alert inactive / pending / firing / resolved | gray / `--c-warn` / `--c-err` / `--c-ok` | a scale bar labeled with the state |
| Metrics pipeline stages (process → TSDB → rule → Alertmanager) | `--c-user` for the application process, a new token `--c-store` for TSDB, `--c-flow` for the flow | a "barrel" shape for storage |

The terminal is the common `terminal` from 08 §3.4; `terraform plan` and `ansible-playbook` output is colored the same way as in the real tools. The learner should recognize these colors at work.

### 15. MAJOR — The textbook (R1) is barely written: there are mechanics, but no coherent theory
**Where:** all "Curriculum" sections.

**What is wrong.** R1 puts a coherent textbook at the foundation. In 06 the curriculum consists of "module → list of keywords" tables and interactives. Nowhere is there a chapter as a chain of statements that shows what the learner will read before the first command. The example with one sentence (`t1` in 0.4) is the only theory text.

**Fix.** For each module, add a "chapter skeleton" of 5–8 statements in the order the concepts are introduced; explainers and drills are tied to the statements. A sample for B2-4 "Three truths":
1. The cloud stores resources and knows everything about them, but does not know that they are "yours".
2. Code describes what resources should be like, but does not know what exists.
3. State is a file where Terraform recorded the link "address in code ↔ ID in the cloud" and the last known attributes.
4. `plan` first refreshes state from the cloud (refresh), then compares the code with state.
5. Hence three kinds of divergence: not in state (`+`), present but different (`~` or `-/+`), present in state but not in code (`-`).
6. Losing state does not touch the cloud, but takes away Terraform's memory; that is why state is stored remotely and locked.
7. State contains attribute values, including secrets — it is a file to be guarded like passwords.

The same format is needed for G2, A1, A3, B1-5, C2, C6, C11 — this is the "core" of the blocks.

---

## Part 3. Technical errors and underspecification

### 16. MAJOR — A PromQL engine "exactly as in Prometheus" without a pinned version; Prometheus 3 behavior is not accounted for
**Where:** 6.1 (evaluation, `promqltest`), C-I6.

**What is wrong.** In Prometheus 3.0 range selectors became **left-open** (a sample exactly on the left boundary is excluded), and the values of the `le` and `quantile` labels are normalized to floating-point form (`le="1"` → `le="1.0"`) ([migration guide](https://prometheus.io/docs/prometheus/3.0/migration)). Example: with a 15 s scrape, a `[1m]` window aligned to samples gives 4 points, not 5. A learner's query with `le="1"` finds nothing in Prometheus 3. `promqltest` tests of different versions expect different results.

**Fix.** Add to 6.1: "The engine matches Prometheus 3.x (the version is pinned in `content/versions.yaml`, `promqltest` tests are taken from the same tag). The generator emits `le` in normalized form (`"0.005"`, `"1.0"`, `"+Inf"`). C-I6 shows the window boundary as left-open, with a label". Add a card `le="1.0"` versus `le="1"` to C-D1.

### 17. MAJOR — Terms are used before they are introduced
**Where:** A2 ("executor… kubernetes"), A3 ("distributed cache (S3)"), A4 ("OIDC tokens"), C-I4 and B1 ("ufw"), 0.1 (Y before L31), 2.2 G7 ("GitFlow… does not combine well with CI" — fine after 07, but "branch protection" requires C05).

**What is wrong.** A2 comes before Kubernetes but names the `kubernetes` executor. "S3" and object storage are not introduced in the graph before IaC. `ufw` is not in the networking graph: it has `iptables`/`nftables` (N17). OIDC is not introduced anywhere.

**Fix.** A2: the `kubernetes` executor — `forward: [K01]` with a card "for now it is enough to know: a runner can run jobs in a cluster, we will come back to this in A7", or move it to A7. A3: "a distributed cache on shared storage" without "S3"; introduce S3 in B2-10 as `I-object-storage`. Replace `ufw` with `nftables`/`iptables` from N17, or add the concept to 03. OIDC in A4 at L2 — `forward` with a card.

### 18. MAJOR — Models of "heavy" commands are underspecified; there is no behavior list and no divergence check
**Where:** 3.1 (`npm ci`, `docker build`, `docker push`), 8.2.

**What is wrong.** `docker build`/`push` in a job is dsim and the registry from 04 (09 §1.7), not a separate 06 model. For `npm ci`/`pip install`/`go build` it is not listed which errors the model can reproduce. Without this, a plausible log will turn into a script. In the 8.2 table these models have no reference.

**Fix.** (a) `docker build/push/pull` in a job is executed by dsim (04) with the image profile `docker:27` and the service `docker:dind`; the log comes from dsim. (b) Model behavior table:

| Model | Reads | Errors it reproduces |
|---|---|---|
| `npm ci` | `package.json`, `package-lock.json` | lock does not match `package.json` (`npm ERR! cipm can only install packages when your package.json and package-lock.json are in sync`), no lock file, `~/.npm` cache present/absent |
| `pip install -r` | `requirements.txt` | nonexistent version (`No matching distribution found`) |
| `go build` | `go.mod`, `*.go` | syntax error from a fixture, no `go.sum` |

(c) Add a row to 8.2: "tool models → reference logs from real `npm`/`pip`/`go` on the same fixtures; error lines are compared".

### 19. MAJOR — Licenses of documentation fragments for step 2 of the ladder (R2)
**Where:** 8.1 (stack), the new section from No. 4.

**What is wrong.** Step 2 shows a fragment of a documentation page inside the trainer. The sources have different licenses:
- Git man pages — GPL-2.0;
- Ansible module documentation — in the module sources, GPL-3.0;
- GitLab documentation — CC BY-SA 4.0;
- Prometheus documentation — Apache-2.0;
- the HashiCorp documentation site has its own terms of use.

Such texts cannot be embedded without taking the licenses into account.

**Fix.** Add a "Documentation fragments" row to 8.1: they are stored as a separate data package `docs-snippets/` with a per-source license file; GPL and CC BY-SA fragments carry the source and license under the fragment; for HashiCorp — only a link and our own retelling for the `edu` provider (we write its documentation ourselves, the anatomy is the same); `ansible-doc` in ansim is generated from `ansible-doc -j` of real ansible-core in CI and licensed as GPL-3.0 data.

### 20. MAJOR — Presentable exams and AI at step 4 are not described in 09 terms
**Where:** 2.5, 3.6, 4.6, 5.6, 6.8.

**What is wrong.** Nowhere is the exam's `envs` (sim/v86/vm) specified, nor is it said whether the result is signed and which documentation is open (R2, step 5). The AI answer "where did you look?" requires a separate mentor mode.

**Fix.** For every exam: `envs: [sim]` for block exams, `[vm]` + `attest` for presentable ones (C13 on a VM — the practicum); `docs_allowlist: [docs.gitlab.com/ci, …]`; `ai: off`. For exercises with `doc_step: 4` — `ai.mode: socratic-docs` with the system instruction "Do not name the command, flag or key. Ask where the learner looked. Name the page section (SYNOPSIS/OPTIONS/Argument Reference) and the help command (`man`, `--help`, `ansible-doc`, `terraform -help`), but not the line". Align the mode with 01 §14 and 09 §4.5.

---

## Part 4. Minor errors

### 21. MINOR — Ansible precedence ladder: "8 steps", but 9 are listed, and B1-I6 says "nine"
**Where:** 4.3 B1-10, 4.4 B1-I6. **Fix:** "9 steps" everywhere.

### 22. MINOR — `needs` and `optional` in A-L
**Where:** 3.5 A-L1…A-L20 ("`needs` on a job from a later stage without `optional`").
`needs:optional` allows a reference to a job that may be absent from the pipeline. It does not allow a reference to a job from a later stage: that is an error in any case. **Fix:** two separate fragments — "`needs` on a job from a later stage" and "`needs` on a job excluded by `rules`, without `optional: true`".

### 23. MINOR — Empty result in the monitoring level check
**Where:** 6.2 item 1. "At zero — an empty result or 0, depending on the task's meaning" cannot be checked with `promql_equiv`. **Fix:** the reference `count(up{job="api"} == 0) or vector(0)` and the rule `empty_equals_zero: true` in `promql_equiv`.

### 24. MINOR — `promtool` and `amtool` syntax
**Where:** 0.3, 6.4 C-I9. The correct forms are `promtool query instant <url> '<expr>'` and `amtool config routes test --config.file=alertmanager.yml severity=critical team=payments`. The Stand should accept both forms, but the lesson should show the full one.

### 25. MINOR — The runner log is incomplete
**Where:** 3.1. In a real log, the script is followed by `Saving cache for successful job` and `Cleaning up project directory and file based variables`, and the line about the missing distributed cache URL continues with the phrase `Instead a local version of cache will be extracted.` Without these lines, A-I3 "Two shelves" does not teach reading cache saving.

### 26. MINOR — An unconfirmed claim in the risks
**Where:** 8.3, the line about Shai-Hulud and `@cdktf/hcl2json` ("not verified"). Do not keep unconfirmed statements in a design document: either verify and give a link, or keep the general rule "we build wasm ourselves from source" without mentioning the package.

### 27. MINOR — tfsim size
**Where:** 5.1, 8.1. `hcl/v2` + `go-cty` + functions + core, compiled with standard Go, usually yield 10–15 MB of wasm (3–4 MB gzip), not 6–8 MB. The 09 budget is up to 2.5 MB. **Fix:** state "target ≤ 2.5 MB gzip; if it does not fit — TinyGo or `-ldflags=-s -w` + `wasm-opt -Oz`; measure in the phase 0 spike (09 §7)".

### 28. MINOR — DORA metric names
**Where:** 1.2 screen 3, 9. "Time to restore" → "time to recover from a failed deployment (failed deployment recovery time)", as in 07 and on dora.dev. Closed together with No. 7.

### 29. MINOR — Neutrality of scenarios
**Where:** 2.3 G-I4 ("colleague bot"), 5.4 B2-I6, 6.6 item 1 (pager sound). A bot as a source of events is acceptable. But in process explainers (R4) it must not have a name, lines or a motive: "commit from `bot@forge`, 14:02" instead of "Petya, because it was urgent". Keep the pager sound off by default, as in 05 §12.

### 30. MINOR — The experienced level and entry at step 3 (R2)
**Where:** 2.1, 3.2, 4.2, 5.2, 6.2. Per R2, an experienced learner starts at the third step of the ladder. This means that for drills of the "exp." level, fragment hints (step 2) are hidden by default. Add a rule to 0.4: `hints[].kind: doc_fragment` is shown only when `doc_step ≤ 2` or on explicit request, with a mark in the attempt log.

---

## Summary for the author

The order of work I would suggest: No. 1–3 (framework) → No. 6 and No. 9–10 (the junction with Kubernetes; I am ready to proofread) → No. 4–5 (the ladder and explainers; the tables and storyboards above can be pasted almost verbatim) → the rest. The items that affect 01, 05, 07 and 09 (new ids, stage 3a/3b, A0 to 07, the `lab-ansible` image, fact scopes) must also be carried into those documents. Without this, the build with the `introduces/uses` check will not succeed.

Sources verified during the review: [Helm 4 overview](https://helm.sh/docs/overview), [Helm 3 End of Life](https://helm.sh/blog/helm-v3-end-of-life), [Prometheus 3.0 migration guide](https://prometheus.io/docs/prometheus/3.0/migration).
