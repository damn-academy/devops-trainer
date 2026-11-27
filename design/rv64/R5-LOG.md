# R5: decompression cost removed, API still not listening

The lead ran [R5-PLAN.md](R5-PLAN.md): two harts, 1024 MiB RAM,
uncompressed SquashFS, no-reboot, 3000 host seconds. This records the retained
run, not a new measurement. The full result has `pass=false`.

## Evidence and inputs

All evidence is under `web/public/rv64/results/`:

- `R5-smp-2h-uncompressed-1024-3000s.json` (full result), corresponding
  `-run.log` and `-console.txt`.
- `R5-smp-2h-profile.json`, `R5-no-reboot.json`,
  `R5-uncompressed-superblock.txt`.

Media and manifests are under `web/public/rv64/`:

| Medium | Bytes | SHA-256 from manifest |
| --- | ---: | --- |
| `r5-uncompressed-no-reboot.img` | 624951296 | `6d9420896541e27173d18465a542441ccac6145fbbce3f726e514c3391d2bc82` |
| `r5-zstd-no-reboot.img` | 313524224 | `72834804819622c99fb289f951fc1d3b32c97b26e22c3cd499f4fc8329179077` |

The result records the same wasm/JIT source hashes as R4:
`3bbf6aadb130186d4772b6f9258e2bae3db156d9b001f6b8707dc6759faa81d8` /
`f50b9be8e8f9b72289bd6672ab72fc240143fdfa1c034ca3d03a2a07778e04c9`.
Profiler interval is 100003 instruction attempts, starting at `RV64_READYZ_BEGIN`.
The zstd medium exists; no R5 zstd control run is claimed here.

## Observations

- One `Linux version` header, with no-reboot retained: this failure is not a
  repeated-kernel-boot loop.
- `RV64_READYZ_BEGIN`: **333.39 guest seconds**, versus **686.57 s** in R4
  with zstd rootfs: **2.06x**, or **51.4% shorter** to the start of the readyz
  probe. This is not time to successful readiness.
- `RV64_READYZ_STATUS=1`, followed by uptime **2890.31 s** and
  `RV64_READYZ_END`. All observed readyz/kubectl failures report
  `dial tcp 127.0.0.1:6443: connect: connection refused` (or the equivalent
  kubectl refused-connection summary). `RV64_NODE_STATUS` is empty; no Ready
  or completed pod acceptance.
- The observer requests a sample every 60 guest seconds, but scheduling delays
  are substantial: **19 snapshots**, uptime **343.31–2926.45 s**, not a precise
  60-second series. The reported summary “~938–958 MB available of 994 MB” is
  approximate: the retained RV64_MEM series actually spans
  **923504–953736 kB** (about **924–954 MB decimal**), ending at **937852 kB**.
  The earlier boot snapshot is 958540 kB; MemTotal is 993800 kB.
- Every observed `pgscan*` / `pgsteal*` counter is zero;
  `workingset_refault_file=0` throughout. `pgmajfault` rises from **43 to 213**
  (delta **170**). Memory is plentiful; there is no observed reclaim/refault
  pressure explaining the failure.
- After-readyz profiles: hart 0 **79411** samples (**11658** unresolved),
  hart 1 **84897** (**16465** unresolved), dropped=0. ZSTD disappears from
  the retained profile. `memcpy`, `rcu_sched_clock_irq`, `__schedule`,
  `do_raw_spin_lock`, and load-average updates are spread across address spaces;
  no single hotspot explains the failure. These are instruction-attempt
  samples, not CPU wall-time percentages; SATP IDs alone do not identify services.

## Conclusions and open question

The zstd rootfs cost approximately **2x time to readyz-probe start** in the
R4/R5 comparison. Removing compression improves startup, but does not restore
API readiness. This is an observed comparison, not a replicated performance
estimate or a successful-ready measurement.

The R4 page-cache-pressure/refault hypothesis is refuted as the explanation
for the continuing no-Ready outcome: R5 has ample memory, no reclaim and no
file refaults. R4 did not record comparable counters, so this does not establish
whether historical R4 decompression was cold reads or refaults.

The new actionable finding is **apiserver is not listening at 127.0.0.1:6443
when contacted on two harts**. The console cannot distinguish never started,
crashed, restarting, or running without binding. It also cannot exclude a
listener at another address or between attempts. [R6-PLAN.md](R6-PLAN.md)
adds process/socket/log/supervisor evidence and one timed Go stack dump to
answer this question before changing emulator behavior or extending timeouts.
