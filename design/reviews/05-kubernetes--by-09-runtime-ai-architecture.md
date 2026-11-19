# Review of 05-kubernetes.md (reviewer: the author of 09-runtime-ai-architecture.md, in the role of "runtime and AI architect")

Reviewer: the author of `09-runtime-ai-architecture.md`. Date: 18.11.2026. Document 05 was read in full; for cross-checking I read 01 (concept graph, level checks, block order), 03 (networking order, dependencies), 04 (entity order, tracks), 08 (visual language, storyboard 6.4), 09 (tiers, facts contract, storage, CSP, agent).

## Verdict

As a specification of the kube-lite simulator the document is strong: precise behavior of the scheduler, kubelet, nodes and GC, the "remove a component — what do we see" table, the 14-step path of `kubectl apply`, a serverless verifier for a real cluster, a sensible choice of Gateway API and nftables. It cannot be accepted in its current form for three reasons. First: the document lacks the hybrid cluster from R11 (control plane in kube-lite, nodes are real v86 machines with real `crun`). Decision 0.1, "there is no full Linux virtual machine", closes exactly the path the owner ordered to be prototyped first. Second: the document has no documentation ladder (R2), no R4-style process explanation storyboards (except for `kubectl apply`), and no three stages as worded in R12 (Terraform + Ansible, full kubeadm with node breakage). The R9 networking section is not split out as a separate part. Third: the document diverges from 01, 08 and 09 on concept identifiers, order of introduction, level checks, the check contract, the simulator worker and the real-stage agent. With such divergence, a build with a single linter will not pass. Below are 27 findings: 6 BLOCKING, 13 MAJOR, 8 MINOR. For every gap against R1–R12, ready-to-paste text for the document is provided.

---

## Findings

### 1. BLOCKING — No hybrid cluster (R11); decision 0.1 contradicts it

**Where:** 0 (decision 1), 5.1, 5.2, 16.

**What is wrong.** The document builds only a pure simulator: kubelet-lite, cri-lite, cni-lite and kube-proxy-lite are models in a worker. R11 requires prototyping the hybrid first. The control plane is kube-lite. Each node is a separate v86 machine in its own Web Worker, where a small real kubelet agent runs pods via `crun`. After `kubectl apply`, real processes appear in real namespaces, `kubectl exec` enters a real container, and after a node is "killed" the pods move. The phrase in 0.1, "v86 emulates 32-bit x86, and k3s is 64-bit only", is wrong regarding k3s: k3s has an `armhf` build, which is 32-bit. The correct argument is different: k3s is not built for i386, and the control plane does not fit into a 64–128 MB guest. The conclusion itself, "k3s in v86 is impossible", is correct and matches R11. But it is wrong to infer from it that the nodes must be models.

**Fix: a new section 5.9 "Hybrid cluster" (ready text).**

> **5.9. Hybrid cluster: control plane in kube-lite, nodes are real Linux in v86**
>
> **Why.** The pure simulator shows *what* Kubernetes does. The hybrid proves that a pod is an ordinary Linux process in namespaces and cgroups, which the learner already touched in the Linux and containers blocks. `kubectl apply` creates a process that is visible in `ps` on the node. `kubectl exec` opens a shell in a real mount and pid namespace. kube-proxy rules are visible with a real `iptables-save` (or `nft list ruleset`) command on the node. OOMKilled is a real `oom_kill` entry in `memory.events`.
>
> **Diagram.**
> ```
> main thread: xterm.js, diagrams, virtual switch vswitch (visualization, pcap)
>      │ MessagePort
> sim.worker.ts: kube-lite (apiserver-lite, store, controllers, scheduler, coredns-lite, kube-proxy model)
>      │  NodeBackend = 'sim' | 'v86'
>      ├── v86.worker #1 (cp-1/worker-1): lab-node, 96 MB, ttyS0 — learner, ttyS1 — dt-kubelet
>      ├── v86.worker #2 (worker-2)
>      └── v86.worker #3 (worker-3)
>  Ethernet frames: net0-send/net0-receive of each machine ⇄ vswitch (Transferable ArrayBuffer)
> ```
>
> **The `lab-node` image** = `lab-alpine` (09, 1.4) + `dt-kubelet` + `iproute2`, `iptables`/`nft`, `wireguard-tools`, `conntrack-tools`, `tcpdump`. The kernel is shared, `dt-kernel`. Add to its fragment: `CONFIG_VXLAN`, `CONFIG_WIREGUARD`, `CONFIG_BRIDGE_NETFILTER` (without `br_netfilter`, traffic through the bridge bypasses iptables), `NETFILTER_XT_MATCH_STATISTIC`, `NETFILTER_XT_MATCH_COMMENT`, `NETFILTER_XT_MATCH_CONNTRACK`, `NETFILTER_XT_MARK`, `IP_NF_TARGET_MASQUERADE`, `NF_TABLES_INET`, `NFT_NUMGEN`, `NFT_CT`, `IP_VS` (only to be able to say "here is IPVS, but we do not use it"), `CGROUP_PIDS`, `MEMCG`, `CFS_BANDWIDTH`.
>
> **`dt-kubelet`** is a static Go binary, `GOOS=linux GOARCH=386 CGO_ENABLED=0`, roughly 3–4 MB, delivered over 9p from `/opt/trainer/`. The `trainer-agent` from 09 stays on ttyS1; `dt-kubelet` connects to it as a second consumer of the same JSON protocol. Operations:
>
> | op (kube-lite → node) | What the agent does on the real kernel |
> |---|---|
> | `sandbox.create {pod, uid, ip, cidr}` | `ip netns add`, a veth pair with one end in the `cni0` bridge, address and default route; creates a "pause" process that holds the net and ipc namespaces (like the sandbox in containerd) |
> | `image.ensure {ref, digest}` | `fetch` of layers from the course registry via the Service Worker (09, 1.6), unpacked into `/var/lib/dt/images/<digest>` |
> | `container.start {spec}` | overlayfs (`lower` = layers, `upper` in tmpfs), `config.json` from the PodSpec (env, ConfigMap/Secret mounts as files, `linux.resources` from requests/limits), `crun run -d`, joining the pod's netns (`--net=/proc/<pause>/ns/net`) |
> | `container.kill {grace}` | SIGTERM, waiting `terminationGracePeriodSeconds` on the virtual clock, then SIGKILL |
> | `status` (stream) | `crun state`, exit codes, `memory.events` (`oom_kill`) → `reason: OOMKilled`, restarts |
> | `exec {cid, tty}` | `crun exec -t`; the stream goes over virtio-console multiport (`CONFIG_VIRTIO_CONSOLE` is already enabled), not over ttyS1 |
> | `logs {cid}` | the container's stdout/stderr are written to `/var/log/pods/<ns>_<pod>_<uid>/<c>/0.log` in CRI format (`<time> stdout F <line>`), as with a real kubelet |
> | `proxy.apply {rules}` | kube-proxy-lite is no longer only a model: it generates a real `iptables-restore` (or `nft -f`) input, and the agent applies it on the node. Model and kernel are reconciled by the visualizer's packet and `iptables -t nat -L -v` showing the same counters |
> | `netpol.apply {rules}` | NetworkPolicy is translated into filter chains on `cni0` (modeled on kube-router, which is built into k3s) |
>
> **Networking between nodes is our own virtual switch, `vswitch`** (not `inbrowser`/BroadcastChannel from 09, 1.6: a broadcast channel gives neither a MAC table, nor a picture, nor a point where you can "cut the wire"). The switch runs on the main thread. It learns MAC addresses, forwards frames, counts bytes per port, writes pcap for the "Packet scope" (03, 7.5) and emits `frame` events on the bus. Nodes get `192.168.56.11–13/24`, and each node has its own podCIDR `10.42.N.0/24`. The inter-node transport modes are switched within the lesson: `host-gw` (routes `ip route add 10.42.2.0/24 via 192.168.56.12` — beginner), `vxlan` (`ip link add flannel.1 type vxlan id 1 dstport 8472` — intermediate), `wireguard` (`wg0` between nodes — advanced). In the three modes, the same pod-to-pod `ping` is shown on the diagram as three different frames: bare IP, IP in UDP/VXLAN, encrypted UDP.
>
> **A node "went down"** — `v86.stop()` in the node's worker. The Lease stops being renewed, node-lifecycle in kube-lite sets `NotReady` and the `unreachable` taint after the grace period, the pods are evicted, the scheduler picks another node, and `dt-kubelet` there starts a real process. "Turn the node back on" — `v86.run()`. The agent sees pods that are no longer in the API and kills them; this is the lesson "kubelet reconciles too".
>
> **Budgets** (addition to the table in 09, 1.4):
>
> | What | Threshold |
> |---|---|
> | `lab-node` guest | 96 MB (64 MB as the fallback for two nodes) |
> | Post-boot snapshot, zstd | ≤ 12 MB (one for all nodes) |
> | Starting three nodes from one snapshot | ≤ 5 s; after restore the agent changes `hostname`, MAC (`ip link set eth0 address`) and address — otherwise the three nodes would share one MAC and the switch would go crazy |
> | Tab memory, 3 nodes | ≤ 900 MB; 4 nodes only with `navigator.deviceMemory ≥ 8` |
> | Pods per node | ≤ 8 (the lessons need no more) |
> | Pod start (image cached) | ≤ 3 s of real time |
> | Phone and `deviceMemory < 4` | one `lab-node` node + the remaining nodes `sim`; if even that is impossible, the whole cluster is `sim` |
>
> **The scenario selects the backend:** `cluster.nodes[].backend: sim | v86`. The default is `sim`. `v86` is specified in lessons where the value lies in the real kernel: K1 (pod = process, `ps`/`lsns` on the node), K3 (node failure), K4 (veth, bridge, real iptables, VXLAN), K6 (OOM kill, `cpu.max`), K10 (NetworkPolicy as kernel rules), K16 (some of the breakages). If the device cannot handle `v86`, the same scenario runs on `sim`, and the diagram gets a "nodes are simulated" badge.
>
> **Checks in the hybrid** combine facts: `k8s.objects` from kube-lite and `procs`/`ns`/`cgroups`/`net` from the nodes. Example goal for K6:
> `k8s.objects[kind=Pod][metadata.name=hog].status.containerStatuses.lastState.terminated.reason=OOMKilled && @node(worker-1).cgroups[path~'kubepods'][procs~@pid(hog)].memory.max=134217728`
>
> **What the hybrid is not.** It is not k3s and not a real kubelet. `kubectl` output is still produced by kube-lite. The node is responsible only for what is visible from inside Linux. Golden recordings (5.7) for the hybrid also compare output on the node: `crictl ps`/`ps`/`iptables-save` on k3d versus `ps`/`iptables-save` in `lab-node`, after normalizing chain names.

In 16 "Development order", the hybrid must come before stage 2 (networking), as a prototype that is accepted or rejected against the budgets. If the prototype does not fit the budgets, this is recorded explicitly, and the networking stage is built on `sim`.

In 0.1, replace the last sentence with: "Kubernetes as a whole does not fit into v86 (k3s is not built for i386; the control plane needs more memory than the 128 MB guest), so we build a hybrid: the control plane is kube-lite, the nodes are real Linux in v86 with our agent (5.9)".

### 2. BLOCKING — Concept and module identifiers do not match the 01 graph and overlap

**Where:** 3, 4, 13; comparison with 01, 6.2.

**What is wrong.** In 01, Kubernetes concepts are named `K01…K33`, Docker concepts `D01…D23`, networking concepts `N01…N21`. In 05, concepts are named with strings (`pod`, `docker:container`, `linux:cgroups`, `net:iptables`), and modules are `K0…K16`. So `K15` in 05 means the "For real" module, while in 01 `K15` is the kube-proxy concept. `K4` (the networking module) and `K04` (the "API server and object" concept) differ by a single zero. The linter from 01, 6.1 and the linter from 05, 0.8 use one and the same `concepts.yaml`, so one of the two documents is wrong by construction. In addition, 05 references concepts from other blocks with wrong prefixes: `linux:ip` (an IP address is N01, networking), `linux:git` (Git is C01–C04, the CI/CD block), `docker:yaml` (YAML is L31, Linux), `docker:runtime` (D10).

**Fix.** Rename the modules to `KM00…KM16`, and in the text write "module 4". Convert the table in section 3 to the 01 identifiers: missing concepts should be **added to 01** (via a PR to the shared `concepts.yaml`) rather than kept in 05. List of additions: `K34 status/event`, `K35 EndpointSlice`, `K36 volume`, `K37 metrics-server/HPA`, `K38 Gateway API`, `K39 NetworkPolicy`, `K40 taints/affinity`, `K41 cordon/drain/PDB`, `K42 Kustomize`, `K43 watch/informer`, `K44 ownerReferences/GC`, `K45 pause/sandbox`, `K46 static pod`, `K47 kubeconfig` (split out of K05, see finding 3). Cross-block dependencies as follows: `service ← N19, N04`; `cni ← N20, N21, N03`; `kube-proxy ← N17, N11`; `resources ← D04` (after R6, a new L number for cgroups v2); `probes ← D23`; `gitops ← C04, C05`; `deployment ← C14`.

### 3. BLOCKING — Three different orders of introducing the architecture: 01, 05 and 08

**Where:** 3, 4.1, 6.1; 01, 6.2; 08, 6.4.

**What is wrong.**

| Concept | 01 (graph) | 05 (section 3) | 08 (storyboard 6.4) |
|---|---|---|---|
| Pod | after kubelet (K09 ← K08) | module 1, the very beginning | step 4, after etcd and the API server |
| etcd | before the scheduler | module 2, after ReplicaSet | step 2, before the API server |
| kubeconfig/context | together with kubectl (K05) | module 10 | not mentioned |
| labels and selectors | before ReplicaSet | module 2 | step 7, together with Service |
| kubelet | before Pod | module 3 | step 5 |

The 05 order fits practice best (first see a pod, then ask "who chose it"), and section 3 is consistent. The 08 order is good for the builder, but in it ReplicaSet and Deployment appear before labels. 01 requires kubelet before Pod — for a beginner that is an abstraction with nothing to stand on.

**Fix (proposed as an architect's decision, to be approved in 01 and 08).** The canon is the 05 order with three amendments. (a) kubeconfig: the concept itself and `--context` move to module 1 as a single scene ("kubectl knows where to knock from the `~/.kube/config` file"), while RBAC users and CSRs stay in module 10. Otherwise the exams with `use-context` (9) and `--context` among the global flags (5.5) use the concept before it is introduced. (b) Rebuild the 08, 6.4 storyboard to this order: steps 0–1 (node, cluster, desired state) — module 0; steps 3–4 (API server, pod, scheduler) — modules 1 and 3; step 2 (etcd) — module 2; labels before ReplicaSet. (c) In 01, fix the dependencies: `K09 Pod ← K01, D06, D03`, without K08; `K08 kubelet ← K09`.

Separately, about output before introduction. In module 1, `kubectl describe pod` prints `Namespace:`, `Node:`, `QoS Class: BestEffort`, `Tolerations: node.kubernetes.io/not-ready:NoExecute op=Exists for 300s`, `Controlled By:`, and in the events — `default-scheduler … Successfully assigned`, `kubelet … Pulling image`. 04, section 2 requires terms in terminal output to be marked up as well. The rule "hide the NAMESPACE column until module 2" covers one line out of ten. A general "fog" rule is needed (common to 02–06, implemented in `terminal` from 08, 3.4).

> **Output fog.** Simulator output is always real and complete, but lines and fields with concepts that have not yet been introduced are drawn in a muted color (`--c-fog`) with a dashed underline. A click opens the card "this is <term>, it is covered in module N; you can skip reading this field for now". The linter treats such lines as allowed (`fog: true`), but forbids mentioning them in the lesson text, task, hint and AI answer. The list of fields for the fog is taken from the same `concepts.yaml` (word forms + JSONPath of object fields).

### 4. BLOCKING — No documentation ladder (R2)

**Where:** the whole document; there is only a "side panel with kubernetes.io" in the exams (9) and a source link in the AI (11). On top of that, 5.5 deliberately trims `-h/--help` "to the supported flags", which makes steps 3–4 impossible: the learner has nowhere to find a flag that was not taught.

**Fix: a new section 7a "Documentation ladder" (ready text).**

> **7a. Documentation ladder**
>
> The block's sources are four kinds of pages, and each has its own anatomy, which we teach separately:
> 1. `kubectl <command> --help` — the *Examples*, *Options*, *Usage* sections. Note: in kubectl the examples come **before** the flags, not after, as in man.
> 2. `kubectl explain <resource>.<field>` — `GROUP/VERSION/KIND/FIELD`, `DESCRIPTION`, `FIELDS` with the type and `-required-`; `--recursive` for the tree.
> 3. kubernetes.io/docs — *Concepts* (why and how it works), *Tasks* (step-by-step instructions with YAML), *Reference* (API and kubectl). We teach telling them apart by the URL path.
> 4. Project documentation: helm.sh/docs, gateway-api.sigs.k8s.io, argo-cd.readthedocs.io, docs.k3s.io.
>
> **A documentation mirror inside the trainer.** The external kubernetes.io cannot be embedded in an iframe: the platform CSP is `frame-src 'none'` (09, 6.4), and in addition we need the exact version and offline operation. So we build our own mirror from the `kubernetes/website` repository on the v1.37 release branch (CC BY 4.0 license, with attribution), helm.sh/docs (the `helm/helm-www` repository; check the license before including it in the mirror) and gateway-api.sigs.k8s.io (Apache-2.0). The Hugo build is turned into static HTML fragments under `/docs/k8s/v1.37/...`; search is our own index (MiniSearch), lazy, ≈ 2–3 MB gzip for the whole set, cached by the Service Worker. The mirror can do what the original cannot: highlight the needed line (`#:~:text=` does not work in our own renderer — we do `?hl=<anchor-id>`), collapse everything except the needed section, show "you are here" in the page anatomy. `--help` is served **in full, as in real kubectl v1.37**. If a flag is not supported by the simulator, execution returns the trainer message "this flag exists in kubectl but not in the training cluster — it works at the real stage", rather than `unknown flag`.
>
> | Step | For whom | What it looks like in the Kubernetes block | How it is checked |
> |---|---|---|---|
> | 1. Glimpse | beginner, modules 0–3 | Under each command in the lesson there is a thin line "where this comes from: `kubectl get --help`, Examples section" and a link to the exact place in the mirror; opening it is optional | Nothing is required; whether it was opened is recorded (for statistics, not for grading) |
> | 2. Fragment as a hint | beginner from module 3, intermediate in modules 0–2 | The second-level hint is not a ready command but a fragment of `--help` or `explain` with a highlighted line and labels for the parts of the page: "this is Usage — the command template", "this is Options — the flags". Example (D04): a fragment of `kubectl set image --help`, with the line `kubectl set image deployment/nginx busybox=busybox nginx=nginx:1.9.1` highlighted | Ordinary state check; the log records "solved with a documentation fragment" |
> | 3. Find the flag | beginner from module 6, intermediate from module 3, advanced from the start | A task of the form "find the flag that does X"; the hint contains only a link to the page (without an anchor). The task counts as done when the state is reached; the flag itself is not checked | By state + `used_command` for the debrief |
> | 4. Forcing | intermediate from module 8, advanced from module 4; everyone in module 16 | The task requires something that was not in the theory; no hints; the "ask AI" button turns on the `docs-coach` mode (see below) | By state |
> | 5. Exam | everyone, exams 9.x | Only the mirror of kubernetes.io + helm.sh/docs + gateway-api.sigs.k8s.io is open (same as on the CKA per the LF [Resources Allowed](https://docs.linuxfoundation.org/tc-docs/certification/certification-resources-allowed) list); AI is off; 20–30 % of the points are for things not covered in the course | By state |
>
> **Step 3 tasks (by module):**
>
> | ID | Module | Task | Answer (not shown) | Check |
> |---|---|---|---|---|
> | F01 | 1 | List pods so that the IP and node are visible, without reading `describe` | `-o wide` | fact: the output history contains an IP column (`used_command`, debrief only) + the question "what is the IP of pod X" with a value check |
> | F02 | 1 | Show the container logs *before* the last restart | `logs --previous` | the answer in the file matches a log line from the previous run |
> | F03 | 2 | Show pods with all their labels | `--show-labels` | the entered label value matches |
> | F04 | 3 | Look at the pod template of revision 2 of a Deployment | `rollout history --revision=2` | answer: the image of revision 2 |
> | F05 | 3 | Roll back a Deployment not to the previous revision but to a specific revision 1 | `rollout undo --to-revision=1` | image = the image of revision 1 |
> | F06 | 4 | Find in `explain` which Service field ensures that a client always lands on the same pod | `spec.sessionAffinity` | `svc.spec.sessionAffinity=ClientIP` |
> | F07 | 6 | Sort pods by restart count | `--sort-by=.status.containerStatuses[0].restartCount` | the file matches the expected order |
> | F08 | 7 | Create a Job from an existing CronJob without waiting for the schedule | `create job --from=cronjob/…` | a Job exists with the annotation `cronjob.kubernetes.io/instantiate: manual` and the template from the CronJob |
> | F09 | 10 | Find out whether SA `ci:deployer` can delete pods, without switching context | `auth can-i --as=system:serviceaccount:ci:deployer` | the answer "no" in the file |
>
> **Step 4 tasks (forcing) — what is needed is not in the theory:**
>
> | ID | Module | Task | What has to be found | Where the answer lives | Check |
> |---|---|---|---|---|---|
> | X01 | 4 | The `api` pod's image has no shell and no curl. Check from inside its network namespace whether it listens on 8080 | `kubectl debug -it api --image=trainer/client --target=api` (ephemeral container) | Tasks → Debug Running Pods | the `api` pod has gained `ephemeralContainers`; the "yes/no" answer is correct |
> | X02 | 6 | Make the `slow` pod receive SIGTERM only 20 s after the delete command, so that the application has time to close connections | `lifecycle.preStop.sleep.seconds` (or `exec: sleep 20`) + `terminationGracePeriodSeconds ≥ 30` | `explain pod.spec.containers.lifecycle` | the fields are set; the kubelet-lite log shows SIGTERM after 20 s |
> | X03 | 7 | A Job must end in failure if it runs longer than 60 s | `activeDeadlineSeconds` | `explain job.spec` | the Job is `Failed` with `reason: DeadlineExceeded` |
> | X04 | 7 | Finished Jobs older than 5 minutes must disappear on their own | `ttlSecondsAfterFinished` | Concepts → Automatic Cleanup for Finished Jobs | after 5 min of virtual time the Job is gone |
> | X05 | 8 | A pod must get a volume that lives exactly as long as the pod, but with a StorageClass | generic ephemeral volume (`volumes[].ephemeral.volumeClaimTemplate`) | Concepts → Ephemeral Volumes | a PVC with an ownerReference to the pod; after the pod is deleted the PVC is gone |
> | X06 | 10 | Obtain a token for SA `ci-bot` valid for 10 minutes | `kubectl create token ci-bot --duration=10m` | `create token --help` | the answer decodes as a JWT with `exp − iat = 600` |
> | X07 | 11 | The `web` pods must be spread evenly across zones `zone=a/b` with a difference of at most 1 | `topologySpreadConstraints` with `maxSkew: 1`, `topologyKey: zone` | Concepts → Pod Topology Spread Constraints | zone distribution ≤ 1 after scaling to 5 |
> | X08 | 12 | Render a single chart template without installing, only `templates/service.yaml` | `helm template … --show-only templates/service.yaml` | helm.sh/docs → helm template | the file matches the reference render |
> | X09 | 14 | Make the `spec.size` field of the `Website` CR immutable after creation | CEL `x-kubernetes-validations: rule: "self == oldSelf"` | Tasks → Extend the Kubernetes API with CRDs → Validation rules | an edit of `size` is rejected with the rule's message |
> | X10 | 16 | Check which kube-apiserver health checks are failing | `kubectl get --raw='/readyz?verbose'` | Reference → API health endpoints | the answer in the file matches the name of the broken check |
>
> What the simulator needs for X01–X10 (add to 5.3/5.5): `kubectl debug` (ephemeral containers), `get --raw` for `/readyz`, `/livez`, `/version`, `lifecycle.preStop.sleep`, `activeDeadlineSeconds`, `ttlSecondsAfterFinished`, generic ephemeral volumes, `topologySpreadConstraints`, CEL in CRDs (a subset: `self`, `oldSelf`, comparisons, `size()`, `matches()`).
>
> **The `docs-coach` AI mode** (addition to the modes table in 09, 4.5; turned on at step 4 and in module 16). The model's first reply to any question is "Where have you already looked?" with three buttons: `--help`, `kubectl explain`, kubernetes.io. After that the model names neither the flag nor the field. It names the *kind of source and the section* ("this is a pod field, not a container field — look at `explain` one level up"; "this is a task, not a concept — look in Tasks"). In addition, the engine collapses any `cmd` block and any match with the goal's answer field (the `answer_terms` field in the scenario) into a button "Show — the task will be counted as done with a hint".
>
> **The advanced level** starts from step 3 from the first module. Steps 1–2 are turned off for it: there are no glimpse links, and hints are links to pages right away.

### 5. BLOCKING — Process explanations (R3, R4) exist only for `kubectl apply`; the style contradicts R4/R5

**Where:** 6.1 (screen 1: "Each block is drawn in ink (ink.ts Sankofa)"), 6.5 (visualizers are described in one line), 12 ("Living ink… the wires are drawn in").

**What is wrong.** R3 requires five explanations for Kubernetes: `kubectl apply` through all components, pod scheduling, rolling update, node failure, a request through Service/Ingress/kube-proxy. A step-by-step storyboard exists only for the first one. "Scheduler" and "Rolling update" in 6.5 are one line each, with no parameters, no "break it", no stepping through. "Node failure" exists only as a row in the consequences table. R4/R5 explicitly forbid Sankofa ink for diagrams: what is needed is a technical drawing, animation of the process itself only, labels on the lines, everything clickable, sliders that recompute the process immediately and explain the change next to it. This also contradicts 08, 5.1, where ink is allowed only for metaphors.

**Fix.** In 6.1 and 12, remove the ink: blocks are a technical drawing (`--c-cp` hexagon, `--c-node` rack, `--c-obj` document card from 08, 5.2), a wire appears immediately, and on connection the line is highlighted once (`stroke-dashoffset` 200 ms). Remove the `clap.ts` sound: it is decoration, and R4 does not allow it. Below are four ready storyboards. Common elements for all of them: a step scale at the bottom (◀ ▶ ⏸, dragging, ←/→ keys), a "what changed and why" column on the right (recomputed on every parameter change), and a terminal under the diagram showing the command with which this is visible in a real cluster. Everything is computed by kube-lite on the virtual clock; the diagram only draws.

> **6.6. Explanation "How the scheduler picks a node"** (module 3, revisited in module 11)
>
> *Screen 1 — the queue.* On the left, a column of pods in the scheduler queue (`activeQ`); on the right, three nodes as bars "CPU: requested / allocatable" and "memory: requested / allocatable". The line "watch pods, nodeName=""" from the scheduler to the API is labeled on the line itself. A click on a node shows its `status.allocatable` and an excerpt from `kubectl describe node`, the *Allocated resources* section.
>
> *Screen 2 — filters.* A pod from the queue is "tried on" each node. Filters in turn: NodeUnschedulable → NodeResourcesFit → TaintToleration → NodeAffinity → PodTopologySpread. A node that fails a filter dims, and the line to it gets a label with the reason in the real wording (`Insufficient memory`, `untolerated taint {node-role.kubernetes.io/control-plane: }`). At the bottom, the `FailedScheduling` message line is assembled from these labels.
>
> *Screen 3 — scoring.* For the nodes that passed, score bars grow per plugin (NodeResourcesFit/LeastAllocated, ImageLocality, TaintToleration, PodTopologySpread), then the sum, then the winner. The line "POST …/pods/web-x/binding" to the API.
>
> *Sliders and toggles:* the pod's `requests.memory` (64Mi–4Gi), `requests.cpu` (50m–2000m), "the image is already on worker-2" (ImageLocality), a taint on worker-1 on/off, `nodeSelector disk=ssd` on/off, replica count 1–8 (you can see how LeastAllocated spreads them across nodes). Any change immediately recomputes screens 2–3, and the column on the right says what changed: "requests.memory 3Gi > allocatable worker-1 (2.8Gi) → worker-1 filtered out by NodeResourcesFit".
>
> *Break it:* "remove the scheduler" — the queue grows, and there are no events at all (takeaway: the absence of `FailedScheduling` means there is no scheduler); "limits without requests" — requests are taken equal to limits (the field is highlighted in the YAML).
>
> *Terminal:* `kubectl get events --field-selector reason=FailedScheduling`, `kubectl describe node worker-1 | sed -n '/Allocated/,/Events/p'`.
>
> **6.7. Explanation "Rolling update"** (module 3)
>
> *Screen 1.* Two ReplicaSet rectangles: the old one (`web-7d9c…`, image 1.0) and the new one (`web-5f4b…`, 1.1). Under them are the pods. Above them is the Service → pods line, where ready pods are connected and non-ready ones are dashed. Counters: "ready in total", "old", "new", "minimum during the rollout".
>
> *Screen 2 — steps.* Each step on the scale = one action of the Deployment controller ("scaled the new RS to 2", "pod web-5f4b-x Ready", "scaled the old RS to 2"). The step label is taken from real `ScalingReplicaSet` events.
>
> *Sliders:* `replicas` 1–10, `maxSurge` 0–100 % or 0–5, `maxUnavailable` 0–100 % or 0–5 (0/0 is forbidden — label "the Deployment will be rejected: both are zero"), readiness time of the new pod 0–60 s, `minReadySeconds` 0–30. On every change the "how many pods are ready over time" chart is rebuilt. The column on the right: "maxUnavailable=0 and maxSurge=1 → at any moment at least 4 are ready, the rollout will take ≈ 4 × 15 s".
>
> *Toggles:* strategy `RollingUpdate`/`Recreate` (a drop to zero ready pods with Recreate); readiness probe on/off (without it a non-ready pod gets traffic immediately — a red 502 packet appears on the Service line).
>
> *Break it:* a new image `:2.0` (crashes). The rollout gets stuck — the new pods are in CrashLoopBackOff, the old ones keep serving within `maxUnavailable`. After `progressDeadlineSeconds` the Deployment gets the condition `Progressing=False, reason=ProgressDeadlineExceeded`. **Label:** "Kubernetes does not roll back by itself; this condition is a signal for you or for CI". A `kubectl rollout undo` button.
>
> **6.8. Explanation "A node went down"** (module 3; in the hybrid — for real)
>
> *Screen 1.* Three nodes, each with a Lease bar and a timer "renewed N s ago" (kube-node-lease, every 10 s). The control plane on top: the node-lifecycle controller in kube-controller-manager.
>
> *Steps (scale in virtual time):* t=0 node 2's power is off → the Lease stops being renewed → t = `node-monitor-grace-period` (since v1.32 — 50 s; on `hold` until confirmed, see finding 22) → `Ready=Unknown`, taint `node.kubernetes.io/unreachable:NoExecute` → pods on the node become `Terminating` after `tolerationSeconds` (300 s by default from the DefaultTolerationSeconds admission) → the ReplicaSet sees fewer ready pods and creates a replacement → the scheduler sends it to the live nodes. Line labels: "no PUT Lease", "PATCH node status", "taint", "create pod".
>
> *Sliders:* the pod's `tolerationSeconds` 0–600, `node-monitor-grace-period` 20–120 s, workload type Deployment/StatefulSet. For a StatefulSet a replacement is **not** created until the pod is force-deleted: "two `db-0` at the same time are not allowed" — this is the main lesson for the intermediate level.
>
> *Toggle:* "the node came back after 2 minutes": kubelet sees pods that the API has already deleted and stops them.
>
> *Hybrid:* the "power off" step is `v86.stop()`; on a live node the learner sees in the terminal a new process in `ps -ef` and a new veth in `ip link`.
>
> **6.9. Explanation "A request from outside to a pod"** (module 9; brings modules 4 and 9 together)
>
> *Screen 1, overview.* Left to right (rule 08, 5.3.2): client → node IP:443 → Service of the Gateway controller (NodePort/LoadBalancer) → controller pod (traefik-lite) → HTTPRoute rule → Service `web` (ClusterIP) → kube-proxy rules → pod `web`. Under each link is its layer (L3/L4/L7, colors `--c-l*`), and on each line what changes in the packet (`dst 203.0.113.10:443 → 10.43.0.50:443`, etc.).
>
> *Steps:* the packet moves one link per step. At each step an envelope opens with the fields that change at this link (DNAT, TLS termination, a new TCP stream from the proxy to the pod, `X-Forwarded-For`).
>
> *Toggles:* `externalTrafficPolicy: Cluster/Local` (with Cluster you see SNAT and loss of the client IP; with Local a node without a pod does not respond); TLS on the Gateway on/off; backend weight in the HTTPRoute 0–100.
>
> *Break it:* a Service without ready pods (the controller responds 503), a wrong `backendRef.port` (HTTPRoute `ResolvedRefs=False`), a pod responds in 40 s with a proxy timeout of 30 s (**504 comes from the proxy, not from the application**; link to 03, N15).

### 6. BLOCKING — No three stages as worded in R12; Terraform and Ansible conflict with the block order

**Where:** 10.1–10.5, 2.1 (for the beginner — only "k3s 1 node").

**What is wrong.** (a) Stage 2 (one real node: k3s/minikube/kind on one's own machine or a single VPS) must include Helm, Ingress and real images from a registry. R1 for the beginner has no Helm; kind/minikube on one's own machine are not mentioned. (b) Stage 3 (kubeadm on 3+ VMs: Cilium CNI, storage, certificates, version upgrade, etcd backup and restore, node breakage and repair, VMs via Terraform, configuration via Ansible) exists only for the advanced level. Terraform and Ansible are absent; VMs are ordered with `hcloud` commands. At the same time, per 01, 5, IaC is block 7, **after** Kubernetes, so Terraform at stage 3 violates the block order.

**Fix (ready text for 10.1).**

> **Three stages.**
>
> | Stage | Where | Who | What the trainer does |
> |---|---|---|---|
> | 1. Browser | kube-lite + hybrid (5.9) | everyone | runs and checks |
> | 2. One real node | k3s on a single VM (the learner's cloud or a local VM) **or** kind/minikube/k3d on one's own computer | all levels | guides step by step and checks with the agent |
> | 3. Full cluster | 3+ VMs, kubeadm | intermediate (base part) and advanced (all of it) | guides step by step, checks with the agent, shows the cost, mandatory cleanup |
>
> **Stage 2 (track R1, for all levels).** Steps: install k3s (or kind on one's own computer); `helm repo add` + `helm install` of the course chart from the public registry `ghcr.io/<org>/charts/trainer-web` (an OCI chart); enable Gateway API in the built-in Traefik via `HelmChartConfig` (`providers.kubernetesGateway.enabled: true`) — in k3s this provider is off by default; Ingress as the second option; an image from a real registry with `imagePullSecrets` for a private repository. Checks: release `deployed`, `HTTPRoute Accepted`, the pod pulled the image by digest (`status.containerStatuses[].imageID` contains `sha256:`).
>
> **Stage 3, part A (inside the Kubernetes block, without IaC).** VMs are ordered by hand (the provider's console or CLI, or Multipass or Vagrant on one's own computer), configuration is done by the course script `prepare-node.sh`, which the learner reads in full before running it. The script turns off swap, loads the `overlay` and `br_netfilter` modules, sets the sysctl `net.ipv4.ip_forward=1`, installs containerd with `SystemdCgroup = true`, adds the `pkgs.k8s.io/core:/stable:/v1.36/deb/` repository, installs `kubelet kubeadm kubectl` and runs `apt-mark hold`. Then manually, following the checklist steps:
> 1. `kubeadm init --pod-network-cidr=10.0.0.0/16 --skip-phases=addon/kube-proxy` (the Cilium-without-kube-proxy variant — advanced) or with kube-proxy (intermediate).
> 2. Cilium: `cilium install --version <pinned>`; `cilium status --wait`; `cilium connectivity test` (advanced only — it takes long).
> 3. `kubeadm join` of two workers.
> 4. Storage: local-path-provisioner (intermediate) or OpenEBS LocalPV (advanced) + a default StorageClass.
> 5. Certificates: `kubeadm certs check-expiration`, `kubeadm certs renew apiserver`, restart of the static pod.
> 6. etcd: `etcdctl snapshot save` (with `--cacert/--cert/--key` from `/etc/kubernetes/pki/etcd/`); restore — `etcdutl snapshot restore --data-dir /var/lib/etcd-restore` and editing `hostPath` in `/etc/kubernetes/manifests/etcd.yaml`.
> 7. Upgrade v1.36 → v1.37: the repository of the new minor version, `kubeadm upgrade plan/apply`, `drain`/`uncordon` of each worker, `kubeadm upgrade node`.
> 8. Breakage and repair: the `trainer-check` agent introduces the breakage itself (stops kubelet / corrupts `--etcd-servers` / plants an expired kubelet certificate — from a signed package per 09, 5.6), and the learner repairs it.
> 9. Cleanup (10.5).
>
> **Stage 3, part B (return after the IaC block).** The same cluster is ordered via Terraform (the providers of the learner's cloud: `hetznercloud/hcloud`, `yandex-cloud/yandex` and others from 09, 5.2) and configured by the Ansible role `kubeadm_node` instead of `prepare-node.sh`. This is the final exam of the IaC block, to be agreed with 06. In the Kubernetes block there is only a link to this exam: "you will come back here after IaC". Why not earlier: per 01, 5, Terraform is introduced in block 7, and by then the learner already has the pain of ordering three VMs by hand, which Terraform removes.
>
> **The intermediate level at stage 3** goes through steps 1–4, 6 and 9 (no Cilium without kube-proxy, no upgrade); the advanced level does all of them.

### 7. MAJOR — Its own check contract and its own agent instead of the shared ones from 09

**Where:** 5.6 (check vocabulary), 10.4 (`bash trainer-check.sh r2`), 13 (verifier format).

**What is wrong.** 09, 2 adopted a single contract: facts `dt.facts/v1` → a predicate in the shared language → `CheckResult`. The agent is the Go binary `trainer-check` with signed releases, not a bash script. Predicates are evaluated in TS and in Go against shared test vectors. 05 has its own YAML vocabulary (`get + expect` JSONPath, `count_gte`, `same_uid`, `history`), its own script and its own JSON format. Two implementations of the same check will diverge.

**Fix.** Convert the scenario form from 5.6 to the `goals` from 09, 2.4. Mapping:

| 05 | 09 |
|---|---|
| `get` + `expect` | `when: "k8s.objects[kind=EndpointSlice][metadata.labels.kubernetes\\.io/service-name=api].endpoints[conditions.ready=true]#>=2"` |
| `probe` (HTTP from a pod) | `http.<id>` in the facts; the probe is requested in `needs: [http:api-from-client]` |
| `can_i` | a new fact area `k8s.authz` (results of `SubjectAccessReview` for a list requested in `needs`) |
| `same_uid` / `new_uid` | `keep: "k8s.objects[kind=Pod][metadata.labels.app=api-v2].metadata.uid=@start(...)"` |
| `history` (`min_ready_replicas_gte`) | **a new area `k8s.timeline`**. It does not exist in 09 — I will add it: kube-lite emits a change log (5.2), predicate `k8s.timeline[kind=Deployment][name=web].status.readyReplicas.min>=2`. On tier C such a check is possible only in the "with server" agent mode, where the agent holds a watch for the duration of the task. Without a server, `timeline` checks on a real cluster are forbidden by the validator |
| `file` | `files[...]` |
| `used_command` | `history` from 09 (hints and `forbid` only) |

Replace 10.4 with: "The agent is `trainer-check` from 09, 5.4; the command is `trainer-check run --track r2 --nonce <code>`". The list of kinds the agent reads and the rule "does not read secrets" stay as in 05: these are requirements for the agent's `k8s` area. Replace the verifier from 13 with `dt.facts/v1` with `k8s.nodes[].providerID`. Replace the learner state from 13 (`{level, placement, …}`) with the event log from 09, 3.1. Progress is a derived table, not a separate structure of the block.

### 8. MAJOR — A separate "cluster worker" and its own network models instead of the shared `sim.worker.ts` and netlab

**Where:** 5.2 (diagram), 5.4 "Network", 6.4.

**What is wrong.** 09, 1.3 decided: the Stand, netlab, dsim and kube-lite live in one `sim.worker.ts`, because a kube-lite pod is a dsim container, i.e. a Stand process in the netlab network model. Per 03, 13, the Kubernetes block uses netlab for Service/kube-proxy, CoreDNS and CNI. 05 has its own `cni-lite`, `kube-proxy-lite`, `coredns-lite` and a separate worker: a third iptables model in the course after netlab (03) and dsim (04, port publishing as DNAT).

**Fix.** In 5.2, write: "kube-lite is a module of `sim.worker.ts` (09, 1.3). `cri-lite` creates containers via dsim, `cni-lite` creates veth/bridge/routes in netlab, kube-proxy-lite is a rule generator for the netlab netfilter model (the same one as in 03, N10), coredns-lite is a zone in the netlab DNS model". Then the packet in 6.4 goes through the same evaluator as in the networking lessons, and `iptables -t nat -L` in `kubectl exec`/SSH to the node works without duplicated code. The 300 KB budget from 5.7 shrinks as a result: the network is already loaded.

### 9. MAJOR — The sandbox for one's own controller (6.2, screen 2b) exposes the AI key

**Where:** 6.2, "Screen 2b".

**What is wrong.** "The code runs in a separate Worker without access to the network and the DOM". An ordinary Worker (including one from `blob:`) of the same origin has `fetch` (under `connect-src https:` from 09, 6.4) and IndexedDB. IndexedDB holds a non-extractable `CryptoKey` and the encrypted AI key (09, 4.4). A non-extractable key cannot be read, but it can be used to decrypt. Foreign code pasted into the editor (copied from the internet or suggested by the model) obtains the key and sends it anywhere. This is exactly the XSS class that 09, 4.4 names as the main threat.

**Fix.** Run user code in an interpreter inside the worker: `quickjs-emscripten` (MIT, ≈ 500 KB gzip, lazy). The global scope contains only the `k` object (a kube-lite client with ServiceAccount permissions) and `console`. Memory limit 32 MB, time limit per `reconcile` 200 ms (`setInterruptHandler`). TypeScript is stripped of types before execution via `sucrase` (MIT, ≈ 100 KB) — we do not type-check; error highlighting is provided by the editor. The `<iframe sandbox>` on a separate domain option is ruled out because of `frame-src 'none'`. In the code template, add `ownerReferences` in `renderDeployment` (otherwise the scenario "deleting the Website removes everything" will not pass) and update the status from the fresh object after `patch`, not from `have`.

### 10. MAJOR — Kubernetes networking (R9) is not split out into its own section; parts are missing

**Where:** module 4, 6.4.

**What is wrong.** 6.4 is good (real chains, probabilities, "break it"), but it lacks: the statement of the network model ("every pod has its own IP, pods see each other without NAT, this is the CNI's responsibility"); Endpoints versus EndpointSlice; the exercise "find in iptables where a packet to a ClusterIP goes"; CNI and NetworkPolicy support (flannel by itself does not enforce policies; in k3s they are enforced by the built-in kube-router, in Cilium by eBPF); an end-to-end troubleshooting exercise DNS → Service → Endpoints → pod → NetworkPolicy. Search and ndots are mentioned in only one line. For the beginner, `ndots:5` violates the term order: in 03, N8, search domains are given only to the intermediate and advanced levels.

**Fix: split module 4 into "4. Cluster networking" with seven scenes (ready plan).**

> 4.1 **The model.** The three rules of the Kubernetes network model verbatim from the *Cluster networking* page + "who fulfills them: the CNI plugin". A toggle "how it would be in Docker" shows the NAT and `-p` that are absent here.
> 4.2 **Pod to pod on one node.** (as in 6.4.1; in the hybrid — the real `cni0`, `ip -n <netns> addr`, `bridge fdb`.)
> 4.3 **Pod to pod between nodes.** host-gw → VXLAN → (advanced) WireGuard and Cilium native routing/eBPF; the mode toggle changes the frame on the `vswitch` line. VXLAN **is introduced here** for the beginner in a single scene, "an envelope inside an envelope", building on N06 (encapsulation); eBPF — only for the advanced level, in a single scene, "a program in the kernel instead of rule chains".
> 4.4 **Service.** The ClusterIP is on no interface (`ip addr | grep 10.43.12.7` — empty); Endpoints (deprecated, read-only) and EndpointSlice; kube-proxy chains (iptables, an nftables toggle, IPVS — one line "the mode is deprecated, do not use it in new clusters"; status on `hold`, see finding 22); Cilium without kube-proxy — advanced.
> 4.5 **Cluster DNS.** The pod's `resolv.conf`, `search ns.svc.cluster.local svc.cluster.local cluster.local`. For the beginner — only "a short name is expanded to the full one"; for intermediate and advanced — `ndots:5` and five queries for `api.example.com` (a query counter on the diagram, a `dnsConfig.options ndots:1` toggle and an FQDN with a trailing dot).
> 4.6 **Entry from outside.** NodePort → LoadBalancer → Ingress → Gateway (with a transition to explanation 6.9).
> 4.7 **NetworkPolicy.** By default everything is open; the first policy that selects a pod makes it "closed" in the specified direction; policies only allow and add up; a CNI toggle "flannel without kube-router" — the policy is created but **has no effect** (the main trap).
>
> **Networking exercises (add to 7):**
>
> | ID | Level | Task | Check |
> |---|---|---|---|
> | D31 | I/A | On node `worker-1`, find in the NAT rules which IP:port a packet to `10.43.12.7:80` will be rewritten to, and write down all variants | file = the set of `KUBE-SEP-*` DNAT addresses from the model (in the hybrid — from the real `iptables-save`) |
> | D32 | I | A pod cannot find `db` by name, although `db.data` works | answer: the pod and the service are in different namespaces; the fix is `db.data` in env or moving it; check `http.app→db` 200 |
> | D33 | I/A | "A pod cannot reach a service": the scenario has one of five random breakages (CoreDNS stopped / selector does not match / wrong `targetPort` / readiness failing / NetworkPolicy deny). Find and fix it, and write the breakage layer to `answer.txt`: `dns`, `service`, `endpoints`, `pod`, `netpol` | probe 200 + the file matches the breakage class; the debrief shows the path the learner took, in chain order |
> | D34 | A | A `default-deny` policy is created, but traffic flows. Why? (a CNI without NetworkPolicy support) | answer in the file + enabling kube-router (`--disable-network-policy` removed) → probe times out |
>
> Show the end-to-end search order for D33 as a checklist in the debrief: `nslookup` from the pod → `get svc` (ClusterIP, port) → `get endpointslice` (are there ready addresses) → `curl <podIP>:<targetPort>` (does the pod respond) → `get netpol` (does a policy select the pod). This is a direct continuation of the networking principle "first ask which layer broke" (R8).

### 11. MAJOR — The reconciliation loop explanation (R10) falls short of the requirement

**Where:** 6.2.

**What is wrong.** There are "desired/actual/controller" and skipped events. Missing: the desired state as YAML in etcd (R10 explicitly: "desired (YAML in etcd) left"); the interventions "kill a node" and "change the image of a Deployment"; the visible controller chain Deployment → ReplicaSet → Pod → scheduler → kubelet as one screen with several loops; the transition "an operator = the same loop for a CRD".

**Fix (add screens).**

> **Screen 0.** The left column is not an abstract spec but the record `/registry/deployments/shop/web` (YAML, without managedFields), with a `resourceVersion` that grows on every change. The right column is the live pods. Between them is the controller loop "observe → compare → act", with a reconciliation counter.
> **Screen 2, buttons:** delete a pod; change `replicas` with a 0–10 slider; **change the image of the Deployment** (you can see a second ReplicaSet appear — a bridge to 6.7); **turn off a node** (the pods on it turn grey after the grace period — the loop notices this only after node-lifecycle (another loop) has moved them to Terminating).
> **Screen 4. The chain of loops.** Five loops one under another, each with its own desired and actual state: Deployment (spec.replicas+template → ReplicaSets), ReplicaSet (replicas → Pods), scheduler (pod without nodeName → Binding), kubelet (pod on my node → process in the runtime), EndpointSlice (pods with labels → addresses). A single learner action ("scale 3→5") lights up the loops in turn from top to bottom; the lines between the loops show the object through which they are connected. Each loop is clickable → its row from table 6.1 "what happens if you remove it".
> **Screen 5 (= 2b). Your own controller.** First without a CRD: a controller that makes sure every namespace with the `team` label has a `team-info` ConfigMap (familiar objects, a loop in 15 lines). Then the `Website` CRD and the same code. Label: "an operator is the same loop, only the desired state is described by your own object kind". The screen shows the same three arcs as screen 0.

### 12. MAJOR — Level checks contradict 01

**Where:** 2.1–2.3.

**What is wrong.** 01, 4.1: "The beginner does not need a check"; 05, 2.1 introduces a B1–B6 check for the beginner. 01 defines L1 and L2 with its own task lists and the criterion "80 % + key tasks", while 05 uses different tasks I1–I6/E1–E6 and the criterion "5 of 6, both practical ones mandatory". In addition, 01 has a confidence mark and a repeat after 72 hours; 05 has neither.

**Fix.** Rename B1–B6 to "readiness check on the previous blocks". It is triggered not by the level choice but by skipping the Docker exam; on failure the learner goes to the Docker/networking lessons, as in 04, 9.1. Make I/E a single set with 01 (one table, kept in 01, referenced from 05). Take the best of both: I3, I4 and E2 from 05 are stronger than the 01 tasks, while task 01-L2-5 (the `apply` path builder) and 01-L2-6 (the ClusterIP rubric) are stronger than I1/E6. The criterion is the shared one from 01.

### 13. MAJOR — Incorrect: `etcdctl snapshot status/restore` in v1.36/v1.37 clusters

**Where:** D25, 9.3 (No. 7), 10.4 (step 3), K15 in 4.

**What is wrong.** In etcd 3.6 the `etcdctl snapshot status` and `etcdctl snapshot restore` commands were removed and replaced by `etcdutl`; `etcdctl snapshot save` remains ([Announcing etcd v3.6.0](https://etcd.io/blog/2025/announcing-etcd-3.6/), [Disaster recovery](https://etcd.io/docs/next/op-guide/recovery/)). Kubernetes v1.36/v1.37 use etcd 3.6.x. If the learner learns `etcdctl snapshot restore` from the simulator, the command will not work on a real cluster — exactly the risk that 16 talks about.

**Fix.** D25: "the snapshot is checked with `etcdutl snapshot status /opt/backup/etcd.db -w table`". 9.3 No. 7: "`etcdutl snapshot restore … --data-dir /var/lib/etcd-from-backup`". 10.4: the agent calls `etcdutl snapshot status`. In the simulator, `etcdctl snapshot restore` responds with the real etcdctl 3.6 error (unknown subcommand). This trap is a good item for the documentation ladder (step 4): "old instructions lie — check the version".

### 14. MAJOR — An external check via `fetch(http://<ip>/healthz)` from the browser is impossible

**Where:** 10.4, the "R2 check" table, the `net` row.

**What is wrong.** The trainer is served over HTTPS. A `fetch` to `http://` is active mixed content; all browsers block it, and a CORS header on the image does not help. A public IP has no HTTPS with a trusted certificate either.

**Fix.** Without a server: the agent makes the request itself — `curl` from **another** cluster node to the public IP of the first one, and from the node to `127.0.0.1` via the NodePort. This proves that the Gateway works, but not external reachability; the report should say exactly that. With a server (submitted exams): a probe from `dt-api` — outbound HTTP to the learner's address, limited to ports 80/443, only to the machine where the exam agent is registered or to an IP that a confirmed `nonce` points to (otherwise it is a scanner on demand). Delete the line about CORS for `trainer-web`.

### 15. MAJOR — Terminology and order: VXLAN, eBPF, ndots and CRI before introduction

**Where:** 6.4 (scenes 2, 3), 3 (row 16 `cri ← docker:runtime`).

**What is wrong.** In 03, VXLAN is not introduced for the beginner (N14 gives the beginner "the concept of a tunnel"), eBPF is not introduced anywhere, and `ndots` and search are not given to the beginner in 03 (see finding 10). `docker:runtime` = D10 (containerd/shim/runc). Per 04, 3.2, for the beginner D10 is an "overview scene", and the 04 introduction order (row 28) introduces containerd last. Verify on the beginner track that D10 really introduces `containerd` and a `CRI-like interface`; otherwise module 3 rests on something that does not exist.

**Fix.** VXLAN — introduce in module 4 (scene 4.3 from finding 10). eBPF — advanced only, with its own introductory scene. ndots — intermediate and advanced. CRI — introduce in module 3 as a Kubernetes concept ("the interface through which kubelet asks the runtime"), building on `D10 containerd`. In 04, add the requirement that the D10 overview scene for the beginner explicitly names containerd and shim (to be agreed with 04).

### 16. MAJOR — The kernel foundation from Linux and containers (R6, R7) is not used in Kubernetes

**Where:** 1 (prerequisites), modules 1, 5, 6; 6.5 "Resources and QoS".

**What is wrong.** R6 moves into Linux process/thread, namespaces, cgroups v2 (`memory.max`, `cpu.max`, `pids.max`, OOM kill), capabilities, overlayfs, seccomp. R7 — the six container boundaries. Kubernetes must build on them explicitly, but 05 names only "processes and signals, systemd…". It does not say that a pod = a sandbox ("pause") + containers with shared net/ipc namespaces (04, 17 expects this); that `limits.cpu` = `cpu.max`, `requests.cpu` → `cpu.weight`, `limits.memory` = `memory.max`, while `requests.memory` is not limited by the kernel (only by the scheduler and eviction); that `securityContext` = capabilities/seccomp/UID from R6–R7; that `kubectl logs` reads CRI files on the node (the I/O boundary); that `terminationGracePeriodSeconds` = SIGTERM → SIGKILL from the process boundary.

**Fix.** In 1, list the dependencies using the new Linux R6 identifiers and the R7 boundaries. In modules 1/5/6/10, add one "bridge scene" each with real commands (in the hybrid — on the node, in sim — in the node's mini shell):

> Module 1, "A pod is processes": `ssh worker-1`, `ps -ef | grep web`, `lsns -p <pid>` — net and ipc are the same for pause and web, mnt and pid differ (`shareProcessNamespace: false`).
> Module 6, "Requests and limits in the cgroup": `cat /sys/fs/cgroup/kubepods.slice/…/memory.max` → `268435456`; `cpu.max` → `50000 100000` for `500m`; the `limits.memory` slider in the visualizer changes the number in the file; OOM — `memory.events oom_kill 1` and `Reason: OOMKilled` side by side.
> Module 10, "securityContext is what you did by hand": `capabilities.drop: [ALL]` → `grep Cap /proc/<pid>/status` + `capsh --decode`; `runAsUser: 1000` → the process UID from outside; `seccompProfile: RuntimeDefault` → `grep Seccomp /proc/<pid>/status` = 2.
> Module 1, "Where `kubectl logs` comes from": `ls /var/log/pods/…` on the node.

### 17. MAJOR — The textbook (R1) is barely described: the curriculum is a list of topics

**Where:** 4 (module table), 4.1.

**What is wrong.** R1 puts at the core a textbook with coherent theory and a strict order, process explanations and documentation reading; practice rests on them. In 05 only module 0 has a scene. For modules 1–16 there is a single line with a list and the note "short theory in scenes". It is impossible to verify that the theory is coherent, and impossible to estimate the volume of text.

**Fix.** For each module, add a "line of exposition" — 5–8 points in screen order, with the concept introduced on each screen, the process explanation (6.x) and the documentation ladder step. A sample for module 3:

> **Module 3. Deployment.** (1) A question from module 2: a ReplicaSet maintains the count but cannot change the version — we show that `set image` on an RS does nothing. (2) Deployment as the owner of ReplicaSets; `kubectl get deploy,rs,pods` and ownerReferences. (3) Explanation 6.7 "Rolling update" with sliders. (4) "Who chose the node?" — the scheduler is introduced, explanation 6.6 (screens 1–2). (5) "Who started the process?" — kubelet and CRI, the bridge scene "a pod is processes" (finding 16). (6) Control plane and nodes as a summary: builder v1. (7) A failed update and rollback, `rollout history/undo`; documentation — step 2 (a fragment of `rollout undo --help`). (8) Explanation 6.8 "A node went down". Practice: D03–D05, F04–F05. Quiz.

### 18. MAJOR — Golden recordings on kind, while the simulator imitates k3s

**Where:** 5.7.

**What is wrong.** "Run on real k3s (kind in GitHub Actions)" — kind is not k3s. kind has the pod subnet `10.244.0.0/16`, services `10.96.0.0/12`, the kindnet CNI, the `standard` StorageClass, and no Traefik or ServiceLB. The simulator, however, reproduces k3s (`10.42/10.43`, local-path, traefik). A line-by-line comparison will be red or will "normalize" exactly what we teach. In addition, 09, 1.3 requires heavy runs on a separate course test bench, not on GitHub runners.

**Fix.** For each PR — k3d (k3s in Docker) of the same k3s version, on the course's self-hosted runner. Once a day — kubeadm on a VM in the course's test cloud account for the module 15 commands and exam E. Do not use kind.

### 19. MAJOR — Storage is described differently in 05 and in 09

**Where:** 5.7 ("state snapshot in IndexedDB"), 13 (learner state).

**Fix.** The kube-lite snapshot is CBOR + `deflate-raw` in the `snapshots` store (09, 3.1). Hybrid node snapshots go to OPFS: one base `lab-node` snapshot + diffs (not one snapshot per node). The learner state is the event log (finding 7).

### 20. MINOR — AI model and modes

**Where:** 11.

`deepseek-chat` in 09 has been replaced by `deepseek-flash`/`deepseek-v4-pro`. Do not name the model in 05; refer to 09, 4.1. Take the modes from 09, 4.5 (`learn`, `lab`, `explain-output`, `review`, `exam`) and add `docs-coach` (finding 4). Bring the context "last 10 commands and outputs" in line with layer 5 from 09 (40 terminal lines, a budget of 2500 tokens, masking of `client-key-data`). The rule "a ready command on the second request" contradicts 09 (a command only after `n−1` hints) — take the 09 rule.

### 21. MINOR — An inaccuracy about Secret storage in quiz K5

**Where:** 8, question K5, option (a).

In etcd a Secret is stored in serialized form (protobuf) with the **raw bytes** of the value, not in base64; base64 is only the representation in the JSON/YAML API. Wording (a) teaches the wrong model. Fix: "(a) by default the values are stored in etcd unencrypted". In the advanced branch of module 5, show this with `etcdctl get /registry/secrets/default/x | hexdump -C`.

### 22. MINOR — Version-dependent default values: put on `hold`

**Where:** 5.2, 5.4, 6.1 (table), 08, 6.4 (where it says "~40 seconds").

- `node-monitor-grace-period`: for a long time it was 40 s; according to several sources it was changed to 50 s in v1.32 (for example, [kubernetes/kubernetes#127352](https://github.com/kubernetes/kubernetes/issues/127352)); I did not find an official page with this value. Take it from `kube-controller-manager --help` v1.37 and keep it on `hold`.
- CrashLoopBackOff 10 s → 300 s: KEP-4603 (since v1.33, `ReduceDefaultCrashLoopBackOffDecay`, initial delay 1 s, cap 60 s) and the kubelet setting `crashLoopBackOff.maxContainerRestartPeriod`. Check the stage in v1.37; if it is enabled by default, the whole animation and D10 change.
- The IPVS status in v1.37 in 0.5 relies only on DevClass — add a second source (release notes/KEP), otherwise `hold`.

### 23. MINOR — The "byte-for-byte" iptables output does not match the real one

**Where:** 6.4, scene 3.

In real kube-proxy, chain names are `KUBE-SVC-` + 16 hash characters, the probability is printed as `0.33333333349`, the rules have `-m comment --comment "default/web cluster IP"`, and the `KUBE-SEP-*` chain has `KUBE-MARK-MASQ` for traffic from a pod to itself. Since 5.5 promises byte-for-byte output, the example must be real (take it from the k3d golden recording), and the simplified version should be shown only on the diagram with the label "simplified".

### 24. MINOR — Wording about `progressDeadlineSeconds`

**Where:** 6.5, "Rolling update".

"The rollout stops by itself — `progressDeadlineSeconds`" is inaccurate. The rollout gets stuck because of `maxUnavailable`/`maxSurge` when the new pods are not ready. `progressDeadlineSeconds` only sets the condition `Progressing=False/ProgressDeadlineExceeded` and neither stops nor rolls back anything. The corrected wording is in 6.7 of finding 5.

### 25. MINOR — Small practical steps of the real stage

**Where:** 10.3, 9.3.

- Step 7: before `helm install argocd argo/argo-cd` you need `helm repo add argo https://argoproj.github.io/argo-helm`.
- Step 6/R1: a Gateway via the built-in Traefik requires a `HelmChartConfig` that enables the Gateway API provider (finding 6).
- 9.3 No. 6: `/opt/backup/etcd-$(date).db` produces spaces in the name; use `$(date +%F)`.
- 10.2: the Hetzner price is taken from an aggregator blog; in 09 it is from docs.hetzner.com. One `providers.yaml` table for both documents, with primary sources.

### 26. MINOR — The list of resources allowed on the CKA

**Where:** 9 ("only the kubernetes.io side panel is open (the same is allowed on the CKA)").

On the CKA, per the [Linux Foundation list](https://docs.linuxfoundation.org/tc-docs/certification/certification-resources-allowed), besides kubernetes.io/docs and /blog, helm.sh/docs and (for the CKA only) gateway-api.sigs.k8s.io are allowed. Exams E and I use Helm and Gateway API — these sections must be in the documentation mirror (finding 4).

### 27. MINOR — The kube-lite budget and OpenAPI schemas

**Where:** 5.3, 5.7.

OpenAPI v3 for `api/v1` and `apis/apps/v1`, even after trimming, is hundreds of kilobytes of JSON (field descriptions for `explain` are the bulk of it). Compressed, they eat a noticeable part of the 300 KB budget. Move the schemas with descriptions into a separate lazy chunk `k8s-openapi-1.37` (loaded on the first `explain`/`apply`), and keep only structural validation in the core.

---

## Summary against the owner's requirements

| Requirement | State in 05 | Findings |
|---|---|---|
| R1 priorities (textbook, explanations, documentation) | practice is worked out, the textbook is a list of topics | 17 |
| R2 documentation ladder | absent | 4, 26 |
| R3 process explanations | only `kubectl apply` | 5, 11 |
| R4 explanation style | partial (steps, click); ink and sound contradict it | 5 |
| R5 beauty | Sankofa ink for diagrams — against the requirement | 5 |
| R6 Linux kernel foundation | not used | 16 |
| R7 container boundaries | not used | 16 |
| R8 networking by layers | partial; terms before introduction | 10, 15 |
| R9 Kubernetes networking as a separate section | partial | 10 |
| R10 reconciliation loop | partial | 11 |
| R11 multiple nodes in the browser, hybrid | absent, decision 0.1 is against it | 1 |
| R12 three stages, Terraform + Ansible | partial; conflict with the block order | 6 |

What I am adding to 09 on my side as a result of this review: the `k8s.timeline` and `k8s.authz` fact areas, the `docs-coach` AI mode, the `lab-node` image and `vswitch` instead of `inbrowser` for the hybrid, additions to the `dt-kernel` configuration, the QuickJS sandbox for user code, and the documentation mirror in the Service Worker.
