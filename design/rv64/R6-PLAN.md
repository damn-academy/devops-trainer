# R6: why does the two-hart API never listen?

Preparation for the lead; retain R5's uncompressed rootfs, no-reboot, two
harts, 1024 MiB, recovery-v3 and offline images. Build medium only under
`/root/r6`, never the full `/work` PVC. Preserve `/root/r5/root` by copying
it (no hard links). No emulator changes are part of R6.

## Verified log and supervision layout

Read-only inspection of the actual pod `/root/r5/root` confirmed the retained
probe, recovery wrapper, `kube-apiserver -> kuberoot-control.real` symlink,
and kinit binary strings `/var/log/kuberoot`, `/run/kuberoot/kinit.sock`,
`/v1/services`. There is BusyBox but no curl, Go or cross-C compiler in the
pod PATH. A tiny read-only Go HTTP client is cross-compiled on the Mac and
uploaded; it has no external modules. The medium itself is built in the pod.

Local source inspection: `~/projects/kuberoot-pr59`, commit
`4253fad65d9d861bc247d4a1d1af25c947a0ae11`:

- `cmd/kinit/services.go`: `logPath(name)` is
  `/var/log/kuberoot/<service>.log`; service stdout/stderr append to that file.
  Verbose mode additionally mirrors output to the console. These service logs
  are **not console-only**. kinit's own normal boot messages go to the console.
- `cmd/kinit/combined.go`, `build/kubernetes-slim/main.go.in`: slim embeds kine,
  apiserver, controller-manager, scheduler and kubelet in **one Go process**,
  supervised as `kuberoot-control`. Its shared log is
  `/var/log/kuberoot/kuberoot-control.log`; containerd has `containerd.log`.
  Controller-manager/scheduler/kubelet wait for internal apiserver readiness.
  Missing separate processes/logs is therefore expected, not a crash diagnosis.
- `cmd/kinit/control.go`, `pkg/supervisor/types.go`: read-only
  `GET /v1/services` over `/run/kuberoot/kinit.sock` exposes state, pid,
  restarts, lastExit and logFile. Counts are per supervisor entry (the entire
  combined group), and reset on service-generation replacement, not per embedded
  component. Failed status reads are reported as unavailable, never as zero.

Sources explain the binary layout; no claim is made that the local checkout
commit is the exact image build revision. Runtime fd/2 targets, API `logFile`
and explicit missing-file markers allow the lead to detect discrepancies.

## Observer and induced stack dump

`rv64-diag-probe.py` adds a sourced observer after `RV64_CONFIG_CREATED`,
without regenerating the retained probe. Every output line from the observer
(including errors and log content) starts `RV64_DIAG`. Each snapshot records
actual uptime, argv[0], PID, state, RSS, threads, process start ticks and stderr
fd target; TCP/TCP6 LISTEN addresses in raw hex with **decimal ports** and
socket inode; last 40 lines of each control-plane service log; native status
JSON including restart counts. Combined components share one log. Snapshots
start immediately, then sleep 60 guest seconds after collection; scheduling,
API/status timeouts and serial output can delay them. Preserve RV64_MEM too.

After the original `RV64_READYZ_BEGIN`, an independent bounded readyz request
(5 s request deadline, 15 s BusyBox timeout) runs with each snapshot. Original
readyz/acceptance commands remain intact. On at least 600 guest seconds of
observed consecutive failure/timeouts, send SIGQUIT **once successfully** to
standalone kube-apiserver, or to the combined runtime if components.json includes
kube-apiserver. If absent, record the skip and retry selection at later snapshots.
A success resets the failure interval; a blocked request cannot indefinitely
block process/log diagnostics. Sampled failures cannot prove there was no
unobserved transient success between samples.

SIGQUIT normally prints Go goroutine stacks **and terminates the runtime**.
The combined case affects all embedded components. The marker records PID,
uptime and `induced_exit_expected=1`; interpret subsequent restarts separately.
After 10 guest seconds tail **400 lines of that process's service log**; regular
40-line tails continue. The full dump can exceed 400 lines; retain the console
and retrieve the complete service log from the guest if needed. No repeated
signals even if the first dump is incomplete. The no-reboot patch still prevents
kernel reboot; it does not suppress service restarts. Extra diagnostic clients
and serial output make this a diagnosis run, not a clean performance benchmark.

## Build (Mac, repository root)

Requires local Go, pod Python 3.11+, mtools and squashfs-tools. This refuses an
existing `/root/r6`. Check free space for a root copy plus SquashFS and image
before continuing. The R5 root is preferred; upload the R5 uncompressed medium
only if it is absent. All remote writes below stay under `/root/r6`.

```bash
cd ~/projects/devops-trainer
export KUBECONFIG="$HOME/workshop.txt"
r6_tools=$(mktemp -d /tmp/rv64-r6.XXXXXX)
CGO_ENABLED=0 GOOS=linux GOARCH=riscv64 GOCACHE="$r6_tools/cache" \
  go build -trimpath -ldflags='-s -w' -o "$r6_tools/rv64-diag-status" scripts/rv64-diag-status.go
file "$r6_tools/rv64-diag-status"
kubectl exec --context admin@workshop -n tenant-kuberoot rv64-dev -- bash -ec '
  test ! -e /root/r6
  command -v python3; command -v mcopy; command -v mksquashfs; command -v unsquashfs
  df -h /root
  mkdir -p /root/r6/tools /root/r6/tmp
'
tar -cf - -C scripts rv64-diag-probe.py rv64-diag-probe.sh rv64-uncompressed-media.py |
  kubectl exec -i --context admin@workshop -n tenant-kuberoot rv64-dev -- tar -xf - -C /root/r6/tools
kubectl exec -i --context admin@workshop -n tenant-kuberoot rv64-dev -- \
  sh -c 'cat > /root/r6/tools/rv64-diag-status' < "$r6_tools/rv64-diag-status"
# Reuse R5's medium as GPT template when available, otherwise upload it.
if ! kubectl exec --context admin@workshop -n tenant-kuberoot rv64-dev -- \
  test -f /root/r5/r5-uncompressed-no-reboot.img; then
  shasum -a 256 web/public/rv64/r5-uncompressed-no-reboot.img
  # Must match 6d9420896541e27173d18465a542441ccac6145fbbce3f726e514c3391d2bc82.
  kubectl exec -i --context admin@workshop -n tenant-kuberoot rv64-dev -- \
    sh -c 'cat > /root/r6/source.img' < web/public/rv64/r5-uncompressed-no-reboot.img
fi
kubectl exec -i --context admin@workshop -n tenant-kuberoot rv64-dev -- bash -se <<'POD'
set -eu
export CARGO_HOME=/work/cargo TMPDIR=/root/r6/tmp
cd /root/r6
source=/root/r5/r5-uncompressed-no-reboot.img
[ -f "$source" ] || source=/root/r6/source.img
printf '%s  %s\n' 6d9420896541e27173d18465a542441ccac6145fbbce3f726e514c3391d2bc82 "$source" | sha256sum -c -
if [ -d /root/r5/root ]; then
  cp -a /root/r5/root /root/r6/root
else
  mcopy -i "$source@@1048576" ::/kuberoot/rootfs.squashfs source.squashfs
  unsquashfs -d root source.squashfs
fi
# Validates patched kinit hash against retained no-reboot evidence before writing.
RV64_PROBE_ROOT=/root/r6/root RV64_DIAG_STATUS=/root/r6/tools/rv64-diag-status \
  python3 tools/rv64-diag-probe.py
/bin/sh -n root/usr/share/kuberoot/rv64-probe.sh
/bin/sh -n root/usr/share/kuberoot/rv64-diag-probe.sh
sha256sum root/usr/sbin/kinit.real root/usr/bin/kuberoot-control.real \
  root/usr/bin/rv64-diag-status root/usr/share/kuberoot/rv64* > inputs.sha256
RV64_MEDIA_ROOT=/root/r6 RV64_MEDIA_TEMPLATE="$source" \
RV64_MEDIA_COMPRESSED=0 RV64_MEDIA_NAME=r6-uncompressed-no-reboot \
  python3 tools/rv64-uncompressed-media.py
unsquashfs -s r6-uncompressed-no-reboot.squashfs | tee uncompressed-superblock.txt
sha256sum r6-uncompressed-no-reboot.img
POD
```

Do not rerun `rv64-kuberoot-probe.py` or rebuild kuberoot: that would overwrite
retained opt-ins or change the binaries under investigation. `CARGO_HOME` is
only the existing Python helper's pod guard, not a request to write to `/work`.

## Fetch in verified 16 MiB chunks (Mac, repository root)

Sequential transfer, five retries, per-chunk and whole-file SHA-256 checks;
no full image captured into RAM. This is the R5 transfer procedure with R6 paths.

```bash
mkdir -p web/public/rv64/results
python3 - <<'PY'
import hashlib, json, subprocess, time
from pathlib import Path
cmd = ['kubectl', 'exec', '--context', 'admin@workshop', '-n', 'tenant-kuberoot', 'rv64-dev', '--']
chunk_size = 16 * 1024 * 1024
for name in ['r6-uncompressed-no-reboot']:
    remote = '/root/r6/' + name + '.img'
    size = int(subprocess.check_output(cmd + ['stat', '-c', '%s', remote]))
    digest = subprocess.check_output(cmd + ['sha256sum', remote], text=True).split()[0]
    dest = Path('web/public/rv64') / (name + '.img')
    temp = dest.with_suffix('.img.download')
    with temp.open('wb') as out:
        for i in range((size + chunk_size - 1) // chunk_size):
            dd = f'dd if={remote} bs=16M skip={i} count=1 status=none'
            part = dest.with_suffix('.img.chunk')
            for attempt in range(5):
                try:
                    expected = subprocess.check_output(cmd + ['bash', '-o', 'pipefail', '-c', dd + ' | sha256sum'], text=True, timeout=120).split()[0]
                    with part.open('wb') as f:
                        subprocess.run(cmd + ['bash', '-ec', dd], stdout=f, check=True, timeout=120)
                    data = part.read_bytes()
                    assert len(data) == min(chunk_size, size - i * chunk_size)
                    assert hashlib.sha256(data).hexdigest() == expected
                    break
                except (subprocess.SubprocessError, AssertionError, IndexError):
                    if attempt == 4:
                        raise
                    time.sleep(2)
            out.write(data)
            print(name, i, expected, flush=True)
    with temp.open('rb') as f:
        assert temp.stat().st_size == size and hashlib.file_digest(f, 'sha256').hexdigest() == digest
    temp.replace(dest)
    part.unlink()
    dest.with_suffix('.json').write_text(json.dumps({'url': '/rv64/' + dest.name, 'bytes': size, 'version': digest}) + '\n')
    print(dest, size, digest)
PY
kubectl exec --context admin@workshop -n tenant-kuberoot rv64-dev -- \
  cat /root/r6/root/usr/share/kuberoot/rv64-no-reboot.json > web/public/rv64/results/R6-no-reboot.json
kubectl exec --context admin@workshop -n tenant-kuberoot rv64-dev -- \
  cat /root/r6/uncompressed-superblock.txt > web/public/rv64/results/R6-uncompressed-superblock.txt
kubectl exec --context admin@workshop -n tenant-kuberoot rv64-dev -- \
  cat /root/r6/inputs.sha256 > web/public/rv64/results/R6-inputs.sha256
```

Retain transfer stdout and final manifest. Verify uncompressed inode/data/
fragment/xattr flags, not just the compressor name in the superblock.

## Run and symbolize

One run at a time, no edits/HMR during measurement. From `web/`, same profiler
and harness settings as R5 (JIT threshold remains default 50):

```bash
mkdir -p public/rv64/results
RV64_RESULT_NAME=R6-smp-2h-uncompressed-1024-3000s \
RV64_HARTS=2 RV64_MEMORY_MB=1024 \
RV64_PROBE_SECONDS=3000 RV64_TIMEOUT_MS=3300000 \
RV64_GUEST_PROFILE_INTERVAL=100003 \
RV64_GUEST_PROFILE_START_AFTER=RV64_READYZ_BEGIN \
RV64_MEDIA_MANIFEST=/rv64/r6-uncompressed-no-reboot.json \
node src/engine/rv64/measure.mjs --smp-kuberoot \
  > public/rv64/results/R6-smp-2h-uncompressed-1024-3000s-run.log 2>&1
```

From repository root (use `-partial.json` if the outer timeout prevented a full
result; keep both the console and run log):

```bash
python3 scripts/rv64-guest-profile.py \
  web/public/rv64/results/R6-smp-2h-uncompressed-1024-3000s.json \
  --symbols web/public/rv64/profile-symbols/all.json.gz \
  --maps web/public/rv64/profile-symbols/maps.json \
  > web/public/rv64/results/R6-smp-2h-profile.json
```

The diagnostic helper is new and has no entries in the old symbol bundle;
record unresolved samples rather than attributing them to control. Compare
pre-SIGQUIT profiles separately from the induced-restart period.

## Interpretation

First verify one kernel boot, no-reboot marker, media hash, two harts/1024 MiB,
RV64_DIAG/RV64_MEM output, actual uptime cadence and both hart profiles. Socket
snapshots and refused requests are observations at particular times, not proof
of continuous absence. Match address and namespace as well as port 6443.

| Observation | Configuration/service explanation to check | Emulator implication to test only after that check |
| --- | --- | --- |
| Apiserver absent (neither standalone nor configured inside running control) | Supervisor Waiting/Restarting, missing component entry, invalid flags, certs, executable, failed dependency; missing standalone PID alone is normal in slim | If supervisor should spawn but makes no progress, inspect scheduling and Go timer/futex wakeups across harts; absence alone is not evidence of an ISA bug |
| Crash-looping: native restart counter increases, PID/start ticks change, lastExit/log errors | Fatal config, kine/SQLite failure, bind error, OOM, startup deadline; exclude the explicitly induced SIGQUIT restart | Reproducible unexplained panic/corruption or lost wakeups motivates atomics/LR-SC, memory ordering and TLB/fence checks, ideally against one hart/native QEMU |
| Runtime running but no listener at expected 6443 | Logs/stacks show startup phase, datastore socket/dependency, cert loading, wrong bind address/port; combined process can run while apiserver goroutine stalls | Go timer or futex behavior across harts, scheduler progress, LR-SC reservation/atomic ordering; corruption/stale mappings suggest TLB/SFENCE issues. Stack evidence must identify which hypothesis fits |
| 6443 bound but readyz times out or returns failure | Wrong bind address/namespace, TLS/auth errors, readyz dependency failures, datastore latency; collect response body and owning PID via socket inode | If accept/read/timer goroutines stall despite pending work, test wakeups, timer interrupts and inter-hart ordering; bound-but-unresponsive does not by itself prove an emulator bug |

Record last successful diagnostic time if logging stops; lack of output is not
proof that a service disappeared. Do not fix emulator atomics/timers/TLBs on the
basis of the R5 profile alone, or count SIGQUIT as an organic crash. If the
combined stack dump identifies a blocked apiserver goroutine, use that concrete
wait site to choose the next minimal emulator/native comparison.

## Local preparation verification

Passed: five Python test programs (15 tests total), including shell syntax,
retained probe/idempotence/layout checks, synthetic proc/socket decoding,
combined-runtime SIGQUIT selection, 600-second threshold and one-shot behavior;
nine RV64 Vitest files (39 tests); `npm run typecheck`; measure.mjs syntax;
static Linux/RISC-V cross-compilation of the status client; Bash syntax of all
command blocks; diff whitespace checks. R5 image sizes/hashes were verified
against manifests. Pod access during preparation was read-only. R6 medium
construction and the 3000-second browser measurement remain for the lead.
