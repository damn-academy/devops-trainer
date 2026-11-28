# RV64 emulator

An RV64IMAFDC machine (S/U modes, Sv39, SBI, virtio block/net/console/entropy)
that runs Linux, containerd and kubelet in a browser tab. The core is Rust
compiled to wasm (`core/`); hot guest code is translated to wasm functions at
run time (`jit-compiler.ts`), and an SMP machine runs one hart per Web Worker
on shared RAM.

## Layout

| Path | Role |
| --- | --- |
| `core/src/cpu.rs`, `decoded.rs`, `float.rs`, `compressed.rs` | Interpreter: precise traps, CSRs, soft-float |
| `core/src/memory.rs` | RAM, Sv39 walk, TLBs, PMP, decoded-instruction cache, DMA copies |
| `core/src/devices.rs` | virtio MMIO devices, PLIC, CLINT |
| `core/src/jit.rs` | Block collection, block dispatch, the `jit_slow` helper |
| `core/src/wasm.rs` | wasm-bindgen `Engine` API and the shared-bus imports |
| `core/tools/bind-shared.py` | Post-processes the wasm-bindgen glue for the `rv64shared` imports |
| `jit-compiler.ts` | Encodes blocks as wasm functions; inline TLB loads/stores |
| `jit.ts`, `shared-code.ts`, `shared-compiler*.ts`, `compile-pool.ts` | Compile queue, machine-wide code cache, table slots and eviction |
| `smp.ts` | Shared RAM protocol (`SharedHartMemory`), the direct bus module, SBI mailboxes |
| `smp-cpu.worker.ts` | One hart per worker; hart 0 also runs the device engine |
| `smp-linux.ts`, `smp-kuberoot.ts`, `measure.mjs` | Browser boot benchmarks and their headless driver |

### SMP memory model

Guest RAM is a shared `WebAssembly.Memory`; guest byte 0 is at offset 64.
Offset 0 holds the writer lock (0 free, 1 held, 2 held with sleepers). Every
store, from generated code, the Rust core or device DMA, takes that lock,
writes, and then bumps the 128-byte reservation granule (LR/SC) and the
4 KiB page generation (invalidates compiled code on every hart). Loads are
atomic and lock-free.

The Rust core reaches shared RAM through raw wasm imports from module
`rv64shared` (`load`, `store`, `fetch`, `generation`, `cas`), which
`smp.ts sharedAccessModule()` implements in a few hundred bytes of wasm.
wasm-bindgen would turn that module into an ES import, so the build runs
`core/tools/bind-shared.py`; SMP workers set `globalThis.rv64SharedImports`
before initializing the core. LR/SC and AMOs still go through
`SharedHartMemory` in JS, which keeps the per-hart reservation.

## Building and testing

All Rust builds and tests run in the dev pod (`scripts/rv64-dev.sh`):

- `scripts/rv64-dev.sh wasm`: core, wasm-bindgen, `bind-shared.py`, wasm-opt.
- `scripts/rv64-dev.sh test-isa`: riscv-tests (173 pass, 1 unsupported).
- `scripts/rv64-arch-tests.sh`: 266 riscv-arch-test signatures against Spike
  (`RV64_ARCH_OUT`, `RV64_RUNNER` select the output directory and runner).
- `RV64_SMP_JIT=1 npx vitest run tests/rv64-*`: compiler, shared memory,
  SMP JIT integration against the built wasm.
- `node src/engine/rv64/measure.mjs --jit-gates | --smp-substrate |
  --smp-trace | --smp-trace-linux`: browser correctness gates.

## Performance

All numbers below come from the `rv64-perf` pod (limit 3 CPUs, 6 GiB),
headless Chromium 159 (Playwright build), 2 harts unless stated, the same
pod and scenario for every before/after pair and at least three runs per
variant. They are throughput numbers of this pod, not of a student laptop.

Scenarios (`measure.mjs`):

- `--smp-linux`: Alpine initramfs to a shell (`shell_s`), then a fixed
  CPU-bound job on every hart: a shell arithmetic loop, `gzip` of busybox and
  a 256 MiB `dd` from `/dev/zero` (`work_s`, `workMs` in the result). Runs
  2 harts, then 4 harts, 256 MiB RAM.
- `--smp-kuberoot`: the kuberoot node (containerd, kubelet, control plane in
  one Go binary) from the r16 medium, 1024 MiB, 300 s window. The guest
  markers (`RV64_CONFIG_CREATED` etc.) follow the probe's own timers and do
  not track emulator speed; the metric is retired guest instructions per
  wall second over the window (MIPS, both harts summed).

Profiles: `measure.mjs --profile` (V8 sampling profiler through CDP
tracing, 1 ms) plus the core's own counters (`Engine.metrics()`). Generated
wasm has no names; it shows as `wasm-function[N]` of anonymous modules (the
chain dispatcher is the one-function module).

### Profile before the changes (bcdf6cf)

kuberoot, 2 harts, 90-150 s of the boot: 18 MIPS, 95% of instructions in
generated code.

- Hart 0 (also the device server): 72% of its time in virtio DMA. The device
  engine moved each disk byte with its own `physical_write`, i.e. a JS call
  with BigInt conversion into `SharedHartMemory`, the global writer lock and
  three atomic counter updates, plus a BTreeMap lookup per byte.
- Hart 1: guest execution about 50%; 17% waiting for hart 0 to answer MMIO;
  11% `performance.now()` in the worker loop; 22% the worker loop itself.
- SipHash in the JIT maps (`hash_one`) and full-table scans in `jit_evict`.

smp-linux boot: 11 s (2 harts), 21 s (4 harts); about 90% of instructions in
generated code, yet a third of hart time went to JS bridging for the
interpreter (each SMP instruction fetch was two JS calls, each load or
store one), and harts in WFI spun at full speed.

### Changes, in the order applied

| Commit | Change | Measured effect |
| --- | --- | --- |
| 7b81749 | virtio DMA copies whole buffers in one locked transaction | kuberoot 17.9 -> 24.4 MIPS (3 runs each: 18.0/17.4/18.4 -> 24.3/24.6/24.4) |
| 9a4d176 | harts sleep in WFI (`Atomics.waitAsync`) with explicit wakeups; fewer allocations and clock reads in the worker loop | smp-linux 4 harts boot 21 s -> 16 s; kuberoot 25.3 MIPS (25.7/25.7/24.4) |
| fd2a75e | Rust core reaches shared RAM through raw wasm imports (`rv64shared`), no JS | smp-linux 2 harts boot 10.7 -> 6.7 s; kuberoot 45.7 MIPS (45.5/47.3/44.2) |
| a8b5e69 | multiply-rotate hash for JIT maps, eviction by owner index | kuberoot 59.7 MIPS (65.0/55.3/58.8) |
| d13ae9d | futex-style writer lock: notify only when contended | smp-linux work 2 harts 18.8 -> 13.3 s (18.7/19.6/18.2 -> 13.9/12.7/13.3), 4 harts 83.8 -> 55.4 s |
| 2e9f45c | drop the unused global write counter from every SMP store | work 2 harts 13.6 -> 11.5 s (12.8/14.3/13.7 -> 11.4/12.0/11.2), 4 harts 55.8 -> 43.9 s |
| a44c528 | stores bump only flagged code pages and reserved granules | work 2 harts 12.0 -> 10.1 s (11.8/11.8/12.3 -> 9.9/10.1/10.4), 4 harts 48.9 -> 35.3 s |
| f79ba30 | one store lock per hart; exclusive operations take all of them | work 2 harts 10.1 -> 7.7 s (10.6/9.9/9.8 -> 7.5/7.8/7.7), 4 harts 40.2 -> 14.0 s (45.4/34.2/41.0 -> 16.2/13.2/12.6) |

### Before and after (bcdf6cf -> f79ba30)

Interleaved runs in one series, same pod and build pipeline:

| Scenario | bcdf6cf | f79ba30 |
| --- | --- | --- |
| smp-linux, 2 harts, boot to shell | 10.6 / 10.9 / 11.4 s | 6.5 / 6.6 / 6.9 s |
| smp-linux, 2 harts, workload | 20.9 / 20.9 / 21.2 s | 8.0 / 9.5 / 7.5 s |
| smp-linux, 4 harts, boot to shell | 20.8 / 20.4 / 20.3 s | 9.4 / 9.6 / 9.3 s |
| smp-linux, 4 harts, workload | 92.2 / 83.9 / 85.0 s | 13.0 / 12.6 / 12.8 s |
| kuberoot, 2 harts, MIPS over 300 s | 16.8 / 18.3 / 18.7 | 62.8 / 62.0 / 62.7 |
| kuberoot, per hart (hart 0 / hart 1) | 6.9-8.7 / 9.8-10.9 | 28.0-30.0 / 32.8-34.7 |

With idle harts sleeping, f79ba30 also reports busy MIPS (instructions per
non-idle hart second): 63-64 for kuberoot, so the guest was CPU-bound in
that window.

Kubernetes node on kube.wasm (`src/engine/kube-wasm/node.html`, 2 harts,
1024 MiB, r19 worker medium, same kube.wasm build, default Go settings),
restored from a checkpoint of a running node; marks in seconds after page
start, 7-minute limit per run:

| Run | core | checkpoint | logs | exec | fresh heartbeat | new pod Running |
| --- | --- | --- | --- | --- | --- | --- |
| 3 runs | bcdf6cf-era build (f9c9a61e...) | kube-node-cp19 | none | none | none | none |
| 3 runs | f79ba30 (f583d5c2...) | kube-node-perf | 27 / 28 / 25 | 58 / 60 / 59 | 64 / 65 / 65 | 205 / 206 / 206 |

Before, the restored node never renewed its lease within 7 minutes; after,
it does about 50 s after the restore. The new pod reaches Running about
140 s after its deployment in every run, which points at a timer in the
pod start path rather than at emulator speed. A cold start of the same
page with f79ba30 registered the node at 154 s, had it Ready at 165 s and
the first pod Running at 298 s (one run; it produced kube-node-perf).
Checkpoints are bound to the core's wasm SHA-256, so every core change needs
a new one.

### Tried and reverted

- Traces through forward `jal` inside a page (b736c30, reverted in c6df192):
  kuberoot 59.9 -> 62.9 MIPS with a spread of about 10 MIPS per variant,
  smp-linux work 13.3 -> 13.6 s; no measurable gain. Block chaining already
  keeps most block transitions inside wasm, and taken branches and `jalr`
  dominate the exits.
- Zicsr and FENCE.I through the JIT helper, FENCE compiled as a no-op
  (fd82849, reverted in dc21405): work 11.5 -> 11.7 s (2 harts),
  43.9 -> 46.6 s (4 harts), interpreted share unchanged at about 4%.
- Lock-free generated stores (measurement-only build, never committed): the
  guest livelocked in the smp-linux workload, as expected without LR/SC
  exclusion; it confirmed that store-path atomics, not the stores themselves,
  were the cost.

### Where the time goes now (f79ba30)

smp-linux workload, 2 harts, 5 s sample per hart: generated code and the bus
module 63-66% (the block-chain dispatcher alone 19%), Rust dispatch and the
interpreter about 22% (`Cpu::run`, `jit_block`, `translate`, decode), worker
JS 12-15% (loop, `service`, AMOs through `SharedHartMemory.locked`). The
compiler worker is busy about 15% of the time.

### Next candidates

1. Cheaper block chaining: the dispatcher re-validates mode, satp, the
   fetch TLB entry, the chain entry and the page generation on every
   transition. Per-exit inline caches validated by a TLB epoch and the
   target page generation would remove most of that work.
2. LR/SC and AMOs in the direct bus instead of `SharedHartMemory` (the
   reservation can live in the Rust core); Linux spinlocks and atomics hit
   this path.
3. Inline FP loads and stores (context switches save 32 FP registers through
   the helper, each ending a block).
4. Lower Rust dispatch overhead: one translation per block entry instead of
   two, fewer metric updates on the hot path.
5. Compiler worker: `emit(...array)` spreads and BigInt-based LEB128 in
   `jit-compiler.ts`, `codeKey` JSON per block.
