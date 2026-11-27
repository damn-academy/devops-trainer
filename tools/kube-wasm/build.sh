#!/usr/bin/env bash
# Builds kube.wasm: kube-apiserver, kube-controller-manager, kube-scheduler,
# an in-memory etcd and kubectl from Kubernetes $K8S_VERSION for GOOS=js.
#
# Usage (from a checkout of this repository, on a Linux build host):
#   tools/kube-wasm/build.sh            # wasm build into $WORK/out
#   tools/kube-wasm/build.sh native     # native test driver into $WORK/out
#
# Environment:
#   WORK        build root; sources, caches and output live here (/work/kube-wasm)
#   GO          go binary (go from PATH)
#   NODE        node binary used to measure brotli size (node from PATH)
#   WASM_OPT=1  also run wasm-opt -Oz if it is installed
#   BROTLI=0    skip the brotli measurement (quality 11 takes ~8 min)
#   GOTAGS      build tags (default kubewasm_lite: trimmed controller-manager,
#               see patches/0003; set GOTAGS= for every upstream controller)
set -euo pipefail

K8S_VERSION=${K8S_VERSION:-v1.37.2}
HERE=$(cd "$(dirname "$0")" && pwd)
WORK=${WORK:-/work/kube-wasm}
GO=${GO:-go}
NODE=${NODE:-node}
SRC=$WORK/kubernetes
OUT=$WORK/out
MODE=${1:-wasm}
GOTAGS=${GOTAGS-kubewasm_lite}

mkdir -p "$WORK/gopath" "$WORK/gocache" "$WORK/tmp" "$OUT"
export GOPATH=$WORK/gopath GOCACHE=$WORK/gocache GOTMPDIR=$WORK/tmp TMPDIR=$WORK/tmp
export GOFLAGS=-mod=vendor GOTOOLCHAIN=local
export GOMAXPROCS=${GOMAXPROCS:-3}
# The final link of a binary this size needs ~3-4 GiB; keep the GC tight.
export GOGC=${GOGC:-50} GOMEMLIMIT=${GOMEMLIMIT:-4000MiB}

# Build inside the Kubernetes tree: it already vendors every dependency and
# wires the k8s.io/* staging modules through go.work, so no module
# resolution or download happens, and the build cache is shared with the
# upstream packages.
if [ ! -d "$SRC/.git" ]; then
	git clone --quiet --depth 1 --branch "$K8S_VERSION" https://github.com/kubernetes/kubernetes "$SRC"
fi
cd "$SRC"
for p in "$HERE"/patches/*.patch; do
	if git apply --reverse --check "$p" 2>/dev/null; then
		continue # already applied
	fi
	git apply "$p"
done
mkdir -p cmd/kube-wasm
cp -R "$HERE"/src/. cmd/kube-wasm/

if [ "$MODE" = native ]; then
	"$GO" build -p 2 -trimpath -o "$OUT/kube-wasm-native" ./cmd/kube-wasm
	ls -l "$OUT/kube-wasm-native"
	exit 0
fi

# Re-enable the linker's method dead-code elimination (see overlay.py).
OVERLAY=$(python3 "$HERE/overlay.py" "$("$GO" env GOROOT)" "$SRC" "$WORK/overlay")

start=$(date +%s)
GOOS=js GOARCH=wasm "$GO" build -p 2 -trimpath -overlay="$OVERLAY" -ldflags='-s -w' \
	${GOTAGS:+-tags "$GOTAGS"} -o "$OUT/kube.wasm" ./cmd/kube-wasm
echo "go build: $(($(date +%s) - start))s"
cp "$("$GO" env GOROOT)/lib/wasm/wasm_exec.js" "$OUT/wasm_exec.js"

if [ "${WASM_OPT:-0}" = 1 ] && command -v wasm-opt >/dev/null; then
	start=$(date +%s)
	wasm-opt -Oz --enable-bulk-memory --enable-sign-ext --enable-nontrapping-float-to-int \
		"$OUT/kube.wasm" -o "$OUT/kube.opt.wasm"
	echo "wasm-opt: $(($(date +%s) - start))s"
fi

for f in "$OUT"/kube*.wasm; do
	gzip -9 -k -f "$f"
	[ "${BROTLI:-1}" = 1 ] || { printf '%s raw=%d gzip=%d\n' "$(basename "$f")" "$(stat -c %s "$f")" "$(stat -c %s "$f.gz")"; continue; }
	"$NODE" -e '
const fs = require("fs"), zlib = require("zlib");
const f = process.argv[1];
const out = zlib.brotliCompressSync(fs.readFileSync(f), {params: {
  [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
  [zlib.constants.BROTLI_PARAM_LGWIN]: 24,
  [zlib.constants.BROTLI_PARAM_SIZE_HINT]: fs.statSync(f).size}});
fs.writeFileSync(f + ".br", out);' "$f"
	printf '%s raw=%d gzip=%d brotli=%d\n' "$(basename "$f")" \
		"$(stat -c %s "$f")" "$(stat -c %s "$f.gz")" "$(stat -c %s "$f.br")"
done
(cd "$OUT" && sha256sum kube*.wasm kube*.wasm.gz wasm_exec.js > SHA256SUMS && cat SHA256SUMS)
