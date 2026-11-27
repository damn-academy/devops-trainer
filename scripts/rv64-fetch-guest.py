#!/usr/bin/env python3
"""Host-side download only; no Rust or guest execution. Usage: script BASE_HTTP_URL."""
import concurrent.futures, gzip, hashlib, json, sys, urllib.request
from pathlib import Path
base = sys.argv[1].rstrip('/')
def get(path):
    for attempt in range(10):
        try:
            with urllib.request.urlopen(base + '/' + path, timeout=120) as response: return response.read()
        except Exception:
            if attempt == 9: raise
manifest = json.loads(get('chunks.json'))
out = Path(__file__).resolve().parent.parent / 'web/public/rv64'
out.mkdir(parents=True, exist_ok=True)
cache = out / '.chunks'; cache.mkdir(exist_ok=True)
def fetch(chunk):
    name = chunk['file']
    if '/' in name or '..' in name: raise ValueError('invalid chunk name')
    cached = cache / name
    if cached.exists():
        data = cached.read_bytes()
        if hashlib.sha256(data).hexdigest() == chunk['sha256']: return data
    data = get(name)
    if hashlib.sha256(data).hexdigest() != chunk['sha256']: raise ValueError(chunk['file'])
    cached.write_bytes(data)
    return data
with concurrent.futures.ThreadPoolExecutor(max_workers=32) as pool:
    for name, item in manifest.items():
        if name not in ['vmlinuz.efi', 'alpine.cpio']: raise ValueError('unexpected artifact')
        parts = []
        for index, data in enumerate(pool.map(fetch, item['chunks']), 1):
            parts.append(data)
            if index % 50 == 0: print(f'{name}: {index}/{len(item["chunks"])} verified chunks', flush=True)
        data = gzip.decompress(b''.join(parts))
        if hashlib.sha256(data).hexdigest() != item['sha256']: raise ValueError(name)
        temp = out / (name + '.download'); temp.write_bytes(data); temp.replace(out / name)
        print(name, len(data), item['sha256'], flush=True)
