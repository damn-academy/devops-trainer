#!/usr/bin/env python3
"""Download one pod-produced artifact as checked small chunks, then verify the whole file."""
import concurrent.futures, gzip, hashlib, json, shutil, sys, urllib.request
from pathlib import Path
base, name, destination = sys.argv[1:]
base = base.rstrip('/')
def get(path):
    for attempt in range(6):
        try:
            with urllib.request.urlopen(base + '/' + path, timeout=30) as r:
                return r.read()
        except Exception:
            if attempt == 5:
                raise
meta = json.loads(get(name + '.transfer.json'))
with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
    pages = list(pool.map(get, meta['pages']))
meta['chunks'] = [item for page in pages for item in json.loads(page)]
dest = Path(destination)
cache = dest.parent / ('.' + dest.name + '.chunks')
cache.mkdir(exist_ok=True, parents=True)
def fetch(item):
    filename, digest = item
    if '/' in filename or '..' in filename:
        raise ValueError('invalid chunk filename')
    path = cache / filename
    data = path.read_bytes() if path.exists() else b''
    if hashlib.sha256(data).hexdigest() != digest:
        data = get(filename)
    if hashlib.sha256(data).hexdigest() != digest:
        raise ValueError('checksum mismatch: ' + filename)
    path.write_bytes(data)
    return data
with concurrent.futures.ThreadPoolExecutor(max_workers=32) as pool:
    chunks = []
    for i, data in enumerate(pool.map(fetch, meta['chunks']), 1):
        chunks.append(data)
        if i % 500 == 0:
            print(name, i, '/', len(meta['chunks']), flush=True)
raw = gzip.decompress(b''.join(chunks))
if len(raw) != meta['size'] or hashlib.sha256(raw).hexdigest() != meta['sha256']:
    raise ValueError('whole artifact checksum mismatch')
temp = dest.with_suffix(dest.suffix + '.download')
temp.write_bytes(raw)
temp.replace(dest)
shutil.rmtree(cache)
print(name, meta['size'], meta['sha256'], flush=True)
