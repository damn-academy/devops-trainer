# R5: uncompressed rootfs with memory/refault telemetry

Preparation only; the lead builds and measures. Keep two harts, no-reboot,
recovery-v3 settings, kernel/initrd, offline images and retained probe opt-ins.
Change rootfs compression and add the same RV64_MEM observer to both comparison
arms. Build **only under `/root/r5` in rv64-dev**, never the full `/work` PVC.
`CARGO_HOME=/work/cargo` is the helper's pod guard; these Python builds do not
write cargo files. TMPDIR is explicitly `/root/r5/tmp`.

Use the existing SquashFS builder with `RV64_MEDIA_COMPRESSED=0`: it passes
`-noI -noD -noF -noX` to mksquashfs, so inode/data/fragment/xattr blocks are
uncompressed. No ext4/erofs boot-path change is needed. The SquashFS superblock
may still name a compressor; inspect the individual uncompressed flags.

## Build (Mac, repository root)

Requires pod Python 3.11+, mtools and squashfs-tools. Check root filesystem free
space before extracting; allow room for the extracted root plus both media.
Fail on missing tools/space rather than falling back to the PVC. This sequence
refuses an existing `/root/r5` to preserve previous evidence.

```bash
cd ~/projects/devops-trainer
export KUBECONFIG="$HOME/workshop.txt"
shasum -a 256 web/public/rv64/r4-no-reboot-media.img
# Must be aa709f4b040d3db26933581c601ef613f759eae857bdb8f838393bb4067f4977
kubectl exec --context admin@workshop -n tenant-kuberoot rv64-dev -- \
  bash -ec 'test ! -e /root/r5; mkdir -p /root/r5/tools /root/r5/tmp; df -h /root /work'
tar -cf - -C scripts rv64-memory-probe.py rv64-uncompressed-media.py |
  kubectl exec -i --context admin@workshop -n tenant-kuberoot rv64-dev -- tar -xf - -C /root/r5/tools
kubectl exec -i --context admin@workshop -n tenant-kuberoot rv64-dev -- \
  sh -c 'cat > /root/r5/source.img' < web/public/rv64/r4-no-reboot-media.img
kubectl exec -i --context admin@workshop -n tenant-kuberoot rv64-dev -- bash -se <<'POD'
set -eu
export CARGO_HOME=/work/cargo TMPDIR=/root/r5/tmp
cd /root/r5
printf '%s  source.img\n' aa709f4b040d3db26933581c601ef613f759eae857bdb8f838393bb4067f4977 | sha256sum -c -
mcopy -i source.img@@1048576 ::/kuberoot/rootfs.squashfs source.squashfs
unsquashfs -d root source.squashfs
# Keep the already patched no-reboot kinit and retained probe. Do NOT reapply
# rv64-kuberoot-probe.py, which would overwrite the retained opt-ins.
cat root/usr/share/kuberoot/rv64-no-reboot.json
python3 - <<'PY'
import hashlib, json
from pathlib import Path
root = Path('/root/r5/root')
e = json.loads((root/'usr/share/kuberoot/rv64-no-reboot.json').read_text())
assert e['originalSha256'] == 'da30c8a762498db9659ac1be9da655beea8048ee29a39fcfd0ddb534076d6632'
assert hashlib.sha256((root/'usr/sbin/kinit.real').read_bytes()).hexdigest() == e['sha256']
assert 'RV64_RECOVERY_NO_REBOOT' in (root/'usr/bin/kuberoot-control').read_text()
PY
RV64_PROBE_ROOT=/root/r5/root python3 tools/rv64-memory-probe.py
/bin/sh -n root/usr/share/kuberoot/rv64-probe.sh
RV64_MEDIA_ROOT=/root/r5 RV64_MEDIA_TEMPLATE=/root/r5/source.img \
RV64_MEDIA_COMPRESSED=0 RV64_MEDIA_NAME=r5-uncompressed-no-reboot \
  python3 tools/rv64-uncompressed-media.py
unsquashfs -s r5-uncompressed-no-reboot.squashfs | tee uncompressed-superblock.txt
# Instrumented compressed control: identical root and observer, same RAM.
RV64_MEDIA_ROOT=/root/r5 RV64_MEDIA_TEMPLATE=/root/r5/source.img \
RV64_MEDIA_COMPRESSED=1 RV64_MEDIA_NAME=r5-zstd-no-reboot \
  python3 tools/rv64-uncompressed-media.py
sha256sum *.img > media.sha256
cat media.sha256
POD
```

## Fetch in verified 16 MiB chunks (Mac)

This uses sequential kubectl exec, per-chunk SHA-256 and up to five retries.
No whole-image binary stdout capture in RAM. Partial chunks stay beside the
local image until verified; final replacement and manifest happen only after
whole-file size/hash verification. No files are written on `/work`.

```bash
python3 - <<'PY'
import hashlib, json, subprocess, time
from pathlib import Path
cmd = ['kubectl', 'exec', '--context', 'admin@workshop', '-n', 'tenant-kuberoot', 'rv64-dev', '--']
chunk_size = 16 * 1024 * 1024
for name in ['r5-uncompressed-no-reboot', 'r5-zstd-no-reboot']:
    remote = '/root/r5/' + name + '.img'
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
  cat /root/r5/root/usr/share/kuberoot/rv64-no-reboot.json > web/public/rv64/results/R5-no-reboot.json
kubectl exec --context admin@workshop -n tenant-kuberoot rv64-dev -- \
  cat /root/r5/uncompressed-superblock.txt > web/public/rv64/results/R5-uncompressed-superblock.txt
```

Retain transfer stdout, image manifests, superblock flags and no-reboot evidence.
Record resulting hashes rather than predicting them. Keep the R4 image unchanged.

## Two-hart run

R4 SMP memory was fixed at **1024 MiB**. The R5 harness now accepts
`RV64_MEMORY_MB` (integer 256–2048 MiB) for SMP and records `memoryMb` in final
and partial samples; default remains **1024 MiB**. The runner previously sent
768 as an ignored query value; its SMP default is now explicitly 1024.
The worker/device RAM size and shared allocation already derive from `bytes`.
A 2048 MiB run is optional and still needs browser validation; host allocation
failure is not a guest no-Ready result. Allow RAM for shared memory, reservation
metadata, workers/JIT, HTTP disk cache and the browser itself.

Run one measurement at a time, no web edits/HMR while measuring. From `web/`:

```bash
mkdir -p public/rv64/results
RV64_RESULT_NAME=R5-smp-2h-uncompressed-1024-3000s \
RV64_HARTS=2 RV64_MEMORY_MB=1024 \
RV64_PROBE_SECONDS=3000 RV64_TIMEOUT_MS=3300000 \
RV64_GUEST_PROFILE_INTERVAL=100003 \
RV64_GUEST_PROFILE_START_AFTER=RV64_READYZ_BEGIN \
RV64_MEDIA_MANIFEST=/rv64/r5-uncompressed-no-reboot.json \
node src/engine/rv64/measure.mjs --smp-kuberoot \
  > public/rv64/results/R5-smp-2h-uncompressed-1024-3000s-run.log 2>&1
```

Repeat that command with result name `R5-smp-2h-zstd-1024-3000s` and manifest
`/rv64/r5-zstd-no-reboot.json` for the instrumented compressed control.
For a separate memory experiment, repeat with `RV64_MEMORY_MB=2048`, the zstd
manifest and result name `R5-smp-2h-zstd-2048-3000s`. Do not change RAM and
compression simultaneously in the primary comparison. Timeouts may exit
nonzero: inspect normal JSON or `-partial.json` and the console progress file.
Symbolize each result using the R4-LOG command with the R5 input/output names;
unchanged binary symbols and no-reboot provenance remain applicable.

## Observation and decision

The observer starts just after `RV64_READYZ_BEGIN` and its existing uptime line,
prints a baseline, then sleeps 60 guest seconds between snapshots independently
of the blocking readyz request. Every line begins `RV64_MEM uptime=<seconds>`.
It reports MemAvailable, Cached, Active(file), Inactive(file) in kB, plus raw
cumulative pgmajfault, workingset_refault_file, and every available pgscan* /
pgsteal* counter. Scheduling can delay samples: use actual uptime deltas, not
an assumed 60 s. Missing counters are unavailable, not zero; a missing series
invalidates the memory-pressure diagnosis, not necessarily the whole boot.
The loop ends when the VM stops and remains active after Ready for acceptance.

Verify one kernel header, no-reboot marker, correct media SHA, 1024 MiB setting,
RV64_MEM series, and both hart profiles before attributing differences.
Compare counter deltas per guest second over comparable after-readyz windows;
do not sum overlapping reclaim counter families. Preserve low MemAvailable,
file-cache sizes, refault/reclaim rates, and profile shares together.

- **Ready reached on uncompressed rootfs:** compressed rootfs was the bottleneck
  in this controlled comparison, especially if the instrumented compressed arm
  remains stuck and ZSTD work disappears. This supports the refault hypothesis;
  Ready alone does not prove its exact mechanism. Check RV64_NODE_STATUS=True,
  image import/settlement, and require RV64_PROBE_DONE for full pod acceptance.
  Repeat without profiling for performance comparisons.
- **Still stuck, refault rates drop:** look elsewhere using the new RV64_MEM
  series and per-hart profiles: scheduler/RCU, Go synchronization/GC, datastore,
  or service failure. Do not extend arbitrary timeouts again. If ZSTD disappears
  but refault rates persist, investigate page-cache/reclaim or I/O costs beyond
  decompression; uncompressed storage does not guarantee fewer refaults.
- **Both arms reach Ready or both lack telemetry:** attribution is inconclusive;
  compare the observer/control and retained artifacts before claiming a cause.

R4 has no after-readyz vmstat baseline, so claims that refaults "dropped" require
this instrumented zstd control. Record host and guest times separately; the
outer timeout is not proof that all its seconds were captured in partial JSON.

## Local preparation checks

Passed: all four `scripts/test*.py` programs (11 tests, invoked individually
because hyphenated filenames are not discovered by unittest), nine RV64 Vitest
files (39 tests), `npm run typecheck`, `node --check` on measure.mjs, and diff
whitespace checks. The observer tests cover retained probe preservation,
idempotence, unknown-layout rejection, shell syntax, and actual awk output
against synthetic proc fixtures. Pod media construction and the 1024/2048 MiB
browser runs have not been performed during this preparation.
