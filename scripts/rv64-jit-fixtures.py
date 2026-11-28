#!/usr/bin/env python3
"""Fetch existing pod-built ISA ELFs and Spike signatures for browser JIT gates.
No compiler runs locally. The pod builds remain scripts/rv64-build-tests.sh and
scripts/rv64-arch-tests.sh; missing fixtures are a hard failure.
"""
import base64, concurrent.futures, gzip, hashlib, json, os, pathlib, subprocess
root = pathlib.Path(__file__).resolve().parent.parent
env = dict(os.environ, KUBECONFIG=os.environ.get('KUBECONFIG', str(pathlib.Path.home()/'workshop.txt')))
def remote(code, *args):
    return subprocess.check_output(['kubectl', 'exec', '--context', 'admin@workshop', '-n', 'tenant-kuberoot', 'rv64-dev', '--', 'python3', '-c', code, *args], env=env, timeout=60)
meta = json.loads(remote('''
import pathlib,json,gzip,hashlib,base64
fixtures=[]
for p in sorted(pathlib.Path('/work/tests/isa').glob('*')):
 if p.is_file() and not p.suffix and p.name != 'rv64mi-p-breakpoint':
  fixtures.append(dict(name=p.name,elf=base64.b64encode(p.read_bytes()).decode()))
assert len(fixtures)==173, len(fixtures)
for p in sorted(pathlib.Path('/work/tests/arch-results').glob('*.elf')):
 fixtures.append(dict(name=p.stem,elf=base64.b64encode(p.read_bytes()).decode(),signature=p.with_suffix('.spike').read_text()))
assert len(fixtures)==439, len(fixtures)
b=gzip.compress(json.dumps(fixtures).encode());pathlib.Path('/work/out/jit-fixtures.gz').write_bytes(b)
print(json.dumps([len(b),hashlib.sha256(b).hexdigest()]))
'''))
def chunk(offset):
    return bytes.fromhex(remote('import sys;f=open("/work/out/jit-fixtures.gz","rb");f.seek(int(sys.argv[1]));print(f.read(4096).hex())',str(offset)).decode())
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    data=b''.join(pool.map(chunk, range(0,meta[0],4096)))
assert len(data)==meta[0] and hashlib.sha256(data).hexdigest()==meta[1]
dest=root/'web/public/rv64/jit-fixtures.json';dest.write_bytes(gzip.decompress(data))
print(dest, meta)
