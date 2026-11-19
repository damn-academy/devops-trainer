# Review of 03-networks.md (reviewer: the "Kubernetes" role, author of 05-kubernetes.md)

Date: 18.11.2026. The reviewed document was not modified. References to sections follow the headings of 03-networks.md unless stated otherwise.

## Verdict

The document is strong in its networking content: the module order "frame → IP → ARP → route → TCP → model", the simulator with simulated time, the packet scope with real bytes and pcap export, the troubleshooting scenarios with a decision tree are done at the level of a good textbook. But in its current form the block does not fit the owner's requirements that came after the first wave, nor the neighboring documents. There are four main problems. First: the document rejects v86 for network labs, while R11 and document 09 build a real multi-machine network precisely on v86 with our own switch. Second: the block has no module on virtual networks within one kernel (netns, veth, bridge, VXLAN), although the 01 concept graph assigns these concepts (N20, N21) to networks, and Docker (R7b) and all of Kubernetes networking (R9) stand on them. Third: of the mandatory requirements, the documentation ladder (R2), process explanations in the R4 style (except for the URL one), the map of the internet and the protocol catalog (R8) are not covered. Fourth: in the block's main scenario, "504", nginx's retry logic is modelled wrongly: on real nginx T1 gives a 504 after 120 seconds, not 60, and T12 as described does not reproduce at all. There are also three parallel network models (netlab, `engine/net.ts` in dsim, cni-lite/kube-proxy-lite in kube-lite), while 09 requires one. This is as much my fault as the author of 05 as it is the fault of the author of 03; an interface that removes the problem is proposed below.

Total: 9 BLOCKING, 14 MAJOR, 16 MINOR. Almost all BLOCKING items are closed by adding the ready text from this review (parts 3–9 below: module N16, storyboards, catalog, ladder, lab-net architecture).

---

## Part 1. Findings

### 1. BLOCKING — v86 is rejected for network labs; this contradicts R11 and document 09
**Where:** "2. Tool decisions", the v86 row of the table; "Decision 1"; "Decision 4".
**What is wrong.** The table says that for v86 "three to five machines in a topology on a laptop is unacceptable; packets between VMs cannot be animated and deterministically broken". R11 requires exactly this: 3–4 v86 machines of 64–128 MB each in Web Workers, connected by **our** JS switch (real L2: ARP, ping, tcpdump, routing, iptables, NAT, WireGuard between nodes, a visualized switch). Document 09 (1.6, phase 2) already plans a `lab-net` image and multi-machine labs. The claim "cannot be animated or broken" is wrong: if frames go through our switch, every frame passes through our code. We can show it, delay it, drop it, truncate it by MTU and filter ICMP deterministically by frame number. Only scheduling inside the guest remains non-deterministic, and checks based on state facts do not depend on it.
**Fix.** Keep netlab as tier A: it is needed for the beginner, the phone, simulated time and scenarios. Add "Decision 6. Tier B for networks: lab-net on v86 with our own switch" (ready text in part 7). Rewrite the v86 row in the table:
> v86 | A real Linux kernel; an ne2k/virtio network adapter whose frames we take from the emulator bus | Tier B of the block: real `ip`, `iptables`/`nft`, `tcpdump`, `wg` on 2–4 machines connected by our `vswitch` switch | Not a basis for the beginner and the phone: startup takes seconds, 64–128 MB of memory per machine, no simulated time (a 127 s timeout lasts 127 s)

### 2. BLOCKING — there is no module on virtual networks within one kernel (netns, veth, bridge, VXLAN); the 01 graph assigns them to this block
**Where:** "3. Strict order of introducing entities", the module table; "13. Dependencies", the items "Docker block" and "Kubernetes block".
**What is wrong.** In 01-andragogy, 6.2, the concepts `N20 Virtual interfaces: veth and bridge` and `N21 Network namespace; ip netns` belong to the "Networks" block, and `D03`, `D20` and `K26 CNI` depend on them. In 03 they are not in any module. Section 13 meanwhile claims that Docker "does not reintroduce the bridge switch, it refers to N1, N9, N10". But N1 is a physical switch, not a Linux bridge with an address. R7(b) (veth, docker0, NAT, `-p` as DNAT, embedded DNS) and R9 (pod-to-pod on one node and between nodes, VXLAN, Service as DNAT) stand precisely on these concepts. R9 also needs an understanding of VXLAN encapsulation alongside WireGuard, and of nat chains in OUTPUT for locally created packets.
**Fix.** Add a module N16 "Networks within one kernel" between N14 and N15. The full text of the module with labs and checks is in part 3. It fits with R6 like this: the general concept of a namespace is introduced by Linux (R6), and N16 gives the network specifics: `ip netns`, veth, bridge, routing between netns, NAT outward, VXLAN between two machines.

### 3. BLOCKING — violations of the strict term order within the block and desynchronization with the 01 graph and the Linux block
**Where:** "3. Strict order"; "5. Program" (N2, N3, N5, N8).
**What is wrong.**
- N3 (ARP): "run `ping`, … see the ARP pair before the first ICMP". ICMP and `ping` are introduced in N4. In N2 the task "make sure the neighbors see each other" is also checked with ping.
- N5: "enable `iptables -A INPUT … -j DROP` on the server". Netfilter is introduced in N10.
- N8: "preparation for CoreDNS in Kubernetes with its `ndots:5`" — Kubernetes terms without `forward:`.
- 7.2, screens 4–6 (NAT, tunnel, "black hole"), are in module N6, while NAT is introduced in N9 and the tunnel in N14. The caveat "come back after N14" exists only for the exercises, not for the screens.
- Identifiers: in 03 concepts are marked up as `[[ip-address|…]]`, in 01 as `N01…N21`. The module codes `N0…N15` coincide with the 01 concept codes: `N10` in 03 is the Netfilter module, and in 01 the DHCP concept. The linter and the AI context will get confused. I have the same illness in 05 (modules K0–K15 and concepts K01–K38), so this must be solved at the platform level.
- The Linux block (02, module L14 "The network from the machine's point of view") already introduces the interface, IP address, mask, default route, port, socket, DNS query, `/etc/hosts`, `/etc/resolv.conf`, HTTP request, as well as `ip a`, `ip r`, `ss`, `ping`, `curl`, `dig`, `nc`. 03 introduces them again as new (N2, N4, N5, N8, N11), and the "Relies on" table does not reference L14. Under the 01 rule a concept has one `intro`: the linter will fail on the duplicate.
**Fix.**
1. Rename the modules to `net.m00…net.m16` (and in 05, to `k8s.m00…`); take the concept identifiers from 01 (`N01…N21`) and add the missing ones (list in part 3.4).
2. Add a column "Already familiar from L14" to the module table and recast modules N2, N5, N8, N11 as "deepening": the concept has already been introduced in L14 with an everyday definition, and here the mechanism appears. In `concepts.yaml` these concepts have `intro: linux.L14`, and the deepenings get separate ids (`N02a` "the mask and binary notation", `N05a` "TCP states", and so on).
3. N2 and N3: `ping` is used as a tool already familiar from L14 for "checking connectivity". The word ICMP is not used in N3; the frame in the capture is captioned "ping echo request (we will name the protocol in N4)" via `forward: [N12]`.
4. N5: instead of `iptables`, a fault switched on by the scenario: "the server has a filter enabled that silently drops packets to port 9000 (how it works — N10)". In netlab this is `faults: [{ on: srv, drop: { tcp_dport: 9000 } }]`; the rule is not shown to the learner.
5. 7.2: mark screens 4–6 with `gate: [N09]` and `gate: [N14]`, show screens 1–3 in N6; screens 4 and 5 open in N9 and N14 as a continuation of the same scene ("let's return to the envelopes").
6. N8: replace the sentence about CoreDNS with "short names and `search` — what DNS inside the cluster will stand on two blocks from now" with `forward: [K16]`.

### 4. BLOCKING — there is no documentation ladder (R2)
**Where:** the whole document; the closest are "7.3.3. Command set" (an unsupported flag → a link to man) and "11. Pluggable AI".
**What is wrong.** R2 is mandatory for every block: steps 1–5; for the beginner, documentation first "flickers", then comes a man fragment with a highlighted line, then "find the flag", then enforcement (tasks on flags not covered in the theory, the AI asks "where did you look?"), then an exam with official documentation only. The experienced start at the third step. 03 has none of this. In addition, enforcement tasks require flags that are not in the simulator's list (7.3.3). Without tier B (finding 1), step 4 is technically impossible in the block: the simulator will answer `flag -X is not simulated`.
**Fix.** Add a section "Documentation ladder" — ready text in part 6: rules, the set of official sources, tasks for each module at steps 1–4 with checks, the step 5 exam, the AI's behavior.

### 5. BLOCKING — there is no map of the internet and no protocol catalog (R8); the block explicitly excludes what R8 requires
**Where:** "1. What the block must give and what it does not do" ("What the block deliberately does not do: … STP, OSPF/BGP, VLAN trunks…"); N0.
**What is wrong.** R8 requires going from the big picture to the packet: (1) a zoomable map of the internet (laptop, home router, provider, backbone, IXP, submarine cables, data center; AS and BGP, root DNS, CDN); (2) OSI/TCP-IP as nested envelopes (present, 7.2); (3) each layer by hand (present); (4) end-to-end processes (the URL is present; 504 only as a scenario). A protocol catalog with a uniform card, split by level: beginner — DHCP, ARP, ICMP, TCP, UDP, DNS, HTTP, HTTPS/TLS, SSH; intermediate — NTP, SMTP, FTP/SFTP, HTTP/2, HTTP/3 QUIC, WebSocket, gRPC, VLAN, NAT/PAT; experienced — BGP, VXLAN/Geneve, IPsec, WireGuard, mTLS, OSPF at the level of the idea. 03 has no map, no catalog, no SSH (concept N18 from 01 is assigned to the block, but the protocol analysis is missing). VLAN, BGP and OSPF are explicitly excluded.
**Fix.**
- In section 1, replace the sentence with: "The block does not teach the configuration of network hardware (Cisco IOS, STP, MPLS, wireless networks). VLAN, BGP and OSPF are part of the protocol catalog at the level of idea and observation: what they do, at which layer, what they look like in a capture and in the cloud. The learner will not configure them".
- Replace N0 "The network as a postal service" with a module "How the internet works" (storyboard E-N0 in part 4). Keep the postal metaphor as one sentence in the text, without a scene (see also finding 10).
- Add a section "Protocol catalog" (part 5: card format, 24 cards with key content, linking to modules).

### 6. BLOCKING — process explanations in the R4 style exist only for the URL; for the other R3 processes there are none, and the TCP model does not provide the parameters R4 asks to change
**Where:** "7. Interactives in detail"; "7.3.2. Model" ("the window is fixed", "congestion control is not modelled").
**What is wrong.** R3 lists for networks: entering a URL, DNS resolution, the TCP+TLS handshake, a packet through NAT/a router, where a 504 comes from. R4 requires for each a diagram of blocks and arrows with captions on the lines, "one scene — one idea", clickable elements, sliders and switches (the TCP window size is named explicitly), "break it" removes a component, recalculation of the process with an explanation of the change, rewinding steps forward and backward. In 03 a full storyboard exists only for the URL (7.1) and for the envelopes (7.2). DNS, the handshake, the router/NAT and 504 exist only as stages of 7.1 and scenario T1, without their own parameters and "break it". A "TCP window" slider cannot be made with a fixed window.
**Fix.** Six storyboards in part 4 (E-N0…E-N5) plus E-N6 for N16. The TCP model needs a separate analytical mode to explain the window: throughput ≈ min(window/RTT, bandwidth), queueing and loss. This does not complicate the netlab core: the mode is computed by a formula and a short sender model inside the widget.

### 7. BLOCKING — nginx retries are modelled wrongly: T1 lasts 120 s, not 60, and T12 does not reproduce on real nginx
**Where:** "7.6. Troubleshooting scenarios": the T1 format, "The full T1 scenario tree", the scenario table (T1, T2, T12); "N13"; "7.3.2. Model", the list of nginx directives; "10. Part B", item 5.
**What is wrong.** By default nginx has `proxy_next_upstream error timeout;`, every `server` in an `upstream` has `max_fails=1` and `fail_timeout=10s`, and `proxy_next_upstream_tries 0` and `proxy_next_upstream_timeout 0` do not limit retries ([ngx_http_proxy_module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_next_upstream), [ngx_http_upstream_module](https://nginx.org/en/docs/http/ngx_http_upstream_module.html#server)). Consequences:
- **T1** (`app1` and `app2`, both with a 75 s delay): GET is idempotent. After a 60 s timeout on `app1`, nginx retries the request on `app2` and waits another 60 s. The client gets a 504 after about 120 s, and `error.log` has **two** lines `upstream timed out … while reading response header from upstream` with different `upstream:` values. Step 1 of the tree ("after 60 s") and the observations diverge from real nginx. In part B, the same exercise on a real VM will show a different time.
- **T2** (DROP on both `app`s): a 504 after 2 × `proxy_connect_timeout` = 120 s, two lines `while connecting to upstream`.
- **T12** ("one of two backends is down, no health check configured → half of the requests get 502"): on an RST from the dead backend, nginx immediately retries the request on the live one, and the dead one is marked unavailable for 10 s. The client sees 200, not 502. The passive check (`max_fails`) is on by default; nginx OSS has no active `health_check` at all, that is an nginx Plus directive. The described symptom will not occur on real nginx.
- **N13**, the task "turn off one backend and look at the behavior without a health check and with it" is built on the same misconception.
**Fix.**
1. Add to the nginx model (7.3.2) `proxy_next_upstream` (values `error timeout invalid_header http_500 http_502 http_503 http_504 http_429 non_idempotent off`), `proxy_next_upstream_tries`, `proxy_next_upstream_timeout`, and for `server` the parameters `max_fails` (default 1), `fail_timeout` (10 s), `backup`, `down`. Retries and marking as "unavailable" must work as in nginx. The golden record for T1/T2/T12 is captured from real nginx on `lab-net` (see finding 21).
2. Replace T1, step 1, with the text: "`curl -sv http://shop.lab/report` from `client`: after 120 s of simulated time, `HTTP/1.1 504 Gateway Time-out`. Debrief: the 504 came from nginx, so DNS, TCP and TLS up to the load balancer are fine. Why 120 and not 60: nginx honestly waited 60 s for the first backend and another 60 s for the second — by default it retries the request on the next server on a timeout (`proxy_next_upstream error timeout`)". Step 3: "`error.log` has two lines, one for each `upstream:`". Add an observation `see-two-upstreams` and a debrief question "why are there two lines".
3. Rewrite T12:
   > T12 | Every second request is a 500 | `app2` is alive at the TCP level, but has lost its connection to the DB and itself answers 500. nginx does not consider HTTP 500 an upstream error (by default `proxy_next_upstream` has only `error timeout`) and passes the response to the client | alternating 200/500 in `curl -w '%{http_code}'`; `access.log` with the `$upstream_addr` field; `curl` to `app2` directly gives 500; the `app2` log: `db connection refused` | I, E
   
   Separately, for E: T12b "the backend is off, and there are no errors, but every tenth request hangs 1 ms longer": the passive check `max_fails/fail_timeout` tries the dead server again every 10 s. The key observation is `error.log` every 10 s: `connect() failed (111: Connection refused) while connecting to upstream`, while the client gets 200.
4. N13, the task: "turn off `app2`: the client still gets 200, and `error.log` shows `connect() failed (111…)`. Explain who saved the request (`proxy_next_upstream`). Then set `proxy_next_upstream off` and repeat: now half of the requests get 502. Restore the setting and explain why retrying a POST is more cautious by default (`non_idempotent`)".

### 8. BLOCKING — three network models instead of one (netlab, `engine/net.ts` in dsim, cni-lite/kube-proxy-lite in kube-lite)
**Where:** "Decision 2"; "13. Dependencies"; cf. 04, `engine/net.ts`; 05, section 5.2 (`cni-lite`, `kube-proxy-lite`); 09, 1.3 and 1.7 ("one state in one worker").
**What is wrong.** 03 declares "one network model for the whole course" but does not define the interface through which dsim and kube-lite write into netlab. As a result, each of us wrote our own: dsim has its own IPAM and port table, and I in 05 have my own veth, VXLAN and iptables rule model. The Service visualizer in 05 (6.4) promises that "packets really pass through this model". If the model is a separate one, it will diverge from what was taught in N10.
**Fix.** Add a section "7.3.6. The netlab programming interface for other engines" to 03. Then dsim and kube-lite turn into netlab configurators: they do not model packets themselves but create devices and rules in netlab and subscribe to events. Proposed text:

```ts
// netlab/api.ts — the only way dsim and kube-lite change the network
interface NetlabApi {
  host(id: string, opts?: { kind?: 'host' | 'netns'; parent?: string }): HostRef; // a netns lives inside its parent host
  link(a: IfSpec, b: IfSpec): void;                 // a cable or a veth pair (if both ends are in one parent)
  bridge(host: string, name: string, addr?: string): void;      // a Linux bridge with an address: docker0, cni0
  enslave(host: string, ifname: string, bridge: string): void;
  addr(host: string, ifname: string, cidr: string): void;
  route(host: string, r: { dst: string; via?: string; dev?: string; table?: number }): void;
  tunnel(host: string, t: { kind: 'vxlan' | 'wireguard' | 'geneve'; name: string; vni?: number; local: string; remote?: string; dstport?: number }): void;
  nfRestore(host: string, text: string, flavor: 'iptables-save' | 'nft'): void;  // atomic replacement, like iptables-restore
  sysctl(host: string, key: string, value: string): void;
  service(host: string, svc: ServiceSpec): void;    // a process model listening on a port (nginx, coredns-lite, app)
  on(ev: 'packet' | 'verdict' | 'conntrack', cb: (e: SimEvent) => void): Unsub;
}
```

kube-proxy-lite generates `iptables-save` (or `nft`) text and passes it to `nfRestore`, cni-lite calls `host(kind:'netns')`, `link`, `bridge`, `route` and `tunnel`, and dsim does the same for `docker0` and `-p`. The obligation of 03: netlab's netfilter supports everything the real kube-proxy generates (finding 16). The obligation of 05 (I take it on): remove our own packet models from 05 and keep only the rule generators and IPAM.

### 9. BLOCKING — the check contract does not match 09 (facts → predicates)
**Where:** "7.3.4. Lab format" (`checks: state/probe/trace`); "8.3. Questions"; "10. Part B" (`dtcheck-net`).
**What is wrong.**
- 09, 2.4: a single form `goals` with `when`/`needs`/`fail`, and "`probe` is allowed only with `envs: [vm]` or `[v86, vm]`". 03 builds almost all checks on a `probe` in the simulator snapshot, i.e. on tier A, where 09 forbids them.
- Part B: its own script `dtcheck-net` and "no tamper protection is done", while 09 (5.4) has `trainer-check` with `facts.sh` and an `attest` signature for tier C.
- A key leak: in part B, `wg show all dump` is presented as "without private keys", but the first line of each interface in the `dump` output contains the **private key** ([wg(8)](https://man7.org/linux/man-pages/man8/wg.8.html), section `show … dump`). The learner pastes the report with it into the browser, and from there it may go to an external neural network.
**Fix.**
1. Propose to 09 (and write into 03) a fact area `net.reach`. On tier A it is filled by the netlab fact collector by running the requested probes in a copy of the world. The world does not change in the process, so this is an observation, not a `probe` in the sense of 09. On tiers B and C the same area is filled by `facts.sh` (`ping -c3 -W1`, `curl -m5 -w`, `dig +short`).
2. The example from 7.3.4 in the 09 format:

```yaml
goals:
  - id: g-route
    say: { ru: "У h1 есть путь к сети 10.0.2.0/24 через r1", en: "h1 has a route to 10.0.2.0/24 via r1" }
    needs: [net]
    when: "net.routes[machine=h1][dst=default][gateway=10.0.1.1] || net.routes[machine=h1][dst='10.0.2.0/24'][gateway=10.0.1.1]"
    envs: [sim, v86]
    fail:
      - if: "!net.routes[machine=h1][dst=default] && !net.routes[machine=h1][dst='10.0.2.0/24']"
        say: { ru: "У h1 нет маршрута, который подходит к 10.0.2.10. Посмотрите `ip route get 10.0.2.10` на h1", en: "..." }
        term: N03
  - id: g-reach
    say: { ru: "h1 пингует h2", en: "h1 can ping h2" }
    needs: [net.reach]
    reach: [{ from: h1, icmp: 10.0.2.10, count: 3 }]
    when: "net.reach[from=h1][to='10.0.2.10'].received>=2"
    envs: [sim, v86]
    fail:
      - if: "net.reach[from=h1][to='10.0.2.10'].stage=reply-no-route"
        say: { ru: "Запрос дошёл до h2, а ответ потерялся: у h2 нет пути обратно", en: "..." }
        term: N03
```

   The `stage` field (the stage at which the probe failed) is exactly "as in Miminet"; it must be added to the facts schema.
3. Part B: replace `dtcheck-net` with `trainer-check net-exam` from 09, with `facts.sh` and `attest`. For WireGuard collect `wg show all dump | awk 'NF==5{$2="(hidden)"}1'`, or better `wg show all latest-handshakes`, `wg show all endpoints`, `wg show all allowed-ips`: these subcommands do not print the private key. Add a filter of `PrivateKey` lines for `wg showconf` to `facts.sh`.
4. Reduce the question types of 8.3 (`single | multi | number | text | capture | command | lab`) to the vocabulary of 08 (3.8) and 10 (`choice`, `order`, `match`, `hotspot`, `predict`, `fill`, `explain`, `task`). `capture` and `command` are a `task` with the source "capture" or "simulator", `number` is `fill`. Otherwise the bank in 10 will not build.

### 10. MAJOR — the visual language contradicts R4/R5 and 08: ink on the topology, a metaphorical scene N0
**Where:** "6. General rules for interactives" ("links are drawn 'in ink' when they appear (the `engine/ink.ts` idea)"); "N0. The network as a postal service" ("a scroll scene in the style of Sankofa special projects").
**What is wrong.** R5: clean engineering graphics in the spirit of Ciechanowski and Comeau, not Sankofa ink (from Sankofa we take only the text presentation, scroll scenes, layers, calm mode, lenses, QR, bilingual YAML, draft/hold). R4: no characters and no plot. 08 (5.1) also allows ink only for metaphors and forbids it for mechanisms, and a network topology is a mechanism.
**Fix.** In section 6, replace the item "Topology canvas" with: "An SVG blueprint following the rules of 08, 5.1: a 1.5 px line, an 8 px grid, monospaced value captions on the lines (address, port, VNI). Color encodes the layer: L2 one tone, L3 a second, L4 a third, L7 a fourth; the same palette in the envelopes of 7.2, the packet scope and the animator. A link appears by drawing the line in 200 ms, without 'hand drawing'". Agree the layer palette with 08, 5.2 (it currently has "kernel/user space" and k8s components, but no network layers). Replace N0 with E-N0 (part 4).

### 11. MAJOR — "What happens when you type a URL" is described twice, in 03 (7.1) and 08 (6.3), and the descriptions diverge
**Where:** 7.1; cf. 08, 6.3.
**What is wrong.** Two storyboards of one flagship: different domains (`shop.example` and `shop.example.com`), a different nginx timeout (60 s in 03 and "nginx waits 30 seconds" in 08), a different order of introduction (in 08 OSI is assembled in scene 10 inside the explanation, in 03 in module N6), a different "fog".
**Fix.** Write in both documents: "The engine, widgets and visual language — 08, 6.3. The content of the stages, the packet fields, the breakages and the checks — 03, 7.1, the source of truth". One domain: `shop.example` (the reserved TLD `.example`, RFC 2606/6761; in netlab this is the `example.` zone). In 08, replace 30 s with "`proxy_read_timeout 60s` by default" or say explicitly "the config sets 30 s".

### 12. MAJOR — in 7.1 ARP comes after DNS, and HTTP/2 with ALPN `h2` contradicts the HTTP/1.1 model
**Where:** 7.1, the stage table (stages 2–4, 7, 8, 12).
**What is wrong.**
- The DNS query goes to a resolver behind the gateway (or to the router `192.168.1.1` itself as a DNS forwarder), which means ARP for the gateway's MAC happens **before** stage 2, not at stage 4. A learner who went through N3 attentively will notice the error.
- Stage 7 shows `alpn=h2,http/1.1`, stage 12 `HTTP/2 200`, while stage 8 shows text headers. Netlab and the dissectors know only HTTP/1.1 (decision 3, 7.3.2). HTTP/2 is binary HEADERS frames with pseudo-headers `:method`, `:path`; there is no textual `GET /catalog HTTP/1.1` in it.
**Fix.** Rename stage 4 to "ARP for the gateway's MAC — it happened even before the DNS query; we show it here because now it is clear why" and show it in the fog as a flash before stage 2. At stage 7 the server chooses `http/1.1` (captioned in the scene: "in the training network the server chose HTTP/1.1; a real CDN would more likely choose h2 or h3 — see the HTTP/2 and HTTP/3 cards"). Add an "HTTP/2" switch as an illustration: HEADERS/DATA frames in the inspector, without support in the terminal. At stage 12 — `HTTP/1.1 200 OK`.

### 13. MAJOR — the answer to placement question 6 for "Experienced" is wrong for modern resolvers (QNAME minimization)
**Where:** 4.2, "Confirming the 'Experienced' level", task 6.
**What is wrong.** The answer "the root is asked the same question `api.example.com A`" was correct before QNAME minimization (RFC 9156, previously RFC 7816). Unbound, Knot Resolver, PowerDNS Recursor and BIND (in the default `relaxed` mode) ask the root for `com. NS` (or `com. A`) without revealing the full name. An experienced learner who has seen a capture of a real resolver will "fail" on correct knowledge.
**Fix.** "Answer: a resolver without QNAME minimization asks the root the full question `api.example.com A`; a resolver with minimization (RFC 9156, the default in Unbound, Knot Resolver, BIND) asks only for `com.`. In both cases the root answers not with an address but with a delegation: the NS records of the `com.` zone and glue addresses. Both variants are accepted if the answer 'delegation' is named". Add a "QNAME minimization" switch to E-N2 (part 4).

### 14. MAJOR — the `curl` messages are taken from old versions; modern curl prints `Couldn't connect to server`
**Where:** 7.1, the "Break it" table (the "Port closed" row); N15 (the "symptom — packets" table); T3, T4; the N5 quiz.
**What is wrong.** curl 8.x (Debian 13, Ubuntu 24.04, macOS) without `-v` writes `curl: (7) Failed to connect to 127.0.0.1 port 1 after 0 ms: Couldn't connect to server`. The words `Connection refused` appear only in the `-v` line: `* connect to 127.0.0.1 port 1 from 127.0.0.1 port 58424 failed: Connection refused`. Checked on curl 8.7.1 while writing this review. A timeout looks like `curl: (28) Connection timed out after 3006 milliseconds`; that one matches. The teaching link "refused = RST" is not visible in curl output without `-v`.
**Fix.** In all tables, give a pair of lines: `curl -v` → `connect to … failed: Connection refused`, and the result → `(7) … Couldn't connect to server`. Introduce a rule: "code 7 means we did not get through; read the reason in `-v`, `nc -v` or `ss`". Take the reference output format of all utilities from the `lab-debian` image (finding 21), not from "Debian 12/Ubuntu 24.04" at once: they have different curl (7.88 and 8.5) and iproute2.

### 15. MAJOR — the level routes inside the document contradict each other and do not match the placement from 01
**Where:** 4.1 (routes), 5 (B/I/E marks on modules), 4.2 (checks); cf. 01, 4.3 "Networks", 13 "Time budget".
**What is wrong.**
- 4.1: for the intermediate, N2–N7 "in condensed mode", while section 5 marks N3 as "B, I, E in full", N4 as "all levels in full", N5 as "B, I in full".
- 4.1: for the experienced, "N3, N4, N9, N10, N13–N15 in full, the rest via entry tests", while section 5 marks N8 and N12 as "all levels in full", N6 as "all levels".
- In 01 (4.3), networks have their own L1/L2 check with 7 tasks each (P/T/E, with key tasks). In 03 there are 8 and 10 tasks with a different composition. It is unclear which check applies.
- Hours: 01 allots 45/28/12 hours to networks, 03 gives 35–45/20–25/10–14.
- R2: the experienced start at the third step of the documentation ladder. This is missing.
**Fix.** One route table (insert into 4.1 and remove the level marks from the section 5 headings):

| Module | B | I | E |
|---|---|---|---|
| net.m00 Map of the internet | in full | in full | express (5 min) |
| m01 Frame, MAC | in full | entry test | entry test |
| m02 IP, subnet | in full | condensed | entry test |
| m03 ARP | in full | in full | in full |
| m04 Routing | in full | in full | in full |
| m05 TCP/UDP | in full | condensed | condensed |
| m06 Envelopes | in full | in full | condensed (counting tasks in full) |
| m07 DHCP | in full | condensed | entry test |
| m08 DNS | in full | in full | in full |
| m09 NAT | in full | in full | in full |
| m10 Netfilter | basic part | in full | in full |
| m11 HTTP | in full | condensed | entry test |
| m12 TLS | in full | in full | in full |
| m13 Proxy | basic | in full | in full |
| m14 VPN | the tunnel concept | in full | in full |
| m15 Troubleshooting | in full | in full | in full |
| m16 Networks within one kernel (new) | in full (tier A + one tier B lab) | in full | in full |
| Documentation ladder step at the start | 1 | 2 | 3 |

Placement: keep the 01 format (P*/T/E, key tasks) and treat the 03 tasks as a bank from which 01 takes its 7. Bring the hour budget in line with 01, or fix 01 with a justification (the new module m16 and the catalog add about 6/5/4 hours).

### 16. MAJOR — netlab's netfilter does not support what kube-proxy generates; without it there will be no R9 drill "find in iptables where the packet to a ClusterIP goes"
**Where:** 7.3.3, the `iptables` and `nft` rows; 7.3.2 "Netfilter".
**What is wrong.** R9 requires the drill "find in iptables where a packet to a ClusterIP goes", and 05 (6.4) draws the chains `KUBE-SERVICES → KUBE-SVC-* → KUBE-SEP-*` with `statistic --mode random --probability`. The 03 list lacks `-m statistic`, `-j MARK`/`-m mark`, `-m addrtype --dst-type LOCAL` (`KUBE-NODEPORTS` stands on it), `-m recent`, the `raw`/`mangle` tables and `-j TRACE`. nft lacks `numgen random mod N vmap { … }`, `map`/`vmap`, `fib daddr type local`, `meta mark set`, `meta nftrace set 1` — and this is exactly how kube-proxy writes rules in nftables mode, the main one starting with v1.33.
**Fix.** Extend the `iptables` row: "`-t raw/mangle`, `-m statistic --mode random --probability P`, `-m mark --mark`, `-j MARK --set-xmark`, `-m addrtype --dst-type LOCAL`, `-j TRACE`, `-j KUBE-…`-style user chains with `RETURN`; `iptables-save`/`iptables-restore` as the main way to work with large rule sets". The `nft` row: "`numgen random mod N`, `map`, `vmap`, `fib daddr type local`, `meta mark`, `meta nftrace set 1` + `nft monitor trace`". In N10, add a subtopic for I/E "User chains and jumps" and a drill D-NF "walk the chains" (part 8, drill 1). It is also the preparation for R9.

### 17. MAJOR — N10 has no nat OUTPUT chain; Service and `-p` cannot be explained without it
**Where:** N10; 7.3.2.
**What is wrong.** A packet created by a process on the host itself goes through OUTPUT → POSTROUTING, and DNAT for it is done in `nat OUTPUT`. Docker hooks `DOCKER` into both PREROUTING and OUTPUT. kube-proxy jumps into `KUBE-SERVICES` from both. In 04 (step 5 of interactive 3) the learner already writes `iptables -t nat -A OUTPUT … -j DNAT`. In 03, OUTPUT is mentioned only among the hooks, without DNAT and without a task.
**Fix.** In N10, after DNAT in PREROUTING: "A packet born on this same host does not go through PREROUTING. That is why `curl 127.0.0.1:8080` on a router with port forwarding does not work until the DNAT is duplicated in `nat OUTPUT`". Task: "Forwarding 8080 → 10.0.2.20:80 works from outside but not from `gw` itself. Fix it". Check: `net.reach[from=gw][to='127.0.0.1:8080'].http=200 && net.iptables.nat.OUTPUT~'DNAT'` (or the nft equivalent). For E, a footnote about `route_localnet`.

### 18. MAJOR — N9/N15 have no rp_filter; route asymmetry on real Linux often "goes silent" precisely because of it
**Where:** N4 (asymmetry), T10, N15.
**What is wrong.** T10 is presented as "no route back". On real Linux, the second typical cause of silent dropping under asymmetry is `net.ipv4.conf.*.rp_filter=1` (strict reverse path checking; systemd distributions default to 2/loose). The same phenomenon occurs in multi-interface cloud VMs and with CNIs.
**Fix.** Add T13 for E: "Replies from a server with two interfaces do not arrive, although the route exists". The cause is `rp_filter=1`; the observation is `sysctl net.ipv4.conf.all.rp_filter`, the capture shows incoming packets without replies, `nstat -az TcpExtIPReversePathFilter` (or the `ip -s` counters). The scenario is placed at ladder step 4: `rp_filter` is not introduced in the theory, it is looked up in `ip-sysctl` ([kernel docs](https://docs.kernel.org/networking/ip-sysctl.html)).

### 19. MAJOR — part B of the exam has no cost, no mandatory cleanup and no unified VM mechanism
**Where:** "10. Part B".
**What is wrong.** Following R12 (stage 3), on real VMs the trainer does not execute but guides and checks, shows the cost and requires a cleanup step. Part B has neither a price, nor a deletion step, nor a reference to 09, section 5, which describes where the learner gets machines (their own cloud or local VMs).
**Fix.** Add to part B:
> 0. Choosing the venue: one's own cloud following the instructions from 05, 10.2 (the two smallest VMs; the calculator shows the price for 3 hours and for a day if you forget to delete them) or two local VMs on one's own computer (09, 5.3), which cost nothing.
> 6. Cleanup (a mandatory step; without it the exam does not close): in one's own cloud, a delete command and a check: `trainer-check cleanup` from the learner's machine queries the cloud API by the label `dt-exam=net` and confirms that the VMs and public addresses have been deleted; local VMs on one's own computer the learner deletes on their own, and they cost nothing.

### 20. MAJOR — the `dt-kernel` kernel skeleton does not contain the options the tier B network labs need
**Where:** a dependency that is missing from 03; cf. 09, 1.4 (the list of configuration fragments).
**What is wrong.** 09 lists `VETH`, `BRIDGE`, `NF_TABLES`, iptables-legacy, but not `WIREGUARD`, `VXLAN`, `NET_SCH_NETEM` (real delays and losses for T8 and E-N3 on tier B), `IP_MULTIPLE_TABLES` (`ip rule`, step 4), `NETFILTER_XT_MATCH_STATISTIC`, `NETFILTER_XT_MARK`, `NETFILTER_XT_MATCH_ADDRTYPE`, `NETFILTER_XT_TARGET_TRACE`, `NF_CONNTRACK` + `NF_NAT` + `NETFILTER_XT_TARGET_MASQUERADE`, `BRIDGE_NETFILTER` (`br_netfilter`; without it kube-proxy and Docker do not see packets on the bridge), `NET_IPIP`/`NET_IPGRE` (comparing tunnels), `TUN`.
**Fix.** Add to 03 a section "Requirements for the `lab-net` image" with this list (built in, not as modules — for the same reason as in 04) and the packages: `iproute2`, `iptables`, `nftables`, `conntrack`, `tcpdump`, `wireguard-tools`, `dnsmasq`, `bind9-dnsutils`, `curl`, `nginx-light`, `openssl`, `netcat-openbsd`, `traceroute`, `iputils-tracepath`, `ethtool`, `socat`, `man-db` with the pages for all these commands (without man, steps 2–4 do not work on tier B).

### 21. MAJOR — there is no mechanism for checking netlab output against the real utilities
**Where:** 7.3.3 ("the output reproduces the format of the real utilities").
**What is wrong.** 09 (1.3) requires "golden records", and in 05 (5.7) kube-lite has a double test run on k3s and on the simulator. netlab has no such mechanism, and findings 7 and 14 show that discrepancies already exist.
**Fix.** "Every scenario and every lab from 7.3–7.6 has a twin on `lab-net`. CI runs the same sequence of commands in netlab and in v86 (headless, Node.js) and compares the outputs after normalization (time, ports, MAC). A discrepancy above the tolerance makes the build red. A scenario without a twin is not published (`hold`)".

### 22. MAJOR — the principle "every problem is tied to a layer" is not carried through the scenarios and the debrief
**Where:** N15; 7.6.
**What is wrong.** R8: "first ask at which layer it broke". N15 has a layer-by-layer method, but the scenarios have no layer field, and the debrief does not start with a question about the layer.
**Fix.** Add `layer: L2|L3|L4|L7|TLS|DNS` to the scenario format and a first debrief line: "At which layer did it break? How did you prove it?". In the hypothesis notebook, a mandatory "layer" field. In the T1–T13 table, a "layer" column: T1 L7, T2 L4 (filter), T3 L4, T4 L4 (bind address), T5 DNS, T6 DNS, T7 TLS, T8 L3 (PMTU), T9 L3 (NAT/forward), T10 L3, T11 L2/L3 (DHCP), T12 L7, T13 L3. Plus the drill "Which layer?" (part 8, drill 2).

### 23. MAJOR — the preparation for Kubernetes networking (R9) is not marked as an output of the block
**Where:** "13. Dependencies", the item "Kubernetes block".
**What is wrong.** The item boils down to a list. R9 is a large separate section in 05, and it needs specific skills from networks: veth+bridge on a node, routing between nodes without NAT, VXLAN (VNI, UDP 8472 in flannel and Cilium, 4789 per IANA), DNAT and conntrack for ClusterIP, walking the chains, `search`/`ndots` and extra queries, eBPF as the idea "rules not in iptables", NetworkPolicy as a filter on the CNI.
**Fix.** Replace the item with a table "what the Kubernetes block takes and where it is introduced":

| R9 topic in 05 | What must be introduced in networks | Where in 03 |
|---|---|---|
| Network model: a pod has its own IP, no NAT | routing without NAT, netns as "a host without hardware" | m04, m16 |
| Pod to pod on a node | veth, bridge, ARP inside the bridge | m16, lab 1 |
| Pod to pod between nodes | a route to a foreign subnet via a node; VXLAN | m16, labs 3–4; the VXLAN card |
| ClusterIP is not on any interface | DNAT in PREROUTING and OUTPUT, conntrack | m09, m10 (finding 17) |
| kube-proxy iptables/nftables | user chains, `statistic`, `vmap`, `iptables-save` | m10 + drill D-NF |
| Cilium eBPF | one scene "rules may live outside netfilter": a tc/XDP hook, `bpftool` as an idea | m16, a screen for E |
| CoreDNS, `search`, `ndots` | `search` domains, the order of attempts, NXDOMAIN as normal | m08 + the "ndots" lab (part 3) |
| Ingress, Gateway API | reverse proxy, L7, 502/504, `Host`, SNI | m11–m13 |
| NetworkPolicy | stateful filter, default deny, established | m10 |
| "the pod cannot reach the service" | the order DNS → address → port → filter | m15 |

### 24. MINOR — inaccuracies in facts and outputs

| No. | Where | What is wrong | Fix |
|---|---|---|---|
| 24.1 | 7.2, screen 1 | `GET /catalog HTTP/1.1\r\nHost: shop.example\r\n\r\n` is 45 bytes, not 46 | "45 bytes of payload, 54 bytes of headers" |
| 24.2 | N5, the concept table | `ss` prints `ESTAB` and `TIME-WAIT`, not `ESTABLISHED`/`TIME_WAIT` (that is `netstat`) | "states (in `ss`: `LISTEN`, `ESTAB`, `TIME-WAIT`, `SYN-SENT`)". `SYN-SENT` is needed in T2 and in 10, 9.2 |
| 24.3 | 7.3.3, `tcpdump` | Linux sends a SYN with `[mss 1460,sackOK,TS val … ecr 0,nop,wscale 7]`; an example with only `mss` is not the "real format", and exercise 7.2 about timestamps contradicts a model without options | Model SACK-permitted, timestamps, wscale at least as fields; the output as on `lab-net` |
| 24.4 | 7.1 "Break it" | "The authoritative TLD answers NXDOMAIN" for `shop.exmaple`: the TLD `exmaple.` does not exist, NXDOMAIN comes from the root | "The root server answers NXDOMAIN: there is no such TLD" |
| 24.5 | 7.1 "Break it" | "No gateway in DHCP: nobody to ARP": without a route the kernel immediately answers `connect: Network is unreachable`, ARP does not start | The "packets" column: "none — the kernel did not find a route"; the command: `ping 8.8.8.8` → `ping: connect: Network is unreachable` |
| 24.6 | 7.1 "Break it" | Chrome's message on SERVFAIL — `DNS_PROBE_FINISHED_BAD_CONFIG` — is not verified; more often it is `ERR_NAME_NOT_RESOLVED` | Put on `hold` until captured on the test bench |
| 24.7 | 7.1, stage 7 | `key_share x25519`: Chrome since version 131 and Firefox offer the hybrid `X25519MLKEM768` + `x25519` | Show both, with a footnote for E, "post-quantum key exchange" |
| 24.8 | 4.2, "Intermediate", 5 | Besides 301/308 and HSTS, Chrome itself tries HTTPS for `http://` (HTTPS-Upgrades) | Add "or the browser tried HTTPS itself" to the correct option |
| 24.9 | 7.6, T1 | "Origin is down → RST" is true for a crashed process; a powered-off machine gives a timeout (504) or `113: No route to host` (502) | In 7.1, separate "the process crashed" (502, 111) and "the machine is off" (504 or 502/113) |
| 24.10 | 2, Wiregasm | Wireshark is GPL-2.0-or-later, i.e. compatible with Apache-2.0 via GPLv3; the argument "incompatible" is inaccurate, the copyleft would extend to the product anyway | "GPL copyleft would extend to the whole client; plus the wasm size" |
| 24.11 | N7, 7.3.3 | Ubuntu 24.04 has no `dhclient` by default (dhcpcd/networkd); ISC DHCP is no longer maintained | The reference is `lab-debian`; for E — `networkctl status`, `journalctl -u systemd-networkd` |
| 24.12 | 7.4, D9 | `10.244.0.0/16` is the flannel default, kubeadm has no default pod CIDR; 05 uses the k3s values `10.42.0.0/16`, `10.43.0.0/16` | Caption it "flannel/kubeadm"; add a k3s variant so that the numbers match 05 |
| 24.13 | 7.3.5 | The netlab budget is 150 KB gzip versus 80 KB in 09 (1.3) | Agree one number with 09 |
| 24.14 | 10, part A | A threshold of 75 of 90 allows passing without fixing one of the two breakages in item 7 | A threshold of 75 and a mandatory condition "both breakages found (hypothesis ≥ 5 points each)" |
| 24.15 | 6, sound | 03 forbids sound, 08 (3.6) makes it an option | Keep the 08 decision (off by default) |
| 24.16 | 7.6, AI | "Until the learner asks three times" is its own ladder instead of H1–H5 from 01 (14.2) | Refer to the 01 ladder; "I give up" = H5 |

---

## Part 2. How to close R1–R12 within the block: summary

| Requirement | What 03 has | What to add (where the text is) |
|---|---|---|
| R1 textbook, order, explanations, documentation | The order is strong; module texts are 3–6 lines each | For each module, a textbook chapter of 1500–3000 words with `introduces/uses`; the documentation ladder (part 6); E explanations (part 4) |
| R2 documentation ladder | none | Part 6 |
| R3 process explanations in every block | URL (7.1), envelopes (7.2) | E-N0…E-N6 (part 4) |
| R4 explanation style | partially (scrolling, lenses) | Parameters, "break it", recalculation with an explanation — in every storyboard of part 4 |
| R5 beauty | ink on the topology | Finding 10 |
| R6 Linux: isolation | not 03's area | m16 relies on R6 and does not reintroduce namespace |
| R7 containers: the network boundary | veth/bridge not introduced | m16 (part 3) |
| R8 big picture and catalog | none | E-N0, the catalog (part 5), finding 5 |
| R9 Kubernetes networking | — | Findings 16, 17, 23; m16; drill D-NF |
| R10 reconciliation loop | not 03's area | — |
| R11 several nodes in the browser | rejected | Part 7 |
| R12 three stages and VM cost | part B without cost and cleanup | Finding 19 |

---

## Part 3. Ready text: module m16 "Networks within one kernel" (insert after N14)

**Place.** After VPN (the tunnel is already familiar) and before troubleshooting (scenarios T14–T15 are built on it). It relies on R6 from Linux: process, namespace, `/proc/<pid>/ns`, `unshare`, `nsenter`, `lsns`. It introduces `N21` (the network namespace as a network stack), `N20` (veth and bridge), `N22` (VXLAN) and `N23` (routing between hosts without NAT).

**Why (chapter text, the beginning).** "Until now, every host in the lab was a separate machine. On a real server with Docker or on a Kubernetes node there are dozens of 'hosts', but only one machine. The kernel can hold many independent network stacks: each has its own interfaces, addresses, routes, netfilter rules and conntrack table. They are connected by virtual cables and virtual switches. Everything you did in m01–m14 repeats inside one kernel with the same commands".

### 3.1. Screens

1. **A network stack is a set of tables.** A diagram of one machine: interfaces, addresses, routes, the ARP cache, netfilter, sockets as five tables. A "create another stack" button duplicates the tables empty, with no interfaces except `lo` in the DOWN state. Command: `ip netns add red`, `ip netns exec red ip a`. Introduces N21.
2. **veth is a cable with two ends in different stacks.** `ip link add veth-red type veth peer name veth-red-br`, `ip link set veth-red netns red`. On the diagram the cable passes through the wall of the stack. Clicking an end shows `ip -d link` with `veth` and `link-netns`; the `@ifN` number links the ends. Introduces N20 (veth).
3. **A bridge is the switch from m01, only in the kernel.** `ip link add br0 type bridge`, `ip link set veth-red-br master br0`. The bridge's MAC table, `bridge fdb show`, fills up just as in m01. An address on the bridge makes it the gateway for the stacks. Introduces N20 (bridge).
4. **Getting out: a route + NAT.** In `red`: `default via 10.10.0.1`; on the host, `ip_forward=1` and `MASQUERADE` for `10.10.0.0/24`. This is `docker0` without Docker; the scene shows that Docker does the same four steps (a link to D7/R7b).
5. **Two machines: a route to foreign stacks without NAT.** On `node1` the stacks are in `10.42.0.0/24`, on `node2` in `10.42.1.0/24`. Solution 1: a route on `node1` `10.42.1.0/24 via <node2 IP>` and back. It works if the nodes are in one L2 segment. Introduces N23.
6. **VXLAN: when there is no direct route.** The whole Ethernet frame is put into UDP. Envelopes: the outer Ethernet/IP of the nodes, UDP with destination port 4789 (IANA; flannel and Cilium use 8472), an 8-byte VXLAN header with the VNI, and inside, the stack's frame. The overhead is 50 bytes, hence MTU 1450 inside. A comparison with WireGuard from m14: the same idea of "an envelope inside an envelope", but without encryption. Introduces N22.
7. **(E) Rules do not have to live in netfilter.** One screen: an eBPF program on a tc or XDP hook decides the packet's fate before netfilter. That is why on a node with Cilium without kube-proxy `iptables-save` is almost empty, yet services work. No Kubernetes terms: "a program loaded into the kernel". `forward: [K26]`.

### 3.2. Labs (tier B, `lab-net`; tier A is the same scenario in netlab with `kind: netns`)

| Code | Task | Check (09 predicates) |
|---|---|---|
| m16-l1 | On one machine, create the stacks `red` and `blue`, connect them through the bridge `br0` (10.10.0.0/24), get `red → blue` ping working | `ns[kind=net]#>=3 && net.links[type=bridge][name=br0] && net.reach[from=ns:red][to='10.10.0.3'].received>=2` |
| m16-l2 | Give `red` a way out to `203.0.113.1` through the host | `net.routes[ns=red][dst=default] && sysctl['net.ipv4.ip_forward']=1 && net.iptables.nat.POSTROUTING~'MASQUERADE' && net.reach[from=ns:red][to='203.0.113.1'].received>=2` |
| m16-l3 | Two machines `node1`/`node2`, stacks in `10.42.0.0/24` and `10.42.1.0/24`; using routes without NAT, make a stack on `node1` see a stack on `node2` by its address | `net.reach[from=node1:ns:a][to='10.42.1.10'].received>=2 && !net.iptables.nat.POSTROUTING[machine=node1]~'10.42.1.0/24'`; in the capture on `node2` the source address is `10.42.0.x` (`trace`: `capture[link=sw0][ip.src~'10.42.0.']`) |
| m16-l4 | The same, but the nodes are in different subnets behind a router that knows nothing about 10.42.0.0/16: bring up VXLAN `vni 42`, `dstport 4789` | `net.links[type=vxlan][vni=42]` on both nodes; in the capture on the router's link, UDP 4789 with inner 10.42.x; reach as in l3 |
| m16-l5 | "Why don't large responses get through?" — in VXLAN, the stacks' MTU was left at 1500 | Ladder step 3; `net.links[ns=a][name=eth0].mtu<=1450` and `net.reach[...].http_bytes>=100000` |
| m16-l6 (E) | The `ndots` lab: in the stack, `/etc/resolv.conf` has `search a.svc.lab svc.lab lab` and `options ndots:5`. How many DNS queries will be sent for `curl http://api.example.com`? Check with `tcpdump port 53` | `fill` = 4 (three `search` entries + the absolute name), confirmed by the capture; then fix it to an FQDN with a trailing dot — 1 query |

### 3.3. m16 quiz (sample)
- `match`: `ip netns`, veth, bridge, VXLAN → "a separate stack", "a cable between stacks", "a switch in the kernel", "a frame in UDP between machines".
- `choice`: "Does a packet from `red` to `blue` through `br0` go through the host's FORWARD?" — not by default, it is L2 inside the bridge; yes, if `br_netfilter` is loaded and `bridge-nf-call-iptables=1` (I/E, with an explanation of why Kubernetes requires this module).
- `fill`: the VXLAN overhead over IPv4 is 50 bytes.
- `predict`: in l3 the route on `node2` was deleted → what will `ping` from `node1` show, and what will the capture on `node2` contain (requests arrive, replies do not leave).

### 3.4. New concepts for `concepts.yaml`
`N20` veth and bridge (exists in 01), `N21` netns (exists in 01, requires `L27` and the namespace concept from R6), `N22 VXLAN` (requires N07, N20), `N23 routing between hosts without NAT` (N03, N21), `N24 eBPF as an idea` (L27; E only), `N25 search and ndots` (N09). Also `N26 BGP/AS` and `N27 IXP/CDN` from E-N0 — for the map, without depth.

---

## Part 4. Ready storyboards for process explanations (R3, R4)

Common rules for all: a blueprint per 08, 5.1; one screen, one idea; every element is clickable and opens a card (what it is, the field, the observation command, a link to the exact place in the documentation); a step bar with ←/→ rewinding, pause, speed 0.25×/1×/4× (the 08 stepper, 3.1). When a parameter changes, the process is recalculated immediately, and a line "what changed and why" appears on the right. Animation is only functional: an envelope moves along a line, a counter grows. The event source is `net.packet`/`dns.query` from netlab; on tier B, the same events from `vswitch`.

### E-N0. How the internet works (a new module m00, instead of "The network as a postal service")
A zoomable map with five zoom levels; the wheel or a gesture changes the scale, with a strip of levels on the left.
1. **Laptop and home router.** Two blocks, a "Wi-Fi" line, the caption `192.168.1.0/24` on the line. Clicking the router: "three devices in one box: a switch, a router, an access point" (we will go through them in m01–m09).
2. **Provider.** Router → an "optical fiber/cable" line → a "provider (AS 64500)" block. The caption on the line: "your public address `203.0.113.7`" (or "the provider's shared address, CGNAT `100.64.0.0/10`" — a "CGNAT" switch).
3. **Backbone and exchange points.** Several AS blocks with two kinds of lines between them: "transit (paid)" and "peering at an IXP (exchange)". The IXP block is captioned with an example (MSK-IX, DE-CIX). A "show BGP" switch: prefix announcements appear on the lines, "AS 64501: `198.51.100.0/24` via me". "Break it": "AS 64501 mistakenly announced someone else's prefix" — the traffic is recalculated and goes to the wrong place (the history of route leaks in one sentence, without a plot).
4. **Submarine cables and continents.** A schematic map (continent outlines with a 1 px line), 6–8 cables. A "distance" slider changes the counter "minimum latency" = distance / (200,000 km/s). Moscow → Frankfurt ≈ 2000 km → ≥ 10 ms one way; Moscow → New York ≈ 7500 km → ≥ 37 ms. The conclusion on the screen: "light in fiber cannot be sped up; this is why CDNs exist".
5. **Data center and CDN.** The "data center" block expands into racks → edge router → load balancer → servers. Next to it, a "CDN node in the user's city". A "CDN on/off" switch recalculates the RTT and the counter of "requests to the origin".
6. **Root DNS servers.** 13 names `a…m.root-servers.net`, each backed by many sites (anycast): an "anycast" switch shows that `k.root-servers.net` answers from the nearest city.
Checks: `order` "from the laptop to the data center"; `choice` "why a ping to another continent cannot be 5 ms"; `match` "AS, IXP, CDN, root server" ↔ purpose. Ladder: step 1 — links to [Cloudflare Learning: What is BGP](https://www.cloudflare.com/learning/security/glossary/what-is-bgp/), [root-servers.org](https://root-servers.org/), [submarinecablemap.com](https://www.submarinecablemap.com/).

### E-N1. A packet through a router and NAT (m04, continued in m09)
1. Diagram: `h1` — `r1` — `h2`; the subnets are captioned on the lines. The routing table of `r1` alongside; the relevant row is highlighted on selection.
2. The packet travels `h1 → r1`. Clicking the envelope opens the fields; the destination MAC is marked "the MAC of r1, not h2".
3. On `r1`: Ethernet is stripped, `ip.dst` is read, longest prefix match (the row is highlighted), TTL 64→63, the checksum is recalculated, a new Ethernet header. The "before/after" fields side by side, the changed ones highlighted.
4. Switches: **NAT** (MASQUERADE is enabled on `r1`: `ip.src` and the port change, both checksums, a row appears in the conntrack table; the return packet is rewritten back); **ip_forward** (off — the packet is absorbed on `r1`, the counter "dropped: forwarding off"); **return route on `h2`** (off — the request arrives, the reply goes the wrong way, a one-way ping).
5. A **TTL** slider (1…64): with TTL=1, `r1` answers with ICMP Time Exceeded — you can see how `traceroute` works.
6. "Break it": delete `r1` (the link breaks, `h1` gets `Destination Host Unreachable` from itself after three unanswered ARPs); delete the default route on `h1` (`Network is unreachable`, the packet is never born).
Explanation on change (example): "You turned on NAT. Now h2 sees the source 10.0.2.1:40001, not 10.0.1.10:51234. To return the reply, r1 recorded the mapping in conntrack".

### E-N2. DNS name resolution (m08)
1. Blocks: application → stub (`/etc/hosts`, `/etc/resolv.conf`) → recursive resolver → root → TLD `example.` → authoritative `shop.example`. Captions on the lines: the question and the answer ("`shop.example A?`" / "I don't know, here are the NS of `example.` and their addresses").
2. Steps, one exchange at a time; alongside, the output of `dig +trace` grows line by line.
3. Sliders: **record TTL** (30 s … 1 day) and **time since the last query** — while the TTL is alive, the arrows to the root fade, with the label "from cache, N s left"; **negative TTL** (SOA minimum) for NXDOMAIN.
4. Switches: **QNAME minimization** (the root is asked `example. NS?` instead of the full name — see finding 13); **`/etc/hosts` contains the name** (no exchanges start, while `dig` still asks the server — the difference between `getent` and `dig`); **`search` + `ndots`** (for I/E: you can see how many extra questions go out before the right one).
5. "Break it": remove the authoritative server (the resolver waits, SERVFAIL); a typo in the name (the root: NXDOMAIN); a wrong A record (someone else's address, `curl` goes to the wrong place); the resolver is unreachable (`;; connection timed out; no servers could be reached`).
6. Explanation on change (example): "TTL 300 s, 120 s have passed: the resolver answered from cache in 1 ms; the authoritative server never learned about this query".

### E-N3. TCP and TLS: the handshake and speed (m05, m12)
A sequence diagram: two verticals (client, server), time from top to bottom, arrows are packets with a caption on the line (`SYN seq=0`, `SYN-ACK`, `ClientHello SNI=shop.example`…).
1. TCP: three arrows; the counter "RTTs elapsed: 1".
2. TLS 1.3: ClientHello → ServerHello + {EncryptedExtensions, Certificate, CertificateVerify, Finished} → {Finished} + the HTTP request. The counter "until the first byte of the response: 3 RTT" (1 TCP + 1 TLS + 1 request).
3. An **RTT** slider (1…300 ms): all arrows stretch, the TTFB counter is recalculated. Explanation: "RTT 150 ms (Moscow — Singapore): 450 ms until the first byte, of which 300 ms are handshakes".
4. Switches: **TLS 1.2** (an extra RTT); **keep-alive/reused connection** (no handshakes); **0-RTT** (for E: data in the first flight, a footnote about request replay); **HTTP/3** (QUIC over UDP: transport and TLS in one exchange).
5. **Window and throughput.** Sliders: **TCP window** (16 KB … 4 MB), **RTT**, **link bandwidth** (10 Mbit/s … 10 Gbit/s), **loss** (0…5%). Counter: speed ≈ min(window / RTT, bandwidth); "in flight" is shown by filling a pipe with envelopes. Explanation: "a 64 KB window at an RTT of 100 ms gives no more than 5 Mbit/s, however wide the link is: the sender waits for acknowledgements". With loss — retransmissions and a drop in speed (a simplified model, captioned "qualitative").
6. "Break it": the server does not listen on the port (RST, instantly); a filter silently drops the SYN (retries after 1, 2, 4, 8… s, a counter up to 127 s — simulated time); an expired certificate (the client sends an alert, the connection is closed, a curl line).

### E-N4. Where a 504 (and a 502) comes from (m13, m15)
1. Blocks: client → nginx → `app1`, `app2` → DB. On the lines: timeouts (`proxy_connect_timeout 60s`, `proxy_read_timeout 60s`).
2. Steps: nginx → app connection; the request; waiting for the response headers; the response.
3. Sliders: **application delay** (0…120 s), **`proxy_read_timeout`** (5…120 s), **number of backends** (1…3). Counters: "code to the client", "how long the client waited", "lines in `error.log`". With a delay of 75 s, a timeout of 60 s and two backends — a 504 after 120 s and two lines. Explanation: "nginx retried the request on app2 (`proxy_next_upstream timeout`)".
4. Switches: **`proxy_next_upstream off`**; **POST instead of GET** (without `non_idempotent`, there is no retry after the request has been sent); **health check** — captioned honestly: "nginx OSS has only the passive check `max_fails`/`fail_timeout`".
5. "Break it": kill the `app1` process (RST → `111: Connection refused` → a retry on `app2` → 200 to the client; with `next_upstream off` — 502); drop packets to `app1` with a filter (`110 … while connecting` → 504 after `proxy_connect_timeout`); the DB is slow (504 "while reading response header"); `app1` returns 500 (500 to the client, no retry).
6. The screen's conclusion: a table "code — who said it — what it means", each row is clickable and plays its own scenario.

### E-N5. "What happens when you type a URL" — add R4 parameters to 7.1
Sliders **RTT to the CDN**, **DNS TTL**, **page size**; switches **HTTP/1.1 / h2 / h3**, **DoH** (the DNS query goes inside HTTPS to `1.1.1.1`, the "provider lens" no longer sees the name in DNS, but does see the SNI), **ECH** (for E: the SNI is hidden too). The waterfall is recalculated, with a "what changed" line on the right.

### E-N6. A packet between stacks of one kernel and between machines (m16; a bridge to D7 and K4)
1. A node diagram: two stacks, veth, `br0`, a route, NAT. A packet `red → blue` goes through the bridge (L2, it does not pass FORWARD). The `br_netfilter` switch shows what passes now.
2. `red → internet`: bridge → host routing → POSTROUTING MASQUERADE → `eth0`.
3. Two nodes: a switch "direct route / VXLAN / WireGuard". With VXLAN and WireGuard the envelope grows (the bytes are captioned), with the counter "payload at MTU 1500".
4. A **stack MTU** slider (1400…1500) with VXLAN: at values above 1450, large packets disappear (see T8).
5. "Break it": delete the veth (the stack is isolated), delete the route on the second node (replies go to the default gateway), block UDP 4789 on the router (VXLAN goes silent, a direct ping between the nodes works — "which layer broke?").

---

## Part 5. Ready text: the protocol catalog (R8)

### 5.1. Card format (`content/networks/protocols/<id>.yaml`)

```yaml
id: proto-dns
name: { ru: "DNS", en: "DNS" }
level: beginner                      # beginner | intermediate | experienced
layer: { tcpip: application, osi: 7, transport: "UDP 53, TCP 53; DoT 853; DoH 443" }
concepts: [N08, N09]                 # the card is shown only after these concepts have been introduced
why: { ru: "Превращает имя в адрес и другие записи, чтобы люди и конфиги не держали IP", en: "..." }
sequence:                            # the exchange diagram: participants and arrows with a caption on the line
  actors: [client, resolver, root, tld, auth]
  steps:
    - { from: client, to: resolver, label: "shop.example A? (RD=1)" }
    - { from: resolver, to: root, label: "example. NS?" }
    - { from: root, to: resolver, label: "referral: NS example. + glue" }
    - { from: resolver, to: auth, label: "shop.example A?" }
    - { from: auth, to: resolver, label: "A 198.51.100.20 TTL 300 (AA)" }
    - { from: resolver, to: client, label: "A 198.51.100.20" }
observe:                             # how to observe: commands and filters
  - "dig shop.example +trace"
  - "tcpdump -n port 53"
  - "wireshark: dns && dns.flags.rcode != 0"
breaks:                              # how it breaks: symptom → cause → how to prove it
  - { symptom: "status: NXDOMAIN", cause: "no such name (a typo, the wrong zone)", prove: "dig @auth name" }
  - { symptom: "status: SERVFAIL", cause: "the authoritative server is unreachable or DNSSEC did not validate", prove: "dig +trace; dig +cd" }
  - { symptom: "some users get the old address", cause: "cache until the TTL expires", prove: "dig @1.1.1.1 vs dig @auth; the TTL field" }
docs:                                # exact documentation locations for the ladder (part 6)
  - { step: 1, url: "https://www.rfc-editor.org/rfc/rfc1034#section-4.3.2", label: "RFC 1034, 4.3.2 Algorithm" }
  - { step: 2, url: "https://bind9.readthedocs.io/en/latest/manpages.html#dig-dns-lookup-utility", highlight: "+trace" }
lab: m08-trace                       # the lab where the protocol is touched by hand
sources: [rfc1034, rfc1035, rfc9156]
```

Every card must have `sequence`, `observe` and `breaks`. The validator does not pass a card without at least two breakages and one observation command available on tier A or B.

### 5.2. Cards: key content

| Card | Level | Layer / transport | Exchange (the gist of the diagram) | Observe | How it breaks | Module |
|---|---|---|---|---|---|---|
| ARP | B | L2 (EtherType 0x0806) | who-has (broadcast) → is-at (unicast) | `ip neigh`, `tcpdump -e arp` | no reply → `Destination Host Unreachable`; two hosts with one IP — ARP flapping | m03 |
| DHCP | B | L7 / UDP 67, 68 | Discover → Offer → Request → Ack; renewal at T1 = 50% of the lease | `tcpdump port 67 or 68 -v`, the client's `journalctl` | two servers; the pool is exhausted; no option 3 → no gateway | m07 |
| ICMP | B | L3 (protocol 1) | echo req/rep; time exceeded; dest unreachable (port, frag needed) | `ping`, `traceroute`, `tcpdump icmp` | filtering ICMP breaks PMTUD (T8) | m04 |
| UDP | B | L4 (17) | a connectionless datagram | `ss -uln`, `nc -u` | no reply ≠ closed; ICMP port unreachable | m05 |
| TCP | B | L4 (6) | SYN, SYN-ACK, ACK; data/ACK; FIN/ACK; RST | `ss -tn`, `tcpdump 'tcp[tcpflags]…'` | refused (RST), timeout (DROP), TIME-WAIT, window | m05, E-N3 |
| DNS | B | L7 / UDP and TCP 53 | see 5.1 | `dig`, `getent hosts` | NXDOMAIN, SERVFAIL, TTL, `search` | m08, E-N2 |
| HTTP/1.1 | B | L7 / TCP 80 | request (line, headers, body) → response (status) | `curl -v`, `nc` | 4xx/5xx; the wrong `Host` → the wrong site | m11 |
| HTTPS/TLS 1.3 | B | between L4 and L7 / TCP 443 | ClientHello → ServerHello+… → Finished | `openssl s_client`, `curl -v` | expiry, name (SAN), chain, the time on the client | m12, E-N3 |
| SSH | B | L7 / TCP 22 | versions → key exchange (KEX) → host key check → authentication → channels | `ssh -v`, `journalctl -u ssh` | `Host key verification failed`; `Permission denied (publickey)`; permissions on `~/.ssh` | m05/m12 (relies on L15) |
| NTP | I | L7 / UDP 123 | request-response with 4 timestamps, offset and delay | `chronyc tracking`, `timedatectl` | the clock drifted → TLS "certificate not yet valid", TOTP, logs | m07 |
| SMTP | I | L7 / TCP 25, 587 (submission), 465 | EHLO → MAIL FROM → RCPT TO → DATA; STARTTLS | `dig MX`, `openssl s_client -starttls smtp` | 25 is closed in the cloud; SPF/DKIM/DMARC in TXT | m08 |
| FTP / SFTP | I | FTP: TCP 21 + a separate data channel; SFTP is an SSH subsystem on 22 | FTP active/passive (PASV) | `ss`, capture | FTP through NAT/a filter: the control channel works, data does not; hence SFTP | m09 |
| HTTP/2 | I | L7 / TCP 443, ALPN `h2` | one connection, streams, HEADERS/DATA frames, HPACK | `curl --http2 -v`, `nghttp` | head-of-line blocking at the TCP level; a proxy without h2 to the upstream | m11 |
| HTTP/3 / QUIC | I | L7 / UDP 443 | QUIC handshake with TLS inside, 1-RTT; connection migration | `curl --http3` (if built with it), DevTools; the `alt-svc` header | UDP 443 closed → fallback to h2; a middlebox cuts UDP | m11, E-N3 |
| WebSocket | I | L7 / over HTTP/1.1 Upgrade | `GET` + `Upgrade: websocket` → `101 Switching Protocols` → frames | `curl -v` (101), DevTools | a proxy without `proxy_set_header Upgrade/Connection`; the idle timeout `proxy_read_timeout` | m13 |
| gRPC | I | L7 / HTTP/2 | a call = an h2 stream, `content-type: application/grpc`, status in trailers | `grpcurl` (step 4) | an L4 load balancer holds one h2 connection → all load on one pod; L7 is needed | m13 |
| VLAN (802.1Q) | I | L2, a 4-byte tag, 12-bit VID | a tagged frame between switches (trunk), untagged to the host (access) | `ip link add link eth0 name eth0.10 type vlan id 10`, `tcpdump -e vlan` | the wrong VID; MTU 1500 + 4 | m01 |
| NAT/PAT | I | L3/L4 | replacing src (SNAT/masquerade) or dst (DNAT), conntrack | `conntrack -L`, `iptables -t nat -L -v` | no entry → the reply did not return; SNAT port exhaustion | m09, E-N1 |
| BGP | E | L7 / TCP 179 | a session between ASes, prefix announcements with AS_PATH, best path selection | the provider's looking glass, `bgp.tools` | a route leak/hijack; the session went down → the prefix vanished from the internet | m00, E-N0 |
| OSPF (idea) | E | L3 (protocol 89) | neighbors exchange link state, each computes shortest paths | a capture in the lab — viewing only | mismatched timers/MTU → no adjacency | m04 (sidebar) |
| VXLAN / Geneve | E | L2 over UDP 4789 (Geneve 6081) | a frame in UDP with a VNI; Geneve has extensible options | `ip -d link`, `tcpdump udp port 4789` | MTU, a UDP filter, no route between VTEPs | m16, E-N6 |
| IPsec | E | L3 (ESP is protocol 50), IKE on UDP 500/4500 | IKE SA → Child SA → ESP | `ip xfrm state` | NAT without NAT-T; mismatched proposals | m14 |
| WireGuard | E | L3 over UDP (51820 by convention) | handshake initiation (1) → response (2) → data (4); cookie (3) | `wg show`, capture C12 | `AllowedIPs`, an endpoint behind NAT without `PersistentKeepalive`, MTU | m14 |
| mTLS | E | TLS with a client certificate | the server sends CertificateRequest, the client sends Certificate+Verify | `openssl s_client -cert -key`, `curl --cert` | the client certificate is not from the right CA; expired | m12 (sidebar), a bridge to the service mesh |

### 5.3. How the catalog is built into the block
The catalog is a separate reference screen with the filters "level", "layer", "transport". Each card opens only after its `concepts` have been introduced; before that, the line "opens in m0X" is visible. Cards of levels I and E go into their module's quiz as one `match` or `predict` question and into the review deck. Six cards go to the interview (10, 8.3): TCP, UDP, DNS, HTTP, TLS, NAT.

---

## Part 6. Ready text: the documentation ladder of the "Networks" block (R2)

### 6.1. Sources we lead to
EN: [ip(8)](https://man7.org/linux/man-pages/man8/ip.8.html) and the subpages `ip-address(8)`, `ip-route(8)`, `ip-neighbour(8)`, `ip-link(8)`, `ip-netns(8)`; [ss(8)](https://man7.org/linux/man-pages/man8/ss.8.html); [tcpdump(1)](https://www.tcpdump.org/manpages/tcpdump.1.html) and [pcap-filter(7)](https://www.tcpdump.org/manpages/pcap-filter.7.html); [dig](https://bind9.readthedocs.io/en/latest/manpages.html); [resolv.conf(5)](https://man7.org/linux/man-pages/man5/resolv.conf.5.html); [iptables(8)](https://man7.org/linux/man-pages/man8/iptables.8.html), [iptables-extensions(8)](https://man7.org/linux/man-pages/man8/iptables-extensions.8.html); [nft(8)](https://www.netfilter.org/projects/nftables/manpage.html); [curl(1)](https://curl.se/docs/manpage.html); [openssl-s_client](https://docs.openssl.org/3.0/man1/openssl-s_client/); [wg(8)](https://man7.org/linux/man-pages/man8/wg.8.html); [nginx docs](https://nginx.org/en/docs/); [ip-sysctl](https://docs.kernel.org/networking/ip-sysctl.html); RFCs on rfc-editor.org. RU: [nginx.org/ru](https://nginx.org/ru/docs/), Russian man pages on opennet.ru where they exist (with a note about the version). On tier B the same pages are available locally (`man`), and this is the primary path: `man`, `--help`, `ip route help`.

### 6.2. Steps and what the learner sees

| Step | Where it is on | What it looks like | Check |
|---|---|---|---|
| 1. Flicker | B: m00–m07 | Next to every new command and field, a "where this comes from" icon: a click opens the exact place (`ip-route(8)`, the `ip route get` section), optional | none |
| 2. Fragment with highlighting | B: m08–m15; I: start | The first-level hint is not the tutor's text but a clipping of the man page: the headings `NAME / SYNOPSIS / DESCRIPTION / OPTIONS / EXAMPLES` are collapsed, the relevant line is highlighted. Under the clipping, one sentence "how to read SYNOPSIS: [] means optional, \| means or" | the learner runs the command; it counts as an ordinary task |
| 3. Find the flag | B: m15, m16; I: from m08; E: start | The task is phrased as a result ("show only sockets in the TIME-WAIT state"), the hint is only a link to the page without an anchor | the result via facts, not the command text |
| 4. Enforcement | I: m13–m16, scenarios; E: from m04 | The task requires a flag or command that was not in the theory; no hints; the AI tutor in "where did you look?" mode | facts; the log records whether the documentation was opened (does not affect the score, goes into the debrief) |
| 5. Exam | all: part B and "on call" | Only official documentation is open (the 6.1 list + `man`), the AI is off, 1–2 tasks on what was not in the course | facts |

### 6.3. Tasks by module

| Module | Step 1 (link) | Step 2 (fragment, highlighted) | Step 3 "find the flag" → check | Step 4 (enforcement) → check |
|---|---|---|---|---|
| m01 | `ip-link(8)`: `link/ether` | `ip link show dev eth0` | "Show the interface's error and dropped-frame counters" (`ip -s link`) → `history` contains output with `RX: … dropped`, or the fact `net.links[].stats` was requested | "Create a VLAN 10 interface on top of eth0" (`ip link add … type vlan id 10`, not in the theory) → `net.links[type=vlan][id=10]` |
| m02 | `ip-address(8)` | `ip addr add IFADDR dev IFNAME` | "Print the addresses one line per interface" (`ip -br a`) | "Add a second address on eth0 so that it is not used as the default source" (`secondary`/`noprefixroute` or the order) → the address fact + `ip route get` gives the first one |
| m03 | `ip-neighbour(8)` | `ip neigh flush` | "Add a permanent ARP entry for the gateway" (`ip neigh add … nud permanent`) → `net.neigh[state=PERMANENT]` | "Find out after how many seconds the entry will become STALE" (`ip -s neigh` / `sysctl net.ipv4.neigh.eth0.base_reachable_time_ms`) → `fill` |
| m04 | `ip-route(8)`: `ip route get` | `ip route add default via` | "Find out which route the kernel will choose for 10.20.5.5 from the source 10.0.0.5" (`ip route get … from …`) | "Traffic from 10.0.3.0/24 must go via gw2, the rest via gw1" (`ip rule` + a table, not in the theory) → `net.rules[from='10.0.3.0/24']` + reach via gw2 (a capture on gw2's link) |
| m05 | `ss(8)` | `-l`, `-n`, `-p` | "Show only TIME-WAIT connections to port 443" (`ss -tn state time-wait '( dport = :443 )'`) → the output in `history` and a `fill` of the number | "Show the socket's retransmission timers" (`ss -o`) → `fill` of the `timer:(on,…)` value |
| m06 | `tracepath(8)` | `pmtu` | "Send a ping with fragmentation prohibited and a size of 1472" (`-M do -s`) | "Find out the PMTU to the node via the kernel's route cache" (`ip route get … ` → `mtu`/`cache expires`) → `fill` |
| m07 | RFC 2131, 3.1 | `dhclient -r` | "Release the lease and get a new one" → the new address fact | "Find in the client's journal which server the Ack came from" (`journalctl`, the field `DHCPACK from`) → `fill` of the IP |
| m08 | dig: `+trace` | `+short`, `@server` | "Query DNS over TCP" (`dig +tcp`) → TCP 53 in the capture | "Find out which CAs are allowed to issue certificates for `example.lab`" (`dig CAA`, not in the theory) → `fill`; "query all NS of the zone and compare the SOA serial" (`dig +nssearch`) |
| m09 | `iptables-extensions(8)`: MASQUERADE | `-j MASQUERADE`, `--to-destination` | "Show conntrack entries only for TCP to 443" (`conntrack -L -p tcp --dport 443`) | "Watch new conntrack entries in real time during a request" (`conntrack -E`) → `trace` in the log |
| m10 | `nft(8)`: `ct state` | `policy drop`, `ct state established,related accept` | "Limit SSH to 3 new connections per minute" (`limit rate`/`-m recent`) → a probe of 5 SYNs in a row, the 4th is dropped | "Find which rule drops the packet" (`nft monitor trace` + `meta nftrace set 1` or `-j TRACE`) → `fill` of the rule handle |
| m11 | MDN HTTP | `curl -I`, `-H` | "Ask the server to return only the first 100 bytes" (`curl -r 0-99` / `Range`) → `http.status=206` | "Connect to `shop.lab`, but to the address 10.0.2.21, without changing DNS and `/etc/hosts`, with the correct SNI" (`--connect-to` or `--resolve`; `--connect-to` is not in the theory) |
| m12 | openssl-s_client | `-servername`, `-showcerts` | "Show only the certificate's expiry date" (`openssl x509 -noout -enddate`) | "Check that the server does not support TLS 1.1" (`s_client -tls1_1` → an error) → `fill`; "connect with a client certificate" (mTLS: `-cert -key`) |
| m13 | nginx `proxy_pass` | `proxy_read_timeout` | "Write the selected upstream's address and its response time to access.log" (`$upstream_addr`, `$upstream_response_time`) → the log file fact contains the fields | "Disable retrying on the next backend" (`proxy_next_upstream off`) → the nginx config `state` + behavior |
| m14 | wg(8) | `AllowedIPs`, `Endpoint` | "Keep the tunnel alive behind NAT" (`PersistentKeepalive`) → `wg show … persistent-keepalive` | "Show the configuration of a running interface without the private key" (`wg showconf` + a filter / `wg show … allowed-ips`) |
| m15 | tcpdump | `-n`, `-c`, `port` | "Write the capture into 1 MB files, keeping no more than three" (`-C 1 -W 3`) | Scenarios T13 (`rp_filter`), T8 (`tracepath`, `ip route get` with `mtu`) without hints |
| m16 | ip-netns(8) | `ip netns exec` | "Show which netns this veth's peer interface is in" (`ip -d link` → `link-netns`) | "Enable filtering through iptables on the bridge" (`modprobe br_netfilter`, `sysctl net.bridge.bridge-nf-call-iptables=1`) → the sysctl fact + the FORWARD counter grows |

Step 4 tasks are done on tier B (`lab-net`), because they deliberately do not stick to the simulator's flag list. On tier A such a task shows a banner "this task is on a real machine" and opens the same lab in v86.

### 6.4. The step 5 exam (add to part B)
A separate 40-minute timer, the AI is off, the learner's browser opens only the 6.1 list (in the trainer, a built-in viewer with a domain allowlist; on one's own VM, an honor rule). Three tasks, two of them on topics outside the course:
1. "On `vm1`, traffic to 10.99.0.0/24 must go through the tunnel, and to the rest of the internet through `eth0`, even if the tunnel has `AllowedIPs = 0.0.0.0/0`". The solution is via `Table = off` + `ip rule` or `fwmark` (`wg-quick(8)`, `ip-rule(8)`). Check: `ip route get 1.1.1.1` → `dev eth0`, `ip route get 10.99.0.2` → `dev wg0`.
2. "Limit incoming new connections on 443 to 20 per second from one address" (nftables `meter`/`limit`, `nft(8)`). Check: from the second VM, `trainer-check` sends 50 SYNs per second, ≤ 25 are accepted.
3. From the course: "a 504 on `/report`: find it and fix it locally for the `location`".

### 6.5. The AI tutor at step 4
The `doc-coach` mode, switched on when the task has `doc_step: 4`. A fragment of the system prompt:
> The learner is solving a task that requires a flag or command not introduced in the course. Do not name the flag, the command or the section where they are described. Your first reply to any question: "Where have you already looked?" If the learner named a source, ask which section (SYNOPSIS, OPTIONS, EXAMPLES) they read and which word they searched for. Suggest one thing: which page to open (`man ss`, `ss --help`, `ip route help`, a page from the documentation list) or which word to search for (`/state`). After three exchanges without progress, offer to open a page fragment (step 2 for this task); the task is then credited with the mark "with a hint".

The "where did you look" log (which pages were opened in the built-in viewer and which `man` were invoked on tier B) is shown in the debrief but does not count toward the score.

---

## Part 7. Ready text: "Decision 6. Tier B for networks — `lab-net` and the `vswitch` switch" (R11)

**Composition.** 2–4 v86 machines (`lab-net` = the `lab-debian` root + the packages from finding 20), each in its own Web Worker, 96 MB each (minimum 64, maximum 128), the `dt-kernel` kernel with networking options. On a laptop with ≥ 8 GB — up to 4 machines, with 4 GB — 2 machines; on a phone v86 is not started (09, 1.4); tier A remains for the phone.

**The switch.** `vswitch` runs in `sim.worker.ts` next to netlab, not in a BroadcastChannel (`inbrowser`): we need our own code on the path of every frame. Each machine's adapter (ne2k or virtio-net) is connected via the emulator bus (frame send and receive events; the exact event names and operation in a worker are confirmed by the phase 0 spike) and a `MessagePort` to the switch worker. The switch:
- learns MACs and floods unknown destinations (like the netlab `switch` — the same MAC table code);
- can be several segments (`sw0`, `sw1`), with a router being a v86 machine with two adapters;
- passes every frame through the netlab dissectors (decision 3) and emits a `net.packet` event with real bytes. The animator, inspector, packet scope and pcap export work without changes;
- applies the scenario's faults deterministically by frame counter: dropping the Nth frame, delay, truncation by MTU, filtering ICMP "Fragmentation Needed", duplication;
- plays the "internet" from netlab for the v86 machines: the gateway `203.0.113.1`, root and authoritative DNS, teaching sites. This is the same `internet` as in 7.3.2, but answering with real frames. Frames do not go out to the real internet (the 09 rule, 1.6).

**What is done where.**

| Tier A (netlab) | Tier B (lab-net) |
|---|---|
| m00–m15 for B, all scenarios with simulated time (T1, T2, T8 with long timeouts), drills, the phone | m16 (one lab is mandatory even for B), ladder step 4, WireGuard between nodes (m14), `ip rule`, `rp_filter`, `br_netfilter`, scenario twins for checking (finding 21), part B of the exam "as practice" before the cloud |

**The bridge to Kubernetes (R11, hybrid).** The same `vswitch` and `lab-net` become the nodes of the hybrid cluster in 05: the control plane is kube-lite, and on each v86 node a small "kubelet" agent runs pods via `crun`. The pod network is built by cni-lite, but now with the real commands from m16: netns, veth, `cni0`, a route or VXLAN between nodes via `vswitch`. kube-proxy-lite writes real rules into the guest via `iptables-restore`. The R9 drill "find where the packet to a ClusterIP goes" is done on the node's real `iptables-save`. So m16 and findings 16–17 are not decoration but a precondition for shipping Kubernetes networking. On the 05 side, I will record this.

**Memory and time (budgets for the spike).** 3 × 96 MB + a switch worker ≤ 40 MB; starting three machines from snapshots ≤ 6 s on the reference laptop; `vswitch` throughput ≥ 20 Mbit/s between guests (enough for a 10 MB `curl` and an iperf demonstration of the window). If the spike does not confirm the budget, m16 and step 4 move to "one machine, many netns" (one v86, all hosts are stacks inside it). This is cheaper in memory and is also real Linux; only the visualization of an external switch is lost.

---

## Part 8. Ready drills

### Drill 1 (D-NF). "Walk the chains" — preparation for R9
Screen: on the left, an `iptables-save -t nat` dump of 20–40 lines (generated: user chains, `-j` between them, `-m statistic`, `-m addrtype`, `RETURN`, `MARK`). On the right, a packet `src 10.0.0.5:40000 → dst 10.96.7.7:80, came in on eth0`. The learner clicks the lines in the order they match; on each line with `statistic` they choose a branch and enter the probability. The result is the address and port after DNAT.
- Generation: a seed; 3 levels (without user chains → 2 levels of chains → 3 levels with probabilities 1/3, 1/2, 1).
- Check: the sequence of lines matches the reference of the netlab evaluator (the same code that runs packets), the final `ip:port` is correct; probabilities: for N backends the lines are `1/N, 1/(N−1), …, 1`.
- The same drill in an nft variant: `numgen random mod 3 vmap { 0 : jump …, 1 : jump …, 2 : jump … }`.
- The chain names are neutral (`SVC-WEB`, `EP-1`), not `KUBE-*`: Kubernetes terms have not been introduced yet. In block K4 the same drill opens with the real names and the caption "you already did this in m10".

### Drill 2. "Which layer?"
A card: a symptom with output (`curl: (6) Could not resolve host`; `ping` works but `curl` hangs; `SSL certificate problem`; `Destination Host Unreachable`; `HTTP/1.1 502`; `RTNETLINK answers: Network is unreachable`; `tcpdump` shows a SYN without a SYN-ACK). The learner chooses the layer (L2, L3, L4, DNS, TLS, L7) and the first check command out of four. Check: the "layer + command" pair against a table; each wrong choice is explained separately. Into the review deck; 20 cards at the start, generated from the `breaks` of the protocol catalog.

### Drill 3. "Compute the latency" (for E-N0 and E-N3)
Given the distance, RTT, TLS version, keep-alive. Compute the TTFB in RTTs and ms. The check is a number with a ±5% tolerance. Example: a new HTTPS connection, TLS 1.3, RTT 80 ms → 3 RTT = 240 ms until the first byte; with keep-alive — 1 RTT = 80 ms.

---

## Part 9. Small additions worth writing in during the revision

- In "13. Dependencies", the "Linux block" item: add R6 (namespace, `unshare`, `nsenter`, `/proc/<pid>/ns`, `lsns`) as a precondition for m16, and L14/L15 as the source of the network concepts already introduced.
- In "13. Dependencies", the "Platform" item: `vswitch`, `net.reach` in the facts, the AI mode `doc-coach`, a built-in documentation viewer with a domain allowlist (step 5).
- In 7.5 "Capture library": C14 VXLAN (find the VNI and the inner address), C15 DNS with QNAME minimization (what the root was asked), C16 HTTP/3 (only Initial and SNI are visible). Record on `lab-net`, not on cloud VMs: this makes anonymizing and reproducing easier.
- In 12 "Sources": RFC 9156 (QNAME minimisation), RFC 7348 (VXLAN), RFC 8926 (Geneve), RFC 9000 (QUIC), RFC 9114 (HTTP/3), RFC 6455 (WebSocket), RFC 4271 (BGP), RFC 5905 (NTP), RFC 5321 (SMTP), RFC 4253 (SSH Transport), RFC 4301 (IPsec), IEEE 802.1Q; [kernel ip-sysctl](https://docs.kernel.org/networking/ip-sysctl.html); [nginx upstream module](https://nginx.org/en/docs/http/ngx_http_upstream_module.html).
