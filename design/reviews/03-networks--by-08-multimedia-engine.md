# Review of 03-networks.md

Reviewer: author of `08-multimedia-engine.md` (the textbook engine, visual language, explorable explanations). Date: 18.11.2026.
Document under review: `design/03-networks.md`, draft of 18.11.2026. Checked against 01 (concept graph, hour budget), 02 (L14, L15), 04 (container dependencies), 05 (K4, cni-lite, kube-proxy-lite), 08 (§3, §5, §6.3), 09 (tiers, `dt.facts/v1`, `trainer-check`, real VMs). The owner's requirements R1–R12 were applied as mandatory.

## Verdict

As a networking program, the document is strong. It has a well-thought-out model of its own, `netlab`, with real bytes and pcap export, an honest TCP with RTO and `tcp_syn_retries`, and a good system of breakages. The troubleshooting scenarios (T1–T12) with a debrief tree are the best thing in the whole set of documents when it comes to "understanding what broke". Almost all the numbers I checked are correct.

In its current form the document cannot be accepted, for five reasons:

1. It explicitly rejects v86 as a network environment and thereby contradicts R11 and document 09.
2. It has no documentation ladder (R2).
3. There is no map of the internet and no protocol catalog (R8), and the list of "what the block does not do" directly contradicts R8.
4. The concept numbers and order diverge from the 01 graph. The document does not take into account that L14 in the Linux block has already introduced IP, port and DNS. veth, bridge and netns, which 04 and 05 rely on, are not introduced.
5. The process explanations from R3 exist only for the URL and the envelopes. Two references ("7.3, the TCP scene" and "the netfilter scene") lead nowhere.

The visual part (ink, "a sheet on the table", color by protocol) must be brought in line with R4/R5 and the 08 tokens.

Below are 22 findings. For each blocking and major finding, ready text that can be pasted is given.

Summary: BLOCKING — 5, MAJOR — 10, MINOR — 7.

---

## 1. BLOCKING — v86 is rejected, a multi-node stand with our own switch is missing (R11)

**Where:** §2, the product table (the v86 row), "Decision 1", "Decision 4", §7.3.5.

**What is wrong.** The document says that v86 is "one VM — tens of MB; three to five machines in a topology on a laptop is unacceptable; packets between VMs cannot be animated or deterministically broken". The third claim is wrong. In v86, every Ethernet frame of the guest comes out as a `net0-send` bus event (Uint8Array) and is received via `bus.send("net0-receive", frame)` (see `examples/two_instances.html` in the v86 repository). So a JS switch sees every frame. It can parse the frame with our own dissectors (§8.1), animate it, delay it, drop it, truncate it by MTU and write it to pcap. The first claim is removed by R11: an Alpine node at 64–128 MB, 3–4 nodes on a laptop, 1 on a phone.

There is also a divergence from 09. There, the machine network is `inbrowser` (BroadcastChannel), i.e. a shared "hub" without a topology. Such a hub can neither be drawn link by link nor broken one link at a time. R11 requires our own switch, so `inbrowser` must be replaced with `vswitch` in 09. This is a finding for 09, but the decision must be recorded by the "Networks" block.

**Fix. Insert a new section 7.7 and rewrite "Decision 1" and "Decision 4".**

> **Decision 1 (new wording).** The network lives on two tiers with one packet model.
> Tier A is `netlab` (TypeScript, simulated time, full determinism). It is needed for the beginner, for theory, for step-by-step explanations and for scenarios with a simulated clock.
> Tier B is 2–4 real Linux nodes in v86 (the `lab-alpine`/`lab-net` image, 64–128 MB each), connected by our JS switch `vswitch`. It is needed for ARP, routing, iptables/nftables, NAT, WireGuard and tcpdump on a real kernel.
> Both environments emit the same `net.packet` events with one `Packet` format (§8.1) into the 08/3.0 bus. So the diagram, the animator and the packet scope do not know which tier the lesson runs on.

> ### 7.7. The multi-node stand: v86 + `vswitch`
>
> **Design.** Each node is a separate Web Worker with a v86 instance, `net_device: { type: "virtio" }` without a `relay_url`. The worker subscribes to `net0-send` and forwards the frame to the switch worker via a `MessagePort`, passing the `ArrayBuffer` as a transferable. The switch delivers the frame to the right node, which does `bus.send("net0-receive", frame)`. The switch is a learning L2 bridge: a MAC table with a 300 s aging timer, flooding of unknown destinations to all ports, optionally 802.1Q (access/trunk port, VLAN ID) for the VLAN card in the protocol catalog.
>
> ```ts
> // web/src/runtime/vswitch.ts
> interface LinkParams { delayMs: number; jitterMs?: number; lossPct?: number; mtu?: number; bandwidthKbps?: number; up: boolean }
> interface VSwitch {
>   attach(port: string, endpoint: FramePort): void;            // FramePort: a v86 worker or a netlab host
>   link(port: string, p: Partial<LinkParams>): void;           // the "delay/loss/MTU" sliders on the diagram
>   vlan(port: string, mode: { access: number } | { trunk: number[] }): void;
>   fault(rule: { port?: string; match: string; action: 'drop' | 'delay' | 'corrupt'; ms?: number }): string; // match is a subset of pcap-filter
>   tap(port: string): ReadableStream<Packet>;                  // a "probe" = tcpdump on a link, pcap export with linktype 1
>   mac(): { mac: string; port: string; age: number }[];        // the MAC table, drawn on the diagram
> }
> ```
>
> **Mixed topologies.** A `netlab` host can also be a switch port, because it generates real bytes with checksums. This way the "internet" from §7.3.2 (root, TLD and authoritative DNS, public resolvers) serves real v86 nodes, and we do not need to keep a fourth virtual machine for DNS. Limitation: the netlab TCP stack is simplified (a fixed window, without SACK and congestion control). So in a mixed topology a netlab host answers only ARP, ICMP, DHCP and DNS over UDP. TCP endpoints are always in v86 (nginx, the application, sshd in `lab-net`). The lab validator checks this rule.
>
> **Animation and breakage.** Every frame that passes through the switch becomes a `net.packet {from, to, layers, verdict}` event. The 08/3.6 animator draws it along an edge of the diagram, with no more than 6 envelopes in flight at once; the rest fold into a counter on the link. Breakages are deterministic at the switch level ("link r1–h2 down", "MTU 1400 on the wg link", "drop ICMP type 3 code 4"). Timings inside the guests are not deterministic, so checks on tier B are built only on facts (09, §2) and never on time.
>
> **Kernel.** Add to the `dt-kernel` fragment from 09 §1.4: `CONFIG_WIREGUARD`, `CONFIG_VXLAN`, `CONFIG_VLAN_8021Q`, `CONFIG_GENEVE` (for E), `CONFIG_NET_SCH_NETEM`, `CONFIG_IP_ADVANCED_ROUTER` + `CONFIG_IP_MULTIPLE_TABLES` (for `ip rule`), `CONFIG_NF_CONNTRACK_NETLINK` + `CONFIG_NF_CT_NETLINK` (the `conntrack` utility), `CONFIG_NETFILTER_XT_MATCH_STATISTIC`, `CONFIG_NETFILTER_XT_MARK`, `CONFIG_NETFILTER_XT_MATCH_ADDRTYPE`, `CONFIG_NFT_NUMGEN` (kube-proxy rules, see finding 10). Add `wireguard-tools`, `tcpdump`, `conntrack-tools`, `iproute2-tc` to `lab-net`.
>
> **Acceptance budgets (the phase 0 spike).**
>
> | What | Threshold |
> |---|---|
> | 3 `lab-alpine` nodes at 96 MB each, tab memory | ≤ 1.2 GB |
> | Time to three prompts from snapshots (repeat visit) | ≤ 8 s |
> | `ping` between nodes via `vswitch`, RTT with zero configured delay | ≤ 5 ms |
> | `iperf3` between nodes (for the explanation of the TCP window) | ≥ 20 Mbit/s |
> | Phone / `deviceMemory < 4` | 1 node, the rest are netlab hosts |
>
> **Which lessons run on tier B.** B: N3 and N4 optionally ("the same on real Linux"). I and E — mandatory: N9 NAT, N10 netfilter, N14 WireGuard, the new N16 "The network inside one machine" (finding 4), scenarios T2, T8, T9, T10, all tasks of ladder steps 4–5 (finding 2) and the "hard mode" of exam part A.
>
> **The bridge to Kubernetes (R11).** The same `vswitch` connects the nodes of the 05 hybrid cluster: the control plane in kube-lite, the kubelet agent and `crun` in v86. The inter-node pod network is real VXLAN (`ip link add vxlan0 type vxlan id 42 dstport 4789 dev eth0`) on top of our switch. The learner first builds it by hand in the VXLAN card (finding 3) and then recognizes it in the CNI.

Fix the product table in §2 like this: the v86 row, the "What we take" column — "tier B of the block, multi-node labs via `vswitch`"; the "Why it is not the basis" column — "non-deterministic timings; so theory and scenarios with simulated time stay in netlab".

---

## 2. BLOCKING — there is no documentation ladder (R2)

**Where:** throughout the document. There is only the "honest message" `netlab: flag -X is not simulated` with a link to man (§7.3.3) and one external link to Mess With DNS.

**What is wrong.**
- There are no five steps, no linking of them to modules and levels, and no tasks for each step.
- There is no "where did you look?" rule for the AI.
- The simulator's current behavior gets in the way of step 4. If the learner found in the real man a flag that netlab does not have, they get "not simulated" and hit a wall.
- There is no offline man inside the trainer. Without it, steps 2 and 5 are impossible in an "official documentation only" exam.

**Fix. Insert section 7.8.**

> ### 7.8. Documentation ladder
>
> **Linking to the route.**
>
> | Step | Beginner | Intermediate | Experienced |
> |---|---|---|---|
> | 1. Flicker | N0–N6 | — | — |
> | 2. Hint = page fragment | N7–N12 | N2–N8 (condensed modules) | — |
> | 3. "Find the flag" | N13–N16 | N9–N13 | from N2 (the starting step, R2) |
> | 4. Enforcement | T scenarios after N15 | N14–N16, T scenarios | from N9 and in all T |
> | 5. Exam | part A, 2 tasks | part A + B | part A + B, 30% of tasks on material not covered |
>
> **Sources the trainer keeps offline** (full-text search, anchors on sections):
> - man pages: `ip(8)`, `ip-address(8)`, `ip-route(8)`, `ip-neighbour(8)`, `ip-rule(8)`, `ip-link(8)`, `ss(8)`, `ping(8)`, `tracepath(8)`, `traceroute(8)`, `tcpdump(1)`, `pcap-filter(7)`, `dig(1)`, `curl(1)`, `iptables(8)`, `iptables-extensions(8)`, `nft(8)`, `conntrack(8)`, `wg(8)`, `wg-quick(8)`, `tc-netem(8)`, `resolv.conf(5)`, `hosts(5)`, `nsswitch.conf(5)`;
> - nginx directives: `ngx_http_proxy_module`, `ngx_http_upstream_module`, `ngx_http_core_module`, EN and RU;
> - the RFCs from §12.
>
> The texts are taken from Debian 12 packages of the same version as the "golden records". The man page licenses differ (iproute2 — GPL-2.0, curl — the curl license, tcpdump — BSD, dig from BIND — MPL-2.0). We distribute them as separate documentation files with notices, not as part of the code, i.e. as an aggregation. They do not affect the trainer's code under Apache 2.0. Mark it `hold` until a lawyer confirms.
>
> **Step 1 — flicker.** Under an output line and in a command's card, an unobtrusive chip appears: "⟶ from here: `man 8 ip-route`, section *ip route show*". A click opens the right anchor in a side panel, and the lesson does not lose its state. If you do not click, nothing happens, and it does not count toward the grade. Every command introduced in N0–N6 gets such a chip. Example: in N4 after `ip route get 10.0.2.10` — a chip for `ip-route(8)`, "ip route get — get a single route".
>
> **Step 2 — fragment hint.** Step H2 of the hint ladder from 01 §14.2 in this block shows not the author's text but a fragment of the real page, with the relevant line highlighted in `--c-warn`. Above the fragment is a mini-map of the page anatomy: NAME / SYNOPSIS / DESCRIPTION / OPTIONS / EXAMPLES / SEE ALSO, with the current section highlighted. Before the first such hint (N7) there is one screen "How a man page is structured" with four clickable zones. Two more screens are about the structure of other sources:
> - *nginx*: every directive has the lines `Syntax / Default / Context`. We teach reading `Default: proxy_read_timeout 60s;` — this line will be needed in T1.
> - *RFC*: the Abstract, section numbering, the MUST/SHOULD words per RFC 2119.
>
> | Module | Lesson task | Fragment in the hint |
> |---|---|---|
> | N7 | obtain an address again | `dhclient(8)`: `-r` Release the current lease |
> | N8 | only the answer, without sections | `dig(1)`: `+short` |
> | N9 | the list of translations | `conntrack(8)`: `-L, --dump` |
> | N10 | rule line numbers | `iptables(8)`: `--line-numbers` |
> | N11 | headers only | `curl(1)`: `-I, --head` |
> | N12 | the name for SNI | `openssl-s_client(1ssl)`: `-servername` |
>
> **Step 3 — "find the flag".** The learner is given only a link to the page, without highlighting. The effect is checked, not the text of the command (09, §2):
>
> | id | Task | Expected flag | Check |
> |---|---|---|---|
> | doc3-dig-answer | Show only the ANSWER section, but with TTL | `dig +noall +answer` | output: zone lines, not a single `;;` line |
> | doc3-curl-code | Print only the response code | `-o /dev/null -s -w '%{http_code}'` | output `^\d{3}\n?$` |
> | doc3-ss-tw | How many sockets are in TIME-WAIT | `ss -tan state time-wait` | the number matches the fact `net.sockets[state=TIME_WAIT]#` |
> | doc3-ping-df | A ping without permission to fragment | `ping -M do` | trace: DF=1 in the capture |
> | doc3-tr-tcp | traceroute over TCP to 443 | `traceroute -T -p 443` | trace: SYNs with a growing TTL to port 443 |
> | doc3-tcpdump-ascii | Show the packet contents as text | `tcpdump -A` | the output contains `GET /` |
> | doc3-nginx-default | What is the default value of `proxy_connect_timeout`? | — (reading the documentation) | the number 60 |
> | doc3-route-from | Which route is chosen for a packet **from** 10.0.3.5 | `ip route get A from B` | the output contains `from 10.0.3.5` |
>
> **Step 4 — enforcement.** The task needs flags and subcommands that are not in the theory. No hints. The AI tutor and the built-in help answer "how?" according to a script:
>
> > "Where have you already looked? (1) `<command> --help` or `ip <object> help`; (2) `man <command>`, section OPTIONS or EXAMPLES; (3) SEE ALSO at the bottom of the page; (4) for nginx, the directive index on nginx.org. Tell me what you found, and I will help you read it".
>
> If the learner names a page, the AI may go through a paragraph with them, but does not name the flag. The system prompt receives `doc_ladder: 4` and the list of the task's flags that must not be mentioned.
>
> | id | Task | What was not studied | Where the learner will find it | Check |
> |---|---|---|---|---|
> | doc4-ct-events | Watch in real time which connections NAT creates | `conntrack -E` | `conntrack(8)` | trace: the command in the history + `[NEW]` output |
> | doc4-nft-handle | Delete only the third rule of the chain without touching the others | `nft -a list`, `delete rule ... handle N` | `nft(8)`, RULES | fact: the chain has n−1 rules, the others are the same |
> | doc4-nft-trace | Find out which rule drops the packet | `meta nftrace set 1`, `nft monitor trace` | the nftables wiki, "Ruleset debug/tracing" | the learner enters the rule's handle |
> | doc4-dig-tcp | Make a DNS query over TCP (UDP is broken on the server) | `dig +tcp` | `dig(1)` | trace: TCP/53 in the capture |
> | doc4-ss-info | Find out the connection's RTT and cwnd | `ss -ti` | `ss(8)` | the learner enters the rtt ±10% |
> | doc4-ip-rule | Traffic from 10.0.3.0/24 goes via the second provider | `ip rule add from … table 100` + a route in table 100 | `ip-rule(8)` | probe: a traceroute from 10.0.3.5 goes via `isp2` |
> | doc4-netem | Add 200 ms of delay to the interface and show it in ping | `tc qdisc add dev eth0 root netem delay 200ms` | `tc-netem(8)` | the qdisc fact + ping ≥ 200 ms (tier B only) |
> | doc4-curl-connect-to | Test a new backend by the site's name without changing DNS | `curl --connect-to` or `--resolve` | `curl(1)` | probe: the request reached the new IP with the correct Host and SNI |
>
> A rule for the simulator. netlab must support the flags of step 4 tasks. If the learner tries a flag that is neither in netlab nor in the task, the message does not say "supported: …" (that would be a hint), but writes: `netlab: this option is not simulated here; open this lesson on a real machine (tier B) to try it`. The tasks `doc4-netem` and `doc4-ip-rule` are marked `envs: [v86, vm]`.
>
> **Step 5 — the exam.** The AI is off. Of the help, only the offline pages above are open, as in the CKA. In part A, 2 tasks (B) or 3 tasks (I, E) are built on material not covered: `ip rule` (policy routing), an nft set with a timeout for limiting SSH (`set … { flags timeout; }`), `ss -K` to kill a hung connection. In part B (E) — DNSSEC validation with `dig +dnssec` against a broken signature in the training zone. The log of opened pages is recorded (`trace`) and shown in the debrief ("you found `ip rule` in 4 minutes"), but does not count toward the score.
>
> **Placement.** Add task 11 to the "Experienced" check (§4.2): "Show only the ANSWER section with TTL", with only a link to `dig(1)` given. It confirms the start at step 3.

---

## 3. BLOCKING — there is no map of the internet and no protocol catalog; §1 contradicts R8

**Where:** §1 ("does not do: OSPF/BGP, VLAN trunks"), §3, §5, §8.1 (the list of dissectors).

**What is wrong.**
- R8 requires going from the overall picture to the packet. The first step is a zoomable map: laptop → home router → provider → backbone → IXP → submarine cables → data center, plus AS, BGP, root DNS and CDN. The document does not have this. N0 "the network as a postal service" is a metaphor, not a map.
- There is no protocol catalog with a uniform card.
- §1 excludes BGP and VLAN, while R8 puts VLAN at the intermediate level, and BGP and the idea of OSPF at the experienced level. They do not need to be configured, but they need to be understood.
- The dissectors (§8.1, Decision 3) are not enough for the catalog cards.

**Fix 3.1. Replace the paragraph "what the block does not do" in §1:**

> What the block does not do: configuring Cisco/Juniper equipment, STP, wireless networks, MPLS. BGP, OSPF and VLAN are present, but as understanding. BGP and autonomous systems — on the map of the internet (N-1) and in a catalog card for the experienced level: what an AS announces, why a route leak brings down half the internet. VLAN — a card for the intermediate: an 802.1Q tag on our `vswitch`, access and trunk. OSPF — one "idea" screen for the experienced. The learner does not write BGP session configuration.

**Fix 3.2. A new module N-1 "How the internet works" before N0** (B, I in full; E — 15 minutes). It introduces: the internet as a network of networks, the provider, the autonomous system (AS), the internet exchange point (IXP), the backbone, the submarine cable, the data center, the CDN, the root DNS servers, anycast — only the idea, BGP — only the idea "ASes tell their neighbors which addresses live with them". It relies on F05.

A storyboard in the R4 style. A blueprint, not ink. One screen, one thought. The scale changes with the wheel or a pinch, but the steps are discrete; this is not an infinite zoom.

> **Screen 1. Your laptop and router** (the "apartment" scale). Two blocks, a Wi-Fi line captioned *Wi-Fi, 192.168.1.0/24*. Clicking the router opens a card: "it has two addresses: the internal 192.168.1.1 and the external 203.0.113.7; why — in N9". There is no slider; there is one handle — "zoom in/out".
>
> **Screen 2. Provider** (the "city" scale). From the router, a line *fiber / copper, 1 Gbit/s* to the provider's node. The provider has several customers. The caption on the node: *AS 64500 — the provider's network number*. Click: "an autonomous system is a network under one administration; your provider has its own number".
>
> **Screen 3. Backbone and IXP** (the "country" scale). Three providers (AS 64500, 64501, 64502) and an exchange point (IXP) they are connected to. Captions on the lines: *peering via the IXP*, *transit (paid)*. A switch "peering via the IXP present/absent" changes the packet's path to the neighboring provider: without the IXP it goes through a transit operator in another country, and the latency counter next to it grows from 2 to 38 ms. The explanation alongside: "IXPs exist so that neighboring networks do not carry traffic to each other across the ocean".
>
> **Screen 4. Submarine cables** (the "world" scale). A simplified map: 5–6 real cables with names and years (taken from the open data of the TeleGeography Submarine Cable Map, a source with `check:`). A "distance" slider shows the latency of light in optical fiber, about 5 µs per km: Moscow — Frankfurt ≈ 2000 km ≈ 10 ms one way, not counting the equipment. "Break it": cut a cable — the path is rebuilt through another one, and the latency grows. Caption: "the neighboring ASes rebuilt the routes via BGP — details in the BGP card".
>
> **Screen 5. Data center** (the "building" scale). Racks, a top-level switch, a load balancer. Caption: "the site lives here; later in the course we will build exactly this part".
>
> **Screen 6. Root DNS and anycast.** 13 names `a`–`m.root-servers.net`, but hundreds of points on the map. A "show instances" switch explains anycast: "one address announced from many places; BGP brings you to the nearest one". The explanation is only at the level of the idea; DNS in detail — in N8.
>
> **Screen 7. CDN.** The same site, with copies at the edge of the network in three cities. A "where the user is" slider moves the point, and the nearest CDN node is highlighted. The latency counter: 3 ms versus 80 ms to the origin.
>
> **Screen 8. Assembly.** The whole path from the laptop to the data center as one line, each segment captioned with the segment and who manages it. The last line: "next we go down inside: what exactly travels along this line" → N0/N1.
>
> **Checks.** `order`: arrange the segments of the path; `hotspot`: "where does your packet first enter someone else's AS"; `predict`: "the IXP was turned off — will the latency go up or down?".
>
> **For the experienced:** `whois -h whois.radb.net AS13335` and `traceroute` to three sites with the AS captioned on each hop — this is an external exercise on one's own machine. Plus the bgp.tools page for one's own provider.

**Fix 3.3. The protocol catalog** (a new §7.9). The catalog does not replace the modules; it indexes them. The card of a basic protocol is assembled from the module's materials; the other cards are separate short lessons.

> ### 7.9. The protocol catalog
>
> The principle of the catalog and of the whole block: **every network problem is tied to a layer**. Each card starts with a layer badge in the color `--c-l2…--c-l7` and ends with a "how it breaks" section with the question "which layer broke?".
>
> **Card format (YAML, `content/net/protocols/<id>.yaml`):**
> ```yaml
> id: proto-dns
> level: beginner                 # beginner | intermediate | experienced
> layer: L7                       # L2 | L3 | L4 | TLS | L7; for tunnels — layer: L3 over L4
> transport: [udp/53, tcp/53]
> introduced_in: N8               # the module after which the card is opened
> why: { ru: "Превращает имя в адрес; без него пользователь знал бы только числа.", en: "..." }
> sequence:                       # the exchange diagram: rendered by the 08/3.1 stepper + the packet scope "flow diagram"
>   actors: [client, resolver, root, tld, auth]
>   steps:
>     - { from: client, to: resolver, msg: "A? shop.example RD=1", layer: L7 }
>     - { from: resolver, to: root, msg: "A? shop.example", note: { ru: "корень не знает ответа", en: "the root does not know the answer" } }
>     - { from: root, to: resolver, msg: "NS example. + glue" }
>     # ...
> params:                         # the explanation's handles (R4)
>   - { id: ttl, kind: slider, min: 0, max: 86400, default: 300, effect: "a second query after t: cache/full path" }
> observe:                        # how to see it yourself
>   - { cmd: "dig +trace shop.example", env: [sim, v86] }
>   - { cmd: "tcpdump -n port 53", env: [sim, v86] }
>   - { capture: C04 }
> breaks:                         # how it breaks: symptom → layer → command
>   - { symptom: "Could not resolve host", layer: L7, check: "dig @<resolver> name", lab: t6 }
>   - { symptom: "dig hangs, ;; connection timed out", layer: L4, check: "nc -vzu <resolver> 53; a UDP/53 filter" }
> docs: [rfc1034, rfc1035, man-dig]
> ```
>
> **Catalog contents.**
>
> | Protocol | Level (course) | Layer | How the exchange goes | How to observe | How it breaks (symptom → layer) |
> |---|---|---|---|---|---|
> | DHCP | B | L7 over UDP 67/68, broadcast | DORA | `dhclient -v`, C05 | two servers → someone else's gateway (L7/L3) |
> | ARP | B | L2 | who-has / is-at | `ip neigh`, `tcpdump arp` | no reply → `Destination Host Unreachable` (L2) |
> | ICMP | B | L3 | echo, time exceeded, unreachable, frag needed | `ping`, `traceroute`, C02 | an ICMP filter → PMTU blackhole (L3) |
> | TCP | B | L4 | SYN/SYN-ACK/ACK, FIN, RST | `ss -tan`, C06–C08 | RST → refused; DROP → timeout (L4) |
> | UDP | B | L4 | a connectionless datagram | `ss -uan`, `nc -u` | silence instead of an error; ICMP port unreachable |
> | DNS | B | L7 | recursion + iterations | `dig +trace` | NXDOMAIN, SERVFAIL, a stale TTL |
> | HTTP/1.1 | B | L7 | request/response | `curl -v` | 4xx/5xx; 502/504 at a proxy |
> | HTTPS/TLS 1.3 | B | TLS | ClientHello…Finished | `openssl s_client`, C09 | expiry, name, chain |
> | SSH | B | L7 over TCP 22 | version → key exchange → host check → authentication | `ssh -v`, a capture (only the key exchange is visible) | `Host key verification failed`, `Permission denied (publickey)`; relies on L15 of the Linux block |
> | NTP | I | L7 / UDP 123 | request/response with 4 timestamps | `chronyc tracking`, `timedatectl` | clock skew → TLS `certificate is not yet valid` (TLS) |
> | SMTP | I | L7 / TCP 25, 587 | EHLO, MAIL FROM, RCPT TO, DATA | `nc mail.lab 25` by hand | 25 is closed in clouds; the wrong MX |
> | FTP / SFTP | I | FTP: L7, two connections; SFTP is an SSH subsystem | active and passive mode | an FTP capture, `sftp -v` | FTP behind NAT without a helper breaks — a bridge to conntrack helpers |
> | HTTP/2 | I | L7 over TLS (ALPN h2) | frames, streams, multiplexing | `curl --http2 -v`, a capture with keys | head-of-line on TCP; a proxy without h2 |
> | HTTP/3 / QUIC | I | L7 over QUIC over UDP 443 | 1-RTT, 0-RTT | `curl --http3` (if built with it), quic.xargs.org | UDP/443 blocked → fallback to h2 (L4) |
> | WebSocket | I | L7 | `Upgrade: websocket`, 101 | `curl -i -H 'Upgrade: websocket' …`, a capture | a proxy without `proxy_http_version 1.1` + Upgrade → 400/closing |
> | gRPC | I | L7 over HTTP/2 | unary/stream | `grpcurl` (external), a capture | an L4 load balancer holds one connection → skewed load |
> | VLAN 802.1Q | I | L2 | a 4-byte tag | `ip link add link eth0 name eth0.10 type vlan id 10`, `tcpdump -e` | VLAN mismatch → ARP without a reply (L2) |
> | NAT/PAT | I | L3/L4 | translation, conntrack | `conntrack -L` | SNAT port exhaustion; no reverse translation |
> | BGP | E | L7 over TCP 179, controls L3 | OPEN, UPDATE, KEEPALIVE | only a capture and the N-1 map; bgp.tools | a route leak, a hijack — packets go to the wrong place (L3) |
> | VXLAN / Geneve | E | L2 over UDP 4789 / 6081 | frame encapsulation | `ip link add vxlan0 type vxlan …` on two v86 nodes | MTU −50 bytes; UDP 4789 closed between the nodes → pods on different nodes do not see each other |
> | IPsec | E | L3 (ESP, IKE over UDP 500/4500) | IKE SA → Child SA | a capture (ESP is opaque) | NAT-T, mismatched proposals |
> | WireGuard | E (I — in N14) | L3 over UDP | handshake init/response, data type 4 | `wg show` | AllowedIPs, MTU, no masquerade |
> | mTLS | E | TLS | a client certificate | `openssl s_client -cert -key` | `certificate required`; a bridge to the service mesh |
> | OSPF (idea) | E | L3 (IP proto 89) | hello, LSA, SPF | only a diagram | — |
>
> A ready VXLAN card for the experienced (it is also the bridge to R9):
>
> **Why.** Two machines in different subnets must look like one L2 segment. This is how a CNI in Kubernetes (Flannel, Cilium in tunnel mode) connects pods on different nodes.
> **Layer.** An Ethernet frame (L2) travels inside UDP (L4) inside IP (L3) — "L2 over L4".
> **Exchange.** There is no exchange; VXLAN is pure encapsulation. A diagram of envelopes: the inner frame (the pod's MAC, the pod's IP) → an 8-byte VXLAN header (flags, a 24-bit VNI) → UDP dst 4789 → the node's outer IP → the outer Ethernet. The overhead is 50 bytes on IPv4. Hence a pod MTU of 1450 with a node MTU of 1500.
> **By hand (tier B, two nodes):**
> ```bash
> # node1 (192.168.50.11)
> ip link add vxlan0 type vxlan id 42 dstport 4789 remote 192.168.50.12 dev eth0
> ip addr add 10.244.0.1/24 dev vxlan0 && ip link set vxlan0 up
> # node2 — the mirror image, remote 192.168.50.11, address 10.244.0.2/24
> ping 10.244.0.2
> tcpdump -ni eth0 udp port 4789     # the outer envelope
> tcpdump -ni vxlan0 icmp            # the inner one
> ```
> **How it breaks.** (1) The "drop udp 4789" breakage is turned on in `vswitch` → ping is silent, both nodes are alive. The layer is L4 of the outer envelope. (2) `ping -M do -s 1472 10.244.0.2` does not get through, `-s 1422` does. The layer is L3, MTU. (3) A different VNI → frames arrive and are silently dropped. The layer is the overlay's L2.
> **Check.** `when: "net.links[name=vxlan0].vni=42 && probes.icmp['10.244.0.2'].received>=2"`.

**Fix 3.4.** In Decision 3 and in §8.1 `Layer.proto`, add `vlan`, `vxlan`, `geneve`, `ntp`, `smtp`, `http2` (frames, when keys are available), `quic` (only Initial and the long header, the rest is `encrypted`), `websocket`, `bgp` (OPEN/UPDATE/KEEPALIVE), `esp` (opaque). Recalculate the dissector budget (an estimated +30–40 KB gzip). Add to the capture library in §7.5: C14 VLAN trunk, C15 VXLAN, C16 HTTP/2 with keys, C17 QUIC handshake, C18 WebSocket upgrade, C19 BGP OPEN/UPDATE (recorded from a bird ↔ bird lab setup on the course test VMs), C20 NTP.

**Fix 3.5.** In §3, add N-1 at the beginning and mention the catalog; in §4.1, update the hours (finding 17).

---

## 4. BLOCKING — the concept order diverges from the 01 graph, the introductory part ignores L14, veth, bridge and netns are not introduced

**Where:** §3, the module table; §13, dependencies.

**What is wrong.**

(a) **Identifiers.** 01 §6.2 defines the concepts `N01`–`N21`. In 03 the modules are called `N0`–`N15`. These names get confused with concept ids: the module "N4 Routing" and the concept `N04 Port`, the module "N8 DNS" and the concept `N08 DNS`. The linter and the authors will confuse them. The modules must be renamed to `net-00`…`net-16` (or `NM0`…), and a column "01 concepts" added to the §3 table.

(b) **Order contradictions with 01:**

| Pair | 01 | 03 | What to do |
|---|---|---|---|
| DHCP ↔ DNS | `N10 DHCP` requires `N08 DNS` | N7 DHCP before N8 DNS, and N7 already says "the DNS server in the options", "option 6 (DNS)" | Swap N7 and N8 (DNS does not depend on DHCP). Or keep the order, but then base "the DNS server" on L14 of the Linux block, and remove the `N10 → N08` dependency in 01. I am for the swap: then option 6 in DORA is explained by an already introduced concept |
| ping ↔ OSI | `N12 ping/traceroute/ICMP` requires `N07 OSI` | ping and ICMP in N4, OSI in N6 | 03 is right: OSI after practice. 01 must be fixed: `N12` requires `N03`, and `N07` requires `N12` |
| SSH | `N18 SSH and keys` in the "Networks" group | SSH is absent from the 03 program (only `sshd` in the model) | SSH as a skill already exists in L15 of the Linux block (02). In 01, move `N18` to group L. In 03, make an SSH protocol card in the catalog (finding 3) with `requires: L15` |
| veth/bridge, netns | `N20 veth and bridge`, `N21 network namespace` in "Networks"; `D03` requires `N21` | 03 has no module, only "Decision 2" and §13 | A new module N16 (below) |

(c) **L14 of the Linux block (02 §5.1)** already introduces: the network interface, IP address, mask, default route, port, socket, listening service, DNS query, `/etc/hosts`, `/etc/resolv.conf`, HTTP request and response. Yet in 03 N0 "relies on nothing", N2 introduces IP "from scratch", N5 introduces the port. For the beginner this is repetition without acknowledgement. For the linter it is a repeated `introduces` of one id, i.e. a build error.

Solution: in 03 these concepts are marked `deepens:` (a new kind of link in `concepts.yaml`, also needed by 08 §7.3). The first screens of N2 and N5 begin with the words "In Linux you saw `inet 10.0.2.15/24` in `ip a`. Now let's work out what this /24 means". N0 is reduced to two screens, or its meaning is taken over by N-1 (finding 3).

(d) **A new module N16 "The network inside one machine"** (I, E in full; B — basic). It comes after N10 (NAT and netfilter are needed) and before the exam. It is the bridge to the containers block (R7b, the "network" boundary) and to K8s networking (R9). The namespace as a kernel mechanism is introduced by Linux (R6: `unshare`, `/proc/<pid>/ns`, `lsns`). Here we populate it.

> ### N16. The network inside one machine: netns, veth, bridge (B basic; I, E in full; tier B)
> Introduces: the network namespace as "a separate network stack" (`requires: L-ns` from the Linux block), `ip netns`, the veth pair, the bridge as a switch inside the kernel, routing between namespaces, NAT outward from a namespace, port forwarding inward. 01 concepts: `N20`, `N21`.
> Lesson flow (each step is a `split` "terminal + diagram" screen; the diagram is built from `ip -j link` events from the v86 agent):
> 1. `ip netns add red`, `ip netns exec red ip a` — inside there is only `lo`, and it is DOWN. Diagram: a `net` frame in the `--c-ns-net` color around an empty stack.
> 2. `ip link add veth-r type veth peer name veth-r-br; ip link set veth-r netns red` — a cable appears on the diagram, one end inside the frame. Clicking the cable: "veth is two interfaces; a frame that enters one comes out of the other".
> 3. The same for `blue`. Then `ip link add br0 type bridge`, both outer ends into the bridge, the addresses `10.10.0.2/24` and `10.10.0.3/24` → `ip netns exec red ping 10.10.0.3`. A probe on `br0` shows ARP — this is the switch from N1, only inside the kernel. The command `bridge fdb show br br0` prints the MAC table.
> 4. The address `10.10.0.1/24` on `br0`, a default route in the namespaces via it, `ip_forward=1`, `iptables -t nat -A POSTROUTING -s 10.10.0.0/24 ! -o br0 -j MASQUERADE` → `ip netns exec red ping <an external node>`.
> 5. `iptables -t nat -A PREROUTING -p tcp --dport 8080 -j DNAT --to-destination 10.10.0.2:80` + `nc -l -p 80` in `red` → from a neighboring v86 node, `curl http://<node>:8080`.
> 6. The final screen, "recognize it?". Next to your diagram, the Docker diagram: `br0` ↔ `docker0`, `10.10.0.0/24` ↔ `172.17.0.0/16`, your DNAT rule ↔ the `DOCKER` chain. One sentence: "in the containers block you will see that `docker run -p 8080:80` does exactly steps 1–5". The term "container" appears here as `forward:` (01 §6.1).
> Checks (09 format):
> ```yaml
> goals:
>   - id: g-ns-ping
>     needs: [net]
>     when: "probes.icmp[from=ns:red][to='10.10.0.3'].received>=2"
>     envs: [v86]
>   - id: g-dnat
>     needs: [net]
>     when: "net.iptables.nat~'DNAT' && http['node2->node1:8080'].status>0"
>     envs: [v86]
>     fail:
>       - if: "!net.sysctl['net.ipv4.ip_forward']=1"
>         say: { ru: "Ядро не пересылает пакеты между br0 и eth0: проверьте ip_forward", en: "..." }
>         term: ip-forward
> ```

In §13, the text about Docker then changes: "The Docker block does not reintroduce NAT, DNAT, the bridge, veth and netns — it refers to N9, N10, N16".

---

## 5. BLOCKING — there are not enough process explanations, and two references lead nowhere (R3, R4)

**Where:** N5 ("the 'handshake under a magnifying glass' interactive (section 7.3, the TCP scene)"); N10 ("an interactive diagram with five hooks, see 7.3, the 'netfilter' scene"). There are no such scenes in §7.3: it describes the sandbox.

**What is wrong.** R3 requires at least the following for networks: entering a URL (present, §7.1), DNS resolution (only tasks and `dig +trace`), the TCP + TLS handshake (only a mention), a packet through NAT and a router (present in §7.2, screens 3–4, but without handles), where a 504 comes from (scenario T1 exists, an explanation does not). Explanations of DHCP and netfilter are also needed: the document itself refers to them. R4 requires every explanation to have parameter handles, immediate recalculation with an explanation, "break it" and step-by-step rewinding.

**Fix: a new §7.10 "Process explanations".** All the explanations below are built on the 08 primitives: `stepper` (3.1), `diagram` (3.2), `packets` (3.6), `breakit` (3.5). Common rules for each:
- a step bar at the bottom with ←/→ rewinding, pause and speed 0.25×/1×/4×;
- every arrow is captioned on the line;
- clicking any element opens a card "what it is / who creates it / how to look at it with a command";
- changing a handle recalculates the process immediately (the events are folded again), and a line "what changed and why" appears on the right, with the changed steps highlighted;
- the source of the steps is a netlab scenario (deterministic), with an option "replay on a real v86" where it makes sense.

> #### E-DNS. How a name turns into an address (N8)
> **Screen 1 — the participants.** From left to right: application → the OS stub resolver (`/etc/resolv.conf`) → recursive resolver → the root `.` → the TLD `example.` → the authoritative `shop.example`. Each block has a role caption and an address.
> **Screen 2 — the query.** Step by step, 8 arrows go out. Each carries a real line: `A? shop.example RD=1`; the root's answer `NS a.nic.example. (glue 192.0.2.53)` captioned "not an answer but a direction"; the authoritative answer `A 198.51.100.20 TTL 300 AA`.
> **Handles.** A "time of the second query" slider 0…600 s. At t < TTL the path is 2 arrows, and the resolver gets a label "from cache, 300−t s left"; at t ≥ TTL, 8 arrows again. A TTL slider 30…86400. A switch "OS stub resolver cache (systemd-resolved)" on or off. A switch "the record is in `/etc/hosts`": the path breaks off at the second block, captioned "`dig` will not see this, `getent hosts` will".
> **Break it.** "The authoritative server does not answer" — a timer spins at the resolver, then `SERVFAIL`. "A typo in the TLD" — the root answers `NXDOMAIN`, and negative caching (SOA minimum) is shown alongside. "UDP/53 closed" — `;; connection timed out; no servers could be reached`.
> **Recalculation with an explanation (example).** TTL 300 → 86400: "after the address changes, users of this resolver will keep going to the old address for up to 24 hours — this is scenario T5".
> **Check.** `predict`: "after 400 s with TTL 300 — how many arrows?" (8).
>
> #### E-TCPTLS. The TCP handshake and TLS 1.3 (N5, then N12)
> **Screen 1 — a sequence diagram.** Two vertical lines (client, server), time from top to bottom, the distance between exchanges proportional to the RTT. Arrows SYN (`seq=x`), SYN-ACK (`seq=y ack=x+1`), ACK. Field captions on the arrows. Clicking an arrow opens the packet in the inspector.
> **Screen 2 — after N12, TLS 1.3 is added:** ClientHello (SNI, ALPN, key_share) → ServerHello + {EncryptedExtensions, Certificate, CertificateVerify, Finished} → {Finished} + the first HTTP request. The encrypted parts are drawn hatched, captioned "visible only to the endpoints".
> **Handles.** RTT 1…300 ms. On the right, a counter: "the first byte of the response after 3×RTT = …". Loss 0…30%: a lost SYN is crossed out, the retry arrives after 1 s, then 2 s (RTO from the model). A "TLS 1.2 / 1.3" switch adds or removes a round trip. A "session resumption / 0-RTT" switch (E): the request goes out in the very first flight, marked "request replayability is a replay risk". A "port closed" switch: SYN → RST, the result "refused in 1×RTT". A "firewall DROP" switch: SYN, SYN, SYN… at intervals of 1, 2, 4, 8 s, the result "timed out after ~127 s" (simulated time with acceleration).
> **Recalculation with an explanation.** RTT 20 → 150 ms: "a site from another part of the world: the same page opens 390 ms slower just because of the handshake round trips. Hence CDNs and keep-alive (E-504, screen 4)".
>
> #### E-WIN. The TCP window and speed (N5, I/E)
> One screen. A sender, a receiver, a "pipe" of length RTT, with segments in flight inside. Sliders: window 4…1024 KB, RTT 1…200 ms, bandwidth 10…1000 Mbit/s. A throughput counter = min(bandwidth, window/RTT). With a 64 KB window and an RTT of 100 ms you can see that the result is ~5 Mbit/s, with the explanation: "the link is idle while we wait for acknowledgements — this is the bandwidth-delay product". A "window scaling off" switch pins the window at 64 KB. The observation command: `ss -ti` (rtt, cwnd). This is a ladder step 4 task.
>
> #### E-NAT. A packet through a router and NAT (N4, N9; an extension of §7.2, screens 3–4)
> Add handles to the existing screens:
> - "How many devices at home" 1…50. The conntrack table on the diagram grows, each row with an external port.
> - "External IPs" 1 or 4.
> - "UDP conntrack timeout" 30…180 s. If a DNS reply arrives after the timeout, it is dropped, with the explanation: "the entry has already been forgotten".
> - "Break it: exhaust the ports". A connection slider up to 65,000 per external IP and per destination address: new connections are refused. Explanation: "this is what SNAT port exhaustion looks like in a cloud NAT gateway".
> - A "no NAT" switch (the router from N4): only the MAC and TTL change, the addresses stay, and the reply from the internet to `192.168.1.23` finds no way back — a red ⨯ with a caption.
>
> #### E-NF. A packet's path through netfilter (N10)
> **Screen — five hooks.** Blocks PREROUTING → routing decision → INPUT → local process → OUTPUT → POSTROUTING, plus the FORWARD branch. In each hook, a stack of tables (raw, mangle, nat, filter) as colored bars.
> **Handles.** A switch "a packet to us / through us / from us" redraws the path. An editor of three rules: the learner reorders them by dragging, and the packet's path is recalculated — you can see which rule matched first, and the `pkts` counter grows exactly on it. A switch "delete the rule `ct state established,related accept`": the reply to an outgoing connection is dropped in INPUT (this is the T scenario "the established rule was forgotten").
> **Break it.** A FORWARD DROP policy without an allow: the 8080 forwarding from N9 stops working, the FORWARD hook is highlighted.
> **Bridge to K8s (E).** A user chain with `-j` jumps and `-m statistic --mode random --probability 0.5` (finding 10): the packet goes now into one branch, now into the other. Caption: "this is how kube-proxy distributes requests across pods — you will see it in K4".
>
> #### E-DHCP. How a laptop gets an address (N7)
> A laptop without an address (`0.0.0.0`), a Wi-Fi router, a broadcast zone. The DORA steps with fields on the arrows (`src 0.0.0.0:68 → 255.255.255.255:67`, `yiaddr`, options 1, 3, 6, 51). A "lease time" handle 60 s…24 h: on the timeline, renew at 50% (T1) and rebind at 87.5% (T2) appear. Break it: "a second DHCP server" — two Offers, and the client takes the first; "the server is off" — the Discover repeats, then the address `169.254.x.x` captioned "link-local: no server was found".
>
> #### E-504. Where a 504 comes from (N13, N15)
> **Screen 1 — the chain.** Client → load balancer (L7, idle timeout) → nginx (`proxy_connect_timeout`, `proxy_read_timeout`) → application (its own timeout to the database) → database. Under each block, its timer as a scale.
> **Handles.** "Database response time" 0…120 s. "`proxy_read_timeout`" 5…300 s, 60 s by default. "Application timeout to the database" 5…60 s. "Load balancer idle timeout" 30…600 s. A switch "`proxy_next_upstream` to the second backend".
> **Recalculation.** The process is replayed, and the shortest timer on the path fires first. On that block a label lights up, "I created the response" — this is the main point of the explanation: the response code tells you **who** wrote it.
> - Database 75 s, `proxy_read_timeout` 60 s → "the 504 was generated by nginx; `error.log` has `upstream timed out … while reading response header`".
> - Application timeout 30 s → "the application itself returned 500 after 30 s; nginx honestly passed the 500 on".
> - Load balancer idle timeout 45 s → "a 504 from the load balancer; the nginx logs do not have the request".
> **Break it.** "The application is not running" → an instant RST → 502 `connect() failed (111…)`. "A firewall between nginx and the application with DROP" → a 504 after `proxy_connect_timeout` with the text `while connecting to upstream` (scenario T2). "The application returns garbage" → 502 `upstream sent invalid header`.
> **Lenses 08/3.11** (Dev / Ops / user / an empty "monitoring" one) — at the last step.
> **Check.** `hotspot`: "who wrote this 504?" from the `curl -sv` output (the `Server:` header) and a log line.

Separately. In §6, add a line to the paragraph "From the Sankofa engine we take": "the block's process explanations — §7.10; each is registered in `content/net/explainers/*.steps.yaml` in the 08 §7.6 format".

---

## 6. MAJOR — the visual style contradicts R4/R5 and the rules of 08 §5

**Where:** §6 ("links are drawn 'in ink' when they appear (the `engine/ink.ts` idea)"); N0 ("a scroll scene in the style of Sankofa special projects: two computers, a message between them… the postal metaphor"); §7.2, screen 1 ("a sheet of text on the table… the sheet is put into an envelope"); §7.3.1 ("color by protocol (ARP, ICMP, TCP, UDP/DNS, TLS)").

**What is wrong.** R5 explicitly requires clean engineering graphics and forbids Sankofa ink drawings. R4 forbids animation-as-cartoons, characters and plot. 08 §5.1 allows ink only for metaphors, but after R4/R5 I, as the author of 08, am removing that caveat too: ink leaves the textbook entirely. Color "by protocol" contradicts 08 §5.2: there, color encodes the layer (`--c-l2`, `--c-l3`, `--c-l4`, TLS, `--c-l7`). If ICMP turns out orange in netlab while L3 is blue in an explanation, the learner will learn two different languages.

**Fix (ready text for §6):**

> - **The topology canvas** is an SVG blueprint per 08 §5: a 1.5 px line, an 8 px grid, value captions in Plex Mono 12–13 px. A link appears with a smooth `opacity`/`stroke-dashoffset` in 200 ms, without "hand drawing". Devices are rectangles with a 6 px corner radius, a 16 px role icon and a caption; addresses are captioned on the link near the interface end (`eth0 10.0.1.10/24`), not inside the block.
> - **The envelope's color is by layer, the protocol is by caption.** An envelope in flight is colored in the color of the topmost meaningful layer (ARP and VLAN — `--c-l2`, ICMP — `--c-l3`, TCP without data and UDP — `--c-l4`, a TLS record — TLS, HTTP and DNS — `--c-l7`) and captioned with text (`ARP`, `SYN`, `DNS A?`). A dropped packet is a ⨯ with the caption `DROP` (`--c-err`, never color alone).

Rewrite N0 without the metaphor: two laptop blocks and a line between them. At first nothing travels along the line: the caption "no address — nowhere to send". The learner enters the addresses, and a rectangle with two captioned fields, "to" and "from", travels along the line. The word "mail" may remain in one sentence of the text, but not in the picture. §7.2, screen 1: replace "a sheet on the table" with a block of monospaced request text around which nested header rectangles with fields appear. The layer names sit on the top strip of each envelope, as in 08 §5.2 ("the layer caption on the flap").

The decision "we do not use sound" (§6) diverges from 08 §2, where sound is optional and off by default. I propose the wording: "sound is off in the block and no switch is offered" — this is a local decision of the block, and it is consistent with 08, because 08 does not mandate it.

The block inherits typography and the terminal (R5) from 08 §5. This is worth writing in one line in §6, so that the author does not build their own terminal panel: "the terminal is the 08/3.4 widget; the theme and font are shared".

---

## 7. MAJOR — duplication with 08 §6.3: two different "What happens when you type a URL"

**Where:** §7.1 and §5 (the order N0–N15) versus 08 §6.3 (my document).

**What is wrong.** The explanation has two versions with different orders of introduction. In 08 the port is introduced in scene 3, ARP and MAC in scene 4, OSI in scene 10. In 03 MAC is introduced in N1, and OSI in N6. The numbers diverge too. In 08, "the database answers in 40 s — nginx waits for the upstream for 30 s — 504". In 03 the application takes 75 s, and `proxy_read_timeout` is 60 s by default. nginx's default is indeed 60 s, and 03 is right. 30 s is possible only with explicit configuration, and 08 does not say so.

**Decision (I accept it as the author of 08).** The source of truth is 03: the module order, plus "fog" and "no fog" from §7.1. The 08 §6.3 flagship becomes the "no fog" display mode of §7.1 after N15. It introduces nothing (`introduces: []`), it only assembles. The scene breakdown of 08 §6.3 is kept as the storyboard of the visual part (envelopes, lenses, "break it"). In E-504 and in 08 we use 75 s / 60 s. I will fix 08 §6.3 in the next version. In 03, one line needs to be added to §7.1: "the visual storyboard is in 08 §6.3; the order of introducing concepts and the stage data are here".

---

## 8. MAJOR — the check format does not match the 09 "facts → predicates" contract

**Where:** §7.3.4 (`checks: kind: state | probe | trace`, `expect: { route: {...} }`, `alt`, `penalty`); §7.6 (`fixes.good.check.state`); §10, part B (`dtcheck-net`).

**What is wrong.** 09 §2 fixes a single format `goals: { when: <predicate>, needs, envs, fail[] }` over `dt.facts/v1`. 03 describes its own format. The "Networks" block labs will not pass the shared validator and will not work on tier B. In addition, in 09 `probe` is allowed only with `envs: [vm]`, while the network block needs active probes (ping, curl, dig) in the simulator as well.

**Fix.**
1. Rewrite the §7.3.4 example in the 09 format:
   ```yaml
   goals:
     - id: route
       say: { ru: "Сделайте так, чтобы h1 пинговал h2", en: "Make h1 able to ping h2" }
       needs: [net]
       on: h1
       when: "net.routes[dst=default][gateway='10.0.1.1'] || net.routes[dst='10.0.2.0/24'][gateway='10.0.1.1']"
       envs: [sim, v86]
       fail:
         - if: "!net.routes[dst=default] && !net.routes[dst='10.0.2.0/24']"
           say: { ru: "У h1 нет маршрута к 10.0.2.0/24: посмотрите `ip route`", en: "..." }
           term: default-gateway
     - id: reach
       needs: [probes]
       probes: [{ id: p1, icmp: { from: h1, to: 10.0.2.10, count: 3 } }]
       when: "probes.p1.received>=2"
       envs: [sim, v86]
   ```
2. A proposal to 09: extend `Facts` with a `probes` area (the results of active ICMP/TCP/DNS/HTTP checks requested by the goal, "in a snapshot of the world" on tier A and via agent commands on tier B) and allow `probes` on `envs: [sim, v86]`. This is a generalization of the existing `http?`. The `alt` from 03 becomes `||` in `when`. `penalty` becomes a new field `partial: { if: <predicate>, score: 0.5, say: … }`. It is also needed by task 7 of the placement check (bypassing DNS via `/etc/hosts`).
3. `trace` checks ("the learner ran `dig` before editing the config") are `history` in the 09 facts. They need a 09 rule: "only for hints and the debrief, not for passing". Right now in T1 `must_observe: [see-errorlog, see-direct-timing]` affects the grade. This is acceptable only in scenarios that explicitly teach a method, and it should be written in the scenario text so that there are no surprises.
4. Part B: replace `dtcheck-net` with `trainer-check` (09 §5.4) with the `net-b` track, and extend `facts.sh` with the areas `wg`, `nft`, `sysctl` (finding 9).

---

## 9. MAJOR — part B of the exam does not match R12 and 09 (cost, mandatory cleanup, local VMs without public IPs)

**Where:** §10, part B.

**What is wrong.**
- The cost is not shown and there is no mandatory cleanup step (R12).
- It says "no tamper protection is done", while 09 §2.5 and §5.4 require a signed `attest` for an exam with a mark in the profile.
- If the learner takes part B on local VMs on their own computer (09 §5.3), the machines have **no inbound public addresses**. The items "issue a Let's Encrypt certificate", "22/80/443 are open on vm1 from outside" and "external reachability" cannot be done there literally.

**Fix. Ready text for part B:**

> ### Part B. "On real machines" (two VMs, about 3 hours)
> **Where to get the VMs.** The `net-b` set is 2 VMs with 1 vCPU / 1 GB / 10 GB each plus a utility `probe` VM (0.5 vCPU / 512 MB). The learner orders it from a cloud provider of their choice (09 §5.2); then "from outside" really is the internet, and Let's Encrypt is available if the learner has a domain. The second path is local VMs on one's own computer (09 §5.3): they have no public addresses, `probe` sits in the same private network and plays the role of "the internet", so "from outside" in the task means "from the `probe` machine", and the certificate is issued by the course's teaching CA (`step-ca` on `probe`), not Let's Encrypt.
> **Cost.** Before ordering, a screen shows: "the `net-b` set is 3 VMs; in your cloud, per `providers.yaml` (09 §5.2): for example, 3 × Hetzner CX23 ≈ €0.03/h; on your own computer, free". While working, a counter in the header shows "running for N h M min, ≈ X ₽/€".
> **Task.** (1)–(5) as now, with two replacements: in (3) the certificate comes from the teaching CA or Let's Encrypt; in (4) "from outside" means from `probe`.
> **Check.** `trainer-check enroll` on each VM, track `net-b`, the mode with a server and signed facts (09 §5.4). External reachability — the agent's `probe` script on the `probe` machine: `nc -zv vm2 8080` → a refusal is expected, `curl --cacert ca.pem https://www.corp.lab` → 200.
> **Step 6 — cleanup (mandatory; without it the exam does not close).** In one's own cloud, the trainer shows the delete commands for the chosen provider (`hcloud server delete …`, `yc compute instance delete …`, or `terraform destroy` if the VMs were ordered via the IaC block); local VMs are deleted with the learner's own tool (`multipass delete --purge …`, `vagrant destroy`). Then the learner runs `trainer-check farewell`: the agent revokes its key and sends a "last breath". If a heartbeat from the agent arrives 15 minutes after the exam is closed, the trainer shows a red banner "the machines are still running and costing money".

---

## 10. MAJOR — the netfilter model in netlab does not cover what it will have to show in Kubernetes (R9), and 05 builds its own copy

**Where:** §7.3.3, the `iptables`/`nft` row; "Decision 2"; §13 ("The Kubernetes block uses `netlab` for Service/kube-proxy").

**What is wrong.**
1. kube-proxy in iptables mode builds chains with `-m statistic --mode random --probability 0.33333333349` (distribution across endpoints), `-j KUBE-MARK-MASQ` (`-j MARK --or-mark 0x4000`), `-m mark --mark 0x4000/0x4000 -j MASQUERADE`, `-m addrtype --dst-type LOCAL` (NodePort), `-m comment`. In nftables mode — `numgen random mod N vmap { … }`, `map` and `vmap` sets. The supported subset in 03 has no `statistic`, `MARK`, `mark`, `addrtype`, `numgen` and `vmap`. So "recognizing your own rules in `iptables-save` on the node" (Decision 2) will not work: netlab will not execute the kube-proxy rules.
2. 05 introduces its own `cni-lite` (IPAM, veth, a VXLAN model) and `kube-proxy-lite` (an iptables/nftables model). This duplicates netlab, although 09 §1.3 requires one model in one worker.
3. R9 requires the exercise "find in iptables where the packet to a ClusterIP goes". It needs packet tracing through user chains. For the filter it exists in 03 ("the path through netfilter"); for the nat table with jumps and probabilities it does not.

**Fix.**
- Add to the `iptables` row of §7.3.3: `-m statistic --mode random --probability P`, `-m statistic --mode nth --every N --packet K`, `-j MARK --set-xmark/--or-mark`, `-m mark --mark V/M`, `-m addrtype --src-type/--dst-type LOCAL`, `-t raw -j TRACE` (output to `dmesg`/the journal as in the kernel). To the `nft` row: `numgen random mod N`, `map`/`vmap`, `meta mark set`, `fib daddr type local`.
- Write in "Decision 2": "`cni-lite` and `kube-proxy-lite` from 05 are configuration generators on top of netlab. They create netns, veth, routes, VXLAN interfaces and netfilter rules via the netlab API, rather than keeping their own packet model". This is also a proposal to 05.
- A preparatory exercise in N10 (I, E), which makes K4 a recognition rather than news:

> **n10-chains.** `lb` already has these rules:
> ```
> -A PREROUTING -d 10.96.0.10/32 -p tcp --dport 80 -j SVC-WEB
> -A SVC-WEB -m statistic --mode random --probability 0.5 -j SEP-A
> -A SVC-WEB -j SEP-B
> -A SEP-A -p tcp -j DNAT --to-destination 10.0.2.21:8080
> -A SEP-B -p tcp -j DNAT --to-destination 10.0.2.22:8080
> ```
> Task: (1) send 20 requests `curl http://10.96.0.10` from `client` and, using the counters of `iptables -t nat -L -v`, say how many went into each branch; (2) the address 10.96.0.10 is not on any interface (`ip a` on all devices) — explain why the request is still answered. Check: (1) the number in the answer field matches the counter fact ±0; (2) `explain` by the rubric "DNAT before the routing decision; the address exists only in the rule".
> In K4 the same exercise is repeated on a kube-lite node with the names `KUBE-SVC-…`/`KUBE-SEP-…`.

- R9 prerequisites that the "Networks" block must introduce:
  - VXLAN — a catalog card, finding 3;
  - routing between nodes as in "host-gw" — a task in N4: "each node has its own subnet behind it; write the routes";
  - conntrack and DNAT — N9;
  - `search` and `ndots` — N8, already there;
  - the idea of eBPF for E — one screen in E-NF: "the hooks can be replaced by a program in the kernel; this is how Cilium works without kube-proxy". The term is a `forward:` to K4.

---

## 11. MAJOR — concept order violations within the document itself

**Where and what:**

| Place | Term | Introduced | Fix |
|---|---|---|---|
| N2, the task "neighbors in the same subnet 'see' each other" | checking is impossible without `ping`, and `ping` is introduced in N4 | N4 | Introduce `ping` minimally in N2 ("a check: does the address answer"; ICMP and TTL in N4). Or rely on L14 of the Linux block, if it has `ping`; in 02 §5.1, L14 does not have it in the command list |
| N3, the interactive "run `ping`" and the puzzle about another subnet | `ping`, "gateway" | N4 | The same, plus phrase the puzzle without the word "gateway": "whose MAC does the host look for if the recipient is not in its subnet?" |
| N5, the task `iptables -A INPUT -p tcp --dport 9000 -j DROP` | iptables, chain, DROP | N10 | Do not let the learner type the rule. Replace it with a `breakit` toggle "the firewall on the server silently drops" (08/3.5) captioned `forward: N10` |
| N7, "the DNS server in the options", "option 6 (DNS)" | DNS server | N8 | Swap N7↔N8 (finding 4) |
| N13, "IPVS", "cloud NLB" | IPVS, NLB | nowhere | Remove IPVS (in kube-proxy it is also on its way out, see 05); name NLB functionally: "a cloud load balancer that works with TCP" |
| N6, "header sizes… UDP 8" and the exercise "Build a packet" for a DNS query | a DNS query as the example | N8 (after N6) | For the beginner, replace the example with `ping`. Mark the DNS variant `level: [intermediate, experienced]` |
| §7.1, stage 1 "HSTS list" in the "fog" of the first lesson | HSTS | N11/N12 | Change nothing, but in the fog the stage must be shown only by its number and a grey bar, without a caption. This is not specified now. Add a rule: "in the fog, stage frames are visible without text; the text appears after the module" |
| Task 5 of the "Intermediate" placement check (HSTS, 301/308) | — | — | Acceptable (placement), but 01 §4 says that the placement check uses only concepts the level must know. Per 01, HSTS is not mandatory for L1. I propose replacing it with "why `http://` opened as `https://` — a redirect by the server", and keeping HSTS for "Experienced" |

---

## 12. MAJOR — the textbook as coherent text is not specified (R1)

**Where:** §5 ("the gist, what the learner does") and §8.2.

**What is wrong.** R1 puts the textbook first. 08 has a rule: "the core knowledge is readable without a single click". In 03, each module has a "gist" paragraph and tasks, but lacks:
- the size and structure of the chapter;
- a breakdown into screens following the 01 §6.1 rule "no more than one concept per screen" (and N8 introduces more than 20 concepts);
- the place of the process explanation in the text;
- where reading ends and the lab begins.

**Fix.** In §5, before the modules, insert "The anatomy of a block chapter" and write out one chapter in full as a sample:

> **The anatomy of a chapter.** A module chapter is 1,500–3,000 words of coherent text (the RU version is written straight away in the textbook style of 01 §7) and 6–14 screens. Each screen introduces no more than one concept (`introduces`), the rest go in `uses`. The screen kind is one of `story`/`mechanism`/`lab`/`check` (08 §4). The chapter's process explanation (§7.10) stands in the middle and is embedded in the text, not moved to the end. The lab (`lab`) comes after the text that explains it. Every screen is readable without a click. Handles deepen, but do not hide.
>
> **Sample: N4 "Routing" (11 screens).**
> 1. `story` — "The packet went out the subnet's door". Introduces: the router. Diagram: two subnets and a Linux router between them (`ip_forward=1`, captioned on the block).
> 2. `mechanism` — "The routing table". Introduces: the routing table. A table diagram with three rows; clicking a row highlights where the packet goes.
> 3. `mechanism` — "The default gateway". Introduces: the default gateway (default). Handle: the destination address; if no row matches, default fires.
> 4. `lab` — `ip route`, `ip route get`. Add a default on `h1` (lab n4-two-subnets).
> 5. `mechanism` — "The longest prefix". Introduces: longest prefix match. Handle: the destination address, two overlapping rows; the selected one is highlighted with the explanation "/16 is longer than /8".
> 6. `mechanism` (E-NAT, without NAT) — "What the router changes in the packet". Introduces: the MAC change at every hop. The envelopes from §7.2, screen 3.
> 7. `mechanism` — "TTL". Introduces: TTL. The counter in the IP envelope decreases at every router; at zero, the packet is dropped.
> 8. `mechanism` — "ICMP: network error messages". Introduces: ICMP (echo, time exceeded, unreachable). Captioned arrows back to the sender.
> 9. `lab` — `ping`, `traceroute -n` along a chain of three routers. Find the node without a route.
> 10. `check` — "A one-way ping" (`breakit` "no route back", a prediction before turning it on).
> 11. `check` — the N4 quiz (§9).

The same screen schedule must be done for each module N-1…N16. Estimate: ~150 screens per block. This matches 01 §13, "40–45 minutes per concept".

---

## 13. MAJOR — the principle "first ask which layer broke" is not built into the mechanics (R8)

**Where:** §7.6, N15.

**What is wrong.** The layer-by-layer method is described in N15, but in scenarios T1–T12 the learner goes straight into the terminal. The hypothesis notebook is free text. R8 makes "which layer broke" the principle of the whole block.

**Fix.** Add a mandatory first step and a scoring field to the scenario format:

```yaml
layer_first:
  ask: { ru: "До первой команды: на каком уровне, по-вашему, проблема?", en: "..." }
  widget: hotspot            # a stack L2 / L3 / L4 / TLS / L7 in the 08 §5.2 colors; the learner presses one or two layers
  answer: [L7]               # T1: a 504 response from nginx → L7 of the proxy chain
  revisit_after_cmds: 3      # after three commands, the same question again: has the hypothesis become more precise?
scoring:
  layer_first: 10            # out of 100; the second answer counts if the first was wrong but refined after observations
```

Answers for T1–T12:

| T | Layer |
|---|---|
| T1 | L7 (proxy ↔ application) |
| T2 | L4 (a filter before the upstream) |
| T3 | L4 (port) |
| T4 | L4 (the socket's bind address) |
| T5 | L7 (DNS) |
| T6 | L7 (DNS, `search`) |
| T7 | TLS |
| T8 | L3 (MTU/ICMP) |
| T9 | L3 (forward/NAT) |
| T10 | L3 (route) |
| T11 | L7 (DHCP) → L3 (gateway) |
| T12 | L7 (load balancer) |

The debrief screen shows the layer the learner chose next to the reference one.

---

## 14. MAJOR — the block's scenarios and labs do not use tier B where the point is lost without a real kernel

**Where:** §7.6 (T8 MTU, T9 VPN), N14, exam part A.

**What is wrong.** WireGuard in netlab "simplified" (§7.3.2) means: without cryptography, with invented `latest handshake` and `transfer`. For E and for the pet project from the checklist ("a VPN server on a VPS — WireGuard, iptables"), the value is in the real `wg`. Errors like "the keys are swapped" would have to be modelled by hand in netlab, while in the real `wg` they happen on their own. In T8, an MTU blackhole on a real kernel gives exactly the TCP behavior (PMTUD, retransmissions with the same size) that the learner will see at work.

**Fix.** Scenarios T8, T9, T10 and module N14 for I and E get `envs: [v86]` with a 3-node topology via `vswitch` (finding 1). The T8 breakages are set on the switch (`mtu: 1400` on the link and `fault: drop icmp[0]=3 and icmp[1]=4`). The netlab version remains for the beginner and for the phone. Exam part A gets a switch "hard mode on real nodes" for E. The points are the same; the debrief gets its own mark.

---

## 15. MAJOR — align "Decision 2" and §13 with the containers block (R7b)

**Where:** "Decision 2"; §13, the paragraph "Docker block".

**What is wrong.** R7b lists the network boundaries of a container: veth, the `docker0` bridge, NAT, `-p` as DNAT, the embedded DNS, the host/none modes. In 03 Docker's embedded DNS `127.0.0.11` is mentioned only in §13. N8 has no concept of "a resolver substituted into `/etc/resolv.conf` at the namespace level". There is also no exercise on "there is no network" (the equivalent of `--network none`: only `lo`). Block 04, per R7, will build drills "the container doesn't work, the cause is at the network boundary". They need ready symptom wordings from 03.

**Fix.** Add steps to N16 (finding 4):
- 7: "a namespace with only `lo`": `curl` → `Could not resolve host`, `ping 10.10.0.1` → `Network is unreachable`; the layer is L3, there is no route and no interface;
- 8: "its own `/etc/resolv.conf` for the namespace" (`/etc/netns/red/resolv.conf` is used by `ip netns exec`). Caption: "this is how Docker substitutes its own DNS `127.0.0.11`, and Kubernetes the CoreDNS address".

Add to §13 a table "symptom → boundary → 03 module" for 04:

| Symptom | Boundary | Where it is covered |
|---|---|---|
| `curl localhost:8080` from the host — refused, the container is running | the process listens on 127.0.0.1 inside its netns | T4, N16 |
| `-p 8080:80`, timeout from outside | DNAT is there, FORWARD DROP | N10, E-NF |
| the container does not resolve names | resolv.conf in the netns | N8, N16 step 8 |
| two containers in different networks do not see each other | different bridges | N16 step 3 |

---

## 16. MINOR — factual inaccuracies

**Where and what:**
1. §7.2, screen 1: "46 bytes of payload". The string `GET /catalog HTTP/1.1\r\nHost: shop.example\r\n\r\n` takes **45** bytes (checked with `printf … | wc -c`). The 54 bytes of headers (14 + 20 + 20, without FCS) are stated correctly.
2. §7.1, "Break it", the row "A typo in the name: the authoritative TLD answers NXDOMAIN" for `dig shop.exmaple`. The typo is in the TLD itself (`exmaple`), so NXDOMAIN is answered by the **root**, not the TLD. Either replace the example with `shpo.example` (then the authoritative server of the `example.` zone answers), or fix the column.
3. §7.1, "The authoritative server is down" → `DNS_PROBE_FINISHED_BAD_CONFIG`. In Chromium this code means a failure of the system resolver probe, while with a SERVFAIL for one name the probe usually passes, and the user sees `ERR_NAME_NOT_RESOLVED` or `DNS_PROBE_FINISHED_NXDOMAIN`. Mark it `hold` and capture the real error text on the test bench (the 08 §5.3.6 "real captures" rule).
4. §7.1, `curl -m 10` → `Connection timed out after 10001 milliseconds`. The text depends on the curl version and the phase in which the timeout fired. In curl 7.88 (Debian 12) for the connect phase it usually looks like `curl: (28) Failed to connect to … port 443 after 10001 ms: Timeout was reached`. Check against a 09 §1.3 "golden record" and give the code `(28)`.
5. §7.2: screen 1 builds an HTTP/1.1 envelope to port **80**, but the whole block and §7.1 use the example `https://shop.example/catalog` with ALPN `h2` and the response `HTTP/2 200` (stage 12). For consistency: explicitly call screen 1 "the variant without TLS (`http://`), so that the text is visible". At stage 8 of §7.1, under the "client" lens, show the request as an HTTP/2 HEADERS frame with the pseudo-headers `:method GET`, `:path /catalog`, `:authority shop.example`, or fix the ALPN to `http/1.1` for the teaching example.
6. §5, N13: "IPVS" in the L4 load balancer example. In kube-proxy the IPVS mode is being phased out (05, with a reference to v1.37). As an L4 example it is better to take a cloud TCP load balancer or HAProxy `mode tcp`.
7. §7.4, D9: the pod CIDR `10.244.0.0/16` and the service CIDR `10.96.0.0/12` are the defaults of flannel and kubeadm. In 05 the simulator uses the k3s values (`10.42.0.0/16`, `10.43.0.0/16`). The task should give both sets, captioned "kubeadm/flannel" and "k3s", otherwise in the second block the learner will see "different" addresses without an explanation.

Checked and correct (no changes needed): ephemeral ports 32768–60999; `tcp_syn_retries=6` → ~127 s; the initial RTO of 1 s; TIME_WAIT 60 s; `proxy_read_timeout` 60 s by default; WireGuard overhead of 60/80 bytes and MTU 1420; MSS 1380 in the tunnel; all answers of D1–D9 and of the placement tasks; DHCP 0.0.0.0:68 → 255.255.255.255:67, options 3/6; CGNAT 100.64.0.0/10 (RFC 6598); curl errors (60) for expiry and name; the nginx `error.log` lines; nginx's `504 Gateway Time-out`; the TCP pseudo-header per RFC 9293; Kurose–Ross, 9th edition, summer 2025 (Pearson © 2026); the Cloudflare page "Error 502 or 504" exists; the v86 example `two_instances.html` confirms the `net0-send`/`net0-receive` API.

---

## 17. MINOR — numbers diverging from 01 and 09

- Hours: 03 §4.1 — 35–45 / 20–25 / 10–14; 01 §13 — 45 / 28 / 12. With the new N-1, N16, the catalog and the explanations, the block for the beginner comes closer to 50 h. It needs to be agreed with 01 as one number, and 01 updated.
- The netlab core size: 03 §7.3.5 — "up to 150 KB gzip", 09 §1.3 — "80 KB". The catalog dissectors (finding 3) will add 30–40 KB. I propose a common number of 120 KB for the core and a separate on-demand chunk for the packet scope dissectors.
- Storage: 03 — "the session state in IndexedDB". 09 §3 separates simulator snapshots (CBOR, IndexedDB) from v86 snapshots (OPFS). For the tier B labs of the "Networks" block, OPFS applies. This should be said explicitly.

---

## 18. MINOR — QR transfer: a snapshot of the review deck does not fit into 213 bytes

**Where:** §6, the item about `engine/qr.ts` ("the QR carries a link with the state of the review deck").

**What is wrong.** The Sankofa encoder is limited to version 10 and 213 bytes (08 §3.9). The state of an FSRS deck, even of 50 cards (stability, difficulty, a date for each), will not fit even after compression.

**Fix.** The QR carries only the lesson, the mode (`drill=D1..D9`), the generator seed and the difficulty level. The deck on the phone starts anew or is synchronized via the account (09 §3.4). Offline transfer of the deck is via an export file (09 §3.3).

---

## 19. MINOR — the packet scope and the AI: "explain the frame" at ladder steps 4–5

**Where:** §7.5, "AI in the packet scope"; §11.

**What is wrong.** At step 4, "explain this frame" effectively gives away the answer to `capture` tasks, and in the exam (step 5) the AI is off altogether. The step rules are not linked to the five places where the AI is called in the §11 table.

**Fix.** Add a "ladder step" column to the §11 table:
- steps 1–3 — as now;
- step 4 — "explain the frame" is available, but not for frames referenced by the current `capture` task; the AI works in "where did you look?" mode (finding 2);
- step 5 — everything is off, the buttons are hidden rather than greyed out.

---

## 20. MINOR — the "Experienced" placement check and the starting step 3

**Where:** §4.2.

The experienced learner skips N0–N2, N5–N8 and N11–N12 via entry mini-tests. After that they may never see the protocol catalog and the map of the internet. I propose making N-1 (condensed, 15 minutes) and the catalog, to the extent of their own cards (BGP, VXLAN/Geneve, IPsec, mTLS, the OSPF idea), mandatory for E. This meets R8 and the "backend programmer" profile, which per 4.1 is usually weak precisely here.

---

## 21. MINOR — the "fog / no fog" modes must be described as widget state

**Where:** §7.1.

It says that the interactive "opens its own segment after each module". It does not say where this state is stored, what is visible in the fog, and what happens if the learner came via an entry test. Add: the fog is computed from the set of modules credited in the progress (not from the pages visited), so whatever was credited by an entry test is open. In the fog, stage frames with numbers are visible, without captions and values (see finding 11). A QR link transfers the step number, but not the fog: on the phone the fog is recomputed from the progress.

---

## 22. MINOR — `mtr` is "not supported"

**Where:** §7.3.3, the last row.

`mtr` is a standard on-call tool, and it is more convenient than the `traceroute` + `ping` pair for the task "where are packets being lost". In netlab its output is just an aggregate of already modelled ICMP. I propose supporting `mtr -n -r -c N` (report mode, without the interactive screen). This gives a step 3 task: "find the report mode without the interactive screen" (`-r`/`--report`).
