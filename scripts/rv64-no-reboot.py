#!/usr/bin/env python3
"""Diagnostic-only RV64 kinit shutdown suppression, before services are stopped.
Patch the exact retained Go ELF by symbol, never a guessed instruction address.
"""
import hashlib
import importlib.util
import struct
from pathlib import Path

PIN = 'da30c8a762498db9659ac1be9da655beea8048ee29a39fcfd0ddb534076d6632'


def patch(path):
    path = Path(path)
    backup = path.with_name(path.name + '.rv64-reboot-original')
    raw = backup.read_bytes() if backup.exists() else path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != PIN:
        raise ValueError('unsupported kinit SHA-256; inspect the exact guest before adding a pin')
    spec = importlib.util.spec_from_file_location('guest_symbols', Path(__file__).with_name('rv64-guest-symbols.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if not backup.exists():
        backup.write_bytes(raw)
    functions = module.symbols(backup)['functions']
    matches = {(int(a, 16), int(b, 16)) for a, b, name in functions if name == 'main.shutdown'}
    if len(matches) != 1:
        raise ValueError('expected exactly one main.shutdown')
    address, end = matches.pop()
    shoff = struct.unpack_from('<Q', raw, 40)[0]
    stride, count = struct.unpack_from('<HH', raw, 58)
    sections = [struct.unpack_from('<IIQQQQIIQQ', raw, shoff + i * stride) for i in range(count)]
    offsets = [s[4] + address - s[3] for s in sections
               if s[1] == 1 and s[2] & 4 and s[3] <= address and address + 4 <= min(end, s[3] + s[5])]
    if len(offsets) != 1:
        raise ValueError('shutdown is not uniquely backed by executable ELF bytes')
    offset = offsets[0]
    data = bytearray(raw)
    # jalr x0, 0(ra): return before stack setup, lifecycle lock or stopServices.
    data[offset:offset + 4] = bytes.fromhex('67800000')
    path.write_bytes(data)
    return {'originalSha256': PIN, 'sha256': hashlib.sha256(data).hexdigest(),
            'function': 'main.shutdown', 'address': hex(address), 'originalBytes': raw[offset:offset+4].hex()}
