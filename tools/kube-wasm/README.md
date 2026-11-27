# kube-wasm

The real Kubernetes v1.37.2 control plane (kube-apiserver,
kube-controller-manager, kube-scheduler), an in-memory etcd and kubectl,
compiled into one `GOOS=js GOARCH=wasm` binary that runs inside a browser
tab. It replaces running the control plane inside an emulated RISC-V
machine, which is ~100x slower than native and never gets to Ready.

Status: prototype. A dev page lives in `web/src/engine/kube-wasm/`
(`demo.html`, `loader.ts`, `memfs.ts`); nothing in the site uses it yet.
There are no nodes: pods are created and stay `Pending`. A kubelet and
containerd inside an emulated Linux are meant to join later over a virtual
network (see "Towards a node").

## Layout

| Path | What |
|---|---|
| `src/memetcd/` | In-memory etcd v3 gRPC server (KV, Txn, Watch, Lease, Status) |
| `src/cluster.go` | Starts etcd, apiserver, controller-manager, scheduler from upstream option code |
| `src/kubectl.go` | Runs kubectl's real command tree in-process |
| `src/pki.go` | Generates the CA, serving cert, service-account key, token file, kubeconfig |
| `src/main_js.go` | JavaScript API (`globalThis.kubeWasm`) |
| `src/main_other.go` | Native test driver for the same code |
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

On the build host (the workshop pod `rv64-dev-b` was used):

```bash
WORK=/work/kube-wasm PATH=/work/rel021/go/bin:/work/tools/node-r17/bin:$PATH \
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
```

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
- `kubectl exec/logs/port-forward/attach` need a kubelet; there is none.
- kubectl plugins and `kubectl edit` (no editor) do not work.
- kubectl's warning printer is process-wide while a command runs, so a
  controller warning could appear in that command's stderr.
- The plain listener makes every in-process client an admin.
- The lite build has no PersistentVolume, HPA or PDB controllers (see patch 0003).
- Go's js/wasm runtime is single-threaded: all components share one core,
  and a long CPU-bound step (for example building the OpenAPI spec) blocks
  everything else until it finishes.

## Towards a node

The node (kubelet + containerd in an emulated Linux) will reach the
apiserver over a virtual network. The apiserver already advertises
`10.0.2.2:6443`, serves TLS with a certificate for that address and trusts
client certificates signed by the cluster CA; the controller-manager signs
CSRs with the same CA and allocates pod CIDRs from `10.244.0.0/16`. What is
missing is a bridge between the emulator's network device and a
`net.Listener` in this process (the fake network only connects goroutines
of the same process), and a bootstrap kubeconfig for the kubelet.
