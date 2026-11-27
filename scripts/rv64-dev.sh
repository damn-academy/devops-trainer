#!/usr/bin/env bash
# No local Rust execution. Arguments are forwarded as argv, never evaluated.
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
export KUBECONFIG="${KUBECONFIG:-$HOME/workshop.txt}"
POD="${RV64_DEV_POD:-rv64-dev}"
k() { local sub=$1; shift; kubectl "$sub" --context admin@workshop -n tenant-kuberoot "$@"; }
sync_core() {
  COPYFILE_DISABLE=1 tar --exclude=target --exclude=.git -C "$ROOT/web/src/engine/rv64/core" -czf - . |
    k exec -i "$POD" -- bash -ceu '
      stage=$(mktemp -d /work/src/rv64-sync.XXXXXX)
      trap "rm -rf \"$stage\"" EXIT
      tar -xzf - -C "$stage"
      test -f "$stage/Cargo.toml"
      rm -rf /work/src/core
      mv "$stage" /work/src/core
    '
}
copy_wasm() {
  python3 "$ROOT/scripts/rv64-copy-wasm.py"
}

case "${1:-help}" in
  sync) sync_core ;;
  copy-wasm) copy_wasm ;;
  test-isa)
    sync_core
    k exec "$POD" -- bash -ceu 'cd /work/src/core; RV64_ISA_DIR=/work/tests/isa cargo test --release --test upstream -- --ignored --nocapture'
    ;;
  cargo)
    shift
    sync_core
    k exec -i "$POD" -- bash -ceu 'cd /work/src/core; exec cargo "$@"' -- "$@"
    ;;
  bootstrap)
    k exec -i "$POD" -- bash -se < "$ROOT/scripts/rv64-dev-bootstrap.sh"
    ;;
  wasm|build-wasm)
    sync_core
    k exec "$POD" -- bash -ceu '
      cd /work/src/core
      cargo build --lib --locked --release --target wasm32-unknown-unknown
      mkdir -p /work/out
      /work/tools/bin/wasm-bindgen /work/target/wasm32-unknown-unknown/release/rv64_core.wasm --target web --keep-debug --out-dir /work/out --out-name rv64_core
      /work/tools/binaryen-version_123/bin/wasm-opt -O3 -g /work/out/rv64_core_bg.wasm -o /work/out/rv64_core_bg.wasm
    '
    if [[ $1 == wasm ]]; then copy_wasm; fi
    ;;
  *) echo 'Usage: scripts/rv64-dev.sh sync | cargo <args...> | test-isa | bootstrap | wasm | build-wasm | copy-wasm'; exit 2 ;;
esac
