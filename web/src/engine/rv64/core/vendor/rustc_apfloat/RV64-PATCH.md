# RISC-V overflow flag correction

Upstream: rustc_apfloat 0.2.3+llvm-462a31f5a5ab, crates.io archive SHA-256
`486c2179b4796f65bfe2ee33679acf0927ac83ecf583ad6c91c3b4570911b9ad`.
Original license and license details are retained in this directory.

One semantic change in `src/ieee.rs`, `overflow_result`: saturating to the
largest finite value must report OVERFLOW together with INEXACT, including
round toward zero / toward negative (the caller adjusts direction for sign).
The upstream implementation returns INEXACT alone for these cases.

This discrepancy was detected by comparing RISC-V architecture-test D
signatures against Spike, including d_fadd_b4-01 and d_fmul_b3-01.
The engine regression is `fp_saturating_overflow_sets_of_and_nx`.
No changes to the arithmetic or overflow detection threshold.
