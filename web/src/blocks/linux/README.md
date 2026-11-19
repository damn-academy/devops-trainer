# src/blocks/linux

**What lives here:** Linux block (route id `linux`): M0–M17, the full command set of the simulated machine.

**Design source:** `design/02-linux.md`.

**Owner:** the Linux builder. Other builders do not edit files in this folder; if you need
something from it, ask through the lead or add a backwards-compatible extension
point in your own folder.

**How it plugs in:** create `index.ts` here with `export default defineModule({ blocks, lessons, concepts, quiz, explainers, commands, docs, exams })` — it is discovered automatically by `src/core/registry.ts`.

See `web/CONTRACTS.md` for the contracts (types in `src/core/types.ts`).
