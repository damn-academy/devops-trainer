# Review of 09 "Platform architecture" (reviewer: the author of 04 "Containers")

Reviewer: a container runtime engineer (the author of `04-containers.md`). Date: 18.11.2026. Document under review: `09-runtime-ai-architecture.md`, version 1.

## Verdict

The document is strong where it brings the decisions of the blocks together into one platform: a single `Machine` interface, the "facts → predicates" contract, one `dt-kernel` kernel for two root filesystems, local-first storage, an honest exam model, and an analysis of CORS for the AI model providers. From the runtime point of view, the decision "v86 for the real kernel, TS simulators for docker/kubectl" is correct, and I support it. But the document was written before the owner's requirements R1–R12, and in three places it does not cover what is mandatory: a multi-node network in the browser with our own switch and hybrid Kubernetes (R11; R9 and R10 rest on them), platform support for the documentation ladder (R2), and recomputing a process when a parameter changes in the explainers (R4). In addition, I checked the v86 sources (`src/browser/inbrowser_network.js`, `fake_network.js`, `starter.js`, master branch as of 18.11.2026): the `inbrowser` backend is a hub on BroadcastChannel, and the `fetch`/`wisp` backends answer ping to any address and any DNS query themselves. For a course where "every network problem is tied to a layer", this is a lie at L3, and it has to be worked around explicitly. The fact schema and the predicate language in their current form cannot express half of the checks of the containers block and of the section "How the kernel isolates and limits" (R6), and the grammar has errors that will produce false positives. In total: 3 blocking, 11 major and 10 minor findings; each one below comes with ready text or a schema to paste.

---

## Blocking

### 1. BLOCKING — Multi-node network in the browser: `inbrowser` is a hub, not a switch; there is no switch of our own and no topology (R11)

**Where:** 0 "Decisions in brief" (the "Tier B network" row), 1.4 (image table: "two machines of 192 MB each"), 1.6 "Machine network in the browser".

**What is wrong.**
- In v86, `InBrowserNetworkAdapter` subscribes the network card to a single `BroadcastChannel("v86-inbrowser-<id>")` and sends every frame to all other machines on that channel; in the code it is marked `experimental`. This is a hub: `tcpdump` on any machine sees other machines' traffic, there is no MAC table, there is a single segment, and it is impossible to break an individual link, delay or drop a packet, or draw a frame's path. The networks block (03, N1) teaches that a switch "learns which MAC is behind which port" — the trainer on tier B will show the opposite.
- R11 requires 3–4 machines of 64–128 MB each in Web Workers, connected by our JS switch with real L2 (ARP, ping, tcpdump, routing, iptables, NAT, WireGuard between nodes) and a visualization of the switch. The document has none of this: only "two or three machines of one lab" and a tab memory budget for one machine (≤ 600 MB).
- The cloning problems are not solved: if three nodes are restored from one snapshot, they have the same MAC, hostname, `/etc/machine-id`, ssh host keys and DHCP address. v86 has the `mac_address_translation` and `preserve_mac_from_state_image` settings for this (visible in `starter.js`), but the document does not use them.
- In the current `starter.js`, a machine has one network card (`settings.net_device`, `ne2k` by default). A router between two segments needs two "legs"; this has to be solved with VLAN subinterfaces, otherwise the lesson "a packet through NAT/a router" cannot be built on tier B.
- By default `ne2k` is emulated, not virtio: `VIRTIO_NET` is enabled in the kernel, but `net_device.type: "virtio"` is not set in the machine configuration. ne2k is noticeably slower, which is critical for four nodes.

**Fix — insert a new section 1.8 "Multiple machines and our own `dt-switch` switch":**

> **1.8. Multiple machines and our own switch**
>
> We do not use the `inbrowser` backend from v86: it is a hub on BroadcastChannel, and it shows the learner the wrong L2 model. Instead, we use our own network adapter `DtSwitchAdapter`, which subscribes to the v86 bus events `net0-send` and sends frames to `net0-receive` (the same mechanism as the built-in adapters), and our own switch `dt-switch` in a dedicated worker `net.worker.ts`.
>
> **Topology.** Each machine is a separate `v86.worker.ts` (up to 4 on a laptop, 1 on a phone — on a phone, multi-node labs run only in recorded mode). The machine worker and `net.worker.ts` are connected by a `MessageChannel`; a frame is passed as a transferable `ArrayBuffer` without copying. The lab scenario describes the topology:
>
> ```yaml
> topology:
>   switches:
>     - { id: sw1, vlans: [10, 20], mac_aging: 300s }
>   machines:
>     - { id: node-1, image: lab-node, mem: 128M, port: { switch: sw1, mode: trunk, vlans: [10, 20] } }  # router: eth0.10 and eth0.20
>     - { id: node-2, image: lab-node, mem: 96M,  port: { switch: sw1, mode: access, vlan: 10 } }
>     - { id: node-3, image: lab-node, mem: 96M,  port: { switch: sw1, mode: access, vlan: 20 } }
>   uplink: { switch: sw1, vlan: 10, to: lab-internet }   # "mini-internet" from lab-net or the netlab gateway
> ```
>
> **What the switch does.** A learning MAC table with aging; 802.1Q VLANs (access/trunk), since a machine has one network card; broadcast and unknown unicast go to all ports of the VLAN except the ingress port; per-port parameters `up`, `delay_ms`, `loss_pct`, `rate_kbps` (needed for R4: the "latency slider" and "break the link" in the TCP explainer); frame counters. Each frame is parsed up to L4 and published to the bus as `net.packet` (and a new `l2.frame` event with `{switch, in_port, out_ports, src_mac, dst_mac, vlan, ethertype}`), so the switch diagram and the packet animator (08, 3.6) work on the real traffic of real kernels. Packet capture: a ring buffer per port, export to pcap and viewing in our header parser (the same "envelope with layers" widget, 08, 6.3).
>
> **Clone identity.** Nodes start from one `lab-node` snapshot. After `restore_state`, the adapter enables `mac_address_translation` and assigns the node the MAC `02:dt:<lab>:<n>`; the service agent on `ttyS1` receives the command `identity {hostname, ip, machine_id, ssh_host_key}` and applies it before the first prompt (`hostname`, `ip addr`, regenerating `/etc/machine-id`, replacing the host keys from the lab package). Addresses are static or from `dnsmasq` on one of the nodes — as the scenario specifies.
>
> **Card.** `net_device: { type: "virtio" }` in all images.
>
> **Acceptance budgets (phase 0):** 3 nodes × 128 MB guest — tab memory ≤ 1.6 GB; 4 nodes × 96 MB — ≤ 1.8 GB; idle nodes in total ≤ 15% of one core (kernel with `NO_HZ_IDLE`, `HZ_100`); `ping` between nodes — RTT ≤ 20 ms; `iperf3` between nodes — ≥ 5 Mbit/s; a consistent snapshot of the whole lab (pause all machines → `save_state` of each → switch state) ≤ 160 MB in OPFS and ≤ 10 s. Multi-node labs are not shown when `navigator.deviceMemory` < 8 (and when it is absent — see finding 21); the recorded mode is shown instead.

Add an image to table 1.4:

> | `lab-node` | `lab-alpine` + `bash`, `tcpdump`, `iperf3`, `wireguard-tools`, `conntrack-tools`, `ipvsadm`, `nftables`, `dnsmasq`, `dt-kubelet` (section 1.9) | 96–128 MB | Multi-node network labs (ARP, routing, NAT, WireGuard), pod network, hybrid Kubernetes |

In table 1.6, replace the row "Two or three machines of one lab" with "Several machines of one lab | our own `dt-switch` adapter | section 1.8".

### 2. BLOCKING — Hybrid Kubernetes (kube-lite + a real kubelet agent on v86 nodes) is missing (R11, R9, R10, R12 stage 1)

**Where:** 1.7 "Simulated layer for docker and kubectl"; 0 "Decisions in brief" (the "Docker and kubectl" row); section 7 "Work plan".

**What is wrong.** In the document, `kubectl apply` ultimately creates a "docker-like container on a node" of the simulator. Requirement R11 is to prototype the hybrid first: the control plane is kube-lite, and on every v86 node there is a small real kubelet that starts pods via `crun`, so that `kubectl apply` produces real processes in real namespaces, `kubectl exec` enters a real container, and a killed node forces pods to move. R9 (find the path of a packet to a ClusterIP in the real `iptables`, veth/bridge and VXLAN between nodes on a real kernel) and R10 (the learner's controller sees real processes) rest on the hybrid. None of this is designed, and there is not a single item about it in the work plan.

**Fix — insert section 1.9 "Hybrid cluster":**

> **1.9. Hybrid cluster: control plane in the simulator, pods on real kernels**
>
> Real k3s or kubeadm inside v86 is impossible: k3s is built only for 64-bit platforms, and the control plane does not fit into 128 MB of emulated memory (05, section 1). Therefore the API server, etcd semantics, scheduler and controllers are kube-lite in `sim.worker.ts`, and the nodes are `lab-node` machines from 1.8 with the service agent `dt-kubelet`.
>
> **`dt-kubelet`.** A static Go binary for `linux/386` (the same facts code as `trainer-check`, see finding 7), about 4 MB, delivered over 9p. It talks to kube-lite not over the guest network but over the `ttyS1` service channel via a bridge in the main thread: this way the control plane does not depend on what the learner did to the node's iptables, and this matches reality (the kubelet reaches the API server at a separate address). The protocol is JSON lines:
>
> ```json
> → {"op":"register","node":"node-2","podCIDR":"10.42.2.0/24"}                // at startup
> ← {"op":"pod.sync","pod":{...PodSpec from kube-lite...}}                     // watch of assigned pods
> → {"op":"pod.status","uid":"…","phase":"Running","containerStatuses":[…],"podIP":"10.42.2.7"}
> → {"op":"node.status","conditions":[{"type":"Ready","status":"True"}],"capacity":{"memory":"96Mi","pods":"10"}}  // every 10 s
> ← {"op":"exec","uid":"…","container":"app","cmd":["sh"],"tty":"ttyS2"}       // kubectl exec
> ← {"op":"logs","uid":"…","container":"app","follow":true}
> ← {"op":"svc.sync","services":[…],"endpointSlices":[…]}                      // for kube-proxy rules
> ```
>
> **What the agent makes real.**
> 1. *Pod sandbox:* `crun create` of a pause container (`/pause` from BusyBox `sleep infinity` or our own 20-line `pause` in C) — it has real net, ipc, uts namespaces; the pod's containers are created by `crun` with a `config.json` in which `linux.namespaces` refer to `/proc/<pause pid>/ns/net` and `ns/ipc`. This is exactly what 05 describes in words as "a pod is a group of containers with shared net and ipc" and what the learner assembled by hand in 04, D3.
> 2. *Pod network (CNI-lite, modes per scenario):* a veth into the node's `cni0` bridge, an address from the podCIDR; between nodes — `host-gw` mode (routes `10.42.N.0/24 via <IP of node N>`) or `vxlan` (`ip link add flannel.1 type vxlan id 1 dev eth0 dstport 8472`, FDB entries from the agent). Switching the mode is a toggle in the explainer "a packet between pods on different nodes" (R9); both modes are visible in the pcap of the 1.8 switch — in the second one, a frame inside a frame.
> 3. *kube-proxy-lite on the real kernel:* from `svc.sync`, the agent writes the chains `KUBE-SERVICES`, `KUBE-SVC-*`, `KUBE-SEP-*` with `-m statistic --mode random --probability` into the node's real `iptables-save` — the same names and shape as the kube-proxy-lite model in 05, section 5. `ipvs` mode is available via a toggle (`ipvsadm -Ln`, the `kube-ipvs0` interface of type `dummy`, on which the ClusterIP *exists*, unlike in iptables mode). The eBPF/Cilium mode cannot be reproduced in v86 (Cilium does not build for a 32-bit architecture) and stays in the simulator and at stage 3.
> 4. *Cluster DNS:* on each node, `dnsmasq` at address `10.43.0.10` (the address is added on `lo` or `dummy`); the agent regenerates its hosts file from Services; in the pods' `/etc/resolv.conf` — `search <ns>.svc.cluster.local svc.cluster.local cluster.local` and `options ndots:5`. The learner sees that "CoreDNS" is replaced in the hybrid — this is stated once in the lesson text.
> 5. *Images:* only `linux/386` from the course registry (Service Worker, 04, 7.6) — `busybox`, `alpine`, `nginx` (x86 Alpine package), the training `trainer/app`. The agent pulls the index → selects `platform: linux/386` → manifest → layers → unpacks into `/var/lib/dt/images/<digest>`. An attempt to deploy an image without `386` produces the real message `no matching manifest for linux/386 in the manifest list entries` — a moment to talk about multi-arch.
>
> **Time.** In standalone mode, kube-lite runs on model time (speed-up, rewind). In hybrid mode, model time is bound to real time (`clock: wall`), otherwise node timeouts and probes diverge from the real processes. To make "kill a node" visible within a minute, the hybrid scenario sets `node-monitor-grace-period: 20s` and, for pods, `tolerationSeconds: 30` for `not-ready`/`unreachable`, and says so in the text: "in a real cluster, by default it takes about 40–50 seconds to declare a node unreachable and 300 seconds before pods are evicted; here we sped it up so you have time to see it".
>
> **"Kill a node".** The button stops the machine's worker (or sets the switch port to `down` — that is "the network is gone", not "the power is gone", and these are two different lessons). The `node.status` heartbeat stops arriving → the kube-lite node lifecycle controller sets `Ready=Unknown` → taint `node.kubernetes.io/unreachable` → eviction → the ReplicaSet creates pods → the scheduler places them on live nodes → `dt-kubelet` there starts real processes. All of this is `k8s.*` and `proc.spawn` bus events with real PIDs.
>
> **Checks.** `k8s.objects` facts come from kube-lite; `procs`, `net`, `mounts` facts come from the nodes via `dt-kubelet`. An example R9 goal: "Find where iptables sends a packet to the ClusterIP of the `web` service" — `when: "answer.sep_ip=@k8s.endpoints(web).ip[*]"`, and the comprehension check is a `predict` question before `iptables -t nat -L KUBE-SVC-… -v -n`, followed by comparing the packet counters (`pkts`) before and after a `curl` from a pod.
>
> **Acceptance budgets (phase 0, spike 5):** `kubectl apply` of a Deployment with 3 replicas → all pods `Running` with real PIDs ≤ 10 s; `kubectl exec -it … sh` → prompt ≤ 2 s; "kill a node" → pods on other nodes `Running` ≤ 60 s with shortened timeouts; `dt-kubelet` memory ≤ 15 MB RSS.

Add to section 7: "Phase 0, item 5: hybrid spike — 3 `lab-node` nodes, `dt-switch`, `dt-kubelet` with a pod sandbox and `host-gw`; criterion — the 1.9 budgets" and to v1: "hybrid cluster in the Kubernetes block (pod network, Service, reconcile lessons)". Without this spike, R11 "prototype first" is not fulfilled.

### 3. BLOCKING — No platform support for the documentation ladder (R2)

**Where:** 1.4 (image contents), 2.4 (check description), 4.5 (AI model modes), 4.7 and 6.4 (exams, CSP).

**What is wrong.** The five-step ladder is a requirement for every block, but almost everything it rests on is platform, and 09 does not have it:
- The images have no manual pages: Alpine is installed without `man` by default, while for steps 2–5 the learner must open `man unshare`, `man 7 cgroups`, `man capsh`, `crun --help` on the machine itself. In `lab-debian`, `man-db` is present only "for the commands from 3.3" of the Linux block.
- Step 2 ("a hint is a man page fragment with a highlighted line; the learner learns the anatomy of SYNOPSIS/OPTIONS/EXAMPLES") requires a documentation corpus parsed into sections, with anchors on specific options. There is none.
- Steps 4–5 require distinguishing "a command/flag that was covered in theory" from "one that was not". There is no registry of taught flags, and the build cannot check that a step 4 task really requires something that was not taught.
- Step 4: the AI model answers "where have you looked?" and points to `man`, `--help`, `kubectl explain`, docs.docker.com. There is no such mode in the modes table in 4.5.
- Step 5: during the exam only the official documentation is open (as in the CKA). The CSP in 6.4 contains `frame-src 'none'`, so kubernetes.io cannot be embedded in the panel (and kubernetes.io itself forbids framing), and machines reach the internet only through Wisp with an allowlist. How the learner reads the documentation during the exam is not described.

**Fix.**

(a) In 1.4, add to the image contents: `lab-alpine`/`lab-node` — `mandoc`, `man-pages`, `util-linux-doc`, `iproute2-doc`, `iptables-doc`, `libcap-doc`, `crun-doc` (if there is no such package, we build the `crun(1)` pages ourselves from the crun repository), `jq-doc`; `lab-debian` — `man-db`, `manpages`, `manpages-dev` (for `fork(2)`, `clone(2)`, `unshare(2)`), `libcap2-bin`. The pages live on 9p and are loaded on demand — they do not affect the snapshot budget.

(b) A new section 1.10 "Documentation corpus `dt-docs`":

> **1.10. Documentation corpus**
>
> CI builds the corpus from sources of *the same versions* as in the images and simulators: man pages from the image packages (`mandoc -T html` → split by `.SH`), the `docker` CLI reference for Engine 29.x (from docs.docker.com/reference, Apache-2.0), the `kubectl` reference and `kubectl explain` from OpenAPI v1.37 (the same as kube-lite), kubernetes.io/docs pages from a list (CC BY 4.0), Terraform/Ansible from the list of block 06. The format of one page:
>
> ```yaml
> id: man/unshare.1@util-linux-2.41
> title: unshare(1)
> source: { url: "https://man7.org/linux/man-pages/man1/unshare.1.html", license: GPL-2.0-or-later }
> sections:
>   - { id: NAME, text: "unshare - run program in new namespaces" }
>   - { id: SYNOPSIS, text: "unshare [options] [program [arguments]]" }
>   - id: OPTIONS
>     items:
>       - { anchor: "opt-fork", flags: ["-f", "--fork"], text: "Fork the specified program as a child process of unshare rather than running it directly. …" }
>       - { anchor: "opt-mount-proc", flags: ["--mount-proc[=mountpoint]"], text: "Just before running the program, mount the proc filesystem …" }
>   - { id: EXAMPLES, text: "…" }
> ```
>
> The documentation viewer is our own `docs` widget (rendered with our own DOM nodes, like the AI model's answers in 4.4); it opens to the right of the terminal; external links to the official page open in a new tab. Third-party sites are not embedded (CSP `frame-src 'none'` is kept).
>
> **Registry of what has been taught.** In `content/concepts.yaml`, command concepts get a `flags_taught: { "<lesson-id>": ["-f", "--mount-proc"] }` field. For each route, the build computes the set of flags "taught up to this screen" and checks the tasks by step (the task's `doc_step` field):
> - `doc_step: 1|2` — all flags of the reference solution have been taught or are listed in `doc_hint`;
> - `doc_step: 3` — the task has a `doc_ref` (page anchor), and the reference flag has not appeared in the theory;
> - `doc_step: 4` — at least one mandatory flag of the reference solution has not been taught, and `doc_ref` is *not shown*; hints H1–H5 are disabled except H1;
> - `doc_step: 5` — exam, section 4.7.
>
> **Starting step by level:** beginner — 1, intermediate — 2, experienced — 3; within a block the step grows as the learner completes modules (the rule is in 01), but never falls below the starting step.

(c) In 2.4, add the task fields and the "found the flag" check:

```yaml
- id: g-unshare-mount-proc
  doc_step: 3
  doc_ref: man/unshare.1#opt-mount-proc
  say: { ru: "Запустите sh в новом PID-пространстве так, чтобы ps показывал только процессы внутри. Нужный флаг найдите на странице unshare(1)", en: "…" }
  needs: [procs, mounts]
  when: "procs[cmd=sh][nspid.last=1] && mounts[target=/proc][type=proc][ns=@pid(sh).ns.mnt]"
  fail:
    - if: "procs[cmd=sh][nspid.last=1] && !mounts[target=/proc][ns=@pid(sh).ns.mnt]"
      say: { ru: "PID-пространство новое, но /proc внутри старый — поэтому ps показывает чужие процессы. На странице unshare(1) есть опция, которая монтирует proc заново", en: "…" }
```

(The `ru` strings are Russian UI text: "Run sh in a new PID namespace so that ps shows only the processes inside. Find the required flag on the unshare(1) page" and "The PID namespace is new, but /proc inside is the old one — that is why ps shows other processes. The unshare(1) page has an option that mounts proc again".)

What is checked here is the *result* of using the flag, not the command text: a learner who ran `unshare -p -f -m` and then `mount -t proc proc /proc` by hand is also right.

(d) Add a row to the modes table in 4.5:

> | `forcing` | `doc_step: 4` tasks | Do not name the command, flag or field. For any question about how to do something, first ask: "Where have you already looked?" If the learner has not looked, name the *source* (`man <command>`, `<command> --help`, `kubectl explain <resource>.<field>`, a docs.docker.com section) and the page section (OPTIONS, EXAMPLES), but not the line. If they have looked and did not understand, explain how to read the fragment they found and pasted | The answer is filtered: if it contains the task's reference flag (`solution_flags`), the block is collapsed, as in `lab` |

(e) In 4.7 and 6.4, add about step 5:

> In step 5 exams only the `docs` widget with the 1.10 corpus is open (for certified exams on VMs, also `man`, `--help` and `kubectl explain` on the machine itself); the AI model is disabled. Some exam tasks are marked `beyond_course: true`: the reference solution requires a flag or field that is not in `flags_taught` of any lesson but is in the corpus. The build checks that an exam has at least 2 such tasks and that they make up no more than 30% of the weight.

---

## Major

### 4. MAJOR — The `fetch` and `wisp` backends in v86 fake ping and DNS; this breaks the "which layer is broken" lessons (R8) and the "no third-party servers" promise

**Where:** 1.6 (table, "Wisp relay", item 1 of the list of allowed destinations), 6.4 (CSP `connect-src https:`).

**What is wrong** (checked against `src/browser/fake_network.js`, master):
- `handle_fake_ping` answers an ICMP echo to *any* address, substituting that address as the source of the reply. `ping 10.99.99.99` or `ping 8.8.8.8` from the guest always "works", with zero loss. The lesson "ping does not get through — let's see which layer" is impossible on tier B with these backends, and the learner gets a false picture.
- Any DNS UDP packet, wherever it is headed, is intercepted and resolved via DNS over HTTPS to `cloudflare-dns.com` (`DEFAULT_DOH_SERVER`, `dns_method` defaults to `"doh"`), and the reply comes from the address of the virtual router. Consequences: (1) the learner's queries go to a third party directly from the browser, bypassing our relay and its log — this contradicts the 1.6 policy and the heading "our server is the only way out"; (2) `dig @8.8.8.8 example.com` gets a reply not from the address it sent the query to, and `dig` will predictably discard it; (3) `dig +trace` does not work: the root servers "answer" with the Cloudflare resolver.
- The Wisp client in v86 supports only TCP (UDP is planned), so the allowlist entry `1.1.1.1:53`, `8.8.8.8:53` is useless for a plain `dig`.
- There is no connectivity between machines in `wisp` mode (the guests are isolated).

**Fix.** In 1.6, add a paragraph and correct the list:

> **Limitations of the built-in v86 network stack.** The `fetch` and `wisp` backends do not let L3 out: v86 itself answers the guest's ARP, DHCP, DNS, NTP and ICMP echo to any address. Therefore:
> - `dns_method: "static"` with our list of names, or `doh_server: "<domain>/dns-query"` — a DoH endpoint in `dt-api` that applies the same allowlist and log as the relay. The built-in `cloudflare-dns.com` is never used; CSP `connect-src` gets an explicit `cloudflare-dns.com` exception in a Playwright `deny` test (a check that no requests go there);
> - lessons where it matters whether an address answers ping and who answers DNS (03: N8, N12, N16; R8, the "URL", "name resolution", "where does the 504 come from" processes) run only in the netlab simulator or in a multi-machine `dt-switch` lab (1.8) with the `lab-net` "mini-internet", where every reply comes from a real daemon;
> - in `wisp` mode, one line above the terminal: "This machine reaches the internet through a training gateway: ping and DNS here are answered by the gateway itself, not by real servers";
> - remove `1.1.1.1:53` and `8.8.8.8:53` from the relay allowlist; keep `:53` only for `dig +tcp` if a lesson needs it, and say so in the task.

### 5. MAJOR — The `dt.facts/v1` fact schema cannot express the isolation checks and the "six boundaries" of a container (R6, R7)

**Where:** 2.2 "Fact format".

**What is wrong.** The schema cannot check: a thread versus a process (`/proc/<pid>/task`, TGID), zombies (`state: Z`) for the PID 1 and `tini` drill, capabilities (`CapEff`, `CapBnd` from `/proc/<pid>/status`) for `capsh`/`setcap`, the seccomp mode (`Seccomp:` in `status`), the user namespace UID map (`uid_map`), the network state *inside* the container's namespace (right now `net` is one per machine — so "the application listens on 127.0.0.1 in its own netns" cannot be checked), mount propagation (`shared`/`private` — the key point of the mount ns lesson), whiteout files (character devices 0:0 — `type` allows only `f|d|l`), xattrs (`security.capability`, `trusted.overlay.opaque`), CPU throttling (`cpu.stat`), `pids.current`. `user: string` is ambiguous in a user namespace — a numeric UID is needed. `net.links: object[]` is untyped, while a veth needs a link to its peer.

**Fix — replace the corresponding fields:**

```ts
procs?: {
  pid: number; tgid: number; ppid: number;
  uid: number; euid: number; gid: number; user?: string;      // user — name from the host's /etc/passwd, may be absent
  state: 'R' | 'S' | 'D' | 'Z' | 'T' | 'I';
  cmd: string; exe?: string; root?: string;                    // readlink /proc/<pid>/root — for chroot/pivot_root
  threads: number[];                                           // /proc/<pid>/task/*
  nspid: number[];                                             // NSpid: from outer to inner, the last one is the PID inside
  ns: Record<NsKind, string>;                                  // 'pid:[4026532201]'
  cgroup: string;
  caps: { eff: string[]; prm: string[]; bnd: string[] };       // decoded from CapEff/CapPrm/CapBnd
  seccomp: 0 | 1 | 2;                                          // disabled / strict / filter
  noNewPrivs: boolean;
  uidMap?: [number, number, number][];                         // /proc/<pid>/uid_map, if the user ns is not the initial one
  sig?: { blocked: string[]; ignored: string[]; caught: string[] };  // SigBlk/SigIgn/SigCgt — the "PID 1 ignores SIGTERM" drill
}[];
cgroups?: {
  path: string; procs: number[]; threads?: number[];
  controllers: string[]; subtreeControl: string[];
  'memory.max': string; 'memory.high'?: string; 'memory.current': number; 'memory.events'?: Record<string, number>;
  'pids.max': string; 'pids.current': number;
  'cpu.max': string; 'cpu.stat'?: { usage_usec: number; nr_throttled: number; throttled_usec: number };
}[];
mounts?: {
  id: number; parent: number; target: string; type: string; source: string; options: string[];
  propagation: 'shared' | 'private' | 'slave' | 'unbindable'; peerGroup?: number;
  lower?: string[]; upper?: string; work?: string; ns: string;
}[];
files?: Record<string, {
  exists: boolean; type?: 'f' | 'd' | 'l' | 'c' | 'b' | 'p' | 's'; rdev?: string;   // whiteout: type 'c', rdev '0:0'
  mode?: string; uid?: number; gid?: number; size?: number; sha256?: string; text?: string;
  xattrs?: Record<string, string>;                                                  // security.capability, trusted.overlay.opaque
  caps?: string;                                                                    // getcap output in canonical form
}>;
net?: Record<string /* netns id, 'host' for the initial one */, {
  links: { name: string; ifindex: number; kind?: 'veth' | 'bridge' | 'vxlan' | 'wireguard' | 'dummy' | 'vlan';
           peerIfindex?: number; peerNs?: string; master?: string; mac: string; mtu: number; up: boolean }[];
  addrs: { link: string; cidr: string }[];
  routes: { dst: string; via?: string; dev: string; table?: string }[];
  neigh?: { ip: string; mac: string; dev: string; state: string }[];
  listen: { proto: 'tcp' | 'udp'; addr: string; port: number; pid?: number }[];
  iptables?: Record<string /* 'nat/PREROUTING' */, string[]>; nft?: string;
  conntrack?: { proto: string; src: string; dst: string; sport: number; dport: number; replySrc: string; replyDst: string }[];
}>;
containers?: {
  id: string; name: string; image: string; state: string; exitCode?: number; oomKilled?: boolean;
  pid?: number; user?: string; init?: boolean; stopSignal?: string; restartCount?: number;
  health?: 'starting' | 'healthy' | 'unhealthy'; logDriver?: string; logPath?: string;
  ports: string[]; mounts: { type: 'volume' | 'bind' | 'tmpfs'; source: string; target: string; rw: boolean }[];
  networks: string[]; env?: string[];                                                // env — names only, no values
}[];
```

Keep the `history` field, but state explicitly in the 2.4 validator rules: `history` is allowed only in `fail.if` (a hint), never in `when`.

### 6. MAJOR — Errors in the predicate language will produce false passes

**Where:** 2.3 "Predicate language", 2.4.

**What is wrong.**
1. `~` is defined as "substring", but it is applied to numeric arrays: `procs[...][nspid~1]` matches `nspid: [4126, 12]` and `[4126, 21]`; `cgroups[procs~@pid(stress-mem)]` with PID 41 matches a group that contains PID 4126. These are outright false passes in the "Build a container by hand" lab.
2. `units[nginx.service].active` is not parsed by the grammar: `[...]` is `filter := '[' field op value ']'`, and the dot is a path separator. Access by dictionary key (`units`, `http`, `files`, `net`) is not defined in the grammar.
3. Comparison of cgroup string values is not defined: `memory.max` can be `max`; `cpu.max` is `"50000 100000"`; it is not defined whether `20M` means 20·2²⁰ (as the kernel understands it) or 20·10⁶; in Kubernetes `20M` and `20Mi` differ.
4. `@start.pid(stress-mem)` in `keep` requires a snapshot of facts at the start of the attempt — the mechanism is not described.
5. The `@host.ns.pid` macro is ambiguous on a machine where the learner is already inside `unshare` (which process is the "host"?).

**Fix — replace the grammar and the rules:**

```
predicate := disj
disj      := conj ('||' conj)*
conj      := unary ('&&' unary)*
unary     := '!' unary | '(' predicate ')' | term
term      := path (op value)?                 -- without op: "at least one exists"
path      := segment ('.' segment)*
segment   := name key? filter* index?  |  '#'
key       := '{' string '}'                   -- dictionary access: units{'nginx.service'}, net{'host'}, files{'/etc/hosts'}
filter    := '[' field op value ']'
index     := '[' ('first' | 'last' | integer) ']'   -- nspid[last]
op        := '=' | '!=' | '<' | '<=' | '>' | '>=' | 'has' | '~' | '=~'
             -- has: the array contains the element (exact equality); ~: substring ONLY for strings, on a number/array it is a predicate compilation error
value     := number | size | duration | 'string' | bare-word | macro
size      := number ('K'|'M'|'G') | number ('Ki'|'Mi'|'Gi') | number ('k'|'m') -- K/M/G are binary, as in the kernel; Ki/Mi/Gi are the same, for Kubernetes manifests; the 'M' suffix in the k8s.* context is decimal, as in Kubernetes
```

Evaluator rules: the value `max` in `memory.max`, `pids.max` compares as +∞; `cpu.max` is parsed into `{quota, period}`, accessed as `cgroups[...].cpu.max.quota`; comparing a string with a number is a compilation error, not `false`. Macros: `@pid(name)` — the PID of the process found by `comm` in the agent's *initial* PID namespace; `@host` — the namespaces of process 1 of the initial PID namespace (that is, of the agent, not of the learner's shell); `@start` — a snapshot of the facts from the goal's `needs`, which the agent takes on `op: 'attempt.start'` and keeps until the end of the attempt.

Rewrite the examples in 2.3:

```
procs[cmd=bash][ns.pid!=@host.ns.pid].nspid[last]=1
cgroups[procs has @pid(stress-mem)].memory.max<=20M
units{'nginx.service'}.active=active && net{'host'}.listen[port=80]
```

The vectors in `shared/checker/vectors/` must contain exactly these traps: PID 41 versus 4126, `nspid [4126,12]`, `memory.max=max`.

### 7. MAJOR — A fact collector in POSIX sh + `jq` in v86 will not fit into 0.3–1 s and 2 Hz, and polling will miss short-lived processes

**Where:** 1.4 "Service channel", 2.1, 2.5, 7 (phase 0, item 2).

**What is wrong.** v86 delivers on the order of 1–2% of native speed on heavy code, and the most expensive emulated operation is `fork`+`exec`. A script that every 500 ms walks `/proc/*/ns/*` (8 links × 30–40 processes) and `/sys/fs/cgroup` and calls `ip -j`, `ss`, `jq` spawns hundreds of processes per pass. This will take more than a second of machine time, and the learner's terminal will lag noticeably. Worse, polling misses processes that live less than 500 ms — and that is exactly what the "fork/exec/PATH" explainer (R3, Linux) and the "the container exits immediately" drill need. Finally, in `lab-alpine` the shell is BusyBox ash, which has no `PROMPT_COMMAND`, on which 02 builds the `cmd.done` event, and tier B's automatic checks (2.5) depend on `cmd.done`.

**Fix.**
- The fact collector is a single Go package `shared/facts` (Go is already there for `trainer-check`) with `linux/386` binaries (for v86, about 3–4 MB, over 9p) and `linux/amd64|arm64` (VMs). It reads `/proc` and `/sys` itself, in one process, without `jq` and without spawning processes; netlink via `vishvananda/netlink`. This is exactly "one collector for B and C", just without 200 `fork`s per pass. Keep `facts.sh` as a readable reference implementation and for checking on learners' machines where a binary cannot be run (see finding 13).
- `watch` mode is event-driven, not polling: the proc connector (`CONFIG_CONNECTOR`, `CONFIG_PROC_EVENTS`, netlink `NETLINK_CONNECTOR`) delivers `fork`/`exec`/`exit` with PID and PPID at the moment of the event — hence accurate `proc.spawn`/`proc.exit` for the "fork → exec" explainer on the real kernel; inotify on `memory.events` in cgroup v2 (the kernel sends a file-change notification) gives `proc.exit{reason:'oom'}` without polling; netlink `RTNLGRP_LINK`/`RTNLGRP_IPV4_IFADDR` gives interface events. Polling remains only for `cgroup.usage` (1 Hz).
- In `lab-alpine`, install `bash` and run the learner's shell as `bash` with `PROMPT_COMMAND` from 02, or use `PS1` with command substitution (BusyBox ash can do this with `ASH_EXPAND_PRMT`) — choose one and write it down.
- Rewrite the phase 0 budget: "full collection of `procs,ns,cgroups,mounts,net` facts on 40 processes ≤ 300 ms of machine time; `watch` at idle ≤ 3% of guest CPU; not a single missed `exec` on a script of 50 consecutive `/bin/true`".
- Return large responses (facts of tens of KB) not byte by byte over the UART (`serial1-output-byte` is one bus event per byte) but as a file on 9p (`/run/trainer/out/<id>.json`, read via the 9p API from JS) or via virtio-console; only a short line `{"id":7,"ok":true,"file":"out/7.json"}` goes over `ttyS1`.

### 8. MAJOR — The `dt-kernel` configuration is incomplete for the 04 labs and for R6–R11

**Where:** 1.4 "One engine, one kernel, two root filesystems".

**What is wrong.** The option list is the union of the 02 and 04 fragments, but it lacks things without which my own labs and the new requirements do not work:
- `CONFIG_TMPFS_XATTR` — the guest root is on 9p, so the overlay upper layer and `pivot_root` in 04 live in the tmpfs `/c`. Without xattrs on tmpfs, overlay cannot set `trusted.overlay.opaque` (opaque whiteout is step 2 and 3 of the interactive), and `setcap` from R6 cannot write `security.capability`. xattr support in the v86 9p server is not guaranteed, so `setcap`/`getcap` in lessons run only on tmpfs, and this has to be written down.
- `CONFIG_CGROUP_BPF` and `CONFIG_BPF_SYSCALL` — in cgroup v2, the devices controller is implemented by an eBPF program; without them, `crun` will not apply `linux.resources.devices` (at best a warning, at worst an error on a `config.json` with device rules).
- `CONFIG_IKCONFIG` — `IKCONFIG_PROC` depends on it (04 lists both, 09 only the second).
- For Docker-like NAT and kube-proxy-lite (R9, hybrid): `BRIDGE_NETFILTER`, `NF_CONNTRACK`, `NETFILTER_XT_MATCH_CONNTRACK`, `NETFILTER_XT_MATCH_COMMENT`, `NETFILTER_XT_MATCH_STATISTIC`, `NETFILTER_XT_MATCH_MULTIPORT`, `NETFILTER_XT_MARK`, `NETFILTER_XT_TARGET_MASQUERADE`, `NETFILTER_XT_MATCH_ADDRTYPE`, `IP_NF_FILTER`, `IP_NF_NAT`; for the iptables-nft backend — `NFT_COMPAT`, `NFT_NAT`, `NFT_MASQ`, `NFT_CT`; `IP_VS` with `IP_VS_RR` (IPVS mode); `DUMMY` (`kube-ipvs0`, the cluster DNS address).
- For R8/R11 between nodes: `VLAN_8021Q`, `VXLAN`, `GENEVE`, `WIREGUARD`, `PACKET` (tcpdump), `TUN`.
- For `watch` (finding 7): `CONNECTOR`, `PROC_EVENTS`; for the memory pressure lesson — `PSI`.
- For background nodes: `NO_HZ_IDLE`, `HZ_100` — otherwise 4 idle nodes wake the emulator 250–1000 times per second each.
- The `iptables` backend is not fixed: "`NF_TABLES` and iptables-legacy" does not say which `iptables` the learner invokes. One decision is needed — I propose `iptables-nft` by default (as on Debian 12 and current distributions; `iptables -V` prints `(nf_tables)`) and `iptables-legacy` only in the lesson where they are compared.

**Fix — replace the list in 1.4 with a reference to the file and give the full fragment:**

```
# images/kernel/dt-kernel.fragment — on top of main/linux-lts/virt.x86.config
CONFIG_IKCONFIG=y
CONFIG_IKCONFIG_PROC=y
# isolation and limits (R6)
CONFIG_NAMESPACES=y
CONFIG_UTS_NS=y
CONFIG_IPC_NS=y
CONFIG_PID_NS=y
CONFIG_NET_NS=y
CONFIG_USER_NS=y
CONFIG_CGROUPS=y
CONFIG_MEMCG=y
CONFIG_CGROUP_PIDS=y
CONFIG_CGROUP_SCHED=y
CONFIG_FAIR_GROUP_SCHED=y
CONFIG_CFS_BANDWIDTH=y
CONFIG_CGROUP_FREEZER=y
CONFIG_CGROUP_BPF=y
CONFIG_BPF_SYSCALL=y
CONFIG_PSI=y
CONFIG_SECCOMP=y
CONFIG_SECCOMP_FILTER=y
CONFIG_OVERLAY_FS=y
CONFIG_TMPFS=y
CONFIG_TMPFS_XATTR=y
CONFIG_TMPFS_POSIX_ACL=y
CONFIG_CONNECTOR=y
CONFIG_PROC_EVENTS=y
# container and node networking
CONFIG_VETH=y
CONFIG_BRIDGE=y
CONFIG_BRIDGE_NETFILTER=y
CONFIG_VLAN_8021Q=y
CONFIG_VXLAN=y
CONFIG_GENEVE=y
CONFIG_WIREGUARD=y
CONFIG_DUMMY=y
CONFIG_TUN=y
CONFIG_PACKET=y
CONFIG_NETFILTER=y
CONFIG_NF_CONNTRACK=y
CONFIG_NF_NAT=y
CONFIG_NF_TABLES=y
CONFIG_NF_TABLES_INET=y
CONFIG_NFT_NAT=y
CONFIG_NFT_MASQ=y
CONFIG_NFT_CT=y
CONFIG_NFT_COMPAT=y
CONFIG_IP_NF_IPTABLES=y
CONFIG_IP_NF_FILTER=y
CONFIG_IP_NF_NAT=y
CONFIG_IP_NF_TARGET_MASQUERADE=y
CONFIG_NETFILTER_XT_MATCH_ADDRTYPE=y
CONFIG_NETFILTER_XT_MATCH_CONNTRACK=y
CONFIG_NETFILTER_XT_MATCH_COMMENT=y
CONFIG_NETFILTER_XT_MATCH_STATISTIC=y
CONFIG_NETFILTER_XT_MATCH_MULTIPORT=y
CONFIG_NETFILTER_XT_MARK=y
CONFIG_IP_VS=y
CONFIG_IP_VS_RR=y
CONFIG_IP_VS_NFCT=y
# v86
CONFIG_NET_9P=y
CONFIG_NET_9P_VIRTIO=y
CONFIG_9P_FS=y
CONFIG_VIRTIO_PCI=y
CONFIG_VIRTIO_NET=y
CONFIG_VIRTIO_CONSOLE=y
CONFIG_NO_HZ_IDLE=y
CONFIG_HZ_100=y
# systemd (02)
CONFIG_DEVTMPFS=y
CONFIG_AUTOFS_FS=y
CONFIG_FHANDLE=y
CONFIG_INOTIFY_USER=y
```

Add an image acceptance test to CI: `zcat /proc/config.gz` is compared against the fragment; then a script tries each capability — `unshare -Urpf --mount-proc true`, creating a group with `memory.max`/`cpu.max`/`pids.max`, an overlay with an opaque directory on tmpfs, `setcap cap_net_bind_service+ep` on tmpfs, `crun run` with a device rule, `ip link add type vxlan|wireguard|veth|dummy`, `iptables -t nat -A … -m statistic`, `ipvsadm -A`. A failure of any item means a red build.

### 9. MAJOR — Serial ports are not allocated: the second "host/container" terminal from 04 and `kubectl exec` (R7)

**Where:** 1.4 "Service channel", 1.5 "Machine interface".

**What is wrong.** In 04, 6.3, the "Build a container by hand" lab shows two terminals at once: "inside the container" (`ttyS0`) and "host" (`ttyS2`). R7(c) requires comparing `uname`/`ps` inside and outside the container, and the hybrid (finding 2) needs a separate terminal for `kubectl exec`. 09 has only `ttyS0` (learner) and `ttyS1` (agent); `Machine.tty(name?)` accepts a name, but which names exist is not stated. v86 provides `uart1`, `uart2`, `uart3` (the options are visible in `starter.js`), so there is room.

**Fix — add a table to 1.4:**

> | Port | Purpose | What runs on it |
> |---|---|---|
> | `ttyS0` | the learner's main terminal | `agetty --autologin` |
> | `ttyS1` | service channel (JSON) | `trainer-agent` / `dt-kubelet` |
> | `ttyS2` | second terminal: "host" in container labs, `kubectl exec -it` in the hybrid | `agetty` when the lesson requires it, otherwise off |
> | `ttyS3` | reserve (`kubectl logs -f`, a second `exec`) | — |
>
> `Machine.tty('main' | 'host' | 'exec:<id>')`; the engine shows the second terminal next to the first with a label saying *where* the shell is ("host", "inside the box container", "pod web-5f7, container app"). The label is derived from the facts: the namespaces of the shell process are compared with the namespaces of the machine's PID 1.

### 10. MAJOR — The R7(c) "VM versus container" practice contradicts the rule "a machine is never booted from scratch"; there is no storyboard for the explainer

**Where:** 1.4 "Boot"; relation to 04, 4.6 and D1.

**What is wrong.** R7(c) requires measuring a container start against booting a second v86 VM and showing that the browser Linux is itself a VM (`dmesg`). 09 has the rule "a machine is never booted from scratch on the learner's side", and the memory budgets are calculated for one machine. An explicit exception is needed, otherwise the comparison will be "a container in 0.2 s versus a snapshot restore in 2 s" — that is, a wrong one.

**Fix.** In 1.4, after "Boot", add:

> **Exception: the "Boot a second machine" lab.** The only place where a machine is booted from scratch on the learner's side: the `lab-tiny` image (our kernel + an initramfs with BusyBox, ≤ 6 MB, 64 MB guest, no 9p) is started in a second worker with a cold boot from the BIOS. In the second machine's terminal the learner sees the kernel messages from the very first line, and a timer; in parallel, in the first machine they run `time crun run box` and `time unshare -fp --mount-proc sleep 0`. Budget: a cold boot of `lab-tiny` ≤ 20 s on a 2020 laptop; the second worker is released immediately after the measurement. Facts: `env.boot = { kind: 'cold' | 'restored', ms }` — so that the diagram labels it "a real boot" and not "a restore from a snapshot".
>
> **"I am a virtual machine".** Steps: `dmesg | head -40` (SeaBIOS BIOS, emulated devices), `cat /proc/cpuinfo` (the CPU model the emulator reports), `ls /sys/bus/virtio/devices`, `uname -m` (`i686`, not the architecture of the learner's laptop); then, in the same machine, `crun run box uname -r` — the same kernel. The exact strings the check looks for are pinned from the golden boot of `dt-kernel` in CI, not from the author's memory.

Storyboard of the explainer "Bare metal → VM → containers → nesting" (for 08 and block 04; the platform only needs the model and the events, so I give it here — the model lives in `sim.worker.ts` as a pure function `stackModel(params) → {towers, counters, events}`):

> **Screen 1. One machine, one application.** On the left, a tower of blocks from bottom to top: "Hardware (CPU, memory, disk, network)" → "Linux kernel" → "Libraries" → "Application A". Counters on the right: "CPU load 8%", "Memory used 1.2 of 64 GB", "Application start time: server boot 90 s". The "Number of applications" slider = 1. Clicking any block opens a card "what this is and who chooses it".
>
> **Screen 2. Crowded.** The "Number of applications" slider goes to 3: A, B, C appear on one tower; the "Libraries" block turns red, the line between B and "Libraries" is labeled "needs Python 3.9", and between C and "Libraries" — "needs 3.13". Counter "Version conflicts: 1". One idea: a shared system means shared dependencies.
>
> **Screen 3. Two towers side by side.** On the left — "VM": Hardware → Hypervisor → [VM1: Guest kernel → Libraries → A] [VM2: Guest kernel → Libraries → B]. On the right — "Containers": Hardware → Host kernel → [Container 1: Libraries → A] [Container 2: Libraries → B]. "Guest kernel" blocks exist only on the left — they are highlighted in the kernel color, as throughout the course. The "Number of applications" slider (1–20) moves both towers at once. Counters under each: "Memory for overhead" (VM: n × 512 MB of guest OS; containers: n × ~5 MB of runtime), "Application start" (VM: guest boot ~20–60 s; container: < 1 s), "Density on a 64 GB server". The numbers come from a model with parameters in YAML and a source reference for each parameter; next to each counter is a line explaining *why* it changed ("+1 guest kernel = +512 MB").
>
> **Screen 4. The "Kernel vulnerability" toggle.** Turning it on draws a crack on the kernel block. On the left, the crack is in "VM1 guest kernel" — only VM1 is highlighted in red, the label on the line to the hypervisor reads "VM boundary: the hypervisor". On the right, the crack is in "Host kernel" — *all* containers are highlighted, label "container boundary: the same kernel". Counter "Applications affected: 1 of n / n of n". One idea: VM isolation is stronger because the kernel is not shared.
>
> **Screen 5. "Break it".** The "Remove the hypervisor" button — the left tower crumbles down to "Hardware", label "there is nothing to run the guest kernels". The "Remove the host kernel" button on the right — all containers crumble, label "a container does not bring its own kernel".
>
> **Screen 6. How it is today.** Three towers, switched by tabs: "Containers in cloud VMs" (Hardware → Cloud hypervisor → Guest kernel → containerd → containers), "Kubernetes on bare metal" (Hardware → Kernel → kubelet + containerd → pods), "VMs inside Kubernetes" (Hardware → Kernel → kubelet → virt-launcher pod → QEMU/KVM → Guest kernel → application; label "KubeVirt, this is how VMs work in Cozystack"). The "Number of applications" slider and the vulnerability toggle work on all three; the counters are recomputed, and each tab answers *which boundary* protects in case of a kernel vulnerability.
>
> **Screen 7. And now for real.** The "Check on this machine" button opens the lab above: `dmesg` in v86, `uname -r` outside and inside the container, a cold boot of the second machine versus `crun run`. The learner's measured numbers are substituted into the screen 3 counters next to the model ones.
>
> Animation is limited to blocks appearing and disappearing, counters growing and highlighting; the stepper with steps 1–7 can be paged forward and backward.

### 11. MAJOR — There is no "changed a parameter — the process is recomputed" mechanism for explainers (R4); it is not defined which engine computes which explainer (R3)

**Where:** 1.3 "Tier A" (the `ToSim` protocol), 1.4 (`watch`).

**What is wrong.** R4 requires sliders and toggles (replicas, memory limit, TTL, TCP window) to immediately recompute the process and show an explanation of the change, with steps that can be paged backward. The 08 stepper folds bus events, but who produces a *new* event stream for a different parameter is not defined. A live v86 session cannot do this at all: a real kernel cannot be "rewound" with a different `memory.max`. The `ToSim` protocol has no operation "run a scenario with parameters without touching the current lesson state".

**Fix.** Add to the 1.3 protocol:

```ts
| { op: 'whatif'; req: number; scenario: string; params: Record<string, number | string | boolean>;
    from?: 'start' | 'current'; until?: { event?: string; maxSimMs?: number } }
// response
| { op: 'whatif'; req: number; events: SimEvent[]; diff?: { param: string; from: unknown; to: unknown; why: Bi }[] }
```

`whatif` clones the simulator state (or takes the scenario's initial state), substitutes the parameters, runs deterministically until the condition and returns the events; the live lesson state does not change. The `diff.why` field is taken from the scenario's explanation table (`explain_param:` in YAML: "memory.max 64M → 16M: the process allocates 32 MB, the kernel kills it — oom_kill event"). The rule in 1.3: **explainers with parameters are always computed on tier A; v86 is "check on a real kernel" after the explainer, not its engine.**

And add to 1.3 a "who computes the explainer" table for the R3 processes that concern the runtime (authors will add the remaining blocks):

> | Explainer (R3) | Model (parameters, "break it") | Real kernel (confirmation) |
> |---|---|---|
> | Linux boot | `bootsim` in the Bench: BIOS → bootloader → kernel → initramfs → PID 1 → units; "break it": no `init`, broken `fstab` | cold boot of `lab-tiny`, `dmesg`, `systemd-analyze` in `lab-debian` |
> | fork/exec/PATH | Bench: process tree; `PATH` parameter, "break it": remove a directory from `PATH`, clear the `x` bit | proc connector in v86 (finding 7) — real PIDs, PPIDs and `exec` |
> | Pipe | Bench: pipe buffer, buffer size parameter, slow reader | `strace -f -e trace=pipe2,read,write` in v86 |
> | systemd restarts a crashed service | Bench: unit, `Restart=`, `RestartSec=`, `StartLimitBurst=`; "break it": `Restart=no` | `lab-debian`, `kill -9` of the main PID and `systemctl show -p NRestarts` |
> | OOM kill in a cgroup | dsim/Bench: `memory.max` sliders, allocation size | `lab-alpine`, `memory.events: oom_kill` (inotify) |
> | `docker run` CLI → process | dsim "Rashomon" (04, 8): CLI → dockerd → containerd → shim → runc → kernel; "break it": stop containerd, no image | `crun run` in v86 + `watch` (namespace/cgroup/mount events) |
> | `docker build` layer by layer with cache | dsim `build.ts`; toggle "change file N", "reorder COPY" | — (the build is model-only; on the D11 VM — real BuildKit) |
> | `docker pull` by manifest | course registry in the SW: token → index → manifest → blobs; "platform" parameter, "break it": delete a blob | `curl` to the same registry from v86 |
> | `kubectl apply` through all components | kube-lite | hybrid: real processes appear on the nodes |
> | Pod scheduling, rolling update | kube-lite: `replicas`, `maxSurge`, `maxUnavailable` sliders, node resources | hybrid |
> | Node failure | kube-lite: `node-monitor-grace-period`, `tolerationSeconds` | hybrid: stopping the node worker |
> | Request through Service/Ingress/kube-proxy | kube-lite + netlab; iptables/IPVS/eBPF toggle | hybrid: real `iptables-save`, `pkts` counters |
> | Reconcile loop | kube-lite: desired state on the left, actual on the right, the controller in the middle | hybrid + controller sandbox (05, K14) |

### 12. MAJOR — Kubernetes stage 3 (R12): Terraform/Ansible for ordering VMs, cost display and mandatory cleanup are not designed

**Where:** 5.1–5.3, 5.6.

**What is wrong.**
- R12: at stage 3, VMs are ordered with Terraform and configured with Ansible. In 5.3, VMs are created with a button, and the learner cannot order them with code. A learner without a cloud account has nothing to apply Terraform to at stage 3 at all.
- R12: the trainer shows the VM cost and walks the learner through a mandatory cleanup step. 5.2 has a price table, but no counter "how much this set costs right now" and no cleanup step with a check. For external clouds, a forgotten VM is the learner's real money.
- Nested networking: Kubernetes with Cilium (VXLAN/Geneve) inside VMs, which themselves sit in the provider's overlay private network, means double encapsulation. If the MTU is not aligned, the learner's cluster will come up, but large responses will be lost, and the learner will look for the fault in their own cluster while it lies in the provider's network.
- Stage 2 (a single node on one's own machine or on one VPS: k3s/minikube/kind) is mentioned only in the "Own machine" row; it does not say that the check there runs without a server, nor what to do about ARM (Oracle Always Free, a Mac with Apple Silicon) — the course images must be multi-arch.

**Fix — add 5.7 and correct 5.3:**

> **5.3, addendum. Ordering VMs with code.** At stage 3, the learner orders VMs themselves, in their own cloud account: `terraform apply` with the course modules for Yandex Cloud, Selectel, Hetzner and AWS from `infra/learner-modules/`, then `ansible-playbook` with an inventory from `terraform output`. The modules are checked in CI with `terraform validate` and once a week with a real `apply/destroy` in the course's test account. A learner without a cloud account brings up three local VMs on their own computer (Multipass or Vagrant) and practises ordering infrastructure with code on the in-tab cloud (00 §6.13).
>
> **5.3, addendum. MTU.** The stage 3 VM image and the R3 track instructions set the MTU of the inner CNI with headroom for two encapsulations; the value is determined in phase 0 by measurement (`ping -M do -s <size>` between VMs of the main providers and between local VMs) and recorded in `providers.yaml` next to the prices. The R3 track has a "check the MTU" step with an explanation of why it is needed in any cloud.
>
> **5.7. Cost and cleanup.**
> 1. *Cost counter.* After the agent's first check, the trainer knows when the nodes were created (`creationTimestamp` of the Node objects, `providerID`) and the VM type (`node.kubernetes.io/instance-type` if present, otherwise the learner's choice). Above the track checklist — a line "Your set has been running for 2 h 14 min, that is about 46 ₽ (Selectel, 3 × 2 vCPU / 4 GB, price as of 18.11.2026)"; prices from `providers.yaml`. Local VMs have no counter: they cost nothing.
> 2. *The cleanup step is mandatory.* The last item of every stage 3 track is "Delete the machines". The track is not marked as completed until the cleanup is confirmed. Confirmation without a server: the learner runs `terraform state list` and `terraform show -json` in the track directory and the provider CLI (`yc compute instance list --format json`, `hcloud server list -o json`, `aws ec2 describe-instances --filters Name=tag:dt-track,Values=r3 --output json`) and pastes the output; the check is an empty list of resources with the tag `dt-track=<track>` and an empty state. A reminder about unconfirmed cleanup is shown every time the course is opened, until the learner confirms it or explicitly marks "I am keeping the machines on purpose".
> 3. *Tags.* All course Terraform modules set the label `dt-track=<track>` and `dt-owner=<device id>` — both the cleanup check and the hint "here is what you still have running" rely on them.
>
> **Stage 2.** A single node (k3s, minikube or kind) on one's own machine or one VPS is checked without a server (the 5.4 "serverless" mode). The training application images are published as multi-arch (`linux/amd64`, `linux/arm64`), and the agent and the collector are built for both architectures.

### 13. MAJOR — Discrepancy with 05 on the verifier and golden recordings

**Where:** 5.4 "The `trainer-check` agent", 1.3 "Truthfulness rule".

**What is wrong.**
- 05, 10.4: the verifier is a readable `trainer-check.sh`, run as `bash trainer-check.sh r2`, "not `curl | bash`, so that the learner first reads what they are running (this is also a security lesson)"; the script only reads. 09, 5.4: an opaque 6 MB Go binary, installed with `curl … && sudo install`, a service running as root, executing signed probes and *injecting breakages*. These are different products with different trust models, and 09 does not say that the 05 decision is being revised or why.
- 05: golden recordings on `kind` in GitHub Actions on every PR and kubeadm on a VM once a day; 09: "heavy runs only on a separate course test bench". 09: kubeadm v1.36 in the golden recordings; 05: OpenAPI schemas v1.37 in kube-lite and R3 on v1.36 → R4 on v1.37.

**Fix.** Add to 5.4:

> **Modes and trust (clarifying decision 05, 10.4).** Self-checking on one's own machines stays as in 05: the readable script `trainer-check.sh` (read-only, text on screen, run as `bash trainer-check.sh r2`). The Go agent is needed only where the result is presented to someone or where the trainer itself injects a breakage: certified exams. The agent is open (sources in the course's public repository), built reproducibly, and the command `trainer-check plan --track e` prints which probes and breakages it will apply, with their source text, before running.

In 1.3: "Kubernetes golden recordings: on every PR — `kind` (as in 05, this is not a heavy load), once a day — kubeadm on a VM in the course's test cloud account. Versions: kube-lite and kind — v1.37; kubeadm — v1.36 and v1.37 (for R4)".

### 14. MAJOR — Discrepancy with 01 on the mentor's behavior and the context format

**Where:** 4.5 "Mentor prompt", 2.4 (`hintLevel`), 4.7.

**What is wrong.**
- 01, 14.2: the hint ladder H1–H5, "there is no ready-made solution at any step". 09: `hintLevel: 0 | 1 | 2 | 3`, "3 — the answer is revealed (reveals: true)", and in `lab` mode the AI model may give the solution command after `n−1` hints. This directly contradicts the andragogy author's decision.
- 01: up to 120 words; 09: up to 150 words for beginner.
- 01, 14.1: modes lesson / practice / free sandbox / exit ticket, entry check, exam / review. 09: `learn`/`lab`/`explain-output`/`review`/`exam` — there is no free sandbox, and no exit ticket in the list of "AI model disabled" modes.
- 01, 14.4: the context is JSON with `known_concepts: ["F01", "L17"]` (graph identifiers); 09: text layers with the words "process, pid, namespace, pid-namespace". The model must receive identifiers and word forms from `concepts.yaml`, otherwise there is nothing to check the "do not use concepts not yet introduced" filter against in `ai-evals`.
- 10, section 2: `explain` answers in the exam are graded by the learner's AI model using a rubric. 09, 4.5: in `exam` mode, `ai.worker.ts` rejects all requests. A separate grader mode after submission is needed.

**Fix.**
- `hintLevel: 0 | 1 | 2 | 3 | 4 | 5` according to H1–H5 from 01; remove the `reveals` field from 2.4; replace the `lab` mode row with: "Follow the H1–H5 ladder from 01, 14.2, one step per request; do not give a ready solution command at any step. The engine compares the answer with `solution_flags` and the goal's reference command (they are not passed into the context) and collapses a match".
- Word limit — 120, as in 01.
- Add the modes `sandbox` (free sandbox: "explain and suggest what to try") and `forcing` (finding 3); add "exit ticket" to the `exam` row.
- Add a `grade` mode: it is enabled only after `exam.submitted`, receives the learner's answer and the rubric from 10, and returns JSON with scores and quotes; it does not accept learner questions in this mode.
- Build hint layer 2 from `concepts.yaml`: `Уже введены: L17 «процесс» (процесс, процесса, process), D03 «пространство имён» (…)` (Russian example: "Already introduced: L17 "process" (word forms), D03 "namespace" (…)"); this way `ai-evals` checks violations with the same regular expressions as the build.

---

## Minor

### 15. MINOR — Environment names do not match

**Where:** 1.5 and 2.2. `Machine.kind: 'sim' | 'v86' | 'remote'`, while `Facts.env.kind` and `CheckResult.env` are `'sim' | 'v86' | 'vm'`; in `goals[].envs` — `[v86, vm]`. Choose one (`vm`) everywhere.

### 16. MINOR — Outdated server dependencies

**Where:** 6.1. `nhooyr.io/websocket` was handed over to Coder and is developed as `github.com/coder/websocket`. Go 1.25 no longer receives security fixes after the release of Go 1.27 (August 2026) (the two latest releases are supported) — specify Go 1.27.

### 17. MINOR — Inconsistency with 02 on the agent and the kernel

**Where:** 1.4. In 02, the agent is called `trainerd`, it is a bash script under systemd (`trainer-agent.service`), and the `lab-debian` package list includes `linux-image-686`. In 09 — a POSIX sh `trainer-agent` over 9p and the shared `dt-kernel` kernel. Write in 1.4: "The 02 decision on the `linux-image-686` package and the `trainerd` name is replaced: the kernel is `dt-kernel`, the agent is `trainer-agent` (after finding 7 — the Go binary `dt-facts` + a wrapper)". The same for 04: `nsview` and `/opt/checks/*.sh` with the `failed` field (04, 6.5 and 11.3) move to the 2.4 `goals` — I will convert the 11.3 lab step format to `when`/`fail` in the next version of 04.

### 18. MINOR — The v86 network card defaults to `ne2k`

**Where:** 1.4, 1.6. In `starter.js`, `net_device` defaults to `{ type: "ne2k" }`. Write down `net_device: { type: "virtio" }` explicitly for all images (the kernel with `VIRTIO_NET` is already being built), otherwise the network between machines will be slower than necessary.

### 19. MINOR — Guest clock after a snapshot restore

**Where:** 1.4 "Boot". After `restore_state`, the guest clock shows the moment the snapshot was taken in CI. This breaks TLS lessons (certificate "not yet valid" or "expired"), `journalctl --since`, DHCP lease times, and in the hybrid — the node lease. Add: the agent on `ttyS1` receives `{"op":"time","epoch":…}` immediately after the restore and runs `date -s @…`; in the facts — `env.clockSkewMs`.

### 20. MINOR — Image packages for R6/R7

**Where:** 1.4, image table. For the section "How the kernel isolates and limits" (R6) and the "six boundaries" (R7), add to `lab-alpine`: `bash` (finding 7), `tini` (the "PID 1 does not forward signals, zombies" drill), `stress-ng` or our own `memhog` (OOM drill), `procps` (`ps -eLf`, `ps -o pid,tid,stat`), `util-linux-misc` (`lsns`, `nsenter`), `libcap` (`capsh`, `getcap`, `setcap`), `tcpdump`. In `lab-debian`, for L16 and the new Linux section: `libcap2-bin`, `stress-ng`; `util-linux` is already there. All packages are available for `x86`/`i386` — verify in CI by building the image.

### 21. MINOR — `navigator.deviceMemory` is not available in all browsers

**Where:** 1.4 "Devices". `navigator.deviceMemory` is implemented only in Chromium; in Firefox and Safari it is `undefined`, and in Chromium the value is rounded and capped at 8. The rule `< 4` with `undefined` yields `false` — the machine will start anywhere. Write down: "if `deviceMemory` is undefined, v86 is not started automatically but offered via a button showing the download size and memory; multi-node labs — only via the button".

### 22. MINOR — v86 in a worker

**Where:** 1.4 "Devices". v86 does support running in a worker (`starter.js` exports `V86` into `self` via the `importScripts` branch), but it is a classic worker, not a module worker; document 08 and Vite build module workers by default. Write in 6.1: "`v86.worker.ts` is built as a classic worker (`worker.format: 'iife'`) or loads `libv86.mjs` if it appears in the vendored version; verified in phase 0".

### 23. MINOR — Internal terms in the UI

**Where:** 1.7 and 2.4. The trainer string "where the command is available for real (tier B or C)" and similar ones must not show the learner "tier A/B/C" — that is an architecture term. For the learner: "in the simulator", "on real Linux in the browser", "on real machines".

### 24. MINOR — The terminal as part of the visual design (R5)

**Where:** 1.3, 6.1. R5 requires "a beautiful terminal". The platform should pin down: our own monospace font hosted on our domain (otherwise CSP `font-src 'self'` will not let it through), an xterm theme from the 08 palette tokens (ANSI colors aligned with the meaning colors: kernel/user space), `fontLigatures` disabled (in output, `->` and `!=` must read literally), rendering via the xterm WebGL addon with a fallback to DOM. This is one row in table 6.1, and it rules out discrepancies between blocks.

---

## Pedagogy and levels — in brief

- Beginner: tier A must cover the whole path of a block without v86, and v86 must be the "proof" after the explainer (finding 11). In 09 this is right in spirit, but the MVP readiness criterion ("the Linux and 'Inside a container' blocks can be completed offline") should be extended: "on a phone and when v86 is declined, the lesson can be completed to the end in recorded mode; only goals with `envs: [v86]` are not completed, and they are marked 'do this on a computer'".
- Intermediate: the main value is "recognizing the familiar on a real kernel" (the DNAT of your own `-p`, your own kube-proxy chains). Only the hybrid provides this (finding 2); without it, the intermediate level sees the same model as the beginner.
- Experienced: starts at step 3 of the documentation ladder (R2) — 09 must give them the corpus and the `forcing` mode (finding 3) from day one, otherwise the "experienced route" in practice differs from the intermediate one only in speed.
