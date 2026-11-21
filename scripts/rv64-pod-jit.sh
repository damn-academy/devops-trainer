#!/usr/bin/env bash
# Same wasm JIT in pod Node/V8, not a native Rust JIT backend.
# Prerequisites: scripts/rv64-dev.sh build-wasm, prepared kuberoot media, Node 18+ in pod.
# Usage: bash scripts/rv64-pod-jit.sh [seconds] > results.txt 2>&1
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
seconds=${1:-900}
port=${RV64_NET_PORT:-18084}
[[ $seconds =~ ^[1-9][0-9]*$ && $port =~ ^[0-9]+$ ]] || exit 2
export KUBECONFIG="${KUBECONFIG:-$HOME/workshop.txt}"
k() { local sub=$1; shift; kubectl "$sub" --context admin@workshop -n tenant-kuberoot "$@"; }
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
bundle="$ROOT/web/node_modules/.bin/rolldown"
"$bundle" "$ROOT/web/src/engine/rv64/jit.ts" --platform node --format esm --file "$stage/rv64-node-runtime.mjs" >&2
"$bundle" "$ROOT/web/src/engine/rv64/compiler.worker.ts" --platform node --format esm --file "$stage/rv64-node-compiler.mjs" >&2
"$bundle" "$ROOT/web/src/engine/rv64/native-network.ts" --platform node --format cjs --file "$stage/rv64-network.cjs" >&2
cp "$ROOT/scripts/rv64-node-jit.mjs" "$stage/"
COPYFILE_DISABLE=1 tar -C "$stage" -cf - . | k exec -i rv64-dev -- tar -C /work -xf -
# Every boot needs a fresh bridge: its UDP peer is pinned on the first packet.
k exec rv64-dev -- env RV64_PROBE_SECONDS="$seconds" RV64_NET_PORT="$port" RV64_JIT_CACHE_LIMIT="${RV64_JIT_CACHE_LIMIT:-65536}" bash -ceu '
  node /work/rv64-network.cjs >/work/out/rv64-node-network.txt 2>&1 &
  bridge=$!
  trap "kill -TERM $bridge 2>/dev/null || true" EXIT
  sleep 1
  kill -0 "$bridge"
  node --experimental-wasm-return-call /work/rv64-node-jit.mjs
'
