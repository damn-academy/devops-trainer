# src/engine/flowlab

**What lives here:** flowlab: the flow-of-work simulator for the methodology block (scenarios S0–S8).

**Design source:** `design/07-methodology-kanban.md §8`.

**Owner:** the methodology builder. Other builders do not edit files in this folder; if you need
something from it, ask through the lead or add a backwards-compatible extension
point in your own folder.

**How it plugs in:** create `module.ts` here with `export default defineModule({ commands, facts, setup, widgets, docs, settings, mentor })` — engine modules are discovered automatically (before block modules) by `src/core/registry.ts`.

See `web/CONTRACTS.md` for the contracts (types in `src/core/types.ts`).
