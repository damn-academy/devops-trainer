# src/blocks/career

**What lives here:** Career (route id `career`), the on-call shift and the final exam (route id `final`), pet projects.

**Design source:** `design/10-assessment-career.md`.

**Owner:** the assessment and career builder. Other builders do not edit files in this folder; if you need
something from it, ask through the lead or add a backwards-compatible extension
point in your own folder.

**How it plugs in:** create `index.ts` here with `export default defineModule({ blocks, lessons, concepts, quiz, explainers, commands, docs, exams })` — it is discovered automatically by `src/core/registry.ts`.

See `web/CONTRACTS.md` for the contracts (types in `src/core/types.ts`).
