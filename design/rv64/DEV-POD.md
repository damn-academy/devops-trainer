# RV64 development pod

All Rust builds and tests run in the workshop cluster. Do not install Rust,
build wasm, or start Docker/VMs on the Mac. Local TypeScript and browser
tests are allowed. Always specify the context **after** the kubectl subcommand.

## Objects owned by this task

- Namespace: existing `tenant-kuberoot` (not created or owned by this task).
- Pod: `rv64-dev`, official pinned `rust:1.85.1-bookworm` image.
- PVC: `rv64-dev-work`, 15Gi, RWO, `replicated`, mounted at `/work`.
- Manifest: `design/rv64/rv64-dev.yaml`.

Preflight on 2026-11-21: ResourceQuota had 850m CPU request headroom;
no PVC/storage quota. Existing filesystem PVC uses `replicated`.
Pod requests 500m/2Gi, limits 4 CPU/8Gi, root ephemeral limit 2Gi.
Cargo registry, targets, source, rustup (including wasm target), tool builds,
APT cache and temporary files all live on the PVC. APT-installed binaries
live in the container root; check its usage after installation.
Other pods, including `builder` and `rv-test`, must not be changed.

## Provision and use

```bash
export KUBECONFIG="$HOME/workshop.txt"
kubectl get resourcequota,limitrange,pvc --context admin@workshop -n tenant-kuberoot
kubectl apply --context admin@workshop -n tenant-kuberoot -f design/rv64/rv64-dev.yaml
kubectl wait --context admin@workshop -n tenant-kuberoot --for=condition=Ready pod/rv64-dev --timeout=180s
scripts/rv64-dev.sh bootstrap
scripts/rv64-dev.sh cargo test
scripts/rv64-dev.sh wasm
```

`cargo` syncs the local crate with tar over `kubectl exec`, then forwards
arguments without shell evaluation and streams stdout/stderr. Cargo exit
status propagates to the caller. `wasm` builds in the pod and copies the
bindgen JS/types and optimized wasm to gitignored `web/public/rv64/`.
`sync` uploads sources without compiling. No command runs local Cargo.
Sync extracts into a temporary PVC directory, then replaces `/work/src/core`, so
deleted local files do not survive remotely. Do not run concurrent sync/builds.
`copy-wasm` fetches an existing build and checks SHA-256 before replacing local
artifacts. Binaryen is pinned to 123; Debian Binaryen 108 breaks bindgen table exports.

## Delete only these objects

Deleting the PVC discards all R1 build caches and remote test artifacts.
Copy any needed logs/results first. These commands intentionally do not
delete the namespace or touch other workloads:

```bash
export KUBECONFIG="$HOME/workshop.txt"
kubectl delete pod rv64-dev --context admin@workshop -n tenant-kuberoot
kubectl delete pvc rv64-dev-work --context admin@workshop -n tenant-kuberoot
```

## Status

Pod and PVC created. Bootstrap/build/test results are recorded in `R1-LOG.md`.
Final checkpoint: Running, zero restarts, PVC 9.3Gi used / 15Gi provisioned.
`df /` describes the node-backed overlay capacity, not the 2Gi container
ephemeral-storage allowance; do not use that capacity as permission to fill it.

## Repeat verification in the existing pod

Pinned source revisions and artifact hashes are in
`web/src/engine/rv64/verification-pins.txt`. The current PVC already contains
Spike, upstream tests, architecture tests and guest artifacts. Source sync
replaces only `/work/src/core`, not these caches.

```bash
scripts/rv64-dev.sh cargo test --locked
KUBECONFIG="$HOME/workshop.txt" kubectl exec --context admin@workshop -n tenant-kuberoot rv64-dev -- bash -ceu 'cd /work/src/core; RV64_ISA_DIR=/work/tests/isa cargo test --release --test upstream -- --ignored --nocapture'
KUBECONFIG="$HOME/workshop.txt" kubectl exec -i --context admin@workshop -n tenant-kuberoot rv64-dev -- bash -se < scripts/rv64-arch-tests.sh
KUBECONFIG="$HOME/workshop.txt" kubectl exec --context admin@workshop -n tenant-kuberoot rv64-dev -- bash -ceu 'cd /work/src/core; RV64_COREMARK=1 cargo run --release --bin boot -- /work/guest/vmlinuz.efi /work/guest/alpine.cpio 180 "earlycon=sbi console=hvc0 rdinit=/init nokaslr"'
scripts/rv64-dev.sh wasm
cd web
node src/engine/rv64/measure.mjs
node src/engine/rv64/measure.mjs --boot
```

Before an architecture signature run after editing core, build the native
runner with `scripts/rv64-dev.sh cargo build --release --bin rv64-runner`.
The browser boot run also needs `vmlinuz.efi` and `alpine.cpio` copied into
`web/public/rv64/`; these are already present in this workspace and are
gitignored. See the pins file and R1 log for their provenance. Browser results
are written to `web/public/rv64/results/`. The committed-source review copies
are `design/rv64/R1-browser-result.json` and `R1-test-results.txt` (not committed
by this task).

## Recreate verification tools on a fresh PVC

After bootstrap, run the following **inside rv64-dev**, never on the Mac:

```bash
mkdir -p /work/tests
git clone https://github.com/riscv-software-src/riscv-tests.git /work/tests/riscv-tests
git -C /work/tests/riscv-tests checkout 3df703cd52d5f0d8224e3c50bf03c6cb70efff98
git -C /work/tests/riscv-tests submodule update --init --recursive
git clone https://github.com/riscv-software-src/riscv-isa-sim.git /work/tests/spike
git -C /work/tests/spike checkout 982f078e65ab52d5d9a91248c2178f5399df7783
git -C /work/tests/spike submodule update --init --recursive
mkdir -p /work/tests/spike/build
cd /work/tests/spike/build
../configure --prefix=/work/tools
make -j4
make install
git clone https://github.com/riscv-non-isa/riscv-arch-test.git /work/tests/arch-test
git -C /work/tests/arch-test checkout 0eb7c22ae2b42ac7423eb46d1bc3701fc4f47baa
```

Copy `web/src/engine/rv64/arch-test/{model_test.h,link.ld}` into
`/work/tests/arch-test/`. Run `scripts/rv64-build-tests.sh` and
`scripts/rv64-arch-tests.sh` through `kubectl exec -i ... -- bash -se`, as above.
These scripts deliberately require pod CARGO_HOME. Guest preparation helper
`rv64-initramfs.py` likewise runs in the pod; the shell rootfs must include the
pinned R0 CoreMark binary for the benchmark. It is not the full kuberoot initrd.

## Temporary transfer endpoint

Created `Service/rv64-dev-files` (LoadBalancer, NodePort 32187) with selector
`app=rv64-dev`, port 80 → 8081. No other workload is selected. The HTTP process
serves `/work/guest`, containing only public guest/build artifacts. It was needed
because long kubectl streams repeatedly reset. `rv64-guest-chunks.py` runs in the
pod, `rv64-fetch-guest.py URL` downloads/checks/reassembles the chunks on the Mac.
Delete the temporary Service after transfer:

```bash
KUBECONFIG="$HOME/workshop.txt" kubectl delete service rv64-dev-files --context admin@workshop -n tenant-kuberoot
```

The service is not included in the normal dev-pod manifest. To stop its HTTP
process without touching other pods, read `/work/guest-http.pid` inside rv64-dev
and terminate that process. Pod deletion also terminates it.

**Cleanup completed 2026-11-21:** Service deleted; HTTP process terminated and
PID file removed. Only Pod `rv64-dev` and PVC `rv64-dev-work` remain from this
task. The separate `rv64-dev-files.yaml` is an optional transfer workaround,
not a service that should normally be deployed.
