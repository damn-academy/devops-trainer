# R6: SMP JIT invalidation investigation

## Evidence and scope

R6b is a valid awake-Mac run: `web/public/rv64/results/R6b-smp-2h-uncompressed-1024-3000s{.json,-run.log}` and `R6b-smp-2h-profile.json`.
At approximately 2,800 guest seconds, kuberoot-control (pid 75, 4–7 threads,
17–34 MB RSS) has not written its service log. The induced SIGQUIT at uptime
2293 shows goroutine 1 in runtime.doInit1 → protobuf/internal/filedesc lazy
initialization (editions.go:102 featuresFromParentDesc, desc_lazy.go
unmarshalFull). main has not started. This is package initialization latency,
not evidence of a Kubernetes readiness deadlock. SIGQUIT is an induced exit.

R6b: approximately 3.3 guest MIPS/hart, JIT fraction 0.37; hart 0 compiled
8,656,681 blocks, 6.06 million in the last two thirds. R2 single-hart capacity:
approximately 93 busy MIPS, JIT fraction 0.92, 18,885 compiled, no clears or
evictions. Those are different workloads/measurement windows, not a speedup
experiment. R6b did not report the counters needed to attribute all recompiles.

## Confirmed defect

`smp-cpu.worker.ts` passed `core.smp_fence()` as BOTH mailbox callbacks.
`Engine::smp_fence()` flushed the TLB AND called `jit_clear()`, deleting entries,
chains, ready IDs and physical-code keys. Thus every serviced remote SFENCE.VMA,
including Linux cross-hart TLB shootdowns, discarded all compiled code on its
target. This is a confirmed mechanism for continuous recompilation, reproduced
without an OS. Its quantitative contribution to R6b still requires R7 counters.

Fix: translation requests use new `smp_sfence()`, which flushes the target TLB
but preserves JIT code. Instruction requests retain the conservative local
instruction-cache clear. Mailbox target selection and ACK-after-flush ordering
are unchanged; ordinary IPIs only set SSIP. Local fence.i and sfence.vma do not
broadcast. A range/ASID request may conservatively flush the entire target TLB.

Code keys are already `(physical PC, virtual PC, physical-page generation)`,
not satp. Entry re-translates/rechecks fetch permissions with current full satp
(including ASID), privilege and status. TLB tags also include full satp. Therefore
preserving physical code across translation invalidation does not preserve stale
virtual translations or grant access to an old mapping. Timer/IPI delivery does
not itself clear code. Compiler queues drain on host yields; the existing runtime
bounds pending code and evicts cold modules. Remote clears previously left host
modules installed but unusable until eviction, amplifying compilation pressure.

Shared stores, AMOs, successful SC/CAS and device byte writes advance only the
physical page generation touched. All CPU helpers share that protocol. Failed
CAS/SC do not publish writes. This is page-granular, not byte-range code tracking:
a write to data on the SAME physical code page conservatively invalidates that
page; unrelated pages do not. No evidence currently attributes R6b's flood to
this conservative behavior, so this patch does not redesign it. Raw shared-image
loads are used during quiesced boot/restore, not normal device DMA.

## Observability

Every SMP metrics message now includes the same Rust `counters` and JS `compiler`
objects as single-hart, plus sent modern/legacy fence/IPI request counts. Rust
adds serviced remote instruction/translation fences and IPIs, observed shared
page-generation changes, and an `invalidations` reason object (remote instruction
clear, other explicit clear, evicted blocks, local store/DMA pages, shared generation
changes, translation flushes). Events are not interchangeable with blocks lost.
Mailbox service can coalesce several requests; compare sent and serviced counts
accordingly. Shared generation observations include first encounter of a written
page and cannot identify the writing hart or distinguish DMA. Local store/DMA
counters can remain zero in SMP because writes go through the shared host bus.
The metrics source hash now includes the SMP host sources.

## Local reproduction and results

`web/tests/rv64-smp-jit.integration.test.ts` uses actual staged WASM, the actual
JIT compiler, shared RAM and SBI mailboxes. It deterministically schedules one
or two Engine harts, each executing 20 quanta of 100,000 instructions in a two-
instruction loop; two-hart runs receive a targeted translation fence per quantum.
No Kubernetes, disk or compiler worker latency. This isolates invalidation; it
is not a parallel-worker throughput benchmark. Threshold 1 forces compilation.

| Artifact | Harts / hart | Compiled | Full clears | Busy MIPS |
| --- | --- | ---: | ---: | ---: |
| Original R6 WASM | 1 / 0 | 1 | 0 | 904.55 |
| Original R6 WASM | 2 / 0 | 20 | 20 | 376.65 |
| Original R6 WASM | 2 / 1 | 20 | 20 | 438.94 |
| Experimental TLB-only WASM | 1 / 0 | 1 | 0 | 928.22 |
| Experimental TLB-only WASM | 2 / 0 | 1 | 0 | 2053.83 |
| Experimental TLB-only WASM | 2 / 1 | 1 | 0 | 3285.65 |

Each hart retires 2,000,000 instructions. Counts are the acceptance signal;
sub-millisecond/short V8 timings are warmup/order-sensitive and cannot predict
Linux speedup. Full samples and hashes are in `R6-local-jit-before.json` and
`R6-local-jit-experimental-after.json`.

**The after artifact is an ablation, not rebuilt Rust.** This Mac has no Rust,
cargo or wasm-bindgen, and the cluster is unavailable. The hash-guarded
`scripts/rv64-sfence-experiment.py` removes the inlined jit_clear body from ONLY
the existing smp_fence export in a temporary WASM, retaining TLB flushing. It
must never be deployed: it also changes instruction-fence behavior. It is used
only to isolate the translation-fence experiment. The production Rust fix keeps
instruction fencing and adds a separate translation export. Source-build green
regression and native ISA/signatures remain mandatory in R7.

```bash
# Original staged R6 wasm: expected failure, compiled 20 != 1.
cd web
RV64_SMP_JIT=1 npx vitest run tests/rv64-smp-jit.integration.test.ts --silent=false
cd ..
python3 scripts/rv64-sfence-experiment.py /tmp/rv64-tlb-only.wasm
cd web
RV64_SMP_JIT=1 RV64_SMP_JIT_WASM=/tmp/rv64-tlb-only.wasm \
  npx vitest run tests/rv64-smp-jit.integration.test.ts --silent=false
```

The integration test is explicitly opt-in because generated WASM is untracked
and normal unit-test environments need not have it. It deliberately falls back
to the old export when testing original R6, so the old binary fails on behavior.
The worker requires rebuilt WASM with `smp_sfence`; do not run R7 with the old binary.

## Verification status

Passed locally: TypeScript typecheck; 40 RV64 unit tests in nine files; targeted
regression fails on original R6 WASM and passes on the temporary TLB-only
ablation; browser shared-memory gates with 2 and 4 workers; all 439 browser JIT
ISA/signature fixtures on the original staged WASM. The experimental bytecode
hash is reproducible with the retained script. The ordinary suite skips the
opt-in WASM integration test unless RV64_SMP_JIT=1.

Not run: compilation of changed Rust, native riscv-tests/Spike signatures,
439 fixtures against rebuilt WASM, real Linux SMP/trace/snapshot gates, or the
3000-second kuberoot run. These require the lead's build environment. Existing
WASM was not replaced. No cluster operation or push was performed.

## R7 partial Linux evidence and R8 instruction-fence fix (2026-11-26)

The lead reports ea17448 rebuilt and all R7 gates green: cargo test, test-isa,
architecture signatures, SMP Linux shell (~25 s), smp-trace, smp-trace-linux and
smp-snapshot. This is reported build evidence, not a local rerun. The running
R7 log is `web/public/rv64/results/R7-smp-2h-uncompressed-1024-3000s-run.log`.
At the reported ~800 guest-second window: ~4.3–4.9 MIPS per hart, interval JIT
fraction 0.65–0.67 (R6b ~0.37), and ~2,200 compiled blocks/s. These are partial
window figures, not a completed 3000-second result or an acceptance verdict.

The hart-1 METRICS record at hostMonotonicMs=1795683106943.61 confirms:

| Counter | Value |
| --- | ---: |
| retired / jitRetired | 4,330,305,805 / 3,000,094,731 |
| interpreter_retired | 1,330,211,074 |
| remote_fence_i / jit_cache_clears | 8,809 / 8,809 |
| invalidations.remote_fence_i / explicit_clear / store_code_pages | 8,809 / 0 / 0 |
| shared_generation_changes | 5,270 |
| remote_sfence_vma / sbi_fences | 8,022 / 16,831 |
| local fence_i / satp_changes | 9,559 / 118,525 |
| compiler.compiled / evicted / installed | 1,772,911 / 1,712,000 / 60,911 |
| jit_cold / jit_pending / jit_queue_full | 180,788,816 / 33,170,813 / 0 |
| compiler.pending / inflight / queued | 61 / 1 / 0 |
| compiler latency mean / max | 14.71 ms / 850.47 ms |

The cumulative JIT fraction here is 0.693; it is not the interval fraction above.
Single-hart kuberoot reportedly has 12,764 local fence.i and zero cache clears.
That agrees with the code: local FENCE.I flushes translation state but retains
JIT code; SMP `Engine::smp_fence` additionally called `jit_clear` on every serviced
instruction request. Modern SBI RFENCE fid=0 and legacy extension 5 reach that
same method through `HartMailboxes.service`. Thus each targeted request erased
hotness, code keys and ready entries, although JS modules remained installed.

Linux's [RISC-V cacheflush implementation](https://github.com/torvalds/linux/blob/master/arch/riscv/mm/cacheflush.c)
connects executable-PTE cache maintenance to `flush_icache_mm`. It uses SBI or
IPIs and defers flushes for CPUs not running the MM. Therefore “every exec sends
to all harts” is too broad: masks and active MM matter; `flush_icache_all` does
broadcast. The emulator's SBI counters confirm receipt, not exact Linux call-site
attribution. Guest-version source/profile evidence would be needed for that.

### Ordering and code retention

R8 removes only the extra `jit_clear` from `smp_fence`, keeping the same local
translation flush and serviced-fence counters. No worker protocol changes:

1. All guest stores in shared RAM use the host bus. `SharedHartMemory.write`
   writes bytes and atomically increments the shared physical-page generation
   before returning. The native 64-bit AMO add/swap path does the same;
   other AMOs, successful SC and CAS use `write`. Failed SC/CAS do not publish.
   Device byte stores use this protocol too. All workers receive the same
   generation buffer. Raw shared-image writes are confined to quiesced loading.
2. The writing hart returns from its store before SBI handling publishes the
   mailbox request with Atomics.add. The target acquires that request through
   Atomics.load, finishes `smp_fence`, then publishes ACK with Atomics.store.
   A write preceding the request has therefore published its generation before
   ACK; the sender does not resume from the pending SBI until ACK is observed.
3. Each SMP `jit_block` entry loads the shared generation and keys code by
   `(physical PC, virtual PC, generation)`. Changed-page entries cannot match.
   Compilation stays within one physical page and shared decoding reads live
   bytes. Pending compilation of an old generation cannot become a new key.
4. Shared Engine RAM length is zero: inline memory access uses helpers, and
   the generated chain guard rejects shared RAM, returning to Rust for the next
   generation/translation/permission check. A target may finish its current
   bounded execution quantum before servicing the fence, but cannot ACK while
   still running that quantum. Nothing requires eagerly deleting unchanged code.

The new actual-WASM regressions warm B's compiled loop, then execute a guest
store and modern SBI RFENCE on A. They assert generation publication before the
request and inside the pre-ACK handler. B must publish the new instruction's
result after ACK; a separate unrelated-page case must keep the compilation count
unchanged. Both require zero clears. Existing shared-memory tests now cover
store, DMA byte write, both AMO paths, SC and CAS before ACK; chain tests cover
the zero-RAM-length rejection. These are deterministic scheduling tests, not a
parallel throughput benchmark; real-worker/Linux gates remain mandatory.

### Eviction and cold accounting

There is no 28-fold capacity/accounting defect demonstrated here. `evicted_blocks`
counts cumulative IDs passed to `jit_evict`; `compiler.installed` is the live
host table-slot gauge. In this record, **1,772,911 = 1,712,000 + 60,911** exactly.
Clears do not directly increment evictions. They leave host modules unreachable
from Rust, and those modules are later counted when the bounded JS cache evicts
them. `compiler.cacheClears=0` measures JS-triggered clears, not Rust's 8,809
remote clears. Keep these distinctions when comparing R7 with R8.

The limit remains 65,536 blocks per hart, evicting cold whole modules toward 75%
at a quiescent flush. Inflight batches can temporarily overshoot. No evidence
justifies increasing the capacity before removing fence-induced churn. Added
cache-test assertions check compiled = evicted + installed across eviction and
slot reuse. R8 must compare interval eviction/recompilation rates before tuning.

`jit_cold` counts lookups below threshold 50, not retired instructions. A clear
resets the 65,536-entry direct-mapped hotness table, so repeated fences force
re-warmup. New PCs, hash collisions, changed physical-page generations and real
evictions can also reset hotness. `jit_pending` separately counts waits for
compiled blocks. Neither counter alone explains all interpreter retirement;
unsupported instructions and other JIT exits remain. R8 measures the residual
rather than lowering the threshold speculatively.

`remote_fence_i` remains a serviced-event counter. For R8,
`invalidations.remote_fence_i=0`, and `invalidations.explicit_clear` equals actual
`jit_cache_clears` without subtracting remote requests. A Rust regression checks
this distinction even when remote requests outnumber explicit clears.

### Local validation and remaining gates

TypeScript typecheck and all 41 ordinary RV64 tests pass (three opt-in integration
cases skipped). Against the existing R7 WASM, the translation-fence integration
passes; both new instruction-fence regressions reach the expected guest result
and then fail exactly at `jit_cache_clears: expected 0, received 1`. This is a
negative control confirming the deployed R7 behavior, not a green R8 build.
Staged WASM SHA-256: `609f27fe3cce7d59328be3cca1c05a483ff1310ce92a4fec520da6968259b625`.

This Mac has no cargo/rustc/wasm-bindgen and the cluster is unavailable. Changed
Rust, its new metrics test, rebuilt-WASM integration, native ISA/architecture
signatures and browser Linux/trace/snapshot gates therefore remain unverified
for R8. No public WASM or production TypeScript was replaced, no competing
browser measurement was launched during R7, and no cluster access or push was
attempted. Follow `R8-PLAN.md` after R7 finishes for the full gate list and exact
3000-host-second command with R8 result names. Do not claim all R8 gates green
until those source-build checks complete.
