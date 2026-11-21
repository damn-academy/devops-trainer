#!/usr/bin/env bash
# Pod-only direct signature comparison of the pinned pre-ACT4 test corpus.
# This is NOT a RISCOF coverage/certification report.
set -euo pipefail
[[ ${CARGO_HOME:-} == /work/cargo ]]
root=/work/tests/arch-test
out=/work/tests/arch-results
mkdir -p "$out"
pass=0; fail=0; build_fail=0
for group in I M C D; do
  for source in "$root/riscv-test-suite/rv64i_m/$group/src/"*.S; do
    name="$group-$(basename "$source" .S)"
    if ! riscv64-unknown-elf-gcc -march=rv64gc_zba_zbb_zbs -mabi=lp64d -DXLEN=64 -DFLEN=64 -DTEST_CASE_1 \
      -static -mcmodel=medany -nostdlib -nostartfiles -I "$root" -I "$root/riscv-test-suite/env" \
      -T "$root/link.ld" "$source" -o "$out/$name.elf" > "$out/$name.build.log" 2>&1; then
      echo "BUILD_FAIL $name"; build_fail=$((build_fail+1)); continue
    fi
    if timeout 30 /work/tools/bin/spike --isa=rv64imafdc_zicsr_zifencei_zicntr_zba_zbb_zbs +signature="$out/$name.spike" "$out/$name.elf" > "$out/$name.spike.log" 2>&1 &&
       /work/target/release/rv64-runner --elf "$out/$name.elf" --signature "$out/$name.engine" > "$out/$name.engine.log" 2>&1 &&
       cmp -s "$out/$name.spike" "$out/$name.engine"; then
      echo "PASS $name"; pass=$((pass+1))
    else echo "FAIL $name"; fail=$((fail+1))
    fi
  done
done
echo "ARCH_SIGNATURES pass=$pass fail=$fail build_fail=$build_fail"
[[ $fail == 0 && $build_fail == 0 ]]
