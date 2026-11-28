# R4: two-hart readiness with recovery shutdown suppressed

Prepared locally on 2026-11-25. The lead runs the pod and browser commands below;
no pod access or browser acceptance measurement was performed during preparation.
Do not edit web sources while measuring: Vite HMR can restart the entire harness.
Run only one browser measurement at a time. All build workspace is on the PVC.

## What this experiment changes

`scripts/rv64-emulator-recovery.py` defines the retained recovery wrapper:
`KINE_COMPACT_TIMEOUT=5m`, kubelet status/report/sync = 10s/5m/1m, and a separately
supervised kube-proxy. **Those are not a node reboot health window.** The probe
in `scripts/rv64-kuberoot-probe.py` polls Ready indefinitely; its readyz request
has a 120s timeout, and its pod wait has a 300s timeout. Neither reboots a node.

Read-only inspection of kuberoot source revision `a229283` found:

- `cmd/kinit/watchdog.go`: probation deadline 8 minutes, then `shutdown`.
- `pkg/nodeapi/upgrade.go`, `assessBoot`: 30s healthy window within a 5-minute
  deadline; reboot through kinit only with a fallback slot.
- `cmd/kinit/main.go`, `shutdown`: stops services and kills other processes
  **before** calling the reboot syscall.
- `pkg/upgrade/slots.go`, `CurrentSlot`: these checks require an installed
  A/B root partition. Our `KUBEROOT-MEDIA` cmdline does not select one.

Thus the recovery-window explanation is still a hypothesis. Repeated kernel
headers can also be a restarted browser page; the locally retained granule
console has only one header (progress capture overwrites earlier text).
Do not claim a confirmed watchdog reboot without its shutdown reason.

The opt-in build variable `RV64_RECOVERY_VARIANT=no-reboot` uses
`scripts/rv64-no-reboot.py` to replace the **entry** of `main.shutdown` with
RV64 `ret`, before any service shutdown. This is a diagnostic binary overlay,
not a source rebuild or a general-purpose profile. It suppresses all kinit
shutdown paths, including requested poweroff, not service crashes or kernel
panics. A syscall-only blocker would leave the node with its services killed.
The exact original kinit SHA-256 is pinned to
`da30c8a762498db9659ac1be9da655beea8048ee29a39fcfd0ddb534076d6632`;
the retained symbol export locates `main.shutdown` at `0x7ad410`. The tool resolves
it again from the actual ELF and refuses any unknown binary. It preserves ELF
layout, stores original bytes/hash/address evidence and an original backup.
The original recovery profile remains the default; use a fresh root for each
variant. This experiment disables shutdown rather than inventing a YAML health
field the retained binary does not implement. No other worktree is modified.

## 1. Build wasm and upload helpers (Mac, repository root)

The TypeScript changes need no wasm rebuild. Rebuild if the local wasm is not
known to include guest profiler SMP fix `4790473` (safe command shown here):

```bash
cd ~/projects/devops-trainer
export KUBECONFIG="$HOME/workshop.txt"
scripts/rv64-dev.sh wasm
kubectl exec --context admin@workshop -n tenant-kuberoot rv64-dev -- mkdir -p /work/guest/r4-tools
tar -cf - -C scripts rv64-emulator-recovery.py rv64-no-reboot.py rv64-guest-symbols.py rv64-uncompressed-media.py rv64-serve-media.py |
  kubectl exec -i --context admin@workshop -n tenant-kuberoot rv64-dev -- tar -xf - -C /work/guest/r4-tools
```

Keep `web/public/rv64/slim-vmlinuz.efi`, `slim-initrd.cpio`, and the existing
`profile-symbols/{all.json.gz,maps.json}` from the retained fixture. No kernel,
control binary, offline images, or probe replacement is needed. In particular,
reapplying `rv64-kuberoot-probe.py` would discard the existing probe's opt-ins.

## 2. Build a separate medium in rv64-dev

Find the **exact recovery-v3** base by size and SHA-256, rather than assuming a
mutable root directory is still the right one. Missing base or an unknown
kinit hash is a hard error; retain that output and do not weaken the pin.
This sequence refuses an existing R4 destination. It needs `mcopy`, `mksquashfs`,
`unsquashfs`, `mformat`, `mmd`, Python 3.11+, already used by the R3 pod.

```bash
kubectl exec -i --context admin@workshop -n tenant-kuberoot rv64-dev -- bash -se <<'POD'
set -eu
export CARGO_HOME=/work/cargo TMPDIR=/work/tmp
mkdir -p "$TMPDIR"
python3 - <<'PY'
import hashlib
from pathlib import Path
base = Path('/work/guest/r4-no-reboot')
if base.exists():
    raise SystemExit('R4 output already exists; choose a new experiment name explicitly')
expected = 'f092ef9d857c4e1282826b36041350de0df3b7576a876701595bfe5e750da359'
for p in sorted(Path('/work/guest').rglob('*.img')):
    if p.stat().st_size != 306184192:
        continue
    with p.open('rb') as f:
        digest = hashlib.file_digest(f, 'sha256').hexdigest()
    if digest == expected:
        base.mkdir()
        (base / 'source.txt').write_text(str(p))
        break
else:
    raise SystemExit('exact recovery-v3 image is absent from /work/guest')
PY
base=/work/guest/r4-no-reboot
source=$(cat "$base/source.txt")
mcopy -i "$source@@1048576" ::/kuberoot/rootfs.squashfs "$base/source.squashfs"
unsquashfs -d "$base/root" "$base/source.squashfs"
RV64_PROBE_ROOT="$base/root" RV64_RECOVERY_VARIANT=no-reboot \
  python3 /work/guest/r4-tools/rv64-emulator-recovery.py
cat "$base/root/usr/share/kuberoot/rv64-no-reboot.json"
RV64_MEDIA_ROOT="$base" RV64_MEDIA_TEMPLATE="$source" RV64_MEDIA_COMPRESSED=1 RV64_MEDIA_NAME=r4-no-reboot \
  python3 /work/guest/r4-tools/rv64-uncompressed-media.py
python3 - <<'PY'
import hashlib, json
from pathlib import Path
p = Path('/work/guest/r4-no-reboot/r4-no-reboot.img')
with p.open('rb') as f:
    digest = hashlib.file_digest(f, 'sha256').hexdigest()
manifest = dict(url='http://127.0.0.1:18082/media', bytes=p.stat().st_size, version=digest)
p.with_suffix('.json').write_text(json.dumps(manifest) + '\n')
print(manifest)
PY
POD
kubectl exec --context admin@workshop -n tenant-kuberoot rv64-dev -- cat /work/guest/r4-no-reboot/r4-no-reboot.json > web/public/rv64/r4-no-reboot-media.json
```

## 3. Serve media (keep two separate terminals running)

Terminal A, foreground server; Ctrl-C stops it after measurement:

```bash
export KUBECONFIG="$HOME/workshop.txt"
kubectl exec --context admin@workshop -n tenant-kuberoot rv64-dev -- env CARGO_HOME=/work/cargo python3 /work/guest/r4-tools/rv64-serve-media.py /work/guest/r4-no-reboot/r4-no-reboot.img 8082
```

Terminal B, loopback-only forwarding; Ctrl-C stops it after measurement:

```bash
export KUBECONFIG="$HOME/workshop.txt"
kubectl port-forward --context admin@workshop -n tenant-kuberoot --address 127.0.0.1 pod/rv64-dev 18082:8082
```

Terminal C: verify range serving before a long run (206, 512 bytes):

```bash
curl --fail -sS -D /tmp/r4-range.headers -H 'Range: bytes=0-511' http://127.0.0.1:18082/media -o /tmp/r4-range.bin
cat /tmp/r4-range.headers
wc -c /tmp/r4-range.bin
```

## 4. Run only two harts for 3000 host seconds

```bash
cd ~/projects/devops-trainer/web
mkdir -p public/rv64/results
RV64_RESULT_NAME=R4-smp-2h-no-reboot-3000s \
RV64_HARTS=2 \
RV64_PROBE_SECONDS=3000 \
RV64_TIMEOUT_MS=3300000 \
RV64_GUEST_PROFILE_INTERVAL=100003 \
RV64_GUEST_PROFILE_START_AFTER=RV64_READYZ_BEGIN \
RV64_MEDIA_MANIFEST=/rv64/r4-no-reboot-media.json \
node src/engine/rv64/measure.mjs --smp-kuberoot \
  > public/rv64/results/R4-smp-2h-no-reboot-3000s-run.log 2>&1
```

SMP uses 1024 MiB, JIT threshold 50, and continuous host-derived guest ticks;
`RV64_MEMORY_MB`, `RV64_JIT_THRESHOLD` and restore settings are not SMP knobs.
3000s is the total host probe window, **not** 3000s after readyz. The outer
3300s bound allows result collection. Guest wall-clock and instruction progress
are different quantities; quote both guest uptime and host marker time.

The harness enables both profilers once the complete readyz marker arrives,
even if split across console messages. `profileStartedMs` records dispatch time;
each worker handles it between batches. Metrics drain profiles about once per
second. Up to the final undrained second can be lost on worker termination.
Final JSON preserves all received `metrics[].guestProfile.rows` by hart even on
a normal probe timeout. An outer runner timeout also attempts a `-partial.json`
capture; a hung/crashed renderer cannot guarantee this capture. The console
progress file is updated every 30s. A nonzero runner exit on timeout is expected;
analyze the saved result rather than treating the exit as lost evidence.

## 5. Read results and symbolize both harts

From repository root:

```bash
cd ~/projects/devops-trainer
python3 - <<'PY'
import json
from pathlib import Path
p = Path('web/public/rv64/results/R4-smp-2h-no-reboot-3000s.json')
if not p.exists():
    p = p.with_name(p.stem + '-partial.json')
d = json.loads(p.read_text())
for r in d['result']['samples']:
    print({k: r.get(k) for k in ('harts', 'error', 'coldReadySeconds', 'firstGetPodsSeconds', 'podStartSeconds', 'profileStartedMs')})
    print('kernel headers:', r['console'].count('Linux version '))
    print('no-reboot marker:', 'RV64_RECOVERY_NO_REBOOT' in r['console'])
    print('media:', r['httpDisk'])
    print('profile rows by hart:', {h: sum(len(m.get('guestProfile', {}).get('rows', [])) for m in r['metrics'] if m['hart'] == h) for h in range(r['harts'])})
    Path('web/public/rv64/results/R4-smp-2h-console.txt').write_text(r['console'])
PY
python3 scripts/rv64-guest-profile.py \
  web/public/rv64/results/R4-smp-2h-no-reboot-3000s.json \
  --symbols web/public/rv64/profile-symbols/all.json.gz \
  --maps web/public/rv64/profile-symbols/maps.json \
  > web/public/rv64/results/R4-smp-2h-profile.json
```

Use the `-partial.json` filename in the last command if only that exists.
Reports are `reports[]`, one per topology/hart, with `all-captured` and
`after-readyz` windows, `top50` functions, process totals, unresolved counts,
intervals and dropped counts. Historical single-hart reports remain supported.
SMP row timestamps use guest ticks and the recorded epoch offset, not message
arrival latency. These are **instruction-attempt samples**, not wall-time shares;
do not compare raw sample counts as CPU time across harts. The maps name exact
ELF hashes. Reuse the retained tables for unchanged binaries; kinit's code differs
only at shutdown, so its other address ranges still match, but record the
`rv64-no-reboot.json` overlay alongside that original-symbol provenance. Unknown
or ambiguous address spaces remain unresolved. Do not guess their symbols.

Interpretation:

- **Ready reached:** `coldReadySeconds` measures launch to `RV64_NODE_READY`;
  read the immediately following `/proc/uptime` for guest time. This probe emits
  Ready after image import (and, if retained, settlement), so also inspect
  `RV64_NODE_STATUS=True` and `RV64_SETTLE_*`; do not call it the exact first
  node-condition transition. `podStartSeconds` is `RV64_POD_START_BEGIN` to END;
  require `RV64_PROBE_DONE` for the complete get-pods/pod-start acceptance.
  Ready alone with null pod duration is partial progress. Repeat without
  profiling before comparing performance with the ~743s baseline.
- **Still stuck, no restart:** inspect per-hart `after-readyz` functions and
  readyz failures. `runtime.futex`, `runtime.lock*`, semaphores, kernel futex or
  scheduler paths suggest synchronization/scheduling work; contrast both harts,
  sample counts and instruction deltas. They do not prove a lock owner or a
  deadlock. The reservation-granule hypothesis was already refuted as this cause.
- `runtime.findRunnable`, `schedule`, `netpoll`, timer functions: inspect runnable
  work, deadlines and hart activity; many samples do not prove useful progress.
  `runtime.gc*`, `scanobject`, allocation: inspect heap/GC pressure. SQLite/kine
  transaction/compaction functions plus SQL timeout logs point to datastore work.
  TLS/crypto/x509 plus handshake errors point to connection/deadline costs.
  `runtime.pcvalue`/unwinding alone does not prove klog: use caller evidence.
- **Restart despite the marker:** kinit shutdown suppression did not remove the
  cause. Look for panic, service exit, browser errors/HMR and fresh page epochs.
  Do not extend arbitrary timeouts again. Missing marker or wrong media hash
  invalidates the A/B experiment. A missing readyz marker explains zero samples;
  samples from only one hart require checking its peer's state before attribution.

A successful run supports further A/B testing; it does not by itself prove that
one specific health window caused the prior failures. No Ready claim is made here.

Local verification: Python profile/caller/recovery tests (8), nine RV64 Vitest
files (39 tests), TypeScript typecheck and `node --check measure.mjs` passed.
Rust and browser/pod gates remain for the lead.
