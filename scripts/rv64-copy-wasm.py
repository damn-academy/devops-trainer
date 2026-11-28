#!/usr/bin/env python3
"""Small checked transfers survive API proxy resets; no local compilation."""
import hashlib, json, os, subprocess, tempfile, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
root = Path(__file__).resolve().parent.parent
names = ['rv64_core.js', 'rv64_core_bg.wasm', 'rv64_core.d.ts', 'rv64_core_bg.wasm.d.ts']
env = dict(os.environ, KUBECONFIG=os.environ.get('KUBECONFIG', str(Path.home()/'workshop.txt')))
def remote(code, *args):
    for attempt in range(5):
        try:
            return subprocess.check_output(['kubectl','exec','--context','admin@workshop','-n','tenant-kuberoot',os.environ.get('RV64_DEV_POD','rv64-dev'),'--','python3','-c',code,*args], env=env, timeout=35)
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            if attempt == 4: raise
            time.sleep(1)
base = os.environ.get("RV64_ARTIFACT_URL", "").rstrip("/")
def fetch(path):
    for attempt in range(5):
        try:
            with urllib.request.urlopen(base+"/"+path, timeout=15) as response: return response.read()
        except Exception:
            if attempt == 4: raise
            time.sleep(1)
meta = json.loads(fetch("transfer.json")) if base else json.loads(remote('import json,hashlib,pathlib,sys; print(json.dumps({n:[(p:=pathlib.Path("/work/out")/n).stat().st_size,hashlib.sha256(p.read_bytes()).hexdigest()] for n in sys.argv[1:]}))', *names))
dest = root/'web/public/rv64'
with tempfile.TemporaryDirectory(prefix='.verified-', dir=dest) as tmp:
    for name in names:
        size, digest = meta[name]; data = bytearray()
        def chunk_at(offset):
            chunk = fetch('part-'+name+'-'+str(offset)) if base else bytes.fromhex(remote('import sys; f=open("/work/out/"+sys.argv[1],"rb"); f.seek(int(sys.argv[2])); print(f.read(4096).hex())',name,str(offset)).decode())
            if len(chunk) != min(4096,size-offset): raise ValueError('short chunk')
            return chunk
        with ThreadPoolExecutor(max_workers=4) as pool:
            for chunk in pool.map(chunk_at, range(0,size,4096)): data.extend(chunk)
        if hashlib.sha256(data).hexdigest() != digest: raise ValueError('artifact changed during transfer: '+name)
        (Path(tmp)/name).write_bytes(data)
        print(name, digest, flush=True)
    for name in names: os.replace(Path(tmp)/name, dest/name)
