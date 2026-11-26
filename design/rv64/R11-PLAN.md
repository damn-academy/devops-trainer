# R11: restore SMP profile attribution, then test bounded JIT headroom

Proposed work, not implemented by the R10 analysis commit. Branch feat/rv64-r0;
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

Only after attribution works, propose an opt-in **384 MiB per-hart ceiling**
(default remains 256) while retaining the **2560 MiB aggregate target**, 256 MiB
reserve, dynamic allowance, 75% eviction target, secondary function/encoded
caps and in-flight limits. Add a bounded page/harness setting for this A/B;
this setting does not yet exist, so the command below deliberately uses build
labels, not a fictitious environment option. Verify budget arithmetic with
both harts, private-memory growth and pressure reduction. A ceiling is not an
allocation guarantee: dynamic per-hart allowance always wins. Repeat the full
gates after implementing the experiment.

Compare observer-fixed control and candidate builds sequentially on an awake
Mac, identical medium, 2 harts, 1024 MiB, interval=1000003, same CONFIG_CREATED
activation. At least two runs of each, alternating order, no edits/HMR during
runs. Change only the ceiling between builds. Preserve unique result names and
record their build hashes. Do not compare directly to R9 to claim causation.

```bash
# First run: fixed observer, default 256 MiB build.
# For subsequent runs set a unique label, e.g. R11-observer-256-b,
# R11-budget-384-a / R11-budget-384-b, after selecting the gated build/setting.
cd ~/projects/devops-trainer/web
RUN_LABEL=R11-observer-256-a
caffeinate -dimsu env \
  RV64_RESULT_NAME="$RUN_LABEL" \
  RV64_HARTS=2 RV64_MEMORY_MB=1024 \
  RV64_PROBE_SECONDS=700 RV64_TIMEOUT_MS=760000 \
  RV64_GUEST_PROFILE_INTERVAL=1000003 \
  RV64_GUEST_PROFILE_START_AFTER=RV64_CONFIG_CREATED \
  RV64_MEDIA_MANIFEST=/rv64/r6-uncompressed-no-reboot.json \
  node src/engine/rv64/measure.mjs --smp-kuberoot \
  > "public/rv64/results/$RUN_LABEL-run.log" 2>&1
# A nonzero readiness result is expected for a diagnostic timeout; inspect JSON.
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
