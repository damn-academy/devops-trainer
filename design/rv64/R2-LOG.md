# R2 work log — network prerequisite and incremental wasm JIT

2026-11-21, branch `feat/rv64-r0`. No commits. **R2 is partially implemented and not accepted.**
Rust builds and tests run only in `tenant-kuberoot/rv64-dev`, context
`admin@workshop`; Chromium runs locally, one instance at a time.

## Latest checkpoint (end of JIT pass)

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
