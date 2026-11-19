# src/blocks/iac

**What lives here:** IaC: Ansible and Terraform (route id `iac`) and A cluster from code (route id `k8s-3`).

**Design source:** `design/06-iac-cicd-monitoring.md §4–6`.

**Owner:** the CI/CD–IaC–monitoring builder. Other builders do not edit files in this folder; if you need
something from it, ask through the lead or add a backwards-compatible extension
point in your own folder.

**How it plugs in:** create `index.ts` here with `export default defineModule({ blocks, lessons, concepts, quiz, explainers, commands, docs, exams })` — it is discovered automatically by `src/core/registry.ts`.

See `web/CONTRACTS.md` for the contracts (types in `src/core/types.ts`).

## The cloud lab on real machines (design 00 §6.13)

`cloudlab/` is the widget `iac.cloudlab` and the page `#/lab/cloud`: a real
Alpine workstation (v86) with curl, git and OpenTofu, and the in-tab cloud
(`engine/cloud`) on the same switch: `api.cloud.lab`, `s3.cloud.lab`,
`git.lab`, `ci.lab`. Every VM the API creates is a real v86 machine
(`backend.ts`). `ci.ts` runs pipelines from `.gitlab-ci.yml` on push to
git.lab as shell jobs on the workstation (rules and parsing from
`git-cicd/ci/config.ts`, stages, manual jobs, artifacts). Checks read
`cloud.*`, `s3.*`, `git.*`, `ci.*` (`facts.ts`), the workstation's files and,
with `vmScopes`/`vmWatch`, `vms['<name>']`.

Lessons in `content-3.ts`: `iac.cloud-api`, `iac.tofu-lab`, `iac.remote-state`,
`iac.modules-lab`, `iac.ci-apply`; exams `iac.exam.cloud` (here) and
`cicd.exam.tab` (`git-cicd/content/exam-tab.ts`) run in the tab through
`Exam.inTab`. Tests: `tests/iac-cloudlab.test.ts`; end to end on v86:
`V86_CLOUDLAB=1 npx vitest run tests/iac-cloudlab-v86.test.ts --silent=false`.
The lab image has no Python, so there is no Ansible on real machines yet.
