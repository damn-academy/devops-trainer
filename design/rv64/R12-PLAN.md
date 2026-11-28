# R12: shared bounded compiled code

Baseline: rebuilt R11 commit 87b6453, all gates passed per operator. Branch
feat/rv64-r0. No push. Operator owns pod/WASM builds and browser runs. Preserve
R6 media, profiling activation, guest deadlines and TLS. R11 measurements and
local cost distributions are in R6-LOG.md; raw local V8 probe is
R12-memory-local.json. Do not infer browser safety from the Node probe.

## Implementation and accounting

The SMP harnesses create one compiler worker per shared machine and transfers a
MessagePort to each CPU worker. A single compilation queue deduplicates across
harts using physical PC, virtual PC, page generation, exact decoded/raw words,
memory layout and tail-call mode. Export IDs are module-local and mapped to
requesting hart IDs. WebAssembly.Module is structured-cloned to each consumer;
instances import that hart's private core memory, slow helper and dispatcher,
and the machine's shared RAM/generations/granules. Each hart retains its own
function table entries, Rust code map, usage counters and chain guards.

The new `jit_share_abi() == 12` check requires a rebuilt core exposing physical
PC and generation to the compile callback. The existing SMP frame ABI remains
9 (24 fields). Standalone workers and the small trace harness retain the private compiler
path. SMP Linux, Linux trace and snapshot gates also use the shared broker;
kuberoot supplies dynamic budgeting and the performance gate.

Global code charge is 8 * unique encoded bytes + 64 KiB * unique modules;
instance charge is 4 KiB + 512 B * every exported function, per consuming hart.
The compiler's budget is `harts * min(pressure-reduced configured ceiling,
dynamic per-hart allowance)`. This preserves the aggregate 2560 MiB target,
256 MiB reserve, shared-memory-once accounting and private-core allowances.
A 384 MiB URL/environment ceiling still means the R11-equivalent per-hart
contribution to the shared pool, not 384 MiB total. No extra budget is added.
Each hart's local `estimatedHostBytes` now reports its instance allowance;
`sharedJit.stats.estimatedHostBytes` is the authoritative aggregate JIT charge,
including instances and the single active compile reservation. Never add the
per-hart copies of `compiler.sharedCode` or instance allowances to this total.
`sharedJit.ms` timestamps the independently requested aggregate sample.

Only one module compiles at a time; existing two requests/hart and 1024 queued
blocks/hart remain bounded. Admission checks include instance costs and reject
an oversized batch. Budget reduction queues a trim even without new requests;
a second check after asynchronous compilation prevents admitting new code over
a reduced cap. In-progress code remains charged and temporary encoding / V8
GC lag consume the existing host reserve, not an assumed immediate RSS refund.

Global eviction ranks modules by recent use notifications (once per second
from local Rust usage counters), targets 75%, and sends a revoke to all holders.
Each receiver first removes Rust entries/ready/chain links, then nulls table
slots and drops its instance before acknowledging. The broker keeps the code
charged until every ACK; admission waits. Delayed harts can delay compilation
but cannot create extra budget. Local encoded/function caps still evict whole
instances. Tables have separate free-slot pools. Disposal unlinks Rust entries
and resets leases; session IDs reject late pre-reset compiler replies.

Generation/fetch-permission checks remain at Rust entry and generated chains;
remote fence.i still refreshes local fetch state without clearing unrelated
code. Old-generation modules may remain in the bounded cache but cannot match
a new request. Content is also part of the key to avoid aliasing racing fetches.
The six-case enabled integration suite includes compiling on A, running the
same module on B, rewriting code, remote fence.i ACK on both and observing the
new result on both. Existing inline-store/SBI/chain regressions remain required.

Sparse shared requests accumulate for up to 4 ms before the next normal flush,
or flush immediately at 256 blocks. This adds no timer or guest pause and does
not increase the maximum module size. Compare actual compile latency and batch
size against R11; do not assume the latency gate passed. R11 module allowance
is 21–26% of total, so batching is a secondary saving to cross-hart sharing.

Metrics: per-hart sharedCodeHits counts its cache-hit requests (including local
reuse); crossHartCodeHits counts reuse from a different compiling hart.
Aggregate sharedCodeHits/crossHartCodeHits/compiledBlocks are machine totals. Unique
encoded/charged bytes per block and a live body-size histogram are recorded;
histogram buckets are <=256, 512, 1024, 2048, 4096, 8192, 16384, 32768 and >32768
bytes, including each body's LEB length prefix. Full encoded bytes also include
module headers/types/imports/exports. Per-hart encoded bytes include full
retained modules, even if only some exports are installed. Unique block count
includes bounded cached modules with no holders. These metrics distinguish
actual encoded sizes, sharing, wrappers and the estimated native allowance.

## Gates and local status

Local: TypeScript typecheck, 63 RV64 unit tests, Python profile tests (5), Python
caller tests (2) passed. Vite successfully bundles all four SMP pages and both
compiler workers with `copyPublicDir: false`. The default full build exhausted
disk space copying public guest images; its generated dist copies were removed
before the successful source-bundling check. This does not replace pod or
browser gates. Reproduce the bounded local bundling check from web/:

```bash
node --input-type=module -e 'import { build } from "vite"; await build({ build: { copyPublicDir: false, rollupOptions: { input: ["src/engine/rv64/smp-kuberoot.html", "src/engine/rv64/smp-linux.html", "src/engine/rv64/smp-snapshot.html", "src/engine/rv64/smp-trace-linux.html"] } } });'
```

Six WASM integration tests are opt-in and not run
against stale WASM. Rust/cargo are unavailable locally. No pod build, browser
run, throughput claim or final memory-safety claim is made. The implementation
requires the following operator gates; R11 green results cannot validate R12.

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
RV64_RESULT_NAME=R12-jit-gates node src/engine/rv64/measure.mjs --jit-gates
RV64_RESULT_NAME=R12-smp-substrate node src/engine/rv64/measure.mjs --smp-substrate
RV64_RESULT_NAME=R12-smp-trace node src/engine/rv64/measure.mjs --smp-trace
RV64_RESULT_NAME=R12-smp-linux node src/engine/rv64/measure.mjs --smp-linux
RV64_RESULT_NAME=R12-smp-trace-linux node src/engine/rv64/measure.mjs --smp-trace-linux
RV64_RESULT_NAME=R12-smp-snapshot node src/engine/rv64/measure.mjs --smp-snapshot
```

Require native green, ISA 173/0, architecture signatures 266/0, all six enabled
integration cases and every browser gate. Also exercise the actual shared
kuberoot path at 2 and 4 harts; no stale-module execution, deadlocked revoke,
cache clear from fences, renderer crash or unbounded queue is acceptable.

Verify R6 media using the hash/length command in R10-PLAN.md before comparisons.
Pin kernel db43c7264ee97779f9271ebb6c57e90df675d7ab768462e01115d84d4f7cd598,
manifest version 29d01f8c77ea7d7e3db539d7b9259943187cad88b3c3ccdada122702ab7a0059
(630194176 bytes). Save commit and WASM/media hashes with every run.

## 700 s A/B against R11-budget-384-a

Existing A is web/public/rv64/results/R11-budget-384-a.json, with its profile,
console and run log. B uses identical topology, media, ceiling and observer:

```bash
cd ~/projects/devops-trainer/web
RUN_LABEL=R12-shared-384-a
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

The diagnostic timeout may produce nonzero exit/pass=false; it is not node
readiness. Run sequentially on an awake Mac, no edits/HMR. Repeat A on rebuilt
87b6453 with label R11-budget-384-b using the R11-PLAN command, then repeat B
with R12-shared-384-b; alternate order and preserve artifacts. Never reuse R12
WASM on R11 or vice versa. Repeat candidate with RV64_HARTS=4 and a unique label
to compare against R11-4h-384-a; also test the unchanged 256 default.

For matching READYZ_END windows compare installed blocks/hart, unique code,
modules and bytes, eviction/compile rates, shared-hit rate, retired/JIT/helper/
inline/chain rates, latency mean/max and containerd duration. Target several
fold more retained hot code; count shared copies separately from unique blocks.
Require repeated throughput improvement and less churn, without increased
compile latency beyond the 4 ms coalescing allowance or loss of profile coverage.
If the serialized compiler becomes the bottleneck, reject the candidate rather
than relaxing the memory limit. Keep SATPs/restarts separate and report sample,
identity, stack and dropped-history coverage. No crypto causal claim follows.

## 3000 s stability run, only after short gates pass

```bash
cd ~/projects/devops-trainer/web
RUN_LABEL=R12-shared-384-3000s
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

Local allocation probe reproduction (diagnostic GC only):

```bash
node --expose-gc scripts/rv64-jit-memory.mjs 1 4096
node --expose-gc scripts/rv64-jit-memory.mjs 16 4096
node --expose-gc scripts/rv64-jit-memory.mjs 256 4096
```
