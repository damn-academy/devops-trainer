# src/blocks/kubernetes

**What lives here:** Kubernetes stages 1 and 2 (route ids `k8s-1`, `k8s-2`).

**Design source:** `design/05-kubernetes.md`.

**Owner:** the Kubernetes builder. Other builders do not edit files in this folder; if you need
something from it, ask through the lead or add a backwards-compatible extension
point in your own folder.

**How it plugs in:** create `index.ts` here with `export default defineModule({ blocks, lessons, concepts, quiz, explainers, commands, docs, exams })` — it is discovered automatically by `src/core/registry.ts`.

See `web/CONTRACTS.md` for the contracts (types in `src/core/types.ts`).
