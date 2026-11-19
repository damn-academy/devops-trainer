# src/engine/kube-lite

**What lives here:** kube-lite: store with watch, apiserver-lite, controllers, scheduler, cni/kube-proxy/coredns lite, kubectl and kubectl explain pages.

**Design source:** `design/05-kubernetes.md §5`.

**Owner:** the Kubernetes builder. Other builders do not edit files in this folder; if you need
something from it, ask through the lead or add a backwards-compatible extension
point in your own folder.

**How it plugs in:** create `module.ts` here with `export default defineModule({ commands, facts, setup, widgets, docs, settings, mentor })` — engine modules are discovered automatically (before block modules) by `src/core/registry.ts`.

See `web/CONTRACTS.md` for the contracts (types in `src/core/types.ts`).
