# RV64 engine — R1 implementation review (REVIEW-R1.md)

Date: 2026-11-21. Reviewer: Kimi Code CLI. Scope: read-only review of the Rust RV64
interpreter in `web/src/engine/rv64/core` against `design/rv64/verification/
SPEC-CHECKLIST.md`, `CONFORMANCE-PLAN.md` and the pinned normative specs
(RISC-V Unprivileged ratified 20191213, Privileged v1.12, SBI v2.0, ACLINT v1.0,
PLIC v1.0.0, VIRTIO 1.2). No source files were edited; nothing was built or run
on this Mac (per the no-build rule; test evidence is quoted from `R1-LOG.md`,
which was produced in the dev pod).

**Reviewed tree:** branch `feat/rv64-r0`, commit `6e0ffa8` **plus the uncommitted
second-pass changes present in the working tree** (synced from the dev pod:
PMP entries, physically-indexed decode cache `decoded.rs`, split CLINT timer
registers + writable `mtime`, lazy chunked disk, serde snapshots). Files were
byte-stable during the review. Where the second pass changed a finding, the
text says so.

Status legend: **OK** = implemented per spec · **PARTIAL** = implemented with
deviations · **MISSING** · **WRONG** = contradicts the spec/checklist.

## 1. Checklist item table

### 1. Unprivileged ISA (SPEC-CHECKLIST §1)

| Item | Spec section | Implementation | Status | Reason |
|---|---|---|---|---|
| RV64I base | Vol I `rv64.adoc` | `core/src/cpu.rs:412-534`, loads/stores `cpu.rs:288-347` | OK | W-variants sign-extend, 6-bit shamt, JALR clears bit 0, native misaligned access, ECALL/EBREAK/FENCE; store-misaligned cause quirk → D6 |
| M | Vol I `m-st-ext.adoc` | `cpu.rs:728-767` | OK | div-by-zero → −1/dividend, signed overflow wraps to −2⁶³/0 |
| A | Vol I `a-st-ext.adoc` | `cpu.rs:557-632` | OK | LR/SC reservation = exact (pa,size), cleared by trap/LR/SC/any store (all legal); SC returns 0/1; AMOs sign-extend W forms; cause 4/6 before translation; aq/rl ignored per checklist |
| F | Vol I `f-st-ext.adoc` | `core/src/float.rs:7-343` | OK | apfloat-exact ops, all 5 rounding modes + DYN, NV/DZ/OF/UF/NX mapping, NaN-boxing of 32-bit containers, canonical NaNs, FS=Dirty on writes; vendored apfloat carries a documented, Spike-validated overflow-flag patch (`vendor/rustc_apfloat/RV64-PATCH.md`) |
| D | Vol I `d-st-ext.adoc` | `float.rs` (64-bit paths) | OK | FLD/FSD, FCVT.S.D/.D.S with flags |
| C | Vol I `c-st-ext.adoc` | `core/src/compressed.rs:14-177` | OK | Full RV64C incl. FP forms; reserved encodings → illegal; shamt=0 C.SRLI/SRAI are HINTs and run as shamt-0 = NOP-equivalent (spec-conformant); C.LUI-x0 HINT handled (regression `compressed_lui_x0_is_a_hint`) |
| Zicsr | Vol I `zicsr.adoc` | `cpu.rs:633-655`, CSR file `cpu.rs:109-229` | OK | CSRRW always writes, CSRRS/C skip write at rs1=x0, privilege/nonexistent → illegal |
| Zifencei | Vol I `zifencei.adoc` | `cpu.rs:556` | OK | FENCE.I = no-op is safe in R1 (fetch goes straight from RAM); R2 translated-code cache must honor it |
| Zicntr | Vol I `zicntr.adoc` | `cpu.rs:139-141`, gating `cpu.rs:114-119`, `memory.rs:59-62` | PARTIAL | cycle/time/instret + M views + counteren gating + `time` from CLINT all OK; writing `minstret` wrongly absorbs the *next* instruction's retirement (`cpu.rs:222-225`, `379-382`) → D5 |
| Zihpm | Vol I `zihpm.adoc` | (read fallthrough `cpu.rs:158`) | OK (as OUT) | hpmcounter reads raise illegal instruction — the checklist's documented choice |
| Zba (8) | Vol I `zba.adoc` | `core/src/bits.rs:8-12,101` | OK | add.uw, sh1/2/3add(.uw), slli.uw all present |
| Zbb (20) | Vol I `zbb.adoc` | `bits.rs:13-45,61-101` | OK | all 20 listed ops present and correct encodings (orc.b 0x287, rev8 0x6b8, zext.h=packw rs2=0) |
| Zbs (8) | Vol I `zbs.adoc` | `bits.rs:47-50,102-105` | OK | bset/bclr/binv/bext + immediates |
| Zihintpause | Vol I `zihintpause.adoc` | `cpu.rs:556` | OK | PAUSE (FENCE, pred=W) executes as NOP; not advertised (allowed) |
| Zbc/Zbkb/Zfa/Zfh/Zacas/Zabha/Zawrs/Zicond/Zcb | respective Vol I chapters | decode fallthrough `cpu.rs:712` | OK (as OUT) | all raise illegal instruction; not advertised |

### 2. Privileged architecture v1.12 (SPEC-CHECKLIST §2)

| Item | Spec section | Implementation | Status | Reason |
|---|---|---|---|---|
| §2.1 Firmware-less start contract | Vol II `machine.adoc`; SBI `ext-hsm.adoc` | `core/src/sbi.rs:7-18` | PARTIAL | medeleg=0xb1ff, mideleg=0x222, STCE=1, mcounteren=7, SXL/UXL=2, no locked PMP all correct; deviations: menvcfg.FIOM=1 (checklist wants 0, harmless without Svpbmt), mstatus.MPP=S not established (engine enters S directly — acceptable alternative, contract letter not met) |
| §2.2 M-mode CSRs | Vol II `machine.adoc` | `cpu.rs:109-229`, traps `cpu.rs:230-287` | PARTIAL | mstatus/mie/mip/mtvec/mepc/mcause/mtval/menvcfg/mcounteren/mconfigptr/mcycle/minstret/mcountinhibit all present; mip.STIP writable while STCE=1 → D3; SD handling → D7; MBE/SBE → D8 |
| Trap priority / mtval | Vol II `machine.adoc` "Exception Handling" | `cpu.rs:230-263`, fetch `cpu.rs:355-361` | OK | breakpoint before page fault, misaligned(4/6) raised for AMO/LR/SC before translation, access fault before page fault in the walker, mtval written on every trap, precise in-order |
| §2.3 S-mode CSRs | Vol II `supervisor.adoc` | `cpu.rs:109-229`, `cpu.rs:690-707` | PARTIAL | sstatus/stvec/scause/sepc/stval/sscratch/sie/sip/satp/scounteren present; TVM and TSR enforced; sfence.vma = full TLB flush (allowed in R1); sstatus.SD wrong → D7 |
| §2.4 Sv39 | Vol II `supervisor.adoc` Sv39 | `core/src/memory.rs:219-313` | OK | 3-level walk, megapage low-PPN alignment check, canonical-VA check, V/R/W/X/U/G/A/D/RSW decode, N=1/PBMT≠0/W&!R fault, U/SUM and MXR enforcement, A/D set in hardware incl. write setting A+D, page-fault vs access-fault split, MPRV honored via effective-mode in `translate_size` (`memory.rs:202`), TLB tagged with satp+SUM/MXR and flushed on satp/sfence/PMP changes. `svadu` advertisement → D1 |
| §2.5 Sstc | Vol II `sstc.adoc`, `supervisor.adoc` stimecmp | `cpu.rs:89-102,120-124,205-209` | PARTIAL | stimecmp=0x14D, gated on menvcfg.STCE, mip.STIP driven by `time ≥ stimecmp` and cleared by stimecmp writes, SBI set_timer programs stimecmp — all correct; but STIP stays writable in mip → D3, and access is also gated on mcounteren.TM (no spec basis) → D4 |
| §2.6 Counters / WFI / PMP | Vol II `machine.adoc` | counters `cpu.rs:114-119,139-141`; WFI `cpu.rs:670-677`; PMP `memory.rs:179-196`, `cpu.rs:143-147,187-204` | PARTIAL | counters + WFI (TW honored, S-mode legal, event-wait via `waiting`) OK; PMP is **implemented** although §2.6 declares it OUT → D12 |
| §2.7 OUT set (H, Sv48/57, Svnapot, Svpbmt, Smstateen, Sdtrig…) | Vol II respective | CSR fallthrough `cpu.rs:158`, satp WARL `cpu.rs:211-216` | OK (as OUT) | vs*/henvcfg etc. raise illegal; satp only accepts MODE 0/8 |

### 3. SBI v2.0 (SPEC-CHECKLIST §3)

| Item | Spec section | Implementation | Status | Reason |
|---|---|---|---|---|
| Calling convention + error codes | SBI `binary-encoding.adoc` | `sbi.rs:19-116` | OK | a7/a6/a0-a5, a0=error/a1=value, other registers preserved, −2 for unknown EID/FID |
| Base 0x10 (all 7 FIDs) | SBI `ext-base.adoc` | `sbi.rs:38-42` | OK | spec version 0x02000000, probe, mvendorid/marchid/mimpid=0 |
| Legacy 0x00–0x09 | SBI `ext-legacy.adoc` | `sbi.rs:27-37` | PARTIAL | set_timer/putchar/getchar/shutdown implemented (getchar returns byte in a0 per legacy ABI); clear_ipi/send_ipi/remote-fences return NOT_SUPPORTED instead of the checklist's SHOULD no-op → D15 |
| TIME 0x54494D45 | SBI `ext-time.adoc` | `sbi.rs:27-31` | OK | programs stimecmp + clears STIP (correct Sstc behavior) |
| IPI 0x735049 | SBI `ext-ipi.adoc` | `sbi.rs:43-49` | OK | sets SSIP for hart 0 / -1 bases, −3 otherwise |
| RFENCE 0x52464E43 | SBI `ext-rfence.adoc` | `sbi.rs:50-56` | OK | TLB flush when hart 0 targeted (no-op single-hart) |
| HSM 0x48534D | SBI `ext-hsm.adoc` | `sbi.rs:57-68` | OK | hart_start(0) → ALREADY_AVAILABLE, get_status, stop |
| SRST 0x53525354 | SBI `ext-sys-reset.adoc` | `sbi.rs:69-76` | OK | shutdown + cold/warm reboot distinguished, param validation |
| DBCN 0x4442434E | SBI `ext-debug-console.adoc` | `sbi.rs:77-111` | OK | write/read/write_byte with −5 on bad addresses |
| PMU 0x504D55 | SBI `ext-pmu.adoc` | (absent from `EXTENSIONS`) | PARTIAL | probe returns 0 (kernel falls back to software); the checklist's SHOULD-stub `num_counters=0` not provided → D15 |
| Probing consistency | SBI `ext-base.adoc` | `sbi.rs:3-5,41` | PARTIAL | EID 0 probeable (in array) but legacy 1/2/8 are implemented yet unprobeable; impl ID 0x0a000000 sits in a reserved range → D15 |

### 4. Platform devices (SPEC-CHECKLIST §4)

| Item | Spec section | Implementation | Status | Reason |
|---|---|---|---|---|
| §4.1 CLINT/ACLINT | `riscv-aclint` Memory Map | `memory.rs:122-158`, `cpu.rs:89-102` | OK | msip, mtimecmp, mtime incl. split 32-bit halves and writable mtime (second-pass fix; the R1 log's earlier "mtime RO" gap is closed); 64-bit single-copy trivially; MTI/MSI recomputed from `refresh_timer`; 10 MHz in `boot.rs:53` |
| §4.2 PLIC register map | `riscv-plic-spec` | `devices.rs:97-138,175-187` | OK | priorities 0..7, pending word, per-context enables (0x80 stride), thresholds, claim/complete at 0x200000+0x1000c+4, context order M,S per hart, level re-arm via claim-mask; pending-after-claim nuance → D16 |
| §4.2 PLIC devicetree | PLIC spec + bindings | `fdt.rs:104-112` | PARTIAL | ndev=31, interrupts-extended `<1 11 1 9>` OK; `riscv,max-priority` missing → D1 |
| §4.3 virtio-mmio transport | VIRTIO 1.2 §4.2 | `devices.rs:119-229` | PARTIAL | modern-only (Version=2, VERSION_1 feature), full register map, reset via Status=0, FEATURES_OK validated, QueueNumMax=128 pow2 enforced; QueueNotify is a no-op (polling) → D13; NO_INTERRUPT ignored → D14; sub-word/wide MMIO accesses correctly access-fault (`cpu.rs:299-304,340-343`, second-pass fix) |
| §4.3 blk | VIRTIO 1.2 §5.2 | `devices.rs:349-399` | PARTIAL | header/type/sector/status handling, per-op direction checks, OOB → status 1, unsupported op → status 2, lazy chunk-preflight (descriptor left pending until host supplies chunks — correct); offered features/config only capacity → D2 (FLUSH/SEG_MAX/BLK_SIZE missing) |
| §4.3 net | VIRTIO 1.2 §5.1 | `devices.rs:318-347` | WRONG | MAC/STATUS features and whole net config space absent → D2; tx frame <12 B wedges NEEDS_RESET; rx prepends a zeroed 12-byte Ethernet header → D10 |
| §4.3 console | VIRTIO 1.2 §5.3 | `devices.rs:292-316` | OK | rx/tx byte pipes through real virtqueues, partial fills, no config (single-port approximation) |
| §4.3 entropy | VIRTIO 1.2 §5.4 | `devices.rs:301-316` | OK | host-fed via queue 0 |
| §4.3 9p | VIRTIO 1.2 §5.11 | — | OK (as OUT) | not needed (initrd-based rootfs); checklist makes it conditional |
| Generic virtqueue rules | VIRTIO 1.2 §2 | `devices.rs:230-419,427-453` | OK | split rings, desc chains bounded by q.size, INDIRECT rejected (not offered), device writes only used ring + buffers, used_idx wrap checked, malformed avail → NEEDS_RESET; used->flags left 0 which is consistent with no-EVENT_IDX |

### 5. Device tree (SPEC-CHECKLIST §5)

| Item | Implementation | Status | Reason |
|---|---|---|---|
| `/cpus/cpu@0` | `fdt.rs:77-98` | PARTIAL | reg/status/mmu-type=sv39/timebase=10 MHz/legacy `riscv,isa` string incl. `_sstc` OK; `riscv,isa-extensions` and `riscv,has-stimecmp` missing → D1 (kuberoot 6.18 accepts the legacy string — boot log proves Sstc in use — but newer kernels ignore it; the checklist mandates both properties) |
| CLINT `/timer` node | — | MISSING | → D1 |
| `/soc/plic` | `fdt.rs:104-112` | PARTIAL | see PLIC row above |
| `/soc/virtio-mmio@…` | `fdt.rs:113-121` | PARTIAL | compatible/reg/interrupts OK; `dma-coherent` missing → D1 |
| `/memory`, `/chosen` | `fdt.rs:60-76` | OK | bootargs, initrd start/end, stdout-path to the virtio console node; host time is harness-supplied via cmdline |
| No RTC | — | OK | per checklist |

### 6. Conformance-plan tooling (CONFORMANCE-PLAN.md)

| Item | Implementation | Status | Reason |
|---|---|---|---|
| `rv64-runner --elf/--max-insns/--signature` | `core/src/bin/rv64-runner.rs` | OK | loads ELF, tohost contract, signature dump from `begin/end_signature` |
| `rv64-runner --trace` | — | MISSING | plan prerequisite 3; gates A and D (Spike trace-diff) cannot start → D11 |
| Signature byte order | `rv64-runner.rs:48-59` | PARTIAL | each 16-byte row is printed in *descending* address order; Spike `--signature`/Sail print ascending — verify and fix before gate B1 → D11 |
| Boot milestone harness | `core/src/bin/boot.rs` | OK | BOOT_SHELL_MS, SBI_TIME_CALLS/STIMECMP_WRITES (M3 Sstc proof), RV64_DISK/RV64_MEMORY_MB, device diagnostics on failure |
| Upstream test driver | `tests/upstream.rs` | OK | runs pod-built riscv-tests; pmpaddr re-enabled after PMP landed |
| Platform tests | `tests/platform.rs` | OK | 25 tests: Sv39 rights/A/D/TLB, MPRV, Sstc+WFI, trap precision, SBI, virtio/PLIC, malformed queues, DTB, snapshots, lazy disk, PMP |

## 2. Prioritised defects

Priority: **P0** blocks a MUST/milestone gate · **P1** spec/checklist violation with
functional or certification impact · **P2** SHOULD-level or corner-case deviation ·
**P3** nit or verify item.

### P0

- **D1 — Device tree misses mandated feature advertising and the timer node**
  (`core/src/fdt.rs:77-122`). No `riscv,isa-extensions`, no `riscv,has-stimecmp`,
  no CLINT/ACLINT timer node, no `riscv,max-priority`, no `dma-coherent` on the
  virtio nodes, and `svadu` deliberately not advertised (R1-LOG records the
  rationale: no ADUE control bit implemented). Spec: checklist §5, §2.5, §4.1,
  §4.2. Impact: Sstc and hardware-A/D detection depends on the legacy
  `riscv,isa` string that post-6.2 kernels increasingly ignore (silently falls
  back to SBI TIME — the exact accident milestone M3 warns about); pre-Sstc
  kernels have no timer device at all; without `svadu` the kernel takes the
  software A/D path (extra faults on every page touch — matters while
  throughput is 7.8× off target). Fix: emit the properties; add an ADUE bit to
  menvcfg if advertising svadu.

- **D2 — virtio-mmio offers almost no device features and an almost empty
  config space** (`core/src/devices.rs:150-171`). blk offers only implicit
  VERSION_1: SEG_MAX(2)/BLK_SIZE(6)/FLUSH(9) missing, and `size_max`,
  `seg_max`, `blk_size`, `writeback`, `num_queues` read 0; net offers no
  MAC(5)/STATUS(16) and the mac/status/max_virtqueue_pairs config fields read
  0. Spec: VIRTIO 1.2 §5.1/§5.2; checklist §4.3 (MUST). Impact: with
  `seg_max` absent Linux runs blk-mq with single-descriptor requests (severe
  I/O perf hit, adjacent to the perf gate); no FLUSH (data-flush semantics
  lost, checklist MUST); a random per-boot guest MAC risks breaking the
  dt-switch/kuberoot network identity (M6).

### P1

- **D3 — mip.STIP remains software-writable while STCE=1**
  (`core/src/cpu.rs:185`, mask 0x222). Sstc makes mip.STIP read-only, driven by
  the stimecmp comparator, when STCE=1 (checklist §2.5). The engine overwrites
  the bit on every `refresh_timer` anyway, so written values are transient
  impossible states — Spike/arch-test privileged tests will flag the readback.

- **D4 — stimecmp access additionally gated on mcounteren.TM**
  (`core/src/cpu.rs:120-124`). No spec basis (Sstc: gate is menvcfg.STCE only).
  Benign for Linux (mcounteren=7) but wrong; rv64si CSR tests may set
  mcounteren=0 and expect stimecmp to keep working.

- **D5 — writing minstret absorbs the next retired instruction**
  (`core/src/cpu.rs:222-225` + `379-382`). After `minstret = v`, the following
  instruction's retirement is skipped (`wrote_instret`), so the count reads
  one low vs Spike, which bumps from the written value. Breaks instruction
  trace-diff (gate A/D) on any test that writes minstret.

- **D6 — misaligned store outside RAM raises cause 6 instead of 7**
  (`core/src/cpu.rs:321-322`). The byte-wise path rejects non-RAM physical
  addresses with "store/AMO misaligned" before the device window is consulted;
  per the mcause table and checklist §2.2 an accessibility failure is an access
  fault (7). Also makes MMIO targets unreachable via misaligned stores.

- **D7 — sstatus.SD is not derived and is writable**
  (`core/src/cpu.rs:29-30,179-182,210`). SD (bit 63) should be read-only 1
  when FS=Dirty; the engine never sets it from FS and accepts writes to it via
  both sstatus and mstatus (mask keeps bit 63 in the writable set). Purely
  informational, but a visible CSR misbehavior (Vol II mstatus/sstatus).

- **D8 — mstatus.MBE/SBE are writable** (`core/src/cpu.rs:210`). The write mask
  only forces SXL/UXL=2; big-endian bits 36/37 stick if written, while the
  engine executes little-endian only (checklist §6: hardwire 0). WARL-sanitize
  them away.

- **D9 — decoded fast path skips the JAL/JALR misaligned-target trap**
  (`core/src/decoded.rs:64-75` vs `cpu.rs:714-719`). `execute()` raises
  cause 0 with mepc = the jump instruction when a target has bit 0 set;
  `execute_decoded()` takes the branch, retires the jump, and faults one
  instruction later with mepc = target. Interpreter/trace-diff divergence on an
  architecturally visible corner (Vol I rv64; also c.jr/c.jalr).

- **D10 — virtio-net frame handling is not spec-shaped**
  (`core/src/devices.rs:318-347`). A transmitted frame shorter than an
  Ethernet header is a device error (NEEDS_RESET) instead of a dropped frame,
  wedging the queue; received frames are delivered with a fabricated 12-zero
  Ethernet header, so the guest stack sees dst/src/proto = 00:00:00/0x0000
  (VIRTIO 1.2 §5.1 carries real L2 frames). Works only if the host switch
  plumbing compensates — an M6 (network) acceptance risk.

- **D11 — conformance tooling gaps** (`core/src/bin/rv64-runner.rs`). No
  `--trace` (CONFORMANCE-PLAN prerequisite 3), so gates A/D (Spike lockstep)
  cannot start; the `--signature` writer prints each 16-byte row in descending
  address order (`rv64-runner.rs:48-59`) while Spike/Sail references print
  ascending — verify against the pinned riscof-plugins reference and fix before
  gate B1 or every signature mismatches.

- **D12 — PMP implemented although the checklist declares it OUT**
  (`memory.rs:63-64,179-196`, `cpu.rs:143-147,187-204`, `sbi.rs:9-10`).
  SPEC-CHECKLIST §2.6: "no pmpcfg/pmpaddr entries". The second pass added 16
  TOR/NA4/NAPOT entries with locks, MPRV-aware checks and page-table checks,
  plus a boot-installed unlocked all-RAM NAPOT entry (which preserves the
  "S/U have full access" contract). The implementation itself is largely sound
  (lowest-index priority, partial-match failure, locked entries enforced on M,
  54-bit WARL addresses); either re-classify PMP in the checklist or drop it.
  Corner inside: the pmpaddr lock check for a following locked TOR entry tests
  W/X bits (`0x98 == 0x88`) instead of L+OFF (`0x81`) (`cpu.rs:200`) — a
  locked no-permission TOR entry fails to lock its predecessor address.

### P2

- **D13 — QueueNotify is a no-op; queues are polled every batch**
  (`devices.rs:230-419` — no 0x50 arm in `write()`). Functionally safe (the
  device may process whenever it likes, and DRIVER_OK gates it) but it ignores
  the driver's doorbell, defeating notification batching (VIRTIO 1.2 §4.2.2).

- **D14 — VRING_AVAIL_F_NO_INTERRUPT is ignored** (`devices.rs:408`). The
  device raises an interrupt after every used-ring write even when the driver
  asked for suppression (tx NAPI polling) — extra PLIC traffic; VIRTIO 1.2 §2
  SHOULD.

- **D15 — SBI probing/legacy nits** (`sbi.rs:3-5,26-116`). probe_extension(0)
  returns 1 while implemented legacy EIDs 1/2/8 return 0; implementation ID
  0x0a000000 is in a reserved range (use an assigned or ≥0x10000000
  experimental ID); PMU SHOULD-stub (num_counters=0) absent; legacy
  clear_ipi/send_ipi/remote-fences return NOT_SUPPORTED instead of the
  checklist's no-op success.

- **D16 — PLIC pending register reads 0 after claim while the level line is
  still asserted** (`devices.rs:97-103`). Real PLICs keep pending set until
  deassertion; Linux never reads it, but it is a spec-visible deviation
  (PLIC spec, Interrupt Pending Bits).

- **D17 — queue servicing continues after NEEDS_RESET is set**
  (`devices.rs:233` only checks FAILED/128). Per VIRTIO 1.2 §3.1 the device
  must stop driving queues once NEEDS_RESET is posted; the current code retries
  the same failing descriptor every batch.

- **D18 — menvcfg.FIOM=1 at boot** (`sbi.rs:17`). Checklist §2.2 wants FIOM=0
  (no Svpbmt). Harmless but sloppy; clear it.

### P3

- **D19 — tselect (0x7a0) returns all-ones** (`cpu.rs:148`). Checklist wants
  unimplemented CSRs to read 0 or raise illegal (Sdtrig is OUT).
- **D20 — mtvec/stvec reserved mode 3 accepted silently** (`cpu.rs:218`):
  treated as direct, which WARL permits, but masking `!2` was clearly meant to
  exclude reserved modes.
- **D21 — PMP locked-TOR neighbor mask corner**: see D12 tail; the
  `0x88` test misses locked TOR entries without W (use `(cfg & 0x81) == 0x81`).
- **D22 — boot-contract letter**: mstatus.MPP=S not established at start
  (`sbi.rs:7-18` enters S directly). Behaviorally fine; the §2.1 contract text
  assumes an mret trampoline.

## 3. Defect counts by priority

| Priority | Count |
|---|---:|
| P0 (must fix before R1 acceptance) | 2 |
| P1 (spec/checklist violation) | 10 |
| P2 (SHOULD-level / corner deviation) | 6 |
| P3 (nit / verify) | 4 |
| **Total** | **22** |

## 4. Verification status (from R1-LOG, not re-run here)

- riscv-tests `*-p-*`: 174/174 pass in the pod (173 + 1 after PMP landed);
  platform tests 25/25; direct Spike signature comparison 266/266 on the
  pinned arch-test 3.0.0 I/M/C/D corpus. These are real but partial: A/B
  (extra/conditional cases), full RISCOF/ACT4, and instruction-level
  trace-diff are still outstanding (D11).
- Linux 6.18.62-kuberoot boots to a shell natively and in Chromium; Sstc path
  proven by counters (16k–20k stimecmp writes, 0 SBI TIME calls).
- Throughput gate is not met: ~51–73 busy MIPS vs the ~400 target (~7–8×),
  so R1 remains unaccepted regardless of the correctness findings above.
- Known non-goals consistent with the checklist: single hart, no 9p (initrd
  rootfs), snapshots/lazy disk are early R3 work, host time via injected ticks.
