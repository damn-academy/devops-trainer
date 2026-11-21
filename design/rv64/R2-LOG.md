# R2 work log — network prerequisite and incremental wasm JIT

2026-11-21, branch `feat/rv64-r0`. No commits. **R2 is partially implemented and not accepted.**
Rust builds and tests run only in `tenant-kuberoot/rv64-dev`, context
`admin@workshop`; Chromium runs locally, one instance at a time.

## Latest checkpoint (diagnostic/fix pass)

The 900-s Chromium checkpoint improves **67.901 → 109.795 busy MIPS** and
**37.43 → 72.30 billion retired instructions**. Node Ready is still not reached;
loopback TLS timeouts cause an apiserver post-start hook failure and restart.
The extended 1,800-s observation also fails to reach Ready (130.734 busy MIPS).
A larger-cache pod experiment was rejected for memory use and regression.
Do not treat this as R2 acceptance. Final results and counter rates are appended
below under the diagnostic/fix milestones.

Implemented telemetry, asynchronous disk completion, stable physical code
identity, live code-page tracking, module LRU, reduced register spills, guarded
tail chaining and a shared table dispatcher. Latest forced-JIT gates: **439/439**,
2 M single-instruction and 20 M superblock trace-diff with exact RAM. CoreMark
final paired shared-dispatch sample: **679.594 busy MIPS**, shell **3.401 s**,
**11.432×** the same-build interpreter (59.446 busy MIPS). Host
memory contention prevents attributing differences between individual runs
solely to the code changes. Native Rust has no JIT backend: its measured
interpreter control is reported separately from the pod Node/V8 wasm host.

## Starting checkpoint (previous JIT pass)

Real wasm JIT is active. Latest controlled CoreMark: **288.710 busy MIPS**,
**4.436×** the same-build interpreter, **795.084930 iterations/s**, Linux shell
in **4.033 s**. Forced-JIT correctness: 173 supported ISA tests + 266 signatures
pass; 2 M single-instruction and 20 M superblock differential attempts have zero
observed divergences, including exact final RAM. The full kuberoot probe still
has **no Ready marker at 900 s**; Kubernetes latencies are unavailable. Detailed
milestones, intermediate regressions and final limitations follow chronologically.

## Verified changes

- Added `rv64/network.ts`: existing course L2Switch + LabHost + DHCP + DNS +
  local HTTP mirror. There is no upstream DNS or Internet forwarding.
- Added a native loopback-UDP Ethernet bridge using exactly the same TypeScript
  services. `boot` opts in with `RV64_NET_PORT=18080`; no TAP, privileges, host
  routes or external guest access are required.
- Wired the real Chromium integration test through this network. Linux obtains
  `10.0.0.10/24`, resolves `mirror.lab`, and downloads a local HTTP object by
  hostname. Every shell stage must succeed. The block read, facts collection,
  file rollback and two consecutive snapshot restores also pass.
- Found a virtio-blk bug after DHCP: a legal 1 MiB data transfer plus header and
  status exceeded the engine's undocumented 1 MiB descriptor-chain cap. The
  device set NEEDS_RESET (`status=0x4f`) and stopped servicing disk requests.
  Removed that cap, retaining queue traversal bounds, RAM checks and the u32
  used-length bound. Added a regression for precisely this request size.
- Added a separate instrumented kuberoot media preparation script. Its wrapper
  still execs real kinit as PID 1. The background probe observes actual Node
  Ready, times three `kubectl get pods -A` calls using `/proc/uptime`, imports
  offline images, and starts a BusyBox pod with `imagePullPolicy: Never`.
  It emits completion only after successful commands. Published media is not
  changed. Remote package subscription is disabled only in the probe image.

## Measurements and checks

| Check | Result |
| --- | --- |
| Native published kuberoot → stage-two kinit | 43 s guest uptime; DHCP lease obtained |
| Native probe after virtio-blk fix → kinit | 41–42 s guest uptime; DHCP lease obtained |
| Full kuberoot → Node Ready, compressed probe | Not reached within 900 s (1 GiB guest) |
| Full kuberoot → Node Ready, uncompressed probe | Not reached within 600 s (1 GiB guest) |
| Pod start / `kubectl get pods` latency | Not measurable: no Ready marker in either probe |
| Chromium Linux shell boot (Alpine initrd, kuberoot kernel) | 8.122 s |
| Chromium interpreter CoreMark | 203.472599 iterations/s; CRC validation passes |
| Chromium interpreter busy / effective MIPS | 72.972 / 72.335 |
| CoreMark command wall time including cold start | 20.326 s |
| Rust platform regressions | 34 passed |
| riscv-tests, interpreter | 173 passed, 0 failed, 1 explicitly unsupported (Sdtrig) |
| TS network/ring/block tests | 16 passed |
| TypeScript typecheck | Passed |
| Chromium network + existing machine integration | Passed |

Evidence: `R2-network-browser.json`, `R2-interpreter-browser.json`,
`R2-interpreter-tests.txt`. These are **interpreter** results, not forced-JIT
correctness or a JIT speedup. The 266 architecture signatures reported in R1
have not been rerun in this pass.

Final wasm after the block fix: 236001 bytes,
SHA-256 `e8f338a2a7fafdc04739dac5afa6b4c29adc9f26860a294a10b901df8f87f498`.

## Full-node investigation

The compressed offline probe ran for 900 s without Node Ready. It retired
32,055,888,745 instructions (35.618 effective MIPS). Its block device completed
290/290 requests and all four virtio devices retained status `0xf`: the previous
NEEDS_RESET failure is fixed. Evidence: `R2-network-native-compressed.txt`.

A diagnostic sample showed 760812 KiB free / 935000 KiB available, so memory
pressure was not established as the cause. Hot sampled kernel addresses resolve
to `ZSTD_decompressSequences` and `memcpy`; the processes for containerd, kine,
kube-apiserver and kuberoot-node were present. A separate uncompressed SquashFS
image built from the same instrumented root reaches stage-two kinit in 19 s.
Its containerd reports successful boot at guest uptime 194 s and kube-apiserver
reports version v1.37.2 at 296 s. It also fails to reach Node Ready within its
600 s limit: 20,811,947,539 retired instructions, 34.687 effective MIPS; block
requests 422/422 completed, all devices status `0xf`. The log records TLS
handshake timeouts from kuberoot-node to the local apiserver. These milestones
do not establish readiness, and the precise remaining startup bottleneck has
not been isolated. Evidence: `R2-network-native-uncompressed.txt`.
The compressed and uncompressed diagnostic runs overlapped; they are not a
controlled throughput comparison. No JIT is involved.

`rv64-uncompressed-media.py` constructs a separate GPT/FAT medium; it does not
modify the kernel or published medium. The output is 1,160,773,632 bytes, so the
size tradeoff must be considered before adopting it for the browser.
Intermediate R2 media/chunks were removed to reclaim pod storage; the published
media, extracted probe root, offline-v2 and uncompressed media are retained.

## Offline images

`scripts/rv64-offline-images.sh` pins these linux/riscv64 platform manifests:

| Image | Platform manifest SHA-256 |
| --- | --- |
| `docker.io/coredns/coredns:1.13.1` | `7efd62b628180681ba96ed3a0c1a1311b976f8d1cc61159f4b2dc80a83583e16` |
| `docker.io/rancher/local-path-provisioner:v0.0.32` | `760110b2836a165df77b1641e554b2155f41c4df798ff667db61c877f402a326` |
| `docker.io/library/busybox:1.37.0` | `be2e8702261d743f7b1ba1b1cb4499927664d7a82baedf87564306426dda680a` |

Downloaded in the pod into docker archives (71 MiB, 57 MiB, 3.4 MiB) and included
in a separate squashfs/media image. Pause is already bundled in kuberoot.
The uncompressed run records BusyBox ImageUpdate at 588 s, but completion of
all three imports and running CoreDNS/local-path pods are **not verified**.
No tab requests are sent to those upstream registries.

## Reproduction and remaining work

Local network bundle:

```sh
web/node_modules/.bin/rolldown web/src/engine/rv64/native-network.ts \
  --platform node --format cjs --file /tmp/rv64-network.cjs
bash scripts/rv64-dev.sh cargo build --release --bins
bash scripts/rv64-dev.sh test-isa
# Transfer the bundle to /work/rv64-network.cjs in rv64-dev, then run there:
node /work/rv64-network.cjs
# In another exec in the same pod:
RV64_PROBE=1 RV64_MEMORY_MB=1024 RV64_NET_PORT=18080 \
RV64_DISK=/work/guest/kuberoot/offline-v2.img \
/work/target/release/boot /work/guest/vmlinuz.efi \
  /work/guest/kuberoot/initrd.cpio 900 \
  'earlycon=sbi console=hvc0 nokaslr kuberoot.root=PARTLABEL=KUBEROOT-MEDIA:/kuberoot/rootfs.squashfs kuberoot.verbose'
```

The browser full-media harness is `measure.mjs --kuberoot`. It requires local
`kuberoot-initrd.cpio`, a media file and `kuberoot-media.json` containing
`{ "url": "/rv64/<media filename>", "bytes": <exact size>, "version": <sha256> }`.
This full-media browser harness has been typechecked, not accepted by a boot.
The existing `--integration` and `--boot` harnesses were executed successfully.
Large workshop transfers repeatedly stalled/reset; the checked small-chunk
publisher/fetcher and HTTP wasm transfer were used instead. Initrd transfer
verified SHA-256 `be161151dcbbb61b1b121ea6df122bbda5feb6b9829eda607e40910244887265`.

Outstanding: establish full kuberoot readiness and offline pod startup, obtain
native/browser Kubernetes timings, then implement the R0 R2 compiler Worker,
batched superblocks, locals/spills, tail calls, inline TLB, invalidation,
precise exceptions, timer budgets and FP fast paths. Forced-JIT ISA/arch tests,
Linux trace-diff and the ≥3× / 250–400 busy MIPS speed gate remain unrun/unmet.

Final housekeeping: native probes ended; temporary rv64-dev-files Service and
both R2 HTTP servers were removed. Chromium closed after each measurement.
No commits were made. Full brief remains incomplete.

## JIT milestone 1 — initial integer compiler (2026-11-21)

Added a separate compiler Worker emitting one wasm module per batch (up to 256
blocks). Generated functions import the actual Rust engine memory, load guest
registers into i64 locals, spill modified registers and return the next PC through
an explicit output pointer. The hart installs functions in the Rust wasm function
table and calls them directly with call_indirect, without a JS dispatch per block.
Hot-entry threshold is configurable (0 disables, default 50, tests can use 1).
The hart uses MessageChannel yields between execution quanta to receive compiled
modules; compilation itself runs in the compiler Worker.

Initial tier: integer arithmetic, word operations, low multiply, division and
remainder with RISC-V zero/overflow semantics, branches/JAL/JALR, and compressed
forms expanded by the existing decoder. Blocks stop at a control transfer,
unsupported instruction, 64 instructions or physical page boundary. This is NOT
yet complete RV64I/M, superblock linking, inline memory/TLB, A or F/D translation.
Unsupported instructions execute through the existing precise interpreter.

Cache identity includes physical address, virtual PC (for AUIPC), privilege,
satp, mstatus, translation epoch and physical-page write generation. RAM writes
and DMA/image writes increment page generations; FENCE.I, SFENCE.VMA and existing
translation flush sites change the epoch. A block cannot exceed its remaining
instruction budget. Pending enabled interrupts force the interpreter boundary.
The first wasm build, including exported function-table access, passed in rv64-dev.
Correctness and performance acceptance remain pending; no speedup is claimed.

## JIT milestone 2 — first measured execution and memory fast path

The first successful Chromium JIT run (integer-only tier, threshold 50) booted
Linux to shell and validated CoreMark, but was slower than the interpreter:
21.915 busy / 21.718 effective MIPS, 59.523810 CoreMark iterations/s, 29.107 s
boot, 20.719 s benchmark command. 157,068 functions compiled and 597,745,000
instructions executed in generated wasm across boot plus benchmark. Evidence:
`web/public/rv64/results/R2-jit-initial-browser.json`. This is a failed speed gate.
Earlier failed attempts exposed the fixed-size linker function table and then a
stale wasm artifact missing jit_clear; neither is counted as an accepted run.

Added all high-multiply variants with 32-bit limbs, and generated aligned RAM
loads/stores using the existing 256-entry direct-mapped read/write TLB. Inline
checks cover valid/full-page PMP, virtual tag, satp, effective privilege + SUM/MXR,
RAM bounds and code-page bitmap. Misses, unaligned accesses, MMIO and writes to
code pages spill the exact prefix and PC, then return to the interpreter's
existing access/exception/refill path. Stores clear LR/SC reservation on exit.
The direct function ABI now reports the actual prefix length, so a failed fast
path consumes no guest instruction or budget. This is dispatcher-mediated slow
path handling, not yet an imported slow helper inside the generated function.

Seven codegen tests pass, covering integer boundary arithmetic, division edge
cases, high products, branches, RAM hits and precise prefix exits for tag/PMP/
context/satp/alignment/MMIO/code-page misses. Typecheck passes. The memory tier
is awaiting the pod build and forced-JIT browser conformance run.

## JIT milestone 3 — dispatch and conformance harness

Added browser-only runners for all 173 supported riscv-tests and 266 pinned
architecture ELFs with their existing Spike signatures, fetched from rv64-dev
by `scripts/rv64-jit-fixtures.py`. The Sdtrig breakpoint test remains explicitly
excluded. Threshold 1 parks at an eligible cold block until compilation finishes;
unsupported instructions remain interpreter fallbacks and are not claimed as
native JIT instruction coverage. Added deterministic Linux-prefix differential
checking of all integer/FP registers, PC, mode, CSRs, counters and wait/stop state
at every block exit, with exact full-RAM comparison at the end. This is a
block-boundary differential, not a per-instruction trace inside generated blocks.

The hot dispatcher now uses a bounded direct-mapped context cache. Context entries
can share generated code keyed by physical address, virtual PC and page generation,
while fetch/PMP is checked for the full block on every invocation and memory accesses
check the current per-call MMU context. This avoids recompiling identical code after
every translation epoch. Fall-through superblocks retain conditional taken exits;
internal branch linking/tail chaining remain absent. Native platform regressions
remain 34/34 after adding the checked TLB ABI and code-page bitmap.

## JIT milestone 4 — forced-JIT corpus passes

Chromium 159 forced threshold-1 run: **173/173 supported riscv-tests passed**,
**266/266 architecture signatures matched Spike**. Every one of the 439 tests
retired generated-wasm instructions (428,616 total). This validates mixed JIT +
precise fallback execution; it does not claim A/F/D hardware translation.
Evidence: `web/public/rv64/results/R2-jit-memory-gates.json` and
`R2-jit-gates-run.txt`. The harness was restarted after removing artificial
setTimeout delays during CPU progress; unfinished attempts are not counted.

Added budgeted internal backedges to the superblock entry. Registers stay in
locals across iterations; the emitted loop checks the remaining instruction
budget before another iteration and reports the exact total executed prefix.
A regression ensures an early TLB miss in a later iteration spills registers
written later in the previous iteration. Ten codegen tests pass. The new loop
tier still requires repeat conformance, differential and speed checks.

## JIT milestone 5 — Linux differential with internal loops

Chromium deterministic Linux-prefix comparison passed at threshold 1:
20,000,005 attempted instructions, 2,306,966 compared block/instruction exits,
19,720,919 generated-wasm instructions, 4,714 compiled functions, 24.045 s.
Integer/FP registers, PC, mode, all CSR storage, architectural counters and
wait/stop flags matched at every observed exit; final full RAM matched byte for
byte. Evidence: `web/public/rv64/results/jit-trace.json` and
`R2-jit-trace-run.txt`. Host ticks and device service boundaries were identical.
This is stronger than a final-state-only boot check, but still NOT a full
instruction-level trace inside a generated block, nor a full Linux boot diff.

## JIT milestone 6 — target throughput reached in Chromium

The unprofiled superblock + inline TLB run at threshold 50 validates CoreMark:
**261.361 busy MIPS**, **252.350 effective MIPS**, **725.115359 iterations/s**,
**8.145 s Linux boot to shell**, 16.962 s complete benchmark command.
49,492 functions compiled; 4,599,476,000 JIT instructions across boot and benchmark.
Relative to the previous R2 interpreter measurement (72.972 busy MIPS), this is
**3.582×**, within the requested 250–400 busy-MIPS range. This is one measured run,
not a statistical estimate. A same-build JIT=0 control is being measured next.
Evidence: `web/public/rv64/results/R2-jit-loop-browser.json` and
`R2-jit-loop-benchmark.txt`. The faster CoreMark does not imply faster cold kernel
boot (8.145 s versus previous 8.122 s); cold translation remains material.

## JIT milestone 7 — exact A/F/D helpers and final CPU gates

A and F/D instructions now terminate generated blocks with a direct wasm call
to the existing exact operation helper. The compiler preserves original compressed
encodings for illegal-instruction tval, spills the prefix, clears earlier store
reservations before LR/SC, and accounts separately for the faulting attempt and
retirement. These are exact scalar/soft-float helpers, NOT native wasm atomic or
RNE floating-point fast paths. Eleven codegen tests pass, including helper ABI,
spill ordering, compressed raw encoding and helper-modified register preservation.

Final forced threshold-1 corpus: **439/439 pass**, comprising 173 supported
riscv-tests and 266 Spike signature comparisons; every test executes generated
code, 751,020 JIT instructions total. Evidence: `R2-final-gates.json/.txt`.
Final native platform regressions: **34/34** (`R2-final-platform.txt`).

Final deterministic Linux differential:

| Mode | Attempts | Compared exits | JIT instructions | Divergences | Wall |
| --- | ---: | ---: | ---: | ---: | ---: |
| One-instruction blocks | 2,000,000 | 2,000,000 | 1,927,769 | 0 | 20.307 s |
| Normal superblocks | 20,000,005 | 2,298,903 | 19,736,250 | 0 | 23.630 s |

Each comparison includes x/f/PC/mode/CSRs/counters/wait/stop state; full RAM also
matches exactly at the end. The instruction-by-instruction run deliberately uses
single-instruction generated blocks; the normal-superblock run checks exits.
Evidence: `R2-final-single.json/.txt`, `R2-final-trace.json/.txt` in
`web/public/rv64/results/`. This is a boot prefix, not a complete boot trace.

## JIT milestone 8 — same-build final performance comparison

Sequential unprofiled Chromium 159 runs, one browser, identical kernel/initrd and
wasm SHA-256 `0c483ecbec1cad059027f5675480979fb0096c9fcf14dcc93a5de480c1e33988`:

| Metric | JIT disabled | JIT threshold 50 |
| --- | ---: | ---: |
| CoreMark busy MIPS | 65.159 | **275.743** |
| CoreMark effective MIPS | 64.674 | **266.404** |
| CoreMark iterations/s, CRC validated | 181.367511 | **763.888889** |
| Linux shell boot | 8.465 s | **7.314 s** |
| Benchmark command including calibration | 22.776 s | **16.063 s** |

Busy-MIPS speedup is **4.232×** on the same build, or **3.779×** versus the previous
72.972-MIPS interpreter checkpoint. The disabled path has some instrumentation/
cache-maintenance overhead relative to that older build, so both comparisons are
reported. The ≥3× and 250–400 busy-MIPS gates are met in these single samples.
Evidence: `R2-final-interpreter.json/.txt`, `R2-final-jit.json/.txt`.

Full-node probe uses the already existing uncompressed offline probe image,
1,160,773,632 bytes, SHA-256
`40e243cfc024eb09a9cbd584ebc5fdd1736adfffcdb80f7ffde31bec53a6665c`.
A temporary read-only HTTP range server binds only pod loopback; kubectl
port-forward exposes it only on local loopback. No new Service or network-engine
change is involved. Its I/O latency is part of the full-node result. Probe and
snapshot/restore integration are running; readiness/latencies are not yet claimed.

## Cold-path follow-up while the first full-node probe runs

The JIT-enabled integration passes network/lazy-disk/facts and two consecutive
snapshot restores (`R2-final-integration.json`, snapshot 53,055,956 bytes).
The full-node probe reaches stage-two kinit at guest uptime 42 s, obtains DHCP,
creates its config and starts containerd (fully booted at uptime ~350 s).
Kube-apiserver reports its version at ~457 s, but local API clients still show
TLS handshake timeouts after 11 minutes. No Ready/latency claim yet.

Prepared two focused improvements, not applied to that running browser:
- Count hot entries at real interpreter basic-block boundaries, rather than
  probing the JIT on every cold instruction. Reuse already compiled physical
  code immediately when a new MMU context reaches it; revalidation remains.
- A generated RAM miss can call the existing precise wasm helper directly,
  then exit with the attempted count and exact next/trap PC. An isolated
  codegen test copy passes all 11 tests for this form. This replaces the earlier
  return-to-dispatcher-then-redecode slow path.
The running probe continues to use the previously measured artifact/code.

## First full-node JIT result and cold-path correction

The first full-node JIT probe timed out at 900 s without Ready. It retired
31,407,930,000 instructions, spent 594.469 s in core.run (~52.83 busy MIPS),
compiled 1,011,779 functions and retired 17,467,193,000 JIT instructions.
This workload does NOT reproduce CoreMark throughput. The remaining wall time
includes image I/O, compilation/message processing and idle periods; it is not
attributed exclusively to network I/O. `kubectl get pods` and pod-start timings
remain unavailable. Evidence: `R2-first-kuberoot.json`, `R2-final-kuberoot.txt`.

Applied the two prepared corrections after that browser closed: genuine hot
basic-block entry counting with immediate reuse of compiled physical code across
contexts; and direct wasm memory slow-path calls with exact fault/retirement
accounting. The 65,536-function installed-code limit and 8,192-pending-block bound
remain. Latest pod artifact SHA-256:
`2d49b5f63c3f8b39f23c0ae18c6b110e3e1f9044bd25aa29dc36490b94c90494`.
All CPU gates and measurements are being repeated on this version.

## Final fallback-boundary fix and enforced speed gate

The first cold-path version booted the shell in 4.195 s and compiled only 10,377
functions, but regressed CoreMark to 176.903 busy MIPS / 492.610837 iterations/s.
That version failed the requested speed gate. Its second full-node attempt was
stopped before completion (no Ready result is claimed); evidence is the partial
`R2-coldfix-kuberoot.txt`. The earlier 900-s attempt remains separately recorded.

Found the missed execution boundary: after an unsupported instruction (notably
B extensions), the interpreter stayed active through the rest of the basic block.
It now resumes JIT lookup immediately after fallback/helper boundaries while
retaining real entry counting for cold straight-line I/M code. Also consolidated
all memory guards for an instruction into one cold wasm helper call site (11
codegen tests pass), reducing generated code size without duplicating slow exits.

Latest controlled same-build result, threshold 0 versus 50:

| Metric | Interpreter | JIT |
| --- | ---: | ---: |
| Busy MIPS | 65.090 | **288.710** |
| Effective MIPS | 64.601 | **278.547** |
| CoreMark iterations/s (CRC correct) | 180.646715 | **795.084930** |
| Linux shell boot | 8.953 s | **4.033 s** |
| Full benchmark command | 22.801 s | **15.361 s** |

Busy speedup: **4.436×** same-build, **3.956×** over the prior 72.972-MIPS
checkpoint. The harness now enforces same wasm/compiler-source fingerprints,
≥3× and ≥250 busy MIPS with `--speed-gate`; subsequent gates/node probes run
only after that check succeeds. Evidence: `R2-release-interpreter.json/.txt`,
`R2-release-jit.json/.txt`. Rust wasm SHA-256:
`68e6fc76c7dca5b6036c89960864d6e0f03de7ec3be2e19f8f89fa88e15bf0d1`.
The final correctness/integration/full-node sequence is running on this version.

## Release-candidate verification (latest code)

The enforced same-build speed gate passed with the 288.710-MIPS result above.
Repeated correctness on that exact wasm/compiler-source fingerprint:

- 173/173 supported riscv-tests, one explicit Sdtrig exclusion;
  266/266 pinned Spike signatures: **439/439 pass** at threshold 1.
- 2,000,000 single-instruction-block state comparisons: **zero divergences**,
  1,999,785 JIT instructions; exact final RAM matches (20.454 s).
- 20,000,005 attempts with normal superblocks: 2,186,788 compared exits,
  **zero divergences**, 19,959,151 JIT instructions; exact final RAM matches
  (22.772 s).
- Browser integration passes lazy disk, DHCP/DNS/HTTP, facts and two consecutive
  restores; snapshot 53,018,980 bytes. Derived code caches are recreated on restore.
- Final native pod checks: 34 platform regressions and 173 supported upstream
  cases pass; one optional Sdtrig case excluded. No native JIT claim is made.
- 17 TypeScript tests and typecheck pass; git diff --check passes.

Evidence prefix: `web/public/rv64/results/R2-release-` with `gates`, `single`,
`trace`, `integration`, `platform` and `isa` suffixes. JSON records include both
wasm SHA-256 and a fingerprint of the compiler/Worker/runtime sources.
The last full-node probe is running after all these gates succeeded.

## Reproduction of CPU gates

```sh
# From repository root; all Rust work goes through rv64-dev:
bash scripts/rv64-dev.sh wasm
python3 scripts/rv64-jit-fixtures.py
cd web
RV64_RESULT_NAME=control RV64_JIT_THRESHOLD=0 node src/engine/rv64/measure.mjs --boot
RV64_RESULT_NAME=jit RV64_BASELINE_RESULT=control node src/engine/rv64/measure.mjs --boot --speed-gate
node src/engine/rv64/measure.mjs --jit-gates
node src/engine/rv64/measure.mjs --jit-trace --single-step
node src/engine/rv64/measure.mjs --jit-trace
node src/engine/rv64/measure.mjs --integration
```

Run these sequentially (one Chromium). The fixture script requires the existing
pod-built 173 supported ISA ELFs and 266 architecture ELFs/Spike signatures; it
fails on missing inputs instead of reporting a pass. `RV64Machine.jitThreshold`
exposes configuration: 0 disables, 1 forces eligible blocks before execution,
default 50. No lesson enables the experimental engine automatically.

Remaining implementation limits: single hart; A/F/D use exact wasm helpers;
no native RNE FP fast path; B extensions and privileged/system operations can
fall back to the interpreter; only entry backedges/fall-through are internal to
superblocks, with other edges returning to the dispatcher (no tail chaining).
These are explicit coverage/performance limits, not interpreter-only benchmark
results. Full-node readiness and Kubernetes latencies are reported separately.

## Final full-node result and handoff

The latest full-node Chromium probe reached neither the Ready marker nor the
probe completion marker within **900 s**. Its actual counters:

- 37,432,371,000 retired instructions; 551.276 s inside core.run.
- **67.901 busy MIPS** for this full workload (approximately 41.6 effective MIPS
  over the 900-s probe), versus 288.710 busy MIPS on CoreMark.
- 62,202 compiled functions; 31,569,698,000 JIT instructions (~84.34% of total).
- Kinit/DHCP/config creation and service startup succeed, but kube-apiserver/
  kuberoot-node continue logging local TLS handshake timeouts and slow SQL.
- **Node Ready: not observed. `kubectl get pods` latency and pod-start latency:
  not measured**, because the probe deliberately starts those gates only after
  Ready. No fabricated or substitute Kubernetes timings are reported.

Evidence: `web/public/rv64/results/R2-release-kuberoot.json/.txt`. Image I/O goes
through the documented port-forward, so this is not a CPU-only startup comparison.
The precise remaining full-node bottleneck has not been isolated. The reduction
from >1 million to 62,202 compiled functions removes the observed recompilation
explosion, but does not by itself establish Kubernetes readiness.

The requested JIT now runs real generated wasm with locals/spills, page/context
cache validation, inline RAM TLB checks, exact slow calls, helper-backed A/F/D,
compressed decoding and budgeted internal loops. The available forced-JIT CPU
correctness gates and CoreMark speed gate pass. R2 is **not fully accepted**:
full-node readiness/Kubernetes timings remain open, along with native FP fast
paths and more extensive block chaining/ISA optimization described above.

Cleanup: all test Chromium instances closed; temporary local port-forward and
pod loopback media server stopped. The temporary `kuberoot-media.json` pointing
at that endpoint was removed. No Service, published image, host route, or network
engine configuration was changed. The pod/PVC and ignored test/result artifacts
remain for reproduction. No commits were made.

## Kuberoot bottleneck investigation — 2026-11-21

Read the entire preceding log before changes. No commits. Preserved the three
pre-existing untracked fixture/media/test files. Rust builds/tests remain pod-only;
local headless Chromium is sequential. The native `boot` binary is an interpreter:
there is no native JIT backend in this repository (`jit.rs` is wasm32-only).

Added non-architectural, snapshot-excluded engine counters, exported as JSON by
`Engine.metrics()` and native `boot` (`METRICS` every 10 s and at exit). Browser
workers publish one-second samples through `RV64Machine.executionStats()` and the
kuberoot measurement page; result JSON retains the time series. Counters cover
JIT lookups/context hits/physical-code reuse/dispatch/cold/pending/queue limits,
cache clears, stores and DMA to decoded-code pages, TLB flushes, FENCE.I,
SFENCE.VMA, actual satp changes, SBI remote fences, Rust TLB requests/page walks,
inline generated TLB checks/misses, device MMIO, SBI ecalls, A and aggregate F/D
helper calls, interpreter retirement, exception causes 0–15 and interrupt causes
0–15. Interrupt 5 is supervisor timer, 1/3 software/IPI; exceptions 12/13/15
are page faults, 2 illegal, 8 user ecall. SBI ecalls are serviced without trap()
and therefore counted separately. Generated helper-backed instructions remain
included in the JIT retirement total; helper counters distinguish that work.

TLB denominators are intentionally separate: Rust `tlb_requests` includes fetch
revalidation and slow accesses; `tlb_walks` counts actual page-table walks.
Generated `inline_tlb_checks/misses` covers the Sv39/aligned guard after the initial
mode/alignment check. It must not be presented as the same denominator. Code-page
write counters count affected pages, including the interpreter decode cache,
not necessarily live translated blocks. FENCE/SFENCE/satp counters denote causes
of translation-cache flushes, **not** destruction of generated wasm functions.
Compile latency is enqueue-to-install (includes batching and event-loop delay),
with cumulative mean/max and queue/inflight gauges. Browser timing separates
core.run, Atomics.wait (idle/output backpressure), compiler yielding, blocking disk
wait, and, after the fix, overlapping asynchronous disk activity.

### Instrumented baseline, 180-second prefix

`R2-diag-before.json` and `R2-diag-before-summary.json` under
`web/public/rv64/results/`: final sample at 177.570 s, 2,281,007,777 retired
instructions, **50.475 busy MIPS / 12.846 effective MIPS**, **92.98% JIT**,
**14.18 instructions per JIT dispatch**, 90.97% context-cache hit rate.
20,190 functions installed; enqueue-to-install mean 28.945 ms, maximum 709.385 ms;
zero pending at the final sample, zero queue-limit events and zero full-cache clears.
**130.249 s blocking disk wait**, 0.457 s Atomics.wait, 0.439 s compiler yields.
In the final ~58 s interval, code-page writes were **zero**, while the guest
continued retiring 837 M instructions. The available data does not support a
persistent Go-GC code-invalidation storm or a compiler backlog as the primary
cause. This is an early boot prefix, not a controlled replacement for the old
900-second 67.901-MIPS result; workload composition differs.

The prefix revealed two actionable costs: synchronous HTTP disk fetches stopped
the whole hart (including unrelated runnable guest tasks), and short JIT blocks
paid a HashMap lookup for the installed function on every dispatch. Changes:

- HTTP chunk completion is asynchronous; the CPU continues while requests are
  pending. Duplicate requests are coalesced, errors propagate, event-loop yields
  service completions even with JIT disabled, and WFI waits are capped while I/O
  is pending. Snapshot/reset drain outstanding requests before accessing/freeing
  the core. Completion preserves the existing Rust descriptor preflight and DMA.
- Direct-cache identity is now physical address + virtual PC + page generation.
  It survives satp/status/translation-epoch changes. Fetch translation and full
  block PMP permission are still checked on every invocation; generated memory
  operations still validate current mode/SUM/MXR/satp. The virtual PC remains
  necessary because generated AUIPC/branch/link values embed it.
- Cache the installed function slot/count in the direct entry, resolving its
  HashMap only while compilation is pending. Clearing the JIT also clears entries,
  so recycled function-table slots cannot remain referenced.

Native perf sampling was attempted but perf_event_open was denied by the pod's
existing permissions; no capabilities/security settings were changed. A preliminary
439-test browser pass used the earlier instrumentation artifact while a subsequent
artifact was transferring; it is **not** the correctness claim for the final fix.
The final-artifact gate/trace/integration/full-node sequence follows below.

Extracted the embedded IKCONFIG from the exact local `vmlinuz.efi` (IKCFG_ST at
byte 14,760,808): `CONFIG_HZ=250`, `CONFIG_NO_HZ_IDLE=y`,
`CONFIG_PREEMPT_NONE=y`. There is no evidence for a 1000-Hz periodic-tick build.
Delivered timer counts also include programmed hrtimers; they are not a direct
measurement of CONFIG_HZ. The engine exposes Sstc and retains real host time.

### Correctness of the asynchronous-I/O/direct-cache version

Wasm SHA-256 `880bdf78fef7e2d4e72406f25005ee81e68dab41db07b878a6627695c938e0fb`,
compiler/runtime fingerprint
`8b64f02e9e076a73b9c9c2dbbefc9da809a1acd74bc503e54600831a08713cff`:

- 173 supported riscv-tests + 266 Spike architecture signatures: **439/439**,
  threshold 1; every test executed generated instructions.
- Single-step differential: **2,000,000** attempts/boundaries, zero divergences,
  1,999,785 JIT instructions, 28.867 s, exact final RAM.
- Superblock differential: **20,000,005** attempts, zero divergences, 36.675 s,
  exact final RAM (see JSON for boundary count and JIT retirement).
- Integration: DHCP/DNS/HTTP, lazy disk byte 90, facts, two snapshot restores pass;
  snapshot 53,031,316 bytes. This also exercises the asynchronous disk path.
- Native instrumented platform suite: **34/34**; supported upstream suite passes
  with the existing explicit Sdtrig exclusion. TS typecheck and 17 tests pass;
  inline-TLB counter assertions separately rerun with all 11 codegen tests passing.

Evidence: `R2-diag-fixed-{gates,single,trace,integration}.json/.txt` and
`R2-diag-{platform,isa}.txt` under `web/public/rv64/results/`.

### Native instrumented control (complete)

`R2-diag-native.txt` / `R2-diag-native-summary.json`: 900.000 s,
31,303,958,308 retired instructions, **37.876 busy MIPS / 34.782 effective MIPS**,
8.816 ms measured idle sleep. No Ready or probe completion; Kubernetes operation
latencies are unavailable. All virtio devices remain status `0xf`, block queue
432/432 completed. Containerd reports boot at 191.822 s, apiserver version at
286.889 s; local TLS timeouts persist. This binary is the native interpreter,
not a native JIT performance claim. It used the uncompressed probe medium.

Wall-time rates: 1,107.95 TLB flushes/s (59.05 FENCE.I, 583.59 SFENCE.VMA,
465.16 actual satp changes, 0.147 SBI remote fences); 214,960 page walks/s over
81.08 M Rust translation requests/s (0.265%). Timer interrupts 559.85/s,
external supervisor interrupts 9.06/s, software/IPI and illegal traps zero;
page faults 165.22/s, user ecalls 1,063.31/s, intercepted SBI ecalls 0.299/s.
A helpers 66,355.8/s, F/D helpers 34,288.3/s, MMIO 19.81/s. Code-page-write
counter averages 4,268.55/s but remains at ~196k until late in the run, then rises
as previously executed physical pages are reused. Existing bitmap bits were
sticky after invalidation: repeated data stores kept taking the code-page slow
path even when no code of that generation remained valid.

### First complete browser fix run (still not accepted)

`R2-diag-fixed-kuberoot.json/.txt` and `R2-diag-fixed-summary.json`: no Ready or
completion at 900 s. Last sample 899.049 s: 52,499,285,904 retired instructions,
670.480 s core.run, **78.301 busy MIPS / 58.394 effective MIPS**, 88.17% JIT.
Relative to the prior handoff's 67.901 busy MIPS, this is +15.3%, but this is a
new instrumented run, not a same-build statistical A/B estimate. HTTP I/O no
longer directly blocks core.run: 306.097 s asynchronous disk activity overlaps
CPU/idle; Atomics.wait totals 190.154 s, compiler yields 16.332 s.

There were **436,358 installed functions and 6 full code-cache clears** at the
65,536-function limit. The physically stable hotness key admits more code than
the old context-resetting hotness key; the global-clear policy then thrashes.
Average JIT dispatch length is **11.48 instructions**, context hit rate 98.32%,
inline TLB miss rate ~0.998%; queue limit never reached. Compile latency mean
20.686 ms, max 1,146.235 ms. This distinguishes capacity eviction from a persistent
compiler backlog. Store-code-page counts reached ~5.49 million late in the run;
SFENCE/satp still do not destroy compiled functions. No Kubernetes operation
latencies are claimed.

Prepared the next fixes after preserving this result: module-granularity LRU
using the most recent execution of any function in each batch, with Rust entries
removed before table slots recycle; clearing the live-code bitmap on generation
invalidation until refetch; and loading/spilling only executed prefixes in
acyclic blocks. Backedge blocks retain conservative register liveness. The
module eviction test checks hot-module preservation and slot reuse ordering;
the page-reclamation regression checks repeated stores and DMA followed by
refetch/self-modification. Final correctness and workload measurements follow.

### Bounded eviction / live-page / prefix-liveness correctness

Wasm SHA-256 `130f7ba19e3ceb39d1d228a8e57af4423678d8a6d57e8bcc9bc5ef17887d203d`,
compiler/runtime fingerprint
`9142b779f397b7335ae283cc687e1a6e9b204c4eda00b853744dee9fb0b058fd`:
439/439 forced-JIT cases pass. Single-instruction differential passes 2 M
comparisons with **19,456 evicted functions**; normal differential passes
20,000,005 attempts / 2,186,625 boundaries with **3,584 evictions** and exact
final RAM. Both traces deliberately use a **1,024-function cache** to exercise
recycling repeatedly. No full cache clears occur. Integration passes again.
Native platform regressions are **35/35**; TypeScript typecheck + **18 tests** pass.
Evidence prefix `R2-capacity-` (gates/single/trace/integration/platform).

The first repeat native launch was invalidated and stopped: the existing native
UDP bridge intentionally pins its first peer's UDP source port and rejected the
new runner's port. The guest remained waiting for DHCP, not CPU-bound. Its partial
log is retained as `R2-capacity-native-stale-bridge.txt`, excluded from performance
comparisons. Restarted both the bridge and runner for the actual repeat.
Reproduction must start a fresh native bridge for each native boot process.

### Host contention and the next measured hot path

The capacity/prefix-liveness browser run timed out at 900 s: **37.678 busy MIPS**,
26.424 effective MIPS, 94.54% JIT. This is **not a valid isolated speed regression
comparison**: the 16-GiB Mac was concurrently building other projects, had
7,435 MiB swap in use and heavy memory compression (`R2-capacity-host-memory.txt`).
No unrelated processes were stopped. The engine did eliminate full cache clears:
278,818 compiled / 213,602 selectively evicted / 65,216 installed at the last
sample, with zero global clears. Compiler mean latency 21.379 ms, max 2,906.515 ms.

A 60-s V8 profile during the Go phase is retained as `R2-capacity-profile.json`
and `R2-capacity-profile-summary.txt`. Of 236,424 hart samples, **17.84% self samples
were jit_block and 8.12% Cpu::run** (time-weighted values 16.60% and 8.23%).
This supports removing Rust dispatch between hot short blocks; profiling under
host contention is not an exact isolated wall-time attribution. Exact A/F/D
helpers were not the dominant sampled cost. Context switching and SFENCE do not
clear generated code; global clears were capacity policy, now fixed.

Repeat native control with a fresh bridge: 900 s, 30,704,237,649 instructions,
**37.387 busy / 34.116 effective MIPS**, no Ready. Live-page invalidations fall
from 4,268.55/s to **0.447/s**; native speed remains essentially unchanged, as
expected for an interpreter without generated-store exits. Native and pod V8
briefly overlap on the 4-CPU pod; these are observational samples, not paired
statistical CPU-only estimates. Evidence: `R2-capacity-native*.txt/.json`.

### Guarded tail chaining and final CPU gates

Generated wasm can now return-call another installed block through the shared
function table, keeping the same budget/frame. It requires a current complete
Sv39 fetch-TLB/PMP hit, canonical translated target identity, matching physical
page generation, a live slot and enough remaining budget. Otherwise it returns
to Rust. Unsupported instructions and precise helpers still end at Rust. The
chain cache is invalidated before eviction slot reuse. Chained calls refresh
module recency; counters and attempted/retired counts accumulate across the
whole chain. The compiler feature-detects wasm tail calls and falls back to
ordinary dispatch on engines without them. A test executes 10,000 chained
blocks without stack growth and rejects changed context/satp/PMP/generation/slot.

Final wasm `4a64e607fe330717532349a50ea0c112aa4b225ad51a37fb2a4514e372feb8fe`,
compiler/runtime `3830774ab1870dd7b1e16b84b8d0bda2ee5a3c2e7cdcbc8f75360a1929d8d7a5`:

- **439/439** threshold-1 ISA/signature cases pass.
- **2 M** single-instruction comparisons, zero divergences; **20,000,005**
  superblock attempts, zero divergences and exact RAM, including **1,402,784
  successful tail chains**. Both use the 1,024-slot eviction stress configuration.
- Network/lazy-disk/snapshot integration passes; TS typecheck and **20 tests** pass.
- CoreMark CRC passes: **746.530 busy / 675.530 effective MIPS**, shell **3.473 s**,
  benchmark command **21.441 s**. CoreMark auto-calibrates iteration count; its
  command duration alone is not a throughput comparison. This is one sample,
  not a same-build uninstrumented interpreter speed gate.

Evidence prefix `R2-chain-` (gates/single/trace/integration/coremark). The full-node
probe now has an 1,800-s observation limit so that late readiness, if attained,
can be followed by the real kubectl/pod checks. A 900-s checkpoint will also be
reported. No Ready or Kubernetes latency is inferred from CoreMark.


### Shared chain dispatcher: memory regression found and corrected

The first tail-chain implementation imported the shared 65,536-slot table into
**every** generated module. Pod Node 18.20.4 (V8 10.2) creates per-instance table
metadata: the pod was OOMKilled (exit 137) at 2026-11-21T19:55:37Z. Its PVC was
preserved and the same rv64-dev manifest recreated. The concurrent Chromium
probe consequently lost its forwarded media server at 563.458 s. Its partial
74.944 busy MIPS is **not** a completed 900/1,800-s measurement. Evidence:
`R2-chain-pod-oom.json`, `R2-chain-pod-v8.txt`, `R2-chain-kuberoot.txt`.

Generated batches now import a single direct `next` function. Only one shared
wasm dispatcher imports the function table and performs guarded indirect tail
calls. A bounded Node-18 microprobe with 128 modules and 65,536 slots measured:

| Table import design | Instantiate time | RSS increase |
| --- | ---: | ---: |
| Each generated module imports table | 215.613 ms | 170,655,744 bytes |
| One shared dispatcher imports table | 2.854 ms | No measured RSS growth |

The second measurement does not imply zero allocation: its JS heap grows from
3.458 to 3.646 MB inside already committed pages. The first grows from 2.7 to
70.3 MB. Script: `scripts/rv64-table-stress.mjs`; artifacts:
`R2-table-inline.json`, `R2-table-shared.json`. The pod host now records RSS,
wasm memory, module count, Node/V8 and build hashes, and stops at 4 GiB RSS to
avoid another whole-pod OOM. The production/browser fallback remains available
when wasm tail calls are unsupported.

Latest shared-dispatch build: wasm unchanged
`4a64e607fe330717532349a50ea0c112aa4b225ad51a37fb2a4514e372feb8fe`,
compiler/runtime source
`8ca61a3d67d32b90a63a76579f49dc122374e5cbbd208a693a05f7cdddef1128`.
All **439/439** threshold-1 cases, 2 M single-instruction and 20,000,005
superblock comparisons pass again with exact RAM, including 1,402,784 chains
and deliberately constrained 1,024-slot eviction. Integration passes. Latest
CoreMark: **514.396 busy / 462.743 effective MIPS**, CRC correct, shell **5.009 s**,
1,415.428167 iterations/s. Host contention means this and the earlier 746.530
sample are not a controlled comparison of dispatcher designs. Evidence prefix:
`R2-shared-`. Full-node Chromium and pod V8 observations are in progress.


Pod JIT reproduction is now wrapped by `bash scripts/rv64-pod-jit.sh 1800`.
It bundles only TypeScript locally, transfers those bundles and the Node host,
and runs the existing pod-built wasm with a fresh loopback bridge. It does not
build Rust locally or create a native Rust JIT. Prerequisites are the prepared
media, pod wasm artifacts, and Node in rv64-dev. `rv64-metrics.py FILE --stream
--until 900` summarizes streamed Chromium metrics; `--pod-v8` accepts the Node
log. Final browser JSON retains one-second samples, avoiding the coarser
30-second streaming checkpoint. `diskActiveMs` overlaps CPU work and must not
be added to busy/idle totals.


At the shared-dispatch Chromium 900-s checkpoint (stream sample 899.214 s):
**109.795 busy / 80.408 effective MIPS**, 72,304,353,775 retired, 87.03% JIT,
77.56 instructions per Rust dispatch, 11.05 per generated block, 93.97% context
hits. Compiler latency mean/max 13.925/266.105 ms; 592,813 compiled, 542,158
evicted, 50,655 installed, no full clears. Ready remains absent. At guest
598.305 s, kube-apiserver's `scheduling/bootstrap-system-priority-classes`
post-start hook fatally timed out after repeated loopback TLS handshake
failures; kinit restarted it. These are observed blockers, not proof of a
specific TLS implementation bug. Evidence: `R2-shared-kuberoot.txt` and
`R2-shared-kuberoot-900-stream-summary.json` (final one-second sample will be
reported separately).

The remaining cache turnover justifies a bounded capacity experiment now that
per-module table mirrors are eliminated. The pod V8 65,536-slot control will
stop after its 900-s telemetry sample; a fresh boot with 262,144 slots follows
for 900 s, retaining the same threshold 50, wasm, compiler and 4-GiB RSS guard.
This is configured through `RV64_JIT_CACHE_LIMIT` in the diagnostic wrapper;
the browser default is not changed during its running observation.


### Pod 900-second result and rejected cache-capacity experiment

Shared dispatcher, 65,536 slots, Node 18.20.4/V8 10.2, x86_64 AMD EPYC 9454,
pod quota 4 CPUs / 8 GiB: **64.897 busy / 43.738 effective MIPS** at 900.239 s,
39,374,741,560 retired, 90.92% JIT, 65.99 instructions per Rust dispatch.
Compiler: 489,122 compiled, 427,405 evicted, 61,717 installed, mean/max latency
73.227/1,669.958 ms, pending 0, no full clears. No Ready. The process was
intentionally terminated after this sample to run the next experiment; exit
143 is **not** a guest crash/OOM. Against the earlier same-pod no-chain result
60.12 busy / 41.227 effective MIPS, this is a modest improvement, not the much
larger Chromium improvement. V8 versions and host architectures differ, so the
browser and pod rates are not a hardware-controlled comparison.

The 262,144-slot experiment was **rejected**: at its last sample (460.119 s),
135,103 installed blocks, no evictions, **60.173 busy / 46.156 effective MIPS**,
21.24 B retired, RSS 4,269 MB. The 4-GiB RSS guard then stopped the diagnostic
cleanly before a pod OOM. At the matching 460.171-s checkpoint, the 65,536-slot
control achieved **73.256 busy / 53.550 effective MIPS**, 24.64 B retired.
JIT share was nearly unchanged (92.69% versus 92.25%). Eliminating these
capacity evictions alone does not establish a speedup; the larger footprint
and broad Go code working set remain a tradeoff. Default capacity stays 65,536.
The larger-cache run is partial and cannot provide a 900-s or Ready result.
Evidence: `R2-shared-pod-v8*.json/.txt`, `R2-large-pod-v8*.json/.txt`,
`R2-shared-pod-host.txt`. Future diagnostic failures also emit a final RESULT
with error and counters before cleanup.


### Counter interpretation at the fixed Chromium 900-s checkpoint

| Counter | Measured value |
| --- | ---: |
| Rust fetch/slow-path TLB walk fraction | 1.278% |
| Generated aligned-Sv39 TLB guard miss fraction | 0.906% |
| TLB flushes | 1,040.525/s |
| FENCE.I / SFENCE.VMA / satp changes / SBI fences | 63.507 / 482.061 / 491.030 / 3.928 per s |
| Store / DMA live-code-page invalidations | 3.248 / 0 per s |
| Whole generated-cache clears / compile queue full | 0 / 0 |
| Instruction / load / store page faults | 7.036 / 29.973 / 147.672 per s |
| Timer / external interrupts | 672.910 / 12.612 per s |
| Software/IPI / illegal traps | 0 / 0 |
| SBI ecalls / user ecalls | 4.080 / 1,271.841 per s |
| MMIO slow accesses | 26.895/s |
| A / aggregate F-D exact helper calls | 169,014.643 / 47,409.912 per s |
| Atomics.wait / compiler-event-loop yielding | 200.827 / 15.383 s |
| Disk requests active (overlaps other time) | 344.902 s |

The original apparent write-invalidation storm was dominated by permanently
marked **formerly** executable pages, not demonstrated Go data/text sharing.
The existing physical code map already survived SFENCE; removing redundant
context-dependent direct-entry keys and preserving bounded hot modules avoids
extra lookup/recompilation work. No whole-cache SFENCE or satp storm is observed.
The kernel config is HZ=250 with NO_HZ_IDLE; delivered Sstc timer events include
high-resolution timers and are not equivalent to kernel HZ. Timer counts alone
do not prove timer overhead dominates. Neither queue overflow nor exact A/F/D
helpers was supported as the leading bottleneck; the sampled dispatch cost and
short blocks supported guarded tail chaining. Full node startup remains blocked
by repeated local API TLS/post-start timeouts despite the throughput gain.


### Final verification and handoff

The Chromium full-node harness completed its **1,800-s observation limit** with
`type: error`, `kuberoot probe timeout`; it did not pass the full-node gate.
Last exact one-second sample, 1,798.702 s: **130.734 busy / 109.389 effective
MIPS**, 196,758,577,643 retired, 88.06% JIT, 85.41 instructions per Rust dispatch,
1,314,424 compiled, 1,249,278 evicted, 65,146 installed, mean/max compile latency
13.480/273.335 ms, no whole-cache clears, no queue overflow. Atomics.wait totals
202.101 s; overlapping disk-active time 381.154 s; compiler yielding 30.049 s.
The final counter series confirms the same 899.214-s checkpoint reported above.
The 1,800-s rate is a different workload interval and must not replace the
900-s before/after comparison. Evidence: `R2-shared-kuberoot.json`,
`R2-shared-kuberoot-summary.json`, `R2-shared-kuberoot-900-summary.json`.

A final sequential, same-wasm/source CoreMark pair passes the enforced speed
gate (>=3x and >=250 busy MIPS), with correct CRCs:

| Current build | Interpreter | JIT |
| --- | ---: | ---: |
| Busy MIPS | 59.446 | **679.594** |
| Effective MIPS | 58.731 | **618.407** |
| Shell boot | 9.289 s | **3.401 s** |
| Command time (auto-calibrated iterations) | 19.023 s | 23.424 s |

Busy speedup **11.432x**. Evidence: `R2-shared-interpreter.json/.txt`,
`R2-shared-speed.json/.txt`. These are separate microbenchmark results, not
full-node acceptance. Build hashes remain the shared-dispatch hashes above.
The first local browser launch was blocked by the sandbox's macOS MachPort
restriction; the approved retry ran sequentially with one headless browser.

Final correctness evidence: 439/439 forced-JIT ISA/signature cases; 2 M
single-instruction and 20 M superblock trace comparisons with exact final RAM,
including 1,402,784 chains and 1,024-slot eviction stress; 35 native platform
tests; 20 TS tests and typecheck; network/disk/snapshot integration; clean
`git diff --check`. Rust execution stayed in rv64-dev throughout.

**Remaining:** Node Ready, pod start and kubectl latency are not achieved or
measurable. Repeated local TLS timeouts, slow kine SQL, and fatal apiserver
post-start hooks persist even with faster execution; those errors do not by
themselves isolate the underlying Go hot functions or prove a TLS correctness
bug. The Go workload still uses many short blocks and a broad code working set;
raising cache capacity alone failed the bounded memory/performance experiment.
A native Rust JIT backend does not exist; the native interpreter repeat remains
37.387 busy MIPS, distinct from the 64.897-MIPS pod wasm/V8 result. No security
checks, guest timeouts, clock rate or workload services were weakened to obtain
a Ready marker.

The owned media server and loopback port-forward were stopped, the temporary
local media descriptor removed, and no measurement Node/Chromium process was
left running. The original rv64-dev PVC and guest/build artifacts are retained
for reproduction. All edits remain uncommitted on `feat/rv64-r0`.
