# 06. Git, CI/CD, IaC (Ansible, Terraform) and monitoring — block design

Author's role: a DevOps/SRE engineer responsible for the infrastructure-as-code, delivery pipeline and observability blocks. The document describes these DevOps Trainer learning blocks: **G — Git**, **A — CI/CD**, **B1 — Ansible**, **B2 — Terraform**, **B3 — a Kubernetes cluster from code** (the third Kubernetes stage, R12), **C — monitoring**. For each block it gives its place in the route and the order of concepts according to the graph in 01, the textbook plan (chapter outlines), the process explanations screen by screen, the documentation ladder, the interactives, the trainers with checks in the 09 contract, the practical exam in the 10 format, and sources in English and Russian. At the end come the shared technical stack, simulator fidelity checks, risks, dependencies on other roles and the list of changes after review. Revision of 18.11.2026.

The base curriculum is the checklist `source/checklist.txt`: step 01 (CI/CD as a practice, "where one thing ends and the next begins"), step 06 (Ansible/Terraform, "understand the core concept, the core entities"), step 07 (metrics, traces, logs, alerts, Grafana + Prometheus), the pet projects "business-card site in Docker with CI/CD on a VPS", "docker-compose + GitLab pipeline", "Prometheus + Grafana monitoring", "automation with Ansible", and the interview question "CI vs CD vs CDP". The concepts CI, Continuous Delivery, Continuous Deployment, the pipeline as an idea, and the DORA metrics (M13–M17) are introduced by the methodology block (document 07); the blocks in this document build on them and show them in code.

The document's priorities follow the owner's requirement R1. The foundation is a coherent textbook with a strict order of concepts, process explanations and the habit of reading documentation. Practice stands on these three supports: a trainer in which the learner does not understand what happens inside teaches nothing.

---

## 0. Cross-cutting decisions

### 0.1. Where the blocks sit in the route

The course route is set in 01, section 5: methodology → Linux → networks → Docker → CI/CD with Git → Kubernetes → IaC → monitoring → pet project → career. The blocks of this document fit into it so that no concept is used before its prerequisites in the 01 graph (section 6.2).

| Position in the route | Module | Graph concepts | Why here |
|---|---|---|---|
| Linux block, after L21 (scripts) | **Y1. YAML and JSON** — lesson L31. The content is written in this document (section 2.7) and handed over to the Linux block (document 02) | L31 | YAML is needed before Docker: compose files and manifests. The 01 graph already keeps it in Linux; there is no second introduction of YAML in the route |
| Linux block, last module | **G-local. Git on your own machine** (G1–G5, G8a) | C01, C02, C16, C17, C03, C06, C21 (L1/L2) | The Dockerfiles and compose files of the Docker block live in a local repository. The prerequisites of C01–C03 are only files, directories, an editor and the shell (F12, L04) |
| Start of the CI/CD block (after Docker and therefore after networks) | **G-remote. Remote repository and merge request** (G6, G7, G8b) | C04, C05, C15, C18, C19, C20 | C04 requires N14 (HTTP), C05 requires M14 (CI from methodology). Before CI/CD nobody needs a remote repository |
| CI/CD block | **Y-traps** (the lesson "YAML through the parser's eyes"), then **A1–A6**, **A5b** (deployment over SSH and strategies), **A6g** (GitHub Actions) | C30, C07–C12, C22–C27, C31, C13, C14 | A job runs in a container image (D08, D11), building an image is a pipeline stage (D18). C14 is a prerequisite of K12 (rolling update), so deployment strategies are introduced before Kubernetes |
| Kubernetes block, after K28 (Helm) and K29 (GitOps) | **A7. Deploying to Kubernetes from CI** | C28, C29 | Needs Deployment, RBAC, Helm and GitOps, which 05 introduces |
| IaC block | **B1. Ansible**, then **B2. Terraform**, then the **E-REC** bridge (I22) | I01–I27 | Ansible comes first: it works with entities already known from Linux (package, file, unit). Terraform introduces a new entity, the cloud resource (I03 requires K31, which the learner has already done by hand in the second Kubernetes stage). The graph allows both orders: I13 requires I05 and I10 together, and neither of them requires the other |
| End of the IaC block | **B3. A Kubernetes cluster from code** — the third Kubernetes stage (R12): kubeadm on 3+ VMs, the VMs are ordered by Terraform and configured by Ansible | K32, I23 | The R12 requirements and the 01 order "IaC after Kubernetes" only fit together this way: stages 1 and 2 (simulator and k3s) take place in the Kubernetes block, where the learner orders VMs by hand and feels the pain; stage 3 opens when Terraform and Ansible have already been introduced. The edge K32 → I05, I10 is added to the 01 graph |
| Monitoring block | **C1–C17** | O01–O25 | Node metrics rely on Linux, service metrics on HTTP, container metrics on cgroups (D04, R6), target discovery in Kubernetes on EndpointSlice (K14, R9) |
| Pet projects and the final exam (document 10) | Acceptance criteria for pet projects 5 and 6 and for parts A3, A5 of the final exam (section 8) | — | The checking mechanics come from the `trainer-check` agent (09, 5.4), the content criteria from this document |

Module A0 "CI/CD methodology" from the first revision has been removed: the definitions of CI, Continuous Delivery and Continuous Deployment, the five DORA metrics and the batch-size simulation belong to the methodology block (07: M13–M17, E10 "Five instruments", `flowlab`). Of A0, one bridge screen remains in this document — A-I6 "One line", where the difference between Delivery and Deployment is shown as a single line of YAML (section 3).

### 0.2. Order of concept introduction and new graph identifiers

Every **screen** (scene) declares `introduces` — at most one concept — and `uses`. The build checks the graph, prerequisites and word forms, as 01, 6.1 requires. Large concepts of the 01 graph (C08 "Pipeline file: stage, job, step", O06 "PromQL: selectors, `rate`, `sum by`") contain three or four independent ideas each, so this document proposes adding the identifiers C16–C31, I15–I27, O15–O25 to the graph and narrowing the wording of I11, O06, O08. Small details that do not deserve a separate concept (`policy: pull` on a cache, `expire_in` on an artifact, `allow_stopping_for_update`) are written as a `facet` of an existing concept: they do not count as an introduction and do not break the "one concept per screen" rule.

| ID | Concept | Requires | Block |
|---|---|---|---|
| C16 | The index (staging area); in Russian text only «индекс» | C02 | G-local |
| C17 | HEAD and a branch as a movable pointer | C02 | G-local |
| C03 (refinement) | Merge and conflict | C17 | G-local |
| C18 | Rebase and rewriting history | C03, C04 | G-remote |
| C19 | `reset` and `revert`: two ways to undo a commit | C17, C04 | G-remote |
| C20 | Reflog: the log of pointer movements | C19 | G-remote, L2 |
| C21 | Git objects: blob, tree, commit | C02 | G-local, L1/L2 |
| C22 | Runner executor and job image (`image:`) | C07, D11, D08 | A2 |
| C23 | CI cache (versus artifact) | C09 | A3 |
| C24 | Pipeline run rules and events (`rules`, MR, tag) | C08, C05, C15 | A6 |
| C25 | CI environment and deployment history (environment) | C12, F10 | A5 |
| C26 | The `needs` job graph | C08 | A6 |
| C27 | Matrix and reuse: `default`, `extends`, `include`, reusable workflows | C08 | A6 |
| C28 | Deploying to Kubernetes from CI (push model) | C25, K12, K25, K28 | A7 |
| C29 | Deploying via GitOps (pull model): CI writes the tag into the configuration repository | C28, K29 | A7 |
| C30 | YAML 1.1 and 1.2 traps (`yes`, `on`, `0755`, `1.10`) | L31 | Y-traps |
| C31 | The same concepts in GitHub Actions: `on`, `jobs`, `steps`, `uses` | C08, C12, C24 | A6g |
| I11 (refinement) | Variables and Jinja2 templates | I10 | B1 |
| I15 | Ansible facts | I10 | B1 |
| I16 | Handler | I11 | B1 |
| I17 | Variable precedence | I11, I12 | B1 |
| I18 | Terraform resource graph, `depends_on` | I05 | B2 |
| I19 | In-place update and replacement | I05, I06 | B2 |
| I20 | `count` and `for_each`, instance address | I07 | B2 |
| I21 | `import`, `moved`, `removed`, `state mv` | I06, I20 | B2 |
| I22 | Three reconcilers: Ansible, Terraform, a controller | I13, K03 | E-REC bridge |
| I23 | A Kubernetes cluster from code: Terraform + Ansible + kubeadm | I13, I12, K31 | B3 |
| I24 | Fully qualified module name (FQCN) and collections | I10 | B1 |
| I25 | Check mode and diff | I10 | B1 |
| I26 | Object storage and a bucket | I03 | B2 |
| I27 | Terraform in CI: plan in the MR, `apply` by hand | I06, C24 | B2 |
| O06 (refinement) | PromQL: instant vector, selectors, matchers | O03, O04 | C5 |
| O08 (refinement) | Alerting rule | O16 | C11 |
| O15 | Cardinality | O02 | C2 |
| O16 | Range vector, `rate` and `increase` | O06, O03 | C6 |
| O17 | Aggregation `by` / `without` | O06 | C7 |
| O18 | Vector matching: `on`, `ignoring`, `group_left` | O17 | C7 |
| O19 | Histogram: `le` buckets and `histogram_quantile` | O03, O16, O17 | C8 |
| O20 | Recording rule | O16 | C12 |
| O21 | Alert states and `for`: inactive, pending, firing | O08 | C11 |
| O22 | Alertmanager: route, grouping, inhibition, silence | O21 | C11 |
| O23 | Burn rate | O09 | C15 |
| O24 | Container metrics from cgroups | O05, D04, K22 | C16 |
| O25 | Target discovery in Kubernetes (`kubernetes_sd_configs`, EndpointSlice) | O04, K14 | C16 |

Introduction chains by block (arrows give the order of screens; parentheses mark a `facet`, which does not count as a separate concept):

| Block | Order |
|---|---|
| G-local | C01 repository → C02 commit and history (hash as a name, `log`, `diff`) → C16 index → C17 HEAD and branch → C03 merge: fast-forward, merge commit, conflict → C06 `.gitignore` and secrets outside the repository → C21 objects (L1/L2) |
| G-remote | C04 remote repository (origin, `push`/`fetch`/`pull`, non-fast-forward rejection) → C05 merge request and review (protected branch as a facet) → C15 tag and semver → C18 rebase (intermediate) → C19 `reset` and `revert` → C20 reflog (advanced) |
| Y1 (in the Linux block) | L31: document → key and value → mapping → list → nesting by indentation → multi-line `\|` and `>` (all facets of the single concept L31, one screen per facet) |
| Y-traps, A1–A7 | C30 YAML traps → C07 runner → C08 pipeline file (job, script, log, status — facets) → stage (facet of C08) → C22 executor and image → C10 test and exit code → C09 artifact → C23 cache → C12 variables and secrets (masked, protected — facets) → C11 building and publishing an image → C25 environment (manual run `when: manual` — facet) → C13 deployment over SSH and compose → C14 deployment strategies → C24 rules and events → C26 `needs` → C27 matrix and reuse → C31 GitHub Actions → C28 deploying to Kubernetes → C29 GitOps deployment |
| B1 | I01 infrastructure as code → I02 idempotency → I09 inventory and SSH → I10 module, task, play, playbook (ad-hoc, ok/changed/failed — facets) → I24 FQCN and collections → I15 facts → I11 variables and templates → I16 handler → (`when`, `loop`, `register` — facets of I10) → I12 role → I17 variable precedence → I25 check mode and diff → I14 secrets (vault) |
| B2 | I03 cloud resource and API → I04 provider, `resource`, HCL, references → I05 `init`/`plan`/`apply`/`destroy` → I06 state (`known after apply` — facet) → I19 in-place and replacement → I18 graph and `depends_on` → I07 variables, `output`, `locals`, `data`, modules → I08 drift → I20 `count` and `for_each` → I26 bucket → I06 (continued: remote state and locking) → I21 `import`, `moved`, `removed` → I13 provisioning and configuration → I27 Terraform in CI → I22 three reconcilers |
| B3 | K31 (repeated as a card) → I23 cluster from code → K32 kubeadm, control plane PKI (content — 05, R3/R4) |
| C | O01 observability → O02 time series → O15 cardinality → O03 metric types → O04 Prometheus: pull, `/metrics`, targets, `up` → O05 exporters → O06 instant vector and selectors → O16 range vector and `rate` → O17 aggregation → O18 vector matching → O19 histograms → O07 Grafana → O10 USE, RED, golden signals → O08 alerting rule → O21 states and `for` → O22 Alertmanager → O20 recording rule → O11 logs → O12 traces and OpenTelemetry → O09 SLI, SLO, budget → O23 burn rate → O25 target discovery in Kubernetes → O24 container metrics → O13 kube-state-metrics, ServiceMonitor → O14 Zabbix |

Homonyms are separated into distinct concepts and word forms, as 01, 6.1 requires. In Russian text the Git index (C16) is never called «staging»; «стадия» (a facet of C08) is a pipeline stage; «тестовое окружение (staging)» is a C25 environment. In Edu Cloud the availability zone is called `availability_zone`, while the DNS zone of `edu_dns_record` is `zone`; in B2-2 one card is devoted to this: "zone in this line is not the same as zone in that one".

### 0.3. The shared in-browser workbench

All blocks run on top of the **Workbench** — a shell emulator and virtual file system designed by the Linux role, in the shared worker `sim.worker.ts` (09, 1.3). From the Workbench these blocks need a command registry (`(argv, io, vfs) => Promise<exitCode>`), a VFS with POSIX paths and permissions, and several "machines" with their own hostnames, packages and services, between which `ssh host` moves. Commands added by the blocks of this document:

| Command | Implementation | Block |
|---|---|---|
| `git init`, `add`, `commit`, `status`, `log`, `branch`, `checkout`, `merge`, `tag`, `stash`, `clone` | the **isomorphic-git** library on top of the Workbench VFS | G |
| `git push`, `fetch`, `pull` | our own wrapper: walking objects with `readCommit`/`readTree`/`readBlob`, copying via `writeObject` into the forge gitdir, `writeRef` with a fast-forward check (isomorphic-git can only push over HTTP) | G |
| `git switch`, `restore`, `reset` (soft, mixed, hard), `revert`, `cherry-pick`, `rebase`, `rebase -i`, `diff`, `show`, `blame`, `bisect`, `reflog` | **our implementation** on top of `readCommit`/`writeCommit`/`writeRef`/`walk`/`resetIndex`: `revert` and `cherry-pick` are a three-way tree merge on a temporary branch, `rebase` is a chain of cherry-picks, `diff` is `walk` plus the `diff` library (npm), `bisect` keeps its state in `.git/BISECT_*`. Reflog is our own layer: every one of our operations that moves a ref writes a line to `.git/logs/HEAD` and `.git/logs/refs/heads/<branch>` in Git's format (`<old> <new> <name> <email> <ts> <tz>\t<message>`), so `git reflog` and `HEAD@{2}` work. There is no rename detection during merges, and the exercises do not need it. Effort: 2–3 weeks of separate work | G |
| `glab ci lint`, `actionlint` | ajv + GitLab's JSON Schema `ci.json`; actionlint compiled to wasm | A |
| `gitlab-runner list`, `verify` | TS (the runner itself is part of the pipeline simulator) | A |
| `docker build`, `push`, `pull` inside a job | **dsim and the registry from document 04** (09, 1.7) with the `docker` image profile and the `docker:dind` service | A |
| `kubectl`, `helm` inside a job | **kube-lite and `helm-engine.wasm` from document 05** in the same worker | A7 |
| `ansible`, `ansible-playbook`, `ansible-inventory`, `ansible-galaxy init`, `ansible-doc` | **ansim** — a simulator in TS; `ansible-doc` returns text generated in CI from `ansible-doc -j` of the real ansible-core | B1 |
| `terraform` / `tofu` (init, fmt, validate, plan, apply, destroy, show, output, state, import, console, graph, providers, version, workspace) | **tfsim** — Go → wasm on `hashicorp/hcl/v2` and `go-cty` (section 5.1) | B2 |
| `curl http://<host>:<port>/metrics` | the metrics generator responds with text in the exposition format | C |
| `promtool check config`, `promtool check rules`, `promtool test rules`, `promtool query instant <url> '<expr>'` | a validator, a PromQL engine and a rule unit-test runner in TS | C |
| `amtool check-config`, `amtool config routes test --config.file=alertmanager.yml <labels>`, `amtool silence add` | an Alertmanager routing simulator | C |

The Workbench also accepts short forms (`amtool config routes test severity=critical` without `--config.file` when there is one file in the directory), but the lesson always shows the full form.

Commands that cannot be executed in a browser (`npm ci`, `pip install -r`, `go build`) are implemented as **tool models**: they read the real repository files, check that they are consistent, create the expected output files and spend modelled time that depends on the cache. A model is not a script: it has a closed list of behaviours, and every error is checked against the real tool in CI (section 9.2).

| Model | Reads | Creates | Errors it reproduces (text from the real tool) |
|---|---|---|---|
| `npm ci` | `package.json`, `package-lock.json`, the `~/.npm` cache | `node_modules/` with a marker | the lock file does not match `package.json` (`npm ERR! cipm can only install packages when your package.json and package-lock.json ... are in sync`); no lock file; without a cache the time is ×5 |
| `npm test`, `npm run build` | `package.json` scripts | `dist/` | `test` runs the course's **real** test scripts (`./test.sh` with `grep`, `diff`, `test`), so a red pipeline is the result of actual execution |
| `pip install -r` | `requirements.txt` | `site-packages/` with a marker | a non-existent version (`No matching distribution found for …`) |
| `go build` | `go.mod`, `go.sum`, `*.go` | a marker binary | a syntax error from a fixture (position and text from `go vet`), no `go.sum` (`missing go.sum entry`) |

The model's log carries an unobtrusive "simulated" note; in the pet projects the same steps run for real.

The rest of the interface — an editor with highlighting, the Edu Cloud console, forge pages, dashboards, graphs — consists of web panels around the terminal. The terminal is always present: anything that can be done with the mouse in an interactive can also be done with a command, and the panel shows the result.

### 0.4. Content and check format

Content is stored as YAML following the pattern of Sankofa's `features/model.ts`: bilingual `{en, ru}` blocks, `draft` and `hold` flags, and source references on factual statements. `introduces` and `uses` are declared on a scene, not on a lesson.

```yaml
# content/blocks/cicd/a3-artifacts-cache/lesson.yaml
id: a3-artifacts-cache
block: cicd
level: [L0, L1, L2]
scenes:
  - id: clean-machine
    kind: mechanism
    widget: stepper                     # part of the E-CI explanation, screen 4
    introduces: [C09]
    uses: [C07, C08, C22]
    blocks:
      - id: t1
        role: text
        en: "A job runs on a clean machine. Anything it creates disappears when it ends, unless you ask the runner to keep it."
        ru: "Джоба запускается на чистой машине. Всё, что она создала, исчезает вместе с ней, если не попросить раннер это сохранить."
        draft: true
        sources: [gitlab-artifacts, pro-git-ru]
  - id: second-shelf
    kind: mechanism
    introduces: [C23]
    uses: [C09]
    # ...
exercises: [a3-d1, a3-d2, a3-d3]
```

Exercise checks are written in the 09 contract, section 2.4: `goals[]` with `when`, `keep`, `fail[].say` and a mandatory `fail[].term` — a reference to the concept whose lesson the learner is sent back to. Evaluators that cannot be reduced to machine facts (`lint`, `yaml_path`, `hcl_path`, `plan_expect`, `promql_equiv`, `explain`) are plugged in as `eval` and return the common `CheckResult`.

```yaml
# content/blocks/cicd/a3-artifacts-cache/a3-d1.yaml
id: a3-d1
kind: pipeline-fix
level: [L0, L1]
doc_ladder: { step: 2, source: { kind: web, page: "docs.gitlab.com/ci/yaml/#artifactspaths" }, allow_hint_excerpt: true }
task:
  ru: "Джоба deploy падает с «dist/: No such file or directory». Сделайте так, чтобы результат сборки дошёл до деплоя."
  en: "The deploy job fails with 'dist/: No such file or directory'. Make the build result reach the deploy job."
start: { repo: fixtures/site-no-artifacts, pipeline_file: .gitlab-ci.yml }
goals:
  - id: g-lint
    eval: { lint: gitlab }
  - id: g-run
    needs: [ci]
    eval: { run: { event: push, ref: main } }
    when: "ci.pipelines[-1].jobs[name=build].status=success && ci.pipelines[-1].jobs[name=deploy].status=success"
    fail:
      - if: "ci.pipelines[-1].jobs[name=deploy].log~'dist/: No such file'"
        say: { ru: "deploy всё ещё не видит dist/: у build нет artifacts:paths", en: "deploy still cannot see dist/: build has no artifacts:paths" }
        term: C09
  - id: g-artifact
    eval: { yaml_path: "$.build.artifacts.paths", contains: "dist/" }
  - id: g-no-rebuild
    eval: { yaml_path: "$.deploy.script[*]", not_matches: "npm (ci|install|run build)" }
    fail:
      - say: { ru: "Деплой не должен собирать сайт заново: сборка — работа джобы build.", en: "Deploy must not rebuild the site: building is the build job's work." }
        term: C09
hints:
  - { id: a3-h1, kind: question }
  - { id: a3-h2, kind: doc_fragment }   # step 2 of the documentation ladder, see 0.5
ai_context: [task, pipeline_file, last_run_log, doc_ladder]
```

A hint of `kind: doc_fragment` is shown only when `doc_ladder.step ≤ 2`; on steps 3 and above it can be opened by an explicit request, and this is written to the attempt log as an H3-level hint (01, 14.2).

**Fact domains.** For the same goal to be checked both in the simulator and on a real VM, the `dt.facts/v1` schema (09, 2.2) needs to be extended with domains for these blocks. Collectors: in the simulator, a projection of the state of ansim, tfsim, the pipeline engine and the PromQL bench; on a VM, the `trainer-check` agent, which reads `terraform show -json`, playbook output with `ANSIBLE_STDOUT_CALLBACK=json`, `/api/v1/targets`, `/api/v1/rules`, `/api/v2/alerts`, `/api/dashboards/uid/<uid>`.

```ts
// extension to shared/facts/v1.ts — proposal for 09, 2.2
git?:      { repos: { path: string; head: string; branches: Record<string, string>; status: [string, number, number, number][]; log: { oid: string; parents: string[]; tree: string; message: string }[]; reflog?: string[] }[] };
ci?:       { pipelines: { id: string; ref: string; source: string; status: string; durationS: number;
                          jobs: { name: string; stage: string; status: string; needs: string[]; runner?: string; image?: string;
                                  log: string; startedAt: number; finishedAt: number; artifacts: string[]; cacheHit?: boolean }[] }[];
             registry?: { ref: string; digest: string }[]; environments?: { name: string; deployed: string; by: string }[] };
tf?:       { state?: { serial: number; lineage: string; resources: { addr: string; id: string; attrs: object }[] };
             plan?: { resource_changes: { address: string; actions: string[]; action_reason?: string }[] } };
ansible?:  { runs: { n: number; hosts: { name: string; ok: number; changed: number; failed: number; unreachable: number;
                                          tasks: { name: string; status: 'ok'|'changed'|'failed'|'skipped'; handler?: boolean }[] }[] }[] };
prom?:     { targets: { job: string; instance: string; health: 'up'|'down'|'unknown'; lastError?: string }[];
             rules: { group: string; name: string; kind: 'alert'|'record'; state?: 'inactive'|'pending'|'firing'; health: string }[] };
am?:       { alerts: { labels: Record<string, string>; state: string; receivers: string[] }[]; silences: object[] };
grafana?:  { dashboards: { uid: string; json: object }[] };
```

The check types of the first revision map onto this form as follows: `state` is a predicate over the `git`, `tf`, `ansible`, `files`, `units` domains; `output` is a predicate over `history` and `cmd.done`; `run` is `eval: run` followed by a predicate over `ci`/`ansible`/`tf.plan`; `idempotent` is the predicate `ansible.runs[n=2].hosts[*].changed=0`; `forbid` is a goal with negation (`not_matches`, `!`), not a separate type.

### 0.5. The documentation ladder (R2)

At work an engineer reads `man git-log`, the GitLab CI keyword reference, `ansible-doc`, a provider's resource page and the PromQL function reference every day. The course teaches this in stages: a beginner is not sent into the documentation from scratch, but by the end of a block the task cannot be solved without it.

| Step | Where in the block | What the learner sees | How it is checked | Level that starts at this step |
|---|---|---|---|---|
| 1. Glimpse | lessons in the first third of the block | Under a command, key or function in the text there is a small inline label "→ from the documentation" with a link to the exact anchor (`git-scm.com/docs/git-commit#Documentation/git-commit.txt--mltmsggt`). It can be left unopened | not checked; a click is written to the log (`doc.open`) | L0 |
| 2. Fragment as a hint | an H2-level hint in the trainers | Instead of hint text, a clipping of the real page with the needed line highlighted and the sections labelled (anatomy below) | the task counts as usual; an opened hint gives "Hard" in FSRS | L1 |
| 3. "Find the flag" | micro-tasks in every module of the second third | Only a link to the page or a help command, no clipping: "find the option in `git help log` that…" | by effect (`fill`: the command runs in a copy of the workbench and the state is checked), not by the text of the option | L2 |
| 4. Forcing | trainers in the last third of the block | The task requires an option, parameter or function that is not in any `introduces` of the route. No hints. A "where I found it" field — a link or a help command | normal check + a non-empty "where I found it" field; the mentor in `lab-docs` mode | all levels |
| 5. Exam with documentation | the block's practical exam | Only official documentation from the list is open; some tasks are built on things the course does not cover | by environment state | all levels |

**Page anatomy taught at step 2.** The section labels on the clipping are part of the lesson; by the end of the block the learner knows where to look for what on the page.

| Source | Sections that are labelled | Help commands |
|---|---|---|
| `man git-<command>` | NAME / SYNOPSIS / DESCRIPTION / OPTIONS / EXAMPLES / SEE ALSO; the notation `[<option>]`, `<commit>...` | `git help <command>`, `git <command> -h` (short help), `git help -a` |
| GitLab CI reference (`docs.gitlab.com/ci/yaml/`) | for a keyword: Keyword type / Supported values / Example / Additional details / Related topics | `glab ci lint`, the pipeline editor |
| GitHub Actions documentation | Workflow syntax: `on.<event>`, `jobs.<job_id>.<key>`; an action's Marketplace page: Inputs / Outputs | `actionlint` |
| `ansible-doc ansible.builtin.<module>` | OPTIONS (`=` — required, `-` — optional, `default:`), ATTRIBUTES (`check_mode`, `diff_mode`), NOTES, EXAMPLES, RETURN VALUES | `ansible-doc -l`, `ansible-doc -s <module>` (task skeleton), `ansible-doc -t filter -l`, `ansible-config dump` |
| Provider resource page (OpenTofu/Terraform Registry) | Example Usage / Argument Reference (Required, Optional; the note "Changing this forces a new resource") / Attributes Reference / Import | `tofu -help`, `tofu plan -help`, `tofu console` |
| The OpenTofu/Terraform language | Language → Resources / Meta-Arguments / Functions (for a function — signature and examples) | — |
| prometheus.io | Querying → Functions: the signature `rate(v range-vector)`, description, caveats; Configuration: the notation `<duration>`, `[ - <scrape_config> ... ]`, default values in brackets | `promtool --help`, `amtool --help`, `promtool test rules` |
| grafana.com/docs | Panels → Visualizations → `<type>`: Panel options / Standard options (Unit, Min, Max) / Thresholds | — |

**Tasks by step.** Each block has at least three step-4 tasks and two step-5 tasks; below are ready-made wordings, the rest are written to the same pattern.

| Block | Step 1 | Step 2 | Step 3 | Step 4 (not in the theory) | Step 5 (exam) |
|---|---|---|---|---|---|
| G | under the `git status` output, a label "this is from `man git-status`, section SHORT FORMAT"; on `git commit -m`, an OPTIONS anchor | G-D1: the hint is a clipping of `git-restore(1)` OPTIONS with `--staged` highlighted | "Show the history one line per commit with a branch graph" → link to `git-log`; check: the output contains a graph; "Find the `git log` option that shows the history of a single file across renames" → `--follow`, check: the output contains a commit from before the rename | "Find the commit in which the line `DEBUG=1` disappeared from the code" (`log -S`; check — the hash entered); "Show who last changed line 12 in `about.html`, ignoring whitespace edits" (`blame -w -L 12,12`); "Work in two branches at once in two directories" (`git worktree add`; check — two working trees) | "Find the commit that broke `test.sh` in no more than 7 steps" (`bisect run`, only mentioned in the course); "Move one commit from someone else's branch into yours without merging the branch" (`cherry-pick` with `-x`) |
| A | on `artifacts:paths` in A3, a label "Keyword reference → artifacts:paths"; on `rules:` in A-I6, "→ rules" | A-D4: a clipping of `tags` with "use tags to select a specific runner…" highlighted | "Limit the artifact retention period to one week" → `expire_in` (`yaml_path`); "Make the job run only when files in `docs/` change" → `rules:changes` (two simulator events) | "Let a failed `lint` not block the pipeline, but have the MR show a warning" (`allow_failure` on lint; a `keep` goal: tests do not have it); "Compare changes against `main`, not against the previous push" (`rules:changes:compare_to`); "Retry the job on a runner failure, but not on a test failure" (`retry:when: runner_system_failure`); "Cancel a branch's outdated pipeline on a new push" (`interruptible`) | `workflow:rules` with `auto_cancel`; `rules:exists` |
| B1 | in the `ansible-playbook` output, a label on a task: "module `ansible.builtin.apt` — `ansible-doc ansible.builtin.apt`" | B1-D3: a clipping of `ansible-doc ansible.builtin.lineinfile` with `regexp` and `line` highlighted; B1-D2: OPTIONS of the `template` module, the `mode` line | "Find the `lineinfile` parameter that creates the file if it does not exist" → `create`; a `run` check on a host without the file; "Install a package only if the apt cache is older than an hour" → `cache_valid_time` + an idempotency goal | "Continue the playbook from the failed task" (`--start-at-task`); "Run a task once for the whole group" (`run_once`); "Take the host out of the load balancer on lb1 before the update" (`delegate_to`); "Install a package from a .deb by URL" (`apt: deb:`) | a module the course never covered: `ansible.builtin.cron` or `ansible.builtin.get_url` with `checksum` |
| B2 | in the `plan` output, on `# forces replacement`, a label "Registry → `edu_vm` → Argument Reference" | B2-D1: a clipping of the `edu_vm` page with "Changing this forces a new resource" highlighted; B2-D3: a clipping of `validation` from Language → Variables | "Find the function that splits `10.0.0.0/16` into /24 subnets" → `cidrsubnet`, checked in `tofu console`; "Show the plan without refreshing state from the cloud" → `-refresh=false`, by effect | "Generate code for an imported bucket" (`plan -generate-config-out`); "Mark a VM for replacement without editing code" (`-replace`); "Make removing a DNS record from the code not delete it in the cloud" (`removed` with `lifecycle { destroy = false }`) | a `check {}` block or `precondition`; `terraform_data` with `replace_triggered_by` |
| C | on `rate` in C-I6, a label "prometheus.io → Query functions → rate()" | C-D5: a clipping of the `rate` description with "should only be used with counters" highlighted; C-D4: a clipping of `histogram_quantile` | "Find the function that returns 1 if a series has been absent for 10 minutes" → `absent_over_time` (`promql_equiv`); "How many times did the process restart in the last hour?" → `changes(process_start_time_seconds[1h])` | "Rename the `instance` label to `host` in the result" (`label_replace`); "Set a 2-hour silence from the terminal" (`amtool silence add`); "Check an alerting rule with a unit test" (`promtool test rules`, the test file format was never shown) | `promtool test rules` with `time()` arithmetic; `time() - process_start_time_seconds` as uptime |

**The mentor at step 4.** `doc_ladder.step` is passed into the mentor's context (09, 4.5, layer 3). For step 4 a `lab-docs` mode is added (a proposal for the mode table in 09, 4.5): "Do not name the command, option, parameter or function. Ask where the learner has looked. Name one official source and the section of the page (SYNOPSIS, OPTIONS, Argument Reference, Query functions) and a help command (`man`, `--help`, `ansible-doc`, `tofu <cmd> -help`, `promtool --help`), but not the line. If the learner has quoted the right line, confirm its meaning and explain how it is applied." The engine checks the answer against the task's dictionary of keys and, if a key appears in the answer, collapses the block, as in `lab` mode.

**Step 5, technically.** Most documentation sites cannot be opened in a frame (`X-Frame-Options`), so the exam shows a built-in viewer with **snapshots** of the permitted documentation from the `docs-snippets/` package (which also works offline through a Service Worker). Where a snapshot's licence does not allow this, the viewer opens an external tab with a domain from the list, and this is an honest self-check (09, 4.7). Permitted domains by block: G — `git-scm.com/docs`; A — `docs.gitlab.com/ci`, `docs.github.com/actions`; B1 — `docs.ansible.com`, `ansible-doc` in the terminal; B2 — `opentofu.org/docs`, `developer.hashicorp.com/terraform`, the `edu` provider page; C — `prometheus.io/docs`, `grafana.com/docs`.

**Fragment licences.** The `docs-snippets/` package contains a licence file per source, and every clipping shows its source and licence underneath.

| Source | Licence | How we use it |
|---|---|---|
| Git man pages | GPL-2.0 | clippings and a snapshot with the source stated |
| GitLab documentation | CC BY-SA 4.0 | clippings and a snapshot with attribution |
| GitHub Docs documentation | CC BY 4.0 | clippings with attribution |
| Ansible module documentation (`ansible-doc`) | GPL-3.0 (the texts live in the module sources) | generated in CI from `ansible-doc -j`, distributed as GPL-3.0 data |
| OpenTofu documentation | MPL-2.0 | clippings and a snapshot — the main source for block B2 |
| developer.hashicorp.com | its own terms of use | only a link in an external tab; the anatomy of a resource page is shown on the documentation of the `edu` provider, which we write ourselves |
| Prometheus documentation | Apache-2.0 | clippings and a snapshot |
| Grafana documentation | the licence of the documentation texts is verified against the repository before publication (`hold: true`) | for now, a link in an external tab and short quotes with attribution |

**Content linter.** A block has at least three step-4 tasks and two step-5 tasks; the key of a step-4 task is absent from all `introduces` and from the `flags.yaml` dictionary of introduced keys; a step-5 task does not appear before the block's exam; a `doc_fragment` in a hint exists only for step-2 tasks.

### 0.6. Process explanations (R3, R4)

Every block of this document gets process explanations, not only the flagship ones. All of them are `kind: mechanism` scenes built from the 08 primitives: `diagram` (a diagram bound to state), `stepper` (steps with a timeline), `breakit` ("break it" toggles with a prediction question), and `packets` where a message travels along a line. Rules for all explanations in the document:

1. **One screen, one idea.** Boxes, arrows, labels on the lines themselves ("`git push` over HTTPS", "`GET /metrics` every 15 s"), monospaced values. No characters, no plot, no decoration, no ink: only the "blueprint" hand from 08, 5.1.
2. **Animation shows only the process:** a commit square crawls along a line, a graph node lights up when created, a counter grows, a layer appears. In calm mode and under `prefers-reduced-motion` transitions are instant.
3. **Everything is clickable.** A click on a box or an arrow opens a card "what this is, who runs it, how to see it with a command" and a documentation link matching the ladder step.
4. **Parameters change the process immediately.** A slider or a switch recomputes the whole process, and a one-sentence explanation of the change appears next to the diagram ("`concurrent: 1` — jobs wait for a free slot: +40 s").
5. **"Break it" removes a component.** On the diagram the broken node gets a red outline and ⨯, the terminal shows the tool's real message, and a "Why" block appears under the diagram. Before flipping the toggle the learner predicts the consequence (08, 3.5).
6. **Steps can be rewound forwards and backwards and paused.** The state at time `t` is a fold of bus events up to `t` (08, 3.1), so rewinding does not roll anything back by hand. This is not a video.
7. **Live and recorded agree.** An explanation runs over the same bus events as the live simulator; any run the learner did in the terminal can be opened in the stepper as a walkthrough.

The document's explanations:

| ID | Process | Block | Section |
|---|---|---|---|
| E-GIT | What `git commit` and `git push` do: file → blob → tree → commit → ref → forge | G | 2.3 |
| E-CI | From `git push` to a running version | A (after A2, repeated in A7) | 3.4 |
| E-DEPLOY | How releases are rolled out: recreate, rolling, blue-green, canary | A5b | 3.4 |
| E-ANS | An idempotent Ansible run | B1 | 4.4 |
| E-TF | `terraform plan` and `apply`: code, state, cloud | B2 | 5.4 |
| E-REC | Four reconcilers: Ansible, Terraform, a controller, Argo CD | bridge B2 → Kubernetes | 5.5 |
| E-K8S-CODE | A cluster from code: from `tofu apply` to three Ready nodes | B3 | 6.3 |
| E-MON | From a counter in code to a message for the on-call engineer: scrape → store → PromQL → alert → notify | C | 7.4 |
| E-OTEL | The path of a trace: SDK → OTLP → Collector → backends | C14b | 7.4 |
| E-CG | Where container metrics come from: cgroup → cAdvisor → PromQL | C16 | 7.10 |

**Bus events.** For these explanations the 08, 3.0 bus needs additional types (a proposal for 08):

```ts
| { t: 'git.object'; kind: 'blob'|'tree'|'commit'|'tag'; oid: string; repo: string }
| { t: 'git.ref'; repo: string; ref: string; from: string; to: string; reason: string }       // also written by our reflog
| { t: 'ci.pipeline'; id: string; ref: string; source: string; status: string }
| { t: 'ci.job'; pipeline: string; job: string; status: 'created'|'pending'|'running'|'success'|'failed'|'canceled'|'skipped'|'manual'; runner?: string }
| { t: 'ci.cache'; key: string; hit: boolean; bytes: number }
| { t: 'ci.artifact'; job: string; paths: string[]; bytes: number; dir: 'up'|'down' }
| { t: 'deploy.shift'; env: string; from: string; to: string; share: number }               // share of traffic on the new version
| { t: 'ans.ssh'; host: string; module: string; phase: 'connect'|'transfer'|'exec'|'result' }
| { t: 'ans.task'; host: string; task: string; status: 'ok'|'changed'|'failed'|'skipped'|'unreachable'; diff?: string }
| { t: 'tf.step'; phase: 'parse'|'graph'|'refresh'|'diff'|'plan'|'confirm'|'apply'|'state.write'; addr?: string; action?: string }
| { t: 'tf.api'; method: string; path: string; status: number; addr?: string }
| { t: 'prom.scrape'; target: string; ok: boolean; samples: number; ms: number; error?: string }
| { t: 'prom.rule'; name: string; state: 'inactive'|'pending'|'firing'; value: number }
| { t: 'am.notify'; group: string; receiver: string; alerts: number; reason: 'group_wait'|'group_interval'|'repeat_interval'|'resolved' }
```

### 0.7. Visual language and what we take from Sankofa (R5)

The diagrams in these blocks use the colour tokens of 08, 5.2 and add their own where an entity has no colour. Colour always carries meaning and is duplicated by a shape or a label.

| Entity | Token | Duplicate shape |
|---|---|---|
| Job success / failed / running / pending / manual / skipped | `--c-ok` / `--c-err` / `--c-flow` / grey / `--c-warn` / grey dashed | ✓ / ⨯ / spinning arc (◐ in calm mode) / ◯ / ▶ / ⤼ |
| Terraform plan `+` / `~` / `-` / `-/+` / `<=` | `--c-ok` / `--c-warn` / `--c-err` / `--c-err` with a `--c-ok` outline / grey | the plan symbol itself in a monospaced font before the address |
| Ansible ok / changed / failed / skipped | `--c-ok` / `--c-warn` / `--c-err` / grey (as in Ansible output) | the letters `ok`, `ch`, `F`, `s` in a grid cell |
| Alert inactive / pending / firing / resolved | grey / `--c-warn` / `--c-err` / `--c-ok` | a timeline bar labelled with the state |
| Code and Git (new `--c-code`) | muted blue-grey | a sheet with a folded corner and a monospaced line |
| Terraform state (new `--c-state`) | muted purple | a "memory" card with the `serial` number |
| Cloud reality (new `--c-cloud`) | muted teal | a resource card with the cloud ID |
| Storage: TSDB, cache, registry (new `--c-store`) | dark ochre | a "barrel" shape |
| The three signals: metric / log / trace (new `--c-metric`, `--c-log`, `--c-trace`) | three muted shades | a graph line / a line of text / a horizontal span bar |
| Application process | `--c-user` | a rounded rectangle |
| Kubernetes components | `--c-cp`, `--c-node`, `--c-obj` from 08 | hexagon, "rack", document |

The values of the new tokens (light and dark themes, contrast ≥ 4.5:1 for text and ≥ 3:1 for lines) are chosen by the engine role in 08, 5.2. The terminal is the shared `terminal` widget from 08, 3.4; the output of `terraform plan`, `ansible-playbook` and the runner log is coloured the same way as in the real tools, so that the learner recognises those colours at work.

| Sankofa mechanism | How it is used in these blocks |
|---|---|
| `engine/scroll.ts` — scenes bound to scrolling | magazine-style presentation of the textbook text; in `mechanism` scenes scrolling drives the stepper's steps until the learner grabs the slider (08, 3.1) |
| Magazine typography, layers, expandable footnotes | chapter texts (the "Textbook plan" section in each block), term cards, the "Sources and verification" block |
| `engine/ink.ts` | only `data-ink` drawing of blueprint lines and `data-fade` appearance of nodes; the boiling line and `sketch` are not used in these blocks |
| `engine/calm.ts` — calm mode | every pipeline, plan and graph animation has a static variant: a finished diagram and a "next" button |
| `engine/qr.ts` | quizzes and review cards (terms, command options, plan symbols) continue on the phone; a "diagram on a second screen" for the E-CI, E-TF, E-MON explanations |
| Lenses (`Lens`) | only in the C13 postmortem: one timeline from the point of view of the roles "on-call SRE", "release author", "product lead". These are roles without names or faces, not characters |
| Bilingual YAML, `draft`/`hold`, the two-source rule, the "How we checked" screen | every factual statement in the theory is tied to two sources; a statement with one source is `hold: true` and does not get into the build. For tool behaviour the second source is a reproducible run on the real tool (section 9.2) |
| `mechanics/objects` (sequencer) | the "tracks × beats" model for the idempotency visualiser (tasks × runs) and the alert state timeline |
| `engine/clap.ts` (WebAudio) | one pager tone in the C13 incident; **off by default**, like all sound in the course (08, 4) |

The source of events in scenarios with "someone else's" actions (a manual edit in the cloud console, a commit in the forge while the learner was working) is a neutral log line without a name or motive: "14:02 `size_gb` of disk `disk-db` changed via the console (source: console, user `ops-2`)", "commit `4e1f0c2` from `bot@forge`".

### 0.8. Our own neural network

The overall integration is designed by 09, the pedagogical behaviour by 01, 14. These blocks define **what** is sent in the context: an exercise has an `ai_context` field — the task text, the current file, the last job log, the `plan` output, the PromQL parse tree with intermediate results, the documentation ladder step. The reference solution is not passed into the context (01, 14.4). Modes: `learn` in theory and explanations, `lab` in trainers, `lab-docs` on step 4 of the ladder (0.5), `exam` — the network is off in exams and level checks. Typical buttons: "Explain this log", "Why does the plan want to replace the resource", "What does this query compute", "Why is the task changed every time".

### 0.9. Levels, level checks, exams

The levels are called L0, L1, L2 and are defined in 01, 3 and 4.3. The only source of key tasks for level checks is 01, 4.3 (the blocks "CI/CD (with Git)", "IaC", "Monitoring"); the criterion is ≥ 80% and all key tasks, a "guess" confidence does not count, a retake is possible after 72 hours with a different variant. This document provides an **additional pool** of tasks in the format of the 10, 3.1 bank (`key: false`, `concepts` — graph IDs, `misconception` on wrong options, 3–5 parameterisation variants). The pool protects the check from memorisation and widens the variants; key tasks from the pool do not appear in quizzes of the same level (10, 3.5). A proposal for 01, 4.3: in every L1 and L2 check of these blocks, mark at least two practical tasks as key, as 10, 3.5 requires (currently there is one key task each).

The profile "programmer without operations experience" is, in this document, a typical L1 in IaC and monitoring and L2 in Git: the level definitions of 01 do not change. An experienced learner (L2) starts the documentation ladder at step 3, an intermediate one (L1) at step 2.

The blocks' practical exams follow the format of 10, section 6: a "shift at work" scenario, 60–120 minutes, 3–5 practical tasks (70%) and 2 `explain` questions (30%), a variant from a seed (names, ports, *which of 3–5 breakages*), `critical: true` on checks without which the exam is failed, the pass mark is all critical checks and ≥ 70%, a retake after 24 hours with a new variant, and the "with assistant / without" mode is recorded in the report. In addition, every exam has: `envs: [sim]` for exams in the simulator, `envs: [vm]` + `attest` for submitted tracks (B3, pet projects); `doc_ladder: { step: 5, allowed: [...] }`; `ai: off` for the built-in mentor.

### 0.10. The textbook (R1)

Every module in a block's curriculum has a **chapter thesis** (one sentence: what the learner should take away) and a **text plan** (5–8 statements in the order in which concepts are introduced). Explanations, interactives and trainers are tied to the statements of the plan: a trainer cannot check something that is not in the plan. The chapter texts are written by the content role, but the thesis and the plan are the block author's responsibility; in this document they are given for the core modules (G2, G4–G5, A1, A3, A5b, B1-5, B2-4, C2, C6, C11), and for the rest as a thesis in the curriculum table.

---

## 1. Methodology: what this document takes from block 07

The methodology block (07) introduces M13–M17: continuous integration as a team agreement, Continuous Delivery as "every change is ready for release, the release is a human decision", Continuous Deployment as "release without a manual step", the pipeline as a concept, and the five DORA metrics according to dora.dev (change lead time, deployment frequency, failed deployment recovery time, change failure rate, deployment rework rate). This document redefines none of this and uses it as follows:

- **A-I6 "One line"** (section 3) is the "concept → code" bridge: the line `when: manual` on the production job distinguishes Delivery from Deployment. Here also are the quiz questions that are impossible in 07 because Git has not yet been introduced: "Every merge into main ends up in production 20 minutes later — which practice is this?", "A developer keeps a branch for three weeks, but tests run on every push — is this CI?".
- **E-CI** (section 3.4) labels the manual-step switch on its last screen with the same words as 07 (M15, M16).
- **C13, the postmortem**, relies on M12 (a blameless incident) and calculates the "failed deployment recovery time" on the real incident data.
- **A5b, deployment strategies**, shows why small batches and rollback reduce the change failure rate, with a reference to E10 "Five instruments".

The "Conveyor" screen with three "gates" (CI, Delivery, Deployment on sections of the conveyor) is handed over to 07 as a storyboard in the R4 style, without a human figure at the button.

---

## 2. Block G. Git

Git is cut into two parts along the graph: **G-local** is the last module of the Linux block, **G-remote** is the first module of the CI/CD block (0.1). Git has no separate level check: G-local is closed by the Linux level check (the pool tasks below are added to it with `block: linux`), G-remote by the "CI/CD (with Git)" check from 01, 4.3.

### 2.1. Levels and additional check pool

| Level | What it means for Git |
|---|---|
| L0 | Has never used a version control system; knows files and directories from the Linux block |
| L1 | Has committed and pushed through an IDE or by following instructions; unsure about branches, merges and conflicts |
| L2 | Works with branches and merge requests every day; does not necessarily know objects, refs, reflog and the difference between merge, rebase and squash for history |

Pool (`key: false`, each with 3–5 variants of file and branch names):

1. *(L1, P)* "In `~/site`, `index.html` has been modified and there is a new `notes.txt`. Commit only `index.html` with the message `Fix title`." Goal: `git.repos[path=~/site].log[0]` changes exactly `index.html`; the status of `notes.txt` is `[notes.txt, 0, 2, 0]` (untracked). Concepts C16, C02.
2. *(L1, P)* "Create a branch `feature/contacts`, add `contacts.html` in it, go back to `main` and merge the branch." Goal: the file is in `main`, the branch exists, the branch's commit is an ancestor of `main`. Concepts C17, C03.
3. *(L1, P)* "`git pull` reported a conflict in `about.html`. Keep both lines and finish the merge." Goal: no `<<<<<<<`, `=======`, `>>>>>>>` markers, both lines present, the last commit has two parents. Concepts C03, C04.
4. *(L2, P)* "The branch `feature/x` has five commits, three of them `wip`. Before the merge request, leave one commit with a meaningful message in the branch without changing the final content." Goal: the tip of the branch has one parent, and it is the current `main` (if the learner first did `rebase main`, that is also correct); the tip's tree equals the original tip's tree carried over onto the current `main`. Accepted: `rebase -i`, `reset --soft main && git commit`, `merge --squash`. Concept C18.
5. *(L2, P)* "You ran `git reset --hard HEAD~2` and lost two commits. Get them back." Goal: the branch points at the original commit; no hints. Works thanks to our own reflog layer (0.3). Concept C20.
6. *(L2, E)* "How does `revert` differ from `reset`, and why is the former used on a shared branch?" Rubric: revert adds a new commit; reset moves the ref and rewrites history; rewritten history diverges from colleagues' copies; the server needs a force-push. Pass: 3 out of 4.

### 2.2. Curriculum

| Module | Chapter thesis | L0 | L1 | L2 |
|---|---|---|---|---|
| G1. Why versions | A repository remembers every saved state of the project and lets you return to it | in full | skip on check | skip |
| G2. The three places of a file | A file lives in the working directory, gets into the index with `add` and becomes part of history with `commit` | in full | review with an interactive | overview |
| G3. History | A commit is named by its hash, and history is a chain of parents | `log`, `show`, `diff` between commits | `log --oneline --graph`, `blame` | — |
| G4. Branches | A branch is a movable name tag on one commit, HEAD is the "I am here" tag | in full | in full | overview |
| G5. Merge and conflict | A merge joins two lines of history; a conflict is a place where Git cannot decide for a human | fast-forward, merge commit, conflict | same | merge, rebase, squash: what stays in history |
| G8a. Local hygiene | What did not get into the repository will not leak; what did get in stays in history forever | `.gitignore`, secrets are not committed, commit messages | Conventional Commits | — |
| G9. Inside Git | Everything in Git is objects named by the hash of their content; a branch is a file with one hash | — | overview (E-GIT) | in full (E-GIT + `cat-file`) |
| G6. Remote repository | A remote repository is another copy of the history; a push is accepted only if it continues it | remote, `clone`, `push`, `fetch`, `pull`, origin/main | upstream, `pull --rebase` | forks |
| G7. Working together | A merge request is a proposal to merge a branch that others see, discuss and check | merge request in the training forge, review, protected branch | trunk-based and GitHub flow | GitFlow and why it fits poorly with CI (M14) |
| G8b. Undo and recovery | There are two ways to undo: add an inverse commit or move the ref | tags and semver | `revert` versus `reset`, `cherry-pick` | `reflog`, `bisect` |

### 2.3. Textbook plan and the E-GIT explanation

**G2. The three places of a file.** Thesis: a file passes through three places, and `git status` always tells you where it is now.
1. The working directory holds ordinary files that you edit in an editor (builds on L04).
2. The repository remembers snapshots that you saved explicitly, not every keystroke.
3. Between them stands the index: this is where you put what will go into the next snapshot.
4. `git add` puts the file's current content into the index; if you edit the file after `add`, the old content stays in the index.
5. `git commit` turns the index into a snapshot with an author, a time and a message.
6. `git status` and `git diff` / `git diff --staged` answer the question "where does what differ".
7. `git restore` and `git restore --staged` move a file one step back.
Comprehension check: `predict` — "what will `git status` show after editing a file that has already been added to the index?".

**G4–G5. Branches and merging.** Thesis: a branch copies nothing, it only points at a commit, so creating one costs nothing.
1. A commit knows its parent, so history is a chain that can be walked backwards (builds on G3).
2. A branch is a name stuck to one commit; on a new commit the name moves to it.
3. HEAD is a pointer to the current branch; `git switch` re-sticks HEAD.
4. If one branch is a direct continuation of another, a merge simply moves the name (fast-forward).
5. If the branches have diverged, Git creates a commit with two parents.
6. A conflict arises when both branches changed the same lines; Git marks them with markers and waits for a human decision.
7. After the conflict is resolved, the file is added to the index and the merge is completed with a commit.
Comprehension check: the "prediction" mode in G-I2 on five command sequences.

**E-GIT "What `git commit` and `git push` do".** A `mechanism` scene, a stepper over the learner's live repository.

| Screen | On screen and what moves | Parameters | "Break it" | Explanation on change |
|---|---|---|---|---|
| 1. File → blob | On the left the file `index.html` (`--c-code`), on the right an empty object store. The arrow "`git add`: compress and name by the hash of the content" is drawn, and a blob card `a1b2c3…` appears | A "change one line" field | — | When a line is edited, a new blob with a different hash appears and the old one stays: "Git does not change objects, it creates new ones" |
| 2. Index | The index table: path → blob hash. The `index.html` row switches to the new hash | A "edit after `add`" switch | — | A note "the index has the old version, `git status` will show the file twice" |
| 3. Tree | A tree is assembled from the index: a list of names and hashes. Unchanged files refer to the same blobs | Number of files in the project, 1–20 | — | A counter of "new objects per commit": only what changed changes, plus the tree |
| 4. Commit | The commit card: tree, parent, author, time, message. An arrow to the parent | — | "Empty message" → rejection `Aborting commit due to empty commit message` | — |
| 5. Ref | The file `refs/heads/main` with the hash is rewritten; a line is added to the reflog | — | — | "A branch is 41 bytes: a hash and a newline" |
| 6. Push | A forge appears on the right. Only the objects the forge does not have travel along the `git push (HTTPS)` line; there is an object counter on the line | A "the forge already has someone else's commit" switch | With the switch on → `! [rejected] main -> main (fetch first)`, the arrow turns red | "The forge accepts a push only if your commit continues its history" |

A click on any card runs `git cat-file -p <oid>` in the learner's terminal and shows the real output. The source of the steps is the `git.object` and `git.ref` events.

### 2.4. Interactives

**G-I1. "The three places of a file".** Three columns: "Working directory", "Index", "Repository", with a terminal below. A file is a card; `add`, `restore --staged`, `commit`, `restore` move cards between columns, and the other way round, dragging a card types the corresponding command into the terminal, and the learner presses Enter. Changed lines on a card are highlighted; a chain of commits grows in the "Repository" column.

**G-I2. "Commit graph".** A live graph built from the repository data: commit circles, branch labels, a separate HEAD label; it updates after every command. On a fast-forward the label slides without a new circle. "Prediction" mode: before a command the learner drags the labels to where they will end up; then the command runs and shows the discrepancy. The main trainer for understanding branches.

**G-I3. "Conflict".** An editor with three panes (our version, their version, the result) and "take ours / theirs / both" buttons, with the raw file with markers alongside. The conflict can be resolved in the pane or by editing in the terminal (the Workbench's `nano`/`vi`).

**G-I4. "Training forge".** A project page, branches, merge requests with a diff, a Merge button, discussion and pipeline status (used in block A). The remote repository is a second gitdir in memory; push and fetch go through the wrapper from 0.3, and a non-fast-forward rejection gives the real Git text. So that the learner runs into falling behind and conflicts, the forge itself adds a commit from `bot@forge`, and a neutral line "`4e1f0c2` added to main" appears in the MR feed.

### 2.5. Trainers

| ID | Task | Goals |
|---|---|---|
| G-D1 | 10 micro-tasks "move the card": into the index, out of the index, discard an edit | `git.repos[].status` after each; the step-2 hint is a clipping of `git-restore(1)` |
| G-D2 | "Predict the graph": 15 command sequences | the positions of the branches and HEAD match |
| G-D3 | Three conflicts of increasing difficulty: one line; overlapping blocks; modification versus deletion (modify/delete) | no markers, content equals the reference, the commit has two parents; for modify/delete, the file is kept or deleted as the task specifies |
| G-D4 | "Push rejected": someone else's commit has appeared in the forge; `pull --rebase` or `pull` + merge, then push again | the branch in the forge contains both commits; for the rebase variant the history is linear |
| G-D5 | "A secret in history": a commit contains `config.env` with a password, and the commit is already in the forge | `git rm --cached`, `.gitignore`; a quiz: the password must be changed because the history is already on the server (`misconception: git.rm-erases-history`) |
| G-D6 | "Undo someone else's commit on a shared branch" | a new `revert` commit, the history of `main` in the forge is not rewritten (`keep`: the old hashes are in place) |
| G-D7 *(L2)* | "Find the commit after which `./test.sh` stopped passing" | the hash entered; step 3 — a link to `git-bisect` |
| G-D8 | Step-4 tasks from the table in 0.5 (`log -S`, `blame -w -L`, `worktree`) | by effect + the "where I found it" field |

### 2.6. G-remote practical exam (self-check, `envs: [sim]`)

Scenario "First day on the team", 60 minutes, `doc_ladder: { step: 5, allowed: [git-scm.com/docs] }`.

| Task | Weight | What to do | Checks |
|---|---|---|---|
| t1 | 25 | Clone the project from the forge, create a branch for the task, fix two files, make two meaningful commits | `critical`: a branch in the forge with two commits; 5 points: the messages are not empty and not "fix"; `.gitignore` did not let `node_modules/` through |
| t2 | 25 | `main` has moved ahead: update the branch, resolve the conflict, open a merge request | `critical`: no conflict markers in the MR; the branch contains the current `main` |
| t3 | 20 | Review from `bot@forge`: "remove the debug print" — fix it in a separate commit and merge | the MR is merged, `main` has no debug line |
| t4 | — (variant from the seed) | One of four breakages: a lost commit after `reset --hard` (reflog); a secret in the last commit; a broken test after someone else's commit (`bisect`); a branch accidentally merged into `main` (revert) | the breakage's goals; `keep`: the history of `main` in the forge is not rewritten |
| explain | 30 | "Team lead: why did you update the branch with rebase rather than merge, or the other way round?"; "What happens if you force-push to `main`?" | rubric: history and its readability; colleagues' copies diverge; protected branch |

`pass: { critical: all, total_min: 70 }`.

### 2.7. Y1 for the Linux block (L31) and the Y-traps lesson

**Y1. YAML and JSON** is handed over to the Linux block (02) as lesson L31 after scripts. One facet per screen: document and key-value → mapping → list → nesting by indentation (spaces only) → strings and multi-line `|` and `>` blocks → the same document in JSON. Interactive **Y-I1 "YAML through the parser's eyes"**: YAML on the left, the data tree and JSON on the right; an indentation error highlights the line and shows how the tree changed. Trainer **Y-D1**: 20 broken fragments (tabs, extra indentation, a colon without a space, an unclosed quote) — the parser reports no errors and the tree equals the reference. The parser is `yaml` (eemeli) v2.

**Y-traps. Type traps** (C30) is the first lesson of the CI/CD block, before A1. The same interactive with a switch between YAML 1.1 and 1.2 parser modes: `version: 1.10` becomes the number 1.1; `mode: 0755` in YAML 1.1 is the octal number 493; `country: NO` in YAML 1.1 is `false`; the key `on:` in GitHub Actions is parsed by a YAML 1.1 parser as `true`, but GitHub itself reads it as a key. The explanation: different tools understand the same text differently, so string values are put in quotes. Trainer **Y-D2**: 8 fragments from real CI and compose files, where the learner adds quotes so that the tree matches in both modes.

### 2.8. Sources for G and YAML

- EN: Pro Git — https://git-scm.com/book/en/v2 ; Git reference — https://git-scm.com/docs ; Learn Git Branching — https://learngitbranching.js.org/ ; isomorphic-git, alphabetic API list — https://isomorphic-git.org/docs/en/alphabetic ; isomorphic-git fs — https://isomorphic-git.org/docs/en/fs ; git reflog format — https://git-scm.com/docs/git-reflog ; YAML 1.2.2 spec — https://yaml.org/spec/1.2.2/
- RU: Pro Git in Russian — https://git-scm.com/book/ru/v2 ; Learn Git Branching (Russian locale) — https://learngitbranching.js.org/?locale=ru_RU ; GitHub Docs in Russian — https://docs.github.com/ru/get-started/using-git

---

## 3. Block A. CI/CD in practice

### 3.1. Key decisions

**The primary platform is GitLab CI, the secondary one is GitHub Actions.** The checklist and its pet projects are built on GitLab CI, which dominates the Russian market; internationally and in open source GitHub Actions dominates. The learner goes through the modules on GitLab CI, and in A6g moves the same pipeline to GitHub Actions and sees that the concepts are the same and the syntax is different. The EN version of the product puts both platforms on an equal footing, with a choice at the start of the block; the RU version defaults to GitLab.

**One simulator, two input syntaxes.** Both `.gitlab-ci.yml` and `.github/workflows/*.yml` are translated into a common intermediate representation executed by one engine; the behaviour of the runner, cache, artifacts and logs is implemented and shown in the same way.

```ts
// pipeline IR — shared by GitLab CI and GitHub Actions
interface PipelineIR {
  source: 'gitlab' | 'github';
  trigger: { event: 'push' | 'merge_request' | 'tag' | 'schedule' | 'manual'; ref: string; changedFiles: string[] };
  stages: string[];                    // in GitHub Actions computed from needs
  jobs: JobIR[];
}
interface JobIR {
  id: string;
  stage?: string;
  needs: { job: string; optional: boolean; artifacts: boolean }[];   // explicit needs or "all jobs of previous stages"
  image?: string;                      // GitLab image / GitHub container
  runsOn?: string[];                   // GitLab tags / GitHub runs-on
  services: string[];
  steps: StepIR[];                     // before_script + script + after_script or steps[]
  variables: Record<string, string>;
  rules: RuleIR[];                     // rules / if / on.paths / when
  when: 'on_success' | 'manual' | 'always' | 'on_failure' | 'never';
  allowFailure: boolean;
  artifacts?: { paths: string[]; expireIn?: string; reports?: { junit?: string } };
  cache?: { key: string; paths: string[]; policy: 'pull-push' | 'pull' | 'push' }[];
  environment?: { name: string; url?: string; action?: 'start' | 'stop' };
  resourceGroup?: string;              // GitLab resource_group / GitHub concurrency
  retry?: { max: number; when: string[] };
  interruptible?: boolean;
  timeoutSec?: number;
  matrix?: Record<string, string[]>;
  srcRange: { file: string; line: number };
}
type StepIR = { kind: 'run'; script: string } | { kind: 'uses'; action: string; with: Record<string, string> };
```

**Job scripts run for real; heavy tools run as models with a closed list of behaviours.** Each job gets a clean Workbench machine from an image profile (`alpine`, `node`, `python`, `docker` — the profiles are supplied by the Docker role; versions come from `content/versions.yaml`), a cloned repository and variables. Script lines are executed by the Workbench shell; the tests of the training projects are real scripts. `docker build/push` is executed by dsim (04), `kubectl` and `helm` by kube-lite (05), `npm ci`, `pip`, `go build` by the models from 0.3.

**The log format copies the real GitLab Runner**, because reading a job log is a transferable skill. The runner version is substituted from `versions.yaml`, and the text is checked against a real runner of the same version (9.2):

```
Running with gitlab-runner {{versions.gitlab_runner}} (edu)
  on edu-docker-runner-1 t3_xY9k, system ID: s_4f1e
Preparing the "docker" executor
Using Docker executor with image node:{{versions.node_lts}}-alpine ...
Pulling docker image node:{{versions.node_lts}}-alpine ...
Preparing environment
Getting source from Git repository
Fetching changes with git depth set to 20...
Checking out 1a2b3c4d as detached HEAD (ref is main)...
Restoring cache
Checking cache for npm-main-protected...
No URL provided, cache will not be downloaded from shared cache server. Instead a local version of cache will be extracted.
Successfully extracted cache
Downloading artifacts
Executing "step_script" stage of the job script
$ npm ci
added 214 packages in 9s
$ npm run build
Saving cache for successful job
Creating cache npm-main-protected...
node_modules/: found 4120 matching artifact files and directories
No URL provided, cache will not be uploaded to shared cache server. Cache will be stored only locally.
Created cache
Uploading artifacts for successful job
Uploading artifacts...
dist/: found 12 matching artifact files and directories
Cleaning up project directory and file based variables
Job succeeded
```

**Linting uses the real schemas.** For GitLab, the official JSON Schema `ci.json` (draft-07, from the GitLab repository, `app/assets/javascripts/editor/schema/ci.json`) via ajv, plus semantic checks the schema does not do: `needs` on a non-existent job; `needs` on a job in a later stage; `needs` on a job that `rules` may exclude, without `optional: true`; a stage not declared in `stages`; a cycle in `needs`; a job without `script`. For GitHub Actions, **actionlint** in wasm (this is how its official playground works) plus the `github-workflow.json` schema from SchemaStore. Errors are shown in the editor (CodeMirror 6 + `@codemirror/lang-yaml`) on the relevant line.

### 3.2. Levels and additional check pool

| Level | What it means for CI/CD (01, 4.3) |
|---|---|
| L0 | Has never seen pipelines; has completed Linux, networks, Docker and G-local |
| L1 | Has committed and pushed and seen green CI checkmarks, but has not edited a pipeline; confuses cache and artifacts |
| L2 | Works with branches and merge requests and has edited a CI file, but has not built a pipeline from commit to deployment: DAG, rules for MRs and tags, protected variables, environments, reuse |

Pool (`key: false`; goals are over `ci` facts):

1. *(L1, P)* "Three jobs in one stage, `test`. Make `build` run before `test`, and `deploy` run last." Goal: `finishedAt(build) < startedAt(test) < startedAt(deploy)`, `stages` declared. Concept: the "stage" facet of C08.
2. *(L1, T, match)* "`node_modules` between pipelines; `dist/` from build to deploy; a JUnit report for the MR" — with `cache`, `artifacts`, `artifacts:reports:junit`. Wrong pairs carry `misconception: ci.cache-passes-results`. Concepts C09, C23.
3. *(L1, T)* "In the `feature/x` branch `$DEPLOY_TOKEN` is empty, in `main` it is set. Why?" Correct: the variable is Protected. Concept C12.
4. *(L1, P)* "Fix the YAML": a stage is not declared, `script` is a string outside a list, `needs` has a typo. Goals: `lint` = 0, the run succeeds.
5. *(L2, P)* "The backend and frontend tests are independent, deploy waits for both, and the frontend linter must not delay the backend tests — restructure using `needs`." Goal: modelled time ≤ reference + 5%, no extra edges in the `needs` graph. Concept C26.
6. *(L2, P)* "Production only from `vX.Y.Z` tags and only manually; in an MR, only tests." Goal: runs on `push main`, `merge_request`, `tag v1.4.0`, `tag test-1` produce the expected sets of jobs. Concept C24.
7. *(L2, T)* "A secret leaked into the log even though the variable is Masked." The script has `echo $TOKEN | base64`. Correct: masking looks for the exact value, and a transformed value is not masked. `misconception: ci.masked-is-encryption`.

### 3.3. Curriculum

| Module | Chapter thesis | Content | L0 | L1 | L2 |
|---|---|---|---|---|---|
| A1. The first pipeline | A pipeline is a file in the repository that the forge reads on every push and turns into jobs | runner (C07), pipeline file, job, script, log, status (C08), exit code (C10) | in full | briefly | skip |
| A2. Stages and runners | A job runs not on the forge but on a runner, which picks up the work itself | stage, runner, shell/docker executor, job image (C22), runner tags, a "stuck" job; the kubernetes executor — `forward: [K01]` with a card "the runner can launch jobs in a cluster, we will come back to this in A7" | in full | in full | runners and executors |
| A3. Artifacts and cache | An artifact passes a result onward and must arrive; a cache only speeds things up and may disappear | artifact (C09), cache (C23), cache keys, `policy: pull`, distributed cache on shared storage | in full | in full | keys from the lock file |
| A4. Variables and secrets | A secret lives in the forge settings, not in the repository, and is given only to the jobs entitled to it | predefined variables (`CI_COMMIT_SHA`, `CI_COMMIT_REF_NAME`, `CI_PIPELINE_SOURCE`), custom variables, Masked, Masked and hidden, Protected, environment scope, File variables (C12); OIDC tokens — `forward` with a card for L2 | in full | in full | + OIDC overview |
| A4b. An image in CI | The pipeline builds an image once and publishes it with the commit tag | `docker build` in a job via the `docker:dind` service, the tag `$CI_COMMIT_SHORT_SHA`, the forge registry (C11) | in full | in full | briefly |
| A5. Environments and deployment | An environment is a place a version is rolled out to, and the forge remembers what was rolled out there and when | environment staging/production, manual run, deployment history, rollback by re-running an old job (C25); A-I6 "One line" | in full | in full | + review apps, `resource_group` |
| A5b. How releases are rolled out | A deployment replaces the old version with the new one, and the way it is replaced decides how many users suffer from a bug | deployment to a VPS over SSH and compose (C13); recreate, rolling, blue-green, canary, rollback (C14); the E-DEPLOY explanation | in full | in full | in full |
| A6. Rules and shape | A single-file pipeline behaves differently in an MR, in `main` and on a tag | `rules: if/changes/when`, `workflow: rules` (C24), `needs` (C26), `parallel:matrix`, `default`, `extends`, `include` (C27), `allow_failure`, `retry`, `timeout` | `rules` basics | in full | in full |
| A6g. GitHub Actions | The concepts carry over, the words change | `on`, `jobs`, `runs-on`, `steps`, `uses: actions/checkout`, `actions/cache`, `upload-artifact`/`download-artifact`, `secrets`, `environment` with reviewers, `concurrency`, reusable workflows, `strategy.matrix` (C31) | in full | in full | in full |
| A7. Deploying to Kubernetes | CI either changes the cluster itself (push) or writes the desired state to Git and the cluster pulls it (pull) | section 3.7 (C28, C29) | overview | in full | in full |

### 3.4. Textbook plan and the E-CI, E-DEPLOY explanations

**A1. The first pipeline.** Thesis: a pipeline is a file in the repository, and everything CI does is written in it.
1. Every push to the forge is an event; the forge checks whether the commit contains a `.gitlab-ci.yml` file (builds on C04, C30).
2. The file describes jobs: a job has a name and a script — the same commands you would type by hand.
3. The forge does not run the script itself: it queues the job, and a runner on another machine picks it up.
4. The runner executes the script lines one by one and sends the output back — this is the job log.
5. If any command returned a non-zero code, the job ends with the status failed (builds on L19).
6. The pipeline status is visible in the MR, and it is a signal to the team: "the main branch is broken, fix it first" (builds on M14).
Comprehension check: A-D2 "why is the pipeline red" — find the line in the log.

**A3. Artifacts and cache.** Thesis: an artifact and a cache both "keep files between jobs", but the first must arrive and the second may disappear.
1. Every job starts on a clean machine: everything the previous job created is gone (builds on C22).
2. An artifact is a set of files that the runner uploads to the forge after a job and hands out to subsequent jobs and to people.
3. If an artifact is not declared, the next job fails: `dist/: No such file or directory`.
4. A cache is a set of files that the runner keeps locally or in shared storage so that the next run is faster.
5. The cache key decides who will see it: the branch, the lock file, everyone.
6. Without a cache a job succeeds but is slower; without an artifact it fails. That is the test of "which one do you need".
Comprehension check: A-I3 "Two shelves" with the second runner switched off.

**A5b. How releases are rolled out.** Thesis: the way the old version is replaced with the new one decides how many users see a bug and how quickly it can be undone.
1. Deploying to a single server from CI: an SSH key in a File variable, `ssh deploy@host 'docker compose pull && docker compose up -d'`, `resource_group: production` against two simultaneous deployments (builds on N18, D21, C25).
2. Recreate: stop the old one, start the new one — there is always downtime.
3. Rolling: replace one instance at a time — no downtime, but for a while both versions run.
4. Blue-green: bring up the new one alongside and switch traffic at once — instant rollback, double resources.
5. Canary: send 5% of traffic to the new one, watch the error rate, then 50%, 100% — a bug affects few people (builds on N19; the error rate from monitoring — `forward: [O06]`).
6. A rollback is also a deployment: the previous image tag, Re-deploy of an old environment job.
Comprehension check: E-DEPLOY, the "new version returns 500" toggle with a prediction.

**E-CI "From `git push` to a running version".** A left-to-right diagram: `working directory` (`--c-code`) → `forge` → `pipeline` → `job queue` → `runner` → `image registry` (`--c-store`) → `staging` → `production`. The commit square `1a2b3c4` is the only moving object.

| Screen | On screen and what moves | Parameters and switches | "Break it" | Explanation on change |
|---|---|---|---|---|
| 1. Push | The arrow `git push (HTTPS/SSH)` labelled "objects + ref main"; the commit square travels to the forge | — | "push rejected (not fast-forward)" → the arrow turns red, the terminal shows `! [rejected]` | "The forge accepts a push only on top of its own history" |
| 2. Pipeline created | The forge reads `.gitlab-ci.yml`; job cards with the status created appear | Event: push to a branch / MR / tag | "pipeline file with an error" → no pipeline, `jobs config should contain at least one visible job` or a schema error with the line | When the event changes, the set of jobs is recomputed by `rules`; on the right, a list "why this job is / is not here" |
| 3. Queue | Jobs are pending; arrows `POST /api/v4/jobs/request` run from the runners to the forge, labelled "polling every 3 s" | Number of runners 1–4; `concurrent` 1–4; runner tags | "switch off the runner tagged docker" → `This job is stuck because you don't have any active runners online or available with any of these tags assigned to them` | The "time in queue" counter is recomputed immediately: "`concurrent: 1` — +40 s" |
| 4. Inside the runner | The job's timeline is split into segments: pull image → clone → restore cache → script → save cache → upload artifacts | `cache: on/off`; `GIT_DEPTH` 1/20/0 | "image does not exist" → `ERROR: Job failed: failed to pull image`; "cache unavailable" → the job is green but longer | Without the cache the `npm ci` segment grows from 9 to 52 s: "a cache speeds things up but may disappear — the build still succeeds" |
| 5. Artifact | `dist/` travels from `build` to `deploy` along the arrow "via the forge, not via the runner" | `needs` / stages | "artifact not declared" → `deploy` fails with `dist/: No such file` | With `needs`, the pipeline bar is rearranged into a graph, labelled "−N s" |
| 6. Image | `build-image` → registry: the arrow `docker push registry/web:$CI_COMMIT_SHORT_SHA` | Tag: `:sha` / `:latest` | "tests come after deploy" → an unchecked version is on staging, and the smoke test catches the bug only there | Explanation: "an immutable tag always shows what has been rolled out" |
| 7. Environments | `deploy` → staging → production; production has a ▶ button | `when: manual` on production on/off | "a test fails" → the arrow to staging is not drawn, label "exit code 1 → job failed → subsequent stages skipped" | The label of the last segment changes: "Continuous Delivery" ↔ "Continuous Deployment" (M15, M16) |
| 8. Feedback | The status returns to the MR, an entry appears in the environment history | — | — | — |

A click on any arrow opens a card "what this is, who initiates it, where to see it" (`CI_PIPELINE_SOURCE`, the runner log, the Jobs page, Environments). In A7 the same stepper gets a ninth screen: "`kubectl`/`helm` in the job → the kube-lite API server → a new ReplicaSet".

**E-DEPLOY "How releases are rolled out".** Diagram: a load balancer on the left, on the right a row of four application instances, each with a version label (`v1` / `v2`). Request dots travel along the lines to the instances; a request that got a 500 goes out with a red cross. Under the diagram are the counters "users with an error", "seconds of downtime", "instances now" and the deployment timeline.

| Screen | On screen and what moves | Parameters | "Break it" | Explanation on change |
|---|---|---|---|---|
| 1. One server over SSH | CI job → arrow `ssh deploy@host` → `docker compose pull && up -d`; the `v1` container goes out, `v2` lights up | `resource_group` on/off | "two pipelines deploy at the same time" without `resource_group` → the server runs whichever version was rolled out last, not the new one | "`resource_group` queues deployments to the same environment" |
| 2. Recreate | All four `v1` go out, then the `v2` light up; request dots in between go out | Start time of the new version 1–30 s | — | Downtime counter = start time |
| 3. Rolling | Instances are replaced one at a time | `maxSurge`, `maxUnavailable` 0–2 (the same words will appear in K12) | "new version returns 500" → errors grow in steps until the deployment is stopped | "Both versions run at the same time: the API must be compatible" |
| 4. Blue-green | A second set of four `v2` comes up alongside, the load balancer switches its arrow in one move | Switch delay | "new version returns 500" → everyone gets errors at once, but the rollback is one switch back | The "instances now" counter shows 8: the price of instant rollback is double resources |
| 5. Canary | A share of the traffic goes down the line to one `v2` | Slider "share to the new one" 5 / 25 / 50 / 100%; auto-stop threshold on the 5xx rate | "new version returns 500" → 5% suffer, the deployment stops at the threshold | "One user in twenty saw the bug, not every user" |
| 6. Rollback | Re-deploy of the previous tag on the environments page | Method: Re-deploy / `git revert` + a new pipeline | — | "Rolling back to the old tag is faster: the image is already built and checked" |

The source of the steps is the `deploy.shift`, `ci.job` and `net.packet` events.

### 3.5. Interactives

**A-I2. Pipeline builder.** The main interactive of the block (the `constructor` widget, 08, 3.7).
- *Canvas.* A palette of ready-made jobs from the training project (`lint`, `unit-test`, `build`, `build-image`, `scan-image`, `push-image`, `deploy-staging`, `smoke-test`, `deploy-production`, an empty job); columns are stages, cards are jobs, lines are dependencies (implicit "the whole previous stage" in grey dashes, explicit `needs` as solid lines, the label on the line says what is passed: "artifact `dist/`", "nothing, only order"). YAML on the right; the link is two-way (the `yaml` Document API preserves comments). The layout is a manual 8 px grid by stage, with no automatic rearrangement of nodes between steps (08, 3.2).
- *Run.* "Run" commits the file and starts the pipeline on the selected event. Cards are coloured by status with a duplicate shape (0.7); the timeline shows parallelism and waiting for a runner. A click on a card opens the log.
- *Runners.* Two or three cards with tags and `concurrent`; switching a runner off changes the queue immediately.
- *Break it.* Toggles: a test fails; an artifact is not declared; an image does not exist; a variable is not set; the cache is unavailable; a timeout; a flaky test with `retry: 2`; deploy before tests. Every toggle comes with a prediction.

**A-I3. "Two shelves".** Two pipelines in a row. Above the runners is a cache shelf (`--c-store`) with key labels, above the pipeline an artifacts box. Pipeline 1: no cache, `npm ci` is slow, the shelf fills up; `build` puts `dist/` into the box, `deploy` takes it out. Pipeline 2 on a different branch: a different key, the shelf is empty; the learner changes `key` to `$CI_COMMIT_REF_SLUG` or `files: [package-lock.json]` and sees the difference. Switching off the second runner shows that one runner's local cache is not visible to another without shared storage.

**A-I4. "Variable settings".** The Settings → CI/CD → Variables screen: key, value, type (Variable/File), Protected, Masked, Masked and hidden, environment scope. The job log is on the right; changing a flag reruns the job. Visible: `[MASKED]` in the log, an empty value in an unprotected branch, a refusal to save a value that is too short with the Masked flag, a leak via `base64`. For GitHub: Secrets and variables, and the rule that secrets are not passed to workflows from forks.

**A-I5. "Environments".** The Environments page: staging and production, the last deployment, the commit, who started it, Re-deploy on old deployments. The rollback in incident C13 is done here.

**A-I6. "One line".** The bridge from M15/M16: a `when: manual` switch on `deploy_production` in the YAML, with the name of the practice next to it; a variant with rules — Deployment for staging, Delivery for production.

```yaml
deploy_production:
  stage: deploy
  script: ./deploy.sh production
  environment: production
  rules:
    - if: '$CI_COMMIT_TAG =~ /^v\d+\.\d+\.\d+$/'
      when: manual     # present — Continuous Delivery; absent — Continuous Deployment
```

### 3.6. Trainers

L0 does A-D1…A-D8, L1 all except those marked "L2", L2 all of them.

| ID | Type | Task | Goals |
|---|---|---|---|
| A-D1 | build | A pipeline of one job that runs `./test.sh` | `lint`; the run succeeds; the log contains `$ ./test.sh` |
| A-D2 | read | "Why is the pipeline red?" — 8 logs, find the line with the cause | line number ± 1 |
| A-D3 | fix | `dist/` not found in deploy (the example in 0.4) | goals from 0.4 |
| A-D4 | fix | A job is pending forever: the tag `dokcer` | the job is picked up by a runner; step 2 — a clipping of `tags` |
| A-D5 | fix | A test fails; fix the **code**, not the pipeline | the run succeeds; `keep`: the test job is in place, without `allow_failure` |
| A-D6 | build | Dependency cache: the second run on the same branch is faster, changing `package-lock.json` resets the cache | second run < 60% of the first; the third after editing the lock file has `ci.cache.hit=false` |
| A-D7 | fix | A secret is printed to the log via `echo` | the value is not in the log; `keep`: no `set -x` when a secret is present |
| A-D8 | build | Staging automatically from main, production manually | on `push main`: staging success, production manual |
| A-D9 | build | `rules`: tests on MR and main, the image only in main and on tags, a docs job only when `docs/**` changes | 5 events with different `changedFiles` and ref |
| A-D10 | build | A DAG with `needs` (pool, task 5) | modelled time, graph |
| A-D11 | build | Matrix: tests on Node {{versions.node_prev_lts}} and {{versions.node_lts}} (22 and 24 as of the document date) | two job instances with different images |
| A-D12 | port | Move a ready `.gitlab-ci.yml` to GitHub Actions | actionlint with no errors; the same steps; the artifact via upload/download-artifact |
| A-D13 (L2) | fix | Two simultaneous deployments to production overwrite each other | `resource_group: production` or `concurrency`; checked by starting two pipelines at once |
| A-D14 (L2) | build | Move the common `before_script` into the `default:` keyword, the common part of the deployments into a hidden job `.deploy` with `extends`, and include a template via `include:local` | the final expanded config equals the reference; the source file is ≥ 30% shorter; `fail` on a job named `.default`: "`.default` is a hidden job, it silently does nothing; common settings are set by the `default:` keyword" (`term: C27`) |
| A-D15 | build | Deploy to a staging VPS over SSH and compose from main; production manually; rollback — Re-deploy of the previous tag | the Workbench VPS model runs the image with the right SHA; after the rollback, the previous one |
| A-D16 (L2) | build | Canary in a compose environment: two services behind nginx with `upstream` weights, switching 10% → 100% with a separate manual job | the weights in the nginx config at each step; with `fault: v2-500` the deployment did not reach 100% |
| A-L1…A-L20 | lint | 20 broken fragments: `script` as a string; a `stage` not from `stages`; `only` together with `rules`; `needs` on a job in a later stage; `needs` on a job that `rules` exclude, without `optional: true`; `on: push` with a typo in `branches`; no `runs-on`; `uses` without a version | `lint` = 0, semantic check against the reference |
| A-D17…A-D20 | — | Deploying to Kubernetes, section 3.7 | — |

### 3.7. A7. Deploying to Kubernetes from CI

An A7 job is executed by the simulator's runner, and the `kubectl` and `helm` commands in its script are executed by kube-lite in the same worker (05, 5.2; 09, 1.7). So the reconciliation loop visualiser and the "Kubernetes from blocks" diagram show the deployment actually started by the pipeline, not a plausible log of it.

Plan (concepts C28, C29; requires K12, K25, K28, K29):
1. **What to log into the cluster with.** A ServiceAccount `deployer` in the `staging` namespace, a Role with `get/list/watch/create/update/patch` on `deployments`, `services`, `configmaps`, a RoleBinding; the token — `kubectl create token deployer --duration=1h` in a File variable `KUBECONFIG`, Protected, environment scope `staging`. GitLab's recommended path is the GitLab agent for Kubernetes with `ci_access` (certificate-based cluster integration has been removed from GitLab); for cloud clusters, OIDC. The anti-example is a `cluster-admin` kubeconfig: `kubectl auth can-i delete nodes` from the job must return `no`.
2. **An immutable tag.** The image `registry/web:$CI_COMMIT_SHORT_SHA`; `kubectl set image` or `helm upgrade --install web ./chart --set image.tag=$CI_COMMIT_SHORT_SHA`. Through the reconciliation loop: a new tag → a new `pod-template-hash` → a new ReplicaSet. With `:latest` and an unchanged manifest the Deployment does not change and there is no rollout.
3. **Wait and roll back.** `kubectl rollout status deploy/web --timeout=120s` (the job fails if the rollout did not complete); `helm upgrade --install --wait --rollback-on-failure` — the flag name in Helm 4; the old `--atomic` gives a deprecation warning, and `--force` has been renamed to `--force-replace`; a manual rollback is `kubectl rollout undo`, `helm rollback` or Re-deploy of an old environment job.
4. **Push versus pull.** CI with rights in the cluster (push) versus CI that commits the tag to a configuration repository, which `argocd-lite` from 05 then pulls (pull). GitOps as a concept (K29) is introduced by 05; here only the CI side. The link to E-REC (5.5).

| ID | Task | Goals |
|---|---|---|
| A-D17 | "The job is green but the site is old": tag `latest` and `imagePullPolicy: IfNotPresent` | `k8s.objects[kind=Deployment][metadata.name=web].spec.template.spec.containers[0].image=~':[0-9a-f]{8}$'`; the rollout is complete |
| A-D18 | "Deploy failed with Forbidden": a Role without `patch` | the job succeeds; `keep`: the SA has no ClusterRoleBinding; `fail.term: K25` |
| A-D19 | "A broken image went to production": add `rollout status --timeout` and a rollback | with the image `trainer/web:2.0` (CrashLoopBackOff, 05, 5.2) the job fails **and** throughout, the Deployment has `readyReplicas ≥ 2` of the previous revision (the kube-lite log) |
| A-D20 (L2) | "Move the deployment to GitOps": CI commits the tag to `deploy/values.yaml`, the `argocd-lite` Application is Synced | the Application is Synced/Healthy with the new revision; `fail`: `kubectl` in the job script |

### 3.8. Practical exam A (self-check, `envs: [sim]`)

Scenario: the "business-card site" training project (nginx + a static site, a Dockerfile, script tests) in the forge, an empty pipeline file, two runners, empty variable settings. 90 minutes, `doc_ladder: { step: 5, allowed: [docs.gitlab.com/ci, docs.github.com/actions] }`.

| Task | Weight | Card | Checks |
|---|---|---|---|
| t1 | 20 | A check (lint + tests) on every MR | `critical`: on the MR event lint and tests run; `fail`: `allow_failure` on the tests |
| t2 | 20 | An image tagged `$CI_COMMIT_SHORT_SHA` in the training registry, only from main; the registry password in a variable | `critical`: `ci.registry[ref~':<sha>']`; the repository has no line matching the secret |
| t3 | 15 | Staging automatically from main; production manually, only from `vX.Y.Z` tags; parallel deployments to the same environment are ruled out | runs on MR, push main, tag `v1.0.0`, tag `test`; staging serves the new version; two pipelines started at once |
| t4 | 15 | Variant from the seed: a `This job is stuck` log; a cache keyed by branch does not speed up the MR; a secret in the log via `base64`; `needs` on a job excluded by `rules`; a step-5 task (`workflow:rules` + `auto_cancel` or `rules:exists`) | the variant's goals |
| explain | 30 | "Is this Continuous Delivery or Continuous Deployment? What would you change to make it the other one?"; "How does your cache differ from an artifact, and what happens if the cache disappears?" | rubric: the manual step; a release-ready artifact; the cache speeds things up, the artifact passes the result on |

L2 in addition: pipeline time in main ≤ N, the GitHub Actions version passes actionlint. `pass: { critical: all, total_min: 70 }`.

### 3.9. Sources for A

- EN: GitLab CI/CD YAML reference — https://docs.gitlab.com/ci/yaml/ ; caching — https://docs.gitlab.com/ci/caching/ ; job artifacts — https://docs.gitlab.com/ci/jobs/job_artifacts/ ; CI/CD variables — https://docs.gitlab.com/ci/variables/ ; environments — https://docs.gitlab.com/ci/environments/ ; GitLab agent for Kubernetes, CI/CD workflow — https://docs.gitlab.com/user/clusters/agent/ci_cd_workflow/ ; GitLab Runner — https://docs.gitlab.com/runner/ ; CI schema — https://docs.gitlab.com/development/cicd/schema/ ; GitHub Actions — https://docs.github.com/en/actions ; actionlint playground — https://rhysd.github.io/actionlint/ ; gitlab-ci-local — https://github.com/firecow/gitlab-ci-local ; Helm 4 overview — https://helm.sh/docs/overview ; Helm 3 end of life — https://helm.sh/blog/helm-v3-end-of-life ; Martin Fowler, BlueGreenDeployment — https://martinfowler.com/bliki/BlueGreenDeployment.html ; CanaryRelease — https://martinfowler.com/bliki/CanaryRelease.html
- RU: GitHub Actions in Russian — https://docs.github.com/ru/actions ; Habr, cache and artifacts in GitLab CI — https://habr.com/ru/articles/869422 ; Habr, stages and the first pipeline — https://habr.com/ru/articles/841474 ; books: Humble, Farley, «Непрерывное развёртывание ПО» (Williams, 2011 — the Russian translation of "Continuous Delivery"); Forsgren, Humble, Kim, «Ускоряйся! Наука DevOps» (Alpina, 2020 — the Russian translation of "Accelerate").

---

## 4. Block B1. Ansible

### 4.1. Key decisions

**The main engine is the ansim simulator in TypeScript; the real ansible-core runs in a lab on a multi-node v86 network and on real VMs.** ansible-core does not run in Pyodide without deep rework: it spawns worker processes with `fork` and reaches hosts over SSH. ansim implements ansible-core semantics on a subset: inventory, groups, variables with the full precedence table, plays, tasks, modules, facts, handlers, `when`, `loop`, `register`, tags, check mode and diff, roles, `serial`, the `linear` and `free` strategies, `forks`. Modules work with Workbench "machines" — the same VFS into which the learner logs in with `ssh web1` and sees a modified `/etc/nginx/nginx.conf` and a running service. The output reproduces Ansible's standard callback (`PLAY [...]`, `TASK [...]`, `ok: [web1]`, `changed: [web2]`, `PLAY RECAP`).

**ansim modules.** Names in lessons and exercises are fully qualified (FQCN), because the lab and the practice run on the real ansible-core, where a module outside `ansible.builtin` does not exist without its collection. The screen "the full module name and where it comes from" (I24) is in B1-3, before the first module from a collection. Every module implements `check_mode`, `diff` and an honest `changed`.

| Module (FQCN) | What it models | Key parameters |
|---|---|---|
| `ansible.builtin.ping`, `ansible.builtin.setup` | connectivity, facts (`ansible_facts.os_family`, `distribution`, `default_ipv4`, `memtotal_mb`, `processor_vcpus`) | `gather_subset` |
| `ansible.builtin.apt`, `ansible.builtin.dnf`, `ansible.builtin.package` | the machine's package database | `name`, `state: present/absent/latest`, `update_cache`, `cache_valid_time`, `deb` |
| `ansible.builtin.service`, `ansible.builtin.systemd_service` | systemd services | `name`, `state`, `enabled`, `daemon_reload` |
| `ansible.builtin.copy`, `template`, `file`, `lineinfile`, `blockinfile` | VFS files | `src`, `dest`, `content`, `owner`, `group`, `mode`, `backup`, `regexp`, `line`, `create`, `state` |
| `ansible.builtin.user`, `ansible.builtin.group` | users | `name`, `groups`, `append`, `shell` |
| `ansible.posix.authorized_key` (the `ansible.posix` collection) | SSH keys | `user`, `key`, `state` |
| `ansible.posix.sysctl` | kernel parameters | `name`, `value`, `sysctl_set` |
| `ansible.builtin.command`, `ansible.builtin.shell` | execution in the Workbench shell; always `changed` without `creates`/`removes`/`changed_when` | `cmd`, `creates`, `removes`, `chdir` |
| `ansible.builtin.uri`, `ansible.builtin.wait_for` | HTTP to the training service, waiting for a port | `url`, `status_code`, `port` |
| `ansible.builtin.cron`, `ansible.builtin.get_url` | only for step 4–5 tasks | — |
| `ansible.builtin.debug`, `set_fact`, `assert`, `fail`, `include_tasks`, `import_tasks`, `include_role`, `meta` | control | — |
| `community.general.ufw`, `community.general.timezone`, `community.docker.docker_container` | only L1/L2 and only as step-4 tasks of the documentation ladder | — |

In the main curriculum the firewall is configured with a `/etc/nftables.conf` template and a handler `nft -f /etc/nftables.conf` — this builds on N17 from the networks block; `ufw` is not introduced as a concept in the course. An unsupported module gives an error in Ansible's format (`couldn't resolve module/action 'x'`) with an explanation that the browser trainer does not have it and a link to the lab.

**Templates.** In ansim templates are executed by nunjucks: the syntax matches Jinja2 for the subset used (`{{ }}`, `{% if %}`, `{% for %}`, filters). Ansible filters (`default`, `bool`, `join`, `to_nice_yaml`, `regex_replace`, `combine`, `dict2items`) are implemented as nunjucks filters. The `ipaddr` filter lives in the `ansible.utils` collection and requires the Python package `netaddr`, so it is not part of the course; addresses in templates come from facts. The content linter forbids constructs where nunjucks and Jinja2 diverge, and all the course's templates are run in CI on the real ansible-core (9.2).

**The "Real Ansible" lab on a multi-node network (R11).** Three v86 machines in Web Workers on the platform's shared JS switch (09, 1.6; R11): segment `10.0.0.0/24`, addresses are handed out by `dnsmasq`, names come from its DNS (`node-1.lab`). The control node `lab-ansible` is `lab-alpine` + `python3`, a pinned version of ansible-core, `openssh-client`, the `ansible.posix` and `community.general` collections at pinned versions, and a warmed `.pyc` cache in the snapshot; 256 MB. The managed nodes are `lab-alpine` + `python3` + `openssh-server` (not dropbear: it has no sftp server, and by default Ansible transfers modules over sftp, then scp), 96 MB each. The lab's `ansible.cfg` has `pipelining = True`, and exercises default to `gather_facts: false`. The switch visualises ssh sessions: with `forks: 5` five simultaneous streams are visible, and this is the same diagram as in E-ANS. Desktop only (`navigator.deviceMemory ≥ 8`); on a phone, the recorded mode or a QR hand-off. The `lab-ansible` image is added to the image table in 09, 1.4; snapshots of the three machines are ≈ 90–110 MB zstd, downloaded only on explicit launch. The same managed nodes suit hybrid Kubernetes (05, R11): Ansible configures a node on which our kubelet agent then runs.

**Spike acceptance threshold (phase 0, 09, 7).** A 5-task playbook on two hosts from a warmed snapshot completes in ≤ 90 s. v86 runs at 1–2% of native speed, and each task is SSH, a transfer and a Python module run, so tens of seconds per task are realistic; if the threshold is not met, the lab stays in recorded mode only (frames of a real run in the stepper), and the learner runs the real ansible-core on their own VMs in B3 and pet project 5.

### 4.2. Levels and additional check pool

| Level | What it means for Ansible (01, 4.3) |
|---|---|
| L0 | Knows Linux (packages, systemd, files, ssh) and YAML; has never seen Ansible |
| L1 | Has run ready-made playbooks; gets confused by handlers, variables and idempotency. This also covers a programmer who has written configuration scripts in bash or Python and does not know the "desired state" model |
| L2 | Has written small playbooks; has not worked with roles, variable precedence or vault, has not thought about idempotency |

Pool (`key: false`):
1. *(L1, P)* Inventory: groups `web` (web1, web2) and `db` (db1), `http_port=8080` for the web group. Goal: `ansible-inventory --list` gives the expected JSON.
2. *(L1, P)* A playbook installs nginx and starts it on the web group. Goal: on web1 and web2 the package is present, the unit is active and enabled; db1 is unchanged.
3. *(L1, P)* "Why is `ansible.builtin.shell: echo 'max_conn=100' >> /etc/app.conf` bad? Rewrite it." Goal: `ansible.runs[n=2].hosts[*].changed=0`, one line in the file after three runs.
4. *(L2, P)* "The nginx config is a template; nginx is reloaded only when the config changes." Goals: run 1 — the handler ran; run 2 — it did not; run 3 after a variable change — it did.
5. *(L2, T)* "`app_port` is set in `group_vars/all`, `group_vars/web`, `host_vars/web1` and in the play's `vars:` with `hosts: all`. What value will web1, web2 and db1 get? And with `-e app_port=9000`?" The answer follows the precedence ladder.
6. *(L2, P)* "Turn the playbook into a `webserver` role with `defaults` and a handler; the playbook calls the role." Goals: directory structure, the run and idempotency, overriding `defaults` from the inventory works.

### 4.3. Curriculum

| Module | Chapter thesis | Content | L0 | L1 | L2 |
|---|---|---|---|---|---|
| B1-1. Why | A description of what a server should be is reproducible; a set of commands is not | five servers by hand → a script → desired state; the control machine and hosts, no agent needed, ssh and python needed (I01, I02) | in full | briefly | briefly |
| B1-2. Inventory | Ansible knows about hosts only what is written in the inventory | INI and YAML, groups, `children`, `all`, host and group variables, `ansible-inventory --graph` (I09) | in full | in full | briefly |
| B1-3. Modules | A module first looks at how things are and changes only the difference | ad-hoc `ansible all -m ansible.builtin.ping`, `-m ansible.builtin.apt -a ... -b`, FQCN and collections (I24), `ansible-doc` | in full | briefly | briefly |
| B1-4. The first playbook | A playbook is a list of tasks run on all hosts in turn | play, `hosts`, `become`, tasks, the order "a task on all hosts, then the next one", RECAP (I10) | in full | in full | in full |
| B1-5. Idempotency | A second run that changes nothing is the main test of a playbook | ok/changed, why `command` is always changed, `creates`, `changed_when`, the second run as a test | in full | in full | in full |
| B1-6. Facts | Ansible first asks the host who it is | `gather_facts`, `ansible_facts`, `setup` (I15) | in full | in full | briefly |
| B1-7. Variables and templates | One template gives a different config on different hosts | `vars`, `group_vars/`, `host_vars/`, Jinja2, `ansible.builtin.template` (I11) | in full | in full | in full |
| B1-8. Handlers | Restarting a service is a consequence of a change, not a separate step | `notify`, running at the end of the play, once, `flush_handlers`, `--force-handlers` (I16) | in full | in full | in full |
| B1-9. Flow control | A condition, a loop and a task's result | `when`, `loop`, `register`, `failed_when`, `block/rescue`, tags | basics | in full | in full |
| B1-10. Roles | A role is a playbook laid out in directories so that it can be reused | `ansible-galaxy init`, structure, `defaults` versus `vars`, role dependencies (I12) | overview | in full | in full |
| B1-11. Variable precedence | A value wins by where it is set, not by the order of reading | a 9-step ladder for the course and a link to the full table (I17) | — | in full | in full |
| B1-12. Checking and safety | First see what will change, then change it, and one host at a time | `--check --diff` (I25), `--limit`, `serial`, `ansible-vault` (I14) | `--check` | in full | + `ansible-lint`, Molecule overview |

The precedence ladder for the course has 9 steps from bottom to top: role defaults → inventory `group_vars/all` → inventory `group_vars/<group>` → inventory `host_vars/<host>` → host facts → the play's `vars:` → role vars → `set_fact` and `register` → extra vars (`-e`). ansim implements the full table from the Ansible documentation; the course teaches the simplified one where they agree; the full table is shown to L2 as a reference.

### 4.4. Textbook plan and the E-ANS explanation

**B1-5. Idempotency.** Thesis: a correct playbook can be run any number of times, and the second run changes nothing.
1. A module receives the desired state and first checks the current one (builds on B1-3).
2. If they match, the module answers `ok` and does nothing; if not, it changes things and answers `changed`.
3. `command` and `shell` do not know what the state should be, so they always answer `changed` (builds on L21).
4. `creates`, `removes` and `changed_when` tell Ansible how to know that a command has already been run.
5. A second run with `changed=0` checks that the playbook describes a state, not actions.
6. Hidden non-idempotency: a template with the current time changes the file every time and restarts the service every time.
Comprehension check: the B1-I4 visualiser and trainer B1-D3.

**E-ANS "An idempotent Ansible run".** On the left the control machine, on the right three to six hosts (`--c-node`), between them lines labelled `ssh`, `python3 ~/.ansible/tmp/…/AnsiballZ_apt.py`, `JSON: {"changed": false}`. Below is the idempotency grid (tasks × runs). The only things that move are dots along the ssh lines and the filling of grid cells.

| Screen | On screen and what moves | Parameters | "Break it" | Explanation on change |
|---|---|---|---|---|
| 1. Connecting | `forks` ssh arrows go from the control machine to the hosts at the same time | Number of hosts 1–6; `forks` 1–5 | "the host has no python" → `/usr/bin/python3: not found`, the host is marked `UNREACHABLE`/`MODULE FAILURE` | "Ansible is agentless, but not python-less — except for the `raw` module" |
| 2. Facts | An `ansible_facts` card returns from each host (OS family, address, memory) | `gather_facts` on/off | — | Without facts a task with `when: ansible_facts.os_family == 'Debian'` fails; the line is shown |
| 3. Task | The module on the host compares "how it should be" with "how it is"; the grid cell is coloured ok / changed | Task type: `lineinfile` / `shell: echo >>` / `template` with `ansible_date_time` | — | With `shell >>` the file grows by a line every run, the cell is always yellow |
| 4. Order | The task cursor goes through all hosts before moving to the next line | `strategy: linear / free`; `serial: 1 / 2 / all` | "the second host fails on task 2 with `serial: 1`" → hosts 3–4 are untouched | "This is what `serial` is for: an error stops the rollout on one host" |
| 5. Handlers | `notify` puts a handler token into a queue at the side; at the end of the play the handler runs once | `--force-handlers` on/off | "a task after `notify` failed" → the handler did not run on that host | With `--force-handlers` it ran |
| 6. Runs | A "run № 1→2→3" switch fills the grid columns | `--check` on/off | — | In `--check` the arrows are dashed and nothing changes on the hosts: "the module reports what it would change" |
| 7. RECAP | `PLAY RECAP` with numbers per host | — | — | A click on a number shows the tasks it is made up of |

A click on a host opens an `ssh web1` terminal and the "Packages", "Services", "Files" tabs. The source of the steps is `ans.ssh` and `ans.task`; in the v86 lab the same events are built from the JSON callback of the real ansible-core.

### 4.5. Interactives

**B1-I1. "Manual setup versus a description".** Five servers and a list of manual steps; each server is configured slightly differently (the configuration drift is highlighted in a "server × parameter" table). Then the same list as a description of state: "the package is present", "the file is like this", "the service is running". A blueprint, no characters.

**B1-I2. "Host map".** Host cards inside group frames (a group within a group is a frame within a frame), with the inventory file on the left. Editing the file rebuilds the map; dragging a host between frames edits the file. A click on a host shows the resulting variables with the source of each value (prepares B1-11).

**B1-I3. "Playbook run".** A playbook editor, host cards with the "Packages", "Services", "Files" tabs, and the `ansible-playbook` output on the right. The current task is highlighted in the editor, and what changed flashes on the cards. This is the workspace; the process explanation is E-ANS.

**B1-I4. Idempotency visualiser.** A grid: rows are tasks, columns are runs (up to five), cells are per host; the model is Sankofa's sequencer. Under the grid is a "film strip" of one file's content across runs. Examples: `shell: echo ... >>` (always a yellow column, the file grows) → `lineinfile` (green columns from the second run); `command: useradd deploy` fails on the second run ("user already exists") → the `user` module; a template with `{{ ansible_date_time.iso8601 }}` restarts nginx every time.

**B1-I5. "Handler queue".** A play timeline: three tasks notify one handler, and at the end of the play it runs once; with a failed task it does not run; with `--force-handlers` it does.

**B1-I6. "Variable ladder".** Nine steps; the learner places the sources of values, then answers 10 questions "what value will the host get". Each answer is confirmed by a run of `ansible.builtin.debug: var=app_port`.

**B1-I7. "What is inside a role".** The tree created by `ansible-galaxy init webserver`: `tasks/main.yml`, `handlers/main.yml`, `templates/`, `files/`, `defaults/main.yml`, `vars/main.yml`, `meta/main.yml`. A click on a directory explains when Ansible reads it and highlights the lines of the "flat" playbook the role was derived from.

### 4.6. Trainers

| ID | Task | Goals |
|---|---|---|
| B1-D1 | 10 ad-hoc commands: ping a group, a package on one host, free memory on all hosts via facts | output and host state |
| B1-D2 | nginx, `index.html` with the host name (`{{ inventory_hostname }}`), the service running | the file on each host contains its own name; the second run has `changed=0`; step 2 — a clipping of the `template` OPTIONS |
| B1-D3 | "Find the non-idempotent tasks": an 8-task playbook, mark 3 | the choice + the corrected playbook is idempotent; step 2 — a clipping of `lineinfile` |
| B1-D4 | A handler does not fire: a typo in the `notify` name | after the template changes the service is reloaded |
| B1-D5 | `when` on `ansible_facts.os_family`: Debian — apt, RedHat — dnf (machines of different families) | a run on a mixed inventory |
| B1-D6 | `loop` over a list of users with keys (`ansible.posix.authorized_key`) | users and `authorized_keys` on the hosts |
| B1-D7 | The DB password in vault | the file starts with `$ANSIBLE_VAULT;1.1;AES256`; a run with `--ask-vault-pass` succeeds; the repository has no plaintext password |
| B1-D8 | A rolling deployment to 4 web hosts with a `uri` check after each (`serial: 1`) | a broken second host stops the rollout, hosts 3–4 are untouched |
| B1-D9 | A firewall from an `nftables.conf` template + an `nft -f` handler: open 22 and 80 | rules in the `net.nft` facts; access on 80 works, on 8080 it does not; the second run has `changed=0` |
| B1-D10 | Refactoring into a role (pool, task 6) | structure, run, idempotency |
| B1-D11 | `--check --diff` before a change: predict the diff | the predicted lines match |
| B1-D12 | Step-4 tasks from 0.5 (`--start-at-task`, `run_once`, `delegate_to`, `apt: deb:`) | by effect + the "where I found it" field |

### 4.7. Practical exam B1 (self-check, `envs: [sim]`; L2 can optionally repeat it in the v86 lab)

```yaml
id: exam-ansible
block: iac
time_limit_min: 90
story: { ru: "Вы вторую неделю в «Ларьке». Под новое приложение выделили три сервера; тимлид оставил карточки.", en: "..." }
sandbox: { image: ansim-3hosts, seed: "{{seed}}" }   # app1 Debian, app2 RedHat family, db1 Debian
doc_ladder: { step: 5, allowed: [docs.ansible.com] }
tasks:
  - id: t1
    weight: 25
    card: { ru: "Роль common на всех хостах: пользователь deploy с ключом, пакеты curl и htop, межсетевой экран открывает только 22 и 80.", en: "..." }
    checks:
      - { id: t1a, critical: true, when: "files[/home/deploy/.ssh/authorized_keys].exists" }
      - { id: t1b, points: 10, when: "ansible.runs[n=2].hosts[*].changed=0" }
      - { id: t1c, points: 5, eval: { yaml_path: "$..['ansible.builtin.shell','ansible.builtin.command','shell','command']", not_matches: "useradd|apt-get|yum|dnf|nft add" } }
  - id: t2
    weight: 25
    card: { ru: "nginx на app-хостах проксирует на порт приложения из group_vars/app; смена порта даёт ровно один reload на каждом app-хосте.", en: "..." }
    checks:
      - { id: t2a, critical: true, when: "http.app1.status=200 && http.app2.status=200" }
      - { id: t2b, points: 15, eval: { run: { change: "group_vars/app.yml:app_port=8081" } }, when: "ansible.runs[-1].hosts[name=app1].tasks[handler=true][status=changed]#=1 && ansible.runs[-1].hosts[name=app2].tasks[handler=true][status=changed]#=1" }
  - id: t3
    weight: 20
    card: { ru: "PostgreSQL на db1: пакет, сервис, listen_addresses на частный адрес, пароль только в vault.", en: "..." }
    checks:
      - { id: t3a, critical: true, when: "units[postgresql.service].active=active" }
      - { id: t3b, points: 10, eval: { grep_repo: "{{secret.db_password}}" }, expect: absent }
  - id: t4
    weight: 0              # the task's weight comes from the breakage
    variant_of: [fault-handler-typo, fault-when-family, fault-vault-missing, fault-become, task-cron-module]
    card: { ru: "После вашего прогона пришла жалоба: на одном из app-хостов сайт старый. Найдите и устраните причину.", en: "..." }
    checks: "{{fault.checks}}"
explain:
  weight: 30
  questions:
    - { id: e1, q: { ru: "Тимлид: «Почему второй прогон ничего не меняет, и зачем нам это?»" }, key_points: [desired-state, module-checks-current, changed-zero-as-test] }
    - { id: e2, q: { ru: "Где лежит пароль базы и кто может его прочитать?" }, key_points: [vault-encrypted, key-outside-repo, ci-variable] }
pass: { critical: all, total_min: 70 }
```

`forbid` goals in all tasks: `ignore_errors: true`; `shell`/`command` where a module from the list exists; a plaintext password.

### 4.8. Sources for B1

- EN: Getting started — https://docs.ansible.com/ansible/latest/getting_started/index.html ; inventory — https://docs.ansible.com/ansible/latest/inventory_guide/intro_inventory.html ; variable precedence — https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_variables.html#understanding-variable-precedence ; roles — https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_reuse_roles.html ; handlers — https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_handlers.html ; check mode — https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_checkmode.html ; collections and FQCN — https://docs.ansible.com/ansible/latest/collections_guide/index.html ; ansible.posix.authorized_key — https://docs.ansible.com/ansible/latest/collections/ansible/posix/authorized_key_module.html ; connection settings (pipelining, transfer) — https://docs.ansible.com/ansible/latest/collections/ansible/builtin/ssh_connection.html ; v86 networking — https://github.com/copy/v86/blob/master/docs/networking.md
- RU: Habr (Slurm), Ansible inventory basics — https://habr.com/ru/companies/slurm/articles/786700/ ; Habr, Ansible roles and check mode specifics — https://habr.com/ru/articles/746864/ (source for B1-12); a second Russian-language source for `changed_when` is being selected separately, until then the B1-5 statements about `changed_when` rest on the documentation and a reference run; book: Hochstein, Moser, «Запускаем Ansible» (DMK Press — the Russian translation of "Ansible: Up and Running").

---

## 5. Block B2. Terraform and OpenTofu

### 5.1. Key decisions

**The Edu Cloud training cloud and the `edu` provider.** The learner works against a training cloud in the browser: it has an API (with latencies, quotas and 429 errors), a console (a page with a list of resources that can be changed by hand — this is how drift is created) and the `edu` provider. The resources are chosen so that the move to Yandex Cloud, Hetzner, AWS or the in-tab cloud (00 §6.13) in B3 is direct.

| Resource | Attributes (F — replacement on change, U — in-place update, C — computed by the cloud) |
|---|---|
| `edu_network` | `name` (U), `id` (C) |
| `edu_subnet` | `network_id` (F), `cidr` (F), `availability_zone` (F), `id` (C) |
| `edu_security_group` | `network_id` (F), `ingress {port, protocol, cidr}` (U), `egress` (U) |
| `edu_vm` | `name` (U), `availability_zone` (F), `image_id` (F), `cores` (U, requires stopping: `allow_stopping_for_update`), `memory_gb` (U, same), `subnet_id` (F), `security_group_ids` (U), `ssh_key` (F), `labels` (U), `id`, `private_ip`, `public_ip` (C) |
| `edu_disk` | `size_gb` (U, growth only; shrinking — F), `type` (F) |
| `edu_dns_record` | `zone` (F, DNS zone), `name` (F), `type` (F), `ttl` (U), `value` (U) |
| `edu_bucket` | `name` (F, globally unique — the training error "name already taken"), `versioning` (U) |
| data `edu_image` | `family` → `id` |

We write the documentation for the `edu` provider ourselves, following the anatomy of a Registry page (Example Usage / Argument Reference / Attributes Reference / Import): step 2 of the ladder is learned on it, and it has no licensing restrictions.

**The tfsim engine: Go → WebAssembly on real HCL, with a narrow scope of tasks.** Writing our own HCL parser in TypeScript would mean teaching a dialect, so tfsim is built on `hashicorp/hcl/v2` (parsing, diagnostics with line ranges, expression evaluation), `zclconf/go-cty` (types, unknown values, the function library) and `hclwrite` (a real `fmt`). The core beyond the libraries is limited to what the course's tasks use: local modules, `variable`/`locals`/`output`/`data`, `count`, `for_each`, `depends_on`, `lifecycle` (`create_before_destroy`, `prevent_destroy`, `ignore_changes`, `replace_triggered_by`), the `import`, `moved`, `removed`, `check`, `precondition` blocks; the graph and a walk with parallelism 10, refresh, diff, a plan with unknown values, `-replace`, `-refresh-only`, `-refresh=false`, `-target`, `-generate-config-out`, `state list/show/mv/rm/pull`, `workspace` (list/new/select). Every exercise in the course is run in CI on the real OpenTofu with a stub provider for the same API (9.2): this is both a check and a second source of behaviour. The budget is ≤ 2.5 MB gzip (09, 1.3); if it does not fit, build with `-ldflags="-s -w"` + `wasm-opt -Oz`, then TinyGo. The size is measured in the phase 0 spike.

**The "OpenTofu fork instead of tfsim" spike (3 days, phase 0).** Build OpenTofu (MPL-2.0) for `GOOS=js GOARCH=wasm` with the `edu` provider compiled into the process (like the built-in `terraform` provider), with plugin discovery disabled and `os/exec` and file locks stubbed out; measure the size and the time of `plan` on 10 resources. Decision rule: if it is ≤ 2.5 MB gzip and `plan` ≤ 1 s, the fork becomes the engine and tfsim is not written; if it is larger, tfsim is built in the narrow scope described, and the fork remains the reference in CI. The expected outcome is the second option (OpenTofu has a lot of platform code and backends), but checking is cheaper than silently rewriting the core.

**The formats are real.** State is a version 4 `terraform.tfstate` (`resources[].instances[].attributes`, `serial`, `lineage`). `show -json plan.out` is the plan format from the documentation (`format_version`, `resource_changes[].change.actions`, `before`, `after`, `after_unknown`, `action_reason`). The `plan_expect` goals and the visualisations are built on this JSON. The human-readable output reproduces OpenTofu/Terraform 1.x: `+ create`, `~ update in-place`, `- destroy`, `-/+ destroy and then create replacement`, `+/- create replacement and then destroy`, `<= read (data resources)`, `# forces replacement`, `Plan: 2 to add, 1 to change, 0 to destroy.`, `Note: Objects have changed outside of Terraform`, `Warning: Resource targeting is in effect`.

**Terraform and OpenTofu.** `terraform` and `tofu` in the Workbench are one command. The lessons describe OpenTofu as an open fork of Terraform created after Terraform's licence change in 2023 and show that the course's concepts are the same. Differences the course names but does not study: since version 1.7 OpenTofu has client-side state and plan encryption (the `encryption` block) and `for_each` on providers; Terraform has ephemeral resources and `terraform test`. The ladder's documentation is opentofu.org/docs (MPL-2.0); developer.hashicorp.com is given as a link.

### 5.2. Levels and additional check pool

| Level | What it means for Terraform (01, 4.3) |
|---|---|
| L0 | Knows network, subnet, IP, DNS from the networks block; has ordered a cloud VM by hand in the second Kubernetes stage (K31); has never seen Terraform |
| L1 | Has run `plan`/`apply` on ready-made code; does not understand state, drift, replacement, `count`/`for_each`. This also covers a programmer who understands declarativeness in general but not the "code — state — reality" model |
| L2 | Has written small configurations; has not worked with remote state, modules, import and refactoring |

Pool (`key: false`):
1. *(L1, P)* A network, a subnet `10.0.1.0/24`, a VM in it, an `output` with the public IP. Goals: `tf.plan` — 3 create; after `apply`, `tofu output public_ip` is non-empty.
2. *(L1, T)* Read the plan: how many resources are being replaced and why? Answer: 1, `image_id` with `# forces replacement`.
3. *(L1, P)* "The VM's `cores` was changed in the console. What will `plan` show and how do you restore the desired value?" Goals: `plan` shows the drift and an update; after `apply` the value comes from the code.
4. *(L2, P, `key: false`, handed to 01 as a candidate key task)* "Three VMs via `count` over `["a","b","c"]`. Remove `b` so that `c` is not replaced." Goal: `plan_expect: { destroy: ['edu_vm.this["b"]'], create: [], update: [] }` after switching to `for_each` with `moved`; `fail` on `-target`.
5. *(L2, P)* "`edu_bucket.assets` was created by hand. Bring it under management without replacing it." Goal: an `import` block or `tofu import`, then `plan` — No changes.
6. *(L2, E)* "Two engineers run `apply` at the same time with local state. What breaks and how is it fixed?" Rubric: one engineer's state write overwrites the other's; the resource exists in the cloud but not in state; a remote backend; locking.

### 5.3. Curriculum

| Module | Chapter thesis | Content | L0 | L1 | L2 |
|---|---|---|---|---|---|
| B2-1. The cloud and its API | Every console button is an API request, and it can be made from code | resource, console, API, why clicking is dangerous (not reproducible, not reviewable) (I03) | in full | briefly | briefly |
| B2-2. The first code | Code describes resources and the links between them, not steps | provider, `resource`, attributes, references `edu_subnet.main.id`, `init`, `fmt`, `validate` (I04); the "two different zones" card | in full | in full | briefly |
| B2-3. Plan and apply | Terraform first says what it will do and does it only after confirmation | `plan`, `apply`, reading a plan, `destroy` (I05) | in full | in full | in full |
| B2-4. Three truths | Terraform knows about the cloud only what is written in state, and every `plan` compares three versions of the world | code, state, cloud; computed attributes; `state list/show`; refresh (I06) | in full | in full | in full |
| B2-5. Update and replace | The cloud changes some attributes in place and others only by replacing the resource | update in-place and replacement, `forces replacement`, `create_before_destroy`, `prevent_destroy` (I19) | in full | in full | in full |
| B2-6. The graph | The order of creation follows from the references, not from the order of lines | implicit dependencies, `depends_on`, parallelism, the order of deletion (I18) | in full | in full | in full |
| B2-7. Parameters and modules | The same code describes different environments | `variable` (types, `default`, `validation`, `sensitive`), `tfvars`, `output`, `locals`, `data`, a local module (I07) | in full | in full | in full |
| B2-8. Drift | A change made by hand does not disappear, it waits for the next `plan` | manual changes, `plan -refresh-only`, `ignore_changes` (I08) | in full | in full | in full |
| B2-9. Many of the same kind | The instance address decides what Terraform considers "the same" resource | `count` and `for_each`, index shifting, `moved` (I20) | `count` basics | in full | in full |
| B2-10. Teamwork | State is shared, so it is kept in one place and locked | bucket (I26), remote state, locking, secrets in state, `.gitignore` for `.terraform/` and `*.tfstate`; OpenTofu `encryption` for L2 | overview | in full | in full |
| B2-11. Other people's resources and refactoring | A resource can be renamed or taken over without touching the cloud | `import`, `state mv/rm`, `moved`, `removed` (I21) | — | in full | in full |
| B2-12. Terraform and Ansible together | Terraform creates machines, Ansible configures them; the output of one and the input of the other link them | `output -json` → Ansible inventory (I13) | overview | in full | in full |
| B2-13. Terraform in CI | The plan is an MR artifact, `apply` is a manual job from main | `fmt -check`, `validate`, `plan -out` in the MR with the plan in a comment, `apply` manually (I27) | — | in full | in full |
| B2-14. Three reconcilers | Ansible, Terraform and a Kubernetes controller solve the same problem; they differ in who runs the comparison and when | the E-REC explanation (I22) | in full | in full | in full |

### 5.4. Textbook plan, the E-TF explanation and interactives

**B2-4. Three truths.** Thesis: Terraform knows about the cloud only what is written in state, and every `plan` is a comparison of three versions of the world.
1. The cloud stores the resources and knows everything about them, but does not know that they are "yours" (builds on B2-1).
2. The code describes what the resources should be, but does not know what exists.
3. State is a file in which Terraform has written the link "address in code ↔ ID in the cloud" and the last known attributes (builds on B2-3).
4. Attributes that only the cloud knows (`id`, `public_ip`) are shown as `(known after apply)` until the first `apply`.
5. `plan` first updates state from the cloud (refresh), then compares the code with the updated state.
6. Hence three kinds of discrepancy: not in state — `+`; present but different — `~` or `-/+`; in state but not in the code — `-`.
7. Losing state does not touch the cloud, but it takes Terraform's memory away; this is why state is stored remotely and locked (`forward: [I26]`, B2-10).
8. State holds attribute values, including secrets: access to it should be treated like access to passwords.
Comprehension check: `predict` "what will `plan` show after state is deleted".

**E-TF "`terraform plan` and `apply`: code, state, cloud".** Three columns: **Code** (`--c-code`), **State** (`--c-state`), **Cloud API** (`--c-cloud`); at the bottom a row of phases `read → parse → graph → refresh → diff → plan → confirm → apply → write state`, with the current phase highlighted. The explanation replaces the former B2-I7 scroll scene and works on the learner's code.

| Screen | On screen and what moves | Parameters | "Break it" | Explanation on change |
|---|---|---|---|---|
| 1. Parsing and graph | `.tf` files → resource graph; parallel branches are highlighted | Add or remove a reference between resources | "a cycle" → `Error: Cycle: edu_vm.a, edu_vm.b` in red | The graph is rebuilt: "the order is set by references, not by lines" |
| 2. Refresh | Arrows `GET /v1/vms/vm-7` go from State to the API, responses come back; a diverging attribute gets a drift label | Drift in the cloud on/off (`cores` changed in the console); `-refresh=false` | "state deleted" → refresh is empty | `Note: Objects have changed outside of Terraform` appears on the State ↔ Cloud line; with `-refresh=false` — "the drift is not visible, the plan lies" |
| 3. Diff | Each resource has a `+ ~ - -/+` badge, the line is labelled with the reason (`image_id changed → forces replacement`) | The attribute being changed: `name` / `availability_zone` / `image_id` / `size_gb` ↓ / `cores` | — | The symbol is recomputed immediately; next to it, why this attribute cannot be changed in place |
| 4. Plan and confirmation | The summary `Plan: X to add, Y to change, Z to destroy` | `create_before_destroy` on/off | — | The order `-/+` ↔ `+/-` and the counter "VM downtime: 40 s ↔ 0 s" |
| 5. Apply | `POST/PATCH/DELETE` calls to the API in graph order; nodes light up; `serial` in state grows after each resource | `-parallelism` 1–10 | "API quota exhausted on the 3rd resource" (429) → apply stops | "State is written after each resource: after the failure it holds two of five, and the next `plan` will continue from that point" |
| 6. Final state | `serial` +1, `lineage` unchanged | Local / remote state with locking | "a second apply without locking" → a lost write | With locking the second one gets `Error acquiring the state lock` with the lock ID |
| 7. `-target` | The target and everything it depends on are highlighted; the rest is grey | Target: `edu_vm.web` / `edu_dns_record.web` | — | `Warning: Resource targeting is in effect`; "the network and subnet will be created as dependencies, the DNS record will not, so the next normal `plan` is not empty" |

**B2-I1. "Three truths".** The workspace for E-TF: the same three columns, but the learner types the commands. Correspondence lines by address and ID; a click on an attribute shows its origin (set in code, computed by the cloud, known after apply); a "lose state" button in training mode.

**B2-I2. "Dependency graph".** The DAG from `tofu graph`, laid out by hand by graph level; on `apply` nodes light up as they are created, on `destroy` in reverse order; `depends_on` draws an extra edge.

**B2-I3. "Reading a plan".** Real plan output with highlighting; hovering over a line explains it. Training mode: before applying, the learner answers how many resources will be created, changed and replaced, and whether there will be VM downtime.

**B2-I4. "Cloud console".** The Edu Cloud page: VMs, networks, buckets, "Edit", "Delete", "Create" buttons. Everything the learner does here is seen by the next `plan`. In scenarios a manual change arrives as a console log line: "14:02 `size_gb` of disk `disk-db` changed via the console (source: console, user `ops-2`)".

**B2-I5. "Index shift".** `count = length(var.names)`: addresses `[0] [1] [2]`. Removing a name from the middle shows how the addresses shift and the plan wants to change or replace the neighbouring VM. A switch to `for_each = toset(var.names)` — addresses `["a"] ["b"] ["c"]`; then a `moved` block for the transition without replacement.

**B2-I6. "Locking".** Two terminal panes: the learner and a second session `ops-2`. Local state: the second `apply` overwrites the first one's state — the resource exists in the cloud but not in state. A remote backend with locking: the second one gets `Error acquiring the state lock` and waits; an explanation of why `force-unlock` is a last resort.

### 5.5. E-REC "Four reconcilers" (bridge to the Kubernetes reconciliation loop, R10)

The learner has already seen the reconciliation loop in the Kubernetes block (K03, 05, 6.2): desired on the left, actual on the right, the controller in the middle always comparing and correcting. B2-14 shows that Ansible and Terraform solve the same problem, but differently — and this is the best answer to the interview question "how does Terraform differ from Kubernetes".

| Screen | On screen and what moves | Parameters | "Break it" | Explanation on change |
|---|---|---|---|---|
| 1. One diagram, four times | Four identical columns "desired ← compare → actual": Ansible (playbook ↔ hosts), Terraform (`.tf` + state ↔ cloud), a Kubernetes controller (YAML in etcd ↔ pods), Argo CD (Git ↔ cluster objects). Labels on the lines: "run by a human or CI → compare → change → exit"; "plan: compare code with state and cloud → apply on confirmation → write state → exit"; "watch → compare → change → watch again"; "poll Git → compare → sync → poll again" | — | — | A click on a column opens the reconciler's card: who runs it, where it keeps the desired state, where the actual one |
| 2. A manual change | A "time" slider 0–60 min; at minute 20 someone changes the actual state in all four columns | — | — | Ansible and Terraform stay in drift until the next run (the "minutes in drift" counter grows), the controller and Argo CD fix it within seconds |
| 3. How to turn a run into a loop | — | Switches "Ansible on a schedule every 15 min", "`plan` in CI every hour with a drift alert" | — | Drift shrinks to the run interval: "a perpetual loop is a property of the reconciler, not of the description language" |
| 4. What breaks | — | — | "delete state" (Terraform loses its knowledge of the actual state); "delete the object in etcd" (the controller has nothing to compare with, and it deletes the pods); "bring SSH down" (Ansible cannot even look); "Git unavailable" (Argo CD holds the last known state) | The "Why" block: where each reconciler keeps the desired state and what losing it means |
| 5. Your own small controller | An editor with a 20-line `reconcile(desired, actual)` function and a "run the loop every 5 s" button on top of the Edu Cloud API (the same isolated Worker as the tiny controller in the Kubernetes block, 05, 6.2) | Loop interval 1–30 s | "manual deletion of a VM in the console" → the loop creates it again | "You have written a controller for a cloud: this is how Crossplane and operators work — the same loop as a Deployment's, for their own kind of resource" (link to pet project 8 "an operator in Go") |

Check: `explain` "Why is Argo CD called a controller and Terraform is not?". Rubric: continuous observation; comparison with the actual state; correction without a human starting it. The goal of screen 5: after a VM is deleted by hand in the console, it exists again within ≤ 2 loop intervals, and the loop does not create duplicates (`keep`: the number of VMs with the label `managed-by=learner` equals the desired number).

### 5.6. Trainers

| ID | Task | Goals |
|---|---|---|
| B2-D1 | 15 cards "what symbol will the change have": VM `name` — `~`; `availability_zone` — `-/+`; disk shrunk — `-/+`; label added — `~`; resource removed from the code — `-` | the choice; step 2 — a clipping of the `edu_vm` page |
| B2-D2 | Network + subnet + security group (22, 80) + VM + a DNS record pointing to its IP | `plan_expect` 5 create; after apply the record points to `public_ip` |
| B2-D3 | Move hard-coded values into variables with `validation` (cores ∈ {2,4,8}) | `validate`; `plan -var cores=3` fails with the validation message |
| B2-D4 | Drift: accept the change (`ignore_changes` or editing the code) or roll it back | `plan` — No changes; `explain` the choice |
| B2-D5 | Changing the VM image without downtime | `create_before_destroy`, `+/-` in the plan |
| B2-D6 | `count` → `for_each` without replacement | the final plan is No changes (via `moved`) |
| B2-D7 | Importing a manually created bucket | `plan` — No changes, the bucket is in state |
| B2-D8 | Rename `edu_vm.web` → `edu_vm.frontend` without replacement | `moved` or `state mv`, the plan is No changes |
| B2-D9 | Move the VM into a module `modules/vm` and call it twice | `plan_expect` addresses `module.web.edu_vm.this`, `module.api.edu_vm.this` |
| B2-D10 | "It was done with `apply -target=edu_vm.web`, and everything went through. What part of the configuration was not created, and why is the next normal `plan` not empty?" | answer: `edu_dns_record.web` and everything not linked to the VM by references; the network and subnet were created as dependencies. Goal: `plan_expect` after `-target` contains `create: [edu_dns_record.web, …]`; the wrong option "the network was not created" carries `misconception: iac.target-skips-dependencies`. All subsequent exams have a forbid goal on `-target` |
| B2-D11 | Find a secret in state: `sensitive` hides the value in the output but does not encrypt the state | the answer + moving state to a remote backend with restricted access; L2 — the second part: how OpenTofu solves this (`encryption`) and how Terraform does (bucket encryption and access to it) |
| B2-D12 | Step-4 tasks from 0.5 (`-generate-config-out`, `-replace`, `removed`) | by effect + the "where I found it" field |
| B2-L1…L15 | `validate`/`fmt`: an unclosed bracket, a reference to a non-existent resource, a wrong variable type, `count` and `for_each` together, a cycle | `validate` with no errors, `fmt -check` clean |

### 5.7. Practical exam B2 (self-check, `envs: [sim]`)

"An environment for the application", 90 minutes, `doc_ladder: { step: 5, allowed: [opentofu.org/docs, developer.hashicorp.com/terraform, edu-provider-docs] }`.

| Task | Weight | Card | Checks |
|---|---|---|---|
| t1 | 25 | Variables `env` and `web_count`; a `vm` module; a network, two subnets in different `availability_zone`s, a security group, `web_count` VMs via `for_each`, a database VM with `prevent_destroy`, DNS records for the web VMs, remote state in a bucket with locking | `critical`: `tf.state` contains the expected addresses; `fmt -check`, `validate` |
| t2 | 15 | An `output` with IPs in Ansible inventory format | the `output -json` output parses as an inventory |
| t3 | 20 | Increase `web_count` from 2 to 3; change the image of the web VMs without downtime | `plan_expect`: exactly +1 VM +1 DNS; `+/-` on the web VMs |
| t4 | 10 (variant from the seed) | Drift introduced via the console during the exam; a bucket created by hand; renaming a resource; a step-5 task (`check {}` or `precondition`) | the variant's goals; the final `plan` is No changes |
| explain | 30 | "Why was the `destroy` of the database rejected, and how do you delete it when it is really needed?"; "What happens if two engineers apply your code at the same time?" | rubric: `prevent_destroy`; remove it in code through review; state locking; remote storage |

`critical`: `destroy` of the database VM is rejected by `prevent_destroy`. Forbid goals: `-target`, secrets in `.tf`. `pass: { critical: all, total_min: 70 }`.

### 5.8. Sources for B2

- EN: OpenTofu docs — https://opentofu.org/docs/ ; OpenTofu state encryption — https://opentofu.org/docs/language/state/encryption/ ; Terraform language — https://developer.hashicorp.com/terraform/language ; state — https://developer.hashicorp.com/terraform/language/state ; JSON output format — https://developer.hashicorp.com/terraform/internals/json-format ; resource targeting (`-target`) — https://developer.hashicorp.com/terraform/cli/commands/plan#resource-targeting ; resource drift tutorial — https://developer.hashicorp.com/terraform/tutorials/state/resource-drift ; refactoring with `moved` — https://developer.hashicorp.com/terraform/language/modules/develop/refactoring ; import blocks — https://developer.hashicorp.com/terraform/language/import ; HCL — https://github.com/hashicorp/hcl ; go-cty — https://github.com/zclconf/go-cty ; Kubernetes controllers — https://kubernetes.io/docs/concepts/architecture/controller/ ; Crossplane concepts — https://docs.crossplane.io/latest/concepts/
- RU: Yandex Cloud, getting started with Terraform — https://yandex.cloud/ru/docs/terraform/quickstart ; Yandex Cloud, state locking — https://yandex.cloud/ru/docs/terraform/tutorials/terraform-state-lock ; Yandex Cloud, modules — https://yandex.cloud/ru/docs/terraform/tutorials/terraform-modules ; book: Brikman, «Terraform: инфраструктура на уровне кода» (Piter — the Russian translation of "Terraform: Up & Running"). Yandex Cloud documents a fact that is practical for the RU audience: the HashiCorp registry is unavailable from Russian addresses, and a provider mirror is needed; B3 and the pet projects of the RU version take this into account at `init`.

---

## 6. Block B3. A Kubernetes cluster from code (the third Kubernetes stage, R12)

### 6.1. Place, levels, environment

The third Kubernetes stage under R12 is a full kubeadm installation on 3+ VMs: the control plane, joining worker nodes, CNI (Cilium), storage, certificates, a version upgrade, an etcd backup and restore, "break and fix" of a node; the VMs are ordered by Terraform and configured by Ansible. Stages 1 (the simulator and the hybrid cluster) and 2 (k3s on one VM or three, tracks R1 and R2 of document 05) take place in the Kubernetes block, where the learner orders VMs by hand with `hcloud`/`yc` commands in their own cloud or runs them on their own computer. Stage 3 (tracks R3 and R4 of document 05) opens here, after B1 and B2: the Kubernetes content (kubeadm, PKI, etcd, upgrade) remains with 05, while this document provides the infrastructure from code, the Ansible roles, the check, the cost and the cleanup. In the 01 graph, K32 gets the prerequisites I05 and I10.

At this stage the trainer executes nothing: it guides step by step, shows the cost and checks the result with the `trainer-check` agent (09, 5.4). This is tier C: `envs: [vm]`, and the result is signed (`attest`) only if the learner does the track as a submitted one and has registered their machines with `trainer-exam enroll` (09, 5.4). Levels: the stage is mandatory for everyone (01 §3.3); L0 follows the full checklist with ready-made roles that the learner reads, runs and completes in the marked places (support S0–S1); L1 follows a skeleton (the directory structure, role and variable names and empty task files are given); L2 starts from scratch, with only `providers.yaml` given. Time: 6–8 hours with breaks; the set of VMs can be destroyed between sessions, because everything is restored from code.

### 6.2. Curriculum

| Step | Thesis | What the learner does |
|---|---|---|
| 0. Choice and cost | Before `apply` it is known how much it costs and how much it will cost if forgotten | Chooses a provider; the trainer calculates from `providers.yaml` (05, 10.2): `VMs × price_per_hour × hours + IPv4 × hours`, and in large type, "if forgotten for a month". The figures come from the same table as in 05 and 09 and are not written into the lesson |
| 1. Nodes in code (Terraform) | A cluster node is a module with a role as input and addresses as output | `modules/k8s-node` (input: `name`, `role` = control-plane / worker, `size`; output: `private_ip`, `public_ip`), a root module with `for_each = { cp-1 = "control-plane", worker-1 = "worker", worker-2 = "worker" }`, VMs with 2 vCPU / 4 GB, a private network, a security group (below), the label `trainer=devops` on all resources, `output "inventory"` in Ansible's YAML inventory format with the groups `control_plane` and `workers`. State is in a cloud bucket with locking; for local VMs and the in-tab cloud, a local state file or the emulator's object storage (00 §6.13) |
| 2. Preparing the nodes (Ansible) | A node is ready for kubeadm when the kernel, the runtime and the packages are configured identically on all nodes | Role `k8s_prereq`: swap off and removal from `/etc/fstab`; the `overlay` and `br_netfilter` modules in `/etc/modules-load.d/`; `net.ipv4.ip_forward=1` via `ansible.posix.sysctl`. Role `containerd`: `SystemdCgroup = true` in `config.toml`, a restart handler. Role `kube_packages`: the repository `pkgs.k8s.io/core:/stable:/v1.36/deb/`, `kubeadm`, `kubelet`, `kubectl` with a pinned version and a hold (`ansible.builtin.dpkg_selections: hold`). The second run has `changed=0` |
| 3. The first time by hand | kubeadm has to be seen once without automation, otherwise the role is an incantation | Following the 05 checklist (track R3): `kubeadm init --config` on `cp-1`, installing Cilium, `kubeadm join` on the worker nodes. The learner writes down which files appeared (`/etc/kubernetes/admin.conf`, `/etc/kubernetes/kubelet.conf`, `/etc/kubernetes/pki/`) — these become the `creates` conditions |
| 4. A cluster from code | What was done by hand once is turned into a role and checked by recreating from scratch | Role `kubeadm_init` on `cp-1`: `kubeadm init --config` from a template with `creates: /etc/kubernetes/admin.conf` — the main idempotency lesson for "a command without a module" (B1-5 on real machines). Role `kubeadm_join`: the join command via `kubeadm token create --print-join-command` with `delegate_to: cp-1` and `run_once`, then join with `creates: /etc/kubernetes/kubelet.conf`. Cilium via `helm upgrade --install` with the same protection. Then `tofu destroy` → `tofu apply` → `ansible-playbook site.yml` — the cluster comes up without manual steps |
| 5. Operations (content from 05) | — | Storage (local-path or the provider's CSI), certificates (`kubeadm certs check-expiration`), `etcdctl snapshot save/restore`, "break and fix" of a node (the agent introduces the breakage). The upgrade v1.36 → v1.37 (track R4) is a playbook with `serial: 1`: `kubectl drain` with `delegate_to: cp-1`, a package upgrade, `kubeadm upgrade node`, `uncordon`. Here `serial` from B1-12 stops being a training exercise |
| 6. Check | — | `trainer-check run --track b3-iac --nonce …` (6.4) |
| 7. Cleanup (mandatory) | — | 6.5 |

**Security group.** Between nodes: 6443/tcp (API), 2379–2380/tcp (etcd, control plane only), 10250/tcp (kubelet), 10257/tcp and 10259/tcp (controller-manager and scheduler, control plane only), 4240/tcp (Cilium health check), 8472/udp (Cilium VXLAN). From outside: 22/tcp and 6443/tcp only from the learner's address (the variable `admin_cidr`, whose `validation` forbids `0.0.0.0/0`).

**Providers.**

| Option | Provider | Specifics |
|---|---|---|
| Hetzner Cloud | `hetznercloud/hcloud` | `hcloud_network`, `hcloud_firewall`, the label `trainer=devops` |
| Yandex Cloud | `yandex-cloud/yandex` via a provider mirror | `labels = { trainer = "devops" }` |
| Selectel, Timeweb Cloud, VK Cloud | these clouds' providers from their documentation | the `k8s-node` module configuration differs only in the VM and network resources; the variants are published after a reference run |
| AWS | `hashicorp/aws` | `aws_vpc`, `aws_security_group`, tags `trainer = "devops"` and `dt-track` |
| Own Linux computer | `dmacvicar/libvirt` | VMs on the learner's own computer (09, 5.3); three nodes need 12+ GB of RAM; there are no public addresses, and Ansible and `kubectl` reach the VMs directly over the host's private network. On macOS and Windows the nodes are brought up with Multipass or Vagrant, the learner does the `k8s-node` module in the in-tab cloud and writes the Ansible inventory from the output of `multipass list` |
| No cloud account | the `lab` provider of the in-tab cloud (00 §6.13) | The `k8s-node` module code, `plan`, `apply` and `destroy` are practised against the cloud emulator, which creates real v86 machines; kubeadm is not installed on them (32-bit machines and tab memory), so the cluster is then brought up on local VMs |

The list of providers and prices is `providers.yaml` from 05, 10.2 and 09, 5.2; this document has no list of its own.

### 6.3. The E-K8S-CODE explanation "From `tofu apply` to three Ready nodes"

On the left a "code" column (`--c-code`: `infra/`, `site.yml`, roles), in the centre three VMs (`--c-cloud`, then `--c-node`), on the right the control plane (`--c-cp`). The only things that move are the readiness indicators on each VM and the call arrows.

| Screen | On screen and what moves | Parameters | "Break it" | Explanation on change |
|---|---|---|---|---|
| 1. VMs from code | `tofu apply` → three VM cards with addresses; `output "inventory"` goes as an arrow into the Ansible inventory | Number of worker nodes 1–4; plan size | — | The hourly cost counter and "per month, if forgotten" are recomputed immediately |
| 2. Preparation | Checkboxes "swap off", "kernel modules", "sysctl", "containerd", "packages" light up on each VM; ssh arrows from the control machine | `forks` 1–3 | "forget `br_netfilter`" → at step 4 the Cilium pods do not reach Ready, label "bridge traffic does not pass through netfilter" | The idempotency grid of the second run is all green |
| 3. `kubeadm init` | `/etc/kubernetes/pki/` and the static pods apiserver, etcd, controller-manager, scheduler appear on `cp-1` | — | "swap not disabled" → `[ERROR Swap]` preflight | A card: which files init creates and why this is the `creates` for the role |
| 4. CNI | Cilium pods on each node; a labelled VXLAN tunnel 8472/udp between nodes | — | "close 8472/udp in the security group" → pods on different nodes cannot see each other | The link to the networking part of 05 (R9): a pod on one node → VXLAN → a pod on another |
| 5. Join | The worker nodes receive the join command via a `delegate_to: cp-1` arrow, then `NotReady → Ready` | — | "token expired" → `couldn't validate the identity of the API Server` | `run_once` is labelled on the arrow: the token is created once for the whole play |
| 6. Recreation | `destroy` turns everything off, `apply` + the playbook bring it back up; a "from zero to Ready" timer | — | — | "A cluster that cannot be recreated from code is a pet; this one is not" |
| 7. Upgrade | Nodes one at a time: drain → packages → `kubeadm upgrade` → uncordon | `serial` 1 / all | `serial: all` → all nodes are drained at once, the application is unavailable | The "ready application replicas" counter does not drop below 2 only with `serial: 1` |

### 6.4. Check

`trainer-check run --track b3-iac --nonce …` (09, 5.4). The agent collects facts: `k8s` (nodes, `kube-system` pods), `tf` (the learner puts the output of `tofu show -json` next to it, and the agent reads the file), `ansible` (the agent itself runs `ansible-playbook site.yml --check` with `ANSIBLE_STDOUT_CALLBACK=json` on the learner's control machine), `files` (`/etc/kubernetes/pki/*.crt` — expiry dates).

```yaml
goals:
  - { id: nodes, envs: [vm], needs: [k8s], when: "k8s.nodes#=3 && k8s.objects[kind=Node][status.conditions[type=Ready].status=True]#=3" }
  - { id: same-version, envs: [vm], when: "k8s.nodes[*].kubelet=@first(k8s.nodes).kubelet" }
  - { id: cilium, envs: [vm], when: "k8s.objects[kind=Pod][metadata.labels.k8s-app=cilium][status.phase=Running]#=3" }
  - { id: idempotent, envs: [vm], needs: [ansible], when: "ansible.runs[-1].hosts[*].changed=0" }
  - { id: labelled, envs: [vm], needs: [tf], when: "tf.state.resources[addr~'k8s_node'][attrs.labels.trainer!=devops]#=0" }
  - { id: no-changes, envs: [vm], needs: [tf], when: "tf.plan.resource_changes[actions!=no-op]#=0" }
  - id: etcd-restore
    envs: [vm]
    probe: { script: probes/etcd-restore-marker.sh, expect_exit: 0, timeout: 120s }   # an action is required: it checks that the ConfigMap marker survived the restore
```

### 6.5. Mandatory cleanup

The track does not count until three things are done: `tofu destroy`; `tofu state list` is empty; the output of `hcloud server list -l trainer=devops -o json` or `yc compute instance list --filter 'labels.trainer="devops"' --format json` is empty (the trainer accepts pasted JSON). For local VMs an empty `tofu state list` or the output of `multipass list` replaces the provider list: they cost nothing, but the habit of cleaning up after yourself is part of the skill. A day after the track starts, the trainer reminds the learner of the unfinished cleanup on their next login (05, 10.5).

---

## 7. Block C. Monitoring: metrics, logs, traces, Prometheus, Grafana

### 7.1. Key decisions

**The "Shop" training system.** All exercises look at one fictional system, so that the learner gets used to how it normally looks and notices deviations: `frontend` (2 instances), `api` (3), `worker` (1), `postgres` (1), nodes `node-1..3`. Every service exposes metrics, logs and traces.

| Metric | Type | Labels |
|---|---|---|
| `http_requests_total` | counter | `job`, `instance`, `method`, `route`, `code` |
| `http_request_duration_seconds_bucket/_sum/_count` | histogram, `le` = `"0.005"` … `"10.0"`, `"+Inf"` | `job`, `instance`, `route` |
| `db_connections_in_use`, `db_connections_max` | gauge | `job`, `instance`, `pool` |
| `db_query_duration_seconds_*` | histogram | `query` |
| `worker_queue_length` | gauge | `queue` |
| `process_resident_memory_bytes`, `process_start_time_seconds`, `go_gc_duration_seconds` | gauge, summary | `job`, `instance` |
| `node_cpu_seconds_total` | counter | `instance`, `cpu`, `mode` |
| `node_memory_MemAvailable_bytes`, `node_memory_MemTotal_bytes` | gauge | `instance` |
| `node_filesystem_avail_bytes`, `node_filesystem_size_bytes` | gauge | `instance`, `mountpoint`, `fstype` |
| `node_network_receive_bytes_total` | counter | `instance`, `device` |
| `up`, `scrape_duration_seconds` | Prometheus synthetic | `job`, `instance` |
| `app_build_info` | gauge = 1 | `version`, `commit` |

**The metrics generator is a deterministic function of time.** The value of a series at time `t` is `f(seriesId, t, seed, incidents)`: daily seasonality, noise from a seeded generator, counter growth as the integral of the rate, a reset when the process restarts. Incidents are YAML scenarios that change rates and distributions over an interval. No data needs to be stored: the engine requests samples on the scrape-interval grid for any range. The same generator answers `curl http://api-1:8080/metrics` with text in the exposition format (`# HELP`, `# TYPE`, sample lines): a metric is just a line of text over HTTP. The generator emits the `le` and `quantile` label values in Prometheus 3's normalised form (`"1.0"`, not `"1"`).

In C16 mode the generator gets a second source — the kube-lite state (7.10): the `kube_*` series are built from cluster objects, the `container_*` series from the cgroup model of each container. In the hybrid cluster (05, R11) the `container_*` series come from the real `/sys/fs/cgroup` of the v86 nodes via the `cgroups` fact domain of the service agent (09, 1.4).

```yaml
# content/blocks/monitoring/incidents/db-pool.yaml
id: db-pool-exhaustion
seed: 4711
window: { start: "-3h", end: "now" }
events:
  - at: "-55m"
    deploy: { job: api, version: "2.3.1", commit: "9f3c2ab" }   # changes app_build_info, writes an annotation
  - at: "-52m"
    effect:
      - series: 'db_query_duration_seconds{query="get_cart_items"}'
        calls_per_request: { route: "/checkout", from: 1, to: 38 }   # N+1 query
      - series: 'db_connections_in_use{pool="main"}'
        saturate_to: db_connections_max
      - series: 'http_request_duration_seconds{route="/checkout"}'
        shift_quantiles: { p50: 0.4, p99: 4.8 }
      - series: 'http_requests_total{route="/checkout",code="503"}'
        rate_per_sec: 0.6
    logs:
      - { service: api, level: error, line: 'pool exhausted: timeout acquiring connection after 2s route=/checkout', rate_per_min: 30 }
    traces:
      - { route: /checkout, pattern: n_plus_one }   # a trace with 38 identical db spans
root_cause: { kind: deploy, version: "2.3.1", component: api, mechanism: "N+1 query in get_cart_items" }
fix: { action: rollback, to_version: "2.3.0" }
```

**The PromQL engine is our own in TypeScript, on top of the official grammar, with Prometheus 3.x semantics and verified against Prometheus's tests.** There is no ready-made PromQL engine for the browser: JavaScript has only parsers (`@prometheus-io/lezer-promql`, which powers the Prometheus web UI, and `@prometheus-io/codemirror-promql`), while the evaluators (Prometheus, Thanos promql-engine, Mimir) are in Go and run on the server. I reject compiling the Prometheus engine to wasm: the module is several times larger than the budget, a build for `GOOS=js` is not confirmed (the TSDB has platform-specific code), and most importantly we need the intermediate results of every tree node for the explanation, and those are easier to produce from our own evaluator.

- The semantics version is pinned: `prometheus_version` in `content/versions.yaml` (the 3.x branch), and the `promqltest` tests are taken from the same tag. Range selectors are left-open: a sample exactly on the left boundary of the window is not included, so with a 15 s scrape a `[1m]` window aligned with the samples contains 4 samples, not 5.
- Parsing is `@prometheus-io/lezer-promql` (the same syntax error messages); the editor is CodeMirror 6 with `@prometheus-io/codemirror-promql`, with autocompletion from the generator's metadata.
- Evaluation is our own tree walker: instant and range queries with a step, all four matchers, range vectors, `offset`, `@`, subqueries; the functions `rate`, `irate`, `increase`, `delta`, `idelta`, `deriv`, `predict_linear`, `*_over_time`, `histogram_quantile` (classic histograms), `abs`, `ceil`, `floor`, `round`, `clamp_min/max`, `time`, `timestamp`, `vector`, `scalar`, `absent`, `absent_over_time`, `changes`, `resets`, `label_replace`, `label_join`, `sort`, `sort_desc`; the aggregations `sum`, `avg`, `min`, `max`, `count`, `count_values`, `group`, `stddev`, `topk`, `bottomk`, `quantile` with `by`/`without`; binary operators with `on`/`ignoring`/`group_left`/`group_right`, comparisons with `bool`, `and`/`or`/`unless`; a 5-minute lookback; extrapolation in `rate`/`increase` as in the pinned version.
- Correctness: the `promqltest` tests (`functions.test`, `aggregators.test`, `operators.test`, `histograms.test` without native histograms, `subquery.test`, `at_modifier.test`, `staleness.test`) run in the product's CI against our engine; a failed test is an engine defect. Native histograms are not part of the course.
- Explanation: every tree node returns its own vector; the "Breakdown" tab shows the query tree with the result of each node.

**Grafana is not embedded; its model is reproduced.** The dashboard builder uses Grafana's panel model (`timeseries`, `stat`, `gauge`, `bargauge`, `table`, `heatmap`; `targets[].expr`, `legendFormat`, `fieldConfig.defaults.unit`, `thresholds`, `gridPos`; `templating.list` with `label_values(...)`) and exports **real dashboard JSON**, which the learner imports into Grafana in pet project 6. Charts are drawn by uPlot; the panels look recognisable but carry no Grafana branding.

**Logs and traces are there for linking the three signals.** A Loki-style log viewer with a subset of LogQL: `{service="api", level="error"}`, `|=`, `!=`, `|~`, `| logfmt`, `| json`, label filters, `count_over_time`, `rate`, `sum by`. Traces: a span waterfall for one request, search by service, route and duration; a jump from a chart point to a trace (exemplar) and from a span to logs by `trace_id`. The path of a trace from code to storage is OpenTelemetry (C14b). The course does not teach operating Loki and Tempo.

**Prometheus and Alertmanager configuration are real files.** `prometheus.yml` (`global.scrape_interval`, `scrape_configs`, `static_configs`, `relabel_configs` to the extent of `keep`/`drop`/`replace`/`labelmap`, `kubernetes_sd_configs` in C16), rule files (`record` or `alert`, `expr`, `for`, `keep_firing_for`, `labels`, `annotations` with `{{ $labels.instance }}`, `{{ $value }}`), rule unit-test files for `promtool test rules`, and `alertmanager.yml` (`route` with `group_by`, `group_wait`, `group_interval`, `repeat_interval`, nested `routes` with `matchers`, `receivers`, `inhibit_rules`). The **Targets** page shows the learner's targets with status and reason (`connection refused`, `context deadline exceeded`, `server returned HTTP status 404`).

### 7.2. Levels and additional check pool

| Level | What it means for monitoring (01, 4.3) |
|---|---|
| L0 | Has never seen dashboards; knows processes, memory and disk (Linux), HTTP and response codes (networks), containers and pods |
| L1 | Has looked at ready-made Grafana dashboards, knows the word "metric"; has copied queries. This also covers a programmer who has added metrics to code with a client library but has not designed alerts |
| L2 | Has set up alerts or written simple PromQL queries, or has worked with Zabbix; does not know SLOs, burn rate, or cardinality as an operational problem |

Pool (`key: false`; queries are checked with `promql_equiv`, 7.6):
1. *(L1, P)* "How many `api` instances are currently down?" Reference: `count(up{job="api"} == 0) or vector(0)`, rule `empty_equals_zero: true` — `sum(1 - up{job="api"})` is also accepted. Concepts O04, O17.
2. *(L1, P)* "Requests per second to `api` over 5 minutes, by route." Reference: `sum by (route) (rate(http_requests_total{job="api"}[5m]))`. Concepts O16, O17.
3. *(L1, T)* "Why can't `http_requests_total` be plotted as is?" Correct: a counter only grows and resets on restart; a chart needs the rate. `misconception: mon.counter-is-current-value`.
4. *(L2, P)* "An `up == 0` alert without `for` wakes the on-call engineer on every missed scrape. Fix it." Goals: `for` ≥ 1m; on data with a single gap the alert did not go to firing. Concept O21.
5. *(L2, P)* "p99 latency of `/checkout` across all instances together." Reference: `histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket{route="/checkout"}[5m])))`; `forbid_pattern: avg(histogram_quantile`. Concept O19.
6. *(L2, P)* "Free disk space will run out within the next 4 hours — an alert." Reference: `predict_linear(node_filesystem_avail_bytes{fstype!="tmpfs"}[6h], 4*3600) < 0`.
7. *(L2, T, number)* "An SLO of 99.9% over 30 days: what is the error budget in minutes of full downtime? At what burn rate will the budget run out in 2 days?" Answers: 43.2 minutes; 15.

### 7.3. Curriculum

| Module | Chapter thesis | Content | L0 | L1 | L2 |
|---|---|---|---|---|---|
| C1. Why monitoring | Monitoring is needed to learn about a problem before the customer does and to understand its cause | metrics, logs, traces — which question each one answers (O01) | in full | briefly | briefly |
| C2. Time series | A metric is a name and a set of labels; every unique combination of labels is a separate series | name, labels, samples (O02), cardinality (O15) | in full | in full | in full |
| C3. Metric types | A metric's type decides which questions can be asked of it | counter, gauge, histogram, summary; counter reset (O03) | in full | in full | in full |
| C4. How Prometheus collects | Prometheus itself goes to the services on a schedule and asks them | the pull model, `/metrics`, `prometheus.yml`, targets, `up` (O04); exporters node_exporter, blackbox_exporter, a DB exporter (O05); Pushgateway — only for batch jobs | in full | in full | briefly |
| C5. PromQL: selecting | A query starts by selecting series by name and labels | instant vector, selectors, the four matchers (O06), `offset` | in full | in full | briefly |
| C6. PromQL: rate | A counter is read through the rate of its growth over a window | range vector, `rate`, `increase`, `irate`, a window ≥ 4 scrape intervals (O16) | in full | in full | in full |
| C7. Aggregating and comparing | Aggregation drops labels, matching joins series by the remaining ones | `sum by`, `without`, `topk` (O17); vector arithmetic, `on`/`ignoring`, `group_left` for `app_build_info` (O18) | basics | in full | in full |
| C8. Histograms | A quantile is computed from the sum of buckets, not by averaging ready-made quantiles | buckets, `le`, `histogram_quantile` (O19) | overview | in full | in full |
| C9. What to measure | For a service you measure what the user feels; for a resource, how busy it is | RED, USE, the four golden signals (O10) | in full | in full | in full |
| C10. Dashboards | A dashboard goes from the general to the specific; units and thresholds are part of the meaning | panel, query, units, thresholds, variables (O07) | in full | in full | in full |
| C11. Alerts | An alert wakes a human, so it sits on a symptom and tolerates a short spike | rule (O08), `for`, pending/firing (O21), annotations; Alertmanager: route, grouping, silence, inhibition (O22) | in full | in full | in full |
| C12. Recording rules | An expensive query is computed in advance and stored as a new series | why, the naming `level:metric:operations` (O20) | — | in full | in full |
| C13. Incident | Every statement about the cause is backed by a query | the scenario in 7.7 | in full | in full | in full |
| C14. Logs and traces | A metric says "what", a log says "what exactly", a trace says "where" | a LogQL subset (O11), the trace waterfall, the jump metric → trace → log | overview | in full | in full |
| C14b. OpenTelemetry | One transport standard for the three signals, from code to any backend | SDK → OTLP → Collector (receivers, processors, exporters) → Prometheus, Tempo, Loki; the E-OTEL explanation (O12) | — | overview | in full |
| C15. SLO | Reliability is set as a number and spent like a budget | SLI, SLO, error budget (O09), a multi-window burn rate alert (O23) | — | overview | in full |
| C16. Kubernetes as a source of metrics | Container metrics are the cgroup files you have already read, and Prometheus finds targets through the same EndpointSlices as a Service | section 7.10 (O25, O24, O13) | overview | in full | in full |
| C17. Zabbix and the agent model | The same task, a different model: an agent on the host, templates and triggers | agent, active and passive checks, templates, triggers; comparison with Prometheus: who goes to whom, where the data is stored, how thresholds are set (O14) | overview | one lesson | one lesson |

### 7.4. Textbook plan, the E-MON and E-OTEL explanations

**C2. Time series.** Thesis: a metric is not a number but a set of series, one for each combination of labels.
1. A service counts events in memory — for example, the number of requests (builds on L17).
2. A counter has a name and labels: method, route, response code.
3. Every unique combination of labels is a separate series with its own "time — value" stream of samples.
4. Prometheus stores series, not "the whole metric": the number of series is the main memory cost.
5. A label with unbounded values (`user_id`) multiplies the number of series by the number of users — this is cardinality.
6. The rule: a label describes a dimension you will group by, not every individual object.
Comprehension check: C-I1 with the "add the `user_id` label" slider.

**C6. Rate.** Thesis: a counter shows how much there has been in total; a chart needs the rate of its growth.
1. The raw value of a counter grows from process start and drops to 0 on restart (builds on C3).
2. A range vector is a series' samples over a window `[5m]`, not a single value (builds on C5).
3. `rate` is the average per-second growth rate over the window; it accounts for counter resets.
4. `increase` is the growth over the window, i.e. `rate` × the window length; because of extrapolation it is not an integer.
5. `irate` looks at the last two points of the window and jumps around — for fast charts, not for alerts.
6. If the window has fewer than two samples, there is no result; this is why the window is made at least four scrape intervals long.
7. In Prometheus 3 the window is left-open: a sample exactly on its left boundary is not included.
Comprehension check: C-I6 with a choice of window and the prediction "will there be a result".

**C11. Alerts.** Thesis: an alert wakes a human, so it must talk about what the user feels and must not react to a single spike.
1. An alerting rule is a PromQL query with a condition; Prometheus evaluates it on a schedule (builds on C6, C7).
2. While the condition has held for less than `for`, the alert is pending; longer than that, it is firing.
3. Prometheus does not send notifications itself: it passes alerts to Alertmanager.
4. Alertmanager chooses the receiver by the alert's labels, combines similar alerts into one message and does not repeat it more often than `repeat_interval`.
5. Inhibition silences the consequences when the cause is present: with `NodeDown` there is no need for alerts from every service on that node.
6. An alert is placed on a symptom (error rate, latency), not on a cause (CPU 80%): there are many causes and one symptom.
Comprehension check: C-D8 "alert noise".

**E-MON "From a counter in code to a message for the on-call engineer".** Boxes from left to right: `api process (counter in memory)` (`--c-user`) → `/metrics` → `Prometheus scrape` → `TSDB` (`--c-store`, the "barrel" shape) → `rule evaluation` → `Alertmanager` → `receiver (pager / chat)`. Labels on the lines: `HTTP GET /metrics every 15s`, `append sample (t, v)`, `eval every 1m`, `POST /api/v2/alerts`, `group_wait 30s`, `webhook`. Under the diagram is the formula "time from failure to message = scrape + eval + for + group_wait" with the current values.

| Screen | On screen and what moves | Parameters | "Break it" | Explanation on change |
|---|---|---|---|---|
| 1. Counter | The number in the process grows with every request dot | Load, requests/s | "process restarted" → the counter goes to 0 | — |
| 2. Scrape | Prometheus does a GET, the exposition text unfolds into lines; a dot travels to the TSDB | `scrape_interval` 5 / 15 / 60 s; `scrape_timeout` | "target unavailable" → `up=0`, reason `connection refused` | The sample stream gets sparser or denser |
| 3. TSDB | A sample with the scrape timestamp is appended to the series | The `user_id` label on/off | — | A series counter and a memory gauge: "+N thousand series" |
| 4. PromQL | The `rate(x[w])` window slides along the stream, with the result line next to it | Window `w` 30 s – 15 min | "window smaller than two samples" → empty | "The window has 1 sample — the rate cannot be computed"; at 60 s and `[1m]` the result disappears |
| 5. Rule | Timeline inactive → pending → firing | `for` 0 / 1 / 5 / 10 min; threshold | "a single missed scrape" | Without `for` the alert fires on a spike — visible on the timeline |
| 6. Alertmanager | The alert drops into the route tree, the path through `matchers` is highlighted, `group_by` collects alerts into one message | `group_wait`, `group_interval`, `repeat_interval`, `group_by` | "no route for severity" → default receiver; "inhibit_rules disabled" → 12 messages instead of one | The "messages to the on-call engineer per night" counter is recomputed immediately |
| 7. Notification | A message to the receiver and, after the fix, resolved | `send_resolved` on/off | "Alertmanager stopped" → the rule is firing, no message | "Who watches the watcher: an always-firing Watchdog alert and an external check that it arrives" |

The source of the steps is `prom.scrape`, `prom.rule`, `am.notify`. A click on any box opens its page in the training Prometheus or Alertmanager.

**E-OTEL "The path of a trace".** Diagram: `code (SDK)` → `OTLP` → `Collector: receivers → processors → exporters` → three backends (`--c-metric`, `--c-log`, `--c-trace`). The spans of one request move; on screen 2 they are assembled into a waterfall.

| Screen | On screen | Parameters | "Break it" | Explanation |
|---|---|---|---|---|
| 1. Span | A function call opens and closes a span; `trace_id` passes to the next service in the `traceparent` header | — | "header not passed" → the trace splits in two | "The link between services rests on a single header" |
| 2. Waterfall | The spans of three services stack into a waterfall by time | — | — | A click on a span shows its attributes and the logs by `trace_id` |
| 3. Collector | Batches go to the Collector over OTLP, the sampling processor drops some of them | Sampling 100% / 10% / tail-based "errors only" | "Collector unavailable" → the lost-spans counter grows | The counter of kept and lost traces is recomputed immediately |
| 4. Backends | Exporters send metrics to Prometheus, traces to Tempo, logs to Loki | — | — | "Code once; the backends change in the Collector config" |

### 7.5. Interactives

**C-I1. "Anatomy of a time series".** The line `http_requests_total{job="api",instance="api-1:8080",route="/cart",code="200"} 18342` is broken down into name, labels and value; the sample stream is on the right. The "add the `user_id` label" slider multiplies the number of series, and the series counter and Prometheus's memory gauge show the cardinality.

**C-I2. "Four types".** Four live charts: counter (a step down on restart), gauge (`db_connections_in_use`), histogram (the cumulativeness of `le` as nested rectangles), summary (ready-made quantiles that cannot be added up across instances). The "restart api-2" button resets the counter; `rate` survives this, the raw value does not.

**C-I4. "Targets".** A `prometheus.yml` editor and the Targets page. Breakages: a typo in the port, a wrong `metrics_path`, a target behind a firewall (an nftables rule on the node — the link to N17), a `scrape_timeout` that is too short. The learner fixes it and sees `up` go to 1.

**C-I5. The PromQL workbench.** The main interactive of the block.
- *Editor* with autocompletion of metric names, labels and values; syntax errors shown in place.
- *Table and Graph*: an instant result with labels; a range result with a choice of range and step.
- *Breakdown*: the query tree; each node shows its result type, the number of series, the first rows and the labels left after aggregation. A click on a node highlights the part of the query. For `rate(x[5m])` the range vector node shows the window on a chart of raw samples (the left boundary is open), and the `rate` node the result line; a time slider moves the window.
- *Matching*: the left and right vectors as columns, lines between series with matching labels, unpaired series in grey. Explains `on`, `ignoring`, `group_left` and `many-to-many matching not allowed`.
- The "Explain" button passes the query, the tree and the intermediate results to the learner's neural network.

**C-I6. "The rate window".** A counter's raw samples as dots, windows `[1m]`, `[5m]`, `[15m]`, the lines `rate`, `irate`, `increase`. If the window has fewer than two samples there is no result, and the reason is labelled. A "Prometheus 2 / 3" switch shows how the left boundary of the window changes the number of samples.

**C-I7. "A quantile from buckets".** Bars of cumulative buckets, a line at 0.99 × count, the intersection point and linear interpolation within the bucket. Switching the bucket boundaries shows that the accuracy of the quantile is determined by the buckets.

**C-I8. Dashboard builder.** A 24-column grid (`gridPos`); a panel: type, query (with the workbench built in), `legendFormat`, units (`reqps`, `s`, `percentunit`, `bytes`), thresholds; the variables `$job`, `$instance` from `label_values(up, job)`; JSON export for Grafana.

**C-I9. "Route tree".** The workspace for screen 6 of E-MON: `alertmanager.yml` on the left, the route tree on the right; an alert with labels drops into the tree and highlights the path to the receiver; `inhibit_rules` silence `ServiceDown` when there is `NodeDown` on the same node. `amtool config routes test --config.file=alertmanager.yml severity=critical team=payments` in the terminal gives the same result.

### 7.6. The `promql_equiv` query checking logic

Query texts cannot be compared: the same quantity can be expressed in different ways. The check runs the learner's query and the reference on **K = 5 datasets**: different seeds and points in time, and always the edge cases — a counter reset, a vanished series, a new instance, a series with zero values. The results match if the set of label sets matches (normalised according to the task's rule: `labels: exact`, `labels: superset` or `labels: by [route]`) and the values match with a relative tolerance of 1e-6 (for range queries, at every step point). The rule `empty_equals_zero: true` treats an empty result as equal to a vector of zero — for tasks where "nothing" and "zero" mean the same thing. A task can require or forbid tree nodes: `require: [rate]`, `forbid: [irate]`, `forbid_pattern: avg(histogram_quantile`. On a mismatch the learner gets the difference: "the reference has 4 series with the route label, yours has 12 — you did not aggregate over instance"; "on the dataset with a counter reset your result is negative — use rate instead of delta".

```yaml
id: c7-d3
kind: promql
level: [L1, L2]
task:
  ru: "Какая доля запросов к каждому маршруту api заканчивается ошибкой 5xx (за 5 минут)?"
  en: "What share of requests to each api route ends in a 5xx error (over 5 minutes)?"
reference: >
  sum by (route) (rate(http_requests_total{job="api",code=~"5.."}[5m]))
  / sum by (route) (rate(http_requests_total{job="api"}[5m]))
goals:
  - id: g-equiv
    eval:
      promql_equiv: { datasets: [seed:1, seed:2, reset:api-2, new-instance, zero-errors], labels: { by: [route] }, tolerance: 1e-6, require: [rate] }
    fail:
      - if: "result.labels~instance"
        say: { ru: "В ответе есть метка instance: доля считается по маршруту для всех экземпляров вместе, агрегируйте by (route).", en: "Your result keeps the instance label: aggregate by (route)." }
        term: O17
```

### 7.7. Incident scenario C13 "Why did latency go up"

The scenario is practice, not a quiz: every statement the learner makes rests on a query whose result shows the evidence.

1. **The page.** An alert card `HighLatencyP99` with the annotations `service=api`, `p99 > 1s for 10m` and a link to the dashboard. The pager tone is off by default. The data covers 3 hours.
2. **The overview dashboard.** RED by service: `api` has higher duration and 5xx rate, traffic is normal. The learner marks the changes (a click on a panel → "mark as an observation").
3. **Hypotheses.** A hypotheses panel: free text or standard ones (load increased; one instance is sick; a dependency is slow; a release; node resources). Each hypothesis is closed with evidence.
4. **Narrowing down.** The workbench next to the dashboard. Expected steps: latency by `route` — only `/checkout` grows; by `instance` — all the same; traffic did not grow; `db_connections_in_use / db_connections_max` = 1; `app_build_info` and the deployment annotation — version 2.3.1 was rolled out 3 minutes before the increase. A query attached to a hypothesis is checked by a predicate on its result ("`/checkout` has a value ≥ 3× the median of the other routes"; "the pool ratio is ≥ 0.95").
5. **Trace and log.** An exemplar from the `/checkout` chart → a trace: 38 identical `SELECT ... FROM cart_items` spans. From the span, the logs by `trace_id`: `pool exhausted: timeout acquiring connection`. The learner states the mechanism: the new release makes a DB query for every item in the cart (N+1), the connection pool runs out, and requests wait.
6. **Action.** The environments page (A-I5): Re-deploy of version 2.3.0. After a few modelled minutes latency comes back, the alert goes to resolved; the learner confirms this with a query.
7. **Postmortem.** A template: the timeline (assembled from the learner's marks), the impact (the share of failed requests over the period — an `increase` query), the failed deployment recovery time (M13), the cause, what worked and what did not, actions (a CI test on the number of DB queries, an alert on pool saturation, canary from A5b). Role lenses: the same timeline from the point of view of the on-call SRE, the release author and the product lead; an explanation of why a postmortem has no one to blame (M12).

The assessment is feedback: the time to the first correct hypothesis, the number of wrong ones checked, whether all statements were backed by queries, whether the rollback was done before a long investigation (the first priority is to restore the service). For exams and repeated practice there are five more variants with the same starting point; the variant is chosen by the seed:
- one instance on an overloaded node (visible by `instance`, node CPU and container throttling);
- a memory leak with restarts (counter resets, `process_start_time_seconds`, `changes()`, `OOMKilled` in C16);
- the disk on the DB node is running out (`node_filesystem_avail_bytes`, write errors in the logs);
- a slow external dependency (the span of the external call; latency grows on all routes that use the payment API);
- **"504 at the entrance"** (the link to R9 and 05): the Gateway returns 504 because the Service has an empty EndpointSlice — readiness fails after a release, and a NetworkPolicy from the same release cuts traffic from the Gateway controller to the pods. Evidence: `kube_endpoint_address{ready="true"}` (or the EndpointSlice series) = 0 for `api`, a rise in 5xx at the Gateway level with zero requests at the `api` level, and `up` for the `api` targets is absent rather than equal to 0. The investigation chain DNS → Service → EndpointSlice → pod → NetworkPolicy is the same as in the networking part of the Kubernetes block, only through metrics.

### 7.8. Trainers

| ID | Task | Goals |
|---|---|---|
| C-D1 | Labelling an exposition line: name, labels, value; 10 lines, including `_bucket{le="+Inf"}` and a card `le="1.0"` versus `le="1"` (Prometheus 3 normalises, so a query with `le="1"` finds nothing) | choice |
| C-D2 | "What type is this metric?" — 12 descriptions | choice |
| C-D3 | Fix `prometheus.yml` so that all targets become UP | `prom.targets[*].health=up`; `promtool check config` is clean |
| C-D4 | 25 queries of increasing difficulty: a label, a regex matcher, `rate`, a sum by route, the top 3 routes by errors, the 5xx rate, node CPU as a percentage (`1 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))`), memory, disk, the service version via `group_left` on `app_build_info` | `promql_equiv`; step 2 — a clipping of `histogram_quantile` |
| C-D5 | "Find the error in the query": `rate(sum(http_requests_total)[5m])`; `sum(rate(x[30s]))` with a 1m scrape; `histogram_quantile(0.99, rate(..._bucket[5m]))` without `sum by (le)` when aggregating over instance; dividing vectors with different labels | the corrected query — `promql_equiv`; step 2 — a clipping of `rate` |
| C-D6 | A recording rule for the error rate and an alert on it; a unit test for the rule | `promtool check rules`; the rule is evaluated; the alert is firing on the dataset with the incident and inactive on the quiet one |
| C-D7 | Alertmanager routing: critical for the payments team to the pager, warning to the chat, everything else to email; inhibit a service's alerts when the same node has `NodeDown` | `amtool config routes test` on 8 label sets; inhibition in the scenario |
| C-D8 | "Alert noise": 6 rules, mark the bad ones (on a cause instead of a symptom, without `for`, a threshold on a raw counter, CPU > 80% with no impact on users) and rewrite them | choice + running the rules on 3 datasets |
| C-D9 | A RED dashboard for `api`: three panels (rate, error rate, p50/p95/p99), an `$instance` variable, correct units | `grafana.dashboards[uid=red-api]`: panel types, `unit` ∈ {`reqps`, `percentunit`, `s`}, each panel's `expr` passes `promql_equiv`, the variable is used in all queries |
| C-D10 | LogQL: api errors over the hour by route | the result equals the reference |
| C-D11 (L2) | A multi-window burn rate alert (1h and 5m at 14.4; 6h and 30m at 6) following the SRE Workbook | `promql_equiv`; firing on a "fast burn", not on "slow noise" |
| C-D12…C-D14 | Kubernetes as a source of metrics (7.10) | — |
| C-D15 | Zabbix: read the trigger `last(/web1/system.cpu.util)>90` and an expression with `avg(...,5m)`; write an equivalent PromQL rule | `promql_equiv` against the reference `avg_over_time(...)` + `for` |
| C-D16 | Step-4 tasks from 0.5 (`label_replace`, `amtool silence add`, `promtool test rules`) | by effect + the "where I found it" field |

### 7.9. Practical exam C (self-check, `envs: [sim]`)

"A new `worker` service has been deployed in Shop without monitoring", 120 minutes, `doc_ladder: { step: 5, allowed: [prometheus.io/docs, grafana.com/docs] }`.

| Task | Weight | Card | Checks |
|---|---|---|---|
| t1 | 15 | Add the `worker` targets to `prometheus.yml` | `critical`: `prom.targets[job=worker][health=up]#=1` |
| t2 | 20 | A dashboard of four panels (jobs processed per second, errors, queue length, p95 job duration) with an instance variable | the C-D9 rules |
| t3 | 20 | Two alerts — the queue grows for 15 minutes in a row, the error rate is above 5% for 10 minutes — and a critical route to the pager; a unit test for one rule (`promtool test rules`, a step-5 task) | the alerts fire on the incident dataset and stay silent on the quiet one (3 datasets each); the route by `amtool` |
| t4 | 15 | An unknown incident variant is started (from the seed, 7.7): find the cause using your own dashboard and alerts | `critical`: the cause is named and confirmed by an attached query |
| explain | 30 | "Why is an alert on CPU > 80% unnecessary when there is an alert on the error rate?"; "What will you do if Alertmanager itself goes down?" | rubric: symptom versus cause; impact on the user; Watchdog; an external check |

L2 in addition: SLI and SLO for `api`, recording rules and a burn rate alert. `pass: { critical: all, total_min: 70 }`.

### 7.10. C16. Kubernetes as a source of metrics (R6, R9)

In C16 mode the generator takes series from the kube-lite state: `metrics-server-lite` from 05, 5.2 is extended to the exporters `kube-state-metrics-lite` (series from objects) and `cadvisor-lite` (series from the cgroup model of each container on a node). The learner's actions in `kubectl` are immediately visible in PromQL; in the hybrid cluster the `container_*` series are built from the real cgroups of the v86 nodes.

Series: `kube_pod_status_phase`, `kube_pod_container_status_restarts_total`, `kube_pod_container_status_last_terminated_reason{reason="OOMKilled"}`, `kube_deployment_spec_replicas`, `kube_deployment_status_replicas_available`, `kube_node_status_condition`, `kube_endpoint_address`; `container_cpu_usage_seconds_total`, `container_memory_working_set_bytes`, `container_spec_memory_limit_bytes`, `container_oom_events_total`, `container_cpu_cfs_periods_total`, `container_cpu_cfs_throttled_periods_total`.

Chapter plan:
1. **Where container metrics come from** (O24). A pod's cgroup lives in `/sys/fs/cgroup/kubepods.slice/…`; the files `memory.current`, `memory.max`, `memory.events`, `cpu.max`, `cpu.stat` (`nr_periods`, `nr_throttled`) the learner has already read in the Linux block in the lesson "How the kernel isolates and limits" (R6, D04) and in pod limits (K22). `container_memory_working_set_bytes` is `memory.current` minus the inactive file cache; `container_spec_memory_limit_bytes` is `memory.max`; `limits.cpu: 200m` is `cpu.max` = `20000 100000`.
2. **How Prometheus finds pods** (O25). `kubernetes_sd_configs` with the roles `node`, `pod`, `endpointslice`; relabelling `__meta_kubernetes_pod_label_app` → `app`; the `prometheus.io/scrape` annotation is a configuration convention, not a built-in feature. The `endpointslice` role looks at the same EndpointSlices as a Service and kube-proxy (05, the networking part, R9): a wrong Service selector gives an empty EndpointSlice, there are no targets, and the `up` series is **absent** rather than equal to 0.
3. **ServiceMonitor and PodMonitor** as prometheus-operator CRDs (O13, requires K30).
4. **Control plane metrics**, as an overview: `apiserver_request_total`, `scheduler_pending_pods`.

**E-CG "Where container metrics come from".** A diagram along the axis of 08, 5.3: at the bottom the kernel (`--c-kernel`) with the cgroup files, above it the container process in a `--c-ns-cgroup` frame, on the right cadvisor-lite → Prometheus → the workbench.

| Screen | On screen and what moves | Parameters | "Break it" | Explanation |
|---|---|---|---|---|
| 1. File | `memory.current` grows, next to it a thermometer gauge with a `memory.max` mark (`--c-limit`) | `MEM_MB` load on `trainer/hog` | — | "This is the same file you read in Linux" |
| 2. Limit | The `limits.memory` slider in the pod manifest → the `memory.max` value in the file | `limits.memory` 64–512 Mi | "load above the limit" → OOM kill: the process disappears, `memory.events oom_kill` +1, the pod is `OOMKilled`, the restart counter +1 | In the workbench `container_oom_events_total` and `kube_pod_container_status_restarts_total` grow immediately |
| 3. CPU | A bar of 100 ms periods; the filled part is the `cpu.max` quota | `limits.cpu` 100m–2 | "quota smaller than demand" → periods with throttling are red | Throttling share = `nr_throttled / nr_periods`, with the same PromQL query next to it |
| 4. Scrape | cadvisor-lite reads the files of all containers on the node and serves `/metrics` | `scrape_interval` | "node NotReady" → the cadvisor target has `up=0` | — |

**C16 trainers.**

| ID | Task | Goals |
|---|---|---|
| C-D12 | "The pod is slow, CPU is not at 100%": `limits.cpu: 200m` on `trainer/hog`. A throttling-share query: `sum by (pod) (rate(container_cpu_cfs_throttled_periods_total[5m])) / sum by (pod) (rate(container_cpu_cfs_periods_total[5m]))`; then `kubectl exec` and `cat /sys/fs/cgroup/cpu.max` | `promql_equiv` + the answer "`cpu.max` = 20000 100000" |
| C-D13 | "Restarts": an alert `increase(kube_pod_container_status_restarts_total[15m]) > 3`, the cause from `last_terminated_reason`; raise `limits.memory` | `prom.rules[name=PodRestarting].state=inactive` after the fix; `keep`: the same Deployment |
| C-D14 | "Fewer replicas than needed": `kube_deployment_spec_replicas != kube_deployment_status_replicas_available` with `for: 10m`; the breakage is `kubectl cordon` on two nodes with `requests` greater than the free capacity | the alert is firing during the breakage and resolved after `uncordon` |

### 7.11. Sources for C

- EN: data model — https://prometheus.io/docs/concepts/data_model/ ; metric types — https://prometheus.io/docs/concepts/metric_types/ ; exposition formats — https://prometheus.io/docs/instrumenting/exposition_formats/ ; querying basics — https://prometheus.io/docs/prometheus/latest/querying/basics/ ; functions — https://prometheus.io/docs/prometheus/latest/querying/functions/ ; Prometheus 3.0 migration guide — https://prometheus.io/docs/prometheus/3.0/migration/ ; histograms and summaries — https://prometheus.io/docs/practices/histograms/ ; alerting rules — https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/ ; unit testing rules — https://prometheus.io/docs/prometheus/latest/configuration/unit_testing_rules/ ; Alertmanager — https://prometheus.io/docs/alerting/latest/alertmanager/ ; kubernetes_sd_config — https://prometheus.io/docs/prometheus/latest/configuration/configuration/#kubernetes_sd_config ; kube-state-metrics — https://github.com/kubernetes/kube-state-metrics/tree/main/docs ; cgroup v2 — https://docs.kernel.org/admin-guide/cgroup-v2.html ; OpenTelemetry concepts — https://opentelemetry.io/docs/concepts/ ; OpenTelemetry Collector — https://opentelemetry.io/docs/collector/ ; Zabbix manual (items, triggers) — https://www.zabbix.com/documentation/current/en/manual ; PromLabs PromQL cheat sheet — https://promlabs.com/promql-cheat-sheet ; Grafana, "Inside PromQL" — https://grafana.com/blog/2024/10/08/inside-promql-a-closer-look-at-the-mechanics-of-a-prometheus-query ; Grafana dashboard JSON model — https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/view-dashboard-json-model/ ; Google SRE book, monitoring distributed systems — https://sre.google/sre-book/monitoring-distributed-systems/ ; SRE Workbook, alerting on SLOs — https://sre.google/workbook/alerting-on-slos/ ; USE method — https://www.brendangregg.com/usemethod.html ; RED method — https://grafana.com/blog/2018/08/02/the-red-method-how-to-instrument-your-services/ ; lezer-promql — https://www.npmjs.com/package/@prometheus-io/lezer-promql
- RU: Habr (OTUS), histograms in Prometheus and `histogram_quantile` — https://habr.com/ru/companies/otus/articles/501978/ ; Yandex Cloud, Monitoring and Managed Service for Prometheus — https://yandex.cloud/ru/docs/monitoring/ ; Zabbix documentation in Russian — https://www.zabbix.com/documentation/current/ru/manual ; books: Brian Brazil, «Запускаем Prometheus» (DMK Press — the Russian translation of "Prometheus: Up & Running"); Beyer et al., «Site Reliability Engineering. Надёжность и безотказность как в Google» (Piter). There is no Russian documentation for Prometheus and Grafana, so the RU version of the lesson gives the definitions in Russian itself and refers to the English documentation as the primary source; Russian books and articles are the second source under the two-source rule.

---

## 8. Acceptance criteria for pet projects 5 and 6 and for parts A3, A5 of the final exam

The pet projects and the final exam belong to document 10 (sections 6.4 and 10); the checking mechanics come from the `trainer-check` agent (09, 5.4): `trainer-check pet 5`, `trainer-check pet 6`, `trainer-check capstone`. This section sets only the content criteria for the blocks of this document and the specifics of the environments. There is no separate checker container.

| Where | Criterion | Facts and predicate |
|---|---|---|
| Pet project 5, part A3 | VMs created from code, remote state with locking | `tf.state.resources#>=3`; the backend is not `local` (the agent reads `tofu show -json` and the `backend` block from the repository); after `plan` — `tf.plan.resource_changes[actions!=no-op]#=0` |
| Pet project 5, part A3 | One playbook with roles brings a clean VM to the state of project 1 or 3; a second run changes nothing; secrets are in vault | the agent runs `ansible-playbook site.yml --check` with the JSON callback: `ansible.runs[-1].hosts[*].changed=0`; vault files in the repository start with `$ANSIBLE_VAULT`; gitleaks is clean |
| Pet project 5 | The inventory is derived from Terraform's `output`, not written by hand | the repository contains inventory generation from `output -json` (a script, `local_file` or a dynamic inventory) — checked against the repository files |
| Pet project 6, part A5 | Prometheus scrapes node_exporter and the application's metrics | `prom.targets[job=node][health=up]#>=1 && prom.targets[job=app][health=up]#>=1` |
| Pet project 6, part A5 | A dashboard with the four golden signals | `grafana.dashboards[uid=<uid>]` exists; the panels use units from the C-D9 list; the dashboard can be exported from the C-I8 builder and imported |
| Pet project 6, part A5 | Alerts on the error rate and disk filling with `for:`; the alert arrives in Telegram or by email | `prom.rules[kind=alert][name=HighErrorRate]` and `[name=DiskWillFillIn4Hours]` with `for`; "cause a failure" — the learner stops the application container or fills the disk with a file, then pastes the text of the alert that arrived, with a one-time code from the annotation |
| Pet project 1, part A2 | Deployment from CI to a VPS | the criteria of 10, section 10; content — A5b (deployment over SSH, `resource_group`, rollback by tag) |

**Environment specifics.**

- **Local VMs on your own computer.** Such VMs have no inbound public addresses (09, 5.3), so the GitLab runner is registered **on the monitoring VM** (`gitlab-runner register`, docker executor): it polls gitlab.com itself, no inbound access is needed, and deployment to the app VM goes over the host's private network. This shows the runner's pull model from E-CI in practice. Grafana and Prometheus are opened in the learner's browser directly at the VM's private address. The Telegram alert leaves as outbound HTTPS through the host's NAT.
- **The learner's own cloud.** A security group rule "3000 and 9090 only from the learner's address" (the variable `admin_cidr`); from outside, 22, 80, 443.
- **Providers and prices**: `providers.yaml` (05, 10.2; 09, 5.2); the cost is shown before `apply` in the same way as in B3.
- **Cleanup is mandatory**, as worded in 6.5: `tofu destroy`, an empty `state list`, an empty list of VMs with the label `trainer=devops`; without it the project does not count.
- **README**: the template from 10, section 10; the section "what broke along the way and how I fixed it" is the main one for the defence.

---

## 9. Technical stack, sizes, fidelity checks, risks

### 9.1. Stack

| Task | Solution | Licence | Why |
|---|---|---|---|
| Git in the browser | `isomorphic-git` + an adapter to the Workbench VFS + our own layer of commands and reflog (0.3) | MIT | the only mature Git implementation in JS; the missing commands and reflog are 2–3 weeks of our own work, checked against the real git |
| YAML | `yaml` (eemeli) v2 | ISC | node positions for errors, comment preservation, 1.1/1.2 modes |
| GitLab CI schema | `ci.json` from the GitLab repository, ajv (draft-07) | MIT / MIT | the same schema as in the GitLab pipeline editor |
| GitHub Actions lint | actionlint → wasm; `github-workflow.json` from SchemaStore | MIT / Apache-2.0 | officially works in the browser |
| Editor | CodeMirror 6, `@codemirror/lang-yaml`, our own Lezer mode for HCL, `@prometheus-io/codemirror-promql` | MIT / Apache-2.0 | one editor for all blocks |
| Diagrams and explanations | the 08 primitives: `diagram`, `stepper`, `breakit`, `packets`, `constructor`; manual layout on an 8 px grid | — | diagrams that stay stable from step to step (08, 3.2) |
| Charts | uPlot | MIT | fast on tens of thousands of points |
| Docker in jobs | dsim and the registry (04) | — | one Docker model in the course |
| Kubernetes in jobs and C16 | kube-lite, `helm-engine.wasm` (05) | — | one Kubernetes in the course |
| Terraform/OpenTofu | tfsim: Go → wasm, `hashicorp/hcl/v2`, `zclconf/go-cty`, `hclwrite`; the OpenTofu fork spike (5.1) | MPL-2.0 / MIT | real HCL, diagnostics and `fmt` |
| Ansible | ansim in TypeScript, nunjucks for templates | — / BSD-2 | ansible-core does not work in wasm |
| Real Ansible | v86 on the platform's multi-node switch, the `lab-ansible` image | BSD-2 | a real ansible-core on the learner's computer |
| PromQL | `@prometheus-io/lezer-promql` + our own evaluator; `promqltest` tests of the pinned version | Apache-2.0 | official parsing, verifiable correctness, intermediate results |
| Documentation fragments | the `docs-snippets/` data package with a licence file per source (0.5) | per source | steps 2 and 5 of the ladder, offline |
| Tool versions | `content/versions.yaml`: GitLab and gitlab-runner, Node.js LTS (currently 22 and 24), Alpine (3.22), Docker Engine (29.x), Prometheus (3.x), ansible-core, OpenTofu, Helm (4.x), Kubernetes (v1.36/v1.37) | — | logs, image profiles and tests take their versions from here; reviewed quarterly |
| Content | a YAML schema for lessons and exercises, a build that checks `introduces/uses` against `concepts.yaml` | — | a single format with the engine |

Download budget (gzip): the block shell ≤ 400 KB of JS; tfsim ≤ 2.5 MB, on entering B2; actionlint ≈ 2–3 MB, on first opening GitHub Actions; v86 snapshots for the Ansible lab ≈ 90–110 MB zstd, only on explicit launch with a size warning. Everything is cached by a Service Worker.

### 9.2. Simulator fidelity checks

If a trainer behaves differently from the real tool, the learner will learn something untrue. So every exercise with a reference solution is automatically run both in the simulator and in the real tool at the pinned version (09, 1.3, "golden recordings"; heavy runs happen in CI on the course's test VMs), and the results are compared.

| Simulator | Reference in CI | What is compared |
|---|---|---|
| Git | the real git (version from `versions.yaml`) on the same scenarios | tree hashes, commit parents, the output of `log --oneline --graph`, `reflog`, rejection texts |
| Pipeline engine | `gitlab-ci-local` for GitLab syntax, `act` for GitHub Actions, on the training projects; the log against a real gitlab-runner of the same version | the order and set of jobs per event, statuses, log lines |
| Tool models | the real `npm`, `pip`, `go` on the same fixtures | error lines |
| ansim | ansible-core in containers (one container per host) | ok/changed/failed states per task, the resulting files, RECAP |
| tfsim | OpenTofu with a stub Edu Cloud provider (the same API as an HTTP service and a thin provider on terraform-plugin-framework) | plan JSON, the resulting state, diagnostic texts |
| PromQL | the `promqltest` tests of the same tag + every exercise `reference` through a real Prometheus with data from the generator (`promtool tsdb create-blocks-from openmetrics`) | query results |
| Alertmanager | the real `amtool config routes test` | receivers for label sets |

A discrepancy blocks the release of the content and serves as the second source, under the two-source rule, for tool behaviour (0.7).

### 9.3. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Our Git layer on top of isomorphic-git diverges from git | a reference run on the real git (9.2); renames during merges are not used in the exercises |
| nunjucks and Jinja2 diverge | the content linter forbids diverging constructs; a reference run on ansible-core |
| Modules outside ansible-core work in ansim but not in the lab | only FQCNs in the content; collections pinned in the `lab-ansible` snapshot; a reference run on ansible-core with the same collections |
| tfsim grows into a rewritten Terraform core | the scope is limited to the course's tasks; the OpenTofu fork spike in phase 0 with a decision rule (5.1) |
| tfsim does not fit into 2.5 MB | `-ldflags="-s -w"`, `wasm-opt -Oz`, TinyGo; measured in the spike |
| The v86 lab is too slow | an acceptance threshold of 90 s for 5 tasks and 2 hosts; otherwise the recorded mode |
| PromQL semantics change between Prometheus versions | the version is pinned in `versions.yaml`, `promqltest` tests from the same tag |
| GitLab and Helm behaviour changes between versions | versions in `versions.yaml`, a quarterly check against the `ci.json` schema and the `helm` output; deprecated flags (`--atomic`) are shown with a note |
| npm supply chain attacks | we build the tfsim and actionlint wasm modules ourselves from sources at fixed versions; npm dependencies follow the lock file with integrity checks, updates only through review |
| Documentation fragment licences | the `docs-snippets/` package with attribution; developer.hashicorp.com only as a link (0.5) |
| The learner takes the tool models for the real thing | a "simulated" note in the log; in the pet projects the steps run for real |
| The learner forgets to delete the VMs | the cost before `apply`, mandatory cleanup with an empty-list check, a reminder after a day (6.5) |
| Our own neural network gives away the solution | the `lab` and `lab-docs` modes, the reference is not passed into the context, `exam` — switched off; the checks do not depend on the neural network |

---

## 10. Dependencies on other roles

- **01 (andragogy).** Add the concepts C16–C31, I15–I27, O15–O25 to the graph and refine the wording of C03, I11, O06, O08 (0.2); add the edge K32 → I05, I10 and move the kubeadm tracks to after IaC (0.1); in the level checks "CI/CD (with Git)", "IaC", "Monitoring", mark at least two practical tasks as key; accept this document's pool as additional variants (`key: false`).
- **02 (Linux).** Lesson L31 "YAML and JSON" with the content of 2.7; the G-local module as the last module of the block; the lesson "How the kernel isolates and limits" (R6) with the files `memory.current`, `memory.max`, `cpu.max`, `cpu.stat`, `memory.events` — C16 rests on it. Workbench: a command registry, a VFS with permissions, several machines with `ssh`, a machine's packages and services as data structures (for ansim), `nano`/`vi`.
- **03 (networks).** N14 (HTTP), N17 (nftables), N18 (SSH), N19 (load balancing) — before the CI/CD block; the firewall in B1 is built on nftables, not on ufw.
- **04 (containers).** dsim and the registry for `docker build/push` in jobs; image profiles for CI jobs; the `docker:dind` service.
- **05 (Kubernetes).** kube-lite and `helm-engine.wasm` execute A7; `metrics-server-lite` is extended to `kube-state-metrics-lite` and `cadvisor-lite` for C16; `argocd-lite` for A-D20; tracks R3 and R4 open in B3 (after IaC), and their Kubernetes content stays with 05; rename the GitOps dependency `linux:git` to C05 (MR) according to the 01 graph; the isolated Worker of the "tiny controller" is reused in E-REC, screen 5.
- **07 (methodology).** Owner of M13–M17 and DORA; accepts the "Conveyor" storyboard with gates (without a human figure) and the A0 quiz questions without Git.
- **08 (engine).** New bus event types (0.6); new tokens `--c-code`, `--c-state`, `--c-cloud`, `--c-store`, `--c-metric`, `--c-log`, `--c-trace` (0.7).
- **09 (platform).** The fact domains `git`, `ci`, `tf`, `ansible`, `prom`, `am`, `grafana` in `dt.facts/v1` (0.4); the `lab-docs` mentor mode and the `doc_ladder` field in the context (0.5); a documentation viewer with snapshots for step 5; the `lab-ansible` image in the image table in 1.4; phase 0 spikes: tfsim and the OpenTofu fork (5.1), the speed of the Ansible lab (4.1); the `b3-iac` track of the `trainer-check` agent; the `lab` provider of the in-tab cloud (00 §6.13) for B3 without a cloud account.
- **10 (assessment).** Block exams in the 6.2 format; the criteria for pet projects 5 and 6 and for parts A3, A5 of the final exam — by reference to section 8 of this document; the questions "cache versus artifacts", "what are state and drift", "count versus for_each", "idempotency", "rate versus irate", "why quantiles are not averaged", "how does Terraform differ from Kubernetes" (E-REC), "a 504 — what do you do" (a C13 variant) go into the mock interview bank.

---

## 11. Changes after review

Two reviews were taken into account: from the Kubernetes role (`reviews/06-iac-cicd-monitoring--by-05-kubernetes.md`, hereafter K) and from the assessment role (`reviews/06-iac-cicd-monitoring--by-10-assessment-career.md`, hereafter O), as well as the owner's requirements R1–R12. Disputed facts were checked against the documentation: the renaming of flags in Helm 4 (`--atomic` → `--rollback-on-failure`, `--force` → `--force-replace`, the old names give a warning) is confirmed by the Helm 4 overview page and the project's migration notes; the semantics of `-target` (the target's dependencies are included in the plan) by the `plan` documentation; the left-open window boundary and the normalisation of `le` by the Prometheus 3.0 migration guide; that `authorized_key`, `ufw`, `timezone`, `ipaddr` belong to collections, by the Ansible collections documentation; the absence of `rebase`, `reset`, `revert`, `cherry-pick`, `reflog`, `diff`, `blame` in isomorphic-git by its API reference.

### What was changed

**Skeleton and order (K1, K2, K3, K8, O1, O6, O14).**
- The route was aligned with 01: Git is cut into G-local (the last Linux module) and G-remote (the start of the CI/CD block, after N14); YAML is lesson L31 of the Linux block, with the content handed over to 02 (section 2.7), and the Y-traps lesson (C30) remains in CI/CD. The order "Ansible before Terraform" is justified by the graph (0.1).
- The identifiers C16–C31, I15–I27, O15–O25 were introduced and C03, I11, O06, O08 refined; `introduces` is declared on a scene, with at most one concept; small details are a `facet` (0.2).
- The checks were rewritten into the 09 contract: `goals[]` with `when`, `keep`, `fail[].say`, `fail[].term`; the fact domains `git`, `ci`, `tf`, `ansible`, `prom`, `am`, `grafana` were proposed (0.4). The `a3-d1` example and all exams are in this format.
- Levels are L0/L1/L2 according to 01; the key tasks of the level checks remain in 01, 4.3, and the 06 tasks became an additional `key: false` pool with `misconception` and variants; it is proposed to mark at least two practical tasks as key (0.9). The "programmer" profile is described as L1 in IaC and monitoring.

**Owner's requirements.**
- R1: every module has a chapter thesis, and the core modules have a text plan of 5–8 statements (0.10, 2.3, 3.4, 4.4, 5.4, 7.4) (K15, O17).
- R2: the documentation ladder is the shared section 0.5 with page anatomy, tasks for steps 1–5 for G, A, B1, B2, C, the `lab-docs` mentor mode, the step-5 viewer, fragment licences and the linter; L2 starts at step 3, L1 at step 2 (K4, K19, K20, K30, O2).
- R3, R4: ten process explanations in the "blueprint" style with parameters, "break it", an explanation of each change and rewinding — E-GIT, E-CI, E-DEPLOY, E-ANS, E-TF, E-REC, E-K8S-CODE, E-MON, E-OTEL, E-CG; new bus events (0.6). Removed: ink in mechanism diagrams, the "little man", the "Friday release" storyline, a bot named "Petya"; manual changes arrive as a neutral log line (K5, K29, O3).
- R5: a colour token table with duplicate shapes and new tokens for code, state, cloud, storage and the three signals; what we take from Sankofa — magazine-style presentation, scrolling, layers, calm mode, role lenses in the postmortem, QR, bilingual YAML, `draft`/`hold` (0.7) (K14).
- R6, R9: C16 builds container metrics from cgroup v2 (`memory.current`, `memory.max`, `cpu.max`, `cpu.stat`) and target discovery through EndpointSlice; trainers C-D12…C-D14; the incident variant "504 at the entrance" (7.7, 7.10) (K10, O16).
- R10: the E-REC bridge — four reconcilers and your own small controller over Edu Cloud (5.5) (K13).
- R11: the Ansible lab on the platform's multi-node switch, DHCP via `dnsmasq`, `openssh-server` instead of dropbear, 256 MB for the control node and 96 MB for the managed nodes, a 90–110 MB snapshot budget, a spike speed threshold, the link to hybrid Kubernetes nodes (4.1) (K11, O12).
- R12: a new block B3 "A Kubernetes cluster from code" — a Terraform module `k8s-node` with the kubeadm and Cilium ports, Ansible roles, a first manual kubeadm pass, recreation from code, an upgrade with `serial: 1`, `trainer-check` checks, cost and mandatory cleanup; the learner's cloud, local VMs or the in-tab cloud (6) (K6, O4).

**Neighbouring documents (K7, K9, K12, K18, O5, O13, O15).**
- Module A0 was removed, M13–M17 and DORA belong to 07; the A-I6 bridge and the questions involving Git were kept; the "Conveyor" storyboard was handed over to 07 (1).
- A7 is executed in kube-lite and `helm-engine.wasm`: a ServiceAccount with a Role instead of cluster-admin, the GitLab agent for Kubernetes, an immutable tag, `rollout status`, Helm 4 flags, trainers A-D17…A-D20; GitOps as a concept by reference to 05 (3.7).
- Module A5b was added: deployment over SSH and compose (C13), deployment strategies (C14, a prerequisite of K12), the E-DEPLOY explanation, trainers A-D15, A-D16 (3.3, 3.4).
- `docker build/push` in jobs is executed by dsim; the `npm ci`, `pip`, `go build` models have a closed list of behaviours and a reference in CI (0.3, 9.2).
- The practicum was turned into acceptance criteria for pet projects 5 and 6 and for parts A3, A5 of the final exam; checking is done by `trainer-check`, and the separate checker container was removed; the local-VM specifics were added: the runner on the monitoring VM, access over the host's private network, outbound Telegram (8).

**Technical fixes.**
- Git commands were split into library ones and our own; our own reflog layer in Git's format; G-D3 "renamed file" was replaced by a modify/delete conflict; a reference run on the real git (0.3, 2.5, 9.2) (O8).
- tfsim was narrowed to the scope of the tasks, with a budget of ≤ 2.5 MB gzip and a reduction plan, and an OpenTofu fork spike with a decision rule (5.1) (K27, O9).
- B2-D10 was rewritten: `-target` includes the target's dependencies; resources that depend on it and unrelated resources are not created (5.6) (O10).
- Ansible modules use full names, collections are pinned, there is a screen about FQCN; `ipaddr` was removed; `ufw` was replaced by an nftables template, and `community.general.ufw` became a step-4 task (4.1, 4.6) (O11, K17).
- The PromQL engine is pinned to Prometheus 3.x, `le` is normalised, C-I6 and C6 explain the open left boundary; the wording "window smaller than two intervals" was replaced by "fewer than two samples in the window" (7.1, 7.4, 7.5) (K16, O21).
- Terms used before their introduction: the kubernetes executor and OIDC now go through `forward`, "S3" was replaced by shared storage, the bucket is introduced in B2-10 (I26) (K17).
- The homonyms "index / stage / staging" and "zone" were separated, and the attribute was renamed to `availability_zone` (0.2, 5.1) (O18).
- C14b OpenTelemetry and C17 Zabbix with trainer C-D15 were added (7.3) (O16).
- OpenTofu: state encryption and the differences from Terraform are named, B2-D11 was extended (5.1, 5.6) (O22).

**Minor (K21–K29, O19, O20, O23, O24).** The Ansible precedence ladder has 9 steps everywhere. The `needs` errors were split into "a later stage" and "a job excluded by `rules`, without `optional`". `.default` was replaced by the `default:` keyword with an expected error. An empty result — the `empty_equals_zero` rule and a reference with `or vector(0)`. The full syntax of `promtool query instant` and `amtool config routes test --config.file`. The runner log was extended with the cache saving and cleanup lines. The statement about the `@cdktf/hcl2json` package was removed; the rule of building wasm from sources remains. Versions were moved into `versions.yaml`, the matrix is Node 22 and 24. The source habr 746864 was relabelled as check mode (B1-12); a second Russian-language source for `changed_when` is being selected separately. The B1 precedence task was clarified with `hosts: all`; the G task about a single commit checks "parent = current `main`". The pager sound is off by default. Exam G is 60 minutes with a variant task.

### What was rejected or accepted with changes

| Comment | Decision | Why |
|---|---|---|
| K1: G-remote at the end of the networks block | Rejected as to placement: G-remote opens the CI/CD block (option O1) | Before CI/CD nobody needs a remote repository: the Docker block is fine with local Git. A Git module inside the networks block would break its logic of "from the big picture down to the packet" (R8), and the graph is satisfied in both options |
| K1: remove module Y | Accepted with changes: the Y1 content is not removed but handed over to the Linux block as lesson L31 (option O1) | 02 does not yet have lesson L31; by removing Y we would leave a graph concept without a lesson |
| K6: split stage 3 into 3a (kubeadm by hand in the Kubernetes block) and 3b (the same cluster from code in IaC) | Rejected; option O4 accepted: stage 3 entirely after IaC, with a manual kubeadm pass as step 3 inside B3 | Two passes mean renting three VMs twice and checking the same thing twice. The learner has already felt the pain of ordering VMs by hand in stage 2 (k3s on three VMs), and understanding kubeadm without automation is preserved by a manual step before the roles |
| O6: make the 06 sets the only source of level checks in 01 | Rejected; option K8 accepted: the source is 01, 4.3, and the 06 tasks are an additional pool | Two sources for checking one block diverge at the very first edit; 01 is responsible for the learner model and the criteria, the block role for the pool of variants |
| O8: rename detection during merges | Rejected: the conflict with a rename was replaced by a modify/delete conflict | Detection by content similarity is a complex heuristic that most often diverges from the real git; for the lesson's goal "a conflict is a place where a human decides" modify/delete is enough |
| O9: replace tfsim with an OpenTofu fork | Accepted as a spike with a decision rule, not as the default replacement | The 09 module budget is 2.5 MB gzip; the expected size of the fork is several times larger. A spike is cheaper than either decision made blind |
| O12: 192 MB for the lab's control node | Rejected: 256 MB (option K11) | `ansible-playbook` on 32-bit Python takes about 100 MB, and each fork adds a process; 192 MB leaves no room for `forks: 5`, which E-ANS shows. A 256 MB snapshot fits into the 40 MB budget of 09 |
| O14: identifier sub-levels with letters (`C08a`, `O06b`) | Accepted with changes: continuous numbering C16–C31, I15–I27, O15–O25 (option K2) | The 01 format is flat identifiers; letter sub-levels would create a second level of hierarchy that exists neither in the linter nor in `concepts.yaml` |
| O (R5 table): `--c-pipe-*` tokens per job status | Rejected: statuses use the existing `--c-ok`, `--c-err`, `--c-warn`, `--c-flow` with duplicate shapes | In 08 colour encodes the system layer, and state uses shared tokens; separate colours for every job status would break this rule and give the learner nothing new |
| K20: the name of the mentor mode `socratic-docs` | Accepted with a name change: `lab-docs` | The modes in 09, 4.5 are named after the place (`learn`, `lab`, `exam`); `lab-docs` is the same `lab` with the step-4 rule |
