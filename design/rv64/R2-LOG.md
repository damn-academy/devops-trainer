# R2 work log — network prerequisite

2026-11-21, branch `feat/rv64-r0`. No commits. **R2 is not implemented or accepted.**
Rust builds and tests run only in `tenant-kuberoot/rv64-dev`, context
`admin@workshop`; Chromium runs locally, one instance at a time.

## Verified changes

- Added `rv64/network.ts`: existing course L2Switch + LabHost + DHCP + DNS +
  local HTTP mirror. There is no upstream DNS or Internet forwarding.
- Added a native loopback-UDP Ethernet bridge using exactly the same TypeScript
  services. `boot` opts in with `RV64_NET_PORT=18080`; no TAP, privileges, host
  routes or external guest access are required.
- Wired the real Chromium integration test through this network. Linux obtains
  `10.0.0.10/24`, resolves `mirror.lab`, and downloads a local HTTP object by
  hostname. Every shell stage must succeed. The block read, facts collection,
  file rollback and two consecutive snapshot restores also pass.
- Found a virtio-blk bug after DHCP: a legal 1 MiB data transfer plus header and
  status exceeded the engine's undocumented 1 MiB descriptor-chain cap. The
  device set NEEDS_RESET (`status=0x4f`) and stopped servicing disk requests.
  Removed that cap, retaining queue traversal bounds, RAM checks and the u32
  used-length bound. Added a regression for precisely this request size.
- Added a separate instrumented kuberoot media preparation script. Its wrapper
  still execs real kinit as PID 1. The background probe observes actual Node
  Ready, times three `kubectl get pods -A` calls using `/proc/uptime`, imports
  offline images, and starts a BusyBox pod with `imagePullPolicy: Never`.
  It emits completion only after successful commands. Published media is not
  changed. Remote package subscription is disabled only in the probe image.

## Measurements and checks

| Check | Result |
| --- | --- |
| Native published kuberoot → stage-two kinit | 43 s guest uptime; DHCP lease obtained |
| Native probe after virtio-blk fix → kinit | 41–42 s guest uptime; DHCP lease obtained |
| Full kuberoot → Node Ready, compressed probe | Not reached within 900 s (1 GiB guest) |
| Full kuberoot → Node Ready, uncompressed probe | Not reached within 600 s (1 GiB guest) |
| Pod start / `kubectl get pods` latency | Not measurable: no Ready marker in either probe |
| Chromium Linux shell boot (Alpine initrd, kuberoot kernel) | 8.122 s |
| Chromium interpreter CoreMark | 203.472599 iterations/s; CRC validation passes |
| Chromium interpreter busy / effective MIPS | 72.972 / 72.335 |
| CoreMark command wall time including cold start | 20.326 s |
| Rust platform regressions | 34 passed |
| riscv-tests, interpreter | 173 passed, 0 failed, 1 explicitly unsupported (Sdtrig) |
| TS network/ring/block tests | 16 passed |
| TypeScript typecheck | Passed |
| Chromium network + existing machine integration | Passed |

Evidence: `R2-network-browser.json`, `R2-interpreter-browser.json`,
`R2-interpreter-tests.txt`. These are **interpreter** results, not forced-JIT
correctness or a JIT speedup. The 266 architecture signatures reported in R1
have not been rerun in this pass.

Final wasm after the block fix: 236001 bytes,
SHA-256 `e8f338a2a7fafdc04739dac5afa6b4c29adc9f26860a294a10b901df8f87f498`.

## Full-node investigation

The compressed offline probe ran for 900 s without Node Ready. It retired
32,055,888,745 instructions (35.618 effective MIPS). Its block device completed
290/290 requests and all four virtio devices retained status `0xf`: the previous
NEEDS_RESET failure is fixed. Evidence: `R2-network-native-compressed.txt`.

A diagnostic sample showed 760812 KiB free / 935000 KiB available, so memory
pressure was not established as the cause. Hot sampled kernel addresses resolve
to `ZSTD_decompressSequences` and `memcpy`; the processes for containerd, kine,
kube-apiserver and kuberoot-node were present. A separate uncompressed SquashFS
image built from the same instrumented root reaches stage-two kinit in 19 s.
Its containerd reports successful boot at guest uptime 194 s and kube-apiserver
reports version v1.37.2 at 296 s. It also fails to reach Node Ready within its
600 s limit: 20,811,947,539 retired instructions, 34.687 effective MIPS; block
requests 422/422 completed, all devices status `0xf`. The log records TLS
handshake timeouts from kuberoot-node to the local apiserver. These milestones
do not establish readiness, and the precise remaining startup bottleneck has
not been isolated. Evidence: `R2-network-native-uncompressed.txt`.
The compressed and uncompressed diagnostic runs overlapped; they are not a
controlled throughput comparison. No JIT is involved.

`rv64-uncompressed-media.py` constructs a separate GPT/FAT medium; it does not
modify the kernel or published medium. The output is 1,160,773,632 bytes, so the
size tradeoff must be considered before adopting it for the browser.
Intermediate R2 media/chunks were removed to reclaim pod storage; the published
media, extracted probe root, offline-v2 and uncompressed media are retained.

## Offline images

`scripts/rv64-offline-images.sh` pins these linux/riscv64 platform manifests:

| Image | Platform manifest SHA-256 |
| --- | --- |
| `docker.io/coredns/coredns:1.13.1` | `7efd62b628180681ba96ed3a0c1a1311b976f8d1cc61159f4b2dc80a83583e16` |
| `docker.io/rancher/local-path-provisioner:v0.0.32` | `760110b2836a165df77b1641e554b2155f41c4df798ff667db61c877f402a326` |
| `docker.io/library/busybox:1.37.0` | `be2e8702261d743f7b1ba1b1cb4499927664d7a82baedf87564306426dda680a` |

Downloaded in the pod into docker archives (71 MiB, 57 MiB, 3.4 MiB) and included
in a separate squashfs/media image. Pause is already bundled in kuberoot.
The uncompressed run records BusyBox ImageUpdate at 588 s, but completion of
all three imports and running CoreDNS/local-path pods are **not verified**.
No tab requests are sent to those upstream registries.

## Reproduction and remaining work

Local network bundle:

```sh
web/node_modules/.bin/rolldown web/src/engine/rv64/native-network.ts \
  --platform node --format cjs --file /tmp/rv64-network.cjs
bash scripts/rv64-dev.sh cargo build --release --bins
bash scripts/rv64-dev.sh test-isa
# Transfer the bundle to /work/rv64-network.cjs in rv64-dev, then run there:
node /work/rv64-network.cjs
# In another exec in the same pod:
RV64_PROBE=1 RV64_MEMORY_MB=1024 RV64_NET_PORT=18080 \
RV64_DISK=/work/guest/kuberoot/offline-v2.img \
/work/target/release/boot /work/guest/vmlinuz.efi \
  /work/guest/kuberoot/initrd.cpio 900 \
  'earlycon=sbi console=hvc0 nokaslr kuberoot.root=PARTLABEL=KUBEROOT-MEDIA:/kuberoot/rootfs.squashfs kuberoot.verbose'
```

The browser full-media harness is `measure.mjs --kuberoot`. It requires local
`kuberoot-initrd.cpio`, a media file and `kuberoot-media.json` containing
`{ "url": "/rv64/<media filename>", "bytes": <exact size>, "version": <sha256> }`.
This full-media browser harness has been typechecked, not accepted by a boot.
The existing `--integration` and `--boot` harnesses were executed successfully.
Large workshop transfers repeatedly stalled/reset; the checked small-chunk
publisher/fetcher and HTTP wasm transfer were used instead. Initrd transfer
verified SHA-256 `be161151dcbbb61b1b121ea6df122bbda5feb6b9829eda607e40910244887265`.

Outstanding: establish full kuberoot readiness and offline pod startup, obtain
native/browser Kubernetes timings, then implement the R0 R2 compiler Worker,
batched superblocks, locals/spills, tail calls, inline TLB, invalidation,
precise exceptions, timer budgets and FP fast paths. Forced-JIT ISA/arch tests,
Linux trace-diff and the ≥3× / 250–400 busy MIPS speed gate remain unrun/unmet.

Final housekeeping: native probes ended; temporary rv64-dev-files Service and
both R2 HTTP servers were removed. Chromium closed after each measurement.
No commits were made. Full brief remains incomplete.
