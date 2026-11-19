# src/engine/sim-net

**What lives here:** netlab: the discrete-event network simulator (hosts with iproute2, iptables/nft, dig, curl, ss, tcpdump; DNS; NAT) and its commands.

**Design source:** `design/03-networks.md §8`.

**Owner:** the networks builder. Other builders do not edit files in this folder; if you need
something from it, ask through the lead or add a backwards-compatible extension
point in your own folder.

**How it plugs in:** create `module.ts` here with `export default defineModule({ commands, facts, setup, widgets, docs, settings, mentor })` — engine modules are discovered automatically (before block modules) by `src/core/registry.ts`.

See `web/CONTRACTS.md` for the contracts (types in `src/core/types.ts`).
