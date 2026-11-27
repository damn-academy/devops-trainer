#!/usr/bin/env bash
# Debian bookworm; only disposable sources/caches below /work are modified.
set -euo pipefail
umask 022
base=/work/r16-clients
script=$(realpath "$0")
patchfile=$(realpath "${1:?usage: rv64-r16-clients.sh /work/.../0001-standalone-client-tls-timeout.patch}")
case "$script:$patchfile" in /work/*:/work/*) ;; *) echo 'script and patch must be under /work' >&2; exit 1;; esac
for tool in python3 git curl tar flock sha256sum; do command -v "$tool" >/dev/null; done
mkdir -p "$base"
test "$(realpath "$base")" = "$base"
exec 9>"$base/build.lock"
flock -n 9 || { echo 'another client build is running' >&2; exit 1; }
# Every invocation builds fresh trees; failed attempts never publish binaries.
run=$(mktemp -d "$base/attempt.XXXXXXXX")
export TMPDIR=$run/tmp GOPATH=$run/gopath GOMODCACHE=$run/modules GOCACHE=$run/cache
export GOTOOLCHAIN=local GOENV=off GOMAXPROCS=1 GOFLAGS='-p=1' GOMEMLIMIT=1200MiB GOGC=50
export XDG_CACHE_HOME=$run/xdg GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
mkdir -p "$TMPDIR" "$run/out"
trap 'rm -rf "$run"' EXIT
python3 - "$run" <<'PY'
import hashlib, json, platform, sys, urllib.request
from pathlib import Path
root = Path(sys.argv[1])
arch = {'x86_64':'amd64', 'aarch64':'arm64'}[platform.machine()]
name = f'go1.26.8.linux-{arch}.tar.gz'
with urllib.request.urlopen('https://go.dev/dl/?mode=json&include=all') as r:
    releases = json.load(r)
f = next(f for r in releases if r['version']=='go1.26.8' for f in r['files'] if f['filename']==name)
p = root / 'go.tgz'
with urllib.request.urlopen('https://go.dev/dl/'+name) as r, p.open('wb') as out:
    while chunk := r.read(1024*1024): out.write(chunk)
with p.open('rb') as r:
    if hashlib.file_digest(r,'sha256').hexdigest()!=f['sha256']: raise SystemExit('Go SHA mismatch')
(root/'out/toolchain.json').write_text(json.dumps(f, indent=2)+'\n')
PY
tar -xzf "$run/go.tgz" -C "$run"
rm "$run/go.tgz"
export PATH=$run/go/bin:$PATH
test "$(go env GOVERSION)" = go1.26.8
export GOOS=linux GOARCH=riscv64 GORISCV64=rva20u64 CGO_ENABLED=0
mkdir "$run/overlay"
(cd "$run/overlay"; git apply --check "$patchfile"; git apply "$patchfile")
sha256sum "$patchfile" > "$run/out/patch.sha256"
git clone --depth 1 --single-branch --branch v1.37.2 https://github.com/kubernetes/kubernetes.git "$run/kubernetes"
(
 cd "$run/kubernetes"
 test "$(git describe --tags --exact-match)" = v1.37.2
 git rev-parse HEAD > "$run/out/kubernetes.commit"
 python3 "$run/overlay/build/client-go-tls-timeout.py" staging/src/k8s.io/client-go
 # Kubernetes resolves its staging modules through go.work; make sure the
 # patched staging client-go is the one the build will use.
 test "$(go list -m -f '{{.Dir}}' k8s.io/client-go)" = "$run/kubernetes/staging/src/k8s.io/client-go"
 flags='-s -w'
 for pkg in k8s.io/client-go/pkg/version k8s.io/component-base/version; do
   flags="$flags -X $pkg.gitVersion=v1.37.2 -X $pkg.gitMajor=1 -X $pkg.gitMinor=37 -X $pkg.gitTreeState=archive -X $pkg.buildDate=2026-10-27T12:01:04Z"
 done
 go build -buildvcs=false -trimpath -ldflags="$flags" -o "$run/out/kubectl" ./cmd/kubectl
)
# Reclaim the first build before the larger node compile (10 Gi PVC).
rm -rf "$run/kubernetes" "$GOCACHE" "$TMPDIR"
mkdir -p "$GOCACHE" "$TMPDIR" "$run/kuberoot"
(
 cd "$run/kuberoot"
 git init -q
 git remote add origin https://github.com/kuberoot-dev/kuberoot.git
 git fetch --depth 1 origin 4253fad65d9d861bc247d4a1d1af25c947a0ae11
 git checkout --detach FETCH_HEAD
 test "$(git rev-parse HEAD)" = 4253fad65d9d861bc247d4a1d1af25c947a0ae11
 git rev-parse HEAD > "$run/out/kuberoot.commit"
 test "$(go list -m -f '{{.Version}}' k8s.io/client-go)" = v0.37.2
 go mod download -json k8s.io/client-go > "$run/client-go.json"
 python3 - "$run" <<'PY'
import json, shutil, sys
from pathlib import Path
r=Path(sys.argv[1]); m=json.loads((r/'client-go.json').read_text())
if m.get('Sum')!='h1:sgFtyRZukGkOrsu+QgS7LYnbFFJ5ut3MchdBNduD//E=': raise SystemExit('client-go checksum mismatch')
shutil.copytree(m['Dir'], r/'client-go')
for p in (r/'client-go').rglob('*'):
    if p.is_file(): p.chmod(0o644)
    elif p.is_dir(): p.chmod(0o755)
PY
 python3 "$run/overlay/build/client-go-tls-timeout.py" "$run/client-go"
 go mod edit -replace="k8s.io/client-go=$run/client-go"
 go build -mod=readonly -buildvcs=false -trimpath -ldflags='-s -w' -o "$run/out/kuberoot-node" ./cmd/kuberoot-node
)
for bin in kubectl kuberoot-node; do
 go version -m "$run/out/$bin" > "$run/out/$bin.buildinfo.txt"
 python3 - "$run/out/$bin" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]); b=p.read_bytes()
if b[:6]!=b'\x7fELF\x02\x01' or int.from_bytes(b[18:20],'little')!=243: raise SystemExit('not ELF64 RISC-V')
if b'KUBEROOT_TLS_HANDSHAKE_TIMEOUT' not in b: raise SystemExit('missing transport patch')
PY
done
(cd "$run/out"; sha256sum kubectl kuberoot-node > SHA256SUMS; sha256sum -c SHA256SUMS)
# Unique, complete result directory. Never overwrite a previous successful run.
result=$base/result-${run##*.}
mv "$run/out" "$result"
cat "$result/SHA256SUMS"
printf 'R16_CLIENT_OUTPUT=%s\n' "$result"
