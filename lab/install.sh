#!/bin/sh
# Install the latest Linux dtlab binary after checking its release checksum.
set -eu
system=false
case ${1:-} in
  '') ;;
  --system) system=true ;;
  *) echo 'usage: install.sh [--system]' >&2; exit 2 ;;
esac
[ "$(uname -s)" = Linux ] || { echo 'Use the native installer for your OS.' >&2; exit 1; }
case $(uname -m) in
  x86_64|amd64) arch=amd64 ;;
  aarch64|arm64) arch=arm64 ;;
  *) echo 'Supported architectures: amd64 and arm64.' >&2; exit 1 ;;
esac
base=https://github.com/damn-academy/devops-trainer/releases/latest/download
file=dtlab-linux-$arch
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT HUP INT TERM
fetch() {
  if command -v curl >/dev/null 2>&1; then curl -fL --retry 3 "$1" -o "$2"
  elif command -v wget >/dev/null 2>&1; then wget -O "$2" "$1"
  else echo 'Install curl or wget first.' >&2; exit 1; fi
}
fetch "$base/$file" "$tmp/$file"
fetch "$base/SHA256SUMS" "$tmp/SHA256SUMS"
expected=$(awk -v file="$file" '$2 == file {print $1}' "$tmp/SHA256SUMS")
[ "${#expected}" = 64 ] || { echo 'Missing or ambiguous checksum.' >&2; exit 1; }
if command -v sha256sum >/dev/null 2>&1; then actual=$(sha256sum "$tmp/$file")
elif command -v shasum >/dev/null 2>&1; then actual=$(shasum -a 256 "$tmp/$file")
else echo 'Install sha256sum or shasum first.' >&2; exit 1; fi
actual=${actual%% *}
[ "$actual" = "$expected" ] || { echo 'SHA256 mismatch; nothing installed.' >&2; exit 1; }
if "$system"; then
  sudo install -m 0755 "$tmp/$file" /usr/local/bin/dtlab
else
  mkdir -p "$HOME/.local/bin"
  install -m 0755 "$tmp/$file" "$HOME/.local/bin/dtlab"
  # shellcheck disable=SC2016 # Print the command for the user to run.
  echo 'Add ~/.local/bin to PATH if needed: export PATH="$HOME/.local/bin:$PATH"'
fi
printf '%s\n' 'Next: dtlab courses' '      dtlab course install academy' '      dtlab serve'
