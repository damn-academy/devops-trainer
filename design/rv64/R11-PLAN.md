# R11: restore SMP profile attribution, then test bounded JIT headroom

Observer and opt-in ceiling implemented after the R10 analysis commit. Branch feat/rv64-r0;
sign off commits, exactly one Assisted-by: LLM trailer, do not push. Operator
owns pod builds and browser runs. Preserve the R6 medium and guest deadlines.

R10 cannot decide whether TLS/P-256 dominates: every user sample has empty
comm and stack validity. Kernel shares are 53–72% before READYZ_END, 33–37%
afterward; the rest is unidentifiable user work. Meanwhile both harts evict
~1.2–1.7k blocks/s and retain only ~11–16k. See R6-LOG.md for denominators,
coverage and memory evidence. Do not change TLS on this evidence.

## First change: observer-only shared-memory reads

Make profile resident reads address the actual SMP shared RAM backend, with
bounds, page-crossing and resident checks. Preserve private-memory support.
Do not use ordinary guest reads that fault, set A/D bits, mutate TLBs, hydrate
lazy pages or touch MMIO. Validate the audited kernel hash before using the
1704 task_comm offset in SMP, as the single-hart page already does. Keep row
format, profile interval and guest timing unchanged. Shared reads can race a
running hart; reject inconsistent/unavailable mappings rather than inventing
stack words. Never infer PID from SATP.

Gates: new native/shared observer tests cover valid task/stack reads, zero and
invalid PTEs, U/R permission checks, cross-page/bounds/lazy failures, unchanged
PTE A/D and memory, no MMIO/hydration, and private-memory regression. Add a
wasm SMP integration case proving nonzero comm and valid stack words from an
explicitly populated shared address space. Rebuild and run every R10 correctness
gate: cargo test --release, ISA 173/0, arch signatures 266/0, wasm rebuild,
typecheck, all rv64 Vitest tests, enabled SMP JIT integration (all previous four
plus new coverage), jit-gates, smp-substrate, smp-trace, smp-linux,
smp-trace-linux, smp-snapshot. Use exact commands in R10-PLAN.md; no old WASM.
Record commit, kernel/media/WASM hashes. Existing Python tests must pass too:

```bash
python3 scripts/test-rv64-guest-profile.py
python3 scripts/test-rv64-guest-callers.py
```

First rerun the 700 s R10 command below with the fixed observer and unchanged
256 MiB ceiling. Require identifiable Go comms, symbolized user PCs, nonzero
stack validity and explicit per-hart/window coverage. Unwind metadata must
match the exact control binary hash. Stop causal TLS analysis if those gates
fail; empty caller output is not evidence of no crypto. Keep SATPs separate
and use console lifecycle markers for restarts, never guessed PID mappings.

## Second change: controlled JIT ceiling experiment

Only after attribution works, run the opt-in **384 MiB per-hart ceiling**
(default remains 256) while retaining the **2560 MiB aggregate target**, 256 MiB
reserve, dynamic allowance, 75% eviction target, secondary function/encoded
caps and in-flight limits. The page accepts `?jitBudgetMb=256` or `?jitBudgetMb=384`; the URL takes
precedence over `VITE_RV64_JIT_BUDGET_MB` (inherited by Vite from the unchanged
measurement harness). Missing settings default to 256; other values fail.
The initial worker allowance and subsequent updates use the dynamic minimum.
Capture records `configuredJitCeiling`; host-memory records also report the
pressure-reduced `jitCeiling`, both in bytes. Verify budget arithmetic with
both harts, private-memory growth and pressure reduction. A ceiling is not an
allocation guarantee: dynamic per-hart allowance always wins. Repeat the full
gates after implementing the experiment.

Compare observer-fixed control and candidate builds sequentially on an awake
Mac, identical medium, 2 harts, 1024 MiB, interval=1000003, same CONFIG_CREATED
activation. At least two runs of each, alternating order, no edits/HMR during
runs. Use the same gated build and change only the ceiling setting between runs. Preserve unique result names and
record their build hashes. Do not compare directly to R9 to claim causation.

```bash
# Control: fixed observer, 256 MiB ceiling.
cd ~/projects/devops-trainer/web
mkdir -p public/rv64/results
RUN_LABEL=R11-observer-256-a
caffeinate -dimsu env \
  VITE_RV64_JIT_BUDGET_MB=256 RV64_RESULT_NAME="$RUN_LABEL" \
  RV64_HARTS=2 RV64_MEMORY_MB=1024 \
  RV64_PROBE_SECONDS=700 RV64_TIMEOUT_MS=760000 \
  RV64_GUEST_PROFILE_INTERVAL=1000003 \
  RV64_GUEST_PROFILE_START_AFTER=RV64_CONFIG_CREATED \
  RV64_MEDIA_MANIFEST=/rv64/r6-uncompressed-no-reboot.json \
  node src/engine/rv64/measure.mjs --smp-kuberoot \
  > "public/rv64/results/$RUN_LABEL-run.log" 2>&1

# Candidate: same build, only ceiling changes to 384 MiB.
# Run sequentially after inspecting control attribution. For repeats use -b labels.
RUN_LABEL=R11-budget-384-a
caffeinate -dimsu env \
  VITE_RV64_JIT_BUDGET_MB=384 RV64_RESULT_NAME="$RUN_LABEL" \
  RV64_HARTS=2 RV64_MEMORY_MB=1024 \
  RV64_PROBE_SECONDS=700 RV64_TIMEOUT_MS=760000 \
  RV64_GUEST_PROFILE_INTERVAL=1000003 \
  RV64_GUEST_PROFILE_START_AFTER=RV64_CONFIG_CREATED \
  RV64_MEDIA_MANIFEST=/rv64/r6-uncompressed-no-reboot.json \
  node src/engine/rv64/measure.mjs --smp-kuberoot \
  > "public/rv64/results/$RUN_LABEL-run.log" 2>&1
# A nonzero readiness result is expected for a diagnostic timeout; inspect JSON.
# Run the following analysis for each completed RUN_LABEL (control before candidate).
cd ..
python3 scripts/rv64-guest-profile.py \
  "web/public/rv64/results/$RUN_LABEL.json" \
  --symbols web/public/rv64/profile-symbols/all.json.gz \
  --maps web/public/rv64/profile-symbols/maps.json \
  > "web/public/rv64/results/$RUN_LABEL-profile.json"
python3 scripts/rv64-guest-callers.py \
  "web/public/rv64/results/$RUN_LABEL.json" \
  --symbols web/public/rv64/profile-symbols/all.json.gz \
  --maps web/public/rv64/profile-symbols/maps.json \
  --unwind-symbols web/public/rv64/profile-symbols/control-callers.json.gz \
  > "web/public/rv64/results/$RUN_LABEL-callers.json"
```

Acceptance: no correctness regression/crash, no fence-induced clears, bounded
history with dropped counts reported, no accounting-target violation after
quiescent eviction (report in-flight overshoot separately). Record external
browser/process memory if UA memory remains unavailable; null is never zero.
Stop if actual observed memory persists above the target; do not infer safety
from encoded bytes or force GC. The 700 s result is not a long-run memory gate;
only a successful candidate proceeds to the R10 3000 s stability command.

Compare per-hart and identical marker windows: sample/identity/stack coverage,
crypto/tls, P-256, field/bigmod, GC/scheduler, SQLite/kine, kernel; attempted
instruction shares remain distinct from wall time. For WFI residence, require
an explicit cumulative observer timing metric in a separately reviewed change;
current lifecycle state and instruction samples cannot provide that fraction.
Also compare retired/JIT/helper/inline/chain rates, compilation/eviction rates,
retained modules/bytes, private wasm growth, total host accounting, containerd
boot duration and readyz status. Claim a budget benefit only if reduced churn
and improved throughput/boot duration repeat without memory regression.

If crypto dominates **resolved** samples and exact caller chains connect the
P-256/field work to TLS, then propose a separate cheaper authenticated TLS
configuration experiment with the actual guest Go/server support verified.
Do not disable verification, weaken TLS, alter timeouts or rewrite the medium
as part of this profiling/budget experiment. If SQL/GC or server initialization
dominates instead, follow that evidence. No TLS choice is justified yet.

## Implementation and local validation

The observer reads the selected RAM backend directly, bounds resident reads,
checks Sv39 reserved bits, leaf alignment and U/R permissions, rejects page
crossings and rechecks the full walked PTE path and sampled data. It does not
call guest reads, loaders, MMIO or TLB code. Shared reads remain best-effort:
observed changes are rejected; concurrent ABA changes cannot be excluded
without pausing harts. No PID is inferred. The audited kernel SHA-256 is checked
before SMP workers receive task_comm offset 1704. Row shape and timing remain
unchanged.

Native tests include both private and callback-backed shared RAM, three-level
walks, changing intermediate/leaf PTEs and data, zero/invalid/reserved PTEs,
permissions, alignment, page crossings, bounds, lazy tables/data, no hydration
or MMIO and unchanged backing memory/A/D bits. The fifth enabled wasm SMP
integration case explicitly populates shared Sv39 mappings, enters user mode
on each of two Engines and requires `kubectl` comm, all 32 valid stack words,
and unchanged RAM and generation counters. It must run against rebuilt WASM.

Local checks: TypeScript typecheck, 55 RV64 Vitest tests and both Python suites
(5 + 2 tests) passed. Five opt-in WASM integration cases are skipped locally.
Rust/cargo/wasm-bindgen are unavailable on this Mac; no pod builds or browser
gates were run, per operator ownership. Native tests, ISA 173/0, architecture
266/0, rebuilt WASM, all five enabled integration cases and every R10 browser
gate above remain required operator validation; no old-WASM result is claimed.
Record the tested commit with `git rev-parse HEAD` and fresh artifacts with:

```bash
shasum -a 256 web/public/rv64/slim-vmlinuz.efi web/public/rv64/rv64_core_bg.wasm
cat web/public/rv64/r6-uncompressed-no-reboot.json
```

The kernel must match `db43c7264ee97779f9271ebb6c57e90df675d7ab768462e01115d84d4f7cd598`.
Verify the media file against the manifest using the R10 command before runs.
Do not treat local checks as evidence of successful attribution or budget benefit.

At implementation time the local kernel hash matched the pin above. The R6
manifest version was `29d01f8c77ea7d7e3db539d7b9259943187cad88b3c3ccdada122702ab7a0059`
(630194176 bytes). The **old, unrebuilt** local WASM hash was
`e2b47d3afcb15a6579a0c603f872cf3d5754371edfd4485bbb119b595c34ca7c`;
it is not an R11 validation artifact and must be replaced before enabled gates.
