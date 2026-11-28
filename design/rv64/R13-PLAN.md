# R13: shared code without serialized eviction latency

Branch `feat/rv64-r0`; baseline HEAD `94be4b7`, rebuilt R12 `fab4bfb`.
No push. Operator owns pod builds and browser runs. Keep R6 media, observer,
guest deadlines, memory target and measure.mjs semantics unchanged.

## Implementation

The broker removes all selected LRU victims from the index synchronously and
sends one serial-list revoke per holding hart. One batch remains in flight;
all holders ACK in parallel, after Rust unlink and table-slot nulling. Code
and remaining instances stay charged until all ACKs. Local releases can refund
only their own dropped instance; they are never eviction ACKs. Admission uses
full live charge, including revoked code and all compile reservations. It can
proceed during revocation if the remaining budget suffices. Otherwise it waits
for one batch and rechecks atomically before reserving; oversized/unavailable
admissions are rejected. Proactive trimming starts at 85%, targeting 75%.

Requests pin selected modules until their replies are posted. Pending keys
are deduplicated in the broker, while independent jobs compile on a pool of
workers, defaulting to the hart count and capped at four. Each job reserves
code charge before dispatch, including queued pool jobs. Per-hart requests
remain capped at two and the existing 1024-block queue limit is unchanged.
Instance admission is separately reserved. Budget shrink rejects completed
jobs that no longer fit. Failed jobs return their reservations.

Every reply renews a per-hart module lease. Local release carries that lease;
a stale release cannot remove a newer acquisition. Releases during pinned
requests are deferred until reply publication and checked against the renewed
lease. Reset changes the client epoch, cancels pending acquisitions and drops
old leases. Replies are posted before deferred trim can revoke them.

CPU workers already yield via MessageChannel after an 8 ms wall-time check,
following bounded `smp_run(2048)` calls; no SAB mailbox is added. Batch handling
runs outside Rust and ACK follows unlink plus table cleanup for every serial.
The check is not a hard 8 ms scheduler guarantee: inspect measured revoke RTT
under 2/4-hart browser load. No guest timeout or execution slice is changed.

All R12 metrics remain. New aggregate fields: `revokeBatches`, `revokedBytes`,
`revokeRoundTripMeanMs/MaxMs`, `admissionWaits`, `admissionWaitMeanMs/MaxMs`,
`compilePoolSize/Busy/Queued`, `compileJobs`, `compileJobMeanMs/MaxMs`.
Broker reports use actual leaf-worker compile duration (excluding pool queue
and admission wait). Per-hart latency retains end-to-end queue-to-install time.
No extra memory allowance is added: code is 8x bytes + 64 KiB/module and
instances are 4 KiB + 512 B/export/hart. Pending encoded bytes and worker heap/
GC lag must still fit the existing host reserve in the browser measurements.

## Gates

Run the same native, ISA, arch, rebuilt WASM, integration and six browser gates
as R12, with R13 artifact names. The sixth integration case additionally
revokes shared modules on both harts, checks empty slots and zero accounting,
then recompiles and verifies execution without cache clears.

```bash
cd ~/projects/devops-trainer
export KUBECONFIG="$HOME/workshop.txt"
scripts/rv64-dev.sh cargo test --release
scripts/rv64-dev.sh test-isa
scripts/rv64-dev.sh cargo build --release --bin rv64-runner
kubectl exec -i --context admin@workshop -n tenant-kuberoot rv64-dev -- \
  bash -se < scripts/rv64-arch-tests.sh
scripts/rv64-dev.sh wasm
rg 'jit_share_abi' web/public/rv64/rv64_core.js
git rev-parse HEAD
shasum -a 256 web/public/rv64/slim-vmlinuz.efi web/public/rv64/rv64_core_bg.wasm
python3 scripts/test-rv64-guest-profile.py
python3 scripts/test-rv64-guest-callers.py
cd web
npm run typecheck
npx vitest run tests/rv64*.test.ts
RV64_SMP_JIT=1 npx vitest run tests/rv64-smp-jit.integration.test.ts --silent=false
RV64_RESULT_NAME=R13-jit-gates node src/engine/rv64/measure.mjs --jit-gates
RV64_RESULT_NAME=R13-smp-substrate node src/engine/rv64/measure.mjs --smp-substrate
RV64_RESULT_NAME=R13-smp-trace node src/engine/rv64/measure.mjs --smp-trace
RV64_RESULT_NAME=R13-smp-linux node src/engine/rv64/measure.mjs --smp-linux
RV64_RESULT_NAME=R13-smp-trace-linux node src/engine/rv64/measure.mjs --smp-trace-linux
RV64_RESULT_NAME=R13-smp-snapshot node src/engine/rv64/measure.mjs --smp-snapshot
```

Require native green, ISA 173/0, architecture signatures 266/0, all six enabled
integration cases and every browser gate. Also exercise the actual shared
kuberoot path at 2 and 4 harts; no stale-module execution, deadlocked revoke,
cache clear from fences, renderer crash or unbounded queue is acceptable.

Verify R6 media using the hash/length command in R10-PLAN.md before comparisons.
Pin kernel db43c7264ee97779f9271ebb6c57e90df675d7ab768462e01115d84d4f7cd598,
manifest version 29d01f8c77ea7d7e3db539d7b9259943187cad88b3c3ccdada122702ab7a0059
(630194176 bytes). Save commit and WASM/media hashes with every run.

## 700 s A/B, both ceilings

Compare `R13-shared-384-a` against `R11-budget-384-a` and
`R13-shared-256-a` against `R11-observer-256-a`, sequentially on an awake Mac,
with identical media, two harts and observer. Save commit and WASM/media hashes.

```bash
cd ~/projects/devops-trainer/web
RUN_LABEL=R13-shared-384-a
caffeinate -dimsu env \
  VITE_RV64_JIT_BUDGET_MB=384 RV64_RESULT_NAME="$RUN_LABEL" \
  RV64_HARTS=2 RV64_MEMORY_MB=1024 \
  RV64_PROBE_SECONDS=700 RV64_TIMEOUT_MS=760000 \
  RV64_GUEST_PROFILE_INTERVAL=1000003 \
  RV64_GUEST_PROFILE_START_AFTER=RV64_CONFIG_CREATED \
  RV64_MEDIA_MANIFEST=/rv64/r6-uncompressed-no-reboot.json \
  node src/engine/rv64/measure.mjs --smp-kuberoot \
  > "public/rv64/results/$RUN_LABEL-run.log" 2>&1
cd ..
python3 scripts/rv64-guest-profile.py \
  "web/public/rv64/results/$RUN_LABEL.json" \
  --symbols web/public/rv64/profile-symbols/all.json.gz \
  --maps web/public/rv64/profile-symbols/maps.json \
  > "web/public/rv64/results/$RUN_LABEL-profile.json"
```

Repeat the command with `RUN_LABEL=R13-shared-256-a` and
`VITE_RV64_JIT_BUDGET_MB=256` (all other parameters identical). Preserve JSON,
run log, console and profile for both. Repeat alternating baseline/candidate
runs with `-b` labels; rebuild matching WASM for each revision. Also exercise
four harts with unique labels before accepting the pool/revoke implementation.
A diagnostic timeout/pass=false is not node readiness.

Acceptance: end-to-end compile latency mean within 2x the matched R11 mean
(14–18 ms), containerd boot faster than matched R11 (94 s at 384, 85 s at 256),
and retention at least R12 (40,704 / 26,043 unique blocks; 3,470 modules at 384).
Compare matching READYZ_END windows, per-hart retired/JIT/helper/inline/chain
rates, compile/eviction rates, pool occupancy, admission waits and revoke RTT.
Keep unique blocks separate from per-hart installed copies. Require no stale
execution, revoke deadlock, fence cache clear, renderer crash or unbounded
queue. Report profile identity/stack/dropped-history coverage and keep SATPs
and restart windows distinct. Do not relax memory or observer settings to pass.

## 3000 s stability run, only after short gates pass

```bash
cd ~/projects/devops-trainer/web
RUN_LABEL=R13-shared-384-3000s
caffeinate -dimsu env \
  VITE_RV64_JIT_BUDGET_MB=384 RV64_RESULT_NAME="$RUN_LABEL" \
  RV64_HARTS=2 RV64_MEMORY_MB=1024 \
  RV64_PROBE_SECONDS=3000 RV64_TIMEOUT_MS=3300000 \
  RV64_GUEST_PROFILE_INTERVAL=1000003 \
  RV64_GUEST_PROFILE_START_AFTER=RV64_CONFIG_CREATED \
  RV64_MEDIA_MANIFEST=/rv64/r6-uncompressed-no-reboot.json \
  node src/engine/rv64/measure.mjs --smp-kuberoot \
  > "public/rv64/results/$RUN_LABEL-run.log" 2>&1
```

This is a host-time cap and may finish at PROBE_DONE; keep console lifecycle and
SIGQUIT/restart windows distinct. Capture external browser/process RSS if UA
memory is unavailable; null is not zero. Require bounded live accounting after
quiescent eviction and stable actual memory below the 2560 MiB target (including
shared RAM, private cores, JIT and reserve). Report compilingBytes and delayed
ACK/GC overshoot separately; stop on persistent actual-memory growth or target
violation. A 700 s result is not a 3000 s stability result. Never force browser
GC to manufacture a memory pass.

## Local validation

Local `npm run typecheck` passed; `npx vitest run tests/rv64*.test.ts` passed
70 tests with six opt-in integration cases skipped. Enabled WASM integration
and all pod/browser gates are operator-owned. Performance and 3000 s memory acceptance
remain pending those runs.
