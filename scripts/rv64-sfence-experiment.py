#!/usr/bin/env python3
"""Ablation of the retained R6 wasm, NOT a Rust build or deployment artifact.
Usage: python3 scripts/rv64-sfence-experiment.py /tmp/rv64-tlb-only.wasm
Requires WABT wasm2wat/wat2wasm. Never overwrites the staged production wasm.
"""
import hashlib
from pathlib import Path
import subprocess
import sys
import tempfile

source = Path(__file__).resolve().parents[1] / 'web/public/rv64/rv64_core_bg.wasm'
target = Path(sys.argv[1]).resolve()
assert target != source.resolve(), 'Do not overwrite staged wasm'
assert hashlib.sha256(source.read_bytes()).hexdigest() == '3bbf6aadb130186d4772b6f9258e2bae3db156d9b001f6b8707dc6759faa81d8', 'Experiment requires exact R6 wasm'
with tempfile.TemporaryDirectory() as temp:
    wat = Path(temp) / 'core.wat'
    subprocess.run(['wasm2wat', str(source), '-o', str(wat)], check=True)
    text = wat.read_text()
    start = text.index('  (func $engine_smp_fence ')
    end = text.index('\n  (func ', start + 1)
    function = text[start:end]
    # Keep the original borrow checks, TLB memset, epoch/flush counters and
    # epilogue. Remove only the inlined jit_clear body (entries/chain/ready/code).
    first = function.index('          local.get 0\n          i32.const 0\n          i32.store offset=32512')
    last = function.index('          local.get 0\n          i32.const 0\n          i32.store\n', first)
    function = function[:first] + function[last:]
    wat.write_text(text[:start] + function + text[end:])
    subprocess.run(['wat2wasm', str(wat), '-o', str(target)], check=True)
print(hashlib.sha256(target.read_bytes()).hexdigest(), target)
