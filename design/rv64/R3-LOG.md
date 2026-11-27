# R3 work log — slim boot, deadlines, and SMP foundations

2026-11-21, `feat/rv64-r0`. No commits. **Historical baseline: one-hart Node Ready and BusyBox Ready achieved. See the CPU-per-Worker continuation at the end for new Linux 2/4-hart acceptance and remaining gaps.**
Rust compilation/tests run only in `tenant-kuberoot/rv64-dev`, context
`admin@workshop`. Chromium runs locally, one browser at a time.

## Slim input and reproduction

The kuberoot harness now uses 768 MiB and separate `slim-vmlinuz.efi`,
`slim-initrd.cpio`, and `slim-media.json` assets. It passes
`kuberoot.profile=emulator`; this argument alone does not demonstrate that an
older image implements the profile. Initial builder publication was
`0.1.0-slim.1`, `/work/out/slim/riscv64`:

| Artifact | SHA-256 |
| --- | --- |
| vmlinuz.efi | db43c7264ee97779f9271ebb6c57e90df675d7ab768462e01115d84d4f7cd598 |
| initrd.cpio | cc6c785760ae1451ea3683256298b0c2c16f994ba8e5b6d1d9f48163a60f9ffc |
| rootfs.squashfs | 95b14bc51d3b0381ac1befe621e85c4ed2f5536f2e0678fb44b70d97a3730ef5 |

All three transferred artifacts matched the builder manifest. A separate root
in `/work/guest/slim/root` wraps stage-two kinit with the existing console
probe and includes the previously pinned offline BusyBox archive. Its compressed
GPT/FAT probe medium is 269,484,032 bytes, SHA-256
`e3398c9cede9b59a5e135e69812d7e7964041b7d678a6950b691ff3519b42aa4`.
Published builder artifacts were not modified. No metrics-server addon was added;
embedded kine's `/metrics` listener is a different service.

Preparation reuses the existing scripts with these new environment parameters,
inside rv64-dev:

```sh
RV64_PROBE_ROOT=/work/guest/slim/root python3 rv64-kuberoot-probe.py
RV64_MEDIA_ROOT=/work/guest/slim RV64_MEDIA_COMPRESSED=1 \
  RV64_MEDIA_TEMPLATE=/work/guest/kuberoot/media.img python3 rv64-uncompressed-media.py
python3 /work/rv64-serve-media.py /work/guest/slim/probe.img 18081
```

The range server is loopback-only, reached with
`kubectl port-forward --context admin@workshop -n tenant-kuberoot pod/rv64-dev 18081:18081`.
The local manifest points to `http://127.0.0.1:18081/media` with the exact length
and digest above. `KUBECONFIG=$HOME/workshop.txt` is needed in this environment.
The browser harness command is:

```sh
cd web
RV64_RESULT_NAME=R3-slim-1h RV64_PROBE_SECONDS=900 RV64_TIMEOUT_MS=960000 \
  node src/engine/rv64/measure.mjs --kuberoot
```

The probe's Ready polling request timeout is now 120 s (previously 10 s), so the
measurement client itself does not impose the old short deadline. This does not
change kube-apiserver/client-go/kine deadlines or replace the Node Ready check.
The wasm build wrapper now uses `/work/tools/bin/wasm-bindgen` explicitly; the
recreated pod lost the old `/usr/local/bin` symlink but retained the PVC tool.

## Deadline evidence and clock audit

`R3-timeout-evidence.txt` extracts actual guest lines from the retained R2
1,800-s Chromium JSON, avoiding duplicate tail samples in its streamed log.
That full console has 244 TLS timeout lines, 22 kine gRPC keepalive ACK timeout
lines, 11 fatal post-start hook lines and five kinit restart lines.

| Deadline | Evidence / attribution |
| --- | --- |
| client-go TLS handshake | Explicit `net/http: TLS handshake timeout` against both `127.0.0.1:6443` and `[::1]:6443`; baseline transport timeout 10 s |
| kine gRPC keepalive | Explicit ACK timeout, Unix socket `/run/kine/kine.sock`, KV/Range; baseline keepalive interval 30 s, ACK timeout 10 s |
| PriorityClass / RBAC bootstrap | Fatal `scheduling/bootstrap-system-priority-classes` and `rbac/bootstrap-roles`; baseline poll timeout 30 s |
| Service IP/Port repair | Fatal `start-service-ip-repair-controllers`; must not be conflated with TLS timer itself |
| datastore health/readiness | Source defaults 2 s; exact failed health check requires guest `/readyz` evidence, not inferred from slow SQL alone |
| node lease | API-server lease failures are present; these are not proof of a kubelet node lease deadline firing |
| static-pod liveness | No matching liveness failure in the R2 console. kinit explicitly restarts the process after code 255; this is not evidence of kubelet killing a static pod |

Default values above were read from the builder's Kubernetes v1.37.2 source
under `/work/emulator/src/kubernetes-v1.37.2`. This source is being patched by
the separate profile job; it must not be treated as the final published profile.
The initial slim image also repeats TLS failures and, at guest 314.335410 s,
fails `start-service-ip-repair-controllers`; kinit restarts `kuberoot-control`.

The DTB advertises 10,000,000 Hz. Worker supplies `performance.now()*10000`
(ticks per millisecond); Cpu applies monotonic host deltas, and TIME CSR reads
`memory.time`. Sstc compares against that same time. It is independent of
retirement, JIT throughput, and busy/idle time. New telemetry records host
monotonic milliseconds, host ticks and actual guest ticks. Use
`scripts/rv64-clock-check.py RESULT.json`, or `--stream` for the text log.

Initial under-load check across 330.047895 s: guest/host rate 0.9999995455,
zero guest/host delta mismatch, zero backsteps, maximum sample lag 0.220 ms.
This does not support a clock-rate explanation for the observed timeouts.
Snapshot clock semantics are covered by the existing native platform tests.

## R3 implementation boundary

`web/src/engine/rv64/smp.ts` is a **separate substrate**, not a multi-hart Linux
engine. It imports one shared WebAssembly.Memory into atomic wasm instances.
W/D accesses use wasm atomic loads/stores; D add/swap use wasm atomic RMW.
A conservative global lock and 64-bit write epoch serialize all substrate
writes and prevent successful SC across another hart's same-value or ABA write.
Each hart interface owns and consumes its own LR reservation. W accesses preserve
neighbouring bytes and AMO signed/unsigned comparisons use the correct width.
Unrelated writes can cause permitted spurious SC failure. No throughput claim
is made for this conservative implementation.

The mailbox substrate provides per-hart IPI wakeups with Atomics.notify, separate
instruction/translation fence generations, and acknowledgment only after the
target's cache callback completes. Concurrent requests during a flush remain
pending. A future SBI caller must keep servicing incoming requests while waiting
for remote acknowledgments to avoid cross-fence deadlock. Translation fences
currently request a conservative full flush **on the selected target**, which
is a legal superset of a range/ASID flush. Local SFENCE.VMA must remain local;
remote shootdowns require explicit SBI RFENCE/IPI coordination.

The DTB writer has a tested `build_harts` API for 1/2/4-hart CPU nodes and unique
CLINT/PLIC interrupt contexts. The Engine intentionally still calls `build()`
for one hart: advertising extra CPUs before implementing HSM/interrupt routing
would be an incorrect claim of SMP support.

Still required before enabling multi-hart boot:

- Replace Cpu's owned Vec RAM with a sound shared backing and make all ordinary
  stores, page-table A/D updates, JIT stores, DMA and image writes obey the shared
  reservation/invalidation protocol. The present JIT bypasses that protocol.
- Build/import a shared Rust wasm memory with correct allocator and per-worker
  stack/TLS initialization; do not instantiate several independent Rust heaps
  into overlapping shared memory.
- Instantiate one real CPU per Worker, implement hart IDs, HSM start/stop,
  per-hart timer/PLIC state, and hook SBI IPI/RFENCE into the mailbox.
- Wire each hart's TLB, decoded cache, page generations and JIT cache to actual
  remote invalidations. Cache callbacks in the substrate tests are not proof of
  CPU shootdown correctness.
- Add a deterministic per-hart single-step schedule and trace differential,
  then pass Linux 2/4-hart boot and Kubernetes operation measurements.

## Checks and measurements

Native platform: 36/36 (including parsed 1/2/4-hart DTB interrupt topology).
Supported native riscv-tests: 173 pass, zero fail, one explicit unsupported
Sdtrig case (same established exclusion). R3 substrate tests cover same-value
and ABA invalidation, consumed failed SC, overlapping W/D stores, signed/unsigned
AMOs, bounds, real 2/4-worker contention, and fence acknowledgment races.
Browser correctness and final measurements are recorded below.

| Chromium guest harts | Ready | Pod start | kubectl get pods |
| --- | --- | --- | --- |
| 1, slim baseline | No Ready within 900 s | Unavailable | Unavailable |
| 1, emulator candidate | **743.071 s** observed | No completion within 1800-s run | **20.61 / 35.96 / 24.75 s** |
| 1, emulator diagnostic repeat | **748.630 s** observed | **102.14 s** CLI-to-Ready | **17.65 / 46.26 / 20.65 s** |
| 2 | Not run: real CPU SMP not integrated | Not measured | Not measured |
| 4 | Not run: real CPU SMP not integrated | Not measured | Not measured |

Builder QEMU's 44.8-s Ready at 768 MiB is external baseline evidence, not a
measurement of this engine. No QEMU number is substituted for Chromium results.


### Completed initial slim Chromium run

`R3-slim-1h-summary.json` and `R3-slim-1h-clock.json` are durable summaries;
full JSON/console live in ignored `web/public/rv64/results/R3-slim-1h*`.
Last sample 899.026685 s: **158.474 busy / 139.156 effective MIPS**, no Ready,
no pod-start or get-pods timings. 46 TLS timeout lines; kinit restarts control
at guest ~314 s (code 255, fatal service IP repair hook) and ~659 s (code 1,
NodeIPs transition; source attribution below). Later kubelet node-lease errors
say the node does not exist, rather than proving a lease renewal timer expired.
`/readyz` handler timeout and kine KV/Range DeadlineExceeded are observed.
There are no static-pod liveness failure lines. BusyBox import completes.

899 clock samples span 898.402350 s host / 898.403075 s guest: ratio
**1.000000807**, zero backsteps, exact equality of guest and host tick deltas.
Maximum sample lag is 58.135 ms (a scheduling/run-quantum delay, not clock
acceleration); end-to-end discrepancy is 0.725 ms. This is a measured under-load
clock check, not just matching source constants.

The sequential Chromium substrate gate passes, with the same SAB-backed wasm
memory shared among actual Workers: 2 Workers perform 20,000 AMO plus 20,000
LR/SC increments in 57.300 ms (3,207 SC retries); 4 Workers perform 40,000 of each
in 33.185 ms (7,567 retries). This tiny startup-sensitive experiment is **not**
a Linux SMP throughput or Kubernetes latency result. Evidence:
`web/public/rv64/results/R3-smp-substrate.json`.

### Emulator candidate preparation

The parallel build's candidate exists in `/work/emulator/out/riscv64` before
its baseline/emulator QEMU matrix completes. It is kept separate from the old
publication and the initial measurement. Candidate kernel hash is unchanged;
initrd SHA-256 `94b045bb7f4b3e0c0c12cd0dcb5f229c1733a430569ad0eba2d280dae0d716bf`,
rootfs `9c676d7b3f7ffcfa988b29f2bae72136f77b5af21ab5eac2b6d53ae8075f8328`,
control `a87019474b1fdfbc135b35b44074a4b386276f77da19fb0d3ba46ebdb661e41c`.
Candidate kinit contains `kuberoot.profile=emulator`; the guest must confirm
profile activation. This is an experimental candidate, not yet the completed
publication at `/work/out/slim/riscv64`. Only our extracted baseline root and
intermediate squashfs were removed to reclaim pod storage; baseline probe.img,
original input rootfs and all R2 artifacts remain intact.


Candidate probe medium: 269,484,032 bytes, SHA-256
`35a17d039f958642557ee898af6611145f84953a54cc5df01d2bdbe0f3911d86`.
A truncated API transfer was rejected by SHA-256 and repaired with checked
small tail writes before extraction/use. The media packer now rejects an
incomplete extracted root and refuses to overwrite an existing medium even if
its intermediate squashfs has been removed. No damaged image was booted.

The candidate guest explicitly logs **`timing profile: emulator=true timescale=60`**;
this confirms activation, rather than inferring it from the requested cmdline.
Containerd boots at guest 73.240525 s. The engine clock is not scaled.
This run uses the final pod wasm SHA-256
`d4e6bc8b3dfc654a2645e1957f6272784203fc648c43f0b24eb548b216c427c7`.

Final-build sequential Chromium regression gates pass: **439/439** ISA/signature
cases; **2,000,000** single-step boundaries (21.649 s); **20,000,005** attempted
instructions / 784,815 superblock boundaries (9.147 s), exact RAM and CPU state;
network/lazy-disk/two snapshot restore integration passes. The trace tests use
a deliberately small 1,024-slot code cache. These are **single-hart** gates,
not the still-missing per-hart SMP trace differential. Evidence:
`web/public/rv64/results/R3-{gates,single,trace,integration}.json`.


### Additional restart cause identified: kube-proxy NodeManager

The emulator candidate passes the baseline fatal-hook point and successfully
registers the node at **419.852325 s**, but exits code 1 immediately after:

```
[kuberoot-control] ... node.go:209] "NodeIPs changed for the node" ... newNodeIPs=["10.0.0.10"] oldNodeIPs=null
[kinit] kuberoot-control exited (code 1), restarting in 1s
```

The baseline's second exit has the same preceding NodeIPs transition. The
builder's `pkg/proxy/node.go` confirms the mechanism: `NewNodeManager` polls for
NodeIPs with a **30-second deadline**, tolerates missing IPs for compatibility,
then `OnNodeChange` detects nil -> actual IP and calls `exitFunc(1)`; the real
callback is `os.Exit`. In the slim all-in-one process this restarts the entire
control plane, not just kube-proxy. This is distinct from apiserver post-start
failure, kubelet lease renewal, OOM, or a static-pod liveness kill. The emulator
profile still needs to cover this startup window (or delay proxy until the
node is registered) if a restart-free first boot is required. No concurrent
kuberoot build source was modified by this task.


At guest uptime **742.27 s**, the emulator candidate emits `RV64_NODE_READY`.
All three `kubectl get pods -A` calls complete, measured using guest `/proc/uptime`:
**20.61 s, 35.96 s, 24.75 s** (includes cold CLI startup and discovery).
The subsequent `kubectl run rv64-busybox` starts at 837.38 s but has not yet
returned a create acknowledgment; no successful pod-start latency is claimed.
A diagnostic probe variant adds HTTP verbosity and a bounded SIGQUIT stack-dump
watchdog for this CLI only, preserving the Kubernetes timeout profile.

CoreDNS 1.14.7 and local-path-provisioner v0.0.37 are not included in this
BusyBox-only offline probe. Their registry lookups fail on the deliberately
isolated guest network and they enter ImagePullBackOff. Node Ready does **not**
establish addon/DNS/storage readiness. The old R2 archive versions do not match
these slim addon pins; blindly importing them would not resolve those pulls.


### First emulator observation: completed 1,800-second limit

Durable results: `R3-emulator-1h-summary.json`, `R3-emulator-1h-clock.json`.
Ready is observed at **743.071205 s browser wall time**, with one kube-proxy
NodeIPs-triggered restart. No fatal post-start hooks occur in this profile run;
eight external-client TLS timeout lines remain. `kubectl get pods -A` succeeds
three times: **20.61 / 35.96 / 24.75 s** (median 24.75 s). The create phase has
no completion marker by 1,800 s, so the overall probe correctly reports error,
while preserving the separately proven Ready and GET measurements.

Last sample 1,799.464475 s: **122.671 busy / 96.770 effective MIPS**. This includes
long post-Ready observation and is not a paired boot-throughput comparison with
the 900-s baseline. 1,799 clock samples span 1,798.838795 s host versus
1,798.838865 s guest: rate **1.000000039**, zero backsteps and zero guest/host tick
delta mismatch. Maximum sample lag 75.105 ms; end-to-end discrepancy 0.070 ms.

The follow-up diagnostic medium is kept separately at
`/work/guest/slim-emulator/probe-diagnostic.img`, SHA-256
`013c075db8c5fa2e9f938ffe0c35f266e03b810e130f0e190705aeecfd1ced03`.
Kernel/control/wasm are unchanged. It records `kubectl run --v=6` HTTP progress,
limits that probe command with a 180-s SIGQUIT watchdog / 120-s request timeout,
checks whether an unacknowledged create nevertheless committed, and gives the
pod Ready wait 300 s. Explicit probe failures now terminate the browser harness
with preserved metrics, rather than silently waiting for its outer time limit.
These are measurement-client bounds, not weaker Kubernetes health checks.


The diagnostic repeat is not a controlled speed A/B. At ~178.7 s its busy MIPS
is 236.60 versus 251.07 in the preceding candidate run, but disk-active time is
162.20 versus 108.34 s and idle wait 106.46 versus 48.71 s. Containerd consequently
boots at 141.78 instead of 73.24 s. Host vm_stat also reports only ~64 MiB free
and ~8 GiB wired at that sample (16-KiB pages); no unrelated process was stopped.
The trace-enabled repeat is for locating pod-create failure, not attributing
that elapsed-time difference to timeout changes.


### Kubelet deadlines verified in guest configuration dumps

| Kubelet field | Baseline | Active emulator candidate |
| --- | --- | --- |
| nodeLeaseDurationSeconds | 40 | 2400 |
| nodeStatusUpdateFrequency | 10 s | 10 min |
| nodeStatusReportFrequency | 5 min | 5 h |
| runtimeRequestTimeout | 2 min | 2 h |
| streamingConnectionIdleTimeout | 4 h | 4 h |

These values are read from the guest's emitted kubelet configuration, not
assumed from the profile name. Node lease errors observed during registration
are `node not found`; later lease DELETE deadline errors name the **apiserver**
lease. Candidate kine also logs a LeaseGrant RPC DeadlineExceeded at 815.681635 s.
None of these lines proves a kubelet lease renewal deadline caused the restart.
The candidate scales substantial scheduling/update intervals as well as bounds;
Ready observation is not a claim of normal production failure-detection timing.


### Successful diagnostic repeat: complete probe

`R3-emulator-diag-1h-summary.json` and `R3-emulator-diag-1h-clock.json` record
success (`probeDone=true`, no error). The single Chromium instance closed after
completion. Exact browser-observed Node Ready is **748.629580 s**, guest marker
747.84 s. The three sequential `kubectl get pods -A` calls take **17.65 / 46.26 /
20.65 s**, median **20.65 s**. CLI invocation through pod Ready takes **102.14 s**.
The API POST itself returns **201 Created in 4.133 s**, and kubelet reports
**88.6966801 s** creation-to-observed-running, with no image pull. These are
separate timing boundaries; the headline pod-start figure includes CLI work.
The first run's unbounded create hang was not reproduced: adding an explicit
request timeout and diagnostic watchdog produced a successful create without
firing the watchdog. This does not establish the cause of the earlier hang.
Read-only `/.kube` discovery-cache warnings are nonfatal in this successful run.

At the final 962.467940-s metric: **147.112 busy / 122.715 effective MIPS**.
962 clock samples span 961.837210 host seconds and 961.837240 guest seconds,
ratio **1.000000031294**, no backward steps, no guest/host tick delta mismatch;
maximum sampling lag 64.555 ms. Eight TLS timeout lines and one NodeIPs-triggered
control restart remain; there are no fatal post-start-hook lines. The isolated
network still prevents the two addon image pulls; this is Node/BusyBox readiness,
not a fully healthy addon set. Selected guest evidence is preserved in
`R3-success-evidence.txt`; full JSON and console are under ignored
`web/public/rv64/results/R3-emulator-diag-1h*`.

Final builder check still reports `/work/out/slim/riscv64/VERSION` as
`0.1.0-slim.1`; the measured profile image is the separately built candidate
identified above, not a newly published artifact. No builder source/job was
changed. R3 remains a tested shared-memory/atomic/mailbox and DTB foundation:
real 2/4-hart Linux execution, SBI/cache integration, per-hart trace-diff and
2/4-hart Kubernetes measurements remain outstanding.

Final local checks: TypeScript typecheck, 20 existing RV64 tests plus 9 SMP
substrate tests, Python script compilation and `git diff --check`. Rust and
browser regression results are recorded above and in `R3-validation-summary.json`.
No commits were created.


Cleanup: the diagnostic range server and its port-forward were stopped after
measurement. Images and local slim assets/manifest are retained. To replay the
successful medium, run this inside rv64-dev and restore the port-forward above:

```sh
python3 /work/rv64-serve-media.py /work/guest/slim-emulator/probe-diagnostic.img 18081
```

Then from `web`, with the retained candidate initrd and diagnostic manifest:

```sh
RV64_RESULT_NAME=R3-emulator-diag-1h RV64_PROBE_SECONDS=1800 RV64_TIMEOUT_MS=1860000 \
  node src/engine/rv64/measure.mjs --kuberoot
```

This overwrites the ignored raw result with the same name; choose a new result
name to preserve the completed run. The final combined RV64 Vitest run passed
**29/29 tests across 6 files**, and TypeScript typecheck passed.

## Ready snapshots continuation — 2026-11-21

Work continues on `feat/rv64-r0`, starting at `dda1f2f`, without commits.
Rust builds and tests remain confined to `tenant-kuberoot/rv64-dev` with context
`admin@workshop`; local Chromium runs are sequential, one browser instance.

### Snapshot implementation

`RV64Machine` accepts `snapshotURL` for a `dt.rv64.paged/v1` artifact, and
`exportSnapshot(uploadURL, certificateAudit)` exports a quiescent machine.
CPU registers, CSRs, reservations, virtio queues, interrupts, pending console
bytes, all four host rings, writable disk chunks, and clock state are retained.
Immutable HTTP disk cache is omitted; a separate dirty-chunk set preserves
writes. Restoring an older eager checkpoint conservatively marks its disk cache
as dirty so a subsequent export cannot discard an overlay.

RAM is transported in independent gzip members, each covering at most 256 KiB.
Within each member, only nonzero 4-KiB pages are stored; the page index reconstructs
zero pages without payload. Members have content-addressed `.bin` names and
SHA-256 checks. The extension is deliberate: Vite serves `.gz` with HTTP
`Content-Encoding: gzip`, which transparently changes the bytes before the
application can validate/decompress the artifact. Metadata is compressed in
bounded chunks, separately from RAM. The Rust sparse v1 decoder now streams
pages directly into RAM instead of retaining a second `Vec<Vec<page>>` copy.

The emulated memory access path faults absent RAM groups into a dedicated loader
Worker. The hart synchronously waits on a SharedArrayBuffer mailbox; the loader
uses exact HTTP Range responses, Cache Storage, checksum verification and gzip
decompression. This preserves the in-progress instruction/device operation;
it does not unwind or replay a partially completed virtqueue request. Fetch,
ordinary stores, partial stores, page-table A/D updates, image writes and DMA
all hydrate before accessing bytes. A JIT TLB entry receives its fast-path
permission bit only after hydration. The wasm RAM address space is still fully
allocated/zeroed: this is lazy **guest content hydration**, not host OS mmap or
reduced virtual address-space reservation. Fetch granularity is 256 KiB, not a
separate HTTP request for each 4-KiB page.

Compiled JIT code and translation/decoded caches are rebuilt after restore.
Host network services/remote TCP peers are external, as in the earlier snapshot
contract. A restored snapshot retains its original node identity and MAC; the
measurement uses a fresh isolated host network.

### Clock and certificate changes

Old kuberoot measurements ran with guest wall time in 1970. The separate
`probe-snapshot.img` fixture sets wall time from `rv64.epoch=` before kinit
creates certificates. It preserves the emulator timing profile and the existing
published/candidate images. A checkpoint records the host wall timestamp
corresponding to its saved host ticks. On restore, elapsed real suspension time
is added through the host-tick offset; the normal 10-MHz guest time rate remains
unchanged. Timestamp-free legacy in-memory snapshots keep the previous frozen
clock semantics.

The build harness audits public PEM certificates found in RAM using Node's
X509 parser, requires both API-server and admin certificates, and records the
intersection of the discovered kuberoot-issued validity windows. It publishes
the paged index after this audit; the loader rejects an out-of-window restore.
This is not certificate renewal. Certificate evidence and actual restored API
success are recorded with the measurements below.

### Development checks and initial failure

The first clock-corrected Chromium boot reached Node Ready at **626.534680 s**.
The old monolithic `snapshot()` then failed with `RuntimeError: unreachable`,
before producing an artifact. Allocation pressure is a likely cause, not a
proven diagnosis. No restore number is attributed to this failed attempt.
Evidence: ignored `results/R3-snapshot-capture.json`.

The replacement exports metadata and RAM groups directly from the stopped
Worker, without materializing one giant Rust/JS snapshot buffer. The small Linux
integration test passes this actual export API and then constructs a new
`RV64Machine` from the paged URL: **279.770 ms** to engine initialization,
followed by successful restored file, disk and HTTP-network checks. This is
**not** a kuberoot Ready measurement. A separate +60-s suspension test observes
guest uptime **69.40 s**, proving time advances across restore rather than
remaining frozen. Evidence: ignored `results/R3-paged-integration.json`.

Native checks: **39 platform tests + 1 sparse-format unit test**, and **173**
supported upstream ISA tests pass; the existing single Sdtrig exclusion remains.
New cases cover lazy fetch, partial stores, PTE A/D updates, pending virtqueue
DMA exactly once, dirty disk preservation, and byte-compatible sparse encoding.

### First paged artifact and startup-JIT regression

The first paged build reached Node Ready at **622.690170 s** and published all
members successfully. Its raw result is marked error because the harness called
`dispose()` before resolving its capture promise; the disposal event rejected
that promise. That cleanup ordering is fixed. The artifact was independently
checked against every member SHA-256 and retained at
`web/public/rv64/snapshots/kuberoot-first/`, with its original media manifest in
`slim-snapshot-first-media.json`. RAM: 2,984 groups, 185,490 nonzero 4-KiB pages,
**240,440,292 compressed bytes**; CPU/device metadata: **2,584,630 raw bytes**.
The certificate intersection is 2026-11-21 21:16:35 UTC through
2027-11-21 22:16:34 UTC. No expiry/not-yet-valid error occurred during restore.

Its first restore did not prove Ready: `kubectl get nodes` reported TLS handshake
timeout, and the old `set -e` probe stopped before GET-pods. At 148.574 s the
worker had executed **6,706,427,093 instructions entirely in the interpreter**:
JIT compiled=0, retired=0. Initial startup applied the JIT threshold before
`Cpu::restore`, whose deliberately empty JIT state reset that threshold to zero.
The worker must reapply the policy **after** restoring, just as the existing
in-place restore path already does. The final integration test adds a real
`jitRetired > 0` assertion; initialization time alone did not expose this bug.
This aborted run is not a snapshot performance acceptance result. Its streamed
console is `results/R3-paged-restore-console.txt`; the next fixture retries the
Ready query after transient TLS failures and explicitly marks failed GET-pods.

Sequential Chromium correctness gates with the final Rust binary
`27685993bf66eaad77b57e782985acc9616c5bf575e7dc9219840170c94f4f58`:

- 439/439 ISA/signature cases pass.
- Demand-paged JIT versus eager interpreter: **2,000,000 single-step boundaries**,
  27 execution-time RAM faults, exact CPU state and final RAM; **21.457070 s**.
- Demand-paged superblocks: **20,000,005 instructions / 784,815 boundaries**,
  60 execution-time RAM faults, exact CPU state and final RAM; **9.013420 s**.
- TypeScript typecheck and **34/34 Vitest tests across 8 files** pass, including
  corrupt-cache refresh and rejection of servers that ignore Range.

These are single-hart pager/JIT checks, not per-hart SMP trace-diffs. Durable
validation summary: `R3-snapshot-validation.json`.

### Final measured artifact, restore, and remaining gates

**Partial result, not R3 acceptance.** The second paged fixture successfully
boots, exports, and restores a Ready node. The startup-JIT regression is fixed
by applying the threshold after CPU restore. Final small-Linux integration
initializes in **258.785 ms**, restores file/disk/network, advances the clock,
and actually executes JIT code (3,653 compiled blocks, 2,997,000 reported JIT
instructions in its final sample). Typecheck and the final **35/35** RV64 Vitest
checks pass. Base-disk identity now uses immutable version plus geometry; legacy
identities containing a URL are accepted, allowing the build-time loopback
medium to be relocated to a course asset host without changing its contents.

Final build input is the separate
`/work/guest/slim-emulator/probe-snapshot-retry.img`, 269,484,032 bytes, SHA-256
`ced14b4008ab18d7b57806e43bd365ad94e022328e6fe1b0f5882e060b0dc758`.
Published builder images were not changed. The temporary intermediate SquashFS
was removed after packing; both snapshot probe media are retained.

Artifact: ignored `web/public/rv64/snapshots/kuberoot/paged.json` and its
content-addressed members. **238,185,484 bytes of compressed RAM**, 186,537
nonzero pages in 2,984 groups; metadata **3,088,310 raw / 3,067,269 compressed
bytes**, including host wrapper sections in the compressed figure. Every member
was independently checked against its length and SHA-256. Certificate windows
cover the actual restore, with earliest expiry **2027-11-21 22:34:24 UTC**;
public certificate evidence is in `R3-snapshot-certificates.json`.

| Boundary, one hart | Observed | Acceptance |
| --- | ---: | --- |
| Build-time cold boot → Node Ready | 746.589870 s | Build cost, not restore |
| Ready observation → export complete | 31.417245 s | Build cost |
| Restore request → engine initialized | **0.517400 s** | Not a Kubernetes health check |
| Restore request → fresh `kubectl get nodes` row reports Ready | **62.053750 s** | **Fails ≤5 s** |
| First `kubectl get pods -A` | **9.81 s** | **Fails ≤0.5 s** |
| Next two GET-pods calls | 9.30 / 12.72 s | Informational |
| Pod-create HTTP response | **201 Created, 444 ms** | Not pod readiness |
| BusyBox pod Ready | **Not reached within the 300-s wait** | **Fails ≤3 s** |

This is a fresh Chromium context with cold Cache Storage. Compressed RAM assets
are served locally by Vite; immutable base media comes through the pod range
server. At the final 425.866425-s sample there were **2,886** demand faults,
**6.298385 s** cumulative synchronous fault time, and **31.951050 s** base-disk
active time (overlapping execution, not additive latency). JIT retired
28,305,652,525 of 29,477,762,354 instructions executed since restore. The saved
absolute retirement counter is reported separately; it must not be divided by
post-restore runtime to claim inflated MIPS.

The Ready query succeeded without retry markers, and all three GET-pods calls
completed. There were no certificate-expiry/not-yet-valid errors. The overall
probe nevertheless correctly returns error because BusyBox did not become
Ready. Repeated expired-initial-bookmark warnings occur in client-go reflectors;
no precise scheduler/kubelet cause is claimed from these warnings alone. The
artifact is therefore **experimental**, not an accepted lesson environment.
Raw evidence: ignored `results/R3-paged-retry-{capture,restore}.json` and the
restore console. Durable numbers: `R3-snapshot-summary.json`.

Reproduction after starting the range server in rv64-dev:

```sh
# Inside the pod:
python3 /work/rv64-serve-media.py /work/guest/slim-emulator/probe-snapshot-retry.img 18082
# Local terminal:
KUBECONFIG=$HOME/workshop.txt kubectl port-forward --context admin@workshop \
  -n tenant-kuberoot pod/rv64-dev 18082:18082
cd web
RV64_RESULT_NAME=R3-paged-repeat \
RV64_SNAPSHOT_RESTORE=/rv64/snapshots/kuberoot/paged.json \
RV64_PROBE_SECONDS=1200 RV64_TIMEOUT_MS=1260000 \
node src/engine/rv64/measure.mjs --kuberoot
```

To build another artifact, use `RV64_SNAPSHOT_CAPTURE=1` instead of the restore
variable. That writes the default `public/rv64/snapshots/kuberoot` destination;
retain/rename an earlier artifact before rebuilding. The snapshot probe variant
is installed with `RV64_PROBE_SNAPSHOT=1` when preparing the extracted root.
The retained `slim-snapshot-media.json` supplies the measured medium identity.

The engine wrapper path for a lesson is now:

```ts
const machine = new RV64Machine({
  id: 'kuberoot', memoryMB: 768, kernel, initrd, httpDisk: media, network,
  snapshotURL: '/rv64/snapshots/kuberoot/paged.json',
});
await machine.ready; // Engine initialization; check Kubernetes readiness separately.
```

Outstanding work remains substantive:

- Reach actual Ready/API budgets, including cold JIT warmup, base-media I/O and
  post-clock-jump service recovery; sub-second engine initialization alone is
  not success. Resolve the post-restore BusyBox readiness failure before lesson
  adoption. A full-machine snapshot does not checkpoint external host peers.
- **SMP was not integrated in this continuation.** CPU-per-Worker shared RAM,
  SBI HSM/IPI/RFENCE, per-hart TLB/JIT shootdowns, Linux 2/4-hart boots, per-hart
  single-step trace-diffs and 2/4-hart kuberoot timings remain as listed earlier.
  No single-hart pager or existing atomic-substrate result is substituted for
  any of these gates.
- The guest still uses 768 MiB and the emulator timing profile; this does not
  establish the design's 512-MiB guest budget or normal production timing.

Final local checks include Python probe syntax and `git diff --check`. No commits
were created. The test browsers closed after their runs; measurement-only range
servers and port-forwards are cleaned up separately, preserving all artifacts.

## Restore clock / hot RAM / pod diagnostics continuation — 2026-11-21

Branch remains `feat/rv64-r0`; no commits. The first measurements below retain
CPU wasm `27685993bf66eaad77b57e782985acc9616c5bf575e7dc9219840170c94f4f58`
and the original `snapshots/kuberoot/paged.json`. No Rust source/build is needed
for the clock policy or loader changes. Chromium runs sequentially locally.

### What the original 62 seconds contain

The retained original restore has, at 61.625 s, 4,874,537,471 retired instructions,
4,645,455,553 JIT instructions, 56.481 s in the execution loop, 2.813 s idle wait,
0.757 s compiler yields and 2,831 RAM-group faults taking 5.782 s. Execution-loop
time **includes** synchronous pager waits; disk-active time (15.935 s) overlaps
execution and must not be added to those values. By 9.567 s it had faulted 2,563
groups (4.930 s), versus 2,722 groups (5.379 s) by 29.570 s. Thus RAM transport
alone does not account for the 62-second API boundary. There is substantial
cold JIT/guest CPU work and API/controller recovery. The original console starts
with an RCU stall and repeatedly reports expired initial-watch bookmarks.
It does not establish a Node lease expiry as the cause of that specific run.

A new elapsed-clock replay provides a more specific failure: kubelet emits
`Node became not ready`, reason `KubeletNotReady`, with
`container runtime is down, PLEG is not healthy: pleg was last seen active
42m38.773345s ago; threshold is 3m0s`. The node lifecycle controller subsequently
attempts a `node.kubernetes.io/not-ready:NoSchedule` taint. This is direct evidence
that suspension-time advancement expires runtime/PLEG health, not merely a stale
Node lease hypothesis. This replay has a much older snapshot than the original
62-second run; the two suspension durations must not be conflated.

### Implemented clock A/B and hot-set transport

`RV64Options.restoreClock` accepts `elapsed` (existing default) or `continuous`.
Continuous mode anchors host monotonic time to saved CPU ticks, excludes suspended
time, and retains the normal 10 MHz rate after resumption. Both initial and
in-place restore use the same helper. Certificate-window validation remains in
force. `RV64_RESTORE_CLOCK` selects the policy in the measurement harness.

Pager telemetry now records RAM group index, fault start and duration in each
metrics batch. `scripts/rv64-hot-snapshot.py MANIFEST TRAINING_RESULT OUTPUT_DIR
5` packages a training restore's first five seconds into a single immutable,
SHA-256-addressed Range object. Use this as a build-time training/publication
step before evaluating fresh contexts. The manifest's optional `hot` index is
validated, the complete packed response and each member are checked, and sparse
page hydration still occurs through the existing fault path. Missing hot entries
continue to use ordinary Range loads. This is not eager hydration of all RAM.

The retained trained artifact `snapshots/kuberoot-hot/paged.json` contains
1,226 groups / 95,706,557 compressed bytes, pack SHA-256
`fb5f424148521a2540ed769a419f8dff04a3749f8ff47c026abdc6e9d283b04b`.
Its training source is the continuous/local result below; it is not a separate
successful cold-build acceptance result. Source members are hard-linked into a
separate output directory; the original snapshot is unchanged.

### Measured A/B results so far (one hart, cold browser contexts)

The first remote-disk continuous attempt is **rejected**: port-forward lost its
connection and the engine reported `Failed to fetch`. Its streamed output also
showed page restarts during development. Measurement mode now disables Vite
watch/HMR. The following runs use a locally served, whole-file SHA-256-verified
copy of exactly the original 269,484,032-byte base medium
`ced14b4008ab18d7b57806e43bd365ad94e022328e6fe1b0f5882e060b0dc758`.
This removes port-forward availability from the guest disk path.

| Variant | Engine initialized | Fresh Node Ready row | GET-pods durations | Pod start |
| --- | ---: | ---: | --- | --- |
| Continuous, demand RAM | 0.711 s | 34.413 s | 13.15 / 8.43 / 50.89 s | No create: CLI discovery TLS handshake timeout; subsequent GET returns NotFound |
| Elapsed, demand RAM | 0.561 s | Not observed before probe failure | Not reached | Not reached; PLEG NotReady described above |
| Continuous, one hot Range | 0.682 s | 22.279 s | 10.11 s; next GET fails | Not reached |

These are observations, **not** acceptance of the <=5 s / <=0.5 s / <=3 s gates.
Continuous runs have zero RCU-stall messages but retain many expired-bookmark
warnings (96 and 86 respectively). The hot-set run fails on a later GET; the
non-prefetched continuous run fails before POST, distinct from the original
successful POST followed by a 300-second Ready timeout. These failures must not
be reported as image-pull failures of the BusyBox workload. Addon pulls from
registry-1.docker.io do fail DNS on the intentionally isolated network.

Durable summaries: `R3-{continuous-local,elapsed-local,continuous-hot}-1h-summary.json`.
Full JSON and guest console: ignored `web/public/rv64/results/` with those names.
The three runs use the same recorded engine source hash
`f2ed715aae638dba307790f09e47b66dc5528c45b920d3b3160dc0ab6b4f0ea1`.
Host pressure and background artifact transfers are not controlled; differences
between individual runs are not a statistically isolated prefetch speedup.

### Pod fixture and capture gate

`rv64-kuberoot-probe.py` now waits for successful image import before the capture
marker, imports digest names as well as tags, and dumps node/lease/pod/event and
containerd image/container/task state on pod-readiness failure. Optional
`RV64_PROBE_SETTLE=1` additionally requires addon pods Ready and a BusyBox
create/wait/delete cycle before emitting the snapshot capture marker. A failure
must preserve diagnostics and must not publish a lesson snapshot.

`rv64-slim-offline-images.py` verifies the riscv64 entries in the exact slim
addon indexes and preserves their platform manifest digests in OCI archives:

- CoreDNS 1.14.7: `5a03868dca97830fa491f036b883630dd2dc4993f909d283ac072c2399e476c0`.
- local-path-provisioner v0.0.37: `b92124d1376d790f5e2e23cf41fbd8ef7ac9bc7df59842fb96c2e335764c2b89`.

Only the extracted experimental root's addon references are narrowed to these
platform digests. The BusyBox helper uses the already imported 1.37.0 tag rather
than asking the offline runtime for an unavailable multi-platform index. Pause
remains provided by kinit's bundled archive. Published builder artifacts are
unchanged. The new root is under `/tmp/rv64-restore-diagnostic` inside rv64-dev:
the PVC had only 109 MiB free; no existing source/build/test trees were deleted.

The settled medium is 306,184,192 bytes, SHA-256
`0dfde8c8c4b2aafd729bc3cc536dd635c60d2b29dcbdd3f5535467f3e8768530`,
served locally using `slim-settled-media.json`. Its capture destination is separate
(`RV64_SNAPSHOT_NAME=kuberoot-settled`), preserving earlier snapshots.

The source audit also confirms the old emulator profile scales kubelet
`syncFrequency` from 1 minute to **1 hour**, alongside status/report periods.
That is a recovery-latency concern, not by itself proof of why an event-driven
new-pod start failed. No builder source was edited during this audit.

Real `trainer/web`, `trainer/client`, `trainer/hog`, `trainer/job` riscv64 images
or Dockerfiles are not present in the checked repository/mirror assets. Their
existing `kube-lite/images.ts` entries describe simulated behaviour. Their actual
image/source location was requested; addon and BusyBox preparation proceeds
independently. They are not falsely marked as preloaded.

The first-five-second physical group list and nonzero-page counts are retained
in `R3-hot-set.json`. Fault granularity is 256 KiB; this does not identify every
individual 4-KiB page actually accessed within a fetched group.

### Development-pod incident and recovery

The temporary extracted root, several diagnostic packing outputs and diagnostic
QEMU package installation exceeded rv64-dev's **2Gi ephemeral-storage limit**.
Kubernetes evicted the pod (`Failed/Evicted`, explicitly `Pod ephemeral local
storage usage exceeds the total limit of containers 2Gi`). Looking at free
space on the backing overlay was insufficient; this was a task-caused resource
planning error. The task-owned failed pod was replaced from its manifest,
raising ephemeral request/limit to 1Gi/8Gi. PVC was unchanged. The replacement
is Ready on ws2; `cargo --version`, Python, C compiler, saved wasm and
`/work/tools/bin/wasm-bindgen` were checked. No other pod was changed.

Before eviction a diagnostic, isolated-network QEMU run of the same settled
medium confirmed import of BusyBox, CoreDNS and local-path archives and reached
`RV64_SETTLE_BEGIN`. Its full temporary log was lost with the evicted root;
no QEMU Ready/performance result is claimed. The hypothesis that `--digests`
itself hung import was not confirmed. Chromium also subsequently emitted
`RV64_IMAGES_IMPORTED`; its local media, console and measurements were unaffected
by the development pod's loss. Extra unpublished packing variants from that
investigation were temporary only and are not used for any reported result.

The three clock audits (`R3-*-1h-clock.json` matching the new result names) show
zero backsteps and exact equality of injected-host and guest tick deltas.
Continuous runtime is not slowed: measured guest/wall ratios are 1.000030 and
1.000116. Elapsed replay is 1.001230 over 81 s; sampling endpoints differ by
~99.7 ms. The old audit's absolute sample-lag formula was invalid after restore
because it ignored the host tick offset. New telemetry exports `hostTickOffset`;
the audit now reports null absolute lag for legacy samples lacking it, rather
than a large negative "lag". Relative clock-rate evidence remains usable.

### Settled capture failure and recovery fixture

`R3-settled-capture-1h` timed out after 2,100 s without reaching the capture
marker; no usable settled snapshot was published. Its summary and selected
failure evidence are retained alongside this log. All three offline archives
were imported around 688 s, but this did not establish pod readiness. The guest
registered its node around 869 s, then kube-proxy's missing NodeIPs caused
`os.Exit(1)` in the combined control process, restarting the other components.
PodCIDR assignment and CNI initialization were delayed. Later kine exited the
whole combined process after `Transaction commit failed: sql: transaction has
already been committed or rolled back`. The failing compaction started about
five seconds earlier. The retained old kinit binary lacks the newer builder's
scaled `--compact-timeout` option; kine's default is five seconds.

`scripts/rv64-emulator-recovery.py` prepares an **experimental extracted root**:
sets `KINE_COMPACT_TIMEOUT=5m`, restores kubelet status/report/sync cadences to
10s/5m/1m, and gives kube-proxy an independent supervisor by changing its service
name (the combine predicate matches names). The original multicall executable
and symlink dispatch are preserved. This is a fixture workaround; the upstream
builder has not been changed. Optional console access is limited to these
isolated diagnostic fixtures.

A QEMU diagnostic of recovery-v2 reached kubelet Ready and generated its CNI
configuration, then identified an additional concrete offline-image problem:
containerd imported tags and generated `import-<date>@sha256:...` names, whereas
addons requested `repo@<platform-digest>` names absent from its image catalog.
Both CoreDNS and local-path attempted Docker Hub and failed DNS resolution.
The offline-image script now keeps archive verification against exact riscv64
manifest digests, but references the imported tags with `imagePullPolicy: Never`
in the experimental addons. Merely importing content blobs is insufficient.
QEMU is diagnostic evidence only, never a Chromium timing substitute.

Validation after the host changes: all 38 tests in nine RV64 Vitest files pass,
TypeScript typecheck passes, Python scripts parse, and `node --check measure.mjs`
passes. These include existing SMP **substrate** tests, not integrated multi-hart
CPU execution; there are still no valid 2/4-hart kuberoot measurements.

Recovery-v3 medium: 306,184,192 bytes, SHA-256
`f092ef9d857c4e1282826b36041350de0df3b7576a876701595bfe5e750da359`.
Its offline addon tags use Never, and the original binary hashes are unchanged.
`R3-recovery-capture-1h` was stopped diagnostically before Ready, preserving its
full result/console/samples through the harness error path; it is not a natural
2,700-second timeout. Direct console access through the existing harness's Node
inspector showed 264,708 KiB used zram swap, `swappiness=180`, memory PSI
`some avg10=73.14`, `full avg10=32.14`. Browser DNS was correctly 10.0.0.1.
The structured command output is `R3-recovery-768-memory.json`. No second local
Chromium instance was used. No snapshot was published from this failed capture.

QEMU's isolated user network supplied no DNS: its empty resolver made CoreDNS
exit with `plugin/forward: no valid upstream addresses found`. Setting a resolver
and recreating that diagnostic pod made CoreDNS 1/1 Running. This is specific to
that QEMU network and does not justify changing browser DNS. In QEMU 768 MiB,
reducing swappiness from 180 to 10 after pressure developed did not recover the
system; PSI worsened, so this tuning was **not** applied to the browser fixture.
A separate 1536-MiB QEMU diagnostic had zero memory PSI and reached Node Ready;
addon readiness still required inspection. It is not a browser performance result.

The browser harness now accepts `RV64_MEMORY_MB` (default remains 768; current
wasm limit remains 1024). The follow-up capture explicitly uses 1024 MiB and a
separate artifact name. Increasing memory does not establish the design's
512-MiB budget, nor does it replace the required multi-hart implementation.

### Addon probe cadence: confirmed additional readiness blocker

The retained kinit binary scales addon probes by 60: CoreDNS readiness
`periodSeconds=600`; local-path startup has initial delay/period **300 s**, and
readiness also has initial delay/period **300 s**. These values were read from
live Pod YAML. On the zero-PSI 1536-MiB QEMU diagnostic both containers were
Running but unready despite local-path logging `Health server started` and
`Provisioner started`. Restoring periods to 5/10 s and initial delays to their
normal values, while retaining timeoutSeconds=60, made both Deployments
successfully roll out. This separates probe latency from image pull and memory
pressure. The opt-in settled probe now applies those strategic patches and
waits for rollout before testing BusyBox.

For the already-running 1024-MiB Chromium capture, the same commands were
injected through the existing console. Its original probe (PID 51) was stopped
with SIGSTOP before Node Ready, while import continued; a separate script waits
for the Deployments, patches/waits for rollout, then resumes the original probe.
This is explicitly an instrumented capture, not an untouched cold-boot benchmark.
The immutable recovery-v3 medium remains the same; the resulting snapshot, if
successful, includes the corrected live Kubernetes objects. The updated build
probe reproduces the patches for future fixture builds.

The corrected QEMU diagnostic then created a **new** BusyBox pod with Never and
observed Ready in **7.92 s** (guest uptime 627.52 → 635.44). Kubelet reported
7.193 s creation-to-Running and zero image-pulling time. Evidence is retained in
`R3-qemu-pod-evidence.txt`; QEMU was stopped after saving the log. This establishes
that the offline image/runtime/CNI path can work, not a Chromium pod timing.
At the first direct 1024-MiB Chromium memory check, zram usage and both PSI totals
were zero (`R3-recovery-1024-memory.json`), whereas 768 MiB had substantial stalls.

### Completed browser fixture and final 1-hart comparison

The 1024-MiB capture passed addon readiness and BusyBox create/Ready/delete.
`R3-recovery-1024-capture-1h` reached its settled capture marker at **1307.740 s**;
export completed at **1359.089 s**. These are instrumented **cold capture** times,
not restore times. Warmup's console `created` → `condition met` interval was
75.135 s; it is not substituted for the separately bracketed restore pod test.

Artifact: `web/public/rv64/snapshots/kuberoot-recovery-1024/paged.json`, SHA-256
`43cfd378596de5df0127bbc4ed0b5dfcc77ca6ee03035ce2a085ce54a919b13d`.
All 4,010 content-addressed members were SHA-256 verified; combined member bytes
381,118,511. Kernel/initrd/CPU wasm are unchanged. The recovery-v3 media identity
is required. These large artifacts/results are retained locally under ignored
`web/public/rv64`; summaries/evidence are tracked alongside this log.

Fresh isolated Chromium contexts, **1 hart, 1024 MiB, JIT threshold 50**, same
CPU wasm and engine source hash
`17f7c4c30dc066b1d582c78424bb12a0de53c11c9c740d185d35e254eb150b67`:

| Restore policy / RAM loading | Engine ready | Restore → node Ready | First get pods | New BusyBox → Ready | Probe |
|---|---:|---:|---:|---:|---|
| Continuous / demand | 0.770 s | **41.927 s** | **12.96 s** | **68.73 s** | Done |
| Continuous / hot pack | 1.068 s | **43.577 s** | **11.91 s** | **98.83 s** | Done |
| Elapsed / same hot pack | 1.202 s | **85.194 s** | **10.79 s** | **82.90 s** | Done |

Each is one run, not a distribution. Host load and evolving restored guest
scheduling can affect results; do not infer a reliable pod-speed regression or
improvement from their difference. All new pods used preloaded BusyBox with Never,
and final lists showed BusyBox and both addons Ready. The old 768-MiB fixture's
22.279-s best restore is **not** comparable to this healthier, larger fixture.

Elapsed replay explicitly emitted KubeletNotReady: PLEG last active
**9m58.3405001s** ago versus a **3m** threshold, then recovered. The selected log
line is retained in `R3-recovery-elapsed-evidence.txt`. This is direct evidence for
timer expiry caused by suspended-time injection, not proof that the node
controller's lease expiry was the sole cause. Continuous excludes suspension
only; real-time guest runtime rate and host-side certificate validity checks
remain intact. Clock audits are saved for all three completed restores.

The new hot pack contains 1,556 groups, 96,427 nonzero 4-KiB pages,
128,594,917 compressed bytes; SHA-256
`0d55a82e88b208a7d16ded0346a10272d5651d4cc5ffbe3277ba6597d6cc23e2`.
The build-time training step uses the demand run's initial five seconds.
`R3-recovery-hot-set.json` records physical group addresses and fault timings.
At roughly 40 seconds, demand-fault wait was 9.589 s versus 7.266 s with the pack.
The one-Range prefetch reduced paging cost but **did not improve total Ready** in
this comparison. It remains optional, as does the continuous clock; neither is
silently made the product default.

Reproduce from `web/` (one invocation/browser at a time; use a fresh result name):

```sh
RV64_RESULT_NAME=recovery-continuous \
RV64_MEMORY_MB=1024 RV64_RESTORE_CLOCK=continuous \
RV64_SNAPSHOT_RESTORE=/rv64/snapshots/kuberoot-recovery-1024/paged.json \
RV64_MEDIA_MANIFEST=/rv64/slim-recovery-media.json \
RV64_PROBE_SECONDS=900 RV64_TIMEOUT_MS=930000 \
node src/engine/rv64/measure.mjs --kuberoot
```

For hot replay use `kuberoot-recovery-1024-hot/paged.json`; for the elapsed variant
also set `RV64_RESTORE_CLOCK=elapsed`. The original snapshot remains preserved.
A new source-built fixture should run the updated settled probe, which applies
probe-cadence patches itself rather than relying on the live console intervention.

### Remaining work and final validation

- Restore is faster with continuous time in the completed comparison, but is
  **not instant**: ~42 s Ready and ~12 s first CLI still remain, dominated by CPU/
  cold JIT/control-plane work beyond the measured ~7–10 s RAM fault waits.
- Pods now start in Chromium using the verified 1024-MiB fixture. This does not
  meet the 512-MiB design budget or prove the original 768-MiB fixture healthy.
- Real `trainer/*` lesson images still require their riscv64 image/source location;
  simulator-only definitions were not relabeled as real preloaded containers.
- **Integrated SMP is not implemented.** CPU-per-hart state/shared RAM, SBI
  HSM/IPI/RFENCE integration, per-hart TLB/JIT shootdowns and trace-diff remain.
  Existing 2/4-Worker atomic/mailbox substrate tests are not a multi-hart CPU.
  Therefore 2- and 4-hart restore/get-pods/pod-start results are **not measured**.
- No Rust source was changed or built in this continuation. Host TypeScript
  typecheck, 38 RV64 tests, Python parsing, generated guest-probe `sh -n`, harness
  syntax and `git diff --check` passed. No commits were made.

Diagnostic QEMU runs were stopped after log capture; task-created port-forwards
and fixture HTTP server were closed. rv64-dev remains 1/1 Ready with its PVC
preserved and the documented 8Gi ephemeral limit.


## Guest instruction profiler and warm-client experiment — 2026-11-21 (local)

**Partial delivery: guest profiling and a measured transport experiment are complete;
latency budgets and integrated SMP are not achieved. No commits.** Existing user
changes in `web/vite.config.ts` were preserved. Rust builds and the observer test
ran only in `tenant-kuberoot/rv64-dev`, context `admin@workshop`. All Chromium
runs were local/headless and sequential, one browser at a time.

### Sampling, attribution, and reproducibility

`Engine.profile_configure(N)` samples after every N **instruction attempts**,
including fault/interrupt boundaries; it does not infer CPU time from retirement.
The JIT's remaining instruction budget is capped at the next sample boundary.
Default N=0 keeps the original run path. Measurements use N=100003 (prime to
reduce periodic aliasing), not a sample only at each 4096-instruction host call.
Rows contain PC, full satp, privilege, tp, sscratch, guest ticks, attempted count,
and two little-endian words holding Linux task comm. Address fields are hex
strings, avoiding JavaScript's 53-bit integer limit. Hart is explicitly 0.
A bounded 65,536-row queue drains with each metrics second and reports drops;
there were **zero drops**. This is a flat instruction-frequency profile, not an
inclusive call-stack profile or a wall-time attribution of blocked operations.

The observer reads task comm at offset **1704**, verified in this kernel's
`__set_task_comm` machine code (`R3-task-comm-offset.txt`): the memcpy destination
is task+1704, followed by zero-fill to 16 bytes. It uses supervisor tp / user
sscratch and a separate read-only Sv39 walk. It never faults missing snapshot
pages in, writes A/D bits, changes the architectural TLB, or reads MMIO. Missing
pages, invalid pointers, and non-printable names stay unknown. The harness pins
this offset to kernel SHA-256
`db43c7264ee97779f9271ebb6c57e90df675d7ab768462e01115d84d4f7cd598`.
The native test checks the no-hydration/no-A-bit-update property. A task comm is
not a PID or an exec history; rows retain satp, including its ASID, to distinguish
CLI invocations. Kernel threads may borrow another process's address space.

The original riscv64 debug vmlinux was not found in rv64-dev or the inspected
builder directories (the available original vmlinux files were x86/arm64).
[vmlinux-to-elf](https://github.com/marin-m/vmlinux-to-elf) 1.4.0 recovered the
embedded kallsyms into an ELF symbol carrier using `--e-machine 243 --bit-size 64`.
This is **not original DWARF vmlinux**. Symbols identify Linux 6.18.62-kuberoot;
addresses of `__set_task_comm` and memcpy were checked against the exact EFI
machine code. The recovery tool's guessed ELF load base is not used to execute
the ELF or map guest RAM; its recovered symbol addresses are used directly.

`scripts/rv64-guest-symbols.py` extracts ELF symbols and stripped Go pclntab from
the actual retained fixture binaries. External Go linking leaves pcHeader's
textStart zero: the extractor validates and uses `.go.module` moduledata.text,
rather than silently assigning incorrect low addresses. A synthetic external-link
fixture tests this case. Exact executable digests, comm mappings and kernel
provenance are in `R3-profile-symbol-manifest.json`. Mappings cover kubectl,
control, node, containerd, containerd-shim, kinit and the independent kube-proxy
multicall alias. CoreDNS/provisioner/BusyBox user-code symbols remain incomplete;
unknown samples are preserved rather than attributed to the nearest other binary.

The final profile is `R3-guest-profile-v2-1h.json` in this design directory;
full rows/events/console are in ignored
`web/public/rv64/results/R3-guest-profile-v2-1h.json`. Symbol tables and recovered
ELF are retained in ignored `web/public/rv64/profile-symbols/`. Report generation:

```sh
python3 scripts/rv64-guest-profile.py   web/public/rv64/results/R3-guest-profile-v2-1h.json   --symbols web/public/rv64/profile-symbols/all.json.gz   --maps web/public/rv64/profile-symbols/maps.json
```

Final observer wasm SHA-256:
`9966e4022438bca76c087484077091da17f4a341e17aa5d4972602d9b6e8858c`.
CPU serialization and snapshot format are unchanged: observer state is on Engine,
not Cpu. Separate diagnostic indexes `kuberoot-recovery-1024-profile` and
`kuberoot-recovery-1024-profile-v2` pin their respective observer builds; immutable
RAM members are hard-linked and the source manifest hash/rebinding reason is
recorded in `profile-provenance.json`. The original snapshot index is unchanged;
no runtime manifest validation was bypassed and no lesson snapshot was republished.
The first instrumented build is preserved under `profile-build-v1`.

For the final profiling run, from web/:

```sh
RV64_RESULT_NAME=R3-guest-profile-v2-1h RV64_GUEST_PROFILE_INTERVAL=100003 RV64_MEMORY_MB=1024 RV64_RESTORE_CLOCK=continuous RV64_SNAPSHOT_RESTORE=/rv64/snapshots/kuberoot-recovery-1024-profile-v2/paged.json RV64_MEDIA_MANIFEST=/rv64/slim-recovery-media.json RV64_PROBE_SECONDS=600 RV64_TIMEOUT_MS=630000 node src/engine/rv64/measure.mjs --kuberoot
```

The report aligns guest ticks through each batch's host monotonic anchor to the
harness request origin. It brackets the first GET and pod operation by console
markers; serial delivery has finite latency, and sampled time is last injected
host time, so boundaries are not instruction-exact wall timestamps. The harness
waits an extra metrics interval at completion to retain the last partial second.
The earlier v1 exploratory result lacks the precise request-origin field and is
explicitly marked approximate; do not substitute it for the v2 tables below.

### Measurements and findings

All runs below are 1 hart, 1024 MiB, continuous clock, same recovery-v3 base disk.
They are single observations under evolving host/guest load, not paired estimates
of profiler overhead or proof of a product speedup.

| Variant | Restore → Node Ready | First GET pods | Pod → Ready |
|---|---:|---:|---:|
| Earlier accepted baseline (previous section) | 41.927 s | 12.96 s | 68.73 s |
| PC/satp-only exploratory profile v1 | 51.723 s | 9.05 s | 97.80 s |
| Profile v2 with task comm | 68.322 s | 9.76 s | 83.64 s |
| Same final wasm, sampling disabled | 47.238 s | 17.98 s | 99.92 s |
| 2 harts | **Not implemented/measured** | — | — |
| 4 harts | **Not implemented/measured** | — | — |
| Requested budget | ≤5 s | ≤0.5 s | ≤3 s |

V2 GET repetitions: **9.76 / 9.13 / 20.05 s**. Unprofiled repetitions:
**17.98 / 10.74 / 9.14 s**. Summaries retain exact boundaries; table durations use
guest uptime, while profile windows use console-event wall time. V2 runtime
clock ratio is **1.00003445**, zero backsteps and zero injected/guest tick-delta
mismatch (`R3-guest-profile-v2-1h-clock.json`). Around the first 40 seconds,
snapshot-fault wait was **10.477 s**; disk-fetch wait was **0**. The busy timer
includes synchronous RAM-fault waits and must not be added to them again.

- First GET: kubectl accounts for **3095/8779 = 35.3%** of all samples; control
  accounts for **3256/8779 = 37.1%**. In kubectl, regexp.tryBacktrack plus flate
  deflate/findMatch are **704/3095 = 22.7%** of CLI instruction samples. CLI-side
  CPU work is confirmed, but this flat profile alone cannot separate package
  initialization, discovery/cache serialization, and response processing.
- Control's runtime.pcvalue/step/tracebackPCs/textAddr/findfunc are prominent.
  These prove stack/PC metadata work, **not that all of it is GC**. GC scanning
  functions also appear explicitly. P-256 arithmetic and crypto bigmod occur
  in control/node/CLI; avoid claiming every such sample is certificate verify
  rather than ECDHE or another cryptographic operation.
- The run has **187 expired-bookmark warnings**. This supports an unhealthy
  watch workload but does not by itself prove a watch-cache re-list bottleneck.
- zram work is directly observed: `kswapd0` executes
  `LZ4_compress_fast_extState` (611 pod-window samples, **0.90%** of that entire
  window, before other reclaim/compression functions). It is not reasonable to
  claim that zram alone explains the ~84-second pod start.
- A physical-host fsync wait is ruled out for this backend: virtio block operation
  4 is an immediate completion on the RAM overlay (`core/src/devices.rs`), and
  disk-fetch wait is zero. SQLite/query/filesystem/journal CPU cost is not ruled
  out. Switching kine to tmpfs cannot remove a physical durability wait that
  this emulator already does not perform.
- Kernel ZSTD decompression and memcpy occur, but do not identify image snapshot
  unpack on their own. The tested BusyBox was preloaded with Never; the profile
  must not relabel all filesystem decompression as a registry pull/unpack.

### Measured optional persistent transport

`scripts/rv64-warm-client-probe.sh` starts a real `kubectl proxy` bound only to
127.0.0.1:18001, waits for its upstream readyz, then interleaves ordinary real
kubectl GETs and real kubectl GETs with `--server=http://127.0.0.1:18001`. The
proxy holds the upstream client/connection. No fake output, CLI replacement,
kubeconfig mutation, certificate change or TLS verification disablement is used.
The shell runs in a subshell and its EXIT trap kills its own proxy. Probe exit=0.
This is an explicit transport diagnostic, **not a claim of transparent equivalence
for every kubectl context/auth/TLS/upgrade option**, and is not enabled by default.

| Order | Transport | GET pods |
|---|---|---:|
| 1 | Direct | 14.21 s |
| 2 | Persistent upstream client via loopback proxy | 9.04 s |
| 3 | Direct | 17.89 s |
| 4 | Persistent upstream client via loopback proxy | 7.77 s |

Both pairs improved, but neither meets 0.5 s and four non-randomized observations
are not a distribution. Each command still starts the large CLI, and the helper
also consumes RAM/CPU. Startup cost of the helper is excluded from this warm
transport comparison; it must be included or amortized by a future snapshot.
No restore or pod-start speedup is claimed for this diagnostic. Durable evidence:
`R3-warm-client-comparison.json`, `R3-warm-client-1h-summary.json`; full result and
command output are in ignored `web/public/rv64/results/R3-warm-client-1h.json`.

Reproduce the unprofiled restore plus post-probe comparison with the same command
above, omit RV64_GUEST_PROFILE_INTERVAL and set
`RV64_POST_DIAG_FILE=../scripts/rv64-warm-client-probe.sh` and a fresh result name.
Post-probe work is excluded from the main restore/pod total time.

### Profile tables

Shares below are percentages of **all instruction samples in the window**, not
percentages of elapsed seconds or of only the named process. Process labels show
comm (normalized to the matching executable) and the last five satp hex digits;
full satp/ASID keys are preserved in the JSON. All top-50 rows resolved. Unknowns
outside those rows remain in the denominator.

#### restore-first-40s

15,977 samples; 689 unresolved (4.31%); zero queue drops.

| Rank | Process / satp suffix | Function | Samples | Share |
|---:|---|---|---:|---:|
| 1 | kuberoot-control / 836a7 | `runtime.pcvalue` | 403 | 2.522% |
| 2 | kuberoot-control / 836a7 | `runtime.step` | 321 | 2.009% |
| 3 | kuberoot-control / 836a7 | `memcpy` | 287 | 1.796% |
| 4 | kubectl / 8f7f5 | `regexp.(*Regexp).tryBacktrack` | 253 | 1.584% |
| 5 | kuberoot-control / 836a7 | `crypto/internal/fips140/nistec/fiat.p256Mul` | 235 | 1.471% |
| 6 | kubectl / 8f7f5 | `memcpy` | 224 | 1.402% |
| 7 | kubectl / 8f7f5 | `compress/flate.(*compressor).deflate` | 221 | 1.383% |
| 8 | kubectl / 8f7f5 | `compress/flate.(*compressor).findMatch` | 217 | 1.358% |
| 9 | kuberoot-control / 836a7 | `runtime.selectgo` | 143 | 0.895% |
| 10 | kuberoot-node / 8365c | `memcpy` | 140 | 0.876% |
| 11 | kuberoot-control / 836a7 | `runtime.tracebackPCs` | 124 | 0.776% |
| 12 | kuberoot-control / 836a7 | `runtime.(*moduledata).textAddr` | 121 | 0.757% |
| 13 | kuberoot-control / 836a7 | `runtime.unlock2` | 112 | 0.701% |
| 14 | kuberoot-control / 836a7 | `psi_group_change` | 91 | 0.570% |
| 15 | kuberoot-control / 836a7 | `update_load_avg` | 91 | 0.570% |
| 16 | kuberoot-control / 836a7 | `ZSTD_decompressSequences_default.constprop.0` | 88 | 0.551% |
| 17 | kuberoot-control / 836a7 | `__update_load_avg_se` | 84 | 0.526% |
| 18 | kuberoot-node / 8365c | `crypto/internal/fips140/nistec/fiat.p256Mul` | 83 | 0.519% |
| 19 | kuberoot-control / 836a7 | `runtime.(*unwinder).resolveInternal` | 82 | 0.513% |
| 20 | kuberoot-control / 836a7 | `internal/runtime/atomic.Xchg8` | 80 | 0.501% |
| 21 | kubectl / 8f7f5 | `runtime.tryDeferToSpanScan` | 74 | 0.463% |
| 22 | containerd / 83676 | `psi_group_change` | 71 | 0.444% |
| 23 | kubectl / 8f7f5 | `runtime.scanObject` | 71 | 0.444% |
| 24 | kuberoot-control / 836a7 | `__update_load_avg_cfs_rq` | 70 | 0.438% |
| 25 | kubectl / 8f7f5 | `runtime.scanObjectsSmall` | 70 | 0.438% |
| 26 | kuberoot-control / 836a7 | `runtime.findfunc` | 70 | 0.438% |
| 27 | kubectl / 8f7f5 | `runtime.mallocgcSmallScanNoHeader` | 64 | 0.401% |
| 28 | kuberoot-control / 836a7 | `runtime.mallocgcSmallScanNoHeader` | 63 | 0.394% |
| 29 | containerd / 83676 | `__update_load_avg_se` | 62 | 0.388% |
| 30 | kuberoot-control / 836a7 | `crypto/internal/fips140/nistec/fiat.p256Add` | 61 | 0.382% |
| 31 | kubectl / 8f7f5 | `regexp.(*inputString).step` | 55 | 0.344% |
| 32 | kuberoot-control / 836a7 | `crypto/internal/fips140/nistec/fiat.p256Selectznz` | 55 | 0.344% |
| 33 | coredns / 82a13 | `psi_group_change` | 54 | 0.338% |
| 34 | kuberoot-control / 836a7 | `crypto/internal/fips140/nistec/fiat.p256Square` | 54 | 0.338% |
| 35 | kuberoot-control / 836a7 | `runtime.memmove` | 53 | 0.332% |
| 36 | containerd / 83676 | `__schedule` | 52 | 0.325% |
| 37 | kubectl / 8f7f5 | `runtime.memmove` | 52 | 0.325% |
| 38 | kubectl / 8f7f5 | `hash/crc32.slicingUpdate` | 52 | 0.325% |
| 39 | kuberoot-control / 836a7 | `runtime.(*unwinder).next` | 51 | 0.319% |
| 40 | kubectl / 8f7f5 | `ZSTD_decompressSequences_default.constprop.0` | 50 | 0.313% |
| 41 | kuberoot-control / 836a7 | `runtime.lock2` | 48 | 0.300% |
| 42 | kuberoot-control / 836a7 | `crypto/internal/fips140/bigmod.(*Nat).montgomeryMul` | 45 | 0.282% |
| 43 | containerd-shim / 80d79 | `psi_group_change` | 43 | 0.269% |
| 44 | containerd / 83676 | `update_load_avg` | 43 | 0.269% |
| 45 | kuberoot-control / 836a7 | `update_curr` | 42 | 0.263% |
| 46 | containerd-shim / 80d79 | `runtime.scanObjectsSmall` | 42 | 0.263% |
| 47 | containerd-shim / 80ca4 | `psi_group_change` | 41 | 0.257% |
| 48 | containerd-shim / 80ca4 | `runtime.scanObjectsSmall` | 41 | 0.257% |
| 49 | kuberoot-control / 836a7 | `regexp.(*Regexp).tryBacktrack` | 41 | 0.257% |
| 50 | kuberoot-node / 8365c | `ZSTD_decompressSequences_default.constprop.0` | 40 | 0.250% |

#### first-get-pods

8,779 samples; 174 unresolved (1.98%); zero queue drops.

| Rank | Process / satp suffix | Function | Samples | Share |
|---:|---|---|---:|---:|
| 1 | kubectl / 82be5 | `regexp.(*Regexp).tryBacktrack` | 267 | 3.041% |
| 2 | kuberoot-control / 836a7 | `runtime.pcvalue` | 242 | 2.757% |
| 3 | kubectl / 82be5 | `compress/flate.(*compressor).deflate` | 229 | 2.608% |
| 4 | kuberoot-control / 836a7 | `runtime.step` | 225 | 2.563% |
| 5 | kubectl / 82be5 | `compress/flate.(*compressor).findMatch` | 208 | 2.369% |
| 6 | kuberoot-control / 836a7 | `crypto/internal/fips140/nistec/fiat.p256Mul` | 156 | 1.777% |
| 7 | kubectl / 82be5 | `runtime.scanObjectsSmall` | 108 | 1.230% |
| 8 | kubectl / 82be5 | `runtime.tryDeferToSpanScan` | 107 | 1.219% |
| 9 | kuberoot-control / 836a7 | `runtime.selectgo` | 101 | 1.150% |
| 10 | kuberoot-control / 836a7 | `runtime.tracebackPCs` | 90 | 1.025% |
| 11 | kubectl / 82be5 | `runtime.scanObject` | 87 | 0.991% |
| 12 | kuberoot-node / 8365c | `crypto/internal/fips140/nistec/fiat.p256Mul` | 87 | 0.991% |
| 13 | kuberoot-control / 836a7 | `vendor/golang.org/x/crypto/chacha20.(*Cipher).xorKeyStreamBlocksGeneric` | 83 | 0.945% |
| 14 | kubectl / 82be5 | `runtime.memmove` | 72 | 0.820% |
| 15 | kubectl / 82be5 | `runtime.findObject` | 64 | 0.729% |
| 16 | kubectl / 82be5 | `runtime.mallocgcSmallScanNoHeader` | 58 | 0.661% |
| 17 | kuberoot-control / 836a7 | `runtime.unlock2` | 57 | 0.649% |
| 18 | kubectl / 82be5 | `runtime.memhashFallback` | 56 | 0.638% |
| 19 | kuberoot-control / 836a7 | `runtime.(*moduledata).textAddr` | 54 | 0.615% |
| 20 | kuberoot-control / 836a7 | `crypto/internal/fips140/nistec/fiat.p256Add` | 54 | 0.615% |
| 21 | kuberoot-control / 836a7 | `runtime.findfunc` | 52 | 0.592% |
| 22 | kuberoot-control / 836a7 | `runtime.(*unwinder).resolveInternal` | 48 | 0.547% |
| 23 | kubectl / 82be5 | `hash/crc32.slicingUpdate` | 45 | 0.513% |
| 24 | kubectl / 82be5 | `regexp.(*inputString).step` | 44 | 0.501% |
| 25 | kuberoot-control / 836a7 | `crypto/internal/fips140/nistec/fiat.p256Square` | 42 | 0.478% |
| 26 | kuberoot-control / 836a7 | `crypto/internal/fips140/bigmod.(*Nat).montgomeryMul` | 41 | 0.467% |
| 27 | kuberoot-control / 836a7 | `encoding/json.unquoteBytes` | 40 | 0.456% |
| 28 | kuberoot-control / 836a7 | `internal/runtime/atomic.Xchg8` | 39 | 0.444% |
| 29 | kuberoot-control / 836a7 | `runtime.lock2` | 39 | 0.444% |
| 30 | kuberoot-control / 836a7 | `runtime.memmove` | 39 | 0.444% |
| 31 | kubectl / 82be5 | `crypto/internal/fips140/sha256.block` | 39 | 0.444% |
| 32 | kuberoot-control / 836a7 | `crypto/internal/fips140/nistec/fiat.p256Selectznz` | 38 | 0.433% |
| 33 | kuberoot-control / 836a7 | `runtime.mallocgcSmallScanNoHeader` | 37 | 0.421% |
| 34 | kubectl / 82be5 | `crypto/internal/fips140/nistec/fiat.p256Mul` | 37 | 0.421% |
| 35 | kubectl / 82be5 | `runtime.nextFreeFast` | 34 | 0.387% |
| 36 | kuberoot-control / 836a7 | `__update_load_avg_se` | 33 | 0.376% |
| 37 | kuberoot-control / 836a7 | `encoding/json.checkValid` | 33 | 0.376% |
| 38 | kubectl / 82be5 | `github.com/chai2010/gettext-go/po.decodePoString` | 33 | 0.376% |
| 39 | kubectl / 82be5 | `compress/flate.(*huffmanBitWriter).writeTokens` | 31 | 0.353% |
| 40 | kubectl / 82be5 | `runtime.(*mspan).writeHeapBitsSmall` | 30 | 0.342% |
| 41 | kubectl / 82be5 | `runtime.scanblock` | 30 | 0.342% |
| 42 | kubectl / 82be5 | `internal/bytealg.Count` | 29 | 0.330% |
| 43 | kuberoot-control / 836a7 | `runtime.(*unwinder).next` | 28 | 0.319% |
| 44 | kubectl / 82be5 | `runtime.typePointers.next` | 28 | 0.319% |
| 45 | kuberoot-control / 836a7 | `psi_group_change` | 27 | 0.308% |
| 46 | kubectl / 82be5 | `compress/flate.(*huffmanBitWriter).writeCode` | 26 | 0.296% |
| 47 | kuberoot-node / 8365c | `crypto/internal/fips140/nistec/fiat.p256Add` | 25 | 0.285% |
| 48 | kuberoot-control / 836a7 | `runtime.memhashFallback` | 24 | 0.273% |
| 49 | kuberoot-control / 836a7 | `runtime.memclrNoHeapPointers` | 24 | 0.273% |
| 50 | kuberoot-control / 836a7 | `runtime.mallocgc` | 24 | 0.273% |

#### pod-start

67,898 samples; 2,976 unresolved (4.38%); zero queue drops.

| Rank | Process / satp suffix | Function | Samples | Share |
|---:|---|---|---:|---:|
| 1 | kuberoot-control / 836a7 | `runtime.pcvalue` | 2187 | 3.221% |
| 2 | kuberoot-control / 836a7 | `runtime.step` | 1710 | 2.518% |
| 3 | kuberoot-control / 836a7 | `crypto/internal/fips140/nistec/fiat.p256Mul` | 1088 | 1.602% |
| 4 | kuberoot-control / 836a7 | `runtime.selectgo` | 906 | 1.334% |
| 5 | kuberoot-control / 836a7 | `runtime.tracebackPCs` | 627 | 0.923% |
| 6 | kuberoot-control / 836a7 | `runtime.(*moduledata).textAddr` | 617 | 0.909% |
| 7 | kswapd0 / 836a7 | `LZ4_compress_fast_extState` | 611 | 0.900% |
| 8 | kuberoot-control / 836a7 | `runtime.unlock2` | 484 | 0.713% |
| 9 | kuberoot-control / 836a7 | `runtime.mallocgcSmallScanNoHeader` | 479 | 0.705% |
| 10 | kuberoot-control / 836a7 | `vendor/golang.org/x/crypto/chacha20.(*Cipher).xorKeyStreamBlocksGeneric` | 453 | 0.667% |
| 11 | kuberoot-control / 836a7 | `runtime.findfunc` | 427 | 0.629% |
| 12 | kuberoot-control / 836a7 | `runtime.memmove` | 422 | 0.622% |
| 13 | kuberoot-control / 836a7 | `crypto/internal/fips140/nistec/fiat.p256Add` | 414 | 0.610% |
| 14 | kuberoot-control / 836a7 | `internal/runtime/atomic.Xchg8` | 387 | 0.570% |
| 15 | kuberoot-control / 836a7 | `runtime.(*unwinder).resolveInternal` | 356 | 0.524% |
| 16 | kuberoot-node / 8365c | `crypto/internal/fips140/nistec/fiat.p256Mul` | 317 | 0.467% |
| 17 | kuberoot-control / 836a7 | `crypto/internal/fips140/nistec/fiat.p256Square` | 316 | 0.465% |
| 18 | kuberoot-control / 836a7 | `runtime.lock2` | 305 | 0.449% |
| 19 | kuberoot-control / 836a7 | `encoding/json.unquoteBytes` | 301 | 0.443% |
| 20 | kuberoot-control / 836a7 | `psi_group_change` | 297 | 0.437% |
| 21 | containerd / 83676 | `runtime.scanObjectsSmall` | 284 | 0.418% |
| 22 | kuberoot-control / 836a7 | `runtime.(*unwinder).next` | 280 | 0.412% |
| 23 | kubectl / 8f52f | `regexp.(*Regexp).tryBacktrack` | 270 | 0.398% |
| 24 | kuberoot-control / 836a7 | `__update_load_avg_se` | 266 | 0.392% |
| 25 | kuberoot-node / 8365c | `memcpy` | 266 | 0.392% |
| 26 | kuberoot-control / 836a7 | `update_load_avg` | 256 | 0.377% |
| 27 | kubectl / 8f7c6 | `regexp.(*Regexp).tryBacktrack` | 254 | 0.374% |
| 28 | containerd / 83676 | `runtime.tryDeferToSpanScan` | 250 | 0.368% |
| 29 | kubectl / 8f7c6 | `compress/flate.(*compressor).deflate` | 234 | 0.345% |
| 30 | kuberoot-control / 836a7 | `runtime.memhashFallback` | 233 | 0.343% |
| 31 | kuberoot-control / 836a7 | `crypto/internal/fips140/bigmod.(*Nat).montgomeryMul` | 232 | 0.342% |
| 32 | kuberoot-control / 836a7 | `runtime.nextFreeFast` | 231 | 0.340% |
| 33 | kswapd0 / 82471 | `LZ4_compress_fast_extState` | 231 | 0.340% |
| 34 | kubectl / 8f52f | `compress/flate.(*compressor).findMatch` | 229 | 0.337% |
| 35 | kswapd0 / 82a13 | `LZ4_compress_fast_extState` | 227 | 0.334% |
| 36 | kuberoot-control / 836a7 | `runtime.mallocgc` | 224 | 0.330% |
| 37 | containerd / 83676 | `psi_group_change` | 222 | 0.327% |
| 38 | kuberoot-control / 836a7 | `runtime.(*mspan).writeHeapBitsSmall` | 221 | 0.325% |
| 39 | kswapd0 / 836a7 | `memcpy` | 211 | 0.311% |
| 40 | kuberoot-control / 836a7 | `crypto/internal/fips140/nistec/fiat.p256Selectznz` | 210 | 0.309% |
| 41 | kubectl / 8f52f | `compress/flate.(*compressor).deflate` | 207 | 0.305% |
| 42 | kuberoot-control / 836a7 | `__update_load_avg_cfs_rq` | 206 | 0.303% |
| 43 | kubectl / 8f7c6 | `compress/flate.(*compressor).findMatch` | 205 | 0.302% |
| 44 | containerd / 83676 | `__update_load_avg_se` | 194 | 0.286% |
| 45 | runc / 82765 | `memcpy` | 194 | 0.286% |
| 46 | kuberoot-control / 836a7 | `encoding/json.checkValid` | 190 | 0.280% |
| 47 | kswapd0 / 80d79 | `LZ4_compress_fast_extState` | 185 | 0.272% |
| 48 | kuberoot-control / 836a7 | `runtime.newInlineUnwinder` | 183 | 0.270% |
| 49 | containerd / 83676 | `update_load_avg` | 176 | 0.259% |
| 50 | kuberoot-control / 836a7 | `runtime.sellock` | 170 | 0.250% |

### Scope still outstanding

The new evidence supports prioritizing repeated CLI work, control-plane stack/
crypto work, and RAM-fault cost; it does not justify blindly switching certificates,
disabling SQLite synchronization, or lowering GOGC. Those changes have **not** been
implemented or measured. A persistent discovery-cache snapshot, init/GC-specific
trace, and a broader warmed-client experiment remain useful next experiments.
No performance setting was silently made the lesson default.

**Integrated SMP remains unimplemented.** No CPU-per-hart shared-RAM engine,
SBI HSM/IPI/RFENCE routing, per-hart TLB/JIT shootdown integration, per-hart
trace differential, or Linux/kuberoot 2/4-hart acceptance was added in this work.
The existing substrate cannot be presented as those results. Step 3 of the brief
and attainment of all three budgets are still outstanding.

### Final checks for this continuation

- Final wasm Chromium ISA/JIT: **439/439**, with N=257 profiling enabled and
  exact attempted-instruction spacing checked at every drained sample.
- Final wasm Chromium trace-diff: **20,000,005 instructions / 784,815 boundaries**,
  exact CPU state at block exits and full RAM at completion; pass (9.107 s).
  This is one-hart validation, not an SMP trace gate.
- Read-only Sv39 observer native test: **1/1**, built/run only in rv64-dev.
- Host TypeScript typecheck, **38/38 RV64 Vitest tests**, **3/3 Python profiler/
  symbolizer tests**, harness syntax, probe `sh -n`, and `git diff --check`: pass.
- Final result files: `R3-profile-v2-{gates,trace}.json` under ignored results.
  Task-created symbol HTTP server and port-forward were stopped; all measurement
  browsers closed. No commits were made.

## CPU-per-Worker SMP continuation (2026-11-21/22)

This continuation implements a real experimental multi-hart engine, beyond the
previous atomic substrate. **Full brief acceptance is still pending**: Linux
2/4-hart shell and synthetic per-hart JIT differentials pass; kuberoot measurement
results and the profile-driven changes are recorded below as they are verified.
No commits; kuberoot checkout remains read-only. Existing `web/vite.config.ts`
changes predate this continuation and were preserved.

### Shared execution and coherence

- `smp-cpu.worker.ts`: one CPU and one private wasm instance per Worker, operating
  on a common shared WebAssembly RAM. Registers, CSRs, TLB, compiled functions,
  and compiler state are per hart. A separate device Engine in Worker 0 owns
  virtio and PLIC; secondary MMIO uses bounded synchronous shared-mailbox RPC.
  HTTP disk completion and Ethernet use host event-loop yields.
- Shared RAM never becomes an aliased Rust `Vec`. Physical fetch/load/store,
  JIT slow helpers, virtqueue DMA, and LR/SC/AMO route through the shared bus.
  PTE A/D writes use full-PTE compare/exchange and retry a changed walk.
  Generated direct RAM accesses see zero private RAM length and take the helper;
  generated arithmetic executes normally. No unsynchronized JIT memory fast path.
- Ordinary aligned reads use atomic wasm loads without the writer lock. Subword
  stores merge under the writer lock. All writers invalidate the conservative
  LR reservation epoch, including same-value writes and byte DMA. AMOs are
  indivisible. Code-page generations change on writes and are checked at JIT
  entry. Shared instruction decoding reads the shared bytes, without a stale
  private decoded cache. The initial signed-W-read/LWU bug was caught by Linux
  boot, fixed, and the failing run is not counted as acceptance.
- SBI HSM start/stop/status, IPI masks/broadcast, and RFENCE requests are connected
  to the CPUs. An ecall yields before waiting for remote fence completion, so
  concurrent callers continue servicing incoming fences. Target ACK follows its
  own TLB/JIT invalidation. RFENCE ranges/ASIDs conservatively flush the target.
  Per-hart SSTC and eight PLIC contexts support four harts.
- The ordinary single-hart snapshot format is deliberately rejected for shared
  CPUs: saving only one hart and an empty private RAM would be corrupt. An
  all-hart barrier, pending-operation/device state, and shared-RAM snapshot format
  remain necessary before measuring SMP restore. The standard lesson machine is
  not silently switched to this experimental engine.

### Measured Linux and trace gates

One headless Chromium instance, sequential runs. Linux uses 256 MiB and the
existing Alpine initramfs. `initcall_blacklist=jent_mod_init` is an explicit
experimental cmdline: the jitter-entropy initcall spent prolonged time in SHA3
under emulation; virtio-rng still receives host cryptographic entropy. This is
not a TLS/certificate bypass or a change to published kuberoot sources.

| Shared read implementation | Harts | Launch → shell command + online-CPU response |
|---|---:|---:|
| Writer lock also taken for reads | 2 | 51.365 s |
| Writer lock also taken for reads | 4 | 178.923 s |
| Atomic loads without writer lock | 2 | 20.389 s |
| Atomic loads without writer lock | 4 | 30.818 s |

Each row is one observation, not a distribution. Both topologies actually report
`0-1` / `0-3` from `/sys/devices/system/cpu/online` and execute the shell marker.
The removal of read-lock contention is an engine fix, not a claimed kuberoot
Ready/get-pods/pod-start improvement.

Per-hart single-instruction JIT differential: **100,000 instructions per hart**,
**600,000 total** across the 2- and 4-Worker runs, all compiled, exact CPU state and
scratch-memory comparison after every instruction. Oracle: the ordinary owned-RAM
interpreter. Scope is a synthetic shared-code/disjoint-data program exercising
loads/stores/AMO/LR/arithmetic, not a Linux boot trace or concurrent LR/SC oracle.
SC is omitted from this differential because unrelated hart writes can legally
invalidate the conservative reservation; separate contention tests cover ABA,
same-value writes, and SC failure. Full Linux per-hart trace replay remains open.

Compact evidence: `R3-smp-acceptance.json`. Full console/results are retained in
ignored `web/public/rv64/results/R3-smp-{linux,linux-unlocked-loads,trace}.json`.
Reproduce sequentially from `web/`:

```sh
RV64_RESULT_NAME=smp-linux node src/engine/rv64/measure.mjs --smp-linux
RV64_RESULT_NAME=smp-trace node src/engine/rv64/measure.mjs --smp-trace
RV64_RESULT_NAME=smp-kuberoot node src/engine/rv64/measure.mjs --smp-kuberoot
```

### Profile follow-up: instrumentation and source evidence

The sampled row keeps its original nine fields and appends RA, SP, a 32-bit
validity mask, and 32 resident stack words. Missing words remain explicitly
invalid. The observer only reads user-readable resident Sv39 mappings; it never
hydrates snapshot pages, changes A/D, services MMIO, or fills TLBs. Disabled
profiling still does no stack reads. The bounded capture adds profiling overhead
and is not to be used for unprofiled performance comparisons.

`rv64-guest-symbols.py` now also exports exact Go pclntab pcsp metadata;
`rv64-guest-callers.py` follows pcsp-proven return slots (up to eight frames),
stopping at missing words, stack-switch functions, unknown frame sizes, or a
cycle. It does not scan arbitrary stack words and label them as callers.
Observer and unwinder tests cover nonresident pages, U/R permissions, unmodified
PTEs, multiple caller frames, missing stack windows, and stack switches.

Read-only source inspection found an important restriction on the proposed fix:
local `k8s.io/klog/v2@v2.140.0/klog.go` calls `runtime.Caller` unconditionally in
`loggingT.header` before `formatHeader` checks `skipHeaders`. Therefore neither
`-skip_headers` nor `-logtostderr` alone proves removal of this stack walk. This
is source evidence, **not call-site sample attribution**. Do not change logging
on that hypothesis until the sampled caller chain identifies the source. If klog
is confirmed, suppress the originating verbosity level or change the experimental
logging implementation before its Caller call, retaining needed diagnostics.

No claim is made yet that TLS reuse/session tickets, certificates, gettext/cache,
or RAM/GOGC/zram tuning has improved any of the three requested kuberoot metrics.
Any required kuberoot source patch belongs in a separate experimental build;
`/Users/tym83/projects/kuberoot` has not been edited.

Additional source evidence: current kuberoot `pkg/pki/pki.go`, `pkg/pki/reissue.go`
and `cmd/kinit/pki.go` already generate ECDSA P-256 keys, including service-account
keys. A blind "switch to ECDSA" patch against this checkout would not establish
that the older guest fixture or every TLS peer changed. The exact control ELF's
SHA-256 was verified as
`a87019474b1fdfbc135b35b44074a4b386276f77da19fb0d3ba46ebdb661e41c`;
its 235,389 Go function records and pcsp data are retained in ignored
`profile-symbols/control-callers.json.gz`. Transfer was compressed in the pod and
SHA-256 checked over a loopback port-forward after direct exec transfers truncated.

### 2026-11-22 (session 2) — kuberoot SMP first window, trace + snapshot infrastructure

**kuberoot on 2/4 harts, first observation (900 s probe window).** One headless
Chromium, sequential topologies, 1 GiB shared RAM each, slim kernel/initrd and
local `slim-recovery-media.json`. wasm build `a6f845b3…` (pre-trace-ungate).
Result file: `R3-smp-kuberoot-900s-window.json`. **Not accepted: both topologies
hit the 900 s harness window without `RV64_NODE_READY`.** One observation per
topology, not a distribution:

| Harts | Reached by 900 s | Missing |
|---|---|---|
| 2 | `RV64_CONFIG_CREATED`, `RV64_READYZ_BEGIN` (console line 246/419) | `RV64_NODE_READY`, get-pods, pod-start |
| 4 | `RV64_CONFIG_CREATED`, `RV64_READYZ_BEGIN` (console line 557/560) | `RV64_NODE_READY`, get-pods, pod-start |

Both boots progress well past `smp: Brought up` and the kallsyms-style symbol
dump; neither stalls — the window is simply too small for the readiness probe.
measure.mjs did not forward `?seconds=` to the smp-kuberoot page (fixed: it now
routes the probe parameters exactly like the one-hart kuberoot scenario, and the
progress interval writes the console capture and metrics for it too). A rerun
with a 3000 s per-topology window is in flight. No Node Ready / get-pods /
pod-start claim is made from this observation.

**Deterministic per-hart trace capture (replaces the synthetic-only
differential; the synthetic 600,000-instruction gate stays).** Cpu trace fields
were native-only and are now compiled on wasm32 behind the same `trace_enabled`
switch; the worker trace mode runs the pure interpreter (JIT threshold 0) on a
fixed 10-tick quantum with fixed virtio-rng bytes, so a hart's guest time is a
function of its retired instructions and a waiting hart still advances time.
The smp-trace-linux harness boots Alpine on 2 harts twice under identical
inputs and compares per-hart event streams word for word (7 words per event:
kind, pc lo/hi, payload), reporting the common prefix and the first divergence
event with context. Pass gate: `smp: Brought up` in both runs plus full
capture length; prefix length is reported as evidence, because communicating
harts may legitimately interleave differently between runs. Measurements land
in `R3-smp-trace-linux.json`.

**All-hart snapshot barrier and restore.** New `smp_snapshot`/`smp_restore` Cpu
entry points encode one quiesced hart (or the device engine) without RAM under
`DTRV64\0\x02`; shared geometry is adopted from the restore target because
`shared_bytes` is never serialized, transient SBI requests stay unserialized,
and caches are rebuilt. The worker barrier drains fence tickets, in-flight MMIO
RPCs and disk chunk fetches before capture; the host reinstalls the sparse
shared-RAM image (nonzero 4 KiB pages), bumps every code-page generation, and
the worker resumes with a fresh JIT runtime. The smp-snapshot harness proves
image sufficiency by wiping the whole shared buffer and reinstalling only the
captured pages before answering a shell arithmetic marker after restore.
Native platform tests: 43 pass. Evidence lands in `R3-smp-snapshot.json`.

Commit `5c8b2bf` carries both capabilities plus the measure.mjs routing.

**Working hypothesis while the 3000 s window runs (not a claim).** After
`RV64_READYZ_BEGIN` both harts keep retiring (~2 MIPS each in the metrics
stream, billions of instructions) with PCs stable inside kernel futex paths,
and the probe eventually gives up: the signature is Go lock/atomic contention
under the conservative LR reservation, where any write anywhere bumps one
global epoch and so an SC on futex word X fails whenever another hart writes
unrelated data. Every failed SC restarts the Go lock acquisition, which is
exactly the live-lock-like grind observed. The correct-by-hardware shape is a
reservation granule (bump a per-128-byte epoch on write; SC fails only when
its own granules changed), which would make unrelated traffic stop
invalidating futex SCs. This is recorded as the next engine experiment and is
NOT yet a sample-proven cause; no engine change is made on this hypothesis
alone.

The 11:44 retry was aborted at ~95 min: saving source files while the vite
dev server was live reloaded the harness page mid-measurement (the engine is
unaffected, but the page restarted its topology loop), and the reloaded phase
then outlived its own 900 s timer without the expected timeout firing through
the saturated renderer — the run was no longer a clean single observation, so
it was stopped rather than reported. Lesson recorded for every future
measurement: no source edits under `web/` while a measurement runs, and the
runner must be started after the last edit. A fresh runner (probe-parameter
forwarding in place, `?seconds=3000` reaching the page) restarted the
measurement; nothing from the aborted attempt is counted as evidence.

### 2026-11-22 (session 3) — 3000 s kuberoot window: recovery reboot loop; trace and snapshot harnesses fixed and run

**kuberoot on 2/4 harts, 3000 s window: not accepted — no topology reached
`RV64_NODE_READY`.** wasm build `3de38f33…` (same as the 900 s window). The
single headless Chromium ran topology 1 (2 harts, 1 GiB shared RAM, slim
assets) and was killed by the harness-level 7500 s timeout still inside
topology 1; topology 2 (4 harts) never started. Evidence:
`R3-smp-kuberoot-3000s-console.txt`. The console shows a **recovery reboot
loop**: each kernel boot reaches `RV64_CONFIG_CREATED` and
`RV64_READYZ_BEGIN` (the recovery profile
`RV64_RECOVERY_PROFILE_COMPACT_5M_STATUS_10S_SYNC_1M` is announced), prints
one `568.15 120.68`-style probe line, then a fresh kernel command line
appears — the node reboots rather than becoming Ready. At least three boots
were observed this way; `smp: Brought up` appears once per boot. This is the
same post-`READYZ_BEGIN` grind as the 900 s window, now with the reboot
machinery visible: the node never leaves the grind before the recovery
health checks fire. Together with the stable-PC futex-path MIPS stream from
the 900 s metrics, this keeps the conservative global reservation epoch as
the leading explanation (any write anywhere invalidates every SC) and makes
the reservation-granule experiment the next engine step before any further
kuberoot SMP measurement. One observation, not a distribution.

**Deterministic per-hart trace on a real SMP boot: PASS.** Two bugs sat in
the session-2 code and only fired on the first real browser run. (1) The
trace path in `smp-cpu.worker.ts` passed a BigInt tick quantum to
`smp_run(count: u32, ticks: f64, …)` — wasm-bindgen glue cannot convert
BigInt to f64, so both harts died instantly with `TypeError: Cannot convert
a BigInt value to a number`; the quantum is a plain number now. (2) The
harness put `Date.now()` into `rv64.epoch=`, so the two "identical" runs
had different inputs; the epoch is a fixed constant now. After the fixes,
both runs booted Alpine on 2 harts to `smp: Brought up` and captured the
full 1,000,000 events per hart (7,000,000 words each, ~4.6 s per run):
hart 0's stream is bit-identical across runs (FNV 2359275194 in both);
hart 1 matches word-for-word for 55,294 words (7,899 events) and then
diverges, which is the expected interleaving-dependent region — worker
scheduling between the two harts is not part of the deterministic input.
Evidence: `R3-smp-trace-linux.json`.

**SMP snapshot harness: fixed and run.** `smp-snapshot.ts` sized its
coordination buffer as `2 + HARTS * 4` = 10 bytes, which is not a multiple
of 4, so every worker died constructing its `Int32Array` view; the buffer
is `(2 + HARTS) * 4` now. **Result: PASS. After the buffer fix both harts booted Alpine to a shell, the barrier captured all harts in 1.76 s, the sparse image holds 11,818 nonzero 4 KiB pages (48.4 MB of the 256 MiB guest region), and after the whole shared buffer was wiped and only those pages reinstalled — plus one generation bump per page — both harts restored their state and answered the shell marker `RESTORED_OK_42`. Evidence: `R3-smp-snapshot.json`.

### 2026-11-22 (session 3, late) — reservation granules: kept as a fix, refuted as the kuberoot cause

The 3000 s kuberoot SMP window was rerun on top of cb43301
(granule reservation sets) and **the signature is unchanged**: topology 1
reaches `RV64_CONFIG_CREATED` and `RV64_READYZ_BEGIN` (guest uptime ~495 s at
the readyz probe, idle ~120 s), then the recovery profile reboots the node and
a fresh kernel boot begins; the run was stopped after two identical boot
cycles (~19 min) instead of spending the rest of the window. Evidence:
`R3-smp-kuberoot-granule-console.txt`. **Conclusion: the conservative global
reservation epoch was a real deviation from hardware (and the granule change
is kept — the substrate gates and SMP Linux validate it), but it was not the
cause of the kuberoot SMP stall.** The futex live-lock hypothesis built on it
is refuted as the explanation for the post-READYZ grind. What the refutation
buys: the stall is elsewhere — candidates now are Go runtime sched/timer
behaviour across harts, kube-apiserver/kine deadline interactions under the
SMP slowdown, or the recovery profile's health window being shorter than the
SMP time-to-ready (boot 1 was rebooted at ~700 s host while the one-hart
baseline reaches Ready at ~743 s cold: a 2-hart boot that is merely ~2x slower
would need >1400 s, and the recovery window is shorter than that). The next
measurement must be made with the guest sampling profiler attached after
READYZ_BEGIN (RV64_GUEST_PROFILE_INTERVAL), so the stall is attacked from
sample-proven hotspots, not from the next guess.
