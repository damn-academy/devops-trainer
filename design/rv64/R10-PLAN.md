# R10: bounded host memory and pre-SIGQUIT profiling

Branch `feat/rv64-r0`; sign off the commit; do not push. Operator owns pod,
WASM builds and browser runs. Preserve the R6 medium and guest timeouts.
Run one measurement at a time on an awake Mac with no edits/HMR.

R9 throughput and restart evidence are in R6-LOG.md. R10 bounds retained host
history and adds per-hart usage-based JIT eviction under a 2560 MiB accounting
budget (256 MiB non-JIT reserve, at most 256 MiB estimated live JIT per hart).
The estimate charges 8x encoded bytes + 64 KiB/module. Actual browser memory
is reported separately when the isolated UA API is available; it is not an
RSS guarantee. Shared memories count once; private wasm memory counts per hart.
No Rust/ABI changes: ABI 9 remains required. Existing function and encoded
caps remain secondary ceilings; expect less live code and potentially more
recompilation than R9. Measure throughput, rather than assuming it is unchanged.

Local validation: typecheck and 54 RV64 unit tests passed; four opt-in wasm
integration cases skipped locally. The operator must run every gate below;
R9's successful gate results do not substitute for this R10 run.

## Rebuild and correctness gates (operator)

Stop on any failure. Old WASM must not be used with the 24-field JIT frame.
CPU workers enforce `smp_jit_abi() == 9`. Record the commit and WASM hash.

```bash
cd ~/projects/devops-trainer
export KUBECONFIG="$HOME/workshop.txt"
scripts/rv64-dev.sh cargo test --release
scripts/rv64-dev.sh test-isa
scripts/rv64-dev.sh cargo build --release --bin rv64-runner
kubectl exec -i --context admin@workshop -n tenant-kuberoot rv64-dev -- \
  bash -se < scripts/rv64-arch-tests.sh
scripts/rv64-dev.sh wasm
# Rebuild from R9: JIT frame ABI changed from 22 to 24 u64 fields.
rg 'smp_jit_abi' web/public/rv64/rv64_core.js
git rev-parse HEAD
shasum -a 256 web/public/rv64/rv64_core_bg.wasm
cd web
npm run typecheck
npx vitest run tests/rv64*.test.ts
RV64_SMP_JIT=1 npx vitest run tests/rv64-smp-jit.integration.test.ts --silent=false
RV64_RESULT_NAME=R10-jit-gates node src/engine/rv64/measure.mjs --jit-gates
RV64_RESULT_NAME=R10-smp-substrate node src/engine/rv64/measure.mjs --smp-substrate
RV64_RESULT_NAME=R10-smp-trace node src/engine/rv64/measure.mjs --smp-trace
```


Required results: cargo tests green; test-isa 173/0; architecture signatures
266/0; all RV64 Vitest tests green. RV64_SMP_JIT=1 must run all four integration
cases, including the new two-Engine Sv39 inline-store/SBI RFENCE regression.
It requires nonzero smp_inline_stores and smp_jit_chains, a generation change
before ACK, no helper store during the rewrite, the new guest result afterward,
resumed chaining and zero cache clears. The generated-code unit suite separately
requires stale chain rejection even without flushing the private fetch TLB,
unsigned generation wrap, LR/SC correctness and 10,000 bounded chains.

Also run the real-boot, trace and snapshot gates:

```bash
# In web/
RV64_RESULT_NAME=R10-smp-linux node src/engine/rv64/measure.mjs --smp-linux
RV64_RESULT_NAME=R10-smp-trace-linux node src/engine/rv64/measure.mjs --smp-trace-linux
RV64_RESULT_NAME=R10-smp-snapshot node src/engine/rv64/measure.mjs --smp-snapshot
```

## Capture the TLS window before the retained diagnostic SIGQUIT

First run a separate short capture. Start sampling at RV64_CONFIG_CREATED
instead of RV64_READYZ_BEGIN; the marker is emitted before the ready loop and
diagnostic failures. Stop at 700 host seconds, before the R9 SIGQUIT at guest
844 / ~885 host seconds. If this run's timing changes enough that SIGQUIT comes
earlier, shorten to 500 seconds. Read marker/guest time from this run itself.
The page timeout returns JSON with pass=false: this is an intentional diagnostic
capture, not a readiness success. The harness may exit nonzero after writing it.
Use a sparser interval to retain more wall time inside the bounded history.

```bash
cd ~/projects/devops-trainer/web
caffeinate -dimsu env \
  RV64_RESULT_NAME=R10-smp-2h-tls-profile-700s \
  RV64_HARTS=2 RV64_MEMORY_MB=1024 \
  RV64_PROBE_SECONDS=700 RV64_TIMEOUT_MS=760000 \
  RV64_GUEST_PROFILE_INTERVAL=1000003 \
  RV64_GUEST_PROFILE_START_AFTER=RV64_CONFIG_CREATED \
  RV64_MEDIA_MANIFEST=/rv64/r6-uncompressed-no-reboot.json \
  node src/engine/rv64/measure.mjs --smp-kuberoot \
  > public/rv64/results/R10-smp-2h-tls-profile-700s-run.log 2>&1
cd ..
python3 scripts/rv64-guest-profile.py \
  web/public/rv64/results/R10-smp-2h-tls-profile-700s.json \
  --symbols web/public/rv64/profile-symbols/all.json.gz \
  --maps web/public/rv64/profile-symbols/maps.json \
  > web/public/rv64/results/R10-smp-2h-tls-profile.json
```

Also use scripts/rv64-guest-callers.py (see --help) to attribute sampled P-256
helpers to TLS callers. Separate PID/SATP and the fatal-hook restart. Look for
crypto/tls, nistec/p256, field/scalar math versus Go GC/scheduling and SQLite.
Do not infer crypto CPU starvation simply from net/http timeout strings.
Inspect metricsDropped and profile dropped counts; retained history is a tail,
not an unbiased whole-run sample. The short capture persists JSON before
SIGQUIT; the long run below may overwrite the earlier window in its ring.

## R6 media verification and 3000-second run

```bash
cd ~/projects/devops-trainer
python3 - <<'PY'
import hashlib, json
from pathlib import Path
manifest = json.loads(Path('web/public/rv64/r6-uncompressed-no-reboot.json').read_text())
image = Path('web/public') / manifest['url'].lstrip('/')
assert image.stat().st_size == manifest['bytes']
with image.open('rb') as stream:
    assert hashlib.file_digest(stream, 'sha256').hexdigest() == manifest['version']
print(manifest)
PY
cd web
mkdir -p public/rv64/results
caffeinate -dimsu env \
  RV64_RESULT_NAME=R10-smp-2h-uncompressed-1024-3000s \
  RV64_HARTS=2 RV64_MEMORY_MB=1024 \
  RV64_PROBE_SECONDS=3000 RV64_TIMEOUT_MS=3300000 \
  RV64_GUEST_PROFILE_INTERVAL=100003 \
  RV64_GUEST_PROFILE_START_AFTER=RV64_READYZ_BEGIN \
  RV64_MEDIA_MANIFEST=/rv64/r6-uncompressed-no-reboot.json \
  node src/engine/rv64/measure.mjs --smp-kuberoot \
  > public/rv64/results/R10-smp-2h-uncompressed-1024-3000s-run.log 2>&1
cd ..
python3 scripts/rv64-guest-profile.py \
  web/public/rv64/results/R10-smp-2h-uncompressed-1024-3000s.json \
  --symbols web/public/rv64/profile-symbols/all.json.gz \
  --maps web/public/rv64/profile-symbols/maps.json \
  > web/public/rv64/results/R10-smp-2h-profile.json
```

The harness allows up to 3000 host seconds and may finish early at PROBE_DONE;
it does not promise 3000 guest seconds. Keep result JSON, run log and console,
including partial JSON if an outer timeout occurs. Match media and WASM hashes,
one boot, two harts/1024 MiB and awake-Mac timing. The retained diagnostic probe
can induce SIGQUIT again; separate pre-signal and post-restart measurements.

## Acceptance

- All existing gates must remain green, including four enabled integration cases.
- Retain run log, JSON, console tail and dropped counts. Host-memory METRICS
  must appear every ~30 seconds (first record may lag by one reporting tick).
  Check UA status rather than interpreting null bytes as zero memory.
- Confirm shared RAM is counted once, private memories for both harts, modules,
  installedWasmBytes, estimatedHostBytes and per-hart hostBudget. Cache eviction
  must occur by usage with zero fence-induced clears. No profile/console growth
  beyond their declared bounds; report any discarded records.
- Account for up to two in-flight batches per hart. If observed memory stays
  above 2560 MiB despite eviction, stop and report the irreducible/private wasm
  and browser/native overhead. Do not claim a hard RSS guarantee from encoded
  bytes or force GC through browser-only test APIs.
- Compare R9 containerd 49 s, shell 6.0 / 9.8 s, retired/JIT/helper/inline/chain
  rates and interval churn for both harts. Report regressions from smaller live
  code allowance. Preserve TLS, fatal-hook and induced-SIGQUIT windows separately.
- A completed 3000-second capture with no renderer crash is a memory stability
  result; successful readyz is a separate guest readiness result.
