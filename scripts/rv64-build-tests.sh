#!/usr/bin/env bash
# Pod-only; intentionally excludes the local machine.
set -euo pipefail
test "${CARGO_HOME:-}" = /work/cargo
src=/work/tests/riscv-tests
out=/work/tests/isa
mkdir -p "$out"
fail=0
for suite in rv64ui rv64um rv64ua rv64uf rv64ud rv64uc rv64mi rv64si rv64uzba rv64uzbb rv64uzbs; do
  for file in "$src/isa/$suite/"*.S; do
    name="$suite-p-$(basename "$file" .S)"
    if ! riscv64-unknown-elf-gcc -march=rv64g_zba_zbb_zbs -mabi=lp64d -static -mcmodel=medany -fvisibility=hidden -nostdlib -nostartfiles \
      -I "$src/env/p" -I "$src/isa/macros/scalar" -T "$src/env/p/link.ld" "$file" -o "$out/$name" > "$out/$name.build.log" 2>&1; then
      echo "BUILD FAIL $name"
      fail=$((fail+1))
    fi
  done
done
echo "Build failures: $fail"
test "$fail" -eq 0
