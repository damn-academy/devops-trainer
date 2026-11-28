# R4: no reboot, still no Ready

The lead executed the two-hart experiment in [R4-PLAN.md](R4-PLAN.md).
This log records retained local evidence, not a new run. The planned PVC build
location and port-forward delivery were changed: `/work` was 100% full, so the
lead built under `/root/r4` in `rv64-dev` and fetched the medium to the Mac.
The recovery-v3 source was the local `slim-recovery-media.img`.

## Inputs and commands

Locally verified SHA-256 and byte counts:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `web/public/rv64/slim-recovery-media.img` | 306184192 | `f092ef9d857c4e1282826b36041350de0df3b7576a876701595bfe5e750da359` |
| `web/public/rv64/r4-no-reboot-media.img` | 313524224 | `aa709f4b040d3db26933581c601ef613f759eae857bdb8f838393bb4067f4977` |

The partial result records wasm SHA-256
`3bbf6aadb130186d4772b6f9258e2bae3db156d9b001f6b8707dc6759faa81d8`
and JIT source SHA-256
`f50b9be8e8f9b72289bd6672ab72fc240143fdfa1c034ca3d03a2a07778e04c9`.
The no-reboot patch pins original kinit to
`da30c8a762498db9659ac1be9da655beea8048ee29a39fcfd0ddb534076d6632`
and replaces entry of `main.shutdown` at `0x7ad410` with `ret`, before service
shutdown. Recovery settings remain compact=5m, status=10s, sync=1m, separate proxy.

Build operations below reconstruct the R4 plan with the lead's reported `/root/r4`
location; a complete build shell transcript was not retained. Helper paths here
are relative to the uploaded scripts directory. The base was extracted with
`mcopy -i "$source@@1048576" ::/kuberoot/rootfs.squashfs /root/r4/source.squashfs`
and `unsquashfs -d /root/r4/root /root/r4/source.squashfs`, then:

```bash
CARGO_HOME=/work/cargo RV64_PROBE_ROOT=/root/r4/root RV64_RECOVERY_VARIANT=no-reboot \
  python3 rv64-emulator-recovery.py
CARGO_HOME=/work/cargo RV64_MEDIA_ROOT=/root/r4 RV64_MEDIA_TEMPLATE="$source" \
  RV64_MEDIA_COMPRESSED=1 RV64_MEDIA_NAME=r4-no-reboot python3 rv64-uncompressed-media.py
```

The lead used 16 MiB `kubectl exec ... dd bs=16M skip=i count=1` chunks,
per-chunk pod `sha256sum` comparison and retries for transfer. The run's recorded
manifest is local: `url=/rv64/r4-no-reboot-media.img`, bytes/hash as above.
Run configuration from R4-PLAN (repository `web/`):

```bash
RV64_RESULT_NAME=R4-smp-2h-no-reboot-3000s RV64_HARTS=2 \
RV64_PROBE_SECONDS=3000 RV64_TIMEOUT_MS=3300000 \
RV64_GUEST_PROFILE_INTERVAL=100003 RV64_GUEST_PROFILE_START_AFTER=RV64_READYZ_BEGIN \
RV64_MEDIA_MANIFEST=/rv64/r4-no-reboot-media.json \
node src/engine/rv64/measure.mjs --smp-kuberoot \
  > public/rv64/results/R4-smp-2h-no-reboot-3000s-run.log 2>&1
```

SMP RAM was fixed at 1024 MiB, JIT threshold 50. No memory override applied.
Symbolization (repository root):

```bash
python3 scripts/rv64-guest-profile.py \
  web/public/rv64/results/R4-smp-2h-no-reboot-3000s-partial.json \
  --symbols web/public/rv64/profile-symbols/all.json.gz \
  --maps web/public/rv64/profile-symbols/maps.json \
  > web/public/rv64/results/R4-smp-2h-profile.json
```

## Observations

Evidence is in `web/public/rv64/results/`: the partial JSON above,
`R4-smp-2h-no-reboot-3000s-run.log`, `R4-smp-2h-console.txt`, and
`R4-smp-2h-profile.json`. The run log ends with the expected outer
`page.waitForFunction: Timeout 3300000ms exceeded`; this is not a guest reboot.

- Exactly one `Linux version` header; `RV64_RECOVERY_NO_REBOOT` is present.
- `RV64_READYZ_BEGIN` is followed by guest uptime **686.57 s**. Host marker time
  in the profile is **682.221 s**; profiler dispatch is **682.225 s**.
- No `RV64_NODE_READY` or completed acceptance. The lead reported approximately
  2270 s after readyz without Ready. **Timing qualification:** the saved partial
  JSON itself ends at **2269.273 s since launch**, giving **1587.052 s after
  readyz** in that capture. Its last metrics are at 2268.518/2268.534 s for
  harts 0/1. Do not label the partial's 2269 s as an after-readyz interval or
  claim that it captures the whole 3300 s outer timeout.
- After-readyz instruction-attempt samples: hart 0 **54,074** (3,396 unresolved),
  hart 1 **55,089** (2,929 unresolved); dropped=0, interval=100003 on both.
  Summing retained top50 rows across address spaces gives:

| Hart | memcpy | ZSTD_decompressSequences | load_avg functions | rcu_sched_clock_irq |
| --- | ---: | ---: | ---: | ---: |
| 0 | 26.348% | 13.411% | 8.252% | 1.695% |
| 1 | 26.939% | 13.288% | 5.851% | 3.653% |

These top50 sums are not exhaustive function totals or wall-time CPU shares.
Work is spread across roughly seven prominent `satp` address spaces; these
are address-space IDs, not established executable names. Earlier diagnostic
stacks include `filemap_fault` / `page_cache_ra_order`.
There is only one boot meminfo snapshot: MemTotal=993800 kB,
MemAvailable=957828 kB, Cached=37404 kB (approximately 994/958/37 MB decimal).
It cannot establish memory pressure later, after readyz; no refault series exists.

## Conclusion

The reboot/health-window hypothesis is refuted as the explanation for this
no-Ready outcome: the node stays up with shutdown disabled and still does not
become Ready within the observed interval. This does not establish the cause
of every historical restart or prove every service remained healthy.

The leading **hypothesis**, not a demonstrated cause, is squashfs (zstd)
page-cache refaults: under page-cache pressure, multiple processes repeatedly
fault rootfs pages back in and pay decompression/copy costs. The profile and
fault stacks support investigating it; a single boot memory snapshot cannot
prove eviction/refault pressure. [R5-PLAN.md](R5-PLAN.md) removes rootfs compression
and adds a timestamped memory/reclaim series to test this explanation.
