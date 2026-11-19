# src/blocks/networks

**What lives here:** Networks block (route id `networks`): net.m00–m16 and the protocol catalogue.

**Design source:** `design/03-networks.md`.

**Owner:** the networks builder. Other builders do not edit files in this folder; if you need
something from it, ask through the lead or add a backwards-compatible extension
point in your own folder.

**How it plugs in:** create `index.ts` here with `export default defineModule({ blocks, lessons, concepts, quiz, explainers, commands, docs, exams })` — it is discovered automatically by `src/core/registry.ts`.

See `web/CONTRACTS.md` for the contracts (types in `src/core/types.ts`).

## Labs on real Linux (`reallab/`, design `00` §6.13)

The lesson `networks.linux-lab` (`lessons-d.ts`, tier `plus`) and the exam
`networks.exam.browser` run on Alpine machines of the lab image in the tab,
through the widget `net.reallab` (props `{ lab: <id> }`, or `Exam.inTab`).

- `labs.ts` — six labs: `capture`, `vlan`, `router`, `netns`, `firewall`, `dnsmasq`;
  `exam-lab.ts` — the three machines and the goals of part B in the browser.
- `spec.ts` — the lab shape and `gather()`: lab fact scopes per machine,
  files, `nginx -T`, and the probes the open goals name.
- `probes.ts` — ping, TCP, HTTP, DNS and command probes run on the service
  channel of the machine they start from; results land in `reach[<id>]`.
- `tap.ts` — the switch tap: capture ring, `.pcap` export, per-port loss and delay.
- `widget.ts` — the UI (loaded on mount): machine tabs, goals with hints and
  doc chips, the capture panel and the line knobs.

Goals with `on` see one machine's facts; without it they see
`{ machines, switch }`. Reference solutions live only in
`tests/networks-reallab-v86.test.ts` (`NET_LAB=1` boots every lab and
solves it on the real emulator).
