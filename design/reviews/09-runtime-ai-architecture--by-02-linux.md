# Review of 09-runtime-ai-architecture.md "Platform architecture" (reviewer: role 02, Linux)

Reviewer: a senior Linux engineer, the author of 02-linux.md. Date: 18.11.2026. Document 09 was not modified.

## Verdict

The document is strong where it consolidates the decisions of the first wave: three tiers, one `dt-kernel` kernel and two roots, the "facts → predicates" contract, local-first storage, the "bring your own key" model for the neural network and signed results on tier C. For the first wave it is almost ready. It does not yet match the owner's mandatory requirements R1–R12, and in several places the platform as described technically cannot meet them. There are four main problems. (1) There is neither a multi-machine network on our own virtual switch nor a hybrid Kubernetes (R11, R9, R10): neither in the architecture, nor in the work plan, nor in the memory budgets. (2) The 9p root in v86 does not support extended attributes (xattr). This is visible in the v86 sources, `lib/9p.js`: `Setxattr not supported`, `EOPNOTSUPP`. This means that `setcap`/`getcap`, `security.capability` and overlayfs with upper on 9p do not work on the root, and without that the module "How the kernel isolates and limits" (R6) and some of the container labs (R7) cannot be built. (3) The page CSP forbids executing learner code, and the final step of R10 ("write a small controller in the browser") is impossible without it. (4) The documentation ladder (R2) and the environment for step-by-step explainers (R3/R4) require specific components from the platform: an offline corpus of man pages, a documentation viewer, "where they looked" events, the `forcing` mentor mode, deterministic recomputation of a process when a parameter changes. None of this is in the document. On top of that, there are factual errors in the v86 network part: mixed content in the Worker, no UDP in Wisp, DNS through a third-party DoH. There are defects in the predicate language (keys with dots, `M`/`Mi` units) and contradictions with 05/06/10 regarding the `trainer-check` agent. Below are 30 findings: 4 blocking, 16 major, 10 minor. Almost every one comes with ready text to paste.

Severity: **BLOCKING** — without a fix, an owner requirement cannot be met or the platform will not work as described; **MAJOR** — an error or gap that will surface during development or for the learner; **MINOR** — accuracy, consistency, editing.

---

## Findings

### 1. BLOCKING — no multi-machine network on our own switch and no hybrid Kubernetes (R11, R9, R10)

**Where:** 0 "Decisions in brief" (the rows "Tier B network", "Docker and kubectl"), 1.4, 1.6, 1.7, 7, 8.

**What is wrong.** In 1.6 the multi-machine network is built on the v86 `inbrowser` backend (BroadcastChannel). It transfers Ethernet frames, but provides neither a place where they can be seen and visualized, nor link control (latency, loss, VLAN), nor a mirror port for `tcpdump` "on the switch". R11 explicitly requires *our own* JS switch that is shown to the learner. The budget in 1.4 is calculated for one machine with 256 MB and "two with 192 MB", while R11 requires 3–4 nodes with 64–128 MB each on a laptop and 1 node on a phone. In 1.7 and in the decision table kubectl is fully simulated, while R11 requires a hybrid: the control plane runs in kube-lite, each v86 node runs a small real "kubelet", pods are real `crun` processes in real namespaces, `kubectl exec` opens a real container, and when a node dies the pods are recreated on other nodes. Without this, neither the R9 learning tasks on a real kernel ("find in iptables where a packet to a ClusterIP goes", pod-to-pod via veth/bridge and VXLAN) nor the R10 link "an operator is the same loop" on live processes can be done.

**This is technically feasible.** In v86 the network adapter connects to the event bus: the emulator emits a frame with the `net0-send` event and receives a frame via `bus.send("net0-receive", frame)`. This is visible in `src/browser/fetch_network.js` (lines 61–63 and 395). So our own adapter that forwards frames through a `MessagePort` to the switch can be written without forking v86.

**Ready text — new section 1.8 "Several machines and our own switch":**

> **1.8. Several machines in one tab and the `dt-switch` switch**
>
> Each v86 machine runs in its own Worker (`v86.worker.ts`, one emulator instance per worker). The machine's network adapter is our `SwitchPortAdapter`: it subscribes to the emulator's `net0-send` and forwards the frame to the `MessagePort` of the switch port; incoming frames are passed to the emulator via `net0-receive`. The `inbrowser` backend is no longer used.
>
> The `dt-switch` switch is a separate Worker (`switch.worker.ts`, ~15 KB gzip). It implements real L2:
> - a MAC → port table with learning and aging (300 s, a slider for the explainer), flooding of unknown unicast and broadcast frames to all ports;
> - 802.1Q VLAN: a port can be access (`vlan=10`) or trunk; the tag is really added and removed, so `ip link add link eth0 name eth0.10 type vlan id 10` in the guest works (the intermediate level of the R8 protocol catalog);
> - link parameters on each port — latency (0–500 ms), loss (0–30 %), bandwidth (64 Kbit/s – unlimited), "cut the cable". These are the sliders and "break it" toggles for the R4 explainers;
> - a mirror port: a ring buffer of the last 10,000 frames with timestamps; from it the live diagram (the `net.frame` bus event, see finding 10), the "tcpdump on the switch" view and `.pcap` export for Wireshark are built;
> - a "home router" uplink port: the v86 `fake_network` adapter (Wisp or fetch, section 1.6) is connected to it. This way the lab has a real NAT gateway between the learning network and the "internet" (the R8 map).
>
> The lab topology is described in the lesson YAML:
> ```yaml
> topology:
>   switches: [{ id: sw1 }, { id: sw2 }]
>   machines:
>     - { id: node-1, image: lab-node, mem: 128, ports: [{ sw: sw1, ip: 10.0.0.11/24 }] }
>     - { id: node-2, image: lab-node, mem: 128, ports: [{ sw: sw1, ip: 10.0.0.12/24 }] }
>     - { id: rtr,    image: lab-node, mem: 64,  ports: [{ sw: sw1, ip: 10.0.0.1/24 }, { sw: sw2, ip: 10.1.0.1/24 }] }
>   uplink: { sw: sw1, via: wisp }        # optional
> ```
> Addresses are assigned statically through a cloud-init-like script in 9p (`/opt/trainer/net.conf`) before the snapshot is restored, or by a `dnsmasq` DHCP server on one of the machines — as the lesson requires.
>
> **Budgets** (phase 0 acceptance threshold):
>
> | Configuration | Guest memory | Tab memory | Where |
> |---|---|---|---|
> | 1 × `lab-debian` | 256 MB | ≤ 600 MB | laptop |
> | 3 × `lab-node` + switch + kube-lite | 3 × 128 MB | ≤ 1 GB | 8 GB laptop |
> | 4 × `lab-node` | 4 × 96–128 MB | ≤ 1.2 GB | 16 GB laptop |
> | 1 × `lab-node` | 64–96 MB | ≤ 300 MB | phone, only on button press |
>
> A snapshot of a multi-machine lab is consistent: all emulators are stopped (`stop()`), the states of all machines, the switch state (MAC table, buffer) and kube-lite are saved, after which the machines are started (`run()`). Restoration is also done for the whole set.

**Ready text — new section 1.9 "Hybrid Kubernetes":**

> **1.9. Hybrid cluster: control plane in kube-lite, nodes in v86**
>
> Real k8s/k3s in v86 is impossible: k3s is built only for 64-bit platforms, and kubelet and containerd in 32-bit emulation consume hundreds of megabytes and take minutes to start. Therefore the cluster is hybrid, and this is prototyped first.
>
> - **Control plane** — kube-lite in `sim.worker.ts`: apiserver with storage, scheduler, controller-manager (Deployment, ReplicaSet, node-lifecycle, EndpointSlice). Its nodes are real Node objects registered by the agent.
> - **Node** — a v86 machine with the `lab-node` image (Alpine x86, `crun`, `iproute2`, `iptables`, `nftables`, `conntrack-tools`, `tcpdump`, `wireguard-tools`, `dnsmasq`; see finding 17) and the `dt-node` agent. The agent is a static Go binary built with `GOARCH=386` (phase 0 threshold: RSS ≤ 15 MB; if it does not pass, the same protocol in C). It works over `ttyS1` (service channel) and `ttyS3` (multiplexer for `exec`/`logs -f` streams).
> - **kube-lite ↔ `dt-node` protocol** (JSON lines over `ttyS1`):
>   ```
>   → {"op":"node.register"}                       ← {"node":{"name":"node-1","podCIDR":"10.244.1.0/24","capacity":{"cpu":"1","memory":"128Mi","pods":"8"}}}
>   ← {"op":"lease.renew","at":…}                  every 10 s of simulator time
>   → {"op":"pod.run","uid":…,"spec":{…}}          agent: netns + veth + crun run -d
>   ← {"op":"pod.status","uid":…,"phase":"Running","containers":[{"name":"web","pid":812,"state":"running","restarts":0}]}
>   → {"op":"pod.kill","uid":…,"grace":30}         SIGTERM → wait → SIGKILL (real signals)
>   → {"op":"svc.sync","services":[…],"endpoints":[…]}   agent rebuilds the kube-proxy rules
>   → {"op":"exec","uid":…,"container":"web","cmd":["sh"],"tty":true,"stream":5}
>   ```
>   `exec` streams go over `ttyS3` in frames `[stream id][channel][len][bytes]`. The channels are the same as in Kubernetes remotecommand: 0 stdin, 1 stdout, 2 stderr, 3 error, 4 resize. Inside, the agent runs `crun exec -t <id> sh`.
> - **A pod on a node is real.** The agent creates `ip netns add pod-<uid8>`, a veth pair (`veth<uid8>` in the root, `eth0` in the pod), attaches the root end to the `cni0` bridge (10.244.N.1/24) and runs `crun run -d` with the bundle. The rootfs is an overlay: lower is the unpacked image from `/opt/images/<digest>/rootfs` (on a separate ext4 disk `hdb`, see finding 2), upper and work are tmpfs. The log is written in the real CRI format `/var/log/pods/<ns>_<pod>_<uid>/<container>/0.log` (`2026-11-18T10:00:00.000000000Z stdout F …`), and `kubectl logs` reads exactly that. Pod limits → `memory.max`, `cpu.max`, `pids.max` in `/sys/fs/cgroup/kubepods/pod<uid>/<container>`, so `OOMKilled` comes from the real `memory.events`, not from a model.
> - **Network between nodes** — a mode toggle (visible on the diagram): `routes` — the agent sets `ip route add 10.244.2.0/24 via 10.0.0.12` (like host-gw); `vxlan` — `ip link add vxlan0 type vxlan id 42 dev eth0 dstport 4789` and FDB entries for the neighbors. A pod packet is visible on the switch in both modes: in the second one with the outer VXLAN headers. This is exactly the R9 animation "a packet through the nodes", only assembled from real frames.
> - **Service — real rules.** `dt-node` reproduces the kube-proxy chains in iptables mode with the same names and structure:
>   ```
>   -A PREROUTING -m comment --comment "kubernetes service portals" -j KUBE-SERVICES
>   -A OUTPUT     -m comment --comment "kubernetes service portals" -j KUBE-SERVICES
>   -A KUBE-SERVICES -d 10.96.12.7/32 -p tcp -m comment --comment "shop/web:http cluster IP" --dport 80 -j KUBE-SVC-<hash16>
>   -A KUBE-SVC-<hash16> -m statistic --mode random --probability 0.33333333349 -j KUBE-SEP-<hashA>
>   -A KUBE-SVC-<hash16> -m statistic --mode random --probability 0.50000000000 -j KUBE-SEP-<hashB>
>   -A KUBE-SVC-<hash16> -j KUBE-SEP-<hashC>
>   -A KUBE-SEP-<hashA> -p tcp -j DNAT --to-destination 10.244.1.5:8080
>   ```
>   The nftables mode (the main one in 05, decision 5) is built with `numgen random mod N vmap`. The ClusterIP is not assigned to any interface: `ip a` on the node does not show it, but `iptables-save -t nat | grep 10.96.12.7` finds it. This is where the R9 exercise takes place (check — finding 8, example `drill-k8s-clusterip`). For traffic from a pod to a Service through the bridge to pass through netfilter, the agent enables `br_netfilter` and `net.bridge.bridge-nf-call-iptables=1`; a "break it" toggle clears this flag, and the learner sees hairpin stop working.
> - **Cluster DNS.** Real CoreDNS (Go, ~50 MB RSS) does not fit into a 128 MB node. The role of CoreDNS on `10.96.0.10` is played by `dnsmasq` on node-1, and the agent generates the `<svc>.<ns>.svc.cluster.local` records from Services. The diagram says it explicitly: "dnsmasq plays the role of CoreDNS; `resolv.conf`, `search`, `ndots:5` and the queries themselves are real". The pod has a real `/etc/resolv.conf`: `nameserver 10.96.0.10`, `search <ns>.svc.cluster.local svc.cluster.local cluster.local`, `options ndots:5`. A learning discovery for experienced learners: the musl resolver in Alpine pods iterates over search domains differently from glibc, and this is visible in `tcpdump` on the switch.
> - **Node death.** The "power off node" button terminates the machine's Worker. kube-lite stops receiving Lease renewals; after `node-monitor-grace-period` (50 s by default since v1.32, 40 s before that) the node becomes `NotReady`, gets the `node.kubernetes.io/unreachable:NoExecute` taint, and pods are evicted after `tolerationSeconds` of 300 s. A "time speed" slider ×1/×10/×60 compresses the wait. The text and the diagram say "ReplicaSet created a new pod on node-2", not "the pod moved": a pod does not move, a new one with a new UID and IP is created in its place.
> - **Time.** Lease and delays are counted by the simulator clock, not the guest clock: after a snapshot is restored, the guest clock jumps.
>
> **Phase 0, item 5 (new):** two `lab-node` nodes with 128 MB + kube-lite; `kubectl apply` of a Deployment with 3 replicas → three `crun` processes are visible in `ps` on the nodes; `curl` from node-1 to the ClusterIP is answered by a pod on node-2; `kubectl exec -it` opens `sh` in a real container; powering off node-2 → the pods are recreated on node-1. Go/no-go decision on memory and pod start time (threshold ≤ 3 s).

Add `dt-switch`, `lab-node`, `dt-node` and the kube-lite hybrid mode to the v1 plan (section 7) (~8–10 person-weeks). Without this, R11 is not met.

---

### 2. BLOCKING — the 9p root does not support xattr: `setcap`, file capabilities and overlay with upper on the root do not work (R6, R7)

**Where:** 1.4 (image table, "root … 9p"), 1.5 (`files.put` into 9p), 8 (no risks).

**What is wrong.** Extended attributes are not implemented in the v86 9p server: `lib/9p.js`, the `txattrcreate` (case 32) and `xattrwalk` (case 30) branches, and a write to an xattr fid answers `SendError(tag, "Setxattr not supported", EOPNOTSUPP)` (lines around 662 and 858 of the current master). Consequences for R6/R7:
- `setcap cap_net_bind_service=+ep ./srv` and `getcap` store capabilities in `security.capability`, so on a 9p root the learner will get `Operation not supported`. And in R6 this is a mandatory item ("capabilities: capsh, getcap/setcap");
- `setfacl` on tier B (this is 02, L5 "for the experienced") does not work for the same reason;
- overlayfs will not accept 9p as upperdir: `trusted.overlay.*` requires xattr. Document 04 already accounts for this and moves overlay to tmpfs `/c`, but 09 does not record it as a platform limitation. For the hybrid nodes from finding 1, upper also needs to be kept on tmpfs;
- `ls -l /usr/bin/ping` in Debian will show ping without a capability, although on real Debian 12 `getcap /usr/bin/ping` prints `cap_net_raw=ep`. The lesson "why a regular user can ping" lies on 9p.

**Fix (text for 1.4, after the image table):**

> **Root and disks.** 9p does not support extended attributes (`EOPNOTSUPP` on `setxattr`), so everything that relies on xattr lives outside 9p:
> - `lab-debian` and `lab-node` get a second disk `hdb` — a 256 MB ext4 image mounted at `/srv/lab`. It holds the exercises with `setcap`/`getcap`, ACL, overlay lower, and unpacked images for the hybrid nodes. Image blocks are loaded lazily (`async: true`), and modified blocks must end up in `save_state` — checked in phase 0;
> - upper and work for overlay are always on tmpfs (`mount -t tmpfs tmpfs /c`), as in 04, 6.1;
> - for binaries that have file capabilities on real Debian (`/usr/bin/ping`), a copy is kept on `hdb`, and the R6 lesson refers to it. For exam E2 from 02 the root is ext4 on `hda` anyway;
> - if in phase 0 `save_state` with `hdb` does not fit into the 40 MB budget, the fallback is a patch to the 9p server in our v86 vendoring that stores xattr in the inode table (about 60 lines, to be sent upstream).

Add a row to 8 "Risks": "9p without xattr → separate ext4 disk `hdb`; checked in phase 0".

---

### 3. BLOCKING — the module "How the kernel isolates and limits" must be in the Linux block on tier B, but the platform gives these topics only to the container image (R6)

**Where:** 1.4, image table: `lab-debian` — "Linux L8–L16…", `lab-alpine` — "cgroups, overlay, `nsenter`, DNAT"; 7, the MVP criterion "Linux blocks (tier A)".

**What is wrong.** According to R6, processes and threads, namespaces, cgroups v2 with an OOM exercise, capabilities, mount/chroot/overlayfs and seccomp at the level of the idea are introduced in the Linux block as a foundation. In 09 they live only in the `lab-alpine` of the containers lesson, and the MVP criterion for Linux is "tier A". This breaks the order of R6 and R1(a): the containers block must rely on what has already been introduced rather than introduce it itself. The 01 graph also needs fixing (D03 and D04 are currently in block D). This is outside 09, but the platform must provide the environment.

**Fix.**
1. In table 1.4, add lessons for `lab-debian`: "L17 (new module of 02) — threads, namespaces, cgroups v2, capabilities, mount/chroot/overlay, seccomp; OOM-kill exercise". Debian has systemd, which itself owns the cgroup tree, and this is useful: the learner sees both the manual group `/sys/fs/cgroup/lab` and `systemd-run --scope -p MemoryMax=20M`, and `systemctl set-property … CPUQuota=50%`.
2. Packages that are missing from the list in 02, 1.3 (an error in my document, I will fix it in 02, but the platform must know about them in the image): `libcap2-bin` (`capsh`, `getcap`, `setcap`), `crun` (available in bookworm for i386), `stress-ng`, `nftables`, `iptables`, `tcpdump`, `conntrack`, `wireguard-tools`; `bridge-utils` is not needed (`ip link … type bridge` is enough).
3. The kernel configuration in 1.4 is listed incompletely ("`NAMESPACES`, `USER_NS`, `MEMCG`, …"). R6–R9 and the hybrid need an explicit fragment. Ready text for `images/kernel/fragments/dt.config`:
   ```
   # namespaces / cgroups v2
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
   CONFIG_CPUSETS=y
   CONFIG_CGROUP_BPF=y          # in cgroup v2 device control is only via eBPF; needed by crun and systemd DeviceAllow=
   CONFIG_BPF_SYSCALL=y
   CONFIG_PSI=y                 # memory.pressure for explaining "memory pressure before OOM"
   # seccomp / caps
   CONFIG_SECCOMP=y
   CONFIG_SECCOMP_FILTER=y
   # fs
   CONFIG_OVERLAY_FS=y
   CONFIG_TMPFS=y
   CONFIG_TMPFS_XATTR=y
   CONFIG_EXT4_FS=y
   CONFIG_EXT4_FS_POSIX_ACL=y
   CONFIG_EXT4_FS_SECURITY=y
   # net: virtual interfaces
   CONFIG_VETH=y
   CONFIG_BRIDGE=y
   CONFIG_BRIDGE_NETFILTER=y
   CONFIG_VLAN_8021Q=y
   CONFIG_VXLAN=y
   CONFIG_WIREGUARD=y
   CONFIG_TUN=y
   CONFIG_DUMMY=y
   CONFIG_PACKET=y              # tcpdump
   # netfilter: docker -p, kube-proxy iptables and nftables
   CONFIG_NETFILTER=y
   CONFIG_NF_CONNTRACK=y
   CONFIG_NF_NAT=y
   CONFIG_NETFILTER_XT_MATCH_ADDRTYPE=y
   CONFIG_NETFILTER_XT_MATCH_COMMENT=y
   CONFIG_NETFILTER_XT_MATCH_CONNTRACK=y
   CONFIG_NETFILTER_XT_MATCH_MARK=y
   CONFIG_NETFILTER_XT_MATCH_MULTIPORT=y
   CONFIG_NETFILTER_XT_MATCH_STATISTIC=y   # KUBE-SVC load balancing
   CONFIG_NETFILTER_XT_TARGET_MASQUERADE=y
   CONFIG_IP_NF_IPTABLES=y
   CONFIG_IP_NF_NAT=y
   CONFIG_IP_NF_FILTER=y
   CONFIG_NF_TABLES=y
   CONFIG_NF_TABLES_INET=y
   CONFIG_NFT_NAT=y
   CONFIG_NFT_CT=y
   CONFIG_NFT_NUMGEN=y          # kube-proxy nftables
   CONFIG_NFT_COMPAT=y
   # v86
   CONFIG_NET_9P=y
   CONFIG_NET_9P_VIRTIO=y
   CONFIG_9P_FS=y
   CONFIG_VIRTIO_NET=y
   CONFIG_VIRTIO_CONSOLE=y
   # lesson
   CONFIG_IKCONFIG=y
   CONFIG_IKCONFIG_PROC=y
   ```
   CI validator: `scripts/kconfig-check` after `make olddefconfig` verifies that every line of the fragment is still `=y`. Otherwise Kconfig silently drops an option when a dependency is missing.
4. In Alpine without systemd, cgroup2 will not set itself up. `lab-alpine` and `lab-node` need a boot script: `mount -t cgroup2 none /sys/fs/cgroup` (if not mounted yet) and `echo "+cpu +memory +pids" > /sys/fs/cgroup/cgroup.subtree_control`. Otherwise there will be no `memory.max` file in the child group, and exercise 2.4 `g-mem-limit` cannot be passed. The same case needs a `fail` branch (ready text — in finding 8).

---

### 4. BLOCKING — the CSP forbids executing learner code, while R10 requires "writing a small controller in the browser"

**Where:** 6.4, CSP headers (`script-src 'self' 'wasm-unsafe-eval'`, `frame-src 'none'`, Trusted Types).

**What is wrong.** The final part of R10: the learner writes a small controller, runs it against kube-lite and sees that an operator is the same reconciliation loop for a CRD. This requires executing code that is not on the server. With the current CSP, `eval`/`new Function` are closed (no `'unsafe-eval'`), so is the iframe sandbox (`frame-src 'none'`), and a `blob:` worker with learner code will run into `script-src 'self'`: `worker-src blob:` allows the worker source, but scripts inside are still checked by the policy. The CSP cannot be relaxed for the whole page: it is the main line of defense for the key (4.4, item 1).

**Fix (text in 1.3 and 6.4):**

> **Learner code.** Code written by the learner (the controller in the K-reconcile lesson, R10) is executed by the QuickJS interpreter compiled to WebAssembly (`quickjs-emscripten`, MIT; the version is pinned in phase 0). The interpreter runs in a separate Worker `usercode.worker.ts` without access to the network or IndexedDB. This is allowed by the current policy (`'wasm-unsafe-eval'`): for the browser it is a wasm module, not `eval`. Only the kube-lite API is exposed, through a `MessagePort`:
> ```js
> // what the learner sees
> export async function reconcile(req, api) {
>   const cr = await api.get('Greeting', req.namespace, req.name);
>   if (!cr) return;                                   // object deleted — nothing to reconcile
>   const cm = await api.get('ConfigMap', req.namespace, cr.metadata.name);
>   const want = { message: `Hello, ${cr.spec.name}` };
>   if (!cm) return api.create('ConfigMap', { metadata: { name: cr.metadata.name, namespace: req.namespace,
>                    ownerReferences: [api.ownerRef(cr)] }, data: want });
>   if (cm.data.message !== want.message) return api.patch('ConfigMap', cm, { data: want });
> }
> api.watch('Greeting', reconcile); api.watch('ConfigMap', reconcile, { owner: 'Greeting' });
> ```
> Limits: 50 ms of CPU per call (`setInterruptHandler`), 16 MB of memory, no more than 100 API calls per second (otherwise the diagram shows "controller in an infinite loop"). This is the lesson itself: an operator that wakes itself up with its own changes. The structure of the `reconcile` function mirrors `Reconcile(ctx, req)` from controller-runtime, so the bridge to the Go pet project (05, R5/K14) is a line-by-line comparison of two texts on one screen.

The CSP does not change. Add an item to phase 0: "QuickJS-wasm in a worker under the current CSP and Trusted Types; size ≤ 500 KB gzip, loaded only in the lesson".

---

### 5. MAJOR — the v86 `fetch` backend in a Worker will run into mixed content; address rewriting through the Service Worker will not work

**Where:** 1.6, table: "`sources.list` points to `http://apt.lab/`, the Service Worker rewrites the address"; "`docker pull/push` … is intercepted by the same Service Worker"; 1.4 "v86 runs in a dedicated Worker".

**What is wrong.**
1. In v86's `fetch_network.js` the `http:` → `https:` upgrade is triggered only when `typeof window !== "undefined"` (lines 161–164). There is no `window` in a Worker, so `fetch("http://apt.lab/…")` from a worker of a page opened over HTTPS will be blocked by the browser as mixed content before it even reaches the Service Worker. And in 1.4 v86 runs precisely in a worker.
2. Even in the main thread, `http://apt.lab/` will become `https://apt.lab/`. The Service Worker will intercept it (it sees requests to foreign domains from a controlled client), but this is fragile, and the text says nothing about it.
3. `docker pull` from the guest to `registry.trainer.local`: by 09's own design there is no `dockerd` in v86 ("the course does not rely on it"), and the registry client uses HTTPS by default. HTTPS from the guest will not pass through the fetch backend, which understands only HTTP/1.x. The table row needs to be removed or rewritten to `skopeo copy --src-tls-verify=false docker://registry.trainer.local/...` over HTTP.

**Fix.** The v86 adapter has a replaceable field `this.fetch = (...args) => fetch(...args)` (line 53) — that is what we use:

> The `fetch` adapter receives our `fetch` function, which rewrites the address before calling the browser: `http://apt.lab/<path>` → `https://cdn.<domain>/mirror/debian/<path>`, `http://apk.lab/` → `…/mirror/alpine/`, `http://registry.lab/v2/` → the registry handler (the same code as in the SW, called directly from the worker through a shared module, without a network request). Any other address gets a `502` response with the body "the internet is turned off in this lab" — the learner sees a clear `curl` error rather than a hang. HTTPS from the guest through the `fetch` backend is impossible (it parses the HTTP request in plain text); where a lesson requires TLS to the outside world — the `wisp` backend.

---

### 6. MAJOR — Wisp in v86 does not carry UDP, DNS goes through a third-party DoH, and a name-based allowlist cannot be checked on the relay

**Where:** 1.6, "Wisp relay" and item 1 of the list of measures ("`1.1.1.1:53`, `8.8.8.8:53`"; "`curl` and `dig` to the real world").

**What is wrong.**
1. v86's `docs/networking.md` states explicitly: "This WISP implementation does not support UDP, only TCP". A guest DNS query (UDP 53) to any address is intercepted by `fake_network.js` (`handle_fake_dns`), which answers itself via DoH. By default this is `DEFAULT_DOH_SERVER = "cloudflare-dns.com"` (line 58), and the query goes from the learner's browser to Cloudflare, bypassing our relay. Hence:
   - `dig @8.8.8.8 example.com` will get an answer synthesized by the emulator, not from 8.8.8.8. The TTL, flags and `SERVER:` in the output are wrong, `dig +trace` traces nothing. For the DNS lesson (R3, R8) this is an outright falsehood on screen;
   - the allowlist entries `1.1.1.1:53` and `8.8.8.8:53` are meaningless for UDP. For TCP (`dig +tcp`) they work, but nobody will find out;
   - the privacy promise ("our server …, no third-party requests") is broken: every guest DNS query goes to Cloudflare.
2. The guest connects to an IP, not to a name: the v86 Wisp client passes the relay the address the guest got from DNS. A name-based allowlist (`deb.debian.org` is behind Fastly, IPs change) cannot be checked on the relay.

**Fix (text in 1.6):**

> **DNS for machines with internet access.** The v86 adapter gets `doh_server: "<domain>/api/doh"`, which is our DoH in `dt-api`. It resolves only names from the allowlist and answers the rest with `NXDOMAIN` with a comment in TXT. Every address it hands out is remembered against the session token for the duration of the TTL. The Wisp relay lets a connection through only if the destination address was handed out to this token by our DoH and the port is one of 53/80/443. This way the name-based allowlist really works, and not a single query goes to third-party servers.
>
> **Honest output.** There is no outbound UDP: `dig @<any address>` is answered by the emulator through our DoH. In lessons where the query path matters (recursion, `+trace`, TTL, cache), only `lab-net` is used: there the root, TLD and authoritative servers and the resolver are real daemons on one machine. In lessons with internet access there is one line above the terminal: "DNS in this machine is answered by the trainer; to see real recursion, open the "Mini internet" lab".

---

### 7. MAJOR — an agent in POSIX sh polling `/proc` twice a second will not fit into v86 speed

**Where:** 1.4, "Service channel", `watch` mode ("polls `/proc/*/ns/*`, `/sys/fs/cgroup` and `ip -j link` every 500 ms"); phase 0, item 2 ("facts in ≤ 1 s, `watch` at 2 Hz").

**What is wrong.** On kernel code and when spawning processes, v86 runs at roughly 1–2 % of native speed (this is acknowledged in 1.2), and every `fork+exec` in the guest costs milliseconds. An `ns` snapshot in sh: for each of the ~40 `lab-debian` processes 8 `readlink` calls are needed, i.e. ~320 processes. Plus `jq` to assemble the JSON and `ip -j link`. That makes hundreds of processes per snapshot, and at 2 Hz the agent itself will occupy the guest CPU: the learner's terminal will start lagging, and `top` in lesson L8 will show the agent in the first row. In addition, 02, 4.2 describes `trainerd` in bash under systemd, while 09 describes POSIX sh from 9p. These need to be reconciled.

**Fix (text in 1.4):**

> Fact collection and `watch` are done by a small static program `dt-probe` (C, musl, i386, ≤ 100 KB, delivered over 9p together with `facts.sh`). In a single pass it reads `/proc/<pid>/{stat,status,ns/*,cgroup,task}`, `/sys/fs/cgroup/**/{memory.max,memory.current,memory.events,pids.max,pids.current,cpu.max,cpu.stat,cgroup.procs}`, `/proc/self/mountinfo` and netlink (`RTM_GETLINK/ADDR/ROUTE`) and prints ready JSON. No processes are spawned in the process. `facts.sh` remains for tier C VMs, where speed does not matter, and for the areas where the utility itself is needed (`systemctl show`, `iptables-save`, `crun list`). Its output is compared with the output of `dt-probe` on shared vectors.
>
> Phase 0 threshold: a `procs+ns+cgroups` snapshot ≤ 150 ms of guest time; `watch` at 2 Hz takes ≤ 5 % of guest CPU (measured from the agent's own `/proc/<pid>/stat`). The agent is hidden from learning snapshots (`procs` without the agent's PID), but is visible in `ps` under the clear name `trainer-agent` and is described in one sentence in lesson L8. The learner must not think it is a virus.
>
> Polling misses short-lived namespaces and processes. For the "fork/exec", "pipeline" and "service restart" explainers (finding 10), events are taken not from polling but from tracing: `strace -f -ttt -e trace=process,pipe2,dup2,execve -o /run/trainer/trace` on the "record" button, parsed into bus events.

---

### 8. MAJOR — predicate language: keys with dots, array comparison, memory units, undefined macros

**Where:** 2.3 (grammar and examples), 2.4 (`keep`, `@start`).

**What is wrong.**
1. `path := segment ('.' segment)*`, but fact keys themselves contain dots: `memory.max`, `memory.events`, `nginx.service`, `metadata.name`. The example `cgroups[…].memory.max<=20M` is parsed by the grammar as `memory` → `max`.
2. `units[nginx.service].active` does not fit `filter := '[' field op value ']'`: it has no operator. `units` is a dictionary, not an array, and a key-selection syntax is needed.
3. `procs[cmd=bash][ns.pid!=@host.ns.pid][nspid~1]`: `~` is a substring match, and `nspid` is an array of numbers. `~1` will match PID 1, 10, 41, 100… The check "the shell is PID 1 in its namespace" will pass falsely: a bash in a nested pid-ns with `NSpid: 4126 12` does contain the substring "1".
4. Units: is `20M` 20·2²⁰ (this is how the kernel parses `echo 20M > memory.max`, the `memparse` function) or 20·10⁶ (this is how Kubernetes understands `memory: 20M`)? The grammar gives `'20M', '1Gi'` without a definition. For the goal "≤ 20M", a learner who wrote `20000000` will pass or not depending on the implementation, and TS and Go will diverge.
5. `cgroups[…].memory.max<=20M` when the file contains the string `max`: comparing a string with a size is undefined. And this is exactly the `fail` branch "limit not set".
6. `@start.pid(stress-mem)` in `keep` is undefined: nowhere does it say that the platform saves facts at the start of an attempt.

**Fix — replace the grammar and examples in 2.3:**

```
predicate := disj
disj      := conj ('||' conj)*
conj      := unary ('&&' unary)*
unary     := '!' unary | '(' predicate ')' | term
term      := path (op value)?                    -- without op: "at least one exists"
path      := step ('.' step)*
step      := ident filter* | '`' key '`' filter* | '#' | 'first' | 'last'
key       := any text without '`'                 -- `memory.max`, `nginx.service`
filter    := '[' field op value ']' | '[' '`' key '`' ']'   -- the second: selection by dictionary key
field     := path                                 -- relative path inside the element
op        := '=' | '!=' | '<' | '<=' | '>' | '>=' | '~' | '=~' | 'in'
value     := number | size | duration | 'string' | bare-word | '@' macro
size      := number ('K'|'M'|'G') | number ('Ki'|'Mi'|'Gi') | number ('k'|'M'|'G')'B'?
```

Size semantics (identical in TS and Go, test vectors are mandatory): `Ki/Mi/Gi` = 2¹⁰/2²⁰/2³⁰; `K/M/G` without `i` = **as in the kernel**, 2¹⁰/2²⁰/2³⁰, if the path is under `cgroups.*`, and **as in Kubernetes**, 10³/10⁶/10⁹, if the path is under `k8s.*`. The content validator issues a warning on `M` without `i` and suggests the author write `Mi`. Comparing a size with the string `max` gives `false` for `<`, `<=`, `=` and `true` for `>`, `>=`, `!=`.

Macros: `@host.ns.<kind>` — the namespace inode of host process 1; `@pid(<cmd>)` — the PID of the first process with that `cmd` in the current facts; `@start.<path>` — the same path in the facts taken at the moment of `attempt.start`. The platform must save the starting facts of the `needs` area at the start of every attempt (tier A/B — in IndexedDB next to `CheckResult`, tier C — on the agent side).

Corrected examples:
```
procs[cmd=bash][ns.pid!=@host.ns.pid].nspid.last=1
cgroups[procs~@pid(stress-mem)].`memory.max`<=20Mi
units[`nginx.service`].active=active && net.listen[port=80]
k8s.objects[kind=Deployment][`metadata.name`=web][`metadata.namespace`=shop].status.readyReplicas=3
```

A ready R6 goal with full `fail` branches (instead of `g-mem-limit` in 2.4):

```yaml
- id: g-mem-limit
  say: { ru: "Ограничьте процесс stress-mem 20 МиБ памяти, не перезапуская его", en: "Limit stress-mem to 20 MiB without restarting it" }
  needs: [procs, cgroups]
  when: "cgroups[procs~@pid(stress-mem)].`memory.max`<=20Mi"
  keep: "procs[cmd=stress-mem].pid=@start.pid(stress-mem)"
  envs: [v86, vm]
  fail:
    - if: "!procs[cmd=stress-mem]"
      say: { ru: "Процесса stress-mem больше нет — вы его завершили. Цель требует ограничить живой процесс; нажмите «Сбросить шаг»", en: "..." }
      term: process
    - if: "!cgroups[`cgroup.subtree_control`~memory]"
      say: { ru: "В родительской группе не включён контроллер memory: файла memory.max в дочерней группе не будет. Посмотрите cgroup.subtree_control родителя", en: "..." }
      term: cgroup
    - if: "!cgroups[procs~@pid(stress-mem)][path!=/]"
      say: { ru: "Процесс всё ещё в исходной группе: запишите его PID в cgroup.procs новой группы", en: "..." }
      term: cgroup
    - if: "cgroups[procs~@pid(stress-mem)].`memory.max`>20Mi"
      say: { ru: "Лимит не задан или больше 20 МиБ: memory.max сейчас {value}", en: "..." }
```

(The `ru:` strings are the Russian UI messages: "The stress-mem process is gone — you terminated it. The goal requires limiting a live process; press "Reset step""; "The memory controller is not enabled in the parent group: there will be no memory.max file in the child group. Look at the parent's cgroup.subtree_control"; "The process is still in the original group: write its PID to cgroup.procs of the new group"; "The limit is not set or is greater than 20 MiB: memory.max is currently {value}".)

This requires adding `cgroup.subtree_control` to the cgroups facts (finding 9).

A ready check for the R9 exercise "find the path to a ClusterIP in iptables" (hybrid node, tier B):

```yaml
- id: drill-k8s-clusterip
  say: { ru: "Найдите, в какой под и на какой порт ядро node-1 отправит пакет к 10.96.12.7:80, и запишите ответ в /root/answer (формат IP:порт)", en: "..." }
  needs: [files, net]
  files: [/root/answer]
  when: "files.`/root/answer`.text=~'^\\s*@svc.sep(shop/web)\\s*$'"
  fail:
    - if: "files.`/root/answer`.text=~'10\\.96\\.'"
      say: { ru: "Это адрес самого Service. Он не висит ни на одном интерфейсе — ищите, во что его превращает DNAT в цепочке KUBE-SEP-…", en: "..." }
```
(The `ru:` strings: "Find which pod and which port the node-1 kernel will send a packet for 10.96.12.7:80 to, and write the answer to /root/answer (format IP:port)"; "This is the address of the Service itself. It is not assigned to any interface — look for what DNAT turns it into in the KUBE-SEP-… chain".)
Here `@svc.sep(ns/name)` is a macro that returns any of the DNAT addresses of this Service from the `net.iptables` facts. Any endpoint is accepted: the `statistic` rule picks a random one.

---

### 9. MAJOR — the `dt.facts/v1` fact schema lacks fields that R6 and R7 rely on

**Where:** 2.2, the `Facts` interface.

**What is wrong.** The following cannot be checked: threads (R6: `/proc/<pid>/task`, `ps -eLf`), process and file capabilities, seccomp mode, `no_new_privs`, UID mapping in a user namespace, the process root (chroot or pivot_root), process state (`Z` — zombie, R7), signal masks (R7: does PID 1 handle `SIGTERM`), `pids.current`, `cpu.stat` (`nr_throttled`), `cgroup.subtree_control`, the destination of the container's stdout (R7: to a log driver or to a file).

**Fix — add to 2.2:**

```ts
procs?: {
  pid: number; ppid: number; user: string; uid: number; gid: number; cmd: string; exe?: string;
  state: 'R' | 'S' | 'D' | 'T' | 'Z' | 'I';
  threads: { tid: number; comm: string }[];             // /proc/<pid>/task
  nspid: number[]; ns: Record<NsKind, string>; cgroup: string;
  root: string;                                          // readlink /proc/<pid>/root (chroot/pivot_root)
  caps: { eff: string; prm: string; bnd: string; inh: string; amb: string };   // hex from status, + decode
  noNewPrivs: boolean; seccomp: 0 | 1 | 2;               // Seccomp: 0 off, 1 strict, 2 filter
  uidMap?: string[]; gidMap?: string[];                  // /proc/<pid>/uid_map
  sig: { caught: string; blocked: string; ignored: string };   // SigCgt/SigBlk/SigIgn
  fds?: { fd: number; target: string }[];                // on request: pipe:[…], socket:[…] — for the pipeline explainer
}[];
cgroups?: {
  path: string; procs: number[]; 'cgroup.subtree_control': string[]; 'cgroup.type': string;
  'memory.max': string; 'memory.high'?: string; 'memory.current': number; 'memory.peak'?: number;
  'memory.events'?: { low: number; high: number; max: number; oom: number; oom_kill: number };
  'pids.max': string; 'pids.current': number; 'pids.events'?: { max: number };
  'cpu.max': string; 'cpu.stat'?: { usage_usec: number; nr_periods: number; nr_throttled: number; throttled_usec: number };
}[];
fileCaps?: Record<string, string>;                       // getcap for the requested paths
containers?: { /* … as before … */ logPath?: string; logDriver?: string; init?: boolean; user?: string; stopSignal?: string; restartCount?: number }[];
```

The `fds` and `fileCaps` facts are collected only by name (in `needs`), like `files`.

---

### 10. MAJOR — the platform provides no environment for the R3/R4 explainers: the event bus is poor, there is no recomputation by parameters

**Where:** 1.3 (`op: 'record'`), 1.4 (`watch`), references to the 08 bus, 3.0.

**What is wrong.**
1. R4 requires: "changing a parameter immediately recomputes the process, with the explanation of the change next to it", plus steps forward and back. The 08 stepper folds recorded events. But if the learner moves the `replicas`, `memory.max`, TTL or TCP window slider, the events have to be *generated anew*, and within tens of milliseconds. 09 says nothing about this: simulators have no requirement for determinism, virtual clocks and a pure run.
2. On tier B, running backwards is impossible in principle: it is a real kernel. A "record, then rewind" mode is needed, and for a parameter change — an honest restart of the scenario in the guest.
3. The `SimEvent` bus (08, 3.0, implemented by the platform) lacks events without which the Linux explainers from R3 cannot be built: `proc.spawn` glues together `fork` and `exec`, although the "fork/exec/PATH" explainer is built precisely on their difference. There are no events for a signal, a thread, a zombie, a pipeline, a systemd unit restart. In the network there is no L2 frame and no netfilter rule hit, in Kubernetes — no Lease.

**Fix (new section 1.10 "Environment for explainers"):**

> Every tier A simulator implements a pure function
> `run(scenario: string, params: Record<string, number | string | boolean>, seed: number): SimEvent[]`
> on virtual clocks (no `Date.now()`, `Math.random()` — only the seed). Threshold: ≤ 30 ms per explainer scenario from 08, otherwise the slider "lags". When a parameter changes, the stepper calls `run` again, matches the new and old traces by `step id` and shows the difference next to it ("`replicas` 3 → 5: the scheduler created 2 more pods, steps 7–8 were repeated twice"). The difference text is set by a template in the explainer YAML: `on_change: { replicas: "…{old}…{new}…" }`.
>
> On tier B the explainer runs in "record" mode: the "record" button turns on tracing (finding 7), the learner runs the command, the trace is turned into bus events and then played back by the same stepper. A parameter change is a rerun of the command in the guest from the same snapshot (1–4 s) labeled "recomputed on a real kernel".
>
> Additions to the bus (08, 3.0 — to be agreed with role 08):
> ```ts
> | { t: 'proc.fork'; pid: number; ppid: number; at: number }
> | { t: 'proc.exec'; pid: number; path: string; argv: string[]; tried?: string[] }   // tried — PATH lookup attempts with ENOENT from strace
> | { t: 'proc.thread'; pid: number; tid: number }
> | { t: 'proc.signal'; pid: number; sig: string; from?: number; action: 'handled' | 'default' | 'ignored' }
> | { t: 'proc.state'; pid: number; state: 'Z' | 'R' | 'S' | 'T'; reaper?: number }
> | { t: 'fd.pipe'; id: string; writer: number; reader: number; bytes?: number }
> | { t: 'unit.state'; unit: string; active: string; sub: string; result?: string; restarts: number }
> | { t: 'cgroup.oom'; path: string; victim: number }
> | { t: 'net.frame'; sw: string; port: string; src: string; dst: string; ethertype: string; vlan?: number; summary: string }
> | { t: 'nf.hit'; table: string; chain: string; rule: number; verdict: string }
> | { t: 'k8s.lease'; node: string; renewed: boolean }
> ```

Storyboards of the Linux block explainers (R3/R4) that this environment must support. Their content is my part (I will write it into 02), but the platform needs to see where the data comes from and which parameters are needed:

| Explainer | Event source | Screens (one screen — one idea) | Sliders and toggles | "Break it" |
|---|---|---|---|---|
| Machine boot | a cold boot recording in CI: `dmesg -T`, `systemd-analyze plot` (SVG → events), `journalctl -b -o json`; a "cold boot" button in v86 (25 s, honestly) | 1. BIOS → bootloader → kernel (`cmdline` labeled on the arrow); 2. the kernel unpacks the initramfs and mounts the root (`root=host9p`); 3. PID 1 = systemd; 4. the target graph `sysinit.target` → `basic.target` → `multi-user.target`; 5. the first `getty` and the prompt | `init=` (systemd / `/bin/sh`), "no network" (`systemctl mask` of the network), `quiet` on/off | remove `root=` → kernel panic with the real text; remove the network unit → `multi-user.target` without a network |
| fork/exec/PATH | `strace -f -e trace=process,execve` in v86; in A — the Stand model | 1. the shell reads a line; 2. looks up the command: builtin? alias? iterating over the `PATH` directories (each attempt is an arrow with `ENOENT`); 3. `fork` — a copy of the shell with a new PID; 4. `exec` — the program changes in the same copy, the PID stays the same; 5. `wait` and the exit code | order of directories in `PATH`, "command — builtin / external", `exec ls` instead of `ls` | remove `/usr/bin` from `PATH` → `command not found` with an explanation of which step failed |
| Pipeline | `strace -f -e trace=pipe2,dup2,read,write`, `ls -l /proc/<pid>/fd` → `pipe:[…]` | 1. the shell creates a pipe (a kernel buffer, 64 KiB); 2. two `fork`s; 3. `dup2`: stdout of the left one → the pipe, stdin of the right one ← the pipe; 4. data flows, the byte counter in the buffer grows; 5. the left one exits → EOF for the right one | buffer size (visually, without changing the kernel), writer and reader speed | "the reader died" → the writer gets `SIGPIPE` (`yes | head -1`) |
| systemd restarts a crashed service | `journalctl -o json -f -u demo`, `systemctl show -p NRestarts,ActiveState,SubState,Result` → `unit.state` | 1. the unit file: `Restart=`, `RestartSec=`; 2. the process crashes (code ≠ 0); 3. systemd waits `RestartSec`, the `NRestarts` counter; 4. `StartLimitBurst` within `StartLimitIntervalSec` is exceeded → `failed (Result: start-limit-hit)` | `Restart=no/on-failure/always`, `RestartSec` 0–10 s, `StartLimitBurst` 1–10 | `kill -9` of the main process; delete the binary from `ExecStart` → `status=203/EXEC` |
| Memory limit and OOM (R6) | `dt-probe watch` on `memory.current`, `memory.events`, `memory.pressure`; `dmesg` with `oom-kill` | 1. the group and its files; 2. the process grows, `memory.current` creeps toward `memory.max`; 3. the kernel evicts the page cache (PSI pressure grows); 4. `oom_kill` +1, the line `Memory cgroup out of memory: Killed process …` in `dmesg`; 5. outside the group everything is alive | `memory.max` 8–64 MiB, `memory.high` on/off (throttling instead of killing), growth rate | remove `+memory` from `subtree_control` → no `memory.max` file |

---

### 11. MAJOR — the platform has neither components nor data for the documentation ladder (R2)

**Where:** section 4 (mentor modes), 3.1 (`LearnEvent.type`), 1.4 (images), 2.4 (goal format), 7 (plan).

**What is wrong.** R2 requires five steps for each block: from "documentation flashes by" to "only the official documentation in the exam". For this, the platform needs: (a) an offline corpus of man pages and help of the same version as the programs in the image; (b) a viewer with anchors to sections and line highlighting (step 2); (c) "where they looked" events (steps 3–4); (d) a mentor mode that does not answer but asks "where did you look?" (step 4); (e) an exam mode with a list of allowed sources (step 5). 09 has none of the five. A separate technical trap: in images based on `debian:bookworm-slim` the documentation is stripped (`/etc/dpkg/dpkg.cfg.d/docker` excludes `/usr/share/man/*`), and 02, 1.3 installs man "only for the commands from 3.3". So at step 4, where a flag that is not in the theory is needed, `man` in the guest will turn out to be empty. Alpine has no man pages at all: `mandoc` and the `*-doc` packages are needed.

**Fix (new section 2.6 "Documentation as an environment"):**

> **Corpus.** When a `lab-*` image is built, all man pages of the installed packages are extracted from it (the `path-exclude /usr/share/man` exclusion is removed from the image), along with the `--help` output of all binaries in `PATH`. The pages are converted to HTML with `mandoc -T html` with anchors for sections (`#SYNOPSIS`, `#DESCRIPTION`, `#OPTIONS`, `#EXAMPLES`, `#SEE_ALSO`) and for each flag (`#opt-z`), laid out under `/docs/man/<pkg>@<version>/<page>.<sec>.html` and cached as lesson data. This way a page always matches the binary the learner is working with. In Alpine — `mandoc` and `*-doc` for the lesson packages. `kubectl explain` is taken from OpenAPI v1.37 (05). Fragments of kubernetes.io (CC BY 4.0) and docs.docker.com (the license is checked before publication) are mirrored by the links from the lessons, with attribution and the snapshot date. Man page licenses differ between projects (GPL, BSD, "verbatim"); we distribute them unchanged together with the package name, as the distribution itself does.
>
> **The `docview` viewer.** It opens next to the terminal. Modes: `peek` (step 1: one line "this is from `man ls`, section DESCRIPTION, `-l`" and a link), `fragment` (step 2: a section of the page with the line highlighted and labels for the parts of the page — "SYNOPSIS: what is in square brackets is optional"), `page` (steps 3–5: the whole page with `/` search, without highlighting). The v86 terminal runs the real `man`; in the Stand, `man <cmd>` opens the same text in the terminal pager.
>
> **Events.** `LearnEvent.type` is extended with `doc.opened { ref, via: 'link' | 'man' | 'help' | 'explain' | 'external', mode }` and `doc.searched { ref, query }`. On tier B, `PROMPT_COMMAND` (02, 4.2) already sends every line: the agent marks the lines `man …`, `… --help`, `… -h`, `kubectl explain …`, `info …`, `apropos …` as `doc.opened via=man|help|explain`.
>
> **Description in the task:**
> ```yaml
> docs:
>   step: 4                         # 1–5, the ladder step for this task
>   ref: "man:systemd.resource-control(5)#CPUQuota="
>   target: "CPUQuota="             # what the learner must find; the mentor does not say it
> ```
> The block's step is stored in the progress (`docLadder[block]`, derived from the log): a beginner starts at 1, an intermediate learner at 2, an experienced one at 3 (R2). Moving to the next step happens after three tasks of the current step solved without revealing a hint.
>
> **The `forcing` mentor mode** (a row for table 4.5):
>
> | `forcing` | step 4 tasks | Do not name the flag, option or command from `docs.target` and do not quote the documentation line that contains them. In the first answer, ask where the learner has already looked. If the log has no `doc.opened` for this task, suggest a specific tool (`man <cmd>`, `<cmd> --help`, `kubectl explain <path>`, docs.docker.com) and how to search in it (`/word` in `less`). If they have looked, point to the section of the page, but not the line | The answer is checked for an occurrence of `docs.target`; on a match the block is collapsed under the button "Show — the task will be counted at step 3". The last `doc.opened` events for the task go into the context (layer 3) |
>
> **Step 5 (exams).** The neural network is turned off (`exam`). `docview` works in `page` mode only over the corpora listed in the exam (`docs_allowed: [man, kubernetes.io, docs.docker.com]`). External links open in a new tab. We cannot forbid other tabs and do not pretend that we can (as in 4.7 and in 10). Some tasks require commands and flags that are not in the course (R2); the author marks them `beyond_course: true`, and the validator checks that such tasks make up at least 20 % of the exam.

Examples of Linux block tasks by step (I will write them into 02; here — so that the platform sees which data is needed):

| Step | Task | Check |
|---|---|---|
| 1 | "Show the files with their sizes" → `ls -l`; under the output, the line "this is from `man ls`, `-l`: use a long listing format" with a link | the state does not change; `cmd.done` with `ls` and `-l` in any order |
| 2 | "Find the files in `/var/log` modified in the last day". Hint 1 — a fragment of `man find` with the `-mtime n` line highlighted and the labels `SYNOPSIS / TESTS / EXAMPLES` | `files./root/answer` matches the reference list |
| 3 | "Find the `sort` flag that sorts `1K 2M 3G` by meaning" — only a link to `man sort` | `files./root/sorted.txt.sha256` = reference (`sort -h`) |
| 4 | "Limit the `demo` service to half a core without editing the unit file by hand" (the theory only has `memory.max` on a raw cgroup) | `cgroups[path~demo.service].`cpu.max`='50000 100000'` and the unit file `/etc/systemd/system/demo.service` is unchanged (sha256 = `@start`); the answer is `systemctl set-property demo CPUQuota=50%` |
| 4 | "Show all threads of the `orders-server` process with one command, without going into `/proc`" | `history` contains `ps` with `-L`, `-T` or `-eLf`, or `top -H`; the check is soft, it is counted by the number of threads written to `/root/answer` |
| 5 | Exam: "Find the process that holds a deleted file and takes up disk space", while `lsof +L1` was not introduced in the course | `df` freed space (`files` + partition `stat`), the process is alive (`keep`) |

---

### 12. MAJOR — the `trainer-check` agent contradicts documents 05, 06 and 10

**Where:** 5.4, 4.7, 5.6.

**What is wrong.** In 05, 10.4 and in 10 (the lines about `trainer-check capstone` and `pet <N>`) the check is described as an *open script that only reads the system*: it is run as `bash trainer-check.sh r2`, not `curl | bash`, and "the learner sees that it does not change the system". 06 also has a third checker — the image `docker run ghcr.io/<org>/devops-trainer-checker`. 09 introduces a Go binary with a systemd service running as root, a persistent WebSocket to the server and injection of breakages from signed packages, but calls it "the mechanism from 05, generalized". The promise "the script only reads" and an agent that breaks kubelet are incompatible. If both live under the same name, neither the learner nor a code reviewer will be able to understand what exactly they are running.

**Fix (text in 5.4):**

> Two binaries, one source code:
> - **`trainer-check`** — read-only, the only checker for blocks 02, 04, 05, 06 and 10 (instead of `trainer-check.sh` and the `devops-trainer-checker` image). No service, no root by default: only the areas that read `/etc/kubernetes/pki` and `/var/lib/etcd` need `sudo`, and it says so in advance. Modes `run --track …` (without a server, a base64 block) and `report` (the same, signed with the attempt key). The source of `facts.sh` and of the list of areas is open; the binary is built reproducibly, and a link to the tag in the repository is shown next to the installation command.
> - **`trainer-exam`** — a separate binary only for credentialed exams and workshops: a service, a WebSocket to `dt-api`, application of signed breakage packages, signing of facts. It is installed only with the `trainer-exam enroll` command on the learner's machine, and that command states plainly: "this program will introduce breakages into your machine as the exam requires".
>
> Documents 05 (10.4), 06 (the monitoring practicum) and 10 (capstone, pet) refer to `trainer-check`; `devops-trainer-checker` in 06 is abolished.

---

### 13. MAJOR — for Kubernetes stage 3 (R12) there is no "Terraform orders VMs, Ansible configures them" path, no mandatory cleanup and no cost counter

**Where:** 5.1–5.3, 7 (v2: "tracks R3–R5").

**What is wrong.** According to R12, at stage 3 the trainer executes nothing: it guides, checks with a script, shows the VM cost and requires a mandatory cleanup step, while the VMs themselves are ordered with Terraform and configured with Ansible. In 09, VMs are created on a button press. For the IaC block this is worse: the learner does not write infrastructure as code for the very cluster they then install. There is no cleanup step with a check, no money counter. R12 stage 2 (a single-node k3s/minikube/kind on one's own machine or a VPS) is mentioned only in the options table.

**Fix (new section 5.7):**

> **5.7. Kubernetes stages 2 and 3 on real machines**
>
> **Stage 2 (one node).** k3s on one VM (any VPS or a local VM, 2 vCPU / 4 GB) or kind/minikube on one's own machine. The trainer shows the checklist from 05, 10.3; the check is `trainer-check run --track r1|r2`.
>
> **Stage 3 (kubeadm on 3+ VMs).**
> 1. *Ordering VMs with code.* The learner writes Terraform for their own cloud (the `yandex-cloud/yandex`, `hetznercloud/hcloud`, `hashicorp/aws` providers; templates for each are in the course repository): three VMs, cloud-init with their ssh key — and runs `terraform apply` on their side. A learner without a cloud account brings up three local VMs on their own computer (Multipass or Vagrant) and practises ordering infrastructure with code on the in-tab cloud (00 §6.13).
> 2. *Ansible configuration.* The inventory is generated from `terraform output -json`. The course playbook installs containerd, kubeadm, kubelet and kubectl of the pinned version v1.36.x (for R4 → v1.37), disables swap and enables `br_netfilter` and `ip_forward`. The learner writes the remaining roles themselves.
> 3. *Installation* according to the 05 checklist (kubeadm init/join, Cilium, storage, certificates, upgrade, etcd snapshot/restore, "break and fix a node"); the check is `trainer-check run --track r3|r4`.
> 4. *Cost.* Above the checklist there is a counter "VMs have been running for N h M min ≈ X ₽ / €" based on the prices from `providers.yaml`. Local VMs have no counter: they cost nothing.
> 5. *Cleanup (mandatory, the track is not closed without it).* `terraform destroy`, then a check: the learner pastes the output of `terraform state list` (must be empty) and the output of the provider CLI (`yc compute instance list --format json`, `hcloud server list -o json`, `aws ec2 describe-instances --filters Name=instance-state-name,Values=running`), and the trainer checks that it contains no VMs with the label `devops-trainer=<id>`. The label is set by the course Terraform template.

---

### 14. MAJOR — nested network at the provider: Cilium inside a VM will run into MTU, and LoadBalancer into L2

**Where:** 5.2–5.3 (the VMs of a set in the private network of a provider or a local hypervisor).

**What is wrong.** Track R3: Cilium in tunnel mode (VXLAN/Geneve) inside VMs, while the private networks of many clouds are themselves built on an overlay, and the VM gets an interface with an MTU below 1500 (1450 on a Hetzner Cloud private network). Double encapsulation eats the MTU: Cilium on top takes off about 50 more bytes. If the MTU is not aligned, the result is the classic "black hole": `ping` works, but the TLS handshake and large responses hang. For a learner doing their first kubeadm this is an unsolvable puzzle. In addition, a spike needs to check whether the provider network will pass packets with pod addresses in Cilium direct routing mode (anti-spoofing protection on the VM port) and whether LoadBalancer L2 announcements (MetalLB L2 or Cilium L2 announcements) will work if ARP for a foreign address is filtered.

**Fix (text in 5.3 and in phase 0):**

> **Network inside a set.** cloud-init sets on `eth0` the MTU provided by the provider network. The course Cilium template sets `routingMode: tunnel`, `tunnelProtocol: vxlan`, and the MTU is detected automatically, and the R3 check verifies this: `trainer-check` compares the MTU of `cilium_vxlan` with the MTU of `eth0` minus 50. For LoadBalancer, R3 uses NodePort plus the load balancer of the learner's cloud (paid, its price is shown on the order screen) or Cilium L2 announcements — which of these works at which providers and on local VMs is decided by the spike. Phase 0, item 6: three VMs at one of the 5.2 providers and three local VMs, kubeadm + Cilium, `curl` of a large (1 MB) response through a Service between nodes, `kubectl get svc` of type LoadBalancer gets an address.
>
> The MTU mismatch at the same time becomes a "break and fix" exercise for experienced learners (R8/R9: "ping works, HTTPS hangs — which layer is broken?").

---

### 15. MAJOR — phones and low-memory devices: R11 requires one node on a phone, and the `deviceMemory` rule fires incorrectly

**Where:** 1.4, "Devices" ("v86 does not start automatically on a phone and when `navigator.deviceMemory < 4`"), table 1.1 "Phone: no".

**What is wrong.**
1. R11: "1 node on a phone". In 09, v86 does not start on a phone at all.
2. `navigator.deviceMemory` exists only in Chromium. In Safari and Firefox it is `undefined`, and `undefined < 4` is `false`. As a result, on an iPhone and in Firefox on a weak laptop v86 will start automatically, while on a Chromium laptop with 4 GB it will not. Moreover, the value is coarsened and capped at 8.

**Fix (text):**

> **Devices.** The machine autostarts only if `navigator.deviceMemory >= 4` (Chromium) or, when the property is undefined, by the desktop device heuristic (`matchMedia('(pointer: fine)')` and width ≥ 1024 px). In all other cases a button "Start the machine (≈ 40 MB download, ≈ 250 MB memory)" is shown. On a phone one `lab-node` machine with 64–96 MB is available (without systemd, BusyBox + `crun`) — for the namespaces/cgroups lessons and the single-node hybrid. Multi-machine labs on a phone offer a QR handoff to a computer (08, 3.9). Phase 0 threshold: iPhone 13 and Android with 4 GB — snapshot restore ≤ 6 s, the tab is not unloaded during 10 minutes of work.

---

### 16. MAJOR — the "v86 is itself a VM" experience and the comparison of container start with VM boot (R7c) are neither verified nor planned

**Where:** 1.4 (snapshots: "the machine never boots from scratch for the learner"), 1.1 (the "Start" row).

**What is wrong.** According to R7c, in the browser Linux the learner must make sure that it is itself a VM (`dmesg`), compare `uname`/`ps` inside and outside a container and measure how long a container takes to start and how long a second v86 VM takes to boot. There are two problems here.
1. It is unknown what the learner will see. v86 emulates the processor, and the hypervisor bit in CPUID and the DMI strings from SeaBIOS may give `systemd-detect-virt` and `dmesg | grep -i hypervisor` nothing recognizable. Then the lab experience "I am inside a VM" will not work.
2. The policy "never boot from scratch" forbids an honest measurement of VM boot, and a snapshot restore in 1–4 s is not a boot, so the "container vs VM" comparison will be dishonest.

**Fix (text in 1.4 and phase 0):**

> **The "this machine is a VM" experience.** Phase 0 records what the commands `dmesg | head -30`, `systemd-detect-virt` (in `lab-debian`), `cat /sys/class/dmi/id/{sys_vendor,product_name}`, `lscpu | grep -i -E 'hypervisor|model name'` show in `dt-kernel`. If there is no recognizable sign, the lesson relies on what is visible for sure: the emulator's CPU model in `/proc/cpuinfo`, `virtio` devices in `lspci`/`/sys/bus/virtio/devices` and `dmesg` with `9pnet_virtio`. We will not fake the output.
>
> **The "container vs second VM" measurement.** The R7c lab has a button "boot a second machine from scratch" — a cold boot of `lab-node` without a snapshot, 64 MB, about 25 s, with a live boot log. In parallel, the learner runs `time crun run …` in the first machine. Both times are emulator time, roughly 50–100 times slower than hardware, and the label says so: "on a server the same values are 50–100 times smaller, but the ratio is the same". The counters of the R7c explainer (boot, start time, memory) are taken from a model with parameters confirmed on the course test VMs, not from v86.

---

### 17. MAJOR — the image catalog is incomplete and diverges from 06; the lab network addresses are not reconciled

**Where:** 1.4, image table; 1.6, "a shared segment `10.0.0.0/24`, DHCP is served by one of the machines".

**What is wrong.**
1. 06 describes the "Real Ansible" lab: three v86 machines (Alpine with python3 and ansible-core, two hosts with python3 and dropbear) on `inbrowser` with static 10.5.0.x. The 09 catalog has no such image, there is no budget for three machines either, the `inbrowser` backend is being replaced (finding 1), and the address plan is different (DHCP 10.0.0.0/24).
2. There are no images for R8 (the protocol catalog on real daemons: DHCP, NTP, SMTP, SFTP, WireGuard, VLAN) or for R9/R11 (`lab-node`).

**Fix — replace the image table:**

| Image | Root | Memory | Purpose |
|---|---|---|---|
| `lab-debian` | Debian 12 i386, systemd, 9p + `hdb` ext4 | 256 MB (2 × 192 MB) | Linux L8–L17, ssh, systemd, disks, R6 |
| `lab-alpine` | Alpine 3.22 x86, OpenRC, 9p + tmpfs `/c` | 256 MB | a container by hand (04) |
| `lab-node` | `lab-alpine` + `crun`, `nftables`, `iptables`, `conntrack-tools`, `tcpdump`, `wireguard-tools`, `dnsmasq`, `dt-node`; pod images on `hdb` | 64–128 MB | hybrid Kubernetes, multi-node network, phone |
| `lab-net` | `lab-alpine` + `nsd`, `unbound`, `dnsmasq`, `nginx`, `openssl`, `chrony`, `openssh-sftp-server`, `opensmtpd` or `msmtp` + a `mailpit`-like tool in C | 192 MB | "mini internet", the R8 protocol catalog |
| `lab-ansible` | Alpine + `python3`, `ansible-core` (control node); hosts — `lab-node` + `python3` | 256 + 2 × 96 MB | "Real Ansible" (06) |

The lab address plan (one for the whole course, so that lessons can refer to each other): the node learning network `10.0.0.0/24` (gateway `.1`), a second routing network `10.1.0.0/24`, pods `10.244.<node>.0/24`, Services `10.96.0.0/16` (DNS `10.96.0.10`), the "mini internet" network `198.51.100.0/24` and `203.0.113.0/24` (RFC 5737 documentation ranges, they will never overlap with real ones), the Docker bridge `172.17.0.0/16`, Ansible — `10.5.0.0/24` (as in 06).

---

### 18. MAJOR — the order of the work plan does not reflect the R1 priorities

**Where:** 7 "Work plan", MVP and v1 criteria.

**What is wrong.** According to R1, the core of the product is a textbook with a strict order of entities, step-by-step explainers of processes and the habit of digging into documentation, and practice rests on them. The 09 MVP has neither the environment for explainers (finding 10), nor the documentation corpus and `docview` (finding 11), nor a platform-side term order validator for mentor hints. Instead it has Wisp, OPFS and export. The criterion "the blocks can be completed offline" says nothing about the three pillars of R1.

**Fix — add to the MVP:** `run(params, seed)` and virtual clocks in the Stand and dsim, the extended bus (finding 10), the "record" mode on tier B, `docview` with the man page corpus of `lab-debian` and `lab-alpine`, `doc.*` events, the `forcing` mentor mode. Extend the MVP readiness criterion: "every Linux module has at least one process explainer with a slider and "break it"; every task has `docs.step`; the hint validator does not let through terms that have not been introduced". Move the Wisp relay from phase 0 to v1: it is not used in the MVP.

---

### 19. MAJOR — the versions in the golden recordings diverge from 05

**Where:** 1.3, "Truthfulness rule": "k3s stable, kubeadm v1.36".

**What is wrong.** In 05, kube-lite validates against OpenAPI v1.37 and declares iptables/nftables the main kube-proxy modes (IPVS goes away in v1.37), while kubeadm v1.36 is needed only as the starting point of track R4. If the kube-lite golden recordings are made on v1.36, the `kubectl` output, validation messages and default fields will diverge from the v1.37 schemas.

**Fix:** "kube-lite golden recordings are made on k3s and kubeadm of the same minor version as the schemas (currently v1.37.x); a separate set of v1.36.x recordings is only for track R4 (upgrade)". In R9, IPVS is mentioned in one sentence, as in 05; we do not enable `CONFIG_IP_VS` in the kernel.

---

### 20. MAJOR — mentor hints and term discipline: identifiers do not match the 01 graph

**Where:** 4.5, layer 2 ("Already introduced: process, pid, namespace, pid-namespace…"), 1.4 ("Linux L8–L16").

**What is wrong.** In 01, concepts have codes `L01…L32`, `D03`, `N21`; in the 08 glossary — slugs (`pid-namespace`); and the 02 modules are numbered `L0…L16`. "L8–L16" in 09 reads both as 02 modules and as 01 concepts (L16 in 01 is `PATH`). Layer 2 of the hint is assembled automatically, and if the source of identifiers is not defined, the mentor will get a wrong "not yet introduced" list.

**Fix (text in 4.5):** "Layer 2 is built from `glossary.yaml` (08, 7.3): term slug → `introduced_in` (lesson and scene) → concept code in the 01 graph (`concept: L17`). In the document text, block modules are denoted `lnx-m08`, `ctr-m03`, `k8s-m10`, and graph concepts `L17`, `D03`, to avoid confusion". The same fix is needed in 02 (I will do it).

---

### 21. MINOR — serial ports are not allocated between documents

**Where:** 1.4 "Service channel" (`ttyS1`), 04, 6.3 (`ttyS2` — the second "host" terminal), finding 1 (`ttyS3` — the `exec` multiplexer).

**Fix:** fix a table: `ttyS0` — the learner's terminal, `ttyS1` — the service agent (JSON), `ttyS2` — the second terminal (04: "inside and outside the container"), `ttyS3` — the `exec`/`logs -f` streams of the hybrid node. v86 has only four UARTs, there are no more ports. If a third terminal is needed, it is opened through `exec` on `ttyS3`.

---

### 22. MINOR — discrepancies with 02 that 09 resolves but does not name

**Where:** 1.4, 3.1.

02 describes `trainerd` in bash under systemd, snapshots in IndexedDB, the `linux-image-686` kernel package and a 60 MB snapshot threshold in the spike; 09 — an sh agent from 9p, OPFS, `dt-kernel` and a 40 MB threshold. The 09 decisions are reasonable and I accept them, but section 1.6 promises to list all such discrepancies, and these are not there. Add a line at the beginning of 1.4: "Replaces in 02: agent → `dt-probe` + `trainer-agent` (1.4); snapshots → OPFS (3.1); `linux-image-686` → `dt-kernel`; snapshot threshold 60 → 40 MB". Also, `fs-probe` from 02 (reading 9p from JavaScript) moves into `v86.worker.ts`, because the emulator now lives in the worker.

---

### 23. MINOR — Debian 12 i386 has no upgrade path; this is not in the risks

**Where:** 8.

Debian 13 no longer builds the kernel and the installer for i386, and bookworm is supported by Debian LTS until 30.06.2028. The kernel is our own, but the user space will be stuck on bookworm. Add a line to 8: "End of bookworm LTS (06.2028) → by 2028, move `lab-debian` to the Debian 13 i386 userland (i386 packages in trixie remain for multiarch; check the completeness of the set) or replace the backend (linux-wasm, section 1.2)".

---

### 24. MINOR — frequent checks on tier B get in the learner's way

**Where:** 2.5 ("after 1.5 s of silence following `cmd.done`").

Every second and a half of silence in the guest, fact collection starts. In lesson L8 about `top` and load, the agent itself will be the load. Add: "Auto-check on tier B collects only the `needs` areas of the current goal and no more often than once every 5 s; in lessons marked `quiet_agent: true` (load, `top`, `vmstat`) — only on a button press".

---

### 25. MINOR — Trusted Types and xterm.js 6 have not been tested together

**Where:** 6.4, CSP (`require-trusted-types-for 'script'`).

The xterm.js DOM renderer and some of its addons work with `innerHTML`. Under `require-trusted-types-for 'script'` this will throw an exception, and the terminal will disappear. Add to phase 0: "xterm.js 6 with the WebGL renderer and `web-links` under Trusted Types without a `default` policy; if it does not pass — a `dt-term` policy with sanitization only for xterm". The beautiful terminal from R5 starts with it rendering at all.

---

### 26. MINOR — terminal beauty (R5) is not assigned to anyone

**Where:** 6.1 (stack), 6.4 (`font-src 'self'`).

R5 needs: a monospace font without ligatures (for example, JetBrains Mono or IBM Plex Mono, both under OFL), served from our own domain (`font-src 'self'`). The terminal theme is built from the same color tokens as the 08, 5.2 diagrams: the "kernel" color and the "user space" color match in the `strace` output and on the diagram. Cursor and selection — by tokens. Smooth scrolling, `scrollback` of 5000 lines. Add a line to 6.1 "Terminal": "theme and font — from the 08, 5.2 tokens; the font is self-hosted".

---

### 27. MINOR — the `@host.ns.pid` macro is not defined for VMs

**Where:** 2.3.

On a tier C VM the "host" is the VM itself, and on a hybrid node it is the node. A rule is needed: `@host` is the process with PID 1 in the root pid namespace of the machine the facts were taken from.

---

### 28. MINOR — the claim about `curl https://example.com` in phase 0

**Where:** 7, phase 0, item 3 ("`apk add` and `curl https://example.com` from the guest").

According to the plan, `apk add` from the guest goes through the `fetch` backend and the mirror (1.6), not through Wisp. The item mixes two backends. Split it: "3a. The `fetch` backend with address rewriting in the Worker (finding 5): `apt update && apt install tree` in `lab-debian`. 3b. Wisp + our DoH (finding 6): `curl -sI https://example.com`; `curl https://neverssl.com` gets rejected by the relay".

---

### 29. MINOR — a slip in the Wisp relay restrictions

**Where:** 1.6, item 1 of the list: "ports 53, 80, 443".

Port 53 over Wisp is possible only as TCP (`dig +tcp`). After fix 6, DNS goes through our DoH, and port 53 is not needed in the list. Remove it or label it "TCP only, for `dig +tcp` in lesson L14".

---

### 30. MINOR — `ps` and the agent in learning snapshot recordings

**Where:** 1.4, "Boot" (snapshot after `TRAINER_READY`).

The snapshot includes the agent processes, `dt-probe watch` and `getty` on `ttyS1`/`ttyS2`. In the labs, `ps -ef` shows the learner extra lines, while 04 promises that `ps` will show three processes. Add: service processes are started in a separate cgroup `/sys/fs/cgroup/trainer` with clear names, and lesson L8 devotes one sentence to them and a highlight on the process tree diagram ("this is the trainer's service agent — it responds to the "Check" button"). In `lab-alpine`, the agent and the container terminal are separated so that `ps` inside the container still shows only the container's processes.

---

## Summary of the owner's requirements (for the scope of 09)

| Requirement | State in 09 | Findings |
|---|---|---|
| R1 priorities | the work plan puts practice ahead of the textbook, explainers and documentation | 18 |
| R2 documentation ladder | none | 11 |
| R3 explainers in every block | the bus and recording exist partially | 10 |
| R4 style: recomputation by parameter, rewinding | no determinism and no `run(params)` | 10 |
| R5 beauty | the terminal and color tokens are not assigned | 25, 26 |
| R6 isolation in Linux | the topics are tied to the container image; xattr on 9p; the kernel and packages are incomplete | 2, 3, 8, 9 |
| R7 containers: boundaries and the "VM vs container" experience | boundary facts are incomplete, the v86 experience is not verified | 9, 16 |
| R8 networks: protocols on real daemons | DNS in v86 is synthetic, there are no images for the protocol catalog | 6, 17 |
| R9 Kubernetes networking | impossible on a real kernel without the hybrid | 1, 8 |
| R10 reconciliation loop and your own controller | learner code is forbidden by the CSP | 4 |
| R11 multiple machines and the hybrid | none | 1, 15 |
| R12 three Kubernetes stages | no Terraform → Ansible path, cleanup, cost; MTU in a nested network | 13, 14 |

