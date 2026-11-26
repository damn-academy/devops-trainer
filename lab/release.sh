#!/usr/bin/env bash
# Build the ready-made dtlab files that #/local-lab links to, with checksums.
# Usage: lab/release.sh <version> [out-dir]. Needs only Go; cross-compiles.
set -euo pipefail
version=${1:?usage: release.sh <version> [out-dir]}
[[ $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "version must look like 1.2.3" >&2; exit 1; }
cd "$(dirname "$0")"
out=$(mkdir -p "${2:-dist}" && cd "${2:-dist}" && pwd)
for target in windows/amd64 darwin/arm64 darwin/amd64 linux/amd64 linux/arm64; do
  os=${target%/*} arch=${target#*/}
  name=dtlab-$os-$arch; [[ $os == windows ]] && name+=.exe
  CGO_ENABLED=0 GOOS=$os GOARCH=$arch go build -trimpath -ldflags "-s -w -X main.version=$version" -o "$out/$name" ./cmd/dtlab
done
(cd "$out" && sha256sum dtlab-* > SHA256SUMS)
cat "$out/SHA256SUMS"
