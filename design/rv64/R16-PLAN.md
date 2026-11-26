# R16 — standalone client TLS handshake budget

Prepared candidate; no pod, cross-compilation, packaging or browser execution was
performed locally. The operator performs those steps below. R15-a's 27.6 s
containerd startup is progress, but standalone TLS failures still prevent
observation of node registration. R16 changes only the two clients and their
explicit TLS environment. It retains all other R15 timing, memory, probe,
observer, control and offline workload settings.

## Provenance and limits

Inspected the actual R15 GPT/FAT/SquashFS without executing RV64 programs:
`web/public/rv64/r15-uncompressed-no-reboot.img`, 630194176 bytes, SHA-256
`02f056c73d9cedfe714f57934d8f5a85cf2aca6c10218f84a1e4aa983369b0a0`.
Both clients have the same SHA-256 as R6:

| Client | SHA-256 | Source evidence |
| --- | --- | --- |
| kubectl | `6de88e9ab2635eb02b4a311082af884fef27da136b79d28f4288b52abe5029c7` | embedded `v1.37.2`, `2026-10-27T12:01:04Z`; path `k8s.io/kubernetes/cmd/kubectl` |
| kuberoot-node | `0a788de2b4531c90c31a324bc4f84810541faf19fc650b4436c777516a1e2b42` | module `github.com/kuberoot-dev/kuberoot (devel)`; client-go and Kubernetes modules v0.37.2 |

Full `go version -m` output (trailing whitespace removed) is in
[r16-evidence](r16-evidence/). Both are Go
1.26.8, linux/riscv64, CGO_ENABLED=0, trimpath, GORISCV64=rva20u64. Neither records
vcs.revision or linker flags. kubectl's release tag is v1.37.2; the historical
`scripts/build-kubernetes.sh` explains the version/major/minor/archive/date
stamps and `-s -w`. R16 preserves those stamps and records the fetched tag commit
separately; its version string alone does not identify the R16 patch.

**Exact kuberoot-node commit is not recoverable from this binary.** Use pinned
fallback `4253fad65d9d861bc247d4a1d1af25c947a0ae11` from
`https://github.com/kuberoot-dev/kuberoot`, the R6 source reference. Every module
name/version in the original node buildinfo matches that commit's go.mod.
This is source compatibility evidence, not proof of identical source. Historical
`scripts/build-binaries.sh` builds node with `-trimpath -ldflags='-s -w'` and no
application version stamps. Do not substitute current main, which changed the
runtime architecture. Both shallow fetches must succeed; there is no automatic
fallback to another release or toolchain.

The actual `/usr/share/kuberoot/profile.yaml` starts `/usr/bin/kuberoot-node`
for control-plane and worker roles (lines 28–30 and 198–200). Historical
`cmd/kinit/services.go` constructs `cmd.Env` from servicePath, memoryEnv and
service-specific entries, not os.Environ. R16 therefore installs a shell wrapper
at that exact path, exporting `KUBEROOT_TLS_HANDSHAKE_TIMEOUT=300s` and exec'ing
`/usr/bin/kuberoot-node.real` with unchanged arguments. Probe and observer each
export the variable directly. No service-generation or global init change is
needed; control's existing timing overlay stays untouched.

The client script applies `kuberoot-patches/0001-standalone-client-tls-timeout.patch`
to a fresh overlay directory, then runs its helper on Kubernetes staging
client-go and a private copy of node's v0.37.2 client-go, selected by go.mod
replace. Shared module-cache sources are never edited. The helper keeps default
10 s for unset/invalid values and permits 1 s through 10 min. R16 selects 300 s;
probe/observer total requests retain 600 s (outer 660 s), waits retain 1320 s.
Authentication and certificate verification remain enabled.

## Operator: pod and input transfer

Run from repository root with bash (`set -euo pipefail`). Existing PVC
`rv64-r15-work` is 10Gi with about 9 GiB free. Do not create another claim. Build
sequentially; limits are **cpu 1 / memory 2Gi**. Client compiler uses GOMAXPROCS=1,
GOFLAGS=-p=1, GOMEMLIMIT=1200MiB, GOGC=50. These are host build settings, not guest
runtime settings. Kubernetes source/cache is removed before the node build;
all attempt sources/toolchain/cache are removed on normal completion/failure.
A killed pod can leave an `attempt.*` directory: inspect and remove only that
failed attempt before retrying if space is insufficient. Never run two builders
on the same PVC. Source image, completed client results and medium are retained.

```bash
set -euo pipefail
export KUBECONFIG="$HOME/workshop.txt"
export CTX=admin@workshop NS=tenant-kuberoot POD=rv64-r16 PVC=rv64-r15-work
kubectl --context "$CTX" -n "$NS" apply -f - <<YAML
apiVersion: v1
kind: Pod
metadata:
  name: $POD
spec:
  restartPolicy: Never
  containers:
  - name: builder
    image: python:3.11-bookworm
    command: ["sh", "-ec", "mkdir -p /work/tmp; exec sleep infinity"]
    workingDir: /work
    resources:
      requests: {cpu: "1", memory: 2Gi}
      limits: {cpu: "1", memory: 2Gi}
    env:
    - {name: HOME, value: /work}
    - {name: TMPDIR, value: /work/tmp}
    volumeMounts:
    - {name: work, mountPath: /work}
  volumes:
  - name: work
    persistentVolumeClaim: {claimName: $PVC}
YAML
kubectl --context "$CTX" -n "$NS" wait --for=condition=Ready "pod/$POD" --timeout=180s
kubectl --context "$CTX" -n "$NS" exec "$POD" -- sh -ec '
  mkdir -p /work/r16-tools /work/r16-input /work/toolchain/debs \
    /work/apt/lists/partial /work/apt/cache/archives/partial /work/apt/log
  command -v git; command -v curl; command -v flock
  cd /work/toolchain/debs
  apt-get -o Dir::State=/work/apt -o Dir::State::status=/var/lib/dpkg/status \
    -o Dir::Cache=/work/apt/cache -o Dir::Log=/work/apt/log \
    -o Dir::Etc::Parts=- -o Dir::Etc::main=- -o APT::Sandbox::User=root update
  apt-get -o Dir::State=/work/apt -o Dir::State::status=/var/lib/dpkg/status \
    -o Dir::Cache=/work/apt/cache -o Dir::Log=/work/apt/log \
    -o Dir::Etc::Parts=- -o Dir::Etc::main=- -o APT::Sandbox::User=root download mtools squashfs-tools liblzo2-2 liblz4-1 libzstd1 liblzma5 libgomp1 zlib1g
  for package in ./*.deb; do dpkg-deb -x "$package" /work/toolchain; done
  df -h /work
'
tar -cf - scripts/rv64-r16-clients.sh scripts/rv64-r16-media.py \
  scripts/rv64-uncompressed-media.py \
  design/rv64/kuberoot-patches/0001-standalone-client-tls-timeout.patch |
  kubectl --context "$CTX" -n "$NS" exec -i "$POD" -- tar -xf - -C /work/r16-tools
# Atomic transfer; safe to repeat. Existing R15 artifacts elsewhere are untouched.
kubectl --context "$CTX" -n "$NS" exec -i "$POD" -- sh -ec '
  cat > /work/r16-input/r15.img.download
  echo "02f056c73d9cedfe714f57934d8f5a85cf2aca6c10218f84a1e4aa983369b0a0  /work/r16-input/r15.img.download" | sha256sum -c -
  mv /work/r16-input/r15.img.download /work/r16-input/r15.img
' < web/public/rv64/r15-uncompressed-no-reboot.img
```

No apt install: Debian tools are extracted into /work. Go 1.26.8 is downloaded
into each private /work attempt and checked against the exact file SHA-256 in
Go's HTTPS release index; the selected metadata is saved in toolchain.json.
Missing release, failed checksum, unsupported architecture, changed patch
anchor or failed compilation stops the build. Toolchain hashes are resolved
at execution, not invented here. The script supports amd64/arm64 build pods.

## Build clients, then medium

```bash
kubectl --context "$CTX" -n "$NS" exec "$POD" -- bash \
  /work/r16-tools/scripts/rv64-r16-clients.sh \
  /work/r16-tools/design/rv64/kuberoot-patches/0001-standalone-client-tls-timeout.patch \
  > /tmp/rv64-r16-clients.log 2>&1
cat /tmp/rv64-r16-clients.log
CLIENT_OUT=$(sed -n 's/^R16_CLIENT_OUTPUT=//p' /tmp/rv64-r16-clients.log)
[[ "$CLIENT_OUT" == /work/r16-clients/result-* ]]
kubectl --context "$CTX" -n "$NS" exec "$POD" -- cat "$CLIENT_OUT/SHA256SUMS" \
  > /tmp/rv64-r16-clients.sha256
KUBECTL_SHA=$(awk '$2=="kubectl" {print $1}' /tmp/rv64-r16-clients.sha256)
NODE_SHA=$(awk '$2=="kuberoot-node" {print $1}' /tmp/rv64-r16-clients.sha256)
[[ "$KUBECTL_SHA" =~ ^[0-9a-f]{64}$ && "$NODE_SHA" =~ ^[0-9a-f]{64}$ ]]
kubectl --context "$CTX" -n "$NS" exec "$POD" -- sh -ec '
  export PATH=/work/toolchain/usr/bin:$PATH
  arch=$(dpkg-architecture -qDEB_HOST_MULTIARCH)
  export LD_LIBRARY_PATH=/work/toolchain/usr/lib/$arch:/work/toolchain/lib/$arch
  python3 /work/r16-tools/scripts/rv64-r16-media.py \
    --source /work/r16-input/r15.img --out /work/r16 \
    --kubectl "$1/kubectl" --kubectl-sha256 "$2" \
    --kuberoot-node "$1/kuberoot-node" --kuberoot-node-sha256 "$3"
' sh "$CLIENT_OUT" "$KUBECTL_SHA" "$NODE_SHA" > /tmp/rv64-r16-build.log 2>&1
cat /tmp/rv64-r16-build.log
```

Client builds are re-runnable: locked, fresh private source trees, a unique result
directory published only after both builds pass ELF/patch checks, SHA-256 printed.
A prior successful result is never overwritten or silently reused. Medium build
requires explicit binary digests, validates image and rootfs pins before edits,
checks ELF64 RISC-V and patch marker, preserves profile, syntax-checks shell, and
refuses an existing output directory. After a failed medium build, inspect
`/work/r16` and choose a new `--out` (adjust fetch paths below), or explicitly
remove only that failed output. SquashFS uses one processor and retains R15's
uncompressed metadata/data/fragments/xattrs and GPT/FAT layout.

## Fetch and verify

```bash
mkdir -p web/public/rv64/results
kubectl --context "$CTX" -n "$NS" exec "$POD" -- \
  cat /work/r16/r16-uncompressed-no-reboot.json > /tmp/r16-manifest.json
kubectl --context "$CTX" -n "$NS" exec "$POD" -- \
  cat /work/r16/r16-uncompressed-no-reboot.img \
  > web/public/rv64/r16-uncompressed-no-reboot.img.download
python3.11 - <<'PY'
import hashlib, json
from pathlib import Path
meta = json.loads(Path('/tmp/r16-manifest.json').read_text())
p = Path('web/public/rv64/r16-uncompressed-no-reboot.img.download')
assert meta['url'] == '/rv64/r16-uncompressed-no-reboot.img'
assert p.stat().st_size == meta['bytes']
with p.open('rb') as f:
    assert hashlib.file_digest(f, 'sha256').hexdigest() == meta['version']
p.replace(p.with_suffix(''))
Path('web/public/rv64/r16-uncompressed-no-reboot.json').write_text(json.dumps(meta)+'\n')
PY
kubectl --context "$CTX" -n "$NS" exec "$POD" -- cat /work/r16/build-evidence.json \
  > web/public/rv64/results/R16-build-evidence.json
# Retain source commits, patch/toolchain hashes, full new buildinfo and binaries.
kubectl --context "$CTX" -n "$NS" exec "$POD" -- tar -cf - -C "$CLIENT_OUT" . \
  > web/public/rv64/results/R16-clients.tar
cp /tmp/rv64-r16-clients.log web/public/rv64/results/R16-clients-build.log
cp /tmp/rv64-r16-build.log web/public/rv64/results/R16-build.log
python3.11 - <<'PY'
import hashlib, json, tarfile
from pathlib import Path
root=Path('web/public/rv64/results')
e=json.loads((root/'R16-build-evidence.json').read_text())
with tarfile.open(root/'R16-clients.tar') as t:
    for name, expected in e['clients'].items():
        with t.extractfile('./'+name) as f:
            assert hashlib.file_digest(f,'sha256').hexdigest()==expected
print('R16 client archive matches medium build evidence')
PY
```

Do not commit generated image/client archive. Preserve the manifest and evidence
with measurements. The real output hash is available only after operator build.

## Browser runs: operator only

From `web/`, one fresh tab per run, awake host, no snapshot restore or HMR edits:

```bash
RV64_RESULT_NAME=R16-a RV64_PROBE_SECONDS=700 RV64_TIMEOUT_MS=1000000 \
RV64_HARTS=2 RV64_MEMORY_MB=1024 VITE_RV64_SHARED_JIT=0 VITE_RV64_JIT_BUDGET_MB=384 \
RV64_MEDIA_MANIFEST=/rv64/r16-uncompressed-no-reboot.json \
node src/engine/rv64/measure.mjs --smp-kuberoot \
  > public/rv64/results/R16-a-run.log 2>&1

RV64_RESULT_NAME=R16-long RV64_PROBE_SECONDS=3000 RV64_TIMEOUT_MS=3300000 \
RV64_HARTS=2 RV64_MEMORY_MB=1024 VITE_RV64_SHARED_JIT=0 VITE_RV64_JIT_BUDGET_MB=384 \
RV64_MEDIA_MANIFEST=/rv64/r16-uncompressed-no-reboot.json \
node src/engine/rv64/measure.mjs --smp-kuberoot \
  > public/rv64/results/R16-long-run.log 2>&1
```

R16-a gate: verify R16 manifest hash and the same 2 harts / 1024 MiB / private JIT
384 settings as R15-a. Require positive kubectl success (readyz=success and/or a
successful probe node query); lack of a timeout line is not success. Record
`RV64_NODE_STATUS=True` and `RV64_NODE_REGISTERED_READY` when they appear. A 300 s
TLS budget can extend past a short capture; distinguish elapsed host and guest
time. If requests still fail, inspect their actual elapsed time and response
before committing to another long run.

R16-long acceptance: **kubectl in the probe succeeds and
RV64_NODE_REGISTERED_READY appears**. Also retain the existing workload checks:
settle/warmup, RV64_NODE_READY, RV64_RECHECK_READY, RV64_POD_START_END and
RV64_PROBE_DONE; no RV64_PROBE_FAILED, OOM or unexplained control restarts.
Capture console, result/partial JSON, logs, RSS, restart counts and lease times.
The long R15 node leases can conceal stale readiness; successful workload
execution remains the stronger convergence check. Longer TLS alone does not
prove the combined kubelet has started or that API caches have synchronized.

## Local validation

Run each `scripts/test-rv64-*.py` directly (hyphenated filenames are not unittest
discovery modules). R16 tests cover pinned real probe/observer fixtures, exact
preservation apart from exports, explicit service environment and argument
forwarding, digest/ELF/patch/layout rejection before writes, untouched files,
manifest/evidence hashing, source gating and output collision. Full Linux
packaging and actual cross-compilation remain operator checks. No web code is
changed by R16.

Preparation results: all 30 Python tests passed, including 5 R16 tests; actual
R15 extracted file pins/layout passed installation with synthetic replacement
ELFs (not compiled clients). `npm run typecheck` passed; four focused RV64
Vitest files passed (17 tests). Client script and all operator bash blocks passed
`bash -n`; `git diff --check` passed. These checks do not establish guest success.
