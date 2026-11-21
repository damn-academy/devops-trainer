#!/usr/bin/env python3
"""Pod-only counterpart of rv64-fetch-file.py. Publish public artifacts only."""
import gzip
import hashlib
import json
import os
import sys
from pathlib import Path
assert os.environ.get('CARGO_HOME') == '/work/cargo', 'run in rv64-dev only'
for argument in sys.argv[1:]:
    path = Path(argument)
    raw = path.read_bytes()
    compressed = gzip.compress(raw, mtime=0, compresslevel=1)
    chunks = []
    for i, off in enumerate(range(0, len(compressed), 16384)):
        data = compressed[off:off+16384]
        name = f'{path.name}.chunk-{i}'
        (path.parent / name).write_bytes(data)
        chunks.append([name, hashlib.sha256(data).hexdigest()])
    pages = []
    for i in range(0, len(chunks), 100):
        name = f'{path.name}.page-{i}'
        (path.parent / name).write_text(json.dumps(chunks[i:i+100]))
        pages.append(name)
    meta = dict(size=len(raw), sha256=hashlib.sha256(raw).hexdigest(), pages=pages)
    (path.parent / (path.name + '.transfer.json')).write_text(json.dumps(meta))
    print(path.name, len(chunks), meta['sha256'], flush=True)
