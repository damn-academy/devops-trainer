#!/usr/bin/env python3
"""Pod-only measurement image: extracted kuberoot root, optional compressed SquashFS.
No kernel/build changes. The source media is read only; output is a separate GPT/FAT image.
"""
import os
import struct
import subprocess
import zlib
from pathlib import Path
assert os.environ.get('CARGO_HOME') == '/work/cargo', 'run in rv64-dev only'
base = Path(os.environ.get('RV64_MEDIA_ROOT', '/work/guest/kuberoot'))
compressed = os.environ.get('RV64_MEDIA_COMPRESSED') == '1'
name = os.environ.get('RV64_MEDIA_NAME', 'probe' if compressed else 'uncompressed')
if not name or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_' for c in name):
    raise SystemExit('invalid media output name')
squash = base / (name + '.squashfs')
out = base / (name + '.img')
if not (base / 'root/usr/sbin/kinit').is_file():
    raise SystemExit('extracted root is incomplete: missing usr/sbin/kinit')
if squash.exists() or out.exists():
    raise SystemExit('output already exists; choose/remove the old experimental output explicitly')
subprocess.run(['mksquashfs', str(base/'root'), str(squash), '-noappend', *(['-comp', 'zstd'] if compressed else ['-noI', '-noD', '-noF', '-noX']), '-processors', os.environ.get('RV64_MEDIA_PROCESSORS', '2')], check=True)
sectors = ((squash.stat().st_size + 128*1024*1024 + 1048575)//1048576)*2048
with Path(os.environ.get('RV64_MEDIA_TEMPLATE', str(base/'media.img'))).open('rb') as f:
    mbr = bytearray(f.read(512)); header = bytearray(f.read(512)); entries = bytearray(f.read(128*128))
assert header[:8] == b'EFI PART'
# Reuse the published media partition's type, UUID and KUBEROOT-MEDIA name.
entry = next(entries[i:i+128] for i in range(0,len(entries),128) if entries[i+56:i+128].decode('utf-16le').rstrip('\0') == 'KUBEROOT-MEDIA')
entries = bytearray(128*128); entries[:128] = entry
struct.pack_into('<QQ', entries, 32, 2048, sectors-34)
struct.pack_into('<I', mbr, 458, min(sectors-1, 0xffffffff))
struct.pack_into('<QQQQ', header, 24, 1, sectors-1, 34, sectors-34)
struct.pack_into('<QIII', header, 72, 2, 128, 128, zlib.crc32(entries))
def crc(h):
    struct.pack_into('<I', h, 16, 0)
    struct.pack_into('<I', h, 16, zlib.crc32(h[:struct.unpack_from('<I',h,12)[0]]))
crc(header)
backup = bytearray(header)
struct.pack_into('<QQ', backup, 24, sectors-1, 1)
struct.pack_into('<Q', backup, 72, sectors-33)
crc(backup)
with out.open('wb') as f:
    f.truncate(sectors*512); f.write(mbr); f.write(header); f.write(entries)
    f.seek((sectors-33)*512); f.write(entries); f.write(backup)
fat = str(out)+'@@1048576'
subprocess.run(['mformat','-i',fat,'-T',str(sectors-34-2048+1),'-F','-v','KUBEROOT','::'],check=True)
subprocess.run(['mmd','-i',fat,'::/kuberoot'],check=True)
subprocess.run(['mcopy','-i',fat,str(squash),'::/kuberoot/rootfs.squashfs'],check=True)
print(out, out.stat().st_size)
