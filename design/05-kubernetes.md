# 05. Kubernetes block: textbook, process explanations, documentation ladder, simulator and hybrid cluster, real stage

Document for the "Kubernetes platform engineer" role. It designs the fifth step of the checklist ("Kubernetes — only after confident Docker: pods, deployments, services, ingress, helm") and takes it to the level at which a person passes a junior interview and an experienced programmer passes the CKA. Design date: 18.11.2026; second revision after reviews 03 and 09 — same date. Versions and prices were checked against this date; how they are re-checked is described in section 16.

The block's priorities are set by the owner (R1) and determine the order of sections: first the textbook with a strict order of concepts (sections 3–4), then process explanations (section 6), then the habit of reading documentation (section 7). The simulator, the hybrid cluster, the trainers, the exams and the real stage (sections 5, 8–11) rest on these three pillars and exist so that the theory can be touched with one's own hands.

## 0. Key decisions in one place

1. **We do not run Kubernetes entirely in the browser; we build a hybrid.** kube-apiserver, kubelet and etcd do not build for wasm: they need system calls, sockets and a file system that the browser does not have; the author of Webernetes tried this path and abandoned it ([ngrok blog, 30.06.2026](https://ngrok.com/blog/i-ported-kubernetes-to-the-browser)). kwok does not fit either: it simulates nodes and pods, but it needs real etcd, apiserver, scheduler and controller-manager next to it ([kwok architecture](https://kwok.sigs.k8s.io/docs/design/architecture)). k3s does not fit into v86 for two reasons: it is not built for i386 (the official builds are amd64, arm64 and 32-bit armhf, while v86 emulates only x86), and the control plane needs more memory than the guest's 96–128 MB. Therefore the control plane is our kube-lite simulator in TypeScript, and the nodes can be real v86 Linux machines with our `dt-kubelet` agent, which runs pods via `crun` in real namespaces and cgroups (section 5.9). The scenario chooses a `sim` or `v86` backend for each node; on weak devices the same lesson runs on `sim`.
2. **kube-lite is a module of the shared `sim.worker.ts`, not a separate worker, and it shares the network with the "Networks" block.** A store with etcd semantics (resourceVersion, watch, MVCC), a subset of the API server with validation against v1.37 OpenAPI schemas, controllers as real reconcile loops, a scheduler with real filters and messages. The pod and node network consists of `netlab` devices (03, decision 2): `cni-lite` is a plugin that on `ADD` creates a netns, veth and routes in netlab; `kube-proxy-lite` is a controller that writes rules into the same netfilter model the learner saw in the "Networks" block; `coredns-lite` is a zone in the netlab DNS model. Pod containers are created by dsim (04). This way `iptables-save` on a Kubernetes node shows the same engine as in the NAT lesson. We take Webernetes (Apache-2.0) as a model for the double-run testing method and as a source of code for the pod lifecycle and probes; we do not take its network code: it emulates only HTTP and DNS ([github.com/ngrok/webernetes](https://github.com/ngrok/webernetes)).
3. **The Helm template engine is the only Go part in wasm.** Go `text/template` and sprig do not touch the system and compile to wasm; rewriting their semantics in TS (whitespace, `nindent`, `toYaml`, scopes) is more expensive and worse. The module is loaded lazily, budget 2.5 MB gzip.
4. **Incoming traffic is taught through the Gateway API, Ingress as legacy.** Ingress NGINX was retired in March 2026 ([kubernetes.io blog](https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/), [Steering and SRC statement](https://kubernetes.io/blog/2026/01/29/ingress-nginx-statement/)); the Gateway API has been part of the CKA curriculum since the 2025 update ([CKA program changes](https://training.linuxfoundation.org/certified-kubernetes-administrator-cka-program-changes/)). We show Ingress because it exists in almost every running cluster and interviewers ask about it.
5. **kube-proxy is shown in iptables and nftables modes, Cilium eBPF for the experienced learner.** iptables is what a person will see on most running clusters; nftables has been declared the main path; IPVS has been declared deprecated ([DevClass on v1.37](https://www.devclass.com/devops/2026/08/27/kubernetes-cleans-house-bins-legacy-kube-dns-ipvs-and-cgroup-v1/5292767)) — one sentence; the fact about the removal timeline is kept in `hold` until the release notes confirm it.
6. **Kubernetes networking is a separate textbook section of eight modules KN1–KN8** (R9), not one module. NetworkPolicy and external ingress moved into this section.
7. **Process explanations are a blueprint, not ink** (R4, R5, 08/5.1). Blocks, arrows, labels on lines, one idea per screen; animation only of the process itself; every element is clickable; sliders and switches recalculate the process immediately, and next to them it says what changed and why; steps can be flipped forward and back. The block's fifteen explanations are listed in section 6.
8. **The documentation ladder has five rungs per module** (R2, section 7). The trainer has its own mirror of kubernetes.io, helm.sh/docs and gateway-api.sigs.k8s.io for version v1.37 (external pages cannot be embedded: the platform CSP is `frame-src 'none'`, 09/6.4); `kubectl --help` is output in full, as in a real kubectl v1.37.
9. **GitOps in the simulator is Argo CD; Flux is theory and the real stage.**
10. **The real stage has three R12 stages** (section 11): the browser; one real node (k3s on one VM or kind/minikube/k3d on one's own computer) for all levels; a full kubeadm cluster on three VMs — a mandatory stage for all levels (01 §3.3), completed once, after the IaC block, as block B3 of document 06: Terraform orders the VMs, Ansible prepares the nodes, kubeadm is done once by hand inside B3. The beginner follows the full checklist with S0–S1 support, the intermediate learner follows a skeleton, the experienced learner starts from scratch (decision of master document 00 §10).
11. **Checks use the shared 09 contract: facts `dt.facts/v1` → predicates.** The block has no check vocabulary of its own; the block adds the fact areas `k8s.timeline` and `k8s.authz` to 09. At the real stage the `trainer-check` agent from 09/5.4 does the checking.
12. **Concepts are identifiers of the 01 graph** (`K01…`, `N…`, `D…`, `L…`, `C…`), the block's modules are `KM00…KM16` and `KN1…KN8`, so that module codes do not collide with concept codes. The block proposes adding missing concepts to the shared `concepts.yaml` (section 3.2). Terminal output is always real; fields with concepts not yet introduced are shown as "fog" (section 3.4).

## 1. Place of the block and entry requirements

The block is the sixth on the route (01/5): after Methodology, Linux, Networks, Docker and CI/CD. It opens only after the final Docker exam. No lesson of the block re-explains concepts from previous blocks; every lesson links to their glossary cards `[[id|words]]`.

| From | Concepts (identifiers from 01 and 02) | Where the block relies on them |
|---|---|---|
| Linux | L08 help (`man`, `--help`), L16 environment variables, L17 process, L18 signals, L23 systemd, L24 logs, L26 `/proc`/`/sys`, L27 kernel and system call, L31 YAML/JSON, L33 stream, L34 fork/exec, L35 namespaces, L36 cgroup v2, L37 OOM killer, L38 capabilities, L40 overlayfs, L41 seccomp, L42 PID 1, L43 process root | KM01 "a pod is processes", KM06 "requests and limits in cgroup", KM09 "securityContext is what you did by hand", KM15 kubelet and static pods |
| Networks | N01 interface and IP, N02 subnet/CIDR, N03 route and gateway, N04 port, N05 TCP/UDP, N06 ARP, N07 layer model, N08–N09 DNS and `resolv.conf`, N11 NAT, N12 ICMP, N13 socket and `ss`/`curl`, N14 HTTP, N15 TLS, N17 iptables/nftables, N18 SSH, N19 reverse proxy and load balancer, N20 veth and bridge, N21 network namespace; from module 03 "VPN and WireGuard" — the concept of a tunnel (a nested envelope), and for intermediate and experienced learners, WireGuard | the whole KN section; KN3 relies on the tunnel, KN6 on ARP and the reverse proxy, KN8 on the 03 method "first ask which layer broke" |
| Docker | D02 VM, D03–D06 container as a process with namespaces, cgroups and a root, D08–D09 image and layers, D10 chain docker CLI → dockerd → containerd → shim → runc/crun, D11 lifecycle, D12 port publishing as DNAT, D13 volumes, D14 environment, D18–D19 tag, registry, digest, D20 Docker networks, D21 Compose, D23 healthcheck; the six container boundaries from 04 (kernel, network, storage, processes and signals, I/O and logs, configuration and identity) | KM01 (pod versus `docker run`), KM03 (CRI relies on D10), KN1 (why there is no `-p` here), KM05, KM06, KM08 |
| CI/CD | C02 commit, C04 remote repository, C11 building and publishing an image in CI, C14 rollout strategies (rolling, canary, rollback) | KM03 (rolling update as a strategy from C14), KN6 (HTTPRoute weights as canary), KM12 GitOps, stage 2 of the real stage (an image from the learner's CI) |

How the container boundaries from 04 continue into Kubernetes — a cross-cutting table on which the "bridge scenes" in the modules are built:

| Boundary (04) | What Kubernetes does | Module | How the learner sees it |
|---|---|---|---|
| Host kernel | all pods of a node share the node's kernel; the pod sandbox holds shared net and ipc | KM01 | `lsns -p <pid>` on the node: pause and `web` have the same net and ipc, different mnt and pid |
| Network | a pod has its own IP without port forwarding; a Service is DNAT on the node | KN1–KN4 | `ip -n <netns> addr`, `iptables-save -t nat` |
| Storage | the upper overlay layer lives with the container; emptyDir with the pod; a PVC longer than the pod | KM05, KM08 | a file disappears after a container restart but stays in emptyDir and in the PVC |
| Processes and signals | `terminationGracePeriodSeconds` = SIGTERM → wait → SIGKILL; `preStop` | KM06 | the kubelet log and `kill -l` in the pod |
| I/O and logs | `kubectl logs` reads CRI files on the node | KM01 | `ls /var/log/pods/…` on the node |
| Configuration and identity | env, ConfigMap, Secret as files, `runAsUser`, capabilities, seccomp | KM05, KM09 | `grep -E 'Cap|Seccomp|Uid' /proc/<pid>/status` |

Technically the block uses shared platform components: the terminal (08/3.4, xterm.js), the shell and FS Stand from the Linux block (`cat <<EOF`, a `vi`-like editor, `grep`, `base64`, `jq`), netlab (03), dsim and the course registry (04/7.6), v86 with the `dt-kernel` kernel (09/1.4), the checks contract (09/2), connecting one's own AI model (09/4).

## 2. Levels and checks

The block's levels are L0, L1, L2 as defined in 01/4.3: L0 — confident Docker, has never seen a cluster; L1 — has done `kubectl apply` following instructions; L2 — deploys at work, does not know the control plane, Service networking, RBAC, debugging. The table of L1 and L2 entry-check tasks is one per course and lives in 01/4.3; the criterion is also shared from 01 ("80 % and the key tasks", a confidence mark, a repeat after 72 hours). This section describes what the block puts into the check and proposes replacements to the author of 01 where the 05 tasks are stronger.

### 2.1. Readiness check (for L0)

This is not a Kubernetes level check: beginners are not given one (01/4.1). It is triggered by skipping the final Docker exam — if a person came to the block without passing it. Failing sends them to the Docker and Networks lessons, as in 04/9.1.

| # | Type | Task | Check | Concept |
|---|---|---|---|---|
| G1 | choice | How does an image differ from a container? (a) an image is a running process; (b) an image is an immutable set of layers and settings, a container is a process started from it; (c) they are the same thing | answer (b) | D08, D06 |
| G2 | practice | Run the container `trainer/web:1.0` so that the page opens on host port 8080 | `containers[image~'trainer/web:1.0'][state=running].ports~'8080->80/tcp' && http.web.status=200` | D12 |
| G3 | find the line | In the YAML the `ports` key has an indentation error | line number | L31 |
| G4 | choice | `dig web.` on a machine where the name `web` is not described anywhere. What is in the `status` field? | `NXDOMAIN` | N09 |
| G5 | practice | Find the process listening on port 80 and enter its PID | the value matches `net.listen[port=80].pid` | N13 |
| G6 | choice | On a server `ss -ltn` shows `0.0.0.0:80` and `0.0.0.0:8080`. What does this mean? (a) two listening sockets on one IP, reached via different ports; (b) the machine has two IP addresses; (c) it is one and the same socket | answer (a) | N13 |

### 2.2. What the block proposes for the L1 and L2 checks (01/4.3)

| Task from 05 | What it replaces in 01 | Why it is stronger |
|---|---|---|
| I3: in namespace `shop`, Deployment `web` with 3 replicas and Service `web` ClusterIP:80; from pod `client`, `curl http://web.shop` → 200 | L1-1 | checks not only the objects but also the request path |
| I4: Service `api` in `prod` does not respond (selector `app: api`, pods have `app: api-v2`); fix it without recreating the pods | complements L2-1 | `keep` on pod uids distinguishes fixing the service from recreating the pods |
| E2: take `worker-2` into maintenance without downtime (3 replicas, PDB minAvailable 2) | new for L2 | checked against the `k8s.timeline` log, not the final state |
| E5: StatefulSet `db-0` does not start, the PVC is Pending because of a non-existent StorageClass; fix it without deleting the StatefulSet | new for L2 | a typical storage gap |

Tasks 01 L2-5 (assemble the `kubectl apply` path from blocks) and L2-6 (rubric "where does the Service IP live") are stronger than my I1 and E6 and stay as in 01. The confidence mark and the repeat after 72 hours are shared 01 mechanisms.

### 2.3. What a person can do at the end of the block

- **L0 (beginner).** Explains why orchestration is needed and how the reconciliation loop works; deploys an application from a ready image, gives access to it by name and from outside, scales, updates and rolls it back; reads `describe`, `logs` and events; finds ImagePullBackOff, CrashLoopBackOff, Pending and "the pod could not reach the service" using the layer ladder; explains what happens when a node fails; installs k3s on one node, installs a Helm chart there and exposes it through a Gateway.
- **L1.** Plus configuration, probes, resources and HPA, all workload types, storage, the Gateway API, NetworkPolicy, RBAC basics, Helm and Argo CD; systematic troubleshooting; a kubeadm cluster of three VMs in the basic part.
- **L2 and the experienced programmer.** CKA level: a kubeadm cluster with Cilium, certificates, etcd backup and restore via `etcdutl`, a minor version upgrade, repairing the control plane and a node, advanced scheduling, NetworkPolicy with namespaceSelector, one's own controller for one's own CRD.

## 3. Order of introducing concepts

### 3.1. The canonical order

The source of truth is the shared graph `content/concepts.yaml` (01/6.1). Below is the order in which the block introduces Kubernetes concepts. It is also proposed as the canon for 01 and for storyboard 08/6.4 (one "Kubernetes from blocks" storyboard per course, owned by 08; 05 sets its order and the table of consequences, section 6.2). Principle: show first, then explain — the pod appears in KM01, and the question "who chose the node and who started the process" introduces the scheduler and the kubelet in KM03.

| # | Concept | ID | Module | Requires |
|---|---|---|---|---|
| 1 | Cluster and node | K01 | KM00 | F06, D06 |
| 2 | Desired and actual state | K02 | KM00 | F11, L31 |
| 3 | Pod | K09 | KM01 | K01, D06, D03 (**change to 01**: without K08) |
| 4 | API server and object: apiVersion, kind, metadata, spec, status | K04 | KM01 | K02, N14 |
| 5 | `kubectl`, kubeconfig, context (one scene "where kubectl knocks") | K05 | KM01 | K04, L16 |
| 6 | Status, conditions, events | K34 (new) | KM01 | K04 |
| 7 | Labels and selectors | K10 | KM02 | K04 |
| 8 | Kubernetes namespace (versus D03 and N21) | K13 | KM02 | K04, D03 |
| 9 | Controller and reconciliation loop | K03 | KM02 | K02 |
| 10 | ReplicaSet | K11 | KM02 | K03, K09, K10 |
| 11 | etcd | K06 | KM02 | K04 |
| 12 | ownerReferences and garbage collection | K44 (new) | KM02 | K11 |
| 13 | watch and informer | K43 (new) | KM02 | K03, K06 |
| 14 | Deployment: rolling update, rollback | K12 | KM03 | K11, C14 |
| 15 | Scheduler | K07 | KM03 | K01, K04, K09 |
| 16 | kubelet and container runtime (CRI) | K08 | KM03 | K09, D10 (**change to 01**: after K09) |
| 17 | Pod sandbox (pause) | K45 (new) | KM03 | K08, D03 |
| 18 | The whole control plane, controller-manager | K27 | KM03 | K03, K06, K07, K11 |
| 19 | Network model and CNI | K26 | KN1 | K09, N03, N20, N21 (**change to 01**: earlier than RBAC) |
| 20 | Service ClusterIP and EndpointSlice | K14 | KN4 | K09, K10, N19 |
| 21 | EndpointSlice as an object (Endpoints is deprecated) | K35 (new) | KN4 | K14, K03 |
| 22 | kube-proxy | K15 | KN4 | K14, N17 |
| 23 | Cluster DNS (CoreDNS) | K16 | KN5 | K14, N08 |
| 24 | NodePort and LoadBalancer | K17 | KN6 | K14, N11 |
| 25 | Ingress and the ingress controller | K18 | KN6 | K14, N19 (**change to 01**: N19 instead of N15; TLS is in KM05) |
| 26 | Gateway API | K38 (new) | KN6 | K18 |
| 27 | NetworkPolicy | K39 (new) | KN7 | K10, K13, K26 |
| 28 | ConfigMap and Secret | K19 | KM05 | K09, D14 |
| 29 | Pod volume (volume, emptyDir, projected) | K36 (new) | KM05 | K09, D13 |
| 30 | Probes | K21 | KM06 | K09, D23 |
| 31 | Requests and limits, QoS | K22 | KM06 | K07, L36, L37 (**change to 01**: L36/L37 instead of D04) |
| 32 | metrics-server and HPA | K37 (new) | KM06 | K22, K12 |
| 33 | DaemonSet, Job, CronJob | K24 | KM07 | K11, L28 |
| 34 | StatefulSet and headless Service | K23 | KM07 | K12, K16, K36 (headless is introduced in KN5; `volumeClaimTemplates` in KM08, **change to 01**: K20 is not required) |
| 35 | PersistentVolume, PVC, StorageClass | K20 | KM08 | K09, K36 |
| 36 | RBAC: ServiceAccount, Role, RoleBinding | K25 | KM09 | K04, K13, L10 |
| 37 | Cluster users: certificate, CSR, kubeconfig with several users | K47 (new) | KM09 | K05, K25, N15 |
| 38 | securityContext and Pod Security Admission | K48 (new) | KM09 | K25, L38, L41 |
| 39 | Taints/tolerations, affinity, topology spread | K40 (new) | KM10 | K07 |
| 40 | cordon, drain, PDB | K41 (new) | KM10 | K40 |
| 41 | Helm | K28 | KM11 | K12, K19 |
| 42 | Kustomize | K42 (new) | KM11 | K04 |
| 43 | GitOps | K29 | KM12 | K03, K28, C04 |
| 44 | CRD and operator | K30 | KM13 | K03, K04 |
| 45 | Cloud VM | K31 | KM14 | D02, N17, N18 |
| 46 | Static pod | K46 (new) | KM15 | K08, K27 |
| 47 | kubeadm installation, control plane PKI | K32 | KM15 | K26, K27, K31, K46, N15 |
| 48 | Debugging: `describe`, `logs`, events, typical statuses | K33 | KM01 → KM16 | spiral: introduced in KM01, closed in KM16 |

### 3.2. Proposed changes to the 01 graph

1. `K09 Pod` requires `K01, D06, D03`, and `K08 kubelet` requires `K09, D10`. Reason: a beginner needs a visible object before the question "who started it".
2. `K26 CNI` moves before RBAC and requires `K09, N03, N20, N21`: pod networking is the first half of the networking section.
3. `K18 Ingress` requires `N19` (reverse proxy), not `N15`; TLS on the Gateway is introduced by a return in KM05, once Secret exists.
4. `K23 StatefulSet` requires `K36` instead of `K20`: volumes from PVCs appear in KM08 as a continuation of StatefulSet.
5. `K22 requests/limits` requires `L36, L37` from the updated 02 (cgroup v2 and OOM killer), not D04.
6. `K29 GitOps` requires `C04`, not `C05`: synchronization needs a remote repository; code review is not required.
7. New concepts K34–K48 from table 3.1. The numbers are a proposal; if the author of 01 assigns others, the block will accept them without changing the order.

### 3.3. Ordering rules inside the block

- **One concept per screen** (01/8). A screen declares `introduces` (no more than one concept) and `uses`; the linter checks the screen text, the task, the hints, the error analysis and the AI context.
- **Homonyms.** The first K13 screen contrasts three "namespaces": the Linux namespace (L35/D03), the network namespace (N21) and the Kubernetes namespace — a folder for API objects that isolates nothing in the kernel. KN2 recalls this contrast once more.
- **Terms from other levels.** VXLAN by name is introduced only from L1; in KN3 the beginner gets an "envelope inside an envelope" based on the tunnel concept from 03. `ndots` and search domains are L1 and L2 (as in 03 "DNS"). eBPF is L2 only, with its own introductory scene "a program in the kernel instead of rule chains". The control plane taint is not shown in KM03: KM03 scenarios run on a cluster where the control plane has no taint (the k3s default), and the `untolerated taint` message appears in KM10.
- **Looking ahead** (`forward: [...]`) is allowed no more than once per lesson, as in 01/6.1.

### 3.4. Output fog

Simulator and hybrid output is always real and complete: `kubectl describe pod` in KM01 prints `Namespace:`, `Node:`, `QoS Class: BestEffort`, `Tolerations: node.kubernetes.io/not-ready:NoExecute op=Exists for 300s`, and the events show `default-scheduler … Successfully assigned`. Lines must not be hidden: the learner will later see them on a real cluster. The rule (shared by blocks 02–06, implemented in the `terminal` from 08/3.4): lines and fields with concepts not yet introduced are drawn in the muted color `--c-fog` with a dotted underline. A click opens the card "this is <term>, covered in module N; you can skip reading this field for now". The linter treats such lines as allowed (`fog: true`) but forbids mentioning them in the lesson text, the task, a hint and an AI answer. The list of fog fields is taken from `concepts.yaml`: word forms plus JSONPaths of object fields (`spec.tolerations` → K40, `status.qosClass` → K22, `metadata.namespace` → K13).

## 4. Textbook: the block's curriculum

### 4.1. Modules

Every module is built the same way (01/7): a line of exposition made of screens (4.3), each screen with one concept and a process explanation tied to it (section 6), practice in the terminal right inside the scene, a rung of the documentation ladder (section 7), trainers (section 8), a quiz (section 9). Depth: "full" — the whole module; "base" — the main line without deep-dive screens; "fast" — a compressed "what's new" summary with a check and practice without step-by-step hints; "—" — the module is not included.

| Module | Concepts | Explanations | L0 | L1 | L2 |
|---|---|---|---|---|---|
| KM00. Why orchestration | K01, K02 | "Manual dispatcher" (4.2) | full | fast | fast |
| KM01. The first pod | K09, K04, K05, K34, K33 (start) | E1 (first part: up to the write to etcd) | full | base | fast |
| KM02. Labels and reconciliation | K10, K13, K03, K11, K06, K44, K43 | E2 (screens 1–3, 5a) | full | full | base |
| KM03. Deployment, scheduler, kubelet | K12, K07, K08, K45, K27 | E3, E4, E5, E1 in full, E2 (screen 4) | full | full | base |
| **Section "Kubernetes networking"** | | | | | |
| KN1. Network model | K26 | E6 (screen 1) | full | full | fast |
| KN2. Pod to pod on one node | — (application of N20, N21) | E6 (screen 2) | full | full | fast |
| KN3. Pod to pod across nodes | — (tunnel; VXLAN, BGP, WireGuard for L1/L2) | E6 (screens 3–5) | base (without BGP) | full | full |
| KN4. Service | K14, K35, K15 | E7 | full | full | full |
| KN5. Cluster DNS | K16 | E9 | full (without ndots) | full | full |
| KN6. Ingress from outside | K17, K18, K38 | E8 | base | full | full |
| KN7. NetworkPolicy | K39 | E10 | — | full | full |
| KN8. The "pod could not reach" method | — (cross-cutting layer ladder) | E7 and E9 in "break it" mode | full | full | full |
| KM05. Configuration and volumes | K19, K36 | scene "how a ConfigMap file appears in a pod" (no separate E) | full | full | base |
| KM06. Health and resources | K21, K22, K37 | E11, return to E7 (readiness) | full | full | full |
| KM07. Workload types | K24, K23 | return to E5 (StatefulSet on node failure) | Job/CronJob | full | full |
| KM08. Storage | K20 | E12 | base | full | full |
| KM09. Access and security | K25, K47, K48 | E13 | ServiceAccount and `auth can-i` | full | full |
| KM10. Scheduling and maintenance | K40, K41 | return to E3 (taints, affinity), return to E5 (drain) | — | base | full |
| KM11. Helm and Kustomize | K28, K42 | E14 | install, upgrade, rollback | full | full |
| KM12. GitOps | K29 | E15 | — | full | full |
| KM13. Extending the API | K30 | E2 (screen 5b: operator) | — | full | full |
| KM14. One real node (stage 2) | K31 | — (checklist 11.3) | full | full | fast |
| KM15. Full kubeadm cluster (stage 3, done in block B3 after IaC — 06 §6) | K46, K32 | the builder as a diagram of what was installed (6.2, screen 5) | full, by checklist with S0–S1 support | full, by skeleton | full, from scratch |
| KM16. Troubleshooting practicum and exams | K33 (closing) | all "break it" modes | exam B | exam I | exam E |

The order KM05–KM10 is strict only as far as the graph requires; the trainer offers exactly this sequence because each module uses the previous ones in practice: HPA needs requests from KM06, StatefulSet in KM07 relies on the headless Service from KN5, KM08 continues StatefulSet.

Networking comes right after KM03, before configuration: a Service is needed for any practice further on, and the network model relies on veth and netns, which are still fresh for the learner from the "Networks" and Docker blocks. NetworkPolicy sits in the networking section, not in "security", because it works at the CNI level and its breakages are hunted down with the same layer ladder as Service breakages.

### 4.2. KM00 without a single Kubernetes term

The "Manual dispatcher" scene: three servers and five containers; the learner places them by drag and drop, taking memory into account. Then one server goes dark, and the learner manually moves its containers without overfilling the remaining ones. Then an "upgrade to version 2" arrives, which has to be rolled out one by one without bringing down the service. A timer shows how long each step took. At the end the trainer does the same thing automatically in a second and names the three things the person just did by hand: chose a place (this will be the scheduler), made sure everything was running (this will be the controller), kept in mind the list of "what should be running" (this is the desired state, K02). There are no points: only time measurement and the final diagram.

### 4.3. Lines of exposition for the modules

Each line below is a screen. In parentheses: the concept introduced, the process explanation, the documentation rung for L0 (for L1 and L2 the rungs shift according to rule 7.3).

**KM01. The first pod.**
1. "Kubernetes accepts a description, not a command" (—; rung 1: link to kubernetes.io *Concepts → Overview*). A comparison of `docker run` and a note "I want the web container to be running".
2. "A pod is the smallest unit Kubernetes runs" (K09). A pod is one or more containers with a shared network; control question "two containers of a pod on port 80 — is that possible?" (no: there is one `localhost`).
3. "Where kubectl knocks" (K05). `kubectl config view --minify`: server address, user, context. One scene, without RBAC; from then on `--context` is present in all exams.
4. "API object" (K04). `kubectl run web --image=trainer/web:1.0 --dry-run=client -o yaml`: apiVersion, kind, metadata, spec; `kubectl explain pod.spec.containers` (rung 1 — the highlighted "where this comes from" line).
5. "Status and events" (K34). Pod phases, conditions, `kubectl describe`, the Events section; E1 goes up to the write to etcd and stops at the question "and who's next?".
6. "A pod is processes" (—, bridge to L35, D06). On a hybrid node: `ssh worker-1`, `ps -ef | grep web`, `lsns -p <pid>`: net and ipc are the same for pause and web. If the node is `sim`, the same command works in the node's mini-shell on top of the Stand model.
7. "Where `kubectl logs` comes from" (K33 start). `ls /var/log/pods/default_web_<uid>/web/` on the node; a line in CRI format `<time> stdout F <text>`.
8. "A pod without an owner is mortal". `kubectl delete pod web` — the pod is gone forever; a bridge question to KM02.

**KM02. Labels and reconciliation.**
1. "Labels" (K10): `--show-labels`, `-l app=web`, a selector as a query.
2. "Kubernetes namespace" (K13): the contrast with the three "spaces" (3.3); `-n`, `-A`.
3. "Controller" (K03): E2 screens 1–2 (desired on the left, actual on the right, the loop in the middle).
4. "ReplicaSet" (K11): `kubectl apply` of a ReplicaSet with 3 copies, deleting a pod, it comes back.
5. "Where the desired state lives" (K06): E2 screen 0, the record `/registry/replicasets/default/web`, `resourceVersion` growing; for L2 — `etcdctl get /registry/pods --prefix --keys-only` in the training kubeadm cluster.
6. "Who owns whom" (K44): `ownerReferences`; someone else's pod with matching labels gets adopted, a removed label orphans the pod; `--cascade=orphan`.
7. "Why a missed event is not a problem" (K43): E2 screen 3, the informer and the key queue.
8. "Your first loop" (—): E2 screen 5a, the learner writes the remaining three lines of the `team-info` controller.

**KM03. Deployment, scheduler, kubelet.**
1. "A ReplicaSet cannot change the version": `set image` on a ReplicaSet does not touch live pods.
2. "Deployment" (K12): the owner of ReplicaSets, `kubectl get deploy,rs,pods`; link to C14 ("the same rolling rollout you did with a script in CI/CD, only now a controller does it").
3. E4 "Rolling update" with sliders; rung 2 — a fragment of `kubectl rollout undo --help`, the Examples section, with `--to-revision` highlighted.
4. "Who chose the node?" (K07): E3 screens 1–3.
5. "Who started the process?" (K08): kubelet and CRI; relies on D10 ("containerd from the Docker block; the kubelet talks to it over CRI").
6. "The pod sandbox" (K45): pause holds net and ipc; on the hybrid, `crun list` on the node shows pause and the container.
7. "Control plane and nodes" (K27): the builder (6.2) with a reduced set and E1 in full, 14 steps.
8. E5 "A node went down"; E2 screen 4 "chain of loops".

**KN1. Network model.**
1. "How it was in Docker" (—): `-p 8080:80` as DNAT (D12) and why this is not possible in a cluster of hundreds of pods (port conflicts, the node address instead of the application address).
2. "The rules of the model" (K26): verbatim from the *Cluster networking* page: a pod has its own IP; pods communicate with each other without NAT; node agents communicate with the pods on their node; a pod sees its own address the same way others see it. Rung 1: link to this page.
3. "The IP belongs to the pod, not the container": all containers of a pod are in one netns, with a shared `localhost`.
4. "Who carries out the rules — CNI": the `ADD`/`DEL` contract, `/etc/cni/net.d`, `/opt/cni/bin`, IPAM, the node's podCIDR (`kubectl get node worker-1 -o jsonpath='{.spec.podCIDR}'`). E6 screen 1.
5. "Break the CNI": the node is `NotReady`, `cni plugin not initialized`, pods in `ContainerCreating` with `FailedCreatePodSandBox`.

**KN2. Pod to pod on one node.**
1. A reminder about homonyms: a Linux network namespace is not a Kubernetes namespace.
2. E6 screen 2: the pod's default route to `10.42.0.1`, ARP over the `cni0` bridge, the frame through the bridge. On the hybrid — `ip -n <netns> addr`, `bridge fdb show br cni0`, `tcpdump -i cni0`.
3. Practice: trainer N-D1.

**KN3. Pod to pod across nodes.**
1. "A node is the router of its pod subnet": host-gw, `ip route` on the node `10.42.1.0/24 via 192.168.56.12`.
2. "When nodes are in different subnets — an envelope inside an envelope": for L0 without the protocol name, based on the tunnel from 03; for L1 — VXLAN, UDP 8472, VNI, MTU 1450.
3. "Direct routing with BGP" (L1/L2): the network router learns the podCIDR via BGP (Calico, Cilium native routing).
4. "Going outside": SNAT/MASQUERADE to the node IP for addresses outside `10.42.0.0/16` — the answer to "why does an external service see the node's IP".
5. "Encryption between nodes" (L1/L2): WireGuard (flannel `wireguard-native`, Cilium).
6. E6 screens 3–5 with switches for the delivery method, MTU and "nodes in different subnets"; "break it": close UDP 8472 with the cloud firewall.

**KN4. Service.**

| Screen | introduces | Explanation | Documentation (L0) |
|---|---|---|---|
| 1. Pods are mortal, addresses change | — | E7 preparation: "delete a pod" — the IP changed | rung 1: *Pod lifecycle* |
| 2. A Service is a permanent name and address | K14 | E7 screen 1 | rung 1: *Service* |
| 3. Who knows the pod addresses | K35 | E7 replicas slider; `kubectl get endpointslices -l kubernetes.io/service-name=web`; `kubectl get endpoints` prints the real deprecation warning | rung 2: a fragment of `kubectl explain endpointslice.endpoints.conditions` |
| 4. An address that does not exist | — | `ip a` on the node does not show the ClusterIP (for L2 — the IPVS exception: `kube-ipvs0`) | — |
| 5. Who substitutes the address | K15 | E7 kube-proxy mode switch | rung 2: a fragment of *Virtual IPs and Service Proxies* |
| 6. Find the rule yourself | — | `iptables-save -t nat | grep <ClusterIP>` on the node; trainer N-D2 | rung 2 |
| 7. Why load balancing is uneven | — | E7 keep-alive switch (conntrack) | rung 3: find `sessionAffinity` (F06) |
| 8. Break it and fix it | — | E7 "break it": selector, `targetPort`, kube-proxy stopped | — |

**KN5. Cluster DNS.**
1. "The Service name" (K16): `<svc>.<ns>.svc.cluster.local`; CoreDNS at `10.43.0.10`.
2. "A short name is expanded to the full one": the pod's `/etc/resolv.conf`, the `search` list. For L0 — only this.
3. "The cost of ndots" (L1/L2): E9.
4. "Headless Service": several A records with pod IPs; the StatefulSet pod name `db-0.db.<ns>.svc.cluster.local` (prepares KM07).
5. "Corefile" (L1/L2): `kubernetes cluster.local`, `forward . /etc/resolv.conf`, `cache 30`; "break it": remove `forward`.
6. `dnsPolicy`, `dnsConfig` (L2); trainer N-D3.

**KN6. Ingress from outside.**
1. NodePort (K17): range 30000–32767, `KUBE-NODEPORTS`.
2. `externalTrafficPolicy: Cluster | Local` — E8 screen 2.
3. LoadBalancer: the cloud controller-manager, ServiceLB in k3s, MetalLB L2 (a node answers ARP for the external IP; L2 — BGP mode in one sentence).
4. Ingress (K18): the history of ingress-nginx; rules by host and path; the controller is the reverse proxy from N19.
5. Gateway API (K38): GatewayClass, Gateway, HTTPRoute and the separation of roles; backend weights as canary from C14.
6. E8 in full: the path from the client to the pod, 502 and 504 on the ingress controller.

**KN7. NetworkPolicy** (L1, L2).
1. "By default everything is open".
2. "A policy selects pods and only allows" (K39); `policyTypes`; policies add up.
3. "AND" and "OR" in selectors — E10, the "AND/OR" button.
4. "Egress without DNS breaks all names".
5. "The CNI enforces the policy": flannel does not enforce it by itself (in k3s — the built-in kube-router), Calico and Cilium enforce it; Cilium L7 — L2 in one scene. Trainers N-D6, N-D7.

**KN8. The "pod could not reach" method.** The layer ladder, a direct continuation of the networking principle "first ask which layer broke" (R8): DNS (`nslookup` from the pod) → Service (ClusterIP, port) → EndpointSlice (are there ready addresses) → pod (`curl <podIP>:<targetPort>`, is the process listening `ss -ltn`) → NetworkPolicy (does a policy select the pod) → node and CNI. For each rung — what is visible when it breaks there. Trainer N-D8 with a random breakage.

**KM05. Configuration and volumes.**
1. ConfigMap (K19) from a literal and a file; env and envFrom.
2. Pod volume (K36): emptyDir, configMap, secret, projected; link to the "storage" boundary from 04: the upper overlay layer lives with the container, emptyDir with the pod.
3. "How a ConfigMap file appears in a pod": the kubelet writes files into a directory on the node and mounts it; the file is updated with a delay, while env is not updated without a restart.
4. Secret: base64 is only the representation in the API; by default values are stored in etcd unencrypted (L2: `etcdctl get /registry/secrets/default/x | hexdump -C` and encryption at rest).
5. Return to KN6: TLS on the Gateway from a Secret.

**KM06. Health and resources.**
1. Probes (K21): liveness, readiness, startup; return to E7 — readiness removes the pod from the EndpointSlice without restarting it.
2. "Requests and limits in cgroup" (K22, bridge to L36): E11, `cat …/memory.max` on the node → `268435456`; `cpu.max` → `50000 100000` for `500m`; `requests.memory` is not limited by the kernel — it is taken into account by the scheduler and eviction.
3. OOMKilled (bridge to L37): `memory.events oom_kill 1` next to `Reason: OOMKilled`, code 137.
4. CPU throttling: `cpu.stat nr_throttled`.
5. QoS classes and the eviction order when the node runs out of memory.
6. LimitRange and ResourceQuota (L1/L2).
7. metrics-server and HPA (K37); "break" metrics-server — `<unknown>/50%`.
8. Pod termination (bridge to L42 and the "processes and signals" boundary): SIGTERM, `terminationGracePeriodSeconds`, SIGKILL; `preStop` appears only as a rung 4 task (X02).

**KM07. Workload types.**
1. Job (K24): completions, parallelism, backoffLimit.
2. CronJob: a schedule from `cron` (L28), `concurrencyPolicy`.
3. DaemonSet: one pod per node, a toleration for the control plane taint — under fog until KM10 with a `forward: [K40]` card.
4. StatefulSet (K23): ordering, stable names, pod DNS names from KN5; data is in emptyDir for now, `volumeClaimTemplates` is the first screen of KM08; return to E5 — a replacement `db-0` is not created until the previous one is declared dead.

**KM08. Storage.** The first screen returns to the StatefulSet from KM07: emptyDir loses data when the pod moves, a volume that outlives the pod is needed. PV, PVC, StorageClass (K20), `volumeClaimTemplates`; static and dynamic provisioning; access modes; reclaimPolicy; `WaitForFirstConsumer`; volume expansion. E12.

**KM09. Access and security.**
1. E13 "the request path through authn → authz → admission".
2. ServiceAccount and the pod token (K25), `kubectl auth can-i`.
3. Role and RoleBinding, ClusterRole; the RBAC matrix.
4. Users (K47): certificate, CSR, `certificate approve`, kubeconfig with two users (L1/L2).
5. "securityContext is what you did by hand" (K48, bridge to L38, L41, L35): `capabilities.drop: [ALL]` → `grep Cap /proc/<pid>/status` and `capsh --decode`; `runAsUser: 1000` → the process UID from outside; `seccompProfile: RuntimeDefault` → `Seccomp: 2`.
6. Pod Security Admission: the privileged, baseline, restricted levels; a rejection with the real message.

**KM10. Scheduling and maintenance.** nodeSelector, affinity and anti-affinity, taints and tolerations (K40) — return to E3 with taint and anti-affinity switches; topologySpread (L2); cordon, drain, PDB (K41) — return to E5: drain respects the PDB, while eviction by the `unreachable` taint does not; priority and preemption (L2).

**KM11. Helm and Kustomize.** Chart, values, release (K28), `install/upgrade/rollback/template`, where Helm stores history (Secret `sh.helm.release.v1.*`); writing one's own chart (L1/L2); Kustomize overlays (K42). E14.

**KM12. GitOps.** The pull-instead-of-push principle (K29), Argo CD Application, sync, auto-sync, prune, selfHeal, drift; Flux — a comparison scene. E15.

**KM13. Extending the API.** A CRD with a schema, a custom resource, the status subresource; CEL validation only as a rung 4 task (X09); the operator — E2 screen 5b; a bridge to a Go pet project (kubebuilder).

**KM14 and KM15** are stages 2 and 3 of the real stage, section 11. **KM16** is the troubleshooting practicum and the exams, sections 8 and 10.

## 5. The kube-lite simulator and the hybrid cluster

### 5.1. What already exists and why it does not fit as is

| Solution | How it works | Why we do not take it whole |
|---|---|---|
| Killercoda, KodeKloud, iximiuz Labs | Real VMs on a server (iximiuz uses Firecracker micro-VMs, [docs](https://labs.iximiuz.com/docs/playgrounds/what-are-playgrounds)), a web terminal | A server farm and money for every learner; they do not let you visualize the internals. A benchmark for task quality |
| kwok | A controller that simulates nodes and pods on top of a real apiserver and etcd | Needs a real control plane; we take the Stage format for failure scenarios ([stages configuration](https://kwok.sigs.k8s.io/docs/user/stages-configuration/)) |
| Webernetes | A partial port of Kubernetes to TypeScript: kubelet, scheduler, Deployment/Namespace controllers, kube-proxy; the network is emulated only at the HTTP and DNS level; 204 integration tests run both on k3s and on it | No kubectl, ConfigMap, Secret, volumes, resources, RBAC, Job, StatefulSet, real networking; the API is experimental. We take the double-run method and the pod lifecycle and probe code under Apache-2.0 |
| k8sgames | A Three.js game simulating 25 resources | A game, not a learning tool; its list of "incidents" is useful as a catalogue of breakages |
| kube-apiserver/etcd in wasm | — | Does not build because of system calls; even a Go "hello world" in wasm weighs about 540 KiB gzip |
| k3s in v86 | — | Does not build for i386, guest memory of 96–128 MB is too small for the control plane; the solution is the hybrid (5.9) |

### 5.2. Architecture

kube-lite is a module of the shared `sim.worker.ts` worker (09/1.3), loaded into it when the learner enters the block. The interface subscribes to watch just like a real client; the diagrams receive events through the shared `SimEvent` bus (08/3.0).

```
main thread                          sim.worker.ts
───────────                          ─────────────────────────────────────────────────
xterm.js ─► kubectl-lite (parser) ─► apiserver-lite
diagrams, builder ◄── SimEvent ◄────┤ authn (certificate from kubeconfig / SA token)
switch diagram (hybrid, 5.9)        │ authz (RBAC) → k8s.authz facts
                                    │ mutating admission (defaults, LimitRange, SA, DefaultTolerationSeconds)
                                    │ validation (OpenAPI v3 v1.37, CEL subset)
                                    │ validating admission (Quota, PSA, CRD schema)
                                    │ store (MVCC: resourceVersion, watch, log → k8s.timeline)
                                    controllers: deployment, replicaset, endpointslice, job, cronjob,
                                      daemonset, statefulset, namespace, garbage-collector, pv-binder,
                                      local-path-provisioner, hpa, node-lifecycle, serviceaccount,
                                      argocd-lite, learners' operators (QuickJS, 6.3)
                                    kube-scheduler-lite (filter → score → bind)
                                    node × N, backend = sim | v86
                                      sim: kubelet-lite → cri-lite → dsim (container = Stand process)
                                      v86: dt-kubelet in the guest (5.9)
                                    network: netlab (node = netlab host; pod netns, veth, cni0, routes, VXLAN)
                                      cni-lite = plugin over netlab; kube-proxy-lite = netfilter rule generator
                                      coredns-lite = zone of the netlab DNS model; metrics-server-lite
                                    virtual clock (×1, ×10, ×60, pause, step)
```

The store reproduces the essentials of etcd: every object has a `resourceVersion` from a shared monotonic counter; every change has a log entry; watch with a `resourceVersion` returns events from the given point; optimistic locking returns a real `Conflict` on a stale version. The log is kept in full for the duration of the session: E1 and the "in progress" checks (the `k8s.timeline` fact area, 5.6) are built on it.

The virtual clock is needed because Kubernetes involves a lot of waiting: CrashLoopBackOff grows up to a ceiling, a CronJob waits for its schedule, a node is declared unreachable after a grace period, eviction from a failed node waits for `tolerationSeconds`. All controllers and the kubelet live on the virtual clock; the AGE field is computed from it. During long waits acceleration switches on by itself, with a "time ×10" badge.

Networking. Each node is a netlab `host` device with `ip_forward=1`. A pod netns is a separate `host` without hardware, connected by a veth pair to the node's `cni0` bridge. On `ADD`, `cni-lite` performs on netlab the same operations as the bridge plugin and host-local IPAM: create a netns, a veth, attach it to the bridge, assign an address from the podCIDR, set the default route. Inter-node routes (host-gw) or the `flannel.1` device (VXLAN) are created through the same API. `kube-proxy-lite` watches Services and EndpointSlices and writes rules into the netlab netfilter in the real format: iptables (`KUBE-SERVICES`, `KUBE-SVC-*`, `KUBE-SEP-*`, `KUBE-MARK-MASQ`, `KUBE-POSTROUTING`, `KUBE-NODEPORTS`, chain-name hashes are base32 of SHA-256, as in kube-proxy) and nftables (table `ip kube-proxy`, `service-*`, `endpoint-*`, `numgen random mod N vmap`). NetworkPolicy writes into the node's `netpol-lite` filter chains, modeled on kube-router. A packet passes through the kernel hooks in the netlab model, and the "path through netfilter" tab shows the rule that matched. What netlab needs to add for this is listed in section 18.

Access to a node is available from KN1 on, not only during installation: `ssh worker-1` opens the console of the netlab device (on `sim`) or of the real guest (on `v86`) with `ip a`, `ip route`, `ip neigh`, `bridge fdb`, `iptables-save -t nat`, `nft list table ip kube-proxy`, `conntrack -L`, `tcpdump -i cni0|flannel.1|eth0`, `ps`, `lsns`, `cat /sys/fs/cgroup/...`. `crictl`, `journalctl -u kubelet`, `systemctl` and `/etc/kubernetes/manifests` are available in the KM15 training kubeadm cluster and in exam E.

Images are TypeScript programs in the course registry (04/7.6); on `v86` nodes they are the same images built for i386 (5.9).

| Image | Behavior |
|---|---|
| `trainer/web:1.0`, `:1.1` | HTTP on 80, returns the version, the pod name and the client IP; `/healthz`, `/ready`; reads `GREETING` from the environment and `/etc/web/config.yaml` |
| `trainer/web:2.0` | crashes after 3 seconds with code 1 and the line `panic: config not found` (training CrashLoopBackOff) |
| `trainer/web:2.1` | takes 40 seconds to start (training startupProbe) |
| `trainer/web:slow` | answers after `DELAY` seconds (504 on the ingress controller in E8) |
| `trainer/web:typo` | missing from the registry (ImagePullBackOff) |
| `trainer/hog` | consumes memory per `MEM_MB` and CPU per `CPU_M` (OOMKilled, throttling, HPA) |
| `busybox:1.37`, `nginx:1.29`, `redis:8`, `postgres:17` | trimmed versions; redis and postgres keep data in a mounted volume and lose it without a PVC |
| `trainer/job` | runs for `DURATION` seconds, exits with `EXIT_CODE` |
| `trainer/client` | `sleep infinity`; has `curl`, `nslookup`, `dig`, `nc`, `ss` — a pod for network checks and an ephemeral container for `kubectl debug` |

`kubectl exec` opens a Stand shell inside the pod with that container's file system (mounted ConfigMaps, Secrets and volumes are visible as files; `/etc/resolv.conf` with a real `search` and `ndots:5`; `/var/run/secrets/kubernetes.io/serviceaccount/token`). On a `v86` node this is a real `crun exec` (5.9).

### 5.3. Supported resources

Schemas come from `api/openapi-spec/v3` of the kubernetes repository at tag v1.37.x, trimmed to the list below. The kube-lite core keeps structural validation; field descriptions for `kubectl explain` are moved into the lazy chunk `k8s-openapi-1.37`, which is loaded on the first `explain` (otherwise the descriptions would eat most of the 300 KB budget). Default values are set by the mutating stage, as in the real apiserver, so that `get -o yaml` looks familiar.

| Group/version | Kinds |
|---|---|
| v1 | Pod (including `ephemeralContainers`, `lifecycle.preStop.sleep`, generic ephemeral volumes, `topologySpreadConstraints`, `dnsConfig`), Service (`sessionAffinity`, `internalTrafficPolicy`, `externalTrafficPolicy`, `trafficDistribution`), ConfigMap, Secret, Namespace, Node, PersistentVolume, PersistentVolumeClaim, ServiceAccount, Event, Endpoints (read-only, with a deprecation warning), ResourceQuota, LimitRange, Binding (subresource) |
| apps/v1 | Deployment, ReplicaSet, DaemonSet, StatefulSet, ControllerRevision |
| batch/v1 | Job (`activeDeadlineSeconds`, `ttlSecondsAfterFinished`, `podFailurePolicy`), CronJob |
| autoscaling/v2 | HorizontalPodAutoscaler |
| discovery.k8s.io/v1 | EndpointSlice |
| networking.k8s.io/v1 | Ingress, IngressClass, NetworkPolicy |
| gateway.networking.k8s.io/v1 | GatewayClass, Gateway, HTTPRoute |
| storage.k8s.io/v1 | StorageClass |
| rbac.authorization.k8s.io/v1 | Role, ClusterRole, RoleBinding, ClusterRoleBinding |
| authentication / authorization | TokenRequest (`create token`), SelfSubjectReview (`auth whoami`), SubjectAccessReview (`auth can-i`) |
| certificates.k8s.io/v1 | CertificateSigningRequest |
| policy/v1 | PodDisruptionBudget |
| coordination.k8s.io/v1 | Lease (node heartbeat) |
| apiextensions.k8s.io/v1 | CustomResourceDefinition (+ any custom resources, `openAPIV3Schema`, status subresource, `x-kubernetes-validations` with a CEL subset: `self`, `oldSelf`, comparisons, `size()`, `matches()`) |
| argoproj.io/v1alpha1 | Application (source, destination, syncPolicy.automated.prune/selfHeal) |
| metrics.k8s.io/v1beta1 | NodeMetrics, PodMetrics |

What is missing: everything else returns the real error `error: the server doesn't have a resource type "X"`, followed by a trainer line "this resource is not in the training cluster; it is available at the real stage".

Service API paths: `kubectl get --raw` supports `/readyz`, `/livez` (with `?verbose`), `/version`, `/metrics` (trimmed) and object paths.

### 5.4. Component behavior that must be reproduced exactly

The troubleshooting lessons are built on this. Message wording is taken from the source code and verified against golden recordings (5.7). Everything that depends on the version is marked `hold` in the content with version v1.37 and is confirmed by a golden recording and a second source.

- **Scheduler**: the filters NodeUnschedulable, NodeResourcesFit, TaintToleration, NodeAffinity (including nodeSelector), PodTopologySpread, VolumeBinding (PVC with WaitForFirstConsumer), NodePorts; scoring LeastAllocated, ImageLocality; the result in a `FailedScheduling` event in the real format: `0/3 nodes are available: 1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: }, 2 Insufficient memory. preemption: 0/3 nodes are available: 1 Preemption is not helpful for scheduling, 2 No preemption victims found for incoming pod.`
- **kubelet**: `ContainerCreating` → `Running`; `ErrImagePull` → `ImagePullBackOff`; `CrashLoopBackOff` with exponential delay. Default values are in `hold`: historically 10 s doubling up to 300 s, reset after 10 minutes of running; KEP-4603 introduces a reduced delay behind the feature gate `ReduceDefaultCrashLoopBackOffDecay` (alpha in v1.33, off), and KEP-5593 a configurable ceiling; the stage in v1.37 is confirmed by the v1.37 feature gates table and a golden recording. Probes with `initialDelaySeconds`, `periodSeconds`, `failureThreshold`; `OOMKilled` (exit 137) when limits.memory is exceeded; `restartPolicy`; SIGTERM → `terminationGracePeriodSeconds` → SIGKILL, `preStop`; `Terminating`; `CreateContainerConfigError` if a ConfigMap or Secret referenced from env is missing.
- **Nodes**: the kubelet updates its Lease every 10 s; if there is no heartbeat for longer than `node-monitor-grace-period` (per the *Node Status* page — 50 s, changed from 40 s in v1.32; `hold`), node-lifecycle sets `Ready=Unknown` and the taint `node.kubernetes.io/unreachable:NoExecute`; pods are evicted after `tolerationSeconds` (300 s from the DefaultTolerationSeconds admission). Without a CNI the node is `NotReady`: `container runtime network not ready: NetworkReady=false reason:NetworkPluginNotReady message:Network plugin returns error: cni plugin not initialized`. A kubelet that comes back stops pods that no longer exist in the API.
- **Network**: node podCIDRs `10.42.0.0/24`, `10.42.1.0/24`, … and ClusterIPs from `10.43.0.0/16`, the DNS service at `10.43.0.10` — as in k3s. Pod traffic leaving the cluster is SNATed to the node IP (the flannel `MASQUERADE` rule for addresses outside `10.42.0.0/16`; in kube-proxy mode — `KUBE-POSTROUTING` for marked packets). An empty EndpointSlice produces a `REJECT` rule and `Connection refused`; a wrong `targetPort` produces an RST from the pod; a stopped kube-proxy does not touch old rules, but new Services do not work. The pod MTU on VXLAN is 1450.
- **Storage**: local-path-provisioner (as in k3s), `WaitForFirstConsumer`, reclaimPolicy Delete/Retain; volume data survives pod re-creation and disappears when a PVC with Delete is removed; `allowVolumeExpansion`.
- **Garbage collection**: ownerReferences, foreground/background/orphan, finalizers, a namespace stays `Terminating` until its contents are deleted.

### 5.5. kubectl commands

Output is byte-for-byte as in kubectl of the same version. `-h/--help` is output **in full**, as in a real kubectl v1.37: without it rungs 3–4 of the documentation ladder are impossible (section 7). A flag that exists in kubectl but is not supported by the simulator produces a trainer line "this flag exists in kubectl but not in the training cluster — it works at the real stage", not `unknown flag`. A real `unknown flag` is only for flags that kubectl does not have; below it, on a separate line, there is a hint "perhaps you meant `--replicas`" if the Levenshtein distance is ≤ 2 (the hint is off during exams).

Global flags: `-n`, `-A`, `--context`, `--kubeconfig`, `-l`, `--field-selector` (metadata.name, metadata.namespace, status.phase, spec.nodeName, reason for events), `-o` (wide, yaml, json, name, jsonpath with `range`, custom-columns), `--show-labels`, `-w`, `--dry-run=client|server`, `-f` (file, directory, `-`), `-k`, `--sort-by`, `--no-headers`.

The "Taught" column is the module where the command is explained in theory; "—" means "supported, but not explained in theory": rung 3–4 tasks are built on these commands and fields (7.4, 7.5).

| Command | Supported | Taught |
|---|---|---|
| `get` | all resources, several types separated by commas, `all`, `--raw` | KM01; `--sort-by`, `custom-columns`, `jsonpath` with `range` — "—" |
| `describe` | all resources; events at the bottom | KM01 |
| `logs` | `-c`, `-f`, `--previous`, `--tail`, `--since`, `-l`, `deploy/<name>`, `--all-containers`, `--prefix` | KM01; `--previous` — "—" (F02), `--all-containers --prefix` — "—" |
| `run` | `--image`, `--restart=Never`, `--env`, `--port`, `--labels`, `--command --`, `-it --rm`, `--dry-run=client -o yaml` | KM01 |
| `delete` | by name, `-f`, `-l`, `--all`, `--grace-period`, `--force`, `--cascade` | KM01; `--cascade` — KM02 |
| `apply` | `-f`, `-k`, `--server-side`, `--prune`; last-applied and three-way merge | KM01 |
| `create` | `-f`; `deployment` (`--replicas`, `--port`), `service clusterip|nodeport|loadbalancer`, `configmap`, `secret generic|tls|docker-registry`, `namespace`, `job --from=cronjob/…`, `cronjob`, `serviceaccount`, `role`, `clusterrole`, `rolebinding`, `clusterrolebinding`, `ingress`, `token --duration` | KM01–KM09; `job --from` and `token --duration` — "—" |
| `explain` | `--recursive`, dotted path | KM01 |
| `label`, `annotate` | `--overwrite`, removal with `key-` | KM02 |
| `scale` | `--replicas`, `--current-replicas` | KM02 |
| `edit` | the trainer's editor; on a schema error — the real loop "file saved to /tmp/kubectl-edit-….yaml" | KM02 |
| `set image`, `set env`, `set resources` | | KM03 |
| `rollout` | `status` (`--timeout`), `history` (`--revision`), `undo` (`--to-revision`), `restart`, `pause`, `resume` | KM03; `--timeout`, `--revision`, `--to-revision` — "—" |
| `expose` | `deploy|pod|rs`, `--port`, `--target-port`, `--type`, `--name` | KN4 |
| `exec` | `-it`, `-c`, `-- <command>` | KN2 |
| `debug` | ephemeral container (`--image`, `--target`), `node/<name>` | — (X01) |
| `cp` | into and out of a pod | — |
| `port-forward` | the trainer's "browser" panel at `localhost:<port>` | KN6 |
| `top` | `node`, `pod` (`--containers`, `--sort-by`) | KM06 |
| `autoscale` | `--min`, `--max`, `--cpu-percent` | KM06 |
| `wait` | `--for=condition=…`, `--for=delete`, `--for=jsonpath=…`, `--timeout` | KM07; `--for=jsonpath` — "—" |
| `cordon`, `uncordon`, `drain` | `--ignore-daemonsets`, `--delete-emptydir-data`, `--force`; PDB is respected | KM10 |
| `taint` | adding, removal with `key-` | KM10 |
| `auth can-i` | `--as`, `--as-group`, `--list`, `-n` | KM09; `--as` — "—" (F09) |
| `auth whoami` | | KM09 |
| `config` | `view` (`--minify`), `get-contexts`, `current-context`, `use-context`, `set-context --current --namespace`, `set-credentials`, `set-cluster` | KM01 (view, use-context); the rest KM09 |
| `diff` | `-f` | KM11 |
| `patch` | `--type=merge|json|strategic`, `-p` | KM11 |
| `kustomize` | resources, namePrefix, labels, images, patches, configMapGenerator | KM11 |
| `api-resources`, `api-versions`, `version`, `cluster-info` | | KM01, KM13 |
| `events` | `--for`, `--types`, `-w` | KM01 |
| `certificate approve|deny` | | KM09 |

Outside kubectl: `helm` (`repo add/update`, `search repo`, `install`, `upgrade --install`, `rollback`, `uninstall`, `list`, `history`, `status`, `template` with `--show-only`, `get values|manifest`, `show values`, `create`, `lint`), `argocd` (`app list|get|sync|diff|history|rollback`, `login` without a password), `git` (isomorphic-git in memory), `etcdctl` (`snapshot save`, `get`, `member list`, `endpoint health`) and `etcdutl` (`snapshot status`, `snapshot restore`) in the training kubeadm cluster. `etcdctl snapshot status` and `etcdctl snapshot restore` answer with the real etcdctl 3.6 error — in etcd 3.6 these subcommands were removed and moved to `etcdutl` ([Announcing etcd v3.6.0](https://etcd.io/blog/2025/announcing-etcd-3.6/)). This is a ready-made rung 4 task: "an instruction from the internet does not work, check the documentation for your version". We do not add `kubectx`/`kubens`, so as not to multiply alternatives.

### 5.6. Scenarios, faults and checks

Every task (lesson, trainer, exam) is described by a scenario. Checks are `goals` in the shared 09/2.4 format: a predicate over `dt.facts/v1` facts, a `keep` condition and explanations of expected mistakes. The block has no check vocabulary of its own; the same goal is evaluated in the simulator, on a hybrid node and on a real cluster.

```yaml
id: drill.kn4.selector-mismatch
version: 4
level: [L1, L2]
title: {ru: Сервис не отвечает, en: The service does not answer}
cluster:
  k8s: v1.37
  nodes:
    - {name: cp-1, role: control-plane, cpu: 2, memory: 4Gi, backend: sim}
    - {name: worker-1, cpu: 2, memory: 4Gi, backend: v86}     # if the device cannot handle v86 — sim
    - {name: worker-2, cpu: 2, memory: 4Gi, backend: v86}
  manifests: [prod-namespace.yaml, api-deploy.yaml, api-svc-broken.yaml, client-pod.yaml]
faults: []
task:
  ru: Сервис `api` в namespace `prod` не отвечает клиенту. Почините, не пересоздавая поды.
  en: Service `api` in namespace `prod` does not answer the client. Fix it without recreating pods.
answer_terms: [selector]          # the engine folds these words in AI answers at rung 4
goals:
  - id: g-endpoints
    say: {ru: "У сервиса есть готовые адреса подов", en: "..."}
    needs: [k8s.objects]
    when: "k8s.objects[kind=EndpointSlice][metadata.labels.kubernetes\\.io/service-name=api].endpoints[conditions.ready=true]#>=2"
    fail:
      - if: "k8s.objects[kind=EndpointSlice][metadata.labels.kubernetes\\.io/service-name=api].endpoints#=0"
        say: {ru: "EndpointSlice пуст: селектор сервиса не находит ни одного пода", en: "..."}
        term: K35
  - id: g-reachable
    say: {ru: "Клиент получает ответ", en: "..."}
    needs: ["http:api-from-client"]
    when: "http.api-from-client.status=200"
    keep: "k8s.objects[kind=Pod][metadata.labels.app=api-v2].metadata.uid=@start(k8s.objects[kind=Pod][metadata.labels.app=api-v2].metadata.uid)"
probes:
  api-from-client: {from: "pod/client -n prod", http: "http://api.prod/healthz"}
hints:
  - {level: 1, ru: "Сравните, кого ищет сервис и какие метки у подов."}
  - {level: 2, doc: {page: "k8s/v1.37/docs/concepts/services-networking/service", anchor: "defining-a-service", hl: "selector"}}
  - {level: 3, reveals: true, ru: "`kubectl get svc api -o wide` и `kubectl get pods --show-labels`; селектор правится `kubectl edit svc api`."}
explain_on_success:
  ru: Service находит поды только по меткам. EndpointSlice был пуст, поэтому kube-proxy нечего было вписать в правила.
```

Faults are described following the kwok Stage pattern: trigger, delay, action.

```yaml
faults:
  - id: worker-2-dies
    when: {after_goal: g-deployed, delay: 30s}
    action: node.stop          # sim: kubelet-lite stops updating the Lease; v86: v86.stop() in the node worker
    target: {node: worker-2}
  - id: slow-image
    when: {on: pod.pull, selector: {image: "trainer/web:1.1"}}
    action: image.delay
    params: {seconds: 25}
```

Mapping of the block's earlier checks to the 09 contract:

| What needs to be checked | How in 09 |
|---|---|
| an object field, the number of objects | `k8s.objects[...]` with filters and `#` |
| HTTP/TCP/DNS from a pod | a probe in `probes`, the result in `http.<id>` (for DNS — `dns.<id>`, a fact extension, section 18) |
| an RBAC answer for a subject | **new area `k8s.authz`**: `SubjectAccessReview` results for the list from `needs` — `k8s.authz[sub=system:serviceaccount:ci:deployer][verb=create][res=deployments][ns=ci].allowed=true` |
| objects were not recreated / were recreated | `keep` with `@start(...)` / `!=@start(...)` |
| a condition over the duration of the task ("never fewer than 2 ready") | **new area `k8s.timeline`**: the store change log — `k8s.timeline[kind=Deployment][name=web].status.readyReplicas.min>=2`. On a real cluster — only in the agent's "with server" mode, where the agent holds a watch; without a server the content validator forbids such goals for `envs: [vm]` |
| a file in the FS | `files[...]` |
| which command was used to solve it | `history` — only for hints, analysis and `forbid`, never for grading |

### 5.7. How we guarantee the simulator does not lie

The method is taken from Webernetes and fixed by the truthfulness rule 09/1.3. Every scenario has a golden recording: the same set of commands is run on the real tool, the outputs are normalized (names with hashes, AGE, pod IPs, uids), then the same is run in the simulator and compared line by line. A mismatch means a red build.

- **On every PR** — k3d (k3s in Docker) with the same k3s version pinned in the scenario, on the course's own CI runner, not on GitHub runners. k3d gives the same layout that kube-lite simulates: `10.42/10.43`, `10.43.0.10`, flannel, local-path, Traefik, ServiceLB, kube-router. kind is not used: it has different subnets (`10.244.0.0/16`, `10.96.0.0/12`), the kindnet CNI, no Traefik and no ServiceLB.
- **Once a day** — kubeadm v1.37 with Cilium on three VMs in the course's test cloud account, which CI creates before the run and deletes after it: the commands of KM15, exam E and eBPF mode in KN3–KN4.
- Scenarios that depend on the CNI are recorded twice: flannel (k3d) and Cilium (kubeadm).
- For the hybrid, the recording also compares the output on the node: `ps`, `lsns`, `iptables-save` on a k3d node versus the same in `lab-node`, after name normalization.

The minimum for launch is 150 golden scenarios: one for each row of the command table and each behavior from 5.4. When a new minor version comes out, the recordings are re-recorded, the difference is reviewed by hand and goes into the course changelog.

Budgets: the kube-lite core without Helm, netlab and OpenAPI descriptions — no more than 300 KB gzip (netlab is already loaded by the "Networks" block, the descriptions are a lazy chunk); starting a cluster of three `sim` nodes — under 300 ms; 3 nodes and 200 pods without losing smoothness (60 fps on a 2020 laptop). A kube-lite snapshot is CBOR + `deflate-raw` in the `snapshots` IndexedDB store (09/3.1); hybrid node snapshots go to OPFS, one base `lab-node` snapshot plus diffs.

### 5.8. Helm in the browser

`helm-engine.wasm` is a Go module made of `text/template`, `github.com/Masterminds/sprig/v3` and `sigs.k8s.io/yaml` plus the Helm functions (`include`, `tpl`, `required`, `toYaml`, `lookup` — via a call to the simulator). Input: chart files and values; output: manifests or an error with a line number, as in real Helm. Releases are stored as in Helm 3: Secret `sh.helm.release.v1.<name>.v<N>` in the release namespace. The chart catalog is built in: `trainer/web`, `bitnami-lite/redis`, `bitnami-lite/postgresql`, `argo/argo-cd-lite`, `traefik-lite` (a Gateway API controller). The same `trainer-web` chart is published as an OCI artifact in the course's `ghcr.io` for stage 2.

### 5.9. Hybrid cluster: control plane in kube-lite, nodes are real Linux in v86

**Why.** A pure simulator shows what Kubernetes does. The hybrid proves that a pod is an ordinary Linux process in the namespaces and cgroups that the learner touched in the Linux (M15) and Docker blocks. `kubectl apply` creates a process visible in `ps` on the node; `kubectl exec` opens a shell in a real mount and pid namespace; kube-proxy rules are visible with a real `iptables-save`; OOMKilled is a real `oom_kill` entry in `memory.events`; a node switched off is a real machine shutdown, after which the pods come up as real processes on the neighboring nodes.

**Diagram.**

```
main thread: xterm.js, diagrams, vswitch widget (switch events, thinned to 20/s)
     │ MessagePort
net.worker.ts: dt-switch (switch: MAC table, counters, pcap; frames from machines over their own MessageChannel, 09 §1.7)
     │ MessagePort
sim.worker.ts: kube-lite (apiserver-lite, store, controllers, scheduler, coredns-lite, kube-proxy rule generator)
     │ NodeBackend = sim | v86
     ├── v86.worker #1 worker-1: lab-node, 96 MB; ttyS0 — learner (ssh worker-1), ttyS1 — trainer-agent and dt-kubelet
     ├── v86.worker #2 worker-2
     └── v86.worker #3 worker-3 (only when deviceMemory ≥ 8)
 Ethernet frames: net0-send / net0-receive of each machine ⇄ vswitch (Transferable ArrayBuffer)
```

The hybrid's control plane is always in kube-lite, so there is no `cp-1` node as a machine: on the diagram it is a `--c-cp` hexagon, and the machines are only workers.

**The `lab-node` image** = `lab-alpine` (09/1.4) + `dt-kubelet` + `iproute2`, `iptables`/`nft`, `wireguard-tools`, `conntrack-tools`, `tcpdump`, `crun`. The kernel is the shared `dt-kernel`; its configuration gets `CONFIG_VXLAN`, `CONFIG_WIREGUARD`, `CONFIG_BRIDGE_NETFILTER` (without `br_netfilter`, pod traffic to the ClusterIP of a neighboring pod on the same bridge bypasses iptables — a classic mistake, and also the "break it" button in E7), `CONFIG_NETFILTER_XT_MATCH_STATISTIC`, `CONFIG_NETFILTER_XT_MATCH_COMMENT`, `CONFIG_NETFILTER_XT_MATCH_CONNTRACK`, `CONFIG_NETFILTER_XT_MARK`, `CONFIG_NF_CONNTRACK`, `CONFIG_IP_NF_TARGET_MASQUERADE`, `CONFIG_NF_TABLES_INET`, `CONFIG_NFT_NUMGEN`, `CONFIG_NFT_CT`, `CONFIG_CGROUP_PIDS`, `CONFIG_MEMCG`, `CONFIG_CFS_BANDWIDTH`.

**`dt-kubelet`** is a static Go binary `GOOS=linux GOARCH=386 CGO_ENABLED=0`, about 3–4 MB, delivered over 9p from `/opt/trainer/`. We do not write it as an sh script: parsing JSON tasks, tracking processes and streaming statuses come out fragile in sh. The `trainer-agent` from 09 stays on `ttyS1`; `dt-kubelet` connects to it as a second consumer of the same JSON-lines protocol. Control goes over `ttyS1`, not over HTTPS to `:6443`: otherwise netlab would have to maintain a TCP stack compatible with real Linux just for the API. Only data traffic goes through the switch: pod ↔ pod, pod ↔ DNS, client ↔ NodePort.

`dt-kubelet` performs sandbox, image and container operations through `box` — the node runtime with the 04 §10.2 contract (decision of master document 00 §10): the Go agent parses tasks and keeps the accounting, while `box` does what the learner did by hand in lab 04 m04, so the node log shows a `box …` line for each pod step.

| Operation (kube-lite → node) | What the agent does on the real kernel |
|---|---|
| `sandbox.create {pod, uid, ip, cidr}` | `ip netns add pod-<uid>`, a veth pair, one end in the `cni0` bridge, an address from the podCIDR (IPAM is managed by kube-lite), the default route to `10.42.N.1`; starts a pause process that holds net and ipc (like the sandbox in containerd) — it is visible in `ps` and `lsns` |
| `image.ensure {ref, digest}` | layers from the course registry via the Service Worker (09/1.6), unpacked into `/var/lib/dt/images/<digest>` |
| `container.start {spec}` | overlayfs (`lower` — the layers, `upper` in tmpfs), `config.json` from the PodSpec (env, ConfigMap and Secret as files, `linux.resources` from requests/limits → real `memory.max`, `cpu.max`, `cpu.weight`, `pids.max`), `crun run -d`, joining the pod's netns |
| `container.kill {grace}` | SIGTERM, waiting on the virtual clock, SIGKILL |
| `status` (stream) | `crun state`, exit codes, `memory.events` (`oom_kill`) → `reason: OOMKilled`, restarts |
| `exec {cid, tty}` | `crun exec -t`; the stream goes over virtio-console multiport (`CONFIG_VIRTIO_CONSOLE` is already enabled), not over `ttyS1` |
| `logs {cid}` | stdout/stderr to `/var/log/pods/<ns>_<pod>_<uid>/<c>/0.log` in CRI format |
| `proxy.apply {rules}` | an `iptables-restore` (or `nft -f`) file from the same generator that writes rules into netlab; the `iptables -t nat -L -v` counters match the packets on the diagram |
| `netpol.apply {rules}` | filter chains on `cni0`, modeled on kube-router |
| `route.mode {host-gw|vxlan|wireguard}` | routes `ip route add 10.42.M.0/24 via 192.168.56.1M`; or `ip link add flannel.1 type vxlan id 1 dstport 8472 dev eth0 nolearning` + `bridge fdb append`; or `wg0` between nodes |

**The network between nodes is our own `vswitch`** (the implementation owner is 09; the model is the netlab `switch` device). The `inbrowser` broadcast channel from 09/1.6 does not fit here: it has no MAC table, no picture and no point where you can "cut the wire". The `dt-switch` switch runs in a separate worker `net.worker.ts` (09 §1.7; `vswitch` is the name of its widget on the diagram); it learns MACs, forwards frames, counts bytes per port, can disable a port and drop every Nth frame, writes pcap for the "Packetscope" (03/7.5), and sends `frame` events to the packet animator (08/3.6). Simulated netlab devices are plugged into the same switch: `coredns-lite` at `10.43.0.10` and the "external client" `203.0.113.50`. This way real kernels and simulated services live in one L2. Addresses: nodes `192.168.56.11–13/24`, podCIDR `10.42.N.0/24`, ClusterIP `10.43.0.0/16`, DNS `10.43.0.10`, as in the main simulator. Delivery modes between nodes are host-gw (L0), VXLAN (L1), WireGuard (L2): the same pod-to-pod `ping` is seen on the switch line as three different frames — bare IP, IP in UDP, encrypted UDP.

**A node "went down"** — `v86.stop()` in the node worker. The Lease stops being updated, after the grace period node-lifecycle in kube-lite sets `Unknown` and the taint, the pods are evicted, the scheduler picks another node, and `dt-kubelet` there starts a real process. "Turn the node back on" — `v86.run()`: the agent finds pods that no longer exist in the API and kills them — the lesson "the kubelet reconciles too".

**Budgets** (an addition to table 09/1.4; a separate memory profile for the hybrid):

| What | Threshold |
|---|---|
| `lab-node` guest | 96 MB (64 MB as a fallback) |
| Snapshot after boot, zstd | ≤ 12 MB, one for all nodes |
| Starting three nodes from one snapshot | ≤ 5 s; after restore the agent changes the `hostname`, MAC (`ip link set eth0 address`) and address — otherwise the nodes would share one MAC |
| Tab memory, 2 nodes | ≤ 700 MB — the default mode with `deviceMemory ≥ 4` |
| Tab memory, 3 nodes | ≤ 900 MB, only with `deviceMemory ≥ 8` |
| Pods per node | ≤ 8 |
| Pod start (image in cache) | ≤ 3 s of real time |
| Animation | 60 fps at 50 frames per second on the switch |
| Phone, `deviceMemory < 4` | one `v86` node + the rest `sim`; if even that is not possible — the whole cluster `sim` with a "nodes are simulated" badge |

**Where it is enabled.** The scenario sets `cluster.nodes[].backend`. The default is `sim`; `v86` is specified where a real kernel adds something new: KM01 (pod = process, `ps`/`lsns`), KM03 and E5 (node failure), KN2–KN4 (veth, bridge, real iptables, VXLAN), KM06 (OOM kill, `cpu.max`), KN7 (NetworkPolicy as kernel rules), KM09 (securityContext in `/proc/<pid>/status`), some of the KM16 breakages.

**Checks in the hybrid** combine kube-lite facts (`k8s.objects`, `k8s.timeline`) and node facts (`procs`, `ns`, `cgroups`, `net`). The KM06 goal:
`k8s.objects[kind=Pod][metadata.name=hog].status.containerStatuses.lastState.terminated.reason=OOMKilled && @node(worker-1).cgroups[procs~@pid(hog)].memory.max=134217728`.

**What the hybrid is not.** It is not k3s and not a real kubelet: `kubectl` output is produced by kube-lite, the node is responsible only for what is visible from inside Linux. The learner is told this in one card next to the control plane hexagon.

**Spike before the networking development stage** (1 week, section 17): two v86 nodes + `vswitch` + `dt-kubelet`: `kubectl run` → a process in its own netns, `ping` between pods on different nodes, ClusterIP DNAT via `iptables-restore`. The acceptance criteria are the rows of the budget table. If the spike does not fit, this is recorded explicitly, and the networking section is built on `sim` with the same content.

## 6. Process explanations

### 6.1. General rules

All of the block's explanations follow R4 and R5 and the visual language of 08/5:

- **A blueprint, not a drawing.** Line 1.5 px, corner radius 6 px, 8 px grid; the control plane is a `--c-cp` hexagon, a node and its agents are a `--c-node` rack, an API object is a `--c-obj` document card, network layers are `--c-l2…--c-l7` envelopes, the kernel is a dark `--c-kernel` strip at the bottom. Color always carries meaning and is always duplicated by shape or a label. Sankofa ink, characters, plot, decorations and sound are not used.
- **Control plane on top, nodes at the bottom, the API server is the only point where arrows converge** (08/5.3). A label on every line: a verb (`watch pods`, `PATCH status`, `bind`) or what changes in the packet (`dst 10.43.12.7:80 → 10.42.1.15:8080`).
- **Animation only of the process**: a packet travels along a line, an object card appears, a counter grows, a field in the YAML is highlighted. Transitions between steps are smooth (200–300 ms), the camera does not move; a transition between levels (control plane → node → pod) is a change of layer, not a flight.
- **One idea per screen.** A screen answers one question, and the screen title is that question.
- **Everything is clickable.** A click on a block, line, field or packet opens a card: what it is, who creates it, which command shows it in a real cluster, a link to the documentation page (the rung per 7.3).
- **Parameters recalculate the process immediately.** Sliders and switches change the simulation input; kube-lite recalculates on the virtual clock, the diagram is redrawn, and in the right-hand "what changed and why" column one or two sentences appear explaining exactly this change.
- **"Break it"** removes a component or introduces a breakage; the break is shown in place, with the real error message.
- **A stepper, not a video** (08/3.1): a step scale at the bottom, ◀ ▶ ⏸, dragging, the ←/→ keys, scrolling moves the steps. Below the diagram is a terminal with the command that shows the same thing in a real cluster.
- **Calm mode** (`prefers-reduced-motion`, calm.ts): animations are replaced by step-by-step frames, a flying packet by a table of hops.
- **kube-lite (or the hybrid node) computes everything**; the diagram only draws. Therefore the picture cannot diverge from the terminal output.

| # | Explanation | Module, returns | Section |
|---|---|---|---|
| E1 | The `kubectl apply` path through all components | KM01 (start), KM03 (in full), KM09 (authz) | 6.4 |
| E2 | The reconciliation loop: desired, actual, controller; a chain of controllers; your own controller | KM02, KM03, KM12, KM13 | 6.3 |
| E3 | How the scheduler chooses a node | KM03, KM10 | 6.5 |
| E4 | Rolling update | KM03 | 6.6 |
| E5 | A node went down | KM03, KM07, KM10 | 6.7 |
| E6 | A packet from pod to pod | KN1–KN3 | 6.8 |
| E7 | A request through a Service and kube-proxy | KN4, KM06 | 6.9 |
| E8 | From outside to a pod: NodePort, LoadBalancer, Gateway; where 504 comes from | KN6 | 6.10 |
| E9 | The cost of ndots | KN5 | 6.11 |
| E10 | NetworkPolicy: the "from × to" matrix | KN7 | 6.12 |
| E11 | Requests and limits in cgroup: throttling, OOM, QoS | KM06 | 6.13 |
| E12 | How a PVC finds a volume | KM08 | 6.14 |
| E13 | The request path through authn → authz → admission | KM09 | 6.15 |
| E14 | Helm: from values to a release | KM11 | 6.16 |
| E15 | GitOps: from `git push` to a pod | KM12 | 6.17 |

### 6.2. The "Kubernetes from blocks" builder

There is one builder per course; its widget and storyboard are in 08/6.4 (`constructor`, 08/3.7). This section is the behavior specification for it and the order of steps: steps 0–1 (node, cluster, desired state) — KM00; API server and pod — KM01; controller, ReplicaSet, etcd — KM02; scheduler, kubelet, runtime, controller-manager — KM03; Service, kube-proxy, CoreDNS, CNI — the KN section; Gateway — KN6; metrics-server and the "load went up" button — from KM06. Blocks of concepts not yet introduced are visible in the palette as a silhouette labeled "opens in KN4" and cannot be clicked.

**Screen 1. Canvas and palette.** The palette on the left, the canvas on the right: a "control plane" zone at the top, "nodes" at the bottom (up to three). Blocks: kubectl, kube-apiserver, etcd, kube-scheduler, kube-controller-manager, cloud-controller-manager (L2), kubelet, container runtime (containerd), kube-proxy, CNI plugin, CoreDNS, metrics-server, Gateway controller. A block is a blueprint shape of its layer with a one-line purpose.

**Screen 2. Wires.** Ports are typed; a wire can only be drawn along an existing connection: everything except etcd talks to kube-apiserver; only kube-apiserver talks to etcd; the kubelet talks to the runtime over CRI; the runtime calls the CNI. A forbidden connection (scheduler → etcd, kubelet → scheduler) does not go through, and above the wire it says why: "The scheduler does not write to etcd. It reads pods through the API server and writes its decision — a Binding object — through the API server as well". Each wire is labeled with what goes over it (`watch pods`, `PATCH status`, `gRPC CRI`); on connection the line is highlighted once (200 ms).

**Screen 3. Run.** Scenarios: "apply a deployment with 3 replicas", "delete a pod", "a node switched off", "a request to a Service by name", "load went up" (from KM06). The run goes on a kube-lite assembled from what is on the canvas: a missing block switches the component off.

| Removed | What the learner sees | How it is in a real cluster |
|---|---|---|
| etcd | The API server does not start; kubectl does not respond | `Error from server: etcdserver: request timed out` or a connection refusal; in k3s the default is SQLite via kine — a footnote |
| kube-apiserver | Any kubectl command fails; running pods keep answering | `The connection to the server 127.0.0.1:6443 was refused - did you specify the right host or port?`; conclusion: a control plane failure does not bring down applications immediately |
| kube-scheduler | Pods are `Pending` forever, `Node: <none>`, no events | the same; the absence of `FailedScheduling` is a sign that there is no scheduler at all |
| kube-controller-manager | The Deployment is created, there is no ReplicaSet, READY `0/3`; a deleted pod does not come back; the EndpointSlice is empty; a namespace gets stuck in `Terminating` | the same |
| kubelet on a node | After the grace period the node is `Unknown`, taint `unreachable`, eviction after `tolerationSeconds` | the same |
| container runtime | Pods in `ContainerCreating`, the node is `NotReady`: `container runtime is down` | the same |
| CNI | The node is `NotReady`: `cni plugin not initialized`; `FailedCreatePodSandBox` | the same |
| kube-proxy | A request to the pod IP goes through, to the ClusterIP — a timeout; NodePort is closed | the same (with Cilium without kube-proxy its role is played by eBPF — L2) |
| CoreDNS | `curl http://10.43.12.7` works, `curl http://web` — `Could not resolve host` | the same |
| metrics-server | `kubectl top` — `error: Metrics API not available`, HPA `<unknown>/50%` | the same |
| cloud-controller-manager | LoadBalancer: `EXTERNAL-IP <pending>` forever | the same (in k3s it is replaced by ServiceLB) |

**Screen 4.** The `kubectl apply` path — E1 (6.4) over the assembled diagram.

**Screen 5 (KM15).** A diagram of what the learner installed on the VMs: blocks are labeled with the real pod names from `kubectl get pods -n kube-system -o wide` of their cluster, static pods are marked with a "from `/etc/kubernetes/manifests`" icon.

### 6.3. E2. The reconciliation loop (R10)

Introduced in KM02, returned to in KM03 (the chain), KM12 (Argo CD — the same loop for Git) and KM13 (operator).

**Screen 0. The desired state lives in etcd.** On the left — not an abstract spec but the record `/registry/replicasets/default/web` in YAML without managedFields, with a `resourceVersion` that grows on every change. On the right — the live pods as cards colored by phase. In the middle — a loop of three arcs "observe → compare → act" with a reconciliation counter and a line showing the current difference: "desired 3, have 2, difference +1 → creating a pod".

**Screen 1. The loop always runs.** The reconciliation counter grows even when there is no difference. A click on the "compare" arc shows the comparison code in ten lines.

**Screen 2. Interventions.** Buttons and the terminal at the same time:
- *delete a pod* — difference −1, the loop creates a new pod; `create pod` on the line;
- *`replicas` slider 0–10* — the difference is recalculated immediately; when decreasing, the loop chooses which pod to delete (not-ready and youngest first), and next to it it says why;
- *create a "foreign" pod with matching labels* — the ReplicaSet adopts it and deletes the extra one;
- *remove a label from a pod* — the pod is orphaned (empty `ownerReferences`), the ReplicaSet created a replacement;
- *change the image on the ReplicaSet* — nothing happens to the live pods: the loop counts only the number (bridge to KM03);
- *change the image on the Deployment* (KM03) — a second ReplicaSet appears, bridge to E4;
- *switch off a node* (KM03) — the pods on it turn grey; the ReplicaSet loop notices them only after another loop, node-lifecycle, has marked them for deletion (bridge to E5).

**Screen 3. Missed events.** A "pause the controller" button. The learner makes three changes in a row and switches the controller back on: it does not replay the events but looks at the current state once and makes one fix. At the bottom is a diagram of the informer: watch → local cache → key queue → reconcile; there is one key in the queue, no matter how many events came. This is how the level-triggered approach is explained.

**Screen 4. A chain of loops** (KM03). Five loops one below the other, each with its own desired and actual state: Deployment (spec.replicas and the template → ReplicaSets), ReplicaSet (replicas → pods), scheduler (a pod without `nodeName` → Binding), kubelet (a pod on my node → a process in the runtime), EndpointSlice (ready pods with labels → addresses). On the lines between the loops — the object through which they are connected. One action ("scale 3 → 5") lights up the loops in turn from top to bottom; the clock speed slider lets you examine the wave. A click on a loop shows the object it watches, the field it writes, and the row of table 6.2 "what happens if it is removed".

**Screen 5a. Your first loop** (KM02, all levels). *Decision of master document (00 §10): in the core the loop is written in bash — a `while` loop with `kubectl get`/`kubectl create` in the Stand on top of kube-lite, because the learner knows bash from the Linux block, while JavaScript is not introduced in the course; the TypeScript variant in QuickJS described below is the `plus` (L1) and `pro` (L2) tier, and it is the one that gets the check with lost events and two instances (01 §9.3.3).* A controller on familiar objects: "every namespace with the `team` label must have a `team-info` ConfigMap". A 15-line template; L0 writes the remaining three lines (comparison and creation), L1 writes the whole `reconcile` function, L2 adds `ownerReferences` and deleting the ConfigMap when the label is removed. The learner creates a namespace, deletes the ConfigMap by hand and sees their loop bring it back.

**Screen 5b. An operator = the same loop for a CRD** (KM13; L1 writes the whole `reconcile`, L2 adds status conditions and a finalizer). CRD `Website`, the same code:

```ts
// Website: the user describes a site, the controller creates a Deployment and a Service.
export async function reconcile(site: Website, k: Client): Promise<Result> {
  const owner = ownerRef(site);                                   // the Deployment and Service belong to the Website
  const want = renderDeployment(site, owner);
  const have = await k.get('apps/v1', 'Deployment', site.metadata.namespace, site.metadata.name);
  if (!have) { await k.create(want); await k.apply(renderService(site, owner)); return { requeueAfter: 0 }; }
  if (have.spec.replicas !== site.spec.replicas) await k.patch(have, { spec: { replicas: site.spec.replicas } });
  const fresh = await k.get('apps/v1', 'Deployment', site.metadata.namespace, site.metadata.name);
  await k.patchStatus(site, { readyReplicas: fresh.status?.readyReplicas ?? 0 });
  return {};
}
```

The caption under the screen: "an operator is the same loop, only the desired state is described by your own kind of object". Check scenarios: creation, changing the replicas, manually deleting the Deployment (the controller brings it back), deleting the Website (ownerReferences remove everything). At the real stage the same operator is rewritten in Go with kubebuilder — the "writing an operator" pet project from the checklist.

**Code sandbox.** An ordinary Worker of the same origin has `fetch` and IndexedDB, where the encrypted AI model key is stored (09/4.4); foreign code pasted into the editor could use it. Therefore the learner's code runs in the `quickjs-emscripten` interpreter (MIT, about 500 KB gzip, loaded lazily) inside the worker: the global scope contains only `k` (a kube-lite client with the controller ServiceAccount's permissions; RBAC is checked — a forgotten permission on `deployments` produces a real `forbidden` error) and `console`. Memory limit 32 MB, time limit per `reconcile` call 200 ms (`setInterruptHandler`). TypeScript is stripped of types before execution with `sucrase` (MIT, about 100 KB); we do not type-check, the editor highlights errors.

### 6.4. E1. The `kubectl apply` path through all components

The diagram is the assembled builder (or the reference one if the learner did not come from the builder). Each step highlights a wire and a block and shows the real object at that step: YAML, with changed fields highlighted in `--c-warn`.

1. kubectl reads the file, determines the resource by `apiVersion`/`kind`, adds the last-applied annotation, sends the request; on the line `POST /apis/apps/v1/namespaces/default/deployments`.
2. The API server checks who it is (the certificate from kubeconfig) and whether it is allowed (RBAC) — in KM09 this step unfolds into E13.
3. Mutating admission sets default values (`strategy`, `revisionHistoryLimit`…).
4. Schema validation; validating admission (quotas).
5. Write to etcd: the object gets a `uid` and a `resourceVersion`; the client receives `deployment.apps/web created`. In KM01, E1 stops here.
6. The Deployment controller receives a watch event and creates ReplicaSet `web-<hash>`.
7. The ReplicaSet controller creates three Pods without `nodeName`.
8. The scheduler filters and scores the nodes (a collapsed version of E3), writes a Binding.
9. The kubelet of the chosen node sees the pod assigned to it.
10. The kubelet asks the runtime over CRI to create the pod sandbox.
11. The runtime calls the CNI: the pod gets IP `10.42.1.15`, a veth into the node's bridge.
12. Pulling the image, creating and starting the container; on the hybrid, the node's `ps -ef` opens next to it with the new process.
13. The probes pass, the kubelet writes `Ready=True` into status through the API server.
14. The EndpointSlice controller adds the pod address; kube-proxy on every node adds a rule; CoreDNS already answers for the service name.

*Parameters:* `replicas` 1–5 (steps 7–14 multiply), "the image is already on the node" (step 12 shrinks to "image in cache"), "RBAC forbids" (step 2 breaks off with a real `Error from server (Forbidden)`), "quota exhausted" (step 4 — `exceeded quota`). *Break it:* any builder block — the path breaks off at the corresponding step with the message from table 6.2.

*"Rashomon" lenses* (lenses.ts): the same path from the point of view of one component — "I am the scheduler: I don't start anything, I choose a node and record the choice". Each lens has its own short feed of the events this component sees; for etcd — only writes of the keys `/registry/deployments/default/web`, `/registry/pods/default/web-…`. For L2 — the same feed with HTTP methods and API paths.

*Terminal:* `kubectl apply -f web.yaml -v=6` (the verbosity level shows the real requests), `kubectl get events --sort-by=.lastTimestamp`.

### 6.5. E3. How the scheduler chooses a node

*Screen 1 — the queue.* On the left, a column of pods in the scheduler queue; on the right, three nodes with two gauges "CPU: requested / allocatable" and "memory: requested / allocatable". The line from the scheduler to the API is labeled `watch pods, nodeName=""`. A click on a node shows its `status.allocatable` and the *Allocated resources* section from `kubectl describe node`.

*Screen 2 — filters.* The pod is tried against each node; the filters in turn: NodeUnschedulable → NodeResourcesFit → TaintToleration (from KM10) → NodeAffinity → PodTopologySpread (L2). A node that fails a filter goes dark, and on the line to it is the reason in the real wording (`Insufficient memory`). At the bottom the `FailedScheduling` line is assembled from these labels.

*Screen 3 — scoring.* For the nodes that passed, score bars grow per plugin (LeastAllocated, ImageLocality, TaintToleration, PodTopologySpread), the sum, the winner; the line `POST …/pods/web-x/binding`.

*Sliders and switches:* the pod's `requests.memory` 64Mi–4Gi, `requests.cpu` 50m–2000m, "the image is already on worker-2", the number of replicas 1–8 (you can see how LeastAllocated spreads them across nodes); from KM10 — a taint on worker-1, `nodeSelector disk=ssd`, anti-affinity. Any change immediately recalculates screens 2–3; on the right: "requests.memory 3Gi > allocatable of worker-1 (2.8Gi) → worker-1 filtered out by NodeResourcesFit".

*Break it:* remove the scheduler — the queue grows, there are no events at all; "limits without requests" — requests become equal to limits (the field is highlighted in the YAML).

*Terminal:* `kubectl get events --field-selector reason=FailedScheduling`, `kubectl describe node worker-1`.

### 6.6. E4. Rolling update

*Screen 1.* Two ReplicaSet rectangles — the old one (`web-7d9c…`, 1.0) and the new one (`web-5f4b…`, 1.1), with pods below them. Above them, the Service → pods line: ready pods are connected with a solid line, not-ready ones with a dashed line. Counters "ready in total", "old", "new", "minimum ready during the rollout".

*Screen 2 — steps.* A step on the scale = one action of the Deployment controller ("scaled the new RS to 2", "pod web-5f4b-x Ready", "scaled the old RS to 2"); the caption is taken from `ScalingReplicaSet` events.

*Sliders:* `replicas` 1–10; `maxSurge` and `maxUnavailable` 0–5 or 0–100 % (both zero — the caption "the Deployment will be rejected: both are zero", with the real validation error); the readiness time of a new pod 0–60 s; `minReadySeconds` 0–30. The "how many pods are ready over time" chart is rebuilt immediately; on the right: "maxUnavailable=0 and maxSurge=1 → at any moment at least 4 are ready, the rollout will take about 4 × 15 s".

*Switches:* strategy `RollingUpdate`/`Recreate` (a drop to zero ready); readiness probe on/off (without it a not-ready pod gets traffic immediately — a red 502 packet on the Service line; the switch opens from KM06, before that it is visible as a silhouette).

*Break it:* new image `:2.0`. The rollout gets stuck: the new pods are in CrashLoopBackOff, the old ones keep serving within `maxUnavailable`. After `progressDeadlineSeconds` the condition `Progressing=False, reason=ProgressDeadlineExceeded` appears. Caption: "`progressDeadlineSeconds` does not stop or roll back anything; it is a signal for you or for CI". A `kubectl rollout undo` button.

*Terminal:* `kubectl rollout status deploy/web`, `kubectl get rs -w`.

### 6.7. E5. A node went down

*Screen 1.* Three nodes, Deployment `web` with 3 replicas and (from KM07) StatefulSet `db` with 1 replica. Under each node is a Lease strip with a timer "updated N s ago" (every 10 s). At the top is the node-lifecycle controller in kube-controller-manager.

*Steps in virtual time:* t=0 power to `worker-2` is switched off → the Lease is not updated (on the line "no PUT Lease") → t = `node-monitor-grace-period` (50 s, `hold`) → `Ready=Unknown`, taint `node.kubernetes.io/unreachable:NoExecute` (line "PATCH node") → a `tolerationSeconds` timer (300 s) on each pod → the `web` pods are marked for deletion → the ReplicaSet creates replacements → the scheduler sends them to live nodes.

*Network:* while the addresses of the failed node's pods are `ready` in the EndpointSlice, kube-proxy on the live nodes keeps sending part of the requests to them — on the diagram there is a "lost requests" counter. The conclusion under the counter: the failure detection time and readiness determine how many requests will be lost.

*Sliders:* the pod's `tolerationSeconds` 0–600; `node-monitor-grace-period` 20–120 s; a workload type switch Deployment/StatefulSet (from KM07).

*Switches:* "the node came back after 60 s" — the pods stayed in place because 300 s had not elapsed; "the node came back after 10 minutes" — the kubelet finds pods that no longer exist in the API and stops them; "RWO volume" — the new pod waits for the volume to be detached; StatefulSet — `db-0` stays `Terminating` and is **not** recreated: two `db-0` at the same time are not allowed. Possible actions: bring the node back, delete the Node object, `kubectl delete pod db-0 --force` (with a warning about two writers to one volume).

*KM10:* `drain` instead of switching off — eviction respects the PDB, while eviction by the `unreachable` taint does not; one line on the diagram compares both paths.

*Hybrid:* "power switched off" — `v86.stop()`; on a live node the terminal shows a new process in `ps -ef` and a new veth in `ip link`.

*Terminal:* `kubectl get nodes -w`, `kubectl get lease -n kube-node-lease`, `kubectl describe node worker-2 | grep -A3 Taints`.

### 6.8. E6. A packet from pod to pod

*Screen 1 — the model.* Two nodes, the nodes' `eth0` in the `192.168.56.0/24` network. On each, a `cni0` bridge (`10.42.0.1/24`, `10.42.1.1/24`) and two pods. Labels on the lines: `veth`, `cni0`, `eth0`. A "how it would be in Docker" switch shows `-p` and NAT, which do not exist in the Kubernetes model. A click on a pod shows its netns, `ip addr`, the route.

*Screen 2 — one node.* Pod A (`10.42.0.15`) → pod B (`10.42.0.16`). Steps: the pod's routing table → ARP for `10.42.0.16` over the bridge → the frame through the bridge. The envelope is opened up to L2: MAC and IP on the flaps.

*Screen 3 — between nodes.* Pod A → pod C (`10.42.1.20`). A **delivery method** switch: host-gw | wrapping (VXLAN) | native + BGP (L1/L2), and a separate, independent **datapath** switch: kube-proxy and iptables | Cilium eBPF (L2). With host-gw, `10.42.1.0/24 via 192.168.56.12` is visible on the node. With wrapping, the envelope gets wrapped: outside `192.168.56.11 → 192.168.56.12 UDP 8472 VNI 1`, inside `10.42.0.15 → 10.42.1.20`; for L0 the caption is "an envelope inside an envelope" without the protocol name. With native + BGP a network router appears with routes received via BGP. The "WireGuard" switch (L1/L2) adds one more, encrypted wrapping. On the right, the explanation: "Cilium by default is eBPF and VXLAN at the same time: the delivery method and the datapath are chosen independently".

*Node network MTU slider* 1500 / 1450 / 1400: under it the pod MTU and MSS are recalculated. With a pod MTU of 1500 over the wrapping, a large packet gets ICMP frag-needed or disappears; explanation: "the wrapping ate 50 bytes".

*"Nodes in different subnets" switch*: host-gw stops working (the next hop is not directly reachable), the wrapping keeps working — this shows why it is needed.

*Screen 4 — going outside.* Pod → `93.184.215.14`: MASQUERADE to the node IP, the envelope changes its source; explanation "the external service sees the node's address".

*Screen 5 — break it:* delete a route on the node; close UDP 8472 with the cloud firewall (a timeout only between nodes, everything works on one node); stop the CNI (the node is `NotReady`).

*Hybrid:* the packet on the switch line is a real frame from `vswitch`; a click opens it in the "Packetscope".

*Terminal:* `ip route` on the node, `ip -d link show flannel.1`, `tcpdump -ni eth0 udp port 8472`.

### 6.9. E7. A request through a Service and kube-proxy

*Screen 1.* Pod `client` runs `curl http://web`. Steps: DNS (one rung, in detail — E9) → `connect()` to `10.43.12.7:80` → the kernel chains of the client's node → DNAT to the pod IP → the path from E6 → the reply and reverse translation via conntrack.

*Screen 2 — rules.* The real look of `iptables-save -t nat` (from the k3d golden recording, chain names are kube-proxy hashes):

```
-A KUBE-SERVICES -d 10.43.12.7/32 -p tcp -m comment --comment "default/web cluster IP" -m tcp --dport 80 -j KUBE-SVC-LOLE4ISW44XBNF3G
-A KUBE-SVC-LOLE4ISW44XBNF3G ! -s 10.42.0.0/16 -d 10.43.12.7/32 -p tcp -m comment --comment "default/web cluster IP" -m tcp --dport 80 -j KUBE-MARK-MASQ
-A KUBE-SVC-LOLE4ISW44XBNF3G -m comment --comment "default/web -> 10.42.1.15:8080" -m statistic --mode random --probability 0.33333333349 -j KUBE-SEP-QZ4N3B7D2YH6VW5K
-A KUBE-SVC-LOLE4ISW44XBNF3G -m comment --comment "default/web -> 10.42.2.9:8080" -m statistic --mode random --probability 0.50000000000 -j KUBE-SEP-5R2XWJ7M4H8C1PLA
-A KUBE-SVC-LOLE4ISW44XBNF3G -m comment --comment "default/web -> 10.42.0.22:8080" -j KUBE-SEP-C3T9K1Q6ZB2N7EXD
-A KUBE-SEP-QZ4N3B7D2YH6VW5K -s 10.42.1.15/32 -m comment --comment "default/web" -j KUBE-MARK-MASQ
-A KUBE-SEP-QZ4N3B7D2YH6VW5K -p tcp -m comment --comment "default/web" -m tcp -j DNAT --to-destination 10.42.1.15:8080
```

On the diagram next to it is a simplified version labeled "simplified"; a click on a line highlights its place in the real output. The rule `KUBE-SEP … -s <podIP> … KUBE-MARK-MASQ` is the reason for a separate screen "a pod calls its own Service (hairpin)".

*replicas slider* 1–5: the `KUBE-SVC-*` rules are recalculated before your eyes (`1/N`, `1/(N−1)`, …, unconditional), with an explanation next to them of why such probabilities give equal shares. A "100 requests" counter distributes them across the pods.

*kube-proxy mode switch:* iptables | nftables (the same logic as a map with `numgen random mod N vmap`) | IPVS (one line: deprecated; the ClusterIP sits on `kube-ipvs0`) | Cilium eBPF (L2: translation at `connect()` in the socket, `tcpdump` on `cni0` already sees the pod IP).

*keep-alive switch:* the connection stays on one pod despite the "equal" distribution (conntrack) — the answer to "why is load balancing uneven". Next to it is a "find the field that pins a client to a pod" button — rung 3 (F06).

*readiness switch* (from KM06): a pod with `ready:false` disappears from the rules but keeps running.

*Break it:* the selector does not match (no `KUBE-SEP` rules, there is a `REJECT` → `Connection refused`); a wrong `targetPort` (RST from the pod; explanation: "a Service sends to `targetPort`; `containerPort` is only a description"); kube-proxy stopped (new Services do not work, old rules live on); on the hybrid — `br_netfilter` unloaded (a pod cannot reach a neighbor's Service on its own bridge).

*Terminal:* `iptables-save -t nat | grep 10.43.12.7` on the node, `conntrack -L -d 10.43.12.7`, `kubectl get endpointslices -l kubernetes.io/service-name=web -o wide`.

### 6.10. E8. From outside to a pod: where 502 and 504 come from

*Screen 1 — overview.* From left to right: client `203.0.113.50` → node IP:443 → the Gateway controller's Service (NodePort or LoadBalancer) → the controller pod (traefik-lite) → the HTTPRoute rule → Service `web` (ClusterIP) → kube-proxy rules → pod `web`. Under each link is its layer (L3/L4/L7 in `--c-l*` colors), on each line what changes in the packet (`dst 203.0.113.10:443 → 10.43.0.50:443` and so on).

*Screen 2 — steps.* The packet travels one link per step; at each one an envelope opens with the fields that change there: DNAT, TLS termination (from KM05), a new TCP stream from the proxy to the pod, `X-Forwarded-For`.

*Switches:* `externalTrafficPolicy: Cluster | Local` (with Cluster the request goes to a pod on a neighboring node, SNAT appears, the pod sees the node IP; with Local the pod sees `203.0.113.50`, and a node without a pod does not answer and is excluded from the load balancer by a health check); LoadBalancer: cloud | ServiceLB | MetalLB L2 (a node answers ARP for `192.168.56.240`; "break the owner node" — a gratuitous ARP from another node, the address moves); the backend weight in HTTPRoute 0–100 (canary from C14: the 100-request counter is split); Ingress | Gateway API (the same chain, with the object roles labeled: GatewayClass — infrastructure, Gateway — cluster administrator, HTTPRoute — application team).

*Sliders:* pod response time 0–60 s and proxy timeout 5–60 s: when the response time exceeds the timeout, on the line from the proxy to the client a **504 appears that was returned by the proxy, not by the application**; a link to the 504 explanation from 03.

*Break it:* a Service without ready pods (the controller answers 503); a wrong `backendRef.port` (HTTPRoute `ResolvedRefs=False`); the pod closed the connection (502).

*Terminal:* `kubectl get gateway,httproute -A`, `kubectl describe httproute web`, `curl -v -H 'Host: shop.example.test' http://<node ip>:<nodePort>/`.

### 6.11. E9. The cost of ndots (KN5, L1/L2)

A pod in namespace `shop` resolves a name. A name input field: `web`, `web.prod`, `api.github.com`, `api.github.com.`. An **ndots** slider 1–5. The counter of queries to CoreDNS is recalculated immediately: for `api.github.com` with `ndots:5` the queries go to `api.github.com.shop.svc.cluster.local`, `….svc.cluster.local`, `….cluster.local` (plus the node's domains), each A and AAAA, all NXDOMAIN, and only then the real name — 8 or more queries instead of 2. With a trailing dot — 2 right away. Each query is a line in the CoreDNS feed with its answer; a click opens the DNS packet.

*Switches:* CoreDNS cache on/off (a repeated query does not go to `forward`); `dnsPolicy: ClusterFirst | Default`. *Break it:* remove `forward` from the Corefile (external names give SERVFAIL, internal ones work); stop CoreDNS (`Could not resolve host`, while `curl http://10.43.12.7` works).

For L0 the screen is cut down to one: "the short name `web` is expanded to `web.shop.svc.cluster.local` using the `search` list", without the ndots slider.

*Terminal:* `cat /etc/resolv.conf` in the pod, `dig +search api.github.com`, `kubectl -n kube-system get cm coredns -o yaml`.

### 6.12. E10. NetworkPolicy: the "from × to" matrix (KN7)

On the left, the policies' YAML; on the right, a matrix: rows are source pods in three namespaces, columns are destination pods, cells are allowed/denied (✓/⨯ and color). Editing the YAML recolors the matrix immediately, and on the right it says which policy granted the permission. A click on a cell shows the packet path and the rule that let it through or dropped it.

*"AND / OR" button:* `namespaceSelector` and `podSelector` in one list element mean "AND", in two elements — "OR"; the matrix shows the difference.

*Switches:* `policyTypes` Ingress/Egress; "allow DNS in egress" (without it the whole source row turns red for any names); **CNI**: flannel | k3s (kube-router) | Calico | Cilium. With plain flannel the matrix is all green, with a caption on top "the policy was accepted by the API server, but there is nobody to enforce it".

*Break it:* default-deny in namespace `api`; a typo in a namespace label.

*Terminal:* `kubectl get netpol -A`, `kubectl describe netpol`, on the hybrid — `iptables-save -t filter | grep -i netpol`.

### 6.13. E11. Requests and limits in cgroup (KM06)

*Screen 1.* The `hog` container inside a cgroup frame (`--c-ns-cgroup`) above the kernel strip. Two thermometer gauges: CPU and memory. Marks: requests (the guaranteed share, the scheduler plans by it), limits (the ceiling, enforced by the kernel). Next to them, the cgroup files with live values: `memory.max`, `memory.current`, `cpu.max`, `cpu.weight`, `cpu.stat`.

*Sliders:* `requests.cpu`, `limits.cpu`, `requests.memory`, `limits.memory`, the `hog` load (`MEM_MB`, `CPU_M`). Changing limits immediately changes the number in the file (on the hybrid — in the real `memory.max`); on the right: "limits.cpu 500m → cpu.max = 50000 100000: 50 ms out of every 100 ms".

*Processes:* CPU hits the ceiling — the `nr_throttled` counter grows, the response time on the diagram increases, but the process is alive. Memory crosses the limit — the kernel kills a process inside the group, `memory.events oom_kill 1`, next to it `Reason: OOMKilled`, exit 137, and the kubelet restarts the container.

*Screen 2 — QoS and the node.* A node with three pods: Guaranteed, Burstable, BestEffort; a "node memory used" slider: under pressure the kubelet evicts in the order BestEffort → Burstable → Guaranteed, with the reason caption `Evicted: The node was low on resource: memory`.

*Break it:* limits without requests (requests = limits), requests larger than any node (the pod is `Pending`, bridge to E3).

### 6.14. E12. How a PVC finds a volume (KM08)

PVC cards on the left, PVs and StorageClasses on the right, nodes with disks at the bottom. *Steps:* the PVC is created → a search for a suitable PV (size, access mode, class) → with static provisioning, binding to an existing PV; with dynamic provisioning, the StorageClass calls the provisioner, which creates a PV → `Bound` → the pod mounts the volume. *Switches:* `volumeBindingMode: Immediate | WaitForFirstConsumer` (in the second case the volume waits until the scheduler chooses a node and is created on it); reclaimPolicy Delete/Retain; access mode RWO/RWX. *Break it:* a non-existent StorageClass (PVC `Pending`, event `storageclass.storage.k8s.io "fast" not found`); delete the pod — the data remained; delete the PVC with Delete — the data is gone; StatefulSet `db-0`, `db-1` — each has its own PVC.

### 6.15. E13. The request path through authn → authz → admission (KM09)

A `kubectl create deployment` request from one of three subjects (administrator, ServiceAccount `deployer`, user `jane`) passes through four gates: authentication (who: certificate, token) → RBAC authorization (is it allowed: which RoleBinding granted the right) → mutating admission → validating admission (PSA, quotas). At each gate — the real answer on rejection (`Unauthorized`, `Forbidden`, `violates PodSecurity "restricted:latest"`). *The RBAC matrix* under the diagram: "subject × verb × resource", filled in as Roles and RoleBindings are created; a click on a cell shows which binding granted the right. *Switches:* the request namespace, the namespace PSA level, `runAsNonRoot` in the pod.

### 6.16. E14. Helm: from values to a release (KM11)

The template and values on the left, the rendered manifest on the right; editing values redraws the manifest immediately, with changed lines highlighted. *Steps:* `helm install` → render → manifests into the API → Secret `sh.helm.release.v1.blog.v1`. `helm upgrade` shows the diff between revisions, `helm rollback 1` creates revision 3 with the contents of the first one (a frequent interview question). *Break it:* an indentation error in the template (an error with a line number, as in Helm); `required` without a value.

### 6.17. E15. GitOps: from `git push` to a pod (KM12)

Three columns: the repository (commits), the Application (status `Synced/OutOfSync`, `Healthy`), the cluster. *Steps:* a commit changing the replicas → Argo CD notices the difference → `OutOfSync` → sync → the Deployment is changed → the chain of loops from E2 (screen 4, collapsed). *Switches:* auto-sync, prune, selfHeal. A manual `kubectl scale` with selfHeal is rolled back — on the diagram the Argo CD loop is the same as the ReplicaSet one, only the desired state is in Git. Deleting a file with prune deletes the resource. Link to C11: an image built by the learner's CI changes the tag in the repository — the same path.

### 6.18. The practice workspace

Layout: on the left, the task text and hints; in the center, the terminal; on the right, the "cluster map" — nodes as racks, pods inside them colored by phase, Services as ovals with lines to ready pods, ReplicaSets and Deployments as owner frames. The map updates via watch: `kubectl scale --replicas=5` is visible immediately. A click on a pod shows its YAML, events, logs. Under the map is the virtual clock strip. On a phone the map and the terminal are two tabs. For L0 the map is open, for L2 it is collapsed (as in the CKA, where there is no map); exams run without the map.

Above every output block in the terminal there is an "explain" button (`explain-output` mode, 09/4.5); above the output of `describe pod` in an error state there is a "why?" button, which first shows an analysis from the database of known causes (without an AI model) and only then offers to ask the model.

## 7. The documentation ladder (R2)

### 7.1. Four kinds of sources and their anatomy

The block builds the habit of reading documentation the same way as the theory: from showing to requiring. First the learner finds out how the pages they will have to read are structured (the "Help" section of the Linux block, M3, already taught the anatomy of `man`: SYNOPSIS, OPTIONS, EXAMPLES).

| Source | The anatomy we teach | How it differs from `man` |
|---|---|---|
| `kubectl <command> --help` | description; **Examples**; **Options**; **Usage**; a link to `kubectl options` for global flags | in kubectl the examples come before the flags, and the Usage template is at the end |
| `kubectl explain <resource>.<field>` | `GROUP`, `KIND`, `VERSION`, `FIELD: <name> <type>`, `DESCRIPTION`, `FIELDS` with types and `-required-`; `--recursive` — a tree | this is help for API object fields, not for a command; the dotted path = the path in the YAML |
| kubernetes.io/docs | *Concepts* (why and how it works), *Tasks* (step-by-step instructions with YAML), *Tutorials*, *Reference* (API, kubectl, component flags) | the kind of page is determined by the URL path; a task is looked for in Tasks, a field in Reference or `explain` |
| Project documentation | helm.sh/docs, gateway-api.sigs.k8s.io, argo-cd.readthedocs.io, docs.k3s.io, etcd.io/docs, docs.cilium.io | each version has its own documentation: first check which version you have |

`--help` and `explain` in the terminal are rendered in "page anatomy": sections are marked with labels in the margins ("this is Usage — the command template", "this is Options — the flags"), and at rung 2 the needed line is highlighted.

### 7.2. A documentation mirror inside the trainer

The external kubernetes.io cannot be embedded: the platform CSP is `frame-src 'none'` (09/6.4); besides, the exact version and offline work are needed. Therefore we build our own mirror: `kubernetes/website` on the v1.37 release branch (CC BY 4.0, attribution is given on every page), gateway-api.sigs.k8s.io (Apache-2.0), helm.sh/docs (the `helm/helm-www` repository; the license must be checked before inclusion, until then Helm pages open as an external link in a new tab), etcd.io/docs version 3.6. The Hugo build is turned into static HTML fragments under `/docs/k8s/v1.37/...`, search uses our own index (MiniSearch), about 2–3 MB gzip for the whole set, lazily, in Cache Storage via the Service Worker. The mirror can do what the original cannot: highlight the needed line (`?hl=<anchor>`), collapse everything except the needed section, show anatomy labels and record which pages the learner opened (only for review and the mentor, it does not affect grading).

### 7.3. Rungs by level

| Rung | What it looks like in the block | L0 | L1 | L2 |
|---|---|---|---|---|
| 1. Glimmer | Under a command or field from the lesson — a thin line "where this comes from: `kubectl rollout undo --help`, the Examples section" and a link to the exact place in the mirror. Opening it is optional | KM00–KM03 | — | — |
| 2. A fragment as a hint | The second-level hint is not a ready command but a fragment of `--help`, `explain` or a page with the line highlighted and anatomy labels | the KN section, KM05 | KM00–KM02 | — |
| 3. Find the flag | "Find the flag that does X": the hint contains only a link to the page without an anchor; graded by the state achieved | KM06–KM09 | KM03–KN8 | the whole block from the start |
| 4. Requiring | The task requires something that was not in the theory; no hints; the "ask the AI" button switches on `docs` mode | KM11, KM14, KM16 | KM05 and further | from KN4 onwards |
| 5. Exam | Only the mirror of kubernetes.io, helm.sh/docs and gateway-api.sigs.k8s.io is open — as in the CKA per the Linux Foundation list ([Resources Allowed](https://docs.linuxfoundation.org/tc-docs/certification/certification-resources-allowed)); the AI is off; 20–30 % of the points are for things that were not in the course | exam B | exam I | exam E |

A beginner is not sent to the documentation from scratch: at rungs 1–2 the documentation is a hint, not an obstacle; rung 4 starts for them only after a couple of dozen modules, when they have already seen hundreds of `--help` fragments. An experienced learner starts at rung 3: they have no glimmering links, and hints are links to pages right away.

### 7.4. Rungs 1–2 by module (examples)

| Module | Rung 1 | Rung 2 |
|---|---|---|
| KM01 | next to `kubectl explain pod.spec.containers` — a link to *Reference → Pod v1* | hint for D02: a fragment of `kubectl describe --help`, Examples, with `kubectl describe pods/nginx` highlighted |
| KM03 | next to `kubectl rollout undo` — [kubectl rollout undo](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_rollout/kubectl_rollout_undo/) and `kubectl explain deploy.spec.strategy` | hint for D05: a fragment of `kubectl rollout undo --help`, Examples, with `--to-revision=3` highlighted; hint for D04: a fragment of `kubectl set image --help`, with `kubectl set image deployment/nginx busybox=busybox nginx=nginx:1.9.1` highlighted |
| KN4 | next to `targetPort` — [Service: defining a Service](https://kubernetes.io/docs/concepts/services-networking/service/#defining-a-service) | a fragment of `kubectl explain service.spec.ports.targetPort`, with "Number or name of the port to access on the pods targeted by the service" highlighted |
| KN5 | next to `ndots` — *DNS for Services and Pods → Pod's DNS Config* | a fragment of `kubectl explain pod.spec.dnsConfig.options` |
| KM05 | next to `envFrom` — *Configure a Pod to Use a ConfigMap* | a fragment of `kubectl create configmap --help`, with `--from-env-file` highlighted |
| KM06 | next to `livenessProbe` — *Configure Liveness, Readiness and Startup Probes* | a fragment of `kubectl explain pod.spec.containers.readinessProbe.httpGet` |
| KM15 | — | a fragment of the *Upgrading kubeadm clusters* page, with `kubeadm upgrade plan` highlighted |

### 7.5. Rung 3: "find the flag"

| ID | Module | Task | Answer (not shown) | Check |
|---|---|---|---|---|
| F01 | KM01 | List the pods so that the IP and node are visible, without reading `describe`; enter the IP of pod `web` | `-o wide` | the value matches `k8s.objects[kind=Pod][metadata.name=web].status.podIP` |
| F02 | KM01 | Show the container logs from before the last restart; write down the last line | `logs --previous` | the file matches the log line of the previous run |
| F03 | KM02 | List the pods with all labels; enter the value of the `tier` label on pod `api-0` | `--show-labels` | the value matches |
| F04 | KM03 | Look at the pod template of revision 2 of the Deployment; enter the image | `rollout history --revision=2` | the image of revision 2 |
| F05 | KM03 | Roll the Deployment back to the specific revision 1 | `rollout undo --to-revision=1` | image = the image of revision 1 |
| F06 | KN4 | Find in `explain` which Service field pins a client to one pod, and enable it | `spec.sessionAffinity` | `k8s.objects[kind=Service][metadata.name=web].spec.sessionAffinity=ClientIP` |
| F07 | KM06 | Sort the pods by number of restarts; write the names to a file | `--sort-by=.status.containerStatuses[0].restartCount` | the file matches the expected order |
| F08 | KM07 | Run a Job from an existing CronJob without waiting for the schedule | `create job --from=cronjob/…` | a Job with the annotation `cronjob.kubernetes.io/instantiate: manual` |
| F09 | KM09 | Find out whether SA `ci:deployer` can delete pods, without switching context | `auth can-i --as=system:serviceaccount:ci:deployer` | answer `no` in the file |
| F10 | KM03 | Wait for the rollout to finish, but no longer than 60 s | `rollout status --timeout=60s` or `wait --for=condition=Available --timeout=60s` | Deployment Available; `history` is only for review |
| F11 | KM14 | In the k3s installation script, find the variable that pins the version | `INSTALL_K3S_VERSION` | the answer in a file; a node with the pinned version |
| F12 | KM15 | Find out how to check the expiration dates of the control plane certificates | `kubeadm certs check-expiration` | a file with the command output, `files[...]` contains `CERTIFICATE AUTHORITY` |

### 7.6. Rung 4: requiring

What is needed was not in the theory; there are no hints.

| ID | Module | Task | What has to be found | Where the answer is | Check |
|---|---|---|---|---|---|
| X01 | KN4 | The image of pod `api` has no shell and no curl. Check from inside its network namespace whether it listens on 8080 | `kubectl debug -it api --image=trainer/client --target=api` | Tasks → Debug Running Pods | the pod got `ephemeralContainers`; the "yes/no" answer is correct |
| X02 | KM06 | Pod `slow` must receive SIGTERM only 20 s after deletion, so that the application has time to close connections | `lifecycle.preStop.sleep.seconds: 20` + `terminationGracePeriodSeconds ≥ 30` | `explain pod.spec.containers.lifecycle` | the fields are set; in the kubelet log SIGTERM comes after 20 s |
| X03 | KM07 | A Job must fail if it runs longer than 60 s | `activeDeadlineSeconds` | `explain job.spec` | Job `Failed`, `reason: DeadlineExceeded` |
| X04 | KM07 | Finished Jobs older than 5 minutes must disappear by themselves | `ttlSecondsAfterFinished` | Concepts → Automatic Cleanup for Finished Jobs | after 5 min of virtual time the Job is gone |
| X05 | KM08 | A pod must get a volume from a StorageClass that lives exactly as long as the pod | generic ephemeral volume | Concepts → Ephemeral Volumes | a PVC with an ownerReference to the pod; after the pod is deleted the PVC is gone |
| X06 | KM09 | Get a token for SA `ci-bot` valid for 10 minutes | `kubectl create token ci-bot --duration=10m` | `create token --help` | the token is a JWT with `exp − iat = 600` |
| X07 | KM10 | Pods `web` must be spread evenly across zones `zone=a/b` with a difference of no more than 1 | `topologySpreadConstraints`, `maxSkew: 1` | Concepts → Pod Topology Spread Constraints | after scaling to 5 the difference between zones is ≤ 1 |
| X08 | KM11 | Render only `templates/service.yaml` from the chart without installing anything | `helm template … --show-only templates/service.yaml` | helm.sh/docs → helm template | the file matches the reference render |
| X09 | KM13 | Make the `spec.size` field of CR `Website` immutable after creation | CEL `x-kubernetes-validations: [{rule: "self == oldSelf"}]` | Tasks → Extend the Kubernetes API with CRDs → Validation rules | an edit of `size` is rejected with the rule's message |
| X10 | KM16 | Find out which kube-apiserver health checks are failing | `kubectl get --raw='/readyz?verbose'` | Reference → Kubernetes API health endpoints | the answer in the file matches the name of the broken check |
| X11 | KN4 | Traffic from a pod to a Service must stay on its node | `internalTrafficPolicy: Local` | Concepts → Service Internal Traffic Policy | the field is set; a probe from a node without a backend is refused, from a node with a backend — 200 |
| X12 | KM15 | Restore etcd from a snapshot; the instruction from a 2023 blog (`etcdctl snapshot restore`) does not work | `etcdutl snapshot restore` | etcd.io/docs v3.6 → Disaster recovery | etcd is brought up from a new directory, the snapshot's objects are in place |
| X13 | KM15 | A node does not join: the token has expired | `kubeadm token create --print-join-command` | kubeadm token reference | the node is Ready |
| X14 | KM14 | The learner enables the Gateway API for the built-in k3s Traefik on their own | `HelmChartConfig` with `providers.kubernetesGateway.enabled: true` | docs.k3s.io → Helm → customizing packaged components; doc.traefik.io → Kubernetes Gateway provider | GatewayClass `traefik` `Accepted=True` |

### 7.7. The `docs` AI mode

Added to the 09/4.5 modes; switched on at rung 4 and in KM16. The model's first reply to any question is "Where have you already looked?" with three buttons: `--help`, `kubectl explain`, kubernetes.io. After that the model names neither the flag nor the field. It names the kind of source and the section: "this is a pod field, not a container field — look at `explain` one level up"; "this is a task, not a concept — look in Tasks"; "check which version the instruction was written for". If the learner names a place, the model hints at the section of the page (Examples, FIELDS), but not the line. In addition, the engine collapses any `cmd` block and any match with the scenario's `answer_terms` words into a button "Show — the task will be counted as completed with a hint".

## 8. Trainers (drills)

A trainer is a 2–10 minute task with random parameters (names, images and numbers change on every run), so that it can be repeated until it becomes automatic. It is graded by goals per 09/2.4. The time is recorded; L2 trainers have a time limit, as in the CKA. Hints follow the learner's documentation ladder rung (7.3).

### 8.1. Core

| ID | Lvl | Module | Task | Goal (brief) |
|---|---|---|---|---|
| D01 | L0 | KM01 | Run pod `hello` from image `trainer/web:1.0` and look at its logs | the pod is Running |
| D02 | L0 | KM01 | Pod `broken` does not start. Find the cause in the events and write it as one word into `answer.txt` | `files[answer.txt].text` = `ImagePullBackOff` or `ErrImagePull` |
| D03 | L0 | KM02 | Create ReplicaSet `web` with 2 replicas from a manifest, then increase it to 4 | `k8s.objects[kind=ReplicaSet][metadata.name=web].status.readyReplicas=4` |
| D04 | L0 | KM03 | Update `web` to `trainer/web:1.1` and wait for the rollout to finish | all pods with image 1.1, condition Available |
| D05 | L0 | KM03 | The upgrade to `:2.0` broke the application. Bring back the previous version | image 1.1; `k8s.timeline` — never fewer than 1 ready pod |
| D06 | L0 | KN4 | Expose `web` inside the cluster under the name `web` on port 80 | `http.web-from-client.status=200` |
| D07 | L0 | KN6 | Make `web` reachable from outside via NodePort 30080 | Service NodePort 30080; the "external client" probe → 200 |
| D08 | L0 | KM01 | Save the manifest of Deployment `web` to a file without creating the object, and create it from the file | the file is valid, the object is created and matches the file |
| D09 | L0 | KM05 | Pass a greeting to the application via ConfigMap `web-config`, key `GREETING` | env from configMapKeyRef; the application's answer contains the text |
| D10 | L0/L1 | KM06 | A pod is in CrashLoopBackOff. Find the error message of the previous run | the file matches the log line of the previous run |
| D11 | L1 | KM06 | Add readiness on `/ready` and liveness on `/healthz` with a 5 s delay | the probe fields are set; the pods are Ready |
| D12 | L1 | KM06 | Pod `hog` is killed by OOM. Raise the memory limit so that it works, but no more than 512Mi | `limits.memory ≤ 512Mi`; 60 s of virtual time without a restart; on the hybrid `memory.max` equals the limit |
| D13 | L1 | KM06 | HPA for `web`: from 2 to 6 replicas at CPU 50 %; apply load and wait for scaling | the HPA exists; `k8s.timeline` replicas.max ≥ 4 |
| D14 | L1 | KM07 | A CronJob runs `trainer/job` every 5 minutes and keeps 2 successful runs | `successfulJobsHistoryLimit=2`; after 15 min of virtual time exactly 2 Jobs are Complete |
| D15 | L1 | KM07 | A log agent on every node, including the control plane | DaemonSet, a toleration for the control plane taint, desired=ready=3 |
| D16 | L1 | KM08 | PostgreSQL as a StatefulSet with a 1Gi PVC; delete the pod and make sure the table remained | the PVC is Bound; the data is in place after deleting `db-0` |
| D17 | L1 | KN6 | Expose `web` at `shop.example.test` through a Gateway and an HTTPRoute | HTTPRoute `Accepted`; a probe with the Host header → 200 |
| D18 | L1 | KN4 | Service `api` does not answer (selector) | scenario 5.6 |
| D19 | L1 | KM11 | Redis via a Helm chart with a password from values, then upgrade the release to 2 replicas | release revision 2; a Secret with the password; 2 replicas |
| D20 | L1 | KM12 | An application from a Git repository in Argo CD with auto-sync and selfHeal; change the replicas with a commit | Application Synced/Healthy; replicas from the commit |
| D21 | L2 | KM09 | ServiceAccount `deployer`: only Deployments in `ci` | `k8s.authz`: create/update deployments in `ci` — yes, in `default` — no, delete pods in `ci` — no |
| D22 | L2 | KN7 | Deny incoming traffic to the pods of namespace `db`, except from pods `app=api` in namespace `prod` on 5432 | api→db open; client→db closed; a pod `app=api` from `default` — closed (a check of "AND" in the selector) |
| D23 | L2 | KM10 | Take `worker-2` into maintenance without downtime (3 replicas, PDB minAvailable 2) | `worker-2` unschedulable, only DaemonSets on it; `k8s.timeline` readyReplicas.min ≥ 2 |
| D24 | L2 | KM10 | Pods are not scheduled on `worker-1`. Find and remove the cause | the taint is removed or a toleration is added (both count), the pods are distributed |
| D25 | L2 | KM15 | An etcd snapshot to `/opt/backup/etcd.db` (training kubeadm cluster, `ssh cp-1`) | the file exists; `etcdutl snapshot status /opt/backup/etcd.db -w table` passes; the certificates from `/etc/kubernetes/pki/etcd/` were used |
| D26 | L2 | KM15 | The API server does not come up after an edit (a typo in `--etcd-servers` of the static pod manifest) | the static pod is Running, kubectl answers |
| D27 | L2 | KM15 | The kubelet on `worker-1` is stopped. Bring the node back to Ready | the node is Ready; `units[kubelet.service].active=active` |
| D28 | L2 | KM13 | CRD `Website` (`spec.replicas` 1–5); make sure the API will not accept an object with `replicas: 7`, and create a correct one | a CRD with validation; an object with 3 exists |
| D29 | L2 | KM09 | Access for user `jane` via a CSR and a kubeconfig with context `jane@trainer` | the CSR is Approved; the context is in the kubeconfig; `auth whoami --context jane@trainer` → jane |
| D30 | L2 | KM06 | Find the pod with the highest CPU usage across all namespaces and write its name to a file | the file matches the metrics-server-lite data |

### 8.2. Kubernetes networking

| ID | Lvl | Module | Task | Goal |
|---|---|---|---|---|
| N-D1 | L0 | KN2 | Find out the IP of pod `web-…` and check that pod `client` reaches it by IP | file = the pod IP from the facts; `http.client-to-pod.status=200` |
| N-D2 | L0/L1 | KN4 | On node `worker-1`, find in the NAT rules which IP:port a packet to the ClusterIP of `web` will be rewritten to; write down all options | file = the set of DNAT addresses of `KUBE-SEP-*` (on the hybrid — from the real `iptables-save`), matches the ready addresses of the EndpointSlice |
| N-D3 | L1 | KN5 | A pod in `shop` resolves `api.github.com` slowly. Make no more than 2 queries per name reach CoreDNS, without changing the Corefile | `dnsConfig.options[name=ndots].value<=2` or an FQDN with a dot; the coredns-lite query counter per probe ≤ 2 |
| N-D4 | L1 | KN3 | Pods on `worker-2` are unreachable from other nodes, on the node itself everything works (UDP 8472 is closed) | a pod → pod probe across nodes gives 200; the rule is removed; the pods were not recreated |
| N-D5 | L1 | KN6 | The application must see the real client IP when coming in via NodePort | `spec.externalTrafficPolicy=Local`; the pod log contains `203.0.113.50` |
| N-D6 | L1 | KN7 | After `default-deny` in namespace `api`, all names stopped working. Allow only what is needed | egress to `kube-dns` UDP/TCP 53 is allowed; api→db:5432 open; api→example.com closed |
| N-D7 | L2 | KN7 | The `default-deny` policy has been created, but traffic flows. Why? | the answer in a file ("the CNI does not enforce policies"); enabling kube-router-lite (`--disable-network-policy` removed) → the probe times out |
| N-D8 | all | KN8 | "The pod could not reach": a random breakage out of six (Service name, namespace in the name, selector, `targetPort`, readiness, NetworkPolicy). Write the layer of the breakage into `diagnosis.txt` and fix it | exactly the planted breakage is fixed (`keep`: the same pods and Service); the file contains one of `dns`, `service`, `endpoints`, `pod`, `policy` and matches the planted one; the review shows the learner's path along the layer ladder |
| N-D9 | L2 | KN4 | A pod calls its own Service and gets a timeout (on the hybrid `br_netfilter` is unloaded) | the module is loaded; the hairpin probe gives 200 |

## 9. Quizzes

A quiz closes every module: 8–12 questions, a threshold of 80 %, a wrong answer immediately shows an explanation and a link to the lesson screen (AI mode `review`). Types: single answer, multiple answers, ordering, "find the error in the YAML" (click on a line), "what will the command output" (options of real output), "match the symptom and the component". The bank at launch has at least 25 questions per module. Examples:

- *KM01, single answer.* You ran `kubectl delete pod web` for a pod created with `kubectl run web`. What will happen? (a) a new pod will appear; (b) the pod will disappear forever; (c) kubectl will ask for confirmation. Correct: (b): a standalone pod has no controller. The explanation leads to KM02.
- *KM03, ordering.* Put in order: the scheduler chooses a node; the ReplicaSet controller creates pods; the write to etcd; the kubelet starts the container; the Deployment controller creates a ReplicaSet.
- *KN4, find the error.* A Service with `selector: app: web` and `targetPort: 8080`, the application in the pod listens on 80 — click on `targetPort`. Explanation: "a Service sends to `targetPort`. `containerPort` is only a description; which port the process listens on is shown by `kubectl exec … -- ss -ltn`".
- *KN3, single answer.* Why does an external service see the node's address in requests from a pod? Correct: outgoing pod traffic beyond the podCIDR goes through MASQUERADE on the node.
- *KN7, single answer.* A policy has been created, the API accepted it, but traffic is not blocked. The most likely reason? Correct: the CNI does not enforce NetworkPolicy.
- *KM05, multiple answers.* What is true about Secrets: (a) by default the values are stored in etcd unencrypted; (b) anyone who can read Secrets in a namespace sees the values; (c) a Secret cannot be mounted as a file; (d) RBAC can restrict access to Secrets. Correct: (a), (b), (d). Explanation: base64 is only the representation in the API, not a storage method and not encryption.
- *KM06, what will it output.* A container exceeded limits.memory. What will the `Reason` be in `kubectl describe pod`? `Error`, `OOMKilled`, `Evicted`, `CrashLoopBackOff`.
- *KN6, single answer.* Why are new clusters in 2026 not installing ingress-nginx? Correct: the project was retired in March 2026, there are no more security updates.
- *KM15, matching.* `cni plugin not initialized` / `connection to the server … refused` / pods Pending without events — with CNI, kube-apiserver, kube-scheduler.
- *KM15, single answer.* `etcdctl snapshot restore` in a cluster with etcd 3.6 answers with an error. Why? Correct: in etcd 3.6 restoring was moved to `etcdutl`.

## 10. Practical exams

The exams are rung 5 of the documentation ladder. They run in the simulator in a mode close to the CKA: a timer, tasks in any order, each task has its own context (`kubectl config use-context …` at the start), the AI model is off (`exam` mode, 09/4.5), the cluster map is hidden, only the documentation mirror is open (7.2). 20–30 % of the points are for fields and commands that were not in the course. The passing score is 66 %. Each task is worth as many points as it has goals; partial completion gives part of the points. After the exam there is a review for each goal: what was expected, what there was, a link to the trainer and to the documentation page where the answer was.

**Which exam counts.** Per 01 §3.3 the block has one counting core exam for all levels: exam B and the I tasks, assembled into one stage 1 exam; exam E (modeled on the CKA) is an optional `pro` part, its result goes into the skills map, not into the "block passed" mark (decision of master document 00 §10).

Exams in the simulator are self-assessment (09/4.7): "here you are checking yourself; only you can see the result". The presentable part of exam E runs on real VMs with the agent in "with server" mode.

### 10.1. Exam B (L0): 7 tasks, 50 minutes

1. In namespace `exam`, Deployment `shop` from `trainer/web:1.0` with 3 replicas. (3 points)
2. Service `shop` on port 80 inside the cluster. (2)
3. Upgrade to `trainer/web:1.1`; the rollout must finish. (2)
4. Pod `report` does not start. Find the cause and fix it (a typo in the image tag). (2)
5. Pass `shop` the variable `GREETING=Hello` via a ConfigMap. (2)
6. Delete any `shop-…` pod and write into `answer.txt`, as one word, the type of object that brought it back. (1, answer `ReplicaSet`)
7. Pod `client` cannot find service `api`. Find on which rung of the layer ladder the breakage is, and fix it (the service is in another namespace). (2)

### 10.2. Exam I (L1): 11 tasks, 100 minutes

1. Deployment `api` with readiness `/ready`, liveness `/healthz`, requests 100m/128Mi, limits 500m/256Mi.
2. HPA for `api`, 2–5 replicas at CPU 60 %.
3. Secret `db-cred` with keys `user`, `password`; mount it into `api` as files in `/etc/db`.
4. StatefulSet `cache` (redis) with 2 replicas, a 1Gi PVC per replica and a headless Service.
5. Gateway `public` and an HTTPRoute: `/api` → `api`, `/` → `web`.
6. CronJob `cleanup` once an hour, `concurrencyPolicy: Forbid`; finished Jobs are deleted after 10 minutes (outside the course: `ttlSecondsAfterFinished`).
7. Fix service `orders`: `targetPort` does not match the port the process listens on.
8. Pod `worker` is Pending: the memory request is larger than any node. Reduce the request to a value at which it gets scheduled, without changing the limits.
9. Install chart `trainer/web` as release `blog` with `replicaCount=2`, then roll back to revision 1 after a failed upgrade.
10. Connect the `apps/blog` directory of the repository to Argo CD with auto-sync.
11. NetworkPolicy: pod `db` accepts traffic only from `api`; DNS from `api` works.

### 10.3. Exam E (L2, modeled on the CKA): 16 tasks in the simulator, 120 minutes, plus 2 tasks on real VMs

The tasks are distributed according to the CKA domain weights: troubleshooting 30 %, architecture and installation 25 %, services and networking 20 %, workloads and scheduling 15 %, storage 10 %. Tasks 5, 12 and 14 require fields that are not in the course.

| # | Domain | Task |
|---|---|---|
| 1 | Troubleshooting | Node `worker-1` is NotReady (the kubelet is stopped); bring it back |
| 2 | Troubleshooting | kube-apiserver does not start after a manifest change; fix it |
| 3 | Troubleshooting | Application `pay` answers every other time (one replica without readiness and with an error); find and fix it |
| 4 | Troubleshooting | CoreDNS does not answer (the `coredns` ConfigMap is broken); fix it |
| 5 | Troubleshooting | Write to a file the names of pods across all namespaces that restarted more than 3 times, sorted by the number of restarts (`--sort-by`, `custom-columns`) |
| 6 | Architecture | An etcd snapshot to `/opt/backup/etcd-$(date +%F).db` |
| 7 | Architecture | Restore etcd from `/opt/backup/etcd-old.db` (`etcdutl snapshot restore … --data-dir /var/lib/etcd-from-backup`) and switch the `hostPath` of the data volume in `/etc/kubernetes/manifests/etcd.yaml` |
| 8 | Architecture | Group `auditors` can read everything except Secrets across the whole cluster |
| 9 | Architecture | Install a Gateway API controller (traefik-lite) via Helm into `gateway-system` with the given values |
| 10 | Architecture | CRD `Backup` with a status subresource and validation of a cron schedule string |
| 11 | Networking | NetworkPolicy: `db` accepts only from `api` on 5432; outgoing DNS from `api` is allowed |
| 12 | Networking | Service `web` must prefer backends in the same zone (`trafficDistribution`) |
| 13 | Workloads | Take `worker-2` into maintenance respecting the PDB, then bring it back |
| 14 | Workloads | Job `import` must not be retried if the container exited with code 42 (`podFailurePolicy`) |
| 15 | Storage | PV `manual-pv` (hostPath, 2Gi, Retain) and a PVC that binds to exactly that PV |
| 16 | Storage | Expand PVC `data` from 1Gi to 2Gi (a StorageClass with `allowVolumeExpansion`) |

Tasks on real VMs (the stage 3 cluster, 11.4): upgrade the kubeadm cluster to the next minor version (the control plane, then one worker at a time with drain/uncordon) and restore operation after a breakage. The breakage is introduced by the `trainer-check` agent with a signed package in "with server" mode (09/5.6): it stops the kubelet on a worker, corrupts `--etcd-servers` or plants an expired kubelet certificate. Without a server these tasks are not presentable and run as self-assessment: the learner introduces the breakage themselves with a command that the trainer shows in full, and the agent checks the repair in "without server" mode.

## 11. Real stage: three stages

### 11.1. Stages

| Stage | Where | Who | What the trainer does |
|---|---|---|---|
| 1. Browser | kube-lite and the hybrid (5.9) | everyone | executes and checks |
| 2. One real node (KM14) | k3s on one VM (in the learner's cloud or a local one) **or** kind, minikube, k3d on one's own computer | all levels | guides step by step, checks with the agent |
| 3. Full cluster (KM15, block B3 after IaC) | 3 VMs, kubeadm | all levels: L0 — by the full checklist, L1 — by a skeleton, L2 — from scratch | guides, does not execute; checks with the agent; shows the cost; mandatory cleanup |
| 3-IaC | the same 3 VMs, ordered by Terraform and configured by Ansible | after the IaC block | the final exam of the IaC block (document 06) |

| Track | Stage | What is installed | Machines |
|---|---|---|---|
| R1 | 2 | k3s on one node or kind/minikube/k3d; the course Helm chart from an OCI registry; a Gateway via Traefik; Ingress as a second option; an image from the learner's CI (C11) | 1 × 2 vCPU / 4 GB |
| R3 | 3 | kubeadm + containerd + Cilium, 1 control plane + 2 workers; storage; certificates; etcd snapshot and restore via `etcdutl`; an upgrade; a breakage and repair | 3 × 2 vCPU / 4 GB |
| R3-iac | 3-IaC | R3, but the VMs via Terraform, the nodes with the Ansible role `kubeadm_node` | the same |
| R5 | 3 | Pet project: the operator from KM13 in Go (kubebuilder) in the R1 or R3 cluster | the same |

The former track "k3s on three nodes with Argo CD" has been merged into R1 (Argo CD is installed on one node) and R3 (the multi-node part). The former R4 (upgrade) became step 7 of track R3.

Versions as of the document date: Kubernetes v1.37 was released on 26.08.2026 ([kubernetes.io blog](https://kubernetes.io/blog/2026/08/26/Kubernetes-v1-37-release/)), v1.36 on 22.04.2026 ([kubernetes.io blog](https://kubernetes.io/blog/2026/04/22/kubernetes-v1-36-release/)). k3s in R1 is installed with a pinned version (`INSTALL_K3S_VERSION`, the value in `providers.yaml` is updated when the golden recordings are re-recorded); kubeadm in R3 is pinned to v1.36.x, so that the upgrade step to v1.37 makes sense.

### 11.2. Where to get machines and how much it costs

The list of options, the terms and the price sources are one `providers.yaml` table per course, maintained by 09/5.2 (Yandex Cloud, VK Cloud, Selectel, Timeweb Cloud, AWS Free plan, Oracle Always Free, Hetzner per [docs.hetzner.com](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/), one's own machine with local VMs: Multipass, Vagrant, UTM, 09/5.3). The block adds a column "which tracks fit": R1 — into all options; R3 — into all except Oracle Always Free (up to two VMs); one's own machine for R3 — with 12+ GB of RAM.

A calculator in the interface: the learner chooses a provider and a track, the trainer fills in the number of VMs and the rate and computes `VMs × price_per_hour × hours + IPv4 × hours`; next to it, in large type — "how much it will cost if you forget to delete it for a month". For local VMs the calculator shows 0 and instead of a price checks whether there is enough memory: three VMs need 12+ GB of RAM.

The machines always belong to the learner: the course does not hand out VMs and does not pay for them. The trainer neither creates nor stops them, so the learner is reminded about money by the price screen before ordering and the counter while they run, and cleanup (11.6) is mandatory. The learner reaches the VMs directly over ssh: a cloud VM by its public address, a local VM by its address in the hypervisor's network.

### 11.3. Stage 2: the R1 checklist

The checklist is a screen with step cards; each is ticked manually or by the agent. It can be opened on a phone via a QR code (`handoff`, 08/3.9): the terminal on the laptop, the steps and the check on the phone.

1. **Machine.** One Ubuntu 24.04 VM with the label `trainer=devops` (we delete by it later) or kind/minikube/k3d on one's own computer. For one's own computer, steps 2–3 are replaced by the cluster creation command of the chosen tool.
2. **Firewall.** From outside, 22 and 80/443 are open; 6443 — only from the learner's IP.
3. **Installing k3s while reading the script.** `curl -sfLo install-k3s.sh https://get.k3s.io && less install-k3s.sh`, then `INSTALL_K3S_VERSION=<version from the trainer> sh install-k3s.sh server --write-kubeconfig-mode 600 --tls-san <public IP>`. Rung 3: "find in the script the variable that pins the version" (F11). Check: `sudo k3s kubectl get nodes`.
4. **Kubeconfig to one's own machine.** Copy `/etc/rancher/k3s/k3s.yaml`, replace `127.0.0.1` with the public IP; `kubectl get nodes` from the laptop.
5. **Gateway API for the built-in Traefik.** By default the Gateway API provider in the k3s Traefik is disabled. Rung 4 (X14) for L1/L2; for L0 — a ready file:

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

   Check: `kubectl get gatewayclass` shows `traefik` with `ACCEPTED True`. The Gateway API CRD version and the behavior are in `hold`, confirmed by a k3d golden recording ([Traefik: Kubernetes Gateway provider](https://doc.traefik.io/traefik/v3.6/reference/install-configuration/providers/kubernetes/kubernetes-gateway/), [k3s: customizing packaged charts](https://documentation.suse.com/cloudnative/k3s/latest/en/add-ons/helm.html)).
6. **The course Helm chart from an OCI registry.** `helm install web oci://ghcr.io/<org>/charts/trainer-web --version <v> -n shop --create-namespace`; the Gateway and HTTPRoute come from the chart values; Ingress is the second option of the same exposure.
7. **An image from one's own CI.** The image built by the learner's pipeline in the CI/CD block (C11), in their registry; for a private registry — `imagePullSecrets`. The pod pulls the image by digest.
8. **Argo CD** (L1/L2). `helm repo add argo https://argoproj.github.io/argo-helm && helm install argocd argo/argo-cd -n argocd --create-namespace`; an Application pointing at the learner's training repository.
9. **Check by the agent** (11.5).
10. **Cleanup** (11.6).

R1 goals: the node is Ready, system pods (coredns, traefik, local-path-provisioner, metrics-server) are Running; the release is `deployed`; `HTTPRoute Accepted`; `status.containerStatuses[].imageID` contains `sha256:`; HTTP via the Gateway → 200 (the agent's probe, 11.5); for L1/L2 — the Application is Synced and Healthy.

### 11.4. Stage 3: the R3 checklist (kubeadm)

**Part A — inside the Kubernetes block, without IaC.** The VMs are ordered by hand in the provider's console or CLI, and on one's own computer they are created with `multipass launch` or `vagrant up`.

1. **Three VMs and a private network.** Names `cp-1`, `worker-1`, `worker-2`, label `trainer=devops`. Inter-node traffic goes only over the private network: in Hetzner — `hcloud network create --name trainer --ip-range 10.10.0.0/16 --label trainer=devops`, `hcloud network add-subnet trainer --type cloud --network-zone eu-central --ip-range 10.10.1.0/24`, VMs with `--network trainer`; in Yandex Cloud — all VMs in one VPC subnet; local VMs have the hypervisor's private network from the start. If the provider has no private network — encryption between nodes (Cilium with WireGuard, `--set encryption.enabled=true --set encryption.type=wireguard`, 51820/udp between nodes).
2. **Firewall.** From outside — 22 and 6443 (only from the learner's IP); 10250, 2379–2380 and the Cilium ports (8472/udp, 4240/tcp) — only from the private network.
3. **Preparing the nodes with the course script `prepare-node.sh`**, which the learner reads in full before running: disable swap, load the `overlay` and `br_netfilter` modules, sysctl `net.ipv4.ip_forward=1`, containerd with `SystemdCgroup = true`, the repository `pkgs.k8s.io/core:/stable:/v1.36/deb/`, `kubelet kubeadm kubectl`, `apt-mark hold`. Each item of the script links to the section of the kubeadm page *Installing kubeadm* it was taken from.
4. **`kubeadm init`** on `cp-1`: `--apiserver-advertise-address=<private IP> --pod-network-cidr=10.244.0.0/16`; L2 — with `--skip-phases=addon/kube-proxy` for Cilium without kube-proxy. The pod subnet does not overlap with the nodes' private network `10.10.0.0/16`.
5. **Cilium.** `cilium install --version <pinned> --set ipam.mode=kubernetes` (the pod subnet is taken from `--pod-network-cidr`); L2 — plus `--set kubeProxyReplacement=true --set k8sServiceHost=<private IP of cp-1> --set k8sServicePort=6443`. `cilium status --wait`; `cilium connectivity test` — L2 only (it takes long). MTU: check `ip link` on the VM and the MTU of `cilium_vxlan`. The VM interface MTU differs between providers and hypervisors, and VXLAN takes 50 bytes off it; the course template relies on autodetection, and `trainer-check.sh` verifies that the MTU of `cilium_vxlan` equals the MTU of `eth0` minus 50 (09/5.3). If the provider itself wraps the VMs in an overlay and autodetection gets it wrong, the MTU is set explicitly with `--set MTU=<VM interface MTU − 50>`, otherwise large responses get lost (the MTU blackhole from 03). The flag values are in `hold`, confirmed by the daily golden recording.
6. **`kubeadm join`** of the two workers; X13 if the token has expired.
7. **Storage.** L1 — local-path-provisioner and a default StorageClass. L2 — `csi-driver-nfs` with an NFS server on `cp-1`: a real CSI driver, RWX, works with any provider and on local VMs.
8. **Certificates** (L2). `kubeadm certs check-expiration` (F12), `kubeadm certs renew apiserver`, restarting the static pod (by moving the manifest out of `/etc/kubernetes/manifests` and back).
9. **etcd.** `etcdctl snapshot save` with `--cacert/--cert/--key` from `/etc/kubernetes/pki/etcd/`; `etcdutl snapshot status`; restore — `etcdutl snapshot restore … --data-dir /var/lib/etcd-restore` and editing `hostPath` in `/etc/kubernetes/manifests/etcd.yaml` ([etcd: Disaster recovery](https://etcd.io/docs/v3.6/op-guide/recovery/)).
10. **Upgrade v1.36 → v1.37** (L2). The repository of the new minor version, `kubeadm upgrade plan`, `kubeadm upgrade apply`, `drain`/`uncordon` of each worker, `kubeadm upgrade node`.
11. **Breakage and repair.** The agent in "with server" mode introduces a breakage with a signed package; without a server the learner introduces it themselves with the command shown. The learner repairs it; the goal checks both the repair and `keep` (the same etcd, the same pods).
12. **The builder as a diagram of what was installed** (6.2, screen 5).
13. **Cleanup** (11.6).

L1 completes steps 1–7, 9 (without the restore) and 13; L2 — all of them.

**Part B — R3-iac, a return after the IaC block.** The same cluster is ordered with Terraform from the provider where the learner has an account (`hetznercloud/hcloud`, `yandex-cloud/yandex`, `selectel/selectel`, `hashicorp/aws`) and configured with the Ansible role `kubeadm_node` instead of `prepare-node.sh`; it is checked by the same agent track. A learner without a cloud account writes and applies Terraform in the in-tab cloud emulator (00 §6.13, provider `lab`), and builds the kubeadm cluster on three local VMs configured with the same role. This is the final exam of the IaC block, owned by 06. In the Kubernetes block this exam is only a link "you will come back here after IaC". Why not earlier: per 01/5, Terraform is introduced in block 7, and by that point the learner already has the pain of ordering three VMs by hand, which Terraform removes. Cost and cleanup are mandatory on both passes.

### 11.5. Check by the `trainer-check` agent

Per 09/5.4 there are two verifiers: a readable read-only script `trainer-check.sh` (self-assessment: a one-time code, a base64 block to paste into the browser) and the signing Go agent `trainer-exam` for presentable exams, which the learner installs on their own machine with `trainer-exam enroll <code>`. The command is `trainer-check run --track r1 --nonce <code>`. To prove that the facts were collected from a live cluster the learner has access to, the agent additionally reads the ConfigMap `trainer-proof`, where the learner put the same code. The Kubernetes block defines for the agent only the fact areas and the track's probes:

- **Reading without changes.** The agent first runs `kubectl api-resources -o name`, then reads each needed type separately; missing types (for example, `applications.argoproj.io` in R1 without Argo CD) are written into the facts as `absent` instead of failing the collection. Secrets are not read; from ConfigMaps only `trainer-proof` is taken.
- **The "not a simulator" sign** — the nodes' `kernelVersion`, `osImage`, `containerRuntimeVersion` and the `nonce`. `providerID` is not checked: for k3s without a cloud controller-manager it equals `k3s://<hostname>`, for kubeadm without a cloud it is empty.
- **Nodes (R3)** — over SSH or on the node itself: `kubeadm version -o json`, `crictl ps -o json`, `journalctl -u kubelet -o json -n 200`, `etcdutl snapshot status`.
- **HTTP reachability.** The browser does not do the probe: a `fetch` to `http://` from an HTTPS page is blocked as active mixed content, and local VMs or VMs behind the provider's NAT may have no incoming public address. Without a server the agent runs `curl` to the Gateway address from the node and, if there is a second node, from it; the report says exactly that: "proves that the Gateway works inside the nodes' network, but not reachability from the internet". With a server the external probe comes from `dt-api` — only ports 80/443 and only to an address confirmed by the `nonce` (otherwise it would be a scanner on demand).
- **`k8s.timeline` on a real cluster** — only in "with server" mode, where the agent holds a watch for the duration of the task.

### 11.6. Cleanup

The last step is mandatory: until it is ticked, the track is not considered complete. The trainer gives a delete command only by label and asks the learner to paste the output of a repeated listing in JSON format: it counts if the list is empty. Hetzner: `hcloud server list -l trainer=devops -o json`, deletion by these names, then `hcloud network delete trainer`. Yandex Cloud: `yc compute instance list --format json | jq -r '.[] | select(.labels.trainer=="devops") | .id'` and deletion by the list (filtering by labels with `--filter` is kept in `hold` until confirmed by the CLI reference). A day after the start of the track, the trainer reminds about the unfinished cleanup on the next visit. If the VMs were ordered with Terraform, cleanup is `terraform destroy` and `trainer-check.sh cleanup --provider <provider>` (09/5.7). Local VMs are deleted with `multipass delete --all && multipass purge` or `vagrant destroy -f`, and the output of `multipass list` or `vagrant status` with no machines left counts as passing.

## 12. Your own AI model in the Kubernetes block

The connection mechanism, the list of recommended models, key storage and the prompt layers are in 09/4. The model is not named in this document. The block defines what goes into layer 5 of the prompt (the environment, no more than 2500 tokens) and how the model behaves in the 09/4.5 modes.

Layer 5 for the block: `describe()` of the scene's widgets (the cluster map, the current explanation step); the YAML of the object the question is about, without `managedFields`, and its events; for "why Pending/CrashLoop" — the pod status, events, logs of the previous run, node states; the last 40 lines of the terminal after secrets are masked (including `client-key-data` and tokens from kubeconfig); the task text, but not the goals and not the solution. Layer 2 (term discipline) is taken from graph 3.1, taking the fog from 3.4 into account: the model must not name fields under fog.

Modes (names per 01 §16.1): `explain` in theory and explanations; `practice` in goals with checks — the hint ladder H1–H5, with no ready solution command at any rung (01 §16.2); `explain-output` on an output line; `review` after a quiz; `docs` at rung 4 and in KM16 (7.7); `exam` — the AI model is off in exams and in the readiness check. Before the model is called, the built-in database of causes always kicks in: 40 frequent states (ImagePullBackOff, CrashLoopBackOff, CreateContainerConfigError, OOMKilled, FailedScheduling for each plugin, an empty EndpointSlice, Forbidden, NetworkPolicy without CNI support and so on) with a ready explanation in two languages; the model is needed only where the database did not recognize the situation.

## 13. What we take from the Sankofa engine

| Sankofa mechanic | Where in the Kubernetes block |
|---|---|
| Magazine-style text delivery, scrolling scenes (`engine/scroll.ts`, progress `--p`) | The theory of all modules; in explanations scrolling moves the stepper's steps |
| Layers (`engine/layers.ts`) | Changing the level of examination: control plane → node → pod → process in a cgroup; the layer changes with a transition, without camera movement or parallax |
| Calm mode (`engine/calm.ts`, `prefers-reduced-motion`) | Animations become step-by-step frames; a flying packet becomes a table of hops |
| QR to the phone (`engine/qr.ts`) | Real stage checklists and the check on the phone; continuing a lesson on the phone |
| Lenses (`lenses`) | The `kubectl apply` path from the point of view of each component (E1) |
| Bilingual YAML blocks (`Bi`), block roles, `draft` | The lesson format (section 14); a lesson is not published while it contains `draft: true` |
| `hold` and the two-source rule, the verification log | Every version-dependent fact (default values, timelines, feature stages, installer flags) is kept in `hold` until it is confirmed by a documentation page and a second source (source code, KEP, release notes, a golden recording) with the version stated; every module has a "how we checked" page |
| Glossary cards `[[id|words]]` | The terms of graph 3.1; the card opens over the lesson, closing it returns to the same place and does not reset the terminal; fog cards (3.4) |
| Full-screen sheet (`sheet.ts`) | Object cards (YAML, events, logs), the exam review screen |

We do not take: the live ink `ink.ts` (Kubernetes components are a mechanism, not a metaphor; R5 and 08/5.1), the parallax with the "descending camera", the `clap.ts` sound (a decoration, R4 does not allow it).

## 14. Data formats

A lesson is `content/k8s/<module>/<lesson>.yaml`:

```yaml
id: kn4.clusterip
module: KN4
level: [L0, L1, L2]
sources:
  - {id: k8s-svc, mirror: "k8s/v1.37/docs/concepts/services-networking/service", en: "https://kubernetes.io/docs/concepts/services-networking/service/", ru: "https://kubernetes.io/ru/docs/concepts/services-networking/service/"}
scenes:
  - id: s2
    title: {ru: "Service — постоянное имя и адрес", en: "A Service is a stable name and address"}
    introduces: [K14]
    uses: [K09, K10, K12, N19, N04]
    explainer: {id: E7, screen: 1, scenario: lesson.kn4.clusterip}
    docs: {L0: {step: 1, ref: k8s-svc, anchor: defining-a-service}, L1: {step: 3, ref: k8s-svc}, L2: {step: 3, ref: k8s-svc}}
    blocks:
      - id: b1
        role: text
        draft: false
        en: "A Service gives a group of pods one stable name and address…"
        ru: "Service даёт группе подов одно постоянное имя и адрес…"
      - id: b2
        role: text
        hold: true
        check: "default ClusterIP range in k3s — confirm in docs.k3s.io and k3s source"
        facts: [{claim: "k3s service CIDR 10.43.0.0/16", k8s: "v1.37", sources: [k3s-docs, k3s-src]}]
        en: "…"
        ru: "…"
practice:
  - {scenario: lesson.kn4.expose, inline: true}
quiz: quiz.kn4
```

A scenario is section 5.6 (goals in the 09/2.4 format). A quiz question:

```yaml
id: q.kn4.targetport
type: find-line
level: [L0, L1]
uses: [K14]
yaml: |
  apiVersion: v1
  kind: Service
  ...
answer: {line: 9}
explain: {ru: "…", en: "…"}
lesson_ref: kn4.clusterip#s2
```

Fog fields are in `concepts.yaml` on the concept: `fog_paths: ["spec.tolerations", "status.qosClass"]`.

The learner's state is the 09/3.1 event log (`check.result`, `quiz.answer`, `hint.opened`, `placement.done` and so on); the block's progress is a table derived from the log, the block has no state structure of its own. The result of the real stage is a `CheckResult` with `env: vm`, the facts are `dt.facts/v1` with the `k8s` area.

## 15. Sources

Principle: every module has a pair of links, EN and RU. The Russian localization of kubernetes.io is incomplete, so the build checks every RU link; if the page does not exist, the RU version of the lesson shows the English page marked "in English" and gives a Russian second source. The documentation is taken for the version the trainer simulates, and that is exactly the version in the mirror (7.2).

| Module | EN | RU |
|---|---|---|
| KM00–KM01 | [Overview](https://kubernetes.io/docs/concepts/overview/), [Pods](https://kubernetes.io/docs/concepts/workloads/pods/), [kubectl reference](https://kubernetes.io/docs/reference/kubectl/), [Organizing cluster access using kubeconfig](https://kubernetes.io/docs/concepts/configuration/organize-cluster-access-kubeconfig/) | [Overview (RU)](https://kubernetes.io/ru/docs/concepts/overview/), [Kubernetes Basics (RU)](https://kubernetes.io/ru/docs/tutorials/kubernetes-basics/deploy-app/), [Glossary (RU)](https://kubernetes.io/ru/docs/reference/glossary/) |
| KM02 | [Labels and Selectors](https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/), [ReplicaSet](https://kubernetes.io/docs/concepts/workloads/controllers/replicaset/), [Controllers](https://kubernetes.io/docs/concepts/architecture/controller/), [Garbage collection](https://kubernetes.io/docs/concepts/architecture/garbage-collection/) | [Kubernetes Components (RU)](https://kubernetes.io/ru/docs/concepts/overview/components/) |
| KM03 | [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/), [Scheduler](https://kubernetes.io/docs/concepts/scheduling-eviction/kube-scheduler/), [Cluster architecture](https://kubernetes.io/docs/concepts/architecture/), [Node status](https://kubernetes.io/docs/reference/node/node-status/) | [Deploying an app (RU)](https://kubernetes.io/ru/docs/tutorials/kubernetes-basics/deploy-app/deploy-intro/) |
| KN1–KN3 | [Cluster networking](https://kubernetes.io/docs/concepts/cluster-administration/networking/), [k3s networking](https://docs.k3s.io/networking/basic-network-options), [Cilium docs](https://docs.cilium.io/) | [Networking in Kubernetes (translation, Habr)](https://habr.com/ru/post/442646) |
| KN4–KN5 | [Service](https://kubernetes.io/docs/concepts/services-networking/service/), [Virtual IPs and Service Proxies](https://kubernetes.io/docs/reference/networking/virtual-ips/), [EndpointSlices](https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/), [DNS for Services and Pods](https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/) | RU pages of kubernetes.io where available |
| KN6 | [Gateway API](https://kubernetes.io/docs/concepts/services-networking/gateway/), [gateway-api.sigs.k8s.io](https://gateway-api.sigs.k8s.io/), [Ingress NGINX retirement](https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/), [Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/), [Traefik Gateway provider](https://doc.traefik.io/traefik/v3.6/reference/install-configuration/providers/kubernetes/kubernetes-gateway/) | RU pages of kubernetes.io where available |
| KN7 | [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/) | [An introduction to Kubernetes network policies (Flant)](https://habr.com/ru/post/443190) |
| KM05 | [ConfigMaps](https://kubernetes.io/docs/concepts/configuration/configmap/), [Secrets](https://kubernetes.io/docs/concepts/configuration/secret/), [Encrypting data at rest](https://kubernetes.io/docs/tasks/administer-cluster/encrypt-data/) | RU pages where available |
| KM06 | [Probes](https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/), [Resource management](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/), [HPA](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/), [Pod lifecycle: termination](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination) | the same |
| KM07 | [Jobs](https://kubernetes.io/docs/concepts/workloads/controllers/job/), [CronJob](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/), [DaemonSet](https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/), [StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/) | the same |
| KM08 | [Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/), [Storage Classes](https://kubernetes.io/docs/concepts/storage/storage-classes/) | the same |
| KM09 | [RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/), [Service Accounts](https://kubernetes.io/docs/concepts/security/service-accounts/), [Certificates and CSR](https://kubernetes.io/docs/reference/access-authn-authz/certificate-signing-requests/), [Pod Security Admission](https://kubernetes.io/docs/concepts/security/pod-security-admission/), [Security context](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/) | RU pages where available |
| KM10 | [Taints and Tolerations](https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/), [Assigning Pods to Nodes](https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/), [Safely Drain a Node](https://kubernetes.io/docs/tasks/administer-cluster/safely-drain-node/) | the same |
| KM11 | [Helm docs](https://helm.sh/docs/), [Kustomize](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/) | [Helm: documentation in Russian](https://helm.sh/ru/docs/) |
| KM12 | [Argo CD](https://argo-cd.readthedocs.io/), [Flux](https://fluxcd.io/flux/), [OpenGitOps principles](https://opengitops.dev/) | — (the second source is chosen during proofreading, the lesson is in `hold`) |
| KM13 | [Custom Resources](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/), [Operator pattern](https://kubernetes.io/docs/concepts/extend-kubernetes/operator/), [CRD validation rules](https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/#validation-rules), [The Kubebuilder Book](https://book.kubebuilder.io/) | the same |
| KM14 | [k3s docs](https://docs.k3s.io/), [k3s: packaged components](https://documentation.suse.com/cloudnative/k3s/latest/en/add-ons/helm.html), [kind](https://kind.sigs.k8s.io/), [minikube](https://minikube.sigs.k8s.io/docs/) | there is no Russian k3s documentation; the second source is ["Kubernetes The Hard Way", Habr](https://habr.com/ru/amp/publications/808145) |
| KM15 | [kubeadm](https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/), [Upgrading kubeadm clusters](https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-upgrade/), [Certificate management with kubeadm](https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-certs/), [Operating etcd](https://kubernetes.io/docs/tasks/administer-cluster/configure-upgrade-etcd/), [etcd v3.6 announcement](https://etcd.io/blog/2025/announcing-etcd-3.6/), [etcd disaster recovery](https://etcd.io/docs/v3.6/op-guide/recovery/), [Kubernetes The Hard Way](https://github.com/kelseyhightower/kubernetes-the-hard-way) | the same |
| Exams | [CKA](https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/), [CKA program changes](https://training.linuxfoundation.org/certified-kubernetes-administrator-cka-program-changes/), [Resources Allowed](https://docs.linuxfoundation.org/tc-docs/certification/certification-resources-allowed) | — |
| Simulator | [Webernetes](https://github.com/ngrok/webernetes), [kwok](https://kwok.sigs.k8s.io/), [OpenAPI spec v3](https://github.com/kubernetes/kubernetes/tree/master/api/openapi-spec/v3), [k3d](https://k3d.io/), [quickjs-emscripten](https://github.com/justjake/quickjs-emscripten), [iximiuz Labs](https://labs.iximiuz.com/), [k8sgames](https://github.com/rohitg00/k8sgames) | — |
| Default values in `hold` | [Node Status: node-monitor-grace-period](https://kubernetes.io/docs/reference/node/node-status/), [KEP-4603](https://www.kubernetes.dev/resources/keps/4603/), [KEP-5593](https://www.kubernetes.dev/resources/keps/5593/), [DevClass on v1.37](https://www.devclass.com/devops/2026/08/27/kubernetes-cleans-house-bins-legacy-kube-dns-ipvs-and-cgroup-v1/5292767) | — |

## 16. Keeping it up to date

Once a month an automated job checks: whether a new minor version of Kubernetes, k3s, etcd, Cilium or Traefik has come out (re-recording the golden recordings of 5.7, the OpenAPI schemas and the documentation mirror of 7.2, reviewing the difference); whether the links in section 15 are alive and whether new RU pages of kubernetes.io have appeared; whether the prices and terms in `providers.yaml` are current (together with 09). Facts marked with a version get `hold: true` when the version changes, until an editor confirms them again from two sources. Every six months the CKA curriculum and the list of allowed resources are checked: a change in the domains changes the weights of exam E, a change in the list changes the composition of the mirror.

## 17. Development order

1. **The kube-lite core in `sim.worker.ts`**: a store with watch, apiserver-lite with structural OpenAPI validation, the Deployment/ReplicaSet/Namespace/GC controllers, the scheduler, kubelet-lite on top of dsim, the `trainer/*` images, kubectl `get/describe/logs/run/apply/delete/scale/rollout/set image/explain` with full `--help`. Golden recordings on k3d on the course's own CI runner — before the first lesson. KM00–KM03, trainers D01–D05, E2, E3, E4, the builder (with 08).
2. **The hybrid spike** (1 week, 5.9): two v86 nodes + `vswitch` + `dt-kubelet`. An "accept or postpone" decision based on the budgets, recorded explicitly.
3. **Networking on netlab**: cni-lite, kube-proxy-lite, coredns-lite, EndpointSlice, `ssh` to a node, `expose/exec/port-forward/debug`. The whole KN section, E1, E5–E10, trainers N-D1–N-D9. After this stage L0 can complete the main line — the first release. If the spike is accepted — hybrid nodes for KM01, KN2–KN4.
4. **The documentation mirror and the ladder**: building the v1.37 mirror, the anatomy of `--help`/`explain`, the first wave of F and X tasks, the `docs` mode (with 09).
5. **Configuration, resources, workloads, storage**: KM05–KM08, metrics-server-lite, HPA, Job/CronJob/DaemonSet/StatefulSet, PV/PVC, E11, E12. Stage 2 (R1) and the agent goals. Exam B.
6. **Security, scheduling**: RBAC, CSR, PSA, securityContext, taints/affinity/drain/PDB. KM09–KM10, E13, `k8s.authz`.
7. **Helm (wasm), Kustomize, Argo CD, isomorphic-git**: KM11–KM12, E14, E15, exam I.
8. **CRDs and the operator sandbox (QuickJS), the training kubeadm cluster with static pods and etcdctl/etcdutl**: KM13, KM15, stage 3 (R3), exam E, pet project R5. R3-iac — together with 06 after the IaC block.

The main risk is the simulator diverging from real Kubernetes in small details of output, which would make the learner memorize something untrue. Only the golden recordings close this risk, so they are set up at the first stage, before the first lesson. The second risk is the hybrid's memory; it is closed by the spike at stage 2 with a fallback path (`sim`) recorded in advance.

## 18. What is needed from other roles

| Role | What | Why |
|---|---|---|
| 01 | The graph changes from 3.2 (K09/K08, K26, K18, K23, K22, K29) and the new concepts K34–K48; the L1/L2 task table with the replacements from 2.2; the fog rule from 3.4 as a shared rule | one `concepts.yaml` for the linter |
| 02 | Confirmation that M15 introduces L33–L43 before the Docker block at all levels (already in 02/5.4) | the bridges in KM01, KM06, KM09 |
| 03 | In netlab: VXLAN (`ip link add … type vxlan`, FDB, UDP wrapping with outer and inner headers in the dissector), Geneve in the dissector; match modules `statistic`, `comment`, `mark`/`MARK`, `addrtype --dst-type LOCAL`; nft `numgen`, `vmap`, `fib`; `ip route … onlink`; `bridge fdb show`; MTU on VXLAN with ICMP frag-needed; `dns.<id>` facts. The VXLAN card in the protocol catalogue — at the intermediate level | the KN section, E6–E9 |
| 04 | The D10 chain for L0 explicitly names containerd and the shim; dsim creates pod containers on kube-lite nodes; `trainer/*` images for i386 in the course registry; `crun` in `lab-node` | CRI in KM03, the hybrid |
| 06 | Track R3-iac as the conclusion of the IaC block (Terraform modules for the learner's cloud providers and for the `lab` provider of the cloud emulator, the `kubeadm_node` role) | stage 3, part B |
| 08 | One "Kubernetes from blocks" builder with the step order from 3.1 and table 6.2; storyboards E1–E15 in blueprint style; `kubectl get endpointslices` instead of `get endpoints` in 08/6.4; the `--c-fog` token and fog in the `terminal` | section 6 |
| 09 | The hybrid memory profile (5.9); additions to the `dt-kernel` configuration; `vswitch` with netlab devices plugged in; `dt-kubelet` as a second consumer of `ttyS1`; the fact areas `k8s.timeline`, `k8s.authz`; the `docs-coach` AI mode; the documentation mirror in the Service Worker; the QuickJS sandbox; the probe from `dt-api` with the restrictions of 11.5 | sections 5.9, 7, 11 |

## Changes after review

Reviews: `reviews/05-kubernetes--by-03-networks.md` (hereafter "03", finding numbers) and `reviews/05-kubernetes--by-09-runtime-ai-architecture.md` (hereafter "09"). Plus the owner's requirements R1–R12, given after the first wave.

### What was changed

1. **Identifiers and order** (03-1, 03-10, 09-2, 09-3, 09-15). Section 3 was rewritten in terms of the 01 graph identifiers; the modules were renamed to `KM00…KM16` and `KN1…KN8`; wrong cross-block prefixes (`docker:yaml`, `linux:git`, `linux:ip`, `net:iptables` and others) were replaced with the 01 and 02 codes (L31, C04, N01, N17…). Graph changes (3.2) and new concepts K34–K48 were proposed. kubeconfig is introduced in KM01 in one scene (as K05 in 01), users and CSRs in KM09. Dependencies on CI/CD (C04, C11, C14) were added. The output fog rule (3.4) was introduced. Order violations were fixed: readiness and NetworkPolicy were removed from the networking "break it" modes until their own modules and come back later; the headless Service is introduced in KN5; the HPA button and metrics-server in the builder — from KM06; the control plane taint example — only from KM10; an explicit contrast between the three "namespaces"; VXLAN, ndots and eBPF were split across levels.
2. **One builder** (03-1, 09-3). The widget and storyboard are in 08/6.4; 05 sets the step order and the table of consequences (6.2).
3. **The shared worker and netlab** (03-2, 09-8). kube-lite is a module of `sim.worker.ts`; the pod network consists of netlab devices; cni-lite is a plugin, kube-proxy-lite is a rule generator for the netlab netfilter; pod containers are dsim. The Webernetes network code was rejected, with the reason. `ssh` to a node — from KN1.
4. **The "Kubernetes networking" section** (R9; 03-3, 09-10). Eight modules KN1–KN8 with lines of exposition: the network model, pod to pod on a node and across nodes, Service, DNS, ingress from outside, NetworkPolicy, the "pod could not reach" method; pod SNAT, MTU, MetalLB, conntrack, hairpin, CNI-side policy support; explanations E6–E10; trainers N-D1–N-D9 (including "find in iptables where a packet to the ClusterIP goes").
5. **The hybrid cluster** (R11; 03-4, 03-16, 09-1). A new section 5.9: `lab-node`, `dt-kubelet` in Go/386, the table of operations, `vswitch`, the host-gw/VXLAN/WireGuard modes, kernel modules, budgets, the node backend in the scenario, checks in the hybrid, the spike. Decision 0.1 was rewritten, the error "k3s is 64-bit only" was fixed (there is armhf; the correct argument is that there is no i386 build and too little memory).
6. **The documentation ladder** (R2; 03-5, 09-4, 09-26). A new section 7: the anatomy of sources, the documentation mirror, rungs by level, examples of rungs 1–2, tasks F01–F12 and X01–X14 with checks, the `docs-coach` mode; the "Taught" column in the command table 5.5; full `--help`; the exam mirror includes helm.sh/docs and gateway-api.sigs.k8s.io.
7. **Process explanations** (R3, R4, R5; 03-14, 09-5). Section 6 was rewritten: general blueprint rules, fifteen explanations E1–E15 with screens, parameters, "break it" and a terminal, including scheduling, rolling update, node failure, an outside request with 504, ndots, NetworkPolicy, requests/limits in cgroup, PVC, authn/authz/admission, Helm, GitOps. Ink, camera parallax and sound were removed.
8. **The reconciliation loop** (R10; 03-15, 09-11). Screen 0 with the etcd record, the "switch off a node" and "change the image on the Deployment" interventions, screen 4 "chain of loops", one's own controller for all levels (5a on a ConfigMap, 5b an operator for a CRD). The code template was fixed: the Service is created, `ownerReferences` are set, the status is taken from a fresh object.
9. **The code sandbox** (09-9). QuickJS + sucrase instead of an ordinary Worker, memory and time limits.
10. **The textbook** (R1; 03-27, 09-17). Lines of exposition for all modules (4.3) were added, with the concept introduced, the explanation and the documentation rung per screen; the KN4 table follows the review's example.
11. **Relying on Linux and containers** (R6, R7; 09-16). Dependencies on L33–L43 and the six container boundaries (section 1), bridge scenes in KM01, KM05, KM06, KM09.
12. **Checks** (03-6, 09-7). The block's own vocabulary was replaced with 09/2.4 goals; a mapping table; the new areas `k8s.timeline` and `k8s.authz`; scenario 5.6 was rewritten.
13. **The verifier** (03-6, 03-19, 03-20, 09-14). Instead of a bash script — the `trainer-check` agent from 09; the breakage is introduced by the agent with a signed package only in server mode; the HTTP probe from inside or from `dt-api`, without `fetch` over http; types are read one by one after `api-resources`; `providerID` is not checked.
14. **Three stages** (R12; 03-11, 09-6). Section 11: stage 2 for all levels (k3s or kind/minikube/k3d, Helm from OCI, Gateway, Ingress, an image from the learner's CI); stage 3 kubeadm with Cilium, storage, certificates, etcd, an upgrade, a breakage; Terraform and Ansible — as a second pass R3-iac after the IaC block.
15. **The real cluster's network** (03-12, 03-13). A private network or WireGuard between nodes; a firewall for service ports only from the private network; an MTU check on provider VMs and local VMs; `HelmChartConfig` for the Gateway API in the k3s Traefik (verified: the provider is disabled by default).
16. **etcd 3.6** (03-8, 09-13). Verified against the etcd v3.6.0 announcement: `etcdctl snapshot status/restore` were removed, `etcdutl` is used. D25, exam E items 6–7, the checklist and the agent were fixed; the 3.6 error in the simulator became task X12.
17. **Golden recordings** (03-7, 09-18). k3d on the course's own CI runner for every PR, kubeadm with Cilium once a day; kind is not used.
18. **Version-dependent facts** (03-23, 09-22). `node-monitor-grace-period` — 50 s per the Node Status page (changed in v1.32), in `hold`; CrashLoopBackOff — in `hold` referencing KEP-4603 (alpha in v1.33) and KEP-5593; the IPVS status — in `hold` until the release notes.
19. **Small fixes**: the real look of `iptables-save` (03-18, 09-23); `progressDeadlineSeconds` does not stop anything (09-24); `containerPort` in the quiz (03-22); a Secret in etcd is stored unencrypted, not "in base64" (09-21); readiness questions B4/B6 were rewritten (03-21); `curl -o` and reading the script instead of `curl | sh` (03-24); the Endpoints deprecation warning (03-25); the `yc` filter in `hold` with a `jq` fallback (03-26); `helm repo add argo` and `$(date +%F)` (09-25); providers and prices — a link to the 09 `providers.yaml` (03-17); OpenAPI descriptions — a lazy chunk (09-27); snapshot storage and learner state — per 09/3.1 (09-19); the AI model and modes — per 09/4.5 (09-20).
20. **Level checks** (09-12). The L0 check was renamed to the readiness check and runs only when the Docker exam was skipped; the L1/L2 table and the criterion are shared from 01, the block proposes replacements (2.2).

### What was rejected or accepted differently from the proposal

- **03-4: "a separate pause container is not needed, `ip netns` holds the netns".** Rejected. The 09-1 option with a pause process was accepted: this way `lsns` and `ps` on the node show the same as on a real containerd node, and the KM03 "pod sandbox" screen relies on a visible process.
- **03-4: a hybrid memory ceiling of 1.2 GB at 3 × 128 MB.** Rejected in favor of the 09-1 budget: a 96 MB guest, 2 nodes by default (≤ 700 MB), 3 nodes ≤ 900 MB only with `deviceMemory ≥ 8`. 1.2 GB per tab is too close to the browser limit on laptops with 8 GB.
- **03-4: the agent in POSIX sh.** Rejected: Go/386 was accepted (09-1), because task parsing and status streaming come out fragile in sh. The control channel over `ttyS1` from 03-4 was accepted, `exec` goes over virtio-console (09-1).
- **03-4 and 09-1: node addressing.** Of the two options (`10.0.0.11–13` and `192.168.56.11–13`) the second was chosen, proposed by the owner of `vswitch` (09): it does not overlap with `10.42/10.43` or with the private network of the real stage.
- **03-7: kind is acceptable in CI for quick schema checks.** Rejected: one tool (k3d) for all runs, so as not to maintain two normalizations.
- **09-10 (scene 4.3): VXLAN is introduced by name to the beginner.** Rejected in favor of 03-10: the beginner gets "an envelope inside an envelope" based on the tunnel, the VXLAN name from L1; otherwise the 03 order is violated.
- **09-6: OpenEBS LocalPV for the experienced learner.** Rejected: in essence it is the same local volume as local-path. For L2, `csi-driver-nfs` with NFS on `cp-1` was chosen: a real CSI, RWX, works with any provider and on local VMs.
- **09-6: `kubeadm init --pod-network-cidr=10.0.0.0/16`.** Changed to `10.244.0.0/16` with `ipam.mode=kubernetes` in Cilium: `10.0.0.0/16` overlaps with providers' private networks and with the default Cilium pool.
- **03-11: stage 3 "intermediate and experienced" with the full scope.** Accepted with a clarification: L1 completes the basic part (without etcd restore, certificates, the upgrade and Cilium without kube-proxy), otherwise the scope of stage 3 for the intermediate level exceeds the block's time budget.
- **03-5 and 09-4: different rung schedules by module.** Merged into one table 7.3; the R2 requirement "experienced — from rung 3" is met, rung 4 for the beginner starts later than review 03 proposed (from KM11, not from KM10, which the beginner does not take).
- **09-12: move the L1/L2 tables entirely to 01 and keep nothing in 05.** Accepted partially: the canonical table and the criterion are in 01; 05 keeps the proposed replacements (2.2), so that the author of 01 can see the reasoning.
- **03-1 and 09-2: move kubeconfig into a separate new concept K47.** Accepted differently: K05 from 01 (kubectl, kubeconfig, context) stays entirely in KM01, and the new K47 covers only cluster users, certificates and CSRs in KM09. This way the 01 graph changes less.
