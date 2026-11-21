# RV64 engine — trace format and `tracediff` tool spec

Purpose: per-instruction lockstep comparison of the engine against reference models
(Spike for riscv-tests/arch-test, Spike and the R0-patched TinyEMU for Linux boot).
Used by `CONFORMANCE-PLAN.md` steps A and D. The format is canonical and textual so
traces from any model (engine, Spike via adapter, patched TinyEMU via adapter) can be
compared byte-for-byte by one small tool.

## 1. Canonical trace format v1

UTF-8 text, one record per line, LF, no trailing spaces. All values lowercase hex,
zero-padded (`pc`, addresses, values: 16 digits / 64-bit; `insn`: 8 digits / 32-bit;
`cause`: 4 digits). `#` starts a comment; blank lines ignored.

Records:

```
# tracediff v1 model=<name> isa=<string>            header (first line)
i <pc> <insn> <rd> <csr>                            retired instruction
t <pc> <cause> <tval> <target>                      trap taken
w <addr> <size> <value>                             memory write      (optional)
```

### `i` — one per retired instruction

- `pc`: address of the instruction.
- `insn`: fetched instruction bits. 16-bit compressed instructions are zero-extended
  to 8 hex digits (e.g. `00000013` for a 32-bit nop, `00001171` for `c.addi sp,-32`... —
  i.e. the raw halfword, upper half zero).
- `rd`: writeback, exactly one of:
  - `-` — no register written;
  - `x<N>=<v>` — integer register N (x0 writes never recorded; x0 is constant);
  - `f<N>=<v>` — FP register N (f0 is a normal register — record it).
- `csr`: CSR changes made by this instruction, `-` or comma-separated `name=v`
  (lowercase CSR names, canonical aliases: `mstatus`, `mip`, `satp`, `fflags`, ...).
  CSRs are listed only when written; a pure CSR read produces no entry.

### `t` — trap taken (exceptions and interrupts)

Emitted instead of an `i` for the trapping instruction; the next `i` is the first
instruction at `target`.

- `pc`: faulting instruction address (for interrupts: the address where execution was
  interrupted).
- `cause`: full `mcause`/`scause` value, interrupt bit set for async traps
  (e.g. `8000000000000007` = M timer interrupt).
- `tval`: `mtval`/`stval`.
- `target`: trap-vector address actually taken (`mtvec`/`stvec` base + offset,
  honoring vectored mode).

`xRET` (`mret`/`sret`) is a normal `i` record (CSR side effects in the `csr` field);
the redirect is visible as the next `i`'s `pc`. `ecall` is a `t` record.

### `w` — memory write (optional extension, off by default)

Emitted immediately after the `i` that performed it (stores, AMOs, CSR-write side
effects are not memory writes and stay in `csr`). `size` ∈ {1,2,4,8}. Loads never
produce `w`. Required only for boot-phase debugging of DMA-looking code; riscv-tests
runs compare without it.

### Rules and properties

- Records appear in retire order, one hart only (R1 is uniprocessor; R3 adds a
  `h <id>` prefix field — v2, not needed now).
- The trace is complete: every retired instruction has exactly one `i` (or `t`).
- No timestamps, no cycle counts — determinism lives in `pc` order, not wall time.
- The `cycle` CSR (if traced) must therefore be defined by the engine as
  "instructions retired" and documented as such; `time` is never deterministic across
  models and is masked in the tool (§4).

## 2. Emitters

| Source | How |
|---|---|
| Engine | Rust, compile-time feature `trace` + env `RV64_TRACE=<path>` in `rv64-runner` (native build; never in the wasm hot path). The hook lives in the interpreter's retire step, shared with the wasm crate, so the traced semantics are the shipped semantics. |
| Spike | `spike2trace.py` adapter: runs `spike -p1 --isa=rv64imafdc_zicsr_zifencei_zicntr_zba_zbb_zbs -l --log-commits <elf>`, parses the commit log (`core 0: <priv> <pc> (<insn>) <commits...>` where commits are `x<N> 0x...`, `f<N> 0x...`, and CSR writes), emits canonical records. The CSR commit token varies between Spike versions — pin Spike, capture a 100-line fixture on first run, and adjust the regex at the top of the adapter if needed. |
| TinyEMU | TinyEMU fork patch: print `i`/`t` records from the CPU loop (the R0 fork already carries the `time`-CSR patch; this is the same kind of patch). Used for the boot comparison per `CONFORMANCE-PLAN.md` D.2. |

Adapters must normalize: lowercase hex, 16/8/4-digit padding, CSR aliases to canonical
names, drop x0 writes, sort nothing (retire order is preserved).

## 3. `tracediff.py` — comparison tool

Single-file Python 3.9+, standard library only, streaming (traces reach 10⁸ lines —
never load fully into memory). Placed at `web/src/engine/rv64/trace-diff/tracediff.py`
when implemented; this section is the spec.

### CLI

```
tracediff.py [options] A.trace B.trace
  --label-a NAME --label-b NAME     display labels (default: file names)
  --mask-csr LIST|@file             CSRs to ignore (comma list or file, one per line)
  --start-pc HEX                    begin comparing at the first record with pc=HEX in both
  --stop-pc HEX                     stop comparing at the first record with pc=HEX
  --max-insns N                     stop after N compared `i` records
  --context K                       context lines around a divergence (default 8)
  --with-w                          also compare `w` records (default: skip both sides' `w`)
  --json OUT                        write machine-readable report
  -q, --quiet                       only exit code
```

Exit codes: `0` — compared regions identical (or `--max-insns` reached without
mismatch); `1` — divergence found; `2` — usage/parse error.

### Comparison semantics

Records are consumed pairwise in order. For each pair:

1. Record type must match (`i`↔`i`, `t`↔`t`).
2. `i`: `pc` and `insn` must be equal. `rd`: both absent, or same register and value.
   `csr`: after removing masked names, the change sets must be equal (same names, same
   values — order-insensitive).
3. `t`: `pc`, `cause`, `target` must be equal; `tval` must be equal.
4. `w` (only with `--with-w`): `addr`, `size`, `value` equal.

First violating pair stops the run. Output: the index, both records, then K context
records from each side, then a one-line diagnosis heuristics note
(`pc differs` / `rd x5 differs: 0000...01 vs 0000...02` / `csr set differs: mstatus`).
With `--json`:

```json
{"insns_compared": 12345678, "records_a": 12345890, "records_b": 12345891,
 "first_diff": {"index": 12345678, "a": "i ...", "b": "t ..."},
 "verdict": "mismatch"}
```

### Masking and determinism

- Always-mask set (applied unless `--strict`): `time` — its value is model-specific.
  Everything else is compared exactly; masks are for *known-legitimate* differences
  only. `cycle`/`instret` are comparable because every emitter defines them as
  retired-instruction counts (engine) or model counters pinned by `--icount` (see
  harness requirements below).
- Interrupt injection timing legitimately differs between models (mtime phase).
  Whole-stream comparison therefore only works up to the first async trap. For boot
  traces: compare per phase (`--start-pc` at handler entry, `--stop-pc` at `sret`),
  or boot with a fixed icount schedule (see §4).
- Throughput target: ≥ 1M record pairs/s per side; support `.gz` inputs via `gzip`.

## 4. Harness requirements for reproducible traces

- Same ELF and same DTB for both models. Spike gets the DTB via its own config or a
  wrapper that pokes the DTB address; document whichever is used.
- icount-scheduled interrupts for lockstep boot runs: engine exposes
  `--timer-every N` (raise MTI every N retired insns, deterministic); the reference
  side uses an equivalent deterministic-timer mechanism (icount trigger or a small
  patch — both reference models here are under our control). Without this, only
  phase-window comparison (§3) is meaningful.
- Traces from one run, reused: raw engine trace + normalized reference trace are
  artifacts of CI; divergence reports link to the stored pair.

## 5. Acceptance usage

| Stage | Command shape | Pass |
|---|---|---|
| riscv-tests (per `CONFORMANCE-PLAN.md` A) | `tracediff.py --mask-csr time engine.trace spike.trace` | exit 0 for every test |
| arch-test debug | tracediff on the single failing test, engine vs Spike | first diff localizes the bug |
| Boot M0–M3 | `tracediff.py --mask-csr time --with-w engine.trace spike.trace` (first ~100M insns or until first IRQ) | exit 0 |
| Boot post-IRQ | per-handler windows `--start-pc <stvec+off> --stop-pc <sret>` | each window exit 0 |
