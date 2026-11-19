# src/blocks/monitoring

**What lives here:** Monitoring (route id `monitoring`).

**Design source:** `design/06-iac-cicd-monitoring.md §7`.

**Owner:** the CI/CD–IaC–monitoring builder. Other builders do not edit files in this folder; if you need
something from it, ask through the lead or add a backwards-compatible extension
point in your own folder.

**How it plugs in:** create `index.ts` here with `export default defineModule({ blocks, lessons, concepts, quiz, explainers, commands, docs, exams })` — it is discovered automatically by `src/core/registry.ts`.

See `web/CONTRACTS.md` for the contracts (types in `src/core/types.ts`).
