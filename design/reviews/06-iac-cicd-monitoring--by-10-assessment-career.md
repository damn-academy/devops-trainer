# Review of 06-iac-cicd-monitoring.md (reviewer: the author of 10-assessment-career.md, the assessment, exams and career role)

Reviewer: the "assessment, exams, career" role (author of `10-assessment-career.md`). Date: 18.11.2026.
Read in full: 06. For cross-checking: 01 (concept graph, levels, block order), 02, 03, 04, 05 (section 10, the real-infrastructure stage), 07 (CI/CD and DORA), 08 (engine, visual language), 09 (tiers, facts → predicates, `trainer-check`), 10.

## Verdict

The engineering part of the document is strong, in places the best in the set. The pipeline simulator with a shared IR for GitLab and GitHub, `promql_equiv` on K datasets with edge cases, the "three truths" of Terraform, the idempotency visualizer, incident C13 with evidence gathered through queries, reference runs of the simulators in CI: all of this can be taken into work without rework. As a textbook for three levels the document is not ready yet, and four systemic problems stand in the way. First: the place of Git, YAML and IaC in the route contradicts 01 and 05, and module A0 duplicates the methodology block (07) and itself violates the term-order rule. Second: the owner's requirements R2 (documentation ladder), R3 and R4 (process explainers with parameters and "break it") and R12 (Terraform and Ansible in the third Kubernetes stage) are not covered at all. Third: several technical statements are wrong (`-target`, Ansible modules outside ansible-core, the capabilities of isomorphic-git, the `default:` syntax in GitLab). Fourth: level checks and exams are not brought to the common format from 01 and 10. Below are 24 findings: 5 blocking, 12 major and 7 minor. The missing content is written so that it can be pasted into the document as is.

---

## Blocking

### 1. BLOCKING. The place of Git, YAML and IaC in the route contradicts 01 and 05, and G6 uses HTTP before it is introduced

**Where:** 0.1 "Place of the blocks in the overall sequence", 0.2, 2.2.

**What is wrong.**
- 06 puts Git and YAML "after Linux, before networks". In 01 (section 5 and graph C01–C06) Git is the start of the "CI/CD with Git" block after Docker, and YAML is concept L31 of the Linux block. In 05 the GitOps concept has the prerequisite `linux:git`, that is, the author of 05 assumes Git is introduced in the Linux block. That gives three different answers to the same question.
- In the 01 graph, C04 ("remote repository, push/pull") has the prerequisite N14 (HTTP). If G comes before networks, module G6 violates the graph, and the build will fail on the `introduces/uses` check.
- The argument in 06 that "Dockerfile and compose live in repositories" is correct, but it only implies that local Git (C01–C03) is needed before Docker. Remote, MR and a forge are not needed before Docker.
- Ansible before Terraform (0.1) is an acceptable reordering within a block (01, 6.2), but in 06 it is not justified by the graph at all, and I13 requires I05 and I10 at the same time. This must be written down explicitly.

**Fix (proposed as a decision for 01, 05 and 06).**

| Position | Module | Graph concepts |
|---|---|---|
| Linux, after L21 (scripts) | **Y1. YAML and JSON** (it is absent from 02, although in 01 it is L31; we move module Y from 06 into Linux as is) | L31 |
| Linux, last module (or the Linux → Networks bridge) | **G1–G5. Local Git**: repository, commit, index, history, branch, merge, conflict, `.gitignore` | C01, C02, C03, C06 |
| After networks (N14) | **G6–G7. Remote, forge, MR**: the opening modules of the CI/CD block | C04, C05 |
| After Docker | A1–A6 | C07–C12, C15 |
| After Kubernetes | A7 (without GitOps, see finding 15) | C13, C14 |
| After Kubernetes, stages 1–2 | B1 Ansible → B2 Terraform | I01–I14 |
| After B1 and B2 | **Kubernetes, stage 3** (kubeadm on 3+ VMs ordered by Terraform and configured by Ansible), see finding 4 | K31, K32 + I05, I10 |

In 05, rename the dependency `linux:git` to `C02` (commit) and `C05` (MR) according to the 01 graph. In table 0.2 of this document, give block G graph IDs (C01…C06, C15) instead of just verbal names (see finding 14).

### 2. BLOCKING. The documentation ladder (R2) is absent from all five blocks

**Where:** the whole document. There is `ansible-doc` in the Sandbox (0.3) and links to sources at the end of sections, but there are no steps, no tasks and no behavior for the AI mentor.

**What is wrong.** R2 requires five steps for each block, forced use of the documentation at the fourth step and "official documentation only" at the fifth. The experienced level starts at the third step. 06 has none of this, and the AI mentor (0.6) so far only "explains and does not give the solution" and does not send the learner back to the documentation.

**Ready text for a new section 0.7 "Documentation ladder".**

Common rules for G, A, B1, B2, C:

| Step | Where | What the learner sees | How it is checked | Levels |
|---|---|---|---|---|
| 1. Glimpse | All lessons of the first modules of the block | Under a command or flag in the text, a lowercase label "→ from the documentation" with a link to the exact anchor (`git-scm.com/docs/git-commit#Documentation/git-commit.txt--m`). Opening it is optional | Not checked; a click is written to the log (`doc.open`) | beginner |
| 2. Excerpt as a hint | Level 1 hint in the drills | Instead of hint text, a clipping of the real page (man, `ansible-doc`, a GitLab reference page) with the needed line highlighted and the page sections labeled (NAME / SYNOPSIS / OPTIONS / EXAMPLES; for `ansible-doc`: OPTIONS / RETURN / EXAMPLES; for GitLab: Keyword type / Supported values / Example) | The task is credited as usual; in FSRS it is "Hard" if the hint was opened | beginner, intermediate |
| 3. "Find the flag" | Separate micro-tasks in each module | Only a link to the page, without a clipping: "Find in `git help log` the flag that shows the branch graph" | The result is checked by execution (`fill` by effect), not by the text of the flag | all; experienced starts here |
| 4. Enforcement | Drills of the second half of the block and the block exam | The task requires a flag or parameter that is not in the theory; there are no hints. To the question "how?" the AI mentor only answers "Where did you look?" and names a source (`man`, `--help`, `ansible-doc`, `terraform <cmd> -help`, the GitLab reference, `promtool --help`, prometheus.io/docs) without the ready answer | Regular check; plus a "where I found it" field with a link or command; an empty field is not credited | all |
| 5. Exam with documentation | Final block exams | A built-in documentation browser with a list of allowed domains (as in the CKA); some tasks are built on things that are not in the course | By environment state | all |

Add the AI mentor's behavior at step 4 to 0.6 as a separate system instruction: `doc_ladder_step: 4` → "do not name the flag, parameter or function; ask where the learner searched; name one official source and the page section; if the learner quoted the right line, confirm its meaning". The list of allowed domains at step 5: `git-scm.com`, `docs.gitlab.com`, `docs.github.com`, `docs.ansible.com`, `developer.hashicorp.com`, `opentofu.org/docs`, `prometheus.io/docs`, `grafana.com/docs`.

Tasks by step (one example per step and block; the rest are written following the pattern):

| Block | St. 1 (glimpse) | St. 2 (clipping) | St. 3 (find) | St. 4 (enforcement) | St. 5 (exam) |
|---|---|---|---|---|---|
| G | `git commit -m` → `git-commit` OPTIONS | G-D1: the hint is a clipping of `git-restore(1)` with the `--staged` line | "Find in `git help log` the flag that limits history to one file while following renames" → `--follow`; check: the output contains a commit from before the rename | "Show who last changed line 12 in `about.html`, ignoring whitespace changes" (`blame -w -L 12,12`; the theory only covers `blame`) | "Find the commit that broke `test.sh` in ≤ 7 steps" (`bisect run` is only named in the theory) |
| A | `artifacts:paths` → reference anchor | A-D4: clipping of `tags` from the reference | "Find the keyword that deletes artifacts after 1 hour" → `expire_in` (`yaml_path`) | "The job must run only if `Dockerfile` changed **and** this is an MR" (`rules:changes` + `$CI_PIPELINE_SOURCE`; the theory covers `changes` only for branches) | Exam A: `interruptible` or `rules:exists`, which are not in the course |
| B1 | `apt` → `ansible-doc ansible.builtin.apt` | B1-D2: clipping of OPTIONS of the `template` module with the `mode` line | "Find in `ansible-doc ansible.builtin.lineinfile` the parameter that creates the file if it does not exist" → `create: true`; check: `run` on a host without the file | "Install a package from a .deb by URL" (`apt: deb:`; not in the theory) | Exam B1: `ansible.builtin.cron` or `ansible.builtin.get_url` with `checksum` |
| B2 | `resource` → language/resources | B2-D3: clipping of `validation` from language/values/variables | "Find the function that splits `10.0.0.0/16` into /24s" → `cidrsubnet`; check: `terraform console` | "Make removing a DNS record from the code not delete it in the cloud" (a `removed` block with `lifecycle { destroy = false }`; `removed` is only named in the theory) | Exam B2: a `check` block or `precondition` |
| C | `rate` → querying/functions#rate | C-D4: clipping of `histogram_quantile` | "Find the function that returns 1 if a series has been absent for 10 minutes" → `absent_over_time`; `promql_equiv` | "Show the samples whose value changed more than 3 times in an hour" (`changes`; not in the theory) | Exam C: `label_replace` or `time() - process_start_time_seconds` |

Add fields to the exercise format (0.4):

```yaml
doc_ladder:
  step: 3                                   # 1..5
  source: { kind: man, page: git-log, anchor: "--follow" }   # man | cli-help | ansible-doc | web
  allow_hint_excerpt: false                 # true only for step 2
  require_where_found: false                # true for step 4
ai_policy: redirect-to-docs                 # for step 4
```

Content linter: a block has at least 3 step-4 tasks and at least 2 step-5 tasks; a step-4 task must use a flag or parameter that is not in any `introduces` of the route (checked against the flag dictionary); a step-5 task cannot appear before the block exam.

### 3. BLOCKING. There are no process explainers in the spirit of R3 and R4: there are scroll-throughs without parameters, without "break it" and without rewind

**Where:** 0.5 (scroll.ts), A-I1, B2-I7, C-I3, G-I5, B1-I1.

**What is wrong.** R3 requires at least four processes in these blocks: git push → deploy, terraform plan/apply + state, an idempotent Ansible run, scrape → store → PromQL → alert → notify. Per R4, each process must have sliders and toggles, instant recomputation with an explanation of the change, a "break it" button on every component and rewind forward and backward. In 06 the processes are shown as "scrolling walks through the steps", without a single parameter. The monitoring chain is broken: C-I3 goes as far as PromQL, and C-I9 starts with an alert rule, and there is no "rule → Alertmanager → notification" path as a process. The foundation exists in 08: `stepper` (3.1), `breakit` (3.5), the `SimEvent` bus. But 06 does not use these primitives, and there are no bus event types for the pipeline, Terraform and Prometheus.

**Fix. Five storyboards; each is `kind: mechanism` with `widget: stepper` + `diagram` + `breakit`. One screen is one idea, labels on the lines, clicking any element opens a card.**

Add events to the 08 bus (3.0):

```ts
| { t: 'ci.pipeline'; id: string; ref: string; source: string; status: string }
| { t: 'ci.job'; id: string; job: string; status: 'created'|'pending'|'running'|'success'|'failed'|'skipped'|'manual'; runner?: string }
| { t: 'ci.cache'; key: string; hit: boolean; bytes: number }
| { t: 'ci.artifact'; job: string; paths: string[]; bytes: number }
| { t: 'tf.step'; phase: 'parse'|'graph'|'refresh'|'diff'|'apply'|'state.write'; addr?: string; action?: string }
| { t: 'ans.task'; host: string; task: string; status: 'ok'|'changed'|'failed'|'skipped'; diff?: string }
| { t: 'prom.scrape'; target: string; ok: boolean; samples: number; ms: number }
| { t: 'prom.rule'; name: string; state: 'inactive'|'pending'|'firing'|'resolved'; value: number }
| { t: 'am.notify'; group: string; receiver: string; alerts: number; reason: 'group_wait'|'group_interval'|'repeat_interval' }
```

**E-CI. "The path of a commit: from `git push` to production"** (replaces A-I1).

| Screen | On the diagram | Parameters and toggles | "Break it" | Explanation on change |
|---|---|---|---|---|
| 1 | Laptop → forge: a `git push` arrow labeled "objects + ref main" | — | "push rejected (not fast-forward)" → the arrow turns red, the terminal shows `! [rejected]` | "The forge accepts a push only on top of its own history" |
| 2 | The forge reads `.gitlab-ci.yml` → a pipeline appears, jobs in status created | Event: push to a branch / MR / tag (toggle) | "pipeline file with an error" → `yaml invalid`, no pipeline | When the event changes, the set of jobs is recomputed by `rules`; on the right, a list "why this job is present / absent" |
| 3 | The pending queue ← runners poll the forge (line label "poll every 3 s") | Number of runners 1–4, `concurrent` 1–4, runner tags | "turn off all runners" → pending forever, text `This job is stuck…` | The "queue wait time" counter is recomputed immediately |
| 4 | Runner: pull image → clone → restore cache → script → upload artifacts | Cache: present/absent; clone depth | "image does not exist", "cache unavailable" | The job's time bar is split into segments; without cache the `npm ci` segment grows, and this is labeled |
| 5 | The `dist/` artifact travels from `build` to `deploy` (an arrow labeled "through the forge, not through the runner") | `needs` on/off | "artifact not declared" → `deploy` fails | With `needs` on, the pipeline time bar shrinks, and by how much is shown |
| 6 | `deploy` → staging environment → production (button) | `when: manual` on production on/off | "tests run after the deploy" → an unverified version on staging | The label changes to "Continuous Delivery" or "Continuous Deployment", linking to M15 and M16 from 07 |
| 7 | The status returns to the MR | — | — | — |

**E-TF. "`terraform plan` and `apply`: code, state, cloud"** (B2-I1 and B2-I7 merge into one process).

| Screen | On the diagram | Parameters | "Break it" | Explanation |
|---|---|---|---|---|
| 1 | `.tf` files → parsing → resource graph | Add or remove a reference between resources | "cycle" → `Cycle: …` in red | The graph is rebuilt, parallel branches are highlighted |
| 2 | Refresh: requests to the cloud API by IDs from state | Drift in the cloud on/off (the `cores` field changed in the console) | "state deleted" → refresh is empty | `Note: Objects have changed outside of Terraform` appears on the State ↔ Cloud line |
| 3 | Diff: code ↔ refreshed state → symbols `+ ~ - -/+` | Changed attribute: `name` / `zone` / `image_id` / `size_gb` ↓ | — | The symbol and `# forces replacement` are recomputed immediately; next to them: "why this attribute cannot be changed in place" |
| 4 | Plan → confirmation | `create_before_destroy` on/off | — | Order `-/+` ↔ `+/-` and the line "VM downtime: yes/no" |
| 5 | Apply: API calls in graph order, `-parallelism` | `-parallelism` slider 1–10 | "API quota exhausted on the 3rd resource" | State is written after each resource: you can see that after the failure two of five are already in state |
| 6 | Final state: `serial` +1, `lineage` unchanged | — | "second apply without locking" → a lost record | Link to B2-I6 |

**E-ANS. "An idempotent Ansible run"** (B1-I3 + B1-I4 as a process).

| Screen | On the diagram | Parameters | "Break it" | Explanation |
|---|---|---|---|---|
| 1 | Control machine → ssh → hosts (arrows labeled "ssh + python module") | Number of hosts 1–6, `forks` 1–5 | "the host has no python" → `UNREACHABLE`/`MODULE FAILURE` | The number of simultaneous arrows = `forks` |
| 2 | Gathering facts | `gather_facts` on/off | — | Without facts, a task with `when: ansible_facts.os_family` fails; where is shown |
| 3 | Task: the module compares desired with current → ok / changed | Task type: `lineinfile` / `shell >>` / `template` with `ansible_date_time` | — | With `shell >>` the file grows by a line on every run; the "runs" counter 1–5 can be rewound |
| 4 | `notify` → handlers queue → execution at the end of the play | — | "the task after notify failed" → handler not run | The `--force-handlers` toggle shows the opposite |
| 5 | PLAY RECAP | `strategy: linear / free`, `serial: 1 / all` | "the second host breaks with `serial: 1`" | Hosts 3–4 stay untouched, label "this is what `serial` is for" |

**E-MON. "From a metric to a message to the on-call engineer"** (C-I3 + C-I9 as one chain).

| Screen | On the diagram | Parameters | "Break it" | Explanation |
|---|---|---|---|---|
| 1 | Service process: an in-memory counter grows | Load, requests/s | "process restarted" → counter at 0 | — |
| 2 | Prometheus → HTTP GET `/metrics` (line label "every `scrape_interval`") | `scrape_interval` 5 s / 15 s / 60 s, `scrape_timeout` | "target unreachable" → `up=0` | The sample tape becomes sparser or denser |
| 3 | TSDB: a sample with the scrape timestamp | `user_id` label on/off | — | Series and memory counter (cardinality) |
| 4 | PromQL: `rate(x[w])` | Window `w` 30 s – 15 min | "window < 2 intervals" → empty result | The `rate` line smooths out or disappears, with an explanation of why |
| 5 | Alert rule: `expr`, `for` → inactive / pending / firing | `for` 0 – 15 min, threshold | "a single missed scrape" | Without `for` the alert fires on a spike; this is visible on the scale |
| 6 | Alertmanager: route → group → receiver | `group_wait`, `group_interval`, `repeat_interval`, `group_by` | "no route for severity" → default receiver | The "messages to the on-call engineer per night" counter is recomputed instantly |
| 7 | Notification to the on-call engineer and resolved | `send_resolved` on/off | "inhibit_rules turned off" → 12 messages instead of one | — |

**E-REC. "Four reconciliation loops"**: a bridge from R10 to IaC, lesson B2-4 or B1-5. One screen has four identical columns "desired ← comparison → actual": Ansible (compares on every run, a human starts it), Terraform (compares on `plan`, a human applies), a Kubernetes controller (compares all the time), Argo CD (compares all the time, takes the desired state from Git). The toggle "someone changed it by hand" shows how and when each of the four notices drift. Per 01, IaC comes after Kubernetes (I01 requires K02), so K03 has already been introduced and the bridge is legitimate. This is the best answer to the interview question "how is Terraform different from Kubernetes".

For Git, keep G-I5 ("what is inside a commit"), but also with a stepper: rewind, a slider "change one line in one file" with recomputation of which objects got new oids (blob, tree, commit) and which stayed the same.

### 4. BLOCKING. The third Kubernetes stage (R12) does not rely on Terraform and Ansible, and given the block order it cannot rely on them

**Where:** section 7, section 9 (dependencies), 05 section 10.

**What is wrong.** R12 requires that in the third stage Terraform orders the VMs and Ansible configures them. In 05 the VMs are created with `hcloud` and `yc` commands and a button; in 06 the practicum from section 7 is a separate project with Docker on an app-VM. Per 01, IaC (block 7) comes after Kubernetes (block 6), so in the third Kubernetes stage the learner does not know Terraform yet. 06 has no Terraform modules for the course providers, no Ansible roles for kubeadm, and no cleanup step via `terraform destroy` with a check.

**Fix.**
1. The third Kubernetes stage (tracks R3 and R4 from 05) opens after B1 and B2. Tracks R1 and R2 (k3s) stay in the Kubernetes block on `hcloud`/`yc`/the button. In 01, add the edge K32 → I05, I10.
2. In 06, add section 7.2 "Infrastructure for the cluster". Ready text:

> The learner writes (rather than receives ready-made) the root module `infra/` and the role `k8s-node`. The course provides only the directory skeleton and the `providers.yaml` file from 05 (10.2).
>
> **Terraform.** Module `modules/node` (inputs: `name`, `role` = control-plane|worker, `size`; outputs: `private_ip`, `public_ip`), a root module with `for_each` over `var.nodes`, a network or subnet, a security group with kubeadm ports (6443/tcp from the learner's address and within the subnet, 2379–2380/tcp, 10250/tcp within the subnet; for Cilium, 4240/tcp and 8472/udp VXLAN within the subnet), the label `trainer=devops` on all resources, `output "inventory"` in the Ansible YAML inventory format. Providers of the learner's cloud: `yandex-cloud/yandex` (through a mirror), `hetznercloud/hcloud` and others from `providers.yaml`; a learner without a cloud account writes the same module for the `lab` provider of the in-tab cloud (00 §6.13). State is in a cloud bucket with locking; for the in-tab cloud, in its object storage.
>
> **Ansible.** Role `k8s-node`: disable swap, the `overlay` and `br_netfilter` modules, sysctl `net.ipv4.ip_forward=1`, containerd with `SystemdCgroup = true`, the `pkgs.k8s.io` repository with a pinned minor version, the `kubelet`/`kubeadm`/`kubectl` packages with the version held. Role `k8s-control-plane` (`kubeadm init` with `creates: /etc/kubernetes/admin.conf`), role `k8s-worker` (`kubeadm join` with `creates: /etc/kubernetes/kubelet.conf`). The second run gives `changed=0`. This is exactly the exercise on idempotency of `command` via `creates` from B1-5, only on real machines.
>
> **Cost.** Before `apply` the trainer shows a calculation from `providers.yaml`: `VMs × price_per_hour × hours + IPv4 × hours` and next to it "if you forget it for a month". The numbers come from the same table as in 05 and 09 and are not written into the lesson.
>
> **Check.** `trainer-check run --track r3-iac` (the agent from 09, 5.4) collects facts: `terraform state list` and `terraform show -json` (the learner runs them alongside, the agent reads the file), a repeat run of `ansible-playbook --check` with the JSON callback (`ANSIBLE_STDOUT_CALLBACK=json`), the cluster nodes. Predicates: state contains exactly N `node` resources with the label `trainer=devops`; `--check` gives `changed=0` on all hosts; `k8s.nodes#=3`, all Ready.
>
> **Mandatory cleanup.** The track is not closed until three things are done: `terraform destroy`; `terraform state list` is empty; the output of `hcloud server list -l trainer=devops -o json` or `yc compute instance list --filter 'labels.trainer="devops"' --format json` is empty (the trainer accepts pasted JSON). For the in-tab cloud (the `lab` provider) and for local VMs on one's own computer, `destroy` is mandatory too: it is part of the skill.

3. Reconcile section 7 (the practicum with Docker on an app-VM) with pet projects 1, 3, 5, 6 and part A of the final exam from 10 (see finding 13), so that the learner does not have two similar projects.

### 5. BLOCKING. Module A0 duplicates the methodology block (07) and violates the term order

**Where:** section 1 (A0), 0.2 (row A0), 3.3 (A5).

**What is wrong.**
- The definitions of CI, Continuous Delivery and Continuous Deployment and the DORA metrics are M14–M17 and M13 of the 01 graph, and 07 already introduces them (M7, M8, interactives E10 "Five instruments", P-O2). 06 introduces them a second time, and differently: 06 gives "four DORA metrics, rework rate for the experienced", while 07 gives everyone five metrics per dora.dev, including the deployment rework rate. The learner will get two different answers to an interview question.
- The A0 quiz (screen 4) contains "merge into main", "release branch", "push", "green pipeline", "CI server". At step 01 Git has not been introduced yet (C03, C04), and the 01 vocabulary linter (6.1) will fail the build.
- Screen 2 uses "artifact", which is not in A0's `introduces` list (artifact is C09).
- Screen 1 "Friday release" with four developers and a failure on Saturday, and screen 2 with a "little man" at a button, are a plot and characters, which R4 forbids.

**Fix.**
1. Remove A0 from 06. In 0.1, write: "CI/CD methodology: concepts M13–M17 are introduced by the methodology block (07); block A refers to them".
2. Rewrite the A0 quiz tasks without Git and hand them over to 07, for example: "The team deploys every verified version to prod with a button; the team lead presses the button once a day" → Continuous Delivery; "Every change, after the checks, ends up in prod by itself within 20 minutes" → Continuous Deployment; "Build and tests are run once a week for everything that has accumulated" → not CI.
3. Move versions of the same questions with Git and YAML to A5 and A-I6. Branches, MRs and `when: manual` are already introduced there, and the questions are legitimate there.
4. The comparison "integration once a month / every day" (A0, screen 3) already exists in `flowlab` (07); a separate copy is not needed.

---

## Major

### 6. MAJOR. Levels and level checks are not in the 01 and 10 format

**Where:** 2.1, 3.2, 4.2, 5.2, 6.2.

**What is wrong.** In 06 the levels are called "beginner / intermediate / experienced", and the criterion is "all tasks of the level, up to two attempts each". Per 01 (4.1–4.3) the levels are L0/L1/L2, the criterion is ≥ 80% on the first attempt plus all key tasks, with no credit for "guessed" answers, and a retake after 72 hours. Per 10 (3.5), every L1 and L2 check needs at least two practical key tasks in the sandbox. In addition, 06 and 01 have different task sets for the same block: for IaC, 01 has five L1 tasks and six L2, 06 has six and seven; for monitoring, 01 has five and five, 06 has five and eight. Two "level checks" for one block are unacceptable. There is no `key` marker either. Questions 2–3 of check A and 3 and 7 of check B2 are pure theory that a programmer answers confidently without having done it by hand.

**Fix.** Take the 06 sets as the basis (they are more concrete) and hand them to 01 as the single source. Bring them to the bank record format from 10 (3.1): `level: [L1]`, `key: true` on at least two practical tasks, `concepts` as graph IDs, a `misconception` for every wrong option. Example for B2 L2:

```yaml
id: iac.placement.l2.q05
block: iac
level: [L2]
kind: task
key: true
concepts: [I07, I06]
q: { ru: "Три VM заданы через count по списку [\"a\",\"b\",\"c\"]. Удалите b так, чтобы c не пересоздалась.", en: "..." }
checks:
  - plan_expect: { destroy: ["edu_vm.this[\"b\"]"], create: [], update: [] }
  - forbid: { cmd: "terraform apply -target" }
```

(The `ru` string reads: "Three VMs are defined via count over the list [\"a\",\"b\",\"c\"]. Remove b so that c is not recreated.")

Who the "experienced" learner is in 06 (a programmer without operations experience) matches L2 in 01 for Linux and Git, but not for IaC and monitoring: in 01, L2 in monitoring is someone who "set up alerts or worked with Zabbix", while in 06 it is a programmer who "added metrics to code". One definition is needed. I propose the definition from 01, and describe the "programmer" from 06 as a typical L1 profile in monitoring.

### 7. MAJOR. Practical exams are not in the common format from 10 (section 6)

**Where:** 2.5, 3.6, 4.6, 5.6, 6.8.

**What is wrong.** There are no weights, no `critical`, no 30% `explain` share, no "all critical + ≥ 70%" threshold, no seed-based variants (except C13), no "with assistant / without" mode. Exam G lasts 40 minutes, while the common format requires 60–120. The phrase "AI is off" is true only for the built-in mentor: per 10 (section 7), the learner chooses the mode themselves, and the mode is written to the record.

**Fix: exam B1 in the 10 specification format (the other blocks follow the pattern).**

```yaml
id: exam-ansible
block: iac
time_limit_min: 90
story: { ru: "Вы вторую неделю в «Ларьке». Под новое приложение выделили три сервера; тимлид оставил карточки.", en: "..." }
sandbox: { image: ansim-3hosts, seed: "{{seed}}" }     # app1 Debian, app2 RedHat family, db1 Debian
tasks:
  - id: t1
    weight: 30
    card: { ru: "Роль common: пользователь deploy с ключом, пакеты curl и htop, на всех хостах.", en: "..." }
    checks:
      - { id: t1a, critical: true, state: "ansible.hosts[*].users[name=deploy]" }
      - { id: t1b, points: 10, idempotent: true }
      - { id: t1c, points: 5, forbid: { yaml_path: "$..shell", matches: "useradd|apt-get|yum" } }
  - id: t2
    weight: 25
    card: { ru: "nginx на app-хостах проксирует на порт приложения из group_vars/app; смена порта — ровно один reload.", en: "..." }
    checks:
      - { id: t2a, critical: true, state: "http.app1.status=200 && http.app2.status=200" }
      - { id: t2b, points: 15, run: { change: "group_vars/app.yml:app_port=8081" }, expect: { handler_runs: { app1: 1, app2: 1 } } }
  - id: t3
    weight: 15
    variant_of: [fault-handler-typo, fault-when-family, fault-vault-missing, fault-become]
    card: { ru: "После вашего прогона пришла жалоба: на одном из app-хостов сайт старый. Найдите и устраните причину.", en: "..." }
    checks: "{{fault.checks}}"
explain:
  weight: 30
  questions:
    - { id: e1, q: { ru: "Тимлид: «Почему второй прогон ничего не меняет, и зачем нам это?»" }, key_points: [desired-state, module-checks-current, changed-zero-as-test] }
    - { id: e2, q: { ru: "Где лежит пароль базы и кто может его прочитать?" }, key_points: [vault-encrypted, key-outside-repo, ci-variable] }
pass: { critical: all, total_min: 70 }
doc_ladder: { step: 5, allowed: [docs.ansible.com] }
```

(Glosses of the `ru` strings: story: "It is your second week at «Ларёк» (the "Kiosk" company). Three servers have been allocated for a new application; the team lead left cards."; t1: "Role common: user deploy with a key, packages curl and htop, on all hosts."; t2: "nginx on the app hosts proxies to the application port from group_vars/app; a port change means exactly one reload."; t3: "After your run a complaint came in: on one of the app hosts the site is old. Find and fix the cause."; e1: "Team lead: 'Why does the second run change nothing, and why do we need that?'"; e2: "Where is the database password stored and who can read it?")

Turn the requirements "role `postgres` with vault" and `ufw` from the current 4.6 into weighted tasks. Remove `ufw` or introduce it beforehand (finding 11). Rework exam G to 60 minutes and add a third task with breakage variants: lagging behind main, a conflict, a secret in history, a lost commit (reflog).

### 8. MAJOR. isomorphic-git cannot do even half of the commands listed in 0.3

**Where:** 0.3 (command table), 2.1 (tasks 4 and 5), G-D3, G8, G9, 8.1.

**What is wrong.** The isomorphic-git reference (checked on 18.11.2026 at isomorphic-git.org/docs/en/alphabetic) has no `rebase`, `cherry-pick`, `revert`, `reset`, `reflog`, `diff`, `show`, `blame`, `bisect`, `restore`, `switch`. The library does not maintain a reflog at all, so task 5 of the level check ("recover the commits after `reset --hard`") cannot be done with isomorphic-git alone. `merge` does not detect renames, so the third conflict in G-D3 ("renamed file") cannot be reproduced. The words "a wrapper over isomorphic-git" in table 0.3 create the false impression that this is ready.

**Fix.** In 0.3, split the commands into "from the library" (`init`, `add`, `commit`, `log`, `branch`, `checkout`, `merge`, `tag`, `stash`, `status`, `push`/`fetch` through our own wrapper) and "our implementation on top of `readCommit`/`writeCommit`/`writeRef`/`walk`": `reset` (soft/mixed/hard via `writeRef` + `resetIndex` + checkout), `revert` and `cherry-pick` (three-way tree merge via `merge` on a temporary branch), `rebase` and `rebase -i` (a chain of cherry-picks), `diff` and `show` (walk + a diff library, for example `diff` from npm), `blame` (history traversal), `bisect` (state in `.git/BISECT_*`). Reflog is our own layer: each of our operations that moves a ref writes a line to `.git/logs/HEAD` and `.git/logs/refs/heads/<branch>` in Git format (`<old> <new> <name> <email> <ts> <tz>\t<msg>`). Then `git reflog` and `HEAD@{2}` work, and the reference run on real git in CI (8.2: add the line "Git: real git 2.5x on the same scenarios" there) compares the output. Replace the rename conflict in G-D3 with a "modify versus delete" (modify/delete) conflict, or implement rename detection by content similarity and compare with git. In 8.1, estimate the scope: this is 2–3 weeks of separate work, not a wrapper.

### 9. MAJOR. tfsim reimplements the Terraform core, although there is a cheap alternative that should be checked with a spike

**Where:** 5.1 "The tfsim engine", 8.1, 8.2.

**What is wrong.** The educational scope of tfsim includes a graph with parallel traversal, refresh, a plan with unknown values, `count`/`for_each`, modules, `lifecycle` (four variants), `import`/`moved`/`removed` blocks, `-replace`, `-refresh-only`, `-target`, `state mv/rm`, workspaces. In essence this is the OpenTofu core rewritten from scratch. The statement "the core does not build to wasm: providers are separate processes over gRPC" is true only for external plugins. OpenTofu (MPL-2.0) already contains a provider that runs in the same process (`terraform_data`). A fork in which the `edu` provider is compiled into the binary and plugin discovery is disabled could provide real plan semantics without a rewrite. The limitations are size (on the order of 10–20 MB gzip versus 2 MB) and platform code (`os/exec`, file locks) that would need to be stubbed out.

**Fix.** Add a 3-day spike to the phase 0 plan (09, section 7): build an OpenTofu fork with a compiled-in provider under `GOOS=js GOARCH=wasm`, measure the size and the time of `plan` on 10 resources. If it is over 15 MB gzip or does not build, keep tfsim, but narrow its scope to what the tasks actually use, and write in 8.2 that a reference OpenTofu run on every exercise is mandatory (it already exists). Either option is better than the silent risk of "rewriting the core".

### 10. MAJOR. The `-target` trap in B2-D10 is described incorrectly

**Where:** 5.5, B2-D10.

**What is wrong.** "The plan with `-target` works, but the network is not created" is wrong. `-target=edu_vm.web` includes in the plan everything the VM depends on (subnet, network). What is left out is what does not depend on it or what itself depends on it: a DNS record pointing to its IP, a second VM, a security group if nothing references it. Terraform warns: `Warning: Resource targeting is in effect`. A learner who memorizes the wrong version will make a mistake in an interview.

**Fix (task text).** "A colleague created a VM with `terraform apply -target=edu_vm.web`, and everything went fine. What from the configuration was not created, and why is the next regular `plan` not empty?" Correct: the DNS record `edu_dns_record.web` (it depends on the VM but is not itself a target) and everything not connected to the VM by references; the network and subnet were created as dependencies. Check: `plan_expect` after `-target` is `create: [edu_dns_record.web, …]`; a quiz with `misconception: iac.target-skips-dependencies`. Keep `forbid: -target` in the subsequent checks.

### 11. MAJOR. Modules and filters that are not in ansible-core, and terms that have not been introduced

**Where:** 4.1 (ansim module table), 4.3 (B1-10), 4.4 (B1-I6), 4.6, C-I4.

**What is wrong.**
- `authorized_key` is a module of the `ansible.posix` collection, `ufw` and `timezone` (the time zone in the exam) are `community.general`, the `ipaddr` filter is `ansible.utils` (and it needs the Python package `netaddr`), `docker_container` is `community.docker`. They are not in ansible-core. In the "Real Ansible" lab (which uses exactly ansible-core), tasks with them will fail with `couldn't resolve module/action`, although they worked in ansim. This is exactly the discrepancy that section 8.2 is written against.
- Per 0.2, collections are the "intermediate" level, but exam B1 for all levels requires `ufw` and `authorized_key`, that is, collections.
- Neither 02 nor 03 introduces `ufw`: in 03 the firewall is iptables and nftables (N17). Meanwhile C-I4 ("target behind a firewall: ufw on the node") and exam B1 use `ufw` as a known term.
- 4.3 says "a simplified ladder of 8 steps", but the enumeration and B1-I6 have nine.

**Fix.** In table 4.1, write full names (`ansible.posix.authorized_key`, `community.general.ufw`, `community.general.timezone`, `ansible.utils.ipaddr`), and put `ansible.posix`, `community.general` and `ansible.utils` with pinned versions into the v86 lab snapshot. Add to module B1-3 one screen "the full module name (FQCN) and where it comes from" before the first use of a collection. Instead of `ufw` in the exam for L0, use an `nftables.conf` template + an `nft -f` handler (relies on N17); `community.general.ufw` becomes a step-4 task of the documentation ladder for L1/L2. In C-I4, replace "ufw" with "an nftables rule on the node". In 4.3, correct to "nine steps".

### 12. MAJOR. The "Real Ansible" lab diverges from the platform network (09) and from R11, and its speed has not been proven

**Where:** 4.1 (second paragraph), 8.1 (snapshot budget), 8.3.

**What is wrong.**
- In 06 the 10.5.0.x addresses are static, while in 09 (1.6) the segment is `10.0.0.0/24` with addresses from DHCP via `dnsmasq`. Per R11, the machines are connected by our JS switch (L2: ARP, tcpdump, visualization), not by bare `inbrowser` over BroadcastChannel.
- R11 sets 64–128 MB per node. ansible-core on the control machine in 32-bit Python under v86 will take about 100 MB RSS for `ansible-playbook` alone; 128 MB is too little for the control machine.
- "Seconds per task" is an estimate without a measurement. For every task ansible-core opens ssh, copies and runs a Python module on the host, and v86 runs at 1–2% of native speed (09, 1.2). Realistically it is tens of seconds per task, and the first `gather_facts` is even longer.
- `dropbear` has no sftp server. By default ansible-core tries sftp, then scp; `dropbear-scp` or `openssh-sftp-server` and `pipelining = True` in `ansible.cfg` are needed.

**Fix.** Write in 4.1: "The lab network is the shared platform switch (09, 1.6; R11), segment `10.0.0.0/24`, addresses are assigned by `dnsmasq`; the switch diagram shows the control machine's ssh sessions". Memory: control machine 192 MB, hosts 96 MB each, ≤ 400 MB of guests in total. Hosts are `lab-alpine` with `python3` and `openssh-server` (not dropbear, to avoid special cases), `pipelining = True`, `gather_facts: false` by default in lab exercises. Acceptance threshold for the phase 0 spike: a playbook of 5 tasks on two hosts in ≤ 90 s from a snapshot with a warmed-up Python cache (`.pyc` in the snapshot). If the threshold is not met, the lab remains in recorded mode only (frames from a real run), as 09 proposes for phones.

### 13. MAJOR. The practicum from section 7 duplicates the pet projects and the final exam from 10, and the checker duplicates `trainer-check` from 09

**Where:** section 7.

**What is wrong.** Steps 1–5 of the practicum are pet projects 1, 3, 5, 6 and requirements A2, A3, A5 of the final exam from 10 (6.4, 10) with different criteria. The checker `docker run ghcr.io/<org>/devops-trainer-checker` is a second agent next to `trainer-check` from 09 (5.4), which has a signature, a one-time code and a common fact format.

**Fix.** Rename section 7 to "Acceptance criteria for pet projects 5 and 6 and parts A3 and A5 of the final exam" and keep only the block's substantive criteria in it (what to check in the Prometheus API, the Grafana API, state, a repeat run). The checking mechanics are `trainer-check pet 5|6` and `trainer-check capstone` (09, 5.4). Delete the line about `docker run ghcr.io/...checker`. In 10, on my side, I will refer to 06, 7 as the source of the criteria.

### 14. MAJOR. Own entity names instead of graph IDs, and a check format outside the 09 contract

**Where:** 0.2, 0.4 (lesson example: `introduces: [artifact, cache]`), 6.5.

**What is wrong.** 01 requires that `introduces` and `uses` refer to graph IDs (C09, O06…), while 06 uses arbitrary words (`artifact`, `job-log`). Many entities from 0.2 are not in the graph at all: job, runner executor, cache, `needs`, matrix, handler as a separate concept, `for_each`, cardinality, recording rule, burn rate. The 01 graph is too coarse for these blocks: C has only 15 concepts, O has 14, while 06 has more than 70. The checks `state` for ansim, `plan_expect` for tfsim and `run` for the pipeline in 09 (2.4) "remain their own evaluators", but they have no fact domains. So on a real VM (the practicum, the final exam) there is nothing to check them with.

**Fix.** 1. In 01, add a sub-level of concepts: 20–30 IDs each for C, I and O (for example, `C08a` job, `C08b` stage, `C08c` `needs`, `C09a` cache, `O06a` range vector, `O06b` `rate`, `O06c` `by` aggregation, `O08a` `for`, `O08b` Alertmanager route). The list is taken from table 0.2 of this document; the author of 06 sets the prerequisites. 2. In `dt.facts/v1` (09, 2.2), add the domains `ci` (`pipelines[{ref, source, jobs[{name, status, needs}]}]`), `tf` (`state`: the path to the JSON and the list of addresses, `plan.resource_changes`), `ansible` (`hosts[{name, ok, changed, failed}]` from the JSON callback) and `prom` (`targets[{job, instance, health}]`, `rules[{name, state}]`). The collector on the VM gets them from `terraform show -json`, `ANSIBLE_STDOUT_CALLBACK=json`, `/api/v1/targets`, `/api/v1/rules`. Then the predicate `ansible.hosts[*].changed=0` works the same way in ansim and on a real VM.

### 15. MAJOR. GitOps duplicates 05, while deployment strategies and deployment over SSH from the graph are not covered

**Where:** 3.3 (A7), 0.1.

**What is wrong.** A7 has "GitOps (Argo CD) as an alternative" for the experienced, but Argo CD is introduced in full in 05 (K13, decision 6, `argocd-lite`). Meanwhile C13 "deployment to a server over SSH and compose" and C14 "deployment strategies: rolling, blue-green, canary, rollback" from the 01 graph appear nowhere in 06. C14 is also a prerequisite of K12 (Deployment, rolling update), that is, Kubernetes relies on a concept that nobody introduces. Pet project 1 from 10 (auto-deploy to a VPS) also depends on C13.

**Fix.** In A7, replace GitOps with a reference to 05, K13. Add module **A5b "How deployments are done"** before Kubernetes, after A5:
- deployment to a VPS from CI: a key in a File variable, `ssh deploy@host 'docker compose pull && docker compose up -d'`, `resource_group: production` (C13);
- strategies on a diagram with two versions and a "share of traffic to the new one" slider: recreate (downtime), rolling (one at a time), blue-green (switch at once, instant rollback), canary (5% → 50% → 100% with a stop based on the 5xx share from block C, a forward reference, `forward: [O06]`) (C14);
- "break it": the new version returns 500; with recreate everything goes down, with canary 5% are affected, and the rollout stops.
Drill A-D15: "Deploy to staging over SSH with compose; production manually; rollback is a Re-deploy of the previous tag". Check: on the VPS model in the Sandbox, the image with the required SHA is running, and after the rollback, the previous one.

### 16. MAJOR. Monitoring: gaps relative to the 01 graph, and container metrics not linked to 04 and 05

**Where:** 6.1, 6.3 (C14, C16).

**What is wrong.**
- The 01 graph has O12 "tracing and span; OpenTelemetry" and O14 "Zabbix and the agent model". 06 does not mention OpenTelemetry at all, nor Zabbix. Zabbix is named in the definition of L2 in 01, and it appears constantly in Russian job postings.
- C16 "cAdvisor container metrics" is not linked to what the learner has already touched by hand. Per R6 and 04, they already have cgroups v2 (`memory.current`, `memory.max`, the OOM-kill drill), and that is exactly the source of `container_memory_working_set_bytes` and `container_cpu_cfs_throttled_seconds_total`.
- `kubernetes_sd_configs` and ServiceMonitor do not rely on Endpoints and EndpointSlice from R9, although Prometheus in Kubernetes finds targets precisely through them.

**Fix.** Add to 6.3:
- **C14b. OpenTelemetry** (L1 as an overview, L2 in full): SDK in the code → OTLP → Collector (receivers / processors / exporters) → Prometheus, Tempo, Loki; one process diagram with a "sampling 100% / 10%" toggle and a lost-traces counter.
- **C17. Zabbix and the agent model** (L0 as an overview, L1–L2 in one lesson): an agent on the host, active and passive checks, templates and triggers. A comparison table with Prometheus: who connects to whom, where the data is stored, how thresholds are defined. Drill: read a Zabbix trigger and write the equivalent PromQL rule.
- In C16, the first screen: "`memory.current` from the cgroups lesson (link to D04) is the same number as `container_memory_working_set_bytes`" (with a caveat: the working set does not include the inactive file cache). The learner sets `memory.max` in the Linux lab and sees `container_oom_events_total` and `kube_pod_container_status_last_terminated_reason{reason="OOMKilled"}` in the PromQL workbench.
- In the same place, a screen "how Prometheus finds pods": `kubernetes_sd_configs` with `role: endpointslice` → the same EndpointSlices as in the Kubernetes networking section; "break it": the Service has a wrong selector → an empty EndpointSlice → no targets, `up` is absent (not 0). This is a good task on the difference between "the series is absent" and "the series equals zero".

### 17. MAJOR. There is no textbook (R1) in the document: there are interactives, but no coherent theory and no order of exposition within modules

**Where:** sections 2.2, 3.3, 4.3, 5.3, 6.3 (curriculum tables), 0.4.

**What is wrong.** Per R1, the foundation of the product is a textbook with coherent theory and a strict order of introducing entities, and practice rests on it. In 06 the curriculum tables list topics separated by commas, and the only example of text is one sentence in 0.4. There is no chapter plan, no "this chapter relies on that one" links, no main thesis of a module. The content author has nothing to write from without filling in the gaps themselves, and it is precisely in theory with gaps filled in on the fly that terms appear before their time.

**Fix.** For each module in the curriculum table, add a "Chapter thesis" column and a "Text plan" section (3–6 paragraph headings). Sample for B2-4:

> **B2-4. Three truths.** Thesis: Terraform knows about the cloud only what is recorded in state, and every `plan` is a comparison of three versions of the world.
> 1. What Terraform remembers after `apply`: the state file, the resource address and the ID in the cloud (relies on B2-3).
> 2. Why you cannot do without state: how to match a code block with a cloud object if names can coincide (link to interview question I-1 from 10).
> 3. Attributes that only the cloud knows (`id`, `public_ip`), and `(known after apply)`.
> 4. Refresh: how state catches up with reality before a plan (prepares B2-8 "drift").
> 5. Where state is stored and why it is not committed (forward, `forward: [I06]`: remote storage in B2-10).
> Comprehension check: `predict` "what will `plan` show after state is deleted".

The chapter texts are written by the content role, but the plan and the thesis are the responsibility of the block author, and without them the textbook cannot be assembled.

---

## Minor

### 18. MINOR. Homonyms that rule 01 (6.1) requires to be explicitly separated

**Where:** 0.2 (G, A1–A7), 5.1 (Edu Cloud resource table).

"Stage" (a CI stage), "staging area" (the Git index) and "staging" (an environment) are introduced in the same block and overlap in the same pet project. `zone` on `edu_subnet` and `edu_vm` is an availability zone, while `zone` on `edu_dns_record` is a DNS zone. "Environment" in A5 (a GitLab environment) is a refinement of the everyday F10. Fix: in `concepts.yaml`, create separate IDs with different `forms` (`C02a` «индекс (staging area)» ("index (staging area)"), with only «индекс» ("index") in the Russian text, `C08b` «стадия» ("stage"), `C14a` «тестовое окружение (staging)» ("test environment (staging)")). In Edu Cloud, rename the attribute to `availability_zone` (as in AWS), and keep `zone` for DNS. In B2-2, one screen: "zone in this line is not the same as zone in that one".

### 19. MINOR. Outdated versions in the examples

**Where:** 3.1 (runner log, image profiles), A-D11.

`gitlab-runner 17.5.0`: by November 2026 the current branch is already 19.x. `alpine:3.20` went out of support in spring 2026; 09 uses 3.22. `docker:27` while 09 has Docker Engine 29.x. Node.js 20 reached end of support on 30.04.2026, so the A-D11 matrix "Node 20 and 22" teaches something outdated: it should be 22 and 24. Fix: move versions to `content/versions.yaml` (like `gitlab_version` in 8.3), generate the runner log with the current version, and reconcile quarterly.

### 20. MINOR. Two inaccuracies in GitLab CI syntax

**Where:** A-D14, A-L1…A-L20.

"Move the common `before_script` into `.default`": in GitLab this is the `default:` keyword, while `.name` is a hidden job for `extends`. A learner who memorizes `.default` will get a job that silently does nothing. "`needs` on a job from a later stage without `optional`": `needs:optional` does not permit a reference to a later stage; it is meant for jobs that may be absent because of `rules`. The "needs from a later stage" error remains an error with any `optional`. Fix the wording of both tasks.

### 21. MINOR. The PromQL semantics version is not pinned

**Where:** 6.1 "The PromQL engine", C-I6.

Since Prometheus 3.0, range selectors are left-open: a sample exactly on the left boundary of the window is not included. So with a 15 s scrape, `[1m]` contains 4 samples, not 5, and `rate` and `increase` give different numbers than in 2.x. "Extrapolation exactly as in Prometheus" without a version is unverifiable. Fix: write "Prometheus 3.x semantics, `promqltest` test version = `prometheus_version` from `versions.yaml`". In C-I6, instead of "a window shorter than two scrape intervals gives emptiness", write "if the window contains fewer than two samples, there is no result": with a window slightly longer than one interval, two samples do not always fall into the window.

### 22. MINOR. OpenTofu encrypts state, but B2-D11 teaches the opposite

**Where:** 5.1 (last paragraph), B2-D11.

"The material applies equally to both" is not true in one important place: OpenTofu has had client-side state and plan encryption since version 1.7, so "`sensitive` does not encrypt state" is true for Terraform, while OpenTofu has a built-in solution. Add a second part to B2-D11 (L2): "how this is solved in OpenTofu (the `encryption` block) and in Terraform (encryption of the backend bucket and access to it)". At the same time, list in 5.1 where the tools have already diverged: Terraform has ephemeral resources and `terraform test`, OpenTofu has state encryption and `for_each` on providers. The course does not study these differences, but names them.

### 23. MINOR. An unverified claim and a mismatched source

**Where:** 8.3 (the line about Shai-Hulud), 4.7.

1. "The `@cdktf/hcl2json` page on socket.dev is linked to the campaign: not verified": an unverified rumor has no place in a design document. The decision "we build the wasm ourselves from source, npm dependencies via the lock file with integrity checking" is enough; delete the sentence about the package.
2. The link "Habr, `changed_when` and change detection" (habr.com/ru/articles/746864) leads to an article about `check_mode` («Пишем роли ansible не ломая прод — особенности check_mode…», "Writing Ansible roles without breaking prod: check_mode specifics…"; checked on 18.11.2026). Relabel the link as a source for B1-11 (check mode), and find a separate second source for `changed_when` (for now, `hold: true`).

The other verified links (Grafana "Inside PromQL", habr 869422, 841474, 786700, 501978, dora.dev, docs.gitlab.com/ci/yaml, development/cicd/schema, Yandex Cloud state lock, isomorphic-git fs, PromLabs cheat sheet) return 200 and match their labels.

### 24. MINOR. Minor underspecifications in tasks

**Where:** 4.2 (task 5), 6.2 (task 1), 2.1 (task 4), C13.

- Level check B1, task 5: it does not say which hosts the play targets. If `hosts: web`, db1 does not get the value from the play's `vars:`, and the answer depends on this. `hosts: all` needs to be specified.
- Monitoring, task 1: the two reference forms give different results at zero (an empty vector versus 0). `promql_equiv` needs explicit normalization `empty_equals_zero: true`, otherwise the check will flap on a dataset with no failures.
- G, task 4: "`reset --soft main && git commit` is accepted" is good. But the check "one commit on top of `main`" will reject a learner who first did `rebase main` if main has moved ahead. Check "parent = current `main`, tree = the original one with main taken into account".
- C13: keep the pager tone signal off by default (08, section 4: "sound is off by default"), not merely "can be turned off".

---

## What of R1–R12 this review closes, and what remains for other documents

| Requirement | Status in 06 | Where it is closed |
|---|---|---|
| R1 textbook | no chapter plan | finding 17 |
| R2 documentation ladder | absent | finding 2 (ready section 0.7) |
| R3 process explainers | partial, without parameters | finding 3 (E-CI, E-TF, E-ANS, E-MON, E-REC) |
| R4 explainer style | violated (plot, characters, ink) | findings 3 and 5; remove "Petya" and the "little man", rewrite the `ink.ts` line in 0.5 to the "blueprint" from 08, 5.1 |
| R5 beauty and color | no own tokens | add to 08, 5.2: `--c-code` (code and Git), `--c-state` (Terraform state), `--c-cloud` (cloud reality), `--c-pipe-*` by job status (with a shape: ✓ ⨯ ◷ ⏸), `--c-metric` / `--c-log` / `--c-trace` for the three signals; each has a duplicate shape, as in 08 |
| R6, R7 | outside the scope of 06 | the link in C16 (finding 16) |
| R8, R9 | outside the scope of 06 | the link with EndpointSlice in C16 (finding 16) |
| R10 reconciliation loop | no bridge | E-REC (finding 3) |
| R11 multi-node v86 | the Ansible lab is not on the shared switch | finding 12 |
| R12 Kubernetes stage 3 | Terraform and Ansible are not used | finding 4 (ready section 7.2) |
