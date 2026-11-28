#!/usr/bin/env bash
# Build the R0 guest disk: Alpine riscv64 minirootfs + kubectl, kube-apiserver
# and etcd from Alpine's riscv64 packages + our benchmark binaries, as ext4,
# split into 256 KiB blocks that TinyEMU's browser build loads on demand.
# Needs: e2fsprogs (mke2fs -d, debugfs), Go, zig (for CoreMark), see R0-MEASUREMENTS.md.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../../public/rv64-r0" && pwd)"
E2=/opt/homebrew/opt/e2fsprogs/sbin
B="$ROOT/build"
FS="$B/rootfs"
rm -rf "$FS" && mkdir -p "$FS"

tar xzf "$ROOT/dl/alpine-minirootfs-3.24.4-riscv64.tar.gz" -C "$FS"
python3 -I "$HERE/extract-apk.py" "$FS" "$ROOT"/dl/apk/*.apk

# benchmark binaries
mkdir -p "$B/guest-bin"
(cd "$HERE/guest" && for p in gohello goheavy r0keygen; do
  CGO_ENABLED=0 GOOS=linux GOARCH=riscv64 GORISCV64=rva20u64 \
    go build -trimpath -ldflags="-s -w" -o "$B/guest-bin/$p" ./$p; done)
if [ ! -x "$B/guest-bin/coremark" ]; then
  mkdir -p "$B/coremark" && tar xzf "$ROOT/dl/coremark-v1.01.tar.gz" -C "$B/coremark" --strip-components=1
  (cd "$B/coremark" && zig cc -target riscv64-linux-musl -mcpu=baseline_rv64 -O2 -static \
    -Ilinux64 -I. -DFLAGS_STR='"-O2 zig-cc riscv64 static"' -DPERFORMANCE_RUN=1 -DITERATIONS=0 \
    core_list_join.c core_main.c core_matrix.c core_state.c core_util.c linux64/core_portme.c \
    -o "$B/guest-bin/coremark")
fi
mkdir -p "$FS/usr/local/bin" "$FS/root"
cp "$B"/guest-bin/{gohello,goheavy,r0keygen,coremark} "$FS/usr/local/bin/"
install -m 755 "$HERE/guest/r0init" "$FS/sbin/r0init"
install -m 755 "$HERE/guest/r0bench" "$FS/usr/local/bin/r0bench"
install -m 755 "$HERE/guest/r0k8s" "$FS/usr/local/bin/r0k8s"

IMG="$B/alpine-r0.ext4"
rm -f "$IMG"
"$E2/mke2fs" -q -t ext4 -b 4096 -O ^metadata_csum,^64bit,^orphan_file,^metadata_csum_seed -E root_owner=0:0 \
  -L r0root -d "$FS" "$IMG" 400M
printf 'cd /dev\nmknod console c 5 1\nmknod null c 1 3\nmknod hvc0 c 229 0\n' > "$B/devnodes.cmd"
"$E2/debugfs" -w -f "$B/devnodes.cmd" "$IMG" </dev/null >/dev/null
"$E2/debugfs" -R "ls -l /dev" "$IMG" </dev/null 2>/dev/null | cat

OUT="$ROOT/disk/alpine-r0"
rm -rf "$OUT" && mkdir -p "$OUT"
"$B/tools/splitimg" "$IMG" "$OUT" 256
ls "$OUT" | wc -l
du -sh "$OUT"

# VM configurations for TinyEMU. bios/kernel are relative to the .cfg file; the
# drive address is used by the page as given, so it is absolute.
cat > "$ROOT/alpine-r0.cfg" <<'CFG'
/* R0 measurement guest: TinyEMU's own bbl + Linux 4.15 kernel, Alpine 3.24 root */
{
    version: 1,
    machine: "riscv64",
    memory_size: 256,
    bios: "src/jslinux-2019-12-21/bbl64.bin",
    kernel: "src/jslinux-2019-12-21/kernel-riscv64.bin",
    cmdline: "console=hvc0 root=/dev/vda rw init=/sbin/r0init quiet",
    drive0: { file: "/rv64-r0/disk/alpine-r0/blk.txt" },
}
CFG
cat > "$ROOT/busybox-r0.cfg" <<'CFG'
/* TinyEMU's own busybox image (JSLinux 2019-12-21) */
{
    version: 1,
    machine: "riscv64",
    memory_size: 128,
    bios: "src/jslinux-2019-12-21/bbl64.bin",
    kernel: "src/jslinux-2019-12-21/kernel-riscv64.bin",
    cmdline: "console=hvc0 root=/dev/vda rw",
    drive0: { file: "/rv64-r0/src/jslinux-2019-12-21/root-riscv64/blk.txt" },
}
CFG
