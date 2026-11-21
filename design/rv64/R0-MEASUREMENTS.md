# RV64 track, stage R0: TinyEMU baseline in the browser

Status: measured on 21.11.2026. Design context: `00-DESIGN.md` §6.12 (own RV64GC + Sv39 engine with a JIT to WebAssembly, stages R0–R4, the node OS is kuberoot riscv64, not k3s).

## Summary

TinyEMU, Fabrice Bellard's RV64 interpreter compiled to WebAssembly, boots riscv64 Linux in a Chromium tab in under a second and runs real Alpine riscv64 binaries of kubectl 1.36, etcd 3.6 and kube-apiserver 1.36. On an Apple M4 it delivers about 250 million guest instructions per second of useful work, roughly a sixth of a SiFive U74 core (the core of the VisionFive 2 board) and a sixtieth of the host core. With that speed `kubectl get pods` against a local apiserver takes 1.6–1.9 s, so it misses the 0.5 s budget by **3.3–3.8×**. A cold control-plane start takes 75 s, so the 5 s node budget **cannot be met by CPU speed at all and needs snapshots**. The measurement also showed three defects that R1 must avoid from the start: the 2019 build has no `time` CSR, so every Go binary dies with SIGILL; the main-thread loop loses 30–40 % of wall time to `setTimeout` yields; and its Linux 4.15 kernel has no overlayfs, so it cannot run a container runtime.

## Setup

- **Host:** Apple M4 (10 cores), 16 GB, macOS; Playwright's headless Chromium 159.0.8154.6; one browser at a time, served by the Vite dev server with COOP/COEP (cross-origin isolated). No VMs or containers were used.
- **Engines:**
  - `r0`: TinyEMU 2019-12-21 rebuilt with Emscripten 6.0.9 at `-O3` (`build-tinyemu.sh`). Two patches: counters for instructions retired and time spent in the interpreter (to compute MIPS), and the `time` CSR (see "Findings").
  - `r0slice`: the same with 30 million instead of 3 million guest instructions per run of the main-thread loop, to show what a loop that never yields would gain.
  - `bellard`: the precompiled `riscvemu64-wasm` from the official JSLinux 2019-12-21 package, unmodified.
- **Guest:** TinyEMU's own bbl and Linux 4.15 kernel (from the JSLinux package), 1 CPU, 1024 MB RAM, a 400 MB ext4 root disk loaded lazily in 256 KiB blocks over HTTP. The root is Alpine 3.24.4 riscv64 minirootfs plus `kubectl`, `kube-apiserver` and `etcd` from Alpine's riscv64 community repository, our static Go benchmarks and CoreMark. The busybox image of the JSLinux package (128 MB) is the second, minimal guest.
- **Timing:** all numbers are host wall-clock, taken by the page from the moment a command is typed until its end marker appears on the console. Guest-side timings (`/proc/uptime`, CoreMark's own clock) follow the host clock in TinyEMU's browser build and agree with them.
- **Sources:** every input is listed with URL, version, SHA-256 and licence in `web/src/engine/rv64-r0/manifest.json`; raw results are JSON files in `web/public/rv64-r0/results/` (not committed).

## Results

### Boot, console, CPU

| Measurement | `r0` (rebuilt, -O3) | `r0slice` (30 M slice) | `bellard` (precompiled) |
|---|---|---|---|
| Boot to shell prompt, Alpine guest | 0.69–0.99 s (guest uptime 0.31–0.41 s) | 0.63 s | 0.71 s |
| Boot to shell prompt, busybox guest | 0.44–0.48 s | – | 0.45 s |
| Shell round trip (`true`), median of 15, Alpine / busybox | 35–37 ms / 13 ms | 35 ms / – | 37 ms / 14 ms |
| Busybox shell loop, 20 000 iterations | 2.6–3.4 s | 2.2 s | 2.9 s |
| CoreMark 1.01 (`-O2`, static musl), iterations/s | 569–707 (5 runs) | 1029 | 680 |
| Guest MIPS while the interpreter runs (CoreMark) | 287–410 | 388 | – |
| Share of wall time inside the interpreter (CoreMark) | 0.59–0.70 | 0.94 | – |
| Effective MIPS (the two above multiplied) | ≈ 245–250 | ≈ 365 | – |

Comparison with real hardware, using published figures rather than our own:

| CPU | CoreMark/MHz | CoreMark, one core | TinyEMU `r0` relative to it |
|---|---|---|---|
| SiFive U74 (VisionFive 2, HiFive Unmatched), measured by users at 1.4–1.5 GHz under the current CoreMark rules | 2.6–3.2 | ≈ 3 900–4 800 | 1/6–1/7, i.e. a U74 at ≈ 220–270 MHz |
| SiFive U74, vendor figure (WikiChip, SiFive) | 4.9–5.1 | ≈ 7 500 at 1.5 GHz | ≈ 1/11 |
| Apple M4 host core, CoreMark built natively by us (Apple clang `-O2`) | – | 42 968 | 1/60 |

Sources: [WikiChip: CoreMark/MHz](https://en.wikichip.org/wiki/coremark-mhz), [CNX Software on the SiFive 7 series](https://www.cnx-software.com/2018/11/02/sifive-7-series-risc-v-cores-e76-s76-u74/), [SiFive forum: CoreMark on HiFive Unmatched](https://forums.sifive.com/t/coremark-benchmark-degradation-on-hifive-unmatched/5193). QEMU TCG figures from the parallel kuberoot port were not available for this measurement.

### Go and Kubernetes binaries

The first run of each binary is "cold": its blocks come over HTTP from the dev server. The second is "warm": the guest page cache already holds it.

| Measurement | `r0` cold / warm | `r0slice` cold / warm | Native on the M4 |
|---|---|---|---|
| Static Go "hello" (1.4 MB) | 94–116 ms / 50–61 ms | 106 ms / 52 ms | – |
| Go "heavy" (6 MB: ECDSA certificate, HTTPS listener and request, JSON of 1000 objects) | 0.60–0.65 s / 0.39 s | 0.52 s / 0.30 s | 9 ms |
| `kubectl version --client` (61 MB binary) | 3.1–3.3 s / 1.15–1.25 s | 2.9 s / 0.86 s | – |
| `etcd --version`, cold | 1.1 s | 1.1 s | – |
| `kube-apiserver --version`, cold (88 MB binary) | 3.9–4.0 s | 3.9 s | – |

### Control plane: etcd and kube-apiserver in the guest

`r0k8s` starts a single-member etcd and kube-apiserver 1.36.1 (self-signed serving certificate, static token, AlwaysAllow) and then calls `kubectl get pods -A` three times.

| Measurement | `r0` | `r0slice` |
|---|---|---|
| etcd healthy after start | 1.3 s | 1.4 s |
| kube-apiserver `/readyz` after start | 75.1 s | 52.8 s |
| `kubectl get pods -A`, three calls | 1.88 / 1.64 / 1.79 s | 1.31 / 1.08 / 1.12 s |
| `kubectl get --raw=/readyz` | 1.56 s | 0.98 s |
| Resident memory in the guest: kube-apiserver / etcd | 273 MB / 38 MB | 279 MB / 38 MB |
| Guest memory in use (`free`) | 233 MB of 938 MB | 238 MB |
| Disk data fetched by then | 172 MB | – |

### Memory of the tab

With 1024 MB of guest RAM the wasm heap is 1032 MB of address space, but the browser commits only the pages the guest has touched: the renderer's peak resident memory was 230–490 MB across the runs, 300–380 MB in the control-plane runs. `performance.measureUserAgentSpecificMemory()` returned nothing in headless Chromium, so the numbers come from the operating system (`ps`, renderer RSS).

## Findings

1. **No `time` CSR in TinyEMU 2019.** Go's runtime reads the timer with `rdtime` in user mode, and TinyEMU answers with an illegal-instruction trap: every Go binary, kubectl included, dies with SIGILL at start. The unmodified JSLinux build shows exactly this. Our build implements the CSR from the machine timer and opens the TM bit in `mcounteren`; after that kubectl, etcd and kube-apiserver run.
2. **Yielding to the browser costs 30–40 % of wall time.** The emulator runs on the main thread in slices of 3 million instructions and returns to the event loop with `setTimeout(0)` after each, and the browser clamps such nested timeouts to at least 4 ms. During CoreMark the interpreter was busy only 59–70 % of the time. With 30-million-instruction slices the share rises to 94 % and CoreMark rises by about 50 %, while the console round trip stays the same. The R1 engine therefore runs in a Worker and never yields.
3. **The kernel and firmware are a dead end for Kubernetes.** The TinyEMU kernel is Linux 4.15 without overlayfs, and TinyEMU implements the privileged architecture 1.10 with bbl's SBI 0.1. A container runtime cannot run there, and a current kernel such as kuberoot's needs SBI 0.2 or later. We did not attempt to boot a modern kernel on TinyEMU, because R1 replaces the firmware with SBI implemented in the engine anyway.
4. **Guest set-up details** that R1 inherits: the guest has no real-time clock, so the page passes the host time on the kernel command line; etcd refuses to start on riscv64 unless `ETCD_UNSUPPORTED_ARCH=riscv64` is set; the loopback interface must be brought up by the init script.
5. **Cold binaries are expensive.** The first `kubectl` call costs 2.6–3× the second because 65 MB of disk blocks arrive one 256 KiB block at a time. On a real network this will be worse than on a local dev server, so snapshots must include the page cache of the binaries the course calls, and the lazy disk must prefetch the blocks of hot files.

## The budget and the required speedup

| Budget from §6.12 | Measured on TinyEMU (`r0`) | Required speedup | Comment |
|---|---|---|---|
| `kubectl get pods` ≤ 0.5 s | 1.64–1.88 s | **3.3–3.8×** | Most of it is the start of the kubectl process (1.56 s for a bare `/readyz` request); the no-yield loop alone brings it to 1.1–1.3 s, so the interpreter and JIT have to supply the remaining ≈ 2.2–2.6× |
| Node restore from a snapshot ≤ 5 s | Cold start of etcd + kube-apiserver alone: 76 s (kubelet and containerd not yet included) | ≈ 15× by CPU, unreachable that way | Only a snapshot meets it: restore becomes a matter of transferring and unpacking memory, which lazy restore (R3) bounds |
| Pod start ≤ 3 s | Not measurable yet: no overlayfs in this kernel and no kuberoot riscv64 build | Estimated 2–4× | Estimate from the parts: kubelet, containerd, shim and runc are four Go programs plus a few API writes; at the measured 0.3–0.6 s per heavy Go start and ≈ 1 s per API round trip this is 6–12 s |
| `curl` to a Service ≤ 0.3 s | Shell round trip 35 ms | met | The network path through `dt-switch` is not measured yet |
| Node guest ≤ 512 MB | 233–238 MB with etcd and apiserver running | met | kubelet and containerd add ≈ 100–150 MB on real nodes |

**Conclusion.** The engine has to be about **4× faster than TinyEMU in effective guest MIPS**, i.e. about 1 000 useful MIPS on an M4-class laptop, and snapshots are mandatory for node start. Running in a Worker without yields gives about 1.5× of that; the JIT has to deliver the rest with margin, because the real node will run a heavier modern kernel, kubelet and containerd, and two nodes will share the laptop. The R2 target is therefore at least 3× over a TinyEMU-class interpreter running without yields.

## Plan for R1–R4

### R1. Interpreter: Rust compiled to WebAssembly

**Decision: Rust → `wasm32-unknown-unknown`, with a thin TypeScript layer around it.** The reasons, in order of weight:

1. **64-bit registers without a tax.** Every RV64 register is a 64-bit integer. Rust maps `u64` arithmetic directly to wasm `i64` instructions. TypeScript compiled by `tsc` runs as JavaScript, where 64-bit integers are either `BigInt` (an allocation per operation, tens of times slower) or pairs of 32-bit numbers (two to four operations per guest instruction and a lot of carry handling). AssemblyScript would give `i64`, but its toolchain, debugging and library base are much thinner, and the JIT in R2 needs a solid wasm encoder.
2. **The same code runs natively for tests.** `cargo test` executes riscv-tests, riscv-arch-test signatures and lockstep comparisons on the developer machine and in CI without a browser; the browser build is the same crate.
3. **Shared memory and threads for R3.** Rust builds wasm with `+atomics,+bulk-memory` and imports a shared `WebAssembly.Memory`, which is exactly the R3 layout (one guest RAM in a `SharedArrayBuffer`, one hart per Worker).
4. **The R2 JIT needs a wasm encoder.** `wasm-encoder` (from the Bytecode Alliance, Apache-2.0 WITH LLVM-exception) emits modules in-process, so the translator is ordinary Rust code.
5. **Memory safety in a large decoder and MMU,** where off-by-one bugs otherwise become silent guest corruption.

C (like TinyEMU) would be equally fast, but gives up points 2 and 5 and makes the JIT harder to keep correct. The TypeScript side stays: the `Machine` interface (`kind: 'rv64'`, §6.2), the terminal, the `dt-switch` network bridge, the snapshot loader and the course diagrams.

**What R1 implements.**

- **ISA:** RV64IMAFDC + Zicsr + Zifencei, and from the start the extensions that cost little and that the R0 run showed to matter: **Zicntr with a real `time` CSR** (TinyEMU 2019 lacks it, and every Go binary died on `rdtime` until we patched it), **Sstc** (`stimecmp`, so the kernel timer does not bounce through M-mode on every tick), Zba/Zbb/Zbs (RVA22 baseline, fewer instructions in Go code built with `GORISCV64=rva22u64`), Svadu or software A/D updates. Privileged spec 1.12, Sv39 (Sv48 later, if kuberoot asks for it).
- **No firmware boot.** SBI v2.0 is implemented by the emulator itself (TIME, IPI, RFENCE, HSM, SRST, DBCN, legacy console), so there is no bbl or OpenSBI stage, and M-mode is entered only for the few things SBI needs. The kernel is loaded together with a device tree generated by the engine.
- **Devices:** CLINT (machine timer on the host clock), PLIC, virtio-mmio 1.x: blk (lazy HTTP blocks as in TinyEMU, plus Cache Storage), net (frames to `dt-switch`), console, 9p, rng. Nothing else.
- **Guest kernel:** the kuberoot riscv64 kernel from the parallel port, built for these devices; this is a hard requirement, because Kubernetes needs overlayfs, cgroup v2 and netfilter, and the TinyEMU Linux 4.15 kernel has no overlayfs at all.
- **Execution model fixed by R0:** the hart runs in a dedicated Worker in a tight loop and never yields with `setTimeout`. Console input, disk completions and network frames arrive through ring buffers in shared memory and an "events pending" word checked every N instructions; WFI becomes `Atomics.wait` with a timeout equal to the next timer deadline. R0 measured that TinyEMU spends 25–41 % of wall time outside the interpreter because of main-thread yielding; this alone is worth about 1.3–1.7×.
- **Correctness:** riscv-tests (`rv64ui/um/ua/uf/ud/uc`, `rv64si/mi`) and riscv-arch-test through RISCOF with Spike (BSD-3-Clause) as the reference model; for Linux boot, a lockstep trace comparison against our patched TinyEMU build on the first few hundred million instructions.
- **R1 success criterion (from §6.12):** the kuberoot riscv64 kernel boots to a shell, riscv-arch-test passes, and the interpreter's busy-time MIPS on CoreMark is at least TinyEMU's (about 400 MIPS) with no yielding loss.

### R2. JIT to WebAssembly

- **Tiering.** The interpreter counts entries into basic blocks; a block entered more than ~50 times is queued for translation. Blocks are grown into superblocks along the fall-through and the more frequent branch, never across a guest page boundary, so invalidation stays per page.
- **Batching.** Translation happens in a separate compile Worker; it collects hot blocks and emits one wasm module with many functions (module compilation and instantiation have a fixed cost, so one module per block would be too slow). The executing hart receives the compiled `WebAssembly.Module`, instantiates it against the shared memory and the shared function table, and patches its block map.
- **Code shape.** Inside a translated function guest registers live in wasm locals (loaded on entry, written back on exit and before helper calls); RV64 integer instructions map one-to-one to wasm `i64` instructions. Blocks return the next guest PC to a dispatcher; with wasm tail calls (`return_call`, now available in current Chrome, Firefox and Safari) hot blocks chain directly.
- **TLB fast path.** A direct-mapped software TLB (e.g. 256–1024 entries each for read, write and fetch) with a tag compare and a host-address addend; a hit is about six to eight wasm instructions and one `i64.load`/`store`. A miss, MMIO or a misaligned access calls a helper that walks Sv39 and refills. Writes to pages that hold translated code are caught through the write TLB (such pages are entered as "slow"), which invalidates the page's blocks: this keeps self-modifying code and module loading correct.
- **Precise traps.** Each potentially faulting operation knows its guest PC statically; the helper records it before raising the trap, so no per-instruction PC update is needed.
- **Interrupts.** A countdown decremented per block; at zero the block exits to the dispatcher, which checks pending events.
- **Floating point.** The common case (round-to-nearest, no flag reads) uses native wasm `f64`/`f32`; NaN boxing and the `fflags` accumulation are handled by small checks after operations that can raise NV/OF/UF/NX, and a dynamic rounding mode other than RNE falls back to the soft-float helper. Kubernetes binaries are integer-heavy, so this path is not critical, but it must be exact.
- **R2 success criterion:** speedup over R1 and over TinyEMU on CoreMark and on the start-up of kubectl and kube-apiserver; the target is the "required speedup" column above.

### R3. SMP and snapshots

- **Harts in Workers.** Each vCPU is a Worker running the same wasm instance code against one shared `WebAssembly.Memory` (guest RAM plus TLBs per hart in their own regions). AMOs map to wasm atomic RMW operations; LR/SC is a reservation plus compare-and-swap; `fence` maps to `atomic.fence`. IPIs and remote fences (SBI RFENCE) are a flag in shared memory plus `Atomics.notify`; idle harts sleep in `Atomics.wait`, so an idle node costs no CPU.
- **Code cache across harts.** Compiled modules are posted to every hart Worker; each instantiates them once.
- **Snapshots.** State is CPU registers, CSRs, device state (virtqueues included) and RAM. At image build time a node is booted in headless Chromium (as `build-lab-snapshots.mjs` already does for v86), kuberoot is started, page cache is dropped, and only non-zero RAM pages are stored, compressed, in chunks. **Lazy restore:** on the learner's side every RAM page starts as "absent" in the TLBs; the first access goes to the slow path, which blocks the hart with `Atomics.wait` while another Worker fetches and unpacks the chunk. The node is running after the CPU and device state and the first few megabytes arrive, which is how restore fits in 5 s even for a 512 MB guest.
- **R3 success criterion (from §6.12):** a kuberoot node starts from a snapshot in ≤ 5 s and a pod starts in ≤ 3 s.

### R4. Two kuberoot nodes

- Two machines in one tab, each with 1–2 harts and ≤ 512 MB, joined by `dt-switch` through virtio-net; the control plane runs on the first node.
- Pod networking with Flannel (VXLAN) or Cilium without eBPF acceleration, as §6.12 says.
- **Criterion:** `kubectl apply` produces real pods on both nodes; stopping one node moves its pods; the speed budget of §6.12 holds on a 16 GB laptop.

## Reproducing the measurement

All large files go to `web/public/rv64-r0/` (gitignored). From `web/`:

```bash
node src/engine/rv64-r0/fetch.mjs          # download, verify sha256, unpack (manifest.json)
bash src/engine/rv64-r0/build-tinyemu.sh   # TinyEMU -> wasm, with the R0 patches
SLICE=30000000 bash src/engine/rv64-r0/build-tinyemu.sh   # the large-slice variant
bash src/engine/rv64-r0/build-disk.sh      # Alpine riscv64 disk with the Kubernetes binaries
node src/engine/rv64-r0/measure.mjs engine=r0 disk=alpine mem=1024 k8s=1
```

The page `src/engine/rv64-r0/index.html` (open it through `npm run dev` at `/src/engine/rv64-r0/index.html`; it is not linked from the course) runs the same script by hand. Tools: Emscripten 6.0.9, Go 1.26.5, zig 0.17.1 (C cross-compiler for CoreMark), e2fsprogs 1.47.4, Playwright Chromium 159.
