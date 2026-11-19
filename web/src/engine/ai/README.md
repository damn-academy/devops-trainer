# src/engine/ai

**What lives here:** The AI mentor: bring-your-own-key adapters, key storage, mentor modes, the "Your AI" settings section.

**Design source:** `design/09-runtime-ai-architecture.md §4, 01 §16`.

**Owner:** the platform/v86/AI builder. Other builders do not edit files in this folder; if you need
something from it, ask through the lead or add a backwards-compatible extension
point in your own folder.

**How it plugs in:** create `module.ts` here with `export default defineModule({ commands, facts, setup, widgets, docs, settings, mentor })` — engine modules are discovered automatically (before block modules) by `src/core/registry.ts`.

See `web/CONTRACTS.md` for the contracts (types in `src/core/types.ts`).
