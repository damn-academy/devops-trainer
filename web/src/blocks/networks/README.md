# src/blocks/networks

**What lives here:** Networks block (route id `networks`): net.m00–m16 and the protocol catalogue.

**Design source:** `design/03-networks.md`.

**Owner:** the networks builder. Other builders do not edit files in this folder; if you need
something from it, ask through the lead or add a backwards-compatible extension
point in your own folder.

**How it plugs in:** create `index.ts` here with `export default defineModule({ blocks, lessons, concepts, quiz, explainers, commands, docs, exams })` — it is discovered automatically by `src/core/registry.ts`.

See `web/CONTRACTS.md` for the contracts (types in `src/core/types.ts`).
