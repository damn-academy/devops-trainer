#!/usr/bin/env bash
# Build the ready-made dtlab files that #/local-lab links to, with checksums.
# Usage: lab/release.sh <version> [out-dir]. Optional: nfpm, makensis (NSIS), Apple packaging tools.
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
export DTLAB_VERSION="$version"
if command -v nfpm >/dev/null 2>&1; then
  for arch in amd64 arm64; do
    export DTLAB_ARCH="$arch" DTLAB_BINARY="$out/dtlab-linux-$arch"
    for format in deb rpm; do
      # nfpm expands environment variables in fields, not in contents.src.
      config=$(mktemp)
      sed "s#\${DTLAB_BINARY}#$DTLAB_BINARY#" packaging/nfpm.yaml > "$config"
      nfpm package --config "$config" --packager "$format" --target "$out/dtlab-linux-$arch.$format"
      rm -f "$config"
    done
  done
else
  echo 'Skipping .deb/.rpm: nfpm is not installed.' >&2
fi
if command -v makensis >/dev/null 2>&1; then
  makensis -V2 -DVERSION="$version" -DBINARY="$out/dtlab-windows-amd64.exe" -DOUT="$out/dtlab-windows-amd64-setup.exe" packaging/dtlab.nsi
else
  echo 'Skipping the Windows installer: makensis (NSIS) is not installed.' >&2
fi
if [[ $(uname -s) == Darwin ]]; then
  stage=$(mktemp -d)
  trap 'rm -rf "$stage"' EXIT
  for arch in amd64 arm64; do
    mkdir -p "$stage/root/usr/local/bin"
    install -m 0755 "$out/dtlab-darwin-$arch" "$stage/root/usr/local/bin/dtlab"
    pkgbuild --root "$stage/root" --identifier academy.damn.dtlab --version "$version" --install-location / "$stage/component.pkg"
    productbuild --package "$stage/component.pkg" "$out/dtlab-darwin-$arch.pkg"
  done
else
  echo 'Skipping .pkg: requires macOS with pkgbuild/productbuild.' >&2
fi
install -m 0755 install.sh "$out/install.sh"
python3 - "$out" <<'CHECKSUMS'
import hashlib, pathlib, sys
out = pathlib.Path(sys.argv[1])
with (out / 'SHA256SUMS').open('w') as sums:
    for file in sorted(out.iterdir()):
        if file.is_file() and (file.name.startswith('dtlab-') or file.name == 'install.sh'):
            with file.open('rb') as stream:
                digest = hashlib.file_digest(stream, 'sha256').hexdigest()
            sums.write(f'{digest}  {file.name}\n')
CHECKSUMS
cat "$out/SHA256SUMS"
