#!/usr/bin/env bash
# Packs a published node (publish-node.mjs) and the RV64 core it was captured
# on into one image layer for the site: usr/share/nginx/html/rv64/node/ and
# usr/share/nginx/html/rv64/rv64_core{.js,_bg.wasm}.
#
#   tools/kube-wasm/pack-node.sh <published dir> <core dir> <out.tar>
#
# The core dir holds rv64_core.js and rv64_core_bg.wasm; its SHA-256 must be
# the coreSha256 of node.json. The tar is reproducible: same input, same bytes,
# so an unchanged node is stored once in the registry.
set -euo pipefail
[[ $# == 3 ]] || { echo "usage: $0 <published dir> <core dir> <out.tar>" >&2; exit 2; }
pub=$(cd "$1" && pwd)
core=$(cd "$2" && pwd)
out=$(cd "$(dirname "$3")" && pwd)/$(basename "$3")
here=$(cd "$(dirname "$0")" && pwd)

(cd "$pub" && sha256sum --quiet -c SHA256SUMS) || { echo "SHA256SUMS does not match $pub" >&2; exit 1; }
want=$(sed -n 's/.*"coreSha256": *"\([0-9a-f]\{64\}\)".*/\1/p' "$pub/node.json")
have=$(sha256sum "$core/rv64_core_bg.wasm" | cut -d' ' -f1)
[[ -n $want && $want == "$have" ]] || { echo "core $have is not the core of node.json ($want)" >&2; exit 1; }
[[ -f $core/rv64_core.js ]] || { echo "no rv64_core.js in $core" >&2; exit 1; }

stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
html=$stage/usr/share/nginx/html/rv64
mkdir -p "$html"
cp -R "$pub" "$html/node"
cp "$core/rv64_core.js" "$core/rv64_core_bg.wasm" "$html/"
node "$here/../../deploy/stamp.mjs" "$stage"
cd "$stage"
find . -type d -exec chmod 755 {} +
find . -type f -exec chmod 644 {} +
find . -type d -exec touch -h -d '2020-01-01T00:00:00Z' {} +
find . -mindepth 1 | LC_ALL=C sort | tar --owner=0 --group=0 --numeric-owner --no-recursion -cf "$out.part" -T -
mv "$out.part" "$out"
echo "LAYER $(sha256sum "$out" | cut -d' ' -f1) $(stat -c %s "$out" 2>/dev/null || stat -f %z "$out")"
