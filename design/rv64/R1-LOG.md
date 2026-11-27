# R1 implementation log

## 2026-11-21 — environment preflight

Read both R0 measurement documents. Branch: `feat/rv64-r0`; no commits.
All Rust compilation/testing is restricted to `rv64-dev` in workshop.
Namespace quota before creation: CPU requests 2350m/3200m, CPU limits
17.5/32, memory requests 3424Mi/64Gi, limits 23168Mi/64Gi. No storage
quota is declared. LimitRange defaults ephemeral storage to 2Gi.
Selected 15Gi `replicated` PVC and 500m/2Gi requests, 4 CPU/8Gi limits.

R1 acceptance remains pending: RV64GC/B/Sstc, privileged 1.12/Sv39,
SBI v2, devices (including 9p in the R0 plan), upstream ISA suites,
native and browser Linux shell boot, CoreMark comparison. No test pass
counts or performance results are claimed until measured.

## CPU and native milestones

- Created `rv64-dev` and `rv64-dev-work` (15Gi replicated PVC). Official image
  resolved to `rust@sha256:e51d0265072d2d9d5d320f6a44dde6b9ef13653b035098febd68cce8fa7c0bc4`.
- Installed Rust 1.85.1 wasm target, wasm-bindgen-cli 0.2.100, GNU riscv64
  GCC 12.2.0, dtc, Binaryen. Caches/builds/toolchains on `/work`.
- riscv-tests commit `3df703cd52d5f0d8224e3c50bf03c6cb70efff98`, env submodule
  `6de71edb142be36319e380ce782c3d1830c65d68`. Built 174 ELF tests from ui/um/ua/
  uf/ud/uc/mi/si and Zba/Zbb/Zbs. First run 104 passed/70 failed; subsequent
  runs 141/33, 149/25, 172/2; final CPU run **174/174 passed**. These are the
  physical-environment (`-p-`) tests, not riscv-arch-test certification.
- Exact F/D uses rustc_apfloat 0.2.3 and ieee-apsqrt 0.1.1 (pure Rust, native
  and wasm), including rounding, flags, NaN boxing and canonical arithmetic
  NaNs. Sources: https://docs.rs/rustc_apfloat/ and https://docs.rs/ieee-apsqrt/.
- Added 12 platform tests: **12/12 passed** (Sv39 rights/A/D/TLB/MPRV,
  time independent of instret, Sstc/WFI, cross-page instruction, precise trap,
  SBI, virtio-console/PLIC, malformed queue, DTB header).
- Kernel from builder (read only): Linux 6.18.62, `vmlinuz.efi` SHA-256
  `39759207282480c0db1e2f9d3cc7e3f9162a8406572b3e535ac1284a3ea5c6c7`.
  Native first boot failed because DTB was placed in kernel BSS; fixed by
  reserving 64MiB below DTB. Kernel Image memory size exceeds its file size.
- Full kuberoot initramfs (SHA-256
  `fc8c97c42c531771dce1552df39cc65db6a8fea36a42f09af507642594a60a86`)
  contains kinit + squashfs, not a shell. Its 294MiB unpacking exceeds the
  512MiB test machine. Kept the kuberoot kernel and packaged the R0-pinned
  Alpine 3.24.4 minirootfs (SHA-256
  `010683db6c73b3ad1c334fc8f93f64ae748ef67ae6d69e964929aeaf8517bff3`)
  with `/init` mounting proc/sys/dev and starting `/bin/sh`.
- **Native Linux shell boot passed: 13,522ms**, command echo marker returned
  via virtio-console. 512MiB guest, 440,808,404 retired instructions at
  acceptance; server wall time 13.546s. This is NOT an M4 browser comparison.
- Native CoreMark (same prebuilt static riscv64 binary as R0): validated,
  **92.034806 iterations/s**, wall 13.299s, effective **33.391 MIPS** during
  the command. This run shared CPU with Spike compilation, so it is a
  correctness/smoke measurement, not a controlled performance claim.

## Browser/tooling milestones

- TypeScript typecheck passed; 3 ring-buffer tests added.
- wasm built entirely in pod. Binaryen 108 misexports the externref table
  (`__wbindgen_export_0` changes from table 1 to table 0), causing Chromium
  Table.grow failure. Upgraded to official Binaryen 123 on PVC; archive SHA-256
  `e959f2170af4c20c552e9de3a0253704d6a9d2766e8fdb88e4d6ac4bae9388fe`.
- Transfers through kubectl streams repeatedly truncate/reset. Sync/copy now
  uses gzip tar; wasm copy verifies SHA-256 in a staging directory before
  replacing artifacts. Do not treat an old browser artifact as the new build.
- Local Chromium requires sandbox escalation (macOS MachPort restriction).
  No Rust installation/build, VM, or Docker was used on the Mac.
- Temporary HTTP process on rv64-dev port 8081 serves only `/work/guest`
  (public guest/tool artifacts). Temporary `rv64-dev-files` LoadBalancer
  created to work around very slow API streaming; remove after transfer.

## Outstanding acceptance at the first boot milestone

At that point browser boot/CoreMark, Spike and architecture signatures were
pending. Later sections supersede that status. Kimi's verification material
subsequently arrived and was used below. The final remaining gaps are listed
at the end of this log.

## Conformance follow-up using Kimi's verification material

Read CONFORMANCE-PLAN.md, SPEC-CHECKLIST.md and TRACE-DIFF.md. The checklist is
verification guidance, not a reason to advertise unimplemented extensions.
Kept PLIC `#interrupt-cells = <1>` (Linux binding), and did not advertise Svadu
without its ADUE control. Sstc is advertised in the legacy ISA string accepted
by this kernel; timer-use counters were added to verify the path directly.

Corrected the initial upstream count: `pmpaddr` trivially passed against writable
PMP register stubs, which was misleading. Removed those stubs: R1 has no PMP
entries, so that one upstream test (which explicitly assumes PMP exists) is now
reported UNSUPPORTED. **Final upstream: 173 passed, 0 failed, 1 unsupported.**
Platform regressions: **15 passed**. Spike also executed all 174 upstream ELFs
successfully (Zicntr and Zicclsm must be explicitly enabled in its ISA string).
This is result comparison, NOT instruction-by-instruction trace equivalence.

Pinned riscv-arch-test 3.0.0; directly compared Spike signatures for 266 built ELFs
from rv64i_m/I,M,C,D with TEST_CASE_1. Initial 245/266 exposed two engine issues:
C.LUI rd=x0 HINT decoding and missing FP OF on saturating overflow in apfloat.
Patched both, with two focused regressions and a documented licensed vendor patch.
**Final direct architecture signatures: 266 matched, 0 failed, 0 build failures.**
This limited old-corpus run is not full RISCOF/ACT4 certification: A, B and extra
conditional cases are not covered by this architecture-signature run.

Browser smoke now passes with Binaryen 123: a0=42, 2 retired instructions, WFI,
crossOriginIsolated=true, Chromium 159.0.8154.6. Guest artifact download is being
completed with 16KiB SHA-256-verified resumable chunks because large transfers
repeatedly stall/reset. Temporary endpoint uses NodePort 32187; LB IP remained pending.

## Final measured checkpoint (2026-11-21)

Linux 6.18.62-kuberoot boots to an Alpine 3.24.4 shell in both native pod and
local headless Chromium. The same prebuilt CoreMark executable as R0 validates
its CRCs in both. No Rust build or installation occurred on the Mac.

| Measurement | R1 | R0 TinyEMU |
| --- | ---: | ---: |
| M4 Chromium CoreMark iterations/s | 141.703273 | 569–707; large slice 1029 |
| M4 Chromium CoreMark busy MIPS | 51.029 | 287–410 |
| M4 Chromium CoreMark effective MIPS | 50.693 | depends on slice/yield loss |
| M4 Chromium boot to shell | 11.521s | 0.69–0.99s |
| Native pod CoreMark iterations/s, final run | 110.381368 | not comparable to M4 |
| Native pod benchmark effective MIPS | 40.010 | not comparable to M4 |

One final browser sample, not a statistical benchmark. Boot comparison uses
different kernels and initramfs (R0 Linux 4.15 vs R1 Linux 6.18.62), so it is an
end-to-end observation, not an isolated CPU regression estimate. CoreMark's
timed loop was 14.114s; the complete command including auto-calibration took
22.105s. Retired-instruction MIPS covers that complete command. Native final
command took 28.143s; total boot plus command 41.751s. The earlier standalone
native shell acceptance took 13.522s.

Browser busy/effective ratio is 99.34%, confirming that the Worker eliminates
the large timer-yield loss. Interpreter throughput is nevertheless **below the
R1 acceptance target (~400 busy MIPS)**, by about 7.8x. R1 is not accepted.
Browser recorded 16,226 stimecmp writes; native recorded 20,417 and zero SBI
TIME calls, confirming this kernel uses Sstc. The time source is host elapsed
time, not retired instruction count.

Evidence: `R1-browser-result.json` includes the complete guest console and
browser metadata; `R1-test-results.txt` records native/signature/test summaries.
Large guest images and wasm remain gitignored in `web/public/rv64/`.
TypeScript typecheck passed, SAB ring tests **4/4 passed**. Rust platform tests
**15/15 passed**, upstream **173 passed / 0 failed / 1 unsupported**, direct
architecture signatures **266/266 matched**. These counts are separate suites.

Temporary Service `rv64-dev-files` was deleted and its HTTP process stopped
after verified transfers. Pod `rv64-dev` remains Running, zero restarts; PVC
`rv64-dev-work` uses 9.3Gi of 15Gi (4.7Gi available). No other pod was changed.

## Remaining scope / review limitations

- Throughput target is not met; profiling and interpreter optimization remain.
- Full architecture conformance, privileged-spec corner cases and a Linux
  instruction-by-instruction differential trace have not been established.
- CLINT currently exposes RV64-wide mtime/mtimecmp plus 32-bit MSIP; writable
  mtime and split 32-bit timer accesses are not implemented.
- virtio blk/net/console/rng models exist and Linux enumerates them. Console
  works through real Linux virtqueues. Full disk/network/RNG integration and
  malformed-device conformance need broader tests. Block storage is resident
  memory, not the specified lazy HTTP + Cache Storage backend. No virtio-9p.
- Network SAB frame rings connect to the existing L2Switch interface; no
  multi-guest traffic acceptance run yet.
- Machine wrapper is behind VITE_RV64=1 and absent from lessons. exec/console,
  lifecycle and network wiring exist; facts() is explicitly unimplemented.
  Snapshot/restore are explicitly deferred to R3, not silently emulated.
- Single hart only; no PMP entries. The pmpaddr upstream case requires PMP
  and is explicitly unsupported. Test success does not imply full RV64GC or
  privileged 1.12 certification.

This is a reviewable interpreter/boot checkpoint, not a completed R1 stage.
No commit was made.

## Second pass — in progress (2026-11-21)

Baseline checkpoint: Chromium 51.029 busy MIPS, 141.703273 CoreMark/s,
11.521 s boot; native 110.381368 CoreMark/s. No commits in this pass.

Step 1 (RAM width loads/stores and physically indexed page decode cache):
- Chrome without profiling: **65.877 busy MIPS**, 65.347 effective MIPS,
  **182.926829 CoreMark/s**, **9.169 s boot**. Evidence: R1-cache-result.json.
- Native: **123.107226 CoreMark/s**, 43.791 effective MIPS during command,
  37.968 s total boot + command (command 25.652 s).
- Separate Chrome tracing run: 45.177 busy MIPS, 116.042936 CoreMark/s,
  9.480 s boot. Profiling overhead is substantial; do not compare this as
  an unprofiled speed result. V8 sampling trace is in gitignored
  web/public/rv64/results/worker-trace.json (110 MiB). Top sampled wasm
  functions: [49] 178534 samples, [17] 35877; JS hart loop 1736 samples.
  Optimized artifact strips Rust names, so these are function indexes,
  not source-level attribution. Wasm execution dominates JS crossings.
- Installed linux-perf in rv64-dev. `perf stat -e task-clock true` fails:
  `No permission to enable task-clock event` (perf_event_paranoid=3).
  No node sysctl/capability changes attempted. Native perf profiling is blocked.

Implemented next (verification ongoing): dense decoded common-integer dispatch,
inlined TLB hit path with cold page walker, 16 PMP entries (TOR/NA4/NAPOT,
priority/partial-match/locks/MPRV/page-table checks), split CLINT timer accesses,
versioned eager sparse snapshots including CPU/RAM/devices/virtqueues/disk,
lazy HTTP range disk with Cache Storage immutable base and private writable
chunks, facts() using the v86 dt.facts/v1 collector/parser. Snapshot restore
invalidates derived caches; host network peers are outside the checkpoint.
PMP reference: https://docs.riscv.org/reference/isa/v20240411/_attachments/riscv-privileged.pdf.

Builder artifacts exist: kernel SHA-256 remains
39759207282480c0db1e2f9d3cc7e3f9162a8406572b3e535ac1284a3ea5c6c7;
new initrd SHA-256 be161151dcbbb61b1b121ea6df122bbda5feb6b9829eda607e40910244887265.
Builder's existing read-only artifact HTTP service works at
http://builder:8080/riscv64/ (inside the namespace). No builder changes.
REVIEW-R1.md has not appeared at the latest check.

Second-pass intermediate results (before final cache allocation fix):
- Dense decoded dispatch + PMP: Chrome 52.967 busy MIPS, 143.245953
  CoreMark/s, boot 10.330 s; native 36.159826 CoreMark/s, 13.806 MIPS.
- TLB caches full-page PMP authorization; cold page walker separated:
  Chrome **72.728 busy MIPS**, 72.049 effective MIPS, boot **8.161 s**.
  Native remained slow (37.371535 CoreMark/s, 14.216 MIPS); investigated
  allocation of the decoded page via a large stack temporary.
- Exact new-source checks: **25 platform tests passed**, **174/174 upstream**,
  **266/266 direct Spike signatures**. This is available-suite coverage,
  not complete privileged/virtio certification. Typecheck and 6 TS tests pass.
- Browser integration: real Linux read from a lazy 512-byte HTTP disk,
  real facts collection, sparse snapshot (~52.5 MB), guest file mutation,
  restore and facts verification all passed (R1-integration-result.json).
- The new full kuberoot initrd mounts the media FAT partition and attaches
  its squashfs via loop0; no shell/readiness marker before 120 s. Thus a full
  kuberoot node boot is NOT yet accepted. Wrong initial squashfs path was
  corrected to `kuberoot.root=PARTLABEL=KUBEROOT-MEDIA:/kuberoot/rootfs.squashfs`.
- No RV64 lesson currently requires shared host files; conditional 9p work
  was not added. There is still no virtio-9p device.

The native regression was reproduced and removed by allocating decoded pages
as boxed slices directly on the heap (no large `[Decoded; 2048]` stack temporary
in the instruction fetch function). Native CoreMark recovered from 37.371535
to **114.090131 iterations/s**, **41.248 effective MIPS**, boot+command 39.103 s
(command 27.275 s; boot approximately 11.828 s). Native host load is uncontrolled
(load average ~7–9); use browser measurements for the M4 comparison.

Full published kuberoot media now reaches **stage-two kinit** after the cache
allocation fix: `[kinit] kuberoot booting, kernel 6.18.62-kuberoot, uptime 42s`,
`distribution edge`. FAT → loop0 → squashfs → switch_root succeeded. The native
harness has no network peer/DHCP server, so kinit then waits for DHCP and logs
`network failed ... unable to receive an offer`. This is a real full-root boot,
not a working Kubernetes node or shell acceptance. The artifact also reports
missing drbd.ko/drbd_transport_tcp.ko. Device diagnostics at 90 s: blk 2807/2807
completed requests, net TX 12/12, console TX 140/140, RNG 7/7; all status=0xf,
no pending device error. No builder changes or external network connections.

## Kimi review disposition (REVIEW-R1.md received during this pass)

Reviewed all D1–D22. Corrections were checked with focused regressions; the review's
suggestions are not blindly applied when they contradict normative behavior.

| Review item | Disposition |
| --- | --- |
| D1 | Added modern ISA base/extensions, Sstc property, CLINT node, PLIC maximum priority and dma-coherent. Added real menvcfg.ADUE control with A/D faults when disabled; advertised Svadu only after implementing it. |
| D2 | blk SEG_MAX/BLK_SIZE/FLUSH/config and synchronous overlay FLUSH; net MAC/STATUS/config and deterministic per-machine MAC. |
| D3 | STIP writes ignored while STCE=1. |
| D4 | Retained TM gating: Sstc 1.0 explicitly requires it, section 1.4. Regression covers TM=0/1. |
| D5 | Guest CSR writes already suppress only their own retirement; new regression proves 100 then 101. Also reset bookkeeping before execution so direct host write_csr calls do not suppress the next instruction. |
| D6 | Non-RAM misaligned store reports access fault 7. MMIO still requires valid aligned 32-bit transfers. |
| D7–D8 | SD derived from FS and read-only; unsupported endian/status fields hardwired to zero. |
| D9 | Not reproducible by a legal encoding: JAL/branches/C offsets are even, JALR clears bit zero, and C makes IALIGN=16. Regression uses an odd JALR input and verifies aligned target and link. |
| D10 | The 12 bytes are the required modern virtio_net_hdr, not a fake Ethernet header. Fixed its num_buffers to 1; runt TX frames are dropped without wedging the queue. |
| D11 | Added native --trace FILE instruction/trap/CSR/writeback records. Signature byte order retained: it already matches 266 pinned Spike references. A full boot lockstep run/reference adapter is still not claimed. |
| D12, D21 | PMP is expressly requested by the user; updated checklist scope. Existing 0x98/0x88 mask correctly checks L+A=TOR (not W/X); added locked-no-permission TOR regression. Proposed 0x81 would incorrectly test R. |
| D13 | Retained legal batch polling; QueueNotify is a hint to this polling device. No notification-driven performance claim. |
| D14 | Honor AVAIL_F_NO_INTERRUPT. |
| D15 | Probe all implemented legacy calls; single-hart legacy IPI/fences; PMU zero-counter stub; experimental implementation ID 0x10000000. |
| D16 | Claim must clear pending; retained that behavior. Separately fixed claim to ignore threshold and completion to respect context enable. |
| D17 | Stop queue processing on NEEDS_RESET and raise configuration-change IRQ. |
| D18 | FIOM=0 at boot. |
| D19 | Unimplemented tselect raises illegal instruction. Upstream rv64mi-p-breakpoint unconditionally accesses optional Sdtrig CSRs; now explicitly unsupported instead of the old fake pass via hardwired tselect. |
| D20 | Existing WARL mapping already converts mode 3 to legal vectored mode 1; regression added. |
| D22 | Explicitly establish MPP=S in firmware-less boot contract. |

Normative references for disputed findings:
[Sstc 1.0 §1.4](https://docs.riscv.org/reference/isa/extensions/sstc/_attachments/Sstc.pdf),
[VIRTIO 1.2 §5.1.6](https://docs.oasis-open.org/virtio/virtio/v1.2/virtio-v1.2.html),
[PLIC claim semantics](https://docs.riscv.org/reference/plic/plic-claims.html),
[privileged counter-write semantics](https://docs.riscv.org/reference/isa/v20240411/_attachments/riscv-privileged.pdf).


## Final review verification — second pass

Advertising virtio-net MAC exposed an integration bug missed by the earlier
register-level tests: Linux reads config with readb, whereas transport registers
require aligned 32-bit access. Fixed byte/halfword reads specifically for the
virtio device-config area and added a Linux-style MAC/status regression.
The intermediate panic is not a successful boot measurement.

Final pod checks: **33 platform tests passed**, **173 upstream passed,
0 failed, 1 explicitly unsupported** (Sdtrig breakpoint test; PMP test now
executes and passes), **266/266 pinned Spike architecture signatures matched**.
Native --trace smoke produces instruction/register/CSR records on rv64ui-p-addi.
TypeScript typecheck and **6 TS tests passed**. Evidence:
`R1-review-test-results.txt`. This is available-suite and review coverage,
not exhaustive device/privileged certification or full boot lockstep tracing.

Final optimized wasm: 236000 bytes, SHA-256
`183cc9e3a8c99dc137b0b3005dac5f8922130cc854e3e8fd1f3f79264a3168b5`.
Native CoreMark: **115.121165 iterations/s**, **41.582 effective MIPS**,
command wall **27.051 s**, boot+command **38.969 s**. Boot overlapped cleanup of
the earlier failed native run; this is not a controlled native speed comparison.
All Rust builds/tests were run in rv64-dev; no commits.

Final Chromium 159 measurement (same M4, one instance, unprofiled):

| Metric | R1 checkpoint | Final after review | Change |
| --- | ---: | ---: | ---: |
| CoreMark busy MIPS | 51.029 | **71.466** | +40.0% |
| CoreMark iterations/s | 141.703273 | **198.399577** | +40.0% |
| Boot to shell | 11.521 s | **8.130 s** | -29.4% |
| Effective CoreMark MIPS | — | **70.848** | — |

Evidence: `R1-review-browser.json`; earlier step measurements remain above.
The **400 busy MIPS target is NOT met** (final result is 17.9% of target).
Chrome profile (`R1-profile-summary.json`, taken before review fixes) still puts
most CPU samples in engine_run, address translation and memory access. Native
perf was attempted but denied by the pod/host perf permissions
(`perf_event_paranoid=3`, task-clock denied); host policy was not changed.
No SIMD or unsafe unchecked RAM accesses were introduced. Timer/device polling
is batched at the host run boundary; instruction-level pending-interrupt checks
remain to preserve CSR/trap behavior.

Final browser integration (`R1-review-integration.json`) passes real Linux
HTTP-backed block read, dt.facts/v1 collection and two consecutive restores,
including guest file rollback. Sparse whole-machine snapshot is 52,521,292 bytes.
Host network peers remain external; R3 lazy restore is not implemented.
Remaining: 400 MIPS, exhaustive conformance/boot trace comparison, conditional
9p if a future lesson requires sharing, and networked kuberoot node readiness.

Final full-media recheck after review fixes: published kuberoot again reaches
stage-two kinit at guest uptime **42 s**, distribution edge. At 75 s it is
waiting for DHCP (standalone native harness has no peer), with no device reset:
blk 89/89, net TX 11/11, console TX 146/146, RNG 7/7, all status=0xf.
The harness exits nonzero because its shell marker is absent; this does not
count as shell/node readiness. Missing DRBD modules remain an artifact issue.
Evidence: `R1-review-kuberoot.txt`. Temporary rv64-dev-files Service and the
/work/out HTTP server were removed. Final typecheck and git diff --check pass.
