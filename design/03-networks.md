# 03. The "Networks" block: design document

Role: network engineer and curriculum designer. Revision 2 of 18.11.2026, after reviews by the authors of 05 (Kubernetes) and 08 (textbook engine) and the owner's requirements R1–R12. What changed and what was rejected is in the last section.
Place in the curriculum: step 03 of the checklist ("DNS, DHCP, TCP/IP, NAT, iptables — without these you will understand neither Docker nor K8s"). It comes after the Linux block and before the containers block. Both neighbouring blocks rely on its results, and Kubernetes networking (R9) stands on it entirely.

## 0. Decisions in brief

| # | Decision | Details in |
|---|---|---|
| 1 | The core of the block is three things in this order: a coherent textbook with a strict order of concepts, process explanations for every major mechanism, and the habit of reading documentation. Practice stands on them, not in place of them (R1) | 1, 5, 7, 14 |
| 2 | The path goes from the big picture to the packet: map of the internet → layer envelopes → each layer hands-on → end-to-end processes (URL, 504). Any problem is first assigned to a layer: "which layer broke?" (R8) | 1, 5, 7, 12 |
| 3 | Two execution tiers with one packet model. Tier A is `netlab` (TypeScript, simulated time, determinism); tier B is `lab-net`: 2–4 real v86 Linux machines connected by our `vswitch` switch (R11) | 2, 8, 9 |
| 4 | One network model for the whole course. dsim (04) and kube-lite (05) do not model packets themselves; they configure netlab through `NetlabApi`. netlab's netfilter executes everything that Docker and kube-proxy generate | 2, 8.6 |
| 5 | A new module `net.m15` "Networks inside a single kernel": netns, veth, bridge, routing between machines without NAT, VXLAN. Container networking (R7b) and Kubernetes networking (R9) stand on it | 5, 7.11 |
| 6 | A protocol catalog of 24 cards in a single format, from ARP to BGP. VLAN, BGP and OSPF are studied as understanding and observation, without configuring hardware | 13 |
| 7 | A five-step documentation ladder with tasks for every module; man pages and the nginx documentation live in the trainer offline | 14 |
| 8 | Checks exist only in contract 09 "facts → predicates". For networking a `reach` fact domain is added (results of probe ping/curl/dig requested by a goal) | 8.5 |
| 9 | The nginx model reproduces the real retry logic (`proxy_next_upstream error timeout`, `max_fails=1`, `fail_timeout=10s`). Every scenario has a "golden recording" from real nginx on `lab-net` | 8.2, 12 |
| 10 | The visual language is the blueprint style of 08 §5 only: colour encodes the layer (`--c-l2`…`--c-l7`), the protocol is written as a label. Sankofa ink and metaphorical scenes are removed from the block (R4, R5) | 6 |
| 11 | Part B of the exam runs on real VMs that the learner takes in their own cloud or brings up on their own computer, with the price before ordering, signed `trainer-check` facts and mandatory cleanup (R12) | 17 |

## 1. What the block must deliver and what it does not do

The checklist says honestly that networking is a weak spot even for experienced engineers, and that "at first the basic protocols and your own understanding of how networks work are enough to troubleshoot quickly and effectively". That is where the goal of the block comes from. A graduate does not know every header field by heart, but sees the whole path of a request, from the laptop through the provider and an internet exchange point to a rack in a data centre. They can break any failure down by layers and confirm each hypothesis with a command, and they find an unfamiliar flag in the man page on their own. The final skill sounds both like an interview question and like an on-call shift at three in the morning: "a user sees a 504 — what do you do".

The block's priorities are set the way the owner set them (R1). First, the textbook: each module is a coherent chapter, and concepts are introduced strictly one at a time and only after the ones they rely on (section 3). Second, process explanations: everything in networking that happens over time (name resolution, the handshake, a packet's path through a router and NAT, traversal of netfilter chains, the birth of a 504) is shown as a step-by-step diagram with controls and a "break it" mode (section 7). Third, documentation: the block gradually moves the learner from "here is where this came from" to tasks that cannot be solved without a man page (section 14). Labs, drills and troubleshooting scenarios stand on these three supports. No lab starts before the text that explains it.

The direction of travel is from the big picture to the packet (R8). The block opens with a zoomable map of the internet: laptop, home router, provider, backbone, exchange point, submarine cable, data centre, CDN, root DNS servers (module `net.m00`). Then come the layers, from the Ethernet frame upward, each one hands-on. Once the learner has touched all the layers, they are assembled into the model of nested OSI and TCP/IP envelopes (`net.m06`). The model serves as a vocabulary: "a problem at L3", "an L7 load balancer". At the end come the end-to-end processes "what happens when you type a URL" and "where a 504 comes from", where all the layers work together.

One rule runs through the whole block: **every network problem is tied to a layer, and the first question during a failure is which layer broke**. The rule is built into the mechanics. Every troubleshooting scenario has a `layer` field and a mandatory first step "name the layer before the first command". Every protocol catalog card ends with a "how it breaks" section that names the layer. There is a separate drill, "Which layer?" (10.3).

What the block does not do. It does not teach configuring network equipment: Cisco IOS and Juniper, STP, MPLS, wireless networks. VLAN, BGP and OSPF are in the block, but as understanding and observation. The learner knows what they do, at which layer they work, what they look like in a capture and where they appear in the cloud and in Kubernetes. BGP and autonomous systems appear on the map of the internet and in a catalog card for the experienced level: what an AS announces and why a route leak takes down half the internet. VLAN is an intermediate-level card: the 802.1Q tag on our `vswitch` switch, access and trunk ports, the `eth0.10` interface in Linux. OSPF is a single "idea" screen for the experienced level. The learner does not write BGP session or OSPF area configuration. Routing and switching are studied exactly as far as needed to understand what a Linux host, a cloud VPC, a Docker bridge and a CNI in Kubernetes do. All the "hardware" in the trainer consists of Linux machines with one or more network cards, a switch, and an "internet" with a provider.

A cross-cutting principle of presentation: every concept is shown three times. The diagram shows how it is built. The output of a real command shows how an engineer sees it. The packet shows what actually went onto the wire. If one of the three views cannot be shown, the concept is postponed to a module where it can.

## 2. Tooling decisions

Existing products were examined before deciding.

| Product | How it works | What we take | Why it is not the foundation |
|---|---|---|---|
| Miminet (miminet.ru, St Petersburg State University, I. Zelenchuk) | A web interface to Mininet on a server: a real Linux stack, Open vSwitch switches; hosts, routers, NAT masquerade, ping, traceroute, TCP/UDP clients; automatic checking by configuration and ping result | Automatic checking "by the final state of the network, pointing to the stage where it broke" (for us, the `stage` field in `reach` facts); the "theory + task in the emulator" format | Server-side real-time emulation (STP up to 30 s, queues of up to minutes under load), a limit of 80 devices, sign-in through external accounts; no DNS, DHCP, iptables, HTTP. Source: https://habr.com/ru/articles/953844 , course https://stepik.org/208904 |
| Cisco Packet Tracer | A proprietary program with a packet simulation mode | Simulation mode: a packet envelope travels along a link, a click opens the layers | Cisco IOS instead of Linux, closed format, cannot be embedded |
| Filius | An educational simulator in Java, GPLv3 (https://gitlab.com/filius1/filius) | The simplicity of the host "desktop" | Desktop, Java, no iptables or Linux commands |
| GNS3, containerlab | Real OS images in VMs/containers | A reference point for advanced learners at the real-VM stage | Require a server or local Docker |
| v86 (an x86 emulator in the browser) | A real Linux kernel in the browser. The network adapter (ne2k or virtio-net) emits each guest frame as a `net0-send` bus event and accepts frames via `bus.send("net0-receive", frame)` (example `examples/two_instances.html` in the v86 repository; https://github.com/copy/v86/blob/master/docs/networking.md) | **Tier B of the block**: 2–4 `lab-net` machines connected by our `vswitch` switch. Every frame passes through our code, so it can be parsed by our dissectors, shown on the diagram, delayed, dropped or truncated by MTU deterministically by frame number (section 9) | Not a foundation for beginners and phones: startup in seconds, 64–128 MB of memory per machine, no simulated time (a 127 s timeout lasts 127 s), timings inside the guest are non-deterministic. So theory and scenarios with long timeouts stay in netlab |
| Mess With DNS (Julia Evans) | A real DNS server with the learner's subdomain and a live query log (https://messwithdns.net) | The idea of "seeing every query to your own name"; a link as an external exercise | External service |
| The Illustrated TLS Connection (https://tls13.xargs.org) | Every byte of the TLS 1.3 handshake with an explanation | The "byte — field — meaning" format for the packet scope | A static page; we use it as a source |
| alex/what-happens-when | A collective answer to the interview question | The list of stages for the "URL" explanation | Text, not interactive |
| Wiregasm (@goodtools/wiregasm) | Wireshark dissectors in WebAssembly | Knowing that the option exists | Wireshark is distributed under GPL-2.0-or-later. By embedding it in the client we would extend the GPL copyleft to the whole trainer client (Apache 2.0 is compatible with GPLv3 only in the sense that the combined work becomes GPLv3). Plus a multi-megabyte wasm. https://github.com/good-tools/wiregasm |
| RouterJockey Subnet Trainer and similar | A mask slider, bits move, then drills | The "32 bits and a mask slider" visualisation | External site |

This leads to seven decisions.

**Decision 1. Two execution tiers with one packet model.**

Tier A is our own `netlab` simulator in TypeScript, running entirely in the browser (in the shared `sim.worker.ts`, 09 §1.3). It is a discrete-event core with a simulated clock. A 127-second TCP timeout passes instantly or accelerated, and the learner sees that "2 minutes 7 seconds have passed". Determinism (a random seed in the scenario file) is needed so that a check gives the same result every time and a failure is reproducible. The devices are Linux hosts with iproute2, iptables, nft, dig, curl, ss and tcpdump, plus a switch and an "internet" (DNS root and TLD servers, training websites). Tier A serves the beginner, the phone, theory, step-by-step explanations, drills and scenarios with long timeouts.

Tier B is `lab-net`: two to four real v86 Linux machines, each in its own Web Worker, 96 MB each (from 64 to 128), connected by our `vswitch` switch (section 9). It is needed where meaning is lost without a real kernel: WireGuard between nodes, `ip rule`, `rp_filter`, `br_netfilter`, VXLAN, module `net.m15`, step 4 tasks of the documentation ladder, the "hard mode" of the exam.

Both environments emit the same `net.packet` events in the same `Packet` format (section 15.1) to the 08 §3.0 bus. The diagram, animator, inspector and packet scope do not know which tier a lesson runs on. Tier C, real cloud VMs, is needed only for part B of the exam (section 17).

**Decision 2. One network model for the whole course.** A network namespace is a "host" without hardware, a veth pair is a link, `docker0` is a bridge with an address, port publishing is DNAT in the DOCKER chain, a Kubernetes Service is DNAT in the KUBE-SERVICES/KUBE-SEP chains, a CNI is routes and tunnels. A learner who wrote `iptables -t nat -A PREROUTING ... -j DNAT` themselves in the Networks block opens `iptables-save` on a node in the Kubernetes block and recognises their own rules. For this to be true rather than a promise, netlab has a programmatic interface, `NetlabApi` (8.6). dsim from 04 and `cni-lite`/`kube-proxy-lite` from 05 are configuration generators on top of netlab. They create netns, veth, bridges, routes, tunnels and netfilter rules through this interface and keep no packet model of their own. The Networks block's commitment: netlab's netfilter executes everything that Docker and the real kube-proxy generate in iptables and nftables modes (8.3). On tier B the same configuration code is executed by real commands in the guest.

**Decision 3. Our own packet dissectors in TypeScript.** Ethernet, 802.1Q, ARP, IPv4, IPv6 (basic), ICMP/ICMPv6, UDP, TCP with options, DNS, DHCP, NTP, HTTP/1.1, HTTP/2 (frames, when keys are available), TLS record and Handshake, QUIC (Initial and long header only, the rest is "encrypted"), WebSocket, SMTP (command text), WireGuard, VXLAN, Geneve, BGP (OPEN, UPDATE, KEEPALIVE), ESP (opaque). The licence is clean, and the simulator model needs the header fields anyway. The simulator, `vswitch` and the packet scope work with one packet format. Budget: the netlab core is 120 KB gzip; the packet scope and catalog dissectors are a separate chunk of up to 40 KB, loaded on demand (a proposal for 09 §1.3, which currently says 80 KB: with the nginx model and netfilter for kube-proxy, 80 KB is not enough).

**Decision 4. Real cloud VMs only in part B of the practical exam** (WireGuard, nginx, nftables and step 5 of the ladder). Everything that can be done on a real kernel in the browser is done on tier B.

**Decision 5. The end-to-end explanation "What happens when you type a URL" is the backbone of the block.** It appears in the first lesson "in fog" and after each module uncovers its own section; in `net.m16` the learner walks the whole path without fog and breaks it. The split with 08: the engine, widgets and visual language are described in 08 §6.3, while the content of the stages, packet fields, failures, order of introducing concepts and checks are here, in 7.10. This is the source of truth. There is one domain, `shop.example` (the reserved TLD `.example`, RFC 2606, RFC 6761), and the default nginx timeout is 60 s.

**Decision 6. The layer principle lives in the mechanics, not in the text.** The `layer` field on scenarios, the layer question as the first step, the layer colour in all diagrams, the "Which layer?" drill.

**Decision 7. Documentation is part of the curriculum, not an appendix.** Offline man pages and nginx documentation inside the trainer, five ladder steps with tasks for every module, a mentor mode "where did you look?" (section 14). The simulator does not answer an unfamiliar flag with a list of supported flags: that would be a hint that cancels step 4.

## 3. Strict order of introducing entities

### 3.1. The rule and identifiers

No term is used before the screen where it is introduced. Technically this is enforced by the shared concept registry `concepts.yaml` from 01 §6: a concept has one `intro`, a list of dependencies and a bilingual definition. Texts, questions and diagram labels mark up terms (`[[N02|subnet]]`), and the build linter fails if a term appears before its `intro`. The same list of already-introduced concepts goes into the AI mentor's context.

Identifiers are kept separate. Concepts take ids from the 01 graph (`N01`…`N21`) plus the new `N22`…`N31` (3.4). The block's modules are named `net.m00`…`net.m16`, so that the "Routing" module is not confused with the concept `N04 Port`. The platform is offered the same rule for all blocks (in 05 the modules are `k8s.m00…`).

The Linux block (02, module L14 "The network from the machine's point of view") has already introduced, with everyday definitions, the interface, IP address, mask, default route, port, socket, listening service, DNS query, `/etc/hosts`, `/etc/resolv.conf`, HTTP request and response, as well as the commands `ip a`, `ip r`, `ss -ltnp`, `ping`, `curl`, `dig`, `getent hosts`, `nc`. L15 introduced SSH and keys. The Linux block's module "How the kernel isolates and limits" (R6) introduced the process and thread, namespaces (`unshare`, `nsenter`, `/proc/<pid>/ns`, `lsns`), cgroups v2 and capabilities. The Networks block does not introduce these concepts again. For them `concepts.yaml` uses a `deepens:` link (a new link type, also needed by 08 §7.3): the concept is already introduced, and the mechanism appears here. The first screens of such chapters start with recognition: "In Linux you saw `inet 10.0.2.15/24` in the output of `ip a`. Now let's work out what this /24 means".

Terms that have to be named before they are explained are marked `forward:` (01 §6.1): a label "covered in m10", without a definition. Example: in `net.m05` a filter that silently drops packets is a scenario toggle labelled "how it works — m10", not an `iptables` command.

### 3.2. Module order

| Module | Title | Introduces (01 concepts) | Deepens from Linux | Relies on |
|---|---|---|---|---|
| net.m00 | How the internet works | network of networks, provider, autonomous system and the idea of BGP (N26), internet exchange point and CDN as an idea (N27), backbone, submarine cable, data centre, propagation delay (N31), root DNS servers and anycast (idea) | IP address (L14) | F05 |
| net.m01 | Frame and MAC | network card, link, frame, MAC address (N06, part 1), switch, MAC table, broadcast | interface (L14) | m00 |
| net.m02 | IP address and subnet | binary notation, octet, mask and CIDR prefix (N02), network address, broadcast, RFC 1918 private ranges, `127.0.0.1`; IPv6 briefly | IP address, mask (N01, L14) | m01 |
| net.m03 | ARP | ARP request and reply, ARP cache, `ip neigh` (N06, part 2) | `ping` as "check connectivity" (L14) | m01, m02 |
| net.m04 | Routing and ICMP | router, routing table, default gateway, longest prefix match, TTL, ICMP, `traceroute` (N03, N12) | default route, `ip r`, `ping` (L14) | m02, m03 |
| net.m05 | Ports, UDP, TCP | UDP, TCP, handshake, seq/ack, FIN, RST, socket states, ephemeral ports, window (N05, N31) | port, socket, service, `ss`, `nc` (N04, N13, L14) | m04 |
| net.m06 | Envelopes: OSI and TCP/IP | encapsulation, header, MTU, MSS, fragmentation, DF, the OSI and TCP/IP models as a vocabulary (N07) | — | m01–m05 |
| net.m07 | DNS | domain, hierarchy, root, TLD, delegation, glue, authoritative and recursive server, cache and TTL, record types, response codes, `search` and `ndots` (N08, N25) | DNS query, `/etc/hosts`, `/etc/resolv.conf`, `dig` (N09, L14) | m05, m06 |
| net.m08 | DHCP | lease, DORA, options, link-local (N10) | — | m01, m05, m07 |
| net.m09 | NAT | public and private address, SNAT/masquerade, DNAT, conntrack (N11, N28), CGNAT | — | m04, m05 |
| net.m10 | Netfilter: iptables and nftables | hook, table, chain, rule, policy, verdicts, stateful filter, user-defined chains, `nat OUTPUT` (N17, N29) | — | m09 |
| net.m11 | HTTP | method, path, headers, `Host`, status codes, keep-alive, HTTP/2 and HTTP/3 as an idea | HTTP request and response (N14, L14) | m05, m07 |
| net.m12 | TLS, HTTPS and SSH | encryption, key pair, certificate, chain, CA, SNI, ALPN, TLS 1.3 handshake (N15); SSH as a second encrypted channel | SSH and keys (N18, L15) | m11 |
| net.m13 | Proxies, load balancers, CDN | forward and reverse proxy, upstream, L4 and L7 load balancing, passive health checking, retry on the next server, proxy timeouts, `X-Forwarded-For`, CDN and cache (N19, N27 mechanism) | — | m11, m12 |
| net.m14 | VPN and WireGuard | tunnel, re-encapsulation, WireGuard keys, `AllowedIPs`, endpoint, tunnel MTU (N30) | — | m06, m09, m10 |
| net.m15 | Networks inside a single kernel | network namespace as a stack (N21), veth and bridge (N20), routing between machines without NAT (N23), VXLAN and overlay (N22), eBPF as an idea (N24, E only) | namespace, `unshare`, `nsenter`, `lsns` (L27, R6) | m10, m14 |
| net.m16 | Troubleshooting and assembly | layer-by-layer method, refused and timeout, 502 and 504, MTU black hole, asymmetry; the whole URL path (N16) | — | everything |
| net.mX | Exam | — | — | everything |

Why the OSI model comes sixth rather than first, as in many textbooks: seven layers introduced before the learner has seen a single frame remain rote memorisation. The map of the internet in `net.m00` gives the big picture without layers, `net.m01`–`net.m05` give the layers hands-on, and in `net.m06` the learner sorts into envelopes what they have already touched. The model becomes a map rather than a dogma.

DNS comes before DHCP. This way DHCP option 6 "DNS server" is explained by an already-introduced concept, and the order matches the 01 graph (`N10 DHCP` requires `N08 DNS`).

IPv6 is introduced briefly inside m02 (address format, `::1`, `fe80::/10`) and m04 (`ping -6`, `ip -6 route`) for the intermediate and experienced levels. The beginner gets one paragraph, "it exists and looks like this", with no tasks. In DevOps practice in 2026 IPv6 appears in clouds and dual-stack clusters, but entry-level interviews almost always test IPv4.

### 3.3. Fixed order violations

| Place | Was | Now |
|---|---|---|
| m02, m03 | `ping` and ICMP before m04 | `ping` is used as the tool "check connectivity" familiar from L14. The word ICMP is not used before m04; in the m03 capture the frame is labelled "ping echo request (we will name the protocol in m04)" with `forward: [N12]` |
| m03, puzzle | "the gateway's MAC" before the gateway is introduced | "Which device's MAC does a host look for if the destination is not in its subnet?" — the answer is revealed in m04 |
| m05 | the learner enters `iptables -A INPUT ... -j DROP` | a `breakit` toggle "the server has a filter enabled that silently drops packets to port 9000 (how it works — m10)"; in the scenario it is `faults: [{ on: srv, drop: { tcp_dport: 9000 } }]` |
| m06 | NAT and tunnel screens in a module where NAT and tunnels are not introduced | m06 shows screens 1–3 of the "Envelopes" explanation; the NAT screen opens in m09 (`gate: [net.m09]`), the tunnel screen in m14 (`gate: [net.m14]`), as a continuation of the same scene |
| m06, "Build a packet" | the example is a DNS query before DNS | for the beginner, ping (ICMP in IP in Ethernet); the DNS variant is marked `level: [intermediate, experienced]` |
| DHCP | "DNS server in the options" before DNS | DNS moved before DHCP |
| m07 | "preparation for CoreDNS with its `ndots:5`" | "short names and `search` are what DNS inside the cluster will stand on two blocks from now", `forward: [K16]` |
| m13 | IPVS and a "cloud NLB" without introduction | the L4 load balancer is described functionally: "a load balancer that sees only addresses and ports: HAProxy in `mode tcp` or a cloud TCP load balancer". kube-proxy's IPVS mode is deprecated in Kubernetes v1.35 and is not in the Networks block |
| URL explanation, "fog" | stage labels visible before the modules | in the fog the stage frames are visible with numbers, without labels or values; a label appears after the module is passed (7.10) |

### 3.4. New concepts for `concepts.yaml`

| id | Concept | Requires | Module |
|---|---|---|---|
| N22 | VXLAN and overlay network | N07, N20 | m15 |
| N23 | Routing between hosts without NAT | N03, N21 | m15 |
| N24 | eBPF as the idea of "rules outside netfilter" | L27, N29 | m15, E only |
| N25 | `search` domains and `ndots` | N09 | m07 |
| N26 | Autonomous system and BGP (idea) | F05, N01 | m00 |
| N27 | Internet exchange point, CDN | N26 | m00 (idea), m13 (mechanism) |
| N28 | conntrack | N11, N05 | m09 |
| N29 | Netfilter hooks and chains, user-defined chain | N17 | m10 |
| N30 | Tunnel and re-encapsulation | N07 | m14 |
| N31 | Propagation delay, RTT, bandwidth-delay product | N05 | m00 (delay), m05 (window) |

Proposals for the 01 graph (the rationale is in the "Changes after review" section): `N12 ping/traceroute/ICMP` should require `N03`, not `N07`; conversely, `N07` requires `N12`. Move the concept `N18 SSH and keys` to the Linux group, because L15 introduces it; in the Networks block SSH is deepened (a screen in m12 and a catalog card). The concept `N26` requires `N01` as the everyday IP address from L14, not the subnet mechanism.

## 4. Levels and level verification

### 4.1. Level definitions and routes

The block's levels match the levels of 01 §4.3: "Beginner" = L0, "Intermediate" = L1, "Experienced" = L2.

**Beginner.** A person with no IT experience, for example a sales manager. Uses a browser and Wi-Fi, has seen the words "IP address" in the router settings. Has completed the Linux block. Outcome: explains the URL path down to the packet level, calculates subnets from /16 to /30, sets an address and a route, reads the output of ping, traceroute, dig, curl and ss, connects two network namespaces with a bridge, passes the basic troubleshooting scenarios and answers any failure first with "which layer is this".

**Intermediate.** Has worked in a Linux terminal, configured a home router, knows that DNS "turns a name into an address", that a website has port 443, has heard of NAT. Perhaps administered an office or worked in technical support. Outcome: everything the beginner has, plus NAT, iptables and nftables, TLS, reverse proxy and nginx retry logic, WireGuard between two machines, VXLAN, all scenarios without hints.

**Experienced.** Not a DevOps engineer, but, for example, a backend developer: writes HTTP services, knows status codes and headers, has worked with sockets, has installed nginx following instructions. Typical interview gaps: ARP and the role of the gateway, longest prefix match, conntrack, the order of netfilter chains, the difference between DROP and REJECT in symptoms, recursive and authoritative DNS, why a 504 and not a 502, and who exactly wrote that 504. Usually also weak on the big picture (AS, IXP, BGP), so the map of the internet is mandatory for them in express mode.

A single route table. "Condensed" means tasks and a quiz, with the theory expanded on click. "Entry test" means 3–4 tasks from the module quiz marked `entry: true`; on failure the module expands fully.

| Module | Beginner | Intermediate | Experienced |
|---|---|---|---|
| m00 How the internet works | full | full | express, 15 min |
| m01 Frame and MAC | full | entry test | entry test |
| m02 IP and subnet | full | condensed | entry test |
| m03 ARP | full | full | full |
| m04 Routing and ICMP | full | full | full |
| m05 Ports, UDP, TCP | full | condensed | condensed (the "TCP window" explanation in full) |
| m06 Envelopes | full | full | condensed (counting tasks in full) |
| m07 DNS | full | full | full |
| m08 DHCP | full | condensed | entry test |
| m09 NAT | full | full | full |
| m10 Netfilter | basic part (filter/INPUT) | full | full |
| m11 HTTP | full | condensed | entry test |
| m12 TLS, HTTPS, SSH | full | full | full |
| m13 Proxies and load balancers | basic | full | full |
| m14 VPN and WireGuard | the concept of a tunnel | full | full |
| m15 Networks inside a single kernel | full on tier A, one lab on tier B (if the device can handle it) | full | full |
| m16 Troubleshooting and assembly | full | full | full |
| Protocol catalog | B-level cards | B + I | all, E cards mandatory |
| Documentation ladder step at the start | 1 | 2 | 3 |
| Hours (with practice and exam) | 50 | 32 | 15 |

The hours are higher than in 01 §13 (45/28/12): the map of the internet, module m15, the protocol catalog, process explanations and the documentation ladder have been added. Proposal for 01: replace the "Networks" row with 50/32/15.

Level marks have been removed from the module headings in section 5: only this table applies.

### 4.2. Verifying a self-selected level

The official level check is the one in 01 §4.3: 7 tasks for L1 (criterion 6 out of 7, key tasks 1 and 2) and 7 for L2 (6 out of 7, at least two of tasks 1–3). The Networks block supplies a task bank for it (below): 01 takes its 7 from this bank, and the bank's tasks are also used for re-checks and for module entry tests. The check result does not forbid the chosen route: if it is not passed, the platform names the modules that become mandatory and explains why ("you answered that a router changes the destination IP address; this is covered in m04"). Every task is checked automatically; tasks in the simulator use 09-format goals (section 8.5).

**Beginner.** No confirmation is required; this is the starting route. There is a block readiness check: open a terminal, run `cat /etc/hosts`, find a process with `ps`. On failure, back to the Linux block.

**"Intermediate" bank (L1).** Tasks 6–8 are practical and key.

1. Which of these addresses are private? `10.12.0.5`, `172.32.1.1`, `192.168.100.200`, `100.64.3.3`, `172.20.0.1`. Answer: `10.12.0.5`, `192.168.100.200`, `172.20.0.1` (`172.32.x.x` is outside `172.16.0.0/12`; `100.64.0.0/10` is CGNAT, not RFC 1918). Only an exact match counts.
2. How many host addresses are there in `192.168.10.0/26`? Answer: 62.
3. Put the DHCP messages in order: Request, Offer, Ack, Discover. Answer: Discover, Offer, Request, Ack.
4. Protocol and default port for a DNS query, HTTPS, SSH. Answer: UDP 53 (and TCP 53), TCP 443, TCP 22.
5. A user types `http://shop.example` in the browser, and `https://shop.example` opens. Why? Options: the DNS server answered that way; the server responded with a redirect (`301`/`308` with a `Location` header) to HTTPS; NAT on the router; that is how TLS works. Answer: the second. This level does not need to know HSTS and the browser's automatic HTTPS attempt (HTTPS-Upgrades in Chrome); they are tested in the "Experienced" bank (task 12).
6. Simulator: host `h1` has address `192.168.1.10/24` and no gateway. Make `ping 8.8.8.8` work; the router is `192.168.1.1`. Goal: `net.routes[machine=h1][dst=default][gateway='192.168.1.1'] && reach.p1.received>=2`.
7. Simulator: `curl http://app.lab` from host `h1` says `Could not resolve host`. Find the cause and fix it. (`/etc/resolv.conf` points to a non-existent server.) Goal: `reach.http1.status=200 && files['/etc/resolv.conf'].text~'192.168.1.53'`. Partial credit: if the learner added an entry to `/etc/hosts`, `partial: { if: "files['/etc/hosts'].text~'app.lab'", score: 0.5, say: "it works, but you bypassed DNS instead of fixing it" }` fires.
8. Read the output and say where it broke:
   ```
   $ traceroute -n 10.20.0.5
    1  192.168.1.1  0.412 ms  0.388 ms  0.371 ms
    2  10.0.0.1  1.904 ms  1.877 ms  1.850 ms
    3  * * *
    4  * * *
   ```
   Answer: "beyond node `10.0.0.1` packets do not get through or replies do not come back; next, look at the route on `10.0.0.1` and at filtering". The distractor "`10.0.0.1` is broken" is wrong: the node replies, so it is alive.

**"Experienced" bank (L2).** Tasks 7–11 are practical; 11 confirms the start at step 3 of the documentation ladder.

1. A host has two routes: `10.0.0.0/8 via 10.1.1.1` and `10.20.0.0/16 via 10.1.1.2`. Where does a packet to `10.20.5.5` go? Answer: via `10.1.1.2` (longest prefix match).
2. What changes in a packet when it passes through an ordinary router without NAT? Source and destination MAC addresses — yes; TTL — yes; IP checksum — yes; destination IP address — no; TCP port — no.
3. A client runs `curl` against a closed port; in one case the response is instant, in the other it hangs until the timeout. Explain the difference in one sentence. Rubric: "in the first case the host replied with a TCP RST (or ICMP port unreachable with REJECT), in the second the packets were silently dropped (DROP) or did not arrive". Without AI: multiple choice.
4. The order of netfilter hooks for a packet that a router forwards. Answer: PREROUTING → FORWARD → POSTROUTING.
5. Why is no separate allow rule needed in the input chain for replies to outgoing connections if there is `ct state established,related accept`? Multiple choice.
6. What does a resolver with an empty cache send to a root server when asked for `api.example.com`, and what does it get back? Answer: a resolver without QNAME minimisation asks the full question `api.example.com A`; a resolver with minimisation (RFC 9156, enabled by default in Unbound, Knot Resolver, BIND) asks only about `com.`. In both cases the root answers not with an address but with a delegation: the NS records of the `com.` zone with glue addresses. Both variants count if the answer "delegation" is named.
7. Simulator: an application on `app1` listens on port 8080; `curl http://10.0.2.20:8080` from a neighbour gives `curl: (7) ... Couldn't connect to server`, but works from `app1` itself. Find and fix it. (The process listens on `127.0.0.1:8080`.) Goal: `net.listen[machine=app1][port=8080][addr!='127.0.0.1'] && reach.http2.status=200`.
8. Simulator: configure port forwarding on `gw`: from outside `203.0.113.10:80` → internal `10.0.2.20:8080`, and internet access for `10.0.2.0/24`. Goal: `reach.ext_http.status=200 && reach.app_ping.received>=2 && net.iptables.nat~'DNAT' && net.sysctl['net.ipv4.ip_forward']=1` (or the nft equivalent).
9. Packet scope: in a TLS 1.3 capture, find the server name and the number of the frame where it is visible. Answer: `server_name` in the ClientHello, frame N.
10. Scenario: nginx returns 504, and `error.log` has the line `upstream timed out (110: Connection timed out) while reading response header from upstream`. What does it mean, and what are the first two actions? Correct: "check how long the upstream takes to respond directly (`curl -w` from the proxy host)" and "look at the application's load and logs". Wrong, with explanations: "restart nginx", "raise `proxy_read_timeout` to 600s", "flush the DNS cache", "open the port in iptables".
11. Step 3: "Show only the ANSWER section of the response to `dig shop.lab`, together with the TTL". Only a link to `dig(1)` is given. Goal: the output contains a zone line and no line starting with `;;` (`dig +noall +answer`).
12. Why did `http://shop.example` open over HTTPS even though the server did not answer on port 80? Answer: the browser chose HTTPS itself, because of HSTS (remembered or from the built-in preload list) or because of the automatic HTTPS attempt (HTTPS-Upgrades).

## 5. Textbook: chapters by module

### 5.1. Anatomy of a chapter

A module chapter is 1,500–3,000 words of coherent text (the textbook style of 01 §7) and 6–14 screens. Each screen introduces at most one concept (`introduces`); the rest are in `uses`. A screen's kind is one of `story`, `mechanism`, `lab`, `check` (08 §4). The core knowledge can be read without a single click: controls and cards deepen it but do not hide it. The chapter's process explanation (section 7) sits in the middle and is built into the text rather than moved to the end. A lab comes after the text that explains it. Every new command at step 1 of the ladder has a "where this comes from" chip (section 14). A chapter ends with a quiz (section 16) and, where appropriate, a scenario.

That is about 150 screens for the block, which matches the estimate in 01 §13 (40–45 minutes per concept for a beginner, with practice).

### 5.2. Sample: chapter `net.m04` "Routing and ICMP" (11 screens)

1. `story` "The packet steps out of the subnet's door". In m02 the learner saw that `192.168.1.10/24` does not "see" `192.168.2.10/24`. Introduces: router. Diagram: two subnets and a Linux machine with two interfaces between them, with the label `ip_forward=1` on the box.
2. `mechanism` "Routing table". Introduces: routing table. A three-row table; clicking a row highlights the line the packet goes out on.
3. `mechanism` "Default gateway". Deepens the default route from L14. The control is the destination address; if no row matches, `default` fires. The puzzle from m03 is solved here: the host uses ARP to find the gateway's MAC.
4. `lab` `ip route`, `ip route get`. Add a route on `h1` (lab `n4-two-subnets`, 8.4.1).
5. `mechanism` "Longest prefix". Introduces: longest prefix match. The control is the destination address, with two overlapping rows; the selected one is highlighted with the explanation "/16 is longer than /8".
6. `mechanism` "What the router changes in a packet": the E-ROUTE explanation, screens 1–3 (7.4). Introduces: the MAC changes at every hop while the IPs stay the same.
7. `mechanism` "TTL". Introduces: TTL. A counter in the IP envelope decreases at every router; at zero the packet is dropped.
8. `mechanism` "ICMP: the network reports errors". Introduces: ICMP (echo, time exceeded, destination unreachable). Now the `ping` echo request gets its name. Labelled arrows return to the sender.
9. `lab` `ping`, `traceroute -n` along a chain of three routers: find the node without a route.
10. `check` "One-way ping": `breakit` "no route back", with a prediction before enabling it.
11. `check` m04 quiz.

All modules are laid out the same way. Below is the content of the chapters: the essence, what the learner does, the tier and the ladder step. Detailed process explanations are in section 7, labs in sections 8–9, scenarios in section 12.

### 5.3. Module content

#### net.m00. How the internet works
The chapter is built around the E-MAP explanation (7.1): a zoomable map from the laptop to the data centre. The text answers three questions. Who owns what: the internet is a network of independent networks (autonomous systems), each with its own number and its own addresses. How networks come to agreement: neighbouring ASes tell each other over BGP which addresses live with them, and they exchange traffic at internet exchange points (IXPs) or pay a transit operator. Why distance matters: light in optical fibre travels at about 200,000 km/s, roughly 5 µs per kilometre, so a reply from another continent cannot arrive faster than a few tens of milliseconds, and that is why CDNs exist. At the end of the chapter come the root DNS servers: 13 names `a`–`m.root-servers.net` and hundreds of sites behind them on the anycast principle (one address announced from many places, BGP leads to the nearest one). The postal metaphor remains a single sentence in the text ("a message, like a letter, has a recipient's address and a sender's address"); it is not in the picture. Task: in the lab, connect two laptops with a link and see that nothing goes out without addresses — the label on the line reads "no address — nowhere to send". For the experienced level, an external exercise on their own machine: `traceroute` to three sites with the AS labelled at each hop (via `whois -h whois.radb.net`) and their own provider's page on bgp.tools. Tier A. Ladder step 1: links to Cloudflare Learning "What is BGP", root-servers.org, submarinecablemap.com.

#### net.m01. Frame and MAC
The network card, a 48-bit MAC (`02:42:ac:11:00:02`). The Ethernet frame: destination MAC, source MAC, EtherType, data, checksum. A switch learns which MAC is behind which port and floods unknown destinations to all ports. Interactive: a switch with four hosts and an empty MAC table; the learner sends frames and watches the table fill up and the "flood to all ports" disappear. Tasks: predict which ports a frame will go out on given a table; find their host's MAC with `ip link`. Intermediate and experienced: the VLAN card (802.1Q tag, access and trunk) opens here. Tier A; on tier B, the same exercise on `vswitch`, whose MAC table is drawn on the diagram.

#### net.m02. IP address and subnet
Starts with recognition: `inet 10.0.2.15/24` from L14. Why a second address when there is a MAC: a MAC is the card's number and says nothing about where it is; an IP is an address by location, with a "network" part and a "host" part. Binary notation, the mask as a boundary, the `/24` prefix. Network address, broadcast, host range. Private ranges and `127.0.0.1`. IPv6: the format and `::1` for intermediate and experienced. The subnet drills start (10.1). Task: assign an address with `ip addr add 192.168.1.10/24 dev eth0` and check with `ping`, familiar from L14, that a neighbour in the same subnet replies while `192.168.2.10/24` does not (`connect: Network is unreachable`).

#### net.m03. ARP
A host knows the neighbour's IP, but the frame needs a MAC. The ARP request "who has `192.168.1.20`? tell `192.168.1.10`" goes out as a broadcast, and one host replies. The ARP cache. Interactive: clear the cache with `ip neigh flush all`, run `ping`, put a probe on the link and see an ARP pair before the first echo request (labelled "ping echo request, we will name the protocol in m04"). The module's puzzle: "Which device's MAC does a host look for if the destination is not in its subnet?" — solved in m04. Tier A; on tier B, for those who want it, the same on a real kernel with `tcpdump -e arp`.

#### net.m04. Routing and ICMP
Laid out in 5.2. The explanation is E-ROUTE (7.4). Tasks: (a) two subnets and a router — configure routes so that ping works in both directions; the "no route back" failure gives a one-way ping; (b) three routers in a chain — read `traceroute` and point to the node without a route; (c) experienced: overlapping prefixes, predict the path; (d) intermediate and experienced: "each node has its own subnet behind it — write the routes" (preparation for N23 and for host-gw mode in CNI). For the experienced level, an inset "OSPF: routers compute routes themselves" (a catalog card, idea only). Step 4 for the experienced level starts here: `ip rule` (14.5).

#### net.m05. Ports, UDP, TCP
Starts with recognition: `ss -ltnp` from L14 showed a PID. One IP, many programs; the port selects the process. UDP: send and forget. TCP: a connection — SYN, SYN-ACK, ACK; sequence and acknowledgement numbers; retransmission on loss; FIN to close; RST as "nobody is here". Socket states as `ss` prints them: `LISTEN`, `SYN-SENT`, `ESTAB`, `TIME-WAIT`. The client's ephemeral ports (in Linux `32768–60999`). The window and the bandwidth-delay product: the E-WIN explanation (7.6). The handshake explanation: E-TCPTLS, screen 1 (7.5). Tasks: `nc -l 9000` on one host, `nc 10.0.0.2 9000` from another, find the connection in `ss -tn` on both sides; connect to a closed port and see the RST in the capture; turn on the toggle "a filter on the server silently drops packets to 9000" and see SYN retries at intervals of 1, 2, 4, 8… seconds (simulated time) and the `SYN-SENT` state on the client.

#### net.m06. Envelopes: OSI and TCP/IP
The E-ENV explanation (7.2). Introduced here: MTU 1500, MSS 1460, header sizes (Ethernet 14 bytes, IPv4 20, TCP 20 without options, UDP 8), fragmentation and the DF flag. The OSI and TCP/IP models are introduced as a vocabulary: "a problem at L3" means "addresses and routes", "an L7 load balancer" means "it sees HTTP". For the beginner, mapping the layers to what they have already touched; for the experienced, payload-counting tasks. The NAT and tunnel screens of the same scene open in m09 and m14.

#### net.m07. DNS
Starts with recognition: `dig` and `/etc/resolv.conf` from L14. Names for people, addresses for machines. The hierarchy from right to left: the root `.`, the TLD `com.`, the zone `example.com.`. A recursive resolver (the provider's, `1.1.1.1`, `8.8.8.8` or a local one) versus an authoritative server. Delegation via NS and glue. QNAME minimisation: a modern resolver does not tell the root the full name (RFC 9156). Cache and TTL at every level, negative caching. Records A, AAAA, CNAME, MX, NS, TXT, PTR, CAA (the last one at step 4). The order on a host: `/etc/hosts`, then the server from `/etc/resolv.conf`; in general the order is set by `/etc/nsswitch.conf` (intermediate and experienced). `search` domains and `ndots`: how many names the resolver tries for a short name — what DNS inside the cluster will stand on two blocks from now (`forward: [K16]`). Response codes: NOERROR, NXDOMAIN, SERVFAIL, REFUSED. The E-DNS explanation (7.3). Tasks: `dig +trace` with an animation of the walk; change an A record on the authoritative server and see the old address on the client until the TTL expires; find the cause of a SERVFAIL (the authoritative server is unreachable); intermediate and experienced: a CNAME to a name in another zone, `search` domains and how they break short names (lab `m07-ndots`, 9.6). External exercise: Mess With DNS. On tier B, the same walk on the real `nsd` and `unbound` of the `lab-net` image.

#### net.m08. DHCP
How a host gets an address without knowing either its own address or the server: Discover as a broadcast from `0.0.0.0` to `255.255.255.255`, UDP ports 68 → 67; Offer; Request; Ack. The lease, renewal at half the term (T1) and rebind at 87.5% (T2), options 1 (mask), 3 (gateway), 6 (DNS server, already familiar from m07), 51 (lease time). If no server answers, `dhcpcd` assigns a link-local address `169.254.x.x`. The client: in the labs, `dhcpcd` (in Debian 13 it became the default client for new installations, replacing ISC `dhclient`, which is no longer supported); for recognition, `dhclient` (older systems) and `networkctl status` with `journalctl -u systemd-networkd` (Ubuntu 24.04) are shown. The E-DHCP explanation (7.7). Tasks: a laptop connects to a home router, the learner runs `dhcpcd eth0` and finds all four messages and options 3 and 6 in the capture; the failure "two DHCP servers on the network" — the laptop gets someone else's gateway and has no internet.

#### net.m09. NAT
Private addresses are not routed on the internet. A home router replaces the source address with its public one and remembers the mapping in the conntrack table in order to return the reply. Masquerade versus SNAT to a fixed address. DNAT: forwarding a port inward. Why you cannot connect from outside to a laptop behind NAT. CGNAT `100.64.0.0/10` (the switch was already on the m00 map). SNAT port exhaustion: why a cloud NAT gateway refuses new connections. The E-ROUTE explanation, screens 4–6 "NAT", and screen 4 of E-ENV (it opens here). Tasks: internet access for a subnet through `gw`; port forwarding; `conntrack -L` and find the entry for your own connection. I and E: tier B, the same tasks on a real kernel.

#### net.m10. Netfilter: iptables and nftables
Kernel hooks and the packet's path: the E-NF explanation (7.8). The filter and nat tables (for intermediate and experienced also raw and mangle), chains, rules from top to bottom, the default policy, ACCEPT, DROP, REJECT, `-m conntrack --ctstate ESTABLISHED,RELATED`. `ip_forward`. The `nat OUTPUT` chain: a packet born on the same host does not pass through PREROUTING, so `curl 127.0.0.1:8080` on a router with port forwarding does not work until the DNAT is duplicated in `nat OUTPUT` (this is what Docker and kube-proxy do; for the experienced, a footnote about `net.ipv4.conf.all.route_localnet`). User-defined chains, `-j` jumps and `RETURN`, `-m statistic --mode random --probability` for distribution across backends: the D-NF drill (10.2) and the `n10-chains` lab (below). nftables as the modern replacement: the same hook model, one syntax, `nft list ruleset`, sets and maps (`set`, `map`, `vmap`); in modern distributions iptables often runs on top of nftables (`iptables-nft`). The beginner does filter/INPUT only: allow SSH and HTTP, deny the rest and do not lock yourself out (locking yourself out is possible; the device console stays available as "IPMI"). I and E tasks: a firewall on the router with a DROP policy in FORWARD; find out why replies do not come back (the established rule was forgotten); convert a set of iptables rules to nftables; "forwarding 8080 → 10.0.2.20:80 works from outside but not from `gw` itself; fix it" (goal: `reach.gw_local.status=200 && net.iptables.nat~'-A OUTPUT.*DNAT'` or the nft equivalent).

The `n10-chains` lab (I, E) prepares for the Kubernetes Service without Kubernetes terms. `lb` already has these rules:
```
-A PREROUTING -d 10.96.0.10/32 -p tcp --dport 80 -j SVC-WEB
-A SVC-WEB -m statistic --mode random --probability 0.50000000000 -j SEP-A
-A SVC-WEB -j SEP-B
-A SEP-A -p tcp -j DNAT --to-destination 10.0.2.21:8080
-A SEP-B -p tcp -j DNAT --to-destination 10.0.2.22:8080
```
Task: (1) send 20 requests `curl http://10.96.0.10` from `client` and, using the `iptables -t nat -L -v` counters, say how many went to each branch; (2) the address `10.96.0.10` is not on any interface (`ip a` on all devices) — explain why the request still gets a reply. Check: (1) the number matches the counter fact; (2) `explain` against the rubric "DNAT fires in PREROUTING before the routing decision; the address exists only in the rule". In the Kubernetes block (K4) the same exercise is repeated on a node with the names `KUBE-SVC-…`/`KUBE-SEP-…` and the label "you already did this in m10".

#### net.m11. HTTP
Starts with recognition: `curl -v` from L14. A text protocol over TCP: request line, headers, empty line, body. `Host` and why there are many sites on one IP. Codes: 2xx, 3xx (301, 302, 304, 308), 4xx (400, 401, 403, 404, 429), 5xx (500, 502, 503, 504). Keep-alive. HTTP/2 and HTTP/3 for intermediate and experienced as one screen and catalog cards: binary HEADERS/DATA frames with the pseudo-headers `:method`, `:path`, `:authority`, multiplexing, QUIC over UDP. Tasks: `curl -v` and annotate every line of the output; write a request by hand through `nc` and get a response.

#### net.m12. TLS, HTTPS and SSH
Why: on open Wi-Fi the "Wi-Fi neighbours" lens sees all of HTTP. A key pair, a certificate as "a public key signed by someone the browser trusts", the chain up to a root CA. The TLS 1.3 handshake in one round trip: ClientHello (versions, SNI, ALPN, key_share), ServerHello, then the encrypted EncryptedExtensions, Certificate, CertificateVerify, Finished. In key_share a modern browser offers the hybrid post-quantum exchange `X25519MLKEM768` together with `x25519` (a footnote for the experienced). SNI is visible to an observer (ECH for the experienced). The E-TCPTLS explanation (7.5). A separate screen "SSH: a second encrypted channel": the learner knows SSH from L15; here they see that SSH follows the same logic (key exchange, server key verification — only instead of a CA chain there is a fingerprint in `known_hosts` — then client authentication), and that `Host key verification failed` is the analogue of a certificate error. Tasks: `openssl s_client -connect site.lab:443 -servername site.lab`, find the certificate's validity period and issuer; failures: an expired certificate, a certificate for another name, an incomplete chain — each gives its own `curl` error, and the learner matches error to cause; `ssh -v` to a training server — find the key exchange and the host key check in the output.

#### net.m13. Proxies, load balancers, CDN
Forward proxy (on the client side) and reverse proxy (in front of the server). nginx as a reverse proxy: `proxy_pass`, `upstream`, `proxy_connect_timeout` and `proxy_read_timeout` (both 60 s by default), the `X-Forwarded-For` and `X-Forwarded-Proto` headers. The `Default:` line in the nginx documentation is the first thing this module teaches at step 2 (14.3). An L4 load balancer (sees only addresses and ports: HAProxy in `mode tcp` or a cloud TCP load balancer) versus L7 (sees HTTP, routes by path and headers). Round robin and least connections algorithms.

The key mechanism of the module is what nginx does when a backend does not respond. By default `proxy_next_upstream error timeout` applies: on a connection error or timeout nginx retries the request on the next server in the group, and `proxy_next_upstream_tries 0` and `proxy_next_upstream_timeout 0` do not limit the number of retries. Each `server` in an `upstream` has `max_fails=1` and `fail_timeout=10s` by default: one failure, and the server is considered unavailable for 10 seconds, after which nginx tries it again. This is passive health checking; nginx OSS has no active checking (`health_check`), that directive belongs to the commercial version. An HTTP 500 response from a backend is not considered an upstream error and goes to the client as is. A request with a non-idempotent method (POST, PATCH, LOCK) that has already been sent to a backend is not retried on the next server without the `non_idempotent` parameter. This leads to the E-504 explanation (7.9) and scenarios T1, T2, T12.

CDN: an edge node closer to the user, caching by `Cache-Control`, hit and miss. Tasks: put nginx in front of two backends and see the responses alternate (`$upstream_addr` in `access.log`); switch off `app2` — the client still gets 200, and `error.log` has the line `connect() failed (111: Connection refused) while connecting to upstream`; explain who saved the request (`proxy_next_upstream`); set `proxy_next_upstream off` and repeat — now every second request gets a 502; restore the setting and explain why retries for POST are more cautious by default. Find the real client IP in the backend's logs.

#### net.m14. VPN and WireGuard
A tunnel: a whole IP packet is put into a UDP datagram and again into IP — an envelope in an envelope (screen 5 of E-ENV opens here). WireGuard: the `wg0` interface, a key pair, `[Peer]`, `PublicKey`, `Endpoint`, `AllowedIPs` as both a routing table and a source filter, UDP 51820 (by convention), MTU 1420 by default in `wg-quick`, and why: 20 IP + 8 UDP + 32 WireGuard = 60 bytes for IPv4, with headroom for IPv6 (80 bytes). The IPsec and WireGuard catalog cards open here. Tasks: connect two offices with a tunnel; give VPN clients internet access through the server (masquerade forgotten — no internet); an MTU failure (scenario T8). The link to the pet project from the checklist: "a VPN server on a VPS — WireGuard, iptables". Intermediate and experienced: tier B, real `wg` between two `lab-net` machines; errors such as swapped keys happen on their own and do not need to be modelled. Beginner: tier A, the concept of a tunnel and one lab.

#### net.m15. Networks inside a single kernel
The most important module for the following blocks. Until now each host in a lab was a separate machine. On a server with Docker or on a Kubernetes node there are dozens of "hosts" and one machine. The kernel can hold many independent network stacks: each has its own interfaces, addresses, routes, ARP cache, netfilter rules, conntrack table and sockets. They are connected by virtual cables (veth) and virtual switches (bridges). Everything the learner did in m01–m14 is repeated inside one kernel with the same commands. The concept of a namespace was already introduced in the Linux block (R6, `unshare`, `/proc/<pid>/ns`, `lsns`); here we populate it. The E-NS explanation (7.11).

The flow of the chapter (each step is a `split` screen "terminal + diagram"; the diagram is built from `ip -j link` events from the v86 agent or from netlab events):
1. A network stack is a set of tables. `ip netns add red`, `ip netns exec red ip a`: inside there is only `lo`, and it is DOWN. Introduces N21.
2. veth is a cable with ends in different stacks. `ip link add veth-red type veth peer name veth-red-br`, `ip link set veth-red netns red`. Clicking an end shows `ip -d link` with `link-netns`; the `@ifN` number links the ends. Introduces N20 (veth).
3. A bridge is the switch from m01, only in the kernel. `ip link add br0 type bridge`, `ip link set veth-red-br master br0`, the same for `blue`; addresses `10.10.0.2/24` and `10.10.0.3/24`; `ip netns exec red ping 10.10.0.3`. A probe on `br0` shows ARP; `bridge fdb show br br0` prints the MAC table. Introduces N20 (bridge).
4. Going outside: the address `10.10.0.1/24` on `br0`, a default route in the stacks, `ip_forward=1`, `iptables -t nat -A POSTROUTING -s 10.10.0.0/24 ! -o br0 -j MASQUERADE`.
5. Forwarding a port inward: `DNAT` in PREROUTING and in OUTPUT to `10.10.0.2:80`, `nc -l -p 80` in `red`, `curl` from a neighbouring machine.
6. A namespace without a network: only `lo` — `curl` gives `Could not resolve host`, `ping 10.10.0.1` gives `Network is unreachable`; layer L3, there is neither an interface nor a route.
7. Its own `/etc/resolv.conf` for a namespace: `ip netns exec` substitutes `/etc/netns/red/resolv.conf`. Label: "this is how container environments substitute their own DNS; you will see it in the containers block" (`forward: [D20]`).
8. Two machines without NAT: on `node1` the stacks are in `10.42.0.0/24`, on `node2` in `10.42.1.0/24`; a route `10.42.1.0/24 via <node2 IP>` and back. It works when the nodes are in one L2 segment. Introduces N23.
9. VXLAN, when there is no direct route: a whole Ethernet frame in UDP with port 4789 (IANA; Linux without an explicit `dstport` uses 8472, which flannel and Cilium also take by default), an 8-byte header with a 24-bit VNI. The overhead on IPv4 is 50 bytes, hence MTU 1450 inside. Comparison with WireGuard: the same envelope-in-envelope idea, but without encryption. Introduces N22.
10. Summary, "recognise it?": next to the learner's diagram, a Docker diagram (`br0` ↔ `docker0`, `10.10.0.0/24` ↔ `172.17.0.0/16`, DNAT ↔ the `DOCKER` chain) and a Kubernetes node diagram (`cni0`, a route or VXLAN to the neighbouring node). The terms "container" and "pod" are marked `forward:`.
11. Experienced only: rules do not have to live in netfilter. An eBPF program on the tc or XDP hook decides a packet's fate before netfilter, which is why on a node with Cilium and without kube-proxy `iptables-save` is almost empty while services work. Introduces N24, `forward: [K26]`.

The m15 quiz: `match` "`ip netns`, veth, bridge, VXLAN" ↔ "a separate stack", "a cable between stacks", "a switch in the kernel", "a frame in UDP between machines"; `choice` "does a packet from `red` to `blue` through `br0` pass through the host's FORWARD?" — by default no, this is L2 inside the bridge; yes if `br_netfilter` is loaded and `net.bridge.bridge-nf-call-iptables=1` (intermediate and experienced, with an explanation of why Kubernetes requires this module); `fill` "VXLAN overhead over IPv4" — 50; `predict` "the route on `node2` was deleted — what will `ping` from `node1` show and what will be in the capture on `node2`" (requests arrive, replies go out to the default gateway).

Labs are in 9.6. Tier: the beginner does the chapter on tier A (in netlab, `host(kind: 'netns')`) and one lab on tier B if the device can handle it; intermediate and experienced do everything on tier B.

#### net.m16. Troubleshooting and assembly
The method: the first question is which layer broke and how to prove it. Then we go bottom-up (link → address → route → port → DNS → TLS → HTTP) or top-down from the symptom, but we confirm every step with a command and never change two parameters at once. The table "symptom — what it means at the packet level":

| Symptom | What it is in packets | Layer |
|---|---|---|
| `curl: (7) Failed to connect to … port 8080 after 0 ms: Couldn't connect to server`; in `curl -v` the line `connect to … failed: Connection refused` | the host replied with RST or ICMP port unreachable: it is alive, the port is closed. Code 7 means "could not get through"; read the cause in `-v`, `nc -v` or `ss` | L4 |
| `curl: (28) Failed to connect to … after 10002 ms: Timeout was reached` (with `--connect-timeout`) or `curl: (28) Connection timed out after 10002 milliseconds` (with `-m`) | no reply at all: DROP, no route, the host is off | L3/L4 |
| `No route to host` | ICMP host unreachable or ARP with no reply | L2/L3 |
| `connect: Network is unreachable` | the kernel has no suitable route, the packet was never born | L3 |
| `Could not resolve host` | DNS | L7 (DNS) |
| certificate error `curl: (60)` | TLS | TLS |
| 502 | the proxy got a refusal, a dropped connection or garbage from the upstream | L7 |
| 504 | the proxy timed out waiting for the upstream | L7 |

The exact text of curl messages depends on the version and the flag; the reference is the output on the `lab-net` image captured as a "golden recording" (9.7). The lines above were checked against curl 8.7.1.

The module ends with assembly: the URL explanation (7.10) is walked without fog and in "break it" mode, followed by the scenarios of section 12.

## 6. Visual language and shared components

The block takes typography, palette, terminal and primitives from 08 and does not create its own.

- **Blueprint, not ink.** The topology canvas is an SVG blueprint following 08 §5: 1.5 px lines, 6 px corner radius, 8 px grid, value labels in IBM Plex Mono 12–13 px, node labels in Inter 14 px semibold (fonts: 08 §6.4). A link appears with a smooth `stroke-dashoffset` over 200 ms, without "hand drawing". Devices are rectangles with a 16 px role icon and a label; addresses are labelled on the link at the interface end (`eth0 10.0.1.10/24`), not inside the box. The network is drawn left to right from client to server, the layers vertically, L7 on top (08 §5.3). There are no ink drawings, characters, plot or metaphorical scenes in the block: "a sheet on the desk", "the network as the post office", "the resolver asks for directions" are replaced with boxes and arrows (R4, R5).
- **Colour by layer, protocol by label.** Tokens `--c-l2` (`#64748B`), `--c-l3` (`#0369A1`), `--c-l4` (`#047857`), TLS (`#A16207`), `--c-l7` (`#9333EA`) from 08 §5.2. An envelope in flight is coloured by its topmost meaningful layer (ARP and VLAN are L2, ICMP is L3, TCP without data and UDP are L4, a TLS record is TLS, HTTP and DNS are L7) and is always labelled with text (`ARP`, `SYN`, `DNS A?`). A dropped packet is a ⨯ labelled `DROP` in `--c-err`, never colour alone. The same palette is used in the E-ENV envelopes, in the scenario layer stack, on the catalog card badges, in the packet scope and in the 08 §3.6 animator. A network namespace on the m15 diagrams is a `--c-ns-net` (`#0E7490`) frame with a `net` tag, as in the Linux and containers blocks.
- **Labels on lines.** Every arrow is labelled with what travels along it (`SYN seq=0`, `A? shop.example`, `10.0.1.0/24`); every element is clickable and opens a card "what it is / who creates it / which command shows it / where it is in the documentation".
- **The packet model** `Packet` is one format for the simulator, `vswitch`, animations, the packet scope and pcap export (15.1).
- **The packet inspector** has three views: envelopes, field tree, hex; a selection is synchronised across all three.
- **The terminal** is the 08 §3.4 widget (xterm.js), with the theme and font shared with the course; one terminal per device, in tabs.
- **Explanation primitives**: `stepper` (08 §3.1), `diagram` (3.2), `split` (3.3), `breakit` (3.5), `packets` (3.6), `quiz` (3.8), `lenses` (3.11).

From the Sankofa engine the block takes the magazine-text presentation and the mechanics, but not the graphics:
- scene scrolling (`engine/scroll.ts`): scene progress 0..1 drives the stepper step in the leading scene; if the learner grabs the stepper slider, the link to scrolling is released until they leave the scene (08 §3.1);
- layers (`engine/layers.ts`) for envelopes: each header is a layer that appears on its step;
- calm mode (`engine/calm.ts`): with `prefers-reduced-motion`, transitions are instant, continuous playback is off, and everything is reachable with "back/forward" buttons;
- lenses (`Lens`): the same scene through the eyes of different observers. In networking this is an exact fit: a packet on the Wi-Fi link, after NAT, inside a tunnel and on the server looks different. Lenses: "client", "Wi-Fi neighbours", "provider", "NAT router", "server", "CDN". An empty lens is for someone who sees nothing: "the provider does not see HTTPS content — only the IP, port and SNI";
- bilingual YAML scenes (`Bi {en, ru}`), `draft/hold` flags: a statement with a number (a default timeout, a port, a header size, the text of a browser error) gets `check:` with a link to an RFC or official documentation and a second source or a "golden recording"; without them the block stays `hold` and is not published;
- QR handoff to a phone (`engine/qr.ts`, limit 213 bytes, 08 §3.9): the QR carries only the lesson, the mode (`drill=D1…D9`), the generator seed and the difficulty level. The review deck is not transferred to the phone via QR: it is synchronised through the account (09 §3.4) or an export file (09 §3.3).

Sound is off in the block and no toggle is offered: in network explanations it carries no meaning. This is a local decision of the block; 08 allows sound but does not require it.

## 7. Process explanations

### 7.0. General rules

An explanation is a step-by-step diagram of a process, not a video and not a cartoon (R3, R4). Animation is functional only: an envelope moves along a line, a layer appears, a counter grows. One screen, one idea. Everything below is mandatory for every explanation in the block:

- a step bar at the bottom (`stepper`): ←/→ for one step, pause, playback at 0.25× / 1× / 4×, a time slider; the diagram's state at step `t` is computed by folding events, so rewinding does not "undo" anything;
- every element is clickable: a box, an arrow, an envelope field, a table row opens a card "what it is / who creates it / which command shows it / a link to the exact place in the documentation" (the last one is step 1 of the ladder);
- controls (sliders and switches) change parameters; the process is recomputed immediately, changed steps are highlighted, and a line "what changed and why" appears on the right;
- "break it" (`breakit`) removes a component or switches on a fault; before switching it on, the learner picks a prediction ("what will break?"), which is a mini check of understanding (08 §3.5);
- the source of the steps is a deterministic netlab scenario; where it makes sense, there is a "play on real machines" button (tier B, the same events from `vswitch`);
- every explanation is registered as `content/net/explainers/<id>.steps.yaml` in the 08 §7.6 format and has `introduces: []` if it only assembles what has already been introduced.

| id | Explanation | Module | Key controls |
|---|---|---|---|
| E-MAP | How the internet works | m00 | zoom, CGNAT, peering via IXP, CDN, anycast, distance |
| E-ENV | OSI and TCP/IP envelopes | m06 (+m09, m14) | 7/4 model, device on the path, data size, DF |
| E-DNS | How a name becomes an address | m07 | TTL, time of the second query, QNAME minimisation, `/etc/hosts`, `search`/`ndots` |
| E-ROUTE | A packet through a router and NAT | m04, m09 | TTL, NAT, ip_forward, route back, number of devices, conntrack timeout |
| E-TCPTLS | The TCP and TLS handshake | m05, m12 | RTT, loss, TLS 1.2/1.3, keep-alive, 0-RTT, HTTP/3 |
| E-WIN | TCP window and throughput | m05 | window, RTT, bandwidth, loss, window scaling |
| E-DHCP | How a laptop gets an address | m08 | lease time, a second server, server switched off |
| E-NF | A packet's path through netfilter | m10 | packet direction, rule order, established, policy |
| E-504 | Where 504 and 502 come from | m13, m16 | database delay, timeouts, number of backends, `proxy_next_upstream`, method |
| E-URL | What happens when you type a URL | m00–m16 | caches, keep-alive, HTTP version, DoH, ECH, RTT, TTL |
| E-NS | A packet between stacks of one kernel and between machines | m15 | `br_netfilter`, how nodes are connected, stack MTU |

### 7.1. E-MAP. How the internet works (m00)

A zoomable map with discrete zoom levels: the wheel, a pinch or the level strip on the left change the scale; this is not infinite zoom, each level has its own screen and its own idea.

1. **Flat.** Two boxes, "laptop" and "home router", and a line labelled `Wi-Fi 192.168.1.0/24`. Clicking the router: "this box holds three devices: a switch, a router, an access point; the router has two addresses — internal `192.168.1.1` and external `203.0.113.7`; why — in m09". Only the laptop → router envelope moves.
2. **City.** From the router, a line `fibre 1 Gbit/s` to the box "provider, AS 64500". The provider has several other customers. Clicking the AS label: "an autonomous system is a network under one administration with its own number and its own addresses". The **CGNAT** switch: the label on the line changes to "the provider's shared address `100.64.0.0/10`", with the explanation next to it: "your router is itself behind the provider's NAT: an incoming connection to you is impossible even with port forwarding".
3. **Country.** Three ASes (64500, 64501, 64502) and an IXP box with an example label (MSK-IX, DE-CIX). Lines of two kinds labelled "peering via IXP" and "transit (paid)". The **peering via IXP on/off** switch: without the IXP, the path to the neighbouring provider goes through a transit operator and the delay counter grows (2 ms versus 38 ms on the diagram), with the explanation "an IXP exists so that neighbouring networks do not carry traffic to each other through another country". The **show BGP** switch: announcements appear on the lines, "AS 64501: `198.51.100.0/24` via me". "Break it": "AS 64502 mistakenly announced someone else's prefix" — the path is recomputed and goes the wrong way, with the explanation "this is what a route leak looks like: the neighbours believed the announcement; more in the BGP card".
4. **World.** A schematic map (continent outlines as 1 px lines) and 5–6 real cables with their names (from the open data of the TeleGeography Submarine Cable Map, with `check:`). The **distance** slider recomputes the counter "minimum one-way delay" = distance × 5 µs/km: Moscow — Frankfurt ≈ 2,000 km ≈ 10 ms, Moscow — New York ≈ 7,500 km ≈ 37 ms; RTT is twice that, not counting equipment. Explanation: "light in fibre cannot be sped up; that is why CDNs exist". "Break it": cut a cable — the path is rebuilt through another one, the delay grows, labelled "the neighbouring ASes rebuilt the routes via BGP".
5. **Building.** The "data centre" box expands: border router → switch → load balancer → servers. Label: "this is where the site lives; we will build this part later in the course".
6. **CDN.** The same site with copies at the network edge in three cities. The **where the user is** slider moves a point, the nearest CDN node is highlighted, and a counter shows "RTT to the copy / to the origin" (3 ms versus 80 ms). The **CDN on/off** switch recomputes the counter "requests to the origin".
7. **Root DNS servers.** 13 names `a`–`m.root-servers.net`, hundreds of points on the map. The **show instances** switch explains anycast: "one address is announced from many places, and BGP leads you to the nearest one". DNS in detail: m07.
8. **Assembly.** The whole path from the laptop to the data centre as one line; on each segment a label for the segment and for who controls it (you, the provider, the IXP, the backbone operator, the data centre). The last line: "next we go inside: what exactly travels along this line" → m01.

Checks: `order` "segments of the path from the laptop to the data centre"; `hotspot` "where your packet first enters someone else's AS"; `predict` "the IXP was switched off — will the delay go up or down?"; `choice` "why a ping to another continent cannot be 5 ms"; `match` "AS, IXP, CDN, root server" ↔ purpose.

### 7.2. E-ENV. Envelopes: the OSI and TCP/IP models (m06; screen 4 — m09, screen 5 — m14)

1. **Sending.** A block of monospace text `GET /catalog HTTP/1.1\r\nHost: shop.example\r\n\r\n` labelled "the variant without TLS (`http://`), so the text is visible". Step by step, nested header rectangles with fields appear around it, with the layer name on the top bar of each envelope in the layer's colour. TCP: `Source Port 51234`, `Destination Port 80`, `Sequence Number`, `Acknowledgment Number`, `Flags PSH,ACK`, `Window`, `Checksum`. On hover, each field explains where its value came from ("51234 is an ephemeral port assigned by the kernel on `connect()`"). IPv4: `Version 4`, `IHL 5`, `Total Length`, `TTL 64`, `Protocol 6 (TCP)`, `Source 192.168.1.23`, `Destination 198.51.100.20`, `Header Checksum`. Ethernet: `Destination MAC` (the gateway's, not the server's — a reference back to m03/m04), `Source MAC`, `EtherType 0x0800`, and `FCS` at the tail. The last step is bits on the line. On the right, a hex dump grows in sync: each new envelope adds bytes at the front (and the FCS at the back), and selecting a field highlights its bytes. At the bottom a counter: "payload 45 bytes, headers 54 bytes (14 + 20 + 20, without FCS)" — we will come back to it with MTU.
2. **Two models.** The **OSI (7) / TCP/IP (4)** switch: the envelopes stay in place, the layer labels change. In OSI layers 5 and 6 appear with an honest label: "on the internet there are no separate envelopes for them: session management and data presentation live inside the application and TLS". Clicking a layer opens the vocabulary: "a problem at L3" means addresses and routes; "an L4 load balancer" sees ports; "L7" sees HTTP.
3. **Path through a router.** The **device on the path: switch / router** switch. A switch opens only the Ethernet envelope and looks at the destination MAC. A router removes the Ethernet envelope, reads `Destination` in IP, consults the routing table (the matching row is highlighted), decrements TTL 64 → 63, recomputes the `Header Checksum` and puts on a **new** Ethernet envelope with different MACs. The router does not open TCP or the data. The "before/after" lens shows two versions of the packet side by side with the differences highlighted.
4. **Path through NAT** (`gate: [net.m09]`). The same, but the router changes `Source IP` and `Source Port`, recomputes both checksums (IP and TCP: the TCP checksum is computed over a pseudo-header that includes the IP addresses; for the experienced, a footnote with RFC 9293) and writes a row into the conntrack table, which is shown next to it.
5. **Tunnel** (`gate: [net.m14]`). The **WireGuard / VXLAN** switch (VXLAN: `gate: [net.m15]`). WireGuard: the whole IP packet from screen 1 goes inside (encrypted), with a WireGuard header on top (`type 4`, `receiver index`, `counter`), UDP `51820`, a new IP with the tunnel endpoint addresses and a new Ethernet. The header counter grows by 60 bytes for IPv4 (20 IP + 8 UDP + 32 WireGuard), hence MTU 1420 with headroom for IPv6 (80 bytes). VXLAN: the whole Ethernet frame goes inside, with 8 bytes of VXLAN with the VNI on top, UDP 4789, IP, Ethernet — plus 50 bytes. The numbers are checked against the WireGuard whitepaper and RFC 7348 and marked `check:`.
6. **A packet that is too big.** The **data size** slider; when the frame exceeds MTU 1500, with **DF=0** the packet is cut into fragments, with **DF=1** the router replies with ICMP "Fragmentation Needed" stating the MTU. In tunnel mode (after m14) the **ICMP filtered** switch turns the second variant into a "black hole": small packets get through, large ones disappear without a reply — a bridge to scenario T8. The explanation on switching: "the sender never learned about the smaller MTU: the message that was supposed to tell it was thrown away on the way".

Exercises:
- "Build a packet": drag shuffled envelopes into nesting order. Beginner: for `ping` (ICMP → IP → Ethernet); intermediate and experienced: for a DNS query (DNS → UDP → IP → Ethernet).
- "Fill in the fields": host `10.0.0.5` with MAC `02:00:00:00:00:05` requests `http://10.0.1.80/` via gateway `10.0.0.1` with MAC `02:00:00:00:00:01`; fill in the destination MAC, destination IP, destination port and protocol. The error "the server's MAC instead of the gateway's MAC" gets its own explanation.
- "What changed": two hex strings of the same packet before and after a device; click the bytes that changed and name the device (switch / router without NAT / NAT).
- Experienced: "Count the payload": MTU 1420 inside a tunnel, TCP with the timestamps option (12 bytes) — what is the MSS? Answer: the announced MSS is 1380 (1420 − 20 − 20); the actual data in a segment with timestamps is 1368 bytes.

### 7.3. E-DNS. How a name becomes an address (m07)

1. **Participants.** Boxes from left to right: application → OS stub resolver (`/etc/hosts`, `/etc/resolv.conf`) → recursive resolver → root `.` → TLD `example.` → authoritative server of the `shop.example` zone. Each box has a role label and an address. Clicking the stub: "this is a library inside your program, not a separate server; it reads `/etc/nsswitch.conf`, `/etc/hosts`, `/etc/resolv.conf`".
2. **Query.** Eight arrows step by step, each with a real line: `A? shop.example RD=1` (application → resolver); `A? example.` or `NS? example.` (resolver → root, with minimisation enabled); the root's answer `NS a.nic.example. (glue 192.0.2.53)` labelled "not an answer, but a direction"; a query to the TLD; the authoritative answer `A 198.51.100.20 TTL 300 AA`. Next to it, the output of `dig +trace` grows line by line.
3. **Cache.** The **time of the second query** slider, 0…600 s. At t < TTL the path is 2 arrows, and the resolver has a tag "from cache, 300 − t s left"; at t ≥ TTL it is the full path again. The **record TTL** slider, 30 s … 1 day. The **OS stub resolver cache (systemd-resolved)** switch. The **negative TTL** slider (SOA minimum) for NXDOMAIN.
4. **Switches.** **QNAME minimisation**: the root and the TLD receive only the part of the name they need (RFC 9156); switching it off shows that without it the root learns the full name. **`/etc/hosts` contains the name**: the path stops at the second box, labelled "`getent hosts` will see the entry, `dig` will not: `dig` queries the server directly". **`search` + `ndots`** (intermediate and experienced): `/etc/resolv.conf` has `search a.lab lab` and `options ndots:5`; for the name `api.example.com` (two dots, fewer than five) the resolver first tries `api.example.com.a.lab`, `api.example.com.lab`, then the absolute name — the diagram shows three extra walks and three NXDOMAIN answers; the **trailing dot in the name** switch removes the extra ones. The "queries on the link" counter takes into account that `curl` asks for A and AAAA by default.
5. **Break it.** "The authoritative server does not answer": a timer spins at the resolver, then `SERVFAIL`. "A typo in the TLD" (`shop.exmaple`): the **root** answers NXDOMAIN — there is no such TLD; negative caching next to it. "A typo in the name" (`shpo.example`): the authoritative server of the `example.` zone answers NXDOMAIN. "A wrong A record": the address belongs to someone else, `curl` goes to the wrong place. "The resolver is unreachable": `;; connection timed out; no servers could be reached`.
6. **Recomputation with explanation (examples).** "TTL 300 s, 120 s have passed: the resolver answered from cache in 1 ms; the authoritative server never learned about this query". "TTL 300 → 86,400: after the address changes, users of this resolver will go to the old address for up to a day — this is scenario T5".

Checks: `predict` "after 400 s with TTL 300, how many arrows?" (the full path); `fill` "how many names will the resolver try for `api.example.com` with `ndots:5` and two `search` domains" (3); `choice` "who answered NXDOMAIN to `shop.exmaple`" (the root).

### 7.4. E-ROUTE. A packet through a router and NAT (m04; screens 4–6 — m09)

1. **Diagram.** `h1` — `r1` — `h2`; the subnets `10.0.1.0/24` and `10.0.2.0/24` are labelled on the lines. The routing table of `r1` is next to it.
2. **Before the router.** An envelope travels `h1 → r1`. Clicking the envelope opens the fields; the destination MAC is marked "MAC of `r1`, not `h2`".
3. **On the router.** The Ethernet envelope is removed, `ip.dst` is read, the selected table row is highlighted (longest prefix match), TTL 64 → 63, the checksum is recomputed, a new Ethernet envelope. "Before/after" fields side by side, with changes highlighted. The **TTL** slider 1…64: at TTL = 1 `r1` replies with ICMP Time Exceeded, and a `traceroute` line appears next to it — that is exactly how it works. The **ip_forward** switch: when off, the packet is absorbed at `r1`, with the counter "dropped: forwarding disabled". The **route back on `h2`** switch: when off, the request arrives, the reply goes to `h2`'s default gateway, and ping works one way.
4. **NAT** (`gate: [net.m09]`). The **NAT** switch on `r1`: `ip.src` and the port change, both checksums are recomputed, a row appears in the conntrack table on the diagram; the return packet is rewritten back. Explanation: "You enabled NAT. Now `h2` sees the source `10.0.2.1:40001`, not `10.0.1.10:51234`. To return the reply, `r1` recorded the mapping in conntrack". The **no NAT to the internet** switch: only the MAC and TTL change, the reply from the internet to `192.168.1.23` finds no way back — a red ⨯ labelled "a private address is not routed on the internet".
5. **Many devices.** The **devices at home** slider 1…50: the conntrack table grows, each row has its own external port. The **external IPs: 1 / 4** switch. The **UDP conntrack timeout** slider 30…180 s: if the DNS reply arrives later, it is dropped — "the entry has already been forgotten".
6. **Break it.** "Exhaust the ports": a slider of connections up to 65,000 to one destination address from one external IP — new connections are refused, with the explanation "this is what SNAT port exhaustion looks like in a cloud NAT gateway". "Remove `r1`": after three unanswered ARPs, `h1` gets `Destination Host Unreachable` from itself. "Remove the default route on `h1`": `connect: Network is unreachable`, the packet is never born.

Checks: `hotspot` "where the client's address is last seen as `192.168.1.23`"; `predict` for each "break it" switch.

### 7.5. E-TCPTLS. The TCP and TLS handshake (m05; screens 2–4 — m12)

A sequence diagram: two verticals (client, server), time from top to bottom, the distance between messages proportional to RTT, arrows labelled with fields.

1. **TCP.** SYN (`seq=x`, `mss 1460, sackOK, TS, wscale 7`), SYN-ACK (`seq=y ack=x+1`), ACK. Counter "RTTs elapsed: 1". Clicking an arrow opens the packet in the inspector. The **port closed** switch: SYN → RST, result "refused in 1 RTT", with a pair of curl lines next to it (`connect to … failed: Connection refused` in `-v` and `(7) … Couldn't connect to server`). The **filter silently drops** switch (`forward: N17` until m10): SYN, SYN, SYN… at intervals of 1, 2, 4, 8 s, the counter goes up to ~127 s with `tcp_syn_retries=6` (simulated time), client state `SYN-SENT`. The **loss** slider 0…30%: a lost segment is crossed out, the retransmission arrives after the RTO.
2. **TLS 1.3** (`gate: [net.m12]`). ClientHello (SNI, ALPN, key_share with `X25519MLKEM768` and `x25519`) → ServerHello + {EncryptedExtensions, Certificate, CertificateVerify, Finished} → {Finished} + the first HTTP request. The encrypted parts are hatched and labelled "visible only to the endpoints". Counter "until the first byte of the response: 3 RTT" (1 TCP + 1 TLS + 1 request).
3. **Controls.** The **RTT** slider 1…300 ms: the arrows stretch, TTFB is recomputed. Explanation: "RTT 150 ms (Moscow — Singapore): 450 ms to the first byte, of which 300 ms are handshakes". Switches: **TLS 1.2** (an extra round trip); **reused connection / keep-alive** (no handshakes); **0-RTT** (for the experienced: data in the first flight, marked "the request can be replayed by someone else — replay risk"); **HTTP/3** (QUIC over UDP: transport and TLS in one exchange, 1 RTT before the request).
4. **Break it.** "Expired certificate": the client sends an alert, the connection is closed, the line `curl: (60) SSL certificate problem: certificate has expired`. "Name does not match": `curl: (60) SSL: no alternative certificate subject name matches target host name`. "Incomplete chain": `unable to get local issuer certificate`.

Checks: `predict` "how many RTTs to the first byte with TLS 1.2 without keep-alive" (4); the "Count the delay" drill (10.4).

### 7.6. E-WIN. TCP window and throughput (m05, intermediate and experienced)

One screen. The sender on the left, the receiver on the right, between them a "pipe" of length RTT with segments in flight inside. Sliders: **window** 16 KB … 4 MB, **RTT** 1…300 ms, **link bandwidth** 10 Mbit/s … 10 Gbit/s, **loss** 0…5%. The **window scaling off** switch limits the window to 64 KB. The throughput counter = min(bandwidth, window / RTT). The pipe is filled with envelopes exactly up to the window size; when the window is smaller than the bandwidth-delay product, empty space is visible in the pipe, with the label: "the link is idle: the sender is waiting for acknowledgements". The explanation on change (example): "a 64 KB window at RTT 100 ms gives no more than 5 Mbit/s, however wide the link is". With loss: retransmissions and a drop in throughput; the model is qualitative and labelled so ("simplified: without congestion control algorithms"). The observation command is `ss -ti` (fields `rtt`, `cwnd`): this is a step 4 ladder task (14.5). On tier B the "check on real machines" button runs `iperf3` between two `lab-net` machines with a `netem` delay on the link.

This is an analytical mode of the widget, not of the netlab core: TCP in netlab stays with a fixed window (8.2); the formula and a short sender model live inside the explanation.

### 7.7. E-DHCP. How a laptop gets an address (m08)

1. A laptop without an address (`0.0.0.0`), a home router, a broadcast zone outlined by a frame labelled "everyone hears".
2. The DORA steps with fields on the arrows: Discover `src 0.0.0.0:68 → 255.255.255.255:67`; Offer with `yiaddr 192.168.1.23` and options 1, 3, 6, 51; Request; Ack. Clicking an option explains it.
3. The **lease time** slider, 60 s … 24 h: marks for renewal at 50% (T1) and rebind at 87.5% (T2) appear on the timeline.
4. Break it: "a second DHCP server" — two Offers, the client takes the first, the laptop gets someone else's gateway; "the server is switched off" — Discover repeats, then `dhcpcd` assigns `169.254.x.x`, labelled "link-local: no server found, there will be no internet".

Checks: `order` DORA; `predict` "what happens to the laptop if the server is switched off".

### 7.8. E-NF. A packet's path through netfilter (m10)

1. **Five hooks.** Boxes PREROUTING → routing decision → INPUT → local process → OUTPUT → routing decision → POSTROUTING, plus the FORWARD branch. Each hook holds a stack of tables (raw, mangle, nat, filter) as bands; the beginner sees only filter and nat.
2. **Direction.** The **packet to us / through us / from us** switch redraws the path; the packet's course is highlighted, and each hook shows which chain is being checked.
3. **Rule order.** An editor of three rules in one chain: the learner reorders them by dragging, the path is recomputed, it is visible which rule fired first, and the `pkts` counter grows exactly on it. Explanation: "rules are checked from top to bottom until the first match with a verdict".
4. **State.** The **remove `ct state established,related accept`** switch: the reply to an outgoing connection is dropped in INPUT — this is the "established rule forgotten" scenario. The **REJECT instead of DROP** switch: the client gets an instant refusal instead of a timeout.
5. **Local packet and nat OUTPUT.** The **packet created on this host** switch: PREROUTING is not traversed, and the DNAT from PREROUTING does not fire; adding the same rule to `nat OUTPUT` fixes the path. Label: "this is why Docker and kube-proxy hook their chains into both PREROUTING and OUTPUT".
6. **Break it.** "FORWARD policy DROP without an allow rule": the 8080 forward from m09 stops working, the FORWARD hook is highlighted.
7. **User-defined chains (intermediate and experienced).** A `SVC-WEB` chain with `-m statistic --mode random --probability 0.5` and jumps `-j SEP-A`/`-j SEP-B`: the packet goes now to one branch, now to the other; the **number of backends** slider 2…4 recomputes the probabilities `1/N, 1/(N−1), …, 1`, with the explanation "each following line sees only what the previous one did not take". The same screen in nft syntax: `numgen random mod 3 vmap { 0 : jump SEP-A, 1 : jump SEP-B, 2 : jump SEP-C }`.
8. **Experienced only: rules may live elsewhere.** The screen from m15 (eBPF on the tc/XDP hook) as a forward reference.

Checks: `order` "a packet to the host itself" (PREROUTING → INPUT); `predict` for each switch.

### 7.9. E-504. Where 504 and 502 come from (m13, m16)

The main point of the explanation: **the response code tells you who wrote it**.

1. **Chain.** Client → cloud load balancer (L7, idle timeout) → nginx (`proxy_connect_timeout 60s`, `proxy_read_timeout 60s` labelled on the line) → `app1`, `app2` (their own database timeout) → database. Under each box is its timer, shown as a gauge.
2. **Steps.** The nginx → app connection; sending the request; waiting for the response headers; the response; the way back. At the "waiting" step the timer gauges fill up simultaneously.
3. **Controls.** **Database response time** 0…120 s; **`proxy_read_timeout`** 5…300 s (60 by default); **application-to-database timeout** 5…60 s; **load balancer idle timeout** 30…600 s; **number of backends** 1…3; the switches **`proxy_next_upstream off`** and **POST instead of GET**. The process replays from the start, the shortest timer on the path fires first, and the tag "I created the response" lights up on that box. Counters: "code to the client", "how long the client waited", "lines in `error.log`".
4. **Recomputation with explanation (examples).**
   - Database 75 s, `proxy_read_timeout` 60 s, two backends: "504 after 120 s, two lines in `error.log` `upstream timed out … while reading response header from upstream`, one for each `upstream:`. nginx waited 60 s for the first backend and retried the request on the second (`proxy_next_upstream error timeout` by default)".
   - The same, one backend or `proxy_next_upstream off`: "504 after 60 s, one line".
   - The same, POST: "no retry: a request with a non-idempotent method has already gone to the backend; 504 after 60 s".
   - Application-to-database timeout 30 s: "the application itself returned 500 after 30 s; nginx does not consider a 500 an upstream error and passes it to the client".
   - Load balancer idle timeout 45 s: "504 from the cloud load balancer; in nginx's `access.log` the request will complete later, and the client will no longer see it".
5. **Break it.** "The `app1` process crashed": RST → `connect() failed (111: Connection refused) while connecting to upstream` → retry on `app2` → 200 to the client; with `proxy_next_upstream off`, 502. "The `app1` machine is switched off": the connection is not established, 504 after `proxy_connect_timeout`, or 502 with `(113: No route to host)` if a router replied with ICMP. "A filter between nginx and `app1` drops packets": `upstream timed out (110: Connection timed out) while connecting to upstream`, retry on `app2`. "The application returns garbage": 502 `upstream sent invalid header`. "`app2` returns 500": 500 to the client, no retry.
6. **Summary.** A table "code — who said it — what it means"; each row is clickable and replays its scenario. The 08 §3.11 lenses (developer, operations, user, monitoring) are on the last step.

Checks: `hotspot` "who wrote this 504?" from the `curl -sv` output (the `Server:` header) and a log line; `predict` "how long the client waited" for given control settings.

### 7.10. E-URL. "What happens when you type a URL" (end-to-end, m00–m16)

**Purpose.** The backbone of the block and the most frequent interview question. The storyboard of the visual part is in 08 §6.3; the order of introducing concepts and the stage data are here (08 becomes the "no fog" display mode of this explanation after m16 and introduces nothing).

**Fog.** The fog is computed from the set of passed modules in the progress record, not from the pages visited, so a module passed by an entry test is uncovered. In the fog the stage frames are visible with numbers, without labels or values. A QR code passes the step number but not the fog: on the phone the fog is recomputed from progress.

**Screen.** At the top, an address bar where the learner types the address themselves (by default `https://shop.example/catalog`), and a timing "waterfall" as in DevTools: Queueing, DNS, Connect, TLS, Request sent, Waiting (TTFB), Content Download. In the centre, the canvas: laptop → home router (NAT) → provider → recursive resolver → root, TLD `example.`, authoritative server → CDN node → load balancer → nginx → application → database. At the bottom, the inspector for the current packet and the lens panel. On the left, a vertical strip of stages; each expands into 3–6 sentences of text with a link to the module.

**Stages.**

| # | Stage | What is visible on the canvas | Fields in the inspector | Module |
|---|---|---|---|---|
| 0 | URL parsing: scheme, name, default port, path | the string is split into parts | `scheme=https`, `host=shop.example`, `port=443`, `path=/catalog` | m11 |
| 1 | Browser checks: HSTS, automatic HTTPS attempt, page cache, an open connection | branches | — | m11–m13 |
| 2 | ARP for the gateway's MAC — happened even before the DNS query if the cache is empty; in the fog it is shown as a flash before stage 3 | a broadcast frame over Wi-Fi | ARP `who-has 192.168.1.1 tell 192.168.1.23` | m03, m04 |
| 3 | Name → address: browser cache, OS cache, `/etc/hosts`, resolver | the query goes to the resolver | DNS `id`, `flags RD=1`, `QNAME shop.example`, `QTYPE A`; UDP `sport 51234 → 53` | m07 |
| 4 | The resolver walks the hierarchy (if the cache is empty) | pairs of arrows to the root, TLD, authoritative server | delegation `NS`, then `ANSWER: A 198.51.100.20 TTL 300` | m07 |
| 5 | NAT on the router | the packet "changes clothes" | "before/after" lens: `192.168.1.23:51234` → `203.0.113.7:40001` | m09 |
| 6 | TCP handshake with the CDN | SYN, SYN-ACK, ACK | `flags`, `seq`, `ack`, `win`, `mss 1460, sackOK, TS, wscale 7` | m05 |
| 7 | TLS 1.3 | ClientHello, ServerHello and encrypted records | `server_name`, `alpn=h2,http/1.1`, key_share `X25519MLKEM768, x25519`, `supported_versions 0x0304`. The server chooses `http/1.1`; label "in the training network the server chose HTTP/1.1; a real CDN would more often choose h2 or h3" | m12 |
| 8 | HTTP request | `GET /catalog`, headers | "client" lens: the request text; "provider" lens: only TLS Application Data | m11 |
| 9 | CDN: cache | hit — immediate response; miss — a request to the origin | `Cache-Control`, `Age`, `X-Cache: HIT/MISS` (the header name depends on the CDN, and it is labelled so) | m13 |
| 10 | Load balancer and nginx | backend selection, `proxy_pass` | `X-Forwarded-For` added | m13 |
| 11 | Application and database | processing time | — | — |
| 12 | Response | bytes back along the same path, reverse NAT | `HTTP/1.1 200 OK`, `Content-Type` | m11 |
| 13 | Rendering and new requests | CSS/JS/images, connection reuse | new requests without DNS and TLS | m11 |

**Controls and branches** (switches above the strip; the waterfall is recomputed immediately, with a "what changed" line on the right):
- *Browser cache (hit):* stages 2–12 go dark, the waterfall shows `(disk cache)`; explanation "the fastest request is the one that never went to the network".
- *OS or resolver DNS cache:* stage 4 is skipped, stage 3 is shorter.
- *Open connection:* stages 2, 5–7 are skipped.
- *HTTP without the S:* `http://` gives a request to port 80, the response `301 Location: https://...`, then everything again on 443; with HSTS or the automatic HTTPS attempt enabled, the browser rewrites the scheme itself without a request to 80.
- *CDN miss:* a second segment CDN → origin appears, with its own TCP and TLS.
- *HTTP version: 1.1 / h2 / h3* — an illustration: with h2 the inspector shows HEADERS/DATA frames with `:method`, `:path`, `:authority`; with h3 stages 6–7 merge into a QUIC handshake over UDP 443. The netlab terminal keeps working over HTTP/1.1; the switch is labelled "to observe — the HTTP/2 and HTTP/3 cards".
- *DoH:* the DNS query goes inside HTTPS to `1.1.1.1`; the "provider" lens no longer sees the name in DNS but does see the SNI. *ECH* (experienced): the SNI is hidden too.
- Sliders **RTT to the CDN**, **DNS TTL**, **page size**.

**"Break it" mode.** The learner switches on one failure, starts the load and sees where the path breaks, what the browser shows and what a command would print (the button "what it looks like in the terminal" opens the recorded output).

| Failure | What happens in packets | What the user sees | What a command shows | Layer |
|---|---|---|---|---|
| Typo in the TLD `shop.exmaple` | a root server answers NXDOMAIN: there is no such TLD | `DNS_PROBE_FINISHED_NXDOMAIN` | `dig shop.exmaple` → `status: NXDOMAIN` | DNS |
| The authoritative server is down | the resolver gets no reply in time | Chrome error text — `hold` until captured on the test bench (we expect `ERR_NAME_NOT_RESOLVED`) | `dig` → `status: SERVFAIL` | DNS |
| No gateway in DHCP | no packets: the kernel found no route | "No internet connection" | `ping 8.8.8.8` → `ping: connect: Network is unreachable`; `ip route` without `default` | L3 |
| The CDN firewall drops 443 | SYN, retry after 1 s, 2 s, 4 s… | a long wait, then `ERR_CONNECTION_TIMED_OUT` | `curl --connect-timeout 10` → `curl: (28) Failed to connect to … port 443 after 10002 ms: Timeout was reached` | L4 |
| Port closed (REJECT/RST) | an instant RST | `ERR_CONNECTION_REFUSED` | `curl -v`: `connect to … failed: Connection refused`; result `curl: (7) … Couldn't connect to server` | L4 |
| Expired certificate | Certificate with `notAfter` in the past, the client sends an alert | `NET::ERR_CERT_DATE_INVALID` | `curl: (60) SSL certificate problem: certificate has expired` | TLS |
| The origin process crashed (one origin) | nginx gets an RST from the origin | 502 Bad Gateway | `error.log`: `connect() failed (111: Connection refused) while connecting to upstream` | L7 |
| The origin machine is switched off | SYN without a reply | 504 after `proxy_connect_timeout` (or 502 with `113: No route to host` if ICMP arrived) | `upstream timed out (110: Connection timed out) while connecting to upstream` | L7 (cause at L3) |
| The origin is slow | no response for longer than `proxy_read_timeout` | 504 Gateway Time-out | `upstream timed out (110: Connection timed out) while reading response header from upstream` | L7 |
| MTU in a tunnel | small packets get through, large ones disappear | the page "hangs" after the handshake | `ping -M do -s 1472` fails, `-s 1372` succeeds | L3 |

Browser messages are taken from Chromium and checked against the test bench (`check:`); in the RU version they are labelled "this is how Chrome writes it".

**Link to reality.** The "Compare with your browser" button: the learner runs on their own machine
```
curl -o /dev/null -s -w 'dns=%{time_namelookup} connect=%{time_connect} tls=%{time_appconnect} ttfb=%{time_starttransfer} total=%{time_total}\n' https://example.com
```
and pastes the line; the page builds the same kind of waterfall from it next to the training one. The second option is importing a HAR file from DevTools (parsed locally, sent nowhere).

**Checks.** (1) Order the stage cards for the scenario "a repeat visit a minute later" — without the DNS walk and without TLS if the connection is open. (2) From a symptom, pick the enabled failure and name its layer. (3) A free-form answer "tell it out loud" by voice or text, checked by AI against a rubric (DNS with cache, TCP, TLS with SNI and certificate, HTTP request, response; bonus: ARP, NAT, CDN, keep-alive). Without AI, self-check against the rubric; it does not count toward the exam score.

### 7.11. E-NS. A packet between stacks of one kernel and between machines (m15)

1. **Node.** A machine frame with two stacks inside, `red` and `blue` (`--c-ns-net` frames), veth pairs, a `br0` bridge, a route, a NAT rule. A `red → blue` packet goes through the bridge (L2); the host's FORWARD hook is not highlighted. The **`br_netfilter`** switch: now a packet on the bridge also traverses the iptables chains, and the hooks are highlighted; explanation "without this module iptables rules do not see traffic inside the bridge — that is why Kubernetes requires it on every node".
2. **Outward.** `red → internet`: bridge → host routing → POSTROUTING MASQUERADE → `eth0`. Clicking each step shows the command that created it.
3. **Two machines.** The **direct route / VXLAN / WireGuard** switch. With a direct route, the source address `10.42.0.x` is visible unchanged on the link between the nodes. With VXLAN and WireGuard the envelope grows (the bytes are labelled), with a counter "payload at MTU 1500".
4. **Stack MTU.** A slider 1400…1500 with VXLAN: at values above 1450 large packets disappear while small ones get through (link to T8).
5. **Break it.** "Remove the veth" — the stack is isolated. "Remove the route on the second node" — replies go to the default gateway. "Drop UDP 4789 on the router between the nodes" — VXLAN is silent, a direct ping between the nodes works; the question "which layer broke?" (L4 of the outer envelope). "Different VNI on the nodes" — frames arrive and are silently dropped (L2 of the overlay).

Checks: `predict` for each failure; `fill` "the MTU inside VXLAN with a node MTU of 1500" (1450).

## 8. Tier A: the `netlab` network sandbox

### 8.1. What the learner sees

**The lab screen.** On the left, the topology canvas; devices are dragged around, and a link is drawn with the mouse from port to port. On the right, terminal tabs, one per device (double-clicking a device opens its terminal). At the bottom, an event strip (frames on the selected links in single-line tcpdump format) and time buttons: "pause", "step", "×1", "×10", "to the next event". A frame on the canvas is a small envelope in its layer's colour with the protocol label, travelling along the link; a click opens the inspector. Above the canvas are the lesson task and the list of goals (ticked off by facts, section 8.5).

A "probe" can be placed on any link: it is the equivalent of `tcpdump -i` on an interface. The capture accumulates and opens in the packet scope (section 11) or can be downloaded as a `.pcap` that real Wireshark will open.

Every device has a "console" (like IPMI or a serial console in the cloud): even if the learner has locked themselves out completely with an iptables rule, the console works. This allows learning from mistakes without dead ends.

**Modes.** "Lesson" (the topology and the task are given, only what is allowed can be changed), "Scenario" (troubleshooting, section 12), "Free sandbox" (a device palette, saving to YAML, a share link with the topology in the URL fragment, no server).

### 8.2. The model

The core is pure TypeScript without the DOM: it is tested with vitest and used both in the browser and in the build (for prerendering expected outputs). A discrete-event queue with a simulated clock in microseconds. Link delay is configurable (0.2 ms in a LAN and 15 ms to the "internet" by default), and loss is a percentage, deterministic from the seed.

Devices:
- `host` — a Linux machine: interfaces, routing tables (including `ip rule` and multiple tables), ARP cache, sockets, service processes, netfilter, sysctl, the files `/etc/hosts`, `/etc/resolv.conf`, `/etc/nsswitch.conf`, `/etc/nginx/...`, `/etc/wireguard/wg0.conf`, logs.
- `netns` — a network stack inside a parent `host`: its own interfaces, routes, netfilter and conntrack, with the host's processes and clock shared. Needed by m15, dsim and kube-lite.
- `bridge` — a Linux bridge inside a `host` with a MAC table (`bridge fdb`), an address and a `br_netfilter` flag.
- `router` — the same `host` with `ip_forward=1` and several interfaces, just a preset. The learner learns right away that a router in the DevOps world is Linux.
- `switch` — a learning L2 switch with a MAC table and a 300 s ageing timer; optionally 802.1Q (access and trunk ports) for the VLAN card; no STP. The MAC table code is shared with tier B's `vswitch`.
- `wifi-ap` — a switch + DHCP server + NAT router in one box.
- `internet` — a cloud with predefined nodes: root servers (real addresses, a–m, but answering from the model), TLD servers, authoritative servers for `example.`, the public resolvers `1.1.1.1`/`8.8.8.8`, training websites. Inside the cloud there is no detailed routing: it behaves as one big router with a delay.

Services (processes on a host): a DHCP server and a DNS server in the spirit of dnsmasq; an authoritative DNS server from a zone file; a recursive resolver with a cache and QNAME minimisation; `nginx`; an `app` application (YAML: port, bind address, response delay per route, error percentage, response code, behaviour when the database is unavailable); `sshd` (version and key exchange, host key check and `authorized_keys`, for the SSH screen in m12); WireGuard; a VXLAN interface.

**nginx** is a subset of directives whose behaviour matches the real thing: `server`, `listen`, `server_name`, `location`, `proxy_pass`, `upstream` with `server ... weight max_fails fail_timeout backup down`, `proxy_connect_timeout`, `proxy_read_timeout`, `proxy_send_timeout`, `proxy_next_upstream` (`error timeout invalid_header http_500 http_502 http_503 http_504 http_429 non_idempotent off`), `proxy_next_upstream_tries`, `proxy_next_upstream_timeout`, `proxy_set_header`, `proxy_http_version`, `access_log` with `log_format` and the variables `$upstream_addr`, `$upstream_status`, `$upstream_response_time`, `return`, `ssl_certificate`. The defaults are as in the nginx documentation: both timeouts 60 s, `proxy_next_upstream error timeout`, `max_fails=1`, `fail_timeout=10s`. Retrying on the next server, marking a server unavailable for `fail_timeout`, not retrying a non-idempotent request after it has been sent, one `error.log` line per failed attempt — all of this is reproduced. The behaviour is confirmed by "golden recordings" from real nginx (9.7).

Protocols in the model: Ethernet II, 802.1Q, ARP, IPv4 (fragmentation and DF), IPv6 minimally (addresses, ND as "ARP for IPv6", ICMPv6 echo), ICMP (echo, time exceeded, destination unreachable with the codes net/host/port/admin-prohibited/frag-needed), UDP, TCP, DNS, DHCP, HTTP/1.1, TLS 1.3 (simplified), WireGuard (simplified), VXLAN.

TCP is modelled as follows: a handshake with the MSS, SACK-permitted, timestamps and window scale options as fields (the tcpdump output matches the real `[mss 1460,sackOK,TS val … ecr 0,nop,wscale 7]`), data in segments with seq/ack, a fixed window, retransmission by RTO with doubling (initial 1 s, as in Linux), SYN retries per `net.ipv4.tcp_syn_retries=6` (about 127 s until the error), FIN/ACK and a 60 s `TIME-WAIT`, RST on a closed port and with `REJECT --reject-with tcp-reset`. Congestion control is not modelled; the explanation of the window and throughput lives in the analytical E-WIN mode (7.6). Experiments where real TCP behaviour matters (PMTUD, `ss -ti`, iperf) run on tier B.

TLS 1.3 is modelled at the record level: the ClientHello with real fields (versions, SNI, ALPN, key_share, cipher_suites) and the ServerHello are visible in the clear; after that, records are marked `encrypted` and contain a "decrypted" view available only to the "client" and "server" lenses. There is no cryptography; certificates are objects with `subject`, `san`, `issuer`, `notBefore`, `notAfter` and a chain, and verification is done by the rules (name, validity period, trust in the root, chain completeness).

### 8.3. Netfilter

iptables and nftables chains and tables are reduced to one internal model: hook, priority, table (raw, mangle, nat, filter), a list of rules with conditions and a verdict. conntrack with the states NEW/ESTABLISHED/RELATED and a translation table, with per-protocol timeouts. A packet traverses the hooks exactly as in the kernel's scheme, including `nat OUTPUT` for locally created packets and the bridge hooks with `br_netfilter`. The inspector has a "path through netfilter" tab: which chains the packet passed through, along which `-j` jumps, and which rule fired (the equivalent of the `iptables -L -v` counters and of tracing with `nft monitor trace`/`-j TRACE`).

The subset is chosen so that netlab executes everything that Docker and kube-proxy generate in iptables and nftables modes (the commitment from decision 2): user-defined chains with `-j` and `RETURN`, `-m statistic --mode random --probability P` and `--mode nth`, `-m mark` and `-j MARK --set-xmark/--or-mark`, `-m addrtype --src-type/--dst-type LOCAL`, `-m comment`, `-m multiport`, `-m recent` and `-m limit`; in nft, `numgen random mod N`, `map`, `vmap`, `set` with `flags timeout`, `meter`, `fib daddr type local`, `meta mark set`, `meta nftrace set 1`. The kube-proxy rule set is loaded atomically through `iptables-restore`/`nft -f`, as on a real node. Regression test: `iptables-save` and `nft list ruleset` dumps from real k3s and kubeadm nodes from the 05 "golden recordings" are executed in netlab, and the path of a test packet matches the kernel trace.

### 8.4. Command set

Commands are parsed by a shared command-line parser (shared with the Linux block: pipes `|`, `grep`, `head`, `tail`, `less` as a viewer, `cat`, `echo > file`, `nano`/`vi` as a simple editor). The output reproduces the format of the utilities in the `lab-net` image (9.5): there is one reference, the utility versions are pinned, and the "golden recordings" are captured from it. This matters because output formats differ between distributions (curl 7.88 in Debian 12 and 8.x in Ubuntu 24.04 and Alpine print errors differently).

An unsupported flag does not get a list of supported flags: such a list would be a hint and would cancel step 4 of the ladder. The message is: `netlab: this option is not simulated here; open this lesson on a real machine (tier B) to try it`, with an "open on real machines" button where the lab has a twin on tier B. netlab must support the flags and commands of step 3 and step 4 tasks marked `envs: [sim, …]` (the list is in 14.4–14.5); tasks that need a real kernel mechanism (`tc netem`, `ss -K`, `rp_filter`, real `wg`) are marked `envs: [v86, vm]`.

| Command | Supported | Example output / comment |
|---|---|---|
| `ip addr` / `ip a` | `show [dev X]`, `-br`, `-j`, `add A/P dev X`, `del`, `flush dev X` | iproute2 format: `inet 192.168.1.10/24 brd 192.168.1.255 scope global eth0` |
| `ip link` | `show`, `-d`, `-s`, `-br`, `set dev X up/down/mtu N/master BR/netns NS`, `add … type veth peer name …`, `add … type bridge`, `add … type vlan id N`, `add … type vxlan id N dstport P remote A dev X` | `link/ether`; `-d` shows `veth`, `link-netns`, `vxlan id 42` |
| `ip route` / `ip r` | `show [table N]`, `add/del PREFIX via GW [dev X] [table N]`, `add default via GW`, `get A [from B]` | `ip route get` shows the selected route and the `mtu` if it is cached |
| `ip rule` | `show`, `add from P table N`, `add fwmark M table N`, `del` | for step 4 |
| `ip neigh` | `show`, `-s`, `flush all`, `add A lladdr M dev X nud permanent` | `192.168.1.1 dev eth0 lladdr 02:00:00:00:01:01 REACHABLE` |
| `ip netns` | `add`, `del`, `list`, `exec NS cmd` (with substitution of `/etc/netns/NS/resolv.conf`) | m15 |
| `bridge` | `fdb show [br X]`, `link show` | m15 |
| `ip -6 ...` | `addr`, `route` | for I and E |
| `ping` | `-c N`, `-i S`, `-s SIZE`, `-W S`, `-M do`, `-t TTL`, `-I IF`, `-6` | the real format with `icmp_seq`, `ttl`, `time` and statistics; `From 10.0.0.1 icmp_seq=1 Destination Host Unreachable`; `ping: connect: Network is unreachable` |
| `traceroute` | `-n`, `-I`, `-T`, `-p`, `-m`, `-q` | UDP from port 33434 by default; `* * *` on silence |
| `tracepath` | `-n` | shows `pmtu` |
| `mtr` | `-n -r -c N` (report mode) | an aggregate of simulated ICMP; the interactive screen is not supported |
| `dig` | `@server`, record type, `+short`, `+trace`, `+norecurse`, `+tcp`, `+noall +answer`, `+nssearch`, `-x` | the `QUESTION/ANSWER/AUTHORITY/ADDITIONAL` sections, `status`, `Query time`, `SERVER` |
| `host`, `nslookup` | a basic query | for recognising the format |
| `getent hosts NAME` | — | takes `/etc/hosts` and `nsswitch.conf` into account — the difference from `dig` |
| `curl` | `-v`, `-I`, `-i`, `-s`, `-S`, `-o`, `-k`, `-H`, `-X`, `-d`, `-m`, `--connect-timeout`, `--resolve`, `--connect-to`, `-r`, `-w` (timing variables, `%{http_code}`, `%{remote_ip}`), `-L`, `-x`, `--cacert` | `-v` prints `* Trying`, `* Connected`, TLS lines, `> ` and `< ` headers; errors in the format of curl in the `lab-net` image |
| `wget` | `-O-`, `-S` | minimal |
| `openssl s_client` | `-connect`, `-servername`, `-showcerts`, `-tls1_2`, `-tls1_3`; `openssl x509 -noout -text/-dates/-enddate/-subject/-issuer` | abbreviated but recognisable output |
| `ss` | `-t`, `-u`, `-l`, `-n`, `-p`, `-a`, `-o`, `-H`, `state X`, filters `'( dport = :443 )'` | `State Recv-Q Send-Q Local Address:Port Peer Address:Port Process`; states `LISTEN`, `SYN-SENT`, `ESTAB`, `TIME-WAIT` |
| `nc` | `-l [-p] PORT`, `-v`, `-z`, `-u`, `-w` | interactive forwarding of lines between terminals |
| `tcpdump` | `-i IF`, `-n`, `-c N`, `-w FILE`, `-r FILE`, `-X`, `-A`, `-e`, `-C`, `-W`; filter: `host`, `src`, `dst`, `net`, `port`, `tcp`, `udp`, `icmp`, `arp`, `vlan`, `and/or/not`, parentheses, `tcp[tcpflags] & tcp-syn != 0` | tcpdump 4.99 format: `12:00:00.000123 IP 192.168.1.23.51234 > 198.51.100.20.443: Flags [S], seq 100, win 64240, options [mss 1460,sackOK,TS val 1 ecr 0,nop,wscale 7], length 0` |
| `iptables` / `iptables-save` / `iptables-restore` | `-t filter/nat/raw/mangle`, `-L [-n -v --line-numbers]`, `-S`, `-A/-I/-D/-R/-F/-P/-N/-X`, all targets and matches from 8.3 | packet counters grow as packets pass; `-j TRACE` writes to the kernel log in the real format |
| `nft` | `list ruleset/table/chain`, `-a`, `add/insert/delete rule … [handle N]`, `flush ruleset`, `-f FILE`, `monitor trace`; expressions from 8.3 | enough for training configs, conversion from iptables and kube-proxy rules |
| `conntrack` | `-L [-p proto --dport N]`, `-E`, `-F` | conntrack-tools format |
| `sysctl` | `net.ipv4.ip_forward`, `net.ipv4.tcp_syn_retries`, `net.ipv4.conf.*.rp_filter`, `net.bridge.bridge-nf-call-iptables`, `net.ipv4.neigh.*`, `-w` | |
| `dhcpcd` | `IF`, `-k` (release the lease), `-T` (test without configuring) | the default client in the labs |
| `dhclient` | `IF`, `-r` | for recognition on older systems |
| `resolvectl` | `status`, `query` | for recognising Ubuntu; in the labs `resolv.conf` has no stub by default |
| `systemctl`, `journalctl -u` | for the model's services | shared with the Linux block |
| `tail -f /var/log/nginx/error.log` and `access.log` | — | logs in the real format |
| `nginx -t`, `nginx -s reload` | — | syntax check of the subset |
| `wg`, `wg-quick` | `wg show [IF] [latest-handshakes/endpoints/allowed-ips/peers/persistent-keepalive]`, `wg genkey`, `wg pubkey`, `wg-quick up/down wg0` | `latest handshake`, `transfer` |
| `ssh -v` | connecting to the `sshd` model | key exchange and host key check, for the screen in m12 |
| `man`, `--help`, `ip X help` | offline pages from 14.1 | opens the built-in documentation viewer at the right anchor |

#### 8.4.1. Lab format

Lab files are YAML in the content repository, with bilingual texts following the `Bi` model. Example (`net.m04`, "Two subnets and a router"):

```yaml
id: n4-two-subnets
module: net.m04
level: [beginner, intermediate]
envs: [sim, v86]                     # on tier B, the same topology of lab-net machines via vswitch
seed: 42
title: { ru: "Две подсети и роутер", en: "Two subnets and a router" }
devices:
  - id: h1
    kind: host
    ifaces: [{ name: eth0, mac: "02:00:00:00:01:10", addr: "10.0.1.10/24" }]
    routes: []                       # no default route; the learner adds it
  - id: r1
    kind: router
    ifaces:
      - { name: eth0, mac: "02:00:00:00:01:01", addr: "10.0.1.1/24" }
      - { name: eth1, mac: "02:00:00:00:02:01", addr: "10.0.2.1/24" }
  - id: h2
    kind: host
    ifaces: [{ name: eth0, mac: "02:00:00:00:02:10", addr: "10.0.2.10/24" }]
    routes: [{ dst: default, via: 10.0.2.1 }]
links:
  - [h1.eth0, r1.eth0]
  - [r1.eth1, h2.eth0]
editable: { h1: [routes], h2: [routes] }
goals:
  - id: g-route
    say: { ru: "У h1 есть путь к сети 10.0.2.0/24 через r1", en: "h1 has a route to 10.0.2.0/24 via r1" }
    needs: [net]
    when: "net.routes[machine=h1][dst=default][gateway='10.0.1.1'] || net.routes[machine=h1][dst='10.0.2.0/24'][gateway='10.0.1.1']"
    envs: [sim, v86]
    fail:
      - if: "!net.routes[machine=h1][dst=default] && !net.routes[machine=h1][dst='10.0.2.0/24']"
        say: { ru: "У h1 нет маршрута, который подходит к 10.0.2.10. Посмотрите `ip route get 10.0.2.10` на h1", en: "..." }
        term: N03
  - id: g-reach
    say: { ru: "h1 пингует h2", en: "h1 can ping h2" }
    needs: [reach]
    reach: [{ id: p1, icmp: { from: h1, to: 10.0.2.10, count: 3 } }]
    when: "reach.p1.received>=2"
    envs: [sim, v86]
    fail:
      - if: "reach.p1.stage='reply-no-route'"
        say: { ru: "Запрос дошёл до h2, а ответ потерялся: у h2 нет пути обратно", en: "..." }
        term: N03
```

### 8.5. Checks: contract 09 and the `reach` fact domain

All the block's checks are 09 §2.4 goals (`goals` with `when`, `needs`, `envs`, `fail`), evaluated over `dt.facts/v1` facts. The block's own `state/probe/trace` format from the first revision has been withdrawn.

Network checks need active observations: will a ping get through, what code will curl return, what will dig answer. In 09, `probe` is allowed only on `vm`, because it *acts*. Here a `reach` fact domain is proposed (a proposal for 09 §2.2, a generalisation of the existing `http` domain): a goal requests probes in the `reach:` field, and the fact collector returns their result. On tier A the probes run in a **copy** of the world, and the state of the learner's session does not change — this is observation, not action. On tiers B and C the same domain is filled by `facts.sh` with the commands `ping -c3 -W1`, `curl -m5 -s -o /dev/null -w`, `dig +short`, `nc -zv -w2` from the machine named in `from`.

```ts
reach?: Record<string, {                       // key: the probe id from the goal
  kind: 'icmp' | 'tcp' | 'udp' | 'dns' | 'http';
  from: string; to: string;
  received?: number; sent?: number;            // icmp
  connected?: boolean; error?: 'refused' | 'timeout' | 'unreachable' | 'reset';   // tcp/http
  status?: number; ms?: number; bodySha256?: string; tlsError?: string;         // http
  answer?: string[]; rcode?: string;           // dns
  stage?: string;                              // tier A only: where the probe failed
}>;
```

The `stage` field is what the first revision took from Miminet: the check says not only "no" but also where it broke off (`arp-no-reply`, `no-route`, `dropped-at:r1:FORWARD`, `reply-no-route`, `port-closed`, `tls-name-mismatch`). Tier B does not have it: a real kernel does not report where a packet was lost, and `fail` there relies on the other facts.

Network fact domains that the block asks to add to `net` in 09 §2.2: `neigh`, `rules`, `sysctl` (only the requested keys), `conntrack` (a summary), `iptables` (by table), `nft`, `links` with the fields `type`, `vni`, `mtu`, `master`, `netns`, `stats`, and `wg` without the private key: the collector takes `wg show all public-key`, `listen-port`, `peers`, `endpoints`, `allowed-ips`, `latest-handshakes`, `transfer`, `persistent-keepalive`, not `wg show all dump` (the first `dump` line of each interface contains the private key, wg(8)). `wg showconf` is not called in `facts.sh`.

Mapping of the old mechanisms: `alt` (equivalent solutions) is `||` in `when`; `penalty` (works, but bypasses the point) is the field `partial: { if, score, say }` (a proposal for 09; the level check bank needs it too); `trace` over traffic that has passed is the `captures` domain (a summary of the probes on links, tier A and `vswitch` only); `trace` over command history is the 09 `history`, which by the 09 rule goes only into hints and the debrief. There is one exception, and it is written in the scenario text: scenarios that explicitly teach a method grade mandatory observations (`must_observe`), and the learner sees this in the task statement.

### 8.6. netlab's programmatic interface for other engines

The only way dsim (04) and kube-lite (05) change the network is `NetlabApi`. They do not model packets; they create devices and rules and subscribe to events. On tier B the same interface is implemented by an adapter that turns calls into real `ip`, `iptables-restore`, `nft -f` and `sysctl` commands in the guest via `trainer-agent`.

```ts
// netlab/api.ts
interface NetlabApi {
  host(id: string, opts?: { kind?: 'host' | 'netns'; parent?: string }): HostRef;  // a netns lives inside its parent host
  link(a: IfSpec, b: IfSpec): void;                  // a cable or a veth pair (if both ends are in the same parent)
  bridge(host: string, name: string, addr?: string): void;          // docker0, cni0
  enslave(host: string, ifname: string, bridge: string): void;
  addr(host: string, ifname: string, cidr: string): void;
  route(host: string, r: { dst: string; via?: string; dev?: string; table?: number }): void;
  rule(host: string, r: { from?: string; fwmark?: number; table: number }): void;
  tunnel(host: string, t: { kind: 'vxlan' | 'wireguard' | 'geneve'; name: string; vni?: number; local: string; remote?: string; dstport?: number }): void;
  nfRestore(host: string, text: string, flavor: 'iptables-save' | 'nft'): void;   // atomic replacement, like iptables-restore
  sysctl(host: string, key: string, value: string): void;
  resolvConf(host: string, text: string): void;      // the stack's /etc/resolv.conf (Docker 127.0.0.11, CoreDNS)
  service(host: string, svc: ServiceSpec): void;      // a model process listening on a port (nginx, coredns-lite, app)
  on(ev: 'packet' | 'verdict' | 'conntrack', cb: (e: SimEvent) => void): Unsub;
}
```

kube-proxy-lite generates `iptables-save` or `nft` text and passes it to `nfRestore`; cni-lite calls `host(kind: 'netns')`, `link`, `bridge`, `route`, `tunnel`; dsim does the same for `docker0` and `-p`. The 03 commitment is 8.3; the 05 commitment (accepted by the author of 05) is to remove 05's own packet models and keep the rule generators and IPAM.

### 8.7. Technical limits

The netlab core is up to 120 KB gzip without the terminal, the dissectors are a separate chunk of up to 40 KB (decision 3). Topologies of up to 40 devices. Any check takes up to 200 ms on an average laptop, because simulated time does not wait for real time. The session state is a CBOR snapshot in IndexedDB (09 §3), with try/catch; working without storage is acceptable; tier B machine snapshots are in OPFS (09 §1.4). Capture export is pcap (libpcap, linktype 1 Ethernet).

## 9. Tier B: `lab-net` and the `vswitch` switch

### 9.1. Design

Each machine is a separate Web Worker with a v86 instance, `net_device: { type: "virtio" }` without `relay_url`. The worker is subscribed to `net0-send` and forwards the frame to the switch worker through a `MessagePort`, passing the `ArrayBuffer` as a transferable; the switch delivers the frame to the right machine, which runs `bus.send("net0-receive", frame)`. The `vswitch` switch runs in `sim.worker.ts` next to netlab, not through BroadcastChannel: our code must be on the path of every frame. This is a proposal for 09 §1.6: replace the `inbrowser` backend with `vswitch` for network labs, because a shared BroadcastChannel "hub" can neither be drawn link by link nor broken one link at a time.

The switch:
- learns MACs with a 300 s ageing timer and floods unknown destinations to all ports (the MAC table code is shared with netlab's `switch`); optionally 802.1Q (access/trunk);
- can be several segments (`sw0`, `sw1`); a router is a v86 machine with two adapters;
- passes every frame through the dissectors (decision 3) and emits a `net.packet {from, to, layers, verdict}` event with the real bytes; the animator, inspector, packet scope and pcap export work unchanged. No more than 6 envelopes are in flight at once; the rest are added to a counter on the link;
- applies scenario faults deterministically by frame counter: loss of the Nth frame, delay, truncation by MTU, filtering of ICMP "Fragmentation Needed", duplication, link down;
- plays netlab's "internet" for the v86 machines (see 9.2). Frames never go out to the real internet (rule 09 §1.6).

```ts
// web/src/runtime/vswitch.ts
interface LinkParams { delayMs: number; jitterMs?: number; lossPct?: number; mtu?: number; bandwidthKbps?: number; up: boolean }
interface VSwitch {
  attach(port: string, endpoint: FramePort): void;           // FramePort: a v86 worker or a netlab host
  link(port: string, p: Partial<LinkParams>): void;          // the "delay/loss/MTU" controls on the diagram
  vlan(port: string, mode: { access: number } | { trunk: number[] }): void;
  fault(rule: { port?: string; match: string; action: 'drop' | 'delay' | 'corrupt' | 'truncate'; ms?: number; nth?: number }): string; // match: a subset of pcap-filter
  tap(port: string): ReadableStream<Packet>;                 // a probe = tcpdump on the link, pcap export linktype 1
  mac(): { mac: string; port: string; age: number }[];       // the MAC table is drawn on the diagram
}
```

Timings inside the guests are non-deterministic, so checks on tier B are built only on facts and never on time.

### 9.2. Mixed topologies

A netlab host can also be a switch port: it generates real bytes with checksums. This way netlab's "internet" (root, TLD and authoritative DNS, public resolvers, the `203.0.113.1` gateway) serves the v86 machines, and there is no need to keep yet another machine for DNS. Limitation: netlab's TCP stack is simplified, so in a mixed topology a netlab host answers only ARP, ICMP, DHCP and DNS over UDP; all TCP endpoints (nginx, the application, sshd) live in v86. The lab validator checks this rule. For the lesson "a mini-internet on real daemons" (09, `lab-net` v1), the DNS hierarchy is run by `nsd` and `unbound` on one v86 machine.

### 9.3. Kernel

To the `dt-kernel` fragment from 09 §1.4 the block adds (built in, not as modules, for the same reason as in 04: the guest has no `modprobe` infrastructure for every case): `CONFIG_WIREGUARD`, `CONFIG_VXLAN`, `CONFIG_GENEVE` (for the experienced), `CONFIG_VLAN_8021Q`, `CONFIG_TUN`, `CONFIG_NET_IPIP`, `CONFIG_NET_IPGRE` (tunnel comparison), `CONFIG_NET_SCH_NETEM` (real delays and loss), `CONFIG_IP_ADVANCED_ROUTER` and `CONFIG_IP_MULTIPLE_TABLES` (`ip rule`), `CONFIG_NF_CONNTRACK`, `CONFIG_NF_NAT`, `CONFIG_NETFILTER_XT_TARGET_MASQUERADE`, `CONFIG_NF_CONNTRACK_NETLINK` and `CONFIG_NF_CT_NETLINK` (the `conntrack` utility), `CONFIG_NETFILTER_XT_MATCH_STATISTIC`, `CONFIG_NETFILTER_XT_MARK`, `CONFIG_NETFILTER_XT_MATCH_ADDRTYPE`, `CONFIG_NETFILTER_XT_MATCH_RECENT`, `CONFIG_NETFILTER_XT_TARGET_TRACE`, `CONFIG_NFT_NUMGEN`, `CONFIG_NFT_FIB_INET`, `CONFIG_BRIDGE_NETFILTER` (`br_netfilter`), `CONFIG_INET_DIAG_DESTROY` (`ss -K` in the exam).

### 9.4. Contents of the `lab-net` image

The root is `lab-alpine` from 09 (Alpine 3.22 x86), because Debian with systemd does not fit into a 96 MB guest. Full rather than busybox versions of the utilities: `iproute2` (with `bridge` and `tc`), `iptables` (both implementations, `iptables-legacy` and `iptables-nft`), `nftables`, `conntrack-tools`, `tcpdump`, `wireguard-tools`, `dnsmasq`, `dhcpcd`, `nsd`, `unbound`, `bind-tools` (`dig`), `curl`, `nginx`, `openssl`, `netcat-openbsd`, `traceroute`, `iputils` (`ping`, `tracepath`), `mtr`, `ethtool`, `socat`, `iperf3`, `openssh`, `chrony`, `mandoc` with the man pages of all these packages (without man, steps 2–4 do not work on tier B). The versions are pinned in the image file; netlab reproduces the output of exactly these versions.

### 9.5. Acceptance budgets (phase 0 spike)

| What | Threshold |
|---|---|
| 3 `lab-net` machines of 96 MB each, tab memory | ≤ 1.2 GB |
| Time to three prompts from snapshots (repeat visit) | ≤ 8 s on the reference laptop |
| Switch worker | ≤ 40 MB |
| `ping` between machines through `vswitch`, RTT with zero configured delay | ≤ 5 ms |
| `iperf3` between machines | ≥ 20 Mbit/s (enough for a 10 MB `curl` and the window experiment) |
| Laptop ≥ 8 GB / 4 GB / phone or `deviceMemory < 4` | up to 4 machines / 2 machines / tier A (machines are replaced with netlab hosts) |

If the spike does not confirm the budget, m15 and step 4 switch to the "one v86 machine, many netns" scheme: all hosts are stacks inside one kernel. This is cheaper in memory and still real Linux; only the visualisation of the external switch is lost.

### 9.6. What is done on tier B

| Where | Beginner | Intermediate | Experienced |
|---|---|---|---|
| m03, m04 | optional: "the same on real Linux" | optional | optional |
| m07 | — | a mini-internet on `nsd`/`unbound` | the same |
| m09, m10 | — | mandatory | mandatory |
| m14 | — | WireGuard between two machines | the same |
| m15 | one lab (l1), if the device can handle it | all | all |
| Scenarios | — | T2, T8, T9, T10 | T2, T8, T9, T10, T13–T15 |
| Ladder step 4 | — | tasks with `envs: [v86, vm]` | the same |
| Exam, part A | — | — | "hard mode" by choice |
| Practice before part B | — | optional | optional |

The m15 labs (on tier A, the same scenario in netlab with `kind: netns`):

| Code | Task | Goal (09 predicates) |
|---|---|---|
| m15-l1 | In one machine, create the stacks `red` and `blue`, connect them through the bridge `br0` (`10.10.0.0/24`), and get `red → blue` ping working | `ns[kind=net]#>=3 && net.links[type=bridge][name=br0] && reach.p1.received>=2` (p1: icmp from `ns:red` to `10.10.0.3`) |
| m15-l2 | Give `red` access to `203.0.113.1` through the host | `net.routes[ns=red][dst=default] && net.sysctl['net.ipv4.ip_forward']=1 && net.iptables.nat~'MASQUERADE' && reach.p2.received>=2` |
| m15-l3 | Two machines `node1`/`node2`, stacks in `10.42.0.0/24` and `10.42.1.0/24`; without NAT, make the stack on `node1` see the stack on `node2` by its address | `reach.p3.received>=2 && !net.iptables[machine=node1].nat~'10.42.1.0/24'`; in the probe summary on `sw0` the source address is `10.42.0.x` (`captures[link=sw0][ip.src~'10.42.0.']`) |
| m15-l4 | The same, but the nodes are in different subnets behind a router that knows nothing about `10.42.0.0/16`: bring up VXLAN `id 42`, `dstport 4789` | `net.links[type=vxlan][vni=42]` on both nodes; on the router's link, UDP 4789 with inner `10.42.x` in the capture; reach as in l3 |
| m15-l5 | "Why don't large responses get through?" — in VXLAN the stacks' MTU was left at 1500 (step 3) | `net.links[ns=a][name=eth0].mtu<=1450 && reach.http5.status=200` (response ≥ 100 KB) |
| m15-l6 | A stack without a network and its own `resolv.conf`: `green` has only `lo`; then connect it to `br0` and set `/etc/netns/green/resolv.conf` with the server `10.10.0.53` | `reach.dns6.answer~'10.10.0.20'` from `ns:green`, `files['/etc/netns/green/resolv.conf'].text~'10.10.0.53'` |

The `m07-ndots` lab (intermediate and experienced, tiers A and B): the stack's `/etc/resolv.conf` has `search a.svc.lab svc.lab lab` and `options ndots:5`. How many names will the resolver try for `curl http://api.example.com`, and how many queries will go out? Check with `tcpdump -n port 53`. Answer: 4 names (three `search` and the absolute one), two queries per name (A and AAAA), 8 in total; with `curl -4`, 4. Then fix it with an FQDN with a trailing dot — one name. Check: `fill` + the probe summary matches the answer.

### 9.7. Checking against the real utilities: "golden recordings"

Every lab and every scenario from sections 8, 9 and 12 has a twin on `lab-net`. CI runs the same sequence of commands in netlab and in v86 (headless, Node.js) and compares the outputs after normalisation (time, ephemeral ports, MACs, seq numbers). A discrepancy above the tolerance is a red build. A scenario without a twin is not published (`hold`). Browser error texts are captured from the test bench separately and stored with the browser version.

### 9.8. Bridge to hybrid Kubernetes (R11)

The same `vswitch` and `lab-net` become the nodes of the 05 hybrid cluster: the control plane is kube-lite, and on each v86 node a small "kubelet" agent runs pods through `crun`. The pod network is built by cni-lite with the real commands from m15 through the `NetlabApi` adapter: netns, veth, `cni0`, a route or VXLAN `id 1 dstport 8472` between nodes through `vswitch`. kube-proxy-lite writes real rules into the guest through `iptables-restore`. The R9 drill "find where a packet to a ClusterIP goes" is done on the node's real `iptables-save`. This is why m15 and support for kube-proxy rules in 8.3 are a precondition for releasing Kubernetes networking. The learner first builds VXLAN by hand in m15 and in the catalog card, and then recognises it in the CNI.

## 10. Drills

### 10.1. Subnets

**The "Ruler" screen.** Thirty-two bit squares grouped by octet, with the decimal notation below them. The learner enters an address or clicks bits; the mask slider moves bit by bit, the network part is filled with one colour and the host part with another. The mask, network address, broadcast, first and last host, and number of hosts update in sync. The "explain" mode expands each calculation (`192.168.10.77 AND 255.255.255.192 = 192.168.10.64`, `2^(32−26) − 2 = 62`). For intermediate and experienced, the same screen for IPv6 with 16-bit groups and `/64`.

| Code | Task | Example | Answer check |
|---|---|---|---|
| D1 | Network, broadcast, range, number of hosts | `172.16.45.200/20` → network `172.16.32.0`, broadcast `172.16.47.255`, hosts `172.16.32.1–172.16.47.254`, 4094 | Each field separately |
| D2 | Does an address belong to a subnet | `10.0.15.3` in `10.0.8.0/21`? → yes | Yes/no + the network address for this address |
| D3 | Mask ↔ prefix | `255.255.248.0` → `/21`; `/27` → `255.255.255.224` | Both formats |
| D4 | Split a network into N equal parts | `192.168.0.0/24` into 6 subnets → `/27`, 8 subnets of 30 hosts each (we use 6) | Prefix and list of networks |
| D5 | VLSM plan | `10.10.0.0/24`: office 100 hosts, warehouse 50, Wi-Fi 20, link between routers 2 → `/25`, `/26`, `/27`, `/30` (or `/31`) with no overlaps | Capacity, no overlaps, everything inside the original; alternative layouts are acceptable |
| D6 | Route summarisation | `10.1.0.0/24`…`10.1.3.0/24` → `10.1.0.0/22` | Exact aggregation |
| D7 | Route selection | a 4-row table, an address → which route | Row number |
| D8 | Overlaps | VPC `10.0.0.0/16`, office `10.0.128.0/17`, Docker default `172.17.0.0/16`, pod CIDR `10.244.0.0/16` — which pairs conflict with a VPN between the office and the VPC? | Set of pairs |
| D9 | DevOps tasks | The "kubeadm + flannel" variant: pod CIDR `10.244.0.0/16` (as in the flannel manifest; kubeadm has no value of its own, it is set with `--pod-network-cidr`), a `/24` for each node — how many nodes? (256); kubeadm's default service CIDR `10.96.0.0/12` — how many addresses? (1,048,576). The "k3s" variant (values from 05): pod CIDR `10.42.0.0/16`, service CIDR `10.43.0.0/16` — how many service addresses? (65,536) | Number |

D8 and D9 answer "why a DevOps engineer needs subnets": an address conflict between a VPN and a cluster is a real night-time problem.

The task generator is deterministic by seed, and difficulty grows along a scale (a prefix not a multiple of 8 is harder; the second and third octets are harder than the first). Spaced repetition uses the course's shared scheduler (FSRS, `ts-fsrs`, MIT). The "timed" mode is 10 D1/D3 tasks in 5 minutes, with a personal record stored locally. Errors are classified ("counted hosts without −2", "took the wrong octet", "confused network and broadcast"), and the next task is chosen to target the typical error. Via QR, drills continue on the phone (the QR carries the mode, seed and difficulty, 6).

### 10.2. D-NF "Walk the chains" (m10, intermediate and experienced; preparation for R9)

On the left, an `iptables-save -t nat` dump of 20–40 lines: user-defined chains, jumps, `-m statistic`, `-m addrtype`, `RETURN`, `MARK`. On the right, a packet `src 10.0.0.5:40000 → dst 10.96.7.7:80, came in on eth0`. The learner clicks the lines in the order they fire; on a `statistic` line they choose a branch and enter the probability. The result is the address and port after DNAT.
- Generation by seed, three levels: no user-defined chains → two levels of chains → three levels with probabilities.
- Check: the sequence of lines matches the reference computed by the same netlab evaluator that runs packets; the final `ip:port` is correct; the probabilities for N backends are `1/N, 1/(N−1), …, 1`.
- nft variant: `numgen random mod 3 vmap { 0 : jump …, 1 : jump …, 2 : jump … }`.
- Chain names are neutral (`SVC-WEB`, `SEP-1`), not `KUBE-*`: Kubernetes terms have not been introduced yet. In K4 the same drill opens with the real names and the label "you already did this in m10".

### 10.3. "Which layer?" (all modules from m06)

A card is a symptom with output: `curl: (6) Could not resolve host`; `ping` works but `curl` hangs; `SSL certificate problem`; `Destination Host Unreachable`; `HTTP/1.1 502`; `RTNETLINK answers: Network is unreachable`; `tcpdump` shows SYN without SYN-ACK; ARP requests without replies. The learner chooses the layer (L2, L3, L4, DNS, TLS, L7) and the first verification command out of four. The check is the "layer + command" pair against a table; each wrong choice is explained separately. 20 cards at the start, then generation from the `breaks` fields of the protocol catalog; the cards go into the review deck.

### 10.4. "Count the delay" (for E-MAP and E-TCPTLS)

Given a distance or an RTT, a TLS version, keep-alive. Compute the TTFB in RTTs and in ms. The check is a number with a ±5% tolerance. Example: new HTTPS, TLS 1.3, RTT 80 ms → 3 RTT = 240 ms to the first byte; with keep-alive, 1 RTT = 80 ms; Moscow — New York, 7,500 km → RTT of at least 75 ms.

## 11. Packet scope: viewing real captures

**The screen.** The Wireshark three-pane layout: a frame list (number, time, source, destination, protocol, length, info), the field tree of the selected frame, hex with synchronised highlighting. Above the list, a display filter bar. A fourth pane, which Wireshark does not have by default and which matters more to a beginner than the others, is the **flow diagram**: vertical lines for the participants, with frame arrows between them and the time, as in the Kurose — Ross textbooks. Clicking an arrow selects the frame in the list. The "tcpdump view" switch shows the same capture as `tcpdump -n` would print it.

**The display filter is a subset of Wireshark syntax:** `ip.addr == A`, `ip.src`, `ip.dst`, `tcp.port == N`, `udp.port`, `tcp.flags.syn == 1`, `tcp.flags.reset == 1`, `tcp.analysis.retransmission`, `arp`, `icmp`, `dns`, `dns.flags.rcode == 3`, `dhcp`, `http`, `http.response.code == 502`, `tls.handshake.type == 1`, `tls.handshake.extensions_server_name`, `vlan.id`, `vxlan.vni`, `wg`, `quic`, the operators `&&`, `||`, `!`, parentheses. "Follow TCP Stream" joins the data of a connection.

**Source of captures.** We record them ourselves on `lab-net` (this makes them easier to anonymise and reproduce) and, where the real internet is needed, on the course team's test VMs (`tcpdump -w`). Anonymisation: MACs and addresses are replaced with the documentation ranges `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24` (RFC 5737), and payloads are removed except for training ones; for TLS we keep `SSLKEYLOGFILE`. We do not take third-party captures without an explicit licence. From the TLS keys, at build time we prepare a "decrypted layer" behind the switch "as the observer sees it / as the key owner sees it" — the same lens technique as in 7.10, on real data.

| # | Capture | Task | Check |
|---|---|---|---|
| C01 | ARP + ping in one subnet | Which frame is the ARP reply? What is the gateway's MAC? | Frame number; MAC |
| C02 | ping through a router, TTL | Compare the TTL of the request and the reply; how many routers are on the path if the server's OS sets TTL 64? | Number |
| C03 | `dig example.com` | Query ID, source port, record TTL | Three fields |
| C04 | A `dig +trace` hierarchy walk | Assign the frames to servers: root, TLD, authoritative | Matching |
| C05 | DHCP DORA | Find the gateway and DNS server handed out in the Ack | Two addresses |
| C06 | TCP + HTTP without encryption | Frame numbers of SYN, SYN-ACK, ACK; the path and the `User-Agent` | Numbers and strings |
| C07 | Closed port | What did the server reply, and after how long? | "RST", time |
| C08 | Filtered port | How many SYN retries, and at what intervals? | Number and sequence |
| C09 | TLS 1.3 to a site | Server name, offered ALPN, selected version, key_share groups | Strings |
| C10 | HTTP through a reverse proxy, the backend process crashed | Find the proxy → upstream connection, how it ended, and where nginx retried the request | RST frame number; the second backend's address |
| C11 | traceroute | Match the output lines and the ICMP Time Exceeded frames | Matching |
| C12 | WireGuard | Handshake (types 1 and 2) and data (type 4); which port? | Numbers, port |
| C13 | MTU blackhole | Why did the transfer stall after the handshake? | Choice + number of the last large segment sent |
| C14 | VLAN trunk | Which VIDs are in the capture? Which frame has no tag? | Numbers |
| C15 | VXLAN between two nodes | Find the VNI and the inner source address | Number, address |
| C16 | DNS with QNAME minimisation | What did the resolver ask the root? | The question string |
| C17 | HTTP/2 with keys | Find the HEADERS frame and the `:path` pseudo-header | Number, string |
| C18 | QUIC handshake | What is visible in the clear (Initial, SNI), what is not | Choice |
| C19 | WebSocket upgrade | Find `101 Switching Protocols` | Number |
| C20 | BGP OPEN/UPDATE (a bird ↔ bird bench on the course team's test machines) | The neighbour's AS number, the announced prefix | Number, prefix |
| C21 | NTP | Four timestamps and the offset | Numbers |

**Your own captures.** The learner can open their own `.pcap`/`.pcapng`: the file is parsed in the browser and sent nowhere. Protocols outside the dissector list are shown as `Data` with hex.

**AI in the packet scope.** The "explain this frame" button sends the connected AI only the field tree of the selected frame (without hex and without the other frames), and only after confirmation; for the learner's own captures, with a warning that the addresses will go to an external service and an option "replace addresses with documentation ones". At step 4 the button is unavailable for frames referenced by the current task; at step 5 it is hidden (section 18).

## 12. Troubleshooting scenarios

### 12.1. Principle

This is not a multiple-choice test but an incident. The learner gets a ticket, access to the device terminals and a simulated clock on which incident time runs (on tier B the clock is real). They type real commands; on tier A every action costs simulated time (a command costs 30 s, a config edit 2 min, a service restart 1 min; the learner's real time is not counted). Decisions are recorded in a log.

**Layer first.** Before the first command, the learner answers the question "at which layer do you think the problem is?" — a `hotspot` widget with an L2 / L3 / L4 / DNS / TLS / L7 stack in the layer colours; one or two layers can be chosen. After three commands the question is asked again: has the hypothesis become more precise? The second answer counts if the first was wrong but was corrected after observations. The debrief begins with the same line: "At which layer did it break? How did you prove it?"

**Hypothesis notebook.** Before fixing, the learner writes down a hypothesis: a "layer" field (mandatory) and one line "what is broken". It is checked by AI against a rubric or by comparison with keywords; this is part of the grade, because reasoning is valued both in interviews and at work.

**Hints.** The H1–H5 ladder from 01 §14.2, one step per request. The mentor gets the log of commands and outputs, the ticket and the `observations`, but not the `root_cause`. The "I give up" button is H5 (a solution skeleton with gaps); the mentor names the cause only after it. For scenarios marked with step 4 of the documentation ladder, the mentor works in `doc-coach` mode (14.6).

### 12.2. Scenario format

```yaml
id: t1-504-slow-upstream
module: net.m16
level: [intermediate, experienced]
layer: L7
envs: [sim]                          # 60–120 s timeouts only with simulated time; a lab-net twin for the "golden recording"
lab: lab-proxy-app-db                # client, lb (nginx), app1, app2, db
seed: 7
doc_step: 3
ticket:
  ru: "Пользователи жалуются: страница /report открывается две минуты и падает с 504. Остальные страницы работают."
  en: "..."
faults:
  - { on: app1, set: { app.routes./report.delay: 75s } }
  - { on: app2, set: { app.routes./report.delay: 75s } }
layer_first:
  answer: [L7]
  revisit_after_cmds: 3
observations:                        # for the debrief and hints
  - id: see-504
    when: { cmd: "curl", on: client, output_contains: "504" }
  - id: see-errorlog
    when: { cmd_matches: "(tail|cat|less|journalctl).*error", on: lb }
  - id: see-two-upstreams
    when: { output_matches: "upstream timed out.*10\\.0\\.2\\.21.*\\n.*upstream timed out.*10\\.0\\.2\\.22", on: lb }
  - id: see-direct-timing
    when: { cmd_matches: "curl .*(-w|time_).*(app[12]|10\\.0\\.2\\.2[12])", on: lb }
  - id: see-app-log
    when: { cmd_matches: "journalctl -u app|/var/log/app", on: [app1, app2] }
root_cause:
  ru: "Отчёт строится 75 секунд, а nginx ждёт ответа upstream 60 секунд (proxy_read_timeout по умолчанию) и после таймаута повторяет запрос на втором бэкенде (proxy_next_upstream error timeout по умолчанию): 60 + 60 = 120 с до 504."
fixes:
  good:
    - { id: async, ru: "Вынести построение отчёта в фон и отдавать 202 со ссылкой на результат", check: { manual: true } }
    - id: timeout-scoped
      ru: "Поднять proxy_read_timeout только для location /report до 120s, завести задачу на оптимизацию"
      goal: { when: "files['/etc/nginx/conf.d/shop.conf'].text=~'location /report[^}]*proxy_read_timeout (9[0-9]|1[0-9]{2})s'" }
  bad:
    - { id: timeout-global, ru: "proxy_read_timeout 600s для всего сервера",
        why: { ru: "Спрячет и будущие зависания на всех страницах; соединения будут висеть по 10 минут, а с повтором — по 20" } }
    - { id: restart, ru: "Перезапуск nginx или приложения", why: { ru: "Симптом вернётся при следующем запросе отчёта" } }
scoring:
  layer_first: 10
  must_observe: [see-errorlog, see-direct-timing]   # the scenario teaches a method; this is stated in the task
  sim_time_budget: 20m
```

### 12.3. The full tree of scenario T1 "504"

Initial state: `client` → `lb` (nginx, `proxy_pass http://backend`, two servers in `upstream backend`) → `app1`, `app2`.

1. The layer question. The reference answer is L7: a response came back, so the network up to the load balancer works; something in the proxy — application chain is broken.
2. `curl -sv http://shop.lab/report` from `client`: after 120 s of simulated time, `HTTP/1.1 504 Gateway Time-out`, `Server: nginx`. Debrief: "The 504 came from nginx, so DNS, TCP and TLS up to the load balancer are fine. Why 120 and not 60: nginx waited 60 s for the first backend and another 60 s for the second — by default it retries the request on the next server on a timeout (`proxy_next_upstream error timeout`)".
3. If the learner goes to check DNS, ARP or ping to `lb`, the action counts as "unnecessary but safe"; the debrief explains that the 504 response has already proven these layers work.
4. `tail /var/log/nginx/error.log` on `lb`: **two** lines, one for each `upstream:` — `upstream timed out (110: Connection timed out) while reading response header from upstream, client: 10.0.0.5, server: shop.lab, request: "GET /report HTTP/1.1", upstream: "http://10.0.2.21:8080/report"` and the same with `10.0.2.22`. A branch point in the debrief: "while reading response header" means that the connection to the upstream was established but the response did not arrive; "while connecting" would mean a network or filtering problem on the way to the upstream (scenario T2). Debrief question: "why are there two lines?"
5. From `lb`: `curl -s -o /dev/null -w '%{http_code} %{time_total}\n' http://10.0.2.21:8080/report` → `200 75.004`. The application responds, but in 75 s.
6. `grep -r proxy_read_timeout /etc/nginx/` is empty, so the default value of 60 s applies; the learner finds the `Default:` line in the directive's documentation (step 3).
7. Application logs: `report built in 74.9s`.
8. The fix (see `fixes`). After the change the request responds in 75 s, with one attempt and no lines in `error.log`.

### 12.4. List of scenarios

| Code | Ticket | Cause | Key observations | Layer | Level | Tier |
|---|---|---|---|---|---|---|
| T1 | 504 on one page after two minutes | the upstream is slower than `proxy_read_timeout`, retry on the second backend | two "while reading response header" lines; a direct `curl -w` to the upstream | L7 | I, E | A |
| T2 | 504 on the whole site after "security hardening" | `iptables -P INPUT DROP` was added on both `app` hosts without allowing 8080 from `lb` | 504 after 2 × `proxy_connect_timeout` = 120 s, two "while connecting to upstream" lines; `nc -zv` hangs; DROP counters grow | L4 | I, E | A (B — a twin with `proxy_connect_timeout 5s`) |
| T3 | 502 after a deploy | the application on the only backend listens on 8081, while nginx sends to 8080 | "connect() failed (111: Connection refused)"; `ss -tlnp` on `app` | L4 | B, I, E | A |
| T4 | 502 from the load balancer, but "it works on my server" | the application listens on `127.0.0.1:8080` | `ss -tlnp` shows `127.0.0.1`; curl on the server works, from `lb` — `Couldn't connect to server` | L4 | B, I, E | A |
| T5 | "The site does not open" for some users after a move | an old A record with TTL 86400 in resolver caches | `dig @1.1.1.1` and `dig @authoritative` give different addresses; the TTL field | DNS | I, E | A |
| T6 | A service inside the network is not found by its short name | the wrong `search` domain in `resolv.conf` | `dig db` vs `dig db.internal.lab`; `cat /etc/resolv.conf` | DNS | I, E | A |
| T7 | The site returns a certificate error | the certificate has expired / was issued for `www`, but people visit without `www` | `openssl s_client -servername`; `notAfter`, SAN | TLS | B, I, E | A |
| T8 | SSH works over the VPN, but `git clone` and HTTPS hang | tunnel MTU + filtering of ICMP "Fragmentation Needed" | `ping -M do -s 1372/1472`; `tracepath` shows the pmtu; in the capture large segments are retransmitted without a reply | L3 | E | B (the fault on `vswitch`: `mtu 1400` on the link and `drop icmp[0]=3 and icmp[1]=4`); A for the phone |
| T9 | VPN clients are connected, but there is no internet | no masquerade or `ip_forward=0` on the VPN server | `sysctl net.ipv4.ip_forward`; `iptables -t nat -L -n -v` with zero counters | L3 | I, E | B |
| T10 | Ping from A to B works, but from B to A does not | B has no route back (asymmetry) | `ip route get` on both; a capture on the router's interface | L3 | B, I | A; B for I |
| T11 | A new laptop in the office has no internet | a second DHCP server (a stray router) hands out the wrong gateway | `ip route`, DHCP capture — two Offers from different servers | L7 (DHCP) → L3 (gateway) | B, I | A |
| T12 | Every second request is a 500 | `app2` is alive at the TCP level but has lost its database connection and itself responds with 500; nginx does not consider HTTP 500 an upstream error (by default `proxy_next_upstream` has only `error timeout`) and passes the response to the client | alternating 200/500 in `curl -w '%{http_code}'`; `access.log` with `$upstream_addr`; `curl` to `app2` directly — 500; the `app2` log: `db connection refused` | L7 | I, E | A |
| T12b | "The backend is switched off and users see no errors — why does the on-call engineer see errors in the log?" | the `app2` process is stopped; passive checking with `max_fails=1 fail_timeout=10s` tries it again every 10 s, gets an RST and retries the request on `app1` | `error.log` every 10 s: `connect() failed (111: Connection refused) while connecting to upstream`, the client always gets 200; `$upstream_addr` in `access.log` shows two comma-separated addresses for such requests | L7 | E | A |
| T13 | Replies from a server with two interfaces do not arrive, although there is a route | strict reverse path checking `rp_filter=1` on the interface the request came in on, with an asymmetric route | `sysctl net.ipv4.conf.all.rp_filter` and `…conf.eth1.rp_filter`; capture: incoming packets are there, replies are not; the counter `nstat -az TcpExtIPReversePathFilter`. Step 4: `rp_filter` is not introduced in the theory; it is looked up in the kernel's `ip-sysctl` | L3 | E | B |
| T14 | A container-like stack does not see its neighbour on another machine | the route to `10.42.0.0/24` was deleted on `node2` | on `node2` the capture shows requests arriving and replies going to the default gateway; `ip route get 10.42.0.10` on `node2` | L3 | I, E | B |
| T15 | The overlay between nodes is silent, but the nodes ping each other | UDP 4789 is closed on the router between the nodes | `tcpdump -ni eth0 udp port 4789` on the sender — frames go out, on the receiver — nothing; a direct ping between the nodes works | L4 (outer envelope) | E | B |

For the beginner, scenarios T3, T4, T7, T10, T11 come with step-by-step hints: at each step, one leading question ("what does it mean that the response came from nginx?"), not a command.

### 12.5. The debrief screen

Two strips side by side: the learner's path and the expert's reference path, with marks for which observations were made and which were missed; the layer chosen by the learner next to the reference one; the time to the hypothesis and to the fix; "dangerous actions" (restarting a production service without a hypothesis, `iptables -F` on a router, changing two parameters at once) with an explanation of why they are bad. The theory needed for the scenario pops up as links to modules. The "where I looked" log (which documentation pages were opened) is shown but does not count toward the score.

## 13. Protocol catalog

### 13.1. Why and how it is built in

The catalog does not replace the modules; it indexes them and covers what did not fit into the modules (R8). It is a separate reference screen with filters "course level", "layer", "transport". Each card opens only after its concepts have been introduced; before that, a line "opens after m0X" is visible. The cards for basic protocols are assembled from module materials; the intermediate and experienced cards are short 10–20 minute lessons with their own diagram, observation and failure. Each card enters its module's quiz as one `match` or `predict` question and goes into the review deck. Six cards go into interview preparation (10 §8.3): TCP, UDP, DNS, HTTP, TLS, NAT.

Each card starts with a layer badge in the colour `--c-l2`…`--c-l7` and ends with a "how it breaks" section with the question "which layer broke?" — the same rule as in the whole block.

### 13.2. Card format

```yaml
# content/net/protocols/proto-dns.yaml
id: proto-dns
name: { ru: "DNS", en: "DNS" }
level: beginner                      # beginner | intermediate | experienced
layer: { tcpip: application, osi: 7, transport: "UDP 53, TCP 53; DoT 853; DoH 443" }
concepts: [N08, N09]                 # the card opens after these concepts are introduced
why: { ru: "Превращает имя в адрес и другие записи, чтобы люди и конфиги не держали IP", en: "..." }
sequence:                            # exchange diagram; rendered by the 08 §3.1 stepper and the packet scope's "flow diagram"
  actors: [client, resolver, root, tld, auth]
  steps:
    - { from: client, to: resolver, label: "A? shop.example (RD=1)", layer: L7 }
    - { from: resolver, to: root, label: "A? example. (QNAME minimisation)" }
    - { from: root, to: resolver, label: "delegation: NS example. + glue" }
    - { from: resolver, to: auth, label: "A? shop.example" }
    - { from: auth, to: resolver, label: "A 198.51.100.20 TTL 300 (AA)" }
    - { from: resolver, to: client, label: "A 198.51.100.20" }
params:                              # explanation controls (R4)
  - { id: ttl, kind: slider, min: 30, max: 86400, default: 300, effect: { ru: "второй запрос: из кэша или полный путь" } }
observe:                             # how to observe it yourself
  - { cmd: "dig shop.example +trace", envs: [sim, v86] }
  - { cmd: "tcpdump -n port 53", envs: [sim, v86] }
  - { capture: C04 }
breaks:                              # symptom → layer → cause → how to prove it
  - { symptom: "status: NXDOMAIN", layer: DNS, cause: "no such name (typo, wrong zone)", prove: "dig @auth name" }
  - { symptom: "status: SERVFAIL", layer: DNS, cause: "the authoritative server is unreachable or the DNSSEC signature does not validate", prove: "dig +trace; dig +cd" }
  - { symptom: ";; connection timed out; no servers could be reached", layer: L4, cause: "UDP/53 to the resolver is closed", prove: "nc -vzu resolver 53; tcpdump port 53" }
docs:                                # exact places for the ladder (section 14)
  - { step: 1, ref: "rfc1034#section-4.3.2", label: "RFC 1034, 4.3.2 Algorithm" }
  - { step: 2, ref: "man:dig(1)#+trace", highlight: "+trace" }
lab: m07-trace
sources: [rfc1034, rfc1035, rfc9156]
```

The validator rejects a card without a `sequence`, without at least one `observe` command available on tier A or B, and without at least two `breaks` with a `layer` field.

### 13.3. Catalog contents

| Card | Level | Layer / transport | Exchange (gist of the diagram) | Observe | How it breaks (symptom → layer) | Module |
|---|---|---|---|---|---|---|
| ARP | B | L2, EtherType 0x0806 | who-has (broadcast) → is-at (unicast) | `ip neigh`, `tcpdump -e arp`, C01 | no reply → `Destination Host Unreachable` (L2); two hosts with the same IP — replies flip-flop (L2) | m03 |
| DHCP | B | L7 over UDP 67/68, broadcast | Discover → Offer → Request → Ack; renewal at T1 = 50% | `dhcpcd -T`, `tcpdump port 67 or 68 -v`, C05 | two servers → someone else's gateway (L7 → L3); pool exhausted; no option 3 → no gateway; server silent → `169.254.x.x` | m08 |
| ICMP | B | L3, protocol 1 | echo req/rep; time exceeded; unreachable (port, frag needed) | `ping`, `traceroute`, C02, C11 | ICMP filtered → PMTU black hole (L3, T8) | m04 |
| UDP | B | L4, protocol 17 | a connectionless datagram | `ss -uln`, `nc -u` | silence instead of an error; ICMP port unreachable (L4) | m05 |
| TCP | B | L4, protocol 6 | SYN, SYN-ACK, ACK; data/ACK; FIN/ACK; RST | `ss -tan`, `tcpdump 'tcp[tcpflags] & tcp-syn != 0'`, C06–C08 | RST → refusal; DROP → timeout; small window → low throughput (L4) | m05, E-TCPTLS, E-WIN |
| DNS | B | L7 over UDP and TCP 53 | recursion + iterations (13.2) | `dig +trace`, `getent hosts` | NXDOMAIN, SERVFAIL, an old address due to TTL, `search`/`ndots` | m07, E-DNS |
| HTTP/1.1 | B | L7 over TCP 80 | request (line, headers, body) → response (status) | `curl -v`, `nc` | 4xx/5xx; wrong `Host` → wrong site; 502/504 at the proxy (L7) | m11 |
| HTTPS/TLS 1.3 | B | TLS over TCP 443 | ClientHello → ServerHello + … → Finished | `openssl s_client`, `curl -v`, C09 | validity period, name (SAN), chain, wrong time on the client (TLS) | m12, E-TCPTLS |
| SSH | B | L7 over TCP 22 | versions → key exchange → host key check against `known_hosts` → authentication → channels | `ssh -v`, `journalctl -u sshd` | `Host key verification failed` (server key changed); `Permission denied (publickey)`; permissions on `~/.ssh` (L7) | m12 (relies on L15) |
| NTP | I | L7 over UDP 123 | request-response with four timestamps, offset and delay | `chronyc tracking`, `timedatectl`, C21 | the clock drifted → TLS `certificate is not yet valid`, wrong logs (TLS, L7) | m08 |
| SMTP | I | L7 over TCP 25, 587, 465 | EHLO → MAIL FROM → RCPT TO → DATA; STARTTLS | `dig MX`, `nc mail.lab 25` by hand, `openssl s_client -starttls smtp` | 25 closed by cloud providers (L4); wrong MX (DNS); SPF/DKIM/DMARC in TXT | m07 |
| FTP / SFTP | I | FTP: TCP 21 + a separate data channel; SFTP is an SSH subsystem on 22 | FTP active / passive (PASV) | FTP capture, `sftp -v` | FTP behind NAT or a filter: the control channel works, data does not — a bridge to conntrack helpers (L4) | m09 |
| HTTP/2 | I | L7 over TLS, ALPN `h2` | one connection, streams, HEADERS/DATA frames, HPACK | `curl --http2 -v`, C17 | head-of-line blocking at the TCP level; a proxy without h2 to the upstream | m11 |
| HTTP/3 / QUIC | I | L7 over QUIC over UDP 443 | a QUIC handshake with TLS inside, 1-RTT, 0-RTT; connection migration | `curl --http3` (if built with it), the `alt-svc` header, C18, quic.xargs.org | UDP/443 closed → fallback to h2 (L4) | m11, E-TCPTLS |
| WebSocket | I | L7 over HTTP/1.1 Upgrade | `GET` + `Upgrade: websocket` → `101 Switching Protocols` → frames | `curl -i -H 'Upgrade: websocket' …`, C19 | a proxy without `proxy_http_version 1.1` and the Upgrade/Connection headers → 400 or the connection is closed; disconnection on `proxy_read_timeout` when idle (L7) | m13 |
| gRPC | I | L7 over HTTP/2 | a call = an h2 stream, `content-type: application/grpc`, status in trailers | `grpcurl` (step 4), capture | an L4 load balancer holds one h2 connection → the whole load goes to one backend; L7 is needed | m13 |
| VLAN 802.1Q | I | L2, 4-byte tag, 12-bit VID | a tagged frame between switches (trunk), untagged to the host (access) | `ip link add link eth0 name eth0.10 type vlan id 10`, `tcpdump -e vlan`, C14 | wrong VID → ARP without a reply (L2); MTU 1500 + 4 | m01 |
| NAT/PAT | I | L3/L4 | replacing src (SNAT/masquerade) or dst (DNAT), conntrack | `conntrack -L`, `iptables -t nat -L -v` | no entry → the reply did not come back; SNAT port exhaustion (L3/L4) | m09, E-ROUTE |
| BGP | E | L7 over TCP 179, controls L3 | a session between ASes: OPEN, UPDATE (prefixes with AS_PATH), KEEPALIVE; best path selection | the E-MAP map, C20, a provider's looking glass, bgp.tools | a route leak or hijack — packets go the wrong way (L3); the session dropped — the prefix disappeared from the internet | m00 |
| OSPF (idea) | E | L3, IP protocol 89 | neighbours exchange link state, each computes the shortest paths | diagram only | mismatched timers or MTU → no adjacency | m04 (inset) |
| VXLAN / Geneve | E | L2 over UDP 4789 / 6081 | frame encapsulation with a VNI; Geneve has extensible options | `ip -d link`, `tcpdump -ni eth0 udp port 4789`, C15 | MTU −50 bytes; UDP 4789 closed between nodes; different VNI | m15, E-NS |
| IPsec | E | L3: ESP (protocol 50), IKE over UDP 500/4500 | IKE SA → Child SA → ESP | `ip xfrm state`, capture (ESP is opaque) | NAT without NAT-T; mismatched proposals | m14 |
| WireGuard | E (I — in m14) | L3 over UDP, 51820 by convention | handshake initiation (1) → response (2) → data (4); cookie (3) | `wg show`, C12 | `AllowedIPs`; an endpoint behind NAT without `PersistentKeepalive`; MTU; no masquerade | m14 |
| mTLS | E | TLS with a client certificate | the server sends a CertificateRequest, the client sends Certificate and CertificateVerify | `openssl s_client -cert -key`, `curl --cert --key` | the client certificate is not from the right CA; expired; `certificate required` | m12 (inset), a bridge to service mesh |

### 13.4. Sample experienced-level card: VXLAN

**Why.** Two machines in different subnets need to look like one L2 segment. This is how a CNI in Kubernetes (flannel, Cilium in tunnel mode) connects pods on different nodes.
**Layer.** An Ethernet frame (L2) travels inside UDP (L4) inside IP (L3) — "L2 over L4".
**Exchange.** There is no exchange; VXLAN is pure encapsulation. A diagram of envelopes: the inner frame (the stack's MAC and IP) → an 8-byte VXLAN header (flags, 24-bit VNI) → UDP, destination port 4789 → the node's outer IP → the outer Ethernet. The overhead on IPv4 is 50 bytes, hence MTU 1450 inside with 1500 on the node.
**Hands-on (tier B, two machines):**
```bash
# node1 (192.168.50.11)
ip link add vxlan0 type vxlan id 42 dstport 4789 remote 192.168.50.12 dev eth0
ip addr add 10.244.0.1/24 dev vxlan0 && ip link set vxlan0 up
# node2 — mirror image: remote 192.168.50.11, address 10.244.0.2/24
ping 10.244.0.2
tcpdump -ni eth0 udp port 4789     # outer envelope
tcpdump -ni vxlan0 icmp            # inner
```
**How it breaks.** (1) On `vswitch`, the fault "drop udp port 4789": ping is silent, both nodes are alive — layer L4 of the outer envelope. (2) `ping -M do -s 1472 10.244.0.2` fails, `-s 1422` succeeds — layer L3, MTU. (3) Different VNI — frames arrive and are silently dropped — layer L2 of the overlay.
**Check.** `when: "net.links[name=vxlan0].vni=42 && reach.vx.received>=2"`.
**Documentation.** Step 3: "find in `ip-link(8)` which port Linux uses for VXLAN if `dstport` is not specified" (8472 is Linux's historical port; IANA assigned 4789).

### 13.5. What the catalog needs

Dissectors: decision 3. Captures C14–C21: section 11; C20 (BGP) is recorded on a `bird ↔ bird` bench on the course team's test machines, not on the learner's side. The catalog adds about 4 hours to the block for the beginner (B cards are assembled from the modules), 5 for the intermediate and 4 for the experienced; this is already included in the hours in 4.1.

## 14. Documentation ladder

### 14.1. The sources we lead to, and the offline viewer

The trainer keeps the following offline, with full-text search and anchors to sections:
- man pages: `ip(8)`, `ip-address(8)`, `ip-route(8)`, `ip-rule(8)`, `ip-neighbour(8)`, `ip-link(8)`, `ip-netns(8)`, `bridge(8)`, `ss(8)`, `ping(8)`, `tracepath(8)`, `traceroute(8)`, `mtr(8)`, `tcpdump(1)`, `pcap-filter(7)`, `dig(1)`, `resolv.conf(5)`, `hosts(5)`, `nsswitch.conf(5)`, `curl(1)`, `openssl-s_client(1ssl)`, `openssl-x509(1ssl)`, `iptables(8)`, `iptables-extensions(8)`, `iptables-save(8)`, `nft(8)`, `conntrack(8)`, `wg(8)`, `wg-quick(8)`, `tc-netem(8)`, `dhcpcd(8)`, `ssh(1)`, `sshd_config(5)`;
- nginx documentation: `ngx_http_proxy_module`, `ngx_http_upstream_module`, `ngx_http_core_module`, `ngx_http_log_module` in EN and RU;
- the kernel: `Documentation/networking/ip-sysctl.rst`;
- the RFCs from section 20;
- the nftables wiki: the sections on hooks and tracing.

The texts are taken from the packages of the `lab-net` image in the same version as the "golden recordings", so that a page describes the utility the learner actually runs. The man page licences differ (iproute2 — GPL-2.0, curl — the curl license, tcpdump — BSD, dig from BIND — MPL-2.0, nginx — BSD-2-Clause). We distribute them as separate documentation files with notices, next to the code rather than inside it — this is aggregation, and it does not affect the licence of the trainer's code (Apache 2.0). Until confirmed by a lawyer, the section is marked `hold`. Online primary sources: man7.org, tcpdump.org, curl.se, docs.openssl.org, netfilter.org, nginx.org, docs.kernel.org, rfc-editor.org; RU — nginx.org/ru and Russian man pages on opennet.ru with a version note. On tier B the primary path is the real `man`, `--help`, `ip route help` in the guest.

### 14.2. Steps by level and module

| Step | What it looks like | Beginner | Intermediate | Experienced |
|---|---|---|---|---|
| 1. Glimpse | Every new command, field and output line has an unobtrusive chip "where this comes from: `ip-route(8)`, section *ip route get*". A click opens the right anchor in a side panel, and the lesson keeps its state. Not clicking is fine; it does not count toward the grade | m00–m06 | — | — |
| 2. Hint = excerpt | The H2 hint of the 01 §14.2 ladder is not the author's text but an excerpt of the real page with the relevant line highlighted in `--c-warn`. Above the excerpt, a mini-map of the page's anatomy (NAME / SYNOPSIS / DESCRIPTION / OPTIONS / EXAMPLES / SEE ALSO), with the current section highlighted | m07–m12 | m01–m08 (start) | — |
| 3. Find the flag | The task is stated as a result; the hint is only a link to the page without an anchor or highlighting; the effect is checked, not the text of the command | m13–m16 | m09–m13 | m00–m03 (start) |
| 4. Forcing | The task requires a command or flag that was not in the theory; there are no hints; the mentor in `doc-coach` mode asks "where did you look?" | three tasks after m16 | m14–m16, scenarios | from m04 and in all scenarios |
| 5. Exam | AI is off, only the official documentation is open (the offline viewer with the 14.1 list), some tasks are on things that were not in the course | part A, 2 tasks | parts A and B, 3 tasks | parts A and B, 30% of tasks |

The beginner is not sent into the documentation from scratch: for the first seven modules the documentation only appears in glimpses, and even at step 2 it comes as a ready-made excerpt. But from m13 the beginner already searches on their own, and after m16 gets tasks that cannot be solved without man.

### 14.3. Step 2: how to read a page

Before the first excerpt hint (m07 for the beginner, m01 for the intermediate) there is one screen "How a man page is structured" with clickable zones: NAME (one line — what it is), SYNOPSIS (`[]` — optional, `|` — or, `...` — can be repeated), DESCRIPTION, OPTIONS (how to search: `/` and a word), EXAMPLES (often the most useful part), SEE ALSO (where to go next). Two more screens cover other sources: an nginx directive (the lines `Syntax:` / `Default:` / `Context:`; we teach reading `Default: proxy_read_timeout 60s;` — this line will be needed in T1) and an RFC (Abstract, section numbering, MUST/SHOULD per RFC 2119).

Step 2 hint excerpts:

| Module | Lesson task | Excerpt (highlighted) |
|---|---|---|
| m01 | show the MAC | `ip-link(8)`: `ip link show [ DEVICE ]` |
| m02 | add an address | `ip-address(8)`: `ip address add IFADDR dev IFNAME` |
| m03 | clear the ARP cache | `ip-neighbour(8)`: `ip neigh flush` |
| m04 | default route | `ip-route(8)`: `ip route add default via` |
| m05 | show listening sockets with processes | `ss(8)`: `-l`, `-n`, `-p` |
| m06 | ping with fragmentation prohibited | `ping(8)`: `-M pmtudisc_opt` |
| m07 | only the answer, without sections | `dig(1)`: `+short` |
| m08 | release the lease | `dhcpcd(8)`: `-k, --release` |
| m09 | list of translations | `conntrack(8)`: `-L, --dump` |
| m10 | rule line numbers | `iptables(8)`: `--line-numbers` |
| m11 | only the response headers | `curl(1)`: `-I, --head` |
| m12 | the name for SNI | `openssl-s_client(1ssl)`: `-servername` |

### 14.4. Step 3: "find the flag"

The learner is given only a link to the page. The effect is checked (09 facts), not the text of the command. A task from a module that the learner does at a lower step (for example, the beginner in m05) is shown in the form of that step: at step 2 with a page excerpt, at step 1 as an ordinary lesson task with a "where this comes from" chip.

| id | Module | Task | Expected solution | Check |
|---|---|---|---|---|
| doc3-link-stats | m01 | Show the interface's error and dropped frame counters | `ip -s link` | the output contains `RX:` and `dropped` |
| doc3-addr-brief | m02 | Print the addresses one line per interface | `ip -br a` | output: lines like `eth0 UP 10.0.1.10/24` |
| doc3-neigh-perm | m03 | Add a permanent ARP entry for the gateway | `ip neigh add … nud permanent` | `net.neigh[state=PERMANENT]` |
| doc3-route-from | m04 | Which route will the kernel choose for a packet to 10.20.5.5 **from** 10.0.3.5 | `ip route get 10.20.5.5 from 10.0.3.5` | the output contains `from 10.0.3.5` |
| doc3-ss-tw | m05 | How many sockets are in TIME-WAIT to port 443 | `ss -tn state time-wait '( dport = :443 )'` | `fill` matches the fact |
| doc3-ping-df | m06 | A ping of size 1472 without permission to fragment | `ping -M do -s 1472` | DF=1 in the probe summary |
| doc3-dig-answer | m07 | Only the ANSWER section, but with the TTL | `dig +noall +answer` | zone lines, not a single `;;` line |
| doc3-dig-tcp | m07 | Query DNS over TCP | `dig +tcp` | TCP/53 in the capture |
| doc3-dhcp-test | m08 | Find out what the DHCP server will offer without changing the interface settings | `dhcpcd -T` | the interface address has not changed, the output contains the offered address |
| doc3-ct-filter | m09 | Show conntrack entries only for TCP to 443 | `conntrack -L -p tcp --dport 443` | output: only `tcp … dport=443` |
| doc3-ssh-limit | m10 | Limit new SSH connections to 3 per minute | `-m recent` / `limit rate` | a probe of 5 SYNs in a row: the 4th and 5th are dropped |
| doc3-curl-code | m11 | Print only the response code | `-o /dev/null -s -w '%{http_code}'` | output `^\d{3}\n?$` |
| doc3-x509-end | m12 | Only the certificate's expiry date | `openssl x509 -noout -enddate` | output `notAfter=…` |
| doc3-nginx-default | m13 | What is the default value of `proxy_connect_timeout`? | reading `Default:` | the number 60 |
| doc3-upstream-log | m13 | Write the address of the selected upstream and its response time to `access.log` | `$upstream_addr`, `$upstream_response_time` | the log file contains both fields |
| doc3-wg-keepalive | m14 | Keep the tunnel alive behind NAT | `PersistentKeepalive` | `net.wg.peers[].persistentKeepalive>0` |
| doc3-veth-peer | m15 | Show which netns the peer end of this veth is in | `ip -d link` → `link-netns` | `fill` of the name |
| doc3-tcpdump-ring | m16 | Write a capture to files of 1 MB, keeping no more than three | `tcpdump -C 1 -W 3 -w` | `files` shows no more than three capture files |
| doc3-tr-tcp | m16 | traceroute over TCP to 443 | `traceroute -T -p 443` | SYNs with increasing TTL to 443 in the capture |
| doc3-mtr-report | m16 | Get an `mtr` report without the interactive screen | `mtr -r -c 10` | output in report format |

### 14.5. Step 4: forcing

The task needs commands and flags that are not in the theory. There are no hints. The mentor and the built-in help answer the question "how?" following the `doc-coach` scenario (14.6).

| id | Module | Task | What was not in the theory | Where to find it | Check | Tier |
|---|---|---|---|---|---|---|
| doc4-vlan | m01 | Create a VLAN 10 interface on top of eth0 | `ip link add … type vlan id 10` | `ip-link(8)` | `net.links[type=vlan][id=10]` | sim, v86 |
| doc4-secondary | m02 | Add a second address on eth0 so that the kernel does not choose it as the default source | address order, `secondary`, `ip route … src` | `ip-address(8)`, `ip-route(8)` | the address fact + `ip route get` gives the first one | sim, v86 |
| doc4-neigh-timer | m03 | Find out after how many seconds an ARP entry becomes STALE | `ip -s neigh`, `net.ipv4.neigh.eth0.base_reachable_time_ms` | `ip-neighbour(8)`, `ip-sysctl` | `fill` | sim, v86 |
| doc4-ip-rule | m04 | Traffic from 10.0.3.0/24 goes via `gw2`, the rest via `gw1` | `ip rule` + a route in table 100 | `ip-rule(8)` | `net.rules[from='10.0.3.0/24']` + traceroute from 10.0.3.5 goes via `gw2` | sim, v86 |
| doc4-ss-info | m05 | Find out the connection's RTT and cwnd | `ss -ti` | `ss(8)` | `fill` rtt ±10% | v86 |
| doc4-pmtu-cache | m06 | Find out the PMTU to a node from the kernel route cache | `ip route get` → `mtu`, `cache expires` | `ip-route(8)` | `fill` | v86 |
| doc4-caa | m07 | Which CAs are allowed to issue certificates for `example.lab`? | the CAA record | `dig(1)`, RFC 8659 | `fill` | sim, v86 |
| doc4-nssearch | m07 | Query all NS of the zone and compare the SOA serial numbers | `dig +nssearch` | `dig(1)` | `fill` | sim, v86 |
| doc4-dhcp-from | m08 | Find in the client's log which server granted the lease | the `dhcpcd` log | `dhcpcd(8)`, `journalctl` | `fill` IP | sim, v86 |
| doc4-ct-events | m09 | Watch in real time which connections NAT creates | `conntrack -E` | `conntrack(8)` | history + `[NEW]` output | sim, v86 |
| doc4-nft-handle | m10 | Delete only the third rule of a chain without touching the others | `nft -a list`, `delete rule … handle N` | `nft(8)` | n−1 rules in the chain, the rest unchanged | sim, v86 |
| doc4-nft-trace | m10 | Find out which rule drops the packet | `meta nftrace set 1` + `nft monitor trace` or `-j TRACE` | nftables wiki "Ruleset debug/tracing" | `fill` the rule handle | sim, v86 |
| doc4-range | m11 | Ask the server to return only the first 100 bytes | `curl -r 0-99` / `Range` | `curl(1)`, RFC 9110 | `reach.http.status=206` | sim, v86 |
| doc4-connect-to | m11 | Check the new backend `10.0.2.21` by the site name, without changing DNS or `/etc/hosts`, with the correct SNI | `curl --connect-to` or `--resolve` | `curl(1)` | the request reached the new IP with the correct Host and SNI | sim, v86 |
| doc4-tls11 | m12 | Check that the server does not accept TLS 1.1 | `openssl s_client -tls1_1` | `openssl-s_client(1ssl)` | `fill` | v86 |
| doc4-mtls | m12 | Connect to a server that requires a client certificate | `-cert -key` / `curl --cert --key` | `openssl-s_client(1ssl)`, `curl(1)` | `reach.http.status=200` | v86 |
| doc4-next-upstream | m13 | Disable retrying on the next backend | `proxy_next_upstream off` | `ngx_http_proxy_module` | config + `reach` gives 502 with `app2` down | sim, v86 |
| doc4-wg-noprivkey | m14 | Show the parameters of a running WireGuard interface so that the output contains no private key | `wg show wg0 allowed-ips/endpoints/latest-handshakes` | `wg(8)` | the output contains no key matching `PrivateKey` | v86 |
| doc4-brnf | m15 | Enable filtering through iptables on the bridge | `modprobe br_netfilter`, `sysctl net.bridge.bridge-nf-call-iptables=1` | `ip-sysctl`, bridge documentation | the sysctl fact + the FORWARD counter grows | v86 |
| doc4-netem | m16 | Add 200 ms of delay on the interface and show it in ping | `tc qdisc add dev eth0 root netem delay 200ms` | `tc-netem(8)` | the qdisc fact + ping ≥ 200 ms | v86 |
| doc4-rpfilter | m16 | Scenario T13 without hints | `rp_filter` | `ip-sysctl` | the scenario's goals | v86 |

After m16 the beginner gets three tasks from this table (doc4-caa, doc4-range, doc4-nft-handle); the rest are for the intermediate and experienced in their modules. netlab supports the flags of tasks with tier `sim` (8.4); in a `v86` task on tier A a badge "this task is on a real machine" is shown with a button that opens the same lab in v86. The "where I looked" log (which pages were opened in the built-in viewer and which `man` commands were run on tier B) goes into the debrief but not into the score.

### 14.6. The `doc-coach` mentor

The mode turns on when a task has `doc_step: 4`. The system prompt gets `doc_ladder: 4` and the list of the task's flags and commands that must not be named. A fragment of the prompt:

> The learner is solving a task that requires a flag or command not introduced in the course. Do not name the flag, the command or the section where they are described. Your first reply to any "how do I do this" question: "Where have you already looked?" If the learner named a source, ask which section (SYNOPSIS, OPTIONS, EXAMPLES, SEE ALSO) they read and which word they searched for. Suggest only one thing: which page to open (`man ss`, `ss --help`, `ip route help`, a page from the documentation list) or which word to search for on the page (`/state`). If the learner brought a paragraph, you may work through its meaning together, but do not name the answer. After three exchanges without progress, offer to open a page excerpt (step 2 for this task); the task is then credited with the mark "with a hint".

### 14.7. Step 5: exam

AI is off; the mentor and "explain the frame" buttons are hidden, not greyed out. Only the offline viewer with the 14.1 list is open (in the trainer it is an allowlist; on the learner's own VM it is an honour rule). The log of opened pages is recorded and shown in the debrief ("you found `ip rule` in 4 minutes"), but it does not count toward the score.

Tasks on material not covered:
- Part A (simulator): `ip rule` with source-based policy routing; an nft set with a timeout to temporarily block an address after three SSH attempts (`set … { flags timeout; }`); for intermediate and experienced, `ss -K` to kill a stuck connection (tier B).
- Part B (VM), section 17: routing through the tunnel only for one's own network with `AllowedIPs = 0.0.0.0/0` (`Table = off` in `wg-quick(8)` + `ip rule` or `fwmark`); limiting new connections to 443 to 20 per second from one address (`meter`/`limit` in `nft(8)`); for the experienced, checking DNSSEC with `dig +dnssec` against a broken signature in a training zone.

## 15. Data formats

### 15.1. Packet

A single format for netlab, `vswitch`, explanations, the packet scope and export:

```ts
interface Packet {
  id: string;                 // unique within the session
  t: number;                  // time, µs (simulated on tier A, real on tier B)
  link: string;               // where it was observed
  tier: 'sim' | 'v86' | 'capture';
  bytes: Uint8Array;          // the real bytes of the frame: hex and pcap are built from them
  layers: Layer[];            // the dissector's result, the same for real captures
  verdict?: { by: string; chain?: string; rule?: string; action: 'accept' | 'drop' | 'reject' | 'nat' };
  hidden?: { lens: string[] } // encrypted layers: which lenses can see the content
  note?: Bi;                  // a training label for the frame in a scene
}
interface Layer {
  proto: 'eth' | 'vlan' | 'arp' | 'ipv4' | 'ipv6' | 'icmp' | 'icmpv6' | 'udp' | 'tcp'
       | 'dns' | 'dhcp' | 'ntp' | 'http' | 'http2' | 'websocket' | 'smtp' | 'tls' | 'quic'
       | 'wg' | 'vxlan' | 'geneve' | 'bgp' | 'esp' | 'data';
  layer: 'L2' | 'L3' | 'L4' | 'TLS' | 'L7';  // the colour on diagrams and in the inspector
  offset: number; length: number;
  fields: Field[];
}
interface Field {
  name: string;               // as in Wireshark: 'ip.ttl', 'tcp.flags.syn'
  label: Bi;                  // «Время жизни (TTL)» / "Time to live"
  value: string | number | boolean;
  offset: number; length: number; bitmask?: number;
  concept?: string;           // an id from concepts.yaml: the "what is this" link and the introduction-order check
  doc?: string;               // an anchor in the offline documentation (step 1)
}
```

The simulator generates real bytes with correct checksums, so one dissector works both for captures from the simulator and `vswitch` and for real `.pcap` files. Field names match the Wireshark filters, so the filtering skill carries over to real Wireshark.

### 15.2. Textbook scenes and explanations

Theory scenes are YAML following the 08 §7.2 model (`Scene`, `Block` with `Bi`, `draft`, `hold`, `check`, `lens`, `introduces`, `uses`, `deepens`, `forward`), with one extension: a block refers to an explanation via `widget: { kind: explainer, id: E-ROUTE, step: 3, gate: [net.m09] }`, and the scroll progress of the leading scene drives the step. Explanations are `content/net/explainers/<id>.steps.yaml` in the 08 §7.6 format.

### 15.3. Questions

Question types come from the vocabulary of 08 §3.8 and 10: `choice`, `order`, `match`, `hotspot`, `predict`, `fill`, `explain`, `task`. The former `capture` and `command` are `task` with the source "capture" or "simulator"; `number` is `fill`.

```yaml
id: n7-q07
module: net.m07
level: [beginner, intermediate, experienced]
entry: true                         # part of the module's entry mini-test
kind: choice
concepts: [N08]
q: { ru: "Кто хранит «последнее слово» о записи shop.example?", en: "..." }
options:
  - { id: a, ru: "Корневой сервер", why: { ru: "Корень знает только, кому делегирована зона example." } }
  - { id: b, ru: "Авторитативный сервер зоны example", correct: true }
  - { id: c, ru: "Резолвер провайдера", why: { ru: "Он хранит копию из кэша, не дольше TTL." } }
  - { id: d, ru: "/etc/hosts на сервере сайта", why: { ru: "Этот файл влияет только на сам сервер." } }
sources: [rfc1034, olifer-dns]
```

A `task` with the source "simulator" is checked not by string comparison but by a 09 goal: the learner's answer is executed in a snapshot, and the effect (a rule appeared, a route was chosen) or the output is checked. A `task` with the source "capture" is a frame number or a field value. `explain` is checked by AI against a rubric; without AI, the learner sees the reference answer and the rubric and grades themselves, and such an answer does not count toward the exam score.

## 16. Quizzes

Each module ends with a quiz from a bank of 10–15 questions; the learner gets 8 random ones, taking the level into account; the pass mark is 80%, and wrongly answered questions go into the review deck. Every wrong option has its own explanation. Below are typical questions for each module; the full bank is written following this sample.

| Module | Question | Type | Answer |
|---|---|---|---|
| m00 | Why can't a ping from Moscow to New York be 5 ms? | choice | Light in fibre travels at ~5 µs/km; 7,500 km is at least 37 ms one way |
| m00 | Match: AS, IXP, CDN, root server | match | a network under one administration; a place where traffic is exchanged; copies of a site near the user; the start of the DNS walk |
| m00 | Where does your packet first enter someone else's AS? | hotspot | on the router — provider line |
| m01 | A switch received a frame for a MAC that is not in its table. What will it do? | choice | Send it to all ports except the incoming one |
| m01 | Find the MAC of interface `eth0` on `h1` | task (simulator) | `ip link show eth0`, the `link/ether` line |
| m01 | Which of these is a MAC address: `02:42:ac:11:00:02`, `172.17.0.2`, `ff:ff:ff:ff:ff:ff`, `::1` | choice (multiple) | the first and the third |
| m02 | How many hosts are in a `/29`? | fill | 6 |
| m02 | The network address for `10.4.77.130/25` | fill | `10.4.77.128` |
| m02 | Two hosts `192.168.1.10/24` and `192.168.2.10/24` on one switch, no gateway. Will `ping` work? | choice | No: the host considers the address to be in another network, and there is no route there — `Network is unreachable` |
| m03 | Put in order: ARP request, ping echo request, ARP reply, echo reply | order | ARP request, ARP reply, echo request, echo reply (with an empty cache) |
| m03 | The capture shows unanswered ARP requests to `10.0.0.1`. What will `ping` print? | choice | `Destination Host Unreachable` from the host itself |
| m04 | Host `10.0.0.5/24` pings `8.8.8.8`. Which device's MAC does it ask for with ARP? | choice | The default gateway's |
| m04 | Which route will the host choose for `10.20.5.5` (a 4-row table)? | choice | the longest matching prefix |
| m04 | Why do `* * *` lines in `traceroute` not always mean a failure? | choice | A router may not reply with ICMP Time Exceeded but still forward traffic |
| m04 | Add a default route via `10.0.1.1` | task (simulator) | the effect in `ip route` |
| m05 | What is the difference between "refused" and "timed out"? | choice | an RST/ICMP reply versus no reply |
| m05 | Find the process listening on 5432 | task (simulator) | `ss -tlnp` (or `-ltnp`), `postgres` in the output |
| m05 | Window 64 KB, RTT 100 ms, link 1 Gbit/s. What is the throughput? | fill | about 5 Mbit/s |
| m05 | In capture C06, what is the frame number of the SYN-ACK? | task (capture) | the number |
| m06 | In what order are the headers of an HTTP request nested in a frame? | order | Ethernet → IP → TCP → HTTP |
| m06 | Which headers does an ordinary router change? | choice (multiple) | both MACs, TTL, the IP checksum |
| m06 | The MSS with MTU 1500 and IPv4 without options? | fill | 1460 |
| m06 | An "L4 load balancer" — what does it see? | choice | addresses and ports, but not HTTP |
| m07 | Why do some users get the old address after an A record change? | choice | Resolver caches until the TTL expires |
| m07 | Find the mail server of the domain `example.lab` | task (simulator) | `dig MX example.lab` |
| m07 | `ping db` works, `dig db` finds nothing. Why? | choice | The name is in `/etc/hosts`; `dig` does not read `/etc/hosts` |
| m07 | Who will answer NXDOMAIN to `shop.exmaple`? | choice | a root server |
| m08 | From which address does a DHCP Discover go out? | choice | `0.0.0.0` |
| m08 | Which DHCP option sets the DNS server? | choice | 6 |
| m08 | The capture shows two Offers from different servers. What is the risk? | choice | The client may take the wrong gateway or DNS |
| m09 | Why can't you connect from outside to a laptop behind a home router without configuration? | choice | There is no translation entry; DNAT (port forwarding) is needed |
| m09 | What does conntrack store for NAT? | choice | The mapping of the internal address and port to the external ones |
| m09 | Allow internet access for the subnet `10.0.2.0/24` through `eth0` | task (simulator) | effect: MASQUERADE/SNAT in POSTROUTING and `ip_forward=1` |
| m10 | A packet to the host itself passes through the chains | order | PREROUTING → INPUT |
| m10 | A DROP rule is above an ACCEPT rule for the same traffic. Which one fires? | choice | DROP — the first match |
| m10 | Port forwarding works from outside but not from the router itself. Why? | choice | a local packet does not pass through PREROUTING; DNAT in `nat OUTPUT` is needed |
| m10 | Three backends via `statistic`: what are the probabilities of the three lines? | fill | 1/3, 1/2, 1 |
| m11 | What does 304 mean? | choice | The resource has not changed, the browser takes it from the cache |
| m11 | Why is the `Host` header needed? | choice | One IP, many sites |
| m11 | Get only the response headers | task (simulator) | `curl -I` |
| m12 | What does the provider see in an HTTPS connection? | choice (multiple) | IPs, ports, SNI, sizes and timing; it does not see the path, headers or body |
| m12 | `curl: (60) SSL: no alternative certificate subject name matches target host name` — the cause? | choice | The certificate was issued for a different name |
| m12 | After how many RTTs can the client send an HTTP request on a new TLS 1.3 connection without 0-RTT? | fill | 2 (TCP + TLS); the response arrives on the third |
| m12 | `Host key verification failed` — what is it comparable to in TLS? | choice | to a server certificate verification error |
| m13 | How does an L7 load balancer differ from an L4 one? | choice | It sees HTTP and can route by path and headers |
| m13 | How does a backend behind a proxy learn the client's IP? | choice | `X-Forwarded-For` (or the PROXY protocol) |
| m13 | 502 and 504 | match | refusal/dropped connection/garbage from the upstream → 502; timeout → 504 |
| m13 | The process of one of two backends crashed. What will the client get with nginx's default settings? | predict | 200: nginx will retry the request on the second one (`proxy_next_upstream error timeout`) |
| m13 | Both backends respond in 75 s, default timeout. After how long will the client get a 504? | fill | 120 s |
| m14 | What does `AllowedIPs` do in WireGuard? | choice (multiple) | Which addresses to route into the tunnel to this peer and from which addresses to accept traffic from it |
| m14 | Why is the MTU in a tunnel smaller than 1500? | choice | Outer headers are added |
| m14 | VPN clients cannot reach the internet. What should be checked first on the server? | choice (multiple) | `ip_forward`, masquerade |
| m15 | `ip netns`, veth, bridge, VXLAN | match | a separate stack; a cable between stacks; a switch in the kernel; a frame in UDP between machines |
| m15 | VXLAN overhead over IPv4 | fill | 50 bytes |
| m15 | Does a packet from `red` to `blue` through `br0` pass through the host's FORWARD? | choice | No, unless `br_netfilter` is enabled |
| m16 | The check sequence for "the site does not open" | order | layer → name → route/reachability → port → TLS → HTTP |
| m16 | `curl` hangs for 2 minutes and fails. DROP or REJECT on the path? | choice | DROP (or loss) |
| m16 | Find the cause of a 502 in `error.log` | task (log) | the line `connect() failed (111` |
| m16 | `curl: (7) … Couldn't connect to server` — where do you read the cause? | choice | in `curl -v` (`Connection refused`), `nc -v`, `ss` |

## 17. Practical exam

The exam has two parts. Part A is mandatory for all levels and runs in the browser. Part B is for intermediate and experienced (recommended for the beginner after the containers block) and runs on real VMs.

### Part A. "A small company's network" (simulator, 2–3 hours of simulated time, real time unlimited)

The learner gets an empty topology: the internet, a router `gw` with the public address `203.0.113.10/24`, a switch, a server `app` (an application on 8080), a server `ns` (DNS), three work laptops. The requirements in the ticket:

1. Plan the addressing from `10.20.0.0/22`: an office of 200 hosts, a server room of 20, with no overlaps. Goal: subnets inside the `/22`, capacity, no overlaps, addresses assigned.
2. A DNS zone `corp.lab` on `ns` with the records `app`, `ns`, `www` (a CNAME to `app`). Goal: `reach.dns_www.answer` from a laptop contains the CNAME and the A.
3. DHCP for the office with the correct gateway and DNS. Goal: a new laptop gets an address, gateway and DNS through `dhcpcd`; `reach` ping of the gateway.
4. Routing between the office and the server room through `gw`. Goal: `reach` ICMP in both directions.
5. Internet access from both subnets; from outside, nginx on `app` is reachable at `203.0.113.10:443` (TLS, a certificate from the training CA for `www.corp.lab`). Goal: `reach` curl from `internet` with `--resolve` — 200, the certificate is valid.
6. A firewall on `gw`: a DROP policy in INPUT and FORWARD, only what is needed is allowed (DNS, HTTP/HTTPS outward, SSH to `gw` only from the office, the 443 forward, and the forward works from `gw` itself — `nat OUTPUT`). Goal: a set of `reach` probes — what is allowed gets through, what is forbidden does not (SSH from outside, access from the internet to `ns`, access from the office to `app:8080` bypassing nginx).
7. Once everything works, the system introduces two random failures from a set (a broken route, a wrong `search`, binding to `127.0.0.1`, a deleted established rule, an expired certificate) and sends a ticket. The learner first names the layer, then fixes it. Goal: the `reach` probes are green again, and the layer and cause are written in the notebook.
8. Ladder step 5: 2 tasks (B) or 3 (I, E) on material not covered, from 14.7, with only the official documentation open.

Grading: items 1–6 are worth 10 points each; item 7 is worth 30 (15 per failure: 5 for the correct layer and hypothesis, 10 for a fix without side changes); item 8 is worth 10. The pass mark is 80 out of 100, with a mandatory condition: both item 7 failures are found (a hypothesis credited for each). Additionally, not in points: the number of simulated minutes and the "dangerous actions" in the debrief. For the experienced there is a "hard mode on real machines" switch: items 3–7 run on tier B through `vswitch`; the points are the same, and the debrief has its own mark.

### Part B. "On real machines" (two VMs, about 3 hours)

**Where to get VMs.** The learner gets the machines themselves, in one of two ways. The first is a cloud of their choice (the cheap Russian or international providers from 09 §5.2): the `net-b` set of the two smallest VMs; then "from outside" really is the internet, and Let's Encrypt is available if the learner has a domain. The second is local VMs on their own computer (Multipass, Vagrant with VirtualBox, UTM, 09 §5.3): two machines with 1 vCPU / 1 GB / 10 GB each and a service VM `probe` (1 vCPU / 512 MB) in one private host network, which plays the role of the "internet". Local VMs have no public addresses, so "from outside" in the task means "from the `probe` machine", and the certificate is issued by the course's training CA (`step-ca` on `probe`), not Let's Encrypt. The local set is described in a course template (a `Vagrantfile` or cloud-init for Multipass), so the learner brings it up with one command.

**Cost.** Before ordering, the screen shows the price: "the `net-b` set — 2 VMs; in your cloud — per `providers.yaml` (09 §5.2), the price for 3 hours, for a day and for a month if you forget to delete them; on your own computer — free, about 3 GB of free memory needed". While working, a counter in the header shows "running N h M min, ≈ X ₽/€".

**Task.**
1. Bring up a WireGuard tunnel `10.99.0.0/24` on `vm1` and `vm2`.
2. On `vm2`, start a stub application (provided as a single command, listening on `10.99.0.2:8080` and only there).
3. On `vm1`, set up nginx as a reverse proxy to `http://10.99.0.2:8080` with a certificate from the training CA on local VMs or Let's Encrypt in one's own cloud.
4. nftables on both machines: on `vm1` only 22, 80, 443 and the WireGuard port are open from outside; on `vm2` only 22 and WireGuard from outside; 8080 is reachable only through the tunnel.
5. Break and fix by the instructions: give the application a 70 s delay, get a 504 (there is one backend, so after 60 s and with one line in `error.log` — compare with T1), find the line, fix it with a local timeout for the `location`.
6. Step 5: the part B tasks from 14.7.
7. **Cleanup (a mandatory step; the exam does not close without it).** In one's own cloud the trainer shows the deletion commands for the chosen provider (or `terraform destroy` if the VMs were ordered through the IaC block); the VMs are created with the labels `trainer=devops` and `dt-track=net-b` (the single labelling rule is 00 §6.7), and `trainer-exam farewell` revokes the agent key and sends the last message. On local VMs, `vagrant destroy` or `multipass delete --purge` and the same `farewell` are enough. If a heartbeat arrives from the agent 15 minutes after the exam is closed, the trainer shows a red banner "the machines are still running and costing money".

**Check.** `trainer-exam enroll` on each VM (the signing agent of 09 §5.4; on one's own VMs without a server, the self-check `trainer-check.sh`), track `net-b`, the mode with a server and signed facts (`attest`, 09 §2.4, §5.4): the exam gives a mark in the profile, so the facts are signed. `facts.sh` is extended with the domains `wg` (without the private key, 8.5), `nft`, `sysctl`, `reach`. External reachability is checked by the agent on `probe`: `nc -zv vm2 8080` → a refusal is expected, `curl --cacert ca.pem https://www.corp.lab` → 200.

## 18. Pluggable AI

The platform's shared module (09 §4): the learner enters the key for their own model, the key is stored only in the browser, and requests go from the browser to the provider. The pedagogical behaviour is 01 §14: modes, the H1–H5 hint ladder, the ban on handing out a ready solution. In the Networks block AI is called in six places:

| Place | What goes into the request | Prompt restriction | Steps 1–3 | Step 4 | Step 5 |
|---|---|---|---|---|---|
| "Explain the output" in the terminal | the command, the output, a short description of the topology | only introduced concepts; for a new term, name it and say which module it will be in | yes | yes, but without naming the task's flags | hidden |
| "Explain the frame" in the packet scope | the field tree of one frame | the same; no hex | yes | unavailable for the current task's frames | hidden |
| Hints in scenarios | the ticket, the log of commands and outputs, `observations`, not `root_cause` | the H1–H5 ladder; one question at a time | yes | `doc-coach` mode | hidden |
| `doc-coach` | the task, the list of forbidden flags, the "where I looked" log | 14.6 | — | yes | hidden |
| Checking free-form answers | the answer, the rubric | return JSON `{covered:[], missed:[], wrong:[], score}`; no praise | yes | yes | the rubric is checked after the exam |
| Mock questions (interview preparation) | a question from the bank, the learner's answer | grade structure and logic: "explain the logic, do not quote commands" | yes | yes | — |

The block can be completed fully without AI: all checks except free-form answers are deterministic, and free-form answers are replaced with self-checking against a rubric.

## 19. What the block hands over to containers and Kubernetes

### 19.1. The containers block (R7b, the "network" boundary)

The containers block does not introduce NAT, DNAT, the bridge, veth, netns and the stack's `resolv.conf` again: it refers to m09, m10 and m15. `docker run -p 8080:80` there is a recognition of steps 1–5 of the m15 chapter, the built-in DNS `127.0.0.11` is a recognition of step 7, the `--network none` mode is step 6, `--network host` is "the host's stack without its own netns". For the exercises "the container does not work, the cause is at the network boundary", the Networks block hands over ready-made symptom descriptions:

| Symptom | Boundary | Where it is covered |
|---|---|---|
| `curl localhost:8080` from the host gives `Couldn't connect to server`, the container is running | the process listens on `127.0.0.1` inside its own netns | T4, m15 |
| `-p 8080:80`, a timeout from outside | DNAT is there, FORWARD DROP | m10, E-NF |
| `-p` works from outside but not from the host itself | DNAT only in PREROUTING | m10, `nat OUTPUT` |
| the container does not resolve names | the stack's `resolv.conf` | m07, m15 step 7 |
| two containers in different networks do not see each other | different bridges | m15 step 3 |
| the container has no network at all | a stack with only `lo` | m15 step 6 |

### 19.2. The Kubernetes block (R9)

| R9 topic in 05 | What was introduced in networking | Where |
|---|---|---|
| The network model: a pod has its own IP, without NAT; the CNI keeps this promise | routing without NAT, netns as a "host without hardware" | m04, m15 (N23, N21) |
| Pod to pod on one node | veth, bridge, ARP inside the bridge | m15 steps 2–3, E-NS |
| Pod to pod between nodes | a route to another subnet via a node; VXLAN; eBPF as an idea | m15 steps 8–9, 11; the VXLAN card; l3–l4 |
| A ClusterIP is not on any interface | DNAT in PREROUTING and OUTPUT, conntrack | m09, m10, the `n10-chains` lab |
| kube-proxy iptables and nftables | user-defined chains, `statistic`, `numgen`/`vmap`, `iptables-save` | m10, D-NF, 8.3 |
| Cilium eBPF | "rules may live outside netfilter" | m15 step 11 (E) |
| CoreDNS, `search`, `ndots` | `search` domains, the order of attempts, NXDOMAIN as normal | m07, `m07-ndots` |
| NodePort, LoadBalancer, Ingress, Gateway API | DNAT, `addrtype LOCAL`, reverse proxy, L7, 502/504, `Host`, SNI | m10, m11–m13 |
| NetworkPolicy | stateful filter, default deny, established | m10 |
| "The pod cannot reach the service" | the order layer → DNS → address → port → filter | m16 |
| `br_netfilter` on a node | bridge and iptables | m15 quiz, doc4-brnf |
| CIDR values | kubeadm/flannel and k3s | D9 |

Technically both blocks stand on `NetlabApi` (8.6) on tier A and on `vswitch` + `lab-net` on tier B (9.8).

## 20. Sources

Every statement with a number or a standard in the YAML scenes has `check:` with a link to the primary source (an RFC or official documentation) and a second source (a textbook) or a "golden recording".

### Textbooks and courses

| Language | Source | What for |
|---|---|---|
| EN | J. Kurose, K. Ross. Computer Networking: A Top-Down Approach, 9th ed., Pearson, 2025; the authors' materials: https://gaia.cs.umass.edu/kurose_ross/index.php | the main textbook; the "top-down" order matches the route from the map of the internet and the URL |
| RU | Kurose J., Ross K. Computer Networking: A Top-Down Approach (Russian translation of the 6th ed.) | the same for RU |
| RU | Olifer V., Olifer N. Computer Networks: Principles, Technologies, Protocols. Anniversary edition, Piter: https://www.piter.com/collection/top-2/product/kompyuternye-seti-printsipy-tehnologii-protokoly-yubileynoe-izdanie-dopolnennoe-i-ispravlennoe | deep theory: IP, routing, NAT |
| RU | linkmeup, "Networks for the Very Young" ("Сети для самых маленьких"): https://linkmeup.gitbook.io/sdsm ; on Habr: https://habr.com/post/164001/ | a lively introduction; addressing, switching, routing, VLAN, BGP |
| RU | The course "Fundamentals of Computer Networks" (I. Zelenchuk, Miminet): https://stepik.org/208904 | additional practice for B and I |
| EN | L. Peterson, B. Davie. Computer Networks: A Systems Approach: https://book.systemsapproach.org | an alternative to Kurose for E |
| EN | I. Grigorik. High Performance Browser Networking: https://hpbn.co | TCP, window, TLS, HTTP/2 and latency — for E-TCPTLS, E-WIN, E-URL |
| EN | Julia Evans, How DNS Works: https://wizardzines.com/zines/dns ; Mess With DNS: https://messwithdns.net | DNS for the beginner |
| EN | Implement DNS in a Weekend: https://jvns.ca/blog/2023/05/12/introducing-implement-dns-in-a-weekend/ | for E — write a resolver |
| EN | Beej's Guide to Network Programming: https://beej.us/guide/bgnet/ | sockets, ports — for E learners coming from development |

### Interactive and reference resources

| Language | Source | Module |
|---|---|---|
| EN | What happens when…: https://github.com/alex/what-happens-when | E-URL |
| EN | The Illustrated TLS 1.3 Connection: https://tls13.xargs.org ; TLS 1.2: https://tls12.xargs.org ; QUIC: https://quic.xargs.org | m12, packet scope |
| EN/RU | MDN, HTTP: https://developer.mozilla.org/en-US/docs/Web/HTTP , https://developer.mozilla.org/ru/docs/Web/HTTP | m11 |
| EN | Cloudflare Learning Center (BGP, DNS, CDN, TLS): https://www.cloudflare.com/learning/ ; What is BGP: https://www.cloudflare.com/learning/security/glossary/what-is-bgp/ | m00, m07, m12, m13 |
| EN | Root servers: https://root-servers.org/ ; Submarine Cable Map: https://www.submarinecablemap.com/ ; bgp.tools: https://bgp.tools/ | m00 |
| EN | Cloudflare, Error 502/504: https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-502-504 | m16 |
| EN/RU | nginx, ngx_http_proxy_module: https://nginx.org/en/docs/http/ngx_http_proxy_module.html ; ngx_http_upstream_module: https://nginx.org/en/docs/http/ngx_http_upstream_module.html ; RU: https://nginx.org/ru/docs/ | m13, m16, T1, T2, T12 |
| EN | nftables wiki: Netfilter hooks https://wiki.nftables.org/wiki-nftables/index.php/Netfilter_hooks ; Ruleset debug/tracing | m10 |
| EN | Linux kernel, IP sysctl: https://docs.kernel.org/networking/ip-sysctl.html | m10, m15, T13 |
| EN | Kubernetes, Virtual IPs and Service Proxies: https://kubernetes.io/docs/reference/networking/virtual-ips/ ; KEP-5495 (IPVS deprecated): https://www.kubernetes.dev/resources/keps/5495/ | m10, 19.2 |
| EN | WireGuard: https://www.wireguard.com/ ; whitepaper: https://www.wireguard.com/papers/wireguard.pdf ; wg(8): https://man7.org/linux/man-pages/man8/wg.8.html | m14 |
| EN | v86 networking: https://github.com/copy/v86/blob/master/docs/networking.md | 9 |
| EN | Wireshark User's Guide and Display Filter Reference: https://www.wireshark.org/docs/ | packet scope |
| EN | tcpdump and pcap-filter: https://www.tcpdump.org/manpages/tcpdump.1.html , https://www.tcpdump.org/manpages/pcap-filter.7.html | m05, m16 |
| EN | man7.org: ip(8), ss(8), iptables-extensions(8), resolv.conf(5): https://man7.org/linux/man-pages/ ; curl: https://curl.se/docs/manpage.html ; openssl s_client: https://docs.openssl.org/3.0/man1/openssl-s_client/ ; nft: https://www.netfilter.org/projects/nftables/manpage.html ; dig: https://bind9.readthedocs.io/en/latest/manpages.html | section 14 |
| RU | Miminet: https://miminet.ru ; the author's article: https://habr.com/ru/articles/953844 | for comparison and additional practice |

### Standards

RFC 791 (IPv4), RFC 826 (ARP), RFC 768 (UDP), RFC 9293 (TCP), RFC 792 (ICMP), RFC 4632 (CIDR), RFC 1918 (private addresses), RFC 6598 (CGNAT), RFC 5737 (documentation addresses), RFC 2606 and RFC 6761 (reserved names), RFC 2131 (DHCP), RFC 3927 (IPv4 link-local), RFC 1034/1035 (DNS), RFC 9156 (QNAME minimisation), RFC 8659 (CAA), RFC 9110 (HTTP semantics), RFC 9112 (HTTP/1.1), RFC 9113 (HTTP/2), RFC 9000 (QUIC), RFC 9114 (HTTP/3), RFC 6455 (WebSocket), RFC 8446 (TLS 1.3), RFC 6066 (SNI), RFC 4253 (SSH Transport), RFC 5905 (NTP), RFC 5321 (SMTP), RFC 4271 (BGP), RFC 2328 (OSPFv2), RFC 7348 (VXLAN), RFC 8926 (Geneve), RFC 4301 (IPsec), RFC 2119 (MUST/SHOULD), RFC 8200 (IPv6), RFC 1191 (Path MTU Discovery), IEEE 802.1Q. Links are of the form `https://www.rfc-editor.org/rfc/rfc9293`. In the RU version the standards are given in English with a Russian explanation: there are practically no trustworthy translations of RFCs.

## 21. Dependencies on other parts of the course

- **01 (andragogy).** The concept registry `concepts.yaml` and the order linter; the `deepens:` link; the new concepts N22–N31 (3.4); graph corrections (`N12` ← `N03`, `N07` ← `N12`, `N18` into the Linux group); the level check in the 01 §4.3 format with the task bank from 4.2; block hours 50/32/15 instead of 45/28/12; the H1–H5 hint ladder.
- **02 (Linux).** Introduced before networking: the terminal, files and `/etc`, editing, processes and PIDs, `sudo`, `systemctl`, `journalctl`, pipes and `grep`; L14 (everyday network concepts and commands), L15 (SSH and keys); the module "How the kernel isolates and limits" (R6: namespace, `unshare`, `nsenter`, `/proc/<pid>/ns`, `lsns`) is a precondition for m15. A shared terminal and command-line parser; network commands are registered as the `netlab` plugin.
- **04 (containers).** Uses `NetlabApi` instead of its own network model in dsim; the symptom table 19.1; the shared `lab-alpine` image as the root of `lab-net`.
- **05 (Kubernetes).** cni-lite and kube-proxy-lite are configuration generators on top of `NetlabApi`; the hybrid cluster on `vswitch` and `lab-net` (9.8); the D-NF drill is repeated in K4; table 19.2.
- **08 (engine).** The primitives `stepper`, `diagram`, `split`, `breakit`, `packets`, `quiz`, `lenses`; the tokens `--c-l2`…`--c-l7`, `--c-ns-net`; 08 §6.3 becomes the no-fog display mode of E-URL with the domain `shop.example` and a 60 s timeout (accepted by the author of 08); ink is removed from the textbook.
- **09 (platform).** Tier B with `vswitch` instead of `inbrowser` for network labs (9.1); kernel fragments (9.3) and the contents of `lab-net` (9.4); the `reach` fact domain, the `net` network domains and the `partial` field (8.5); the netlab budget of 120 KB + 40 KB of dissectors; the `doc-coach` AI mode; the offline documentation viewer with an allowlist (step 5); the `net-b` set in the learner's cloud or on local VMs, `trainer-check` with the `net-b` track, `farewell` and the heartbeat banner.
- **06 (monitoring).** Blackbox probe metrics (HTTP, TCP, ICMP, DNS) rely on m04–m13; scenarios T1 and T12 can be repeated there with a latency dashboard and `$upstream_response_time`.
- **10 (interview preparation).** A bank of "interview-style questions" (URL, OSI, TCP and UDP, DNS, NAT, 502 and 504, "who wrote this 504"), six catalog cards, the vocabulary of question types.

## Changes after review

Reviews: `reviews/03-networks--by-05-kubernetes.md` (hereafter K, with finding numbers) and `reviews/03-networks--by-08-multimedia-engine.md` (hereafter M, with comment numbers). Disputed facts were checked: nginx retry logic against the `ngx_http_proxy_module` documentation (the defaults `proxy_next_upstream error timeout`, `proxy_next_upstream_tries 0`, `proxy_next_upstream_timeout 0`, both timeouts 60 s, no retry of non-idempotent requests); curl error texts by running curl 8.7.1; the length of the HTTP request with `printf … | wc -c` (45); QTYPE under QNAME minimisation against RFC 9156; the DHCP client in Debian 13 and the status of IPVS in kube-proxy against the Debian mailing list, KEP-5495 and the Kubernetes documentation.

### What was changed

**Owner's requirements.**
- R1: section 1 was rewritten around the priorities "textbook → explanations → documentation → practice"; the anatomy of a chapter and a fully laid out m04 chapter were added (5.1–5.2, M12).
- R2: a new section 14 — offline sources and licences, the distribution of steps by level and module (the experienced start at 3), the man page anatomy screen, step 2 excerpts for m01–m12, 20 step 3 tasks and 21 step 4 tasks with checks and tiers, the `doc-coach` prompt, step 5 tasks in both parts of the exam; the simulator's message about an unsupported flag no longer lists the supported flags (K4, M2).
- R3, R4: a new section 7 — 11 process explanations screen by screen (E-MAP, E-ENV, E-DNS, E-ROUTE, E-TCPTLS, E-WIN, E-DHCP, E-NF, E-504, E-URL, E-NS) with controls, "break it", recomputation with explanation and rewinding; the broken references "7.3, TCP scene" and "netfilter scene" were replaced with E-TCPTLS and E-NF (K6, M5). The analytical TCP window mode (E-WIN) removes the contradiction with the model's fixed window.
- R5: section 6 — the 08 §5 blueprint, colour by layer, protocol by label; ink, "the network as the post office" and "a sheet on the desk" were removed (K10, M6).
- R6: m15 relies on the Linux module "How the kernel isolates and limits" and does not introduce namespaces again (3.1, 21).
- R7b: m15 with steps on a `--network none`-like stack and the stack's `resolv.conf`; a "network boundary" symptom table for the containers block (19.1, M15).
- R8: the m00 map of the internet (E-MAP) instead of "the network as the post office"; a catalog of 24 cards with a format and a VXLAN sample (section 13); the "what the block does not do" paragraph no longer excludes VLAN, BGP and OSPF; the "which layer broke" principle is built into scenarios, cards and a drill (K5, K22, M3, M13).
- R9: the table "what Kubernetes takes from networking" (19.2), `nat OUTPUT` (K17), support for kube-proxy rules in netlab's netfilter (8.3, K16, M10), the `n10-chains` lab and the D-NF drill, `NetlabApi` instead of three models (8.6, K8).
- R10: does not apply to the Networks block.
- R11: tier B `lab-net` + `vswitch` with an API, mixed topologies, kernel fragments, image contents, acceptance budgets, the distribution of lessons and the bridge to the hybrid cluster (section 9, K1, K20, M1).
- R12: part B of the exam — the learner's own cloud or local VMs without public addresses (the `probe` machine, the training CA), the price before ordering and a counter while working, `trainer-check` with signed facts, mandatory cleanup with `farewell` and a banner (17, K19, M9).

**Concept order and identifiers.** Modules were renamed to `net.m00`…`net.m16`, concepts were taken from the 01 graph and extended with N22–N31; L14 and L15 are accounted for with the `deepens:` link; DNS was moved before DHCP; uses of ping/ICMP before m04, iptables in m05, NAT and tunnels in m06, CoreDNS in m07, IPVS and NLB in m13 were fixed; SSH (a screen in m12, a card) and module m15 (veth, bridge, netns — concepts N20, N21) were added (K2, K3, M4, M11).

**Levels.** One route table instead of contradictory marks; hours 50/32/15 with a proposal for 01; the level check in the 01 §4.3 format, with the 03 tasks becoming a bank; tasks 11 (step 3) and 12 (HSTS) were added to the "Experienced" bank (K15, M11, M20).

**Checks.** The lab and scenario formats were moved to 09 goals; the `reach` fact domain with the `stage` field, the `net` network domains and the `partial` field were proposed; `trace` over history goes only into hints, except in explicitly methodological scenarios; `dtcheck-net` was replaced with `trainer-check`; WireGuard is collected without `wg show all dump` (private key leak); question types were reduced to the 08/10 vocabulary (K9, M8).

**nginx and scenarios.** An nginx model with `proxy_next_upstream`, `max_fails`, `fail_timeout`, `non_idempotent`; T1 — a 504 after 120 s and two log lines, the `see-two-upstreams` observation; T2 — 120 s; T12 was rewritten ("every second one is a 500"), T12b, T13 (`rp_filter`), T14, T15 were added; the m13 tasks were rewritten; part B, item 5, explicitly compares one backend with T1; scenarios have a `layer` field and a `layer_first` step; hints are the H1–H5 ladder from 01, "I give up" = H5 (K7, K18, K22, K24.16, M13).

**URL and 08.** E-URL is the source of truth for content, 08 §6.3 is the visual storyboard and the no-fog mode; the domain `shop.example`, a 60 s timeout; the fog is computed from passed modules and shows frames without labels; ARP was moved before DNS; ALPN selects `http/1.1`, HTTP/2 and HTTP/3 are an illustration switch; the response is `HTTP/1.1 200 OK` (K11, K12, M7, M21).

**Factual corrections.** 45 bytes instead of 46 (K24.1, M16.1); `ss` states are `ESTAB`, `TIME-WAIT`, `SYN-SENT` (K24.2); SYN options in the tcpdump output (K24.3); the NXDOMAIN for `shop.exmaple` comes from the root, and the example `shpo.example` was added for the authoritative server (K24.4, M16.2); "no gateway" → `Network is unreachable`, no packets (K24.5); the Chrome error for SERVFAIL is `hold` until captured on the test bench (K24.6, M16.3); key_share with `X25519MLKEM768` (K24.7); HTTPS-Upgrades in the answer option (K24.8); "the process crashed" and "the machine is switched off" were separated (K24.9); the wording on Wiregasm (K24.10); `dhcpcd` instead of `dhclient` as the main client (K24.11); D9 with kubeadm/flannel and k3s variants (K24.12, M16.7); the netlab budget of 120 + 40 KB (K24.13, M17); the part A pass mark with the mandatory finding of both failures (K24.14); sound as a local decision in agreement with 08 (K24.15, M6); QNAME minimisation in task 6 (K13); curl messages as `-v` + result pairs (K14, M16.4); the QR carries only the mode, seed and difficulty (M18); AI by ladder step (M19); `mtr -r` is supported (M22); OPFS for tier B snapshots (M17).

**Packet scope.** Captures C14–C21 (VLAN, VXLAN, QNAME minimisation, HTTP/2, QUIC, WebSocket, BGP, NTP); the source of captures is `lab-net` and the course team's test VMs; C10 shows nginx retrying on the second backend.

### What was rejected or accepted with changes, and why

1. **K16: "kube-proxy in nftables mode is the main one starting with v1.33".** Rejected as a fact. nftables mode became stable in v1.33 and is recommended instead of IPVS, but the default mode remains iptables (the Kubernetes documentation "Virtual IPs and Service Proxies", KEP-5495). The finding itself (support in netlab everything that kube-proxy generates) was accepted in full.
2. **K13: "the root is asked `com. NS`".** Accepted with a correction. RFC 9156 recommends QTYPE A for minimised queries (NS is allowed but "offers no advantage"), and Unbound asks for A by default. So the answer to task 6 and E-DNS say "asks only about `com.`", without a claim about the query type.
3. **K7, T12b: "every tenth request hangs 1 ms longer".** Rejected as an observable symptom: a retry after an instant RST produces no distinguishable delay, and the learner will not see it. Scenario T12b was kept, but its symptom is periodic `connect() failed (111…)` lines in `error.log` while the client gets 200, and two addresses in `$upstream_addr`.
4. **K, part 3.2, the `ndots` lab: "4 queries will go out".** Fixed: there are four names, but curl asks for A and AAAA, so the capture shows 8 queries (4 with `curl -4`).
5. **M1: "phone — 1 v86 node".** Rejected. 09 §1.4 does not run v86 on a phone or with `deviceMemory < 4`; on a phone the block runs on tier A, and machines are replaced with netlab hosts.
6. **K21 and K14: the output reference is `lab-debian`.** Accepted with a change: the reference is the `lab-net` image on the `lab-alpine` root (full utilities, not busybox), because Debian with systemd does not fit into a 96 MB guest, and network labs need 3–4 machines. Utility versions are pinned, and the "golden recordings" are captured from this image.
7. **M16.4: the curl 7.88 timeout text "Failed to connect … Timeout was reached".** Partially accepted. A check on curl 8.7.1 showed that the text depends not only on the version but also on the flag: with `--connect-timeout`, `Failed to connect to … after N ms: Timeout was reached`; with `-m`, `Connection timed out after N milliseconds`. The tables give both variants with the flag; the reference is the "golden recording".
8. **Different distributions of ladder steps in K (part 6.2) and M (comment 2).** One grid was adopted (14.2): step 1 for the beginner in m00–m06 (as in M), step 3 from m13 (as in K), step 4 for the beginner is three tasks after m16 rather than all scenarios, so as not to send them into the documentation without support.
9. **K15: "one m16 lab on tier B even for the beginner".** Accepted with the condition "if the device can handle it"; otherwise the same lab on tier A.
10. **The number of the new module.** K proposed m16 "networks in one kernel" before troubleshooting; M proposed N16 after N10, and also N-1 for the map. Adopted: the map is `net.m00` (no negative numbers), networks in one kernel is `net.m15` after VPN (tunnels and netfilter are already familiar), troubleshooting is `net.m16`, so that scenarios T14–T15 stand on m15.
11. **M8: a `probes` fact domain; K9: `net.reach`.** One top-level domain, `reach`, was adopted (a generalisation of `http` from 09), so that the name is not confused with the `probe:` field of 09 goals, which means an action and is allowed only on `vm`.
12. **M4 (c): "cut N0 to two screens".** Rejected: the m00 map of the internet took over the whole purpose of N0, and there is no separate introductory chapter any more.
13. **M16.5: pin ALPN to `http/1.1` or show HTTP/2 frames at stage 8.** The first option was chosen as the main one (the training network's server chooses `http/1.1`), and the second as an illustration switch without terminal support, because the netlab model stays HTTP/1.1.
14. **K24.3: model SACK, timestamps and window scale.** Accepted as fields and output format, but not as behaviour: congestion control and SACK recovery are not modelled in netlab; experiments with real TCP run on tier B.
15. **K12: "ARP for the gateway's MAC happens before DNS".** Accepted with a clarification: ARP for the gateway's MAC happens before the DNS query only with an empty ARP cache; in the fog it is shown as a flash before the DNS stage, and in the strip as a separate stage 2.
16. **M6: "sound is off and no toggle is offered" versus K24.15 "keep the 08 decision (an option, off)".** M's wording was adopted: in network explanations sound carries no meaning; 08 allows it but does not require it, so there is no contradiction.
17. **M9: "3 × CX23 Hetzner ≈ €0.03/h".** No specific price was put into the document: provider prices change, the source of the price is `providers.yaml` in 09 §5.2, and the screen shows it from that file.
18. **Step 5 for the experienced (M2): a DNSSEC task in part B.** Accepted as a task for the experienced only; it is not in the bank of uncovered material for the intermediate, because without the concept of a chain of DNS zone signatures it cannot be solved in the allotted time.
