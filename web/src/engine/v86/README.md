# src/engine/v86

**What lives here:** Tier B: real Linux in the browser (v86) behind the same Machine interface.

**Design source:** `design/09-runtime-ai-architecture.md §1.4–1.8`.

**Owner:** the platform/v86/AI builder. Other builders do not edit files in this folder; if you need
something from it, ask through the lead or add a backwards-compatible extension
point in your own folder.

**How it plugs in:** create `module.ts` here with `export default defineModule({ commands, facts, setup, widgets, docs, settings, mentor })` — engine modules are discovered automatically (before block modules) by `src/core/registry.ts`.

See `web/CONTRACTS.md` for the contracts (types in `src/core/types.ts`).
