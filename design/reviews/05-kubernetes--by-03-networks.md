# Review of 05-kubernetes.md (reviewer: the author of 03-networks.md, a network engineer)

Date: 18.11.2026. The document under review was not modified.

## Verdict

The document is strong in its control plane simulator: exact scheduler and kubelet messages, the "remove a component → what you see" table, the step-by-step path of `kubectl apply`, checks by state rather than by command text, and honest CI with reference runs. From the network side it cannot be accepted in its current form. First, it builds its own network model (`cni-lite`, `kube-proxy-lite`) next to `netlab`, even though decision 2 of document 03 and section 1.3 of document 09 fixed one network model for the whole course. On top of that, the model it relies on (Webernetes) does not model the pod network at all: it emulates only HTTP and DNS. Second, Kubernetes networking is packed into a single module K4 plus scattered pieces in K9 and K10, while R9 requires a large separate section. There is no documentation ladder (R2), no hybrid multi-node cluster on v86 (R11), and the real-cluster stages do not match R12. Identifiers and the order of concepts diverge from the 01 graph. There are factual errors: a check via `fetch` over http from an https page, `etcdctl snapshot status/restore` after etcd 3.6, kind instead of k3s in the reference runs, and native routing mixed up with eBPF. Below are 27 findings, each with a fix or ready text. The largest pieces are the ready "Kubernetes networking" section (finding 3) and the design of the hybrid cluster (finding 4); they can be pasted in almost without editing.

Total: **BLOCKING — 6, MAJOR — 11, MINOR — 10.**

---

## 1. BLOCKING — Identifiers and the order of concepts do not match the 01 graph, and the architecture constructor is designed twice and differently

**Where:** section 0, item 8; section 1; section 3 (the whole table); section 13 (`introduces/uses`).

**What is wrong.**
- According to 01 (6.1), the source of truth for the linter is `content/concepts.yaml` with identifiers `K01…K33`, `N01…N21`, `D01…D23`, `L…`, `C…`. In 05, its own table with string ids (`pod`, `service`) and prefixes `net:`, `docker:`, `linux:`, which do not exist in the graph, is declared the source of truth. The build cannot check two tables at once.
- The module codes `K0…K16` have the same form as the concept codes `K01…K33` from 01. The entry `K4` in 05 (the "Cluster network" module) and `K04` in 01 (the "API server and object" concept) read as the same thing. The linter and editors will get confused.
- The order diverges in substance. In 01, the pod (`K09`) requires kubelet and CRI (`K08`), while in 05 the pod is introduced in K1 and kubelet only in K3. kubeconfig in 01 is `K05` together with kubectl, in 05 it is K10. CNI in 01 is `K26` (after RBAC), in 05 it is K4. Service in 01 requires the reverse proxy `N19`, in 05 it requires `linux:ip`. Deployment in 01 requires the rollout strategies `C14` from the CI/CD block, and 05 does not mention at all that CI/CD comes before Kubernetes (01, section 5, block 5).
- Wrong prefixes: `docker:yaml` — YAML is introduced in Linux (`L31`); `linux:git` — Git is introduced in CI/CD (`C01–C05`); `docker:runtime` is `D10`; `net:iptables` is `N17`; `net:dns` is `N08`/`N09`; `net:ip` is `N01`/`N02`.
- 08, section 6.4, describes the same flagship "Kubernetes from blocks" in a different order: etcd and the API server before the pod, the pod at step 4, labels at step 7 together with Service. In 05, labels are in K2 and are introduced before Service. The result is two constructors with two orders.

**Fix.**
1. In 05, drop its own ids and refer to `concepts.yaml` from 01. Keep the table in section 3 as "order within the block", but write the 01 codes in the columns and explicitly list the proposed graph changes in a separate list for the author of 01.
2. Rename the modules to `KM0…KM16`, or better to `k8s.m00…`, so that module codes do not coincide with concept codes.
3. The "pod first, then kubelet" order in 05 is pedagogically better: first show, then explain. The author of 01 should be offered the change `K09 requires: [K01, D06, D03]` and moving `K08` after `K09`. For `K05`, split the concepts: `K05a kubectl` — in K1, `K05b kubeconfig and context` — in K10.
4. Add a dependency on CI/CD to section 1: `C02` (commit) for GitOps, `C14` (rolling/canary) for Deployment and Gateway with weights.
5. There is one constructor, and its owner is 08. 05 only provides the consequence table ("removed — we see") for it. Bring the step order of 08/6.4 in line with the order of 05: pod in K1, controller and etcd in K2, scheduler and kubelet in K3. 6.1 of 05 becomes the behavior specification for 08/6.4, not a second interactive.

A ready line for section 1 with all network prerequisites (the current list is incomplete):

> From the "Networks" block, this block takes: interface and IP (`N01`), subnet and CIDR (`N02`), route and gateway (`N03`), port (`N04`), TCP/UDP (`N05`), ARP (`N06`), the layer model (`N07`), DNS and `resolv.conf` (`N08`, `N09`), NAT (`N11`), ICMP and `ping`/`traceroute` (`N12`), socket and `ss`/`curl` (`N13`), HTTP (`N14`), TLS (`N15`), iptables/nftables (`N17`), SSH (`N18`), reverse proxy and load balancer (`N19`), veth and bridge (`N20`), network namespace (`N21`). Separately, from the "VPN and tunnels" module of 03 (N14 in the 03 module numbering) — the concepts "tunnel" and "re-encapsulation": without them VXLAN between nodes cannot be explained.

---

## 2. BLOCKING — A second network model instead of `netlab` and a separate worker instead of the shared `sim.worker`

**Where:** section 0, item 2; 5.2 (diagram, rows `cni-lite`, `kube-proxy-lite`); 5.4 "Network"; 6.4; section 16, stage 2.

**What is wrong.**
- Per decision 2 of document 03, the `netlab` core is reused in Kubernetes: a Service is DNAT in `KUBE-SERVICES`/`KUBE-SEP` of the same netfilter model, CNI is routes and tunnels of the same model. Per 09 (1.3), all simulators, `kube-lite` included, live in one `sim.worker.ts`, and a kube-lite pod is a dsim container on a node. In 05, instead, there is a separate "cluster worker" and its own "iptables/nftables rule model". Then `iptables-save` on a Kubernetes node and `iptables-save` from the "Networks" block will show different implementations, and the main argument for the shared engine ("the learner recognizes their own rules") is lost.
- The code source for the "pod network" is a poor choice. The Webernetes README states plainly that only HTTP and DNS are emulated, the network stack is not modeled any deeper, UDP is not supported, and IP families are not modeled ([github.com/ngrok/webernetes](https://github.com/ngrok/webernetes)). There is nothing to take from there for the "pod network".
- Access to a node (`ssh worker-1`, `iptables-save`, `ip route`, `conntrack -L`) is opened only in K15 and exam E. The network exercises from R9 ("find in iptables where a packet to a ClusterIP goes") are needed already in the networking section, that is, from K4.

**Fix (text for 5.2 and 5.4).**

> **The node and pod network is `netlab`.** Each kube-lite node is a netlab `host` device with `ip_forward=1`. A pod's network namespace is a separate `host` without hardware, connected by a veth pair to the node's `cni0` bridge. `cni-lite` is not a network model but a plugin program that, on an `ADD` event, performs on netlab the same operations as the real bridge plugin and host-local IPAM: create a netns and a veth, attach it to the bridge, assign an address from the node's podCIDR, set the default route. Inter-node routes (host-gw) or the VXLAN device `flannel.1` are created through the same API. `kube-proxy-lite` is a controller: it watches Service and EndpointSlice and writes rules into netlab's netfilter on each node in the real kube-proxy format (iptables: `KUBE-SERVICES`, `KUBE-SVC-*`, `KUBE-SEP-*`, `KUBE-MARK-MASQ`, `KUBE-POSTROUTING`, `KUBE-NODEPORTS`; nftables: table `ip kube-proxy`, `service-*`, `endpoint-*`, `numgen random mod N vmap`). A packet passes through the kernel hooks in the netlab model, and the "path through netfilter" tab shows the rule that matched. NetworkPolicy is enforced by netlab: a policy-capable `cni-lite` writes rules into the node's filter chains, like kube-router in k3s. All of this runs in the shared `sim.worker.ts` (09, 1.3); there is no separate cluster worker. The 300 KB budget applies to kube-lite without netlab: netlab is already loaded by the "Networks" block.
>
> **The node is accessible from K4:** `ssh worker-1` (in the simulator, the console of the netlab device) opens `ip a`, `ip route`, `ip neigh`, `bridge fdb`, `iptables-save -t nat`, `nft list table ip kube-proxy`, `conntrack -L`, `tcpdump -i cni0|flannel.1|eth0`. Only `crictl`, `journalctl -u kubelet`, `/etc/kubernetes/manifests` remain reserved for K15 and exam E.

**What netlab must add** (a commitment of the author of 03, I will add it to 03/7.3.2): VXLAN (`ip link add … type vxlan id N dstport 8472|4789`, FDB, UDP encapsulation with outer and inner headers in the dissector); Geneve in the dissector only; the match modules `statistic --mode random --probability`, `comment`, `mark`/`MARK`, `addrtype --dst-type LOCAL`; nft `numgen`, `vmap`, `fib`; `ip route` with `onlink`; `bridge fdb show`; MTU accounting on the VXLAN interface (1450) with ICMP frag-needed. This is 10–15 KB added to the netlab core.

---

## 3. BLOCKING — Kubernetes networking is not a large separate section (R9)

**Where:** section 4, rows K4, K9, K10; 6.4.

**What is wrong.** Currently module K4 introduces Service, EndpointSlice, kube-proxy, CNI, CoreDNS, NodePort, LoadBalancer, headless and ExternalName all at once. That is eight concepts in one module, while 01 (section 8) allows one concept per screen. K4 has no Kubernetes network model (the four requirements), no SNAT of pods on egress, no `ndots` as a source of extra queries, no MetalLB/ARP, no NetworkPolicy support on the CNI side, and no end-to-end method for "the pod could not reach the service". NetworkPolicy is hidden in K10 "Access and security".

**Fix — a ready section.** Replace K4 with the section **KN "Kubernetes networking"** of eight modules. K9 (ingress from outside) moves to KN6, NetworkPolicy from K10 moves to KN7. The concept order is given with reference to the 01 codes.

| Module | Content (one concept per screen) | B | I | E |
|---|---|---|---|---|
| KN1. Network model | The four requirements of the model: a pod has its own IP; any pod reaches any pod without NAT; node agents reach the node's pods; a pod sees its own IP the same way others see it. Why it is designed this way: no port forwarding as in Docker. The IP belongs to the pod's namespace, not to a container: all containers of a pod share one `localhost` (check question — two containers on port 80 in one pod). CNI as a contract: `ADD`/`DEL`, `/etc/cni/net.d`, `/opt/cni/bin`, IPAM, the node's podCIDR (`kubectl get node -o jsonpath='{.spec.podCIDR}'`) | full | full | fast |
| KN2. Pod to pod on one node | netns, veth, the `cni0` bridge, ARP within the node, the pod's default route to `10.42.0.1` | full | full | fast |
| KN3. Pod to pod across nodes | Three methods: routes (host-gw: "the node is the router for its podCIDR"), encapsulation (VXLAN UDP 8472, VNI, outer and inner headers, MTU 1450), direct routing with BGP (Calico, Cilium native routing). Egress: SNAT/MASQUERADE to the node IP (`KUBE-POSTROUTING` / flannel rule). Encryption between nodes — WireGuard (flannel `wireguard-native`, Cilium) | basics (no BGP) | full | full |
| KN4. Service | ClusterIP is an address that exists on no interface (`ip a` on the node will not show it; exception — IPVS, where the address sits on `kube-ipvs0`, one sentence for E). EndpointSlice, `ready/serving/terminating`. kube-proxy: iptables (chains, probabilities), nftables (`vmap`), IPVS — being phased out, support ends in v1.43 ([DevClass](https://www.devclass.com/devops/2026/08/27/kubernetes-cleans-house-bins-legacy-kube-dns-ipvs-and-cgroup-v1/5292767)), Cilium eBPF (kube-proxy replacement, translation at `connect()` — for E). conntrack: why an already open connection does not move to a new pod. Hairpin (a pod calls its own Service) | full | full | full |
| KN5. Cluster DNS | CoreDNS, Corefile (`kubernetes cluster.local`, `forward . /etc/resolv.conf`, `cache 30`), `<svc>.<ns>.svc.cluster.local`, the pod's search list, `ndots:5` and the cost of this setting (see explainer 4), headless Service — several A records with pod IPs, StatefulSet pod names `db-0.db.<ns>.svc.cluster.local`, `dnsPolicy`, `dnsConfig` | full | full | full |
| KN6. Ingress from outside | NodePort (range 30000–32767), `externalTrafficPolicy: Cluster/Local` and the client IP, LoadBalancer: cloud CCM, ServiceLB in k3s, MetalLB L2 (a node answers ARP for the external IP, gratuitous ARP on failover — relies on ARP from N3 of document 03) and BGP (for E); Ingress (legacy), Gateway API; 502 and 504 on the ingress controller — reference to N15 of document 03 | basics | full | full |
| KN7. NetworkPolicy | By default everything is open. Policies only allow, and they add up. A pod under a policy is isolated only in the direction the policy specifies (`policyTypes`). YAML trap: `namespaceSelector` and `podSelector` in one element mean "AND", in two elements they mean "OR". An egress policy without allowing DNS (UDP/TCP 53 to `kube-dns`) breaks all names. CNI support: flannel does not enforce policies itself (in k3s they are enforced by the built-in kube-router; in plain flannel a policy is silently ignored); Calico and Cilium enforce them. For E: Cilium L7 policies | — | full | full |
| KN8. The "pod could not reach it" method | The ladder DNS → Service → EndpointSlice → pod (is the port listening) → NetworkPolicy → node and CNI, layer by layer, as in N15 of document 03 | full | full | full |

**Process explainers of section KN** (R4 style: a technical drawing, labels on the lines, everything clickable, steps can be stepped forward and back, "break it" removes a component).

*Explainer 1. "A packet from pod to pod" (KN2–KN3).*
- Screen 1. Two nodes, the nodes' `eth0` on a shared network `192.168.10.0/24`. On each, a `cni0` bridge (`10.42.0.1/24`, `10.42.1.1/24`) and two pods. Labels on the lines: `veth`, `cni0`, `eth0`.
- Screen 2. Pod A (`10.42.0.15`) → pod B on the same node. Steps: the pod's routing table → ARP for `10.42.0.16` over the bridge → frame through the bridge. The envelope is opened down to L2.
- Screen 3. Pod A → pod C (`10.42.1.20`) on another node. Toggle **"method": host-gw | VXLAN | native+BGP | Cilium eBPF+VXLAN**. With host-gw, the node shows `10.42.1.0/24 via 192.168.10.12`. With VXLAN, the envelope gets wrapped: outside `192.168.10.11 → 192.168.10.12 UDP 8472 VNI 1`, inside `10.42.0.15 → 10.42.1.20`. With native+BGP, a network router with routes learned via BGP appears on the diagram. Encryption is a separate "WireGuard" toggle that adds one more wrapper.
- Slider **node network MTU** (1500 / 1450 / 1400). Under the slider, the pod MTU and MSS are recalculated. With a pod MTU of 1500 over VXLAN, a large packet gets ICMP frag-needed or is lost, and an explanation appears next to it: "the encapsulation ate 50 bytes".
- Toggle **"nodes in different subnets"**: host-gw stops working (the next hop is not directly reachable, there is no route), VXLAN keeps working. This shows why encapsulation is needed.
- "Break it": delete a route on a node, block UDP 8472 with the cloud firewall (timeout only between nodes; on one node everything works), stop CNI (node `NotReady`).

*Explainer 2. "A request through a Service" (KN4).*
- Screen 1. The `client` pod runs `curl http://web`. Steps with rewind: DNS (collapsed into one step, in detail — explainer 4) → `connect()` to `10.43.12.7:80` → kernel chains on the client's node → DNAT to the pod IP → the path from explainer 1 → reply, reverse translation via conntrack.
- Slider **replicas** (1–5): the `KUBE-SVC-*` rules are recalculated before your eyes (`1/N`, `1/(N−1)` … `1`), next to them an explanation of why such probabilities give equal shares. A "100 requests" counter distributes them across the pods.
- Toggle **kube-proxy mode: iptables | nftables | IPVS | Cilium eBPF**. The rule text and the place of translation change: in eBPF, translation happens at `connect()` in the socket, and `tcpdump` on `cni0` already sees the pod IP, not the ClusterIP.
- Toggle **keep-alive**: when on, the connection stays on one pod despite the "equal" distribution (conntrack). This answers the common question "why is load balancing uneven".
- Toggle **readiness**: a pod with `ready:false` disappears from the rules but keeps running.
- "Break it": the selector does not match (no `KUBE-SEP` rules, there is a `REJECT` → `Connection refused`); wrong `targetPort` (RST from the pod); kube-proxy stopped (new Services do not work, old rules live on — an important nuance).

*Explainer 3. "From outside in" (KN6).* Client `203.0.113.50` → node 1 `:30080`. Toggle **externalTrafficPolicy: Cluster | Local**. With Cluster, the request may go to a pod on node 2, SNAT appears, and the pod sees the IP of node 1 instead of the client. With Local, the pod sees `203.0.113.50`, and a node without a pod does not respond: the load balancer health check excludes it. Toggle **LoadBalancer: cloud | ServiceLB | MetalLB L2**. With MetalLB you can see a node answering ARP for `192.168.10.240`; "break the owner node" — gratuitous ARP from another node, and the address moves. Next, the **Gateway API** toggle adds an ingress controller and an HTTPRoute, and the `proxy_read_timeout` slider with a slow pod produces 504 (link to N15 of document 03).

*Explainer 4. "The cost of ndots" (KN5).* A pod in `shop` resolves a name. Name input field: `web`, `web.prod`, `api.github.com`, `api.github.com.`. Slider **ndots** (1–5). The counter of queries to CoreDNS is recalculated immediately: for `api.github.com` with `ndots:5` the queries go to `api.github.com.shop.svc.cluster.local`, `….svc.cluster.local`, `….cluster.local` (plus the node's domains), each A and AAAA, all NXDOMAIN, and only then the real name. Result: 8 or more queries instead of 2. With a trailing dot — 2 right away. Toggle **CoreDNS cache** and "break it": remove `forward` from the Corefile (external names SERVFAIL, internal ones work), stop CoreDNS (`Could not resolve host`, while `curl http://10.43.12.7` works).

*Explainer 5. "NetworkPolicy constructor" (KN7).* On the left, YAML; on the right, a "from × to" matrix (pods of three namespaces), cells are allowed/denied. Editing the YAML recolors the matrix immediately. A separate button shows the "AND/OR" difference in selectors. Toggle **CNI: flannel | k3s (kube-router) | Calico | Cilium**: with plain flannel the whole matrix is green, and a caption on top says "the policy was accepted by the API server, but there is nobody to enforce it".

**Exercises of section KN (with check logic, vocabulary — 09/2.3).**

| ID | Lvl | Task | Check |
|---|---|---|---|
| N-D1 | B | Find the IP of the pod `web-…` and check that the `client` pod reaches it by IP | file `answer.txt` = pod IP from the facts; `http[client→podIP].status=200` |
| N-D2 | B/I | On node `worker-1`, find the rule that sends a packet to the ClusterIP of `web` to a specific pod. Write the DNAT destination address to a file | the file matches one of `endpoints[].addresses` + port; `history` contains `iptables-save` or `nft list` (for review only) |
| N-D3 | I | A pod in `shop` resolves `api.github.com` slowly. Make sure no more than 2 queries per name reach CoreDNS, without changing the Corefile | `k8s.objects[kind=Deployment][name=app].spec.template.spec.dnsConfig.options[name=ndots].value<=2` or a name with a trailing dot in env; CoreDNS-lite query counter per probe ≤ 2 |
| N-D4 | I | Pods on `worker-2` are unreachable from other nodes; on the node itself everything works. Fix it (in the scenario, UDP 8472 is blocked on `worker-2`) | pod → pod probe across nodes = 200; the rule is removed; pods were not recreated |
| N-D5 | I | The application must see the real client IP when coming in through NodePort | `spec.externalTrafficPolicy=Local`; the pod's header/log contains `203.0.113.50` |
| N-D6 | I | After `default-deny` in namespace `api`, all names stopped working. Allow only what is needed | egress to `kube-dns` UDP/TCP 53 allowed; `http[api→db:5432]` open; `http[api→example.com]` closed |
| N-D7 | E | Enable policy enforcement where it is missing: the cluster runs on flannel, the policy does not work | understanding is checked by the answer (`policy enforcement` is missing) + a CNI change in the scenario or enabling kube-router-lite |
| N-D8 | all | "The pod could not reach it" — a random breakage out of six (Service name, namespace in the name, selector, targetPort, readiness, NetworkPolicy). Write the broken layer to `diagnosis.txt` and fix it | exactly the planted breakage is fixed (`keep`: pods and Service are the same, uids did not change); the file contains one of `dns|service|endpoints|pod|policy` and matches the planted one |

**Protocol catalog (R8) in section KN.** Cards are taken from the 03 catalog and are not duplicated: VXLAN/Geneve (KN3), BGP (KN3, KN6 for E), WireGuard (KN3), ARP (KN2, KN6), gRPC (CRI and etcd — one line in KN1), HTTP/2 (gRPC, Gateway), mTLS (service mesh — for E, one scene). A discrepancy: in R8, VXLAN is assigned to the experienced level, but here the intermediate level needs it. I am moving the VXLAN card in 03 to the intermediate level. The beginner gets only "encapsulation" in KN3, without the protocol name.

---

## 4. BLOCKING — There is no hybrid multi-node cluster on v86 (R11)

**Where:** section 0, item 1 (it only says why k3s in v86 is impossible); section 5.

**What is wrong.** The document rightly rejects k3s in v86 (32-bit emulation, memory), but puts nothing in its place. R11 requires prototyping a hybrid: the control plane is kube-lite, and on each v86 node a small real agent runs pods via `crun`. The node network in R11 is our JS switch with real L2.

**Fix — ready text for a new section 5.9 "Hybrid cluster" (the network part is my area; the rest must be agreed with 04 and 09).**

> **Composition.** Control plane — kube-lite in `sim.worker.ts`. Nodes — 2–3 v86 machines (`lab-node`, derived from `lab-alpine`, 96–128 MB of guest memory each), each in its own Worker. On a phone — one node or the recorded mode. Tab memory budget: 3 nodes × 128 MB + engines ≈ 1.2 GB. This exceeds the 600 MB ceiling from 09/1.4, so 09 needs a separate ceiling for the hybrid and launching it only when `navigator.deviceMemory ≥ 8`.
>
> **Network.** The `vswitch` switch (owner — 09, model — netlab `switch`): guest frames arrive via the `net0-send` event and are fed into the guest via `bus.send("net0-receive", frame)` (the `two_instances.html` example in v86). The switch learns MACs, emits a `net.packet` event to the animator (08/3.6), can disable a port, drop every Nth frame and write pcap. Simulated netlab devices are connected to the same switch: `coredns-lite` at `10.42.0.2` (UDP 53, answered by the kube-lite model) and an "external client". This way real kernels and simulated services live in one L2. Addresses: nodes `10.0.0.11–13/24`, podCIDR `10.42.N.0/24`, ClusterIP `10.43.0.0/16`, DNS `10.43.0.10`, as in the main simulator.
>
> **The control channel is not TCP.** The node agent talks to kube-lite over the service port `ttyS1` (the JSON-lines protocol from 09/1.4), not over HTTPS to `:6443`. Otherwise netlab would have to maintain a full TCP stack compatible with real Linux (window, retransmissions, SACK) just for the API. So the L2 switch carries only data traffic: pod ↔ pod, pod ↔ DNS, client ↔ NodePort.
>
> **The `kubelet-lite` agent on a node** (POSIX sh + `jq` + `crun` + `iproute2` + `iptables`; if sh cannot handle it, a static Go binary with `GOARCH=386`, about 3 MB):
> 1. Every 10 s it sends a heartbeat (a Lease in kube-lite). Stopping the node's worker or `kill` of the agent means "the node went down", and the usual node-lifecycle logic takes over.
> 2. A pod is assigned to the node → `ip netns add pod-<uid>`; `ip link add veth-<id> type veth peer name eth0 netns pod-<uid>`; attach to `cni0`; an address from the podCIDR (IPAM is run by kube-lite, which passes it in the task); default route to `10.42.N.1`. Then `crun run --bundle /var/lib/pods/<uid>/<ctr>`, where `config.json` has `linux.namespaces[type=network].path=/var/run/netns/pod-<uid>`, and memory and CPU are taken from requests/limits, which gives a real cgroup v2 `memory.max` and a real OOM kill. A separate pause container is not needed: the namespace is held by `ip netns`. On the diagram this is shown as the "pod sandbox".
> 3. Inter-node network: host-gw by default (`ip route add 10.42.M.0/24 via 10.0.0.1M`) — all nodes are in one L2, which is simpler and visible in `ip route`. For KN3 it switches to VXLAN (`ip link add flannel.1 type vxlan id 1 dstport 8472 dev eth0 nolearning` + `bridge fdb append`), and for the experienced level to WireGuard (`wg`).
> 4. Service: kube-lite generates a file for the node in `iptables-restore` format (the same generator as `kube-proxy-lite` from finding 2), and the agent applies it on the real kernel. Exercise N-D2 on the hybrid runs on real netfilter, and `iptables -t nat -L -v` shows real counters.
> 5. `kubectl exec` → kube-lite → `ttyS1` → `crun exec -t <id> sh`; `kubectl logs` — container stdout to a file, the tail over `ttyS1`.
> 6. Images — i386 rootfs from the course registry (04/7.6); `trainer/web` is built as a static Go binary with `GOARCH=386`.
>
> **Kernel.** Add to the `dt-kernel` config list (09/1.4) `CONFIG_VXLAN`, `CONFIG_WIREGUARD`, `CONFIG_NETFILTER_XT_MATCH_STATISTIC`, `CONFIG_NETFILTER_XT_MATCH_COMMENT`, `CONFIG_NETFILTER_XT_MARK`, `CONFIG_NF_CONNTRACK`, `CONFIG_IP_NF_TARGET_MASQUERADE`, `CONFIG_NFT_NUMGEN`, `CONFIG_BRIDGE_NETFILTER` (for `br_netfilter`: without it, pod traffic to a ClusterIP on the same bridge does not pass through iptables — a classic mistake worth showing with a "break it" button).
>
> **Where it is used.** Not in every lesson, but where a real kernel adds something new: KN2–KN4 (real veth, bridge, iptables), K6 (real OOM kill, the pod's `memory.max`), "the node went down" (pods move to real nodes), `kubectl exec` into a real container. The remaining lessons run on plain kube-lite.
>
> **Phase 0 (spike, 1 week):** two v86 nodes + `vswitch` + agent: `kubectl run` → a real process in a real netns, ping between pods on different nodes, ClusterIP DNAT via `iptables-restore`. Criteria: pod start ≤ 3 s, tab memory ≤ 1.2 GB, 60 fps animation at 50 frames/s on the switch.

---

## 5. BLOCKING — There is no documentation ladder (R2)

**Where:** the whole document. Section 11 (the AI model), 6.3 (the "why?" button), 7 (exercises), 9 (exams).

**What is wrong.** There is no ladder of steps 1–5. The exams are close to step 5 (the kubernetes.io side panel), but there are no tasks "on things that were not in the course". The AI model has no "where did you look?" mode. The simulator supports only the commands from table 5.5, while step 4 needs commands that are supported but were not introduced in the theory.

**Fix.**

1. Add a `taught_in` column (module or `—`) to table 5.5. Commands and flags with `—` are supported but not explained in lessons; step 4 tasks are built on them. The minimal "support, do not teach" list: `kubectl get --sort-by`, `-o custom-columns`, `-o jsonpath` with `range`, `kubectl debug` (ephemeral container and `node/`), `kubectl get --raw /readyz?verbose`, `kubectl wait --for=jsonpath=…`, `kubectl logs --all-containers --prefix`, `kubectl cp`, `kubectl top pod --sort-by=memory`, `kubectl rollout status --timeout`, `kubectl create deployment --replicas --port`, `kubectl get endpointslices -o wide`, the fields `sessionAffinity`, `internalTrafficPolicy`, `topologySpreadConstraints`, `dnsConfig`, `lifecycle.preStop`, `terminationMessagePolicy`.
2. Render `-h` help and `kubectl explain` in the "page anatomy" view: tabs *Usage / Examples / Options* for `--help` and *KIND / VERSION / FIELD / DESCRIPTION / FIELDS* for `explain`. For step 2, the relevant line is highlighted.
3. The ladder by module (an example for three modules; the rest follow the same template):

| Step | K3 Deployment | KN4 Service | K15 Installation |
|---|---|---|---|
| 1 (B, flicker) | under the `kubectl rollout undo` line — a "where is this from" icon: a link to [kubectl rollout undo](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_rollout/kubectl_rollout_undo/) and `kubectl explain deploy.spec.strategy`, optional | an icon next to `targetPort` → [Service: defining a Service](https://kubernetes.io/docs/concepts/services-networking/service/#defining-a-service) | — |
| 2 (fragment hint) | hint D05 — a fragment of `kubectl rollout undo --help`, section *Examples*, with the `--to-revision=3` line highlighted | hint — a fragment of `kubectl explain service.spec.ports.targetPort` with "Number or name of the port to access on the pods" highlighted | hint — a fragment of the kubeadm upgrade page with the `kubeadm upgrade plan` line highlighted |
| 3 (find the flag, E starts here) | "Find the flag that waits for the rollout no longer than 60 s" — only a link to `kubectl rollout status --help` is given; check: `rollout status --timeout=60s` or an equivalent `wait` in the history | "Make requests from one client go to one pod" — a link to the Service page; check: `spec.sessionAffinity=ClientIP` | "Find how to check the expiry of control plane certificates" — a link to kubeadm certs; check: a file with the output of `kubeadm certs check-expiration` |
| 4 (forcing) | "Roll out so that the new pods are spread evenly across nodes" — no hints; `topologySpreadConstraints` is needed, it was not in the theory | "Traffic from a pod to a Service must stay on its node" — `internalTrafficPolicy: Local` is needed, it was not in the theory | "The node does not join, the token has expired" — `kubeadm token create --print-join-command` is needed |
| 5 (exam) | only kubernetes.io and helm.sh are open; 2 of the 16 tasks of exam E are on fields that are not in the course (`podFailurePolicy` of a Job, `trafficDistribution` of a Service) | same | same |

4. Mentor mode at step 4 (add to section 11): "At step 4 the model does not name the flag or the field. The first answer is the question 'Where did you look?' with a list of places: `kubectl explain <path>`, `kubectl <command> --help`, the kubernetes.io page from the lesson's `sources`. If the learner names a place, the model points to the section of the page (*Examples*, *FIELDS*), but not the line. The documentation side panel records which pages the learner opened. This data is only for review and for the mentor; it does not affect the grade."
5. Levels: the beginner goes through steps 1→2 in K0–K4, step 3 from K5, step 4 from K11 and in K16; the intermediate learner starts from step 2, the experienced learner from step 3, as R2 requires.

---

## 6. BLOCKING — The real-stage verifier contradicts 09 and itself, and the network check cannot be performed

**Where:** 9.3 (last paragraph), 10.4, 13 (JSON format).

**What is wrong.**
1. In 05 the verifier is a bash script `trainer-check.sh`. In 09/5.4 it is a Go agent `trainer-check run --track r2 --nonce …` with signed packages and two operating modes. One mechanism is described in two ways.
2. According to 10.4 the script "changes nothing in the cluster", while according to 9.3 "the check script itself breaks one component". This is an internal contradiction. In 09 the breakage is introduced by the agent via a signed package and only in server mode.
3. The `net` check: "the external address responds — checked by the learner's browser itself via `fetch(http://<ip>/healthz)` (the image sends the CORS header)". The trainer is served over HTTPS, and the browser blocks `fetch` to `http://` from an HTTPS page as active mixed content; CORS does not help here. In addition, local VMs on the learner's computer have no inbound public addresses (09/5.3), so for them the check can never pass.
4. The check vocabulary of 5.6 (`get+expect` JSONPath, `probe`, `can_i`, `same_uid`, `history`) is a separate language, not the 09 contract "`dt.facts/v1` facts → predicates". That means two evaluators and two Go implementations.

**Fix.**
1. In 10.4, replace steps 2–3 with a reference to 09/5.4: "The verifier is the `trainer-check` agent (09, 5.4). The Kubernetes block only defines the fact scopes and probes of the track for it."
2. In 9.3, write: "the breakage is introduced by the `trainer-check` agent via a signed package in server mode (09, 5.6); in serverless mode exam E on a VM is not graded but runs as a self-check, and the learner introduces the breakage themselves with a command that the trainer shows in full".
3. Run the `net` check from the inside: the agent (or a one-off `trainer-probe` pod from the course image, launched by the probe script) runs `curl` against the Gateway address from the node and from outside the node, if there is a second host, and puts the result in `facts.http`. The browser does not perform probes.
4. Rewrite the 5.6 vocabulary using the 09/2.3 predicates. For example: `endpoints` → `k8s.objects[kind=EndpointSlice][metadata.labels.kubernetes.io/service-name=api].endpoints[conditions.ready=true]#>=2`; `same_uid` → `keep:`; `history` (observation during the task) — formalize as an extension of the predicates in 09 with named "watchers" (`watch.minReadyReplicas(web)>=2`) and agree it with the author of 09.

---

## 7. MAJOR — Reference runs on kind, not k3s, and not where agreed

**Where:** 5.7.

**What is wrong.** "Real k3s (kind in GitHub Actions on every PR)". kind is not k3s: it is kubeadm in containers with the kindnet CNI, the service network `10.96.0.0/12`, the pod network `10.244.0.0/16`, DNS `10.96.0.10`, without Traefik, ServiceLB and kube-router. The simulator, meanwhile, reproduces the k3s layout (`10.42/10.43`, `10.43.0.10`, local-path, Traefik). A line-by-line comparison of outputs will diverge on every address, and the behavior of NetworkPolicy and LoadBalancer will diverge in substance. In addition, 09/1.3 fixes the runs on the course's own CI runners and test VMs, not in GitHub Actions.

**Fix.** "Reference recordings are captured on k3s of the specified version (the `stable` channel, version pinned in the scenario) on a separate course test bench, as 09, 1.3 requires; once a day — on kubeadm v1.36/v1.37 with Cilium for the K15 and KN3–KN4 commands (eBPF mode). Scenarios that depend on the CNI are recorded twice: flannel (k3s) and Cilium (kubeadm)." kind in CI is acceptable only for quick schema checks, not for reference runs.

---

## 8. MAJOR — `etcdctl snapshot status` and `restore` were removed in etcd 3.6

**Where:** 5.5 (last paragraph), D25, exam E nos. 6–7, 10.4 step 3.

**What is wrong.** Starting with etcd v3.6, `etcdctl snapshot restore` and `etcdctl snapshot status` were removed. A snapshot is still taken with `etcdctl snapshot save`, while checking and restoring are done with `etcdutl snapshot status|restore` ([etcd v3.6.0](https://etcd.io/blog/2025/announcing-etcd-3.6/), [Disaster recovery](https://etcd.io/docs/next/op-guide/recovery/)). Kubernetes v1.36/v1.37 run on etcd 3.6, so the commands in D25, E7 and in the verifier on a real cluster will fail.

**Fix.** D25: "the snapshot is checked with `etcdutl snapshot status /opt/backup/etcd.db -w table`". E7: "`etcdutl snapshot restore /opt/backup/etcd-old.db --data-dir /var/lib/etcd-restored`, then the `hostPath` of the `etcd-data` volume in `/etc/kubernetes/manifests/etcd.yaml`". In the simulator, `etcdctl snapshot restore` must produce the real etcdctl 3.6 error (unknown subcommand). This is a ready step 4 task for the documentation ladder: the old tutorial does not work, look it up in the etcd documentation.

---

## 9. MAJOR — Native routing and eBPF are mixed up, there is no MTU, no SNAT of pods on egress

**Where:** 6.4, scene 2; 5.4 "Network".

**What is wrong.** "A 'Cilium native routing / eBPF' toggle, where there is no encapsulation, and one sentence on why it is faster". These are two independent choices. The delivery method between nodes is either VXLAN/Geneve encapsulation or direct routing (native routing). The datapath is either iptables/kube-proxy or eBPF. By default Cilium runs with eBPF and VXLAN at the same time. Native routing requires the network underneath the nodes to be able to route the podCIDRs (shared L2, cloud routes or BGP); without that, packets are simply lost. "Faster" cannot be explained without MTU: VXLAN encapsulation is 50 bytes of headers, a pod MTU of 1450 with 1500 on the node. Nowhere is the pod's egress to the internet via MASQUERADE to the node IP shown, and that is the primary cause of the question "why does the external service see the node IP rather than the pod IP".

**Fix.** Replace scene 2 with explainer 1 from finding 3 (two independent toggles and an MTU slider). Add to 5.4: "Pod traffic leaving the cluster is SNATed to the node IP (`KUBE-POSTROUTING`/the flannel `MASQUERADE` rule for addresses outside `10.42.0.0/16`)".

---

## 10. MAJOR — Violations of term order within the document

**Where:** 6.4 scene 5; 4 (K4); 6.1 screen 3; 5.4 / 6.5 (scheduler in K3); 6.4 scene 1.

**What is wrong and how to fix it.**
- Scene 5 in K4 breaks "the readiness probe fails" and "NetworkPolicy default-deny". Probes are introduced in K6, NetworkPolicy in K10. Fix: keep two breakages in K4 (KN4) (selector and `targetPort`), add readiness to K6 as a return to this visualizer, NetworkPolicy to KN7.
- K4 says "headless and ExternalName — for intermediate and experienced", while in table 3 the headless Service is listed under no. 31 in K7. Fix: headless is introduced in KN5 (DNS: several A records), and K7 relies on it. The order is K4 → K7, as also stated in the paragraph after table 4.
- The "load increased (HPA)" button and the metrics-server block in the constructor from K4, although HPA is introduced in K6. The button should appear only after K6 (a silhouette with the caption "unlocks in K6").
- The `FailedScheduling` example in K3 contains `untolerated taint {node-role.kubernetes.io/control-plane: }`, while taints are introduced in K11. K3 needs a scenario without a tainted control plane (k3s does not taint the server node by default, which is a convenient occasion) or a forward-reference footnote `forward: [K11]`.
- Scene 1: "network namespace (card from the Linux block)". The network namespace is introduced in the "Networks" block (`N21`), and by K4 the learner already has the Kubernetes namespace from K2. Under the homonym rule (01/6.1), the screen must explicitly contrast them: "a Linux network namespace is not the Kubernetes namespace from K2".
- VXLAN and "tunnel" in scene 2 are not introduced anywhere. The beginner gets "encapsulation" (relying on the tunnel from N14 of document 03); the name VXLAN is intermediate level.

---

## 11. MAJOR — The real-cluster stages do not match R12, Terraform and Ansible conflict with the block order

**Where:** 10.1, 10.3; section 4 (K15).

**What is wrong.** R12: stage 2 — a single node on one's own machine or a single VPS (k3s/minikube/kind) with Helm, Ingress and images from a real registry; stage 3 — kubeadm on 3+ VMs with Cilium, storage, certificates, upgrade, etcd backup, breaking and fixing a node, with VMs ordered via Terraform and configured via Ansible. In 05 the intermediate level installs k3s on three nodes (R2), kubeadm is available only to the experienced level, R3 has no storage and no certificates, and there is no Terraform or Ansible. According to 01 (section 5), IaC comes **after** Kubernetes, so at stage 3 the learner does not yet know Terraform.

**Fix.**
- Stage 2 (= R1 for all levels): a single k3s node on one's own machine (Multipass/UTM/WSL2) or a single VPS. A Helm release, Gateway via Traefik, an image from the course's `ghcr.io` and an image built by the learner in CI (`C11`) and pushed to their registry.
- Stage 3 (intermediate and experienced, optional for beginners): kubeadm, 1 control plane + 2 workers, Cilium, storage (local-path-provisioner; for experienced — cloud CSI or Longhorn), `kubeadm certs check-expiration/renew`, a minor version upgrade, etcd backup and restore via `etcdutl`, breaking and fixing a node.
- Terraform and Ansible: stage 3 is done twice. First by hand, in the Kubernetes block: the learner feels the pain, which matches the rationale of 01. Then as a repeat at the end of the IaC block: the same cluster is ordered with Terraform and configured with Ansible roles, and the same `trainer-check r3` track checks it. Agree this with 06; add a reference in 05: "the R3-iac track is in document 06".
- Cost and deletion are already there (10.2, 10.5): keep them mandatory in both passes.

---

## 12. MAJOR — k3s in a public cloud: inter-node pod traffic goes as plain VXLAN over the internet

**Where:** 10.3, steps 1–4.

**What is wrong.** At Hetzner and Selectel, VMs communicate over public addresses by default. In that case flannel VXLAN carries pod traffic over the internet unencrypted, and UDP 8472 open in the firewall can be used to inject packets into the pod network. On three VMs of one provider this must be closed off with a private network.

**Fix (insert into 10.3).**
> 1a. **Private network.** Hetzner: `hcloud network create --name trainer --ip-range 10.10.0.0/16 --label trainer=devops`, `hcloud network add-subnet trainer --type cloud --network-zone eu-central --ip-range 10.10.1.0/24`, VMs are created with `--network trainer`. Yandex Cloud: all VMs in one VPC subnet.
> 3. server: `… server --node-ip <private IP> --advertise-address <private IP> --flannel-iface <private interface> --tls-san <public IP>`; agent — `--node-ip <private IP> --flannel-iface …`.
> 2. Firewall: 8472/udp and 10250/tcp — only from the private network, closed from outside.
> If the provider has no private network: `--flannel-backend=wireguard-native` and open 51820/udp between nodes ([k3s networking](https://docs.k3s.io/networking/basic-network-options)). This also builds on WireGuard from N14 of document 03.

For clouds whose private network is itself built on an overlay (on Hetzner Cloud its MTU is 1450), the network becomes nested: the guest's VXLAN on top of the provider's overlay. In `cloud-init` you need to check the MTU of the VM interface and set the Cilium `mtu` explicitly (or check that it detected it itself); otherwise large responses will be lost (MTU blackhole — scenario N15 from 03). Add this to the R3 checklist as the line "check `ip link` on the VM and the MTU of `cilium_vxlan`".

---

## 13. MAJOR — Gateway API is not enabled out of the box in k3s

**Where:** 10.1 R1 ("Traefik via Gateway API"), 10.3 step 6, 10.4 the `net` check.

**What is wrong.** The Traefik built into k3s serves Ingress and its own CRDs by default. The Gateway API provider is enabled via a `HelmChartConfig` with `providers.kubernetesGateway.enabled: true`, and the Gateway API CRDs must be installed ([Traefik: Kubernetes Gateway provider](https://doc.traefik.io/traefik/v3.6/reference/install-configuration/providers/kubernetes/kubernetes-gateway/), [k3s: customizing packaged components](https://documentation.suse.com/cloudnative/k3s/latest/en/add-ons/helm.html)). Without this step the `Gateway Programmed=True` check will not pass.

**Fix — checklist step 6a:**
```yaml
# /var/lib/rancher/k3s/server/manifests/traefik-config.yaml
apiVersion: helm.cattle.io/v1
kind: HelmChartConfig
metadata:
  name: traefik
  namespace: kube-system
spec:
  valuesContent: |-
    providers:
      kubernetesGateway:
        enabled: true
```
Check: `kubectl get gatewayclass` shows `traefik` with `ACCEPTED True`. Keep the CRD version and behavior in `hold` and confirm them with a reference run.

---

## 14. MAJOR — Process explainers: the style violates R4/R5, there are no parameters, no "node went down" explainer

**Where:** 6.1 screen 1 ("each block is drawn in ink"); 12 ("Living ink… wires are drawn in", "the camera descends"); 6.5; section 4.

**What is wrong.**
- R5 explicitly excludes Sankofa ink drawings. 08/5.1 also keeps ink only for metaphors and characters, while Kubernetes components are a mechanism, that is, a technical drawing. The `ink.ts` row must be removed from table 12, and the "camera" parallax replaced by a transition between layers (control plane → node → pod) without camera movement.
- The visualizers in 6.5 are described without parameters. Per R4, each one must have a slider or toggle with immediate recalculation and an explanation next to it.
- R3 lists "node failure" for Kubernetes. It is missing: there is a row in the constructor table, but no explainer with a timeline.

**Fix — parameters for 6.5:**
- Scheduler: sliders for pod requests (CPU/memory), toggles for a taint on the node, nodeSelector, anti-affinity; the resulting `FailedScheduling` is rebuilt on every change.
- Rolling update: sliders `replicas`, `maxSurge`, `maxUnavailable`, `minReadySeconds`, a "new version crashes" toggle. The timeline can be scrubbed, and under it — how many pods are serving traffic (link to EndpointSlice).
- Resources and QoS: sliders for requests/limits and load; on the hybrid (finding 4) the memory limit is written to a real `memory.max`.

**Ready storyboard "The node went down" (K3, revisited in K11).**
1. Screen 1. Three nodes, Deployment `web` with 3 replicas and StatefulSet `db` with 1 replica; under each node a Lease bar that refreshes every 10 s.
2. Screen 2. "Break it": turn off `worker-2`. A counter since the last heartbeat; when `node-monitor-grace-period` is reached (keep the default value in `hold`: in recent versions it was increased from 40 to 50 s — verify against kube-controller-manager of the simulated version), the node becomes `Unknown`, and the taint `node.kubernetes.io/unreachable:NoExecute` appears on it.
3. Screen 3. A `tolerationSeconds` timer (300 s, slider 0–600) on each pod. When it expires, the `web` pods on the node are marked for deletion, and the ReplicaSet creates replacements on live nodes. Note: "taint-based eviction ignores PDBs".
4. Screen 4. The pod `db-0` stays `Terminating`/`Unknown` and is **not** recreated: the StatefulSet does not start a second `db-0` until it is sure the first one is dead. Possible actions: bring the node back, delete the Node object, `kubectl delete pod db-0 --force` (with a warning about two writers to one volume).
5. Toggles: "the node came back after 60 s" (pods stayed in place because the 300 s had not expired), `tolerationSeconds: 30` on `web` (fast relocation), "RWO volume" (the new pod waits for the volume to detach).
6. Network: kube-proxy rules on live nodes remove the addresses of the failed node's pods only after they stop being `ready` in the EndpointSlice. Until then, some requests go nowhere — a "lost requests" counter on the diagram. This is the main network takeaway: readiness and failure detection time determine how many requests will be lost.

---

## 15. MAJOR — The reconciliation loop (R10) is not finished: no "kill a node", no controller chain, not everyone writes a controller

**Where:** 6.2.

**What is wrong and how to fix it.**
- Screen 2: add the perturbations "turn off a node" (tied to the storyboard from finding 14) and "change the image in the Deployment" (not only in the ReplicaSet), to see how a second ReplicaSet appears.
- Add **screen 4 "Chain"**: five small loops in a row — Deployment controller → ReplicaSet controller → scheduler → kubelet → (for Service) EndpointSlice controller. Each with its own "desired/actual" columns. A single learner action (`replicas: 3 → 5`) triggers a wave of differences from left to right; clicking a loop shows the object it watches and the field it writes.
- Screen 2b: R10 requires the learner to write a controller. Currently the intermediate level is listed as "basics (CRD and a ready operator)". Proposal: the beginner fills in 3 lines (comparison and creation) in a ready `Website` controller; the intermediate learner writes `reconcile` in full; the experienced learner adds ownerReferences, status conditions and a finalizer.
- In the code template, a comment promises "creates a Deployment and a Service", but the code does not create a Service, and ownerReferences are not set, even though the scenario checks cascading deletion. Either add `renderService` and `ownerReferences` in `renderDeployment`, or fix the comment and the scenario description.

---

## 16. MAJOR — Multi-node mode requires a memory budget and a kernel that 09 does not have

**Where:** section 0, item 1; 5.7 (budgets).

**What is wrong.** Even if the hybrid from finding 4 is accepted, in 09 the tab ceiling is 600 MB for a single machine, and the `dt-kernel` kernel has no VXLAN, WireGuard, statistic, comment, MASQUERADE and `br_netfilter`. Without these modules KN3–KN4 do not work on a real kernel.

**Fix.** In the section "What is needed from other roles" (05 does not have one; section 16 is only the work order), add: "09: a separate memory profile for the hybrid cluster (≤ 1.2 GB, `deviceMemory ≥ 8`); the kernel modules from finding 4; `vswitch` with attachment of simulated netlab devices. 03: VXLAN and netfilter extensions (finding 2). 04: i386 rootfs for `trainer/*`, `crun` in `lab-node`. 06: the R3-iac track. 08: one constructor (finding 1), explainers KN1–KN5 in the technical-drawing style."

---

## 17. MAJOR — The list of providers and the price sources diverge from 09

**Where:** 10.2.

**What is wrong.** 09/5.2 calls `providers.yaml` its own and lists VK Cloud, AWS (Free plan), Oracle Always Free, Multipass/UTM, and Hetzner from the official page. In 05 they are missing, DigitalOcean is described without conditions, and the Hetzner price is taken from the bitdoze aggregator. The Yandex grant conditions in 05 are given without the "card / bank transfer" distinction that 09 has.

**Fix.** Reduce 10.2 to a reference to 09/5.2 and a "which track fits" column. The Hetzner price source is [docs.hetzner.com](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/). Remove the DigitalOcean row or give it concrete conditions from the promotion page.

---

## 18. MINOR — The iptables example is called "the real view" but does not match kube-proxy output

**Where:** 6.4, scene 3.

**What is wrong.** A real `iptables-save` shows 16-character chain hashes, comments, `KUBE-MARK-MASQ` and probabilities with 11 digits. A learner who compares the example with a real cluster will see something different.

**Fix:**
```
-A KUBE-SERVICES -d 10.43.12.7/32 -p tcp -m comment --comment "default/web cluster IP" -m tcp --dport 80 -j KUBE-SVC-LOLE4ISW44XBNF3G
-A KUBE-SVC-LOLE4ISW44XBNF3G ! -s 10.42.0.0/16 -d 10.43.12.7/32 -p tcp -m comment --comment "default/web cluster IP" -m tcp --dport 80 -j KUBE-MARK-MASQ
-A KUBE-SVC-LOLE4ISW44XBNF3G -m comment --comment "default/web -> 10.42.1.15:8080" -m statistic --mode random --probability 0.33333333349 -j KUBE-SEP-QZ4N3B7D2YH6VW5K
-A KUBE-SVC-LOLE4ISW44XBNF3G -m comment --comment "default/web -> 10.42.2.9:8080" -m statistic --mode random --probability 0.50000000000 -j KUBE-SEP-5R2XWJ7M4H8C1PLA
-A KUBE-SVC-LOLE4ISW44XBNF3G -m comment --comment "default/web -> 10.42.0.22:8080" -j KUBE-SEP-C3T9K1Q6ZB2N7EXD
-A KUBE-SEP-QZ4N3B7D2YH6VW5K -s 10.42.1.15/32 -m comment --comment "default/web" -j KUBE-MARK-MASQ
-A KUBE-SEP-QZ4N3B7D2YH6VW5K -p tcp -m comment --comment "default/web" -m tcp -j DNAT --to-destination 10.42.1.15:8080
```
Generate the hashes the way kube-proxy does (base32 of SHA-256 of the service name and port) so that they match the reference. The rule `KUBE-SEP … -s <podIP> … KUBE-MARK-MASQ` is an occasion for a separate "hairpin" screen.

---

## 19. MINOR — `kubectl get` of several types fails entirely if one CRD is missing

**Where:** 10.4, step 3.

**What is wrong.** `kubectl get nodes,…,gateway,httproute,application -A -o json`, when the Argo CD CRD is missing (track R1), fails with the error `the server doesn't have a resource type "application"`, and there is no output at all.

**Fix.** The agent first checks `kubectl api-resources -o name`, then reads each type separately, and records missing types in the facts as `absent`.

---

## 20. MINOR — The "real `providerID`" check proves nothing

**Where:** 10.4, step 4.

**What is wrong.** On k3s without a cloud CCM, `providerID` is `k3s://<hostname>`; on kubeadm without a cloud provider it is empty. In both cases a real cluster will fail the check or pass it on a false signal.

**Fix.** Take the "not a simulator" signal from `kernelVersion`, `osImage`, `containerRuntimeVersion` and `nonce`. Do not check `providerID`.

---

## 21. MINOR — Ambiguous level-check questions B4 and B6

**Where:** 2.1.

- B6 "port 80 and 8080 — two services or two addresses of one machine": both ports can be listened on by one process, so the answer "two services" is inaccurate. I propose this wording: "On the server, `ss -ltn` shows `0.0.0.0:80` and `0.0.0.0:8080`. What does this mean? (a) two listening sockets on one IP, reached via different ports; (b) the machine has two IP addresses; (c) one and the same socket". The answer is (a). The concept checked is `N13`.
- B4: with a `search` domain in `resolv.conf`, `nslookup web` will first query `web.<domain>`. It needs to be clarified as "on a machine without search domains", or checked via `dig web.` (this prepares for KN5).

---

## 22. MINOR — `containerPort` in the K4 quiz is presented as the source of truth

**Where:** 8, the K4 example.

**What is wrong.** `containerPort` is an informational field: traffic goes to `targetPort` regardless of it. The error in the quiz is not a mismatch between two YAML fields, but that the application listens on 80 while the Service sends to 8080.

**Fix.** Explanation: "The Service sends to `targetPort`. `containerPort` is only a description: check which port the process actually listens on (`kubectl exec … -- ss -ltn`)."

---

## 23. MINOR — The CrashLoopBackOff and node-monitor-grace-period values depend on the version

**Where:** 5.2 (virtual clock), 5.4 "kubelet", "Nodes".

**What is wrong.** The initial and maximum CrashLoopBackOff delay are changed by the KEP-4603 feature (the reduced delay is behind a feature gate), and the default value of `node-monitor-grace-period` has been increased in recent versions. The text records them as unchanging facts.

**Fix.** Mark both values as `hold` with version v1.37 and confirm them with a reference run (the mechanism is already described in 12 and 15).

---

## 24. MINOR — Installation via `curl | sh` contradicts the verifier's security lesson

**Where:** 10.3 steps 3–4 and 10.4 step 2.

**What is wrong.** In 10.4, running `curl | bash` is forbidden "so that the learner reads it first", while in 10.3 k3s is installed exactly that way.

**Fix.** First `curl -sfLo install-k3s.sh https://get.k3s.io && less install-k3s.sh`, then `sh install-k3s.sh …`. This is also a step 3 task of the documentation ladder: "find the variable in the script that pins the version" (`INSTALL_K3S_VERSION`).

---

## 25. MINOR — Endpoints and `kubectl get endpoints`

**Where:** 5.3; 08/6.4 (commands).

**What is wrong.** The Endpoints API has been deprecated since v1.33, and kubectl prints a warning. 05 correctly keeps it "read-only", but 08/6.4 teaches `kubectl get endpoints`.

**Fix.** Add to 05: "the simulator prints the real Endpoints deprecation warning; all lessons use `kubectl get endpointslices -l kubernetes.io/service-name=<svc>`". Ask the author of 08 to replace the command.

---

## 26. MINOR — The filter `yc … --filter 'labels.trainer="devops"'` is not confirmed

**Where:** 10.5.

**What is wrong.** The syntax of the label filter in `yc compute instance list` is not backed by a reference in the document.

**Fix.** Keep it in `hold` until the command is confirmed by the Yandex Cloud CLI reference page and a reference run. Fallback: `yc compute instance list --format json | jq '.[] | select(.labels.trainer=="devops") | .id'`.

---

## 27. MINOR — R1 priorities: the textbook is thinner than the practice

**Where:** section 4 (modules are described in one line), 13.

**What is wrong.** R1 puts at the core a textbook with coherent theory and strict ordering, process explainers and the habit of reading documentation. The document describes the simulator, exercises and exams in detail, while the lessons get one line per module. There is no list of screens with `introduces` for any module except K0.

**Fix.** For each module, give a list of screens: title, one introduced concept, the process explainer the screen is tied to, the documentation ladder step. Example for KN4:

| Screen | introduces | Explainer | Docs |
|---|---|---|---|
| 1. Pods are mortal, addresses change | — | explainer 1, "delete pod" button — the IP changed | step 1: Pod lifecycle |
| 2. Service — a stable address | `K14` (Service) | explainer 2, screen 1 | step 1: Service |
| 3. Who knows the pod addresses | EndpointSlice | replicas slider | step 2: `kubectl explain endpointslice.endpoints.conditions` |
| 4. An address that does not exist | — (ClusterIP is part of `K14`) | `ip a` on the node | — |
| 5. Who rewrites the address | `K15` (kube-proxy) | mode toggle | step 2: Virtual IPs |
| 6. Why load balancing is uneven | — | keep-alive toggle | step 3: find `sessionAffinity` |
| 7. Break it and fix it | — | "break it" ×3 | — |

---

## What is confirmed and does not need changing

The `FailedScheduling` format with the tail about preemption; the `cni plugin not initialized` message; `tolerationSeconds` 300 for `unreachable`; k3s: podCIDR `10.42.N.0/24`, ClusterIP `10.43.0.0/16`, DNS `10.43.0.10`, flannel VXLAN on 8472/udp, ServiceLB, local-path; REJECT on an empty EndpointSlice → `Connection refused`; RST on a wrong `targetPort`; `externalTrafficPolicy: Local` — a node without a pod does not respond; the answer to E6 (DNAT is done by the kernel of the client pod's node); the meaning of the ingress-nginx end-of-support announcement (March 2026); IPVS is being phased out, nftables is the main path; the Webernetes license and composition (Apache-2.0, TypeScript), except for the conclusion about the pod network (finding 2).

Verification sources: [etcd v3.6.0](https://etcd.io/blog/2025/announcing-etcd-3.6/), [etcd disaster recovery](https://etcd.io/docs/next/op-guide/recovery/), [DevClass on v1.37](https://www.devclass.com/devops/2026/08/27/kubernetes-cleans-house-bins-legacy-kube-dns-ipvs-and-cgroup-v1/5292767), [Webernetes](https://github.com/ngrok/webernetes), [Traefik Gateway provider](https://doc.traefik.io/traefik/v3.6/reference/install-configuration/providers/kubernetes/kubernetes-gateway/), [k3s helm add-ons](https://documentation.suse.com/cloudnative/k3s/latest/en/add-ons/helm.html).
