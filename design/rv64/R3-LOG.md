# R3 work log — slim boot, deadlines, and SMP foundations

2026-11-21, `feat/rv64-r0`. No commits. **Partial: one-hart Node Ready and BusyBox Ready achieved; SMP/Linux gates are not accepted.**
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
