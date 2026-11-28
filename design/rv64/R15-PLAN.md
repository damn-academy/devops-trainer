# R15 — guest-only slow-node convergence candidate

Status: prepared and locally checked, **not a measured Node Ready result**. The
operator builds the medium and runs the browser. No pods or browsers were run
while preparing this change. No emulator changes, no extra JIT memory, no new Go
binary in the default candidate. R15-a is a 700-second diagnostic gate; R15-long
is the 3000-second acceptance run. A configuration-only candidate cannot promise
to cure an unpatched client's hardcoded TLS deadline.

## Evidence: actual R6, not today's kuberoot checkout

The inspected source medium is `web/public/rv64/r6-uncompressed-no-reboot.img`,
630194176 bytes, SHA-256
`29d01f8c77ea7d7e3db539d7b9259943187cad88b3c3ccdada122702ab7a0059`.
Its GPT partition starts at LBA 2048; FAT contains `/kuberoot/rootfs.squashfs`.
R4 installed recovery/no-reboot wrappers; R5 repacked SquashFS with uncompressed
metadata/data/fragments/xattrs and added RV64_MEM; R6 added the observer/status
helper. See R4/R5/R6 plans, `rv64-kuberoot-probe.py`, `rv64-emulator-recovery.py`,
`rv64-no-reboot.py`, `rv64-memory-probe.py`, `rv64-diag-probe.py`, and
`rv64-uncompressed-media.py`. R15 reuses that last GPT/FAT packer.

The FAT and SquashFS were read locally without executing guest binaries. The
retained probe is checked in as `scripts/fixtures/rv64-r15/r6-probe.sh` (SHA below),
so tests exercise the actual R6 settle/warmup path, not a regenerated probe.

| File inside R6 | SHA-256 |
| --- | --- |
| `/usr/sbin/kinit.real` | `5454fa9450465047ae0b2b94c525f73e1132da56d5e57726b04dadd3fdd962a6` |
| `/usr/bin/kuberoot-control.real` | `a87019474b1fdfbc135b35b44074a4b386276f77da19fb0d3ba46ebdb661e41c` |
| `/usr/bin/kubectl` | `6de88e9ab2635eb02b4a311082af884fef27da136b79d28f4288b52abe5029c7` |
| `/usr/bin/kuberoot-node` | `0a788de2b4531c90c31a324bc4f84810541faf19fc650b4436c777516a1e2b42` |
| `/usr/share/kuberoot/rv64-probe.sh` | `34e7c2975ed4a8d1f222c03f561a8ccfc549bcbcb060530e4571c58b75cd79f6` |

`go version -m` reports Go 1.26.8 for control and kubectl. Control contains
`kuberootclock` and `KUBEROOT_TIMESCALE`; kubectl and kuberoot-node contain neither.
kinit contains `KUBEROOT_TIMESCALE`. These observations identify features; they
**do not establish the exact source commit of each binary**.

The read-only kuberoot checkout at `38c9694f5553a7239dc2e38c0099433dedc11471`
has since removed the old emulator/slim implementation. Inspect historical
`37b858d2f6f9d821acb6a34f7bec57bc0d7cc1d0` (timing introduced by `a229283`),
not only HEAD. R6's earlier source reference `4253fad` predates the timing overlay:

```sh
git -C ../kuberoot show 37b858d:cmd/kinit/cmdline.go
git -C ../kuberoot show 37b858d:cmd/kinit/timescale.go
git -C ../kuberoot show 37b858d:cmd/kinit/combined.go
git -C ../kuberoot show 37b858d:build/kubernetes-slim/timing.py
git -C ../kuberoot show 37b858d:build/kubernetes-slim/main.go.in
```

`smp-kuberoot.ts` supplies `kuberoot.profile=emulator`. Historical
`cmd/kinit/cmdline.go:parseCmdline` recognizes it; `bootConfig.timeScale()` in
`timescale.go` selects factor 60 (explicit timescale overrides it). kinit renders
`/usr/share/kuberoot/profile.yaml`, generates `/etc/kubernetes/kubelet.yaml` and
`components.json`, then combines kine/apiserver/controller-manager/scheduler/
kubelet into one supervised process. The recovery wrapper runs **after** generation,
just before the combined binary, so its kubelet changes survive generation.
The proxy is deliberately named `rv64-kube-proxy` and remains independently
supervised; restore neither its combined failure domain nor kinit shutdown.

### Who actually talks to 6443

* Combined runtime starts kine and apiserver, then polls `/readyz` before starting
  controller-manager, scheduler and kubelet. The historical client has a **60 s
  total** budget after scaling, polls again after 1 s, closes without draining the
  response body. HTTP/1 reuse is therefore not assured. Its transport does not
  have client-go's 10 s TLS setting. A blocked barrier means kubelet has not even
  attempted registration; a missing separate kubelet PID is normal in slim.
* kinit's shared admin readiness client uses a **300 s total** budget (5 × 60),
  gates add-ons and standalone services, and also closes without draining.
* In-process controllers, scheduler, kubelet and apiserver loopback clients use
  client-go. The historical **slim overlay scales TLS 10 → 600 s**, dial 30 →
  1800 s. It also scales apiserver ReadHeaderTimeout 32 → 1920 s, storage gRPC
  dial/keepalive and bootstrap RBAC/service repair hook deadlines. These are
  distinct from REST request deadlines and the readiness barrier.
* Separate kuberoot-node uses unpatched client-go (routes, state backups,
  alternative labels, aggregation/delegation). R14 explicitly shows its
  `alternatives.go:31` and `statebackup.go:452` TLS failures. Keep this service:
  it supplies pod networking as well as optional management features.
* Each standalone kubectl invocation creates a new process/transport. Probe node
  discovery/polls, readyz and settle/pod operations therefore repeatedly pay TLS
  cost. `--request-timeout` does **not** override the transport's 10 s TLS limit.
  Raising it helps requests that pass TLS, not handshakes that exceed 10 s.

In `R14-private-384-a-console.txt`, lines 1204–1208 and 1334–1337 show kubectl
and kuberoot-node TLS failures and observer failure at uptime 668. The 640 capture
shows the same class of failures. Bound port 6443 proves a listener, not a
completed handshake or ready API. No R14 evidence proves that *every* embedded
client has a 10 s timeout, nor that TLS is the only blocker. The supplied throughput
and RSS measurements constrain this experiment to guest tuning.

### Existing deadline/lease settings and order of failure

| Mechanism | R6 effective value from historical profile/recovery | R15 decision |
| --- | --- | --- |
| Observer readyz | request 5 s / outer 15 s | 600 / 660 s; one outstanding request |
| Unpatched client-go TLS | 10 s | unchanged binary; cheaper TLS hypothesis; optional patch below |
| Slim startup readiness | total 60 s | control environment factor 300 → total 300 s |
| kinit readiness | total 300 s | retained |
| Slim client-go TLS | 600 s | control environment factor 300 → 3000 s |
| API request / min watch | 3600 / 108000 s | retained; not a TLS fix |
| Storage init / etcd checks | 3600 / 120 s | retained; kine Unix socket, not remote etcd |
| Kine SQLite busy / compaction | 1800 s / recovery 5 min | retained; compaction previously killed shared runtime |
| Kubelet status update/report/sync | recovery 10 s / 5 min / 1 min | update 30 s; report/sync retained |
| Kubelet lease | 2400 s | retained; renewal cadence tied to lease, not status update |
| Node monitor grace/startup grace | 3000 / 3600 s | retained |
| Kubelet runtime request | 120 min | retained; not waiting for this as acceptance |
| Leader lease/renew/retry | 900 / 600 / 120 s | already disabled for single-node kine |

Thus short observer and standalone TLS budgets fail before node leases can
matter. Lease/grace inflation cannot start a kubelet stuck behind readiness.
Large grace also means a stale Ready condition can survive much of a 3000 s run:
require the subsequent real pod start, and inspect restart counts/lease times.

## Minimal candidate

1. Keep kinit factor 60, generated CLI deadlines, kubelet lease and monitor grace.
   Override **only the combined runtime** to `KUBEROOT_TIMESCALE=300`, raising
   its internal readiness barrier from 60 to 300 s without rebuilding Go. This
   existing broad switch also raises its client-go TLS to 3000 s, dial to 9000 s,
   ReadHeaderTimeout to 9600 s and the overlaid bootstrap/storage deadlines by
   another factor of five. It does not change generated CLI flags or kubelet
   config, does not accelerate CPU work, and may hide failures past R15-a.
   The optional readiness patch below offers a narrower future alternative. Set status
   update to 30 s to reduce periodic load without the original factor-60 600 s
   delay. Keep sync 1 min so the pod can start promptly.
2. In the kinit shell wrapper, before starting both probe and init, export
   `GODEBUG=...,tlsmlkem=0` and `GOMAXPROCS=2`. Go 1.26's
   `crypto/tls/defaults.go:defaultCurvePreferences` supports `tlsmlkem=0`, restoring
   pre-Go-1.24 classical key exchange. This is an emulator-only CPU-cost experiment,
   retaining TLS authentication/encryption but foregoing hybrid post-quantum key
   exchange. It is **not evidence that ML-KEM caused R14**. Inherited environment
   covers the server and fresh kubectl clients; no insecure-skip-TLS-verify change.
3. Explicit shared-runtime `GOGC=100`, `GOMAXPROCS=2`; retain existing 300 MiB
   Go soft memory limit. GOGC=100 was already selected by the emulator profile;
   do not increase it or heap limits against the measured browser memory ceiling.
4. Remove the observer's SIGQUIT implementation and failure-triggered restart.
   Snapshot/log tails and RV64_MEM sleep 120 guest seconds after work; collection
   overhead can extend that interval. Tail 10 instead of 40 lines per service.
   Run readyz asynchronously with a directory lock, so a 600 s request neither
   blocks process snapshots nor spawns another readyz each interval. Retained
   one-shot readyz delegates to this loop. A timed-out kubectl create now receives
   normal timeout termination, not QUIT; its subsequent existence check remains.
5. Probe request budgets 600 s; pod/settle waits 1200 s with request budget 1320 s.
   Failed node polls sleep 120 s instead of 10 s. Add
   `RV64_NODE_REGISTERED_READY` immediately after the successful node condition
   check, before the retained all-pods settle and warmup. Keep the old
   `RV64_NODE_READY`, recheck, offline imports and `rv64-busybox` acceptance.

Do not disable admission, authentication, watch cache, aggregation, or controllers
in this first candidate. Watch cache avoids repeated storage lists; removing
node/CIDR, service-account, CSR, deployment or endpoint controllers can break the
retained pod/add-on path. Optional controller removals require measured evidence,
not a guessed allowlist. Leave client QPS/burst unchanged: lowering it can prolong
bootstrap, and raising it amplifies contention. Keep long-lived internal clients;
CLI loops cannot reuse a connection across processes without a new helper binary.
No standalone etcd raft tuning applies to the retained kine datastore.

### If the same TLS or readiness barrier persists

`kuberoot-patches/0001-standalone-client-tls-timeout.patch` adds a fail-closed
source overlay script to kuberoot. It changes **only** client-go transport
TLSHandshakeTimeout to an environment-controlled duration (1 s–10 min, default
10 s). Apply to a disposable client-go source tree before compiling kubectl and
kuberoot-node, then opt those processes into
`KUBEROOT_TLS_HANDSHAKE_TIMEOUT=300s`. A request must still have a larger total
budget. No flag currently exposed by kubectl can substitute for this change.
The existing slim timing overlay already supplies 600 s in R6 (3000 s in R15); do not stack this
transport patch with it. For kubectl the tree is Kubernetes
`staging/src/k8s.io/client-go`; for node it must be the client-go source selected
by a `go.mod replace` in a disposable kuberoot checkout, **not the shared module
cache**. Rebuild the affected standalone binaries, not the entire distro.

`0002-slim-readyz-budget-and-reuse.patch` targets historical `37b858d`'s
`build/kubernetes-slim/main.go.in`: configurable
`KUBEROOT_READYZ_TIMEOUT=300s`, validated 1 s–10 min, with response-body draining
before Close to permit connection reuse. With this patch, return the control timescale to 60 and set the dedicated
readiness variable to 300s to avoid broadening unrelated overlay deadlines.
Without the variable, behavior retains the scaled budget. This needs a slim binary rebuild; it is not silently included in R15.
It applies to the old slim source, not current kuberoot HEAD, which removed it.

These are **proposed source patches**, checked for application and overlay
behavior, not cross-compiled or guest-tested replacements. The pinned R15 builder
rejects changed Go binaries. A patched-binary follow-up needs new reviewed pins,
a separate medium/version and rerun of acceptance. Do not label a config-only
R15 failure a success, or spend repeated 3000 s runs if standalone TLS still fails
at 10 s or the internal readyz barrier still expires (300 s in the candidate).

## Operator: fresh Debian bookworm pod, all writes under /work

Run from repository root. Assumption: existing PVC `rv64-work` in namespace
`tenant-kuberoot`; set PVC to your claim before applying. Use your authorized
context. The Python image is Debian bookworm with Python 3.11. Tools are downloaded
and extracted into the PVC, not installed into the container root filesystem.
No `apt install`, no `/root/r15`, no reuse/mutation of an old extracted root.
Budget about 3 GiB free plus tool downloads; the source is 601 MiB.

```bash
export KUBECONFIG="$HOME/workshop.txt"
export CTX=admin@workshop NS=tenant-kuberoot POD=rv64-r15 PVC=rv64-work
kubectl --context "$CTX" -n "$NS" apply -f - <<YAML
apiVersion: v1
kind: Pod
metadata:
  name: $POD
spec:
  restartPolicy: Never
  containers:
  - name: builder
    image: python:3.11-bookworm
    command: ["sh", "-ec", "mkdir -p /work/tmp; exec sleep infinity"]
    workingDir: /work
    env:
    - {name: HOME, value: /work}
    - {name: TMPDIR, value: /work/tmp}
    volumeMounts:
    - {name: work, mountPath: /work}
  volumes:
  - name: work
    persistentVolumeClaim: {claimName: $PVC}
YAML
kubectl --context "$CTX" -n "$NS" wait --for=condition=Ready "pod/$POD" --timeout=180s
kubectl --context "$CTX" -n "$NS" exec "$POD" -- sh -ec '
  test ! -e /work/r15
  mkdir -p /work/r15-input /work/r15-tools /work/toolchain/debs \
    /work/apt/lists/partial /work/apt/cache/archives/partial /work/apt/log
  cd /work/toolchain/debs
  apt-get -o Dir::State=/work/apt -o Dir::State::status=/var/lib/dpkg/status \
    -o Dir::Cache=/work/apt/cache -o Dir::Log=/work/apt/log \
    -o Dir::Etc::Parts=- -o Dir::Etc::main=- -o APT::Sandbox::User=root update
  apt-get -o Dir::State=/work/apt -o Dir::State::status=/var/lib/dpkg/status \
    -o Dir::Cache=/work/apt/cache -o Dir::Log=/work/apt/log \
    -o Dir::Etc::Parts=- -o Dir::Etc::main=- -o APT::Sandbox::User=root download mtools squashfs-tools liblzo2-2 liblz4-1 libzstd1 liblzma5 libgomp1 zlib1g
  for package in ./*.deb; do dpkg-deb -x "$package" /work/toolchain; done
  df -h /work
'
tar -cf - -C scripts rv64-r15-media.py rv64-uncompressed-media.py |
  kubectl --context "$CTX" -n "$NS" exec -i "$POD" -- tar -xf - -C /work/r15-tools
kubectl --context "$CTX" -n "$NS" exec -i "$POD" -- \
  sh -ec 'test ! -e /work/r15-input/r6.img; cat > /work/r15-input/r6.img' \
  < web/public/rv64/r6-uncompressed-no-reboot.img
kubectl --context "$CTX" -n "$NS" exec "$POD" -- sh -ec '
  export PATH=/work/toolchain/usr/bin:$PATH
  arch=$(dpkg-architecture -qDEB_HOST_MULTIARCH)
  export LD_LIBRARY_PATH=/work/toolchain/usr/lib/$arch:/work/toolchain/lib/$arch
  cd /work
  python3 /work/r15-tools/rv64-r15-media.py \
    --source /work/r15-input/r6.img --out /work/r15
' > /tmp/rv64-r15-build.log 2>&1
cat /tmp/rv64-r15-build.log
```

The builder validates the entire R6 hash **before extracting**, validates binary
and probe hashes, syntax-checks modified shell, preserves source image, refuses
an existing output directory, and emits image/SquashFS/manifest/build evidence.
Input, output and TMPDIR must be under `/work`. It requires `mtools` as well as
Python/squashfs-tools because the medium is GPT/FAT, not just SquashFS. Existing
packer keeps the partition UUID/label and backup GPT, and uses `-noI -noD -noF -noX`.
Check the printed `unsquashfs -s` flags, not merely the compressor name.

Fetch sequentially and verify before publishing the manifest (no fake hash):

```bash
kubectl --context "$CTX" -n "$NS" exec "$POD" -- \
  cat /work/r15/r15-uncompressed-no-reboot.json > /tmp/r15-manifest.json
kubectl --context "$CTX" -n "$NS" exec "$POD" -- \
  cat /work/r15/r15-uncompressed-no-reboot.img \
  > web/public/rv64/r15-uncompressed-no-reboot.img.download
python3 - <<'PY'
import hashlib, json
from pathlib import Path
meta = json.loads(Path('/tmp/r15-manifest.json').read_text())
p = Path('web/public/rv64/r15-uncompressed-no-reboot.img.download')
with p.open('rb') as f:
    assert p.stat().st_size == meta['bytes']
    assert hashlib.file_digest(f, 'sha256').hexdigest() == meta['version']
assert meta['url'] == '/rv64/r15-uncompressed-no-reboot.img'
p.replace(p.with_suffix(''))
Path('web/public/rv64/r15-uncompressed-no-reboot.json').write_text(json.dumps(meta) + '\n')
PY
mkdir -p web/public/rv64/results
kubectl --context "$CTX" -n "$NS" exec "$POD" -- \
  cat /work/r15/build-evidence.json > web/public/rv64/results/R15-build-evidence.json
cp /tmp/rv64-r15-build.log web/public/rv64/results/R15-build.log
```

An interrupted download is not published; rerun fetch to replace `.download`.
Retain the manifest and build evidence with each measurement. Do not commit the
large generated medium unless the repository's existing artifact policy calls
for it. The builder's output manifest has the R6 schema `{url, bytes, version}`;
`version` is the whole-image SHA-256.

## Browser runs (operator only)

Use one fresh tab/run at a time, awake host, no HMR edits, no snapshot restore.
The harness starts Vite and inherits the VITE flags. From `web/`:

```bash
mkdir -p public/rv64/results
RV64_RESULT_NAME=R15-a RV64_PROBE_SECONDS=700 RV64_TIMEOUT_MS=1000000 \
RV64_HARTS=2 RV64_MEMORY_MB=1024 VITE_RV64_SHARED_JIT=0 VITE_RV64_JIT_BUDGET_MB=384 \
RV64_MEDIA_MANIFEST=/rv64/r15-uncompressed-no-reboot.json \
node src/engine/rv64/measure.mjs --smp-kuberoot \
  > public/rv64/results/R15-a-run.log 2>&1

RV64_RESULT_NAME=R15-long RV64_PROBE_SECONDS=3000 RV64_TIMEOUT_MS=3300000 \
RV64_HARTS=2 RV64_MEMORY_MB=1024 VITE_RV64_SHARED_JIT=0 VITE_RV64_JIT_BUDGET_MB=384 \
RV64_MEDIA_MANIFEST=/rv64/r15-uncompressed-no-reboot.json \
node src/engine/rv64/measure.mjs --smp-kuberoot \
  > public/rv64/results/R15-long-run.log 2>&1
```

700 s gate: verify actual media version, private compiler, two harts/1024 MiB,
`RV64_R15_CONTROL timescale=300`, no SIGQUIT, RV64_MEM and spaced snapshots,
restart counts and port 6443. Capture readyz response bodies/failures and TLS
errors by executable. If nothing improves and the same deadlines persist, use
the patch decision above before another expensive run. A request may outlast the
700 s window: absence of its failure line is not success.

Acceptance in the 3000 s window: `RV64_NODE_STATUS=True`, then
`RV64_NODE_REGISTERED_READY`, retained settle/warmup success, `RV64_NODE_READY`,
`RV64_RECHECK_READY`, and **`RV64_POD_START_END` + `RV64_PROBE_DONE`** after the
`rv64-busybox` pod Ready wait. No `RV64_PROBE_FAILED`, OOM, or unexplained control
restart. A readyz response alone is insufficient. Preserve console, result JSON
(or partial JSON), run log, RSS observations and build manifest. Report guest
uptime and harness elapsed separately; multiple 1200 s waits are not a promise
that acceptance fits 3000 s. Lower throughput/pressure or further targeted binary
work may still be necessary.

## Local checks

Python tests cover the exact retained fixture, shell syntax, marker/acceptance
retention, timeout transformations, removal of the signal path, concurrent
readyz lock behavior, unknown-input rejection and `/work` path confinement.
The installer was also exercised against files read from the real R6 SquashFS;
all three pinned Go binaries remained byte-identical. No guest program executed.
Web typecheck and focused RV64 Vitest regressions are run despite no web changes.
Full Linux packaging and Node/pod acceptance remain operator checks.

Preparation results: 8 R15 Python tests plus 10 existing recovery/memory/observer
tests passed; `npm run typecheck` passed; four RV64 Vitest files passed (35 tests).
All operator shell blocks passed `bash -n`. Both proposed patches were exercised
for application/overlay behavior; the slim template passed Go syntax formatting.
These checks do not replace the operator's Linux image build or browser run.
