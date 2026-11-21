# RV64 engine — specification checklist (R1)

Scope: the Rust RV64 engine in `web/src/engine/rv64/core` (`design/rv64/R0-MEASUREMENTS.md`,
R1 section). Target guest: the kuberoot riscv64 kernel (Linux) + Kubernetes userland.
Status legend: **MUST** (required for the R1 acceptance criteria), **SHOULD** (required
for R2–R4 or strongly advised), **OUT** (explicitly not required in R1; do not advertise
in the device tree).

Normative documents (pinned; links are to the living sources on the default branches —
section titles are stable even where numbering drifts):

| Document | Version | Link |
|---|---|---|
| RISC-V Instruction Set Manual, Vol. I: Unprivileged ISA | ratified 20191213 (v2.2 base + ratified extensions) | https://github.com/riscv/riscv-isa-manual (`src/unpriv/`) |
| RISC-V Instruction Set Manual, Vol. II: Privileged ISA | v1.12, ratified 20211203 | https://github.com/riscv/riscv-isa-manual (`src/priv/`) |
| RISC-V SBI Specification | v2.0 (ratified; v3.0 now exists — we implement the v2.0 subset) | https://github.com/riscv-non-isa/riscv-sbi-doc |
| RISC-V ACLINT (CLINT successor) | v1.0 | https://github.com/riscv-non-isa/riscv-aclint |
| RISC-V PLIC Specification | v1.0.0 | https://github.com/riscv-non-isa/riscv-plic-spec |
| Virtual I/O Device (VIRTIO) | v1.2 (OASIS) | https://docs.oasis-open.org/virtio/virtio/v1.2/virtio-v1.2.html |

## 1. Unprivileged ISA

All of Vol. I unless noted. Decode rule for everything below: any reserved/unsupported
encoding raises an illegal-instruction exception (mcause 2). With C, IALIGN = 16.

| Ext | Spec section (Vol. I) | Requirements |
|---|---|---|
| RV64I **MUST** | `src/unpriv/rv64.adoc` | XLEN=64; W-variants (ADDW/SUBW/SLLW/SRLW/SRAW, immediates) sign-extend 32→64; shift amounts from low 6 bits of rs2 / 6-bit shamt; LUI/AUIPC/JAL/JALR (JALR clears bit 0 of target); branches ±4 KiB; ECALL/EBREAK; base FENCE. Misaligned loads/stores: execute natively (the base spec allows either; hardware support avoids the kernel emulation trap storm). No CSR instructions here — they live in Zicsr. |
| M **MUST** | `src/unpriv/m-st-ext.adoc` | MUL/MULH/MULHSU/MULHU, DIV/DIVU, REM/REMU + W forms. Exact divide semantics: div by zero → quotient all-ones (−1), remainder = dividend; signed overflow (−2⁶³/−1) → quotient −2⁶³, remainder 0. Go's runtime divides on every channel/goroutine path. |
| A **MUST** | `src/unpriv/a-st-ext.adoc` | LR.W/D, SC.W/D (SC returns 0 on success, 1 on failure), AMOSWAP/ADD/XOR/AND/OR/MIN/MAX/MINU/MAXU .W/.D; aq/rl may be ignored in the interpreter (program order per hart satisfies the RVWMO visible requirements single-threaded; R3 must map them to wasm atomics). Reservation model: SC to a non-reserved address fails; reservation cleared by trap, another LR, or a SC. LR/SC/AMO must be naturally aligned (else address-misaligned, cause 4/6). |
| F **MUST** | `src/unpriv/f-st-ext.adoc` | f0–f31 as 64-bit containers; FLW NaN-boxes into the upper 32 bits; FSW stores low 32; fcsr = fflags(4) + frm(3); rounding modes RNE/RTZ/RDN/RUP/RMM + DYN; canonical NaN propagation and NaN-boxing check rules; FCVT.{w,l}.{s,d} and back with all rounding modes + NV flag; FSGNJ*; FMIN/FMAX; FMADD/FMSUB/FNMSUB/FNMADD; FSQRT.S; quiet/signaling compares (FEQ/FLT/FLE); FCLASS. FS field of sstatus: set FS=Dirty on any FP register/fcsr write (Linux context-switch relies on it). |
| D **MUST** | `src/unpriv/d-st-ext.adoc` | 64-bit ops; FLD/FSD; FADD.D etc.; FCVT.S.D / .D.S; NaN boxing for 32-bit results read as 64-bit. |
| C **MUST** | `src/unpriv/c-st-ext.adoc` | Full RV64C: quadrants 0–2 integer (c.lw/c.ld/c.lwsp/c.ldsp, c.sd/c.sw/c.sdsp/c.swsp, c.j, c.beqz/bnez, c.li/lui/addi, c.addiw, c.slli/srli/srai, c.andi, c.sub/xor/or/and/subw/addw, c.mv/add, c.jr/jalr, c.ebreak) plus the RV64 FP forms c.fld/c.fldsp/c.fsd/c.fsdsp (double-precision only; the RV32 c.flw/c.fsw encodings are reused as c.ld/c.sd in RV64). RV64 note: C.JAL does not exist (it is C.ADDIW). c.jr/c.jalr/c.mv/c.add with rs2=0 have defined encodings; rd=0 forms are reserved → illegal. Jump offsets are halfword-scaled (c.j ±2 KiB). |
| Zicsr **MUST** | `src/unpriv/zicsr.adoc` | CSRRW/CSRRS/CSRRC + immediate forms. CSRRW always writes (even rd=x0); CSRRS/C with rs1=x0 (or imm=0) perform no write and no write side effects. Access to non-existent or insufficient-privilege CSR → illegal instruction. |
| Zifencei **MUST** | `src/unpriv/zifencei.adoc` | FENCE.I: data→instruction-stream synchronization; must invalidate the engine's fetch/decode state (and, in R2, any translated code for the affected range — see R1 plan "Code cache"). |
| Zicntr **MUST** | `src/unpriv/zicntr.adoc` (+ counter CSRs in Vol. II) | cycle (0xC00), time (0xC01), instret (0xC02) + M/S views; `time` is read-only and driven by the CLINT `mtime`; U-mode access gated by scounteren/mcounteren (R0 finding 1: Go user code executes `rdtime` — mcounteren.TM must be open). **time CSR is mandatory** — TinyEMU 2019 lacked it and every Go binary died with SIGILL. |
| Zihpm **OUT** | `src/unpriv/zihpm.adoc` | Do not implement hpmcounters and do not advertise `zihpm`; mhpmcounter* reads raise illegal instruction (or read 0 per WARL choice — pick one, document it). |
| Zba **MUST** | `src/unpriv/zba.adoc` | add.uw, sh1add, sh2add, sh3add, sh1add.uw, sh2add.uw, sh3add.uw, slli.uw (8 instructions). |
| Zbb **MUST** | `src/unpriv/zbb.adoc` | andn, orn, xnor, clz, ctz, cpop, max, maxu, min, minu, sext.b, sext.h, zext.h, rol, rolw, ror, rori, roriw, orc.b, rev8. |
| Zbs **MUST** | `src/unpriv/zbs.adoc` | bclr, bclri, bext, bexti, binv, binvi, bset, bseti. |
| Zicntr-adjacent: Zihintpause **SHOULD** | `src/unpriv/zihintpause.adoc` | PAUSE is a HINT: execute as NOP. Cheap; advertise only if implemented. |
| Zbc, Zbkb, Zbkc, Zfa, Zfh, Zacas, Zabha, Zawrs, Zicond, Zcb **OUT** | respective chapters in `src/unpriv/` | Not needed for kuberoot/Go rva22u64. Never emitted by the shipped toolchains unless explicitly targeted. |

## 2. Privileged architecture v1.12 (Vol. II, `src/priv/`)

### 2.1 Firmware-less start contract (this engine replaces OpenSBI)

`machine.adoc` (Machine-Level ISA — reset, CSR initialization) + SBI HSM start
(`riscv-sbi-doc/src/ext-hsm.adoc`, `sbi_hart_start`). When the engine "starts" a hart
into the kernel (M-mode entry trampoline), it must first establish the M-mode state
that OpenSBI's cold boot would have established:

- `medeleg` = all delegated synchronous exceptions: instruction/load/store misaligned
  (0,4,6), instruction/load/store access fault (1,5,7), illegal (2), breakpoint (3),
  ecall-U/ecall-S (8,9), page faults (12,13,15). ecall-M (11) stays in M.
- `mideleg` = SSIP (1), STIP (5), SEIP (9) delegated to S.
- `menvcfg.STCE` = 1 — without this, S-mode `stimecmp` accesses trap and the kernel
  falls off the Sstc fast path (there is no firmware to set it for us).
- `mcounteren` = CY|TM|IR (bits 0–2) so U-mode `rdtime/rdcycle/rdinstret` work.
- `mie` = 0, `mip` = 0, `mstatus` = 0 except MPP=S, MBE/SBE/UBE = 0 (little-endian),
  SXL/UXL = 2 (64-bit).
- No locked PMP entries → S/U have full memory access (see §2.6).

### 2.2 M-mode state — `machine.adoc`, section "Machine-Level CSRs"

Implement and behave per spec: `mvendorid`, `marchid`, `mimpid`, `mhartid` (0-based,
1 hart in R1), `mstatus` (SIE/MIE, SPIE/MPIE, SPP/MPP, FS, MPRV, MXR, SUM; TVM/TW/TSR
may be hardwired 0 — Linux does not require them), `misa` (MXL=2, extension bits
I M A F D C S U readable; writes ignored), `mie`/`mip` (MEI/MTI/MSI/SEI/STI/SSIP;
with Sstc enabled `mip.STIP` becomes read-only, driven by the `stimecmp` comparator —
§2.5), `mtvec` (direct and vectored modes; vectored: async trap to `base + 4×cause`),
`mscratch`, `mepc` (WARL, bit 0 = 0), `mcause` (WLRL: interrupt bit 63 + code),
`mtval` (faulting address or instruction bits), `menvcfg` (implement STCE; FIOM/PBMTE 0),
`mcounteren`, `mconfigptr` (read 0), `mcycle`/`minstret`/`mcountinhibit`.

`mcause` codes: 0 inst addr misaligned, 1 inst access fault, 2 illegal, 3 breakpoint,
4 load addr misaligned, 5 load access fault, 6 store/AMO misaligned, 7 store/AMO
access fault, 8 ecall-U, 9 ecall-S, 11 ecall-M, 12 inst page fault, 13 load page
fault, 15 store/AMO page fault.

Trap priority per `machine.adoc` "Exception Handling" and `supervisor.adoc` (e.g.
breakpoint beats instruction page fault; misaligned beats access fault beats page
fault for loads/stores). All traps precise and in program order. `mtval` written on
every trap (always-update behavior is fine).

### 2.3 S-mode state — `supervisor.adoc`

`sstatus` (SIE, SPIE, SPP, SUM, MXR, FS, UBE), `stvec`, `scause`, `sepc`, `stval`,
`sscratch`, `sie`/`sip`, `satp`, `scounteren` (open CY/TM/IR like mcounteren),
`senvcfg`. `sret` and `sfence.vma` implemented (the latter may be a TLB-flush no-op in
the interpreter but must honor addr/ASID granularity when a real TLB exists — R2).

`satp`: Sv39 mode (MODE=8), ASID field WARL (16 bits usable), PPN of the root table.
`sstatus.SUM`/`MXR` enforced during translation (2.5).

### 2.4 Sv39 — `supervisor.adoc`, section "Sv39: Page-Based 39-bit Virtual-Memory System"

- 3-level walk, 4 KiB pages + 2 MiB/1 GiB megapages; VA bits 63:39 must equal bit 38
  (sign extension) else page fault.
- PTE bits: V, R, W, X, U, G, A, D, RSW(2), PBMT(2), N. Reserved encodings must fault:
  N=1 (no Svnapot), PBMT≠0 (no Svpbmt), W=1 with R=0, misaligned megapage PPN
  (non-zero low PPN bits) → page fault.
- U=1 pages inaccessible from S unless `sstatus.SUM`; U=0 inaccessible from U.
  Fetch requires X; `sstatus.MXR` makes X-only pages readable for loads.
- A/D bits: engine updates them in hardware (set A on any access, D on write; write to
  clean D=0 page sets A and D). Advertise `svadu` in `riscv,isa-extensions` — the
  behavior matches, and kuberoot can then rely on it.
- Page-fault vs access-fault split: translation/PMA failures → page fault (12/13/15);
  physical accessibility failures → access fault (1/5/7). Keep RAM all-accessible so
  access faults only fire on unpopulated/IO space.
- Address translation applies to M-mode only when `mstatus.MPRV=1` (loads/stores
  governed by MPP).

### 2.5 Sstc — `sstc.adoc` ("Sstc Extension: Supervisor-Mode Timer Interrupts")

- `stimecmp` (CSR 0x14D), S-mode only; accessible only when `menvcfg.STCE=1`, else
  illegal instruction.
- When STCE=1: `mip.STIP`/`sip.STIP` is read-only, set by hardware while
  `time ≥ stimecmp`; writing `stimecmp` clears the pending bit. This removes the
  M-mode bounce on every tick (R0 finding/R1 requirement).
- The device tree must advertise Sstc (`riscv,isa-extensions = "sstc"` and, for older
  kernels, the boolean `riscv,has-stimecmp` on the CPU node) or the kernel silently
  keeps calling SBI `set_timer`.

### 2.6 Counters, WFI, PMP

- WFI (`machine.adoc`, "Wait for Interrupt"): legal in S (mstatus.TW=0); engine maps it
  to the event-wait mechanism (per the R1 execution model: `Atomics.wait` in wasm).
- Zicntr counter-enable CSRs: `mcounteren`/`scounteren` bits CY/TM/IR (+ HP bits 3–31
  read-only-0 without Zihpm). `mcycle`/`minstret` free-running; `mcountinhibit` respected.
- PMP: **IN (second-pass user requirement)** — 16 TOR/NA4/NAPOT entries, locks, MPRV and page-table access checks; unlocked all-address-space entry at SBI boot. `Smepmp` remains out.
  CSRs read 0 if implemented at all.

### 2.7 Explicitly OUT (do not advertise, do not implement)

Hypervisor extension H (incl. `vs*` CSRs, HFENCE, `vsstimecmp`), Sv48/Sv57 (revisit
only if kuberoot asks), Svnapot, Svpbmt, Svade, Smstateen, Smrnmi, Sdtrig debug
triggers, Smmtt, Sscofpmf, Sstvala/Ssccptr micro-extensions, Sssstrict, mstatus.TW/TVM/
TSR enforcement, ISA parsing of `riscv,isa` legacy string beyond reporting.

## 3. SBI v2.0 implemented by the engine (`riscv-non-isa/riscv-sbi-doc`)

Calling convention (`src/binary-encoding.adoc`): `ECALL` from S; `a7`=EID, `a6`=FID,
`a0–a5` args; return `a0`=error, `a1`=value; all other integer registers preserved.
Unknown EID/FID → `SBI_ERR_NOT_SUPPORTED (-2)`. Error codes used: 0 SUCCESS, −1 FAILED,
−2 NOT_SUPPORTED, −3 INVALID_PARAM, −4 DENIED, −5 INVALID_ADDRESS, −6 ALREADY_AVAILABLE.
SBI implementation ID (`get_impl_id`): pick a private/vendor ID or 0.

| Extension | EID | Functions (FID) | Status | Chapter |
|---|---|---|---|---|
| Base | 0x10 | get_spec_version(0), get_impl_id(1), get_impl_version(2), probe_extension(3), get_mvendorid(4), get_marchid(5), get_mimpid(6) | **MUST**; `get_spec_version` returns (major<<24)\|(minor<<16) = 0x02000000 | `src/ext-base.adoc` |
| Legacy | 0x00–0x09 | set_timer(0x00), console_putchar(0x01), console_getchar(0x02), clear_ipi(0x03), send_ipi(0x04), remote_fence_i(0x05), remote_sfence_vma(0x06), remote_sfence_vma_asid(0x07), shutdown(0x08) | **MUST**: set_timer, console_putchar, console_getchar, shutdown. Fences SHOULD (no-op until R3 SMP) | `src/ext-legacy.adoc` |
| TIME | 0x54494D45 | set_timer(0) — program calling hart's `mtimecmp` | **MUST** | `src/ext-time.adoc` |
| IPI | 0x735049 | send_ipi(0, hart_mask, hart_mask_base) — set CLINT `msip` bits | **MUST** | `src/ext-ipi.adoc` |
| RFENCE | 0x52464E43 | remote_fence_i(0), remote_sfence_vma(1), remote_sfence_vma_asid(2) | **MUST** (no-op single-hart; real in R3) | `src/ext-rfence.adoc` |
| HSM | 0x48534D | hart_start(0), hart_get_status(2); hart_stop(1) SHOULD; hart_suspend(3) OUT | **MUST** for start/status; engine boot = hart 0 HSM start | `src/ext-hsm.adoc` |
| SRST | 0x53525354 | system_reset(0): type shutdown(0)/cold reboot(1)/warm reboot(2) | **MUST**: shutdown + cold reboot (reboot re-enters engine boot) | `src/ext-sys-reset.adoc` |
| DBCN | 0x4442434E | console_write(0), console_read(1), console_write_byte(2) | **MUST** — backs `console=hvc0` | `src/ext-debug-console.adoc` |
| PMU | 0x504D55 | num_counters(0)=0; everything else NOT_SUPPORTED | **SHOULD** (minimal compliant stub; kernel falls back to software) | `src/ext-pmu.adoc` |
| SUSP, CPPC, STA, SSE, FWFT, DBTR, MPXY, nested acceleration, steal-time, vendor | — | — | **OUT**; `probe_extension` returns 0 for all | respective `src/ext-*.adoc` |

Note: `sbi_probe_extension` must return non-zero only for implemented extensions — the
kernel probes DBCN/HSM/TIME/SRST/PMU at boot and changes code paths accordingly.

## 4. Platform devices and register maps

Memory map follows QEMU `virt` where practical (engine generates the device tree,
so names/addresses are ours, but driver compatibility is maximized by keeping the
QEMU layout):

### 4.1 CLINT / ACLINT — base 0x0200_0000 (compatibles `riscv,aclint-mswi`,
`riscv,aclint-mtimer`, or legacy `sifive,clint0`)

Per `riscv-aclint` (Memory Map chapter). Classic SiFive CLINT layout (what Linux
`riscv_timer`/`sifive,clint0` and the SBI `set_timer` path use):

| Offset | Register | Notes |
|---|---|---|
| 0x0000 + 4×i | msip[i] (W) | write 1 → set MSIP bit in mip for hart i (SW interrupt / IPI) |
| 0x4000 + 8×i | mtimecmp[i] (RW) | 64-bit; MTI pending while mtime ≥ mtimecmp |
| 0xBFF8 | mtime (RW) | 64-bit, increments at the DT `timebase-frequency` |

ACLINT view: MSWI ipi[i] at 0x0000+4×i; MTIMER mtimecmp[i] at 0x0000+8×i of the
mtimer block, mtime at offset 0x7FF8. 64-bit access must be single-copy atomic.
Pick `timebase-frequency` = 10 MHz (QEMU-compatible) unless measurement says otherwise.

### 4.2 PLIC — base 0x0C00_0000, size 0x0400_0000 (compatible `riscv,plic0`)

Per `riscv-plic-spec` (chapters Memory Map, Interrupt Priorities, Interrupt Pending
Bits, Interrupt Enables, Priority Thresholds, Interrupt Claim Process):

| Offset | Register |
|---|---|
| 0x0000 + 4×s | priority[s], s = 1..1023 (0 = reserved); max priority 7 |
| 0x1000 + 4×k | pending bits (source 32k+j at bit j of word k) |
| 0x2000 + 0x80×c + 4×k | enable bits for context c |
| 0x200000 + 0x1000×c | priority threshold for context c |
| 0x200000 + 0x1000×c + 4 | claim/complete for context c |

Contexts: two per hart in QEMU order — context 2h = M-mode hart h, context 2h+1 =
S-mode hart h. Sources 1..N-1 = virtio IRQs (level-triggered gateways are fine).
Device tree: `#interrupt-cells = <2>`, `interrupts-extended` to cpu nodes,
`riscv,ndev`, `riscv,max-priority`. Claim clears pending for edge sources; complete
re-arms level sources.

### 4.3 virtio-mmio — base 0x1000_1000, stride 0x1000, one IRQ each (sources 1, 2, …)

Transport: VIRTIO 1.2 §4.2 (Virtio over MMIO); register layout §4.2.2 — offsets below
cross-checked against the Linux driver (`include/uapi/linux/virtio_mmio.h`). Implement
**modern only** (Version register = 2); no legacy/transitional mode needed.

| Offset | Register | Notes |
|---|---|---|
| 0x000 | MagicValue RO | 0x74726976 ("virt") |
| 0x004 | Version RO | 2 |
| 0x008 | DeviceID RO | per device (below) |
| 0x00c | VendorID RO | engine's choice (QEMU uses 0x554d4551) |
| 0x010 | DeviceFeatures RO | selected by DeviceFeaturesSel |
| 0x014 | DeviceFeaturesSel WO | 0/1 |
| 0x020 | DriverFeatures WO | selected by DriverFeaturesSel |
| 0x024 | DriverFeaturesSel WO | 0/1 |
| 0x030 | QueueSel WO | |
| 0x034 | QueueNumMax RO | |
| 0x038 | QueueNum WO | ≤ QueueNumMax |
| 0x044 | QueueReady RW | |
| 0x050 | QueueNotify WO | kick |
| 0x060 | InterruptStatus RO | bit0 vring, bit1 config change |
| 0x064 | InterruptACK WO | |
| 0x070 | Status RW | ACKNOWLEDGE(1) DRIVER(2) FEATURES_OK(8) DRIVER_OK(4) NEEDS_RESET(64) FAILED(128) |
| 0x080/0x084 | QueueDescLow/High | |
| 0x090/0x094 | QueueAvailLow/High | |
| 0x0a0/0x0a4 | QueueUsedLow/High | |
| 0x0fc | ConfigGeneration RO | |
| 0x100+ | device config space | little-endian |

Devices (spec section / DeviceID / queues / required behavior):

| Device | §5 | ID | Queues | Config space | Offered features |
|---|---|---|---|---|---|
| blk | 5.2 | 2 | 1 (requestq) | capacity u64@0x00, size_max u32@0x08, seg_max u32@0x0C, geometry@0x10, blk_size u32@0x14, writeback u8@0x20, num_queues u16@0x22 | SEG_MAX(2), BLK_SIZE(6), FLUSH(9); no RO; 512-byte sectors |
| net | 5.1 | 1 | 2 (rxq0, txq0; ctrl only if F_CTRL_VQ) | mac u8[6]@0x00, status u16@0x06, max_virtqueue_pairs u16@0x08 | MAC(5), STATUS(16); checksum/TSO OUT — `dt-switch` handles plain frames |
| console | 5.3 | 3 | 2 (rx, tx) | none used | none (EMERG_WRITE optional) |
| entropy | 5.4 | 4 | 1 | none | none; feed from host CSPRNG |
| 9p (plan 9) | 5.11 ("File System Device") | 9 | 1 | mount_tag (u16 len @0x00 + bytes) | only if the kuberoot image uses 9p |

Follow the generic virtqueue rules (VIRTIO 1.2 §2): descriptor table/avail/used ring
layouts, INDIRECT and EVENT_IDX optional (may be unsupported — driver probes), used-ring
write-back with used_idx, device MUST NOT write descriptors, driver MUST NOT write used.
Interrupt/notify semantics per §4.2.2: raise IRQ → InterruptStatus bit0; driver ACKs;
QueueNotify triggers processing. Feature-negotiation state machine per §3.1.

## 5. Device tree the engine generates

Nodes and properties the kuberoot kernel needs (bindings: `Documentation/devicetree/
bindings` in the kernel tree):

- `/cpus/cpu@0`: `reg = <0>`, `riscv,isa-extensions = "i" "m" "a" "f" "d" "c"
  "zicsr" "zifencei" "zicntr" "zba" "zbb" "zbs" "sstc" "svadu"`, `riscv,has-stimecmp`
  (legacy alias), `mmu-type = "riscv,sv39"`, `timebase-frequency = <10000000>`;
  `status = "okay"` for online harts only (HSM).
- `/timer` or `/soc/clint`: `compatible = "riscv,aclint-mtimer"` (+ mswi) or
  `sifive,clint0`, reg 0x02000000.
- `/soc/plic: compatible "riscv,plic0"`, reg 0x0c000000/0x04000000,
  `interrupts-extended = <&cpu0 11 &cpu0 9 …>` (M-external 11, S-external 9),
  `riscv,ndev`, `riscv,max-priority`.
- `/soc/virtio-mmio@…`: `compatible = "virtio,mmio"`, `dma-coherent` (engine DMA is
  coherent), one interrupt each.
- `/memory@80000000`: guest RAM. `/chosen`: `bootargs` with `console=hvc0
  earlycon=sbi` + host-time passing (R0 finding 4) + `root=/dev/vda …`.
  No RTC device (host time via cmdline, as in R0).

## 6. Notes

- Endianness: little-endian only (mstatus.MBE/SBE/UBE hardwired 0); the kernel is built
  little-endian.
- Concurrency: single hart in R1 — LR/SC and AMOs can be plain RMW on guest RAM. R3
  revisits with wasm atomics (see R1 plan).
- Everything marked OUT must fail cleanly: illegal instruction for unimplemented ISA,
  CSR reads of 0 (or illegal) for unimplemented CSRs, `probe_extension` = 0. Half
  implementations (e.g. a CSR that accepts writes but ignores them) are what this
  checklist exists to prevent — Spike will catch them in `CONFORMANCE-PLAN.md` step B.
