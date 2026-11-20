# src/engine/sim-net

**What lives here:** netlab: the discrete-event network simulator (hosts with iproute2, iptables/nft, dig, curl, ss, tcpdump; DNS; NAT) and its commands.

**Design source:** `design/03-networks.md §8`.

**Owner:** the networks builder. Other builders do not edit files in this folder; if you need
something from it, ask through the lead or add a backwards-compatible extension
point in your own folder.

**How it plugs in:** create `module.ts` here with `export default defineModule({ commands, facts, setup, widgets, docs, settings, mentor })` — engine modules are discovered automatically (before block modules) by `src/core/registry.ts`.

See `web/CONTRACTS.md` for the contracts (types in `src/core/types.ts`).

### Command behavior

- `nc` accepts numeric ports, comma-separated lists, and inclusive ranges. A
  scan succeeds when at least one port connects; invalid ports fail before traffic.
- `ssh` follows the simulated network and its TCP/firewall rules. Network presets
  model preauthorized `root` and `learner` accounts; localhost keeps the Linux
  simulator's key checks. Remote commands and interactive sessions use the remote
  host's files, and `exit` returns locally. Reset closes the session. Use v86 for
  full SSH authentication semantics.
- `nginx -s reload` and `systemctl reload nginx` load the same validated config.
- Packet delay includes serialization at `Segment.bandwidthMbps` (default 100).
  This is a deterministic network model, not a CPU benchmark. Shell `time` reports
  simulated elapsed time; CPU accounting is zero.
- `sysctl net.ipv4.ip_forward` and `/proc/sys/net/ipv4/ip_forward` share a value.
  `iptables -v` shows rule and filter-policy counters; `iptables-save -c` exports
  them and `iptables -Z` resets them.
- `dhcpcd -T` probes without configuring the interface, `-U` dumps the stored
  lease, and `ip addr` shows its remaining lifetime. The home preset includes
  `https://selfsigned.example/` for certificate validation exercises.
