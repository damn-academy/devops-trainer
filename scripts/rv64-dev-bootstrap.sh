#!/usr/bin/env bash
# Run ONLY inside rv64-dev, through rv64-dev.sh bootstrap.
set -euo pipefail
test "$RUSTUP_HOME" = /work/rustup
test "$CARGO_HOME" = /work/cargo
mkdir -p /work/tmp /work/apt/cache/archives/partial /work/apt/lists/partial /work/tools
export TMPDIR=/work/tmp
apt_opts=(-o Dir::Cache=/work/apt/cache -o Dir::State::lists=/work/apt/lists)
apt-get "${apt_opts[@]}" update
apt-get "${apt_opts[@]}" install -y --no-install-recommends gcc-riscv64-unknown-elf binutils-riscv64-unknown-elf device-tree-compiler autoconf automake libtool libboost-regex-dev libboost-system-dev
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.100 --locked --root /work/tools
ln -sf /work/tools/bin/wasm-bindgen /usr/local/bin/wasm-bindgen
rustc --version
wasm-bindgen --version
if [ ! -x /work/tools/binaryen-version_123/bin/wasm-opt ]; then
  curl -fL --retry 3 https://github.com/WebAssembly/binaryen/releases/download/version_123/binaryen-version_123-x86_64-linux.tar.gz -o /work/tools/binaryen.tar.gz
  echo 'e959f2170af4c20c552e9de3a0253704d6a9d2766e8fdb88e4d6ac4bae9388fe  /work/tools/binaryen.tar.gz' | sha256sum -c -
  tar -C /work/tools -xzf /work/tools/binaryen.tar.gz
fi
ln -sf /work/tools/binaryen-version_123/bin/wasm-opt /usr/local/bin/wasm-opt
/work/tools/binaryen-version_123/bin/wasm-opt --version
riscv64-unknown-elf-gcc --version
df -h / /work
