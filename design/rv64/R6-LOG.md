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
