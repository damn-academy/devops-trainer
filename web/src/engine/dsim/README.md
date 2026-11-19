# src/engine/dsim

**What lives here:** dsim: the Docker engine simulator (images, layers, CAS, build cache, container networks over netlab) and the course registry.

**Design source:** `design/04-containers.md §11`.

**Owner:** the containers builder. Other builders do not edit files in this folder; if you need
something from it, ask through the lead or add a backwards-compatible extension
point in your own folder.

**How it plugs in:** create `module.ts` here with `export default defineModule({ commands, facts, setup, widgets, docs, settings, mentor })` — engine modules are discovered automatically (before block modules) by `src/core/registry.ts`.

See `web/CONTRACTS.md` for the contracts (types in `src/core/types.ts`).
