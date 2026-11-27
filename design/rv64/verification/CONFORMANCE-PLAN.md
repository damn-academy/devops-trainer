# RV64 engine — conformance plan (R1)

Verification material for the Rust engine (`web/src/engine/rv64/core`). Everything here
runs the engine **natively** (cargo) unless stated — the wasm build is the same crate,
so ISA coverage transfers; browser-only risks (Workers, shared memory) are covered by
the R1 boot criteria and are not re-tested here.

References and pins (record exact SHAs in `web/src/engine/rv64/verification-pins.txt`
when first run; do not run builds on the student's Mac — use the dev machine/CI):

| Tool | Role | Pin |
|---|---|---|
| `riscv-software-src/riscv-tests` | ISA smoke + privileged tests | master (pin SHA) |
| `riscv-non-isa/riscv-arch-test` | architectural certification | see note below (RISCOF: last 3.0.x tag; ACT4: main) |
| `riscv-software-src/riscof` (+ spike plugin) | arch-test runner, Spike reference | 1.25.x (pin) |
| `riscv-software-src/riscv-isa-sim` (Spike) | reference model / trace source | master (pin SHA) |
| `riscv/sail-riscv` | ACT4 reference model | 0.13.1 |
| riscv-gnu-toolchain (GCC 15, multilib incl. `rv64imafdc/lp64d`) | build tests/kernels | release |
| kuberoot riscv64 kernel `Image` + rootfs | boot milestones | from the parallel kuberoot port |

Engine-side prerequisites (owned by the engine workstream, spec'd here for the runner):

1. `rv64-runner` CLI in the Rust crate: `rv64-runner --elf <file> [--dtb <file>]
   [--max-insns N] [--signature <file>] [--trace <file>]`. Loads ELF segments at their
   link addresses, starts at the entry point, runs until `tohost` is written
   (riscv-tests / ACT contracts), `--max-insns`, or trap loop.
2. `--signature <file>`: dump `[begin_signature, end_signature)` as raw bytes (riscv-arch
   test RISCOF/ACT signature compare). Addresses come from the linker's symbol table or
   `--defsym` provided by the suite's link script.
3. `--trace <file>`: emit the canonical trace from `TRACE-DIFF.md` (feature-gated).

## A. riscv-tests — fast ISA smoke

Repo: https://github.com/riscv-software-src/riscv-tests (`isa/` directory, `p`
and `v` environments). Build with the riscv64 toolchain (`make isa` with `RISCV=...`),
or per-group: `make rv64ui rv64um ...`.

| Group | Covers | Status |
|---|---|---|
| `rv64ui` | base integer, loads/stores, branches, misaligned | MUST pass 100% |
| `rv64um` | multiply/divide edge cases (div/0, overflow) | MUST pass 100% |
| `rv64ua` | LR/SC, AMOs | MUST pass 100% |
| `rv64uf` / `rv64ud` | FP ops, NaN-boxing, conversions, FMADD | MUST pass 100% |
| `rv64uc` | compressed encodings | MUST pass 100% |
| `rv64uzba` / `rv64uzbb` / `rv64uzbs` | bit-manipulation | MUST pass 100% |
| `rv64si` | S-mode: trap handling, sfence, satp/Sv39 via `v` env, illegal insn, breakpoint, CSR access | MUST pass 100% |
| `rv64mi` | M-mode: CSRs, mtvec modes, misaligned fetch, breakpoint, access faults, ecall | MUST pass 100% |
| `rv64mzicbo`, `rv64ssvnapot`, `rv64up`, hypervisor groups | — | skip (OUT in `SPEC-CHECKLIST.md`) |

Harness: a `cargo test` (or script) that runs every `*-p-*.elf` / `*-v-*.elf` through
`rv64-runner` and checks the `tohost` pass code. Every test is also run under Spike and
the two traces are compared (`TRACE-DIFF.md`) — this is the per-instruction
engine-vs-reference proof for the unprivileged ISA, before arch-test signatures are
even generated.

Gate: 100% of the listed groups pass on the engine and match Spike instruction-for-
instruction.

## B. riscv-arch-test — certification

**Upstream status (checked 2026-11-21):** riscv-arch-test `main` has replaced RISCOF
with the **ACT4 framework** (Makefile + Python, `run_tests.py`, reference model = Sail,
self-checking ELFs with results compiled in). RISCOF is deprecated upstream but still
works when pinned to the last 3.0.x tag of `riscv-arch-test` + `riscof` 1.25.x +
the `spike` plugin from `riscv-software-src/riscof-plugins`. The plan below keeps the
requested RISCOF flow (B1) and records the ACT4 equivalent (B2) so re-baselining is a
config change, not a surprise.

**Coverage target (both flows):** unprivileged suites for I, M, A, F, D, C, Zba, Zbb,
Zbs. Privileged coverage (CSRs, traps, Sv39 corner cases, delegation) comes from
riscv-tests `rv64si`/`rv64mi` (A) plus the ACT4 privileged tests when stable upstream.
Zicntr has no arch-test suite; its contract is enforced by milestone M3 and riscv-tests
csr/rdtime checks.

### B1. RISCOF flow (engine as DUT, Spike as reference)

Layout (vendored under `web/src/engine/rv64/arch-test/` or a sibling tools dir):

```
riscof/
  config.ini
  spike/                  # reference plugin (from riscof-plugins, adapted)
    plugin.ini
    spike_isa.yaml
    spike_platform.yaml
  rv64engine/             # DUT plugin
    plugin.ini
    dut_isa.yaml
    dut_platform.yaml
    rv64engine_plugin.py
    model_test.h          # RVMODEL_* macros for the runner
    link.ld
```

`config.ini`:

```ini
[RISCOF]
ReferencePlugin=spike
ReferencePluginPath=riscof/spike
DUTPlugin=rv64engine
DUTPluginPath=riscof/rv64engine
```

`spike/plugin.ini` (reference):

```ini
[spike]
pluginpath=riscof/spike
ispec=riscof/spike/spike_isa.yaml
pspec=riscof/spike/spike_platform.yaml
```

`spike/spike_isa.yaml` (delta from the stock template):

```yaml
hart0:
  ISA: rv64imafdc_zicsr_zifencei_zicntr_zba_zbb_zbs   # single-line canonical string
  physical_addr_sz: 56
  User_Spec_Version: '2.3'
  Privilege_Spec_Version: '1.12'
  misaligned: true          # engine handles misaligned natively
  # mstatus/mtvec reset-vals: keep stock (0); compare against engine's runner contract
```

`rv64engine/plugin.ini`: same keys, pointing at `dut_isa.yaml` (identical ISA string),
`dut_platform.yaml` (runner memory map: test RAM at 0x80000000 per `link.ld`,
CLINT at 0x02000000 for the timer macros, PLIC unused), and the plugin module.

`rv64engine/rv64engine_plugin.py` implements the riscof plugin API:
`__init__` (read config), `initialise` (resolve runner binary), `build` (no-op —
tests come pre-compiled by riscof), `runTests(test_list)` — for each test, invoke

```
rv64-runner --elf <test.elf> --signature <work_dir>/DUT-<name>.signature
```

and return success/failure. `model_test.h` maps `RVMODEL_HALT_PASS`/`RVMODEL_HALT_FAIL`
to a `tohost` write and `RVMODEL_IO_*` to the runner console; `RVMODEL_MTIME/
MTIMECMP_ADDRESS` to 0x0200_BFF8 / 0x0200_4000.

Run: `riscof run --config config.ini --suite <arch-test>/riscv-test-suite
--env <arch-test>/riscv-test-suite/env`. RISCOF compiles each test, runs Spike to
produce the reference signature, runs the engine, compares. Gate: zero signature
mismatches for the target suites.

### B2. ACT4 flow (successor, same engine contract)

Config dir per https://github.com/riscv-non-isa/riscv-arch-test README:

- `test_config.yaml`: `name: rv64engine`, `compiler_exe: riscv64-unknown-elf-gcc`,
  `ref_model_exe: sail_riscv_sim`, `udb_config: ./rv64engine.yaml`,
  `linker_script: ./link.ld`, `dut_include_dir: .`, `include_priv_tests: true/false`.
- `rv64engine.yaml`: UDB config with the extension list from `SPEC-CHECKLIST.md` §1–2.
- `rvmodel_macros.h`, `link.ld`: same runner contract as B1 (`RAM_ORIGIN 0x80000000`,
  `TEST_BASE 0x80000000`, `NUM_HARTS 1`).

Build ELFs: `CONFIG_FILES=<cfg>/test_config.yaml make -j` → self-checking ELFs;
run each through `rv64-runner`; expected console marker per test:
`RVCP-SUMMARY: TEST PASSED - Test File "<name>"` (failure line marks FAIL). With
`DEBUG=True`, Sail emits `.sig.log` instruction traces — reusable as reference traces
in `TRACE-DIFF.md`.

## C. Linux boot milestones — no OpenSBI (engine is the SBI)

Guest: kuberoot riscv64 `Image` loaded at its link address (0x80200000), engine-
generated DTB, cmdline `console=hvc0 earlycon=sbi root=/dev/vda rw` + host time
(R0 finding 4). The engine implements SBI v2.0 itself (`SPEC-CHECKLIST.md` §3); there is
**no OpenSBI/bbl stage**, so the first bytes on the console are the kernel banner —
verified by the milestone harness.

Milestones (harness = scripted boot + grep on the captured serial log; markers are
substring matches, robust to kuberoot version drift):

| # | Milestone | Proves | Expected markers |
|---|---|---|---|
| M0 | SBI + entry | engine SBI, HSM start, M→S transition, kernel entry at 0x80200000 | engine-side: first ECALL in trace; console starts directly with M1 (no OpenSBI banner) |
| M1 | earlycon | legacy console/DBCN path, DT parse | `Linux version` (kernel banner) |
| M2 | platform | DT accepted, CPU features incl. Sstc/Zba/Zbb/Zbs | `Machine model:` |
| M3 | timer | Sstc `stimecmp` wiring (or SBI TIME fallback) | `clocksource: riscv_clocksource`, `sched_clock: 64 bits`; in-guest: `riscv-timer` count grows in `/proc/interrupts` |
| M4 | virtio-blk probe | MMIO transport, PLIC delivery, virtqueues | `virtio_blk virtio0:`, `[vda]` |
| M5 | root mount | block datapath, ext4 | `VFS: Mounted root (ext4 filesystem)` |
| M6 | virtio-net + DHCP | net queues, `dt-switch` bridge, kuberoot network init | interface present (`ip link`); lease line from the guest DHCP client (busybox: `udhcpc: lease of`; kuberoot networkd: equivalent) |
| M7 | user space | full syscall path, init | `Run /init as init process`, then kuberoot init banner / shell prompt |
| M8 | kubelet-ready stretch (R4 prep) | cgroup v2, overlayfs present | kuberoot init reports node ready (per its own logs) |

Sstc proof (M3): after the scheduler starts, engine-side counters must show ~0
`SBI_TIME set_timer` ECALLs (kernel programs `stimecmp` directly) and
`stimecmp` writes > 0. Fallback mode (SBI TIME per tick) is acceptable for boot but
must be a conscious log entry, not an accident — check the DT advertises `sstc`.

Anti-markers — any of these fails the boot immediately:
`Kernel panic`, `Oops`, `BUG:`, `Illegal instruction`, `Unable to handle kernel paging
request`, `Instruction access fault`, `rcu_sched stall`, `SBI call failed`.

## D. Lockstep trace comparison

Per `TRACE-DIFF.md`. Plan:

1. Every riscv-tests ELF (A): full instruction trace, engine vs Spike, no masks except
   `time`. Expect zero divergence.
2. Boot (C): compare the first ~100M instructions (per the R1 plan in
   `R0-MEASUREMENTS.md`) against **both** Spike and the R0-patched TinyEMU build, in
   phases: M0–M3 (no device IRQs) must match exactly with only `time` masked; after the
   first timer interrupt, compare handler windows (`--start-pc/--stop-pc` at each
   `stvec`/`mtvec` handler entry/exit) rather than the whole stream.
3. Any arch-test/ACT signature mismatch: re-run that single test with tracing on both
   sides and diff — signature tells you *which* test, trace tells you *which*
   instruction.

## E. R1 acceptance gates (from §6.12 / R0-MEASUREMENTS)

- A: riscv-tests 100% pass + 100% Spike trace match.
- B1/B2: riscv-arch-test zero mismatches for I/M/A/F/D/C/Zba/Zbb/Zbs.
- C: milestones M0–M7 reached on the kuberoot kernel, zero anti-markers.
- D: boot trace comparison per D.2.
- (Performance gate — CoreMark MIPS ≥ TinyEMU, no yielding loss — is measured by the
  R1 benchmark, out of scope for this document.)
