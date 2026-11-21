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
