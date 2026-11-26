# R17 — portable SMP Ready checkpoint, prepared for operator validation

Status: implementation and local unit checks, **not a measured Ready restore**.
No pods, browser, guest boot or Rust builds were run during preparation. The
operator must build the changed WASM, capture, and run the acceptance below.
There is no existing R16 Ready snapshot to publish. In particular, cold-boot
failure does not establish that a snapshot taken at first Node Ready will make
settle/warmup fast: that remains a falsifiable experiment.

## Investigation and choice

* `core/src/bin/rv64-runner.rs` is a 64 MiB, one-CPU ELF/tohost ISA runner.
  `boot.rs` boots Linux with `fdt::build`, one Cpu, optional eager disk and UDP
  Ethernet backend. It has a wall deadline, no SMP host, no snapshot export, and
  prints `JIT_AVAILABLE=false`. Neither is a native SMP kuberoot runner. The JIT
  generates Wasm through JS workers; it is not a native machine-code Rust JIT.
* R1-LOG's native **40.010 effective MIPS** is a single-hart pod CoreMark
  measurement, not an R16 control-plane rate. It cannot justify a native SMP
  Ready time estimate. Implementing native shared RAM/MMIO/SBI, networking and
  a second checkpoint writer would be a longer path with another platform to
  validate. QEMU savevm state cannot be loaded by this emulator.
* R16-long actually retired 30,583,096,094 / 32,673,295,928 instructions in
  ~3000 s: **10.19 / 10.89 MIPS averaged over boot**; supplied 17–20 MIPS/hart
  describes a different/steady window. No Node Ready marker. At the aggregate
  measured boot rate (~21.09 MIPS), 10^12 instructions costs **13.17 hours**.
  The instruction count needed for Ready is unknown; a precise Ready ETA would
  be invented. For measured pod aggregate rate R MIPS, budget **277.78/R hours
  per trillion instructions** (27.8 h at 10 MIPS; 13.9 h at 20 MIPS).
* Selected path: **Node worker_threads running the existing SMP Wasm/JIT
  workers**, with local Range reads, the same DHCP/DNS/mirror L2 services and
  private JIT. No browser, Playwright or Vite server is needed during capture.
  This removes HTTP/browser overhead; it does **not** promise more CPU throughput.
  Two guest harts share the one host CPU quota with their compilers. Unlike a
  faster native hypervisor, it does not solve guest CPU cost. Capture intentionally
  has no wall deadline; stdout and 30 s progress/RSS records survive independently
  of the bounded in-memory result. Capture can also run on an operator's larger
  non-pod machine with the same command; that is not a larger workshop pod.

### What existed, and gaps now filled

R3/R4's `slim-snapshot-media`, `RV64_SNAPSHOT_CAPTURE/RESTORE`, paged loader,
`rv64-hot-snapshot.py` and `rv64-restore-summary.py` concern the **single-hart**
`dt.rv64.paged/v1` path. The hot-set tool expects that RAM group schema and a
training fault trace. Do not apply it to the new SMP manifest. The old summary
looks for a top-level console; SMP evidence is under `result.samples[0]`.
R3's successful snapshot gate was an Alpine in-page wipe/restore, not portable
SMP kuberoot capture. `measure.mjs --smp-kuberoot` used to pass capture/restore
query parameters that `smp-kuberoot.ts` silently ignored.

The new `dt.rv64.smp/v1` envelope stores SHA-256-addressed objects:

| State | Handling |
| --- | --- |
| Both CPUs | registers, CSRs, timer state, PC, waiting/stopped, retired counters |
| CLINT / guest clock | per-Cpu time/mtimecmp/msip and one common restored host epoch |
| PLIC | device engine priority/claim/enable/threshold, including secondary contexts |
| virtio | device/queue indices, pending interrupts, RX/TX, console/input, entropy |
| Disk | immutable R16 identity plus dirty chunks; clean HTTP cache omitted |
| Shared RAM | eager stream of nonzero 1 MiB chunks; zeros implicit; no full RAM copy |
| Host SMP | control/HSM words and SBI mailbox words after draining remote operations |
| Host caches | JIT/TLB/generations rebuilt, LR reservations invalidated (SC may fail) |
| Host network | peers are external; recreated DHCP/DNS/HTTP services, existing external TCP sessions may reconnect |

Important discovered defect: secondary PLIC enable/threshold arrays had
`serde(skip)`. CPU blob **DTRV64\0\x03** now appends those arrays; v2 is rejected.
Single-hart v1 bytes remain unchanged. Dirty tracking is reconstructed on restore
because that set is also serde-skipped. Both issues have Rust regression tests.
The snapshot barrier first stops all harts while servicing MMIO/fences, then
finishes device disk work and serializes. The small SMP gate now uses this same
quiescence phase. CPU blobs remain architecture-independent bincode data, but
restore deliberately requires the **exact same WASM hash**, memory, topology
and base medium hash/length. Rebuild invalidates published checkpoints.

Manifest is published last. Each chunk is independently hashed and restored
before workers start; malformed layout/provenance/checksums fail closed. This is
an eager loader, not the R3 demand pager. Expect up to 1 GiB of RAM download.
A capture stops when stdout contains `RV64_NODE_REGISTERED_READY`, before the
retained probe's settle/warmup/recheck/pod sequence completes. On restore that
same shell process continues; no probe rewrite or R16 image repack is needed.
A few execution batches can elapse between marker output and quiescence.

## Clock, leases and continued operation

Use **continuous** for the acceptance. Existing `restoreTimeOffset` resumes at
the saved TIME ticks, excludes storage downtime and then advances at normal
host-monotonic speed. It neither accelerates the guest nor sets time to the new
host UTC. Linux wall time stays at the checkpoint's date plus running time;
certificates and leases see the same continuous timeline. No certificate bypass,
lease deletion, fake Ready condition or renewal rewrite occurs. R15/R16's 2400 s
lease and 3000/3600 s node grace remain. A stale Ready condition alone is therefore
insufficient: require a **new kubectl recheck and actual pod Ready wait**.

`clock=elapsed` adds nonnegative host wall downtime to saved ticks. Old leases,
controller deadlines and watches can immediately expire; sufficiently old
snapshots can have expired certificates. Reconciliation/TLS may again cost a
long time. This mode is supported for diagnosis, not promised within acceptance.
Continuous snapshots are isolated training clusters with their original node
identity/MAC and historical date, not real-time connected production clusters.
Pause/throttle of a *running* tab is not excluded by continuous restore; keep the
host awake. All in-guest API/loopback connections reside in saved RAM; only
connections to host services are outside the snapshot.

`keep=1` leaves the emulator running after `RV64_PROBE_DONE`; the normal measure
run terminates after evidence collection. The command field sends to the retained
R16 diagnostic console shell. It does not create a shell in a medium lacking one.

## Memory and storage budget

Use the **existing** Debian bookworm pod and PVC `rv64-r15-work` (10Gi), CPU 1,
memory 2Gi. Do not create a second pod or run builds concurrently with capture.
Node defaults to a **64 MiB charged JIT budget per hart**, no unused shared broker
or compile pool. Browser restore retains private 384 MiB, as before. This is a
cache tradeoff, not an assertion that encoded JIT bytes equal RSS.

Planning budget: shared guest RAM 1024 MiB, generations 1 MiB, reservation table
32.1 MiB; two private Wasm instances/device engine and allocator high-water marks
~128–256 MiB; JIT allowance 128 MiB; four Node worker heaps capped at 96 MiB each
(they normally use less), main heap 128 MiB; bounded metrics 32 MiB; disk cache
trimmed above 32 MiB when outstanding reads drain; hash/write chunks 1 MiB.
These are overlapping accounting categories, not a measured sum or a strict
RSS proof. Dirty disk data cannot be evicted. Read-only rootfs + tmpfs normally
keeps it small. Guest RAM and device queues are never truncated to fit.

The Node runner records process RSS (all worker threads) and exits if it exceeds
**1850 MiB**, leaving margin below 2Gi; sampling once per second cannot prevent
all transient OOMs. There is **no measured 2Gi success yet**. If that guard or
cgroup OOM fires, retain logs and do not request a larger tenant pod or label the
artifact accepted. The next decision requires actual private Wasm/JIT/RSS data;
there is no evidence for an exact larger required allocation. Snapshot objects
are streamed; no whole 1GiB base disk or RAM duplicate is held in JS.

Allow ~5Gi free on PVC before setup (npm/toolchains/build temporaries/checkpoint).
Reuse the R16 image by symlink, not a second copy. Remove only disposable build
intermediates after successful builds if needed; preserve the R16 results and
previous captures. A 10Gi claim with old build attempts may first require the
operator to remove those known failed attempts.

## Operator: prepare the existing pod and build

All blocks are bash from repository root unless specified. Replace POD with the
name of the existing 1 CPU / 2Gi bookworm workshop pod if it differs. This plan
uses `rv64-r16`; it does not call scripts that implicitly start/use rv64-dev.

```bash
set -euo pipefail
export KUBECONFIG="$HOME/workshop.txt"
export CTX=admin@workshop NS=tenant-kuberoot POD=rv64-r16
kubectl --context "$CTX" -n "$NS" get pod "$POD" -o jsonpath='{.spec.containers[0].resources}{"\n"}{.spec.volumes}{"\n"}'
kubectl --context "$CTX" -n "$NS" exec "$POD" -- df -h /work
kubectl --context "$CTX" -n "$NS" exec "$POD" -- mkdir -p /work/r17/web /work/tmp
COPYFILE_DISABLE=1 tar -cf - --exclude=node_modules --exclude=target \
  web/package.json web/package-lock.json web/src web/scripts/rv64-node \
  web/tests/rv64-smp-checkpoint.test.ts |
  kubectl --context "$CTX" -n "$NS" exec -i "$POD" -- tar -xf - -C /work/r17
# Small unchanged boot assets and actual R16 manifest; no base-image duplicate.
COPYFILE_DISABLE=1 tar -cf - web/public/rv64/slim-vmlinuz.efi \
  web/public/rv64/slim-initrd.cpio web/public/rv64/r16-uncompressed-no-reboot.json |
  kubectl --context "$CTX" -n "$NS" exec -i "$POD" -- tar -xf - -C /work/r17
kubectl --context "$CTX" -n "$NS" exec "$POD" -- sh -ec '
  test -f /work/r16/r16-uncompressed-no-reboot.img
  ln -s /work/r16/r16-uncompressed-no-reboot.img /work/r17/web/public/rv64/r16-uncompressed-no-reboot.img
'
```

The symlink is a first-setup command; on retry verify it instead of replacing it.
If this pod's R16 image has a different path, change just the symlink source.
The Node preflight streams and verifies its SHA-256 against the copied manifest.
The offline retained probe imports its embedded images. If testing additional
mirror-backed workloads, copy their `/mirror/` assets into this same public root.

Install pinned tools into /work only if the existing pod does not already have
compatible Rust/Node/wasm-bindgen. Compiler/linker (`cc`) is required; the full
`python:3.11-bookworm` image used in R16 includes build tools.

```bash
kubectl --context "$CTX" -n "$NS" exec "$POD" -- bash -se <<'SH'
set -euo pipefail
export TMPDIR=/work/tmp CARGO_HOME=/work/cargo RUSTUP_HOME=/work/rustup
export PATH=/work/cargo/bin:/work/tools/bin:$PATH
mkdir -p /work/tools
command -v cc
if ! command -v rustup >/dev/null; then
  curl -fsSL https://sh.rustup.rs -o /work/tools/rustup-init.sh
  sh /work/tools/rustup-init.sh -y --no-modify-path --profile minimal --default-toolchain 1.90.0
fi
rustup toolchain install 1.90.0 --profile minimal
rustup target add --toolchain 1.90.0 wasm32-unknown-unknown
export CARGO_BUILD_JOBS=1 CARGO_TARGET_DIR=/work/r17/cargo-target
cargo +1.90.0 install wasm-bindgen-cli --version 0.2.100 --locked --debug --jobs 1 --root /work/tools
case "$(uname -m)" in x86_64) arch=x64;; aarch64) arch=arm64;; *) exit 1;; esac
cd /work/tools
file=node-v24.11.1-linux-$arch.tar.xz
curl -fLO "https://nodejs.org/dist/v24.11.1/$file"
curl -fL https://nodejs.org/dist/v24.11.1/SHASUMS256.txt -o node-SHASUMS256.txt
awk -v name="$file" '$2==name' node-SHASUMS256.txt > node-checksum.txt
test -s node-checksum.txt
sha256sum -c node-checksum.txt
tar -xf "$file"
ln -sfn "node-v24.11.1-linux-$arch" node-r17
export PATH=/work/tools/node-r17/bin:$PATH
cd /work/r17/web
npm ci --ignore-scripts --cache /work/r17/npm-cache
node --test scripts/rv64-node/runtime.test.mjs
cd src/engine/rv64/core
cargo +1.90.0 test --locked --jobs 1 -- --test-threads=1
cargo +1.90.0 build --lib --locked --release --target wasm32-unknown-unknown --jobs 1
/work/tools/bin/wasm-bindgen /work/r17/cargo-target/wasm32-unknown-unknown/release/rv64_core.wasm \
  --target web --keep-debug --out-dir /work/r17/web/public/rv64 --out-name rv64_core
# Use the existing pinned Binaryen if present; otherwise this build is usable
# without wasm-opt. Whatever bytes capture uses MUST also be used by the tab.
if test -x /work/tools/binaryen-version_123/bin/wasm-opt; then
  /work/tools/binaryen-version_123/bin/wasm-opt -O3 -g \
    /work/r17/web/public/rv64/rv64_core_bg.wasm -o /work/r17/web/public/rv64/rv64_core_bg.wasm
fi
SH
```

Builds are sequential and one-job. Cargo success is a required gate, not a result
claimed by this document. Copy newly built WASM/JS locally before browser gates:

```bash
for file in rv64_core.js rv64_core_bg.wasm; do
  kubectl --context "$CTX" -n "$NS" exec "$POD" -- cat "/work/r17/web/public/rv64/$file" > "web/public/rv64/$file.download"
  mv "web/public/rv64/$file.download" "web/public/rv64/$file"
done
# Operator-only small Alpine all-hart quiesce/wipe/restore gate, before long boot.
(cd web && RV64_TIMEOUT_MS=900000 node src/engine/rv64/measure.mjs --smp-snapshot)
```

## Unlimited capture, measured rate and fetch

Run in an operator terminal that can remain connected; alternatively use the
operator's normal persistent shell. Do not wrap this in `timeout`. Failure, guest
panic, failed probe, worker errors or the RSS guard exit nonzero. The output
directory must not exist; choose another name after inspecting an interrupted
attempt. A directory without `smp.json` is not a checkpoint.

```bash
mkdir -p web/public/rv64/results
kubectl --context "$CTX" -n "$NS" exec "$POD" -- bash -ec '
  export PATH=/work/tools/node-r17/bin:$PATH
  export NODE_OPTIONS=--max-old-space-size=128
  export VITE_RV64_JIT_BUDGET_MB=64
  cd /work/r17/web
  node scripts/rv64-node/capture.mjs public /work/r17/ready \
    > /work/r17/capture-console.txt 2> /work/r17/capture-metrics.jsonl
'
# While it runs, another terminal can read (no second emulator):
# kubectl --context "$CTX" -n "$NS" exec "$POD" -- tail -5 /work/r17/capture-metrics.jsonl
```

Metrics include cumulative `retired`, `hart`, `guestTicks`, host timestamps and
process RSS. Compute delta-retired / delta-host-seconds for **each** hart between
records, then sum; the latest record is one hart, not the machine total. Use the
rate formula above to revise the hours estimate. Once capture succeeds its
elapsed seconds, retired counts and marker timestamps supply an actual Ready
estimate for subsequent runs. It is legitimate for this first attempt to take
many hours; it is not legitimate to claim a measured speedup beforehand.

```bash
# Tar stream retains all content-addressed objects; destination must be fresh.
test ! -e web/public/rv64/snapshots/r17-ready
mkdir -p web/public/rv64/snapshots/r17-ready
kubectl --context "$CTX" -n "$NS" exec "$POD" -- tar -cf - -C /work/r17/ready . |
  tar -xf - -C web/public/rv64/snapshots/r17-ready
for file in capture-console.txt capture-metrics.jsonl; do
  kubectl --context "$CTX" -n "$NS" exec "$POD" -- cat "/work/r17/$file" > "web/public/rv64/results/R17-$file"
done
python3.11 - <<'PY'
import hashlib, json
from pathlib import Path
root = Path('web/public/rv64')
p = root/'snapshots/r17-ready'
m = json.loads((p/'smp.json').read_text())
assert m['format'] == 'dt.rv64.smp/v1' and m['harts'] == 2 and m['bytes'] == 1024**3
assert m['marker'] == 'RV64_NODE_REGISTERED_READY'
with (root/'rv64_core_bg.wasm').open('rb') as f:
    assert hashlib.file_digest(f, 'sha256').hexdigest() == m['wasmSha256']
disk = json.loads((root/'r16-uncompressed-no-reboot.json').read_text())
assert m['disk'] == disk
with (root/'r16-uncompressed-no-reboot.img').open('rb') as f:
    assert hashlib.file_digest(f, 'sha256').hexdigest() == disk['version']
refs = m['cpus'] + [m['device'], m['control'], m['mail']] + [c['object'] for c in m['ram']]
for ref in refs:
    file = p/(ref['sha256']+'.bin')
    assert file.stat().st_size == ref['bytes']
    with file.open('rb') as f:
        assert hashlib.file_digest(f, 'sha256').hexdigest() == ref['sha256']
print('Verified SMP checkpoint, WASM and R16 base; browser acceptance still required')
PY
```

Do not commit generated media, WASM, large snapshot objects or private guest keys.
The artifact contains the isolated cluster's kubeconfig/private keys in RAM.

## Browser restore and acceptance

Target **N = 30 minutes from page load**, including eager RAM hydration, a fresh
kubectl Node Ready recheck, retained pod start and `RV64_PROBE_DONE`. This is an
acceptance threshold, **not a measured guarantee**. The R16 capture marker only
proves registration and can still precede expensive add-on/warmup work.

```bash
(cd web && \
  RV64_RESULT_NAME=R17-restore RV64_PROBE_SECONDS=1800 RV64_TIMEOUT_MS=1830000 \
  RV64_HARTS=2 RV64_MEMORY_MB=1024 VITE_RV64_SHARED_JIT=0 VITE_RV64_JIT_BUDGET_MB=384 \
  RV64_MEDIA_MANIFEST=/rv64/r16-uncompressed-no-reboot.json \
  RV64_SNAPSHOT_RESTORE=/rv64/snapshots/r17-ready/smp.json RV64_RESTORE_CLOCK=continuous \
  node src/engine/rv64/measure.mjs --smp-kuberoot \
  > public/rv64/results/R17-restore-run.log 2>&1)
python3 - <<'PY'
import json
x=json.load(open('web/public/rv64/results/R17-restore.json'))['result']
s=x['samples'][0]; markers=s['markers']
assert x['pass'] and x['restored'] and not s.get('error')
assert s['pageElapsedMs'] <= 1800000
for name in ['RV64_RECHECK_READY', 'RV64_POD_START_END', 'RV64_PROBE_DONE']:
    assert name in markers, name
assert 'RV64_PROBE_FAILED' not in s['console']
print('R17 acceptance:', s['restoreReadySeconds'], 'seconds to fresh Ready recheck;', s['podStartSeconds'], 'seconds pod start')
PY
```

Retain result JSON, console, run log, capture log and exact source commit/WASM/
base hashes. Check for OOM, unexplained service restarts and continuing lease
renewals, not merely absence of TLS timeout messages. For an interactive tab
that stays alive after acceptance:

```bash
(cd web && VITE_RV64_SHARED_JIT=0 VITE_RV64_JIT_BUDGET_MB=384 npm run dev -- --port 5198 --strictPort)
```

Open, as operator:
`http://localhost:5198/src/engine/rv64/smp-kuberoot.html?harts=2&memory=1024&seconds=1800&keep=1&clock=continuous&sharedJit=0&media=/rv64/r16-uncompressed-no-reboot.json&restore=/rv64/snapshots/r17-ready/smp.json`.
The command field can run `kubectl --request-timeout=600s get nodes -o wide`,
`kubectl --request-timeout=600s get pods -A -o wide`, and
`kubectl --request-timeout=600s -n kube-node-lease get leases -o yaml`.
Retain two lease observations separated by at least the configured renewal
interval; verify renewTime advances while the node stays Ready. Do not use the
measuring tab concurrently with this one. No HMR edits during a run.

If first-Ready capture does not meet N, R17 acceptance has failed. Preserve that
evidence. A later settled checkpoint may be the next experiment, but this change
does not quietly move the marker or substitute old R3 single-hart snapshots.

## Local checks and remaining operator gates

`npm run typecheck`; all RV64 Vitest files; and
`node --test scripts/rv64-node/runtime.test.mjs`. Adapter test covers actual TS
module resolution, worker messaging, shared Wasm atomics, Range bounds, disabled
external fetch, atomic upload, and loading the full harness import graph without
booting a guest. Snapshot tests cover sparse streaming, identity/layout rejection,
checksum corruption, roundtrip and clock policies. Added native regression covers
dirty overlay + secondary PLIC retention. Cargo is unavailable on the preparation
host: operator `cargo test --locked --jobs 1 -- --test-threads=1` above is mandatory.

Still unmeasured: pod RSS/rate/Ready time, fresh-process cross-host SMP restore,
continued Ready/lease renewal, and the retained pod start. Passing unit tests or
the old in-page gate does not establish those outcomes.

Preparation verification: typecheck passed; RV64 Vitest **72 passed, 6 skipped**
(14 passing files, one skipped integration file); Node adapter smoke passed,
including compiling/transferring a real shared-memory JIT module in a worker.
All operator bash blocks passed `bash -n`; `git diff --check` passed. No cargo,
pod, browser or guest-boot result is implied by those checks.
