# R9: inline SMP RAM and generation-guarded tail chaining

Branch `feat/rv64-r0`; do not push. The operator runs the pod, WASM build and
browser gates. Preserve the R6 uncompressed medium and existing streaming
measurement harness (4ce675c); no edits to measure.mjs, rootfs or Kubernetes.
Run one browser measurement at a time, without edits/HMR, on an awake Mac.

## Implementation and measurement contract

See `R6-LOG.md` for exact R8 totals, coherence protocol and memory accounting.
RAM is already shared WebAssembly.Memory. Generated SMP code now imports it
as memory 1; shared generation/reservation wasm memories are imports 2/3.
Aligned permitted TLB hits use wasm atomics with no JS memory-access import.
LR/SC and AMOs keep helpers. Stores preserve the writer lock and both generation
protocols. Chains recheck the live shared physical-page generation each time.
Single-hart RAM access retains its existing path.

SMP cache limits are 131,072 installed functions and 128 MiB encoded wasm per
hart; eviction targets 75% of both. These are not native-code/RSS limits.
Record installedWasmBytes, installedWasmLimit and installedLimit with interval
churn. Metadata for 1024 MiB RAM is shared once: generations 1 MiB, epochs
32 MiB + 64 KiB. The latter adds 62 KiB versus the old SAB allocation.

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
RV64_RESULT_NAME=R9-jit-gates node src/engine/rv64/measure.mjs --jit-gates
RV64_RESULT_NAME=R9-smp-substrate node src/engine/rv64/measure.mjs --smp-substrate
RV64_RESULT_NAME=R9-smp-trace node src/engine/rv64/measure.mjs --smp-trace
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
RV64_RESULT_NAME=R9-smp-linux node src/engine/rv64/measure.mjs --smp-linux
RV64_RESULT_NAME=R9-smp-trace-linux node src/engine/rv64/measure.mjs --smp-trace-linux
RV64_RESULT_NAME=R9-smp-snapshot node src/engine/rv64/measure.mjs --smp-snapshot
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
  RV64_RESULT_NAME=R9-smp-2h-uncompressed-1024-3000s \
  RV64_HARTS=2 RV64_MEMORY_MB=1024 \
  RV64_PROBE_SECONDS=3000 RV64_TIMEOUT_MS=3300000 \
  RV64_GUEST_PROFILE_INTERVAL=100003 \
  RV64_GUEST_PROFILE_START_AFTER=RV64_READYZ_BEGIN \
  RV64_MEDIA_MANIFEST=/rv64/r6-uncompressed-no-reboot.json \
  node src/engine/rv64/measure.mjs --smp-kuberoot \
  > public/rv64/results/R9-smp-2h-uncompressed-1024-3000s-run.log 2>&1
cd ..
python3 scripts/rv64-guest-profile.py \
  web/public/rv64/results/R9-smp-2h-uncompressed-1024-3000s.json \
  --symbols web/public/rv64/profile-symbols/all.json.gz \
  --maps web/public/rv64/profile-symbols/maps.json \
  > web/public/rv64/results/R9-smp-2h-profile.json
```

The harness allows up to 3000 host seconds and may finish early at PROBE_DONE;
it does not promise 3000 guest seconds. Keep result JSON, run log and console,
including partial JSON if an outer timeout occurs. Match media and WASM hashes,
one boot, two harts/1024 MiB and awake-Mac timing. The retained diagnostic probe
can induce SIGQUIT again; separate pre-signal and post-restart measurements.

## Acceptance and comparison

- Keep full JSON, console and streaming METRICS log. Compare BOTH harts from
  JSON; the console's last record is not necessarily the same hart each time.
- Compute interval MIPS = delta retired / delta hostMonotonicMs / 1000, JIT
  fraction = delta jitRetired / delta retired, and compiled/evicted per second.
  R8 hart 1 ended at 19.109e9 retired, 16.988e9 JIT retired, 967,803 compiled,
  918,358 evicted, 49,445 installed, zero clears and zero chains.
- Expect nonzero smp_inline_loads, smp_inline_stores and smp_jit_chains in Linux.
  Compare inline accesses against memory_helpers; atomic_helpers and fp_helpers
  remain separate. Report ratios and interval dispatches per JIT instruction;
  R8 averaged 2.04 instructions/dispatch and ~6.23e9 memory helpers.
- Check compiler.installedWasmBytes against its 128 MiB limit, installed against
  131,072, and measure browser process memory separately. Inflight modules can
  briefly overshoot. Encoded wasm bytes do not measure native V8 memory.
- Require zero fence-induced clears and bounded queue/inflight/latency. Cumulative
  evicted/live-installed is not a miss rate; use interval eviction/recompile
  rates to judge the larger cache. compiled = evicted + installed holds absent
  explicit runtime disposal/release.
- Record containerd boot uptime (R8: guest 1003 s), first :6443 response and readyz.
  Keep pre-signal and post-restart windows separate if the retained probe sends
  SIGQUIT. Do not claim the throughput issue resolved until rebuilt gates and
  the real two-hart measurement demonstrate the outcome.
