#!/usr/bin/env python3
"""Package a training restore's first seconds of RAM faults into one Range object.
Usage: MANIFEST TRAINING_RESULT OUTPUT_DIRECTORY [SECONDS]. Does not edit source.
Run this as the final build-time training/publication step before cold evaluation.
"""
import hashlib
import json
import os
from pathlib import Path
import sys

source, result, destination = map(Path, sys.argv[1:4])
seconds = float(sys.argv[4]) if len(sys.argv) > 4 else 5
manifest = json.loads(source.read_text())
document = json.loads(result.read_text())
if document['wasmSha256'] != manifest['machine']['wasmSha256']:
    raise SystemExit('Training result uses a different CPU build')
training = document['result']
samples = training['samples']
indices = []
for sample in samples:
    origin = sample['hostMonotonicMs'] - sample['elapsedMs']
    for fault in sample.get('snapshotFaultTrace', []):
        if fault['startMs'] - origin <= seconds * 1000 and fault['index'] not in indices:
            indices.append(fault['index'])
if not indices:
    raise SystemExit('No recorded hot-set faults')
if destination.exists():
    raise SystemExit('Destination already exists; preserve the previous artifact')
destination.mkdir(parents=True)
for path in source.parent.glob('*.bin'):
    os.link(path, destination / path.name)
packed = bytearray()
for index in indices:
    chunk = manifest['ram'][index]
    data = (source.parent / (chunk['sha256'] + '.bin')).read_bytes()
    assert len(data) == chunk['bytes'] and hashlib.sha256(data).hexdigest() == chunk['sha256']
    packed.extend(data)
digest = hashlib.sha256(packed).hexdigest()
(destination / (digest + '.bin')).write_bytes(packed)
manifest['hot'] = {'sha256': digest, 'bytes': len(packed), 'indices': indices}
(destination / 'paged.json').write_text(json.dumps(manifest))
print(json.dumps({'groups': len(indices), 'bytes': len(packed), 'seconds': seconds, 'sha256': digest}))
