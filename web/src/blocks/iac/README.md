# src/blocks/iac

**What lives here:** IaC: Ansible and Terraform (route id `iac`) and A cluster from code (route id `k8s-3`).

**Design source:** `design/06-iac-cicd-monitoring.md §4–6`.

**Owner:** the CI/CD–IaC–monitoring builder. Other builders do not edit files in this folder; if you need
something from it, ask through the lead or add a backwards-compatible extension
point in your own folder.

**How it plugs in:** create `index.ts` here with `export default defineModule({ blocks, lessons, concepts, quiz, explainers, commands, docs, exams })` — it is discovered automatically by `src/core/registry.ts`.

See `web/CONTRACTS.md` for the contracts (types in `src/core/types.ts`).
