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

## R8 result and R9 implementation (2026-11-26)

The operator reports ef17643 rebuilt in the pod and every gate green: cargo test,
ISA 173/0, architecture signatures 266/0, RV64 Vitest, SMP JIT integration,
jit-gates, smp-substrate, smp-trace, smp-linux, smp-trace-linux and smp-snapshot.
These supersede the earlier R8 pending-build notes; they are operator results,
not gates rerun by the R9 implementer.

Last hart-1 METRICS records, independently read from
`web/public/rv64/results/R{7,8}-smp-2h-uncompressed-1024-3000s-run.log`:

| Metric | R7 | R8 |
| --- | ---: | ---: |
| Retired | 14,762,174,379 | 19,109,337,792 |
| JIT retired | 10,767,568,647 | 16,988,222,776 |
| JIT share (rounded) | 0.73 | 0.89 |
| Compiled | 4,883,785 | 967,803 |
| Evicted (cumulative) | 4,818,254 | 918,358 |
| Installed (live gauge) | 65,531 | 49,445 |
| Rust jit_cache_clears | 14,791 | 0 |
| JS compiler.cacheClears | 0 | 0 |
| jit_dispatches | 5,337,604,160 | 8,331,497,900 |
| jit_chains | 0 | 0 |
| memory_helpers | 3,918,956,343 | 6,232,436,982 |
| inline_tlb_checks | 3,918,955,968 | 6,232,436,540 |

The supplied 6.23e9 equality is rounded: R8 helpers exceed checks by 442
(accesses rejected before the TLB check). R8 retires about 2.04 guest instructions
per JIT dispatch. Containerd completed boot for the first time, at guest-reported
1003 seconds; kube-apiserver did not answer on :6443 before 3000 host seconds.
These totals do not establish an interval throughput improvement by themselves.

Source inspection confirms shared RAM already uses a fixed shared
WebAssembly.Memory, with guest bytes starting at offset 64. The expensive path
is generated code rejecting the zero private-RAM length, then Rust
physical_read/write calling shared_access in JS. The same length guard prevents
chaining even though tail calls are supported. The installed-function cap is
ours, not a V8 limit. The R8 accounting identity is exact:
967,803 = 918,358 + 49,445. The ratio 18.57 is cumulative evictions/live occupancy,
not a cache miss rate; use interval churn to assess the capacity change.

### R9 shared JIT memory and coherence

Generated SMP modules import private Rust memory at index 0 and existing shared
RAM at index 1. Generations and reservation epochs now have shared wasm-memory
backing at indices 2 and 3, replacing their SAB-only allocations on CPU-worker
paths. They are shared with the unchanged JS helpers, not copied per hart.
Non-JIT substrate/trace users can still supply their existing typed-array tables.
Node 26.9 validates and executes these multi-memory atomic modules locally.
The operator's Chromium 159 must confirm the browser gates.

Sv39/TLB/context/PMP/alignment/RAM-bound guards remain. Successful SMP integer
loads use width-correct atomic loads and sign extension. Stores acquire the
existing RAM writer lock, atomically store the requested width, increment the
legacy global epoch, reservation-granule epoch and shared page generation,
release the lock and notify waiters. All writes publish generations, matching
helpers: a hart's private jit_code bitmap cannot identify another hart's code.
This also preserves helper subword RMWs, LR/SC, AMO and CAS serialization.
Atomics/LR/SC instructions themselves still use helpers. Single-hart RAM
instructions and guards remain unchanged, with added inline-access counters.

A chain checks its target physical page against an atomic load of the shared
u32 generation, zero-extended to the cached u64, plus the existing fetch TLB,
privilege, satp, PMP, slot and budget guards. It never trusts the Rust generation
mirror. A concurrent rewrite may precede the next guard, but a hart cannot ACK a
remote fence while its bounded execution quantum is running. After ACK, neither
a stale Rust entry nor a stale chain target may run. Generation wrap is the
existing u32 protocol, not a new unbounded counter.

The JIT frame grows from 22 to 24 u64 fields. `smp_jit_abi() == 9` is required
before starting CPU workers so an old core cannot receive writes past its frame.
Rebuild all staged WASM consumers before testing. New counters are `inline_loads`,
`inline_stores`, their `smp_inline_*` subsets and `smp_jit_chains`; existing
`memory_helpers`, `atomic_helpers` and `jit_chains` retain their meanings.

### R9 capacity and memory cost

SMP's installed cap rises from 65,536 to 131,072 functions per hart. Single-hart
stays at 65,536. Whole-module cold eviction still targets 75% at a quiescent
boundary. A new SMP encoded-module budget of 128 MiB per hart also triggers
eviction; both occupancy and byte budgets must fall to 75%. Two inflight batches
can temporarily overshoot. Rust's 65,536-entry direct-mapped hotness/chain table
and 8,192 pending-code bound are independent and unchanged.

For 1024 MiB guest RAM, the existing RAM allocation is 1024 MiB + 64 KiB including
its header/rounding. Shared generations occupy 1 MiB; reservation epochs occupy
32 MiB + 64 KiB after wasm-page rounding (62 KiB more than the old SAB). This
metadata is machine-wide. Doubling table slots adds approximately 0.5 MiB/hart
at eight bytes/reference, excluding V8 metadata. JS index arrays, Rust maps and
native machine code cost additional engine-dependent memory.

Measured encoder sizes with 256-function batches and the 1024 MiB layout:

| Synthetic block | Encoded bytes/block | 65,536 functions | 131,072 functions |
| --- | ---: | ---: | ---: |
| load + indirect jump | 374.61 | 23.41 MiB | 46.83 MiB |
| store + indirect jump | 461.61 | 28.85 MiB | 57.70 MiB |

These are reproducible encoder examples, not a Linux working-set estimate or
native V8 code size. A 64-store block is ~22.25 KiB, so function count alone is
not a reasonable memory bound; the 128 MiB encoded budget limits that case.
`compiler.installedWasmBytes`, `installedWasmLimit` and `installedLimit` expose
the actual encoded-module sum and budgets. Measure browser process memory and
interval churn during R9; no measured native-memory saving/speedup is claimed.

### R9 local verification

Typecheck and all 48 ordinary RV64 tests pass (four opt-in integration cases
skipped), including actual generated multi-memory
wasm tests for all integer widths, guard failures, LR/SC interference, subword
CAS/AMO interoperation, generation wrap, fence ACK ordering, stale target
rejection and 10,000 cross-page chains with exact budget. Cache tests exercise
both byte and function limits, module byte accounting and slot reuse.

The new opt-in integration uses two real Engines with Sv39 identity mapping:
A warms an inline store on unrelated data, rewrites B's code through that same
path, then issues guest SBI RFENCE; B must execute the new bytes and resume
chaining after ACK. The handwritten guest/bootstrap/request sequence was also
run successfully with JIT disabled against the locally staged interpreter.
That check does not validate rebuilt R9 Rust or the R9 integration assertions.

No cargo/rustc is installed locally. Rebuilt integration, native gates and all
browser gates remain for the operator under `R9-PLAN.md`. No cluster/browser
access or push was attempted; measure.mjs and public build artifacts are unchanged.

## R9 rebuilt result and R10 host-memory investigation (2026-11-26)

Operator rebuilt commit `16c0273`: cargo test green, ISA 173/0, arch signatures
266/0, RV64 Vitest 48 passed, SMP JIT integration 4/4, jit-gates, smp-substrate,
smp-trace, smp-linux, smp-trace-linux and smp-snapshot all passed. Linux shell
samples 6.0 / 9.8 s versus R8 17.5 / 27.4 s. Containerd booted in 49 s versus
R8 1003 s. These are operator results, not locally rerun pod/browser gates.

`web/public/rv64/results/R9-smp-2h-uncompressed-1024-3000s-run.log` and
`R9-smp-2h-uncompressed-1024-3000s-console.txt` are the retained evidence.
At about 14.5 wall minutes, hart 0/1 retired 23.95e9 / 20.03e9; JIT share ~0.93,
memory_helpers ~0.09e9, inline loads/stores ~4.6e9 / 2.9e9, chains ~1.7e9.
Installed functions 81,674 / 68,146; evicted 256,512 / 213,796. Ready never
succeeded: readyz failed repeatedly from guest uptime 213 through 834.
At 12:00:20.616 UTC the renderer crashed (run log line 513), followed by browser
disconnection. No result JSON exists. Guest MemAvailable ~820 MB does not
measure host renderer memory.

### Restart attribution (line numbers in the retained console)

- Lines 882 and 968 repeat the **same** 11:50:37.478165 warning, PID 76;
  the second is a diagnostic log-tail copy. Lines 1938 and 2030 similarly
  repeat 11:58:12.316744, PID 1921. Four warnings represent two processes.
- Line 1477: PID 76 starts serving :6443 at 11:55:28.818669. Line 1511:
  ipallocator repair starts at 11:55:30.020520.
- Line 1734: 11:56:29.147604, PID 76, fatal PostStartHook
  `start-service-ip-repair-controllers`: `unable to perform initial IP and
  Port allocation check (timeout)`. The observed interval is about 60 seconds
  from secure serving (59.13 s from the repair-start message). The exact
  configured constant is not printed; verify the image's patched Kubernetes
  source before attributing a precise source default to this medium.
- Line 1761: `[kinit] kuberoot-control exited (code 255), restarting in 1s`.
  Line 1810 supervisor status confirms `restarts:1`, PID 1921, start
  11:56:51.1530449Z, lastExit code 255. This is kinit restarting the combined
  runtime after the apiserver's fatal hook, not evidence of a supervisor
  health-check timeout or kubelet liveness kill.
- Line 5370: diagnostic SIGQUIT to PID 1921 at uptime 844, induced_exit_expected=1.
  `scripts/rv64-diag-probe.sh` triggers it after >=600 guest seconds of failed
  attempts, then sleeps 10 seconds and tails 400 lines. This later induced
  exit must not be confused with the earlier fatal hook.

TLS failures alone do not prove P-256 CPU starvation. The Go runtime also
hosts kine and other components; SQL slowness and request scheduling compete.
Use instruction samples and caller stacks, grouped by task/SATP and pre-restart
window, to look for crypto/tls, crypto/internal/fips140/nistec (or the version's
nistec), p256 field/scalar operations and math/big versus runtime/GC/SQLite.
Correlate with TLS failures and retired rates; instruction-weighted samples
are not wall-time latency measurements or proof that the 10 s client handshake
deadline was spent entirely in crypto. See R10-PLAN for a short capture before
SIGQUIT, without changing guest timeouts or the retained medium.

### Host accounting and mitigation

Most likely crash cause from code is aggregate host memory pressure, especially
compiled JIT code/metadata beyond the encoded-byte cap. It is a hypothesis:
no renderer OOM dump or host-memory samples were retained in R9. Hart 0 alone
retained 130,188,357 encoded bytes at the last report, near its 128 MiB cap.
Each hart has a separate compiler worker, core wasm memory and module instances;
V8 may retain optimized/native code until GC after table references are cleared.
The 131072-function cap and 128 MiB encoded cap do not bound that native memory.

Shared allocation for 1024 MiB guest RAM is 1024 MiB + 64 KiB RAM, 1 MiB
page generations and 32 MiB + 64 KiB granule epochs, counted once. Each CPU
worker starts Engine(32); hart 0 also owns an Engine(32) device server in the
same private wasm memory. Private memory can grow (disk overlays, JIT state,
Rust allocator); R10 reports its actual byteLength per hart. JIT last_used
also grows with serial IDs (8 bytes/ID); at R9's ~338k IDs on hart 0 this is
~2.6 MiB, not the dominant allocation. Wasm linear memories cannot shrink.

R10 accounting target is **2560 MiB total**, including **256 MiB reserve** for
compiler workers/transients, JS, DOM, network/disk and buffer copies. Remaining
allowance after shared and private wasm memories is divided by hart count.
Each hart additionally caps live JIT estimated memory at 256 MiB, charging
8x encoded bytes plus 64 KiB/module. These are conservative accounting weights,
not measured V8 expansion factors. Existing encoded/function caps remain as
secondary ceilings. Whole modules are ranked by last use and evicted to 75%
of all applicable caps; Rust references are removed before table slots recycle.
Two in-flight batches (256 blocks each) can overshoot until the next quiescent
flush. Compiler queue is limited to 1024 blocks; overflow IDs are returned to
Rust for retry at that boundary. No wasm ABI change.

Every 30 s the page reports shared/private wasm sizes, live modules, encoded
bytes, estimated JIT cost, console length and dropped data. Optional isolated
UA memory measurement has a 5 s reporting deadline, one outstanding request,
and explicit unavailable/error/timeout status. Measured pressure reduces JIT
allowances. This cannot guarantee process RSS: UA coverage, GC timing and
non-shrinkable wasm memory remain outside application control. Validate the
budget against actual browser memory in the operator run, and stop if pressure
persists; do not describe the estimate as an RSS limit.

SMP and single-hart kuberoot histories now retain at most 32 MiB serialized
UTF-16-equivalent metrics (also at most 4096 records); console is a 1 Mi-character
tail. SMP marker times survive console truncation, without unbounded event
history. Dropped counters are in results. Rust's existing profiler already
caps each drain at 65536 rows; previously the page retained every drain forever.
The history byte charge bounds serialization, not exact JS object overhead
(the reserve covers that). Console DOM/string copies are likewise additional.
The harness change is only the extra host-memory METRICS line; all sampling,
accounting and policy live in the page/runtime.

## R10 short capture: attribution gap and JIT churn (2026-11-26)

Operator rebuilt `7991caa`: cargo test, ISA 173/0, architecture 266/0,
RV64 Vitest 54, enabled SMP JIT integration 4/4 and all six browser gates passed.
This analysis did not rebuild or change emulator/media; no push.
Capture: `web/public/rv64/results/R10-smp-2h-tls-profile-700s.json`, with matching
`-run.log` / `-console.txt`. No renderer crash at 700 s; readiness failed.
Markers in request-relative host ms: CONFIG_CREATED 73019.790, DIAGNOSTICS
132669.365, READYZ_BEGIN 195657.105, READYZ_END 231126.510, status=1.
Later failed_or_timeout attempts at guest uptime 265..659 are included in the
post-END window, not evidence that readiness succeeded at END.

The analyzers now accept both legacy events and R10 markers/bounded metrics.
New windows are half-open, using guestTicks/10000 + guestEpochOffsetMs;
no startup-clock approximation here. Existing legacy windows remain available.
Results: `R10-smp-2h-tls-profile.json`, `R10-smp-2h-tls-callers.json`, and
`R10-smp-2h-tls-metrics.json` in the same results directory.
1399 retained metrics = 1376 hart records + 23 host-memory records;
1243 records contain guestProfile, 25,548 instruction samples in total.
metricsDropped=consoleDropped=profile dropped=0; interval=1000003.

### What can actually be attributed

All **14,876 user-mode samples have comm=(0,0) and stack-valid bitmap=0**.
The supplied maps map user binaries by comm, not by this run's SATP. Therefore
all user samples are unresolved; assigning an overlapping Go text address to
an arbitrary executable would invent evidence. The kernel map does resolve
all 10,672 privileged samples. SATP is an address-space identity, not PID.
Console identifies containerd PID 76 and control PID 77, but supplies no bridge
from these PIDs to sampled SATPs. Do not reuse another run's SATP mapping.

Percentages below use **all instruction-attempt samples on that hart in that
window** as denominator. Kernel excludes sampled idle helpers. `Unknown user`
is an upper bound on each requested user category, not an estimate of it.

| Host window (s) | Hart | Samples | Kernel n (%) | Idle helper n (%) | Unknown user n (%) |
| --- | ---: | ---: | ---: | ---: | ---: |
| 73.020–195.657 | 0 | 2009 | 1355 (67.446) | 1 (0.050) | 653 (32.504) |
| 73.020–195.657 | 1 | 2333 | 1675 (71.796) | 1 (0.043) | 657 (28.161) |
| 195.657–231.127 | 0 | 516 | 287 (55.620) | 0 (0) | 229 (44.380) |
| 195.657–231.127 | 1 | 626 | 334 (53.355) | 0 (0) | 292 (46.645) |
| 231.127–700.001 | 0 | 10085 | 3370 (33.416) | 2 (0.020) | 6713 (66.564) |
| 231.127–700.001 | 1 | 9979 | 3647 (36.547) | 0 (0) | 6332 (63.453) |

For **each** of crypto/tls, crypto/internal/fips140/nistec (P-256), bigmod/field
math, Go GC, Go scheduler and SQLite/kine, the six per-window/per-hart shares
are **unavailable**, bounded respectively by 0–32.504%, 0–28.161%, 0–44.380%,
0–46.645%, 0–66.564%, 0–63.453%. They are not measured zeros and cannot all
simultaneously take their upper bounds. The analyzer's resolved leaf buckets
are exclusive: fiat/field/math-big/bigmod before nistec/P-256; GC and scheduler
are name-based subsets of runtime, with runtime-other separate.

Idle-helper samples are cpu_do_idle/arch_cpu_idle/default_idle_call PCs, not
WFI residence time. Instruction sampling does not count time spent asleep.
There is no WFI duration counter here; worker `state` is the SBI hart lifecycle
state (1=stopped), not an idle-duration metric. WFI wall-time share is unknown
in all six cells. The leading memcpy/SATP pair accounts for 245/2009 (12.195%) and
270/2333 (11.573%) before READYZ_BEGIN; this is substantial
non-crypto work, not proof about where a particular handshake spent its time.

Caller coverage is explicit: 0 attributed user samples, 14,876 missing mappings.
`all.json.gz` has no goUnwind metadata. A second exact-hash metadata input,
`control-callers.json.gz`, was supplied; it cannot recover absent task identities
or absent resident stack words. The caller tool now attempts all mapped user
stacks, rather than selecting only runtime traceback PCs, and groups by hart,
window, comm and SATP. Empty chains are a coverage failure, not absence of TLS.

Static inspection explains this capture limitation: profile.rs::resident reads
Memory.ram (private Vec), while SMP memory reads route through the shared-memory
backend. Both task_comm and stack_word use resident; the SMP page does pass
comm offset 1704. Fix the observer before choosing a TLS algorithm/setup based
on this profile. **TLS CPU starvation is neither established nor excluded.**
The timeout strings alone cannot distinguish crypto, scheduling, JIT/compiler
pressure or delayed server progress. No restart/SIGQUIT attribution is inferred
from the missing user identity fields.

### Containerd regression and host memory

Containerd reports 113.387020 s versus R9's approximately 49 s (~2.31x).
These are daemon-reported boot durations, not host marker positions. Different
profiling starts (R10 CONFIG_CREATED vs R9 READYZ_BEGIN) confound the comparison:
R10 samples part of boot that R9 did not. The R10 interval is 1000003 vs 100003,
~10x sparser while active, so increased sample frequency is not an explanation;
neither can sparser sampling prove lower total overhead when activation differs.

Budget pressure is present early: at ~30/60/120 host seconds, hart 0 R10 has
14,133 / 21,392 / 61,680 cumulative evictions, versus R9 0 / 0 / 0 at the nearest
~30-second logged records. At ~120 s R10 hart 0 compiled 74,750 and retained
13,070 blocks; R9 compiled/retained 52,386. Retired counts are 1.410e9 vs 1.555e9.
The first R9 logged hart-1 record is around 209 s, so no early hart-1 comparison
is invented. R10 hart 1 at ~120 s compiled 88,368, evicted 73,924, retained 14,444.

Rates below use differences between the first and last hart metrics **inside**
each window, divided by their actual host-ms separation (endpoints are in the
metrics JSON), not by nominal window length. JIT % = delta jitRetired / delta retired.

| Window | Hart | Retired M/s | JIT % | Compiled delta | Evicted delta | Evictions/s |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| config-to-readyz | 0 | 16.417 | 92.745 | 148702 | 148339 | 1224.4 |
| config-to-readyz | 1 | 19.109 | 92.397 | 164383 | 162149 | 1334.6 |
| readyz-loop | 0 | 14.512 | 88.669 | 59725 | 57623 | 1684.0 |
| readyz-loop | 1 | 17.790 | 90.160 | 61758 | 59258 | 1742.4 |
| after-readyz-end | 0 | 21.551 | 90.684 | 615721 | 615935 | 1315.2 |
| after-readyz-end | 1 | 21.328 | 90.080 | 591471 | 591316 | 1263.0 |

At the last hart reports (~699.7 s), compiled=867096/866100,
evicted=854708/852578, installed=12388/13522, modules=867/904,
installedWasmBytes=21318182/23012312 (~20.33/21.95 MiB),
estimatedHostBytes=227365168/243343040 (~216.83/232.07 MiB),
hostBudget=268435456 each (256 MiB). Cache clears remain zero. R9's later
~14.5-minute observation had 81674/68146 installed and 256512/213796 evicted;
this is descriptive, not a same-time benchmark. R10 plainly churns far more
code while retaining far less. Eviction count is not a CPU-time percentage,
and does not measure the number of distinct PCs recompiled.

All 23 host-memory records report UA SecurityError, uaBytes=null: actual browser
memory was **not measured**. Shared allocation is 1057.125 MiB counted once.
Last private wasm sizes are 469.625/33.3125 MiB. Across host records, shared +
private + estimated JIT is 1622.31–2027.85 MiB; adding the 256 MiB reserve gives
1878.31–2283.85 MiB, below the 2560 MiB accounting target. This is not RSS or
proof that a larger cache is safe. The per-hart 256 MiB ceiling, rather than
exhaustion of the aggregate accounting allowance, is the active constraint.

Conclusion: small-cache recompilation is a supported explanation for some
slowdown and a better measured tuning target than speculative TLS replacement.
The exact 113-vs-49 causal decomposition is unavailable without a controlled
budget comparison at identical sampling settings. First repair profiling;
then compare bounded 256/384 MiB per-hart ceilings without raising the aggregate
target. See R11-PLAN.md. No emulator or medium modification was made here.

Validation: five guest-profile tests and two caller tests pass, including
synthetic R10 markers, half-open window boundaries, hart filtering, dropped
history metadata, crypto caller selection and missing-unwind coverage. Both
CLIs completed on the actual capture. Operator gates above were not rerun for
this Python/documentation-only change.

## R11 rebuilt baseline (87b6453), R12 code-sharing investigation

Operator reports every R11 gate passed after rebuild. The three 700 s kuberoot
captures start profiling at RV64_CONFIG_CREATED, with the unchanged R6 medium:

| Capture | Harts / per-hart ceiling | containerd | Final retired / hart | Evicted / hart | Installed / hart |
| --- | --- | --- | --- | --- | --- |
| R11-observer-256-a | 2 / 256 MiB | 85 s | 13.8e9 / 14.2e9 | 900,892 / 963,915 | 13,241 / 12,449 |
| R11-budget-384-a | 2 / 384 MiB | 94 s | 14.8e9 / 15.5e9 | 652,274 / 675,506 | 18,496 / 17,670 |
| R11-4h-384-a | 4 / 384 MiB | 145 s | approximately 6.0e9 each, 24e9 total | approximately 650k each | approximately 8k each |

R9 without a budget reached approximately 24e9/hart in 14.5 min, roughly
27 M instructions/s/hart versus approximately 21 M now, then crashed the
renderer. It is throughput context, not a safe configuration or controlled A/B.
After READYZ_END, both R11 budgets attribute kernel 32–38%, other 28–35%, Go
runtime approximately 17%, bigmod + P-256 5–6%, GC approximately 5%. These are
instruction-profile shares, not independent additive wall-time categories.
Crypto is not the leading bottleneck in this evidence; no TLS change is justified.

### What R11 actually measures

R11 records encoded bytes, module count, installed functions and an accounting
estimate: `8 * encoded bytes + 65536 * modules`. It has no V8 native-allocation,
instance or export-wrapper measurements. Consequently an exact allocation-size
histogram of individual R11 blocks cannot be recovered. The table below is the
distribution of **per-snapshot averages**, pooled across harts; zero-installed
samples are excluded, each retained hart snapshot has equal weight. All three
captures report metricsDropped=0. Values are bytes, not KiB.

| Capture | Nonzero snapshots | Encoded/block p10 / p50 / p90 | Charged/block p10 / p50 / p90 | Blocks/module p10 / p50 / p90 | Module allowance median share |
| --- | --- | --- | --- | --- | --- |
| 256, 2 harts | 1375 | 1658 / 1708 / 1780 | 16633 / 17296 / 18279 | 14.79 / 18.08 / 21.41 | 20.8% |
| 384, 2 harts | 1364 | 1643 / 1687 / 1754 | 17548 / 18188 / 19321 | 11.65 / 14.13 / 15.74 | 25.7% |
| 384, 4 harts | 2748 | 1662 / 1720 / 1798 | 17898 / 18659 / 19572 | 11.81 / 13.43 / 15.30 | 26.2% |

Encoded/block min–max: 1607–1911 / 1582–2052 / 1593–2180 respectively.
Charged/block min–max: 16130–19358 / 16915–20858 / 16848–23048.
The median native/metadata allowance alone is 13,667 / 13,498 / 13,759 bytes
(8x encoded); it is **not measured native code**. After READYZ_END, median
encoded/charged bytes are 1700/17357, 1677/18187 and 1705/18617. The fixed module
allowance matters but does not dominate total accounting. A 256-block maximum
has not produced 256-block modules: sparse flushes compile immediately in R11.

Reproduce the full per-hart/window/min/p10/p50/p90/max breakdown:

```bash
python3 scripts/rv64-jit-cost.py \
  web/public/rv64/results/R11-observer-256-a.json \
  web/public/rv64/results/R11-budget-384-a.json \
  web/public/rv64/results/R11-4h-384-a.json
```

### Local V8 allocation experiment, not a Chrome calibration

`scripts/rv64-jit-memory.mjs` separates retained module compilation, instantiation
(including export wrappers), and execution, using process/heap deltas between
explicit diagnostic GCs. Nine fresh Node v26.9.0 / V8 14.6.202.34-node.32 processes
ran 4096 synthetic 16-instruction ALU blocks, three repetitions per batch size.
Raw results: [R12-memory-local.json](R12-memory-local.json). These blocks encode
to only 188–231 bytes, much smaller than the real R11 mix; allocator noise,
tiering, platform and engine differences preclude directly substituting these
numbers for browser costs.

| Blocks/module | Compile RSS delta/module (range) | Instance heap delta/module | Retained RSS delta/block (range) |
| --- | --- | --- | --- |
| 1 | 21,192–21,336 B | 1,091 B | 23,092–23,300 B |
| 16 | 30,144–43,392 B | 6,579–6,603 B | 2,488–3,376 B |
| 256 | 45,056–101,376 B | 95,150–95,187 B | 992–1,220 B |

The instance slope is approximately 369 B/exported function plus approximately
720 B/instance in this probe; wrappers are already included, not separately
identifiable here. `getHeapCodeStatistics()` does not track this Wasm growth
(the observed code/metadata deltas are negative), so it is not a native-code
meter. Compilation RSS is a composite process delta, not an exact module size.
R12 retains the conservative 8x + 64 KiB allowance **once per shared module**,
and additionally charges 4 KiB + 512 B/export per hart instance, including all
exports even when a hart installs only a subset. Do not reduce 8x on this probe.
The demonstrated overcharge to remove is charging shared compiled modules per
hart. Browser memory and several-times-more retained hot code remain R12 gates,
not results claimed from local tests.

## R12 rebuilt result and R13 latency diagnosis

Operator-reported R12 (`fab4bfb`, working HEAD before R13 `94be4b7`): all gates
passed after rebuild: cargo, ISA 173/0, arch 266/0, 63 vitest tests, six enabled
SMP JIT integration cases and all six browser gates. The 700 s runs used two
harts and identical media/observer. Artifacts are
`web/public/rv64/results/R12-shared-{384,256}-a{.json,-run.log,-console.txt,-profile.json}`;
comparators are `R11-budget-384-a` and `R11-observer-256-a`.

| Metric | R12 384 | R12 256 | R11 |
| --- | --- | --- | --- |
| Unique retained blocks | 40,704 | 26,043 | 13–21k per hart |
| Retained modules | 3,470 | not supplied | — |
| Cross-hart hits | 117k | 185k | — |
| Containerd boot | 220 s | 247 s | 94 s / 85 s |

R12 evictions were approximately threefold fewer, but per-hart compile latency
mean rose to 1.4–2.0 s and maxima to 25–36 s, versus R11 mean 14–18 ms and maxima
about 1 s. Retired instructions per hart also fell. Sharing improved retention,
but this is a net performance regression, not an accepted throughput result.

Code inspection confirms serialized per-module revoke/ACK in `room()`, one
pending chain including hit admission and compilation, and one compiler worker
for the machine. Each revoke can wait for a CPU host yield (8 ms checks after
2048-instruction runs). R13 replaces this with batch revokes, proactive trim,
reserved concurrent compilation and lease epochs. See [R13-PLAN.md](R13-PLAN.md)
for operator gates and acceptance; local tests cannot establish those results.
