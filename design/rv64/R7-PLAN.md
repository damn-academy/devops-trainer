# R7: validate retained SMP code under Linux

Do not push. Use branch `feat/rv64-r0`. Reuse the R6 uncompressed medium;
no rootfs rebuild, Kubernetes changes or probe regeneration. Run one browser
measurement at a time, with no edits/HMR. The local R6 ablation is NOT a build.

## Rebuild and correctness gates (lead with cluster access)

From repository root, using the existing rv64-dev workspace/toolchain:

```bash
cd ~/projects/devops-trainer
export KUBECONFIG="$HOME/workshop.txt"
scripts/rv64-dev.sh cargo test --release
scripts/rv64-dev.sh test-isa
scripts/rv64-dev.sh cargo build --release --bin rv64-runner
kubectl exec -i --context admin@workshop -n tenant-kuberoot rv64-dev -- \
  bash -se < scripts/rv64-arch-tests.sh
scripts/rv64-dev.sh wasm
# Must expose the new method; never copy the /tmp ablation to public/rv64.
rg 'smp_sfence' web/public/rv64/rv64_core.js
shasum -a 256 web/public/rv64/rv64_core_bg.wasm
cd web
npm run typecheck
npx vitest run tests/rv64*.test.ts
RV64_SMP_JIT=1 npx vitest run tests/rv64-smp-jit.integration.test.ts --silent=false
RV64_RESULT_NAME=R7-jit-gates node src/engine/rv64/measure.mjs --jit-gates
RV64_RESULT_NAME=R7-smp-substrate node src/engine/rv64/measure.mjs --smp-substrate
RV64_RESULT_NAME=R7-smp-trace node src/engine/rv64/measure.mjs --smp-trace
```

Stop on any failure. The integration regression must report one compilation per
hart, zero full clears, and (for two harts) 20 serviced translation fences and
21 TLB flushes per hart including startup. Both harts retire 2,000,000 instructions.
Also run the existing real-boot/snapshot gates before accepting Linux behavior:

```bash
# Still in web/; these can take longer and belong to the lead.
RV64_RESULT_NAME=R7-smp-linux node src/engine/rv64/measure.mjs --smp-linux
RV64_RESULT_NAME=R7-smp-trace-linux node src/engine/rv64/measure.mjs --smp-trace-linux
RV64_RESULT_NAME=R7-smp-snapshot node src/engine/rv64/measure.mjs --smp-snapshot
```

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
  RV64_RESULT_NAME=R7-smp-2h-uncompressed-1024-3000s \
  RV64_HARTS=2 RV64_MEMORY_MB=1024 \
  RV64_PROBE_SECONDS=3000 RV64_TIMEOUT_MS=3300000 \
  RV64_GUEST_PROFILE_INTERVAL=100003 \
  RV64_GUEST_PROFILE_START_AFTER=RV64_READYZ_BEGIN \
  RV64_MEDIA_MANIFEST=/rv64/r6-uncompressed-no-reboot.json \
  node src/engine/rv64/measure.mjs --smp-kuberoot \
  > public/rv64/results/R7-smp-2h-uncompressed-1024-3000s-run.log 2>&1
cd ..
python3 scripts/rv64-guest-profile.py \
  web/public/rv64/results/R7-smp-2h-uncompressed-1024-3000s.json \
  --symbols web/public/rv64/profile-symbols/all.json.gz \
  --maps web/public/rv64/profile-symbols/maps.json \
  > web/public/rv64/results/R7-smp-2h-profile.json
```

The harness allows up to 3000 host seconds and may finish early at PROBE_DONE;
it does not promise 3000 guest seconds. Keep result JSON, run log and console,
including partial JSON if an outer timeout occurs. Match media and WASM hashes,
one boot, two harts/1024 MiB and awake-Mac timing. The retained diagnostic probe
can induce SIGQUIT again; separate pre-signal and post-restart measurements.

## Acceptance and next diagnosis

Use full JSON `samples[].metrics` for BOTH harts (the console METRICS stream
shows whichever hart reported last). Compute interval rates, not just totals:
`delta retired / delta hostMonotonicMs / 1000` = MIPS;
`delta jitRetired / delta retired` = JIT fraction;
`delta compiled / delta seconds` = compilation rate.

- All per-hart messages contain `counters`, `compiler`, `remote`.
- Translation fence counts may grow, but must not cause `jit_cache_clears`.
  Remaining clears must be explained by remote instruction fences/explicit
  clears. `invalidations` distinguishes these from page-generation changes.
- Compare late-window compilation rate with R6b's 6.06 million recompiles in
  its last two thirds. Expect code reuse and materially higher JIT share/MIPS;
  no numeric Linux speedup target is justified by the short synthetic experiment.
- Compiler pending/inflight/latency, queue-full and evictions must not grow
  without bound. If shared-generation changes dominate, inspect same-page
  code/data writes before attempting byte-range tracking. If instruction fences
  dominate, investigate their call sites and dirty-page-only instruction clearing.
- Primary functional outcome: control passes package init, starts writing its
  service log, binds 6443 and eventually passes readyz. Record the actual uptime
  of each event. Absence of readyz alone does not refute the JIT fix; inspect
  stacks/profiles for the next bottleneck. Do not label this issue fully resolved
  until rebuilt gates and the real two-hart run confirm it.
