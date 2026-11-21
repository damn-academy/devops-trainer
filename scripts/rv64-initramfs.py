#!/usr/bin/env python3
"""Pod-only: package the pinned Alpine root into deterministic newc initramfs."""
import os
import stat
from pathlib import Path
assert os.environ.get('CARGO_HOME') == '/work/cargo', 'run in rv64-dev only'
root = Path('/work/guest/alpine')
init = root / 'init'
init.write_text('''#!/bin/sh
mount -t devtmpfs devtmpfs /dev
mount -t proc proc /proc
mount -t sysfs sysfs /sys
ip link set lo up
printf '\\nRV64_INIT_READY\\n'
exec /bin/sh
''')
init.chmod(0o755)
out = bytearray()
def emit(name, mode, data, ino):
    encoded = name.encode() + b'\0'
    fields = [ino, mode, 0, 0, 1, 0, len(data), 0, 0, 0, 0, len(encoded), 0]
    out.extend(b'070701' + ''.join(f'{v:08x}' for v in fields).encode() + encoded)
    out.extend(b'\0' * (-len(out) % 4))
    out.extend(data)
    out.extend(b'\0' * (-len(out) % 4))
for i, path in enumerate(sorted(root.rglob('*')), 1):
    s = path.lstat()
    if stat.S_ISLNK(s.st_mode): data = os.readlink(path).encode()
    elif stat.S_ISREG(s.st_mode): data = path.read_bytes()
    elif stat.S_ISDIR(s.st_mode): data = b''
    else: continue
    emit(str(path.relative_to(root)), s.st_mode, data, i)
emit('TRAILER!!!', 0, b'', 0)
Path('/work/guest/alpine.cpio').write_bytes(out)
print(f'alpine.cpio: {len(out)} bytes')
