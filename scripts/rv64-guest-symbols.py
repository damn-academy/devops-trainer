#!/usr/bin/env python3
"""Export ELF64 function ranges, including stripped Go 1.20+ pclntab.

Run against the *actual guest binaries*, not a rebuild. Output includes SHA-256.
No third-party packages or execution of guest code required.
"""
import base64
import hashlib
import json
import struct
import sys
from pathlib import Path


def symbols(path):
    b = Path(path).read_bytes()
    if b[:6] != b'\x7fELF\x02\x01' or struct.unpack_from('<H', b, 18)[0] != 243:
        raise ValueError('expected little-endian ELF64 RISC-V')
    shoff = struct.unpack_from('<Q', b, 40)[0]
    stride, count, names = struct.unpack_from('<HHH', b, 58)
    sections = [struct.unpack_from('<IIQQQQIIQQ', b, shoff + i * stride) for i in range(count)]
    strings = sections[names]
    def cstr(data, off):
        return data[off:data.index(b'\0', off)].decode('utf8', errors='replace')
    found = []
    unwind = None
    for s in sections:
        name = cstr(b, strings[4] + s[0])
        if s[1] == 2:  # SHT_SYMTAB
            st = sections[s[6]]
            entries = []
            for off in range(s[4], s[4] + s[5], s[9]):
                n, info, _, index, addr, size = struct.unpack_from('<IBBHQQ', b, off)
                if info & 15 == 2 and 0 < index < len(sections):
                    entries.append((addr, size, index, cstr(b, st[4] + n)))
            entries.sort()
            # Recovered kallsyms ELF has no st_size: bound by the next distinct
            # function in the same section, keeping aliases at the same start.
            ends = {}
            for addr, size, index, name in reversed(entries):
                end = addr + size if size else ends.get(index, sections[index][3] + sections[index][5])
                if end > addr:
                    found.append([addr, end, name])
                ends[index] = addr
        if name == '.gopclntab':
            p = b[s[4]:s[4] + s[5]]
            if p[:8] != b'\xf1\xff\xff\xff\x00\x00\x01\x08':
                # RISC-V minimum instruction quantum may be 2.
                if p[:6] != b'\xf1\xff\xff\xff\x00\x00' or p[7] != 8:
                    raise ValueError('unsupported Go pclntab header')
            nfunc, _, text, fnames, _, _, pctab, funcs = struct.unpack_from('<8Q', p, 8)
            if text == 0:
                # External Go linking leaves pcHeader.textStart zero. Runtime
                # uses moduledata.text instead (Go 1.20+ runtime/symtab.go).
                module = next((x for x in sections if cstr(b, strings[4] + x[0]) == '.go.module'), None)
                if module is None or module[5] < 192 or struct.unpack_from('<Q', b, module[4])[0] != s[3]:
                    raise ValueError('missing/unsupported external Go moduledata')
                text = struct.unpack_from('<Q', b, module[4] + 176)[0]
            if not any(x[2] & 4 and x[3] <= text < x[3] + x[5] for x in sections):
                raise ValueError('Go text base outside executable sections')
            unwind = {'quantum': p[6], 'pctab': base64.b64encode(p[pctab:funcs]).decode(), 'functions': []}
            for i in range(nfunc):
                entry, record = struct.unpack_from('<II', p, funcs + 8 * i)
                end = struct.unpack_from('<I', p, funcs + 8 * (i + 1))[0]
                nameoff = struct.unpack_from('<i', p, funcs + record + 4)[0]
                name = cstr(p, fnames + nameoff)
                found.append([text + entry, text + end, name])
                pcsp = struct.unpack_from('<I', p, funcs + record + 16)[0]
                flags = p[funcs + record + 41]
                unwind['functions'].append([hex(text + entry), hex(text + end), name, pcsp, flags])
    return {'path': str(path), 'sha256': hashlib.sha256(b).hexdigest(), 'goUnwind': unwind,
            'functions': sorted(set((hex(a), hex(z), n) for a, z, n in found), key=lambda x: int(x[0], 16))}


if __name__ == '__main__':
    json.dump([symbols(p) for p in sys.argv[1:]], sys.stdout)
    print()
