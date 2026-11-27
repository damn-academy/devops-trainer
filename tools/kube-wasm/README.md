# kube-wasm

The real Kubernetes v1.37.2 control plane (kube-apiserver,
kube-controller-manager, kube-scheduler), an in-memory etcd and kubectl,
compiled into one `GOOS=js GOARCH=wasm` binary that runs inside a browser
tab. It replaces running the control plane inside an emulated RISC-V
machine, which is ~100x slower than native and never gets to Ready.

Status: prototype. Dev pages live in `web/src/engine/kube-wasm/`
(`demo.html`: control plane and kubectl; `node.html`: plus a kuberoot worker
node in the RV64 emulator, see "A node in the tab"); nothing in the site uses
them yet.

## Layout

| Path | What |
|---|---|
| `src/memetcd/` | In-memory etcd v3 gRPC server (KV, Txn, Watch, Lease, Status) |
| `src/cluster.go` | Starts etcd, apiserver, controller-manager, scheduler from upstream option code |
| `src/kubectl.go` | Runs kubectl's real command tree in-process |
| `src/pki.go` | Generates the CA, serving cert, service-account key, token file, kubeconfig |
| `src/main_js.go` | JavaScript API (`globalThis.kubeWasm`) |
| `src/main_other.go` | Native test driver for the same code |
| `src/join.go` | Bootstrap token and kuberoot worker Membership for a node |
| `src/bridge_js.go` | TCP streams between JavaScript and listeners in the process |
| `node/node-media.py` | Derives the worker boot medium from the RV64 R16 medium |
| `patches/` | Patches to the Kubernetes tree: js/wasm build (0001), size (0002, 0003) |
| `overlay.py` | Writes the `go build -overlay` that re-enables method dead-code elimination |
| `build.sh` | Build script (Linux build host) |

## How it works

**Build inside the Kubernetes tree.** `build.sh` shallow-clones
kubernetes v1.37.2, applies `patches/`, copies `src/` to
`cmd/kube-wasm/` and builds there. The tree already vendors every
dependency and wires the `k8s.io/*` staging modules through `go.work`, so
there is no `replace` block to maintain, no module download, and the build
cache is shared with upstream packages. A separate module requiring
`k8s.io/kubernetes` would need ~30 `replace` lines and a full module
download for no gain.

**Networking.** All components use ordinary TCP addresses on 127.0.0.1
(etcd `:2379`, apiserver TLS `:6443`, plain `:8080`). Go's js/wasm port
implements `net.Listen`/`net.Dial` with an in-process fake network
(`net/net_fake.go`), so these connections never leave the process and no
component needs a custom dialer. One catch: on js, `net/http` sends
requests through the browser `fetch` API unless the transport has a
dialer, and client-go uses the bare `http.DefaultTransport` for plain-HTTP
configs. `main_js.go` therefore sets a `DialContext` on
`http.DefaultTransport`, which keeps all clients on Go's HTTP stack and the
fake network.

**Storage.** `memetcd` serves the etcd v3 gRPC API over that fake
network; the apiserver uses its normal etcd3 storage with
`--etcd-servers=http://127.0.0.1:2379`. It keeps a full MVCC history until
the apiserver compacts it (every 5 minutes), so paginated lists and
resource-version pinned reads and watches behave as on etcd. Leases expire
keys (events use a 1 h TTL). It reports version 3.6.5, so the apiserver
uses `RequestProgress` for consistent reads from the watch cache;
`RangeStream` is answered with Unimplemented and the apiserver falls back
to paginated lists. kine was not used: it is not in the Kubernetes vendor
tree, and adding it would put SQL drivers into the module graph.

**kube-apiserver** is built with `cmd/kube-apiserver/app` exactly as the
binary does (`NewServerRunOptions` → flags → `Complete` → `Validate` →
`NewConfig` → `CreateServerChain` → `PrepareRun` → `Run`), with the
aggregator, apiextensions and all built-in APIs. Flags of note:
`--authorization-mode=Node,RBAC`, `--token-auth-file` (one admin token in
`system:masters`), `--endpoint-reconciler-type=none` (no reachable
advertise address yet), `--enable-priority-and-fairness=false`. Certificates
and the service-account key are ECDSA P-256, generated at start and written
to `/etc/kubernetes/pki` in the tab's in-memory file system.

The aggregated handler is additionally served without TLS on
`127.0.0.1:8080`. Requests there that carry no `Authorization` header are
given the admin token, like the insecure port of old releases. Reason:
client-go only sends credentials over TLS, and TLS between goroutines of
one process only costs time. kubectl, the controller-manager and the
scheduler use this listener; the apiserver's own loopback clients use the
TLS port.

**kube-controller-manager and kube-scheduler** run in the same process via
`cmd/kube-controller-manager/app` (`Config` → `Run`, all default
controllers, `--leader-elect=false --secure-port=0`) and
`cmd/kube-scheduler/app` (`Setup` → `Run`). They share the admin kubeconfig.

**kubectl** is `k8s.io/kubectl/pkg/cmd.NewKubectlCommand` invoked per
call with in-memory stdin/stdout/stderr. Its fatal-error path (`os.Exit`)
is turned into a recovered panic carrying the exit code. Calls are
serialised because kubectl keeps process-wide state. Plugins are not
supported (no `execve`).

**File system.** In a browser `wasm_exec.js` answers every file call with
ENOSYS. `web/src/engine/kube-wasm/memfs.ts` installs an in-memory
`globalThis.fs` with the Node callback API that `syscall/fs_js.go` uses
before `wasm_exec.js` loads, so PKI files, the kubeconfig and kubectl's
discovery cache work.

## What was patched or stubbed

`patches/0001-build-for-js-wasm.patch` only adds js variants of
platform files and excludes js from the Unix ones; other platforms build
the same code as before.

| Package | Problem on js | js variant |
|---|---|---|
| `vendor/github.com/coreos/go-systemd/v22/journal` | Unix sockets for journald | journald disabled (Windows stub) |
| `vendor/go.etcd.io/etcd/client/pkg/v3/fileutil` | `flock` | lock = plain open |
| `vendor/github.com/moby/term` | termios ioctls | never a terminal |
| `staging/src/k8s.io/mount-utils` | `access(2)`, `uname(2)` | no mount points |
| `staging/src/k8s.io/apiserver/pkg/server/options` | `SO_REUSEPORT`/`SO_REUSEADDR` | no-op |
| `staging/src/k8s.io/kubectl/pkg/cmd` | `syscall.Exec` for plugins | `ErrUnsupported` |
| `staging/src/k8s.io/kubectl/pkg/util` (umask), `util/interrupt` (SIGHUP), `util/term` (SIGWINCH) | missing syscalls/signals | Windows behaviour (polling, no umask, no SIGHUP) |
| `pkg/probe` | `SO_LINGER` | plain dialer |
| `pkg/securitycontext` | CPU topology | none |
| `pkg/scheduler/backend/cache/debugger` | SIGUSR2 | os.Interrupt |
| `pkg/util/filesystem` | file had no js build tag | reuse the Unix code (pure Go) |

Size patches (only for this build):

- `patches/0002-go-cmp-no-reflect-method.patch`: go-cmp prints `interface{ ... }`
  instead of interface method names (see "Linker method DCE").
- `patches/0003-kcm-lite-controllers.patch`: with `-tags kubewasm_lite` the
  controller-manager registers only deployment, replicaset, statefulset,
  daemonset, job, cronjob, replicationcontroller, endpoints, endpointslice
  (+ mirroring), service-cidrs, namespace, serviceaccount,
  serviceaccount-token, garbage-collector, pod-gc, resourcequota,
  node-lifecycle, taint-eviction, node-ipam, ttl, ttl-after-finished,
  csr signing/approving/cleaning, bootstrap-signer, token-cleaner,
  clusterrole-aggregation and root-ca-cert-publisher. Left out:
  horizontal-pod-autoscaler, disruption (PodDisruptionBudget status),
  persistent volume binder/attach-detach/expander/protection, ephemeral
  volumes, VolumeAttributesClass protection, DRA controllers,
  storage-version GC and migrator, SELinux warning, admission policy
  status, legacy token cleaner, pod group protection, pod certificate
  request cleaner, ClusterTrustBundle publisher. Consequence: PVCs are not
  bound and PDBs get no status.
- `overlay.py`: build overlay for `text/template` and `reflect`, see
  "Linker method DCE".

Nothing in the control plane itself was patched.

## Build

On the build host (the workshop pod `rv64-dev-b` was used), with Go
1.26.11 or newer (1.26.0 corrupts the heap of kube.wasm, see "The crash"):

```bash
WORK=/work/kube-wasm PATH=/work/tools/go-1.26.11/go/bin:/work/tools/node-r17/bin:$PATH \
  tools/kube-wasm/build.sh          # -> $WORK/out/kube.wasm{,.gz,.br}, wasm_exec.js
tools/kube-wasm/build.sh native     # -> $WORK/out/kube-wasm-native (test driver)
```

`build.sh` sets `GOMAXPROCS=3`, `-p 2`, `GOGC=50`, `GOMEMLIMIT=4000MiB`
and keeps sources, `GOPATH`, `GOCACHE` and `GOTMPDIR` under `$WORK`.
`GOTAGS` defaults to `kubewasm_lite` (trimmed controller-manager, patch
0003); `GOTAGS=` builds every upstream controller. The wasm build always
applies the overlay from `overlay.py`. `WASM_OPT=1` additionally runs
`wasm-opt -Oz`; it needs ~9 GB of memory, so on the 5 GiB pod it stalls
(run it on a bigger machine: `wasm-opt -Oz --enable-bulk-memory
--enable-sign-ext --enable-nontrapping-float-to-int --enable-mutable-globals`).

Native driver: each argument is one kubectl command line,
`"sleep 3s"` waits, `"GET /path"` does a raw request:

```bash
$WORK/out/kube-wasm-native "get ns" "create deployment web --image=nginx" "sleep 3s" "get deploy,rs,pods"
```

Browser: copy `kube.wasm` and `wasm_exec.js` into
`web/src/engine/kube-wasm/dist/` (git-ignored), run `npm run dev` in `web/`
and open `/src/engine/kube-wasm/demo.html` (`?logs` shows component logs,
`?v=2` raises verbosity).

## JavaScript API

```ts
const { api } = await loadKubeWasm({ wasmUrl, wasmExecUrl });
await api.start({ v: 0, controllers: true, scheduler: true });
const phases = await api.ready();            // ms since start() per phase
const { stdout, stderr, code } = await api.kubectl(['get', 'ns']);
await api.kubectl(['apply', '-f', '-'], yaml); // stdin
const membership = await api.joinMembership('kuberoot-000001', '10.0.0.10');
const conn = api.connect('127.0.0.1:6443', onData, onClose); // {write, end, close}
api.listen('10.0.0.10:10250', (c) => { /* open the far side, then */ c.start(onData, onClose); });
api.memStats(); // Go heap numbers
```

`start()` also takes `apiserverArgs` and `controllerManagerArgs`, appended
to the components' flags.

## Measurements

Build host: workshop pod (3 CPU, 5 GiB). Browser: headless Chromium
(Playwright 1.65) and Google Chrome 158 on an Apple Silicon Mac (16 GB),
page served by `vite` from localhost, so network time is not included.
Memory is the renderer's macOS *footprint* (what Activity Monitor shows;
`footprint <pid>`), taken after the scenario below; the renderer pid comes
from the browser itself over CDP (`SystemInfo.getProcessInfo`).

Scenario (`web/kube-wasm-measure.mjs`, untracked): load, `start()`, wait
for `/readyz`, then `get ns`, `create deployment web --image=nginx
--replicas=3`, `get deploy,rs,pods`, `api-resources | wc -l` (each repeated
4 more times), `--help`, `get --help`, `explain deployment.spec.strategy`,
a go-template, then wait 5 s and check that 3 pods exist with
`FailedScheduling` events.

### Current build (lite, default)

| What | Result |
|---|---|
| `kube.wasm` raw / gzip -9 / brotli q11 | 233.2 MB / 38.1 MB / 22.2 MB |
| Build from a clean cache | ~4.5 min; relink after a change in `src/` ~10 s |
| Compile (`compileStreaming`, also from a brotli-served file) | 0.2–0.4 s |
| Go runtime init | ~0.25 s |
| `start()` → apiserver `/readyz` | 3.0–3.3 s |
| Page start → ready | 3.8–4.2 s (Chromium), 4.2 s (Chrome) |
| `kubectl get ns` | ~42 ms first, then 14–15 ms |
| `kubectl create deployment ... --replicas=3` | 135–145 ms (first write) |
| `kubectl get deploy,rs,pods` | 29–34 ms |
| `kubectl api-resources \| wc -l` | 10–12 ms (72 lines) |
| Go linear memory | 355–370 MiB |
| Renderer footprint | 825–836 MB (Chromium and Chrome) |

An occasional single command takes 110–150 ms instead of 15–30 ms: a Go
garbage collection stops the only thread.

### Effect of each step

| Step | raw MB | brotli MB | footprint | ready | Notes |
|---|---|---|---|---|---|
| Round 1 build | 290.7 | 25.4 | 0.90–0.91 GB | 4.2–4.7 s | the "3.3 GiB RSS" reported in round 1 was wrong: it summed every Chrome process on the machine |
| Linker method DCE (`overlay.py`, patch 0002) | 238.9 | 22.8 | 0.83 GB | ~4 s | see below |
| Lite controller-manager (patch 0003) | 233.2 | 22.1 | 0.83 GB | 3.8–4.2 s | default |
| + `wasm-opt -Oz` (binaryen 133, on the Mac) | 190.5 | 22.2 | 0.76 GB | 4.1 s | 220 s, 9.2 GB peak; smaller in memory, not on the wire; not in the default build |
| `-gcflags=all=-l` (no inlining) | 220.4 | – | 0.83 GB | 6.8 s | rejected: commands ~30 % slower, ready over 5 s |
| `GOGC=50` / `GOMEMLIMIT=256MiB` | – | – | 0.90 / 0.90 GB | – | no effect: wasm memory never shrinks and its peak is reached during start |
| V8 `--no-wasm-tier-up` / eager compilation | – | – | 0.90 / 0.91 GB | – | compiled code is not what fills the footprint |
| `--watch-cache=false` | – | – | −12 MB | +0.05 s | not worth changing |
| `--runtime-config=api/beta=false,api/alpha=false` | – | – | 0 | −0.3 s | small; betas stay on for the course |

**Linker method DCE.** The Go linker keeps every exported method of
every reachable type as soon as one reachable function looks methods up
by a name or index unknown at compile time. In kube-wasm that was
`text/template` (cobra and kubectl help), the Go 1.26 `reflect`
`Methods` iterators (reachable because a vendored JSON package embeds
`reflect.Value` in an interface value) and go-cmp's type printer
(`go build -ldflags=-dumpdep | grep '<ReflectMethod>'` lists them).
`overlay.py` writes a `go build -overlay` in which `text/template`
looks methods up with constant names: the 47 identifiers that follow a
`.` in the templates compiled into the binary. The `reflect`
iterators panic; patch 0002 stops go-cmp from printing interface method
names. Help, `explain` and go-template output still work.

**Where the bytes are.** Code is 131.7 MB (brotli ~14.4 MB), data
101.0 MB (brotli ~11.6 MB). The data is pclntab, type descriptors and
strings, with zeros spread in short runs; Go already emits the maximum of
100 000 data segments, so packing data segments gains nothing (tried). By
subsystem, code is split as: non-GA API versions (`v1beta*`, `v1alpha*`)
19.5 MB, Go standard library 13.4 MB, GA API types 12.6 MB, apiserver
libraries 10.2 MB, OpenAPI (generated definitions and libraries) 9.0 MB,
internal API types and conversions 8.9 MB, kubectl and CLI 7.3 MB, CEL
5.5 MB, etcd/gRPC/protobuf 5.2 MB, registry 4.6 MB, scheduler 3.6 MB,
controllers 3.1 MB, the rest 25 MB. Of the non-GA 19.5 MB, 11.9 MB are the
`k8s.io/api` types themselves.

**What it would take to reach ~12 MB brotli.** Roughly halving the
linked code. Leaving out the non-GA API versions is the largest single cut
(estimated ~3 MB brotli) but means regenerating client-go's clientset,
informers and scheme for GA versions only and removing those versions from
the apiserver's API installs, REST storage and generated OpenAPI. CEL
(~1 MB brotli) is wired into admission policies, CRD validation and
authorization. Neither fits a patch-level change.

### Native, for comparison

The native linux/amd64 driver on the build pod is ready in ~2.0 s
(apiserver built in 0.7 s) and answers `kubectl get ns` in a few ms after
the first call.

Known noise in the browser console: about 100 warnings
`retrying of unary invoker failed ... the client connection is closing`
right after start. They come from a storage client the apiserver closes
while constructing its storage, retrying a read until it gives up; it
does not happen natively, where the read finishes first, and has no
effect.

## Known limitations

- One tab, one cluster; state is lost on reload.
- `kubectl exec/logs/attach` work only with a node and the kubelet client
  certificate (see "A node in the tab"); `port-forward` is untested.
- kubectl plugins and `kubectl edit` (no editor) do not work.
- kubectl's warning printer is process-wide while a command runs, so a
  controller warning could appear in that command's stderr.
- The plain listener makes every in-process client an admin.
- The lite build has no PersistentVolume, HPA or PDB controllers (see patch 0003).
- Go's js/wasm runtime is single-threaded: all components share one core,
  and a long CPU-bound step (for example building the OpenAPI spec) blocks
  everything else until it finishes.

## A node in the tab

`node.html` runs kube.wasm on the main thread and a kuberoot worker node
in the RV64 emulator (`web/src/engine/rv64`, merged from `feat/rv64-r0`) in
its workers, in one tab.

```
 RV64 workers                    main thread
 ┌──────────────────────┐ frames ┌────────────────────────────────────────┐
 │ kuberoot worker      │───────▶│ L2 switch ─ lab host 10.0.0.1          │
 │ 10.0.0.10            │◀───────│   DHCP, DNS, HTTP, TCP :6443 listener   │
 │ kubelet, containerd, │        │        │ bridge (connect)               │
 │ kube-proxy,          │        │        ▼                                │
 │ kuberoot-node        │        │ kube.wasm: 127.0.0.1:6443 (TLS)         │
 └──────────────────────┘        │   apiserver ─▶ 10.0.0.10:10250 listener │
                                 │        │ bridge (listen) ─▶ lab host    │
                                 │        ▼   connect to the node          │
                                 └────────────────────────────────────────┘
```

**Joining.** kuberoot's kinit runs a node as a worker when
`/var/lib/kuberoot/membership.json` holds a Membership (role, API server,
cluster CA, bootstrap token, node API certificate, pod and service
ranges). `node/node-media.py` derives the medium
`r18-kubewasm-worker` from the pinned R16 medium with two changes: a
32 KiB placeholder file `/kuberoot/join.json` on the boot partition, and
a stage-two wrapper (`/usr/sbin/kinit`) that copies it to
`membership.json` when it holds a Membership, skips the standalone probe
and loads the medium's offline images (busybox, coredns, local-path)
into containerd. The page asks kube.wasm for a Membership
(`joinMembership`: a bootstrap token Secret, the kubeadm-style RBAC
bindings for node client certificate auto-approval and kube-proxy, a node
API certificate signed by the cluster CA) and lays it over the
placeholder's bytes through `HTTPDisk.overlay` in the RV64 block device,
so one medium serves every tab.

**Network.** The apiserver advertises 10.0.0.1, the lab host of the
emulated network, with a serving certificate for that address. The lab
host listens on TCP 6443; each connection is bridged into the process
(`connect`) to the apiserver's TLS port, so TLS is end to end between the
kubelet and the apiserver. For logs and exec the apiserver dials the
kubelet at its InternalIP (`--kubelet-preferred-address-types=InternalIP`);
kube.wasm listens on 10.0.0.10:10250 in its fake network (`listen`) and
the page opens the real connection to the node through the lab host.

**Certificates.** The kubelet bootstraps with the token; the
controller-manager approves and signs its client certificate with the
cluster CA. Kubelet serving certificates are not auto-approved upstream;
the page approves them. The controller-manager runs with
`--node-monitor-grace-period=5m`: the emulated kubelet sometimes posts its
status minutes late, and with the default 50 s the node turned `Unknown`
and its pods were evicted.

### Measurements (headless Chromium, 2 harts, 1 GiB guest RAM)

Times are seconds after page load. Each run boots the node from cold; no
checkpoint is restored.

| Run | Variant | Node registered | Node Ready | Pod Running (created when Ready) | logs / exec | Tab footprint at the end |
|---|---|---|---|---|---|---|
| 4 | default | 243 | 264 | 552 (waited for the image import) | not tried (no kubelet client cert) | 3.75 GB |
| 5 | `?kubeletClient=1` | 388 | 419 | 770 | 785 / 851 (`uname -m` = riscv64) | 3.9 GB |
| 9 | default, grace 5 m, busybox imported first | 347 | 985 | 1156 | – | 4.2–4.3 GB |
| 2 | default, grace 50 s | 492 | not within 15 min (node `Unknown`) | – | – | 3.9 GB |
| 8 | default | ~370 | 439 | not within 18 min: busybox import never finished (`ErrImageNeverPull`) | – | 4.3 GB |

Constant parts: kube.wasm is ready 3.8–4.1 s after load; the guest reads
its Membership at 15–19 s; the kubelet gets its client certificate
through the bootstrap token about 5 minutes in; the pod receives
10.244.0.2 from the node's bridge CNI. In every run the Go linear memory
ends at ~1.1 GiB (from ~380 MiB without a node).

What the numbers show: the slow, variable part is the emulated node, not
the control plane. Between registration and the first Ready status
the kubelet took 20 s in two runs and ~10 minutes in another, and
importing the offline images competes with the kubelet for the two
emulated harts.

### Round 4: memory, checkpoints, the crash

**Memory** (renderer footprint, headless Chromium; boot from cold unless noted):

| Run | Settings | Footprint | Go linear memory | Node |
|---|---|---|---|---|
| run9 (round 3) | defaults, guest 1 GiB | 3.7 GB at Ready, 4.2–4.5 GB later | 1.5 GiB (HeapAlloc 1.25 GB) | Ready 985 s |
| m1 | guest 768 MiB, `GOMEMLIMIT=600MiB`, `GOGC=50`, `--watch-cache=false` | 3.0–3.3 GB | 0.71 GiB (Sys 608 MB, HeapAlloc 492 MB) | registered 269 s, not Ready by 755 s; at 12.5 min the page stopped answering (GC at the limit, the single thread starved) |
| cap1 | defaults, checkpoint taken | 3.7–3.8 GB before, 5.2 GB while saving RAM | 1.3 GiB | Ready 929 s, pod 1074 s |
| res3 | restore of cap1 | 2.35–2.6 GB first minutes, 3.25 GB at 10 min | 1.2 GiB after 10 min (HeapAlloc 1.0 GB) | see below |

Where it goes: the guest's RAM is touched almost entirely (937 of 1024
MiB chunks nonzero in the checkpoint); kube.wasm is ~0.45 GB of compiled
code plus a Go heap that grows with node traffic (0.4 GiB without a
node, 1–1.5 GiB with one); the rest (~0.5–1 GB) is the emulator's JIT and
workers. `GOMEMLIMIT` holds the Go heap but below its live size the
single-threaded runtime spends its time collecting and the tab freezes;
600 MiB is too low, the live heap with a node is 0.5–1 GB. A 1.5 GB tab is
not reachable by settings alone: it needs a smaller guest that still boots
fast, and finding what keeps the Go heap at ~1 GB (bridged connections
alive at the time: up to 58 after a restore).

**Checkpoint of a ready node.** `node.html?capture=1` waits for the pod to
run, stops all harts at the emulator's snapshot barrier, saves the
control plane (`saveState`: PKI files and a memetcd snapshot) and the
guest (`dt.rv64.smp/v1`: CPU and device blobs, nonzero RAM in 1 MiB
objects, ~0.96 GB for a 1 GiB guest) through POST
`/snapshot-upload/<name>`, and lets the node run on.
`node.html?restore=<dir>/` loads both: kube.wasm starts from the saved
store and certificates (same CA, tokens, node and pod objects) and the
harts resume from the barrier.

| Restore run | Clock | kube.wasm ready | Guest running | Node heartbeat after restore |
|---|---|---|---|---|
| res2 | elapsed (guest clock jumps forward) | 4.1 s | 6.0 s | none in 10 min; PLEG unhealthy, "container runtime is down" |
| res3 | continuous | 3.7 s | 5.7 s | none in 10 min |

After the restore the guest runs, its TCP reaches the lab host (HTTP to
10.0.0.1:80 answers; 58 connections to 6443 were bridged in 10 min), but
it runs very slowly at first (kubelet housekeeping 50 s instead of 1 s;
every emulated block is compiled again) and the kubelet's TLS handshakes
to the apiserver hit their 10 s timeout (`net/http: TLS handshake
timeout`), so it never posts status and the node turns `Unknown`. The
next steps: give the kubelet the same long handshake timeout the medium
already gives kubectl and kuberoot-node (`KUBEROOT_TLS_HANDSHAKE_TIMEOUT`,
which needs a kubelet built with that client overlay), and find why the
restored guest is so much slower than a booted one.

**The crash** (`found pointer to free object` with the kubelet client
certificate). `test/run-node.mjs` reproduces it without a browser, under
Node.js on the build host, with Node's real file system as well as with
memfs, so neither the page nor memfs is involved:

| Variant (20–24 starts each with the two flags) | Crashes |
|---|---|
| as built | 4/12 (real fs), 2/12 (memfs) |
| kube-openapi's go-json-experiment marshalling off (`UseOptimizedJSON*=false`) | 4/15 |
| kubelet client certificate loaded once (no file reloading) | 11/24 |
| `GODEBUG=gcstoptheworld=1` | 1/20, but a different error: `invalid runtime symbol table` |
| `-gcflags=all=-d=checkptr` | crashed, no checkptr report |
| without the two flags | 0/20 (plus 0/20 in the browser) |

A runtime overlay that prints the type of the freed object named an
anonymous struct of kube-openapi's `spec.Schema` marshalling
(`struct { ArbitraryKeys; SchemaProps schemaPropsOmitZero; ... }`, 576
bytes) in the one crash it caught. Turning that marshalling path off did
not remove the crash, and the second error under a stop-the-world GC
points to memory corruption beyond a missed write barrier. The likely next
step is a newer Go: the build uses go1.26.0 and go1.26.11/go1.27.4 are
out; downloading a toolchain was not allowed in this round.

### Round 5: restore to a working node

Three things kept a restored node silent; all are fixed:

1. **No JIT after a restore** (`web/src/engine/rv64/smp-cpu.worker.ts`).
   A hart restored at worker start kept its pre-restore JIT runtime and
   never compiled a block: 6 MIPS per hart, all interpreted (a booted node
   runs 85–95 % of its instructions from compiled blocks). The worker now
   starts a fresh JIT runtime after `smp_restore`, as the barrier restore
   did; the node page shows MIPS and JIT share per hart.
2. **Stale TCP connections.** The restored guest keeps its connections to
   10.0.0.1:6443 (`netstat` on the node: ESTABLISHED, idle); the new tab's
   lab host has none, and an idle kubelet never sends anything that would
   reveal it. The checkpoint now records the lab host's connections and
   the restored page resets them (`LabHost.resetPeer`: a reset plus a bare
   ACK, so that a peer expecting another sequence number answers and gets
   an exact reset). The clients reconnect at once.
3. **Ten-minute heartbeats.** Under the emulator profile kinit scales the
   kubelet's periods by 60: node lease 2400 s, status every 10 minutes,
   report every 5 hours, which also explains the node turning `Unknown`
   between updates in rounds 3–4. The r19 medium wraps the kubelet to
   renew its lease every 30 s (lease 120 s, status 30 s, report 5 min).

The kubelet needed no rebuild for its TLS handshake: it is the combined
slim binary, and its environment (read on the node console) has
`KUBEROOT_TIMESCALE=60`, which scales client-go's handshake deadline to
600 s.

Restore of a checkpoint taken from an r19 boot (node Ready 396 s, pod
580 s, checkpoint saved at 662 s, 1 bridged connection recorded); times in
seconds after page load:

| Run | kube.wasm ready | Harts running | Fresh lease renewal | New deployment's pod Running | Tab footprint | Go linear memory at the end |
|---|---|---|---|---|---|---|
| r19b | 3.6 | 5.5 | 67 | – (kube.wasm died at 127 s: `invalid runtime symbol table`) | – | – |
| r19c | 3.6 | 5.4 | 31 | 212 | 1.94 → 3.23 GB | 0.64 GiB |
| r19d | 4.1 | 6.0 | 47 | 255 | 2.15 → 3.28 GB | 0.66 GiB |

The node is back within 30–70 s of the page load; a new pod then takes
another 3–3.5 minutes (sandbox and container creation in the emulated
guest). The tab starts at ~2 GB and grows with the emulator's JIT. The
Go runtime crash now also occurs without the kubelet client certificate
under node traffic (r19b), so a newer Go remains the next step.

### Round 6: memory in the restore scenario

**The crash.** `GODEBUG=gcstoptheworld=1,gcshrinkstackoff=1` (set by the
loader) removed it: 0 crashes in 60 starts under Node.js, 20 of them with
the kubelet client certificate built in (each setting alone: 1/20 and
3/50). The apiserver gets its kubelet client certificate by default
again, so `logs` and `exec` work after a restore. The price is
responsiveness under node traffic (below). Downloading a newer Go was not
permitted from this session.

**The Go heap.** Heap profiles (`heapProfile()`, `?heapAt=` on the node
page) after a restore show 106–115 MB live; the Go linear memory is now
0.36–0.45 GiB, down from 0.64–1.5 GiB. Two retention sources were found:
bridged connections were never freed (their JavaScript functions were
never released; fixed: `close` releases them), and every kubectl call
keeps ~0.67 MiB (its command tree's flags and REST mapper; measured with
`run-node.mjs --kubectl-loop`; not fixed yet). The ~4300 goroutines are
the informers of the controller-manager and the apiserver, not a leak.

**Restores** (seconds after page load):

| Run | Guest RAM | GODEBUG | JIT budget | Node heartbeat | New pod Running | logs / exec | Footprint | Go linear memory |
|---|---|---|---|---|---|---|---|---|
| r19c (round 5) | 1 GiB | none, no kubelet client cert | 256 MiB | 31 | 212 | – | 1.94 → 3.23 GB | 0.64 GiB |
| m19g | 1 GiB | stop-the-world, no shrinking | 256 MiB | 387 | – | 402 / 382 | 2.45 → 3.01 GB | 0.40 GiB |
| m19t | 1 GiB | same, `GOGC=300` | 256 MiB | 147 | – | – / 142 | 2.72 → 2.98 GB | 0.42 GiB |
| m19s | 1 GiB | no shrinking only | 256 MiB | 146 | – | 155 / 141 | 2.70 → 2.99 GB | 0.36 GiB |
| m768a | 768 MiB | stop-the-world, no shrinking | 256 MiB | none in 7 min (kubelet: TLS handshake timeouts, 214 connections) | – | – | 2.36 → 2.93 GB | 0.40 GiB |
| j64 | 768 MiB | stop-the-world, no shrinking | 64 MiB | none in 9 min (JIT share 0.7, 5–7 MIPS) | – | – | 1.79 → 2.70 GB | 0.40 GiB |

**Guest RAM in the checkpoint.** A 768 MiB guest still had 755 nonzero
MiB chunks, because freed pages keep old data. Before capturing, the
page now drops the guest's page cache and fills its free memory once
with zeros (a tmpfs file, removed again): the next capture had ~426
nonzero MiB, and zero chunks are never written on restore. That capture
did not finish, because the Mac ran out of disk space while saving it.

Where this leaves the 1.5–2 GB goal: the control plane is now ~0.4 GiB
of Go memory plus ~0.45 GB of compiled code; the rest is the emulator
(guest RAM touched, its JIT, its workers). A 768 MiB guest and a small
JIT budget lower the footprint by 0.3–0.6 GB but, with the
stop-the-world collector, the restored kubelet then misses its TLS
deadlines and the node does not come back. The next steps: the zeroed
768 MiB checkpoint (needs disk space), a newer Go so that the
concurrent collector can return, and fixing the per-call kubectl
retention.

### Round 7: Go 1.26.11

Built with Go 1.26.11 and no GODEBUG settings, kube.wasm did not crash in
80 starts under Node.js (all with the kubelet client certificate) nor in a
100-call kubectl loop; the same tests crashed about a third of the time
with Go 1.26.0. The loader no longer sets the stop-the-world collector.

kubectl calls no longer accumulate memory: cobra kept every flag with a
completion function in a global map, which retained each call's command
tree, factory and REST mapper. Over 100 calls the live heap now stays at
107 MiB (it grew from 115 to 175 MiB before).

Restores (seconds after page load, JIT budget 256 MiB):

| Run | Guest RAM | Node heartbeat | exec | logs | New pod Running | Footprint | Go linear memory |
|---|---|---|---|---|---|---|---|
| r7a | 1 GiB | 66 | 61 | 32 | 201 | 2.71 → 3.24 GB | 0.36 GiB |
| r7b | 1 GiB | 77 | 72 | 84 | 265 | 2.68 → 3.09 GB | 0.35 GiB |
| r7za | 768 MiB (zeroed) | 105 | 100 | 116 | 395 | 2.50 → 3.08 GB | 0.37 GiB |
| r7zb | 768 MiB (zeroed) | 121 | 116 | 133 | 317 | 2.44 → 3.05 GB | 0.37 GiB |

The zeroed 768 MiB checkpoint has 673 nonzero MiB chunks (684 MB on
disk). Most of the footprint is the emulator, its JIT and its workers,
not the control plane.

### Round 8: where the restored tab's memory goes

Measured with `footprint -v` of the renderer process (headless Chromium
on macOS, 16 KiB pages), grouping dirty memory by address range and VM
tag (V8 = tag 255, PartitionAlloc = tag 253), and comparing with a
control-plane-only run (`?emulator=0`, 0.77 GB). The page's own V8 heap
(`Runtime.getHeapUsage`) holds only 16–39 MB, ArrayBuffers included.
`performance.measureUserAgentSpecificMemory` is not available in the
headless shell.

Restored 1 GiB node, after the new pod runs (2.99 GB):

| Part | MiB | Notes |
|---|---|---|
| Guest RAM (shared memory) and its tables | ~980 | every nonzero checkpoint chunk is written, so ~950 MiB is touched at once |
| kube.wasm linear memory | 367 | Go heap 0.16–0.24 GiB live; the memory never shrinks |
| WebAssembly code | 326 | kube.wasm ~116, the rest the emulator's JIT blocks; grows with the block count |
| Large malloc (module bytes etc.) | 467 | kube.wasm's 223 MiB module bytes; the rest the JIT modules, kernel and initrd copies |
| Small malloc (Blink, messages, V8 off-heap) | 294 | 84 without the emulator |
| JS heaps of the workers and the page | ~305 | 116 without the emulator; grows with the JIT block count |
| Other | ~250 | thread stacks, fixed V8 reservations |

The checkpoint is not held twice: RAM chunks were fetched all at once
but each was freed after it was written.

Steps (1 GiB guest unless noted; footprint at the end / peak, seconds
after page load):

| Step | Footprint | Heartbeat | New pod Running | Notes |
|---|---|---|---|---|
| baseline (round 7) | 2.99 / 3.10 GB | 72 | 242 | |
| RAM restored 4 chunks at a time | 2.98 / 3.07 GB | 68 | 234 | kept |
| + no kernel/initrd on restore | 2.91 / 2.96 GB | 68 | 243 | kept |
| JIT total 128 MiB (`jitBudgetMb=64`) | 2.74 / 2.90 GB | none in 9 min | – | blocks evicted and recompiled in a loop (1.5 M compilations) |
| JIT total 256 MiB (`jitBudgetMb=128`) | 2.76 / 2.83 GB | none in 9 min | – | same |
| V8 `--liftoff-only` | 2.93 / 2.94 GB | 278 | – | slower; a browser flag, not available to a page |
| + 1 compile worker, `GOGC=50`, `GOMEMLIMIT=300MiB` | 2.80 / 2.95 GB | 84 | 281 | Go memory 325 instead of 390 MB; the Go limit is kept |
| + `wasm-opt -Oz` kube.wasm | 2.71–2.81 / 2.84–2.98 GB | 69–78 | 246–268 | module bytes −40 MiB; one Go crash (`invalid runtime symbol table`) in 4 browser runs, none in 30 starts under Node.js; not in the default build |
| same, zeroed 768 MiB guest | 2.81 / 3.01 GB | 116 | 336 | guest RAM 720 instead of 930 MiB, but small malloc grew by 200 MiB in that run |

Where this leaves the 2 GB goal: the guest (0.7–0.95 GiB), the Go
memory (0.3), kube.wasm's code and module bytes (0.35) and the JIT the
node needs (a shared cache of 512 MiB accounted; less does not keep the
node alive) already come to ~2.2 GB before the workers' heaps and
Blink. Reaching 2 GB needs a smaller JIT working set (fewer, larger
blocks or cheaper per-block bookkeeping in the workers), a smaller
kube.wasm, or a smaller guest.

### Open problems

- **Go runtime crash with the kubelet client certificate.** With
  `--kubelet-client-certificate/--kubelet-client-key`, kube.wasm dies in
  a quarter to a third of starts within the first 30 s with `fatal error:
  found pointer to free object` (also with `GOEXPERIMENT=nogreenteagc`,
  and also with the endpoint reconciler and bootstrap token auth turned
  off). Without the two flags it did not happen in 20 starts. The default
  leaves them out, so logs and exec need `?kubeletClient=1` and a start
  that survives. The cause is not found yet.
- **Go heap.** During a node run the Go linear memory grows from ~380 MiB
  to 1.1–1.5 GiB and, wasm memory never shrinking, stays there (run 9 at
  the end: HeapAlloc 1.25 GB after 23 collections); together with the
  emulator's 1 GiB guest and its JIT the tab reaches 3.7–4.5 GB. Not yet
  tried: `GOMEMLIMIT`/`GOGC` for this case (`loadKubeWasm({env})`), and
  finding what holds the heap (watch caches, memetcd history until the
  5-minute compaction, kubelet traffic).
- **Speed.** The emulated node registers 4–8 minutes after page load and
  becomes Ready 20 s to 10 minutes after that; importing the offline images
  takes several minutes more, so the first pod ran 9–19 minutes after page
  load in the runs that got there. In one run the busybox import did not
  finish within 18 minutes. Restoring a checkpoint of a booted node (the
  RV64 track has SMP checkpoints) is the obvious next step.
- Node name and address are fixed (`kuberoot-000001`, 10.0.0.10: the
  emulator's MAC and the first DHCP lease); one node per tab.
- No CoreDNS addon is installed and no route leads out of the tab, so
  pods have no DNS and no network beyond the node.
