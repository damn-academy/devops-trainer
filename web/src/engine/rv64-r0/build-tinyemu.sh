#!/usr/bin/env bash
# Build TinyEMU (riscv64, wasm) with the current Emscripten for the R0 measurement.
# Input:  web/public/rv64-r0/src/tinyemu-2019-12-21 (unpacked by fetch.mjs)
# Output: web/public/rv64-r0/tinyemu/riscvemu64-r0[-slice].{js,wasm}
#
# Two small additions to the upstream source, applied to a copy in build/:
#   r0_cycles()  - guest instructions retired (TinyEMU counts one cycle per instruction)
#   r0_busy_ms() - wall time spent inside the interpreter loop
# They let the page compute MIPS without touching the guest.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../../public/rv64-r0" && pwd)"
SRC="$ROOT/src/tinyemu-2019-12-21"
BUILD="$ROOT/build/tinyemu"
OUT="$ROOT/tinyemu"
OPT="${OPT:--O3}"
# SLICE: guest instructions per run of the main-thread loop before it yields with
# setTimeout(0). Upstream: 3,000,000. A larger slice shows the cost of yielding.
SLICE="${SLICE:-}"
NAME="riscvemu64-r0${SLICE:+-slice}"

rm -rf "$BUILD" && mkdir -p "$BUILD" "$OUT"
cp -R "$SRC"/. "$BUILD"/
cd "$BUILD"
if [ -n "$SLICE" ]; then
  sed -i.bak "s/^#define MAX_EXEC_TOTAL_CYCLE 3000000$/#define MAX_EXEC_TOTAL_CYCLE $SLICE/" jsemu.c
  grep -q "MAX_EXEC_TOTAL_CYCLE $SLICE" jsemu.c || { echo "patch failed: slice"; exit 1; }
fi

cat >> riscv_machine.c <<'EOF'

/* R0 measurement hooks (devops-trainer) */
#include <emscripten.h>
static double r0_busy;
static RISCVMachine *r0_vm;
static void r0_interp(VirtMachine *s1, int max_exec_cycle)
{
    double t0 = emscripten_get_now();
    r0_vm = (RISCVMachine *)s1;
    riscv_machine_interp(s1, max_exec_cycle);
    r0_busy += emscripten_get_now() - t0;
}
EMSCRIPTEN_KEEPALIVE double r0_cycles(void)
{
    return r0_vm ? (double)riscv_cpu_get_cycles(r0_vm->cpu_state) : 0;
}
EMSCRIPTEN_KEEPALIVE double r0_busy_ms(void) { return r0_busy; }
uint64_t r0_time_now(void) { return r0_vm ? rtc_get_time(r0_vm) : 0; }
EOF
# route the machine class through the timing wrapper
sed -i.bak 's/    riscv_machine_interp,$/    r0_interp,/' riscv_machine.c
grep -q '    r0_interp,' riscv_machine.c || { echo "patch failed: machine class"; exit 1; }
# The 'time' CSR (rdtime): TinyEMU 2019 leaves it unimplemented, so user code that
# reads it directly gets SIGILL. Go's runtime does (cputicks), so every Go binary
# dies at start. Real hardware implements it; we return the machine timer (mtime).
python3 -I - riscv_cpu.c <<'PY'
import sys
p = sys.argv[1]; s = open(p).read()
anchor = "    case 0xc00: /* ucycle */\n"
add = '''    case 0xc01: /* time, added for the R0 measurement */
        {
            extern uint64_t r0_time_now(void);
            /* Only mcounteren gates it: the Linux 4.15 guest never sets
               scounteren, while bbl opens every counter in mcounteren. */
            if (s->priv < PRV_M && ((s->mcounteren >> 1) & 1) == 0)
                goto invalid_csr;
            val = (int64_t)r0_time_now();
        }
        break;
'''
assert s.count(anchor) == 1
s = s.replace(anchor, add + anchor)
mask = "#define COUNTEREN_MASK ((1 << 0) | (1 << 2))"
assert mask in s
s = s.replace(mask, "#define COUNTEREN_MASK ((1 << 0) | (1 << 1) | (1 << 2))")
open(p, 'w').write(s)
PY
# forward declaration so the class table can reference r0_interp
perl -0pi -e 's/^(static void riscv_machine_interp\(VirtMachine \*s1, int max_exec_cycle\)\n)/static void r0_interp(VirtMachine *s1, int max_exec_cycle);\n$1/m' riscv_machine.c

CFLAGS="$OPT -Wall -Wno-unused-but-set-variable -D_FILE_OFFSET_BITS=64 -D_LARGEFILE_SOURCE -fno-strict-aliasing -DCONFIG_FS_NET -DEMSCRIPTEN"
OBJS=""
for f in jsemu softfp virtio fs fs_net fs_wget fs_utils simplefb pci json block_net iomem cutils aes sha256 riscv_machine machine; do
  emcc $CFLAGS -c -o $f.o $f.c
  OBJS="$OBJS $f.o"
done
emcc $CFLAGS -DMAX_XLEN=64 -DCONFIG_RISCV_MAX_XLEN=64 -c -o riscv_cpu64.o riscv_cpu.c

emcc $OPT $OBJS riscv_cpu64.o -o "$OUT/$NAME.js" \
  -s MODULARIZE=1 -s EXPORT_NAME=createTinyEmu -s ENVIRONMENT=web \
  -s NO_EXIT_RUNTIME=1 -s FILESYSTEM=0 \
  -s INITIAL_MEMORY=64MB -s ALLOW_MEMORY_GROWTH=1 -s MAXIMUM_MEMORY=4GB \
  -s ALLOW_TABLE_GROWTH=1 ${LDEXTRA:-} \
  -s "EXPORTED_FUNCTIONS=['_console_queue_char','_vm_start','_fs_import_file','_net_write_packet','_net_set_carrier','_r0_cycles','_r0_busy_ms','_malloc','_free']" \
  -s "EXPORTED_RUNTIME_METHODS=['ccall','cwrap','HEAPU8']" \
  --js-library "$HERE/tinyemu-lib.js"
ls -la "$OUT"
