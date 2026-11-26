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
| `patches/` | Patches to the Kubernetes tree so that it builds for js/wasm |
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
`WASM_OPT=1` additionally runs `wasm-opt -Oz` (needs much more memory
than the Go build, see Measurements).

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
(Playwright 1.65) on an Apple Silicon Mac, page served by `vite` from
localhost, so download time is negligible and not included.

| What | Result |
|---|---|
| `kube.wasm` raw | 290.7 MB (277 MiB) |
| gzip -9 | 44.5 MB |
| brotli q11, lgwin 24 | 25.4 MB |
| wasm-opt -O2 (binaryen 123) | not usable on the build pod: it reached the 5 GiB limit within a minute, thrashed for 25 min and was stopped by a timeout without output; needs a host with more memory |
| Full build from a clean cache | ~4.5 min compile + link; relink after a change in `src/` ~10 s |
| `WebAssembly.compileStreaming` | ~0.4 s (V8 compiles lazily) |
| Go runtime init (instantiate → API installed) | ~0.26 s |
| `start()` → apiserver `/readyz` ok | 3.0 s (etcd 2 ms, PKI 17 ms, apiserver built 1.6 s) |
| controller-manager / scheduler started | 3.0 s / 3.3 s after `start()` |
| Page start → ready | 4.1 s |
| `kubectl get ns` | 66 ms first (discovery), then 14-16 ms |
| `kubectl create deployment web --image=nginx` | 98-218 ms first, then 4-5 ms |
| `kubectl get deploy,rs,pods` | 28-34 ms |
| `kubectl api-resources \| wc -l` | 12 ms, 72 lines (71 resources + header) |
| `kubectl delete deployment` | 13-16 ms |
| Go linear memory after the run | 375-405 MiB |
| Renderer process RSS (ps) | ~3.3 GiB |

The renderer RSS is dominated by V8's compiled code for a 290 MB module,
not by the Go heap. The deployment is reconciled into a ReplicaSet and a
Pod, the scheduler reports `FailedScheduling: no nodes available`, and the
service-account controller creates the `default` service accounts, so all
three components work.

For comparison the native linux/amd64 driver on the build pod is ready in
~2.0 s (apiserver built in 0.7 s) and answers `kubectl get ns` in a few ms
after the first call.

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
