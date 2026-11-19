# src/blocks/methodology

**What lives here:** Methodology block and the Orientation segment (route ids `orient`, `methodology`).

**Design source:** `design/07-methodology-kanban.md, 01 §3.4 (Orientation)`.

**Owner:** the methodology builder. Other builders do not edit files in this folder; if you need
something from it, ask through the lead or add a backwards-compatible extension
point in your own folder.

**How it plugs in:** create `index.ts` here with `export default defineModule({ blocks, lessons, concepts, quiz, explainers, commands, docs, exams })` — it is discovered automatically by `src/core/registry.ts`.

See `web/CONTRACTS.md` for the contracts (types in `src/core/types.ts`).
