#!/usr/bin/env python3
"""Pod-only: publish checksum-verified small chunks for unreliable long transfers."""
import os, gzip, hashlib, json
from pathlib import Path
assert os.environ.get('CARGO_HOME') == '/work/cargo'
root = Path('/work/guest'); result = {}
for name in ['vmlinuz.efi', 'alpine.cpio']:
    data = (root / name).read_bytes(); compressed = gzip.compress(data, mtime=0)
    chunks = []
    for index, start in enumerate(range(0, len(compressed), 16384)):
        chunk = compressed[start:start+16384]; filename = f'{name}.part-{index:04d}'
        (root / filename).write_bytes(chunk)
        chunks.append({'file': filename, 'sha256': hashlib.sha256(chunk).hexdigest()})
    result[name] = {'sha256': hashlib.sha256(data).hexdigest(), 'chunks': chunks}
(root / 'chunks.json').write_text(json.dumps(result))
print({name: len(v['chunks']) for name, v in result.items()})
